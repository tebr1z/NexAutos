import { Body, Controller, Get, Headers, Post, Query } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { CustomsService } from './customs.service';
import { AutoDutyDto } from './dto';

@Controller('customs')
export class CustomsController {
  constructor(private customs: CustomsService) {}

  @SkipThrottle()
  @Get('auto-options')
  options(@Query('lang') lang?: string, @Headers('accept-language') accept?: string) {
    return this.customs.options(lang || accept);
  }

  @Post('auto-duty')
  calculate(
    @Body() dto: AutoDutyDto,
    @Query('lang') lang?: string,
    @Headers('accept-language') accept?: string,
  ) {
    return this.customs.calculate(dto, lang || accept);
  }
}
