import { Controller, Post, Get, Body } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { SubscribeDto } from './dto/subscribe.dto';
import { Public } from '../common/decorators/public.decorator';

@Controller('subscribe')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Public()
  @Post()
  async subscribe(@Body() subscribeDto: SubscribeDto) {
    console.log("this is hit");
    const subscription = await this.subscriptionService.subscribe(subscribeDto);
    return {
      message: 'Subscription successful',
      data: subscription,
    };
  }

  @Public()
  @Get('allSubscriptionEmail')
  async getAllEmails() {
    const emails = await this.subscriptionService.getAllEmails();
    return {
      message: 'Emails fetched successfully',
      data: emails,
    };
  }
}
