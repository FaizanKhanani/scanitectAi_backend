// import { Body, Controller, Post } from '@nestjs/common';
// import { TranslateService } from './translate.service';
// import { TranslateDto } from './dto/translate.dto';
// import { Public } from "../common/decorators";

// @Controller('translate')
// export class TranslateController {
//   constructor(private readonly service: TranslateService) {}


//   @Public()
//   @Post()
//   async translate(@Body() dto: TranslateDto) {
//     const translatedText = await this.service.translate(
//       dto.text,
//       dto.target,
//       dto.source ?? 'auto',
//       dto.format ?? 'text'
//     );
//     return { translatedText };
//   }
// }






import { Body, Controller, Post } from '@nestjs/common';
import { TranslationService } from './translate.service'; // adjust path if name differs

@Controller('places') // -> /places
export class TranslateController {
  constructor(private readonly translationService: TranslationService) {}

  @Post('translate') // -> /places/translate
  async translate(@Body() body: { data: any; targetLang: string }) {
    const { data, targetLang } = body;

    console.log("the targetLang", targetLang, "the data",data)
    const translated = await this.translationService.translateData(data, targetLang);
    console.log("the translated",translated )
    return { data: translated };
  }







}