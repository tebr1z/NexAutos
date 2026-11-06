import { parseSearates } from './live';

describe('container tracking provenance', () => {
  const fixture = () => ({ data: {
    locations: [{ id: 1, name: 'Savannah' }, { id: 2, name: 'Poti' }],
    vessels: [{ id: 1, name: 'CURRENT SHIP', imo: 9708447 }, { id: 2, name: 'FUTURE SHIP' }],
    containers: [{ status: 'IN_TRANSIT', events: [
      { actual: true, date: '2026-10-20T00:00:00Z', location: 1, vessel: 1 },
      { actual: false, date: '2026-11-20T00:00:00Z', location: 2, vessel: 2 },
    ] }],
    route: { pol: { location: 1 }, pod: { location: 2, date: 'invalid date' }, pin: [42.155, 41.672] },
  } });
  it('selects the actual event vessel, not a future transshipment, and does not call a route pin AIS', () => {
    const result = parseSearates(fixture());
    expect(result).toMatchObject({ vesselName: 'CURRENT SHIP', currentPort: 'Savannah', positionKind: 'unknown' });
    expect(result?.lat).toBeUndefined();
    expect(result?.eta).toBeUndefined();
  });
  it('accepts equatorial AIS coordinates and retains their observation time', () => {
    const data = fixture();
    Object.assign(data.data.route, { ais: { data: { vessel: { name: 'CURRENT SHIP', imo: 9708447 }, location: { lat: 0, lng: 12 }, updated_at: '2026-10-22T10:00:00Z' } } });
    expect(parseSearates(data)).toMatchObject({ positionKind: 'ais', lat: 0, lng: 12, positionSource: 'SeaRates AIS', positionUpdatedAt: '2026-10-22T10:00:00Z' });
  });
  it('reads the documented SeaRates v3 last_vessel_position block and carrier', () => {
    const data = fixture();
    Object.assign(data.data, { metadata: { sealine: 'CMDU', sealine_name: 'CMA CGM' } });
    Object.assign(data.data.route, { ais: { status: 'OK', data: { vessel: { name: 'CMA CGM SAMSON', imo: 9436379 }, last_vessel_position: { lat: 6.026275, lng: 95.04732, updated_at: '2026-10-22 13:06:55' } } } });
    expect(parseSearates(data)).toMatchObject({ positionKind: 'ais', lat: 6.026275, lng: 95.04732, carrierCode: 'CMDU', carrierName: 'CMA CGM', positionUpdatedAt: '2026-10-22 13:06:55' });
  });
});
