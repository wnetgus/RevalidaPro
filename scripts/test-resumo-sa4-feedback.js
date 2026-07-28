// ─── TESTES — FEEDBACK ESPECÍFICO DO RETRY DO RESUMO SA-4 (Micro Hotfix 2) ───
// Mesmo padrão dos demais scripts desta família (Node puro, zero rede real,
// zero Firebase). ESTRUTURAL/TEXTUAL por natureza: promptEngine.js importa
// ../firebase no topo, que acessa import.meta.env.VITE_FIREBASE_* — isso
// quebra em Node puro (sem Vite), então este arquivo nunca importa
// promptEngine.js/resumoEngine.js ao vivo. Em vez disso, examina o CONTEÚDO
// VERSIONADO real dos arquivos — mesma limitação já declarada e mesma técnica
// já usada em test-ia-auth-consumers.js para o mesmo problema.
//
// Achado real que motivou este arquivo: SA_2026_2_Q26 (Delirium x demência) —
// resumo rejeitado 2x pela SA-4 ("nunca" em "agudo e flutuante, nunca
// insidioso"), retry genérico não impediu a repetição. Correção: o motivo de
// validarResumoSA agora carrega o termo/trecho literais, e o feedback de
// retry (_feedbackResumoAbsoluto) os extrai e os cita de volta ao modelo.
//
//   node scripts/test-resumo-sa4-feedback.js

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

// ── 1. "nunca" continua no rol de padrões SA-4 (regressão) ──────────────────
teste('1. "nunca"/"sempre"/"obrigatório"/etc. continuam em _PADROES_AFIRMACAO_FORTE', () => {
  const bloco = promptEngineSrc.match(/const _PADROES_AFIRMACAO_FORTE = \[([\s\S]*?)\];/);
  assert.ok(bloco, "_PADROES_AFIRMACAO_FORTE não encontrado");
  for (const termoLiteral of ["patognom", "padr", "ouro", "sempre", "nunca", "obrigat", "em todos os"]) {
    assert.ok(bloco[1].includes(termoLiteral), `padrão "${termoLiteral}" ausente de _PADROES_AFIRMACAO_FORTE`);
  }
});

// ── 2. _localizarAfirmacaoForte existe e é usado dentro de validarResumoSA ──
teste("2. validarResumoSA usa _localizarAfirmacaoForte quando _contemAfirmacaoForte é true", () => {
  assert.match(promptEngineSrc, /const _localizarAfirmacaoForte = \(texto\) => \{/, "_localizarAfirmacaoForte não definida");
  const validarResumoSA = promptEngineSrc.match(/export const validarResumoSA = [\s\S]*?\n\};/);
  assert.ok(validarResumoSA, "validarResumoSA não encontrado");
  assert.match(validarResumoSA[0], /_contemAfirmacaoForte\(textoCompleto\)/, "validarResumoSA não chama _contemAfirmacaoForte");
  const idxContem = validarResumoSA[0].indexOf("_contemAfirmacaoForte(textoCompleto)");
  const idxLocaliza = validarResumoSA[0].indexOf("_localizarAfirmacaoForte(textoCompleto)");
  assert.ok(idxLocaliza > idxContem, "_localizarAfirmacaoForte deveria rodar dentro do branch de _contemAfirmacaoForte");
});

// ── 3. Motivo carrega termo + trecho literais, extraíveis pelo extrator compartilhado ──
teste("3. Motivo de validarResumoSA e extrator compartilhado são compatíveis (termo + trecho reais)", () => {
  // Template literal real usado por validarResumoSA para montar o motivo.
  const achado = { termo: "nunca", trecho: "agudo e flutuante, nunca insidioso." };
  const motivoReal = `resumo usa termo absoluto ("sempre"/"nunca"/"obrigatório"/"em todos os casos"/"patognomônico"/"padrão-ouro"/percentual específico/"desde AAAA") sem diretriz controlada injetada — termo encontrado: "${achado.termo}", trecho: "${achado.trecho}" (mesma regra do validarLoteSA, SA-4)`;
  assert.ok(promptEngineSrc.includes('termo encontrado: "${achado.termo}", trecho: "${achado.trecho}"'), "template do motivo mudou — assert acima ficaria desalinhado com o código real");

  // _feedbackResumoAbsoluto não tem mais regex própria — delega para o
  // extrator compartilhado (Micro Hardening: mesmo mecanismo reusado pelo
  // lado da questão, _feedbackCandidataAbsoluta).
  const fnFeedback = promptEngineSrc.match(/const _feedbackResumoAbsoluto = \(todosMotivos\) => \{[\s\S]*?\n\};/);
  assert.ok(fnFeedback, "_feedbackResumoAbsoluto não encontrada");
  assert.match(fnFeedback[0], /_extrairTermoTrechoAfirmacaoForte\(todosMotivos\)/, "_feedbackResumoAbsoluto deveria delegar para o extrator compartilhado, não duplicar a regex");

  const fnExtrator = promptEngineSrc.match(/const _extrairTermoTrechoAfirmacaoForte = \(todosMotivos\) => \{[\s\S]*?\n\};/);
  assert.ok(fnExtrator, "_extrairTermoTrechoAfirmacaoForte não encontrado");
  const regexMatch = fnExtrator[0].match(/\.match\((\/[^/]+\/)\)/);
  assert.ok(regexMatch, "regex de extração não encontrada em _extrairTermoTrechoAfirmacaoForte");
  // Regex literal extraída do próprio arquivo-fonte (não é input externo).
  const regexExtracao = new Function(`return ${regexMatch[1]};`)();
  const m = motivoReal.match(regexExtracao);
  assert.ok(m, "a regex de extração não bate com o formato real do motivo");
  assert.equal(m[1], "nunca", "termo extraído deveria ser exatamente 'nunca'");
  assert.equal(m[2], "agudo e flutuante, nunca insidioso.", "trecho extraído deveria ser o trecho literal real");
});

// ── 4. _feedbackResumoAbsoluto cita o termo e o trecho no texto de retorno ──
teste("4. _feedbackResumoAbsoluto reproduz o termo e o trecho no feedback enviado ao modelo", () => {
  const fn = promptEngineSrc.match(/const _feedbackResumoAbsoluto = \(todosMotivos\) => \{[\s\S]*?\n\};/);
  assert.ok(fn, "_feedbackResumoAbsoluto não encontrada");
  assert.match(fn[0], /termo\}/, "feedback não interpola o termo extraído");
  assert.match(fn[0], /trecho\}/, "feedback não interpola o trecho extraído");
  assert.match(fn[0], /releia os 7 blocos/, "feedback não exige revisão lexical final dos 7 blocos antes de responder");
});

// ── 5. Consumidor chama feedback como função para todas as categorias (não só a nova) ──
teste("5. _CATEGORIAS_CORRIGIVEIS_RESUMO consome feedback via chamada de função, uniformemente", () => {
  const bloco = promptEngineSrc.match(/const _CATEGORIAS_CORRIGIVEIS_RESUMO = \[([\s\S]*?)\];/);
  assert.ok(bloco, "_CATEGORIAS_CORRIGIVEIS_RESUMO não encontrado");
  const entradas = bloco[1].match(/feedback:\s*\([^)]*\)\s*=>/g) || [];
  assert.equal(entradas.length, 4, "as 4 categorias corrigíveis do resumo deveriam ter feedback como função (t) => ...");
  assert.match(promptEngineSrc, /feedback: categoriasEncontradas\.map\(\(c\) => c\.feedback\(todos\)\)\.join\(" "\)/, "consumidor deveria chamar c.feedback(todos), não usar c.feedback como valor");
});

// ── 6. Teto de 2 chamadas preservado (nenhuma tentativa extra foi adicionada) ──
teste("6. executarGeracaoResumoSA mantém teto absoluto de 2 chamadas (1 original + 1 retry)", () => {
  const fn = promptEngineSrc.match(/export const executarGeracaoResumoSA = [\s\S]*?\n\};/);
  assert.ok(fn, "executarGeracaoResumoSA não encontrada");
  // "const tentar = async (...)" não casa com /tentar\(/ (não há parêntese
  // logo após o identificador) — só as invocações reais (await tentar(...)) casam.
  const invocacoesReais = (fn[0].match(/\btentar\(/g) || []).length;
  assert.equal(invocacoesReais, 2, "deveria haver exatamente 2 invocações de tentar() — teto absoluto preservado");
});

// ── 7. "aprovado" e "rejeitado" continuam os únicos desfechos possíveis ─────
teste('7. executarGeracaoResumoSA só retorna status "aprovado" (r.ok) ou "rejeitado"/"bloqueado" (sem outro desfecho novo)', () => {
  const fn = promptEngineSrc.match(/export const executarGeracaoResumoSA = [\s\S]*?\n\};/);
  const statusRetornados = [...fn[0].matchAll(/status:\s*"([a-z_]+)"/g)].map((m) => m[1]);
  assert.ok(statusRetornados.includes("aprovado"), "deveria retornar 'aprovado' na saída válida");
  assert.ok(statusRetornados.includes("bloqueado"), "deveria retornar 'bloqueado' no Tipo A (grounding)");
  assert.ok(statusRetornados.includes("rejeitado"), "deveria retornar 'rejeitado' após esgotar o retry (Tipo B)");
  assert.equal(new Set(statusRetornados).size, 3, "não deveria haver um 4º status novo introduzido por esta correção");
});

// ── 8. Nenhuma saída inválida é persistida — setDoc só depois do guard ─────
teste('8. resumoEngine.js só grava em "teorias" DEPOIS do guard status !== "aprovado" (fail-closed preservado)', () => {
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
