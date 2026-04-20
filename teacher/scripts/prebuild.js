import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import * as esbuild from 'esbuild';

// load .env (same as student / quasar way)
dotenv.config();

const now = new Date();
const buildDate = now.getFullYear() +
  String(now.getMonth() + 1).padStart(2, '0') +
  String(now.getDate()).padStart(2, '0');

// 1. write src-electron/main/config.js from .env
const configJsPath = './src-electron/main/config.js';
const configJsContent = `/**
 * DO NOT EDIT - this file is written by prebuild.js from .env - edit vars in .env file!
 */

const config = {
    development: ${process.env.DEVELOPMENT},
    showdevtools: ${process.env.SHOWDEVTOOLS},
    bipIntegration: ${process.env.BIP_INTEGRATION},
    bipDemo: ${process.env.BIP_DEMO},
    bipApiUrl: '${process.env.BIP_API_URL}',

    workdirectory : "",
    tempdirectory : "",
    backupdirectory: false,
    serverdirectory: '${process.env.CLIENT_DIRECTORY}',

    serverApiPort: ${process.env.SERVER_API_PORT},
    multicastClientPort: ${process.env.MULTICAST_CLIENT_PORT},
    multicastServerClientPort: ${process.env.MULTICAST_SERVER_CLIENT_PORT},

    multicastServerAdrr: '239.1.1.1',
    hostip: "0.0.0.0",
    gateway: true,
    examServerList: {},
    accessToken: false,
    buildforWEB: false,
    isPuavo: ${process.env.IS_PUAVO},

    exammodes: {
        rdp: ${process.env.EXAMMODE_RDP === 'true'},
        website: ${process.env.EXAMMODE_WEBSITE === 'true'},
        forms: ${process.env.EXAMMODE_FORMS === 'true'},
        eduvidual: ${process.env.EXAMMODE_EDUVIDUAL === 'true'},
        editor: ${process.env.EXAMMODE_EDITOR === 'true'},
        math: ${process.env.EXAMMODE_MATH === 'true'},
        microsoft365: ${process.env.EXAMMODE_MICROSOFT365 === 'true'},
        activesheets: ${process.env.EXAMMODE_ACTIVESHEETS === 'true'},
        localvm: ${process.env.EXAMMODE_LOCALVM === 'true'}
    },

    version: '${process.env.VERSION}.${process.env.BUILD_NUMBER}',
    buildDate: '${buildDate}',
    buildNumber: '${process.env.BUILD_NUMBER}',
    info: '${process.env.INFO}'
}
export default config;
`;

fs.writeFileSync(configJsPath, configJsContent);

// 2. update package.json version/build fields (used by quasar.config.ts and electron builder)
const buildVersion = `${process.env.VERSION || '2.0.0'}.${process.env.BUILD_NUMBER || '1'}`;
const packageJsonPath = './package.json';
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
packageJson.version = process.env.VERSION || packageJson.version;
packageJson.buildNumber = process.env.BUILD_NUMBER || '1';
packageJson.buildVersion = buildVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

const filename = `${process.env.PRODUCT_NAME || 'Next-Exam-Teacher'}_${process.env.VERSION}.${process.env.BUILD_NUMBER}_${buildDate}`;
console.log('✅ versions updated:');
console.log(`Version: ${process.env.VERSION}`);
console.log(`Build Number: ${process.env.BUILD_NUMBER}`);
console.log(`Build Version: ${buildVersion}`);
console.log(`Build Date: ${buildDate}`);
console.log(`Info: ${process.env.INFO}`);
console.log(`FileName: ${filename}`);
console.log('');
console.log('✅ environment variables:');
console.log(`Development: ${process.env.DEVELOPMENT}`);
console.log(`Show Devtools: ${process.env.SHOWDEVTOOLS}`);
console.log(`Is Puavo: ${process.env.IS_PUAVO}`);
console.log(`BIP Integration: ${process.env.BIP_INTEGRATION}`);
console.log(`Sign: ${process.env.SIGN}`);
console.log('__________________________________________________________________');

// 3. patch portable.nsi template in node_modules (no official custom script support for portable target)
const customPortableNsi = './scripts/portable.nsi';
const targetPortableNsi = './node_modules/app-builder-lib/templates/nsis/portable.nsi';
if (fs.existsSync(customPortableNsi)) {
  fs.copyFileSync(customPortableNsi, targetPortableNsi);
  console.log('✅ Custom portable.nsi copied to node_modules template');
} else {
  console.log('⚠️ Custom portable.nsi not found, using default template');
}

// 4. Hidden-window print bundle: entry + built bundle in public/print-document/ (preload source copied from src-electron/preload)
const __prebuildDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__prebuildDir, '..');

async function buildPrintDocumentBundle() {
  const outDir = path.join(repoRoot, 'public', 'print-document');
  fs.mkdirSync(outDir, { recursive: true });

  const workerSrc = path.join(repoRoot, 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.mjs');
  if (!fs.existsSync(workerSrc)) {
    throw new Error(`pdf.worker.mjs not found at ${workerSrc}`);
  }
  fs.copyFileSync(workerSrc, path.join(outDir, 'pdf.worker.mjs'));

  const preloadSrc = path.join(repoRoot, 'src-electron', 'preload', 'print-document-preload.cjs');
  fs.copyFileSync(preloadSrc, path.join(outDir, 'print-document-preload.cjs'));

  await esbuild.build({
    entryPoints: [path.join(repoRoot, 'public', 'print-document', 'print-entry.mjs')],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    outfile: path.join(outDir, 'print-bundle.js'),
    logLevel: 'info',
  });
}

try {
  await buildPrintDocumentBundle();
  console.log('✅ print-document bundle built (public/print-document/)');
} catch (e) {
  console.error('❌ print-document bundle failed:', e);
  process.exit(1);
}
