import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAccessUserDto, UpdateAccessUserDto } from './dto';

type Actor = { id: string; role: Role };
const ACCESS_ROLES: Role[] = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF', 'FREIGHT_USER'];

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
      where: { role: { in: ACCESS_ROLES } },
      select,
      orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async create(dto: CreateAccessUserDto, actor: Actor) {
    this.assertCanAssign(actor, dto.role);
    const email = dto.email.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new ConflictException('Bu e-poçt artıq istifadə olunur.');
    }
    return this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        email,
        passwordHash: await bcrypt.hash(dto.password, 12),
        role: dto.role,
        isActive: true,
      },
      select,
    });
  }

  async update(id: string, dto: UpdateAccessUserDto, actor: Actor) {
    const user = await this.prisma.user.findFirst({ where: { id, role: { in: ACCESS_ROLES } } });
    if (!user) throw new NotFoundException('İstifadəçi tapılmadı.');
    if (user.role === 'SUPER_ADMIN') throw new ForbiddenException('Baş administrator hesabı qorunur.');
    if (actor.role !== 'SUPER_ADMIN' && user.role === 'ADMIN') {
      throw new ForbiddenException('Administrator hesabını yalnız baş administrator dəyişə bilər.');
    }
    if (dto.role) this.assertCanAssign(actor, dto.role);
    if (actor.id === id && dto.isActive === false) {
      throw new ForbiddenException('Öz girişinizi bağlaya bilməzsiniz.');
    }
    if (actor.id === id && dto.role && dto.role !== user.role) {
      throw new ForbiddenException('Öz rolunuzu dəyişə bilməzsiniz.');
    }
    const roleChanged = Boolean(dto.role && dto.role !== user.role);
    return this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.password ? { passwordHash: await bcrypt.hash(dto.password, 12) } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.role ? { role: dto.role } : {}),
        ...(dto.isActive === false || dto.password || roleChanged ? { refreshTokens: { deleteMany: {} } } : {}),
      },
      select,
    });
  }

  private assertCanAssign(actor: Actor, role: Role) {
    if (!['ADMIN', 'MANAGER', 'STAFF', 'FREIGHT_USER'].includes(role)) {
      throw new ForbiddenException('Bu rol təyin edilə bilməz.');
    }
    if (role === 'ADMIN' && actor.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Tam giriş rolunu yalnız baş administrator verə bilər.');
    }
  }
}
