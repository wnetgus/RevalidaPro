// ─── TESTES — ISOLAMENTO DEV/PRODUÇÃO DO ENDPOINT DE PAGAMENTO ───────────────
// Mesmo padrão dos demais scripts desta família (Node puro, zero rede real,
// zero Firebase). Estrutural/textual por natureza — examina o CONTEÚDO
// VERSIONADO real dos dois arquivos-fonte (mesma técnica de
// test-ia-auth-consumers.js e test-vite-dev-proxy.js para o mesmo problema).
//
// Achado real que motivou este hotfix (auditoria de prontidão de deploy DEV):
// ModalAssinatura.jsx e LandingPage.jsx tinham a URL COMPLETA de
// `criarPreferencia` hardcoded para o projeto de PRODUÇÃO
// (revalidapro-f812e), sem nenhum fallback de VITE_FUNCTIONS_BASE_URL — ao
// contrário dos demais 5 consumidores de Functions do repositório
// (promptEngine.js, RoboGerador.jsx x2, ResumoGerador.jsx, ImportadorPro.jsx),
// que já usam esse padrão para gerarQuestoesIA. Isso significava que uma
// build DEV (`npm run build:dev`) continuaria, mesmo assim, redirecionando o
// usuário para a Cloud Function de pagamento REAL de produção.
//
//   node scripts/test-pagamento-dev-isolamento.js

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _raiz = path.resolve(__dirname, "..");
const modalSrc = fs.readFileSync(path.join(_raiz, "src/components/ModalAssinatura.jsx"), "utf8");
const landingSrc = fs.readFileSync(path.join(_raiz, "src/pages/LandingPage.jsx"), "utf8");

let passou = 0;
const falhas = [];
function teste(nome, fn) {
  try {
    fn();
    passou++;
    console.log(`✅ ${nome}`);
  } catch (e) {
    falhas.push({ nome, erro: e.message });
    console.log(`❌ ${nome} — ${e.message}`);
  }
}

const URL_PRODUCAO_COMPLETA_HARDCODED = '"https://us-central1-revalidapro-f812e.cloudfunctions.net/criarPreferencia"';

// ── 1/2. Nenhum dos dois arquivos possui a URL completa de produção como literal único ──
teste("1. ModalAssinatura.jsx não contém a URL completa hardcoded de criarPreferencia em produção", () => {
  assert.ok(!modalSrc.includes(URL_PRODUCAO_COMPLETA_HARDCODED), "URL completa de produção ainda hardcoded como literal único");
});

teste("2. LandingPage.jsx não contém a URL completa hardcoded de criarPreferencia em produção", () => {
  assert.ok(!landingSrc.includes(URL_PRODUCAO_COMPLETA_HARDCODED), "URL completa de produção ainda hardcoded como literal único");
});

// ── 3/4. Ambos passam a usar a configuração por ambiente (mesmo padrão dos outros 5 consumidores) ──
teste("3. ModalAssinatura.jsx usa import.meta.env.VITE_FUNCTIONS_BASE_URL para montar CLOUD_FUNCTION_URL", () => {
  const bloco = modalSrc.match(/const CLOUD_FUNCTION_URL =[\s\S]*?criarPreferencia["'`];/);
  assert.ok(bloco, "declaração de CLOUD_FUNCTION_URL não encontrada");
  assert.match(bloco[0], /import\.meta\.env\.VITE_FUNCTIONS_BASE_URL/, "CLOUD_FUNCTION_URL deveria ler VITE_FUNCTIONS_BASE_URL");
});

teste("4. LandingPage.jsx usa import.meta.env.VITE_FUNCTIONS_BASE_URL para montar CLOUD_FN", () => {
  const bloco = landingSrc.match(/const CLOUD_FN =[\s\S]*?criarPreferencia["'`];/);
  assert.ok(bloco, "declaração de CLOUD_FN não encontrada");
  assert.match(bloco[0], /import\.meta\.env\.VITE_FUNCTIONS_BASE_URL/, "CLOUD_FN deveria ler VITE_FUNCTIONS_BASE_URL");
});

// ── 5/6. Fallback de produção preservado (compatibilidade com a build de produção atual) ──
teste("5. ModalAssinatura.jsx preserva fallback de produção quando a env var não existe", () => {
  assert.match(modalSrc, /"https:\/\/us-central1-revalidapro-f812e\.cloudfunctions\.net"/, "fallback de produção deveria continuar presente para compatibilidade da build de produção");
});

teste("6. LandingPage.jsx preserva fallback de produção quando a env var não existe", () => {
  assert.match(landingSrc, /"https:\/\/us-central1-revalidapro-f812e\.cloudfunctions\.net"/, "fallback de produção deveria continuar presente para compatibilidade da build de produção");
});

// ── 7. O endpoint é montado concatenando "/criarPreferencia" ao FUNCTIONS_BASE_URL, não hardcoded no meio ──
teste("7. CLOUD_FUNCTION_URL e CLOUD_FN concatenam \"/criarPreferencia\" ao valor resolvido, não a uma string de produção fixa completa", () => {
  assert.match(modalSrc, /\+\s*"\/criarPreferencia"/, "ModalAssinatura.jsx deveria concatenar /criarPreferencia ao valor resolvido");
  assert.match(landingSrc, /\+\s*"\/criarPreferencia"/, "LandingPage.jsx deveria concatenar /criarPreferencia ao valor resolvido");
});

// ── 8. Nenhuma chamada de rede em nenhum teste deste arquivo ────────────────
teste("8. Nenhum teste deste arquivo faz I/O além de leitura local dos dois arquivos-fonte (zero rede)", () => {
  const esteArquivo = fs.readFileSync(fileURLToPath(import.meta.url), "utf8");
  assert.ok(!/\bfetch\s*\(/.test(esteArquivo.replace(/\/\/.*$/gm, "")), "este arquivo de teste não deveria fazer nenhuma chamada fetch");
});

console.log(`\n${passou}/${passou + falhas.length} testes passaram.`);
if (falhas.length > 0) {
  console.log("\nFalhas:");
  falhas.forEach((f) => console.log(`  - ${f.nome}: ${f.erro}`));
  process.exit(1);
}
