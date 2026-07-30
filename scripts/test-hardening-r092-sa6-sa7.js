// ─── TESTES — HARDENING R092 (SCHEMA + SA-4) + AJUSTES CIRÚRGICOS SA-6/SA-7 ──
// Mesmo padrão dos demais scripts desta família (Node puro, zero rede real,
// zero Firebase, zero IA). promptEngine.js importa ../firebase no topo (que
// acessa import.meta.env.VITE_FIREBASE_*, inexistente em Node puro fora do
// Vite) — este arquivo nunca importa o módulo inteiro ao vivo. Onde a lógica
// é pura, extrai o trecho REAL do código-fonte via regex; o resto é checagem
// estrutural/textual sobre o conteúdo versionado real (mesma técnica já
// usada em test-resumo-sa4-feedback.js e test-questao-retry-hardening.js).
//
// Missão que motivou este arquivo: CHECKPOINT_PILOTO_CONTROLADO_R092_2026_07_30.md
// seção 6 (hardening mínimo pendente) + auditoria pedagógica read-only
// (veredito C — padrão majoritariamente adequado, corrigir lacunas pontuais).
// Escopo: só _SCHEMA_QUESTAO_SA_ABCD, REGRA SA-4 e duas regras novas
// (SA-6 não intervenção legítima, SA-7 cenários ampliados) dentro de
// _REGRAS_SUPERAPOSTAS_2026_2 — nada mais em promptEngine.js foi tocado.
//
//   node scripts/test-hardening-r092-sa6-sa7.js

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
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

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Extrai o trecho entre dois marcadores literais (exclusive do fim) — usado
// para isolar cada REGRA/SA-N sem depender de offsets de linha frágeis.
function extraiEntre(inicio, fim, rotulo) {
  const re = new RegExp(escapeRe(inicio) + "[\\s\\S]*?(?=" + escapeRe(fim) + ")");
  const m = src.match(re);
  assert.ok(m, `${rotulo || inicio} não encontrado no arquivo-fonte`);
  return m[0];
}

const hash = (s) => crypto.createHash("sha256").update(s).digest("hex");

// ════════════════════════════════════════════════════════════════════════
// TRILHA 1 — HARDENING TÉCNICO R092
// ════════════════════════════════════════════════════════════════════════

// 1/2. schema-exemplo com ano_diretriz null e fonte_diretriz vazia.
teste("1/2. _SCHEMA_QUESTAO_SA_ABCD usa ano_diretriz:null e fonte_diretriz:\"\" (não mais valores inventados)", () => {
  const bloco = extraiEntre("const _SCHEMA_QUESTAO_SA_ABCD = `", "`;", "_SCHEMA_QUESTAO_SA_ABCD");
  assert.match(bloco, /"ano_diretriz":null/, 'exemplo do schema deveria conter "ano_diretriz":null');
  assert.match(bloco, /"fonte_diretriz":""/, 'exemplo do schema deveria conter "fonte_diretriz":""');
  assert.doesNotMatch(bloco, /"ano_diretriz":2024/, "exemplo do schema não deveria mais inventar ano_diretriz:2024");
  assert.doesNotMatch(bloco, /"fonte_diretriz":"MS\/SUS 2024"/, "exemplo do schema não deveria mais inventar fonte_diretriz preenchida");
});

// Preservação: o schema continua com exatamente os mesmos campos —
// só os VALORES de ano_diretriz/fonte_diretriz mudaram, nenhum campo novo
// foi criado nem removido.
teste("preservação: _SCHEMA_QUESTAO_SA_ABCD mantém o mesmo conjunto de campos (só o exemplo de ano_diretriz/fonte_diretriz mudou)", () => {
  const bloco = extraiEntre("const _SCHEMA_QUESTAO_SA_ABCD = `", "`;", "_SCHEMA_QUESTAO_SA_ABCD");
  const campos = [...bloco.matchAll(/"([a-zA-Z_]+)":/g)].map((m) => m[1]);
  const esperado = [
    "materia", "tema_mestre", "subtema", "banca", "ano", "numeroQuestao", "enunciado",
    "imagemUrl", "alts",
    "a", "texto", "nota",
    "b", "texto", "nota",
    "c", "texto", "nota",
    "d", "texto", "nota",
    "gabarito", "raciocinio",
    "tto", "dicaMestre", "estrategiaAposta", "probabilidade_prova", "probabilidade_justificativa",
    "ano_diretriz", "fonte_diretriz",
  ];
  assert.deepEqual(campos, esperado, "conjunto/ordem de campos do schema mudou além do previsto");
});

// 3. presença explícita na SA-4 dos 4 termos absolutos.
teste("3. REGRA SA-4 cita explicitamente sempre/nunca/obrigatório/em todos os casos (fora do contexto de citação de diretriz nomeada)", () => {
  const sa4 = extraiEntre("═══ REGRA SA-4 —", "═══ REGRA SA-5 —", "REGRA SA-4");
  assert.match(sa4, /"sempre"/, 'SA-4 deveria citar "sempre"');
  assert.match(sa4, /"nunca"/, 'SA-4 deveria citar "nunca"');
  assert.match(sa4, /"obrigat[óo]ri[ao]/, 'SA-4 deveria citar "obrigatório"/variações');
  assert.match(sa4, /em todos os casos/, 'SA-4 deveria citar "em todos os casos"');
  assert.match(sa4, /em todos os pacientes/, 'SA-4 deveria citar "em todos os pacientes" (mesma cobertura do validador)');
});

// 4. Alinhamento entre os termos citados na SA-4 e os efetivamente bloqueados
// pelo validador (_PADROES_AFIRMACAO_FORTE) — mesma técnica de regressão já
// usada em test-resumo-sa4-feedback.js teste 1, agora comparando com o texto
// do PROMPT (não só com o validador isolado).
teste("4. termos citados na SA-4 continuam alinhados com _PADROES_AFIRMACAO_FORTE (validador)", () => {
  const sa4 = extraiEntre("═══ REGRA SA-4 —", "═══ REGRA SA-5 —", "REGRA SA-4");
  const padroesBloco = extraiEntre("const _PADROES_AFIRMACAO_FORTE = [", "];", "_PADROES_AFIRMACAO_FORTE");
  const termosSa4 = ["patognom", "padr", "ouro", "sempre", "nunca", "obrigat", "em todos os"];
  for (const termo of termosSa4) {
    assert.ok(sa4.toLowerCase().includes(termo), `REGRA SA-4 não cita mais o termo "${termo}" — desalinhamento com o texto original`);
    assert.ok(padroesBloco.includes(termo), `_PADROES_AFIRMACAO_FORTE não cobre mais o termo "${termo}" citado na SA-4 — desalinhamento`);
  }
  // Nenhum padrão novo foi adicionado ao validador nesta missão (só o texto
  // do prompt mudou) — 8 padrões, mesma contagem de antes do hardening.
  const linhasPadroes = padroesBloco.split("\n").filter((l) => l.trim().startsWith("/"));
  assert.equal(linhasPadroes.length, 8, "validarLoteSA não deveria ter sido alterado nesta missão — contagem de padrões mudou");
});

// ════════════════════════════════════════════════════════════════════════
// TRILHA 2 — AJUSTES PEDAGÓGICOS CIRÚRGICOS (SA-6 / SA-7)
// ════════════════════════════════════════════════════════════════════════

// 5/6. Não intervenção como possibilidade legítima + salvaguardas.
teste("5. REGRA SA-6 existe e lista as 7 formas legítimas de não intervenção", () => {
  const sa6 = extraiEntre("═══ REGRA SA-6 —", "═══ REGRA SA-7 —", "REGRA SA-6");
  for (const termo of [
    "observação clínica",
    "orientação",
    "seguimento",
    "conduta expectante",
    "desprescrição",
    "suspensão de uma intervenção",
    "decisão fundamentada de não tratar ou não solicitar",
  ]) {
    assert.ok(sa6.includes(termo), `REGRA SA-6 deveria mencionar "${termo}"`);
  }
});

teste("6a. REGRA SA-6 deixa explícito que é possibilidade, não obrigação (não força geração de questão de não intervenção)", () => {
  const sa6 = extraiEntre("═══ REGRA SA-6 —", "═══ REGRA SA-7 —", "REGRA SA-6");
  assert.match(sa6, /POSSIBILIDADE, não uma obrigação/, "SA-6 deveria declarar explicitamente que é possibilidade e não obrigação");
  assert.match(sa6, /NÃO force uma resposta de não intervenção/i, "SA-6 deveria proibir forçar essa resposta em qualquer tema");
});

teste("6b. REGRA SA-6 proíbe não intervenção diante de sinais de alarme/risco/urgência", () => {
  const sa6 = extraiEntre("═══ REGRA SA-6 —", "═══ REGRA SA-7 —", "REGRA SA-6");
  assert.match(sa6, /sinais de alarme, instabilidade, risco iminente/, "SA-6 deveria proibir não intervenção diante de sinais de alarme");
  assert.match(sa6, /contrariar diretriz vigente, protocolo de urgência ou segurança do paciente/, "SA-6 deveria proibir contrariar diretriz/urgência/segurança para encaixar não intervenção");
});

teste("6c. REGRA SA-6 amarra a alternativa de não intervenção às regras anti-pista da SA-1 (sem virar pista formal)", () => {
  const sa6 = extraiEntre("═══ REGRA SA-6 —", "═══ REGRA SA-7 —", "REGRA SA-6");
  assert.match(sa6, /TODAS as regras da SA-1/, "SA-6 deveria remeter explicitamente às anti-pistas da SA-1 (não duplicar regra)");
});

// 7/8. Cenários ampliados opcionais, sem virar decoração.
teste("7. REGRA SA-7 existe e lista os 9 contextos ampliados de vigilância/território/rede", () => {
  const sa7 = extraiEntre("═══ REGRA SA-7 —", "`;", "REGRA SA-7");
  for (const termo of [
    "comunidade e território adstrito",
    "vigilância epidemiológica",
    "notificação compulsória",
    "investigação de surto",
    "saúde do trabalhador",
    "articulação intersetorial",
    "referência e contrarreferência",
    "organização da rede de atenção",
    "limitação real de recursos",
  ]) {
    assert.ok(sa7.includes(termo), `REGRA SA-7 deveria mencionar "${termo}"`);
  }
});

teste("8a. REGRA SA-7 declara os cenários como OPCIONAIS, nunca forçados por área/tema", () => {
  const sa7 = extraiEntre("═══ REGRA SA-7 —", "`;", "REGRA SA-7");
  assert.match(sa7, /OPCIONAIS/, "SA-7 deveria declarar os cenários como opcionais");
  assert.match(sa7, /NÃO force nenhum deles/i, "SA-7 deveria proibir forçar os cenários em temas sem relação natural");
});

teste("8b. REGRA SA-7 proíbe cenário meramente decorativo", () => {
  const sa7 = extraiEntre("═══ REGRA SA-7 —", "`;", "REGRA SA-7");
  assert.match(sa7, /PROIBIDO: cenário decorativo/, "SA-7 deveria proibir explicitamente cenário decorativo");
  assert.match(sa7, /Se removê-lo não muda a resposta correta, ele não deveria estar lá/, "SA-7 deveria dar o critério prático de funcionalidade (remoção não pode ser indiferente)");
});

// 9. Preservação dos cenários assistenciais anteriores (REGRA 6, base
// compartilhada com ImportadorPro e Robô 2026.1) — SA-7 é aditiva.
teste("9. REGRA 6 (cenários assistenciais base) permanece intacta e SA-7 é explicitamente aditiva, não substitutiva", () => {
  const regra6 = extraiEntre("═══ REGRA 6 —", "═══ REGRA 7 —", "REGRA 6");
  for (const termo of ["UBS/ESF", "UPA/PS", "Enfermaria", "Pré-natal/GO"]) {
    assert.ok(regra6.includes(termo), `REGRA 6 deveria continuar mencionando "${termo}"`);
  }
  const sa7 = extraiEntre("═══ REGRA SA-7 —", "`;", "REGRA SA-7");
  assert.match(sa7, /ADITIVOS: não substituem UBS\/ESF, UPA\/PS, enfermaria e pré-natal\/GO/, "SA-7 deveria declarar explicitamente que não substitui os cenários base");
});

// 10. Nenhuma das alegações do curso virou regra universal.
teste("10. Nenhum tema do curso (One Health, clima, arboviroses, geriatria, integração obrigatória) virou regra universal nova", () => {
  const sa6 = extraiEntre("═══ REGRA SA-6 —", "═══ REGRA SA-7 —", "REGRA SA-6");
  const sa7 = extraiEntre("═══ REGRA SA-7 —", "`;", "REGRA SA-7");
  const textoNovo = sa6 + sa7;
  for (const termoProibido of [/one health/i, /clima e sa[úu]de/i, /arbovir/i, /geriatria/i, /polifarm/i, /integra[çc][ãa]o obrigat[óo]ria/i]) {
    assert.doesNotMatch(textoNovo, termoProibido, `texto novo não deveria mencionar "${termoProibido}" como regra universal`);
  }
  // Integração entre áreas continua sem menção nas regras novas (não virou obrigação).
  assert.doesNotMatch(textoNovo, /integra[çc][ãa]o entre [áa]reas/i, "regras novas não deveriam introduzir exigência de integração entre áreas");
});

// 11. Ausência de alteração em chamadas/retry/fallback/persistência/resumo —
// auditado por blast radius real do COMMIT HEAD em relação ao seu pai (não do
// working tree — em um checkout limpo pós-commit, `git diff --name-only`
// retorna vazio, o que quebrava este teste). `git diff-tree` audita o
// conteúdo do commit em si, funcionando tanto antes quanto depois do commit.
teste("11. blast radius real do commit HEAD (git diff-tree) restrito aos dois arquivos autorizados — nada de fluxo/retry/fallback/persistência/resumo foi tocado", () => {
  let arquivosDoCommit;
  try {
    const saida = execFileSync(
      "git",
      ["diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"],
      { cwd: _raiz, encoding: "utf8" }
    );
    arquivosDoCommit = saida.split("\n").map((l) => l.trim()).filter(Boolean).sort();
  } catch (e) {
    throw new Error(`não foi possível rodar git diff-tree --no-commit-id --name-only -r HEAD: ${e.message}`);
  }
  const esperado = ["scripts/test-hardening-r092-sa6-sa7.js", "src/utils/promptEngine.js"].sort();
  assert.deepEqual(
    arquivosDoCommit,
    esperado,
    `esperava exatamente ${JSON.stringify(esperado)} no commit HEAD, encontrado: ${JSON.stringify(arquivosDoCommit)}`
  );
  for (const arquivoProibido of [
    "src/components/RoboGerador.jsx",
    "src/utils/resumoEngine.js",
    "src/utils/ambienteGuard.js",
    "functions/index.js",
  ]) {
    assert.ok(!arquivosDoCommit.includes(arquivoProibido), `${arquivoProibido} não deveria constar entre os arquivos do commit`);
  }
});

// 12. Preservação das regras anti-pistas (SA-1) e das regras-base (REGRA 1,
// REGRA 5, SA-3) — comparação por hash exato do trecho, calculado a partir
// do arquivo-fonte real ANTES desta missão (valores fixos abaixo).
teste("12. REGRA 1, REGRA 5, SA-1 (anti-pistas) e SA-3 permanecem byte-a-byte idênticas (hash)", () => {
  const HASH_ESPERADO = {
    "REGRA 1": "7b5fec73762e191599d53290beb47a5de192656fb575eb619b7aa428447138c2",
    "REGRA 5": "d261afafcd65cf7a69f7c13857fc1f5355dd84d05544b57fd9a52fc282701ad2",
    "SA-1 (anti-pistas)": "fdd4e147141047c08d3f061ce44b730df5a2f28c4015aecb2de0121f20e415e0",
    "SA-3 (conduta em passos)": "efa8ad0a671b58e928827045d836455a0c863815d86683ffb312db7255a6d202",
  };
  const blocos = {
    "REGRA 1": extraiEntre("═══ REGRA 1 —", "═══ REGRA 2 —", "REGRA 1"),
    "REGRA 5": extraiEntre("═══ REGRA 5 —", "═══ REGRA 6 —", "REGRA 5"),
    "SA-1 (anti-pistas)": extraiEntre("═══ REGRA SA-1 —", "═══ REGRA SA-2 —", "SA-1"),
    "SA-3 (conduta em passos)": extraiEntre("═══ REGRA SA-3 —", "═══ REGRA SA-4 —", "SA-3"),
  };
  for (const [nome, texto] of Object.entries(blocos)) {
    assert.equal(hash(texto), HASH_ESPERADO[nome], `${nome} foi alterada (hash não bate) — esta missão não deveria tocá-la`);
  }
});

// 12b. Missão da precedência SA-3/SA-4: os dois blocos citados como
// "superados" pela nova frase (REGRA 2 e a seção DIRETRIZES ATUALIZADAS) e
// as demais regras SA (SA-2, SA-5, SA-6, SA-7) precisam continuar byte-a-byte
// intactas — a correção só pode viver DENTRO do texto de SA-4, nunca alterar
// o conteúdo das regras que ela passa a ter precedência sobre.
teste("12b. REGRA 2, DIRETRIZES ATUALIZADAS, SA-2, SA-5, SA-6 e SA-7 permanecem byte-a-byte idênticas (hash) — só SA-4 foi tocada", () => {
  const HASH_ESPERADO = {
    "REGRA 2": "b0183a69c4aed612e704201924968d9df2b5574ac11ad344ad2e8431270d9ac4",
    "DIRETRIZES ATUALIZADAS": "894d2e724dfb45fd46547962530928013fccd2867f2f95fb55d1a12e7b503323",
    "SA-2 (dica mestre)": "76c60b43229a3c9edb2b552130e42dcc6f7eb46f3a1f5fa51ec0523c28d6353a",
    "SA-5 (estilo)": "7e9e83f5c812c9c88a5dc379770a604db9d3ff5d9ba01485719864287efafe54",
    "SA-6 (não intervenção)": "c6398f46dc8810e04b20926fbdb1aa701ccef84692c1d7a8c341087390ca8bf1",
    "SA-7 (cenários ampliados)": "b0804eacb585d74d8a992e90e0e1eb5d45b2f4787762f69ef62aafac5a19fe97",
  };
  const blocos = {
    "REGRA 2": extraiEntre("═══ REGRA 2 —", "═══ REGRA 3 —", "REGRA 2"),
    "DIRETRIZES ATUALIZADAS": extraiEntre("═══ DIRETRIZES ATUALIZADAS ═══", "`;", "DIRETRIZES ATUALIZADAS"),
    "SA-2 (dica mestre)": extraiEntre("═══ REGRA SA-2 —", "═══ REGRA SA-3 —", "SA-2"),
    "SA-5 (estilo)": extraiEntre("═══ REGRA SA-5 —", "═══ REGRA SA-6 —", "SA-5"),
    "SA-6 (não intervenção)": extraiEntre("═══ REGRA SA-6 —", "═══ REGRA SA-7 —", "SA-6"),
    "SA-7 (cenários ampliados)": extraiEntre("═══ REGRA SA-7 —", "`;", "SA-7"),
  };
  for (const [nome, texto] of Object.entries(blocos)) {
    assert.equal(hash(texto), HASH_ESPERADO[nome], `${nome} foi alterada (hash não bate) — esta missão só deveria adicionar texto dentro de SA-4`);
  }
});

// ════════════════════════════════════════════════════════════════════════
// MISSÃO — PRECEDÊNCIA SA-3/SA-4 SOBRE REGRA 2 / DIRETRIZES ATUALIZADAS
// ════════════════════════════════════════════════════════════════════════
// Motivada pelo diagnóstico read-only da rejeição pós-hardening do R092:
// REGRA 2 ("nome da fonte", "dose... quando possível") e a seção DIRETRIZES
// ATUALIZADAS ("Cadernos de Atenção Primária") são instruções BASE
// incondicionais que competem com a restrição condicional de SA-3/SA-4
// quando não há bloco DIRETRIZ CONTROLADA injetado — sem nenhuma frase de
// precedência declarada entre elas. A correção adiciona só essa frase,
// inteiramente dentro do bloco de SA-4.

teste("13. SA-4 contém frase de PRECEDÊNCIA OBRIGATÓRIA citando nominalmente SA-3", () => {
  const sa4 = extraiEntre("═══ REGRA SA-4 —", "═══ REGRA SA-5 —", "REGRA SA-4");
  assert.match(sa4, /PRECEDÊNCIA OBRIGATÓRIA/, "SA-4 deveria conter uma frase de precedência explícita");
  assert.match(sa4, /SA-3/, "a frase de precedência deveria citar SA-3 nominalmente");
});

teste("14. a frase de precedência cita nominalmente REGRA 2", () => {
  const sa4 = extraiEntre("═══ REGRA SA-4 —", "═══ REGRA SA-5 —", "REGRA SA-4");
  const precedencia = sa4.match(/PRECEDÊNCIA OBRIGATÓRIA[\s\S]*/)[0];
  assert.match(precedencia, /REGRA 2/, "a frase de precedência deveria citar REGRA 2 nominalmente");
});

teste("15. a frase de precedência cita DIRETRIZES ATUALIZADAS/Cadernos de Atenção Primária", () => {
  const sa4 = extraiEntre("═══ REGRA SA-4 —", "═══ REGRA SA-5 —", "REGRA SA-4");
  const precedencia = sa4.match(/PRECEDÊNCIA OBRIGATÓRIA[\s\S]*/)[0];
  assert.match(precedencia, /DIRETRIZES ATUALIZADAS/, "a frase de precedência deveria citar a seção DIRETRIZES ATUALIZADAS");
  assert.match(precedencia, /Cadernos de Atenção Primária/, "a frase de precedência deveria citar nominalmente os Cadernos de Atenção Primária");
});

teste("16. a frase de precedência reafirma ausência de posologia numérica em tto sem grounding (resolve SA-3)", () => {
  const sa4 = extraiEntre("═══ REGRA SA-4 —", "═══ REGRA SA-5 —", "REGRA SA-4");
  const precedencia = sa4.match(/PRECEDÊNCIA OBRIGATÓRIA[\s\S]*/)[0];
  assert.match(precedencia, /"tto"/, 'a frase de precedência deveria citar o campo "tto" nominalmente');
  assert.match(precedencia, /proibido de conter posologia numérica/, 'a frase de precedência deveria reafirmar a proibição de posologia numérica em "tto"');
});

teste("17. a frase de precedência reafirma ano_diretriz:null e fonte_diretriz:\"\" (resolve SA-4)", () => {
  const sa4 = extraiEntre("═══ REGRA SA-4 —", "═══ REGRA SA-5 —", "REGRA SA-4");
  const precedencia = sa4.match(/PRECEDÊNCIA OBRIGATÓRIA[\s\S]*/)[0];
  assert.match(precedencia, /"ano_diretriz"\/"fonte_diretriz" continuam null\/""/, 'a frase de precedência deveria reafirmar ano_diretriz null e fonte_diretriz ""');
});

teste("18. a frase de precedência foi ANEXADA ao final de SA-4 (append-only) — o parágrafo dos termos absolutos (teste 3/4) continua intacto e antes dela, não substituído", () => {
  const sa4 = extraiEntre("═══ REGRA SA-4 —", "═══ REGRA SA-5 —", "REGRA SA-4");
  const idxTermosAbsolutos = sa4.indexOf('"sempre", "nunca", "obrigatório"');
  const idxPrecedencia = sa4.indexOf("PRECEDÊNCIA OBRIGATÓRIA");
  assert.ok(idxTermosAbsolutos > -1, "parágrafo dos termos absolutos (hardening anterior) deveria continuar presente em SA-4");
  assert.ok(idxPrecedencia > -1, "frase de precedência deveria estar presente em SA-4");
  assert.ok(idxPrecedencia > idxTermosAbsolutos, "a frase de precedência deveria vir DEPOIS do parágrafo de termos absolutos — edição append-only, não substituição");
});

// Preservação extra: SA-5 continua íntegra por baixo das novas SA-6/SA-7
// (o encadeamento textual precisava terminar a SA-5 antes de abrir SA-6).
teste("preservação extra: REGRA SA-5 permanece intacta (SA-6/SA-7 foram anexadas depois, não inseridas no meio)", () => {
  const sa5 = extraiEntre("═══ REGRA SA-5 —", "═══ REGRA SA-6 —", "REGRA SA-5");
  assert.match(sa5, /UMA ÚNICA melhor resposta defensável/, "SA-5 deveria continuar exigindo resposta única defensável");
  assert.match(sa5, /MÉDICO GENERALISTA/, "SA-5 deveria continuar exigindo nível de médico generalista");
  assert.match(sa5, /Se o enunciado parece "aula", está errado/, "SA-5 deveria continuar proibindo enunciado didático");
});

// Preservação: número de chamadas/modelo/etc. não têm como ser mudados por
// esta missão porque vivem fora de promptEngine.js — confirmado indiretamente
// pelo teste 11 (blast radius). Aqui confirmamos que o próprio arquivo
// alterado não introduziu nenhuma chamada de rede/IA nova.
teste("promptEngine.js não ganhou nenhuma chamada de rede/IA nova (fetch/chamarIA únicos, mesmos de antes)", () => {
  const ocorrenciasFetch = (src.match(/\bfetch\(/g) || []).length;
  assert.equal(ocorrenciasFetch, 1, "deveria haver exatamente 1 fetch() em promptEngine.js (dentro de chamarIA) — nenhum novo ponto de rede introduzido");
});

console.log(`\n${passou}/${passou + falhas.length} testes passaram.`);
if (falhas.length > 0) {
  console.log("\nFalhas:");
  falhas.forEach((f) => console.log(`  - ${f.nome}: ${f.erro}`));
  process.exit(1);
}
