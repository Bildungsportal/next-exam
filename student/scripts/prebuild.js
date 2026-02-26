import fs from 'fs';
import yaml from 'yaml';
import dotenv from 'dotenv';

// Lade die env Datei
dotenv.config({ path: 'electron-builder.env' });

// Erstelle Datums-String
const now = new Date();
const buildDate = now.getFullYear() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0')


// 1. Update config.js
const configJsPath = './packages/main/config.js';

let configJsContent = `
/**
 * DO NOT EDIT - this file is written by prebuild.js via electron-builder.env - edit vars in electron-builder.env file!
 */

const config = {
    development: ${process.env.DEVELOPMENT},  // disable kiosk mode on exam mode and other stuff (autofill input fields)
    showdevtools: ${process.env.SHOWDEVTOOLS},
    useBundledJRE: ${process.env.USE_BUNDLED_JRE},
    bipIntegration: ${process.env.BIP_INTEGRATION},
    bipDemo: ${process.env.BIP_DEMO},

    workdirectory : "",   // (desktop path + examdir)
    tempdirectory : "",   // (desktop path + 'tmp')
    homedirectory : "",   // set in main.ts
    examdirectory : "",    // set after registering in ipcHandler
    clientdirectory: '${process.env.CLIENT_DIRECTORY}',

    serverApiPort: ${process.env.SERVER_API_PORT},  // this is needed to be reachable on the teachers pc for basic functionality
    multicastClientPort: ${process.env.MULTICAST_CLIENT_PORT},  // only needed for exam autodiscovery

    multicastServerAdrr: '239.1.1.1',
    hostip: "",       // server.js
    gateway: true,
    electron: false,
    virtualized: false,
    isPuavo: ${process.env.IS_PUAVO},
    
    version: '${process.env.VERSION}.${process.env.BUILD_NUMBER}',
    buildDate: '${buildDate}',
    buildNumber: '${process.env.BUILD_NUMBER}',
    info: '${process.env.INFO}'
}
export default config;
`;

// Schreibe die aktualisierte config.js
fs.writeFileSync(configJsPath, configJsContent);















// 2. Update electron-builder.yml
const builderConfigPath = './electron-builder.yml';
const builderConfig = yaml.parse(fs.readFileSync(builderConfigPath, 'utf8'));

let buildVersion = process.env.VERSION + '.' + process.env.BUILD_NUMBER;


const artifactNamePattern = `\${productName}_\${env.VERSION}.\${env.BUILD_NUMBER}_${buildDate}_\${arch}.\${ext}`;
const buildNumber = process.env.BUILD_NUMBER;
const filename = `${process.env.PRODUCT_NAME}_${process.env.VERSION}.${process.env.BUILD_NUMBER}_${buildDate}`;

// Falls SIGN ausgeschaltet werden soll, entferne den entsprechenden Abschnitt aus dem win-Objekt
if (process.env.SIGN === 'false') {
    // Entferne den Abschnitt "signtoolOptions"
    delete builderConfig.win.signtoolOptions;
    delete builderConfig.afterSign;
    //builderConfig.win.sign = false;
}
else {
    // füge die Sign- und Notarize-Optionen wieder hinzu
   // builderConfig.win.signtoolOptions = {
   //     certificateSubjectName: 'OSOS Austria',
   //     signingHashAlgorithms: ['sha256']
   // };
   // builderConfig.win.sign = true;
    builderConfig.afterSign = 'scripts/notarize.cjs';
}


// Setze die Werte aus der env
builderConfig.buildNumber = process.env.BUILD_NUMBER;
builderConfig.buildVersion = buildVersion;
builderConfig.productName = process.env.PRODUCT_NAME;

// Windows
if (builderConfig.win) {    builderConfig.win.artifactName = artifactNamePattern;}
// Mac
if (builderConfig.mac) {    builderConfig.mac.artifactName = artifactNamePattern;}
// Linux
if (builderConfig.linux) {    builderConfig.linux.artifactName = artifactNamePattern;}

// Setze das Output-Verzeichnis
builderConfig.directories = builderConfig.directories || {};
builderConfig.directories.output = `../release/${process.env.VERSION}.${process.env.BUILD_NUMBER}_${buildDate}`;



// Schreibe die aktualisierte yml
fs.writeFileSync(builderConfigPath, yaml.stringify(builderConfig));




// 3. Update package.json
const packageJsonPath = './package.json';
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Setze die Werte in package.json
packageJson.version = process.env.VERSION;
packageJson.buildNumber = process.env.BUILD_NUMBER;
packageJson.buildVersion = buildVersion;
// Schreibe die aktualisierte package.json
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

console.log('✅ Versionen aktualisiert:');
console.log(`Version: ${process.env.VERSION}`);
console.log(`Build Number: ${process.env.BUILD_NUMBER}`);
console.log(`Build Version: ${buildVersion}`);
console.log(`Build Date: ${buildDate}`);
console.log(`Info: ${process.env.INFO}`);
console.log(`FileName: ${filename}`);
console.log(``);
console.log('✅ Environment Variables:');
console.log(`Development: ${process.env.DEVELOPMENT}`);
console.log(`Show Devtools: ${process.env.SHOWDEVTOOLS}`);
console.log(`Is Puavo: ${process.env.IS_PUAVO}`);
console.log(`BIP Integration: ${process.env.BIP_INTEGRATION}`);
console.log(`BIP Demo: ${process.env.BIP_DEMO}`);
console.log(`Sign: ${process.env.SIGN}`);
console.log(`__________________________________________________________________`);


// 4. Patch portable.nsi template in node_modules (no official custom script support for portable target)
const customPortableNsi = './scripts/portable.nsi';
const targetPortableNsi = './node_modules/app-builder-lib/templates/nsis/portable.nsi';

if (fs.existsSync(customPortableNsi)) {
    fs.copyFileSync(customPortableNsi, targetPortableNsi);
    console.log('✅ Custom portable.nsi copied to node_modules template');
} else {
    console.log('⚠️ Custom portable.nsi not found, using default template');
}
