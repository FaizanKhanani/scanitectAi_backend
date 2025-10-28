// src/auth/subscription.service.ts
import { Injectable, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Subscription } from '../users/schemas/subscription.schema';
import { SubscribeDto } from './dto/subscribe.dto';

@Injectable()
export class SubscriptionService {
  constructor(
    @InjectModel('Subscription') private subscriptionModel: Model<Subscription>,
  ) {}

  // Method to subscribe the user (add email to the database)
  async subscribe(subscribeDto: SubscribeDto): Promise<Subscription> {
    const { email } = subscribeDto;

    // Check if the email already exists in the database
    const existingSubscription = await this.subscriptionModel.findOne({ email });
    if (existingSubscription) {
      throw new ConflictException('Email already subscribed');
    }

    // Create a new subscription
    const newSubscription = new this.subscriptionModel({
      email,
    });

    // Save the new subscription to the database
    return await newSubscription.save();
  }

   async getAllEmails(): Promise<{ email: string }[]> {
    return await this.subscriptionModel.find({}, { email: 1, _id: 0 }).lean();
  }
}
