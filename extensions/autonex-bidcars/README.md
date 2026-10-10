# Auto Nex – BidCars Chrome əlavəsi

Bu Manifest V3 əlavəsi BidCars lot səhifəsindəki məlumatları brauzerdən birbaşa oxuyur və səhifəyə Auto Nex hesab paneli əlavə edir.

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

Yol tarifləri üç qiymət aralığında saxlanır: `$0–3,000`, `$3,001–7,000`, `$7,001–150,000`. Köhnə `15,001+` tarifi varsa və üçüncü qrup boşdursa avtomatik üçüncü qrupa keçirilir. Paneldə yalnız əsas məbləğlər görünür; avtomobil və hesab detalları bağlı bölmələrdədir.

Tarif tapılmasa panel ABŞ–Poti məbləğini istəyir. Admin hesabı ilə daxil olub **Bazaya yaz və yenidən hesabla** seçildikdə tarif konkret yard/şəhər, ştat, hərrac və qiymət aralığı üçün `shipping_rates` bazasında qalır. Növbəti eyni hesablamada yenidən soruşulmur. Şifrə saxlanmır; access və 30 günlük yenilənən refresh token yalnız extension-un lokal yaddaşında saxlanır. Access token bitəndə extension onu avtomatik yeniləyir və email/parol sahələrini təkrar göstərmir.

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

İkona basılan kimi əlavə açıq BidCars səhifəsini oxuyur, Auto Nex bazasındakı yol pulunu və DGK gömrüyünü hesablayır, nəticəni həmin səhifənin üzərində göstərir. BidCars linki heç bir serverə göndərilmir və BidCars-a ayrıca bot sorğusu edilmir. Standart production API ünvanı `https://nex.autos/api/v1`-dir.
