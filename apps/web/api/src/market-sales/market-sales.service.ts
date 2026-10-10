import { Injectable, ServiceUnavailableException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MarketSaleBatchDto, MarketSaleItemDto, MarketSaleQueryDto } from './dto';

function text(value?: string) {
  return value?.trim() || null;
}

@Injectable()
export class MarketSalesService {
  constructor(private prisma: PrismaService, private config: ConfigService) {}

  authorizeCollector(candidate?: string) {
    const expected = this.config.get<string>('MARKET_COLLECTOR_KEY')?.trim();
    if (!expected) throw new ServiceUnavailableException('MARKET_COLLECTOR_KEY serverdə qurulmayıb.');
    const left = Buffer.from(candidate || '');
    const right = Buffer.from(expected);
    if (left.length !== right.length || !timingSafeEqual(left, right)) throw new UnauthorizedException('Collector açarı yanlışdır.');
  }

  private data(row: MarketSaleItemDto) {
    let host = '';
    try { host = new URL(row.url).hostname.toLowerCase(); } catch { throw new BadRequestException('BidCars URL düzgün deyil.'); }
    if (host !== 'bid.cars' && host !== 'www.bid.cars') throw new BadRequestException('Yalnız BidCars məlumatı qəbul edilir.');
    return {
      sourceKey: row.key.trim(), sourceUrl: row.url.trim(), lotNumber: text(row.lot), vin: text(row.vin)?.toUpperCase() || null,
      auction: text(row.auction)?.toUpperCase() || null, make: text(row.make), model: text(row.model), trim: text(row.trim),
      year: row.year ?? null, engineCc: row.engineCc ?? null, engineLabel: text(row.engineLabel), fuel: text(row.fuel), color: text(row.color),
      location: text(row.location), state: text(row.state)?.toUpperCase() || null, mileageMi: row.mileageMi ?? null,
      mileageKm: row.mileageKm ?? null, finalBidUsd: row.finalBidUsd, saleDate: row.saleDate ? new Date(row.saleDate) : null,
      observedAt: new Date(row.observedAt),
    };
  }

  async ingest(key: string | undefined, dto: MarketSaleBatchDto) {
    this.authorizeCollector(key);
    const rows = dto.records || [];
    await this.prisma.$transaction(rows.map((row) => {
      const data = this.data(row);
      return this.prisma.marketSale.upsert({ where: { sourceKey: data.sourceKey }, create: data, update: data });
    }));
    return { ok: true, accepted: rows.length };
  }

  async list(query: MarketSaleQueryDto) {
    const days = query.days ?? 30;
    const since = new Date(Date.now() - days * 86400000);
    const yearFrom = query.yearFrom ?? query.year;
    const yearTo = query.yearTo ?? query.year;
    const mileageKmFrom = query.mileageKmFrom;
    const mileageKmTo = query.mileageKmTo ?? 300000;
    if (yearFrom && yearTo && yearFrom > yearTo) throw new BadRequestException('Başlanğıc ili son ildən böyük ola bilməz.');
    if (mileageKmFrom !== undefined && mileageKmFrom > mileageKmTo) {
      throw new BadRequestException('Minimum yürüş maksimum yürüşdən böyük ola bilməz.');
    }
    const mileageMiFrom = mileageKmFrom === undefined ? undefined : Math.ceil(mileageKmFrom / 1.609344);
    const mileageMiTo = Math.floor(mileageKmTo / 1.609344);
    const selectedTrims = String(query.trims || '')
      .split('||')
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 50);
    const mileageFilter: Prisma.MarketSaleWhereInput = mileageKmFrom !== undefined || query.mileageKmTo !== undefined
      ? {
          OR: [
            { mileageKm: { gte: mileageKmFrom, lte: mileageKmTo } },
            { mileageKm: null, mileageMi: { gte: mileageMiFrom, lte: mileageMiTo } },
          ],
        }
      : {
          AND: [
            { OR: [{ mileageKm: null }, { mileageKm: { lte: 300000 } }] },
            { OR: [{ mileageKm: { not: null } }, { mileageMi: null }, { mileageMi: { lte: 186411 } }] },
          ],
        };
    const where: Prisma.MarketSaleWhereInput = {
      observedAt: { gte: since },
      AND: [mileageFilter],
      ...(query.make ? { make: { equals: query.make, mode: 'insensitive' } } : {}),
      ...(query.model ? { model: { equals: query.model, mode: 'insensitive' } } : {}),
      ...(selectedTrims.length
        ? { trim: { in: selectedTrims, mode: 'insensitive' } }
        : query.trim ? { trim: { equals: query.trim, mode: 'insensitive' } } : {}),
      ...(query.fuel ? { fuel: { equals: query.fuel, mode: 'insensitive' } } : {}),
      ...(query.auction ? { auction: query.auction.toUpperCase() } : {}),
      ...(yearFrom || yearTo ? { year: { gte: yearFrom, lte: yearTo } } : {}),
      ...(query.engineCc ? { engineCc: { gte: query.engineCc - 100, lte: query.engineCc + 100 } } : {}),
    };
    const [rows, total, facets] = await Promise.all([
      this.prisma.marketSale.findMany({ where, orderBy: [{ saleDate: 'desc' }, { observedAt: 'desc' }], take: query.limit ?? 200 }),
      this.prisma.marketSale.count({ where }),
      this.prisma.marketSale.findMany({
        where: { observedAt: { gte: since }, AND: [mileageFilter] },
        select: { make: true, model: true, trim: true, fuel: true, auction: true, year: true, engineCc: true },
      }),
    ]);
    return { rows, total, days, facets };
  }
}
