import { HttpException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AisError, emptyPosition, fetchVesselPosition, searchVesselsByImo, searchVesselsByName, type VesselHit, type VesselPosition } from './ais';
import { mmsiFromWikidata } from './imo-lookup';

@Injectable()
export class VesselsService {
  constructor(private config: ConfigService) {}

  private aisKey() {
    return (
      this.config.get<string>('AISSTREAM_API_KEY')?.trim() ||
      this.config.get<string>('AIS_API_KEY')?.trim() ||
      ''
    );
  }

  async search(name: string): Promise<{ results: VesselHit[] }> {
    try {
      return { results: await searchVesselsByName(name.trim()) };
    } catch (err) {
      this.rethrow(err);
    }
  }

  async position(mmsi: string): Promise<VesselPosition> {
    try {
      return await fetchVesselPosition(mmsi, this.aisKey());
    } catch (err) {
      this.rethrow(err);
    }
  }

  async positionByName(name: string): Promise<VesselPosition | null> {
    const { results } = await this.search(name);
    const needle = name.trim().toUpperCase();
    const exact =
      results.find((row) => row.name.toUpperCase() === needle) ??
      (results.length === 1 ? results[0] : null);
    if (!exact?.mmsi) return null;
    return this.position(String(exact.mmsi));
  }

  async positionByImo(imo: string): Promise<VesselPosition | null> {
    const digits = String(imo).replace(/\D/g, '');
    if (digits.length !== 7) return null;

    const wiki = await mmsiFromWikidata(digits).catch(() => null);
    let mmsi = wiki?.mmsi && wiki.mmsi.length === 9 ? wiki.mmsi : '';
    let name = wiki?.name ?? null;

    if (!mmsi) {
      try {
        const results = await searchVesselsByImo(digits);
        const hit = results.find((row) => row.mmsi) ?? results[0];
        if (hit?.mmsi) {
          mmsi = String(hit.mmsi);
          name = hit.name || name;
        }
      } catch {
        /* Digitrafffic yalnız Baltikdir — IMO tapılmasa davam */
      }
    }

    if (!mmsi) {
      return name ? emptyPosition(0, { source: 'imo', name, imo: Number(digits) }) : null;
    }

    try {
      const pos = await this.position(mmsi);
      return {
        ...pos,
        imo: Number(digits),
        name: pos.name || name,
        mmsi: Number(mmsi),
      };
    } catch (err) {
      if (err instanceof AisError && err.status === 401) this.rethrow(err);
      return emptyPosition(Number(mmsi), { source: 'imo', name, imo: Number(digits) });
    }
  }

  private rethrow(err: unknown): never {
    if (err instanceof AisError) {
      throw new HttpException(err.message, err.status);
    }
    throw err;
  }
}
