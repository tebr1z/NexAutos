import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ContractsService } from './contracts.service';
import { CreateContractDto, RequestOtpDto, SessionDto, SignContractDto, VerifyOtpDto, AssignContractDto } from './dto';

const STAFF: Role[] = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF'];

@Controller('contracts/public')
export class PublicContractsController {
  constructor(private contracts: ContractsService) {}

  @Get(':token')
  view(@Param('token') token: string, @Query('session') session?: string) {
    return this.contracts.publicView(token, session);
  }

  @Throttle({ default: { limit: 8, ttl: 60000 } })
  @Post(':token/otp')
  requestOtp(@Param('token') token: string, @Body() dto: RequestOtpDto) {
    return this.contracts.requestOtp(token, dto.purpose, dto.sessionToken);
  }

  @Throttle({ default: { limit: 12, ttl: 60000 } })
  @Post(':token/otp/verify')
  verify(@Param('token') token: string, @Body() dto: VerifyOtpDto) {
    return this.contracts.verifyOtp(token, dto.purpose, dto.code);
  }

  @Post(':token/read')
  markRead(@Param('token') token: string, @Body() dto: SessionDto) {
    return this.contracts.markRead(token, dto.sessionToken);
  }

  @Post(':token/sign')
  sign(
    @Param('token') token: string,
    @Body() dto: SignContractDto,
    @Req() req: { ip?: string; headers?: Record<string, unknown> },
  ) {
    return this.contracts.sign(token, dto, req);
  }

  @Get(':token/pdf')
  @Header('Content-Type', 'application/pdf')
  pdf(@Param('token') token: string) {
    return this.contracts.publicPdf(token);
  }
}

@Controller('contracts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...STAFF)
export class ContractsController {
  constructor(private contracts: ContractsService) {}

  @Get()
  list() {
    return this.contracts.list();
  }

  @Post()
  create(@Body() dto: CreateContractDto, @CurrentUser() user: { id: string }) {
    return this.contracts.create(dto, user.id);
  }

  @Get(':id/pdf')
  @Header('Content-Type', 'application/pdf')
  pdf(@Param('id') id: string) {
    return this.contracts.adminPdf(id);
  }

  @Get(':id')
  one(@Param('id') id: string) {
    return this.contracts.getAdmin(id);
  }

  @Post(':id/resend')
  resend(@Param('id') id: string) {
    return this.contracts.resend(id);
  }

  @Post(':id/assign')
  assign(@Param('id') id: string, @Body() dto: AssignContractDto) {
    return this.contracts.assign(id, dto);
  }

  @Post(':id/void')
  void(@Param('id') id: string) {
    return this.contracts.void(id);
  }
}
