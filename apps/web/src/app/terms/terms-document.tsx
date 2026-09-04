"use client";

import { useI18n } from "@/providers/i18n-provider";
import { TERMS } from "@/lib/legal/terms";
import { LegalDocument } from "@/components/legal/legal-document";

export function TermsDocument() {
  const { locale } = useI18n();
  return <LegalDocument doc={TERMS[locale]} />;
}
