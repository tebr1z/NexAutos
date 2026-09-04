import { Controller, Get, Param } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ContainersService } from './containers.service';

@SkipThrottle()
@Controller('containers')
export class ContainersController {
  constructor(private containers: ContainersService) {}

  @Get(':number')
  lookup(@Param('number') number: string) {
    return this.containers.lookup(number);
  }
}
