import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CloudinarySettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  cloudName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  apiKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  apiSecret?: string;

  @IsOptional()
  @IsBoolean()
  clear?: boolean;
}

export class AisKeyDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  key?: string;
}
