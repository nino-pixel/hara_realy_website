import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
// Trigger restart for Tailwind initialization
export default defineConfig({
  plugins: [react()],
  server: {
    /** Allow dev server via ngrok / tunnel (Host header is not localhost). */
    allowedHosts: ['.ngrok-free.dev', '.ngrok-free.app', '.ngrok.io', '.ngrok.app'],
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      /** Laravel public/storage (property images served from backend) */
      '/storage': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
