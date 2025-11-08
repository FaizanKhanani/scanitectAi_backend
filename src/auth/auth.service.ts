import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { LoggerService } from '../common/service/logger.service';
import { InjectModel } from "@nestjs/mongoose";
import { UserService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { Model } from "mongoose";
import { User } from "../users/schemas/user.schema";
import * as bcrypt from 'bcrypt';
import { jwtConstants } from '../auth/constants';
import { v4 as uuid } from 'uuid';
import { sendResponse } from 'src/utils';
import { response } from 'express';

@Injectable()
export class AuthService {
  constructor(
     @InjectModel(User.name) private readonly userModel: Model<User>,
    private usersService: UserService,
    private jwtService: JwtService,
    private readonly logger: LoggerService
  ) { }

  async signIn(email: string, pass: string) {

    const id: string = uuid();
    this.logger.log('auth service api called', id, 'auth.service.ts', '', '', 'signIn-service');
    const user: any = await this.usersService.findOneUser(email);

    const filterdUserDoc = user.toObject();

    // let userData;
  const { 
  password, 
  createdAt, 
  updatedAt,  
  isEmailVerify, 
  resendCode, 
  resetPasswordCodeStatus, 
  otp, 
  otpExpiry, 
  ...filteredUser 
} = filterdUserDoc;

console.log("the user ",filteredUser);
    console.log("the user is", user)
    if (!user) {
      throw new UnauthorizedException('Username and password wrong.');
    }

    const match = await bcrypt.compare(pass, user?.password);
    if (match) {
      const payload = { email: user.email, userId: user._id.toString(), username: user.username, role: user.role };
      const tokens = await this.getTokens(payload);

      return {
        filteredUser,
        token:{...tokens}
        
      };
    }

  }


  async refreshTokens(userId: string, rt: string) {
    const user = await this.usersService.findOne(userId);

    if (!user || !user.hashdRt) throw new ForbiddenException('Access Denied.');

    const rtMatches = await bcrypt.compare(rt, user.hashdRt);

    if (!rtMatches) throw new ForbiddenException('Access Denied.');

    const tokens = await this.getTokens(user);

    const rtHash = await this.hashPassword(tokens.refresh_token);

    await this.usersService.updateOne(user._id, { hashdRt: rtHash });
    return tokens;
  }

  async getTokens(user: any) {

    const [at, rt] = await Promise.all([
      this.jwtService.signAsync(
        {
          sub: user.userId,
          email: user.email,
          username: user.username,
          role: user.role,
         

        },
        {
          secret: jwtConstants.secret,
          expiresIn: '24h',
        },
      ),
      this.jwtService.signAsync(
        {
          sub: user.userId,
          email: user.email,
          username: user.username,
           role: user.role,
        },
        {
          secret: jwtConstants.secret,
          expiresIn: '30d',
        },
      ),
    ]);

    return {
      access_token: at,
      refresh_token: rt,
    };
  }

  //Encriptación de la copntraseña
  async hashPassword(data: string) {
    return bcrypt.hash(data, 10);
  }


  async forgotPasswordEmail(userEmail: string){
    const email = userEmail
    console.log("in auth service", userEmail )


    const user = await this.userModel.findOne({email})



    if (!user){
      return {success: false, message: 'the user is not found of this email'};
    }


    const resetPasswordOtp = Math.floor(1000 + Math.random() * 9000).toString();

      const resetPasswordExpiry = new Date(Date.now() + 5 * 60 * 1000);
   
    console.log("teeeeee",user)

    await this.userModel.updateOne(
    { email },
    { otp: resetPasswordOtp, otpExpiry: resetPasswordExpiry, resetPasswordCodeStatus: true}
  );
   
    return { success: true, message: 'user is found' , data:{resetPasswordOtp, resetPasswordExpiry}};



  }



   async forogtPassword(email: string, updatedPassword: string){

    console.log("the user email in forgot password service", email, "update",updatedPassword )
   
    const user = await this.userModel.findOne({ email });
    console.log("the user is", user)

    if(!user){
       return {success: false, message: 'the user is not found of this email'};
    }

    if(user.resetPasswordCodeStatus === false){

      return {success: false, message: 'the reset password request is not come'};
 
    }


    //  const match = await bcrypt.compare(oldPassword, user?.password);


    // if(!match){
    //    return {success: false, message: 'the enter password is not correct'};
    // }

  

     const saltOrRounds = 10;
     const hashedPassword = await bcrypt.hash(
      updatedPassword,
      saltOrRounds
    );

    console.log("the hashed",hashedPassword )

        await this.userModel.updateOne(
    { email: email },
    { password: hashedPassword , resetPasswordCodeStatus: false }
  );



  return{
        success: true,  message: 'Password is successfully update' 
      }


   








  }




  async changePassword(email: string, oldPassword: string, updatedPassword: string){

    console.log("the user email in forgot password service", email, "old password",oldPassword,"update",updatedPassword )
   
    const user = await this.userModel.findOne({ email });
    console.log("the user is", user)

    if(!user){
       return {success: false, message: 'the user is not found of this email'};
    }

    // if(user.resetPasswordCodeStatus === false){

    //   return {success: false, message: 'the reset password request is not come'};
 
    // }


     const match = await bcrypt.compare(oldPassword, user?.password);


    if(!match){
       return {success: false, message: 'the enter password is not correct'};
    }

    if (match) {

     const saltOrRounds = 10;
     const hashedPassword = await bcrypt.hash(
      updatedPassword,
      saltOrRounds
    );

    console.log("the hashed",hashedPassword )

        await this.userModel.updateOne(
    { email: email },
    { password: hashedPassword , resetPasswordCodeStatus: false }
  );



  return{
        success: true,  message: 'Password is successfully update' 
      }


   


    // createUserDto.password = hashedPassword;

      // const payload = { email: user.email, userId: user._id.toString(), username: user.username, role: user.role };
      // const tokens = await this.getTokens(payload);

      // return {
      //   user,
      //   token:{...tokens}
        
      // };
    }





  }
}
