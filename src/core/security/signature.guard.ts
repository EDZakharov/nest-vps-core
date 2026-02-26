import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, createHash } from 'crypto';

@Injectable()
export class SignatureGuard implements CanActivate {
  private readonly logger = new Logger(SignatureGuard.name);
  private readonly nodeApiKey: string;
  private readonly maxClockSkew = 5 * 60 * 1000; // 5 минут
  private readonly usedNonces = new Map<string, number>();

  constructor(private readonly configService: ConfigService) {
    this.nodeApiKey = this.configService.get('NODE_API_KEY') || '';
    // Очистка старых nonce каждые 10 минут
    setInterval(() => this.cleanupNonces(), 10 * 60 * 1000);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: Record<string, any> = context.switchToHttp().getRequest();
    const { headers, method, path, body } = request;

    const timestamp: string = headers['x-timestamp'];
    const signature: string = headers['x-signature'];
    const nonce: string = headers['x-nonce'];

    if (!timestamp || !signature || !nonce) {
      throw new UnauthorizedException('Missing security headers');
    }

    // Проверка timestamp (не старше 5 минут)
    const requestTime = new Date(timestamp).getTime();
    const now = Date.now();
    const clockSkew = Math.abs(now - requestTime);

    if (clockSkew > this.maxClockSkew) {
      this.logger.warn(
        `Request timestamp too old: ${timestamp} (skew: ${clockSkew}ms)`,
      );
      throw new ForbiddenException('Request timestamp expired');
    }

    // Проверка nonce (защита от replay)
    if (this.usedNonces.has(nonce)) {
      this.logger.warn(`Duplicate nonce detected: ${nonce}`);
      throw new ForbiddenException('Replay attack detected');
    }

    // Проверка подписи
    const isValid = this.verifySignature(timestamp, method, path, body, nonce, signature);

    if (!isValid) {
      this.logger.warn('Invalid signature');
      throw new UnauthorizedException('Invalid signature');
    }

    // Сохраняем nonce
    this.usedNonces.set(nonce, now);

    this.logger.debug(
      `Signature verified: requestId=${headers['x-request-id']}, path=${path}`,
    );

    return true;
  }

  private verifySignature(
    timestamp: string,
    method: string,
    path: string,
    body: any,
    nonce: string,
    signature: string,
  ): boolean {
    const bodyHash = this.hashBody(body);
    const stringToSign = this.buildStringToSign(timestamp, method, path, bodyHash, nonce);
    const expectedSignature = this.hmacSha256(stringToSign, this.nodeApiKey);

    return signature === expectedSignature;
  }

  private buildStringToSign(
    timestamp: string,
    method: string,
    path: string,
    bodyHash: string,
    nonce: string,
  ): string {
    return [timestamp, method.toUpperCase(), path, bodyHash, nonce].join('\n');
  }

  private hmacSha256(data: string, secret: string): string {
    return createHmac('sha256', secret).update(data, 'utf8').digest('hex');
  }

  private hashBody(body: any): string {
    if (!body) return '';
    const json = JSON.stringify(body, Object.keys(body).sort());
    return createHash('sha256').update(json).digest('hex');
  }

  private cleanupNonces() {
    const now = Date.now();
    const cutoff = now - this.maxClockSkew;

    for (const [nonce, timestamp] of this.usedNonces.entries()) {
      if (timestamp < cutoff) {
        this.usedNonces.delete(nonce);
      }
    }
  }
}
