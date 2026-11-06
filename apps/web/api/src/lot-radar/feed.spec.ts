import { parseRadarFeed } from './feed';
const lot={url:'https://bid.cars/en/lot/1-12345678/2021-Toyota-Camry',title:'2021 Toyota Camry',make:'Toyota',model:'Camry',year:2021,engineCc:2500,primaryDamage:'Right front',document:'Salvage',active:true,auctionAt:'2026-12-01T12:00:00-05:00'};
describe('authorized inventory adapter',()=>{
  it('canonicalizes exact offset times and classifies the document itself',()=>{
    expect(parseRadarFeed({complete:true,lots:[lot]})[0]).toMatchObject({key:'1-12345678',documentKind:'salvage',auctionAt:'2026-12-01T17:00:00.000Z'});
  });
  it('refuses incomplete batches, non-BidCars links and ambiguous timestamps',()=>{
    expect(()=>parseRadarFeed({complete:false,lots:[]})).toThrow();
    expect(()=>parseRadarFeed({complete:true,lots:[{...lot,url:'https://evil.test'}]})).toThrow();
    expect(()=>parseRadarFeed({complete:true,lots:[{...lot,auctionAt:'2026-12-01 12:00'}]})).toThrow();
  });
});
