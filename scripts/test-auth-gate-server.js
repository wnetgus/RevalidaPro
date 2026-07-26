// ─── TESTES — AUTENTICAÇÃO E AUTORIZAÇÃO END-TO-END (Micro Sprint 4B.1) ──────
// Script Node puro, mesmo padrão de scripts/test-ia-gate-server.js e
// scripts/test-diretrizes-governanca.js. functions/authGate.js e
// functions/gate.js não dependem de firebase-admin/firebase-functions em
// tempo de import — verificarIdToken e fetchImpl são sempre injetados como
// mocks. Zero rede real, zero Firebase real, zero Firestore, zero Anthropic.
//   node scripts/test-auth-gate-server.js
// Sai com código 1 se qualquer assert falhar.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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

const EMAIL_AUTORIZADO = EMAILS_AUTORIZADOS_IA[0];
const _verificarTokenValido = async (token) => ({ email: EMAIL_AUTORIZADO, uid: "uid-teste", token });
const _verificarTokenNaoAutorizado = async () => ({ email: "estranho@exemplo.com", uid: "uid-x" });
const _verificarTokenLancaErro = async () => { throw new Error("Firebase ID token has expired."); };

// ─── 1-6: falhas de autenticação (token) ─────────────────────────────────────

await testeAsync("1. token ausente (sem header Authorization) → 401", async () => {
  const r = await avaliarAutenticacaoEAutorizacao({ authHeader: "", verificarIdToken: _verificarTokenValido });
  assert.equal(r.ok, false);
  assert.equal(r.httpStatus, 401);
});

await testeAsync("2. Authorization sem \"Bearer\" → 401", async () => {
  const r = await avaliarAutenticacaoEAutorizacao({ authHeader: "Token abc123", verificarIdToken: _verificarTokenValido });
  assert.equal(r.ok, false);
  assert.equal(r.httpStatus, 401);
});

await testeAsync("3. Bearer vazio (\"Bearer \" sem token) → 401", async () => {
  const r = await avaliarAutenticacaoEAutorizacao({ authHeader: "Bearer ", verificarIdToken: _verificarTokenValido });
  assert.equal(r.ok, false);
  assert.equal(r.httpStatus, 401);
});

await testeAsync("4. token inválido (verificador rejeita) → 401", async () => {
  const verificarInvalido = async () => { throw new Error("Decoding Firebase ID token failed."); };
  const r = await avaliarAutenticacaoEAutorizacao({ authHeader: "Bearer token-invalido", verificarIdToken: verificarInvalido });
  assert.equal(r.ok, false);
  assert.equal(r.httpStatus, 401);
});

await testeAsync("5. token expirado → 401", async () => {
  const r = await avaliarAutenticacaoEAutorizacao({ authHeader: "Bearer token-expirado", verificarIdToken: _verificarTokenLancaErro });
  assert.equal(r.ok, false);
  assert.equal(r.httpStatus, 401);
});

await testeAsync("6. verificador lança exceção genérica → bloqueia (401), não propaga", async () => {
  const verificarQuebrado = async () => { throw new TypeError("erro interno inesperado do verificador"); };
  let r;
  await assert.doesNotReject(async () => {
    r = await avaliarAutenticacaoEAutorizacao({ authHeader: "Bearer x", verificarIdToken: verificarQuebrado });
  });
  assert.equal(r.ok, false);
  assert.equal(r.httpStatus, 401);
});

// ─── 7-10: autorização ────────────────────────────────────────────────────────

await testeAsync("7. usuário autenticado mas sem autorização (e-mail fora da allowlist) → 403", async () => {
  const r = await avaliarAutenticacaoEAutorizacao({ authHeader: "Bearer x", verificarIdToken: _verificarTokenNaoAutorizado });
  assert.equal(r.ok, false);
  assert.equal(r.httpStatus, 403);
});

await testeAsync("8. configuração de autorização ausente (allowlist vazia) → bloqueia, nunca libera por padrão", async () => {
  const r = await avaliarAutenticacaoEAutorizacao({ authHeader: "Bearer x", verificarIdToken: _verificarTokenValido, allowlist: [] });
  assert.equal(r.ok, false);
  assert.equal(r.httpStatus, 403);
});

await testeAsync("9. e-mail enviado em outro lugar (ex.: body) não concede autorização — só o token verificado conta", async () => {
  // O módulo nem aceita um parâmetro de "email reivindicado" — só lê
  // decoded.email do retorno do verificador. Simula um verificador cujo
  // token decodificado tem e-mail diferente do que um atacante poderia
  // reivindicar em outro campo da requisição.
  const verificarComEmailReal = async () => ({ email: "atacante@exemplo.com" });
  const r = await avaliarAutenticacaoEAutorizacao({
    authHeader: "Bearer x",
    verificarIdToken: verificarComEmailReal,
    // mesmo que um chamador (por engano) tentasse passar isso, a função não
    // tem parâmetro para isso — não há como o corpo da requisição influenciar.
  });
  assert.equal(r.ok, false, "e-mail do token (atacante@exemplo.com) não está na allowlist — deve bloquear, não confiar em nada externo ao token");
});

await testeAsync("10. flag isAdmin não é um parâmetro aceito — não pode conceder autorização", async () => {
  const r = await avaliarAutenticacaoEAutorizacao({
    authHeader: "Bearer x",
    verificarIdToken: _verificarTokenNaoAutorizado,
    isAdmin: true, // ignorado — a função não lê isso de lugar nenhum
  });
  assert.equal(r.ok, false, "isAdmin não deveria influenciar a decisão de forma alguma");
});

// ─── 11-15: integração autenticação + gate de payload (spy, zero rede real) ──

function _criarSpyFetch(respostaSimulada = { ok: true, json: async () => ({ content: [] }) }) {
  let chamadas = 0;
  const spy = async () => { chamadas++; return respostaSimulada; };
  return { spy, contagem: () => chamadas };
}

async function _fluxoCompletoSimulado({ authHeader, verificarIdToken, camposObrigatorios, fetchImpl }) {
  const autenticacao = await avaliarAutenticacaoEAutorizacao({ authHeader, verificarIdToken });
  if (!autenticacao.ok) return { etapa: "auth", ...autenticacao };
  const gatePayload = await chamarAnthropicViaGate({
    gateParams: { apiKey: "chave-teste", camposObrigatorios },
    corpo: { messages: [] },
    fetchImpl,
  });
  return { etapa: "payload", autorizado: gatePayload.autorizado, motivo: gatePayload.motivo };
}

await testeAsync("11. token válido e autorizado alcança o gate de payload", async () => {
  const { spy } = _criarSpyFetch();
  const r = await _fluxoCompletoSimulado({
    authHeader: "Bearer x", verificarIdToken: _verificarTokenValido,
    camposObrigatorios: { prompt: "x" }, fetchImpl: spy,
  });
  assert.equal(r.etapa, "payload", "deveria ter passado da autenticação e chegado ao gate de payload");
});

await testeAsync("12. token válido e autorizado + payload bloqueado → 0 chamadas à Anthropic", async () => {
  const { spy, contagem } = _criarSpyFetch();
  const r = await _fluxoCompletoSimulado({
    authHeader: "Bearer x", verificarIdToken: _verificarTokenValido,
    camposObrigatorios: { prompt: undefined }, fetchImpl: spy,
  });
  assert.equal(r.autorizado, false);
  assert.equal(contagem(), 0);
});

await testeAsync("13. token válido, autorizado, payload válido → spy da Anthropic chamado 1x", async () => {
  const { spy, contagem } = _criarSpyFetch();
  const r = await _fluxoCompletoSimulado({
    authHeader: "Bearer x", verificarIdToken: _verificarTokenValido,
    camposObrigatorios: { prompt: "x" }, fetchImpl: spy,
  });
  assert.equal(r.autorizado, true);
  assert.equal(contagem(), 1);
});

await testeAsync("14. token inválido + payload válido → 0 chamadas à Anthropic (bloqueia antes do gate de payload)", async () => {
  const { spy, contagem } = _criarSpyFetch();
  const r = await _fluxoCompletoSimulado({
    authHeader: "Bearer x", verificarIdToken: _verificarTokenLancaErro,
    camposObrigatorios: { prompt: "x" }, fetchImpl: spy,
  });
  assert.equal(r.etapa, "auth");
  assert.equal(r.httpStatus, 401);
  assert.equal(contagem(), 0, "gate de payload nem deveria ser avaliado — a autenticação já bloqueou");
});

await testeAsync("15. token válido sem autorização + payload válido → 0 chamadas à Anthropic", async () => {
  const { spy, contagem } = _criarSpyFetch();
  const r = await _fluxoCompletoSimulado({
    authHeader: "Bearer x", verificarIdToken: _verificarTokenNaoAutorizado,
    camposObrigatorios: { prompt: "x" }, fetchImpl: spy,
  });
  assert.equal(r.etapa, "auth");
  assert.equal(r.httpStatus, 403);
  assert.equal(contagem(), 0);
});

// ─── 16-17: mensagens nunca expõem segredos ──────────────────────────────────

teste("16. nenhuma mensagem de motivo contém o token bruto", async () => {
  const tokenSecreto = "eyJhbGciOiJSUzI1NiIsInNECRETO_NUNCA_DEVE_APARECER";
  const resultados = [];
  return (async () => {
    resultados.push(await avaliarAutenticacaoEAutorizacao({ authHeader: "", verificarIdToken: _verificarTokenValido }));
    resultados.push(await avaliarAutenticacaoEAutorizacao({ authHeader: `Bearer ${tokenSecreto}`, verificarIdToken: _verificarTokenLancaErro }));
    resultados.push(await avaliarAutenticacaoEAutorizacao({ authHeader: `Bearer ${tokenSecreto}`, verificarIdToken: _verificarTokenNaoAutorizado }));
    for (const r of resultados) {
      assert.ok(!JSON.stringify(r).includes(tokenSecreto), "motivo/resultado não deveria conter o token bruto");
    }
  })();
});

await testeAsync("17. nenhuma mensagem de motivo contém a API key", async () => {
  const apiKeySecreta = "sk-ant-SECRETA-NUNCA-DEVE-APARECER";
  const { spy } = _criarSpyFetch();
  const resultado = await chamarAnthropicViaGate({
    gateParams: { apiKey: apiKeySecreta, camposObrigatorios: { prompt: undefined } },
    corpo: { messages: [] },
    fetchImpl: spy,
  });
  assert.ok(!JSON.stringify(resultado).includes(apiKeySecreta), "motivo do gate não deveria conter a API key");

  const autenticacao = await avaliarAutenticacaoEAutorizacao({ authHeader: "Bearer x", verificarIdToken: _verificarTokenNaoAutorizado });
  assert.ok(!JSON.stringify(autenticacao).includes(apiKeySecreta));
});

// ─── 18-19: estrutural — método/CORS continuam antes da autenticação ────────

teste("18. [estrutural] método não permitido (405) é checado ANTES da autenticação em gerarQuestoesIA", () => {
  const src = fs.readFileSync(path.join(_raiz, "functions/index.js"), "utf8");
  const idxFuncao = src.indexOf("exports.gerarQuestoesIA");
  const idxProxima = src.indexOf("exports.extrairProvaINEP");
  const corpo = src.slice(idxFuncao, idxProxima !== -1 ? idxProxima : undefined);
  const idxMetodo = corpo.indexOf('res.status(405)');
  const idxAuth = corpo.indexOf("avaliarAutenticacaoEAutorizacao(");
  assert.ok(idxMetodo !== -1 && idxAuth !== -1, "checagem de método ou de autenticação não encontrada");
  assert.ok(idxMetodo < idxAuth, "método não permitido deveria ser checado antes da autenticação");
});

teste("19. [estrutural] preflight CORS (OPTIONS) continua respondendo antes da autenticação", () => {
  const src = fs.readFileSync(path.join(_raiz, "functions/index.js"), "utf8");
  const idxFuncao = src.indexOf("exports.gerarQuestoesIA");
  const idxProxima = src.indexOf("exports.extrairProvaINEP");
  const corpo = src.slice(idxFuncao, idxProxima !== -1 ? idxProxima : undefined);
  const idxOptions = corpo.indexOf('req.method === "OPTIONS"');
  const idxAuth = corpo.indexOf("avaliarAutenticacaoEAutorizacao(");
  assert.ok(idxOptions !== -1 && idxAuth !== -1);
  assert.ok(idxOptions < idxAuth, "OPTIONS/CORS deveria continuar sendo respondido antes de qualquer autenticação");
});

// ─── 20: exceção inesperada permanece fail-closed ────────────────────────────

await testeAsync("20. exceção inesperada (authHeader de tipo imprevisto) permanece fail-closed", async () => {
  let r;
  await assert.doesNotReject(async () => {
    r = await avaliarAutenticacaoEAutorizacao({ authHeader: { isso: "não deveria ser um objeto" }, verificarIdToken: _verificarTokenValido });
  });
  assert.equal(r.ok, false);
  assert.ok(r.httpStatus === 401 || r.httpStatus === 403, "deve bloquear com um status de erro, nunca autorizar");
});

// ─── Estrutural adicional: gerarQuestoesIA usa o módulo de auth, e a ordem geral é auth → gate → Anthropic

teste("21. [estrutural] gerarQuestoesIA chama avaliarAutenticacaoEAutorizacao ANTES de chamarAnthropicViaGate", () => {
  const src = fs.readFileSync(path.join(_raiz, "functions/index.js"), "utf8");
  const idxFuncao = src.indexOf("exports.gerarQuestoesIA");
  const idxProxima = src.indexOf("exports.extrairProvaINEP");
  const corpo = src.slice(idxFuncao, idxProxima !== -1 ? idxProxima : undefined);
  const idxAuth = corpo.indexOf("avaliarAutenticacaoEAutorizacao(");
  const idxGate = corpo.indexOf("chamarAnthropicViaGate(");
  assert.ok(idxAuth !== -1 && idxGate !== -1);
  assert.ok(idxAuth < idxGate, "autenticação deveria ser avaliada antes do gate de payload");
});

console.log(`\n${passou}/${passou + falhas.length} testes passaram.`);
if (falhas.length > 0) {
  console.log("\nFALHAS:");
  falhas.forEach(f => console.log(`- ${f.nome}: ${f.erro}`));
  process.exit(1);
}
