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
  type AuctionCode,
} from './zones';
import { auctionFeeUsd } from './auction-fees';

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
    const state = knownState(dto.state || lot?.state);
    const auctionRaw = (dto.auction || lot?.auction || 'OTHER').toUpperCase();
    const auction: AuctionCode | 'OTHER' = auctionRaw === 'COPART' || auctionRaw === 'IAAI' ? auctionRaw : 'OTHER';
    const band = bandForPrice(dto.priceUsd);
    const table = await this.rates();
    if (!state) throw new BadRequestException('Ştat tapılmadı. Bid.cars linkini yoxlayın.');
    if (auction === 'OTHER') throw new BadRequestException('Hərrac Copart və ya IAAI olmalıdır.');
    const oceanRaw = table.cells[cellKey(state, auction, band.id)];
    const ocean = oceanRaw != null && Number(oceanRaw) > 0 ? Number(oceanRaw) : null;
    const stateName = US_STATES.find((row) => row.code === state)?.name;
    const feeUsd = auctionFeeUsd(dto.priceUsd, auction);
    const freightUsd = ocean != null ? ocean + table.tirUsd : null;
    return {
      lot,
      state,
      stateName,
      auction,
      band,
      priceUsd: dto.priceUsd,
      auctionFeeUsd: feeUsd,
      invoiceUsd: dto.priceUsd + feeUsd,
      year: lot?.year,
      engineCc: lot?.engineCc,
      fuel: lot?.fuel,
      dgkEngineCode: dgkEngineCode(lot?.fuel),
      oceanUsd: ocean,
      tirUsd: table.tirUsd,
      freightUsd,
      totalUsd: freightUsd != null ? freightUsd + feeUsd : null,
      missing: ocean == null,
      cellKey: cellKey(state, auction, band.id),
    };
  }
}
