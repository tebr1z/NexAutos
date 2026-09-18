import { BadRequestException, Controller, Get, NotFoundException, Query } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { VesselQueryDto } from './dto';
import { isValidImo } from './imo-lookup';
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
    if (imo) {
      if (!isValidImo(imo)) {
        throw new BadRequestException('IMO səhvdir. 0000000 olmaz — gəminin real 7 rəqəmli IMO-sunu yazın.');
      }
      return this.vessels.positionByImo(imo, {
        lat: query.nearLat ? Number(query.nearLat) : undefined,
        lng: query.nearLng ? Number(query.nearLng) : undefined,
      }).then((pos) => {
        if (!pos) throw new NotFoundException('Bu IMO üçün AIS tapılmadı. MMSI/AIS hələ gəlmir — əl ilə pin yazın.');
        return pos;
      });
    }
    if (name) return this.vessels.search(name);
    throw new BadRequestException('Send a vessel name, IMO or 9-digit MMSI.');
  }
}
