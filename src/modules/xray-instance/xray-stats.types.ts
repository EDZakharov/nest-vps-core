/**
 * Типы для gRPC клиента Xray Stats API
 */

/**
 * Интерфейс для ответа QueryStats
 */
export interface QueryStatsResponse {
  stat: XrayStat[];
}

/**
 * Интерфейс для статистики Xray
 */
export interface XrayStat {
  name: string;
  value: string | number;
}

/**
 * Интерфейс для gRPC клиента StatsService
 */
export interface StatsServiceClient {
  QueryStats(
    request: { pattern: string; reset: boolean },
    callback: (
      err: Error | null,
      response: QueryStatsResponse | undefined,
    ) => void,
  ): void;
  close(): void;
}
