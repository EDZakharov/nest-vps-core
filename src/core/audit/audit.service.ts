import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface AuditLogDto {
  timestamp: Date;
  nodeId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  ip: string;
  userAgent?: string;
  requestId: string;
  responseTime: number;
  userId?: number;
  action: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class AuditService implements OnModuleInit {
  private readonly logger = new Logger(AuditService.name);
  private readonly buffer: AuditLogDto[] = [];
  private readonly bufferSize: number;
  private readonly flushInterval: number;
  private readonly backendUrl: string;
  private readonly nodeApiKey: string;
  private readonly nodeId: string;
  private readonly enabled: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.backendUrl = this.configService.get('BACKEND_URL') || 'http://localhost:4200';
    this.nodeApiKey = this.configService.get('NODE_API_KEY') || '';
    this.nodeId = this.configService.get('NODE_ID') || '';
    this.enabled = this.configService.get('AUDIT_ENABLED') !== 'false';
    this.bufferSize = parseInt(this.configService.get('AUDIT_BUFFER_SIZE') || '50');
    this.flushInterval = parseInt(this.configService.get('AUDIT_FLUSH_INTERVAL_MS') || '5000');
  }

  async onModuleInit(): Promise<void> {
    if (this.enabled) {
      setInterval(() => { void this.flushBuffer(); }, this.flushInterval);
      this.logger.log('Audit logging enabled');
    } else {
      this.logger.warn('Audit logging disabled');
    }
  }

  /**
   * Логировать запрос
   */
  log(request: AuditLogDto): void {
    if (!this.enabled) return;

    this.buffer.push({
      ...request,
      nodeId: this.nodeId,
      timestamp: new Date(),
    });

    // Мгновенная отправка если буфер заполнен
    if (this.buffer.length >= this.bufferSize) {
      this.flushBuffer().catch((err) =>
        this.logger.error(`Failed to flush audit buffer: ${err.message}`),
      );
    }
  }

  /**
   * Отправить буфер на backend
   */
  private async flushBuffer(): Promise<void> {
    if (this.buffer.length === 0) return;

    const logs = [...this.buffer];
    this.buffer.length = 0; // Очистить буфер

    try {
      await firstValueFrom(
        this.httpService.post(
          `${this.backendUrl}/api/audit/log`,
          { logs },
          {
            headers: {
              'Authorization': `Bearer ${this.nodeApiKey}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );
      this.logger.debug(`Flushed ${logs.length} audit logs`);
    } catch (error: any) {
      this.logger.error(`Failed to send audit logs: ${error.message}`);
      // Возвращаем логи в буфер для повторной отправки
      this.buffer.unshift(...logs);
    }
  }

  /**
   * Получить размер буфера (для тестов)
   */
  getBufferLength(): number {
    return this.buffer.length;
  }
}
