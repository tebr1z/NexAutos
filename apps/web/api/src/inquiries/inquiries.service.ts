import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInquiryDto } from './dto';

type InquiryStore = {
  create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  findMany: (args: Record<string, unknown>) => Promise<unknown[]>;
  update: (args: Record<string, unknown>) => Promise<unknown>;
};

function store(prisma: PrismaService): InquiryStore | null {
  const client = prisma as PrismaService & { contactInquiry?: InquiryStore };
  return client.contactInquiry ?? null;
}

@Injectable()
export class InquiriesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateInquiryDto) {
    const db = store(this.prisma);
    if (!db) throw new ServiceUnavailableException('Inquiries store unavailable');
    try {
      return await db.create({
        data: {
          name: dto.name.trim(),
          email: (dto.email ?? '').trim(),
          phone: dto.phone?.trim() || null,
          body: dto.body.trim(),
        },
      });
    } catch {
      throw new ServiceUnavailableException('Inquiries store unavailable');
    }
  }

  async list() {
    const db = store(this.prisma);
    if (!db) throw new ServiceUnavailableException('Inquiries store unavailable');
    try {
      return await db.findMany({
        orderBy: { createdAt: 'desc' },
        take: 400,
      });
    } catch {
      throw new ServiceUnavailableException('Inquiries store unavailable');
    }
  }

  async markRead(id: string) {
    const db = store(this.prisma);
    if (!db) throw new ServiceUnavailableException('Inquiries store unavailable');
    try {
      return await db.update({
        where: { id },
        data: { isRead: true },
      });
    } catch {
      throw new ServiceUnavailableException('Inquiries store unavailable');
    }
  }
}
