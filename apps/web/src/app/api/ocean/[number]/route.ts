import { enrichKnownContainer, lookupCarrier, attachPortCoords, formatContainer } from "@/lib/carriers";
import { fetchLiveOcean } from "@/lib/ocean-live";

export async function GET(_req: Request, ctx: { params: Promise<{ number: string }> }) {
  const { number } = await ctx.params;
  const base = attachPortCoords(enrichKnownContainer(lookupCarrier(number)));
  let intel = base;
  try {
    const live = await fetchLiveOcean(base.containerNumber, base.carrier?.code);
    if (live) {
      intel = attachPortCoords({ ...base, ...live, source: "live", trackingUrl: undefined });
    }
  } catch {
    intel = base;
  }

  return Response.json({
    containerNumber: intel.containerNumber,
    validFormat: intel.validFormat,
    checkDigitOk: intel.checkDigitOk,
    prefix: intel.prefix,
    carrierCode: intel.carrier?.code,
    carrierName: intel.carrier?.name,
    carrierKind: intel.carrier?.kind,
    vesselName: intel.vesselName,
    voyageNumber: intel.voyageNumber,
    originPort: intel.originPort,
    destinationPort: intel.destinationPort,
    currentPort: intel.currentPort,
    currentCountry: intel.currentCountry,
    eta: intel.eta,
    containerStatus: intel.containerStatus,
    lat: intel.lat,
    lng: intel.lng,
    source: intel.source,
    note: intel.note,
    formatted: intel.validFormat ? formatContainer(intel.containerNumber) : intel.containerNumber,
  });
}
