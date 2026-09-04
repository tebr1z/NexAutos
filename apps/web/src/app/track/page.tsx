import type { Metadata } from "next";
import { TrackForm } from "@/components/tracking/track-form";

export const metadata: Metadata = {
  title: "Track Shipment",
  description: "Track your Auto Nex vehicle with a unique code. No login required.",
};

export default function TrackPage() {
  return <TrackForm />;
}
