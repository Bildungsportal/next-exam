import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// Erstelle Datums-String
const now = new Date();
const buildDate = now.getFullYear() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0')


// 1. Update config.js
const configJsPath = './src/utils/config.js';

let configJsContent = `
/**
 * DO NOT EDIT - this file is written by prebuild.js from .env - edit vars in .env file!
 */

const config = {
    development: ${process.env.DEVELOPMENT},  // disable kiosk mode on exam mode and other stuff (autofill input fields)
    showdevtools: ${process.env.SHOWDEVTOOLS},
    useBundledJRE: ${process.env.USE_BUNDLED_JRE},
    bipIntegration: ${process.env.BIP_INTEGRATION},
    bipDemo: ${process.env.BIP_DEMO},
    bipApiUrl: '${process.env.BIP_API_URL}',

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
    virtualized: false,
    isPuavo: ${process.env.IS_PUAVO},
    
    version: '${process.env.VERSION}.${process.env.BUILD_NUMBER}',
    buildDate: '${buildDate}',
    buildNumber: '${process.env.BUILD_NUMBER}',
    info: '${process.env.INFO}'
}
export default config;
`;

fs.writeFileSync(configJsPath, configJsContent);








const buildVersion = (process.env.VERSION || '2.0.0') + '.' + (process.env.BUILD_NUMBER || '1');
const filename = `${process.env.PRODUCT_NAME || 'Next-Exam-Student'}_${process.env.VERSION}.${process.env.BUILD_NUMBER}_${buildDate}`;

// 2. Update package.json
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
console.log(`Is Puavo: ${process.env.IS_PUAVO}`);
console.log(`BIP Integration: ${process.env.BIP_INTEGRATION}`);
console.log(`BIP Demo: ${process.env.BIP_DEMO}`);
console.log(`Sign: ${process.env.SIGN}`);
console.log(`Show Devtools: ${process.env.SHOWDEVTOOLS}`);
console.log(`Development: ${process.env.DEVELOPMENT}`);

console.log(`__________________________________________________________________`);


// 3. Patch portable.nsi template in node_modules (no official custom script support for portable target)
const customPortableNsi = './scripts/portable.nsi';
const targetPortableNsi = './node_modules/app-builder-lib/templates/nsis/portable.nsi';

if (fs.existsSync(customPortableNsi)) {
    fs.copyFileSync(customPortableNsi, targetPortableNsi);
    console.log('✅ Custom portable.nsi copied to node_modules template');
} else {
    console.log('⚠️ Custom portable.nsi not found, using default template');
}
