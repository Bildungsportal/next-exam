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
    outDir: '../../dist/main',
    emptyOutDir: true,

    lib: {
      entry: 'main.ts',
      formats: ['cjs'],
      fileName: () => '[name].cjs',
    },
    minify: true,
    sourcemap: true,
    rollupOptions: {
      external: [
        'electron',
        'electron-log',
        'node-prevent-sleep',
        ...builtinModules,
        ...Object.keys(pkg.dependencies || {}),
      ],
    },
  },
})
