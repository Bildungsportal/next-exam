import type { PluginListenerHandle } from '@capacitor/core';

export interface IPCPlugin {
    /** Fire-and-forget */
    send(options: { channel: string; payload?: unknown }): Promise<void>;
    /** Request → Response */
    invoke(options: { channel: string; payload?: any[] }): Promise<{ result?: any }>;

    addListener(
        channel: string,
        listenerFunc: (data: { payload?: unknown }) => void
    ): Promise<PluginListenerHandle> & PluginListenerHandle;

    removeAllListeners(): Promise<void>;
}