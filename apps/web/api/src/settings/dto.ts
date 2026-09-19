import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class R2SettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  accountId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  endpoint?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  accessKeyId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  secretAccessKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  apiToken?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  bucket?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  publicUrl?: string;

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
