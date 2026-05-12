import {IPC} from './index';
import type {PluginListenerHandle} from '@capacitor/core';
import loggingBridge from "../utils/loggingBridge.js";

type Callback = (payload: unknown) => void;

class IpcRenderer {
    private handles = new Map<string, PluginListenerHandle[]>();

    /**
     * Resolves with the response from the main process.
     *
     * Send a message to the main process via `channel` and expect a result
     * asynchronously. Arguments will be serialized with the Structured Clone
     * Algorithm, just like `window.postMessage`, so prototype chains will not be
     * included. Sending Functions, Promises, Symbols, WeakMaps, or WeakSets will throw
     * an exception.
     *
     * The main process should listen for `channel` with `ipcMain.handle()`.
     *
     * For example:
     *
     * If you need to transfer a `MessagePort` to the main process, use
     * `ipcRenderer.postMessage`.
     *
     * If you do not need a response to the message, consider using `ipcRenderer.send`.
     *
     * > [!NOTE] Sending non-standard JavaScript types such as DOM objects or special
     * Electron objects will throw an exception.
     *
     * Since the main process does not have support for DOM objects such as
     * `ImageBitmap`, `File`, `DOMMatrix` and so on, such objects cannot be sent over
     * Electron's IPC to the main process, as the main process would have no way to
     * decode them. Attempting to send such objects over IPC will result in an error.
     *
     * > [!NOTE] If the handler in the main process throws an error, the promise
     * returned by `invoke` will reject. However, the `Error` object in the renderer
     * process will not be the same as the one thrown in the main process.
     */
    async invoke(channel: string, args: any[]): Promise<any> {
        //loggingBridge.info(`IpcRenderer ${channel} invoked with: `, data);
        try {
            const result = await IPC.invoke({channel, payload: args});
            if ('result' in result) {
                //loggingBridge.info(`IpcRenderer ${channel} invoked: `, result);
                return result.result;
            } else {
                loggingBridge.warn(`IpcRenderer ${channel} unkown result:`, result);
                return undefined;
            }
        } catch (error) {
            loggingBridge.error(`IpcRenderer ${channel} failed to invoke result:`, error);
            return undefined;
        }
    }

    /**
     * Listens to `channel`, when a new message arrives `listener` would be called with
     * `listener(event, args...)`.
     *
     * :::warning Do not expose the `event` argument to the renderer for security
     * reasons! Wrap any callback that you receive from the renderer in another
     * function like this: `ipcRenderer.on('my-channel', (event, ...args) =>
     * callback(...args))`. Not wrapping the callback in such a function would expose
     * dangerous Electron APIs to the renderer process. See the security guide for more
     * info. :::
     */
    on(channel: string, callback: Callback): () => void {
        const handle = IPC.addListener(channel, ({ payload }) => callback(payload));

        if (!this.handles.has(channel)) this.handles.set(channel, []);
        this.handles.get(channel)!.push(handle as unknown as PluginListenerHandle);

        return () => (handle as unknown as PluginListenerHandle).remove();
    }

    /**
     * Removes all listeners from the specified `channel`. Removes all listeners from
     * all channels if no channel is specified.
     */
    removeAllListeners(channel?: string): this {
        IPC.removeAllListeners(channel)
    }

    /**
     * Send an asynchronous message to the main process via `channel`, along with
     * arguments. Arguments will be serialized with the Structured Clone Algorithm,
     * just like `window.postMessage`, so prototype chains will not be included.
     * Sending Functions, Promises, Symbols, WeakMaps, or WeakSets will throw an
     * exception.
     *
     * > **NOTE:** Sending non-standard JavaScript types such as DOM objects or special
     * Electron objects will throw an exception.
     *
     * Since the main process does not have support for DOM objects such as
     * `ImageBitmap`, `File`, `DOMMatrix` and so on, such objects cannot be sent over
     * Electron's IPC to the main process, as the main process would have no way to
     * decode them. Attempting to send such objects over IPC will result in an error.
     *
     * The main process handles it by listening for `channel` with the `ipcMain`
     * module.
     *
     * If you need to transfer a `MessagePort` to the main process, use
     * `ipcRenderer.postMessage`.
     *
     * If you want to receive a single response from the main process, like the result
     * of a method call, consider using `ipcRenderer.invoke`.
     */
    send(channel: string, ...args: any[]): void {
        void IPC.send({ channel, payload: args });
    }

    /**
     * The value sent back by the `ipcMain` handler.
     *
     * Send a message to the main process via `channel` and expect a result
     * synchronously. Arguments will be serialized with the Structured Clone Algorithm,
     * just like `window.postMessage`, so prototype chains will not be included.
     * Sending Functions, Promises, Symbols, WeakMaps, or WeakSets will throw an
     * exception.
     *
     * > **NOTE:** Sending non-standard JavaScript types such as DOM objects or special
     * Electron objects will throw an exception.
     *
     * Since the main process does not have support for DOM objects such as
     * `ImageBitmap`, `File`, `DOMMatrix` and so on, such objects cannot be sent over
     * Electron's IPC to the main process, as the main process would have no way to
     * decode them. Attempting to send such objects over IPC will result in an error.
     *
     * The main process handles it by listening for `channel` with `ipcMain` module,
     * and replies by setting `event.returnValue`.
     *
     * > [!WARNING] Sending a synchronous message will block the whole renderer process
     * until the reply is received, so use this method only as a last resort. It's much
     * better to use the asynchronous version, `invoke()`.
     */

    /** Goes through window.prompt() — NOT through Capacitor (sync) */
    sendSync(channel: string, ...args: any[]): any {
        // This function was injected by injectSendSyncScript()
        return (window as any).ipcRendererSendSync(channel, ...args);
    }
}

export const ipcRenderer = new IpcRenderer();