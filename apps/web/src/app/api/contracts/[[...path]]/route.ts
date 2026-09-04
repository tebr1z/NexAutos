import {
  adminPdfHtml,
  contractHtml,
  createContract,
  listContracts,
  markRead,
  publicView,
  requestOtp,
  resendContract,
  signContract,
  verifyOtp,
  voidContract,
  assignContract,
} from "@/lib/contracts-store";

export const dynamic = "force-dynamic";

function jsonError(err: unknown) {
  const status = typeof err === "object" && err && "status" in err ? Number((err as { status: number }).status) : 400;
  const message = err instanceof Error ? err.message : "Xəta";
  return Response.json({ message }, { status: Number.isFinite(status) && status >= 400 ? status : 400 });
}

export async function GET(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  try {
    const { path = [] } = await ctx.params;
    const url = new URL(req.url);
    if (path.length === 0) return Response.json(await listContracts());
    if (path[0] === "public" && path[1] && path[2] === "pdf") {
      try {
        const html = await contractHtml(path[1], true);
        return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
      } catch (err) {
        const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
        const res = await fetch(`${api}/contracts/public/${path[1]}/pdf`);
        if (res.ok) {
          return new Response(res.body, {
            headers: { "Content-Type": res.headers.get("content-type") ?? "application/pdf" },
          });
        }
        return jsonError(err);
      }
    }
    if (path[0] === "public" && path[1] && path.length === 2) {
      return Response.json(await publicView(path[1], url.searchParams.get("session") ?? undefined));
    }
    if (path[1] === "pdf") {
      const html = await adminPdfHtml(path[0]);
      return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    return Response.json({ message: "Not found" }, { status: 404 });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  try {
    const { path = [] } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (path.length === 0) {
      return Response.json(await createContract(body as Record<string, string | number | undefined>));
    }
    if (path[1] === "resend") return Response.json(await resendContract(path[0]));
    if (path[1] === "assign") {
      return Response.json(
        await assignContract(path[0], {
          trackingCode: typeof body.trackingCode === "string" ? body.trackingCode : undefined,
          vin: typeof body.vin === "string" ? body.vin : undefined,
          make: typeof body.make === "string" ? body.make : undefined,
          model: typeof body.model === "string" ? body.model : undefined,
          year:
            typeof body.year === "number"
              ? body.year
              : typeof body.year === "string" && body.year.trim()
                ? Number(body.year)
                : undefined,
          orderId: typeof body.orderId === "string" ? body.orderId : undefined,
        }),
      );
    }
    if (path[1] === "void") return Response.json(await voidContract(path[0]));
    if (path[0] === "public" && path[1] && path[2] === "otp" && path[3] === "verify") {
      return Response.json(
        await verifyOtp(path[1], body.purpose as "PHONE_VERIFY" | "SIGN_CONFIRM", String(body.code ?? "")),
      );
    }
    if (path[0] === "public" && path[1] && path[2] === "otp") {
      return Response.json(
        await requestOtp(
          path[1],
          body.purpose as "PHONE_VERIFY" | "SIGN_CONFIRM",
          typeof body.sessionToken === "string" ? body.sessionToken : undefined,
        ),
      );
    }
    if (path[0] === "public" && path[1] && path[2] === "read") {
      return Response.json(await markRead(path[1], String(body.sessionToken ?? "")));
    }
    if (path[0] === "public" && path[1] && path[2] === "sign") {
      return Response.json(
        await signContract(
          path[1],
          {
            sessionToken: String(body.sessionToken ?? ""),
            code: String(body.code ?? ""),
            signaturePng: String(body.signaturePng ?? ""),
            readFully: Boolean(body.readFully),
            acceptedEsign: Boolean(body.acceptedEsign),
            acceptedTerms: Boolean(body.acceptedTerms),
          },
          {
            ip: req.headers.get("x-forwarded-for")?.split(",")[0] ?? null,
            userAgent: req.headers.get("user-agent"),
          },
        ),
      );
    }
    return Response.json({ message: "Not found" }, { status: 404 });
  } catch (err) {
    return jsonError(err);
  }
}
