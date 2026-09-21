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

type Stored = { tirUsd: number; cells: Record<string, number | null> };

@Injectable()
export class ShippingService {
  constructor(private prisma: PrismaService) {}

  meta() {
    return { bands: BANDS, auctions: AUCTIONS, states: US_STATES };
  }

  async rates(): Promise<Stored> {
    const row = await this.prisma.setting.findUnique({ where: { key: KEY } });
    const value = (row?.value ?? {}) as Partial<Stored>;
    return {
      tirUsd: Number(value.tirUsd) >= 0 ? Number(value.tirUsd) : 200,
      cells: { ...emptyRateCells(), ...(value.cells ?? {}) },
    };
  }

  async saveRates(dto: ShippingRatesDto) {
    const current = await this.rates();
    const next: Stored = {
      tirUsd: dto.tirUsd ?? current.tirUsd,
      cells: { ...current.cells, ...dto.cells },
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
    const band = bandForPrice(dto.priceUsd);
    const table = await this.rates();
    if (!state) throw new BadRequestException('Ştat tapılmadı. Bid.cars linkini yoxlayın.');
    if (auction === 'OTHER') throw new BadRequestException('Hərrac Copart və ya IAAI olmalıdır.');
    if (!place?.slug) throw new BadRequestException('Yard tapılmadı. Lotda Sun Valley, Los Angeles kimi lokasiya olmalıdır.');
    const key = cellKey(state, auction, band.id, place.slug);
    const oceanRaw = table.cells[key];
    const ocean = oceanRaw != null && Number(oceanRaw) > 0 ? Number(oceanRaw) : null;
    const stateName = US_STATES.find((row) => row.code === state)?.name;
    const fee = auctionFeeBreakdown(dto.priceUsd, auction, dto.titleKind);
    const freightUsd = ocean != null ? ocean + table.tirUsd : null;
    return {
      lot,
      state,
      stateName,
      yard: place.yard,
      yardSlug: place.slug,
      auction,
      band,
      priceUsd: dto.priceUsd,
      auctionFeeUsd: fee.totalUsd,
      auctionFee: fee,
      invoiceUsd: dto.priceUsd + fee.totalUsd,
      year: lot?.year,
      engineCc: lot?.engineCc,
      fuel: lot?.fuel,
      dgkEngineCode: dgkEngineCode(lot?.fuel),
      oceanUsd: ocean,
      tirUsd: table.tirUsd,
      freightUsd,
      totalUsd: freightUsd != null ? freightUsd + fee.totalUsd : null,
      missing: ocean == null,
      cellKey: key,
    };
  }
}
