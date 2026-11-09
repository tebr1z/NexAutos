import { NextResponse } from "next/server";

// Sending belongs to the authenticated, order-scoped Nest API. This legacy
// public route must never accept arbitrary recipients or invoke paid providers.
export async function POST() {
  return NextResponse.json({ sent: false, error: "endpoint_removed" }, { status: 410 });
}
