import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { LotRadarController } from './lot-radar.controller';
import { CreateDealDto, CreateWatchDto } from './dto';
describe('radar plan permission boundary',()=>{
  it('reserves admin plan methods for administrators',()=>{
    expect(Reflect.getMetadata(ROLES_KEY,LotRadarController.prototype.savePlan)).toEqual(['SUPER_ADMIN','ADMIN']);
    expect(Reflect.getMetadata(ROLES_KEY,LotRadarController.prototype.adminPlan)).toEqual(['SUPER_ADMIN','ADMIN']);
    for(const method of ['deals','createDeal','collect','collected'])expect(Reflect.getMetadata(ROLES_KEY,LotRadarController.prototype[method])).toEqual(['SUPER_ADMIN','ADMIN']);
  });
  it('customer search input cannot inject billing limits or a recipient phone',async()=>{
    const dto=plainToInstance(CreateWatchDto,{name:'Camry',make:'Toyota',model:'Camry',yearFrom:2020,yearTo:2026,damages:[],document:'any',emailEnabled:false,whatsappEnabled:true,monthlyAlertLimit:999999,phone:'994501111111'});
    const errors=await validate(dto,{whitelist:true,forbidNonWhitelisted:true});
    expect(errors.map(e=>e.property)).toEqual(expect.arrayContaining(['monthlyAlertLimit','phone']));
  });
  it('customer searches cannot inject a Buy Now rule, comparison price or collector target',async()=>{
    const base={name:'Camry',make:'Toyota',model:'Camry',yearFrom:2020,yearTo:2026,damages:[],document:'any',emailEnabled:false,whatsappEnabled:false};
    const dto=plainToInstance(CreateWatchDto,{...base,mode:'buy_now',maxBuyNowUsd:5000,marketValueUsd:9000,minDiscountPercent:20,collectorUserId:'admin'});
    const errors=await validate(dto,{whitelist:true,forbidNonWhitelisted:true});
    expect(errors.map(e=>e.property)).toEqual(expect.arrayContaining(['mode','maxBuyNowUsd','marketValueUsd','minDiscountPercent','collectorUserId']));
    expect(await validate(plainToInstance(CreateDealDto,{...base,maxBuyNowUsd:5000,marketValueUsd:9000,minDiscountPercent:0}),{whitelist:true,forbidNonWhitelisted:true})).toHaveLength(0);
    expect(await validate(plainToInstance(CreateDealDto,{...base,maxBuyNowUsd:0}))).not.toHaveLength(0);
  });
});
