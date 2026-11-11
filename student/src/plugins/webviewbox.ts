import { registerPlugin } from '@capacitor/core';
import {executeJavaScript} from "../utils/websiteExecuteJavaScript.js";

export interface WebViewBoxPlugin {
    open(options: {
        url: string;
        x: number;
        y: number;
        width: number;
        height: number;
        blockSubdomains: boolean;
        blockSubfolders: boolean;
        executeJavaScript: string;
        mode?: 'website' | 'forms' | 'rdp';
        showdevtools?: boolean;
    }): Promise<void>;
    close(): Promise<void>;
    show(): Promise<void>;
    hide(): Promise<void>;
    resize(
        x: number,
        y: number,
        width: number,
        height: number
    ): Promise<void>;
    reload(
        url: string
    ): Promise<void>;
    addListener(
        eventName: 'navBlocked',
        cb: (e: { url: string }) => void
    ): Promise<{ remove: () => Promise<void> }>;
}

export const WebViewBox = registerPlugin<WebViewBoxPlugin>('WebViewBox');