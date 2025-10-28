import { Module } from '@nestjs/common';
import { LoggerService } from './service/logger.service';
import { EmailService } from './service/mail.service';

@Module({
  providers: [LoggerService, EmailService],
  exports: [LoggerService, EmailService],
})
export class CommonModule {}
