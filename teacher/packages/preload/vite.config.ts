import { builtinModules } from 'module';
import { defineConfig } from 'vite';
import pkg from '../../package.json';

const __dirname = import.meta.dirname;





export default defineConfig({
  define: {
    '__VUE_PROD_HYDRATION_MISMATCH_DETAILS__': false,
    '__VUE_PROD_DEVTOOLS__': false
  },
  root: __dirname,
  plugins: [ 

  ],

  optimizeDeps: {
   // exclude: ['electron'], // Schließe Electron aus, damit es nicht durch Vite verarbeitet wird
  },

  build: {
    target: 'esnext',  // Sicherstellen, dass der ES6-Standard verwendet wird
    outDir: '../../dist/preload',
    emptyOutDir: true,
    lib: {
      entry: 'preload.ts',
      formats: ['es'],  // Ändere das Format auf 'es' für ESModule
      fileName: () => '[name].mjs',  // Nutze .mjs als Endung für ESModule
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
});
