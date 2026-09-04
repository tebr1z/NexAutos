import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class VesselQueryDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Matches(/^[\p{L}\p{N}\s.\-'/]+$/u, {
    message: 'Vessel name may only contain letters, numbers, spaces and .- / \'',
  })
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{9}$/, { message: 'MMSI must be 9 digits.' })
  mmsi?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{7}$/, { message: 'IMO must be 7 digits.' })
  imo?: string;
}
