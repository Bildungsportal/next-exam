// packages/renderer/vite.config.ts
import { defineConfig } from "file:///home/valueerror/STUFF/DEV/00-Next-Exam-DEV/next-exam/student/node_modules/vite/dist/node/index.js";
import vue from "file:///home/valueerror/STUFF/DEV/00-Next-Exam-DEV/next-exam/student/node_modules/@vitejs/plugin-vue/dist/index.mjs";

// package.json
var package_default = {
  name: "next-exam-student",
  version: "1.1.0",
  main: "dist/main/main.mjs",
  author: {
    name: "Thomas Michael Weissel",
    email: "valueerror@gmail.com",
    url: "https://next-exam.at"
  },
  homepage: "https://next-exam.at",
  license: "GPL-3.0",
  description: "An exam managment tool for digital exams",
  type: "module",
  scripts: {
    dev: "npm run prebuild && node scripts/watch.mjs",
    clean: "rm -rf ./dist",
    cleanwin: "rmdir /s /q dist",
    prebuild: "node scripts/prebuild.js",
    build: "npm run clean && node scripts/build.mjs && electron-builder -l",
    "build:mac": "npm run prebuild && npm run clean && node scripts/build.mjs && electron-builder -m",
    "build:win": "npm run prebuild && npm run cleanwin && node scripts/build.mjs && electron-builder -w"
  },
  engines: {
    node: ">=22.0.0"
  },
  devDependencies: {
    "@intlify/unplugin-vue-i18n": "^5.0.0",
    "@vitejs/plugin-vue": "^5.1.4",
    electron: "^32.1.2",
    "electron-builder": "^25.0.5",
    nodemon: "^3.1.6",
    typescript: "^5.6.2",
    vite: "^5.4.6",
    "vite-plugin-commonjs": "^0.10.3",
    "vite-plugin-resolve": "^2.5.2",
    vue: "^3.5.6"
  },
  env: {
    "//": "Used in build scripts",
    PORT: 3001
  },
  keywords: [
    "vite",
    "electron",
    "vue3",
    "rollup"
  ],
  dependencies: {
    "@jimp/jpeg": "^0.22.12",
    "@squoosh/lib": "^0.3.1",
    "@tiptap/extension-blockquote": "^2.10.3",
    "@tiptap/extension-bold": "^2.10.3",
    "@tiptap/extension-bullet-list": "^2.10.3",
    "@tiptap/extension-character-count": "^2.10.3",
    "@tiptap/extension-code": "^2.10.3",
    "@tiptap/extension-code-block-lowlight": "^2.10.3",
    "@tiptap/extension-color": "^2.10.3",
    "@tiptap/extension-document": "^2.10.3",
    "@tiptap/extension-dropcursor": "^2.10.3",
    "@tiptap/extension-gapcursor": "^2.10.3",
    "@tiptap/extension-hard-break": "^2.10.3",
    "@tiptap/extension-heading": "^2.10.3",
    "@tiptap/extension-history": "^2.10.3",
    "@tiptap/extension-horizontal-rule": "^2.10.3",
    "@tiptap/extension-image": "^2.10.3",
    "@tiptap/extension-italic": "^2.10.3",
    "@tiptap/extension-list-item": "^2.10.3",
    "@tiptap/extension-ordered-list": "^2.10.3",
    "@tiptap/extension-paragraph": "^2.10.3",
    "@tiptap/extension-strike": "^2.10.3",
    "@tiptap/extension-subscript": "^2.10.3",
    "@tiptap/extension-superscript": "^2.10.3",
    "@tiptap/extension-table": "^2.10.3",
    "@tiptap/extension-table-cell": "^2.10.3",
    "@tiptap/extension-table-header": "^2.10.3",
    "@tiptap/extension-table-row": "^2.10.3",
    "@tiptap/extension-text": "^2.10.3",
    "@tiptap/extension-text-align": "^2.10.3",
    "@tiptap/extension-text-style": "^2.10.3",
    "@tiptap/extension-typography": "^2.10.3",
    "@tiptap/extension-underline": "^2.10.3",
    "@tiptap/vue-3": "^2.10.3",
    archiver: "^5.3.2",
    bootstrap: "^5.3.3",
    cors: "^2.8.5",
    "cross-env": "^7.0.3",
    "default-gateway": "^7.2.2",
    dexie: "^4.0.8",
    dompurify: "^3.1.6",
    "electron-audio": "^0.1.0",
    "electron-log": "^5.2.0",
    esbuild: "^0.23.1",
    express: "^4.21.0",
    "express-fileupload": "^1.5.1",
    "extract-zip": "^2.0.1",
    "find-process": "^1.4.10",
    fs: "^0.0.1-security",
    "get-windows": "^9.2.0",
    "html2pdf-jspdf2": "^0.1.2",
    "image-js": "^0.35.6",
    ip: "^2.0.1",
    jimp: "^1.6.0",
    lowlight: "^3.1.0",
    mammoth: "^1.8.0",
    "moment-timezone": "^0.5.45",
    "node-fetch": "^3.3.2",
    "node-forge": "^1.3.1",
    "node-notifier": "^10.0.1",
    "node-wifi": "^2.0.16",
    "play-sound": "^1.1.6",
    "ps-tree": "^1.2.0",
    sass: "1.50.0",
    "screenshot-desktop-wayland": "^1.15.2",
    sharp: "^0.33.5",
    "simple-get": "^4.0.1",
    "tesseract.js": "^6.0.0",
    validator: "^13.12.0",
    vue: "^3.5.6",
    "vue-i18n": "^10.0.1",
    "vue-router": "^4.4.5",
    "vue-sweetalert2": "^5.0.11"
  },
  overrides: {
    "signal-exit": "3.0.7",
    "ml-regression-simple-linear": "2.0.5",
    tiff: "5.0.3"
  },
  buildNumber: "1",
  buildVersion: "1.1.0.1"
};

// packages/renderer/vite.config.ts
import VueI18nPlugin from "file:///home/valueerror/STUFF/DEV/00-Next-Exam-DEV/next-exam/student/node_modules/@intlify/unplugin-vue-i18n/lib/vite.mjs";
import path from "path";
var __vite_injected_original_dirname = "/home/valueerror/STUFF/DEV/00-Next-Exam-DEV/next-exam/student/packages/renderer";
var vite_config_default = defineConfig({
  define: {
    // ... andere definierte Werte
    "__VUE_PROD_HYDRATION_MISMATCH_DETAILS__": false,
    // oder true, je nach Bedarf
    "__VUE_PROD_DEVTOOLS__": false
  },
  mode: process.env.NODE_ENV,
  root: __vite_injected_original_dirname,
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag === "webview"
        }
      }
    }),
    VueI18nPlugin({
      compositionOnly: false,
      include: path.resolve(__vite_injected_original_dirname, "./locales/*"),
      runtimeOnly: false,
      fullInstall: true,
      forceStringify: true
    })
  ],
  base: "./",
  build: {
    sourcemap: true,
    outDir: "../../dist/renderer",
    emptyOutDir: true,
    minify: true,
    chunkSizeWarningLimit: 5e3
  },
  css: {
    // this covers bootstrap css warnings when minifying the css code
    postcss: {
      plugins: [
        {
          postcssPlugin: "internal:charset-removal",
          AtRule: {
            charset: (atRule) => {
              if (atRule.name === "charset") {
                atRule.remove();
              }
            }
          }
        },
        // New plugin to remove source map URL
        {
          postcssPlugin: "remove-source-map-url",
          Once(css) {
            css.walkComments((comment) => {
              if (comment.text.includes("sourceMappingURL")) {
                comment.remove();
              }
            });
          }
        }
      ]
    }
  },
  server: {
    port: package_default.env.PORT
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsicGFja2FnZXMvcmVuZGVyZXIvdml0ZS5jb25maWcudHMiLCAicGFja2FnZS5qc29uIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL2hvbWUvdmFsdWVlcnJvci9TVFVGRi9ERVYvMDAtTmV4dC1FeGFtLURFVi9uZXh0LWV4YW0vc3R1ZGVudC9wYWNrYWdlcy9yZW5kZXJlclwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL2hvbWUvdmFsdWVlcnJvci9TVFVGRi9ERVYvMDAtTmV4dC1FeGFtLURFVi9uZXh0LWV4YW0vc3R1ZGVudC9wYWNrYWdlcy9yZW5kZXJlci92aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vaG9tZS92YWx1ZWVycm9yL1NUVUZGL0RFVi8wMC1OZXh0LUV4YW0tREVWL25leHQtZXhhbS9zdHVkZW50L3BhY2thZ2VzL3JlbmRlcmVyL3ZpdGUuY29uZmlnLnRzXCI7XG5pbXBvcnQgeyBkZWZpbmVDb25maWcsIFBsdWdpbiB9IGZyb20gJ3ZpdGUnXG5pbXBvcnQgdnVlIGZyb20gJ0B2aXRlanMvcGx1Z2luLXZ1ZSdcbmltcG9ydCBwa2cgZnJvbSAnLi4vLi4vcGFja2FnZS5qc29uJ1xuXG5pbXBvcnQgVnVlSTE4blBsdWdpbiBmcm9tICdAaW50bGlmeS91bnBsdWdpbi12dWUtaTE4bi92aXRlJ1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCdcblxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgZGVmaW5lOiB7XG4gICAgLy8gLi4uIGFuZGVyZSBkZWZpbmllcnRlIFdlcnRlXG4gICAgJ19fVlVFX1BST0RfSFlEUkFUSU9OX01JU01BVENIX0RFVEFJTFNfXyc6IGZhbHNlLCAvLyBvZGVyIHRydWUsIGplIG5hY2ggQmVkYXJmXG4gICAgJ19fVlVFX1BST0RfREVWVE9PTFNfXyc6IGZhbHNlXG4gIH0sXG4gIG1vZGU6IHByb2Nlc3MuZW52Lk5PREVfRU5WLFxuICByb290OiBfX2Rpcm5hbWUsXG4gIHBsdWdpbnM6IFtcbiAgICB2dWUoe1xuICAgICAgdGVtcGxhdGU6IHtcbiAgICAgICAgY29tcGlsZXJPcHRpb25zOiB7XG4gICAgICAgICAgaXNDdXN0b21FbGVtZW50OiB0YWcgPT4gdGFnID09PSAnd2VidmlldydcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pLFxuICAgIFZ1ZUkxOG5QbHVnaW4oe1xuICAgICAgICBjb21wb3NpdGlvbk9ubHk6IGZhbHNlLFxuICAgICAgICBpbmNsdWRlOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi9sb2NhbGVzLyonKSxcbiAgICAgICAgcnVudGltZU9ubHk6IGZhbHNlLFxuICAgICAgICBmdWxsSW5zdGFsbDogdHJ1ZSxcbiAgICAgICAgZm9yY2VTdHJpbmdpZnkgOiB0cnVlLFxuICAgICAgfSlcbiAgXSxcbiAgYmFzZTogJy4vJyxcbiBcbiAgYnVpbGQ6IHtcbiAgICBzb3VyY2VtYXA6IHRydWUsXG4gICAgb3V0RGlyOiAnLi4vLi4vZGlzdC9yZW5kZXJlcicsXG4gICAgZW1wdHlPdXREaXI6IHRydWUsXG4gICAgbWluaWZ5OiB0cnVlLFxuICAgIGNodW5rU2l6ZVdhcm5pbmdMaW1pdDo1MDAwLFxuICB9LFxuICBjc3M6IHsgICAvLyB0aGlzIGNvdmVycyBib290c3RyYXAgY3NzIHdhcm5pbmdzIHdoZW4gbWluaWZ5aW5nIHRoZSBjc3MgY29kZVxuICAgIHBvc3Rjc3M6IHtcbiAgICAgIHBsdWdpbnM6IFtcbiAgICAgICAge1xuICAgICAgICAgIHBvc3Rjc3NQbHVnaW46ICdpbnRlcm5hbDpjaGFyc2V0LXJlbW92YWwnLFxuICAgICAgICAgIEF0UnVsZToge1xuICAgICAgICAgICAgY2hhcnNldDogKGF0UnVsZSkgPT4ge1xuICAgICAgICAgICAgICBpZiAoYXRSdWxlLm5hbWUgPT09ICdjaGFyc2V0Jykge1xuICAgICAgICAgICAgICAgIGF0UnVsZS5yZW1vdmUoKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgLy8gTmV3IHBsdWdpbiB0byByZW1vdmUgc291cmNlIG1hcCBVUkxcbiAgICAgICAge1xuICAgICAgICAgIHBvc3Rjc3NQbHVnaW46ICdyZW1vdmUtc291cmNlLW1hcC11cmwnLFxuICAgICAgICAgIE9uY2UoY3NzKSB7XG4gICAgICAgICAgICBjc3Mud2Fsa0NvbW1lbnRzKGNvbW1lbnQgPT4ge1xuICAgICAgICAgICAgICBpZiAoY29tbWVudC50ZXh0LmluY2x1ZGVzKCdzb3VyY2VNYXBwaW5nVVJMJykpIHtcbiAgICAgICAgICAgICAgICBjb21tZW50LnJlbW92ZSgpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIF1cbiAgICB9XG4gIH0sXG4gIHNlcnZlcjoge1xuICAgIHBvcnQ6IHBrZy5lbnYuUE9SVCxcbiAgfSxcbn0pXG4iLCAie1xuICBcIm5hbWVcIjogXCJuZXh0LWV4YW0tc3R1ZGVudFwiLFxuICBcInZlcnNpb25cIjogXCIxLjEuMFwiLFxuICBcIm1haW5cIjogXCJkaXN0L21haW4vbWFpbi5tanNcIixcbiAgXCJhdXRob3JcIjoge1xuICAgIFwibmFtZVwiOiBcIlRob21hcyBNaWNoYWVsIFdlaXNzZWxcIixcbiAgICBcImVtYWlsXCI6IFwidmFsdWVlcnJvckBnbWFpbC5jb21cIixcbiAgICBcInVybFwiOiBcImh0dHBzOi8vbmV4dC1leGFtLmF0XCJcbiAgfSxcbiAgXCJob21lcGFnZVwiOiBcImh0dHBzOi8vbmV4dC1leGFtLmF0XCIsXG4gIFwibGljZW5zZVwiOiBcIkdQTC0zLjBcIixcbiAgXCJkZXNjcmlwdGlvblwiOiBcIkFuIGV4YW0gbWFuYWdtZW50IHRvb2wgZm9yIGRpZ2l0YWwgZXhhbXNcIixcbiAgXCJ0eXBlXCI6IFwibW9kdWxlXCIsXG4gIFwic2NyaXB0c1wiOiB7XG4gICAgXCJkZXZcIjogXCJucG0gcnVuIHByZWJ1aWxkICYmIG5vZGUgc2NyaXB0cy93YXRjaC5tanNcIixcbiAgICBcImNsZWFuXCI6IFwicm0gLXJmIC4vZGlzdFwiLFxuICAgIFwiY2xlYW53aW5cIjogXCJybWRpciAvcyAvcSBkaXN0XCIsXG4gICAgXCJwcmVidWlsZFwiOiBcIm5vZGUgc2NyaXB0cy9wcmVidWlsZC5qc1wiLFxuICAgIFwiYnVpbGRcIjogXCJucG0gcnVuIGNsZWFuICYmIG5vZGUgc2NyaXB0cy9idWlsZC5tanMgJiYgZWxlY3Ryb24tYnVpbGRlciAtbFwiLFxuICAgIFwiYnVpbGQ6bWFjXCI6IFwibnBtIHJ1biBwcmVidWlsZCAmJiBucG0gcnVuIGNsZWFuICYmIG5vZGUgc2NyaXB0cy9idWlsZC5tanMgJiYgZWxlY3Ryb24tYnVpbGRlciAtbVwiLFxuICAgIFwiYnVpbGQ6d2luXCI6IFwibnBtIHJ1biBwcmVidWlsZCAmJiBucG0gcnVuIGNsZWFud2luICYmIG5vZGUgc2NyaXB0cy9idWlsZC5tanMgJiYgZWxlY3Ryb24tYnVpbGRlciAtd1wiXG4gIH0sXG4gIFwiZW5naW5lc1wiOiB7XG4gICAgXCJub2RlXCI6IFwiPj0yMi4wLjBcIlxuICB9LFxuICBcImRldkRlcGVuZGVuY2llc1wiOiB7XG4gICAgXCJAaW50bGlmeS91bnBsdWdpbi12dWUtaTE4blwiOiBcIl41LjAuMFwiLFxuICAgIFwiQHZpdGVqcy9wbHVnaW4tdnVlXCI6IFwiXjUuMS40XCIsXG4gICAgXCJlbGVjdHJvblwiOiBcIl4zMi4xLjJcIixcbiAgICBcImVsZWN0cm9uLWJ1aWxkZXJcIjogXCJeMjUuMC41XCIsXG4gICAgXCJub2RlbW9uXCI6IFwiXjMuMS42XCIsXG4gICAgXCJ0eXBlc2NyaXB0XCI6IFwiXjUuNi4yXCIsXG4gICAgXCJ2aXRlXCI6IFwiXjUuNC42XCIsXG4gICAgXCJ2aXRlLXBsdWdpbi1jb21tb25qc1wiOiBcIl4wLjEwLjNcIixcbiAgICBcInZpdGUtcGx1Z2luLXJlc29sdmVcIjogXCJeMi41LjJcIixcbiAgICBcInZ1ZVwiOiBcIl4zLjUuNlwiXG4gIH0sXG4gIFwiZW52XCI6IHtcbiAgICBcIi8vXCI6IFwiVXNlZCBpbiBidWlsZCBzY3JpcHRzXCIsXG4gICAgXCJQT1JUXCI6IDMwMDFcbiAgfSxcbiAgXCJrZXl3b3Jkc1wiOiBbXG4gICAgXCJ2aXRlXCIsXG4gICAgXCJlbGVjdHJvblwiLFxuICAgIFwidnVlM1wiLFxuICAgIFwicm9sbHVwXCJcbiAgXSxcbiAgXCJkZXBlbmRlbmNpZXNcIjoge1xuICAgIFwiQGppbXAvanBlZ1wiOiBcIl4wLjIyLjEyXCIsXG4gICAgXCJAc3F1b29zaC9saWJcIjogXCJeMC4zLjFcIixcbiAgICBcIkB0aXB0YXAvZXh0ZW5zaW9uLWJsb2NrcXVvdGVcIjogXCJeMi4xMC4zXCIsXG4gICAgXCJAdGlwdGFwL2V4dGVuc2lvbi1ib2xkXCI6IFwiXjIuMTAuM1wiLFxuICAgIFwiQHRpcHRhcC9leHRlbnNpb24tYnVsbGV0LWxpc3RcIjogXCJeMi4xMC4zXCIsXG4gICAgXCJAdGlwdGFwL2V4dGVuc2lvbi1jaGFyYWN0ZXItY291bnRcIjogXCJeMi4xMC4zXCIsXG4gICAgXCJAdGlwdGFwL2V4dGVuc2lvbi1jb2RlXCI6IFwiXjIuMTAuM1wiLFxuICAgIFwiQHRpcHRhcC9leHRlbnNpb24tY29kZS1ibG9jay1sb3dsaWdodFwiOiBcIl4yLjEwLjNcIixcbiAgICBcIkB0aXB0YXAvZXh0ZW5zaW9uLWNvbG9yXCI6IFwiXjIuMTAuM1wiLFxuICAgIFwiQHRpcHRhcC9leHRlbnNpb24tZG9jdW1lbnRcIjogXCJeMi4xMC4zXCIsXG4gICAgXCJAdGlwdGFwL2V4dGVuc2lvbi1kcm9wY3Vyc29yXCI6IFwiXjIuMTAuM1wiLFxuICAgIFwiQHRpcHRhcC9leHRlbnNpb24tZ2FwY3Vyc29yXCI6IFwiXjIuMTAuM1wiLFxuICAgIFwiQHRpcHRhcC9leHRlbnNpb24taGFyZC1icmVha1wiOiBcIl4yLjEwLjNcIixcbiAgICBcIkB0aXB0YXAvZXh0ZW5zaW9uLWhlYWRpbmdcIjogXCJeMi4xMC4zXCIsXG4gICAgXCJAdGlwdGFwL2V4dGVuc2lvbi1oaXN0b3J5XCI6IFwiXjIuMTAuM1wiLFxuICAgIFwiQHRpcHRhcC9leHRlbnNpb24taG9yaXpvbnRhbC1ydWxlXCI6IFwiXjIuMTAuM1wiLFxuICAgIFwiQHRpcHRhcC9leHRlbnNpb24taW1hZ2VcIjogXCJeMi4xMC4zXCIsXG4gICAgXCJAdGlwdGFwL2V4dGVuc2lvbi1pdGFsaWNcIjogXCJeMi4xMC4zXCIsXG4gICAgXCJAdGlwdGFwL2V4dGVuc2lvbi1saXN0LWl0ZW1cIjogXCJeMi4xMC4zXCIsXG4gICAgXCJAdGlwdGFwL2V4dGVuc2lvbi1vcmRlcmVkLWxpc3RcIjogXCJeMi4xMC4zXCIsXG4gICAgXCJAdGlwdGFwL2V4dGVuc2lvbi1wYXJhZ3JhcGhcIjogXCJeMi4xMC4zXCIsXG4gICAgXCJAdGlwdGFwL2V4dGVuc2lvbi1zdHJpa2VcIjogXCJeMi4xMC4zXCIsXG4gICAgXCJAdGlwdGFwL2V4dGVuc2lvbi1zdWJzY3JpcHRcIjogXCJeMi4xMC4zXCIsXG4gICAgXCJAdGlwdGFwL2V4dGVuc2lvbi1zdXBlcnNjcmlwdFwiOiBcIl4yLjEwLjNcIixcbiAgICBcIkB0aXB0YXAvZXh0ZW5zaW9uLXRhYmxlXCI6IFwiXjIuMTAuM1wiLFxuICAgIFwiQHRpcHRhcC9leHRlbnNpb24tdGFibGUtY2VsbFwiOiBcIl4yLjEwLjNcIixcbiAgICBcIkB0aXB0YXAvZXh0ZW5zaW9uLXRhYmxlLWhlYWRlclwiOiBcIl4yLjEwLjNcIixcbiAgICBcIkB0aXB0YXAvZXh0ZW5zaW9uLXRhYmxlLXJvd1wiOiBcIl4yLjEwLjNcIixcbiAgICBcIkB0aXB0YXAvZXh0ZW5zaW9uLXRleHRcIjogXCJeMi4xMC4zXCIsXG4gICAgXCJAdGlwdGFwL2V4dGVuc2lvbi10ZXh0LWFsaWduXCI6IFwiXjIuMTAuM1wiLFxuICAgIFwiQHRpcHRhcC9leHRlbnNpb24tdGV4dC1zdHlsZVwiOiBcIl4yLjEwLjNcIixcbiAgICBcIkB0aXB0YXAvZXh0ZW5zaW9uLXR5cG9ncmFwaHlcIjogXCJeMi4xMC4zXCIsXG4gICAgXCJAdGlwdGFwL2V4dGVuc2lvbi11bmRlcmxpbmVcIjogXCJeMi4xMC4zXCIsXG4gICAgXCJAdGlwdGFwL3Z1ZS0zXCI6IFwiXjIuMTAuM1wiLFxuICAgIFwiYXJjaGl2ZXJcIjogXCJeNS4zLjJcIixcbiAgICBcImJvb3RzdHJhcFwiOiBcIl41LjMuM1wiLFxuICAgIFwiY29yc1wiOiBcIl4yLjguNVwiLFxuICAgIFwiY3Jvc3MtZW52XCI6IFwiXjcuMC4zXCIsXG4gICAgXCJkZWZhdWx0LWdhdGV3YXlcIjogXCJeNy4yLjJcIixcbiAgICBcImRleGllXCI6IFwiXjQuMC44XCIsXG4gICAgXCJkb21wdXJpZnlcIjogXCJeMy4xLjZcIixcbiAgICBcImVsZWN0cm9uLWF1ZGlvXCI6IFwiXjAuMS4wXCIsXG4gICAgXCJlbGVjdHJvbi1sb2dcIjogXCJeNS4yLjBcIixcbiAgICBcImVzYnVpbGRcIjogXCJeMC4yMy4xXCIsXG4gICAgXCJleHByZXNzXCI6IFwiXjQuMjEuMFwiLFxuICAgIFwiZXhwcmVzcy1maWxldXBsb2FkXCI6IFwiXjEuNS4xXCIsXG4gICAgXCJleHRyYWN0LXppcFwiOiBcIl4yLjAuMVwiLFxuICAgIFwiZmluZC1wcm9jZXNzXCI6IFwiXjEuNC4xMFwiLFxuICAgIFwiZnNcIjogXCJeMC4wLjEtc2VjdXJpdHlcIixcbiAgICBcImdldC13aW5kb3dzXCI6IFwiXjkuMi4wXCIsXG4gICAgXCJodG1sMnBkZi1qc3BkZjJcIjogXCJeMC4xLjJcIixcbiAgICBcImltYWdlLWpzXCI6IFwiXjAuMzUuNlwiLFxuICAgIFwiaXBcIjogXCJeMi4wLjFcIixcbiAgICBcImppbXBcIjogXCJeMS42LjBcIixcbiAgICBcImxvd2xpZ2h0XCI6IFwiXjMuMS4wXCIsXG4gICAgXCJtYW1tb3RoXCI6IFwiXjEuOC4wXCIsXG4gICAgXCJtb21lbnQtdGltZXpvbmVcIjogXCJeMC41LjQ1XCIsXG4gICAgXCJub2RlLWZldGNoXCI6IFwiXjMuMy4yXCIsXG4gICAgXCJub2RlLWZvcmdlXCI6IFwiXjEuMy4xXCIsXG4gICAgXCJub2RlLW5vdGlmaWVyXCI6IFwiXjEwLjAuMVwiLFxuICAgIFwibm9kZS13aWZpXCI6IFwiXjIuMC4xNlwiLFxuICAgIFwicGxheS1zb3VuZFwiOiBcIl4xLjEuNlwiLFxuICAgIFwicHMtdHJlZVwiOiBcIl4xLjIuMFwiLFxuICAgIFwic2Fzc1wiOiBcIjEuNTAuMFwiLFxuICAgIFwic2NyZWVuc2hvdC1kZXNrdG9wLXdheWxhbmRcIjogXCJeMS4xNS4yXCIsXG4gICAgXCJzaGFycFwiOiBcIl4wLjMzLjVcIixcbiAgICBcInNpbXBsZS1nZXRcIjogXCJeNC4wLjFcIixcbiAgICBcInRlc3NlcmFjdC5qc1wiOiBcIl42LjAuMFwiLFxuICAgIFwidmFsaWRhdG9yXCI6IFwiXjEzLjEyLjBcIixcbiAgICBcInZ1ZVwiOiBcIl4zLjUuNlwiLFxuICAgIFwidnVlLWkxOG5cIjogXCJeMTAuMC4xXCIsXG4gICAgXCJ2dWUtcm91dGVyXCI6IFwiXjQuNC41XCIsXG4gICAgXCJ2dWUtc3dlZXRhbGVydDJcIjogXCJeNS4wLjExXCJcbiAgfSxcbiAgXCJvdmVycmlkZXNcIjoge1xuICAgIFwic2lnbmFsLWV4aXRcIjogXCIzLjAuN1wiLFxuICAgIFwibWwtcmVncmVzc2lvbi1zaW1wbGUtbGluZWFyXCI6IFwiMi4wLjVcIixcbiAgICBcInRpZmZcIjogXCI1LjAuM1wiXG4gIH0sXG4gIFwiYnVpbGROdW1iZXJcIjogXCIxXCIsXG4gIFwiYnVpbGRWZXJzaW9uXCI6IFwiMS4xLjAuMVwiXG59XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQ0EsU0FBUyxvQkFBNEI7QUFDckMsT0FBTyxTQUFTOzs7QUNGaEI7QUFBQSxFQUNFLE1BQVE7QUFBQSxFQUNSLFNBQVc7QUFBQSxFQUNYLE1BQVE7QUFBQSxFQUNSLFFBQVU7QUFBQSxJQUNSLE1BQVE7QUFBQSxJQUNSLE9BQVM7QUFBQSxJQUNULEtBQU87QUFBQSxFQUNUO0FBQUEsRUFDQSxVQUFZO0FBQUEsRUFDWixTQUFXO0FBQUEsRUFDWCxhQUFlO0FBQUEsRUFDZixNQUFRO0FBQUEsRUFDUixTQUFXO0FBQUEsSUFDVCxLQUFPO0FBQUEsSUFDUCxPQUFTO0FBQUEsSUFDVCxVQUFZO0FBQUEsSUFDWixVQUFZO0FBQUEsSUFDWixPQUFTO0FBQUEsSUFDVCxhQUFhO0FBQUEsSUFDYixhQUFhO0FBQUEsRUFDZjtBQUFBLEVBQ0EsU0FBVztBQUFBLElBQ1QsTUFBUTtBQUFBLEVBQ1Y7QUFBQSxFQUNBLGlCQUFtQjtBQUFBLElBQ2pCLDhCQUE4QjtBQUFBLElBQzlCLHNCQUFzQjtBQUFBLElBQ3RCLFVBQVk7QUFBQSxJQUNaLG9CQUFvQjtBQUFBLElBQ3BCLFNBQVc7QUFBQSxJQUNYLFlBQWM7QUFBQSxJQUNkLE1BQVE7QUFBQSxJQUNSLHdCQUF3QjtBQUFBLElBQ3hCLHVCQUF1QjtBQUFBLElBQ3ZCLEtBQU87QUFBQSxFQUNUO0FBQUEsRUFDQSxLQUFPO0FBQUEsSUFDTCxNQUFNO0FBQUEsSUFDTixNQUFRO0FBQUEsRUFDVjtBQUFBLEVBQ0EsVUFBWTtBQUFBLElBQ1Y7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxFQUNGO0FBQUEsRUFDQSxjQUFnQjtBQUFBLElBQ2QsY0FBYztBQUFBLElBQ2QsZ0JBQWdCO0FBQUEsSUFDaEIsZ0NBQWdDO0FBQUEsSUFDaEMsMEJBQTBCO0FBQUEsSUFDMUIsaUNBQWlDO0FBQUEsSUFDakMscUNBQXFDO0FBQUEsSUFDckMsMEJBQTBCO0FBQUEsSUFDMUIseUNBQXlDO0FBQUEsSUFDekMsMkJBQTJCO0FBQUEsSUFDM0IsOEJBQThCO0FBQUEsSUFDOUIsZ0NBQWdDO0FBQUEsSUFDaEMsK0JBQStCO0FBQUEsSUFDL0IsZ0NBQWdDO0FBQUEsSUFDaEMsNkJBQTZCO0FBQUEsSUFDN0IsNkJBQTZCO0FBQUEsSUFDN0IscUNBQXFDO0FBQUEsSUFDckMsMkJBQTJCO0FBQUEsSUFDM0IsNEJBQTRCO0FBQUEsSUFDNUIsK0JBQStCO0FBQUEsSUFDL0Isa0NBQWtDO0FBQUEsSUFDbEMsK0JBQStCO0FBQUEsSUFDL0IsNEJBQTRCO0FBQUEsSUFDNUIsK0JBQStCO0FBQUEsSUFDL0IsaUNBQWlDO0FBQUEsSUFDakMsMkJBQTJCO0FBQUEsSUFDM0IsZ0NBQWdDO0FBQUEsSUFDaEMsa0NBQWtDO0FBQUEsSUFDbEMsK0JBQStCO0FBQUEsSUFDL0IsMEJBQTBCO0FBQUEsSUFDMUIsZ0NBQWdDO0FBQUEsSUFDaEMsZ0NBQWdDO0FBQUEsSUFDaEMsZ0NBQWdDO0FBQUEsSUFDaEMsK0JBQStCO0FBQUEsSUFDL0IsaUJBQWlCO0FBQUEsSUFDakIsVUFBWTtBQUFBLElBQ1osV0FBYTtBQUFBLElBQ2IsTUFBUTtBQUFBLElBQ1IsYUFBYTtBQUFBLElBQ2IsbUJBQW1CO0FBQUEsSUFDbkIsT0FBUztBQUFBLElBQ1QsV0FBYTtBQUFBLElBQ2Isa0JBQWtCO0FBQUEsSUFDbEIsZ0JBQWdCO0FBQUEsSUFDaEIsU0FBVztBQUFBLElBQ1gsU0FBVztBQUFBLElBQ1gsc0JBQXNCO0FBQUEsSUFDdEIsZUFBZTtBQUFBLElBQ2YsZ0JBQWdCO0FBQUEsSUFDaEIsSUFBTTtBQUFBLElBQ04sZUFBZTtBQUFBLElBQ2YsbUJBQW1CO0FBQUEsSUFDbkIsWUFBWTtBQUFBLElBQ1osSUFBTTtBQUFBLElBQ04sTUFBUTtBQUFBLElBQ1IsVUFBWTtBQUFBLElBQ1osU0FBVztBQUFBLElBQ1gsbUJBQW1CO0FBQUEsSUFDbkIsY0FBYztBQUFBLElBQ2QsY0FBYztBQUFBLElBQ2QsaUJBQWlCO0FBQUEsSUFDakIsYUFBYTtBQUFBLElBQ2IsY0FBYztBQUFBLElBQ2QsV0FBVztBQUFBLElBQ1gsTUFBUTtBQUFBLElBQ1IsOEJBQThCO0FBQUEsSUFDOUIsT0FBUztBQUFBLElBQ1QsY0FBYztBQUFBLElBQ2QsZ0JBQWdCO0FBQUEsSUFDaEIsV0FBYTtBQUFBLElBQ2IsS0FBTztBQUFBLElBQ1AsWUFBWTtBQUFBLElBQ1osY0FBYztBQUFBLElBQ2QsbUJBQW1CO0FBQUEsRUFDckI7QUFBQSxFQUNBLFdBQWE7QUFBQSxJQUNYLGVBQWU7QUFBQSxJQUNmLCtCQUErQjtBQUFBLElBQy9CLE1BQVE7QUFBQSxFQUNWO0FBQUEsRUFDQSxhQUFlO0FBQUEsRUFDZixjQUFnQjtBQUNsQjs7O0FENUhBLE9BQU8sbUJBQW1CO0FBQzFCLE9BQU8sVUFBVTtBQU5qQixJQUFNLG1DQUFtQztBQVV6QyxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixRQUFRO0FBQUE7QUFBQSxJQUVOLDJDQUEyQztBQUFBO0FBQUEsSUFDM0MseUJBQXlCO0FBQUEsRUFDM0I7QUFBQSxFQUNBLE1BQU0sUUFBUSxJQUFJO0FBQUEsRUFDbEIsTUFBTTtBQUFBLEVBQ04sU0FBUztBQUFBLElBQ1AsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLFFBQ1IsaUJBQWlCO0FBQUEsVUFDZixpQkFBaUIsU0FBTyxRQUFRO0FBQUEsUUFDbEM7QUFBQSxNQUNGO0FBQUEsSUFDRixDQUFDO0FBQUEsSUFDRCxjQUFjO0FBQUEsTUFDVixpQkFBaUI7QUFBQSxNQUNqQixTQUFTLEtBQUssUUFBUSxrQ0FBVyxhQUFhO0FBQUEsTUFDOUMsYUFBYTtBQUFBLE1BQ2IsYUFBYTtBQUFBLE1BQ2IsZ0JBQWlCO0FBQUEsSUFDbkIsQ0FBQztBQUFBLEVBQ0w7QUFBQSxFQUNBLE1BQU07QUFBQSxFQUVOLE9BQU87QUFBQSxJQUNMLFdBQVc7QUFBQSxJQUNYLFFBQVE7QUFBQSxJQUNSLGFBQWE7QUFBQSxJQUNiLFFBQVE7QUFBQSxJQUNSLHVCQUFzQjtBQUFBLEVBQ3hCO0FBQUEsRUFDQSxLQUFLO0FBQUE7QUFBQSxJQUNILFNBQVM7QUFBQSxNQUNQLFNBQVM7QUFBQSxRQUNQO0FBQUEsVUFDRSxlQUFlO0FBQUEsVUFDZixRQUFRO0FBQUEsWUFDTixTQUFTLENBQUMsV0FBVztBQUNuQixrQkFBSSxPQUFPLFNBQVMsV0FBVztBQUM3Qix1QkFBTyxPQUFPO0FBQUEsY0FDaEI7QUFBQSxZQUNGO0FBQUEsVUFDRjtBQUFBLFFBQ0Y7QUFBQTtBQUFBLFFBRUE7QUFBQSxVQUNFLGVBQWU7QUFBQSxVQUNmLEtBQUssS0FBSztBQUNSLGdCQUFJLGFBQWEsYUFBVztBQUMxQixrQkFBSSxRQUFRLEtBQUssU0FBUyxrQkFBa0IsR0FBRztBQUM3Qyx3QkFBUSxPQUFPO0FBQUEsY0FDakI7QUFBQSxZQUNGLENBQUM7QUFBQSxVQUNIO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ04sTUFBTSxnQkFBSSxJQUFJO0FBQUEsRUFDaEI7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
