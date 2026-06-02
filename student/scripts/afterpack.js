import path from 'path';
import fs from 'fs-extra';
import { spawn } from 'child_process';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { signLanguageToolJars } = require('./sign-languagetool-jars.cjs');

const scriptsDir = __dirname;
const assessmentEntitlements = path.join(scriptsDir, 'entitlements.mac.assessment.plist');
const wifiEntitlements = path.join(scriptsDir, 'entitlements.mac.wifi.plist');

// assessment-helper.app = .app bundle (own embedded profile authorizes restricted AAC entitlement);
// wifi-helper = plain CLI. codesign each at its bundle/binary path with its own entitlements.
const helperEntitlements = {
  'assessment-helper.app': assessmentEntitlements,
  'wifi-helper': wifiEntitlements,
};

// Codesign a bundled apple/* helper with helper-specific entitlements (not Electron plist).
function codesignHelper(helperPath, identity, entitlementsPath) {
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

// recursively remove every entry (file or dir) named `name` under `dir`
async function removeByName(dir, name) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.name === name) {
      await fs.remove(full);
      console.log(`Removed ${full}`);
    } else if (entry.isDirectory()) {
      await removeByName(full, name);
    }
  }
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

  await removeByName(appPath, 'LICENSES.chromium.html');
  await removeByName(appPath, 'canvas-linux-x64-musl');

  if (context.electronPlatformName === 'darwin') {
    const appName = context.packager.appInfo.productFilename;
    const identity = (process.env.SHAID || process.env.CSC_NAME || '').trim();
    const signEnabled = process.env.SIGN !== 'false';
    const bundlePath = path.join(appPath, `${appName}.app`);

    // NOTE: no embedded.provisionprofile on the main .app — it holds no restricted entitlement.
    // The AAC profile lives inside assessment-helper.app (built by scripts/apple/build.sh).

    if (signEnabled && identity) {
      await signLanguageToolJars(appPath, appName, identity);
    }

    for (const [name, entitlementsPath] of Object.entries(helperEntitlements)) {
      const helperPath = path.join(bundlePath, 'Contents', 'Resources', 'apple', name);
      if (await fs.pathExists(helperPath) && signEnabled && identity) {
        await codesignHelper(helperPath, identity, entitlementsPath);
        console.log(`Signed ${name} with ${path.basename(entitlementsPath)}`);
      }
    }
  }
}
