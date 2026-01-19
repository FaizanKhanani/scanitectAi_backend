import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { BuyPackageDto } from './dto/buy-package.dto';
import { PACKAGE_CONFIG, PackageConfig, PackageName } from './package-config';



// Map incoming productId (from App Store / Play) -> your existing package-config keys
const PRODUCT_ID_TO_PACKAGE: Record<string, PackageName> = {
  // iOS (non‑renewing product IDs from App Store Connect)
  starter_subs_month_ios: 'basic_sub_month',
  explorer_subs_month_ios: 'explorer_sub_month',
  unlimited_sub_month_ios: 'unlimited_sub_month',

  // Android (already canonical, but safe to include)
  basic_sub_month: 'basic_sub_month',
  explorer_sub_month: 'explorer_sub_month',
  unlimited_sub_month: 'unlimited_sub_month',
};




@Injectable()
export class PricingService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  // Called from React Native after in‑app purchase is verified
async buyPackage(dto: BuyPackageDto): Promise<User> {
  const user = await this.userModel.findById(dto.userId);
  if (!user) throw new NotFoundException('User not found');

  // Map iOS product ID to your canonical package name; Android stays the same
  const canonicalName = PRODUCT_ID_TO_PACKAGE[dto.packageName] as PackageName | undefined;
  if (!canonicalName) {
    throw new BadRequestException('Invalid package name');
  }

  const config = PACKAGE_CONFIG[canonicalName];
  if (!config) {
    throw new BadRequestException('Package not configured');
  }

  if (config.type === 'subscription') {
    return this.applySubscriptionPackage(user, canonicalName, config);
  }

  if (config.type === 'lifetime') {
    return this.applyLifetimePackage(user, canonicalName, { credits: config.credits });
  }

  throw new BadRequestException('Unknown package type');
}




private async applySubscriptionPackage(
  user: UserDocument,
  packageName: PackageName,
  config: PackageConfig, // { type: 'subscription'; credits; durationInDays }
): Promise<UserDocument> {
  const now = new Date();

  // 1) Check if user already has an ACTIVE subscription
  const hasActiveSubscription =
    user.subscriptionExpiresAt &&
    user.subscriptionExpiresAt.getTime() > now.getTime();

  // 2) EXPIRY: always from NOW, not from old expiry
  //    e.g. bought on 22 May -> expires 22 June (if 30 days)
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + (config.durationInDays ?? 30));

  // Update plan and dates
  user.plan = packageName;
  user.subscriptionStartedAt = now;      // when this purchase happened
  user.subscriptionExpiresAt = expiresAt;

  // 3) Handle credits

  // If new package is UNLIMITED, it overrides everything
  if (config.credits === 'unlimited') {
    user.totalCredit = '-1';
    user.remainCredits = '-1';
    await user.save();
    return user;
  }

  if (hasActiveSubscription) {
    // There is still an active subscription period

    // If old subscription was unlimited, keep it unlimited
    if (user.remainCredits === '-1' || user.totalCredit === '-1') {
      // Do NOT change credits, only updated time above
      await user.save();
      return user;
    }

    // Old sub is limited -> ADD remaining scans to new package credits
    const existingRemain = parseInt(user.remainCredits ?? '0', 10) || 0;
    const existingTotal = parseInt(user.totalCredit ?? '0', 10) || 0;

    // New behavior:
    // newRemain = oldRemain + newCredits
    // newTotal  = oldTotal  + newCredits (for history)
    const newRemain = existingRemain + (config.credits as number);
    const newTotal = existingTotal + (config.credits as number);

    user.remainCredits = String(newRemain);
    user.totalCredit = String(newTotal);
  } else {
    // No active subscription (expired or first time purchase)
    // → start fresh credits from this new package
    user.remainCredits = String(config.credits);
    user.totalCredit = String(config.credits);
  }

  await user.save();
  return user;
}



  // -------- LIFETIME / PAY-PER-SCAN LOGIC --------
  private async applyLifetimePackage(
    user: UserDocument,
    packageName: PackageName,
    config: { credits: number | 'unlimited' },
  ): Promise<User> {
    if (config.credits === 'unlimited') {
      throw new Error('Lifetime unlimited not supported in this example');
    }

    const currentLifetimeRemain = parseInt(user.lifetimeRemainCredits || '0', 10);
    const currentLifetimeTotal = parseInt(user.lifetimeTotalCredits || '0', 10);

    const newRemain = currentLifetimeRemain + config.credits;
    const newTotal = currentLifetimeTotal + config.credits;

    user.lifetimeRemainCredits = String(newRemain);
    user.lifetimeTotalCredits = String(newTotal);

    // You can optionally store last lifetime package name somewhere if needed
    // e.g. user.lastLifetimePackage = packageName;

    await user.save();
    return user;
  }



  async ensureSubscriptionValid(userId: string): Promise<UserDocument> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const now = new Date();
    if (
      user.subscriptionExpiresAt &&
      user.subscriptionExpiresAt.getTime() <= now.getTime()
    ) {
      // Subscription has expired by date -> reset subscription fields & credits
      user.plan = 'free';
      user.subscriptionStartedAt = null;
      user.subscriptionExpiresAt = null;
      user.remainCredits = '0';
      user.totalCredit = '0';
      await user.save();
    }

    return user;
  }

  async consumeScan(userId: string): Promise<UserDocument> {
    const user = await this.ensureSubscriptionValid(userId);

    // 1) If subscription is unlimited
    if (user.remainCredits === '-1') {
      // unlimited subscription -> do nothing
      return user;
    }

    // 2) Subscription credits first
    let subRemain = parseInt(user.remainCredits ?? '0', 10);
    if (subRemain > 0) {
      subRemain -= 1;
      user.remainCredits = String(subRemain);
      await user.save();
      return user;
    }

    // 3) Then lifetime credits
    let lifeRemain = parseInt(user.lifetimeRemainCredits ?? '0', 10);
    if (lifeRemain > 0) {
      lifeRemain -= 1;
      user.lifetimeRemainCredits = String(lifeRemain);
      await user.save();
      return user;
    }

    // 4) Nothing left
    throw new BadRequestException('No scan credits available');
  }


}