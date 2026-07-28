// ─── TESTES — HOTFIX DE ECONOMIA DE CRÉDITOS: FEEDBACK ESPECÍFICO DE ─────────
// ─── "resumo_numero_orfao" + REFORÇO PREVENTIVO DO PROMPT DO RESUMO SA ───────
// Mesmo padrão dos demais scripts desta família (Node puro, zero rede real,
// zero Firebase). promptEngine.js importa ../firebase no topo (que acessa
// import.meta.env.VITE_FIREBASE_*, inexistente em Node puro fora do Vite) —
// então este arquivo nunca faz `import` do módulo inteiro. As funções puras
// novas/alteradas (sem dependência de Firebase) são extraídas do CÓDIGO-FONTE
// REAL via regex e executadas via `new Function` — prova comportamento de
// verdade, não só presença de string. Mesma técnica de
// test-resumo-sa4-feedback.js / test-questao-retry-hardening.js.
//
// Achado real da auditoria somente-leitura (2026-07-28): o resumo de R067
// (Parassonias: pavor noturno vs. epilepsia) foi rejeitado 2x — tentativa 1
// por "criança > 6 anos", tentativa 2 (após feedback genérico de
// "resumo_numero_orfao") por "criança > 8–10 anos". O feedback antigo nunca
// citava os valores/trecho rejeitados nem proibia expressamente trocar por
// outro número — o modelo trocou "6" por "8-10" e falhou de novo pela mesma
// classe de erro, gastando a única retentativa disponível. Decisão
// arquitetural (ChatGPT): NÃO liberar números do enunciado (Estratégia B
// adiada) — só refinar prompt + feedback, mantendo o validador 100%
// fail-closed. Este arquivo prova que:
//   (a) o novo feedback de "resumo_numero_orfao" cita os valores/trecho reais
//       (dinamicamente, não hardcoded para R067 especificamente);
//   (b) o novo feedback proíbe expressamente substituir por outro número;
//   (c) o prompt agora fecha explicitamente a lacuna de idade/intervalo
//       etário, sem liberar números do enunciado;
//   (d) nada da política de aprovação numérica mudou — zero-tolerância sem
//       grounding continua idêntica para idade, dose, limiar, ano, estágio etc.
//
//   node scripts/test-resumo-numero-orfao-feedback.js

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _raiz = path.resolve(__dirname, "..");
const src = fs.readFileSync(path.join(_raiz, "src/utils/promptEngine.js"), "utf8");

let passou = 0;
const falhas = [];
function teste(nome, fn) {
  try {
    fn();
    passou++;
    console.log(`✅ ${nome}`);
  } catch (e) {
    falhas.push({ nome, erro: e.message });
    console.log(`❌ ${nome} — ${e.message}`);
  }
}

// ── Helpers de extração de código-fonte real (não reimplementa a lógica) ────
function extrairConstMultilinha(nome) {
  const re = new RegExp(`const ${nome} = [^\\n]*=> \\{[\\s\\S]*?\\n\\};`);
  const m = src.match(re);
  if (!m) throw new Error(`bloco "${nome}" não encontrado no código-fonte real`);
  return m[0];
}
function extrairConstLinhaUnica(nome) {
  const re = new RegExp(`const ${nome} = [^\\n]*;`);
  const m = src.match(re);
  if (!m) throw new Error(`bloco "${nome}" não encontrado no código-fonte real`);
  return m[0];
}

// Monta um módulo executável real com as funções puras encadeadas exatamente
// como aparecem no arquivo-fonte — nenhuma reimplementação, só stitching.
function montarModuloNumerico() {
  const partes = [
    extrairConstLinhaUnica("_SUFIXOS_UNIDADE_RECONHECIDOS"),
    extrairConstMultilinha("_extrairNumerosSignificativos"),
    extrairConstMultilinha("_localizarTrechoNumero"),
    extrairConstMultilinha("_extrairNumerosTrechoOrfaos"),
    extrairConstLinhaUnica("_FEEDBACK_RESUMO_NUMERO_ORFAO_GENERICO"),
    extrairConstMultilinha("_feedbackResumoNumeroOrfao"),
    "return { _extrairNumerosSignificativos, _localizarTrechoNumero, _extrairNumerosTrechoOrfaos, _feedbackResumoNumeroOrfao, _FEEDBACK_RESUMO_NUMERO_ORFAO_GENERICO };",
  ];
  return new Function(partes.join("\n\n"))();
}

let mod;
teste("0. Módulo numérico puro (extraído do código-fonte real) monta e executa sem erro", () => {
  mod = montarModuloNumerico();
  assert.equal(typeof mod._feedbackResumoNumeroOrfao, "function");
  assert.equal(typeof mod._extrairNumerosSignificativos, "function");
});

// ── 1. Prompt informa explicitamente que idade/intervalo etário contam como número clínico ──
teste('1. PROMPT_SISTEMA_RESUMO_SA proíbe explicitamente idade/faixa/intervalo etário sem grounding', () => {
  const prompt = src.match(/export const PROMPT_SISTEMA_RESUMO_SA = `[\s\S]*`;/);
  assert.ok(prompt, "PROMPT_SISTEMA_RESUMO_SA não encontrado");
  assert.match(prompt[0], /QUALQUER idade, faixa etária ou intervalo etário/, "prompt não fecha explicitamente a lacuna de idade/intervalo etário");
  assert.match(prompt[0], /8-10 anos.*8 a 10 anos|8 a 10 anos.*8-10 anos/, "prompt não exemplifica intervalo com hífen e com \"a\"");
});

// ── 2. Prompt exige reformulação qualitativa sem substituir por outro número ──
teste("2. PROMPT_SISTEMA_RESUMO_SA proíbe expressamente trocar um número rejeitado por outro", () => {
  const prompt = src.match(/export const PROMPT_SISTEMA_RESUMO_SA = `[\s\S]*`;/);
  assert.match(prompt[0], /NUNCA troque por outro número/, "prompt não proíbe expressamente a substituição por outro número");
  assert.match(prompt[0], /Seu próprio conhecimento médico NUNCA é fonte válida/, "prompt não fecha a lacuna de \"completar por conhecimento próprio\"");
});

// ── 3. Prompt NÃO autoriza números do enunciado (Estratégia B não implementada) ──
teste("3. PROMPT_SISTEMA_RESUMO_SA declara explicitamente que números do enunciado não são autorizados", () => {
  const prompt = src.match(/export const PROMPT_SISTEMA_RESUMO_SA = `[\s\S]*`;/);
  assert.match(prompt[0], /nenhum número do enunciado está autorizado nesta etapa/, "prompt não declara a não-autorização de números do enunciado");
});

// ── 4. Bloco COMO RECONHECER recebe instrução qualitativa específica ────────
teste('4. Prompt orienta o bloco "COMO RECONHECER" a preferir linguagem qualitativa sem diretriz', () => {
  const prompt = src.match(/export const PROMPT_SISTEMA_RESUMO_SA = `[\s\S]*`;/);
  assert.match(prompt[0], /No bloco COMO RECONHECER sem diretriz:/, "prompt não tem instrução dedicada ao bloco COMO RECONHECER");
});

// ── 5. Motivo de numerosOrfaos e extrator de feedback são compatíveis (execução real) ──
teste("5. Feedback de resumo_numero_orfao cita os valores literais 6, 8, 10 (achado real R067, mas dinâmico)", () => {
  const motivo = 'resumo contém número(s) clínico(s) (6, 8, 10) sem diretriz controlada injetada — nenhum critério numérico (idade de corte, limiar laboratorial, contagem etc.) pode aparecer sem fonte, mesmo fora do padrão de posologia, trecho: "criança > 6 anos"';
  const feedback = mod._feedbackResumoNumeroOrfao(motivo);
  assert.match(feedback, /6, 8, 10/, "feedback não cita os valores literais rejeitados");
});

// ── 6. Feedback inclui o trecho/snippet quando disponível no motivo ─────────
teste("6. Feedback de resumo_numero_orfao inclui o trecho real quando presente no motivo", () => {
  const motivo = 'resumo contém número(s) clínico(s) (6, 8, 10) sem diretriz controlada injetada — nenhum critério numérico (idade de corte, limiar laboratorial, contagem etc.) pode aparecer sem fonte, mesmo fora do padrão de posologia, trecho: "criança > 6 anos"';
  const feedback = mod._feedbackResumoNumeroOrfao(motivo);
  assert.match(feedback, /criança > 6 anos/, "feedback não reproduz o trecho literal do motivo");
});

// ── 7. Feedback ordena remover/reformular sem inventar número substituto ────
teste("7. Feedback de resumo_numero_orfao proíbe expressamente substituir por outro número", () => {
  const motivo = 'resumo contém número(s) clínico(s) (6, 8, 10) sem diretriz controlada injetada — nenhum critério numérico (idade de corte, limiar laboratorial, contagem etc.) pode aparecer sem fonte, mesmo fora do padrão de posologia, trecho: "criança > 6 anos"';
  const feedback = mod._feedbackResumoNumeroOrfao(motivo);
  assert.match(feedback, /N[ÃA]O substitua por nenhum outro número/i, "feedback não proíbe expressamente a substituição por outro número");
  assert.match(feedback, /conhecimento próprio/, "feedback não proíbe completar por conhecimento próprio do modelo");
});

// ── 8. Feedback é dinâmico — sem valores fixos codificados especificamente para R067 ──
teste("8. Feedback de resumo_numero_orfao é dinâmico — números diferentes de R067 (42, 99) não retornam 6/8/10", () => {
  const motivoDiferente = 'resumo contém número(s) clínico(s) (42, 99) sem diretriz controlada injetada — nenhum critério numérico (idade de corte, limiar laboratorial, contagem etc.) pode aparecer sem fonte, mesmo fora do padrão de posologia, trecho: "acima de 42 anos"';
  const feedback = mod._feedbackResumoNumeroOrfao(motivoDiferente);
  assert.match(feedback, /42, 99/, "feedback não reflete os valores reais de um motivo diferente de R067");
  assert.doesNotMatch(feedback, /\b6\b|\b8\b|\b10\b/, "feedback não deveria conter os números 6/8/10 quando o motivo real é outro (42, 99) — indício de valor fixo codificado");
  // A própria função-fonte (corpo executável, não os comentários) não deve
  // decidir por literais fixos de R067 — só o comentário de contexto pode
  // citá-los; a lógica em si deve depender exclusivamente do parâmetro.
  const corpoFuncao = extrairConstMultilinha("_feedbackResumoNumeroOrfao").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(corpoFuncao, /["'`]\s*6\s*["'`,)]|["'`]\s*8\s*["'`,)]|["'`]\s*10\s*["'`,)]/, "corpo executável de _feedbackResumoNumeroOrfao não deveria conter os literais 6/8/10 fora de comentários");
});

// ── 9. Sem achado extraível, cai no fallback genérico (nunca quebra) ────────
teste("9. Feedback de resumo_numero_orfao cai no fallback genérico quando o motivo não bate com o formato esperado", () => {
  const feedback = mod._feedbackResumoNumeroOrfao("motivo de formato antigo, sem o padrão esperado");
  assert.equal(feedback, mod._FEEDBACK_RESUMO_NUMERO_ORFAO_GENERICO, "fallback genérico deveria ser retornado sem lançar erro");
  assert.match(feedback, /N[ÃA]O substitua por nenhum outro número/i, "fallback genérico também deveria proibir substituição por outro número (reforço pedido pela missão)");
});

// ── 10. "6 anos" continua sendo extraído como número clínico (zero-tolerância preservada) ──
teste('10. "criança > 6 anos" continua produzindo o número clínico "6" (regressão R067)', () => {
  const nums = mod._extrairNumerosSignificativos("criança > 6 anos apresenta pavor noturno");
  assert.deepEqual(nums, ["6"], "extração de \"6 anos\" mudou — comportamento de zero-tolerância alterado sem autorização");
});

// ── 11. "8-10 anos" e "8 a 10 anos" continuam ambos extraídos identicamente ──
teste('11. "8-10 anos" e "8 a 10 anos" continuam produzindo os mesmos números clínicos ("8","10")', () => {
  const numsHifen = mod._extrairNumerosSignificativos("criança de 8-10 anos");
  const numsPorExtenso = mod._extrairNumerosSignificativos("criança de 8 a 10 anos");
  assert.deepEqual(numsHifen, ["8", "10"], "\"8-10 anos\" deveria produzir [\"8\",\"10\"]");
  assert.deepEqual(numsPorExtenso, ["8", "10"], "\"8 a 10 anos\" deveria produzir [\"8\",\"10\"]");
});

// ── 12. Números só no enunciado NÃO são autorizados — validarResumoSA não recebe/usa enunciado ──
teste("12. validarResumoSA continua sem parâmetro/uso de enunciado ou textoCasoAutorizado (Estratégia B não implementada)", () => {
  const fn = src.match(/export const validarResumoSA = \(pontos, \{ grounding = false, groundingTexto = "" \} = \{\}\) => \{[\s\S]*?\n\};/);
  assert.ok(fn, "validarResumoSA não encontrado ou assinatura mudou inesperadamente");
  assert.doesNotMatch(fn[0], /textoCasoAutorizado/, "validarResumoSA não deveria referenciar textoCasoAutorizado nesta etapa (Estratégia B fica para decisão futura)");
  assert.doesNotMatch(fn[0], /questao\.enunciado|q\?\.enunciado/, "validarResumoSA não deveria referenciar enunciado da questão nesta etapa");
});

// ── 13. Doses/duração/percentuais/limiares/estágios continuam fail-closed (genéricos) ──
teste("13. Doses, limiares, percentuais, anos, graus/estágios continuam sendo capturados como números clínicos genéricos", () => {
  assert.ok(mod._extrairNumerosSignificativos("10 mg/kg a cada 12 horas").length > 0, "\"10 mg/kg\" deveria continuar gerando número(s) clínico(s)");
  assert.ok(mod._extrairNumerosSignificativos("glicemia de 126 mg/dL").length > 0, "\"126 mg/dL\" (limiar laboratorial) deveria continuar gerando número(s) clínico(s)");
  assert.ok(mod._extrairNumerosSignificativos("ocorre em 90% dos casos").length > 0, "\"90%\" deveria continuar gerando número(s) clínico(s)");
  assert.ok(mod._extrairNumerosSignificativos("diretriz vigente desde 2020").length > 0, "ano isolado (\"2020\") deveria continuar gerando número(s) clínico(s)");
  assert.ok(mod._extrairNumerosSignificativos("classificado como grau 2").length > 0, "\"grau 2\" deveria continuar gerando número(s) clínico(s) (sem categoria de estágio/grau reconhecida)");
  assert.ok(mod._extrairNumerosSignificativos("etapa 3 do protocolo").length > 0, "\"etapa 3\" deveria continuar gerando número(s) clínico(s)");
});

// ── 14. Ordinais e marcadores estruturais continuam explicitamente isentos (regressão) ──
teste("14. Ordinais (\"1ª escolha\") e marcadores estruturais (\"PASSO 3\") continuam isentos da extração", () => {
  assert.deepEqual(mod._extrairNumerosSignificativos("1ª escolha terapêutica"), [], "ordinal \"1ª\" não deveria gerar número clínico (comportamento pré-existente, não deveria regredir)");
  assert.deepEqual(mod._extrairNumerosSignificativos("Siga o PASSO 3 do protocolo"), [], "\"PASSO 3\" não deveria gerar número clínico (comportamento pré-existente, não deveria regredir)");
});

// ── 15. validarResumoSA embute o trecho na mensagem de numerosOrfaos, na ordem correta ──
teste("15. validarResumoSA calcula _localizarTrechoNumero DEPOIS de detectar numerosOrfaos (ordem correta, sem custo quando não há órfãos)", () => {
  const fn = src.match(/export const validarResumoSA = \(pontos, \{ grounding = false, groundingTexto = "" \} = \{\}\) => \{[\s\S]*?\n\};/);
  assert.ok(fn, "validarResumoSA não encontrado");
  const idxOrfaos = fn[0].indexOf("_extrairNumerosSignificativos(textoCompleto)");
  const idxTrecho = fn[0].indexOf("_localizarTrechoNumero(textoCompleto, numerosOrfaos)");
  assert.ok(idxOrfaos > -1, "chamada a _extrairNumerosSignificativos não encontrada em validarResumoSA");
  assert.ok(idxTrecho > idxOrfaos, "_localizarTrechoNumero deveria rodar depois de calcular numerosOrfaos");
  assert.match(fn[0], /trechoNumero \? `, trecho: "\$\{trechoNumero\}"` : ""/, "mensagem de numerosOrfaos deveria embutir o trecho condicionalmente, sem quebrar quando não há trecho localizável");
});

// ── 16. Consumidor de _CATEGORIAS_CORRIGIVEIS_RESUMO continua chamando feedback como função ──
teste("16. resumo_numero_orfao consome feedback via chamada de função (t) => ..., não string estática", () => {
  const bloco = src.match(/const _CATEGORIAS_CORRIGIVEIS_RESUMO = \[([\s\S]*?)\];/);
  assert.ok(bloco, "_CATEGORIAS_CORRIGIVEIS_RESUMO não encontrado");
  assert.match(bloco[1], /resumo_numero_orfao[\s\S]*?feedback:\s*\(t\)\s*=>\s*_feedbackResumoNumeroOrfao\(t\)/, "resumo_numero_orfao deveria chamar _feedbackResumoNumeroOrfao(t) dinamicamente");
});

// ── 17. Regressão: categoria resumo_absoluto (6d86a08/40040ab) continua intacta ──
teste("17. _feedbackResumoAbsoluto e o parágrafo de fechamento (aspas/exemplo/fala hipotética) continuam presentes (regressão 6d86a08/40040ab)", () => {
  assert.match(src, /const _feedbackResumoAbsoluto = \(todosMotivos\) => \{/, "_feedbackResumoAbsoluto não encontrada");
  const prompt = src.match(/export const PROMPT_SISTEMA_RESUMO_SA = `[\s\S]*`;/);
  assert.match(prompt[0], /dentro de exemplos ilustrativos, em frases hipotéticas atribuídas a um familiar\/cuidador\/paciente, dentro de aspas/, "parágrafo de fechamento do commit 6d86a08 não encontrado no prompt — possível regressão");
});

// ── 18. Regressão: cardinalidade da questão (c9b294f) continua intacta ──────
teste("18. _MOTIVO_ERRO_CARDINALIDADE e _feedbackCardinalidade continuam presentes (regressão c9b294f)", () => {
  assert.match(src, /const _MOTIVO_ERRO_CARDINALIDADE = \/\^erro de protocolo:/, "_MOTIVO_ERRO_CARDINALIDADE não encontrado — possível regressão de c9b294f");
  assert.match(src, /const _feedbackCardinalidade = \(todosMotivos\) => \{/, "_feedbackCardinalidade não encontrada — possível regressão de c9b294f");
});

// ── 19. Teto de 2 chamadas do resumo permanece intacto (não alterado nesta etapa) ──
teste("19. executarGeracaoResumoSA mantém exatamente 2 invocações de tentar() — nenhuma 3ª tentativa adicionada", () => {
  const fn = src.match(/export const executarGeracaoResumoSA = [\s\S]*?\n\};/);
  assert.ok(fn, "executarGeracaoResumoSA não encontrada");
  const invocacoesReais = (fn[0].match(/\btentar\(/g) || []).length;
  assert.equal(invocacoesReais, 2, "teto de 2 chamadas deveria permanecer intacto — nenhuma 3ª tentativa deveria ter sido adicionada");
});

// ── 20. Nenhuma persistência após 2ª rejeição — setDoc só depois do guard "aprovado" ──
teste('20. resumoEngine.js só grava em "teorias" DEPOIS do guard status !== "aprovado" (fail-closed preservado)', () => {
  const resumoEngineSrc = fs.readFileSync(path.join(_raiz, "src/utils/resumoEngine.js"), "utf8");
  const idxGuard = resumoEngineSrc.indexOf('resultado.status !== "aprovado"');
  const idxSetDocSA = resumoEngineSrc.indexOf('setDoc(doc(db, "teorias", key)');
  assert.ok(idxGuard > -1, "guard de status não encontrado");
  assert.ok(idxSetDocSA > -1, "setDoc do fluxo SA não encontrado");
  assert.ok(idxSetDocSA > idxGuard, "setDoc deveria vir DEPOIS do guard — geração inválida não pode ser persistida");
});

console.log(`\n${passou}/${passou + falhas.length} testes passaram.`);
if (falhas.length > 0) {
  console.log("\nFalhas:");
  falhas.forEach((f) => console.log(`  - ${f.nome}: ${f.erro}`));
  process.exit(1);
}
