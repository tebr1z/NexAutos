import { auctionLabel, blocked, buyNowPrice, damageTags, dealDetails, dealMatches, documentKind, listingLinks, matches, modelMatches, parseLot, radarMessage, RadarFilters, safeLotUrl, searchUrl } from './lot';
const url = 'https://bid.cars/en/lot/1-12345678/2021-Toyota-Camry';
const html = '<nav>Engine size, type, horsepower</nav><h1>2021 Toyota Camry, SE</h1><p>Sale Document Salvage certificate (CA) Show sale document Primary damage Front end Secondary damage Right rear Odometer 40 000 mi Engine 2.5LV-4 Transmission Automatic Fuel Type Gasoline</p>';
const filters: RadarFilters = { make:'Toyota',model:'Camry',yearFrom:2020,yearTo:2023,engineMin:2400,engineMax:2600,damages:['front'],document:'salvage' };
describe('Lot Radar parsing and matching', () => {
  it('accepts BidCars pages that put the VIN in h1 and the vehicle name in h2',()=>{
    expect(parseLot('<h1>4T1B11HK1KU123456</h1><h2>2021 Toyota Camry, LE</h2><p>Engine 2.5L Transmission Automatic</p>',url)).toMatchObject({make:'Toyota',model:'Camry',engineCc:2500});
  });
  it('formats a confirmed auction time in Baku time and includes right-side damage and link',()=>{
    const event=`<script type="application/ld+json">${JSON.stringify({'@type':'Event',url,startDate:'2026-12-01T15:30:00Z'})}</script>`;
    const lot=parseLot(html+event,url);
    expect(lot.auctionAt).toBe('2026-12-01T15:30:00.000Z');
    expect(auctionLabel(lot)).toContain('19:30');expect(auctionLabel(lot)).toContain('Bakı');
    expect(radarMessage('Camry',lot)).toContain('sağ');expect(radarMessage('Camry',lot)).toContain(url);
  });
  it('never guesses timezone or takes a related lot event as the current auction',()=>{
    const unknown=parseLot(html+'<p>Live auction Tuesday, 10 February, 19:00</p>',url);
    expect(unknown.auctionAt).toBeUndefined();expect(auctionLabel(unknown)).toContain('saat qurşağı təsdiqlənməyib');
    const other=`<script type="application/ld+json">${JSON.stringify({'@type':'Event',url:'https://bid.cars/en/lot/1-999999/Other',startDate:'2026-12-01T15:30:00Z'})}</script>`;
    expect(parseLot(html+other,url).auctionAt).toBeUndefined();
  });
  it('recognizes explicit model-family aliases without broad substring matches', () => {
    expect(modelMatches('BMW','3 Series','330I')).toBe(true);
    expect(modelMatches('Mercedes-Benz','E-Class','E300')).toBe(true);
    expect(modelMatches('Lexus','ES','ES 350')).toBe(true);
    expect(modelMatches('Toyota','Camry','Camry Solara')).toBe(false);
    expect(modelMatches('BMW','3 Series','530I')).toBe(false);
  });
  it('recognizes controlled trim suffixes without swallowing different model names', () => {
    expect(modelMatches('Toyota','Camry','Camry LE')).toBe(true);
    expect(modelMatches('Toyota','Camry','Camry XSE AWD')).toBe(true);
    expect(modelMatches('BMW','3 Series','330I xDrive')).toBe(true);
    expect(modelMatches('Lexus','ES','ES 350 Luxury')).toBe(true);
    expect(modelMatches('Toyota','Camry','Camry Solara SE')).toBe(false);
    expect(modelMatches('Jeep','Cherokee','Grand Cherokee Limited')).toBe(false);
    expect(modelMatches('Ford','F-150','F-1500 XLT')).toBe(false);
    expect(matches(filters,parseLot(html.replace('Camry, SE','Camry LE'),url))).toBe(true);
  });
  it('extracts exact label values, compact engine, make/model and separate damage fields', () => {
    expect(parseLot(html, url)).toMatchObject({ key:'1-12345678',make:'Toyota',model:'Camry',year:2021,engineCc:2500,primaryDamage:'Front end',secondaryDamage:'Right rear',documentKind:'salvage',active:true });
    expect(matches(filters,parseLot(html,url))).toBe(true);
  });
  it('never promotes missing volume or unknown documents to an exact match', () => {
    const lot=parseLot(html,url);
    expect(matches(filters,{...lot,engineCc:null})).toBe(false);
    expect(matches({...filters,document:'clean'},{...lot,documentKind:'unknown'})).toBe(false);
    expect(documentKind('Certificate of title (CA)')).toBe('unknown');
  });
  it('classifies risky titles before salvage/clean text; keeps salvage separate', () => {
    expect(documentKind('Non-repairable salvage title')).toBe('restricted');
    expect(documentKind('Clean title - not for export')).toBe('restricted');
    expect(documentKind('Bill of sale')).toBe('restricted');
    expect(documentKind('Clean title')).toBe('clean');
    expect(documentKind('Salvage')).toBe('salvage');
  });
  it('does not guess left/right from generic side; matches selected secondary damage', () => {
    expect(damageTags('Side')).toEqual(['side']);
    expect(damageTags('Right front')).toEqual(['front','right']);
    expect(matches({...filters,damages:['right']},parseLot(html,url))).toBe(true);
    expect(matches({...filters,damages:['left']},parseLot(html,url))).toBe(false);
  });
  it('blocks archived lots, foreign URL fetches and challenge pages', () => {
    expect(parseLot(`${html}<p>Archived auction</p>`,url).active).toBe(false);
    for(const bad of ['http://bid.cars/en/lot/1-123','https://evil.test/en/lot/1-123','https://bid.cars.evil.test/en/lot/1-123','https://user:pass@bid.cars/en/lot/1-123'])expect(safeLotUrl(bad)).toBeNull();
    expect(blocked('<title>Just a moment...</title>')).toBe(true);
    expect(()=>listingLinks('<title>Just a moment...</title>')).toThrow();
  });
  it('deduplicates listing lots and builds a real filter URL with encoded model', () => {
    expect(listingLinks(`<a href="${url}">Car</a><a href="${url}">Image</a><a href="https://evil.test/en/lot/1-123">Bad</a>`)).toEqual([url]);
    const query=new URL(searchUrl({...filters,make:'Mercedes-Benz',model:'E-Class'}));
    expect(query.searchParams.get('model')).toBe('E-Class');expect(query.searchParams.get('search-type')).toBe('filters');
    expect(new URL(searchUrl({...filters,mode:'buy_now'})).searchParams.get('status')).toBe('Fast-buy');
  });
  it('extracts only a current-lot explicit positive USD Buy Now amount', () => {
    for (const value of ['$4,500','USD 4,500','4,500 USD','$4 500','$4500']) expect(buyNowPrice(html+`<p>Buy Now: ${value} Current Bid $350</p>`)).toBe(4500);
    expect(buyNowPrice(html+'<p>Buy Now:Buy Now: $4,500 Buy Now $4,500</p>')).toBe(4500);
    expect(buyNowPrice(html+'<p>Buy Now $0.50</p>')).toBe(0.5);
    expect(parseLot(html+'<p>Buy Now $4,500</p>',url).buyNowUsd).toBe(4500);
    expect(buyNowPrice(html+'<p>Current Bid $500 ACV $20,000 Estimated cost $12,000 Buy Now</p>')).toBeNull();
    expect(buyNowPrice(html+'<p>Buy Now — Current Bid $500</p><h2>Sales History</h2><p>Buy Now $100</p>')).toBeNull();
    expect(buyNowPrice(html+'<h2>Recommended vehicles</h2><p>Buy Now $100</p>')).toBeNull();
    expect(buyNowPrice(html+'<section class="sales-history"><p>Buy Now $100</p></section>')).toBeNull();
    expect(buyNowPrice(html+'<div id="related-cars"><p>Buy Now $100</p></div>')).toBeNull();
    expect(buyNowPrice(html+'<p>Buy Now $4,500</p><h2>Auction history</h2><p>Buy Now $100</p>')).toBe(4500);
  });
  it('fails closed for unavailable, foreign-currency, malformed and conflicting Buy Now amounts', () => {
    for (const value of ['$0','$-500','- $500','€4,500','4500 EUR','$4,500 EUR','4,500','$4,50','$4 50','$4.500','$4,500 - $6,000','$10000001','$4,500 Buy Now $5,000']) expect(buyNowPrice(html+`<p>Buy Now ${value}</p>`)).toBeNull();
  });
  it('ignores only history jump links but never takes history or related offer prices', () => {
    const current='<p>Buy Now $4,500</p>';
    for (const anchor of ['<a href="#history">Sales History</a>','<a href=#history>Sales History</a>','<a class="tab" href=\'#sales-history\'>Sales History (6)</a>','<a href="#auctionHistory">Auction history 11</a>']) expect(buyNowPrice(html+anchor+current)).toBe(4500);
    for (const related of ['<div class="related_offers">Buy Now $100</div>','<section id="recommended-offers">Buy Now $100</section>','<article class=related_offers>Buy Now $100</article>','<ul class="related"><li>Buy Now $100</li></ul>','<div class="vehicle_related_offers_container">Buy Now $100</div>','<aside class=\'similar_archival_offers\'>Buy Now $100</aside>','<h2>Similar archival offers</h2><p>Buy Now $100</p>']) {
      expect(buyNowPrice(html+related)).toBeNull();
      expect(buyNowPrice(html+current+related)).toBe(4500);
    }
    expect(buyNowPrice(html+'<h2><a href="#history">Sales History</a></h2><p>Buy Now $100</p>')).toBeNull();
    expect(buyNowPrice(html+'<h2>Sales History</h2><p>Buy Now $100</p>')).toBeNull();
    expect(buyNowPrice(html+'<a href="https://bid.cars/en/history">Sales History</a><p>Buy Now $100</p>')).toBeNull();
    expect(buyNowPrice(html+'<a data-href="#history">Sales History</a><p>Buy Now $100</p>')).toBeNull();
    // data-class is not a class attribute and must not truncate a current price.
    expect(buyNowPrice(html+'<div data-class="related_offers"></div>'+current)).toBe(4500);
  });
  it('requires an active matching lot and ANDs the administrator price thresholds', () => {
    const lot={...parseLot(html,url),buyNowUsd:4500};
    const deal:RadarFilters={...filters,mode:'buy_now',maxBuyNowUsd:5000,marketValueUsd:10000,minDiscountPercent:50};
    expect(dealMatches(deal,lot)).toBe(true);
    expect(dealMatches({...deal,maxBuyNowUsd:4000},lot)).toBe(false);
    expect(dealMatches({...deal,minDiscountPercent:60},lot)).toBe(false);
    expect(dealMatches({...filters,mode:'buy_now',maxBuyNowUsd:4500},lot)).toBe(true);
    expect(dealMatches({...filters,mode:'buy_now',marketValueUsd:9000,minDiscountPercent:50},lot)).toBe(true);
    expect(dealMatches({...filters,mode:'buy_now',marketValueUsd:4500,minDiscountPercent:0},lot)).toBe(true);
    expect(dealMatches({...filters,mode:'buy_now',marketValueUsd:4499,minDiscountPercent:0},lot)).toBe(false);
    expect(dealMatches(deal,{...lot,active:false})).toBe(false);
    expect(dealMatches(deal,{...lot,make:'Honda'})).toBe(false);
    for (const value of [null,undefined,0,-1,NaN,Infinity,10000001]) expect(dealMatches(deal,{...lot,buyNowUsd:value})).toBe(false);
    expect(dealMatches(filters,lot)).toBe(false);
  });
  it('rejects incomplete or malformed price rules even without DTO validation', () => {
    const lot={...parseLot(html,url),buyNowUsd:4500};
    for (const rule of [{},{marketValueUsd:10000},{minDiscountPercent:40},{maxBuyNowUsd:5000,marketValueUsd:10000},{maxBuyNowUsd:NaN},{maxBuyNowUsd:-1},{marketValueUsd:10000,minDiscountPercent:-1},{marketValueUsd:10000,minDiscountPercent:100}]) expect(dealMatches({...filters,mode:'buy_now',...rule},lot)).toBe(false);
  });
  it('reports actual price and explicitly admin-supplied reference instead of invented market value', () => {
    const lot={...parseLot(html,url),buyNowUsd:4500};
    const deal:RadarFilters={...filters,mode:'buy_now',maxBuyNowUsd:5000,marketValueUsd:10000,minDiscountPercent:50};
    const details=dealDetails(deal,lot), message=radarMessage('Ucuz Camry',lot,deal);
    expect(details).toContain('Buy Now: $4,500');expect(details).toContain('Adminin maksimum alış həddi: $5,000');
    expect(details).toContain('Adminin daxil etdiyi bazar istinadı: $10,000');expect(details).toContain('avtomatik qiymətləndirmə deyil');
    expect(details).toContain('$5,500 (55%)');expect(message).toContain(url);expect(message).toContain('gömrük və təmir daxil deyil');
    expect(dealDetails({...filters,mode:'buy_now',maxBuyNowUsd:5000},lot)).not.toContain('bazar istinadı');
  });
});
