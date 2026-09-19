import type { AuctionHouse, Prisma } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEmail, IsEnum, IsInt, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

const AUCTION_HOUSES = {
  COPART: 'COPART',
  IAAI: 'IAAI',
  MANHEIM: 'MANHEIM',
  OTHER: 'OTHER',
} as const;

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
  @IsEnum(AUCTION_HOUSES)
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
  @Type(() => Number)
  @IsNumber()
  mapLat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  mapLng?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  currentTransitIndex?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderPhotoDto)
  photos?: OrderPhotoDto[];
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
  eta?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  mapLat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  mapLng?: number;

  @IsOptional()
  @IsString()
  voyageNumber?: string;

  @IsOptional()
  @IsString()
  trackingCode?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderPhotoDto)
  photos?: OrderPhotoDto[];
}

export class OrderPhotoDto {
  @IsString()
  url: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  caption?: string;
}

export class UpdateInsuranceDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  docSeries?: string;

  @IsOptional()
  @IsString()
  trustee?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsBoolean()
  notify?: boolean;
}

export class PrunePhotosDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keepIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keepUrls?: string[];
}

export type Decimal = Prisma.Decimal;
