import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// load .env when present (local dev); otherwise fall back to committed .env.production (CI)
const envFile = fs.existsSync('./.env') ? './.env' : './.env.production';
dotenv.config({ path: envFile });
console.log(`📦 prebuild loaded env from ${envFile}`);

// pdfjs-dist npm tarball includes legacy/build/*.mjs; incomplete installs leave only .map files and break Vite/Rolldown
function assertPdfJsDist() {
    const root = path.join(process.cwd(), 'node_modules', 'pdfjs-dist');
    const required = ['legacy/build/pdf.mjs', 'legacy/build/pdf.worker.mjs'];
    const missing = required.filter((rel) => !fs.existsSync(path.join(root, rel)));
    if (missing.length) {
        console.error('❌ pdfjs-dist incomplete. Missing:', missing.join(', '));
        console.error('   Fix: remove node_modules/pdfjs-dist, then npm install (or npm ci)');
        process.exit(1);
    }
}
assertPdfJsDist();

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
    bipLoginUrl: '${process.env.BIP_LOGIN_URL}',
    demoBipApiUrl: '${process.env.DEMO_BIP_API_URL}',
    demoBipLoginUrl: '${process.env.DEMO_BIP_LOGIN_URL}',

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


// Inject app secrets from env into their source files (placeholder default "NEXT-EXAM" in .env.production; CI overwrites via GitHub secrets).
const apiSecret = process.env.NEXT_EXAM_API_SECRET || 'NEXT-EXAM';
const connectionSecret = process.env.CONNECTION_SECRET || 'NEXT-EXAM';

const apiSecretPath = '../shared/nextExamApiSecret.js';
let apiSecretContent = fs.readFileSync(apiSecretPath, 'utf8');
apiSecretContent = apiSecretContent.replace(/export const NEXT_EXAM_API_SECRET = '.*';/, `export const NEXT_EXAM_API_SECRET = '${apiSecret}';`);
fs.writeFileSync(apiSecretPath, apiSecretContent);

const extraPath = './src-electron/main/scripts/ipchandler.js';
let extraContent = fs.readFileSync(extraPath, 'utf8');
extraContent = extraContent.replace(/const EXTRA = '.*?';/, `const EXTRA = '${connectionSecret}';`);
fs.writeFileSync(extraPath, extraContent);

const iosApiSecretPath = './src-capacitor/ios/App/App/Util/NextExamApiAuthentication.swift';
let iosApiSecretContent = fs.readFileSync(iosApiSecretPath, 'utf8');
iosApiSecretContent = iosApiSecretContent.replace(/private static let NEXT_EXAM_API_SECRET = ".*"/, `private static let NEXT_EXAM_API_SECRET = "${apiSecret}"`);
fs.writeFileSync(iosApiSecretPath, iosApiSecretContent);

const iosConnectionSecretPath = './src-capacitor/ios/App/App/Plugins/MulticastClient.swift';
let iosConnectionSecretContent = fs.readFileSync(iosConnectionSecretPath, 'utf8');
iosConnectionSecretContent = iosConnectionSecretContent.replace(/let EXTRA = ".*";/, `let EXTRA = "${connectionSecret}";`);
fs.writeFileSync(iosConnectionSecretPath, iosConnectionSecretContent);

// iOS Config.swift, matching config.js/package.json
const iosVersion = (process.env.VERSION || '2.1.1') + '.' + (process.env.BUILD_NUMBER || '0');
const iosConfigPath = './src-capacitor/ios/App/App/DTO/Config.swift';
const iosConfigContent = `//
//  Config.swift
//  App
//
//  DO NOT EDIT - this file is written by prebuild.js from .env - edit vars in .env file!
//

struct Config {
    static var development: Bool = ${process.env.DEVELOPMENT}  // disable kiosk mode on exam mode and other stuff (autofill input fields)
    static var showdevtools: Bool = ${process.env.SHOWDEVTOOLS}
    static var useBundledJRE: Bool = ${process.env.USE_BUNDLED_JRE}
    static var bipIntegration: Bool = ${process.env.BIP_INTEGRATION}
    static var bipDemo: Bool = ${process.env.BIP_DEMO}
    static var bipApiUrl: String = "${process.env.BIP_API_URL}"
    static var bipLoginUrl: String = "${process.env.BIP_LOGIN_URL}"
    static var demoBipApiUrl: String = "${process.env.DEMO_BIP_API_URL}"
    static var demoBipLoginUrl: String = "${process.env.DEMO_BIP_LOGIN_URL}"

    static var workdirectory : String = ""   // (desktop path + examdir)
    static var tempdirectory : String = ""   // (desktop path + "tmp")
    static var homedirectory : String = ""   // set in main.ts
    static var examdirectory : String = ""    // set after registering in ipcHandler
    static var clientdirectory: String = "${process.env.CLIENT_DIRECTORY}"

    static var serverApiPort: Int = ${process.env.SERVER_API_PORT}  // this is needed to be reachable on the teachers pc for basic functionality
    static var multicastClientPort: Int = ${process.env.MULTICAST_CLIENT_PORT}  // only needed for exam autodiscovery

    static var multicastServerAdrr: String = "239.1.1.1"
    static var hostip: String = ""       // server.js
    static var gateway: Bool = true
    static var virtualized: Bool = false
    static var isPuavo: Bool = ${process.env.IS_PUAVO}

    static var version: String = "${iosVersion}"
    static var buildDate: String = "${buildDate}"
    static var buildNumber: String = "${process.env.BUILD_NUMBER}"
    static var info: String = "${process.env.INFO}"
}
`;
fs.writeFileSync(iosConfigPath, iosConfigContent);
console.log(`✅ iOS version constants set to ${iosVersion}`);

// iOS CFBundleVersion (CURRENT_PROJECT_VERSION) from BUILD_NUMBER, matching config.js/package.json
const iosBuildNumber = process.env.BUILD_NUMBER || '0';
const pbxprojPath = './src-capacitor/ios/App/App.xcodeproj/project.pbxproj';
let pbxprojContent = fs.readFileSync(pbxprojPath, 'utf8');
pbxprojContent = pbxprojContent.replace(/CURRENT_PROJECT_VERSION = \d+;/g, `CURRENT_PROJECT_VERSION = ${iosBuildNumber};`);
fs.writeFileSync(pbxprojPath, pbxprojContent);
console.log(`✅ iOS CFBundleVersion (CURRENT_PROJECT_VERSION) set to ${iosBuildNumber}`);

console.log(`✅ Secrets injected (api=${apiSecret === 'NEXT-EXAM' ? 'default' : 'custom'}, connection=${connectionSecret === 'NEXT-EXAM' ? 'default' : 'custom'})`);




const buildVersion = (process.env.VERSION || '2.1.0') + '.' + (process.env.BUILD_NUMBER || '1');
const filename = `${process.env.PRODUCT_NAME || 'Next-Exam-Student'}_${process.env.VERSION}.${process.env.BUILD_NUMBER}_${buildDate}`;

// 2. Update package.json
const packageJsonPath = './package.json';
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// fallback to existing package.json values when env is missing (e.g. CI without .env) - undefined would drop the key on stringify
packageJson.version = process.env.VERSION || packageJson.version;
packageJson.buildNumber = process.env.BUILD_NUMBER || '4';
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
