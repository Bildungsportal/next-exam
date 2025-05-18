require('dotenv').config();
const { notarize } = require('@electron/notarize');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

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
  const { electronPlatformName, appOutDir } = context;

  if (electronPlatformName !== 'darwin') {
    console.log("Skipping for this platform");
    return;
  }
  if (process.env.DISABLE_NOTARIZE) {
    console.log("Notarization disabled by env variable.");
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

  for (const jarFile of jarFiles) {
    const unpackedDir = path.join(appPath, `${jarFile}_unpacked`);


    const filesToSign = [
      'darwin-x86-64/libhunspell.dylib',
      'META-INF/native/libio_grpc_netty_shaded_netty_tcnative_osx_x86_64.jnilib',
      'com/sun/jna/darwin-x86-64/libjnidispatch.jnilib',
      'darwin-aarch64/libhunspell.dylib',  
      'META-INF/native/libio_grpc_netty_shaded_netty_tcnative_osx_aarch_64.jnilib',  
      'com/sun/jna/darwin-aarch64/libjnidispatch.jnilib'  
    ];
    


    await execPromise(`mkdir -p "${unpackedDir}"`);
    console.log(`Created directory: ${unpackedDir}`);

    // Entpacke die JAR-Datei
    await execPromise(`cd "${unpackedDir}" && jar xf "${path.join(appPath, jarFile)}"`);
    console.log(`Successfully unpacked ${jarFile} into ${unpackedDir}`);

    // Signiere die nativen Bibliotheken
    for (const file of filesToSign) {
      const fullPath = path.join(unpackedDir, file);
      if (fs.existsSync(fullPath)) {
        try {
          await execPromise(`codesign --deep --force --options runtime --timestamp --sign ${process.env.SHAID} "${fullPath}"`);
          console.log(`Successfully signed ${fullPath}`);
        } catch (error) {
          console.error(`Error signing ${fullPath}:`, error);
          throw new Error(`Signing failed for ${fullPath}`);
        }
      }
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

  // Den Pfad zur Entitlements-Datei erstellen
  const entitlementsPath = path.resolve(__dirname, 'entitlements.mac.plist');

  try {
    await execPromise(`codesign --deep --force --options runtime --entitlements "${entitlementsPath}" --sign  "${process.env.SHAID}" "${appBundlePath}"`);
    console.log(`Successfully re-signed the entire app: ${appBundlePath}`);
  } catch (error) {
    console.error(`Error re-signing the app:`, error);
    throw new Error(`Re-signing failed for ${appBundlePath}`);
  }

  // Notarization-Prozess starten
  console.log("Notarizing Next-Exam-Student");

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
