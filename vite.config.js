import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const parserV11 = fileURLToPath(new URL('./src/lib/documentParserV11.js', import.meta.url));

export default defineConfig({
  plugins: [
    {
      name: 'studybook-parser-entry',
      enforce: 'pre',
      resolveId(source, importer) {
        if (source === './lib/documentParserV09.js' && importer?.endsWith('/src/App.jsx')) {
          return parserV11;
        }
        return null;
      },
    },
    react(),
  ],
});
