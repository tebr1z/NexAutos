import type { Metadata } from "next";
import { TrackForm } from "@/components/tracking/track-form";

export const metadata: Metadata = {
  title: "Track Shipment",
  description: "Find your Auto Nex vehicle by tracking code, full VIN or lot number and view shipment stages, route and photos.",
};

export default function TrackPage() {
  return <TrackForm />;
}
