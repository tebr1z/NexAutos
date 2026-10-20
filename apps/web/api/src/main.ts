import { json, urlencoded } from 'express';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { jwtSecret } from './auth/jwt-secret';
import { PrismaExceptionFilter } from './common/prisma-exception.filter';
import passport from 'passport';
import { FULL_ACCESS_ROLES, OPERATIONS_ROLES } from './common/access-roles';

async function bootstrap() {
  jwtSecret();
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  // Authenticate photo uploads before granting administrators an unlimited body.
  app.use('/api/v1/orders', (req, res, next) => {
    if (req.method !== 'POST' || !/^\/[^/]+\/photos\/?$/.test(req.path)) return next();
    passport.authenticate('jwt', { session: false }, (error, user) => {
      if (error) return next(error);
      if (!user) return res.status(401).json({ message: 'Daxil olun.' });
      if (!OPERATIONS_ROLES.includes(user.role)) return res.status(403).json({ message: 'İcazə yoxdur.' });
      req.user = user;
      return json({ limit: FULL_ACCESS_ROLES.includes(user.role) ? Infinity : '20mb' })(req, res, next);
    })(req, res, next);
  });
  app.use(json({ limit: '20mb' }));
  app.use(urlencoded({ extended: true, limit: '20mb' }));
  app.setGlobalPrefix('api/v1');
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  const origins = (process.env.CORS_ORIGIN ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:5001')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  app.enableCors({
    origin(origin, callback) {
      const trustedSite = !origin || origins.includes(origin);
      const chromeExtension = /^chrome-extension:\/\/[a-p]{32}$/i.test(origin ?? '');
      callback(trustedSite || chromeExtension ? null : new Error('CORS origin icazəli deyil.'), trustedSite || chromeExtension);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Accept', 'Authorization', 'Content-Type', 'X-AutoNex-Collector'],
  });
  app.useGlobalFilters(new PrismaExceptionFilter());
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

  const port = Number(process.env.API_PORT || process.env.PORT || 5002);
  const host = process.env.API_HOST || "0.0.0.0";
  await app.listen(port, host);
}

bootstrap();
