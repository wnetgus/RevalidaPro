import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { initializeAppCheck, ReCaptchaV3Provider, getToken } from "firebase/app-check";
import { calcularAppCheckDebugToken } from "./utils/appCheckDebug";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

// DEV  → memoryLocalCache: sem persistência entre reloads, getDocFromServer sempre
//         lê dados frescos, testes não acumulam estado no IndexedDB
// PROD → persistentLocalCache: comportamento original, suporte a múltiplas abas
export const db = initializeFirestore(app, {
  localCache: import.meta.env.DEV
    ? memoryLocalCache()
    : persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

export const auth = getAuth(app);
export const storage = getStorage(app);

// ── App Check (Micro Sprint 4B.3B.1 — infraestrutura, SEM chave real) ──────
// Nenhum provider fica ativo por padrão: só inicializa quando
// VITE_FIREBASE_APPCHECK_SITE_KEY existir (configuração externa da 4B.3B.2/
// 3B.3, ainda não feita). Sem a variável, `appCheck`/`obterTokenAppCheck`
// ficam `null` e nada muda — src/utils/apiAuth.js já trata isso como "sem
// App Check" (mesmo comportamento de sempre para RoboGerador/ImportadorPro/
// ResumoGerador/promptEngine, nenhum dos quais foi tocado nesta sprint).
//
// Debug Provider: VITE_FIREBASE_APPCHECK_DEBUG controla dois modos seguros
// (Micro Sprint 4B.3B.2A), nunca ativos por padrão:
//   - ausente ou vazia (após trim): Debug Provider desligado, nada é definido.
//   - "true" (tolerante a espaços e caixa — "TRUE", " true " etc.): modo
//     automático do SDK, que GERA um token novo a cada execução — é preciso
//     reabrir o Console e registrar o novo token sempre que ele mudar.
//   - qualquer outra string não vazia: usada como TOKEN FIXO — registre esse
//     mesmo valor uma única vez no Console App Check e ele passa a ser
//     reaproveitado entre reloads/reinícios, em vez de mudar a cada execução
//     (esse é o problema real que motivou este modo).
// NUNCA deve ficar habilitado em um build de produção — isso é
// responsabilidade operacional de uma sprint futura (garantir que a
// variável nunca exista no ambiente de build de produção), não deste código.
// Derivação em calcularAppCheckDebugToken (src/utils/appCheckDebug.js) —
// extraída para ser testável em Node puro (ver scripts/test-appcheck-client.js).
const APPCHECK_SITE_KEY     = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY;
const APPCHECK_DEBUG_TOKEN  = calcularAppCheckDebugToken(import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG);

if (APPCHECK_DEBUG_TOKEN !== undefined) {
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = APPCHECK_DEBUG_TOKEN;
}

let _appCheck = null;
if (APPCHECK_SITE_KEY) {
  try {
    _appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(APPCHECK_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (e) {
    // Não inicializar duas vezes: initializeAppCheck lança se já houver uma
    // instância para este app (ex.: HMR do Vite reexecutando este módulo).
    // Não é fatal — a instância anterior continua válida — só não crasha o
    // app por isso.
    console.warn("[firebase] App Check: inicialização ignorada —", e.message);
  }
}
export const appCheck = _appCheck;

// Função injetável (não a instância bruta) — mesmo padrão de verificador
// injetável usado no servidor (authGate.js/gate.js). null quando não há App
// Check configurado, para que src/utils/apiAuth.js trate isso como "não
// enviar X-Firebase-AppCheck" sem precisar saber o motivo.
export const obterTokenAppCheck = appCheck
  ? async () => (await getToken(appCheck)).token
  : null;