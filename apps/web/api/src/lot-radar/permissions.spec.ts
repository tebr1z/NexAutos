import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { LotRadarController } from './lot-radar.controller';
import { CreateWatchDto } from './dto';
describe('radar plan permission boundary',()=>{
  it('reserves admin plan methods for administrators',()=>{
    expect(Reflect.getMetadata(ROLES_KEY,LotRadarController.prototype.savePlan)).toEqual(['SUPER_ADMIN','ADMIN']);
    expect(Reflect.getMetadata(ROLES_KEY,LotRadarController.prototype.adminPlan)).toEqual(['SUPER_ADMIN','ADMIN']);
  });
  it('customer search input cannot inject billing limits or a recipient phone',async()=>{
    const dto=plainToInstance(CreateWatchDto,{name:'Camry',make:'Toyota',model:'Camry',yearFrom:2020,yearTo:2026,damages:[],document:'any',emailEnabled:false,whatsappEnabled:true,monthlyAlertLimit:999999,phone:'994501111111'});
    const errors=await validate(dto,{whitelist:true,forbidNonWhitelisted:true});
    expect(errors.map(e=>e.property)).toEqual(expect.arrayContaining(['monthlyAlertLimit','phone']));
  });
});
