import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';

@Injectable()
export class XrayConfigService {
  private readonly logger = new Logger(XrayConfigService.name);
  private readonly configPath: string;
  private readonly keysPath: string;

  constructor(private readonly configService: ConfigService) {
    this.configPath = this.configService.get('XRAY_CONFIG_PATH') || '/usr/local/etc/xray/config.json';
    this.keysPath = '/usr/local/etc/xray/.keys';
    new Logger(XrayConfigService.name).log(`Xray config path: ${this.configPath}`);
  }

  /**
   * Прочитать конфиг Xray
   */
  async readConfig(): Promise<any> {
    try {
      const configData = await fs.readFile(this.configPath, 'utf-8');
      return JSON.parse(configData);
    } catch (error: any) {
      this.logger.error(`Failed to read Xray config: ${error.message}`);
      throw error;
    }
  }

  /**
   * Записать конфиг Xray
   */
  async writeConfig(config: any): Promise<void> {
    try {
      await fs.writeFile(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
      this.logger.log('Xray config updated');
    } catch (error: any) {
      this.logger.error(`Failed to write Xray config: ${error.message}`);
      throw error;
    }
  }

  /**
   * Добавить пользователя в конфиг
   */
  async addUser(userId: string, uuid: string): Promise<void> {
    const config = await this.readConfig();

    // Проверяем, существует ли уже пользователь
    const clients = config.inbounds[0].settings.clients;
    const exists = clients.some((client: any) => client.id === uuid);

    if (exists) {
      this.logger.warn(`User ${userId} (uuid: ${uuid}) already exists`);
      return;
    }

    // Добавляем пользователя с правильными настройками для REALITY
    clients.push({
      email: `user-${userId}`,
      id: uuid,
      flow: 'xtls-rprx-vision',
      level: 0,
      security: 'auto',    // Важно для REALITY!
    });

    await this.writeConfig(config);
    this.logger.log(`User ${userId} added to Xray config with security: auto`);
  }

  /**
   * Удалить пользователя из конфига
   */
  async removeUser(userId: string): Promise<void> {
    const config = await this.readConfig();

    const clients = config.inbounds[0].settings.clients;
    const filtered = clients.filter((client: any) => client.email !== `user-${userId}`);

    if (filtered.length === clients.length) {
      this.logger.warn(`User ${userId} not found`);
      return;
    }

    config.inbounds[0].settings.clients = filtered;
    await this.writeConfig(config);
    this.logger.log(`User ${userId} removed from Xray config`);
  }

  /**
   * Получить UUID пользователя
   */
  async getUserUuid(userId: string): Promise<string | null> {
    const config = await this.readConfig();
    const clients = config.inbounds[0].settings.clients;
    const client = clients.find((c: any) => c.email === `user-${userId}`);
    return client?.id || null;
  }

  /**
   * Получить всех пользователей
   */
  async getAllUsers(): Promise<any[]> {
    const config = await this.readConfig();
    return config.inbounds[0].settings.clients;
  }

  /**
   * Получить REALITY ключи из файла .keys
   */
  async getRealityKeys(): Promise<{
    public_key: string;
    private_key: string;
    short_ids: string[];
    dest: string;
    server_names: string[];
  }> {
    try {
      const keysData = await fs.readFile(this.keysPath, 'utf-8');
      const lines = keysData.split('\n');

      const keys: Record<string, string> = {};
      for (const line of lines) {
        const [key, value] = line.split(': ').map((s) => s.trim());
        if (key && value) {
          keys[key] = value;
        }
      }

      // Парсим server_names в массив
      const serverNames = keys.server_names ? keys.server_names.split(',') : ['google.com'];

      // Парсим shortIds из конфига (может быть несколько)
      const shortIds = keys.shortsid ? [keys.shortsid, ''] : [''];

      return {
        public_key: keys.public_key || '',
        private_key: keys.private_key || '',
        short_ids: shortIds,
        dest: keys.dest || 'google.com:443',
        server_names: serverNames,
      };
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`Failed to read REALITY keys: ${err.message}`);
      throw error;
    }
  }
}
