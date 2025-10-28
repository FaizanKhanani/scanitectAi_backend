// src/auth/dto/subscribe.dto.ts
import { IsEmail } from 'class-validator';

export class SubscribeDto {
  @IsEmail()
  email: string;
}
