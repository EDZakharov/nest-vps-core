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
  async addUser(email: string, uuid: string) {
    // 1. Добавляем в конфиг
    await this.xrayConfig.addUser(email, uuid);

    // 2. Перезапускаем Xray
    await this.restartXray();

    this.logger.log(`User ${email} added and Xray restarted`);

    return { success: true, email, uuid };
  }

  /**
   * Удалить пользователя
   */
  async removeUser(email: string) {
    // 1. Удаляем из конфига
    await this.xrayConfig.removeUser(email);

    // 2. Перезапускаем Xray
    await this.restartXray();

    this.logger.log(`User ${email} removed and Xray restarted`);

    return { success: true, email };
  }

  /**
   * Сгенерировать VLESS ссылку
   */
  async generateLink(email: string): Promise<{ link: string }> {
    const uuid = await this.xrayConfig.getUserUuid(email);

    if (!uuid) {
      throw new NotFoundException(`User ${email} not found`);
    }

    const domain = this.configService.get('DOMAIN') || 'localhost';
    const port = this.configService.get('XRAY_PORT') || 443;

    // Генерируем VLESS ссылку
    const link = `vless://${uuid}@${domain}:${port}?encryption=none&flow=xtls-rprx-vision&security=tls&sni=${domain}&fp=chrome&alpn=http/1.1&type=tcp# ${email}`;

    this.logger.log(`Generated link for ${email}`);

    return { link };
  }

  /**
   * Получить всех пользователей
   */
  async getAllUsers() {
    const users = await this.xrayConfig.getAllUsers();
    return users.map((user: any) => ({
      email: user.email,
      uuid: user.id,
      flow: user.flow,
    }));
  }

  /**
   * Перезапустить Xray
   */
  private async restartXray(): Promise<void> {
    try {
      await execAsync('systemctl restart xray');
      this.logger.log('Xray restarted successfully');
    } catch (error: any) {
      this.logger.error(`Failed to restart Xray: ${error.message}`);
      throw error;
    }
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
}
