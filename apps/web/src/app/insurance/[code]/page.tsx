import type { Metadata } from "next";
import { InsuranceStatus } from "@/components/tracking/insurance-status";

export const metadata: Metadata = {
  title: "Sığorta statusu",
  description: "Auto Nex sığorta məlumatı və ödəniş statusu.",
};

export default async function InsuranceCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <InsuranceStatus code={code} />;
}
