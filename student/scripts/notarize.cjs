const path = require('path');
const fs = require('fs');
// electron-builder afterSign cwd is dist/, not student/ — load .env from project root
const projectRoot = path.join(__dirname, '..');
const envPath = fs.existsSync(path.join(projectRoot, '.env'))
  ? path.join(projectRoot, '.env')
  : path.join(projectRoot, '.env.production');
require('dotenv').config({ path: envPath, override: true });
const { notarize } = require('@electron/notarize');
const { exec } = require('child_process');

function execPromise(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) reject(stderr || error);
      else resolve(stdout);
    });
  });
}

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;

  if (electronPlatformName !== 'darwin') {
    console.log('Skipping notarization for this platform');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appBundlePath = path.join(appOutDir, `${appName}.app`);
  if (!fs.existsSync(appBundlePath)) {
    throw new Error(`appBundle does not exist ${appBundlePath}`);
  }

  // JAR signing runs in afterpack.js before electron-builder signs the .app (avoids broken re-sign with profile)
  if (process.env.NOTARIZE === 'false') {
    console.log('Skipping notarization (NOTARIZE=false)');
    return;
  }

  console.log('--------------------------------');
  console.log('Notarizing Next-Exam-Student');
  console.log('--------------------------------');

  const notarizeOpts = {
    tool: 'notarytool',
    teamId: process.env.TEAMID,
    appBundleId: process.env.MAC_BUNDLE_ID || 'com.nextexam.student',
    appPath: appBundlePath,
    appleId: process.env.APPLEID,
    appleIdPassword: process.env.APPLEIDPASS,
  };
  const maxAttempts = 3;
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await notarize(notarizeOpts);
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      const msg = String(error?.message || error);
      const retryable = msg.includes('timed out') || msg.includes('-1001');
      if (!retryable || attempt === maxAttempts) break;
      console.warn(`Notarize attempt ${attempt}/${maxAttempts} timed out — retry in 60s…`);
      await new Promise((r) => setTimeout(r, 60000));
    }
  }
  if (lastError) {
    console.error('Failed to notarize:', lastError);
    throw lastError;
  }
  console.log('Notarization successful!');
  await execPromise(`xcrun stapler staple "${appBundlePath}"`);
  console.log(`Stapled notarization ticket: ${appBundlePath}`);
};
