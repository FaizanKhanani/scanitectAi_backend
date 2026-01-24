import { IsArray, IsString, ArrayMinSize } from 'class-validator';

export class TranslateToastDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  texts: string[];

  @IsString()
  targetLang: string;
}