export async function GET(_req: Request, ctx: { params: Promise<{ number: string }> }) {
  const { number } = await ctx.params;
  try {
    // Keep fallback responses under the same provenance rules as the API.
    const base = process.env.INTERNAL_API_URL || "http://127.0.0.1:5002/api/v1";
    const response = await fetch(`${base}/containers/${encodeURIComponent(number)}`, { cache: "no-store", signal: AbortSignal.timeout(40000) });
    return Response.json(await response.json(), { status: response.status });
  } catch {
    return Response.json({ message: "Konteyner izləmə xidməti müvəqqəti əlçatan deyil." }, { status: 503 });
  }
}
