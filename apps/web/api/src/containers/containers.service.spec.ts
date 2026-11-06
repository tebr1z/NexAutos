import { ContainersService } from './containers.service';
import { VesselsService } from '../vessels/vessels.service';
import { fetchLiveOcean } from './live';
jest.mock('./live', () => ({ fetchLiveOcean: jest.fn() }));

describe('container lookup', () => {
  const vessels = { positionByImo: jest.fn(), positionByName: jest.fn() };
  const service = new ContainersService(vessels as unknown as VesselsService);
  beforeEach(() => jest.resetAllMocks());
  it('rejects invalid check digits before contacting a paid provider', async () => {
    await expect(service.lookup('MSCU1234567')).rejects.toThrow();
    expect(fetchLiveOcean).not.toHaveBeenCalled();
  });
  it('does not turn the former demo container into a real vessel position', async () => {
    jest.mocked(fetchLiveOcean).mockResolvedValue(null);
    await expect(service.lookup('MSCU4829137')).rejects.toThrow();
    expect(fetchLiveOcean).not.toHaveBeenCalled();
  });
  it('asks AIS even when a known port coordinate exists', async () => {
    jest.mocked(fetchLiveOcean).mockResolvedValue({ source: 'live', vesselName: 'SHIP', vesselImo: '9708447', currentPort: 'Savannah' });
    vessels.positionByImo.mockResolvedValue({ hasCoordinates: true, latitude: 35, longitude: -20, source: 'ais', lastUpdate: '2026-10-22T10:00:00Z' });
    expect(await service.lookup('MSCU4829130')).toMatchObject({ positionKind: 'ais', lat: 35, lng: -20 });
  });
});
