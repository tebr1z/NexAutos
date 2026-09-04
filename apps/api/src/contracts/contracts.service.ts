import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotifyService, normalizePhone } from '../notify/notify.service';
import { buildContractBody, type ContractBody } from './contract-text';
import { renderContractPdf } from './pdf';
import { CreateContractDto, SignContractDto, AssignContractDto } from './dto';

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_COOLDOWN_MS = 55 * 1000;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

function siteUrl() {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.CORS_ORIGIN ?? '')
    .split(',')[0]
    .trim()
    .replace(/\/$/, '');
  if (process.env.NODE_ENV === 'production') {
    if (!raw || /localhost|127\.0\.0\.1/i.test(raw)) return 'https://nex.autos';
    return raw;
  }
  return raw || 'http://localhost:3000';
}

function otpSecret() {
  return process.env.JWT_SECRET ?? 'autonex-contract-otp';
}

function hashOtp(contractId: string, purpose: string, code: string) {
  return createHash('sha256').update(`${otpSecret()}:${contractId}:${purpose}:${code}`).digest('hex');
}

function hashToken(value: string) {
  return createHash('sha256').update(`${otpSecret()}:session:${value}`).digest('hex');
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function maskPhone(raw: string) {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 8) return '***';
  return `+${digits.slice(0, 3)} ${digits.slice(3, 5)} *** ** ${digits.slice(-2)}`;
}

function money(value?: string | null) {
  if (!value?.trim()) return null;
  const n = Number(value.replace(',', '.').replace(/[^\d.]/g, ''));
  if (!Number.isFinite(n)) return null;
  return new Prisma.Decimal(n.toFixed(2));
}

function revealOtp() {
  return process.env.CONTRACT_REVEAL_OTP === 'true';
}

function clientIp(req?: { ip?: string; headers?: Record<string, string | string[] | undefined> }) {
  const fwd = req?.headers?.['x-forwarded-for'];
  const fromHeader = Array.isArray(fwd) ? fwd[0] : fwd?.split(',')[0];
  return (fromHeader || req?.ip || '').trim() || null;
}

@Injectable()
export class ContractsService {
  constructor(
    private prisma: PrismaService,
    private notify: NotifyService,
  ) {}

  async list() {
    const rows = await this.prisma.contract.findMany({
      orderBy: { createdAt: 'desc' },
      take: 300,
      select: this.adminSelect(),
    });
    return rows.map((row) => this.toAdmin(row));
  }

  async getAdmin(id: string) {
    const row = await this.prisma.contract.findUnique({ where: { id }, select: this.adminSelect() });
    if (!row) throw new NotFoundException('Müqavilə tapılmadı');
    return this.toAdmin(row);
  }

  async create(dto: CreateContractDto, userId?: string) {
    const phone = normalizePhone(dto.customerPhone);
    if (!phone) throw new BadRequestException('Düzgün telefon nömrəsi yazın.');

    let orderId = dto.orderId?.trim() || null;
    let trackingCode = dto.trackingCode?.trim().toUpperCase() || null;
    if (!orderId && trackingCode) {
      const order = await this.prisma.order.findFirst({ where: { trackingCode } });
      if (order) orderId = order.id;
    }

    const year = new Date().getFullYear();
    const count = await this.prisma.contract.count({
      where: { createdAt: { gte: new Date(`${year}-01-01T00:00:00.000Z`) } },
    });
    let number = `ANX-${year}-${String(count + 1).padStart(4, '0')}`;
    while (await this.prisma.contract.findUnique({ where: { number } })) {
      number = `ANX-${year}-${String(randomInt(1000, 9999))}`;
    }

    const token = randomBytes(32).toString('base64url');
    const fields = {
      number,
      customerName: dto.customerName.trim(),
      customerPhone: phone,
      customerEmail: dto.customerEmail?.trim() || null,
      customerAddress: dto.customerAddress?.trim() || null,
      customerIdNumber: dto.customerIdNumber?.trim() || null,
      trackingCode,
      vin: dto.vin?.trim().toUpperCase() || null,
      make: dto.make?.trim() || null,
      model: dto.model?.trim() || null,
      year: dto.year ?? null,
      origin: dto.origin?.trim() || null,
      amountUsd: dto.amountUsd?.trim() || null,
      amountAzn: dto.amountAzn?.trim() || null,
      paymentNote: dto.paymentNote?.trim() || null,
      extraTerms: dto.extraTerms?.trim() || null,
    };
    const bodySnapshot = buildContractBody(fields);

    const created = await this.prisma.contract.create({
      data: {
        number,
        token,
        status: 'SENT',
        customerName: fields.customerName,
        customerPhone: phone,
        customerEmail: fields.customerEmail,
        customerAddress: fields.customerAddress,
        customerIdNumber: fields.customerIdNumber,
        orderId,
        trackingCode,
        vin: fields.vin,
        make: fields.make,
        model: fields.model,
        year: fields.year,
        origin: fields.origin,
        amountUsd: money(dto.amountUsd),
        amountAzn: money(dto.amountAzn),
        paymentNote: fields.paymentNote,
        extraTerms: fields.extraTerms,
        bodySnapshot: bodySnapshot as unknown as Prisma.InputJsonValue,
        createdById: userId,
      },
      select: this.adminSelect(),
    });

    const notify = await this.dispatchContractLink(created);
    const row = await this.prisma.contract.update({
      where: { id: created.id },
      data: {
        sentWhatsappAt: notify.whatsapp.sent ? new Date() : null,
        sentEmailAt: notify.email.sent ? new Date() : null,
        notifyMeta: notify as unknown as Prisma.InputJsonValue,
      },
      select: this.adminSelect(),
    });

    return { ...this.toAdmin(row), notify, publicUrl: this.publicUrl(row.token) };
  }

  async assign(id: string, dto: AssignContractDto) {
    const row = await this.prisma.contract.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Müqavilə tapılmadı');
    if (row.status === 'VOID') throw new BadRequestException('Ləğv edilmiş müqaviləyə maşın təyin olunmur.');
    if (row.status !== 'SIGNED') {
      throw new BadRequestException('Maşın yalnız imzalanmış müştəri müqaviləsinə təyin olunur.');
    }
    const trackingCode = dto.trackingCode?.trim().toUpperCase() || null;
    const updated = await this.prisma.contract.update({
      where: { id },
      data: {
        trackingCode,
        vin: dto.vin?.trim().toUpperCase() || row.vin,
        make: dto.make?.trim() || row.make,
        model: dto.model?.trim() || row.model,
        year: dto.year ?? row.year,
        orderId: dto.orderId?.trim() || row.orderId,
      },
      select: this.adminSelect(),
    });
    return this.toAdmin(updated);
  }

  async resend(id: string) {
    const row = await this.prisma.contract.findUnique({ where: { id }, select: this.adminSelect() });
    if (!row) throw new NotFoundException('Müqavilə tapılmadı');
    if (row.status === 'VOID') throw new BadRequestException('Ləğv edilmiş müqavilə göndərilə bilməz.');
    const notify = await this.dispatchContractLink(row);
    const updated = await this.prisma.contract.update({
      where: { id },
      data: {
        sentWhatsappAt: notify.whatsapp.sent ? new Date() : row.sentWhatsappAt,
        sentEmailAt: notify.email.sent ? new Date() : row.sentEmailAt,
        notifyMeta: notify as unknown as Prisma.InputJsonValue,
        status: row.status === 'DRAFT' ? 'SENT' : row.status,
      },
      select: this.adminSelect(),
    });
    return { ...this.toAdmin(updated), notify, publicUrl: this.publicUrl(updated.token) };
  }

  async void(id: string) {
    const row = await this.prisma.contract.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Müqavilə tapılmadı');
    if (row.status === 'SIGNED') throw new BadRequestException('İmzalanmış müqavilə ləğv edilmir — əlavə razılaşma lazımdır.');
    const updated = await this.prisma.contract.update({
      where: { id },
      data: { status: 'VOID', voidedAt: new Date(), sessionTokenHash: null },
      select: this.adminSelect(),
    });
    return this.toAdmin(updated);
  }

  async publicView(token: string, sessionToken?: string) {
    const row = await this.requireByToken(token);
    const sessionOk = this.sessionOk(row, sessionToken);
    const signed = row.status === 'SIGNED';
    const body = (signed || sessionOk ? row.bodySnapshot : null) as ContractBody | null;
    return {
      id: row.id,
      number: row.number,
      status: row.status,
      customerName: row.customerName,
      maskedPhone: maskPhone(row.customerPhone),
      hasEmail: Boolean(row.customerEmail),
      trackingCode: row.trackingCode,
      vin: row.vin,
      make: row.make,
      model: row.model,
      year: row.year,
      phoneVerified: Boolean(row.phoneVerifiedAt) && sessionOk,
      readAt: row.readAt,
      signedAt: row.signedAt,
      documentHash: signed ? row.documentHash : null,
      signaturePng: signed ? row.signaturePng : null,
      body,
      step: this.step(row, sessionOk),
    };
  }

  async requestOtp(token: string, purpose: 'PHONE_VERIFY' | 'SIGN_CONFIRM', sessionToken?: string) {
    const row = await this.requireByToken(token);
    if (row.status === 'VOID') throw new BadRequestException('Müqavilə ləğv edilib.');
    if (row.status === 'SIGNED') throw new BadRequestException('Müqavilə artıq imzalanıb.');
    if (purpose === 'SIGN_CONFIRM') {
      if (!this.sessionOk(row, sessionToken)) {
        throw new ForbiddenException('Əvvəlcə telefonu SMS kodu ilə təsdiqləyin.');
      }
    }

    const recent = await this.prisma.contractOtp.findFirst({
      where: { contractId: row.id, purpose, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (recent && Date.now() - recent.createdAt.getTime() < OTP_COOLDOWN_MS) {
      throw new BadRequestException('Yeni kod üçün bir dəqiqə gözləyin.');
    }

    const code = String(randomInt(100000, 1000000));
    await this.prisma.contractOtp.create({
      data: {
        contractId: row.id,
        purpose,
        codeHash: hashOtp(row.id, purpose, code),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });

    const sent = await this.notify.sendOtpCode(row.customerPhone, code);
    const preview = revealOtp() ? code : null;
    await this.prisma.contract.update({
      where: { id: row.id },
      data: { lastOtpPreview: preview },
    });
    if (preview) {
      console.info(`[contract-otp] ${row.number} ${purpose} (${sent.error ?? sent.channel ?? 'dev'})`);
    }

    return {
      sent: sent.sent,
      channel: sent.channel,
      error: sent.error,
      cooldownSec: 60,
      expiresMin: 10,
      devCode: preview,
    };
  }

  async verifyOtp(token: string, purpose: 'PHONE_VERIFY' | 'SIGN_CONFIRM', code: string) {
    const row = await this.requireByToken(token);
    if (row.status === 'VOID' || row.status === 'SIGNED') {
      throw new BadRequestException('Bu müqavilə üçün kod qəbul olunmur.');
    }
    const otp = await this.prisma.contractOtp.findFirst({
      where: { contractId: row.id, purpose, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp) throw new BadRequestException('Kod tapılmadı. Yenidən göndərin.');
    if (otp.expiresAt.getTime() < Date.now()) throw new BadRequestException('Kodun vaxtı bitib.');
    if (otp.attempts >= MAX_OTP_ATTEMPTS) throw new BadRequestException('Həddindən artıq cəhd. Yeni kod göndərin.');

    const ok = safeEqual(otp.codeHash, hashOtp(row.id, purpose, code.trim()));
    await this.prisma.contractOtp.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 }, consumedAt: ok ? new Date() : null },
    });
    if (!ok) throw new BadRequestException('Kod səhvdir.');

    if (purpose === 'PHONE_VERIFY') {
      const sessionToken = randomBytes(32).toString('base64url');
      await this.prisma.contract.update({
        where: { id: row.id },
        data: {
          phoneVerifiedAt: new Date(),
          status: 'PHONE_VERIFIED',
          sessionTokenHash: hashToken(sessionToken),
          sessionExpiresAt: new Date(Date.now() + SESSION_TTL_MS),
          lastOtpPreview: null,
        },
      });
      return { ok: true, sessionToken, purpose };
    }

    return { ok: true, purpose };
  }

  async markRead(token: string, sessionToken: string) {
    const row = await this.requireByToken(token);
    if (!this.sessionOk(row, sessionToken)) throw new ForbiddenException('Telefon təsdiqi tələb olunur.');
    if (row.status === 'SIGNED' || row.status === 'VOID') return { ok: true, status: row.status };
    const updated = await this.prisma.contract.update({
      where: { id: row.id },
      data: {
        readAt: row.readAt ?? new Date(),
        status: 'READ',
      },
      select: { status: true, readAt: true },
    });
    return { ok: true, ...updated };
  }

  async sign(token: string, dto: SignContractDto, req?: { ip?: string; headers?: Record<string, unknown> }) {
    const row = await this.requireByToken(token);
    if (row.status === 'SIGNED') throw new BadRequestException('Müqavilə artıq imzalanıb.');
    if (row.status === 'VOID') throw new BadRequestException('Müqavilə ləğv edilib.');
    if (!this.sessionOk(row, dto.sessionToken)) throw new ForbiddenException('Telefon təsdiqi tələb olunur.');
    if (!dto.readFully || !dto.acceptedEsign || !dto.acceptedTerms) {
      throw new BadRequestException('Müqaviləni oxuyub bütün təsdiq qutularını işarələyin.');
    }
    if (!dto.signaturePng.startsWith('data:image/png;base64,')) {
      throw new BadRequestException('Əl imzası PNG formatında olmalıdır.');
    }

    const otp = await this.prisma.contractOtp.findFirst({
      where: { contractId: row.id, purpose: 'SIGN_CONFIRM', consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp) throw new BadRequestException('İmza üçün SMS kodu göndərin.');
    if (otp.expiresAt.getTime() < Date.now()) throw new BadRequestException('İmza kodunun vaxtı bitib.');
    if (otp.attempts >= MAX_OTP_ATTEMPTS) throw new BadRequestException('Həddindən artıq cəhd. Yeni kod göndərin.');
    const otpOk = safeEqual(otp.codeHash, hashOtp(row.id, 'SIGN_CONFIRM', dto.code.trim()));
    await this.prisma.contractOtp.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 }, consumedAt: otpOk ? new Date() : null },
    });
    if (!otpOk) throw new BadRequestException('İmza kodu səhvdir.');

    const signedAt = new Date();
    const ip = clientIp(req as { ip?: string; headers?: Record<string, string | string[] | undefined> });
    const userAgent = String(req?.headers?.['user-agent'] ?? '').slice(0, 400) || null;
    const body = row.bodySnapshot as unknown as ContractBody;
    const documentHash = createHash('sha256')
      .update(
        JSON.stringify({
          number: row.number,
          body,
          signature: dto.signaturePng,
          signedAt: signedAt.toISOString(),
          phone: row.customerPhone,
        }),
      )
      .digest('hex');

    const pdfBytes = await renderContractPdf(body, {
      number: row.number,
      signedAt: signedAt.toLocaleString('az-AZ'),
      customerName: row.customerName,
      customerPhone: row.customerPhone,
      documentHash,
      ip,
      userAgent,
      signaturePng: dto.signaturePng,
    });

    await this.prisma.contract.update({
      where: { id: row.id },
      data: {
        status: 'SIGNED',
        signedAt,
        readAt: row.readAt ?? signedAt,
        signaturePng: dto.signaturePng,
        documentHash,
        signerIp: ip,
        signerUserAgent: userAgent,
        pdfBytes: new Uint8Array(pdfBytes),
        lastOtpPreview: null,
        sessionTokenHash: null,
      },
    });

    const pdfUrl = this.publicUrl(row.token);
    const signedMsg = [
      `Auto Nex: müqavilə № ${row.number} imzalandı.`,
      `PDF: ${pdfUrl}`,
      row.trackingCode ? `İzləmə: ${siteUrl()}/track/${row.trackingCode}` : null,
    ]
      .filter(Boolean)
      .join('\n');
    await this.notify.sendMessage(row.customerPhone, signedMsg);
    if (row.customerEmail) {
      await this.notify.sendEmail({
        to: row.customerEmail,
        subject: `Auto Nex — imzalanmış müqavilə ${row.number}`,
        text: signedMsg,
      });
    }

    return {
      ok: true,
      status: 'SIGNED' as const,
      signedAt,
      documentHash,
      publicUrl: pdfUrl,
    };
  }

  async adminPdf(id: string) {
    const row = await this.prisma.contract.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Müqavilə tapılmadı');
    return this.pdfFile(row);
  }

  async publicPdf(token: string) {
    const row = await this.requireByToken(token);
    if (row.status !== 'SIGNED') throw new ForbiddenException('PDF yalnız imzadan sonra əlçatandır.');
    return this.pdfFile(row);
  }

  private async pdfFile(row: { number: string; pdfBytes: Buffer | Uint8Array | null; bodySnapshot: unknown; customerName: string; customerPhone: string; documentHash: string | null; signedAt: Date | null; signaturePng: string | null; signerIp: string | null; signerUserAgent: string | null }) {
    const stored = row.pdfBytes ? Buffer.from(row.pdfBytes) : await renderContractPdf(row.bodySnapshot as unknown as ContractBody, {
      number: row.number,
      signedAt: row.signedAt?.toLocaleString('az-AZ') ?? 'imzalanmayıb',
      customerName: row.customerName,
      customerPhone: row.customerPhone,
      documentHash: row.documentHash ?? '—',
      ip: row.signerIp,
      userAgent: row.signerUserAgent,
      signaturePng: row.signaturePng,
    });
    return new StreamableFile(new Uint8Array(stored), {
      type: 'application/pdf',
      disposition: `inline; filename="${row.number}.pdf"`,
    });
  }

  private async dispatchContractLink(row: { token: string; number: string; customerName: string; customerPhone: string; customerEmail: string | null }) {
    const url = this.publicUrl(row.token);
    const text = [
      `Auto Nex müqavilə № ${row.number}`,
      `Hörmətli ${row.customerName},`,
      'Xidmət müqaviləsini oxuyub elektron imza atmaq üçün keçid:',
      url,
      '1) Telefona gələn SMS kodu  2) Müqaviləni oxuyun  3) Əl ilə imza  4) İkinci SMS kodu ilə təsdiq.',
      'Kodları heç kimə verməyin.',
    ].join('\n');
    const html = `<p>Hörmətli ${this.escape(row.customerName)},</p><p>Auto Nex xidmət müqaviləsi <strong>№ ${this.escape(row.number)}</strong>.</p><p><a href="${url}">Müqaviləni açın, oxuyun və elektron imza atın</a></p><p>Axın: telefon OTP → müqavilə mətni → əl imzası → ikinci OTP ilə təsdiq.</p><p>${url}</p>`;
    const whatsapp = await this.notify.sendMessage(row.customerPhone, text);
    const email = await this.notify.sendEmail({
      to: row.customerEmail,
      subject: `Auto Nex müqavilə ${row.number} — oxuyun və imzalayın`,
      text,
      html,
    });
    return { whatsapp, email, publicUrl: url, waMe: `https://wa.me/${row.customerPhone}?text=${encodeURIComponent(text)}` };
  }

  private publicUrl(token: string) {
    return `${siteUrl()}/contract/${token}`;
  }

  private escape(value: string) {
    return value.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] as string));
  }

  private async requireByToken(token: string) {
    const row = await this.prisma.contract.findUnique({ where: { token } });
    if (!row) throw new NotFoundException('Müqavilə keçidi etibarsızdır.');
    return row;
  }

  private sessionOk(
    row: { sessionTokenHash: string | null; sessionExpiresAt: Date | null; status: string },
    sessionToken?: string,
  ) {
    if (row.status === 'SIGNED') return true;
    if (!sessionToken || !row.sessionTokenHash || !row.sessionExpiresAt) return false;
    if (row.sessionExpiresAt.getTime() < Date.now()) return false;
    return safeEqual(row.sessionTokenHash, hashToken(sessionToken));
  }

  private step(row: { status: string; phoneVerifiedAt: Date | null; readAt: Date | null }, sessionOk: boolean) {
    if (row.status === 'SIGNED') return 'done';
    if (row.status === 'VOID') return 'void';
    if (!sessionOk) return 'otp';
    if (!row.readAt && row.status !== 'READ') return 'read';
    return 'sign';
  }

  private adminSelect() {
    return {
      id: true,
      number: true,
      token: true,
      status: true,
      customerName: true,
      customerPhone: true,
      customerEmail: true,
      customerAddress: true,
      customerIdNumber: true,
      trackingCode: true,
      vin: true,
      make: true,
      model: true,
      year: true,
      origin: true,
      amountUsd: true,
      amountAzn: true,
      paymentNote: true,
      extraTerms: true,
      phoneVerifiedAt: true,
      readAt: true,
      signedAt: true,
      voidedAt: true,
      documentHash: true,
      signerIp: true,
      signerUserAgent: true,
      signaturePng: true,
      lastOtpPreview: true,
      sentWhatsappAt: true,
      sentEmailAt: true,
      notifyMeta: true,
      createdAt: true,
      updatedAt: true,
    } as const;
  }

  private toAdmin(row: Record<string, unknown>) {
    return {
      ...row,
      lastOtpPreview: revealOtp() ? row.lastOtpPreview : null,
      amountUsd: row.amountUsd != null ? String(row.amountUsd) : null,
      amountAzn: row.amountAzn != null ? String(row.amountAzn) : null,
      publicUrl: this.publicUrl(String(row.token)),
      hasPdf: Boolean(row.signedAt),
    };
  }
}
