import { Controller, Get, Param } from '@nestjs/common';
import { VinsService } from './vins.service';

@Controller('vins')
export class VinsController {
  constructor(private vins: VinsService) {}

  @Get(':vin')
  lookup(@Param('vin') vin: string) {
    return this.vins.lookup(vin);
  }
}
