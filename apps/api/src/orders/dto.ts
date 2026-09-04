import { AuctionHouse, Prisma } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsArray, IsEmail, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateOrderDto {
  @IsString()
  customerName: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  vin: string;

  @IsOptional()
  @IsEnum(AuctionHouse)
  auctionHouse?: AuctionHouse;

  @IsOptional()
  @IsString()
  make?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  trackingCode?: string;

  @IsOptional()
  @IsString()
  containerNumber?: string;

  @IsOptional()
  @IsString()
  originPort?: string;

  @IsOptional()
  @IsString()
  destinationPort?: string;

  @IsOptional()
  @IsString()
  currentPort?: string;

  @IsOptional()
  @IsString()
  currentCountry?: string;

  @IsOptional()
  @IsArray()
  transitPorts?: unknown[];

  @IsOptional()
  @IsString()
  vesselName?: string;

  @IsOptional()
  @IsString()
  vesselImo?: string;

  @IsOptional()
  @IsString()
  eta?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  currentTransitIndex?: number;
}

export class UpdateStatusDto {
  @IsString()
  status: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  currentTransitIndex?: number;
}

export class UpdateVoyageDto {
  @IsOptional()
  @IsString()
  containerNumber?: string;

  @IsOptional()
  @IsString()
  vesselName?: string;

  @IsOptional()
  @IsString()
  vesselImo?: string;

  @IsOptional()
  @IsString()
  originPort?: string;

  @IsOptional()
  @IsString()
  destinationPort?: string;

  @IsOptional()
  @IsString()
  currentPort?: string;

  @IsOptional()
  @IsString()
  currentCountry?: string;

  @IsOptional()
  @IsArray()
  transitPorts?: unknown[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  currentTransitIndex?: number;

  @IsOptional()
  @IsString()
  voyageNumber?: string;

  @IsOptional()
  @IsString()
  trackingCode?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export type Decimal = Prisma.Decimal;
