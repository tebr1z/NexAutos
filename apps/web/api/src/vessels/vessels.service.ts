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
import { knownVesselByImo, knownVesselByMmsi, namesCompatible, nineDigitMmsi } from './known-vessels';

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

  private async forgetMmsi(imo: string) {
    const current = await this.mmsiCache();
    if (!current[imo]) return;
    const next = { ...current };
    delete next[imo];
    await this.prisma.setting.upsert({
      where: { key: MMSI_KEY },
      update: { value: next },
      create: { key: MMSI_KEY, value: next },
    });
  }

  private aisMatchesImo(pos: VesselPosition | null | undefined, imo: string, expectedName?: string | null): boolean {
    if (!pos) return false;
    if (pos.imo != null && Number(pos.imo) > 0 && Number(pos.imo) !== Number(imo)) return false;
    if (expectedName && pos.name && !namesCompatible(pos.name, expectedName)) return false;
    return true;
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
      const digits = nineDigitMmsi(mmsi);
      if (!digits) throw new AisError('MMSI 9 rəqəm olmalıdır.', 400);
      const known = knownVesselByMmsi(digits);
      const pos = await awaitVesselPosition(digits, await this.settings.resolveAisKey());
      if (known) {
        await this.rememberMmsi(known.imo, digits);
        return {
          ...pos,
          imo: pos.imo && Number(pos.imo) > 0 ? pos.imo : Number(known.imo),
          name: namesCompatible(pos.name, known.name) ? pos.name || known.name : known.name,
          mmsi: Number(digits),
        };
      }
      return pos;
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
    hint?: { lat?: number; lng?: number; mmsi?: string; name?: string },
  ): Promise<VesselPosition | null> {
    const digits = isValidImo(imo);
    if (!digits) return null;
    const key = await this.settings.resolveAisKey();
    const known = knownVesselByImo(digits);
    const hintMmsi = nineDigitMmsi(hint?.mmsi);
    const expectedName = known?.name || hint?.name?.trim() || null;

    const cachedMap = await this.mmsiCache();
    const cachedMmsi = nineDigitMmsi(cachedMap[digits]);

    let mmsi = hintMmsi || known?.mmsi || '';
    let name: string | null = known?.name || expectedName;

    if (mmsi.length !== 9 && cachedMmsi) {
      mmsi = cachedMmsi;
    }

    if (mmsi.length !== 9) {
      const wiki = await mmsiFromWikidata(digits).catch(() => null);
      if (wiki?.name && expectedName && !namesCompatible(wiki.name, expectedName)) {
        /* Wikipedia first-hit attached a different ship */
      } else if (wiki?.mmsi && wiki.mmsi.length === 9) {
        mmsi = wiki.mmsi;
        name = wiki.name || name;
      } else {
        name = wiki?.name ?? name;
      }
    }

    if (mmsi.length !== 9) {
      try {
        const results = await searchVesselsByImo(digits);
        const hit = results.find((row) => Number(row.imo) === Number(digits) && row.mmsi) ?? results[0];
        if (hit?.mmsi && (!hit.name || !expectedName || namesCompatible(hit.name, expectedName))) {
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
        if (found.pos?.hasCoordinates && this.aisMatchesImo(found.pos, digits, expectedName)) {
          await this.rememberMmsi(digits, mmsi);
          return { ...found.pos, imo: Number(digits), name: found.pos.name || name, mmsi: Number(mmsi) };
        }
      }
    }

    if (mmsi.length !== 9) {
      return name ? emptyPosition(0, { source: 'imo', name, imo: Number(digits) }) : null;
    }

    const live = peekVesselPosition(mmsi) ?? (await awaitVesselPosition(mmsi, key, 24_000).catch(() => null));
    if (live && !this.aisMatchesImo(live, digits, expectedName || name)) {
      await this.forgetMmsi(digits);
      if (known && known.mmsi !== mmsi) {
        return this.positionByImo(digits, { ...hint, mmsi: known.mmsi, name: known.name });
      }
      return emptyPosition(Number(known?.mmsi || 0), {
        source: 'imo',
        name: known?.name || expectedName || name,
        imo: Number(digits),
        mmsi: known?.mmsi ? Number(known.mmsi) : undefined,
      });
    }

    if (this.aisMatchesImo(live, digits, expectedName || name) || known?.mmsi === mmsi || hintMmsi === mmsi) {
      await this.rememberMmsi(digits, mmsi);
    }
    if (!live) warmVesselPosition(mmsi, key);
    const pos = live ?? emptyPosition(Number(mmsi), { source: 'imo', name, imo: Number(digits) });
    return {
      ...pos,
      imo: Number(digits),
      name: namesCompatible(pos.name, expectedName) ? pos.name || name : name,
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
