require('dotenv').config();
const { notarize } = require('@electron/notarize');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;

  if (electronPlatformName !== 'darwin') {
    console.log("Skipping for this platform");
    return;
  }
  
  const appBundlePath = context.appOutDir + '/' + context.packager.appInfo.productFilename + '.app';

  // Notarization-Prozess starten
  console.log("Notarizing Next-Exam-Teacher");

  try {
    await notarize({
      tool: 'notarytool',
      teamId: process.env.TEAMID,
      appBundleId: 'com.nextexam-teacher.app',
      appPath: appBundlePath,
      appleId: process.env.APPLEID,
      appleIdPassword: process.env.APPLEIDPASS,
    });
    console.log("Notarization successful!");
  } catch (error) {
    console.error("Failed to notarize:", error);
  }
};
