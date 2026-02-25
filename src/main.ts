import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';

import { AppModule } from './app.module';
import { AllExceptionsFilter } from './utils/all-exceptions.filter';

async function bootstrap() {
  const app: INestApplication = await NestFactory.create(AppModule);

  // Trust proxy for correct IP logging
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  const configService = app.get(ConfigService);
  const isDev = configService.get<string>('NODE_ENV') === 'development';

  // CORS
  app.enableCors({
    origin: [/https:\/\/.*\.ngrok-free\.app$/, /http:\/\/localhost:/],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.use(cookieParser());

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Exception filters
  app.useGlobalFilters(new AllExceptionsFilter());

  // Compression
  app.use(compression());

  // HTTP request logging
  if (isDev) {
    app.use(morgan('tiny'));
  } else {
    app.use(morgan('combined'));
  }

  // Global prefix
  app.setGlobalPrefix('api');

  // Shutdown hooks
  app.enableShutdownHooks();

  // Error handling
  const logger = new Logger('Bootstrap');
  process.on('unhandledRejection', (reason) => {
    logger.error('🔥 Unhandled Rejection', reason);
  });
  process.on('uncaughtException', (err) => {
    logger.error('🔥 Uncaught Exception', err);
  });

  const port = configService.get<string>('PORT') || '4300';
  await app.listen(port, '0.0.0.0');
  logger.log(`🚀 Core Service running on port ${port}`);
}

void bootstrap();
