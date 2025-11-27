import { IsNotEmpty, IsString } from 'class-validator';

export class IdentifyPlaceByNameDto {
  @IsString()
  @IsNotEmpty()
  imageName!: string; // e.g., "burj_khalifa.jpg" or "Burj Khalifa"
}