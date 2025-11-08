import { Body, Controller, Post } from '@nestjs/common';
import { TranslateService } from './translate.service';
import { TranslateDto } from './dto/translate.dto';
import { Public } from "../common/decorators";

@Controller('translate')
export class TranslateController {
  constructor(private readonly service: TranslateService) {}


  @Public()
  @Post()
  async translate(@Body() dto: TranslateDto) {
    const translatedText = await this.service.translate(
      dto.text,
      dto.target,
      dto.source ?? 'auto',
      dto.format ?? 'text'
    );
    return { translatedText };
  }
}