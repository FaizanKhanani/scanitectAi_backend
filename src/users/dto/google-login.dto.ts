import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class GoogleLoginDto {
@ApiProperty({ example: 'eyJhbGciOiJSUzI1NiIsInR...' })
@IsNotEmpty()
idToken: string;
}