// ─── TESTES — MICRO HARDENING: FEEDBACK SA-4 DA QUESTÃO + CARDINALIDADE ──────
// Mesmo padrão dos demais scripts desta família (Node puro, zero rede real,
// zero Firebase). promptEngine.js importa ../firebase no topo (que acessa
// import.meta.env.VITE_FIREBASE_*, inexistente em Node puro fora do Vite) —
// então este arquivo nunca faz `import` do módulo inteiro. Onde a lógica é
// pura (sem dependência de Firebase), extrai o trecho REAL do código-fonte
// via regex e executa via `new Function` — prova comportamento de verdade,
// não só presença de string. Onde isso não é viável com custo razoável
// (validarLoteSA depende de ~8 helpers privados encadeados), usa checagem
// estrutural/textual, mesma técnica já usada em test-ia-auth-consumers.js e
// test-resumo-sa4-feedback.js para o mesmo problema.
//
// Achado real que motivou este arquivo: R079 (Cirurgia/ORL, Cerume
// impactado) — tentativas 1 e 2 rejeitadas por SA-4 com feedback genérico
// (mesma lacuna já fechada no resumo, ainda não no lado da questão);
// tentativa 3 (Opus) devolveu array com 2 candidatas apesar do "modo
// validação" pedir exatamente 1 — nada no pipeline conferia isso.
//
//   node scripts/test-questao-retry-hardening.js

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _raiz = path.resolve(__dirname, "..");
const src = fs.readFileSync(path.join(_raiz, "src/utils/promptEngine.js"), "utf8");
const roboSrc = fs.readFileSync(path.join(_raiz, "src/components/RoboGerador.jsx"), "utf8");

let passou = 0;
const falhas = [];
// async-aware: vários casos de cardinalidade chamam tentar() extraído, que é
// assíncrono (await chamarIABruto(...)) — precisa aguardar antes de decidir
// passou/falhou, senão erros dentro da Promise viram rejeição não tratada.
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

// ── Harness genérico: extrai um trecho de código puro do arquivo-fonte real
// e o executa via new Function, sem tocar em nada que dependa de Firebase.
function extrair(regex, rotulo) {
  const m = src.match(regex);
  assert.ok(m, `${rotulo} não encontrado no arquivo-fonte`);
  return m[0];
}

// _PADROES_AFIRMACAO_FORTE + _localizarAfirmacaoForte — 100% puros.
const localizarAfirmacaoForte = new Function(
  "texto",
  `
  ${extrair(/const _PADROES_AFIRMACAO_FORTE = \[[\s\S]*?\];/, "_PADROES_AFIRMACAO_FORTE")}
  ${extrair(/const _localizarAfirmacaoForte = \(texto\) => \{[\s\S]*?\n\};/, "_localizarAfirmacaoForte")}
  return _localizarAfirmacaoForte(texto);
  `
);

// _extrairTermoTrechoAfirmacaoForte + _feedbackCandidataAbsoluta +
// _FEEDBACK_CANDIDATA_NAO_GROUNDED — 100% puros, usados pelo feedback da questão.
const feedbackCandidataAbsoluta = new Function(
  "todosMotivos",
  `
  ${extrair(/const _extrairTermoTrechoAfirmacaoForte = \(todosMotivos\) => \{[\s\S]*?\n\};/, "_extrairTermoTrechoAfirmacaoForte")}
  ${extrair(/const _FEEDBACK_CANDIDATA_NAO_GROUNDED = "[^"]*";/, "_FEEDBACK_CANDIDATA_NAO_GROUNDED")}
  ${extrair(/const _feedbackCandidataAbsoluta = \(todosMotivos\) => \{[\s\S]*?\n\};/, "_feedbackCandidataAbsoluta")}
  return _feedbackCandidataAbsoluta(todosMotivos);
  `
);

// ════════════════════════════════════════════════════════════════════════
// PARTE A — FEEDBACK SA-4 ESPECÍFICO DA QUESTÃO
// ════════════════════════════════════════════════════════════════════════

await teste('1. Detecta "nunca" e inclui termo + trecho', () => {
  const r = localizarAfirmacaoForte("O quadro agudo e flutuante, nunca insidioso, define delirium.");
  assert.equal(r.termo, "nunca");
  assert.ok(r.trecho.includes("nunca"));
});

await teste('2. Detecta "sempre" e inclui termo + trecho', () => {
  const r = localizarAfirmacaoForte("A conduta correta é sempre reidratar antes de qualquer exame.");
  assert.equal(r.termo, "sempre");
  assert.ok(r.trecho.includes("sempre"));
});

await teste("3. Detecta padrão-ouro e patognomônico", () => {
  const r1 = localizarAfirmacaoForte("A tomografia é o padrão-ouro para este diagnóstico.");
  assert.equal(r1.termo.toLowerCase().replace(/[\s-]/g, ""), "padrãoouro".toLowerCase());
  const r2 = localizarAfirmacaoForte("O sinal é patognomônico da doença.");
  assert.match(r2.termo, /patognom[oô]nic[oa]/i);
});

await teste("4. Detecta percentual específico", () => {
  const r = localizarAfirmacaoForte("Reduz a mortalidade em 30% dos casos graves.");
  assert.equal(r.termo.trim(), "30%");
});

await teste('5. Detecta "desde AAAA"', () => {
  const r = localizarAfirmacaoForte("Esta é a conduta padrão desde 2010 na rede pública.");
  assert.match(r.termo, /desde\s+2010/i);
});

await teste("6. Feedback orienta revisão de TODOS os campos da questão, não só o apontado", () => {
  const motivo = 'conteúdo usa termo absoluto (...) sem diretriz controlada injetada — termo encontrado: "nunca", trecho: "agudo e flutuante, nunca insidioso." (proibido pela REGRA SA-4)';
  const fb = feedbackCandidataAbsoluta(motivo);
  assert.match(fb, /literalmente "nunca"/);
  assert.match(fb, /trecho "agudo e flutuante, nunca insidioso\."/);
  assert.match(fb, /TODOS os campos da questão/);
  assert.match(fb, /enunciado.*alternativas.*raciocínio.*conduta.*dica mestre.*justificativas/i);
});

await teste("6b. Sem achado (motivo antigo/sem marcador), cai no feedback genérico existente — nunca quebra", () => {
  const fb = feedbackCandidataAbsoluta("qualquer motivo sem o marcador novo");
  assert.match(fb, /precisão normativa, posologia ou linguagem absoluta/);
});

await teste("7. Checagem SA-4 continua condicional (não aprova/ignora conteúdo sem violação)", () => {
  const bloco = extrair(/\/\/ Afirmações fortes sem fonte[\s\S]*?(?=\/\/ Fabricação de fonte)/, "bloco SA-4 de validarLoteSA");
  assert.match(bloco, /if \(camposParaChecar\.some\(_contemAfirmacaoForte\)\)/, "o push do motivo continua dentro do mesmo guard condicional de antes — nada é aprovado incondicionalmente");
  // Prova comportamental: texto limpo não deve disparar nenhum dos 8 padrões.
  const patterns = new Function(`${extrair(/const _PADROES_AFIRMACAO_FORTE = \[[\s\S]*?\];/, "_PADROES_AFIRMACAO_FORTE")} return _PADROES_AFIRMACAO_FORTE;`)();
  const textoLimpo = "Paciente estável, conduta orientada por avaliação clínica individualizada e reavaliação periódica.";
  assert.ok(!patterns.some((re) => re.test(textoLimpo)), "texto clinicamente limpo não deveria disparar nenhum padrão SA-4");
});

await teste("8. Fail-closed preservado — categorias continuam todas corrigíveis, nenhuma vira aprovação automática", () => {
  const bloco = extrair(/const _CATEGORIAS_CORRIGIVEIS_SA = \[[\s\S]*?\];/, "_CATEGORIAS_CORRIGIVEIS_SA");
  assert.match(bloco, /tipo: "questao_absoluto"/, "categoria específica da questão deveria existir");
  assert.match(bloco, /tipo: "candidata_nao_grounded"/, "categoria genérica original deveria continuar existindo");
  assert.match(bloco, /candidata_nao_grounded.*&&\s*!\/termo encontrado:\/\.test\(t\)/, "candidata_nao_grounded deveria excluir explicitamente o caso já coberto por questao_absoluto, para não duplicar feedback");
  // Nenhuma entrada da lista aprova/ignora — todas têm feedback (retry), nenhuma tem "aprovado"/"bypass".
  assert.ok(!/aprovado|bypass|ignorar/i.test(bloco), "nenhuma categoria corrigível deveria mencionar aprovação/bypass automático");
});

// ════════════════════════════════════════════════════════════════════════
// PARTE B — VALIDAÇÃO DE CARDINALIDADE
// ════════════════════════════════════════════════════════════════════════

// Harness que executa o `tentar()` REAL extraído de executarGeracaoSA, com
// validarLoteSA/avaliarRiscoClinico stubados (só para saber SE o código
// chegou até eles — não reimplementa a validação clínica em si).
function rodarTentar({ esperado, respostaParsed }) {
  const tentarSrc = extrair(/const tentar = async \(modelo, prompt, numero\) => \{[\s\S]*?\n {2}\};/, "tentar()");
  const runner = new Function(
    "esperado", "abcd", "grounding", "groundingTexto", "systemPrompt", "chamarIABruto", "validarLoteSA", "avaliarRiscoClinico",
    `
    return (async () => {
      const tentativas = [];
      ${tentarSrc}
      const resultado = await tentar("modelo-teste", "prompt-teste", 1);
      return { resultado, tentativas };
    })();
    `
  );
  const validarLoteSAStub = (parsed) => ({
    validas: parsed.map((p, i) => ({ marker: "STUB_VALIDA", i })),
    rejeitadas: [],
  });
  const chamarIABrutoStub = async () => ({ parsed: respostaParsed, usage: null });
  return runner(esperado, true, false, "", "sys", chamarIABrutoStub, validarLoteSAStub, () => false);
}

await teste("9. esperado 1, recebido 1 → segue normalmente (chega em validarLoteSA)", async () => {
  const { resultado } = await rodarTentar({ esperado: 1, respostaParsed: [{ id: 1 }] });
  assert.equal(resultado.validas.length, 1, "deveria ter passado pela validação clínica (stub) e retornado 1 válida");
  assert.equal(resultado.validas[0].marker, "STUB_VALIDA", "confirma que chegou ao validarLoteSA, não ao early-return de cardinalidade");
});

await teste("10. esperado 1, recebido 2 → rejeição de protocolo (não chega em validarLoteSA)", async () => {
  const { resultado, tentativas } = await rodarTentar({ esperado: 1, respostaParsed: [{ id: 1 }, { id: 2 }] });
  assert.equal(resultado.validas.length, 0, "nenhuma candidata deveria ser considerada válida");
  assert.equal(resultado.rejeitadas.length, 1, "deveria haver exatamente 1 rejeição sintética de protocolo, não 2 candidatas avaliadas individualmente");
  assert.equal(resultado.rejeitadas[0].questao, null, "não deveria expor nenhum dos objetos parciais como questão");
  assert.match(resultado.rejeitadas[0].motivos[0], /erro de protocolo: esperado 1 questão\(ões\), recebido 2/);
  assert.equal(tentativas[0].validas, 0);
});

await teste("11. esperado 1, recebido 0 → rejeição de protocolo", async () => {
  const { resultado } = await rodarTentar({ esperado: 1, respostaParsed: [] });
  assert.equal(resultado.validas.length, 0);
  assert.match(resultado.rejeitadas[0].motivos[0], /erro de protocolo: esperado 1 questão\(ões\), recebido 0/);
});

await teste("12. esperado 3, recebido 3 → segue normalmente", async () => {
  const { resultado } = await rodarTentar({ esperado: 3, respostaParsed: [{ id: 1 }, { id: 2 }, { id: 3 }] });
  assert.equal(resultado.validas.length, 3, "deveria ter passado pela validação clínica (stub) com as 3 candidatas");
});

await teste("13. esperado 3, recebido 1 → rejeição de protocolo", async () => {
  const { resultado } = await rodarTentar({ esperado: 3, respostaParsed: [{ id: 1 }] });
  assert.equal(resultado.validas.length, 0);
  assert.match(resultado.rejeitadas[0].motivos[0], /erro de protocolo: esperado 3 questão\(ões\), recebido 1/);
});

await teste("14. Nenhuma candidata excedente é validada ou salva (array de 2 nunca chega em validarLoteSA)", async () => {
  let validarLoteSAChamado = false;
  const tentarSrc = extrair(/const tentar = async \(modelo, prompt, numero\) => \{[\s\S]*?\n {2}\};/, "tentar()");
  const runner = new Function(
    "esperado", "abcd", "grounding", "groundingTexto", "systemPrompt", "chamarIABruto", "validarLoteSA", "avaliarRiscoClinico",
    `
    return (async () => {
      const tentativas = [];
      ${tentarSrc}
      return await tentar("modelo-teste", "prompt-teste", 1);
    })();
    `
  );
  const validarLoteSAEspiao = () => { validarLoteSAChamado = true; return { validas: [], rejeitadas: [] }; };
  await runner(1, true, false, "", "sys", async () => ({ parsed: [{ id: 1 }, { id: 2 }], usage: null }), validarLoteSAEspiao, () => false);
  assert.equal(validarLoteSAChamado, false, "validarLoteSA NUNCA deveria ser chamado quando a cardinalidade não bate — nenhuma candidata (nem a 1ª) é avaliada individualmente");
});

await teste("15. Erro de cardinalidade participa do fluxo normal de retry (mesmo shape que qualquer outra rejeição)", () => {
  const bloco = extrair(/if \(typeof esperado === "number"[\s\S]*?\n {6}\}/, "checagem de cardinalidade");
  assert.match(bloco, /return \{ validas: \[\], rejeitadas: \[\{ questao: null, motivos: \[motivoCardinalidade\] \}\], altoRisco: false, erro: null \}/, "o retorno deve ter exatamente o mesmo formato {validas, rejeitadas, altoRisco, erro} usado pelo resto de tentar() — participa do mesmo r1/r2/r3 sem código novo na árvore de decisão");
  const categorias = extrair(/const _CATEGORIAS_CORRIGIVEIS_SA = \[[\s\S]*?\];/, "_CATEGORIAS_CORRIGIVEIS_SA");
  assert.match(categorias, /tipo: "erro_cardinalidade"/, "erro de cardinalidade deveria ter categoria própria no classificador de retry");
});

await teste("16. Teto de tentativas (3 por execução) não foi alterado pelo hardening", () => {
  const fnCompleta = extrair(/export const executarGeracaoSA = async[\s\S]*?\n\};/, "executarGeracaoSA");
  // 5 SITES de chamada existem no código (ramo altoRisco some com Opus em 2
  // pontos alternativos), mas no máximo 3 executam por corrida real — este
  // número (5 sites) é a assinatura estrutural da árvore ANTES do hardening;
  // se o hardening tivesse acrescentado uma tentativa extra, esse número mudaria.
  const invocacoes = (fnCompleta.match(/\btentar\(/g) || []).length;
  assert.equal(invocacoes, 5, "o hardening não deveria ter alterado a árvore de decisão de retry — mesmo número de sites de chamada de antes");
});

// ── Wiring: RoboGerador.jsx passa esperado=questoesPorTemaAtual (fonte real, não regex do prompt) ──
await teste("Wiring: RoboGerador.jsx repassa questoesPorTemaAtual como `esperado`, não reinfere por texto", () => {
  assert.match(roboSrc, /esperado:\s*questoesPorTemaAtual,/, "RoboGerador.jsx deveria passar a mesma variável já usada para montar o prompt, não uma nova inferência");
});

console.log(`\n${passou}/${passou + falhas.length} testes passaram.`);
if (falhas.length > 0) {
  console.log("\nFalhas:");
  falhas.forEach((f) => console.log(`  - ${f.nome}: ${f.erro}`));
  process.exit(1);
}
