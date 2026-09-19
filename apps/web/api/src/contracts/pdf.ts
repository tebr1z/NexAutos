import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import PDFDocument from 'pdfkit';
import type { ContractBody } from './contract-text';

export type PdfEvidence = {
  number: string;
  signedAt: string;
  customerName: string;
  customerPhone: string;
  documentHash: string;
  ip?: string | null;
  userAgent?: string | null;
  signaturePng?: string | null;
};

function walkFonts(dir: string, want: string[]): string | null {
  if (!existsSync(dir)) return null;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = walkFonts(full, want);
      if (nested) return nested;
    } else if (want.includes(entry.name)) {
      return full;
    }
  }
  return null;
}

function fontFile(weight: 'regular' | 'bold') {
  const names =
    weight === 'bold'
      ? ['DejaVuSans-Bold.ttf', 'NotoSans-Bold.ttf', 'arialbd.ttf', 'segoeuib.ttf']
      : ['DejaVuSans.ttf', 'NotoSans-Regular.ttf', 'arial.ttf', 'segoeui.ttf'];
  const dirs = [
    join(process.cwd(), 'assets', 'fonts'),
    join(process.cwd(), 'api', 'assets', 'fonts'),
    join(__dirname, '..', '..', 'assets', 'fonts'),
    join(__dirname, '..', '..', '..', 'assets', 'fonts'),
    'C:\\Windows\\Fonts',
    '/usr/share/fonts',
  ];
  for (const dir of dirs) {
    for (const name of names) {
      const file = join(dir, name);
      if (existsSync(file)) return file;
    }
    const found = walkFonts(dir, names);
    if (found) return found;
  }
  throw new Error('Unicode font missing — DejaVuSans.ttf must ship with the API.');
}

function pngBuffer(dataUrl?: string | null) {
  if (!dataUrl?.startsWith('data:image/png;base64,')) return null;
  try {
    return Buffer.from(dataUrl.slice('data:image/png;base64,'.length), 'base64');
  } catch {
    return null;
  }
}

export function renderContractPdf(body: ContractBody, evidence: PdfEvidence): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const regular = fontFile('regular');
    const bold = fontFile('bold');
    const doc = new PDFDocument({ size: 'A4', margin: 52, info: { Title: body.title, Author: 'Auto Nex' } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.registerFont('AN-R', regular);
    doc.registerFont('AN-B', bold);
    const heading = () => doc.font('AN-B');
    const bodyFont = () => doc.font('AN-R');

    heading().fontSize(9).fillColor('#64748b').text('AUTO NEX  ·  BAKIXANOV, BAKI  ·  AUTO@NEX.AUTOS  ·  070 966 81 11');
    doc.moveDown(0.6);
    heading().fontSize(14).fillColor('#0b0b0d').text(body.title, { width: 490 });
    doc.moveDown(0.4);
    bodyFont().fontSize(10).fillColor('#334155').text(body.intro, { width: 490, align: 'left', lineGap: 3 });

    for (const section of body.sections) {
      doc.moveDown(0.8);
      heading().fontSize(12).fillColor('#0b0b0d').text(section.title, { width: 490 });
      doc.moveDown(0.35);
      for (const fact of section.facts ?? []) {
        const y = doc.y;
        bodyFont().fontSize(9).fillColor('#64748b').text(fact.label, 52, y, { width: 168 });
        heading().fontSize(10).fillColor('#0b0b0d').text(fact.value, 228, y, { width: 314 });
        doc.x = 52;
        doc.moveDown(0.35);
      }
      for (const p of section.paragraphs) {
        bodyFont().fontSize(10).fillColor('#1e293b').text(p, { width: 490, align: 'left', lineGap: 3 });
        doc.moveDown(0.35);
      }
    }

    doc.moveDown(0.6);
    heading().fontSize(11).text('Elektron imza və sübut jurnalı');
    doc.moveDown(0.3);
    bodyFont().fontSize(9).fillColor('#1e293b');
    doc.text(`Müqavilə №: ${evidence.number}`, { width: 490 });
    doc.text(`Müştəri: ${evidence.customerName}`, { width: 490 });
    doc.text(`Telefon: ${evidence.customerPhone}`, { width: 490 });
    doc.text(`İmza vaxtı: ${evidence.signedAt}`, { width: 490 });
    if (evidence.ip) doc.text(`IP: ${evidence.ip}`, { width: 490 });
    if (evidence.userAgent) doc.text(`Brauzer: ${evidence.userAgent.slice(0, 220)}`, { width: 490 });
    doc.text(`Sənəd SHA-256: ${evidence.documentHash}`, { width: 490 });
    doc.text(
      'Təsdiq üsulu: SMS/OTP (telefonun nəzarətdə olması) + ekranda əl ilə çəkilmiş imza. Sadə elektron imza — «Elektron imza və elektron sənəd haqqında» Qanun.',
      { width: 490 },
    );

    const png = pngBuffer(evidence.signaturePng);
    if (png) {
      doc.moveDown(0.5);
      heading().fontSize(10).text('Müştərinin əl imzası');
      doc.moveDown(0.2);
      try {
        doc.image(png, { fit: [280, 90] });
      } catch {
        bodyFont().text('(imza təsviri əlavə olunmadı)');
      }
    }

    doc.end();
  });
}
