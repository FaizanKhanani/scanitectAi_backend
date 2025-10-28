import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Length } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@gmail', description: 'The email of the user' })
  @IsString()
  @IsNotEmpty()
  userEmail: string;
}