import { AccessUsersService } from './access-users.service';
import { PrismaService } from '../prisma/prisma.service';
describe('admin customer onboarding',()=>{
  const actor={id:'admin',role:'ADMIN' as const};
  it('creates a customer with normalized WhatsApp number, profile and admin-selected radar limits atomically',async()=>{
    const db:any={user:{findUnique:jest.fn().mockResolvedValue(null),create:jest.fn(async x=>x.data)}};
    const service=new AccessUsersService(db as PrismaService);
    const created=await service.create({name:'Customer',email:'CLIENT@EXAMPLE.COM',password:'test-password-only',role:'CUSTOMER',phone:'050 123 45 67',radarWatchLimit:2,radarMonthlyAlertLimit:25},actor);
    expect(created).toMatchObject({email:'client@example.com',phone:'994501234567',role:'CUSTOMER',radarPlan:{create:{enabled:true,watchLimit:2,monthlyAlertLimit:25}},customer:{create:{phone:'994501234567'}}});
  });
  it('an administrator can change a customer phone but cannot change a protected admin',async()=>{
    const db:any={user:{findFirst:jest.fn().mockResolvedValue({id:'client',role:'CUSTOMER',customer:{id:'c'}}),update:jest.fn(async x=>x.data)}};
    const service=new AccessUsersService(db as PrismaService);
    expect(await service.update('client',{phone:'+994 55 123 45 67'},actor)).toMatchObject({phone:'994551234567',customer:{update:{phone:'994551234567'}}});
    db.user.findFirst.mockResolvedValue({id:'root',role:'SUPER_ADMIN'});
    await expect(service.update('root',{phone:'+994 55 123 45 67'},actor)).rejects.toThrow('qorunur');
  });
});
