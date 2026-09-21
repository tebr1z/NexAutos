import { api } from "@/lib/api";

export type CustomsDuty = {
  duties: { code: string; name: string; value: number }[];
  total: { name: string; value: number };
  customsCost: number;
  usdCourse: number;
};

export async function fetchCustomsDuty(input: {
  locale: string;
  invoiceUsd: number;
  freightUsd: number;
  year: number;
  engineCc: number;
  fuelCode?: string;
  otherUsd?: number;
}): Promise<CustomsDuty & { engineName?: string }> {
  const options = await api.customsOptions(input.locale);
  const engines = [...(options.AutoEngineTypes ?? [])].sort(
    (a, b) => Number(a.code) - Number(b.code) || a.name.localeCompare(b.name, "az"),
  );
  const autoType = options.AutoCategories?.[0]?.code;
  const match = input.fuelCode ? engines.find((row) => row.code === input.fuelCode) : null;
  const benzine = engines.find((row) => row.code === "1") ?? engines[0];
  const picked = match ?? benzine;
  if (!autoType || !picked) {
    throw new Error("Gömrük növü tapılmadı.");
  }
  const data = await api.customsAutoDuty(
    {
      autoType,
      engineType: picked.abbreviation2,
      engine: input.engineCc,
      commerceType: "nonFree",
      issueDate: `${input.year}-06-01`,
      price: input.invoiceUsd,
      transportExpenses: input.freightUsd,
      otherExpenses: input.otherUsd ?? 0,
    },
    input.locale,
  );
  const duty = data.autoDuty;
  if (!duty) throw new Error("Gömrük nəticəsi boş qayıtdı.");
  return { ...duty, engineName: picked.name };
}

export function dutyUsd(duty: CustomsDuty) {
  const course = Number(duty.usdCourse) || 0;
  const azn = Number(duty.total?.value) || 0;
  if (course <= 0) return 0;
  return Math.round((azn / course) * 100) / 100;
}
