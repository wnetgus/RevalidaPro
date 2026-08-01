/**
 * inventarioSA.js — Análise pura e read-only do inventário de questões da
 * Super Apostas (coleção `questoes`, edição 2026_2).
 *
 * Ferramenta TEMPORÁRIA, DEV-only (gate em RoboGerador.jsx via
 * ambienteDevAutorizado), criada para reconciliar a divergência documental
 * de Q1–Q29 identificada em CONTROLE_PRODUCAO_SUPERAPOSTAS_2026_2.md antes
 * da produção em lote. Não decide nada sozinha — só expõe o estado real.
 *
 * Pura e sem dependência de Firebase/rede — testável em Node puro. Recebe
 * uma lista de objetos já extraídos do Firestore (nunca os snapshots), para
 * manter o I/O (getDocs) isolado no componente e esta função 100% testável.
 */

// Contrato de validade de numeroQuestao: tipo number, inteiro, finito e > 0.
// Number.isInteger() já rejeita string ("2"), NaN e Infinity sem nenhuma
// coerção — não há conversão implícita de string para número em nenhum
// ponto desta função.
const numeroQuestaoValido = (v) => Number.isInteger(v) && v > 0;

export const analisarInventarioSA = (docs) => {
  const lista = Array.isArray(docs) ? docs : [];

  const comNumero = lista.filter((d) => numeroQuestaoValido(d?.numeroQuestao));
  const semNumero = lista.filter((d) => !numeroQuestaoValido(d?.numeroQuestao));

  const numeros = comNumero.map((d) => d.numeroQuestao);
  const menor = numeros.length ? Math.min(...numeros) : null;
  const maior = numeros.length ? Math.max(...numeros) : null;

  const ausentes = [];
  if (menor !== null && maior !== null) {
    const presentes = new Set(numeros);
    for (let n = menor; n <= maior; n++) {
      if (!presentes.has(n)) ausentes.push(n);
    }
  }

  const contagemPorNumero = new Map();
  comNumero.forEach((d) => {
    contagemPorNumero.set(d.numeroQuestao, (contagemPorNumero.get(d.numeroQuestao) || 0) + 1);
  });
  const duplicados = [...contagemPorNumero.entries()]
    .filter(([, qtd]) => qtd > 1)
    .map(([numero]) => numero)
    .sort((a, b) => a - b);

  // documentId e data.id são identificadores DISTINTOS — cada um analisado
  // isoladamente, sem fallback de um para o outro. Ausente/null/"" nunca
  // conta como valor, para não gerar falsa duplicidade entre documentos que
  // simplesmente não têm o campo preenchido.
  const contarPorChave = (extrator) => {
    const contagem = new Map();
    lista.forEach((d) => {
      const valor = extrator(d);
      if (typeof valor !== "string" || valor.trim() === "") return;
      contagem.set(valor, (contagem.get(valor) || 0) + 1);
    });
    return [...contagem.entries()].filter(([, qtd]) => qtd > 1).map(([v]) => v);
  };

  const documentIdsDuplicados = contarPorChave((d) => d?.documentId);
  const idsDuplicados = contarPorChave((d) => d?.id);

  // Ordenação estável por numeroQuestao — documentos com número inválido ou
  // ausente vão ao final, na ordem original entre si (Infinity nunca
  // desempata incorretamente porque Array.prototype.sort é estável em todos
  // os motores modernos).
  const tabela = [...lista].sort((a, b) => {
    const na = numeroQuestaoValido(a?.numeroQuestao) ? a.numeroQuestao : Infinity;
    const nb = numeroQuestaoValido(b?.numeroQuestao) ? b.numeroQuestao : Infinity;
    return na - nb;
  });

  return {
    total: lista.length,
    menor,
    maior,
    ausentes,
    duplicados,
    documentIdsDuplicados,
    idsDuplicados,
    semNumero,
    tabela,
    json: JSON.stringify(tabela, null, 2),
  };
};
