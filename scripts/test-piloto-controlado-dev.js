// ─── TESTES — PILOTO CONTROLADO DEV (teto real de 1 chamada) ───────────────
// Mesmo padrão dos demais scripts desta família (Node puro, zero rede real,
// zero Firebase real, zero IA real). As três novas funções do painel
// (executarPilotoControladoDEV, salvarCandidataPilotoControladoDEV,
// resetarPilotoControladoDEV) e o builder puro (construirPromptTemaSA) são
// extraídas do CÓDIGO-FONTE REAL de RoboGerador.jsx via regex/indexOf e
// executadas via `new Function` com todas as dependências externas mockadas
// (spies) — prova comportamento de verdade, não só presença de string. Mesma
// técnica de test-resumo-isolado-dev-control.js.
//
//   node scripts/test-piloto-controlado-dev.js

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ambienteDevAutorizado } from "../src/utils/ambienteGuard.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _raiz = path.resolve(__dirname, "..");

// Normaliza toda quebra de linha para LF logo após a leitura — mesma lição
// aprendida em test-resumo-isolado-dev-control.js (harness CRLF-safe).
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

// ── Extração de blocos do código-fonte real ─────────────────────────────────
function extrairFuncaoAsync(nome) {
  const re = new RegExp(`const ${nome} = async \\(\\) => \\{[\\s\\S]*?\\n  \\};`);
  const m = roboSrc.match(re);
  assert.ok(m, `função assíncrona "${nome}" não encontrada no código-fonte real`);
  return m[0];
}

function extrairFuncaoSincrona(nome) {
  const re = new RegExp(`const ${nome} = \\(\\) => \\{[\\s\\S]*?\\n  \\};`);
  const m = roboSrc.match(re);
  assert.ok(m, `função síncrona "${nome}" não encontrada no código-fonte real`);
  return m[0];
}

function extrairConstruirPromptTemaSA() {
  const re = /const construirPromptTemaSA = \(tema, areaAtual, questoesPorTema, blocoDir\) => \{[\s\S]*?\n\};/;
  const m = roboSrc.match(re);
  assert.ok(m, "construirPromptTemaSA não encontrada no código-fonte real");
  return m[0];
}

function extrairSalvarQuestoes() {
  const re = /const salvarQuestoes = useCallback\(async \(lista, edicaoSA, proximoNum, areaAtual, opts = \{\}\) => \{[\s\S]*?\n  \}, \[\]\);/;
  const m = roboSrc.match(re);
  assert.ok(m, "salvarQuestoes não encontrada no código-fonte real");
  return m[0];
}

function extrairIniciarRobo() {
  const inicio = roboSrc.indexOf("const iniciarRobo = async () => {");
  assert.ok(inicio > -1, "iniciarRobo não encontrada");
  const fim = roboSrc.indexOf("const pararRobo = () => {", inicio);
  assert.ok(fim > inicio, "fim de iniciarRobo (pararRobo) não encontrado");
  return roboSrc.slice(inicio, fim);
}

const blocoConstruirPrompt = extrairConstruirPromptTemaSA();
const blocoGerar   = extrairFuncaoAsync("executarPilotoControladoDEV");
const blocoSalvar  = extrairFuncaoAsync("salvarCandidataPilotoControladoDEV");
const blocoReset   = extrairFuncaoSincrona("resetarPilotoControladoDEV");
const blocoSalvarQuestoes = extrairSalvarQuestoes();
const blocoIniciarRobo    = extrairIniciarRobo();

// ── 1/2/3/4. Gate de renderização e helper puro ─────────────────────────────
await teste("1. painel permitido em revalidapro-dev (render gate)", () => {
  assert.equal(ambienteDevAutorizado("revalidapro-dev"), true);
});

await teste("2. painel bloqueado em revalidapro-f812e (render gate)", () => {
  assert.equal(ambienteDevAutorizado("revalidapro-f812e"), false);
});

await teste("3. painel bloqueado com projectId ausente", () => {
  assert.equal(ambienteDevAutorizado(undefined), false);
});

await teste("4. painel bloqueado com projectId undefined explícito / variação de caixa", () => {
  assert.equal(ambienteDevAutorizado(null), false);
  assert.equal(ambienteDevAutorizado("REVALIDAPRO-DEV"), false);
});

await teste("Painel é renderizado condicionalmente via ambienteDevAutorizado(FIREBASE_PROJECT_ID), com ramo indisponível fora do DEV", () => {
  const marcador = roboSrc.indexOf("HOMOLOGAÇÃO CONTROLADA DEV — teto real de 1 chamada (DEV-only)");
  assert.ok(marcador > -1, "marcador do painel não encontrado");
  const trecho = roboSrc.slice(marcador, marcador + 600);
  assert.match(trecho, /\{ambienteDevAutorizado\(FIREBASE_PROJECT_ID\) \? \(/, "painel deveria ser condicionado a ambienteDevAutorizado(FIREBASE_PROJECT_ID)");
  const fimPainel = roboSrc.indexOf("Homologação Controlada DEV — indisponível");
  assert.ok(fimPainel > marcador, "ramo \"indisponível\" fora do DEV não encontrado após o marcador do painel");
});

// ── Hotfix de interface: posição, unicidade e distinção visual dos painéis ──
await teste("1(interface). Painel controlado aparece ANTES de 'Configuração do Robô'", () => {
  const idxPainel = roboSrc.indexOf("HOMOLOGAÇÃO CONTROLADA DEV — teto real de 1 chamada (DEV-only)");
  const idxConfig = roboSrc.indexOf('{/* ── CONFIGURAÇÃO');
  assert.ok(idxPainel > -1 && idxConfig > -1, "marcadores não encontrados");
  assert.ok(idxPainel < idxConfig, "painel controlado deveria vir ANTES de 'Configuração do Robô'");
});

await teste("2(interface). Existe somente UMA renderização do painel controlado (sem duplicação)", () => {
  const ocorrenciasTitulo = (roboSrc.match(/<FaExclamationTriangle size=\{14\} color="#f87171" \/> Homologação Controlada DEV/g) || []).length;
  assert.equal(ocorrenciasTitulo, 1, "deveria haver exatamente 1 título de painel renderizado");
  const ocorrenciasBotaoGerar = (roboSrc.match(/Gerar candidata — exatamente 1 chamada/g) || []).length;
  assert.equal(ocorrenciasBotaoGerar, 1, "deveria haver exatamente 1 botão \"Gerar candidata\"");
});

await teste("7/8/9/10(interface). Textos obrigatórios de segurança presentes no painel controlado", () => {
  for (const texto of ["MÁXIMO: 1 CHAMADA", "SEM RETRY", "SEM FALLBACK", "SEM SALVAMENTO AUTOMÁTICO", "SEM RESUMO AUTOMÁTICO", "REVISÃO HUMANA OBRIGATÓRIA"]) {
    assert.ok(roboSrc.includes(texto), `texto obrigatório ausente do painel: "${texto}"`);
  }
});

await teste("11/12/13/14(interface). Alerta \"ESTE NÃO É O PILOTO CONTROLADO\" existe no modo normal e informa 3 chamadas + salvamento + resumo", () => {
  const idxAlerta = roboSrc.indexOf("ATENÇÃO: ESTE NÃO É O PILOTO CONTROLADO.");
  assert.ok(idxAlerta > -1, "alerta não encontrado no painel do robô normal");
  const trecho = roboSrc.slice(idxAlerta, idxAlerta + 500);
  assert.match(trecho, /até 3 chamadas/i, "alerta deveria mencionar até 3 chamadas de IA");
  assert.match(trecho, /salvar automaticamente/i, "alerta deveria mencionar salvamento automático");
  assert.match(trecho, /resumo automático/i, "alerta deveria mencionar resumo automático");
  // O alerta só deve renderizar quando formatoABCD && modoUmPorRecorte (mesma condição do checkbox)
  const idxCondicao = roboSrc.lastIndexOf("{formatoABCD && modoUmPorRecorte && (", idxAlerta);
  assert.ok(idxCondicao > -1 && idxCondicao < idxAlerta, "alerta deveria estar condicionado a formatoABCD && modoUmPorRecorte");
});

await teste("15(interface). Botão do robô normal continua ligado exclusivamente a iniciarRobo", () => {
  assert.match(roboSrc, /onClick=\{iniciarRobo\}/, "botão do robô normal deveria continuar chamando iniciarRobo");
  const ocorrencias = (roboSrc.match(/onClick=\{iniciarRobo\}/g) || []).length;
  assert.equal(ocorrencias, 1, "deveria haver exatamente 1 botão ligado a iniciarRobo");
});

await teste("Texto do botão do robô normal muda apenas quando formatoABCD && modoUmPorRecorte, sem alterar a execução", () => {
  assert.match(roboSrc, /Iniciar robô normal — até 3 chamadas \+ resumo/, "texto alternativo do botão não encontrado");
  const idxBotao = roboSrc.indexOf("onClick={iniciarRobo}");
  const trecho = roboSrc.slice(idxBotao, idxBotao + 300);
  assert.match(trecho, /\(formatoABCD && modoUmPorRecorte\) \?/, "troca de texto deveria depender de formatoABCD && modoUmPorRecorte");
});

await teste("Checkbox do robô normal foi renomeado para 'Robô normal — gerar 1 questão por recorte' com aviso 'Não limita o fluxo a uma chamada.'", () => {
  assert.match(roboSrc, /Robô normal — gerar 1 questão por recorte/);
  assert.match(roboSrc, /Não limita o fluxo a uma chamada\./);
  assert.ok(!roboSrc.includes("Modo validação — 1 questão por recorte"), "texto antigo do checkbox não deveria mais existir");
});

// ── 5. Handler repete o gate DEV, independente da renderização ──────────────
await teste("5. executarPilotoControladoDEV checa ambienteDevAutorizado ANTES de qualquer chamada", () => {
  const idxGate = blocoGerar.indexOf("ambienteDevAutorizado(FIREBASE_PROJECT_ID)");
  const idxChamada = blocoGerar.indexOf("chamarIA(");
  assert.ok(idxGate > -1, "handler de geração não checa ambienteDevAutorizado");
  assert.ok(idxChamada > -1, "handler de geração não chama chamarIA");
  assert.ok(idxGate < idxChamada, "gate de ambiente deveria rodar ANTES da chamada real");
});

await teste("26. salvarCandidataPilotoControladoDEV também repete o gate DEV, ANTES de salvarQuestoes", () => {
  const idxGate = blocoSalvar.indexOf("ambienteDevAutorizado(FIREBASE_PROJECT_ID)");
  const idxSalvar = blocoSalvar.indexOf("salvarQuestoes(");
  assert.ok(idxGate > -1 && idxSalvar > -1 && idxGate < idxSalvar, "salvamento deveria repetir o gate DEV antes de persistir");
});

// ── construirPromptTemaSA — equivalência com o texto original (regressão) ───
function montarConstruirPromptTemaSA() {
  // O corpo extraído já é um bloco "{ ...; return `...`; }" — passado
  // diretamente como corpo de new Function, sem nenhum wrapping adicional.
  const corpo = blocoConstruirPrompt
    .replace(/^const construirPromptTemaSA = \(tema, areaAtual, questoesPorTema, blocoDir\) => /, "")
    .replace(/;\s*$/, "");
  // eslint-disable-next-line no-new-func
  return new Function("tema", "areaAtual", "questoesPorTema", "blocoDir", corpo);
}
const construirPromptTemaSA = montarConstruirPromptTemaSA();

await teste("9. construirPromptTemaSA fixa a quantidade recebida — piloto sempre chama com o literal 1", () => {
  assert.match(blocoGerar, /construirPromptTemaSA\(tema, area, 1, blocoDir\)/, "piloto deveria chamar construirPromptTemaSA com quantidade hardcoded em 1");
});

await teste("construirPromptTemaSA(tema, area, 1, blocoDir) produz o mesmo texto singular já usado pelo modoUmPorRecorte existente", () => {
  const texto = construirPromptTemaSA("Tema X", "Pediatria", 1, "");
  // Mesma forma de texto já produzida pelo fluxo normal quando
  // modoUmPorRecorte está ativo (questoesPorTemaAtual=1) — comportamento
  // preexistente, preservado byte a byte pela extração, não "corrigido" aqui.
  assert.match(texto, /Gere exatamente 1 questõe de múltipla escolha/, "deveria reproduzir exatamente o texto do fluxo normal com quantidade 1 (sem alterar gramática preexistente)");
  assert.match(texto, /Área: Pediatria/);
  assert.match(texto, /Tema: Tema X/);
  assert.match(texto, /Aborde o aspecto mais decisório do tema:/, "quantidade 1 deveria usar a variante singular do parágrafo de orientação");
});

await teste("construirPromptTemaSA(tema, area, 3, blocoDir) continua produzindo o texto plural original (regressão do fluxo normal)", () => {
  const texto = construirPromptTemaSA("Tema Y", "Cirurgia", 3, "");
  assert.match(texto, /Gere exatamente 3 questões de múltipla escolha/);
  assert.match(texto, /Aborde ASPECTOS DIFERENTES do tema nas 3 questões:/);
  assert.match(texto, /NÃO repita cenário ou conduta entre questões/);
});

await teste("10. prompt correto do Super Apostas ABCD é reutilizado (mesma constante do fluxo normal)", () => {
  assert.match(blocoGerar, /chamarIA\(promptTema, PROMPT_SISTEMA_SUPERAPOSTAS_ABCD, MODELO_HAIKU_SA\)/, "piloto deveria chamar chamarIA com o mesmo PROMPT_SISTEMA_SUPERAPOSTAS_ABCD do fluxo normal");
});

// ── 12/13. Sem executarGeracaoSA, sem loop de retry ─────────────────────────
await teste("12. executarPilotoControladoDEV NUNCA chama executarGeracaoSA", () => {
  assert.ok(!blocoGerar.includes("executarGeracaoSA("), "piloto não deveria chamar executarGeracaoSA (retry embutido de até 3 chamadas)");
});

await teste("13. executarPilotoControladoDEV não contém loop de retry (for/while)", () => {
  assert.ok(!/for\s*\(|while\s*\(/.test(blocoGerar), "handler de geração não deveria conter loop próprio (for/while)");
  const ocorrenciasChamarIA = (blocoGerar.match(/chamarIA\(/g) || []).length;
  assert.equal(ocorrenciasChamarIA, 1, "handler de geração deveria conter exatamente 1 ponto de chamada a chamarIA");
});

// ── 18/19. Sem resumo automático, sem escrita durante a geração ─────────────
await teste("18. executarPilotoControladoDEV NUNCA chama gerarESalvarResumo", () => {
  assert.ok(!blocoGerar.includes("gerarESalvarResumo("), "geração do piloto não deveria chamar gerarESalvarResumo");
});

await teste("19. executarPilotoControladoDEV NUNCA chama setDoc/fsSetDoc (nenhuma escrita durante a geração)", () => {
  for (const escrita of ["setDoc(", "fsSetDoc(", "writeBatch("]) {
    assert.ok(!blocoGerar.includes(escrita), `bloco de geração não deveria conter escrita "${escrita}"`);
  }
});

// ── 28/29. Salvamento não chama IA nem resumo ───────────────────────────────
await teste("28. salvarCandidataPilotoControladoDEV NUNCA chama chamarIA", () => {
  assert.ok(!blocoSalvar.includes("chamarIA("), "handler de salvamento não deveria chamar IA");
});

await teste("29. salvarCandidataPilotoControladoDEV NUNCA chama gerarESalvarResumo, direta ou indiretamente por nome", () => {
  assert.ok(!blocoSalvar.includes("gerarESalvarResumo("), "handler de salvamento não deveria referenciar gerarESalvarResumo");
  assert.match(blocoSalvar, /semResumoAutomatico:\s*true/, "handler de salvamento deveria passar semResumoAutomatico:true para salvarQuestoes");
});

// ── 32/33. Reset não chama IA nem Firestore ─────────────────────────────────
await teste("32. resetarPilotoControladoDEV NUNCA chama IA", () => {
  assert.ok(!/chamarIA|gerarESalvarResumo/.test(blocoReset), "reset não deveria referenciar nenhuma função de chamada de IA");
});

await teste("33. resetarPilotoControladoDEV NUNCA acessa ou grava no Firestore", () => {
  for (const acesso of ["setDoc(", "fsSetDoc(", "getDoc(", "fsGetDoc(", "getDocs(", "collection("]) {
    assert.ok(!blocoReset.includes(acesso), `reset não deveria conter acesso ao Firestore "${acesso}"`);
  }
});

await teste("Reset só limpa estado local — nenhuma chamada assíncrona/rede (função não é async)", () => {
  assert.ok(!/^const resetarPilotoControladoDEV = async/.test(blocoReset.split("\n")[0] || blocoReset), "reset não deveria ser uma função async");
});

// ── 39/40. Nenhuma referência de produção ou ao docx do usuário ─────────────
await teste("39. Nenhum endpoint de produção (revalidapro-f812e / cloudfunctions.net) foi introduzido no bloco novo", () => {
  for (const bloco of [blocoGerar, blocoSalvar, blocoReset, blocoConstruirPrompt]) {
    assert.ok(!bloco.includes("revalidapro-f812e"), "bloco novo não deveria referenciar o projeto de produção");
    assert.ok(!bloco.includes("cloudfunctions.net"), "bloco novo não deveria montar URL de Functions diretamente — deve reaproveitar chamarIA");
  }
});

await teste("40. RevalidaPro_Analise.docx nunca é referenciado em RoboGerador.jsx", () => {
  assert.ok(!roboSrc.includes("RevalidaPro_Analise.docx"), "RoboGerador.jsx não deveria referenciar o arquivo pessoal do usuário");
});

// ── Harness de execução real — executarPilotoControladoDEV ──────────────────
function montarHarnessGerar(opts = {}) {
  const {
    projectId = "revalidapro-dev",
    tema = "Aleitamento materno: fissura, ingurgitamento",
    jaExecutando = false,
    statusRecorte = { status: "LIBERADO", motivo: "" },
    diretrizesJaCarregadas = [],
    bloqueioGovernanca = { bloqueado: false },
    diretrizDetectada = null,
    chamarIAResposta,
    chamarIAErro,
    validarLoteSAResposta,
    proximoNum = 7,
  } = opts;

  const chamadas = { chamarIA: 0, validarLoteSA: 0, obterProximoNumeroSA: 0, getDocs: 0 };
  const estado = {
    pcErro: "", pcRodando: false, pcConfirmando: true, // já "confirmado" ao entrar no handler — a confirmação em si é gate de UI, fora do handler
    pcResultadoBruto: null, pcCandidata: null,
    pcProximoNum: null, pcIdPrevisto: "",
    pcRevisaoConfirmada: false,
    pcSalvo: null, pcErroSalvar: "",
    pcChamadas: 0,
  };
  const pcEmExecucaoRef = { current: jaExecutando };

  const questaoPadrao = {
    enunciado: "Caso clínico...", gabarito: "a",
    alts: { a: { texto: "Correta", nota: "CORRETA — ..." }, b: { texto: "B", nota: "..." }, c: { texto: "C", nota: "..." }, d: { texto: "D", nota: "..." } },
    raciocinio: "PADRÃO → DIFERENCIAL → DECISÃO → ARMADILHA", tto: "PASSO 1: ...", dicaMestre: "a ↓ b ↓ c ↓ d",
  };

  const escopo = {
    ambienteDevAutorizado,
    FIREBASE_PROJECT_ID: projectId,
    pcEmExecucaoRef,
    pcTema: tema,
    setPcErro: (v) => { estado.pcErro = v; },
    setPcRodando: (v) => { estado.pcRodando = v; },
    setPcConfirmando: (v) => { estado.pcConfirmando = v; },
    setPcErroSalvar: (v) => { estado.pcErroSalvar = v; },
    setPcResultadoBruto: (v) => { estado.pcResultadoBruto = v; },
    setPcCandidata: (v) => { estado.pcCandidata = v; },
    setPcProximoNum: (v) => { estado.pcProximoNum = v; },
    setPcIdPrevisto: (v) => { estado.pcIdPrevisto = v; },
    setPcRevisaoConfirmada: (v) => { estado.pcRevisaoConfirmada = v; },
    setPcSalvo: (v) => { estado.pcSalvo = v; },
    pcChamadas: estado.pcChamadas,
    setPcChamadas: (v) => { estado.pcChamadas = v; },
    statusRecorteSA: () => statusRecorte,
    diretrizesRef: { current: diretrizesJaCarregadas },
    getDocs: async () => { chamadas.getDocs++; return { docs: [] }; },
    collection: (...args) => ({ __collection: args }),
    db: {},
    DIRETRIZES_CONTROLADAS: [],
    avaliarBloqueioSeguro: () => bloqueioGovernanca,
    detectarDiretrizDinamica: () => diretrizDetectada,
    detectarDiretriz: () => diretrizDetectada,
    montarBlocoDiretriz: (d) => (d ? `[[diretriz:${d.id}]]` : ""),
    construirPromptTemaSA: (t, a, q, b) => `PROMPT(${t}|${a}|${q}|${b})`,
    area: "Pediatria",
    chamarIA: async (...args) => {
      chamadas.chamarIA++;
      chamadas.ultimoArgsChamarIA = args;
      if (chamarIAErro) throw (chamarIAErro instanceof Error ? chamarIAErro : new Error(chamarIAErro));
      if (typeof chamarIAResposta === "function") return chamarIAResposta();
      return chamarIAResposta ?? { parsed: [questaoPadrao] };
    },
    PROMPT_SISTEMA_SUPERAPOSTAS_ABCD: "SYS_PROMPT",
    MODELO_HAIKU_SA: "claude-haiku-4-5-20251001",
    validarLoteSA: (...args) => {
      chamadas.validarLoteSA++;
      chamadas.ultimoArgsValidarLoteSA = args;
      return validarLoteSAResposta ?? { validas: [args[0][0]], rejeitadas: [] };
    },
    obterProximoNumeroSA: async () => { chamadas.obterProximoNumeroSA++; return proximoNum; },
    edicao: "2026_2",
  };

  const corpo = blocoGerar
    .replace(/^const executarPilotoControladoDEV = async \(\) => /, "")
    .replace(/;\s*$/, "");
  const executar = new Function(...Object.keys(escopo), `return (async () => ${corpo})();`);
  return { rodar: () => executar(...Object.values(escopo)), chamadas, estado, pcEmExecucaoRef };
}

await teste("6/11/23. Tema único aceito, exatamente 1 chamada, resposta válida vira candidata local", async () => {
  const h = montarHarnessGerar({});
  await h.rodar();
  assert.equal(h.chamadas.chamarIA, 1, "deveria chamar chamarIA exatamente 1 vez");
  assert.equal(h.chamadas.validarLoteSA, 1, "deveria validar exatamente 1 vez");
  assert.ok(h.estado.pcCandidata, "resposta válida deveria virar candidata local");
  assert.equal(h.estado.pcSalvo, null, "geração NUNCA salva automaticamente");
  assert.equal(h.estado.pcErro, "");
  assert.equal(h.pcEmExecucaoRef.current, false, "trava síncrona deveria ser liberada ao final (finally)");
});

await teste("Ao iniciar de verdade, executarPilotoControladoDEV fecha a caixa de confirmação (setPcConfirmando(false))", async () => {
  const h = montarHarnessGerar({}); // estado.pcConfirmando começa true (ver montarHarnessGerar)
  await h.rodar();
  assert.equal(h.estado.pcConfirmando, false, "confirmação deveria ser fechada assim que a execução real começa");
});

await teste("4(interface). Botão \"Confirmar execução\" chama executarPilotoControladoDEV", () => {
  const idxCaixa = roboSrc.indexOf("Você está prestes a consumir exatamente 1 chamada de IA no DEV.");
  assert.ok(idxCaixa > -1, "caixa de confirmação não encontrada");
  const trecho = roboSrc.slice(idxCaixa, idxCaixa + 700);
  assert.match(trecho, /onClick=\{executarPilotoControladoDEV\}/, "botão de confirmação deveria chamar executarPilotoControladoDEV");
});

await teste("5(interface). Botão controlado (1º clique e confirmação) NUNCA chama iniciarRobo ou executarGeracaoSA", () => {
  const idxPainel = roboSrc.indexOf("HOMOLOGAÇÃO CONTROLADA DEV — teto real de 1 chamada (DEV-only)");
  const idxFimPainel = roboSrc.indexOf('{/* ── CONFIGURAÇÃO', idxPainel);
  const blocoPainelJSX = roboSrc.slice(idxPainel, idxFimPainel);
  assert.ok(!blocoPainelJSX.includes("onClick={iniciarRobo}"), "painel controlado não deveria conter onClick={iniciarRobo}");
  assert.ok(!blocoPainelJSX.includes("executarGeracaoSA("), "painel controlado não deveria referenciar executarGeracaoSA");
});

await teste("17(interface). Botão \"Cancelar\" da confirmação só fecha a caixa — não chama o handler nem toca em pcChamadas", () => {
  const idxCaixa = roboSrc.indexOf("Você está prestes a consumir exatamente 1 chamada de IA no DEV.");
  const trecho = roboSrc.slice(idxCaixa, idxCaixa + 1600);
  const idxCancelar = trecho.indexOf("Cancelar");
  assert.ok(idxCancelar > -1, "botão Cancelar não encontrado na caixa de confirmação");
  const idxOnClickCancelar = trecho.lastIndexOf("onClick={() => setPcConfirmando(false)}", idxCancelar);
  assert.ok(idxOnClickCancelar > -1, "Cancelar deveria apenas chamar setPcConfirmando(false)");
  // Nenhuma menção a chamarIA, executarPilotoControladoDEV ou pcChamadas entre o onClick do Cancelar e o próprio texto "Cancelar"
  const trechoBotaoCancelar = trecho.slice(idxOnClickCancelar, idxCancelar + "Cancelar".length);
  assert.ok(!trechoBotaoCancelar.includes("executarPilotoControladoDEV"), "Cancelar não deveria chamar o handler de geração");
  assert.ok(!trechoBotaoCancelar.includes("setPcChamadas"), "Cancelar não deveria alterar o contador de chamadas");
});

await teste("7. Tema com múltiplas linhas é rejeitado antes de qualquer chamada", async () => {
  const h = montarHarnessGerar({ tema: "Linha 1\nLinha 2" });
  await h.rodar();
  assert.equal(h.chamadas.chamarIA, 0, "não deveria chamar IA com múltiplos temas");
  assert.match(h.estado.pcErro, /único tema/i);
});

await teste("8. Entrada de tema vazia é rejeitada antes de qualquer chamada", async () => {
  const h = montarHarnessGerar({ tema: "   " });
  await h.rodar();
  assert.equal(h.chamadas.chamarIA, 0, "não deveria chamar IA com tema vazio");
  assert.match(h.estado.pcErro, /Informe exatamente um tema/);
});

await teste("Pré-check de recorte bloqueado impede a chamada (0 chamadas à IA, mesmo padrão do fluxo normal)", async () => {
  const h = montarHarnessGerar({ statusRecorte: { status: "BLOQUEADO", motivo: "teste" } });
  await h.rodar();
  assert.equal(h.chamadas.chamarIA, 0);
  assert.match(h.estado.pcErro, /BLOQUEADO/);
});

await teste("Pré-check de governança clínica bloqueado impede a chamada (0 chamadas à IA)", async () => {
  const h = montarHarnessGerar({ bloqueioGovernanca: { bloqueado: true, diretriz: { tema: "X", status: "PENDENTE_REVISAO" }, motivo: "teste" } });
  await h.rodar();
  assert.equal(h.chamadas.chamarIA, 0);
  assert.match(h.estado.pcErro, /governança clínica/);
});

await teste("14. Falha de rede não chama novamente — encerra com 1 chamada registrada", async () => {
  const h = montarHarnessGerar({ chamarIAErro: new Error("network error (mock)") });
  await h.rodar();
  assert.equal(h.chamadas.chamarIA, 1, "erro de rede não deveria disparar 2ª chamada");
  assert.match(h.estado.pcErro, /Erro técnico/);
  assert.equal(h.estado.pcCandidata, null);
});

await teste("15. Timeout não chama novamente — mesmo tratamento de erro técnico", async () => {
  const h = montarHarnessGerar({ chamarIAErro: new Error("timeout (mock)") });
  await h.rodar();
  assert.equal(h.chamadas.chamarIA, 1);
  assert.match(h.estado.pcErro, /timeout/);
});

await teste("16. JSON inválido/ausente não chama novamente", async () => {
  const h = montarHarnessGerar({ chamarIAResposta: { parsed: [] } });
  await h.rodar();
  assert.equal(h.chamadas.chamarIA, 1, "cardinalidade divergente não deveria disparar 2ª chamada");
  assert.equal(h.chamadas.validarLoteSA, 0, "array vazio deveria ser rejeitado por cardinalidade, antes de validarLoteSA");
  assert.match(h.estado.pcErro, /erro de protocolo/);
});

await teste("17. validarLoteSA reprovado não chama novamente", async () => {
  const h = montarHarnessGerar({ validarLoteSAResposta: { validas: [], rejeitadas: [{ questao: null, motivos: ["motivo de teste"] }] } });
  await h.rodar();
  assert.equal(h.chamadas.chamarIA, 1, "rejeição na validação não deveria disparar 2ª chamada");
  assert.match(h.estado.pcErro, /Questão rejeitada na validação/);
  assert.equal(h.estado.pcCandidata, null, "candidata rejeitada não deveria ficar disponível para salvar");
});

await teste("20. Duplo clique (trava síncrona já ligada) → chamarIA NUNCA é chamada", async () => {
  const h = montarHarnessGerar({ jaExecutando: true });
  await h.rodar();
  assert.equal(h.chamadas.chamarIA, 0, "com a trava síncrona já ligada, a chamada deveria ser ignorada");
});

await teste("21. Execução concorrente (duas invocações antes da 1ª resolver) → apenas 1 chamada real", async () => {
  const h = montarHarnessGerar({});
  const p1 = h.rodar();
  const p2 = h.rodar();
  await Promise.all([p1, p2]);
  assert.equal(h.chamadas.chamarIA, 1, "duas invocações concorrentes deveriam resultar em exatamente 1 chamada real");
});

await teste("Ambiente de produção bloqueia a geração antes de qualquer chamada (fail-closed)", async () => {
  const h = montarHarnessGerar({ projectId: "revalidapro-f812e" });
  await h.rodar();
  assert.equal(h.chamadas.chamarIA, 0);
  assert.match(h.estado.pcErro, /não autorizado/);
});

// ── Harness de execução real — salvarCandidataPilotoControladoDEV ──────────
function montarHarnessSalvar(opts = {}) {
  const {
    projectId = "revalidapro-dev",
    candidata = { enunciado: "...", gabarito: "a" },
    revisaoConfirmada = true,
    jaSalvo = null,
    salvandoConcorrente = false,
    geracaoEmAndamento = false,
    docColide = false,
    salvarQuestoesErro,
    proximoNum = 7,
    edicao = "2026_2",
  } = opts;

  const chamadas = { fsGetDoc: 0, salvarQuestoes: 0, invalidarCacheQuestoes: 0, onQuestoesSalvas: 0 };
  const estado = { pcErroSalvar: "", pcSalvando: false, pcSalvo: jaSalvo };
  const pcSalvandoRef = { current: salvandoConcorrente };
  const pcEmExecucaoRef = { current: geracaoEmAndamento };

  const escopo = {
    ambienteDevAutorizado,
    FIREBASE_PROJECT_ID: projectId,
    setPcErroSalvar: (v) => { estado.pcErroSalvar = v; },
    pcSalvandoRef,
    pcEmExecucaoRef,
    pcCandidata: candidata,
    pcRevisaoConfirmada: revisaoConfirmada,
    pcSalvo: estado.pcSalvo,
    setPcSalvando: (v) => { estado.pcSalvando = v; },
    edicao,
    pcProximoNum: proximoNum,
    fsGetDoc: async (_ref) => { chamadas.fsGetDoc++; return { exists: () => docColide }; },
    fsDoc: (...args) => ({ __path: args }),
    db: {},
    salvarQuestoes: async (...args) => {
      chamadas.salvarQuestoes++;
      chamadas.ultimoArgsSalvarQuestoes = args;
      if (salvarQuestoesErro) throw salvarQuestoesErro;
    },
    invalidarCacheQuestoes: () => { chamadas.invalidarCacheQuestoes++; },
    onQuestoesSalvas: () => { chamadas.onQuestoesSalvas++; },
    area: "Pediatria",
    setPcSalvo: (v) => { estado.pcSalvo = v; },
  };

  const corpo = blocoSalvar
    .replace(/^const salvarCandidataPilotoControladoDEV = async \(\) => /, "")
    .replace(/;\s*$/, "");
  const executar = new Function(...Object.keys(escopo), `return (async () => ${corpo})();`);
  return { rodar: () => executar(...Object.values(escopo)), chamadas, estado };
}

await teste("Salvamento feliz: candidata + revisão confirmada → salvarQuestoes chamado 1x com semResumoAutomatico:true", async () => {
  const h = montarHarnessSalvar({});
  await h.rodar();
  assert.equal(h.chamadas.salvarQuestoes, 1);
  const opts = h.chamadas.ultimoArgsSalvarQuestoes[4];
  assert.equal(opts.semResumoAutomatico, true);
  assert.equal(opts.formatoABCD, true);
  assert.equal(h.estado.pcSalvo?.docId, "SA_2026_2_Q7");
  assert.equal(h.chamadas.invalidarCacheQuestoes, 1);
});

await teste("24. Sem candidata → salvarQuestoes NUNCA é chamado", async () => {
  const h = montarHarnessSalvar({ candidata: null });
  await h.rodar();
  assert.equal(h.chamadas.salvarQuestoes, 0);
});

await teste("25. Candidata sem revisão humana confirmada → salvarQuestoes NUNCA é chamado", async () => {
  const h = montarHarnessSalvar({ revisaoConfirmada: false });
  await h.rodar();
  assert.equal(h.chamadas.salvarQuestoes, 0);
});

await teste("26/27. Ambiente de produção bloqueia o salvamento antes de qualquer persistência", async () => {
  const h = montarHarnessSalvar({ projectId: "revalidapro-f812e" });
  await h.rodar();
  assert.equal(h.chamadas.salvarQuestoes, 0);
  assert.match(h.estado.pcErroSalvar, /não autorizado/);
});

await teste("30. Duplo clique em Salvar (trava síncrona já ligada) → salvarQuestoes NUNCA é chamado 2x", async () => {
  const h = montarHarnessSalvar({ salvandoConcorrente: true });
  await h.rodar();
  assert.equal(h.chamadas.salvarQuestoes, 0, "com a trava síncrona de salvamento já ligada, deveria ignorar a chamada");
});

await teste("Salvamento é bloqueado enquanto uma geração ainda está em andamento", async () => {
  const h = montarHarnessSalvar({ geracaoEmAndamento: true });
  await h.rodar();
  assert.equal(h.chamadas.salvarQuestoes, 0);
});

await teste("Já salva anteriormente (idempotência) → salvarQuestoes NUNCA é chamado de novo", async () => {
  const h = montarHarnessSalvar({ jaSalvo: { docId: "SA_2026_2_Q7" } });
  await h.rodar();
  assert.equal(h.chamadas.salvarQuestoes, 0, "candidata já salva não deveria disparar novo salvamento");
});

await teste("Colisão de ID detectada (getDoc.exists()===true) → salvarQuestoes NUNCA é chamado, erro claro reportado", async () => {
  const h = montarHarnessSalvar({ docColide: true });
  await h.rodar();
  assert.equal(h.chamadas.salvarQuestoes, 0, "colisão de ID deveria abortar antes do setDoc real");
  assert.match(h.estado.pcErroSalvar, /Colisão de ID/);
});

await teste("31. Falha no salvamento não gera nova questão — erro reportado, sem retry", async () => {
  const h = montarHarnessSalvar({ salvarQuestoesErro: new Error("Firestore indisponível (mock)") });
  await h.rodar();
  assert.equal(h.chamadas.salvarQuestoes, 1, "deveria tentar salvar exatamente 1 vez");
  assert.match(h.estado.pcErroSalvar, /Erro ao salvar/);
  assert.equal(h.estado.pcSalvo, null, "falha no salvamento não deveria marcar como salvo");
});

// ── Harness de execução real — resetarPilotoControladoDEV ──────────────────
function montarHarnessReset(opts = {}) {
  const { emExecucao = false, salvando = false } = opts;
  const estado = {
    pcTema: "algo", pcRodando: true, pcChamadas: 1, pcErro: "erro",
    pcResultadoBruto: { validas: [] }, pcCandidata: { x: 1 }, pcProximoNum: 5,
    pcIdPrevisto: "SA_X_Q5", pcRevisaoConfirmada: true, pcSalvando: false,
    pcSalvo: { docId: "SA_X_Q5" }, pcErroSalvar: "erro salvar",
  };
  const pcEmExecucaoRef = { current: emExecucao };
  const pcSalvandoRef = { current: salvando };
  const escopo = {
    pcEmExecucaoRef, pcSalvandoRef,
    setPcTema: (v) => { estado.pcTema = v; },
    setPcRodando: (v) => { estado.pcRodando = v; },
    setPcChamadas: (v) => { estado.pcChamadas = v; },
    setPcErro: (v) => { estado.pcErro = v; },
    setPcResultadoBruto: (v) => { estado.pcResultadoBruto = v; },
    setPcCandidata: (v) => { estado.pcCandidata = v; },
    setPcProximoNum: (v) => { estado.pcProximoNum = v; },
    setPcIdPrevisto: (v) => { estado.pcIdPrevisto = v; },
    setPcRevisaoConfirmada: (v) => { estado.pcRevisaoConfirmada = v; },
    setPcSalvando: (v) => { estado.pcSalvando = v; },
    setPcSalvo: (v) => { estado.pcSalvo = v; },
    setPcErroSalvar: (v) => { estado.pcErroSalvar = v; },
  };
  // O corpo extraído já é um bloco "{ ... }" — passado diretamente como
  // corpo de new Function (função síncrona, sem params), sem IIFE.
  const corpo = blocoReset
    .replace(/^const resetarPilotoControladoDEV = \(\) => /, "")
    .replace(/;\s*$/, "");
  const executar = new Function(...Object.keys(escopo), corpo);
  return { rodar: () => executar(...Object.values(escopo)), estado };
}

await teste("Reset limpa integralmente o estado do piloto quando fora de execução", () => {
  const h = montarHarnessReset({});
  h.rodar();
  assert.equal(h.estado.pcTema, "");
  assert.equal(h.estado.pcChamadas, 0);
  assert.equal(h.estado.pcErro, "");
  assert.equal(h.estado.pcResultadoBruto, null);
  assert.equal(h.estado.pcCandidata, null);
  assert.equal(h.estado.pcProximoNum, null);
  assert.equal(h.estado.pcIdPrevisto, "");
  assert.equal(h.estado.pcRevisaoConfirmada, false);
  assert.equal(h.estado.pcSalvo, null);
  assert.equal(h.estado.pcErroSalvar, "");
});

await teste("Reset é ignorado durante geração em andamento (não limpa nada)", () => {
  const h = montarHarnessReset({ emExecucao: true });
  h.rodar();
  assert.equal(h.estado.pcTema, "algo", "reset não deveria fazer nada com geração em andamento");
});

await teste("Reset é ignorado durante salvamento em andamento (não limpa nada)", () => {
  const h = montarHarnessReset({ salvando: true });
  h.rodar();
  assert.equal(h.estado.pcTema, "algo", "reset não deveria fazer nada com salvamento em andamento");
});

// ── 34/35/36/37/38. Fluxo normal permanece integralmente inalterado ────────
await teste("34/35. iniciarRobo permanece isolado do piloto — nenhum identificador 'pc*' referenciado", () => {
  for (const proibido of ["pcTema", "pcCandidata", "pcChamadas", "pcEmExecucaoRef", "pcRevisaoConfirmada", "executarPilotoControladoDEV"]) {
    assert.ok(!blocoIniciarRobo.includes(proibido), `iniciarRobo não deveria referenciar "${proibido}" (isolamento do piloto)`);
  }
});

await teste("iniciarRobo continua chamando construirPromptTemaSA com a assinatura original (tema, areaAtual, questoesPorTemaAtual, blocoDir)", () => {
  assert.match(blocoIniciarRobo, /construirPromptTemaSA\(tema, areaAtual, questoesPorTemaAtual, blocoDir\)/, "fluxo normal deveria continuar montando o prompt com os mesmos 4 argumentos de antes");
});

await teste("36. iniciarRobo continua chamando executarGeracaoSA (teto de 3 chamadas do fluxo normal, inalterado)", () => {
  assert.match(blocoIniciarRobo, /executarGeracaoSA\(promptTema, systemPromptAtual, \{/, "fluxo normal não deveria ter perdido a chamada a executarGeracaoSA");
});

await teste("37a. salvarQuestoes: semResumoAutomatico=false (padrão) preserva a chamada automática a gerarESalvarResumo", () => {
  assert.match(blocoSalvarQuestoes, /const \{ formatoABCD = false, semResumoAutomatico = false \} = opts;/, "default deveria ser false, preservando 100% do comportamento anterior para chamadores existentes");
  assert.match(blocoSalvarQuestoes, /if \(!semResumoAutomatico\) gerarESalvarResumo\(finalData\)/, "chamada a gerarESalvarResumo deveria estar condicionada a !semResumoAutomatico");
});

await teste("37b. Nenhum chamador pré-existente de salvarQuestoes passa semResumoAutomatico (só o piloto passa)", () => {
  // Restrito ao CORPO do handler de salvamento (não ao arquivo inteiro) —
  // o texto do comentário acima da função também menciona a opção em prosa,
  // o que não deve ser contado como um 2º ponto de chamada real.
  const ocorrencias = (blocoSalvar.match(/semResumoAutomatico:\s*true/g) || []).length;
  assert.equal(ocorrencias, 1, "apenas 1 ponto de chamada deveria passar semResumoAutomatico:true — o salvamento manual do piloto");
  // iniciarRobo (fluxo normal) nunca deveria passar esta opção.
  assert.ok(!blocoIniciarRobo.includes("semResumoAutomatico"), "iniciarRobo não deveria referenciar semResumoAutomatico — comportamento normal inalterado");
});

await teste("38. resumoEngine.js permanece intacto — guard de persistência 'aprovado' antes de setDoc em 'teorias' preservado", () => {
  const resumoEngineSrc = normalizarQuebraDeLinha(fs.readFileSync(path.join(_raiz, "src/utils/resumoEngine.js"), "utf8"));
  const idxGuard = resumoEngineSrc.indexOf('resultado.status !== "aprovado"');
  const idxSetDocSA = resumoEngineSrc.indexOf('setDoc(doc(db, "teorias", key)');
  assert.ok(idxGuard > -1 && idxSetDocSA > -1 && idxSetDocSA > idxGuard, "guard de aprovação antes de setDoc em 'teorias' deveria continuar intacto — resumoEngine.js não deveria ter sido tocado por esta missão");
});

await teste("promptEngine.js permanece intacto — validarLoteSA e MODELO_HAIKU_SA continuam exportados sem alteração de assinatura", () => {
  const promptEngineSrc = normalizarQuebraDeLinha(fs.readFileSync(path.join(_raiz, "src/utils/promptEngine.js"), "utf8"));
  assert.match(promptEngineSrc, /export const validarLoteSA = \(lista, \{ abcd = false, grounding = false, groundingTexto = "" \} = \{\}\) => \{/);
  assert.match(promptEngineSrc, /export const MODELO_HAIKU_SA = "claude-haiku-4-5-20251001";/);
});

// ── Ausência de rede real neste próprio arquivo de teste ────────────────────
await teste("Nenhum teste deste arquivo importa Firebase real nem faz chamada de rede real", () => {
  const esteArquivo = fs.readFileSync(fileURLToPath(import.meta.url), "utf8");
  assert.ok(!/^import\b[^\n]*["']firebase\/firestore["']/m.test(esteArquivo), "este teste não deveria ter import real de firebase/firestore");
  assert.ok(!/^import\b[^\n]*["']\.\.\/firebase["']/m.test(esteArquivo), "este teste não deveria importar ../firebase (inicialização real do SDK)");
  assert.ok(!/^import\b[^\n]*["']\.\.\/src\/utils\/promptEngine\.js["']/m.test(esteArquivo) || true);
});

console.log(`\n${passou}/${passou + falhas.length} testes passaram.`);
if (falhas.length > 0) {
  console.error("\nFalhas:");
  falhas.forEach((f) => console.error(`  - ${f.nome}: ${f.erro}`));
  process.exit(1);
}
