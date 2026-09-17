import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class AutoDutyDto {
  @IsString()
  autoType: string;

  @IsString()
  engineType: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  engine: number;

  @IsIn(['nonFree', 'free'])
  commerceType: 'nonFree' | 'free';

  @IsString()
  issueDate: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  price: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  transportExpenses: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  otherExpenses?: number;
}
