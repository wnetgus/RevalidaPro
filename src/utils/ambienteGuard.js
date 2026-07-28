/**
 * ambienteGuard.js — Guarda de ambiente para controles administrativos
 * restritos ao DEV (ex.: regeneração isolada de resumo, RoboGerador.jsx).
 *
 * Pura e sem dependência de Firebase/rede — testável em Node puro.
 * Fail-closed por design: qualquer valor que não seja EXATAMENTE
 * "revalidapro-dev" (ausente, vazio, undefined, produção, erro de
 * digitação) resulta em NÃO autorizado. Nunca infira "é DEV" por hostname,
 * NODE_ENV ou heurística — só pelo projectId realmente inicializado.
 */

export const PROJECT_ID_DEV_PERMITIDO = "revalidapro-dev";

export function ambienteDevAutorizado(projectId) {
  return projectId === PROJECT_ID_DEV_PERMITIDO;
}
