import { shallowMount } from '@vue/test-utils';
import { ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ipcRenderer = {
    invoke: vi.fn(),
    on: vi.fn(),
};
vi.mock('../utils/ios/iosUpdateListener.ts', () => ({ default: {} }));
vi.mock('../utils/screenshotCapture.js', () => ({}));
vi.mock('../utils/linuxCageKiosk.js', () => ({}));
vi.mock('../utils/kioskLauncher.js', () => ({}));
vi.mock('next-exam-shared/examApiFetch.js', () => ({ examApiFetch: vi.fn() }));
vi.mock('../utils/examFetchInfoSync.js', () => ({
    applyClientinfoFromFetch: vi.fn(),
    applyServerstatusFromFetch: vi.fn(),
}));
vi.mock('../mixins/autoCleanupMixin.ts', () => ({ autoCleanupMixin: {} }));
vi.mock('../stores/configStore.ts', () => ({ useConfigStore: () => ({}) }));
vi.mock('../stores/infoStore.js', () => ({ useInfoStore: () => ({}) }));
vi.mock('pinia', () => ({
    storeToRefs: () => ({
        development: ref(false), version: ref('2.0.0.0'), serverApiPort: ref(22422), electron: ref(false),
        info: ref(''), buildDate: ref(''), hostip: ref(''), bipIntegration: ref(false), bipApiUrl: ref(''),
        bipDemo: ref(false), token: ref(false),
    }),
}));

import Student from './student.vue';

describe('student exam discovery', () => {

    beforeEach(() => {
        vi.stubGlobal('window', { ipcRenderer });
        ipcRenderer.invoke.mockImplementation(async (channel: string) => {
            if (channel === 'getinfoasync') {
                return {
                    serverlist: [{
                        id: 'exam-1',
                        servername: 'math',
                        serverip: '192.168.178.31',
                        reachable: true,
                        version: '2.0.0.0',
                        bip: false,
                    }],
                    clientinfo: { token: false, focus: true, name: '', exammode: false },
                    serverstatus: {},
                };
            }
            if (channel === 'checkhostip') return { hostip: '192.168.178.26' };
            if (channel === 'pingexamserver') return { ok: true };
        });
    });

    it('shows an exam discovered at a local student address', async () => {
        const wrapper = shallowMount({ ...Student, created: undefined, mounted: undefined }, {
            global: {
                mocks: { $t: (key: string) => key, $i18n: { locale: 'en' } },
                stubs: { teleport: true },
            },
        });

        await wrapper.vm.fetchInfo();

        expect(wrapper.vm.serverlist).toMatchObject([{ servername: 'math', serverip: '192.168.178.31' }]);
        expect(wrapper.text()).toContain('math');
    });
});
