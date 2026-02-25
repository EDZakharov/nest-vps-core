import { Module } from '@nestjs/common';

import { XrayConfigService } from './xray-config.service';
import { XrayInstanceController } from './xray-instance.controller';
import { XrayInstanceService } from './xray-instance.service';

@Module({
  controllers: [XrayInstanceController],
  providers: [XrayInstanceService, XrayConfigService],
  exports: [XrayInstanceService],
})
export class XrayInstanceModule {}
