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
  ) {}



@Post()
@UseGuards(AuthGuard)
@UseFilters(new HttpExceptionFilter())
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'image', maxCount: 1 },
        { name: 'file',  maxCount: 1 },
      ],
      {
        storage: memoryStorage(),
        limits: { fileSize: 10 * 1024 * 1024 },
      },
    ),
  )
async recognize(
  @UploadedFiles() files: { image?: MulterFile[]; file?: MulterFile[] },
  @Body() body: RecognizeDto,
  @Query() query: RecognizeDto,
  @Req() req,
  @Res() res: Response,
) {
  const get = (k: keyof RecognizeDto) => body[k] ?? query[k];
  const userId = req.user.sub;


  

  // 1. Get image buffer (your logic is fine)
 let buf: Buffer | undefined;
    const up = files?.image?.[0] ?? files?.file?.[0];
    if (up?.buffer) {
      buf = up.buffer;
    } else if (get('image_base64')) {
      buf = Buffer.from(get('image_base64') as string, 'base64');
    } else if (get('image_url')) {
      const url = get('image_url') as string;
      const resp = await axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer', timeout: 15000 });
      buf = Buffer.from(resp.data as any);
    }

    if (!buf) {
      throw new BadRequestException(
        "Provide an image via multipart 'image'/'file', or JSON 'image_base64'/'image_url'",
      );
    }


  // 2. Validate coordinates (your logic is fine, just ensure it's here)
  const latStr = get('lat') as string;
  const lonStr = get('lon') as string;
  console.log("the latStr", latStr, "the lonStr",lonStr)
  let lat: number | undefined;
  let lon: number | undefined;

  if (latStr && lonStr) {
    lat = parseFloat(latStr);
    lon = parseFloat(lonStr);
    if (isNaN(lat) || isNaN(lon)) {
      throw new BadRequestException('Invalid coordinates provided.');
    }
  }
  const topK = get('top_k') ? parseInt(get('top_k') as string, 10) : 5;
console.log("the lat", lat, "the lon",lon,"topK", topK )
  // 3. Call the service
  const results = await this.visionService.recognize(buf, { lat, lon, topK });
   console.log("the result", results)
  if (results.status === 'FAILURE') {
    // Inside this block, TypeScript knows `results` is a `FailureRecognition`.
    // We handle the error and stop the function by throwing.
console.log("in failure")
 return res.status(400).json({ status: 400, message: 'FAILURE', data: results.message });
    // throw new BadRequestException(results.message);
  }


  if (results.data.length === 0) {
    // This case handles if the success data is for some reason empty.
    // throw new BadRequestException('No landmark recognized.');
    return res.status(400).json({ status: 400, message: 'FAILURE', data: 'Building not recognized.' });
  }




  // It is now safe to access the data. The TypeScript error is resolved.
  const placeName = results.data[0].name;

  console.log("the successful result is:", results);

  // The rest of your logic can now proceed 
  
  

  const findPlaceDetail = await this.visionService.findPlaceDetail(placeName);
  if (findPlaceDetail) {
    await this.userService.addScanIdInUser(userId, findPlaceDetail.id);
    return res.status(200).json({ status: 200, message: 'success', data: findPlaceDetail });
  }

  const response = await this.visionService.getDetail(placeName);
  if (response.status === 200) {
    const saved = await this.visionService.upsertPlaceFromDetail(response.data, placeName);
    await this.userService.addScanIdInUser(userId, saved.id);
    return res.status(200).json({ status: 200, message: 'success', data: saved });
  }

  else if(response.status !== 200){

    const searchName = await this.visionService.searchTitle(placeName);

    if(searchName.status === 200){
       const response = await this.visionService.getDetail(searchName.title);
  if (response.status === 200) {
    const saved = await this.visionService.upsertPlaceFromDetail(response.data, searchName.title);
    await this.userService.addScanIdInUser(userId, saved.id);
    return res.status(200).json({ status: 200, message: 'success', data: saved });
  }


    }

  }

  // throw new BadRequestException(`Failed to get landmark details of ${placeName} `);

    return res.status(400).json({ status: 400, message: 'FAILURE', data: `Failed to get building details of ${placeName}` });




  
//     return res.status(200).json({
//     "status": 200,
//     "message": "success",
//     "data": {
//         "id": "68fcbf2854a04c18631281ce",
//         "title": "Niagara Falls",
//         "thumbnailImage": "http://localhost:4000/files/68fcbf1d7ede1cbb7993da48",
//         "originalImage": "http://localhost:4000/files/68fcbf077ede1cbb7993da38",
//         "description": "Niagara Falls is a group of three waterfalls at the southern end of Niagara Gorge, spanning the border between the province of Ontario in Canada and the state of New York in the United States. The largest of the three is Horseshoe Falls, which straddles the international border of the two countries. It is also known as the Canadian Falls. The smaller American Falls and Bridal Veil Falls lie within the United States. Bridal Veil Falls is separated from Horseshoe Falls by Goat Island and from American Falls by Luna Island, with both islands situated in New York.\nFormed by the Niagara River, which drains Lake Erie into Lake Ontario, the combined falls have the highest flow rate of any waterfall in North America that has a vertical drop of more than 50 m (164 ft). During peak daytime tourist hours, more than 168,000 m3 (5.9 million cu ft) of water goes over the crest of the falls every minute. Horseshoe Falls is the most powerful waterfall in North America, as measured by flow rate. Niagara Falls is famed for its beauty and is a valuable source of hydroelectric power. Balancing recreational, commercial, and industrial uses has been a challenge for the stewards of the falls since the 19th...",
//         "countries": "Canada",
//         "administrativeAreas": "Ontario",
//         "ranges": [],
//         "instanceOf": [
//             "tourist attraction",
//             "waterfall",
//             "horseshoe waterfall"
//         ],
//         "coordinates": [
//             -79.071,
//             43.08
//         ],
//         "height": 57
//     }
// })
  

}














@Post('/Image-Information')
@UseGuards(AuthGuard)
@UseFilters(new HttpExceptionFilter())
async getDataFromWikipedia(
  @Req() req,
  @Body() fetchDataFromWikipedia: FetchDataFromWikipedia,
  @Res() res: Response,
): Promise<any> {
  const { PlaceName } = fetchDataFromWikipedia;
  const userId = req.user.sub;






  const findPlaceDetail = await this.visionService.findPlaceDetail(PlaceName);
  console.log("the findPlaceDetail", findPlaceDetail)
  if (findPlaceDetail) {
    await this.userService.addScanIdInUser(userId, findPlaceDetail.id);
    return res.status(200).json({ status: 200, message: 'success', data: findPlaceDetail });
  }

  const response = await this.visionService.getDetail(PlaceName);
  console.log("the response of get detail", response)
  if (response.status === 200) {
    const saved = await this.visionService.upsertPlaceFromDetail(response.data, PlaceName);
    await this.userService.addScanIdInUser(userId, saved.id);
    return res.status(200).json({ status: 200, message: 'success', data: saved });
  }
  
  else if(response.status !== 200){

    console.log("in this 400 repsone ")

    const searchName = await this.visionService.searchTitle(PlaceName);

    if(searchName.status === 200){
       const response = await this.visionService.getDetail(searchName.title);
  if (response.status === 200) {
    const saved = await this.visionService.upsertPlaceFromDetail(response.data, searchName.title);
    await this.userService.addScanIdInUser(userId, saved.id);
    return res.status(200).json({ status: 200, message: 'success', data: saved });
  }


    }

  }


}









        @ApiOperation({
          summary: "fetch ",
          description: "Get scan summary of specific user",
        })
        @ApiResponse({
          status: 200,
          description: 'Get scan summary of specific user Successfully',  })
        @ApiResponse({ status: 403, description: "Forbidden." })
        @UseGuards(AuthGuard)
        @Get('get-scans')
        @UseFilters(new HttpExceptionFilter())
        async getScans(@Req() req, @Res() res: Response): Promise<any> {
      
          const userId = req.user.sub;
          console.log("the user is in getLoginUserData", userId)
      
      
          const response = await this.userService.getScansId(userId)
      
          console.log("the response in get scans ", response)

          if(response.status === 200){

            const getScansSummary = await this.visionService.getScansSummary(response.scanAreas)


            console.log("the get scans Summary is", getScansSummary)

                return res.status(200).json({
      status: 200,
      message: getScansSummary.message,
      data: getScansSummary.scans,
    });

          }
   
      
          return res.status(400).json({
    status: 400,
    message: "failed",
    data: "error in getting the scan details",
  });
      
      
        }




                @ApiOperation({
          summary: "fetch ",
          description: "Get detail of any scan of specific user",
        })
        @ApiResponse({
          status: 200,
          description: 'Get detail of scan of specific user Successfully',  })
        @ApiResponse({ status: 403, description: "Forbidden." })
        @UseGuards(AuthGuard)
        @Get('get-scan/:id')
        @UseFilters(new HttpExceptionFilter())
        async getSingleScans(@Param('id') id: string, @Req() req, @Res() res: Response): Promise<any> {


           console.log("the id", id)

           const getScanDetail = await this.visionService.getScansDetails(id)

      
          // const userId = req.user.sub;
          // console.log("the user is in getLoginUserData", userId)
      
      
          // const response = await this.userService.getScansId(userId)
      
          console.log("the response in get scans ", getScanDetail)


          if(getScanDetail.status === 200){


                return res.status(200).json({
      status: getScanDetail.status,
      message: getScanDetail.message,
      data: getScanDetail.scanDetail,
    });

          }
   
      
          return res.status(400).json({
   status: getScanDetail.status,
      message: getScanDetail.message,
    data: getScanDetail.error,
  });
      
      
        }
 
        


  
 @Get('search-name')
  async search( @Res() res: Response, @Query('label') label?: string): Promise<any> {
    if (!label) throw new BadRequestException('Query param "label" is required');

    console.log("the label in name", label)
    const searchName = await this.visionService.searchTitle(label);
           return res.status(200).json({
      status: searchName.status,
      message: searchName.message,
      data: searchName.title,
    });
  }



}