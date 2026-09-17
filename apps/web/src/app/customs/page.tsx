import type { Metadata } from "next";
import { CustomsCalculator } from "@/components/customs/customs-calculator";

export const metadata: Metadata = {
  title: "Gömrük kalkulyatoru",
  description: "Dövlət Gömrük Komitəsinin rəsmi avtomobil kalkulyatoru ilə idxal rüsumlarının təxmini hesablanması.",
};

export default function CustomsPage() {
  return <CustomsCalculator />;
}
