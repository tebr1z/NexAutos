import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class PricingDto {
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-10000) @Max(10000) discountAUsd?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-10000) @Max(10000) discountBUsd?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-10000) @Max(10000) discountCUsd?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(10000) potiBakuUsd?: number | null;
}
export class CalculatorPlanDto extends PricingDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1000000) monthlyLimit?: number | null;
  @IsOptional() @IsBoolean() allowSelfPricing?: boolean;
}
export class BugReportDto {
  @IsString() @MinLength(5) @MaxLength(2000) message: string;
  @IsOptional() @IsString() @MaxLength(1000) pageUrl?: string;
  @IsOptional() @IsString() @MaxLength(40) version?: string;
}
export class BugStatusDto {
  @IsIn(['OPEN', 'RESOLVED']) status: string;
}
