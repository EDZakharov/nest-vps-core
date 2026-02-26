import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { ThrottlerGuard } from '@nestjs/throttler';

import { AddUserDto } from './dto/add-user.dto';
import { XrayInstanceService } from './xray-instance.service';

@Controller('xray/users')
@UseGuards(ThrottlerGuard)
export class XrayInstanceController {
  constructor(private readonly xrayInstanceService: XrayInstanceService) {}

  @Post()
  @Throttle({ short: { limit: 2, ttl: 1000 } })
  async addUser(@Body() dto: AddUserDto) {
    return this.xrayInstanceService.addUser(dto.userId, dto.uuid);
  }

  @Get()
  @Throttle({ medium: { limit: 10, ttl: 60000 } })
  async getAllUsers() {
    return this.xrayInstanceService.getAllUsers();
  }

  @Get(':userId/link')
  @Throttle({ medium: { limit: 20, ttl: 60000 } })
  async generateLink(@Param('userId', ParseIntPipe) userId: number) {
    return this.xrayInstanceService.generateLink(userId);
  }

  @Delete(':userId')
  @Throttle({ short: { limit: 3, ttl: 1000 } })
  async removeUser(@Param('userId', ParseIntPipe) userId: number) {
    return this.xrayInstanceService.removeUser(userId);
  }

  @Post('restart-xray')
  @Throttle({ short: { limit: 2, ttl: 1000 } })
  async restartXray() {
    return this.xrayInstanceService.restartXray();
  }

  @Get('stats/traffic')
  @Throttle({ medium: { limit: 15, ttl: 60000 } })
  async getTrafficStats() {
    return this.xrayInstanceService.getTrafficStats();
  }

  @SkipThrottle()
  @Get('health')
  health() {
    return { status: 'ok' };
  }
}
