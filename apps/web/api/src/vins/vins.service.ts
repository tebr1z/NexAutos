import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type NhtsaRow = {
  Make?: string;
  Model?: string;
  ModelYear?: string;
  DisplacementL?: string;
  EngineCylinders?: string;
  FuelTypePrimary?: string;
  TransmissionStyle?: string;
  BodyClass?: string;
  PlantCity?: string;
  PlantCountry?: string;
  ErrorCode?: string;
};

@Injectable()
export class VinsService {
  constructor(private prisma: PrismaService) {}

  async lookup(vin: string) {
    const clean = vin.replace(/\s/g, '').toUpperCase();
    const local = await this.prisma.vehicle.findUnique({ where: { vin: clean } });

    let decoded: NhtsaRow | null = null;
    try {
      const res = await fetch(
        `https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues/${clean}?format=json`,
      );
      const json = (await res.json()) as { Results?: NhtsaRow[] };
      decoded = json.Results?.[0] ?? null;
    } catch {
      decoded = null;
    }

    if (!local && (!decoded || decoded.ErrorCode === '400')) {
      throw new NotFoundException('VIN not found');
    }

    const engine = [decoded?.DisplacementL, decoded?.EngineCylinders]
      .filter(Boolean)
      .join(' L / ') || local?.engine;

    return {
      vin: clean,
      make: local?.make ?? decoded?.Make,
      model: local?.model ?? decoded?.Model,
      year: local?.year ?? (decoded?.ModelYear ? Number(decoded.ModelYear) : undefined),
      engine,
      mileage: local?.mileage ?? undefined,
      fuel: local?.fuel ?? decoded?.FuelTypePrimary,
      transmission: local?.transmission ?? decoded?.TransmissionStyle,
      exteriorColor: local?.exteriorColor,
      interiorColor: local?.interiorColor,
      bodyStyle: local?.bodyStyle ?? decoded?.BodyClass,
      auctionHouse: local?.auctionHouse,
      saleDate: local?.saleDate?.toISOString(),
      damageHistory: local?.damageHistory,
      photos: local?.photos ?? [],
      auctionPhotos: local?.auctionPhotos ?? [],
      status: local?.status,
      specs: {
        Plant: [decoded?.PlantCity, decoded?.PlantCountry].filter(Boolean).join(', '),
        ...(typeof local?.specs === 'object' && local?.specs ? (local.specs as Record<string, string>) : {}),
      },
    };
  }
}
