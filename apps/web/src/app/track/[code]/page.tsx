import { TrackingDetail } from "@/components/tracking/tracking-detail";

export default async function TrackCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <TrackingDetail code={code} />;
}
