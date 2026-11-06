import { BadRequestException, Injectable } from '@nestjs/common';
import { attachPortCoords, lookupCarrier, normalizeContainer } from './registry';
import { fetchLiveOcean } from './live';
import { VesselsService } from '../vessels/vessels.service';

@Injectable()
export class ContainersService {
  constructor(private vessels: VesselsService) {}

  async lookup(raw: string) {
    const base = lookupCarrier(raw);
    if (!base.validFormat || base.checkDigitOk === false) throw new BadRequestException('Konteyner nömrəsi və yoxlama rəqəmi düzgün deyil.');
    let intel = base;
    let positionKind = 'unknown';
    let positionUpdatedAt: string | undefined;
    let positionSource: string | undefined;
    let vesselImo: string | undefined;
    let vesselMmsi: string | undefined;
    let receivedLive = false;
    let carrierCode = base.carrier?.code;
    let carrierName = base.carrier?.name;
    try {
      const live = await fetchLiveOcean(base.containerNumber, base.carrier?.code);
      if (live) {
        receivedLive = true;
        carrierCode = live.carrierCode || carrierCode;
        carrierName = live.carrierName || carrierName;
        positionKind = live.positionKind || 'unknown';
        positionUpdatedAt = live.positionUpdatedAt;
        positionSource = live.positionSource;
        vesselImo = live.vesselImo;
        vesselMmsi = live.vesselMmsi;
        intel = attachPortCoords({
          ...base,
          ...live,
          source: "live",
          trackingUrl: undefined,
        });
        if (positionKind !== 'ais') {
          const port = attachPortCoords({ ...intel, lat: undefined, lng: undefined, destinationPort: undefined, originPort: undefined });
          port.destinationPort = intel.destinationPort;
          port.originPort = intel.originPort;
          intel = port;
          positionKind = port.lat != null && port.lng != null ? 'port' : 'unknown';
        }
      }
    } catch {
      intel = base;
    }

    if (receivedLive && positionKind !== 'ais' && (vesselImo || intel.vesselName)) {
      try {
        const ais = vesselImo ? await this.vessels.positionByImo(vesselImo) : await this.vessels.positionByName(intel.vesselName!);
        if (ais?.hasCoordinates) {
          positionKind = 'ais'; positionUpdatedAt = ais.lastUpdate || undefined; positionSource = ais.source;
          vesselImo = ais.imo ? String(ais.imo) : vesselImo;
          vesselMmsi = ais.mmsi ? String(ais.mmsi) : vesselMmsi;
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
      carrierCode,
      carrierName,
      carrierKind: intel.carrier?.kind,
      vesselName: intel.vesselName,
      vesselImo,
      vesselMmsi,
      positionKind,
      positionUpdatedAt,
      positionSource,
      trackingMessage: !process.env.SEARATES_API_KEY && !process.env.SHIPSGO_API_KEY && !process.env.SHIPSGO_AUTH_CODE
        ? 'Canlı konteyner izləməsi hələ aktiv deyil. Konteyner prefiksi yalnız sahib/daşıyıcı barədə ipucu verir; gəmi və mövqe hələ təsdiqlənməyib.'
        : !receivedLive ? 'Daşıyıcıdan təsdiqlənmiş səfər məlumatı alınmadı. Sonra yenidən yoxlayın.' : 'AIS son bildirilən gəmi mövqeyidir, konteyner GPS-i deyil. Liman nöqtəsi dəqiq gəmi mövqeyi sayılmır.',
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
