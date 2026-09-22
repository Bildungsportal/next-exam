import { describe, expect, it } from 'vitest';
import { mergeDiscoveredExams } from './examDiscovery.ts';

describe('mergeDiscoveredExams', () => {
    it('shows an exam discovered at the student network address', () => {
        const server = {
            id: 'exam-1',
            servername: 'math',
            serverip: '192.168.178.31',
            reachable: true,
        };

        expect(mergeDiscoveredExams([server])).toEqual([server]);
    });
});
