import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsEmail } from "class-validator";

export class EditUserProfile {
 @ApiPropertyOptional({ example: 'https://example.com/image.jpg', description: 'Profile image URL' })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional({ example: 'testname', description: 'Username of the user' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ example: 'nick', description: 'Nick name of the user' })
  @IsOptional()
  @IsString()
  nickName?: string;

  @ApiPropertyOptional({ example: 'Patil@test.com', description: 'Email of the user' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+923001234567', description: 'Phone number of the user' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({ example: 'Pakistan', description: 'Country of the user' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: 'Male', description: 'Gender of the user' })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({ example: '123 Main Street, Lahore', description: 'Address of the user' })
  @IsOptional()
  @IsString()
  address?: string;
}
