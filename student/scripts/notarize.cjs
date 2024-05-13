 require('dotenv').config();
 const { notarize } = require('@electron/notarize');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;  
  if (electronPlatformName !== 'darwin') {
    return;
  }
  const appName = context.packager.appInfo.productFilename;
  console.log("Notarizing Next-Exam-Student")

  return await notarize({
    tool: 'notarytool',
    teamId: process.env.TEAMID,  // tool : notarytool
    appBundleId: 'com.nextexam-student.app',
    appPath: `${appOutDir}/${appName}.app`,
    appleId: process.env.APPLEID,
    appleIdPassword: process.env.APPLEIDPASS,
  });
};