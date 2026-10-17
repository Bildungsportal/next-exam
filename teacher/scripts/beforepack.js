import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Azure OIDC assertions expire after ~5 min; refresh here so signing (which runs after packing)
// gets a token minted post-compile. No-op outside CI, where the ACTIONS_ID_TOKEN_* vars are absent.
async function refreshAzureFederatedToken() {
  const { ACTIONS_ID_TOKEN_REQUEST_URL, ACTIONS_ID_TOKEN_REQUEST_TOKEN, AZURE_FEDERATED_TOKEN_FILE } = process.env;
  if (!ACTIONS_ID_TOKEN_REQUEST_URL || !ACTIONS_ID_TOKEN_REQUEST_TOKEN || !AZURE_FEDERATED_TOKEN_FILE) return;

  const res = await fetch(`${ACTIONS_ID_TOKEN_REQUEST_URL}&audience=api://AzureADTokenExchange`, {
    headers: { Authorization: `Bearer ${ACTIONS_ID_TOKEN_REQUEST_TOKEN}` }
  });
  if (!res.ok) throw new Error(`OIDC token request failed: ${res.status} ${res.statusText}`);
  const { value } = await res.json();
  if (!value) throw new Error('OIDC token response contained no value');
  fs.writeFileSync(AZURE_FEDERATED_TOKEN_FILE, value);
  console.log('Refreshed Azure federated token before packing');
}

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

  await refreshAzureFederatedToken();
}

