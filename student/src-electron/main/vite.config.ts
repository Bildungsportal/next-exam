import { builtinModules } from 'module'
import { defineConfig } from 'vite'
import pkg from '../../package.json'

export default defineConfig({
  esbuild: {
    supported: {
      'top-level-await': true //browsers can handle top-level-await features
    },
  },
  define: {
    '__VUE_PROD_HYDRATION_MISMATCH_DETAILS__': false, // oder true, je nach Bedarf
    '__VUE_PROD_DEVTOOLS__': false
  },
  root: __dirname,


  build: {
    target: 'esnext',
    outDir: '../../dist/main',
    emptyOutDir: true,
    lib: {
      entry: '../electron-main.js',
      formats: ['es'],
      fileName: () => '[name].mjs',
    },
    minify: true,
    sourcemap: true,
    rollupOptions: {
      external: [
        'electron',
        'sharp',
        ...builtinModules,
        ...Object.keys(pkg.dependencies || {}),
      ],
    },
  },
})
