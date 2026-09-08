import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { jwtSecret } from './auth/jwt-secret';

async function bootstrap() {
  jwtSecret();
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  const origins = (process.env.CORS_ORIGIN ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origins,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  if (process.env.ENABLE_SWAGGER === 'true' || process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Auto Nex API')
      .setDescription('Premium car import and shipment tracking')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
  }

  const port = process.env.PORT ?? process.env.API_PORT ?? 4000;
  await app.listen(port);
}

bootstrap();
