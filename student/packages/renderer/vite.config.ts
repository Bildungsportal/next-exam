
import { defineConfig, Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import pkg from '../../package.json'

import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import path from 'path'

// https://vitejs.dev/config/

export default defineConfig({
  define: {
    // ... andere definierte Werte
    '__VUE_PROD_HYDRATION_MISMATCH_DETAILS__': false, // oder true, je nach Bedarf
    '__VUE_PROD_DEVTOOLS__': false
  },
  mode: process.env.NODE_ENV,
  root: __dirname,
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: tag => tag === 'webview'
        }
      }
    }),
    VueI18nPlugin({
        compositionOnly: false,
        include: path.resolve(__dirname, './locales/*'),
        runtimeOnly: false,
        fullInstall: true,
        forceStringify : true,
      })
  ],
  base: './',
 
  build: {
    sourcemap: true,
    outDir: '../../dist/renderer',
    emptyOutDir: true,
    minify: true,
    chunkSizeWarningLimit:5000,
  },
  css: {   // this covers bootstrap css warnings when minifying the css code
    postcss: {
      plugins: [
        {
          postcssPlugin: 'internal:charset-removal',
          AtRule: {
            charset: (atRule) => {
              if (atRule.name === 'charset') {
                atRule.remove();
              }
            }
          }
        },
        // New plugin to remove source map URL
        {
          postcssPlugin: 'remove-source-map-url',
          Once(css) {
            css.walkComments(comment => {
              if (comment.text.includes('sourceMappingURL')) {
                comment.remove();
              }
            });
          }
        }
      ]
    }
  },
  server: {
    port: pkg.env.PORT,
  },
})
