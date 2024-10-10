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
    // externalizeDepsPlugin({
    //   //include: ['electron-log'], // Stelle sicher, dass electron-log eingeschlossen ist
    // }),
 
  ],
  optimizeDeps: {
    //exclude: ['electron'], // Schließe Electron aus, damit es nicht durch Vite verarbeitet wird
  },
  build: {
    outDir: '../../dist/main',
    emptyOutDir: true,

    lib: {
      entry: 'main.ts',
      formats: ['es'],  // Ändere 'cjs' zu 'es' für ESModule
      fileName: () => '[name].mjs',  // Ändere Dateiendung zu '.mjs' für ESModule
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
});
