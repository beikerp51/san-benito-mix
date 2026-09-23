import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { ratesApiPlugin } from './server/rates-service.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), ratesApiPlugin()],
  server: {
    host: true,
    port: 5173,
    allowedHosts: true,
  },
})
