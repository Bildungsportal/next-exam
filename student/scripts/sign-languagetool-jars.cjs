const path = require('path');
const fs = require('fs');
const { exec, spawn } = require('child_process');

const jarFiles = ['hunspell.jar', 'grpc-netty-shaded.jar', 'jna.jar'];
const filesToSign = [
  'darwin-x86-64/libhunspell.dylib',
  'META-INF/native/libio_grpc_netty_shaded_netty_tcnative_osx_x86_64.jnilib',
  'com/sun/jna/darwin-x86-64/libjnidispatch.jnilib',
  'darwin-aarch64/libhunspell.dylib',
  'META-INF/native/libio_grpc_netty_shaded_netty_tcnative_osx_aarch_64.jnilib',
  'com/sun/jna/darwin-aarch64/libjnidispatch.jnilib',
];

function execPromise(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) reject(stderr || error);
      else resolve(stdout);
    });
  });
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit' });
    p.on('exit', (c) => (c === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} failed (${c})`))));
  });
}

// TSA via --timestamp can hang on GitHub Actions (same issue as assessment-helper pre-pack sign).
function codesignArgs(identity, fullPath) {
  const args = ['--force', '--options', 'runtime'];
  if (process.env.GITHUB_ACTIONS !== 'true') args.push('--timestamp');
  args.push('--preserve-metadata=identifier,entitlements,flags', '-s', identity, fullPath);
  return args;
}

/** Sign native libs inside LanguageTool JARs before electron-builder applies the macOS app signature. */
async function signLanguageToolJars(appOutDir, appName, identity) {
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
      await run('codesign', codesignArgs(identity, fullPath));
      console.log(`SUCCESSFULLY SIGNED ${fullPath}`);
    }
    await execPromise(`jar cf "${path.join(libsPath, jarFile)}" -C "${unpackedDir}" .`);
    fs.rmSync(unpackedDir, { recursive: true, force: true });
    console.log(`Successfully repacked ${jarFile}`);
  }
}

module.exports = { signLanguageToolJars };
