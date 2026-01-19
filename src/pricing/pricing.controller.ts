import { Body, Controller, Post } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { BuyPackageDto } from './dto/buy-package.dto';


class TestScanDto {
  userId: string;
}


@Controller('pricing')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Post('buy')
  async buy(@Body() dto: BuyPackageDto) {
    // Here you should already have verified Apple/Google receipt on frontend/backend
    const user = await this.pricingService.buyPackage(dto);
    return {
      message: 'Package applied successfully',
      user,
    };
  }




  @Post('test-scan')
  async testScan(@Body() body: TestScanDto) {

    const user = await this.pricingService.consumeScan(body.userId);

    return {
      message: 'Scan succeeded',
      plan: user.plan,
      remainCredits: user.remainCredits,
      lifetimeRemainCredits: user.lifetimeRemainCredits,
      subscriptionExpiresAt: user.subscriptionExpiresAt,
    };
  }


}