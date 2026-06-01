require('dotenv').config();
const { notarize } = require('@electron/notarize');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const { spawn } = require('child_process'); 


// Funktion zum Ausführen eines Befehls als Promise
function execPromise(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(stderr);
      } else {
        resolve(stdout);
      }
    });
  });
}

// Funktion zum Löschen eines Verzeichnisses rekursiv
function deleteDirectory(directoryPath) {
  if (fs.existsSync(directoryPath)) {
    fs.rmSync(directoryPath, { recursive: true, force: true });
    console.log(`Deleted directory: ${directoryPath}`);
  }
}

exports.default = async function notarizing(context) {
  console.log('--------------------------------');
  console.info('Starting signing all JAVA LIBRARIES and notarization process for Next-Exam-Student ');
  console.log('--------------------------------');
    
  const { electronPlatformName, appOutDir } = context;

  if (electronPlatformName !== 'darwin') {
    console.log("Skipping for this platform");
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`, 'Contents', 'Resources', 'app.asar.unpacked', 'public', 'LanguageTool', 'libs');

  // Liste der JAR-Dateien
  const jarFiles = [
    'hunspell.jar',
    'grpc-netty-shaded.jar',
    'jna.jar'
  ];

  // Den Pfad zur Entitlements-Datei erstellen
  const entitlementsPath = path.resolve(__dirname, 'entitlements.mac.plist');


  console.log(`SIGNING JAVA LIBRARIES............................................`); // log


  const ID = (process.env.SHAID || process.env.CSC_NAME || '').trim();
  if (!ID) { throw new Error('Signing identity (SHAID/CSC_NAME) fehlt! Bitte sicherstellen, dass SHAID im Workflow-Env gesetzt ist.');}
  
  const run = (cmd, args) => new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit' });
    p.on('exit', c => c === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} failed (${c})`)));
  });

  for (const jarFile of jarFiles) {
    const unpackedDir = path.join(appPath, `${jarFile}_unpacked`); 

    // Erstelle das Verzeichnis für die Entpackung
    await execPromise(`mkdir -p "${unpackedDir}"`);
    console.log(`Created directory: ${unpackedDir}`);

    // Entpacke die JAR-Datei
    await execPromise(`cd "${unpackedDir}" && jar xf "${path.join(appPath, jarFile)}"`);
    console.log(`Successfully unpacked ${jarFile} into ${unpackedDir}`);




    const filesToSign = [
      'darwin-x86-64/libhunspell.dylib',
      'META-INF/native/libio_grpc_netty_shaded_netty_tcnative_osx_x86_64.jnilib',
      'com/sun/jna/darwin-x86-64/libjnidispatch.jnilib',
      'darwin-aarch64/libhunspell.dylib',
      'META-INF/native/libio_grpc_netty_shaded_netty_tcnative_osx_aarch_64.jnilib',
      'com/sun/jna/darwin-aarch64/libjnidispatch.jnilib'
    ]; // fixed list
    


    for (const rel of filesToSign) {
      const fullPath = path.join(unpackedDir, rel);
      if (!fs.existsSync(fullPath)) continue;
      const st = fs.statSync(fullPath);
      fs.chmodSync(fullPath, st.mode | 0o200);
      await run('codesign', [
        '--force',
        '--options', 'runtime',
        '--timestamp',
        '--preserve-metadata=identifier,entitlements,flags',
        '-s', ID,
        fullPath,
      ]);
      console.log(`SUCCESSFULLY SIGNED ${fullPath}`);
    }
    








    // JAR-Datei neu verpacken
    try {
      await execPromise(`jar cf "${path.join(appPath, jarFile)}" -C "${unpackedDir}" .`);
      console.log(`Successfully repacked ${jarFile}`);
    } catch (error) {
      console.error(`Error repacking ${jarFile}:`, error);
      throw new Error(`Repacking failed for ${jarFile}`);
    }

    deleteDirectory(unpackedDir);  // Löschen des _unpacked-Verzeichnisses
  }







  // **Neu-Signieren der gesamten App** nach der Modifikation der Dateien
  const appBundlePath = path.join(appOutDir, `${appName}.app`);
  if (!fs.existsSync(appBundlePath)) {
    console.error(`appBundle does not exist:`, appBundlePath);
    throw new Error(`appBundle does not exist ${appBundlePath}`);
  }

  try {
    const st = fs.statSync(appBundlePath);
    fs.chmodSync(appBundlePath, st.mode | 0o200);
    await run('codesign', [
        '--deep',
        '--force',
        '--options', 'runtime',
        '--entitlements', entitlementsPath,
        '-s', ID,
        appBundlePath,
    ]);
    console.log(`Successfully re-signed the entire app: ${appBundlePath}`);
  } catch (error) {
    console.error(`Error re-signing the app:`, error);
    throw new Error(`Re-signing failed for ${appBundlePath}`);
  }

  try {
    await execPromise(`codesign -vvv --deep --strict ${appBundlePath}`);
  } catch (error) {
    console.error(`Validating failed:`, error);
    throw new Error(`Validating failed ${appBundlePath}`);
  }









  // local dev: keep signing, skip only the slow Apple notarization upload
  if (process.env.NOTARIZE === 'false') {
    console.log('Skipping notarization (NOTARIZE=false) - app is signed but not stapled');
    return;
  }

  // Notarization-Prozess starten
  console.log('--------------------------------');
  console.log("Notarizing Next-Exam-Student");
  console.log('--------------------------------');

  try {
    await notarize({
      tool: 'notarytool',
      teamId: process.env.TEAMID,
      appBundleId: 'com.nextexam-student.app',
      appPath: appBundlePath,
      appleId: process.env.APPLEID,
      appleIdPassword: process.env.APPLEIDPASS,
    });
    console.log("Notarization successful!");
  } catch (error) {
    console.error("Failed to notarize:", error);
  }
};
