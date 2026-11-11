import * as win from './remotecheck/remoteWin.js'
import * as mac from './remotecheck/remoteMac.js'
import * as linux from './remotecheck/remoteLin.js'

export async function runRemoteCheck(platform = 'win32') {
  if (platform === 'win32') return await win.runRemoteCheck()
  if (platform === 'darwin') return await mac.runRemoteCheck()
  return await linux.runRemoteCheck()
}
