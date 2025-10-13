import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path';

export default defineConfig({
  server: {
    allowedHosts: ['squagol'],
    host: true,
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5050'
    }
  },
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
  ],
  resolve: {
    alias: {
      '@components': path.resolve(__dirname, 'src/components'),
      '@pages': path.resolve(__dirname, 'src/pages'),
      "@styles": path.resolve(__dirname, 'src/styles'),
    },
  }
})