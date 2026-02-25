import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';

import { AddUserDto } from './dto/add-user.dto';
import { XrayInstanceService } from './xray-instance.service';

@Controller('xray/users')
export class XrayInstanceController {
  constructor(private readonly xrayInstanceService: XrayInstanceService) {}

  @Post()
  async addUser(@Body() dto: AddUserDto) {
    return this.xrayInstanceService.addUser(dto.email, dto.uuid);
  }

  @Get()
  async getAllUsers() {
    return this.xrayInstanceService.getAllUsers();
  }

  @Get(':email/link')
  async generateLink(@Param('email') email: string) {
    return this.xrayInstanceService.generateLink(email);
  }

  @Delete(':email')
  async removeUser(@Param('email') email: string) {
    return this.xrayInstanceService.removeUser(email);
  }

  @Get('stats/traffic')
  async getTrafficStats() {
    return this.xrayInstanceService.getTrafficStats();
  }
}
