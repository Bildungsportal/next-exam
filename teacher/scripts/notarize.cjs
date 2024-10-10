 /**
  * Leider ist es so, dass Electron Builder derzeit nur CommonJS-Module unterstützt, 
  * wenn Skripte in Hooks wie afterSign definiert sind. 
  * Das bedeutet, dass es keine native Unterstützung für ES6-Module in diesem spezifischen Kontext gibt.
  */
 
 require('dotenv').config();
 const { notarize } = require('@electron/notarize');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;  
  if (electronPlatformName !== 'darwin') {
    console.log("skipping for this platform")
    return;
  }
  const appName = context.packager.appInfo.productFilename;
  console.log("Notarizing Next-Exam-Teacher")

  return await notarize({
    tool: 'notarytool',
    teamId: process.env.TEAMID,  // tool : notarytool
    appBundleId: 'com.nextexam-teacher.app',
    appPath: `${appOutDir}/${appName}.app`,
    appleId: process.env.APPLEID,
    appleIdPassword: process.env.APPLEIDPASS,
  });

};



