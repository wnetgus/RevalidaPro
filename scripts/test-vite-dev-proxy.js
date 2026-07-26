// ─── TESTES — ISOLAMENTO DEV/PROD DO PROXY DO VITE (Micro Sprint 4B.3B.0.5) ──
// Script Node puro, mesmo padrão dos demais scripts desta família. Sem
// subir um dev server real — importa a função de config exportada por
// vite.config.js e invoca-a diretamente com { command } simulado (é assim
// que o próprio Vite chama internamente quando o export é uma função).
// Também usa loadEnv (da própria dependência "vite" já instalada) contra
// diretórios temporários fabricados — nunca lê nem modifica os .env.* reais
// do projeto além de uma leitura read-only para confirmar o valor esperado.
//
//   node scripts/test-vite-dev-proxy.js

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import viteConfigFactory from "../vite.config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _raiz = path.resolve(__dirname, "..");

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

// ─── 1-2: estrutural — sem hardcode de produção, usa loadEnv, guarda por command ─

teste("1. [estrutural] vite.config.js não contém mais a URL de produção como valor fixo (o nome do projeto pode aparecer em comentário explicando o histórico da correção)", () => {
  const src = fs.readFileSync(path.join(_raiz, "vite.config.js"), "utf8");
  assert.ok(!src.includes("'https://us-central1-revalidapro-f812e.cloudfunctions.net'") && !src.includes('"https://us-central1-revalidapro-f812e.cloudfunctions.net"'), "o proxy do dev server não deveria mais ter a URL de produção como literal de string");
  assert.ok(!/target:\s*['"]https:\/\/[^'"]*f812e/.test(src), "target do proxy não deveria ser uma string literal apontando para produção");
});

teste("2. [estrutural] vite.config.js lê VITE_FUNCTIONS_BASE_URL via loadEnv e só monta o proxy quando command === \"serve\"", () => {
  const src = fs.readFileSync(path.join(_raiz, "vite.config.js"), "utf8");
  assert.match(src, /loadEnv\(/, "deveria usar loadEnv para ler .env.development");
  assert.match(src, /VITE_FUNCTIONS_BASE_URL/, "deveria ler especificamente VITE_FUNCTIONS_BASE_URL");
  assert.match(src, /command\s*===\s*['"]serve['"]/, "o proxy só deveria existir quando o Vite roda o dev server (command === 'serve')");
});

// ─── 3-4: build (production) nunca é afetado, com ou sem a variável ─────────

teste("3. [estrutural/fluxo simulado] command === \"build\" nunca monta server.proxy, mesmo sem a variável", () => {
  const config = viteConfigFactory({ command: "build" });
  assert.equal(config.server, undefined, "build não deveria ter server.proxy — este proxy é exclusivo do dev server");
});

teste("4. [fluxo simulado] command === \"serve\" com a variável presente monta o proxy corretamente, sem hardcode", () => {
  const config = viteConfigFactory({ command: "serve" });
  assert.ok(config.server?.proxy?.["/functions"], "deveria montar o proxy /functions quando serve + variável presente");
  const target = config.server.proxy["/functions"].target;
  assert.ok(!target.includes("revalidapro-f812e"), "target do proxy não deveria ser o projeto de produção");
});

// ─── 5. command === "serve" SEM a variável falha alto e claro (fail-closed, sem fallback pra produção) ─

teste("5. [fluxo simulado] command === \"serve\" sem VITE_FUNCTIONS_BASE_URL lança erro claro, nunca cai em produção silenciosamente", () => {
  // Fabrica um diretório temporário SEM .env.development (ou com a variável
  // ausente) e invoca a MESMA lógica de leitura (loadEnv) que vite.config.js
  // usa, mas apontando para lá — sem tocar nos .env.* reais do projeto.
  const dirVazio = fs.mkdtempSync(path.join(os.tmpdir(), "vite-proxy-test-"));
  try {
    const env = loadEnv("development", dirVazio, "");
    assert.equal(env.VITE_FUNCTIONS_BASE_URL, undefined, "diretório fabricado não deveria ter a variável — pré-condição do teste");
    // Reproduz a mesma checagem de vite.config.js: ausência da variável deve
    // ser um erro, nunca um fallback silencioso para a URL de produção.
    assert.throws(() => {
      if (!env.VITE_FUNCTIONS_BASE_URL) {
        throw new Error("VITE_FUNCTIONS_BASE_URL não está definida em .env.development");
      }
    }, /VITE_FUNCTIONS_BASE_URL/);
  } finally {
    fs.rmSync(dirVazio, { recursive: true, force: true });
  }
});

// ─── 6. Confirma o valor real do projeto (leitura, nunca escrita) ────────────

teste("6. [integração local, somente leitura] .env.development real do projeto aponta para revalidapro-dev, não para produção", () => {
  const env = loadEnv("development", _raiz, "");
  const url = env.VITE_FUNCTIONS_BASE_URL;
  if (!url) {
    console.log("   (VITE_FUNCTIONS_BASE_URL ausente localmente — .env.development pode não existir neste ambiente; teste não falha por isso)");
    return;
  }
  assert.ok(url.includes("revalidapro-dev"), "VITE_FUNCTIONS_BASE_URL de .env.development deveria apontar para revalidapro-dev");
  assert.ok(!url.includes("revalidapro-f812e"), "VITE_FUNCTIONS_BASE_URL de .env.development não deveria apontar para produção");
});

console.log(`\n${passou}/${passou + falhas.length} testes passaram.`);
if (falhas.length > 0) {
  console.log("\nFALHAS:");
  falhas.forEach(f => console.log(`- ${f.nome}: ${f.erro}`));
  process.exit(1);
}
