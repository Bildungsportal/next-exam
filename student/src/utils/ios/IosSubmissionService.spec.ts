import { beforeEach, describe, expect, it, vi } from 'vitest';

const infoState = vi.hoisted(() => ({
    serverip: '192.168.1.10',
    servername: 'math',
    clientname: 'alex',
    token: 'tok-123',
    lastExamWriteSaveReason: 'teacherrequest',
}));
const configState = vi.hoisted(() => ({ examdirectory: 'exam', serverApiPort: 22422 }));
const ipcInvoke = vi.hoisted(() => vi.fn());

vi.mock('../../stores/infoStore.js', () => ({ useInfoStore: () => infoState }));
vi.mock('../../stores/configStore.js', () => ({ useConfigStore: () => configState }));
vi.mock('../loggingBridge.js', () => ({ default: { debug: vi.fn(), log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../../plugins/index.js', () => ({ IPC: { invoke: ipcInvoke } }));

import submissionService from './IosSubmissionService.js';

describe('IosSubmissionService', () => {
    beforeEach(() => {
        ipcInvoke.mockReset();
        infoState.lastExamWriteSaveReason = 'teacherrequest';
        ipcInvoke.mockResolvedValue({ result: { status: 'success', files: 1, errors: [] } });
    });

    it('delegates the exam-directory upload to the native exam-submit handler', async () => {
        await submissionService.sendToTeacher();

        expect(ipcInvoke).toHaveBeenCalledTimes(1);
        const [options] = ipcInvoke.mock.calls[0];
        expect(options.channel).toBe('exam-submit');
        const payload = options.payload[0];
        expect(payload).toMatchObject({
            examdirectory: 'exam',
            serverip: '192.168.1.10',
            servername: 'math',
            port: 22422,
            token: 'tok-123',
            lastExamWriteSaveReason: 'teacherrequest',
        });
        expect(infoState.lastExamWriteSaveReason).toBe('n/a');
    });

    it('keeps lastExamWriteSaveReason when the teacher does not confirm success', async () => {
        ipcInvoke.mockResolvedValue({ result: { status: 'error', message: 'Failed to upload 1 file(s)', files: 0, errors: ['a.pdf'] } });

        await submissionService.sendToTeacher();

        expect(infoState.lastExamWriteSaveReason).toBe('teacherrequest');
    });
});
