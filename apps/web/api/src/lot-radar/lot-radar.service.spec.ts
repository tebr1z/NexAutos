import { LotRadarService, radarMonth } from './lot-radar.service';
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
    db={lotWatch:{findFirst:jest.fn(),findUnique:jest.fn(),updateMany:jest.fn().mockResolvedValue({count:1})},lotWatchLot:{
      createMany:jest.fn(async ({data})=>{if(stored.has(data[0].lotKey))return {count:0};stored.set(data[0].lotKey,data[0]);return {count:1};}),
      findMany:jest.fn().mockResolvedValue([]),updateMany:jest.fn().mockResolvedValue({count:1}),update:jest.fn(),
    },$queryRaw:jest.fn().mockResolvedValue([]),radarPlan:{findUnique:jest.fn().mockResolvedValue(null)},radarUsage:{upsert:jest.fn(async()=>({used})),update:jest.fn(async({data})=>{used+=data.used.increment;return{used};})},user:{findUniqueOrThrow:jest.fn().mockResolvedValue({id:'u',phone:'994501234567'})},$transaction:jest.fn(async fn=>fn(db))};
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
    expect(db.lotWatch.updateMany).toHaveBeenCalledWith({where:{id:{in:['excess']}},data:{enabled:false,leaseUntil:null}});
    expect(db.radarUsage.update).not.toHaveBeenCalled();
  });
});
