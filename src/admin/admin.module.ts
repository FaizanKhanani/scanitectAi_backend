// import { Module } from '@nestjs/common';
// import { AdminController } from './controllers/admin/admin.controller';
// import { AdminService } from './services/admin/admin.service';

// @Module({
//   controllers: [AdminController],
//   providers: [AdminService]
// })
// export class AdminModule {}



// admin.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from "@nestjs/mongoose";
import { User, UserSchema } from "../users/schemas/user.schema";
import { UserInfoController } from './controllers/userInfo/userInfo.controller';
import { UserInfoService } from './services/userInfo/userInfo.service';

@Module({

   imports: [
    MongooseModule.forFeature([ { name: User.name, schema: UserSchema },]), // ✅ add this
  ],

  controllers: [UserInfoController],
   providers: [UserInfoService]
})
export class AdminModule {}
