import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateLanguageCodeDto {
  @IsString()
  @IsNotEmpty()
  languageCode: string; // e.g., 'en', 'hi', 'fr'
}