import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class MarketSaleItemDto {
  @IsString() @MinLength(1) @MaxLength(128) key: string;
  @IsString() @MinLength(12) @MaxLength(1000) url: string;
  @IsOptional() @IsString() @MaxLength(32) lot?: string;
  @IsOptional() @IsString() @MaxLength(32) vin?: string;
  @IsOptional() @IsString() @MaxLength(16) auction?: string;
  @IsOptional() @IsString() @MaxLength(80) make?: string;
  @IsOptional() @IsString() @MaxLength(120) model?: string;
  @IsOptional() @IsString() @MaxLength(120) trim?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1900) @Max(2100) year?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(20000) engineCc?: number;
  @IsOptional() @IsString() @MaxLength(120) engineLabel?: string;
  @IsOptional() @IsString() @MaxLength(80) fuel?: string;
  @IsOptional() @IsString() @MaxLength(80) color?: string;
  @IsOptional() @IsString() @MaxLength(180) location?: string;
  @IsOptional() @IsString() @MaxLength(8) state?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(5000000) mileageMi?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(8000000) mileageKm?: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(10000000) finalBidUsd: number;
  @IsOptional() @IsDateString() saleDate?: string;
  @IsDateString() observedAt: string;
}

export class MarketSaleBatchDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => MarketSaleItemDto)
  records: MarketSaleItemDto[];
}

export class MarketSaleQueryDto {
  @IsOptional() @IsString() make?: string;
  @IsOptional() @IsString() model?: string;
  @IsOptional() @IsString() trim?: string;
  @IsOptional() @IsString() @MaxLength(2000) trims?: string;
  @IsOptional() @IsString() fuel?: string;
  @IsOptional() @IsString() auction?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1900) @Max(2100) year?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1900) @Max(2100) yearFrom?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1900) @Max(2100) yearTo?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(20000) engineCc?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(300000) mileageKmFrom?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(300000) mileageKmTo?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(3650) days?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) limit?: number;
}
