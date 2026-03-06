import { Body, Controller, Delete, Get, Logger, Param, Post } from '@nestjs/common';
import { XrayInstanceService } from './xray-instance.service';

export class CreateUserDto {
  userId: number;
  uuid: string;
}

@Controller('xray')
export class XrayInstanceController {
  private readonly logger = new Logger(XrayInstanceController.name);

  constructor(private readonly xrayInstanceService: XrayInstanceService) {}

  /**
   * Add user to Xray config
   */
  @Post('users')
  async addUser(@Body() dto: CreateUserDto) {
    this.logger.log(`POST /api/xray/users: userId=${dto.userId}, uuid=${dto.uuid}`);
    await this.xrayInstanceService.addUser(dto.userId, dto.uuid);
    return { success: true, userId: dto.userId, uuid: dto.uuid };
  }

  /**
   * Remove user from Xray config
   */
  @Delete('users/:userId')
  async removeUser(@Param('userId') userId: string) {
    this.logger.log(`DELETE /api/xray/users/${userId}`);
    await this.xrayInstanceService.removeUser(userId);
    return { success: true, userId };
  }

  /**
   * Generate link for user
   */
  @Get('users/:userId/link')
  async generateLink(@Param('userId') userId: string) {
    this.logger.log(`GET /api/xray/users/${userId}/link`);
    const link = await this.xrayInstanceService.generateLink(userId);
    return { success: true, userId, link };
  }

  /**
   * Get REALITY keys
   */
  @Get('keys')
  async getKeys() {
    this.logger.log('GET /api/xray/keys');
    return this.xrayInstanceService.getRealityKeys();
  }
}
