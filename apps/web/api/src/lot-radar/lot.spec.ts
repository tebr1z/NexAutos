import { auctionLabel, blocked, damageTags, documentKind, listingLinks, matches, modelMatches, parseLot, radarMessage, RadarFilters, safeLotUrl, searchUrl } from './lot';
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
  });
});
