// Do not import from "electron" here – renderer gets ipcRenderer via preload (contextBridge); types from env.d.ts
export interface ElectronWindow extends Window {
  ipcRenderer: NonNullable<Window['ipcRenderer']>
}

export function isElectronWindow(window: Window | ElectronWindow): window is ElectronWindow {
  return 'ipcRenderer' in window && !!window.ipcRenderer;
}
