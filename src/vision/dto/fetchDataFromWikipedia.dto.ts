import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Length } from 'class-validator';

export class FetchDataFromWikipedia {
  @ApiProperty({ example: 'Effile Tower', description: 'The name of any building' })
  @IsString()
  @IsNotEmpty()
  PlaceName: string;
}