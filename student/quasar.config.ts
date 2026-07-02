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
// electron-builder rejects CSC_NAME with "Developer ID Application:" prefix; codesign scripts use SHAID (full name ok)
if (process.env.CSC_NAME?.startsWith('Developer ID Application:')) {
  process.env.CSC_NAME = process.env.CSC_NAME.replace(/^Developer ID Application:\s*/, '').trim();
}

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

const productName = process.env.PRODUCT_NAME || pkg.name || 'Next-Exam-Student';
const version = process.env.VERSION || pkg.version || '2.0.0';
const buildNumber = process.env.BUILD_NUMBER || '1';
const artifactDate = buildDate;
const artifactNamePattern = `${productName}_${version}.${buildNumber}_${artifactDate}_\${arch}.\${ext}`;
const signEnabled = process.env.SIGN !== 'false';
// electron-builder builds every entry in win.target; NXE_EB_WIN_TARGET selects portable vs msi (see package.json scripts)
const winEbTarget = process.env.NXE_EB_WIN_TARGET === 'msi'
  ? [{ target: 'msi', arch: ['x64'] as const }]
  : [{ target: 'portable', arch: ['x64'] as const }];
const macEbArch = process.env.NXE_EB_MAC_ARCH === 'arm64'
  ? (['arm64'] as const)
  : (['x64'] as const);

// renderer-only deps (+ their transitive deps): Vite bundles them into the renderer chunks,
// so the raw node_modules copies electron-builder would otherwise pack into the asar are dead weight.
// Verified none are reachable from the main-process require graph (incl. peer/optional deps).
const rendererOnlyAsarExcludes = [
  '!node_modules/@babel/runtime/**',
  '!node_modules/@popperjs/core/**',
  '!node_modules/@quasar/extras/**',
  '!node_modules/@remirror/core-constants/**',
  '!node_modules/@tiptap/**',
  '!node_modules/@types/hast/**',
  '!node_modules/@types/linkify-it/**',
  '!node_modules/@types/markdown-it/**',
  '!node_modules/@types/mdurl/**',
  '!node_modules/@types/raf/**',
  '!node_modules/@types/trusted-types/**',
  '!node_modules/@types/unist/**',
  '!node_modules/atob/**',
  '!node_modules/base64-arraybuffer/**',
  '!node_modules/bootstrap/**',
  '!node_modules/btoa/**',
  '!node_modules/canvg/**',
  '!node_modules/core-js/**',
  '!node_modules/crelt/**',
  '!node_modules/css-line-break/**',
  '!node_modules/dequal/**',
  '!node_modules/devlop/**',
  '!node_modules/dompurify/**',
  '!node_modules/es6-promise/**',
  '!node_modules/escape-string-regexp/**',
  '!node_modules/highlight.js/**',
  '!node_modules/html2canvas/**',
  '!node_modules/html2pdf-jspdf2/**',
  '!node_modules/jspdf/**',
  '!node_modules/linkify-it/**',
  '!node_modules/lowlight/**',
  '!node_modules/markdown-it/**',
  '!node_modules/mdurl/**',
  '!node_modules/moment-timezone/**',
  '!node_modules/moment/**',
  '!node_modules/orderedmap/**',
  '!node_modules/performance-now/**',
  '!node_modules/prosemirror-*/**',
  '!node_modules/punycode.js/**',
  '!node_modules/quasar/**',
  '!node_modules/raf/**',
  '!node_modules/rgbcolor/**',
  '!node_modules/rope-sequence/**',
  '!node_modules/stackblur-canvas/**',
  '!node_modules/svg-pathdata/**',
  '!node_modules/sweetalert2/**',
  '!node_modules/text-segmentation/**',
  '!node_modules/tippy.js/**',
  '!node_modules/uc.micro/**',
  '!node_modules/utrie/**',
  '!node_modules/validator/**',
  '!node_modules/vue-router/**',
  '!node_modules/vue-sweetalert2/**',
  '!node_modules/w3c-keyname/**',
];

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
        browser: [ 'es2022', 'firefox115', 'chrome115' ],
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
      // rebuildCache: true, // rebuilds Vite/linter/etc cache on startup
      // publicPath: '/',
      // analyze: true,
      // env: {},
      // rawDefine: {}
      // ignorePublicFolder: true,
      // polyfillModulePreload: true,
      // distDir

      minify: true,
      showBuildSummary: false,

      extendViteConf (viteConf: any) {
        viteConf.server = viteConf.server || {};
        viteConf.server.forwardConsole = false; // Vite 8+: do not mirror browser console.warn/error to the dev-server terminal (avoids duplicate lines with electron-log).
        // Suppress SASS deprecation warnings for Bootstrap color functions
        viteConf.css = viteConf.css || {};
        viteConf.css.preprocessorOptions = viteConf.css.preprocessorOptions || {};
        viteConf.css.preprocessorOptions.scss = viteConf.css.preprocessorOptions.scss || {};
        viteConf.css.preprocessorOptions.scss.silenceDeprecations = ['color-functions', 'if-function'];
        // Resolve pdfjs-dist legacy build (package has no exports for legacy subpath)
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
        // Ensure single copy of TipTap/ProseMirror to avoid "Duplicate use of selection JSON ID gapcursor"
        viteConf.resolve.dedupe = viteConf.resolve.dedupe || [];
        [ '@tiptap/pm', '@tiptap/core', '@tiptap/vue-3', '@tiptap/extension-gapcursor' ].forEach((pkg) => {
          if (!viteConf.resolve.dedupe.includes(pkg)) viteConf.resolve.dedupe.push(pkg);
        });
        viteConf.optimizeDeps = viteConf.optimizeDeps || {};
        viteConf.optimizeDeps.include = viteConf.optimizeDeps.include || [];
        viteConf.optimizeDeps.include.push('pdfjs-dist');
        viteConf.build = viteConf.build || {};
        viteConf.build.chunkSizeWarningLimit = 8000;
        // Electron: build renderer into public/ so one copy – no duplication; base ./ so relative paths work from public/index.html
        if (ctx.mode.electron && ctx.prod) {
          const baseOut = viteConf.build?.outDir ?? path.join(__dirname, 'dist', 'electron', 'UnPackaged');
          const publicOut = path.join(baseOut, 'public');
          viteConf.build.outDir = publicOut;
          viteConf.base = './';
          viteConf.publicDir = path.resolve(__dirname, 'public');
          const srcAssetsDir = path.resolve(__dirname, 'src', 'assets');
          viteConf.plugins = viteConf.plugins || [];
          viteConf.plugins.push({
            name: 'quasar-electron-public-folder',
            closeBundle () {
              fse.copySync(srcAssetsDir, path.join(publicOut, 'src', 'assets'));
            }
          });
          viteConf.plugins.push({
            name: 'quasar-electron-rewrite-assets',
            transformIndexHtml: (html) => {
              let out = html.replace(/([`"'])\/src\/assets/g, '$1./src/assets');
              out = out.replace(/href=["']public\//g, 'href="./');
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
      port: 9300,
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

      bundler: 'builder', // 'packager' or 'builder'
      nodeIntegration: true,
      packager: {
        // https://github.com/electron-userland/electron-packager/blob/master/docs/api.md#options

        // OS X / Mac App Store
        // appBundleId: '',
        // appCategoryType: '',
        // osxSign: '',
        // protocol: 'myapp://path',

        // Windows only
        // win32metadata: { ... }
      },

      builder: {
        appId: 'com.nextexam.student',
        productName,
        buildVersion: `${version}.${buildNumber}`,
        // disable implicit CI publishing (removed in electron-builder v27)
        publish: null,
        asar: { smartUnpack: true },
        beforePack: 'scripts/beforepack.js',
        afterPack: 'scripts/afterpack.js',
        asarUnpack: [
          'public/**/*',
        ],
        extraResources: [
          { from: 'src-electron/resources/linux', to: 'linux' },
          { from: 'src-electron/resources/win32', to: 'win32' },
          // vncproxy-helper runs as a plain node process (ELECTRON_RUN_AS_NODE) -> cannot require from app.asar;
          // ship it + its only dep (ws, pure JS) unpacked so require('ws') resolves next to the helper
          { from: 'src-electron/main/scripts/vncproxy-helper.cjs', to: 'vncproxy/vncproxy-helper.cjs' },
          { from: 'node_modules/ws', to: 'vncproxy/node_modules/ws' },
          // assessment-helper.app = .app bundle (embedded profile authorizes restricted AAC entitlement); wifi-helper = plain CLI
          ...['assessment-helper.app']
            .filter((name) => fse.existsSync(path.join(__dirname, 'scripts/apple', name)))
            .map((name) => ({ from: `scripts/apple/${name}`, to: `apple/${name}` })),
        ],
        // directories.output is overridden by quasar to dist/electron/Packaged - cannot change here
        compression: 'normal',
        // ship only finnish/english/german Chromium UI locales (prunes locales/*.pak)
        electronLanguages: ['fi', 'en-US', 'en-GB', 'de'],
        linux: {
          target: 'AppImage',
          category: 'Utility',
          icon: 'public/icons/256x256.png',
          artifactName: artifactNamePattern,
          // Quasar UnPackaged root has electron-main.js, index.html, preload/, assets/ – include all, exclude other platforms’ JRE
          files: ['**/*', '!public/minimal-jre-11-win/**', '!public/minimal-jre-11-mac/**', '!public/minimal-jre-11-mac-arm64/**', '!public/qemu/win/**', '!public/qemu/mac/**', ...rendererOnlyAsarExcludes],
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
          files: ['**/*', '!public/minimal-jre-11-win/**', '!public/minimal-jre-11-lin/**', '!public/qemu/win/**', '!public/qemu/lin/**', ...rendererOnlyAsarExcludes],
        },
        dmg: { sign: false },
        portable: { useZip: true, unpackDirName: 'next-exam-student', splashImage: 'public/splash.bmp' },
        msi: {
          perMachine: true,
          createDesktopShortcut: true,
          createStartMenuShortcut: true,
          upgradeCode: '95a8e931-7946-44c5-9a9c-ec31d1553b03',
          shortcutName: 'Next-Exam Student',
        },
        win: {
          icon: 'public/icons/icon.ico',
          target: winEbTarget,
          artifactName: artifactNamePattern,
          files: ['**/*', '!public/minimal-jre-11-mac/**', '!public/minimal-jre-11-mac-arm64/**', '!public/minimal-jre-11-lin/**', '!public/qemu/win/**', '!public/qemu/lin/**', '!public/qemu/mac/**', ...rendererOnlyAsarExcludes],
          // SIGN env (SIGN !== 'false'): signAndEditExecutable gates signtool on electron-builder 25.x (Quasar dep); use signExecutable on eb 26+
          signAndEditExecutable: signEnabled,
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
