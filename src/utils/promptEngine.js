/**
 * promptEngine.js — Engine editorial centralizada do RevalidaPro
 *
 * FONTE DA VERDADE para toda lógica compartilhada de geração de questões.
 * Consumidores: ImportadorPro.jsx, RoboGerador.jsx
 *
 * ⚠️  Edite AQUI, não nos componentes.
 *    Qualquer refinamento pedagógico feito neste arquivo
 *    afeta automaticamente ImportadorPro E RoboGerador.
 *
 * Diferenças intencionais mantidas por consumidor:
 *   - PROMPT_SISTEMA_IMPORTADOR: limites maiores (enunciado 220 / raciocinio 110 / tto 120 / dica 40)
 *   - PROMPT_SISTEMA_ROBO      : limites menores (enunciado 200 / raciocinio 100 / tto 110 / dica 38)
 *                                + seção "Interpretação do Tema" para temas em texto livre
 *   - PROMPT_MIGRACAO e PROMPT_RESUMO_TEMA: exclusivos do RoboGerador, ficam nele
 */

import { auth, obterTokenAppCheck } from "../firebase";
import { obterHeadersAutenticados } from "./apiAuth";

// ─── SUPER APOSTAS — Ciclo de Nível de Aposta ────────────────────────────────
// Sequência BAIXO → MEDIO → ALTO aplicada ciclicamente por questão.
// Para lotes < 3 usa os últimos N do ciclo (garante nível máximo em lotes menores).
export const CICLO_NIVEIS_SA = ["BAIXO", "MEDIO", "ALTO"];

export const atribuirNivelAposta = (indexQuestao, totalQuestoes) => {
  if (totalQuestoes <= 3) return CICLO_NIVEIS_SA[(3 - totalQuestoes) + indexQuestao];
  return CICLO_NIVEIS_SA[indexQuestao % 3];
};

// ─── STATUS DE ATUALIZAÇÃO DE DIRETRIZ ───────────────────────────────────────
// ano_diretriz >= 2024 → "atual" | < 2024 ou ausente → "revisar"
export const calcularStatusAtualizacao = (ano_diretriz) => {
  if (!ano_diretriz || typeof ano_diretriz !== "number") return "revisar";
  return ano_diretriz >= 2024 ? "atual" : "revisar";
};

// ─── EXTRAÇÃO ROBUSTA DE JSON DA RESPOSTA DA IA ──────────────────────────────
// Encontra o array/objeto JSON exato usando contagem de colchetes,
// ignorando texto anterior, posterior ou cercas markdown.
export const extrairJSONDoTexto = (str) => {
  const idxArray = str.indexOf("[");
  const idxObj   = str.indexOf("{");
  const abridor  = idxArray === -1 ? "{" : idxObj === -1 || idxArray < idxObj ? "[" : "{";
  const fechador  = abridor === "[" ? "]" : "}";
  const inicio   = abridor === "[" ? idxArray : idxObj;
  if (inicio === -1) return null;

  let profundidade = 0;
  let emString     = false;
  let escapeNext   = false;

  for (let i = inicio; i < str.length; i++) {
    const c = str[i];
    if (escapeNext)         { escapeNext = false; continue; }
    if (c === "\\")         { escapeNext = true;  continue; }
    if (c === '"')          { emString = !emString; continue; }
    if (emString)           continue;
    if (c === abridor)      profundidade++;
    else if (c === fechador) {
      profundidade--;
      if (profundidade === 0) {
        const trecho = str.slice(inicio, i + 1);
        const parsed = JSON.parse(trecho);
        return Array.isArray(parsed) ? parsed : [parsed];
      }
    }
  }
  return null;
};

// ─── CLIENTE DA CLOUD FUNCTION ────────────────────────────────────────────────
// Chama gerarQuestoesIA, extrai e retorna o array de questões parseado.
// Uso: const questoes = await chamarIA(PROMPT_SISTEMA_ROBO, promptTema)
//
// Micro Sprint 4B.1: gerarQuestoesIA agora exige Firebase ID token
// (Authorization: Bearer <token>) — obtido aqui, na hora, via Firebase Auth.
// Se não houver usuário autenticado, obterHeadersAutenticados lança ANTES do
// fetch (0 chamadas à rede); o erro sobe para o try/catch de cada chamador
// (RoboGerador.jsx, resumoEngine.js), que já tratam qualquer falha desta
// função da mesma forma que um erro de rede comum.
export const chamarIA = async (systemPrompt, promptUsuario) => {
  const isDev = window.location.hostname === "localhost" ||
                window.location.hostname === "127.0.0.1";
  const endpoint = isDev
    ? "/functions/gerarQuestoesIA"
    : (import.meta.env.VITE_FUNCTIONS_BASE_URL ||
       "https://us-central1-revalidapro-f812e.cloudfunctions.net") + "/gerarQuestoesIA";

  const headersAuth = await obterHeadersAutenticados(auth, obterTokenAppCheck);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headersAuth },
    body: JSON.stringify({ system: systemPrompt, prompt: promptUsuario }),
  });

  if (!response.ok) {
    let errorMsg = `Erro HTTP ${response.status}`;
    try {
      const err = await response.json();
      errorMsg = err.erro || err.error || errorMsg;
    } catch (_) {}
    throw new Error(errorMsg);
  }

  const data  = await response.json();
  const texto = (data.content || []).map((c) => c.text || "").join("").trim();
  if (!texto) throw new Error("IA retornou resposta vazia.");

  const parsed = extrairJSONDoTexto(texto);
  if (!parsed || parsed.length === 0) {
    const preview = texto.substring(0, 300).replace(/\n/g, "↵");
    console.error("[promptEngine] Resposta truncada ou inválida. Início:", preview);
    const motivo = texto.length < 100
      ? "resposta muito curta — possível erro de API"
      : !texto.includes("[") && !texto.includes("{")
        ? "IA não gerou JSON — resposta em texto puro"
        : "JSON truncado — resposta cortada pelo limite de tokens";
    throw new Error(`JSON não encontrado: ${motivo}. (${texto.length} chars recebidos)`);
  }
  return parsed;
};

// ─── MAPA CANÔNICO DE TEMA_MESTRE ────────────────────────────────────────────
// Safety net pós-IA: normaliza os casos mais frequentes de fragmentação
// sem depender de chamada adicional à IA.
export const MAPA_TEMA_MESTRE = {
  // Diabetes
  "diabetes mellitus tipo 1":             "Diabetes mellitus",
  "diabetes mellitus tipo 2":             "Diabetes mellitus",
  "diabetes mellitus tipo i":             "Diabetes mellitus",
  "diabetes mellitus tipo ii":            "Diabetes mellitus",
  "cetoacidose diabética":                "Diabetes mellitus",
  "estado hiperosmolar hiperglicêmico":   "Diabetes mellitus",
  "nefropatia diabética":                 "Diabetes mellitus",
  "retinopatia diabética":                "Diabetes mellitus",
  "neuropatia diabética":                 "Diabetes mellitus",
  "pé diabético":                         "Diabetes mellitus",
  "dm1":      "Diabetes mellitus",
  "dm2":      "Diabetes mellitus",
  "dm tipo 1":"Diabetes mellitus",
  "dm tipo 2":"Diabetes mellitus",
  // Hipertensão — doença base + todas as manifestações/complicações
  "hipertensão":                          "Hipertensão arterial sistêmica",
  "hipertensão arterial":                 "Hipertensão arterial sistêmica",
  "has":                                  "Hipertensão arterial sistêmica",
  "has grave":                            "Hipertensão arterial sistêmica",
  "has leve":                             "Hipertensão arterial sistêmica",
  "hipertensão gestacional":              "Hipertensão arterial sistêmica",
  "pré-eclâmpsia":                        "Hipertensão arterial sistêmica",
  "eclâmpsia":                            "Hipertensão arterial sistêmica",
  "hellp":                                "Hipertensão arterial sistêmica",
  "síndrome hellp":                       "Hipertensão arterial sistêmica",
  "crise hipertensiva":                   "Hipertensão arterial sistêmica",
  "urgência hipertensiva":                "Hipertensão arterial sistêmica",
  "emergência hipertensiva":              "Hipertensão arterial sistêmica",
  "encefalopatia hipertensiva":           "Hipertensão arterial sistêmica",
  "retinopatia hipertensiva":             "Hipertensão arterial sistêmica",
  "nefroesclerose hipertensiva":          "Hipertensão arterial sistêmica",
  "hipertensão resistente":               "Hipertensão arterial sistêmica",
  "hipertensão acelerada":                "Hipertensão arterial sistêmica",
  "hipertensão maligna":                  "Hipertensão arterial sistêmica",
  "hipertensão secundária":               "Hipertensão arterial sistêmica",
  // Cardíaca
  "icc":                                  "Insuficiência cardíaca",
  "icc descompensada":                    "Insuficiência cardíaca",
  "insuficiência cardíaca sistólica":     "Insuficiência cardíaca",
  "insuficiência cardíaca diastólica":    "Insuficiência cardíaca",
  "insuficiência cardíaca aguda":         "Insuficiência cardíaca",
  "iam":                                  "Infarto agudo do miocárdio",
  "sca com supra":                        "Infarto agudo do miocárdio",
  "angina instável":                      "Doença arterial coronariana",
  "sca sem supra":                        "Doença arterial coronariana",
  "síndrome coronariana aguda":           "Doença arterial coronariana",
  "insuficiência coronariana":            "Doença arterial coronariana",
  // Respiratório
  "dpoc":                                 "Doença pulmonar obstrutiva crônica",
  "dpoc exacerbado":                      "Doença pulmonar obstrutiva crônica",
  "asma grave":                           "Asma",
  "asma pediátrica":                      "Asma",
  "asma brônquica":                       "Asma",
  "pac":                                  "Pneumonia",
  "pneumonia adquirida na comunidade":    "Pneumonia",
  "pneumonia bacteriana":                 "Pneumonia",
  "pneumonia viral":                      "Pneumonia",
  // Sepse
  "sepse grave":                          "Sepse",
  "sepse neonatal":                       "Sepse",
  "choque séptico":                       "Sepse",
  // Outros
  "ivas":                                 "Infecção das vias aéreas superiores",
};

// ─── PADRÕES DE FRAGMENTAÇÃO ─────────────────────────────────────────────────
// Detecta tema_mestre inválido: tipagem, qualificadores ou abreviações proibidas.
export const PADROES_FRAGMENTADOS = [
  /\btipo\s+(1|2|3|i|ii|iii|iv)\b/i,
  /\s*[-—]\s*(tratamento|diagnóstico|complicaç|classificaç|crise|controle|manejo|rastreamento)/i,
  /\s+(pediátric[ao]|neonatal|no idoso|gestacional|em gestante|na gravidez)\b/i,
  /\s+(grave|leve|moderada|descompensad[ao]|exacerbad[ao]|agud[ao]|avançad[ao])\s*$/i,
  /^(has|dm2?|dm1|icc|iam|dpoc|pac|ivas|sca)$/i,
  /hipertensiv[ao]/i,
  /diabétic[ao]/i,
  /^\s*(crise|exacerbação|emergência|urgência)\s+(de|da|do|das|dos)\s+/i,
  /\b(crise|exacerbação)\s*$/i,
];

export const estaFragmentado = (tema) => {
  if (!tema || tema === "INDEFINIDO") return false;
  return PADROES_FRAGMENTADOS.some(p => p.test(tema));
};

// ─── NORMALIZAÇÃO DE TEMA_MESTRE ─────────────────────────────────────────────
// Safety net aplicado APÓS a resposta da IA.
// Ordem: mapa exato → adjetivos de origem → remoção de prefixo/sufixo → devolve original.
export const normalizarTemaMestre = (tema) => {
  if (!tema || tema === "INDEFINIDO") return tema;
  const low = tema.toLowerCase().trim();

  if (MAPA_TEMA_MESTRE[low]) return MAPA_TEMA_MESTRE[low];

  // Adjetivos de origem — alta confiança independente do mapa
  if (/hipertensiv[ao]/i.test(low)) return "Hipertensão arterial sistêmica";
  if (/diabétic[ao]/i.test(low))    return "Diabetes mellitus";

  // Remove prefixo de contexto clínico
  let norm = tema.replace(/^\s*(crise|exacerbação|urgência|emergência)\s+(de\s+|da\s+|do\s+|das\s+|dos\s+)?/gi, "").trim();

  // Remove sufixo de contexto clínico
  norm = norm.replace(/\s+(em\s+|na\s+|no\s+)?(crise|exacerbação|emergência|urgência)\s*$/gi, "").trim();

  // Remove tipagem
  norm = norm.replace(/\s+tipo\s+(1|2|3|i|ii|iii|iv)\b/gi, "").trim();

  // Remove subtópico após traço/travessão
  norm = norm.replace(/\s*[-—]\s*(tratamento|diagnóstico|complicaç\w*|classificaç\w*|crise|manejo|conduta|rastreamento|prevenção|controle)\b.*/gi, "").trim();

  // Remove qualificadores de faixa etária/contexto
  norm = norm.replace(/\s+(pediátric[ao]|neonatal|no idoso|da gestante|gestacional|em gestante|na gravidez|do adulto|no adulto)\b.*/gi, "").trim();

  // Remove qualificadores de gravidade/evolução no final
  norm = norm.replace(/\s+(grave|leve|moderada|descompensad[ao]|exacerbad[ao]|agud[ao]|crônic[ao]|avançad[ao])\s*$/gi, "").trim();

  // Segunda passagem no mapa após limpeza
  const low2 = norm.toLowerCase();
  if (low2 !== low && MAPA_TEMA_MESTRE[low2]) return MAPA_TEMA_MESTRE[low2];

  return norm || tema;
};

// ═══════════════════════════════════════════════════════════════════════════════
// SEÇÕES DO PROMPT (internas — não exportadas individualmente)
// ⚠️  EDITE AQUI PARA AFETAR AMBOS OS MÓDULOS.
// ═══════════════════════════════════════════════════════════════════════════════

const _HEADER = `Você é um especialista em engenharia pedagógica de questões médicas para o Revalida INEP/ENAMED.
Responda SOMENTE com um array JSON. Nenhum texto antes. Nenhum texto depois. Sem markdown. Sem explicações.
Sua resposta deve começar com [ e terminar com ].`;

// Exclusivo do RoboGerador: interpreta temas livres com subtemas embutidos no texto.
// O ImportadorPro usa taxonomia controlada (dropdowns), não precisa desta seção.
const _INTERPRETACAO_TEMA_ROBO = `
═══ INTERPRETAÇÃO INTELIGENTE DO TEMA ═══
O campo "tema" pode conter diferentes níveis de detalhe. Interprete assim:

TEMA SIMPLES (ex: "Hipertensão arterial sistêmica"):
→ Gere questões variadas cobrindo diferentes aspectos clínicos do tema.

TEMA COM DETALHAMENTO (ex: "HAS — classificação, tratamento farmacológico e crise hipertensiva"):
→ IDENTIFIQUE os subtemas e direcionamentos no texto.
→ PRIORIZE esses elementos: cada questão deve cobrir uma parte diferente do detalhamento OU integrar múltiplos itens em um caso clínico.
→ NUNCA ignore elementos após vírgulas, hífens ou parênteses.
→ NUNCA gere questões genéricas quando houver detalhamento explícito.

TEMA INFORMAL/ABREVIADO (ex: "HAS - tto / complicações / crise"):
→ Converta mentalmente em subtemas clínicos e aplique normalmente.

ESTRATÉGIA DE DISTRIBUIÇÃO quando houver múltiplos subtemas:
- 1 questão por subtema, OU
- Integrar múltiplos temas em um único caso clínico, OU
- Mistura das duas abordagens — sempre priorizando o mais cobrado em prova.`;

// ⚠️  REGRAS PEDAGÓGICAS CANÔNICAS — fonte da verdade para ambos os módulos.
const _REGRAS_PEDAGOGICAS = `
═══ REGRA 1 — NÃO ENTREGUE O DIAGNÓSTICO PRECOCEMENTE ═══
O enunciado deve apresentar dados clínicos progressivamente, como um plantão real.
PROIBIDO: iniciar com diagnóstico fechado ("Paciente diabético em uso de insulina, qual a conduta?").
CORRETO: sintomas → sinais → exames → contexto → forçar tomada de decisão.
Use linguagem de plantão: "chega ao PS com...", "comparece à UBS referindo...", "é admitido na enfermaria com...".
Inclua sempre: idade, sexo, contexto clínico (UBS/UPA/PS/enfermaria), sinais vitais relevantes, exames pertinentes.

═══ REGRA 2 — DISTRATORES E JUSTIFICATIVA PEDAGÓGICA ═══
Cada alternativa errada deve explorar um erro cognitivo específico. Use estes tipos:
• CONFUSÃO DIAGNÓSTICA: conduta correta para doença semelhante (ex: trata IC como pneumonia)
• TIMING INCORRETO: exame ou conduta corretos, porém no momento inadequado para o caso
• TRATAMENTO INCOMPLETO: conduta parcialmente certa, faltando passo essencial
• DIRETRIZ ANTIGA: conduta que foi padrão mas está desatualizada (ex: morfina na IC aguda)
• ARMADILHA DE CLASSE: dois fármacos similares — um indicado, outro contraindicado neste caso
• EXCESSO DE INTERVENÇÃO: conduta mais invasiva do que o necessário para o estágio atual
No campo "nota" de cada alternativa INCORRETA: nomeie o TIPO DE ERRO no início e explique brevemente.

ALTERNATIVA CORRETA — nota obrigatoriamente pedagógica:
A nota da alternativa correta NÃO pode ser genérica. São exemplos PROIBIDOS:
  ✗ "CORRETA: conduta adequada." | ✗ "CORRETA: segue diretriz." | ✗ "CORRETA: diagnóstico correto."
A nota DEVE funcionar como um mini reforço de aprendizado. Deve conter:
  1. O MOTIVO clínico da escolha (o que nos dados do caso leva a esta resposta)
  2. A DIRETRIZ ou fundamento que sustenta a conduta (com nome da fonte quando possível)
  3. O DETALHE que consolida o aprendizado (dose, critério, periodicidade, contraindicação relevante, nuance)
Exemplos CORRETOS de nota da alternativa certa:
  ✓ "CORRETA. Fluconazol 150 mg dose única é a 1ª escolha para candidíase não complicada (FEBRASGO 2023). O pH ácido e o corrimento caseoso confirmam o diagnóstico; o antibiótico prévio explica a quebra da microbiota."
  ✓ "CORRETA. Bundle 1h da Surviving Sepsis: hemoculturas → ATB em ≤1h → cristaloide 30 mL/kg. Lactato ≥4 mmol/L caracteriza choque séptico críptico mesmo sem hipotensão."
  ✓ "CORRETA. Rastreamento de câncer de colo uterino pelo MS: início aos 25 anos, citologia a cada 3 anos após 2 exames anuais negativos. Não iniciar antes dos 25 mesmo com vida sexual ativa."
Em temas de Preventiva, APS, rastreamento, vacinação e pré-natal a nota DEVE incluir:
  critério de indicação + periodicidade ou dose + fundamento (MS/SUS, PCDT ou diretriz nomeada).

═══ REGRA 3 — RACIOCÍNIO CLÍNICO EM ETAPAS (FORMATO RÍGIDO) ═══
O campo "raciocinio" usa EXCLUSIVAMENTE este formato de 4 seções separadas por " → ":
PADRÃO: [achados que identificam o caso] → DIFERENCIAL: [o que confundiria e por quê é excluído] → DECISÃO: [conduta e justificativa neste momento] → ARMADILHA: [erro mais comum que o aluno comete]

OBRIGATÓRIO — sem exceção:
✓ Exatamente estes 4 labels em MAIÚSCULAS: PADRÃO, DIFERENCIAL, DECISÃO, ARMADILHA
✓ Separador " → " (espaço + seta + espaço) entre cada seção
✓ Conteúdo objetivo, sem repetir dados do enunciado
✓ Manter a ordem: PADRÃO → DIFERENCIAL → DECISÃO → ARMADILHA

PROIBIDO — qualquer desvio quebra o layout premium do sistema:
✗ Texto corrido sem labels ("O quadro clínico sugere...", "O paciente apresenta...")
✗ Labels alternativos: "Padrão clínico:", "Diagnóstico:", "Conduta:", "Pegadinha:", "Raciocínio:"
✗ Emojis, markdown (**negrito**), bullet points, numeração (1. 2. 3.)
✗ Omitir qualquer um dos 4 labels — todos são obrigatórios
✗ Trocar ou mesclar a ordem PADRÃO → DIFERENCIAL → DECISÃO → ARMADILHA

═══ REGRA 4 — GLOSSÁRIO INLINE ═══
Na PRIMEIRA aparição de sigla ou termo técnico pouco familiar, adicione explicação entre parênteses:
"DPOC (doença pulmonar obstrutiva crônica)", "ortopneia (falta de ar ao deitar que melhora ao sentar)",
"CURB-65 (escore de gravidade da pneumonia adquirida na comunidade)", "TRAb (anticorpo anti-receptor de TSH)"
NÃO explicar termos básicos: PA, FC, FR, febre, dor, náusea, UBS, PS, UTI, VO, IV, SC. Não repetir na mesma questão.

═══ REGRA 5 — NÍVEL COGNITIVO E DIFICULDADE ═══
Exigir APLICAÇÃO ou ANÁLISE clínica. Memorização pura não é aceita.
PROIBIDO: enunciado curto que entrega o diagnóstico em uma frase ("Paciente com DM2 em CAD, qual a primeira conduta?").
PROIBIDO: pergunta cujo gabarito é obtível sem raciocinar o caso (triagem por palavra-chave isolada).
OBRIGATÓRIO: o aluno deve integrar pelo menos 3 dados clínicos antes de chegar à resposta.
Dificuldade-alvo: igual ou superior ao Revalida INEP moderno. Não é prova de residência irreal, mas exige raciocínio clínico genuíno.
Priorizar nesta ordem: 1) tomada de decisão no momento exato | 2) interpretação de exames em contexto | 3) diagnóstico diferencial com exclusão ativa | 4) classificação com impacto de conduta.
Varie os comandos entre questões do mesmo lote — nunca use a mesma estrutura de pergunta duas vezes consecutivas.

═══ REGRA 6 — CONTEXTO SUS/APS OBRIGATÓRIO ═══
Alterne entre: UBS/ESF (APS, conduta inicial, critério de encaminhamento) | UPA/PS (urgência, estabilização)
Enfermaria (interpretação de exames, piora clínica, alta) | Pré-natal/GO (contexto obstétrico realista).
Linguagem clínica humana. Contextualize narrativamente — evite listas de sintomas sem contexto.

═══ REGRA 7 — PERGUNTA DE FECHAMENTO OBRIGATÓRIA ═══
O enunciado DEVE terminar com uma pergunta clínica explícita, em linguagem natural, alinhada ao objetivo cognitivo da questão.
A pergunta cria a tensão clínica que força o raciocínio. Sem ela o enunciado é inválido.

BANCO DE FECHAMENTOS — alterne naturalmente, nunca repita a mesma estrutura em questões consecutivas do mesmo lote:
• "Qual é a conduta mais adequada neste momento?"
• "Qual deve ser a abordagem inicial neste caso?"
• "Qual é o próximo passo diagnóstico mais adequado?"
• "Qual exame deve ser solicitado prioritariamente?"
• "Qual é o diagnóstico mais provável?"
• "O que melhor explica o quadro clínico apresentado?"
• "Qual é a classificação de gravidade deste paciente?"
• "O que deve ser feito segundo as diretrizes atuais?"
• "Qual seria o erro mais grave na abordagem deste caso?"
• "O que diferencia este caso de [condição similar] e muda a conduta?"
• "Qual a conduta preconizada pelo Ministério da Saúde para este cenário?"
• "Qual o fator mais importante que determina a conduta neste momento?"

PROIBIDO:
• Enunciado sem pergunta explícita no final
• Reutilizar a mesma estrutura de pergunta em questões do mesmo lote
• Perguntas que entregam o gabarito na própria formulação ("Qual o tratamento de escolha do IAM com supra?")
• "Qual o diagnóstico?" quando a tríade diagnóstica está explícita e óbvia no enunciado

═══ DIRETRIZES ATUALIZADAS ═══
Priorizar: MS/SUS 2023-2025, PCDT, FEBRASGO, CFM, SBC, SBPT, SBEM.
Se usar conduta de diretriz anterior a 2023, sinalizar no raciocinio: "Conforme diretriz [ANO]..."
Condutas de APS devem seguir os Cadernos de Atenção Primária vigentes.`;

// Schema JSON compartilhado — estrutura idêntica para ambos os consumidores.
const _SCHEMA_QUESTAO = `{"materia":"string","tema_mestre":"Nome da doença principal sem tipagem e sem abreviação","subtema":"string","banca":"Revalida INEP","ano":"2025","numeroQuestao":1,"enunciado":"caso progressivo sem diagnóstico prematuro","imagemUrl":"","alts":{"a":{"texto":"","nota":"TIPO ERRO: explicação"},"b":{"texto":"","nota":"TIPO ERRO: explicação"},"c":{"texto":"","nota":""},"d":{"texto":"","nota":""},"e":{"texto":"","nota":""}},"gabarito":"letra_correta","raciocinio":"PADRÃO: ... → DIFERENCIAL: ... → DECISÃO: ... → ARMADILHA: ...","tto":"conduta completa atualizada com doses quando pertinente","dicaMestre":"regra de ouro objetiva","ano_diretriz":2024,"fonte_diretriz":"MS/SUS 2024"}`;

// Limites de tokens — intencionalmente diferentes.
// Robo: menores para caber 3 questões dentro do max_tokens:8192 da Cloud Function.
const _LIMITES_IMPORTADOR = `═══ LIMITES DE TAMANHO OBRIGATÓRIOS ═══
enunciado: mín 80 palavras, máx 220 palavras | alts[x].texto: máx 22 palavras | alts[x].nota: máx 55 palavras
raciocinio: máx 110 palavras | tto: máx 120 palavras | dicaMestre: máx 40 palavras
Seja técnico e conciso. Não use frases introdutórias.`;

const _LIMITES_ROBO = `═══ LIMITES DE TAMANHO OBRIGATÓRIOS ═══
- enunciado: mínimo 80 palavras, máximo 200 palavras
- alts[x].texto: máximo 22 palavras por alternativa
- alts[x].nota: máximo 55 palavras por justificativa
- raciocinio: máximo 100 palavras
- tto: máximo 110 palavras
- dicaMestre: máximo 38 palavras
Seja técnico e conciso. Não use frases introdutórias.`;

// Regras finais de campos — ligeiramente diferentes entre os consumidores.
const _REGRAS_CAMPOS_IMPORTADOR = `REGRAS FINAIS:
- tema_mestre: nome clínico padronizado da doença principal, sem tipagem, sem subtema, sem abreviação
  ✅ "Hipertensão arterial sistêmica" | ✅ "Insuficiência cardíaca" | ✅ "Diabetes mellitus"
  ❌ "HAS", "Crise hipertensiva", "HAS em gestante", "DM tipo 2", "ICC descompensada"
- gabarito: apenas letra minúscula (a, b, c, d ou e)
- ano_diretriz: número inteiro (ex: 2024). Obrigatório.
- fonte_diretriz: string com fonte (ex: "MS/SUS 2024", "FEBRASGO 2023"). Obrigatório.
- Responda APENAS com o array JSON, começando em [ e terminando em ]`;

const _REGRAS_CAMPOS_ROBO = `Regras de campos:
- tema_mestre: OBRIGATÓRIO. Nome clínico padronizado da doença principal.
  ✅ "Asma", "Hipertensão arterial sistêmica", "Diabetes mellitus", "Insuficiência cardíaca"
  ❌ contexto: "Diabetes em gestante", "Asma pediátrica", "HAS no idoso"
  ❌ subtema: "Asma — crise aguda", "HAS — classificação"
  ❌ abreviação: "HAS", "DM2", "IC", "IAM"
  REGRA: nome da DOENÇA, sem contexto clínico e sem subtema. Derive do conteúdo, NÃO do prompt.
  NUNCA use tipagem (tipo 1, tipo 2): "Diabetes mellitus" agrupa DM1, DM2, cetoacidose e complicações.
- gabarito: apenas a letra (a, b, c, d ou e)
- ano_diretriz: número inteiro do ano da diretriz (ex: 2024). Obrigatório.
- fonte_diretriz: fonte da diretriz (ex: "MS/SUS 2024", "SBC 2025"). Obrigatório.
- JAMAIS ultrapasse os limites de tamanho definidos acima.
- Responda APENAS com o array JSON, começando em [ e terminando em ]`;

// ═══════════════════════════════════════════════════════════════════════════════
// PROMPTS COMPLETOS EXPORTADOS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Prompt sistema do ImportadorPro.
 * Limites maiores (enunciado 220 / raciocinio 110 / tto 120 / dica 40).
 * Taxonomia controlada via dropdowns — sem seção de interpretação de tema livre.
 */
export const PROMPT_SISTEMA_IMPORTADOR = `${_HEADER}
${_REGRAS_PEDAGOGICAS}

${_LIMITES_IMPORTADOR}

Estrutura obrigatória de cada questão no array:
${_SCHEMA_QUESTAO}

${_REGRAS_CAMPOS_IMPORTADOR}`;

/**
 * Prompt sistema do RoboGerador / Super Apostas.
 * Limites menores (enunciado 200 / raciocinio 100 / tto 110 / dica 38) para
 * caber 3 questões dentro do max_tokens:8192 da Cloud Function.
 * Inclui seção de interpretação de temas em texto livre (multi-subtema).
 */
export const PROMPT_SISTEMA_ROBO = `${_HEADER}
${_INTERPRETACAO_TEMA_ROBO}
${_REGRAS_PEDAGOGICAS}

${_LIMITES_ROBO}

Estrutura de cada questão no array:
${_SCHEMA_QUESTAO}

${_REGRAS_CAMPOS_ROBO}`;

// ═══════════════════════════════════════════════════════════════════════════════
// SUPER APOSTAS 2026.2 — VARIANTE ABCD (exclusiva do RoboGerador)
// ⚠️  Não usada pelo ImportadorPro nem pela edição 2026.1 (A–E). Aditivo — não
//    substitui PROMPT_SISTEMA_ROBO, que continua servindo A–E para retrocompat.
// ═══════════════════════════════════════════════════════════════════════════════

// Schema com 4 alternativas (sem "e") + campos exclusivos de Super Apostas 2026.2:
// estrategiaAposta (3 blocos ↓) e probabilidade_prova/probabilidade_justificativa
// (classificação semântica do nivel_aposta, substitui o ciclo posicional).
const _SCHEMA_QUESTAO_SA_ABCD = `{"materia":"string","tema_mestre":"Nome da doença principal sem tipagem e sem abreviação","subtema":"string","banca":"Revalida INEP","ano":"2025","numeroQuestao":1,"enunciado":"caso progressivo sem diagnóstico prematuro","imagemUrl":"","alts":{"a":{"texto":"","nota":"TIPO ERRO: explicação"},"b":{"texto":"","nota":"TIPO ERRO: explicação"},"c":{"texto":"","nota":""},"d":{"texto":"","nota":""}},"gabarito":"letra_correta_entre_a_e_d","raciocinio":"PADRÃO: ... → DIFERENCIAL: ... → DECISÃO: ... → ARMADILHA: ...","tto":"PASSO 1 — título\\nconteúdo\\nPASSO 2 — título\\nconteúdo","dicaMestre":"frase memorável ↓ o sinal que muda tudo ↓ o caminho certo ↓ por que erram","estrategiaAposta":"por que apostamos ↓ como pode cair ↓ armadilha provável","probabilidade_prova":"ALTO|MEDIO|BAIXO","probabilidade_justificativa":"1 frase curta explicando o critério usado (recorrência, atualização, importância assistencial, padrão de banca ou lacuna estratégica)","ano_diretriz":2024,"fonte_diretriz":"MS/SUS 2024"}`;

// ⚠️  REGRAS EXCLUSIVAS SUPER APOSTAS 2026.2 — NÃO fazem parte de
// _REGRAS_PEDAGOGICAS (base) e portanto NUNCA chegam ao PROMPT_SISTEMA_IMPORTADOR
// (INEP/ImportadorPro) nem ao PROMPT_SISTEMA_ROBO (Super Apostas 2026.1 / A–E).
// Só entram na composição de PROMPT_SISTEMA_SUPERAPOSTAS_ABCD, abaixo.
const _REGRAS_SUPERAPOSTAS_2026_2 = `
═══ REGRA SA-1 — EQUILÍBRIO ENTRE ALTERNATIVAS (ANTI-PISTAS) — EXCLUSIVA SUPER APOSTAS 2026.2 ═══
Todas as alternativas (correta e distratores) devem ser da MESMA CLASSE DE RESPOSTA — nunca misture tipos (ex: não misture "conduta" com "diagnóstico" nas opções de uma mesma questão).
Mantenha entre elas: comprimento visual equilibrado, complexidade gramatical semelhante, nível técnico semelhante, MESMO NÚMERO aproximado de elementos/cláusulas (não faça a correta reunir 3-4 condutas numa lista enquanto os distratores têm 1 conduta isolada).
PROIBIDO: a alternativa correta ser a mais longa entre as 4 (nem por pouco, nem por muito).
PROIBIDO: a alternativa correta ser a única a trazer números específicos, doses, critérios quantitativos ou qualificadores técnicos que os distratores não têm — se a correta detalha, os distratores devem detalhar no mesmo nível (mesmo estando clinicamente errados).
PROIBIDO: a alternativa correta ser a única "composta" (múltiplas ações unidas por vírgula/"e"/"+") enquanto os distratores são frases simples de uma ação só — construa todas as 4 com estrutura gramatical comparável (todas simples OU todas compostas).
PROIBIDO: a alternativa correta ser a única com explicação parentética extra ou justificativa embutida no próprio texto da alternativa.
PROIBIDO: usar palavras absolutas ("nunca", "sempre", "exclusivamente", "obrigatoriamente") apenas nos distratores como pista de que estão errados.
PROIBIDO: repetir palavras-chave literais do enunciado apenas na alternativa correta.
PROIBIDO: distratores rasos, genéricos ou visivelmente mais curtos/simples que a correta — cada distrator precisa ter substância clínica equivalente, não ser um "preenchimento" óbvio.
Distratores devem ser clinicamente PLAUSÍVEIS — nunca alternativas absurdas, decorativas ou obviamente erradas só para preencher espaço.
Equilíbrio não é uniformidade artificial: não sacrifique a qualidade clínica do conteúdo só para igualar a contagem exata de palavras — o objetivo é impedir que a FORMA da alternativa entregue a resposta.

═══ REGRA SA-2 — DICA MESTRE MEMORÁVEL (FORMATO RÍGIDO) — EXCLUSIVA SUPER APOSTAS 2026.2 ═══
O campo "dicaMestre" usa EXCLUSIVAMENTE 4 blocos separados pelo caractere " ↓ " (espaço + seta para baixo + espaço), NESTA ORDEM:
[frase memorável] ↓ [o sinal que muda tudo] ↓ [o caminho certo] ↓ [por que erram]
1. FRASE MEMORÁVEL: a frase-âncora que o aluno vai lembrar dias depois — curta, de impacto.
2. O SINAL QUE MUDA TUDO: o achado/dado que muda a conduta neste tema.
3. O CAMINHO CERTO: a conduta correta resumida em 1–2 frases.
4. POR QUE ERRAM: o erro mais comum que o candidato comete neste tema.
Sempre que fizer sentido para o tema, use recursos de memorização: associação memorável, analogia, mini-mnemônico, jogo de palavras inteligente, humor leve.
NÃO force humor em temas sensíveis (óbito, violência, abuso, doença grave/terminal, luto, suicídio) — nesses casos priorize clareza e respeito. NÃO infantilize esses temas — o humor/leveza serve para fixar o conceito, nunca para banalizar sofrimento ou gravidade clínica.
OBRIGATÓRIO: exatamente 4 blocos separados por " ↓ ". Nunca omita um bloco. NUNCA use outro separador — não use "|", "→", "-", numeração ("1.", "2."), nem quebra de linha como separador de bloco. Uma questão com separador errado é REJEITADA automaticamente antes de publicar.

═══ REGRA SA-3 — CONDUTA EM PASSOS COM FOCO NA 2ª FASE — EXCLUSIVA SUPER APOSTAS 2026.2 ═══
O campo "tto" usa o formato "PASSO N — título" em linhas próprias, numerado sequencialmente a partir de 1 (mínimo 2, máximo 6 passos, use somente os passos clinicamente necessários):
PASSO 1 — [título curto]
[conteúdo do passo]
PASSO 2 — [título curto]
[conteúdo do passo]
Quando clinicamente pertinente E houver um bloco "DIRETRIZ CONTROLADA" injetado neste prompt, inclua no(s) passo(s) de tratamento farmacológico: medicamento, dose, via, intervalo, duração e dose máxima quando relevante — usando EXATAMENTE os valores de "pontosCriticos" da diretriz injetada. Inclua ajustes/alternativas importantes (função renal, gestação, alergia etc.) quando pertinentes.
REGRA DURA — SEM EXCEÇÃO: quando NÃO houver bloco "DIRETRIZ CONTROLADA" injetado neste prompt, o campo "tto" NÃO PODE conter nenhum número de dose, intervalo posológico ou duração de tratamento. PROIBIDO usar, sem diretriz injetada: miligramas ("mg"), microgramas ("mcg"), gramas isoladas como unidade de dose ("g"), UI, mL, "mg/kg", "mcg/kg/min", frequências como "12/12h", "8/8h", "6/6h", "x/dia". Nesse caso, descreva a conduta em nível de CLASSE TERAPÊUTICA ou abordagem geral (ex: "diurético de alça IV", "vasopressor de escolha", "antibiótico de amplo espectro em dose única perioperatória") — expressões genéricas sem número (como "dose única", sem miligramas/UI/mL associados) SÃO PERMITIDAS, pois não constituem posologia fabricada. O que é proibido é o NÚMERO específico, não a menção genérica ao esquema. Uma questão com número de dose fabricado é REJEITADA automaticamente antes de publicar — não há meio-termo.
PROIBIDO: forçar tratamento medicamentoso em temas que não pedem conduta farmacológica (ex: rastreamento, prevenção, diagnóstico puro) — inclua apenas os passos clinicamente cabíveis.

═══ REGRA SA-4 — ATUALIZAÇÃO CLÍNICA E AFIRMAÇÕES SEM FONTE — EXCLUSIVA SUPER APOSTAS 2026.2 ═══
Você NÃO PODE considerar uma informação atualizada apenas com base na sua própria memória. Isso vale especialmente para conteúdo temporalmente sensível: tratamento, posologia, rastreamento, vacinação, critérios diagnósticos, metas terapêuticas, profilaxias, algoritmos, protocolos SUS/MS, políticas públicas, ou qualquer recomendação que possa ter mudado recentemente.
Quando NÃO houver bloco "DIRETRIZ CONTROLADA" injetado neste prompt:
- NÃO invente ano de diretriz, nome de guideline, recomendação, percentual, "atualização recente" ou frequência histórica como se fossem fato verificado nesta geração.
- EVITE termos absolutos que soam como citação de diretriz sem fonte real: "patognomônico", "padrão-ouro"/"padrão ouro", percentuais específicos ("reduz mortalidade em 30%"), "desde [ano]".
- Os campos "ano_diretriz" e "fonte_diretriz" DEVEM ficar em branco (ano_diretriz: null, fonte_diretriz: "") — não preencha com um nome/ano específico que não veio do bloco injetado.
- Prefira linguagem qualitativa e clinicamente correta ("achado característico", "abordagem preferencial", "conduta geral estabelecida") em vez de números e superlativos que parecem factuais mas não têm lastro verificado nesta geração.
Quando HOUVER bloco "DIRETRIZ CONTROLADA" injetado: use exclusivamente a fonte e o ano fornecidos nele — nunca substitua por outra diretriz da sua memória, mesmo que pareça mais familiar.

═══ REGRA SA-5 — ESTILO DE QUESTÃO REVALIDA/ENAMED — EXCLUSIVA SUPER APOSTAS 2026.2 ═══
O ENUNCIADO deve soar como uma questão real de Revalida/ENAMED, não como uma aula ou um resumo de especialista: caso clínico natural, informações clínicas suficientes para decidir SEM excesso de dados irrelevantes, pergunta objetiva, nível de complexidade compatível com um MÉDICO GENERALISTA (não hiperespecializado), UMA ÚNICA melhor resposta defensável. Evite empacotar no enunciado achados de exame ultra-específicos que só um especialista pediria rotineiramente, a menos que sejam essenciais para a decisão.
A profundidade técnica avançada (nuances, mecanismos, controvérsias) pertence às JUSTIFICATIVAS, ao RACIOCÍNIO e à CONDUTA — não ao enunciado. Se o enunciado parece "aula", está errado; se a explicação é rica e detalhada, está certo.
Conciso não significa telegráfico: preserve o contexto clínico natural (local de atendimento, quem traz o paciente, evolução no tempo) que torna o caso real — o corte mira o excesso técnico-especialista, nunca a cena clínica humana. Um enunciado sem esse contexto parece flashcard gerado por IA, não questão de banca.`;

// Limites próprios (não derivam de _LIMITES_ROBO — que continua com os números
// originais para o formato A–E). dicaMestre/tto maiores porque agora têm 4
// blocos / até 6 passos; estrategiaAposta e probabilidade_justificativa são novos.
const _LIMITES_SUPERAPOSTAS_2026_2 = `═══ LIMITES DE TAMANHO OBRIGATÓRIOS ═══
- enunciado: mínimo 80 palavras, máximo 200 palavras
- alts[x].texto: máximo 22 palavras por alternativa
- alts[x].nota: máximo 55 palavras por justificativa
- raciocinio: máximo 100 palavras
- tto: máximo 140 palavras (some o conteúdo de todos os passos)
- dicaMestre: máximo 70 palavras (some os 4 blocos)
- estrategiaAposta: máximo 45 palavras no total, somando os 3 blocos
- probabilidade_justificativa: máximo 20 palavras
Seja técnico e conciso. Não use frases introdutórias.`;

const _REGRAS_CAMPOS_ROBO_SA_ABCD = `Regras de campos:
- tema_mestre: OBRIGATÓRIO. Nome clínico padronizado da doença principal.
  ✅ "Asma", "Hipertensão arterial sistêmica", "Diabetes mellitus", "Insuficiência cardíaca"
  ❌ contexto: "Diabetes em gestante", "Asma pediátrica", "HAS no idoso"
  ❌ subtema: "Asma — crise aguda", "HAS — classificação"
  ❌ abreviação: "HAS", "DM2", "IC", "IAM"
  REGRA: nome da DOENÇA, sem contexto clínico e sem subtema. Derive do conteúdo, NÃO do prompt.
  NUNCA use tipagem (tipo 1, tipo 2): "Diabetes mellitus" agrupa DM1, DM2, cetoacidose e complicações.
- gabarito: apenas a letra (a, b, c ou d) — ESTA QUESTÃO TEM SOMENTE 4 ALTERNATIVAS. NUNCA gere a chave "e" em "alts". NUNCA use gabarito "e".
- alts[gabarito].nota: DEVE começar exatamente com a palavra "CORRETA" (não "CORRETO", não "Correta:", não outra variação) — é o marcador que confirma qual alternativa é a resposta certa. As demais notas NUNCA começam com "CORRETA".
- ano_diretriz: número inteiro do ano da diretriz (ex: 2024) — OBRIGATÓRIO somente quando houver bloco "DIRETRIZ CONTROLADA" injetado (use exatamente o ano dele). Sem esse bloco, deixe null — NÃO invente.
- fonte_diretriz: fonte da diretriz (ex: "MS/SUS 2024", "SBC 2025") — OBRIGATÓRIO somente quando houver bloco "DIRETRIZ CONTROLADA" injetado (use exatamente a fonte dele). Sem esse bloco, deixe "" — NÃO invente nome de guideline.
- estrategiaAposta: 3 blocos separados por " ↓ ", NESTA ORDEM: [por que apostamos neste tema] ↓ [como a prova pode cobrar este tema] ↓ [armadilha provável do aluno]. Curto, direto. NÃO repita literalmente frases já usadas em "raciocinio" ou "dicaMestre" — complemente, não copie.
- probabilidade_prova: classificação ALTO, MEDIO ou BAIXO da relevância estratégica deste tema para a prova — baseada em recorrência histórica, atualização recente de diretriz, importância assistencial, padrão de cobrança da banca ou lacuna estratégica do aluno médio. NUNCA use percentuais ou números de probabilidade falsos/inventados — é uma classificação qualitativa.
- probabilidade_justificativa: 1 frase curta e honesta do critério usado para chegar em "probabilidade_prova". Não é exibida ao aluno — é registro interno de auditoria.
- JAMAIS ultrapasse os limites de tamanho definidos acima.
- Responda APENAS com o array JSON, começando em [ e terminando em ]`;

/**
 * Prompt sistema do RoboGerador para Super Apostas 2026.2 — formato ABCD.
 *
 * ISOLAMENTO: reaproveita header, interpretação de tema livre e
 * _REGRAS_PEDAGOGICAS BASE (REGRA 1-7, IDÊNTICAS às usadas por
 * PROMPT_SISTEMA_IMPORTADOR e PROMPT_SISTEMA_ROBO — nada aqui altera o
 * comportamento desses dois prompts). Em cima disso, soma
 * _REGRAS_SUPERAPOSTAS_2026_2 (REGRA SA-1/SA-2/SA-3), que só existe nesta
 * composição — não é referenciada por nenhum outro export deste arquivo.
 * Uso exclusivo: RoboGerador.jsx, quando o admin ativa "Formato ABCD (2026.2)".
 */
export const PROMPT_SISTEMA_SUPERAPOSTAS_ABCD = `${_HEADER}
${_INTERPRETACAO_TEMA_ROBO}
${_REGRAS_PEDAGOGICAS}
${_REGRAS_SUPERAPOSTAS_2026_2}

${_LIMITES_SUPERAPOSTAS_2026_2}

Estrutura de cada questão no array (ATENÇÃO: somente 4 alternativas — a, b, c, d):
${_SCHEMA_QUESTAO_SA_ABCD}

${_REGRAS_CAMPOS_ROBO_SA_ABCD}`;

// ─── DISTRIBUIÇÃO DE GABARITO — SUPER APOSTAS 2026.2 ─────────────────────────
// Reatribui a letra do gabarito (sem alterar o conteúdo de cada alternativa)
// para evitar padrão previsível/repetitivo em um lote gerado. `contador` é um
// objeto mutável { a:0, b:0, c:0, d:0 } mantido pelo chamador entre lotes da
// mesma sessão de geração, para equilibrar a distribuição ao longo de todo o run.
export const equilibrarGabaritoLote = (questoes, letras, contador) => {
  return questoes.map((q) => {
    const gabaritoAtual = String(q?.gabarito || "").toLowerCase();
    const conteudoCorreto = q?.alts?.[gabaritoAtual];
    if (!q?.alts || !conteudoCorreto) return q; // gabarito não bate com alts — validação trata isso

    // Escolhe a letra menos usada até agora (empate resolvido pela ordem de `letras`)
    let escolhida = letras[0];
    let menorUso = contador[escolhida] ?? 0;
    for (const l of letras) {
      const uso = contador[l] ?? 0;
      if (uso < menorUso) { escolhida = l; menorUso = uso; }
    }

    const outrasLetras    = letras.filter((l) => l !== escolhida);
    const outrosConteudos = letras
      .filter((l) => l !== gabaritoAtual && q.alts[l])
      .map((l) => q.alts[l]);

    const novosAlts = { [escolhida]: conteudoCorreto };
    outrasLetras.forEach((l, i) => { if (outrosConteudos[i]) novosAlts[l] = outrosConteudos[i]; });

    contador[escolhida] = (contador[escolhida] ?? 0) + 1;

    return { ...q, gabarito: escolhida, alts: novosAlts };
  });
};

// ─── VALIDAÇÃO PÓS-GERAÇÃO — SUPER APOSTAS 2026.2 ────────────────────────────
// Checagem barata (sem chamada de IA extra): rejeita questões com problemas
// estruturais antes de salvar. Fase 2 (pós-auditoria do lote piloto): não usa
// mais só limite de comprimento — combina vários eixos estruturais (números,
// vírgulas/conectores, parênteses) para detectar quando a alternativa correta
// "se destaca" da forma, mesmo sem estourar limite de palavras.

// Métricas estruturais de uma alternativa (proxy barato de "sofisticação formal").
const _analisarAlternativa = (texto) => {
  const t = String(texto || "");
  return {
    palavras: t.split(/\s+/).filter(Boolean).length,
    numeros: (t.match(/\d/g) || []).length,
    virgulas: (t.match(/,/g) || []).length,
    conectores: (t.match(/\b(e|ou)\b|;|\+/gi) || []).length,
    parenteses: (t.match(/\(/g) || []).length,
  };
};

// Padrões de posologia específica (dose/via/intervalo/duração numérica).
// Sem flag "g" — usados com .test() isolado, não precisam de estado entre chamadas.
// Fase 4 (calibração final): removido o padrão isolado de "dose única" — essa
// expressão sozinha, sem número/unidade, é genérica e clinicamente inofensiva
// (ex: "profilaxia antibiótica em dose única perioperatória"). Só bloqueia
// posologia REALMENTE específica (número + unidade/intervalo/quantidade).
// Hotfix pós-Lote 001: parâmetros laboratoriais/hemodinâmicos (mmHg, mg/dL,
// mmol/L, mEq/L) NÃO são posologia — são valores medidos, não doses prescritas.
// São removidos do texto ANTES de testar os padrões de posologia, para que
// "153 mg/dL" ou "130/80 mmHg" nunca disparem falso positivo via o "mg" isolado.
const _UNIDADES_LABORATORIAIS_HEMODINAMICAS = /\d+(?:[.,]\d+)?\s*\/?\s*\d*\s*(mmhg|mg\s*\/\s*dl|mmol\s*\/\s*l|meq\s*\/\s*l)/gi;
const _PADROES_POSOLOGIA = [
  /\d+(?:[.,]\d+)?\s*(mg\/kg\/min|mcg\/kg\/min|mg\/kg\/h|mcg\/kg\/h|mg\/kg|mcg\/kg|mg\/dia|mcg|mg|\bg\b|ui\b|ml\b)/i,
  /\b\d+\s*x\s*\/?\s*dia\b/i,
  /\b\d{1,2}\s*\/\s*\d{1,2}\s*h\b/i, // 12/12h, 8/8h, 6/6h
  /\b\d+(?:[.,]\d+)?\s*(comprimidos?|cp\b|ampolas?|frascos?)/i,
];
const _contemPosologiaEspecifica = (texto) => {
  const t = String(texto || "").replace(_UNIDADES_LABORATORIAIS_HEMODINAMICAS, "");
  return _PADROES_POSOLOGIA.some((re) => re.test(t));
};

// ─── ENFORCEMENT DO ENUNCIADO (REGRA SA-5 / achado real Lote 002, Q19) ───────
// A REGRA SA-5 e o limite de 80-200 palavras já existem no prompt, mas nada em
// código verificava se o modelo obedeceu — dependia 100% da instrução ser
// seguida. Heurística simples (sem IA/NLP/regex complexa): um enunciado real
// de caso clínico sempre carrega pelo menos um marcador de idade, contexto
// assistencial ou paciente apresentando queixa. Sua ausência total é sinal
// forte de pergunta "seca"/flashcard, não de caso clínico.
const _contarPalavras = (texto) => String(texto || "").split(/\s+/).filter(Boolean).length;

const _MARCADORES_CASO_CLINICO = [
  /\d+\s*anos\b/i,
  /\d+\s*meses\b/i,
  /\d+\s*dias\s+de\s+vida\b/i,
  /\brec[eé]m[\s-]?nascid[oa]\b/i,
  /\bpaciente\b/i,
  /\bgestante\b/i,
  /\bcrian[çc]a\b/i,
  /\blactente\b/i,
  /\bidos[oa]\b/i,
  /\b(UBS|UPA|PS|enfermaria|ambulat[oó]rio|pr[eé]-natal)\b/i,
  /\bcomparece\b/i,
  /\bapresenta(-se)?\b/i,
  /\brefere\b/i,
  /\bqueixa\b/i,
  /\badmitid[oa]\b/i,
  /\bencaminhad[oa]\b/i,
  /\bd[aá]\s+entrada\b/i,
  /\bprocura\s+(a|o)\b/i,
];

const _pareceCasoClinico = (enunciado) =>
  _MARCADORES_CASO_CLINICO.some((re) => re.test(String(enunciado || "")));

// ─── SUPORTE NUMÉRICO ESTRITO — saneamento final pré-produção em escala ──────
// grounding=true não é autorização para o modelo completar/inventar precisão:
// todo número que aparece num campo normativo (tto, dicaMestre, pontos do
// resumo) precisa também aparecer no texto da diretriz efetivamente injetada.
// Sem isso, "Dengue MS 2023 existe" já bastava para o modelo acrescentar
// volumes de hidratação (mL/kg) que nunca estiveram nos pontosCriticos —
// clinicamente corretos, mas não verificados nesta geração. Heurística
// deliberadamente simples (comparação de tokens numéricos, sem RAG/busca):
// menor trava confiável compatível com a arquitetura atual.
// Hotfix cirúrgico (achado real R041): a extração original pegava QUALQUER
// sequência de dígitos, inclusive o dígito interno de um token alfanumérico
// clínico — "3TC" (lamivudina) virava número "3", "CD4"/"B12"/"T4" viravam
// "4"/"12"/"4", "H1N1" virava dois números "1". Isso gerava falso positivo de
// "número sem suporte" para siglas/nomes, não para valores clínicos reais.
// Regra lexical (sem lista infinita de siglas):
//   • dígito colado a letra ANTES (sem espaço) → sempre parte de um token
//     composto (CD4, B12, T4, SpO2...) → excluído.
//   • dígito colado a letra(s) DEPOIS (sem espaço) → só mantido se essa(s)
//     letra(s) for(em) uma unidade/medida reconhecida (h, dias, mg, %...) —
//     "36h"/"200mg"/"28dias" continuam sendo números reais; "3TC"/"H1N1" não.
// Preserva números realmente clínicos: "CD4 < 200 células/mm³" → 200 continua
// extraído (não colado a letra em nenhum lado); "TDF 300 mg" → 300 idem.
const _SUFIXOS_UNIDADE_RECONHECIDOS = /^(h|hs|horas?|min|mín|minutos?|seg|segundos?|dias?|semanas?|mes(es)?|mês|anos?|mg|mcg|g|kg|ml|l|ui|mmhg|bpm|irpm|cm|mm|m|x|vezes?)\b/i;
const _extrairNumerosSignificativos = (texto) => {
  const t = String(texto || "")
    .replace(/\bPASSO\s+\d+\b/gi, "")               // numeração estrutural do tto, não é dado clínico
    .replace(/\d+(?:[.,]\d+)?\s*[ªº]/g, "")          // ordinais (1ª, 2º...), também estruturais
    .replace(/\(\s*\d{1,2}\s*\)/g, "")               // marcadores de lista "(1)", "(2)"...
    .replace(/(^|[.!?]\s+)\d{1,2}[.)]\s+/g, "$1");   // marcadores de lista "1. "/"2) " no início de frase

  const nums = [];
  const re = /\d+(?:[.,]\d+)?/g;
  let m;
  while ((m = re.exec(t)) !== null) {
    const antes  = t.slice(0, m.index);
    const depois = t.slice(m.index + m[0].length);
    if (/\p{L}$/u.test(antes)) continue; // colado a letra antes → token composto (CD4, B12, T4...)
    const letrasDepois = depois.match(/^\p{L}+/u);
    if (letrasDepois && !_SUFIXOS_UNIDADE_RECONHECIDOS.test(letrasDepois[0])) continue; // colado a letras depois que não são unidade → token composto (3TC, H1N1...)
    nums.push(m[0]);
  }
  return nums.map((n) => n.replace(",", "."));
};
// textoCasoAutorizado (opcional, default ""): números já presentes no caso
// clínico da própria questão (enunciado) não precisam existir na diretriz —
// são reutilização de dado do caso, não precisão nova inventada pelo modelo.
// Continua exigindo IGUALDADE LITERAL (nunca cálculo/conversão/inferência):
// se o enunciado diz "36 horas" e o tto escreve "12 semanas depois", o 12
// segue exigindo suporte no grounding — não deriva de 36 de forma alguma.
// Parâmetro omitido (chamada com 2 argumentos) preserva 100% o comportamento
// anterior — usado assim por validarResumoSA, que não foi alterado.
const _numerosSemSuporte = (textoCampo, groundingTexto, textoCasoAutorizado = "") => {
  const numerosCampo = _extrairNumerosSignificativos(textoCampo);
  if (numerosCampo.length === 0) return [];
  const numerosAutorizados = new Set([
    ..._extrairNumerosSignificativos(groundingTexto),
    ..._extrairNumerosSignificativos(textoCasoAutorizado),
  ]);
  return [...new Set(numerosCampo)].filter((n) => !numerosAutorizados.has(n));
};

// Afirmações fortes que soam como citação de diretriz sem fonte controlada real.
// Hotfix de segurança do Resumo do Tema (achado real na Q23/Cefaleia, sem
// grounding): números fora do padrão de posologia (corte etário, limiar
// laboratorial) e linguagem absoluta/imperativa ("nunca", "obrigatório") não
// eram pegos por esta lista — só os 4 padrões originais (patognomônico/
// padrão-ouro/percentual/"desde ANO"). Os itens "sempre"/"nunca"/
// "obrigatório"/"em todos os casos" abaixo fecham essa lacuna. Gatilho só
// roda quando `!grounding` (ver validarLoteSA/validarResumoSA) — nunca
// bloqueia conteúdo legitimamente sustentado pela diretriz injetada.
const _PADROES_AFIRMACAO_FORTE = [
  /patognom[oô]nic[oa]/i,
  /padr[ãa]o[\s-]?ouro/i,
  /\d{1,3}\s?%/,
  /desde\s+\d{4}/i,
  /\bsempre\b/i,
  /\bnunca\b/i,
  /\bobrigat[óo]ri[ao]s?\b/i,
  /\bem todos os (casos|pacientes)\b/i,
];
const _contemAfirmacaoForte = (texto) => {
  const t = String(texto || "");
  return _PADROES_AFIRMACAO_FORTE.some((re) => re.test(t));
};

// Acha o termo exato e o trecho ao redor do 1º padrão que casar — usado para
// dar feedback específico no retry (achado real Q26/Delirium: o retry
// genérico não impediu o modelo de repetir "nunca" em outro trecho).
const _localizarAfirmacaoForte = (texto) => {
  const t = String(texto || "");
  for (const re of _PADROES_AFIRMACAO_FORTE) {
    const m = re.exec(t);
    if (m) {
      const inicio = Math.max(0, m.index - 30);
      const fim = Math.min(t.length, m.index + m[0].length + 30);
      return { termo: m[0], trecho: t.slice(inicio, fim).trim() };
    }
  }
  return null;
};

// Contraparte de _localizarAfirmacaoForte: extrai {termo, trecho} de volta do
// TEXTO DO MOTIVO de rejeição (não do conteúdo gerado) — usado pelos feedbacks
// de retry de ambos os lados (resumo e questão) para citar o achado exato sem
// duplicar a regex de extração em dois lugares.
const _extrairTermoTrechoAfirmacaoForte = (todosMotivos) => {
  const m = String(todosMotivos || "").match(/termo encontrado:\s*"([^"]+)",\s*trecho:\s*"([^"]+)"/);
  return m ? { termo: m[1], trecho: m[2] } : null;
};

// Valida/normaliza o formato da Dica Mestre. Só corrige automaticamente o caso
// ─── SANIDADE TEXTUAL — EXCLUSIVA SUPER APOSTAS 2026.2 (hotfix pré-homologação) ──
// Detecta corrupção de encoding real (ex: "Preднisona" com cirílico misturado),
// não acentuação normal do português (á, ã, ç, õ etc. ficam de fora dos ranges
// abaixo). Corrupção inequívoca = rejeição; não há autocorreção silenciosa.
// Faixas construidas por codigo numerico (String.fromCodePoint) de proposito —
// evita literais Unicode diretos no arquivo-fonte, que sao dificeis de auditar visualmente.
const _RANGE_CIRILICO   = String.fromCodePoint(0x0400) + "-" + String.fromCodePoint(0x04FF);
const _CHAR_REPLACEMENT = String.fromCodePoint(0xFFFD);
const _RANGE_ZW_1       = String.fromCodePoint(0x200B) + "-" + String.fromCodePoint(0x200F);
const _RANGE_ZW_2       = String.fromCodePoint(0x202A) + "-" + String.fromCodePoint(0x202E);
const _PADROES_CORRUPCAO_TEXTUAL = [
  new RegExp("[" + _RANGE_CIRILICO + "]"),        // caracteres cirilicos misturados em texto latino
  new RegExp(_CHAR_REPLACEMENT),                     // replacement character (encoding quebrado)
  new RegExp("[" + _RANGE_ZW_1 + _RANGE_ZW_2 + "]"), // zero-width / bidi control chars
];
const _contemCorrupcaoTextual = (texto) => {
  const t = String(texto || "");
  return _PADROES_CORRUPCAO_TEXTUAL.some((re) => re.test(t));
};

// ─── ALTO RISCO DE REVISÃO CLÍNICA — EXCLUSIVA SUPER APOSTAS 2026.2 ──────────
// Não é motivo de rejeição automática — é um SINALIZADOR consumido pela
// orquestração de fallback (RoboGerador.jsx): questão marcada como alto risco
// é escalada para revisão por Opus antes de ser aceita como definitiva.
const _PADROES_ALTO_RISCO_CLINICO = [
  /\bCPAP\b/i, /\bPEEP\b/i, /\bVNI\b/i, /\bventila[çc][ãa]o\s+mec[âa]nica\b/i, /\bintuba[çc][ãa]o\b/i,
  /\bnorepinefrina\b/i, /\bnoradrenalina\b/i, /\bdopamina\b/i, /\bdobutamina\b/i, /\bvasopress(or|ina)\b/i, /\bin[óo]tr[óo]pic[oa]\b/i,
];
// Hotfix pós-Lote 001: idade em "anos" sozinha NÃO é evidência pediátrica — um
// "homem de 54 anos" também tem "54 anos" no enunciado. Só conta como pediátrico:
// termo explícito da faixa (criança, lactente, neonato, recém-nascido, bebê,
// adolescente, pediátrico) OU idade numérica em anos < 18 OU idade em meses
// (idade em meses nunca descreve um adulto, não precisa de corte numérico).
const _TERMOS_PEDIATRICOS = /\b(crianç\w*|lactente|neonato|rec[ée]m[\s-]nascid[oa]|beb[êe]|adolescente|pedi[áa]tric\w*)\b/i;
const _temIdadePediatrica = (texto) => {
  const t = String(texto || "");
  if (/\b\d{1,3}\s*meses?\b/i.test(t)) return true;
  for (const m of t.matchAll(/\b(\d{1,2})\s*anos?\b/gi)) {
    if (Number(m[1]) < 18) return true;
  }
  return false;
};
export const avaliarRiscoClinico = (q) => {
  const campos = [q?.tto, q?.raciocinio].filter(Boolean).join(" ");
  const mencionaVentilacaoOuVasoativo = _PADROES_ALTO_RISCO_CLINICO.some((re) => re.test(campos));
  const pediatrico = _TERMOS_PEDIATRICOS.test(q?.enunciado || "") || _temIdadePediatrica(q?.enunciado || "");
  const temPosologiaNumerica = _contemPosologiaEspecifica(q?.tto);
  return mencionaVentilacaoOuVasoativo || (pediatrico && temPosologiaNumerica);
};

// inequívoco (separador "|" com exatamente 4 blocos); qualquer outra coisa é
// rejeição — não tenta "adivinhar" divisão de blocos.
const _validarDicaMestre = (texto) => {
  const t = String(texto || "").trim();
  if (!t) return { ok: false, motivo: "dicaMestre ausente" };

  const blocosSeta = t.split(/\s*↓\s*/).map((b) => b.trim()).filter(Boolean);
  if (blocosSeta.length === 4) return { ok: true, textoCorrigido: t };

  // Único caso de normalização automática permitido: "|" com exatamente 4 blocos.
  const blocosPipe = t.split(/\s*\|\s*/).map((b) => b.trim()).filter(Boolean);
  if (blocosPipe.length === 4) {
    return { ok: true, textoCorrigido: blocosPipe.join(" ↓ "), corrigido: true };
  }

  return {
    ok: false,
    motivo: `dicaMestre não tem exatamente 4 blocos identificáveis por "↓" (encontrados: ${blocosSeta.length}) nem por "|" (encontrados: ${blocosPipe.length})`,
  };
};

export const validarLoteSA = (lista, { abcd = false, grounding = false, groundingTexto = "" } = {}) => {
  const letras = abcd ? ["a", "b", "c", "d"] : ["a", "b", "c", "d", "e"];
  const validas = [];
  const rejeitadas = [];

  for (const qOriginal of Array.isArray(lista) ? lista : []) {
    const motivos = [];
    // Cópia rasa — a única mutação permitida é a normalização segura da Dica Mestre.
    const q = { ...qOriginal };
    const gabaritoLower = String(q?.gabarito || "").toLowerCase();

    if (abcd && q?.alts?.e?.texto) motivos.push("contém alternativa E em questão do formato ABCD");
    if (!gabaritoLower || !letras.includes(gabaritoLower)) {
      motivos.push(`gabarito "${q?.gabarito}" inválido para o formato ${abcd ? "ABCD" : "ABCDE"}`);
    }

    // ── Enforcement do enunciado (REGRA SA-5 + limite 80-200 palavras) ──────
    if (abcd) {
      const palavrasEnunciado = _contarPalavras(q?.enunciado);
      if (palavrasEnunciado < 80) {
        motivos.push(`enunciado com ${palavrasEnunciado} palavras — abaixo do mínimo de 80 (REGRA SA-5, risco de flashcard)`);
      } else if (palavrasEnunciado > 200) {
        motivos.push(`enunciado com ${palavrasEnunciado} palavras — acima do máximo de 200`);
      } else if (!_pareceCasoClinico(q?.enunciado)) {
        motivos.push('enunciado sem marcador de caso clínico (idade, contexto assistencial ou paciente apresentando queixa) — parece pergunta seca/flashcard, viola REGRA SA-5');
      }
    }

    const textos  = letras.map((l) => String(q?.alts?.[l]?.texto || "").trim());
    const vazias  = textos.filter((t) => t.split(/\s+/).filter(Boolean).length < 3).length;
    if (vazias > 0) motivos.push(`${vazias} alternativa(s) vazia(s)/incompleta(s)`);

    // ── Anti-pistas multi-eixo (Fase 2) — só roda se as alternativas existem ──
    if (motivos.length === 0) {
      const gabIdx = letras.indexOf(gabaritoLower);
      const metricas = textos.map(_analisarAlternativa);
      const correta = metricas[gabIdx];
      const distratoresM = metricas.filter((_, i) => i !== gabIdx);
      const media = (chave) => distratoresM.reduce((a, m) => a + m[chave], 0) / (distratoresM.length || 1);
      const mediaPalavras = media("palavras");

      let eixosVencidos = [];
      if (correta.palavras === Math.max(...metricas.map((m) => m.palavras)) && correta.palavras > mediaPalavras * 1.1) {
        eixosVencidos.push("comprimento (é a mais longa)");
      }
      if (correta.numeros > 0 && distratoresM.every((d) => correta.numeros > d.numeros)) {
        eixosVencidos.push("única com números/qualificadores quantitativos");
      }
      if (correta.virgulas >= 2 && distratoresM.every((d) => correta.virgulas > d.virgulas)) {
        eixosVencidos.push("única \"composta\" (múltiplas cláusulas)");
      }
      if (correta.parenteses > 0 && distratoresM.every((d) => correta.parenteses > d.parenteses)) {
        eixosVencidos.push("única com explicação parentética embutida");
      }
      if (eixosVencidos.length >= 2) {
        motivos.push(`alternativa correta se destaca formalmente dos distratores em ${eixosVencidos.length} eixos: ${eixosVencidos.join("; ")} — risco de pista visual/estrutural`);
      }

      const menorPalavras = Math.min(...distratoresM.map((m) => m.palavras));
      if (menorPalavras < 6) {
        motivos.push(`distrator muito curto/simplório (${menorPalavras} palavras) — risco de eliminação óbvia por tamanho`);
      }

      const maiorTodas = Math.max(...metricas.map((m) => m.palavras));
      const menorTodas = Math.min(...metricas.map((m) => m.palavras));
      if (menorTodas > 0 && maiorTodas / menorTodas > 3) {
        motivos.push(`diferença extrema de comprimento entre alternativas (${menorTodas}–${maiorTodas} palavras)`);
      }
    }

    // ── Consistência CORRETA ↔ gabarito nas justificativas ──
    if (motivos.length === 0) {
      const notas = letras.map((l) => String(q?.alts?.[l]?.nota || ""));
      const marcadasCorreta = notas
        .map((n, i) => ({ letra: letras[i], marcada: /^\s*CORRETA\b/i.test(n) }))
        .filter((x) => x.marcada)
        .map((x) => x.letra);

      if (marcadasCorreta.length === 0) {
        motivos.push('nenhuma justificativa começa com "CORRETA" — não dá para confirmar consistência com o gabarito');
      } else if (marcadasCorreta.length > 1) {
        motivos.push(`mais de uma alternativa marcada como "CORRETA" nas justificativas (${marcadasCorreta.join(", ")})`);
      } else if (marcadasCorreta[0] !== gabaritoLower) {
        motivos.push(`justificativa marcada como "CORRETA" é da letra "${marcadasCorreta[0]}", mas o gabarito é "${gabaritoLower}"`);
      }
    }

    // ── Bloqueio duro de posologia sem grounding (REGRA SA-3) ──
    if (!grounding) {
      if (_contemPosologiaEspecifica(q?.tto)) {
        motivos.push('campo "tto" contém posologia numérica (dose/via/intervalo/duração) sem diretriz controlada injetada — proibido pela REGRA SA-3');
      }
      // Afirmações fortes sem fonte (REGRA SA-4) — varre raciocínio, tto, dicaMestre e notas.
      const camposParaChecar = [q?.raciocinio, q?.tto, q?.dicaMestre, ...letras.map((l) => q?.alts?.[l]?.nota)];
      if (camposParaChecar.some(_contemAfirmacaoForte)) {
        // Mesmo mecanismo já homologado em validarResumoSA (achado real Q26):
        // localiza o termo/trecho exatos para o feedback do retry poder citá-los.
        const achado = _localizarAfirmacaoForte(camposParaChecar.filter(Boolean).join(" "));
        motivos.push(
          achado
            ? `conteúdo usa termo absoluto ("sempre"/"nunca"/"obrigatório"/"em todos os casos"/"patognomônico"/"padrão-ouro"/percentual específico/"desde AAAA") sem diretriz controlada injetada — termo encontrado: "${achado.termo}", trecho: "${achado.trecho}" (proibido pela REGRA SA-4)`
            : 'conteúdo usa termo absoluto ("sempre"/"nunca"/"obrigatório"/"em todos os casos"/"patognomônico"/"padrão-ouro"/percentual específico/"desde AAAA") sem diretriz controlada injetada — proibido pela REGRA SA-4'
        );
      }
      // Fabricação de fonte/ano de diretriz sem grounding (REGRA SA-4) — o modelo
      // não pode "lembrar" um guideline e apresentá-lo como verificado nesta geração.
      const anoInventado = q?.ano_diretriz !== null && q?.ano_diretriz !== undefined && q?.ano_diretriz !== "";
      const fonteInventada = typeof q?.fonte_diretriz === "string" && q.fonte_diretriz.trim() !== "";
      if (anoInventado || fonteInventada) {
        motivos.push(`campo "ano_diretriz"/"fonte_diretriz" preenchido (${q?.ano_diretriz ?? "-"} / "${q?.fonte_diretriz ?? "-"}") sem diretriz controlada injetada — proibido pela REGRA SA-4, deveria ficar null/""`);
      }
    }

    // ── Suporte numérico estrito quando HÁ grounding (saneamento final) ──
    // grounding=true não autoriza número não sustentado pelo texto injetado.
    // Sem groundingTexto disponível (chamador que ainda não repassou o texto
    // da diretriz), a checagem é pulada — não quebra compatibilidade, mas
    // deixa de proteger; todo chamador novo deve passar groundingTexto.
    // Hotfix (achado real R041): número já presente no ENUNCIADO da própria
    // questão (dado do caso, ex. "36 horas após exposição") é reutilização,
    // não precisão nova — não precisa também estar na diretriz. Só o
    // enunciado autoriza (não alts/notas), e só por igualdade literal — sem
    // isso, "36h" no caso e no tto rejeitava a questão inteira por um dado
    // que o próprio enunciado já fornecia ao candidato.
    if (grounding && groundingTexto) {
      const semSuporte = [
        ..._numerosSemSuporte(q?.tto, groundingTexto, q?.enunciado),
        ..._numerosSemSuporte(q?.dicaMestre, groundingTexto, q?.enunciado),
      ];
      const semSuporteUnicos = [...new Set(semSuporte)];
      if (semSuporteUnicos.length > 0) {
        motivos.push(`número(s) ${semSuporteUnicos.join(", ")} em "tto"/"dicaMestre" não aparece(m) no conteúdo da diretriz controlada injetada — grounding do tema não autoriza completar precisão numérica por conta própria`);
      }
    }

    // ── Sanidade textual (hotfix pré-homologação) — corrupção de encoding ──
    // Varre todos os campos de texto livre; qualquer corrupção inequívoca rejeita
    // a questão inteira. Nunca autocorrige silenciosamente a palavra afetada.
    {
      const camposTexto = [
        q?.enunciado, q?.raciocinio, q?.tto, q?.dicaMestre, q?.estrategiaAposta,
        q?.tema_mestre, q?.subtema,
        ...letras.map((l) => q?.alts?.[l]?.texto),
        ...letras.map((l) => q?.alts?.[l]?.nota),
      ];
      if (camposTexto.some(_contemCorrupcaoTextual)) {
        motivos.push("corrupção de encoding detectada em algum campo de texto (caractere cirílico misturado, replacement character � ou controle Unicode suspeito)");
      }
    }

    // ── Formato da Dica Mestre (REGRA SA-2) — normaliza "|" só se inequívoco ──
    // Roda sempre (independente dos motivos já acumulados) para dar visibilidade
    // completa de todos os problemas da questão de uma vez, não só o primeiro.
    const dm = _validarDicaMestre(q?.dicaMestre);
    if (!dm.ok) {
      motivos.push(dm.motivo);
    } else if (dm.corrigido) {
      q.dicaMestre = dm.textoCorrigido; // normalização segura (só caso "|" com 4 blocos)
    }

    if (motivos.length > 0) rejeitadas.push({ questao: q, motivos });
    else validas.push(q);
  }

  return { validas, rejeitadas };
};

// ─── FLUXO ÚNICO DE GERAÇÃO — SUPER APOSTAS 2026.2 (auditoria de custo) ──────
// Substitui o antigo par "retry externo (RoboGerador) × gerarComFallback
// interno", que no pior caso encadeava 3 reinícios completos × até 3
// chamadas cada = até 9 chamadas por recorte (confirmado pelos números do
// Lote 002: ~60% das 20 chamadas do lote foram gastas num único recorte que
// nunca foi aprovado). Agora: TETO ABSOLUTO DE 3 CHAMADAS por recorte, nunca
// reiniciado externamente. Tentativa 1 é sempre Haiku "limpo" (sem feedback).
// A partir daí, o modelo/prompt da tentativa seguinte é decidido pelo TIPO de
// falha da tentativa anterior (REGRA — ver _classificarFalhaSA):
//   • grounding insuficiente (número/afirmação sem suporte na diretriz
//     injetada) → BLOQUEIA imediatamente. Trocar de modelo não resolve
//     ausência de fonte — Opus não inventa dado que não está em
//     pontosCriticos, então insistir só queima tokens.
//   • erro técnico (JSON inválido) ou falha estrutural corrigível (REGRA
//     SA-1/SA-2 etc.) → Haiku de novo, com feedback curto do motivo exato
//     (não reenvia a resposta anterior inteira — só a instrução de correção).
//   • conteúdo válido mas de alto risco clínico (ventilação/vasoativo/
//     posologia pediátrica — avaliarRiscoClinico) → Opus como revisor
//     imediato, mesma regra de segurança já homologada, sem esperar uma
//     falha estrutural para escalar.
//   • falha corrigível REPETIDA (2ª vez seguida) → Opus como última tentativa,
//     ainda com o feedback acumulado.
// chamarIABruto: (systemPrompt, promptUsuario, model) => Promise<{parsed, usage}>
// — injeção de dependência para reaproveitar a MESMA lógica de decisão tanto
// no app (fetch via Cloud Function) quanto num script de teste de custo
// (fetch direto à Anthropic), sem duplicar a árvore de decisão em dois lugares.
export const MODELO_HAIKU_SA = "claude-haiku-4-5-20251001";
export const MODELO_OPUS_SA  = "claude-opus-4-8";

// Hotfix cirúrgico #2 (achado real R002, grounding=true/diretriz "has"): o
// motivo "não aparece(m) no conteúdo da diretriz controlada injetada" (vem
// de _numerosSemSuporte, só existe quando grounding=true) era tratado como
// prova automática de que o RECORTE é estruturalmente inviável ("nenhum
// retry resolve, a fonte não tem o dado"). R002 provou que essa inferência é
// FRÁGIL: o recorte pedia diferenciar urgência x emergência por lesão de
// órgão-alvo — nunca exigiu escrever "2-6 horas". O "6" foi precisão extra
// que a própria CANDIDATA introduziu por conta própria, não algo que o
// recorte exigisse e a fonte não sustentasse. O motivo textual, sozinho,
// não distingue "recorte exige e a fonte não tem" de "candidata inventou
// algo dispensável" — essa distinção depende de saber se o dado é
// NECESSÁRIO ao recorte, informação que só existe no Mapa Mestre/pré-check
// (curadoria humana, ex. src/config/recortesStatusSA.js), não no texto do
// motivo. Sem essa evidência aqui, a regra passa a ser: tratar como
// CORRIGÍVEL (retry com feedback citando exatamente o(s) número(s)
// detectado(s)), nunca mais bloqueio automático de recorte só por este texto.
// Bloqueio genuíno de recorte por grounding insuficiente continua existindo,
// mas como decisão de pré-check/curadoria (ex. R041 → REVISÃO HUMANA depois
// de evidência acumulada em múltiplas tentativas reais), não como inferência
// de uma única rejeição de candidata.
const _MOTIVO_NUMERO_NAO_SUPORTADO   = /não aparece\(m\) no conteúdo da diretriz controlada injetada/;
const _MOTIVO_CANDIDATA_NAO_GROUNDED = /sem diretriz controlada injetada/;

const _FEEDBACK_CANDIDATA_NAO_GROUNDED = "A tentativa anterior introduziu precisão normativa, posologia ou linguagem absoluta não necessária ao recorte e sem diretriz controlada. Reescreva em linguagem qualitativa, sem inventar números, doses, protocolos ou afirmações absolutas.";
const _FEEDBACK_ANTI_PISTA = "Tentativa anterior rejeitada porque a alternativa correta se destacou estruturalmente dos distratores (comprimento, números, complexidade gramatical ou pontuação). Gere novamente com as 4 alternativas equilibradas: mesmo nível de detalhe, nenhuma delas a mais longa, a única com números ou a única com estrutura composta.";
const _FEEDBACK_DICA_MESTRE_FORMATO = 'A Dica Mestre anterior não tinha exatamente 4 blocos separados por " ↓ ". Gere novamente com exatamente 4 blocos nessa ordem: frase memorável ↓ o sinal que muda tudo ↓ o caminho certo ↓ por que erram.';
const _FEEDBACK_GABARITO_INCONSISTENTE = 'A nota da alternativa correta anterior não seguiu a regra: deve começar exatamente com "CORRETA", e somente ela pode ter essa marcação. Corrija essa consistência na nova geração.';
const _FEEDBACK_CORRUPCAO_TEXTUAL = "A resposta anterior teve corrupção de encoding (caractere inválido misturado ao texto). Gere novamente em português padrão, sem caracteres fora do esperado.";
const _FEEDBACK_ENUNCIADO_CURTO_OU_FLASHCARD = "O enunciado anterior violou a REGRA SA-5 (estilo Revalida/ENAMED): ficou curto demais, fora da faixa de 80-200 palavras, ou sem um caso clínico real (idade, contexto assistencial como UBS/UPA/PS/enfermaria/pré-natal, e um paciente apresentando queixa). Reescreva como um caso clínico narrativo completo, dentro do limite de palavras, terminando na pergunta de fechamento — não como uma pergunta seca de flashcard.";

// Feedback dinâmico: extrai o(s) número(s) exatos já identificados por
// _numerosSemSuporte no texto do motivo (nunca recalcula — usa o mesmo
// resultado que gerou a rejeição, sem risco de divergência) e nomeia
// exatamente qual(is) precisão(ões) não deve(m) ser repetida(s).
const _feedbackNumeroNaoSuportado = (todosMotivos) => {
  const m = todosMotivos.match(/número\(s\)\s+([\d.,\s]+?)\s+em/);
  const nums = m ? m[1].split(",").map((s) => s.trim()).filter(Boolean).join(", ") : null;
  return nums
    ? `A tentativa anterior introduziu o(s) número(s) ${nums}, não sustentado(s) pela diretriz controlada. Não acrescente números, intervalos ou metas que não estejam explicitamente no grounding fornecido. Reescreva usando apenas as precisões autorizadas.`
    : "A tentativa anterior introduziu precisão numérica não sustentada pela diretriz controlada. Não acrescente números, intervalos ou metas que não estejam explicitamente no grounding fornecido. Reescreva usando apenas as precisões autorizadas.";
};

// Mesmo mecanismo homologado no resumo (_feedbackResumoAbsoluto/commits
// 6d86a08, 40040ab), aplicado ao lado da QUESTÃO (achado real R079: 2
// rejeições SA-4 seguidas com feedback genérico, sem termo/trecho citados).
// Usa o mesmo extrator compartilhado — _extrairTermoTrechoAfirmacaoForte —
// para não duplicar a regex entre os dois lados.
const _feedbackCandidataAbsoluta = (todosMotivos) => {
  const achado = _extrairTermoTrechoAfirmacaoForte(todosMotivos);
  if (achado) {
    return `A tentativa anterior foi rejeitada porque contém literalmente "${achado.termo}" no trecho "${achado.trecho}". Reescreva especificamente esse trecho sem linguagem absoluta — evite também sinônimos equivalentes ("exclusivamente", "invariavelmente", "de forma alguma"). Antes de responder, revise TODOS os campos da questão (enunciado, alternativas, raciocínio, conduta, dica mestre, justificativas), não só o trecho apontado, e confirme que nenhum deles contém essas palavras, inclusive dentro de exemplos ou citações entre aspas.`;
  }
  return _FEEDBACK_CANDIDATA_NAO_GROUNDED;
};

// ── Cardinalidade do array retornado (Micro Hardening — achado real R079) ──
// esperado vem do fluxo real (questoesPorTemaAtual em RoboGerador.jsx),
// nunca é re-inferido por texto/regex do prompt. Ver executarGeracaoSA.
const _MOTIVO_ERRO_CARDINALIDADE = /^erro de protocolo: esperad[ao] (\d+) questão\(ões\), recebid[ao] (\d+)/;
const _feedbackCardinalidade = (todosMotivos) => {
  const m = todosMotivos.match(_MOTIVO_ERRO_CARDINALIDADE);
  if (m) {
    const [, esperado, recebido] = m;
    return `A tentativa anterior retornou ${recebido} questão(ões) no array, mas o esperado é exatamente ${esperado}. Gere novamente com exatamente ${esperado} item(ns) no array JSON — nunca inclua rascunhos, versões anteriores, exemplos de estrutura ou objetos parciais junto com a resposta final.`;
  }
  return "A tentativa anterior retornou uma quantidade de questões diferente da esperada. Gere novamente com exatamente a quantidade solicitada, sem itens extras ou parciais no array.";
};

// Cada entrada é uma categoria de motivo CORRIGÍVEL — todas as que baterem
// no texto dos motivos entram no feedback (motivos mistos, ex. R034 =
// anti-pista + candidata não grounded ao mesmo tempo, recebem os DOIS
// fragmentos de feedback na mesma tentativa seguinte, não só o primeiro).
const _CATEGORIAS_CORRIGIVEIS_SA = [
  { tipo: "erro_cardinalidade",     teste: (t) => _MOTIVO_ERRO_CARDINALIDADE.test(t), feedback: (t) => _feedbackCardinalidade(t) },
  { tipo: "numero_nao_suportado",   teste: (t) => _MOTIVO_NUMERO_NAO_SUPORTADO.test(t), feedback: (t) => _feedbackNumeroNaoSuportado(t) },
  // termo absoluto (SA-4) tem categoria própria, mais específica — vem antes
  // e é excluída de candidata_nao_grounded (abaixo) para não duplicar o
  // feedback genérico junto do específico na mesma tentativa.
  { tipo: "questao_absoluto",       teste: (t) => /termo encontrado:.*REGRA SA-4/.test(t), feedback: (t) => _feedbackCandidataAbsoluta(t) },
  { tipo: "candidata_nao_grounded", teste: (t) => _MOTIVO_CANDIDATA_NAO_GROUNDED.test(t) && !/termo encontrado:/.test(t), feedback: () => _FEEDBACK_CANDIDATA_NAO_GROUNDED },
  { tipo: "anti_pista",             teste: (t) => /se destaca formalmente|distrator muito curto|diferença extrema de comprimento/.test(t), feedback: () => _FEEDBACK_ANTI_PISTA },
  { tipo: "dica_mestre_formato",    teste: (t) => /dicaMestre não tem exatamente 4 blocos/.test(t), feedback: () => _FEEDBACK_DICA_MESTRE_FORMATO },
  { tipo: "gabarito_inconsistente", teste: (t) => /nenhuma justificativa começa com|mais de uma alternativa marcada|justificativa marcada como/.test(t), feedback: () => _FEEDBACK_GABARITO_INCONSISTENTE },
  { tipo: "corrupcao_textual",      teste: (t) => /corrupção de encoding/.test(t), feedback: () => _FEEDBACK_CORRUPCAO_TEXTUAL },
  { tipo: "enunciado_flashcard",    teste: (t) => /abaixo do mínimo de 80|acima do máximo de 200|sem marcador de caso clínico/.test(t), feedback: () => _FEEDBACK_ENUNCIADO_CURTO_OU_FLASHCARD },
];

const _classificarFalhaSA = (motivos, erroTecnico) => {
  if (erroTecnico) {
    return {
      tipo: "erro_tecnico",
      feedback: `A tentativa anterior falhou tecnicamente (${erroTecnico}). Responda exclusivamente com o array JSON solicitado, exatamente no schema pedido, sem texto antes ou depois, sem markdown, sem cercas de código.`,
    };
  }

  const listaMotivos = motivos || [];
  const todos = listaMotivos.join(" | ");

  // Nenhum bloqueio automático de recorte a partir só do texto do motivo —
  // ver comentário acima. Todas as categorias abaixo são corrigíveis; coleta
  // TODAS as presentes, não só a primeira (motivos mistos recebem feedback
  // combinado numa única tentativa).
  const categoriasEncontradas = _CATEGORIAS_CORRIGIVEIS_SA.filter((c) => c.teste(todos));
  if (categoriasEncontradas.length > 0) {
    return {
      tipo: categoriasEncontradas.length === 1 ? categoriasEncontradas[0].tipo : "corrigivel_misto",
      feedback: categoriasEncontradas.map((c) => c.feedback(todos)).join(" "),
    };
  }

  if (listaMotivos.length) {
    return {
      tipo: "outro",
      feedback: `Tentativa anterior rejeitada pelo motivo: "${listaMotivos[0]}". Corrija especificamente esse ponto na nova geração, mantendo o restante do conteúdo clínico.`,
    };
  }
  return { tipo: "outro", feedback: "Gere novamente, revisando com cuidado o formato e as regras do prompt." };
};

// esperado: quantidade de questões esperada nesta chamada, vinda do fluxo real
// (questoesPorTemaAtual em RoboGerador.jsx) — nunca re-inferida por regex do
// texto do prompt. Opcional: omitir (undefined) preserva o comportamento
// anterior (sem checagem de cardinalidade), compatível com chamadores futuros
// que ainda não repassem esse dado.
export const executarGeracaoSA = async (promptTema, systemPrompt, { abcd, grounding, groundingTexto, esperado } = {}, chamarIABruto) => {
  const tentativas = [];

  const tentar = async (modelo, prompt, numero) => {
    try {
      const { parsed, usage } = await chamarIABruto(systemPrompt, prompt, modelo);

      // ── Checagem de cardinalidade (Micro Hardening — achado real R079) ──
      // Roda ANTES da validação clínica/editorial. Se a quantidade recebida
      // não bate com a esperada, NENHUM item do array vira candidata
      // individual — nem o primeiro, nem o "mais completo" — evita salvar
      // excedente e evita tratar objeto parcial como questão clínica válida.
      if (typeof esperado === "number" && Array.isArray(parsed) && parsed.length !== esperado) {
        const motivoCardinalidade = `erro de protocolo: esperado ${esperado} questão(ões), recebido ${parsed.length} — array rejeitado sem avaliação clínica individual`;
        tentativas.push({ modelo, numero, usage, validas: 0, rejeitadas: parsed.length, motivos: [motivoCardinalidade] });
        return { validas: [], rejeitadas: [{ questao: null, motivos: [motivoCardinalidade] }], altoRisco: false, erro: null };
      }

      const { validas, rejeitadas } = validarLoteSA(parsed, { abcd, grounding, groundingTexto });
      const altoRisco = validas.length > 0 && validas.some(avaliarRiscoClinico);
      tentativas.push({ modelo, numero, usage, validas: validas.length, rejeitadas: rejeitadas.length, motivos: rejeitadas[0]?.motivos, altoRiscoRevisao: altoRisco });
      return { validas, rejeitadas, altoRisco, erro: null };
    } catch (e) {
      tentativas.push({ modelo, numero, erro: e.message });
      return { validas: [], rejeitadas: [], altoRisco: false, erro: e.message };
    }
  };

  // ── Tentativa 1 — Haiku, sempre, prompt original sem feedback ────────────
  const r1 = await tentar(MODELO_HAIKU_SA, promptTema, 1);
  if (r1.validas.length > 0 && !r1.altoRisco) {
    return { validas: r1.validas, rejeitadas: r1.rejeitadas, tentativas, bloqueadoPorGrounding: false };
  }
  if (r1.validas.length > 0 && r1.altoRisco) {
    // ── Tentativa 2 — Opus revisor imediato (alto risco clínico) ───────────
    const r2 = await tentar(MODELO_OPUS_SA, promptTema, 2);
    if (r2.validas.length > 0) {
      return { validas: r2.validas, rejeitadas: r2.rejeitadas, tentativas, bloqueadoPorGrounding: false, altoRiscoRevisao: r2.altoRisco };
    }
    // Opus não produziu nada válido — usa o candidato Haiku (alto risco), sinalizado p/ revisão humana. PARA aqui (teto 2 chamadas nesse ramo).
    return { validas: r1.validas, rejeitadas: r1.rejeitadas, tentativas, bloqueadoPorGrounding: false, altoRiscoRevisao: true };
  }

  const cls1 = _classificarFalhaSA(r1.rejeitadas[0]?.motivos, r1.erro);
  // "grounding_bloqueio" não é mais retornado por _classificarFalhaSA (hotfix
  // R002) — nenhum motivo de candidata, sozinho, condena o recorte sem
  // evidência de que a precisão é NECESSÁRIA a ele. Este check fica como
  // infraestrutura pronta para o dia em que essa evidência existir (ex. um
  // sinal de pré-check vindo do Mapa Mestre); hoje é sempre corrigível.
  if (cls1.tipo === "grounding_bloqueio") {
    return { validas: [], rejeitadas: r1.rejeitadas, tentativas, bloqueadoPorGrounding: true };
  }

  // ── Tentativa 2 — Haiku com feedback específico da falha ─────────────────
  const prompt2 = `${promptTema}\n\n⚠️ FEEDBACK DA TENTATIVA ANTERIOR: ${cls1.feedback}`;
  const r2 = await tentar(MODELO_HAIKU_SA, prompt2, 2);
  if (r2.validas.length > 0 && !r2.altoRisco) {
    return { validas: r2.validas, rejeitadas: r2.rejeitadas, tentativas, bloqueadoPorGrounding: false };
  }
  if (r2.validas.length > 0 && r2.altoRisco) {
    // ── Tentativa 3 — Opus revisor imediato ───────────────────────────────
    const r3 = await tentar(MODELO_OPUS_SA, promptTema, 3);
    if (r3.validas.length > 0) {
      return { validas: r3.validas, rejeitadas: r3.rejeitadas, tentativas, bloqueadoPorGrounding: false, altoRiscoRevisao: r3.altoRisco };
    }
    return { validas: r2.validas, rejeitadas: r2.rejeitadas, tentativas, bloqueadoPorGrounding: false, altoRiscoRevisao: true };
  }

  const cls2 = _classificarFalhaSA(r2.rejeitadas[0]?.motivos, r2.erro);
  // Mesma observação do check acima — hoje sempre corrigível, nunca aciona.
  if (cls2.tipo === "grounding_bloqueio") {
    return { validas: [], rejeitadas: r2.rejeitadas, tentativas, bloqueadoPorGrounding: true };
  }

  // ── Tentativa 3 — Opus, última chance (falha corrigível repetida). PARA sempre depois, teto absoluto de 3 chamadas. ──
  const prompt3 = `${promptTema}\n\n⚠️ FEEDBACK DAS TENTATIVAS ANTERIORES: ${cls2.feedback}`;
  const r3 = await tentar(MODELO_OPUS_SA, prompt3, 3);
  return { validas: r3.validas, rejeitadas: r3.rejeitadas, tentativas, bloqueadoPorGrounding: false };
};

// ─── VALIDAÇÃO DO RESUMO DO TEMA — SUPER APOSTAS (saneamento final) ──────────
// Mesma disciplina de grounding do validarLoteSA, aplicada aos "pontos" do
// resumo (PROMPT_SISTEMA_RESUMO_SA). Exclusiva do fluxo Super Apostas —
// resumoEngine.js só chama isto quando questao.modulo === "super_apostas";
// o resumo INEP (PROMPT_SISTEMA_RESUMO) nunca passa por aqui, sem mudança de
// comportamento no fluxo legado/homologado.
export const validarResumoSA = (pontos, { grounding = false, groundingTexto = "" } = {}) => {
  const problemas = [];
  const textoCompleto = (Array.isArray(pontos) ? pontos : []).map((p) => p?.texto || "").join(" ");

  if (!textoCompleto.trim()) {
    return { ok: false, problemas: ["resumo sem pontos/texto"] };
  }

  if (!grounding) {
    if (_contemPosologiaEspecifica(textoCompleto)) {
      problemas.push('resumo contém posologia numérica (dose/via/intervalo/duração) sem diretriz controlada injetada — mesma regra do validarLoteSA (SA-3)');
    }
    if (_contemAfirmacaoForte(textoCompleto)) {
      const achado = _localizarAfirmacaoForte(textoCompleto);
      problemas.push(
        achado
          ? `resumo usa termo absoluto ("sempre"/"nunca"/"obrigatório"/"em todos os casos"/"patognomônico"/"padrão-ouro"/percentual específico/"desde AAAA") sem diretriz controlada injetada — termo encontrado: "${achado.termo}", trecho: "${achado.trecho}" (mesma regra do validarLoteSA, SA-4)`
          : 'resumo usa termo absoluto ("sempre"/"nunca"/"obrigatório"/"em todos os casos"/"patognomônico"/"padrão-ouro"/percentual específico/"desde AAAA") sem diretriz controlada injetada — mesma regra do validarLoteSA (SA-4)'
      );
    }
    // Hotfix (achado real Q23/Cefaleia): _contemPosologiaEspecifica só cobre
    // padrões de DOSE medicamentosa (mg/mL/UI/frequência) — não pega corte
    // etário ("acima de 50 anos"), limiar laboratorial ou contagem de líquor,
    // que não são "posologia" mas são igualmente um critério numérico/
    // normativo sem fonte. Sem grounding, o resumo não deve conter NENHUM
    // número clínico — mesma disciplina zero-tolerância do "Sem inventar
    // precisão" já pedido no prompt, agora também no validador.
    const numerosOrfaos = _extrairNumerosSignificativos(textoCompleto);
    if (numerosOrfaos.length > 0) {
      problemas.push(`resumo contém número(s) clínico(s) (${[...new Set(numerosOrfaos)].join(", ")}) sem diretriz controlada injetada — nenhum critério numérico (idade de corte, limiar laboratorial, contagem etc.) pode aparecer sem fonte, mesmo fora do padrão de posologia`);
    }
  } else if (groundingTexto) {
    const semSuporte = _numerosSemSuporte(textoCompleto, groundingTexto);
    if (semSuporte.length > 0) {
      problemas.push(`número(s) ${semSuporte.join(", ")} no resumo não aparece(m) no conteúdo da diretriz controlada injetada — grounding do tema não autoriza completar precisão numérica por conta própria`);
    }
  }

  if (_contemCorrupcaoTextual(textoCompleto)) {
    problemas.push("corrupção de encoding detectada em algum ponto do resumo");
  }

  return { ok: problemas.length === 0, problemas };
};

// ─── CLASSIFICAÇÃO DE FALHA DO RESUMO — retry corrigível vs bloqueio real ────
// Mesmo princípio Tipo A / Tipo B já aplicado a _classificarFalhaSA (retry da
// QUESTÃO, hotfix R034): "recorte/tema bloqueado" é diferente de "candidata de
// resumo rejeitada". Achado real (Hérnia da parede abdominal--idoso, sem
// grounding): a IA gerou espontaneamente "sempre"/"nunca" e um número clínico
// dispensável ("1-2 horas") — nada disso é o TEMA sendo inviável, é a
// CANDIDATA do resumo, corrigível com 1 retry e feedback específico.
//   Tipo A (grounding_bloqueio) — só existe quando HÁ diretriz controlada
//   injetada e o resumo pediu precisão que a fonte não sustenta (mesmo motivo
//   textual de _numerosSemSuporte usado em validarLoteSA). A fonte não tem o
//   dado — retry não resolve. Continua parando na 1ª tentativa.
//   Tipo B (corrigível) — tudo o resto: linguagem absoluta espontânea,
//   número clínico órfão, posologia sem grounding, corrupção de encoding,
//   resposta sem "pontos"/vazia. Artefato da geração, não do recorte.
const _MOTIVO_GROUNDING_BLOQUEIO_RESUMO = /não aparece\(m\) no conteúdo da diretriz controlada injetada/;

// Usa _extrairTermoTrechoAfirmacaoForte (achado gravado por validarResumoSA
// no motivo, nunca recalculado) para montar feedback específico. Sem achado
// (ex.: motivo de uma execução antiga sem o novo formato), cai no aviso
// genérico — nunca quebra.
const _feedbackResumoAbsoluto = (todosMotivos) => {
  const achado = _extrairTermoTrechoAfirmacaoForte(todosMotivos);
  if (achado) {
    return `O texto foi rejeitado porque contém literalmente "${achado.termo}" no trecho "${achado.trecho}". Reescreva especificamente esse trecho com linguagem clínica não absoluta — evite também sinônimos equivalentes ("exclusivamente", "invariavelmente", "de forma alguma"). Antes de responder, releia os 7 blocos por completo e confirme que nenhum deles contém essas palavras, inclusive dentro de exemplos, falas hipotéticas ou citações entre aspas.`;
  }
  return 'A tentativa anterior foi rejeitada porque usou linguagem absoluta ("sempre"/"nunca"/"obrigatório"/"padrão-ouro"/"patognomônico"/percentual específico) sem diretriz controlada injetada. A rejeição é por presença literal da palavra em QUALQUER lugar do texto — inclusive dentro de exemplo, fala hipotética de familiar/paciente ou entre aspas; não há contexto que isente. Reescreva a(s) frase(s) inteira(s) sem essas palavras. Antes de responder, releia os 7 blocos por completo e confirme que nenhum deles contém essas palavras.';
};
const _FEEDBACK_RESUMO_NUMERO_ORFAO = "A tentativa anterior introduziu número(s) clínico(s) sem diretriz controlada injetada. Reescreva sem esse(s) número(s) — inclusive intervalos/faixas (ex: \"1-2 horas\") —, preservando o valor pedagógico em linguagem qualitativa.";
const _FEEDBACK_RESUMO_POSOLOGIA = "A tentativa anterior usou posologia numérica (dose/via/intervalo/duração) sem diretriz controlada injetada. Reescreva sem esses dados posológicos específicos, em linguagem qualitativa.";
const _FEEDBACK_RESUMO_CORRUPCAO = "A resposta anterior teve corrupção de encoding (caractere inválido misturado ao texto). Gere novamente em português padrão, sem caracteres fora do esperado.";
const _FEEDBACK_RESUMO_FORMATO = 'A tentativa anterior não retornou o campo "pontos" preenchido corretamente. Responda exclusivamente com o JSON solicitado — schema {"titulo": "...", "pontos": [{"label": "...", "texto": "..."}]} — sem texto antes ou depois, sem markdown, sem cercas de código.';

const _CATEGORIAS_CORRIGIVEIS_RESUMO = [
  { tipo: "resumo_absoluto",     teste: (t) => /termo absoluto/.test(t), feedback: (t) => _feedbackResumoAbsoluto(t) },
  { tipo: "resumo_numero_orfao", teste: (t) => /número\(s\)\s+clínico\(s\)/.test(t), feedback: () => _FEEDBACK_RESUMO_NUMERO_ORFAO },
  { tipo: "resumo_posologia",    teste: (t) => /posologia numérica/.test(t), feedback: () => _FEEDBACK_RESUMO_POSOLOGIA },
  { tipo: "resumo_corrupcao",    teste: (t) => /corrupção de encoding/.test(t), feedback: () => _FEEDBACK_RESUMO_CORRUPCAO },
];

const _classificarFalhaResumoSA = (problemas, erroTecnico) => {
  if (erroTecnico) {
    return { tipo: "erro_tecnico", feedback: _FEEDBACK_RESUMO_FORMATO };
  }

  const lista = problemas || [];
  const todos = lista.join(" | ");

  if (_MOTIVO_GROUNDING_BLOQUEIO_RESUMO.test(todos)) {
    return { tipo: "grounding_bloqueio", feedback: null };
  }
  if (/resumo sem pontos\/texto/.test(todos)) {
    return { tipo: "resumo_vazio", feedback: _FEEDBACK_RESUMO_FORMATO };
  }

  const categoriasEncontradas = _CATEGORIAS_CORRIGIVEIS_RESUMO.filter((c) => c.teste(todos));
  if (categoriasEncontradas.length > 0) {
    return {
      tipo: categoriasEncontradas.length === 1 ? categoriasEncontradas[0].tipo : "corrigivel_misto",
      feedback: categoriasEncontradas.map((c) => c.feedback(todos)).join(" "),
    };
  }

  if (lista.length) {
    return {
      tipo: "outro",
      feedback: `Tentativa anterior rejeitada pelo motivo: "${lista[0]}". Corrija especificamente esse ponto na nova geração, mantendo o restante do conteúdo pedagógico.`,
    };
  }
  return { tipo: "outro", feedback: "Gere novamente, revisando com cuidado o formato e as regras do prompt." };
};

// ─── ORQUESTRADOR DE GERAÇÃO DO RESUMO — SUPER APOSTAS (retry controlado) ────
// Teto ABSOLUTO de 2 chamadas (nunca 3, nunca Opus — chamarIABruto injetado
// pelo chamador decide o transporte, mas o próprio resumoEngine.js só usa
// chamarIA, que nunca envia "model" no corpo da requisição e portanto a
// Cloud Function sempre resolve para Haiku por padrão). Tentativa 1 normal;
// se rejeição for do Tipo B (corrigível), 1 única retentativa com feedback
// específico; Tipo A (grounding_bloqueio) para imediatamente, sem retry —
// mesma disciplina de custo já aplicada a executarGeracaoSA (questão).
// chamarIABruto(systemPrompt, prompt) deve resolver para { dados, usage }.
export const executarGeracaoResumoSA = async (promptUsuario, systemPrompt, { grounding = false, groundingTexto = "" } = {}, chamarIABruto) => {
  const tentativas = [];

  const tentar = async (prompt, numero) => {
    try {
      const { dados, usage } = await chamarIABruto(systemPrompt, prompt);
      if (!dados?.pontos) {
        tentativas.push({ numero, usage, ok: false, erroTecnico: "resposta sem 'pontos'" });
        return { ok: false, dados: null, problemas: null, erroTecnico: "resposta sem 'pontos'" };
      }
      const validacao = validarResumoSA(dados.pontos, { grounding, groundingTexto });
      tentativas.push({ numero, usage, ok: validacao.ok, problemas: validacao.problemas });
      return { ok: validacao.ok, dados, problemas: validacao.problemas, erroTecnico: null };
    } catch (e) {
      tentativas.push({ numero, ok: false, erroTecnico: e.message });
      return { ok: false, dados: null, problemas: null, erroTecnico: e.message };
    }
  };

  const r1 = await tentar(promptUsuario, 1);
  if (r1.ok) return { status: "aprovado", dados: r1.dados, tentativas };

  const cls1 = _classificarFalhaResumoSA(r1.problemas, r1.erroTecnico);
  if (cls1.tipo === "grounding_bloqueio") {
    // PARA aqui (1 chamada) — recorte genuinamente sem lastro para o que a IA pediu.
    return { status: "bloqueado", problemas: r1.problemas, dados: r1.dados, tentativas };
  }

  // Tentativa 2 — única retentativa, sempre a mesma via (Haiku), feedback específico. Teto absoluto de 2 chamadas.
  const prompt2 = `${promptUsuario}\n\n⚠️ FEEDBACK DA TENTATIVA ANTERIOR: ${cls1.feedback}`;
  const r2 = await tentar(prompt2, 2);
  if (r2.ok) return { status: "aprovado", dados: r2.dados, tentativas };

  return { status: "rejeitado", problemas: r2.problemas || [`erro técnico: ${r2.erroTecnico}`], dados: r2.dados, tentativas };
};

// ─── NORMALIZAÇÃO DO CAMPO RACIOCÍNIO ────────────────────────────────────────
// Garante que o campo "raciocinio" sempre chega ao Firestore no formato canônico
// esperado pelo parseRaciocinio() do Simulador e SimuladorFeedback:
//   PADRÃO: X → DIFERENCIAL: Y → DECISÃO: Z → ARMADILHA: W
//
// Funciona mesmo quando o Claude:
//   • omite o separador " → " entre seções
//   • escreve os labels em caixa mista ("Padrão:", "padrão:")
//   • inclui → residuais dentro do conteúdo de uma seção
//
// Se os 4 labels estiverem ausentes ou fora de ordem, retorna o original
// (o frontend tem fallback linear para esses casos legados).
export const normalizarRaciocinio = (texto) => {
  if (!texto || typeof texto !== "string") return texto;

  const UP = texto.toUpperCase();
  const LABELS = ["PADRÃO:", "DIFERENCIAL:", "DECISÃO:", "ARMADILHA:"];

  // Todos os 4 labels precisam estar presentes
  if (!LABELS.every(l => UP.includes(l))) return texto;

  // Posição de cada label no texto (case-insensitive via mirror uppercase)
  const pos = LABELS.map(l => UP.indexOf(l));

  // Labels precisam aparecer na ordem canônica
  if (pos[0] >= pos[1] || pos[1] >= pos[2] || pos[2] >= pos[3]) return texto;

  // Extrai o conteúdo de cada seção: do fim do label até o início do próximo
  const extrair = (i) => {
    const inicio = pos[i] + LABELS[i].length;
    const fim = i < LABELS.length - 1 ? pos[i + 1] : texto.length;
    return texto.slice(inicio, fim)
      .replace(/\s*→\s*/g, " ") // remove → residuais dentro do conteúdo
      .replace(/\s+/g, " ")
      .trim();
  };

  const [padrao, diferencial, decisao, armadilha] = LABELS.map((_, i) => extrair(i));

  if (!padrao || !diferencial || !decisao || !armadilha) return texto;

  return `PADRÃO: ${padrao} → DIFERENCIAL: ${diferencial} → DECISÃO: ${decisao} → ARMADILHA: ${armadilha}`;
};

/**
 * Prompt sistema do ResumoGerador e resumoEngine.
 * Gera resumos estratégicos (8 blocos cirúrgicos) para a coleção "teorias".
 * Schema: { titulo, pontos[{ label, texto }] } — versao: 3
 * O blocoDir (montarBlocoDiretriz) é injetado no prompt do usuário, não aqui.
 */
export const PROMPT_SISTEMA_RESUMO = `Você é um preceptor de Medicina especializado na prova Revalida (INEP/SUS).
Gere um resumo estratégico em exatamente 8 pontos para o tema e contexto informados.
TODO o conteúdo deve ser coerente com o contexto clínico (ex: se "gestante", use medicações seguras na gestação; se "pediátrico", use critérios e doses pediátricas).
Se uma DIRETRIZ CONTROLADA for fornecida no prompt, ela é fonte de verdade — use os pontos críticos listados.
RETORNE APENAS JSON válido (sem markdown, sem código, sem texto extra):
{
  "titulo": "Nome do tema — Contexto (ex: Hipertensão arterial — Gestante)",
  "pontos": [
    { "label": "🔬 PADRÃO DE RECONHECIMENTO", "texto": "Como identificar este quadro na questão: palavras-chave do enunciado, dados que entregam o diagnóstico" },
    { "label": "⚖ DIAGNÓSTICO DIFERENCIAL", "texto": "As 2-3 condições que a prova coloca como distratores e por que se diferenciam neste contexto" },
    { "label": "💊 CONDUTA NO MOMENTO EXATO", "texto": "O que fazer AGORA neste contexto: especificidade de dose/via/momento para este perfil de paciente" },
    { "label": "⚠ ARMADILHA INEP", "texto": "O erro que a maioria comete neste tema: a resposta que parece certa mas está errada na prova" },
    { "label": "🎯 REGRA DE OURO", "texto": "A regra mnemônica ou heurística que resolve 80% das questões deste tema no Revalida" },
    { "label": "🛡 DIRETRIZ ATUAL", "texto": "Qual diretriz vigente (MS/SUS/FEBRASGO/SBP etc.) e o ponto crítico dela para este contexto" },
    { "label": "💀 ERRO QUE REPROVA", "texto": "A conduta que, se marcada, reprova — e por que é tecnicamente errada neste contexto" },
    { "label": "🔥 DICA MESTRE", "texto": "O insight que diferencia quem passa de quem não passa neste tema específico" }
  ]
}
Regras: máximo 2-3 frases por ponto · diretrizes MS/SUS · nunca inventar dados · contexto obrigatório em todo o conteúdo · cada ponto deve ser cirúrgico e específico para este paciente/contexto`;

/**
 * Prompt sistema do ResumoGerador — VARIANTE EXCLUSIVA SUPER APOSTAS.
 * Isolado de PROMPT_SISTEMA_RESUMO (usado por questões INEP/ImportadorPro,
 * que permanece intocado acima) para não alterar o resumo já homologado do
 * fluxo oficial. Usada por resumoEngine.js SOMENTE quando questao.modulo
 * === "super_apostas" — nunca para questões oficiais/INEP.
 *
 * Hotfix final de segurança + resumo estratégico: reestruturado de 8 para 7
 * pontos com papel pedagógico explícito e distinto de cada peça da Super
 * Aposta (questão/justificativas/raciocínio/conduta/dica mestre/estratégia),
 * para que o resumo AMPLIE — nunca repita — o que o aluno já viu na questão.
 * Schema { titulo, pontos[{label,texto}] } inalterado — TeoriaModal.jsx
 * renderiza a lista de pontos de forma genérica (map), sem depender da
 * quantidade ou dos labels exatos — nenhuma mudança visual necessária.
 */
export const PROMPT_SISTEMA_RESUMO_SA = `Você é um preceptor de Medicina especializado na prova Revalida (INEP/SUS).
Gere um resumo estratégico com ATÉ 7 pontos para o tema e contexto informados — inclua SOMENTE os pontos que agregam valor real e específico para este tema. Se um ponto ficaria genérico, redundante ou sem informação nova para este tema/contexto, OMITA-O do array "pontos" em vez de preencher artificialmente. Um resumo de 4 ou 5 pontos bem específicos vale mais que 7 pontos com enchimento. Nunca omita um ponto só para economizar — omita apenas quando ele realmente não teria conteúdo específico a acrescentar.
TODO o conteúdo deve ser coerente com o contexto clínico (ex: se "gestante", use medicações seguras na gestação; se "pediátrico", use critérios e doses pediátricas).
Se uma DIRETRIZ CONTROLADA for fornecida no prompt, ela é fonte de verdade — use os pontos críticos listados.

═══ REGRA DURA DE NÚMERO SEM SUPORTE — vale para TODOS os pontos, não só Tratamento Prático ═══
Nenhum ponto — em qualquer um dos 7 blocos — pode conter dose, duração, intervalo, volume, concentração, limiar de sinal vital, periodicidade, idade de corte ou qualquer critério normativo numérico que não esteja EXPLICITAMENTE sustentado pela DIRETRIZ CONTROLADA injetada neste prompt. Sem diretriz controlada para o tema, isso não impede o resumo inteiro — significa apenas que aquele detalhe numérico específico deve ser substituído por formulação qualitativa segura ou simplesmente omitido da frase. NUNCA complete um número por memória/probabilidade só para o texto parecer mais completo — um resumo qualitativo e seguro sobre reconhecimento, diferenciais, sinais de alarme, outras formas de cobrança e ponte para a 2ª fase é válido e publicável mesmo sem nenhum número, e é preferível a um resumo rejeitado por posologia/limiar inventado.

═══ MODO CONSERVADOR — OBRIGATÓRIO quando NÃO houver bloco "DIRETRIZ CONTROLADA" injetado neste prompt ═══
Achado real de auditoria: mesmo sem inventar posologia, um resumo ungrounded pode trazer risco clínico por outra via — afirmações absolutas/imperativas e sequências protocolares rígidas apresentadas como se fossem norma oficial, sem fonte. Isso é proibido tanto quanto inventar uma dose.

Sem diretriz controlada, você AINDA PODE ensinar (em linguagem qualitativa):
• reconhecimento geral do quadro e padrões clínicos típicos;
• diagnósticos diferenciais e o que os distingue;
• sinais de alarme descritos qualitativamente (sem limiar numérico);
• raciocínio clínico geral de investigação/conduta;
• outras formas de cobrança do tema na prova;
• orientação geral para avaliação ou encaminhamento;
• ponte para a 2ª fase em nível de competência prática geral.

Sem diretriz controlada, você NÃO PODE inventar/completar:
• dose, duração, intervalo, volume, concentração — já coberto acima;
• idade de corte normativa, periodicidade, limiar laboratorial ou qualquer critério numérico oficial (ex: contagem de células em líquor, corte etário para uma doença específica) — isso vale mesmo fora do contexto de medicamento;
• sequência protocolar rígida e numerada (ex: "sempre nesta ordem: exame → imagem → punção") como se fosse algoritmo oficial — descreva o racional geral, não um fluxograma que parece copiado de diretriz;
• recomendação terapêutica específica (classe, procedimento ou "sempre fazer X antes de Y") sem fonte;
• afirmações absolutas do tipo "sempre", "nunca", "obrigatório", "deve ser feito em todos os casos/pacientes", "padrão-ouro", "patognomônico" — mesmo que soem clinicamente plausíveis, elas viram uma citação de norma que este resumo não pode fazer sem fonte real;
• fonte, diretriz ou ano não injetados neste prompt.

ATENÇÃO — esta proibição vale em QUALQUER lugar do texto, sem exceção de contexto: dentro de exemplos ilustrativos, em frases hipotéticas atribuídas a um familiar/cuidador/paciente, dentro de aspas, no bloco "Outras formas de cobrança" e em qualquer recomendação prática. Não existe forma segura de escrever essas palavras sem diretriz controlada — mesmo como citação de exemplo ou fala de terceiro, a presença literal do termo rejeita o resumo inteiro. Se a frase que você quer escrever só funciona com uma dessas palavras, reescreva a frase inteira sem elas — nunca as inclua "entre aspas" pensando que isso as isenta.

Frases-substituto seguras (use este registro, não o imperativo/numérico):
"deve ser avaliado conforme o contexto clínico" · "considerar investigação por imagem quando indicado" · "encaminhar para avaliação especializada diante de sinais de alarme" · "seguir protocolo vigente aplicável" · "tratamento depende da etiologia e gravidade; diante de sinais de complicação, encaminhar para avaliação especializada".

No bloco TRATAMENTO PRÁTICO sem diretriz: não gere posologia nem protocolo terapêutico detalhado de memória — no máximo princípios gerais seguros (o exemplo de frase-substituto acima é o padrão esperado). Se não houver nada de seguro a dizer nesse nível, OMITA o bloco inteiro em vez de forçar conteúdo.
No bloco PONTE PARA A 2ª FASE sem diretriz: fique em nível de competência prática geral — o que perguntar, o que examinar, o que reconhecer como alarme, quando encaminhar, como orientar — nunca prescrição específica.

═══ PAPEL DESTE RESUMO NO ECOSSISTEMA DA QUESTÃO — REGRA CENTRAL ═══
Cada peça pedagógica da Super Aposta já cumpre um papel específico — este resumo NÃO deve repetir nenhum deles:
• A QUESTÃO testa uma decisão.
• As JUSTIFICATIVAS explicam cada alternativa.
• O RACIOCÍNIO CLÍNICO ensina como pensar NAQUELA questão específica.
• A CONDUTA (tto) ensina o que fazer NAQUELE caso.
• A DICA MESTRE existe para o aluno lembrar.
• A ESTRATÉGIA DA APOSTA explica por que aquele tema é estudado.
• Este RESUMO DO TEMA tem um papel diferente de todos: AMPLIAR o conhecimento do aluno para além daquela questão específica — outras formas de cobrança do mesmo tema e preparação para a 2ª fase.
O prompt do usuário pode incluir as justificativas das alternativas, o raciocínio clínico, a dica mestre e a estratégia da aposta da questão que o aluno já viu na tela — use-os SOMENTE como referência do que já foi coberto, para não duplicar a mesma frase ou o mesmo ângulo. Se o aluno já leu aquele conteúdo, ele não pode reencontrar as mesmas frases aqui. Este resumo só vale o clique se ensinar algo que a questão não ensinou.

RETORNE APENAS JSON válido (sem markdown, sem código, sem texto extra). O array "pontos" pode ter de 1 a 7 itens — inclua só os que se aplicam:
{
  "titulo": "Nome do tema — Contexto (ex: Hipertensão arterial — Gestante)",
  "pontos": [
    { "label": "🔍 COMO RECONHECER", "texto": "Quadro/padrão típico do tema (não só do caso da questão), sinais-chave e o dado que muda a decisão clínica" },
    { "label": "🧪 DIAGNÓSTICO E EXAMES", "texto": "Exame inicial quando aplicável, exame confirmatório quando aplicável, quando exame NÃO é necessário, e achados relevantes" },
    { "label": "🚨 GRAVIDADE / RED FLAGS", "texto": "Sinais de alarme e critérios objetivos de internação, encaminhamento ou transferência" },
    { "label": "💊 TRATAMENTO PRÁTICO", "texto": "Medicamento, dose, via, frequência, duração e ajustes relevantes APENAS quando houver diretriz controlada confiável; sem diretriz, descreva em nível de classe terapêutica/abordagem geral — nunca invente número; se não houver nada de útil a dizer em nível de classe terapêutica, omita este ponto" },
    { "label": "⚖ DIFERENCIAIS IMPORTANTES", "texto": "2 a 4 diagnósticos diferenciais realmente úteis para a prova e o que os distingue — quando aplicável ao tema" },
    { "label": "🔄 OUTRAS FORMAS DE COBRANÇA NO ENAMED/REVALIDA", "texto": "2 a 4 variações plausíveis de como esse mesmo recorte pode ser cobrado de outra forma (diagnóstico, exame, próximo passo, tratamento, contraindicação, momento de intervenção etc.) — nunca afirmar que algo 'vai cair' nem inventar estatística/probabilidade" },
    { "label": "🎓 PONTE PARA A 2ª FASE", "texto": "O que o candidato deveria verbalizar, investigar, examinar, prescrever/orientar ou encaminhar numa estação clínica prática relacionada a este tema — objetivo e concreto, não genérico" }
  ]
}
Regras: 2 a 4 frases por ponto (completo o bastante para valer o clique, conciso o bastante para revisão) · diretrizes MS/SUS · nunca inventar dose/ano/fonte sem diretriz controlada confiável · sem diretriz controlada, também PROIBIDO "sempre"/"nunca"/"obrigatório"/"em todos os casos"/sequência protocolar rígida — use linguagem qualitativa (modo conservador acima) · contexto obrigatório em todo o conteúdo · PROIBIDO repetir literalmente frases do raciocínio clínico, dica mestre, justificativas ou estratégia da aposta fornecidos como referência — cada ponto deve trazer informação que a questão específica não trouxe · array "pontos" com 1 a 7 itens, nunca preenchido artificialmente até 7`;
