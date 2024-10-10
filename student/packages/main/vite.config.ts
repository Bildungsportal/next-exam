import { builtinModules } from 'module'
import { defineConfig } from 'vite'
import pkg from '../../package.json'
import commonjs from 'vite-plugin-commonjs';


export default defineConfig({
  define: {
    '__VUE_PROD_HYDRATION_MISMATCH_DETAILS__': false, // oder true, je nach Bedarf
    '__VUE_PROD_DEVTOOLS__': false
  },
  root: __dirname,
  
  plugins: [
    commonjs(),  // Fügt Unterstützung für CommonJS-Module hinzu
  ],
  optimizeDeps: {
     exclude: ['nodehun']  // Verhindert, dass Vite versucht, nodehun zu optimieren
  },


  build: {
    outDir: '../../dist/main',
    emptyOutDir: true,
    lib: {
      entry: 'main.ts',
      formats: ['es'],
      fileName: () => '[name].mjs',
    },
    minify: true,
    sourcemap: true,
    rollupOptions: {
      external: [
        'electron',
        'nodehun',
        ...builtinModules,
        ...Object.keys(pkg.dependencies || {}),
      ],
    },
  },
})
