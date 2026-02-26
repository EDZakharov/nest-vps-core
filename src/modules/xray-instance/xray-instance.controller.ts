import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post } from '@nestjs/common';

import { AddUserDto } from './dto/add-user.dto';
import { XrayInstanceService } from './xray-instance.service';

@Controller('xray/users')
export class XrayInstanceController {
  constructor(private readonly xrayInstanceService: XrayInstanceService) {}

  @Post()
  async addUser(@Body() dto: AddUserDto) {
    return this.xrayInstanceService.addUser(dto.userId, dto.uuid);
  }

  @Get()
  async getAllUsers() {
    return this.xrayInstanceService.getAllUsers();
  }

  @Get(':userId/link')
  async generateLink(@Param('userId', ParseIntPipe) userId: number) {
    return this.xrayInstanceService.generateLink(userId);
  }

  @Delete(':userId')
  async removeUser(@Param('userId', ParseIntPipe) userId: number) {
    return this.xrayInstanceService.removeUser(userId);
  }

  @Post('restart-xray')
  async restartXray() {
    return this.xrayInstanceService.restartXray();
  }

  @Get('stats/traffic')
  async getTrafficStats() {
    return this.xrayInstanceService.getTrafficStats();
  }
}
