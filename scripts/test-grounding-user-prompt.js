// ─── TESTES — GROUNDING EXPLÍCITO NO USER PROMPT (construirPromptTemaSA) ────
// Mesmo padrão dos demais scripts desta família (Node puro, zero rede real,
// zero Firebase, zero IA). RoboGerador.jsx importa React/Firebase no topo —
// nunca importado ao vivo aqui. construirPromptTemaSA é extraída do
// CÓDIGO-FONTE REAL via regex e executada via `new Function` (mesma técnica
// já homologada em test-piloto-controlado-dev.js), com os 4 parâmetros reais
// — não uma reimplementação manual da lógica. diretrizesControladas.js não
// importa Firebase/React (módulo de config puro) — montarBlocoDiretriz e uma
// diretriz real de DIRETRIZES_CONTROLADAS são importados ao vivo para montar
// um blocoDir realista no cenário "com grounding".
//
// Achado real que motivou este arquivo: R092 (Aleitamento materno), 2ª
// rejeição pós-hardening de SA-4 — o modelo preencheu ano_diretriz/
// fonte_diretriz mesmo sem diretriz controlada, citando anos dentro do
// intervalo "2023–2025" da linha (agora removida/condicionada) "Diretrizes
// atualizadas 2023–2025" do user prompt de construirPromptTemaSA. Diagnóstico
// completo: ausência silenciosa do bloco de grounding (sem marcador
// explícito) + linha incondicional sugerindo um intervalo de anos.
//
//   node scripts/test-grounding-user-prompt.js

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { montarBlocoDiretriz, DIRETRIZES_CONTROLADAS } from "../src/config/diretrizesControladas.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _raiz = path.resolve(__dirname, "..");
const roboSrc = fs.readFileSync(path.join(_raiz, "src/components/RoboGerador.jsx"), "utf8");

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

// Extrai construirPromptTemaSA do arquivo-fonte REAL (mesma regex já
// homologada em test-piloto-controlado-dev.js:59) e a executa via
// new Function — prova comportamento real, não presença textual.
function extrairConstruirPromptTemaSA(src) {
  const re = /const construirPromptTemaSA = \(tema, areaAtual, questoesPorTema, blocoDir\) => \{[\s\S]*?\n\};/;
  const m = src.match(re);
  assert.ok(m, "construirPromptTemaSA não encontrada no código-fonte");
  return m[0];
}

function instanciarConstruirPromptTemaSA(blocoBruto) {
  const corpo = blocoBruto
    .replace(/^const construirPromptTemaSA = \(tema, areaAtual, questoesPorTema, blocoDir\) => /, "")
    .replace(/;\s*$/, "");
  return new Function("tema", "areaAtual", "questoesPorTema", "blocoDir", corpo);
}

const construirPromptTemaSA = instanciarConstruirPromptTemaSA(extrairConstruirPromptTemaSA(roboSrc));

// Diretriz real (HAS, 1ª entrada de DIRETRIZES_CONTROLADAS) para o cenário
// "com grounding" — mesmo dado que o fluxo normal usaria para este tema.
const diretrizReal = DIRETRIZES_CONTROLADAS[0];
const blocoDirReal = montarBlocoDiretriz(diretrizReal);

// ════════════════════════════════════════════════════════════════════════
// SEM DIRETRIZ CONTROLADA
// ════════════════════════════════════════════════════════════════════════

teste("1. blocoDir=\"\" — prompt contém marcador explícito de ausência (━━━ DIRETRIZ CONTROLADA — AUSENTE)", () => {
  const texto = construirPromptTemaSA("Aleitamento materno: Fissura, ingurgitamento", "Pediatria", 1, "");
  assert.match(texto, /DIRETRIZ CONTROLADA — AUSENTE NESTA GERAÇÃO/);
});

teste("2. blocoDir ausente (chamada com 3 argumentos) — mesmo marcador de ausência", () => {
  const texto = construirPromptTemaSA("Aleitamento materno: Fissura, ingurgitamento", "Pediatria", 1);
  assert.match(texto, /DIRETRIZ CONTROLADA — AUSENTE NESTA GERAÇÃO/);
});

teste("3. blocoDir só espaços (\"   \") — tratado como ausência, não como grounding real", () => {
  const texto = construirPromptTemaSA("Aleitamento materno: Fissura, ingurgitamento", "Pediatria", 1, "   ");
  assert.match(texto, /DIRETRIZ CONTROLADA — AUSENTE NESTA GERAÇÃO/);
});

teste("4. prompt (sem grounding) contém marcador explícito de ausência (repetido — via texto completo, não só regex solta)", () => {
  const texto = construirPromptTemaSA("Tema qualquer", "Clínica Médica", 1, "");
  assert.ok(texto.includes("Não há bloco de diretriz controlada verificado para este tema."));
});

teste("5. prompt (sem grounding) exige ano_diretriz null", () => {
  const texto = construirPromptTemaSA("Tema qualquer", "Clínica Médica", 1, "");
  assert.match(texto, /OBRIGATÓRIO preencher:\s*"ano_diretriz":\s*null/);
});

teste('6. prompt (sem grounding) exige fonte_diretriz ""', () => {
  const texto = construirPromptTemaSA("Tema qualquer", "Clínica Médica", 1, "");
  assert.match(texto, /OBRIGATÓRIO preencher:\s*"fonte_diretriz":\s*""/);
});

teste("7. prompt (sem grounding) proíbe inventar fonte", () => {
  const texto = construirPromptTemaSA("Tema qualquer", "Clínica Médica", 1, "");
  assert.match(texto, /PROIBIDO citar, inventar ou inferir fonte/);
});

teste("8. prompt (sem grounding) proíbe inventar ano", () => {
  const texto = construirPromptTemaSA("Tema qualquer", "Clínica Médica", 1, "");
  assert.match(texto, /PROIBIDO citar, inventar ou inferir fonte, sociedade, órgão, documento, diretriz, guideline ou ano/);
});

teste('9. prompt (sem grounding) NÃO contém "Diretrizes atualizadas 2023–2025"', () => {
  const texto = construirPromptTemaSA("Tema qualquer", "Clínica Médica", 1, "");
  assert.doesNotMatch(texto, /Diretrizes atualizadas 2023–2025/);
});

teste("10. prompt (sem grounding) não contém autorização genérica equivalente (nenhuma menção solta a MS/SUS/FEBRASGO/Cadernos fora da proibição)", () => {
  const texto = construirPromptTemaSA("Tema qualquer", "Clínica Médica", 1, "");
  for (const termo of ["FEBRASGO", "Cadernos de Atenção Primária", "MS/SUS", " SBC", " SBPT", " SBEM"]) {
    assert.ok(!texto.includes(termo), `prompt sem grounding não deveria mencionar "${termo}"`);
  }
});

teste("11. prompt (sem grounding) preserva tema e área", () => {
  const texto = construirPromptTemaSA("Aleitamento materno: Fissura, ingurgitamento", "Pediatria", 1, "");
  assert.match(texto, /Área: Pediatria/);
  assert.match(texto, /Tema: Aleitamento materno: Fissura, ingurgitamento/);
});

teste("12. prompt (sem grounding) preserva requisitos clínicos não relacionados (caso clínico realista, distratores, diversidade)", () => {
  const texto = construirPromptTemaSA("Tema qualquer", "Clínica Médica", 1, "");
  assert.match(texto, /Caso clínico realista \(UBS, UPA, emergência ou enfermaria\)/);
  assert.match(texto, /Distratores plausíveis \(pegadinhas de prova, não alternativas óbvias\)/);
  assert.match(texto, /Diversidade: diferentes faixas etárias, gêneros e contextos clínicos/);
});

// ════════════════════════════════════════════════════════════════════════
// COM DIRETRIZ CONTROLADA
// ════════════════════════════════════════════════════════════════════════

teste("13. prompt (com grounding) contém o bloco DIRETRIZ CONTROLADA injetado integralmente", () => {
  const texto = construirPromptTemaSA("Hipertensão arterial sistêmica", "Clínica Médica", 1, blocoDirReal);
  assert.ok(texto.includes(blocoDirReal), "o bloco de grounding real deveria aparecer integralmente no prompt final");
  assert.match(texto, /DIRETRIZ CONTROLADA — INJEÇÃO OBRIGATÓRIA/);
  assert.ok(texto.includes(diretrizReal.fonte), "a fonte real da diretriz deveria aparecer no prompt");
});

teste("14. prompt (com grounding) NÃO contém o marcador de ausência", () => {
  const texto = construirPromptTemaSA("Hipertensão arterial sistêmica", "Clínica Médica", 1, blocoDirReal);
  assert.doesNotMatch(texto, /DIRETRIZ CONTROLADA — AUSENTE NESTA GERAÇÃO/);
});

teste("15. prompt (com grounding) não proíbe usar o grounding fornecido (sem a proibição de citar fonte/ano que só vale sem bloco)", () => {
  const texto = construirPromptTemaSA("Hipertensão arterial sistêmica", "Clínica Médica", 1, blocoDirReal);
  assert.doesNotMatch(texto, /PROIBIDO citar, inventar ou inferir fonte/);
});

teste("16. prompt (com grounding) não autoriza complementar fonte/ano além do bloco — subordina explicitamente ao bloco injetado", () => {
  const texto = construirPromptTemaSA("Hipertensão arterial sistêmica", "Clínica Médica", 1, blocoDirReal);
  assert.match(texto, /use exclusivamente a DIRETRIZ CONTROLADA injetada acima/);
  assert.match(texto, /não complemente nem substitua por outra fonte ou ano do seu conhecimento/);
});

teste("17. prompt (com grounding) preserva tema e área", () => {
  const texto = construirPromptTemaSA("Hipertensão arterial sistêmica", "Clínica Médica", 1, blocoDirReal);
  assert.match(texto, /Área: Clínica Médica/);
  assert.match(texto, /Tema: Hipertensão arterial sistêmica/);
});

teste("18. prompt (com grounding) preserva requisitos gerais não conflitantes (caso clínico, distratores, diversidade)", () => {
  const texto = construirPromptTemaSA("Hipertensão arterial sistêmica", "Clínica Médica", 1, blocoDirReal);
  assert.match(texto, /Caso clínico realista \(UBS, UPA, emergência ou enfermaria\)/);
  assert.match(texto, /Distratores plausíveis \(pegadinhas de prova, não alternativas óbvias\)/);
  assert.match(texto, /Diversidade: diferentes faixas etárias, gêneros e contextos clínicos/);
});

// ════════════════════════════════════════════════════════════════════════
// INTEGRAÇÃO/REGRESSÃO
// ════════════════════════════════════════════════════════════════════════

teste("19. o piloto controlado DEV chama construirPromptTemaSA (mesma função ora corrigida)", () => {
  assert.match(roboSrc, /const executarPilotoControladoDEV = async \(\) => \{[\s\S]*?construirPromptTemaSA\(tema, area, 1, blocoDir\)[\s\S]*?\n  \};/);
});

teste("20. iniciarRobo (robô normal ABCD) chama construirPromptTemaSA (mesma função ora corrigida)", () => {
  assert.match(roboSrc, /construirPromptTemaSA\(tema, areaAtual, questoesPorTemaAtual, blocoDir\)/);
});

// 21. Prova de não-vacuidade: as mesmas asserções, rodadas contra a versão de
// construirPromptTemaSA do commit a8aedb1 (baseline ANTES desta correção,
// obtida via `git show`, 100% read-only — não altera working tree nem HEAD),
// devem falhar pelo motivo correto. Não participa da contagem passou/falhas
// desta suíte (é uma checagem sobre código HISTÓRICO, não sobre o atual).
console.log("");
console.log("── Prova de não-vacuidade contra o baseline a8aedb1 (git show, read-only) ──");
try {
  const roboSrcBaseline = execFileSync(
    "git",
    ["show", "a8aedb1824054bdd968f1e6056475109cf857deb:src/components/RoboGerador.jsx"],
    { cwd: _raiz, encoding: "utf8" }
  );
  const construirPromptTemaSABaseline = instanciarConstruirPromptTemaSA(extrairConstruirPromptTemaSA(roboSrcBaseline));
  const textoBaseline = construirPromptTemaSABaseline("Aleitamento materno: Fissura, ingurgitamento", "Pediatria", 1, "");

  let falhouComoEsperado = 0;
  const checagens = [
    ["continha 'Diretrizes atualizadas 2023–2025' (linha causadora real)", /Diretrizes atualizadas 2023–2025/.test(textoBaseline)],
    ["NÃO continha marcador de ausência", !/DIRETRIZ CONTROLADA — AUSENTE NESTA GERAÇÃO/.test(textoBaseline)],
    ["NÃO exigia ano_diretriz null explicitamente", !/"ano_diretriz":\s*null/.test(textoBaseline)],
  ];
  for (const [rotulo, condicaoBaseline] of checagens) {
    if (condicaoBaseline) {
      falhouComoEsperado++;
      console.log(`✅ (esperado no baseline) ${rotulo}`);
    } else {
      console.log(`❌ (inesperado) baseline não confirmou: ${rotulo}`);
    }
  }
  assert.equal(falhouComoEsperado, checagens.length, "o baseline a8aedb1 deveria reproduzir exatamente o defeito diagnosticado — suíte não é vácua");
  console.log("21. CONFIRMADO: os testes 1/5/9 desta suíte teriam falhado no baseline a8aedb1 pelo motivo correto.");
} catch (e) {
  console.log(`❌ 21. não foi possível provar a não-vacuidade contra o baseline: ${e.message}`);
  falhas.push({ nome: "21. prova de não-vacuidade contra baseline a8aedb1", erro: e.message });
}
console.log("");

teste("22. depois da correção, construirPromptTemaSA atual passa em todas as asserções acima (suíte completa já demonstra isso)", () => {
  assert.equal(falhas.filter((f) => !f.nome.startsWith("21.")).length, 0, "alguma asserção sobre o código ATUAL falhou acima — correção incompleta");
});

// 23-26 (segurança offline): confirmado por leitura manual, não por checagem
// automática — este script só importa node:assert, node:fs, node:path,
// node:child_process (exclusivamente para `git show`, comando local),
// node:url e os dois módulos de config puros (diretrizesControladas.js, sem
// nenhum import de Firebase/React). Nenhuma chamada de rede, IA, Firebase ou
// escrita em arquivo existe neste script — ver relatório final.

console.log(`\n${passou}/${passou + falhas.length} testes passaram.`);
if (falhas.length > 0) {
  console.log("\nFalhas:");
  falhas.forEach((f) => console.log(`  - ${f.nome}: ${f.erro}`));
  process.exit(1);
}
