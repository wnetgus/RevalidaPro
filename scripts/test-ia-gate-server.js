// ─── TESTES — GATE ÚNICO SERVER-SIDE PARA CHAMADAS À ANTHROPIC (Micro Sprint 4B.0) ─
// Script Node puro (mesmo padrão de scripts/test-diretrizes-governanca.js — sem
// framework novo, sem chamada de rede real). functions/gate.js não depende de
// firebase-admin/firebase-functions, então é importável aqui sem inicializar
// nenhum app Firebase nem exigir credenciais.
//   node scripts/test-ia-gate-server.js
// Sai com código 1 se qualquer assert falhar.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { avaliarGateIA, chamarAnthropicViaGate, MODELOS_PERMITIDOS } from "../functions/gate.js";

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

const API_KEY_VALIDA = "chave-de-teste-valida";

// ─── avaliarGateIA — precondições puras ──────────────────────────────────────

teste("1. chave ausente bloqueia", () => {
  const r = avaliarGateIA({ apiKey: undefined, camposObrigatorios: { prompt: "x" } });
  assert.equal(r.autorizado, false);
  assert.match(r.motivo, /chave/i);
});

teste("2. chave placeholder (\"sua_chave_aqui\") bloqueia", () => {
  const r = avaliarGateIA({ apiKey: "sua_chave_aqui", camposObrigatorios: { prompt: "x" } });
  assert.equal(r.autorizado, false);
});

teste("3. campo obrigatório ausente bloqueia", () => {
  const r = avaliarGateIA({ apiKey: API_KEY_VALIDA, camposObrigatorios: { prompt: undefined } });
  assert.equal(r.autorizado, false);
  assert.match(r.motivo, /prompt/i);
});

teste("4. campo obrigatório vazio (\"\") bloqueia", () => {
  const r = avaliarGateIA({ apiKey: API_KEY_VALIDA, camposObrigatorios: { prompt: "" } });
  assert.equal(r.autorizado, false);
});

teste("5. múltiplos campos obrigatórios — falta de qualquer um bloqueia", () => {
  const r = avaliarGateIA({ apiKey: API_KEY_VALIDA, camposObrigatorios: { pdfBase64: "abc", provaId: undefined } });
  assert.equal(r.autorizado, false);
  assert.match(r.motivo, /provaId/i);
});

teste("6. modelo fora do allowlist bloqueia", () => {
  const r = avaliarGateIA({ apiKey: API_KEY_VALIDA, model: "modelo-inventado-123", camposObrigatorios: { prompt: "x" } });
  assert.equal(r.autorizado, false);
  assert.match(r.motivo, /modelo/i);
});

teste("7. modelo dentro do allowlist libera", () => {
  const r = avaliarGateIA({ apiKey: API_KEY_VALIDA, model: MODELOS_PERMITIDOS[0], camposObrigatorios: { prompt: "x" } });
  assert.equal(r.autorizado, true);
});

teste("8. sem model (undefined) — comportamento padrão preservado, libera", () => {
  const r = avaliarGateIA({ apiKey: API_KEY_VALIDA, camposObrigatorios: { prompt: "x" } });
  assert.equal(r.autorizado, true, "chamadores que nunca enviaram 'model' não podem quebrar com esta correção");
});

teste("9. tudo correto (chave + campos + modelo válidos) libera", () => {
  const r = avaliarGateIA({ apiKey: API_KEY_VALIDA, model: "claude-sonnet-4-6", camposObrigatorios: { pdfBase64: "abc", provaId: "2026.1" } });
  assert.equal(r.autorizado, true);
});

// Fixture que lança ao ser lida — simula um erro genuíno e imprevisível
// durante a avaliação do gate (ex.: getter que falha, proxy malformado vindo
// de uma serialização inesperada do corpo da requisição).
function _camposQueExplodemAoLer() {
  const obj = {};
  Object.defineProperty(obj, "prompt", { enumerable: true, get() { throw new Error("falha simulada ao ler campo"); } });
  return obj;
}

teste("10. erro ao avaliar o gate bloqueia (fail-closed) — leitura de campo lança exceção", () => {
  assert.doesNotThrow(() => avaliarGateIA({ apiKey: API_KEY_VALIDA, camposObrigatorios: _camposQueExplodemAoLer() }));
  const r = avaliarGateIA({ apiKey: API_KEY_VALIDA, camposObrigatorios: _camposQueExplodemAoLer() });
  assert.equal(r.autorizado, false);
  assert.match(r.motivo, /erro ao avaliar/i);
});

teste("11. chamada sem nenhum parâmetro não lança e bloqueia", () => {
  assert.doesNotThrow(() => avaliarGateIA());
  assert.equal(avaliarGateIA().autorizado, false);
});

// ─── chamarAnthropicViaGate — prova de zero chamada de rede quando bloqueado ─
// fetchImpl é um spy injetado — em NENHUM teste deste arquivo a rede real
// (globalThis.fetch / api.anthropic.com) é usada.

function _criarSpyFetch(respostaSimulada = { ok: true, json: async () => ({ content: [] }) }) {
  let chamadas = 0;
  const spy = async (..._args) => { chamadas++; return respostaSimulada; };
  return { spy, contagem: () => chamadas };
}

await testeAsync("12. endpoint autorizado chega à chamada (spy invocado 1x, nenhuma rede real)", async () => {
  const { spy, contagem } = _criarSpyFetch();
  const resultado = await chamarAnthropicViaGate({
    gateParams: { apiKey: API_KEY_VALIDA, model: MODELOS_PERMITIDOS[0], camposObrigatorios: { prompt: "x" } },
    corpo: { model: MODELOS_PERMITIDOS[0], messages: [] },
    fetchImpl: spy,
  });
  assert.equal(resultado.autorizado, true);
  assert.equal(contagem(), 1, "gate autorizado deve invocar a chamada exatamente 1x");
});

await testeAsync("13. endpoint bloqueado (chave ausente) — 0 chamadas (spy)", async () => {
  const { spy, contagem } = _criarSpyFetch();
  const resultado = await chamarAnthropicViaGate({
    gateParams: { apiKey: undefined, camposObrigatorios: { prompt: "x" } },
    corpo: { messages: [] },
    fetchImpl: spy,
  });
  assert.equal(resultado.autorizado, false);
  assert.equal(contagem(), 0);
});

await testeAsync("14. endpoint bloqueado (campo obrigatório ausente) — 0 chamadas (spy)", async () => {
  const { spy, contagem } = _criarSpyFetch();
  const resultado = await chamarAnthropicViaGate({
    gateParams: { apiKey: API_KEY_VALIDA, camposObrigatorios: { prompt: undefined } },
    corpo: { messages: [] },
    fetchImpl: spy,
  });
  assert.equal(resultado.autorizado, false);
  assert.equal(contagem(), 0);
});

await testeAsync("15. endpoint bloqueado (modelo inconsistente) — 0 chamadas (spy)", async () => {
  const { spy, contagem } = _criarSpyFetch();
  const resultado = await chamarAnthropicViaGate({
    gateParams: { apiKey: API_KEY_VALIDA, model: "modelo-nao-existe", camposObrigatorios: { prompt: "x" } },
    corpo: { messages: [] },
    fetchImpl: spy,
  });
  assert.equal(resultado.autorizado, false);
  assert.equal(contagem(), 0);
});

await testeAsync("16. erro interno na avaliação do gate — 0 chamadas (spy), não lança", async () => {
  const { spy, contagem } = _criarSpyFetch();
  let resultado;
  await assert.doesNotReject(async () => {
    resultado = await chamarAnthropicViaGate({
      gateParams: { apiKey: API_KEY_VALIDA, camposObrigatorios: _camposQueExplodemAoLer() },
      corpo: { messages: [] },
      fetchImpl: spy,
    });
  });
  assert.equal(resultado.autorizado, false);
  assert.equal(contagem(), 0);
});

await testeAsync("17. exceção lançada pelo PRÓPRIO fetchImpl não corrompe a decisão de autorização já tomada", async () => {
  // O gate já decidiu autorizado:true antes de invocar fetchImpl — se a rede
  // falhar, isso é um erro de rede normal (tratado pelo chamador via try/catch
  // do endpoint), não uma falha do gate. Mesmo assim, confirma que o gate não
  // silencia o erro nem finge sucesso.
  const fetchQueFalha = async () => { throw new Error("rede indisponível (simulado)"); };
  await assert.rejects(
    () => chamarAnthropicViaGate({
      gateParams: { apiKey: API_KEY_VALIDA, camposObrigatorios: { prompt: "x" } },
      corpo: { messages: [] },
      fetchImpl: fetchQueFalha,
    }),
    /rede indisponível/
  );
});

// ─── PROVA ESTRUTURAL — nenhum endpoint chama api.anthropic.com diretamente ──

teste("18. [estrutural] gate.js é o ÚNICO lugar em functions/ que chama a URL da Anthropic", () => {
  // Checa a URL literal entre aspas (o alvo real de um fetch), não a mera
  // menção da palavra em comentários/documentação de index.js.
  const indexSrc = fs.readFileSync(path.join(_raiz, "functions/index.js"), "utf8");
  const gateSrc  = fs.readFileSync(path.join(_raiz, "functions/gate.js"), "utf8");
  assert.ok(gateSrc.includes('"https://api.anthropic.com/v1/messages"'), "gate.js deveria conter a URL literal da Anthropic");
  assert.ok(!indexSrc.includes('"https://api.anthropic.com'), "index.js NÃO deveria mais chamar a URL da Anthropic diretamente — deve passar pelo gate");
});

teste("19. [estrutural] gerarQuestoesIA usa chamarAnthropicViaGate", () => {
  const indexSrc = fs.readFileSync(path.join(_raiz, "functions/index.js"), "utf8");
  const idxFuncao = indexSrc.indexOf("exports.gerarQuestoesIA");
  const idxProxima = indexSrc.indexOf("exports.extrairProvaINEP");
  assert.ok(idxFuncao !== -1, "gerarQuestoesIA não encontrada");
  const corpo = indexSrc.slice(idxFuncao, idxProxima !== -1 ? idxProxima : undefined);
  assert.ok(corpo.includes("chamarAnthropicViaGate("), "gerarQuestoesIA deveria chamar o gate");
  assert.ok(corpo.includes("res.status(403)"), "gerarQuestoesIA deveria responder 403 quando o gate bloquear");
});

teste("20. [estrutural] extrairProvaINEP usa chamarAnthropicViaGate (se presente no working tree)", () => {
  const indexSrc = fs.readFileSync(path.join(_raiz, "functions/index.js"), "utf8");
  const idxFuncao = indexSrc.indexOf("exports.extrairProvaINEP");
  if (idxFuncao === -1) {
    console.log("   (extrairProvaINEP não presente nesta árvore de trabalho — teste ignorado sem falhar)");
    return;
  }
  const idxProxima = indexSrc.indexOf("exports.webhookMercadoPago");
  const corpo = indexSrc.slice(idxFuncao, idxProxima !== -1 ? idxProxima : undefined);
  assert.ok(corpo.includes("chamarAnthropicViaGate("), "extrairProvaINEP deveria chamar o gate");
  assert.ok(corpo.includes("res.status(403)"), "extrairProvaINEP deveria responder 403 quando o gate bloquear");
});

console.log(`\n${passou}/${passou + falhas.length} testes passaram.`);
if (falhas.length > 0) {
  console.log("\nFALHAS:");
  falhas.forEach(f => console.log(`- ${f.nome}: ${f.erro}`));
  process.exit(1);
}
