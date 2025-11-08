import { ConfigModule } from '@nestjs/config';
import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserModule } from './users/users.module';
import { AuthModule } from './auth/auth.module'
import { LoggerService } from './common/service/logger.service';
import { LoggerMiddleware } from './common/service/loggermiddleware.service';
import { DatabaseModule } from './config/database.module';
import { helloModule } from './hello/hello.module';
import { roleModule } from './roles/roles.module';
import { SubscribeModule } from './subscribeWeb/subscription.module';
import { VisionModule } from './vision/vision.module';
import { AdminModule } from './admin/admin.module';
import { FilesModule } from './files/files.module';
import { TranslateModule } from './translation/translate.module'

console.log(`${process.cwd()}/.env.${process.env.NODE_ENV}`)

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env.development',
      isGlobal: true
    }),
    // ConfigModule.forRoot({
    //   envFilePath: `${process.cwd()}/.env.${process.env.NODE_ENV}`,
    //   isGlobal: true
    // }),

//     ConfigModule.forRoot({
//   isGlobal: true,
//   envFilePath: [
//     process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : undefined,
//     '.env',
//   ].filter(Boolean) as string[],
// }),

    MongooseModule.forRoot(process.env.MONGODB_URI!),
    DatabaseModule,
    UserModule,
    AuthModule,
    helloModule,
    roleModule,
    SubscribeModule,
    AdminModule,
    VisionModule,
    FilesModule,
    TranslateModule,

  ],
  providers: [
    LoggerService
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
