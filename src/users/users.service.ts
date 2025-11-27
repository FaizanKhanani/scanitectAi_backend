import { Injectable, BadRequestException, UnauthorizedException } from "@nestjs/common";
import { LoggerService } from '../common/service/logger.service';
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { CreateUserDto } from "./dto/create-user.dto";
import { EditUserProfile } from "./dto/edit-user-profile.dto"
import { User, UserDocument  } from "./schemas/user.schema";
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import { RefresToken } from "./schemas/refreshtoken.schema";
import * as bcrypt from "bcrypt";
import { userData } from "src/interface/common";
import { v4 as uuid } from 'uuid';
import { FilesService } from '../files/files.service';

















@Injectable()
export class UserService {
  private googleClient = new OAuth2Client()
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private jwtService: JwtService,
    @InjectModel(RefresToken.name)
    private readonly RefresTokenModel: Model<RefresToken>,
    private readonly logger: LoggerService,
    private readonly filesService: FilesService,
  ) { }

//   async create(createUserDto: CreateUserDto): Promise<CreateUserDto> {
//     console.log("the user for signup", createUserDto)
    
//     const id: string = uuid();
//     this.logger.log('User service create called', id, 'users.service.ts', '', '', 'create-service');
//     const saltOrRounds = 10;
//     const hashedPassword = await bcrypt.hash(
//       createUserDto.password,
//       saltOrRounds
//     );
//     createUserDto.password = hashedPassword;

//     const otp = Math.floor(1000 + Math.random() * 9000).toString();

//       const expiry = new Date(Date.now() + 5 * 60 * 1000);
   
//       console.log("the expiry", expiry  )
//      const createdUser = await this.userModel.create({
//     ...createUserDto,
//     otp,
//     otpExpiry: expiry,
//   });


  
//  console.log(`✅ OTP for ${createdUser.email}: ${otp} (expires in 5 mins)`);

  
//     return createdUser;
//   }



async create(createUserDto: CreateUserDto): Promise<CreateUserDto> {
  console.log("User signup request:", createUserDto);

  const id: string = uuid();
  this.logger.log('User service create called', id, 'users.service.ts', '', '', 'create-service');

  // Hash password
  const saltOrRounds = 10;
  createUserDto.password = await bcrypt.hash(createUserDto.password, saltOrRounds);

  // Generate OTP & expiry
  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

  // 👉 STEP 1: Check if user already exists
  const existingUser = await this.userModel.findOne({ email: createUserDto.email });

  if (existingUser) {
    console.log("the existing user is", existingUser)
    console.log("⚠️ User already exists. Deleting old user...");
    await this.userModel.deleteOne({ email: createUserDto.email });
  }
      
  // 👉 STEP 2: Create new user
  const createdUser = await this.userModel.create({
    ...createUserDto,
    otp,
    otpExpiry
  });                           

  console.log(`✅ OTP for ${createdUser.email}: ${otp} (expires in 5 mins)`);

  return createdUser;
}






  private getGoogleAudiences() {
// Accept tokens from any of your app's registered clients
return [
process.env.GOOGLE_WEB_CLIENT_ID,
process.env.GOOGLE_ANDROID_CLIENT_ID,
// process.env.GOOGLE_IOS_CLIENT_ID,
].filter(Boolean) as string[];
}



private async verifyGoogleIdToken(idToken: string) {



const ticket = await this.googleClient.verifyIdToken({
idToken,
audience: this.getGoogleAudiences(),
});



const payload = ticket.getPayload();
if (!payload) throw new UnauthorizedException('Invalid Google token');
const issOk =
  payload.iss === 'accounts.google.com' ||
  payload.iss === 'https://accounts.google.com';
if (!issOk) throw new UnauthorizedException('Invalid Google token issuer');

return payload; // contains sub, email, name, picture, email_verified, etc.
}






private async issueTokens(user: UserDocument) {
const payload = { sub: user._id.toString(), role: user.role };
const accessToken = await this.jwtService.signAsync(payload, {
secret: process.env.JWT_SECRET,
expiresIn: '365d',
});
const refreshToken = await this.jwtService.signAsync(payload, {
secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
expiresIn: '365d',
});
return { accessToken, refreshToken };
}




private usernameFromNameOrEmail(name?: string, email?: string) {
const base =
(name || (email ? email.split('@')[0] : 'user'))
.toLowerCase()
.replace(/\W+/g, '') || 'user';
return base; // you can add a uniqueness loop if needed
}





async loginWithGoogle(idToken: string) {
const payload = await this.verifyGoogleIdToken(idToken);
const { sub: googleId, email, name, picture, email_verified } = payload;

if (!googleId) throw new UnauthorizedException('No Google sub in token');
if (!email) throw new BadRequestException('No email in Google token');

// Find by googleId or by email (to link local account)
let user = await this.userModel.findOne({
  $or: [{ googleId }, { email }],
});

if (!user) {
  // Create new user as Google user
  user = await this.userModel.create({
    username: this.usernameFromNameOrEmail(name, email),
    email,
    googleId,
    authProviders: ['google'],
    isEmailVerify: !!email_verified, // trust if true
    image: picture || null,
    role: 'user',
    password: null, // no password for Google-only account
  });
} else {
  const updates: any = {};
  if (!user.googleId) updates.googleId = googleId;
  if (email_verified && !user.isEmailVerify) updates.isEmailVerify = true;
  if (picture && !user.image) updates.image = picture;

  const providers = new Set(user.authProviders || []);
  providers.add('google');
  updates.authProviders = Array.from(providers);

  if (Object.keys(updates).length) {
    await this.userModel.updateOne({ _id: user._id }, updates);
    user = await this.userModel.findById(user._id);
  }
}

const tokens = await this.issueTokens(user);
return { user, tokens };

}




















  async findAll(): Promise<userData[]> {
    const id: string = uuid();
    this.logger.log('User service findall called', id, 'users.service.ts', '', '', 'findAll-service');
    return this.userModel.find().exec();
  }

  async findOne(id: string, projection = {}): Promise<userData> {
    return this.userModel.findOne({ _id: id }, projection).exec();
  }

  async findOneUser(email: string): Promise<userData> {
    return this.userModel.findOne({ email: email }).exec();
  }



  async delete(id: string) {
    const deletedUser = await this.userModel
      .findByIdAndRemove({ _id: id })
      .exec();
    return deletedUser;
  }

  async updateOne(userId: Types.ObjectId | String, data: userData) {
    await this.userModel.updateOne({ _id: userId }, data);
  }

  async createRefreshToken(createUserDto: CreateUserDto): Promise<Boolean> {
    const createduUser = await this.RefresTokenModel.create(createUserDto);
    return true;
  }



  async verifyOtp(userEmail: string, otp: string){
  const email = userEmail
 console.log("the user email in user service", email,"the otp", otp)
  // Example logic:
  const record = await this.userModel.findOne({ email });
  console.log("the record",record)

  if (!record){
      return { success: false, message: 'User not found' };
    }
 
  // Check expiry
  if (!record.otpExpiry || new Date() > record.otpExpiry) {

    
    
       await this.userModel.updateOne(
    { email: userEmail },
    { otp: null, otpExpiry: null, resendCode: true }
  );

      return { success: false, message: 'OTP expired' };
    }

    if (record.otp !== otp) {
      return { success: false, message: 'Invalid OTP' };
    }

    // OTP is valid -> mark email as verified
    console.log("here reach")
    record.isEmailVerify = true;
    record.otp = null; // remove OTP so it can’t be reused
    record.otpExpiry = null;
    await record.save();

    return { success: true, message: 'Email verified successfully!' };


  // Mark OTP as used (or delete)
  //  await this.userModel.updateOne(
  //   { email: userEmail },
  //   { otp: null, otpExpiresAt: null }
  // );

  // return true;
}

async resendOtp(userEmail: string){
  const email = userEmail
  console.log("the user email", email )
  const user = await this.userModel.findOne({ email });
  console.log("the user is", user)
  

   const now = new Date();
  const expiry = new Date(user.otpExpiry);

  
  const diffInMs =  now.getTime() - expiry.getTime();
  const diffInMinutes = diffInMs / (1000 * 60);


  console.log("the diff in min", diffInMinutes)



 if ( (user.otp === null && user.otpExpiry === null && user.resendCode === true) || (diffInMinutes > 5)) {
  
  console.log("in if block")
  const resendOtp = Math.floor(1000 + Math.random() * 9000).toString();

      const resendExpiry = new Date(Date.now() + 5 * 60 * 1000);


        await this.userModel.updateOne(
    { email: userEmail },
    { otp: resendOtp, otpExpiry: resendExpiry, resendCode: false }
  );



      return{
        success: true, message: 'code resend successfully!' , data: {resendOtp, resendExpiry}
      }

 }

  return{
        success: false,  message: 'Resend code not send' 
      }


}

async checkUserEmail(email: string){
  console.log("the email is", email)

  const user = await this.userModel.findOne({ email }).select('isEmailVerify');
  return user

}


async getUserDetail(id: string){
  console.log("the email is", id)

   const user = await this.userModel.findById(id).select('-password -createdAt -updatedAt -isEmailVerify -resendCode -resetPasswordCodeStatus -otp -otpExpiry');
  return user

}



private isHttpUrl(s?: string) {
  if (!s) return false;
  // Regex way
  return /^https?:\/\/\S+/i.test(s);
  // Or safer:
  // try { const u = new URL(s); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; }
}

private parseImageString(imageStr: string): { buffer: Buffer; mimeType: string; ext: string } {
  // Supports "data:image/png;base64,..." or plain base64 without prefix
  let base64Data = imageStr;
  let mimeType = 'image/jpeg';
  let ext = 'jpg';

  const match = /^data:(.+);base64,(.*)$/i.exec(imageStr);
  if (match) {
    mimeType = match[1];
    base64Data = match[2];

    if (mimeType.includes('png')) ext = 'png';
    else if (mimeType.includes('webp')) ext = 'webp';
    else if (mimeType.includes('gif')) ext = 'gif';
    else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = 'jpg';
    else if (mimeType.includes('heic') || mimeType.includes('heif')) ext = 'heic';
    else ext = 'bin';
  }

  const buffer = Buffer.from(base64Data, 'base64');
  return { buffer, mimeType, ext };
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

private buildFileUrl(fileId: string) {
  const base = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
  return `${base}/files/${fileId}`;
}

// Optional: keep data clean (don’t send undefined to Mongo)
private removeUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

async editProfile(
  userId: string,
  editUserProfile: EditUserProfile,
  imageFile?: Express.Multer.File, // from FileInterceptor('image')
) {
  // email uniqueness only if provided
  if (editUserProfile.email) {
    const existing = await this.userModel.findOne({
      email: editUserProfile.email,
      _id: { $ne: userId },
    });
    if (existing) {
      return { message: 'user is found of this email plzz use another email', success: false };
    }
  }

  const updateData = this.removeUndefined({
    username: editUserProfile.username,
    nickName: editUserProfile.nickName,
    email: editUserProfile.email,
    phoneNumber: editUserProfile.phoneNumber,
    country: editUserProfile.country,
    gender: editUserProfile.gender,
    address: editUserProfile.address,
  });

  // Allowed mime types (optional but safer)
  const allowedMimes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/heic', 'image/heif']);

  // Prefer multipart file if provided
  if (imageFile?.buffer) {
    if (!allowedMimes.has(imageFile.mimetype)) {
      return { message: 'Unsupported image type', success: false };
    }

    const ext = this.extFromMime(imageFile.mimetype);
    const filename = `avatar-${userId}-${Date.now()}.${ext}`;

    const current = await this.userModel.findById(userId).select('imageFileId');

    const { fileId } = await this.filesService.uploadFromBuffer(
      imageFile.buffer,
      filename,
      imageFile.mimetype,
      { userId, type: 'avatar' },
      'avatars',
    );

    (updateData as any).image = this.buildFileUrl(fileId);
    (updateData as any).imageFileId = fileId;

    if (current?.imageFileId) {
      await this.filesService.deleteById(current.imageFileId, 'avatars');
    }
  }
  // Fallback: base64 in JSON
  else if (editUserProfile.image && !this.isHttpUrl(editUserProfile.image)) {
    const { buffer, mimeType, ext } = this.parseImageString(editUserProfile.image);
    if (!allowedMimes.has(mimeType)) {
      return { message: 'Unsupported image type', success: false };
    }

    const filename = `avatar-${userId}-${Date.now()}.${ext}`;
    const current = await this.userModel.findById(userId).select('imageFileId');

    const { fileId } = await this.filesService.uploadFromBuffer(
      buffer,
      filename,
      mimeType,
      { userId, type: 'avatar' },
      'avatars',
    );

    (updateData as any).image = this.buildFileUrl(fileId);
    (updateData as any).imageFileId = fileId;

    if (current?.imageFileId) {
      await this.filesService.deleteById(current.imageFileId, 'avatars');
    }
  }
  // Or accept a direct URL
  else if (this.isHttpUrl(editUserProfile.image)) {
    (updateData as any).image = editUserProfile.image;
  }

  const updatedUser = await this.userModel
    .findByIdAndUpdate(userId, updateData, { new: true })
    .select('-password -createdAt -updatedAt -isEmailVerify -resendCode -resetPasswordCodeStatus -otp -otpExpiry');

  return { message: 'user is updated successfully', data: updatedUser, success: true };
}



async addScanIdInUser(userId: string, scanId: string){

const addScanId = await this.userModel.updateOne(
  { _id: userId },
  { $addToSet: { scanAreas: scanId } }
);

return addScanId

}


async getScansId(userId: string,) {
   console.log("the email is", userId)

   const user = await this.userModel.findById(userId).select('scanAreas');

  if (!user) {
    return { status: 401, message: 'User not found' };
  }

  console.log('Scan Areas:', user.scanAreas);

  return {
    status: 200,
    message: 'Fetched successfully',
    scanAreas: user.scanAreas,
  };
}





}
