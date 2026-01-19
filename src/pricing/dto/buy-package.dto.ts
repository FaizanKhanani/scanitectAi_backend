import { IsMongoId, IsIn, IsString } from 'class-validator';
import { PackageName } from '../package-config';

export class BuyPackageDto {
  @IsMongoId()
  userId: string;

  @IsString()
  @IsIn([
    'basic_sub_month',
    'explorer_sub_month',
    'unlimited_sub_month',
    // add lifetime package names here when you start using them
    'basic_25_lifetime',
    'explorer_100_lifetime',
  ] as PackageName[])
  packageName: PackageName;
}


