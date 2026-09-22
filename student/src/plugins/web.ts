import { WebPlugin } from '@capacitor/core';
import type { IPCPlugin } from './definitions';

export class IPCWeb extends WebPlugin implements IPCPlugin {
    private sendHandlers   = new Map<string, (p: unknown) => void>();
    private invokeHandlers = new Map<string, (p: unknown) => unknown>();

    async send(options: { channel: string; payload?: unknown }) {
        console.warn('[IPC Web Fallback] send:', options.channel, options.payload);
        return {};
    }

    async invoke({ channel, payload }: { channel: string; payload?: unknown[] }): Promise<{ result?: unknown }> {
        const handler = this.invokeHandlers.get(channel);
        if (!handler) {
            console.warn(`[IPC:Web] No invoke handler for "${channel}"`, payload);
            return {};
        }
        return { result: handler(payload) };
    }

    /** Register a browser-side handler (for development/testing) */
    mockSend(channel: string, handler: (payload: unknown) => void) {
        this.sendHandlers.set(channel, handler);
    }
    mockInvoke(channel: string, handler: (payload: unknown) => unknown) {
        this.invokeHandlers.set(channel, handler);
    }
}