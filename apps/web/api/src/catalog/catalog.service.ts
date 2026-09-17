import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogCarDto } from './dto';

type CatalogStore = {
  findMany: (args: Record<string, unknown>) => Promise<unknown[]>;
  create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  update: (args: Record<string, unknown>) => Promise<unknown>;
  delete: (args: { where: { id: string } }) => Promise<unknown>;
};

function store(prisma: PrismaService): CatalogStore | null {
  const client = prisma as PrismaService & { catalogCar?: CatalogStore };
  return client.catalogCar ?? null;
}

function imageUrl(raw: string) {
  const value = raw.trim();
  if (!/^https?:\/\//i.test(value)) {
    throw new BadRequestException('Şəkil ünvanı http və ya https ilə başlamalıdır.');
  }
  return value;
}

function data(dto: CatalogCarDto) {
  return {
    title: dto.title.trim(),
    year: dto.year ?? null,
    make: dto.make?.trim() || null,
    model: dto.model?.trim() || null,
    auction: dto.auction?.trim() || null,
    color: dto.color?.trim() || null,
    priceUsd: dto.priceUsd ?? null,
    priceLabel: dto.priceLabel?.trim() || null,
    imageUrl: imageUrl(dto.imageUrl),
    description: dto.description?.trim() || null,
    published: dto.published ?? true,
    sortOrder: dto.sortOrder ?? 0,
  };
}

@Injectable()
export class CatalogService {
  constructor(private prisma: PrismaService) {}

  private db() {
    const catalog = store(this.prisma);
    if (!catalog) throw new ServiceUnavailableException('Catalog store unavailable');
    return catalog;
  }

  listPublished() {
    return this.db().findMany({
      where: { published: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  listAll() {
    return this.db().findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  create(dto: CatalogCarDto) {
    return this.db().create({ data: data(dto) });
  }

  async update(id: string, dto: CatalogCarDto) {
    try {
      return await this.db().update({ where: { id }, data: data(dto) });
    } catch {
      throw new NotFoundException('Maşın tapılmadı');
    }
  }

  async remove(id: string) {
    try {
      await this.db().delete({ where: { id } });
      return { ok: true, id };
    } catch {
      throw new NotFoundException('Maşın tapılmadı');
    }
  }
}
