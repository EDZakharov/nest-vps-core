/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-base-to-string */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable, tap } from "rxjs";
import { AuditService, AuditLogDto } from "./audit.service";

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const responseTime = Date.now() - startTime;

        // Skip audit logging for health checks and heartbeats (already tracked separately)
        const path = request.path ?? "";
        if (path.includes("/health") || path.includes("/heartbeat")) {
          return;
        }

        const auditLog: AuditLogDto = {
          timestamp: new Date(),
          nodeId: "",
          endpoint: request.path ?? "",
          method: request.method ?? "",
          statusCode: response.statusCode ?? 200,
          ip: request.ip ?? "",
          userAgent: request.headers?.["user-agent"] ?? "",
          requestId: request.headers?.["x-request-id"] || crypto.randomUUID(),
          responseTime,
          action: this.extractAction(request),
          userId: this.extractUserId(request),
          metadata: {
            query: request.query ?? {},
            params: request.params ?? {},
          },
        };

        this.auditService.log(auditLog);
      }),
    );
  }

  private extractAction(request: Record<string, unknown>): string {
    const method = String(request.method ?? "");
    const path = String(request.path ?? "");

    if (path.includes("/xray/users") && method === "POST") return "create_user";
    if (path.includes("/xray/users") && method === "DELETE")
      return "delete_user";
    if (path.includes("/xray/users") && method === "GET") return "get_user";
    if (path.includes("/xray/stats")) return "get_stats";
    if (path.includes("/node/heartbeat")) return "heartbeat";
    if (path.includes("/node/sync")) return "sync";
    if (path.includes("/health")) return "health_check";

    return "unknown";
  }

  private extractUserId(request: Record<string, unknown>): number | undefined {
    const params = request.params as Record<string, unknown> | undefined;
    const body = request.body as Record<string, unknown> | undefined;
    const userId = params?.userId ?? body?.userId;
    return userId ? Number(userId) : undefined;
  }
}
/* eslint-enable @typescript-eslint/no-unsafe-assignment */
/* eslint-enable @typescript-eslint/no-unsafe-member-access */
/* eslint-enable @typescript-eslint/no-base-to-string */
