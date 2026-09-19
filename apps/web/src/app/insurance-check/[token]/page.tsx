import type { Metadata } from "next";
import { InsuranceCheck } from "@/components/tracking/insurance-check";

export const metadata: Metadata = {
  title: "Sığorta çeki",
  description: "Auto Nex sığorta haqqı köçürmə təsdiqi.",
  robots: { index: false, follow: false },
};

export default async function InsuranceCheckPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <InsuranceCheck token={token} />;
}
