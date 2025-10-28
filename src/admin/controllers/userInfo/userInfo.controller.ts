import {  
     Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Patch,
  Param,
  Get,
  Res,
  
  UseFilters,
  UseGuards, } from '@nestjs/common';
  import {
  sendResponse,
} from "../../../utils";
import { statusMessage } from "../../../constant/statusMessage";
  import { Roles } from '../../../common/decorators/roles.decorator';
  import { AuthGuard } from "../../../common/guards/at.guard"
   import { RolesGuard } from "../../../common/guards/roles.guard"
  import { HttpExceptionFilter } from "../../../utils/http-exception.filter";
  import { Public } from "../../../common/decorators";
  import { UserInfoService } from "../../services/userInfo/userInfo.service"
import {
  ApiTags,
  ApiResponse,
} from "@nestjs/swagger";


@ApiTags("admin")
@UseGuards(AuthGuard, RolesGuard)
@Controller('admin/user')
export class UserInfoController {

     constructor(
        private userInfoService: UserInfoService,
        
      ) { }




    @ApiResponse({
    status: 200,
    description: 'get successfully user data ',
  })
  @ApiResponse({
    status: 400,
    description: 'data is not fetch successfully',
  })
      @HttpCode(200)
      @UseFilters(new HttpExceptionFilter())
       @Roles('admin')
      @Get("get-all-user")
      async getUserInfo(
         @Res() res: Response
      ){

        console.log("hello")

        const allUser = await this.userInfoService.getUser()

       if(allUser.success === false){
         return sendResponse(
              res,
              HttpStatus.FORBIDDEN,
              statusMessage[HttpStatus.FORBIDDEN],
              false,
              {message: "user is no fetched successfully"}
            ); 
       }

        return sendResponse(
              res,
              HttpStatus.OK,
              statusMessage[HttpStatus.OK],
              true,
            //   {message: "successfully fetch all users "},
               allUser
            ); 
      }




@Patch('update-user/:id')
@Roles('admin') // only admin can update users
  async updateUser(
    @Param('id') id: string,
    @Body() updateData: any,
    @Res() res: Response
  ) {
    console.log("the data")
    console.log("the data", updateData)
    const response =await this.userInfoService.updateUser(id, updateData);

  console.log(response)
      if(response.success === false){
         return sendResponse(
              res,
              HttpStatus.FORBIDDEN,
              statusMessage[HttpStatus.FORBIDDEN],
              false,
              {message: "user is no found of this id"}
            ); 
       }

        return sendResponse(
              res,
              HttpStatus.OK,
              statusMessage[HttpStatus.OK],
              true,
            //   {message: "successfully fetch all users "},
               response.data
            ); 


  }



}
