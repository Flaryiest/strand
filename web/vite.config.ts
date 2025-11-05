import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  resolve: {
    alias: [
      { find: '@', replacement: '/src' },
      { find: '@dashboard', replacement: '/src/pages/dashboard' }
    ]
  }
});
