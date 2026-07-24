// Do not import from "electron" here – renderer gets ipcRenderer via preload (contextBridge); types from env.d.ts

export interface ElectronWindow extends Window {
  ipcRenderer: NonNullable<Window['ipcRenderer']>;
}

export function isElectronWindow(window?: Window | ElectronWindow): window is ElectronWindow {
  return process.env.MODE === 'electron'
}

// isIOS does a simple user agent based detection
export function isIOS(): boolean {
  return process.env.MODE === 'capacitor'
}

// Helper to safely get Electron's require
export function getElectronRequire(): NodeJS.Require {
  if (!isElectronWindow(window)) {
    throw new Error('Not running in Electron context');
  }
  return (window as ElectronWindow).require;
}
