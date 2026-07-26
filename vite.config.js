import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Micro Sprint 4B.3B.0.5: o alvo do proxy /functions vinha hardcoded para o
// projeto de PRODUÇÃO (revalidapro-f812e) — isso fazia `npm run dev` chamar
// a Cloud Function REAL de produção, apesar de .env.development já declarar
// VITE_FUNCTIONS_BASE_URL apontando para revalidapro-dev (essa variável só
// era lida pelo client no branch de produção, nunca pelo proxy do dev
// server). Corrigido para ler a mesma variável via loadEnv, só quando o
// comando é `serve` (dev server) — build (`vite build`/`build:dev`/
// `build:prod`) nunca inicia um server, então nunca é afetado por isto, e o
// client em produção continua montando a URL do jeito que sempre montou.
// Sem fallback para produção: se a variável não existir, falha alto e claro
// em vez de silenciosamente usar produção.
export default defineConfig(({ command }) => {
  const config = { plugins: [react()] }

  if (command === 'serve') {
    const env = loadEnv('development', process.cwd(), '')
    const functionsBaseUrl = env.VITE_FUNCTIONS_BASE_URL
    if (!functionsBaseUrl) {
      throw new Error(
        'VITE_FUNCTIONS_BASE_URL não está definida em .env.development — ' +
        'o proxy do Vite (dev server) precisa dela para saber a qual projeto ' +
        'de Cloud Functions direcionar /functions/*. Configure a variável ' +
        'antes de rodar `npm run dev`; nunca cai em produção como fallback silencioso.'
      )
    }
    config.server = {
      proxy: {
        // Redireciona chamadas /functions/* para o Firebase Functions do
        // projeto de DESENVOLVIMENTO, eliminando CORS localmente. Em
        // produção o frontend chama o URL da Function diretamente (ver
        // src/utils/promptEngine.js e demais consumidores) — este proxy só
        // existe para o dev server, nunca para o build de produção.
        '/functions': {
          target: functionsBaseUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/functions/, ''),
          secure: true,
        },
      },
    }
  }

  return config
})
