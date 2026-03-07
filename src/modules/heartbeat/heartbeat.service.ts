import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { setInterval } from "timers/promises";

// Disable SSL certificate verification for self-signed certificates
// This is needed for VPS nodes with Let's Encrypt certificates
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

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

    this.logger.debug(`Sending heartbeat to ${url}`);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.nodeApiKey}`,
        },
      });

      if (response.ok) {
        this.logger.debug("Heartbeat sent successfully");
      } else if (response.status === 404) {
        // Node not registered yet (deploy job not completed)
        this.logger.debug("Node not registered yet, will retry later");
      } else {
        this.logger.warn(`Heartbeat failed with status: ${response.status}`);
      }
    } catch (error: unknown) {
      const err = error as Error;
      // Don't throw - continue retrying on next interval
      this.logger.warn(`Heartbeat error: ${err.message}`);
    }
  }
}
