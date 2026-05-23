/**
 * questoesCache.js — Cache de sessão para a coleção "questoes"
 *
 * PROBLEMA: getDocs(collection(db, "questoes")) era chamado em 4 componentes
 * diferentes sem qualquer cache. Com 1.000 docs e vários usuários, isso
 * gera dezenas de milhares de leituras por hora no Firestore → custo alto.
 *
 * SOLUÇÃO: Cache em memória de módulo. A primeira chamada faz getDocs;
 * todas as seguintes retornam os dados já carregados. O cache dura enquanto
 * a aba do browser estiver aberta (não persiste entre sessões — sem risco
 * de dados obsoletos para o usuário final).
 *
 * USO:
 *   import { getQuestoes, invalidarCacheQuestoes } from "../utils/questoesCache";
 *
 *   // leitura — usa cache automaticamente
 *   const questoes = await getQuestoes();
 *
 *   // após salvar novas questões no Firestore, invalide o cache:
 *   invalidarCacheQuestoes();
 */

import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

// Dados em memória — compartilhados por todos os componentes nesta aba
let _cache = null;
// Promise em andamento — impede getDocs paralelos se dois componentes
// chamarem getQuestoes() ao mesmo tempo antes do primeiro completar
let _promise = null;

/**
 * Retorna todos os documentos da coleção "questoes".
 * Faz getDocs apenas na primeira chamada (ou após invalidarCacheQuestoes).
 *
 * @param {boolean} forceRefresh - Ignora o cache e relê o Firestore.
 * @returns {Promise<Array>} Lista de questões { id, ...data }
 */
export async function getQuestoes(forceRefresh = false) {
  if (!forceRefresh && _cache) return _cache;

  // Se já há uma leitura em andamento, aguarda ela em vez de fazer outra
  if (_promise) return _promise;

  _promise = getDocs(collection(db, "questoes"))
    .then((snap) => {
      _cache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      _promise = null;
      return _cache;
    })
    .catch((err) => {
      _promise = null;
      throw err;
    });

  return _promise;
}

/**
 * Invalida o cache — chame após inserir, editar ou excluir questões no Firestore.
 * A próxima chamada a getQuestoes() fará um getDocs fresco.
 */
export function invalidarCacheQuestoes() {
  _cache = null;
  _promise = null;
}
