// ─── TESTES — CLIENT-SIDE: FIREBASE APP CHECK (Micro Sprint 4B.3B.1) ────────
// Script Node puro. src/utils/apiAuth.js não importa Firebase diretamente
// (auth/App Check são recebidos como parâmetros), então é importável e
// testável aqui sem inicializar nenhum app real — só objetos/funções mock.
// Zero rede real, zero Firebase real.
//
//   node scripts/test-appcheck-client.js

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { obterHeadersAutenticados } from "../src/utils/apiAuth.js";

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
async function testeAsync(nome, fn) {
  try {
    await fn();
    passou++;
    console.log(`✅ ${nome}`);
  } catch (e) {
    falhas.push({ nome, erro: e.message });
    console.log(`❌ ${nome} — ${e.message}`);
  }
}

function _authComUsuario(tokenId = "id-token-fake") {
  return { currentUser: { getIdToken: async () => tokenId } };
}
const _authSemUsuario = { currentUser: null };

// ─── 1. Header X-Firebase-AppCheck presente quando obterTokenAppCheck é passado ─

await testeAsync("1. header X-Firebase-AppCheck presente quando obterTokenAppCheck é passado", async () => {
  const headers = await obterHeadersAutenticados(_authComUsuario(), async () => "appcheck-token-fake");
  assert.ok("X-Firebase-AppCheck" in headers, "header X-Firebase-AppCheck deveria estar presente");
  assert.equal(headers["X-Firebase-AppCheck"], "appcheck-token-fake");
  assert.ok("Authorization" in headers, "Authorization continua presente junto");
});

await testeAsync("1b. compatibilidade: sem obterTokenAppCheck, comportamento é idêntico ao de antes (só Authorization)", async () => {
  const headers = await obterHeadersAutenticados(_authComUsuario());
  assert.deepEqual(Object.keys(headers), ["Authorization"], "consumidores existentes não deveriam ganhar X-Firebase-AppCheck sem pedir");
});

// ─── 2. Token nunca no body / 3. nunca na URL ────────────────────────────────
// apiAuth.js só retorna um objeto de headers — nunca constrói body nem URL.
// A garantia real de "nunca no body/URL" está nos CONSUMIDORES (RoboGerador,
// ImportadorPro, ResumoGerador, promptEngine — nenhum alterado nesta sprint,
// já cobertos por scripts/test-ia-auth-consumers.js). Aqui confirmamos que
// o valor retornado por apiAuth.js não é, em si, um objeto com formato de
// body/URL, e que a função não aceita nem produz esses formatos.

teste("2. obterHeadersAutenticados retorna só um objeto plano de headers (nunca algo com forma de body/URL)", () => {
  const src = fs.readFileSync(path.join(_raiz, "src/utils/apiAuth.js"), "utf8");
  assert.doesNotMatch(src, /JSON\.stringify/, "apiAuth.js não deveria montar nenhum body");
  assert.doesNotMatch(src, /https?:\/\//, "apiAuth.js não deveria montar nenhuma URL");
});

await testeAsync("3. o token de App Check nunca aparece serializado como parte de uma URL", async () => {
  const headers = await obterHeadersAutenticados(_authComUsuario(), async () => "appcheck-token-fake");
  const valores = Object.values(headers).join(" ");
  assert.doesNotMatch(valores, /https?:\/\//, "nenhum valor de header deveria conter uma URL embutida");
});

// ─── 4. Falha impede fetch (aqui: impede a RESOLUÇÃO da função antes de qualquer fetch do chamador) ─

await testeAsync("4a. usuário deslogado impede a obtenção de headers (lança antes de qualquer fetch)", async () => {
  await assert.rejects(() => obterHeadersAutenticados(_authSemUsuario, async () => "x"));
});

await testeAsync("4b. falha ao obter token de App Check impede a obtenção de headers (Promise.all rejeita)", async () => {
  const obterTokenAppCheckQueFalha = async () => { throw new Error("App Check indisponível (simulado)"); };
  await assert.rejects(() => obterHeadersAutenticados(_authComUsuario(), obterTokenAppCheckQueFalha));
});

await testeAsync("4c. falha ao obter ID token (Auth) impede a obtenção de headers mesmo com App Check ok", async () => {
  const authQueFalha = { currentUser: { getIdToken: async () => { throw new Error("Auth indisponível (simulado)"); } } };
  await assert.rejects(() => obterHeadersAutenticados(authQueFalha, async () => "appcheck-token-fake"));
});

teste("5. Auth e App Check são obtidos em paralelo (Promise.all), não em série", () => {
  const src = fs.readFileSync(path.join(_raiz, "src/utils/apiAuth.js"), "utf8");
  assert.match(src, /Promise\.all\(\s*\[\s*[\s\S]*?getIdToken[\s\S]*?obterTokenAppCheck/, "deveria usar Promise.all combinando getIdToken e obterTokenAppCheck");
});

// ─── 6. Nunca loga nem persiste nenhum dos dois tokens ───────────────────────

teste("6. apiAuth.js não loga nem persiste nenhum token (Auth ou App Check) em localStorage/sessionStorage", () => {
  const src = fs.readFileSync(path.join(_raiz, "src/utils/apiAuth.js"), "utf8");
  assert.doesNotMatch(src, /console\.(log|error|warn|info|debug)/);
  assert.doesNotMatch(src, /localStorage\.(getItem|setItem)|sessionStorage\.(getItem|setItem)/);
});

// ─── 7. src/firebase.js — App Check estruturado, sem chave real, sem ativação por padrão ─

teste("7. [estrutural] src/firebase.js só inicializa App Check quando há site key configurada — nenhum provider ativo por padrão", () => {
  const src = fs.readFileSync(path.join(_raiz, "src/firebase.js"), "utf8");
  assert.match(src, /VITE_FIREBASE_APPCHECK_SITE_KEY/, "deveria depender de uma variável de ambiente para a site key");
  assert.match(src, /initializeAppCheck/, "deveria importar/usar initializeAppCheck");
  assert.match(src, /ReCaptchaV3Provider/, "estrutura deveria estar pronta para reCAPTCHA v3");
  // A inicialização real deve estar condicionada à presença da site key —
  // não pode ser uma chamada incondicional no topo do módulo.
  const idxSiteKey = src.indexOf("APPCHECK_SITE_KEY");
  const idxInit = src.indexOf("initializeAppCheck(app");
  assert.ok(idxSiteKey !== -1 && idxInit !== -1);
  const trechoEntre = src.slice(idxSiteKey, idxInit);
  assert.match(trechoEntre, /if\s*\(\s*APPCHECK_SITE_KEY\s*\)/, "initializeAppCheck só deveria rodar dentro de um if guardado pela site key");
});

teste("8. [estrutural] Debug Provider só ativa via variável de ambiente explícita, nunca incondicionalmente", () => {
  const src = fs.readFileSync(path.join(_raiz, "src/firebase.js"), "utf8");
  assert.match(src, /VITE_FIREBASE_APPCHECK_DEBUG/);
  assert.match(src, /if\s*\(\s*APPCHECK_DEBUG\s*\)/, "FIREBASE_APPCHECK_DEBUG_TOKEN só deveria ser setado dentro de um if condicionado à variável");
});

teste("9. [estrutural] initializeAppCheck é protegido contra dupla inicialização (try/catch)", () => {
  const src = fs.readFileSync(path.join(_raiz, "src/firebase.js"), "utf8");
  const idxInit = src.indexOf("initializeAppCheck(app");
  const idxTry = src.lastIndexOf("try {", idxInit);
  const idxCatch = src.indexOf("catch", idxInit);
  assert.ok(idxTry !== -1 && idxTry < idxInit, "initializeAppCheck deveria estar dentro de um try");
  assert.ok(idxCatch !== -1 && idxCatch > idxInit, "deveria haver um catch logo após, para não crashar em reinicialização");
});

// ─── 10. Inventário de consumidores continua íntegro (nenhum foi alterado) ──

await testeAsync("10. [regressão] inventário de consumidores de gerarQuestoesIA continua íntegro (nenhum tocado nesta sprint)", async () => {
  const { execFileSync } = await import("node:child_process");
  const out = execFileSync(process.execPath, [path.join(_raiz, "scripts/test-ia-auth-consumers.js")], { encoding: "utf8" });
  assert.match(out, /14\/14 testes passaram\./, "a suíte de inventário de consumidores deveria continuar 14/14");
});

console.log(`\n${passou}/${passou + falhas.length} testes passaram.`);
if (falhas.length > 0) {
  console.log("\nFALHAS:");
  falhas.forEach(f => console.log(`- ${f.nome}: ${f.erro}`));
  process.exit(1);
}
