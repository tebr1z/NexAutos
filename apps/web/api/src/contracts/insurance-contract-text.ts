import type { ContractBody, ContractFields } from "./contract-text";

function dash(value?: string | number | null) {
  if (value === undefined || value === null) return "göstərilməyib";
  const text = String(value).trim();
  return text || "göstərilməyib";
}

export function buildInsuranceContractBody(fields: ContractFields): ContractBody {
  const today = new Date().toLocaleDateString("az-AZ");
  const car = [fields.year, fields.make, fields.model].filter(Boolean).join(" ");
  return {
    kicker: "Sığorta müqaviləsi · elektron sənəd",
    title: `Nəqliyyat vasitəsinin sığorta müqaviləsi № ${fields.number}`,
    intro: `Bu sığorta müqaviləsi ${today} tarixindən Auto Nex ilə Müştəri arasında bağlanır. Müştəri telefon OTP kodu və əl imzası ilə şərtləri qəbul edir. İmza tamamlandıqdan sonra sığorta haqqı qısa müddətdə göstərilən hesaba köçürülür.`,
    sections: [
      {
        id: "terefler",
        title: "1. Tərəflər",
        facts: [
          { label: "Sığorta təşkilatçısı", value: "Auto Nex" },
          { label: "Ünvan", value: "Bakı şəhəri, Bakıxanov qəsəbəsi" },
          { label: "E-poçt", value: "auto@nex.autos" },
          { label: "WhatsApp", value: "070 966 81 11" },
          { label: "Müştəri / sığorta olunan", value: dash(fields.customerName) },
          { label: "Telefon", value: dash(fields.customerPhone) },
          { label: "Şəxsiyyət vəsiqəsi seriyası", value: dash(fields.customerIdNumber) },
          {
            label: "Etibar edilən şəxs",
            value: fields.extraTerms?.trim() || "Göstərilməyib — sığorta olunan Müştərinin özüdür",
          },
        ],
        paragraphs: [],
      },
      {
        id: "predmet",
        title: "2. Müqavilənin predmeti",
        facts: [
          { label: "Avtomobil", value: car || "göstərilməyib" },
          { label: "VIN", value: dash(fields.vin) },
          { label: "İzləmə kodu", value: dash(fields.trackingCode) },
        ],
        paragraphs: [
          "Bu müqavilə idxal olunan avtomobil üzrə sığorta təşkili, sənədləşmə və sığorta haqqının rəsmiləşdirilməsini əhatə edir.",
          "Sığorta şərtləri, müddət və ödəniş Auto Nex-in sığorta tərəfdaşı ilə razılaşdırılmış tarifə uyğundur.",
        ],
      },
      {
        id: "odenis",
        title: "3. Sığorta haqqı və köçürmə",
        facts: [
          {
            label: "Ayrılan məbləğ (AZN)",
            value: fields.amountAzn?.trim() || "İlk mərhələdə yazılmayıb — sonra əlavə olunacaq",
          },
          { label: "USD ekvivalent", value: dash(fields.amountUsd) },
        ],
        paragraphs: [
          fields.paymentNote?.trim()
            ? `Ödəniş qeydi: ${fields.paymentNote.trim()}`
            : "Hesab rekvizitləri Auto Nex tərəfindən Müştəriyə bildirilir.",
          "Müştəri bu müqaviləni imzaladıqdan sonra sığorta haqqı qısa müddətdə göstərilən bank hesabına köçürülür.",
          "Köçürmə tamamlanandan sonra Auto Nex admin təsdiqi ilə müştəriyə elektron çek göndərir: pul sizə köçürülmüşdür.",
        ],
      },
      {
        id: "huquqi",
        title: "4. Elektron imza",
        paragraphs: [
          "Müqavilə «Elektron imza və elektron sənəd haqqında» Qanuna uyğun elektron sənəd sayılır.",
          "Telefon OTP və əl imzası Müştərinin iradə ifadəsidir. İmza edilmədən sığorta aktiv sayılmır.",
        ],
      },
      {
        id: "vecibeler",
        title: "5. Tərəflərin vəzifələri",
        paragraphs: [
          "Müştəri doğru ad, soyad və şəxsiyyət vəsiqəsi seriyası verir; dəyişiklik olarsa Auto Nex-ə bildirir.",
          "Auto Nex sığorta sənədlərini hazırlayır, izləmə kodu üzrə statusu yeniləyir və imzadan sonra ödənişi təşkil edir.",
        ],
      },
      {
        id: "imza",
        title: "6. Yekun",
        facts: [
          { label: "İmza tarixi", value: today },
          { label: "Müqavilə nömrəsi", value: fields.number },
          { label: "Şəxsiyyət vəsiqəsi seriyası", value: dash(fields.customerIdNumber) },
        ],
        paragraphs: [
          "Müştəri müqaviləni tam oxuduğunu və sığorta haqqının imzadan sonra hesaba köçürüləcəyini qəbul edir.",
        ],
      },
    ],
  };
}
