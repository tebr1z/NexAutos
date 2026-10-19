# Auto Nex – BidCars Chrome əlavəsi

Bu Manifest V3 əlavəsi BidCars lot səhifəsindəki məlumatları brauzerdən birbaşa oxuyur və səhifəyə Auto Nex hesab paneli əlavə edir.

## 1.11.0 — hesab paketləri

- Admin → İstifadəçilər → Aylıq limit və endirimlər: istifadəçi üzrə limit, limitsiz seçim, üç qiymət qrupunun endirimi və fərdi Poti–Bakı məbləği.
- Yeni Kalkulyator müştərisi hesabları 100 hesab/ay ilə başlayır; admin istənilən vaxt dəyişir. Mövcud hesablar admin limit qoyana qədər limitsiz qalır.
- Ay Bakı vaxtı ilə yenilənir. Uğurlu yol tarifi sorğusu bir istifadə sayılır; sonrakı DGK sorğusu uğursuz olsa belə tarif hesabı sayılmış olur. Eyni lot/qiymət/marşrut/ayar 10 dəqiqədə təkrar sayılmır. Tarif tapılmayan sorğu sayılmır.
- Endirim ABŞ–Poti xərcinə tətbiq edilir: 50 = $50 endirim, -50 = $50 əlavə xərc. Qrup avtomobil + auction fee cəminə əsaslanır. Poti–Bakı boşdursa ümumi tarif, 0-dırsa həmin xərc çıxarılır.
- İstifadəçi yalnız admin icazə verəndə öz endirimini və Poti–Bakı məbləğini dəyişir. Limit və icazə yalnız admin tərəfindən dəyişir.
- Paketdə tarif JSON-ları və lokal tarif fallback-i yoxdur; giriş, limit və fərdi qiymətlər serverdə yoxlanır. Aşağıdakı əvvəlki versiyaların offline fallback davranışı artıq tətbiq edilmir.
- Xəta bildirişi təsvir, lot linki və versiya ilə adminin istifadəçilər səhifəsinə gəlir. Şifrə/token göndərilmir.
- Hesab təxminidir; göstərilən ±1–2% qeyd zəmanət deyil. Yeni vektor loqo SVG və 16/32/48/128 PNG ölçülərindədir.

### VDS deploy ardıcıllığı

Repo kökündə `git pull origin main`, sonra `npm ci --prefix apps/web/api` və `npm run build` işlədin. DB dəyişikliklərini tətbiq edin:

```bash
node apps/web/api/scripts/migrate-deploy.cjs
pm2 list
```

Migration uğurla bitəndən sonra siyahıdakı Auto Nex API və web proseslərini adları ilə `pm2 restart PROSES_ADI --update-env` edin. Bu skript quraşdırılmış Prisma-nı istifadə edir və `.env`-ni shell `source` etmədən oxuyur; uğursuz migration zamanı xəta kodu ilə dayanır. Server yeniləndikdən sonra extension 1.11.0 paketini yükləyin və BidCars səhifəsini yeniləyin.

## 1.9.0

- BidCars səhifəsində Copart / IAA / IAAI hərracını başlıqdan, badge-dən və lot mətnindən tanıyır.
- Copart və IAAI yard tarifləri ayrıca JSON fayllarında saxlanır və production seed vasitəsilə DB-yə düşür.
- `/freight` səhifəsində hərrac və state seçərək bütün yard tariflərini üç qiymət aralığında görmək olur.

## 1.9.1

- BidCars yard adı DB-dəki ada tam uyğun gəlməyəndə istiqamət aliası tətbiq olunur (məsələn, `Orlando South` → `Orlando`).
- API həmin yard üçün tarif qaytarmasa extension daxilindəki Copart/IAAI JSON faylları avtomatik fallback kimi işləyir.

## 1.9.2

- Kalkulyator BidCars səhifəsinin sağında 390px enində sabit, scroll edilən panel kimi açılır.
- Çatışmayan tarif formundan admin email/şifrə sahələri çıxarılıb.
- Əl ilə yazılan tarif dərhal Chrome lokal yaddaşına düşür və hesablamada istifadə olunur; əvvəlki admin sessiyası varsa DB-yə də səssiz sinxron edilir.

## 1.9.3

- Hərrac növü bütün səhifədəki təsadüfi Copart/IAAI sözlərindən deyil, lot başlığının yanındakı badge-dən seçilir.
- Eyni state və yard üçün DB-də Copart və IAAI tarifləri ayrı saxlanır və düzgün hərraca uyğun tarif götürülür.

## 1.9.4

- Mühərrik və yanacaq artıq səhifənin gizli axtarış menyusundan deyil, görünən `Engine` və `Fuel Type` etiketlərinin qarşısındakı dəyərdən oxunur.
- Benzin, dizel, hibrid, plug-in hibrid, elektrik və LPG dəyərləri DGK mühərrik növünə uyğun çevrilir.

## 1.9.5

- `2.0L4`, `2,0 L I4`, `3.6L-V6`, `1998 cc` kimi qarışıq mühərrik yazılışları düzgün cm³ dəyərinə çevrilir.
- `Show more` altında bağlı qalan texniki sahələr birbaşa məlumat cədvəlindən oxunur.
- BidCars yanacaq və ya mühərriki göstərmədikdə lot linki Auto Nex API-yə ötürülür; Copart/IAAI mənbəsindən tapılan məlumat DGK hesabında fallback kimi istifadə olunur.

## 1.9.6

- `Fuel Type` dəyəri birbaşa BidCars texniki məlumat cədvəlindən götürülür və DGK kateqoriyasına çevrilir.
- Benzin, dizel, LPG, hibrid, dizel hibrid, plug-in hibrid, plug-in dizel hibrid, mild hibrid və elektrik ayrı saxlanır; gömrük sorğusuna uyğun DGK mühərrik kodu göndərilir.

## 1.9.7

- Extension açılarkən və hesablayarkən BidCars səhifəsi artıq aşağı sürüşdürülmür.
- Nəticənin bağlı görünüşündə yalnız auction fee, bütün yol xərci və gömrük USD ilə, yekun isə böyük AZN məbləği ilə göstərilir.
- Tam bölgü `Ətraflı hesab` bölməsinə keçirilib.
- `DYP xərclərini əlavə et — 800 AZN` düyməsi yekun manat məbləğinə 800 AZN əlavə edir və təkrar basıldıqda çıxarır.

## 1.9.8

- İlk açılışda qiymət seçimi, auction fee və düzəliş sahələri gizli saxlanır; yalnız kompakt nəticə görünür.
- Tək `Ətraflı` düyməsi qiymət/auction fee sahələrini, avtomobil məlumatlarını və tam hesab bölgüsünü birlikdə açır; `Yığcam göstər` onları yenidən bağlayır.

## 1.9.9

- Auction, yol və gömrük kartları ilkin görünüşdən `Ətraflı` hissəyə keçirilib; onların yerində seçilmiş hesablama qiyməti göstərilir.
- Panel 360px enə endirilib, daxili boşluqlar və böyük AZN yekun bloku kiçildilib.

## 1.10.0

- Yığcam görünüşdəki `Hesablama qiyməti` birbaşa dəyişdirilə bilir; yeni rəqəm yazılıb Enter basıldıqda və ya sahədən çıxıldıqda bütün xərclər yenidən hesablanır.

## 1.10.1

- Yığcam görünüşdə hesablama qiyməti rəqəm qutusu əvəzinə `Bid Now`, `Current Bid`, `Lot Price` və `Əl ilə yaz` seçim menyusu kimi göstərilir.
- `Əl ilə yaz` seçildikdə yığcam paneldə ayrıca qiymət xanası açılır və dəyişiklik bütün hesabı yeniləyir.

Oxunan sahələr:

- `Current Bid`, `Bid Now` və `Lot Price` məbləğləri ayrıca
- Copart / IAAI
- Location / Shipping from və ABŞ ştatı
- istehsal ili, mühərrik həcmi və yanacaq növü
- clean / salvage title

Hesab:

1. Seçilən `Current Bid` və ya `Bid Now` qiymətinə görə rəsmi auction fee.
2. Location/yard və qiymət qrupu ilə Auto Nex yol pulu.
3. ABŞ–Poti + Gürcüstan–Bakı.
4. İl, mühərrik və yanacaqla açıq DGK API üzərindən gömrük.
5. Həm gömrüksüz, həm də gömrüklə ümumi məbləğ.

Seçilən qiymət BidCars `Bid Now` / `Lot Price` ilə eynidirsə, səhifədə canlı yenilənən `Auction Fees` istifadə olunur. Bu məbləğ tapılmasa Auto Nex hərrac cədvəli fallback kimi işləyir. Yekun formula `avtomobil + auction fee + ABŞ–Poti + Poti–Bakı + DGK gömrük` şəklindədir və həm USD, həm AZN göstərilir.

Yol tarifləri avtomobilin tək alış qiymətinə yox, `avtomobil + auction fee` invoys cəminə görə üç aralıqda seçilir: `$0–3,000`, `$3,001–7,000`, `$7,001–150,000`. Məsələn, avtomobil `$7,000`, auction fee `$1,050` olarsa tarif `$8,050` əsasında üçüncü qrupdan götürülür. Köhnə `15,001+` tarifi varsa və üçüncü qrup boşdursa avtomatik üçüncü qrupa keçirilir. Paneldə yalnız əsas məbləğlər görünür; avtomobil və hesab detalları bağlı bölmələrdədir.

Tarif tapılmasa admin `/admin/freight` bölməsində həmin yard/şəhər, ştat, hərrac və qiymət aralığı üçün tarifi əlavə edir. Şifrə saxlanmır; access və 30 günlük yenilənən refresh token yalnız extension-un lokal yaddaşında saxlanır. Access token bitəndə extension onu avtomatik yeniləyir.

Production API `chrome-extension://` originlərini CORS-da qəbul etməlidir. Yazma sorğusu yalnız etibarlı admin/işçi JWT-si ilə işləyir.

BidCars-in ayrıca xidmət haqqı nəticəyə daxil edilmir.

## Caucasus Auto tarif toplayıcısı

Extension `login.caucasusauto.com/admin.php?cat=invoice&action=add` səhifəsində də işləyir. Extension ikonuna vurduqda açılan panel Copart və IAAI üçün ştat/şəhər tariflərini gecikmə ilə oxuyur və hər nəticədən sonra lokal yaddaşa checkpoint yazır.

Tarif qaydası:

- `0–3000`: Caucasus Auto kalkulyatorundan `$1500` nümunəsi ilə oxunan əsas yol xərci
- `3001–7000`: əsas tarif + `$50`
- `7001–150000`: orta qrup + `$150`, yəni əsas tarif + `$200`
- Poti–Bakı: ayrıca `$200`

Paneldən nəticələri JSON kimi yükləmək və yadda saxlanmış admin sessiyası ilə Auto Nex DB-yə toplu yazmaq olar. Skan invoice yaratmır və formu göndərmir; yalnız `калькуляция` nəticəsini oxuyur.

## Chrome-a quraşdırma

1. Chrome-da `chrome://extensions` açın.
2. Sağ yuxarıdan **Developer mode** aktiv edin.
3. **Load unpacked** seçin.
4. Bu qovluğu göstərin: `extensions/autonex-bidcars`.
5. BidCars lot səhifəsini yeniləyin.
6. BidCars lot səhifəsində **Auto Nex** extension ikonuna basın.

İkona basanda panel səhifəni oxuyur. Hesabla basıldıqda lot linki və hesablama məlumatları `https://nex.autos/api/v1` serverinə göndərilir. Serverdə tarif, limit və fərdi endirim tətbiq olunur; DGK hesabı ilə nəticə səhifənin üzərində göstərilir. Çatışmayan lot məlumatları serverdə mənbədən yoxlanıla bilər.

## v1.12.1 — hesab müddəti, bütün şəhərlərə fərdi düzəliş və şəxsi kar marjı

- Admin → İstifadəçilər → «Son tarix, limit, endirim və yol əlavəsini idarə et»: istifadə üçün son günü seçin. Boş tarix müddətsizdir; tarix seçilən günün sonuna, Bakı vaxtına qədər keçərlidir. Aylıq say limiti ayrıca qüvvədə qalır.
- Müddət bitəndə profil və extension «VexiraLabs ilə əlaqə qurun» göstərir; server yeni və təkrar hesablamaları rədd edir. Müddəti uzatdıqdan sonra extension-da «Oxu» basın.
- Müştəri «Mənim paketim və endirimlərim» bölməsində endirim və **Yol pulu kar marjım** ayarını saxlayır. `10` yalnız həmin hesabın yol pulunu `$10` artırır. Bu ayarlar hesaba bağlı PostgreSQL-də saxlanır, başqa istifadəçiyə təsir etmir.
- Üç invoys aralığı dəyişməyib: `0–3000`, `3000-dən çox–7000`, `7000-dən çox–150000`. Admin hər hesab üçün hər aralığa ayrıca artım və ya azalma yaza bilər: `+50`, `-100`, `0`. Düzəliş bütün şəhərlərə, Copart və IAAI tariflərinə tətbiq olunur, əsas bazanı və digər hesabları dəyişmir. Müştəri bu düzəlişləri, Poti–Bakı ayarını, müddəti və aylıq limiti dəyişə bilməz.
- Hesab: `max(0, max(0, əsas ABŞ–Poti − şəxsi endirim) + admin düzəlişi) + şəxsi kar marjı + Poti–Bakı`. Məsələn, $1250 əsas tarif + $50 düzəliş + $200 Poti–Bakı = $1500. Düzəliş tarif aralığını dəyişmir; aralıq avtomobil + auction fee ilə seçilir. v1.12.0 migrasiyası tətbiq edilibsə, v1.12.1 üçün əlavə migrasiya yoxdur.
- Əsas tarif siyahısı və redaktəsi yalnız ADMIN / SUPER_ADMIN üçündür.

Deploy zamanı API/Web və extension birlikdə yenilənməlidir. Repo kökündə `node apps/web/api/scripts/migrate-deploy.cjs` işlədin, sonra adi build və PM2 restart edin. Skript `.env` faylını özü oxuyur; `source .env` lazım deyil. Bu buraxılışın migrasiyası mövcud hesablarda şəxsi qiymət icazəsini açır; admin onu yenidən hesab üzrə bağlaya bilər. İstifadə tarixləri avtomatik təyin olunmur. Production DB migrasiyasından əvvəl backup alın.
