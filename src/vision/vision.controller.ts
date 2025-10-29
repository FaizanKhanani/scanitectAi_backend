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
    @UploadedFiles()
    files: { image?: MulterFile[]; file?: MulterFile[] }, 
    @Body() body: RecognizeDto,
    @Query() query: RecognizeDto,
    @Req() req,
     @Res() res: Response,
  ) {
    const get = (k: keyof RecognizeDto) => body[k] ?? query[k];
    const userId = req.user.sub;
    console.log("the userid", userId)

    // 1) Get image bytes
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

    // 2) Options
    const lat = get('lat') ? parseFloat(get('lat') as string) : undefined;
    const lon = get('lon') ? parseFloat(get('lon') as string) : undefined;
    const topK = get('top_k') ? parseInt(get('top_k') as string, 10) : 5;

    // 3) Call service
    const results = await this.visionService.recognize(buf, { lat, lon, topK });
    if (!results.length) throw new BadRequestException('No landmark recognized');

    console.log("the result is", results)

   const placeName = results[0].name;

    const findPlaceDetail = await this.visionService.findPlaceDetail(placeName);
 console.log("the details", findPlaceDetail)
  if (findPlaceDetail) {


    await this.userService.addScanIdInUser(userId, findPlaceDetail.id);
    return res.status(200).json({
      status: 200,
      message: 'success',
      data: findPlaceDetail,
    });
  }

  const response = await this.visionService.getDetail(placeName);

  console.log("the response of wiki data", response)

  if (response.status === 200) {
    const saved = await this.visionService.upsertPlaceFromDetail(response.data, placeName);
    await this.userService.addScanIdInUser(userId, saved.id);

    return res.status(200).json({
      status: 200,
      message: 'success',
      data: saved, 
    });
  }

  return res.status(400).json({
    status: 400,
    message: 'failed',
    data: 'error in getting the detail',
  });



    // return results;



//     return res.status(200).json({
//     "status": 200,
//     "message": "success",
//     "data": {
//         "id": "68fcbf2854a04c18631281ce",
//         // "title": "Niagara Falls",
//         // "thumbnailImage": "http://localhost:4000/files/68fcbf1d7ede1cbb7993da48",
//         // "originalImage": "http://localhost:4000/files/68fcbf077ede1cbb7993da38",
//         // "description": "Niagara Falls is a group of three waterfalls at the southern end of Niagara Gorge, spanning the border between the province of Ontario in Canada and the state of New York in the United States. The largest of the three is Horseshoe Falls, which straddles the international border of the two countries. It is also known as the Canadian Falls. The smaller American Falls and Bridal Veil Falls lie within the United States. Bridal Veil Falls is separated from Horseshoe Falls by Goat Island and from American Falls by Luna Island, with both islands situated in New York.\nFormed by the Niagara River, which drains Lake Erie into Lake Ontario, the combined falls have the highest flow rate of any waterfall in North America that has a vertical drop of more than 50 m (164 ft). During peak daytime tourist hours, more than 168,000 m3 (5.9 million cu ft) of water goes over the crest of the falls every minute. Horseshoe Falls is the most powerful waterfall in North America, as measured by flow rate. Niagara Falls is famed for its beauty and is a valuable source of hydroelectric power. Balancing recreational, commercial, and industrial uses has been a challenge for the stewards of the falls since the 19th...",
//         // "countries": "Canada",
//         // "administrativeAreas": "Ontario",
//         // "ranges": [],
//         // "instanceOf": [
//         //     "tourist attraction",
//         //     "waterfall",
//         //     "horseshoe waterfall"
//         // ],
//         // "coordinates": [
//         //     -79.071,
//         //     43.08
//         // ],
//         // "height": 57
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
 console.log("the details", findPlaceDetail)
  // If we already have it, optionally ensure it has local image stored
  if (findPlaceDetail) {
    console.log("here im")

    
    // If it's still a remote URL, you can normalize it on-demand
    // if (findPlaceDetail.image && /^https?:\/\//i.test(findPlaceDetail.image)) {
    //   const normalized = await this.visionService.upsertPlaceFromDetail(findPlaceDetail.toObject?.() ?? findPlaceDetail, PlaceName);
    //   await this.userService.addScanIdInUser(userId, findPlaceDetail._id);

    //   return res.status(200).json({
    //     status: 200,
    //     message: 'success',
    //     data: findPlaceDetail,
    //   });
    // }

    await this.userService.addScanIdInUser(userId, findPlaceDetail.id);
    return res.status(200).json({
      status: 200,
      message: 'success',
      data: findPlaceDetail,
    });
  }

  

  // Not found -> fetch from Wikipedia and persist (with image saved to GridFS)
  const response = await this.visionService.getDetail(PlaceName);

  console.log("the response of wiki data", response)

  if (response.status === 200) {
    const saved = await this.visionService.upsertPlaceFromDetail(response.data, PlaceName);
    await this.userService.addScanIdInUser(userId, saved._id);

    return res.status(200).json({
      status: 200,
      message: 'success',
      data: saved, // this includes local image URL
    });
  }

  return res.status(400).json({
    status: 400,
    message: 'failed',
    data: 'error in getting the detail',
  });
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
      
  




}