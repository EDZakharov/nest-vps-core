import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditService, AuditLogDto } from './audit.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const responseTime = Date.now() - startTime;
        
        const auditLog: AuditLogDto = {
          timestamp: new Date(),
          nodeId: '',
          endpoint: request.path,
          method: request.method,
          statusCode: response.statusCode,
          ip: request.ip,
          userAgent: request.headers['user-agent'],
          requestId: request.headers['x-request-id'] || crypto.randomUUID(),
          responseTime,
          action: this.extractAction(request),
          userId: this.extractUserId(request),
          metadata: {
            query: request.query,
            params: request.params,
          },
        };

        this.auditService.log(auditLog);
      }),
    );
  }

  private extractAction(request: Record<string, any>): string {
    const method = request.method as string;
    const path = request.path as string;

    if (path.includes('/xray/users') && method === 'POST') return 'create_user';
    if (path.includes('/xray/users') && method === 'DELETE') return 'delete_user';
    if (path.includes('/xray/users') && method === 'GET') return 'get_user';
    if (path.includes('/xray/stats')) return 'get_stats';
    if (path.includes('/node/heartbeat')) return 'heartbeat';
    if (path.includes('/node/sync')) return 'sync';
    if (path.includes('/health')) return 'health_check';
    
    return 'unknown';
  }

  private extractUserId(request: Record<string, any>): number | undefined {
    return request.params?.userId || request.body?.userId;
  }
}
