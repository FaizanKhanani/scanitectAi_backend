import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Length } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({ example: 'user-1234', description: 'The ID of the user' })
  @IsString()
  @IsNotEmpty()
  userEmail: string;

  @ApiProperty({ example: '123456', description: 'The OTP sent to the user' })
  @IsString()
  @Length(4, 6)
  otp: string;
}