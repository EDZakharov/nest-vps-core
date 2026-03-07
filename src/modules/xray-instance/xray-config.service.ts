import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as fs from "fs/promises";

interface XrayClient {
  email: string;
  id: string;
  flow: string;
  level: number;
  security?: string;
}

interface XrayConfig {
  inbounds: Array<{
    settings: {
      clients: XrayClient[];
    };
  }>;
}

@Injectable()
export class XrayConfigService {
  private readonly logger = new Logger(XrayConfigService.name);
  private readonly configPath: string;
  private readonly keysPath: string;

  constructor(private readonly configService: ConfigService) {
    this.configPath =
      this.configService.get("XRAY_CONFIG_PATH") || "/opt/xray/config.json";
    this.keysPath =
      this.configService.get("XRAY_KEYS_PATH") || "/opt/xray/.keys";
    new Logger(XrayConfigService.name).log(
      `Xray config path: ${this.configPath}`,
    );
    new Logger(XrayConfigService.name).log(`Xray keys path: ${this.keysPath}`);
  }

  /**
   * Прочитать конфиг Xray
   */
  async readConfig(): Promise<XrayConfig> {
    try {
      const configData = await fs.readFile(this.configPath, "utf-8");
      return JSON.parse(configData) as XrayConfig;
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`Failed to read Xray config: ${err.message}`);
      throw error;
    }
  }

  /**
   * Записать конфиг Xray
   */
  async writeConfig(config: XrayConfig): Promise<void> {
    try {
      await fs.writeFile(
        this.configPath,
        JSON.stringify(config, null, 2),
        "utf-8",
      );
      this.logger.log("Xray config updated");
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`Failed to write Xray config: ${err.message}`);
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
    const exists = clients.some((client) => client.id === uuid);

    if (exists) {
      this.logger.warn(`User ${userId} (uuid: ${uuid}) already exists`);
      return;
    }

    // Добавляем пользователя с правильными настройками для REALITY
    clients.push({
      email: `user-${userId}`,
      id: uuid,
      flow: "xtls-rprx-vision",
      level: 0,
      security: "auto", // Важно для REALITY!
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
    const filtered = clients.filter(
      (client) => client.email !== `user-${userId}`,
    );

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
    const client = clients.find((c) => c.email === `user-${userId}`);
    return client?.id ?? null;
  }

  /**
   * Получить всех пользователей
   */
  async getAllUsers(): Promise<XrayClient[]> {
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
    // Если файл не существует - генерируем ключи
    try {
      await fs.access(this.keysPath);
    } catch {
      this.logger.log("REALITY keys file not found, generating...");
      await this.generateRealityKeys();
    }

    try {
      const keysData = await fs.readFile(this.keysPath, "utf-8");
      const lines = keysData.split("\n");

      const keys: Record<string, string> = {};
      for (const line of lines) {
        const [key, value] = line.split(": ").map((s) => s.trim());
        if (key && value) {
          keys[key] = value;
        }
      }

      // Парсим server_names в массив
      const serverNames = keys.server_names
        ? keys.server_names.split(",")
        : ["google.com"];

      // Парсим shortIds из конфига (может быть несколько)
      const shortIds = keys.shortsid ? [keys.shortsid, ""] : [""];

      return {
        public_key: keys.public_key || "",
        private_key: keys.private_key || "",
        short_ids: shortIds,
        dest: keys.dest || "google.com:443",
        server_names: serverNames,
      };
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`Failed to read REALITY keys: ${err.message}`);
      throw error;
    }
  }

  /**
   * Сгенерировать REALITY ключи через xray x25519
   */
  private async generateRealityKeys(): Promise<void> {
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);

    try {
      const { stdout } = await execAsync(
        "docker run --rm --entrypoint xray ghcr.io/xtls/xray-core:latest x25519 2>/dev/null",
      );

      const lines = stdout.trim().split("\n");
      const keys: Record<string, string> = {};

      for (const line of lines) {
        const [key, value] = line.split(":").map((s) => s.trim());
        if (key && value) {
          const cleanKey = key
            .replace("PrivateKey", "private_key")
            .replace("PublicKey", "public_key");
          keys[cleanKey] = value;
        }
      }

      // Добавляем shortid и dest
      const crypto = await import("crypto");
      keys.shortsid = crypto.randomBytes(3).toString("hex");
      keys.dest = "google.com:443";
      keys.server_names = "google.com,www.google.com";

      // Записываем в файл
      const content = Object.entries(keys)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n");

      await fs.writeFile(this.keysPath, content, "utf-8");
      this.logger.log("REALITY keys generated successfully");
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`Failed to generate REALITY keys: ${err.message}`);
      throw error;
    }
  }
}
