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

const CODESIGN_TIMEOUT_MS = 180000;
const CODESIGN_MAX_ATTEMPTS = 3;
const CODESIGN_RETRY_DELAY_MS = 60000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeMacArch(arch) {
  if (arch === 'x64' || arch === 1 || arch === '1') return 'x64';
  if (arch === 'arm64' || arch === 3 || arch === '3') return 'arm64';
  return process.env.NXE_EB_MAC_ARCH === 'x64' ? 'x64' : 'arm64';
}

function filesToSignForArch(macArch) {
  return macArch === 'x64' ? filesToSignX64 : filesToSignArm64;
}

function pathsToRemoveForArch(macArch) {
  return macArch === 'x64' ? filesToSignArm64 : filesToSignX64;
}

function execPromise(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) reject(stderr || error);
      else resolve(stdout);
    });
  });
}

function run(cmd, args, timeoutMs = CODESIGN_TIMEOUT_MS) {
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

function codesignArgs(identity, fullPath) {
  return [
    '--force',
    '--options',
    'runtime',
    '--timestamp',
    '--preserve-metadata=identifier,entitlements,flags',
    '-s',
    identity,
    fullPath,
  ];
}

function isRetryableCodesignError(error) {
  const msg = String(error?.message || error);
  return msg.includes('timed out');
}

async function codesignWithRetry(identity, fullPath, label) {
  let lastError;
  for (let attempt = 1; attempt <= CODESIGN_MAX_ATTEMPTS; attempt++) {
    try {
      console.log(`codesign --timestamp ${label} (attempt ${attempt}/${CODESIGN_MAX_ATTEMPTS})...`);
      await run('codesign', codesignArgs(identity, fullPath));
      console.log(`SUCCESSFULLY SIGNED ${fullPath}`);
      return;
    } catch (error) {
      lastError = error;
      if (!isRetryableCodesignError(error) || attempt === CODESIGN_MAX_ATTEMPTS) break;
      console.warn(
        `codesign attempt ${attempt}/${CODESIGN_MAX_ATTEMPTS} timed out — retry in ${CODESIGN_RETRY_DELAY_MS / 1000}s…`,
      );
      await sleep(CODESIGN_RETRY_DELAY_MS);
    }
  }
  throw lastError;
}

function removeIfExists(filePath) {
  if (!fs.existsSync(filePath)) return;
  fs.rmSync(filePath, { force: true });
  console.log(`Removed unused arch binary ${filePath}`);
}

/** Sign native libs inside LanguageTool JARs; strips the non-target arch before repack. */
async function signLanguageToolJarLibsAt(libsPath, identity, arch) {
  if (!fs.existsSync(libsPath)) {
    console.log('sign-languagetool-jars: LanguageTool libs path missing, skip');
    return;
  }
  const macArch = normalizeMacArch(arch);
  const filesToSign = filesToSignForArch(macArch);
  const pathsToRemove = pathsToRemoveForArch(macArch);
  console.log('SIGNING JAVA LIBRARIES............................................');
  console.log(`Target macOS arch: ${macArch} (${filesToSign.length} native libs per jar)`);
  for (const jarFile of jarFiles) {
    const unpackedDir = path.join(libsPath, `${jarFile}_unpacked`);
    console.log(`Unpacking ${jarFile}...`);
    await execPromise(`mkdir -p "${unpackedDir}"`);
    await execPromise(`cd "${unpackedDir}" && jar xf "${path.join(libsPath, jarFile)}"`);
    for (const rel of pathsToRemove) {
      removeIfExists(path.join(unpackedDir, rel));
    }
    for (const rel of filesToSign) {
      const fullPath = path.join(unpackedDir, rel);
      if (!fs.existsSync(fullPath)) continue;
      const st = fs.statSync(fullPath);
      fs.chmodSync(fullPath, st.mode | 0o200);
      await codesignWithRetry(identity, fullPath, `${rel} in ${jarFile}`);
    }
    await execPromise(`jar cf "${path.join(libsPath, jarFile)}" -C "${unpackedDir}" .`);
    fs.rmSync(unpackedDir, { recursive: true, force: true });
    console.log(`Successfully repacked ${jarFile}`);
  }
}

/** afterpack hook: skip when jars were pre-signed at workflow start (NXE_LT_JARS_PRESIGNED=1). */
async function signLanguageToolJars(appOutDir, appName, identity, arch) {
  if (process.env.NXE_LT_JARS_PRESIGNED === '1') {
    console.log('sign-languagetool-jars: pre-signed jars in use, skip afterpack signing');
    return;
  }
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
  await signLanguageToolJarLibsAt(libsPath, identity, arch);
}

module.exports = { signLanguageToolJars, signLanguageToolJarLibsAt };
