import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { setInterval } from 'timers/promises';

@Injectable()
export class HeartbeatService implements OnModuleInit {
  private readonly logger = new Logger(HeartbeatService.name);
  private readonly backendUrl: string;
  private readonly nodeApiKey: string;
  private readonly nodeId: string;
  private readonly heartbeatInterval: number;

  constructor(private readonly configService: ConfigService) {
    this.backendUrl = this.configService.get('BACKEND_URL') || 'http://localhost:4200';
    this.nodeApiKey = this.configService.get('NODE_API_KEY') || '';
    this.nodeId = this.configService.get('NODE_ID') || '';
    this.heartbeatInterval = this.configService.get('HEARTBEAT_INTERVAL_MS') || 30000;
  }

  async onModuleInit() {
    // Запускаем heartbeat после инициализации модуля
    this.startHeartbeat();
  }

  private async startHeartbeat() {
    this.logger.log(`Starting heartbeat every ${this.heartbeatInterval}ms`);

    for await (const _ of setInterval(this.heartbeatInterval)) {
      try {
        await this.sendHeartbeat();
      } catch (error: any) {
        this.logger.error(`Heartbeat failed: ${error.message}`);
      }
    }
  }

  private async sendHeartbeat() {
    const url = `${this.backendUrl}/api/vps-nodes/${this.nodeId}/heartbeat`;

    this.logger.debug(`Sending heartbeat to ${url}`);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.nodeApiKey}`,
        },
      });

      if (response.ok) {
        this.logger.debug('Heartbeat sent successfully');
      } else {
        this.logger.warn(`Heartbeat failed with status: ${response.status}`);
      }
    } catch (error: any) {
      this.logger.error(`Heartbeat error: ${error.message}`);
      throw error;
    }
  }
}
