import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const carApiPrefix =
  '^/api/(listings|listing/|pricing-try-values|pricing-calendar|pricing-signals|demand-data|override-price|audit-logs|quote|simulate|optimize|admin/|auth/)'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '^/api/airbnb/': {
        target: 'http://127.0.0.1:8100',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/airbnb/, '/api'),
      },
      [carApiPrefix]: {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
})
