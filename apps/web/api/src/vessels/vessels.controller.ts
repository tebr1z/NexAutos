import { BadRequestException, Controller, Get, NotFoundException, Query } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { VesselQueryDto } from './dto';
import { VesselsService } from './vessels.service';

@SkipThrottle()
@Controller('vessels')
export class VesselsController {
  constructor(private vessels: VesselsService) {}

  @Get()
  lookup(@Query() query: VesselQueryDto) {
    const mmsi = query.mmsi?.trim();
    const imo = query.imo?.trim();
    const name = query.name?.trim();
    if (mmsi) return this.vessels.position(mmsi);
    if (imo) return this.vessels.positionByImo(imo).then((pos) => {
      if (!pos) throw new NotFoundException('No AIS record for this IMO.');
      return pos;
    });
    if (name) return this.vessels.search(name);
    throw new BadRequestException('Send a vessel name, IMO or 9-digit MMSI.');
  }
}
