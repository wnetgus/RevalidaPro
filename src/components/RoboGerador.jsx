import React, { useState, useRef, useCallback, useEffect } from "react";
import { db } from "../firebase";
import {
  doc, setDoc, getDocs, collection, query, where,
  serverTimestamp, writeBatch
} from "firebase/firestore";
import {
  FaRobot, FaPlay, FaStop, FaSpinner, FaCheckCircle,
  FaExclamationTriangle, FaInfoCircle, FaClock, FaFire,
  FaLayerGroup, FaTrash, FaDatabase, FaSearch
} from "react-icons/fa";
import { SUPER_APOSTAS_CONFIG } from "../config/superApostasConfig";

// ─── CONSTANTES DE TEMPORIZAÇÃO ────────────────────────────────────────────────
// 90s entre temas: buffer para a Cloud Function (timeout 180s) e evitar
// rate-limit da Anthropic. Reduzir apenas se a conta tiver cota mais alta.
const DELAY_ENTRE_TEMAS_MS  = 20_000;  // 20 segundos — seguro no Tier 1 pago (50 RPM Haiku)
const DELAY_RETRY_MS        = 45_000;  // 45 segundos antes da retentativa (buffer extra para temas densos)
const MAX_RETRIES           = 3;       // tentativas por tema: 1 original + 2 retries
const QUESTOES_POR_TEMA     = 3;       // questões geradas por tema

// ─── HELPERS (mesma lógica do ImportadorPro) ──────────────────────────────────
const CICLO_NIVEIS_SA = ["BAIXO", "MEDIO", "ALTO"];

const atribuirNivelAposta = (indexQuestao, totalQuestoes) => {
  if (totalQuestoes <= 3) return CICLO_NIVEIS_SA[(3 - totalQuestoes) + indexQuestao];
  return CICLO_NIVEIS_SA[indexQuestao % 3];
};

const calcularStatusAtualizacao = (ano_diretriz) => {
  if (!ano_diretriz || typeof ano_diretriz !== "number") return "revisar";
  return ano_diretriz >= 2024 ? "atual" : "revisar";
};

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

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

// ─── EXTRAÇÃO ROBUSTA DE JSON (idêntica ao ImportadorPro) ────────────────────
const extrairJSONDoTexto = (str) => {
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
    if (escapeNext)        { escapeNext = false; continue; }
    if (c === "\\")        { escapeNext = true;  continue; }
    if (c === '"')         { emString = !emString; continue; }
    if (emString)          continue;
    if (c === abridor)     profundidade++;
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

// ─── PROMPT DO SISTEMA ───────────────────────────────────────────────────────
// IMPORTANTE: os limites de tamanho abaixo são OBRIGATÓRIOS para caber em
// max_tokens: 8192. Sem eles, 3 questões completas ultrapassam o limite e o
// JSON fica truncado (erro "JSON não encontrado").
const PROMPT_SISTEMA = `Você é um gerador premium de questões médicas para o Revalida INEP.
Responda SOMENTE com um array JSON. Nenhum texto antes. Nenhum texto depois. Sem markdown. Sem explicações.
Sua resposta deve começar com [ e terminar com ].

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
- Mistura das duas abordagens — sempre priorizando o mais cobrado em prova.

═══ PADRÃO PREMIUM DE QUALIDADE ═══
- Casos clínicos realistas: inclua idade, sexo, sintomas, exames e contexto (UBS, UPA, emergência, enfermaria).
- Distratores plausíveis: pegadinhas clássicas de prova, não alternativas obviamente erradas.
- Teste tomada de decisão clínica, não memorização decorativa.
- Explore armadilhas clássicas do Revalida (conduta correta vs. conduta comum mas errada).
- Evite perguntas óbvias ou superficiais — nível mínimo: questão de residência.

═══ DIRETRIZES ATUALIZADAS ═══
- Use diretrizes recentes (MS, SUS, PCDT, FEBRASGO, CFM, SBC, SBPT, SBEM — preferencialmente 2023-2025).
- Se a conduta for de diretriz anterior a 2023, indique no "raciocinio": "Conforme diretriz de [ANO]...".
- Condutas de APS devem refletir os Cadernos de Atenção Primária vigentes.

═══ LIMITES DE TAMANHO OBRIGATÓRIOS ═══
- enunciado: máximo 180 palavras
- alts[x].texto: máximo 20 palavras por alternativa
- alts[x].nota: máximo 45 palavras por justificativa
- raciocinio: máximo 80 palavras
- tto: máximo 100 palavras
- dicaMestre: máximo 35 palavras
Seja técnico e conciso. Não use frases introdutórias.

Estrutura de cada questão no array:
{"materia":"string","tema_mestre":"string","subtema":"string","banca":"Revalida INEP","ano":"2025","numeroQuestao":1,"enunciado":"caso clínico com dados reais","imagemUrl":"","alts":{"a":{"texto":"","nota":""},"b":{"texto":"","nota":""},"c":{"texto":"","nota":""},"d":{"texto":"","nota":""},"e":{"texto":"","nota":""}},"gabarito":"letra_correta","raciocinio":"fisiopatologia objetivo","tto":"conduta atualizada","dicaMestre":"regra de ouro","ano_diretriz":2024,"fonte_diretriz":"MS/SUS 2024"}

Regras:
- tema_mestre: OBRIGATÓRIO. Nome clínico padronizado da doença ou condição principal.
  ✅ CORRETO: "Asma", "Hipertensão arterial sistêmica", "Diabetes mellitus tipo 2", "Insuficiência cardíaca"
  ❌ ERRADO — contexto no tema: "Diabetes em gestante", "Asma pediátrica", "HAS no idoso"
  ❌ ERRADO — subtema no tema: "Asma — crise aguda", "Diabetes — tratamento", "HAS — classificação"
  ❌ ERRADO — abreviação: "HAS", "DM2", "IC", "IAM"
  ❌ ERRADO — variação de caixa: sempre minúsculas exceto a primeira letra de nomes próprios
  REGRA: tema_mestre é o NOME DA DOENÇA, sem contexto clínico e sem subtema. Derive do conteúdo gerado, NÃO do prompt.
- gabarito: apenas a letra (a, b, c, d ou e)
- enunciado: dados clínicos reais (idade, sintomas, exames, contexto APS/UBS/hospital)
- ano_diretriz: número inteiro do ano da diretriz (ex: 2024). Obrigatório.
- fonte_diretriz: fonte da diretriz (ex: "MS/SUS 2024", "SBC 2025"). Obrigatório.
- JAMAIS ultrapasse os limites de tamanho definidos acima.
- Responda APENAS com o array JSON, começando em [ e terminando em ]`;

// ─── PROMPT DE MIGRAÇÃO tema_mestre ────────────────────────────────────────
// Sistema separado: classifica subtemas existentes sem gerar questões.
const PROMPT_MIGRACAO = `Você é um classificador clínico de subtemas médicos para padronização de banco de questões.
Responda SOMENTE com um array JSON. Nenhum texto antes. Nenhum texto depois. Sem markdown.
Sua resposta deve começar com [ e terminar com ].

OBJETIVO: Extrair o tema_mestre de cada subtema fornecido. O tema_mestre é o NOME DA DOENÇA principal, isolado, sem contexto e sem detalhe de subtema.

REGRAS OBRIGATÓRIAS:
1. Nome clínico completo e padronizado:
   ✅ "Hipertensão arterial sistêmica" | "Infarto agudo do miocárdio" | "Diabetes mellitus tipo 2" | "Asma" | "Insuficiência cardíaca"
2. NUNCA inclua contexto clínico no tema_mestre:
   ❌ "Diabetes em gestante" → ✅ "Diabetes mellitus" (contexto pertence ao subtema)
   ❌ "Asma pediátrica" → ✅ "Asma" (faixa etária pertence ao subtema)
   ❌ "HAS no idoso" → ✅ "Hipertensão arterial sistêmica"
3. NUNCA inclua subtema no tema_mestre:
   ❌ "Asma — crise aguda" → ✅ "Asma"
   ❌ "Diabetes mellitus — complicações" → ✅ "Diabetes mellitus tipo 2"
4. NUNCA use abreviações:
   ❌ "HAS" → ✅ "Hipertensão arterial sistêmica"
   ❌ "DM2" → ✅ "Diabetes mellitus tipo 2"
   ❌ "IAM" → ✅ "Infarto agudo do miocárdio"
5. Capitalização: primeira letra maiúscula, resto minúsculo (exceto nomes próprios de síndromes).
6. Múltiplas doenças → escolher a claramente dominante no subtema.
7. Sem clareza → usar "INDEFINIDO".
8. NUNCA inventar temas além do que está explícito no subtema fornecido.

Formato de saída OBRIGATÓRIO (array, mesmo que seja 1 item):
[{"id":"id_do_documento","tema_mestre":"Nome Clínico"}]`;

const LOTE_MIGRACAO   = 20;  // subtemas por chamada à IA
const DELAY_MIGRACAO  = 4000; // ms entre lotes (evita rate limit)

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

  const abortRef      = useRef(false);
  const countdownRef  = useRef(null);  // guarda o resolve() atual para resolver externamente
  const logEndRef     = useRef(null);  // âncora para auto-scroll do log

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
  const chamarIA = useCallback(async (promptUsuario) => {
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
    return parsed;
  }, []);

  // ── Salva questões de um tema no Firestore ────────────────────────────────
  // FIX BUG #5: area recebe o valor via parâmetro — não depende de closure stale
  const salvarQuestoes = useCallback(async (lista, edicaoSA, proximoNum, areaAtual) => {
    const anoAtual = String(new Date().getFullYear());
    const idBase   = `SA_${edicaoSA}`;

    for (let i = 0; i < lista.length; i++) {
      const q     = lista[i];
      const numQ  = proximoNum + i;
      const docId = `${idBase}_Q${numQ}`;

      const finalData = {
        // FIX: sempre usa a área selecionada pelo usuário (ex: "Cirurgia").
        // q.materia da IA é IGNORADO — ela devolve strings livres que não
        // coincidem com os valores do filtro em SuperApostas.
        materia:     areaAtual,
        tema_mestre: q.tema_mestre  || "",  // doença/condição principal gerada pela IA
        subtema:     q.subtema      || q.materia || "",  // subtema guarda o texto detalhado da IA
        banca:       "Revalida INEP",
        ano:         q.ano          || anoAtual,
        enunciado:   q.enunciado    || "",
        imagemUrl:   q.imagemUrl    || "",
        gabarito:    q.gabarito     || "",
        raciocinio:  q.raciocinio   || "",
        tto:         q.tto          || "",
        dicaMestre:  q.dicaMestre   || "",
        ano_diretriz:   q.ano_diretriz   || null,
        fonte_diretriz: q.fonte_diretriz || "",

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

        numeroQuestao:      numQ,
        status_atualizacao: calcularStatusAtualizacao(q.ano_diretriz),
        nivel_aposta:       atribuirNivelAposta(i, lista.length),

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
    }
  }, []);

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
    const areaAtual  = area;
    const edicaoAtual = edicao;

    abortRef.current = false;
    setRodando(true);
    setLog([]);
    setTemasFalhos([]);
    setProgresso({ atual: 0, total: listasTemas.length });

    addLog(`🤖 Robô iniciado — ${listasTemas.length} tema(s) | Edição: ${edicaoAtual} | Área: ${areaAtual}`, "sistema");
    addLog(`⚙️  ${QUESTOES_POR_TEMA} questões/tema · ${DELAY_ENTRE_TEMAS_MS/1000}s entre temas · ${MAX_RETRIES} tentativas máx.`, "sistema");

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

      // ── Retry loop ─────────────────────────────────────────────────────
      let sucesso   = false;
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

          // Detecta se o tema tem detalhamento explícito (parênteses, vírgulas, hífens com subtemas)
          const temDetalhamento = /[(),;]|—|-{1,2}|\b(incluindo|especialmente|tratamento|diagnóstico|classificação|complicaç|abordagem|conduta|farmacológ|não.farmacológ|critério)\b/i.test(tema);

          const promptTema =
`Gere exatamente ${QUESTOES_POR_TEMA} questões de múltipla escolha para o Revalida INEP.

Área: ${areaAtual}
Tema: ${tema}
${temDetalhamento ? `
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
          const dados = await chamarIA(promptTema);

          addLog(`   💾 Salvando ${dados.length} questão(ões)…`, "info");
          await salvarQuestoes(dados, edicaoAtual, proximoNum, areaAtual);

          totalSalvas += dados.length;
          dados.forEach((q) => {
            if (q.subtema) subtemasExistentes.add(q.subtema.toLowerCase().trim());
          });

          addLog(`   ✅ ${dados.length} questão(ões) salvas! (Total da sessão: ${totalSalvas})`, "ok");

          // FIX BUG #3 — avisa o AdminPainel para invalidar o cache do Banco
          if (typeof onQuestoesSalvas === "function") onQuestoesSalvas();

          sucesso = true;
          break;
        } catch (e) {
          addLog(`   ❌ Erro (tentativa ${tentativa}): ${e.message}`, "erro");
          tentativa++;
        }
      }

      if (!sucesso && !abortRef.current) {
        addLog(`   ⚠️  "${tema}" falhou após ${MAX_RETRIES} tentativas. Próximo tema.`, "aviso");
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
  // Pode ser re-executado a qualquer momento para atualizar a fila.
  const escanearBase = async () => {
    setEscaneando(true);
    setMigLog([]);
    setMigPendentes([]);
    setMigEscaneado(false);
    setMigProcessados(0);
    setMigProgresso({ atual: 0, total: 0 });
    addMigLog("🔍 Escaneando base — nenhum documento será alterado…", "sistema");

    try {
      const snap = await getDocs(collection(db, "questoes"));
      const total = snap.docs.length;

      // Filtra apenas docs sem tema_mestre válido E com subtema preenchido
      const semTema = snap.docs
        .filter(d => {
          const tm = d.data().tema_mestre;
          return !tm || tm.trim() === "" || tm.trim() === "INDEFINIDO";
        })
        .map(d => ({ id: d.id, subtema: (d.data().subtema || "").trim() }))
        .filter(q => q.subtema.length > 0);

      setMigPendentes(semTema);
      setMigProgresso({ atual: 0, total: semTema.length });
      setMigEscaneado(true);

      addMigLog(`📊 Base: ${total} questões total`, "sistema");
      if (semTema.length === 0) {
        addMigLog("✅ Todas as questões já possuem tema_mestre válido. Nada a migrar.", "ok");
      } else {
        const nLotes = Math.ceil(semTema.length / migTamLote);
        addMigLog(`⚠️  ${semTema.length} questão(ões) pendentes — ${nLotes} lote(s) de ${migTamLote}`, "aviso");
        addMigLog("👆 Clique em 'Rodar lote' para iniciar. Você controla o ritmo.", "sistema");
      }
    } catch (err) {
      addMigLog(`❌ Erro no scan: ${err.message}`, "erro");
    }

    setEscaneando(false);
  };

  // ── RODAR LOTE: processa APENAS os próximos N da fila — para em seguida ────
  // Segurança: não altera documentos que NÃO estejam na fila de pendentes.
  // Cada clique = 1 lote. O admin valida o resultado antes de continuar.
  const rodarLote = async () => {
    if (migPendentes.length === 0 || migrando) return;
    migAbortRef.current = false;
    setMigrando(true);

    const isDev = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    const endpoint = isDev
      ? "/functions/gerarQuestoesIA"
      : (import.meta.env.VITE_FUNCTIONS_BASE_URL || "https://us-central1-revalidapro-f812e.cloudfunctions.net") + "/gerarQuestoesIA";

    // Captura o lote atual ANTES de qualquer setState
    const lote     = migPendentes.slice(0, migTamLote);
    const loteNum  = Math.floor(migProcessados / migTamLote) + 1;
    const restantes = migPendentes.length - lote.length;

    addMigLog(`▶️  Lote ${loteNum} — ${lote.length} questão(ões) enviadas à IA…`, "info");

    try {
      const promptUsuario =
        `Classifique os subtemas abaixo. Responda SOMENTE com array JSON no formato [{"id":"...","tema_mestre":"..."}].\n${JSON.stringify(lote)}`;

      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system: PROMPT_MIGRACAO, prompt: promptUsuario }),
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data  = await resp.json();
      const texto = (data.content || []).map(c => c.text || "").join("").trim();
      const parsed = extrairJSONDoTexto(texto);

      if (!parsed || !Array.isArray(parsed)) {
        addMigLog(`⚠️  Lote ${loteNum}: IA retornou resposta inválida — nenhum doc alterado. Tente novamente.`, "aviso");
        setMigrando(false);
        return;
      }

      // Grava em batch — apenas os IDs que vieram na resposta da IA
      const batch = writeBatch(db);
      let atualizadosLote = 0;
      let indefinidosLote = 0;

      for (const item of parsed) {
        if (!item.id || !item.tema_mestre) continue;
        // Segurança extra: só atualiza se o ID estava na fila deste lote
        if (!lote.find(q => q.id === item.id)) continue;
        batch.update(doc(db, "questoes", item.id), { tema_mestre: item.tema_mestre });
        atualizadosLote++;
        if (item.tema_mestre === "INDEFINIDO") indefinidosLote++;
      }

      await batch.commit();

      // Remove o lote processado da fila e atualiza contadores
      const novosProcessados = migProcessados + lote.length;
      setMigPendentes(prev => prev.slice(migTamLote));
      setMigProcessados(novosProcessados);
      setMigProgresso({ atual: novosProcessados, total: migProgresso.total });

      addMigLog(
        `✅ Lote ${loteNum}: ${atualizadosLote} atualizados · ${indefinidosLote} INDEFINIDO`,
        "ok"
      );

      if (restantes === 0) {
        addMigLog("🎉 Fila concluída! Todos os pendentes foram processados.", "sistema");
        addMigLog("💡 Rode o Scan novamente para verificar se restam questões.", "sistema");
      } else {
        addMigLog(
          `📋 ${restantes} questão(ões) ainda na fila — clique 'Rodar lote' para continuar.`,
          "sistema"
        );
      }

    } catch (err) {
      addMigLog(`❌ Lote ${loteNum} falhou: ${err.message} — fila não alterada, pode tentar novamente.`, "erro");
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

        <div style={st.rowSingle}>
          <label style={st.label}>
            Temas a gerar&nbsp;
            <span style={{ color: "#64748b", textTransform: "none", fontWeight: "400" }}>
              — um por linha · {QUESTOES_POR_TEMA} questões cada
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
            {listasTemas.length} tema(s) · ~{listasTemas.length * QUESTOES_POR_TEMA} questões ·
            tempo estimado: ~{Math.ceil(listasTemas.length * (DELAY_ENTRE_TEMAS_MS / 60_000))} min
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "20px" }}>
          <span style={st.badge("#818cf8")}><FaClock size={10}/> {DELAY_ENTRE_TEMAS_MS/1000}s pausa entre temas</span>
          <span style={st.badge("#34d399")}><FaFire size={10}/> {QUESTOES_POR_TEMA} questões/tema</span>
          <span style={st.badge("#fbbf24")}><FaLayerGroup size={10}/> {MAX_RETRIES} tentativas máx.</span>
          <span style={st.badge("#94a3b8")}>BAIXO → MÉDIO → ALTO</span>
        </div>

        <div style={st.acoes}>
          {!rodando ? (
            <button
              style={{ ...st.btnIniciar, opacity: listasTemas.length === 0 ? 0.5 : 1 }}
              onClick={iniciarRobo}
              disabled={listasTemas.length === 0}
            >
              <FaPlay size={11} /> Iniciar Robô
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
          {/* Botão de migração — corrige matérias geradas antes do fix */}
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
              title={`Corrige questões da edição "${edicao}" onde a matéria ficou errada (ex: "Cirurgia do Abdome" → "Cirurgia")`}
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

          {/* FIX BUG #2: logEndRef para auto-scroll */}
          <div style={st.logWrap}>
            {log.map((entry, i) => (
              <div key={i} style={st.logLinha(entry.tipo)}>
                <span style={{ color: "#334155", marginRight: "8px" }}>[{entry.ts}]</span>
                {entry.msg}
              </div>
            ))}
            {/* Âncora invisível — scrollIntoView sempre traz a última linha */}
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
            {temasFalhos.length} tema(s) não gerado(s) após {MAX_RETRIES} tentativas
          </div>

          <div style={{
            background: "#0f172a", borderRadius: "10px", padding: "12px 14px",
            marginBottom: "14px", fontFamily: "monospace", fontSize: "12px"
          }}>
            {temasFalhos.map((t, i) => (
              <div key={i} style={{ color: "#f87171", marginBottom: "4px" }}>
                • {t}
              </div>
            ))}
          </div>

          <p style={{ ...st.hint, color: "#94a3b8", marginBottom: "14px" }}>
            Esses temas podem ter falhado por instabilidade temporária da API ou complexidade do conteúdo.
            Clique em "Re-tentar" para carregar somente eles na textarea e rodar novamente.
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
              // rola para o topo da página para o usuário ver a textarea preenchida
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
        {/* Cabeçalho colapsável */}
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

            {/* ── Descrição ──────────────────────────────────────────────── */}
            <p style={{ color: "#64748b", fontSize: "12px", marginBottom: "16px", lineHeight: 1.6 }}>
              Classifica o <strong style={{ color: "#94a3b8" }}>tema_mestre</strong> de questões sem esse campo.
              Funciona em <strong style={{ color: "#94a3b8" }}>dois passos</strong>:
              primeiro faça o <em>scan</em> para ver quantas estão pendentes,
              depois clique <em>"Rodar lote"</em> quantas vezes quiser — você controla o ritmo.
            </p>

            {/* ── Controles: tamanho do lote + botão scan ─────────────────── */}
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

            {/* ── Painel de status pós-scan ────────────────────────────────── */}
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
                {/* Barra de progresso inline */}
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

            {/* ── Log da migração ──────────────────────────────────────────── */}
            {migLog.length > 0 && (
              <div style={{
                background: "#0f172a", border: "1px solid #1e293b",
                borderRadius: "12px", padding: "14px", maxHeight: "200px",
                overflowY: "auto", fontFamily: "monospace", fontSize: "11px", marginBottom: "14px"
              }}>
                {migLog.map((e, i) => {
                  const cores = { ok: "#34d399", erro: "#f87171", aviso: "#fbbf24", sistema: "#818cf8", info: "#94a3b8" };
                  return (
                    <div key={i} style={{ color: cores[e.tipo] || "#94a3b8", marginBottom: "4px", lineHeight: 1.6 }}>
                      <span style={{ color: "#334155", marginRight: "8px" }}>[{e.ts}]</span>{e.msg}
                    </div>
                  );
                })}
                <div ref={migLogRef} />
              </div>
            )}

            {/* ── Botão principal: Rodar lote ──────────────────────────────── */}
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

            {/* Dica de fluxo */}
            {!migEscaneado && !escaneando && (
              <p style={{ color: "#334155", fontSize: "11px", marginTop: "10px", textAlign: "center" }}>
                ① Escanear base → ② Rodar lote → ③ Validar no Banco de Temas → repetir
              </p>
            )}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default RoboGerador;
