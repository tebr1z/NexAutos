import { BadGatewayException, BadRequestException, Injectable } from '@nestjs/common';
import { AutoDutyDto } from './dto';

const DGK = 'https://c2b-fbusiness.customs.gov.az/api/v1';

function langOf(raw?: string) {
  const value = (raw ?? 'az').toLowerCase();
  if (value.startsWith('en')) return 'en';
  if (value.startsWith('ru')) return 'ru';
  return 'az';
}

function issueDate(raw: string) {
  const value = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10) + 'T00:00:00';
  const dots = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (dots) return `${dots[3]}-${dots[2]}-${dots[1]}T00:00:00`;
  throw new BadRequestException('İstehsal tarixi YYYY-MM-DD olmalıdır.');
}

@Injectable()
export class CustomsService {
  private async dgk<T>(path: string, init: RequestInit, lang: string): Promise<T> {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 15000);
    try {
      const res = await fetch(`${DGK}${path}`, {
        ...init,
        signal: ac.signal,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          lang,
          requestSource: 'ECustoms',
          ...(init.headers ?? {}),
        },
      });
      const body = (await res.json().catch(() => null)) as {
        code?: number;
        data?: T;
        exception?: { validationError?: Record<string, string | null>; errorMessage?: string | null };
      } | null;
      if (!res.ok || !body || body.code !== 200 || body.data == null) {
        const errors = body?.exception?.validationError
          ? Object.values(body.exception.validationError).filter(Boolean).join(' ')
          : body?.exception?.errorMessage;
        throw new BadGatewayException(errors || 'Gömrük kalkulyatoru cavab vermədi.');
      }
      return body.data;
    } catch (err) {
      if (err instanceof BadGatewayException || err instanceof BadRequestException) throw err;
      throw new BadGatewayException('Dövlət Gömrük Komitəsi API-yə çıxılmadı.');
    } finally {
      clearTimeout(timer);
    }
  }

  options(lang?: string) {
    return this.dgk<{
      AutoEngineTypes: { code: string; name: string; abbreviation2: string }[];
      AutoCategories: { code: string; name: string }[];
    }>(
      '/dictionaries/list',
      {
        method: 'POST',
        body: JSON.stringify({ dictionaryType: ['AutoEngineTypes', 'AutoCategories'] }),
      },
      langOf(lang),
    );
  }

  calculate(dto: AutoDutyDto, lang?: string) {
    return this.dgk(
      '/dictionaries/calAutoDutyv2',
      {
        method: 'POST',
        body: JSON.stringify({
          autoType: dto.autoType,
          engineType: dto.engineType,
          engine: dto.engine,
          commerceType: dto.commerceType,
          issueDate: issueDate(dto.issueDate),
          price: dto.price,
          transportExpenses: dto.transportExpenses,
          otherExpenses: dto.otherExpenses ?? 0,
        }),
      },
      langOf(lang),
    );
  }
}
