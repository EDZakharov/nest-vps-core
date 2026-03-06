import { Public } from '../../core/decorators/public.decorator';
import { Body, Controller, Delete, Get, Logger, Param, Post } from '@nestjs/common';
import { XrayInstanceService } from './xray-instance.service';

@Controller('xray')
export class XrayInstanceController {
  private readonly logger = new Logger(XrayInstanceController.name);

  constructor(private readonly xrayInstanceService: XrayInstanceService) {}

  /**
   * Add user to Xray config
   */
  @Public()
  @Post('users')
  async addUser(@Body() body: { userId: string | number; uuid: string }) {
    const userId = String(body.userId);
    const uuid = body.uuid;
    this.logger.log(`POST /api/xray/users: userId=${userId}, uuid=${uuid}`);
    await this.xrayInstanceService.addUser(userId, uuid);
    return { success: true, userId, uuid };
  }

  /**
   * Remove user from Xray config
   */
  @Public()
  @Delete('users/:userId')
  async removeUser(@Param('userId') userId: string) {
    this.logger.log(`DELETE /api/xray/users/${userId}`);
    await this.xrayInstanceService.removeUser(userId);
    return { success: true, userId };
  }

  /**
   * Generate link for user
   */
  @Public()
  @Get('users/:userId/link')
  async generateLink(@Param('userId') userId: string) {
    this.logger.log(`GET /api/xray/users/${userId}/link`);
    const link = await this.xrayInstanceService.generateLink(userId);
    return { success: true, userId, link };
  }

  /**
   * Get REALITY keys
   */
  @Public()
  @Get('keys')
  async getKeys() {
    this.logger.log('GET /api/xray/keys');
    return this.xrayInstanceService.getRealityKeys();
  }
}
