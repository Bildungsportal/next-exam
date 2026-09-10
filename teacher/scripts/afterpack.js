import fs from 'fs/promises';
import path from 'path';

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

export default async function afterPack(context) {
  console.log('afterPack');
  // drop Chromium license attribution file (~18MB); not loaded at runtime
  await removeByName(context.appOutDir, 'LICENSES.chromium.html');
}
