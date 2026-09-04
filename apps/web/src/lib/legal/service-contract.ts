export type ContractFields = {
  number: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  customerAddress?: string | null;
  customerIdNumber?: string | null;
  trackingCode?: string | null;
  vin?: string | null;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  origin?: string | null;
  amountUsd?: string | null;
  amountAzn?: string | null;
  paymentNote?: string | null;
  extraTerms?: string | null;
};

export type ContractSection = { id: string; title: string; paragraphs: string[] };

export type ContractBody = {
  kicker: string;
  title: string;
  intro: string;
  sections: ContractSection[];
};

function dash(value?: string | number | null) {
  if (value === undefined || value === null) return 'göstərilməyib';
  const text = String(value).trim();
  return text || 'göstərilməyib';
}

function originLabel(origin?: string | null) {
  const map: Record<string, string> = {
    USA: 'Amerika Birləşmiş Ştatları',
    KR: 'Koreya Respublikası',
    CN: 'Çin Xalq Respublikası',
    OTHER: 'tərəflərin razılaşdırdığı digər ixrac ölkəsi',
  };
  if (!origin) return 'Müştərinin sonrakı tapşırığında göstəriləcək ixrac ölkəsi';
  return map[origin] ?? origin;
}

export function buildContractBody(fields: ContractFields): ContractBody {
  const today = new Date().toLocaleDateString('az-AZ');
  const assignedCar = [fields.year, fields.make, fields.model].filter(Boolean).join(' ');

  return {
    kicker: 'Xidmət müqaviləsi · elektron sənəd',
    title: `Müştəri xidmət müqaviləsi № ${fields.number}`,
    intro: `Bu müqavilə ${today} tarixindən etibarən Auto Nex («İcraçı») ilə aşağıda göstərilən müştəri («Müştəri») arasında, konkret avtomobil alınmazdan əvvəl bağlanır. Avtomobil sonradan Müştərinin tapşırığı ilə alınır və bu müştəriyə təyin olunur. Sənəd Azərbaycan Respublikasının Mülki Məcəlləsinə, «Elektron imza və elektron sənəd haqqında» Qanuna, «Fərdi məlumatlar haqqında» 11 may 2010-cu il, 998-IIIQ Qanununa uyğundur. Müştəri telefon OTP kodu və əl imzası ilə bu mətni qəbul edir.`,
    sections: [
      {
        id: 'terefler',
        title: '1. Tərəflər',
        paragraphs: [
          `İcraçı: Auto Nex. Fəaliyyət yeri: Bakı şəhəri, Bakıxanov qəsəbəsi. E-poçt: auto@nex.autos. Telefon və WhatsApp: 070 966 81 11 (əsas), 070 964 64 66, 099 730 03 13.`,
          `Müştəri: ${dash(fields.customerName)}. Telefon: ${dash(fields.customerPhone)}. E-poçt: ${dash(fields.customerEmail)}. Ünvan: ${dash(fields.customerAddress)}. Şəxsiyyət vəsiqəsinin FİN / sənəd nömrəsi: ${dash(fields.customerIdNumber)}.`,
          'Müştəri bəyan edir ki, verdiyi məlumatlar doğrudur, o, müqavilə bağlamaq hüquq qabiliyyətinə malikdir və bu sənədi öz iradəsi ilə imzalayır. Hüquqi şəxs adından imza atılırsa, imza edən şəxs təmsil səlahiyyətini təsdiq edir.',
        ],
      },
      {
        id: 'predmet',
        title: '2. Müqavilənin predmeti',
        paragraphs: [
          `İcraçı Müştərinin tapşırığı ilə ${originLabel(fields.origin)} üzrə avtomobilin seçilməsi, hərrac və ya təchizatçı vasitəsilə alınması, dəniz daşınması, sənədləşmə, gömrük müşayiəti və Azərbaycana çatdırılmanın təşkili xidmətini göstərir.`,
          'Bu müqavilə konkret VIN, lot və izləmə kodu olmadan bağlanır. Əvvəl müştəri münasibəti qurulur; maşın sonra alınır və bu Müştəriyə təyin olunur. Konkret lot, maksimum qiymət və şərtlər sonrakı yazılı, e-poçt və ya WhatsApp tapşırığında göstərilir və bu müqavilənin tərkib hissəsi olur.',
          assignedCar || fields.vin
            ? `Təyin olunmuş (və ya razılaşdırılmış) avtomobil: ${assignedCar || 'göstərilməyib'}. VIN: ${dash(fields.vin)}. İzləmə kodu: ${dash(fields.trackingCode)}.`
            : 'İmza anında konkret avtomobil hələ yoxdur. Alışdan sonra VIN, marka, model və izləmə kodu Auto Nex reyestrində bu müqaviləyə bağlanır; Müştəri izləmə səhifəsində görür.',
          'Auto Nex hərrac platforması, gəmi xətti, liman və ya gömrük orqanı deyil. O, idxal agenti və təşkilatçıdır.',
        ],
      },
      {
        id: 'huquqi-esas',
        title: '3. Hüquqi forma və elektron imza',
        paragraphs: [
          'Azərbaycan Respublikasının Mülki Məcəlləsinə görə müqavilə tərəflərin iradə ifadəsinin uzlaşmasıdır. Yazılı forma kağız daşıyıcıda və ya elektron sənəd şəklində ola bilər.',
          '«Elektron imza və elektron sənəd haqqında» Qanuna əsasən bu sənəd elektron sənəddir. Tərəflər razılaşır ki, Müştərinin imzası sadə elektron imzadır (qualified / ASAN İmza sertifikatı tələb olunmur) və aşağıdakı elementlərin məcmusundan ibarətdir: (a) müqavilə mətninin tam oxunması və qəbul qutularının işarələnməsi; (b) Müştəriyə məxsus mobil nömrəyə göndərilən birdəfəlik SMS/OTP kodunun daxil edilməsi; (c) ekranda əl ilə çəkilmiş imza təsviri; (ç) imza anının tarix-saatı, IP ünvanı, brauzer məlumatı və sənədin SHA-256 bütövlük kodu.',
          'Tərəflər bu sadə elektron imzanın kağız üzərindəki əl imzası ilə eyni hüquqi nəticə doğurmasını, müqavilənin bağlanması, dəyişdirilməsi və icrası üçün kifayət etməsini qəbul edirlər. OTP kodu üçüncü şəxsə verilməməlidir. Telefon Müştərinin nəzarətində deyilsə, o, İcraçını dərhal xəbərdar etməlidir.',
        ],
      },
      {
        id: 'herrec',
        title: '4. Tapşırıq, hərrac və avtomobilin vəziyyəti',
        paragraphs: [
          'Alış yalnız Müştərinin yazılı, e-poçt və ya WhatsApp tapşırığında göstərilən lot, maksimum qiymət və şərtlər daxilində icra olunur. Tapşırıq bu müqavilənin tərkib hissəsidir.',
          'Hərrac avtomobilləri, bir qayda olaraq, «olduğu kimi» (as-is) satılır: zədə, söküntü, məhdud yoxlama və gizli qüsur riski mövcuddur. İcraçı hərrac foto, VIN və əlçatan hesabatları nəzərdən keçirir; bu, mühərrik, sürətlər qutusu, elektronika, ramka və lak-boya üzrə gizli çatışmazlığın olmadığına zəmanət deyil.',
          'Lotun hərracda satılması, geri çəkilməsi və ya təsvirinin dəyişməsi İcraçının təkbaşına nəzarətində deyil. Belə halda tərəflər əvəzedici lot və ya hesablaşma qaydasını razılaşdırır.',
        ],
      },
      {
        id: 'qiymet',
        title: '5. Qiymət, faktura və ödəniş',
        paragraphs: [
          `Razılaşdırılmış xidmət və/və ya avtomobil məbləği: ${fields.amountUsd ? `${fields.amountUsd} USD` : 'faktura üzrə'}${fields.amountAzn ? `; təqribi ${fields.amountAzn} AZN` : ''}. ${fields.paymentNote?.trim() ? `Ödəniş qeydi: ${fields.paymentNote.trim()}` : 'Dəqiq bölgü (hərrac, daşınma, sənəd, xidmət haqqı) rəsmi fakturada göstərilir.'}`,
          'Gömrük rüsumu, ƏDV, rüsumlar və dövlət ödənişləri Azərbaycan qanunvericiliyinə və rəsmiləşdirmə anındakı tariflərə görə Müştərinin öhdəliyidir, əgər yazılı şəkildə başqa cür razılaşdırılmayıbsa. İlkin smeta istiqamətləndiricidir.',
          'Hərrac və ixrac ödənişləri xarici valyutada və qısa müddətdə tələb oluna bilər. Gecikmə lotun itirilməsi, cərimə, saxlama (storage/demurrage) və əlavə xərcə səbəb ola bilər; bunlar müvafiq hərracın, anbarın və ya xəttin qaydalarından irəli gəlir və Müştəriyə aiddir.',
        ],
      },
      {
        id: 'icareci',
        title: '6. İcraçının öhdəlikləri',
        paragraphs: [
          'İcraçı xidməti peşəkar qayğı ilə təşkil edir: tapşırıq hüdudunda alış, daşınma zəncirinin qurulması, mövcud məlumatın izləmə kodunda əks etdirilməsi, sənəd və gömrük müşayiəti.',
          'Konteyner, gəmi, IMO, liman və mərhələ məlumatı əldə olunduqca Müştəriyə izləmə səhifəsi və/və ya WhatsApp/SMS ilə bildirilir. Üçüncü tərəfin gecikməsi və ya natamam datası izləməni məhdudlaşdıra bilər.',
          'İcraçı Müştərinin fərdi məlumatlarını yalnız müqavilənin icrası, qanuni uçot və gömrük/daşınma zənciri üçün emal edir.',
        ],
      },
      {
        id: 'musteri',
        title: '7. Müştərinin öhdəlikləri',
        paragraphs: [
          'Müştəri düzgün ad, telefon, e-poçt, ünvan və şəxsiyyət məlumatı verir; ödənişləri faktura müddətində həyata keçirir; gömrük və qeydiyyat üçün tələb olunan sənədləri vaxtında təqdim edir.',
          'Müştəri hərrac təsvirini, zədə qeydini və «as-is» riskini qəbul edir. Əlavə yoxlama, skan və ya ekspertiza ayrıca ödənişlə razılaşdırılır.',
          'Müştəri OTP kodunu və imza səhifəsinin keçidini gizli saxlayır. Keçidin üçüncü şəxsə ötürülməsi onun riskinə aiddir.',
        ],
      },
      {
        id: 'dasinma',
        title: '8. Daşınma, müddət və fors-major',
        paragraphs: [
          'Çatdırılma müddəti gəmi reysi, yükləmə pəncərəsi, konteyner yığımı, liman növbəsi və təyinat dəhlizindən asılıdır. Bildirilən gün sayı və ETA istiqamətləndiricidir, təqvim üzrə zəmanətli təhvil günü deyil.',
          'ABŞ, Koreya və Çin xətlərinin hamısı gəmi cədvəlinə tabedir; səfər həm qısa, həm də uzana bilər.',
          'Fors-major: müharibə, sanksiya, epidemiya, təbii fəlakət, limanın bağlanması, gəmi qəzası, dövlət qadağası, daşıyıcının dayandırılması. Belə hallarda müddətlər uzadılır; tərəflər mümkün alternativdə razılaşır. İcraçı yalnız öz təqsiri ilə vurulmuş birbaşa zərərə görə, ödənilmiş xidmət haqqı həddində məsuliyyət daşıyır; dolayı itki, mənfəət itkisi və cərimə tələbi istisna olunur — qanunun məcburi normaları qorunmaqla.',
        ],
      },
      {
        id: 'gomruk',
        title: '9. Gömrük və qeydiyyat',
        paragraphs: [
          'Gömrük rəsmiləşdirməsi Azərbaycan qanunvericiliyinə tabedir. Broker, ekspertiza, rüsum və vergi Müştərinin iştirakı və ödənişi ilə aparılır.',
          'İdxal qadağanı, əlavə yoxlama və ya sənəd çatışmazlığı təhvil müddətini uzada bilər. Yanlış bəyanetmənin nəticəsi bəyan edən tərəfə aiddir.',
        ],
      },
      {
        id: 'melumat',
        title: '10. Fərdi məlumatlar',
        paragraphs: [
          'Emal «Fərdi məlumatlar haqqında» Qanun və Konstitusiyanın 32-ci maddəsi əsasında: müqavilənin bağlanması və icrası, qanuni uçot, gömrük və daşınma zənciri üçün aparılır.',
          'VIN, ad, telefon, e-poçt və göndəriş rekvizitləri ABŞ, Koreya, Çin və tranzit ölkələrdəki hərrac, daşıyıcı və limanlara müqavilənin icrası üçün ötürülə bilər. Ətraflı qaydalar nex.autos/privacy səhifəsindədir.',
          'İmza jurnalı (OTP təsdiqi, imza təsviri, hash, IP, vaxt) müqavilənin sübutu kimi saxlanılır.',
        ],
      },
      {
        id: 'mueyyenlik',
        title: '11. Sənədin bütövlüyü və sübut',
        paragraphs: [
          'İmza anında sənədin SHA-256 kodu hesablanır və PDF-ə yazılır. Sonrakı dəyişiklik hash-i pozur. PDF, OTP jurnalı və əl imzası təsviri müqavilənin bağlanmasına dair sübutdur.',
          'Keçid unikal və məxfidir. İmzalanmış nüsxə Auto Nex «Müqavilələr» reyestrində və Müştəriyə göndərilən keçiddə əlçatandır.',
        ],
      },
      {
        id: 'muebahise',
        title: '12. Mübahisələr və yekun müddəalar',
        paragraphs: [
          'Müqavilə Azərbaycan Respublikasının qanunvericiliyinə tabedir. Aidiyyət: Bakı şəhərinin səlahiyyətli məhkəmələri, qanunun məcburi aidiyyət qaydaları qorunmaqla.',
          'Əgər hər hansı müddəa etibarsız sayılarsa, qalan müddəalar qüvvədə qalır. Dəyişiklik eyni elektron qaydada və ya yazılı razılıqla edilir.',
          'Saytdakı ümumi istifadə şərtləri (nex.autos/terms) bu müqaviləyə zidd olmadığı hallarda tətbiq olunur; ziddiyyətdə bu sənəd üstün tutulur.',
          fields.extraTerms?.trim()
            ? `Tərəflərin əlavə razılaşması: ${fields.extraTerms.trim()}`
            : 'Əlavə xüsusi şərt bu mətndə yoxdur; sonrakı WhatsApp/e-poçt tapşırıqları bu müqavilənin icrası çərçivəsindədir.',
        ],
      },
      {
        id: 'imza',
        title: '13. İmza rekvizitləri',
        paragraphs: [
          `Müştəri ${dash(fields.customerName)}, telefon ${dash(fields.customerPhone)}, bəyan edir: müqavilənin 1–13-cü bölmələrini oxudum; xidmətin mahiyyətini, «as-is» riskini, ödəniş və gömrük öhdəliyini, elektron imzanın hüquqi qüvvəsini qəbul edirəm; OTP kodu mənə məxsus nömrəyə gəlib; ekrandakı əl imzası mənim imzamdır.`,
          'İcraçı tərəfi: Auto Nex — auto@nex.autos — 070 966 81 11. İcraçının qəbulu müqavilənin sistemdə qeydə alınması və PDF-in formalaşması ilə təsdiqlənir.',
        ],
      },
    ],
  };
}
