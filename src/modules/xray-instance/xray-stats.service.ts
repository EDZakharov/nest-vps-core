import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import type {
  StatsServiceClient,
  QueryStatsResponse,
} from "./xray-stats.types";

@Injectable()
export class XrayStatsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(XrayStatsService.name);
  private readonly backendUrl: string;
  private readonly nodeApiKey: string;
  private readonly nodeId: string;
  private readonly statsInterval: number;
  private readonly xrayGrpcAddress: string;
  private grpcClient: StatsServiceClient | null = null;
  private isClientReady = false;

  constructor(private readonly configService: ConfigService) {
    this.backendUrl =
      this.configService.get("BACKEND_URL") || "http://localhost:4200";
    this.nodeApiKey = this.configService.get("NODE_API_KEY") || "";
    this.nodeId = this.configService.get("NODE_ID") || "";
    this.statsInterval =
      Number(this.configService.get("STATS_INTERVAL_MS")) || 300000; // 5 минут
    this.xrayGrpcAddress =
      this.configService.get("XRAY_GRPC_ADDRESS") || "127.0.0.1:8080";
  }

  onModuleInit(): void {
    // Инициализация gRPC клиента
    this.initGrpcClient();

    // Запускаем сбор статистики после инициализации
    void this.startStatsCollection();
  }

  onModuleDestroy(): void {
    // Очистка gRPC клиента при выключении
    if (this.grpcClient) {
      this.grpcClient.close();
      this.logger.log("gRPC client closed");
    }
  }

  /**
   * Инициализация gRPC клиента для подключения к Xray Stats API
   */
  private initGrpcClient(): void {
    try {
      // Загружаем proto файл Xray Stats API
      // Путь от dist/ к proto/
      const packageDefinition = protoLoader.loadSync(
        require.resolve("../../../proto/xray-stats.proto"),
        {
          keepCase: true,
          longs: String,
          enums: String,
          defaults: true,
          oneofs: true,
        },
      );

      const statsProto = grpc.loadPackageDefinition(packageDefinition);

      // Получаем конструктор клиента из загруженного proto
      const protoPackage = statsProto as unknown as {
        proxyman: {
          stats: {
            StatsService: typeof grpc.Client;
          };
        };
      };

      const StatsServiceClientCtor = protoPackage.proxyman.stats.StatsService;

      // Создаем клиента для Stats сервиса
      this.grpcClient = new StatsServiceClientCtor(
        this.xrayGrpcAddress,
        grpc.credentials.createInsecure(),
      ) as unknown as StatsServiceClient;

      this.isClientReady = true;
      this.logger.log(
        `gRPC client initialized for Xray Stats API at ${this.xrayGrpcAddress}`,
      );
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.warn(`Failed to initialize gRPC client: ${err.message}`);
      this.logger.warn("Stats collection will use fallback mode (empty stats)");
      this.isClientReady = false;
    }
  }

  private async startStatsCollection(): Promise<void> {
    this.logger.log(
      `Starting traffic stats collection every ${this.statsInterval}ms`,
    );

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

    // Сбор статистики через gRPC Xray Stats API
    const stats = await this.getUserTrafficFromXray();

    if (stats.length === 0) {
      this.logger.debug("No traffic stats to send");
      return;
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.nodeApiKey}`,
        },
        body: JSON.stringify({ stats }),
      });

      if (response.ok) {
        this.logger.debug(
          `Traffic stats sent successfully (${stats.length} users)`,
        );
      } else {
        const error = await response.text();
        this.logger.warn(
          `Traffic stats failed with status: ${response.status} - ${error}`,
        );
      }
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`Traffic stats error: ${err.message}`);
      throw error;
    }
  }

  /**
   * Получить трафик пользователей из Xray через gRPC Stats API
   */
  private async getUserTrafficFromXray(): Promise<
    Array<{ userId: number; upload: number; download: number }>
  > {
    if (!this.isClientReady || !this.grpcClient) {
      this.logger.warn("gRPC client not ready, skipping stats collection");
      return [];
    }

    return new Promise((resolve) => {
      try {
        // Получаем общую статистику по всем пользователям
        // Xray хранит статистику в формате: "user>>>email>>>traffic>>>uplink/downlink"
        const stats: Array<{
          userId: number;
          upload: number;
          download: number;
        }> = [];

        // Запрос к gRPC API для получения всех статистик пользователей
        // Используем QueryStats для получения всех статистик с префиксом "user>>>"
        const request = {
          pattern: "user>>>", // Префикс для всех пользовательских статистик
          reset: false, // Не сбрасывать статистику после чтения
        };

        this.grpcClient!.QueryStats(
          request,
          (err: Error | null, response: unknown) => {
            if (err) {
              this.logger.error(`gRPC QueryStats error: ${err.message}`);
              resolve([]);
              return;
            }

            const typedResponse = response as QueryStatsResponse | undefined;
            if (!typedResponse || !typedResponse.stat) {
              this.logger.debug("No stats returned from Xray");
              resolve([]);
              return;
            }

            // Парсим ответ и преобразуем в формат userId
            const userStats = new Map<
              number,
              { upload: number; download: number }
            >();

            for (const stat of typedResponse.stat) {
              // Формат имени: "user>>>email>>>traffic>>>uplink" или "user>>>email>>>traffic>>>downlink"
              const parts = stat.name.split(">>>");
              if (parts.length >= 4 && parts[0] === "user") {
                const email = parts[1]; // email в формате "user-123"
                const type = parts[3]; // "uplink" или "downlink"
                const value = Number(stat.value) || 0;

                // Извлекаем userId из email (формат: "user-123")
                const userIdMatch = email.match(/user-(\d+)/);
                if (!userIdMatch) continue;

                const userId = parseInt(userIdMatch[1], 10);

                if (!userStats.has(userId)) {
                  userStats.set(userId, { upload: 0, download: 0 });
                }

                const userStat = userStats.get(userId)!;
                if (type === "uplink") {
                  userStat.upload = value;
                } else if (type === "downlink") {
                  userStat.download = value;
                }
              }
            }

            // Преобразуем Map в массив
            userStats.forEach((traffic, userId) => {
              stats.push({
                userId,
                upload: traffic.upload,
                download: traffic.download,
              });
            });

            this.logger.log(`Collected stats for ${stats.length} users`);
            resolve(stats);
          },
        );
      } catch (error: unknown) {
        const err = error as Error;
        this.logger.error(`getUserTrafficFromXray error: ${err.message}`);
        resolve([]);
      }
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
