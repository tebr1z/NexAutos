import type { Metadata } from "next";
import { VesselSearch } from "@/components/tracking/vessel-search";

export const metadata: Metadata = {
  title: "Vessel AIS",
  description: "View the latest available AIS vessel position by name or MMSI.",
};

export default function VesselsPage() {
  return <VesselSearch />;
}
