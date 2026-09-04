import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateContractDto {
  @IsString()
  @MinLength(2)
  customerName: string;

  @IsString()
  @MinLength(7)
  customerPhone: string;

  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @IsOptional()
  @IsString()
  customerAddress?: string;

  @IsOptional()
  @IsString()
  customerIdNumber?: string;

  @IsOptional()
  @IsString()
  orderId?: string;

  @IsOptional()
  @IsString()
  trackingCode?: string;

  @IsOptional()
  @IsString()
  vin?: string;

  @IsOptional()
  @IsString()
  make?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  year?: number;

  @IsOptional()
  @IsString()
  origin?: string;

  @IsOptional()
  @IsString()
  amountUsd?: string;

  @IsOptional()
  @IsString()
  amountAzn?: string;

  @IsOptional()
  @IsString()
  paymentNote?: string;

  @IsOptional()
  @IsString()
  extraTerms?: string;
}

export class AssignContractDto {
  @IsOptional()
  @IsString()
  trackingCode?: string;

  @IsOptional()
  @IsString()
  vin?: string;

  @IsOptional()
  @IsString()
  make?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  year?: number;

  @IsOptional()
  @IsString()
  orderId?: string;
}

export class RequestOtpDto {
  @IsIn(['PHONE_VERIFY', 'SIGN_CONFIRM'])
  purpose: 'PHONE_VERIFY' | 'SIGN_CONFIRM';

  @IsOptional()
  @IsString()
  sessionToken?: string;
}

export class VerifyOtpDto {
  @IsIn(['PHONE_VERIFY', 'SIGN_CONFIRM'])
  purpose: 'PHONE_VERIFY' | 'SIGN_CONFIRM';

  @IsString()
  @MinLength(4)
  @MaxLength(8)
  code: string;
}

export class SessionDto {
  @IsString()
  @MinLength(16)
  sessionToken: string;
}

export class SignContractDto {
  @IsString()
  @MinLength(16)
  sessionToken: string;

  @IsString()
  @MinLength(4)
  @MaxLength(8)
  code: string;

  @IsString()
  @MinLength(80)
  @MaxLength(900000)
  signaturePng: string;

  @IsBoolean()
  readFully: boolean;

  @IsBoolean()
  acceptedEsign: boolean;

  @IsBoolean()
  acceptedTerms: boolean;
}
