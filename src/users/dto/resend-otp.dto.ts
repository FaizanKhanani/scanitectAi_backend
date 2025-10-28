import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Length } from 'class-validator';

export class ResendOtpDto {
  @ApiProperty({ example: 'user-1234', description: 'The ID of the user' })
  @IsString()
  @IsNotEmpty()
  userEmail: string;
}