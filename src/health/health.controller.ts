import { Controller, Get } from "@nestjs/common";
import { HealthService } from "./health.service";
import { Public } from "../core/decorators/public.decorator";

@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  check() {
    return this.healthService.check();
  }

  @Public()
  @Get("live")
  liveness() {
    return { status: "ok" };
  }
}
