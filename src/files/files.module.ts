import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';

@Module({
  imports: [MongooseModule],           // needed for @InjectConnection
  providers: [FilesService],
  controllers: [FilesController],      // optional but fine
  exports: [FilesService],             // ✅ export so other modules can use it
})
export class FilesModule {}