import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

// recursively remove every file named `name` under `dir` (mac nests it in the framework, linux/win at root)
async function removeByName(dir, name) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await removeByName(full, name);
    } else if (entry.name === name) {
      await fs.rm(full, { force: true });
      console.log(`Removed ${full}`);
    }
  }
}

// replace LC_UUID of thin Mach-O with stable per-app value (macOS local network privacy keys on it; stock Electron UUID is shared by all Electron apps)
async function setMachOUuid(file, seed) {
  const buf = await fs.readFile(file);
  if (buf.readUInt32LE(0) !== 0xfeedfacf) throw new Error(`not a thin 64-bit Mach-O: ${file}`);
  let off = 32;
  for (let i = 0; i < buf.readUInt32LE(16); i++) {
    if (buf.readUInt32LE(off) === 0x1b) {
      crypto.createHash('md5').update(seed).digest().copy(buf, off + 8);
      await fs.writeFile(file, buf);
      console.log(`Set LC_UUID of ${file} from ${seed}`);
      return;
    }
    off += buf.readUInt32LE(off + 4);
  }
  throw new Error(`LC_UUID not found: ${file}`);
}

export default async function afterPack(context) {
  console.log('afterPack');
  // drop Chromium license attribution file (~18MB); not loaded at runtime
  await removeByName(context.appOutDir, 'LICENSES.chromium.html');
  if (context.electronPlatformName === 'darwin') {
    const appName = context.packager.appInfo.productFilename;
    await setMachOUuid(path.join(context.appOutDir, `${appName}.app`, 'Contents', 'MacOS', appName), context.packager.appInfo.id);
  }
}
