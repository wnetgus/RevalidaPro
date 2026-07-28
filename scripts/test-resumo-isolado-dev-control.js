// ─── TESTES — CONTROLE DEV-ONLY DE REGENERAÇÃO ISOLADA DE RESUMO ─────────────
// Mesmo padrão dos demais scripts desta família (Node puro, zero rede real,
// zero Firebase real). `src/utils/ambienteGuard.js` é pura (sem import de
// Firebase) e é importada AO VIVO — teste real, não estrutural. Já
// `RoboGerador.jsx` importa ../firebase (que acessa import.meta.env, inexistente
// em Node puro fora do Vite) e é JSX — nunca importado ao vivo. As duas
// funções novas e puras o bastante (`executarRegeneracaoResumoIsolado`,
// `buscarQuestaoParaResumoIsolado`) são extraídas do CÓDIGO-FONTE REAL via
// regex e executadas via `new Function` com dependências mockadas (spies) —
// prova comportamento de verdade, não só presença de string. Mesma técnica de
// test-questao-retry-hardening.js/test-resumo-sa4-feedback.js.
//
// Contexto: a homologação de R067 foi corretamente bloqueada (BLOQUEADO ANTES
// DA EXECUÇÃO) porque gerarESalvarResumo(questao) só existia como efeito
// colateral automático da geração de uma questão NOVA — não havia nenhum
// jeito de regenerar só o resumo de uma questão SA já salva. Este arquivo
// testa o novo controle administrativo (RoboGerador.jsx, painel "Regenerar
// Somente o Resumo") que fecha essa lacuna, restrito ao DEV por um gate
// fail-closed em duas camadas (render + handler) baseado no projectId
// REALMENTE inicializado pelo Firebase SDK.
//
//   node scripts/test-resumo-isolado-dev-control.js

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ambienteDevAutorizado, PROJECT_ID_DEV_PERMITIDO } from "../src/utils/ambienteGuard.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _raiz = path.resolve(__dirname, "..");

// Normaliza toda quebra de linha para LF logo após a leitura. As extrações
// textuais abaixo (indexOf/regex) contêm literais multilinha com "\n" fixo;
// sem esta normalização, arquivos-fonte salvos em CRLF (comum no Windows,
// inclusive por core.autocrlf do Git) fazem essas buscas falharem
// silenciosamente — foi exatamente isso que derrubou a auditoria anterior
// antes de qualquer um dos 24 casos rodar. Ver também o teste de
// portabilidade LF/CRLF ao final deste arquivo.
function normalizarQuebraDeLinha(conteudo) {
  return conteudo.replace(/\r\n?/g, "\n");
}

const roboSrc = normalizarQuebraDeLinha(fs.readFileSync(path.join(_raiz, "src/components/RoboGerador.jsx"), "utf8"));
const firebaseSrc = normalizarQuebraDeLinha(fs.readFileSync(path.join(_raiz, "src/firebase.js"), "utf8"));

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

// Isola o bloco do novo controle (do marcador de início até o próximo
// separador "// ──" de mesmo nível), para as checagens de "não faz X" não
// pegarem falsos positivos do resto de um arquivo de ~2400 linhas que
// legitimamente chama setDoc(doc(db,"questoes"...)) e mexe em progresso/lote
// em outros pontos, fora deste controle.
function extrairBlocoControle() {
  const inicio = roboSrc.indexOf("// ─── REGENERAÇÃO ISOLADA DE RESUMO — controle administrativo DEV-only");
  assert.ok(inicio > -1, "marcador de início do bloco do controle não encontrado");
  const fimHandlers = roboSrc.indexOf("// ── LOOP PRINCIPAL DO ROBÔ", inicio);
  assert.ok(fimHandlers > inicio, "marcador de fim dos handlers (LOOP PRINCIPAL DO ROBÔ) não encontrado após o início do bloco");
  const inicioJSX = roboSrc.indexOf('{/* ── REGENERAÇÃO ISOLADA DE RESUMO (DEV-only)', fimHandlers);
  assert.ok(inicioJSX > -1, "JSX do painel de regeneração isolada não encontrado");
  const fimJSX = roboSrc.indexOf("    </div>\n  );\n}", inicioJSX);
  assert.ok(fimJSX > inicioJSX, "fim do JSX (fechamento do componente) não encontrado");
  return roboSrc.slice(inicio, fimHandlers) + roboSrc.slice(inicioJSX, fimJSX);
}
const blocoControle = extrairBlocoControle();

function extrairFuncaoAsync(nome) {
  const re = new RegExp(`const ${nome} = async \\(\\) => \\{[\\s\\S]*?\\n  \\};`);
  const m = roboSrc.match(re);
  assert.ok(m, `função "${nome}" não encontrada no código-fonte real`);
  return m[0];
}

// ── 1/2/4. ambienteDevAutorizado (pura, executada ao vivo) ──────────────────
await teste("1. ambienteDevAutorizado(revalidapro-dev) → true (único valor autorizado)", () => {
  assert.equal(ambienteDevAutorizado("revalidapro-dev"), true);
  assert.equal(PROJECT_ID_DEV_PERMITIDO, "revalidapro-dev");
});

await teste("2. ambienteDevAutorizado(revalidapro-f812e) → false (produção nunca autorizada)", () => {
  assert.equal(ambienteDevAutorizado("revalidapro-f812e"), false);
});

await teste("4. ambienteDevAutorizado falha fechado para ausente/vazio/variações de caixa", () => {
  assert.equal(ambienteDevAutorizado(undefined), false, "undefined deveria falhar fechado");
  assert.equal(ambienteDevAutorizado(null), false, "null deveria falhar fechado");
  assert.equal(ambienteDevAutorizado(""), false, "string vazia deveria falhar fechado");
  assert.equal(ambienteDevAutorizado("REVALIDAPRO-DEV"), false, "variação de caixa não deveria ser autorizada implicitamente");
  assert.equal(ambienteDevAutorizado("revalidapro-dev "), false, "espaço residual não deveria ser autorizado (comparação estrita, sem trim)");
});

// ── 3. Gate no handler roda ANTES de qualquer chamada de IA/persistência ───
await teste("3. executarRegeneracaoResumoIsolado checa ambienteDevAutorizado ANTES de chamar gerarESalvarResumo", () => {
  const fn = extrairFuncaoAsync("executarRegeneracaoResumoIsolado");
  const idxGate = fn.indexOf("ambienteDevAutorizado(FIREBASE_PROJECT_ID)");
  const idxChamada = fn.indexOf("gerarESalvarResumo(riQuestao)");
  assert.ok(idxGate > -1, "handler não chama ambienteDevAutorizado");
  assert.ok(idxChamada > -1, "handler não chama gerarESalvarResumo");
  assert.ok(idxGate < idxChamada, "gate de ambiente deveria rodar ANTES da chamada real");
});

// ── projectId realmente inicializado (não releitura de env var) ────────────
await teste("firebase.js: FIREBASE_PROJECT_ID vem de app.options.projectId, não de releitura direta da env var", () => {
  assert.match(firebaseSrc, /export const FIREBASE_PROJECT_ID = app\.options\.projectId;/, "FIREBASE_PROJECT_ID deveria vir do app realmente inicializado (app.options.projectId)");
});

await teste("RoboGerador.jsx importa FIREBASE_PROJECT_ID de ../firebase e ambienteDevAutorizado de ../utils/ambienteGuard", () => {
  assert.match(roboSrc, /import \{ db, auth, obterTokenAppCheck, FIREBASE_PROJECT_ID \} from "\.\.\/firebase";/, "import de FIREBASE_PROJECT_ID não encontrado");
  assert.match(roboSrc, /import \{ ambienteDevAutorizado \} from "\.\.\/utils\/ambienteGuard";/, "import de ambienteDevAutorizado não encontrado");
});

// ── Proteção também na renderização (não só CSS/visual) ─────────────────────
await teste("Render do painel é condicionado a ambienteDevAutorizado(FIREBASE_PROJECT_ID) (JSX condicional, não display:none)", () => {
  assert.match(roboSrc, /\{ambienteDevAutorizado\(FIREBASE_PROJECT_ID\) \? \(/, "painel deveria ser renderizado condicionalmente via ambienteDevAutorizado, não apenas escondido via CSS");
  assert.match(roboSrc, /Regenerar Somente o Resumo — indisponível/, "ramo \"indisponível\" fora do DEV não encontrado");
});

// ── 5/6/7. Execução real do handler com dependências mockadas (spies) ──────
function montarHarnessExecutar({ projectId, riQuestao, jaExecutando = false, respostaGerarResumo }) {
  const chamadas = { gerarESalvarResumo: 0 };
  const estado = { riExecutando: false, riResultado: null, riConfirmando: true, riEmExecucaoRef: { current: jaExecutando } };

  const escopo = {
    FIREBASE_PROJECT_ID: projectId,
    ambienteDevAutorizado,
    riQuestao,
    riEmExecucaoRef: estado.riEmExecucaoRef,
    setRiExecutando: (v) => { estado.riExecutando = v; },
    setRiResultado: (v) => { estado.riResultado = v; },
    setRiConfirmando: (v) => { estado.riConfirmando = v; },
    gerarESalvarResumo: async (q) => {
      chamadas.gerarESalvarResumo++;
      chamadas.ultimoArg = q;
      if (typeof respostaGerarResumo === "function") return respostaGerarResumo();
      return respostaGerarResumo ?? { status: "salvo", key: "tema--contexto", blocos: 5, tentativas: 1 };
    },
    _bucketResultadoResumoIsolado: (status) => (status === "salvo" ? "aprovado" : status === "erro_tecnico" ? "erro_operacional" : "rejeitado_sem_persistencia"),
  };

  const corpo = extrairFuncaoAsync("executarRegeneracaoResumoIsolado")
    .replace(/^const executarRegeneracaoResumoIsolado = async \(\) => /, "")
    .replace(/;\s*$/, "");
  const executar = new Function(...Object.keys(escopo), `return (async () => ${corpo})();`);
  return { rodar: () => executar(...Object.values(escopo)), chamadas, estado };
}

await teste("5. Ambiente incorreto (produção) → gerarESalvarResumo NUNCA é chamado, resultado bloqueado_ambiente", async () => {
  const h = montarHarnessExecutar({ projectId: "revalidapro-f812e", riQuestao: { id: "X", tema_mestre: "Tema" } });
  await h.rodar();
  assert.equal(h.chamadas.gerarESalvarResumo, 0, "gerarESalvarResumo não deveria ser chamado fora do DEV");
  assert.equal(h.estado.riResultado?.bucket, "bloqueado_ambiente");
});

await teste("5b. Ambiente ausente (undefined) → gerarESalvarResumo NUNCA é chamado (fail-closed)", async () => {
  const h = montarHarnessExecutar({ projectId: undefined, riQuestao: { id: "X", tema_mestre: "Tema" } });
  await h.rodar();
  assert.equal(h.chamadas.gerarESalvarResumo, 0, "ambiente ausente deveria falhar fechado");
  assert.equal(h.estado.riResultado?.bucket, "bloqueado_ambiente");
});

await teste("6. Sem questão carregada (riQuestao=null) → gerarESalvarResumo NUNCA é chamado, mesmo com ambiente DEV correto", async () => {
  const h = montarHarnessExecutar({ projectId: "revalidapro-dev", riQuestao: null });
  await h.rodar();
  assert.equal(h.chamadas.gerarESalvarResumo, 0, "sem questão carregada, gerarESalvarResumo não deveria ser chamado");
});

await teste("7. Questão válida + DEV correto → gerarESalvarResumo é chamado EXATAMENTE 1 vez, com a própria questão carregada", async () => {
  const questao = { id: "DOC_QUALQUER", tema_mestre: "Tema Genérico" };
  const h = montarHarnessExecutar({ projectId: "revalidapro-dev", riQuestao: questao });
  await h.rodar();
  assert.equal(h.chamadas.gerarESalvarResumo, 1, "deveria chamar gerarESalvarResumo exatamente 1 vez");
  assert.equal(h.chamadas.ultimoArg, questao, "deveria passar a própria questão carregada, sem transformação");
  assert.equal(h.estado.riResultado?.bucket, "aprovado");
  assert.equal(h.estado.riExecutando, false, "riExecutando deveria voltar a false ao final (finally)");
  assert.equal(h.estado.riEmExecucaoRef.current, false, "trava síncrona deveria ser liberada ao final (finally)");
});

await teste("7b. Duplo acionamento (trava síncrona já ligada) → gerarESalvarResumo NUNCA é chamado na 2ª tentativa concorrente", async () => {
  const h = montarHarnessExecutar({ projectId: "revalidapro-dev", riQuestao: { id: "X", tema_mestre: "Tema" }, jaExecutando: true });
  await h.rodar();
  assert.equal(h.chamadas.gerarESalvarResumo, 0, "com a trava síncrona já ligada, a chamada deveria ser ignorada (sem execução concorrente)");
});

await teste("8. Resultado do fluxo é traduzido para 'rejeitado_sem_persistencia' quando o status não é 'salvo' (sem repetição automática)", async () => {
  const h = montarHarnessExecutar({
    projectId: "revalidapro-dev",
    riQuestao: { id: "X", tema_mestre: "Tema" },
    respostaGerarResumo: { status: "rejeitado_grounding", problemas: ["motivo genérico de teste"], tentativas: 2 },
  });
  await h.rodar();
  assert.equal(h.chamadas.gerarESalvarResumo, 1, "rejeição final não deveria disparar nenhuma chamada adicional automática");
  assert.equal(h.estado.riResultado?.bucket, "rejeitado_sem_persistencia");
});

// ── 9/10. Fluxo não inicia lote nem altera ponteiro/cardinalidade ──────────
await teste("9. Bloco do controle não referencia estado de lote/progresso/ponteiro (rodando, progresso, numeroQuestao, questoesPorTemaAtual)", () => {
  for (const proibido of ["setRodando(", "setProgresso(", "numeroQuestao", "questoesPorTemaAtual", "obterProximoNumeroSA("]) {
    assert.ok(!blocoControle.includes(proibido), `bloco do controle não deveria referenciar "${proibido}" (isolamento de lote/cardinalidade)`);
  }
});

// ── 8 (fluxo não chama gerador de questão) ──────────────────────────────────
await teste("10. Bloco do controle nunca chama o gerador de questão nem grava na coleção 'questoes'", () => {
  for (const proibido of ["executarGeracaoSA(", 'doc(db, "questoes"', 'collection(db, "questoes")']) {
    assert.ok(!blocoControle.includes(proibido), `bloco do controle não deveria conter "${proibido}"`);
  }
  // A única leitura em "questoes" é getDoc — nunca setDoc/addDoc/updateDoc/deleteDoc.
  assert.match(blocoControle, /fsGetDoc\(fsDoc\(db, "questoes", id\)\)/, "busca deveria usar getDoc (leitura), não uma escrita");
  for (const escrita of ["fsSetDoc(fsDoc(db, \"questoes\"", "setDoc(doc(db, \"questoes\"", "updateDoc(", "deleteDoc(", "writeBatch("]) {
    assert.ok(!blocoControle.includes(escrita), `bloco do controle não deveria conter escrita "${escrita}" na coleção de questões`);
  }
});

// ── 11. Rejeição final não provoca repetição manual automática ─────────────
await teste("11. Handler não contém loop/retry próprio — só 1 ponto de chamada a gerarESalvarResumo (o teto de 2 chamadas já pertence ao fluxo existente)", () => {
  const fn = extrairFuncaoAsync("executarRegeneracaoResumoIsolado");
  const ocorrencias = (fn.match(/gerarESalvarResumo\(/g) || []).length;
  assert.equal(ocorrencias, 1, "handler deveria chamar gerarESalvarResumo exatamente 1 vez por acionamento — nenhum retry/loop próprio");
  assert.ok(!/for\s*\(|while\s*\(/.test(fn), "handler não deveria conter loop próprio (for/while)");
});

// ── 12. Nenhuma identificação específica de R067/R092/R077 codificada ──────
await teste("12. Bloco do controle é genérico — nenhum ID específico (R067, R092, R077, SA_2026_2_Q28) está codificado na lógica", () => {
  for (const idEspecifico of ["R067", "R092", "R077", "SA_2026_2_Q28", "SA_2026_2_Q"]) {
    assert.ok(!blocoControle.includes(idEspecifico), `bloco do controle não deveria conter o identificador específico "${idEspecifico}"`);
  }
});

// ── 13. Teto interno de 2 chamadas continua pertencendo a executarGeracaoResumoSA (promptEngine.js), não duplicado aqui ──
await teste("13. O controle delega inteiramente a gerarESalvarResumo/executarGeracaoResumoSA — não reimplementa teto de tentativas", () => {
  const fn = extrairFuncaoAsync("executarRegeneracaoResumoIsolado");
  assert.doesNotMatch(fn, /tentar\(|executarGeracaoResumoSA\(/, "handler não deveria chamar executarGeracaoResumoSA diretamente nem reimplementar retry — deve delegar 100% a gerarESalvarResumo");
});

// ── 14. Persistência continua condicionada à aprovação (invariante do fluxo existente, não deste controle) ──
await teste("14. resumoEngine.js: setDoc em 'teorias' continua só depois do guard status !== 'aprovado' (regressão, não tocado por este controle)", () => {
  const resumoEngineSrc = normalizarQuebraDeLinha(fs.readFileSync(path.join(_raiz, "src/utils/resumoEngine.js"), "utf8"));
  const idxGuard = resumoEngineSrc.indexOf('resultado.status !== "aprovado"');
  const idxSetDocSA = resumoEngineSrc.indexOf('setDoc(doc(db, "teorias", key)');
  assert.ok(idxGuard > -1 && idxSetDocSA > -1 && idxSetDocSA > idxGuard, "guard de aprovação antes de setDoc em 'teorias' deveria continuar intacto");
});

// ── Busca da questão: leitura pura, sem persistência, sem lote ─────────────
function montarHarnessBuscar({ id, docExiste, dadosDoc }) {
  const chamadas = { fsGetDoc: 0 };
  const estado = { riErroBusca: "", riQuestao: null, riResultado: "marcador-nao-deve-mudar", riBuscando: false, riConfirmando: "marcador-nao-deve-mudar" };
  const escopo = {
    riDocId: id,
    setRiErroBusca: (v) => { estado.riErroBusca = v; },
    setRiResultado: (v) => { estado.riResultado = v; },
    setRiQuestao: (v) => { estado.riQuestao = v; },
    setRiBuscando: (v) => { estado.riBuscando = v; },
    setRiConfirmando: (v) => { estado.riConfirmando = v; },
    db: {},
    fsDoc: (...args) => ({ __path: args }),
    fsGetDoc: async (_ref) => {
      chamadas.fsGetDoc++;
      return {
        exists: () => docExiste,
        id: "DOC_ID_MOCK",
        data: () => dadosDoc,
      };
    },
  };
  const corpo = extrairFuncaoAsync("buscarQuestaoParaResumoIsolado")
    .replace(/^const buscarQuestaoParaResumoIsolado = async \(\) => /, "")
    .replace(/;\s*$/, "");
  const executar = new Function(...Object.keys(escopo), `return (async () => ${corpo})();`);
  return { rodar: () => executar(...Object.values(escopo)), chamadas, estado };
}

await teste("ID vazio → não chama fsGetDoc (nenhuma leitura desnecessária ao Firestore)", async () => {
  const h = montarHarnessBuscar({ id: "   ", docExiste: true, dadosDoc: { modulo: "super_apostas" } });
  await h.rodar();
  assert.equal(h.chamadas.fsGetDoc, 0);
  assert.match(h.estado.riErroBusca, /Informe o ID/);
});

await teste("Documento inexistente → riQuestao permanece null, erro claro ao administrador", async () => {
  const h = montarHarnessBuscar({ id: "NAO_EXISTE", docExiste: false, dadosDoc: null });
  await h.rodar();
  assert.equal(h.estado.riQuestao, null);
  assert.match(h.estado.riErroBusca, /não encontrada/);
});

await teste("Questão de outro módulo (modulo !== 'super_apostas') → riQuestao permanece null", async () => {
  const h = montarHarnessBuscar({ id: "Q_INEP", docExiste: true, dadosDoc: { modulo: "inep", tema_mestre: "Outro" } });
  await h.rodar();
  assert.equal(h.estado.riQuestao, null);
  assert.match(h.estado.riErroBusca, /Super Apostas/);
});

await teste("Questão SA válida → riQuestao é carregada com id + dados, sem erro", async () => {
  const h = montarHarnessBuscar({ id: "SA_QUALQUER", docExiste: true, dadosDoc: { modulo: "super_apostas", tema_mestre: "Tema X" } });
  await h.rodar();
  assert.deepEqual(h.estado.riQuestao, { id: "DOC_ID_MOCK", modulo: "super_apostas", tema_mestre: "Tema X" });
  assert.equal(h.estado.riErroBusca, "");
});

// ── 15. Ausência de rede real em todos os testes acima ─────────────────────
await teste("15. Nenhum teste deste arquivo importa Firebase real nem faz chamada de rede (fsGetDoc/gerarESalvarResumo totalmente mockados)", () => {
  const esteArquivo = fs.readFileSync(fileURLToPath(import.meta.url), "utf8");
  // Regex ancorada a início de linha (import real), não substring solta —
  // evita autodetecção da própria string usada nesta checagem como "falso positivo".
  assert.ok(!/^import\b[^\n]*["']firebase\/firestore["']/m.test(esteArquivo), "este arquivo de teste não deveria ter um import real de firebase/firestore");
  assert.ok(!/^import\b[^\n]*["']\.\.\/firebase["']/m.test(esteArquivo), "este arquivo de teste não deveria importar ../firebase (inicialização real do SDK)");
});

// ── 16. Portabilidade LF/CRLF do mecanismo de extração ─────────────────────
// Prova, com conteúdo sintético em memória (não os arquivos reais do
// projeto, sem I/O de disco), que o mecanismo essencial de extração usado
// acima (normalizar quebra de linha e então localizar por indexOf um
// literal multilinha) produz o mesmo resultado independente de o
// arquivo-fonte original estar salvo em LF ou em CRLF. Reproduz em miniatura
// exatamente o padrão de extrairBlocoControle().
function extrairBlocoSintetico(conteudoBruto) {
  const src = normalizarQuebraDeLinha(conteudoBruto);
  const inicio = src.indexOf("// INICIO-BLOCO");
  if (inicio === -1) return null;
  const fim = src.indexOf("    </div>\n  );\n}", inicio);
  if (fim === -1 || fim <= inicio) return null;
  return src.slice(inicio, fim);
}

const fonteSinteticaLF = [
  "// antes do bloco",
  "// INICIO-BLOCO",
  "const exemplo = 1;",
  "    </div>",
  "  );",
  "}",
  "// depois do bloco",
  "",
].join("\n");
const fonteSinteticaCRLF = fonteSinteticaLF.replace(/\n/g, "\r\n");

await teste("16. Portabilidade: mecanismo de extração produz o mesmo resultado em conteúdo-fonte LF e em CRLF equivalente", () => {
  const resultadoLF = extrairBlocoSintetico(fonteSinteticaLF);
  const resultadoCRLF = extrairBlocoSintetico(fonteSinteticaCRLF);
  assert.ok(resultadoLF, "extração deveria ter sucesso com conteúdo-fonte em LF");
  assert.ok(resultadoCRLF, "extração deveria ter sucesso com conteúdo-fonte em CRLF equivalente (sem a normalização, este caso falharia)");
  assert.equal(resultadoLF, resultadoCRLF, "resultado da extração deveria ser idêntico independente da convenção de quebra de linha de origem");
});

console.log(`\n${passou}/${passou + falhas.length} testes passaram.`);
if (falhas.length > 0) {
  console.log("\nFalhas:");
  falhas.forEach((f) => console.log(`  - ${f.nome}: ${f.erro}`));
  process.exit(1);
}
