/**
 * apiAuth.js — Helper client-side para autenticar chamadas às Cloud Functions
 * de geração por IA (Micro Sprint 4B.1; estendido na 4B.3B.1 para App Check).
 *
 * Puro em relação ao Firebase: não importa `../firebase` nem `firebase/app-check`
 * diretamente — recebe a instância de auth e o obtentor de token App Check já
 * prontos como parâmetros. Isso mantém o módulo testável em Node puro (sem
 * inicializar nenhum app Firebase real) e deixa a escolha de QUAL `auth`/
 * App Check usar para cada chamador (sempre os de `../firebase`, na prática).
 *
 * `obterTokenAppCheck` é uma FUNÇÃO injetável (não a instância bruta do App
 * Check) — mesmo padrão já usado em authGate.js/gate.js no servidor
 * (verificador/fetch injetáveis). Em produção, o chamador fecha sobre a API
 * real: `() => getToken(appCheck).then(r => r.token)`. Nos testes, é um mock
 * simples. Isso evita que este módulo precise importar `firebase/app-check`
 * só para poder ser mockado.
 *
 * Compatibilidade: `obterTokenAppCheck` é OPCIONAL — chamadores existentes
 * (RoboGerador.jsx, ImportadorPro.jsx, ResumoGerador.jsx, promptEngine.js)
 * continuam chamando `obterHeadersAutenticados(auth)` com um único argumento
 * e recebem exatamente o mesmo `{ Authorization }` de sempre, sem qualquer
 * mudança de comportamento — nenhum desses arquivos foi alterado nesta
 * sprint. Só quando um futuro chamador passar o segundo argumento é que o
 * header `X-Firebase-AppCheck` passa a ser incluído.
 *
 * Nunca loga, nunca persiste nenhum dos dois tokens manualmente — sempre
 * obtidos na hora (getIdToken / obterTokenAppCheck), nunca de localStorage.
 */

export async function obterHeadersAutenticados(authInstance, obterTokenAppCheck) {
  const user = authInstance && authInstance.currentUser;
  if (!user) {
    throw new Error("Sessão não autenticada. Faça login novamente antes de gerar conteúdo.");
  }

  if (typeof obterTokenAppCheck === "function") {
    // Auth e App Check são independentes entre si — obtidos em paralelo.
    // Se qualquer um dos dois falhar, Promise.all rejeita e nada é
    // retornado: o fetch correspondente nunca chega a acontecer.
    const [token, tokenAppCheck] = await Promise.all([
      user.getIdToken(),
      obterTokenAppCheck(),
    ]);
    return { Authorization: `Bearer ${token}`, "X-Firebase-AppCheck": tokenAppCheck };
  }

  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}
