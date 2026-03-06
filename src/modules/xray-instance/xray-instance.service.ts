import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { XrayConfigService } from './xray-config.service';

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
  async addUser(userId: string, uuid: string) {
    // 1. Добавляем в конфиг
    await this.xrayConfig.addUser(userId, uuid);

    // 2. Перезапускаем Xray
    await this.restartXray();

    this.logger.log(`User ${userId} added and Xray restarted`);

    return { success: true, userId, uuid };
  }

  /**
   * Удалить пользователя
   */
  async removeUser(userId: string) {
    // 1. Удаляем из конфига
    await this.xrayConfig.removeUser(userId);

    // 2. Перезапускаем Xray
    await this.restartXray();

    this.logger.log(`User ${userId} removed and Xray restarted`);

    return { success: true, userId };
  }

  /**
   * Сгенерировать VLESS ссылку
   */
  async generateLink(userId: string): Promise<{ link: string }> {
    const uuid = await this.xrayConfig.getUserUuid(userId);

    if (!uuid) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    const domain = this.configService.get('DOMAIN') || 'localhost';
    const port = this.configService.get('XRAY_PORT') || 443;

    // Генерируем VLESS REALITY ссылку
    const keys = await this.xrayConfig.getRealityKeys();
    const serverName = keys.server_names[0] || 'google.com';
    const shortId = keys.short_ids[0] || '';

    const link = `vless://${uuid}@${domain}:${port}?encryption=none&flow=xtls-rprx-vision&security=reality&sni=${serverName}&fp=chrome&pbk=${keys.public_key}&sid=${shortId}&spx=/&type=tcp&headerType=none#user-${userId}`;

    this.logger.log(`Generated REALITY link for user ${userId}`);

    return { link };
  }

  /**
   * Получить REALITY ключи
   */
  async getRealityKeys() {
    this.logger.log('Getting REALITY keys');
    return this.xrayConfig.getRealityKeys();
  }

  /**
   * Получить всех пользователей
   */
  async getAllUsers() {
    const users = await this.xrayConfig.getAllUsers();
    return users.map((user) => ({
      userId: user.email,
      uuid: user.id,
      flow: user.flow,
    }));
  }

  /**
   * Перезапустить Xray
   */
  async restartXray() {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      // Запускаем скрипт через nsenter в namespace хоста
      const result = await execAsync(
        'docker run --rm --privileged --pid=host -v /opt:/opt alpine ' +
        'nsenter -t 1 -m -u -n -i /bin/sh /opt/nest-vps-core/reload-xray.sh'
      );

      this.logger.log(`Xray reload output: ${result.stdout.trim()}`);
      return { success: true };
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`Failed to reload Xray: ${err.message}`);
      return { success: false, error: err.message };
    }
  }
}
