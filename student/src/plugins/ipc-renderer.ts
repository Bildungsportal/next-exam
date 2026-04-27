import { IPC } from './index';
import type { PluginListenerHandle } from '@capacitor/core';
import loggingBridge from "../utils/loggingBridge.js";

type Callback = (payload: unknown) => void;

class IpcRenderer {
    private handles = new Map<string, PluginListenerHandle[]>();

    /** Web → Native */
    async send(channel: string, payload?: unknown): Promise<void> {
        await IPC.send({ channel, payload });
    }

    /** Native → Web (persistent) */
    on(channel: string, callback: Callback): () => void {
        const handle = IPC.addListener(channel, ({ payload }) => callback(payload));

        if (!this.handles.has(channel)) this.handles.set(channel, []);
        this.handles.get(channel)!.push(handle as unknown as PluginListenerHandle);

        return () => (handle as unknown as PluginListenerHandle).remove();
    }

    /** Web → Native */
    async invoke(channel: string, ...data: unknown[]): Promise<unknown> {
        let promise = IPC.invoke({ channel, payload: data });
        const result = await promise;
        if ('result' in result) {
            loggingBridge.info(`IpcRenderer ${channel} invoked: `, result);
            return result.result;
        } else if ('error' in result) {
            loggingBridge.error(`IpcRenderer ${channel} failed to invoke result:`, result.error);
            return undefined;
        } else {
            loggingBridge.warn(`IpcRenderer ${channel} unkown result:`, result);
            return undefined;
        }
    }

    /** Native → Web (one-time) */
    once(channel: string, callback: Callback): void {
        const unsub = this.on(channel, payload => {
            callback(payload);
            unsub();
        });
    }

    removeAllListeners(channel?: string): void {
        if (channel) {
            this.handles.get(channel)?.forEach(h => h.remove());
            this.handles.delete(channel);
        } else {
            this.handles.forEach(handles => handles.forEach(h => h.remove()));
            this.handles.clear();
        }
    }
}

export const ipcRenderer = new IpcRenderer();