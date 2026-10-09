# Auto Nex – BidCars Chrome əlavəsi

Bu Manifest V3 əlavəsi BidCars lot səhifəsindəki məlumatları brauzerdən birbaşa oxuyur və səhifəyə Auto Nex hesab paneli əlavə edir.

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

Tarif tapılmasa panel ABŞ–Poti məbləğini istəyir. Admin hesabı ilə daxil olub **Bazaya yaz və yenidən hesabla** seçildikdə tarif konkret yard/şəhər, ştat, hərrac və qiymət aralığı üçün `shipping_rates` bazasında qalır. Növbəti eyni hesablamada yenidən soruşulmur. Şifrə saxlanmır; yalnız giriş tokeni extension-un lokal yaddaşında saxlanır.

BidCars-in ayrıca xidmət haqqı nəticəyə daxil edilmir.

## Chrome-a quraşdırma

1. Chrome-da `chrome://extensions` açın.
2. Sağ yuxarıdan **Developer mode** aktiv edin.
3. **Load unpacked** seçin.
4. Bu qovluğu göstərin: `extensions/autonex-bidcars`.
5. BidCars lot səhifəsini yeniləyin.
6. BidCars lot səhifəsində **Auto Nex** extension ikonuna basın.

İkona basılan kimi əlavə açıq BidCars səhifəsini oxuyur, Auto Nex bazasındakı yol pulunu və DGK gömrüyünü hesablayır, nəticəni həmin səhifənin üzərində göstərir. BidCars linki heç bir serverə göndərilmir və BidCars-a ayrıca bot sorğusu edilmir. Standart production API ünvanı `https://nex.autos/api/v1`-dir.
