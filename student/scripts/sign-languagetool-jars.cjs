const path = require('path');
const fs = require('fs');
const { exec, spawn } = require('child_process');

const jarFiles = ['hunspell.jar', 'grpc-netty-shaded.jar', 'jna.jar'];
const filesToSignX64 = [
  'darwin-x86-64/libhunspell.dylib',
  'META-INF/native/libio_grpc_netty_shaded_netty_tcnative_osx_x86_64.jnilib',
  'com/sun/jna/darwin-x86-64/libjnidispatch.jnilib',
];
const filesToSignArm64 = [
  'darwin-aarch64/libhunspell.dylib',
  'META-INF/native/libio_grpc_netty_shaded_netty_tcnative_osx_aarch_64.jnilib',
  'com/sun/jna/darwin-aarch64/libjnidispatch.jnilib',
];

const KEYCHAIN_PATHS = [
  path.join(process.env.HOME, 'Library/Keychains/build.keychain-db'),
  path.join(process.env.HOME, 'Library/Keychains/build.keychain'),
];

function normalizeMacArch(arch) {
  if (arch === 'x64' || arch === 1 || arch === '1') return 'x64';
  if (arch === 'arm64' || arch === 3 || arch === '3') return 'arm64';
  return process.env.NXE_EB_MAC_ARCH === 'x64' ? 'x64' : 'arm64';
}

function filesToSignForArch(arch) {
  return normalizeMacArch(arch) === 'x64' ? filesToSignX64 : filesToSignArm64;
}

function execPromise(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) reject(stderr || error);
      else resolve(stdout);
    });
  });
}

function run(cmd, args, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit' });
    const timer = setTimeout(() => {
      p.kill('SIGTERM');
      reject(new Error(`${cmd} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    p.on('exit', (c) => {
      clearTimeout(timer);
      if (c === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(' ')} failed (${c})`));
    });
  });
}

// TSA via --timestamp can hang on GitHub Actions (same issue as assessment-helper pre-pack sign).
function codesignArgs(identity, keychain, fullPath) {
  const args = ['--force', '--options', 'runtime'];
  if (process.env.GITHUB_ACTIONS !== 'true') args.push('--timestamp');
  if (keychain) args.push('--keychain', keychain);
  args.push('--preserve-metadata=identifier,entitlements,flags', '-s', identity, fullPath);
  return args;
}

async function prepareCodesignKeychain() {
  for (const keychain of KEYCHAIN_PATHS) {
    if (!fs.existsSync(keychain)) continue;
    await execPromise(`security list-keychains -d user -s "${keychain}"`);
    await execPromise(`security default-keychain -s "${keychain}"`);
    await execPromise(`security unlock-keychain -p "" "${keychain}"`);
    await execPromise(`security set-keychain-settings -lut 21600 "${keychain}"`);
    return keychain;
  }
  return null;
}

/** Prefer keychain identity from imported CSC .p12 (same cert electron-builder uses for teacher). */
async function resolveSigningIdentity(preferred) {
  const keychain = await prepareCodesignKeychain();
  if (keychain) {
    const out = await execPromise(`security find-identity -v -p codesigning "${keychain}"`);
    const line = out.split('\n').find((l) => l.includes('Developer ID Application:'));
    const match = line?.match(/"([^"]+)"/);
    if (match) {
      console.log(`codesign identity from keychain: ${match[1]}`);
      return { identity: match[1], keychain };
    }
  }
  if (preferred) {
    console.log(`codesign identity from env: ${preferred}`);
    return { identity: preferred, keychain };
  }
  throw new Error('No Developer ID Application identity found for LanguageTool jar signing');
}

/** Sign native libs inside LanguageTool JARs before electron-builder applies the macOS app signature. */
async function signLanguageToolJars(appOutDir, appName, preferredIdentity, arch) {
  const libsPath = path.join(
    appOutDir,
    `${appName}.app`,
    'Contents',
    'Resources',
    'app.asar.unpacked',
    'public',
    'LanguageTool',
    'libs',
  );
  if (!fs.existsSync(libsPath)) {
    console.log('sign-languagetool-jars: LanguageTool libs path missing, skip');
    return;
  }
  console.log('SIGNING JAVA LIBRARIES............................................');
  const macArch = normalizeMacArch(arch);
  const filesToSign = filesToSignForArch(macArch);
  const { identity, keychain } = await resolveSigningIdentity(preferredIdentity);
  console.log(`Signing LanguageTool native libs for macOS ${macArch} only (${filesToSign.length} paths per jar)`);
  for (const jarFile of jarFiles) {
    const unpackedDir = path.join(libsPath, `${jarFile}_unpacked`);
    console.log(`Unpacking ${jarFile}...`);
    await execPromise(`mkdir -p "${unpackedDir}"`);
    await execPromise(`cd "${unpackedDir}" && jar xf "${path.join(libsPath, jarFile)}"`);
    for (const rel of filesToSign) {
      const fullPath = path.join(unpackedDir, rel);
      if (!fs.existsSync(fullPath)) continue;
      const st = fs.statSync(fullPath);
      fs.chmodSync(fullPath, st.mode | 0o200);
      console.log(
        `codesign${process.env.GITHUB_ACTIONS === 'true' ? '' : ' --timestamp'} ${rel} in ${jarFile}...`,
      );
      await run('codesign', codesignArgs(identity, keychain, fullPath));
      console.log(`SUCCESSFULLY SIGNED ${fullPath}`);
    }
    await execPromise(`jar cf "${path.join(libsPath, jarFile)}" -C "${unpackedDir}" .`);
    fs.rmSync(unpackedDir, { recursive: true, force: true });
    console.log(`Successfully repacked ${jarFile}`);
  }
}

module.exports = { signLanguageToolJars };
