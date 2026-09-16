import { nestApiBase } from "@/lib/nest-url";
import { lookupPositionByImo } from "@/lib/imo-position";

export async function GET(req: Request) {
  const imo = new URL(req.url).searchParams.get("imo") ?? "";
  const nest = nestApiBase();
  try {
    const res = await fetch(`${nest}/vessels?imo=${encodeURIComponent(imo.replace(/\D/g, ""))}`, {
      cache: "no-store",
    });
    if (res.ok) return Response.json(await res.json());
  } catch {
    /* Nest may be down — use Wikidata + Digitraffic */
  }
  const pos = await lookupPositionByImo(imo);
  if (!pos) return Response.json({ message: "No AIS position for this IMO." }, { status: 404 });
  return Response.json(pos);
}
