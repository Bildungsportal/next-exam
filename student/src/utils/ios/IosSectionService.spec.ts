import { beforeEach, describe, expect, it, vi } from 'vitest';

const routerPush = vi.hoisted(() => vi.fn());
const infoState = vi.hoisted(() => ({
    exammode: false,
    lockedSection: 1,
    localLockdown: false,
    password: '',
    examtype: '',
    token: 'tok-123',
}));
const configState = vi.hoisted(() => ({ examdirectory: '' }));

vi.mock('../../router/index.js', () => ({ router: { push: routerPush } }));
vi.mock('../../stores/infoStore.js', () => ({ useInfoStore: () => infoState }));
vi.mock('../../stores/configStore.js', () => ({ useConfigStore: () => configState }));
vi.mock('../loggingBridge.js', () => ({ default: { debug: vi.fn(), log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import sectionService from './IosSectionService.js';

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

describe('IosSectionService', () => {
    beforeEach(() => {
        routerPush.mockReset();
        infoState.exammode = false;
        infoState.lockedSection = 1;
        infoState.localLockdown = false;
        infoState.password = '';
        infoState.examtype = '';
        configState.examdirectory = '';
        sectionService.currentExamType = '';
        sectionService.lastServerStatus = null;
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
});
