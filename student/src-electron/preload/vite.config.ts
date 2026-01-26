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
    outDir: '../../dist/preload',
    emptyOutDir: true,
    lib: {
      entry: '../electron-preload.ts',
      formats: ['cjs'],
      fileName: () => '[name].cjs',
    },
    minify: true,
    sourcemap: 'inline',
    rollupOptions: {
      external: [
        'electron',
        ...builtinModules,
        ...Object.keys(pkg.dependencies || {}),
      ],
    },
  },
})
