import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

export type Inquiry = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  body: string;
  isRead: boolean;
  createdAt: string;
};

const FILE = path.join(process.cwd(), ".data", "inquiries.json");

async function load(): Promise<Inquiry[]> {
  try {
    return JSON.parse(await readFile(FILE, "utf8")) as Inquiry[];
  } catch {
    return [];
  }
}

async function save(rows: Inquiry[]) {
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify(rows, null, 2), "utf8");
}

export async function GET() {
  return Response.json(await load());
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const message = String(body.body ?? body.message ?? "").trim();
  if (!name || !message) {
    return Response.json({ message: "Name and message required" }, { status: 400 });
  }
  const row: Inquiry = {
    id: crypto.randomUUID(),
    name,
    email,
    phone: phone || undefined,
    body: message,
    isRead: false,
    createdAt: new Date().toISOString(),
  };
  await save([row, ...(await load())].slice(0, 400));
  return Response.json(row);
}

export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { id?: string };
  if (!body.id) return Response.json({ message: "id required" }, { status: 400 });
  const rows = await load();
  await save(rows.map((row) => (row.id === body.id ? { ...row, isRead: true } : row)));
  return Response.json({ ok: true });
}
