import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { setInterval } from "timers/promises";
import { exec } from "child_process";
import { promisify } from "util";

// Disable SSL certificate verification for self-signed certificates
// This is needed for VPS nodes with Let's Encrypt certificates
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const execAsync = promisify(exec);

@Injectable()
export class HeartbeatService implements OnModuleInit {
  private readonly logger = new Logger(HeartbeatService.name);
  private readonly backendUrl: string;
  private readonly nodeApiKey: string;
  private readonly nodeId: string;
  private readonly heartbeatInterval: number;

  constructor(private readonly configService: ConfigService) {
    this.backendUrl =
      this.configService.get("BACKEND_URL") || "http://localhost:4200";
    this.nodeApiKey = this.configService.get("NODE_API_KEY") || "";
    this.nodeId = this.configService.get("NODE_ID") || "";
    this.heartbeatInterval =
      Number(this.configService.get("HEARTBEAT_INTERVAL_MS")) || 30000;
  }

  onModuleInit(): void {
    // Запускаем heartbeat после инициализации модуля
    void this.startHeartbeat();
  }

  private async startHeartbeat(): Promise<void> {
    this.logger.log(`Starting heartbeat every ${this.heartbeatInterval}ms`);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _interval of setInterval(this.heartbeatInterval)) {
      try {
        await this.sendHeartbeat();
      } catch (error: unknown) {
        const err = error as Error;
        this.logger.error(`Heartbeat failed: ${err.message}`);
      }
    }
  }

  private async sendHeartbeat(): Promise<void> {
    const url = `${this.backendUrl}/api/vps-nodes/${this.nodeId}/heartbeat`;

    // Сбор метрик
    const metrics = await this.collectMetrics();

    this.logger.debug(`Sending heartbeat to ${url}`);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.nodeApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "ACTIVE",
          ...metrics,
        }),
      });

      if (response.ok) {
        this.logger.debug("Heartbeat sent successfully");
      } else {
        const text = await response.text();
        this.logger.warn(`Heartbeat failed with status: ${response.status} - ${text}`);
      }
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`Heartbeat error: ${err.message}`);
      throw error;
    }
  }

  private async collectMetrics() {
    try {
      // CPU usage
      let cpuUsage = 0;
      try {
        const cpuInfo = await execAsync('top -bn1 | grep "Cpu(s)"');
        const cpuMatch = cpuInfo.stdout.match(/(\d+\.?\d*)\s*id/);
        if (cpuMatch) {
          cpuUsage = 100 - parseFloat(cpuMatch[1]);
        }
      } catch {
        this.logger.warn('Failed to get CPU usage');
      }

      // Memory usage (MB)
      let memoryUsage = 0;
      try {
        const memInfo = await execAsync('free -m | grep Mem');
        const memParts = memInfo.stdout.split(/\s+/);
        if (memParts.length >= 3) {
          memoryUsage = parseInt(memParts[2]);
        }
      } catch {
        this.logger.warn('Failed to get memory usage');
      }

      // Bandwidth (bytes/sec) - упрощённо 0
      const bandwidthOut = BigInt(0);

      // Active users - заглушка 0
      const activeUsers = 0;

      return {
        cpuUsage,
        memoryUsage,
        bandwidthOut: Number(bandwidthOut),
        activeUsers,
      };
    } catch {
      this.logger.error('Failed to collect metrics');
      return {
        cpuUsage: 0,
        memoryUsage: 0,
        bandwidthOut: 0,
        activeUsers: 0,
      };
    }
  }
}
