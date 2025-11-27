import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Place, PlaceSchema } from './schemas/imageData.model';
import { HttpModule } from '@nestjs/axios';
import { VisionController } from './vision.controller';
import { UserService } from "../users/users.service";
import { UserModule } from "../users/users.module";
import { FilesModule } from "../files/files.module";
import { VisionService } from './vision.service';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
      HttpModule,
      FilesModule,
    MongooseModule.forFeature([{ name: Place.name, schema: PlaceSchema }]),
    UserModule,
    CommonModule, // ✅ Add this
  ],
  controllers: [VisionController],
  providers: [VisionService],
  exports: [VisionService],
})
export class VisionModule {}