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
