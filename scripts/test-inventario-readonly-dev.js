// ─── TESTES — INVENTÁRIO READ-ONLY DEV (ferramenta temporária) ─────────────
// Mesmo padrão dos demais scripts desta família (Node puro, zero rede real,
// zero Firebase real, zero IA real). O helper puro (analisarInventarioSA) é
// importado diretamente de src/utils/inventarioSA.js (módulo plain-JS, sem
// JSX — não precisa de extração). O handler do painel
// (gerarInventarioReadOnlySA) é extraído do CÓDIGO-FONTE REAL de
// RoboGerador.jsx via regex/indexOf e executado via `new Function` com
// todas as dependências externas mockadas — mesma técnica de
// test-piloto-controlado-dev.js.
//
//   node scripts/test-inventario-readonly-dev.js

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ambienteDevAutorizado } from "../src/utils/ambienteGuard.js";
import { analisarInventarioSA } from "../src/utils/inventarioSA.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _raiz = path.resolve(__dirname, "..");

function normalizarQuebraDeLinha(conteudo) {
  return conteudo.replace(/\r\n?/g, "\n");
}

const roboSrc = normalizarQuebraDeLinha(fs.readFileSync(path.join(_raiz, "src/components/RoboGerador.jsx"), "utf8"));

let passou = 0;
const falhas = [];
async function teste(nome, fn) {
  try {
    await fn();
    passou++;
    console.log(`✅ ${nome}`);
  } catch (e) {
    falhas.push({ nome, erro: e.message });
    console.log(`❌ ${nome} — ${e.message}`);
  }
}

// ── Extração do handler real do painel ──────────────────────────────────────
function extrairFuncaoAsync(nome) {
  const re = new RegExp(`const ${nome} = async \\(\\) => \\{[\\s\\S]*?\\n  \\};`);
  const m = roboSrc.match(re);
  assert.ok(m, `função assíncrona "${nome}" não encontrada no código-fonte real`);
  return m[0];
}

const blocoGerarInventario = extrairFuncaoAsync("gerarInventarioReadOnlySA");

// Trecho JSX do painel (do marcador de comentário até o próximo painel/bloco).
const idxPainelJSX = roboSrc.indexOf("INVENTÁRIO READ-ONLY DEV (TEMPORÁRIO) ────");
assert.ok(idxPainelJSX > -1, "marcador do painel JSX não encontrado");
const idxFimPainelJSX = roboSrc.indexOf("{/* ── CONFIGURAÇÃO", idxPainelJSX);
assert.ok(idxFimPainelJSX > idxPainelJSX, "fim do painel JSX (marcador de Configuração) não encontrado");
const blocoPainelJSX = roboSrc.slice(idxPainelJSX, idxFimPainelJSX);

// ═════════════════════════════════════════════════════════════════════════
// 1) analisarInventarioSA — helper puro (importação real, não extração)
// ═════════════════════════════════════════════════════════════════════════

await teste("analisarInventarioSA: lista vazia é segura (sem menor/maior/ausentes)", () => {
  const r = analisarInventarioSA([]);
  assert.equal(r.total, 0);
  assert.equal(r.menor, null);
  assert.equal(r.maior, null);
  assert.deepEqual(r.ausentes, []);
  assert.deepEqual(r.duplicados, []);
  assert.deepEqual(r.documentIdsDuplicados, []);
  assert.deepEqual(r.idsDuplicados, []);
  assert.deepEqual(r.semNumero, []);
});

await teste("analisarInventarioSA: ordenação numérica correta (entrada desordenada)", () => {
  const r = analisarInventarioSA([
    { documentId: "c", numeroQuestao: 3 },
    { documentId: "a", numeroQuestao: 1 },
    { documentId: "b", numeroQuestao: 2 },
  ]);
  assert.deepEqual(r.tabela.map((d) => d.numeroQuestao), [1, 2, 3]);
});

await teste("analisarInventarioSA: detecção de lacunas (números ausentes)", () => {
  const r = analisarInventarioSA([
    { documentId: "a", numeroQuestao: 1 },
    { documentId: "b", numeroQuestao: 2 },
    { documentId: "d", numeroQuestao: 4 },
    { documentId: "f", numeroQuestao: 6 },
  ]);
  assert.equal(r.menor, 1);
  assert.equal(r.maior, 6);
  assert.deepEqual(r.ausentes, [3, 5]);
});

await teste("analisarInventarioSA: sem lacunas quando a sequência é contínua", () => {
  const r = analisarInventarioSA([
    { documentId: "a", numeroQuestao: 5 },
    { documentId: "b", numeroQuestao: 6 },
    { documentId: "c", numeroQuestao: 7 },
  ]);
  assert.deepEqual(r.ausentes, []);
});

await teste("analisarInventarioSA: detecta numeroQuestao duplicado (ex.: R022 → Q14 e Q17 vs. outro caso real de dup)", () => {
  const r = analisarInventarioSA([
    { documentId: "SA_2026_2_Q14", numeroQuestao: 14 },
    { documentId: "SA_2026_2_Q14b", numeroQuestao: 14 },
    { documentId: "SA_2026_2_Q17", numeroQuestao: 17 },
  ]);
  assert.deepEqual(r.duplicados, [14]);
});

await teste("analisarInventarioSA: detecta documentId duplicado em documentIdsDuplicados (não mais em idsDuplicados)", () => {
  const r = analisarInventarioSA([
    { documentId: "SA_2026_2_Q1", numeroQuestao: 1 },
    { documentId: "SA_2026_2_Q1", numeroQuestao: 1 },
  ]);
  assert.deepEqual(r.documentIdsDuplicados, ["SA_2026_2_Q1"]);
  assert.deepEqual(r.idsDuplicados, [], "sem campo `id` nos dados, idsDuplicados não deveria acusar nada");
});

await teste("analisarInventarioSA: documentos sem numeroQuestao contam no total, entram em semNumero e vão ao fim da tabela", () => {
  const r = analisarInventarioSA([
    { documentId: "sem-numero", numeroQuestao: null },
    { documentId: "a", numeroQuestao: 1 },
    { documentId: "outro-sem-numero" }, // campo ausente de vez
  ]);
  assert.equal(r.total, 3);
  assert.equal(r.semNumero.length, 2);
  assert.equal(r.tabela[0].documentId, "a", "documento com número deveria vir primeiro");
  assert.deepEqual(r.tabela.slice(1).map((d) => d.documentId).sort(), ["outro-sem-numero", "sem-numero"]);
});

await teste("analisarInventarioSA: campo numeroQuestao não-numérico (string) é tratado como ausente, não como número válido", () => {
  const r = analisarInventarioSA([{ documentId: "x", numeroQuestao: "7" }]);
  assert.equal(r.menor, null, "string não deveria ser aceita como numeroQuestao válido");
  assert.equal(r.semNumero.length, 1);
});

await teste("analisarInventarioSA: json copiável é exatamente JSON.stringify da tabela ordenada (round-trip)", () => {
  const entrada = [
    { documentId: "b", numeroQuestao: 2 },
    { documentId: "a", numeroQuestao: 1 },
  ];
  const r = analisarInventarioSA(entrada);
  const reidratado = JSON.parse(r.json);
  assert.deepEqual(reidratado, r.tabela);
});

// ═════════════════════════════════════════════════════════════════════════
// 2) Checagens estáticas do handler real (gerarInventarioReadOnlySA)
// ═════════════════════════════════════════════════════════════════════════

await teste("Handler checa ambienteDevAutorizado ANTES de qualquer consulta ao Firestore", () => {
  const idxGate = blocoGerarInventario.indexOf("ambienteDevAutorizado(FIREBASE_PROJECT_ID)");
  const idxGetDocs = blocoGerarInventario.indexOf("getDocs(");
  assert.ok(idxGate > -1, "handler não checa ambienteDevAutorizado");
  assert.ok(idxGetDocs > -1, "handler não chama getDocs");
  assert.ok(idxGate < idxGetDocs, "gate de ambiente deveria rodar ANTES da consulta real");
});

await teste("Handler usa trava síncrona por ref (invEmExecucaoRef), não a variável de estado assíncrona", () => {
  assert.match(blocoGerarInventario, /if \(invEmExecucaoRef\.current\) return;/, "handler deveria ter trava síncrona contra clique duplo/concorrente");
  assert.match(blocoGerarInventario, /invEmExecucaoRef\.current = true;/);
  assert.match(blocoGerarInventario, /invEmExecucaoRef\.current = false;/);
});

await teste("Consulta é EXATAMENTE collection(db, \"questoes\") + where(\"edicao\", \"==\", \"2026_2\") — nenhuma outra coleção", () => {
  assert.match(blocoGerarInventario, /collection\(db,\s*"questoes"\)/, "deveria consultar exatamente a coleção questoes");
  assert.match(blocoGerarInventario, /where\("edicao",\s*"==",\s*"2026_2"\)/, "deveria filtrar exatamente por edicao == 2026_2");
  assert.ok(!blocoGerarInventario.includes('"teorias"'), "handler NUNCA deveria referenciar a coleção teorias");
  const ocorrenciasCollection = (blocoGerarInventario.match(/collection\(db,/g) || []).length;
  assert.equal(ocorrenciasCollection, 1, "deveria haver exatamente 1 chamada a collection(db, ...)");
});

await teste("Handler NUNCA contém nenhuma operação de escrita no Firestore", () => {
  for (const escrita of ["setDoc(", "fsSetDoc(", "addDoc(", "updateDoc(", "deleteDoc(", "writeBatch(", "runTransaction(", ".update(", ".delete(", ".set("]) {
    assert.ok(!blocoGerarInventario.includes(escrita), `handler não deveria conter operação de escrita "${escrita}"`);
  }
});

await teste("Handler tem ZERO integração com IA (nenhuma chamada de geração/resumo)", () => {
  for (const iaRef of ["chamarIA(", "gerarESalvarResumo(", "executarGeracaoSA(", "PROMPT_SISTEMA"]) {
    assert.ok(!blocoGerarInventario.includes(iaRef), `handler não deveria referenciar IA via "${iaRef}"`);
  }
});

await teste("Handler não referencia produção (revalidapro-f812e / cloudfunctions.net) — sem acesso cross-project", () => {
  assert.ok(!blocoGerarInventario.includes("revalidapro-f812e"));
  assert.ok(!blocoGerarInventario.includes("cloudfunctions.net"));
});

await teste("Erro de leitura é capturado e exposto via setInvErro, sem propagar exceção não tratada", () => {
  const idxTry = blocoGerarInventario.indexOf("try {");
  const idxCatch = blocoGerarInventario.indexOf("} catch (e) {");
  const idxFinally = blocoGerarInventario.indexOf("} finally {");
  assert.ok(idxTry > -1 && idxCatch > idxTry && idxFinally > idxCatch, "handler deveria ter try/catch/finally envolvendo a consulta");
  const blocoCatch = blocoGerarInventario.slice(idxCatch, idxFinally);
  assert.match(blocoCatch, /setInvErro\(/, "catch deveria expor o erro via setInvErro");
});

// ═════════════════════════════════════════════════════════════════════════
// 3) Checagens estáticas do painel JSX
// ═════════════════════════════════════════════════════════════════════════

await teste("Painel só renderiza quando ambienteDevAutorizado(FIREBASE_PROJECT_ID) — mesmo padrão fail-closed dos demais painéis DEV", () => {
  const trecho = roboSrc.slice(idxPainelJSX, idxPainelJSX + 700);
  assert.match(trecho, /\{ambienteDevAutorizado\(FIREBASE_PROJECT_ID\) && \(/, "painel deveria ser condicionado a ambienteDevAutorizado(FIREBASE_PROJECT_ID)");
});

await teste("Botão \"Gerar inventário read-only\" existe exatamente 1 vez e chama gerarInventarioReadOnlySA", () => {
  const ocorrenciasTexto = (blocoPainelJSX.match(/Gerar inventário read-only/g) || []).length;
  assert.equal(ocorrenciasTexto, 1, "deveria haver exatamente 1 botão \"Gerar inventário read-only\"");
  assert.match(blocoPainelJSX, /onClick=\{gerarInventarioReadOnlySA\}/, "botão deveria chamar gerarInventarioReadOnlySA");
});

await teste("Aviso explícito \"Consulta read-only — nenhum documento foi alterado\" está presente no painel", () => {
  assert.match(blocoPainelJSX, /Consulta read-only — nenhum documento foi alterado/);
});

await teste("14. UI exibe os dois indicadores de duplicidade SEPARADAMENTE (documentIdsDuplicados e idsDuplicados)", () => {
  assert.match(blocoPainelJSX, /invResultado\.documentIdsDuplicados/, "painel deveria exibir invResultado.documentIdsDuplicados");
  assert.match(blocoPainelJSX, /invResultado\.idsDuplicados/, "painel deveria exibir invResultado.idsDuplicados");
  assert.match(blocoPainelJSX, /IDs de documento duplicados/i);
  assert.match(blocoPainelJSX, /Campos "id" duplicados/i);
});

await teste("Painel JSX não contém nenhuma chamada de escrita ao Firestore nem de IA", () => {
  for (const proibido of ["setDoc(", "fsSetDoc(", "writeBatch(", "chamarIA(", "gerarESalvarResumo(", "iniciarRobo", "executarPilotoControladoDEV"]) {
    assert.ok(!blocoPainelJSX.includes(proibido), `painel não deveria referenciar "${proibido}"`);
  }
});

await teste("RevalidaPro_Analise.docx nunca é referenciado no painel novo nem no restante do arquivo", () => {
  assert.ok(!blocoPainelJSX.includes("RevalidaPro_Analise.docx"));
  assert.ok(!roboSrc.includes("RevalidaPro_Analise.docx"));
});

// ═════════════════════════════════════════════════════════════════════════
// 4) Harness de execução real — gerarInventarioReadOnlySA
// ═════════════════════════════════════════════════════════════════════════

function montarHarnessInventario(opts = {}) {
  const {
    projectId = "revalidapro-dev",
    jaExecutando = false,
    docsFirestore = [],
    getDocsErro,
  } = opts;

  const chamadas = { getDocs: 0, collection: [], where: [], query: 0, analisar: 0 };
  const estado = { invRodando: false, invErro: "", invResultado: null };
  const invEmExecucaoRef = { current: jaExecutando };

  const escopo = {
    ambienteDevAutorizado,
    FIREBASE_PROJECT_ID: projectId,
    invEmExecucaoRef,
    setInvRodando: (v) => { estado.invRodando = v; },
    setInvErro: (v) => { estado.invErro = v; },
    setInvResultado: (v) => { estado.invResultado = v; },
    db: {},
    collection: (...args) => { chamadas.collection.push(args); return { __collection: args }; },
    where: (...args) => { chamadas.where.push(args); return { __where: args }; },
    query: (...args) => { chamadas.query++; return { __query: args }; },
    getDocs: async (...args) => {
      chamadas.getDocs++;
      chamadas.ultimoArgsGetDocs = args;
      if (getDocsErro) throw (getDocsErro instanceof Error ? getDocsErro : new Error(getDocsErro));
      return { docs: docsFirestore.map((d) => ({ id: d.documentId ?? "doc-sem-id", data: () => d })) };
    },
    analisarInventarioSA: (docs) => { chamadas.analisar++; chamadas.docsRecebidos = docs; return analisarInventarioSA(docs); },
  };

  const corpo = blocoGerarInventario
    .replace(/^const gerarInventarioReadOnlySA = async \(\) => /, "")
    .replace(/;\s*$/, "");
  const executar = new Function(...Object.keys(escopo), `return (async () => ${corpo})();`);
  return { rodar: () => executar(...Object.values(escopo)), chamadas, estado, invEmExecucaoRef };
}

await teste("Fora do DEV: gate bloqueia ANTES de qualquer consulta — zero getDocs, erro claro", async () => {
  const h = montarHarnessInventario({ projectId: "revalidapro-f812e" });
  await h.rodar();
  assert.equal(h.chamadas.getDocs, 0, "não deveria consultar o Firestore fora do DEV");
  assert.match(h.estado.invErro, /revalidapro-dev/i);
  assert.equal(h.estado.invResultado, null);
});

await teste("ambienteDevAutorizado(undefined) é false — projectId ausente nunca é tratado como default do DEV", () => {
  // Verificação direta na função pura (não via harness): o harness usa
  // desestruturação com valor-padrão em `projectId`, que trocaria um
  // `undefined` explícito pelo default "revalidapro-dev" — comportamento do
  // MEU harness de teste, não do código real (FIREBASE_PROJECT_ID nunca é
  // opcional em produção, vem sempre de app.options.projectId).
  assert.equal(ambienteDevAutorizado(undefined), false);
});

await teste("Fora do DEV (projectId null/vazio/case errado): mesmo comportamento fail-closed", async () => {
  for (const pid of [null, "", "REVALIDAPRO-DEV"]) {
    const h = montarHarnessInventario({ projectId: pid });
    await h.rodar();
    assert.equal(h.chamadas.getDocs, 0, `projectId "${pid}" deveria bloquear a consulta`);
  }
});

await teste("Clique duplo/concorrente: trava síncrona ignora a segunda chamada", async () => {
  const h = montarHarnessInventario({ jaExecutando: true });
  await h.rodar();
  assert.equal(h.chamadas.getDocs, 0, "consulta não deveria rodar enquanto invEmExecucaoRef.current já é true");
});

await teste("Sucesso: consulta usa exatamente edicao == 2026_2 e popula invResultado via analisarInventarioSA", async () => {
  const h = montarHarnessInventario({
    docsFirestore: [
      { documentId: "SA_2026_2_Q1", id: "SA_2026_2_Q1", numeroQuestao: 1, edicao: "2026_2", materia: "Cirurgia", tema_mestre: "Hérnia", gabarito: "a" },
      { documentId: "SA_2026_2_Q3", id: "SA_2026_2_Q3", numeroQuestao: 3, edicao: "2026_2", materia: "Pediatria", tema_mestre: "TEA", gabarito: "b" },
    ],
  });
  await h.rodar();
  assert.equal(h.chamadas.where.length, 1);
  assert.deepEqual(h.chamadas.where[0], ["edicao", "==", "2026_2"]);
  assert.equal(h.chamadas.collection[0][1], "questoes");
  assert.equal(h.chamadas.analisar, 1, "deveria delegar a análise a analisarInventarioSA");
  assert.ok(h.estado.invResultado, "invResultado deveria ser preenchido");
  assert.equal(h.estado.invResultado.total, 2);
  assert.deepEqual(h.estado.invResultado.ausentes, [2], "deveria detectar a lacuna entre Q1 e Q3");
  assert.equal(h.estado.invErro, "");
  assert.equal(h.invEmExecucaoRef.current, false, "trava síncrona deveria ser liberada ao final (finally)");
});

await teste("Extração de campos: só os campos pedidos são coletados, createdAt cai de volta para criadoEm quando createdAt não existe", async () => {
  const h = montarHarnessInventario({
    docsFirestore: [
      { documentId: "SA_2026_2_Q9", id: "SA_2026_2_Q9", numeroQuestao: 9, edicao: "2026_2", materia: "X", tema_mestre: "Y", subtema: "Z", gabarito: "c", status: "ok", recorteId: "R039", criadoEm: "TIMESTAMP_FAKE", campoInterno: "NÃO_DEVERIA_APARECER" },
    ],
  });
  await h.rodar();
  const doc = h.chamadas.docsRecebidos[0];
  assert.equal(doc.documentId, "SA_2026_2_Q9");
  assert.equal(doc.createdAt, "TIMESTAMP_FAKE", "createdAt deveria cair de volta para o campo real criadoEm");
  assert.equal(doc.updatedAt, null, "updatedAt ausente deveria virar null, não erro");
  assert.equal("campoInterno" in doc, false, "só os campos explicitamente pedidos deveriam ser coletados");
});

await teste("Documento sem numeroQuestao (campo ausente do schema) não quebra a extração", async () => {
  const h = montarHarnessInventario({
    docsFirestore: [{ id: "X", edicao: "2026_2", materia: "M" }],
  });
  await h.rodar();
  assert.equal(h.estado.invResultado.total, 1);
  assert.equal(h.estado.invResultado.semNumero.length, 1);
});

await teste("Erro de leitura: setInvErro é chamado, invResultado permanece null, nenhuma escrita é tentada", async () => {
  const h = montarHarnessInventario({ getDocsErro: "PERMISSION_DENIED (simulado)" });
  await h.rodar();
  assert.match(h.estado.invErro, /PERMISSION_DENIED/);
  assert.equal(h.estado.invResultado, null, "erro de leitura não deveria deixar resultado parcial/mutado");
  assert.equal(h.chamadas.analisar, 0, "análise não deveria rodar se a consulta falhou");
  assert.equal(h.invEmExecucaoRef.current, false, "trava síncrona deveria ser liberada mesmo em erro (finally)");
});

// ═════════════════════════════════════════════════════════════════════════
// 5) HOTFIX — validade estrita de numeroQuestao (Number.isInteger && > 0)
//    e duplicidades de identificador separadas (documentId × data.id)
// ═════════════════════════════════════════════════════════════════════════

await teste("1. numeroQuestao = 0 é inválido — não conta como número, cai em semNumero", () => {
  const r = analisarInventarioSA([{ documentId: "a", numeroQuestao: 0 }]);
  assert.equal(r.menor, null);
  assert.equal(r.maior, null);
  assert.equal(r.semNumero.length, 1);
  assert.deepEqual(r.duplicados, []);
});

await teste("2. numeroQuestao negativo (-1) é inválido", () => {
  const r = analisarInventarioSA([{ documentId: "a", numeroQuestao: -1 }]);
  assert.equal(r.menor, null);
  assert.equal(r.semNumero.length, 1);
});

await teste("3. numeroQuestao fracionário (2.5) é inválido", () => {
  const r = analisarInventarioSA([{ documentId: "a", numeroQuestao: 2.5 }]);
  assert.equal(r.menor, null);
  assert.equal(r.semNumero.length, 1);
});

await teste("4. numeroQuestao como string (\"2\") é inválido — NUNCA convertido silenciosamente", () => {
  const r = analisarInventarioSA([{ documentId: "a", numeroQuestao: "2" }]);
  assert.equal(r.menor, null, "string não deveria ser coagida para número");
  assert.equal(r.semNumero.length, 1);
  const rVazia = analisarInventarioSA([{ documentId: "b", numeroQuestao: "" }]);
  assert.equal(rVazia.semNumero.length, 1, "string vazia também é inválida");
});

await teste("5. NaN e Infinity são inválidos", () => {
  const r = analisarInventarioSA([
    { documentId: "a", numeroQuestao: NaN },
    { documentId: "b", numeroQuestao: Infinity },
    { documentId: "c", numeroQuestao: -Infinity },
  ]);
  assert.equal(r.menor, null);
  assert.equal(r.maior, null);
  assert.equal(r.semNumero.length, 3);
});

await teste("6. Valores inválidos (-1, 0, 2.5) NUNCA distorcem menor/maior — só o inteiro positivo real conta", () => {
  const r = analisarInventarioSA([
    { documentId: "invalido1", numeroQuestao: -1 },
    { documentId: "invalido2", numeroQuestao: 0 },
    { documentId: "invalido3", numeroQuestao: 2.5 },
    { documentId: "valido", numeroQuestao: 10 },
  ]);
  assert.equal(r.menor, 10);
  assert.equal(r.maior, 10);
  assert.equal(r.semNumero.length, 3);
});

await teste("7. Valores inválidos não criam nem removem lacunas (ausentes calculado só sobre números válidos)", () => {
  const r = analisarInventarioSA([
    { documentId: "a", numeroQuestao: 1 },
    { documentId: "ruido", numeroQuestao: 2.5 }, // não deveria "preencher" a posição 2 nem virar parte da faixa
    { documentId: "b", numeroQuestao: 3 },
  ]);
  assert.equal(r.menor, 1);
  assert.equal(r.maior, 3);
  assert.deepEqual(r.ausentes, [2], "2 continua ausente — o valor 2.5 inválido não conta como presença nem altera a faixa");
});

await teste("8. Valores inválidos NUNCA entram em duplicidades numéricas (duas entradas com 0, ou duas com NaN, não geram falso duplicado)", () => {
  const rZero = analisarInventarioSA([
    { documentId: "a", numeroQuestao: 0 },
    { documentId: "b", numeroQuestao: 0 },
  ]);
  assert.deepEqual(rZero.duplicados, [], "dois zeros não deveriam contar como numeroQuestao duplicado — nenhum dos dois é válido");

  const rNaN = analisarInventarioSA([
    { documentId: "a", numeroQuestao: NaN },
    { documentId: "b", numeroQuestao: NaN },
  ]);
  assert.deepEqual(rNaN.duplicados, []);
});

await teste("Contrato completo: -1, 0 e 2.5 juntos — todos inválidos, todos em semNumero, zero efeito nos cálculos numéricos", () => {
  const r = analisarInventarioSA([
    { documentId: "n1", numeroQuestao: -1 },
    { documentId: "n2", numeroQuestao: 0 },
    { documentId: "n3", numeroQuestao: 2.5 },
  ]);
  assert.equal(r.total, 3);
  assert.equal(r.semNumero.length, 3);
  assert.equal(r.menor, null);
  assert.equal(r.maior, null);
  assert.deepEqual(r.ausentes, []);
  assert.deepEqual(r.duplicados, []);
});

await teste("Inteiro positivo válido (ex.: 7) É aceito normalmente — regressão do caminho feliz", () => {
  const r = analisarInventarioSA([{ documentId: "a", numeroQuestao: 7 }]);
  assert.equal(r.menor, 7);
  assert.equal(r.maior, 7);
  assert.equal(r.semNumero.length, 0);
});

await teste("9. Mesmo data.id, documentId distintos → aparece em idsDuplicados, NÃO em documentIdsDuplicados", () => {
  const r = analisarInventarioSA([
    { documentId: "doc-A", id: "SA_2026_2_Q5", numeroQuestao: 5 },
    { documentId: "doc-B", id: "SA_2026_2_Q5", numeroQuestao: 5 },
  ]);
  assert.deepEqual(r.idsDuplicados, ["SA_2026_2_Q5"]);
  assert.deepEqual(r.documentIdsDuplicados, [], "documentId são diferentes (doc-A/doc-B) — não deveria acusar documentIdsDuplicados");
});

await teste("10. Mesmo documentId, data.id distintos → aparece em documentIdsDuplicados, NÃO em idsDuplicados", () => {
  const r = analisarInventarioSA([
    { documentId: "SA_2026_2_Q8", id: "id-X", numeroQuestao: 8 },
    { documentId: "SA_2026_2_Q8", id: "id-Y", numeroQuestao: 8 },
  ]);
  assert.deepEqual(r.documentIdsDuplicados, ["SA_2026_2_Q8"]);
  assert.deepEqual(r.idsDuplicados, [], "os campos id são diferentes (id-X/id-Y) — não deveria acusar idsDuplicados");
});

await teste("11. id ausente, null ou string vazia NUNCA gera falso duplicado", () => {
  const r = analisarInventarioSA([
    { documentId: "d1" }, // id ausente
    { documentId: "d2", id: null },
    { documentId: "d3", id: "" },
    { documentId: "d4", id: "   " }, // só espaços — tratado como vazio
  ]);
  assert.deepEqual(r.idsDuplicados, [], "ausente/null/vazio/só-espaços não deveriam ser agrupados como o mesmo valor");
  assert.deepEqual(r.documentIdsDuplicados, [], "d1..d4 são documentId distintos — sem duplicidade aqui também");
});

await teste("documentId ausente, null ou vazio também nunca gera falso duplicado em documentIdsDuplicados", () => {
  const r = analisarInventarioSA([
    { id: "i1" },
    { documentId: null, id: "i2" },
    { documentId: "", id: "i3" },
  ]);
  assert.deepEqual(r.documentIdsDuplicados, []);
});

await teste("12. As duas listas de duplicidade são completamente independentes (um caso de cada, simultaneamente, não se misturam)", () => {
  const r = analisarInventarioSA([
    // Par A: mesmo documentId, id diferente → só documentIdsDuplicados
    { documentId: "DOC-A", id: "id-1", numeroQuestao: 1 },
    { documentId: "DOC-A", id: "id-2", numeroQuestao: 2 },
    // Par B: documentId diferente, mesmo id → só idsDuplicados
    { documentId: "DOC-B1", id: "id-3", numeroQuestao: 3 },
    { documentId: "DOC-B2", id: "id-3", numeroQuestao: 4 },
  ]);
  assert.deepEqual(r.documentIdsDuplicados, ["DOC-A"]);
  assert.deepEqual(r.idsDuplicados, ["id-3"]);
});

await teste("13. Ambas as listas de duplicidade sobrevivem ao round-trip do JSON copiável (via a tabela)", () => {
  const entrada = [
    { documentId: "DOC-A", id: "id-1", numeroQuestao: 1 },
    { documentId: "DOC-A", id: "id-2", numeroQuestao: 2 },
  ];
  const r = analisarInventarioSA(entrada);
  const reidratado = JSON.parse(r.json);
  assert.deepEqual(reidratado, r.tabela, "a tabela (fonte do JSON) preserva documentId e id de cada documento individualmente");
  // As listas de duplicidade em si não fazem parte da tabela/JSON (são
  // metadados calculados, exibidos separadamente na UI — teste 14 acima),
  // mas continuam presentes e corretas no objeto de retorno após a mesma
  // chamada que gerou o JSON.
  assert.deepEqual(r.documentIdsDuplicados, ["DOC-A"]);
  assert.deepEqual(r.idsDuplicados, []);
});

// ═════════════════════════════════════════════════════════════════════════
console.log(`\n${passou} passaram, ${falhas.length} falharam.`);
if (falhas.length > 0) {
  console.log("\nFalhas:");
  falhas.forEach((f) => console.log(`  - ${f.nome}: ${f.erro}`));
  process.exit(1);
}
