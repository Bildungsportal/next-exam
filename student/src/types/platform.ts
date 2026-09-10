// Do not import from "electron" here – renderer gets ipcRenderer via preload (contextBridge); types from env.d.ts

export function isElectronWindow(): boolean {
  return process.env.MODE === 'electron'
}

// isIOS does a simple user agent based detection
export function isIOS(): boolean {
  return process.env.MODE === 'capacitor'
}
