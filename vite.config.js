import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Redireciona chamadas /functions/* para o Firebase Functions
      // eliminando CORS no ambiente de desenvolvimento (localhost:5173).
      // Em produção o frontend chama o URL da Function diretamente.
      '/functions': {
        target: 'https://us-central1-revalidapro-f812e.cloudfunctions.net',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/functions/, ''),
        secure: true,
      },
    },
  },
})
