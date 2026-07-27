/**
 * appCheckGate.js — Verificação de Firebase App Check para gerarQuestoesIA
 * (Micro Sprint 4B.3B.1: "App Check — Infraestrutura (sem Console)").
 *
 * Responsabilidade única: decidir se a CHAMADA vem de uma instância legítima
 * do app (não decide QUEM é o usuário — isso é authGate.js; não valida
 * payload — isso é gate.js; não chama Anthropic). Mesmo padrão arquitetural
 * de authGate.js: verificador injetável, fail-closed, mensagens genéricas
 * fixas, sem exposição de detalhe interno.
 *
 * Ordem em gerarQuestoesIA: CORS/método → authGate (autenticação +
 * autorização) → appCheckGate (este módulo) → gate.js (payload) →
 * Anthropic. App Check nunca é avaliado se a autenticação já bloqueou, e o
 * gate de payload nunca é avaliado se o App Check bloqueou.
 *
 * Nesta sprint (4B.3B.1) não existe nenhuma configuração real de App Check
 * no Firebase Console (site key, debug token, enforcement) — este módulo já
 * é funcional e completamente testável via injeção do verificador, mas a
 * integração ponta a ponta com um provider real só é possível depois da
 * configuração externa (sprint futura, fora deste escopo).
 */

async function avaliarAppCheck({ appCheckHeader, verificarAppCheckToken } = {}) {
  try {
    if (!appCheckHeader || typeof appCheckHeader !== "string") {
      return { ok: false, httpStatus: 401, motivo: "Token de App Check ausente." };
    }
    if (typeof verificarAppCheckToken !== "function") {
      return { ok: false, httpStatus: 401, motivo: "Verificador de App Check indisponível." };
    }

    try {
      await verificarAppCheckToken(appCheckHeader);
    } catch {
      // Cobre token inválido, malformado, expirado, ou qualquer falha
      // interna do próprio verificador — todas fail-closed, mesmo código,
      // mesma mensagem genérica (nunca expõe o erro original do SDK).
      return { ok: false, httpStatus: 401, motivo: "Token de App Check inválido ou não verificável." };
    }

    return { ok: true, httpStatus: 200, motivo: null };
  } catch {
    // Qualquer exceção inesperada durante a avaliação — fail-closed, nunca
    // propaga, nunca libera.
    return { ok: false, httpStatus: 401, motivo: "Erro ao avaliar App Check." };
  }
}

module.exports = { avaliarAppCheck };
