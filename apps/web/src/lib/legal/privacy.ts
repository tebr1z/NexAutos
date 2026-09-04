import type { Locale } from "@/lib/constants";
import type { LegalDoc } from "./types";

export const PRIVACY: Record<Locale, LegalDoc> = {
  az: {
    kicker: "Hüquqi sənəd",
    title: "Məxfilik siyasəti",
    updated: "Son yeniləmə: 4 sentyabr 2026",
    toc: "Mündəricat",
    intro:
      "Bu siyasət Auto Nex-in fiziki şəxslərin fərdi məlumatlarını hansı hüquqi əsasla, hansı məqsədlə, hansı həcmdə və hansı müddətə emal etdiyini, kimə ötürdüyünü və subyektin hansı hüquqlara malik olduğunu izah edir. Sənəd Azərbaycan Respublikasının Konstitusiyasının 32-ci maddəsinə, «Fərdi məlumatlar haqqında» Azərbaycan Respublikasının 11 may 2010-cu il tarixli 998-IIIQ nömrəli Qanununa, «İnformasiya, informasiyalaşdırma və informasiyanın mühafizəsi haqqında» Qanuna və əlaqəli normativ aktlara uyğun tərtib olunub. Saytdan, izləmə kodundan, məsləhət formasından, WhatsApp və ya e-poçtdan istifadə etməklə bu siyasətdə göstərilən emal haqqında məlumatlandırılmış sayılırsınız.",
    sections: [
      {
        id: "operator",
        title: "1. Operator və əlaqə",
        paragraphs: [
          "Fərdi məlumatların operatoru (emal edən tərəf) Auto Nex-dir. Fəaliyyət ünvanı: Bakı şəhəri, Bakıxanov qəsəbəsi. Rəsmi e-poçt: auto@nex.autos. Əsas WhatsApp və telefon xətti: 070 966 81 11. Digər xətlər: 070 964 64 66, 099 730 03 13.",
          "Fərdi məlumatlarla bağlı müraciət, düzəliş, məhdudlaşdırma, silinmə və ya etiraz üçün yazılı sorğu auto@nex.autos ünvanına və ya yuxarıdakı telefon/WhatsApp xətlərinə göndərilir. Operator sorğunu qanunla nəzərdə tutulan müddətdə, bir qayda olaraq otuz gün ərzində nəzərdən keçirir; mürəkkəb hallarda bu müddət uzadıla bilər və sizə məlumat verilir.",
          "Bu siyasət nex.autos və əlaqəli domenlərə, izləmə səhifəsinə, admin panelinə, məsləhət (inquiry) formasına, SMS/WhatsApp bildirişlərinə və Auto Nex əməkdaşları ilə yazışmalara şamil olunur.",
        ],
      },
      {
        id: "anlayis",
        title: "2. Anlayışlar",
        paragraphs: [
          "«Fərdi məlumat» — konkret fiziki şəxsi birbaşa və ya dolayısı ilə eyniləşdirməyə imkan verən istənilən məlumatdır (ad, soyad, telefon, e-poçt, ünvan, VIN ilə bağlı müştəri bağı, izləmə kodu, ödəniş rekvizitləri, foto və sənəd təsvirləri).",
          "«Emal» — toplama, qeydəalma, sistemləşdirmə, saxlama, dəyişdirmə, bərpa, istifadə, ötürmə, dərc, məhv etmə və qanunda nəzərdə tutulan digər əməliyyatlardır.",
          "«Subyekt» — fərdi məlumatları emal olunan fiziki şəxsdir (müştəri, sorğu göndərən, avtomobili qəbul edən vəkalətli şəxs).",
          "«Razılıq» — subyektin emala dair azad, konkret, məlumatlı iradə ifadəsidir. Razılıq yazılı, elektron və ya xidmətin icrası üçün zəruri hərəkətlə (forma göndərmək, kod vermək, WhatsApp-da tapşırıq yazmaq) verilə bilər.",
        ],
      },
      {
        id: "esas",
        title: "3. Hüquqi əsaslar",
        paragraphs: [
          "Emal aşağıdakı əsaslardan biri və ya bir neçəsi üzrə aparılır: (a) subyektin razılığı; (b) idxal, daşınma, gömrük və çatdırılma müqaviləsinin bağlanması və icrası; (c) Auto Nex-in qanuni vəzifələri (vergi, mühasibat, gömrük sənədləşməsi); (ç) subyektin və ya üçüncü şəxsin həyati mənafelərinin qorunması; (d) qanunun birbaşa tələbi.",
          "Xüsusi kateqoriya məlumatlar (səhiyyə, biometrik identifikasiya və s.) məqsədli toplanılmır. Əgər hərrac sənədində belə məlumat təsadüfən olarsa, yalnız xidmətin icrası üçün zəruri həcmdə və qısa müddətə saxlanılır.",
          "Uşaqlara (18 yaşdan aşağı) xidmət yönəlməyib. Belə məlumatın səhvən daxil olduğu məlum olarsa, o, silinir və valideyn/qanuni nümayəndə məlumatlandırılır.",
        ],
      },
      {
        id: "mece",
        title: "4. Hansı məlumatlar toplanır",
        paragraphs: [
          "Məsləhət forması: ad, e-poçt, telefon, müraciət mətni (marka, model, büdcə və s.), göndərilmə vaxtı.",
          "Sifariş və göndəriş: müştəri adı, WhatsApp/telefon, e-poçt, VIN, marka, model, il, izləmə kodu, konteyner və gəmi məlumatı, limanlar, tranzitlər, mərhələ tarixləri, foto (hərrac, depo, gövdə, salon, mühərrik, zədə, yükləmə), sənəd adları, faktura nömrəsi və məbləği, gömrük statusu, admin qeydləri.",
          "İzləmə: kodun daxil edilməsi, baxılan göndərişə aid açıq məlumat. İzləmə üçün müştəri hesabı tələb olunmur.",
          "Texniki və tənzimləmə məlumatı: interfeys dili (anx_locale), valyuta (anx_currency), tema (theme cookie və localStorage), brauzerdə müvəqqəti sifariş nüsxəsi (anx_local_orders), admin girişi üçün token (anx_token), sessiyanın ilk yüklənməsi (sessionStorage). IP ünvanı, brauzer növü və sorğu vaxtı server jurnallarında təhlükəsizlik və nasazlıq analizi üçün qısa müddətə düşə bilər.",
          "WhatsApp, telefon və SMS: nömrə, yazışma məzmunu, mərhələ bildirişinin göndərilmə statusu. Bildiriş yalnız siz nömrə verdikdə göndərilir.",
          "Ödəniş: faktura və köçürmə təsdiqi. Kart məlumatını Auto Nex saytında saxlamır; bank və ya ödəniş qurumu öz qaydaları ilə işləyir.",
        ],
      },
      {
        id: "meqsed",
        title: "5. Emalın məqsədləri",
        paragraphs: [
          "Məlumat yalnız konkret, qanuni və əvvəlcədən bəyan edilmiş məqsədlə emal olunur: avtomobil seçimi və hərrac tapşırığı; idxal və dəniz daşınmasının təşkili; gömrük sənədləşməsi; izləmə kodunun verilməsi və mərhələlərin yenilənməsi; təhvil; hesablaşma və vergi uçotu; müraciətlərə cavab; fırıldaqçılıq və təhlükəsizlik; hüquqi mübahisələrin sübutu.",
          "Marketinq göndərişi ayrıca razılıq olmadan edilmir. Mərhələ SMS/WhatsApp əməliyyat xarakterlidir, reklam deyil.",
          "Məqsəd dəyişərsə, qanun tələb etdikdə yeni razılıq alınır və ya müqavilənin icrası üçün zərurət ayrıca izah olunur.",
        ],
      },
      {
        id: "menbe",
        title: "6. Məlumatın mənbəyi",
        paragraphs: [
          "Əsas mənbə sizsiniz: forma, WhatsApp, telefon, e-poçt, ofisə təqdim edilən sənəd.",
          "İkinci mənbələr xidmətin icrası üçün zəruri olduqda: hərrac platformaları və lisenziyalı tərəfdaşlar (lot, VIN, foto); daşıyıcı və liman (konteyner, gəmi, IMO, mövqe); gömrük brokeri və dövlət orqanları (rəsmiləşdirmə statusu); AIS/gəmi mövqeyi xidmətləri (açıq və ya müqaviləli mənbə).",
          "Üçüncü şəxsdən məlumat gələrsə, operator qanuni əsas və məqsədi yoxlayır; əsassız məlumat emal olunmur.",
        ],
      },
      {
        id: "cookie",
        title: "7. Cookie və yerli yaddaş",
        paragraphs: [
          "Sayt funksional cookie və brauzer yaddaşından istifadə edir. «theme» cookie və localStorage interfeysin tünd/açıq rejimini saxlayır (təxminən 12 ay). «anx_locale» dili, «anx_currency» valyutanı yadda saxlayır. Bunlar reklam profili üçün deyil, təcrübənin kəsilməməsi üçündür.",
          "Admin panelində «anx_token» daxilolmanı saxlayır. Çıxış zamanı silinir. «anx_local_orders» göndərişin brauzerdə ehtiyat nüsxəsi ola bilər; təhvilindən sonra arxiv müddəti bitəndə silinə bilər.",
          "Brauzerinizdə cookie-ni məhdudlaşdıra bilərsiniz. Funksional cookie söndürülərsə, dil, tema və bəzi izləmə rahatlığı işləməyə bilər. Reklam və izləmə şəbəkəsi cookie-si quraşdırılmır, əgər sonradan əlavə olunarsa, bu siyasət yenilənəcək və zəruri olduqda razılıq soruşulacaq.",
        ],
      },
      {
        id: "oturmə",
        title: "8. Üçüncü tərəflərə ötürmə",
        paragraphs: [
          "Məlumat yalnız məqsəd üçün zəruri həcmdə ötürülür: hərrac və lisenziyalı tərəfdaş (alışın icrası); dəniz xətti, ekspeditor, liman (konteyner və reys); gömrük brokeri və Azərbaycan gömrük orqanları (rəsmiləşdirmə); bank və ödəniş qurumu (hesablaşma); WhatsApp/SMS infrastrukturu (Twilio və ya Meta WhatsApp Cloud — yalnız bildiriş üçün verdinizsə); hosting və texniki xidmət (server, ehtiyat nüsxə) müqavilə və məxfilik öhdəliyi ilə.",
          "Dövlət orqanına məlumat yalnız qanunun tələbi, məhkəmə qərarı və ya gömrük/vergi icrası üçün verilir.",
          "Məlumat açıq elan, satış və ya əlaqəsiz marketinq üçün üçüncü şəxslərə satılmır.",
        ],
      },
      {
        id: "xaric",
        title: "9. Ölkədən kənara ötürmə",
        paragraphs: [
          "İdxal zənciri ABŞ, Koreya, Çin və tranzit ölkələrdəki hərrac, daşıyıcı və limanlarla bağlıdır. VIN, ad, əlaqə və göndəriş rekvizitləri müqavilənin icrası üçün bu yurisdiksiyalara ötürülə bilər.",
          "«Fərdi məlumatlar haqqında» Qanuna uyğun olaraq transsərhəd ötürmə: subyektin razılığı, müqavilənin icrası, qanuni vəzifə və ya qanunda göstərilən digər əsasla aparılır. Qəbul edən tərəfdən məxfilik və təhlükəsizlik tələb olunur.",
          "Xarici serverdə ehtiyat nüsxə və ya e-poçt infrastrukturu istifadə olunarsa, ötürmə eyni hüquqi əsaslara və texniki mühafizəyə tabedir.",
        ],
      },
      {
        id: "muddet",
        title: "10. Saxlama müddəti",
        paragraphs: [
          "Məlumat məqsəd üçün zəruri olan müddətdən artıq saxlanılmır, qanuni saxlama öhdəliyi istisna olmaqla.",
          "Aktiv göndəriş: təhvilədək. Təhvil verilmiş göndərişin izləmə arxivi adətən otuz gün; mühasibat, vergi və gömrük sənədləri Azərbaycanın mühasibat və vergi qanunvericiliyində nəzərdə tutulan müddət ərzində (bir qayda olaraq azı beş il) saxlanılır.",
          "Məsləhət müraciətləri cavab və sübut üçün ağlabatan müddətdə, adətən iki ilədək, sonra silinir və ya anonimləşdirilir, hüquqi mübahisə yoxdursa.",
          "Cookie və localStorage müddəti yuxarıda göstərilib. Server jurnalları təhlükəsizlik üçün adətən qısa dövrə (məsələn, doxsan günədək) saxlanır, araşdırma tələb olunmazsa.",
        ],
      },
      {
        id: "tehlukesizlik",
        title: "11. Təhlükəsizlik",
        paragraphs: [
          "Operator təşkilati və texniki tədbirlər görür: giriş hüququnun məhdudlaşdırılması (admin yalnız səlahiyyətli əməkdaş), parol və token, HTTPS, ehtiyat nüsxə, xidmətə görə məlumatın minimumlaşdırılması.",
          "Heç bir internet ötürülməsi tam riskdən azad deyil. WhatsApp və e-poçt üçüncü tərəf şifrələməsinə tabedir. Məxfi sənədi açıq kanalda göndərməzdən əvvəl bunu nəzərə alın.",
          "Pozuntu (leak) ehtimalı yaranarsa, qanun tələb etdikdə subyekt və səlahiyyətli orqan məlumatlandırılır, zərər azaldılır.",
        ],
      },
      {
        id: "huquqlar",
        title: "12. Subyektin hüquqları",
        paragraphs: [
          "«Fərdi məlumatlar haqqında» Qanuna və Konstitusiyanın 32-ci maddəsinə əsasən siz: emal barədə məlumat almaq; öz məlumatınıza çıxış; yanlışlığın düzəldilməsi; qanunsuz emalın dayandırılması; qanuni əsas bitdikdə silinmə və ya məhv; razılığın geri götürülməsi (müqavilə və qanuni uçot öhdəliyi qaldığı hallar istisna olmaqla); məhkəmə və ya səlahiyyətli orqana şikayət etmək hüququna maliksiniz.",
          "Sorğuda şəxsiyyəti təsdiqləyən məlumat tələb oluna bilər ki, başqa şəxsin məlumatı verilməsin. İzləmə kodu üçüncü şəxsdədirsə, kodun sahibi göndərişə baxa bilər; kodu paylaşmaq sizin məsuliyyətinizdir.",
          "Razılığın geri götürülməsi artıq icra olunmuş alış və gömrük öhdəliyini ləğv etmir; gələcək marketinq və qeyri-zəruri bildiriş dayanır.",
        ],
      },
      {
        id: "avtomat",
        title: "13. Avtomatlaşdırılmış qərar",
        paragraphs: [
          "Kredit skoru, avtomatik rədd və ya sizi hüquqi cəhətdən ciddi nəticəyə məruz qoyan tam avtomatlaşdırılmış qərar qəbul edilmir.",
          "İzləmə mərhələsi və gəmi mövqeyi sistemdə göstərilir; alış, qiymət və təhvil qərarları Auto Nex əməkdaşı və sizin tapşırığınızla qəbul olunur.",
        ],
      },
      {
        id: "izleme",
        title: "14. İzləmə kodu və hesab",
        paragraphs: [
          "İzləmə kodu göndərişi hesab olmadan göstərir. Kod gizli saxlanmalıdır. Onu ictimai yerə yerləşdirmək VIN, foto və marşrutu üçüncü şəxslərə aça bilər.",
          "Müştəri hesabı (əgər yaradılarsa) e-poçt və parolla qorunur. Admin girişi yalnız Auto Nex personalınadır.",
          "İctimai nümunə kodlar real müştəri faylı deyil.",
        ],
      },
      {
        id: "foto",
        title: "15. Foto və sənədlər",
        paragraphs: [
          "Hərrac, depo və yükləmə fotoları göndərişin sənədləşdirilməsi və sizin izləmə səhifəniz üçündür. Onlar ümumi internet axtarışına çıxarılmır, izləmə kodunu bilən şəxs görə bilər.",
          "Şəxsiyyət vəsiqəsi, etibarnamə və title surətləri yalnız gömrük və təhvil üçün götürülür, məqsəd bitəndə və qanuni saxlama müddəti keçəndə silinir və ya arxivdə məhdud girişlə saxlanılır.",
        ],
      },
      {
        id: "usaq",
        title: "16. Yetkinlik yaşına çatmayanlar",
        paragraphs: [
          "Xidmət 18 yaşından kiçik şəxslərə yönəlməyib. Belə şəxsin məlumatı qəsdən toplanılmır. Aşkar olunarsa, emal dayandırılır və məlumat silinir, qanun başqa cür tələb etmədikdə.",
        ],
      },
      {
        id: "link",
        title: "17. Üçüncü tərəf saytları",
        paragraphs: [
          "Saytda Copart, IAAI, daşıyıcı və xəritə (məsələn, OpenStreetMap) keçidləri ola bilər. Onların öz məxfilik siyasəti var. Auto Nex həmin saytların emalına nəzarət etmir.",
          "Xəritə və AIS mövqeyi açıq və ya müqaviləli mənbədən gələ bilər; orada şəxsiyyətiniz birbaşa göstərilmir, göndərişin coğrafi mövqeyi göstərilir.",
        ],
      },
      {
        id: "deyisiklik",
        title: "18. Siyasətin yenilənməsi",
        paragraphs: [
          "Qanunvericilik və ya emal dəyişəndə bu sənəd yenilənir. Yeni redaksiya saytda dərc olunur və «Son yeniləmə» tarixi dəyişir. Əhəmiyyətli dəyişiklikdə (yeni məqsəd, yeni ötürülmə) mümkün qədər e-poçt, WhatsApp və ya sayt bildirişi ilə məlumat verilir.",
          "Aktiv göndərişə, əksinə razılaşma yoxdursa, sifariş zamanı qüvvədə olan məqsəd və saxlama qaydaları tətbiq olunmaqda davam edir; yeni cookie və ya marketinq üçün yeni razılıq tələb oluna bilər.",
        ],
      },
      {
        id: "sikayet",
        title: "19. Şikayət və mübahisə",
        paragraphs: [
          "Əvvəlcə auto@nex.autos və ya 070 966 81 11 vasitəsilə operatora müraciət edin.",
          "Razı qalmasanız, Azərbaycan Respublikasının fərdi məlumatların mühafizəsi üzrə səlahiyyətli orqanına və ya məhkəməyə müraciət etmək hüququnuz var. Mübahisələrə Azərbaycan Respublikasının qanunvericiliyi tətbiq olunur; məhkəmə aidiyyəti Bakı üzrə səlahiyyətli məhkəmələrdir, imperativ norma başqa cür tələb etmədikcə.",
        ],
      },
      {
        id: "elaqe",
        title: "20. Hüquqi rekvizitlər",
        paragraphs: [
          "Auto Nex — Bakı şəhəri, Bakıxanov qəsəbəsi. E-poçt: auto@nex.autos. Telefon və WhatsApp: 070 966 81 11 (əsas), 070 964 64 66, 099 730 03 13.",
          "İstifadə şərtləri ayrıca sənəddədir (/terms). Bu məxfilik siyasəti şərtlərin tərkib hissəsi kimi oxunur; ziddiyyət olduqda fərdi məlumatlara dair qanun və bu siyasət üstün tutulur.",
        ],
      },
    ],
  },
  en: {
    kicker: "Legal",
    title: "Privacy policy",
    updated: "Last updated: 4 September 2026",
    toc: "Contents",
    intro:
      "This policy explains the legal basis, purposes, scope and retention of personal data processed by Auto Nex, the recipients of that data and the rights of the data subject. It is prepared in line with Article 32 of the Constitution of the Republic of Azerbaijan, the Law of 11 May 2010 No. 998-IIIQ “On Personal Data”, the Law on Information, Informatisation and Protection of Information, and related acts. By using the site, a tracking code, the consultation form, WhatsApp or email, you are informed of the processing described here.",
    sections: [
      {
        id: "operator",
        title: "1. Operator and contact",
        paragraphs: [
          "The operator of personal data is Auto Nex. Place of business: Bakıxanov, Baku. Official email: auto@nex.autos. Primary WhatsApp and telephone: 070 966 81 11. Other lines: 070 964 64 66, 099 730 03 13.",
          "Requests for access, correction, restriction, erasure or objection are sent in writing to auto@nex.autos or via the telephone/WhatsApp lines above. The operator reviews the request within the period provided by law, as a rule within thirty days; complex cases may take longer, and you will be informed.",
          "This policy covers nex.autos and related domains, tracking, the admin panel, the consultation form, SMS/WhatsApp notices and correspondence with Auto Nex staff.",
        ],
      },
      {
        id: "anlayis",
        title: "2. Definitions",
        paragraphs: [
          "“Personal data” means any information that identifies a natural person directly or indirectly (name, telephone, email, address, customer link to a VIN, tracking code, payment details, photos and document images).",
          "“Processing” means collection, recording, organisation, storage, alteration, retrieval, use, disclosure, publication, destruction and other operations provided by law.",
          "The “data subject” is the natural person whose data are processed (client, enquirer, authorised recipient of a vehicle).",
          "“Consent” is a free, specific and informed expression of will. It may be given in writing, electronically or by an act necessary to receive the service (submitting a form, providing a code, giving an instruction on WhatsApp).",
        ],
      },
      {
        id: "esas",
        title: "3. Legal bases",
        paragraphs: [
          "Processing rests on one or more of: (a) consent of the data subject; (b) conclusion and performance of the import, carriage, customs and delivery engagement; (c) Auto Nex’s legal duties (tax, accounts, customs files); (d) vital interests of the subject or a third person; (e) a direct statutory requirement.",
          "Special-category data (health, biometric identification and the like) are not collected as a purpose. If such data appear incidentally in an auction file, they are kept only to the extent and for the time needed to perform the service.",
          "The service is not directed at children under 18. If such data are received in error, they are deleted and a parent or legal representative is informed.",
        ],
      },
      {
        id: "mece",
        title: "4. Data we collect",
        paragraphs: [
          "Consultation form: name, email, telephone, message (make, model, budget and similar), time of sending.",
          "Order and shipment: customer name, WhatsApp/telephone, email, VIN, make, model, year, tracking code, container and vessel data, ports, transits, stage timestamps, photos (auction, depot, exterior, interior, engine, damage, loading), document titles, invoice number and amount, customs status, staff notes.",
          "Tracking: entry of a code and the public fields of that shipment. No customer account is required to track.",
          "Technical settings: interface language (anx_locale), currency (anx_currency), theme (theme cookie and localStorage), a browser copy of orders (anx_local_orders), admin token (anx_token), first-load session flag. IP address, browser type and request time may appear in server logs for a short period for security and fault analysis.",
          "WhatsApp, telephone and SMS: number, message content, delivery status of a stage notice. Notices are sent only if you provided a number.",
          "Payment: invoice and transfer confirmation. Card data are not stored on the Auto Nex site; the bank or payment institution acts under its own rules.",
        ],
      },
      {
        id: "meqsed",
        title: "5. Purposes",
        paragraphs: [
          "Data are processed only for specified, lawful purposes stated in advance: vehicle selection and auction instruction; organisation of import and ocean freight; customs files; issuing a tracking code and updating stages; handover; settlement and tax records; answering enquiries; fraud and security; evidence in a legal dispute.",
          "Marketing messages are not sent without separate consent. Stage SMS/WhatsApp is operational, not advertising.",
          "If the purpose changes, fresh consent is obtained where the law requires it, or the necessity for contract performance is explained.",
        ],
      },
      {
        id: "menbe",
        title: "6. Sources",
        paragraphs: [
          "The primary source is you: form, WhatsApp, telephone, email, documents handed over at the studio.",
          "Secondary sources, where needed to perform the service: auction platforms and licensed partners (lot, VIN, photos); carrier and terminal (container, vessel, IMO, position); customs broker and public authorities (clearance status); AIS/vessel position services (public or contracted).",
          "If data arrive from a third person, the operator checks the legal basis and purpose; data without a basis are not processed.",
        ],
      },
      {
        id: "cookie",
        title: "7. Cookies and local storage",
        paragraphs: [
          "The site uses functional cookies and browser storage. The “theme” cookie and localStorage keep light/dark mode (about 12 months). “anx_locale” stores language, “anx_currency” stores currency. They are not used to build an advertising profile.",
          "The admin panel stores “anx_token” for sign-in. It is removed on logout. “anx_local_orders” may hold a local copy of a shipment; it may be cleared after the archive period following delivery.",
          "You may restrict cookies in the browser. Disabling functional cookies may affect language, theme and some tracking convenience. Advertising or tracking-network cookies are not installed; if that changes, this policy will be updated and consent sought where required.",
        ],
      },
      {
        id: "oturmə",
        title: "8. Recipients",
        paragraphs: [
          "Data are disclosed only in the volume needed for the purpose: auction and licensed partners (to execute a purchase); ocean line, forwarder, terminal (container and sailing); customs broker and Azerbaijani customs (clearance); bank and payment institution (settlement); WhatsApp/SMS infrastructure (Twilio or Meta WhatsApp Cloud — only if you asked for notices); hosting and technical support under contract and confidentiality.",
          "Data are given to a public authority only where the law, a court order or customs/tax performance requires it.",
          "Personal data are not sold for unrelated marketing.",
        ],
      },
      {
        id: "xaric",
        title: "9. Transfers abroad",
        paragraphs: [
          "The import chain involves auctions, carriers and ports in the United States, Korea, China and transit states. VIN, name, contact and shipment references may be transferred to those jurisdictions to perform the contract.",
          "Under the Law on Personal Data, cross-border transfer proceeds on consent, contract performance, a legal duty or another ground listed in the statute. Confidentiality and security are required of the recipient.",
          "If backup or email infrastructure sits on a foreign server, the same legal bases and technical safeguards apply.",
        ],
      },
      {
        id: "muddet",
        title: "10. Retention",
        paragraphs: [
          "Data are not kept longer than needed for the purpose, except where a legal retention duty applies.",
          "Active shipments: until handover. The tracking archive of a delivered car is typically thirty days; accounts, tax and customs files are kept for the period required by Azerbaijani accounting and tax law (as a rule at least five years).",
          "Consultation messages are kept for a reasonable period for reply and proof, typically up to two years, then deleted or anonymised if no dispute is pending.",
          "Cookie and localStorage periods are stated above. Server logs are usually kept for a short cycle (for example up to ninety days) unless an investigation requires otherwise.",
        ],
      },
      {
        id: "tehlukesizlik",
        title: "11. Security",
        paragraphs: [
          "The operator applies organisational and technical measures: restricted access (admin for authorised staff only), passwords and tokens, HTTPS, backups, data minimisation.",
          "No internet transmission is free of all risk. WhatsApp and email follow third-party encryption. Consider this before sending identity documents on an open channel.",
          "If a breach is likely, the data subject and the competent authority are informed where the law requires it, and harm is mitigated.",
        ],
      },
      {
        id: "huquqlar",
        title: "12. Rights of the data subject",
        paragraphs: [
          "Under the Law on Personal Data and Article 32 of the Constitution you may: obtain information about processing; access your data; correct inaccuracy; stop unlawful processing; obtain erasure or destruction when the legal basis ends; withdraw consent (except where contract and statutory records must continue); complain to a court or competent authority.",
          "Identity may be checked so that another person’s data are not released. Anyone who holds a tracking code can view that shipment; sharing the code is your responsibility.",
          "Withdrawal of consent does not unwind an auction or customs duty already performed; future marketing and non-essential notices stop.",
        ],
      },
      {
        id: "avtomat",
        title: "13. Automated decisions",
        paragraphs: [
          "No credit score, automatic refusal or fully automated decision with similarly significant legal effect is taken.",
          "Tracking stages and vessel position are displayed by the system; purchase, price and handover decisions are taken by Auto Nex staff on your instruction.",
        ],
      },
      {
        id: "izleme",
        title: "14. Tracking code and accounts",
        paragraphs: [
          "A tracking code shows the shipment without an account. Keep it confidential. Publishing it can expose VIN, photos and route to third parties.",
          "A customer account, if created, is protected by email and password. Admin access is for Auto Nex staff only.",
          "Demo codes are for illustration and are not a live client file.",
        ],
      },
      {
        id: "foto",
        title: "15. Photos and documents",
        paragraphs: [
          "Auction, depot and loading photos document the shipment and appear on your tracking page. They are not submitted to public search; anyone with the code can see them.",
          "Copies of identity documents, powers of attorney and title are taken only for customs and handover, then deleted or kept in a restricted archive after the legal retention period.",
        ],
      },
      {
        id: "usaq",
        title: "16. Minors",
        paragraphs: [
          "The service is not aimed at persons under 18. Their data are not collected on purpose. If discovered, processing stops and the data are deleted unless the law requires otherwise.",
        ],
      },
      {
        id: "link",
        title: "17. Third-party sites",
        paragraphs: [
          "The site may link to Copart, IAAI, carriers and maps (for example OpenStreetMap). Those services have their own policies. Auto Nex does not control their processing.",
          "Map and AIS position may come from a public or contracted source; your identity is not shown there, only the geography of the shipment.",
        ],
      },
      {
        id: "deyisiklik",
        title: "18. Updates",
        paragraphs: [
          "This document is updated when the law or the processing changes. The new version is published on the site and the “Last updated” line changes. Material changes (new purpose or new disclosure) are notified by email, WhatsApp or a site notice where practicable.",
          "Unless agreed otherwise, the purposes and retention in force at the time of the order continue for an active shipment; new cookies or marketing may require a new consent.",
        ],
      },
      {
        id: "sikayet",
        title: "19. Complaints",
        paragraphs: [
          "Write first to auto@nex.autos or call 070 966 81 11.",
          "You may also apply to the competent authority for personal-data protection in the Republic of Azerbaijan or to a court. Azerbaijani law applies; venue is the competent courts in Baku unless mandatory law requires otherwise.",
        ],
      },
      {
        id: "elaqe",
        title: "20. Legal details",
        paragraphs: [
          "Auto Nex — Bakıxanov, Baku. Email: auto@nex.autos. Telephone and WhatsApp: 070 966 81 11 (primary), 070 964 64 66, 099 730 03 13.",
          "The terms of service are a separate document (/terms). This policy is read together with those terms; on personal data, the statute and this policy prevail.",
        ],
      },
    ],
  },
  ru: {
    kicker: "Правовой документ",
    title: "Политика конфиденциальности",
    updated: "Обновлено: 4 сентября 2026",
    toc: "Содержание",
    intro:
      "Политика объясняет правовые основания, цели, объём и сроки обработки персональных данных Auto Nex, получателей данных и права субъекта. Документ составлен с учётом статьи 32 Конституции Азербайджанской Республики, Закона от 11 мая 2010 года № 998-IIIQ «О персональных данных», Закона об информации, информатизации и защите информации и связанных актов. Пользуясь сайтом, трек-кодом, формой консультации, WhatsApp или электронной почтой, вы уведомлены об обработке, описанной здесь.",
    sections: [
      {
        id: "operator",
        title: "1. Оператор и связь",
        paragraphs: [
          "Оператор персональных данных — Auto Nex. Адрес: посёлок Бакиханов, Баку. Официальная почта: auto@nex.autos. Основной WhatsApp и телефон: 070 966 81 11. Другие линии: 070 964 64 66, 099 730 03 13.",
          "Запросы о доступе, исправлении, ограничении, удалении или возражении направляются письменно на auto@nex.autos или по указанным телефонам/WhatsApp. Оператор рассматривает обращение в срок, установленный законом, как правило в течение тридцати дней; в сложных случаях срок может быть продлён с уведомлением вас.",
          "Политика охватывает nex.autos и связанные домены, трекинг, админ-панель, форму консультации, SMS/WhatsApp-уведомления и переписку с сотрудниками Auto Nex.",
        ],
      },
      {
        id: "anlayis",
        title: "2. Понятия",
        paragraphs: [
          "«Персональные данные» — любая информация, позволяющая прямо или косвенно идентифицировать физическое лицо (имя, телефон, почта, адрес, связь клиента с VIN, трек-код, платёжные реквизиты, фото и образы документов).",
          "«Обработка» — сбор, запись, систематизация, хранение, изменение, извлечение, использование, передача, опубликование, уничтожение и иные операции, предусмотренные законом.",
          "«Субъект» — физическое лицо, чьи данные обрабатываются (клиент, заявитель, уполномоченный получатель автомобиля).",
          "«Согласие» — свободное, конкретное и информированное волеизъявление. Оно может быть дано письменно, в электронной форме или действием, необходимым для услуги (отправка формы, сообщение кода, поручение в WhatsApp).",
        ],
      },
      {
        id: "esas",
        title: "3. Правовые основания",
        paragraphs: [
          "Обработка ведётся на одном или нескольких основаниях: (а) согласие субъекта; (б) заключение и исполнение поручения на импорт, перевозку, таможню и выдачу; (в) законные обязанности Auto Nex (налог, учёт, таможенные дела); (г) жизненно важные интересы субъекта или третьего лица; (д) прямое требование закона.",
          "Данные специальной категории (здоровье, биометрия и т.п.) целенаправленно не собираются. Если они случайно есть в аукционном файле, хранятся лишь в объёме и срок, нужные для услуги.",
          "Услуга не адресована лицам младше 18 лет. Ошибочно полученные данные удаляются, родитель или законный представитель уведомляется.",
        ],
      },
      {
        id: "mece",
        title: "4. Какие данные собираются",
        paragraphs: [
          "Форма консультации: имя, почта, телефон, текст обращения (марка, модель, бюджет и т.п.), время отправки.",
          "Заказ и отгрузка: имя клиента, WhatsApp/телефон, почта, VIN, марка, модель, год, трек-код, контейнер и судно, порты, транзиты, отметки этапов, фото (аукцион, депо, кузов, салон, двигатель, повреждения, погрузка), названия документов, номер и сумма счёта, таможенный статус, служебные заметки.",
          "Трекинг: ввод кода и открытые поля этой отгрузки. Аккаунт клиента не требуется.",
          "Технические настройки: язык (anx_locale), валюта (anx_currency), тема (cookie theme и localStorage), локальная копия заказов (anx_local_orders), токен админа (anx_token), флаг первой загрузки. IP, тип браузера и время запроса могут кратко храниться в журналах сервера для безопасности и разбора сбоев.",
          "WhatsApp, телефон и SMS: номер, содержание переписки, статус уведомления об этапе. Уведомление уходит только если вы дали номер.",
          "Оплата: счёт и подтверждение перевода. Данные карты на сайте Auto Nex не хранятся; банк действует по своим правилам.",
        ],
      },
      {
        id: "meqsed",
        title: "5. Цели обработки",
        paragraphs: [
          "Данные обрабатываются только для заранее названных законных целей: подбор и поручение на аукцион; организация импорта и моря; таможенные документы; выдача трек-кода и обновление этапов; выдача автомобиля; расчёты и налоговый учёт; ответы на обращения; защита от мошенничества; доказательства в споре.",
          "Маркетинговые рассылки без отдельного согласия не ведутся. SMS/WhatsApp об этапе — операционное сообщение, не реклама.",
          "При смене цели, если закон требует, запрашивается новое согласие либо разъясняется необходимость для исполнения договора.",
        ],
      },
      {
        id: "menbe",
        title: "6. Источники",
        paragraphs: [
          "Основной источник — вы: форма, WhatsApp, телефон, почта, документы, переданные в студии.",
          "Дополнительные источники, если нужны для услуги: аукционы и лицензированные партнёры (лот, VIN, фото); перевозчик и порт (контейнер, судно, IMO, позиция); таможенный брокер и органы (статус оформления); сервисы AIS/позиции судна (открытые или договорные).",
          "Если данные поступили от третьего лица, оператор проверяет основание и цель; без основания обработка не ведётся.",
        ],
      },
      {
        id: "cookie",
        title: "7. Cookie и локальное хранилище",
        paragraphs: [
          "Сайт использует функциональные cookie и хранилище браузера. Cookie «theme» и localStorage сохраняют светлую/тёмную тему (около 12 месяцев). «anx_locale» — язык, «anx_currency» — валюта. Рекламный профиль не строится.",
          "В админ-панели «anx_token» хранит вход и удаляется при выходе. «anx_local_orders» может содержать локальную копию отгрузки и очищается после архивного срока после выдачи.",
          "Cookie можно ограничить в браузере. Отключение функциональных cookie влияет на язык, тему и удобство трекинга. Рекламные cookie сети не ставятся; при изменении политика будет обновлена, согласие запросят, если нужно.",
        ],
      },
      {
        id: "oturmə",
        title: "8. Передача третьим лицам",
        paragraphs: [
          "Данные передаются лишь в объёме цели: аукцион и лицензированные партнёры (исполнение покупки); линия, экспедитор, порт (контейнер и рейс); таможенный брокер и таможня Азербайджана (оформление); банк (расчёты); инфраструктура WhatsApp/SMS (Twilio или Meta WhatsApp Cloud — только если вы просили уведомления); хостинг и техподдержка по договору о конфиденциальности.",
          "Госоргану данные передаются только по закону, судебному акту либо для таможенного/налогового исполнения.",
          "Персональные данные не продаются для постороннего маркетинга.",
        ],
      },
      {
        id: "xaric",
        title: "9. Трансграничная передача",
        paragraphs: [
          "Цепочка импорта связана с аукционами, перевозчиками и портами США, Кореи, Китая и транзитных государств. VIN, имя, контакты и реквизиты отгрузки могут передаваться в эти юрисдикции для исполнения договора.",
          "По Закону «О персональных данных» трансграничная передача возможна на основании согласия, исполнения договора, законной обязанности или иного основания, указанного в законе. От получателя требуются конфиденциальность и защита.",
          "Если резерв или почтовая инфраструктура размещены на иностранном сервере, действуют те же основания и технические меры.",
        ],
      },
      {
        id: "muddet",
        title: "10. Сроки хранения",
        paragraphs: [
          "Данные не хранятся дольше, чем нужно для цели, кроме случаев законной обязанности хранения.",
          "Активная отгрузка — до выдачи. Архив трекинга выданного автомобиля обычно тридцать дней; бухгалтерские, налоговые и таможенные дела — в сроки, установленные правом Азербайджана (как правило не менее пяти лет).",
          "Обращения с консультации хранятся разумный срок для ответа и доказательств, обычно до двух лет, затем удаляются или обезличиваются, если нет спора.",
          "Сроки cookie указаны выше. Журналы сервера обычно короткий цикл (например до девяноста дней), если не требуется расследование.",
        ],
      },
      {
        id: "tehlukesizlik",
        title: "11. Безопасность",
        paragraphs: [
          "Оператор применяет организационные и технические меры: ограничение доступа (админ только уполномоченным), пароли и токены, HTTPS, резерв, минимизация данных.",
          "Передача в сети не свободна от всякого риска. WhatsApp и почта подчиняются шифрованию третьих лиц. Учитывайте это, отправляя удостоверение личности по открытому каналу.",
          "При угрозе утечки субъект и компетентный орган уведомляются, если закон того требует, вред снижается.",
        ],
      },
      {
        id: "huquqlar",
        title: "12. Права субъекта",
        paragraphs: [
          "По Закону «О персональных данных» и статье 32 Конституции вы вправе: получить сведения об обработке; доступ к своим данным; исправление; прекращение незаконной обработки; удаление или уничтожение при прекращении основания; отзыв согласия (кроме случаев, когда договор и законный учёт должны продолжаться); жалобу в суд или компетентный орган.",
          "Может потребоваться подтверждение личности, чтобы не выдать чужие данные. Кто знает трек-код, видит отгрузку; передача кода — ваша ответственность.",
          "Отзыв согласия не отменяет уже исполненную покупку на аукционе и таможенную обязанность; будущий маркетинг и необязательные уведомления прекращаются.",
        ],
      },
      {
        id: "avtomat",
        title: "13. Автоматизированные решения",
        paragraphs: [
          "Кредитный скоринг, автоматический отказ и полностью автоматизированные решения со сравнимым юридическим эффектом не применяются.",
          "Этапы трекинга и позиция судна отображаются системой; решения о покупке, цене и выдаче принимают сотрудники Auto Nex по вашему поручению.",
        ],
      },
      {
        id: "izleme",
        title: "14. Трек-код и учётные записи",
        paragraphs: [
          "Трек-код показывает отгрузку без аккаунта. Храните его в тайне. Публикация может открыть VIN, фото и маршрут третьим лицам.",
          "Клиентский аккаунт, если создан, защищён почтой и паролем. Админ-доступ только у персонала Auto Nex.",
          "Демо-коды служат иллюстрацией и не являются живым клиентским делом.",
        ],
      },
      {
        id: "foto",
        title: "15. Фото и документы",
        paragraphs: [
          "Фото аукциона, депо и погрузки документируют отгрузку и видны на вашей странице трекинга. В открытый поиск они не отдаются; их видит тот, кто знает код.",
          "Копии удостоверения, доверенности и title берутся только для таможни и выдачи, затем удаляются либо хранятся в ограниченном архиве после законного срока.",
        ],
      },
      {
        id: "usaq",
        title: "16. Несовершеннолетние",
        paragraphs: [
          "Услуга не предназначена лицам младше 18 лет. Их данные намеренно не собираются. При обнаружении обработка прекращается, данные удаляются, если закон не требует иного.",
        ],
      },
      {
        id: "link",
        title: "17. Сторонние сайты",
        paragraphs: [
          "На сайте могут быть ссылки на Copart, IAAI, перевозчиков и карты (например OpenStreetMap). У них своя политика. Auto Nex их обработку не контролирует.",
          "Карта и AIS могут поступать из открытого или договорного источника; ваша личность там не показывается, только география отгрузки.",
        ],
      },
      {
        id: "deyisiklik",
        title: "18. Обновление политики",
        paragraphs: [
          "Документ обновляется при изменении закона или обработки. Новая редакция публикуется на сайте, меняется строка «Обновлено». О существенных изменениях (новая цель или новая передача) по возможности сообщается почтой, WhatsApp или уведомлением на сайте.",
          "К активной отгрузке, если не согласовано иное, применяются цели и сроки хранения на дату заказа; новые cookie или маркетинг могут потребовать нового согласия.",
        ],
      },
      {
        id: "sikayet",
        title: "19. Жалоба и спор",
        paragraphs: [
          "Сначала обратитесь на auto@nex.autos или по 070 966 81 11.",
          "Вы вправе обратиться в компетентный орган по защите персональных данных Азербайджанской Республики или в суд. Применяется право Азербайджана; подсудность — компетентные суды Баку, если императивная норма не требует иного.",
        ],
      },
      {
        id: "elaqe",
        title: "20. Реквизиты",
        paragraphs: [
          "Auto Nex — Бакиханов, Баку. Почта: auto@nex.autos. Телефон и WhatsApp: 070 966 81 11 (основной), 070 964 64 66, 099 730 03 13.",
          "Условия использования — отдельный документ (/terms). Настоящая политика читается вместе с ними; в части персональных данных закон и эта политика имеют приоритет.",
        ],
      },
    ],
  },
  tr: {
    kicker: "Hukuki belge",
    title: "Gizlilik politikası",
    updated: "Son güncelleme: 4 Eylül 2026",
    toc: "İçindekiler",
    intro:
      "Bu politika, Auto Nex’in kişisel verileri hangi hukuki sebeple, hangi amaçla, hangi ölçüde ve süreyle işlediğini, kime aktardığını ve ilgilinin haklarını açıklar. Metin, Azerbaycan Cumhuriyeti Anayasası’nın 32. maddesi, 11 Mayıs 2010 tarihli ve 998-IIIQ sayılı “Kişisel Veriler Hakkında” Kanun, Bilgi, Enformasyonlaştırma ve Bilginin Korunması Hakkında Kanun ve ilgili düzenlemelere uygun hazırlanmıştır. Siteyi, takip kodunu, danışma formunu, WhatsApp’ı veya e-postayı kullanmakla burada anlatılan işleme hakkında bilgilendirilmiş sayılırsınız.",
    sections: [
      {
        id: "operator",
        title: "1. İşleyen ve iletişim",
        paragraphs: [
          "Kişisel verilerin işleyeni Auto Nex’tir. İş yeri: Bakıxanov, Bakü. Resmi e-posta: auto@nex.autos. Ana WhatsApp ve telefon: 070 966 81 11. Diğer hatlar: 070 964 64 66, 099 730 03 13.",
          "Erişim, düzeltme, kısıtlama, silme veya itiraz talepleri yazılı olarak auto@nex.autos adresine veya yukarıdaki telefon/WhatsApp hatlarına gönderilir. İşleyen, talebi kanundaki sürede, kural olarak otuz gün içinde inceler; karmaşık hallerde süre uzayabilir ve size bildirilir.",
          "Politika nex.autos ve bağlı alan adlarını, takibi, yönetim panelini, danışma formunu, SMS/WhatsApp bildirimlerini ve Auto Nex personeliyle yazışmaları kapsar.",
        ],
      },
      {
        id: "anlayis",
        title: "2. Tanımlar",
        paragraphs: [
          "“Kişisel veri”, gerçek kişiyi doğrudan veya dolaylı tanımlayan her türlü bilgidir (ad, telefon, e-posta, adres, VIN ile müşteri bağı, takip kodu, ödeme bilgisi, fotoğraf ve belge görüntüleri).",
          "“İşleme”, toplama, kaydetme, düzenleme, saklama, değiştirme, elde etme, kullanma, aktarma, yayımlama, imha ve kanunda öngörülen diğer işlemlerdir.",
          "“İlgili kişi”, verisi işlenen gerçek kişidir (müşteri, başvuran, aracı teslim alan vekil).",
          "“Rıza”, özgür, belirli ve bilgilendirilmiş irade beyanıdır. Yazılı, elektronik veya hizmet için gerekli bir fiille (form göndermek, kod vermek, WhatsApp’ta talimat yazmak) verilebilir.",
        ],
      },
      {
        id: "esas",
        title: "3. Hukuki sebepler",
        paragraphs: [
          "İşleme şu temellerden biri veya birkaçıyla yapılır: (a) ilgili kişinin rızası; (b) ithalat, taşıma, gümrük ve teslim sözleşmesinin kurulması ve ifası; (c) Auto Nex’in kanuni yükümlülükleri (vergi, muhasebe, gümrük dosyası); (ç) ilgili veya üçüncü kişinin hayati menfaati; (d) kanunun doğrudan emri.",
          "Özel nitelikli veri (sağlık, biyometrik kimlik vb.) amaçlı toplanmaz. Açık artırma dosyasında tesadüfen varsa, yalnızca hizmet için gerekli ölçüde ve süreyle tutulur.",
          "Hizmet 18 yaşından küçüklere yönelik değildir. Yanlışlıkla gelen veri silinir, veli veya kanuni temsilciye haber verilir.",
        ],
      },
      {
        id: "mece",
        title: "4. Toplanan veriler",
        paragraphs: [
          "Danışma formu: ad, e-posta, telefon, mesaj (marka, model, bütçe vb.), gönderim zamanı.",
          "Sipariş ve sevkiyat: müşteri adı, WhatsApp/telefon, e-posta, VIN, marka, model, yıl, takip kodu, konteyner ve gemi, limanlar, transitler, aşama zamanları, fotoğraflar (açık artırma, depo, dış, iç, motor, hasar, yükleme), belge adları, fatura numarası ve tutarı, gümrük durumu, personel notları.",
          "Takip: kodun girilmesi ve o sevkiyatın açık alanları. Müşteri hesabı gerekmez.",
          "Teknik ayarlar: dil (anx_locale), para birimi (anx_currency), tema (theme çerezi ve localStorage), tarayıcıdaki sipariş kopyası (anx_local_orders), yönetici jetonu (anx_token), ilk yükleme oturum bayrağı. IP, tarayıcı türü ve istek zamanı güvenlik ve arıza analizi için sunucu günlüklerinde kısa süre kalabilir.",
          "WhatsApp, telefon ve SMS: numara, yazışma içeriği, aşama bildiriminin iletim durumu. Bildirim yalnızca numara verdiyseniz gider.",
          "Ödeme: fatura ve havale teyidi. Kart verisi Auto Nex sitesinde saklanmaz; banka kendi kurallarıyla hareket eder.",
        ],
      },
      {
        id: "meqsed",
        title: "5. İşleme amaçları",
        paragraphs: [
          "Veri yalnızca önceden açıklanan hukuka uygun amaçlarla işlenir: araç seçimi ve açık artırma talimatı; ithalat ve deniz taşımasının örgütlenmesi; gümrük evrakı; takip kodu ve aşama güncellemesi; teslim; hesaplaşma ve vergi kaydı; başvurulara cevap; dolandırıcılık ve güvenlik; hukuki uyuşmazlıkta delil.",
          "Ayrı rıza olmadan pazarlama iletisi gönderilmez. Aşama SMS/WhatsApp işletmeseldir, reklam değildir.",
          "Amaç değişirse, kanun gerektiriyorsa yeni rıza alınır veya sözleşmenin ifası için zorunluluk ayrıca açıklanır.",
        ],
      },
      {
        id: "menbe",
        title: "6. Kaynaklar",
        paragraphs: [
          "Asıl kaynak sizsiniz: form, WhatsApp, telefon, e-posta, stüdyoda teslim edilen belge.",
          "Hizmet için gerektiğinde ikincil kaynaklar: açık artırma ve lisanslı ortaklar (lot, VIN, foto); taşıyıcı ve liman (konteyner, gemi, IMO, konum); gümrük müşaviri ve kamu (tescil durumu); AIS/gemi konumu hizmetleri (açık veya sözleşmeli).",
          "Üçüncü kişiden veri gelirse işleyen hukuki sebebi ve amacı denetler; dayanağı olmayan veri işlenmez.",
        ],
      },
      {
        id: "cookie",
        title: "7. Çerezler ve yerel depolama",
        paragraphs: [
          "Site işlevsel çerez ve tarayıcı deposu kullanır. “theme” çerezi ve localStorage açık/koyu temayı saklar (yaklaşık 12 ay). “anx_locale” dil, “anx_currency” para birimidir. Reklam profili için kullanılmaz.",
          "Yönetim panelinde “anx_token” oturumu tutar, çıkışta silinir. “anx_local_orders” sevkiyatın tarayıcı kopyası olabilir; teslimden sonraki arşiv süresinde temizlenebilir.",
          "Çerezleri tarayıcıdan kısıtlayabilirsiniz. İşlevsel çerez kapanırsa dil, tema ve bazı takip kolaylıkları etkilenir. Reklam ağı çerezi kurulmaz; bu değişirse politika güncellenir ve gerektiğinde rıza sorulur.",
        ],
      },
      {
        id: "oturmə",
        title: "8. Üçüncü kişilere aktarım",
        paragraphs: [
          "Veri yalnızca amaç için gerekli ölçüde aktarılır: açık artırma ve lisanslı ortaklar (alımın ifası); hat, forwarder, liman (konteyner ve sefer); gümrük müşaviri ve Azerbaycan gümrüğü (tescil); banka (hesaplaşma); WhatsApp/SMS altyapısı (Twilio veya Meta WhatsApp Cloud — yalnızca bildirim istediyseniz); barındırma ve teknik destek, gizlilik sözleşmesiyle.",
          "Kamu kurumuna veri yalnızca kanun, mahkeme kararı veya gümrük/vergi ifası için verilir.",
          "Kişisel veri ilgisiz pazarlama için satılmaz.",
        ],
      },
      {
        id: "xaric",
        title: "9. Yurt dışı aktarım",
        paragraphs: [
          "İthalat zinciri ABD, Kore, Çin ve transit ülkelerdeki açık artırma, taşıyıcı ve limanlara bağlıdır. VIN, ad, iletişim ve sevkiyat referansları sözleşmenin ifası için bu hukuk düzenlerine aktarılabilir.",
          "Kişisel Veriler Hakkında Kanun’a göre sınır ötesi aktarım rıza, sözleşmenin ifası, kanuni yükümlülük veya kanunda sayılan başka bir sebeple yapılır. Alıcıdan gizlilik ve güvenlik istenir.",
          "Yedek veya e-posta altyapısı yabancı sunucudaysa aynı hukuki sebepler ve teknik koruma uygulanır.",
        ],
      },
      {
        id: "muddet",
        title: "10. Saklama süreleri",
        paragraphs: [
          "Veri, kanuni saklama yükümlülüğü dışında amaç için gerekenden uzun tutulmaz.",
          "Aktif sevkiyat: teslime kadar. Teslim edilmiş aracın takip arşivi kural olarak otuz gündür; muhasebe, vergi ve gümrük dosyaları Azerbaycan muhasebe ve vergi hukukundaki sürelerce (kural olarak en az beş yıl) saklanır.",
          "Danışma başvuruları cevap ve ispat için makul süre, genellikle iki yıla kadar tutulur, uyuşmazlık yoksa silinir veya anonimleştirilir.",
          "Çerez süreleri yukarıdadır. Sunucu günlükleri genellikle kısa çevrimdir (örneğin doksan güne kadar), soruşturma gerekmedikçe.",
        ],
      },
      {
        id: "tehlukesizlik",
        title: "11. Güvenlik",
        paragraphs: [
          "İşleyen idari ve teknik tedbir uygular: erişim kısıtı (yönetim yalnızca yetkili personel), parola ve jeton, HTTPS, yedek, verinin asgariye indirilmesi.",
          "Hiçbir internet iletimi tüm riskten ari değildir. WhatsApp ve e-posta üçüncü taraf şifrelemesine tabidir. Açık kanaldan kimlik belgesi göndermeden bunu dikkate alın.",
          "İhlal ihtimalinde kanun gerektiriyorsa ilgili kişi ve yetkili merci haberdar edilir, zarar azaltılır.",
        ],
      },
      {
        id: "huquqlar",
        title: "12. İlgili kişinin hakları",
        paragraphs: [
          "Kişisel Veriler Hakkında Kanun ve Anayasa’nın 32. maddesi uyarınca: işleme hakkında bilgi; verilerinize erişim; yanlışlığın düzeltilmesi; hukuka aykırı işlemenin durdurulması; sebep bitince silme veya imha; rızanın geri alınması (sözleşme ve kanuni kayıt yükümlülüğü devam eden haller hariç); mahkemeye veya yetkili mercie şikâyet hakkınız vardır.",
          "Başkasının verisi verilmesin diye kimlik doğrulaması istenebilir. Takip koduna sahip olan sevkiyatı görür; kodu paylaşmak sizin sorumluluğunuzdadır.",
          "Rızanın geri alınması yapılmış açık artırma alımını ve gümrük yükümlülüğünü ortadan kaldırmaz; gelecekteki pazarlama ve zorunlu olmayan bildirimler durur.",
        ],
      },
      {
        id: "avtomat",
        title: "13. Otomatik karar",
        paragraphs: [
          "Kredi skoru, otomatik ret veya benzer hukuki sonuç doğuran tam otomatik karar alınmaz.",
          "Takip aşamaları ve gemi konumu sistemde gösterilir; alım, fiyat ve teslim kararları Auto Nex personeli ve sizin talimatınızla verilir.",
        ],
      },
      {
        id: "izleme",
        title: "14. Takip kodu ve hesaplar",
        paragraphs: [
          "Takip kodu sevkiyatı hesapsız gösterir. Gizli tutulmalıdır. Kamuya koymak VIN, fotoğraf ve güzergâhı üçüncü kişilere açabilir.",
          "Müşteri hesabı oluşturulursa e-posta ve parolayla korunur. Yönetim erişimi yalnızca Auto Nex personeline aittir.",
          "Demo kodlar gösterim içindir, canlı müşteri dosyası değildir.",
        ],
      },
      {
        id: "foto",
        title: "15. Fotoğraf ve belgeler",
        paragraphs: [
          "Açık artırma, depo ve yükleme fotoğrafları sevkiyatı belgeler ve sizin takip sayfanızdadır. Genel aramaya verilmez; kodu bilen görür.",
          "Kimlik, vekâletname ve title suretleri yalnızca gümrük ve teslim için alınır, amaç bitince ve kanuni saklama süresi geçince silinir veya kısıtlı arşivde tutulur.",
        ],
      },
      {
        id: "usaq",
        title: "16. Küçükler",
        paragraphs: [
          "Hizmet 18 yaşından küçüklere yönelik değildir. Verileri kasten toplanmaz. Fark edilirse işleme durur, kanun aksini emretmedikçe veri silinir.",
        ],
      },
      {
        id: "link",
        title: "17. Üçüncü taraf siteler",
        paragraphs: [
          "Sitede Copart, IAAI, taşıyıcı ve harita (örneğin OpenStreetMap) bağlantıları olabilir. Bunların kendi politikası vardır. Auto Nex onların işlemesini denetlemez.",
          "Harita ve AIS kamuya açık veya sözleşmeli kaynaktan gelebilir; kimliğiniz orada gösterilmez, yalnızca sevkiyatın coğrafyası görünür.",
        ],
      },
      {
        id: "deyisiklik",
        title: "18. Politikanın güncellenmesi",
        paragraphs: [
          "Kanun veya işleme değişince belge güncellenir. Yeni metin sitede yayımlanır, “Son güncelleme” satırı değişir. Esaslı değişiklik (yeni amaç veya yeni aktarım) mümkün olduğunca e-posta, WhatsApp veya site duyurusuyla bildirilir.",
          "Aksi kararlaştırılmadıkça aktif sevkiyatlara sipariş anındaki amaç ve saklama uygulanır; yeni çerez veya pazarlama yeni rıza gerektirebilir.",
        ],
      },
      {
        id: "sikayet",
        title: "19. Şikâyet ve uyuşmazlık",
        paragraphs: [
          "Önce auto@nex.autos veya 070 966 81 11 ile işleyene başvurun.",
          "Azerbaycan Cumhuriyeti’nde kişisel verilerin korunmasından sorumlu yetkili mercie veya mahkemeye de başvurabilirsiniz. Azerbaycan hukuku uygulanır; yetki, emredici hüküm aksini gerektirmediği sürece Bakü mahkemelerindedir.",
        ],
      },
      {
        id: "elaqe",
        title: "20. Hukuki bilgiler",
        paragraphs: [
          "Auto Nex — Bakıxanov, Bakü. E-posta: auto@nex.autos. Telefon ve WhatsApp: 070 966 81 11 (ana), 070 964 64 66, 099 730 03 13.",
          "Kullanım şartları ayrı belgedir (/terms). Bu politika o şartlarla birlikte okunur; kişisel veride kanun ve bu politika üstündür.",
        ],
      },
    ],
  },
};
