import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../stores/infoStore.ts', () => ({
  useInfoStore: vi.fn(),
}));

describe('getBatteryStatus', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();

    // Stub browser globals required at module load time
    vi.stubGlobal('window', {});
    vi.stubGlobal('navigator', { getBattery: vi.fn().mockResolvedValue({ level: 0.8 }) });
  });

  it('returns initialBatteryStatus unchanged on iOS', async () => {
    vi.stubEnv('MODE', 'capacitor');
    const { getBatteryStatus } = await import('./commonMethods.js');

    const status = await getBatteryStatus({ level: 0.5 } as any);
    expect(status).toEqual({ level: 0.5 });

    const navigator = global.navigator as any;
    expect(navigator.getBattery).not.toHaveBeenCalled();
  });

  it('calls navigator.getBattery on non-iOS platforms', async () => {
    vi.stubEnv('MODE', 'electron');
    const { getBatteryStatus } = await import('./commonMethods.js');

    const status = await getBatteryStatus(null);
    expect(status).toEqual({ level: 0.8 });

    const navigator = global.navigator as any;
    expect(navigator.getBattery).toHaveBeenCalledTimes(1);
  });

  it('returns undefined when navigator.getBattery rejects', async () => {
    vi.stubEnv('MODE', 'electron');

    const mockGetBattery = vi.fn().mockRejectedValue(new Error('API not available'));
    vi.stubGlobal('navigator', { getBattery: mockGetBattery });

    const { getBatteryStatus } = await import('./commonMethods.js');
    const status = await getBatteryStatus(undefined);
    expect(status).toBeUndefined();
  });
});
