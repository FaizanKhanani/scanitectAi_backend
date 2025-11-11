import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsStrongPassword,
} from "class-validator";

export class DeleteAccount {
   @ApiProperty({ example: 'Patil@test.com', description: 'email of the user' })
   email: string;
 
}