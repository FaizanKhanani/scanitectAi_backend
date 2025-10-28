import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";
import * as cookieParser from "cookie-parser";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "../src/app.module";
import { ExpressAdapter } from "@nestjs/platform-express";
import express from "express";

let cachedServer: any;

async function bootstrapServer() {
  const server = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server));

  // 🚀 Swagger setup
  const options = new DocumentBuilder()
    .setTitle("Jwt authentication mongoose nestjs example")
    .setDescription("JwtService utilities module based on the nestjs/jwt package")
    .setVersion("1.0")
    .addServer("https://scanitectai.com/", "Local environment")
    .addServer("https://scanitectai.com/", "Staging")
    .addServer("https://scanitectai.com/", "Production")
    .addTag("Jwt authentication")
    .addCookieAuth(
      "refresh_token",
      { type: "apiKey", in: "cookie" },
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
      "JWT-auth"
    )
    .build();

  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup("api", app, document); // Swagger at `/api`

  // 🚀 Middlewares
  app.use(helmet());
  app.use(cookieParser());

  // 🚀 CORS
  app.enableCors({
    origin: [
      "http://localhost:3000",
      "https://scanitectai.com/",
      "http://example.com",
      "http://www.example.com",
      "http://app.example.com",
      "https://example.com",
      "https://www.example.com",
      "https://app.example.com",
    ],
    methods: ["GET", "POST"],
    credentials: true,
  });

  // ❌ do NOT call app.listen() here
  await app.init();
  return server;
}

export default async function handler(req: any, res: any) {
  if (!cachedServer) {
    cachedServer = await bootstrapServer();
  }
  return cachedServer(req, res);
}
