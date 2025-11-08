import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ImageAnnotatorClient, protos } from '@google-cloud/vision';
import { FilesService } from '../files/files.service';
import { Place, PlaceDocument } from './schemas/imageData.model'
import axios, { AxiosInstance } from 'axios';

type LandmarkOut = {
  name: string;
  score: number | null;
  lat?: number;
  lon?: number;
  dist_m?: number | null;
  source: 'google_vision_landmark' | 'google_vision_web' | 'google_vision_web_best_guess';
};

type GeoPoint = { type: 'Point'; coordinates: [number, number] };



interface PlaceResponse {
  _id?: any;
  title?: string;
  images?: {
    thumbnail?: string;
    original?: string;
    local_original?: string;
    local_thumbnail?: string;
  };
  wikidata?: {
    countries?: string[];
    administrativeAreas?: string[];
    instanceOf?: string[];
    ranges?: string[];
    architects?: string[];
    height_m?: number;
  };
  description_long?: string,
  coordinates?: {
    type?: string;
    coordinates?: number[];
  };
}




type PlaceLeanMinimal = {
_id: any;
title?: string;
images?: {
thumbnail?: string;
original?: string;
local_thumbnail?: string;
local_original?: string;
};
coordinates?: { type: 'Point'; coordinates: [number, number] };
wikidata?: { qid?: string };
};

type DetailData = {
  title: string;
  page_url?: string;
  description_short?: string;
  description_html?: string;
  description_long?: string;
  images?: { thumbnail?: string; original?: string };
  coordinates?: { lat: number; lon: number } | null;
  wikidata?: {
    qid?: string;
    instance_of?: string | string[];
    countries?: string[];
    administrative_areas?: string[];
    ranges?: string[];
    elevation_m?: number;
    height_m?: number;
    prominence_m?: number;
    isolation_km?: number;
    architects?: string[];
    coordinates?: { lat: number; lon: number } | null;
  };
};


@Injectable()
export class VisionService {
  constructor(
       private readonly filesService: FilesService,
    @InjectModel('Place') private readonly placeModel: Model<any>,
    // @InjectModel(Place.name) private readonly placeModel: Model<PlaceDocument>
  ) {}

  private client = new ImageAnnotatorClient();
  private readonly EARTH_R = 6371000; // meters

  private haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
    const toRad = (v: number) => (v * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * this.EARTH_R * Math.asin(Math.sqrt(a));
  }

  private scoreWithGeo(visionScore: number, dist_m?: number | null, tau = 800) {
    if (dist_m == null) return visionScore;
    const geoPrior = Math.exp(-dist_m / tau);
    return 0.7 * visionScore + 0.3 * geoPrior;
  }

  private async landmarkDetect(imageBuffer: Buffer, maxResults: number) {
    const content = imageBuffer.toString('base64'); // <-- base64 avoids Buffer typing issues
    const [resp] = await this.client.annotateImage({
      image: { content },
      features: [
        {
          type: protos.google.cloud.vision.v1.Feature.Type.LANDMARK_DETECTION,
          maxResults,
        },
      ],
    });
    return resp.landmarkAnnotations ?? [];
  }

  private async webDetect(imageBuffer: Buffer, maxResults: number) {
    const content = imageBuffer.toString('base64'); // <-- base64
    const [resp] = await this.client.annotateImage({
      image: { content },
      features: [
        {
          type: protos.google.cloud.vision.v1.Feature.Type.WEB_DETECTION,
          maxResults,
        },
      ],
    });

    const web = resp.webDetection;
    const bestGuess = web?.bestGuessLabels?.[0]?.label;

    const entities =
      (web?.webEntities ?? [])
        .filter((e) => !!e.description)
        .map((e) => ({
          name: String(e.description),
          score: Number(e.score ?? 0),
          source: 'google_vision_web' as const,
        }))
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0)) ?? [];

    return { bestGuess, entities };
  }

  // async recognize(
  //   imageBuffer: Buffer,
  //   opts: { lat?: number; lon?: number; topK?: number } = {},
  // ): Promise<LandmarkOut[]> {
  //   const topK = Math.max(1, Math.min(20, opts.topK ?? 5));
  //   const lat = typeof opts.lat === 'number' ? opts.lat : undefined;
  //   const lon = typeof opts.lon === 'number' ? opts.lon : undefined;

  //   const anns = await this.landmarkDetect(imageBuffer, Math.max(10, topK));

  //   if (anns.length) {
  //     type Scored = LandmarkOut & { finalScore: number };

  //     const scored: Scored[] = anns.map((ann) => {
  //       const loc = ann.locations?.find((l) => l.latLng);
  //       const pLat = loc?.latLng?.latitude ?? undefined;
  //       const pLon = loc?.latLng?.longitude ?? undefined;

  //       const dist =
  //         lat != null && lon != null && pLat != null && pLon != null
  //           ? this.haversine(lat, lon, pLat, pLon)
  //           : null;

  //       const score = Number(ann.score ?? 0);
  //       const finalScore = this.scoreWithGeo(score, dist);

  //       return {
  //         name: String(ann.description ?? ''),
  //         score,
  //         lat: pLat,
  //         lon: pLon,
  //         dist_m: dist,
  //         source: 'google_vision_landmark' as const,
  //         finalScore,
  //       };
  //     });

  //     scored.sort((a, b) => b.finalScore - a.finalScore);

  //     return scored.slice(0, topK).map(({ finalScore, ...r }) => r);
  //   }

  //   // Fallback: Web Detection
  //   const { bestGuess, entities } = await this.webDetect(imageBuffer, Math.max(10, topK * 2));
  //   const out: LandmarkOut[] = [];
  //   if (bestGuess) {
  //     out.push({ name: bestGuess, score: null, source: 'google_vision_web_best_guess' });
  //   }
  //   out.push(...entities.slice(0, topK));
  //   return out;
  // }











async recognize(
  imageBuffer: Buffer,
  opts: { lat?: number; lon?: number; topK?: number } = {},
): Promise<LandmarkOut[]> {
  // Default to 1 so you only get a single result unless you explicitly ask for more
  const topK = Math.max(1, Math.min(20, opts.topK ?? 1));
  const lat = typeof opts.lat === 'number' ? opts.lat : undefined;
  const lon = typeof opts.lon === 'number' ? opts.lon : undefined;

  const anns = await this.landmarkDetect(imageBuffer, Math.max(10, topK));

  if (anns.length) {
    type Scored = LandmarkOut & { finalScore: number };

    const scored: Scored[] = anns.map((ann) => {
      const loc = ann.locations?.find((l) => l.latLng);
      const pLat = loc?.latLng?.latitude ?? undefined;
      const pLon = loc?.latLng?.longitude ?? undefined;

      const dist =
        lat != null && lon != null && pLat != null && pLon != null
          ? this.haversine(lat, lon, pLat, pLon)
          : null;

      const score = Number(ann.score ?? 0);
      const finalScore = this.scoreWithGeo(score, dist);

      return {
        name: String(ann.description ?? ''),
        score,
        lat: pLat,
        lon: pLon,
        dist_m: dist,
        source: 'google_vision_landmark' as const,
        finalScore,
      };
    });

    // Deduplicate by name (case/trim-insensitive), keep the one with highest score
    const byName = new Map<string, Scored>();
    for (const lm of scored) {
      const key = lm.name.trim().toLowerCase();
      const existing = byName.get(key);
      if (
        !existing ||
        lm.score > existing.score ||
        (lm.score === existing.score && lm.finalScore > existing.finalScore)
      ) {
        byName.set(key, lm);
      }
    }

    // Rank by score first, then finalScore
    const ranked = Array.from(byName.values()).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.finalScore - a.finalScore;
    });

    // return ranked.slice(0, topK).map(({ finalScore, ...r }) => r);
    const best = ranked[0];
if (!best) return [];
const { finalScore, ...bestOut } = best;
return [bestOut];
  }

  // Fallback: Web Detection (return only topK, default 1)
  const { bestGuess, entities } = await this.webDetect(imageBuffer, Math.max(10, topK * 2));
  const rankedEntities = (entities ?? []).slice().sort(
    (a, b) => Number(b.score ?? 0) - Number(a.score ?? 0)
  );

  const out: LandmarkOut[] = [];
  if (rankedEntities.length) {
    out.push(...rankedEntities.slice(0, topK));
  } else if (bestGuess) {
    out.push({ name: bestGuess, score: null, source: 'google_vision_web_best_guess' });
  }
  return out.slice(0, topK);
}




















 private readonly WIKI_UA = 'ScanitectAI/1.0 (+https://scanitectai.com/api; mailto:dev@scanitectai.com)';
  private readonly WIKI_HEADERS = {
    'User-Agent': this.WIKI_UA,
    'Accept': 'application/json'
  };
  private readonly MAX_CONCURRENCY = 5;

  // Shared axios instance for all Wikipedia/Wikidata calls
  private readonly wiki: AxiosInstance = axios.create({
    headers: this.WIKI_HEADERS,
    timeout: 12000
  });

  private sleep(ms: number) {
    return new Promise<void>(r => setTimeout(r, ms));
  }

  private async mapWithConcurrency<T, R>(
    items: T[],
    limit: number,
    fn: (item: T, idx: number) => Promise<R>
  ): Promise<R[]> {
    const out: R[] = [];
    for (let i = 0; i < items.length; i += limit) {
      const slice = items.slice(i, i + limit);
      const part = await Promise.all(slice.map((it, j) => fn(it, i + j)));
      out.push(...part);
      // light pause to be nice to the API
      await this.sleep(100);
    }
    return out;
  }

  private readonly PREFERRED_TERMS = [
    'statue','monument','landmark','building','tower','bridge','park','temple','cathedral',
    'church','mosque','museum','palace','castle','fort','arch','dam','pagoda','stupa',
    'shrine','island','mountain','volcano','waterfall','river','bay','lake'
  ];

  // Fetch REST summary with UA
  private async fetchWikiSummary(title: string, lang = 'en') {
    const res = await this.wiki.get(
      `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      { params: { redirect: true } }
    );
    return res.data;
  }

  // Keep this; used as one of the search sources
  private async searchBestTitles(query: string, lang = 'en', limit = 5): Promise<string[]> {
    const res = await this.wiki.get(`https://${lang}.wikipedia.org/w/api.php`, {
      params: {
        action: 'query',
        list: 'search',
        srwhat: 'nearmatch',
        srlimit: limit,
        srsearch: query,
        utf8: 1,
        format: 'json',
        origin: '*'
      }
    });
    const hits = res.data?.query?.search || [];
    return hits.map((h: any) => h.title);
  }

  // Better search focusing on titles with parentheses qualifiers like "(statue)"
  private async searchByTitle(query: string, lang = 'en', limit = 10): Promise<string[]> {
    const res = await this.wiki.get(`https://${lang}.wikipedia.org/w/api.php`, {
      params: {
        action: 'query',
        list: 'search',
        srsearch: `intitle:"${query}"`,
        srlimit: limit,
        srnamespace: 0,
        format: 'json',
        origin: '*'
      }
    });
    const hits = res.data?.query?.search || [];
    return hits.map((h: any) => h.title);
  }

  // If we land on a disambiguation page, scan its links
  private async fetchDisambigLinks(title: string, lang = 'en', limit = 200): Promise<string[]> {
    const out: string[] = [];
    let plcontinue: string | undefined = undefined;

    do {
      const res = await this.wiki.get(`https://${lang}.wikipedia.org/w/api.php`, {
        params: {
          action: 'query',
          prop: 'links',
          plnamespace: 0,
          pllimit: Math.min(500, limit),
          titles: title,
          format: 'json',
          origin: '*',
          ...(plcontinue ? { plcontinue } : {})
        }
      });
      const pages = res.data?.query?.pages || {};
      const firstKey = Object.keys(pages)[0];
      const links = firstKey ? (pages[firstKey]?.links || []) : [];
      out.push(...links.map((l: any) => l.title));
      plcontinue = res.data?.continue?.plcontinue;
    } while (plcontinue && out.length < limit);

    // de-dup and cap
    return Array.from(new Set(out)).slice(0, limit);
  }

  private parenTerm(title: string): string | null {
    const m = title.match(/\(([^)]+)\)\s*$/);
    return m ? m[1].toLowerCase() : null;
  }

  private containsPreferred(text?: string, terms = this.PREFERRED_TERMS) {
    if (!text) return false;
    const lc = text.toLowerCase();
    return terms.some(t => lc.includes(t));
  }

  private pickBestCandidate(name: string, summaries: any[], terms = this.PREFERRED_TERMS): any | null {
    if (!summaries.length) return null;
    const base = name.toLowerCase();

    const scored = summaries
      .filter(s => s && s.type !== 'disambiguation')
      .map(s => {
        let score = 0;
        const title = s.title || '';
        const lcTitle = title.toLowerCase();
        const p = this.parenTerm(title);

        if (lcTitle.startsWith(base + ' (')) score += 5;     // Name (…)
        if (p && terms.includes(p)) score += 10;             // "(statue)" etc.
        if (this.containsPreferred(s.description, terms)) score += 4; // description hints
        if (s.originalimage?.source) score += 1;             // richer page often = the one
        return { s, score };
      })
      .sort((a, b) => b.score - a.score);

    return scored[0]?.s || null;
  }

  // Smarter resolver that avoids disambiguation pages, with throttling + softer 403/429 handling
  private async resolveWikipedia(name: string, lang = 'en'): Promise<{ title: string; summary: any } | null> {
    // 1) Try exact (with redirect)
    let first: any = null;
    try {
      first = await this.fetchWikiSummary(name, lang);
      if (first && first.type !== 'disambiguation') {
        return { title: first.title, summary: first };
      }
    } catch (e: any) {
      const code = e?.response?.status;
      if (code === 404 || code === 403 || code === 429) {
        // continue to search; 403/429 often due to rate/UA—search might still work
        // if UA is set (we set it above).
      } else {
        throw e;
      }
    }

    // 2) Gather candidates from two searches
    const titleSet = new Set<string>();
    try {
      const t1 = await this.searchByTitle(name, lang, 10);
      t1.forEach(t => titleSet.add(t));
    } catch {}
    try {
      const t2 = await this.searchBestTitles(name, lang, 10);
      t2.forEach(t => titleSet.add(t));
    } catch {}

    // Prioritize "Name (" candidates first
    const allCandidates = Array.from(titleSet);
    const prioritized = [
      ...allCandidates.filter(t => t.toLowerCase().startsWith(name.toLowerCase() + ' (')),
      ...allCandidates
    ].slice(0, 20);

    // Throttled summaries
    const summariesRaw = await this.mapWithConcurrency(
      prioritized,
      this.MAX_CONCURRENCY,
      t => this.fetchWikiSummary(t, lang).catch(() => null)
    );
    const summaries = summariesRaw.filter(Boolean) as any[];

    const pick = this.pickBestCandidate(name, summaries);
    if (pick) return { title: pick.title, summary: pick };

    // 3) If the first hit was a disambiguation page, mine its links
    if (first && first.type === 'disambiguation') {
      const links = await this.fetchDisambigLinks(first.title, lang, 200);
      const prioritizedLinks = [
        ...links.filter(t => t.toLowerCase().startsWith(name.toLowerCase() + ' (')),
        ...links
      ].slice(0, 30);

      const linkSummariesRaw = await this.mapWithConcurrency(
        prioritizedLinks,
        this.MAX_CONCURRENCY,
        t => this.fetchWikiSummary(t, lang).catch(() => null)
      );
      const linkSummaries = linkSummariesRaw.filter(Boolean) as any[];

      const pick2 = this.pickBestCandidate(name, linkSummaries);
      if (pick2) return { title: pick2.title, summary: pick2 };
    }

    // 4) Fall back to disambiguation (last resort)
    if (first) return { title: first.title, summary: first };
    return null;
  }

  private async fetchWikidataViaAPI(qid: string) {
    try {
      const entityRes = await this.wiki.get(
        `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`
      );
      const entity = entityRes.data?.entities?.[qid];
      const claims = entity?.claims || {};

      const getQuantity = (pid: string): number | undefined => {
        const arr = claims[pid];
        if (!arr) return;
        for (const st of arr) {
          const val = st?.mainsnak?.datavalue?.value;
          if (val && typeof val.amount === 'string') {
            const num = Number(val.amount);
            if (Number.isFinite(num)) return num;
          }
        }
        return undefined;
      };

      const getFirstCoord = () => {
        const arr = claims['P625'];
        if (!arr) return null;
        for (const st of arr) {
          const v = st?.mainsnak?.datavalue?.value;
          if (v && typeof v.latitude === 'number' && typeof v.longitude === 'number') {
            return { lat: v.latitude, lon: v.longitude };
          }
        }
        return null;
      };

      const getEntityIds = (pid: string): string[] => {
        const out: string[] = [];
        const arr = claims[pid];
        if (!arr) return out;
        for (const st of arr) {
          const id = st?.mainsnak?.datavalue?.value?.id;
          if (id) out.push(id);
        }
        return out;
      };

      const countryIds = getEntityIds('P17');
      const adminIds = getEntityIds('P131');
      const rangeIds = [...getEntityIds('P706'), ...getEntityIds('P4552')];
      const architectIds = getEntityIds('P84');
      const instanceIds = getEntityIds('P31');

      let labels: Record<string, string> = {};
      const ids = Array.from(new Set<string>([
        ...countryIds, ...adminIds, ...rangeIds, ...architectIds, ...instanceIds
      ]));
      if (ids.length) {
        const labelsRes = await this.wiki.get('https://www.wikidata.org/w/api.php', {
          params: {
            action: 'wbgetentities',
            ids: ids.join('|'),
            props: 'labels',
            languages: 'en',
            format: 'json',
            origin: '*'
          }
        });
        const ents = labelsRes.data?.entities || {};
        for (const [id, obj] of Object.entries<any>(ents)) {
          const label = (obj as any)?.labels?.en?.value;
          if (label) labels[id] = label;
        }
      }
      const mapLabels = (arr: string[]) => arr.map(id => labels[id]).filter(Boolean);

      return {
        countries: mapLabels(countryIds),
        administrative_areas: mapLabels(adminIds),
        ranges: mapLabels(rangeIds),
        architects: mapLabels(architectIds),
        instance_of: mapLabels(instanceIds).join(', '),
        elevation_m: getQuantity('P2044'),
        height_m: getQuantity('P2048'),
        prominence_m: getQuantity('P2660'),
        isolation_km: getQuantity('P3108'),
        coordinates: getFirstCoord()
      };
    } catch (e) {
      console.warn('Wikidata API fallback failed:', (e as any)?.message || e);
      return null;
    }
  }

  // --- your main method ---

  async getDetail(
    PlaceName: string,
    opts: { longDescriptionChars?: number; lang?: string } = {}
  ) {
    const { longDescriptionChars = 1500, lang = 'en' } = opts;

    console.log("here come");

    const parseWikidataPoint = (wkt?: string) => {
      if (!wkt) return null;
      const m = wkt.match(/Point\(([-\d.]+)\s+([-\d.]+)\)/);
      return m ? { lat: Number(m[2]), lon: Number(m[1]) } : null;
    };
    const toNumber = (v?: string) => {
      if (v == null) return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };

    try {
      // Resolve canonical Wikipedia title first
      const resolved = await this.resolveWikipedia(PlaceName, lang);
      if (!resolved) {
        return { status: 404, statusMessage: 'not_found', data: `No Wikipedia page found for "${PlaceName}"` };
      }
      const resolvedTitle = resolved.title;
      const wikiData = resolved.summary;

      // Longer description (with UA)
      let longDescription = '';
      try {
        const extractRes = await this.wiki.get(`https://${lang}.wikipedia.org/w/api.php`, {
          params: {
            action: 'query',
            prop: 'extracts',
            explaintext: 1,
            exchars: longDescriptionChars,
            redirects: 1,
            titles: resolvedTitle,
            format: 'json',
            origin: '*'
          }
        });
        const pages = extractRes.data?.query?.pages;
        const firstKey = pages ? Object.keys(pages)[0] : undefined;
        longDescription = firstKey ? pages[firstKey]?.extract || '' : '';
      } catch (e: any) {
        console.warn('Extended description fetch failed:', e?.message || e);
      }

      // Wikidata enrichment
      let wd = {
        qid: wikiData.wikibase_item || '',
        instance_of: '',
        countries: [] as string[],
        administrative_areas: [] as string[],
        ranges: [] as string[],
        elevation_m: undefined as number | undefined,
        height_m: undefined as number | undefined,
        prominence_m: undefined as number | undefined,
        isolation_km: undefined as number | undefined,
        architects: [] as string[],
        coordinates: null as null | { lat: number; lon: number }
      };

      if (wikiData.wikibase_item) {
        const qid = wikiData.wikibase_item;
        const sparqlQuery = `
          SELECT DISTINCT
            ?coord ?elev ?height ?prom ?iso
            ?countryLabel ?adminLabel ?range1Label ?range2Label
            ?instanceLabel ?architectLabel
          WHERE {
            VALUES ?item { wd:${qid} }

            OPTIONAL { ?item wdt:P625  ?coord. }
            OPTIONAL { ?item wdt:P2044 ?elev. }
            OPTIONAL { ?item wdt:P2048 ?height. }
            OPTIONAL { ?item wdt:P2660 ?prom. }
            OPTIONAL { ?item wdt:P3108 ?iso. }

            OPTIONAL { ?item wdt:P17   ?country. }
            OPTIONAL { ?item wdt:P131  ?admin. }

            OPTIONAL { ?item wdt:P706  ?range1. }
            OPTIONAL { ?item wdt:P4552 ?range2. }

            OPTIONAL { ?item wdt:P31   ?instance. }
            OPTIONAL { ?item wdt:P84   ?architect. }

            SERVICE wikibase:label { bd:serviceParam wikibase:language "${lang}". }
          }
          LIMIT 100
        `;

        let sparqlWorked = false;

        try {
          const sparqlResponse = await axios.get('https://query.wikidata.org/sparql', {
            headers: {
              Accept: 'application/sparql-results+json',
              'User-Agent': this.WIKI_UA
            },
            params: { query: sparqlQuery },
            timeout: 12000
          });

          const rows = sparqlResponse.data?.results?.bindings ?? [];

          const countriesSet = new Set<string>();
          const adminsSet = new Set<string>();
          const rangesSet = new Set<string>();
          const instancesSet = new Set<string>();
          const architectsSet = new Set<string>();

          let coord: { lat: number; lon: number } | null = null;
          let elevation_m: number | undefined;
          let height_m: number | undefined;
          let prominence_m: number | undefined;
          let isolation_km: number | undefined;

          for (const b of rows) {
            if (b.countryLabel?.value) countriesSet.add(b.countryLabel.value);
            if (b.adminLabel?.value) adminsSet.add(b.adminLabel.value);
            if (b.range1Label?.value) rangesSet.add(b.range1Label.value);
            if (b.range2Label?.value) rangesSet.add(b.range2Label.value);
            if (b.instanceLabel?.value) instancesSet.add(b.instanceLabel.value);
            if (b.architectLabel?.value) architectsSet.add(b.architectLabel.value);

            if (!coord && b.coord?.value) coord = parseWikidataPoint(b.coord.value);
            if (elevation_m === undefined && b.elev?.value) elevation_m = toNumber(b.elev.value);
            if (height_m === undefined && b.height?.value) height_m = toNumber(b.height.value);
            if (prominence_m === undefined && b.prom?.value) prominence_m = toNumber(b.prom.value);
            if (isolation_km === undefined && b.iso?.value) isolation_km = toNumber(b.iso.value);
          }

          wd = {
            qid,
            instance_of: Array.from(instancesSet).join(', '),
            countries: Array.from(countriesSet),
            administrative_areas: Array.from(adminsSet),
            ranges: Array.from(rangesSet),
            elevation_m,
            height_m,
            prominence_m,
            isolation_km,
            architects: Array.from(architectsSet),
            coordinates: coord
          };

          sparqlWorked = true;
        } catch (sparqlErr: any) {
          console.warn('Wikidata SPARQL failed:', sparqlErr?.message || sparqlErr);
        }

        if (
          !sparqlWorked ||
          (!wd.countries.length && !wd.administrative_areas.length && !wd.height_m && !wd.elevation_m)
        ) {
          const apiFallback = await this.fetchWikidataViaAPI(qid);
          if (apiFallback) {
            wd = {
              qid,
              instance_of: apiFallback.instance_of || wd.instance_of,
              countries: apiFallback.countries?.length ? apiFallback.countries : wd.countries,
              administrative_areas: apiFallback.administrative_areas?.length ? apiFallback.administrative_areas : wd.administrative_areas,
              ranges: apiFallback.ranges?.length ? apiFallback.ranges : wd.ranges,
              elevation_m: apiFallback.elevation_m ?? wd.elevation_m,
              height_m: apiFallback.height_m ?? wd.height_m,
              prominence_m: apiFallback.prominence_m ?? wd.prominence_m,
              isolation_km: apiFallback.isolation_km ?? wd.isolation_km,
              architects: apiFallback.architects?.length ? apiFallback.architects : wd.architects,
              coordinates: apiFallback.coordinates ?? wd.coordinates
            };
          }
        }
      }

      const coords =
        wd.coordinates ||
        (wikiData.coordinates ? { lat: wikiData.coordinates.lat, lon: wikiData.coordinates.lon } : null);

      const data = {
        title: wikiData.title || resolvedTitle,
        description_short: wikiData.extract || '',
        description_html: wikiData.extract_html || '',
        description_long: longDescription,
        page_url: wikiData.content_urls?.desktop?.page || '',
        images: {
          thumbnail: wikiData.thumbnail?.source || '',
          original: wikiData.originalimage?.source || ''
        },
        coordinates: coords,
        wikidata: wd
      };

      return { status: 200, statusMessage: 'success', data };
    } catch (err: any) {
      console.warn('Wikipedia lookup failed:', err?.message || err);
      return { status: err?.response?.status || 500, statusMessage: 'error', data: 'Error fetching data' };
    }
  }


































  private buildFileUrl(fileId: string) {
    const base = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
    return `${base}/files/${fileId}`;
  }

  private extFromMime(m: string) {
    const mm = (m || '').toLowerCase();
    if (mm.includes('png')) return 'png';
    if (mm.includes('webp')) return 'webp';
    if (mm.includes('gif')) return 'gif';
    if (mm.includes('heic') || mm.includes('heif')) return 'heic';
    if (mm.includes('bmp')) return 'bmp';
    if (mm.includes('svg')) return 'svg';
    if (mm.includes('jpeg') || mm.includes('jpg')) return 'jpg';
    return 'bin';
  }

  private extFromUrl(u?: string) {
    if (!u) return undefined;
    try {
      const pathname = new URL(u).pathname;
      const m = pathname.match(/\.([a-z0-9]+)(?:\?|#|$)/i);
      return m?.[1]?.toLowerCase();
    } catch {
      return undefined;
    }
  }

  private sanitizeFilename(input: string) {
    return (input || 'image')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 70);
  }

  private isHttpUrl(s?: string) {
    if (!s) return false;
    return /^https?:\/\/\S+/i.test(s);
  }


  private extractImageUrl(detail: any): string | undefined {
    if (!detail) return undefined;

    // Common Wikipedia shapes:
    // - detail.image
    // - detail.thumbnail?.source
    // - detail.originalimage?.source
    // - detail.images?.[0]?.source or .url
    if (typeof detail.image === 'string' && this.isHttpUrl(detail.image)) return detail.image;
    if (this.isHttpUrl(detail?.thumbnail?.source)) return detail.thumbnail.source;
    if (this.isHttpUrl(detail?.originalimage?.source)) return detail.originalimage.source;

    if (Array.isArray(detail.images)) {
      for (const i of detail.images) {
        const u = i?.source || i?.url;
        if (this.isHttpUrl(u)) return u;
      }
    }

    return undefined;
  }



  private async downloadAndStoreImage(imageUrl: string, placeId?: string, placeName?: string) {
  const allowedMimes = new Set([
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif',
    'image/svg+xml',
    'image/bmp',
  ]);

  const resp = await axios.get(imageUrl, {
    responseType: 'stream',
    timeout: 20000,
    maxBodyLength: Infinity,     // remove stream size limit
    maxContentLength: Infinity,  // extra safety for axios versions
    validateStatus: (s) => s >= 200 && s < 400,
  });

  const mimeType = String(resp.headers['content-type'] || 'image/jpeg').toLowerCase();
  if (!allowedMimes.has(mimeType)) {
    throw new Error(`Unsupported image type from Wikipedia: ${mimeType}`);
  }

  const ext = this.extFromUrl(imageUrl) || this.extFromMime(mimeType) || 'jpg';
  const filename = `${this.sanitizeFilename(placeName || 'place')}-${Date.now()}.${ext}`;

  const { fileId } = await this.filesService.uploadFromStream(
    resp.data,
    filename,
    mimeType,
    { source: 'wikipedia', imageUrl, placeId, placeName },
    'avatars',
  );

  return {
    fileId,
    localUrl: this.buildFileUrl(fileId),
    mimeType,
    filename,
  };
}



  private toPlaceDoc(detail: any, placeName: string) {
  return {
    title: placeName, // <-- must exist in schema
    description: detail?.extract ?? detail?.description,
    image: detail?.image,                 // make sure these exist in schema
    imageFileId: detail?.imageFileId,     // ^
    imageOriginalUrl: detail?.imageOriginalUrl,
    wikiPageId: detail?.pageid ?? detail?.pageId,
  };
}







private toPoint(latRaw: unknown, lonRaw: unknown): GeoPoint | undefined {
  const lat = typeof latRaw === 'string' ? parseFloat(latRaw) : (latRaw as number | undefined);
  const lon = typeof lonRaw === 'string' ? parseFloat(lonRaw) : (lonRaw as number | undefined);
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    return { type: 'Point', coordinates: [Number(lon), Number(lat)] };
  }
  return undefined;
}

private normalizeWikidataPoint(wdCoords: any): GeoPoint | undefined {
  if (!wdCoords) return undefined;

  const candidate = Array.isArray(wdCoords) ? wdCoords[0] : wdCoords;

  // Already GeoJSON?
  if (
    candidate?.type === 'Point' &&
    Array.isArray(candidate.coordinates) &&
    candidate.coordinates.length === 2
  ) {
    const [x, y] = candidate.coordinates;
    if (Number.isFinite(x) && Number.isFinite(y)) {
      return { type: 'Point', coordinates: [Number(x), Number(y)] };
    }
  }

  // Object with lat/lon
  const la = candidate?.lat ?? candidate?.latitude;
  const lo = candidate?.lon ?? candidate?.lng ?? candidate?.longitude;
  return this.toPoint(la, lo);
}




async upsertPlaceFromDetail(detail: any, placeName: string) {
  const qid: string | undefined =
    detail?.wikidata?.qid ||
    detail?.wikidata?.QID ||
    detail?.wikidata?.id;

  // Prefer qid for upsert to respect unique index on wikidata.qid
  const filter = qid ? { 'wikidata.qid': qid } : { title: placeName };

  const existing = await this.placeModel
    .findOne(filter)
    .select('_id title images coordinates wikidata')
    .lean<PlaceLeanMinimal | null>();

  // Remote URLs from payload
  const remoteOriginalUrl: string | undefined =
    detail?.images?.original || this.extractImageUrl(detail);
  const remoteThumbUrl: string | undefined = detail?.images?.thumbnail;

  let localOriginalUrl: string | undefined = existing?.images?.local_original;
  let localThumbnailUrl: string | undefined = existing?.images?.local_thumbnail;

  const existingId = existing?._id ? String(existing._id) : undefined;

  // Save local original
  if (remoteOriginalUrl && this.isHttpUrl(remoteOriginalUrl)) {
    const needsNewOriginal =
      existing?.images?.original !== remoteOriginalUrl ||
      !existing?.images?.local_original;

    if (needsNewOriginal) {
      try {
        const uploaded = await this.downloadAndStoreImage(
          remoteOriginalUrl,
          existingId,
          placeName,
        );
        localOriginalUrl = uploaded.localUrl;
      } catch (e: any) {
        console.warn('[upsert] Local original save failed:', e?.message || e);
      }
    }
  }

  // Save local thumbnail
  if (remoteThumbUrl && this.isHttpUrl(remoteThumbUrl)) {
    if (remoteOriginalUrl && remoteThumbUrl === remoteOriginalUrl) {
      // If thumb is same as original, reuse local_original
      if (localOriginalUrl) {
        localThumbnailUrl = localOriginalUrl;
      } else if (
        existing?.images?.original === remoteOriginalUrl &&
        existing?.images?.local_original
      ) {
        localThumbnailUrl = existing.images.local_original;
      } else {
        // Fallback: upload once and reuse for both
        try {
          const uploaded = await this.downloadAndStoreImage(
            remoteThumbUrl,
            existingId,
            placeName,
          );
          localOriginalUrl = uploaded.localUrl;
          localThumbnailUrl = uploaded.localUrl;
        } catch (e: any) {
          console.warn('[upsert] Local thumb(original) save failed:', e?.message || e);
        }
      }
    } else {
      // Separate thumbnail
      const needsNewThumb =
        existing?.images?.thumbnail !== remoteThumbUrl ||
        !existing?.images?.local_thumbnail;

      if (needsNewThumb) {
        try {
          const uploaded = await this.downloadAndStoreImage(
            remoteThumbUrl,
            existingId,
            placeName,
          );
          localThumbnailUrl = uploaded.localUrl;
        } catch (e: any) {
          console.warn('[upsert] Local thumbnail save failed:', e?.message || e);
        }
      }
    }
  }

  // Coordinates (GeoJSON [lon, lat]) using helpers
  const latRaw =
    detail?.coordinates?.lat ??
    detail?.coordinates?.latitude ??
    detail?.lat;
  const lonRaw =
    detail?.coordinates?.lon ??
    detail?.coordinates?.lng ??
    detail?.coordinates?.longitude ??
    detail?.lon;

  const mainPoint = this.toPoint(latRaw, lonRaw);
  const wdPoint = this.normalizeWikidataPoint(detail?.wikidata?.coordinates);

  // Normalize wikidata values (flattened; no root write to 'wikidata')
  const wd = detail?.wikidata || {};
  const toArray = (v: any) =>
    Array.isArray(v)
      ? v
      : typeof v === 'string'
      ? v.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

  const instanceOf = toArray(wd.instance_of ?? wd.instanceOf);
  const countries = toArray(wd.countries);
  const administrativeAreas = toArray(wd.administrative_areas ?? wd.administrativeAreas);
  const ranges = toArray(wd.ranges);
  const architects = toArray(wd.architects);
  const height_m = wd.height_m; // keep as-is (number or undefined)

  // Build images object for DB
  const images: Record<string, any> = {};
  if (remoteOriginalUrl) images.original = remoteOriginalUrl;
  if (remoteThumbUrl) images.thumbnail = remoteThumbUrl;
  if (localOriginalUrl) images.local_original = localOriginalUrl;
  if (localThumbnailUrl) images.local_thumbnail = localThumbnailUrl;

  // Build update (do NOT $set title; only set on insert)
  const $set: Record<string, any> = {
    description_short: detail?.description_short,
    description_html: detail?.description_html,
    description_long: detail?.description_long,
    page_url: detail?.page_url,
  };
  if (Object.keys(images).length) $set.images = images;
  if (mainPoint) $set.coordinates = mainPoint;

  // Flattened wikidata $set
  if (qid !== undefined) $set['wikidata.qid'] = qid; // don't unset qid if not provided
  $set['wikidata.instanceOf'] = instanceOf; // set [] if empty
  $set['wikidata.countries'] = countries;
  $set['wikidata.administrativeAreas'] = administrativeAreas;
  $set['wikidata.ranges'] = ranges;
  $set['wikidata.architects'] = architects;
  if (height_m !== undefined) $set['wikidata.height_m'] = height_m;

  // Coordinates under wikidata
  if (wdPoint) $set['wikidata.coordinates'] = wdPoint;

  const $unset: Record<string, any> = {};
  if (!mainPoint) $unset.coordinates = 1;
  if (!wdPoint) $unset['wikidata.coordinates'] = 1;
  if (height_m === undefined) $unset['wikidata.height_m'] = 1;

  // Clean undefined from $set (for top-level scalar props we added)
  for (const k of Object.keys($set)) {
    if ($set[k] === undefined) delete $set[k];
  }

  const update: any = { $set };
  if (Object.keys($unset).length) update.$unset = $unset;
  if (placeName) update.$setOnInsert = { title: placeName };

  const opts = {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
    strict: false, // until schema includes local_* or other new fields
  } as const;

  try {
    const response = await this.placeModel.findOneAndUpdate(filter, update, opts).lean() as PlaceResponse ;


    console.log("the response", response)


const filteredDetail = {
      id :  response?._id,
      title: response?.title,
      thumbnailImage: response?.images?.local_thumbnail,
      originalImage: response?.images?.local_original,
      description: response?.description_long,
      countries: response?.wikidata?.countries?.[0],
      administrativeAreas: response?.wikidata?.administrativeAreas?.[0],
      ranges: response?.wikidata?.ranges,
      instanceOf: response?.wikidata?.instanceOf,
      architects: response?.wikidata?.architects?.[0],
      coordinates: response?.coordinates?.coordinates,
      height: response?.wikidata?.height_m,
    };


    return filteredDetail
  } catch (e: any) {
    // In case of race with unique qid, retry
    if (e?.code === 11000 && qid) {
      return await this.placeModel.findOneAndUpdate({ 'wikidata.qid': qid }, update, opts);
    }
    throw e;
  }
}







 async findPlaceDetail ( PlaceName: string){
  console.log("the place name",PlaceName )


const getDetail = await this.placeModel.findOne({ title: PlaceName }).lean() as PlaceResponse;

console.log("the get detail is thisssssss",getDetail )

if(getDetail){


const filteredDetail = {
      id :  getDetail?._id,
      title: getDetail?.title,
      thumbnailImage: getDetail?.images?.local_thumbnail,
      originalImage: getDetail?.images?.local_original,
      description: getDetail?.description_long,
      countries: getDetail?.wikidata?.countries?.[0],
      administrativeAreas: getDetail?.wikidata?.administrativeAreas?.[0],
      ranges: getDetail?.wikidata?.ranges,
      instanceOf: getDetail?.wikidata?.instanceOf,
      architects: getDetail?.wikidata?.architects?.[0],
      coordinates: getDetail?.coordinates?.coordinates,
      height: getDetail?.wikidata?.height_m,
    };
    
return filteredDetail
    }



return null




 }




  async getScansSummary(scanIds: string[]) {
    try {
      const scans = await this.placeModel.find({
        _id: { $in: scanIds },
      }).lean();

      // Map to simplified result
      const result = scans.map(scan => ({
        id: scan._id,
        title: scan?.title ?? 'N/A',
        image: scan.images?.local_thumbnail ?? scan.images?.local_original,
        country: scan.wikidata?.countries?.[0] ?? 'Unknown',
        instanceOf: scan.wikidata?.instanceOf?.[0] ?? 'Unknown',
      }));

      return {
        status: 200,
        message: 'Fetched scan summaries successfully',
        scans: result,
      };
    } catch (error) {
      console.error('Error fetching scans summary:', error);
      return {
        status: 500,
        message: 'Error fetching scans summary',
        error: error.message,
      };
    }
  }


  async getScansDetails(scanId: string) {
  try {
    console.log("the scanId", scanId);

    const response = await this.placeModel.findOne({ _id: scanId }).lean() as PlaceResponse; // 👈 important

    if (!response) {
      return {
        status: 404,
        message: 'Scan not found',
      };
    }

    console.log("the thumb", response?.images?.local_thumbnail);

    const filterDocument = {
        id :  response?._id,
      title: response?.title,
      thumbnailImage: response?.images?.local_thumbnail,
      originalImage: response?.images?.local_original,
      description: response?.description_long,
      countries: response?.wikidata?.countries?.[0],
      administrativeAreas: response?.wikidata?.administrativeAreas?.[0],
      ranges: response?.wikidata?.ranges,
      instanceOf: response?.wikidata?.instanceOf,
      architects: response?.wikidata?.architects?.[0],
      coordinates: response?.coordinates?.coordinates,
      height: response?.wikidata?.height_m,
    };

    return {
      status: 200,
      message: 'Fetched scan details successfully',
      scanDetail: filterDocument,
    };
  } catch (err) {
    console.log("the error", err);
    return {
      status: 500,
      message: 'Error fetching scans details',
      error: err.message,
    };
  }
}





}





