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
    intro: `Bu sığorta müqaviləsi ${today} tarixindən Auto Nex («Sığorta təşkilatçısı») ilə Müştəri arasında bağlanır. Müştəri telefon OTP kodu və əl imzası ilə şərtləri qəbul edir. İmza tamamlandıqdan sonra sığorta haqqı qısa müddətdə göstərilən hesaba köçürülür.`,
    sections: [
      {
        id: "terefler",
        title: "1. Tərəflər",
        paragraphs: [
          "Sığorta təşkilatçısı: Auto Nex. Ünvan: Bakı şəhəri, Bakıxanov qəsəbəsi. E-poçt: auto@nex.autos. WhatsApp: 070 966 81 11.",
          `Müştəri / sığorta olunan: ${dash(fields.customerName)}. Telefon: ${dash(fields.customerPhone)}. Şəxsiyyət vəsiqəsi seriyası: ${dash(fields.customerIdNumber)}.`,
          fields.extraTerms
            ? `Etibar edilən şəxs: ${fields.extraTerms}.`
            : "Etibar edilən şəxs ayrıca göstərilməyibsə, sığorta olunan Müştərinin özüdür.",
        ],
      },
      {
        id: "predmet",
        title: "2. Müqavilənin predmeti",
        paragraphs: [
          "Bu müqavilə idxal olunan avtomobil üzrə sığorta təşkili, sənədləşmə və sığorta haqqının rəsmiləşdirilməsini əhatə edir.",
          `Avtomobil: ${car || "göstərilməyib"}. VIN: ${dash(fields.vin)}. İzləmə kodu: ${dash(fields.trackingCode)}.`,
          "Sığorta şərtləri, müddət və ödəniş Auto Nex-in sığorta tərəfdaşı ilə razılaşdırılmış tarifə uyğundur.",
        ],
      },
      {
        id: "odenis",
        title: "3. Sığorta haqqı və köçürmə",
        paragraphs: [
          `Sığorta haqqı (AZN): ${dash(fields.amountAzn)}. USD ekvivalent: ${dash(fields.amountUsd)}.`,
          fields.paymentNote ? `Ödəniş qeydi: ${fields.paymentNote}` : "Hesab rekvizitləri Auto Nex tərəfindən Müştəriyə bildirilir.",
          "Müştəri bu müqaviləni imzaladıqdan sonra sığorta haqqı qısa müddətdə göstərilən bank hesabına köçürülür. Köçürmə barədə qısa SMS göndərilir.",
        ],
      },
      {
        id: "huquqi",
        title: "4. Elektron imza",
        paragraphs: [
          "Müqavilə «Elektron imza və elektron sənəd haqqında» Qanuna uyğun elektron sənəd sayılır.",
          "Telefon OTP + əl imzası Müştərinin iradə ifadəsidir. İmza edilmədən sığorta aktiv sayılmır.",
        ],
      },
      {
        id: "vecibeler",
        title: "5. Tərəflərin vəzifələri",
        paragraphs: [
          "Müştəri doğru ad, soyad və vəsiqə seriyası verir; dəyişiklik olarsa Auto Nex-ə bildirir.",
          "Auto Nex sığorta sənədlərini hazırlayır, izləmə kodu üzrə statusu yeniləyir və imzadan sonra ödənişi təşkil edir.",
        ],
      },
      {
        id: "imza",
        title: "6. Yekun",
        paragraphs: [
          "Müştəri müqaviləni tam oxuduğunu, sığorta haqqının imzadan sonra hesaba köçürüləcəyini qəbul edir.",
          `İmza tarixi: ${today}. Müqavilə nömrəsi: ${fields.number}.`,
        ],
      },
    ],
  };
}
