import { IsOptional, IsString, IsIn } from 'class-validator';

export class TranslateDto {
  @IsString()
  text: string;

  @IsOptional()
  @IsString()
  source?: string; // e.g., 'en' or 'auto'

  @IsString()
  target: string;  // e.g., 'es'

  @IsOptional()
  @IsIn(['text', 'html'])
  format?: 'text' | 'html';
}