import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TranslateService } from './translate.service';
import { TranslateController } from './translate.controller';

@Module({
  imports: [HttpModule.register({ timeout: 10000 })],
  controllers: [TranslateController],
  providers: [TranslateService],
})
export class TranslateModule {}