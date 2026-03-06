import { Injectable, Logger } from '@nestjs/common';
import { XrayConfigService } from './xray-config.service';

interface XrayConfig {
  log?: { loglevel?: string };
  dns?: any;
  routing?: any;
  inbounds?: any[];
  outbounds?: any[];
}

@Injectable()
export class XrayInstanceService {
  private readonly logger = new Logger(XrayInstanceService.name);

  constructor(private readonly xrayConfig: XrayConfigService) {}

  /**
   * Update full Xray config and restart Xray
   * Called by backend when config changes (user added/removed)
   */
  async updateConfig(config: XrayConfig) {
    this.logger.log('Updating Xray configuration...');
    
    // 1. Write new config to file
    await this.xrayConfig.writeConfig(config);
    
    // 2. Restart Xray to apply changes
    await this.restartXray();
    
    this.logger.log('Xray configuration updated and restarted');
    return { success: true };
  }

  /**
   * Get current REALITY keys (for debugging/verification)
   */
  async getRealityKeys() {
    this.logger.log('Getting REALITY keys');
    return this.xrayConfig.getRealityKeys();
  }

  /**
   * Restart Xray service
   */
  async restartXray() {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      // Run reload script via nsenter in host namespace
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
