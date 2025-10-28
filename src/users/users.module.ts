import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { UserController } from "./users.controller";
import { UserService } from "./users.service";
import { User, UserSchema } from "./schemas/user.schema";
import { RefresToken, RefresTokenSchema } from "./schemas/refreshtoken.schema";
// import { LoggerService } from "../common/service/logger.service";
// import { EmailService } from '../common/service/mail.service';
import { CommonModule } from '../common/common.module';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: RefresToken.name, schema: RefresTokenSchema },
    ]),
    FilesModule,
    CommonModule, // ✅ Add this
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService, MongooseModule],
})
export class UserModule { }
