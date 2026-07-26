/**
 * authGate.js — Autenticação e autorização end-to-end para gerarQuestoesIA
 * (Micro Sprint 4B.1: "Autenticação e Autorização End-to-End").
 *
 * Responsabilidade única: decidir se o CHAMADOR pode prosseguir — ANTES do
 * gate de payload (functions/gate.js) e antes de qualquer chamada à
 * Anthropic. Não chama Anthropic, não valida payload, não faz rate limit,
 * não usa App Check — cada responsabilidade fica isolada no seu próprio
 * módulo (ordem em gerarQuestoesIA: CORS/método → autenticação/autorização
 * [este módulo] → gate de payload → Anthropic).
 *
 * Autorização: allowlist de e-mail verificado no token — mesmo CONCEITO já
 * versionado em src/App.jsx (`EMAILS_ADMIN`), usado para liberar a rota
 * /admin onde RoboGerador/ImportadorPro/ResumoGerador são renderizados.
 * Reimplementado aqui de forma independente e isolada — não é uma cópia do
 * `verificarAdmin` que já existe em functions/index.js, porque aquele vive
 * na mesma região não commitada de `extrairProvaINEP` (trabalho paralelo,
 * fora do produto versionado); este módulo é uma implementação nova,
 * própria desta sprint. O projeto não tem custom claims Firebase confiáveis
 * hoje, e este módulo deliberadamente não consulta Firestore para checar
 * `role` (evitável e fora do escopo desta sprint) — ver PENDÊNCIAS.
 *
 * Fail-closed: token ausente/malformado/inválido/expirado, erro do
 * verificador, e-mail fora da allowlist, ou allowlist vazia/mal configurada
 * — todos bloqueiam. Nenhum motivo retornado ao chamador contém o token, o
 * erro bruto do SDK ou qualquer segredo — só mensagens genéricas fixas.
 */

const EMAILS_AUTORIZADOS_IA = ["drweynesouza@gmail.com", "wnetgus@gmail.com"];

function _extrairBearer(authHeader) {
  if (!authHeader || typeof authHeader !== "string") return null;
  const partes = authHeader.split(" ");
  if (partes.length !== 2 || partes[0] !== "Bearer" || !partes[1]) return null;
  return partes[1];
}

// `verificarIdToken` é injetável — em produção é `(token) =>
// admin.auth().verifyIdToken(token, true)` (checkRevoked:true desde a Micro
// Sprint 4B.3A — rejeita também sessão revogada/usuário desabilitado, além
// de inválido/expirado); nos testes locais é um mock, nunca a rede/Firebase
// real (ver scripts/test-auth-gate-server.js). Esta função NÃO distingue o
// motivo do erro do verificador — qualquer exceção (revogado, desabilitado,
// expirado, inválido, ou falha de comunicação com o Firebase Auth) já cai no
// catch genérico abaixo e bloqueia com a mesma mensagem fail-closed. Por
// isso o checkRevoked não exigiu nenhuma mudança de lógica aqui.
async function avaliarAutenticacaoEAutorizacao({ authHeader, verificarIdToken, allowlist = EMAILS_AUTORIZADOS_IA } = {}) {
  try {
    const token = _extrairBearer(authHeader);
    if (!token) {
      return { ok: false, httpStatus: 401, motivo: "Token de autenticação ausente ou malformado." };
    }
    if (typeof verificarIdToken !== "function") {
      return { ok: false, httpStatus: 401, motivo: "Verificador de autenticação indisponível." };
    }

    let decoded;
    try {
      decoded = await verificarIdToken(token);
    } catch {
      // Cobre token inválido, expirado, assinatura incorreta, ou qualquer
      // falha interna do próprio verificador — todas fail-closed, mesmo
      // código, mesma mensagem genérica (nunca expõe o erro original).
      return { ok: false, httpStatus: 401, motivo: "Token inválido, expirado ou não verificável." };
    }

    const email = decoded && typeof decoded === "object" ? decoded.email : null;

    if (!Array.isArray(allowlist) || allowlist.length === 0) {
      // Configuração ausente/inválida — nunca libera por padrão.
      return { ok: false, httpStatus: 403, motivo: "Autorização não configurada no servidor." };
    }
    if (!email || !allowlist.includes(email)) {
      return { ok: false, httpStatus: 403, motivo: "Usuário autenticado, mas não autorizado." };
    }

    return { ok: true, httpStatus: 200, motivo: null, email };
  } catch {
    // Qualquer exceção inesperada durante a avaliação (ex.: authHeader de
    // tipo/forma imprevista) — fail-closed, nunca propaga, nunca libera.
    return { ok: false, httpStatus: 401, motivo: "Erro ao avaliar autenticação." };
  }
}

module.exports = { avaliarAutenticacaoEAutorizacao, EMAILS_AUTORIZADOS_IA };
