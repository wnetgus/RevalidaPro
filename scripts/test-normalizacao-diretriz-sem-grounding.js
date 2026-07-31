// ─── TESTES — NORMALIZAÇÃO DETERMINÍSTICA DE FONTE/ANO SEM GROUNDING (SA-4) ──
// Mesmo padrão dos demais scripts desta família (Node puro, zero rede real,
// zero Firebase, zero IA). promptEngine.js importa ../firebase e ./apiAuth no
// topo (quebram em Node puro fora do Vite) — este arquivo carrega o MÓDULO
// INTEIRO real (não uma reimplementação nem regex de um trecho isolado):
// lê o código-fonte, substitui só as 2 linhas de import por consts inertes e
// a única ocorrência de `import.meta.env...` (sintaxe inválida fora de ESM
// para `new Function`) por `undefined`, remove a palavra "export" (torna os
// `const`/`function` top-level acessíveis no escopo de retorno), e executa
// via `new Function`. Resultado: validarLoteSA e _normalizarDiretrizSemGrounding
// REAIS, com todos os ~10 helpers privados internos dos quais dependem,
// rodando de verdade — validado por dry-run antes deste arquivo existir.
//
// Achado real que motivou este arquivo: R092 (Aleitamento materno), 3
// execuções reais, 2 rodadas de hardening TEXTUAL do prompt — o modelo
// continuou preenchendo ano_diretriz/fonte_diretriz sem diretriz controlada
// injetada apesar de tudo. Decisão: parar de insistir em prosa e normalizar
// deterministicamente esses 2 campos estruturados antes da validação,
// centralizado dentro do próprio validarLoteSA (cobre piloto E robô normal
// ABCD, únicos 2 chamadores reais, sem duplicar lógica em RoboGerador.jsx).
//
//   node scripts/test-normalizacao-diretriz-sem-grounding.js

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _raiz = path.resolve(__dirname, "..");
const promptEngineSrc = fs.readFileSync(path.join(_raiz, "src/utils/promptEngine.js"), "utf8");
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

// ── Carrega o módulo real inteiro (não uma cópia manual da lógica) ─────────
function carregarModuloReal() {
  let src = promptEngineSrc;
  const marcaImportFirebase = 'import { auth, obterTokenAppCheck } from "../firebase";';
  const marcaImportApiAuth = 'import { obterHeadersAutenticados } from "./apiAuth";';
  assert.ok(src.includes(marcaImportFirebase), "import de ../firebase não encontrado — arquivo-fonte mudou de forma inesperada");
  assert.ok(src.includes(marcaImportApiAuth), "import de ./apiAuth não encontrado — arquivo-fonte mudou de forma inesperada");
  src = src.replace(marcaImportFirebase, 'const auth = null; const obterTokenAppCheck = async () => "";');
  src = src.replace(marcaImportApiAuth, 'const obterHeadersAutenticados = async () => ({});');
  src = src.replace(/import\.meta\.env\.VITE_FUNCTIONS_BASE_URL/g, "undefined");
  src = src.replace(/^export\s+/gm, "");
  return new Function(`${src}\nreturn { validarLoteSA, _normalizarDiretrizSemGrounding, MODELO_HAIKU_SA };`)();
}

const { validarLoteSA, _normalizarDiretrizSemGrounding, MODELO_HAIKU_SA } = carregarModuloReal();

// ── Fixture: candidata ABCD válida real (passa em SA-1/SA-2/SA-3/SA-5 tal
// como estão hoje) — verificada por dry-run antes de escrever este arquivo.
// `overrides` permite variar só o que cada teste precisa, sem duplicar todo
// o objeto por cenário.
function candidataValida(overrides = {}) {
  const base = {
    materia: "Pediatria",
    tema_mestre: "Aleitamento materno",
    subtema: "Fissura e ingurgitamento mamário",
    banca: "Revalida INEP",
    ano: "2025",
    numeroQuestao: 92,
    enunciado:
      "Mulher, 32 anos, primípara, é atendida em Unidade Básica de Saúde com queixa de dor na mama direita há 3 dias, iniciada 10 dias após o parto vaginal, associada a fissura mamilar e dificuldade para posicionar a criança durante as mamadas. Refere que o recém-nascido apresenta pega superficial e mordida frequente do mamilo. Ao exame físico, mama direita com área endurecida, hiperemiada e dolorosa à palpação em quadrante superior externo, sem flutuação. Temperatura axilar 36,8 graus. Nega calafrios, mal-estar ou secreção purulenta pela papila. Amamenta em livre demanda desde o nascimento. Qual é a conduta mais adequada para esta paciente neste momento?",
    imagemUrl: "",
    alts: {
      a: { texto: "Orientar correção da pega e ordenha manual antes das mamadas.", nota: "CORRETA. A correção da pega e o esvaziamento parcial da mama antes de amamentar reduzem a fissura e o ingurgitamento; a criança deve iniciar a mamada pela mama menos dolorida." },
      b: { texto: "Suspender temporariamente a amamentação direta na mama afetada.", nota: "TRATAMENTO INCOMPLETO: suspender a mamada pode piorar o ingurgitamento e não corrige a causa (pega inadequada)." },
      c: { texto: "Iniciar antibioticoterapia empírica para prevenir infecção mamária.", nota: "EXCESSO DE INTERVENÇÃO: sem sinais de infecção (febre, secreção purulenta), antibiótico não é indicado neste momento." },
      d: { texto: "Encaminhar para avaliação cirúrgica da região mamária afetada.", nota: "CONDUTA INSUFICIENTE: sem sinais de abscesso ou flutuação, encaminhamento cirúrgico não é a conduta inicial." },
    },
    gabarito: "a",
    raciocinio: "PADRÃO: fissura mamilar e ingurgitamento após pega inadequada → DIFERENCIAL: mastite infecciosa excluída pela ausência de febre e secreção → DECISÃO: corrigir a pega e orientar ordenha antes da mamada → ARMADILHA: suspender a amamentação em vez de corrigir a técnica.",
    tto: "PASSO 1 — Avaliação da pega\nObservar posicionamento da criança e técnica de sucção durante a mamada.\nPASSO 2 — Orientação e ordenha\nCorrigir a pega e orientar ordenha manual parcial antes das mamadas para aliviar o ingurgitamento.",
    dicaMestre: "Pega errada dói, pega certa cura ↓ dor localizada sem febre nem secreção ↓ corrigir a pega e ordenhar antes de mamar ↓ suspender a amamentação por medo da dor",
    estrategiaAposta: "tema recorrente em provas de pediatria/APS ↓ pode vir como caso de puerpério com queixa mamária ↓ candidato tende a indicar antibiótico ou suspensão sem necessidade",
    probabilidade_prova: "MEDIO",
    probabilidade_justificativa: "Tema recorrente em puericultura e puerpério nas provas de Revalida.",
    ano_diretriz: null,
    fonte_diretriz: "",
  };
  return { ...base, ...overrides };
}

const blocoControladoTeste =
  '\n━━━ DIRETRIZ CONTROLADA — INJEÇÃO OBRIGATÓRIA ━━━\nTEMA SENSÍVEL DETECTADO: Aleitamento materno\nFONTE OFICIAL VIGENTE: MS/PNAB 2024\nANO DE REFERÊNCIA: 2024\n\nPONTOS CRÍTICOS OBRIGATÓRIOS (use exatamente estes critérios na questão):\n• corrigir a pega antes de medicar\n\nREGRAS ESTRITAS PARA ESTA QUESTÃO:\n✗ PROIBIDO usar classificação, critério diagnóstico ou conduta anterior a 2024\n✗ PROIBIDO misturar critérios de diretrizes diferentes\n✗ PROIBIDO usar conduta obsoleta sem aviso explícito de "protocolo antigo — revisar"\n✓ OBRIGATÓRIO preencher: "fonte_diretriz": "MS/PNAB 2024"\n✓ OBRIGATÓRIO preencher: "ano_diretriz": 2024\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';

// ════════════════════════════════════════════════════════════════════════
// 1. SEM GROUNDING + ano/fonte fabricados → normalizados, não rejeitados só por isso
// ════════════════════════════════════════════════════════════════════════
teste("1. sem grounding + ano/fonte fabricados (2015/fonte inventada): normalizados para null/\"\", candidata continua válida", () => {
  const q = candidataValida({ ano_diretriz: 2015, fonte_diretriz: "MS/SUS — Cadernos de Atenção Primária: Aleitamento Materno" });
  const { validas, rejeitadas } = validarLoteSA([q], { abcd: true, grounding: false, groundingTexto: "" });
  assert.equal(rejeitadas.length, 0, `não deveria rejeitar: ${JSON.stringify(rejeitadas[0]?.motivos)}`);
  assert.equal(validas.length, 1);
  assert.equal(validas[0].ano_diretriz, null, "ano_diretriz deveria ter sido normalizado para null");
  assert.equal(validas[0].fonte_diretriz, "", 'fonte_diretriz deveria ter sido normalizado para ""');
});

// ════════════════════════════════════════════════════════════════════════
// 2. SEM GROUNDING + candidata válida fora desses campos → permanece válida
// ════════════════════════════════════════════════════════════════════════
teste("2. sem grounding + candidata já correta (ano/fonte já null/\"\"): continua válida, sem efeito colateral", () => {
  const q = candidataValida();
  const { validas, rejeitadas } = validarLoteSA([q], { abcd: true, grounding: false, groundingTexto: "" });
  assert.equal(rejeitadas.length, 0);
  assert.equal(validas.length, 1);
  assert.equal(validas[0].ano_diretriz, null);
  assert.equal(validas[0].fonte_diretriz, "");
});

// ════════════════════════════════════════════════════════════════════════
// 3. SEM GROUNDING + ano/fonte fabricados + problema SA-1 → normaliza, mas SA-1 continua rejeitando
// ════════════════════════════════════════════════════════════════════════
teste("3. sem grounding + ano/fonte fabricados + alternativa correta destacada (SA-1): campos normalizados, mas SA-1 continua rejeitando", () => {
  const q = candidataValida({
    ano_diretriz: 2015,
    fonte_diretriz: "Fonte inventada",
    alts: {
      a: {
        texto: "Orientar correção da pega, realizar ordenha manual antes das mamadas, reavaliar em 48 horas e orientar sinais de alarme para mastite.",
        nota: "CORRETA. A correção da pega e o esvaziamento parcial da mama antes de amamentar reduzem a fissura e o ingurgitamento; a criança deve iniciar a mamada pela mama menos dolorida.",
      },
      b: { texto: "Suspender a amamentação nesta mama.", nota: "TRATAMENTO INCOMPLETO: suspender a mamada pode piorar o ingurgitamento." },
      c: { texto: "Iniciar antibiótico por via oral.", nota: "EXCESSO DE INTERVENÇÃO: sem sinais de infecção, antibiótico não é indicado." },
      d: { texto: "Encaminhar para avaliação cirúrgica.", nota: "CONDUTA INSUFICIENTE: sem sinais de abscesso, cirurgia não é a conduta inicial." },
    },
  });
  const { validas, rejeitadas } = validarLoteSA([q], { abcd: true, grounding: false, groundingTexto: "" });
  assert.equal(validas.length, 0, "deveria continuar rejeitada (SA-1)");
  assert.equal(rejeitadas.length, 1);
  const motivos = rejeitadas[0].motivos.join(" | ");
  assert.match(motivos, /se destaca formalmente dos distratores/, "deveria rejeitar por anti-pista (SA-1), não pelo ano/fonte");
  assert.doesNotMatch(motivos, /ano_diretriz.*fonte_diretriz.*preenchido/, "não deveria mais rejeitar pelo motivo antigo de ano/fonte preenchido");
});

// ════════════════════════════════════════════════════════════════════════
// 4. SEM GROUNDING + ano/fonte fabricados + "80%" → normaliza, mas SA-4 (percentual) continua rejeitando
// ════════════════════════════════════════════════════════════════════════
teste('4. sem grounding + ano/fonte fabricados + percentual "80%" sem fonte: campos normalizados, mas SA-4 (percentual) continua rejeitando', () => {
  const q = candidataValida({
    ano_diretriz: 2015,
    fonte_diretriz: "Fonte inventada",
    raciocinio:
      "PADRÃO: fissura mamilar após pega inadequada → DIFERENCIAL: mastite infecciosa excluída pela ausência de febre → DECISÃO: a correção da técnica de pega resolve 80% dos casos em 48 horas → ARMADILHA: suspender a amamentação.",
  });
  const { validas, rejeitadas } = validarLoteSA([q], { abcd: true, grounding: false, groundingTexto: "" });
  assert.equal(validas.length, 0, "deveria continuar rejeitada (SA-4, percentual)");
  assert.equal(rejeitadas.length, 1);
  const motivos = rejeitadas[0].motivos.join(" | ");
  assert.match(motivos, /termo encontrado: "80%"/, "deveria rejeitar pelo percentual sem fonte");
  assert.doesNotMatch(motivos, /ano_diretriz.*fonte_diretriz.*preenchido/, "não deveria mais rejeitar pelo motivo antigo de ano/fonte preenchido");
});

// ════════════════════════════════════════════════════════════════════════
// 5. COM GROUNDING + ano/fonte compatíveis → preservados, válida
// ════════════════════════════════════════════════════════════════════════
teste("5. com grounding + ano/fonte compatíveis com o bloco injetado: preservados, candidata válida", () => {
  const q = candidataValida({ ano_diretriz: 2024, fonte_diretriz: "MS/PNAB 2024" });
  const { validas, rejeitadas } = validarLoteSA([q], { abcd: true, grounding: true, groundingTexto: blocoControladoTeste });
  assert.equal(rejeitadas.length, 0, `não deveria rejeitar: ${JSON.stringify(rejeitadas[0]?.motivos)}`);
  assert.equal(validas.length, 1);
  assert.equal(validas[0].ano_diretriz, 2024, "com grounding, ano_diretriz NÃO deveria ser normalizado/apagado");
  assert.equal(validas[0].fonte_diretriz, "MS/PNAB 2024", "com grounding, fonte_diretriz NÃO deveria ser normalizada/apagada");
});

// ════════════════════════════════════════════════════════════════════════
// 6. COM GROUNDING + valores incompatíveis → comportamento pré-existente preservado (nenhuma checagem de compatibilidade hoje)
// ════════════════════════════════════════════════════════════════════════
teste("6. com grounding + ano/fonte incompatíveis com o bloco: normalização não interfere (comportamento pré-existente, sem checagem de compatibilidade hoje)", () => {
  const q = candidataValida({ ano_diretriz: 1999, fonte_diretriz: "Fonte completamente diferente do bloco" });
  const r = _normalizarDiretrizSemGrounding(q, true);
  assert.equal(r, q, "com grounding, a normalização deveria ser um passthrough (mesma referência, nada tocado)");
  assert.equal(r.ano_diretriz, 1999);
  assert.equal(r.fonte_diretriz, "Fonte completamente diferente do bloco");
});

// ════════════════════════════════════════════════════════════════════════
// 7. Ausência dos campos → normalização produz defaults corretos sem erro
// ════════════════════════════════════════════════════════════════════════
teste("7. ano_diretriz/fonte_diretriz ausentes (undefined) sem grounding: normalização não lança erro e resulta em null/\"\"", () => {
  const q = candidataValida();
  delete q.ano_diretriz;
  delete q.fonte_diretriz;
  const { validas, rejeitadas } = validarLoteSA([q], { abcd: true, grounding: false, groundingTexto: "" });
  assert.equal(rejeitadas.length, 0, `não deveria rejeitar: ${JSON.stringify(rejeitadas[0]?.motivos)}`);
  assert.equal(validas[0].ano_diretriz, null);
  assert.equal(validas[0].fonte_diretriz, "");
});

teste("7b. _normalizarDiretrizSemGrounding isolada não lança erro com q undefined/vazio", () => {
  assert.doesNotThrow(() => _normalizarDiretrizSemGrounding({}, false));
  assert.doesNotThrow(() => _normalizarDiretrizSemGrounding(undefined, false));
});

// ════════════════════════════════════════════════════════════════════════
// 8. Imutabilidade — objeto original (qOriginal) não é modificado
// ════════════════════════════════════════════════════════════════════════
teste("8. imutabilidade: o objeto original passado a validarLoteSA não é modificado (cópia, não mutação)", () => {
  const original = candidataValida({ ano_diretriz: 2015, fonte_diretriz: "Fonte inventada" });
  const snapshotAntes = JSON.stringify(original);
  validarLoteSA([original], { abcd: true, grounding: false, groundingTexto: "" });
  assert.equal(JSON.stringify(original), snapshotAntes, "o objeto original não deveria ter sido alterado por validarLoteSA");
  assert.equal(original.ano_diretriz, 2015, "campo do objeto original deveria continuar com o valor fabricado (só a CÓPIA é normalizada)");
});

teste("8b. _normalizarDiretrizSemGrounding isolada: quando normaliza, retorna objeto NOVO (não a mesma referência)", () => {
  const q = { ano_diretriz: 2015, fonte_diretriz: "X" };
  const r = _normalizarDiretrizSemGrounding(q, false);
  assert.notEqual(r, q, "deveria retornar uma cópia nova quando há algo para normalizar, não a mesma referência");
  assert.equal(q.ano_diretriz, 2015, "objeto original passado à função isolada não deveria ser mutado");
});

// ════════════════════════════════════════════════════════════════════════
// 9. Cobertura do caminho real — objeto elegível à persistência é o normalizado
// ════════════════════════════════════════════════════════════════════════
teste("9. o objeto em validas[0] (elegível à persistência) É o normalizado, não o original fabricado", () => {
  const q = candidataValida({ ano_diretriz: 2015, fonte_diretriz: "Fonte inventada" });
  const { validas } = validarLoteSA([q], { abcd: true, grounding: false, groundingTexto: "" });
  assert.equal(validas.length, 1);
  assert.equal(validas[0].ano_diretriz, null);
  assert.equal(validas[0].fonte_diretriz, "");
  assert.equal(validas[0].enunciado, q.enunciado, "demais campos da candidata continuam intactos, só ano/fonte foram normalizados");
});

// ── Sinal diagnóstico interno (item 6 da missão) ────────────────────────────
teste("10. sinal diagnóstico interno (_diagnosticoGroundingSA4) presente quando algo foi normalizado, ausente quando não havia nada a normalizar", () => {
  const comFabricacao = _normalizarDiretrizSemGrounding({ ano_diretriz: 2015, fonte_diretriz: "X" }, false);
  assert.ok(comFabricacao._diagnosticoGroundingSA4, "deveria carregar o sinal diagnóstico quando havia algo para descartar");
  assert.equal(comFabricacao._diagnosticoGroundingSA4.anoDescartado, 2015);
  assert.equal(comFabricacao._diagnosticoGroundingSA4.fonteDescartada, "X");

  const semFabricacao = _normalizarDiretrizSemGrounding({ ano_diretriz: null, fonte_diretriz: "" }, false);
  assert.equal(semFabricacao._diagnosticoGroundingSA4, undefined, "não deveria criar o sinal quando não havia nada para normalizar");
});

teste("11. sinal diagnóstico não pode alcançar o Firestore — salvarQuestoes (RoboGerador.jsx) monta finalData por allowlist nomeado, nunca por spread de `q`", () => {
  const trechoSalvarQuestoes = roboSrc.match(/const salvarQuestoes = useCallback\(async \(lista, edicaoSA, proximoNum, areaAtual, opts = \{\}\) => \{[\s\S]*?\n  \}, \[\]\);/);
  assert.ok(trechoSalvarQuestoes, "salvarQuestoes não encontrada em RoboGerador.jsx");
  assert.doesNotMatch(trechoSalvarQuestoes[0], /\.\.\.q[,\s)]/, "salvarQuestoes não deveria fazer spread de `q` — só allowlist nomeado garante que _diagnosticoGroundingSA4 nunca alcança o Firestore");
});

// ── Preservação: assinatura de validarLoteSA/MODELO_HAIKU_SA inalterada ────
teste("12. validarLoteSA continua aceitando (lista, {abcd, grounding, groundingTexto}) — assinatura preservada", () => {
  assert.doesNotThrow(() => validarLoteSA([], { abcd: true, grounding: false, groundingTexto: "" }));
  assert.doesNotThrow(() => validarLoteSA([]));
});

teste("13. MODELO_HAIKU_SA continua exportado (nenhuma mudança de modelo nesta missão)", () => {
  assert.ok(MODELO_HAIKU_SA, "MODELO_HAIKU_SA deveria continuar exportado e com valor truthy");
});

console.log(`\n${passou}/${passou + falhas.length} testes passaram.`);
if (falhas.length > 0) {
  console.log("\nFalhas:");
  falhas.forEach((f) => console.log(`  - ${f.nome}: ${f.erro}`));
  process.exit(1);
}
