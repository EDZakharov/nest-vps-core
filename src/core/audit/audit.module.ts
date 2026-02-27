import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { AuditService } from "./audit.service";

@Module({
  imports: [HttpModule],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
