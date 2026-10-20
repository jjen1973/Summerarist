import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({ plugins: [react()], server: { port: 5173, strictPort: true, proxy: { '/api/stripe-local': { target: 'http://127.0.0.1:4318', changeOrigin: false } } }, build: { rollupOptions: { output: { manualChunks: { firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'], react: ['react', 'react-dom', 'react-router-dom'] } } } } })
