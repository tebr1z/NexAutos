import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Length, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
export class CreateWatchDto {
  @IsString() @Length(2, 80) name: string;
  @IsString() @Length(2, 50) make: string;
  @IsString() @Length(1, 60) model: string;
  @IsInt() @Min(1950) @Max(2100) yearFrom: number;
  @IsInt() @Min(1950) @Max(2100) yearTo: number;
  @IsOptional() @IsInt() @Min(0) @Max(20000) engineMin?: number;
  @IsOptional() @IsInt() @Min(0) @Max(20000) engineMax?: number;
  @IsArray() @ArrayMaxSize(12) @IsIn(['front','rear','left','right','side','water','fire','rollover','hail','minor','none'], { each: true }) damages: string[];
  @IsIn(['any', 'clean', 'salvage', 'restricted', 'unknown']) document: 'any' | 'clean' | 'salvage' | 'restricted' | 'unknown';
  @IsBoolean() emailEnabled: boolean;
  @IsBoolean() whatsappEnabled: boolean;
}
export class ToggleWatchDto { @IsBoolean() enabled: boolean; }
export class RadarPlanDto {
  @IsBoolean() enabled: boolean;
  @IsInt() @Min(0) @Max(100) watchLimit: number;
  @IsInt() @Min(0) @Max(1000000) monthlyAlertLimit: number;
}
export class BrowserLotDto {
  @IsString() @MaxLength(500) url: string;
  @IsString() @MaxLength(120000) html: string;
}
export class BrowserBatchDto {
  @IsString() @MaxLength(100) lease: string;
  @IsArray() @ArrayMaxSize(60) @ValidateNested({ each: true }) @Type(() => BrowserLotDto) lots: BrowserLotDto[];
  @IsOptional() @IsString() @MaxLength(300) error?: string;
}
