import { NextResponse } from "next/server";
import { sendStatusSms } from "@/lib/sms";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    phone?: string;
    trackingCode?: string;
    status?: string;
    make?: string;
    model?: string;
  } | null;
  if (!body?.trackingCode || !body?.status) {
    return NextResponse.json({ sent: false, error: "invalid" }, { status: 400 });
  }
  const result = await sendStatusSms(body);
  return NextResponse.json(result);
}
