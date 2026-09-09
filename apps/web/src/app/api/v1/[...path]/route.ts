export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

function nestApiBase() {
  for (const raw of [process.env.INTERNAL_API_URL, process.env.API_PROXY_URL, process.env.NEXT_PUBLIC_API_URL]) {
    const value = raw?.trim();
    if (value && /^https?:\/\//i.test(value)) return value.replace(/\/$/, "");
  }
  return "https://api.nex.autos/api/v1";
}

async function proxy(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await ctx.params;
  const incoming = new URL(req.url);
  const target = `${nestApiBase()}/${path.map(encodeURIComponent).join("/")}${incoming.search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) headers.set(key, value);
  });

  const init: RequestInit & { duplex?: "half" } = { method: req.method, headers, redirect: "manual" };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.arrayBuffer();
    init.duplex = "half";
  }

  try {
    const res = await fetch(target, init);
    const out = new Headers();
    res.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (!HOP_BY_HOP.has(lower) && lower !== "content-encoding") out.set(key, value);
    });
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: out });
  } catch {
    return Response.json({ message: "API unavailable" }, { status: 502 });
  }
}

export async function GET(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  return proxy(req, ctx);
}
export async function POST(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  return proxy(req, ctx);
}
export async function PUT(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  return proxy(req, ctx);
}
export async function PATCH(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  return proxy(req, ctx);
}
export async function DELETE(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  return proxy(req, ctx);
}
export async function OPTIONS(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  return proxy(req, ctx);
}
