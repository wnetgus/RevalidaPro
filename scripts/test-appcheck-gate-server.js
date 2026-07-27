// ─── TESTES — SERVER-SIDE: FIREBASE APP CHECK (Micro Sprint 4B.3B.1) ────────
// Script Node puro, mesmo padrão dos demais scripts desta família. Zero
// Firebase real, zero rede real, zero Anthropic real — verificador e fetch
// sempre injetados como mocks. Sem nenhuma configuração de Console: esta
// suíte prova que a INFRAESTRUTURA (functions/appCheckGate.js + a fiação em
// functions/index.js) está correta, não que um provider real funciona.
//
//   node scripts/test-appcheck-gate-server.js

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { avaliarAppCheck } from "../functions/appCheckGate.js";
import { avaliarAutenticacaoEAutorizacao, EMAILS_AUTORIZADOS_IA } from "../functions/authGate.js";
import { chamarAnthropicViaGate } from "../functions/gate.js";

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

const _verificarAppCheckValido  = async (token) => ({ token, alreadyConsumed: false });
const _verificarAppCheckInvalido = async () => { throw new Error("Decoding App Check token failed."); };

// ─── 1-4: avaliarAppCheck — função pura ──────────────────────────────────────

await testeAsync("1. token de App Check ausente → bloqueio (401)", async () => {
  const r = await avaliarAppCheck({ appCheckHeader: undefined, verificarAppCheckToken: _verificarAppCheckValido });
  assert.equal(r.ok, false);
  assert.equal(r.httpStatus, 401);
});

await testeAsync("1b. token de App Check vazio (\"\") → bloqueio (401)", async () => {
  const r = await avaliarAppCheck({ appCheckHeader: "", verificarAppCheckToken: _verificarAppCheckValido });
  assert.equal(r.ok, false);
  assert.equal(r.httpStatus, 401);
});

await testeAsync("2. token de App Check inválido (verificador rejeita) → bloqueio (401)", async () => {
  const r = await avaliarAppCheck({ appCheckHeader: "token-invalido", verificarAppCheckToken: _verificarAppCheckInvalido });
  assert.equal(r.ok, false);
  assert.equal(r.httpStatus, 401);
});

await testeAsync("3. erro genérico/inesperado do verificador → fail-closed, não propaga", async () => {
  const verificarQuebrado = async () => { throw new TypeError("erro interno inesperado"); };
  let r;
  await assert.doesNotReject(async () => {
    r = await avaliarAppCheck({ appCheckHeader: "x", verificarAppCheckToken: verificarQuebrado });
  });
  assert.equal(r.ok, false);
  assert.equal(r.httpStatus, 401);
});

await testeAsync("3b. verificador ausente (não injetado) → bloqueio (401), nunca libera por omissão", async () => {
  const r = await avaliarAppCheck({ appCheckHeader: "x", verificarAppCheckToken: undefined });
  assert.equal(r.ok, false);
  assert.equal(r.httpStatus, 401);
});

await testeAsync("4. token de App Check válido → prossegue (ok:true)", async () => {
  const r = await avaliarAppCheck({ appCheckHeader: "token-valido", verificarAppCheckToken: _verificarAppCheckValido });
  assert.equal(r.ok, true);
});

// ─── 5-8: fluxo combinado (Auth → Autorização → App Check → Payload Gate → Anthropic) ─

function _criarSpyFetch(respostaSimulada = { ok: true, json: async () => ({ content: [] }) }) {
  let chamadas = 0;
  const spy = async () => { chamadas++; return respostaSimulada; };
  return { spy, contagem: () => chamadas };
}

const EMAIL_AUTORIZADO = EMAILS_AUTORIZADOS_IA[0];
const _verificarTokenAuthValido = async () => ({ email: EMAIL_AUTORIZADO });
const _verificarTokenAuthInvalido = async () => { throw new Error("invalid"); };

// Simula exatamente a ordem real de gerarQuestoesIA: authGate → appCheckGate
// → gate.js (payload) → "Anthropic" (spy). Cada etapa só é avaliada se a
// anterior autorizou — short-circuit real, não simulado por assert isolado.
async function _fluxoCompleto({ authHeader, verificarIdToken, appCheckHeader, verificarAppCheckToken, camposObrigatorios, fetchImpl }) {
  const autenticacao = await avaliarAutenticacaoEAutorizacao({ authHeader, verificarIdToken });
  if (!autenticacao.ok) return { etapa: "auth", ...autenticacao };

  const appCheck = await avaliarAppCheck({ appCheckHeader, verificarAppCheckToken });
  if (!appCheck.ok) return { etapa: "appcheck", ...appCheck };

  const gatePayload = await chamarAnthropicViaGate({
    gateParams: { apiKey: "chave-teste", camposObrigatorios },
    corpo: { messages: [] },
    fetchImpl,
  });
  return { etapa: "payload", autorizado: gatePayload.autorizado, motivo: gatePayload.motivo };
}

await testeAsync("5. App Check NÃO é avaliado quando a autenticação já falhou (short-circuit real)", async () => {
  let appCheckFoiChamado = false;
  const verificarAppCheckQueNuncaDeveriaRodar = async () => { appCheckFoiChamado = true; return { token: "x" }; };
  const r = await _fluxoCompleto({
    authHeader: "Bearer x", verificarIdToken: _verificarTokenAuthInvalido,
    appCheckHeader: "x", verificarAppCheckToken: verificarAppCheckQueNuncaDeveriaRodar,
    camposObrigatorios: { prompt: "x" }, fetchImpl: _criarSpyFetch().spy,
  });
  assert.equal(r.etapa, "auth");
  assert.equal(appCheckFoiChamado, false, "App Check nunca deveria ter sido avaliado — a autenticação já bloqueou");
});

await testeAsync("6. gate de payload NÃO é avaliado quando o App Check bloqueou", async () => {
  const { spy, contagem } = _criarSpyFetch();
  const r = await _fluxoCompleto({
    authHeader: "Bearer x", verificarIdToken: _verificarTokenAuthValido,
    appCheckHeader: undefined, verificarAppCheckToken: _verificarAppCheckValido,
    camposObrigatorios: { prompt: "x" }, fetchImpl: spy,
  });
  assert.equal(r.etapa, "appcheck");
  assert.equal(contagem(), 0, "gate de payload nem deveria ter sido avaliado");
});

await testeAsync("7. Anthropic (spy) nunca é chamada quando App Check bloqueia", async () => {
  const { spy, contagem } = _criarSpyFetch();
  await _fluxoCompleto({
    authHeader: "Bearer x", verificarIdToken: _verificarTokenAuthValido,
    appCheckHeader: "token-invalido", verificarAppCheckToken: _verificarAppCheckInvalido,
    camposObrigatorios: { prompt: "x" }, fetchImpl: spy,
  });
  assert.equal(contagem(), 0);
});

await testeAsync("8. fluxo completo autorizado (Auth + App Check + payload válido) chega à Anthropic (spy 1x)", async () => {
  const { spy, contagem } = _criarSpyFetch();
  const r = await _fluxoCompleto({
    authHeader: "Bearer x", verificarIdToken: _verificarTokenAuthValido,
    appCheckHeader: "token-valido", verificarAppCheckToken: _verificarAppCheckValido,
    camposObrigatorios: { prompt: "x" }, fetchImpl: spy,
  });
  assert.equal(r.etapa, "payload");
  assert.equal(r.autorizado, true);
  assert.equal(contagem(), 1);
});

// ─── 9. resposta sanitizada ───────────────────────────────────────────────────

await testeAsync("9. resposta do App Check nunca contém o token bruto nem stack trace", async () => {
  const tokenSecreto = "APPCHECK_TOKEN_SECRETO_NUNCA_APARECE";
  const r1 = await avaliarAppCheck({ appCheckHeader: tokenSecreto, verificarAppCheckToken: _verificarAppCheckInvalido });
  assert.ok(!JSON.stringify(r1).includes(tokenSecreto));
  assert.ok(!JSON.stringify(r1).includes(".js:"), "não deveria conter referência a stack trace");
});

// ─── 10-12. estrutural — fiação real em functions/index.js ───────────────────

function _corpoGerarQuestoesIA() {
  const src = fs.readFileSync(path.join(_raiz, "functions/index.js"), "utf8");
  const idxFuncao = src.indexOf("exports.gerarQuestoesIA");
  const idxProxima = src.indexOf("exports.extrairProvaINEP");
  return src.slice(idxFuncao, idxProxima !== -1 ? idxProxima : undefined);
}

teste("10. [estrutural] gerarQuestoesIA avalia App Check DEPOIS da autenticação e ANTES do gate de payload", () => {
  const corpo = _corpoGerarQuestoesIA();
  const idxAuth = corpo.indexOf("avaliarAutenticacaoEAutorizacao(");
  const idxAppCheck = corpo.indexOf("avaliarAppCheck(");
  const idxGate = corpo.indexOf("chamarAnthropicViaGate(");
  assert.ok(idxAuth !== -1 && idxAppCheck !== -1 && idxGate !== -1, "algum dos 3 marcadores não foi encontrado");
  assert.ok(idxAuth < idxAppCheck, "autenticação deveria vir antes do App Check");
  assert.ok(idxAppCheck < idxGate, "App Check deveria vir antes do gate de payload");
});

teste("11. [estrutural] CORS de gerarQuestoesIA permite o header X-Firebase-AppCheck", () => {
  const corpo = _corpoGerarQuestoesIA();
  assert.match(corpo, /Access-Control-Allow-Headers["'],?\s*["'][^"']*X-Firebase-AppCheck/i);
});

teste("12. [estrutural] OPTIONS/método continuam sendo checados antes do App Check", () => {
  const corpo = _corpoGerarQuestoesIA();
  const idxOptions = corpo.indexOf('req.method === "OPTIONS"');
  const idxMetodo = corpo.indexOf("res.status(405)");
  const idxAppCheck = corpo.indexOf("avaliarAppCheck(");
  assert.ok(idxOptions !== -1 && idxMetodo !== -1 && idxAppCheck !== -1);
  assert.ok(idxOptions < idxAppCheck && idxMetodo < idxAppCheck, "CORS/preflight/método deveriam continuar antes do App Check");
});

console.log(`\n${passou}/${passou + falhas.length} testes passaram.`);
if (falhas.length > 0) {
  console.log("\nFALHAS:");
  falhas.forEach(f => console.log(`- ${f.nome}: ${f.erro}`));
  process.exit(1);
}
