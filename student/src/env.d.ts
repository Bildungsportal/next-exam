declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: string;
    VUE_ROUTER_MODE: 'hash' | 'history' | 'abstract' | undefined;
    VUE_ROUTER_BASE: string | undefined;
  }
}

// Global declaration for ipcRenderer (exposed via contextBridge in electron-preload.ts)
declare global {
  interface Window {
    ipcRenderer?: {
      send: (channel: string, data?: any) => void;
      sendSync: (channel: string, data?: any) => any;
      invoke: (channel: string, ...args: any[]) => Promise<any>;
      on: (channel: string, func: (event: any, ...args: any[]) => void) => void;
      removeListener: (channel: string, listener: (...args: any[]) => void) => void;
      removeAllListeners: (channel: string) => void;
    };
  }
}
