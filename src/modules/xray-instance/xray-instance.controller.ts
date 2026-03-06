import { Public } from '../../core/decorators/public.decorator';
import { Body, Controller, Get, Logger, Post } from '@nestjs/common';
import { XrayInstanceService } from './xray-instance.service';

interface XrayConfig {
  log?: { loglevel?: string };
  dns?: any;
  routing?: any;
  inbounds?: any[];
  outbounds?: any[];
}

@Controller('xray')
export class XrayInstanceController {
  private readonly logger = new Logger(XrayInstanceController.name);

  constructor(private readonly xrayInstanceService: XrayInstanceService) {}

  /**
   * Update full Xray config and restart Xray
   * Accepts complete Xray configuration JSON
   */
  @Public()
  @Post('config')
  async updateConfig(@Body() config: XrayConfig) {
    this.logger.log('POST /api/xray/config: Received new configuration');
    await this.xrayInstanceService.updateConfig(config);
    return { success: true };
  }

  /**
   * Get current REALITY keys (for debugging/verification)
   */
  @Public()
  @Get('keys')
  async getKeys() {
    this.logger.log('GET /api/xray/keys');
    return this.xrayInstanceService.getRealityKeys();
  }

  /**
   * Health check endpoint
   */
  @Public()
  @Get('health')
  async health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
