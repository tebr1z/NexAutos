import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFreightUserDto, UpdateFreightUserDto } from './dto';

const select = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

@Injectable()
export class AccessUsersService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.user.findMany({
      where: { role: 'FREIGHT_USER' },
      select,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateFreightUserDto) {
    const email = dto.email.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new ConflictException('Bu e-poçt artıq istifadə olunur.');
    }
    return this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        email,
        passwordHash: await bcrypt.hash(dto.password, 12),
        role: 'FREIGHT_USER',
        isActive: true,
      },
      select,
    });
  }

  async update(id: string, dto: UpdateFreightUserDto) {
    const user = await this.prisma.user.findFirst({ where: { id, role: 'FREIGHT_USER' } });
    if (!user) throw new NotFoundException('Yol pulu istifadəçisi tapılmadı.');
    return this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.password ? { passwordHash: await bcrypt.hash(dto.password, 12) } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.isActive === false || dto.password ? { refreshTokens: { deleteMany: {} } } : {}),
      },
      select,
    });
  }
}
