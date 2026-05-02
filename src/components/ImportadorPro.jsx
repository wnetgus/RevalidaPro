/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useCallback } from "react";
import { db } from "../firebase";
import { doc, setDoc, serverTimestamp, collection, query, where, getDocs } from "firebase/firestore";
import {
  FaPlus, FaTrash, FaImage, FaCode, FaThList,
  FaBookMedical, FaTimes, FaStethoscope, FaLightbulb,
  FaFlask, FaRocket, FaCheckCircle, FaExclamationTriangle,
  FaSave, FaEye, FaEyeSlash, FaCopy, FaCheck, FaUpload,
  FaMagic, FaSpinner, FaFire, FaBan
} from "react-icons/fa";
import { SUPER_APOSTAS_CONFIG } from "../config/superApostasConfig";

// ─── HELPER: PRÓXIMO NÚMERO DE QUESTÃO ────────────────────────
/**
 * Consulta a coleção "questoes" filtrando pelo provaId informado,
 * encontra o maior numeroQuestao existente e retorna o próximo.
 * Garante que novas questões sigam o padrão ANO_EDICAO_QNUMERO
 * sem gerar duplicidades nem sobrescrever documentos existentes.
 */
// FIX: substituída leitura de TODOS os documentos da edição por
// orderBy("numeroQuestao", "desc") + limit(1) — lê apenas 1 documento
// para encontrar o maior número. Requer índice composto no Firebase Console:
//   Coleção: questoes | Campos: provaId ASC, numeroQuestao DESC
// Sem o índice, o Firestore retorna erro e o fallback retorna 1.
// Busca o próximo numeroQuestao disponível no Firestore para a prova.
// Usa apenas where() sem orderBy para não depender de índice composto.
// saEdicao: quando informado, consulta por campo "edicao" (Super Apostas)
// em vez de "provaId" — porque questões SA têm provaId: "" no Firestore.
const obterProximoNumeroQuestao = async (provaId, saEdicao = null) => {
  try {
    const snap = await getDocs(
      saEdicao
        ? query(collection(db, "questoes"), where("edicao", "==", saEdicao))
        : query(collection(db, "questoes"), where("provaId", "==", provaId))
    );
    if (snap.empty) return 1;
    let maxNum = 0;
    snap.docs.forEach(d => {
      const num = d.data().numeroQuestao;
      if (typeof num === "number" && num > maxNum) maxNum = num;
    });
    return maxNum + 1;
  } catch (e) {
    console.error("Erro ao consultar próximo número de questão:", e);
    return 1;
  }
};

// ─── AUTO-DISTRIBUIÇÃO DE NÍVEL DE APOSTA (Super Apostas) ────────────────────
// Ciclo sempre: BAIXO → MEDIO → ALTO → BAIXO → ...
// Para lotes menores que 3, usa os últimos N do ciclo:
//   1 questão → ALTO
//   2 questões → MEDIO, ALTO
//   3+ questões → BAIXO, MEDIO, ALTO, BAIXO, MEDIO, ALTO, ...
const CICLO_NIVEIS_SA = ["BAIXO", "MEDIO", "ALTO"];
const atribuirNivelAposta = (indexQuestao, totalQuestoes) => {
  if (totalQuestoes <= 3) {
    return CICLO_NIVEIS_SA[(3 - totalQuestoes) + indexQuestao];
  }
  return CICLO_NIVEIS_SA[indexQuestao % 3];
};

// ─── STATUS DE ATUALIZAÇÃO DE DIRETRIZ ───────────────────────────────────────
// ano_diretriz >= 2024 → "atual" | < 2024 ou ausente → "revisar"
const calcularStatusAtualizacao = (ano_diretriz) => {
  if (!ano_diretriz || typeof ano_diretriz !== "number") return "revisar";
  return ano_diretriz >= 2024 ? "atual" : "revisar";
};

// ─── PROMPT PARA A IA GERAR QUESTÕES ───────────────────────────
const PROMPT_SISTEMA = `Você é um gerador de questões médicas para o Revalida INEP.
Responda SOMENTE com um array JSON. Nenhum texto antes. Nenhum texto depois. Sem markdown. Sem explicações.
Sua resposta deve começar com [ e terminar com ].

REGRA DE QUALIDADE OBRIGATÓRIA — DIRETRIZES ATUALIZADAS:
- Baseie TODAS as questões nas diretrizes mais recentes disponíveis (Ministério da Saúde, SUS, PCDT, FEBRASGO, CFM, SBC, SBPT, SBEM e demais sociedades médicas — priorizando publicações de 2023, 2024 ou 2025).
- Se a conduta descrita for de uma diretriz anterior a 2023, indique EXPLICITAMENTE no campo "raciocinio" ou no enunciado: "De acordo com as diretrizes de [ANO]..." ou "Segundo atualização de [ANO]...".
- Nunca descreva condutas desatualizadas sem esta sinalização explícita.
- Condutas baseadas em protocolos do SUS e Atenção Básica devem refletir o Caderno de Atenção Primária e Protocolos Clínicos vigentes.

Estrutura de cada questão no array:
{"materia":"string","subtema":"string","banca":"Revalida INEP","ano":"2025","numeroQuestao":1,"enunciado":"caso clínico completo","imagemUrl":"","alts":{"a":{"texto":"","nota":""},"b":{"texto":"","nota":""},"c":{"texto":"","nota":""},"d":{"texto":"","nota":""},"e":{"texto":"","nota":""}},"gabarito":"letra_correta","raciocinio":"fisiopatologia e raciocínio clínico baseado em diretriz atual","tto":"conduta completa e prescrição atualizada","dicaMestre":"regra de ouro para o Revalida","ano_diretriz":2024,"fonte_diretriz":"MS/SUS 2024"}

Regras:
- gabarito: apenas a letra (a, b, c, d ou e)
- todas as notas das alternativas devem explicar por que estão certas ou erradas segundo as diretrizes atuais
- enunciado deve ter dados clínicos reais (idade, sintomas, exames, contexto de APS/UBS/hospital)
- ano_diretriz: número inteiro com o ano da diretriz usada (ex: 2024). Obrigatório.
- fonte_diretriz: string com a fonte (ex: "MS/SUS 2024", "FEBRASGO 2023", "SBC 2025"). Obrigatório.
- responda APENAS com o array JSON, começando em [ e terminando em ]`;

// ─── MOCK INTELIGENTE BASEADO EM PALAVRAS-CHAVE ───────────────
// Mock inteligente baseado em palavras-chave — substituir por IA real posteriormente
// Para ativar IA real: configurar ANTHROPIC_API_KEY em functions/.env e descomentar
// o bloco "INTEGRAÇÃO REAL" em gerarViaIA.

/**
 * Normaliza texto removendo acentos e convertendo para minúsculas,
 * facilitando a comparação com palavras-chave.
 */
const normalizarTexto = (texto) =>
  texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/**
 * Detecta o tema médico a partir do prompt digitado pelo usuário.
 * Retorna a chave do BANCO_QUESTOES_MOCK correspondente, ou "geral" como fallback.
 */
const _detectarTema = (prompt) => {
  const t = normalizarTexto(prompt);
  if (/candid|candidias|corrimento|vulvovagini/.test(t)) return "candidíase";
  if (/hipertens|has|pressao alta|crise hipertensiva|emergencia hipertensiva/.test(t)) return "hipertensão";
  if (/diabet|dm2|dm1|glicemia|insulina|hipoglicemia|cetoacidose/.test(t)) return "diabetes";
  if (/infart|iamcsst|iamssst|sindrome coronariana|angina|coronari/.test(t)) return "infarto";
  if (/avc|acidente vascular|isquemia cerebral|hemorragia cerebral|stroke|trombose cerebral/.test(t)) return "AVC";
  if (/pneumoni|lobar|broncopneumoni|atipica|community.acquired/.test(t)) return "pneumonia";
  if (/sepse|sepsis|choque septico|bacteremia|sirs/.test(t)) return "sepse";
  if (/dengue|aedes|arboviros|chikungunya/.test(t)) return "dengue";
  if (/tuberculos|tb|bk|bacilo de koch|escarro|ppd/.test(t)) return "tuberculose";
  if (/dpoc|doenca pulmonar obstrutiva|enfisema|bronquite cronica|espirometria/.test(t)) return "DPOC";
  if (/insuficiencia cardiaca|ic descompensada|ic aguda|b3|kerley|dispneia cardiaca/.test(t)) return "IC";
  if (/tep|tromboembolismo|embolia pulmonar|trombose venosa|dvt|wells/.test(t)) return "TEP";
  if (/asma|broncoespasmo|crise asmatica|beta.agonista|salbutamol/.test(t)) return "asma";
  if (/irc|insuficiencia renal|creatinina|kdigo|dialise|hemodialise/.test(t)) return "IRC";
  if (/apendicite|abdome agudo inflamatorio|mcburney|blumberg/.test(t)) return "apendicite";
  if (/anemia|hemoglobina|ferropriva|megaloblastica|hemolitica/.test(t)) return "anemia";
  if (/hipotireoidismo|tireoidite|hashimoto|levotiroxina|tsh/.test(t)) return "hipotireoidismo";
  if (/hipertireoidismo|basedow|graves|tireotoxicose|propiltiouracil/.test(t)) return "hipertireoidismo";
  if (/meningite|meningismo|kernig|brudzinski|liquor|lcr/.test(t)) return "meningite";
  return "geral";
};

/**
 * Banco de questões mock indexado por tema.
 * Cada tema contém pelo menos 1 questão no formato flat (com alternativaA..E e justificativaA..E).
 * Os campos id, ano, provaId e isOficial são preenchidos dinamicamente em gerarViaIA.
 */
const BANCO_QUESTOES_MOCK = {
  "candidíase": [
    {
      numeroQuestao: 1,
      materia: "Ginecologia e Obstetrícia",
      subtema: "Infecções Genitais / Candidíase Vulvovaginal",
      banca: "Revalida INEP",
      imagemUrl: "",
      instituicao: "INEP",
      enunciado: "Mulher, 28 anos, procura UBS com queixa de prurido vulvar intenso, ardência ao urinar e corrimento esbranquiçado com aspecto de 'leite coalhado' há 5 dias. Refere uso de antibiótico de amplo espectro nas últimas 2 semanas por infecção urinária. Ao exame especular: mucosa vaginal hiperemiada, eritema vulvar, corrimento branco espesso aderido às paredes vaginais. pH vaginal = 4,2. Qual é a conduta mais adequada?",
      alternativaA: "Metronidazol 500 mg VO 12/12h por 7 dias.",
      alternativaB: "Fluconazol 150 mg VO dose única ou miconazol creme vaginal por 7 dias.",
      alternativaC: "Azitromicina 1 g VO dose única.",
      alternativaD: "Doxiciclina 100 mg VO 12/12h por 14 dias.",
      alternativaE: "Penicilina G benzatina 2,4 milhões UI IM dose única.",
      gabarito: "b",
      justificativaA: "INCORRETA. Metronidazol trata vaginose bacteriana (pH >4,5, clue cells, odor de peixe) e tricomoníase. Não tem ação antifúngica.",
      justificativaB: "CORRETA. Candidíase vulvovaginal não complicada: fluconazol 150 mg VO dose única (primeira escolha oral) ou antifúngico tópico (miconazol, clotrimazol) por 3–7 dias. O contexto clínico — antibiótico prévio, pH ácido, corrimento caseoso, prurido — confirma o diagnóstico.",
      justificativaC: "INCORRETA. Azitromicina é usada para infecções por Chlamydia trachomatis e Mycoplasma. Não tem ação antifúngica.",
      justificativaD: "INCORRETA. Doxiciclina trata clamídia, micoplasma e outras infecções bacterianas. Sem indicação em candidíase.",
      justificativaE: "INCORRETA. Penicilina G benzatina trata sífilis. Não há indicação aqui.",
      raciocinio: "Candidíase vulvovaginal não complicada: tríade clássica — prurido vulvar + corrimento branco caseoso (leite coalhado) + pH vaginal ácido (<4,5). Fator precipitante: antibioticoterapia prévia que altera a microbiota vaginal. Diagnóstico clínico-laboratorial (microscopia com pseudohifas/blastosporos, pH, whiff test negativo). Tratamento: azóis.",
      tto: "Não complicada: fluconazol 150 mg VO dose única OU miconazol 2% creme vaginal × 7 noites OU clotrimazol 100 mg vaginal × 7 noites. Complicada/recorrente (≥4 episódios/ano): fluconazol 150 mg VO D1, D4, D7 → manutenção fluconazol 150 mg semanal × 6 meses. Gestante: apenas tópico (imidazólicos), contraindicado fluconazol sistêmico no 1º trimestre.",
      dicaMestre: "pH vaginal é a chave do diagnóstico diferencial: candidíase pH <4,5 (ácido) | vaginose bacteriana pH >4,5 + clue cells + odor amínico | tricomoníase pH >4,5 + mobilidade ao exame. Candidíase = antifúngico azólico. Antibiótico prévio + prurido + coalhada = candidíase.",
    },
  ],
  "hipertensão": [
    {
      numeroQuestao: 1,
      materia: "Clínica Médica",
      subtema: "Cardiologia / Hipertensão Arterial Sistêmica",
      banca: "Revalida INEP",
      imagemUrl: "",
      instituicao: "INEP",
      enunciado: "Homem, 55 anos, hipertenso há 10 anos, em uso de enalapril 10 mg/dia, comparece ao PS com cefaleia occipital intensa, visão turva e PA 220/130 mmHg. Ao exame neurológico: sem déficits focais. Fundo de olho: papiledema bilateral. ECG: sobrecarga ventricular esquerda. Creatinina 1,8 mg/dL (basal 1,0 mg/dL). Qual é o diagnóstico e a conduta imediata?",
      alternativaA: "Urgência hipertensiva; administrar captopril 25 mg SL e observar por 2 horas na sala de espera.",
      alternativaB: "Emergência hipertensiva com encefalopatia hipertensiva; internação em UTI e nitroprussiato de sódio EV com redução de PA em 25% na 1ª hora.",
      alternativaC: "Crise hipertensiva sintomática; dobrar a dose do enalapril e aguardar efeito por 30 minutos.",
      alternativaD: "Emergência hipertensiva; nifedipino sublingual para redução rápida da PA.",
      alternativaE: "Urgência hipertensiva; alta hospitalar com ajuste da medicação oral e retorno ambulatorial em 48 horas.",
      gabarito: "b",
      justificativaA: "INCORRETA. A presença de papiledema e lesão de órgão-alvo aguda (rim, olho) caracteriza EMERGÊNCIA, não urgência. Urgência hipertensiva é PA muito elevada SEM lesão aguda.",
      justificativaB: "CORRETA. Emergência hipertensiva (LOA aguda: papiledema + nefropatia aguda + SVE). UTI com nitroprussiato IV titulável. Meta: reduzir PAM em ≤25% na 1ª hora — redução abrupta causa isquemia cerebral/coronariana.",
      justificativaC: "INCORRETA. Dobrar IECA oral não tem ação rápida suficiente para emergência hipertensiva. Requer droga IV.",
      justificativaD: "INCORRETA. Nifedipino SL é contraindicado — causa queda abrupta e imprevisível da PA, com risco de AVC e IAM isquêmico.",
      justificativaE: "INCORRETA. Alta hospitalar é conduta para urgência estável sem LOA. Este paciente tem lesão de órgão-alvo ativa.",
      raciocinio: "Diferenciação crucial: Urgência hipertensiva = PA muito elevada SEM lesão aguda de órgão-alvo → redução gradual em 24–48h com VO. Emergência hipertensiva = PA muito elevada COM LOA aguda (encefalopatia, AVC, EAP, IAM, dissecção, nefropatia, retinopatia grave) → redução controlada em minutos/horas com IV em UTI. Papiledema = LOA ocular grave = EMERGÊNCIA.",
      tto: "UTI imediata. Nitroprussiato de sódio 0,3–10 mcg/kg/min IV (1ª escolha para maioria das emergências). Alternativas: nicardipina IV (AVC), labetalol IV (dissecção, gestante), hidralazina IV (gestante). Meta 1ª hora: reduzir PAM em 25%. Meta 2–6h: PA <160/100. Meta 24–48h: normalização gradual. Monitorar função renal, neurológica e cardiovascular continuamente.",
      dicaMestre: "EMERGÊNCIA hipertensiva: PA + LOA aguda → UTI + droga IV. URGÊNCIA: PA elevada sem LOA → VO + observação. NUNCA nifedipino SL (queda brusca = AVC/IAM). Nitroprussiato = ouro para emergência geral. A redução agressiva é tão perigosa quanto a PA alta — hipoperfusão causa AVC.",
    },
  ],
  "diabetes": [
    {
      numeroQuestao: 1,
      materia: "Clínica Médica",
      subtema: "Endocrinologia / Cetoacidose Diabética",
      banca: "Revalida INEP",
      imagemUrl: "",
      instituicao: "INEP",
      enunciado: "Paciente de 19 anos, diabético tipo 1 há 5 anos, chega ao PS em mal-estar geral, náuseas, vômitos e dor abdominal difusa há 12 horas. Relata suspensão da insulina há 2 dias por 'falta de dinheiro'. Exame físico: Glasgow 14, FC 118 bpm, FR 28 irpm com respiração de Kussmaul, desidratação moderada, hálito cetônico. Gasometria: pH 7,22, HCO3 10 mEq/L, pCO2 26 mmHg. Glicemia 420 mg/dL. Sódio 132 mEq/L. Potássio 5,8 mEq/L. Qual é a primeira conduta após acesso venoso?",
      alternativaA: "Administrar insulina regular 0,1 UI/kg/h em bomba de infusão contínua imediatamente.",
      alternativaB: "Iniciar hidratação vigorosa com SF 0,9% 1 L na primeira hora antes de qualquer insulina.",
      alternativaC: "Administrar bicarbonato de sódio IV para corrigir a acidose antes de iniciar insulina.",
      alternativaD: "Iniciar insulina NPH SC conforme esquema basal e aguardar melhora.",
      alternativaE: "Realizar diálise de urgência para correção dos distúrbios eletrolíticos.",
      gabarito: "b",
      justificativaA: "INCORRETA. Insulina antes de hidratação pode piorar hipocalemia (K+ entra na célula), causando arritmias. A hidratação deve preceder a insulinoterapia.",
      justificativaB: "CORRETA. Hidratação com SF 0,9% 1 L/h na 1ª hora é o primeiro passo na CAD. Expande volume, melhora perfusão renal, dilui hiperglicemia e corrige acidose parcialmente. Insulina só após repor K+ se <3,5 mEq/L.",
      justificativaC: "INCORRETA. Bicarbonato está contraindicado na CAD exceto em casos de pH <6,9. Piora hipocalemia, prejudica liberação de O2 pela Hb e pode causar edema cerebral.",
      justificativaD: "INCORRETA. Insulina NPH SC não tem absorção previsível em paciente desidratado e em cetoacidose. Requer insulina regular IV em bomba.",
      justificativaE: "INCORRETA. Diálise não é indicação em CAD. O K+ de 5,8 mEq/L é esperado na entrada (redistribuição), mas o K+ corporal total está baixo — com insulina + hidratação cairá.",
      raciocinio: "Tríade diagnóstica da CAD: hiperglicemia >250 + acidose metabólica (pH<7,3, HCO3<18) + cetonemia/cetonúria. Respiração de Kussmaul = hiperventilação compensatória da acidose. K+ sérico elevado na admissão ≠ K+ corporal total elevado (é redistribuição por acidose). Sequência: hidratação → insulina → reposição de K+.",
      tto: "1. Hidratação: SF 0,9% 1 L/h × 1–2h → ajustar conforme estado volêmico. 2. Insulina regular: 0,1 UI/kg/h IV (iniciar APÓS K+>3,5 mEq/L). 3. Reposição de K+: se K+ 3,5–5,5 → 20–40 mEq/h IV. 4. Monitorar: glicemia 1/1h, eletrólitos 2/2h, gasometria. 5. Meta: glicemia 200–250 → trocar SF para SG5% + insulina. Critérios de resolução: pH>7,3, HCO3>18, ânion gap normalizado.",
      dicaMestre: "CAD = Hidratar ANTES de insulinar. K+<3,5 → NÃO insulinar (risco arritmia fatal). Bicarbonato: NUNCA rotina — só pH<6,9. Edema cerebral: complicação mais temida, especialmente em crianças. Glicemia pode normalizar antes do ânion gap — não suspender insulina cedo. Monitorar 1/1h.",
    },
  ],
  "infarto": [
    {
      numeroQuestao: 1,
      materia: "Clínica Médica",
      subtema: "Cardiologia / Síndrome Coronariana Aguda",
      banca: "Revalida INEP",
      imagemUrl: "",
      instituicao: "INEP",
      enunciado: "Homem, 62 anos, hipertenso, diabético, tabagista 40 anos-maço, chega ao PS com dor precordial opressiva irradiando para membro superior esquerdo e mandíbula, iniciada há 90 minutos, com sudorese fria. PA 145/90 mmHg, FC 92 bpm, SatO2 96%. ECG: supradesnivelamento de ST de 3 mm em D2, D3 e aVF, com imagem em espelho em V1–V2. Troponina I: indeterminado (coleta na chegada). O hospital não possui hemodinâmica. Qual é a conduta prioritária?",
      alternativaA: "Aguardar segunda troponina em 3 horas para confirmar o diagnóstico antes de qualquer intervenção.",
      alternativaB: "Iniciar fibrinólise com tenecteplase imediatamente e transferir para centro com hemodinâmica para estratégia fármaco-invasiva.",
      alternativaC: "Administrar heparina não fracionada IV, AAS e clopidogrel e aguardar transferência sem trombolítico.",
      alternativaD: "Indicar cirurgia de revascularização miocárdica de urgência sem tentar reperfusão clínica prévia.",
      alternativaE: "Transferir o paciente para centro com hemodinâmica sem iniciar nenhuma terapia farmacológica.",
      gabarito: "b",
      justificativaA: "INCORRETA. IAM com supra de ST é diagnóstico eletrocardiográfico — NÃO aguardar troponina para decidir reperfusão. Cada minuto de atraso aumenta mortalidade.",
      justificativaB: "CORRETA. IAM com supra de ST inferior (D2, D3, aVF) confirmado pelo ECG. Sem hemodinâmica disponível → fibrinólise imediata se sem contraindicações + janela <12h. Estratégia fármaco-invasiva: angiografia em 3–24h após trombólise bem-sucedida.",
      justificativaC: "INCORRETA. Anticoagulação e antiplaquetários são adjuvantes, mas sem reperfusão o músculo continua isquêmico. Transferência sem fibrinólise só se tempo porta-balão viável ≤120 min.",
      justificativaD: "INCORRETA. CRM de urgência sem tentativa de reperfusão clínica não é conduta padrão para IAM com supra em fase aguda.",
      justificativaE: "INCORRETA. Transferir sem terapia de reperfusão é conduta inadequada quando a fibrinólise está indicada e o transporte levará >120 min.",
      raciocinio: "IAM com supra de ST inferior (território da CD — coronária direita). Imagem em espelho em V1–V2 confirma extensão posterior. Estratégia de reperfusão: ICP primária (preferida se disponível em ≤120 min da chegada). Sem hemodinâmica → fibrinólise se janela ≤12h e sem contraindicações. Estratégia fármaco-invasiva: angiografia obrigatória nas 24h seguintes.",
      tto: "Imediato: AAS 200–300 mg VO (mastigar), ticagrelor 180 mg ou clopidogrel 300 mg, anticoagulação (enoxaparina ou HNF). Fibrinólise: tenecteplase IV peso-ajustada (dose única). Critérios de reperfusão bem-sucedida: alívio da dor, queda do supra ≥50% em 90 min, pico precoce de enzimas. Falha → angioplastia de resgate. Adjuvantes: betabloqueador (exceto se Killip III/IV), IECA, estatina de alta intensidade.",
      dicaMestre: "Supra de ST = DIAGNÓSTICO ELETROCARDIOGRÁFICO. Não esperar enzimas. Janela de ouro: ICP <120 min OU fibrinólise <30 min da chegada. Inferior (D2D3aVF) → pesquisar extensão para VD (V3R-V4R: supra = IAM de VD). IAM de VD: CONTRAINDICADO nitrato (causa hipotensão grave). Reperfusão = miocárdio salvo.",
    },
  ],
  "AVC": [
    {
      numeroQuestao: 1,
      materia: "Clínica Médica",
      subtema: "Neurologia / Acidente Vascular Cerebral Isquêmico",
      banca: "Revalida INEP",
      imagemUrl: "",
      instituicao: "INEP",
      enunciado: "Mulher, 71 anos, hipertensa e fibrilante (em uso de warfarina, último INR 1,4 há 3 semanas), é trazida pela família com afasia de expressão, hemiplegia braquiofacial direita e desvio do olhar conjugado para a esquerda, com início há 2 horas e 15 minutos. Ao exame: PA 168/95 mmHg, FC 88 bpm (irregular), Glasgow 14. TC de crânio sem contraste: sem hemorragia, sem hipodensidade precoce. INR atual: 1,4. Qual é a conduta mais adequada?",
      alternativaA: "Contraindicar trombólise devido à anticoagulação com warfarina e encaminhar para anticoagulação plena imediata.",
      alternativaB: "Administrar alteplase 0,9 mg/kg IV (máx 90 mg) imediatamente, com 10% em bolus e restante em 60 minutos.",
      alternativaC: "Aguardar angiotomografia e avaliação de trombectomia mecânica antes de qualquer decisão terapêutica.",
      alternativaD: "Reverter anticoagulação com vitamina K IV e aguardar normalização do INR antes de qualquer reperfusão.",
      alternativaE: "Iniciar heparina IV plena para prevenir progressão do trombo coronário.",
      gabarito: "b",
      justificativaA: "INCORRETA. INR ≤1,7 não contraindica alteplase. A contraindicação é INR >1,7 em paciente anticoagulado. Este INR de 1,4 permite trombólise.",
      justificativaB: "CORRETA. AVC isquêmico agudo em janela de 4,5h, INR 1,4 (≤1,7 → trombólise permitida), PA controlável, sem hemorragia na TC. Alteplase IV é a conduta padrão-ouro.",
      justificativaC: "INCORRETA. A angiotomografia e avaliação para trombectomia podem ser feitas em paralelo, mas não devem retardar a trombólise se indicada. Trombectomia é complementar, não substituta.",
      justificativaD: "INCORRETA. Aguardar reversão do INR implica perder a janela terapêutica. Com INR 1,4, a trombólise é segura.",
      justificativaE: "INCORRETA. Heparina IV não está indicada na fase aguda do AVC isquêmico — aumenta risco hemorrágico sem benefício comprovado na reperfusão.",
      raciocinio: "AVC isquêmico agudo com síndrome do lobo frontal esquerdo / artéria cerebral média esquerda (afasia + hemiplegia braquiofacial direita + desvio conjugado ipsilateral à lesão). Janela 2h15min < 4,5h. Critérios para alteplase: início ≤4,5h, sem hemorragia na TC, PA <185/110 mmHg (controlável), INR ≤1,7, plaquetas >100.000. Todos preenchidos.",
      tto: "Alteplase 0,9 mg/kg IV (máx 90 mg): 10% bolus em 1 min + 90% em 60 min. PA: manter <180/105 durante e após infusão. Monitorar neurológico 15/15min durante trombólise, 30/30min × 6h, depois 1/1h × 16h. Não anticoagular e não usar AAS por 24h após alteplase. Trombectomia mecânica: se oclusão de grande vaso confirmada (angioTC) em janela ≤24h, pode ser feita em paralelo/após.",
      dicaMestre: "Janela do AVC isquêmico: alteplase ≤4,5h. Contraindicações absolutas: hemorragia na TC, INR>1,7, plaquetas<100k, glicemia<50 ou >400, PA incontrolável >185/110. PA-alvo: não reduzir agressivamente antes da trombólise (perfusão de penumbra depende de PA). Pós-alteplase: NÃO anticoagular por 24h. Fibrilação atrial = principal causa cardioembólica.",
    },
  ],
  "pneumonia": [
    {
      numeroQuestao: 1,
      materia: "Clínica Médica",
      subtema: "Pneumologia / Pneumonia Adquirida na Comunidade",
      banca: "Revalida INEP",
      imagemUrl: "",
      instituicao: "INEP",
      enunciado: "Homem, 67 anos, tabagista, DPOC leve, apresenta febre 38,8°C, tosse produtiva com expectoração purulenta e amarelada, dispneia moderada e dor pleurítica em hemitórax esquerdo há 4 dias. Exame: FR 26 irpm, FC 102 bpm, PA 118/74 mmHg, SatO2 91%, confusão mental leve. Radiografia: opacidade heterogênea em lobo inferior esquerdo com broncograma aéreo. Ureia 58 mg/dL. Qual é a classificação pelo CURB-65 e a conduta indicada?",
      alternativaA: "CURB-65 = 1 ponto; tratamento ambulatorial com amoxicilina VO por 5 dias.",
      alternativaB: "CURB-65 = 3 pontos (confusão + ureia elevada + FR≥30); internação em enfermaria com antibioticoterapia EV.",
      alternativaC: "CURB-65 = 4 pontos; internação em UTI imediata com piperacilina-tazobactam + vancomicina.",
      alternativaD: "CURB-65 = 2 pontos; considerar internação breve ou tratamento ambulatorial supervisionado.",
      alternativaE: "CURB-65 = 5 pontos; ventilação mecânica imediata e cobertura para Pseudomonas.",
      gabarito: "b",
      justificativaA: "INCORRETA. CURB-65 = 1 seria para paciente sem confusão, sem ureia elevada e sem FR≥30. Este paciente tem múltiplos critérios.",
      justificativaB: "CORRETA. CURB-65: Confusão (1) + Ureia >19 mmol/L [58 mg/dL → ~10 mmol/L, borderline mas considerar] + FR 26 (abaixo de 30, não pontua) + PA normal + idade 67 (≥65, 1 ponto) = 2–3 pontos. Com SatO2 91% e confusão, internação é mandatória. Cobertura PAC típica + atípica: amoxicilina-clavulanato IV + azitromicina, ou fluoroquinolona respiratória.",
      justificativaC: "INCORRETA. CURB-65 = 4 ou critérios de PAC grave (ATS/IDSA) indicam UTI, mas este paciente não tem choque séptico nem necessidade de VM.",
      justificativaD: "INCORRETA. Subestima a gravidade. Confusão mental + SatO2 91% + DPOC = internação, não ambulatorial.",
      justificativaE: "INCORRETA. Sem critérios de ventilação mecânica imediata (sem IRpA grave, sem Glasgow <8, sem choque).",
      raciocinio: "PAC no idoso: confusão mental pode ser único sinal de gravidade. CURB-65: Confusion, Ureia>50mg/dL, Respiratory rate≥30, BP<90/60, age≥65. 0–1: ambulatorial; 2: considerar internação; ≥3: internamento; ≥4: avaliar UTI. SatO2 91% em DPOC pode ser aceitável, mas com confusão exige cuidado intensivo.",
      tto: "Internação: amoxicilina-clavulanato 1,2 g IV 8/8h + azitromicina 500 mg IV/VO 1x/dia OU fluoroquinolona respiratória (levofloxacino 500 mg IV/VO). Duração: 5–7 dias. Oxigenioterapia: SatO2 alvo 92–96% (DPOC: 88–92%). Fisioterapia respiratória. Critérios de alta: 24h afebril, SatO2 estável, ingesta oral adequada.",
      dicaMestre: "CURB-65 ≥2 = internação. Pneumonia + confusão no idoso = GRAVE. PAC com DPOC: cobrir também Haemophilus e Moraxella (beta-lactâmico). UTI: 2 critérios maiores (VM ou vasopressor) OU 3 menores (FR≥30, PaO2/FiO2<250, infiltrado multilobar, confusão, ureia>20 mmol, leucopenia, plaquetopenia, hipotermia, hipotensão).",
    },
  ],
  "sepse": [
    {
      numeroQuestao: 1,
      materia: "Clínica Médica",
      subtema: "Terapia Intensiva / Sepse e Choque Séptico",
      banca: "Revalida INEP",
      imagemUrl: "",
      instituicao: "INEP",
      enunciado: "Mulher, 72 anos, diabética e imunossuprimida por corticoterapia crônica, admitida com febre 39,5°C, calafrios, confusão mental e disúria há 2 dias. Exame: PA 82/50 mmHg, FC 124 bpm, FR 28 irpm, SatO2 93%, extremidades frias, tempo de enchimento capilar 4 segundos. Lactato sérico: 4,2 mmol/L. Urina 1: piúria e bacteriúria maciça. Qual é o diagnóstico e a prioridade nas próximas 3 horas (bundle de sepse)?",
      alternativaA: "Sepse sem choque; coletar culturas e iniciar antibiótico oral empírico em 6 horas.",
      alternativaB: "Choque séptico; coletar 2 hemoculturas, dosar lactato, iniciar cristalóide 30 mL/kg IV em 3 horas e antibioticoterapia EV em 1 hora.",
      alternativaC: "Choque séptico; aguardar resultado de urocultura antes de iniciar antibiótico para cobertura dirigida.",
      alternativaD: "Síndrome febril inespecífica; hidratação oral e antipirético.",
      alternativaE: "Sepse; iniciar noradrenalina imediatamente como primeira medida antes da ressuscitação volêmica.",
      gabarito: "b",
      justificativaA: "INCORRETA. Lactato 4,2 mmol/L + hipotensão + disfunção orgânica = CHOQUE SÉPTICO, não sepse sem choque. Antibiótico oral em 6h é conduta inadequada.",
      justificativaB: "CORRETA. Bundle de 1h da Surviving Sepsis Campaign: (1) medir lactato; (2) coletar 2 hemoculturas antes do ATB; (3) ATB EV de amplo espectro em ≤1h; (4) cristaloide 30 mL/kg para hipotensão ou lactato≥4; (5) vasopressor se PA não responder. Lactato≥4 = choque séptico críptico.",
      justificativaC: "INCORRETA. NUNCA aguardar culturas para iniciar ATB em choque séptico. Cada hora de atraso aumenta mortalidade ~7%.",
      justificativaD: "INCORRETA. Paciente em choque (hipotensão + má perfusão + lactato 4,2). Hidratação oral é insuficiente e perigosa.",
      justificativaE: "INCORRETA. Vasopressor (noradrenalina) é indicado APÓS ou concomitante à ressuscitação volêmica, não como primeira medida isolada sem volume.",
      raciocinio: "Choque séptico (Sepsis-3): sepse com necessidade de vasopressor para manter PAM≥65 + lactato>2 mmol/L após ressuscitação volêmica. Foco: ITU alta (pielonefrite) em imunossuprimida. Bundle 1h: lactato, hemoculturas, ATB EV, cristaloide 30 mL/kg. Noradrenalina: PAM<65 refratária ao volume.",
      tto: "Bundle 1h: 1. Lactato sérico. 2. Hemoculturas ×2 (sem atrasar ATB>45min). 3. ATB: piperacilina-tazobactam 4,5g IV 6/6h ou meropeném 1g IV 8/8h (imunossuprimida). 4. Cristaloide 30 mL/kg em ≤3h. 5. Noradrenalina se PAM<65 após volume: dose inicial 0,1–0,2 mcg/kg/min. Meta: PAM≥65, lactato clearance ≥10%/2h, diurese≥0,5 mL/kg/h. Corticoterapia: hidrocortisona 200 mg/dia se choque refratário.",
      dicaMestre: "Surviving Sepsis 1h: Lactato + Culturas + ATB em 1h + Cristaloide 30 mL/kg + Vasopressor se refratário. Lactato>4 = CHOQUE independente da PA. Noradrenalina = vasopressor de escolha no choque séptico. Meta PAM≥65 mmHg. Cada hora de atraso no ATB = 7% de aumento na mortalidade.",
    },
  ],
  "dengue": [
    {
      numeroQuestao: 1,
      materia: "Clínica Médica",
      subtema: "Infectologia / Dengue",
      banca: "Revalida INEP",
      imagemUrl: "",
      instituicao: "INEP",
      enunciado: "Homem, 34 anos, procura UPA em área endêmica durante epidemia de dengue. Refere febre alta (39,5°C) há 4 dias, mialgia intensa, cefaleia retroorbitária, exantema maculopapular em tronco e membros. Hoje, no 5º dia, iniciou dor abdominal intensa e persistente, vômitos incoercíveis e sangramento gengival. Exame: PA 100/70 mmHg, FC 102 bpm, enchimento capilar 3 segundos. Hematócrito: 48% (basal estimado 40%). Plaquetas: 68.000/mm³. Qual é a classificação e conduta?",
      alternativaA: "Dengue clássico (Grupo A); analgesia com dipirona, hidratação oral e alta com orientações.",
      alternativaB: "Dengue com sinais de alarme (Grupo C); internação imediata, hidratação venosa com cristaloide e monitorização rigorosa.",
      alternativaC: "Dengue grave (Grupo D); iniciar heparina para evitar CID e transferência para UTI.",
      alternativaD: "Dengue com sinais de alarme; prescrever AAS para controle térmico e analgesia.",
      alternativaE: "Dengue clássico; hemograma controle em 48 horas em ambulatório.",
      gabarito: "b",
      justificativaA: "INCORRETA. Presença de sinais de alarme (dor abdominal intensa, vômitos incoercíveis, sangramento, hemoconcentração, plaquetopenia grave) classifica como Grupo C, não Grupo A.",
      justificativaB: "CORRETA. Sinais de alarme do Ministério da Saúde: dor abdominal intensa, vômitos persistentes, acúmulo de líquidos, sangramento de mucosas, letargia, hepatomegalia, hematócrito aumentando + plaquetas caindo. Grupo C = internação + hidratação IV cristaloide (10 mL/kg em 1h, reavaliação).",
      justificativaC: "INCORRETA. Grupo D (dengue grave) exige extravasamento grave, choque ou hemorragia grave. Este paciente tem sinais de alarme mas ainda não atingiu critérios de Grupo D. Heparina não é indicada rotineiramente.",
      justificativaD: "INCORRETA. AAS é CONTRAINDICADO na dengue — inibe agregação plaquetária e aumenta risco hemorrágico em paciente já com plaquetopenia.",
      justificativaE: "INCORRETA. Sinais de alarme exigem internação imediata, não seguimento ambulatorial.",
      raciocinio: "Classificação MS: Grupo A (sem sinais de alarme, sem comorbidade) → ambulatorial; Grupo B (sem alarme com comorbidade, sangramento pele apenas) → observação; Grupo C (sinais de alarme) → internação e hidratação IV; Grupo D (dengue grave: choque, hemorragia grave, disfunção orgânica) → UTI. O período crítico é a defervescência (3º–5º dia): extravasamento plasma, queda de plaquetas, hemoconcentração.",
      tto: "Grupo C: cristaloide 10 mL/kg em 1h → reavaliar → repetir se necessário. Hematócrito: monitorar 2/2h. Hidratação: 50–100 mL/kg/24h conforme tolerância. CONTRAINDICADOS: AAS, anti-inflamatórios não esteroidais, anticoagulantes. Dipirona ou paracetamol para sintomáticos. Transfusão plaquetária: só se <20.000 ou sangramento ativo grave.",
      dicaMestre: "Dengue: AINEs e AAS CONTRAINDICADOS (plaquetopenia + risco hemorrágico). Sinais de alarme = internação obrigatória. Período crítico = defervescência (3°–5° dia). Hemoconcentração + plaquetopenia + dor abdominal = padrão do alarme. Grupo D (choque) = UTI + cristaloide agressivo. Nunca transfundir plaquetas profilático se >20.000 sem sangramento.",
    },
  ],
  "tuberculose": [
    {
      numeroQuestao: 1,
      materia: "Clínica Médica",
      subtema: "Infectologia / Tuberculose Pulmonar",
      banca: "Revalida INEP",
      imagemUrl: "",
      instituicao: "INEP",
      enunciado: "Homem, 38 anos, morador de albergue, HIV positivo com CD4 de 180 células/mm³ (em TARV irregular), procura UBS com tosse produtiva há 8 semanas, perda ponderal de 8 kg, sudorese noturna e febre vespertina. Radiografia de tórax: infiltrado apical bilateral com cavitações. Baciloscopia de escarro: BAAR positivo 3+. Qual é a conduta?",
      alternativaA: "Iniciar TARV otimizada imediatamente e aguardar para depois iniciar o tratamento da tuberculose.",
      alternativaB: "Notificar compulsoriamente, iniciar esquema RIPE (rifampicina + isoniazida + pirazinamida + etambutol) imediatamente e iniciar/otimizar TARV em 2 semanas.",
      alternativaC: "Aguardar cultura e antibiograma completo antes de iniciar tratamento empírico.",
      alternativaD: "Iniciar apenas isoniazida em monoterapia como tratamento preventivo.",
      alternativaE: "Encaminhar diretamente para cirurgia torácica dado o padrão cavitário bilateral.",
      gabarito: "b",
      justificativaA: "INCORRETA. TB é prioridade — deve ser iniciada imediatamente. TARV deve ser otimizada em 2 semanas (CD4<50: iniciar TARV em 2 semanas; CD4≥50: iniciar em 8 semanas, mas HIV+TB sempre tratar TB primeiro).",
      justificativaB: "CORRETA. Tuberculose bacilífera confirmada (BAAR 3+): notificação compulsória imediata + isolamento respiratório + RIPE por 6 meses (2 meses RIPE + 4 meses RI). HIV+TB com CD4<200: iniciar TARV em 2 semanas.",
      justificativaC: "INCORRETA. Aguardar cultura (4–8 semanas) em TB pulmonar bacilífera com quadro clássico é conduta equivocada. O tratamento é baseado na baciloscopia positiva.",
      justificativaD: "INCORRETA. Isoniazida em monoterapia (TPI) é para tuberculose latente (ILTB), não para TB ativa.",
      justificativaE: "INCORRETA. Cirurgia não é indicação primária de TB pulmonar. Reservada para TB multirresistente, hemoptise maciça ou destruição pulmonar.",
      raciocinio: "TB pulmonar ativa (síndrome B + BAAR + radiografia clássica) em imunossuprimido (HIV, CD4=180). Prioridades: isolamento respiratório, notificação compulsória, RIPE imediato, TARV. Síndrome de reconstituição imune (SIRI): risco ao iniciar TARV logo após RIPE — monitorar. CD4<50: TARV em 2 semanas. CD4≥50: TARV em 8 semanas.",
      tto: "RIPE: Rifampicina 600mg + Isoniazida 400mg + Pirazinamida 2g + Etambutol 1200mg em dose única diária em jejum × 2 meses → RI × 4 meses. HIV+: TARV 2 semanas após RIPE (CD4<50) ou 8 semanas (CD4≥50). Notificação compulsória no SINAN. Isolamento respiratório até BAAR negativo em 2 amostras. Testagem de contatos. Vitamina B6 (piridoxina) para prevenir neuropatia por isoniazida.",
      dicaMestre: "RIPE = 2+4. TB + HIV: sempre tratar TB primeiro, TARV depois (2 semanas se CD4<50, 8 semanas se CD4≥50). BAAR+ = tratamento imediato sem esperar cultura. Notificação COMPULSÓRIA. Isolamento até 2 baciloscopias negativas. Rifampicina = indutor enzimático potente (reduz níveis de inibidores de protease — usar efavirenz na TARV).",
    },
  ],
  "DPOC": [
    {
      numeroQuestao: 1,
      materia: "Clínica Médica",
      subtema: "Pneumologia / DPOC — Exacerbação Aguda",
      banca: "Revalida INEP",
      imagemUrl: "",
      instituicao: "INEP",
      enunciado: "Homem, 70 anos, tabagista 50 anos-maço, DPOC GOLD III em uso de tiotrópio e formoterol, admitido com piora progressiva da dispneia há 3 dias, aumento do volume e purulência do escarro. Exame: FR 30 irpm, FC 110 bpm, SatO2 83% em ar ambiente, uso de musculatura acessória, tórax em barril, ausculta com sibilos difusos. Gasometria (ar ambiente): pH 7,28, PaCO2 62 mmHg, PaO2 48 mmHg, HCO3 28 mEq/L. Qual é a conduta mais adequada?",
      alternativaA: "Oxigênio por máscara não reinalante a 15 L/min e aguardar melhora.",
      alternativaB: "Ventilação não invasiva (VNI/BiPAP) com IPAP/EPAP, oxigênio controlado (alvo SatO2 88–92%) e broncodilatadores + corticoide sistêmico.",
      alternativaC: "Intubação orotraqueal imediata e ventilação mecânica invasiva.",
      alternativaD: "Alta com antibiótico oral e broncodilatador de resgate, retorno se piora.",
      alternativaE: "Oxigênio em cateter nasal a 5 L/min sem suporte ventilatório adicional.",
      gabarito: "b",
      justificativaA: "INCORRETA. Oxigênio em alta concentração em DPOC com hipercapnia crônica pode suprimir o drive ventilatório hipóxico, piorando a hipercapnia e levando ao coma hipercápnico.",
      justificativaB: "CORRETA. Exacerbação grave de DPOC com insuficiência respiratória aguda hipercápnica (pH 7,28 + PaCO2 62): VNI é tratamento de escolha — reduz necessidade de intubação, mortalidade e tempo de internação. O2 controlado para SatO2 88–92% (evitar supressão do drive). Corticoide (prednisolona 40 mg × 5 dias) + broncodilatador de curta ação nebulizado.",
      justificativaC: "INCORRETA. Intubação é reservada para falha da VNI, rebaixamento do nível de consciência ou parada respiratória iminente. Não é primeira escolha.",
      justificativaD: "INCORRETA. SatO2 83% + acidose respiratória = exacerbação grave com IRpA. Alta é conduta perigosa.",
      justificativaE: "INCORRETA. Insuficiente para corrigir hipoxemia grave. Sem suporte ventilatório, o paciente pode evoluir para IR grave.",
      raciocinio: "Exacerbação aguda grave de DPOC: piora de dispneia, aumento e purulência do escarro + gasometria com acidose respiratória aguda sobre crônica (pH 7,28, PaCO2 62, HCO3 elevado = compensação crônica). VNI indicada: pH 7,25–7,35 com hipercapnia. O2 controlado: risco de supressão do drive hipóxico = 'DPOC desafia o oxigênio'. Meta SatO2 88–92%.",
      tto: "1. VNI (BiPAP): IPAP 12–20 cmH2O / EPAP 4–8 cmH2O. 2. O2 venturi 28% ou cateter 1–2 L/min (SatO2 alvo 88–92%). 3. Salbutamol 2,5mg + ipratrópio 0,5mg nebulizado 20/20min × 3. 4. Metilprednisolona 40 mg IV ou prednisolona 40 mg VO × 5 dias. 5. Antibiótico se escarro purulento: amoxicilina-clavulanato ou levofloxacino × 5 dias. Critérios para intubação: falha VNI, Glasgow<8, apneia, instabilidade hemodinâmica.",
      dicaMestre: "DPOC + IR hipercápnica: VNI é padrão-ouro (reduz mortalidade e intubação). O2 controlado SatO2 88–92% — NUNCA 100% (suprime drive). Intubação: falha VNI ou Glasgow caindo. Exacerbação + escarro purulento = ATB. Corticoide × 5 dias (não mais que isso). pH<7,25 + VNI falhou = intubar.",
    },
  ],
  "IC": [
    {
      numeroQuestao: 1,
      materia: "Clínica Médica",
      subtema: "Cardiologia / Insuficiência Cardíaca",
      banca: "Revalida INEP",
      imagemUrl: "",
      instituicao: "INEP",
      enunciado: "Paciente masculino, 68 anos, hipertenso e diabético há 15 anos, admitido com dispneia progressiva há 3 dias, ortopneia e edema de membros inferiores. Ao exame: PA 160/95 mmHg, FC 98 bpm, SatO2 88% em ar ambiente, crepitações bibasais, B3 presente, turgência jugular a 45°, fígado palpável a 4 cm do rebordo costal. Radiografia de tórax evidencia índice cardiotorácico de 0,58, redistribuição vascular e linhas B de Kerley. Qual é a conduta imediata mais adequada?",
      alternativaA: "Furosemida 40 mg IV, oxigênio suplementar para SatO2 >94% e monitorização contínua.",
      alternativaB: "Morfina IV para alívio da dispneia e solicitação de ecocardiograma de urgência antes de qualquer outra intervenção.",
      alternativaC: "Captopril sublingual para controle hipertensivo imediato e repouso no leito.",
      alternativaD: "Dobutamina IV em bomba de infusão e transferência imediata para UTI.",
      alternativaE: "Hidratação venosa com SF 0,9% e observação por 6 horas antes de decidir conduta.",
      gabarito: "a",
      justificativaA: "CORRETA. Furosemida IV reduz pré-carga rapidamente, revertendo a congestão pulmonar. Oxigênio é mandatório com SatO2 88%. Monitorização contínua garante segurança durante a terapia.",
      justificativaB: "INCORRETA. Morfina tem uso controverso na IC aguda (pode aumentar mortalidade segundo estudos recentes). O ecocardiograma é importante, mas não deve preceder o tratamento do quadro agudo.",
      justificativaC: "INCORRETA. Captopril sublingual não tem suporte na literatura atual e pode causar hipotensão abrupta não controlada. IECAs orais são usados na fase de estabilização.",
      justificativaD: "INCORRETA. Dobutamina é reservada para IC com baixo débito cardíaco e hipoperfusão. Este paciente tem PA elevada, sem indicação primária de inotrópico.",
      justificativaE: "INCORRETA. Hidratação piora a congestão. IC descompensada exige depleção volêmica ativa, não reposição hídrica.",
      raciocinio: "Insuficiência cardíaca descompensada com congestão pulmonar e sistêmica. Os achados clássicos — dispneia, ortopneia, B3, crepitações bibasais, turgência jugular, hepatomegalia e linhas B de Kerley na Rx — confirmam o diagnóstico. A SatO2 de 88% indica hipoxemia significativa. A prioridade é reduzir a pré-carga com diurético de alça IV e corrigir hipoxemia.",
      tto: "1ª linha: Furosemida 40–80 mg IV. O2 para SatO2>94%. Posição semissentada. Monitorar eletrólitos. Após estabilização: IECA/BRA + betabloqueador (carvedilol ou bisoprolol) + espironolactona. Controle rigoroso da PA.",
      dicaMestre: "IC aguda descompensada = Furosemida IV + O2 + decúbito elevado. B3 + crepitações + Kerley B = diagnóstico firme. NUNCA hidratar IC congestiva. Morfina: uso controverso, evitar. Dobutamina: apenas para baixo débito (hipotensão + hipoperfusão).",
    },
  ],
  "TEP": [
    {
      numeroQuestao: 1,
      materia: "Clínica Médica",
      subtema: "Pneumologia / Tromboembolismo Pulmonar",
      banca: "Revalida INEP",
      imagemUrl: "",
      instituicao: "INEP",
      enunciado: "Mulher, 42 anos, pós-operatório de 8º dia de artroplastia total de quadril, apresenta início súbito de dispneia, dor pleurítica em hemitórax direito e hemoptise. Ao exame: FC 118 bpm, FR 26 irpm, PA 122/78 mmHg, SatO2 91% em ar ambiente, MMII sem edema. Gasometria arterial: pH 7,48, PaCO2 30 mmHg, PaO2 62 mmHg. Escore de Wells calculado em 6 pontos. Qual é o próximo passo diagnóstico mais adequado?",
      alternativaA: "Solicitar D-dímero sérico para exclusão do diagnóstico de tromboembolismo pulmonar.",
      alternativaB: "Realizar angiotomografia de tórax com contraste (angio-TC) imediatamente.",
      alternativaC: "Iniciar anticoagulação plena com heparina não fracionada sem confirmação diagnóstica adicional.",
      alternativaD: "Solicitar ecocardiograma transtorácico como método diagnóstico de primeira linha.",
      alternativaE: "Realizar cintilografia ventilação-perfusão (V/Q) como exame inicial de escolha.",
      gabarito: "b",
      justificativaA: "INCORRETA. Com Wells ≥5 (alta probabilidade), o D-dímero NÃO é o próximo passo — sua alta sensibilidade serve para exclusão em probabilidade baixa/intermediária, não em alta probabilidade.",
      justificativaB: "CORRETA. Wells 6 = alta probabilidade de TEP. A angio-TC de tórax é o padrão-ouro diagnóstico e deve ser realizada diretamente neste cenário.",
      justificativaC: "INCORRETA. Anticoagulação empírica sem confirmação é aceitável apenas em instabilidade hemodinâmica grave. Este paciente está hemodinamicamente estável.",
      justificativaD: "INCORRETA. O ecocardiograma pode mostrar sobrecarga de VD sugestiva de TEP maciço, mas não é confirmatório.",
      justificativaE: "INCORRETA. Cintilografia V/Q é alternativa quando há contraindicação à angio-TC. Não é a primeira escolha aqui.",
      raciocinio: "Contexto clássico de TEP: cirurgia ortopédica de grande porte, imobilização prolongada, tríade de Virchow completa. Tríade clínica de TEP, taquicardia, hipoxemia com alcalose respiratória e Wells 6 (alta probabilidade). A angio-TC é o exame confirmatório de escolha.",
      tto: "Após confirmação: anticoagulação plena imediata. Heparina não fracionada IV ou enoxaparina 1 mg/kg SC 12/12h. Transição para anticoagulante oral por ≥3 meses. TEP maciço (hipotensão): trombólise com alteplase 100 mg IV em 2h.",
      dicaMestre: "Wells >4 → angio-TC direta. Wells ≤4 → D-dímero primeiro. Contraindicação à angio-TC → cintilografia V/Q. TEP maciço (choque) → trombólise. Gravidez → evitar TC → cintilografia. Cirurgia ortopédica + dispneia súbita = TEP até prova em contrário.",
    },
  ],
  "asma": [
    {
      numeroQuestao: 1,
      materia: "Clínica Médica",
      subtema: "Pneumologia / Crise Asmática",
      banca: "Revalida INEP",
      imagemUrl: "",
      instituicao: "INEP",
      enunciado: "Mulher, 22 anos, asmática em uso de budesonida inalatória + formoterol conforme necessidade, chega ao PS em broncoespasmo intenso após exposição a poeira. Ao exame: FR 32 irpm, FC 118 bpm, SpO2 88%, fala em palavras, uso de musculatura acessória, sibilos expiratórios difusos. PFE 45% do previsto. Qual é a classificação da crise e a conduta imediata?",
      alternativaA: "Crise leve; salbutamol inalatório 2–4 jatos e observação por 1 hora.",
      alternativaB: "Crise grave; salbutamol nebulizado 20/20min × 3 + ipratrópio + oxigênio + corticoide sistêmico IV/VO e monitorização.",
      alternativaC: "Crise grave; intubação imediata e ventilação mecânica.",
      alternativaD: "Crise moderada; aminofilina IV como broncodilatador de primeira linha.",
      alternativaE: "Crise grave; sedação e intubação antes de broncodilatadores.",
      gabarito: "b",
      justificativaA: "INCORRETA. SpO2 88% + FR 32 + PFE 45% + fala em palavras = crise grave, não leve.",
      justificativaB: "CORRETA. Crise grave (PFE 40–69% + SpO2<92% + fala em palavras): beta-2 de curta ação nebulizado (salbutamol 2,5–5 mg) 20/20min × 3 doses + ipratrópio + O2 para SatO2 >94% + corticoide sistêmico (metilprednisolona 1–2 mg/kg IV ou prednisolona 1 mg/kg VO).",
      justificativaC: "INCORRETA. Intubação é reservada para crise ameaçadora à vida (PFE<25%, confusão, cianose, silêncio auscultatório). Tentar broncodilatadores intensivos antes.",
      justificativaD: "INCORRETA. Aminofilina não é de primeira linha (benefício marginal com toxicidade considerável). Reservada para casos refratários.",
      justificativaE: "INCORRETA. Sedação e intubação antes de broncodilatadores aumenta mortalidade em crise grave sem critérios para VM.",
      raciocinio: "Classificação da crise: leve (PFE>70%, fala normal, SatO2>95%), moderada (PFE 40–69%, frases, SatO2 92–95%), grave (PFE<40%, palavras, SatO2<92%), ameaçadora (silêncio, cianose, exaustão). Esta paciente: PFE 45% + SpO2 88% + fala em palavras = grave. Resposta ao tratamento inicial define próximos passos.",
      tto: "Grave: salbutamol 2,5–5mg nebulizado 20/20min × 3 + ipratrópio 0,5mg nebulizado × 3. O2: cateter ou máscara SatO2>94%. Corticoide: metilprednisolona 1–2 mg/kg IV (máx 125 mg). Sulfato de Mg 2g IV em 20min se refratário. Heliox se disponível. Critérios de internação: PFE<70% após 1h, SpO2<95%, necessidade de beta-2 contínuo.",
      dicaMestre: "Asma grave = beta-2 inalatório + ipratrópio + corticoide sistêmico. NÃO aminofilina de 1ª linha. NÃO sedar antes de tratar. Silêncio auscultatório = gravíssimo (broncoespasmo completo). Sulfato de Mg: último recurso antes de intubar. PFE é o melhor parâmetro objetivo de gravidade.",
    },
  ],
  "IRC": [
    {
      numeroQuestao: 1,
      materia: "Clínica Médica",
      subtema: "Nefrologia / Insuficiência Renal Crônica",
      banca: "Revalida INEP",
      imagemUrl: "",
      instituicao: "INEP",
      enunciado: "Homem, 58 anos, diabético tipo 2 e hipertenso há 20 anos, acompanhado em UBS. Exames recentes: creatinina 3,8 mg/dL (TFG estimada 18 mL/min/1,73m²), ureia 120 mg/dL, K+ 6,2 mEq/L, HCO3 16 mEq/L, hemoglobina 8,5 g/dL, fósforo 6,0 mg/dL, PTH 320 pg/mL. Paciente refere náuseas, astenia intensa e edema de MMII. Qual é a indicação prioritária baseada nos achados laboratoriais?",
      alternativaA: "Iniciar diálise de urgência baseado somente na creatinina elevada.",
      alternativaB: "Encaminhar ao nefrologista para avaliação de terapia renal substitutiva (diálise ou transplante), tratar hipercalemia, acidose e anemia, e ajustar dieta.",
      alternativaC: "Aumentar a dose do IECA para melhorar a filtração glomerular.",
      alternativaD: "Prescrever anti-inflamatório não esteroidal para alívio dos sintomas urêmicos.",
      alternativaE: "Tratar apenas a anemia com transfusão de hemácias e aguardar melhora espontânea da função renal.",
      gabarito: "b",
      justificativaA: "INCORRETA. Indicação de diálise é clínica + laboratorial, não apenas pela creatinina. Critérios: hipercalemia refratária, acidose grave refratária, uremia sintomática, sobrecarga volêmica refratária.",
      justificativaB: "CORRETA. TFG 18 mL/min = DRC Estádio G5 (falência renal), limiar para preparo de TRS. Complicações presentes: hipercalemia (K+6,2 — risco arrítmico), acidose metabólica (HCO3 16), anemia (Hb 8,5 — anemia da DRC), osteodistrofia renal (P6,0 + PTH320). Manejo multidisciplinar urgente.",
      justificativaC: "INCORRETA. IECA/BRA em DRC avançada com K+6,2 mEq/L é perigoso (piora hipercalemia). Em TFG<30 com hipercalemia: reavaliar o uso.",
      justificativaD: "INCORRETA. AINEs são CONTRAINDICADOS em DRC — causam vasoconstrição da arteríola aferente e pioram agudamente a função renal.",
      justificativaE: "INCORRETA. Transfusão é reservada para anemia sintomática grave (Hb<7 ou instabilidade). O tratamento de primeira linha da anemia da DRC é eritropoietina + ferro IV.",
      raciocinio: "DRC Estádio G5 (TFG 15–29 = G4 / <15 = G5 — aqui TFG 18 = G4 avançado/G5). Complicações da DRC avançada a tratar: hipercalemia (patresina/SPS, dieta), acidose (bicarbonato oral), anemia (EPO + ferro IV), hiperfosfatemia (quelantes de fósforo), hiperparatireoidismo secundário (calcitriol/cinacalcete). Preparo para TRS.",
      tto: "Hipercalemia K+6,2: gluconato de Ca 10% IV se ECG alterado, insulina+glicose, bicarbonato IV, resina (SPS), dieta. Acidose: bicarbonato de sódio VO 1–3g/dia. Anemia: eritropoietina alfa/beta + ferro IV (ferritina alvo 200–500, saturação transferrina >20%). Hiperfosfatemia: carbonato de cálcio ou sevelâmer. Encaminhar nefrologia. Preparar acesso para diálise (fístula AV).",
      dicaMestre: "DRC: ÉVITAR AINEs (nefrotóxico), CUIDADO com IECA+K+ alto, metformina contraindicada em TFG<30. TFG<30 = preparar fístula AV. Diálise de urgência: AEIOU (Acidose refratária, Eletrólitos — hipercalemia refratária, Intoxicação, Overload — sobrecarga volêmica, Uremia sintomática). Anemia DRC = EPO + ferro IV, não transfusão de rotina.",
    },
  ],
  "apendicite": [
    {
      numeroQuestao: 1,
      materia: "Cirurgia Geral",
      subtema: "Cirurgia Abdominal / Apendicite Aguda",
      banca: "Revalida INEP",
      imagemUrl: "",
      instituicao: "INEP",
      enunciado: "Homem, 24 anos, sem comorbidades, chega ao PS com dor abdominal iniciada há 18 horas na região periumbilical, com migração para fossa ilíaca direita nas últimas 6 horas. Apresenta anorexia, náusea e febre 38,2°C. Ao exame: sinal de Blumberg positivo, sinal de Rovsing positivo, rigidez à palpação em FID. Hemograma: leucócitos 16.400 com 82% neutrófilos. Qual é a conduta?",
      alternativaA: "Tomografia computadorizada de abdome com contraste para confirmar diagnóstico antes de qualquer decisão cirúrgica.",
      alternativaB: "Indicação cirúrgica de apendicectomia baseada no quadro clínico (Alvarado ≥7); TC apenas se dúvida diagnóstica em grupos especiais.",
      alternativaC: "Antibioticoterapia isolada com amoxicilina-clavulanato e observação por 48 horas.",
      alternativaD: "Alta hospitalar com analgesia e retorno em 24 horas para reavaliação.",
      alternativaE: "Ultrassonografia abdominal obrigatória antes de qualquer intervenção, mesmo com quadro clínico típico.",
      gabarito: "b",
      justificativaA: "INCORRETA. Com quadro clínico típico e Alvarado alto (dor em FID + Blumberg + leucocitose com desvio + febre + anorexia + migração da dor = ≥8 pontos), a TC não é obrigatória em homens adultos com diagnóstico inequívoco.",
      justificativaB: "CORRETA. Apendicite clínica típica com Alvarado ≥7 em adulto jovem do sexo masculino = indicação cirúrgica sem necessidade de confirmação por imagem. TC é reservada para casos duvidosos, mulheres em idade fértil, idosos e crianças.",
      justificativaC: "INCORRETA. Antibioticoterapia isolada pode ser tentada em apendicite não complicada em alguns protocolos, mas com perfuração iminente (sinal de Blumberg + leucocitose alta) a cirurgia é indicada.",
      justificativaD: "INCORRETA. Blumberg positivo + leucocitose + migração da dor = abdome agudo inflamatório. Alta é conduta perigosa.",
      justificativaE: "INCORRETA. USG tem sensibilidade limitada para apendicite (~75–86%). Quadro clínico típico com Alvarado alto dispensa imagem em adultos.",
      raciocinio: "Escore de Alvarado (MANTRELS): Migração da dor para FID (1), Anorexia (1), Náusea/vômito (1), Sensibilidade em FID (2), Rebound/Blumberg (1), Temperatura >37,3°C (1), Leucocitose >10.000 (2), Desvio à esquerda (1). Máximo 10 pontos. Este caso: ≥8 pontos = alta probabilidade. Cirurgia sem TC.",
      tto: "Apendicectomia (laparoscópica preferida). Antibiótico profilático perioperatório: cefazolina + metronidazol. Apendicite perfurada: lavagem da cavidade, antibiótico terapêutico (ciprofloxacino + metronidazol ou piperacilina-tazobactam) por 4–7 dias. Plastron apendicular: antibiótico + drenagem se abscesso, cirurgia eletiva 6–8 semanas após.",
      dicaMestre: "Alvarado ≥7 = cirurgia sem imagem obrigatória em homem adulto. Blumberg = peritonismo localizado. Rovsing = palpação em FIE provoca dor em FID (irritação peritoneal). Mulher em idade fértil + dor em FID = sempre USG/TC (diagnóstico diferencial com cisto ovariano, DIP, gravidez ectópica). Plastron: NÃO operar na fase aguda.",
    },
  ],
  "anemia": [
    {
      numeroQuestao: 1,
      materia: "Clínica Médica",
      subtema: "Hematologia / Anemia Ferropriva",
      banca: "Revalida INEP",
      imagemUrl: "",
      instituicao: "INEP",
      enunciado: "Mulher, 32 anos, queixa de fadiga progressiva, dispneia aos esforços e palpitações há 4 meses. Menstruações abundantes desde a adolescência, em tratamento irregular. Ao exame: palidez cutâneo-mucosa +3/+4, queilite angular, coiloníquia, língua despapilada. Hemograma: Hb 7,2 g/dL, Ht 22%, VCM 62 fL, HCM 18 pg, RDW 18%. Ferritina 4 ng/mL, ferro sérico 28 mcg/dL, TIBC 480 mcg/dL. Qual é o tratamento de primeira linha?",
      alternativaA: "Transfusão de 2 unidades de concentrado de hemácias imediatamente.",
      alternativaB: "Sulfato ferroso 300 mg VO (equivalente a 60 mg de ferro elementar) 2–3x/dia em jejum por pelo menos 3–6 meses após normalização da Hb.",
      alternativaC: "Vitamina B12 1000 mcg IM mensal e ácido fólico VO.",
      alternativaD: "Eritropoietina recombinante SC semanal.",
      alternativaE: "Ferro dextrano IV em dose única e alta hospitalar.",
      gabarito: "b",
      justificativaA: "INCORRETA. Transfusão é reservada para Hb<7 com instabilidade hemodinâmica ou Hb<8 com sintomas cardiopulmonares graves. Esta paciente está estável com Hb 7,2.",
      justificativaB: "CORRETA. Anemia microcítica hipocrômica com ferritina baixa + TIBC elevado + sintomas (coiloníquia, queilite = iron deficiency signs) + causa identificada (menorragia). Tratamento: sulfato ferroso VO por 3–6 meses APÓS normalização da Hb (para repor estoques). Tomar em jejum com vitamina C (aumenta absorção).",
      justificativaC: "INCORRETA. Vitamina B12/folato trata anemia megaloblástica (macrocítica, VCM>100). Esta é microcítica (VCM 62).",
      justificativaD: "INCORRETA. EPO é usada em anemia da DRC ou anemia oncológica, não em ferropriva com estoque depletado.",
      justificativaE: "INCORRETA. Ferro IV é reservado para intolerância ao ferro VO, má absorção (gastrectomia, DII), gravidez com déficit importante ou falha ao VO. Não é primeira linha em paciente ambulatorial.",
      raciocinio: "Anemia ferropriva: VCM baixo + HCM baixo + RDW alto (anisocitose) + ferritina baixa (estoque) + TIBC elevado (transferrina compensando). Causa: menorragia crônica. Sinais de deficiência de ferro tecidual (coiloníquia, queilite angular, glossite). Reticulocitose esperada em 5–10 dias de tratamento. Hb normaliza em 4–8 semanas, mas continuar por 3–6 meses para repor estoque.",
      tto: "Sulfato ferroso 300 mg VO 2–3x/dia (= 60 mg Fe elementar/dose) em jejum. Vitamina C (suco de laranja) aumenta absorção. Evitar com café, chá, antiácidos. Tratar causa base (ginecologista para menorragia). Reticulócitos sobem em 3–5 dias (sinal de resposta). Hb sobe ~1 g/dL/semana. Manter por 3–6 meses após normalização da Hb.",
      dicaMestre: "Anemia ferropriva: microcítica + hipocrômica + ferritina baixa + TIBC alto. Tratamento VO por no mínimo 3–6 meses após normalização (para repor estoques). Ferro IV: intolerância VO, má absorção, urgência. Transfusão: Hb<7 instável ou <8 com sintomas cardíacos. RDW alto diferencia ferropriva de talassemia (RDW normal na talassemia).",
    },
  ],
  "hipotireoidismo": [
    {
      numeroQuestao: 1,
      materia: "Clínica Médica",
      subtema: "Endocrinologia / Hipotireoidismo",
      banca: "Revalida INEP",
      imagemUrl: "",
      instituicao: "INEP",
      enunciado: "Mulher, 45 anos, queixa de fadiga intensa, ganho de peso de 8 kg em 6 meses, intolerância ao frio, constipação, pele seca, queda de cabelo e humor deprimido. Ao exame: bradicardia 54 bpm, PA 130/85 mmHg, reflexo tendíneo com fase de relaxamento lentificado, mixedema palpebral. TSH: 45 mUI/L (VN 0,4–4,0). T4 livre: 0,4 ng/dL (VN 0,8–1,8). Anti-TPO positivo 1:1200. Qual é o diagnóstico e o tratamento?",
      alternativaA: "Hipotireoidismo subclínico; não tratar ainda, apenas repetir TSH em 3 meses.",
      alternativaB: "Hipotireoidismo primário por tireoidite de Hashimoto; iniciar levotiroxina sódica com dose ajustada por peso.",
      alternativaC: "Hipotireoidismo central (secundário); investigar lesão hipofisária com RM antes de tratar.",
      alternativaD: "Síndrome depressiva; encaminhar para psiquiatria e iniciar antidepressivo.",
      alternativaE: "Hipotireoidismo primário; iniciar corticoide antes da levotiroxina para evitar crise adrenal.",
      gabarito: "b",
      justificativaA: "INCORRETA. TSH 45 com T4 livre baixo = hipotireoidismo CLÍNICO (manifesto), não subclínico (que seria TSH elevado com T4 livre normal). Tratamento imediato indicado.",
      justificativaB: "CORRETA. Hipotireoidismo primário (TSH alto + T4 livre baixo) por Hashimoto (anti-TPO 1:1200). Tratamento: levotiroxina 1,6 mcg/kg/dia em jejum (adulto hígido). Meta: TSH 1–2 mUI/L.",
      justificativaC: "INCORRETA. Hipotireoidismo central = TSH normal/baixo com T4 livre baixo. Aqui o TSH está MUITO elevado (45) = primário (falência tireoidiana com ausência de feedback negativo).",
      justificativaD: "INCORRETA. O quadro depressivo é manifestação do hipotireoidismo. Tratar a causa (hipotireoidismo) resolve os sintomas neuropsiquiátricos.",
      justificativaE: "INCORRETA. Corticoide antes de levotiroxina é conduta em coma mixedematoso ou em pacientes com suspeita de insuficiência adrenal concomitante (Síndrome de Schmidt). Não é rotina.",
      raciocinio: "Hipotireoidismo clínico: TSH alto + T4L baixo. Hashimoto: causa mais comum em mulheres adultas, anti-TPO elevado, bócio ou atrofia tireoidiana. Tríade clássica: fadiga + ganho de peso + intolerância ao frio. Reflexo lentificado = sinal físico clássico. Mixedema: infiltração por glicosaminoglicanos.",
      tto: "Levotiroxina sódica: dose inicial 1,6 mcg/kg/dia VO em jejum (30 min antes do café). Idosos e cardiopatas: iniciar com 12,5–25 mcg/dia e titular lentamente. Meta: TSH 1–2 mUI/L (ou conforme contexto clínico). Retornar TSH em 6–8 semanas após início ou ajuste. Interações: cálcio, ferro, antiácidos reduzem absorção (espaçar ≥4h).",
      dicaMestre: "TSH alto + T4L baixo = primário. TSH normal/baixo + T4L baixo = central. Subclínico: TSH alto + T4L NORMAL. Levotiroxina em jejum, 30 min antes do café. Meta TSH: 1–2 mUI/L (mulher grávida: 0,1–2,5). Não confundir com Síndrome de Sick Euthyroid: TSH pode ser baixo/normal em doença aguda grave sem hipotireoidismo.",
    },
  ],
  "hipertireoidismo": [
    {
      numeroQuestao: 1,
      materia: "Clínica Médica",
      subtema: "Endocrinologia / Hipertireoidismo — Doença de Graves",
      banca: "Revalida INEP",
      imagemUrl: "",
      instituicao: "INEP",
      enunciado: "Mulher, 30 anos, procura UBS com queixas de palpitações, tremor fino de extremidades, sudorese intensa, perda de 7 kg em 2 meses com apetite aumentado e nervosismo. Ao exame: FC 118 bpm (irregular), exoftalmia bilateral, bócio difuso com frêmito, pele quente e úmida. TSH <0,01 mUI/L, T4 livre 4,8 ng/dL, T3 total 420 ng/dL. Anti-receptor de TSH (TRAb): positivo. Qual é a conduta inicial?",
      alternativaA: "Levotiroxina para suprimir o TSH e acompanhamento ambulatorial.",
      alternativaB: "Propiltiouracil (PTU) ou metimazol + propranolol para controle dos sintomas adrenérgicos e encaminhamento para endocrinologia.",
      alternativaC: "Cirurgia de tireoidectomia total de urgência.",
      alternativaD: "Iodo radioativo imediato sem preparação prévia.",
      alternativaE: "Corticoide em altas doses para tratar a exoftalmia antes de qualquer outra conduta.",
      gabarito: "b",
      justificativaA: "INCORRETA. Levotiroxina está contraindicada em hipertireoidismo — agravaria o quadro.",
      justificativaB: "CORRETA. Doença de Graves (TRAb+ + exoftalmia + bócio difuso + hipertireoidismo): tiotamidas (metimazol 1ª escolha, PTU em gestação 1º trimestre) + betabloqueador (propranolol) para controle adrenérgico imediato (taquicardia, tremor, sudorese). Terapia definitiva: radioiodo, cirurgia ou tiotamidas longo prazo.",
      justificativaC: "INCORRETA. Cirurgia não é conduta de urgência em Graves sem complicações. Exige eutireoidismo pré-operatório e preparo com iodeto de potássio.",
      justificativaD: "INCORRETA. Iodo radioativo em hipertireoidismo ativo sem preparo pode causar crise tireotóxica. Requer eutireoidismo prévio com tiotamidas.",
      justificativaE: "INCORRETA. Corticoide é usado para oftalmopatia de Graves moderada/grave, mas não é a prioridade inicial antes do controle do hipertireoidismo.",
      raciocinio: "Doença de Graves: causa mais comum de hipertireoidismo em mulher jovem. Tríade: hipertireoidismo + exoftalmia + bócio difuso. TRAb (anticorpo anti-receptor TSH) = marcador específico. FA com alta frequência ventricular = necessidade urgente de betabloqueador. Tiotamidas: metimazol (preferido) 30–40 mg/dia; PTU: 2ª escolha (hepatotoxicidade), mas 1ª escolha no 1º trimestre da gestação.",
      tto: "Fase aguda: metimazol 30–40 mg/dia (ou PTU 300–400 mg/dia em gestante 1T) + propranolol 20–40 mg 8/8h (controle adrenérgico). Após eutireoidismo: terapia definitiva: radioiodo 131I (contraindicado na gravidez e oftalmopatia ativa grave) OU tireoidectomia total (preferida em bócio volumoso, oftalmopatia, suspeita de malignidade) OU tiotamidas por 12–18 meses. Oftalmopatia: prednisolona 1 mg/kg/dia.",
      dicaMestre: "Graves: TRAb+ + exoftalmia + bócio difuso. Metimazol = 1ª linha (exceto grávida 1T → PTU). Propranolol: controle sintomático imediato. Radioiodo: contraindicado em gravidez e oftalmopatia ativa. Crise tireotóxica (tempestade): PTU + propranolol + lugol + hidrocortisona + suporte UTI. Betabloqueador: controla FC e tremor mas NÃO é antitireoidiano.",
    },
  ],
  "meningite": [
    {
      numeroQuestao: 1,
      materia: "Clínica Médica",
      subtema: "Infectologia / Meningite Bacteriana",
      banca: "Revalida INEP",
      imagemUrl: "",
      instituicao: "INEP",
      enunciado: "Homem, 22 anos, universitário, admitido com febre 40°C, cefaleia holocraniana intensa de início súbito, vômitos em jato, fotofobia e rigidez de nuca. Sinal de Kernig e Brudzinski positivos. Petéquias em tronco e MMII. PA 88/58 mmHg, FC 128 bpm, Glasgow 12. Qual é a conduta imediata?",
      alternativaA: "Realizar punção lombar imediatamente para análise do LCR e só então iniciar antibiótico.",
      alternativaB: "Iniciar dexametasona + ceftriaxona IV imediatamente, antes da punção lombar; coletar hemoculturas primeiro.",
      alternativaC: "Aguardar TC de crânio para descartar hipertensão intracraniana antes de qualquer tratamento.",
      alternativaD: "Iniciar aciclovir IV empírico enquanto aguarda resultado de punção lombar.",
      alternativaE: "Transferir para UTI antes de iniciar qualquer medicação.",
      gabarito: "b",
      justificativaA: "INCORRETA. Em meningite bacteriana com sinais de choque e Glasgow 12, NUNCA atrasar antibiótico para aguardar punção. Risco de herniação e mortalidade aumentam a cada hora.",
      justificativaB: "CORRETA. Meningite bacteriana fulminante (petéquias + choque + meningismo + Glasgow 12 = Meningococcemia/meningocócica). Protocolo: 1. Hemoculturas (2 pares); 2. Dexametasona 0,15 mg/kg IV (reduz sequelas); 3. Ceftriaxona 2g IV 12/12h IMEDIATAMENTE. Punção lombar: depois, se sem contraindicações.",
      justificativaC: "INCORRETA. TC antes de antibiótico só se indicada (papiledema, déficit focal, imunossuprimido, convulsão recente). Mesmo nesses casos: iniciar ATB ANTES da TC — nunca atrasar.",
      justificativaD: "INCORRETA. Aciclovir é indicado para meningite/encefalite viral herpética. O quadro com petéquias, choque e evolução rápida aponta para etiologia bacteriana (meningococo).",
      justificativaE: "INCORRETA. A transferência não deve atrasar o antibiótico. Iniciar ATB antes de qualquer transferência.",
      raciocinio: "Meningococcemia: tríade (febre + cefaleia + rigidez de nuca) + petéquias + choque séptico + evolução rápida = emergência médica. Mortalidade sem tratamento: >50%. Cada hora de atraso no ATB = piora exponencial. Hemoculturas → dexametasona → ceftriaxona = sequência obrigatória. Dexametasona reduz sequelas neurológicas (especialmente surdez) em meningite bacteriana.",
      tto: "1. Hemoculturas ×2 pares. 2. Dexametasona 0,15 mg/kg IV antes ou com ATB. 3. Ceftriaxona 2g IV 12/12h (ou ampicilina se suspeita de Listeria: >50 anos, imunossuprimido). 4. Ressuscitação volêmica + vasopressor se choque. 5. Isolamento por 24h. 6. Quimioprofilaxia de contatos próximos: rifampicina 600 mg 12/12h × 2 dias. Duração ATB: 7–14 dias conforme etiologia.",
      dicaMestre: "Meningite bacteriana = emergência. Sequência: Hemoculturas → Dexa → ATB. NUNCA atrasar ATB por TC ou punção. Petéquias + choque + meningismo = Meningococo. Dexametasona: reduz surdez e sequelas. Ceftriaxona 2g IV 12/12h. Quimioprofilaxia contatos: rifampicina. Kernig: resistência à extensão do joelho com coxa fletida. Brudzinski: flexão involuntária dos joelhos ao fletir o pescoço.",
    },
  ],
  "geral": [
    {
      numeroQuestao: 1,
      materia: "Clínica Médica",
      subtema: "Raciocínio Clínico / Diagnóstico Diferencial",
      banca: "Revalida INEP",
      imagemUrl: "",
      instituicao: "INEP",
      enunciado: "Homem, 50 anos, chega ao PS com dispneia progressiva há 48 horas, tosse seca e febre 38,5°C. Tem histórico de tabagismo 30 anos-maço e hipertensão. Ao exame: FR 22 irpm, SatO2 93%, ausculta com murmúrio vesicular reduzido em base direita e macicez à percussão. Radiografia: velamento de seio costofrênico direito com linha de Ellis-Damoiseau. Qual é a hipótese diagnóstica e conduta inicial?",
      alternativaA: "Pneumotórax espontâneo; toracostomia de urgência.",
      alternativaB: "Derrame pleural; investigar etiologia (toracocentese diagnóstica e terapêutica se >1 cm na incidência de Laurell) e tratar a causa base.",
      alternativaC: "Hemoptise maciça; intubação seletiva imediata.",
      alternativaD: "Atelectasia compressiva; fisioterapia respiratória intensa e broncodilatador.",
      alternativaE: "DPOC exacerbado; VNI e broncodilatador nebulizado.",
      gabarito: "b",
      justificativaA: "INCORRETA. Pneumotórax cursa com hipersonoridade/timpanismo à percussão e redução do MV, não com macicez e linha de Ellis-Damoiseau.",
      justificativaB: "CORRETA. Linha de Ellis-Damoiseau + macicez + MV reduzido = derrame pleural. Toracocentese se >1 cm na Laurell: analisa LDH, proteína, glicose, pH, citologia (critérios de Light: exsudato vs transudato). Tratar causa base.",
      justificativaC: "INCORRETA. Hemoptise maciça não apresenta este padrão radiológico de velamento em Laurell.",
      justificativaD: "INCORRETA. Atelectasia: velamento com desvio ipsilateral das estruturas mediastinais (traqueia desvia para o lado afetado). Derrame: desvio contralateral.",
      justificativaE: "INCORRETA. Sem dados de broncoespasmo ou espirometria sugestiva de DPOC, e o padrão radiológico não é de DPOC.",
      raciocinio: "Semiologia do derrame pleural: macicez à percussão + redução/abolição do MV + egofonia + frêmito toracovocal diminuído. Linha de Ellis-Damoiseau: limite superior côncavo do derrame livre. Causas: ICC (transudato), infecção, TB, câncer, embolia (exsudatos). Critérios de Light: exsudato se proteína pleural/sérica >0,5 OU LDH pleural/sérico >0,6 OU LDH pleural >2/3 limite superior normal.",
      tto: "Toracocentese diagnóstica (e terapêutica se volumoso). Análise: aspecto, proteína, LDH, glicose, pH, citologia, cultura. Transudato (ICC, cirrose, SN): tratar causa base. Exsudato: investigar TB, neoplasia, infecção (empiema: drenagem obrigatória). Derrame parapneumônico complicado/empiema: drenagem + ATB.",
      dicaMestre: "Ellis-Damoiseau = derrame pleural livre. Desvio contralateral = derrame volumoso. Desvio ipsilateral = atelectasia. Critérios de Light: proteína pl/sér >0,5 OU LDH pl/sér >0,6 OU LDH pl >2/3 VN = exsudato. Toracocentese: posição sentado, triângulo de segurança (linha axilar posterior, borda superior da costela inferior, linha horizontal pela prega axilar anterior).",
    },
  ],
};

const ImportadorPro = () => {
  const [abaInterna, setAbaInterna] = useState("manual");
  const [questoes, setQuestoes] = useState([]);
  const [jsonInput, setJsonInput] = useState("");
  const [_loading, _setLoading] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [provaEdicao, setProvaEdicao] = useState("");
  const [isOficial, setIsOficial] = useState(true);
  const [publicando, setPublicando] = useState(false);
  const [publicados, setPublicados] = useState(0);
  const [copiado, setCopiado] = useState(false);
  const [expandidos, setExpandidos] = useState({});

  // ─── ESTADOS DA GERAÇÃO POR IA ───────────────────────────────
  const [abaIA, setAbaIA] = useState("json"); // "json" | "gerador"
  const [promptUsuario, setPromptUsuario] = useState("");
  const [gerandoIA, setGerandoIA] = useState(false);
  const [erroIA, setErroIA] = useState("");
  // Cooldown de 30s entre chamadas — protege contra uso excessivo de tokens de IA
  const [cooldownRestante, setCooldownRestante] = useState(0);
  const cooldownIntervalRef = React.useRef(null);

  // ─── ESTADOS DO MÓDULO SUPER APOSTAS ────────────────────────
  // destino: "inep" | "super_apostas"
  // Controla para qual módulo as questões serão enviadas.
  // REGRA CRÍTICA: quando destino="super_apostas", o campo isOficial
  // é forçado para false e provaId é limpo — isolamento do módulo INEP.
  const [destino, setDestino] = useState("inep");
  const [edicaoSuperApostas, setEdicaoSuperApostas] = useState("2026_1");
  const [nivelAposta, _setNivelAposta] = useState("ALTO"); // fallback; atribuição real é automática

  // Cleanup do interval ao desmontar o componente
  React.useEffect(() => {
    return () => { if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current); };
  }, []);

  const iniciarCooldown = () => {
    setCooldownRestante(30);
    if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current);
    cooldownIntervalRef.current = setInterval(() => {
      setCooldownRestante(prev => {
        if (prev <= 1) { clearInterval(cooldownIntervalRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const tutorialTexto = `DIRETRIZ PARA GERAÇÃO DE QUESTÕES REVALIDAPRO:
1. ENUNCIADO: Transcrição integral e densa.
2. JUSTIFICATIVAS: Campo "nota" explicando erro/acerto.
3. RACIOCÍNIO: Fisiopatologia e diagnóstico.
4. TTO: Prescrição completa.
5. DICA MESTRE: Regra de ouro.
6. FORMATO: JSON com campos: materia, subtema, banca, ano, enunciado, imagemUrl, alts: {a: {texto, nota}...}, gabarito, raciocinio, tto, dicaMestre.`;

  // ─── COPIAR PROMPT ────────────────────────────────────────────
  const copiarPrompt = () => {
    navigator.clipboard.writeText(PROMPT_SISTEMA);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  // ─── PROCESSAR JSON ───────────────────────────────────────────
  // FIX: convertida para async e integrada a obterProximoNumeroQuestao.
  // Antes, questões sem `id` explícito no JSON recebiam IDs como 2026_1_Q1
  // sem verificar o banco, causando colisão com documentos existentes.
  const processarLoteIA = useCallback(async () => {
    try {
      if (!provaEdicao && isOficial) {
        alert("Doutor, selecione a Edição antes de processar o lote.");
        return;
      }
      const dados = JSON.parse(jsonInput);
      const listaOriginal = Array.isArray(dados) ? dados : [dados];

      // ── REGRA CRÍTICA: Super Apostas nunca pode ser marcado como INEP ────────
      if (destino === "super_apostas" && isOficial) {
        alert("⚠️ Questões do Super Apostas não podem ser marcadas como INEP. Desmarque 'OFICIAL INEP' ou troque o destino.");
        return;
      }

      // Verifica quais questões precisam de ID gerado (não têm id explícito)
      const precisamDeId = listaOriginal.filter(q => !q.id);
      let proximoNumero = 1;

      // Super Apostas usa prefixo "SA_" nos IDs para isolamento total dos IDs INEP
      const isSA = destino === "super_apostas";
      const idChave = isSA ? `SA_${edicaoSuperApostas}` : (provaEdicao || "");

      if (precisamDeId.length > 0) {
        // SA: consulta por "edicao" (provaId das SA é "" — não serve como chave)
        const proximoFirestore = idChave
          ? await obterProximoNumeroQuestao(idChave, isSA ? edicaoSuperApostas : null)
          : 1;
        // SA: filtra por modulo+edicao; INEP/Geral: filtra por provaId
        const maxLocal = questoes
          .filter(q => isSA
            ? (q.modulo === "super_apostas" && q.edicao === edicaoSuperApostas)
            : (q.provaId || "") === idChave)
          .reduce((max, q) => Math.max(max, typeof q.numeroQuestao === "number" ? q.numeroQuestao : 0), 0);
        proximoNumero = Math.max(proximoFirestore, maxLocal + 1);
      }

      const partesProva = isSA ? [String(new Date().getFullYear()), "SA"] : (provaEdicao || "").split(".");
      const anoProva    = partesProva[0] || String(new Date().getFullYear());
      const idBase      = isSA ? `SA_${edicaoSuperApostas}` : `${anoProva}_${partesProva[1] || "1"}`;
      let contadorSemId = 0;

      const listaFinal = listaOriginal.map((q, qIndex) => {
        let id = q.id;
        let numeroQuestao = q.numeroQuestao;
        if (!id) {
          const numAtual = proximoNumero + contadorSemId;
          id = `${idBase}_Q${numAtual}`;
          numeroQuestao = numeroQuestao || numAtual;
          contadorSemId++;
        }
        return {
          ...q,
          id,
          numeroQuestao,
          provaId: isSA ? "" : provaEdicao,   // Super Apostas: provaId vazio = isolamento INEP
          isOficial: isSA ? false : isOficial,
          materia: q.materia || "Clínica Médica",
          subtema: q.subtema || "Geral",
          ano: anoProva,
          imagemUrl: q.imagemUrl || "",
          // Status de atualização de diretriz — automático, sem ação do admin
          status_atualizacao: calcularStatusAtualizacao(q.ano_diretriz),
          // Metadados Super Apostas (apenas quando destino = super_apostas)
          ...(isSA ? {
            modulo: "super_apostas",
            edicao: edicaoSuperApostas,
            // Auto-distribuição de nível: BAIXO→MEDIO→ALTO em ciclo por lote
            nivel_aposta: atribuirNivelAposta(qIndex, listaOriginal.length),
            origem_prova: "IA",
          } : {}),
        };
      });

      setQuestoes(prev => [...prev, ...listaFinal]);
      setAbaInterna("manual");
      setJsonInput("");
      setErroIA("");
    } catch {
      alert("❌ Erro no formato do JSON. Verifique se o JSON está correto.");
    }
  }, [jsonInput, provaEdicao, isOficial, destino, edicaoSuperApostas]);

  // ─── GERAR VIA IA — Integração real com Anthropic via Cloud Function ────────
  // Endpoint: gerarQuestoesIA (Firebase Functions) → Anthropic claude-sonnet-4-6
  // O prompt do usuário é enviado junto com o PROMPT_SISTEMA como system message.
  const gerarViaIA = async () => {
    if (!promptUsuario.trim()) return alert("Descreva o que quer gerar.");
    if (!provaEdicao && isOficial) return alert("Selecione a Edição primeiro.");
    if (cooldownRestante > 0) return; // proteção contra cliques rápidos
    setGerandoIA(true);
    setErroIA("");
    try {
      // ── INTEGRAÇÃO REAL — Anthropic via Cloud Function ──────────────────────
      // Em desenvolvimento (localhost) usa o proxy do Vite (/functions/...) para
      // contornar CORS. Em produção usa o URL direto da Cloud Function.
      const isDev = window.location.hostname === "localhost" ||
                    window.location.hostname === "127.0.0.1";
      const endpoint = isDev
        ? "/functions/gerarQuestoesIA"
        : (import.meta.env.VITE_FUNCTIONS_BASE_URL ||
           "https://us-central1-revalidapro-f812e.cloudfunctions.net") + "/gerarQuestoesIA";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system: PROMPT_SISTEMA, prompt: promptUsuario }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.erro || err.error || `Erro ${response.status} da API de IA. Tente novamente em alguns segundos.`);
      }

      const data = await response.json();

      // Extrai o texto — a Cloud Function retorna o formato Anthropic (content[].text)
      const texto = (data.content || []).map(c => c.text || "").join("").trim();
      if (!texto) throw new Error("A IA retornou uma resposta vazia. Tente reformular o prompt.");

      // ── EXTRAÇÃO ROBUSTA DO JSON ──────────────────────────────────────────────
      // Usa contagem de colchetes para encontrar o JSON exato,
      // independente de texto antes/depois ou cercas markdown.
      let dados;

      const extrairJSONDoTexto = (str) => {
        // Procura o primeiro '[' ou '{' — onde o JSON realmente começa
        const idxArray = str.indexOf("[");
        const idxObj   = str.indexOf("{");

        // Escolhe o que aparecer primeiro
        const abridor = (idxArray === -1) ? "{" : (idxObj === -1 || idxArray < idxObj) ? "[" : "{";
        const fechador = abridor === "[" ? "]" : "}";
        const inicio   = abridor === "[" ? idxArray : idxObj;

        if (inicio === -1) return null;

        // Conta colchetes/chaves para encontrar o fechamento exato
        let profundidade = 0;
        let emString = false;
        let escapeNext = false;

        for (let i = inicio; i < str.length; i++) {
          const c = str[i];
          if (escapeNext) { escapeNext = false; continue; }
          if (c === "\\") { escapeNext = true; continue; }
          if (c === '"') { emString = !emString; continue; }
          if (emString) continue;
          if (c === abridor) profundidade++;
          else if (c === fechador) {
            profundidade--;
            if (profundidade === 0) {
              const trecho = str.slice(inicio, i + 1);
              const parsed = JSON.parse(trecho); // lança se inválido
              return Array.isArray(parsed) ? parsed : [parsed];
            }
          }
        }
        return null; // JSON incompleto (truncado)
      };

      try {
        dados = extrairJSONDoTexto(texto);
        if (!dados) throw new Error("JSON não encontrado ou truncado na resposta da IA.");
      } catch {
        console.error("[gerarViaIA] Falha ao extrair JSON. Primeiros 400 chars:", texto.substring(0, 400));
        throw new Error("Não foi possível extrair o JSON da resposta. Tente um prompt mais curto (ex: 'Gere 1 questão de Cardiologia sobre IAM').");
      }

      const lista = Array.isArray(dados) ? dados : [dados];
      if (lista.length === 0) throw new Error("Nenhuma questão foi gerada. Reformule o prompt.");

      // Super Apostas: usa prefixo "SA_" para isolamento total de IDs INEP
      const isSA    = destino === "super_apostas";
      const idChave = isSA ? `SA_${edicaoSuperApostas}` : (provaEdicao || "");

      const partesProva = isSA ? [String(new Date().getFullYear()), "SA"] : (provaEdicao || "").split(".");
      const anoProva    = partesProva[0] || String(new Date().getFullYear());
      const idBase      = isSA ? `SA_${edicaoSuperApostas}` : `${anoProva}_${partesProva[1] || "1"}`;

      // Obtém próximo número de questão para garantir sequência sem gaps nem duplicatas.
      // Cruza o máximo do Firestore com o máximo já presente no lote local (questoes em memória)
      // para evitar IDs repetidos entre gerações consecutivas antes da publicação.
      // SA: consulta por "edicao" (provaId das SA é "" — não serve como chave)
      const proximoNumeroFirestore = await obterProximoNumeroQuestao(
        idChave,
        isSA ? edicaoSuperApostas : null
      );
      // SA: filtra por modulo+edicao; INEP/Geral: filtra por provaId
      const maxLocal = questoes
        .filter(q => isSA
          ? (q.modulo === "super_apostas" && q.edicao === edicaoSuperApostas)
          : (q.provaId || "") === idChave)
        .reduce((max, q) => Math.max(max, typeof q.numeroQuestao === "number" ? q.numeroQuestao : 0), 0);
      const proximoNumero = Math.max(proximoNumeroFirestore, maxLocal + 1);

      const listaFinal = lista.map((q, i) => {
        // NUNCA usa o numeroQuestao sugerido pela IA — a IA sempre retorna 1,2,3
        // e causaria sobrescrita de documentos já existentes no Firestore.
        // O número sequencial SEMPRE é calculado a partir do banco + lote local.
        const numQuestao = proximoNumero + i;

        return {
          ...q,
          id:            `${idBase}_Q${numQuestao}`,
          numeroQuestao:  numQuestao,
          ano:            q.ano || anoProva,
          provaId:        isSA ? "" : provaEdicao,  // provaId vazio = isolamento módulo INEP
          isOficial:      isSA ? false : isOficial,
          imagemUrl:      q.imagemUrl || "",
          // Status de atualização de diretriz — automático, sem ação do admin
          status_atualizacao: calcularStatusAtualizacao(q.ano_diretriz),
          // Normaliza `alts`: aceita tanto o formato nested (alts.a.texto)
          // quanto o formato flat (alternativaA / justificativaA) por retrocompatibilidade
          alts: q.alts || {
            a: { texto: q.alternativaA || "", nota: q.justificativaA || "" },
            b: { texto: q.alternativaB || "", nota: q.justificativaB || "" },
            c: { texto: q.alternativaC || "", nota: q.justificativaC || "" },
            d: { texto: q.alternativaD || "", nota: q.justificativaD || "" },
            e: { texto: q.alternativaE || "", nota: q.justificativaE || "" },
          },
          // Metadados Super Apostas (apenas quando destino = super_apostas)
          ...(isSA ? {
            modulo: "super_apostas",
            edicao: edicaoSuperApostas,
            // Auto-distribuição de nível: BAIXO→MEDIO→ALTO em ciclo por lote
            nivel_aposta: atribuirNivelAposta(i, lista.length),
            origem_prova: "IA",
          } : {}),
        };
      });
      // ── FIM DA INTEGRAÇÃO REAL ───────────────────────────────────────────────

      setQuestoes(prev => [...prev, ...listaFinal]);
      setAbaInterna("manual");
      setPromptUsuario("");
    } catch (e) {
      setErroIA(e.message || "Erro ao gerar questões. Tente novamente ou use o modo JSON.");
      console.error("[gerarViaIA]", e);
    } finally {
      setGerandoIA(false);
      iniciarCooldown(); // cooldown de 30s para controle de custo
    }
  };

  // ─── HANDLERS ORIGINAIS PRESERVADOS ─────────────────────────
  const adicionarQuestaoManual = () => {
    setQuestoes([...questoes, {
      materia: "Clínica Médica", subtema: "", banca: "Revalida INEP", ano: "",
      provaId: provaEdicao, isOficial: isOficial,
      enunciado: "", imagemUrl: "",
      alts: {
        a: { texto: "", nota: "" }, b: { texto: "", nota: "" },
        c: { texto: "", nota: "" }, d: { texto: "", nota: "" }, e: { texto: "", nota: "" }
      },
      gabarito: "", raciocinio: "", tto: "", dicaMestre: ""
    }]);
  };

  const handleChange = (index, field, value, subfield = null) => {
    const novaLista = [...questoes];
    if (subfield) {
      if (!novaLista[index].alts) novaLista[index].alts = {};
      if (!novaLista[index].alts[field]) novaLista[index].alts[field] = {};
      novaLista[index].alts[field][subfield] = value;
    } else {
      novaLista[index][field] = value;
    }
    setQuestoes(novaLista);
  };

  const publicarLote = async () => {
    if (questoes.length === 0) return alert("Nenhum card para publicar.");
    if (!window.confirm(`Publicar ${questoes.length} questão(ões) no banco de dados?`)) return;
    setPublicando(true);
    setPublicados(0);
    try {
      // ── VALIDAÇÃO CRÍTICA: Super Apostas nunca entra no módulo INEP ──────────
      if (destino === "super_apostas" && isOficial) {
        alert("🚫 BLOQUEADO: Questões do Super Apostas não podem ser marcadas como INEP. Operação cancelada.");
        setPublicando(false);
        return;
      }
      // Verificação secundária: se alguma questão do lote for do módulo super_apostas
      // mas o destino atual for inep com isOficial=true, bloqueia
      const temSAcomINEP = questoes.some(q => q.modulo === "super_apostas" && isOficial);
      if (temSAcomINEP) {
        alert("🚫 BLOQUEADO: O lote contém questões do Super Apostas que não podem ser enviadas com flag INEP.");
        setPublicando(false);
        return;
      }

      const isSA = destino === "super_apostas";

      // Pré-calcula o próximo número para questões sem ID (manuais).
      // Cruza Firestore + lote local para nunca sobrescrever documentos existentes.
      const questoesSemId = questoes.filter(q => !q.id);
      let proximoNumeroFallback = 1;
      let contadorFallback = 0;
      if (questoesSemId.length > 0) {
        const chaveRef = isSA ? `SA_${edicaoSuperApostas}` : (provaEdicao || "");
        // SA: consulta por "edicao"; INEP/Geral: consulta por "provaId"
        const proxFs = chaveRef
          ? await obterProximoNumeroQuestao(chaveRef, isSA ? edicaoSuperApostas : null)
          : 1;
        const maxLocalSemId = questoes
          .filter(q => q.id && (isSA
            ? (q.modulo === "super_apostas" && q.edicao === edicaoSuperApostas)
            : (q.provaId || "") === (provaEdicao || "")))
          .reduce((max, q) => Math.max(max, typeof q.numeroQuestao === "number" ? q.numeroQuestao : 0), 0);
        proximoNumeroFallback = Math.max(proxFs, maxLocalSemId + 1);
      }

      for (let i = 0; i < questoes.length; i++) {
        const q = questoes[i];
        const finalData = {
          ...q,
          alternativaA: q.alternativaA || q.alts?.a?.texto || "",
          alternativaB: q.alternativaB || q.alts?.b?.texto || "",
          alternativaC: q.alternativaC || q.alts?.c?.texto || "",
          alternativaD: q.alternativaD || q.alts?.d?.texto || "",
          alternativaE: q.alternativaE || q.alts?.e?.texto || "",
          justificativaA: q.justificativaA || q.alts?.a?.nota || "",
          justificativaB: q.justificativaB || q.alts?.b?.nota || "",
          justificativaC: q.justificativaC || q.alts?.c?.nota || "",
          justificativaD: q.justificativaD || q.alts?.d?.nota || "",
          justificativaE: q.justificativaE || q.alts?.e?.nota || "",
          instituicao: q.banca || "INEP",
          criadoEm: serverTimestamp(),
          // Super Apostas: reforça metadados e isolamento mesmo em publicarLote
          ...(isSA ? {
            modulo: "super_apostas",
            edicao: q.edicao || edicaoSuperApostas,
            nivel_aposta: q.nivel_aposta || nivelAposta,
            origem_prova: "IA",
            provaId: "",     // garante que nunca entre em queries INEP
            isOficial: false,
          } : {}),
        };
        if (finalData.alts) delete finalData.alts;

        let qId;
        if (q.id) {
          // Questão já tem ID correto atribuído (ex: gerado via IA ou JSON com id explícito)
          qId = q.id;
        } else {
          // Fallback: gera ID no padrão ANO_EDICAO_QNUMERO para questões manuais ou sem id
          const provaRef   = finalData.provaId || provaEdicao || "";
          const partesFb   = provaRef.split(".");
          const ano        = partesFb[0] || String(new Date().getFullYear());
          const edicao     = partesFb[1] || "1";
          const numAtual   = proximoNumeroFallback + contadorFallback;
          qId = `${ano}_${edicao}_Q${numAtual}`;
          finalData.numeroQuestao = finalData.numeroQuestao || numAtual;
          contadorFallback++;
        }

        console.log(`[publicar] Salvando questão ${i + 1}/${questoes.length} → id: ${qId}`);
        await setDoc(doc(db, "questoes", qId), finalData);
        setPublicados(i + 1);
      }
      alert(`✅ ${questoes.length} questão(ões) publicada(s) com sucesso!`);
      setQuestoes([]);
      setPublicados(0);
    } catch (e) {
      alert("Erro ao publicar. Verifique o console.");
      console.error(e);
    }
    setPublicando(false);
  };

  const toggleExpand = (idx) => setExpandidos(prev => ({ ...prev, [idx]: !prev[idx] }));

  return (
    <div style={st.container}>

      {/* ─── BARRA SUPERIOR ─── */}
      <div style={st.topNav}>
        {/* ABAS */}
        <div style={st.tabsGroup}>
          <button onClick={() => setAbaInterna("manual")} style={abaInterna === "manual" ? st.tabActive : st.tab}>
            <FaThList size={12} /> REVISÃO ({questoes.length})
          </button>
          <button onClick={() => setAbaInterna("lote")} style={abaInterna === "lote" ? st.tabActive : st.tab}>
            <FaCode size={12} /> IMPORTAR
          </button>
        </div>

        {/* CONTROLES */}
        <div style={st.controls} className="imp-controls">

          {/* SELETOR DE DESTINO — 3 opções */}
          <div style={{ display: "flex", gap: "6px", background: "#0f172a", padding: "4px", borderRadius: "10px", border: "1px solid #334155" }}>
            <button
              onClick={() => { setDestino("inep"); setIsOficial(true); }}
              style={{ ...st.destinoBtn, ...(destino === "inep" ? st.destinoBtnActive : {}) }}
              title="Questões oficiais INEP / Simulados Prova Real"
            >
              <FaStethoscope size={10} /> INEP
            </button>
            <button
              onClick={() => { setDestino("banco_geral"); setIsOficial(false); setProvaEdicao(""); }}
              style={{ ...st.destinoBtn, ...(destino === "banco_geral" ? { ...st.destinoBtnActive, background: "#10b981" } : {}) }}
              title="Banco geral de questões (Estudo por Áreas, Simulado Geral, Plantão Express)"
            >
              <FaRocket size={10} /> BANCO GERAL
            </button>
            <button
              onClick={() => { setDestino("super_apostas"); setIsOficial(false); setProvaEdicao(""); }}
              style={{ ...st.destinoBtn, ...(destino === "super_apostas" ? st.destinoBtnSA : {}) }}
              title="Módulo Super Apostas — questões de alta incidência estratégica"
            >
              <FaFire size={10} /> SUPER APOSTAS
            </button>
          </div>

          {/* CAMPOS CONDICIONAL: INEP */}
          {destino === "inep" && (
            <>
              <select value={provaEdicao} onChange={e => setProvaEdicao(e.target.value)} style={st.select}>
                <option value="">Edição...</option>
                {["2025.1", "2025.2", "2024.1", "2024.2", "2023.1", "2023.2", "2022.1", "2022.2", "2021.1", "2021.2"].map(e => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
              <label style={st.checkLabel}>
                <input type="checkbox" checked={isOficial} onChange={e => setIsOficial(e.target.checked)} />
                OFICIAL INEP
              </label>
            </>
          )}

          {/* CAMPOS CONDICIONAL: BANCO GERAL */}
          {destino === "banco_geral" && (
            <span style={{ fontSize: "10px", color: "#10b981", fontWeight: "800", display: "flex", alignItems: "center", gap: "4px", whiteSpace: "nowrap" }}>
              <FaRocket size={9} /> Estudo · Simulado Geral · Plantão Express
            </span>
          )}

          {/* CAMPOS CONDICIONAL: SUPER APOSTAS */}
          {destino === "super_apostas" && (
            <>
              <select value={edicaoSuperApostas} onChange={e => setEdicaoSuperApostas(e.target.value)} style={{ ...st.select, borderColor: "rgba(239,68,68,0.4)", color: "#ef4444" }}>
                {SUPER_APOSTAS_CONFIG.edicoes.map(e => (
                  <option key={e.valor} value={e.valor}>{e.label}</option>
                ))}
              </select>
              <span style={{
                fontSize: "10px", fontWeight: "800", display: "flex", alignItems: "center",
                gap: "5px", whiteSpace: "nowrap", background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px", padding: "6px 10px", color: "#ef4444"
              }}>
                🔄 Auto: BAIXO→MÉDIO→ALTO
              </span>
              <span style={{ fontSize: "10px", color: "#ef4444", fontWeight: "800", display: "flex", alignItems: "center", gap: "4px", whiteSpace: "nowrap" }}>
                <FaBan size={9} /> SEM INEP
              </span>
            </>
          )}
        </div>

        {/* PUBLICAR */}
        <button onClick={publicarLote} disabled={publicando || questoes.length === 0} style={{
          ...st.btnFinal,
          opacity: publicando || questoes.length === 0 ? 0.6 : 1,
          cursor: publicando || questoes.length === 0 ? "not-allowed" : "pointer"
        }}>
          {publicando ? (
            <><FaSpinner size={12} style={{ animation: "spin 1s linear infinite" }} /> {publicados}/{questoes.length}</>
          ) : (
            <><FaUpload size={12} /> PUBLICAR {questoes.length > 0 ? `(${questoes.length})` : "TUDO"}</>
          )}
        </button>
      </div>

      {/* ─── ABA IMPORTAR ─── */}
      {abaInterna === "lote" && (
        <div style={st.loteContainer}>
          {/* SUB-ABAS: JSON ou IA */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
            <button onClick={() => setAbaIA("json")} style={abaIA === "json" ? st.subTabActive : st.subTab}>
              <FaCode size={11} /> COLAR JSON
            </button>
            <button onClick={() => setAbaIA("gerador")} style={abaIA === "gerador" ? { ...st.subTabActive, background: "linear-gradient(135deg,#7c3aed,#4f46e5)" } : st.subTab}>
              <FaMagic size={11} /> ✨ GERAR COM IA
            </button>
          </div>

          {abaIA === "json" ? (
            <div>
              <div style={st.infoCard}>
                <FaExclamationTriangle color="#fbbf24" size={14} />
                <span style={{ color: "#94a3b8", fontSize: "12px", lineHeight: 1.5 }}>
                  Cole o JSON de questões abaixo. Use o prompt padrão no ChatGPT ou Claude para gerar questões no formato correto.
                </span>
                <button onClick={copiarPrompt} style={st.btnCopiarPrompt}>
                  {copiado ? <><FaCheck size={10} /> COPIADO!</> : <><FaCopy size={10} /> COPIAR PROMPT</>}
                </button>
              </div>
              <textarea
                value={jsonInput}
                onChange={e => setJsonInput(e.target.value)}
                placeholder='Cole o JSON aqui... Ex: [{"materia": "Clínica Médica", "enunciado": "...", ...}]'
                style={st.areaLote}
              />
              <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
                <button onClick={processarLoteIA} disabled={!jsonInput.trim()} style={{
                  ...st.btnProcessar, opacity: !jsonInput.trim() ? 0.5 : 1
                }}>
                  GERAR CARDS DE REVISÃO
                </button>
                <button onClick={() => { setShowManual(true); }} style={st.btnManualSm}>
                  <FaBookMedical size={11} /> VER FORMATO
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ ...st.infoCard, borderColor: "rgba(124,58,237,0.3)", background: "rgba(124,58,237,0.08)" }}>
                <FaMagic color="#818cf8" size={14} />
                <span style={{ color: "#94a3b8", fontSize: "12px", lineHeight: 1.5 }}>
                  Descreva o que quer gerar e a IA cria as questões automaticamente no formato do RevalidaPro.
                </span>
              </div>

              <textarea
                value={promptUsuario}
                onChange={e => setPromptUsuario(e.target.value)}
                placeholder="Ex: Gere 3 questões de Cardiologia sobre Insuficiência Cardíaca Congestiva, nível de dificuldade moderado, com foco em diagnóstico e conduta..."
                style={{ ...st.areaLote, minHeight: "120px", borderColor: "rgba(124,58,237,0.3)" }}
              />

              {erroIA && (
                <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid #ef4444", borderRadius: "10px", padding: "12px", marginTop: "10px", color: "#ef4444", fontSize: "12px" }}>
                  {erroIA}
                </div>
              )}

              {cooldownRestante > 0 && !gerandoIA && (
                <div style={{ fontSize: "11px", color: "#64748b", marginTop: "10px", textAlign: "center" }}>
                  ⏳ Aguarde {cooldownRestante}s para gerar novamente (limite de uso)
                </div>
              )}
              <button
                onClick={gerarViaIA}
                disabled={gerandoIA || cooldownRestante > 0 || !promptUsuario.trim()}
                style={{
                  ...st.btnProcessar,
                  marginTop: "14px",
                  background: cooldownRestante > 0
                    ? "linear-gradient(135deg, #374151, #1e293b)"
                    : "linear-gradient(135deg, #7c3aed, #4f46e5)",
                  opacity: (gerandoIA || cooldownRestante > 0 || !promptUsuario.trim()) ? 0.6 : 1
                }}
              >
                {gerandoIA
                  ? <><FaSpinner size={12} style={{ animation: "spin 1s linear infinite" }} /> GERANDO QUESTÕES...</>
                  : cooldownRestante > 0
                  ? <>⏳ AGUARDE {cooldownRestante}s...</>
                  : <><FaMagic size={12} /> GERAR COM IA</>
                }
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── ABA REVISÃO / CARDS ─── */}
      {abaInterna === "manual" && (
        <div style={st.cardsList}>
          {questoes.length === 0 ? (
            <div style={st.emptyImport}>
              <FaRocket size={40} style={{ opacity: 0.15, marginBottom: "16px" }} />
              <p style={{ color: "#fff", fontSize: "16px", margin: "0 0 8px" }}>Nenhuma questão na fila.</p>
              <p style={{ color: "#64748b", fontSize: "13px" }}>
                Importe via JSON ou gere com IA na aba "Importar".
              </p>
              <button onClick={() => setAbaInterna("lote")} style={st.btnGoImport}>
                <FaCode size={12} /> IR PARA IMPORTAR
              </button>
            </div>
          ) : (
            questoes.map((q, idx) => (
              <div key={idx} style={st.card}>
                {/* HEADER DO CARD */}
                <div style={st.cardHeader}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, flexWrap: "wrap" }}>
                    <span style={st.tagId}>#{idx + 1}</span>
                    <input
                      placeholder="Matéria"
                      value={q.materia}
                      onChange={e => handleChange(idx, "materia", e.target.value)}
                      style={st.miniInput}
                    />
                    <input
                      placeholder="Subtema"
                      value={q.subtema}
                      onChange={e => handleChange(idx, "subtema", e.target.value)}
                      style={{ ...st.miniInput, flex: 2 }}
                    />
                    <div style={st.gabaritoWrapper}>
                      <label style={{ color: "#64748b", fontSize: "10px", fontWeight: "700" }}>GAB.</label>
                      <select
                        value={q.gabarito}
                        onChange={e => handleChange(idx, "gabarito", e.target.value)}
                        style={st.selectGab}
                      >
                        <option value="">-</option>
                        {["a", "b", "c", "d", "e"].map(l => <option key={l} value={l}>{l.toUpperCase()}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                    <button onClick={() => toggleExpand(idx)} style={st.btnToggle} title="Expandir/Recolher">
                      {expandidos[idx] ? <FaEyeSlash size={13} color="#64748b" /> : <FaEye size={13} color="#64748b" />}
                    </button>
                    <button onClick={() => setQuestoes(questoes.filter((_, i) => i !== idx))} style={st.btnDel}>
                      <FaTrash size={13} />
                    </button>
                  </div>
                </div>

                {/* ENUNCIADO */}
                <textarea
                  value={q.enunciado}
                  onChange={e => handleChange(idx, "enunciado", e.target.value)}
                  style={st.areaEnunciado}
                  placeholder="Enunciado completo da questão..."
                  rows={4}
                />

                {/* IMAGEM */}
                <div style={st.imgRow}>
                  <FaImage color="#4f46e5" size={14} />
                  <input
                    placeholder="URL da imagem (opcional)"
                    value={q.imagemUrl}
                    onChange={e => handleChange(idx, "imagemUrl", e.target.value)}
                    style={st.inputImg}
                  />
                </div>

                {/* ALTERNATIVAS (expansível) */}
                {expandidos[idx] && (
                  <>
                    <div style={st.altsGrid}>
                      {["a", "b", "c", "d", "e"].map(l => (
                        <div key={l} style={{
                          ...st.altBox,
                          borderLeft: q.gabarito === l ? "3px solid #10b981" : "3px solid #334155"
                        }}>
                          <div style={st.altTop}>
                            <span style={{
                              ...st.letraIcon,
                              background: q.gabarito === l ? "#10b981" : "#1e293b",
                              color: "#fff"
                            }}>{l.toUpperCase()}</span>
                            <input
                              value={q.alts?.[l]?.texto || ""}
                              onChange={e => handleChange(idx, l, e.target.value, "texto")}
                              style={st.inputAlt}
                              placeholder={`Alternativa ${l.toUpperCase()}...`}
                            />
                          </div>
                          <textarea
                            value={q.alts?.[l]?.nota || ""}
                            onChange={e => handleChange(idx, l, e.target.value, "nota")}
                            style={st.areaNota}
                            placeholder="Justificativa desta alternativa..."
                            rows={2}
                          />
                        </div>
                      ))}
                    </div>

                    {/* CAMPOS DO PROFESSOR */}
                    <div style={st.expertGrid}>
                      <div style={st.expertField}>
                        <label style={{ ...st.expertLabel, color: "#818cf8" }}>
                          <FaStethoscope size={11} /> RACIOCÍNIO CLÍNICO
                        </label>
                        <textarea
                          value={q.raciocinio}
                          onChange={e => handleChange(idx, "raciocinio", e.target.value)}
                          style={st.areaExpert}
                          placeholder="Fisiopatologia, diagnóstico diferencial..."
                          rows={4}
                        />
                      </div>
                      <div style={st.expertField}>
                        <label style={{ ...st.expertLabel, color: "#10b981" }}>
                          <FaFlask size={11} /> CONDUTA / TTO
                        </label>
                        <textarea
                          value={q.tto}
                          onChange={e => handleChange(idx, "tto", e.target.value)}
                          style={st.areaExpert}
                          placeholder="Tratamento, prescrição, protocolo..."
                          rows={4}
                        />
                      </div>
                      <div style={st.expertField}>
                        <label style={{ ...st.expertLabel, color: "#fbbf24" }}>
                          <FaLightbulb size={11} /> DICA DO MESTRE
                        </label>
                        <textarea
                          value={q.dicaMestre}
                          onChange={e => handleChange(idx, "dicaMestre", e.target.value)}
                          style={st.areaExpert}
                          placeholder="Regra de ouro para nunca esquecer..."
                          rows={4}
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* PREVIEW DO GABARITO */}
                {!expandidos[idx] && q.gabarito && (
                  <div style={st.gabPreview}>
                    <FaCheckCircle color="#10b981" size={11} />
                    <span style={{ color: "#10b981", fontSize: "12px", fontWeight: "700" }}>
                      Gabarito: {q.gabarito.toUpperCase()}
                    </span>
                    {q.alts?.[q.gabarito]?.texto && (
                      <span style={{ color: "#64748b", fontSize: "12px" }}>
                        — {q.alts[q.gabarito].texto.substring(0, 60)}...
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))
          )}

          {/* BOTÃO ADICIONAR MANUAL */}
          <button onClick={adicionarQuestaoManual} style={st.btnAddManual}>
            <FaPlus size={12} /> ADICIONAR QUESTÃO MANUAL
          </button>
        </div>
      )}

      {/* MODAL MANUAL */}
      {showManual && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "580px", background: "#1e293b", position: "relative", maxHeight: "80vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ color: "#fff", margin: 0, fontSize: "16px" }}>📋 Padrão RevalidaPro</h3>
              <button onClick={() => setShowManual(false)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer" }}>
                <FaTimes size={20} />
              </button>
            </div>
            <pre style={st.pre}>{tutorialTexto}</pre>
            <div style={{ marginTop: "16px", background: "#020617", borderRadius: "12px", padding: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <span style={{ color: "#818cf8", fontSize: "12px", fontWeight: "700" }}>PROMPT PARA IA:</span>
                <button onClick={copiarPrompt} style={st.btnCopiarPrompt}>
                  {copiado ? <><FaCheck size={10} /> COPIADO!</> : <><FaCopy size={10} /> COPIAR</>}
                </button>
              </div>
              <pre style={{ ...st.pre, background: "transparent", padding: 0, fontSize: "10px", maxHeight: "150px", overflow: "auto" }}>
                {PROMPT_SISTEMA.substring(0, 300)}...
              </pre>
            </div>
          </div>
        </div>
      )}

      <style>{`
        * { box-sizing: border-box; }
        .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px; }
        .modal-content { padding: 28px; border-radius: 24px; width: 100%; }
        @keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
        @media (max-width: 768px) {
          .imp-topnav { flex-direction: column !important; gap: 12px !important; }
          .imp-controls { justify-content: flex-start !important; }
          .imp-card-header { flex-direction: column !important; }
        }
      `}</style>
    </div>
  );
};

const st = {
  container: { padding: "0", background: "#020617", minHeight: "500px" },
  topNav: { display: "flex", gap: "12px", marginBottom: "24px", background: "#1e293b", padding: "14px", borderRadius: "18px", alignItems: "center", border: "1px solid #334155", flexWrap: "wrap" },
  tabsGroup: { display: "flex", gap: "8px", flexShrink: 0 },
  tab: { background: "none", border: "1px solid #334155", color: "#64748b", padding: "9px 16px", borderRadius: "10px", cursor: "pointer", fontWeight: "700", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" },
  tabActive: { background: "#4f46e5", border: "1px solid #4f46e5", color: "#fff", padding: "9px 16px", borderRadius: "10px", fontWeight: "700", fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" },
  controls: { display: "flex", gap: "12px", alignItems: "center", flex: 1, flexWrap: "wrap" },
  select: { background: "#0f172a", color: "#fff", border: "1px solid #334155", padding: "8px 12px", borderRadius: "8px", fontSize: "12px", cursor: "pointer", outline: "none" },
  checkLabel: { color: "#94a3b8", fontSize: "11px", display: "flex", gap: "6px", alignItems: "center", cursor: "pointer", fontWeight: "700", whiteSpace: "nowrap" },
  btnFinal: { background: "#10b981", color: "#fff", border: "none", padding: "10px 18px", borderRadius: "12px", fontWeight: "800", fontSize: "12px", display: "flex", alignItems: "center", gap: "7px", transition: "0.2s" },
  loteContainer: { background: "#1e293b", padding: "24px", borderRadius: "20px", border: "1px solid #334155", marginBottom: "20px" },
  subTab: { background: "#0f172a", border: "1px solid #334155", color: "#64748b", padding: "9px 16px", borderRadius: "10px", cursor: "pointer", fontWeight: "700", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" },
  subTabActive: { background: "#4f46e5", border: "1px solid #4f46e5", color: "#fff", padding: "9px 16px", borderRadius: "10px", fontWeight: "700", fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" },
  infoCard: { display: "flex", alignItems: "flex-start", gap: "10px", background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: "12px", padding: "12px 14px", marginBottom: "14px", flexWrap: "wrap" },
  btnCopiarPrompt: { background: "#4f46e5", color: "#fff", border: "none", padding: "6px 12px", borderRadius: "8px", fontSize: "11px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px", whiteSpace: "nowrap", flexShrink: 0 },
  areaLote: { width: "100%", minHeight: "200px", background: "#020617", color: "#10b981", padding: "16px", borderRadius: "14px", border: "1px solid #334155", fontFamily: "monospace", fontSize: "13px", lineHeight: 1.6, resize: "vertical", outline: "none", boxSizing: "border-box" },
  btnProcessar: { background: "#4f46e5", color: "#fff", border: "none", padding: "12px 24px", borderRadius: "12px", fontWeight: "800", cursor: "pointer", fontSize: "13px", display: "flex", alignItems: "center", gap: "8px" },
  btnManualSm: { background: "rgba(79,70,229,0.1)", border: "1px solid rgba(79,70,229,0.3)", color: "#818cf8", padding: "12px 16px", borderRadius: "12px", fontSize: "12px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" },
  cardsList: { display: "flex", flexDirection: "column", gap: "20px" },
  emptyImport: { textAlign: "center", padding: "60px 20px", display: "flex", flexDirection: "column", alignItems: "center" },
  btnGoImport: { marginTop: "16px", background: "#4f46e5", color: "#fff", border: "none", padding: "12px 24px", borderRadius: "12px", fontWeight: "700", fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" },
  card: { background: "#1e293b", padding: "20px", borderRadius: "20px", border: "1px solid #334155" },
  cardHeader: { display: "flex", gap: "10px", marginBottom: "14px", alignItems: "flex-start", flexWrap: "wrap" },
  tagId: { background: "#4f46e5", color: "#fff", fontSize: "11px", padding: "4px 10px", borderRadius: "8px", fontWeight: "800", flexShrink: 0, alignSelf: "center" },
  miniInput: { background: "#0f172a", border: "1px solid #334155", color: "#fff", padding: "9px 12px", borderRadius: "10px", flex: 1, fontSize: "12px", outline: "none", minWidth: "100px" },
  gabaritoWrapper: { display: "flex", flexDirection: "column", gap: "2px", flexShrink: 0 },
  selectGab: { background: "#0f172a", color: "#10b981", border: "1px solid #334155", padding: "8px", borderRadius: "8px", fontSize: "13px", fontWeight: "800", cursor: "pointer", width: "56px", outline: "none" },
  btnToggle: { background: "rgba(255,255,255,0.05)", border: "1px solid #334155", borderRadius: "8px", padding: "8px", cursor: "pointer" },
  btnDel: { background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", padding: "8px", borderRadius: "8px", cursor: "pointer" },
  areaEnunciado: { width: "100%", background: "#0f172a", border: "1px solid #334155", color: "#fff", padding: "14px", borderRadius: "12px", fontSize: "14px", lineHeight: 1.6, resize: "vertical", outline: "none", fontFamily: "inherit", boxSizing: "border-box" },
  imgRow: { display: "flex", alignItems: "center", gap: "10px", background: "#020617", padding: "10px 14px", borderRadius: "10px", margin: "12px 0" },
  inputImg: { background: "none", border: "none", color: "#818cf8", width: "100%", outline: "none", fontSize: "13px" },
  altsGrid: { display: "flex", flexDirection: "column", gap: "10px", margin: "16px 0" },
  altBox: { background: "rgba(15,23,42,0.6)", padding: "14px", borderRadius: "12px", borderLeft: "3px solid #334155" },
  altTop: { display: "flex", gap: "10px", marginBottom: "8px", alignItems: "center" },
  letraIcon: { width: "28px", height: "28px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "800", fontSize: "12px", flexShrink: 0 },
  inputAlt: { flex: 1, background: "#0f172a", border: "1px solid #334155", color: "#fff", padding: "8px 12px", borderRadius: "8px", fontSize: "13px", outline: "none" },
  areaNota: { width: "100%", background: "transparent", border: "none", color: "#64748b", fontSize: "12px", resize: "none", outline: "none", fontFamily: "inherit", lineHeight: 1.5, boxSizing: "border-box" },
  expertGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px", marginTop: "16px" },
  expertField: { display: "flex", flexDirection: "column", gap: "8px" },
  expertLabel: { fontSize: "10px", fontWeight: "800", display: "flex", alignItems: "center", gap: "5px", letterSpacing: "0.5px", textTransform: "uppercase" },
  areaExpert: { background: "#0f172a", border: "1px solid #334155", borderRadius: "10px", color: "#cbd5e1", padding: "12px", fontSize: "13px", resize: "vertical", fontFamily: "inherit", lineHeight: 1.5, outline: "none", boxSizing: "border-box" },
  gabPreview: { display: "flex", alignItems: "center", gap: "8px", marginTop: "10px", padding: "8px 12px", background: "rgba(16,185,129,0.06)", borderRadius: "8px", border: "1px solid rgba(16,185,129,0.15)", flexWrap: "wrap" },
  btnAddManual: { padding: "20px", background: "none", border: "2px dashed #334155", color: "#64748b", borderRadius: "16px", cursor: "pointer", fontWeight: "700", fontSize: "13px", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", transition: "0.2s" },
  pre: { background: "#020617", color: "#10b981", padding: "16px", borderRadius: "12px", whiteSpace: "pre-wrap", fontSize: "11px", lineHeight: 1.6, overflow: "auto" },
  // ─── SUPER APOSTAS ───────────────────────────────────────────────────────────
  destinoBtn: { background: "none", border: "none", color: "#64748b", padding: "6px 12px", borderRadius: "8px", cursor: "pointer", fontWeight: "700", fontSize: "11px", display: "flex", alignItems: "center", gap: "5px", transition: "0.15s" },
  destinoBtnActive: { background: "#4f46e5", color: "#fff" },
  destinoBtnSA: { background: "rgba(239,68,68,0.15)", color: "#ef4444" },
};

export default ImportadorPro;
