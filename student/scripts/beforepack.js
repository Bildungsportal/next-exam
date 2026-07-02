import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

function runNodeScript(scriptPath, projectRoot) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      stdio: 'inherit',
      env: process.env,
      cwd: projectRoot,
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${path.basename(scriptPath)} failed with exit code ${code}`));
    });
  });
}

export default async function beforePack(context) {
  const __filename = fileURLToPath(import.meta.url);
  const projectRoot = path.resolve(path.dirname(__filename), '..');
  const protectScript = path.join(projectRoot, 'scripts', 'protect-main.mjs');
  const appleBuildScript = path.join(projectRoot, 'scripts', 'apple', 'build-apple.mjs');
  const appleHelpers = ['assessment-helper.app'].map((name) => path.join(projectRoot, 'scripts', 'apple', name));
  const appDir = path.join(projectRoot, 'dist', 'electron', 'UnPackaged');

  if (process.platform === 'darwin') {
    await runNodeScript(appleBuildScript, projectRoot);
  } else if (context.electronPlatformName === 'darwin' && !appleHelpers.every((p) => fs.existsSync(p))) {
    throw new Error('macOS apple helpers missing: build on macOS (npm run build:apple) before packaging for Mac');
  }

  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [protectScript, '--app-dir', appDir], {
      stdio: 'inherit',
      env: process.env
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`protect-main failed with exit code ${code}`));
    });
  });
}

