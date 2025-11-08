import { NestFactory } from "@nestjs/core";
import helmet from "helmet";
import * as cookieParser from "cookie-parser";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
// import { ValidationPipe } from '@nestjs/common';
import 'dotenv/config';
import { AppModule } from "./app.module";
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  //  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const options = new DocumentBuilder()
    .setTitle("Jwt authentication mongoose nestjs example")
    .setDescription(
      "JwtService utilities module based on the nestjs/jwt package"
    )
    .setVersion("1.0")
    .addServer("http://localhost:3000/", "Local environment")
    .addServer("https://staging.yourapi.com/", "Staging")
    .addServer("https://production.yourapi.com/", "Production")
    .addTag("Jwt authentication")
    .addCookieAuth(
      "refresh_token",
      {
        type: "apiKey",
        in: "cookie",
      },
      "refresh_token"
    )
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        name: "JWT",
        description: "Enter JWT token",
        in: "header",
      },
      "JWT-auth" // This name here is important for matching up with @ApiBearerAuth() in your controller!
    )
    .build();
  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup("api", app, document);
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: [
      'https://scanitectai.com/',
      'http://localhost:3000',
      'http://example.com',
      'http://www.example.com',
      'http://app.example.com',
      'https://example.com',
      'https://www.example.com',
      'https://app.example.com',
    ],
    methods: ["GET", "POST"],
    credentials: true
  });
  await app.listen(Number(process.env.PORT) || 3000);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
