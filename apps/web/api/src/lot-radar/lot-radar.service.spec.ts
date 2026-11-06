import { LotRadarService, RADAR_INTERVAL_MS, radarMonth } from './lot-radar.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotifyService } from '../notify/notify.service';
import { parseLot } from './lot';

describe('Lot Radar isolation, baseline and delivery', () => {
  const filters={make:'Toyota',model:'Camry',yearFrom:2020,yearTo:2025,damages:[],document:'any'};
  const lot=parseLot('<h1>2021 Toyota Camry, LE</h1><p>Engine 2.5L Transmission Automatic</p>','https://bid.cars/en/lot/1-12345678/2021-Toyota-Camry');
  let service: LotRadarService;
  let db: any;
  let notify: any;
  let stored: Map<string, any>;
  let used: number;
  beforeEach(()=>{
    used=0;stored=new Map();notify={sendEmail:jest.fn().mockResolvedValue({sent:false,error:'not_configured'}),sendRadarWhatsApp:jest.fn().mockResolvedValue({sent:true})};
    db={lotWatch:{findFirst:jest.fn(),findUnique:jest.fn(),findMany:jest.fn().mockResolvedValue([]),count:jest.fn().mockResolvedValue(0),create:jest.fn(async v=>v.data),updateMany:jest.fn().mockResolvedValue({count:1})},lotWatchLot:{
      createMany:jest.fn(async ({data})=>{if(stored.has(data[0].lotKey))return {count:0};stored.set(data[0].lotKey,{id:data[0].lotKey,...data[0]});return {count:1};}),
      findUnique:jest.fn(async({where})=>stored.get(where.watchId_lotKey.lotKey)||null),
      findMany:jest.fn().mockResolvedValue([]),updateMany:jest.fn(async({where,data})=>{const row=[...stored.values()].find(v=>v.id===where.id);if(row)Object.assign(row,data);return{count:1};}),update:jest.fn(),
    },$queryRaw:jest.fn().mockResolvedValue([]),radarPlan:{findUnique:jest.fn().mockResolvedValue(null)},radarUsage:{upsert:jest.fn(async()=>({used})),update:jest.fn(async({data})=>{used+=data.used.increment;return{used};})},user:{findUnique:jest.fn().mockResolvedValue({id:'admin',role:'SUPER_ADMIN',isActive:true}),findUniqueOrThrow:jest.fn().mockResolvedValue({id:'u',phone:'994501234567'})},$transaction:jest.fn(async fn=>fn(db))};
    db.radarPlan.findUnique.mockResolvedValue({enabled:true,watchLimit:3,monthlyAlertLimit:100});
    service=new LotRadarService(db as PrismaService,notify as NotifyService);
  });
  it('rejects another account search before mutation or lookup',async()=>{
    db.lotWatch.findFirst.mockResolvedValue(null);
    await expect(service.begin('user-b','watch-a')).rejects.toThrow('Axtarış tapılmadı');
    expect(db.lotWatch.findFirst).toHaveBeenCalledWith({where:{id:'watch-a',userId:'user-b'}});
    expect(db.lotWatch.updateMany).not.toHaveBeenCalled();
  });
  it('first scan is quiet; repeated existing lot does not notify, new lot does',async()=>{
    const watch={id:'w',filters,initializedAt:null};const lease=new Date();
    await expect((service as any).process(watch,[lot],lease)).resolves.toMatchObject({baseline:true,newMatches:0});
    expect(stored.get(lot.key).isAlert).toBe(false);
    const initialized={...watch,initializedAt:new Date()};
    await expect((service as any).process(initialized,[lot],lease)).resolves.toMatchObject({newMatches:0});
    const next={...lot,key:'1-87654321',url:'https://bid.cars/en/lot/1-87654321/2021-Toyota-Camry'};
    await expect((service as any).process(initialized,[next],lease)).resolves.toMatchObject({newMatches:1});
    await expect((service as any).process(initialized,[next],lease)).resolves.toMatchObject({newMatches:0});
  });
  it('failed email does not mark sent and successful WhatsApp is recorded independently',async()=>{
    db.lotWatch.findUnique.mockResolvedValue({id:'w',enabled:true,emailEnabled:true,whatsappEnabled:true,user:{isActive:true,email:'own@example.com',phone:'994501234567'},name:'Camry'});
    db.lotWatchLot.findMany.mockResolvedValue([{id:'alert',attempts:0,data:lot,emailSentAt:null,whatsappSentAt:null}]);
    await (service as any).deliver('w');
    expect(notify.sendEmail).toHaveBeenCalledWith(expect.objectContaining({to:'own@example.com'}));
    expect(db.lotWatchLot.update).toHaveBeenCalledWith({where:{id:'alert'},data:expect.objectContaining({emailSentAt:undefined,emailError:'not_configured',whatsappSentAt:expect.any(Date),deliveryLeaseUntil:null})});
  });
  it('does not resend an already successful channel on retry',async()=>{
    db.lotWatch.findUnique.mockResolvedValue({id:'w',enabled:true,emailEnabled:true,whatsappEnabled:true,user:{isActive:true,email:'own@example.com',phone:'994501234567'},name:'Camry'});
    db.lotWatchLot.findMany.mockResolvedValue([{id:'alert',attempts:1,data:lot,emailSentAt:new Date(),whatsappSentAt:null}]);
    await (service as any).deliver('w');expect(notify.sendEmail).not.toHaveBeenCalled();expect(notify.sendRadarWhatsApp).toHaveBeenCalledTimes(1);
  });
  it('lost scan leases cannot write any observations',async()=>{
    db.lotWatch.updateMany.mockResolvedValue({count:0});
    await expect((service as any).process({id:'w',filters,initializedAt:new Date()},[lot],new Date())).rejects.toThrow();
    expect(db.lotWatchLot.createMany).not.toHaveBeenCalled();
  });
  it('enforces admin monthly quota, charges once and retains usage independently of search deletion',async()=>{
    db.radarPlan.findUnique.mockResolvedValue({enabled:true,watchLimit:3,monthlyAlertLimit:1});
    const watch={id:'w',userId:'u',filters,initializedAt:new Date()};
    await (service as any).process(watch,[lot],new Date());
    expect(used).toBe(1);
    await (service as any).process(watch,[lot],new Date());expect(used).toBe(1);
    const next={...lot,key:'1-87654321'};
    await expect((service as any).process(watch,[next],new Date())).resolves.toMatchObject({newMatches:0});
    expect(stored.get(next.key)).toMatchObject({isAlert:false,quotaBlocked:true});expect(used).toBe(1);
    expect(db.$queryRaw).toHaveBeenCalledTimes(3);
  });
  it('refuses new searches when the account active-search limit is reached',async()=>{
    db.radarPlan.findUnique.mockResolvedValue({enabled:true,watchLimit:1,monthlyAlertLimit:10});
    db.lotWatch.count=jest.fn().mockResolvedValue(1);db.lotWatch.create=jest.fn();
    await expect(service.create('u',{...filters,name:'Camry',emailEnabled:false,whatsappEnabled:true} as any)).rejects.toThrow('limitiniz');
    expect(db.lotWatch.create).not.toHaveBeenCalled();
  });
  it('a disabled plan stops in-flight result processing and outbound deliveries',async()=>{
    db.radarPlan.findUnique.mockResolvedValue({enabled:false,watchLimit:3,monthlyAlertLimit:10});
    await expect((service as any).process({id:'w',userId:'u',filters},[lot],new Date())).rejects.toThrow('dayandırılıb');
    expect(db.lotWatchLot.createMany).not.toHaveBeenCalled();
    db.lotWatch.findUnique.mockResolvedValue({id:'w',userId:'u',enabled:true,user:{isActive:true}});
    await (service as any).deliver('w');expect(notify.sendEmail).not.toHaveBeenCalled();expect(notify.sendRadarWhatsApp).not.toHaveBeenCalled();
  });
  it('uses the Baku month boundary rather than the server timezone',()=>{
    expect(radarMonth(new Date('2026-11-30T19:59:59Z'))).toBe('2026-11');
    expect(radarMonth(new Date('2026-11-30T20:00:00Z'))).toBe('2026-12');
  });
  it('lowering an admin limit pauses excess watches and cancels their leases',async()=>{
    db.user.findUnique=jest.fn().mockResolvedValue({id:'u',phone:'994501234567'});
    db.radarPlan.upsert=jest.fn();db.lotWatch.findMany=jest.fn().mockResolvedValue([{id:'excess'}]);
    db.lotWatch.count=jest.fn().mockResolvedValue(1);db.radarUsage.findUnique=jest.fn().mockResolvedValue({used:7});
    await service.savePlan('u',{enabled:true,watchLimit:1,monthlyAlertLimit:20});
    expect(db.lotWatch.findMany).toHaveBeenCalledWith(expect.objectContaining({skip:1}));
    expect(db.lotWatch.updateMany).toHaveBeenCalledWith({where:{id:{in:['excess']}},data:{enabled:false,leaseUntil:null,collectorUserId:null}});
    expect(db.radarUsage.update).not.toHaveBeenCalled();
  });
  it('Buy Now rules alert cheap existing inventory on the first scan, once per lot',async()=>{
    const watch={id:'w',userId:'u',filters:{...filters,mode:'buy_now',maxBuyNowUsd:5000},initializedAt:null};
    await expect((service as any).process(watch,[{...lot,buyNowUsd:4500}],new Date(),'browser')).resolves.toMatchObject({baseline:true,newMatches:1});
    await expect((service as any).process(watch,[{...lot,buyNowUsd:4000}],new Date(),'browser')).resolves.toMatchObject({newMatches:0});
    expect(used).toBe(1);expect(stored.get(lot.key).data.buyNowUsd).toBe(4500);
  });
  it('a previously observed expensive Buy Now lot alerts after its price crosses the rule',async()=>{
    const watch={id:'w',userId:'u',filters:{...filters,mode:'buy_now',maxBuyNowUsd:5000},initializedAt:new Date()};
    await (service as any).process(watch,[{...lot,buyNowUsd:8500}],new Date());
    expect(stored.get(lot.key).isAlert).toBe(false);expect(used).toBe(0);
    await expect((service as any).process(watch,[{...lot,buyNowUsd:5000}],new Date())).resolves.toMatchObject({newMatches:1});
    expect(stored.get(lot.key)).toMatchObject({isAlert:true,data:{buyNowUsd:5000}});expect(used).toBe(1);
  });
  it('Buy Now rules never treat missing price as zero or exceed the monthly allowance',async()=>{
    db.radarPlan.findUnique.mockResolvedValue({enabled:true,watchLimit:3,monthlyAlertLimit:0});
    const watch={id:'w',userId:'u',filters:{...filters,mode:'buy_now',maxBuyNowUsd:5000},initializedAt:null};
    await (service as any).process(watch,[{...lot,buyNowUsd:null}],new Date());
    expect(stored.get(lot.key)).toMatchObject({isAlert:false,quotaBlocked:false});
    await (service as any).process(watch,[{...lot,buyNowUsd:1000}],new Date());
    expect(stored.get(lot.key)).toMatchObject({isAlert:false,quotaBlocked:true});expect(used).toBe(0);
  });
  it('successful and failed scans schedule the next attempt twenty minutes later',async()=>{
    const before=Date.now();
    await (service as any).process({id:'w',userId:'u',filters,initializedAt:null},[],new Date(),'browser');
    const success=db.lotWatch.updateMany.mock.calls.at(-1)[0].data;
    expect(success.lastSource).toBe('browser');expect(success.nextCheckAt.getTime()).toBeGreaterThanOrEqual(before+RADAR_INTERVAL_MS);
    await (service as any).fail('w',new Date(),new Error('Cloudflare'));
    const failure=db.lotWatch.updateMany.mock.calls.at(-1)[0].data;
    expect(failure.nextCheckAt.getTime()).toBeGreaterThanOrEqual(before+RADAR_INTERVAL_MS);expect(failure.collectorUserId).toBeNull();
  });
  it('admin deal inputs require a real threshold and never accept a different recipient',async()=>{
    const base={...filters,name:'Camry ucuz',emailEnabled:true,whatsappEnabled:false} as any;
    await expect(service.createDeal('admin',base)).rejects.toThrow('Buy Now');
    await expect(service.createDeal('admin',{...base,marketValueUsd:10000})).rejects.toThrow('birlikdə');
    await service.createDeal('admin',{...base,maxBuyNowUsd:5000});
    expect(db.lotWatch.create).toHaveBeenCalledWith({data:expect.objectContaining({userId:'admin',emailEnabled:true,filters:expect.objectContaining({mode:'buy_now',maxBuyNowUsd:5000})})});
  });
  it('only an active admin can claim the central browser collector',async()=>{
    db.user.findUnique.mockResolvedValue({role:'CUSTOMER',isActive:true});
    await expect(service.collectNext('customer')).rejects.toThrow('administrator');
    expect(db.lotWatch.findMany).not.toHaveBeenCalled();
  });
  it('central collector binds a due customer job to its admin lease and exposes no recipient details',async()=>{
    db.lotWatch.findMany.mockResolvedValue([{id:'customer-watch',userId:'private-customer',enabled:true,filters:{...filters,mode:'buy_now',maxBuyNowUsd:5000}}]);
    const result=await service.collectNext('admin');
    expect(result.job).toMatchObject({id:'customer-watch',known:[],refreshKnown:true});
    expect(result.job).not.toHaveProperty('userId');expect(result.job).not.toHaveProperty('phone');
    expect(db.lotWatch.updateMany).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({collectorUserId:'admin',browserAttemptedAt:expect.any(Date)})}));
    const criteria=db.lotWatch.findMany.mock.calls[0][0].where;
    expect(criteria.user).toMatchObject({isActive:true,radarPlan:{enabled:true}});expect(criteria.AND).toHaveLength(3);
  });
  it('a different admin cannot finish a collector lease and customers cannot finish collector-owned work',async()=>{
    db.lotWatch.findFirst.mockResolvedValueOnce(null);
    await expect(service.finishCollected('other-admin','w',{lease:new Date().toISOString(),lots:[]})).rejects.toThrow('sizə aid deyil');
    expect(db.lotWatch.findFirst).toHaveBeenLastCalledWith({where:{id:'w',collectorUserId:'other-admin'}});
    db.lotWatch.findFirst.mockResolvedValueOnce({id:'w',collectorUserId:'admin'});
    await expect(service.finish('customer','w',{lease:new Date().toISOString(),lots:[]})).rejects.toThrow('admin kollektoru');
  });
  it('a JavaScript-only search shell is a source error, never a successful empty baseline',async()=>{
    db.lotWatch.findFirst.mockResolvedValue({id:'w',userId:'u',enabled:true,filters,initializedAt:null});
    const fetchMock=jest.spyOn(global,'fetch').mockResolvedValue({ok:true,text:async()=>'<html><h1>Search filters</h1><div id="results"></div></html>'} as Response);
    try {
      await expect(service.scan('u','w')).rejects.toThrow('JavaScript');
      expect(db.lotWatchLot.createMany).not.toHaveBeenCalled();
      expect(db.lotWatch.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({data:expect.objectContaining({lastError:expect.stringContaining('JavaScript'),collectorUserId:null})}));
    } finally {fetchMock.mockRestore();}
  });
  it('direct Buy Now scans re-fetch known lots to observe price drops',async()=>{
    const watch={id:'w',userId:'u',enabled:true,filters:{...filters,mode:'buy_now',maxBuyNowUsd:5000},initializedAt:new Date()};
    db.lotWatch.findFirst.mockResolvedValue(watch);db.lotWatchLot.findMany.mockResolvedValue([{lotKey:lot.key}]);
    stored.set(lot.key,{id:lot.key,lotKey:lot.key,isAlert:false,quotaBlocked:false,data:{...lot,buyNowUsd:8000}});
    const fetchMock=jest.spyOn(global,'fetch').mockImplementation(async url=>({ok:true,text:async()=>String(url).includes('/search/')?`<a href="${lot.url}">Lot</a>`:'<h1>2021 Toyota Camry, LE</h1><p>Buy Now: $4,500 USD Engine 2.5L Transmission Automatic</p>'} as Response));
    try {
      await expect(service.scan('u','w')).resolves.toMatchObject({newMatches:1});
      expect(fetchMock).toHaveBeenCalledWith(lot.url,expect.anything());expect(stored.get(lot.key).data.buyNowUsd).toBe(4500);
    } finally {fetchMock.mockRestore();}
  });
});
