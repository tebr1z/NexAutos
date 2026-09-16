import { Injectable } from '@nestjs/common';
import { attachPortCoords, enrichKnownContainer, lookupCarrier, normalizeContainer } from './registry';
import { fetchLiveOcean } from './live';
import { VesselsService } from '../vessels/vessels.service';

@Injectable()
export class ContainersService {
  constructor(private vessels: VesselsService) {}

  async lookup(raw: string) {
    const base = attachPortCoords(enrichKnownContainer(lookupCarrier(raw)));
    let intel = base;
    try {
      const live = await fetchLiveOcean(base.containerNumber, base.carrier?.code);
      if (live) {
        intel = attachPortCoords({
          ...base,
          ...live,
          source: "live",
          trackingUrl: undefined,
        });
      }
    } catch {
      intel = base;
    }

    if ((intel.lat == null || intel.lng == null) && intel.vesselName) {
      try {
        const ais = await this.vessels.positionByName(intel.vesselName);
        if (ais?.hasCoordinates) {
          intel = {
            ...intel,
            lat: ais.latitude ?? intel.lat ?? undefined,
            lng: ais.longitude ?? intel.lng ?? undefined,
          };
        }
      } catch {
        /* AIS is optional enrichment */
      }
    }

    return {
      containerNumber: intel.containerNumber,
      validFormat: intel.validFormat,
      checkDigitOk: intel.checkDigitOk,
      prefix: intel.prefix,
      carrierCode: intel.carrier?.code,
      carrierName: intel.carrier?.name,
      carrierKind: intel.carrier?.kind,
      vesselName: intel.vesselName,
      voyageNumber: intel.voyageNumber,
      originPort: intel.originPort,
      destinationPort: intel.destinationPort,
      currentPort: intel.currentPort,
      currentCountry: intel.currentCountry,
      eta: intel.eta,
      containerStatus: intel.containerStatus,
      lat: intel.lat,
      lng: intel.lng,
      source: intel.source,
      note: intel.note,
      formatted: intel.validFormat
        ? `${intel.containerNumber.slice(0, 4)} ${intel.containerNumber.slice(4)}`
        : normalizeContainer(raw),
    };
  }
}
