import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import JavaScriptObfuscator from 'javascript-obfuscator';
import { transform } from 'esbuild';
import bytenode from 'bytenode';
import dotenv from 'dotenv';
import fsSync from 'fs';

const require = createRequire(import.meta.url);

const envFile = fsSync.existsSync('./.env') ? './.env' : './.env.production';
dotenv.config({ path: envFile });

if (process.env.OBFUSCATE_MAIN === 'false') {
  // obfuscation disabled via OBFUSCATE_MAIN env var
  console.log('⚠️ Skipping main process obfuscation (OBFUSCATE_MAIN=false).');
  process.exit(0);
}

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), '..');
const configPath = path.join(projectRoot, 'obfuscator.config.json');

const getArgValue = (argv, name) => {
  const prefix = `--${name}=`;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (typeof a !== 'string') continue;
    if (a.startsWith(prefix)) return a.slice(prefix.length);
    if (a === `--${name}`) return argv[i + 1];
  }
  return null;
};

const appDir =
  getArgValue(process.argv, 'app-dir') ||
  process.env.NX_PROTECT_APP_DIR ||
  path.join(projectRoot, 'dist', 'electron', 'UnPackaged');

const distMainDir = appDir;
const entryPath = path.join(distMainDir, 'electron-main.js');
const obfuscatedEntryPath = path.join(distMainDir, 'electron-main.obf.cjs');
const bytecodePath = path.join(distMainDir, 'electron-main.jsc');

const ensurePaths = async () => {
  const configExists = await fs
    .access(configPath)
    .then(() => true)
    .catch(() => false);
  if (!configExists) {
    throw new Error('Missing obfuscator.config.json, aborting protection step.');
  }
  await fs.access(entryPath);
};

const getElectronPath = async () => {
  let electronPath;
  try {
    const electronModulePath = require.resolve('electron');
    const electronDir = path.dirname(electronModulePath);
    if (process.platform === 'darwin') {
      electronPath = path.join(electronDir, 'dist', 'Electron.app', 'Contents', 'MacOS', 'Electron');
    } else if (process.platform === 'win32') {
      electronPath = path.join(electronDir, 'dist', 'electron.exe');
    } else {
      electronPath = path.join(electronDir, 'dist', 'electron');
    }
    // Validate that the path exists and is accessible
    await fs.access(electronPath);
    console.log(`✅ Found Electron at: ${electronPath}`);
    return electronPath;
  } catch (err) {
    // Try alternative path resolution
    try {
      const electronDir = path.dirname(require.resolve('electron/package.json'));
      if (process.platform === 'darwin') {
        electronPath = path.join(electronDir, 'dist', 'Electron.app', 'Contents', 'MacOS', 'Electron');
      } else if (process.platform === 'win32') {
        electronPath = path.join(electronDir, 'dist', 'electron.exe');
      } else {
        electronPath = path.join(electronDir, 'dist', 'electron');
      }
      await fs.access(electronPath);
      console.log(`✅ Found Electron (alternative path) at: ${electronPath}`);
      return electronPath;
    } catch (err2) {
      throw new Error(`Electron executable not found. Tried: ${electronPath}. Error: ${err.message}. Alternative error: ${err2.message}`);
    }
  }
};

const createObfuscatedCjs = async () => {
  const configRaw = await fs.readFile(configPath, 'utf8');
  const config = JSON.parse(configRaw);
  const input = await fs.readFile(entryPath, 'utf8');
  const { code: cjsCode } = await transform(input, {
    format: 'cjs',
    loader: 'js',
    target: 'node20',
    sourcemap: false,
    minify: false
  });
  // Fix import.meta.dirname -> __dirname transformation issue
  // esbuild transforms import.meta.dirname to import_meta.dirname (which is undefined)
  // In CommonJS, __dirname is already available, so we remove the assignment
  // Pattern: const __dirname = import_meta.dirname; -> (removed, __dirname already exists)
  let fixedCjsCode = cjsCode.replace(/const\s+__dirname\s*=\s*import_meta\.dirname\s*;/g, '');
  // Also handle cases where it's used in other contexts (shouldn't happen, but just in case)
  fixedCjsCode = fixedCjsCode.replace(/import_meta\.dirname/g, '__dirname');
  // Fix import.meta.url transformation: esbuild uses import_meta.url, which is undefined in CJS.
  fixedCjsCode = fixedCjsCode.replace(/import_meta\.url/g, "require('url').pathToFileURL(__filename).href");
  const result = JavaScriptObfuscator.obfuscate(fixedCjsCode, config);
  await fs.writeFile(obfuscatedEntryPath, result.getObfuscatedCode(), 'utf8');
};

const compileBytecode = async () => {
  // Remove any existing bytecode files to prevent cachedDataRejected errors
  await fs.rm(bytecodePath, { force: true });
  // Also remove any .jsc files in the directory to ensure clean build
  try {
    const files = await fs.readdir(distMainDir);
    for (const file of files) {
      if (file.endsWith('.jsc')) {
        await fs.rm(path.join(distMainDir, file), { force: true });
      }
    }
  } catch (err) {
    // Directory might not exist yet, that's ok
  }
  // Set ELECTRON_EXEC_PATH environment variable to fix spawn error -86 on macOS Intel runners
  // This must be set before bytenode tries to spawn the Electron process
  const electronPath = await getElectronPath();
  process.env.ELECTRON_EXEC_PATH = electronPath;
  console.log(`Setting ELECTRON_EXEC_PATH=${electronPath}`);
  // Verify the binary is executable and check architecture
  try {
    const stats = await fs.stat(electronPath);
    if (!stats.isFile()) {
      throw new Error(`Electron path is not a file: ${electronPath}`);
    }
    console.log(`Electron binary is accessible and is a file`);
    // Check binary architecture on macOS
    if (process.platform === 'darwin') {
      const { execSync } = await import('child_process');
      try {
        const arch = execSync(`file "${electronPath}"`, { encoding: 'utf-8' });
        console.log(`Electron binary architecture: ${arch.trim()}`);
        const systemArch = execSync('uname -m', { encoding: 'utf-8' }).trim();
        console.log(`System architecture: ${systemArch}`);
      } catch (err) {
        console.log(`Could not check binary architecture: ${err.message}`);
      }
    }
  } catch (err) {
    throw new Error(`Cannot access Electron binary: ${err.message}`);
  }
  // Use both ELECTRON_EXEC_PATH env var and electronPath parameter for maximum compatibility
  await bytenode.compileFile({
    filename: obfuscatedEntryPath,
    output: bytecodePath,
    electron: true,
    electronPath: electronPath
  });
  await fs.rm(obfuscatedEntryPath, { force: true });
};

const writeLoader = async () => {
  const loaderSource = `import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import 'bytenode';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

require(path.join(__dirname, 'electron-main.jsc'));
`;
  await fs.writeFile(entryPath, loaderSource, 'utf8');
  await fs.rm(path.join(distMainDir, 'electron-main.js.map'), { force: true });
};

await ensurePaths();
await createObfuscatedCjs();
await compileBytecode();
await writeLoader();
console.log('✅ Protected Electron main process.');

