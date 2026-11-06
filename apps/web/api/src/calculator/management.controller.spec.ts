import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../auth/guards';
import { CalculatorController } from './calculator.controller';
import { CalculatorService } from './calculator.service';

describe('Selected-account management and extension report routes', () => {
  let app: INestApplication;
  const calculator = {
    profile: jest.fn(async (userId: string) => ({ userId })),
    save: jest.fn(async (userId: string) => ({ userId })),
    report: jest.fn(async () => ({ id: 'report-1' })),
    reports: jest.fn(async () => []),
    resolve: jest.fn(async () => ({ id: 'report-1', status: 'RESOLVED' })),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [CalculatorController],
      providers: [{ provide: CalculatorService, useValue: calculator }],
    }).overrideGuard(JwtAuthGuard).useValue({
      canActivate: (context: { switchToHttp: () => { getRequest: () => { user: unknown; headers: Record<string, string> } } }) => {
        const req = context.switchToHttp().getRequest();
        req.user = { id: 'signed-in-admin', role: req.headers['x-test-role'] || 'SUPER_ADMIN' };
        return true;
      },
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });
  afterAll(async () => app.close());
  beforeEach(() => jest.clearAllMocks());

  it('reads each selected user, not the signed-in admin', async () => {
    for (const target of ['customer-a', 'customer-b']) {
      await request(app.getHttpServer()).get(`/api/v1/calculator/users/${target}`).expect(200, { userId: target });
      expect(calculator.profile).toHaveBeenLastCalledWith(target);
    }
    expect(calculator.profile).not.toHaveBeenCalledWith('signed-in-admin');
  });

  it('writes the selected user and passes the signed-in admin only as actor', async () => {
    await request(app.getHttpServer()).patch('/api/v1/calculator/users/customer-b').send({ monthlyLimit: 25 }).expect(200);
    expect(calculator.save).toHaveBeenCalledWith('customer-b', expect.objectContaining({ monthlyLimit: 25 }), { id: 'signed-in-admin', role: 'SUPER_ADMIN' });
  });

  it('does not allow non-admin users to read or change another account', async () => {
    await request(app.getHttpServer()).get('/api/v1/calculator/users/customer-a').set('x-test-role', 'FREIGHT_USER').expect(403);
    await request(app.getHttpServer()).patch('/api/v1/calculator/users/customer-a').set('x-test-role', 'FREIGHT_USER').send({ monthlyLimit: 25 }).expect(403);
    expect(calculator.profile).not.toHaveBeenCalled();
    expect(calculator.save).not.toHaveBeenCalled();
  });

  it('the existing extension report submission is associated with the authenticated account', async () => {
    await request(app.getHttpServer()).post('/api/v1/calculator/reports').set('x-test-role', 'FREIGHT_USER')
      .send({ message: 'Mühərrik oxunmadı', version: '1.13.6', pageUrl: 'https://bid.cars/en/lot/1-12345678' }).expect(201);
    expect(calculator.report).toHaveBeenCalledWith('signed-in-admin', expect.objectContaining({ message: 'Mühərrik oxunmadı' }));
  });

  it('a report cannot inject another reporter id', async () => {
    await request(app.getHttpServer()).post('/api/v1/calculator/reports')
      .send({ message: 'Mühərrik oxunmadı', userId: 'another-user' }).expect(400);
    expect(calculator.report).not.toHaveBeenCalled();
  });

  it('only admins can list reports and change resolution status', async () => {
    await request(app.getHttpServer()).get('/api/v1/calculator/reports').expect(200, []);
    await request(app.getHttpServer()).patch('/api/v1/calculator/reports/report-1').send({ status: 'RESOLVED' }).expect(200);
    expect(calculator.resolve).toHaveBeenCalledWith('report-1', 'RESOLVED');
    for (const role of ['CUSTOMER', 'FREIGHT_USER', 'STAFF', 'MANAGER']) {
      await request(app.getHttpServer()).get('/api/v1/calculator/reports').set('x-test-role', role).expect(403);
      await request(app.getHttpServer()).patch('/api/v1/calculator/reports/report-1').set('x-test-role', role).send({ status: 'RESOLVED' }).expect(403);
    }
    expect(calculator.reports).toHaveBeenCalledTimes(1);
    expect(calculator.resolve).toHaveBeenCalledTimes(1);
  });

  it('rejects unsupported report statuses', async () => {
    await request(app.getHttpServer()).patch('/api/v1/calculator/reports/report-1').send({ status: 'DELETED' }).expect(400);
    expect(calculator.resolve).not.toHaveBeenCalled();
  });
});
