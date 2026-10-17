import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../stores/infoStore.ts', () => ({
  useInfoStore: vi.fn(),
}));

const fsMock = vi.hoisted(() => ({
  readFile: vi.fn(),
  stat: vi.fn(),
}));
vi.mock('@capacitor/filesystem', () => ({ Filesystem: fsMock }));

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

describe('registrationErrorText', () => {
  it('translates reconnect authentication failures locally', async () => {
    const { registrationErrorText } = await import('./commonMethods.js');
    const vm = { $t: vi.fn(() => 'translated') };

    expect(registrationErrorText(vm, { code: 'RECONNECT_AUTH_FAILED' })).toBe('translated');
    expect(vm.$t).toHaveBeenCalledWith('student.reconnectFailed');
  });

  it('translates clock skew and leaves a bad secret as forbidden', async () => {
    const { registrationErrorText } = await import('./commonMethods.js');
    const vm = { $t: vi.fn((key) => key) };

    expect(registrationErrorText(vm, { code: 'CLOCK_SKEW', message: 'clockskew' })).toBe('student.clockSkew');
    expect(registrationErrorText(vm, { message: 'forbidden' })).toBe('forbidden');
  });
});

describe('readUint8Array', () => {
  const CHUNK = 2 * 1024 * 1024;

  const bytes = (n, startByte = 0) => {
    const arr = new Uint8Array(n);
    for (let i = 0; i < n; i++) arr[i] = (startByte + i) & 0xff;
    return arr;
  };
  const b64 = (u8) => Buffer.from(u8).toString('base64');

  beforeEach(() => {
    vi.resetModules();
    // Node's atob is slow for multi-MB strings in the vitest environment; use a Buffer-based
    // equivalent so the chunked multi-megabyte reads run fast.
    vi.stubGlobal('atob', (encoded) => Buffer.from(encoded, 'base64').toString('latin1'));
    fsMock.readFile.mockReset();
    fsMock.stat.mockReset();
  });

  it('reads the whole file in a single call on non-iOS platforms', async () => {
    vi.stubEnv('MODE', 'electron');
    const data = bytes(64);
    fsMock.readFile.mockResolvedValue({ data: b64(data) });

    const { readUint8Array } = await import('./commonMethods.js');
    const result = await readUint8Array({ path: 'exam/a.pdf', directory: 'Documents' });

    expect(result).toEqual(data);
    expect(fsMock.readFile).toHaveBeenCalledTimes(1);
    expect(fsMock.readFile).toHaveBeenCalledWith({ path: 'exam/a.pdf', directory: 'Documents' });
    expect(fsMock.stat).not.toHaveBeenCalled();
  });

  it('handles a Blob response on web platforms', async () => {
    vi.stubEnv('MODE', 'electron');
    const data = bytes(16);
    fsMock.readFile.mockResolvedValue({ data: new Blob([data]) });

    const { readUint8Array } = await import('./commonMethods.js');
    const result = await readUint8Array({ path: 'exam/b.pdf', directory: 'Documents' });

    expect(result).toEqual(data);
  });

  it('reads a large file in chunks on iOS and reassembles the bytes', async () => {
    vi.stubEnv('MODE', 'capacitor');
    const payload = bytes(CHUNK * 2 + 17, 7); // two full chunks plus a partial chunk
    fsMock.stat.mockResolvedValue({ size: payload.length });
    fsMock.readFile.mockImplementation(async ({ offset, length }) => ({
      data: b64(payload.slice(offset, offset + length)),
    }));

    const { readUint8Array } = await import('./commonMethods.js');
    const result = await readUint8Array({ path: 'exam/c.pdf', directory: 'Documents' });

    expect(Buffer.from(result).equals(Buffer.from(payload))).toBe(true);
    expect(fsMock.stat).toHaveBeenCalledWith({ path: 'exam/c.pdf', directory: 'Documents' });
    expect(fsMock.readFile).toHaveBeenCalledTimes(3);
    expect(fsMock.readFile.mock.calls[0][0]).toMatchObject({ path: 'exam/c.pdf', directory: 'Documents', offset: 0, length: CHUNK });
    expect(fsMock.readFile.mock.calls[1][0]).toMatchObject({ offset: CHUNK, length: CHUNK });
    expect(fsMock.readFile.mock.calls[2][0]).toMatchObject({ offset: CHUNK * 2, length: 17 });
  });

  it('reads a file not larger than the chunk size in a single chunked call on iOS', async () => {
    vi.stubEnv('MODE', 'capacitor');
    const data = bytes(1024);
    fsMock.stat.mockResolvedValue({ size: data.length });
    fsMock.readFile.mockImplementation(async ({ offset, length }) => ({
      data: b64(data.slice(offset, offset + length)),
    }));

    const { readUint8Array } = await import('./commonMethods.js');
    const result = await readUint8Array({ path: 'exam/small.pdf', directory: 'Documents' });

    expect(result).toEqual(data);
    expect(fsMock.readFile).toHaveBeenCalledTimes(1);
    expect(fsMock.readFile.mock.calls[0][0]).toMatchObject({ offset: 0, length: 1024 });
  });

  it('falls back to a single read when stat provides no usable size', async () => {
    vi.stubEnv('MODE', 'capacitor');
    const data = bytes(64);
    fsMock.stat.mockResolvedValue({ size: undefined });
    fsMock.readFile.mockResolvedValue({ data: b64(data) });

    const { readUint8Array } = await import('./commonMethods.js');
    const result = await readUint8Array({ path: 'exam/d.pdf', directory: 'Documents' });

    expect(result).toEqual(data);
    expect(fsMock.readFile).toHaveBeenCalledTimes(1);
    expect(fsMock.readFile.mock.calls[0][0]).toEqual({ path: 'exam/d.pdf', directory: 'Documents' });
  });

  it('propagates the read error when stat fails and the file does not exist', async () => {
    vi.stubEnv('MODE', 'capacitor');
    const missing = new Error('File does not exist');
    fsMock.stat.mockRejectedValue(missing);
    fsMock.readFile.mockRejectedValue(missing);

    const { readUint8Array } = await import('./commonMethods.js');
    await expect(readUint8Array({ path: 'exam/missing.pdf', directory: 'Documents' })).rejects.toThrow('File does not exist');
    expect(fsMock.readFile).toHaveBeenCalledTimes(1);
  });
});
