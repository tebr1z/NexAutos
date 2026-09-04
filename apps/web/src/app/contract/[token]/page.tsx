import type { Metadata } from "next";
import { ContractSign } from "@/components/contract/contract-sign";

export const metadata: Metadata = {
  title: "Elektron müqavilə",
  description: "Auto Nex xidmət müqaviləsini oxuyun, SMS kodu və əl imzası ilə təsdiqləyin.",
  robots: { index: false, follow: false },
};

export default async function ContractPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ContractSign token={token} />;
}
