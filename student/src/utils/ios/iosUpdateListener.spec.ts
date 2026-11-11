import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SECTION_SWITCH_SAVE_TIMEOUT_MS } from '../switchExamSection.js';

// Matches the private const in iosUpdateListener.ts.
const SECTION_SWITCH_WAIT_TIMEOUT_MS = 15000;

const infoState = vi.hoisted(() => ({
    exammode: false,
    lastExamWriteSaveReason: 'n/a',
    switchingToSection: null,
    updateInfo: vi.fn(async () => true),
}));
const switchState = vi.hoisted(() => ({
    // Mirrors the module-level _running flag of switchExamSection.ts.
    running: false,
}));
const logging = vi.hoisted(() => ({
    debug: vi.fn(),
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
}));
const sendExamToTeacher = vi.hoisted(() => vi.fn(async () => {}));
const sectionServiceMock = vi.hoisted(() => ({
    currentExamType: 'editor',
    startExam: vi.fn(),
    endExam: vi.fn(),
    handleUpdateReceived: vi.fn(),
    performSectionSwitch: vi.fn(),
}));

vi.mock('../../stores/infoStore.js', () => ({ useInfoStore: () => infoState }));
vi.mock('../../types/platform.js', () => ({ isIOS: () => true }));
vi.mock('../loggingBridge.js', () => ({ default: logging }));
vi.mock('../switchExamSection.ts', () => ({
    SECTION_SWITCH_SAVE_TIMEOUT_MS: 10000,
    isSectionSwitchRunning: () => switchState.running,
}));
vi.mock('./IosSectionService.js', () => ({ default: sectionServiceMock }));
vi.mock('./IosExamFileService.js', () => ({ default: { requestFilesFromServer: vi.fn() } }));
vi.mock('./IosPdfService.js', () => ({ default: {} }));
vi.mock('./IosSubmissionService.js', () => ({ default: { sendExamToTeacher } }));
vi.mock('./IosSubmissionSigningService.js', () => ({ default: {} }));

import iosUpdateListener from './iosUpdateListener.js';

// Filters window.dispatchEvent calls down to the local 'save' ipc-message the
// listener dispatches when it wants the open exam page to flush its save.
const saveEventCalls = (spy: any) =>
    spy.mock.calls.filter(([e]: any[]) => (e as CustomEvent).detail?.channel === 'save');

describe('IosUpdateListener handleSendExam', () => {
    let dispatchSpy: any;

    beforeEach(() => {
        vi.useFakeTimers();
        infoState.exammode = false;
        infoState.lastExamWriteSaveReason = 'n/a';
        infoState.switchingToSection = null;
        switchState.running = false;
        (iosUpdateListener as any)._sendExamRunning = false;
        sectionServiceMock.currentExamType = 'editor';
        sendExamToTeacher.mockReset();
        logging.info.mockClear();
        logging.warn.mockClear();
        dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    });

    afterEach(() => {
        dispatchSpy?.mockRestore();
        vi.useRealTimers();
    });

    it('sends immediately without a save request when not in exam mode', async () => {
        await (iosUpdateListener as any).handleSendExam();

        expect(sendExamToTeacher).toHaveBeenCalledTimes(1);
        expect(saveEventCalls(dispatchSpy)).toHaveLength(0);
    });

    it('sends immediately without a save request for non-savable exam types', async () => {
        infoState.exammode = true;
        sectionServiceMock.currentExamType = 'website';

        await (iosUpdateListener as any).handleSendExam();

        expect(sendExamToTeacher).toHaveBeenCalledTimes(1);
        expect(saveEventCalls(dispatchSpy)).toHaveLength(0);
    });

    it('in exam mode dispatches a teacher-request save and uploads exactly once after the page saved', async () => {
        infoState.exammode = true;
        infoState.lastExamWriteSaveReason = 'manual';

        const promise = (iosUpdateListener as any).handleSendExam();

        // The wait below resolves immediately when no switch runs, but the save
        // dispatch happens in the continuation, so flush the microtask first.
        await Promise.resolve();
        expect(infoState.lastExamWriteSaveReason).toBe('n/a');
        expect(saveEventCalls(dispatchSpy)).toHaveLength(1);
        expect(saveEventCalls(dispatchSpy)[0][0].detail).toEqual({ channel: 'save', args: 'teacherrequest' });

        infoState.lastExamWriteSaveReason = 'teacherrequest';
        await vi.advanceTimersByTimeAsync(150);
        await promise;

        expect(sendExamToTeacher).toHaveBeenCalledTimes(1);
    });

    it('uploads exactly once after the save times out', async () => {
        infoState.exammode = true;

        const promise = (iosUpdateListener as any).handleSendExam();

        await Promise.resolve();
        expect(saveEventCalls(dispatchSpy)).toHaveLength(1);

        // The timeout is only evaluated on a poll tick (every 150 ms), so advance
        // past the constant to let the first tick beyond it resolve.
        await vi.advanceTimersByTimeAsync(SECTION_SWITCH_SAVE_TIMEOUT_MS + 300);
        await promise;

        expect(sendExamToTeacher).toHaveBeenCalledTimes(1);
        expect(logging.warn).toHaveBeenCalled();
    });

    it('resets a stale teacherrequest save reason before waiting for the save', async () => {
        infoState.exammode = true;
        infoState.lastExamWriteSaveReason = 'teacherrequest';

        const promise = (iosUpdateListener as any).handleSendExam();

        await Promise.resolve();
        expect(infoState.lastExamWriteSaveReason).toBe('n/a');
        expect(sendExamToTeacher).not.toHaveBeenCalled();
        expect(saveEventCalls(dispatchSpy)).toHaveLength(1);

        await vi.advanceTimersByTimeAsync(300);
        expect(sendExamToTeacher).not.toHaveBeenCalled();

        infoState.lastExamWriteSaveReason = 'teacherrequest';
        await vi.advanceTimersByTimeAsync(150);
        await promise;

        expect(sendExamToTeacher).toHaveBeenCalledTimes(1);
    });

    it('waits for a section switch (switchingToSection) before saving and uploading', async () => {
        infoState.exammode = true;
        infoState.switchingToSection = 2;

        const promise = (iosUpdateListener as any).handleSendExam();

        await Promise.resolve();
        expect(saveEventCalls(dispatchSpy)).toHaveLength(0);
        expect(sendExamToTeacher).not.toHaveBeenCalled();

        infoState.switchingToSection = null;
        await vi.advanceTimersByTimeAsync(150);

        expect(saveEventCalls(dispatchSpy)).toHaveLength(1);
        expect(sendExamToTeacher).not.toHaveBeenCalled();

        infoState.lastExamWriteSaveReason = 'teacherrequest';
        await vi.advanceTimersByTimeAsync(150);
        await promise;

        expect(sendExamToTeacher).toHaveBeenCalledTimes(1);
    });

    it('waits for a running file shuffle (isSectionSwitchRunning) before saving and uploading', async () => {
        infoState.exammode = true;
        switchState.running = true;

        const promise = (iosUpdateListener as any).handleSendExam();

        await Promise.resolve();
        expect(saveEventCalls(dispatchSpy)).toHaveLength(0);
        expect(sendExamToTeacher).not.toHaveBeenCalled();

        switchState.running = false;
        await vi.advanceTimersByTimeAsync(150);

        expect(saveEventCalls(dispatchSpy)).toHaveLength(1);
        expect(sendExamToTeacher).not.toHaveBeenCalled();

        infoState.lastExamWriteSaveReason = 'teacherrequest';
        await vi.advanceTimersByTimeAsync(150);
        await promise;

        expect(sendExamToTeacher).toHaveBeenCalledTimes(1);
    });

    it('continues after 15 s when a section switch never ends and uploads exactly once, with a warning', async () => {
        infoState.exammode = true;
        infoState.switchingToSection = 3;

        const promise = (iosUpdateListener as any).handleSendExam();

        await vi.advanceTimersByTimeAsync(SECTION_SWITCH_WAIT_TIMEOUT_MS + 150);

        expect(logging.warn).toHaveBeenCalled();
        expect(saveEventCalls(dispatchSpy)).toHaveLength(1);
        expect(sendExamToTeacher).not.toHaveBeenCalled();

        infoState.lastExamWriteSaveReason = 'teacherrequest';
        await vi.advanceTimersByTimeAsync(150);
        // The switch is still running, so the second check after the save also
        // runs into the same timeout before the upload happens.
        await vi.advanceTimersByTimeAsync(SECTION_SWITCH_WAIT_TIMEOUT_MS + 150);
        await promise;

        expect(sendExamToTeacher).toHaveBeenCalledTimes(1);
    });

    it('waits for a section switch that starts during the save wait before uploading', async () => {
        infoState.exammode = true;
        infoState.lastExamWriteSaveReason = 'manual';

        const promise = (iosUpdateListener as any).handleSendExam();
        await Promise.resolve();

        // The switch starts while the page is still saving.
        infoState.switchingToSection = 4;
        infoState.lastExamWriteSaveReason = 'teacherrequest';
        await vi.advanceTimersByTimeAsync(150);

        // Save resolved, but the second switch check blocks the upload.
        expect(sendExamToTeacher).not.toHaveBeenCalled();

        infoState.switchingToSection = null;
        await vi.advanceTimersByTimeAsync(150);
        await promise;

        expect(sendExamToTeacher).toHaveBeenCalledTimes(1);
    });

    it('ignores a second request while the first is still waiting, uploading only once in total', async () => {
        infoState.exammode = true;
        infoState.switchingToSection = 5;

        const first = (iosUpdateListener as any).handleSendExam();
        await Promise.resolve();
        const second = (iosUpdateListener as any).handleSendExam();
        await Promise.resolve();

        expect(logging.info).toHaveBeenCalledWith(
            'iosUpdateListener @ sendexam: request ignored, previous send still running'
        );
        expect(sendExamToTeacher).not.toHaveBeenCalled();

        infoState.switchingToSection = null;
        await vi.advanceTimersByTimeAsync(150);
        expect(saveEventCalls(dispatchSpy)).toHaveLength(1);

        infoState.lastExamWriteSaveReason = 'teacherrequest';
        await vi.advanceTimersByTimeAsync(150);
        await first;
        await second;

        expect(sendExamToTeacher).toHaveBeenCalledTimes(1);
    });

    it('processes a new request after the first completed (flag cleared)', async () => {
        infoState.exammode = true;

        const first = (iosUpdateListener as any).handleSendExam();
        await Promise.resolve();
        expect(saveEventCalls(dispatchSpy)).toHaveLength(1);

        infoState.lastExamWriteSaveReason = 'teacherrequest';
        await vi.advanceTimersByTimeAsync(150);
        await first;

        expect(sendExamToTeacher).toHaveBeenCalledTimes(1);
        expect((iosUpdateListener as any)._sendExamRunning).toBe(false);

        const second = (iosUpdateListener as any).handleSendExam();
        await Promise.resolve();
        expect(saveEventCalls(dispatchSpy)).toHaveLength(2);

        infoState.lastExamWriteSaveReason = 'teacherrequest';
        await vi.advanceTimersByTimeAsync(150);
        await second;

        expect(sendExamToTeacher).toHaveBeenCalledTimes(2);
    });

    it('clears the running flag in finally when the first request fails, so a new request is processed', async () => {
        infoState.exammode = false;
        // The upload is awaited in production code, so a rejected promise
        // exercises the finally block.
        sendExamToTeacher.mockRejectedValueOnce(new Error('upload failed'));

        await expect((iosUpdateListener as any).handleSendExam()).rejects.toThrow('upload failed');
        expect((iosUpdateListener as any)._sendExamRunning).toBe(false);

        await (iosUpdateListener as any).handleSendExam();
        expect(sendExamToTeacher).toHaveBeenCalledTimes(2);
    });

    it('ignores a second request while the first upload is still running and processes a new one after it resolves', async () => {
        infoState.exammode = true;
        let releaseUpload;
        sendExamToTeacher.mockImplementationOnce(() => new Promise((resolve) => { releaseUpload = resolve; }));

        const first = (iosUpdateListener as any).handleSendExam();
        await Promise.resolve();
        expect(saveEventCalls(dispatchSpy)).toHaveLength(1);

        infoState.lastExamWriteSaveReason = 'teacherrequest';
        await vi.advanceTimersByTimeAsync(150);

        // The first request is now uploading; a second one must be ignored.
        const second = (iosUpdateListener as any).handleSendExam();
        await Promise.resolve();

        expect(sendExamToTeacher).toHaveBeenCalledTimes(1);
        expect(logging.info).toHaveBeenCalledWith(
            'iosUpdateListener @ sendexam: request ignored, previous send still running'
        );
        expect((iosUpdateListener as any)._sendExamRunning).toBe(true);

        releaseUpload();
        await first;
        await second;

        expect(sendExamToTeacher).toHaveBeenCalledTimes(1);
        expect((iosUpdateListener as any)._sendExamRunning).toBe(false);

        // A new request is processed once the first one has finished.
        const third = (iosUpdateListener as any).handleSendExam();
        await Promise.resolve();
        expect(saveEventCalls(dispatchSpy)).toHaveLength(2);

        infoState.lastExamWriteSaveReason = 'teacherrequest';
        await vi.advanceTimersByTimeAsync(150);
        await third;

        expect(sendExamToTeacher).toHaveBeenCalledTimes(2);
    });
});

describe('IosUpdateListener switching-exam-section', () => {
    it('registers the switching-exam-section handler and forwards bare and array payloads to performSectionSwitch', async () => {
        const ipcOn = vi.fn();
        (window as any).ipcRenderer = { on: ipcOn };

        await iosUpdateListener.init();

        const registered = ipcOn.mock.calls.find(([channel]: [string]) => channel === 'switching-exam-section');
        expect(registered).toBeDefined();
        const handler = registered[1];

        handler(2);
        expect(sectionServiceMock.performSectionSwitch).toHaveBeenCalledWith(2);

        handler([3]);
        expect(sectionServiceMock.performSectionSwitch).toHaveBeenCalledWith(3);
    });
});
