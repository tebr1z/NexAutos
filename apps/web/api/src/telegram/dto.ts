import { IsBoolean, IsString, MaxLength, ValidateIf } from 'class-validator';

export class TelegramConfigDto {
  @ValidateIf((_object, value) => value !== undefined) @IsString() @MaxLength(160)
  token?: string;

  @ValidateIf((_object, value) => value !== undefined) @IsBoolean()
  enabled?: boolean;

  @ValidateIf((_object, value) => value !== undefined) @IsBoolean()
  clear?: boolean;
}
