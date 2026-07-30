import React, { useState, useRef, useCallback, useEffect } from "react";
import { db, auth, obterTokenAppCheck, FIREBASE_PROJECT_ID } from "../firebase";
import { getQuestoes, invalidarCacheQuestoes } from "../utils/questoesCache";
import { obterHeadersAutenticados } from "../utils/apiAuth";
import { ambienteDevAutorizado } from "../utils/ambienteGuard";
import {
  doc, setDoc, getDocs, collection, query, where,
  serverTimestamp, writeBatch
} from "firebase/firestore";
import {
  FaRobot, FaPlay, FaStop, FaSpinner, FaCheckCircle,
  FaExclamationTriangle, FaInfoCircle, FaClock, FaFire,
  FaLayerGroup, FaTrash, FaDatabase, FaSearch,
  FaBookOpen, FaEdit, FaSave, FaSync, FaEye
} from "react-icons/fa";
import { doc as fsDoc, getDoc as fsGetDoc, setDoc as fsSetDoc } from "firebase/firestore";
import { SUPER_APOSTAS_CONFIG } from "../config/superApostasConfig";
import {
  CICLO_NIVEIS_SA, atribuirNivelAposta, calcularStatusAtualizacao,
  extrairJSONDoTexto,
  MAPA_TEMA_MESTRE, PADROES_FRAGMENTADOS, estaFragmentado, normalizarTemaMestre,
  PROMPT_SISTEMA_ROBO, normalizarRaciocinio,
  PROMPT_SISTEMA_SUPERAPOSTAS_ABCD, equilibrarGabaritoLote, executarGeracaoSA,
  validarLoteSA, MODELO_HAIKU_SA,
} from "../utils/promptEngine";
import { gerarESalvarResumo } from "../utils/resumoEngine";
import {
  DIRETRIZES_CONTROLADAS,
  detectarDiretriz, detectarDiretrizDinamica, montarBlocoDiretriz,
  avaliarBloqueioSeguro,
} from "../config/diretrizesControladas";
import { statusRecorteSA } from "../config/recortesStatusSA";

// ─── CONSTANTES DE TEMPORIZAÇÃO ────────────────────────────────────────────────
// 90s entre temas: buffer para a Cloud Function (timeout 180s) e evitar
// rate-limit da Anthropic. Reduzir apenas se a conta tiver cota mais alta.
const DELAY_ENTRE_TEMAS_MS  = 20_000;  // 20 segundos — seguro no Tier 1 pago (50 RPM Haiku)
const DELAY_RETRY_MS        = 45_000;  // 45 segundos antes da retentativa (buffer extra para temas densos)
// MAX_RETRIES: exclusivo do caminho LEGADO (2026.1, A–E, sem executarGeracaoSA) —
// reinício simples de chamarIA em caso de erro técnico/rede, sem fallback/validação.
// O formato ABCD (Super Apostas 2026.2) NÃO usa mais este valor: desde a
// auditoria de custo do Lote 002, ele tem teto fixo e único de 3 chamadas via
// executarGeracaoSA (promptEngine.js) — nunca reiniciado externamente.
const MAX_RETRIES           = 3;       // tentativas por tema (só formato legado): 1 original + 2 retries
const QUESTOES_POR_TEMA     = 3;       // questões geradas por tema

// CICLO_NIVEIS_SA, atribuirNivelAposta, calcularStatusAtualizacao → importados de promptEngine.js

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

// ─── DIAGNÓSTICO DEV — candidata rejeitada (observabilidade, não decisão) ────
// Gate pelo projeto Firebase do BUILD atual (VITE_FIREBASE_PROJECT_ID, vem de
// .env.development vs .env.production em tempo de build) — não por hostname,
// pra cobrir tanto localhost quanto o Hosting publicado em
// revalidapro-dev.web.app. Nunca verdadeiro num build gerado com
// .env.production, mesmo se algum dia servido por outro domínio.
const IS_DEV_PROJECT = import.meta.env.VITE_FIREBASE_PROJECT_ID === "revalidapro-dev";

// Réplica LOCAL, só para EXIBIÇÃO, de _extrairNumerosSignificativos
// (promptEngine.js). Deliberadamente duplicada em vez de importada/exportada
// de lá — esta correção não deve tocar no arquivo do validador de jeito
// nenhum. Nunca usada para decidir aprovação/rejeição, só para mostrar ao
// operador em dev quais números existem em cada campo.
const _extrairNumerosParaDiagnostico = (texto) => {
  const t = String(texto || "")
    .replace(/\bPASSO\s+\d+\b/gi, "")
    .replace(/\d+(?:[.,]\d+)?\s*[ªº]/g, "")
    .replace(/\(\s*\d{1,2}\s*\)/g, "")
    .replace(/(^|[.!?]\s+)\d{1,2}[.)]\s+/g, "$1");
  const nums = t.match(/\d+(?:[.,]\d+)?/g) || [];
  return [...new Set(nums.map((n) => n.replace(",", ".")))];
};

// Réplica LOCAL, só para EXIBIÇÃO, de _PADROES_AFIRMACAO_FORTE (promptEngine.js)
// — mesma lista de padrões, deliberadamente duplicada em vez de importada,
// pelo mesmo motivo do helper acima: nunca decide nada, só mostra ao operador
// em dev ONDE um termo absoluto foi encontrado no resumo rejeitado.
const _TERMOS_ABSOLUTOS_DIAGNOSTICO = [
  /patognom[oô]nic[oa]/i,
  /padr[ãa]o[\s-]?ouro/i,
  /\d{1,3}\s?%/,
  /desde\s+\d{4}/i,
  /\bsempre\b/i,
  /\bnunca\b/i,
  /\bobrigat[óo]ri[ao]s?\b/i,
  /\bem todos os (casos|pacientes)\b/i,
];
const _termosAbsolutosParaDiagnostico = (texto) => {
  const t = String(texto || "");
  const achados = [];
  for (const re of _TERMOS_ABSOLUTOS_DIAGNOSTICO) {
    const m = t.match(re);
    if (m) achados.push(m[0]);
  }
  return achados;
};

// ─── BUCKET DE RESULTADO — regeneração isolada de resumo (DEV-only) ─────────
// Traduz o status bruto de gerarESalvarResumo (resumoEngine.js) para um dos 4
// resultados exibidos ao administrador no controle de regeneração isolada.
// Pura — nenhuma decisão nova, só vocabulário de UI; a decisão real de
// aprovar/rejeitar já foi tomada por validarResumoSA/executarGeracaoResumoSA
// antes do status chegar aqui. "bloqueado_ambiente" nunca vem desta função —
// é atribuído pelo próprio handler, antes até de chamar gerarESalvarResumo.
const _bucketResultadoResumoIsolado = (status) => {
  if (status === "salvo") return "aprovado";
  if (status === "erro_tecnico") return "erro_operacional";
  // sem_tema, dedup_sessao, dedup_firestore, bloqueado_diretriz,
  // rejeitado_grounding, resposta_invalida ou qualquer status desconhecido:
  // nenhum deles persiste um resumo novo — todos contam como "rejeitado sem
  // persistência" para fins deste controle administrativo.
  return "rejeitado_sem_persistencia";
};

// ─── BUILDER PURO DO PROMPT DE TEMA (Super Apostas ABCD) ─────────────────────
// Extraído de dentro de iniciarRobo (achado real: precisava ser reaproveitado
// pelo Piloto Controlado DEV sem duplicar o texto do prompt). Puro — só
// concatena strings a partir dos 4 parâmetros recebidos; nenhum acesso a
// estado/refs do componente. iniciarRobo continua responsável por resolver
// blocoDir (cache de diretrizes, diretrizCacheRef) antes de chamar esta
// função — o cache em si NÃO foi extraído, para não alterar o comportamento
// de memoização do fluxo normal. Mesmo texto/formato de antes, byte a byte.
const construirPromptTemaSA = (tema, areaAtual, questoesPorTema, blocoDir) => {
  const temDetalhamento = /[(),;]|—|-{1,2}|\b(incluindo|especialmente|tratamento|diagnóstico|classificação|complicaç|abordagem|conduta|farmacológ|não.farmacológ|critério)\b/i.test(tema);

  return `Gere exatamente ${questoesPorTema} questõe${questoesPorTema > 1 ? "s" : ""} de múltipla escolha para o Revalida INEP.

Área: ${areaAtual}
Tema: ${tema}
${blocoDir}${temDetalhamento ? `
⚠️ TEMA COM DETALHAMENTO EXPLÍCITO DETECTADO:
Identifique todos os subtemas e direcionamentos presentes no texto acima.
${questoesPorTema > 1 ? `Distribua as ${questoesPorTema} questões cobrindo partes DIFERENTES do detalhamento.` : "Escolha a parte do detalhamento mais relevante/decisória para esta única questão."}
NÃO ignore nenhum elemento após vírgulas, hífens, parênteses ou "incluindo".
NÃO gere questões genéricas — siga o detalhamento como guia principal.
` : `
${questoesPorTema > 1 ? `Aborde ASPECTOS DIFERENTES do tema nas ${questoesPorTema} questões:` : "Aborde o aspecto mais decisório do tema:"}
ex.: diagnóstico, tratamento, complicação, critério de internação, rastreamento.
`}
Requisitos gerais:
- Caso clínico realista (UBS, UPA, emergência ou enfermaria)
- Diretrizes atualizadas 2023–2025
- Distratores plausíveis (pegadinhas de prova, não alternativas óbvias)
- Diversidade: diferentes faixas etárias, gêneros e contextos clínicos${questoesPorTema > 1 ? "\n- NÃO repita cenário ou conduta entre questões" : ""}`;
};

// ─── PRÓXIMO NÚMERO SEQUENCIAL NO FIRESTORE (SA) ─────────────────────────────
const obterProximoNumeroSA = async (saEdicao) => {
  try {
    const snap = await getDocs(
      query(collection(db, "questoes"), where("edicao", "==", saEdicao))
    );
    if (snap.empty) return 1;
    let max = 0;
    snap.docs.forEach((d) => {
      const n = d.data().numeroQuestao;
      if (typeof n === "number" && n > max) max = n;
    });
    return max + 1;
  } catch (e) {
    console.error("[RoboGerador] obterProximoNumeroSA:", e);
    return 1;
  }
};

// extrairJSONDoTexto → importado de promptEngine.js

// ─── PROMPT DO SISTEMA ───────────────────────────────────────────────────────
// Importado de promptEngine.js como PROMPT_SISTEMA_ROBO.
// Limites menores que o ImportadorPro: cabe 3 questões no max_tokens:8192.

// ─── PROMPT DE MIGRAÇÃO tema_mestre ────────────────────────────────────────
// Sistema separado: classifica/corrige tema_mestre sem gerar questões.
const PROMPT_MIGRACAO = `Você é um classificador clínico de banco de questões médicas.
Responda SOMENTE com um array JSON. Nenhum texto antes. Nenhum texto depois. Sem markdown.
Sua resposta deve começar com [ e terminar com ].

OBJETIVO: Para cada item, retornar o tema_mestre correto — a CATEGORIA CLÍNICA BASE no nível mais amplo possível.

═══ REGRA FUNDAMENTAL — GENERALIZAÇÃO MÁXIMA ═══
tema_mestre = a DOENÇA ou CONDIÇÃO PRINCIPAL, sem tipagem, sem qualificador, sem subtema.
Quando "tema_mestre_atual" estiver presente, significa que o valor ESTÁ ERRADO — corrija-o generalizando.

EXEMPLOS OBRIGATÓRIOS:
❌ "Diabetes mellitus tipo 1"          → ✅ "Diabetes mellitus"
❌ "Diabetes mellitus tipo 2"          → ✅ "Diabetes mellitus"
❌ "Cetoacidose diabética"             → ✅ "Diabetes mellitus"
❌ "Nefropatia diabética"              → ✅ "Diabetes mellitus"
❌ "Retinopatia diabética"             → ✅ "Diabetes mellitus"
❌ "Pé diabético"                      → ✅ "Diabetes mellitus"
❌ "HAS grave"                         → ✅ "Hipertensão arterial sistêmica"
❌ "HAS"                               → ✅ "Hipertensão arterial sistêmica"
❌ "Hipertensão gestacional"           → ✅ "Hipertensão arterial sistêmica"
❌ "Crise hipertensiva"                → ✅ "Hipertensão arterial sistêmica"
❌ "Emergência hipertensiva"           → ✅ "Hipertensão arterial sistêmica"
❌ "Encefalopatia hipertensiva"        → ✅ "Hipertensão arterial sistêmica"
❌ "Retinopatia hipertensiva"          → ✅ "Hipertensão arterial sistêmica"
❌ "Pré-eclâmpsia"                     → ✅ "Hipertensão arterial sistêmica"
❌ "Insuficiência cardíaca sistólica"  → ✅ "Insuficiência cardíaca"
❌ "ICC descompensada"                 → ✅ "Insuficiência cardíaca"
❌ "ICC"                               → ✅ "Insuficiência cardíaca"
❌ "Choque séptico"                    → ✅ "Sepse"
❌ "Sepse neonatal"                    → ✅ "Sepse"
❌ "Pneumonia bacteriana"              → ✅ "Pneumonia"
❌ "PAC"                               → ✅ "Pneumonia"
❌ "Asma grave"                        → ✅ "Asma"
❌ "Asma pediátrica"                   → ✅ "Asma"
❌ "DPOC exacerbado"                   → ✅ "Doença pulmonar obstrutiva crônica"
❌ "DPOC"                              → ✅ "Doença pulmonar obstrutiva crônica"
❌ "Angina instável"                   → ✅ "Doença arterial coronariana"
❌ "SCA sem supra"                     → ✅ "Doença arterial coronariana"
❌ "IAM"                               → ✅ "Infarto agudo do miocárdio"

PROIBIDO no tema_mestre (causa rejeição automática):
- Tipagem: "tipo 1", "tipo 2", "tipo I", "tipo II" etc.
- Gravidade: "grave", "leve", "moderado", "agudo", "crônico", "descompensado", "exacerbado"
- Faixa etária: "pediátrica", "neonatal", "no idoso", "do adulto"
- Contexto gestacional: "gestacional", "em gestante", "na gravidez"
- Subtópico após traço: "— tratamento", "— complicações", "— diagnóstico"
- Abreviações: HAS, DM, DM2, IAM, ICC, DPOC, PAC, IVAS, SCA etc.
- Contexto clínico: "pós-operatório", "hospitalar", "ambulatorial"

OUTRAS REGRAS:
1. Nome clínico completo e padronizado (primeira letra maiúscula, resto minúsculo)
2. Múltiplas doenças → escolher a claramente dominante
3. Sem clareza → usar "INDEFINIDO"
4. NUNCA invente temas além do que está no subtema fornecido

Formato de saída OBRIGATÓRIO (array, mesmo que 1 item):
[{"id":"id_do_documento","tema_mestre":"Nome Clínico Base"}]`;

// ─── PROMPT RESUMO DE TEMA ────────────────────────────────────────────────
const PROMPT_RESUMO_TEMA = `Você é um preceptor de medicina especializado no Revalida INEP/SUS.
Gere um resumo clínico estruturado para o tema informado, focado nas cobranças da prova.
Responda SOMENTE com JSON válido. Sem texto antes, sem markdown, sem explicações.

Formato obrigatório:
{
  "definicao": "Definição clínica objetiva em 2-3 frases. Incluir epidemiologia se relevante.",
  "diagnostico": "Critérios diagnósticos principais. Exames chave. Valores de corte quando aplicável.",
  "tratamento": "Conduta de 1ª linha pelo SUS/MS. Fármacos com doses quando possível. Escalonamento se necessário.",
  "pontos_chave": ["ponto 1", "ponto 2", "ponto 3", "ponto 4", "ponto 5"],
  "pegadinhas": ["armadilha clássica 1", "armadilha clássica 2", "armadilha clássica 3"],
  "dica_mestre": "Regra de ouro única que resolve 80% das questões sobre esse tema no Revalida."
}

Regras:
- definicao: máximo 60 palavras
- diagnostico: máximo 80 palavras
- tratamento: máximo 100 palavras
- pontos_chave: exatamente 5 itens, máximo 20 palavras cada
- pegadinhas: exatamente 3 itens, máximo 25 palavras cada
- dica_mestre: máximo 30 palavras
- Usar diretrizes MS/SUS/PCDT 2022-2025
- Foco em tomada de decisão clínica, não em decoreba`;

// MAPA_TEMA_MESTRE, PADROES_FRAGMENTADOS, estaFragmentado, normalizarTemaMestre
// → importados de promptEngine.js

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────────────────────
/**
 * Props:
 *   onQuestoesSalvas — callback chamado sempre que o robô salva questões.
 *                      Permite que o AdminPainel invalide o cache do Banco.
 */
const RoboGerador = ({ onQuestoesSalvas }) => {
  const [area, setArea]           = useState("Clínica Médica");
  const [temas, setTemas]         = useState("");
  const [edicao, setEdicao]       = useState(SUPER_APOSTAS_CONFIG.edicao_atual);
  // Super Apostas 2026.2: formato ABCD (4 alternativas) + nivel_aposta semântico
  // + estrategiaAposta + protocolo anti-pistas. Opt-in — desligado preserva 100%
  // do comportamento atual (A–E, ciclo posicional) para as edições antigas.
  const [formatoABCD, setFormatoABCD] = useState(false);
  // Modo validação/homologação — pede 1 questão por recorte em vez de 3.
  // Opt-in, só afeta o caminho ABCD (formatoABCD=true); o fluxo legado
  // (2026.1, A–E) nunca vê este estado — QUESTOES_POR_TEMA continua fixo em 3
  // lá. Desligado (padrão) preserva 100% do comportamento atual também no
  // formato ABCD — só muda quando o operador liga explicitamente.
  const [modoUmPorRecorte, setModoUmPorRecorte] = useState(false);

  const [rodando, setRodando]         = useState(false);
  const [log, setLog]                 = useState([]);
  const [progresso, setProgresso]     = useState({ atual: 0, total: 0 });
  const [countdown, setCountdown]     = useState(0);
  const [temasFalhos, setTemasFalhos] = useState([]);  // temas que falharam todas as tentativas

  // ── Estados da migração tema_mestre (controle por lote) ──────────────────
  const [migAberto, setMigAberto]           = useState(false);
  const [migrando, setMigrando]             = useState(false);
  const [escaneando, setEscaneando]         = useState(false);
  const [migLog, setMigLog]                 = useState([]);
  const [migProgresso, setMigProgresso]     = useState({ atual: 0, total: 0 });
  // Controle de lote: pendentes = fila de IDs ainda não processados
  const [migPendentes, setMigPendentes]     = useState([]);   // {id, subtema}[]
  const [migEscaneado, setMigEscaneado]     = useState(false); // scan foi concluído?
  const [migProcessados, setMigProcessados] = useState(0);    // total processados nesta sessão
  const [migTamLote, setMigTamLote]         = useState(20);   // docs por execução manual
  const migAbortRef = useRef(false);
  const migLogRef   = useRef(null);

  // ── Estados do painel Resumo por Tema ─────────────────────────────────────
  const [resAberto, setResAberto]       = useState(false);
  const [resTema, setResTema]           = useState("");
  const [resGerando, setResGerando]     = useState(false);
  const [resPreview, setResPreview]     = useState(null);   // objeto gerado pela IA
  const [resEditando, setResEditando]   = useState(false);  // modo edição
  const [resSalvo, setResSalvo]         = useState(false);  // feedback pós-save
  const [resExistente, setResExistente] = useState(null);   // resumo já salvo no Firestore
  const [resLog, setResLog]             = useState("");      // mensagem de status
  // Campo editável espelha resPreview durante edição
  const [resEdit, setResEdit]           = useState({
    definicao: "", diagnostico: "", tratamento: "",
    pontos_chave: [], pegadinhas: [], dica_mestre: ""
  });

  // ── Estados do painel Regeneração Isolada de Resumo (DEV-only) ────────────
  // Genérico: opera sobre qualquer questão SA existente carregada pelo ID do
  // documento — nenhum registro específico (R067, R092, R077...) é
  // codificado em nenhum lugar deste bloco.
  const [riDocId, setRiDocId]             = useState("");
  const [riQuestao, setRiQuestao]         = useState(null);   // questão já existente (getDoc) — nunca gerada aqui
  const [riBuscando, setRiBuscando]       = useState(false);
  const [riErroBusca, setRiErroBusca]     = useState("");
  const [riConfirmando, setRiConfirmando] = useState(false);  // exige 2º clique explícito antes de executar
  const [riExecutando, setRiExecutando]   = useState(false);  // desabilita a UI durante o processamento
  const [riResultado, setRiResultado]     = useState(null);   // { bucket, ... } | null
  const riEmExecucaoRef = useRef(false);  // trava síncrona extra — ignora clique duplo/concorrente

  // ── Estados do painel Piloto Controlado DEV (teto real de 1 chamada) ─────
  // Gate DEV-only idêntico ao da Regeneração Isolada de Resumo acima (duas
  // camadas: render + handler). NÃO reaproveita executarGeracaoSA (retry
  // embutido de até 3 chamadas) nem gerarESalvarResumo automático — chama
  // chamarIA e validarLoteSA diretamente, no máximo 1 vez cada, sem loop.
  const [pcTema, setPcTema]                     = useState("");
  const [pcRodando, setPcRodando]               = useState(false);
  const [pcConfirmando, setPcConfirmando]       = useState(false); // confirmação de 2 cliques — puramente de UI, antes do handler
  const [pcChamadas, setPcChamadas]             = useState(0);   // 0 ou 1 — nunca mais que 1 por rodada
  const [pcErro, setPcErro]                     = useState("");
  const [pcResultadoBruto, setPcResultadoBruto] = useState(null); // { validas, rejeitadas } cru de validarLoteSA
  const [pcCandidata, setPcCandidata]           = useState(null); // única questão válida, pendente de revisão
  const [pcProximoNum, setPcProximoNum]         = useState(null); // number | null — mesmo número usado no ID e no save
  const [pcIdPrevisto, setPcIdPrevisto]         = useState("");   // "SA_<edicao>_Q<n>", só para exibição
  const [pcRevisaoConfirmada, setPcRevisaoConfirmada] = useState(false);
  const [pcSalvando, setPcSalvando]             = useState(false);
  const [pcSalvo, setPcSalvo]                   = useState(null); // { docId } | null
  const [pcErroSalvar, setPcErroSalvar]         = useState("");
  const pcEmExecucaoRef  = useRef(false); // trava síncrona contra duplo clique/execução concorrente — geração
  const pcSalvandoRef    = useRef(false); // trava síncrona contra duplo clique/execução concorrente — salvamento

  const abortRef      = useRef(false);
  const countdownRef  = useRef(null);  // guarda o resolve() atual para resolver externamente
  const logEndRef     = useRef(null);  // âncora para auto-scroll do log

  // ── Cache de diretrizes dinâmicas (sessão) ────────────────────────────────
  // diretrizesRef: lista carregada do Firestore (null = não carregado ainda nesta sessão)
  // diretrizCacheRef: tema.toLowerCase() → diretriz detectada (evita re-detecção em retries)
  const diretrizesRef    = useRef(null);
  const diretrizCacheRef = useRef(new Map());
  // Distribuição de gabarito (Super Apostas 2026.2 / ABCD): contador mutável
  // { a, b, c, d } — resetado a cada execução do robô, acumula ao longo de
  // todos os temas/lotes do mesmo run para equilibrar a letra do gabarito.
  const balanceadorGabaritoRef = useRef({ a: 0, b: 0, c: 0, d: 0 });

  // ── Auto-scroll do log ────────────────────────────────────────────────────
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [log]);

  // ── Adiciona linha ao log ─────────────────────────────────────────────────
  const addLog = useCallback((msg, tipo = "info") => {
    const ts = new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit", minute: "2-digit", second: "2-digit"
    });
    setLog((prev) => [...prev, { ts, msg, tipo }]);
  }, []);

  // ── FIX BUG #1: Countdown com resolve externo ─────────────────────────────
  // Guarda o resolve() da Promise em countdownRef para que pararRobo()
  // possa resolvê-la imediatamente, desbloqueando o await no loop principal.
  const contarRegressiva = useCallback((segundos) => {
    return new Promise((resolve) => {
      setCountdown(segundos);
      let restante = segundos;

      // Expõe o resolve para que pararRobo() possa desbloquear o await
      countdownRef.current = { resolve, interval: null };

      const interval = setInterval(() => {
        restante -= 1;
        setCountdown(restante);
        if (restante <= 0) {
          clearInterval(interval);
          setCountdown(0);
          countdownRef.current = null;
          resolve();
        }
      }, 1000);

      countdownRef.current.interval = interval;
    });
  }, []);

  // ── Chama a Cloud Function (com mensagem de erro detalhada) ───────────────
  // systemPrompt é opcional — default preserva o comportamento atual (A–E).
  // Super Apostas 2026.2 passa PROMPT_SISTEMA_SUPERAPOSTAS_ABCD explicitamente.
  // model é opcional — sem ele, a function usa Haiku (comportamento de sempre).
  // Retorna { parsed, usage } — usage vem da API da Anthropic (input/output tokens),
  // usado só para telemetria/log, não para lógica de negócio.
  const chamarIA = useCallback(async (promptUsuario, systemPrompt = PROMPT_SISTEMA_ROBO, model = undefined) => {
    const isDev = window.location.hostname === "localhost" ||
                  window.location.hostname === "127.0.0.1";
    const endpoint = isDev
      ? "/functions/gerarQuestoesIA"
      : (import.meta.env.VITE_FUNCTIONS_BASE_URL ||
         "https://us-central1-revalidapro-f812e.cloudfunctions.net") + "/gerarQuestoesIA";

    // Micro Sprint 4B.2: gerarQuestoesIA exige Firebase ID token — esta é a
    // ÚNICA função que fala com o endpoint neste arquivo (ABCD via
    // chamarIABruto, legado A-E e "Resumo do Tema" chamam todas esta mesma
    // chamarIA local). Corrige a falha da 4B.1: este componente NUNCA
    // importou o chamarIA de promptEngine.js (que já foi corrigido) — define
    // o seu próprio, com o mesmo nome, que nunca recebeu o fix. Se não houver
    // sessão, lança ANTES do fetch (0 chamadas de rede).
    const headersAuth = await obterHeadersAutenticados(auth, obterTokenAppCheck);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headersAuth },
      body: JSON.stringify({ system: systemPrompt, prompt: promptUsuario, ...(model ? { model } : {}) }),
    });

    if (!response.ok) {
      // FIX BUG #4: mensagem de erro detalhada com status HTTP real
      let errorMsg = `Erro HTTP ${response.status}`;
      try {
        const err = await response.json();
        errorMsg = err.erro || err.error || errorMsg;
      } catch (_) {
        // JSON de erro não parseável — mantém a mensagem de status
      }
      throw new Error(errorMsg);
    }

    const data  = await response.json();
    const usage = data.usage || null;
    const texto = (data.content || []).map((c) => c.text || "").join("").trim();
    if (!texto) throw new Error("IA retornou resposta vazia.");

    const parsed = extrairJSONDoTexto(texto);
    if (!parsed || parsed.length === 0) {
      // Log diagnóstico: mostra os primeiros 300 chars para identificar o problema
      const preview = texto.substring(0, 300).replace(/\n/g, "↵");
      console.error("[RoboGerador] Resposta truncada ou inválida. Início:", preview);
      const motivo = texto.length < 100
        ? "resposta muito curta — possível erro de API"
        : !texto.includes("[") && !texto.includes("{")
          ? "IA não gerou JSON — resposta em texto puro"
          : "JSON truncado — resposta cortada pelo limite de tokens";
      throw new Error(`JSON não encontrado: ${motivo}. (${texto.length} chars recebidos)`);
    }
    return { parsed, usage };
  }, []);

  // ── Adaptador: chamarIA daqui é (promptUsuario, systemPrompt, model) —
  // executarGeracaoSA (promptEngine.js, fonte única da estratégia de retry/
  // modelo) espera (systemPrompt, promptUsuario, model). Só inverte a ordem
  // dos dois primeiros argumentos, sem lógica própria — a árvore de decisão
  // inteira (tentativas, feedback, escolha Haiku/Opus, teto de 3 chamadas)
  // vive em um único lugar (promptEngine.js), reaproveitável por scripts de
  // teste de custo fora do React (ver item 9 do relatório de auditoria).
  const chamarIABruto = useCallback(
    (systemPrompt, promptUsuario, model) => chamarIA(promptUsuario, systemPrompt, model),
    [chamarIA]
  );

  // ── Salva questões de um tema no Firestore ────────────────────────────────
  // FIX BUG #5: area recebe o valor via parâmetro — não depende de closure stale
  // opts.formatoABCD (Super Apostas 2026.2): não grava alternativaE/justificativaE,
  // usa nivel_aposta semântico da IA (com fallback pro ciclo posicional) e grava
  // estrategiaAposta quando presente. Sem opts (default), comportamento idêntico
  // ao anterior — questões antigas e a edição 2026.1 não são afetadas.
  const salvarQuestoes = useCallback(async (lista, edicaoSA, proximoNum, areaAtual, opts = {}) => {
    // semResumoAutomatico (Piloto Controlado DEV): quando true, pula o disparo
    // automático de gerarESalvarResumo abaixo — usado exclusivamente pelo
    // salvamento manual do piloto de 1 chamada, que não pode disparar uma 2ª
    // chamada de IA (resumo) sem autorização/consumo adicional explícito.
    // Default false preserva 100% do comportamento atual — nenhum chamador
    // pré-existente passa esta opção.
    const { formatoABCD = false, semResumoAutomatico = false } = opts;
    const anoAtual = String(new Date().getFullYear());
    const idBase   = `SA_${edicaoSA}`;

    for (let i = 0; i < lista.length; i++) {
      const q     = lista[i];
      const numQ  = proximoNum + i;
      const docId = `${idBase}_Q${numQ}`;

      const nivelIA      = String(q.probabilidade_prova || "").toUpperCase().trim();
      const nivelIAValido = ["ALTO", "MEDIO", "BAIXO"].includes(nivelIA);

      const finalData = {
        // FIX: sempre usa a área selecionada pelo usuário (ex: "Cirurgia").
        // q.materia da IA é IGNORADO — ela devolve strings livres que não
        // coincidem com os valores do filtro em SuperApostas.
        materia:     areaAtual,
        // tema_mestre: passa pelo MESMO normalizador canônico (MAPA_TEMA_MESTRE)
        // já usado na correção retroativa do AdminPainel — agora aplicado também
        // no momento da geração, para não deixar entrar fragmentação de sinônimo
        // ("Hipertensão" / "HAS" / "Hipertensão arterial" → sempre a forma canônica).
        tema_mestre: normalizarTemaMestre((q.tema_mestre || "").trim()) || "",
        // subtema: nunca mais cai em "materia" (fallback antigo misturava área
        // ampla com subtema — semanticamente errado); cai em tema_mestre.
        subtema:     (q.subtema || "").trim() || q.tema_mestre || "",
        banca:       "Revalida INEP",
        ano:         q.ano          || anoAtual,
        enunciado:   q.enunciado    || "",
        imagemUrl:   q.imagemUrl    || "",
        gabarito:    q.gabarito     || "",
        raciocinio:  normalizarRaciocinio(q.raciocinio) || "",
        tto:         q.tto          || "",
        dicaMestre:  q.dicaMestre   || "",
        ano_diretriz:   q.ano_diretriz   || null,
        fonte_diretriz: q.fonte_diretriz || "",

        alternativaA: q.alternativaA || q.alts?.a?.texto || "",
        alternativaB: q.alternativaB || q.alts?.b?.texto || "",
        alternativaC: q.alternativaC || q.alts?.c?.texto || "",
        alternativaD: q.alternativaD || q.alts?.d?.texto || "",
        justificativaA: q.justificativaA || q.alts?.a?.nota || "",
        justificativaB: q.justificativaB || q.alts?.b?.nota || "",
        justificativaC: q.justificativaC || q.alts?.c?.nota || "",
        justificativaD: q.justificativaD || q.alts?.d?.nota || "",
        // alternativaE/justificativaE: SÓ gravadas fora do formato ABCD.
        // Simulador já tolera o campo ausente — retrocompat sem mudar a tela.
        ...(formatoABCD ? {} : {
          alternativaE:   q.alternativaE   || q.alts?.e?.texto || "",
          justificativaE: q.justificativaE || q.alts?.e?.nota  || "",
        }),

        numeroQuestao:      numQ,
        status_atualizacao: calcularStatusAtualizacao(q.ano_diretriz),
        // nivel_aposta: semântico (via IA) quando formatoABCD e a IA respondeu um
        // valor válido; caso contrário cai no ciclo posicional de sempre — questões
        // antigas continuam exatamente como estavam (não são reclassificadas).
        nivel_aposta: (formatoABCD && nivelIAValido) ? nivelIA : atribuirNivelAposta(i, lista.length),
        nivel_aposta_origem: (formatoABCD && nivelIAValido) ? "classificacao_ia" : "ciclo_posicional",
        // Justificativa interna da classificação — nunca exibida ao aluno (não é
        // consumida por nenhuma tela); serve só de registro/auditoria.
        ...(formatoABCD && nivelIAValido && q.probabilidade_justificativa
          ? { nivel_aposta_motivo: String(q.probabilidade_justificativa).trim() }
          : {}),

        // estrategiaAposta: campo opcional exclusivo do formato ABCD 2026.2.
        ...(formatoABCD && q.estrategiaAposta ? { estrategiaAposta: String(q.estrategiaAposta).trim() } : {}),
        formatoAlternativas: formatoABCD ? "ABCD" : "ABCDE",

        id:           docId,
        provaId:      "",           // isolamento — nunca aparece em queries INEP
        isOficial:    false,
        modulo:       "super_apostas",
        edicao:       edicaoSA,
        origem_prova: "RoboIA",
        instituicao:  "Revalida INEP",

        possui_imagem: false,
        tipo_imagem:   null,
        url_imagem:    null,

        criadoEm: serverTimestamp(),
      };

      await setDoc(doc(db, "questoes", docId), finalData);

      // Resumo do Tema — fire-and-forget continua (não bloqueia o salvamento
      // da questão nem o avanço do robô para o próximo tema), mas agora todo
      // desfecho é logado — antes o .catch(() => {}) engolia qualquer falha
      // em silêncio e o operador só descobria que "o resumo não apareceu"
      // olhando a tela do aluno, sem saber o motivo.
      // semResumoAutomatico: pula inteiramente este bloco — usado só pelo
      // salvamento manual do Piloto Controlado DEV (teto real de 1 chamada de
      // IA por rodada; gerarESalvarResumo poderia disparar até mais 2).
      if (!semResumoAutomatico) gerarESalvarResumo(finalData)
        .then((r) => {
          const chave = r?.key ? ` (${r.key})` : "";
          switch (r?.status) {
            case "salvo":
              // Retry controlado do resumo (hotfix): tentativas > 1 significa
              // que a 1ª candidata foi rejeitada por motivo corrigível e a 2ª
              // (única retentativa, sempre Haiku) foi aprovada. Log visível em
              // qualquer ambiente — é logging normal de operação, não o
              // diagnóstico DEV detalhado (esse continua só em dev).
              if (r.tentativas > 1) {
                addLog(`   🔄 Resumo rejeitado na tentativa 1 — retry corretivo 1/1`, "aviso");
                addLog(`   ✅ Resumo aprovado na tentativa 2`, "ok");
              }
              addLog(`   📚 Resumo do Tema salvo${chave} — ${r.blocos} bloco(s).`, "ok");
              break;
            case "dedup_sessao":
              addLog(`   📚 Resumo do Tema não gerado — já tentado nesta sessão${chave}.`, "detalhe");
              break;
            case "dedup_firestore":
              addLog(`   📚 Resumo do Tema reaproveitado — já existia no Firestore${chave}.`, "detalhe");
              break;
            case "rejeitado_grounding":
              if (r.bloqueadoPorGrounding) {
                addLog(`   ⚠️  Resumo do Tema REJEITADO por grounding${chave} — ${(r.problemas || []).join(" | ")}`, "aviso");
              } else {
                addLog(`   🔄 Resumo rejeitado na tentativa 1 — retry corretivo 1/1`, "aviso");
                addLog(`   ⚠️ Resumo rejeitado após 2 tentativas — encaminhar para revisão${chave} — ${(r.problemas || []).join(" | ")}`, "aviso");
              }
              // ── Diagnóstico DEV — resumo rejeitado ────────────────────────
              // Só em revalidapro-dev (IS_DEV_PROJECT), equivalente ao
              // diagnóstico já existente para candidata de questão. Não
              // persiste nada — só log visual do painel, nunca Firestore.
              // Não altera validarResumoSA, o prompt do resumo, grounding,
              // regras SA nem a decisão de rejeitar (já tomada acima).
              if (IS_DEV_PROJECT) {
                const problemasTexto = (r.problemas || []).join(" | ");
                const pontos = Array.isArray(r.pontos) ? r.pontos : [];
                addLog(`🧾 DIAGNÓSTICO DEV — resumo rejeitado`, "detalhe");
                addLog(`   chave: ${r.key || "?"}`, "detalhe");
                addLog(`   motivo(s): ${problemasTexto || "(nenhum registrado)"}`, "detalhe");
                addLog(`   grounding usado: ${r.grounding ? `${r.grounding.id} — ${r.grounding.fonte} (${r.grounding.ano})` : "nenhuma"}`, "detalhe");
                if (pontos.length === 0) {
                  addLog(`   blocos: (nenhum bloco recebido)`, "detalhe");
                } else {
                  pontos.forEach((p, idx) => {
                    addLog(`   ── bloco ${idx + 1}: ${p?.label || "(sem título)"} ──`, "detalhe");
                    addLog(`   ${p?.texto || "(vazio)"}`, "detalhe");
                  });
                }
                const textoCompleto = pontos.map((p) => p?.texto || "").join(" ");
                const numsResumo = _extrairNumerosParaDiagnostico(textoCompleto);
                addLog(`   números extraídos do resumo: ${numsResumo.join(", ") || "nenhum"}`, "detalhe");

                // Números "sem suporte" extraídos do texto do MOTIVO real (já
                // calculado por validarResumoSA) — nunca recalculados aqui,
                // pra não haver risco de divergência com o que de fato causou
                // a rejeição. Cobre os dois formatos de motivo (com/sem
                // grounding) que validarResumoSA pode gerar.
                const semSuporteMatch =
                  problemasTexto.match(/número\(s\)\s+([\d.,\s]+?)\s+no resumo não aparece/) ||
                  problemasTexto.match(/número\(s\)\s+clínico\(s\)\s+\(([\d.,\s]+?)\)\s+sem diretriz/);
                if (semSuporteMatch) {
                  const semSuporteNums = semSuporteMatch[1].split(",").map((s) => s.trim()).filter(Boolean);
                  addLog(`   números sem suporte: ${semSuporteNums.join(", ")}`, "aviso");
                } else {
                  addLog(`   números sem suporte: n/d — este motivo não é de suporte numérico (ver motivo acima)`, "detalhe");
                }

                const termosAbsolutos = _termosAbsolutosParaDiagnostico(textoCompleto);
                addLog(`   termo(s) absoluto(s) detectado(s): ${termosAbsolutos.length ? termosAbsolutos.join(", ") : "nenhum"}`, "detalhe");
              }
              break;
            case "resposta_invalida":
              addLog(`   ⚠️  Resumo do Tema falhou — resposta da IA sem os pontos esperados${chave}.`, "aviso");
              break;
            case "sem_tema":
              addLog(`   ⚠️  Resumo do Tema não gerado — questão sem tema_mestre.`, "aviso");
              break;
            case "erro_tecnico":
              addLog(`   ❌ Resumo do Tema falhou tecnicamente${chave} — ${r.erro}`, "erro");
              break;
            case "bloqueado_diretriz":
              addLog(`   🚫 Resumo do Tema BLOQUEADO (0 chamadas à IA)${chave} — ${r.motivo}`, "aviso");
              break;
            default:
              addLog(`   ⚠️  Resumo do Tema — status inesperado: ${JSON.stringify(r)}`, "aviso");
          }
        })
        .catch((e) => {
          // Rede de segurança: gerarESalvarResumo já captura seus próprios
          // erros internamente e sempre resolve com um status — isto só
          // dispararia por um bug genuinamente inesperado.
          addLog(`   ❌ Resumo do Tema — erro inesperado não tratado: ${e.message}`, "erro");
        });
    }
  }, []);

  // ── FUNÇÕES DO RESUMO POR TEMA ───────────────────────────────────────────
  const toResDocId = (tema) =>
    (tema || "").trim().replace(/[/.#[\]*]/g, "-");

  const buscarResumoExistente = async (tema) => {
    if (!tema.trim()) return;
    try {
      const snap = await fsGetDoc(fsDoc(db, "resumos_temas", toResDocId(tema)));
      if (snap.exists()) {
        setResExistente(snap.data());
        setResPreview(snap.data());
        setResLog("✅ Resumo existente carregado.");
      } else {
        setResExistente(null);
        setResPreview(null);
        setResLog("");
      }
    } catch (e) {
      setResLog("Erro ao buscar: " + e.message);
    }
  };

  const gerarResumo = async () => {
    if (!resTema.trim()) { setResLog("⚠ Informe o tema antes de gerar."); return; }
    setResGerando(true);
    setResPreview(null);
    setResExistente(null);
    setResSalvo(false);
    setResLog("Gerando resumo via IA…");
    try {
      const { parsed: resposta } = await chamarIA(
        `${PROMPT_RESUMO_TEMA}\n\nTEMA: ${resTema.trim()}`
      );
      // chamarIA retorna array; resumo é objeto único
      const raw = Array.isArray(resposta) ? resposta[0] : resposta;
      if (!raw || !raw.definicao) throw new Error("Resposta da IA inválida ou incompleta.");
      setResPreview(raw);
      setResEdit({
        definicao:    raw.definicao    || "",
        diagnostico:  raw.diagnostico  || "",
        tratamento:   raw.tratamento   || "",
        pontos_chave: Array.isArray(raw.pontos_chave) ? raw.pontos_chave : [],
        pegadinhas:   Array.isArray(raw.pegadinhas)   ? raw.pegadinhas   : [],
        dica_mestre:  raw.dica_mestre  || "",
      });
      setResLog("✅ Resumo gerado. Revise antes de salvar.");
    } catch (e) {
      setResLog("❌ Erro: " + e.message);
    } finally {
      setResGerando(false);
    }
  };

  const salvarResumo = async (dados) => {
    if (!resTema.trim()) return;
    try {
      const docData = {
        tema_mestre:  resTema.trim(),
        definicao:    dados.definicao    || "",
        diagnostico:  dados.diagnostico  || "",
        tratamento:   dados.tratamento   || "",
        pontos_chave: Array.isArray(dados.pontos_chave) ? dados.pontos_chave : [],
        pegadinhas:   Array.isArray(dados.pegadinhas)   ? dados.pegadinhas   : [],
        dica_mestre:  dados.dica_mestre  || "",
        criado_em:    serverTimestamp(),
      };
      await fsSetDoc(fsDoc(db, "resumos_temas", toResDocId(resTema)), docData);
      setResExistente(docData);
      setResPreview(docData);
      setResEditando(false);
      setResSalvo(true);
      setResLog("✅ Resumo salvo com sucesso!");
      setTimeout(() => setResSalvo(false), 3000);
    } catch (e) {
      setResLog("❌ Erro ao salvar: " + e.message);
    }
  };

  // ─── REGENERAÇÃO ISOLADA DE RESUMO — controle administrativo DEV-only ─────
  // Antes deste controle, o único caminho para gerarESalvarResumo(questao)
  // era como efeito colateral automático de gerar uma questão NOVA (ver
  // salvarQuestoes acima, linha ~490) — não havia forma de corrigir só o
  // resumo de uma questão SA já salva sem recriar a questão inteira. Este
  // handler chama exatamente o mesmo gerarESalvarResumo já homologado (mesmo
  // PROMPT_SISTEMA_RESUMO_SA, mesmo validarResumoSA, mesmo
  // executarGeracaoResumoSA, mesmo teto de 2 chamadas) — não duplica
  // nenhuma política clínica, só oferece um ponto de entrada administrativo
  // para uma questão já existente. Nunca chama o gerador de questão nem
  // grava em "questoes" — gerarESalvarResumo só escreve em "teorias".
  const buscarQuestaoParaResumoIsolado = async () => {
    setRiErroBusca("");
    setRiResultado(null);
    setRiQuestao(null);
    const id = riDocId.trim();
    if (!id) { setRiErroBusca('Informe o ID da questão (documento em "questoes").'); return; }
    setRiBuscando(true);
    try {
      const snap = await fsGetDoc(fsDoc(db, "questoes", id));
      if (!snap.exists()) { setRiErroBusca("Questão não encontrada nesse ID."); return; }
      const dados = snap.data();
      if (dados.modulo !== "super_apostas") {
        setRiErroBusca('Esta questão não pertence ao módulo Super Apostas ("modulo" ≠ "super_apostas").');
        return;
      }
      setRiQuestao({ id: snap.id, ...dados });
    } catch (e) {
      setRiErroBusca(`Erro ao buscar: ${e.message}`);
    } finally {
      setRiBuscando(false);
    }
  };

  // Gate fail-closed baseado no projeto Firebase REALMENTE inicializado
  // (FIREBASE_PROJECT_ID vem de app.options.projectId em src/firebase.js,
  // não de uma releitura da env var) — checado de novo aqui, no handler,
  // mesmo que a renderização já esconda o controle fora do DEV. Isso garante
  // que nenhuma chamada de IA/persistência ocorra mesmo que este handler
  // seja disparado por engano ou por um refactor futuro da UI.
  const executarRegeneracaoResumoIsolado = async () => {
    if (!ambienteDevAutorizado(FIREBASE_PROJECT_ID)) {
      setRiResultado({ bucket: "bloqueado_ambiente" });
      setRiConfirmando(false);
      return;
    }
    if (!riQuestao) return;
    if (riEmExecucaoRef.current) return; // trava síncrona — ignora cliques concorrentes/duplos
    riEmExecucaoRef.current = true;
    setRiExecutando(true);
    setRiResultado(null);
    try {
      const r = await gerarESalvarResumo(riQuestao);
      setRiResultado({ bucket: _bucketResultadoResumoIsolado(r?.status), ...r });
    } catch (e) {
      setRiResultado({ bucket: "erro_operacional", erro: e.message });
    } finally {
      riEmExecucaoRef.current = false;
      setRiExecutando(false);
      setRiConfirmando(false);
    }
  };

  // ── LOOP PRINCIPAL DO ROBÔ ────────────────────────────────────────────────
  const iniciarRobo = async () => {
    const listasTemas = temas
      .split("\n")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    if (listasTemas.length === 0) {
      addLog("Nenhum tema informado. Adicione pelo menos 1 tema.", "erro");
      return;
    }

    // Captura valores de estado agora, antes de qualquer await
    const areaAtual   = area;
    const edicaoAtual = edicao;
    const formatoABCDAtual = formatoABCD;
    const systemPromptAtual = formatoABCDAtual ? PROMPT_SISTEMA_SUPERAPOSTAS_ABCD : PROMPT_SISTEMA_ROBO;
    // Só o caminho ABCD respeita este modo — o legado sempre usa QUESTOES_POR_TEMA (3).
    const questoesPorTemaAtual = (formatoABCDAtual && modoUmPorRecorte) ? 1 : QUESTOES_POR_TEMA;

    // Reseta o balanceador de gabarito a cada execução — distribuição vale
    // por run, não acumula entre sessões diferentes do robô.
    balanceadorGabaritoRef.current = { a: 0, b: 0, c: 0, d: 0 };

    abortRef.current = false;
    setRodando(true);
    setLog([]);
    setTemasFalhos([]);
    setProgresso({ atual: 0, total: listasTemas.length });

    addLog(`🤖 Robô iniciado — ${listasTemas.length} tema(s) | Edição: ${edicaoAtual} | Área: ${areaAtual}`, "sistema");
    addLog(
      `⚙️  ${questoesPorTemaAtual} questõe${questoesPorTemaAtual > 1 ? "s" : ""}/tema · ${DELAY_ENTRE_TEMAS_MS/1000}s entre temas · ${
        formatoABCDAtual ? "3 chamadas máx./recorte (fluxo único, sem reinício)" : `${MAX_RETRIES} tentativas máx.`
      }`,
      "sistema"
    );
    if (formatoABCDAtual) {
      addLog(`🆕 Formato ABCD ativo (Super Apostas 2026.2) — 4 alternativas, nivel_aposta semântico, estrategiaAposta.`, "sistema");
      if (modoUmPorRecorte) {
        addLog(`🎯 Modo validação ativo — 1 questão por recorte (não 3). Use para homologar recortes específicos.`, "sistema");
      }
      addLog(`💰 Otimização de custo ativa — prompt caching, retry único com feedback, pré-check de recorte.`, "sistema");
    }

    // ── Carrega diretrizes ativas (uma vez por sessão) ────────────────────
    if (diretrizesRef.current === null) {
      try {
        const snapDir = await getDocs(collection(db, "diretrizes"));
        const ativas = snapDir.docs.map(d => d.data()).filter(d => d.ativa);
        diretrizesRef.current = ativas.length > 0
          ? ativas
          : DIRETRIZES_CONTROLADAS.filter(d => d.ativa);
        addLog(`📋 ${diretrizesRef.current.length} diretriz(es) carregada(s).`, "detalhe");
      } catch (_e) {
        diretrizesRef.current = DIRETRIZES_CONTROLADAS.filter(d => d.ativa);
        addLog("⚠️  Diretrizes: usando lista estática (Firestore indisponível).", "aviso");
      }
    }

    // ── Carrega subtemas já existentes (anti-duplicação) ──────────────────
    addLog("🔍 Verificando subtemas já cobertos no banco…", "info");
    let subtemasExistentes = new Set();
    try {
      const snapEx = await getDocs(
        query(collection(db, "questoes"), where("edicao", "==", edicaoAtual))
      );
      snapEx.docs.forEach((d) => {
        const sub = (d.data().subtema || "").toLowerCase().trim();
        if (sub) subtemasExistentes.add(sub);
      });
      addLog(`✅ ${subtemasExistentes.size} subtema(s) já existentes. Serão geradas variações quando necessário.`, "ok");
    } catch (_e) {
      addLog("⚠️  Não foi possível carregar subtemas existentes. Continuando sem filtro.", "aviso");
    }

    let totalSalvas = 0;

    // ── Processa cada tema sequencialmente ───────────────────────────────
    for (let idx = 0; idx < listasTemas.length; idx++) {
      if (abortRef.current) {
        addLog("🛑 Robô interrompido pelo usuário.", "sistema");
        break;
      }

      const tema = listasTemas[idx];
      setProgresso({ atual: idx + 1, total: listasTemas.length });

      const jaExiste = subtemasExistentes.has(tema.toLowerCase().trim());
      addLog(
        `▶️  [${idx + 1}/${listasTemas.length}] "${tema}"${jaExiste ? " — variação (subtema já existe)" : ""}`,
        "info"
      );

      // ── Pré-check de viabilidade (só formato ABCD 2026.2) ─────────────────
      // Auditoria de custo: bloquear ANTES de gastar qualquer token em
      // recortes já sabidamente inviáveis (src/config/recortesStatusSA.js) —
      // em vez de redescobrir o mesmo problema via 3 chamadas rejeitadas.
      // Objetivo: ZERO chamadas Anthropic para um recorte já bloqueado.
      if (formatoABCDAtual) {
        const statusPrevio = statusRecorteSA(tema);
        if (statusPrevio.status !== "LIBERADO") {
          addLog(
            `   🚫 "${tema}" — ${statusPrevio.status} (0 chamadas à IA). Motivo: ${statusPrevio.motivo}`,
            "aviso"
          );
          setTemasFalhos(prev => [...prev, tema]);
          continue; // sem chamada de IA, sem custo — não precisa do intervalo entre temas
        }
      }

      // ── Pré-check de governança clínica (Macro Sprint 2026.2) ─────────────
      // Bloqueia ANTES de qualquer chamada à IA quando o tema corresponde a uma
      // diretriz cadastrada mas não vigente (PENDENTE_REVISAO/DESATUALIZADA/
      // SUBSTITUIDA/BLOQUEADA) — ver AUDITORIA_ATUALIZACAO_CLINICA_NORMATIVA_2026_2.md.
      // Diferente do pré-check de recorte acima: aqui o bloqueio é por status da
      // FONTE, não do recorte em si. Um tema sem nenhuma diretriz correspondente
      // não é afetado (continua gerando sem grounding, comportamento inalterado).
      if (formatoABCDAtual) {
        const avaliacao = avaliarBloqueioSeguro(diretrizesRef.current, tema, "");
        if (avaliacao.bloqueado) {
          addLog(
            `   🚫 "${tema}" — GERAÇÃO BLOQUEADA (0 chamadas à IA). Diretriz "${avaliacao.diretriz?.tema}" com status ${avaliacao.diretriz?.status}: ${avaliacao.motivo}.`,
            "aviso"
          );
          setTemasFalhos(prev => [...prev, tema]);
          continue;
        }
      }

      let sucesso = false;

      if (formatoABCDAtual) {
        // ── Fluxo único, teto absoluto de 3 chamadas — nunca reiniciado ─────
        // Toda a árvore de decisão (Haiku 1ª tentativa → feedback → Haiku/Opus
        // conforme motivo → Opus última chance) vive em executarGeracaoSA
        // (promptEngine.js). Aqui só monta o prompt do tema e reporta o log.
        try {
          const proximoNum = await obterProximoNumeroSA(edicaoAtual);
          addLog(`   📊 Próximo ID será: SA_${edicaoAtual}_Q${proximoNum}`, "detalhe");

          const temaKey = tema.toLowerCase();
          if (!diretrizCacheRef.current.has(temaKey)) {
            const d = detectarDiretrizDinamica(diretrizesRef.current, tema, "")
                   || detectarDiretriz(tema, "");
            diretrizCacheRef.current.set(temaKey, d);
          }
          const diretrizTema = diretrizCacheRef.current.get(temaKey);
          const blocoDir = diretrizTema ? montarBlocoDiretriz(diretrizTema) : "";

          const promptTema = construirPromptTemaSA(tema, areaAtual, questoesPorTemaAtual, blocoDir);

          addLog(`   🧠 Chamando IA… (teto de 3 tentativas, sem reinício externo)`, "info");

          const resultado = await executarGeracaoSA(promptTema, systemPromptAtual, {
            abcd: true,
            grounding: Boolean(diretrizTema),
            // Texto real da diretriz injetada — grounding=true não basta mais;
            // validarLoteSA agora confere se todo número em tto/dicaMestre
            // realmente aparece aqui (saneamento final pré-produção em escala).
            // Usa o BLOCO COMPLETO (mesmo texto que o modelo recebeu, via
            // blocoDir), não só pontosCriticos — do contrário o próprio
            // "ANO DE REFERÊNCIA" da diretriz (ex. 2022) seria injetado no
            // prompt mas rejeitado como "sem suporte" ao aparecer no tto.
            groundingTexto: blocoDir || "",
            // Quantidade real esperada nesta chamada (achado real R079: Opus
            // devolveu 2 candidatas no modo validação, que pede 1 — nada
            // conferia isso antes). Fonte única de verdade: a MESMA variável
            // já usada para montar "Gere exatamente N questões" no prompt.
            esperado: questoesPorTemaAtual,
          }, chamarIABruto);

          resultado.tentativas.forEach((t) => {
            const cache = t.usage?.cache_read_input_tokens || t.usage?.cache_creation_input_tokens
              ? ` cache_read:${t.usage.cache_read_input_tokens || 0} cache_write:${t.usage.cache_creation_input_tokens || 0}`
              : "";
            const infoTokens = t.usage ? ` (in:${t.usage.input_tokens} out:${t.usage.output_tokens}${cache})` : "";
            if (t.erro) {
              addLog(`   ⚠️  [tentativa ${t.numero} — ${t.modelo}] erro: ${t.erro}${infoTokens}`, "aviso");
            } else {
              addLog(`   🧪 [tentativa ${t.numero} — ${t.modelo}] ${t.validas} válida(s) / ${t.rejeitadas} rejeitada(s)${infoTokens}`, t.validas > 0 ? "ok" : "aviso");
              // Achado ao testar em dev: uma questão pode acumular MAIS de um
              // motivo de rejeição ao mesmo tempo (ex.: anti-pista estrutural
              // + número sem suporte na diretriz, no mesmo candidato) — mostrar
              // só o primeiro escondia o motivo que de fato bloqueava o recorte.
              // Junta TODOS os motivos do 1º candidato rejeitado desta tentativa.
              if (t.motivos?.length) {
                addLog(`      ↳ motivo(s): ${t.motivos.join(" | ")}`, "detalhe");
              }
            }
          });
          if (resultado.bloqueadoPorGrounding) {
            addLog(`   🚫 Bloqueado por grounding insuficiente — trocar de modelo não resolveria (parado sem gastar a 3ª chamada).`, "aviso");
          }
          if (resultado.altoRiscoRevisao) {
            addLog(`   ⚠️  Conteúdo aceito com sinalização de revisão humana (alto risco clínico).`, "aviso");
          }
          addLog(`   🛑 PARAR — ${resultado.tentativas.length} tentativa(s) usada(s) para este recorte (teto: 3).`, "detalhe");

          resultado.rejeitadas.forEach(({ motivos }, ridx) => {
            addLog(`   🚫 Questão ${ridx + 1} do lote rejeitada — ${motivos.join("; ")}`, "aviso");
          });

          // ── Diagnóstico DEV — candidata rejeitada ─────────────────────────
          // Só em revalidapro-dev (IS_DEV_PROJECT). Não persiste nada — só
          // aparece no log visual do painel, nunca no Firestore. Em produção
          // este bloco inteiro não executa; o log acima (resumido) é tudo que
          // aparece lá, sem nenhuma linha a mais.
          if (IS_DEV_PROJECT && resultado.rejeitadas.length > 0) {
            const ultimaTentativa = resultado.tentativas[resultado.tentativas.length - 1];
            resultado.rejeitadas.forEach(({ questao, motivos }) => {
              const motivosTexto = motivos.join(" | ");
              addLog(`🧾 DIAGNÓSTICO DEV — candidata rejeitada`, "detalhe");
              addLog(`   tentativa: ${ultimaTentativa?.numero ?? "?"} | modelo: ${ultimaTentativa?.modelo ?? "?"}`, "detalhe");
              addLog(`   motivo: ${motivosTexto}`, "detalhe");
              addLog(`   diretriz/grounding: ${diretrizTema ? `${diretrizTema.id} — ${diretrizTema.fonte} (${diretrizTema.ano})` : "nenhuma (recorte sem grounding)"}`, "detalhe");
              if (blocoDir) {
                addLog(`   números no grounding: ${_extrairNumerosParaDiagnostico(blocoDir).join(", ") || "nenhum"}`, "detalhe");
              }
              addLog(`   ── raciocinio (texto completo) ──`, "detalhe");
              addLog(`   ${questao?.raciocinio || "(vazio)"}`, "detalhe");
              addLog(`   ── tto (texto completo) ──`, "detalhe");
              addLog(`   ${questao?.tto || "(vazio)"}`, "detalhe");
              addLog(`   ── dicaMestre (texto completo) ──`, "detalhe");
              addLog(`   ${questao?.dicaMestre || "(vazio)"}`, "detalhe");
              addLog(`   ── notas das alternativas (a/b/c/d) ──`, "detalhe");
              ["a", "b", "c", "d"].forEach((letra) => {
                addLog(`   ${letra}) ${questao?.alts?.[letra]?.nota || "(vazio)"}`, "detalhe");
              });

              const numsTto  = _extrairNumerosParaDiagnostico(questao?.tto);
              const numsDica = _extrairNumerosParaDiagnostico(questao?.dicaMestre);
              addLog(`   números extraídos — tto: ${numsTto.join(", ") || "nenhum"} | dicaMestre: ${numsDica.join(", ") || "nenhum"}`, "detalhe");

              // A lista "sem suporte" é extraída do texto do MOTIVO real (já
              // calculado por validarLoteSA) — nunca recalculada aqui, pra
              // não haver risco de divergência entre o que aparece no
              // diagnóstico e o que de fato causou a rejeição.
              const semSuporteMatch = motivosTexto.match(/número\(s\)\s+([\d.,\s]+?)\s+em/);
              if (semSuporteMatch) {
                const semSuporteNums = semSuporteMatch[1].split(",").map((s) => s.trim()).filter(Boolean);
                const numsTtoSet  = new Set(numsTto);
                const numsDicaSet = new Set(numsDica);
                const campos = [];
                if (semSuporteNums.some((n) => numsTtoSet.has(n)))  campos.push("tto");
                if (semSuporteNums.some((n) => numsDicaSet.has(n))) campos.push("dicaMestre");
                addLog(`   números SEM suporte: ${semSuporteNums.join(", ")} (campo(s): ${campos.length ? campos.join(", ") : "não identificado"})`, "aviso");
              } else {
                addLog(`   números SEM suporte: n/d — este motivo não é de suporte numérico (ver motivo acima)`, "detalhe");
              }
            });
          }

          if (resultado.validas.length === 0) {
            throw new Error("Todas as questões do lote foram rejeitadas na validação pós-geração (teto de 3 tentativas atingido).");
          }

          const dados = equilibrarGabaritoLote(resultado.validas, ["a", "b", "c", "d"], balanceadorGabaritoRef.current);

          addLog(
            `   💾 Salvando ${dados.length} questão(ões)…${resultado.rejeitadas.length ? ` (${resultado.rejeitadas.length} rejeitada(s) na validação)` : ""}`,
            "info"
          );
          await salvarQuestoes(dados, edicaoAtual, proximoNum, areaAtual, { formatoABCD: true });

          totalSalvas += dados.length;
          dados.forEach((q) => {
            if (q.subtema) subtemasExistentes.add(q.subtema.toLowerCase().trim());
          });

          addLog(`   ✅ ${dados.length} questão(ões) salvas! (Total da sessão: ${totalSalvas})`, "ok");
          invalidarCacheQuestoes(); // próxima leitura vai buscar dados frescos
          if (typeof onQuestoesSalvas === "function") onQuestoesSalvas();

          sucesso = true;
        } catch (e) {
          addLog(`   ❌ Erro: ${e.message}`, "erro");
        }
      } else {
        // ── Caminho LEGADO (Super Apostas 2026.1, A–E) — sem validarLoteSA/
        // fallback, retry externo simples em caso de erro técnico/rede.
        // Comportamento INALTERADO por esta rodada (fora do escopo da
        // auditoria de custo, que mirou exclusivamente o formato ABCD 2026.2
        // usado no Lote 002). ───────────────────────────────────────────────

        // ── Pré-check de governança clínica (Micro Sprint 4A.2) ─────────────
        // Antes desta correção, o caminho legado só chamava
        // detectarDiretrizDinamica/detectarDiretriz para montar o texto de
        // grounding — se a diretriz correspondente estivesse bloqueada, essas
        // funções retornavam null e o bloqueio virava silenciosamente "sem
        // grounding", chamando a IA do mesmo jeito. Mesma checagem do ABCD,
        // aplicada aqui pela primeira vez.
        const avaliacaoLegado = avaliarBloqueioSeguro(diretrizesRef.current, tema, "");
        if (avaliacaoLegado.bloqueado) {
          addLog(
            `   🚫 "${tema}" — GERAÇÃO BLOQUEADA (0 chamadas à IA). Diretriz "${avaliacaoLegado.diretriz?.tema}" com status ${avaliacaoLegado.diretriz?.status}: ${avaliacaoLegado.motivo}.`,
            "aviso"
          );
          setTemasFalhos(prev => [...prev, tema]);
          continue;
        }

        let tentativa = 1;
        while (tentativa <= MAX_RETRIES && !abortRef.current) {
          if (tentativa > 1) {
            addLog(`   🔄 Tentativa ${tentativa}/${MAX_RETRIES} — aguardando ${DELAY_RETRY_MS/1000}s…`, "aviso");
            await delay(DELAY_RETRY_MS);
            if (abortRef.current) break;
          }

          try {
            const proximoNum = await obterProximoNumeroSA(edicaoAtual);
            addLog(`   📊 Próximo ID será: SA_${edicaoAtual}_Q${proximoNum}`, "detalhe");

            const temDetalhamento = /[(),;]|—|-{1,2}|\b(incluindo|especialmente|tratamento|diagnóstico|classificação|complicaç|abordagem|conduta|farmacológ|não.farmacológ|critério)\b/i.test(tema);

            const temaKey = tema.toLowerCase();
            if (!diretrizCacheRef.current.has(temaKey)) {
              const d = detectarDiretrizDinamica(diretrizesRef.current, tema, "")
                     || detectarDiretriz(tema, "");
              diretrizCacheRef.current.set(temaKey, d);
            }
            const diretrizTema = diretrizCacheRef.current.get(temaKey);
            const blocoDir = diretrizTema ? montarBlocoDiretriz(diretrizTema) : "";

            const promptTema =
`Gere exatamente ${QUESTOES_POR_TEMA} questões de múltipla escolha para o Revalida INEP.

Área: ${areaAtual}
Tema: ${tema}
${blocoDir}${temDetalhamento ? `
⚠️ TEMA COM DETALHAMENTO EXPLÍCITO DETECTADO:
Identifique todos os subtemas e direcionamentos presentes no texto acima.
Distribua as ${QUESTOES_POR_TEMA} questões cobrindo partes DIFERENTES do detalhamento.
NÃO ignore nenhum elemento após vírgulas, hífens, parênteses ou "incluindo".
NÃO gere questões genéricas — siga o detalhamento como guia principal.
` : `
Aborde ASPECTOS DIFERENTES do tema nas ${QUESTOES_POR_TEMA} questões:
ex.: diagnóstico, tratamento, complicação, critério de internação, rastreamento.
`}
Requisitos gerais:
- Caso clínico realista (UBS, UPA, emergência ou enfermaria)
- Diretrizes atualizadas 2023–2025
- Distratores plausíveis (pegadinhas de prova, não alternativas óbvias)
- Diversidade: diferentes faixas etárias, gêneros e contextos clínicos
- NÃO repita cenário ou conduta entre questões`;

            addLog(`   🧠 Chamando IA… (aguarde até 3 min)`, "info");
            const { parsed: dados } = await chamarIA(promptTema, systemPromptAtual);

            addLog(`   💾 Salvando ${dados.length} questão(ões)…`, "info");
            await salvarQuestoes(dados, edicaoAtual, proximoNum, areaAtual, { formatoABCD: false });

            totalSalvas += dados.length;
            dados.forEach((q) => {
              if (q.subtema) subtemasExistentes.add(q.subtema.toLowerCase().trim());
            });

            addLog(`   ✅ ${dados.length} questão(ões) salvas! (Total da sessão: ${totalSalvas})`, "ok");
            invalidarCacheQuestoes();
            if (typeof onQuestoesSalvas === "function") onQuestoesSalvas();

            sucesso = true;
            break;
          } catch (e) {
            addLog(`   ❌ Erro (tentativa ${tentativa}): ${e.message}`, "erro");
            tentativa++;
          }
        }
      }

      if (!sucesso && !abortRef.current) {
        addLog(`   ⚠️  "${tema}" falhou. Próximo tema.`, "aviso");
        setTemasFalhos(prev => [...prev, tema]);
      }

      // ── Intervalo entre temas (exceto no último) ───────────────────────
      if (!abortRef.current && idx < listasTemas.length - 1) {
        addLog(`   ⏱️  Aguardando ${DELAY_ENTRE_TEMAS_MS/1000}s antes do próximo tema…`, "detalhe");
        await contarRegressiva(DELAY_ENTRE_TEMAS_MS / 1000);
      }
    }

    if (!abortRef.current) {
      addLog(`🎉 Concluído! ${totalSalvas} questão(ões) geradas nesta sessão.`, "sistema");
      addLog(`💡 Acesse a aba "Banco de Questões" para visualizar (recarrega automaticamente).`, "detalhe");
    }

    setRodando(false);
    setCountdown(0);
  };

  // ── FIX BUG #1: Parar o robô desbloqueia o countdown imediatamente ────────
  const pararRobo = () => {
    abortRef.current = true;

    // Se há um countdown ativo, resolve a Promise agora para desbloquear o loop
    if (countdownRef.current) {
      const { interval, resolve } = countdownRef.current;
      clearInterval(interval);
      setCountdown(0);
      countdownRef.current = null;
      resolve(); // desbloqueia o `await contarRegressiva(...)` no loop
    }

    addLog("⏹️  Sinal de parada enviado. Finalizando operação atual…", "aviso");
  };

  const limparLog = () => {
    setLog([]);
    setProgresso({ atual: 0, total: 0 });
  };

  // ─── PILOTO CONTROLADO DEV — teto real de 1 chamada ────────────────────────
  // Objetivo: testar a geração de UM recorte com consumo real de IA
  // rigidamente limitado a 1 chamada, sem retry, sem resumo automático, sem
  // salvamento automático — homologação prévia à geração real de um recorte.
  // Reaproveita construirPromptTemaSA, chamarIA, validarLoteSA e
  // PROMPT_SISTEMA_SUPERAPOSTAS_ABCD — o MESMO builder/schema/contrato do
  // fluxo normal. NUNCA chama executarGeracaoSA (retry embutido de até 3
  // chamadas) nem gerarESalvarResumo (chamada automática de resumo). Gate
  // fail-closed em duas camadas (render + handler), mesmo padrão do controle
  // de Regeneração Isolada de Resumo (seção própria, acima). Seção isolada de
  // propósito — não compartilha nenhum estado com a Regeneração Isolada de
  // Resumo nem com o loop principal do robô (iniciarRobo/pararRobo).
  const executarPilotoControladoDEV = async () => {
    if (!ambienteDevAutorizado(FIREBASE_PROJECT_ID)) {
      setPcErro("Ambiente não autorizado — o Piloto Controlado só opera em revalidapro-dev.");
      return;
    }
    if (pcEmExecucaoRef.current) return; // trava síncrona — ignora clique duplo/concorrente
    const tema = pcTema.trim();
    if (!tema) { setPcErro("Informe exatamente um tema."); return; }
    if (/\n/.test(pcTema)) { setPcErro("Apenas um único tema é permitido neste modo — remova quebras de linha."); return; }
    if (pcChamadas >= 1) { setPcErro('Teto de 1 chamada já atingido nesta rodada — use "Reiniciar piloto" antes de tentar novamente.'); return; }

    pcEmExecucaoRef.current = true;
    setPcRodando(true);
    setPcConfirmando(false); // fecha a caixa de confirmação assim que a execução realmente começa
    setPcErro("");
    setPcErroSalvar("");
    setPcResultadoBruto(null);
    setPcCandidata(null);
    setPcProximoNum(null);
    setPcIdPrevisto("");
    setPcRevisaoConfirmada(false);
    setPcSalvo(null);

    try {
      // Mesmos pré-checks de custo-zero do fluxo normal — podem bloquear sem
      // gastar a única chamada permitida nesta rodada.
      const statusPrevio = statusRecorteSA(tema);
      if (statusPrevio.status !== "LIBERADO") {
        setPcErro(`Recorte ${statusPrevio.status} (0 chamadas à IA). Motivo: ${statusPrevio.motivo}`);
        return;
      }

      if (diretrizesRef.current === null) {
        try {
          const snapDir = await getDocs(collection(db, "diretrizes"));
          const ativas = snapDir.docs.map((d) => d.data()).filter((d) => d.ativa);
          diretrizesRef.current = ativas.length > 0 ? ativas : DIRETRIZES_CONTROLADAS.filter((d) => d.ativa);
        } catch (_e) {
          diretrizesRef.current = DIRETRIZES_CONTROLADAS.filter((d) => d.ativa);
        }
      }
      const avaliacao = avaliarBloqueioSeguro(diretrizesRef.current, tema, "");
      if (avaliacao.bloqueado) {
        setPcErro(`Bloqueado por governança clínica (0 chamadas à IA) — diretriz "${avaliacao.diretriz?.tema}" status ${avaliacao.diretriz?.status}: ${avaliacao.motivo}`);
        return;
      }

      const diretrizTema = detectarDiretrizDinamica(diretrizesRef.current, tema, "") || detectarDiretriz(tema, "");
      const blocoDir = diretrizTema ? montarBlocoDiretriz(diretrizTema) : "";
      const promptTema = construirPromptTemaSA(tema, area, 1, blocoDir);

      if (pcChamadas >= 1) { setPcErro("Teto de 1 chamada já atingido — abortando antes da chamada."); return; } // defesa em profundidade
      setPcChamadas(1); // incrementado imediatamente antes da única requisição

      const { parsed } = await chamarIA(promptTema, PROMPT_SISTEMA_SUPERAPOSTAS_ABCD, MODELO_HAIKU_SA);

      if (!Array.isArray(parsed) || parsed.length !== 1) {
        const motivo = `erro de protocolo: esperada 1 questão, recebida(s) ${Array.isArray(parsed) ? parsed.length : 0} — array rejeitado sem avaliação clínica individual`;
        setPcResultadoBruto({ validas: [], rejeitadas: [{ questao: null, motivos: [motivo] }] });
        setPcErro(motivo);
        return;
      }

      const { validas, rejeitadas } = validarLoteSA(parsed, {
        abcd: true, grounding: Boolean(diretrizTema), groundingTexto: blocoDir,
      });
      setPcResultadoBruto({ validas, rejeitadas });

      if (validas.length === 0) {
        setPcErro(`Questão rejeitada na validação: ${rejeitadas[0]?.motivos?.join("; ") || "motivo não especificado"}`);
        return;
      }

      const proximoNum = await obterProximoNumeroSA(edicao);
      setPcProximoNum(proximoNum);
      setPcIdPrevisto(`SA_${edicao}_Q${proximoNum}`);
      setPcCandidata(validas[0]);
    } catch (e) {
      setPcErro(`Erro técnico: ${e.message}`);
    } finally {
      pcEmExecucaoRef.current = false;
      setPcRodando(false);
    }
  };

  // Salvamento manual e separado — nunca chamado automaticamente pelo handler
  // acima. Reaproveita salvarQuestoes (mesmo schema/ID/transformação do fluxo
  // normal) com semResumoAutomatico:true, para nunca disparar gerarESalvarResumo.
  const salvarCandidataPilotoControladoDEV = async () => {
    if (!ambienteDevAutorizado(FIREBASE_PROJECT_ID)) {
      setPcErroSalvar("Ambiente não autorizado — salvamento bloqueado.");
      return;
    }
    if (pcSalvandoRef.current) return;   // trava síncrona — ignora clique duplo/concorrente no salvar
    if (pcEmExecucaoRef.current) return; // não salva durante geração em andamento
    if (!pcCandidata || !pcRevisaoConfirmada || pcSalvo) return;

    pcSalvandoRef.current = true;
    setPcSalvando(true);
    setPcErroSalvar("");
    try {
      const docIdEsperado = `SA_${edicao}_Q${pcProximoNum}`;
      const snapColisao = await fsGetDoc(fsDoc(db, "questoes", docIdEsperado));
      if (snapColisao.exists()) {
        setPcErroSalvar(`Colisão de ID detectada em "${docIdEsperado}" — outro documento foi salvo desde a geração. Reinicie o piloto antes de tentar novamente.`);
        return;
      }
      await salvarQuestoes([pcCandidata], edicao, pcProximoNum, area, { formatoABCD: true, semResumoAutomatico: true });
      invalidarCacheQuestoes();
      if (typeof onQuestoesSalvas === "function") onQuestoesSalvas();
      setPcSalvo({ docId: docIdEsperado });
    } catch (e) {
      setPcErroSalvar(`Erro ao salvar: ${e.message}`);
    } finally {
      pcSalvandoRef.current = false;
      setPcSalvando(false);
    }
  };

  // Reset controlado — nunca chama IA, nunca acessa Firestore, nunca salva.
  // Só funciona fora de execução (geração ou salvamento em andamento). Nunca
  // é acionado automaticamente após falha — só por ação humana explícita.
  const resetarPilotoControladoDEV = () => {
    if (pcEmExecucaoRef.current || pcSalvandoRef.current) return;
    setPcTema("");
    setPcRodando(false);
    setPcChamadas(0);
    setPcErro("");
    setPcResultadoBruto(null);
    setPcCandidata(null);
    setPcProximoNum(null);
    setPcIdPrevisto("");
    setPcRevisaoConfirmada(false);
    setPcSalvando(false);
    setPcSalvo(null);
    setPcErroSalvar("");
  };

  // ── Migração: corrige matérias incorretas já salvas no Firestore ─────────
  // A IA devolve textos livres como "Medicina Preventiva e Social" ou
  // "Saúde Coletiva" em vez de exatamente "Preventiva". Esta tabela de
  // sinônimos cobre todos os nomes que a IA costuma gerar por área.
  const SINONIMOS_AREA = {
    "Clínica Médica": [
      "clínica médica", "clinica medica", "medicina interna",
      "clínica geral", "clinica geral",
    ],
    "Cirurgia": [
      "cirurgia",
    ],
    "Pediatria": [
      "pediatria", "puericultura",
    ],
    "Ginecologia e Obstetrícia": [
      "ginecologia", "obstetrícia", "obstetricia",
      "ginecologia e obstetrícia", "ginecologia e obstetricia",
      "gineco-obstetrícia", "go ",
    ],
    "Preventiva": [
      "preventiva", "medicina preventiva", "saúde coletiva", "saude coletiva",
      "saúde pública", "saude publica", "epidemiologia",
      "medicina de família", "medicina de familia",
      "medicina de família e comunidade",
      "atenção primária", "atencao primaria",
      "atenção básica", "atencao basica",
      "saúde da família", "saude da familia",
      "vigilância epidemiológica", "vigilancia epidemiologica",
      "medicina social", "medicina preventiva e social",
    ],
  };

  /**
   * Detecta a área canônica de um texto de matéria gerado pela IA.
   * Ordem de prioridade:
   *   1. Correspondência exata (já está certo — retorna null)
   *   2. Começa com o nome da área (ex: "Cirurgia do Abdome" → "Cirurgia")
   *   3. Contém algum sinônimo da tabela acima
   */
  const detectarAreaCorreta = (matBruta) => {
    const areasValidas = SUPER_APOSTAS_CONFIG.areas;
    const mat = matBruta.trim();
    const matL = mat.toLowerCase();

    if (areasValidas.includes(mat)) return null;             // já correto

    // 1. Prefixo exato
    const porPrefixo = areasValidas.find((a) =>
      matL.startsWith(a.toLowerCase())
    );
    if (porPrefixo) return porPrefixo;

    // 2. Sinônimos
    for (const [area, sinonimos] of Object.entries(SINONIMOS_AREA)) {
      if (sinonimos.some((s) => matL.includes(s))) return area;
    }

    return null; // não identificado — deixa como está
  };

  const [corrigindo, setCorrigindo] = useState(false);

  const corrigirMaterias = async () => {
    setCorrigindo(true);
    addLog("🔧 Iniciando correção de matérias incorretas…", "sistema");

    try {
      const snap = await getDocs(
        query(collection(db, "questoes"), where("edicao", "==", edicao))
      );

      const paraCorrigir   = [];
      const naoIdentificados = [];

      snap.docs.forEach((d) => {
        const mat = (d.data().materia || "").trim();
        const areaCorreta = detectarAreaCorreta(mat);

        if (areaCorreta) {
          paraCorrigir.push({ ref: d.ref, areaCorreta, matErrada: mat });
        } else if (!SUPER_APOSTAS_CONFIG.areas.includes(mat)) {
          // matéria incorreta mas não identificada — loga para diagnóstico
          naoIdentificados.push(mat);
        }
      });

      if (naoIdentificados.length > 0) {
        addLog(`⚠️  ${naoIdentificados.length} questão(ões) com matéria não identificada (serão mantidas):`, "aviso");
        [...new Set(naoIdentificados)].forEach((m) =>
          addLog(`      • "${m}"`, "aviso")
        );
      }

      if (paraCorrigir.length === 0) {
        addLog("✅ Nenhuma questão precisa de correção.", "ok");
        setCorrigindo(false);
        return;
      }

      addLog(`📋 ${paraCorrigir.length} questão(ões) a corrigir. Gravando…`, "info");

      // writeBatch: máx 500 ops — divide em lotes de 400 por segurança
      const TAMANHO_BATCH = 400;
      for (let i = 0; i < paraCorrigir.length; i += TAMANHO_BATCH) {
        const lote = paraCorrigir.slice(i, i + TAMANHO_BATCH);
        const batch = writeBatch(db);
        lote.forEach(({ ref, areaCorreta }) => {
          batch.update(ref, { materia: areaCorreta });
        });
        await batch.commit();
      }

      // Resumo agrupado por área
      const porArea = {};
      paraCorrigir.forEach(({ areaCorreta }) => {
        porArea[areaCorreta] = (porArea[areaCorreta] || 0) + 1;
      });
      Object.entries(porArea).forEach(([area, qt]) =>
        addLog(`   ✏️  ${qt} questão(ões) → "${area}"`, "ok")
      );

      addLog(`✅ ${paraCorrigir.length} questão(ões) corrigidas com sucesso!`, "ok");
      addLog(`💡 Recarregue a aba "Super Apostas" para ver as questões no lugar certo.`, "detalhe");

      if (typeof onQuestoesSalvas === "function") onQuestoesSalvas();

    } catch (e) {
      addLog(`❌ Erro na correção: ${e.message}`, "erro");
    }

    setCorrigindo(false);
  };

  // ─── ESTILOS ──────────────────────────────────────────────────────────────
  const st = {
    wrap:      { padding: "4px 0" },
    aviso:     {
      background: "rgba(234,179,8,0.12)", border: "1px solid rgba(234,179,8,0.35)",
      borderRadius: "12px", padding: "14px 18px", marginBottom: "20px",
      display: "flex", alignItems: "center", gap: "10px",
      color: "#fbbf24", fontSize: "13px", fontWeight: "600"
    },
    card:      {
      background: "#1e293b", border: "1px solid #334155",
      borderRadius: "16px", padding: "24px", marginBottom: "20px"
    },
    cardTitle: {
      color: "#e2e8f0", fontSize: "14px", fontWeight: "700",
      marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px"
    },
    label:     {
      color: "#94a3b8", fontSize: "12px", fontWeight: "600",
      textTransform: "uppercase", letterSpacing: "0.5px",
      display: "block", marginBottom: "6px"
    },
    select:    {
      width: "100%", background: "#0f172a", border: "1px solid #334155",
      borderRadius: "8px", padding: "10px 12px", color: "#e2e8f0",
      fontSize: "13px", outline: "none"
    },
    textarea:  {
      width: "100%", background: "#0f172a", border: "1px solid #334155",
      borderRadius: "8px", padding: "10px 12px", color: "#e2e8f0",
      fontSize: "13px", resize: "vertical", minHeight: "140px",
      outline: "none", fontFamily: "inherit", boxSizing: "border-box"
    },
    rowDupla:  { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" },
    rowSingle: { marginBottom: "16px" },
    btnIniciar:{
      background: "linear-gradient(135deg, #4f46e5, #7c3aed)", color: "#fff",
      border: "none", borderRadius: "12px", padding: "14px 28px",
      cursor: "pointer", fontWeight: "700", fontSize: "14px",
      display: "flex", alignItems: "center", gap: "8px"
    },
    btnParar:  {
      background: "rgba(239,68,68,0.15)", color: "#ef4444",
      border: "1px solid rgba(239,68,68,0.4)", borderRadius: "12px",
      padding: "14px 28px", cursor: "pointer", fontWeight: "700",
      fontSize: "14px", display: "flex", alignItems: "center", gap: "8px"
    },
    btnLimpar: {
      background: "transparent", color: "#64748b",
      border: "1px solid #334155", borderRadius: "10px",
      padding: "8px 14px", cursor: "pointer", fontSize: "12px",
      display: "flex", alignItems: "center", gap: "6px"
    },
    acoes:     { display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" },
    barraWrap: {
      background: "#0f172a", borderRadius: "999px",
      height: "8px", overflow: "hidden", marginTop: "8px"
    },
    barraPreen:(pct) => ({
      height: "100%", width: `${pct}%`, borderRadius: "999px",
      transition: "width 0.4s ease",
      background: "linear-gradient(90deg, #4f46e5, #7c3aed)"
    }),
    logWrap:   {
      background: "#0f172a", border: "1px solid #1e293b",
      borderRadius: "12px", padding: "16px",
      maxHeight: "340px", overflowY: "auto",
      fontFamily: "monospace", fontSize: "12px"
    },
    logLinha:  (tipo) => {
      const cores = {
        ok: "#34d399", erro: "#f87171", aviso: "#fbbf24",
        sistema: "#818cf8", detalhe: "#475569", info: "#94a3b8"
      };
      return { color: cores[tipo] || "#94a3b8", marginBottom: "5px", lineHeight: "1.6", wordBreak: "break-word" };
    },
    countdown: {
      background: "rgba(79,70,229,0.15)", border: "1px solid rgba(79,70,229,0.35)",
      borderRadius: "10px", padding: "10px 16px", color: "#818cf8",
      fontSize: "13px", fontWeight: "700",
      display: "flex", alignItems: "center", gap: "8px", marginTop: "12px"
    },
    hint:      { color: "#475569", fontSize: "11px", marginTop: "6px", lineHeight: "1.5" },
    badge:     (cor) => ({
      display: "inline-flex", alignItems: "center", gap: "4px",
      background: cor + "18", color: cor, border: `1px solid ${cor}40`,
      borderRadius: "6px", padding: "2px 8px",
      fontSize: "11px", fontWeight: "700"
    }),
  };

  // ── Auto-scroll do log de migração ───────────────────────────────────────
  useEffect(() => {
    migLogRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [migLog]);

  const addMigLog = (msg, tipo = "info") => {
    const ts = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setMigLog(prev => [...prev, { ts, msg, tipo }]);
  };

  // ── SCAN: lê a base e monta a fila de pendentes (ZERO writes no Firestore) ──
  // Detecta tanto questões SEM tema_mestre quanto com tema_mestre FRAGMENTADO
  // (ex: "Diabetes mellitus tipo 2" que deveria ser "Diabetes mellitus").
  const escanearBase = async () => {
    setEscaneando(true);
    setMigLog([]);
    setMigPendentes([]);
    setMigEscaneado(false);
    setMigProcessados(0);
    setMigProgresso({ atual: 0, total: 0 });
    addMigLog("🔍 Escaneando base — nenhum documento será alterado…", "sistema");

    try {
      // getQuestoes() usa cache de sessão — evita leitura extra do Firestore
      const questoesDocs = await getQuestoes();
      const total = questoesDocs.length;

      const pendentes = [];
      let cntSemTema   = 0;
      let cntFragmentado = 0;

      questoesDocs.forEach(data => {
        const tm  = (data.tema_mestre || "").trim();
        const sub = (data.subtema     || "").trim();

        const semTema      = !tm || tm === "INDEFINIDO";
        const fragmentado  = !semTema && estaFragmentado(tm);

        if (semTema || fragmentado) {
          // Inclui tema_mestre_atual apenas quando já existe mas está errado
          pendentes.push({
            id: data.id,
            subtema: sub,
            ...(fragmentado ? { tema_mestre_atual: tm } : {}),
          });
          if (semTema)     cntSemTema++;
          if (fragmentado) cntFragmentado++;
        }
      });

      // Filtra docs onde nem subtema nem tema_mestre_atual existem (nada a classificar)
      const filaValida = pendentes.filter(q => q.subtema.length > 0 || q.tema_mestre_atual);

      setMigPendentes(filaValida);
      setMigProgresso({ atual: 0, total: filaValida.length });
      setMigEscaneado(true);

      addMigLog(`📊 Base: ${total} questões total`, "sistema");

      if (filaValida.length === 0) {
        addMigLog("✅ Todos os tema_mestre estão corretos. Nada a migrar.", "ok");
      } else {
        if (cntSemTema     > 0) addMigLog(`⚠️  ${cntSemTema} sem tema_mestre`, "aviso");
        if (cntFragmentado > 0) addMigLog(`⚠️  ${cntFragmentado} fragmentados (ex: "Diabetes mellitus tipo 2")`, "aviso");
        const nLotes = Math.ceil(filaValida.length / migTamLote);
        addMigLog(`📋 Total: ${filaValida.length} pendente(s) — ${nLotes} lote(s) de ${migTamLote}`, "info");
        addMigLog("👆 Clique em 'Rodar lote' para iniciar. Você controla o ritmo.", "sistema");
      }
    } catch (err) {
      addMigLog(`❌ Erro no scan: ${err.message}`, "erro");
    }

    setEscaneando(false);
  };

  // ── RODAR LOTE: processa APENAS os próximos N da fila — para em seguida ────
  // GARANTIA ANTI-LOOP: todos os docs do lote SEMPRE saem com tema_mestre válido.
  // Ordem de resolução por doc:
  //   1. IA respondeu com valor válido → normaliza e grava
  //   2. IA respondeu INDEFINIDO → tenta normalizar subtema como fallback
  //   3. IA não respondeu / falhou totalmente → usa subtema truncado como fallback
  //   4. Subtema também vazio → grava "A classificar" (valor estável, não volta à fila)
  const rodarLote = async () => {
    if (migPendentes.length === 0 || migrando) return;
    migAbortRef.current = false;
    setMigrando(true);

    const isDev = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    const endpoint = isDev
      ? "/functions/gerarQuestoesIA"
      : (import.meta.env.VITE_FUNCTIONS_BASE_URL || "https://us-central1-revalidapro-f812e.cloudfunctions.net") + "/gerarQuestoesIA";

    const lote      = migPendentes.slice(0, migTamLote);
    const loteNum   = Math.floor(migProcessados / migTamLote) + 1;
    const restantes = migPendentes.length - lote.length;

    const fragmentadosNoLote = lote.filter(q => q.tema_mestre_atual).length;
    addMigLog(
      `▶️  Lote ${loteNum} — ${lote.length} doc(s)${fragmentadosNoLote > 0 ? ` (${fragmentadosNoLote} fragmentados)` : ""} → IA…`,
      "info"
    );

    // Helper: constrói fallback a partir do subtema quando IA falha
    const buildFallback = (q) => {
      const raw = (q.subtema || q.tema_mestre_atual || "").trim();
      if (!raw) return "A classificar";
      // Tenta normalizar o subtema (ex: "crise hipertensiva — dx" → "HAS")
      const norm = normalizarTemaMestre(raw.replace(/\s*[-—]\s*.*$/, "").trim());
      if (norm && norm !== "INDEFINIDO" && !estaFragmentado(norm)) return norm;
      // Usa o subtema bruto sem subtópico (tudo após traço), max 80 chars
      const semSubtopico = raw.replace(/\s*[-—]\s*.*$/, "").trim().substring(0, 80);
      return semSubtopico || "A classificar";
    };

    // Mapa de respostas da IA: id → tema_mestre normalizado
    const parsedMap = new Map();

    try {
      const loteParaIA = lote.map(q => ({
        id: q.id,
        subtema: q.subtema,
        ...(q.tema_mestre_atual ? { tema_mestre_atual: q.tema_mestre_atual } : {}),
      }));

      const promptUsuario =
        `Classifique os subtemas abaixo aplicando GENERALIZAÇÃO MÁXIMA.\n` +
        `Quando "tema_mestre_atual" estiver presente, o valor ESTÁ ERRADO — corrija generalizando.\n` +
        `Responda SOMENTE com array JSON: [{"id":"...","tema_mestre":"..."}]\n` +
        JSON.stringify(loteParaIA);

      const headersAuth = await obterHeadersAutenticados(auth, obterTokenAppCheck);
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headersAuth },
        body: JSON.stringify({ system: PROMPT_MIGRACAO, prompt: promptUsuario }),
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data  = await resp.json();
      const texto = (data.content || []).map(c => c.text || "").join("").trim();
      const parsed = extrairJSONDoTexto(texto);

      if (parsed && Array.isArray(parsed)) {
        for (const item of parsed) {
          if (!item.id || !lote.find(q => q.id === item.id)) continue;
          const temaNorm = normalizarTemaMestre(item.tema_mestre || "");
          // Só registra se IA retornou valor realmente válido (não INDEFINIDO)
          if (temaNorm && temaNorm !== "INDEFINIDO") {
            parsedMap.set(item.id, temaNorm);
          }
        }
        addMigLog(`   IA: ${parsedMap.size}/${lote.length} doc(s) com tema válido`, "detalhe");
      } else {
        addMigLog(`   ⚠️  IA retornou formato inválido — todos os ${lote.length} doc(s) usarão fallback`, "aviso");
      }

    } catch (err) {
      addMigLog(`   ⚠️  Falha na IA (${err.message}) — todos os ${lote.length} doc(s) usarão fallback`, "aviso");
    }

    // ── Grava TODOS os docs do lote, sem exceção ──────────────────────────────
    const batch = writeBatch(db);
    let cntIA        = 0;  // gravados com tema da IA
    let cntNorm      = 0;  // gravados com normalização local
    let cntFallback  = 0;  // gravados com fallback de subtema
    let cntClassif   = 0;  // gravados como "A classificar"
    const logFallback = []; // IDs que precisarão revisão manual

    for (const q of lote) {
      let temaFinal;

      if (parsedMap.has(q.id)) {
        // IA respondeu com valor válido (já normalizado no step acima)
        const iaVal = parsedMap.get(q.id);
        const iaValOriginal = iaVal; // para detectar normalização adicional
        temaFinal = normalizarTemaMestre(iaVal); // segunda passagem: segurança extra
        if (temaFinal !== iaValOriginal) cntNorm++;
        else cntIA++;
      } else {
        // IA falhou para este doc → fallback
        temaFinal = buildFallback(q);
        if (temaFinal === "A classificar") {
          cntClassif++;
          logFallback.push(q.id);
        } else {
          cntFallback++;
        }
      }

      batch.update(doc(db, "questoes", q.id), { tema_mestre: temaFinal });
    }

    try {
      await batch.commit();
    } catch (batchErr) {
      addMigLog(`❌ Erro ao gravar lote ${loteNum}: ${batchErr.message}`, "erro");
      setMigrando(false);
      return;
    }

    // Avança a fila e atualiza contadores
    const novosProcessados = migProcessados + lote.length;
    setMigPendentes(prev => prev.slice(migTamLote));
    setMigProcessados(novosProcessados);
    setMigProgresso({ atual: novosProcessados, total: migProgresso.total });

    // Log de resultado
    const partes = [];
    if (cntIA       > 0) partes.push(`${cntIA} via IA`);
    if (cntNorm     > 0) partes.push(`${cntNorm} normalizados`);
    if (cntFallback > 0) partes.push(`${cntFallback} via subtema`);
    if (cntClassif  > 0) partes.push(`${cntClassif} "A classificar"`);
    addMigLog(`✅ Lote ${loteNum}: ${lote.length} docs gravados — ${partes.join(" · ")}`, "ok");

    if (logFallback.length > 0) {
      addMigLog(`   ℹ️  "A classificar" (${logFallback.length}): sem subtema disponível. Revise manualmente.`, "aviso");
    }

    if (restantes === 0) {
      addMigLog("🎉 Fila concluída! Nenhum doc ficou sem tema_mestre.", "sistema");
      addMigLog("💡 Rode o Scan para confirmar. Docs 'A classificar' precisam de revisão manual.", "sistema");
    } else {
      addMigLog(`📋 ${restantes} doc(s) ainda na fila — clique 'Rodar lote' para continuar.`, "sistema");
    }

    setMigrando(false);
  };

  const listasTemas = temas.split("\n").map(t => t.trim()).filter(Boolean);
  const pct = progresso.total > 0 ? Math.round((progresso.atual / progresso.total) * 100) : 0;

  return (
    <div style={st.wrap}>

      {/* ── AVISO "NÃO FECHE ESTA ABA" ─────────────────────────────────── */}
      {rodando && (
        <div style={st.aviso}>
          <FaExclamationTriangle size={16} />
          Não feche esta aba enquanto o robô estiver rodando — o processo será interrompido.
        </div>
      )}

      {/* ── HOMOLOGAÇÃO CONTROLADA DEV — teto real de 1 chamada (DEV-only) ──
          Posicionado no topo, ANTES de "Configuração do Robô", de propósito
          (achado real de incidente: o painel ficava no fim da página e era
          confundido com o checkbox "1 questão por recorte" do robô normal,
          que não tem nenhuma das garantias abaixo). Única renderização deste
          bloco no arquivo — não duplicar. */}
      {ambienteDevAutorizado(FIREBASE_PROJECT_ID) ? (
        <div style={{
          marginBottom: "20px", borderRadius: "16px", overflow: "hidden",
          background: "rgba(248,113,113,0.05)",
          border: "2px solid rgba(248,113,113,0.5)",
          padding: "16px",
        }}>
          <h4 style={{ display: "flex", alignItems: "center", gap: "8px", color: "#f1f5f9", fontSize: "14px", fontWeight: "900", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.3px" }}>
            <FaExclamationTriangle size={14} color="#f87171" /> Homologação Controlada DEV
          </h4>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "12px" }}>
            {[
              "MÁXIMO: 1 CHAMADA",
              "SEM RETRY",
              "SEM FALLBACK",
              "SEM SALVAMENTO AUTOMÁTICO",
              "SEM RESUMO AUTOMÁTICO",
              "REVISÃO HUMANA OBRIGATÓRIA",
            ].map((selo) => (
              <span key={selo} style={{
                fontSize: "10px", fontWeight: "800", color: "#fbbf24",
                background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.4)",
                borderRadius: "999px", padding: "4px 10px",
              }}>
                {selo}
              </span>
            ))}
          </div>

          <p style={{ fontSize: "11px", color: "#94a3b8", margin: "0 0 6px", lineHeight: 1.6 }}>
            Use exclusivamente este painel para testes controlados de um único recorte.
          </p>
          <p style={{ fontSize: "11px", color: "#e2e8f0", margin: "0 0 12px", lineHeight: 1.6 }}>
            Gera <strong>exatamente 1 questão</strong> de <strong>1 tema</strong> com <strong>no máximo 1 chamada de IA</strong> —
            sem retry, sem regeneração e sem resumo automático. A questão fica como candidata local pendente de
            revisão humana; o salvamento no DEV é uma ação manual separada. <strong>A chamada não é gratuita — uma
            execução real continua consumindo 1 chamada de IA.</strong>
          </p>

          <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
            <input
              type="text"
              value={pcTema}
              onChange={(e) => setPcTema(e.target.value)}
              placeholder="Um único tema (ex.: Aleitamento materno: fissura, ingurgitamento)"
              disabled={pcRodando || pcConfirmando || pcChamadas >= 1}
              style={{ flex: 1, background: "#0f172a", border: "1px solid #334155", borderRadius: "10px", padding: "9px 14px", color: "#f1f5f9", fontSize: "12px", fontWeight: "600", outline: "none" }}
            />
            {!pcConfirmando ? (
              <button
                onClick={() => setPcConfirmando(true)}
                disabled={pcRodando || pcChamadas >= 1 || !pcTema.trim()}
                style={{
                  background: pcRodando || pcChamadas >= 1 || !pcTema.trim() ? "#1e293b" : "linear-gradient(135deg,#dc2626,#f59e0b)",
                  color: pcRodando || pcChamadas >= 1 || !pcTema.trim() ? "#475569" : "#fff",
                  border: "none", borderRadius: "10px", padding: "9px 16px", fontSize: "12px", fontWeight: "800",
                  cursor: pcRodando || pcChamadas >= 1 || !pcTema.trim() ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap",
                }}
              >
                {pcRodando ? <><FaSpinner style={{ animation: "spin 1s linear infinite" }} size={11} /> Gerando…</> : <><FaPlay size={11} /> Gerar candidata — exatamente 1 chamada</>}
              </button>
            ) : (
              <button
                onClick={() => setPcConfirmando(false)}
                disabled={pcRodando}
                style={{ background: "transparent", border: "1px solid #334155", color: "#64748b", borderRadius: "10px", padding: "9px 16px", fontSize: "12px", fontWeight: "700", cursor: pcRodando ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}
              >
                Editar tema
              </button>
            )}
          </div>
          <p style={{ fontSize: "10px", color: "#64748b", margin: "0 0 10px" }}>
            A candidata não será salva automaticamente.
          </p>

          {pcConfirmando && (
            <div style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: "10px", padding: "10px 12px", marginBottom: "10px" }}>
              <p style={{ fontSize: "11px", color: "#fbbf24", fontWeight: "700", margin: "0 0 10px", lineHeight: 1.6 }}>
                Você está prestes a consumir exatamente 1 chamada de IA no DEV. Não haverá retry, fallback,
                salvamento automático ou resumo automático. A execução produzirá apenas uma candidata local
                para revisão humana. Confirmar execução?
              </p>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={executarPilotoControladoDEV}
                  disabled={pcRodando}
                  style={{ background: pcRodando ? "#1e293b" : "linear-gradient(135deg,#dc2626,#f59e0b)", color: pcRodando ? "#475569" : "#fff", border: "none", borderRadius: "10px", padding: "9px 16px", fontSize: "12px", fontWeight: "800", cursor: pcRodando ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                >
                  {pcRodando ? <><FaSpinner style={{ animation: "spin 1s linear infinite" }} size={11} /> Executando…</> : <>Confirmar execução</>}
                </button>
                <button
                  onClick={() => setPcConfirmando(false)}
                  disabled={pcRodando}
                  style={{ background: "transparent", border: "1px solid #334155", color: "#64748b", borderRadius: "10px", padding: "9px 16px", fontSize: "12px", fontWeight: "700", cursor: pcRodando ? "not-allowed" : "pointer" }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <p style={{ fontSize: "10px", color: "#64748b", margin: "0 0 10px" }}>
            Chamadas de IA usadas nesta rodada: {pcChamadas}/1
          </p>

          {pcErro && (
            <p style={{ fontSize: "11px", color: "#f87171", fontWeight: "700", margin: "0 0 10px" }}>⚠ {pcErro}</p>
          )}

          {pcCandidata && (
            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: "12px", padding: "12px 14px", marginBottom: "10px", fontSize: "11px", lineHeight: 1.6 }}>
              <p style={{ color: "#38bdf8", fontWeight: "800", margin: "0 0 8px" }}>ID previsto: {pcIdPrevisto}</p>

              <p style={{ color: "#94a3b8", margin: "0 0 4px" }}><strong style={{ color: "#f1f5f9" }}>Enunciado:</strong></p>
              <p style={{ color: "#e2e8f0", margin: "0 0 8px", whiteSpace: "pre-wrap" }}>{pcCandidata.enunciado}</p>

              {["a", "b", "c", "d"].map((letra) => (
                <p key={letra} style={{ color: "#e2e8f0", margin: "0 0 4px" }}>
                  <strong style={{ color: pcCandidata.gabarito?.toLowerCase() === letra ? "#34d399" : "#f1f5f9" }}>
                    {letra.toUpperCase()}){pcCandidata.gabarito?.toLowerCase() === letra ? " (GABARITO)" : ""}:
                  </strong> {pcCandidata.alts?.[letra]?.texto}
                </p>
              ))}

              <p style={{ color: "#94a3b8", margin: "8px 0 4px" }}><strong style={{ color: "#f1f5f9" }}>Justificativas:</strong></p>
              {["a", "b", "c", "d"].map((letra) => (
                <p key={`nota-${letra}`} style={{ color: "#94a3b8", margin: "0 0 4px" }}>{letra.toUpperCase()}) {pcCandidata.alts?.[letra]?.nota}</p>
              ))}

              <p style={{ color: "#94a3b8", margin: "8px 0 4px" }}><strong style={{ color: "#f1f5f9" }}>Raciocínio:</strong></p>
              <p style={{ color: "#e2e8f0", margin: "0 0 8px", whiteSpace: "pre-wrap" }}>{pcCandidata.raciocinio}</p>

              <p style={{ color: "#94a3b8", margin: "8px 0 4px" }}><strong style={{ color: "#f1f5f9" }}>Tratamento:</strong></p>
              <p style={{ color: "#e2e8f0", margin: "0 0 8px", whiteSpace: "pre-wrap" }}>{pcCandidata.tto}</p>

              <p style={{ color: "#94a3b8", margin: "8px 0 4px" }}><strong style={{ color: "#f1f5f9" }}>Dica Mestre:</strong></p>
              <p style={{ color: "#e2e8f0", margin: "0 0 8px", whiteSpace: "pre-wrap" }}>{pcCandidata.dicaMestre}</p>

              <p style={{ color: "#94a3b8", margin: "8px 0 4px" }}><strong style={{ color: "#f1f5f9" }}>Nível de aposta:</strong> {pcCandidata.probabilidade_prova || "(não informado pela IA — será resolvido por ciclo posicional ao salvar)"}</p>

              <p style={{ color: "#94a3b8", margin: "8px 0 4px" }}><strong style={{ color: "#f1f5f9" }}>Estratégia da aposta:</strong></p>
              <p style={{ color: "#e2e8f0", margin: "0 0 8px", whiteSpace: "pre-wrap" }}>{pcCandidata.estrategiaAposta || "(não informado)"}</p>

              {pcResultadoBruto?.rejeitadas?.length > 0 && (
                <p style={{ color: "#fbbf24", margin: "8px 0 0" }}>⚠ Avisos do validador (não bloquearam esta candidata): {pcResultadoBruto.rejeitadas.map((r) => r.motivos?.join("; ")).join(" | ")}</p>
              )}
              <p style={{ color: "#64748b", margin: "8px 0 0" }}>Chamadas de IA realizadas: {pcChamadas}/1</p>
            </div>
          )}

          {pcCandidata && !pcSalvo && (
            <div style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: "10px", padding: "10px 12px", marginBottom: "10px" }}>
              <p style={{ fontSize: "11px", color: "#fbbf24", fontWeight: "800", margin: "0 0 8px" }}>
                ⚠ 16 dos 26 critérios de qualidade do padrão premium não possuem garantia estrutural completa —
                revisão humana é obrigatória antes de salvar.
              </p>
              <label style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "11px", color: "#e2e8f0", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={pcRevisaoConfirmada}
                  onChange={(e) => setPcRevisaoConfirmada(e.target.checked)}
                  style={{ marginTop: "2px" }}
                />
                <span>
                  Confirmo revisão humana de: padrão ENAMED/INEP; uma única melhor resposta; cenário clínico
                  verossímil; ausência de cópia literal aparente; distratores plausíveis e da mesma classe;
                  alternativa correta não sistematicamente maior; comando claro com pergunta final presente;
                  justificativas A–D adequadas; raciocínio no padrão PADRÃO → DIFERENCIAL → DECISÃO → ARMADILHA;
                  tratamento correto e atualizado; Dica Mestre adequada; e estratégia da aposta contendo, nesta
                  ordem, porQueApostamos, comoPodeCair e armadilhaProvavel (dentro do campo único estrategiaAposta).
                </span>
              </label>
            </div>
          )}

          {pcErroSalvar && (
            <p style={{ fontSize: "11px", color: "#f87171", fontWeight: "700", margin: "0 0 10px" }}>⚠ {pcErroSalvar}</p>
          )}

          {pcSalvo && (
            <p style={{ fontSize: "11px", color: "#34d399", fontWeight: "800", margin: "0 0 10px" }}>
              ✅ Questão salva no DEV como {pcSalvo.docId}. Nenhum resumo foi gerado automaticamente.
            </p>
          )}

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={salvarCandidataPilotoControladoDEV}
              disabled={!pcCandidata || !pcRevisaoConfirmada || pcSalvando || Boolean(pcSalvo) || pcRodando}
              style={{
                background: (!pcCandidata || !pcRevisaoConfirmada || pcSalvando || pcSalvo || pcRodando) ? "#1e293b" : "linear-gradient(135deg,#059669,#34d399)",
                color: (!pcCandidata || !pcRevisaoConfirmada || pcSalvando || pcSalvo || pcRodando) ? "#475569" : "#fff",
                border: "none", borderRadius: "10px", padding: "9px 16px", fontSize: "12px", fontWeight: "800",
                cursor: (!pcCandidata || !pcRevisaoConfirmada || pcSalvando || pcSalvo || pcRodando) ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", gap: "6px",
              }}
            >
              {pcSalvando ? <><FaSpinner style={{ animation: "spin 1s linear infinite" }} size={11} /> Salvando…</> : <><FaSave size={11} /> Salvar no DEV</>}
            </button>
            <button
              onClick={resetarPilotoControladoDEV}
              disabled={pcRodando || pcSalvando}
              style={{ background: "transparent", border: "1px solid #334155", color: "#64748b", borderRadius: "10px", padding: "9px 16px", fontSize: "12px", fontWeight: "700", cursor: (pcRodando || pcSalvando) ? "not-allowed" : "pointer" }}
            >
              Reiniciar piloto
            </button>
          </div>
        </div>
      ) : (
        <div style={{
          marginBottom: "20px", borderRadius: "16px", padding: "14px 16px",
          background: "rgba(100,116,139,0.06)", border: "1px solid #1e293b",
        }}>
          <p style={{ fontSize: "11px", color: "#64748b", fontWeight: "700", margin: 0 }}>
            ⛔ Homologação Controlada DEV — indisponível (este controle só opera no ambiente DEV, revalidapro-dev).
          </p>
        </div>
      )}

      {/* ── CONFIGURAÇÃO ─────────────────────────────────────────────────── */}
      <div style={st.card}>
        <div style={st.cardTitle}>
          <FaRobot size={16} color="#818cf8" />
          Configuração do Robô
        </div>

        <div style={st.rowDupla}>
          <div>
            <label style={st.label}>Área Médica</label>
            <select style={st.select} value={area} onChange={e => setArea(e.target.value)} disabled={rodando}>
              {SUPER_APOSTAS_CONFIG.areas.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={st.label}>Edição Super Apostas</label>
            <select style={st.select} value={edicao} onChange={e => setEdicao(e.target.value)} disabled={rodando}>
              {SUPER_APOSTAS_CONFIG.edicoes.map(ed => (
                <option key={ed.valor} value={ed.valor}>{ed.label}</option>
              ))}
            </select>
          </div>
        </div>

        <label
          style={{
            display: "flex", alignItems: "center", gap: "8px", marginBottom: "18px",
            padding: "10px 12px", borderRadius: "10px", cursor: rodando ? "default" : "pointer",
            background: formatoABCD ? "rgba(239,68,68,0.08)" : "#0f172a",
            border: `1px solid ${formatoABCD ? "rgba(239,68,68,0.35)" : "#334155"}`,
          }}
        >
          <input
            type="checkbox"
            checked={formatoABCD}
            disabled={rodando}
            onChange={e => setFormatoABCD(e.target.checked)}
          />
          <span style={{ fontSize: "12px", color: formatoABCD ? "#ef4444" : "#94a3b8", fontWeight: "700" }}>
            Formato ABCD — Super Apostas 2026.2 <span style={{ fontWeight: "400", color: "#64748b" }}>
              (4 alternativas, nivel_aposta semântico, estratégia da aposta, protocolo anti-pistas)
            </span>
          </span>
        </label>

        {formatoABCD && (
          <label
            style={{
              display: "flex", alignItems: "center", gap: "8px", marginBottom: "18px",
              padding: "10px 12px", borderRadius: "10px", cursor: rodando ? "default" : "pointer",
              background: modoUmPorRecorte ? "rgba(129,140,248,0.08)" : "#0f172a",
              border: `1px solid ${modoUmPorRecorte ? "rgba(129,140,248,0.35)" : "#334155"}`,
            }}
          >
            <input
              type="checkbox"
              checked={modoUmPorRecorte}
              disabled={rodando}
              onChange={e => setModoUmPorRecorte(e.target.checked)}
            />
            <span style={{ fontSize: "12px", color: modoUmPorRecorte ? "#818cf8" : "#94a3b8", fontWeight: "700" }}>
              Robô normal — gerar 1 questão por recorte <span style={{ fontWeight: "400", color: "#64748b" }}>
                (em vez de 3; use para homologar recortes específicos do Mapa Mestre sem gastar tokens em variações extras)
              </span>
              <br />
              <span style={{ fontWeight: "700", color: "#f59e0b" }}>Não limita o fluxo a uma chamada.</span>
            </span>
          </label>
        )}

        {formatoABCD && modoUmPorRecorte && (
          <div style={{
            marginBottom: "18px", padding: "12px 14px", borderRadius: "10px",
            background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.4)",
          }}>
            <p style={{ fontSize: "12px", color: "#f87171", fontWeight: "800", margin: "0 0 6px" }}>
              ⚠ ATENÇÃO: ESTE NÃO É O PILOTO CONTROLADO.
            </p>
            <p style={{ fontSize: "11px", color: "#e2e8f0", margin: "0 0 6px", lineHeight: 1.6 }}>
              Este modo gera apenas uma questão por recorte, mas ainda pode realizar até 3 chamadas de IA,
              usar fallback para outro modelo, salvar automaticamente a questão e gerar o resumo automático.
            </p>
            <p style={{ fontSize: "11px", color: "#fbbf24", fontWeight: "700", margin: 0 }}>
              Para executar apenas 1 chamada, use o painel "Homologação Controlada DEV" no topo da página.
            </p>
          </div>
        )}

        <div style={st.rowSingle}>
          <label style={st.label}>
            Temas a gerar&nbsp;
            <span style={{ color: "#64748b", textTransform: "none", fontWeight: "400" }}>
              — um por linha · {(formatoABCD && modoUmPorRecorte) ? 1 : QUESTOES_POR_TEMA} questõe{((formatoABCD && modoUmPorRecorte) ? 1 : QUESTOES_POR_TEMA) > 1 ? "s" : ""} cada
            </span>
          </label>
          <textarea
            style={st.textarea}
            value={temas}
            onChange={e => setTemas(e.target.value)}
            placeholder={
              "Pneumonia Adquirida na Comunidade\n" +
              "Insuficiência Cardíaca Descompensada\n" +
              "Diabetes Mellitus tipo 2 — controle glicêmico\n" +
              "Sepse e Choque Séptico\n" +
              "Hipertensão Arterial — urgência e emergência"
            }
            disabled={rodando}
          />
          <p style={st.hint}>
            {listasTemas.length} tema(s) · ~{listasTemas.length * ((formatoABCD && modoUmPorRecorte) ? 1 : QUESTOES_POR_TEMA)} questões ·
            tempo estimado: ~{Math.ceil(listasTemas.length * (DELAY_ENTRE_TEMAS_MS / 60_000))} min
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "20px" }}>
          <span style={st.badge("#818cf8")}><FaClock size={10}/> {DELAY_ENTRE_TEMAS_MS/1000}s pausa entre temas</span>
          <span style={st.badge("#34d399")}><FaFire size={10}/> {(formatoABCD && modoUmPorRecorte) ? 1 : QUESTOES_POR_TEMA} questõe{((formatoABCD && modoUmPorRecorte) ? 1 : QUESTOES_POR_TEMA) > 1 ? "s" : ""}/tema</span>
          <span style={st.badge("#fbbf24")}><FaLayerGroup size={10}/> {formatoABCD ? "3 chamadas máx./recorte" : `${MAX_RETRIES} tentativas máx.`}</span>
          <span style={st.badge("#94a3b8")}>
            {formatoABCD ? "nivel_aposta: classificação da IA (ALTO/MÉDIO/BAIXO)" : "BAIXO → MÉDIO → ALTO"}
          </span>
        </div>

        <div style={st.acoes}>
          {!rodando ? (
            <button
              style={{ ...st.btnIniciar, opacity: listasTemas.length === 0 ? 0.5 : 1 }}
              onClick={iniciarRobo}
              disabled={listasTemas.length === 0}
            >
              <FaPlay size={11} />
              {(formatoABCD && modoUmPorRecorte) ? " Iniciar robô normal — até 3 chamadas + resumo" : " Iniciar Robô"}
            </button>
          ) : (
            <button style={st.btnParar} onClick={pararRobo}>
              <FaStop size={11} /> Parar Robô
            </button>
          )}
          {log.length > 0 && !rodando && (
            <button style={st.btnLimpar} onClick={limparLog}>
              <FaTrash size={10} /> Limpar log
            </button>
          )}
          {!rodando && (
            <button
              style={{
                ...st.btnLimpar,
                color: corrigindo ? "#64748b" : "#f59e0b",
                borderColor: corrigindo ? "#334155" : "rgba(245,158,11,0.4)",
                opacity: corrigindo ? 0.6 : 1,
              }}
              onClick={corrigirMaterias}
              disabled={corrigindo}
              title={`Corrige questões da edição "${edicao}" onde a matéria ficou errada`}
            >
              {corrigindo
                ? <><FaSpinner size={10} style={{ animation: "spin 1s linear infinite" }} /> Corrigindo…</>
                : <><FaDatabase size={10} /> Corrigir matérias</>
              }
            </button>
          )}
        </div>

        {/* Barra de progresso */}
        {progresso.total > 0 && (
          <div style={{ marginTop: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#94a3b8", fontSize: "12px" }}>
                {progresso.atual} / {progresso.total} temas
              </span>
              <span style={{ color: "#818cf8", fontSize: "12px", fontWeight: "700" }}>{pct}%</span>
            </div>
            <div style={st.barraWrap}>
              <div style={st.barraPreen(pct)} />
            </div>
          </div>
        )}

        {/* Countdown */}
        {countdown > 0 && (
          <div style={st.countdown}>
            <FaClock size={13} />
            Próximo tema em: <strong>{countdown}s</strong>
          </div>
        )}
      </div>

      {/* ── LOG DE EXECUÇÃO ──────────────────────────────────────────────── */}
      {log.length > 0 && (
        <div style={st.card}>
          <div style={{ ...st.cardTitle, marginBottom: "12px", justifyContent: "space-between" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <FaInfoCircle size={14} color="#818cf8" />
              Log de execução
            </span>
            {rodando ? (
              <span style={{ color: "#818cf8", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                <FaSpinner size={11} style={{ animation: "spin 1s linear infinite" }} /> Rodando…
              </span>
            ) : progresso.atual > 0 && (
              <span style={{ color: "#34d399", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                <FaCheckCircle size={11} />
                {abortRef.current ? "Interrompido" : "Concluído"}
              </span>
            )}
          </div>
          <div style={st.logWrap}>
            {log.map((entry, i) => (
              <div key={i} style={st.logLinha(entry.tipo)}>
                <span style={{ color: "#334155", marginRight: "8px" }}>[{entry.ts}]</span>
                {entry.msg}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      )}

      {/* ── PAINEL DE TEMAS FALHOS ───────────────────────────────────────── */}
      {temasFalhos.length > 0 && !rodando && (
        <div style={{
          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.35)",
          borderRadius: "16px", padding: "20px 24px", marginBottom: "20px"
        }}>
          <div style={{ ...st.cardTitle, color: "#f87171", marginBottom: "12px" }}>
            <FaExclamationTriangle size={15} color="#f87171" />
            {temasFalhos.length} tema(s) não gerado(s) (bloqueado, revisão humana pendente, ou falhou nas tentativas)
          </div>
          <div style={{
            background: "#0f172a", borderRadius: "10px", padding: "12px 14px",
            marginBottom: "14px", fontFamily: "monospace", fontSize: "12px"
          }}>
            {temasFalhos.map((t, i) => (
              <div key={i} style={{ color: "#f87171", marginBottom: "4px" }}>• {t}</div>
            ))}
          </div>
          <p style={{ ...st.hint, color: "#94a3b8", marginBottom: "14px" }}>
            Esses temas podem ter falhado por instabilidade da API. Clique em "Re-tentar"
            para carregá-los na textarea e rodar novamente.
          </p>
          <button
            style={{
              background: "rgba(239,68,68,0.15)", color: "#f87171",
              border: "1px solid rgba(239,68,68,0.4)", borderRadius: "12px",
              padding: "12px 22px", cursor: "pointer", fontWeight: "700",
              fontSize: "13px", display: "flex", alignItems: "center", gap: "8px"
            }}
            onClick={() => {
              setTemas(temasFalhos.join("\n"));
              setTemasFalhos([]);
              setLog([]);
              setProgresso({ atual: 0, total: 0 });
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            🔄 Re-tentar temas falhos
          </button>
        </div>
      )}

      {/* ── MIGRAÇÃO tema_mestre ─────────────────────────────────────────── */}
      <div style={{
        background: migAberto ? "rgba(16,185,129,0.04)" : "transparent",
        border: `1px solid ${migAberto ? "rgba(16,185,129,0.25)" : "#1e293b"}`,
        borderRadius: "16px", marginBottom: "20px", overflow: "hidden",
        transition: "all 0.2s"
      }}>
        <button
          onClick={() => setMigAberto(v => !v)}
          style={{
            width: "100%", background: "none", border: "none", cursor: "pointer",
            padding: "16px 20px", display: "flex", alignItems: "center",
            justifyContent: "space-between", gap: "12px"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <FaDatabase color="#34d399" size={14} />
            <span style={{ color: "#34d399", fontWeight: "800", fontSize: "14px" }}>
              Migração tema_mestre
            </span>
            <span style={{
              background: "rgba(16,185,129,0.12)", color: "#34d399",
              border: "1px solid rgba(16,185,129,0.3)", borderRadius: "6px",
              fontSize: "10px", fontWeight: "700", padding: "2px 8px"
            }}>BANCO</span>
          </div>
          <span style={{ color: "#475569", fontSize: "18px", lineHeight: 1 }}>
            {migAberto ? "▲" : "▼"}
          </span>
        </button>

        {migAberto && (
          <div style={{ padding: "0 20px 20px" }}>
            <p style={{ color: "#64748b", fontSize: "12px", marginBottom: "16px", lineHeight: 1.6 }}>
              Classifica o <strong style={{ color: "#94a3b8" }}>tema_mestre</strong> de questões sem esse campo
              (ou com valor fragmentado). Funciona em <strong style={{ color: "#94a3b8" }}>dois passos</strong>:
              primeiro faça o <em>scan</em>, depois clique <em>"Rodar lote"</em> — você controla o ritmo.
              Todos os docs do lote saem com tema_mestre válido (com fallback automático se a IA falhar).
            </p>

            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px", flexWrap: "wrap" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ color: "#64748b", fontSize: "10px", fontWeight: "700", letterSpacing: "0.5px" }}>
                  DOCS POR LOTE
                </span>
                <select
                  value={migTamLote}
                  onChange={e => setMigTamLote(Number(e.target.value))}
                  disabled={migrando || escaneando}
                  style={{
                    background: "#0f172a", border: "1px solid #334155", color: "#94a3b8",
                    borderRadius: "8px", padding: "6px 10px", fontSize: "12px", fontWeight: "700",
                    cursor: "pointer"
                  }}
                >
                  <option value={10}>10 docs</option>
                  <option value={20}>20 docs</option>
                  <option value={50}>50 docs</option>
                </select>
              </div>

              <button
                onClick={escanearBase}
                disabled={escaneando || migrando || rodando}
                style={{
                  padding: "8px 16px", borderRadius: "10px", fontSize: "12px", fontWeight: "700",
                  cursor: escaneando || migrando || rodando ? "not-allowed" : "pointer",
                  background: escaneando ? "#1e293b" : "rgba(129,140,248,0.12)",
                  border: "1px solid rgba(129,140,248,0.3)", color: escaneando ? "#475569" : "#818cf8",
                  display: "flex", alignItems: "center", gap: "7px", marginTop: "18px"
                }}
              >
                {escaneando
                  ? <><FaSpinner style={{ animation: "spin 1s linear infinite" }} size={11} /> Escaneando…</>
                  : <><FaSearch size={11} /> {migEscaneado ? "Re-escanear base" : "Escanear base"}</>}
              </button>
            </div>

            {migEscaneado && (
              <div style={{
                background: migPendentes.length === 0 ? "rgba(16,185,129,0.06)" : "rgba(251,191,36,0.06)",
                border: `1px solid ${migPendentes.length === 0 ? "rgba(16,185,129,0.25)" : "rgba(251,191,36,0.25)"}`,
                borderRadius: "12px", padding: "12px 16px", marginBottom: "14px",
                display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px"
              }}>
                <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ color: "#64748b", fontSize: "10px", fontWeight: "700", letterSpacing: "0.5px" }}>PENDENTES</div>
                    <div style={{ color: migPendentes.length === 0 ? "#34d399" : "#fbbf24", fontSize: "20px", fontWeight: "900", lineHeight: 1.2 }}>
                      {migPendentes.length}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: "#64748b", fontSize: "10px", fontWeight: "700", letterSpacing: "0.5px" }}>PROCESSADOS</div>
                    <div style={{ color: "#34d399", fontSize: "20px", fontWeight: "900", lineHeight: 1.2 }}>
                      {migProcessados}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: "#64748b", fontSize: "10px", fontWeight: "700", letterSpacing: "0.5px" }}>LOTES RESTANTES</div>
                    <div style={{ color: "#94a3b8", fontSize: "20px", fontWeight: "900", lineHeight: 1.2 }}>
                      {Math.ceil(migPendentes.length / migTamLote) || 0}
                    </div>
                  </div>
                </div>
                {migProgresso.total > 0 && (
                  <div style={{ flex: 1, minWidth: "120px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span style={{ color: "#475569", fontSize: "10px" }}>
                        {migProcessados} / {migProgresso.total}
                      </span>
                      <span style={{ color: "#34d399", fontSize: "10px", fontWeight: "800" }}>
                        {migProgresso.total > 0 ? Math.round((migProcessados / migProgresso.total) * 100) : 0}%
                      </span>
                    </div>
                    <div style={{ background: "#1e293b", borderRadius: "100px", height: "5px" }}>
                      <div style={{
                        width: `${migProgresso.total > 0 ? Math.round((migProcessados / migProgresso.total) * 100) : 0}%`,
                        background: "linear-gradient(90deg, #34d399, #10b981)",
                        height: "100%", borderRadius: "100px", transition: "width 0.4s"
                      }} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {migLog.length > 0 && (
              <div style={{
                background: "#0f172a", border: "1px solid #1e293b",
                borderRadius: "12px", padding: "14px", maxHeight: "200px",
                overflowY: "auto", fontFamily: "monospace", fontSize: "11px", marginBottom: "14px"
              }}>
                {migLog.map((e, i) => {
                  const cores = { ok: "#34d399", erro: "#f87171", aviso: "#fbbf24", sistema: "#818cf8", info: "#94a3b8", detalhe: "#475569" };
                  return (
                    <div key={i} style={{ color: cores[e.tipo] || "#94a3b8", marginBottom: "4px", lineHeight: 1.6 }}>
                      <span style={{ color: "#334155", marginRight: "8px" }}>[{e.ts}]</span>{e.msg}
                    </div>
                  );
                })}
                <div ref={migLogRef} />
              </div>
            )}

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={rodarLote}
                disabled={migrando || rodando || !migEscaneado || migPendentes.length === 0}
                title={!migEscaneado ? "Faça o scan primeiro" : migPendentes.length === 0 ? "Nenhum pendente" : `Processar os próximos ${migTamLote} documentos`}
                style={{
                  flex: 1, padding: "12px", borderRadius: "12px",
                  cursor: (migrando || rodando || !migEscaneado || migPendentes.length === 0) ? "not-allowed" : "pointer",
                  background: (migrando || !migEscaneado || migPendentes.length === 0)
                    ? "#1e293b"
                    : "linear-gradient(135deg, #34d399, #10b981)",
                  border: "none",
                  color: (migrando || !migEscaneado || migPendentes.length === 0) ? "#475569" : "#fff",
                  fontWeight: "800", fontSize: "13px",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                  transition: "opacity 0.2s"
                }}
              >
                {migrando
                  ? <><FaSpinner style={{ animation: "spin 1s linear infinite" }} size={12} /> Processando lote…</>
                  : migPendentes.length === 0 && migEscaneado
                  ? <><FaCheckCircle size={12} /> Fila concluída</>
                  : <><FaDatabase size={12} /> Rodar lote ({migTamLote} docs)</>}
              </button>

              {migrando && (
                <button
                  onClick={() => { migAbortRef.current = true; }}
                  style={{
                    padding: "12px 18px", borderRadius: "12px", cursor: "pointer",
                    background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.35)",
                    color: "#f87171", fontWeight: "700", fontSize: "13px",
                    display: "flex", alignItems: "center", gap: "6px"
                  }}
                >
                  <FaStop size={11} /> Parar
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* RESUMO POR TEMA */}
      <div style={{
        marginTop: "20px", borderRadius: "16px", overflow: "hidden",
        background: resAberto ? "rgba(79,70,229,0.04)" : "transparent",
        border: `1px solid ${resAberto ? "rgba(79,70,229,0.25)" : "#1e293b"}`,
        transition: "all 0.2s",
      }}>
        <button
          onClick={() => setResAberto(v => !v)}
          style={{
            width: "100%", background: "transparent", border: "none",
            color: "#f1f5f9", display: "flex", alignItems: "center",
            justifyContent: "space-between", padding: "14px 16px",
            cursor: "pointer", fontSize: "13px", fontWeight: "800",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <FaBookOpen size={13} color="#818cf8" />
            Resumo por Tema
            {resExistente && <span style={{ fontSize: "10px", background: "rgba(16,185,129,0.15)", color: "#34d399", borderRadius: "6px", padding: "2px 8px", fontWeight: "700" }}>SALVO</span>}
          </span>
          {resAberto ? "▲" : "▼"}
        </button>

        {resAberto && (
          <div style={{ padding: "0 16px 16px" }}>
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
              <input
                type="text"
                value={resTema}
                onChange={e => { setResTema(e.target.value); setResPreview(null); setResExistente(null); setResLog(""); }}
                onBlur={() => buscarResumoExistente(resTema)}
                placeholder="Ex: Hipertensão arterial sistêmica"
                style={{
                  flex: 1, background: "#0f172a", border: "1px solid #334155",
                  borderRadius: "10px", padding: "9px 14px", color: "#f1f5f9",
                  fontSize: "13px", fontWeight: "600", outline: "none",
                }}
              />
              <button
                onClick={gerarResumo}
                disabled={resGerando || rodando || !resTema.trim()}
                style={{
                  background: resGerando || !resTema.trim() ? "#1e293b" : "linear-gradient(135deg,#4f46e5,#7c3aed)",
                  color: resGerando || !resTema.trim() ? "#475569" : "#fff",
                  border: "none", borderRadius: "10px", padding: "9px 16px",
                  fontSize: "12px", fontWeight: "800", cursor: resGerando || !resTema.trim() ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap",
                }}
              >
                {resGerando
                  ? <><FaSpinner style={{ animation: "spin 1s linear infinite" }} size={11} /> Gerando…</>
                  : resExistente
                  ? <><FaSync size={11} /> Regenerar</>
                  : <><FaRobot size={11} /> Gerar Resumo</>}
              </button>
            </div>

            {resLog && (
              <p style={{ fontSize: "11px", color: resLog.startsWith("✅") ? "#34d399" : resLog.startsWith("❌") ? "#f87171" : "#94a3b8", margin: "0 0 10px", fontWeight: "700" }}>
                {resLog}
              </p>
            )}

            {resPreview && !resEditando && (
              <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: "14px", padding: "16px", marginBottom: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
                  <h4 style={{ color: "#818cf8", fontSize: "12px", fontWeight: "900", letterSpacing: "0.5px", margin: 0, textTransform: "uppercase" }}>
                    <FaEye size={10} style={{ marginRight: 6 }} />{resTema}
                  </h4>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      onClick={() => { setResEditando(true); setResEdit({ ...resPreview, pontos_chave: [...(resPreview.pontos_chave||[])], pegadinhas: [...(resPreview.pegadinhas||[])] }); }}
                      style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)", color: "#fbbf24", borderRadius: "8px", padding: "5px 12px", fontSize: "11px", fontWeight: "800", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}
                    >
                      <FaEdit size={10} /> Editar
                    </button>
                    <button
                      onClick={() => salvarResumo(resPreview)}
                      style={{ background: resSalvo ? "rgba(16,185,129,0.2)" : "rgba(79,70,229,0.15)", border: `1px solid ${resSalvo ? "rgba(16,185,129,0.4)" : "rgba(79,70,229,0.4)"}`, color: resSalvo ? "#34d399" : "#818cf8", borderRadius: "8px", padding: "5px 12px", fontSize: "11px", fontWeight: "800", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}
                    >
                      <FaSave size={10} /> {resSalvo ? "Salvo!" : "Salvar"}
                    </button>
                  </div>
                </div>

                {[
                  { key: "definicao",   label: "Definição",    color: "#818cf8" },
                  { key: "diagnostico", label: "Diagnóstico",  color: "#34d399" },
                  { key: "tratamento",  label: "Tratamento",   color: "#60a5fa" },
                ].map(({ key, label, color }) => (
                  <div key={key} style={{ marginBottom: "10px" }}>
                    <span style={{ fontSize: "10px", fontWeight: "900", color, letterSpacing: "0.5px", display: "block", marginBottom: "4px", textTransform: "uppercase" }}>{label}</span>
                    <p style={{ fontSize: "12px", color: "#cbd5e1", margin: 0, lineHeight: 1.6 }}>{resPreview[key]}</p>
                  </div>
                ))}

                {resPreview.pontos_chave?.length > 0 && (
                  <div style={{ marginBottom: "10px" }}>
                    <span style={{ fontSize: "10px", fontWeight: "900", color: "#f59e0b", letterSpacing: "0.5px", display: "block", marginBottom: "6px", textTransform: "uppercase" }}>Pontos-chave</span>
                    {resPreview.pontos_chave.map((p, i) => (
                      <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "4px" }}>
                        <span style={{ color: "#f59e0b", fontSize: "11px", fontWeight: "900", flexShrink: 0 }}>{i + 1}.</span>
                        <span style={{ fontSize: "12px", color: "#cbd5e1", lineHeight: 1.5 }}>{p}</span>
                      </div>
                    ))}
                  </div>
                )}

                {resPreview.pegadinhas?.length > 0 && (
                  <div style={{ marginBottom: "10px" }}>
                    <span style={{ fontSize: "10px", fontWeight: "900", color: "#ef4444", letterSpacing: "0.5px", display: "block", marginBottom: "6px", textTransform: "uppercase" }}>⚠ Pegadinhas de prova</span>
                    {resPreview.pegadinhas.map((p, i) => (
                      <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "4px" }}>
                        <span style={{ color: "#ef4444", fontSize: "11px", flexShrink: 0 }}>✗</span>
                        <span style={{ fontSize: "12px", color: "#fca5a5", lineHeight: 1.5 }}>{p}</span>
                      </div>
                    ))}
                  </div>
                )}

                {resPreview.dica_mestre && (
                  <div style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: "10px", padding: "10px 14px" }}>
                    <span style={{ fontSize: "10px", fontWeight: "900", color: "#fbbf24", letterSpacing: "0.5px", display: "block", marginBottom: "4px", textTransform: "uppercase" }}>⭐ Dica do Mestre</span>
                    <p style={{ fontSize: "12px", color: "#fef3c7", margin: 0, lineHeight: 1.6, fontStyle: "italic" }}>{resPreview.dica_mestre}</p>
                  </div>
                )}
              </div>
            )}

            {resEditando && (
              <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "14px", padding: "16px", marginBottom: "12px" }}>
                <h4 style={{ color: "#fbbf24", fontSize: "12px", fontWeight: "900", margin: "0 0 14px", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "6px" }}>
                  <FaEdit size={10} /> Editando: {resTema}
                </h4>

                {[
                  { key: "definicao",   label: "Definição",   rows: 3 },
                  { key: "diagnostico", label: "Diagnóstico", rows: 3 },
                  { key: "tratamento",  label: "Tratamento",  rows: 4 },
                  { key: "dica_mestre", label: "Dica do Mestre", rows: 2 },
                ].map(({ key, label, rows }) => (
                  <div key={key} style={{ marginBottom: "12px" }}>
                    <label style={{ fontSize: "10px", fontWeight: "900", color: "#94a3b8", letterSpacing: "0.5px", display: "block", marginBottom: "4px", textTransform: "uppercase" }}>{label}</label>
                    <textarea
                      value={resEdit[key]}
                      onChange={e => setResEdit(prev => ({ ...prev, [key]: e.target.value }))}
                      rows={rows}
                      style={{ width: "100%", background: "#1e293b", border: "1px solid #334155", borderRadius: "8px", padding: "8px 12px", color: "#f1f5f9", fontSize: "12px", lineHeight: 1.6, resize: "vertical", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                ))}

                {["pontos_chave", "pegadinhas"].map(key => (
                  <div key={key} style={{ marginBottom: "12px" }}>
                    <label style={{ fontSize: "10px", fontWeight: "900", color: "#94a3b8", letterSpacing: "0.5px", display: "block", marginBottom: "4px", textTransform: "uppercase" }}>
                      {key === "pontos_chave" ? "Pontos-chave (1 por linha)" : "Pegadinhas (1 por linha)"}
                    </label>
                    <textarea
                      value={(resEdit[key] || []).join("\n")}
                      onChange={e => setResEdit(prev => ({ ...prev, [key]: e.target.value.split("\n").filter(l => l.trim()) }))}
                      rows={5}
                      style={{ width: "100%", background: "#1e293b", border: "1px solid #334155", borderRadius: "8px", padding: "8px 12px", color: "#f1f5f9", fontSize: "12px", lineHeight: 1.8, resize: "vertical", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                ))}

                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => salvarResumo(resEdit)}
                    style={{ flex: 1, background: "linear-gradient(135deg,#4f46e5,#7c3aed)", color: "#fff", border: "none", borderRadius: "10px", padding: "10px", fontSize: "12px", fontWeight: "800", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                  >
                    <FaSave size={11} /> Salvar Resumo
                  </button>
                  <button
                    onClick={() => { setResEditando(false); }}
                    style={{ background: "transparent", border: "1px solid #334155", color: "#64748b", borderRadius: "10px", padding: "10px 16px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── REGENERAÇÃO ISOLADA DE RESUMO (DEV-only) ─────────────────────── */}
      {ambienteDevAutorizado(FIREBASE_PROJECT_ID) ? (
        <div style={{
          marginTop: "20px", borderRadius: "16px", overflow: "hidden",
          background: "rgba(56,189,248,0.04)",
          border: "1px solid rgba(56,189,248,0.25)",
          padding: "16px",
        }}>
          <h4 style={{ display: "flex", alignItems: "center", gap: "8px", color: "#f1f5f9", fontSize: "13px", fontWeight: "800", margin: "0 0 12px" }}>
            <FaSync size={13} color="#38bdf8" /> Regenerar Somente o Resumo (DEV)
          </h4>
          <p style={{ fontSize: "11px", color: "#94a3b8", margin: "0 0 12px", lineHeight: 1.6 }}>
            Esta ação regenera <strong>somente o resumo</strong> de uma questão Super Apostas já existente. <strong>A questão não será regenerada.</strong>
          </p>

          <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
            <input
              type="text"
              value={riDocId}
              onChange={(e) => { setRiDocId(e.target.value); setRiQuestao(null); setRiErroBusca(""); setRiResultado(null); setRiConfirmando(false); }}
              placeholder="ID do documento em 'questoes' (ex.: SA_<edição>_Q<n>)"
              disabled={riBuscando || riExecutando}
              style={{ flex: 1, background: "#0f172a", border: "1px solid #334155", borderRadius: "10px", padding: "9px 14px", color: "#f1f5f9", fontSize: "12px", fontWeight: "600", outline: "none" }}
            />
            <button
              onClick={buscarQuestaoParaResumoIsolado}
              disabled={riBuscando || riExecutando || !riDocId.trim()}
              style={{
                background: riBuscando || riExecutando || !riDocId.trim() ? "#1e293b" : "linear-gradient(135deg,#0284c7,#38bdf8)",
                color: riBuscando || riExecutando || !riDocId.trim() ? "#475569" : "#fff",
                border: "none", borderRadius: "10px", padding: "9px 16px", fontSize: "12px", fontWeight: "800",
                cursor: riBuscando || riExecutando || !riDocId.trim() ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap",
              }}
            >
              {riBuscando ? <><FaSpinner style={{ animation: "spin 1s linear infinite" }} size={11} /> Buscando…</> : <><FaSearch size={11} /> Carregar questão</>}
            </button>
          </div>

          {riErroBusca && (
            <p style={{ fontSize: "11px", color: "#f87171", fontWeight: "700", margin: "0 0 10px" }}>⚠ {riErroBusca}</p>
          )}

          {riQuestao && (
            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: "12px", padding: "12px 14px", marginBottom: "10px" }}>
              <p style={{ fontSize: "11px", color: "#94a3b8", margin: "0 0 4px" }}>
                <strong style={{ color: "#f1f5f9" }}>ID:</strong> {riQuestao.id}
              </p>
              <p style={{ fontSize: "11px", color: "#94a3b8", margin: 0 }}>
                <strong style={{ color: "#f1f5f9" }}>Tema:</strong> {riQuestao.tema_mestre || "(sem tema_mestre)"}
              </p>

              {!riConfirmando ? (
                <button
                  onClick={() => setRiConfirmando(true)}
                  disabled={riExecutando}
                  style={{ marginTop: "10px", background: riExecutando ? "#1e293b" : "linear-gradient(135deg,#0284c7,#38bdf8)", color: riExecutando ? "#475569" : "#fff", border: "none", borderRadius: "10px", padding: "9px 16px", fontSize: "12px", fontWeight: "800", cursor: riExecutando ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                >
                  <FaSync size={11} /> Regenerar somente o resumo
                </button>
              ) : (
                <div style={{ marginTop: "10px", background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: "10px", padding: "10px 12px" }}>
                  <p style={{ fontSize: "11px", color: "#fbbf24", fontWeight: "700", margin: "0 0 10px" }}>
                    Confirma? Esta ação regenera somente o resumo. A questão não será regenerada.
                  </p>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={executarRegeneracaoResumoIsolado}
                      disabled={riExecutando}
                      style={{ background: riExecutando ? "#1e293b" : "linear-gradient(135deg,#dc2626,#f59e0b)", color: riExecutando ? "#475569" : "#fff", border: "none", borderRadius: "10px", padding: "9px 16px", fontSize: "12px", fontWeight: "800", cursor: riExecutando ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                    >
                      {riExecutando ? <><FaSpinner style={{ animation: "spin 1s linear infinite" }} size={11} /> Executando…</> : <>Confirmar e executar</>}
                    </button>
                    <button
                      onClick={() => setRiConfirmando(false)}
                      disabled={riExecutando}
                      style={{ background: "transparent", border: "1px solid #334155", color: "#64748b", borderRadius: "10px", padding: "9px 16px", fontSize: "12px", fontWeight: "700", cursor: riExecutando ? "not-allowed" : "pointer" }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {riResultado && (
            <div style={{
              background: "#0f172a", border: "1px solid #1e293b", borderRadius: "12px", padding: "12px 14px",
              fontSize: "11px", lineHeight: 1.6,
            }}>
              {riResultado.bucket === "aprovado" && (
                <p style={{ color: "#34d399", fontWeight: "700", margin: 0 }}>✅ Aprovado e salvo — {riResultado.blocos ?? "?"} bloco(s), {riResultado.tentativas ?? 1} tentativa(s).</p>
              )}
              {riResultado.bucket === "rejeitado_sem_persistencia" && (
                <>
                  <p style={{ color: "#fbbf24", fontWeight: "700", margin: "0 0 6px" }}>⚠ Rejeitado sem persistência — nada foi salvo.</p>
                  {Array.isArray(riResultado.problemas) && riResultado.problemas.length > 0 && (
                    <p style={{ color: "#94a3b8", margin: 0 }}>{riResultado.problemas.join(" | ")}</p>
                  )}
                </>
              )}
              {riResultado.bucket === "erro_operacional" && (
                <p style={{ color: "#f87171", fontWeight: "700", margin: 0 }}>❌ Erro operacional — {riResultado.erro || "erro desconhecido"}.</p>
              )}
              {riResultado.bucket === "bloqueado_ambiente" && (
                <p style={{ color: "#f87171", fontWeight: "700", margin: 0 }}>⛔ Bloqueado — este controle só opera no ambiente DEV (revalidapro-dev).</p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div style={{
          marginTop: "20px", borderRadius: "16px", padding: "14px 16px",
          background: "rgba(100,116,139,0.06)", border: "1px solid #1e293b",
        }}>
          <p style={{ fontSize: "11px", color: "#64748b", fontWeight: "700", margin: 0 }}>
            ⛔ Regenerar Somente o Resumo — indisponível (este controle só opera no ambiente DEV, revalidapro-dev).
          </p>
        </div>
      )}

    </div>
  );
}

export default RoboGerador;
