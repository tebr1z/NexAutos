import { Type } from 'class-transformer';
import { IsNumber, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class ShippingQuoteDto {
  @IsOptional()
  @IsString()
  url?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  priceUsd: number;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  auction?: string;
}

export class ShippingRatesDto {
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  tirUsd?: number;

  @IsObject()
  cells: Record<string, number | null>;
}
