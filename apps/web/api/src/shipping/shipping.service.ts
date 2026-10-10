import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { fetchBidCarsLot } from './bidcars';
import { ShippingQuoteDto, ShippingRatesDto } from './dto';
import {
  AUCTIONS,
  BANDS,
  US_STATES,
  bandForPrice,
  cellKey,
  dgkEngineCode,
  emptyRateCells,
  knownState,
  parseYardPlace,
  type AuctionCode,
} from './zones';
import { auctionFeeBreakdown } from './auction-fees';

const KEY = 'shipping_rates';

type Stored = {
  tirUsd: number;
  cells: Record<string, number | null>;
  yards: Record<string, string>;
  seedVersion?: string;
};

function yardNameFromSlug(slug: string) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

const YARD_DIRECTIONS = new Set(['north', 'south', 'east', 'west', 'central']);

function comparableYardSlug(slug: string) {
  return slug
    .split('-')
    .map((part) => (part === 'ft' ? 'fort' : part))
    .filter(Boolean)
    .join('-');
}

function baseYardSlug(slug: string) {
  return comparableYardSlug(slug)
    .split('-')
    .filter((part) => !YARD_DIRECTIONS.has(part))
    .join('-');
}

function resolveYardRate(
  table: Stored,
  state: string,
  auction: AuctionCode,
  band: string,
  requestedSlug: string,
) {
  const exactKey = `${state}:${auction}:${requestedSlug}:${band}`;
  const exactRate = Number(table.cells[exactKey]);
  if (exactRate > 0) return { rate: exactRate, key: exactKey, slug: requestedSlug, exact: true };

  const prefix = `${state}:${auction}:`;
  const suffix = `:${band}`;
  const candidates = Object.entries(table.cells)
    .map(([key, rawRate]) => {
      if (!key.startsWith(prefix) || !key.endsWith(suffix)) return null;
      const slug = key.slice(prefix.length, -suffix.length);
      const rate = Number(rawRate);
      return slug && rate > 0 ? { key, slug, rate } : null;
    })
    .filter((row): row is { key: string; slug: string; rate: number } => Boolean(row));

  const comparable = comparableYardSlug(requestedSlug);
  const same = candidates.find((row) => comparableYardSlug(row.slug) === comparable);
  if (same) return { ...same, exact: false };

  const base = baseYardSlug(requestedSlug);
  const baseExact = candidates.find((row) => comparableYardSlug(row.slug) === base);
  if (baseExact) return { ...baseExact, exact: false };

  const baseMatches = candidates.filter((row) => baseYardSlug(row.slug) === base);
  if (baseMatches.length === 1) return { ...baseMatches[0], exact: false };
  return null;
}

@Injectable()
export class ShippingService {
  constructor(private prisma: PrismaService) {}

  meta() {
    return { bands: BANDS, auctions: AUCTIONS, states: US_STATES };
  }

  async rates(): Promise<Stored> {
    const row = await this.prisma.setting.findUnique({ where: { key: KEY } });
    const value = (row?.value ?? {}) as Partial<Stored>;
    const cells = { ...emptyRateCells(), ...(value.cells ?? {}) };
    for (const [key, rate] of Object.entries(value.cells ?? {})) {
      if (!key.endsWith(':d') || Number(rate) <= 0) continue;
      const mergedKey = `${key.slice(0, -1)}c`;
      if (Number(cells[mergedKey]) <= 0) cells[mergedKey] = Number(rate);
    }
    return {
      tirUsd: Number(value.tirUsd) >= 0 ? Number(value.tirUsd) : 200,
      cells,
      yards: value.yards ?? {},
      seedVersion: value.seedVersion,
    };
  }

  async catalog(auctionFilter?: string, stateFilter?: string) {
    const table = await this.rates();
    const auction = auctionFilter?.trim().toUpperCase();
    const state = stateFilter?.trim().toUpperCase();
    const rows = new Map<
      string,
      {
        auction: AuctionCode;
        state: string;
        stateName?: string;
        yard: string;
        yardSlug: string;
        rates: Record<string, number | null>;
      }
    >();

    for (const [key, rawRate] of Object.entries(table.cells)) {
      const match = key.match(/^([A-Z]{2}):(COPART|IAAI):([a-z0-9-]+):([abc])$/);
      const rate = Number(rawRate);
      if (!match || !Number.isFinite(rate) || rate <= 0) continue;
      const [, rowState, rowAuction, slug, band] = match;
      if (auction && rowAuction !== auction) continue;
      if (state && rowState !== state) continue;
      const prefix = `${rowState}:${rowAuction}:${slug}`;
      const current = rows.get(prefix) ?? {
        auction: rowAuction as AuctionCode,
        state: rowState,
        stateName: US_STATES.find((item) => item.code === rowState)?.name,
        yard: table.yards[prefix] || yardNameFromSlug(slug),
        yardSlug: slug,
        rates: { a: null, b: null, c: null },
      };
      current.rates[band] = rate;
      rows.set(prefix, current);
    }

    return {
      tirUsd: table.tirUsd,
      bands: BANDS,
      auctions: AUCTIONS,
      seedVersion: table.seedVersion,
      rows: [...rows.values()].sort(
        (left, right) => left.state.localeCompare(right.state) || left.yard.localeCompare(right.yard),
      ),
    };
  }

  async saveRates(dto: ShippingRatesDto) {
    const current = await this.rates();
    const next: Stored = {
      tirUsd: dto.tirUsd ?? current.tirUsd,
      cells: { ...current.cells, ...dto.cells },
      yards: current.yards,
      seedVersion: current.seedVersion,
    };
    await this.prisma.setting.upsert({
      where: { key: KEY },
      update: { value: next },
      create: { key: KEY, value: next },
    });
    return next;
  }

  async quote(dto: ShippingQuoteDto) {
    const lot = dto.url?.trim() ? await fetchBidCarsLot(dto.url) : null;
    const place = parseYardPlace(dto.yard) || parseYardPlace(lot?.yard) || parseYardPlace(lot?.location) || parseYardPlace(lot?.shippingFrom);
    const state = knownState(dto.state || place?.state || lot?.state);
    const auctionRaw = (dto.auction || lot?.auction || 'OTHER').toUpperCase();
    const auction: AuctionCode | 'OTHER' = auctionRaw === 'COPART' || auctionRaw === 'IAAI' ? auctionRaw : 'OTHER';
    if (!state) throw new BadRequestException('Ştat tapılmadı. Bid.cars linkini yoxlayın.');
    if (auction === 'OTHER') throw new BadRequestException('Hərrac Copart və ya IAAI olmalıdır.');
    if (!place?.slug) throw new BadRequestException('Yard tapılmadı. Lotda Sun Valley, Los Angeles kimi lokasiya olmalıdır.');
    const fee = auctionFeeBreakdown(dto.priceUsd, auction, dto.titleKind);
    const suppliedAuctionFee = Number(dto.auctionFeeUsd);
    const auctionFeeUsd = dto.auctionFeeUsd != null && Number.isFinite(suppliedAuctionFee) ? suppliedAuctionFee : fee.totalUsd;
    const invoiceUsd = dto.priceUsd + auctionFeeUsd;
    const band = bandForPrice(invoiceUsd);
    const table = await this.rates();
    const key = cellKey(state, auction, band.id, place.slug);
    const stateKey = cellKey(state, auction, band.id);
    const yardMatch = resolveYardRate(table, state, auction, band.id, place.slug);
    const yardRate = Number(yardMatch?.rate);
    const stateRate = Number(table.cells[stateKey]);
    const ocean = yardRate > 0 ? yardRate : stateRate > 0 ? stateRate : null;
    const rateSource = yardRate > 0 ? (yardMatch?.exact ? 'yard' : 'yard-alias') : stateRate > 0 ? 'state' : null;
    const stateName = US_STATES.find((row) => row.code === state)?.name;
    const freightUsd = ocean != null ? ocean + table.tirUsd : null;
    return {
      lot,
      state,
      stateName,
      yard: place.yard,
      yardSlug: place.slug,
      matchedYard: yardMatch ? table.yards[yardMatch.key.slice(0, yardMatch.key.lastIndexOf(':'))] || yardNameFromSlug(yardMatch.slug) : null,
      matchedYardSlug: yardMatch?.slug ?? null,
      auction,
      band,
      priceUsd: dto.priceUsd,
      auctionFeeUsd,
      auctionFeeSource: dto.auctionFeeUsd != null ? 'provided' : 'calculated',
      auctionFee: fee,
      invoiceUsd,
      bandBasisUsd: invoiceUsd,
      year: lot?.year,
      engineCc: lot?.engineCc,
      fuel: lot?.fuel,
      dgkEngineCode: dgkEngineCode(lot?.fuel),
      oceanUsd: ocean,
      tirUsd: table.tirUsd,
      freightUsd,
      totalUsd: freightUsd != null ? freightUsd + fee.totalUsd : null,
      missing: ocean == null,
      rateSource,
      cellKey: key,
    };
  }
}
