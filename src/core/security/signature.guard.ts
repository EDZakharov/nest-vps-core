import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { createHmac, createHash } from "crypto";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

@Injectable()
export class SignatureGuard implements CanActivate {
  private readonly logger = new Logger(SignatureGuard.name);
  private readonly nodeApiKey: string;
  private readonly maxClockSkew = 5 * 60 * 1000; // 5 минут
  private readonly usedNonces = new Map<string, number>();

  constructor(
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
  ) {
    this.nodeApiKey = this.configService.get("NODE_API_KEY") || "";
    // Очистка старых nonce каждые 10 минут
    setInterval(() => this.cleanupNonces(), 10 * 60 * 1000);
  }

  canActivate(context: ExecutionContext): boolean {
    // Check if route is public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true; // Skip signature validation for public routes
    }

    const request = context.switchToHttp().getRequest<Request>();
    const timestamp = request.headers["x-timestamp"] as string | undefined;
    const signature = request.headers["x-signature"] as string | undefined;
    const nonce = request.headers["x-nonce"] as string | undefined;

    if (!timestamp || !signature || !nonce) {
      throw new UnauthorizedException("Missing security headers");
    }

    // Проверка timestamp (не старше 5 минут)
    const requestTime = new Date(timestamp).getTime();
    const now = Date.now();
    const clockSkew = Math.abs(now - requestTime);

    if (clockSkew > this.maxClockSkew) {
      this.logger.warn(
        `Request timestamp too old: ${timestamp} (skew: ${clockSkew}ms)`,
      );
      throw new ForbiddenException("Request timestamp expired");
    }

    // Проверка nonce (защита от replay)
    if (this.usedNonces.has(nonce)) {
      this.logger.warn(`Duplicate nonce detected: ${nonce}`);
      throw new ForbiddenException("Replay attack detected");
    }

    // Проверка подписи
    const isValid = this.verifySignature(
      timestamp,
      request.method,
      request.path,
      request.body as Record<string, unknown> | undefined,
      nonce,
      signature,
    );

    if (!isValid) {
      this.logger.warn("Invalid signature");
      throw new UnauthorizedException("Invalid signature");
    }

    // Сохраняем nonce
    this.usedNonces.set(nonce, now);

    const requestId = (request.headers["x-request-id"] as string) || "unknown";
    this.logger.debug(
      `Signature verified: requestId=${requestId}, path=${request.path}`,
    );

    return true;
  }

  private verifySignature(
    timestamp: string,
    method: string,
    path: string,
    body: Record<string, unknown> | undefined,
    nonce: string,
    signature: string,
  ): boolean {
    const bodyHash = this.hashBody(body);
    const stringToSign = this.buildStringToSign(
      timestamp,
      method,
      path,
      bodyHash,
      nonce,
    );
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
    return [timestamp, method.toUpperCase(), path, bodyHash, nonce].join("\n");
  }

  private hmacSha256(data: string, secret: string): string {
    return createHmac("sha256", secret).update(data, "utf8").digest("hex");
  }

  private hashBody(body: Record<string, unknown> | undefined): string {
    if (!body) return "";
    const json = JSON.stringify(body, Object.keys(body).sort());
    return createHash("sha256").update(json).digest("hex");
  }

  private cleanupNonces(): void {
    const now = Date.now();
    const cutoff = now - this.maxClockSkew;

    for (const [nonce, timestamp] of this.usedNonces.entries()) {
      if (timestamp < cutoff) {
        this.usedNonces.delete(nonce);
      }
    }
  }
}
