import path from 'path';
import fs from 'fs-extra';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { signLanguageToolJars } = require('./sign-languagetool-jars.cjs');

const scriptsDir = __dirname;
const assessmentEntitlements = path.join(scriptsDir, 'entitlements.mac.assessment.plist');
const provisionProfile = path.join(scriptsDir, 'apple', 'nextexamstudent.provisionprofile');

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
  const macArch =
    process.env.NXE_EB_MAC_ARCH === 'x64' || context.arch === 1 || context.arch === 'x64'
      ? 'x64'
      : 'arm64';
  const appPath = context.appOutDir;

  const x64JrePath = path.join(appPath, 'public', 'minimal-jre-11-mac-arm64');
  const arm64JrePath = path.join(appPath, 'public', 'minimal-jre-11-mac');

  if (macArch === 'x64') {
    if (await fs.pathExists(x64JrePath)) {
      await fs.remove(x64JrePath);
      console.log(`Removed ARM64 JRE from x64 build: ${x64JrePath}`);
    }
  } else if (macArch === 'arm64') {
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

    if (signEnabled && identity && (await fs.pathExists(provisionProfile)) && (await fs.pathExists(assessmentEntitlements))) {
      await fs.copy(
        provisionProfile,
        path.join(bundlePath, 'Contents', 'embedded.provisionprofile'),
      );
      console.log('Copied embedded.provisionprofile (AAC capability for Developer ID sign)');
    }

    if (signEnabled && identity) {
      await signLanguageToolJars(appPath, appName, identity, macArch);
    }
    // apple/* helpers: signed in notarize.cjs afterSign (after electron-builder; see resignAppleHelpers)
  }
}
