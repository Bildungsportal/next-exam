// Configuration for your app
// https://v2.quasar.dev/quasar-cli-vite/quasar-config-file

import { defineConfig } from '@quasar/app-vite/wrappers';
import path from 'path';
import { fileURLToPath } from 'url';
import { builtinModules } from 'module';
import fse from 'fs-extra';
import pkg from './package.json';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pdfjsLegacyPdf = path.resolve(__dirname, 'node_modules/pdfjs-dist/legacy/build/pdf.mjs');
const pdfjsLegacyWorker = path.resolve(__dirname, 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');

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
        node: 'node20'
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
        viteConf.build.chunkSizeWarningLimit = 1500;
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
              let out = html.replace(/(["'])\/src\/assets/g, '$1./src/assets');
              out = out.replace(/href=["']public\//g, 'href="./');
              return out;
            },
            generateBundle (_, bundle) {
              const rewrite = (s) => s.replace(/"\/src\/assets/g, '"./src/assets').replace(/'\/src\/assets/g, "'./src/assets");
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
        asar: { smartUnpack: true },
        afterPack: 'scripts/afterpack.js',
        asarUnpack: [
          'public/**/*',
          'node_modules/get-windows/**/*',
        ],
        directories: { output: `../release/${version}.${buildNumber}_${artifactDate}` },
        compression: 'normal',
        linux: {
          target: 'AppImage',
          category: 'Utility',
          icon: 'public/icons/256x256.png',
          artifactName: artifactNamePattern,
          // Quasar UnPackaged root has electron-main.js, index.html, preload/, assets/ – include all, exclude other platforms’ JRE
          files: ['**/*', '!public/minimal-jre-11-win/**', '!public/minimal-jre-11-mac/**', '!public/minimal-jre-11-mac-arm64/**'],
        },
        mac: {
          icon: 'public/icons/icon.png',
          artifactName: artifactNamePattern,
          hardenedRuntime: true,
          gatekeeperAssess: false,
          entitlements: 'scripts/entitlements.mac.plist',
          entitlementsInherit: 'scripts/entitlements.mac.plist',
          category: 'public.app-category.utilities',
          target: { target: 'dmg', arch: ['x64', 'arm64'] },
          files: ['**/*', '!public/minimal-jre-11-win/**', '!public/minimal-jre-11-lin/**'],
        },
        dmg: { sign: false },
        portable: { useZip: false, unpackDirName: 'next-exam-student', splashImage: 'public/splash.bmp' },
        msi: {
          perMachine: true,
          createDesktopShortcut: true,
          createStartMenuShortcut: true,
          upgradeCode: '95a8e931-7946-44c5-9a9c-ec31d1553b03',
          shortcutName: 'Next-Exam Student',
        },
        win: {
          icon: 'public/icons/icon.ico',
          target: [{ target: 'portable', arch: ['x64'] }, { target: 'msi', arch: ['x64'] }],
          artifactName: artifactNamePattern,
          files: ['**/*', '!public/minimal-jre-11-mac/**', '!public/minimal-jre-11-mac-arm64/**', '!public/minimal-jre-11-lin/**'],
          ...(signEnabled && {
            sign: true,
            signtoolOptions: { certificateSubjectName: 'OSOS Austria', signingHashAlgorithms: ['sha256'] },
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
