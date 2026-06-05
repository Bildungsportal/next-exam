// Configuration for your app
// https://v2.quasar.dev/quasar-cli-vite/quasar-config-file

import { defineConfig } from '@quasar/app-vite/wrappers';
import path from 'path';
import { fileURLToPath } from 'url';
import { builtinModules } from 'module';
import fse from 'fs-extra';
import pkg from './package.json';
import dotenv from 'dotenv';
import fs from 'fs';

// load .env when present (local dev); otherwise fall back to committed .env.production (CI)
dotenv.config({ path: fs.existsSync('./.env') ? './.env' : './.env.production' });

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** First existing pdfjs-dist artifact (guards against incomplete node_modules installs). */
function resolvePdfJsFile(...relPaths: string[]): string {
  for (const rel of relPaths) {
    const p = path.resolve(__dirname, 'node_modules/pdfjs-dist', rel);
    if (fse.existsSync(p)) return p;
  }
  throw new Error(
    `pdfjs-dist files missing under ${path.resolve(__dirname, 'node_modules/pdfjs-dist')}. ` +
    'Remove node_modules/pdfjs-dist and run npm install.',
  );
}

const pdfjsLegacyPdf = resolvePdfJsFile(
  'legacy/build/pdf.mjs',
  'legacy/build/pdf.min.mjs',
  'build/pdf.mjs',
  'build/pdf.min.mjs',
);
const pdfjsLegacyWorker = resolvePdfJsFile(
  'legacy/build/pdf.worker.mjs',
  'legacy/build/pdf.worker.min.mjs',
  'build/pdf.worker.mjs',
  'build/pdf.worker.min.mjs',
);

const buildDate = (() => {
  const now = new Date();
  return now.getFullYear() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0');
})();

const productName = process.env.PRODUCT_NAME || pkg.name || 'Next-Exam-Teacher';
const version = process.env.VERSION || pkg.version || '2.0.0';
const buildNumber = process.env.BUILD_NUMBER || '1';
const artifactDate = buildDate;
const artifactNamePattern = `${productName}_${version}.${buildNumber}_${artifactDate}_\${arch}.\${ext}`;
const signEnabled = process.env.SIGN !== 'false';
const winEbTarget = process.env.NXE_EB_WIN_TARGET === 'msi'
  ? [{ target: 'msi', arch: ['x64'] as const }]
  : [{ target: 'portable', arch: ['x64'] as const }];
const macEbArch = process.env.NXE_EB_MAC_ARCH === 'arm64'
  ? (['arm64'] as const)
  : (['x64'] as const);

export default defineConfig(( ctx: any ) => {
  return {
    // https://v2.quasar.dev/quasar-cli-vite/prefetch-feature
    // preFetch: true,

    // app boot file (/src/boot)
    // --> boot files are part of "main.js"
    // https://v2.quasar.dev/quasar-cli-vite/boot-files
    boot: [
      'main'
    ],

    mode: process.env.NODE_ENV,
    root: __dirname,

    // https://v2.quasar.dev/quasar-cli-vite/quasar-config-file#css
    css: [
      'app.scss'
    ],

    // https://github.com/quasarframework/quasar/tree/dev/extras
    extras: [
      // 'ionicons-v4',
      // 'mdi-v7',
      // 'fontawesome-v6',
      // 'eva-icons',
      // 'themify',
      // 'line-awesome',
      // 'roboto-font-latin-ext', // this or either 'roboto-font', NEVER both!

      // 'roboto-font', // optional, you are not bound to it
      // 'material-icons', // optional, you are not bound to it
    ],

    // Full list of options: https://v2.quasar.dev/quasar-cli-vite/quasar-config-file#build
    build: {
      target: {
        browser: [ 'es2022', 'firefox115', 'chrome115', 'safari14' ],
        node: 'node24'
      },

      typescript: {
        strict: true,
        vueShim: true
        // extendTsConfig (tsConfig) {}
      },

      vueRouterMode: 'hash', // available values: 'hash', 'history'
      // vueRouterBase,
      // vueDevtools,
      // vueOptionsAPI: false,

      rebuildCache: true, // rebuilds Vite/linter/etc cache on startup

      // publicPath: '/',
      // analyze: true,
      // env: {},
      // rawDefine: {}
      // ignorePublicFolder: true,
      // minify: false,
      // polyfillModulePreload: true,
      // distDir
      showBuildSummary: false,

      extendViteConf (viteConf: any) {
        viteConf.server = viteConf.server || {};
        viteConf.server.forwardConsole = false; // Vite 8+: do not mirror browser console.warn/error to the dev-server terminal (avoids duplicate lines with electron-log).
        // suppress SASS deprecation warnings for Bootstrap color functions
        viteConf.css = viteConf.css || {};
        viteConf.css.preprocessorOptions = viteConf.css.preprocessorOptions || {};
        viteConf.css.preprocessorOptions.scss = viteConf.css.preprocessorOptions.scss || {};
        viteConf.css.preprocessorOptions.scss.silenceDeprecations = ['color-functions', 'if-function'];

        const sharedDir = path.resolve(__dirname, '..', 'shared');
        const repoRoot = path.resolve(__dirname, '..');
        viteConf.server.fs = viteConf.server.fs || {};
        const fsAllow = new Set([
          ...(Array.isArray(viteConf.server.fs.allow) ? viteConf.server.fs.allow : []),
          repoRoot,
          sharedDir,
        ]);
        viteConf.server.fs.allow = [...fsAllow];
        viteConf.resolve = viteConf.resolve || {};
        viteConf.resolve.alias = {
          ...viteConf.resolve.alias,
          'pdfjs-dist/legacy/build/pdf.mjs': pdfjsLegacyPdf,
          'pdfjs-dist/legacy/build/pdf.worker.mjs': pdfjsLegacyWorker,
          'next-exam-shared': sharedDir,
        };
        viteConf.optimizeDeps = viteConf.optimizeDeps || {};
        viteConf.optimizeDeps.include = viteConf.optimizeDeps.include || [];
        if (!viteConf.optimizeDeps.include.includes('pdfjs-dist')) {
          viteConf.optimizeDeps.include.push('pdfjs-dist');
        }

        viteConf.build = viteConf.build || {};
        viteConf.build.chunkSizeWarningLimit = 1500;

        if (ctx.mode.electron && ctx.prod) {
          const baseOut = viteConf.build?.outDir ?? path.join(__dirname, 'dist', 'electron', 'UnPackaged');
          const publicOut = path.join(baseOut, 'public');
          viteConf.build.outDir = publicOut;
          viteConf.base = './';
          viteConf.publicDir = path.resolve(__dirname, 'public');
          const srcAssetsDir = path.resolve(__dirname, 'src', 'assets');
          viteConf.plugins = viteConf.plugins || [];
          viteConf.plugins.push({
            name: 'quasar-electron-public-folder-teacher',
            closeBundle () {
              fse.copySync(srcAssetsDir, path.join(publicOut, 'src', 'assets'));
            }
          });
          viteConf.plugins.push({
            name: 'quasar-electron-rewrite-assets-teacher',
            transformIndexHtml: (html) => {
              let out = html.replace(/([`"'])\/src\/assets/g, '$1./src/assets');
              out = out.replace(/href=[\"']public\//g, 'href=\"./');
              return out;
            },
            generateBundle (_, bundle) {
              // Vue compiles template src to backticks; CSS url() is inlined — only JS literals need backtick rewrite.
              const rewrite = (s) => s
                .replace(/`\/src\/assets/g, '`./src/assets')
                .replace(/\\"\/src\/assets/g, '\\"./src/assets')
                .replace(/\\'\/src\/assets/g, "\\'./src/assets")
                .replace(/"\/src\/assets/g, '"./src/assets')
                .replace(/'\/src\/assets/g, "'./src/assets");
              for (const item of Object.values(bundle)) {
                const entry = item as { type?: string; code?: string; source?: string | Buffer };
                if (entry?.type === 'chunk' && entry.code) entry.code = rewrite(entry.code);
                if (entry?.type === 'asset' && typeof entry.source === 'string') entry.source = rewrite(entry.source);
              }
            }
          });
        }
      },
      viteVuePluginOptions: {
        template: {
          compilerOptions: {
            isCustomElement: (tag: string) => tag === 'webview'
          }
        }
      },

      // vitePlugins: [
      //   [ 'package-name', { ..pluginOptions.. }, { server: true, client: true } ]
      // ]
      rollupOptions: {
        external: [
          'electron',
          'sharp',
          ...builtinModules,
          ...Object.keys(pkg.dependencies || {}),
        ],
      },
    },

    // Full list of options: https://v2.quasar.dev/quasar-cli-vite/quasar-config-file#devserver
    devServer: {
      // https: true,
      open: true, // opens browser window automatically
      host: 'localhost',
      vueDevtools: false
    },

    // https://v2.quasar.dev/quasar-cli-vite/quasar-config-file#framework
    framework: {
      config: {},

      // iconSet: 'material-icons', // Quasar icon set
      // lang: 'en-US', // Quasar language pack

      // For special cases outside of where the auto-import strategy can have an impact
      // (like functional components as one of the examples),
      // you can manually specify Quasar components/directives to be available everywhere:
      //
      // components: [],
      // directives: [],

      // Quasar plugins
      plugins: []
    },

    // animations: 'all', // --- includes all animations
    // https://v2.quasar.dev/options/animations
    animations: [],

    // https://v2.quasar.dev/quasar-cli-vite/quasar-config-file#sourcefiles
    sourceFiles: {
      rootComponent: 'src/App.vue',
      router: 'src/router/index',
    //   store: 'src/store/index',
    //   pwaRegisterServiceWorker: 'src-pwa/register-service-worker',
    //   pwaServiceWorker: 'src-pwa/custom-service-worker',
    //   pwaManifestFile: 'src-pwa/manifest.json',
      electronMain: 'src-electron/electron-main',
      electronPreload: 'src-electron/electron-preload'
    //   bexManifestFile: 'src-bex/manifest.json
    },

    // https://v2.quasar.dev/quasar-cli-vite/developing-ssr/configuring-ssr
    ssr: {
      prodPort: 3000, // The default port that the production server should use
                      // (gets superseded if process.env.PORT is specified at runtime)

      middlewares: [
        'render' // keep this as last one
      ],

      // extendPackageJson (json) {},
      // extendSSRWebserverConf (esbuildConf) {},

      // manualStoreSerialization: true,
      // manualStoreSsrContextInjection: true,
      // manualStoreHydration: true,
      // manualPostHydrationTrigger: true,

      pwa: false
      // pwaOfflineHtmlFilename: 'offline.html', // do NOT use index.html as name!

      // pwaExtendGenerateSWOptions (cfg) {},
      // pwaExtendInjectManifestOptions (cfg) {}
    },

    // https://v2.quasar.dev/quasar-cli-vite/developing-pwa/configuring-pwa
    pwa: {
      workboxMode: 'GenerateSW' // 'GenerateSW' or 'InjectManifest'
      // swFilename: 'sw.js',
      // manifestFilename: 'manifest.json',
      // extendManifestJson (json) {},
      // useCredentialsForManifestTag: true,
      // injectPwaMetaTags: false,
      // extendPWACustomSWConf (esbuildConf) {},
      // extendGenerateSWOptions (cfg) {},
      // extendInjectManifestOptions (cfg) {}
    },

    // Full list of options: https://v2.quasar.dev/quasar-cli-vite/developing-cordova-apps/configuring-cordova
    cordova: {
      // noIosLegacyBuildFlag: true, // uncomment only if you know what you are doing
    },

    // Full list of options: https://v2.quasar.dev/quasar-cli-vite/developing-capacitor-apps/configuring-capacitor
    capacitor: {
      hideSplashscreen: true
    },

    // Full list of options: https://v2.quasar.dev/quasar-cli-vite/developing-electron-apps/configuring-electron
    electron: {
      // extendElectronMainConf (esbuildConf) {},
      // extendElectronPreloadConf (esbuildConf) {},

      // extendPackageJson (json) {},

      // Electron preload scripts (if any) from /src-electron, WITHOUT file extension
      preloadScripts: [ 'electron-preload' ],

      // specify the debugging port to use for the Electron app when running in development mode
      inspectPort: 5858,

      bundler: 'builder',
      nodeIntegration: true,
      packager: {
        // https://github.com/electron-userland/electron-packager/blob/master/docs/api.md#options
      },

      builder: {
        appId: 'com.nextexam.teacher',
        productName,
        buildVersion: `${version}.${buildNumber}`,
        // disable implicit CI publishing (removed in electron-builder v27)
        publish: null,
        asar: true,
        asarUnpack: [
          'public',
        ],
        beforePack: 'scripts/beforepack.js',
        afterPack: 'scripts/afterpack.js',
        // directories.output is overridden by quasar to dist/electron/Packaged - cannot change here
        compression: 'normal',
        // ship only finnish/english/german Chromium UI locales (prunes locales/*.pak)
        electronLanguages: ['fi', 'en-US', 'en-GB', 'de'],
        // include entire UnPackaged folder (electron-main.js at root, public/, preload/, etc.)
        files: ['**/*'],
        linux: {
          target: 'AppImage',
          category: 'Utility',
          icon: 'public/icons/256x256.png',
          artifactName: artifactNamePattern,
          files: ['**/*', '!public/qemu/win/**', '!public/qemu/mac/**'],
        },
        mac: {
          icon: 'public/icons/icon.png',
          artifactName: artifactNamePattern,
          hardenedRuntime: true,
          gatekeeperAssess: false,
          entitlements: 'scripts/entitlements.mac.plist',
          entitlementsInherit: 'scripts/entitlements.mac.plist',
          category: 'public.app-category.utilities',
          target: { target: 'dmg', arch: macEbArch },
          files: ['**/*', '!public/qemu/win/**', '!public/qemu/lin/**'],
        },
        dmg: { sign: false },
        portable: { useZip: false, unpackDirName: 'next-exam-teacher', splashImage: 'public/splash.bmp' },
        msi: {
          perMachine: true,
          createDesktopShortcut: true,
          createStartMenuShortcut: true,
          upgradeCode: '77234b48-9292-4b75-acfe-e5645ad97c46',
          shortcutName: 'Next-Exam Teacher',
        },
        win: {
          icon: 'public/icons/icon.ico',
          target: winEbTarget,
          artifactName: artifactNamePattern,
          files: ['**/*', '!public/qemu/win/**', '!public/qemu/lin/**', '!public/qemu/mac/**'],
          // SIGN env (SIGN !== 'false'): signExecutable gates signtool; CSC_LINK/CSC_KEY_PASSWORD supply the cert when enabled
          signExecutable: signEnabled,
          ...(signEnabled && {
            signtoolOptions: { signingHashAlgorithms: ['sha256'] },
          }),
        },
        ...(signEnabled && { afterSign: 'scripts/notarize.cjs' }),
      },
    },

    // Full list of options: https://v2.quasar.dev/quasar-cli-vite/developing-browser-extensions/configuring-bex
    bex: {
      // extendBexScriptsConf (esbuildConf) {},
      // extendBexManifestJson (json) {},

      /**
       * The list of extra scripts (js/ts) not in your bex manifest that you want to
       * compile and use in your browser extension. Maybe dynamic use them?
       *
       * Each entry in the list should be a relative filename to /src-bex/
       *
       * @example [ 'my-script.ts', 'sub-folder/my-other-script.js' ]
       */
      extraScripts: []
    }
  }
});
