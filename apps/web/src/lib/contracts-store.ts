import { createHash, randomBytes, randomInt } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { normalizePhone, sendOtpSms, sendPlainMessage } from "@/lib/sms";
import { buildContractBody, type ContractBody } from "@/lib/legal/service-contract";

export type ContractStatus = "DRAFT" | "SENT" | "PHONE_VERIFIED" | "READ" | "SIGNED" | "VOID";

type OtpRow = {
  purpose: "PHONE_VERIFY" | "SIGN_CONFIRM";
  codeHash: string;
  expiresAt: string;
  attempts: number;
  consumedAt?: string | null;
  createdAt: string;
};

export type StoredContract = {
  id: string;
  number: string;
  token: string;
  status: ContractStatus;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  customerAddress?: string | null;
  customerIdNumber?: string | null;
  trackingCode?: string | null;
  vin?: string | null;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  origin?: string | null;
  amountUsd?: string | null;
  amountAzn?: string | null;
  paymentNote?: string | null;
  extraTerms?: string | null;
  bodySnapshot: ContractBody;
  phoneVerifiedAt?: string | null;
  readAt?: string | null;
  signedAt?: string | null;
  signaturePng?: string | null;
  documentHash?: string | null;
  signerIp?: string | null;
  signerUserAgent?: string | null;
  sessionTokenHash?: string | null;
  sessionExpiresAt?: string | null;
  lastOtpPreview?: string | null;
  otps: OtpRow[];
  notifyMeta?: { whatsapp?: { sent: boolean; error?: string; channel?: string }; email?: { sent: boolean; error?: string }; waMe?: string; publicUrl?: string };
  createdAt: string;
  publicUrl: string;
};

const FILE = path.join(process.cwd(), ".data", "contracts.json");
const SECRET = process.env.JWT_SECRET ?? "autonex-contract-otp";

function site() {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") {
    if (!raw || /localhost|127\.0\.0\.1/i.test(raw)) return "https://nex.autos";
    return raw;
  }
  return raw || "http://localhost:3000";
}

function revealOtp() {
  return process.env.CONTRACT_REVEAL_OTP === "true";
}

function hashOtp(id: string, purpose: string, code: string) {
  return createHash("sha256").update(`${SECRET}:${id}:${purpose}:${code}`).digest("hex");
}

function hashToken(value: string) {
  return createHash("sha256").update(`${SECRET}:session:${value}`).digest("hex");
}

function maskPhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8) return "***";
  return `+${digits.slice(0, 3)} ${digits.slice(3, 5)} *** ** ${digits.slice(-2)}`;
}

async function load(): Promise<StoredContract[]> {
  try {
    return JSON.parse(await readFile(FILE, "utf8")) as StoredContract[];
  } catch {
    return [];
  }
}

async function save(rows: StoredContract[]) {
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify(rows, null, 2), "utf8");
}

function publicUrl(token: string) {
  return `${site()}/contract/${token}`;
}

function toAdmin(row: StoredContract) {
  const { otps, sessionTokenHash, lastOtpPreview, ...rest } = row;
  void otps;
  void sessionTokenHash;
  return {
    ...rest,
    lastOtpPreview: revealOtp() ? lastOtpPreview : null,
    publicUrl: publicUrl(row.token),
    hasPdf: row.status === "SIGNED",
  };
}

function fail(message: string, status = 400): never {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  throw err;
}

export async function listContracts() {
  return (await load()).map(toAdmin);
}

export async function createContract(input: Record<string, string | number | undefined>) {
  const phone = normalizePhone(String(input.customerPhone ?? ""));
  if (!phone) fail("Düzgün telefon nömrəsi yazın.");
  const name = String(input.customerName ?? "").trim();
  if (name.length < 2) fail("Müştəri adı lazımdır.");
  const rows = await load();
  const year = new Date().getFullYear();
  const number = `ANX-${year}-${String(rows.filter((r) => r.number.startsWith(`ANX-${year}-`)).length + 1).padStart(4, "0")}`;
  const token = randomBytes(32).toString("base64url");
  const fields = {
    number,
    customerName: name,
    customerPhone: phone,
    customerEmail: String(input.customerEmail ?? "").trim() || null,
    customerAddress: String(input.customerAddress ?? "").trim() || null,
    customerIdNumber: String(input.customerIdNumber ?? "").trim() || null,
    trackingCode: String(input.trackingCode ?? "").trim().toUpperCase() || null,
    vin: String(input.vin ?? "").trim().toUpperCase() || null,
    make: String(input.make ?? "").trim() || null,
    model: String(input.model ?? "").trim() || null,
    year: input.year ? Number(input.year) : null,
    origin: String(input.origin ?? "").trim() || null,
    amountUsd: String(input.amountUsd ?? "").trim() || null,
    amountAzn: String(input.amountAzn ?? "").trim() || null,
    paymentNote: String(input.paymentNote ?? "").trim() || null,
    extraTerms: String(input.extraTerms ?? "").trim() || null,
  };
  const url = publicUrl(token);
  const text = [
    `Auto Nex müqavilə № ${number}`,
    `Hörmətli ${name},`,
    "Xidmət müqaviləsini oxuyub elektron imza atmaq üçün keçid:",
    url,
    "1) SMS kod  2) Oxuyun  3) Əl imzası  4) İkinci SMS kodu.",
  ].join("\n");
  const whatsapp = await sendPlainMessage(phone, text);
  const row: StoredContract = {
    id: crypto.randomUUID(),
    token,
    status: "SENT",
    ...fields,
    bodySnapshot: buildContractBody(fields),
    otps: [],
    createdAt: new Date().toISOString(),
    publicUrl: url,
    notifyMeta: {
      whatsapp,
      email: { sent: false, error: fields.customerEmail ? "not_configured" : "no_email" },
      waMe: `https://wa.me/${phone}?text=${encodeURIComponent(text)}`,
      publicUrl: url,
    },
  };
  await save([row, ...rows].slice(0, 400));
  return { ...toAdmin(row), notify: row.notifyMeta, publicUrl: url };
}

async function byId(id: string) {
  const rows = await load();
  const row = rows.find((r) => r.id === id);
  if (!row) fail("Müqavilə tapılmadı", 404);
  return { rows, row };
}

async function byToken(token: string) {
  const rows = await load();
  const row = rows.find((r) => r.token === token);
  if (!row) fail("Müqavilə keçidi etibarsızdır.", 404);
  return { rows, row };
}

function sessionOk(row: StoredContract, session?: string) {
  if (row.status === "SIGNED") return true;
  if (!session || !row.sessionTokenHash || !row.sessionExpiresAt) return false;
  if (new Date(row.sessionExpiresAt).getTime() < Date.now()) return false;
  return row.sessionTokenHash === hashToken(session);
}

export async function resendContract(id: string) {
  const { rows, row } = await byId(id);
  if (row.status === "VOID") fail("Ləğv edilmiş müqavilə göndərilə bilməz.");
  const text = [
    `Auto Nex müqavilə № ${row.number}`,
    `Hörmətli ${row.customerName},`,
    "Xidmət müqaviləsini oxuyub elektron imza atmaq üçün keçid:",
    publicUrl(row.token),
    "1) SMS kod  2) Oxuyun  3) Əl imzası  4) İkinci SMS kodu.",
  ].join("\n");
  const whatsapp = await sendPlainMessage(row.customerPhone, text);
  row.notifyMeta = {
    whatsapp,
    email: { sent: false, error: row.customerEmail ? "not_configured" : "no_email" },
    waMe: `https://wa.me/${row.customerPhone}?text=${encodeURIComponent(text)}`,
    publicUrl: publicUrl(row.token),
  };
  await save(rows);
  return { ...toAdmin(row), notify: row.notifyMeta, publicUrl: publicUrl(row.token) };
}

export async function voidContract(id: string) {
  const { rows, row } = await byId(id);
  if (row.status === "SIGNED") fail("İmzalanmış müqavilə ləğv edilmir.");
  row.status = "VOID";
  row.sessionTokenHash = null;
  await save(rows);
  return toAdmin(row);
}

export async function assignContract(
  id: string,
  dto: { trackingCode?: string; vin?: string; make?: string; model?: string; year?: number; orderId?: string },
) {
  const { rows, row } = await byId(id);
  if (row.status === "VOID") fail("Ləğv edilmiş müqaviləyə maşın təyin olunmur.");
  if (row.status !== "SIGNED") fail("Maşın yalnız imzalanmış müştəri müqaviləsinə təyin olunur.");
  row.trackingCode = dto.trackingCode?.trim().toUpperCase() || row.trackingCode;
  row.vin = dto.vin?.trim().toUpperCase() || row.vin;
  row.make = dto.make?.trim() || row.make;
  row.model = dto.model?.trim() || row.model;
  if (dto.year) row.year = dto.year;
  await save(rows);
  return toAdmin(row);
}

export async function publicView(token: string, session?: string) {
  const { row } = await byToken(token);
  const ok = sessionOk(row, session);
  const signed = row.status === "SIGNED";
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
    phoneVerified: Boolean(row.phoneVerifiedAt) && ok,
    readAt: row.readAt,
    signedAt: row.signedAt,
    documentHash: signed ? row.documentHash : null,
    signaturePng: signed ? row.signaturePng : null,
    body: signed || ok ? row.bodySnapshot : null,
    step: row.status === "SIGNED" ? "done" : row.status === "VOID" ? "void" : !ok ? "otp" : row.readAt ? "sign" : "read",
  };
}

export async function requestOtp(token: string, purpose: "PHONE_VERIFY" | "SIGN_CONFIRM", session?: string) {
  const { rows, row } = await byToken(token);
  if (row.status === "VOID" || row.status === "SIGNED") fail("Bu müqavilə üçün kod göndərilmir.");
  if (purpose === "SIGN_CONFIRM" && !sessionOk(row, session)) fail("Əvvəlcə telefonu təsdiqləyin.", 403);
  const last = [...row.otps].reverse().find((o) => o.purpose === purpose && !o.consumedAt);
  if (last && Date.now() - new Date(last.createdAt).getTime() < 55_000) fail("Yeni kod üçün bir dəqiqə gözləyin.");
  const code = String(randomInt(100000, 1000000));
  row.otps.push({
    purpose,
    codeHash: hashOtp(row.id, purpose, code),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    attempts: 0,
    createdAt: new Date().toISOString(),
  });
  const sent = await sendOtpSms(row.customerPhone, code);
  row.lastOtpPreview = revealOtp() ? code : null;
  await save(rows);
  return {
    sent: sent.sent,
    channel: sent.channel,
    error: sent.error,
    cooldownSec: 60,
    expiresMin: 10,
    ...(revealOtp() ? { devCode: code } : {}),
  };
}

export async function verifyOtp(token: string, purpose: "PHONE_VERIFY" | "SIGN_CONFIRM", code: string) {
  const { rows, row } = await byToken(token);
  const otp = [...row.otps].reverse().find((o) => o.purpose === purpose && !o.consumedAt);
  if (!otp) fail("Kod tapılmadı. Yenidən göndərin.");
  if (new Date(otp.expiresAt).getTime() < Date.now()) fail("Kodun vaxtı bitib.");
  if (otp.attempts >= 5) fail("Həddindən artıq cəhd.");
  otp.attempts += 1;
  if (otp.codeHash !== hashOtp(row.id, purpose, code.trim())) {
    await save(rows);
    fail("Kod səhvdir.");
  }
  otp.consumedAt = new Date().toISOString();
  if (purpose === "PHONE_VERIFY") {
    const sessionToken = randomBytes(32).toString("base64url");
    row.phoneVerifiedAt = new Date().toISOString();
    row.status = "PHONE_VERIFIED";
    row.sessionTokenHash = hashToken(sessionToken);
    row.sessionExpiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    row.lastOtpPreview = null;
    await save(rows);
    return { ok: true, sessionToken, purpose };
  }
  await save(rows);
  return { ok: true, purpose };
}

export async function markRead(token: string, sessionToken: string) {
  const { rows, row } = await byToken(token);
  if (!sessionOk(row, sessionToken)) fail("Telefon təsdiqi tələb olunur.", 403);
  if (row.status === "SIGNED" || row.status === "VOID") return { ok: true, status: row.status };
  row.readAt = row.readAt ?? new Date().toISOString();
  row.status = "READ";
  await save(rows);
  return { ok: true, status: row.status };
}

export async function signContract(
  token: string,
  dto: {
    sessionToken: string;
    code: string;
    signaturePng: string;
    readFully: boolean;
    acceptedEsign: boolean;
    acceptedTerms: boolean;
  },
  meta: { ip?: string | null; userAgent?: string | null },
) {
  const { rows, row } = await byToken(token);
  if (row.status === "SIGNED") fail("Müqavilə artıq imzalanıb.");
  if (row.status === "VOID") fail("Müqavilə ləğv edilib.");
  if (!sessionOk(row, dto.sessionToken)) fail("Telefon təsdiqi tələb olunur.", 403);
  if (!dto.readFully || !dto.acceptedEsign || !dto.acceptedTerms) fail("Bütün təsdiq qutularını işarələyin.");
  if (!dto.signaturePng.startsWith("data:image/png;base64,")) fail("Əl imzası PNG olmalıdır.");
  const otp = [...row.otps].reverse().find((o) => o.purpose === "SIGN_CONFIRM" && !o.consumedAt);
  if (!otp) fail("İmza üçün SMS kodu göndərin.");
  if (new Date(otp.expiresAt).getTime() < Date.now()) fail("İmza kodunun vaxtı bitib.");
  otp.attempts += 1;
  if (otp.codeHash !== hashOtp(row.id, "SIGN_CONFIRM", dto.code.trim())) {
    await save(rows);
    fail("İmza kodu səhvdir.");
  }
  otp.consumedAt = new Date().toISOString();
  const signedAt = new Date();
  const documentHash = createHash("sha256")
    .update(JSON.stringify({ number: row.number, body: row.bodySnapshot, signature: dto.signaturePng, signedAt: signedAt.toISOString(), phone: row.customerPhone }))
    .digest("hex");
  row.status = "SIGNED";
  row.signedAt = signedAt.toISOString();
  row.readAt = row.readAt ?? signedAt.toISOString();
  row.signaturePng = dto.signaturePng;
  row.documentHash = documentHash;
  row.signerIp = meta.ip ?? null;
  row.signerUserAgent = meta.userAgent ?? null;
  row.lastOtpPreview = null;
  row.sessionTokenHash = null;
  await save(rows);
  const url = publicUrl(row.token);
  await sendPlainMessage(row.customerPhone, `Auto Nex: müqavilə № ${row.number} imzalandı.\nPDF: ${url}`);
  return { ok: true, status: "SIGNED" as const, signedAt: row.signedAt, documentHash, publicUrl: url };
}

export async function contractHtml(token: string, requireSigned = true) {
  const { row } = await byToken(token);
  if (requireSigned && row.status !== "SIGNED") fail("PDF yalnız imzadan sonra əlçatandır.", 403);
  const body = row.bodySnapshot;
  const sections = body.sections
    .map(
      (s) =>
        `<h2>${s.title}</h2>${s.paragraphs.map((p) => `<p>${p}</p>`).join("")}`,
    )
    .join("");
  return `<!doctype html><html lang="az"><head><meta charset="utf-8"/><title>${row.number}</title>
<style>body{font:14px/1.55 Georgia,serif;max-width:720px;margin:40px auto;color:#111;padding:0 24px}h1{font-size:22px}h2{font-size:16px;margin-top:28px}p{text-align:justify}.sig{max-width:280px;border:1px solid #ddd;background:#fff} .meta{font-size:12px;color:#444}</style></head><body>
<p class="meta">AUTO NEX · BAKIXANOV, BAKI · AUTO@NEX.AUTOS · 070 966 81 11</p>
<h1>${body.title}</h1><p>${body.intro}</p>${sections}
<h2>Elektron imza və sübut jurnalı</h2>
<p>Müqavilə № ${row.number}<br/>Müştəri: ${row.customerName}<br/>Telefon: ${row.customerPhone}<br/>İmza vaxtı: ${row.signedAt ? new Date(row.signedAt).toLocaleString("az-AZ") : "—"}<br/>IP: ${row.signerIp ?? "—"}<br/>SHA-256: ${row.documentHash ?? "—"}</p>
${row.signaturePng ? `<p>Əl imzası</p><img class="sig" src="${row.signaturePng}" alt="imza"/>` : ""}
<script>window.onload=()=>setTimeout(()=>window.print(),400)</script>
</body></html>`;
}

export async function adminPdfHtml(id: string) {
  const { row } = await byId(id);
  return contractHtml(row.token, false);
}
