import { builtinModules } from 'module'
import { defineConfig } from 'vite'
import pkg from '../../package.json'

export default defineConfig({
  define: {
    '__VUE_PROD_HYDRATION_MISMATCH_DETAILS__': false,
    '__VUE_PROD_DEVTOOLS__': false
  },
  root: __dirname,
  build: {
    target: 'esnext',
    outDir: '../../dist/preload',
    emptyOutDir: true,
    lib: {
      entry: 'preload.ts',
      formats: ['cjs'],
      fileName: () => '[name].cjs',
    },
    minify: true,
    // https://github.com/caoxiemeihao/electron-vue-vite/issues/61
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
