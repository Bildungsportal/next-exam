import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const routerPush = vi.hoisted(() => vi.fn());
const infoState = vi.hoisted(() => ({
    exammode: false,
    lockedSection: 1,
    localLockdown: false,
    password: '',
    examtype: '',
    token: 'tok-123',
    serverstatus: null,
    switchingToSection: null,
    updateInfo: vi.fn(async () => true),
    beginSectionSwitch: vi.fn(),
    endSectionSwitchOverlay: vi.fn(),
}));
const configState = vi.hoisted(() => ({ examdirectory: '' }));
const switchExamSectionFiles = vi.hoisted(() => vi.fn());
const flushSectionSwitchBackup = vi.hoisted(() => vi.fn());
const ipcInvoke = vi.hoisted(() => vi.fn());

vi.mock('../../router/index.js', () => ({ router: { push: routerPush } }));
vi.mock('../../stores/infoStore.js', () => ({ useInfoStore: () => infoState }));
vi.mock('../../stores/configStore.js', () => ({ useConfigStore: () => configState }));
vi.mock('../loggingBridge.js', () => ({ default: { debug: vi.fn(), log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../switchExamSection.ts', () => ({ switchExamSectionFiles, flushSectionSwitchBackup }));

import sectionService, { SECTION_SWITCH_COMMIT_TIMEOUT_MS, SECTION_SWITCH_OVERLAY_FALLBACK_MS, SECTION_SWITCH_RECONCILE_DELAY_MS } from './IosSectionService.js';

const serverstatus = (overrides = {}) => ({
    exammode: true,
    allowSectionSwitch: false,
    lockedSection: 2,
    localLockdown: false,
    password: '',
    examSections: {
        1: { examtype: 'editor', sectionname: 'Section 1' },
        2: { examtype: 'forms', sectionname: 'Section 2' },
    },
    ...overrides,
});

// Filters window.dispatchEvent calls down to the 'section-switch-aborted' ipc-message the pipeline dispatches on failure.
const sectionSwitchAbortedCalls = (spy: any) =>
    spy.mock.calls.filter(([e]: any[]) => (e as CustomEvent).detail?.channel === 'section-switch-aborted');

describe('IosSectionService', () => {
    beforeEach(() => {
        routerPush.mockReset();
        infoState.exammode = false;
        infoState.lockedSection = 1;
        infoState.localLockdown = false;
        infoState.password = '';
        infoState.examtype = '';
        infoState.serverstatus = null;
        infoState.switchingToSection = null;
        configState.examdirectory = '';
        sectionService.currentExamType = '';
        sectionService.lastServerStatus = null;
        switchExamSectionFiles.mockReset().mockResolvedValue(true);
        flushSectionSwitchBackup.mockReset().mockResolvedValue(true);
        ipcInvoke.mockReset().mockResolvedValue({ status: 'success' });
        (window as any).ipcRenderer = { invoke: ipcInvoke };
    });

    it('applies exam state and routes to the active section on startExam', () => {
        sectionService.startExam(serverstatus());

        expect(infoState.exammode).toBe(true);
        expect(infoState.lockedSection).toBe(2);
        expect(infoState.examtype).toBe('forms');
        expect(sectionService.currentExamType).toBe('forms');
        expect(routerPush).toHaveBeenCalledWith({ path: '/forms/tok-123/2' });
    });

    it('uses section 1 as active section when section switching is allowed', () => {
        sectionService.startExam(serverstatus({ allowSectionSwitch: true, lockedSection: 4 }));

        expect(infoState.lockedSection).toBe(1);
        expect(routerPush).toHaveBeenCalledWith({ path: '/editor/tok-123/1' });
    });

    it('uses the local lockdown password and its own exam folder', () => {
        sectionService.startExam(serverstatus({ localLockdown: true, password: 'pw' }));

        expect(infoState.localLockdown).toBe(true);
        expect(infoState.password).toBe('pw');
        expect(configState.examdirectory).toBe('local-exam');
    });

    it('uses the native exam directory reported by startExam for normal exams', () => {
        sectionService.startExam(serverstatus({ examdirectory: '192.168.1.10-1234' }));

        expect(configState.examdirectory).toBe('192.168.1.10-1234');
    });

    it('prefers the native exam directory over the local lockdown fallback', () => {
        sectionService.startExam(serverstatus({ localLockdown: true, examdirectory: 'local-exam' }));

        expect(configState.examdirectory).toBe('local-exam');
    });

    it('does not reroute when exam type and section are unchanged', () => {
        sectionService.startExam(serverstatus());
        routerPush.mockReset();

        sectionService.handleUpdateReceived(2, false);

        expect(routerPush).not.toHaveBeenCalled();
        expect(infoState.lockedSection).toBe(2);
    });

    it('adds restore=1 query when a section switch requests a backup restore', () => {
        sectionService.startExam(serverstatus());
        routerPush.mockReset();

        sectionService.handleUpdateReceived(1, true);

        expect(routerPush).toHaveBeenCalledWith({ path: '/editor/tok-123/1', query: { restore: '1' } });
        expect(infoState.lockedSection).toBe(1);
    });

    it('endExam clears the exam session and navigates home', () => {
        sectionService.startExam(serverstatus());
        routerPush.mockReset();

        sectionService.endExam();

        expect(routerPush).toHaveBeenCalledWith('/student');
        expect(infoState.exammode).toBe(false);
        expect(infoState.examtype).toBe('');
        expect(sectionService.currentExamType).toBe('');
        expect(sectionService.lastServerStatus).toBeNull();
        expect(configState.examdirectory).toBe('');
    });

    it('reroutes a same-examtype switch when fromSection differs even if lockedSection already equals the target (poll race)', () => {
        sectionService.startExam(serverstatus({ lockedSection: 1, examSections: { 1: { examtype: 'editor', sectionname: 'Section 1' }, 2: { examtype: 'editor', sectionname: 'Section 2' } } }));
        routerPush.mockReset();
        // Simulate the 5s updateInfo poll having already set lockedSection to the target.
        infoState.lockedSection = 2;

        sectionService.handleUpdateReceived(2, true, 1);

        expect(routerPush).toHaveBeenCalledWith({ path: '/editor/tok-123/2', query: { restore: '1' } });
        expect(infoState.lockedSection).toBe(2);
    });

    it('skips the reroute for a same-examtype switch when lockedSection already equals the target and no fromSection is given', () => {
        sectionService.startExam(serverstatus({ examSections: { 1: { examtype: 'editor', sectionname: 'Section 1' }, 2: { examtype: 'editor', sectionname: 'Section 2' } } }));
        routerPush.mockReset();
        infoState.lockedSection = 2;

        sectionService.handleUpdateReceived(2, true);

        expect(routerPush).not.toHaveBeenCalled();
        expect(infoState.lockedSection).toBe(2);
    });

    it('does not reroute when fromSection equals the target section', () => {
        sectionService.startExam(serverstatus({ examSections: { 1: { examtype: 'editor', sectionname: 'Section 1' }, 2: { examtype: 'editor', sectionname: 'Section 2' } } }));
        routerPush.mockReset();

        sectionService.handleUpdateReceived(1, true, 1);

        expect(routerPush).not.toHaveBeenCalled();
        expect(infoState.lockedSection).toBe(1);
    });

    it('handleUpdateReceived clears a stuck section-switch overlay when rerouting', () => {
        sectionService.startExam(serverstatus({ lockedSection: 1, examSections: { 1: { examtype: 'editor', sectionname: 'Section 1' }, 2: { examtype: 'editor', sectionname: 'Section 2' } } }));
        routerPush.mockReset();
        infoState.switchingToSection = 2;
        infoState.endSectionSwitchOverlay.mockClear();

        sectionService.handleUpdateReceived(2, true, 1);

        expect(infoState.endSectionSwitchOverlay).toHaveBeenCalled();
        expect(routerPush).toHaveBeenCalledWith({ path: '/editor/tok-123/2', query: { restore: '1' } });
    });

    describe('performSectionSwitch', () => {
        let dispatchSpy: any;
        let handleSpy: any;

        afterEach(() => {
            dispatchSpy?.mockRestore();
            handleSpy?.mockRestore();
        });

        it('refreshes server status, shuffles files, commits the section and reroutes with restore', async () => {
            sectionService.startExam(serverstatus({ allowSectionSwitch: true, examdirectory: 'exam' }));
            handleSpy = vi.spyOn(sectionService, 'handleUpdateReceived');

            await sectionService.performSectionSwitch(2);

            expect(infoState.updateInfo).toHaveBeenCalled();
            expect(infoState.beginSectionSwitch).toHaveBeenCalledWith(2);
            expect(switchExamSectionFiles).toHaveBeenCalledWith('exam', 1, 2, expect.any(Function));
            // The pre-save callback flushes the backup for the section we are leaving.
            const preSave = switchExamSectionFiles.mock.calls[0][3] as () => Promise<boolean>;
            await preSave();
            expect(flushSectionSwitchBackup).toHaveBeenCalledWith('editor');
            expect(ipcInvoke).toHaveBeenCalledWith('commit-exam-section', 2);
            expect(handleSpy).toHaveBeenCalledWith(2, true, 1);
            expect((sectionService as any)._switchRunning).toBe(false);
        });

        it('ignores a second performSectionSwitch while a switch is still in flight', async () => {
            sectionService.startExam(serverstatus({ allowSectionSwitch: true, examdirectory: 'exam' }));
            let release!: (ok: boolean) => void;
            switchExamSectionFiles.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
            handleSpy = vi.spyOn(sectionService, 'handleUpdateReceived');

            const first = sectionService.performSectionSwitch(2);
            // Let the pipeline reach the pending file switch (updateInfo + continuation).
            await Promise.resolve();
            await Promise.resolve();
            expect(switchExamSectionFiles).toHaveBeenCalledTimes(1);

            await sectionService.performSectionSwitch(2);

            expect(switchExamSectionFiles).toHaveBeenCalledTimes(1);
            expect(ipcInvoke).not.toHaveBeenCalled();

            release(true);
            await first;

            expect(handleSpy).toHaveBeenCalledTimes(1);
            expect(handleSpy).toHaveBeenCalledWith(2, true, 1);
            expect((sectionService as any)._switchRunning).toBe(false);
        });

        it('skips the switch when the target is already the active locked section', async () => {
            sectionService.startExam(serverstatus()); // lockedSection: 2

            await sectionService.performSectionSwitch(2);

            expect(switchExamSectionFiles).not.toHaveBeenCalled();
            expect(ipcInvoke).not.toHaveBeenCalled();
        });

        it('skips the switch when the target section is not in examSections', async () => {
            sectionService.startExam(serverstatus({ allowSectionSwitch: true, examdirectory: 'exam' }));

            await sectionService.performSectionSwitch(9);

            expect(switchExamSectionFiles).not.toHaveBeenCalled();
            expect(ipcInvoke).not.toHaveBeenCalled();
        });

        it('dispatches section-switch-aborted and does not commit or reroute when the file switch fails', async () => {
            sectionService.startExam(serverstatus({ allowSectionSwitch: true, examdirectory: 'exam' }));
            switchExamSectionFiles.mockResolvedValueOnce(false);
            dispatchSpy = vi.spyOn(window, 'dispatchEvent');
            handleSpy = vi.spyOn(sectionService, 'handleUpdateReceived');

            await sectionService.performSectionSwitch(2);

            expect(sectionSwitchAbortedCalls(dispatchSpy)).toHaveLength(1);
            expect(sectionSwitchAbortedCalls(dispatchSpy)[0][0].detail).toEqual({ channel: 'section-switch-aborted', args: [] });
            expect(ipcInvoke).not.toHaveBeenCalled();
            expect(handleSpy).not.toHaveBeenCalled();
            expect((sectionService as any)._switchRunning).toBe(false);
        });

        it('dispatches section-switch-aborted and leaves lockedSection untouched when the commit fails', async () => {
            sectionService.startExam(serverstatus({ allowSectionSwitch: true, examdirectory: 'exam' }));
            ipcInvoke.mockResolvedValue({ status: 'error' });
            dispatchSpy = vi.spyOn(window, 'dispatchEvent');
            handleSpy = vi.spyOn(sectionService, 'handleUpdateReceived');

            await sectionService.performSectionSwitch(2);

            expect(sectionSwitchAbortedCalls(dispatchSpy)).toHaveLength(1);
            expect(handleSpy).not.toHaveBeenCalled();
            expect(infoState.lockedSection).toBe(1);
            expect((sectionService as any)._switchRunning).toBe(false);
        });

        it('aborts with section-switch-aborted when the commit invoke never resolves (timeout)', async () => {
            vi.useFakeTimers();
            try {
                sectionService.startExam(serverstatus({ allowSectionSwitch: true, examdirectory: 'exam' }));
                ipcInvoke.mockReturnValue(new Promise(() => {}));
                dispatchSpy = vi.spyOn(window, 'dispatchEvent');
                handleSpy = vi.spyOn(sectionService, 'handleUpdateReceived');

                const pending = sectionService.performSectionSwitch(2);
                await vi.advanceTimersByTimeAsync(SECTION_SWITCH_COMMIT_TIMEOUT_MS);
                await pending;

                expect(sectionSwitchAbortedCalls(dispatchSpy)).toHaveLength(1);
                expect(handleSpy).not.toHaveBeenCalled();
                expect((sectionService as any)._switchRunning).toBe(false);
            } finally {
                vi.useRealTimers();
            }
        });

        it('clears the overlay via the fallback watchdog when the pipeline stalls', async () => {
            vi.useFakeTimers();
            try {
                sectionService.startExam(serverstatus({ allowSectionSwitch: true, examdirectory: 'exam' }));
                infoState.beginSectionSwitch.mockImplementation((n: number) => { infoState.switchingToSection = n; });
                infoState.endSectionSwitchOverlay.mockImplementation(() => { infoState.switchingToSection = null; });
                let release!: (ok: boolean) => void;
                switchExamSectionFiles.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
                handleSpy = vi.spyOn(sectionService, 'handleUpdateReceived');

                const pending = sectionService.performSectionSwitch(2);
                await Promise.resolve();
                await Promise.resolve();
                expect(infoState.switchingToSection).toBe(2);

                await vi.advanceTimersByTimeAsync(SECTION_SWITCH_OVERLAY_FALLBACK_MS);
                expect(infoState.endSectionSwitchOverlay).toHaveBeenCalled();
                expect(infoState.switchingToSection).toBeNull();

                release(true);
                await pending;
                expect(handleSpy).toHaveBeenCalledWith(2, true, 1);
                expect((sectionService as any)._switchRunning).toBe(false);
            } finally {
                vi.useRealTimers();
                infoState.beginSectionSwitch.mockReset();
                infoState.endSectionSwitchOverlay.mockReset();
            }
        });

        it('dispatches section-switch-aborted and resets the switch guard when the pipeline throws', async () => {
            sectionService.startExam(serverstatus({ allowSectionSwitch: true, examdirectory: 'exam' }));
            switchExamSectionFiles.mockRejectedValueOnce(new Error('boom'));
            dispatchSpy = vi.spyOn(window, 'dispatchEvent');
            handleSpy = vi.spyOn(sectionService, 'handleUpdateReceived');

            await sectionService.performSectionSwitch(2);

            expect(sectionSwitchAbortedCalls(dispatchSpy)).toHaveLength(1);
            expect(handleSpy).not.toHaveBeenCalled();
            expect(ipcInvoke).not.toHaveBeenCalled();
            expect((sectionService as any)._switchRunning).toBe(false);
        });

        it('endExam clears a stuck section-switch overlay and resets the switch guard', () => {
            sectionService.startExam(serverstatus());
            (sectionService as any)._switchRunning = true;

            sectionService.endExam();

            expect(infoState.endSectionSwitchOverlay).toHaveBeenCalled();
            expect((sectionService as any)._switchRunning).toBe(false);
        });

        it('reconciles a late-applied commit by rerouting when the poll shows the target', async () => {
            vi.useFakeTimers();
            try {
                sectionService.startExam(serverstatus({ allowSectionSwitch: true, examdirectory: 'exam' }));
                ipcInvoke.mockReturnValue(new Promise(() => {}));
                handleSpy = vi.spyOn(sectionService, 'handleUpdateReceived');

                const pending = sectionService.performSectionSwitch(2);
                await vi.advanceTimersByTimeAsync(SECTION_SWITCH_COMMIT_TIMEOUT_MS);
                await pending;
                expect(handleSpy).not.toHaveBeenCalled();

                // The native commit applied late: the next poll reports the target section.
                infoState.lockedSection = 2;
                await vi.advanceTimersByTimeAsync(SECTION_SWITCH_RECONCILE_DELAY_MS);
                await Promise.resolve();
                await Promise.resolve();

                expect(handleSpy).toHaveBeenCalledWith(2, true, 1);
            } finally {
                vi.useRealTimers();
            }
        });

        it('clears the overlay and all timers on a successful switch', async () => {
            vi.useFakeTimers();
            try {
                sectionService.startExam(serverstatus({ allowSectionSwitch: true, examdirectory: 'exam' }));
                infoState.beginSectionSwitch.mockImplementation((n: number) => { infoState.switchingToSection = n; });
                infoState.endSectionSwitchOverlay.mockClear();

                await sectionService.performSectionSwitch(2);

                expect(infoState.endSectionSwitchOverlay).toHaveBeenCalled();
                expect(vi.getTimerCount()).toBe(0);
            } finally {
                vi.useRealTimers();
                infoState.beginSectionSwitch.mockReset();
            }
        });

        it('clears all timers when the switch is skipped (unknown target section)', async () => {
            vi.useFakeTimers();
            try {
                sectionService.startExam(serverstatus({ allowSectionSwitch: true, examdirectory: 'exam' }));

                await sectionService.performSectionSwitch(9);

                expect(vi.getTimerCount()).toBe(0);
            } finally {
                vi.useRealTimers();
            }
        });

        it('dispatches section-switch-aborted and does not reroute when the commit response is mangled (undefined)', async () => {
            vi.useFakeTimers();
            try {
                sectionService.startExam(serverstatus({ allowSectionSwitch: true, examdirectory: 'exam' }));
                ipcInvoke.mockResolvedValue(undefined);
                dispatchSpy = vi.spyOn(window, 'dispatchEvent');
                handleSpy = vi.spyOn(sectionService, 'handleUpdateReceived');

                await sectionService.performSectionSwitch(2);

                expect(sectionSwitchAbortedCalls(dispatchSpy)).toHaveLength(1);
                expect(handleSpy).not.toHaveBeenCalled();

                // Reconcile must fire for the undefined case too: the native commit may have applied
                // even though the response was mangled (the invoke shim returns undefined on throw).
                infoState.lockedSection = 2;
                await vi.advanceTimersByTimeAsync(SECTION_SWITCH_RECONCILE_DELAY_MS);
                await Promise.resolve();
                await Promise.resolve();

                expect(handleSpy).toHaveBeenCalledWith(2, true, 1);
            } finally {
                vi.useRealTimers();
            }
        });

        it('does not reroute into a new exam session from a stale in-flight switch', async () => {
            sectionService.startExam(serverstatus({ allowSectionSwitch: true, examdirectory: 'exam' }));
            let release!: (ok: boolean) => void;
            switchExamSectionFiles.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
            handleSpy = vi.spyOn(sectionService, 'handleUpdateReceived');

            const pending = sectionService.performSectionSwitch(2);
            // Let the pipeline reach the pending file switch (updateInfo + continuation).
            await Promise.resolve();
            await Promise.resolve();

            sectionService.endExam();
            sectionService.startExam(serverstatus({ allowSectionSwitch: true, examdirectory: 'exam' }));
            // The spy is attached, so startExam's own no-arg handleUpdateReceived call is recorded
            // (with the default args, i.e. not (2, true, 1)).

            release(true);
            await pending;

            expect(handleSpy).not.toHaveBeenCalledWith(2, true, 1);
            expect((sectionService as any)._switchRunning).toBe(false);
        });

        it('does not reroute via a stale reconcile timer after the exam restarted', async () => {
            vi.useFakeTimers();
            try {
                sectionService.startExam(serverstatus({ allowSectionSwitch: true, examdirectory: 'exam' }));
                ipcInvoke.mockReturnValue(new Promise(() => {}));
                handleSpy = vi.spyOn(sectionService, 'handleUpdateReceived');

                const pending = sectionService.performSectionSwitch(2);
                await vi.advanceTimersByTimeAsync(SECTION_SWITCH_COMMIT_TIMEOUT_MS);
                await pending;
                // Reconcile is now scheduled with the old exam generation.

                sectionService.endExam();
                sectionService.startExam(serverstatus({ allowSectionSwitch: true, examdirectory: 'exam' }));

                infoState.lockedSection = 2;
                await vi.advanceTimersByTimeAsync(SECTION_SWITCH_RECONCILE_DELAY_MS);
                await Promise.resolve();
                await Promise.resolve();

                expect(handleSpy).not.toHaveBeenCalledWith(2, true, 1);
            } finally {
                vi.useRealTimers();
            }
        });

        it('dispatches section-switch-aborted when the switch is skipped so the overlay does not stay up', async () => {
            sectionService.startExam(serverstatus({ allowSectionSwitch: true, examdirectory: 'exam' }));
            dispatchSpy = vi.spyOn(window, 'dispatchEvent');

            await sectionService.performSectionSwitch(9);

            expect(sectionSwitchAbortedCalls(dispatchSpy)).toHaveLength(1);
        });
    });
});
