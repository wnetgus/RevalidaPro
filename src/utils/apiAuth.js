/**
 * apiAuth.js — Helper client-side para autenticar chamadas às Cloud Functions
 * de geração por IA (Micro Sprint 4B.1).
 *
 * Puro em relação ao Firebase: não importa `../firebase` diretamente — recebe
 * a instância de auth já inicializada como parâmetro. Isso mantém o módulo
 * testável em Node puro (sem inicializar nenhum app Firebase real) e deixa a
 * escolha de QUAL `auth` usar para cada chamador (sempre `../firebase`, na
 * prática).
 *
 * Nunca loga, nunca persiste o token manualmente — sempre obtido na hora via
 * Firebase Auth (`getIdToken`), nunca de localStorage.
 */

export async function obterHeadersAutenticados(authInstance) {
  const user = authInstance && authInstance.currentUser;
  if (!user) {
    throw new Error("Sessão não autenticada. Faça login novamente antes de gerar conteúdo.");
  }
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}
