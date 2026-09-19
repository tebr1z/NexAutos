import type { ContractBody, ContractFields } from "./contract-text";

export type ContractLocale = "az" | "en" | "ru" | "tr";

export function normalizeContractLocale(raw?: string | null): ContractLocale {
  const v = (raw || "").toLowerCase();
  if (v === "en" || v === "ru" || v === "tr") return v;
  return "az";
}

const MISSING: Record<ContractLocale, string> = {
  az: "göstərilməyib",
  en: "not specified",
  ru: "не указано",
  tr: "belirtilmedi",
};

function dash(value: string | number | null | undefined, lang: ContractLocale) {
  if (value === undefined || value === null) return MISSING[lang];
  const text = String(value).trim();
  return text || MISSING[lang];
}

export function buildInsuranceContractBody(fields: ContractFields, locale?: string | null): ContractBody {
  const lang = normalizeContractLocale(locale);
  const today = new Date().toLocaleDateString(lang === "en" ? "en-GB" : lang === "ru" ? "ru-RU" : lang === "tr" ? "tr-TR" : "az-AZ");
  const car = [fields.year, fields.make, fields.model].filter(Boolean).join(" ");
  const trustee =
    fields.extraTerms?.trim() ||
    ({
      az: "Göstərilməyib — sığorta olunan Müştərinin özüdür",
      en: "Not specified — the insured is the Customer",
      ru: "Не указано — застрахованный сам Клиент",
      tr: "Belirtilmedi — sigortalı Müşterinin kendisidir",
    }[lang]);
  const amount =
    fields.amountAzn?.trim() ||
    ({
      az: "İlk mərhələdə yazılmayıb — sonra əlavə olunacaq",
      en: "Not set at the start — will be added later",
      ru: "Сначала не указано — будет добавлено позже",
      tr: "Başta yazılmadı — sonra eklenecek",
    }[lang]);

  const copy = {
    az: {
      kicker: "Sığorta müqaviləsi · elektron sənəd",
      title: `Nəqliyyat vasitəsinin sığorta müqaviləsi № ${fields.number}`,
      intro: `Bu sığorta müqaviləsi ${today} tarixindən Auto Nex ilə Müştəri arasında bağlanır. Müştəri telefon OTP kodu və əl imzası ilə şərtləri qəbul edir. İmza tamamlandıqdan sonra sığorta haqqı qısa müddətdə göstərilən hesaba köçürülür.`,
      s1: "1. Tərəflər",
      s2: "2. Müqavilənin predmeti",
      s3: "3. Sığorta haqqı və köçürmə",
      s4: "4. Elektron imza",
      s5: "5. Tərəflərin vəzifələri",
      s6: "6. Yekun",
      org: "Sığorta təşkilatçısı",
      addr: "Ünvan",
      addrV: "Bakı şəhəri, Bakıxanov qəsəbəsi",
      customer: "Müştəri / sığorta olunan",
      phone: "Telefon",
      doc: "Şəxsiyyət vəsiqəsi seriyası",
      trustee: "Etibar edilən şəxs",
      car: "Avtomobil",
      vin: "VIN",
      track: "İzləmə kodu",
      amount: "Ayrılan məbləğ (AZN)",
      p2a: "Bu müqavilə idxal olunan və ya hələ alınmamış avtomobil üzrə sığorta təşkili, sənədləşmə və sığorta haqqının rəsmiləşdirilməsini əhatə edir. Avtomobil sistemdə olmasa belə VIN, marka və model bu sənədə yazılır.",
      p2b: "Sığorta şərtləri, müddət və ödəniş Auto Nex-in sığorta tərəfdaşı ilə razılaşdırılmış tarifə uyğundur.",
      p3a: "Hesab rekvizitləri Auto Nex tərəfindən Müştəriyə bildirilir.",
      p3b: "Müştəri bu müqaviləni imzaladıqdan sonra sığorta haqqı qısa müddətdə göstərilən bank hesabına köçürülür.",
      p3c: "Köçürmə tamamlanandan sonra Auto Nex admin təsdiqi ilə müştəriyə elektron çek göndərir: pul sizə köçürülmüşdür.",
      p4a: "Müqavilə «Elektron imza və elektron sənəd haqqında» Qanuna uyğun elektron sənəd sayılır.",
      p4b: "Telefon OTP və əl imzası Müştərinin iradə ifadəsidir. İmza edilmədən sığorta aktiv sayılmır.",
      p5a: "Müştəri doğru ad, soyad, vəsiqə seriyası və (varsa) VIN / marka / model verir.",
      p5b: "Auto Nex sığorta sənədlərini hazırlayır və imzadan sonra ödənişi təşkil edir.",
      date: "İmza tarixi",
      num: "Müqavilə nömrəsi",
      p6: "Müştəri müqaviləni tam oxuduğunu və sığorta haqqının imzadan sonra hesaba köçürüləcəyini qəbul edir.",
    },
    en: {
      kicker: "Insurance contract · electronic document",
      title: `Motor vehicle insurance contract No. ${fields.number}`,
      intro: `This insurance contract is concluded on ${today} between Auto Nex and the Customer. The Customer accepts the terms with an SMS OTP and a handwritten signature. After signing, the insurance amount is transferred to the stated account shortly.`,
      s1: "1. Parties",
      s2: "2. Subject",
      s3: "3. Premium and transfer",
      s4: "4. Electronic signature",
      s5: "5. Duties",
      s6: "6. Closing",
      org: "Insurance organizer",
      addr: "Address",
      addrV: "Bakikhanov, Baku",
      customer: "Customer / insured",
      phone: "Phone",
      doc: "ID document series",
      trustee: "Authorized person",
      car: "Vehicle",
      vin: "VIN",
      track: "Tracking code",
      amount: "Allocated amount (AZN)",
      p2a: "This contract covers arranging insurance, paperwork and the premium for an imported vehicle, including a car that is not yet purchased or not yet in the Auto Nex system. VIN, make and model are written on this document.",
      p2b: "Terms, period and payment follow the tariff agreed with Auto Nex’s insurance partner.",
      p3a: "Account details are provided to the Customer by Auto Nex.",
      p3b: "After the Customer signs, the insurance amount is transferred to the stated bank account shortly.",
      p3c: "After the transfer, Auto Nex sends an electronic cheque: the money has been transferred to you.",
      p4a: "This is an electronic document under the Law on Electronic Signature and Electronic Document.",
      p4b: "SMS OTP plus handwritten signature is the Customer’s consent. Insurance is not active until signed.",
      p5a: "The Customer provides a correct name, ID series and, if available, VIN / make / model.",
      p5b: "Auto Nex prepares the insurance documents and arranges payment after signature.",
      date: "Signature date",
      num: "Contract number",
      p6: "The Customer confirms they have read the contract and that the premium will be transferred after signing.",
    },
    ru: {
      kicker: "Договор страхования · электронный документ",
      title: `Договор страхования транспортного средства № ${fields.number}`,
      intro: `Настоящий договор заключён ${today} между Auto Nex и Клиентом. Клиент принимает условия кодом OTP и собственноручной подписью. После подписи страховая сумма вскоре переводится на указанный счёт.`,
      s1: "1. Стороны",
      s2: "2. Предмет",
      s3: "3. Премия и перевод",
      s4: "4. Электронная подпись",
      s5: "5. Обязанности",
      s6: "6. Итог",
      org: "Организатор страхования",
      addr: "Адрес",
      addrV: "Бакиханов, Баку",
      customer: "Клиент / застрахованный",
      phone: "Телефон",
      doc: "Серия удостоверения",
      trustee: "Доверенное лицо",
      car: "Автомобиль",
      vin: "VIN",
      track: "Код отслеживания",
      amount: "Выделенная сумма (AZN)",
      p2a: "Договор покрывает организацию страховки, документы и премию по импортному автомобилю, в том числе ещё не купленному и отсутствующему в системе. VIN, марка и модель вносятся в этот документ.",
      p2b: "Условия, срок и оплата соответствуют тарифу партнёра Auto Nex.",
      p3a: "Реквизиты счёта сообщает Auto Nex.",
      p3b: "После подписи страховая сумма вскоре переводится на указанный счёт.",
      p3c: "После перевода Auto Nex отправляет электронный чек: деньги переведены вам.",
      p4a: "Документ является электронным по закону об электронной подписи.",
      p4b: "OTP и собственноручная подпись — волеизъявление Клиента. Без подписи страховка не действует.",
      p5a: "Клиент указывает верные ФИО, серию документа и при наличии VIN / марку / модель.",
      p5b: "Auto Nex готовит документы и организует выплату после подписи.",
      date: "Дата подписи",
      num: "Номер договора",
      p6: "Клиент подтверждает, что прочитал договор и что сумма будет переведена после подписи.",
    },
    tr: {
      kicker: "Sigorta sözleşmesi · elektronik belge",
      title: `Motorlu taşıt sigorta sözleşmesi No. ${fields.number}`,
      intro: `Bu sigorta sözleşmesi ${today} tarihinde Auto Nex ile Müşteri arasında yapılır. Müşteri SMS OTP ve el imzası ile şartları kabul eder. İmza sonrası sigorta tutarı kısa sürede belirtilen hesaba aktarılır.`,
      s1: "1. Taraflar",
      s2: "2. Konu",
      s3: "3. Prim ve havale",
      s4: "4. Elektronik imza",
      s5: "5. Yükümlülükler",
      s6: "6. Sonuç",
      org: "Sigorta düzenleyici",
      addr: "Adres",
      addrV: "Bakıxanov, Bakü",
      customer: "Müşteri / sigortalı",
      phone: "Telefon",
      doc: "Kimlik seri no",
      trustee: "Yetkili kişi",
      car: "Araç",
      vin: "VIN",
      track: "Takip kodu",
      amount: "Ayrılan tutar (AZN)",
      p2a: "Bu sözleşme ithal veya henüz satın alınmamış, sistemde olmayan bir araç için sigorta düzenlemesini kapsar. VIN, marka ve model bu belgeye yazılır.",
      p2b: "Şartlar, süre ve ödeme Auto Nex sigorta ortağı tarifesine göredir.",
      p3a: "Hesap bilgilerini Auto Nex bildirir.",
      p3b: "Müşteri imzaladıktan sonra sigorta tutarı kısa sürede hesaba aktarılır.",
      p3c: "Havale sonrası Auto Nex elektronik çek gönderir: para size aktarılmıştır.",
      p4a: "Belge, elektronik imza kanununa göre elektronik belgedir.",
      p4b: "OTP ve el imzası Müşterinin iradesidir. İmza olmadan sigorta aktif sayılmaz.",
      p5a: "Müşteri doğru ad, kimlik serisi ve varsa VIN / marka / model verir.",
      p5b: "Auto Nex evrakı hazırlar ve imza sonrası ödemeyi düzenler.",
      date: "İmza tarihi",
      num: "Sözleşme no",
      p6: "Müşteri sözleşmeyi okuduğunu ve tutarın imza sonrası hesaba geçeceğini kabul eder.",
    },
  }[lang];

  return {
    kicker: copy.kicker,
    title: copy.title,
    intro: copy.intro,
    sections: [
      {
        id: "terefler",
        title: copy.s1,
        facts: [
          { label: copy.org, value: "Auto Nex" },
          { label: copy.addr, value: copy.addrV },
          { label: "E-mail", value: "auto@nex.autos" },
          { label: "WhatsApp", value: "070 966 81 11" },
          { label: copy.customer, value: dash(fields.customerName, lang) },
          { label: copy.phone, value: dash(fields.customerPhone, lang) },
          { label: copy.doc, value: dash(fields.customerIdNumber, lang) },
          { label: copy.trustee, value: trustee },
        ],
        paragraphs: [],
      },
      {
        id: "predmet",
        title: copy.s2,
        facts: [
          { label: copy.car, value: car || MISSING[lang] },
          { label: copy.vin, value: dash(fields.vin, lang) },
          { label: copy.track, value: dash(fields.trackingCode, lang) },
        ],
        paragraphs: [copy.p2a, copy.p2b],
      },
      {
        id: "odenis",
        title: copy.s3,
        facts: [
          { label: copy.amount, value: amount },
          { label: "USD", value: dash(fields.amountUsd, lang) },
        ],
        paragraphs: [
          fields.paymentNote?.trim() ? fields.paymentNote.trim() : copy.p3a,
          copy.p3b,
          copy.p3c,
        ],
      },
      { id: "huquqi", title: copy.s4, paragraphs: [copy.p4a, copy.p4b] },
      { id: "vecibeler", title: copy.s5, paragraphs: [copy.p5a, copy.p5b] },
      {
        id: "imza",
        title: copy.s6,
        facts: [
          { label: copy.date, value: today },
          { label: copy.num, value: fields.number },
          { label: copy.doc, value: dash(fields.customerIdNumber, lang) },
        ],
        paragraphs: [copy.p6],
      },
    ],
  };
}
