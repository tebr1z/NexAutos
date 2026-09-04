import type { Metadata } from "next";
import { VesselSearch } from "@/components/tracking/vessel-search";

export const metadata: Metadata = {
  title: "Vessel AIS",
  description: "Live vessel position by name or MMSI, served by the Auto Nex API.",
};

export default function VesselsPage() {
  return <VesselSearch />;
}
