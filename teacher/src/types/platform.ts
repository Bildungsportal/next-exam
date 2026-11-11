import {IpcRenderer} from "electron";

// export interface Window {
//   ipcRenderer: IpcRenderer;
// }

export interface ElectronWindow extends Window {
  ipcRenderer: IpcRenderer
}

export function isElectronWindow(window: Window | ElectronWindow): window is ElectronWindow {
  return 'ipcRenderer' in window && !!window.ipcRenderer;
}

// isIOS does a simple user agent based detection
export function isIOS(): boolean {
  if (typeof navigator === 'undefined' || !navigator.userAgent) {
    return false
  }

  const ua = navigator.userAgent
  const isiOSDevice = /iPad|iPhone|iPod/.test(ua)
  const isTouchMac = ua.includes('Macintosh') && typeof document !== 'undefined' && 'ontouchend' in document

  return isiOSDevice || isTouchMac
}
