/**
 * Packages a previously built dist/electron/UnPackaged (from `quasar build -m electron --skip-pkg`)
 * with electron-builder. Replicates quasar's own packaging step (@quasar/app-vite electron-builder.js
 * #packageFiles): production npm install into UnPackaged, then electron-builder with the
 * electron.builder config from quasar.config.ts (same directory/target/arch augmentation as quasar).
 * Allows building the UI on a cheap Linux runner and running only signing/packaging on macOS/Windows.
 *
 * Usage: node scripts/package-electron.mjs <mac|linux|win> [x64|arm64]
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import esbuild from 'esbuild';
import electronBuilder from 'electron-builder';

const appDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv[2];
const arch = process.argv[3] || 'x64';

if (!['mac', 'linux', 'win'].includes(target) || !['x64', 'arm64'].includes(arch)) {
    console.error('Usage: node scripts/package-electron.mjs <mac|linux|win> [x64|arm64]');
    process.exit(1);
}

const unpackagedDir = path.join(appDir, 'dist', 'electron', 'UnPackaged');
if (!fs.existsSync(path.join(unpackagedDir, 'package.json'))) {
    console.error(`Missing ${unpackagedDir}/package.json - run "quasar build -m electron --skip-pkg" first.`);
    process.exit(1);
}

// 1. production dependencies into UnPackaged (same as quasar's nodePackager.install env=production)
console.log('Installing UnPackaged folder production dependencies...');
execFileSync('npm', ['install', '--omit=dev'], {
    cwd: unpackagedDir,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' },
});

// 2. load quasar.config.ts the same way @quasar/app-vite does (esbuild bundle, node_modules external);
// must live in appDir: the config resolves paths via its own import.meta.url (__dirname)
const compiledConfig = path.join(appDir, 'quasar.config.packaging.temporary.mjs');
await esbuild.build({
    entryPoints: [path.join(appDir, 'quasar.config.ts')],
    outfile: compiledConfig,
    platform: 'node',
    format: 'esm',
    bundle: true,
    packages: 'external',
});
const configFn = (await import(pathToFileURL(compiledConfig).href)).default;
const ctx = { prod: true, dev: false, mode: { electron: true }, targetName: target, archName: arch };
const quasarConf = typeof configFn === 'function' ? await configFn(ctx) : configFn;
fs.rmSync(compiledConfig, { force: true });

// 3. same builder-config augmentation quasar applies (icon/directories defaults + target/arch flags)
const builderConfig = quasarConf.electron.builder;
builderConfig.icon ??= path.join(appDir, 'src-electron', 'icons', 'icon');
builderConfig.directories = {
    buildResources: path.join(appDir, 'src-electron'),
    ...builderConfig.directories,
    app: unpackagedDir,
    output: path.join(appDir, 'dist', 'electron', 'Packaged'),
};

console.log(`Bundling app with electron-builder (${target} ${arch})...`);
await electronBuilder.build({ config: builderConfig, [target]: [], [arch]: true });
console.log('electron-builder done.');
