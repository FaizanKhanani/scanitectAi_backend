import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseFilters,
  UseGuards,
} from "@nestjs/common";
import { LoggerService } from "../common/service/logger.service";
import { SignInDto } from "./dto/signIn.dto";
import { ForgotPasswordDto } from "./dto/forgotPasswordCodeSend.dto";
import { DeleteAccount } from "./dto/deleteAccount.dto";
import { ChangePassword } from "./dto/changePassword.dto";
import { ForgotPassword } from "./dto/forgotPassword.dto";
import { Response } from "express";
import { AuthService } from "./auth.service";
import { UserService } from "../users/users.service";
import { Public } from "../common/decorators";
import { HttpExceptionFilter } from "../utils/http-exception.filter";
import { RtGuard } from "../common/guards/rt.guard";
import { v4 as uuid } from "uuid";
import { EmailService } from '../common/service/mail.service';
import {
  sendResponse,
  loginSuccessResponse,
  loginErrorResponse,
  refreshErrorResponse,
} from "../utils/index";
import { statusMessage } from "../constant/statusMessage";
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { GetCurrentUser, GetCurrentUserId } from "../common/decorators";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  [x: string]: any;
  constructor(
    private authService: AuthService,
    private userService: UserService,
    private readonly logger: LoggerService,
    private readonly mailer: EmailService
  ) { }

  @ApiResponse(loginSuccessResponse)
  @ApiResponse(loginErrorResponse)
  @Public()
  @HttpCode(200)
  @UseFilters(new HttpExceptionFilter())
  @Post("login")
  async signIn(@Body() signInDto: SignInDto, @Res() res: Response) {
    const id: string = uuid();
    this.logger.log(
      "User login api called",
      id,
      "auth.controler.ts",
      "POST",
      "/login",
      "signIn"
    );

     console.log("the email", signInDto.email,"password", signInDto.password)

const user = await this.userService.checkUserEmail(signInDto.email);

console.log("User from DB:", user);

if (!user) { // means null or undefined
  console.log("User not found, returning unauthorized");
  return sendResponse(
    res,
    HttpStatus.UNAUTHORIZED,
    statusMessage[HttpStatus.UNAUTHORIZED],
    false,
    { message: 'Email and password is incorrect' }
  );
}

if (user.isEmailVerify === false) {
  return sendResponse(
    res,
    HttpStatus.UNAUTHORIZED,
    statusMessage[HttpStatus.UNAUTHORIZED],
    false,
    { message: 'The email is not verified, access denied' }
  );
}

// if both checks passed, continue login
const response = await this.authService.signIn(
  signInDto.email,
  signInDto.password
);
const token = response.token;
const userData = response.filteredUser;

res.cookie("access_token", token.access_token, {
  httpOnly: true,
  secure: false,
  sameSite: 'lax',
  expires: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
});

res.cookie("refresh_token", token.refresh_token, {
  httpOnly: true,
  secure: false,
  sameSite: 'lax',
  expires: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
});

return sendResponse(
  res,
  HttpStatus.OK,
  statusMessage[HttpStatus.OK],
  true,
  { token, userData }
);
  
  }

  @ApiResponse(loginSuccessResponse)
  @ApiResponse(refreshErrorResponse)
  @ApiCookieAuth("refresh_token")
  @ApiBearerAuth("JWT-auth")
  @Public()
  @UseGuards(RtGuard)
  @Post("/refresh")
  @HttpCode(200)
  @UseFilters(new HttpExceptionFilter())
  async refreshTokens(
    @GetCurrentUser("user") payload: any,
    @GetCurrentUser("user") userId: string,
    @Res() res: Response
  ) {
    const token = await this.authService.getTokens(payload);
    const id: string = uuid();
    this.logger.log(
      "User refresh api called",
      id,
      "auth.controler.ts",
      "POST",
      "/refresh",
      "refreshTokens"
    );
    res.cookie("access_token", token.access_token, {
      httpOnly: true,
      expires: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      path: "/",
      secure: true,
    });

    res.cookie("refresh_token", token.refresh_token, {
      httpOnly: true,
      expires: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      path: "/",

      secure: true,
    });

    return sendResponse(
      res,
      HttpStatus.OK,
      statusMessage[HttpStatus.OK],
      true,
      token
    );
  }

  @ApiResponse(loginSuccessResponse)
  @ApiResponse(loginErrorResponse)
  @Public()
  @HttpCode(200)
  @UseFilters(new HttpExceptionFilter())
  @Post("logout")
  async logout(@Body() signInDto: SignInDto, @Res() res: Response) {
    const id: string = uuid();
    this.logger.log(
      "User logout api called",
      id,
      "auth.controler.ts",
      "POST",
      "/logout",
      "logout"
    );

    res.clearCookie("access_token");
    res.clearCookie("refresh_token");
    res.clearCookie("uid");
    return sendResponse(
      res,
      HttpStatus.OK,
      statusMessage[HttpStatus.OK],
      true,
      null
    );
  }





    @ApiResponse({
      status: 200,
      description: ' OTP send successfully.',
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
    @Post('forgot-password-email')
    async forgotPasswordCodeSend(
      @Body() forgotPasswordCodeSend: ForgotPasswordDto,
      @Res() res: Response,
    ): Promise<any> {
      const { userEmail } = forgotPasswordCodeSend;
      
      console.log("the user email in forgot password controller", userEmail)

      const response = await this.authService.forgotPasswordEmail(userEmail)


       console.log("the user in auth controller", response)

       if(response.success === false){
          return sendResponse(
      res,
      HttpStatus.UNAUTHORIZED,
      statusMessage[HttpStatus.UNAUTHORIZED],
      false,
      {
        message : 'the user is not found of this email'
      }
    );

       }



        const isMAil = process.env.IS_EMAIL
    console.log('##############', isMAil)
    if (isMAil === "True") {
      console.log("the email", userEmail,"otp",response.data.resetPasswordOtp)
      await this.mailer.sendEmailVerification(userEmail, response.data.resetPasswordOtp)
    }
     
      return sendResponse(
        res,
        HttpStatus.OK,
        statusMessage[HttpStatus.OK],
        true,
        {  message: "the reset password code is send on you email" }
      );
    }


    @ApiResponse({
      status: 200,
      description: ' OTP send successfully.',
    })
    @ApiResponse({
      status: 400,
      description: 'Otp not send',
    })
    @ApiResponse({
      status: 403,
      description: 'Forbidden.',
    })




       @Public()
    @UseFilters(new HttpExceptionFilter())
    @Post('forgot-password')
    async forgotPassword(
      @Body() forgotPasswordDto: ForgotPassword,
      @Res() res: Response,
    ): Promise<any> {
      const { email, updatedPassword  } = forgotPasswordDto;
      
      console.log("the user email in forgot password controller", email, "update",updatedPassword )

        const changePassword = await this.authService.forogtPassword(email, updatedPassword)
        
        if(changePassword.success === false){
             return sendResponse(
        res,
        HttpStatus.UNAUTHORIZED,
        statusMessage[HttpStatus.UNAUTHORIZED],
        false,
        changePassword.message
      );

        }

        return sendResponse(
        res,
        HttpStatus.OK,
        statusMessage[HttpStatus.OK],
        true,
        changePassword.message
      );



      // const response = await this.authService.resetPassword(userEmail)


    //    console.log("the user in auth controller", response)

    //    if(response.success === false){
    //       return sendResponse(
    //   res,
    //   HttpStatus.UNAUTHORIZED,
    //   statusMessage[HttpStatus.UNAUTHORIZED],
    //   false,
    //   {
    //     message : 'the user is not found of this email'
    //   }
    // );

    //    }



    //     const isMAil = process.env.IS_EMAIL
    // console.log('##############', isMAil)
    // if (isMAil === "True") {
    //   console.log("the email", userEmail,"otp",response.data.resetPasswordOtp)
    //   await this.mailer.sendEmailVerification(userEmail, response.data.resetPasswordOtp)
    // }
     
    //   return sendResponse(
    //     res,
    //     HttpStatus.OK,
    //     statusMessage[HttpStatus.OK],
    //     true,
    //     {  message: "the reset password code is send on you email" }
    //   );
    }



   
    @Public()
    @UseFilters(new HttpExceptionFilter())
    @Post('change-password')
    async changePassword(
      @Body() changePasswordDto: ChangePassword,
      @Res() res: Response,
    ): Promise<any> {
      const { email, oldPassword, updatedPassword  } = changePasswordDto;
      
      console.log("the user email in forgot password controller", email, "old password",oldPassword,"update",updatedPassword )

        const changePassword = await this.authService.changePassword(email, oldPassword, updatedPassword)
        console.log("changePassword", changePassword)
        
        if(changePassword.success === false){
             return sendResponse(
        res,
        HttpStatus.UNAUTHORIZED,
        statusMessage[HttpStatus.UNAUTHORIZED],
        false,
        changePassword.message
      );

        }

        return sendResponse(
        res,
        HttpStatus.OK,
        statusMessage[HttpStatus.OK],
        true,
        changePassword.message
      );



      // const response = await this.authService.resetPassword(userEmail)


    //    console.log("the user in auth controller", response)

    //    if(response.success === false){
    //       return sendResponse(
    //   res,
    //   HttpStatus.UNAUTHORIZED,
    //   statusMessage[HttpStatus.UNAUTHORIZED],
    //   false,
    //   {
    //     message : 'the user is not found of this email'
    //   }
    // );

    //    }



    //     const isMAil = process.env.IS_EMAIL
    // console.log('##############', isMAil)
    // if (isMAil === "True") {
    //   console.log("the email", userEmail,"otp",response.data.resetPasswordOtp)
    //   await this.mailer.sendEmailVerification(userEmail, response.data.resetPasswordOtp)
    // }
     
    //   return sendResponse(
    //     res,
    //     HttpStatus.OK,
    //     statusMessage[HttpStatus.OK],
    //     true,
    //     {  message: "the reset password code is send on you email" }
    //   );
    }



    @UseFilters(new HttpExceptionFilter())
    @Post('delete-account')
    async deleteAccount(
      @Body() deleteAccountDto: DeleteAccount,
      @Res() res: Response,
    ): Promise<any> {
      const { email} = deleteAccountDto;
      
      console.log("the user email in forgot password controller", email )

        const deleteAccount = await this.authService.deleteAccount(email)
        console.log("changePassword", deleteAccount)
        
      //   if(changePassword.success === false){
      //        return sendResponse(
      //   res,
      //   HttpStatus.UNAUTHORIZED,
      //   statusMessage[HttpStatus.UNAUTHORIZED],
      //   false,
      //   changePassword.message
      // );

      //   }

      //   return sendResponse(
      //   res,
      //   HttpStatus.OK,
      //   statusMessage[HttpStatus.OK],
      //   true,
      //   changePassword.message
      // );
    }









}
