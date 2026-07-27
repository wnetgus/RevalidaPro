/**
 * appCheckDebug.js — Deriva o valor de self.FIREBASE_APPCHECK_DEBUG_TOKEN a
 * partir de VITE_FIREBASE_APPCHECK_DEBUG (Micro Sprint 4B.3B.2A).
 *
 * Função pura, sem nenhuma dependência do Firebase — extraída de
 * src/firebase.js especificamente para ser testável em Node puro (que não
 * tem `import.meta.env`; importar src/firebase.js diretamente crasharia
 * fora do Vite, pois o módulo lê `import.meta.env.*` no top-level).
 *
 * Três modos, nunca ativos por padrão (retorno `undefined` = Debug Provider
 * desligado, nada deve ser atribuído a `self.FIREBASE_APPCHECK_DEBUG_TOKEN`):
 *   - ausente ou vazia (após trim): `undefined`.
 *   - "true" (tolerante a espaços e caixa — "TRUE", " true " etc.): `true`
 *     — modo automático do SDK, que GERA um token novo a cada execução.
 *   - qualquer outra string não vazia: devolvida como está — usada como
 *     TOKEN FIXO, registrado uma única vez no Console App Check e
 *     reaproveitado entre reinícios (em vez de mudar a cada execução).
 */
export function calcularAppCheckDebugToken(valorBruto) {
  const valor = typeof valorBruto === "string" ? valorBruto.trim() : "";
  if (!valor) return undefined;
  return valor.toLowerCase() === "true" ? true : valor;
}
