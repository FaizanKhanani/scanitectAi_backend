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
import * as sharp from 'sharp';
import { Readable } from 'stream';
import * as NodeFormData from 'form-data'; 
import * as crypto from 'crypto';


interface WikipediaResult {
  status: number;
  title?: string;
  message?: string;
  error?: string;
}


type GeoResult = { lat: number; lon: number };


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


type NearbyPlace = {
  id: string;
  title: string;
  location: string | null;
  thumbnailImage: string | null;
  // category?: string; // uncomment if you want to tag by your label
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

interface AiInfoResponse {
  title?: string;               // ChatGPT building title
  shortDescription?: string;    // GPT short description
  tourismDescription?: string;  // GPT tourism-focused description
  funFacts?: string[];          // GPT fun facts
  heightMeters?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  architectureStyle?: string | null;
   architectName: String,   // <-- add
  location: String,   
}




interface GooglePlaceBasic {
  placeId: string;
  name: string;
  lat: number;
  lon: number;
  photos: { ref: string; width?: number; height?: number }[];
}
interface NearbyThing {
  placeId: string;
  name: string;
  lat: number;
  lon: number;
  distanceMeters: number;
  types: string[];
}




interface PlaceResponseSerp extends PlaceResponse {
  ai?: AiInfoResponse;
  
}

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
raw?:{
  lensFirst?:{
    image?:string[];
  }
}
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

// interface GeoResult {
//   lat: number;
//   lon: number;
// }


interface ChatGptBuildingInfo {
  name: string;
  shortDescription: string;
  tourismDescription: string;
  funFacts: string[];
  heightMeters: number | null;
  latitude: number | null;
  longitude: number | null;
  architectureStyle: string | null;
     architectName: String,   // <-- add
  location: String,   
}




@Injectable()
export class VisionService {
  constructor(
    private readonly http: HttpService,
       private readonly filesService: FilesService,
    @InjectModel('Place') private readonly placeModel: Model<any>,
    // @InjectModel(Place.name) private readonly placeModel: Model<PlaceDocument>
  ) {}



//  private visionClient = new ImageAnnotatorClient();
//   private readonly EARTH_R = 6371000;

//   private haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
//     const toRad = (v: number) => (v * Math.PI) / 180;
//     const dLat = toRad(lat2 - lat1);
//     const dLon = toRad(lon2 - lon1);
//     const a =
//       Math.sin(dLat / 2) ** 2 +
//       Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
//     return 2 * this.EARTH_R * Math.asin(Math.sqrt(a));
//   }
  
//   private scoreWithGeo(visionScore: number, dist_m?: number | null, tau = 800): number {
//     if (dist_m == null) { return 0.9 * visionScore; }
//     const geoPrior = Math.exp(-dist_m / tau);
//     return 0.6 * visionScore + 0.4 * geoPrior;
//   }

//   private async landmarkDetect(imageBuffer: Buffer) {
//     const [resp] = await this.visionClient.landmarkDetection(imageBuffer);
//     return resp.landmarkAnnotations ?? [];
//   }

//   private async webDetect(imageBuffer: Buffer) {
//     const [resp] = await this.visionClient.webDetection(imageBuffer);
//     return resp.webDetection ?? {};
//   }

//   private delay(ms: number): Promise<void> {
//     return new Promise(resolve => setTimeout(resolve, ms));
//   }
  





// private async searchNominatim(
//   entityName: string,
//   userLat?: number,
//   userLon?: number
// ): Promise<GeoResult | null> {
//   const userAgent = 'MyLandmarkApp/1.0 (contact@myapp.com)'; // change to real app + contact
//   const query = encodeURIComponent(entityName);
//   const deltaDeg = 1; // 1° ≈ 111km

//   const buildUrl = (bounded: boolean): string => {
//     let url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;
//     if (bounded && userLat != null && userLon != null) {
//       // viewbox=left,top,right,bottom = lon_min,lat_max,lon_max,lat_min
//       const left   = userLon - deltaDeg;
//       const right  = userLon + deltaDeg;
//       const top    = userLat + deltaDeg;
//       const bottom = userLat - deltaDeg;
//       url += `&viewbox=${left},${top},${right},${bottom}&bounded=1`;
//     }
//     return url;
//   };

//   const tryOnce = async (bounded: boolean): Promise<GeoResult | null> => {
//     const url = buildUrl(bounded);
//     try {
//       const resp = await fetch(url, {
//         method: 'GET',
//         headers: { 'User-Agent': userAgent },
//       });
//       if (!resp.ok) {
//         const text = await resp.text().catch(() => '');
//         console.error(
//           `Nominatim error for '${entityName}' (bounded=${bounded}):`,
//           resp.status,
//           text.slice(0, 200),
//         );
//         return null;
//       }
//       const places = (await resp.json()) as any[];
//       const place = places?.[0];
//       if (place?.lat && place?.lon) {
//         return {
//           lat: parseFloat(place.lat),
//           lon: parseFloat(place.lon),
//         };
//       }
//       console.log(`Nominatim: no results for '${entityName}' (bounded=${bounded})`);
//       return null;
//     } catch (e) {
//       console.error(`Nominatim request failed for '${entityName}' (bounded=${bounded})`, e);
//       return null;
//     }
//   };

//   if (userLat != null && userLon != null) {
//     const local = await tryOnce(true);
//     if (local) return local;
//   }

//   const global = await tryOnce(false);
//   if (global) return global;

//   return null;
// }



// private async searchMapbox(
//   entityName: string,
//   userLat?: number,
//   userLon?: number
// ): Promise<GeoResult | null> {
//   const accessToken = process.env.MAPBOX_ACCESS_TOKEN;
//   if (!accessToken) {
//     console.error('MAPBOX_ACCESS_TOKEN is not set; skipping Mapbox');
//     return null;
//   }

//   const query = encodeURIComponent(entityName);
//   const deltaDeg = 0.09; // 1° ≈ 111km; bbox radius around user
//   const FAR_DISTANCE_M = 12_000; // 100km: treat anything beyond this as "wrong place"

//   const buildUrl = (bounded: boolean): string => {
//     let url =
//       `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json` +
//       `?access_token=${accessToken}&limit=1`;

//     if (userLat != null && userLon != null) {
//       // Always bias by proximity
//       url += `&proximity=${userLon},${userLat}`; // lon,lat

//       if (bounded) {
//         // Restrict to a bbox around the user: bbox=minLon,minLat,maxLon,maxLat
//         const minLon = userLon - deltaDeg;
//         const minLat = userLat - deltaDeg;
//         const maxLon = userLon + deltaDeg;
//         const maxLat = userLat + deltaDeg;
//         url += `&bbox=${minLon},${minLat},${maxLon},${maxLat}`;
//       }
//     }

//     return url;
//   };

//   const tryOnce = async (bounded: boolean): Promise<GeoResult | null> => {
//     const url = buildUrl(bounded);
//     try {
//       const resp = await fetch(url);
//       if (!resp.ok) {
//         const text = await resp.text().catch(() => '');
//         console.error(
//           `Mapbox error for '${entityName}' (bounded=${bounded}):`,
//           resp.status,
//           text.slice(0, 200),
//         );
//         return null;
//       }

//       const data = (await resp.json()) as any;
//       const feature = data.features?.[0];
//       if (!feature?.center || feature.center.length < 2) {
//         console.log(`Mapbox: no results for '${entityName}' (bounded=${bounded})`);
//         return null;
//       }

//       const [lon, lat] = feature.center; // [lon, lat]

//       // Optional sanity check: discard results that are extremely far from the user
//       if (userLat != null && userLon != null) {
//         const dist = this.haversine(userLat, userLon, lat, lon);
//         if (dist > FAR_DISTANCE_M) {
//           console.log(
//             `Mapbox result for '${entityName}' (bounded=${bounded}) is ${Math.round(
//               dist,
//             )}m away from user; discarding as wrong location`,
//           );
//           return null;
//         }
//       }

//       return { lat, lon };
//     } catch (e) {
//       console.error(`Mapbox request failed for '${entityName}' (bounded=${bounded})`, e);
//       return null;
//     }
//   };

//   // 1) Try local (bounded) if we know user location
//   if (userLat != null && userLon != null) {
//     const local = await tryOnce(true);
//     if (local) return local;
//   }

//   // 2) Fallback: global (no bbox, still proximity‑biased, but sanity‑checked by distance)
//   const global = await tryOnce(false);
//   if (global) return global;

//   return null;
// }

// private async enrichWebEntity(
//   entityName: string,
//   userLat?: number,
//   userLon?: number
// ): Promise<{ lat: number | null; lon: number | null }> {
//   // 1) Try OSM (Nominatim)
//   const osm = await this.searchNominatim(entityName, userLat, userLon);
//   if (osm) return osm;

//   // 2) Try Mapbox
//   const mb = await this.searchMapbox(entityName, userLat, userLon);
//   if (mb) return mb;

//   // 3) Both OSM and Mapbox failed (or gave too-far results)
//   return { lat: null, lon: null };
// }









// public async recognize(
//   imageBuffer: Buffer,
//   opts: {
//     lat?: number;
//     lon?: number;
//     topK?: number;
//     confidenceThreshold?: number;
//     maxDistanceM?: number;
//   } = {},
// ): Promise<RecognitionResult> {
//   const topK = opts.topK ?? 3;
//   const userLat = opts.lat;
//   const userLon = opts.lon;
//   const confidenceThreshold = opts.confidenceThreshold ?? 0.10;
//   const maxDistanceM = opts.maxDistanceM ?? 10000;

//   const [landmarkAnns, webDetection] = await Promise.all([
//     this.landmarkDetect(imageBuffer),
//     this.webDetect(imageBuffer),
//   ]);

//   const allCandidates: Candidate[] = [];

//   // 2a. Landmarks
//   for (const ann of landmarkAnns) {
//     if (!ann.description) continue;

//     const pLat = ann.locations?.[0]?.latLng?.latitude ?? null;
//     const pLon = ann.locations?.[0]?.latLng?.longitude ?? null;
//     if (pLat == null || pLon == null) continue;

//     const visionScore = Number(ann.score ?? 0);
//     const dist =
//       userLat != null && userLon != null
//         ? this.haversine(userLat, userLon, pLat, pLon)
//         : null;

//     allCandidates.push({
//       name: ann.description,
//       score: visionScore,
//       lat: pLat,
//       lon: pLon,
//       dist_m: dist,
//       source: 'google_vision_landmark',
//       finalScore: this.scoreWithGeo(visionScore, dist),
//     });
//   }

//   // 2b. Web entities
//   const webEntities = webDetection.webEntities ?? [];
//   for (const entity of webEntities) {
//     if (!entity.description || !entity.score || entity.score < 0.1) continue;

//     const visionScore = Number(entity.score);
//     const { lat: pLat, lon: pLon } = await this.enrichWebEntity(
//       entity.description,
//       userLat,
//       userLon,
//     );

//     const dist =
//       userLat != null && userLon != null && pLat != null && pLon != null
//         ? this.haversine(userLat, userLon, pLat, pLon)
//         : null;

//     allCandidates.push({
//       name: entity.description,
//       score: visionScore,
//       lat: pLat,
//       lon: pLon,
//       dist_m: dist,
//       source: 'google_vision_web',
//       finalScore: this.scoreWithGeo(visionScore, dist),
//     });

//     await this.delay(1100);
//   }

//   console.log('All candidates:', allCandidates);

//   // 3. Filter by distance: require dist_m != null, dist_m > 0, dist_m <= maxDistanceM
//   let distanceFiltered: Candidate[];
//   if (userLat != null && userLon != null) {
//     distanceFiltered = allCandidates.filter(
//       c => c.dist_m != null && c.dist_m > 0 && c.dist_m <= maxDistanceM,
//     );

//     const hasAnyWithDistance = allCandidates.some(c => c.dist_m != null);

//     if (hasAnyWithDistance && distanceFiltered.length === 0) {
//       return {
//         status: 'FAILURE',
//         reason: 'OUT_OF_ZONE',
//         message: 'You are out of zone. Please come in 10KM radius',
//       };
//     }
//   } else {
//     distanceFiltered = allCandidates;
//   }

//   console.log('distanceFiltered:', distanceFiltered);

//   // 4. De‑duplicate by name, rank, confidence filter
//   const bestByName = new Map<string, Candidate>();
//   for (const candidate of distanceFiltered) {
//     const key = candidate.name.trim().toLowerCase();
//     const existing = bestByName.get(key);
//     if (!existing || candidate.finalScore > existing.finalScore) {
//       bestByName.set(key, candidate);
//     }
//   }

//   const ranked = Array.from(bestByName.values())
//     .sort((a, b) => b.finalScore - a.finalScore)
//     .filter(c => c.finalScore >= confidenceThreshold);

//   if (ranked.length === 0) {
//     return {
//       status: 'FAILURE',
//       reason: 'NOT_FOUND',
//       message: 'Building not recognized. Please try again from a different angle.',
//     };
//   }

//   return {
//     status: 'SUCCESS',
//     data: ranked.slice(0, topK).map(({ finalScore, ...result }) => result),
//   };
// }





































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


// private async mirrorImageToLocal(remoteUrl: string, filename?: string): Promise<string | null> {
//   try {
//     const uploaded = await this.downloadAndStoreImage(
//       remoteUrl,
//       undefined,                // no placeId here
//       filename || 'wikipedia',  // only for naming the file
//     );
//     return uploaded.localUrl;
//   } catch (e: any) {
//     console.warn('[mirrorImageToLocal] failed:', e?.message || e);
//     return null;
//   }
// }



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

// async getDetail(
//   PlaceName: string,
//   opts: { longDescriptionChars?: number; lang?: string } = {}
// ) {
//   const { longDescriptionChars = 1500, lang = 'en' } = opts;

//   const parseWikidataPoint = (wkt?: string) => {
//     if (!wkt) return null;
//     const m = wkt.match(/Point\(([-\d.]+)\s+([-\d.]+)\)/);
//     return m ? { lat: Number(m[2]), lon: Number(m[1]) } : null;
//   };
//   const toNumber = (v?: string) => {
//     if (v == null) return undefined;
//     const n = Number(v);
//     return Number.isFinite(n) ? n : undefined;
//   };

//   try {
//     // Resolve canonical Wikipedia title first
//     const resolved = await this.resolveWikipedia(PlaceName, lang);
//     if (!resolved) {
//       return {
//         status: 404,
//         statusMessage: 'not_found',
//         data: `No "${PlaceName}" data is found on Wikipedia`,
//       };
//     }
//     const resolvedTitle = resolved.title;
//     const wikiData = resolved.summary;

//     // Longer description
//     let longDescription = '';
//     try {
//       const extractRes = await this.wiki.get(`https://${lang}.wikipedia.org/w/api.php`, {
//         params: {
//           action: 'query',
//           prop: 'extracts',
//           explaintext: 1,
//           exchars: longDescriptionChars,
//           redirects: 1,
//           titles: resolvedTitle,
//           format: 'json',
//           origin: '*',
//         },
//       });
//       const pages = extractRes.data?.query?.pages;
//       const firstKey = pages ? Object.keys(pages)[0] : undefined;
//       longDescription = firstKey ? pages[firstKey]?.extract || '' : '';
//     } catch (e: any) {
//       console.warn('Extended description fetch failed:', e?.message || e);
//     }

//     // Wikidata enrichment
//     let wd = {
//       qid: wikiData.wikibase_item || '',
//       instance_of: '',
//       countries: [] as string[],
//       administrative_areas: [] as string[],
//       ranges: [] as string[],
//       elevation_m: undefined as number | undefined,
//       height_m: undefined as number | undefined,
//       prominence_m: undefined as number | undefined,
//       isolation_km: undefined as number | undefined,
//       architects: [] as string[],
//       coordinates: null as null | { lat: number; lon: number },
//     };

//     if (wikiData.wikibase_item) {
//       const qid = wikiData.wikibase_item;
//       const sparqlQuery = `
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

//       let sparqlWorked = false;

//       try {
//         const sparqlResponse = await axios.get('https://query.wikidata.org/sparql', {
//           headers: {
//             Accept: 'application/sparql-results+json',
//             'User-Agent': this.WIKI_UA,
//           },
//           params: { query: sparqlQuery },
//           timeout: 12000,
//         });

//         const rows = sparqlResponse.data?.results?.bindings ?? [];

//         const countriesSet = new Set<string>();
//         const adminsSet = new Set<string>();
//         const rangesSet = new Set<string>();
//         const instancesSet = new Set<string>();
//         const architectsSet = new Set<string>();

//         let coord: { lat: number; lon: number } | null = null;
//         let elevation_m: number | undefined;
//         let height_m: number | undefined;
//         let prominence_m: number | undefined;
//         let isolation_km: number | undefined;

//         for (const b of rows) {
//           if (b.countryLabel?.value) countriesSet.add(b.countryLabel.value);
//           if (b.adminLabel?.value) adminsSet.add(b.adminLabel.value);
//           if (b.range1Label?.value) rangesSet.add(b.range1Label.value);
//           if (b.range2Label?.value) rangesSet.add(b.range2Label.value);
//           if (b.instanceLabel?.value) instancesSet.add(b.instanceLabel.value);
//           if (b.architectLabel?.value) architectsSet.add(b.architectLabel.value);

//           if (!coord && b.coord?.value) coord = parseWikidataPoint(b.coord.value);
//           if (elevation_m === undefined && b.elev?.value) elevation_m = toNumber(b.elev.value);
//           if (height_m === undefined && b.height?.value) height_m = toNumber(b.height.value);
//           if (prominence_m === undefined && b.prom?.value)
//             prominence_m = toNumber(b.prom.value);
//           if (isolation_km === undefined && b.iso?.value) isolation_km = toNumber(b.iso.value);
//         }

//         wd = {
//           qid,
//           instance_of: Array.from(instancesSet).join(', '),
//           countries: Array.from(countriesSet),
//           administrative_areas: Array.from(adminsSet),
//           ranges: Array.from(rangesSet),
//           elevation_m,
//           height_m,
//           prominence_m,
//           isolation_km,
//           architects: Array.from(architectsSet),
//           coordinates: coord,
//         };

//         sparqlWorked = true;
//       } catch (sparqlErr: any) {
//         console.warn('Wikidata SPARQL failed:', sparqlErr?.message || sparqlErr);
//       }

//       if (
//         !sparqlWorked ||
//         (!wd.countries.length &&
//           !wd.administrative_areas.length &&
//           !wd.height_m &&
//           !wd.elevation_m)
//       ) {
//         const apiFallback = await this.fetchWikidataViaAPI(qid);
//         if (apiFallback) {
//           wd = {
//             qid,
//             instance_of: apiFallback.instance_of || wd.instance_of,
//             countries: apiFallback.countries?.length
//               ? apiFallback.countries
//               : wd.countries,
//             administrative_areas: apiFallback.administrative_areas?.length
//               ? apiFallback.administrative_areas
//               : wd.administrative_areas,
//             ranges: apiFallback.ranges?.length ? apiFallback.ranges : wd.ranges,
//             elevation_m: apiFallback.elevation_m ?? wd.elevation_m,
//             height_m: apiFallback.height_m ?? wd.height_m,
//             prominence_m: apiFallback.prominence_m ?? wd.prominence_m,
//             isolation_km: apiFallback.isolation_km ?? wd.isolation_km,
//             architects: apiFallback.architects?.length
//               ? apiFallback.architects
//               : wd.architects,
//             coordinates: apiFallback.coordinates ?? wd.coordinates,
//           };
//         }
//       }
//     }

//     const coords =
//       wd.coordinates ||
//       (wikiData.coordinates
//         ? { lat: wikiData.coordinates.lat, lon: wikiData.coordinates.lon }
//         : null);

//     const baseName = wikiData.title || resolvedTitle;

//     // Build candidates: same-lang page gallery
//     const sameLangGallery = await this.fetchPageGallery(resolvedTitle, lang, 100);

//     // Cross-language galleries (from other Wikipedia language pages)
//     let crossLang: WikiImage[] = [];
//     if (wikiData.wikibase_item) {
//       crossLang = await this.fetchCrossLangGalleries(
//         wd.qid || wikiData.wikibase_item,
//       ).catch(() => []);
//     }

//     // Commons images (category + subcategories + gallery)
//     let commonsImages: WikiImage[] = [];
//     if (wikiData.wikibase_item) {
//       const commonsLinks = await this.fetchCommonsLinksFromWikidata(
//         wd.qid || wikiData.wikibase_item,
//       );

//       // Category root + subcats (paginated)
//       const catDeepChunks = await this.mapWithConcurrency(
//         commonsLinks.categories.slice(0, 2),
//         this.MAX_CONCURRENCY,
//         c =>
//           this.fetchCommonsCategoryImagesDeep(c, 200, 5).catch(() => []),
//       );
//       for (const arr of catDeepChunks) commonsImages.push(...arr);

//       // Galleries
//       const galImgsChunks = await this.mapWithConcurrency(
//         commonsLinks.galleries.slice(0, 2),
//         this.MAX_CONCURRENCY,
//         g => this.fetchCommonsGalleryImages(g, 200).catch(() => []),
//       );
//       for (const arr of galImgsChunks) commonsImages.push(...arr);
//     }

//     // Merge + dedupe initial pool
//     let allCandidates: WikiImage[] = [...sameLangGallery, ...crossLang, ...commonsImages];
//     allCandidates = this.dedupeImages(allCandidates);

//     // If still likely low, search Commons by title as a fallback
//     if (allCandidates.length < this.MIN_IMAGES) {
//       const searchImgs = await this.fetchCommonsSearchImages(baseName, 200).catch(
//         () => [],
//       );
//       allCandidates = this.dedupeImages([...allCandidates, ...searchImgs]);
//     }

//     // Select diverse set with fallback to looser filter if needed
//     let diverse = this.selectDiverseImages(
//       allCandidates,
//       baseName,
//       this.MIN_IMAGES,
//       16,
//     );
//     if (diverse.length < this.MIN_IMAGES) {
//       const loosePick = this.selectDiverseImages(
//         allCandidates,
//         baseName,
//         this.MIN_IMAGES,
//         16,
//         img => !this.looksBadForBuildingLoose(img),
//       );
//       if (loosePick.length > diverse.length) diverse = loosePick;
//     }

//     // Final fill to ensure we reach MIN_IMAGES if still short
//     if (diverse.length < this.MIN_IMAGES) {
//       const seen = new Set<string>(
//         diverse.map(i => ((i.sha1 || i.original) || '').toLowerCase()),
//       );
//       for (const img of allCandidates) {
//         const key = ((img.sha1 || img.original) || '').toLowerCase();
//         if (!seen.has(key)) {
//           diverse.push(img);
//           seen.add(key);
//         }
//         if (diverse.length >= this.MIN_IMAGES) break;
//       }
//     }

//     // Lead image: prefer summary lead if good
//     const summaryLead = wikiData?.originalimage?.source
//       ? ({
//           title: `File:${baseName}.jpg`,
//           original: wikiData.originalimage.source,
//           thumb: wikiData.thumbnail?.source || wikiData.originalimage.source,
//           width: undefined,
//           height: undefined,
//           mime: undefined,
//           mediatype: 'BITMAP',
//           sha1: undefined,
//         } as WikiImage)
//       : null;

//     const lead =
//       summaryLead && !this.looksBadForBuilding(summaryLead)
//         ? summaryLead
//         : diverse[0] || summaryLead || null;

//     // IMPORTANT: do NOT mirror / download images here.
//     const localLeadOriginal: string | null = null;
//     const localLeadThumb: string | null = null;

//     const galleryWithLocal = diverse
//       .slice(0, Math.max(this.MIN_IMAGES, Math.min(12, diverse.length)))
//       .map(img => ({
//         title: img.title,
//         original: img.original,
//         thumbnail: img.thumb || img.original,

//         // "local" fields are just remote URLs for now.
//         // Real local URLs will be created in upsertPlaceFromDetail.
//         local_original: img.original,
//         local_thumbnail: img.thumb || img.original,
//         localOriginal: img.original,
//         localThumbnail: img.thumb || img.original,
//       }));

//     const data = {
//       title: wikiData.title || resolvedTitle,
//       description_short: wikiData.extract || '',
//       description_html: wikiData.extract_html || '',
//       description_long: longDescription,
//       page_url: wikiData.content_urls?.desktop?.page || '',
//       images: {
//         thumbnail: lead?.thumb || wikiData.thumbnail?.source || '',
//         original: lead?.original || wikiData.originalimage?.source || '',

//         // For convenience, mirror remote URLs here; they'll be replaced
//         // with real local URLs in upsertPlaceFromDetail.
//         local_thumbnail: localLeadThumb || lead?.thumb || wikiData.thumbnail?.source || '',
//         local_original: localLeadOriginal || lead?.original || wikiData.originalimage?.source || '',
//         localThumbnail: localLeadThumb || lead?.thumb || wikiData.thumbnail?.source || '',
//         localOriginal: localLeadOriginal || lead?.original || wikiData.originalimage?.source || '',

//         gallery: Array.isArray(galleryWithLocal) ? galleryWithLocal : [],
//       },
//       coordinates: coords,
//       wikidata: wd,
//     };

//     return { status: 200, statusMessage: 'success', data };
//   } catch (err: any) {
//     console.warn('Wikipedia lookup failed:', err?.message || err);
//     return {
//       status: err?.response?.status || 500,
//       statusMessage: 'error',
//       data: 'Error fetching data',
//     };
//   }
// }







//     private buildFileUrl(fileId: string) {
// const base = (process.env.APP_URL ?? 'https://scanitectai.com/api').replace(/\/+$/, '');
// return `${base}/files/${fileId}`;
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
//       // Use the SAME UA that works for your Wikipedia API calls
//       'User-Agent': this.WIKI_UA,
//       'Accept': 'image/*,*/*;q=0.8',
//       // Optional but often helps:
//       // 'Referer': 'https://scanitectai.com/',
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

//   return {
//     fileId,
//     localUrl: this.buildFileUrl(fileId),
//     mimeType,
//     filename,
//   };
// }



// private async downloadAndStoreImageWithThumbnail(
//   imageUrl: string,
//   placeId?: string,
//   placeName?: string,
// ) {
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

//   // 1) Download ORIGINAL once as a buffer
//   const resp = await axios.get(imageUrl, {
//     responseType: 'arraybuffer',      // buffer, not stream (we need it twice)
//     timeout: 20000,
//     maxBodyLength: Infinity,
//     maxContentLength: Infinity,
//     validateStatus: (s) => s >= 200 && s < 400,
//     headers: {
//       'User-Agent': this.WIKI_UA,
//       'Accept': 'image/*,*/*;q=0.8',
//     },
//   });

//   const rawType = String(resp.headers['content-type'] || 'image/jpeg').toLowerCase();
//   const mimeType = rawType.split(';')[0].trim();
//   if (!allowedMimes.has(mimeType)) {
//     throw new Error(`Unsupported image type from Wikipedia: ${mimeType}`);
//   }

//   const originalBuffer = Buffer.from(resp.data);
//   const ext = this.extFromUrl(imageUrl) || this.extFromMime(mimeType) || 'jpg';
//   const baseName = `${this.sanitizeFilename(placeName || 'place')}-${Date.now()}`;

//   // 2) Upload ORIGINAL
//   const originalFilename = `${baseName}.${ext}`;
//   const { fileId: originalId } = await this.filesService.uploadFromStream(
//     Readable.from(originalBuffer),
//     originalFilename,
//     mimeType,
//     { source: 'wikipedia', variant: 'original', imageUrl, placeId, placeName },
//     'avatars',
//   );
//   const originalUrl = this.buildFileUrl(originalId);

//   // 3) Create SMALLER THUMBNAIL from the same buffer
//   //    Adjust width / quality as you like (this is where you "downgrade").
// const thumbBuffer = await sharp(originalBuffer)
//   .resize({ width: 512 })
//   .jpeg({ quality: 70 })
//   .toBuffer();
//   const thumbFilename = `${baseName}-thumb.jpg`;
//   const { fileId: thumbId } = await this.filesService.uploadFromStream(
//     Readable.from(thumbBuffer),
//     thumbFilename,
//     'image/jpeg',
//     {
//       source: 'wikipedia',
//       variant: 'thumbnail',
//       imageUrl,
//       placeId,
//       placeName,
//       originalFileId: originalId,
//     },
//     'avatars',
//   );
//   const thumbnailUrl = this.buildFileUrl(thumbId);

//   return {
//     originalUrl,
//     thumbnailUrl,
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

//   console.log('the existing', existing);

//   // Remote URLs from payload (remote Wikipedia URLs)
//   const remoteOriginalUrl: string | undefined =
//     this.pickHttpUrl(detail?.images?.original) || this.extractImageUrl(detail);

//   const remoteThumbUrl: string | undefined =
//     this.pickHttpUrl(detail?.images?.thumbnail) || this.pickHttpUrl(detail?.thumbnail);

//   console.log('the detail', detail);
//   console.log('the remoteOriginalUrl', remoteOriginalUrl);

//   let localOriginalUrl: string | undefined = existing?.images?.local_original;
//   let localThumbnailUrl: string | undefined = existing?.images?.local_thumbnail;
//   console.log('the localOriginalUrl', localOriginalUrl, 'ffffffffff', localThumbnailUrl);

//   const existingId = existing?._id ? String(existing._id) : undefined;

//   // === Only download ONE real image: the ORIGINAL ===
//   // Never download the /thumb/ URL, only the /commons/... original.
// // === Only download ORIGINAL once, then create a smaller local thumbnail ===
// const sourceForLocal: string | undefined =
//   this.isHttpUrl(remoteOriginalUrl) ? remoteOriginalUrl : undefined;

// if (sourceForLocal) {
//   const needsNewLocal =
//     existing?.images?.original !== remoteOriginalUrl ||
//     !existing?.images?.local_original ||
//     !existing?.images?.local_thumbnail;

//   if (needsNewLocal) {
//     console.log('[upsert] downloading & resizing image from', sourceForLocal);
//     try {
//       const uploaded = await this.downloadAndStoreImageWithThumbnail(
//         sourceForLocal,
//         existingId,
//         placeName,
//       );
//       localOriginalUrl = uploaded.originalUrl;
//       localThumbnailUrl = uploaded.thumbnailUrl;
//       console.log('[upsert] saved local original', uploaded.originalUrl);
//       console.log('[upsert] saved local thumbnail', uploaded.thumbnailUrl);
//     } catch (e: any) {
//       console.warn('[upsert] Local image+thumb save failed:', e?.message || e);
//     }
//   }
// }



//   // === Coordinates (GeoJSON [lon, lat]) ===
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
//   const administrativeAreas = toArray(
//     wd.administrative_areas ?? wd.administrativeAreas,
//   );
//   const ranges = toArray(wd.ranges);
//   const architects = toArray(wd.architects);
//   const height_m = wd.height_m; // keep as-is (number or undefined)

//   // === Build images object for DB ===
//   const images: Record<string, any> = {};
//   if (remoteOriginalUrl) images.original = remoteOriginalUrl;
//   if (remoteThumbUrl) images.thumbnail = remoteThumbUrl;
//   if (localOriginalUrl) images.local_original = localOriginalUrl;
//   if (localThumbnailUrl) images.local_thumbnail = localThumbnailUrl;

//   // === Build update (do NOT $set title; only set on insert) ===
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
//     const response = await this.placeModel
//       .findOneAndUpdate(filter, update, opts)
//       .lean() as PlaceResponse;

//     console.log('the response', response);

//     const filteredDetail = {
//       id: response?._id,
//       title: response?.title,

//       // Remote Wikipedia URLs
//       wikipediaThumbImage: response?.images?.thumbnail,
//       wikipediaOriginalImage: response?.images?.original,

//       // Your local URLs (both from the same local file)
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

//     return filteredDetail;
//   } catch (e: any) {
//     // In case of race with unique qid, retry
//     if (e?.code === 11000 && qid) {
//       return await this.placeModel.findOneAndUpdate(filter, update, opts);
//     }
//     throw e;
//   }
// }























 async findPlaceDetail ( PlaceName: string){
  console.log("the place name",PlaceName )


const getDetail = await this.placeModel.findOne({ title: PlaceName }).lean() as PlaceResponse;

console.log("the get detail is thisssssss",getDetail )

if(getDetail){


const filteredDetail = {
      id :  getDetail?._id,
      title: getDetail?.title,
         wikipediaThumbImage:getDetail?.images?.thumbnail,
      // wikipediaOriginalImage:getDetail?.images?.original,
      thumbnailImage: getDetail?.images?.local_thumbnail,
      // originalImage: getDetail?.images?.local_original,
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




  // async getScansSummary(scanIds: string[]) {
  //   try {
  //     const scans = await this.placeModel.find({
  //       _id: { $in: scanIds },
  //     }).lean();

  //     // Map to simplified result
  //     const result = scans.map(scan => ({
  //       id: scan._id,
  //       title: scan?.title ?? 'N/A',
  //       image: scan.images?.local_thumbnail ?? scan.images?.local_original,
  //       country: scan.wikidata?.countries?.[0] ?? 'Unknown',
  //       instanceOf: scan.wikidata?.instanceOf?.[0] ?? 'Unknown',
  //     }));

  //     return {
  //       status: 200,
  //       message: 'Fetched scan summaries successfully',
  //       scans: result,
  //     };
  //   } catch (error) {
  //     console.error('Error fetching scans summary:', error);
  //     return {
  //       status: 500,
  //       message: 'Error fetching scans summary',
  //       error: error.message,
  //     };
  //   }
  // }







//   async getScansDetails(scanId: string) {
//   try {
//     console.log("the scanId", scanId);

//     const response = await this.placeModel.findOne({ _id: scanId }).lean() as PlaceResponse; // 👈 important

//     if (!response) {
//       return {
//         status: 404,
//         message: 'Scan not found',
//       };
//     }

//     console.log("the thumb", response?.images?.local_thumbnail);

//     const filterDocument = {
//         id :  response?._id,
//       title: response?.title,
//       wikipediaThumbImage:response?.images?.thumbnail,
//       wikipediaOriginalImage:response?.images?.original,
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

//     return {
//       status: 200,
//       message: 'Fetched scan details successfully',
//       scanDetail: filterDocument,
//     };
//   } catch (err) {
//     console.log("the error", err);
//     return {
//       status: 500,
//       message: 'Error fetching scans details',
//       error: err.message,
//     };
//   }
// }











//   private readonly headers = {
//     'User-Agent': 'YourAppName/1.0 (contact: you@example.com)',
//     'Accept': 'application/json',
//   };

//   private cleanLabel(label: string): string {
//     return label
//       .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // accents
//       .replace(/[’‘]/g, "'")
//       .replace(/\bmoussallem\b/gi, 'mausoleum') // common misspelling
//       .replace(/\s+/g, ' ')
//       .trim();
//   }

//   // 1) Wikidata search → QID (primary path)
//   private async tryWikidataSearch(query: string, lang = 'en'): Promise<string | null> {
//     const url = 'https://www.wikidata.org/w/api.php';
//     const params = {
//       action: 'wbsearchentities',
//       format: 'json',
//       language: lang,
//       type: 'item',
//       limit: '5',
//       search: query,
//       // origin: '*' // only needed for browser; server-side can omit
//     };
//     try {
//       const res = await firstValueFrom(this.http.get(url, { params, headers: this.headers }));
//       const hits = res.data?.search || [];
//       if (hits.length) {
//         // Optional: log top hits for debugging
//         // console.log('Wikidata hits:', hits.map((h: any) => `${h.id} | ${h.label} | ${h.description}`));
//         return hits[0].id as string;
//       }
//       return null;
//     } catch (e: any) {
//       console.error('Wikidata search error:',
//         e?.response?.status,
//         e?.response?.statusText,
//         e?.message,
//         e?.response?.data
//       );
//       return null;
//     }
//   }

//   // 2) Wikipedia search → title
//   private async wikipediaSearchTitle(query: string, lang = 'en'): Promise<string | null> {
//     const url = `https://${lang}.wikipedia.org/w/api.php`;
//     const params = {
//       action: 'query',
//       format: 'json',
//       list: 'search',
//       srsearch: query,
//       srlimit: '5',
//       srwhat: 'nearmatch',
//       srenablerewrites: '1',
//       utf8: '1',
//     };
//     try {
//       const res = await firstValueFrom(this.http.get(url, { params, headers: this.headers }));
//       const hits = res.data?.query?.search || [];
//       return hits.length ? hits[0].title as string : null;
//     } catch (e: any) {
//       console.error('Wikipedia search error:',
//         e?.response?.status,
//         e?.response?.statusText,
//         e?.message,
//         e?.response?.data
//       );
//       return null;
//     }
//   }

//   // 3) From a Wikipedia title → QID via pageprops
//   private async qidFromWikipediaTitle(title: string, lang = 'en'): Promise<string | null> {
//     const url = `https://${lang}.wikipedia.org/w/api.php`;
//     const params = {
//       action: 'query',
//       format: 'json',
//       prop: 'pageprops',
//       ppprop: 'wikibase_item',
//       titles: title,
//       utf8: '1',
//     };
//     try {
//       const res = await firstValueFrom(this.http.get(url, { params, headers: this.headers }));
//       const pages = res.data?.query?.pages || {};
//       const firstPage: any = Object.values(pages)[0];
//       return firstPage?.pageprops?.wikibase_item || null;
//     } catch (e: any) {
//       console.error('Wikipedia pageprops error:',
//         e?.response?.status,
//         e?.response?.statusText,
//         e?.message,
//         e?.response?.data
//       );
//       return null;
//     }
//   }

//   // Public: returns QID or null
//   async getQidFromLabel(noisyLabel: string, lang = 'en'): Promise<string | null> {
//     if (!noisyLabel?.trim()) return null;

//     // A) Wikidata search (as-is)
//     let qid = await this.tryWikidataSearch(noisyLabel, lang);
//     if (qid) return qid;

//     // B) Wikidata search (cleaned)
//     const cleaned = this.cleanLabel(noisyLabel);
//     if (cleaned && cleaned !== noisyLabel) {
//       qid = await this.tryWikidataSearch(cleaned, lang);
//       if (qid) return qid;
//     }

//     // C) Wikipedia fallback: search → pageprops → QID
//     let title = await this.wikipediaSearchTitle(noisyLabel, lang);
//     if (!title && cleaned) {
//       title = await this.wikipediaSearchTitle(cleaned, lang);
//     }
//     if (title) {
//       qid = await this.qidFromWikipediaTitle(title, lang);
//       if (qid) return qid;
//     }

//     return null;
//   }




// async searchTitle(label: string): Promise<WikipediaResult> {
//   try {
//     console.log("the query", label);

//     const response = await axios.get('https://en.wikipedia.org/w/api.php', { 
//       params: { 
//         action: 'query', 
//         list: 'search', 
//         srsearch: label, 
//         format: 'json', 
//       },
//        headers: { 
//         'User-Agent': 'NestJS Wikipedia Search/1.0 (example@example.com)', // add a proper User-Agent 
//         }, 
//       });


//     // console.log("Response data:", response);

//     const searchResults = response.data?.query?.search;

//     console.log("thge search result", searchResults )

//     if (!searchResults || searchResults.length === 0) {
//       return {
//         status: 404,
//         message: 'No results found',
//       };
//     }

//     return {
//       status: 200,
//       message: 'Successfully fetched correct name',
//       title: searchResults[0].title,
//     };
//   } catch (error: any) {
//     console.error("Axios error:", error);
//     return {
//       status: 500,
//       message: 'Error fetching to search this name',
//       error: error.message,
//     };
//   }
// }






































 private readonly wpBaseUrl ='https://ladiesinnersense.com/';
  private readonly wpUser = 'admin';
  private readonly wpAppPassword =  'NoAC 8Qs7 UBTX hPAK 3ezz 8p38';



  private scoreVisualMatch(m: any, label?: string | null): number {
    let score = 0;

    const titleRaw = m.title || m.name || m.link_title || '';
    const title = titleRaw.toLowerCase();
    const link = m.link || '';

    let host = '';
    try {
      host = new URL(link).hostname.toLowerCase(); // Node's global URL
    } catch {
      host = '';
    }

    const goodDomains = [
  'wikipedia.org',
    ];

    const badDomains = [
      'shutterstock.com',
      'istockphoto.com',
      'dreamstime.com',
      'alamy.com',
      'pexels.com',
      'unsplash.com',
      'facebook.com',
      'instagram.com',
      'pinterest.com',
      'flickr.com',
    ];

    if (goodDomains.some((d) => host.endsWith(d))) score += 8;
    if (badDomains.some((d) => host.endsWith(d))) score -= 5;

    if (
      /\b(condo|apartments?|residence|tower|building|skyscraper|street|st\.?|avenue|ave\.?|boulevard|blvd\.?|plaza|block)\b/.test(
        title,
      )
    ) {
      score += 4;
    }

    if (/\b\d+\s+\w+(\s+(street|st|avenue|ave|road|rd|boulevard|blvd|place|plaza))?\b/i.test(titleRaw)) {
      score += 4;
    }

    if (label) {
      const l = label.toLowerCase();
      if (title.includes(l)) {
        score += 20;
      } else {
        const lWords = l.split(/\s+/).filter((w) => w.length > 3);
        const tWords = new Set(title.split(/[^\w]+/));
        const overlap = lWords.filter((w) => tWords.has(w)).length;
        score += overlap * 3;
      }
    }

    if (typeof m.position === 'number') {
      const posBonus = Math.max(-3, 3 - (m.position - 1) * 0.2);
      score += posBonus;
    }

    return score;
  }




 async uploadMediaFromBuffer(
    buf: Buffer,
    filename = 'image.jpg',
    mimeType = 'image/jpeg',
  ): Promise<string> {
    // use the alias, not the global FormData
    const form = new NodeFormData();

    form.append('file', buf, {
      filename,
      contentType: mimeType,
    });

    const authToken = Buffer.from(
      `${this.wpUser}:${this.wpAppPassword}`,
    ).toString('base64');

    try {
      const { data } = await axios.post(
        `${this.wpBaseUrl}/wp-json/wp/v2/media`,
        form,
        {
          headers: {
            ...form.getHeaders(),           // now exists
            Authorization: `Basic ${authToken}`,
          },
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        },
      );

      if (!data?.source_url) {
        throw new InternalServerErrorException(
          'WordPress did not return a media URL',
        );
      }

      return data.source_url as string;
    } catch (err: any) {
      console.error(
        '[WordpressService] upload error:',
        err?.response?.data || err?.message || err,
      );
      throw new InternalServerErrorException(
        err?.message || 'Failed to upload image to WordPress',
      );
    }
  }


  



async recognizeWithGoogleLens(
  buf: Buffer,
): Promise<{
  first: any;
  raw: any;
  imageUrl: string;
  label: string | null;
  lowConfidence: boolean;
}> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) throw new Error('SERPAPI_KEY is not configured');

  const filename = `lens-${Date.now()}.jpg`;
  const mimeType = 'image/jpeg';
  const imageUrl = await this.uploadMediaFromBuffer(buf, filename, mimeType);

  const { data } = await axios.get('https://serpapi.com/search.json', {
    params: { engine: 'google_lens', url: imageUrl, api_key: apiKey },
    timeout: 50000,
  });

  console.log("the data", data)

  const visualMatches: any[] =
    data?.visual_matches ??
    data?.image_results ??
    [];

  const hasKg = !!data?.knowledge_graph;
  const hasRelated =
    Array.isArray(data?.related_content) &&
    data.related_content.length > 0;

  // If Google didn’t produce KG or related content, we treat as low confidence
  const lowConfidence = !hasKg && !hasRelated;

  // Label only from KG / related_content (not from visual_matches)
  const kgTitle =
    data?.knowledge_graph?.title ||
    data?.knowledge_graph?.name ||
    null;

  const relatedQuery =
    data?.related_content?.[0]?.query ||
    null;

  const label: string | null = kgTitle || relatedQuery || null;

  // Use your scoring logic here (shortened for brevity)
  let first: any = null;
  if (visualMatches.length > 0) {
    const candidates = visualMatches.slice(0, 40);
    candidates.sort(
      (a, b) =>
        this.scoreVisualMatch(b, label) - this.scoreVisualMatch(a, label),
    );
    first = candidates[0];
  }

  return { first, raw: data, imageUrl, label, lowConfidence };
}






async upsertPlaceFromLens(
  lensResult: {
    first: any;
    imageUrl: string;
    gpt: ChatGptBuildingInfo | null;
    googlePlace?: any | null;           // GooglePlaceBasic if you type it
    googlePlacePhotoUrls?: string[];    // raw URLs from Places
    googleNearby?: any[];               // NearbyThing[] if you type it
  },
) {
  const {
    first,
    imageUrl,
    gpt,
    googlePlace,
    googlePlacePhotoUrls = [],
    googleNearby = [],
  } = lensResult;

  const titleFromLens: string =
    first?.title ||
    first?.name ||
    first?.link_title ||
    first?.query ||
    'Unknown building';

  // prefer GPT cleaned name, then Google Place name, then Lens title
  const title: string =
    (gpt?.name && gpt.name.trim()) ||
    (googlePlace?.name && String(googlePlace.name)) ||
    titleFromLens;

  const lensThumbnail: string =
    first?.thumbnail ||
    first?.thumbnail_url ||
    first?.thumbnail?.source ||
    first?.thumbnail?.link ||
    imageUrl;

  // Prefer Google Places coordinates if available, else GPT coordinates
  let coordinates: { type: 'Point'; coordinates: [number, number] } | undefined;

  if (googlePlace && typeof googlePlace.lat === 'number' && typeof googlePlace.lon === 'number') {
    coordinates = {
      type: 'Point',
      coordinates: [googlePlace.lon, googlePlace.lat],
    };
  } else if (gpt && gpt.latitude != null && gpt.longitude != null) {
    coordinates = {
      type: 'Point',
      coordinates: [Number(gpt.longitude), Number(gpt.latitude)],
    };
  }

  // AI / GPT info
  const aiInfo = gpt
    ? {
        title: gpt.name || title,
        shortDescription: gpt.shortDescription || '',
        tourismDescription: gpt.tourismDescription || '',
        funFacts: gpt.funFacts || [],
        heightMeters: gpt.heightMeters ?? null,
        latitude: gpt.latitude ?? null,
        longitude: gpt.longitude ?? null,
        architectureStyle: gpt.architectureStyle || '',
        architectName: (gpt as any).architectName || '',
        location: (gpt as any).location || '',
      }
    : {};

  const update: any = {
    title,
    // scanned image from Lens upload
    'images.original': imageUrl,
    'images.thumbnail': lensThumbnail,
    descriptionShort: gpt?.shortDescription || '',
    descriptionLong: gpt?.tourismDescription || '',
    ai: aiInfo,
    raw: {
      lensFirst: first,
      gpt,
      googlePlace: googlePlace || null,
      googleNearby: googleNearby || [],
    },
  };

  if (coordinates) {
    update.coordinates = coordinates;
  }

  // Build gallery URLs: 2 UNIQUE Google photo URLs
  if (googlePlacePhotoUrls.length) {
    const uniqueUrls = Array.from(new Set(googlePlacePhotoUrls)).slice(0, 2);

    update.gallery = {
      firstGooglePlace: uniqueUrls[0] ?? null,
      secondGooglePlace: uniqueUrls[1] ?? null,
    };
  } else {
    // ensure gallery exists even if empty
    update.gallery = {
      firstGooglePlace: null,
      secondGooglePlace: null,
    };
  }

  // Optional: store simplified nearby items in a top-level 'nearby' array
  if (googleNearby.length) {
    update.nearby = googleNearby.map((n: any) => ({
      placeId: n.placeId,
      title: n.name,
      types: n.types,
      distanceMeters: Math.round(n.distanceMeters ?? 0),
      latitude: n.lat,
      longitude: n.lon,
    }));
  }

  const placeDoc = await this.placeModel.findOneAndUpdate(
    { title },
    { $set: update },
    { new: true, upsert: true },
  );

  return placeDoc;
}









  public distanceKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const R = 6371; // Earth radius in km

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }





  async getAreaNameFromCoords(
  lat: number,
  lon: number,
): Promise<string | null> {
  const url = 'https://nominatim.openstreetmap.org/reverse';

  const { data } = await axios.get(url, {
    params: {
      lat,
      lon,
      format: 'jsonv2',
      addressdetails: 1,
      zoom: 16, // neighbourhood/suburb level
    },
    headers: {
      'User-Agent': 'ScanitectAI/1.0 (contact@yourdomain.com)',
      // 'Accept-Language': 'en', // optional
    },
    timeout: 10000,
  });

  if (!data || !data.address) return null;
  const addr = data.address;

  // Prefer smaller areas first (neighbourhood, suburb), then borough, then city
  // For NYC this tends to give things like "Lower East Side", "SoHo", etc.
  const areaName =
   addr.town ||
    addr.village ||
    addr.borough ||
    addr.city_district ||
    addr.suburb ||
    addr.neighbourhood ||
     addr.city ||
    null;

console.log("the area name", areaName)


  return areaName;
}







async getNearbyPlacesSerp(
  lat: number,
  lon: number,
  radiusMeters = 1000,  // 3 km
  limit = 10,
) {
  // 1) First try your own places collection (MongoDB)
  const docs = await this.placeModel
    .find({
      coordinates: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [lon, lat], // [lng, lat]
          },
          $maxDistance: radiusMeters,
        },
      },
    })
    .limit(limit)
    .lean<any>();

  const dbResults = docs.map((p) => ({
    id: String(p._id),
    title: p.ai?.title || p.title || 'Unknown place',
    location: p.ai?.location || null,
    thumbnailImage:
      p.images?.local_thumbnail ||
      p.images?.thumbnail ||
      p.images?.original ||
      null,
  }));

  // If we have at least 5 from our DB, that's enough
  if (dbResults.length >= 5) {
    return dbResults.slice(0, limit);
  }

  const remaining = limit - dbResults.length;

  let googleResults: {
    id: string;
    title: string;
    location: string | null;
    thumbnailImage: string | null;
  }[] = [];

  try {
    console.log("the radius meter",radiusMeters )
    googleResults = await this.fetchNearbyFromGooglePlaces(
      lat,
      lon,
      radiusMeters,
      remaining,
    );
  } catch (e: any) {
    console.error(
      '[GooglePlaces] nearby fetch failed:',
      e?.response?.data || e?.message || e,
    );
    // ignore failure, just return what we have from DB
    return dbResults;
  }

  // Deduplicate by title (case-insensitive)
  const existingTitles = new Set(
    dbResults.map((r) => (r.title || '').toLowerCase()),
  );

  const dedupedGoogle = googleResults.filter((r) => {
    const t = (r.title || '').toLowerCase();
    if (!t) return false;
    if (existingTitles.has(t)) return false;
    existingTitles.add(t);
    return true;
  });

  return [...dbResults, ...dedupedGoogle];
}





// Optional: extend the return type if you want to keep the category


private async fetchNearbyFromGooglePlaces(
  lat: number,
  lon: number,
  radiusMeters: number,
  limit: number,
): Promise<NearbyPlace[]> {
  if (limit <= 0) return [];

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error('[GooglePlaces] Missing GOOGLE_MAPS_API_KEY');
    return [];
  }

  const url = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';

  // Max 1km
  const radius = Math.min(radiusMeters, 1000);

  const CATEGORY_QUERIES: { label: string; type?: string; keyword?: string }[] = [
    { label: 'Night Club', type: 'night_club' },
    { label: 'Restaurant', type: 'restaurant' },
    { label: 'Shopping Mall', type: 'shopping_mall' },
    { label: 'Theater', type: 'tourist_attraction', keyword: 'theater' },
    { label: 'Museum', type: 'museum' },
    { label: 'Art Gallery', type: 'art_gallery' },
    { label: 'Historical Monument', type: 'tourist_attraction', keyword: 'historical monument' },
    { label: 'Heritage Site', type: 'tourist_attraction', keyword: 'heritage site' },
    { label: 'Archaeological Site', type: 'tourist_attraction', keyword: 'archaeological site' },
    { label: 'Landmark', type: 'tourist_attraction', keyword: 'landmark' },
    { label: 'Palace', type: 'tourist_attraction', keyword: 'palace' },
    { label: 'Castle', type: 'tourist_attraction', keyword: 'castle' },
    { label: 'Temple', type: 'tourist_attraction', keyword: 'temple' },
    { label: 'Church / Cathedral', type: 'church' },
    { label: 'Mosque', type: 'mosque' },

    { label: 'Amusement Park', type: 'amusement_park' },
    { label: 'Theme Park', type: 'amusement_park', keyword: 'theme park' },
    { label: 'Water Park', type: 'amusement_park', keyword: 'water park' },
    { label: 'Zoo', type: 'zoo' },
    { label: 'Aquarium', type: 'aquarium' },
    { label: 'Safari Park', type: 'zoo', keyword: 'safari park' },

    { label: 'Botanical Garden', type: 'tourist_attraction', keyword: 'botanical garden' },
    { label: 'National Park', type: 'park', keyword: 'national park' },
    { label: 'Wildlife Sanctuary', type: 'park', keyword: 'wildlife sanctuary' },
    { label: 'Beach', type: 'tourist_attraction', keyword: 'beach' },
    { label: 'Island', type: 'tourist_attraction', keyword: 'island' },
    { label: 'Mountain', type: 'tourist_attraction', keyword: 'mountain' },
    { label: 'Hill Station', type: 'tourist_attraction', keyword: 'hill station' },
    { label: 'Desert', type: 'tourist_attraction', keyword: 'desert' },
    { label: 'Lake', type: 'tourist_attraction', keyword: 'lake' },
    { label: 'Waterfall', type: 'tourist_attraction', keyword: 'waterfall' },
    { label: 'Scenic Viewpoint', type: 'tourist_attraction', keyword: 'viewpoint' },
    { label: 'Nature Reserve', type: 'park', keyword: 'nature reserve' },
    { label: 'Hot Springs', type: 'tourist_attraction', keyword: 'hot springs' },

  
    { label: 'Casino', type: 'casino' },
    { label: 'Bar', type: 'bar' },
    { label: 'Pub', type: 'bar', keyword: 'pub' },
    { label: 'Lounge', type: 'bar', keyword: 'lounge' },

  
    { label: 'Café', type: 'cafe' },
    { label: 'Street Food Market', type: 'restaurant', keyword: 'street food market' },
    { label: 'Food Court', type: 'restaurant', keyword: 'food court' },
    { label: 'Wine Tasting Venue', type: 'bar', keyword: 'wine tasting' },

    { label: 'Shopping Mall', type: 'shopping_mall' },
    { label: 'Local Bazaar / Market', type: 'tourist_attraction', keyword: 'market' },
    { label: 'Cultural Village', type: 'tourist_attraction', keyword: 'cultural village' },
    { label: 'Festival Ground', type: 'tourist_attraction', keyword: 'festival ground' },

    { label: 'Theater', type: 'tourist_attraction', keyword: 'theater' },
    { label: 'Opera House', type: 'tourist_attraction', keyword: 'opera house' },
    { label: 'Cinema', type: 'movie_theater' },
    { label: 'Concert Hall', type: 'tourist_attraction', keyword: 'concert hall' },

    { label: 'Sports Stadium', type: 'stadium' },
    { label: 'Cruise Terminal', type: 'tourist_attraction', keyword: 'cruise terminal' },
  ];

  // Deduplicate by place_id
  const placeMap = new Map<string, { place: any; label: string }>();

  for (const q of CATEGORY_QUERIES) {
    if (placeMap.size >= limit) break;

    const params: any = {
      key: apiKey,
      location: `${lat},${lon}`,
      radius,
    };
    if (q.type) params.type = q.type;
    if (q.keyword) params.keyword = q.keyword;

    try {
      const resp = await axios.get(url, { params, timeout: 10000 });

      if (resp.data.status !== 'OK' && resp.data.status !== 'ZERO_RESULTS') {
        console.error(
          `[GooglePlaces] category=${q.label} type=${q.type} keyword=${q.keyword} error:`,
          resp.data.status,
          resp.data.error_message,
        );
        continue;
      }

      const results: any[] = resp.data.results || [];
      if (!results.length) continue;

      // === KEY CHANGE: only take the TOP 1 result for this category ===
      const top = results[0];

      if (top.place_id && !placeMap.has(top.place_id)) {
        placeMap.set(top.place_id, { place: top, label: q.label });
      }
    } catch (e: any) {
      console.error(
        `[GooglePlaces] category=${q.label} type=${q.type} keyword=${q.keyword} failed:`,
        e?.message || e,
      );
    }
  }

  const merged = Array.from(placeMap.values()).slice(0, limit);

  return merged.map(({ place, label }) => ({
    id: place.place_id,
    title: place.name || 'Unknown place',
    location: place.vicinity || place.formatted_address || null,
    thumbnailImage: null,
    // category: label,
  }));
}



// private async fetchNearbyFromGooglePlaces(
//   lat: number,
//   lon: number,
//   limit: number,
// ): Promise<
//   { id: string; title: string; location: string | null; thumbnailImage: string | null }[]
// > {
//   if (limit <= 0) return [];

//   const apiKey = process.env.GOOGLE_MAPS_API_KEY;
//   if (!apiKey) {
//     console.error('[GooglePlaces] Missing GOOGLE_MAPS_API_KEY');
//     return [];
//   }

//   const url = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';

//   // Fixed 1km radius
//   const radius = 1000; // meters

//   // What you want around the building
//   const QUERIES: { type?: string; keyword?: string }[] = [
//     // Pizza shops specifically
//     { type: 'restaurant', keyword: 'pizza' },

//     // Food & drinks
//     { type: 'restaurant' },
//     { type: 'cafe' },
//     { type: 'bar' },

//     // Activities / entertainment
//     { type: 'casino' },
//     { type: 'tourist_attraction' },
//     { type: 'shopping_mall' },
//     { type: 'movie_theater' },
//     { type: 'bowling_alley' },
//     { type: 'night_club' },
//     { type: 'amusement_park' },
//     { type: 'park' },
//     { type: 'museum' },
//   ];

//   const placeMap = new Map<string, any>(); // dedupe by place_id

//   for (const q of QUERIES) {
//     if (placeMap.size >= limit) break;

//     const params: any = {
//       key: apiKey,
//       location: `${lat},${lon}`,
//       radius,
//     };
//     if (q.type) params.type = q.type;
//     if (q.keyword) params.keyword = q.keyword;

//     try {
//       const resp = await axios.get(url, { params, timeout: 10000 });

//       if (resp.data.status !== 'OK' && resp.data.status !== 'ZERO_RESULTS') {
//         console.error(
//           `[GooglePlaces] type=${q.type} keyword=${q.keyword} error:`,
//           resp.data.status,
//           resp.data.error_message,
//         );
//         continue;
//       }

//       const results: any[] = resp.data.results || [];
//        console.log("the result of place near by user", results)
//       for (const place of results) {
//         if (!place.place_id || placeMap.has(place.place_id)) continue;
//         placeMap.set(place.place_id, place);
//         if (placeMap.size >= limit) break;
//       }
//     } catch (e: any) {
//       console.error(
//         `[GooglePlaces] type=${q.type} keyword=${q.keyword} failed:`,
//         e?.message || e,
//       );
//     }
//   }

//   const merged = Array.from(placeMap.values()).slice(0, limit);

//   return merged.map((place: any) => ({
//     id: place.place_id,
//     title: place.name || 'Unknown place',
//     location: place.vicinity || place.formatted_address || null,
//     thumbnailImage: null,
//   }));
// }



// private async fetchNearbyFromGooglePlaces(
//   lat: number,
//   lon: number,
//   radiusMeters: number,
//   limit: number,
// ): Promise<
//   { id: string; title: string; location: string | null; thumbnailImage: string | null }[]
// > {
//   if (limit <= 0) return [];

//   const apiKey = process.env.GOOGLE_MAPS_API_KEY;
//   if (!apiKey) {
//     console.error('[GooglePlaces] Missing GOOGLE_MAPS_API_KEY');
//     return [];
//   }

//   const url = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
//   const radius = Math.min(radiusMeters, 50000);

//   // Types you care about
//   const TYPES = [
//     'tourist_attraction',
//     'park',
//     'museum',
//     'lodging',        // hotels
//     'shopping_mall',
//     'restaurant',
//     'cafe',
//     'bar',
//     'art_gallery',
//     'zoo',
//     'amusement_park',
//     'aquarium',
//     'movie_theater',
//     'stadium',
//     'church',
//     'mosque',
//     'hindu_temple',
//     'synagogue',
//   ] as const;

//   const placeMap = new Map<string, any>(); // dedupe by place_id

//   for (const type of TYPES) {
//     if (placeMap.size >= limit) break;

//     const params: any = {
//       key: apiKey,
//       location: `${lat},${lon}`,
//       radius,
//       type, // one type per request
//     };

//     try {
//       const resp = await axios.get(url, { params, timeout: 10000 });

//       if (resp.data.status !== 'OK' && resp.data.status !== 'ZERO_RESULTS') {
//         console.error(
//           `[GooglePlaces] type=${type} error:`,
//           resp.data.status,
//           resp.data.error_message,
//         );
//         continue;
//       }

//       const results: any[] = resp.data.results || [];

//       for (const place of results) {
//         if (!place.place_id || placeMap.has(place.place_id)) continue;
//         placeMap.set(place.place_id, place);
//         if (placeMap.size >= limit) break;
//       }
//     } catch (e: any) {
//       console.error(`[GooglePlaces] type=${type} failed:`, e?.message || e);
//     }
//   }

//   const merged = Array.from(placeMap.values()).slice(0, limit);

//   return merged.map((place: any) => ({
//     id: place.place_id,
//     title: place.name || 'Unknown place',
//     location: place.vicinity || place.formatted_address || null,
//     thumbnailImage: null,
//   }));
// }



private readonly openaiApiKey = process.env.OPENAI_API_KEY; // put your key in env
private readonly openaiApiUrl = 'https://api.openai.com/v1/chat/completions';
private readonly openaiModel = 'gpt-4.1-mini'; // or 'gpt-4.1', etc.






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




public async searchGooglePlace(
  entityName: string,
  userLat?: number,
  userLon?: number,
): Promise<GooglePlaceBasic | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.error('GOOGLE_PLACES_API_KEY is not set; skipping Google Places');
    return null;
  }

  const input = encodeURIComponent(entityName.trim());
  const fields = 'place_id,name,geometry,photos';
  const baseUrl =
    'https://maps.googleapis.com/maps/api/place/findplacefromtext/json';

  const params: string[] = [
    `input=${input}`,
    'inputtype=textquery',
    `fields=${fields}`,
    `key=${apiKey}`,
  ];

  // Bias to 1km around user location (same logic as your Geocoding check)
  const hasUserLocation =
    typeof userLat === 'number' &&
    !Number.isNaN(userLat) &&
    typeof userLon === 'number' &&
    !Number.isNaN(userLon);

  if (hasUserLocation) {
    params.push(`locationbias=circle:1000@${userLat},${userLon}`);
  }

  const url = `${baseUrl}?${params.join('&')}`;

  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      console.error(
        `Google Places FindPlace error for '${entityName}':`,
        resp.status,
        text.slice(0, 200),
      );
      return null;
    }

    const data: any = await resp.json();
    if (
      data.status !== 'OK' ||
      !Array.isArray(data.candidates) ||
      !data.candidates.length
    ) {
      console.log(
        `Google Places: no candidates for '${entityName}', status=${data.status}`,
      );
      return null;
    }

    const c = data.candidates[0];
    const loc = c.geometry?.location;
    if (!loc || typeof loc.lat !== 'number' || typeof loc.lng !== 'number') {
      return null;
    }

    const lat = loc.lat;
    const lon = loc.lng;

    if (hasUserLocation) {
      const dist = this.haversine(userLat!, userLon!, lat, lon);
      console.log(
        `Google Places: '${entityName}' is ${Math.round(dist)}m from user`,
      );
      if (dist > 1000) {
        console.log(
          `Google Places: '${entityName}' outside 1km radius; discarding`,
        );
        return null;
      }
    }

    const photos =
      Array.isArray(c.photos)
        ? c.photos.map((p: any) => ({
            ref: p.photo_reference,
            width: p.width,
            height: p.height,
          }))
        : [];

    return {
      placeId: c.place_id,
      name: c.name ?? entityName,
      lat,
      lon,
      photos,
    };
  } catch (e) {
    console.error(
      `Google Places FindPlace failed for '${entityName}':`,
      e,
    );
    return null;
  }
}







private buildGooglePlacePhotoUrl(photoRef: string, maxWidth = 1600): string {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_PLACES_API_KEY is not set');
  }

  return (
    'https://maps.googleapis.com/maps/api/place/photo' +
    `?maxwidth=${maxWidth}` +
    `&photo_reference=${encodeURIComponent(photoRef)}` +
    `&key=${apiKey}`
  );
}

public async fetchPlacePhotosFromGoogle(
  place: GooglePlaceBasic,
  maxPhotos = 2,      // you want 2 images
  maxCandidates = 6,  // how many refs to try for dedupe
): Promise<string[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.error('GOOGLE_PLACES_API_KEY not set; cannot fetch photos');
    return [];
  }

  const refSet = new Set<string>();

  // 1) refs from FindPlaceFromText
  if (Array.isArray(place.photos)) {
    for (const p of place.photos) {
      if (p?.ref) {
        refSet.add(p.ref);
        if (refSet.size >= maxCandidates) break;
      }
    }
  }

  // 2) If not enough, call Place Details for more photos
  if (refSet.size < maxCandidates) {
    const detailsUrl =
      'https://maps.googleapis.com/maps/api/place/details/json' +
      `?place_id=${encodeURIComponent(place.placeId)}` +
      `&fields=photo` +
      `&key=${apiKey}`;

    try {
      const resp = await fetch(detailsUrl);
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        console.error(
          '[Places] details(photo) error:',
          resp.status,
          text.slice(0, 200),
        );
      } else {
        const data: any = await resp.json();
        if (data.status === 'OK' && Array.isArray(data.result?.photos)) {
          for (const p of data.result.photos) {
            const ref = p?.photo_reference;
            if (ref && !refSet.has(ref)) {
              refSet.add(ref);
              if (refSet.size >= maxCandidates) break;
            }
          }
        } else {
          console.log(
            '[Places] details(photo) no extra photos, status=',
            data.status,
          );
        }
      }
    } catch (err) {
      console.error('[Places] details(photo) fetch failed:', err);
    }
  }

  const candidateRefs = Array.from(refSet);
  if (!candidateRefs.length) return [];

  const seenHashes = new Set<string>();
  const finalUrls: string[] = [];

  // 3) For each candidate, fetch the image, hash it, and keep only truly different images
  for (const ref of candidateRefs) {
    if (finalUrls.length >= maxPhotos) break;

    const photoUrl = this.buildGooglePlacePhotoUrl(ref, 1600);

    try {
      const resp = await axios.get<ArrayBuffer>(photoUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
      });

      const buf = Buffer.from(resp.data as any);

      // Hash of the bytes (if two refs return identical JPEG bytes, hashes will match)
      const hash = crypto.createHash('md5').update(buf as any).digest('hex');

      if (!seenHashes.has(hash)) {
        seenHashes.add(hash);
        finalUrls.push(photoUrl);
      } else {
        // same image content as one we already accepted, skip this URL
        console.log('[Places] Skipping duplicate image by content');
      }
    } catch (err: any) {
      console.error(
        '[Places] photo fetch failed:',
        err?.response?.data || err?.message || err,
      );
    }
  }

  return finalUrls;
}







public async getNearbyThingsFromGoogle(
  lat: number,
  lon: number,
  radiusMeters = 1000, // 1 km
): Promise<NearbyThing[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.error('GOOGLE_PLACES_API_KEY not set; cannot fetch nearby');
    return [];
  }

  const url =
    'https://maps.googleapis.com/maps/api/place/nearbysearch/json' +
    `?location=${lat},${lon}` +
    `&radius=${radiusMeters}` +
    `&type=point_of_interest` +
    `&key=${apiKey}`;

  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      console.error(
        '[Places] nearbysearch error:',
        resp.status,
        text.slice(0, 200),
      );
      return [];
    }

    const data: any = await resp.json();
    if (data.status !== 'OK' || !Array.isArray(data.results)) {
      console.log(
        '[Places] nearbysearch no results, status=',
        data.status,
      );
      return [];
    }

    const out: NearbyThing[] = [];

    for (const r of data.results) {
      const rLoc = r.geometry?.location;
      if (!rLoc || typeof rLoc.lat !== 'number' || typeof rLoc.lng !== 'number') {
        continue;
      }

      const d = this.haversine(lat, lon, rLoc.lat, rLoc.lng);
      if (d > radiusMeters) continue;

      out.push({
        placeId: r.place_id,
        name: r.name,
        lat: rLoc.lat,
        lon: rLoc.lng,
        distanceMeters: d,
        types: Array.isArray(r.types) ? r.types : [],
      });
    }

    return out;
  } catch (e) {
    console.error('[Places] nearbysearch failed:', e);
    return [];
  }
}







public async getBuildingInfoFromChatGPT(
  buildingName: string,
): Promise<ChatGptBuildingInfo> {
  if (!this.openaiApiKey) {
    throw new InternalServerErrorException('OPENAI_API_KEY is not configured');
  }

  console.log("here reach", buildingName)


const prompt = `
You are an expert travel writer and architectural historian who writes in a tourism‑focused, fun, and engaging tone aimed at visitors. 
Always highlight:
- Why the place is interesting
- What visitors can do nearby

The input "buildingName" may be a messy search or listing title from things like Google Lens, visual search, or real‑estate websites. 
It can include unit numbers, neighborhoods, websites, or event titles. 
Your first job is to figure out the *actual building name* from this messy text.

CLEANING / NORMALIZING THE BUILDING NAME

From the raw input, infer a clean, canonical building name:

Rules:
1. If there is a distinct building name followed by an address or neighborhood, use the building name.
   - "Sycamore at 250 East 30th Street in Kips Bay : Sales, Rentals ..."  
     → "Sycamore"
   - "Kips Bay Towers at 343 E 30th St - Manhattan, NY | Compass"  
     → "Kips Bay Towers"

2. If there is no special building name, use the street address *without* unit/apartment numbers.
   - "330 East 38th Street #32G in Murray Hill, Manhattan | StreetEasy"  
     → "330 East 38th Street"
   - "251 East 32nd Street #4J in Kips Bay, Manhattan | StreetEasy"  
     → "251 East 32nd Street"
   - "200 East 32nd Street #9A in Kips Bay, Manhattan | StreetEasy"  
     → "200 East 32nd Street"

3. If the text is about a famous building plus an event, keep only the building name.
   - "The Empire State Building Holiday Light Show will be on view ..."  
     → "Empire State Building"

4. Strip out:
   - Unit numbers (e.g. "#32G", "#4J", "#9A")
   - Website or marketplace names (e.g. "StreetEasy", "Compass")
   - Marketing text (e.g. "Sales, Rentals", "For Rent", "For Sale")
   - Extra punctuation and separators (e.g. "|", ":", "-")

5. Do *not* include the city/neighborhood in the "name" field unless it is truly part of the official building name.

6. If you genuinely cannot find any proper building name, default to the cleaned street address.

Use this cleaned result as the building's "name" in the JSON below.

OUTPUT FORMAT

Given the raw building text, output ONLY a JSON object with these fields:

{
  "name": string,
  "shortDescription": string,          // 3–5 engaging sentences, general overview, why it’s interesting
  "tourismDescription": string,       // 4–8 fun, visitor-focused sentences: what to see, do, and experience nearby
  "funFacts": string[],               // list of short, punchy fun/interesting facts
  "heightMeters": number | null,      // height in meters if known, else null
  "latitude": number | null,          // decimal degrees if known, else null
  "longitude": number | null,         // decimal degrees if known, else null
  "architectureStyle": string | null, // e.g. "Gothic Revival"; null if unknown
  "architectName": string | null,     // e.g. "Minoru Yamasaki"; null if unknown
  "location": string | null           // e.g. "Kips Bay, Manhattan, New York City"; null if unknown
}

Rules:
- Use a fun, welcoming tone for tourists and casual visitors.
- Clearly convey why the place is worth seeing and what people can do nearby.
- The "name" field must use the cleaned building name, not the raw noisy input.
- If a value is unknown, use null for numbers, "" for strings, [] for funFacts.
- Do not add extra fields.
- Do not write anything before or after the JSON.

Raw building text (may be noisy): "${buildingName}"
`.trim();



// const prompt = `
// You are a building-name normalizer and a travel writer.

// GOAL
// Given messy raw text (often from Google Lens / visual search / real-estate listings), identify the correct BUILDING-LEVEL name.
// Your #1 priority is: return a clean canonical building name or (if no name exists) a clean street address.
// Never return an apartment/unit/suite/room.

// BUILDING IDENTIFICATION ACCURACY (HARD RULES)
// - Stay at building or address level only.
// - Do NOT include apartment numbers, unit numbers, suite numbers, floor numbers, or room numbers.
// - Use official building names when available (example: use "The Corinthian" as the title, not generic text).
// - If the raw text is unit-level, you MUST “promote” it to the building-level address/name.

// WHAT THE INPUT MAY CONTAIN
// - Unit numbers: "#32G", "Apt 4J", "Unit 9A", "Suite 1203", "PH", "Penthouse", "Floor 7"
// - Neighborhood/city text: "Kips Bay", "Manhattan", "NYC"
// - Websites/brands: "StreetEasy", "Compass", "Zillow", "Realtor.com"
// - Marketing: "For Sale", "For Rent", "Sales", "Rentals", "Open House"
// - Separators/punctuation: "|", "•", ":", "—", "-", parentheses

// STEP 1 — EXTRACT THE CANONICAL BUILDING "name"
// Follow these rules in order:

// A) If an official/distinct building name is present, use ONLY that name.
//    Examples:
//    - "Sycamore at 250 East 30th Street in Kips Bay : Sales, Rentals"
//      -> "Sycamore"
//    - "Kips Bay Towers at 343 E 30th St - Manhattan, NY | Compass"
//      -> "Kips Bay Towers"
//    - "The Corinthian 330 E 38th St #32G"
//      -> "The Corinthian"

// B) If there is no distinct building name, use the street address ONLY (no unit).
//    Examples:
//    - "330 East 38th Street #32G in Murray Hill, Manhattan | StreetEasy"
//      -> "330 East 38th Street"
//    - "251 East 32nd Street Apt 4J, New York, NY"
//      -> "251 East 32nd Street"

// C) If it’s a famous building plus an event/article, keep ONLY the building name.
//    Example:
//    - "The Empire State Building Holiday Light Show will be on view..."
//      -> "Empire State Building"

// D) STRIP these from the "name" field:
//    - Any unit/floor markers: "#", "Apt", "Apartment", "Unit", "Ste", "Suite", "PH", "Penthouse", "Floor", "Fl"
//    - Anything after a unit marker (e.g., "#32G" means remove "#32G" and anything that looks like a unit)
//    - Neighborhood/city unless truly part of the official building name
//    - Website/marketplace names and marketing phrases
//    - Extra separators/punctuation

// E) VALIDATION GATE (IMPORTANT):
//    The final "name" MUST NOT contain any of:
//    "#", "Apt", "Apartment", "Unit", "Suite", "Ste", "Floor", "Fl", "PH", "Penthouse"
//    If it does, you must remove the unit portion and re-check until it does not.

// If you genuinely cannot find a proper building name, default to the cleaned street address.

// STEP 2 — WRITE VISITOR-FRIENDLY TEXT
// After choosing the cleaned "name", write tourism-friendly descriptions.
// - Keep it fun and engaging for visitors.
// - Highlight why it’s interesting and what to do nearby.
// - If you don’t know factual details (architect, height, coordinates), use null/empty rather than guessing.

// OUTPUT FORMAT
// Output ONLY a JSON object with these fields and no extra text:

// {
//   "name": string,
//   "shortDescription": string,
//   "tourismDescription": string,
//   "funFacts": string[],
//   "heightMeters": number | null,
//   "latitude": number | null,
//   "longitude": number | null,
//   "architectureStyle": string | null,
//   "architectName": string | null,
//   "location": string | null
// }

// Rules:
// - The "name" field must be the cleaned building-level name/address, never the raw input.
// - If unknown: use null for numbers, "" for strings, [] for funFacts.
// - Do not add extra fields.
// - Do not write anything before or after the JSON.

// Raw building text (may be noisy): "\${buildingName}"
// `.trim();



  try {
    const { data } = await axios.post(
      this.openaiApiUrl,
      {
        model: this.openaiModel,
        messages: [
          { role: 'system', content: 'You output ONLY strict JSON, no explanation.' },
          { role: 'user', content: prompt },
        ],
        // If model supports JSON mode (GPT‑4.1, GPT‑4.1‑mini, GPT‑4o, etc.)
        response_format: { type: 'json_object' },
      },
      {
        headers: {
          Authorization: `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 50000,
      },
    );

    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    const parsed = JSON.parse(content) as ChatGptBuildingInfo;

    console.log("the parsed", parsed)

    return parsed;
  } catch (e: any) {
    console.error('[ChatGPT] error:', e?.response?.data || e?.message || e);
    throw new InternalServerErrorException(
      e?.message || 'Failed to get building info',
    );
  }
}

















async findPlaceDetailSerp(placeName: string) {
  console.log('the place name', placeName);

  const getDetail = await this.placeModel
    .findOne({ title: placeName })
    .lean<any>(); // lean<any> so we can access gallery, nearby, raw

  console.log('the get detail is thisssssss', getDetail);

  if (!getDetail) return null;

  const detailAny = getDetail as any;
  const gptRaw = detailAny.raw?.gpt;

  const wikipediaThumbImage = getDetail.images?.thumbnail;

  const thumbnailImage =
    getDetail.images?.local_thumbnail ||
    getDetail.images?.thumbnail ||
    undefined;

  const description =
    (getDetail as any).description_long || // if you actually use descriptionLong, change this
    getDetail.ai?.tourismDescription ||
    getDetail.ai?.shortDescription ||
    '';

  // ---- sort nearby by distance and limit to 6 ----
  const nearbyRaw: any[] = Array.isArray(detailAny.nearby)
    ? detailAny.nearby
    : [];

  const nearbySorted = nearbyRaw
    .slice()
    .sort((a, b) => {
      const da =
        typeof a.distanceMeters === 'number'
          ? a.distanceMeters
          : Number(a.distanceMeters) || Number.POSITIVE_INFINITY;
      const db =
        typeof b.distanceMeters === 'number'
          ? b.distanceMeters
          : Number(b.distanceMeters) || Number.POSITIVE_INFINITY;
      return da - db;
    })
    .slice(0, 6)
    .map((n) => ({
      placeId: n.placeId,
      title: n.title,
      types: n.types,
      distanceMeters:
        typeof n.distanceMeters === 'number'
          ? Math.round(n.distanceMeters)
          : Math.round(Number(n.distanceMeters) || 0),
      latitude: n.latitude,
      longitude: n.longitude,
      thumbnailUrl: n.thumbnailUrl ?? null,
    }));

  // ---- first & second Google Place images from gallery ----
  const firstGooglePlace = detailAny.gallery?.firstGooglePlace ?? null;
  const secondGooglePlace = detailAny.gallery?.secondGooglePlace ?? null;

  const filteredDetail = {
    id: getDetail._id,
    title: getDetail.title,

    // raw Wikipedia / Lens images
    // wikipediaThumbImage,

    // preferred images for UI
    // thumbnailImage,
    originalImage: detailAny.raw?.lensFirst?.image,

    // description
    description,

    // Wikidata fields (may be empty for Lens-only docs)
    countries: getDetail.wikidata?.countries?.[0],
    administrativeAreas: getDetail.wikidata?.administrativeAreas?.[0],
    ranges: getDetail.wikidata?.ranges,
    instanceOf: getDetail.wikidata?.instanceOf,
    architects: getDetail.wikidata?.architects?.[0],
    coordinates: getDetail.coordinates?.coordinates,
    height: getDetail.wikidata?.height_m,

    // ChatGPT fields (for Lens docs)
    chatgptTitle: getDetail.ai?.title,
    aiShortDescription: getDetail.ai?.shortDescription,
    aiTourismDescription: getDetail.ai?.tourismDescription,
    aiFunFacts: getDetail.ai?.funFacts,
    aiHeightMeters: getDetail.ai?.heightMeters,
    aiLatitude: getDetail.ai?.latitude,
    aiLongitude: getDetail.ai?.longitude,
    aiArchitectureStyle: getDetail.ai?.architectureStyle,

    aiArchitectName:
      getDetail.ai?.architectName ??
      gptRaw?.architectName ??
      '',
    aiLocation:
      getDetail.ai?.location ??
      gptRaw?.location ??
      '',

    // NEW: Google Places images
    firstGooglePlace,
    secondGooglePlace,

    // NEW: sorted + limited nearby list
    nearby: nearbySorted,
  };

  return filteredDetail;
}










async findPlaceDetailByAiTitle(aiTitle: string) {
  console.log('findPlaceDetailByAiTitle:', aiTitle);

  const getDetail = await this.placeModel
    .findOne({ 'ai.title': aiTitle })
    .lean<any>(); // lean<any> so we can access gallery, nearby, raw safely

  console.log('getDetail by ai.title is', getDetail);

  if (!getDetail) return null;

  const detailAny = getDetail as any;
  const gptRaw = detailAny.raw?.gpt;

  const wikipediaThumbImage = getDetail.images?.thumbnail;

  const thumbnailImage =
    getDetail.images?.local_thumbnail ||
    getDetail.images?.thumbnail ||
    undefined;

  const description =
    (getDetail as any).description_long ||
    getDetail.ai?.tourismDescription ||
    getDetail.ai?.shortDescription ||
    '';

  // ---- sort nearby by distance and limit to 6 ----
  const nearbyRaw: any[] = Array.isArray(detailAny.nearby)
    ? detailAny.nearby
    : [];

  const nearbySorted = nearbyRaw
    .slice()
    .sort((a, b) => {
      const da =
        typeof a.distanceMeters === 'number'
          ? a.distanceMeters
          : Number(a.distanceMeters) || Number.POSITIVE_INFINITY;
      const db =
        typeof b.distanceMeters === 'number'
          ? b.distanceMeters
          : Number(b.distanceMeters) || Number.POSITIVE_INFINITY;
      return da - db;
    })
    .slice(0, 6)
    .map((n) => ({
      placeId: n.placeId,
      title: n.title,
      types: n.types,
      distanceMeters:
        typeof n.distanceMeters === 'number'
          ? Math.round(n.distanceMeters)
          : Math.round(Number(n.distanceMeters) || 0),
      latitude: n.latitude,
      longitude: n.longitude,
      thumbnailUrl: n.thumbnailUrl ?? null,
    }));

  // ---- first & second Google Place images from gallery ----
  const firstGooglePlace = detailAny.gallery?.firstGooglePlace ?? null;
  const secondGooglePlace = detailAny.gallery?.secondGooglePlace ?? null;

  const filteredDetail = {
    id: getDetail._id,
    title: getDetail.title,

    // wikipediaThumbImage,
    // thumbnailImage,
    originalImage: detailAny.raw?.lensFirst?.image,

    description,

    countries: getDetail.wikidata?.countries?.[0],
    administrativeAreas: getDetail.wikidata?.administrativeAreas?.[0],
    ranges: getDetail.wikidata?.ranges,
    instanceOf: getDetail.wikidata?.instanceOf,
    architects: getDetail.wikidata?.architects?.[0],
    coordinates: getDetail.coordinates?.coordinates,
    height: getDetail.wikidata?.height_m,

    chatgptTitle: getDetail.ai?.title,
    aiShortDescription: getDetail.ai?.shortDescription,
    aiTourismDescription: getDetail.ai?.tourismDescription,
    aiFunFacts: getDetail.ai?.funFacts,
    aiHeightMeters: getDetail.ai?.heightMeters,
    aiLatitude: getDetail.ai?.latitude,
    aiLongitude: getDetail.ai?.longitude,
    aiArchitectureStyle: getDetail.ai?.architectureStyle,

    aiArchitectName:
      getDetail.ai?.architectName ??
      gptRaw?.architectName ??
      '',
    aiLocation:
      getDetail.ai?.location ??
      gptRaw?.location ??
      '',

    // NEW: Google Places images
    firstGooglePlace,
    secondGooglePlace,

    // NEW: sorted, limited nearby list
    nearby: nearbySorted,
  };

  return filteredDetail;
}






async getScansDetailsSerp(id: string) {
  try {
    console.log('hrll', id, 'type of', typeof id);

    const place = await this.placeModel
      .findById(id)
      .lean<any>(); // keep lean, but any so we can access gallery, nearby, raw

    if (!place) {
      return {
        status: 404,
        message: 'not_found',
        error: `Scan with id ${id} not found`,
      };
    }

    const placeAny = place as any;
    const gptRaw = placeAny.raw?.gpt;

    // ---- sort nearby by distance and limit to 6 ----
    const nearbyRaw: any[] = Array.isArray(placeAny.nearby)
      ? placeAny.nearby
      : [];

    const nearbySorted = nearbyRaw
      .slice()
      .sort((a, b) => {
        const da =
          typeof a.distanceMeters === 'number'
            ? a.distanceMeters
            : Number(a.distanceMeters) || Number.POSITIVE_INFINITY;
        const db =
          typeof b.distanceMeters === 'number'
            ? b.distanceMeters
            : Number(b.distanceMeters) || Number.POSITIVE_INFINITY;
        return da - db;
      })
      .slice(0, 6)
      .map((n) => ({
        placeId: n.placeId,
        title: n.title,
        types: n.types,
        distanceMeters:
          typeof n.distanceMeters === 'number'
            ? Math.round(n.distanceMeters)
            : Math.round(Number(n.distanceMeters) || 0),
        latitude: n.latitude,
        longitude: n.longitude,
        thumbnailUrl: n.thumbnailUrl ?? null,
      }));

    // ---- first & second Google Place images from gallery ----
    const firstGooglePlace =
      placeAny.gallery?.firstGooglePlace ?? null;
    const secondGooglePlace =
      placeAny.gallery?.secondGooglePlace ?? null;

    const scanDetail = {
      id: place._id,
      title: place.title,

      // wikipediaThumbImage: place.images?.thumbnail,
      // thumbnailImage:
      //   place.images?.local_thumbnail || place.images?.thumbnail,
      originalImage: place.raw?.lensFirst?.image,

      description:
        place.ai?.tourismDescription ||
        place.ai?.shortDescription ||
        '',

      countries: place.wikidata?.countries?.[0],
      administrativeAreas: place.wikidata?.administrativeAreas?.[0],
      ranges: place.wikidata?.ranges,
      instanceOf: place.wikidata?.instanceOf,
      architects: place.wikidata?.architects?.[0],
      coordinates: place.coordinates?.coordinates,
      height: place.wikidata?.height_m,

      // GPT / AI fields
      chatgptTitle: place.ai?.title,
      aiShortDescription: place.ai?.shortDescription,
      aiTourismDescription: place.ai?.tourismDescription,
      aiFunFacts: place.ai?.funFacts,
      aiHeightMeters: place.ai?.heightMeters,
      aiLatitude: place.ai?.latitude,
      aiLongitude: place.ai?.longitude,
      aiArchitectureStyle: place.ai?.architectureStyle,

      aiArchitectName:
        place.ai?.architectName ??
        gptRaw?.architectName ??
        '',
      aiLocation:
        place.ai?.location ??
        gptRaw?.location ??
        '',

      // NEW: Google Places images
      firstGooglePlace,
      secondGooglePlace,

      // NEW: sorted + limited nearby list with thumbnailUrl
      nearby: nearbySorted,
    };

    console.log('the scan detail', scanDetail);

    return {
      status: 200,
      message: 'success',
      scanDetail,
    };
  } catch (e: any) {
    return {
      status: 500,
      message: 'error',
      error: e?.message || e,
    };
  }
}



async getScansSummarySerp(scanIds: string[]) {
  try {
    if (!scanIds?.length) {
      return {
        status: 200,
        message: 'No scan IDs provided',
        scans: [],
      };
    }

    // 1) Unique IDs for the DB query
    const uniqueIds = [...new Set(scanIds)];

    // 2) Get all scans for those IDs (no sorting here!)
    const scans = await this.placeModel
      .find({ _id: { $in: uniqueIds } })
      .lean<any>();

    // 3) Build summary once per scan and store by ID
    const summaryById = new Map<string, any>();

    for (const scan of scans) {
      const id = scan._id.toString();

      const thumbnailImage =
        scan.images?.local_thumbnail ||
        scan.images?.thumbnail ||
        scan.images?.local_original ||
        scan.images?.original ||
        '';

      const aiTitle = scan.ai?.title || scan.title || 'Unknown';
      const architectureStyle = scan.ai?.architectureStyle || 'Unknown';
      const location =
        scan.ai?.location ||
        scan.raw?.gpt?.location ||
        'Unknown';

      const date: string =
        (scan.updatedAt || scan.createdAt || new Date()).toISOString();

      summaryById.set(id, {
        id,
        aiTitle,
        date,
        location,
        architectureStyle,
        thumbnailImage,
      });
    }

    // 4) Build the result in **reverse order** of scanIds,
    //    pushing duplicates as many times as they appear
    const result: any[] = [];

    for (let i = scanIds.length - 1; i >= 0; i--) {
      const id = scanIds[i];
      const summary = summaryById.get(id);
      if (summary) {
        result.push(summary);
      }
    }

    return {
      status: 200,
      message: 'Fetched scan summaries successfully',
      scans: result,
    };
  } catch (error: any) {
    console.error('Error fetching scans summary (Serp):', error);
    return {
      status: 500,
      message: 'Error fetching scans summary',
      error: error.message || String(error),
    };
  }
}







}







































