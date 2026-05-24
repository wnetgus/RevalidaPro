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
export const chamarIA = async (systemPrompt, promptUsuario) => {
  const isDev = window.location.hostname === "localhost" ||
                window.location.hostname === "127.0.0.1";
  const endpoint = isDev
    ? "/functions/gerarQuestoesIA"
    : (import.meta.env.VITE_FUNCTIONS_BASE_URL ||
       "https://us-central1-revalidapro-f812e.cloudfunctions.net") + "/gerarQuestoesIA";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
