import { beforeEach, describe, expect, it, vi } from 'vitest';

const infoState = vi.hoisted(() => ({
    bipUserId: '',
    pincode: '1234',
    token: 'tok-123',
    clientname: 'alex',
}));
const derive = vi.hoisted(() => vi.fn(async (secret, salt, cn, opts) => ({ secret, salt, cn, ...opts })));
const buildSecret = vi.hoisted(() => vi.fn((pin, token, time) => `secret-${pin}-${token}-${time}`));

vi.mock('../../stores/infoStore.js', () => ({ useInfoStore: () => infoState }));
vi.mock('../../../../shared/submissionPdfSign.js', () => ({
    buildLocalSubmissionSigningSecret: buildSecret,
    deriveSigningIdentity: derive,
    SUBMISSION_SIGN_MODE_BIP: 'bip',
    SUBMISSION_SIGN_MODE_LOCAL: 'local',
}));

import signingService from './IosSubmissionSigningService.js';

describe('IosSubmissionSigningService', () => {
    beforeEach(() => {
        vi.stubGlobal('crypto', { getRandomValues: (arr) => { arr.fill(0x42); return arr; } });
        signingService.bipSiteInfo = null;
        signingService.cachedSubmissionSigningIdentity = null;
        infoState.bipUserId = '';
        infoState.pincode = '1234';
        infoState.token = 'tok-123';
        infoState.clientname = 'alex';
        derive.mockReset();
        buildSecret.mockReset();
    });

    it('stores BiP signing material and the user id on setBipSiteInfo', () => {
        signingService.setBipSiteInfo({ userprivateaccesskey: 'bipKey', userid: 'uid-1', fullname: 'Alex B' });

        expect(signingService.bipSiteInfo).toEqual({ userprivateaccesskey: 'bipKey', userid: 'uid-1', fullname: 'Alex B' });
        expect(infoState.bipUserId).toBe('uid-1');
    });

    it('derives and caches a BiP signing identity', async () => {
        signingService.setBipSiteInfo({ userprivateaccesskey: 'bipKey', userid: 'uid-1', fullname: 'Alex B' });

        const identity = await signingService.ensureSubmissionSigningIdentity();

        expect(derive).toHaveBeenCalledWith('bipKey', expect.any(String), 'Alex B', { mode: 'bip', bipUserId: 'uid-1' });
        expect(identity).toBe(signingService.cachedSubmissionSigningIdentity);

        const deriveCalls = derive.mock.calls.length;
        await signingService.ensureSubmissionSigningIdentity();
        expect(derive.mock.calls.length).toBe(deriveCalls);
        expect(buildSecret).not.toHaveBeenCalled();
    });

    it('derives a local signing identity when no BiP key exists', async () => {
        const identity = await signingService.ensureSubmissionSigningIdentity();

        expect(buildSecret).toHaveBeenCalledWith('1234', 'tok-123', expect.any(Number));
        expect(derive).toHaveBeenCalledWith(expect.any(String), expect.any(String), 'alex', { mode: 'local' });
        expect(identity).toBe(signingService.cachedSubmissionSigningIdentity);
    });

    it('clearBipSiteInfo drops the signing material and cached identity', () => {
        signingService.setBipSiteInfo({ userprivateaccesskey: 'bipKey', userid: 'uid-1', fullname: 'Alex B' });
        signingService.clearBipSiteInfo();

        expect(signingService.bipSiteInfo).toBeNull();
        expect(signingService.cachedSubmissionSigningIdentity).toBeNull();
        expect(infoState.bipUserId).toBe('');
    });
});
