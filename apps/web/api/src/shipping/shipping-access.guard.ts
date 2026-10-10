import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { timingSafeEqual } from 'node:crypto';
import { firstValueFrom, isObservable } from 'rxjs';

const STAFF = new Set(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF']);

function sameSecret(candidate?: string, expected?: string) {
  const left = Buffer.from(candidate?.trim() || '');
  const right = Buffer.from(expected?.trim() || '');
  return left.length > 0 && left.length === right.length && timingSafeEqual(left, right);
}

@Injectable()
export class ShippingAccessGuard extends AuthGuard('jwt') implements CanActivate {
  constructor(private config: ConfigService) {
    super();
  }

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    if (sameSecret(request.headers['x-autonex-collector'], this.config.get<string>('MARKET_COLLECTOR_KEY'))) {
      return true;
    }

    const result = super.canActivate(context);
    const authenticated = isObservable(result) ? await firstValueFrom(result) : await result;
    return Boolean(authenticated && STAFF.has(request.user?.role));
  }
}
