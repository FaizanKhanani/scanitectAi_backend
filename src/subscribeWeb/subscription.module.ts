// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { SubscriptionSchema } from '../users/schemas/subscription.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Subscription', schema: SubscriptionSchema }]),
  ],
  controllers: [SubscriptionController],
  providers: [SubscriptionService],
})
export class SubscribeModule {}
