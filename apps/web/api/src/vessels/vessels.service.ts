import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import {
  AisError,
  awaitVesselPosition,
  discoverImoOnAis,
  emptyPosition,
  peekVesselPosition,
  searchVesselsByImo,
  searchVesselsByName,
  warmVesselPosition,
  type VesselHit,
  type VesselPosition,
} from './ais';
import { isValidImo, mmsiFromWikidata } from './imo-lookup';

const MMSI_KEY = 'imo_mmsi';

@Injectable()
export class VesselsService {
  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
  ) {}

  private async mmsiCache(): Promise<Record<string, string>> {
    const row = await this.prisma.setting.findUnique({ where: { key: MMSI_KEY } });
    const value = row?.value;
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, string>) : {};
  }

  private async rememberMmsi(imo: string, mmsi: string) {
    if (!imo || mmsi.replace(/\D/g, '').length !== 9) return;
    const current = await this.mmsiCache();
    if (current[imo] === mmsi) return;
    await this.prisma.setting.upsert({
      where: { key: MMSI_KEY },
      update: { value: { ...current, [imo]: mmsi } },
      create: { key: MMSI_KEY, value: { [imo]: mmsi } },
    });
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
      return await awaitVesselPosition(mmsi, await this.settings.resolveAisKey());
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

  async positionByImo(
    imo: string,
    hint?: { lat?: number; lng?: number },
  ): Promise<VesselPosition | null> {
    const digits = isValidImo(imo);
    if (!digits) return null;
    const key = await this.settings.resolveAisKey();

    const cachedMap = await this.mmsiCache();
    let mmsi = cachedMap[digits]?.replace(/\D/g, '') ?? '';
    let name: string | null = null;

    if (mmsi.length !== 9) {
      const wiki = await mmsiFromWikidata(digits).catch(() => null);
      if (wiki?.mmsi && wiki.mmsi.length === 9) {
        mmsi = wiki.mmsi;
        name = wiki.name;
      } else {
        name = wiki?.name ?? name;
      }
    }

    if (mmsi.length !== 9) {
      try {
        const results = await searchVesselsByImo(digits);
        const hit = results.find((row) => row.mmsi) ?? results[0];
        if (hit?.mmsi) {
          mmsi = String(hit.mmsi);
          name = hit.name || name;
        }
      } catch {
        /* Digitraffic is Baltic-only */
      }
    }

    if (mmsi.length !== 9 && key) {
      const found = await discoverImoOnAis(
        digits,
        key,
        hint?.lat != null && hint?.lng != null ? { lat: hint.lat, lng: hint.lng } : undefined,
      ).catch(() => null);
      if (found?.mmsi) {
        mmsi = found.mmsi;
        name = found.name || name;
        if (found.pos?.hasCoordinates) {
          await this.rememberMmsi(digits, mmsi);
          return { ...found.pos, imo: Number(digits), name: found.pos.name || name, mmsi: Number(mmsi) };
        }
      }
    }

    if (mmsi.length !== 9) {
      return name ? emptyPosition(0, { source: 'imo', name, imo: Number(digits) }) : null;
    }

    await this.rememberMmsi(digits, mmsi);
    const cached = peekVesselPosition(mmsi);
    if (!cached) warmVesselPosition(mmsi, key);
    const pos = cached ?? (await awaitVesselPosition(mmsi, key, 24_000));
    return {
      ...pos,
      imo: Number(digits),
      name: pos.name || name,
      mmsi: Number(mmsi),
    };
  }

  private rethrow(err: unknown): never {
    if (err instanceof AisError) {
      throw new HttpException(err.message, err.status);
    }
    throw err;
  }
}
