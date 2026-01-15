// import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
// import { HydratedDocument, now } from 'mongoose';

// export type UserDocument = HydratedDocument<User>;

// @Schema({ timestamps: true })
// export class User {
//   @Prop({ type: String })
//   username: string;

//   @Prop({ type: String })
//   activation_code: string;

//   @Prop({ type: String })
//   email: string;

//   @Prop({ type: String })
//   password: string;

//   @Prop({ type: String })
//   password_reset_code: string;

//   @Prop({ default: now() })
//   createdAt: Date;

//   @Prop({ default: now() })
//   updatedAt: Date;

//   @Prop({ default: false })
//   isEmailVerify: boolean;

//   @Prop({ default: false })
//   resendCode: boolean;

//   @Prop({ default: false })
//   resetPasswordCodeStatus: boolean;

//   @Prop({ type: String, default: 'user' })
//   role: string;

//   @Prop({ nullable: true })
//   otp: string;

//   @Prop({ type: [String], default: [] })
// scanAreas?: string[];
 
//   @Prop({ type: Date })
//   otpExpiry: Date;

//   // 🔹 Additional editable fields for user profile
//   @Prop({ type: String, default: null })
//   nickName?: string;

//   @Prop({ type: String, default: null })
//   image?: string; // URL or filename

//   // ✅ NEW FIELD: GridFS File Reference
//   @Prop({ type: String, default: null })
//   imageFileId?: string; // GridFS ObjectId as string

//   @Prop({ type: String, default: null })
//   phoneNumber?: string;

//   @Prop({ type: String, default: null })
//   gender?: string;

//   @Prop({ type: String, default: null })
//   country?: string;

//   @Prop({ type: String, default: null })
//   address?: string;

//   @Prop({ type: String, default: 'free' })
//   plan: string;

//     @Prop({ type: String, default: '0' })
//   remainCredits: string;

//     @Prop({ type: String, default: '10' })
//   totalCredit: string;
// }

// export const UserSchema = SchemaFactory.createForClass(User);

























// import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
// import { HydratedDocument, now } from 'mongoose';

// export type UserDocument = HydratedDocument<User>;

// @Schema({ timestamps: true })
// export class User {
// @Prop({ type: String })
// username: string;

// @Prop({ type: String })
// activation_code: string;

// // make email unique
// @Prop({ type: String, unique: true, index: true })
// email: string;

// // password can be null for social users
// @Prop({ type: String, default: null })
// password: string;

// @Prop({ type: String })
// password_reset_code: string;

// @Prop({ default: now() })
// createdAt: Date;

// @Prop({ default: now() })
// updatedAt: Date;

// @Prop({ default: false })
// isEmailVerify: boolean;

// @Prop({ default: false })
// resendCode: boolean;

// @Prop({ default: false })
// resetPasswordCodeStatus: boolean;

// @Prop({ type: String, default: 'user' })
// role: string;

// @Prop({ nullable: true })
// otp: string;



// @Prop({ type: [String], default: [] })
// scanAreas?: string[];

// @Prop({ type: Date })
// otpExpiry: Date;

// @Prop({ type: String, default: null })
// nickName?: string;

// @Prop({ type: String, default: null })
// image?: string;

// @Prop({ type: String, default: null })
// imageFileId?: string;

// @Prop({ type: String, default: null })
// phoneNumber?: string;

// @Prop({ type: String, default: null })
// gender?: string;

// @Prop({ type: String, default: null })
// country?: string;

// @Prop({ type: String, default: null })
// address?: string;

// @Prop({ type: String, default: 'free' })
// plan: string;

// @Prop({ type: String, default: '0' })
// remainCredits: string;

// @Prop({ type: String, default: '10' })
// totalCredit: string;

// @Prop({ type: String, default: 'en' })
// languageCode: string;


// // NEW: Provider fields
// @Prop({ type: String, unique: true, sparse: true })
// googleId?: string;

// @Prop({ type: [String], default: ['local'] }) // can be ['local','google']
// authProviders?: string[];
// }

// export const UserSchema = SchemaFactory.createForClass(User);
















import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, now } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ type: String })
  username: string;

  @Prop({ type: String })
  activation_code: string;

  @Prop({ type: String, unique: true, index: true })
  email: string;

  @Prop({ type: String, default: null })
  password: string;

  @Prop({ type: String })
  password_reset_code: string;

  @Prop({ default: now() })
  createdAt: Date;

  @Prop({ default: now() })
  updatedAt: Date;

  @Prop({ default: false })
  isEmailVerify: boolean;

  @Prop({ default: false })
  resendCode: boolean;

  @Prop({ default: false })
  resetPasswordCodeStatus: boolean;

  @Prop({ type: String, default: 'user' })
  role: string;

  @Prop({ nullable: true })
  otp: string;

  @Prop({ type: [String], default: [] })
  scanAreas?: string[];

  @Prop({ type: Date })
  otpExpiry: Date;

  @Prop({ type: String, default: null })
  nickName?: string;

  @Prop({ type: String, default: null })
  image?: string;

  @Prop({ type: String, default: null })
  imageFileId?: string;

  @Prop({ type: String, default: null })
  phoneNumber?: string;

  @Prop({ type: String, default: null })
  gender?: string;

  @Prop({ type: String, default: null })
  country?: string;

  @Prop({ type: String, default: null })
  address?: string;

  // current active subscription plan or 'free'
  @Prop({ type: String, default: 'free' })
  plan: string;

  // use these for SUBSCRIPTION credits only
  @Prop({ type: String, default: '0' })
  remainCredits: string;

  @Prop({ type: String, default: '10' })
  totalCredit: string;

  @Prop({ type: String, default: 'en' })
  languageCode: string;

  @Prop({ type: String, unique: true, sparse: true })
  googleId?: string;

  @Prop({ type: [String], default: ['local'] })
  authProviders?: string[];

  // ---- NEW FIELDS FOR SUBSCRIPTION ----
  @Prop({ type: Date, default: null })
  subscriptionStartedAt?: Date | null;

  @Prop({ type: Date, default: null })
  subscriptionExpiresAt?: Date | null;

  // ---- NEW FIELDS FOR LIFETIME (pay‑per‑scan) ----
  // These NEVER expire; only decrease when used
  @Prop({ type: String, default: '0' })
  lifetimeRemainCredits?: string;

  @Prop({ type: String, default: '0' })
  lifetimeTotalCredits?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);