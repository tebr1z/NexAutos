# Auto Nex – BidCars Market Analizi

Bu, əsas qiymət kalkulyatorundan ayrı Chrome/Chromium extension-dur.

## 1.2.7

Yalnız rəqəmli `Final bid` qəbul olunur. `Final bid —`, cari təklif, təxmini dəyər və başqa `Sold for` qiymətinə keçid yoxdur. Rəqəmli final təklif satışın ödənişlə tamamlandığını təsdiqləmir. Bu collector admin istifadəsi üçündür; müştərilər hesabları ilə `/admin/market` panelində ortalamalara baxırlar. Collector açarını müştərilərə verməyin.

## Nə edir

- BidCars arxiv siyahısında və final olmuş lot səhifəsində `Final bid` məlumatını avtomatik oxuyur.
- İl, marka/model, komplektasiya, yürüş (mil və km), mühərrik, yanacaq/hibrid, rəng, Copart/IAAI və location məlumatlarını saxlayır.
- Məlumatı yalnız brauzerin lokal yaddaşında 30 gün saxlayır və lot/VIN üzrə təkrarı silir.
- Collector açarı bir dəfə yazıldıqdan sonra final satışları Auto Nex PostgreSQL bazasına avtomatik göndərir.
- Tam oxşar avtomobillər az olduqda mərhələli şəkildə yaxın komplektasiyaya və eyni model/yanacağa keçir.
- Orta qiymətlə yanaşı median və 25–75% real satış aralığını göstərir.
- Uzun maşın siyahısı əvəzinə marka → model → komplektasiya → mühərrik ardıcıllığı ilə filtr edir.
- Auto Nex yol və DGK API-ləri ilə Bakı təhvil aralığını hesablayır; nəticəyə 800 AZN DYP xərci daxildir.

## Quraşdırma

1. Chrome-da `chrome://extensions` açın.
2. **Developer mode** aktiv edin.
3. **Load unpacked** seçin.
4. Bu qovluğu seçin: `extensions/autonex-bidcars-market`.

BidCars arxiv nəticələrini gəzdikcə final satışlar avtomatik yığılır. Extension işarəsinə klik paneli gizlədir/açır. **30 günü sıfırla** yalnız bu extension-un topladığı lokal bazanı silir.

## PostgreSQL bağlantısı

Server `.env` faylında güclü, təsadüfi açar qurun: `MARKET_COLLECTOR_KEY=...`. Deploy və DB migration-dan sonra həmin dəyəri extension panelində **DB bağlantısı** bölməsinə bir dəfə yazın. Açar Chrome sync yaddaşında qalır; e-poçt və şifrə hər dəfə soruşulmur. Toplanan məlumatlara Auto Nex-də `/admin/market` səhifəsindən baxılır.

## Qeyd

Bu nəticə qiymət zəmanəti deyil. Nümunə sayı 3-dən az olduqda nəticə zəif hesab olunur. Dəqiq müqayisə üçün eyni modelin bir neçə arxiv səhifəsini açmaq lazımdır.
