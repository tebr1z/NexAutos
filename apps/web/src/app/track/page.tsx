import type { Metadata } from "next";
import { TrackForm } from "@/components/tracking/track-form";

export const metadata: Metadata = {
  title: "Track Shipment",
  description: "View your Auto Nex vehicle's latest shipment status, route and delivery updates with a secure tracking code.",
};

export default function TrackPage() {
  return <TrackForm />;
}
