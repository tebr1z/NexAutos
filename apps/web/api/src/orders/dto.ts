import type { AuctionHouse, Prisma } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDateString, IsEmail, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUrl, Matches, Max, MaxLength, Min, ValidateIf, ValidateNested } from 'class-validator';

const AUCTION_HOUSES = {
  COPART: 'COPART',
  IAAI: 'IAAI',
  MANHEIM: 'MANHEIM',
  OTHER: 'OTHER',
} as const;

export class TrackingDetailsDto {
  @IsOptional()
  @ValidateIf((_object, value) => value !== '')
  @IsUrl({ protocols: ['https'], require_protocol: true, disallow_auth: true })
  @MaxLength(2000)
  carrierTrackingUrl?: string | null;

  @IsOptional()
  @IsIn(['USA', 'KOREA', 'CHINA', 'OTHER'])
  originCountry?: string | null;

  @IsOptional()
  @IsIn(['UNPAID', 'PARTIAL', 'PAID'])
  freightPaymentStatus?: string;

  @IsOptional()
  @IsIn(['UNSET', 'POWER_OF_ATTORNEY', 'SIGNIFY'])
  documentMethod?: string;

  @IsOptional()
  @IsIn(['PENDING', 'COMPLETED'])
  documentStatus?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  purchasePaymentPercent?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1000000)
  commissionUsd?: number | null;

  @IsOptional()
  @ValidateIf((_object, value) => value !== '')
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  containerOpeningDate?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1950)
  @Max(2100)
  year?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  lotNumber?: string | null;
}

export class CreateOrderDto extends TrackingDetailsDto {
  @IsOptional()
  @IsString()
  customerName?: string;

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
  @IsString()
  phone?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  currentTransitIndex?: number;
}

export class UpdateVoyageDto extends TrackingDetailsDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  vin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  make?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  model?: string;

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
  phone?: string;

  @IsOptional()
  @IsString()
  customerName?: string;

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
  amountUsd?: string;

  @IsOptional()
  @IsString()
  amountAzn?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsBoolean()
  notify?: boolean;

  @IsOptional()
  @IsString()
  vin?: string;

  @IsOptional()
  @IsString()
  make?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  year?: number;
}

export class CreateInsuranceDto {
  @IsString()
  firstName: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsString()
  phone: string;

  @IsOptional()
  @IsString()
  docSeries?: string;

  @IsOptional()
  @IsString()
  trustee?: string;

  @IsOptional()
  @IsString()
  amountUsd?: string;

  @IsOptional()
  @IsString()
  amountAzn?: string;

  @IsOptional()
  @IsString()
  vin?: string;

  @IsOptional()
  @IsString()
  make?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  year?: number;
}

export class CustomerSmsDto {
  @IsOptional()
  @IsString()
  kind?: string;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsString()
  phone?: string;
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

export class CreateOrderReviewDto {
  @IsString()
  @Matches(/^[a-f0-9]{48}$/)
  reviewToken: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

export type Decimal = Prisma.Decimal;
