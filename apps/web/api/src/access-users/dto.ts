import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import type { Role } from '@prisma/client';

export const ASSIGNABLE_ACCESS_ROLES = ['ADMIN', 'MANAGER', 'STAFF', 'FREIGHT_USER'] as const;
export type AssignableAccessRole = (typeof ASSIGNABLE_ACCESS_ROLES)[number];

function toBool(value: unknown) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return value;
}

export class CreateAccessUserDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsIn(ASSIGNABLE_ACCESS_ROLES)
  role: AssignableAccessRole;
}

export class UpdateAccessUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @Transform(({ value }) => toBool(value))
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsIn(ASSIGNABLE_ACCESS_ROLES)
  role?: Role;
}
