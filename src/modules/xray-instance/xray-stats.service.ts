import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class XrayStatsService implements OnModuleInit {
  private readonly logger = new Logger(XrayStatsService.name);
  private readonly backendUrl: string;
  private readonly nodeApiKey: string;
  private readonly nodeId: string;
  private readonly statsInterval: number;

  constructor(private readonly configService: ConfigService) {
    this.backendUrl = this.configService.get('BACKEND_URL') || 'http://localhost:4200';
    this.nodeApiKey = this.configService.get('NODE_API_KEY') || '';
    this.nodeId = this.configService.get('NODE_ID') || '';
    this.statsInterval = Number(this.configService.get('STATS_INTERVAL_MS')) || 300000; // 5 минут
  }

  onModuleInit(): void {
    // Запускаем сбор статистики после инициализации
    void this.startStatsCollection();
  }

  private async startStatsCollection(): Promise<void> {
    this.logger.log(`Starting traffic stats collection every ${this.statsInterval}ms`);

    // Первый сбор через 1 минуту после старта
    await this.sleep(60000);

    // Затем каждые 5 минут
    while (true) {
      try {
        await this.collectAndSendStats();
      } catch (error: unknown) {
        const err = error as Error;
        this.logger.error(`Stats collection failed: ${err.message}`);
      }
      await this.sleep(this.statsInterval);
    }
  }

  private async collectAndSendStats(): Promise<void> {
    const url = `${this.backendUrl}/api/admin/vps-nodes/${this.nodeId}/traffic`;

    this.logger.debug(`Sending traffic stats to ${url}`);

    // TODO: Сбор статистики через gRPC Xray Stats API
    // Пока заглушка - в реальной реализации нужно получать трафик из Xray
    const stats = await this.getUserTrafficFromXray();

    if (stats.length === 0) {
      this.logger.debug('No traffic stats to send');
      return;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.nodeApiKey}`,
        },
        body: JSON.stringify({ stats }),
      });

      if (response.ok) {
        this.logger.debug(`Traffic stats sent successfully (${stats.length} users)`);
      } else {
        const error = await response.text();
        this.logger.warn(`Traffic stats failed with status: ${response.status} - ${error}`);
      }
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`Traffic stats error: ${err.message}`);
      throw error;
    }
  }

  /**
   * Получить трафик пользователей из Xray
   * TODO: Реализовать через gRPC Stats API
   */
  private async getUserTrafficFromXray(): Promise<Array<{ userId: number; upload: number; download: number }>> {
    // Заглушка для демонстрации
    // В реальной реализации:
    // 1. Подключение к gRPC Stats API Xray (127.0.0.1:8080)
    // 2. Получение статистики для каждого пользователя
    // 3. Преобразование email (user-123) в userId (123)

    return [];
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
