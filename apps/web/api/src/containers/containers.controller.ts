import { Controller, Get, Param } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ContainersService } from './containers.service';

@Throttle({ default: { limit: 12, ttl: 60000 } })
@Controller('containers')
export class ContainersController {
  constructor(private containers: ContainersService) {}

  @Get(':number')
  lookup(@Param('number') number: string) {
    return this.containers.lookup(number);
  }
}
