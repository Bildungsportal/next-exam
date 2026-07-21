const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
// electron-builder afterSign cwd is dist/, not student/ — load .env from project root
const projectRoot = path.join(__dirname, '..');
const envPath = fs.existsSync(path.join(projectRoot, '.env'))
  ? path.join(projectRoot, '.env')
  : path.join(projectRoot, '.env.production');
require('dotenv').config({ path: envPath, override: true });
const { notarize } = require('@electron/notarize');
const { exec } = require('child_process');

const assessmentEntitlements = path.join(projectRoot, 'scripts', 'entitlements.mac.assessment.plist');

function execPromise(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) reject(stderr || error);
      else resolve(stdout);
    });
  });
}

// Re-sign apple/* helpers after electron-builder deep-sign (it overwrites afterpack with entitlementsInherit).
function codesignHelper(helperPath, identity, entitlementsPath, identifier) {
  return new Promise((resolve, reject) => {
    const args = [
      '--force',
      '--options', 'runtime',
      '--timestamp',
      '--entitlements', entitlementsPath,
      '-s', identity,
    ];
    if (identifier) args.push('--identifier', identifier);
    args.push(helperPath);
    const p = spawn('codesign', args, { stdio: 'inherit' });
    p.on('error', reject);
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`codesign ${path.basename(helperPath)} failed (${code})`))));
  });
}

async function resignAppleHelpers(appBundlePath) {
  const identity = (process.env.SHAID || process.env.CSC_NAME || '').trim();
  if (!identity || process.env.SIGN === 'false') return;
  const bundleId = process.env.MAC_BUNDLE_ID || 'com.nextexam.student';
  const mainEntitlements = path.join(path.dirname(assessmentEntitlements), 'entitlements.mac.plist');
  const helpers = [
    { name: 'assessment-helper.app', entitlements: assessmentEntitlements, identifier: bundleId },
  ];
  let anyReSigned = false;
  for (const { name, entitlements, identifier } of helpers) {
    const helperPath = path.join(appBundlePath, 'Contents', 'Resources', 'apple', name);
    if (!fs.existsSync(helperPath) || !fs.existsSync(entitlements)) continue;
    await codesignHelper(helperPath, identity, entitlements, identifier);
    console.log(`Re-signed ${name} (${path.basename(entitlements)})`);
    anyReSigned = true;
  }
  // Re-signing helpers invalidates sealed resources of the outer .app; re-sign the bundle to update hashes.
  if (anyReSigned) {
    await codesignHelper(appBundlePath, identity, mainEntitlements, bundleId);
    console.log(`Re-signed outer .app bundle to seal updated helper hashes`);
  }
}

exports.resignAppleHelpers = resignAppleHelpers;

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

  // Helpers must be signed after electron-builder (afterpack signing is overwritten by entitlementsInherit).
  await resignAppleHelpers(appBundlePath);

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
