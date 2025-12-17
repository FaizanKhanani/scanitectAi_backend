import { Injectable, BadRequestException, InternalServerErrorException  } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ImageAnnotatorClient, protos } from '@google-cloud/vision';
import { FilesService } from '../files/files.service';
import { Place, PlaceDocument } from './schemas/imageData.model'
import axios, { AxiosInstance } from 'axios';
import { HttpService } from '@nestjs/axios';
import fetch from 'node-fetch';
import OpenAI from 'openai';
import { IdentifyPlaceByNameDto } from './dto/identify-place-by-name.dto';
// import { PlaceInfo8Dto } from './dto/place-info-8.dto';
// import { placeInfo8JsonSchema } from './schemas/place-info-8.schema';
import { firstValueFrom } from 'rxjs';
import similarity from "string-similarity";

interface WikipediaResult {
  status: number;
  title?: string;
  message?: string;
  error?: string;
}

type GeoPoint = { type: 'Point'; coordinates: [number, number] };

  type WikiImage = {
    title: string;
    original: string;
    thumb?: string;
    width?: number;
    height?: number;
    mime?: string;
    mediatype?: string;
    sha1?: string;
  };




type LandmarkOut = {
  name: string;
  score: number | null; // The original score from the Vision API
  lat?: number;
  lon?: number;
  dist_m?: number | null; // Distance in meters from the user
  source: 'google_vision_landmark' | 'google_vision_web';
}

export type SuccessRecognition = {
  status: 'SUCCESS';
  data: LandmarkOut[];
};

export type FailureRecognition = {
  status: 'FAILURE';
  reason: 'OUT_OF_ZONE' | 'NOT_FOUND';
  message: string;
};

export type RecognitionResult = SuccessRecognition | FailureRecognition;

// This internal type is also unchanged.
type Candidate = LandmarkOut & { finalScore: number };

// interface PlaceResponse {
//   _id?: any;
//   title?: string;
//   images?: {
//     thumbnail?: string;
//     original?: string;
//     local_original?: string;
//     local_thumbnail?: string;
//   };
//   wikidata?: {
//     countries?: string[];
//     administrativeAreas?: string[];
//     instanceOf?: string[];
//     ranges?: string[];
//     architects?: string[];
//     height_m?: number;
//   };
//   description_long?: string,
//   coordinates?: {
//     type?: string;
//     coordinates?: number[];
//   };
// }


interface PlaceResponse {
_id?: any;
title?: string;
images?: {
thumbnail?: string;
original?: string;
local_original?: string;
local_thumbnail?: string;
gallery?: {
title?: string;
original?: string;
thumbnail?: string;
local_original?: string;
local_thumbnail?: string;
}[];
};
wikidata?: {
countries?: string[];
administrativeAreas?: string[];
instanceOf?: string[];
ranges?: string[];
architects?: string[];
height_m?: number;
};
description_long?: string;
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
gallery?: {
local_original?: string;
local_thumbnail?: string;
}[];
};
coordinates?: { type: 'Point'; coordinates: [number, number] };
wikidata?: { qid?: string };
};



// type PlaceLeanMinimal = {
// _id: any;
// title?: string;
// images?: {
// thumbnail?: string;
// original?: string;
// local_thumbnail?: string;
// local_original?: string;
// };
// coordinates?: { type: 'Point'; coordinates: [number, number] };
// wikidata?: { qid?: string };
// };

// type DetailData = {
//   title: string;
//   page_url?: string;
//   description_short?: string;
//   description_html?: string;
//   description_long?: string;
//   images?: { thumbnail?: string; original?: string };
//   coordinates?: { lat: number; lon: number } | null;
//   wikidata?: {
//     qid?: string;
//     instance_of?: string | string[];
//     countries?: string[];
//     administrative_areas?: string[];
//     ranges?: string[];
//     elevation_m?: number;
//     height_m?: number;
//     prominence_m?: number;
//     isolation_km?: number;
//     architects?: string[];
//     coordinates?: { lat: number; lon: number } | null;
//   };
// };


@Injectable()
export class VisionService {
  constructor(
    private readonly http: HttpService,
       private readonly filesService: FilesService,
    @InjectModel('Place') private readonly placeModel: Model<any>,
    // @InjectModel(Place.name) private readonly placeModel: Model<PlaceDocument>
  ) {}



 private visionClient = new ImageAnnotatorClient();
  private readonly EARTH_R = 6371000;

  private haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = (v: number) => (v * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * this.EARTH_R * Math.asin(Math.sqrt(a));
  }
  
  private scoreWithGeo(visionScore: number, dist_m?: number | null, tau = 800): number {
    if (dist_m == null) { return 0.9 * visionScore; }
    const geoPrior = Math.exp(-dist_m / tau);
    return 0.6 * visionScore + 0.4 * geoPrior;
  }

  private async landmarkDetect(imageBuffer: Buffer) {
    const [resp] = await this.visionClient.landmarkDetection(imageBuffer);
    return resp.landmarkAnnotations ?? [];
  }

  private async webDetect(imageBuffer: Buffer) {
    const [resp] = await this.visionClient.webDetection(imageBuffer);
    return resp.webDetection ?? {};
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  private async enrichWebEntity(entityName: string, userLat?: number, userLon?: number): Promise<{ lat?: number; lon?: number }> {
    try {
      const query = encodeURIComponent(entityName);
      let url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;
      if (userLat !== undefined && userLon !== undefined) {
        url += `&viewbox=${userLon-1},${userLat-1},${userLon+1},${userLat+1}&bounded=1`;
      }
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'User-Agent': 'MyLandmarkApp/1.0 (contact@myapp.com)' }, // <-- Remember to change this
      });
      if (!response.ok) return {};
      const places = await response.json() as any[];
      const place = places?.[0];
      if (place && place.lat && place.lon) {
        return { lat: parseFloat(place.lat), lon: parseFloat(place.lon) };
      }
    } catch (error) { console.error(`Nominatim enrichment failed for '${entityName}'`, error); }
    return {};
  }


  /**
   * The main recognition function, now returning a detailed RecognitionResult object.
   */
 public async recognize(
    imageBuffer: Buffer,
    opts: { 
      lat?: number; 
      lon?: number; 
      topK?: number; 
      confidenceThreshold?: number; 
      maxDistanceM?: number 
    } = {},
  ): Promise<RecognitionResult> {
    const topK = opts.topK ?? 3;
    const userLat = opts.lat;
    const userLon = opts.lon;
    const confidenceThreshold = opts.confidenceThreshold ?? 0.70;
    const maxDistanceM = opts.maxDistanceM ?? 10000;

    // 1. Gather all evidence
    const [landmarkAnns, webDetection] = await Promise.all([this.landmarkDetect(imageBuffer), this.webDetect(imageBuffer)]);
    const allCandidates: Candidate[] = [];

    // 2. Process and score all candidates
    for (const ann of landmarkAnns) {
      if (!ann.description) continue;
      const pLat = ann.locations?.[0]?.latLng?.latitude;
      const pLon = ann.locations?.[0]?.latLng?.longitude;
      const visionScore = Number(ann.score ?? 0);
      const dist = userLat != null && userLon != null && pLat != null && pLon != null ? this.haversine(userLat, userLon, pLat, pLon) : null;
      allCandidates.push({ name: ann.description, score: visionScore, lat: pLat, lon: pLon, dist_m: dist, source: 'google_vision_landmark', finalScore: this.scoreWithGeo(visionScore, dist) });
    }
    
    const webEntities = webDetection.webEntities ?? [];
    for (const entity of webEntities) {
      if (!entity.description || !entity.score || entity.score < 0.1) continue;
      const visionScore = Number(entity.score);
      const { lat: pLat, lon: pLon } = await this.enrichWebEntity(entity.description, userLat, userLon);
      const dist = userLat != null && userLon != null && pLat != null && pLon != null ? this.haversine(userLat, userLon, pLat, pLon) : null;
      allCandidates.push({ name: entity.description, score: visionScore, lat: pLat, lon: pLon, dist_m: dist, source: 'google_vision_web', finalScore: this.scoreWithGeo(visionScore, dist) });
      await this.delay(1100); 
    }

    // 3. Apply strict geographic filter
    let geographicallyValidCandidates: Candidate[];
    if (userLat != null && userLon != null) {
      geographicallyValidCandidates = allCandidates.filter(c => c.dist_m != null && c.dist_m <= maxDistanceM);

    console.log("All candidates:", allCandidates);


      if (allCandidates.length > 0 && geographicallyValidCandidates.length === 0) {
        // MODIFIED: Return a logical 'FAILURE' object, not an HTTP status.
        return {
          status: 'FAILURE',
          reason: 'OUT_OF_ZONE',
          message: 'You are out of zone. Please come in 1KM radius',
        };
      }
    } else {
      geographicallyValidCandidates = allCandidates;
    }

    // 4. Deduplicate, rank, and filter by confidence
    const finalCandidates = new Map<string, Candidate>();
    for (const candidate of geographicallyValidCandidates) {
      const key = candidate.name.trim().toLowerCase();
      const existing = finalCandidates.get(key);
      if (!existing || candidate.finalScore > existing.finalScore) {
        finalCandidates.set(key, candidate);
      }
    }

    const ranked = Array.from(finalCandidates.values())
      .sort((a, b) => b.finalScore - a.finalScore)
      .filter(c => c.finalScore >= confidenceThreshold);

    if (ranked.length === 0) {
      // MODIFIED: Return a logical 'FAILURE' object.
      return {
        status: 'FAILURE',
        reason: 'NOT_FOUND',
        message: 'No landmark recognized. Please try again from a different angle.'
      };
    }

    // 5. Return success
    // MODIFIED: Return a logical 'SUCCESS' object.
    return {
      status: 'SUCCESS',
      data: ranked.slice(0, topK).map(({ finalScore, ...result }) => result)
    };
  }


























//  private readonly WIKI_UA = 'ScanitectAI/1.0 (+https://scanitectai.com/api; mailto:dev@scanitectai.com)';
//   private readonly WIKI_HEADERS = {
//     'User-Agent': this.WIKI_UA,
//     'Accept': 'application/json'
//   };
//   private readonly MAX_CONCURRENCY = 5;

//   private readonly MIRROR_CONCURRENCY = Number(process.env.MIRROR_CONCURRENCY || 2);

//   private readonly COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
//   private readonly MIN_IMAGES = 6;

//   // Mirror config (environment-aware)
//   private readonly FILES_MIRROR_URL =
//     process.env.FILES_MIRROR_URL ||
//     (process.env.NODE_ENV === 'production'
//       ? 'https://scanitectai.com/api/files/mirror'
//       : 'http://localhost:4000/files/mirror');

//   private readonly FILES_AUTH_TOKEN = process.env.FILES_AUTH_TOKEN || '';

//   // Preferred languages to try for cross-language galleries
//   private readonly CROSS_LANG_PRIORITY = ['en', 'de', 'fr', 'es', 'it', 'ru', 'ja', 'zh', 'pt', 'pl', 'nl', 'ar', 'tr', 'hi'];

//   private readonly wiki: AxiosInstance = axios.create({
//     headers: this.WIKI_HEADERS,
//     timeout: 12000
//   });

//   private sleep(ms: number) {
//     return new Promise<void>(r => setTimeout(r, ms));
//   }

//   private async mapWithConcurrency<T, R>(
//     items: T[],
//     limit: number,
//     fn: (item: T, idx: number) => Promise<R>
//   ): Promise<R[]> {
//     const out: R[] = [];
//     for (let i = 0; i < items.length; i += limit) {
//       const slice = items.slice(i, i + limit);
//       const part = await Promise.all(slice.map((it, j) => fn(it, i + j)));
//       out.push(...part);
//       await this.sleep(100);
//     }
//     return out;
//   }

//   private readonly PREFERRED_TERMS = [
//     'statue','monument','landmark','building','tower','bridge','park','temple','cathedral',
//     'church','mosque','museum','palace','castle','fort','arch','dam','pagoda','stupa',
//     'shrine','island','mountain','volcano','waterfall','river','bay','lake','mausoleum','tomb'
//   ];

//   private readonly VANTAGE_TOKENS = [
//     'front', 'rear', 'back', 'side', 'north', 'south', 'east', 'west',
//     'northeast', 'northwest', 'southeast', 'southwest',
//     'interior', 'inside', 'entrance', 'gate', 'roof',
//     'aerial', 'drone', "bird's-eye",
//     'panorama', 'panoramic',
//     'detail', 'close', 'close-up',
//     'night', 'dawn', 'dusk', 'sunset', 'sunrise',
//     'winter', 'snow', 'summer', 'spring', 'autumn', 'rain', 'fog'
//   ];

//   // --- Image helpers ---

//   private async fetchPageGallery(pageTitle: string, lang = 'en', max = 50): Promise<WikiImage[]> {
//     const res = await this.wiki.get(`https://${lang}.wikipedia.org/w/api.php`, {
//       params: {
//         action: 'query',
//         generator: 'images',
//         titles: pageTitle,
//         gimlimit: Math.min(100, max),
//         prop: 'imageinfo',
//         iiprop: 'url|mime|mediatype|size|extmetadata|sha1',
//         iiurlwidth: 1024,
//         format: 'json',
//         origin: '*'
//       }
//     });

//     const pages = res.data?.query?.pages || {};
//     const out: WikiImage[] = [];

//     for (const p of Object.values<any>(pages)) {
//       const info = p?.imageinfo?.[0];
//       if (!info?.url) continue;
//       out.push({
//         title: p.title || '',
//         original: info.url,
//         thumb: info.thumburl || info.url,
//         width: info.width,
//         height: info.height,
//         mime: info.mime,
//         mediatype: info.mediatype,
//         sha1: info.sha1
//       });
//     }

//     return out;
//   }

//   private looksBadForBuilding(img: {
//     title?: string;
//     original?: string;
//     mime?: string;
//     mediatype?: string;
//     width?: number;
//     height?: number;
//   }) {
//     const t = (img.title || '').toLowerCase();
//     const url = (img.original || '').toLowerCase();

//     const badWords = [
//       'logo', 'icon', 'seal', 'coat of arms', 'coat_of_arms', 'flag',
//       'emblem', 'symbol', 'map', 'locator', 'diagram', 'badge', 'wordmark',
//       'pictogram', 'outline'
//     ];
//     if (badWords.some(w => t.includes(w) || url.includes(w))) return true;

//     if (img.mediatype && img.mediatype !== 'BITMAP') return true;
//     if (img.mime && img.mime.includes('svg')) return true;

//     const w = img.width || 0;
//     const h = img.height || 0;
//     if (w < 600 || h < 400) return true;

//     const ratio = w && h ? Math.max(w, h) / Math.min(w, h) : 1;
//     if (ratio > 3.5) return true;

//     return false;
//   }

//   // Looser filter if we need more images
//   private looksBadForBuildingLoose(img: {
//     title?: string;
//     original?: string;
//     mime?: string;
//     mediatype?: string;
//     width?: number;
//     height?: number;
//   }) {
//     const t = (img.title || '').toLowerCase();
//     const url = (img.original || '').toLowerCase();
//     const badWords = ['logo', 'icon', 'seal', 'coat of arms', 'coat_of_arms', 'flag', 'emblem', 'symbol', 'map', 'locator', 'diagram', 'badge', 'wordmark', 'pictogram', 'outline'];
//     if (badWords.some(w => t.includes(w) || url.includes(w))) return true;
//     if (img.mediatype && img.mediatype !== 'BITMAP') return true;
//     if (img.mime && img.mime.includes('svg')) return true;
//     const w = img.width || 0;
//     const h = img.height || 0;
//     if (w < 400 || h < 300) return true; // lower threshold
//     return false; // allow extreme ratios, etc.
//   }

//   private scoreForBuilding(img: { title?: string; width?: number; height?: number }, pageName: string) {
//     let score = 0;
//     const base = pageName.toLowerCase();

//     const title = (img.title || '').toLowerCase();
//     if (title.includes(base)) score += 10;
//     const w = img.width || 0;
//     const h = img.height || 0;
//     score += Math.min(30, Math.floor((w * h) / (1200 * 800)) * 2);
//     if (w >= h) score += 4;
//     return score;
//   }

//   private getVantageKeys(title?: string): string[] {
//     if (!title) return [];
//     const t = title.toLowerCase();
//     const found: string[] = [];
//     for (const k of this.VANTAGE_TOKENS) if (t.includes(k)) found.push(k);
//     return found.length ? found : ['generic'];
//   }

//   private dedupeImages(images: WikiImage[]): WikiImage[] {
//     const seenSha = new Set<string>();
//     const seenUrl = new Set<string>();
//     const out: WikiImage[] = [];
//     for (const img of images) {
//       const keySha = (img.sha1 || '').toLowerCase();
//       const keyUrl = (img.original || '').toLowerCase();
//       if (keySha && seenSha.has(keySha)) continue;
//       if (keyUrl && seenUrl.has(keyUrl)) continue;
//       if (keySha) seenSha.add(keySha);
//       if (keyUrl) seenUrl.add(keyUrl);
//       out.push(img);
//     }
//     return out;
//   }

//   private selectDiverseImages(
//     candidates: WikiImage[],
//     baseName: string,
//     min = this.MIN_IMAGES,
//     max = 12,
//     filter: (img: any) => boolean = (img) => !this.looksBadForBuilding(img)
//   ): WikiImage[] {
//     const good = candidates.filter(filter);
//     good.sort((a, b) => this.scoreForBuilding(b, baseName) - this.scoreForBuilding(a, baseName));

//     const usedVantage = new Set<string>();
//     const usedSha = new Set<string>();
//     const picked: WikiImage[] = [];

//     // Pass 1: maximize different vantage tokens
//     for (const img of good) {
//       if (picked.length >= max) break;
//       const sha = (img.sha1 || '').toLowerCase();
//       if (sha && usedSha.has(sha)) continue;
//       const keys = this.getVantageKeys(img.title);
//       const newKey = keys.find(k => !usedVantage.has(k));
//       if (newKey) {
//         picked.push(img);
//         if (sha) usedSha.add(sha);
//         usedVantage.add(newKey);
//       }
//     }

//     // Pass 2: fill up to min with remaining best
//     if (picked.length < min) {
//       for (const img of good) {
//         if (picked.length >= Math.max(min, Math.min(max, good.length))) break;
//         const sha = (img.sha1 || '').toLowerCase();
//         if (sha && usedSha.has(sha)) continue;
//         picked.push(img);
//         if (sha) usedSha.add(sha);
//       }
//     }

//     return picked.slice(0, Math.max(min, Math.min(max, picked.length)));
//   }

//   private async mirrorImageToLocal(remoteUrl: string, filename?: string): Promise<string | null> {
//     try {
//       const res = await axios.post(
//         this.FILES_MIRROR_URL,
//         { url: remoteUrl, filename },
//         {
//           headers: {
//             ...(this.FILES_AUTH_TOKEN ? { Authorization: this.FILES_AUTH_TOKEN } : {}),
//             'Content-Type': 'application/json'
//           },
//           timeout: 20000
//         }
//       );
//       const localUrl = res.data?.url || res.data?.data?.url;
//       return localUrl || null;
//     } catch {
//       return null;
//     }
//   }

//   // --- Wikipedia/Wikidata helpers ---

//   private async fetchWikiSummary(title: string, lang = 'en') {
//     const res = await this.wiki.get(
//       `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
//       { params: { redirect: true } }
//     );
//     return res.data;
//   }

//   private async searchBestTitles(query: string, lang = 'en', limit = 5): Promise<string[]> {
//     const res = await this.wiki.get(`https://${lang}.wikipedia.org/w/api.php`, {
//       params: {
//         action: 'query',
//         list: 'search',
//         srwhat: 'nearmatch',
//         srlimit: limit,
//         srsearch: query,
//         utf8: 1,
//         format: 'json',
//         origin: '*'
//       }
//     });
//     const hits = res.data?.query?.search || [];
//     return hits.map((h: any) => h.title);
//   }

//   private async searchByTitle(query: string, lang = 'en', limit = 10): Promise<string[]> {
//     const res = await this.wiki.get(`https://${lang}.wikipedia.org/w/api.php`, {
//       params: {
//         action: 'query',
//         list: 'search',
//         srsearch: `intitle:"${query}"`,
//         srlimit: limit,
//         srnamespace: 0,
//         format: 'json',
//         origin: '*'
//       }
//     });
//     const hits = res.data?.query?.search || [];
//     return hits.map((h: any) => h.title);
//   }

//   private async fetchDisambigLinks(title: string, lang = 'en', limit = 200): Promise<string[]> {
//     const out: string[] = [];
//     let plcontinue: string | undefined = undefined;

//     do {
//       const res = await this.wiki.get(`https://${lang}.wikipedia.org/w/api.php`, {
//         params: {
//           action: 'query',
//           prop: 'links',
//           plnamespace: 0,
//           pllimit: Math.min(500, limit),
//           titles: title,
//           format: 'json',
//           origin: '*',
//           ...(plcontinue ? { plcontinue } : {})
//         }
//       });
//       const pages = res.data?.query?.pages || {};
//       const firstKey = Object.keys(pages)[0];
//       const links = firstKey ? (pages[firstKey]?.links || []) : [];
//       out.push(...links.map((l: any) => l.title));
//       plcontinue = res.data?.continue?.plcontinue;
//     } while (plcontinue && out.length < limit);

//     return Array.from(new Set(out)).slice(0, limit);
//   }

//   private parenTerm(title: string): string | null {
//     const m = title.match(/\(([^)]+)\)\s*$/);
//     return m ? m[1].toLowerCase() : null;
//   }

//   private containsPreferred(text?: string, terms = this.PREFERRED_TERMS) {
//     if (!text) return false;
//     const lc = text.toLowerCase();
//     return terms.some(t => lc.includes(t));
//   }

//   private pickBestCandidate(name: string, summaries: any[], terms = this.PREFERRED_TERMS): any | null {
//     if (!summaries.length) return null;
//     const base = name.toLowerCase();

//     const scored = summaries
//       .filter(s => s && s.type !== 'disambiguation')
//       .map(s => {
//         let score = 0;
//         const title = s.title || '';
//         const lcTitle = title.toLowerCase();
//         const p = this.parenTerm(title);

//         if (lcTitle.startsWith(base + ' (')) score += 5;
//         if (p && terms.includes(p)) score += 10;
//         if (this.containsPreferred(s.description, terms)) score += 4;
//         if (s.originalimage?.source) score += 1;
//         return { s, score };
//       })
//       .sort((a, b) => b.score - a.score);

//     return scored[0]?.s || null;
//   }

//   private async resolveWikipedia(name: string, lang = 'en'): Promise<{ title: string; summary: any } | null> {
//     let first: any = null;
//     try {
//       first = await this.fetchWikiSummary(name, lang);
//       if (first && first.type !== 'disambiguation') {
//         return { title: first.title, summary: first };
//       }
//     } catch (e: any) {
//       const code = e?.response?.status;
//       if (code === 404 || code === 403 || code === 429) {
//         // continue
//       } else {
//         throw e;
//       }
//     }

//     const titleSet = new Set<string>();
//     try {
//       const t1 = await this.searchByTitle(name, lang, 10);
//       t1.forEach(t => titleSet.add(t));
//     } catch {}
//     try {
//       const t2 = await this.searchBestTitles(name, lang, 10);
//       t2.forEach(t => titleSet.add(t));
//     } catch {}

//     const allCandidates = Array.from(titleSet);
//     const prioritized = [
//       ...allCandidates.filter(t => t.toLowerCase().startsWith(name.toLowerCase() + ' (')),
//       ...allCandidates
//     ].slice(0, 20);

//     const summariesRaw = await this.mapWithConcurrency(
//       prioritized,
//       this.MAX_CONCURRENCY,
//       t => this.fetchWikiSummary(t, lang).catch(() => null)
//     );
//     const summaries = summariesRaw.filter(Boolean) as any[];

//     const pick = this.pickBestCandidate(name, summaries);
//     if (pick) return { title: pick.title, summary: pick };

//     if (first && first.type === 'disambiguation') {
//       const links = await this.fetchDisambigLinks(first.title, lang, 200);
//       const prioritizedLinks = [
//         ...links.filter(t => t.toLowerCase().startsWith(name.toLowerCase() + ' (')),
//         ...links
//       ].slice(0, 30);

//       const linkSummariesRaw = await this.mapWithConcurrency(
//         prioritizedLinks,
//         this.MAX_CONCURRENCY,
//         t => this.fetchWikiSummary(t, lang).catch(() => null)
//       );
//       const linkSummaries = linkSummariesRaw.filter(Boolean) as any[];

//       const pick2 = this.pickBestCandidate(name, linkSummaries);
//       if (pick2) return { title: pick2.title, summary: pick2 };
//     }

//     if (first) return { title: first.title, summary: first };
//     return null;
//   }

//   private async fetchWikidataViaAPI(qid: string) {
//     try {
//       const entityRes = await this.wiki.get(
//         `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`
//       );
//       const entity = entityRes.data?.entities?.[qid];
//       const claims = entity?.claims || {};

//       const getQuantity = (pid: string): number | undefined => {
//         const arr = claims[pid];
//         if (!arr) return;
//         for (const st of arr) {
//           const val = st?.mainsnak?.datavalue?.value;
//           if (val && typeof val.amount === 'string') {
//             const num = Number(val.amount);
//             if (Number.isFinite(num)) return num;
//           }
//         }
//         return undefined;
//       };

//       const getFirstCoord = () => {
//         const arr = claims['P625'];
//         if (!arr) return null;
//         for (const st of arr) {
//           const v = st?.mainsnak?.datavalue?.value;
//           if (v && typeof v.latitude === 'number' && typeof v.longitude === 'number') {
//             return { lat: v.latitude, lon: v.longitude };
//           }
//         }
//         return null;
//       };

//       const getEntityIds = (pid: string): string[] => {
//         const out: string[] = [];
//         const arr = claims[pid];
//         if (!arr) return out;
//         for (const st of arr) {
//           const id = st?.mainsnak?.datavalue?.value?.id;
//           if (id) out.push(id);
//         }
//         return out;
//       };

//       const countryIds = getEntityIds('P17');
//       const adminIds = getEntityIds('P131');
//       const rangeIds = [...getEntityIds('P706'), ...getEntityIds('P4552')];
//       const architectIds = getEntityIds('P84');
//       const instanceIds = getEntityIds('P31');

//       let labels: Record<string, string> = {};
//       const ids = Array.from(new Set<string>([
//         ...countryIds, ...adminIds, ...rangeIds, ...architectIds, ...instanceIds
//       ]));
//       if (ids.length) {
//         const labelsRes = await this.wiki.get('https://www.wikidata.org/w/api.php', {
//           params: {
//             action: 'wbgetentities',
//             ids: ids.join('|'),
//             props: 'labels',
//             languages: 'en',
//             format: 'json',
//             origin: '*'
//           }
//         });
//         const ents = labelsRes.data?.entities || {};
//         for (const [id, obj] of Object.entries<any>(ents)) {
//           const label = (obj as any)?.labels?.en?.value;
//           if (label) labels[id] = label;
//         }
//       }
//       const mapLabels = (arr: string[]) => arr.map(id => labels[id]).filter(Boolean);

//       return {
//         countries: mapLabels(countryIds),
//         administrative_areas: mapLabels(adminIds),
//         ranges: mapLabels(rangeIds),
//         architects: mapLabels(architectIds),
//         instance_of: mapLabels(instanceIds).join(', '),
//         elevation_m: getQuantity('P2044'),
//         height_m: getQuantity('P2048'),
//         prominence_m: getQuantity('P2660'),
//         isolation_km: getQuantity('P3108'),
//         coordinates: getFirstCoord()
//       };
//     } catch (e) {
//       console.warn('Wikidata API fallback failed:', (e as any)?.message || e);
//       return null;
//     }
//   }

//   // --- Commons helpers ---

//   private async fetchCommonsLinksFromWikidata(qid: string): Promise<{ categories: string[]; galleries: string[] }> {
//     try {
//       const res = await this.wiki.get('https://www.wikidata.org/w/api.php', {
//         params: {
//           action: 'wbgetentities',
//           ids: qid,
//           props: 'sitelinks|claims',
//           format: 'json',
//           origin: '*'
//         }
//       });

//       const ent = res.data?.entities?.[qid];
//       const cats = new Set<string>();
//       const galls = new Set<string>();

//       const sitelinkCommons = ent?.sitelinks?.commonswiki?.title as string | undefined;
//       if (sitelinkCommons) {
//         if (sitelinkCommons.startsWith('Category:')) cats.add(sitelinkCommons);
//         else galls.add(sitelinkCommons);
//       }

//       // P373: Commons category
//       const p373 = ent?.claims?.P373;
//       if (p373) {
//         for (const st of p373) {
//           const v = st?.mainsnak?.datavalue?.value;
//           if (typeof v === 'string' && v.trim()) cats.add(`Category:${v}`);
//         }
//       }

//       // P935: Commons gallery
//       const p935 = ent?.claims?.P935;
//       if (p935) {
//         for (const st of p935) {
//           const v = st?.mainsnak?.datavalue?.value;
//           if (typeof v === 'string' && v.trim()) galls.add(v);
//         }
//       }

//       return { categories: Array.from(cats), galleries: Array.from(galls) };
//     } catch {
//       return { categories: [], galleries: [] };
//     }
//   }

//   // Paginated category fetch (more robust)
//   private async fetchCommonsCategoryImagesPaginated(categoryTitle: string, maxFiles = 400): Promise<WikiImage[]> {
//     let gcmcontinue: string | undefined = undefined;
//     const out: WikiImage[] = [];

//     do {
//       const res = await this.wiki.get(this.COMMONS_API, {
//         params: {
//           action: 'query',
//           generator: 'categorymembers',
//           gcmtitle: categoryTitle,
//           gcmtype: 'file',
//           gcmnamespace: 6,
//           gcmlimit: 200,
//           prop: 'imageinfo',
//           iiprop: 'url|mime|mediatype|size|extmetadata|sha1',
//           iiurlwidth: 1024,
//           format: 'json',
//           origin: '*',
//           ...(gcmcontinue ? { gcmcontinue } : {})
//         }
//       });

//       const pages = res.data?.query?.pages || {};
//       for (const p of Object.values<any>(pages)) {
//         const info = p?.imageinfo?.[0];
//         if (!info?.url) continue;
//         out.push({
//           title: p.title || '',
//           original: info.url,
//           thumb: info.thumburl || info.url,
//           width: info.width,
//           height: info.height,
//           mime: info.mime,
//           mediatype: info.mediatype,
//           sha1: info.sha1
//         });
//       }

//       gcmcontinue = res.data?.continue?.gcmcontinue;
//       if (out.length >= maxFiles) break;
//       await this.sleep(120);
//     } while (gcmcontinue);

//     return out.slice(0, maxFiles);
//   }

//   private async fetchCommonsCategoryImages(categoryTitle: string, max = 120): Promise<WikiImage[]> {
//     const res = await this.wiki.get(this.COMMONS_API, {
//       params: {
//         action: 'query',
//         generator: 'categorymembers',
//         gcmtitle: categoryTitle,
//         gcmtype: 'file',
//         gcmnamespace: 6,
//         gcmlimit: Math.min(200, max),
//         prop: 'imageinfo',
//         iiprop: 'url|mime|mediatype|size|extmetadata|sha1',
//         iiurlwidth: 1024,
//         format: 'json',
//         origin: '*'
//       }
//     });

//     const pages = res.data?.query?.pages || {};
//     const out: WikiImage[] = [];
//     for (const p of Object.values<any>(pages)) {
//       const info = p?.imageinfo?.[0];
//       if (!info?.url) continue;
//       out.push({
//         title: p.title || '',
//         original: info.url,
//         thumb: info.thumburl || info.url,
//         width: info.width,
//         height: info.height,
//         mime: info.mime,
//         mediatype: info.mediatype,
//         sha1: info.sha1
//       });
//     }
//     return out;
//   }

//   private async fetchCommonsGalleryImages(galleryTitle: string, max = 120): Promise<WikiImage[]> {
//     const res = await this.wiki.get(this.COMMONS_API, {
//       params: {
//         action: 'query',
//         generator: 'images',
//         titles: galleryTitle,
//         gimlimit: Math.min(500, max),
//         prop: 'imageinfo',
//         iiprop: 'url|mime|mediatype|size|extmetadata|sha1',
//         iiurlwidth: 1024,
//         format: 'json',
//         origin: '*'
//       }
//     });

//     const pages = res.data?.query?.pages || {};
//     const out: WikiImage[] = [];
//     for (const p of Object.values<any>(pages)) {
//       const info = p?.imageinfo?.[0];
//       if (!info?.url) continue;
//       out.push({
//         title: p.title || '',
//         original: info.url,
//         thumb: info.thumburl || info.url,
//         width: info.width,
//         height: info.height,
//         mime: info.mime,
//         mediatype: info.mediatype,
//         sha1: info.sha1
//       });
//     }
//     return out;
//   }

//   private async fetchCommonsSubcategories(categoryTitle: string, limit = 10): Promise<string[]> {
//     const res = await this.wiki.get(this.COMMONS_API, {
//       params: {
//         action: 'query',
//         list: 'categorymembers',
//         cmtitle: categoryTitle,
//         cmtype: 'subcat',
//         cmnamespace: 14,
//         cmlimit: Math.min(50, limit),
//         format: 'json',
//         origin: '*'
//       }
//     });
//     const members = res.data?.query?.categorymembers || [];
//     return members.map((m: any) => m.title).slice(0, limit);
//   }

//   private async fetchCommonsCategoryImagesDeep(categoryTitle: string, maxFiles = 200, subcats = 5): Promise<WikiImage[]> {
//     const rootFiles = await this.fetchCommonsCategoryImagesPaginated(categoryTitle, Math.min(400, maxFiles)).catch(() => []);
//     const subcatTitles = await this.fetchCommonsSubcategories(categoryTitle, subcats).catch(() => []);
//     const subFilesChunks = await this.mapWithConcurrency(
//       subcatTitles,
//       this.MAX_CONCURRENCY,
//       (c) => this.fetchCommonsCategoryImagesPaginated(c, Math.floor(maxFiles / Math.max(1, subcats))).catch(() => [])
//     );
//     const all: WikiImage[] = [...rootFiles];
//     for (const arr of subFilesChunks) all.push(...arr);
//     return all;
//   }

//   private async fetchCommonsSearchImages(query: string, max = 120): Promise<WikiImage[]> {
//     const res = await this.wiki.get(this.COMMONS_API, {
//       params: {
//         action: 'query',
//         generator: 'search',
//         gsrsearch: `intitle:"${query}"`,
//         gsrnamespace: 6, // File:
//         gsrlimit: Math.min(200, max),
//         prop: 'imageinfo',
//         iiprop: 'url|mime|mediatype|size|extmetadata|sha1',
//         iiurlwidth: 1024,
//         format: 'json',
//         origin: '*'
//       }
//     });
//     const pages = res.data?.query?.pages || {};
//     const out: WikiImage[] = [];
//     for (const p of Object.values<any>(pages)) {
//       const info = p?.imageinfo?.[0];
//       if (!info?.url) continue;
//       out.push({
//         title: p.title || '',
//         original: info.url,
//         thumb: info.thumburl || info.url,
//         width: info.width,
//         height: info.height,
//         mime: info.mime,
//         mediatype: info.mediatype,
//         sha1: info.sha1
//       });
//     }
//     return out;
//   }

//   private async fetchWikiSitelinks(qid: string): Promise<Record<string, string>> {
//     const res = await this.wiki.get('https://www.wikidata.org/w/api.php', {
//       params: {
//         action: 'wbgetentities',
//         ids: qid,
//         props: 'sitelinks',
//         format: 'json',
//         origin: '*'
//       }
//     });
//     const ent = res.data?.entities?.[qid];
//     const sitelinks = ent?.sitelinks || {};
//     const out: Record<string, string> = {};
//     for (const [site, obj] of Object.entries<any>(sitelinks)) {
//       if (!site.endsWith('wiki')) continue;
//       if (site === 'commonswiki') continue;
//       const lang = site.replace('wiki', '');
//       out[lang] = obj.title;
//     }
//     return out;
//   }

//   private async fetchCrossLangGalleries(qid: string, preferredFirst = this.CROSS_LANG_PRIORITY, maxLangs = 6): Promise<WikiImage[]> {
//     const out: WikiImage[] = [];
//     try {
//       const links = await this.fetchWikiSitelinks(qid);
//       // Select languages to fetch
//       const available = Object.keys(links);
//       const ordered: string[] = [];
//       for (const l of preferredFirst) if (available.includes(l)) ordered.push(l);
//       // Add any remaining languages if needed
//       for (const l of available) if (!ordered.includes(l)) ordered.push(l);
//       const pickLangs = ordered.slice(0, maxLangs);

//       const chunks = await this.mapWithConcurrency(
//         pickLangs,
//         this.MAX_CONCURRENCY,
//         (l) => this.fetchPageGallery(links[l], l, 80).catch(() => [])
//       );
//       for (const arr of chunks) out.push(...arr);
//     } catch {}
//     return out;
//   }

//   // --- main ---

//   async getDetail(
//     PlaceName: string,
//     opts: { longDescriptionChars?: number; lang?: string } = {}
//   ) {
//     const { longDescriptionChars = 1500, lang = 'en' } = opts;

//     const parseWikidataPoint = (wkt?: string) => {
//       if (!wkt) return null;
//       const m = wkt.match(/Point\(([-\d.]+)\s+([-\d.]+)\)/);
//       return m ? { lat: Number(m[2]), lon: Number(m[1]) } : null;
//     };
//     const toNumber = (v?: string) => {
//       if (v == null) return undefined;
//       const n = Number(v);
//       return Number.isFinite(n) ? n : undefined;
//     };

//     try {
//       // Resolve canonical Wikipedia title first
//       const resolved = await this.resolveWikipedia(PlaceName, lang);
//       if (!resolved) {
//         return { status: 404, statusMessage: 'not_found', data: `No "${PlaceName}" data is found on Wikipedia` };
//       }
//       const resolvedTitle = resolved.title;
//       const wikiData = resolved.summary;

//       // Longer description
//       let longDescription = '';
//       try {
//         const extractRes = await this.wiki.get(`https://${lang}.wikipedia.org/w/api.php`, {
//           params: {
//             action: 'query',
//             prop: 'extracts',
//             explaintext: 1,
//             exchars: longDescriptionChars,
//             redirects: 1,
//             titles: resolvedTitle,
//             format: 'json',
//             origin: '*'
//           }
//         });
//         const pages = extractRes.data?.query?.pages;
//         const firstKey = pages ? Object.keys(pages)[0] : undefined;
//         longDescription = firstKey ? pages[firstKey]?.extract || '' : '';
//       } catch (e: any) {
//         console.warn('Extended description fetch failed:', e?.message || e);
//       }

//       // Wikidata enrichment
//       let wd = {
//         qid: wikiData.wikibase_item || '',
//         instance_of: '',
//         countries: [] as string[],
//         administrative_areas: [] as string[],
//         ranges: [] as string[],
//         elevation_m: undefined as number | undefined,
//         height_m: undefined as number | undefined,
//         prominence_m: undefined as number | undefined,
//         isolation_km: undefined as number | undefined,
//         architects: [] as string[],
//         coordinates: null as null | { lat: number; lon: number }
//       };

//       if (wikiData.wikibase_item) {
//         const qid = wikiData.wikibase_item;
//         const sparqlQuery = `
//           SELECT DISTINCT
//             ?coord ?elev ?height ?prom ?iso
//             ?countryLabel ?adminLabel ?range1Label ?range2Label
//             ?instanceLabel ?architectLabel
//           WHERE {
//             VALUES ?item { wd:${qid} }

//             OPTIONAL { ?item wdt:P625  ?coord. }
//             OPTIONAL { ?item wdt:P2044 ?elev. }
//             OPTIONAL { ?item wdt:P2048 ?height. }
//             OPTIONAL { ?item wdt:P2660 ?prom. }
//             OPTIONAL { ?item wdt:P3108 ?iso. }

//             OPTIONAL { ?item wdt:P17   ?country. }
//             OPTIONAL { ?item wdt:P131  ?admin. }

//             OPTIONAL { ?item wdt:P706  ?range1. }
//             OPTIONAL { ?item wdt:P4552 ?range2. }

//             OPTIONAL { ?item wdt:P31   ?instance. }
//             OPTIONAL { ?item wdt:P84   ?architect. }

//             SERVICE wikibase:label { bd:serviceParam wikibase:language "${lang}". }
//           }
//           LIMIT 100
//         `;

//         let sparqlWorked = false;

//         try {
//           const sparqlResponse = await axios.get('https://query.wikidata.org/sparql', {
//             headers: {
//               Accept: 'application/sparql-results+json',
//               'User-Agent': this.WIKI_UA
//             },
//             params: { query: sparqlQuery },
//             timeout: 12000
//           });

//           const rows = sparqlResponse.data?.results?.bindings ?? [];

//           const countriesSet = new Set<string>();
//           const adminsSet = new Set<string>();
//           const rangesSet = new Set<string>();
//           const instancesSet = new Set<string>();
//           const architectsSet = new Set<string>();

//           let coord: { lat: number; lon: number } | null = null;
//           let elevation_m: number | undefined;
//           let height_m: number | undefined;
//           let prominence_m: number | undefined;
//           let isolation_km: number | undefined;

//           for (const b of rows) {
//             if (b.countryLabel?.value) countriesSet.add(b.countryLabel.value);
//             if (b.adminLabel?.value) adminsSet.add(b.adminLabel.value);
//             if (b.range1Label?.value) rangesSet.add(b.range1Label.value);
//             if (b.range2Label?.value) rangesSet.add(b.range2Label.value);
//             if (b.instanceLabel?.value) instancesSet.add(b.instanceLabel.value);
//             if (b.architectLabel?.value) architectsSet.add(b.architectLabel.value);

//             if (!coord && b.coord?.value) coord = parseWikidataPoint(b.coord.value);
//             if (elevation_m === undefined && b.elev?.value) elevation_m = toNumber(b.elev.value);
//             if (height_m === undefined && b.height?.value) height_m = toNumber(b.height.value);
//             if (prominence_m === undefined && b.prom?.value) prominence_m = toNumber(b.prom.value);
//             if (isolation_km === undefined && b.iso?.value) isolation_km = toNumber(b.iso.value);
//           }

//           wd = {
//             qid,
//             instance_of: Array.from(instancesSet).join(', '),
//             countries: Array.from(countriesSet),
//             administrative_areas: Array.from(adminsSet),
//             ranges: Array.from(rangesSet),
//             elevation_m,
//             height_m,
//             prominence_m,
//             isolation_km,
//             architects: Array.from(architectsSet),
//             coordinates: coord
//           };

//           sparqlWorked = true;
//         } catch (sparqlErr: any) {
//           console.warn('Wikidata SPARQL failed:', sparqlErr?.message || sparqlErr);
//         }

//         if (!sparqlWorked || (!wd.countries.length && !wd.administrative_areas.length && !wd.height_m && !wd.elevation_m)) {
//           const apiFallback = await this.fetchWikidataViaAPI(qid);
//           if (apiFallback) {
//             wd = {
//               qid,
//               instance_of: apiFallback.instance_of || wd.instance_of,
//               countries: apiFallback.countries?.length ? apiFallback.countries : wd.countries,
//               administrative_areas: apiFallback.administrative_areas?.length ? apiFallback.administrative_areas : wd.administrative_areas,
//               ranges: apiFallback.ranges?.length ? apiFallback.ranges : wd.ranges,
//               elevation_m: apiFallback.elevation_m ?? wd.elevation_m,
//               height_m: apiFallback.height_m ?? wd.height_m,
//               prominence_m: apiFallback.prominence_m ?? wd.prominence_m,
//               isolation_km: apiFallback.isolation_km ?? wd.isolation_km,
//               architects: apiFallback.architects?.length ? apiFallback.architects : wd.architects,
//               coordinates: apiFallback.coordinates ?? wd.coordinates
//             };
//           }
//         }
//       }

//       const coords =
//         wd.coordinates ||
//         (wikiData.coordinates ? { lat: wikiData.coordinates.lat, lon: wikiData.coordinates.lon } : null);

//       const baseName = wikiData.title || resolvedTitle;

//       // Build candidates: same-lang page gallery
//       const sameLangGallery = await this.fetchPageGallery(resolvedTitle, lang, 100);

//       // Cross-language galleries (from other Wikipedia language pages)
//       let crossLang: WikiImage[] = [];
//       if (wikiData.wikibase_item) {
//         crossLang = await this.fetchCrossLangGalleries(wd.qid || wikiData.wikibase_item).catch(() => []);
//       }

//       // Commons images (category + subcategories + gallery)
//       let commonsImages: WikiImage[] = [];
//       if (wikiData.wikibase_item) {
//         const commonsLinks = await this.fetchCommonsLinksFromWikidata(wd.qid || wikiData.wikibase_item);

//         // Category root + subcats (paginated)
//         const catDeepChunks = await this.mapWithConcurrency(
//           commonsLinks.categories.slice(0, 2),
//           this.MAX_CONCURRENCY,
//           (c) => this.fetchCommonsCategoryImagesDeep(c, 200, 5).catch(() => [])
//         );
//         for (const arr of catDeepChunks) commonsImages.push(...arr);

//         // Galleries
//         const galImgsChunks = await this.mapWithConcurrency(
//           commonsLinks.galleries.slice(0, 2),
//           this.MAX_CONCURRENCY,
//           (g) => this.fetchCommonsGalleryImages(g, 200).catch(() => [])
//         );
//         for (const arr of galImgsChunks) commonsImages.push(...arr);
//       }

//       // Merge + dedupe initial pool
//       let allCandidates: WikiImage[] = [...sameLangGallery, ...crossLang, ...commonsImages];
//       allCandidates = this.dedupeImages(allCandidates);

//       // If still likely low, search Commons by title as a fallback
//       if (allCandidates.length < this.MIN_IMAGES) {
//         const searchImgs = await this.fetchCommonsSearchImages(baseName, 200).catch(() => []);
//         allCandidates = this.dedupeImages([...allCandidates, ...searchImgs]);
//       }

//       // Select diverse set with fallback to looser filter if needed
//       let diverse = this.selectDiverseImages(allCandidates, baseName, this.MIN_IMAGES, 16);
//       if (diverse.length < this.MIN_IMAGES) {
//         const loosePick = this.selectDiverseImages(allCandidates, baseName, this.MIN_IMAGES, 16, (img) => !this.looksBadForBuildingLoose(img));
//         if (loosePick.length > diverse.length) diverse = loosePick;
//       }

//       // Final fill to ensure we reach MIN_IMAGES if still short
//       if (diverse.length < this.MIN_IMAGES) {
//         const seen = new Set<string>(diverse.map(i => ((i.sha1 || i.original) || '').toLowerCase()));
//         for (const img of allCandidates) {
//           const key = ((img.sha1 || img.original) || '').toLowerCase();
//           if (!seen.has(key)) {
//             diverse.push(img);
//             seen.add(key);
//           }
//           if (diverse.length >= this.MIN_IMAGES) break;
//         }
//       }

//       // Lead image: prefer summary lead if good
//       const summaryLead = wikiData?.originalimage?.source
//         ? {
//             title: `File:${baseName}.jpg`,
//             original: wikiData.originalimage.source,
//             thumb: wikiData.thumbnail?.source || wikiData.originalimage.source,
//             width: undefined,
//             height: undefined,
//             mime: undefined,
//             mediatype: 'BITMAP',
//             sha1: undefined
//           } as WikiImage
//         : null;

//       const lead = summaryLead && !this.looksBadForBuilding(summaryLead)
//         ? summaryLead
//         : (diverse[0] || summaryLead || null);

//       // Mirror lead + at least 6 diverse images
//       let localLeadOriginal: string | null = null;
//       let localLeadThumb: string | null = null;
//       if (lead?.original) localLeadOriginal = await this.mirrorImageToLocal(lead.original);
//       if (lead?.thumb) localLeadThumb = await this.mirrorImageToLocal(lead.thumb || lead.original);

//       const toMirror = diverse.slice(0, Math.max(this.MIN_IMAGES, Math.min(12, diverse.length)));

//       // Lower concurrency for mirroring + fallback to remote if mirror fails
//       const galleryWithLocal = await this.mapWithConcurrency(
//         toMirror,
//         this.MIRROR_CONCURRENCY,
//         async (img) => {
//           const localOriginal = await this.mirrorImageToLocal(img.original);
//           const localThumb = img.thumb ? await this.mirrorImageToLocal(img.thumb) : null;
//           return {
//             title: img.title,
//             original: img.original,
//             thumbnail: img.thumb || img.original,

//             // snake_case
//             local_original: localOriginal || img.original,
//             local_thumbnail: localThumb || img.thumb || img.original,

//             // camelCase (matches your schema)
//             localOriginal: localOriginal || img.original,
//             localThumbnail: localThumb || img.thumb || img.original
//           };
//         }
//       );

//       const data = {
//         title: wikiData.title || resolvedTitle,
//         description_short: wikiData.extract || '',
//         description_html: wikiData.extract_html || '',
//         description_long: longDescription,
//         page_url: wikiData.content_urls?.desktop?.page || '',
//         images: {
//           thumbnail: lead?.thumb || wikiData.thumbnail?.source || '',
//           original: lead?.original || wikiData.originalimage?.source || '',

//           // snake_case
//           local_thumbnail: localLeadThumb || lead?.thumb || wikiData.thumbnail?.source || '',
//           local_original: localLeadOriginal || lead?.original || wikiData.originalimage?.source || '',

//           // camelCase (matches your schema)
//           localThumbnail: localLeadThumb || lead?.thumb || wikiData.thumbnail?.source || '',
//           localOriginal: localLeadOriginal || lead?.original || wikiData.originalimage?.source || '',

//           gallery: Array.isArray(galleryWithLocal) ? galleryWithLocal : []
//         },
//         coordinates: coords,
//         wikidata: wd
//       };

//       return { status: 200, statusMessage: 'success', data };
//     } catch (err: any) {
//       console.warn('Wikipedia lookup failed:', err?.message || err);
//       return { status: err?.response?.status || 500, statusMessage: 'error', data: 'Error fetching data' };
//     }
//   }









//   private buildFileUrl(fileId: string) {
//     const base = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
//     return `${base}/files/${fileId}`;
//   }

//   private extFromMime(m: string) {
//     const mm = (m || '').toLowerCase();
//     if (mm.includes('png')) return 'png';
//     if (mm.includes('webp')) return 'webp';
//     if (mm.includes('gif')) return 'gif';
//     if (mm.includes('heic') || mm.includes('heif')) return 'heic';
//     if (mm.includes('bmp')) return 'bmp';
//     if (mm.includes('svg')) return 'svg';
//     if (mm.includes('jpeg') || mm.includes('jpg')) return 'jpg';
//     return 'bin';
//   }

//   private extFromUrl(u?: string) {
//     if (!u) return undefined;
//     try {
//       const pathname = new URL(u).pathname;
//       const m = pathname.match(/\.([a-z0-9]+)(?:\?|#|$)/i);
//       return m?.[1]?.toLowerCase();
//     } catch {
//       return undefined;
//     }
//   }

//   private sanitizeFilename(input: string) {
//     return (input || 'image')
//       .toLowerCase()
//       .replace(/[^a-z0-9]+/g, '-')
//       .replace(/(^-|-$)/g, '')
//       .slice(0, 70);
//   }

//   private isHttpUrl(s?: string) {
//     if (!s) return false;
//     return /^https?:\/\/\S+/i.test(s);
//   }

//   private pickHttpUrl(v: any): string | undefined {
//   if (!v) return undefined;
//   if (typeof v === 'string' && this.isHttpUrl(v)) return v;
//   const candidate = v.source || v.url || v.href;
//   return (typeof candidate === 'string' && this.isHttpUrl(candidate)) ? candidate : undefined;
// }


//   // private extractImageUrl(detail: any): string | undefined {
//   //   if (!detail) return undefined;

//   //   // Common Wikipedia shapes:
//   //   // - detail.image
//   //   // - detail.thumbnail?.source
//   //   // - detail.originalimage?.source
//   //   // - detail.images?.[0]?.source or .url
//   //   if (typeof detail.image === 'string' && this.isHttpUrl(detail.image)) return detail.image;
//   //   if (this.isHttpUrl(detail?.thumbnail?.source)) return detail.thumbnail.source;
//   //   if (this.isHttpUrl(detail?.originalimage?.source)) return detail.originalimage.source;

//   //   if (Array.isArray(detail.images)) {
//   //     for (const i of detail.images) {
//   //       const u = i?.source || i?.url;
//   //       if (this.isHttpUrl(u)) return u;
//   //     }
//   //   }

//   //   return undefined;
//   // }


//   private extractImageUrl(detail: any): string | undefined {
//   if (!detail) return undefined;

//   // Also handle { image: { source|url } }
//   if (this.isHttpUrl(detail?.image?.source)) return detail.image.source;
//   if (this.isHttpUrl(detail?.image?.url)) return detail.image.url;

//   // Common Wikipedia shapes:
//   if (typeof detail.image === 'string' && this.isHttpUrl(detail.image)) return detail.image;
//   if (this.isHttpUrl(detail?.thumbnail?.source)) return detail.thumbnail.source;
//   if (this.isHttpUrl(detail?.originalimage?.source)) return detail.originalimage.source;

//   if (Array.isArray(detail.images)) {
//     for (const i of detail.images) {
//       const u = i?.source || i?.url;
//       if (this.isHttpUrl(u)) return u;
//     }
//   }

//   return undefined;
// }



// //   private async downloadAndStoreImage(imageUrl: string, placeId?: string, placeName?: string) {
// //   const allowedMimes = new Set([
// //     'image/png',
// //     'image/jpeg',
// //     'image/webp',
// //     'image/gif',
// //     'image/heic',
// //     'image/heif',
// //     'image/svg+xml',
// //     'image/bmp',
// //   ]);

// //   const resp = await axios.get(imageUrl, {
// //     responseType: 'stream',
// //     timeout: 20000,
// //     maxBodyLength: Infinity,     // remove stream size limit
// //     maxContentLength: Infinity,  // extra safety for axios versions
// //     validateStatus: (s) => s >= 200 && s < 400,
// //   });

// //   const mimeType = String(resp.headers['content-type'] || 'image/jpeg').toLowerCase();
// //   if (!allowedMimes.has(mimeType)) {
// //     throw new Error(`Unsupported image type from Wikipedia: ${mimeType}`);
// //   }

// //   const ext = this.extFromUrl(imageUrl) || this.extFromMime(mimeType) || 'jpg';
// //   const filename = `${this.sanitizeFilename(placeName || 'place')}-${Date.now()}.${ext}`;

// //   const { fileId } = await this.filesService.uploadFromStream(
// //     resp.data,
// //     filename,
// //     mimeType,
// //     { source: 'wikipedia', imageUrl, placeId, placeName },
// //     'avatars',
// //   );

// //   console.log("the field id",fileId)
// //   return {
// //     fileId,
// //     localUrl: this.buildFileUrl(fileId),
// //     mimeType,
// //     filename,
// //   };
// // }


// private async downloadAndStoreImage(imageUrl: string, placeId?: string, placeName?: string) {
//   const allowedMimes = new Set([
//     'image/png',
//     'image/jpeg',
//     'image/webp',
//     'image/gif',
//     'image/heic',
//     'image/heif',
//     'image/svg+xml',
//     'image/bmp',
//   ]);

//   const resp = await axios.get(imageUrl, {
//     responseType: 'stream',
//     timeout: 20000,
//     maxBodyLength: Infinity,
//     maxContentLength: Infinity,
//     validateStatus: (s) => s >= 200 && s < 400,
//     headers: {
//       // Wikipedia prefers a descriptive UA
//       'User-Agent': 'YourAppName/1.0 (contact@example.com)',
//       'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
//     },
//   });

//   const rawType = String(resp.headers['content-type'] || 'image/jpeg').toLowerCase();
//   const mimeType = rawType.split(';')[0].trim();
//   if (!allowedMimes.has(mimeType)) {
//     throw new Error(`Unsupported image type from Wikipedia: ${mimeType}`);
//   }

//   const ext = this.extFromUrl(imageUrl) || this.extFromMime(mimeType) || 'jpg';
//   const filename = `${this.sanitizeFilename(placeName || 'place')}-${Date.now()}.${ext}`;

//   const { fileId } = await this.filesService.uploadFromStream(
//     resp.data,
//     filename,
//     mimeType,
//     { source: 'wikipedia', imageUrl, placeId, placeName },
//     'avatars',
//   );

//   console.log('the field id', fileId);
//   return {
//     fileId,
//     localUrl: this.buildFileUrl(fileId),
//     mimeType,
//     filename,
//   };
// }



//   private toPlaceDoc(detail: any, placeName: string) {
//   return {
//     title: placeName, // <-- must exist in schema
//     description: detail?.extract ?? detail?.description,
//     image: detail?.image,                 // make sure these exist in schema
//     imageFileId: detail?.imageFileId,     // ^
//     imageOriginalUrl: detail?.imageOriginalUrl,
//     wikiPageId: detail?.pageid ?? detail?.pageId,
//   };
// }







// private toPoint(latRaw: unknown, lonRaw: unknown): GeoPoint | undefined {
//   const lat = typeof latRaw === 'string' ? parseFloat(latRaw) : (latRaw as number | undefined);
//   const lon = typeof lonRaw === 'string' ? parseFloat(lonRaw) : (lonRaw as number | undefined);
//   if (Number.isFinite(lat) && Number.isFinite(lon)) {
//     return { type: 'Point', coordinates: [Number(lon), Number(lat)] };
//   }
//   return undefined;
// }

// private normalizeWikidataPoint(wdCoords: any): GeoPoint | undefined {
//   if (!wdCoords) return undefined;

//   const candidate = Array.isArray(wdCoords) ? wdCoords[0] : wdCoords;

//   // Already GeoJSON?
//   if (
//     candidate?.type === 'Point' &&
//     Array.isArray(candidate.coordinates) &&
//     candidate.coordinates.length === 2
//   ) {
//     const [x, y] = candidate.coordinates;
//     if (Number.isFinite(x) && Number.isFinite(y)) {
//       return { type: 'Point', coordinates: [Number(x), Number(y)] };
//     }
//   }

//   // Object with lat/lon
//   const la = candidate?.lat ?? candidate?.latitude;
//   const lo = candidate?.lon ?? candidate?.lng ?? candidate?.longitude;
//   return this.toPoint(la, lo);
// }




// async upsertPlaceFromDetail(detail: any, placeName: string) {
//   const qid: string | undefined =
//     detail?.wikidata?.qid ||
//     detail?.wikidata?.QID ||
//     detail?.wikidata?.id;

//   // Prefer qid for upsert to respect unique index on wikidata.qid
//   const filter = qid ? { 'wikidata.qid': qid } : { title: placeName };

//   const existing = await this.placeModel
//     .findOne(filter)
//     .select('_id title images coordinates wikidata')
//     .lean<PlaceLeanMinimal | null>();
//  console.log("the existing", existing)
//   // Remote URLs from payload
//   // const remoteOriginalUrl: string | undefined =
//   //   detail?.images?.original || this.extractImageUrl(detail);
//   // const remoteThumbUrl: string | undefined = detail?.images?.thumbnail;




  


//   const remoteOriginalUrl: string | undefined =
//   this.pickHttpUrl(detail?.images?.original) || this.extractImageUrl(detail);

// const remoteThumbUrl: string | undefined =
//   this.pickHttpUrl(detail?.images?.thumbnail) || this.pickHttpUrl(detail?.thumbnail);










//   console.log("the detail", detail)
//   console.log("the remoteOriginalUrl", remoteOriginalUrl)

//   let localOriginalUrl: string | undefined = existing?.images?.local_original;
//   let localThumbnailUrl: string | undefined = existing?.images?.local_thumbnail;
//   // console.log("the existing", existing)
//   console.log("the localOriginalUrl", localOriginalUrl,"ffffffffff", localThumbnailUrl)

//   const existingId = existing?._id ? String(existing._id) : undefined;

//   // Save local original
//   if (remoteOriginalUrl && this.isHttpUrl(remoteOriginalUrl)) {
//     const needsNewOriginal =
//       existing?.images?.original !== remoteOriginalUrl ||
//       !existing?.images?.local_original;

//     if (needsNewOriginal) {
//        console.log("the needsNewOriginal", needsNewOriginal)
//       try {
//         const uploaded = await this.downloadAndStoreImage(
//           remoteOriginalUrl,
//           existingId,
//           placeName,
//         );
//         localOriginalUrl = uploaded.localUrl;
//         console.log("the localOriginalUrl", localOriginalUrl)
//       } catch (e: any) {
//         console.warn('[upsert] Local original save failed:', e?.message || e);
//       }
//     }
//   }

//   // Save local thumbnail
//   if (remoteThumbUrl && this.isHttpUrl(remoteThumbUrl)) {
//     if (remoteOriginalUrl && remoteThumbUrl === remoteOriginalUrl) {
//       // If thumb is same as original, reuse local_original
//       if (localOriginalUrl) {
//         localThumbnailUrl = localOriginalUrl;
//       } else if (
//         existing?.images?.original === remoteOriginalUrl &&
//         existing?.images?.local_original
//       ) {
//         localThumbnailUrl = existing.images.local_original;
//       } else {
//         // Fallback: upload once and reuse for both
//         try {
//           const uploaded = await this.downloadAndStoreImage(
//             remoteThumbUrl,
//             existingId,
//             placeName,
//           );
          
//           localOriginalUrl = uploaded.localUrl;
//           localThumbnailUrl = uploaded.localUrl;
//           console.log("the localThumbnailUrl 33", localThumbnailUrl)
//         } catch (e: any) {
//           console.warn('[upsert] Local thumb(original) save failed:', e?.message || e);
//         }
//       }
//     } else {
//       // Separate thumbnail
//       const needsNewThumb =
//         existing?.images?.thumbnail !== remoteThumbUrl ||
//         !existing?.images?.local_thumbnail;

//       if (needsNewThumb) {
//         console.log("the needsNewThumb", needsNewThumb)
//         try {
//           const uploaded = await this.downloadAndStoreImage(
//             remoteThumbUrl,
//             existingId,
//             placeName,
//           );
//           localThumbnailUrl = uploaded.localUrl;
//           console.log("the localThumbnailUrl", localThumbnailUrl)
//         } catch (e: any) {
//           console.warn('[upsert] Local thumbnail save failed:', e?.message || e);
//         }
//       }
//     }
//   }

//   // Coordinates (GeoJSON [lon, lat]) using helpers
//   const latRaw =
//     detail?.coordinates?.lat ??
//     detail?.coordinates?.latitude ??
//     detail?.lat;
//   const lonRaw =
//     detail?.coordinates?.lon ??
//     detail?.coordinates?.lng ??
//     detail?.coordinates?.longitude ??
//     detail?.lon;

//   const mainPoint = this.toPoint(latRaw, lonRaw);
//   const wdPoint = this.normalizeWikidataPoint(detail?.wikidata?.coordinates);

//   // Normalize wikidata values (flattened; no root write to 'wikidata')
//   const wd = detail?.wikidata || {};
//   const toArray = (v: any) =>
//     Array.isArray(v)
//       ? v
//       : typeof v === 'string'
//       ? v.split(',').map((s) => s.trim()).filter(Boolean)
//       : [];

//   const instanceOf = toArray(wd.instance_of ?? wd.instanceOf);
//   const countries = toArray(wd.countries);
//   const administrativeAreas = toArray(wd.administrative_areas ?? wd.administrativeAreas);
//   const ranges = toArray(wd.ranges);
//   const architects = toArray(wd.architects);
//   const height_m = wd.height_m; // keep as-is (number or undefined)

//   // Build images object for DB
//   const images: Record<string, any> = {};
//   if (remoteOriginalUrl) images.original = remoteOriginalUrl;
//   if (remoteThumbUrl) images.thumbnail = remoteThumbUrl;
//   if (localOriginalUrl) images.local_original = localOriginalUrl;
//   if (localThumbnailUrl) images.local_thumbnail = localThumbnailUrl;

  

//   // Build update (do NOT $set title; only set on insert)
//   const $set: Record<string, any> = {
//     description_short: detail?.description_short,
//     description_html: detail?.description_html,
//     description_long: detail?.description_long,
//     page_url: detail?.page_url,
//   };
//   if (Object.keys(images).length) $set.images = images;
//   if (mainPoint) $set.coordinates = mainPoint;

//   // Flattened wikidata $set
//   if (qid !== undefined) $set['wikidata.qid'] = qid; // don't unset qid if not provided
//   $set['wikidata.instanceOf'] = instanceOf; // set [] if empty
//   $set['wikidata.countries'] = countries;
//   $set['wikidata.administrativeAreas'] = administrativeAreas;
//   $set['wikidata.ranges'] = ranges;
//   $set['wikidata.architects'] = architects;
//   if (height_m !== undefined) $set['wikidata.height_m'] = height_m;

//   // Coordinates under wikidata
//   if (wdPoint) $set['wikidata.coordinates'] = wdPoint;

//   const $unset: Record<string, any> = {};
//   if (!mainPoint) $unset.coordinates = 1;
//   if (!wdPoint) $unset['wikidata.coordinates'] = 1;
//   if (height_m === undefined) $unset['wikidata.height_m'] = 1;

//   // Clean undefined from $set (for top-level scalar props we added)
//   for (const k of Object.keys($set)) {
//     if ($set[k] === undefined) delete $set[k];
//   }

//   const update: any = { $set };
//   if (Object.keys($unset).length) update.$unset = $unset;
//   if (placeName) update.$setOnInsert = { title: placeName };

//   const opts = {
//     new: true,
//     upsert: true,
//     setDefaultsOnInsert: true,
//     strict: false, // until schema includes local_* or other new fields
//   } as const;

//   try {
//     const response = await this.placeModel.findOneAndUpdate(filter, update, opts).lean() as PlaceResponse ;


//     console.log("the response", response)


// const filteredDetail = {
//       id :  response?._id,
//       title: response?.title,
//       thumbnailImage: response?.images?.local_thumbnail,
//       originalImage: response?.images?.local_original,
//       description: response?.description_long,
//       countries: response?.wikidata?.countries?.[0],
//       administrativeAreas: response?.wikidata?.administrativeAreas?.[0],
//       ranges: response?.wikidata?.ranges,
//       instanceOf: response?.wikidata?.instanceOf,
//       architects: response?.wikidata?.architects?.[0],
//       coordinates: response?.coordinates?.coordinates,
//       height: response?.wikidata?.height_m,
//     };


//     return filteredDetail
//   } catch (e: any) {
//     // In case of race with unique qid, retry
//     if (e?.code === 11000 && qid) {
//       return await this.placeModel.findOneAndUpdate({ 'wikidata.qid': qid }, update, opts);
//     }
//     throw e;
//   }
// }












































 private readonly WIKI_UA = 'ScanitectAI/1.0 (+https://scanitectai.com/api; mailto:dev@scanitectai.com)';
  private readonly WIKI_HEADERS = {
    'User-Agent': this.WIKI_UA,
    'Accept': 'application/json'
  };
  private readonly MAX_CONCURRENCY = 5;

  private readonly MIRROR_CONCURRENCY = Number(process.env.MIRROR_CONCURRENCY || 2);

  private readonly COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
  private readonly MIN_IMAGES = 6;

  // Mirror config (environment-aware)
  private readonly FILES_MIRROR_URL =
    process.env.FILES_MIRROR_URL ||
    (process.env.NODE_ENV === 'production'
      ? 'https://scanitectai.com/api/files/mirror'
      : 'http://localhost:4000/files/mirror');

  private readonly FILES_AUTH_TOKEN = process.env.FILES_AUTH_TOKEN || '';

  // Preferred languages to try for cross-language galleries
  private readonly CROSS_LANG_PRIORITY = ['en', 'de', 'fr', 'es', 'it', 'ru', 'ja', 'zh', 'pt', 'pl', 'nl', 'ar', 'tr', 'hi'];

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
      await this.sleep(100);
    }
    return out;
  }

  private readonly PREFERRED_TERMS = [
    'statue','monument','landmark','building','tower','bridge','park','temple','cathedral',
    'church','mosque','museum','palace','castle','fort','arch','dam','pagoda','stupa',
    'shrine','island','mountain','volcano','waterfall','river','bay','lake','mausoleum','tomb'
  ];

  private readonly VANTAGE_TOKENS = [
    'front', 'rear', 'back', 'side', 'north', 'south', 'east', 'west',
    'northeast', 'northwest', 'southeast', 'southwest',
    'interior', 'inside', 'entrance', 'gate', 'roof',
    'aerial', 'drone', "bird's-eye",
    'panorama', 'panoramic',
    'detail', 'close', 'close-up',
    'night', 'dawn', 'dusk', 'sunset', 'sunrise',
    'winter', 'snow', 'summer', 'spring', 'autumn', 'rain', 'fog'
  ];

  // --- Image helpers ---

  private async fetchPageGallery(pageTitle: string, lang = 'en', max = 50): Promise<WikiImage[]> {
    const res = await this.wiki.get(`https://${lang}.wikipedia.org/w/api.php`, {
      params: {
        action: 'query',
        generator: 'images',
        titles: pageTitle,
        gimlimit: Math.min(100, max),
        prop: 'imageinfo',
        iiprop: 'url|mime|mediatype|size|extmetadata|sha1',
        iiurlwidth: 1024,
        format: 'json',
        origin: '*'
      }
    });

    const pages = res.data?.query?.pages || {};
    const out: WikiImage[] = [];

    for (const p of Object.values<any>(pages)) {
      const info = p?.imageinfo?.[0];
      if (!info?.url) continue;
      out.push({
        title: p.title || '',
        original: info.url,
        thumb: info.thumburl || info.url,
        width: info.width,
        height: info.height,
        mime: info.mime,
        mediatype: info.mediatype,
        sha1: info.sha1
      });
    }

    return out;
  }

  private looksBadForBuilding(img: {
    title?: string;
    original?: string;
    mime?: string;
    mediatype?: string;
    width?: number;
    height?: number;
  }) {
    const t = (img.title || '').toLowerCase();
    const url = (img.original || '').toLowerCase();

    const badWords = [
      'logo', 'icon', 'seal', 'coat of arms', 'coat_of_arms', 'flag',
      'emblem', 'symbol', 'map', 'locator', 'diagram', 'badge', 'wordmark',
      'pictogram', 'outline'
    ];
    if (badWords.some(w => t.includes(w) || url.includes(w))) return true;

    if (img.mediatype && img.mediatype !== 'BITMAP') return true;
    if (img.mime && img.mime.includes('svg')) return true;

    const w = img.width || 0;
    const h = img.height || 0;
    if (w < 600 || h < 400) return true;

    const ratio = w && h ? Math.max(w, h) / Math.min(w, h) : 1;
    if (ratio > 3.5) return true;

    return false;
  }

  // Looser filter if we need more images
  private looksBadForBuildingLoose(img: {
    title?: string;
    original?: string;
    mime?: string;
    mediatype?: string;
    width?: number;
    height?: number;
  }) {
    const t = (img.title || '').toLowerCase();
    const url = (img.original || '').toLowerCase();
    const badWords = ['logo', 'icon', 'seal', 'coat of arms', 'coat_of_arms', 'flag', 'emblem', 'symbol', 'map', 'locator', 'diagram', 'badge', 'wordmark', 'pictogram', 'outline'];
    if (badWords.some(w => t.includes(w) || url.includes(w))) return true;
    if (img.mediatype && img.mediatype !== 'BITMAP') return true;
    if (img.mime && img.mime.includes('svg')) return true;
    const w = img.width || 0;
    const h = img.height || 0;
    if (w < 400 || h < 300) return true; // lower threshold
    return false; // allow extreme ratios, etc.
  }

  private scoreForBuilding(img: { title?: string; width?: number; height?: number }, pageName: string) {
    let score = 0;
    const base = pageName.toLowerCase();

    const title = (img.title || '').toLowerCase();
    if (title.includes(base)) score += 10;
    const w = img.width || 0;
    const h = img.height || 0;
    score += Math.min(30, Math.floor((w * h) / (1200 * 800)) * 2);
    if (w >= h) score += 4;
    return score;
  }

  private getVantageKeys(title?: string): string[] {
    if (!title) return [];
    const t = title.toLowerCase();
    const found: string[] = [];
    for (const k of this.VANTAGE_TOKENS) if (t.includes(k)) found.push(k);
    return found.length ? found : ['generic'];
  }

  private dedupeImages(images: WikiImage[]): WikiImage[] {
    const seenSha = new Set<string>();
    const seenUrl = new Set<string>();
    const out: WikiImage[] = [];
    for (const img of images) {
      const keySha = (img.sha1 || '').toLowerCase();
      const keyUrl = (img.original || '').toLowerCase();
      if (keySha && seenSha.has(keySha)) continue;
      if (keyUrl && seenUrl.has(keyUrl)) continue;
      if (keySha) seenSha.add(keySha);
      if (keyUrl) seenUrl.add(keyUrl);
      out.push(img);
    }
    return out;
  }

  private selectDiverseImages(
    candidates: WikiImage[],
    baseName: string,
    min = this.MIN_IMAGES,
    max = 12,
    filter: (img: any) => boolean = (img) => !this.looksBadForBuilding(img)
  ): WikiImage[] {
    const good = candidates.filter(filter);
    good.sort((a, b) => this.scoreForBuilding(b, baseName) - this.scoreForBuilding(a, baseName));

    const usedVantage = new Set<string>();
    const usedSha = new Set<string>();
    const picked: WikiImage[] = [];

    // Pass 1: maximize different vantage tokens
    for (const img of good) {
      if (picked.length >= max) break;
      const sha = (img.sha1 || '').toLowerCase();
      if (sha && usedSha.has(sha)) continue;
      const keys = this.getVantageKeys(img.title);
      const newKey = keys.find(k => !usedVantage.has(k));
      if (newKey) {
        picked.push(img);
        if (sha) usedSha.add(sha);
        usedVantage.add(newKey);
      }
    }

    // Pass 2: fill up to min with remaining best
    if (picked.length < min) {
      for (const img of good) {
        if (picked.length >= Math.max(min, Math.min(max, good.length))) break;
        const sha = (img.sha1 || '').toLowerCase();
        if (sha && usedSha.has(sha)) continue;
        picked.push(img);
        if (sha) usedSha.add(sha);
      }
    }

    return picked.slice(0, Math.max(min, Math.min(max, picked.length)));
  }

  // private async mirrorImageToLocal(remoteUrl: string, filename?: string): Promise<string | null> {
  //   try {
  //     const res = await axios.post(
  //       this.FILES_MIRROR_URL,
  //       { url: remoteUrl, filename },
  //       {
  //         headers: {
  //           ...(this.FILES_AUTH_TOKEN ? { Authorization: this.FILES_AUTH_TOKEN } : {}),
  //           'Content-Type': 'application/json'
  //         },
  //         timeout: 20000
  //       }
  //     );
  //     const localUrl = res.data?.url || res.data?.data?.url;
  //     return localUrl || null;
  //   } catch {
  //     return null;
  //   }
  // }

  // --- Wikipedia/Wikidata helpers ---

private async mirrorImageToLocal(remoteUrl: string, filename?: string): Promise<string | null> {
  try {
    const uploaded = await this.downloadAndStoreImage(
      remoteUrl,
      undefined,                // no placeId here
      filename || 'wikipedia',  // only for naming the file
    );
    return uploaded.localUrl;
  } catch (e: any) {
    console.warn('[mirrorImageToLocal] failed:', e?.message || e);
    return null;
  }
}



  private async fetchWikiSummary(title: string, lang = 'en') {
    const res = await this.wiki.get(
      `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      { params: { redirect: true } }
    );
    return res.data;
  }

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

        if (lcTitle.startsWith(base + ' (')) score += 5;
        if (p && terms.includes(p)) score += 10;
        if (this.containsPreferred(s.description, terms)) score += 4;
        if (s.originalimage?.source) score += 1;
        return { s, score };
      })
      .sort((a, b) => b.score - a.score);

    return scored[0]?.s || null;
  }

  private async resolveWikipedia(name: string, lang = 'en'): Promise<{ title: string; summary: any } | null> {
    let first: any = null;
    try {
      first = await this.fetchWikiSummary(name, lang);
      if (first && first.type !== 'disambiguation') {
        return { title: first.title, summary: first };
      }
    } catch (e: any) {
      const code = e?.response?.status;
      if (code === 404 || code === 403 || code === 429) {
        // continue
      } else {
        throw e;
      }
    }

    const titleSet = new Set<string>();
    try {
      const t1 = await this.searchByTitle(name, lang, 10);
      t1.forEach(t => titleSet.add(t));
    } catch {}
    try {
      const t2 = await this.searchBestTitles(name, lang, 10);
      t2.forEach(t => titleSet.add(t));
    } catch {}

    const allCandidates = Array.from(titleSet);
    const prioritized = [
      ...allCandidates.filter(t => t.toLowerCase().startsWith(name.toLowerCase() + ' (')),
      ...allCandidates
    ].slice(0, 20);

    const summariesRaw = await this.mapWithConcurrency(
      prioritized,
      this.MAX_CONCURRENCY,
      t => this.fetchWikiSummary(t, lang).catch(() => null)
    );
    const summaries = summariesRaw.filter(Boolean) as any[];

    const pick = this.pickBestCandidate(name, summaries);
    if (pick) return { title: pick.title, summary: pick };

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

  // --- Commons helpers ---

  private async fetchCommonsLinksFromWikidata(qid: string): Promise<{ categories: string[]; galleries: string[] }> {
    try {
      const res = await this.wiki.get('https://www.wikidata.org/w/api.php', {
        params: {
          action: 'wbgetentities',
          ids: qid,
          props: 'sitelinks|claims',
          format: 'json',
          origin: '*'
        }
      });

      const ent = res.data?.entities?.[qid];
      const cats = new Set<string>();
      const galls = new Set<string>();

      const sitelinkCommons = ent?.sitelinks?.commonswiki?.title as string | undefined;
      if (sitelinkCommons) {
        if (sitelinkCommons.startsWith('Category:')) cats.add(sitelinkCommons);
        else galls.add(sitelinkCommons);
      }

      // P373: Commons category
      const p373 = ent?.claims?.P373;
      if (p373) {
        for (const st of p373) {
          const v = st?.mainsnak?.datavalue?.value;
          if (typeof v === 'string' && v.trim()) cats.add(`Category:${v}`);
        }
      }

      // P935: Commons gallery
      const p935 = ent?.claims?.P935;
      if (p935) {
        for (const st of p935) {
          const v = st?.mainsnak?.datavalue?.value;
          if (typeof v === 'string' && v.trim()) galls.add(v);
        }
      }

      return { categories: Array.from(cats), galleries: Array.from(galls) };
    } catch {
      return { categories: [], galleries: [] };
    }
  }

  // Paginated category fetch (more robust)
  private async fetchCommonsCategoryImagesPaginated(categoryTitle: string, maxFiles = 400): Promise<WikiImage[]> {
    let gcmcontinue: string | undefined = undefined;
    const out: WikiImage[] = [];

    do {
      const res = await this.wiki.get(this.COMMONS_API, {
        params: {
          action: 'query',
          generator: 'categorymembers',
          gcmtitle: categoryTitle,
          gcmtype: 'file',
          gcmnamespace: 6,
          gcmlimit: 200,
          prop: 'imageinfo',
          iiprop: 'url|mime|mediatype|size|extmetadata|sha1',
          iiurlwidth: 1024,
          format: 'json',
          origin: '*',
          ...(gcmcontinue ? { gcmcontinue } : {})
        }
      });

      const pages = res.data?.query?.pages || {};
      for (const p of Object.values<any>(pages)) {
        const info = p?.imageinfo?.[0];
        if (!info?.url) continue;
        out.push({
          title: p.title || '',
          original: info.url,
          thumb: info.thumburl || info.url,
          width: info.width,
          height: info.height,
          mime: info.mime,
          mediatype: info.mediatype,
          sha1: info.sha1
        });
      }

      gcmcontinue = res.data?.continue?.gcmcontinue;
      if (out.length >= maxFiles) break;
      await this.sleep(120);
    } while (gcmcontinue);

    return out.slice(0, maxFiles);
  }

  private async fetchCommonsCategoryImages(categoryTitle: string, max = 120): Promise<WikiImage[]> {
    const res = await this.wiki.get(this.COMMONS_API, {
      params: {
        action: 'query',
        generator: 'categorymembers',
        gcmtitle: categoryTitle,
        gcmtype: 'file',
        gcmnamespace: 6,
        gcmlimit: Math.min(200, max),
        prop: 'imageinfo',
        iiprop: 'url|mime|mediatype|size|extmetadata|sha1',
        iiurlwidth: 1024,
        format: 'json',
        origin: '*'
      }
    });

    const pages = res.data?.query?.pages || {};
    const out: WikiImage[] = [];
    for (const p of Object.values<any>(pages)) {
      const info = p?.imageinfo?.[0];
      if (!info?.url) continue;
      out.push({
        title: p.title || '',
        original: info.url,
        thumb: info.thumburl || info.url,
        width: info.width,
        height: info.height,
        mime: info.mime,
        mediatype: info.mediatype,
        sha1: info.sha1
      });
    }
    return out;
  }

  private async fetchCommonsGalleryImages(galleryTitle: string, max = 120): Promise<WikiImage[]> {
    const res = await this.wiki.get(this.COMMONS_API, {
      params: {
        action: 'query',
        generator: 'images',
        titles: galleryTitle,
        gimlimit: Math.min(500, max),
        prop: 'imageinfo',
        iiprop: 'url|mime|mediatype|size|extmetadata|sha1',
        iiurlwidth: 1024,
        format: 'json',
        origin: '*'
      }
    });

    const pages = res.data?.query?.pages || {};
    const out: WikiImage[] = [];
    for (const p of Object.values<any>(pages)) {
      const info = p?.imageinfo?.[0];
      if (!info?.url) continue;
      out.push({
        title: p.title || '',
        original: info.url,
        thumb: info.thumburl || info.url,
        width: info.width,
        height: info.height,
        mime: info.mime,
        mediatype: info.mediatype,
        sha1: info.sha1
      });
    }
    return out;
  }

  private async fetchCommonsSubcategories(categoryTitle: string, limit = 10): Promise<string[]> {
    const res = await this.wiki.get(this.COMMONS_API, {
      params: {
        action: 'query',
        list: 'categorymembers',
        cmtitle: categoryTitle,
        cmtype: 'subcat',
        cmnamespace: 14,
        cmlimit: Math.min(50, limit),
        format: 'json',
        origin: '*'
      }
    });
    const members = res.data?.query?.categorymembers || [];
    return members.map((m: any) => m.title).slice(0, limit);
  }

  private async fetchCommonsCategoryImagesDeep(categoryTitle: string, maxFiles = 200, subcats = 5): Promise<WikiImage[]> {
    const rootFiles = await this.fetchCommonsCategoryImagesPaginated(categoryTitle, Math.min(400, maxFiles)).catch(() => []);
    const subcatTitles = await this.fetchCommonsSubcategories(categoryTitle, subcats).catch(() => []);
    const subFilesChunks = await this.mapWithConcurrency(
      subcatTitles,
      this.MAX_CONCURRENCY,
      (c) => this.fetchCommonsCategoryImagesPaginated(c, Math.floor(maxFiles / Math.max(1, subcats))).catch(() => [])
    );
    const all: WikiImage[] = [...rootFiles];
    for (const arr of subFilesChunks) all.push(...arr);
    return all;
  }

  private async fetchCommonsSearchImages(query: string, max = 120): Promise<WikiImage[]> {
    const res = await this.wiki.get(this.COMMONS_API, {
      params: {
        action: 'query',
        generator: 'search',
        gsrsearch: `intitle:"${query}"`,
        gsrnamespace: 6, // File:
        gsrlimit: Math.min(200, max),
        prop: 'imageinfo',
        iiprop: 'url|mime|mediatype|size|extmetadata|sha1',
        iiurlwidth: 1024,
        format: 'json',
        origin: '*'
      }
    });
    const pages = res.data?.query?.pages || {};
    const out: WikiImage[] = [];
    for (const p of Object.values<any>(pages)) {
      const info = p?.imageinfo?.[0];
      if (!info?.url) continue;
      out.push({
        title: p.title || '',
        original: info.url,
        thumb: info.thumburl || info.url,
        width: info.width,
        height: info.height,
        mime: info.mime,
        mediatype: info.mediatype,
        sha1: info.sha1
      });
    }
    return out;
  }

  private async fetchWikiSitelinks(qid: string): Promise<Record<string, string>> {
    const res = await this.wiki.get('https://www.wikidata.org/w/api.php', {
      params: {
        action: 'wbgetentities',
        ids: qid,
        props: 'sitelinks',
        format: 'json',
        origin: '*'
      }
    });
    const ent = res.data?.entities?.[qid];
    const sitelinks = ent?.sitelinks || {};
    const out: Record<string, string> = {};
    for (const [site, obj] of Object.entries<any>(sitelinks)) {
      if (!site.endsWith('wiki')) continue;
      if (site === 'commonswiki') continue;
      const lang = site.replace('wiki', '');
      out[lang] = obj.title;
    }
    return out;
  }

  private async fetchCrossLangGalleries(qid: string, preferredFirst = this.CROSS_LANG_PRIORITY, maxLangs = 6): Promise<WikiImage[]> {
    const out: WikiImage[] = [];
    try {
      const links = await this.fetchWikiSitelinks(qid);
      // Select languages to fetch
      const available = Object.keys(links);
      const ordered: string[] = [];
      for (const l of preferredFirst) if (available.includes(l)) ordered.push(l);
      // Add any remaining languages if needed
      for (const l of available) if (!ordered.includes(l)) ordered.push(l);
      const pickLangs = ordered.slice(0, maxLangs);

      const chunks = await this.mapWithConcurrency(
        pickLangs,
        this.MAX_CONCURRENCY,
        (l) => this.fetchPageGallery(links[l], l, 80).catch(() => [])
      );
      for (const arr of chunks) out.push(...arr);
    } catch {}
    return out;
  }

  // --- main ---

  async getDetail(
    PlaceName: string,
    opts: { longDescriptionChars?: number; lang?: string } = {}
  ) {
    const { longDescriptionChars = 1500, lang = 'en' } = opts;

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
        return { status: 404, statusMessage: 'not_found', data: `No "${PlaceName}" data is found on Wikipedia` };
      }
      const resolvedTitle = resolved.title;
      const wikiData = resolved.summary;

      // Longer description
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

        if (!sparqlWorked || (!wd.countries.length && !wd.administrative_areas.length && !wd.height_m && !wd.elevation_m)) {
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

      const baseName = wikiData.title || resolvedTitle;

      // Build candidates: same-lang page gallery
      const sameLangGallery = await this.fetchPageGallery(resolvedTitle, lang, 100);

      // Cross-language galleries (from other Wikipedia language pages)
      let crossLang: WikiImage[] = [];
      if (wikiData.wikibase_item) {
        crossLang = await this.fetchCrossLangGalleries(wd.qid || wikiData.wikibase_item).catch(() => []);
      }

      // Commons images (category + subcategories + gallery)
      let commonsImages: WikiImage[] = [];
      if (wikiData.wikibase_item) {
        const commonsLinks = await this.fetchCommonsLinksFromWikidata(wd.qid || wikiData.wikibase_item);

        // Category root + subcats (paginated)
        const catDeepChunks = await this.mapWithConcurrency(
          commonsLinks.categories.slice(0, 2),
          this.MAX_CONCURRENCY,
          (c) => this.fetchCommonsCategoryImagesDeep(c, 200, 5).catch(() => [])
        );
        for (const arr of catDeepChunks) commonsImages.push(...arr);

        // Galleries
        const galImgsChunks = await this.mapWithConcurrency(
          commonsLinks.galleries.slice(0, 2),
          this.MAX_CONCURRENCY,
          (g) => this.fetchCommonsGalleryImages(g, 200).catch(() => [])
        );
        for (const arr of galImgsChunks) commonsImages.push(...arr);
      }

      // Merge + dedupe initial pool
      let allCandidates: WikiImage[] = [...sameLangGallery, ...crossLang, ...commonsImages];
      allCandidates = this.dedupeImages(allCandidates);

      // If still likely low, search Commons by title as a fallback
      if (allCandidates.length < this.MIN_IMAGES) {
        const searchImgs = await this.fetchCommonsSearchImages(baseName, 200).catch(() => []);
        allCandidates = this.dedupeImages([...allCandidates, ...searchImgs]);
      }

      // Select diverse set with fallback to looser filter if needed
      let diverse = this.selectDiverseImages(allCandidates, baseName, this.MIN_IMAGES, 16);
      if (diverse.length < this.MIN_IMAGES) {
        const loosePick = this.selectDiverseImages(allCandidates, baseName, this.MIN_IMAGES, 16, (img) => !this.looksBadForBuildingLoose(img));
        if (loosePick.length > diverse.length) diverse = loosePick;
      }

      // Final fill to ensure we reach MIN_IMAGES if still short
      if (diverse.length < this.MIN_IMAGES) {
        const seen = new Set<string>(diverse.map(i => ((i.sha1 || i.original) || '').toLowerCase()));
        for (const img of allCandidates) {
          const key = ((img.sha1 || img.original) || '').toLowerCase();
          if (!seen.has(key)) {
            diverse.push(img);
            seen.add(key);
          }
          if (diverse.length >= this.MIN_IMAGES) break;
        }
      }

      // Lead image: prefer summary lead if good
      const summaryLead = wikiData?.originalimage?.source
        ? {
            title: `File:${baseName}.jpg`,
            original: wikiData.originalimage.source,
            thumb: wikiData.thumbnail?.source || wikiData.originalimage.source,
            width: undefined,
            height: undefined,
            mime: undefined,
            mediatype: 'BITMAP',
            sha1: undefined
          } as WikiImage
        : null;

      const lead = summaryLead && !this.looksBadForBuilding(summaryLead)
        ? summaryLead
        : (diverse[0] || summaryLead || null);

      // Mirror lead + at least 6 diverse images
      let localLeadOriginal: string | null = null;
      let localLeadThumb: string | null = null;
      if (lead?.original) localLeadOriginal = await this.mirrorImageToLocal(lead.original);
      if (lead?.thumb) localLeadThumb = await this.mirrorImageToLocal(lead.thumb || lead.original);

      const toMirror = diverse.slice(0, Math.max(this.MIN_IMAGES, Math.min(12, diverse.length)));

      // Lower concurrency for mirroring + fallback to remote if mirror fails
      const galleryWithLocal = await this.mapWithConcurrency(
        toMirror,
        this.MIRROR_CONCURRENCY,
        async (img) => {
          const localOriginal = await this.mirrorImageToLocal(img.original);
          const localThumb = img.thumb ? await this.mirrorImageToLocal(img.thumb) : null;
          return {
            title: img.title,
            original: img.original,
            thumbnail: img.thumb || img.original,

            // snake_case
            local_original: localOriginal || img.original,
            local_thumbnail: localThumb || img.thumb || img.original,

            // camelCase (matches your schema)
            localOriginal: localOriginal || img.original,
            localThumbnail: localThumb || img.thumb || img.original
          };
        }
      );

      const data = {
        title: wikiData.title || resolvedTitle,
        description_short: wikiData.extract || '',
        description_html: wikiData.extract_html || '',
        description_long: longDescription,
        page_url: wikiData.content_urls?.desktop?.page || '',
        images: {
          thumbnail: lead?.thumb || wikiData.thumbnail?.source || '',
          original: lead?.original || wikiData.originalimage?.source || '',

          // snake_case
          local_thumbnail: localLeadThumb || lead?.thumb || wikiData.thumbnail?.source || '',
          local_original: localLeadOriginal || lead?.original || wikiData.originalimage?.source || '',

          // camelCase (matches your schema)
          localThumbnail: localLeadThumb || lead?.thumb || wikiData.thumbnail?.source || '',
          localOriginal: localLeadOriginal || lead?.original || wikiData.originalimage?.source || '',

          gallery: Array.isArray(galleryWithLocal) ? galleryWithLocal : []
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

  private pickHttpUrl(v: any): string | undefined {
  if (!v) return undefined;
  if (typeof v === 'string' && this.isHttpUrl(v)) return v;
  const candidate = v.source || v.url || v.href;
  return (typeof candidate === 'string' && this.isHttpUrl(candidate)) ? candidate : undefined;
}


  // private extractImageUrl(detail: any): string | undefined {
  //   if (!detail) return undefined;

  //   // Common Wikipedia shapes:
  //   // - detail.image
  //   // - detail.thumbnail?.source
  //   // - detail.originalimage?.source
  //   // - detail.images?.[0]?.source or .url
  //   if (typeof detail.image === 'string' && this.isHttpUrl(detail.image)) return detail.image;
  //   if (this.isHttpUrl(detail?.thumbnail?.source)) return detail.thumbnail.source;
  //   if (this.isHttpUrl(detail?.originalimage?.source)) return detail.originalimage.source;

  //   if (Array.isArray(detail.images)) {
  //     for (const i of detail.images) {
  //       const u = i?.source || i?.url;
  //       if (this.isHttpUrl(u)) return u;
  //     }
  //   }

  //   return undefined;
  // }


  private extractImageUrl(detail: any): string | undefined {
  if (!detail) return undefined;

  // Also handle { image: { source|url } }
  if (this.isHttpUrl(detail?.image?.source)) return detail.image.source;
  if (this.isHttpUrl(detail?.image?.url)) return detail.image.url;

  // Common Wikipedia shapes:
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



//   private async downloadAndStoreImage(imageUrl: string, placeId?: string, placeName?: string) {
//   const allowedMimes = new Set([
//     'image/png',
//     'image/jpeg',
//     'image/webp',
//     'image/gif',
//     'image/heic',
//     'image/heif',
//     'image/svg+xml',
//     'image/bmp',
//   ]);

//   const resp = await axios.get(imageUrl, {
//     responseType: 'stream',
//     timeout: 20000,
//     maxBodyLength: Infinity,     // remove stream size limit
//     maxContentLength: Infinity,  // extra safety for axios versions
//     validateStatus: (s) => s >= 200 && s < 400,
//   });

//   const mimeType = String(resp.headers['content-type'] || 'image/jpeg').toLowerCase();
//   if (!allowedMimes.has(mimeType)) {
//     throw new Error(`Unsupported image type from Wikipedia: ${mimeType}`);
//   }

//   const ext = this.extFromUrl(imageUrl) || this.extFromMime(mimeType) || 'jpg';
//   const filename = `${this.sanitizeFilename(placeName || 'place')}-${Date.now()}.${ext}`;

//   const { fileId } = await this.filesService.uploadFromStream(
//     resp.data,
//     filename,
//     mimeType,
//     { source: 'wikipedia', imageUrl, placeId, placeName },
//     'avatars',
//   );

//   console.log("the field id",fileId)
//   return {
//     fileId,
//     localUrl: this.buildFileUrl(fileId),
//     mimeType,
//     filename,
//   };
// }


// private async downloadAndStoreImage(imageUrl: string, placeId?: string, placeName?: string) {
//   const allowedMimes = new Set([
//     'image/png',
//     'image/jpeg',
//     'image/webp',
//     'image/gif',
//     'image/heic',
//     'image/heif',
//     'image/svg+xml',
//     'image/bmp',
//   ]);

//   const resp = await axios.get(imageUrl, {
//     responseType: 'stream',
//     timeout: 20000,
//     maxBodyLength: Infinity,
//     maxContentLength: Infinity,
//     validateStatus: (s) => s >= 200 && s < 400,
//     headers: {
//       // Wikipedia prefers a descriptive UA
//       'User-Agent': 'YourAppName/1.0 (contact@example.com)',
//       'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
//     },
//   });

//   const rawType = String(resp.headers['content-type'] || 'image/jpeg').toLowerCase();
//   const mimeType = rawType.split(';')[0].trim();
//   if (!allowedMimes.has(mimeType)) {
//     throw new Error(`Unsupported image type from Wikipedia: ${mimeType}`);
//   }

//   const ext = this.extFromUrl(imageUrl) || this.extFromMime(mimeType) || 'jpg';
//   const filename = `${this.sanitizeFilename(placeName || 'place')}-${Date.now()}.${ext}`;

//   const { fileId } = await this.filesService.uploadFromStream(
//     resp.data,
//     filename,
//     mimeType,
//     { source: 'wikipedia', imageUrl, placeId, placeName },
//     'avatars',
//   );

//   console.log('the field id', fileId);
//   return {
//     fileId,
//     localUrl: this.buildFileUrl(fileId),
//     mimeType,
//     filename,
//   };
// }




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
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    validateStatus: (s) => s >= 200 && s < 400,
    headers: {
      // Use the SAME UA that works for your Wikipedia API calls
      'User-Agent': this.WIKI_UA,
      'Accept': 'image/*,*/*;q=0.8',
      // Optional but often helps:
      // 'Referer': 'https://scanitectai.com/',
    },
  });

  const rawType = String(resp.headers['content-type'] || 'image/jpeg').toLowerCase();
  const mimeType = rawType.split(';')[0].trim();
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
 console.log("the existing", existing)
  // Remote URLs from payload
  // const remoteOriginalUrl: string | undefined =
  //   detail?.images?.original || this.extractImageUrl(detail);
  // const remoteThumbUrl: string | undefined = detail?.images?.thumbnail;




  


  const remoteOriginalUrl: string | undefined =
  this.pickHttpUrl(detail?.images?.original) || this.extractImageUrl(detail);

const remoteThumbUrl: string | undefined =
  this.pickHttpUrl(detail?.images?.thumbnail) || this.pickHttpUrl(detail?.thumbnail);










  console.log("the detail", detail)
  console.log("the remoteOriginalUrl", remoteOriginalUrl)

  let localOriginalUrl: string | undefined = existing?.images?.local_original;
  let localThumbnailUrl: string | undefined = existing?.images?.local_thumbnail;
  // console.log("the existing", existing)
  console.log("the localOriginalUrl", localOriginalUrl,"ffffffffff", localThumbnailUrl)

  const existingId = existing?._id ? String(existing._id) : undefined;

  // Save local original
  if (remoteOriginalUrl && this.isHttpUrl(remoteOriginalUrl)) {
    const needsNewOriginal =
      existing?.images?.original !== remoteOriginalUrl ||
      !existing?.images?.local_original;

    if (needsNewOriginal) {
       console.log("the needsNewOriginal", needsNewOriginal)
      try {
        const uploaded = await this.downloadAndStoreImage(
          remoteOriginalUrl,
          existingId,
          placeName,
        );
        localOriginalUrl = uploaded.localUrl;
        console.log("the localOriginalUrl", localOriginalUrl)
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
          console.log("the localThumbnailUrl 33", localThumbnailUrl)
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
        console.log("the needsNewThumb", needsNewThumb)
        try {
          const uploaded = await this.downloadAndStoreImage(
            remoteThumbUrl,
            existingId,
            placeName,
          );
          localThumbnailUrl = uploaded.localUrl;
          console.log("the localThumbnailUrl", localThumbnailUrl)
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












//  private readonly openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });


//  async identifyByName(dto: IdentifyPlaceByNameDto): Promise<PlaceInfo8Dto> {
//     if (!process.env.OPENAI_API_KEY) {
//       throw new InternalServerErrorException('OPENAI_API_KEY not set');
//     }
//     if (!dto.imageName?.trim()) {
//       throw new BadRequestException('imageName is required');
//     }

//     // Try to normalize filenames like "burj_khalifa.jpg" -> "burj khalifa"
//     const cleanedName = dto.imageName
//       .replace(/\.[^/.]+$/, '') // remove extension
//       .replace(/[_-]+/g, ' ')   // underscores/dashes -> spaces
//       .trim();

//     const prompt = [
//       `You are given an "imageName" string which may be a filename or a loose name of a place or landmark.`,
//       `Interpret it as the intended place and return ONLY JSON matching the schema.`,
//       `Rules:`,
//       `- Do not fabricate facts. If uncertain, use "unknown" for strings or null for numbers.`,
//       `- real_image_url: provide a real, publicly accessible URL (prefer Wikimedia) ONLY if you are confident.`,
//       `  If unsure, set real_image_url to null. Do not invent URLs.`,
//       `- latitude/longitude: decimal degrees if known; else null.`,
//       `- architect: array of names; [] if unknown.`,
//       `- administrative_area: city/state/province/emirate; null if unknown.`,
//       `- instance_of: categories like "Skyscraper", "Monument".`,
//       `imageName: "${dto.imageName}"`,
//       cleanedName !== dto.imageName ? `interpreted_place_name: "${cleanedName}"` : ''
//     ].filter(Boolean).join('\n');

//     const resp = await this.openai.responses.create({
//       model: 'gpt-4o', // or 'gpt-4o' for best results
//       temperature: 0,
//       max_output_tokens: 800,
//       response_format: { type: 'json_schema', json_schema: placeInfo8JsonSchema },
//       input: [
//         {
//           role: 'user',
//           content: [{ type: 'input_text', text: prompt }],
//         },
//       ],
//     });

//     console.log("the resp", resp)

//     const jsonText =
//       (resp as any).output_text ??
//       (resp as any).output?.[0]?.content?.[0]?.text ??
//       (resp as any).choices?.[0]?.message?.content;

//     if (!jsonText) {
//        return {
//         status: 404,
//         message: 'The image is not found',
//       };
//     }

//     try {
//       const parsed: PlaceInfo8Dto = JSON.parse(jsonText);
//       return parsed;
//     } catch {
//       throw new InternalServerErrorException('Failed to parse model JSON');
//     }
//   }




//  private readonly WIKI_UA = 'ScanitectAI/1.0 (+https://scanitectai.com/api; mailto:dev@scanitectai.com)';
//   private readonly WIKI_HEADERS = {
//     'User-Agent': this.WIKI_UA,
//     'Accept': 'application/json'
//   };



  private readonly headers = {
    'User-Agent': 'YourAppName/1.0 (contact: you@example.com)',
    'Accept': 'application/json',
  };

  private cleanLabel(label: string): string {
    return label
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // accents
      .replace(/[’‘]/g, "'")
      .replace(/\bmoussallem\b/gi, 'mausoleum') // common misspelling
      .replace(/\s+/g, ' ')
      .trim();
  }

  // 1) Wikidata search → QID (primary path)
  private async tryWikidataSearch(query: string, lang = 'en'): Promise<string | null> {
    const url = 'https://www.wikidata.org/w/api.php';
    const params = {
      action: 'wbsearchentities',
      format: 'json',
      language: lang,
      type: 'item',
      limit: '5',
      search: query,
      // origin: '*' // only needed for browser; server-side can omit
    };
    try {
      const res = await firstValueFrom(this.http.get(url, { params, headers: this.headers }));
      const hits = res.data?.search || [];
      if (hits.length) {
        // Optional: log top hits for debugging
        // console.log('Wikidata hits:', hits.map((h: any) => `${h.id} | ${h.label} | ${h.description}`));
        return hits[0].id as string;
      }
      return null;
    } catch (e: any) {
      console.error('Wikidata search error:',
        e?.response?.status,
        e?.response?.statusText,
        e?.message,
        e?.response?.data
      );
      return null;
    }
  }

  // 2) Wikipedia search → title
  private async wikipediaSearchTitle(query: string, lang = 'en'): Promise<string | null> {
    const url = `https://${lang}.wikipedia.org/w/api.php`;
    const params = {
      action: 'query',
      format: 'json',
      list: 'search',
      srsearch: query,
      srlimit: '5',
      srwhat: 'nearmatch',
      srenablerewrites: '1',
      utf8: '1',
    };
    try {
      const res = await firstValueFrom(this.http.get(url, { params, headers: this.headers }));
      const hits = res.data?.query?.search || [];
      return hits.length ? hits[0].title as string : null;
    } catch (e: any) {
      console.error('Wikipedia search error:',
        e?.response?.status,
        e?.response?.statusText,
        e?.message,
        e?.response?.data
      );
      return null;
    }
  }

  // 3) From a Wikipedia title → QID via pageprops
  private async qidFromWikipediaTitle(title: string, lang = 'en'): Promise<string | null> {
    const url = `https://${lang}.wikipedia.org/w/api.php`;
    const params = {
      action: 'query',
      format: 'json',
      prop: 'pageprops',
      ppprop: 'wikibase_item',
      titles: title,
      utf8: '1',
    };
    try {
      const res = await firstValueFrom(this.http.get(url, { params, headers: this.headers }));
      const pages = res.data?.query?.pages || {};
      const firstPage: any = Object.values(pages)[0];
      return firstPage?.pageprops?.wikibase_item || null;
    } catch (e: any) {
      console.error('Wikipedia pageprops error:',
        e?.response?.status,
        e?.response?.statusText,
        e?.message,
        e?.response?.data
      );
      return null;
    }
  }

  // Public: returns QID or null
  async getQidFromLabel(noisyLabel: string, lang = 'en'): Promise<string | null> {
    if (!noisyLabel?.trim()) return null;

    // A) Wikidata search (as-is)
    let qid = await this.tryWikidataSearch(noisyLabel, lang);
    if (qid) return qid;

    // B) Wikidata search (cleaned)
    const cleaned = this.cleanLabel(noisyLabel);
    if (cleaned && cleaned !== noisyLabel) {
      qid = await this.tryWikidataSearch(cleaned, lang);
      if (qid) return qid;
    }

    // C) Wikipedia fallback: search → pageprops → QID
    let title = await this.wikipediaSearchTitle(noisyLabel, lang);
    if (!title && cleaned) {
      title = await this.wikipediaSearchTitle(cleaned, lang);
    }
    if (title) {
      qid = await this.qidFromWikipediaTitle(title, lang);
      if (qid) return qid;
    }

    return null;
  }





//      async searchTitle(label: string): Promise<WikipediaResult> {
//     try {

//       console.log("the query", label)
// const response = await axios.get('https://en.wikipedia.org/w/api.php', {
//   params: {
//     action: 'query',
//     list: 'search',
//     srsearch: label, // make sure 'label' is not empty
//     format: 'json',
//   },
// });

// // log the full axios response
// console.log("Full response:", response);
// console.log("Response data:", response.data);
//       const searchResults = response.data?.query?.search;


//       if (!searchResults || searchResults.length === 0) {
//         return {
//           status: 404,
//           message: 'No results found',
//         };
//       }

//       // Return top result title
//       return {
//         status: 200,
//          message: 'successfully fetch correct name',
//         title: searchResults[0].title,
//       };
//     } catch (error: any) {
//       return {
//         status: 500,
//         message: 'Error fetching to search this name',
//         error: error.message,
//       };
//     }
//   }


async searchTitle(label: string): Promise<WikipediaResult> {
  try {
    console.log("the query", label);

    const response = await axios.get('https://en.wikipedia.org/w/api.php', { 
      params: { 
        action: 'query', 
        list: 'search', 
        srsearch: label, 
        format: 'json', 
      },
       headers: { 
        'User-Agent': 'NestJS Wikipedia Search/1.0 (example@example.com)', // add a proper User-Agent 
        }, 
      });


    // console.log("Response data:", response);

    const searchResults = response.data?.query?.search;

    console.log("thge search result", searchResults )

    if (!searchResults || searchResults.length === 0) {
      return {
        status: 404,
        message: 'No results found',
      };
    }

    return {
      status: 200,
      message: 'Successfully fetched correct name',
      title: searchResults[0].title,
    };
  } catch (error: any) {
    console.error("Axios error:", error);
    return {
      status: 500,
      message: 'Error fetching to search this name',
      error: error.message,
    };
  }
}


// async searchTitle(label: string) {

//   console.log("in here")
//   const search = await axios.get("https://en.wikipedia.org/w/api.php", {
//     params: {
//       action: "query",
//       list: "search",
//       srsearch: label,
//       format: "json" 
//     },
//      headers: { 
//         'User-Agent': 'NestJS Wikipedia Search/1.0 (example@example.com)', // add a proper User-Agent 
//         }, 
//   });

//   console.log("the search",search )

//   const results = search.data?.query?.search || [];
//   if (results.length === 0) return null;

//   const titles = results.map(r => r.title);

//   console.log("the title", titles)

//   const match = similarity.findBestMatch(label, titles);
//   const bestTitle = match.bestMatch.target;


//   console.log("the best", bestTitle)
//   return bestTitle;
// }





}







































