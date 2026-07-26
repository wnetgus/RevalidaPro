/**
 * gate.js — Gate único server-side para qualquer chamada à API da Anthropic.
 *
 * Micro Sprint 4B.0: fecha o bypass identificado na auditoria da 4A.2 — o
 * bloqueio de governança (avaliarBloqueioSeguro) só existia no código do
 * navegador; qualquer chamada direta ao endpoint da Cloud Function (curl,
 * Postman, script externo) ignorava esse bloqueio por completo, porque o
 * servidor nunca validava nada antes de repassar a chamada à Anthropic.
 *
 * Este módulo é puro (sem firebase-admin/firebase-functions) — não lê
 * Firestore, não conhece diretrizes clínicas, não migra nada. Escopo desta
 * sprint é exclusivamente estrutural: nenhum endpoint pode montar a chamada
 * a api.anthropic.com por conta própria; todos devem passar por
 * `chamarAnthropicViaGate`, que primeiro roda `avaliarGateIA` — e só chama a
 * rede se `autorizado` for true. Ausência, inconsistência ou erro na
 * avaliação = bloqueado (fail-closed), 0 chamadas à Anthropic.
 */

const MODELOS_PERMITIDOS = ["claude-haiku-4-5-20251001", "claude-opus-4-8", "claude-sonnet-4-6"];

// ── AVALIAR GATE — decide se a chamada pode prosseguir ──────────────────────
// Não decide NADA sobre conteúdo clínico/diretriz (fora de escopo desta
// sprint) — só valida as precondições mínimas de um pedido bem-formado:
// chave da IA configurada, campos obrigatórios presentes, modelo (quando
// informado) dentro do allowlist. Qualquer exceção durante a avaliação é
// capturada e tratada como bloqueio, nunca como liberação.
function avaliarGateIA({ apiKey, model, camposObrigatorios } = {}) {
  try {
    if (!apiKey || apiKey === "sua_chave_aqui") {
      return { autorizado: false, motivo: "Chave da IA não configurada no servidor." };
    }
    for (const [nome, valor] of Object.entries(camposObrigatorios || {})) {
      if (valor === undefined || valor === null || valor === "") {
        return { autorizado: false, motivo: `Campo obrigatório ausente ou vazio: ${nome}.` };
      }
    }
    if (model !== undefined && model !== null && !MODELOS_PERMITIDOS.includes(model)) {
      return { autorizado: false, motivo: `Modelo não permitido: "${model}".` };
    }
    return { autorizado: true, motivo: null };
  } catch (e) {
    return { autorizado: false, motivo: `Erro ao avaliar o gate de IA: ${e.message}` };
  }
}

// ── CHAMAR ANTHROPIC VIA GATE — único ponto que fala com api.anthropic.com ──
// `fetchImpl` é injetável só para teste (nunca chamado nos testes locais desta
// sprint — ver scripts/test-ia-gate-server.js). Em produção usa globalThis.fetch.
// NUNCA chama a rede se avaliarGateIA(gateParams) não autorizar.
async function chamarAnthropicViaGate({ gateParams, corpo, headersExtras = {}, fetchImpl } = {}) {
  const avaliacao = avaliarGateIA(gateParams);
  if (!avaliacao.autorizado) {
    return { autorizado: false, motivo: avaliacao.motivo, response: null };
  }
  const _fetch = fetchImpl || globalThis.fetch;
  const response = await _fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": gateParams.apiKey,
      "anthropic-version": "2023-06-01",
      ...headersExtras,
    },
    body: JSON.stringify(corpo),
  });
  return { autorizado: true, motivo: null, response };
}

module.exports = { avaliarGateIA, chamarAnthropicViaGate, MODELOS_PERMITIDOS };
