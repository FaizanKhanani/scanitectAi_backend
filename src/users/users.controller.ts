import {
  Body,
  Controller,
  Get,
  Patch,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseFilters,
  UseGuards,
  UsePipes,
  ValidationPipe,
  UseInterceptors, 
  UploadedFile,
  BadRequestException
} from "@nestjs/common";
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
// import { ApiConsumes, ApiBody } from '@nestjs/swagger';
import { Public } from "../common/decorators";
import { LoggerService } from '../common/service/logger.service';
import { UserService } from "./users.service";
// import { MailerService } from "../mailer/mailer.service"
import { CreateUserDto } from "./dto/create-user.dto";
import { VerifyOtpDto } from "./dto/verify-otp.dto";
import { ResendOtpDto } from "./dto/resend-otp.dto";
import { GoogleLoginDto } from "./dto/google-login.dto";
import { EditUserProfile } from "./dto/edit-user-profile.dto"
import { Request, Response } from "express";
import { UpdateLanguageCodeDto } from './dto/update-language-code.dto';
import {
  sendResponse,
  userErrorResponse,
  userListSuccessResponse,
  userSuccessResponse,
} from "../utils";
import { statusMessage } from "../constant/statusMessage";
import { HttpExceptionFilter } from "../utils/http-exception.filter";
import { UserRequest, responseData, userData } from "../interface/common";
import { AuthGuard } from "../common/guards/at.guard";
import { ApiOperation, ApiResponse, ApiTags, ApiConsumes, ApiBody  } from "@nestjs/swagger";
import { v4 as uuid } from 'uuid';
import { EmailService } from '../common/service/mail.service';
import { TranslationService } from '../translation/translate.service';


export const imageFileFilter = (
  req: any,
  file: Express.Multer.File,
  cb: (error: any, accept: boolean) => void,
) => {
  const allowed = ['image/png', 'image/jpeg', 'image/webp'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new BadRequestException('Only PNG/JPEG/WEBP allowed'), false);
};


@ApiTags("users")
@Controller("v1/users")
export class UserController {
  constructor(private readonly userService: UserService,
    private readonly logger: LoggerService,
    private readonly mailer: EmailService,
     private readonly translationService: TranslationService, 
  
  ) { }





  // @ApiOperation({
  //   summary: "Create user",
  //   description: "User signup app",
  // })
  // @ApiResponse(userSuccessResponse)
  // @ApiResponse(userErrorResponse)
  // @Public()
  // @Post()
  // @UseFilters(new HttpExceptionFilter())
  // @UsePipes(new ValidationPipe({ transform: true }))
  // async create(
  //   @Body() createCatDto: CreateUserDto,
  //   @Res() res: Response
  // ): Promise<responseData> {
  //   const id: string = uuid();
  //   this.logger.log('User create api called', id, 'users.controler.ts', 'POST', '/users', 'create');
  //   const findUser = await this.userService.findOneUser(createCatDto.email);

  //   console.log("the finduser",findUser )
  //   if((!findUser) || (findUser && !findUser?.isEmailVerify)){
  //   // if(!findUser){
  //     console.log("the data is",createCatDto, "the typeof ", typeof(createCatDto) )
  //   const user = await this.userService.create(createCatDto);

  //   const isMAil = process.env.IS_EMAIL
  //   console.log('##############', isMAil)
  //   if (isMAil === "True") {
  //     console.log("the email", user.email,"otp",user.otp)
  //     await this.mailer.sendEmailVerification(user.email, user.otp)
  //   }
  //   return sendResponse(
  //     res,
  //     HttpStatus.CREATED,
  //     statusMessage[HttpStatus.CREATED],
  //     true,
  //     user
  //   );
  // }
  // else{
  //     return sendResponse(
  //     res,
  //     HttpStatus.FORBIDDEN,
  //     statusMessage[HttpStatus.FORBIDDEN],
  //     false,
  //     {message: "user from this email is already created"}
  //   ); 
  // }
  // }







 @ApiOperation({
    summary: "Create user",
    description: "User signup app",
  })
  @ApiResponse(userSuccessResponse)
  @ApiResponse(userErrorResponse)
  @Public()
    @Post()
  @UseFilters(new HttpExceptionFilter())
  @UsePipes(new ValidationPipe({ transform: true }))
  async create(
    @Body() body: { data: CreateUserDto; lang?: string },
    @Res() res: Response
  ): Promise<responseData> {
    const { data: createCatDto, lang } = body;  

    const targetLang = lang || 'en';               
    const id: string = uuid();
    this.logger.log(
      'User create api called',
      id,
      'users.controler.ts',
      'POST',
      '/users',
      'create',
    );
console.log("the data", createCatDto ,"ddd", lang )
    const findUser = await this.userService.findOneUser(createCatDto.email);

    if ((!findUser) || (findUser && !findUser?.isEmailVerify)) {
      const user = await this.userService.create(createCatDto);

      const isMAil = process.env.IS_EMAIL;
      if (isMAil === 'True') {
        await this.mailer.sendEmailVerification(user.email, user.otp);
      }

    
      return sendResponse(
        res,
        HttpStatus.CREATED,
        statusMessage[HttpStatus.CREATED],
        true,
        user,
      );
    } else {
   console.log("the find user", findUser)
      console.log("the error block")
      // ---- translate error message ----
      const baseError = 'user from this email is already created';

    //  const errorMessage =  await this.translationService.translate(baseError, targetLang);
      const errorMessage =
        targetLang === 'en'
          ? baseError
          : await this.translationService.translate(baseError, targetLang);

console.log("the error message", errorMessage)

      return sendResponse(
        res,
        HttpStatus.FORBIDDEN,
        statusMessage[HttpStatus.FORBIDDEN],
        false,
        { message: errorMessage || baseError },
      );
    }
  }









  @ApiOperation({
summary: 'Google login/signup',
description: 'Verify Google ID token, upsert user, return app tokens',
})
@ApiResponse({ status: 200, description: 'Login success' })
@ApiResponse({ status: 401, description: 'Invalid Google token' })
@Public()
@Post('google')
@UseFilters(new HttpExceptionFilter())
async googleAuth(@Body() dto: GoogleLoginDto, @Res() res: Response) {
const id: string = uuid();
try {
  console.log("the id", dto.idToken)
const result = await this.userService.loginWithGoogle(dto.idToken);

console.log("the result is", result)
return sendResponse(
res,
HttpStatus.OK,
statusMessage[HttpStatus.OK],
true,
result
);
} catch (e: any) {
return sendResponse(
res,
HttpStatus.UNAUTHORIZED,
e?.message || 'Invalid Google token',
false,
null
);
}
}


  // get user
  @ApiOperation({
    summary: "User List",
    description: "Get User List",
  })
  @ApiResponse(userListSuccessResponse)
  @ApiResponse({ status: 403, description: "Forbidden." })
  @UseGuards(AuthGuard)
  @Get()
  @UseFilters(new HttpExceptionFilter())
  async findAll(@Res() res: Response): Promise<userData[]> {
    const id: string = uuid();
    this.logger.log('User list api called', id, 'users.controler.ts', 'GET', '/users', 'findAll');
    const userList = await this.userService.findAll();


    return sendResponse(
      res,
      HttpStatus.OK,
      statusMessage[HttpStatus.OK],
      true,
      userList
    );
  }




  @ApiOperation({
    summary: 'OTP Verification',
    description: 'Verifies the OTP sent to the user.',
  })
  @ApiResponse({
    status: 200,
    description: 'OTP verified successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired OTP.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden.',
  })
  // @UseGuards(AuthGuard)
  @Public()
  @UseFilters(new HttpExceptionFilter())
  @Post('verify-otp')
  async verifyOtp(
    @Body() verifyOtpDto: VerifyOtpDto,
    @Res() res: Response,
  ): Promise<any> {
    const { userEmail, otp } = verifyOtpDto;
    
    console.log("the user email", userEmail,"the otp", otp)
    // Service call to verify OTP
    const isValid = await this.userService.verifyOtp(userEmail, otp);

    if (!isValid.success) {
      return sendResponse(
        res,
        HttpStatus.BAD_REQUEST,
        isValid.message,
        // 'Invalid or expired OTP.',
        false,
      );
    }

    return sendResponse(
      res,
      HttpStatus.OK,
      statusMessage[HttpStatus.OK],
      true,
      { message: 'OTP verified successfully' },
    );
  }



  @ApiOperation({
    summary: 'OTP Verification',
    description: 'Verifies the OTP sent to the user.',
  })
  @ApiResponse({
    status: 200,
    description: 'resend OTP send successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Otp not send',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden.',
  })
  // @UseGuards(AuthGuard)
  @Public()
  @UseFilters(new HttpExceptionFilter())
  @Post('resend-otp')
  async resendOtp(
    @Body() resendOtpDto: ResendOtpDto,
    @Res() res: Response,
  ): Promise<any> {
    const { userEmail } = resendOtpDto;
    
    console.log("the user email in resend code controller", userEmail)
   
    const response = await this.userService.resendOtp(userEmail);


      if (response.success === true) {
      console.log("the email", userEmail,"otp",response.data.resendOtp)
      await this.mailer.sendEmailVerification(userEmail, response.data.resendOtp)
    }

    
    

    if (!response.success) {
      return sendResponse(
        res,
        HttpStatus.BAD_REQUEST,
        response.message,
        // 'Invalid or expired OTP.',
        false,
      );
    }

    return sendResponse(
      res,
      HttpStatus.OK,
      statusMessage[HttpStatus.OK],
      true,
      response.message
    );
  }




  @ApiOperation({
    summary: "fetch ",
    description: "Get login user",
  })
  @ApiResponse({
    status: 200,
    description: 'Edit profile Successfully',  })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @UseGuards(AuthGuard)
  @Get('get-login-user-data')
  @UseFilters(new HttpExceptionFilter())
  async getLoginUserData(@Req() req, @Res() res: Response): Promise<any> {

    const userId = req.user.sub;
    console.log("the user is in getLoginUserData", userId)


    const response = await this.userService.getUserDetail(userId)

    console.log("the response", response)

    if(!response){
      return sendResponse(
        res,
        HttpStatus.BAD_REQUEST,
        "the user data is not found",
        // 'Invalid or expired OTP.',
        false,
      );
    }  
    
    return sendResponse(
      res,
      HttpStatus.OK,
      statusMessage[HttpStatus.OK],
      true,
      {"message": "successfully fetch user detail", 'data' : response }
      
    
    );




  }







  @ApiOperation({
    summary: 'Edit profile',
    description: 'Edit profile Successfully',
  })
  @ApiResponse({
    status: 200,
    description: 'Edit profile Successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Edit profile not done Successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden.',
  })
@UseGuards(AuthGuard)
  @UseFilters(new HttpExceptionFilter())
  @ApiConsumes('multipart/form-data')
  @ApiBody({
schema: {
type: 'object',
properties: {
username: { type: 'string' },
nickName: { type: 'string' },
email: { type: 'string' },
phoneNumber: { type: 'string' },
country: { type: 'string' },
gender: { type: 'string' },
address: { type: 'string' },
image: { type: 'string', format: 'binary' }, // file key
},
},
})
@UseInterceptors(
  FileInterceptor('image', {
    storage: memoryStorage(),
    fileFilter: (req, file, cb) => {
      const allowed = ['image/png', 'image/jpeg', 'image/webp'];
      allowed.includes(file.mimetype)
        ? cb(null, true)
        : cb(new BadRequestException('Only PNG, JPEG, WEBP allowed'), false);
    },
    limits: { fileSize: 5 * 1024 * 1024 },
  }),
)
  @Post('edit-profile')
  async editprofile(
    @Req() req,
    @Body() editUserProfile: EditUserProfile,
    @UploadedFile() image?: Express.Multer.File,
    @Res() res?: Response,
  ): Promise<any> {
    // const { email } = editUserProfile;
    const userId = req.user.sub;
    console.log("the user is", userId,"req.user", req.user, "useeeeee", req)
    
    console.log("the user email in resend code controller", editUserProfile)


   



    // const response = await this.userService.editProfile(userId, editUserProfile )
    const response = await this.userService.editProfile(userId, editUserProfile, image);





   console.log("the response", response)

  

 
    
    

    if (response.success === false) {
      console.log("hello im false")
      return sendResponse(
        res,
        HttpStatus.BAD_REQUEST,
        response.message,
        // 'Invalid or expired OTP.',
        false,
      );
    }

    return sendResponse(
      res,
      HttpStatus.OK,
      statusMessage[HttpStatus.OK],
      true,
      response
    
    );
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
        @Patch('language-code/:id')
        @UseFilters(new HttpExceptionFilter())
  // @Patch('language-code:id')
  async updateLanguageCode(
    @Param('id') id: string,
    @Body() body: UpdateLanguageCodeDto,
     @Res() res?: Response,
  ) {

    console.log("the id", id, "languageCode", body.languageCode)
    const updatedUser = await this.userService.updateLanguageCode(
      id,
      body.languageCode,
    );
    if(updatedUser.status === 200){
//  return { data: updatedUser };
     return sendResponse(
      res,
      HttpStatus.OK,
      statusMessage[HttpStatus.OK],
      true,
      updatedUser.data
    
    );
    }

         return sendResponse(
        res,
        HttpStatus.BAD_REQUEST,
        updatedUser.message,
        // 'Invalid or expired OTP.',
        false,
      );
   
  }



 

}
