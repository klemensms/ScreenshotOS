import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  root: 'src',
  plugins: [react()],
  build: {
    outDir: '../dist',
    emptyOutDir: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/index.html')
      },
      output: {
        entryFileNames: 'renderer.js',
        format: 'esm',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]'
      },
    },
    // Ensure assets use relative paths, not absolute paths
    assetsDir: '',
  },
  base: './' // This ensures all asset paths are relative
});
