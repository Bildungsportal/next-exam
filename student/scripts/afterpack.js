import path from 'path';
import fs from 'fs-extra';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const entitlementsPath = path.join(__dirname, 'entitlements.mac.plist');

function codesignHelper(helperPath, identity) {
  return new Promise((resolve, reject) => {
    const args = [
      '--force',
      '--options', 'runtime',
      '--timestamp',
      '--entitlements', entitlementsPath,
      '-s', identity,
      helperPath,
    ];
    const p = spawn('codesign', args, { stdio: 'inherit' });
    p.on('error', reject);
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`codesign ${path.basename(helperPath)} failed (${code})`))));
  });
}

export default async function afterPack(context) {
  const arch = context.arch;
  const appPath = context.appOutDir;

  const x64JrePath = path.join(appPath, 'public', 'minimal-jre-11-mac-arm64');
  const arm64JrePath = path.join(appPath, 'public', 'minimal-jre-11-mac');

  if (arch === 'x64') {
    if (await fs.pathExists(x64JrePath)) {
      await fs.remove(x64JrePath);
      console.log(`Removed ARM64 JRE from x64 build: ${x64JrePath}`);
    }
  } else if (arch === 'arm64') {
    if (await fs.pathExists(arm64JrePath)) {
      await fs.remove(arm64JrePath);
      console.log(`Removed x64 JRE from ARM64 build: ${arm64JrePath}`);
    }
  }

  if (context.electronPlatformName === 'darwin') {
    const appName = context.packager.appInfo.productFilename;
    const identity = (process.env.SHAID || process.env.CSC_NAME || '').trim();
    const signEnabled = process.env.SIGN !== 'false';
    for (const name of ['assessment-helper', 'wifi-helper']) {
      const helperPath = path.join(appPath, `${appName}.app`, 'Contents', 'Resources', 'apple', name);
      if (await fs.pathExists(helperPath) && signEnabled && identity) {
        await codesignHelper(helperPath, identity);
        console.log(`Signed ${name} in app bundle: ${helperPath}`);
      }
    }
  }
}

