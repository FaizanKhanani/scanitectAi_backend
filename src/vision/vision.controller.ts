import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Get,
  Query,
   Res,
    Req,
    Param,
  UploadedFiles,
    UseGuards,
   UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from "../common/guards/at.guard";
import { HttpExceptionFilter } from "../utils/http-exception.filter";
import { FetchDataFromWikipedia } from "./dto/fetchDataFromWikipedia.dto";
// import { FetchDataFromChatGpt } from "./dto/fetchDataFromChatGpt.dto";
import { memoryStorage } from 'multer';
// import { ImageClassifierService } from '../ImageClassifier/image-classifier.service';
import type { Response ,Express } from 'express';
import axios from 'axios';
import { Public } from '../common/decorators';
import {
  // ApiBearerAuth,
  // ApiCookieAuth,
  ApiResponse,
  ApiOperation
  // ApiTags,
} from "@nestjs/swagger";
import { UserService } from "../users/users.service";
import { VisionService } from './vision.service';
import { TranslationService } from '../translation/translate.service';
import { PricingService } from '../pricing/pricing.service'; 

type MulterFile = Express.Multer.File; // <-- define alias here

class RecognizeDto {
  lat?: string;
  lon?: string;
  top_k?: string;
  image_base64?: string;
  image_url?: string;
}

// @Public()
@Controller('recognize')
export class VisionController {
  constructor(
    private readonly visionService: VisionService,
    private readonly userService: UserService,
    private readonly translationService: TranslationService,
     private readonly pricingService: PricingService,
      // private readonly imageClassifier: ImageClassifierService,
  ) {}



// @Post()
// @UseGuards(AuthGuard)
// @UseFilters(new HttpExceptionFilter())
//   @UseInterceptors(
//     FileFieldsInterceptor(
//       [
//         { name: 'image', maxCount: 1 },
//         { name: 'file',  maxCount: 1 },
//       ],
//       {
//         storage: memoryStorage(),
//         limits: { fileSize: 10 * 1024 * 1024 },
//       },
//     ),
//   )
// async recognize(
//   @UploadedFiles() files: { image?: MulterFile[]; file?: MulterFile[] },
//   @Body() body: RecognizeDto,
//   @Query() query: RecognizeDto,
//   @Req() req,
//   @Res() res: Response,
// ) {
//   const get = (k: keyof RecognizeDto) => body[k] ?? query[k];
//   const userId = req.user.sub;


  

//   // 1. Get image buffer (your logic is fine)
//  let buf: Buffer | undefined;
//     const up = files?.image?.[0] ?? files?.file?.[0];
//     if (up?.buffer) {
//       buf = up.buffer;
//     } else if (get('image_base64')) {
//       buf = Buffer.from(get('image_base64') as string, 'base64');
//     } else if (get('image_url')) {
//       const url = get('image_url') as string;
//       const resp = await axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer', timeout: 35000 });
//       buf = Buffer.from(resp.data as any);
//     }

//     if (!buf) {
//       throw new BadRequestException(
//         "Provide an image via multipart 'image'/'file', or JSON 'image_base64'/'image_url'",
//       );
//     }


//   // 2. Validate coordinates (your logic is fine, just ensure it's here)
//   const latStr = get('lat') as string;
//   const lonStr = get('lon') as string;
//   console.log("the latStr", latStr, "the lonStr",lonStr)
//   let lat: number | undefined;
//   let lon: number | undefined;

//   if (latStr && lonStr) {
//     lat = parseFloat(latStr);
//     lon = parseFloat(lonStr);
//     if (isNaN(lat) || isNaN(lon)) {
//       throw new BadRequestException('Invalid coordinates provided.');
//     }
//   }
//   const topK = get('top_k') ? parseInt(get('top_k') as string, 10) : 5;
// console.log("the lat", lat, "the lon",lon,"topK", topK )
//   // 3. Call the service
//   const results = await this.visionService.recognize(buf, { lat, lon, topK });
//    console.log("the result", results)
//   if (results.status === 'FAILURE') {
//     // Inside this block, TypeScript knows `results` is a `FailureRecognition`.
//     // We handle the error and stop the function by throwing.
// console.log("in failure")
//  return res.status(400).json({ status: 400, message: 'FAILURE', data: results.message });
//     // throw new BadRequestException(results.message);
//   }


//   if (results.data.length === 0) {
//     // This case handles if the success data is for some reason empty.
//     // throw new BadRequestException('No landmark recognized.');
//     return res.status(400).json({ status: 400, message: 'FAILURE', data: 'Building not recognized.' });
//   }




//   // It is now safe to access the data. The TypeScript error is resolved.
//   const placeName = results.data[0].name;

//   console.log("the successful result is:", results);

//   // The rest of your logic can now proceed 
  
  

//   const findPlaceDetail = await this.visionService.findPlaceDetail(placeName);
//   if (findPlaceDetail) {
//     await this.userService.addScanIdInUser(userId, findPlaceDetail.id);
//     return res.status(200).json({ status: 200, message: 'success', data: findPlaceDetail });
//   }

//   const response = await this.visionService.getDetail(placeName);
//   if (response.status === 200) {
//     const saved = await this.visionService.upsertPlaceFromDetail(response.data, placeName);
//     await this.userService.addScanIdInUser(userId, saved.id);
//     return res.status(200).json({ status: 200, message: 'success', data: saved });
//   }

//   else if(response.status !== 200){

//     const searchName = await this.visionService.searchTitle(placeName);

//     if(searchName.status === 200){
//        const response = await this.visionService.getDetail(searchName.title);
//   if (response.status === 200) {
//     const saved = await this.visionService.upsertPlaceFromDetail(response.data, searchName.title);
//     await this.userService.addScanIdInUser(userId, saved.id);
//     return res.status(200).json({ status: 200, message: 'success', data: saved });
//   }


//     }

//   }

//   // throw new BadRequestException(`Failed to get landmark details of ${placeName} `);

//     return res.status(400).json({ status: 400, message: 'FAILURE', data: `Failed to get building details of ${placeName}` });




  
// //     return res.status(200).json({
// //     "status": 200,
// //     "message": "success",
// //     "data": {
// //         "id": "68fcbf2854a04c18631281ce",
// //         "title": "Niagara Falls",
// //         "thumbnailImage": "http://localhost:4000/files/68fcbf1d7ede1cbb7993da48",
// //         "originalImage": "http://localhost:4000/files/68fcbf077ede1cbb7993da38",
// //         "description": "Niagara Falls is a group of three waterfalls at the southern end of Niagara Gorge, spanning the border between the province of Ontario in Canada and the state of New York in the United States. The largest of the three is Horseshoe Falls, which straddles the international border of the two countries. It is also known as the Canadian Falls. The smaller American Falls and Bridal Veil Falls lie within the United States. Bridal Veil Falls is separated from Horseshoe Falls by Goat Island and from American Falls by Luna Island, with both islands situated in New York.\nFormed by the Niagara River, which drains Lake Erie into Lake Ontario, the combined falls have the highest flow rate of any waterfall in North America that has a vertical drop of more than 50 m (164 ft). During peak daytime tourist hours, more than 168,000 m3 (5.9 million cu ft) of water goes over the crest of the falls every minute. Horseshoe Falls is the most powerful waterfall in North America, as measured by flow rate. Niagara Falls is famed for its beauty and is a valuable source of hydroelectric power. Balancing recreational, commercial, and industrial uses has been a challenge for the stewards of the falls since the 19th...",
// //         "countries": "Canada",
// //         "administrativeAreas": "Ontario",
// //         "ranges": [],
// //         "instanceOf": [
// //             "tourist attraction",
// //             "waterfall",
// //             "horseshoe waterfall"
// //         ],
// //         "coordinates": [
// //             -79.071,
// //             43.08
// //         ],
// //         "height": 57
// //     }
// // })
  

// }














// @Post('/Image-Information')
// @UseGuards(AuthGuard)
// @UseFilters(new HttpExceptionFilter())
// async getDataFromWikipedia(
//   @Req() req,
//   @Body() fetchDataFromWikipedia: FetchDataFromWikipedia,
//   @Res() res: Response,
// ): Promise<any> {
//   const { PlaceName } = fetchDataFromWikipedia;
//   const userId = req.user.sub;






//   const findPlaceDetail = await this.visionService.findPlaceDetail(PlaceName);
//   console.log("the findPlaceDetail", findPlaceDetail)
//   if (findPlaceDetail) {
//     await this.userService.addScanIdInUser(userId, findPlaceDetail.id);
//     return res.status(200).json({ status: 200, message: 'success', data: findPlaceDetail });
//   }

//   const response = await this.visionService.getDetail(PlaceName);
//   console.log("the response of get detail", response)
//   if (response.status === 200) {
//     const saved = await this.visionService.upsertPlaceFromDetail(response.data, PlaceName);
//     await this.userService.addScanIdInUser(userId, saved.id);
//     return res.status(200).json({ status: 200, message: 'success', data: saved });
//   }
  
//   else if(response.status !== 200){

//     console.log("in this 400 repsone ")

//     const searchName = await this.visionService.searchTitle(PlaceName);

//     if(searchName.status === 200){
//        const response = await this.visionService.getDetail(searchName.title);
//   if (response.status === 200) {
//     const saved = await this.visionService.upsertPlaceFromDetail(response.data, searchName.title);
//     await this.userService.addScanIdInUser(userId, saved.id);
//     return res.status(200).json({ status: 200, message: 'success', data: saved });
//   }


//     }

//   }


// }









//         @ApiOperation({
//           summary: "fetch ",
//           description: "Get scan summary of specific user",
//         })
//         @ApiResponse({
//           status: 200,
//           description: 'Get scan summary of specific user Successfully',  })
//         @ApiResponse({ status: 403, description: "Forbidden." })
//         @UseGuards(AuthGuard)
//         @Get('get-scans')
//         @UseFilters(new HttpExceptionFilter())
//         async getScans(@Req() req, @Res() res: Response): Promise<any> {
      
//           const userId = req.user.sub;
//           console.log("the user is in getLoginUserData", userId)
      
      
//           const response = await this.userService.getScansId(userId)
      
//           console.log("the response in get scans ", response)

//           if(response.status === 200){

//             const getScansSummary = await this.visionService.getScansSummary(response.scanAreas)


//             // console.log("the get scans Summary is", getScansSummary)

            
//     const userId = req.user.sub;
//     const user = await this.userService.findOne(userId);

//     const translated = await this.translationService.translate(
//       getScansSummary.scans,
//       user.languageCode,
//     );


// console.log("the translated", translated)

//                 return res.status(200).json({
//       status: 200,
//       message: getScansSummary.message,
//       data: translated,
//     });

//           }
   
      
//           return res.status(400).json({
//     status: 400,
//     message: "failed",
//     data: "error in getting the scan details",
//   });
      
      
//         }



// @UseGuards(AuthGuard)
// @Get('get-scan/:id')
// async getSingleScans(@Param('id') id: string, @Req() req, @Res() res: Response) {
//   try {
//     const getScanDetail = await this.visionService.getScansDetails(id);

//     if (getScanDetail.status !== 200) {
//       return res.status(400).json({
//         status: getScanDetail.status,
//         message: getScanDetail.message,
//         data: getScanDetail.error,
//       });
//     }

//     const userId = req.user.sub;
//     const user = await this.userService.findOne(userId);

//     const translated = await this.translationService.translate(
//       getScanDetail.scanDetail,
//       user.languageCode,
//     );

//     return res.status(200).json({
//       status: getScanDetail.status,
//       message: getScanDetail.message,
//       data: translated,
//     });
//   } catch (error) {
//     console.error('Error in getSingleScans:', error);

//     // Decide what you want to send if translation fails
//     return res.status(502).json({
//       status: 502,
//       message: 'Failed to translate scan detail',
//       // optionally include more info in dev env
//     });
//   }
// }
 
        


  
//  @Get('search-name')
//   async search( @Res() res: Response, @Query('label') label?: string): Promise<any> {
//     if (!label) throw new BadRequestException('Query param "label" is required');

//     console.log("the label in name", label)
//     const searchName = await this.visionService.searchTitle(label);
//            return res.status(200).json({
//       status: searchName.status,
//       message: searchName.message,
//       data: searchName.title,
//     });
//   }











// @Post('lens')
// @UseGuards(AuthGuard)
// @UseFilters(new HttpExceptionFilter())
// @UseInterceptors(
//   FileFieldsInterceptor(
//     [
//       { name: 'image', maxCount: 1 },
//       { name: 'file',  maxCount: 1 },
//     ],
//     {
//       storage: memoryStorage(),
//       limits: { fileSize: 10 * 1024 * 1024 },
//     },
//   ),
// )
// async recognizeWithLenss(
//   @UploadedFiles() files: { image?: MulterFile[]; file?: MulterFile[] },
//   @Body() body: RecognizeDto,
//   @Query() query: RecognizeDto,
//   @Req() req,
//   @Res() res: Response,
// ) {
//   const get = (k: keyof RecognizeDto) => body[k] ?? query[k];
//   const userId = req.user?.sub;

//   console.log('the body', body);

//   // --- parse user location from frontend: lat, lon ---
//   const latRaw = get('lat');
//   const lonRaw = get('lon');

//   //   const userLat = 40.74547599095041
//   // const userLon = -73.97540709324299

 
//   const userLat =
//     latRaw !== undefined && latRaw !== null ? Number(latRaw) : undefined;
//   const userLon =
//     lonRaw !== undefined && lonRaw !== null ? Number(lonRaw) : undefined;


//   if (
//     (latRaw !== undefined && Number.isNaN(userLat)) ||
//     (lonRaw !== undefined && Number.isNaN(userLon))
//   ) {
//     throw new BadRequestException('Invalid lat or lon');
//   }

//   // 1) Build image buffer
//   let buf: Buffer | undefined;
//   const up = files?.image?.[0] ?? files?.file?.[0];

//   if (up?.buffer) {
//     buf = up.buffer;
//   } else if (get('image_base64')) {
//     buf = Buffer.from(get('image_base64') as string, 'base64');
//   } else if (get('image_url')) {
//     const url = get('image_url') as string;
//     const resp = await axios.get<ArrayBuffer>(url, {
//       responseType: 'arraybuffer',
//       timeout: 35000,
//     });
//     buf = Buffer.from(resp.data as any);
//   }

//   if (!buf) {
//     throw new BadRequestException(
//       "Provide an image via multipart 'image'/'file', or JSON 'image_base64'/'image_url'",
//     );
//   }

//   try {
//     // 2) Google Lens via SerpApi
//     const lensResult = await this.visionService.recognizeWithGoogleLens(buf);

//     // Only treat as failure if there is NO visual match at all
//     if (!lensResult.first) {
//       let nearbyPlaces: any[] = [];

//       // If we have user location, fetch nearby famous places within 3 km
//       if (userLat != null && userLon != null) {
//         try {
//           nearbyPlaces = await this.visionService.getNearbyPlacesSerp(
//             userLat,
//             userLon,
//             3000, // 3km radius in meters
//           );
//         } catch (err) {
//           console.error('[Lens] nearbyPlaces error:', err);
//         }
//       }

//       return res.status(400).json({
//         status: 400,
//         message: 'LOW_CONFIDENCE',
//         data: {
//           reason:
//             'We could not confidently recognize this building. ' +
//             'Please try again and take a clearer photo from a different angle.',
//           nearbyPlaces,
//         },
//       });
//     }

//     const first = lensResult.first;

//     // 3) Derive canonical place name
//     const placeName: string =
//       lensResult.label ||
//       lensResult.raw?.knowledge_graph?.title ||
//       lensResult.raw?.knowledge_graph?.name ||
//       lensResult.raw?.related_content?.[0]?.query ||
//       first.title ||
//       first.name ||
//       first.link_title ||
//       first.query ||
//       'Unknown building';

//     // distance thresholds (km)
//     const STRICT_MAX_KM = 1;   // must be within 1km of user to trust match
//     const ZONE_MAX_KM   = 30;  // allowed zone radius

//     // 4) Existing place in DB? -> check area restriction, then return
//     const existing = await this.visionService.findPlaceDetailSerp(placeName);
//     if (existing) {
//       const existingAny = existing as any;

//       const existingLat =
//         existingAny.aiLatitude ??
//         existingAny.latitude ??
//         existingAny.ai?.latitude ??
//         existingAny.coordinates?.coordinates?.[1];

//       const existingLon =
//         existingAny.aiLongitude ??
//         existingAny.longitude ??
//         existingAny.ai?.longitude ??
//          existingAny.coordinates?.coordinates?.[0];

//       if (
//         userLat != null &&
//         userLon != null &&
//         existingLat != null &&
//         existingLon != null
//       ) {
//         const distKm = this.visionService.distanceKm(
//           userLat,
//           userLon,
//           Number(existingLat),
//           Number(existingLon),
//         );

//         if (distKm > ZONE_MAX_KM) {
//           return res.status(400).json({
//             status: 400,
//             message: 'LOCATION_MISMATCH',
//             data: 'You are out of zone. Please come in 50KM radius',
//           });
//         }
//       }

//       await this.userService.addScanIdInUser(userId, existing.id);
//       return res.status(200).json({
//         status: 200,
//         message: 'success',
//         data: existing,
//       });
//     }

//     // 5) No existing place -> call ChatGPT

// const gpt = await this.visionService.getBuildingInfoFromChatGPT(placeName);
// console.log('the gpt data', gpt);

// // 6) Use OSM (first) or GPT coords + user location to decide confidence / zone
// if (userLat != null && userLon != null) {
//   let targetLat: number | null = null;
//   let targetLon: number | null = null;
//   let coordSource: 'osm' | 'gpt' | null = null;

//   // 1) Try OSM / Nominatim first
// try {
//   const googleResult = await this.visionService.searchGoogleGeocoding(
//     placeName,
//     userLat,
//     userLon,
//   );

//   if (googleResult) {
//     // Place is within 1km radius of user
//     targetLat = googleResult.lat;
//     targetLon = googleResult.lon;
//     console.log('Using Google coords within 1km:', googleResult);
//   } else {
//     // Either not found OR farther than 1km
//     console.log(
//       'Place not found within 1km of user (or geocoding failed):',
//       placeName,
//     );
//   }
// } catch (e) {
//   console.error('Error while calling Google Geocoding:', e);
// }

//   // 2) If OSM did NOT give coords, fallback to GPT coords
//   if (targetLat == null || targetLon == null) {
//     const gptLat =
//       gpt?.latitude != null ? Number(gpt.latitude) : NaN;
//     const gptLon =
//       gpt?.longitude != null ? Number(gpt.longitude) : NaN;

//     if (!Number.isNaN(gptLat) && !Number.isNaN(gptLon)) {
//       targetLat = gptLat;
//       targetLon = gptLon;
//       coordSource = 'gpt';
//       console.log('Using GPT coordinates:', { lat: gptLat, lon: gptLon });
//     }
//   }

//   // 3) If still no coordinates from OSM or GPT -> LOW_CONFIDENCE + nearbyPlaces
//   if (targetLat == null || targetLon == null) {
//     let nearbyPlaces: any[] = [];
//     try {
//       nearbyPlaces = await this.visionService.getNearbyPlacesSerp(
//         userLat,
//         userLon,
//         3000, // 3km radius
//       );
//     } catch (err) {
//       console.error(
//         '[Lens] nearbyPlaces error (no coords from OSM or GPT):',
//         err,
//       );
//     }

//     return res.status(400).json({
//       status: 400,
//       message: 'LOW_CONFIDENCE',
//       data: {
//         reason:
//           'We could not confidently recognize this building (no reliable location found). ' +
//           'Please try again and take a clearer photo from a different angle.',
//         nearbyPlaces,
//       },
//     });
//   }

//   // 4) We have coordinates (from OSM or GPT) -> compute distance
//   const distKm = this.visionService.distanceKm(
//     userLat,
//     userLon,
//     targetLat,
//     targetLon,
//   );
//   console.log(`Distance from user (${coordSource}):`, distKm, 'km');

//   // B1: way outside general zone -> LOCATION_MISMATCH (you treat as LOW_CONFIDENCE)
//   if (distKm > ZONE_MAX_KM) {
//     let nearbyPlaces: any[] = [];
//     try {
//       nearbyPlaces = await this.visionService.getNearbyPlacesSerp(
//         userLat,
//         userLon,
//         3000, // 3km radius
//       );
//     } catch (err) {
//       console.error('[Lens] nearbyPlaces error (zone mismatch):', err);
//     }

//     return res.status(400).json({
//       status: 400,
//       message: 'LOW_CONFIDENCE',
//       data: {
//         reason:
//           'We could not confidently match this building within your location. ' +
//           'Please try again and take a clearer photo from a different angle.',
//         nearbyPlaces,
//       },
//     });
//   }

//   // B2: inside zone but > 3km -> LOW_CONFIDENCE + nearbyPlaces
//   if (distKm > STRICT_MAX_KM) {
//     let nearbyPlaces: any[] = [];
//     try {
//       nearbyPlaces = await this.visionService.getNearbyPlacesSerp(
//         userLat,
//         userLon,
//         3000, // 3km radius
//       );
//     } catch (err) {
//       console.error('[Lens] nearbyPlaces error (strict radius):', err);
//     }

//     return res.status(400).json({
//       status: 400,
//       message: 'LOW_CONFIDENCE',
//       data: {
//         reason:
//           'We could not confidently match this building within 3km of your location. ' +
//           'Please try again and take a clearer photo from a different angle.',
//         nearbyPlaces,
//       },
//     });
//   }

//   // If you reach here: distKm <= STRICT_MAX_KM -> HIGH_CONFIDENCE / success logic below...
//   // e.g. return recognized building, etc.
// }





// //     const gpt = await this.visionService.getBuildingInfoFromChatGPT(placeName);
// //     console.log('the gpt data', gpt);

// //     // 6) Use GPT coords + user location to decide confidence / zone
// //     if (userLat != null && userLon != null) {
     
// //       // Case A: GPT has NO coordinates at all -> LOW_CONFIDENCE + nearbyPlaces
// //       if (gpt?.latitude == null || gpt?.longitude == null) {



// //         let nearbyPlaces: any[] = [];
// //         try {
// //           nearbyPlaces = await this.visionService.getNearbyPlacesSerp(
// //             userLat,
// //             userLon,
// //                3000, // 3km radius in meters
// //           );
// //         } catch (err) {
// //           console.error('[Lens/GPT] nearbyPlaces error (no coords):', err);
// //         }

// //         return res.status(400).json({
// //           status: 400,
// //           message: 'LOW_CONFIDENCE',
// //           data: {
// //             reason:
// //               'We could not confidently recognize this building (no reliable location found). ' +
// //               'Please try again and take a clearer photo from a different angle.',
// //             nearbyPlaces,
// //           },
// //         });
// //       }

// //       // Case B: GPT has coordinates -> compute distance
// //       const distKm = this.visionService.distanceKm(
// //         userLat,
// //         userLon,
// //         Number(gpt.latitude),
// //         Number(gpt.longitude),
// //       );

// //       // B1: way outside general zone -> LOCATION_MISMATCH (hard fail)
// //       if (distKm > ZONE_MAX_KM) {

// //  let nearbyPlaces: any[] = [];
// //         try {
// //           nearbyPlaces = await this.visionService.getNearbyPlacesSerp(
// //             userLat,
// //             userLon,
// //               3000, // 3km radius in meters
// //           );
// //         } catch (err) {
// //           console.error('[Lens/GPT] nearbyPlaces error (no coords):', err);
// //         }

// //         // return res.status(400).json({
// //         //   status: 400,
// //         //   message: 'LOCATION_MISMATCH',
// //         //   data: 'You are out of zone. Please come in 50KM radius',
// //         // });

        
// //         return res.status(400).json({
// //           status: 400,
// //           message: 'LOW_CONFIDENCE',
// //           data: {
// //             reason:
// //               'We could not confidently match this building within your location. ' +
// //               'Please try again and take a clearer photo from a different angle.',
// //             nearbyPlaces,
// //           },
// //         });
// //       }

// //       // B2: inside zone but > 3km -> LOW_CONFIDENCE + nearbyPlaces
// //       if (distKm > STRICT_MAX_KM) {
// //         let nearbyPlaces: any[] = [];
// //         try {
// //           nearbyPlaces = await this.visionService.getNearbyPlacesSerp(
// //             userLat,
// //             userLon,
// //                3000, // 3km radius in meters
// //           );
// //         } catch (err) {
// //           console.error('[Lens/GPT] nearbyPlaces error (strict):', err);
// //         }

// //         return res.status(400).json({
// //           status: 400,
// //           message: 'LOW_CONFIDENCE',
// //           data: {
// //             reason:
// //               'We could not confidently match this building within 3km of your location. ' +
// //               'Please try again and take a clearer photo from a different angle.',
// //             nearbyPlaces,
// //           },
// //         });
// //       }
// //     }

//     // 7) Upsert place in DB
//     const placeDoc = await this.visionService.upsertPlaceFromLens({
//       first,
//       imageUrl: lensResult.imageUrl,
//       gpt,
//     });

//     // 8) Attach place id to user
//     await this.userService.addScanIdInUser(userId, String(placeDoc._id));

//     // 9) Response: use AI title as main title
//     const displayTitle = placeDoc.ai?.title || placeDoc.title;

//     const responseData = {
//       id: placeDoc._id,
//       title: displayTitle,
//       thumbnailImage: placeDoc.images?.thumbnail,
//       originalImage: placeDoc.images?.original,
//       chatgptTitle: placeDoc.ai?.title,
//       shortDescription: placeDoc.ai?.shortDescription,
//       tourismDescription: placeDoc.ai?.tourismDescription,
//       funFacts: placeDoc.ai?.funFacts,
//       heightMeters: placeDoc.ai?.heightMeters,
//       latitude: placeDoc.ai?.latitude,
//       longitude: placeDoc.ai?.longitude,
//       architectureStyle: placeDoc.ai?.architectureStyle,
//       architectName: placeDoc.ai?.architectName,
//       location: placeDoc.ai?.location,
//     };

//     console.log('the response', responseData);

//     return res.status(200).json({
//       status: 200,
//       message: 'success',
//       data: responseData,
//     });
//   } catch (e: any) {
//     console.error('[Lens] error:', e?.message || e);
//     return res.status(400).json({
//       status: 400,
//       message: 'FAILURE',
//       data: e?.message || 'Google Lens lookup failed',
//     });
//   }
// }









// controller.ts

// @Post('lens')
// @UseGuards(AuthGuard)
// @UseFilters(new HttpExceptionFilter())
// @UseInterceptors(
//   FileFieldsInterceptor(
//     [
//       { name: 'image', maxCount: 1 },
//       { name: 'file',  maxCount: 1 },
//     ],
//     {
//       storage: memoryStorage(),
//       limits: { fileSize: 10 * 1024 * 1024 },
//     },
//   ),
// )
// async recognizeWithLenss(
//   @UploadedFiles() files: { image?: MulterFile[]; file?: MulterFile[] },
//   @Body() body: RecognizeDto,
//   @Query() query: RecognizeDto,
//   @Req() req,
//   @Res() res: Response,
// ) {
//   const get = (k: keyof RecognizeDto) => body[k] ?? query[k];
//   const userId = req.user?.sub;

//   console.log('the body', body);

//   // --- parse user location from frontend: lat, lon ---
//   const latRaw = get('lat');
//   const lonRaw = get('lon');

//   const userLat =
//     latRaw !== undefined && latRaw !== null ? Number(latRaw) : undefined;
//   const userLon =
//     lonRaw !== undefined && lonRaw !== null ? Number(lonRaw) : undefined;

//   if (
//     (latRaw !== undefined && Number.isNaN(userLat)) ||
//     (lonRaw !== undefined && Number.isNaN(userLon))
//   ) {
//     throw new BadRequestException('Invalid lat or lon');
//   }

//   // 1) Build image buffer
//   let buf: Buffer | undefined;
//   const up = files?.image?.[0] ?? files?.file?.[0];

//   if (up?.buffer) {
//     buf = up.buffer;
//   } else if (get('image_base64')) {
//     buf = Buffer.from(get('image_base64') as string, 'base64');
//   } else if (get('image_url')) {
//     const url = get('image_url') as string;
//     const resp = await axios.get<ArrayBuffer>(url, {
//       responseType: 'arraybuffer',
//       timeout: 35000,
//     });
//     buf = Buffer.from(resp.data as any);
//   }

//   if (!buf) {
//     throw new BadRequestException(
//       "Provide an image via multipart 'image'/'file', or JSON 'image_base64'/'image_url'",
//     );
//   }

//   try {
//     // 2) Google Lens via SerpApi
//     const lensResult = await this.visionService.recognizeWithGoogleLens(buf);

//     // Only treat as failure if there is NO visual match at all
//     if (!lensResult.first) {
//       let nearbyPlaces: any[] = [];

//       // If we have user location, fetch nearby famous places within 3 km
//       if (userLat != null && userLon != null) {
//         try {
//           nearbyPlaces = await this.visionService.getNearbyPlacesSerp(
//             userLat,
//             userLon,
//             3000, // 3km radius in meters
//           );
//         } catch (err) {
//           console.error('[Lens] nearbyPlaces error:', err);
//         }
//       }

//       return res.status(400).json({
//         status: 400,
//         message: 'LOW_CONFIDENCE',
//         data: {
//           reason:
//             'We could not confidently recognize this building. ' +
//             'Please try again and take a clearer photo from a different angle.',
//           nearbyPlaces,
//         },
//       });
//     }

//     const first = lensResult.first;

//     // 3) Derive canonical place name from Lens result
//     const placeName: string =
//       lensResult.label ||
//       lensResult.raw?.knowledge_graph?.title ||
//       lensResult.raw?.knowledge_graph?.name ||
//       lensResult.raw?.related_content?.[0]?.query ||
//       first.title ||
//       first.name ||
//       first.link_title ||
//       first.query ||
//       'Unknown building';

//     console.log('Derived placeName from Lens:', placeName);

//     // distance thresholds (km)
//     const STRICT_MAX_KM = 1;   // must be within 1km of user to trust match
//     const ZONE_MAX_KM   = 30;  // allowed zone radius

//     // 4) Existing place in DB? -> check area restriction, then return
//     const existing = await this.visionService.findPlaceDetailSerp(placeName);
//     if (existing) {
//       const existingAny = existing as any;

//       const existingLat =
//         existingAny.aiLatitude ??
//         existingAny.latitude ??
//         existingAny.ai?.latitude ??
//         existingAny.coordinates?.coordinates?.[1];

//       const existingLon =
//         existingAny.aiLongitude ??
//         existingAny.longitude ??
//         existingAny.ai?.longitude ??
//         existingAny.coordinates?.coordinates?.[0];

//       if (
//         userLat != null &&
//         userLon != null &&
//         existingLat != null &&
//         existingLon != null
//       ) {
//         const distKm = this.visionService.distanceKm(
//           userLat,
//           userLon,
//           Number(existingLat),
//           Number(existingLon),
//         );

//         if (distKm > ZONE_MAX_KM) {
//           return res.status(400).json({
//             status: 400,
//             message: 'LOCATION_MISMATCH',
//             data: 'You are out of zone. Please come in 50KM radius',
//           });
//         }
//       }

//       await this.userService.addScanIdInUser(userId, existing.id);
//       return res.status(200).json({
//         status: 200,
//         message: 'success',
//         data: existing,
//       });
//     }

//     // 5) No existing place by title -> call ChatGPT / AI
//     const gpt = await this.visionService.getBuildingInfoFromChatGPT(placeName);
//     console.log('the gpt data', gpt);

//     // 6) Use Google Geocoding (first) or GPT coords + user location to decide confidence / zone
//     if (userLat != null && userLon != null) {
//       let targetLat: number | null = null;
//       let targetLon: number | null = null;
//       let coordSource: 'google' | 'gpt' | null = null;

//       // 6.1) Try Google Geocoding first
//       try {
//         const googleResult = await this.visionService.searchGoogleGeocoding(
//           placeName,
//           userLat,
//           userLon,
//         );

//         if (googleResult) {
//           // Place is within 1km radius of user (your search method likely enforces this)
//           targetLat = googleResult.lat;
//           targetLon = googleResult.lon;
//           coordSource = 'google';
//           console.log('Using Google coords within 1km:', googleResult);
//         } else {
//           console.log(
//             'Place not found within 1km of user (or geocoding failed):',
//             placeName,
//           );
//         }
//       } catch (e) {
//         console.error('Error while calling Google Geocoding:', e);
//       }

//       // 6.2) If Google did NOT give coords, fallback to GPT coords
//       if (targetLat == null || targetLon == null) {
//         const gptLat =
//           gpt?.latitude != null ? Number(gpt.latitude) : NaN;
//         const gptLon =
//           gpt?.longitude != null ? Number(gpt.longitude) : NaN;

//         if (!Number.isNaN(gptLat) && !Number.isNaN(gptLon)) {
//           targetLat = gptLat;
//           targetLon = gptLon;
//           coordSource = 'gpt';
//           console.log('Using GPT coordinates:', { lat: gptLat, lon: gptLon });
//         }
//       }

//       // 6.3) If still no coordinates from Google or GPT -> LOW_CONFIDENCE + nearbyPlaces
//       if (targetLat == null || targetLon == null) {
//         let nearbyPlaces: any[] = [];
//         try {
//           nearbyPlaces = await this.visionService.getNearbyPlacesSerp(
//             userLat,
//             userLon,
//             3000, // 3km radius
//           );
//         } catch (err) {
//           console.error(
//             '[Lens] nearbyPlaces error (no coords from Google or GPT):',
//             err,
//           );
//         }

//         return res.status(400).json({
//           status: 400,
//           message: 'LOW_CONFIDENCE',
//           data: {
//             reason:
//               'We could not confidently recognize this building (no reliable location found). ' +
//               'Please try again and take a clearer photo from a different angle.',
//             nearbyPlaces,
//           },
//         });
//       }

//       // 6.4) We have coordinates (from Google or GPT) -> compute distance
//       const distKm = this.visionService.distanceKm(
//         userLat,
//         userLon,
//         targetLat,
//         targetLon,
//       );
//       console.log(`Distance from user (${coordSource}):`, distKm, 'km');

//       // Outside general zone -> treat as LOW_CONFIDENCE with nearby places
//       if (distKm > ZONE_MAX_KM) {
//         let nearbyPlaces: any[] = [];
//         try {
//           nearbyPlaces = await this.visionService.getNearbyPlacesSerp(
//             userLat,
//             userLon,
//             3000, // 3km radius
//           );
//         } catch (err) {
//           console.error('[Lens] nearbyPlaces error (zone mismatch):', err);
//         }

//         return res.status(400).json({
//           status: 400,
//           message: 'LOW_CONFIDENCE',
//           data: {
//             reason:
//               'We could not confidently match this building within your location. ' +
//               'Please try again and take a clearer photo from a different angle.',
//             nearbyPlaces,
//           },
//         });
//       }

//       // Inside zone but > STRICT_MAX_KM -> still LOW_CONFIDENCE
//       if (distKm > STRICT_MAX_KM) {
//         let nearbyPlaces: any[] = [];
//         try {
//           nearbyPlaces = await this.visionService.getNearbyPlacesSerp(
//             userLat,
//             userLon,
//             3000, // 3km radius
//           );
//         } catch (err) {
//           console.error('[Lens] nearbyPlaces error (strict radius):', err);
//         }

//         return res.status(400).json({
//           status: 400,
//           message: 'LOW_CONFIDENCE',
//           data: {
//             reason:
//               'We could not confidently match this building within 3km of your location. ' +
//               'Please try again and take a clearer photo from a different angle.',
//             nearbyPlaces,
//           },
//         });
//       }

//       // If you reach here: distKm <= STRICT_MAX_KM -> HIGH_CONFIDENCE
//     }

//     // 6b) HIGH_CONFIDENCE: now check AGAIN by canonical AI title to avoid duplicates
//     //     Example: two docs:
//     //       title: "8 Spruce - Wikipedia", ai.title: "8 Spruce"
//     //       title: "File:8 Spruce Street April 2022 003.jpg - Wikimedia Commons", ai.title: "8 Spruce"
//     //     We want to reuse existing record where ai.title == gpt.title
//     if (gpt?.name) {
//       const aiTitle = String(gpt.name).trim();
//       if (aiTitle) {
//         const existingByAi =
//           await this.visionService.findPlaceDetailByAiTitle(aiTitle);

//         if (existingByAi) {
//           await this.userService.addScanIdInUser(userId, existingByAi.id);
//           return res.status(200).json({
//             status: 200,
//             message: 'success',
//             data: existingByAi,
//           });
//         }
//       }
//     }

//     // 7) No existing place -> upsert place in DB from Lens + GPT
//     const placeDoc = await this.visionService.upsertPlaceFromLens({
//       first,
//       imageUrl: lensResult.imageUrl,
//       gpt,
//     });

//     // 8) Attach place id to user
//     await this.userService.addScanIdInUser(userId, String(placeDoc._id));

//     // 9) Response: use AI title as main title
//     const displayTitle = placeDoc.ai?.title || placeDoc.title;

//     const responseData = {
//       id: placeDoc._id,
//       title: displayTitle,
//       thumbnailImage: placeDoc.images?.thumbnail,
//       originalImage: placeDoc.images?.original,
//       chatgptTitle: placeDoc.ai?.title,
//       shortDescription: placeDoc.ai?.shortDescription,
//       tourismDescription: placeDoc.ai?.tourismDescription,
//       funFacts: placeDoc.ai?.funFacts,
//       heightMeters: placeDoc.ai?.heightMeters,
//       latitude: placeDoc.ai?.latitude,
//       longitude: placeDoc.ai?.longitude,
//       architectureStyle: placeDoc.ai?.architectureStyle,
//       architectName: placeDoc.ai?.architectName,
//       location: placeDoc.ai?.location,
//     };

//     console.log('the response', responseData);

//     return res.status(200).json({
//       status: 200,
//       message: 'success',
//       data: responseData,
//     });
//   } catch (e: any) {
//     console.error('[Lens] error:', e?.message || e);
//     return res.status(400).json({
//       status: 400,
//       message: 'FAILURE',
//       data: e?.message || 'Google Lens lookup failed',
//     });
//   }
// }













// @Post('lens')
// @UseGuards(AuthGuard)
// @UseFilters(new HttpExceptionFilter())
// @UseInterceptors(
//   FileFieldsInterceptor(
//     [
//       { name: 'image', maxCount: 1 },
//       { name: 'file',  maxCount: 1 },
//     ],
//     {
//       storage: memoryStorage(),
//       limits: { fileSize: 10 * 1024 * 1024 },
//     },
//   ),
// )
// async recognizeWithLenss(
//   @UploadedFiles() files: { image?: MulterFile[]; file?: MulterFile[] },
//   @Body() body: RecognizeDto,
//   @Query() query: RecognizeDto,
//   @Req() req,
//   @Res() res: Response,
// ) {
//   const get = (k: keyof RecognizeDto) => body[k] ?? query[k];
//   const userId = req.user?.sub;

//   console.log('the body', body);

//   // --- parse user location from frontend: lat, lon ---
//   const latRaw = get('lat');
//   const lonRaw = get('lon');

//   const userLat =
//     latRaw !== undefined && latRaw !== null ? Number(latRaw) : undefined;
//   const userLon =
//     lonRaw !== undefined && lonRaw !== null ? Number(lonRaw) : undefined;

//   if (
//     (latRaw !== undefined && Number.isNaN(userLat)) ||
//     (lonRaw !== undefined && Number.isNaN(userLon))
//   ) {
//     throw new BadRequestException('Invalid lat or lon');
//   }

//   // 1) Build image buffer
//   let buf: Buffer | undefined;
//   const up = files?.image?.[0] ?? files?.file?.[0];

//   if (up?.buffer) {
//     buf = up.buffer;
//   } else if (get('image_base64')) {
//     buf = Buffer.from(get('image_base64') as string, 'base64');
//   } else if (get('image_url')) {
//     const url = get('image_url') as string;
//     const resp = await axios.get<ArrayBuffer>(url, {
//       responseType: 'arraybuffer',
//       timeout: 35000,
//     });
//     buf = Buffer.from(resp.data as any);
//   }

//   if (!buf) {
//     throw new BadRequestException(
//       "Provide an image via multipart 'image'/'file', or JSON 'image_base64'/'image_url'",
//     );
//   }

//   // Helper to load nearby places (3km radius)
//   const loadNearbyPlaces = async () => {
//     if (userLat == null || userLon == null) return [];
//     try {
//       return await this.visionService.getNearbyPlacesSerp(
//         userLat,
//         userLon,
//         3000, // 3km radius
//       );
//     } catch (err) {
//       console.error('[Lens] nearbyPlaces error:', err);
//       return [];
//     }
//   };

//   try {
//     // 2) Google Lens via SerpApi
//     const lensResult = await this.visionService.recognizeWithGoogleLens(buf);

//     // Only treat as failure if there is NO visual match at all
//     if (!lensResult.first) {
//       const nearbyPlaces = await loadNearbyPlaces();
//       return res.status(400).json({
//         status: 400,
//         message: 'LOW_CONFIDENCE',
//         data: {
//           reason:
//             'We could not confidently recognize this building. ' +
//             'Please try again and take a clearer photo from a different angle.',
//           nearbyPlaces,
//         },
//       });
//     }

//     const first = lensResult.first;

//     // 3) Derive canonical place name
//     const placeName: string =
//       lensResult.label ||
//       lensResult.raw?.knowledge_graph?.title ||
//       lensResult.raw?.knowledge_graph?.name ||
//       lensResult.raw?.related_content?.[0]?.query ||
//       first.title ||
//       first.name ||
//       first.link_title ||
//       first.query ||
//       'Unknown building';

//     console.log('Derived placeName from Lens:', placeName);

//     // distance thresholds (km)
//     const STRICT_MAX_KM = 1;   // must be within 1km of user to trust match
//     const ZONE_MAX_KM   = 30;  // allowed zone radius

//     // 4) Existing place in DB? -> check area restriction, then return
//     const existing = await this.visionService.findPlaceDetailSerp(placeName);
//     if (existing) {
//       const existingAny = existing as any;

//       const existingLat =
//         existingAny.aiLatitude ??
//         existingAny.latitude ??
//         existingAny.ai?.latitude ??
//         existingAny.coordinates?.coordinates?.[1];

//       const existingLon =
//         existingAny.aiLongitude ??
//         existingAny.longitude ??
//         existingAny.ai?.longitude ??
//         existingAny.coordinates?.coordinates?.[0];

//       if (
//         userLat != null &&
//         userLon != null &&
//         existingLat != null &&
//         existingLon != null
//       ) {
//         const distKm = this.visionService.distanceKm(
//           userLat,
//           userLon,
//           Number(existingLat),
//           Number(existingLon),
//         );

//         if (distKm > ZONE_MAX_KM) {
//           return res.status(400).json({
//             status: 400,
//             message: 'LOCATION_MISMATCH',
//             data: 'You are out of zone. Please come in 50KM radius',
//           });
//         }
//       }

//       await this.userService.addScanIdInUser(userId, existing.id);
//       return res.status(200).json({
//         status: 200,
//         message: 'success',
//         data: existing,
//       });
//     }

//     // 5) No existing place -> call ChatGPT / AI
//     const gpt = await this.visionService.getBuildingInfoFromChatGPT(placeName);
//     console.log('the gpt data', gpt);

//     // 5b) If GPT data is basically empty -> LOW_CONFIDENCE (your requested behavior)
//     const normalize = (v: any) =>
//       typeof v === 'string'
//         ? v.trim()
//         : v == null
//         ? ''
//         : String(v).trim();

//     const gptName = normalize(gpt?.name ?? '');
//     const shortDesc = normalize(gpt?.shortDescription);
//     const tourismDesc = normalize(gpt?.tourismDescription);
//     const archStyle = normalize(gpt?.architectureStyle);
//     const architectName = normalize(gpt?.architectName);
//     const locText = normalize(gpt?.location);

//     const isGptEmpty =
//       !gpt ||
//       (
//         !gptName &&
//         !shortDesc &&
//         !tourismDesc &&
//         (!Array.isArray(gpt?.funFacts) || gpt.funFacts.length === 0) &&
//         gpt?.heightMeters == null &&
//         gpt?.latitude == null &&
//         gpt?.longitude == null &&
//         !archStyle &&
//         !architectName &&
//         !locText
//       );

//     if (isGptEmpty) {
//       console.log('GPT data is empty/undefined -> LOW_CONFIDENCE');
//       const nearbyPlaces = await loadNearbyPlaces();
//       return res.status(400).json({
//         status: 400,
//         message: 'LOW_CONFIDENCE',
//         data: {
//           reason:
//             'We could not confidently recognize this building. ' +
//             'Please try again and take a clearer photo from a different angle.',
//           nearbyPlaces,
//         },
//       });
//     }

//     // 6) Use Google Geocoding (first) or GPT coords + user location to decide confidence / zone
//     if (userLat != null && userLon != null) {
//       let targetLat: number | null = null;
//       let targetLon: number | null = null;
//       let coordSource: 'google' | 'gpt' | null = null;

//       // 6.1) Try Google Geocoding first
//       try {
//         const googleResult = await this.visionService.searchGoogleGeocoding(
//           placeName,
//           userLat,
//           userLon,
//         );

//         if (googleResult) {
//           targetLat = googleResult.lat;
//           targetLon = googleResult.lon;
//           coordSource = 'google';
//           console.log('Using Google coords within 1km:', googleResult);
//         } else {
//           console.log(
//             'Place not found within 1km of user (or geocoding failed):',
//             placeName,
//           );
//         }
//       } catch (e) {
//         console.error('Error while calling Google Geocoding:', e);
//       }

//       // 6.2) If Google did NOT give coords, fallback to GPT coords
//       if (targetLat == null || targetLon == null) {
//         const gptLat =
//           gpt?.latitude != null ? Number(gpt.latitude) : NaN;
//         const gptLon =
//           gpt?.longitude != null ? Number(gpt.longitude) : NaN;

//         if (!Number.isNaN(gptLat) && !Number.isNaN(gptLon)) {
//           targetLat = gptLat;
//           targetLon = gptLon;
//           coordSource = 'gpt';
//           console.log('Using GPT coordinates:', { lat: gptLat, lon: gptLon });
//         }
//       }

//       // 6.3) If still no coordinates from Google or GPT -> LOW_CONFIDENCE + nearbyPlaces
//       if (targetLat == null || targetLon == null) {
//         const nearbyPlaces = await loadNearbyPlaces();
//         return res.status(400).json({
//           status: 400,
//           message: 'LOW_CONFIDENCE',
//           data: {
//             reason:
//               'We could not confidently recognize this building (no reliable location found). ' +
//               'Please try again and take a clearer photo from a different angle.',
//             nearbyPlaces,
//           },
//         });
//       }

//       // 6.4) We have coordinates (from Google or GPT) -> compute distance
//       const distKm = this.visionService.distanceKm(
//         userLat,
//         userLon,
//         targetLat,
//         targetLon,
//       );
//       console.log(`Distance from user (${coordSource}):`, distKm, 'km');

//       // Outside general zone -> treat as LOW_CONFIDENCE
//       if (distKm > ZONE_MAX_KM) {
//         const nearbyPlaces = await loadNearbyPlaces();
//         return res.status(400).json({
//           status: 400,
//           message: 'LOW_CONFIDENCE',
//           data: {
//             reason:
//               'We could not confidently match this building within your location. ' +
//               'Please try again and take a clearer photo from a different angle.',
//             nearbyPlaces,
//           },
//         });
//       }

//       // Inside zone but > STRICT_MAX_KM -> still LOW_CONFIDENCE
//       if (distKm > STRICT_MAX_KM) {
//         const nearbyPlaces = await loadNearbyPlaces();
//         return res.status(400).json({
//           status: 400,
//           message: 'LOW_CONFIDENCE',
//           data: {
//             reason:
//               'We could not confidently match this building within 3km of your location. ' +
//               'Please try again and take a clearer photo from a different angle.',
//             nearbyPlaces,
//           },
//         });
//       }

//       // If you reach here: distKm <= STRICT_MAX_KM -> HIGH_CONFIDENCE
//     }

//     // 6b) HIGH_CONFIDENCE: optional dedupe by AI canonical title (ai.title)
//     const canonicalTitle = normalize(gptName);
//     if (canonicalTitle) {
//       try {
//         const existingByAi =
//           await this.visionService.findPlaceDetailByAiTitle(canonicalTitle);
//         if (existingByAi) {
//           await this.userService.addScanIdInUser(userId, existingByAi.id);
//           return res.status(200).json({
//             status: 200,
//             message: 'success',
//             data: existingByAi,
//           });
//         }
//       } catch (err) {
//         console.error('[Lens] findPlaceDetailByAiTitle error:', err);
//       }
//     }

//     // 7) Upsert place in DB
//     const placeDoc = await this.visionService.upsertPlaceFromLens({
//       first,
//       imageUrl: lensResult.imageUrl,
//       gpt,
//     });

//     // 8) Attach place id to user
//     await this.userService.addScanIdInUser(userId, String(placeDoc._id));

//     // 9) Response: use AI title as main title if present
//     const displayTitle = placeDoc.ai?.title || placeDoc.title;

//     const responseData = {
//       id: placeDoc._id,
//       title: displayTitle,
//       thumbnailImage: placeDoc.images?.thumbnail,
//       originalImage: placeDoc.images?.original,
//       chatgptTitle: placeDoc.ai?.title,
//       shortDescription: placeDoc.ai?.shortDescription,
//       tourismDescription: placeDoc.ai?.tourismDescription,
//       funFacts: placeDoc.ai?.funFacts,
//       heightMeters: placeDoc.ai?.heightMeters,
//       latitude: placeDoc.ai?.latitude,
//       longitude: placeDoc.ai?.longitude,
//       architectureStyle: placeDoc.ai?.architectureStyle || '',
//       architectName: placeDoc.ai?.architectName,
//       location: placeDoc.ai?.location,
//     };

//     console.log('the response', responseData);

//     return res.status(200).json({
//       status: 200,
//       message: 'success',
//       data: responseData,
//     });
//   } catch (e: any) {
//     console.error('[Lens] error:', e?.message || e);
//     return res.status(400).json({
//       status: 400,
//       message: 'FAILURE',
//       data: e?.message || 'Google Lens lookup failed',
//     });
//   }
// }






// @Post('lens')
// @UseGuards(AuthGuard)
// @UseFilters(new HttpExceptionFilter())
// @UseInterceptors(
//   FileFieldsInterceptor(
//     [
//       { name: 'image', maxCount: 1 },
//       { name: 'file',  maxCount: 1 },
//     ],
//     {
//       storage: memoryStorage(),
//       limits: { fileSize: 10 * 1024 * 1024 },
//     },
//   ),
// )
// async recognizeWithLenss(
//   @UploadedFiles() files: { image?: MulterFile[]; file?: MulterFile[] },
//   @Body() body: RecognizeDto,
//   @Query() query: RecognizeDto,
//   @Req() req,
//   @Res() res: Response,
// ) {
//   const get = (k: keyof RecognizeDto) => body[k] ?? query[k];
//   const userId = req.user?.sub;

//   console.log('the body', body);

//   // --- parse user location from frontend: lat, lon ---
//   const latRaw = get('lat');
//   const lonRaw = get('lon');

//   const userLat = 40.7111884453876
//   const userLon = -74.00532291283182

//   // const userLat =
//   //   latRaw !== undefined && latRaw !== null ? Number(latRaw) : undefined;
//   // const userLon =
//   //   lonRaw !== undefined && lonRaw !== null ? Number(lonRaw) : undefined;

//   if (
//     (latRaw !== undefined && Number.isNaN(userLat)) ||
//     (lonRaw !== undefined && Number.isNaN(userLon))
//   ) {
//     throw new BadRequestException('Invalid lat or lon');
//   }

//   // 1) Build image buffer
//   let buf: Buffer | undefined;
//   const up = files?.image?.[0] ?? files?.file?.[0];

//   if (up?.buffer) {
//     buf = up.buffer;
//   } else if (get('image_base64')) {
//     buf = Buffer.from(get('image_base64') as string, 'base64');
//   } else if (get('image_url')) {
//     const url = get('image_url') as string;
//     const resp = await axios.get<ArrayBuffer>(url, {
//       responseType: 'arraybuffer',
//       timeout: 35000,
//     });
//     buf = Buffer.from(resp.data as any);
//   }

//   if (!buf) {
//     throw new BadRequestException(
//       "Provide an image via multipart 'image'/'file', or JSON 'image_base64'/'image_url'",
//     );
//   }

//   // Helper to load nearby places (3km radius)
//   const loadNearbyPlaces = async () => {
//     if (userLat == null || userLon == null) return [];
//     try {
//       return await this.visionService.getNearbyPlacesSerp(
//         userLat,
//         userLon,
//         3000, // 3km radius
//       );
//     } catch (err) {
//       console.error('[Lens] nearbyPlaces error:', err);
//       return [];
//     }
//   };

//   try {
//     // 2) Google Lens via SerpApi
//     const lensResult = await this.visionService.recognizeWithGoogleLens(buf);

//     // Only treat as failure if there is NO visual match at all
//     if (!lensResult.first) {
//       const nearbyPlaces = await loadNearbyPlaces();
//       return res.status(400).json({
//         status: 400,
//         message: 'LOW_CONFIDENCE',
//         data: {
//           reason:
//             'We could not confidently recognize this building. ' +
//             'Please try again and take a clearer photo from a different angle.',
//           nearbyPlaces,
//         },
//       });
//     }

//     const first = lensResult.first;

//     // 3) Derive canonical place name
//     const placeName: string =
//       lensResult.label ||
//       lensResult.raw?.knowledge_graph?.title ||
//       lensResult.raw?.knowledge_graph?.name ||
//       lensResult.raw?.related_content?.[0]?.query ||
//       first.title ||
//       first.name ||
//       first.link_title ||
//       first.query ||
//       'Unknown building';

//     console.log('Derived placeName from Lens:', placeName);

//     // distance thresholds (km)
//     const STRICT_MAX_KM = 1;   // must be within 1km of user to trust match
//     const ZONE_MAX_KM   = 30;  // allowed zone radius

//     // 4) Existing place in DB by main title? -> check area restriction, then return
//     const existing = await this.visionService.findPlaceDetailSerp(placeName);
//     if (existing) {
//       const existingAny = existing as any;

//       const existingLat =
//         existingAny.aiLatitude ??
//         existingAny.latitude ??
//         existingAny.ai?.latitude ??
//         existingAny.coordinates?.coordinates?.[1];

//       const existingLon =
//         existingAny.aiLongitude ??
//         existingAny.longitude ??
//         existingAny.ai?.longitude ??
//         existingAny.coordinates?.coordinates?.[0];

//       if (
//         userLat != null &&
//         userLon != null &&
//         existingLat != null &&
//         existingLon != null
//       ) {
//         const distKm = this.visionService.distanceKm(
//           userLat,
//           userLon,
//           Number(existingLat),
//           Number(existingLon),
//         );

//         if (distKm > ZONE_MAX_KM) {
//           return res.status(400).json({
//             status: 400,
//             message: 'LOCATION_MISMATCH',
//             data: 'You are out of zone. Please come in 50KM radius',
//           });
//         }
//       }

//       await this.userService.addScanIdInUser(userId, existing.id);
//       return res.status(200).json({
//         status: 200,
//         message: 'success',
//         data: existing,
//       });
//     }

//     // 4b) Existing place in DB by AI title? (ai.title == placeName)
//     //     This handles cases where Google Lens name == AI title,
//     //     but DB `title` is different (e.g. "8 Spruce - Wikipedia").
//     const existingByAiTitle =
//       await this.visionService.findPlaceDetailByAiTitle(placeName);
//     if (existingByAiTitle) {
//       console.log("in existingByAiTitle ", existingByAiTitle)
//       const existingAny = existingByAiTitle as any;

//       const existingLat =
//         existingAny.aiLatitude ??
//         existingAny.latitude ??
//         existingAny.ai?.latitude ??
//         existingAny.coordinates?.coordinates?.[1];

//       const existingLon =
//         existingAny.aiLongitude ??
//         existingAny.longitude ??
//         existingAny.ai?.longitude ??
//         existingAny.coordinates?.coordinates?.[0];

//       if (
//         userLat != null &&
//         userLon != null &&
//         existingLat != null &&
//         existingLon != null
//       ) {
//         const distKm = this.visionService.distanceKm(
//           userLat,
//           userLon,
//           Number(existingLat),
//           Number(existingLon),
//         );

//         if (distKm > ZONE_MAX_KM) {
//           return res.status(400).json({
//             status: 400,
//             message: 'LOCATION_MISMATCH',
//             data: 'You are out of zone. Please come in 50KM radius',
//           });
//         }
//       }

//       await this.userService.addScanIdInUser(userId, existingByAiTitle.id);
//       return res.status(200).json({
//         status: 200,
//         message: 'success',
//         data: existingByAiTitle,
//       });
//     }

//     // 5) No existing place -> call ChatGPT / AI
//     const gpt = await this.visionService.getBuildingInfoFromChatGPT(placeName);
//     console.log('the gpt data', gpt);

//     // 5b) If GPT data is basically empty -> LOW_CONFIDENCE
//     const normalize = (v: any) =>
//       typeof v === 'string'
//         ? v.trim()
//         : v == null
//         ? ''
//         : String(v).trim();

//     const gptName = normalize(gpt?.name ?? '');
//     const shortDesc = normalize(gpt?.shortDescription);
//     const tourismDesc = normalize(gpt?.tourismDescription);
//     const archStyle = normalize(gpt?.architectureStyle);
//     const architectName = normalize(gpt?.architectName);
//     const locText = normalize(gpt?.location);

//     const isGptEmpty =
//       !gpt ||
//       (
//         !gptName &&
//         !shortDesc &&
//         !tourismDesc &&
//         (!Array.isArray(gpt?.funFacts) || gpt.funFacts.length === 0) &&
//         gpt?.heightMeters == null &&
//         gpt?.latitude == null &&
//         gpt?.longitude == null &&
//         !archStyle &&
//         !architectName &&
//         !locText
//       );

//     if (isGptEmpty) {
//       console.log('GPT data is empty/undefined -> LOW_CONFIDENCE');
//       const nearbyPlaces = await loadNearbyPlaces();
//       return res.status(400).json({
//         status: 400,
//         message: 'LOW_CONFIDENCE',
//         data: {
//           reason:
//             'We could not confidently recognize this building. ' +
//             'Please try again and take a clearer photo from a different angle.',
//           nearbyPlaces,
//         },
//       });
//     }

//     // 6) Use Google Geocoding (first) or GPT coords + user location to decide confidence / zone
//     if (userLat != null && userLon != null) {
//       let targetLat: number | null = null;
//       let targetLon: number | null = null;
//       let coordSource: 'google' | 'gpt' | null = null;

//       // 6.1) Try Google Geocoding first
//       try {
//         const googleResult = await this.visionService.searchGoogleGeocoding(
//           placeName,
//           userLat,
//           userLon,
//         );

//         if (googleResult) {
//           targetLat = googleResult.lat;
//           targetLon = googleResult.lon;
//           coordSource = 'google';
//           console.log('Using Google coords within 1km:', googleResult);
//         } else {
//           console.log(
//             'Place not found within 1km of user (or geocoding failed):',
//             placeName,
//           );
//         }
//       } catch (e) {
//         console.error('Error while calling Google Geocoding:', e);
//       }

//       // 6.2) If Google did NOT give coords, fallback to GPT coords
//       if (targetLat == null || targetLon == null) {
//         const gptLat =
//           gpt?.latitude != null ? Number(gpt.latitude) : NaN;
//         const gptLon =
//           gpt?.longitude != null ? Number(gpt.longitude) : NaN;

//         if (!Number.isNaN(gptLat) && !Number.isNaN(gptLon)) {
//           targetLat = gptLat;
//           targetLon = gptLon;
//           coordSource = 'gpt';
//           console.log('Using GPT coordinates:', { lat: gptLat, lon: gptLon });
//         }
//       }

//       // 6.3) If still no coordinates from Google or GPT -> LOW_CONFIDENCE + nearbyPlaces
//       if (targetLat == null || targetLon == null) {
//         const nearbyPlaces = await loadNearbyPlaces();
//         return res.status(400).json({
//           status: 400,
//           message: 'LOW_CONFIDENCE',
//           data: {
//             reason:
//               'We could not confidently recognize this building (no reliable location found). ' +
//               'Please try again and take a clearer photo from a different angle.',
//             nearbyPlaces,
//           },
//         });
//       }

//       // 6.4) We have coordinates (from Google or GPT) -> compute distance
//       const distKm = this.visionService.distanceKm(
//         userLat,
//         userLon,
//         targetLat,
//         targetLon,
//       );
//       console.log(`Distance from user (${coordSource}):`, distKm, 'km');

//       // Outside general zone -> treat as LOW_CONFIDENCE
//       if (distKm > ZONE_MAX_KM) {
//         const nearbyPlaces = await loadNearbyPlaces();
//         return res.status(400).json({
//           status: 400,
//           message: 'LOW_CONFIDENCE',
//           data: {
//             reason:
//               'We could not confidently match this building within your location. ' +
//               'Please try again and take a clearer photo from a different angle.',
//             nearbyPlaces,
//           },
//         });
//       }

//       // Inside zone but > STRICT_MAX_KM -> still LOW_CONFIDENCE
//       if (distKm > STRICT_MAX_KM) {
//         const nearbyPlaces = await loadNearbyPlaces();
//         return res.status(400).json({
//           status: 400,
//           message: 'LOW_CONFIDENCE',
//           data: {
//             reason:
//               'We could not confidently match this building within 3km of your location. ' +
//               'Please try again and take a clearer photo from a different angle.',
//             nearbyPlaces,
//           },
//         });
//       }

//       // If you reach here: distKm <= STRICT_MAX_KM -> HIGH_CONFIDENCE
//     }

//     // 6b) HIGH_CONFIDENCE: optional dedupe by AI canonical title (from GPT)
//     const canonicalTitle = gptName; // already normalized above
//     if (canonicalTitle) {
//       try {
//         const existingByAi =
//           await this.visionService.findPlaceDetailByAiTitle(canonicalTitle);
//         if (existingByAi) {
//           await this.userService.addScanIdInUser(userId, existingByAi.id);
//           return res.status(200).json({
//             status: 200,
//             message: 'success',
//             data: existingByAi,
//           });
//         }
//       } catch (err) {
//         console.error('[Lens] findPlaceDetailByAiTitle error:', err);
//       }
//     }

//     // 7) Upsert place in DB
//     const placeDoc = await this.visionService.upsertPlaceFromLens({
//       first,
//       imageUrl: lensResult.imageUrl,
//       gpt,
//     });

//     // 8) Attach place id to user
//     await this.userService.addScanIdInUser(userId, String(placeDoc._id));

//     // 9) Response: use AI title as main title if present
//     const displayTitle = placeDoc.ai?.title || placeDoc.title;

//     const responseData = {
//       id: placeDoc._id,
//       title: displayTitle,
//       thumbnailImage: placeDoc.images?.thumbnail,
//       originalImage: placeDoc.images?.original,
//       chatgptTitle: placeDoc.ai?.title,
//       shortDescription: placeDoc.ai?.shortDescription,
//       tourismDescription: placeDoc.ai?.tourismDescription,
//       funFacts: placeDoc.ai?.funFacts,
//       heightMeters: placeDoc.ai?.heightMeters,
//       latitude: placeDoc.ai?.latitude,
//       longitude: placeDoc.ai?.longitude,
//       architectureStyle: placeDoc.ai?.architectureStyle || '',
//       architectName: placeDoc.ai?.architectName,
//       location: placeDoc.ai?.location,
//     };

//     console.log('the response', responseData);

//     return res.status(200).json({
//       status: 200,
//       message: 'success',
//       data: responseData,
//     });
//   } catch (e: any) {
//     console.error('[Lens] error:', e?.message || e);
//     return res.status(400).json({
//       status: 400,
//       message: 'FAILURE',
//       data: e?.message || 'Google Lens lookup failed',
//     });
//   }
// }





// @Post('lens')
// @UseGuards(AuthGuard)
// @UseFilters(new HttpExceptionFilter())
// @UseInterceptors(
//   FileFieldsInterceptor(
//     [
//       { name: 'image', maxCount: 1 },
//       { name: 'file',  maxCount: 1 },
//     ],
//     {
//       storage: memoryStorage(),
//       limits: { fileSize: 10 * 1024 * 1024 },
//     },
//   ),
// )
// async recognizeWithLenss(
//   @UploadedFiles() files: { image?: MulterFile[]; file?: MulterFile[] },
//   @Body() body: RecognizeDto,
//   @Query() query: RecognizeDto,
//   @Req() req,
//   @Res() res: Response,
// ) {
//   const get = (k: keyof RecognizeDto) => body[k] ?? query[k];
//   const userId = req.user?.sub;

//   console.log('the body', body);

//   // --- parse user location from frontend: lat, lon ---
//   const latRaw = get('lat');
//   const lonRaw = get('lon');


// // const userLat = 40.74515301564258
// // const userLon = -73.97522004981336



//   const userLat =
//     latRaw !== undefined && latRaw !== null ? Number(latRaw) : undefined;
//   const userLon =
//     lonRaw !== undefined && lonRaw !== null ? Number(lonRaw) : undefined;

//   if (
//     (latRaw !== undefined && Number.isNaN(userLat)) ||
//     (lonRaw !== undefined && Number.isNaN(userLon))
//   ) {
//     throw new BadRequestException('Invalid lat or lon');
//   }

//   // 1) Build image buffer
//   let buf: Buffer | undefined;
//   const up = files?.image?.[0] ?? files?.file?.[0];

//   if (up?.buffer) {
//     buf = up.buffer;
//   } else if (get('image_base64')) {
//     buf = Buffer.from(get('image_base64') as string, 'base64');
//   } else if (get('image_url')) {
//     const url = get('image_url') as string;
//     const resp = await axios.get<ArrayBuffer>(url, {
//       responseType: 'arraybuffer',
//       timeout: 35000,
//     });
//     buf = Buffer.from(resp.data as any);
//   }

//   if (!buf) {
//     throw new BadRequestException(
//       "Provide an image via multipart 'image'/'file', or JSON 'image_base64'/'image_url'",
//     );
//   }




//   const loadNearbyData = async () => {
//   if (userLat == null || userLon == null) {
//     return { nearbyPlaces: [], areaName: null };
//   }

//   try {
//     const [nearbyPlaces, areaName] = await Promise.all([
//       this.visionService.getNearbyPlacesSerp(userLat, userLon, 10000),
//       this.visionService.getAreaNameFromCoords(userLat, userLon),
//     ]);

//     return { nearbyPlaces, areaName };
//   } catch (err) {
//     console.error('[Lens] nearbyData error:', err);
//     return { nearbyPlaces: [], areaName: null };
//   }
// };

//   try {
//     // 2) Google Lens via SerpApi
//     const lensResult = await this.visionService.recognizeWithGoogleLens(buf);

//     // Only treat as failure if there is NO visual match at all
//     if (!lensResult.first) {
// const { nearbyPlaces, areaName } = await loadNearbyData();



// const areaText = areaName ? areaName : 'your area';
// console.log("the first is", areaText)

// return res.status(400).json({
//   status: 400,
//   message: 'LOW_CONFIDENCE',
//   data: {
//     reason:
//       'We couldn’t identify this building. Please try again and take a clearer photo from a different angle. ' +
//       `Wherever you’re in ${areaText}, here are great things to do nearby`,
//     nearbyPlaces,
//   },
// });
//     }

//     const first = lensResult.first;

//     // 3) Derive canonical place name from Lens
//     const placeName: string =
//       lensResult.label ||
//       lensResult.raw?.knowledge_graph?.title ||
//       lensResult.raw?.knowledge_graph?.name ||
//       lensResult.raw?.related_content?.[0]?.query ||
//       first.title ||
//       first.name ||
//       first.link_title ||
//       first.query ||
//       'Unknown building';

//     console.log('Derived placeName from Lens:', placeName);

//     // distance thresholds (km)
//     const STRICT_MAX_KM = 1;   // must be within 1km of user to trust match
//     const ZONE_MAX_KM   = 30;  // allowed zone radius

//     // 4) Existing place in DB by main title? -> check area restriction, then return
//     const existing = await this.visionService.findPlaceDetailSerp(placeName);
//     if (existing) {
//       const existingAny = existing as any;

//       const existingLat =
//         existingAny.aiLatitude ??
//         existingAny.latitude ??
//         existingAny.ai?.latitude ??
//         existingAny.coordinates?.coordinates?.[1];

//       const existingLon =
//         existingAny.aiLongitude ??
//         existingAny.longitude ??
//         existingAny.ai?.longitude ??
//         existingAny.coordinates?.coordinates?.[0];

//       if (
//         userLat != null &&
//         userLon != null &&
//         existingLat != null &&
//         existingLon != null
//       ) {
//         const distKm = this.visionService.distanceKm(
//           userLat,
//           userLon,
//           Number(existingLat),
//           Number(existingLon),
//         );

//         if (distKm > ZONE_MAX_KM) {
//           return res.status(400).json({
//             status: 400,
//             message: 'LOCATION_MISMATCH',
//             data: 'You are out of zone. Please come in 50KM radius',
//           });
//         }
//       }

//       await this.userService.addScanIdInUser(userId, existing.id);
//       return res.status(200).json({
//         status: 200,
//         message: 'success',
//         data: existing,
//       });
//     }

//     // 4b) Existing place in DB by AI title? (ai.title == placeName)
//     const existingByAiTitle =
//       await this.visionService.findPlaceDetailByAiTitle(placeName);
//     if (existingByAiTitle) {
//       console.log('in existingByAiTitle ', existingByAiTitle);
//       const existingAny = existingByAiTitle as any;

//       const existingLat =
//         existingAny.aiLatitude ??
//         existingAny.latitude ??
//         existingAny.ai?.latitude ??
//         existingAny.coordinates?.coordinates?.[1];

//       const existingLon =
//         existingAny.aiLongitude ??
//         existingAny.longitude ??
//         existingAny.ai?.longitude ??
//         existingAny.coordinates?.coordinates?.[0];

//       if (
//         userLat != null &&
//         userLon != null &&
//         existingLat != null &&
//         existingLon != null
//       ) {
//         const distKm = this.visionService.distanceKm(
//           userLat,
//           userLon,
//           Number(existingLat),
//           Number(existingLon),
//         );

//         if (distKm > ZONE_MAX_KM) {
//           return res.status(400).json({
//             status: 400,
//             message: 'LOCATION_MISMATCH',
//             data: 'You are out of zone. Please come in 50KM radius',
//           });
//         }
//       }

//       await this.userService.addScanIdInUser(userId, existingByAiTitle.id);
//       return res.status(200).json({
//         status: 200,
//         message: 'success',
//         data: existingByAiTitle,
//       });
//     }

//     // 5) No existing place -> call ChatGPT / AI
//     const gpt = await this.visionService.getBuildingInfoFromChatGPT(placeName);
//     console.log('the gpt data', gpt);

//     // 5b) If GPT data is basically empty -> LOW_CONFIDENCE
//     const normalize = (v: any) =>
//       typeof v === 'string'
//         ? v.trim()
//         : v == null
//         ? ''
//         : String(v).trim();

//     const gptName = normalize(gpt?.name ?? '');
//     const shortDesc = normalize(gpt?.shortDescription);
//     const tourismDesc = normalize(gpt?.tourismDescription);
//     const archStyle = normalize(gpt?.architectureStyle);
//     const architectName = normalize(gpt?.architectName);
//     const locText = normalize(gpt?.location);

//     const isGptEmpty =
//       !gpt ||
//       (
//         !gptName &&
//         !shortDesc &&
//         !tourismDesc &&
//         (!Array.isArray(gpt?.funFacts) || gpt.funFacts.length === 0) &&
//         gpt?.heightMeters == null &&
//         gpt?.latitude == null &&
//         gpt?.longitude == null &&
//         !archStyle &&
//         !architectName &&
//         !locText
//       );

//     if (isGptEmpty) {
//       console.log('GPT data is empty/undefined -> LOW_CONFIDENCE');
//      const { nearbyPlaces, areaName } = await loadNearbyData();

// const areaText = areaName ? areaName : 'your area';
// console.log("the second  is", areaText)
// return res.status(400).json({
//   status: 400,
//   message: 'LOW_CONFIDENCE',
//   data: {
//     reason:
//       'We couldn’t identify this building. Please try again and take a clearer photo from a different angle. ' +
//       `Wherever you’re in ${areaText}, here are great things to do nearby`,
//     nearbyPlaces,
//   },
// });
//     }

//     // prepare holders for Google Places data
//     let googlePlace: any = null;
//     let googlePlacePhotoUrls: string[] = [];
//     let googleNearby: any[] = [];

//     // 6) Use Google Places (first) or GPT coords + user location to decide confidence / zone
//     if (userLat != null && userLon != null) {
//       let targetLat: number | null = null;
//       let targetLon: number | null = null;
//       let coordSource: 'googlePlaces' | 'gpt' | null = null;

//       // 6.1) Try Google Places first (1km around user)
//       try {
//         const nameForPlaces = gptName || placeName;

//         googlePlace = await this.visionService.searchGooglePlace(
//           nameForPlaces,
//           userLat,
//           userLon,
//         );

//         if (googlePlace) {
//           targetLat = googlePlace.lat;
//           targetLon = googlePlace.lon;
//           coordSource = 'googlePlaces';
//           console.log('Using Google Places coords within 1km:', googlePlace);
//         } else {
//           console.log(
//             'Google Places: no nearby match, will fall back to GPT coords (if any)',
//           );
//         }
//       } catch (e) {
//         console.error('Error while calling Google Places:', e);
//       }

//       // 6.2) If Google Places did NOT give coords, fallback to GPT coords
//       if (targetLat == null || targetLon == null) {
//         const gptLat =
//           gpt?.latitude != null ? Number(gpt.latitude) : NaN;
//         const gptLon =
//           gpt?.longitude != null ? Number(gpt.longitude) : NaN;

//         if (!Number.isNaN(gptLat) && !Number.isNaN(gptLon)) {
//           targetLat = gptLat;
//           targetLon = gptLon;
//           coordSource = 'gpt';
//           console.log('Using GPT coordinates:', { lat: gptLat, lon: gptLon });
//         }
//       }

//       // 6.3) If still no coordinates -> LOW_CONFIDENCE + nearbyPlaces from DB/OSM
//       if (targetLat == null || targetLon == null) {
//        const { nearbyPlaces, areaName } = await loadNearbyData();

// const areaText = areaName ? areaName : 'your area';
// console.log("the third is", areaText)
// return res.status(400).json({
//   status: 400,
//   message: 'LOW_CONFIDENCE',
//   data: {
//     reason:
//       'We couldn’t identify this building. Please try again and take a clearer photo from a different angle. ' +
//       `Wherever you’re in ${areaText}, here are great things to do nearby`,
//     nearbyPlaces,
//   },
// });
//       }

//       // 6.4) We have coordinates (from Google Places or GPT) -> compute distance
//       const distKm = this.visionService.distanceKm(
//         userLat,
//         userLon,
//         targetLat,
//         targetLon,
//       );
//       console.log(`Distance from user (${coordSource}):`, distKm, 'km');

//       // Outside general zone -> treat as LOW_CONFIDENCE
//       if (distKm > ZONE_MAX_KM) {
//        const { nearbyPlaces, areaName } = await loadNearbyData();

// const areaText = areaName ? areaName : 'your area';
// console.log("the fourth is", areaText)
// return res.status(400).json({
//   status: 400,
//   message: 'LOW_CONFIDENCE',
//   data: {
//     reason:
//       'We couldn’t identify this building. Please try again and take a clearer photo from a different angle. ' +
//       `Wherever you’re in ${areaText}, here are great things to do nearby`,
//     nearbyPlaces,
//   },
// });
//       }

//       // Inside zone but > STRICT_MAX_KM (1km) -> LOW_CONFIDENCE
//       if (distKm > STRICT_MAX_KM) {
//        const { nearbyPlaces, areaName } = await loadNearbyData();

// const areaText = areaName ? areaName : 'your area';
// console.log("the fifth is", areaText)
// return res.status(400).json({
//   status: 400,
//   message: 'LOW_CONFIDENCE',
//   data: {
//     reason:
//       'We couldn’t identify this building. Please try again and take a clearer photo from a different angle. ' +
//       `Wherever you’re in ${areaText}, here are great things to do nearby`,
//     nearbyPlaces,
//   },
// });
//       }

//       // If you reach here: distKm <= STRICT_MAX_KM -> HIGH_CONFIDENCE

//       // Fetch Google Place photos (up to 3) if we have a matched place
//       if (googlePlace) {
//         try {
//           googlePlacePhotoUrls =
//             await this.visionService.fetchPlacePhotosFromGoogle(
//               googlePlace,
//               2,
//             );
//         } catch (err) {
//           console.error('[Lens] fetchPlacePhotosFromGoogle error:', err);
//         }

//         try {
//           googleNearby =
//             await this.visionService.getNearbyThingsFromGoogle(
//               googlePlace.lat,
//               googlePlace.lon,
//               1000, // 1km
//             );
//         } catch (err) {
//           console.error('[Lens] getNearbyThingsFromGoogle error:', err);
//         }
//       } else {
//         // No googlePlace, but we still have targetLat/targetLon -> we can at least get nearby POIs
//         try {
//           googleNearby =
//             await this.visionService.getNearbyThingsFromGoogle(
//               targetLat,
//               targetLon,
//               1000,
//             );
//         } catch (err) {
//           console.error('[Lens] getNearbyThingsFromGoogle (GPT coords) error:', err);
//         }
//       }
//     }

//     // 6b) HIGH_CONFIDENCE: optional dedupe by AI canonical title (from GPT)
//     const canonicalTitle = gptName; // already normalized above
//     if (canonicalTitle) {
//       try {
//         const existingByAi =
//           await this.visionService.findPlaceDetailByAiTitle(canonicalTitle);
//         if (existingByAi) {
//           await this.userService.addScanIdInUser(userId, existingByAi.id);
//           return res.status(200).json({
//             status: 200,
//             message: 'success',
//             data: existingByAi,
//           });
//         }
//       } catch (err) {
//         console.error('[Lens] findPlaceDetailByAiTitle error:', err);
//       }
//     }

//     // 7) Upsert place in DB (now includes Google Places images & nearby)
//     const placeDoc = await this.visionService.upsertPlaceFromLens({
//       first,
//       imageUrl: lensResult.imageUrl,
//       gpt,
//       googlePlace,
//       googlePlacePhotoUrls,
//       googleNearby,
//     });

//     // 8) Attach place id to user
//     await this.userService.addScanIdInUser(userId, String(placeDoc._id));


// //     // 9) Response: use AI title as main title if present
// // const displayTitle = placeDoc.ai?.title || placeDoc.title;

// // // 1) Get URLs from images.gallery
// // const galleryItems = placeDoc.images?.gallery ?? [];

// // // pick best URL from each gallery item
// // const rawUrls: string[] = galleryItems
// //   .map((g: any) =>
// //     g?.original || g?.thumbnail || g?.localOriginal || g?.localThumbnail,
// //   )
// //   .filter((u: string | undefined) => !!u);

// // // 2) Remove duplicate URLs (so first/second won't be the same)
// // const uniqueUrls: string[] = [];
// // const seen = new Set<string>();
// // for (const u of rawUrls) {
// //   if (!seen.has(u)) {
// //     seen.add(u);
// //     uniqueUrls.push(u);
// //   }
// // }

// // // 3) Build gallery ARRAY with named fields
// // const gallery = [
// //   {
// //     name: 'firstPlaceImage',
// //     url: uniqueUrls[0] ?? null,
// //   },
// //   {
// //     name: 'secondPlaceImage',
// //     url: uniqueUrls[1] ?? null,
// //   },
// //   {
// //     name: 'thirdPlaceImage',
// //     url: uniqueUrls[2] ?? null,
// //   },
// // ];

// // const responseData = {
// //   id: placeDoc._id,
// //   title: displayTitle,
// //   thumbnailImage: placeDoc.images?.thumbnail,
// //   originalImage: placeDoc.images?.original,

// //   // <-- this is what frontend will use
// //   gallery,

// //   chatgptTitle: placeDoc.ai?.title,
// //   shortDescription: placeDoc.ai?.shortDescription,
// //   tourismDescription: placeDoc.ai?.tourismDescription,
// //   funFacts: placeDoc.ai?.funFacts,
// //   heightMeters: placeDoc.ai?.heightMeters,
// //   latitude: placeDoc.ai?.latitude,
// //   longitude: placeDoc.ai?.longitude,
// //   architectureStyle: placeDoc.ai?.architectureStyle || '',
// //   architectName: (placeDoc.ai as any)?.architectName,
// //   location: (placeDoc.ai as any)?.location,
// //   nearby: (placeDoc as any).nearby ?? placeDoc.raw?.googleNearby ?? [],
// // };






// const displayTitle = placeDoc.ai?.title || placeDoc.title;

// const responseData = {
//   id: placeDoc._id,
//   title: displayTitle,
//   thumbnailImage: placeDoc.images?.thumbnail,
//   originalImage: placeDoc.images?.original,

//   // <-- EXACT field you want
//   gallery: placeDoc.gallery ?? {
//     firstGooglePlace: null,
//     secondGooglePlace: null,
//   },

//   chatgptTitle: placeDoc.ai?.title,
//   shortDescription: placeDoc.ai?.shortDescription,
//   tourismDescription: placeDoc.ai?.tourismDescription,
//   funFacts: placeDoc.ai?.funFacts,
//   heightMeters: placeDoc.ai?.heightMeters,
//   latitude: placeDoc.ai?.latitude,
//   longitude: placeDoc.ai?.longitude,
//   architectureStyle: placeDoc.ai?.architectureStyle || '',
//   architectName: (placeDoc.ai as any)?.architectName,
//   location: (placeDoc.ai as any)?.location,
//   nearby: (placeDoc as any).nearby ?? placeDoc.raw?.googleNearby ?? [],
// };

// console.log('the response', responseData);

// return res.status(200).json({
//   status: 200,
//   message: 'success',
//   data: responseData,
// });


//     // 9) Response: use AI title as main title if present
//     // const displayTitle = placeDoc.ai?.title || placeDoc.title;

//     // const responseData = {
//     //   id: placeDoc._id,
//     //   title: displayTitle,
//     //   thumbnailImage: placeDoc.images?.thumbnail,
//     //   originalImage: placeDoc.images?.original,
//     //   gallery: placeDoc.images?.gallery ?? [],
//     //   chatgptTitle: placeDoc.ai?.title,
//     //   shortDescription: placeDoc.ai?.shortDescription,
//     //   tourismDescription: placeDoc.ai?.tourismDescription,
//     //   funFacts: placeDoc.ai?.funFacts,
//     //   heightMeters: placeDoc.ai?.heightMeters,
//     //   latitude: placeDoc.ai?.latitude,
//     //   longitude: placeDoc.ai?.longitude,
//     //   architectureStyle: placeDoc.ai?.architectureStyle || '',
//     //   architectName: (placeDoc.ai as any)?.architectName,
//     //   location: (placeDoc.ai as any)?.location,
//     //   nearby: (placeDoc as any).nearby ?? placeDoc.raw?.googleNearby ?? [],
//     // };

   
//   } catch (e: any) {
//     console.error('[Lens] error:', e?.message || e);
//     return res.status(400).json({
//       status: 400,
//       message: 'FAILURE',
//       data: e?.message || 'Google Lens lookup failed',
//     });
//   }
// }



























@Post('lens')
@UseGuards(AuthGuard)
@UseFilters(new HttpExceptionFilter())
@UseInterceptors(
  FileFieldsInterceptor(
    [
      { name: 'image', maxCount: 1 },
      { name: 'file', maxCount: 1 },
    ],
    {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    },
  ),
)
async recognizeWithLenss(
  @UploadedFiles() files: { image?: MulterFile[]; file?: MulterFile[] },
  @Body() body: RecognizeDto,
  @Query() query: RecognizeDto,
  @Req() req,
  @Res() res: Response,
) {
  const get = (k: keyof RecognizeDto) => body[k] ?? query[k];
  const userId = req.user?.sub;

  console.log('the body', body);

  // ==================== 0) DATE + CREDIT CHECK ====================
  // This will:
  //  - expire subscription if subscriptionExpiresAt < now
  //  - reset remainCredits/totalCredit when expired
  const user = await this.pricingService.ensureSubscriptionValid(userId);

  let hasCredits = false;
  if (user.remainCredits === '-1') {
    // unlimited subscription
    hasCredits = true;
  } else {
    const subRemain = parseInt(user.remainCredits ?? '0', 10) || 0;
    const lifeRemain = parseInt(user.lifetimeRemainCredits ?? '0', 10) || 0;
    hasCredits = subRemain > 0 || lifeRemain > 0;
  }

  if (!hasCredits) {
    // No subscription credits (or expired by date) AND no lifetime credits
    return res.status(400).json({
      status: 400,
      message: 'NO_CREDITS',
      data: 'You are out of scan credits',
    });
  }
  // ================================================================

  // --- parse user location from frontend: lat, lon ---
  const latRaw = get('lat');
  const lonRaw = get('lon');

  // const userLat = 24.876929522631265
  // const userLon = 67.04325733881093

// 24.876929522631265, 67.04325197439303

  const userLat =
    latRaw !== undefined && latRaw !== null ? Number(latRaw) : undefined;
  const userLon =
    lonRaw !== undefined && lonRaw !== null ? Number(lonRaw) : undefined;

  if (
    (latRaw !== undefined && Number.isNaN(userLat)) ||
    (lonRaw !== undefined && Number.isNaN(userLon))
  ) {
    throw new BadRequestException('Invalid lat or lon');
  }

  // 1) Build image buffer
  let buf: Buffer | undefined;
  const up = files?.image?.[0] ?? files?.file?.[0];

  if (up?.buffer) {
    buf = up.buffer;
  } else if (get('image_base64')) {
    buf = Buffer.from(get('image_base64') as string, 'base64');
  } else if (get('image_url')) {
    const url = get('image_url') as string;
    const resp = await axios.get<ArrayBuffer>(url, {
      responseType: 'arraybuffer',
      timeout: 35000,
    });
    buf = Buffer.from(resp.data as any);
  }

  if (!buf) {
    throw new BadRequestException(
      "Provide an image via multipart 'image'/'file', or JSON 'image_base64'/'image_url'",
    );
  }

  const loadNearbyData = async () => {
    if (userLat == null || userLon == null) {
      return { nearbyPlaces: [], areaName: null };
    }

    try {
      const [nearbyPlaces, areaName] = await Promise.all([
        this.visionService.getNearbyPlacesSerp(userLat, userLon, 1000),
        this.visionService.getAreaNameFromCoords(userLat, userLon),
      ]);

      return { nearbyPlaces, areaName };
    } catch (err) {
      console.error('[Lens] nearbyData error:', err);
      return { nearbyPlaces: [], areaName: null };
    }
  };

  try {
    // 2) Google Lens via SerpApi
    const lensResult = await this.visionService.recognizeWithGoogleLens(buf);

    // Only treat as failure if there is NO visual match at all
    if (!lensResult.first) {
      const { nearbyPlaces, areaName } = await loadNearbyData();

      const areaText = areaName ? areaName : 'your area';
      console.log('the first is', areaText);

      return res.status(400).json({
        status: 400,
        message: 'LOW_CONFIDENCE',
        data: {
          reason:
            'We couldn’t identify this building. Please try again and take a clearer photo from a different angle. ' +
            `Wherever you’re in ${areaText}, here are great things to do nearby`,
          nearbyPlaces,
        },
      });
    }

    const first = lensResult.first;

    // 3) Derive canonical place name from Lens
    const placeName: string =
      lensResult.label ||
      lensResult.raw?.knowledge_graph?.title ||
      lensResult.raw?.knowledge_graph?.name ||
      lensResult.raw?.related_content?.[0]?.query ||
      first.title ||
      first.name ||
      first.link_title ||
      first.query ||
      'Unknown building';

    console.log('Derived placeName from Lens:', placeName);

    // distance thresholds (km)
    const STRICT_MAX_KM = 1; // must be within 1km of user to trust match
    const ZONE_MAX_KM = 30; // allowed zone radius

    // 4) Existing place in DB by main title? -> check area restriction, then return
    const existing = await this.visionService.findPlaceDetailSerp(placeName);
    if (existing) {
      const existingAny = existing as any;

      const existingLat =
        existingAny.aiLatitude ??
        existingAny.latitude ??
        existingAny.ai?.latitude ??
        existingAny.coordinates?.coordinates?.[1];

      const existingLon =
        existingAny.aiLongitude ??
        existingAny.longitude ??
        existingAny.ai?.longitude ??
        existingAny.coordinates?.coordinates?.[0];

      if (
        userLat != null &&
        userLon != null &&
        existingLat != null &&
        existingLon != null
      ) {
        const distKm = this.visionService.distanceKm(
          userLat,
          userLon,
          Number(existingLat),
          Number(existingLon),
        );

        if (distKm > ZONE_MAX_KM) {
          return res.status(400).json({
            status: 400,
            message: 'LOCATION_MISMATCH',
            data: 'You are out of zone. Please come in 50KM radius',
          });
        }
      }

      // ----- SUCCESS: consume exactly 1 scan -----
      await this.pricingService.consumeScan(userId);

      await this.userService.addScanIdInUser(userId, existing.id);
      return res.status(200).json({
        status: 200,
        message: 'success',
        data: existing,
      });
    }

    // 4b) Existing place in DB by AI title? (ai.title == placeName)
    const existingByAiTitle =
      await this.visionService.findPlaceDetailByAiTitle(placeName);
    if (existingByAiTitle) {
      console.log('in existingByAiTitle ', existingByAiTitle);
      const existingAny = existingByAiTitle as any;

      const existingLat =
        existingAny.aiLatitude ??
        existingAny.latitude ??
        existingAny.ai?.latitude ??
        existingAny.coordinates?.coordinates?.[1];

      const existingLon =
        existingAny.aiLongitude ??
        existingAny.longitude ??
        existingAny.ai?.longitude ??
        existingAny.coordinates?.coordinates?.[0];

      if (
        userLat != null &&
        userLon != null &&
        existingLat != null &&
        existingLon != null
      ) {
        const distKm = this.visionService.distanceKm(
          userLat,
          userLon,
          Number(existingLat),
          Number(existingLon),
        );

        if (distKm > ZONE_MAX_KM) {
          return res.status(400).json({
            status: 400,
            message: 'LOCATION_MISMATCH',
            data: 'You are out of zone. Please come in 50KM radius',
          });
        }
      }

      // ----- SUCCESS: consume 1 scan -----
      await this.pricingService.consumeScan(userId);

      await this.userService.addScanIdInUser(userId, existingByAiTitle.id);
      return res.status(200).json({
        status: 200,
        message: 'success',
        data: existingByAiTitle,
      });
    }

    // 5) No existing place -> call ChatGPT / AI
    const gpt = await this.visionService.getBuildingInfoFromChatGPT(placeName);
    console.log('the gpt data', gpt);

    // 5b) If GPT data is basically empty -> LOW_CONFIDENCE
    const normalize = (v: any) =>
      typeof v === 'string'
        ? v.trim()
        : v == null
        ? ''
        : String(v).trim();

    const gptName = normalize(gpt?.name ?? '');
    const shortDesc = normalize(gpt?.shortDescription);
    const tourismDesc = normalize(gpt?.tourismDescription);
    const archStyle = normalize(gpt?.architectureStyle);
    const architectName = normalize(gpt?.architectName);
    const locText = normalize(gpt?.location);

    const isGptEmpty =
      !gpt ||
      (!gptName &&
        !shortDesc &&
        !tourismDesc &&
        (!Array.isArray(gpt?.funFacts) || gpt.funFacts.length === 0) &&
        gpt?.heightMeters == null &&
        gpt?.latitude == null &&
        gpt?.longitude == null &&
        !archStyle &&
        !architectName &&
        !locText);

    if (isGptEmpty) {
      console.log('GPT data is empty/undefined -> LOW_CONFIDENCE');
      const { nearbyPlaces, areaName } = await loadNearbyData();

      const areaText = areaName ? areaName : 'your area';
      console.log('the second  is', areaText);
      return res.status(400).json({
        status: 400,
        message: 'LOW_CONFIDENCE',
        data: {
          reason:
            'We couldn’t identify this building. Please try again and take a clearer photo from a different angle. ' +
            `Wherever you’re in ${areaText}, here are great things to do nearby`,
          nearbyPlaces,
        },
      });
    }

    // prepare holders for Google Places data
    let googlePlace: any = null;
    let googlePlacePhotoUrls: string[] = [];
    let googleNearby: any[] = [];

    // 6) Use Google Places (first) or GPT coords + user location to decide confidence / zone
    if (userLat != null && userLon != null) {
      let targetLat: number | null = null;
      let targetLon: number | null = null;
      let coordSource: 'googlePlaces' | 'gpt' | null = null;

      // 6.1) Try Google Places first (1km around user)
      try {
        const nameForPlaces = gptName || placeName;

        googlePlace = await this.visionService.searchGooglePlace(
          nameForPlaces,
          userLat,
          userLon,
        );

        if (googlePlace) {
          targetLat = googlePlace.lat;
          targetLon = googlePlace.lon;
          coordSource = 'googlePlaces';
          console.log('Using Google Places coords within 1km:', googlePlace);
        } else {
          console.log(
            'Google Places: no nearby match, will fall back to GPT coords (if any)',
          );
        }
      } catch (e) {
        console.error('Error while calling Google Places:', e);
      }

      // 6.2) If Google Places did NOT give coords, fallback to GPT coords
      if (targetLat == null || targetLon == null) {
        const gptLat =
          gpt?.latitude != null ? Number(gpt.latitude) : NaN;
        const gptLon =
          gpt?.longitude != null ? Number(gpt.longitude) : NaN;

        if (!Number.isNaN(gptLat) && !Number.isNaN(gptLon)) {
          targetLat = gptLat;
          targetLon = gptLon;
          coordSource = 'gpt';
          console.log('Using GPT coordinates:', { lat: gptLat, lon: gptLon });
        }
      }

      // 6.3) If still no coordinates -> LOW_CONFIDENCE + nearbyPlaces from DB/OSM
      if (targetLat == null || targetLon == null) {
        const { nearbyPlaces, areaName } = await loadNearbyData();

        const areaText = areaName ? areaName : 'your area';
        console.log('the third is', areaText);
        return res.status(400).json({
          status: 400,
          message: 'LOW_CONFIDENCE',
          data: {
            reason:
              'We couldn’t identify this building. Please try again and take a clearer photo from a different angle. ' +
              `Wherever you’re in ${areaText}, here are great things to do nearby`,
            nearbyPlaces,
          },
        });
      }

      // 6.4) We have coordinates (from Google Places or GPT) -> compute distance
      const distKm = this.visionService.distanceKm(
        userLat,
        userLon,
        targetLat,
        targetLon,
      );
      console.log(`Distance from user (${coordSource}):`, distKm, 'km');

      // Outside general zone -> treat as LOW_CONFIDENCE
      if (distKm > ZONE_MAX_KM) {
        const { nearbyPlaces, areaName } = await loadNearbyData();

        const areaText = areaName ? areaName : 'your area';
        console.log('the fourth is', areaText);
        return res.status(400).json({
          status: 400,
          message: 'LOW_CONFIDENCE',
          data: {
            reason:
              'We couldn’t identify this building. Please try again and take a clearer photo from a different angle. ' +
              `Wherever you’re in ${areaText}, here are great things to do nearby`,
            nearbyPlaces,
          },
        });
      }

      // Inside zone but > STRICT_MAX_KM (1km) -> LOW_CONFIDENCE
      if (distKm > STRICT_MAX_KM) {
        const { nearbyPlaces, areaName } = await loadNearbyData();

        const areaText = areaName ? areaName : 'your area';
        console.log('the fifth is', areaText);
        return res.status(400).json({
          status: 400,
          message: 'LOW_CONFIDENCE',
          data: {
            reason:
              'We couldn’t identify this building. Please try again and take a clearer photo from a different angle. ' +
              `Wherever you’re in ${areaText}, here are great things to do nearby`,
            nearbyPlaces,
          },
        });
      }

      // If you reach here: distKm <= STRICT_MAX_KM -> HIGH_CONFIDENCE

      // Fetch Google Place photos (up to 2) if we have a matched place
      if (googlePlace) {
        try {
          googlePlacePhotoUrls =
            await this.visionService.fetchPlacePhotosFromGoogle(
              googlePlace,
              2,
            );
        } catch (err) {
          console.error('[Lens] fetchPlacePhotosFromGoogle error:', err);
        }

        try {
          googleNearby =
            await this.visionService.getNearbyThingsFromGoogle(
              googlePlace.lat,
              googlePlace.lon,
              1000, // 1km
            );
        } catch (err) {
          console.error('[Lens] getNearbyThingsFromGoogle error:', err);
        }
      } else {
        // No googlePlace, but we still have targetLat/targetLon -> we can at least get nearby POIs
        try {
          googleNearby =
            await this.visionService.getNearbyThingsFromGoogle(
              targetLat,
              targetLon,
              1000,
            );
        } catch (err) {
          console.error('[Lens] getNearbyThingsFromGoogle (GPT coords) error:', err);
        }
      }
    }

    // 6b) HIGH_CONFIDENCE: optional dedupe by AI canonical title (from GPT)
    const canonicalTitle = gptName; // already normalized above
    if (canonicalTitle) {
      try {
        const existingByAi =
          await this.visionService.findPlaceDetailByAiTitle(canonicalTitle);
        if (existingByAi) {
          // ----- SUCCESS: consume 1 scan -----
          await this.pricingService.consumeScan(userId);

          await this.userService.addScanIdInUser(userId, existingByAi.id);
          return res.status(200).json({
            status: 200,
            message: 'success',
            data: existingByAi,
          });
        }
      } catch (err) {
        console.error('[Lens] findPlaceDetailByAiTitle error:', err);
      }
    }

    // 7) Upsert place in DB (now includes Google Places images & nearby)
    const placeDoc = await this.visionService.upsertPlaceFromLens({
      first,
      imageUrl: lensResult.imageUrl,
      gpt,
      googlePlace,
      googlePlacePhotoUrls,
      googleNearby,
    });

    // ----- SUCCESS: consume 1 scan -----
    await this.pricingService.consumeScan(userId);

    // 8) Attach place id to user
    await this.userService.addScanIdInUser(userId, String(placeDoc._id));

    const displayTitle = placeDoc.ai?.title || placeDoc.title;

    const responseData = {
      id: placeDoc._id,
      title: displayTitle,
      thumbnailImage: placeDoc.images?.thumbnail,
      originalImage: placeDoc.images?.original,
      gallery: placeDoc.gallery ?? {
        firstGooglePlace: null,
        secondGooglePlace: null,
      },
      chatgptTitle: placeDoc.ai?.title,
      shortDescription: placeDoc.ai?.shortDescription,
      tourismDescription: placeDoc.ai?.tourismDescription,
      funFacts: placeDoc.ai?.funFacts,
      heightMeters: placeDoc.ai?.heightMeters,
      latitude: placeDoc.ai?.latitude,
      longitude: placeDoc.ai?.longitude,
      architectureStyle: placeDoc.ai?.architectureStyle || '',
      architectName: (placeDoc.ai as any)?.architectName,
      location: (placeDoc.ai as any)?.location,
      nearby: (placeDoc as any).nearby ?? placeDoc.raw?.googleNearby ?? [],
    };

    console.log('the response', responseData);

    return res.status(200).json({
      status: 200,
      message: 'success',
      data: responseData,
    });
  } catch (e: any) {
    console.error('[Lens] error:', e?.message || e);
    return res.status(400).json({
      status: 400,
      message: 'FAILURE',
      data: e?.message || 'Google Lens lookup failed',
    });
  }
}












// @UseGuards(AuthGuard)
// @Get('get-scan-serp/:id')
// async getSingleScanSerp(
//   @Param('id') id: string,
//   @Req() req,
//   @Res() res: Response,
// ) {
//   try {
//     // 1) Get SERP/Lens scan detail by id
//     const getScanDetail = await this.visionService.getScansDetailsSerp(id);


// console.log("the scan detail", getScanDetail)
//     if (getScanDetail.status !== 200) {
//       return res.status(400).json({
//         status: getScanDetail.status,
//         message: getScanDetail.message,
//         data: getScanDetail.error,
//       });
//     }

//     // 2) Get user language
//     const userId = req.user.sub;
//     const user = await this.userService.findOne(userId);

//     // 3) Translate the serp scan detail to user.languageCode (if needed)
//     const translated = await this.translationService.translate(
//       getScanDetail.scanDetail,   
//       user.languageCode,
//     );

//     // 4) Return translated serp scan detail
//     return res.status(200).json({
//       status: getScanDetail.status,
//       message: getScanDetail.message,
//       data: translated,
//     });
//   } catch (error) {
//     console.error('Error in getSingleScanSerp:', error);

//     return res.status(502).json({
//       status: 502,
//       message: 'Failed to translate serp scan detail',
//     });
//   }
// }



@UseGuards(AuthGuard)
@Get('get-scan-serp/:id')
async getSingleScanSerp(
  @Param('id') id: string,
  @Req() req,
  @Res() res: Response,
) {
  try {
    // 1) Get SERP/Lens scan detail by id
    const getScanDetail = await this.visionService.getScansDetailsSerp(id);

    console.log('the scan detail', getScanDetail);
    if (getScanDetail.status !== 200) {
      return res.status(400).json({
        status: getScanDetail.status,
        message: getScanDetail.message,
        data: getScanDetail.error,
      });
    }

    // 2) Get user language
    const userId = req.user.sub;
    const user = await this.userService.findOne(userId);

    // Normalize language code (e.g. "en-US" -> "en")
    const langCodeRaw = user?.languageCode || 'en';
    const langCode = langCodeRaw.toLowerCase().split(/[-_]/)[0]; // "en-US" -> "en"

    // 3) If English, skip translation completely
    if (langCode === 'en') {
      return res.status(200).json({
        status: getScanDetail.status,
        message: getScanDetail.message,
        data: getScanDetail.scanDetail, // send original data
      });
    }

    // 4) Otherwise, translate to user.languageCode
    const translated = await this.translationService.translate(
      getScanDetail.scanDetail,
      langCodeRaw, // or langCode, depending on what you store
    );

    return res.status(200).json({
      status: getScanDetail.status,
      message: getScanDetail.message,
      data: translated,
    });
  } catch (error) {
    console.error('Error in getSingleScanSerp:', error);

    // Fallback: send original (English) data if we still have it
    return res.status(502).json({
      status: 502,
      message: 'Failed to translate serp scan detail',
    });
  }
}




// @ApiOperation({
//   summary: 'fetch (Serp)',
//   description: 'Get scan summary of specific user (Serp version)',
// })
// @ApiResponse({
//   status: 200,
//   description: 'Get scan summary of specific user successfully',
// })
// @ApiResponse({ status: 403, description: 'Forbidden.' })
// @UseGuards(AuthGuard)
// @Get('get-scans-serp')
// @UseFilters(new HttpExceptionFilter())
// async getScansSerp(@Req() req, @Res() res: Response): Promise<any> {
//   const userId = req.user.sub;
//   console.log('the user is in getScansSerp', userId);

//   const response = await this.userService.getScansId(userId);
//   console.log('the response in getScansSerp', response);

//   if (response.status === 200) {
//     // New summary method
//     const getScansSummary = await this.visionService.getScansSummarySerp(
//       response.scanAreas,
//     );

//     const user = await this.userService.findOne(userId);

//     const translated = await this.translationService.translate(
//       getScansSummary.scans,
//       user.languageCode,
//     );

//     console.log('the translated (Serp)', translated);

//     return res.status(200).json({
//       status: 200,
//       message: getScansSummary.message,
//       data: translated,
//     });
//   }

//   return res.status(400).json({
//     status: 400,
//     message: 'failed',
//     data: 'error in getting the scan details',
//   });
// }




@ApiOperation({
  summary: 'fetch (Serp)',
  description: 'Get scan summary of specific user (Serp version)',
})
@ApiResponse({
  status: 200,
  description: 'Get scan summary of specific user successfully',
})
@ApiResponse({ status: 403, description: 'Forbidden.' })
@UseGuards(AuthGuard)
@Get('get-scans-serp')
@UseFilters(new HttpExceptionFilter())
async getScansSerp(@Req() req, @Res() res: Response): Promise<any> {
  const userId = req.user.sub;
  console.log('the user is in getScansSerp', userId);

  const response = await this.userService.getScansId(userId);
  console.log('the response in getScansSerp', response);

  if (response.status !== 200) {
    return res.status(400).json({
      status: 400,
      message: 'failed',
      data: 'error in getting the scan details',
    });
  }

  // 1) Get summary data
  const getScansSummary = await this.visionService.getScansSummarySerp(
    response.scanAreas,
  );

  // 2) Get user + language
  const user = await this.userService.findOne(userId);

  // Normalize language code, e.g. "en-US" -> "en"
  const langCodeRaw = user?.languageCode || 'en';
  const langCode = langCodeRaw.toLowerCase().split(/[-_]/)[0];

  // 3) If English, skip translation and return original scans
  if (langCode === 'en') {
    console.log("in lang code ")
    return res.status(200).json({
      status: 200,
      message: getScansSummary.message,
      data: getScansSummary.scans,
    });
  }

  // 4) For other languages, translate
  const translated = await this.translationService.translate(
    getScansSummary.scans,
    langCodeRaw, // or langCode; both will work with your service
  );

  console.log('the translated (Serp)', translated);

  return res.status(200).json({
    status: 200,
    message: getScansSummary.message,
    data: translated,
  });
}

}