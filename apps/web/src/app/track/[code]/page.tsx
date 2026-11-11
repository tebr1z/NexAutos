import type { Metadata } from "next";
import { TrackingDetail } from "@/components/tracking/tracking-detail";

export const metadata: Metadata = {
  title: "Vehicle Tracking",
  robots: { index: false, follow: false },
};

export default async function TrackCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <TrackingDetail code={code} />;
}
