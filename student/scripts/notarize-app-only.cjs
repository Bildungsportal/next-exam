const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const dotenv = require('dotenv');

const projectRoot = path.join(__dirname, '..');
dotenv.config({
  path: fs.existsSync(path.join(projectRoot, '.env'))
    ? path.join(projectRoot, '.env')
    : path.join(projectRoot, '.env.production'),
  override: true,
});

const { notarize } = require('@electron/notarize');
const { resignAppleHelpers } = require('./notarize.cjs');

const arch = process.env.NXE_EB_MAC_ARCH === 'x64' ? 'mac' : 'mac-arm64';
const appBundlePath = path.join(
  projectRoot,
  'dist/electron/Packaged',
  arch,
  'Next-Exam-Student.app',
);

function execPromise(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) reject(stderr || error);
      else resolve(stdout);
    });
  });
}

async function main() {
  if (!fs.existsSync(appBundlePath)) {
    console.error(`App not found: ${appBundlePath}`);
    console.error('Run full build first, or set NXE_EB_MAC_ARCH=x64 for Intel output.');
    process.exit(1);
  }
  if (process.env.NOTARIZE === 'false') {
    console.error('NOTARIZE=false in .env — set NOTARIZE=true or pass env.');
    process.exit(1);
  }

  const notarizeOpts = {
    tool: 'notarytool',
    teamId: process.env.TEAMID,
    appBundleId: process.env.MAC_BUNDLE_ID || 'com.nextexam.student',
    appPath: appBundlePath,
    appleId: process.env.APPLEID,
    appleIdPassword: process.env.APPLEIDPASS,
  };

  await resignAppleHelpers(appBundlePath);

  console.log(`Notarizing: ${appBundlePath}`);
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await notarize(notarizeOpts);
      break;
    } catch (error) {
      const msg = String(error?.message || error);
      const retryable = msg.includes('timed out') || msg.includes('-1001');
      if (!retryable || attempt === maxAttempts) throw error;
      console.warn(`Timeout — retry ${attempt}/${maxAttempts} in 60s…`);
      await new Promise((r) => setTimeout(r, 60000));
    }
  }

  await execPromise(`xcrun stapler staple "${appBundlePath}"`);
  console.log('Done:', appBundlePath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
