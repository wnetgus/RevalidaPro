/**
 * Registro de fontes oficiais para a vigilância de diretrizes.
 *
 * prioridade:
 *   1 — Diretriz Brasileira (SUS / Ministério da Saúde / sociedades nacionais)
 *   2 — Guideline internacional amplamente aceita e incorporada ao Brasil
 *   3 — Guideline internacional NÃO oficialmente incorporada — exige revisão manual
 *
 * relevanciaRevalida: cobrança histórica no Revalida/INEP/ENAMED
 *   "ALTISSIMA" | "ALTA" | "MODERADA" | "BAIXA"
 */

export const FONTES_VIGILANCIA = [
  {
    tema_id: "has",
    orgao: "Sociedade Brasileira de Cardiologia / Sociedade Brasileira de Hipertensão",
    siglaOficial: "SBC/SBH",
    url: "https://www.sbc.org.br/publicacoes/guias-diretrizes",
    periodicidadeAnos: 4,
    descricao: "Diretrizes Brasileiras de Hipertensão Arterial",
    prioridade: 1,
    contextoBrasil: true,
    origemPais: "BR",
    aceitaNoBrasil: true,
    relevanciaRevalida: "ALTISSIMA",
    requerRevisaoManual: false,
  },
  {
    tema_id: "dm",
    orgao: "Sociedade Brasileira de Diabetes",
    siglaOficial: "SBD",
    url: "https://diabetes.org.br/diretrizes/",
    periodicidadeAnos: 2,
    descricao: "Diretrizes da Sociedade Brasileira de Diabetes — revisadas bienalmente",
    prioridade: 1,
    contextoBrasil: true,
    origemPais: "BR",
    aceitaNoBrasil: true,
    relevanciaRevalida: "ALTISSIMA",
    requerRevisaoManual: false,
  },
  {
    tema_id: "sepse",
    // SSC é internacional, mas a AMIB (brasileira) adota integralmente suas recomendações
    orgao: "Surviving Sepsis Campaign / Associação de Medicina Intensiva Brasileira",
    siglaOficial: "SSC/AMIB",
    url: "https://www.sccm.org/SurvivingSepsisCampaign/Guidelines",
    periodicidadeAnos: 4,
    descricao: "Surviving Sepsis Campaign — adotada pela AMIB e aceita no Brasil",
    prioridade: 2,
    contextoBrasil: false,
    origemPais: "INTL",
    aceitaNoBrasil: true,
    relevanciaRevalida: "ALTA",
    requerRevisaoManual: false,
  },
  {
    tema_id: "asma",
    orgao: "Global Initiative for Asthma",
    siglaOficial: "GINA",
    url: "https://ginasthma.org/reports/",
    periodicidadeAnos: 1,
    descricao: "GINA Report — padrão internacional aceito e amplamente utilizado no Brasil",
    prioridade: 2,
    contextoBrasil: false,
    origemPais: "INTL",
    aceitaNoBrasil: true,
    relevanciaRevalida: "ALTA",
    requerRevisaoManual: false,
  },
  {
    tema_id: "rastreamento_colo",
    orgao: "Instituto Nacional de Câncer",
    siglaOficial: "INCA",
    url: "https://www.inca.gov.br/publicacoes/livros",
    periodicidadeAnos: 5,
    descricao: "Diretrizes Brasileiras para o Rastreamento do Câncer do Colo do Útero — INCA/MS",
    prioridade: 1,
    contextoBrasil: true,
    origemPais: "BR",
    aceitaNoBrasil: true,
    relevanciaRevalida: "ALTISSIMA",
    requerRevisaoManual: false,
  },
  {
    tema_id: "prenatal",
    orgao: "Ministério da Saúde / Federação Brasileira de Ginecologia e Obstetrícia",
    siglaOficial: "MS/FEBRASGO",
    url: "https://www.gov.br/saude/pt-br/composicao/saes/daet/saude-da-mulher",
    periodicidadeAnos: 4,
    descricao: "Cadernos de Atenção Básica — Pré-natal baixo risco (MS)",
    prioridade: 1,
    contextoBrasil: true,
    origemPais: "BR",
    aceitaNoBrasil: true,
    relevanciaRevalida: "ALTISSIMA",
    requerRevisaoManual: false,
  },
  {
    tema_id: "sifilis",
    orgao: "Ministério da Saúde — Protocolo Clínico e Diretrizes Terapêuticas",
    siglaOficial: "MS/PCDT",
    url: "https://www.gov.br/saude/pt-br/composicao/svs/pcdt",
    periodicidadeAnos: 4,
    descricao: "PCDT para Atenção Integral às Pessoas com IST — sífilis adquirida e congênita",
    prioridade: 1,
    contextoBrasil: true,
    origemPais: "BR",
    aceitaNoBrasil: true,
    relevanciaRevalida: "ALTISSIMA",
    requerRevisaoManual: false,
  },
  {
    tema_id: "vacinacao",
    orgao: "Programa Nacional de Imunizações — Ministério da Saúde",
    siglaOficial: "PNI/MS",
    url: "https://www.gov.br/saude/pt-br/composicao/svs/pni",
    periodicidadeAnos: 1,
    descricao: "Calendário Nacional de Vacinação — atualizado anualmente pelo PNI/MS",
    prioridade: 1,
    contextoBrasil: true,
    origemPais: "BR",
    aceitaNoBrasil: true,
    relevanciaRevalida: "ALTISSIMA",
    requerRevisaoManual: false,
  },
  {
    tema_id: "hiv",
    orgao: "Ministério da Saúde — Protocolo Clínico e Diretrizes Terapêuticas",
    siglaOficial: "MS/PCDT",
    url: "https://www.gov.br/saude/pt-br/composicao/svs/pcdt",
    periodicidadeAnos: 3,
    descricao: "PCDT para Manejo da Infecção pelo HIV em Adultos — MS",
    prioridade: 1,
    contextoBrasil: true,
    origemPais: "BR",
    aceitaNoBrasil: true,
    relevanciaRevalida: "ALTISSIMA",
    requerRevisaoManual: false,
  },
  {
    tema_id: "tb",
    orgao: "Ministério da Saúde / Programa Nacional de Controle da Tuberculose",
    siglaOficial: "MS/PNCT",
    url: "https://www.gov.br/saude/pt-br/composicao/svs/tuberculose",
    periodicidadeAnos: 5,
    descricao: "Manual de Recomendações para o Controle da Tuberculose no Brasil — MS/PNCT",
    prioridade: 1,
    contextoBrasil: true,
    origemPais: "BR",
    aceitaNoBrasil: true,
    relevanciaRevalida: "ALTISSIMA",
    requerRevisaoManual: false,
  },
];

/** Config visual de cada nível de prioridade */
export const PRIORIDADE_CONFIG = {
  1: {
    label:  "Diretriz Brasileira",
    badge:  "🇧🇷",
    cor:    "#34d399",
    bg:     "rgba(16,185,129,0.08)",
    border: "rgba(16,185,129,0.25)",
  },
  2: {
    label:  "Internacional — aceita no Brasil",
    badge:  "🌎",
    cor:    "#60a5fa",
    bg:     "rgba(96,165,250,0.08)",
    border: "rgba(96,165,250,0.25)",
  },
  3: {
    label:  "Internacional — revisão manual",
    badge:  "⚠️",
    cor:    "#f59e0b",
    bg:     "rgba(245,158,11,0.08)",
    border: "rgba(245,158,11,0.25)",
  },
};

/** Config visual de relevância Revalida/INEP */
export const RELEVANCIA_CONFIG = {
  ALTISSIMA: { label: "ALTÍSSIMA", cor: "#34d399", bg: "rgba(16,185,129,0.08)",  border: "rgba(16,185,129,0.25)"  },
  ALTA:      { label: "ALTA",      cor: "#60a5fa", bg: "rgba(96,165,250,0.08)",  border: "rgba(96,165,250,0.25)"  },
  MODERADA:  { label: "MODERADA",  cor: "#fbbf24", bg: "rgba(251,191,36,0.08)",  border: "rgba(251,191,36,0.25)"  },
  BAIXA:     { label: "BAIXA",     cor: "#64748b", bg: "rgba(100,116,139,0.08)", border: "rgba(100,116,139,0.25)" },
};

export const getFonteParaTema = (tema_id) =>
  FONTES_VIGILANCIA.find(f => f.tema_id === tema_id) || null;
