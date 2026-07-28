// ─── TESTES — INSTRUÇÃO PREVENTIVA GLOBAL DO RETRY DE RESUMO ─────────────────
// Mesmo padrão dos demais scripts desta família (Node puro, zero rede real,
// zero Firebase). promptEngine.js importa ../firebase no topo (quebra em Node
// puro fora do Vite) — este arquivo nunca o importa ao vivo. Em vez disso,
// extrai da fonte real (regex + `new Function`, mesma técnica já usada em
// test-resumo-isolado-dev-control.js e test-questao-retry-hardening.js) o
// bloco autocontido que define validarResumoSA/executarGeracaoResumoSA e todas
// as suas dependências privadas (_contemAfirmacaoForte, _extrairNumerosSignificativos,
// _classificarFalhaResumoSA etc.) — e então EXECUTA de verdade o orquestrador,
// com chamarIABruto mockado, para provar comportamento real, não só presença
// de string.
//
// Achado real que motivou este hotfix (R067/Parassonias, Q26/Delirium, Hérnia
// da parede abdominal--idoso): o feedback de retry citava só a categoria que a
// tentativa 1 reprovou. A tentativa 2 podia corrigir essa categoria
// introduzindo OUTRA (ex.: trocar termo absoluto por número "preciso" para
// dizer a mesma coisa) sem nunca ter recebido a proibição preventiva
// correspondente — como o teto é de 2 chamadas, essa categoria nova nunca era
// corrigida. Correção: uma instrução preventiva fixa, sempre anexada ao
// prompt da tentativa 2, cobrindo todas as categorias já validadas.
//
//   node scripts/test-resumo-retry-preventivo.js

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _raiz = path.resolve(__dirname, "..");
const promptEngineSrc = fs.readFileSync(path.join(_raiz, "src/utils/promptEngine.js"), "utf8");
const resumoEngineSrc = fs.readFileSync(path.join(_raiz, "src/utils/resumoEngine.js"), "utf8");

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

// ── Extração do bloco autocontido (validarResumoSA + executarGeracaoResumoSA
// + todas as dependências privadas transitivas, incluindo o lado da questão
// que vive no mesmo trecho do arquivo — não usado diretamente, mas precisa
// estar presente para o bloco compilar como um todo) ────────────────────────
function montarOrquestradorReal() {
  const inicio = promptEngineSrc.indexOf("// Padrões de posologia específica (dose/via/intervalo/duração numérica).");
  assert.ok(inicio > -1, "marcador de início do bloco de validação não encontrado");
  const fim = promptEngineSrc.indexOf("// ─── NORMALIZAÇÃO DO CAMPO RACIOCÍNIO");
  assert.ok(fim > inicio, "marcador de fim (NORMALIZAÇÃO DO CAMPO RACIOCÍNIO) não encontrado após o início");
  const bloco = promptEngineSrc.slice(inicio, fim).replace(/^export const/gm, "const");
  const corpo = `${bloco}\nreturn { executarGeracaoResumoSA, validarResumoSA };`;
  const factory = new Function(corpo);
  return factory();
}
const { executarGeracaoResumoSA, validarResumoSA } = montarOrquestradorReal();

// ── Mocks de conteúdo — cada um dispara EXATAMENTE uma categoria de rejeição,
// verificado contra o validarResumoSA real extraído acima (não hardcoded). ──
const PONTOS_TERMO_ABSOLUTO = [{ label: "🔍 COMO RECONHECER", texto: "O quadro sempre se apresenta da mesma forma, nunca varia entre pacientes." }];
const PONTOS_NUMERO_ORFAO   = [{ label: "🔍 COMO RECONHECER", texto: "O quadro tende a se resolver em cerca de 6 dias, sem necessidade de intervenção." }];
const PONTOS_NEUTRO_OK      = [{ label: "🔍 COMO RECONHECER", texto: "O quadro se apresenta com padrão clínico típico, sem sinais de alarme associados." }];

// Confirma que os mocks acima realmente disparam só a categoria pretendida —
// se isso falhar, os testes de comportamento abaixo estariam testando o
// cenário errado sem avisar.
await teste("0. Mocks de conteúdo disparam exatamente a categoria pretendida (sanity check dos fixtures)", () => {
  const vTermo = validarResumoSA(PONTOS_TERMO_ABSOLUTO, { grounding: false, groundingTexto: "" });
  assert.equal(vTermo.ok, false);
  assert.ok(vTermo.problemas.some((p) => /termo absoluto/.test(p)), "mock de termo absoluto deveria disparar a categoria termo absoluto");
  assert.ok(!vTermo.problemas.some((p) => /número\(s\)\s+clínico/.test(p)), "mock de termo absoluto não deveria disparar número órfão");

  const vNumero = validarResumoSA(PONTOS_NUMERO_ORFAO, { grounding: false, groundingTexto: "" });
  assert.equal(vNumero.ok, false);
  assert.ok(vNumero.problemas.some((p) => /número\(s\)\s+clínico/.test(p)), "mock de número órfão deveria disparar a categoria número clínico");
  assert.ok(!vNumero.problemas.some((p) => /termo absoluto/.test(p)), "mock de número órfão não deveria disparar termo absoluto");

  const vOk = validarResumoSA(PONTOS_NEUTRO_OK, { grounding: false, groundingTexto: "" });
  assert.equal(vOk.ok, true, "mock neutro deveria passar limpo, sem nenhuma categoria disparada");
});

const respostaDe = (pontos) => ({ dados: { titulo: "Tema — contexto", pontos }, usage: null });

function montarMockSequencial(respostas) {
  const prompts = [];
  let chamada = 0;
  const fn = async (_systemPrompt, prompt) => {
    prompts.push(prompt);
    const resp = respostas[chamada];
    chamada++;
    if (typeof resp === "function") return resp();
    return resp;
  };
  return { chamarIABrutoMock: fn, prompts, contagem: () => chamada };
}

// ── 1. Tentativa 1 — termo absoluto: prompt2 deve conter feedback específico
//       + proibição preventiva de números + instrução de revisão total ──────
await teste("1a. Retry após termo absoluto: prompt2 contém o feedback específico do termo", async () => {
  const { chamarIABrutoMock, prompts } = montarMockSequencial([respostaDe(PONTOS_TERMO_ABSOLUTO), respostaDe(PONTOS_NEUTRO_OK)]);
  await executarGeracaoResumoSA("Tema: X\nContexto: adulto", "SYS", { grounding: false, groundingTexto: "" }, chamarIABrutoMock);
  assert.equal(prompts.length, 2);
  assert.match(prompts[1], /FEEDBACK DA TENTATIVA ANTERIOR/, "prompt2 deveria conter o bloco de feedback específico");
  assert.match(prompts[1], /literalmente\s+"sempre"/, "feedback específico deveria citar o termo absoluto realmente encontrado");
});

await teste("1b. Retry após termo absoluto: prompt2 contém proibição preventiva GLOBAL de números clínicos (categoria não detectada na tentativa 1)", async () => {
  const { chamarIABrutoMock, prompts } = montarMockSequencial([respostaDe(PONTOS_TERMO_ABSOLUTO), respostaDe(PONTOS_NEUTRO_OK)]);
  await executarGeracaoResumoSA("Tema: X\nContexto: adulto", "SYS", { grounding: false, groundingTexto: "" }, chamarIABrutoMock);
  assert.match(prompts[1], /INSTRUÇÃO PREVENTIVA/, "prompt2 deveria conter a instrução preventiva global");
  assert.match(prompts[1], /número clínico/i, "instrução preventiva deveria proibir número clínico mesmo sem ter sido a causa da rejeição");
  assert.match(prompts[1], /(idade|duração|intervalo|dose|prazo|porcentagem|medida|contagem|limiar)/i, "instrução preventiva deveria listar critérios numéricos proibidos");
});

await teste("1c. Retry após termo absoluto: prompt2 proíbe resolver uma categoria introduzindo outra + exige revisar o resumo inteiro + devolver só o JSON corrigido", async () => {
  const { chamarIABrutoMock, prompts } = montarMockSequencial([respostaDe(PONTOS_TERMO_ABSOLUTO), respostaDe(PONTOS_NEUTRO_OK)]);
  await executarGeracaoResumoSA("Tema: X\nContexto: adulto", "SYS", { grounding: false, groundingTexto: "" }, chamarIABrutoMock);
  assert.match(prompts[1], /introduzindo outra dessas categorias/i, "instrução preventiva deveria proibir explicitamente trocar de categoria proibida");
  assert.match(prompts[1], /resumo INTEIRO/, "instrução preventiva deveria exigir revisão do resumo inteiro, não só do trecho apontado");
  assert.match(prompts[1], /apenas com o JSON do resumo corrigido/i, "instrução preventiva deveria exigir devolver só o resumo corrigido");
});

// ── 2. Tentativa 1 — número clínico: prompt2 deve conter feedback específico
//       + proibição preventiva de termos absolutos + revisão total ─────────
await teste("2a. Retry após número órfão: prompt2 contém o feedback específico do número", async () => {
  const { chamarIABrutoMock, prompts } = montarMockSequencial([respostaDe(PONTOS_NUMERO_ORFAO), respostaDe(PONTOS_NEUTRO_OK)]);
  await executarGeracaoResumoSA("Tema: X\nContexto: adulto", "SYS", { grounding: false, groundingTexto: "" }, chamarIABrutoMock);
  assert.equal(prompts.length, 2);
  assert.match(prompts[1], /número\(s\) clínico\(s\) sem diretriz controlada injetada/, "feedback específico deveria citar a rejeição por número órfão");
  assert.match(prompts[1], /injetada:\s*6\b/, "feedback específico deveria citar o número literal realmente rejeitado");
});

await teste("2b. Retry após número órfão: prompt2 contém proibição preventiva GLOBAL de termo absoluto (categoria não detectada na tentativa 1) + não substituir por outro número", async () => {
  const { chamarIABrutoMock, prompts } = montarMockSequencial([respostaDe(PONTOS_NUMERO_ORFAO), respostaDe(PONTOS_NEUTRO_OK)]);
  await executarGeracaoResumoSA("Tema: X\nContexto: adulto", "SYS", { grounding: false, groundingTexto: "" }, chamarIABrutoMock);
  assert.match(prompts[1], /INSTRUÇÃO PREVENTIVA/, "prompt2 deveria conter a instrução preventiva global");
  assert.match(prompts[1], /termo absoluto/i, "instrução preventiva deveria proibir termo absoluto mesmo sem ter sido a causa da rejeição");
  assert.match(prompts[1], /substitua por nenhum outro número/i, "feedback específico de número já deveria proibir substituição por outro número (regressão)");
  assert.match(prompts[1], /resumo INTEIRO/, "instrução preventiva deveria exigir revisão do resumo inteiro");
});

// ── 3. Troca de categoria: tentativa 2 (final) falha por categoria DIFERENTE
//       da tentativa 1, mesmo com a instrução preventiva presente no prompt —
//       o teto continua em 2 chamadas, sem 3ª tentativa, sem persistência ──
await teste("3a. Termo absoluto → número clínico: exatamente 2 chamadas, status final rejeitado, problemas finais são os da tentativa 2 (número)", async () => {
  const { chamarIABrutoMock, prompts, contagem } = montarMockSequencial([respostaDe(PONTOS_TERMO_ABSOLUTO), respostaDe(PONTOS_NUMERO_ORFAO)]);
  const resultado = await executarGeracaoResumoSA("Tema: X\nContexto: adulto", "SYS", { grounding: false, groundingTexto: "" }, chamarIABrutoMock);
  assert.equal(contagem(), 2, "não deveria haver 3ª chamada mesmo com troca de categoria");
  assert.equal(prompts.length, 2);
  assert.equal(resultado.status, "rejeitado");
  assert.ok(resultado.problemas.some((p) => /número\(s\)\s+clínico/.test(p)), "problemas finais deveriam refletir a categoria da tentativa 2 (número), não da 1ª");
  assert.ok(!resultado.problemas.some((p) => /termo absoluto/.test(p)), "problemas finais não deveriam conter a categoria já corrigida da tentativa 1 (termo absoluto)");
});

await teste("3b. Número clínico → termo absoluto (cenário inverso): exatamente 2 chamadas, status final rejeitado, problemas finais são os da tentativa 2 (termo)", async () => {
  const { chamarIABrutoMock, contagem } = montarMockSequencial([respostaDe(PONTOS_NUMERO_ORFAO), respostaDe(PONTOS_TERMO_ABSOLUTO)]);
  const resultado = await executarGeracaoResumoSA("Tema: X\nContexto: adulto", "SYS", { grounding: false, groundingTexto: "" }, chamarIABrutoMock);
  assert.equal(contagem(), 2, "não deveria haver 3ª chamada mesmo com troca de categoria (cenário inverso)");
  assert.equal(resultado.status, "rejeitado");
  assert.ok(resultado.problemas.some((p) => /termo absoluto/.test(p)), "problemas finais deveriam refletir a categoria da tentativa 2 (termo absoluto)");
  assert.ok(!resultado.problemas.some((p) => /número\(s\)\s+clínico/.test(p)), "problemas finais não deveriam conter a categoria já corrigida da tentativa 1 (número)");
});

// ── 4. Aprovação no retry: fluxo já existente, preservado ──────────────────
await teste("4. Tentativa 1 rejeitada + tentativa 2 válida → exatamente 2 chamadas, status aprovado, dados da tentativa 2 retornados", async () => {
  const { chamarIABrutoMock, contagem } = montarMockSequencial([respostaDe(PONTOS_TERMO_ABSOLUTO), respostaDe(PONTOS_NEUTRO_OK)]);
  const resultado = await executarGeracaoResumoSA("Tema: X\nContexto: adulto", "SYS", { grounding: false, groundingTexto: "" }, chamarIABrutoMock);
  assert.equal(contagem(), 2);
  assert.equal(resultado.status, "aprovado");
  assert.deepEqual(resultado.dados.pontos, PONTOS_NEUTRO_OK);
  assert.equal(resultado.tentativas.length, 2);
});

// ── 5. Regressões ────────────────────────────────────────────────────────
await teste("5a. Aprovado na tentativa 1 → só 1 chamada (nenhum prompt2 nem instrução preventiva chega a ser montada)", async () => {
  const { chamarIABrutoMock, prompts, contagem } = montarMockSequencial([respostaDe(PONTOS_NEUTRO_OK)]);
  const resultado = await executarGeracaoResumoSA("Tema: X\nContexto: adulto", "SYS", { grounding: false, groundingTexto: "" }, chamarIABrutoMock);
  assert.equal(contagem(), 1, "aprovação na 1ª tentativa não deveria disparar retry");
  assert.equal(prompts.length, 1);
  assert.equal(resultado.status, "aprovado");
  assert.equal(resultado.tentativas.length, 1);
});

await teste("5b. grounding_bloqueio (número sem suporte na diretriz injetada) continua parando em 1 chamada, sem instrução preventiva", async () => {
  const groundingTexto = "Diretriz controlada: intervalo de reavaliação recomendado.";
  const pontosSemSuporte = [{ label: "💊 TRATAMENTO PRÁTICO", texto: "Reavaliar em 42 dias conforme a diretriz vigente." }];
  const { chamarIABrutoMock, prompts, contagem } = montarMockSequencial([respostaDe(pontosSemSuporte)]);
  const resultado = await executarGeracaoResumoSA("Tema: X\nContexto: adulto", "SYS", { grounding: true, groundingTexto }, chamarIABrutoMock);
  assert.equal(contagem(), 1, "grounding_bloqueio (Tipo A) não deveria disparar retry");
  assert.equal(prompts.length, 1);
  assert.equal(resultado.status, "bloqueado");
  assert.ok(resultado.problemas.some((p) => /não aparece\(m\) no conteúdo da diretriz controlada injetada/.test(p)));
});

await teste("5c. Teto absoluto de 2 chamadas: nenhuma 3ª tentativa mesmo quando a tentativa 2 também falha (regressão estrutural)", () => {
  const fn = promptEngineSrc.match(/export const executarGeracaoResumoSA = [\s\S]*?\n\};/);
  assert.ok(fn, "executarGeracaoResumoSA não encontrada");
  const invocacoesReais = (fn[0].match(/\btentar\(/g) || []).length;
  assert.equal(invocacoesReais, 2, "deveria haver exatamente 2 invocações de tentar() — teto absoluto preservado");
});

await teste("5d. resumoEngine.js: guard de persistência (setDoc só após status === 'aprovado') permanece intacto", () => {
  const idxGuard = resumoEngineSrc.indexOf('resultado.status !== "aprovado"');
  const idxSetDocSA = resumoEngineSrc.indexOf('setDoc(doc(db, "teorias", key)');
  assert.ok(idxGuard > -1 && idxSetDocSA > -1 && idxSetDocSA > idxGuard, "guard de aprovação antes de setDoc em 'teorias' deveria continuar intacto — este hotfix não toca resumoEngine.js");
});

// ── 6. Sanidade do texto da instrução preventiva — sem exemplo clínico concreto reproduzível ──
await teste("6. _INSTRUCAO_PREVENTIVA_RETRY_RESUMO não contém exemplo numérico clínico concreto (número + unidade clínica) que o modelo possa copiar", () => {
  const fn = promptEngineSrc.match(/const _INSTRUCAO_PREVENTIVA_RETRY_RESUMO = `([\s\S]*?)`;/);
  assert.ok(fn, "_INSTRUCAO_PREVENTIVA_RETRY_RESUMO não encontrada no código-fonte real");
  assert.doesNotMatch(fn[1], /\d+\s*(anos?|meses?|dias?|horas?|min|mg|kg|ml|%)/i, "instrução preventiva não deveria conter um exemplo numérico clínico concreto reproduzível");
});

console.log(`\n${passou}/${passou + falhas.length} testes passaram.`);
if (falhas.length > 0) {
  console.log("\nFalhas:");
  falhas.forEach((f) => console.log(`  - ${f.nome}: ${f.erro}`));
  process.exit(1);
}
