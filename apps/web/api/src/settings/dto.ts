import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AisKeyDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  key?: string;
}
