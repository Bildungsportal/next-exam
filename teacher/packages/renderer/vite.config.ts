import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import path from 'path'
import pkg from '../../package.json'


const __dirname = import.meta.dirname;




// https://vitejs.dev/config/
export default defineConfig({
  define: {
    '__VUE_PROD_HYDRATION_MISMATCH_DETAILS__': false,
    '__VUE_PROD_DEVTOOLS__': false
  },
  mode: process.env.NODE_ENV,
  root: __dirname,
  plugins: [
    vue(),
    VueI18nPlugin({
        compositionOnly: false,
        include: path.resolve(__dirname, './locales/*'),
        runtimeOnly: false,
        fullInstall: true,
        forceStringify : true,
      })
  ],
  base: './',
  optimizeDeps: {
    //exclude: ['electron'], // Schließe Electron aus, damit es nicht durch Vite verarbeitet wird
  },
  build: {
    sourcemap: true,
    outDir: '../../dist/renderer',
    emptyOutDir: true,
    minify: true,
    chunkSizeWarningLimit:5000,
    rollupOptions: {
     // external: ['electron'], 
    },
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
        }
      ]
    }
  },
  server: {
    port: pkg.env.PORT,
    host: '127.0.0.1'
  },
})
