// ─── TESTES — GOVERNANÇA CLÍNICA DE DIRETRIZES (Macro Sprint 2026.2) ─────────
// Script Node puro (sem framework novo — projeto não tem vitest/jest instalado
// e adicionar um seria mais arquitetura do que o necessário para validar
// funções puras de um módulo de configuração). Rodar com:
//   node scripts/test-diretrizes-governanca.js
// Sai com código 1 se qualquer assert falhar (apto para uso em CI futuro).

import assert from "node:assert/strict";
import {
  DIRETRIZES_CONTROLADAS,
  detectarDiretrizDinamica,
  detectarDiretriz,
  avaliarBloqueioDiretriz,
  montarBlocoDiretriz,
  STATUS_DIRETRIZ,
} from "../src/config/diretrizesControladas.js";

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

// Lista sintética isolada (não depende do conteúdo real das 6 diretrizes
// prioritárias, para os testes 1-8 não quebrarem se o conteúdo mudar depois).
const listaTeste = [
  { id: "t_vigente", tema: "Teste Vigente", palavrasChave: ["testevigente"], fonte: "Fonte A", ano: 2024, pontosCriticos: ["ponto 1"], ativa: true, historica: false, substitui: null, status: STATUS_DIRETRIZ.VIGENTE_CONFIRMADA },
  { id: "t_sem_status", tema: "Teste Sem Status", palavrasChave: ["testesemstatus"], fonte: "Fonte B", ano: 2023, pontosCriticos: ["ponto 2"], ativa: true, historica: false, substitui: null },
  { id: "t_pendente", tema: "Teste Pendente", palavrasChave: ["testependente"], fonte: "Fonte C", ano: 2022, pontosCriticos: ["ponto 3"], ativa: true, historica: false, substitui: null, status: STATUS_DIRETRIZ.PENDENTE_REVISAO },
  { id: "t_desatualizada", tema: "Teste Desatualizada", palavrasChave: ["testedesatualizada"], fonte: "Fonte D", ano: 2020, pontosCriticos: ["ponto 4"], ativa: true, historica: false, substitui: null, status: STATUS_DIRETRIZ.DESATUALIZADA },
  { id: "t_substituida", tema: "Teste Substituida", palavrasChave: ["testesubstituida"], fonte: "Fonte E", ano: 2019, pontosCriticos: ["ponto 5"], ativa: true, historica: false, substitui: null, status: STATUS_DIRETRIZ.SUBSTITUIDA },
  { id: "t_bloqueada", tema: "Teste Bloqueada", palavrasChave: ["testebloqueada"], fonte: "Fonte F", ano: 2021, pontosCriticos: ["ponto 6"], ativa: true, historica: false, substitui: null, status: STATUS_DIRETRIZ.BLOQUEADA },
];

// 1. diretriz VIGENTE_CONFIRMADA é carregada
teste("1. diretriz VIGENTE_CONFIRMADA é carregada", () => {
  const d = detectarDiretrizDinamica(listaTeste, "algo com testevigente", "");
  assert.equal(d?.id, "t_vigente");
});

// 2. diretriz DESATUALIZADA é bloqueada
teste("2. diretriz DESATUALIZADA é bloqueada", () => {
  assert.equal(detectarDiretrizDinamica(listaTeste, "algo com testedesatualizada", ""), null);
  const avaliacao = avaliarBloqueioDiretriz(listaTeste, "algo com testedesatualizada", "");
  assert.equal(avaliacao.bloqueado, true);
  assert.equal(avaliacao.diretriz.id, "t_desatualizada");
});

// 3. diretriz SUBSTITUIDA é bloqueada
teste("3. diretriz SUBSTITUIDA é bloqueada", () => {
  assert.equal(detectarDiretrizDinamica(listaTeste, "algo com testesubstituida", ""), null);
  const avaliacao = avaliarBloqueioDiretriz(listaTeste, "algo com testesubstituida", "");
  assert.equal(avaliacao.bloqueado, true);
  assert.equal(avaliacao.diretriz.id, "t_substituida");
});

// 4. diretriz PENDENTE_REVISAO é bloqueada
teste("4. diretriz PENDENTE_REVISAO é bloqueada", () => {
  assert.equal(detectarDiretrizDinamica(listaTeste, "algo com testependente", ""), null);
  const avaliacao = avaliarBloqueioDiretriz(listaTeste, "algo com testependente", "");
  assert.equal(avaliacao.bloqueado, true);
  assert.equal(avaliacao.diretriz.id, "t_pendente");
});

// 5. diretriz BLOQUEADA é bloqueada
teste("5. diretriz BLOQUEADA é bloqueada", () => {
  assert.equal(detectarDiretrizDinamica(listaTeste, "algo com testebloqueada", ""), null);
  const avaliacao = avaliarBloqueioDiretriz(listaTeste, "algo com testebloqueada", "");
  assert.equal(avaliacao.bloqueado, true);
  assert.equal(avaliacao.diretriz.id, "t_bloqueada");
});

// 6. grounding obrigatório sem diretriz vigente não chama a IA
//    (verifica o exato sinal que RoboGerador.jsx usa para decidir "continue"
//    antes de montar o prompt/chamar executarGeracaoSA — ver linha do
//    pré-check de governança em RoboGerador.jsx. Não renderiza o componente
//    React em si — não há framework de DOM/testing-library instalado; este
//    teste cobre a função pura que efetivamente decide o bloqueio.)
teste("6. grounding obrigatório sem diretriz vigente sinaliza bloqueio (não chama a IA)", () => {
  const avaliacao = avaliarBloqueioDiretriz(listaTeste, "testedesatualizada", "");
  assert.equal(avaliacao.bloqueado, true, "RoboGerador.jsx deve dar `continue` (0 chamadas à IA) neste caso");
});

// 7. recorte qualitativo dispensável (sem nenhuma palavra-chave correspondente) continua funcionando
teste("7. recorte sem diretriz correspondente continua gerando sem bloqueio", () => {
  const d = detectarDiretrizDinamica(listaTeste, "tema totalmente nao relacionado xyz", "");
  assert.equal(d, null);
  const avaliacao = avaliarBloqueioDiretriz(listaTeste, "tema totalmente nao relacionado xyz", "");
  assert.equal(avaliacao.bloqueado, false);
});

// 8. metadados de versão chegam ao bloco injetado
teste("8. montarBlocoDiretriz injeta fonte/ano corretamente mesmo com novos campos presentes", () => {
  const diretrizComMetadados = {
    ...listaTeste[0],
    titulo: "Título Oficial X", orgao: "Órgão Y", urlOficial: "https://exemplo.gov.br",
    versao: "v2", anoPublicacao: 2025, dataUltimaRevisao: "2026-07-24", revisadoPor: null,
    validadeOuProximaRevisao: "90 dias", observacoes: "obs", temasRelacionados: ["R999"],
  };
  const bloco = montarBlocoDiretriz(diretrizComMetadados);
  assert.match(bloco, /FONTE OFICIAL VIGENTE: Fonte A/);
  assert.match(bloco, /ANO DE REFERÊNCIA: 2024/);
  assert.match(bloco, /ponto 1/);
});

// 9. nenhuma fonte ou ano antigo é tratado como vigente apenas por existir no arquivo
//    (as 6 diretrizes prioritárias da auditoria devem estar PENDENTE_REVISAO,
//    não VIGENTE_CONFIRMADA nem sem status)
teste("9. as 6 diretrizes prioritárias da auditoria estão marcadas PENDENTE_REVISAO", () => {
  const idsAuditados = ["dm", "rastreamento_colo", "vacinacao", "has", "sifilis", "hiv"];
  for (const id of idsAuditados) {
    const d = DIRETRIZES_CONTROLADAS.find(x => x.id === id);
    assert.ok(d, `diretriz ${id} deveria existir`);
    assert.equal(d.status, STATUS_DIRETRIZ.PENDENTE_REVISAO, `diretriz ${id} deveria estar PENDENTE_REVISAO, está "${d.status}"`);
  }
  // e, por consequência, nenhuma delas deve ser retornada como grounding vigente hoje
  assert.equal(detectarDiretriz("Diabetes mellitus tipo 2", ""), null, "dm não deveria estar vigente");
  assert.equal(detectarDiretriz("Hipertensão arterial sistêmica", ""), null, "has não deveria estar vigente");
});

// 10. diretrizes não tocadas nesta fase seguem sem status — e, após a correção
//     fail-closed da Micro Sprint 4A.1 (Achado Crítico C1), isso agora BLOQUEIA
//     em vez de liberar (antes desta correção, `status === undefined` era
//     tratado como vigente; ver STATUS_DIRETRIZ em diretrizesControladas.js).
teste("10. diretrizes sem status (não tocadas nesta fase) agora bloqueiam, fail-closed", () => {
  const idsNaoTocados = ["sepse", "asma", "tuberculose", "dengue", "etica_medica", "prenatal"];
  for (const id of idsNaoTocados) {
    const d = DIRETRIZES_CONTROLADAS.find(x => x.id === id);
    assert.ok(d, `diretriz ${id} deveria existir`);
    assert.equal(d.status, undefined, `diretriz ${id} não deveria ter status nesta fase (Fase 1 não a tocou)`);
  }
  // pós-correção C1: ausência de status já não é mais tratada como vigente
  assert.equal(detectarDiretriz("Sepse", ""), null, "sepse sem status não deveria mais liberar grounding (fail-closed)");
  assert.equal(detectarDiretriz("Asma", ""), null, "asma sem status não deveria mais liberar grounding (fail-closed)");
  assert.equal(detectarDiretriz("Dengue", ""), null, "dengue sem status não deveria mais liberar grounding (fail-closed)");
});

// ═══════════════════════════════════════════════════════════════════════════
// FASE 2 — Macro Sprint de Governança Clínica: 13 casos adicionais exigidos
// ═══════════════════════════════════════════════════════════════════════════

// 11. as seis diretrizes antigas (Fase 1) continuam bloqueadas enquanto não confirmadas
teste("11. as 6 diretrizes prioritárias continuam bloqueadas (avaliarBloqueioDiretriz)", () => {
  const casos = [
    ["dm", "Diabetes mellitus tipo 2"],
    ["rastreamento_colo", "Rastreamento do câncer de colo do útero"],
    ["vacinacao", "Calendário nacional de vacinação"],
    ["has", "Hipertensão arterial sistêmica"],
    ["sifilis", "Sífilis"],
    ["hiv", "HIV"],
  ];
  for (const [id, tema] of casos) {
    const avaliacao = avaliarBloqueioDiretriz(DIRETRIZES_CONTROLADAS, tema, "");
    assert.equal(avaliacao.bloqueado, true, `${id} deveria estar bloqueada`);
    assert.equal(avaliacao.diretriz.id, id);
  }
});

// 12. as cinco novas diretrizes não liberam geração antes da validação
teste("12. as 5 diretrizes novas (Fase 2) não liberam geração antes da validação", () => {
  const casos = [
    ["ictericia_neonatal", "Icterícia neonatal fototerapia"],
    ["diverticulite", "Diverticulite classificação de Hinchey"],
    ["tvp_wells", "Escore de Wells trombose venosa profunda"],
    ["distocia_ombro", "Distocia de ombro manobra de McRoberts"],
    ["violencia_domestica", "Violência doméstica notificação compulsória"],
  ];
  for (const [id, tema] of casos) {
    assert.equal(detectarDiretriz(tema, ""), null, `${id} não deveria estar vigente`);
    const avaliacao = avaliarBloqueioDiretriz(DIRETRIZES_CONTROLADAS, tema, "");
    assert.equal(avaliacao.bloqueado, true, `${id} deveria estar bloqueada`);
    assert.equal(avaliacao.diretriz.id, id);
  }
});

// 13. conteúdo substituído (SUBSTITUIDA) não é injetado
teste("13. diretriz SUBSTITUIDA nunca é retornada por detectarDiretrizDinamica", () => {
  const d = detectarDiretrizDinamica(listaTeste, "testesubstituida", "");
  assert.equal(d, null);
});

// 14. afirmações antigas críticas foram corrigidas/marcadas (não presentes isoladas)
teste("14. metformina não aparece mais como 1ª linha universal sem condição", () => {
  const dm = DIRETRIZES_CONTROLADAS.find(x => x.id === "dm");
  const textoCompleto = dm.pontosCriticos.join(" || ");
  assert.doesNotMatch(
    textoCompleto,
    /1ª linha: Metformina 500–2000 mg\/dia \(se TFG ≥30 e sem contraindicações\)$/,
    "não deveria existir mais a afirmação antiga sem condicionalidade"
  );
  assert.match(textoCompleto, /1ª linha CONDICIONAL/, "deveria existir a versão corrigida condicional");
});

// 15. conteúdo atômico carrega fonte, versão e seção (metadados presentes nas 5 novas)
teste("15. as 5 diretrizes novas carregam titulo/orgao/urlOficial/versao/observacoes", () => {
  const idsNovos = ["ictericia_neonatal", "diverticulite", "tvp_wells", "distocia_ombro", "violencia_domestica"];
  for (const id of idsNovos) {
    const d = DIRETRIZES_CONTROLADAS.find(x => x.id === id);
    assert.ok(d, `${id} deveria existir`);
    assert.ok(d.titulo, `${id}.titulo ausente`);
    assert.ok(d.orgao, `${id}.orgao ausente`);
    assert.ok(d.versao, `${id}.versao ausente`);
    assert.ok(d.observacoes, `${id}.observacoes ausente`);
    assert.equal(d.status, STATUS_DIRETRIZ.PENDENTE_REVISAO, `${id} deveria estar PENDENTE_REVISAO`);
  }
});

// 16. recorte com grounding obrigatório é bloqueado se a diretriz (nova) não estiver liberada
teste("16. tema correspondente a diretriz nova não vigente é bloqueado antes de gerar", () => {
  const avaliacao = avaliarBloqueioDiretriz(DIRETRIZES_CONTROLADAS, "Icterícia neonatal", "");
  assert.equal(avaliacao.bloqueado, true);
});

// 17. temas qualitativos dispensáveis permanecem compatíveis (regressão)
teste("17. tema sem correspondência a nenhuma diretriz (nova ou antiga) continua gerando", () => {
  const avaliacao = avaliarBloqueioDiretriz(DIRETRIZES_CONTROLADAS, "Transtorno do espectro autista sinais de alerta", "");
  assert.equal(avaliacao.bloqueado, false);
});

// 18. R096 não confunde notificação com denúncia
teste("18. violencia_domestica distingue explicitamente notificação de denúncia policial", () => {
  const d = DIRETRIZES_CONTROLADAS.find(x => x.id === "violencia_domestica");
  const texto = d.pontosCriticos.join(" || ");
  assert.match(texto, /NOTIFICAÇÃO COMPULSÓRIA EM SAÚDE ≠ DENÚNCIA POLICIAL/);
});

// 19. TVP/Wells não é apresentado como diagnóstico isolado
teste("19. tvp_wells contém a limitação explícita de não ser diagnóstico isolado", () => {
  const d = DIRETRIZES_CONTROLADAS.find(x => x.id === "tvp_wells");
  const texto = d.pontosCriticos.join(" || ");
  assert.match(texto, /nunca diagnóstico isolado/);
});

// 20. distocia de ombro não recomenda pressão fúndica
teste("20. distocia_ombro não recomenda pressão fúndica (só menciona como contraindicação a confirmar)", () => {
  const d = DIRETRIZES_CONTROLADAS.find(x => x.id === "distocia_ombro");
  const texto = d.pontosCriticos.join(" || ");
  // não pode haver uma linha que RECOMENDE pressão fúndica
  const recomendaPressaoFundica = d.pontosCriticos.some(
    p => /pressão fúndica|kristeller/i.test(p) && /recomend|indicad/i.test(p) && !/contraindicad|a confirmar/i.test(p)
  );
  assert.equal(recomendaPressaoFundica, false, "não deveria haver recomendação de pressão fúndica");
  assert.match(texto, /contraindicada/i);
});

// 21. rastreamento não é aplicado a paciente sintomática como se fosse rotina
teste("21. rastreamento_colo distingue rastreamento de rotina vs. paciente sintomática", () => {
  const d = DIRETRIZES_CONTROLADAS.find(x => x.id === "rastreamento_colo");
  const texto = d.pontosCriticos.join(" || ");
  assert.match(texto, /NÃO se aplica a paciente sintomática/,
    "pontosCriticos deveria registrar explicitamente a distinção rastreamento x investigação sintomática");
});

// 22. vacinação mantém separação por população e ano (não mistura faixas etárias)
teste("22. vacinacao (bloco meningocócico) especifica faixa etária, não regra genérica única", () => {
  const d = DIRETRIZES_CONTROLADAS.find(x => x.id === "vacinacao");
  const pontoACWY = d.pontosCriticos.find(p => /ACWY/.test(p));
  assert.ok(pontoACWY, "deveria existir ponto crítico sobre ACWY");
  assert.match(pontoACWY, /12 meses/, "deveria especificar a faixa etária exata (12 meses), não uma regra genérica");
});

// 23. nenhuma chamada de IA ocorre quando há bloqueio científico (mesmo sinal usado por RoboGerador.jsx)
teste("23. bloqueio científico produz o mesmo sinal que RoboGerador.jsx usa para `continue` (0 chamadas à IA)", () => {
  const temasBloqueados = [
    "Diabetes mellitus tipo 2", "Violência doméstica notificação compulsória", "Escore de Wells trombose venosa profunda",
  ];
  for (const tema of temasBloqueados) {
    const avaliacao = avaliarBloqueioDiretriz(DIRETRIZES_CONTROLADAS, tema, "");
    assert.equal(avaliacao.bloqueado, true, `"${tema}" deveria bloquear antes de qualquer chamada à IA`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// FASE 3 — Fechamento das lacunas documentais: 12 casos adicionais exigidos
// ═══════════════════════════════════════════════════════════════════════════

// 24. módulos de HIV têm status independente
teste("24. hiv.statusModulos existe e cada módulo tem status próprio", () => {
  const hiv = DIRETRIZES_CONTROLADAS.find(x => x.id === "hiv");
  assert.ok(hiv.statusModulos, "hiv deveria ter statusModulos");
  const modulos = ["diagnostico", "tarv_1a_linha", "gestacao", "coinfeccoes", "pep", "prep", "acompanhamento", "falha_terapeutica"];
  for (const m of modulos) assert.ok(hiv.statusModulos[m], `módulo ${m} deveria ter status`);
  // nem todos os módulos têm o mesmo status — prova de independência real
  const statusUnicos = new Set(Object.values(hiv.statusModulos));
  assert.ok(statusUnicos.size > 1, "módulos deveriam ter status diferentes entre si (não é um valor único copiado)");
});

// 25. regra de TARV não libera automaticamente PEP ou PrEP
teste("25. status PRONTO do módulo TARV não promove PEP/PrEP automaticamente", () => {
  const hiv = DIRETRIZES_CONTROLADAS.find(x => x.id === "hiv");
  assert.equal(hiv.statusModulos.tarv_1a_linha, "PRONTA_PARA_VALIDACAO_HUMANA");
  assert.notEqual(hiv.statusModulos.prep, "PRONTA_PARA_VALIDACAO_HUMANA", "PrEP não deveria herdar o status de TARV");
  // status geral da entrada continua conservador mesmo com TARV/PEP prontos
  assert.equal(hiv.statusDocumental, "PENDENTE_AJUSTE");
});

// 26. diverticulite permanece bloqueada se divergência estiver aberta
teste("26. diverticulite com conflito interno aberto permanece PENDENTE_AJUSTE e bloqueada", () => {
  const d = DIRETRIZES_CONTROLADAS.find(x => x.id === "diverticulite");
  assert.equal(d.statusDocumental, "PENDENTE_AJUSTE");
  assert.match(d.observacoes, /conflito|CONFLITO/, "observações deveriam registrar o conflito interno não resolvido");
  const avaliacao = avaliarBloqueioDiretriz(DIRETRIZES_CONTROLADAS, "Diverticulite classificação de Hinchey", "");
  assert.equal(avaliacao.bloqueado, true);
});

// 27. HAS não gera regra absoluta diante de divergência (classificação corrigida, sem apagar o histórico)
teste("27. has registra a correção de classificação sem apagar a ressalva de itens não relidos", () => {
  const d = DIRETRIZES_CONTROLADAS.find(x => x.id === "has");
  const texto = d.pontosCriticos.join(" || ");
  assert.match(texto, /CLASSIFICAÇÃO CORRIGIDA/);
  assert.match(texto, /não relido/i, "deveria haver ao menos um ponto marcado como não relido, evitando afirmação absoluta de que tudo foi confirmado");
});

// 28. rastreamento diferencia rotina de paciente sintomática (regressão + histerectomia novo)
teste("28. rastreamento_colo cobre histerectomia e mantém a distinção rotina/sintomática", () => {
  const d = DIRETRIZES_CONTROLADAS.find(x => x.id === "rastreamento_colo");
  const texto = d.pontosCriticos.join(" || ");
  assert.match(texto, /NÃO se aplica a paciente sintomática/);
  assert.match(texto, /HISTERECTOMIA/);
});

// 29. vacinação exige ano e população (não regra genérica única)
teste("29. vacinacao.dTpa especifica população (gestante/puérpera/profissional), não regra única", () => {
  const d = DIRETRIZES_CONTROLADAS.find(x => x.id === "vacinacao");
  const pontoDtpa = d.pontosCriticos.find(p => /dTpa/.test(p));
  assert.ok(pontoDtpa);
  assert.match(pontoDtpa, /gestante/i);
  assert.match(pontoDtpa, /puérpera/i);
  assert.match(pontoDtpa, /profissiona(l|is)/i);
});

// 30. icterícia exige contexto populacional (neonatal, não genérico)
teste("30. ictericia_neonatal delimita escopo estritamente neonatal", () => {
  const d = DIRETRIZES_CONTROLADAS.find(x => x.id === "ictericia_neonatal");
  assert.match(d.observacoes, /NEONATAL/);
  assert.match(d.tema, /Neonatal/);
});

// 31. R096 separa notificação de denúncia (com prazo/destinatário confirmados na Fase 3)
teste("31. violencia_domestica confirma prazo (24h) e destinatário (autoridade policial) por citação legal", () => {
  const d = DIRETRIZES_CONTROLADAS.find(x => x.id === "violencia_domestica");
  const texto = d.pontosCriticos.join(" || ");
  assert.match(texto, /24 \(vinte e quatro\) horas/);
  assert.match(texto, /AUTORIDADE POLICIAL/);
  assert.match(texto, /NOTIFICAÇÃO COMPULSÓRIA EM SAÚDE ≠ DENÚNCIA POLICIAL/);
});

// 32. fonte secundária isolada não permite status documental pronto
teste("32. diretrizes baseadas só em fonte secundária não são PRONTA_PARA_VALIDACAO_HUMANA", () => {
  const idsFonteSecundaria = ["diverticulite", "tvp_wells", "distocia_ombro", "ictericia_neonatal"];
  for (const id of idsFonteSecundaria) {
    const d = DIRETRIZES_CONTROLADAS.find(x => x.id === id);
    assert.notEqual(d.statusDocumental, "PRONTA_PARA_VALIDACAO_HUMANA", `${id} não deveria estar pronta (só fonte secundária/parcial)`);
  }
});

// 33. diretriz sem documento primário lido permanece bloqueada para geração
teste("33. tvp_wells (sem documento primário lido) permanece bloqueada", () => {
  const avaliacao = avaliarBloqueioDiretriz(DIRETRIZES_CONTROLADAS, "Escore de Wells trombose venosa profunda", "");
  assert.equal(avaliacao.bloqueado, true);
});

// 34. recorte reclassificado como grounding obrigatório não chama IA (achado real da reauditoria: R036)
teste("34. R036 (distocia de ombro), reclassificado na reauditoria da Fase 3, é bloqueado pelo código real", () => {
  // Achado da reauditoria: a matriz automática da Fase 2 classificou R036 como
  // "liberável" (grounding dispensável) por tratar "manobras sequenciais" como
  // categórico-sequencial, sem checar que a Fase 2 já criara a diretriz
  // `distocia_ombro`. O código real (avaliarBloqueioDiretriz) já bloqueia
  // corretamente — este teste prova que o comportamento real diverge (para
  // mais seguro) da classificação desatualizada da matriz.
  const avaliacao = avaliarBloqueioDiretriz(DIRETRIZES_CONTROLADAS, "Manobras sequenciais e reconhecimento do fator de risco distocia de ombro", "");
  assert.equal(avaliacao.bloqueado, true, "R036 deveria ser bloqueado pelo código real, corrigindo a matriz da Fase 2");
});

// 35. nenhuma diretriz é promovida automaticamente
teste("35. nenhuma das 17 diretrizes está VIGENTE_CONFIRMADA (nenhuma promoção automática ocorreu)", () => {
  const comStatusExplicito = DIRETRIZES_CONTROLADAS.filter(d => d.status !== undefined);
  assert.ok(comStatusExplicito.length >= 11, "deveriam existir ao menos as 11 diretrizes com status explícito (6 Fase 1 + 5 Fase 2)");
  for (const d of comStatusExplicito) {
    assert.notEqual(d.status, STATUS_DIRETRIZ.VIGENTE_CONFIRMADA, `${d.id} não deveria estar VIGENTE_CONFIRMADA`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// MICRO SPRINT 4A.1 — Achado Crítico C1: fail-closed para status ausente/
// vazio/desconhecido em documentos no formato real gravado pelo Firestore
// (semearBase() nunca escreveu `status`/`statusDocumental`/`statusModulos`).
// ═══════════════════════════════════════════════════════════════════════════

// Fixture no formato exato que semearBase() grava no Firestore hoje (sem
// nenhum campo de governança das Fases 1–3) — reproduz o documento "antigo".
const docFirestoreAntigoSemStatus = {
  tema_id: "fs_antigo", tema: "Doc Firestore Antigo", palavrasChave: ["fsantigo"],
  fonte: "Fonte Firestore", ano: 2023, pontosCriticos: ["ponto fs 1"],
  ativa: true, historica: false, substitui: null, origem: "sistema",
  // sem `status` — exatamente o que semearBase() grava (Achado C1)
};

teste("36. [C1] documento Firestore antigo sem campo `status` é BLOQUEADO (fail-closed)", () => {
  assert.equal(detectarDiretrizDinamica([docFirestoreAntigoSemStatus], "fsantigo", ""), null,
    "antes da correção C1 este documento seria tratado como vigente por omissão de status");
  const avaliacao = avaliarBloqueioDiretriz([docFirestoreAntigoSemStatus], "fsantigo", "");
  assert.equal(avaliacao.bloqueado, true);
});

teste("37. [C1] documento com `status` vazio (\"\") é bloqueado", () => {
  const d = { ...docFirestoreAntigoSemStatus, id: "fs_vazio", palavrasChave: ["fsvazio"], status: "" };
  assert.equal(detectarDiretrizDinamica([d], "fsvazio", ""), null);
  assert.equal(avaliarBloqueioDiretriz([d], "fsvazio", "").bloqueado, true);
});

teste("38. [C1] documento com `status` desconhecido/inválido é bloqueado", () => {
  const d = { ...docFirestoreAntigoSemStatus, id: "fs_desconhecido", palavrasChave: ["fsdesconhecido"], status: "REVISADO_EXTERNAMENTE" };
  assert.equal(detectarDiretrizDinamica([d], "fsdesconhecido", ""), null);
  assert.equal(avaliarBloqueioDiretriz([d], "fsdesconhecido", "").bloqueado, true);
});

teste("39. [C1] documento com status explicitamente VIGENTE_CONFIRMADA continua liberando (regressão)", () => {
  const d = { ...docFirestoreAntigoSemStatus, id: "fs_vigente", palavrasChave: ["fsvigenteok"], status: STATUS_DIRETRIZ.VIGENTE_CONFIRMADA };
  assert.equal(detectarDiretrizDinamica([d], "fsvigenteok", "")?.id, "fs_vigente");
  assert.equal(avaliarBloqueioDiretriz([d], "fsvigenteok", "").bloqueado, false);
});

teste("40. [C1] módulo filho com statusModulos \"pronto\" não libera a diretriz pai bloqueada", () => {
  // statusModulos é granularidade interna (ex.: hiv.tarv_1a_linha) — não é
  // consultada por _statusUtilizavel, que só olha o `status` de topo. Um
  // módulo pronto não deve, por si só, liberar grounding para o tema.
  const d = {
    ...docFirestoreAntigoSemStatus, id: "fs_modulo_pai", palavrasChave: ["fsmodulopai"],
    status: STATUS_DIRETRIZ.PENDENTE_REVISAO,
    statusModulos: { moduloFilho: "PRONTA_PARA_VALIDACAO_HUMANA" },
  };
  const avaliacao = avaliarBloqueioDiretriz([d], "fsmodulopai", "");
  assert.equal(avaliacao.bloqueado, true, "diretriz pai deveria permanecer bloqueada mesmo com módulo filho pronto");
});

teste("41. [C1] lista Firestore (preferida à estática) obedece a mesma regra fail-closed que a lista estática", () => {
  // Mesma função (detectarDiretrizDinamica/avaliarBloqueioDiretriz) é usada
  // tanto para DIRETRIZES_CONTROLADAS quanto para a lista vinda do Firestore
  // (RoboGerador.jsx/ResumoGerador.jsx/ImportadorPro.jsx) — não há caminho de
  // código separado que trate uma lista com mais permissividade que a outra.
  const listaFirestoreSimulada = [docFirestoreAntigoSemStatus];
  const avaliacaoFirestore = avaliarBloqueioDiretriz(listaFirestoreSimulada, "fsantigo", "");
  const avaliacaoEstatica = avaliarBloqueioDiretriz(DIRETRIZES_CONTROLADAS, "Sepse", "");
  assert.equal(avaliacaoFirestore.bloqueado, true);
  // "sepse" também está sem status no arquivo estático — mesma regra, mesmo resultado
  assert.equal(avaliacaoEstatica.bloqueado, true);
});

teste("42. [C1] Firestore vazio não quebra e não libera nada (cai para 'sem grounding', não para 'vigente')", () => {
  assert.equal(detectarDiretrizDinamica([], "qualquer tema", ""), null);
  const avaliacao = avaliarBloqueioDiretriz([], "qualquer tema", "");
  assert.equal(avaliacao.bloqueado, false);
  assert.equal(avaliacao.diretriz, null);
});

console.log(`\n${passou}/${passou + falhas.length} testes passaram.`);
if (falhas.length > 0) {
  console.log("\nFALHAS:");
  falhas.forEach(f => console.log(`- ${f.nome}: ${f.erro}`));
  process.exit(1);
}
