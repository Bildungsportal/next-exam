import { registerPlugin } from '@capacitor/core';
import type { IPCPlugin } from './definitions';

export const IPC = registerPlugin<IPCPlugin>('IPC', {
    web: () => import('./web').then(m => new m.IPCWeb()),
});

export * from './definitions';