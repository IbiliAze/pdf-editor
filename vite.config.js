import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // The API runs as its own container in production, behind the same origin.
    proxy: { '/api': process.env.API_PROXY_TARGET || 'http://localhost:3000' },
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Keep the PDF engines out of the entry chunk: the app shell then
        // parses and paints before the heavy libraries are needed.
        manualChunks: {
          pdfjs: ['pdfjs-dist'],
          'pdf-lib': ['pdf-lib', '@pdf-lib/fontkit'],
          react: ['react', 'react-dom'],
        },
        // Emit .mjs assets (the pdf.js worker) with a .js extension: stock
        // nginx and many static hosts serve .mjs as application/octet-stream,
        // which browsers reject for module workers / dynamic import — the
        // worker then fails to start in production. pdf.js loads the worker
        // with { type: "module" } regardless of extension, so .js is safe.
        assetFileNames: (assetInfo) => {
          const name = assetInfo.names?.[0] ?? assetInfo.name ?? ''
          if (name.endsWith('.mjs')) return 'assets/[name]-[hash].js'
          return 'assets/[name]-[hash][extname]'
        },
      },
    },
  },
})
