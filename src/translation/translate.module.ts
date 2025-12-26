// import { Module } from '@nestjs/common';
// import { HttpModule } from '@nestjs/axios';
// import { TranslateService } from './translate.service';
// import { TranslateController } from './translate.controller';

// @Module({
//   imports: [HttpModule.register({ timeout: 10000 })],
//   controllers: [TranslateController],
//   providers: [TranslateService],
// })
// export class TranslateModule {}




// src/translation/translation.module.ts
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TranslationService } from './translate.service';
import { TranslateController } from './translate.controller';

@Module({
  imports: [HttpModule],
  providers: [TranslationService],
    controllers: [TranslateController],
  exports: [TranslationService],
})
export class TranslationModule {}