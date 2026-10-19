import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class PricingDto {
  @IsOptional() @IsString() @MaxLength(40) brandName?: string | null;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-10000) @Max(10000) discountAUsd?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-10000) @Max(10000) discountBUsd?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-10000) @Max(10000) discountCUsd?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(10000) profitMarginUsd?: number;
}
export class CalculatorPlanDto extends PricingDto {
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(10000) potiBakuUsd?: number | null;
  @IsOptional() @IsDateString({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) accessUntil?: string | null;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-10000) @Max(10000) surchargeAUsd?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-10000) @Max(10000) surchargeBUsd?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-10000) @Max(10000) surchargeCUsd?: number;
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
