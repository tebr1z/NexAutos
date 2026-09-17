import type { Metadata } from "next";
import { FreightCalculator } from "@/components/freight/freight-calculator";

export const metadata: Metadata = {
  title: "Yol pulu kalkulyatoru",
  description: "Bid.cars lot linkindən ştat və hərraca görə təxmini daşıma haqqı.",
};

export default function FreightPage() {
  return <FreightCalculator />;
}
