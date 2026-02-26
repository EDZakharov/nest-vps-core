import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { HealthModule } from './health/health.module';
import { XrayInstanceModule } from './modules/xray-instance/xray-instance.module';
import { HeartbeatModule } from './modules/heartbeat/heartbeat.module';
import { SignatureGuard } from './core/security/signature.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // Rate limiting
    ThrottlerModule.forRoot([{
      name: 'short',
      ttl: 1000,      // 1 секунда
      limit: 3,       // 3 запроса
    }, {
      name: 'medium',
      ttl: 60000,     // 1 минута
      limit: 30,      // 30 запросов
    }, {
      name: 'long',
      ttl: 3600000,   // 1 час
      limit: 500,     // 500 запросов
    }]),
    HealthModule,
    XrayInstanceModule,
    HeartbeatModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: SignatureGuard,
    },
  ],
})
export class AppModule {}
