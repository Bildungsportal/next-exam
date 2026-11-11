import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      'next-exam-shared': path.resolve(__dirname, '../shared'),
      stores: path.resolve(__dirname, 'src/stores'),
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['src/**/*.spec.ts', 'src-electron/**/*.spec.js'],
  },
});
