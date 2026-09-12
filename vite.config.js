import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: './lib/documentParserV08.js',
        replacement: fileURLToPath(new URL('./src/lib/documentParserV09.js', import.meta.url)),
      },
      {
        find: './lib/documentParserV09.js',
        replacement: fileURLToPath(new URL('./src/lib/documentParserV10.js', import.meta.url)),
      },
    ],
  },
});
