import { Controller, Get } from '@nestjs/common';

@Controller('currency')
export class CurrencyController {
  @Get('rates')
  async rates() {
    try {
      const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=EUR,TRY');
      const data = (await res.json()) as { rates?: Record<string, number> };
      return { USD: 1, AZN: 1.7, EUR: data.rates?.EUR ?? 0.92, TRY: data.rates?.TRY ?? 34.2 };
    } catch {
      return { USD: 1, AZN: 1.7, EUR: 0.92, TRY: 34.2 };
    }
  }
}
