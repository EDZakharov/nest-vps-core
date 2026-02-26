import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { exec } from 'child_process';
import { promisify } from 'util';

import { XrayConfigService } from './xray-config.service';

const execAsync = promisify(exec);

@Injectable()
export class XrayInstanceService {
  private readonly logger = new Logger(XrayInstanceService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly xrayConfig: XrayConfigService,
  ) {}

  /**
   * Добавить пользователя
   */
  async addUser(userId: number, uuid: string) {
    // 1. Добавляем в конфиг
    await this.xrayConfig.addUser(userId.toString(), uuid);

    // 2. Перезапускаем Xray
    await this.restartXray();

    this.logger.log(`User ${userId} added and Xray restarted`);

    return { success: true, userId, uuid };
  }

  /**
   * Удалить пользователя
   */
  async removeUser(userId: number) {
    // 1. Удаляем из конфига
    await this.xrayConfig.removeUser(userId.toString());

    this.logger.log(`User ${userId} removed from Xray config`);

    return { success: true, userId };
  }

  /**
   * Сгенерировать VLESS ссылку
   */
  async generateLink(userId: number): Promise<{ link: string }> {
    const uuid = await this.xrayConfig.getUserUuid(userId.toString());

    if (!uuid) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    const domain = this.configService.get('DOMAIN') || 'localhost';
    const port = this.configService.get('XRAY_PORT') || 443;

    // Генерируем VLESS ссылку
    const link = `vless://${uuid}@${domain}:${port}?encryption=none&flow=xtls-rprx-vision&security=tls&sni=${domain}&fp=chrome&alpn=http/1.1&type=tcp#user-${userId}`;

    this.logger.log(`Generated link for user ${userId}`);

    return { link };
  }

  /**
   * Получить всех пользователей
   */
  async getAllUsers() {
    const users = await this.xrayConfig.getAllUsers();
    return users.map((user: any) => ({
      userId: user.email,
      uuid: user.id,
      flow: user.flow,
    }));
  }

  /**
   * Получить статистику трафика
   */
  async getTrafficStats() {
    // TODO: Реализовать сбор статистики через iptables/nftables
    return {
      total: {
        up: 0,
        down: 0,
      },
      users: [],
    };
  }

  /**
   * Перезапустить Xray
   */
  async restartXray() {
    try {
      // Используем docker для рестарта Xray на хосте
      // Xray работает как systemd сервис на хосте, не в Docker
      await execAsync('systemctl restart xray 2>/dev/null || service xray restart 2>/dev/null || pkill -HUP xray || true');
      this.logger.log('Xray restart signal sent');
      return { success: true };
    } catch (error: any) {
      this.logger.error(`Failed to restart Xray: ${error.message}`);
      // Не выбрасываем ошибку - это не критично
      return { success: false, error: error.message };
    }
  }
}
