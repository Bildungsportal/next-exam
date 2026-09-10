import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

export default async function beforePack(context) {
  const __filename = fileURLToPath(import.meta.url);
  const projectRoot = path.resolve(path.dirname(__filename), '..');
  const protectScript = path.join(projectRoot, 'scripts', 'protect-main.mjs');
  const appDir = path.join(projectRoot, 'dist', 'electron', 'UnPackaged');

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

