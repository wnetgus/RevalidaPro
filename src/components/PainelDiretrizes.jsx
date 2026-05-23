import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  collection, getDocs, setDoc, doc, serverTimestamp,
  query, where, updateDoc, getDoc, deleteDoc,
} from "firebase/firestore";
import { DIRETRIZES_CONTROLADAS } from "../config/diretrizesControladas";
import { getFonteParaTema, PRIORIDADE_CONFIG, RELEVANCIA_CONFIG } from "../config/fontesVigilancia";
import {
  FaShieldAlt, FaCheck, FaClock, FaChevronDown, FaChevronUp,
  FaPlus, FaTimes, FaSync, FaExclamationTriangle, FaSearch,
  FaExternalLinkAlt, FaBell, FaEye, FaInfoCircle, FaTrash,
} from "react-icons/fa";

const REVISOR_PADRAO = "Dr. Weyne Souza";

const SEV_ORDER = { alta: 0, media: 1, baixa: 2 };
const REL_ORDER = { ALTISSIMA: 0, ALTA: 1, MODERADA: 2, BAIXA: 3 };

// Calcula severidade em 3 níveis baseada em quanto a diretriz ultrapassou a periodicidade
const calcSeveridade = (anosDesdeAtualizacao, periodicidadeAnos) => {
  const anosAlem = anosDesdeAtualizacao - periodicidadeAnos;
  const ratio    = periodicidadeAnos > 0 ? anosAlem / periodicidadeAnos : 0;
  if (ratio >= 1.0 || anosAlem >= 3) return "alta";
  if (ratio >= 0.5 || anosAlem >= 1) return "media";
  return "baixa";
};

export default function PainelDiretrizes() {
  // ── ESTADOS — DIRETRIZES ─────────────────────────────────────────────────────
  const [diretrizes, setDiretrizes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [semeando, setSemeando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [filtro, setFiltro] = useState("todas");
  const [expandida, setExpandida] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [nova, setNova] = useState({
    tema_id: "", versao: "", fonte: "", ano: "",
    palavrasChave: "", pontosCriticos: "",
  });

  // ── ESTADOS — VIGILÂNCIA ─────────────────────────────────────────────────────
  const [alertas, setAlertas] = useState([]);
  const [escaneando, setEscaneando] = useState(false);
  const [limpando, setLimpando] = useState(false);
  const [ultEscaneamento, setUltEscaneamento] = useState(null);
  const [filtroVigilancia, setFiltroVigilancia] = useState("pendente");
  const [alertaParaConverter, setAlertaParaConverter] = useState(null);

  // ── CARREGAR DIRETRIZES ──────────────────────────────────────────────────────
  const carregar = async () => {
    setCarregando(true);
    let lista = [];
    try {
      const snap = await getDocs(collection(db, "diretrizes"));
      lista = snap.docs
        .map(d => ({ docId: d.id, ...d.data() }))
        .sort((a, b) => {
          if (a.ativa !== b.ativa) return a.ativa ? -1 : 1;
          return (a.tema || "").localeCompare(b.tema || "");
        });
      setDiretrizes(lista);
    } catch (e) {
      console.error("[PainelDiretrizes] Carregar:", e);
    }
    setCarregando(false);
    return lista;
  };

  // ── CARREGAR ALERTAS ─────────────────────────────────────────────────────────
  const carregarAlertas = async () => {
    try {
      const snap = await getDocs(collection(db, "vigilanciaDiretrizes"));
      const lista = snap.docs
        .map(d => ({ docId: d.id, ...d.data() }))
        .sort((a, b) => {
          // pendentes primeiro
          if (a.status !== b.status) {
            if (a.status === "pendente") return -1;
            if (b.status === "pendente") return 1;
          }
          // brasileiras primeiro (prioridade 1 = BR, 2 = INTL aceita, 3 = INTL manual)
          const pa = a.prioridade || 99;
          const pb = b.prioridade || 99;
          if (pa !== pb) return pa - pb;
          // relevância Revalida/INEP
          const ra = REL_ORDER[a.relevanciaRevalida] ?? 4;
          const rb = REL_ORDER[b.relevanciaRevalida] ?? 4;
          if (ra !== rb) return ra - rb;
          // severidade
          const sa = SEV_ORDER[a.severidade] ?? 3;
          const sb = SEV_ORDER[b.severidade] ?? 3;
          if (sa !== sb) return sa - sb;
          return (a.tema || "").localeCompare(b.tema || "");
        });
      setAlertas(lista);
    } catch (e) {
      console.error("[Vigilância] Carregar alertas:", e);
    }
  };

  // ── ENGINE DE ESCANEAMENTO — DEDUPLICAÇÃO POR DocId DETERMINÍSTICO ───────────
  const escanear = async (origemDeteccao = "manual", diretrizesParam = null) => {
    setEscaneando(true);
    try {
      const lista = diretrizesParam || diretrizes;
      const ativasParaVerificar = lista.filter(d => d.ativa);
      const currentYear = new Date().getFullYear();
      let novosAlertas = 0;

      for (const diretriz of ativasParaVerificar) {
        const fonte = getFonteParaTema(diretriz.tema_id);
        if (!fonte) continue;

        const anosDesdeAtualizacao = currentYear - (diretriz.ano || 0);
        if (anosDesdeAtualizacao < fonte.periodicidadeAnos) continue;

        const anoSugerido = (diretriz.ano || currentYear) + fonte.periodicidadeAnos;
        // Chave única: tema_id + anoSugerido — garante 1 alerta por ciclo de atualização
        const alertaDocId = `${diretriz.tema_id}_alerta_${anoSugerido}`;

        // Verifica se já existe (de qualquer status) → evita criação duplicada
        const existeSnap = await getDoc(doc(db, "vigilanciaDiretrizes", alertaDocId));
        if (existeSnap.exists()) {
          const statusAtual = existeSnap.data().status;
          // Só recria se foi convertido (novo ciclo após publicação de nova versão)
          if (statusAtual !== "convertido") continue;
        }

        const severidade = calcSeveridade(anosDesdeAtualizacao, fonte.periodicidadeAnos);
        const notaBrasil = fonte.prioridade === 1
          ? "Diretriz brasileira — prioritária para o Revalida/INEP."
          : fonte.prioridade === 2
            ? "Guideline internacional aceita no Brasil — verificar alinhamento com o SUS."
            : "Guideline internacional não incorporada ao SUS — exige revisão manual obrigatória antes de atualizar.";

        await setDoc(doc(db, "vigilanciaDiretrizes", alertaDocId), {
          tema_id:        diretriz.tema_id,
          tema:           diretriz.tema,
          tipo:           fonte.prioridade <= 2 ? "atualizacao_periodicidade" : "observacional",
          status:         "pendente",
          fonteAtual:     diretriz.fonte,
          anoAtual:       diretriz.ano,
          novaFonte:      `Verificar nova publicação ${fonte.siglaOficial}`,
          novoAno:        anoSugerido,
          novaVersao:     `${anoSugerido}.1`,
          urlFonte:       fonte.url,
          orgao:          fonte.orgao,
          siglaOficial:   fonte.siglaOficial,
          periodicidadeAnos: fonte.periodicidadeAnos,
          anosDesdeAtualizacao,
          severidade,
          origemDeteccao,
          // contexto brasileiro
          prioridade:          fonte.prioridade || 1,
          contextoBrasil:      fonte.contextoBrasil || false,
          origemPais:          fonte.origemPais || "BR",
          aceitaNoBrasil:      fonte.aceitaNoBrasil || true,
          relevanciaRevalida:  fonte.relevanciaRevalida || "ALTA",
          requerRevisaoManual: fonte.requerRevisaoManual || false,
          observacoes:    `Diretriz de ${diretriz.ano} — periodicidade esperada: ${fonte.periodicidadeAnos} ano(s). ${notaBrasil}`,
          detectadoEm:    serverTimestamp(),
          updatedAt:      serverTimestamp(),
          revisadoPor:    null,
          dataRevisao:    null,
        });
        novosAlertas++;
      }

      const agora = new Date();
      await setDoc(doc(db, "vigilanciaConfig", "meta"), {
        ultimoEscaneamento: serverTimestamp(),
        ultimoEscaneamentoLocal: agora.toISOString(),
      }, { merge: true });

      setUltEscaneamento(agora);
      await carregarAlertas();

      if (origemDeteccao === "manual") {
        alert(
          novosAlertas > 0
            ? `✅ Escaneamento concluído. ${novosAlertas} novo(s) alerta(s) gerado(s).`
            : "✅ Escaneamento concluído. Nenhum novo alerta detectado."
        );
      }
    } catch (e) {
      console.error("[Vigilância] Escanear:", e);
      if (origemDeteccao === "manual") alert("Erro durante o escaneamento. Veja o console.");
    }
    setEscaneando(false);
  };

  // ── AUTO-SCAN (> 7 dias desde último) ───────────────────────────────────────
  const verificarAutoScan = async (diretrizesParam = null) => {
    try {
      const metaSnap = await getDoc(doc(db, "vigilanciaConfig", "meta"));
      if (metaSnap.exists()) {
        const data = metaSnap.data();
        const ult = data.ultimoEscaneamento?.toDate?.() || null;
        if (ult) {
          setUltEscaneamento(ult);
          const diffDias = (Date.now() - ult.getTime()) / (1000 * 60 * 60 * 24);
          if (diffDias <= 7) return;
        }
      }
      await escanear("automatico", diretrizesParam);
    } catch (e) {
      console.error("[Vigilância] Auto-scan check:", e);
    }
  };

  // ── LIMPAR DUPLICATAS E RESCANEAR ────────────────────────────────────────────
  const limparERescanear = async () => {
    if (!window.confirm(
      "Isso vai excluir TODOS os alertas pendentes e executar um escaneamento limpo.\n\n" +
      "Alertas já revisados/ignorados/convertidos serão preservados.\n\nContinuar?"
    )) return;
    setLimpando(true);
    try {
      const snapPendentes = await getDocs(
        query(collection(db, "vigilanciaDiretrizes"), where("status", "==", "pendente"))
      );
      for (const docSnap of snapPendentes.docs) {
        await deleteDoc(doc(db, "vigilanciaDiretrizes", docSnap.id));
      }
      await escanear("manual");
    } catch (e) {
      console.error("[Vigilância] Limpar:", e);
      alert("Erro ao limpar alertas. Veja o console.");
    }
    setLimpando(false);
  };

  // ── INIT ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const lista = await carregar();
      await carregarAlertas();
      if (lista.length > 0) await verificarAutoScan(lista);
    };
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── AÇÕES DE VIGILÂNCIA ──────────────────────────────────────────────────────
  const ignorarAlerta = async (alertaId) => {
    try {
      await updateDoc(doc(db, "vigilanciaDiretrizes", alertaId), {
        status:      "ignorado",
        revisadoPor: REVISOR_PADRAO,
        dataRevisao: serverTimestamp(),
        updatedAt:   serverTimestamp(),
      });
      await carregarAlertas();
    } catch (e) {
      console.error("[Vigilância] Ignorar:", e);
    }
  };

  const marcarRevisada = async (alertaId) => {
    try {
      await updateDoc(doc(db, "vigilanciaDiretrizes", alertaId), {
        status:      "revisado",
        revisadoPor: REVISOR_PADRAO,
        dataRevisao: serverTimestamp(),
        updatedAt:   serverTimestamp(),
      });
      await carregarAlertas();
    } catch (e) {
      console.error("[Vigilância] Marcar revisada:", e);
    }
  };

  const converterParaNovaVersao = (alerta) => {
    const temaBase = DIRETRIZES_CONTROLADAS.find(x => x.id === alerta.tema_id);
    setNova({
      tema_id:        alerta.tema_id || "",
      versao:         alerta.novaVersao || `${alerta.novoAno || ""}.1`,
      fonte:          alerta.novaFonte || `Verificar nova publicação ${alerta.siglaOficial || ""}`,
      ano:            String(alerta.novoAno || ""),
      palavrasChave:  temaBase ? temaBase.palavrasChave.join(", ") : "",
      pontosCriticos: temaBase ? temaBase.pontosCriticos.join("\n") : "",
    });
    setAlertaParaConverter(alerta);
    setShowModal(true);
  };

  // ── SEMEAR BASE ESTÁTICA → FIRESTORE ────────────────────────────────────────
  const semearBase = async () => {
    if (!window.confirm(
      `Inicializar ${DIRETRIZES_CONTROLADAS.length} diretrizes no Firestore?\n` +
      "Entradas já existentes não serão sobrescritas (merge: true)."
    )) return;
    setSemeando(true);
    try {
      for (const d of DIRETRIZES_CONTROLADAS) {
        const versao = `${d.ano}.1`;
        const docId  = `${d.id}_v${versao}`;
        await setDoc(doc(db, "diretrizes", docId), {
          tema_id:        d.id,
          tema:           d.tema,
          versao,
          fonte:          d.fonte,
          ano:            d.ano,
          ativa:          d.ativa,
          historica:      d.historica,
          substitui:      d.substitui || null,
          palavrasChave:  d.palavrasChave,
          pontosCriticos: d.pontosCriticos,
          origem:         "sistema",
          updatedAt:      serverTimestamp(),
          criadoEm:       serverTimestamp(),
        }, { merge: true });
      }
      await carregar();
      alert(`✅ ${DIRETRIZES_CONTROLADAS.length} diretrizes inicializadas com sucesso!`);
    } catch (e) {
      alert("Erro ao inicializar base. Verifique o console.");
      console.error(e);
    }
    setSemeando(false);
  };

  // ── ATIVAR VERSÃO ────────────────────────────────────────────────────────────
  const ativar = async (d) => {
    if (!window.confirm(
      `Ativar:\n"${d.fonte}"\n\nA versão atualmente ativa deste tema será marcada como Histórica.`
    )) return;
    setSalvando(true);
    try {
      const ativasDoTema = diretrizes.filter(
        x => x.tema_id === d.tema_id && x.ativa && x.docId !== d.docId
      );
      for (const a of ativasDoTema) {
        await setDoc(doc(db, "diretrizes", a.docId),
          { ativa: false, historica: true, updatedAt: serverTimestamp() },
          { merge: true });
      }
      await setDoc(doc(db, "diretrizes", d.docId),
        { ativa: true, historica: false, updatedAt: serverTimestamp() },
        { merge: true });
      await carregar();
    } catch (e) {
      alert("Erro ao ativar diretriz.");
      console.error(e);
    }
    setSalvando(false);
  };

  // ── TORNAR HISTÓRICA ─────────────────────────────────────────────────────────
  const tornarHistorica = async (d) => {
    if (!window.confirm(
      `Marcar como Histórica:\n"${d.fonte}"\n\nEla não será mais injetada em novas questões.`
    )) return;
    setSalvando(true);
    try {
      await setDoc(doc(db, "diretrizes", d.docId),
        { ativa: false, historica: true, updatedAt: serverTimestamp() },
        { merge: true });
      await carregar();
    } catch (e) {
      alert("Erro ao atualizar.");
      console.error(e);
    }
    setSalvando(false);
  };

  // ── ADICIONAR NOVA VERSÃO ────────────────────────────────────────────────────
  const adicionarNovaVersao = async () => {
    const { tema_id, versao, fonte, ano, palavrasChave, pontosCriticos } = nova;
    if (!tema_id || !versao || !fonte || !ano)
      return alert("Preencha: Tema, Versão, Fonte e Ano.");
    setSalvando(true);
    try {
      const docId    = `${tema_id}_v${versao}`;
      const temaBase = DIRETRIZES_CONTROLADAS.find(x => x.id === tema_id);
      await setDoc(doc(db, "diretrizes", docId), {
        tema_id,
        tema:           temaBase?.tema || tema_id,
        versao,
        fonte,
        ano:            parseInt(ano),
        ativa:          false,
        historica:      false,
        substitui:      null,
        palavrasChave:  palavrasChave.split(",").map(s => s.trim()).filter(Boolean),
        pontosCriticos: pontosCriticos.split("\n").map(s => s.trim()).filter(Boolean),
        origem:         "admin",
        updatedAt:      serverTimestamp(),
        criadoEm:       serverTimestamp(),
      });

      // Marca alerta de origem como convertido + auditoria
      if (alertaParaConverter) {
        try {
          await updateDoc(doc(db, "vigilanciaDiretrizes", alertaParaConverter.docId), {
            status:      "convertido",
            revisadoPor: REVISOR_PADRAO,
            dataRevisao: serverTimestamp(),
            updatedAt:   serverTimestamp(),
          });
        } catch (e) {
          console.error("[Vigilância] Marcar convertido:", e);
        }
        setAlertaParaConverter(null);
        await carregarAlertas();
      }

      await carregar();
      setShowModal(false);
      setNova({ tema_id: "", versao: "", fonte: "", ano: "", palavrasChave: "", pontosCriticos: "" });
    } catch (e) {
      alert("Erro ao adicionar nova versão.");
      console.error(e);
    }
    setSalvando(false);
  };

  // ── COMPUTED — DIRETRIZES ────────────────────────────────────────────────────
  const lista = filtro === "ativas"    ? diretrizes.filter(d => d.ativa)
              : filtro === "historicas" ? diretrizes.filter(d => d.historica)
              : diretrizes;

  const nAtivas     = diretrizes.filter(d => d.ativa).length;
  const nHistoricas = diretrizes.filter(d => d.historica).length;
  const nPendentes  = diretrizes.filter(d => !d.ativa && !d.historica).length;

  // ── COMPUTED — VIGILÂNCIA ────────────────────────────────────────────────────
  const alertasFiltrados = filtroVigilancia === "todas"
    ? alertas : alertas.filter(a => a.status === filtroVigilancia);

  const nAlertasPendentes   = alertas.filter(a => a.status === "pendente").length;
  const nAlertasRevisados   = alertas.filter(a => a.status === "revisado").length;
  const nAlertasIgnorados   = alertas.filter(a => a.status === "ignorado").length;
  const nAlertasConvertidos = alertas.filter(a => a.status === "convertido").length;

  // ── RENDER ───────────────────────────────────────────────────────────────────
  return (
    <div style={st.container}>

      {/* ═══ SEÇÃO 1: DIRETRIZES ════════════════════════════════════════════════ */}

      <div style={st.header}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <FaShieldAlt color="#34d399" size={18} />
            <h2 style={st.titulo}>Engine de Diretrizes Controladas</h2>
          </div>
          <p style={st.subtitulo}>
            Gerencie versões ativas e históricas das diretrizes médicas injetadas na geração de questões.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {diretrizes.length === 0 && !carregando && (
            <button onClick={semearBase} disabled={semeando} style={st.btnSeed}>
              {semeando
                ? <><FaSync style={{ animation: "spin 1s linear infinite" }} /> Inicializando...</>
                : <><FaSync size={11} /> Inicializar Base</>}
            </button>
          )}
          <button onClick={() => { setAlertaParaConverter(null); setShowModal(true); }} style={st.btnNova}>
            <FaPlus size={11} /> Nova Versão
          </button>
        </div>
      </div>

      {/* STATS */}
      <div style={st.statsRow}>
        {[
          { v: nAtivas,       label: "Ativas",     cor: "#34d399" },
          { v: nHistoricas,   label: "Históricas", cor: "#64748b" },
          { v: nPendentes,    label: "Pendentes",  cor: "#fbbf24" },
          { v: diretrizes.length, label: "Total",  cor: "#818cf8" },
        ].map(s => (
          <div key={s.label} style={st.statCard}>
            <span style={{ fontSize: "22px", fontWeight: "800", color: s.cor }}>{s.v}</span>
            <span style={st.statLabel}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* FILTROS */}
      <div style={st.filtros}>
        {[
          { id: "todas",      label: "Todas" },
          { id: "ativas",     label: `Ativas (${nAtivas})` },
          { id: "historicas", label: `Históricas (${nHistoricas})` },
        ].map(f => (
          <button key={f.id} onClick={() => setFiltro(f.id)}
            style={{ ...st.filtroBtn, ...(filtro === f.id ? st.filtroBtnActive : {}) }}>
            {f.label}
          </button>
        ))}
      </div>

      {!carregando && diretrizes.length === 0 && (
        <div style={st.emptyState}>
          <FaShieldAlt size={40} color="#1e293b" style={{ marginBottom: "16px" }} />
          <p style={{ color: "#475569", fontSize: "14px", marginBottom: "16px" }}>
            Nenhuma diretriz no Firestore ainda.
          </p>
          <button onClick={semearBase} disabled={semeando} style={st.btnSeed}>
            {semeando ? "Inicializando..." : "Inicializar com as 10 diretrizes base"}
          </button>
        </div>
      )}

      {carregando && (
        <div style={{ textAlign: "center", padding: "60px", color: "#475569" }}>
          <FaSync style={{ animation: "spin 1s linear infinite", fontSize: "24px", marginBottom: "12px" }} />
          <p>Carregando diretrizes...</p>
        </div>
      )}

      {!carregando && lista.length > 0 && (
        <div style={st.lista}>
          {lista.map(d => (
            <div key={d.docId} style={{
              ...st.row,
              borderLeft: `3px solid ${d.ativa ? "#34d399" : d.historica ? "#334155" : "#fbbf24"}`,
            }}>
              <div style={st.rowTop}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: 0, flexWrap: "wrap" }}>
                  {d.ativa ? (
                    <span style={st.badgeAtiva}><FaCheck size={9} /> ATIVA</span>
                  ) : d.historica ? (
                    <span style={st.badgeHistorica}><FaClock size={9} /> HISTÓRICA</span>
                  ) : (
                    <span style={st.badgePendente}><FaExclamationTriangle size={9} /> PENDENTE</span>
                  )}
                  <span style={st.temaTxt}>{d.tema || d.tema_id}</span>
                  <span style={st.versaoBadge}>v{d.versao}</span>
                  <span style={st.anoBadge}>{d.ano}</span>
                  {(() => {
                    const f = getFonteParaTema(d.tema_id);
                    const pc = f ? PRIORIDADE_CONFIG[f.prioridade] : null;
                    if (!pc) return null;
                    return (
                      <span style={{ ...st.origemDirBadge, color: pc.cor, background: pc.bg, border: `1px solid ${pc.border}` }}>
                        {pc.badge} {f.prioridade === 1 ? "BR" : "INTL"}
                      </span>
                    );
                  })()}
                </div>
                <div style={{ display: "flex", gap: "8px", flexShrink: 0, alignItems: "center" }}>
                  <button onClick={() => setExpandida(expandida === d.docId ? null : d.docId)}
                    style={st.btnIcono} title="Ver pontos críticos">
                    {expandida === d.docId ? <FaChevronUp size={11} /> : <FaChevronDown size={11} />}
                  </button>
                  {!d.ativa && (
                    <button onClick={() => ativar(d)} disabled={salvando} style={st.btnAtivar}>
                      Ativar
                    </button>
                  )}
                  {d.ativa && (
                    <button onClick={() => tornarHistorica(d)} disabled={salvando} style={st.btnHistorica}>
                      ↓ Histórica
                    </button>
                  )}
                </div>
              </div>

              <div style={st.rowMeta}>
                <span style={st.fonteStr}>{d.fonte}</span>
                {d.updatedAt?.toDate && (
                  <span style={st.dataBadge}>
                    Atualizado em {d.updatedAt.toDate().toLocaleDateString("pt-BR")}
                  </span>
                )}
              </div>

              {expandida === d.docId && Array.isArray(d.pontosCriticos) && (
                <div style={st.pontosBox}>
                  <div style={st.pontosTitle}>Pontos Críticos Injetados no Prompt</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {d.pontosCriticos.map((p, i) => (
                      <div key={i} style={st.pontoItem}>
                        <span style={{ color: "#34d399", flexShrink: 0, fontSize: "10px" }}>•</span>
                        <span style={{ fontSize: "12px", color: "#94a3b8", lineHeight: 1.5 }}>{p}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ═══ SEÇÃO 2: VIGILÂNCIA INTELIGENTE ════════════════════════════════════ */}
      <div style={st.vigilanciaSection}>

        <div style={st.vigilanciaHeader}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "5px" }}>
              <FaBell color="#f59e0b" size={16} />
              <h3 style={st.vigilanciaTitulo}>Vigilância Inteligente de Diretrizes</h3>
              {nAlertasPendentes > 0 && (
                <span style={st.vigilanciaBadge}>{nAlertasPendentes}</span>
              )}
            </div>
            <p style={st.vigilanciaSubtitulo}>
              Detecção por periodicidade — monitoramento estruturado sem scraping caótico.
              {ultEscaneamento ? (
                <span style={{ color: "#334155", marginLeft: "8px" }}>
                  Último escaneamento: {ultEscaneamento.toLocaleDateString("pt-BR")}
                </span>
              ) : (
                <span style={{ color: "#334155", marginLeft: "8px" }}>Aguardando primeiro escaneamento...</span>
              )}
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px", flexShrink: 0, flexWrap: "wrap" }}>
            {nAlertasPendentes > 0 && (
              <button
                onClick={limparERescanear}
                disabled={limpando || escaneando}
                style={st.btnLimpar}
                title="Exclui alertas pendentes e escaneia do zero"
              >
                {limpando
                  ? <><FaSync style={{ animation: "spin 1s linear infinite" }} /> Limpando...</>
                  : <><FaTrash size={10} /> Limpar e Rescanear</>}
              </button>
            )}
            <button
              onClick={() => escanear("manual")}
              disabled={escaneando || limpando}
              style={st.btnScan}
            >
              {escaneando
                ? <><FaSync style={{ animation: "spin 1s linear infinite" }} /> Escaneando...</>
                : <><FaSearch size={11} /> Escanear Atualizações</>}
            </button>
          </div>
        </div>

        {/* STATS VIGILÂNCIA */}
        <div style={st.vigilanciaStats}>
          {[
            { label: "Pendentes",   value: nAlertasPendentes,   cor: "#f59e0b" },
            { label: "Revisados",   value: nAlertasRevisados,   cor: "#34d399" },
            { label: "Ignorados",   value: nAlertasIgnorados,   cor: "#475569" },
            { label: "Convertidos", value: nAlertasConvertidos, cor: "#818cf8" },
          ].map(s => (
            <div key={s.label} style={st.vigilanciaStatCard}>
              <span style={{ fontSize: "18px", fontWeight: "800", color: s.cor }}>{s.value}</span>
              <span style={st.statLabel}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* FILTROS VIGILÂNCIA */}
        <div style={st.filtros}>
          {[
            { id: "pendente",   label: `Pendentes (${nAlertasPendentes})` },
            { id: "revisado",   label: `Revisados (${nAlertasRevisados})` },
            { id: "ignorado",   label: `Ignorados (${nAlertasIgnorados})` },
            { id: "convertido", label: `Convertidos (${nAlertasConvertidos})` },
            { id: "todas",      label: "Todas" },
          ].map(f => (
            <button key={f.id} onClick={() => setFiltroVigilancia(f.id)}
              style={{ ...st.filtroBtn, ...(filtroVigilancia === f.id ? st.filtroBtnAmber : {}) }}>
              {f.label}
            </button>
          ))}
        </div>

        {/* LISTA DE ALERTAS */}
        {alertasFiltrados.length === 0 ? (
          <div style={st.vigilanciaEmpty}>
            {alertas.length === 0 ? (
              <>
                <FaSearch size={28} color="#334155" style={{ marginBottom: "12px" }} />
                <p style={{ color: "#475569", fontSize: "13px", margin: 0 }}>
                  Nenhum alerta ainda. Clique em <strong>Escanear Atualizações</strong> para verificar.
                </p>
              </>
            ) : (
              <>
                <FaCheck size={28} color="#34d399" style={{ marginBottom: "12px" }} />
                <p style={{ color: "#475569", fontSize: "13px", margin: 0 }}>
                  Sem alertas com status <strong>{filtroVigilancia}</strong>.
                </p>
              </>
            )}
          </div>
        ) : (
          <div style={st.lista}>
            {alertasFiltrados.map(alerta => {
              const sev = alerta.severidade || "media";
              const SEV_CONFIG = {
                alta:  { cor: "#ef4444", bg: "rgba(239,68,68,0.1)",   borda: "rgba(239,68,68,0.3)",   icon: <FaExclamationTriangle size={9} />, label: "ALTA"  },
                media: { cor: "#f59e0b", bg: "rgba(245,158,11,0.1)",  borda: "rgba(245,158,11,0.3)",  icon: <FaExclamationTriangle size={9} />, label: "MÉDIA" },
                baixa: { cor: "#60a5fa", bg: "rgba(96,165,250,0.08)", borda: "rgba(96,165,250,0.25)", icon: <FaInfoCircle size={9} />,          label: "BAIXA" },
              };
              const sc = SEV_CONFIG[sev] || SEV_CONFIG.media;

              const borderCor =
                alerta.status !== "pendente" ? "#334155"
                : sc.cor;

              return (
                <div key={alerta.docId} style={{ ...st.alertaRow, borderLeft: `3px solid ${borderCor}` }}>

                  {/* Cabeçalho */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
                    <span style={{ ...st.sevBadge, background: sc.bg, border: `1px solid ${sc.borda}`, color: sc.cor }}>
                      {sc.icon} {sc.label}
                    </span>
                    <span style={st.alertaTema}>{alerta.tema}</span>
                    <AlertaStatusBadge status={alerta.status} />
                    {/* Origem/contexto brasileiro */}
                    {(() => {
                      const prioridade = alerta.prioridade || (alerta.contextoBrasil ? 1 : 2);
                      const pc = PRIORIDADE_CONFIG[prioridade];
                      return pc ? (
                        <span style={{ ...st.contextoBadge, color: pc.cor, background: pc.bg, border: `1px solid ${pc.border}` }}>
                          {pc.badge} {prioridade === 1 ? "BR" : "INTL"}
                        </span>
                      ) : null;
                    })()}
                    {/* Relevância Revalida/INEP */}
                    {alerta.relevanciaRevalida && (() => {
                      const rc = RELEVANCIA_CONFIG[alerta.relevanciaRevalida];
                      return rc ? (
                        <span style={{ ...st.relevBadge, color: rc.cor, background: rc.bg, border: `1px solid ${rc.border}` }}>
                          ★ {rc.label}
                        </span>
                      ) : null;
                    })()}
                    {alerta.requerRevisaoManual && (
                      <span style={st.manualBadge}>⚠ Revisão manual</span>
                    )}
                    {alerta.origemDeteccao === "automatico" && (
                      <span style={st.origemBadge}>Auto</span>
                    )}
                  </div>

                  {/* Detalhe */}
                  <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "6px", lineHeight: 1.7 }}>
                    <span style={{ color: "#475569" }}>Diretriz atual: </span>
                    <span style={{ color: "#94a3b8" }}>{alerta.fonteAtual}</span>
                    <span style={{ color: "#334155" }}> · </span>
                    <span style={{ color: "#475569" }}>Ano: </span>
                    <span style={{ color: "#fbbf24", fontWeight: "700" }}>{alerta.anoAtual}</span>
                    {alerta.periodicidadeAnos && (
                      <>
                        <span style={{ color: "#334155" }}> · </span>
                        <span style={{ color: "#475569" }}>Periodicidade: </span>
                        <span style={{ color: "#94a3b8" }}>{alerta.periodicidadeAnos} ano(s)</span>
                        <span style={{ color: "#334155" }}> · </span>
                        <span style={{ color: "#475569" }}>Defasagem: </span>
                        <span style={{ color: sc.cor, fontWeight: "700" }}>
                          {alerta.anosDesdeAtualizacao} ano(s)
                        </span>
                      </>
                    )}
                  </div>
                  <div style={{ fontSize: "11px", color: "#475569", marginBottom: alerta.status === "pendente" ? "12px" : "6px", lineHeight: 1.5, fontStyle: "italic" }}>
                    {alerta.observacoes}
                  </div>

                  {/* Auditoria editorial (não-pendentes) */}
                  {alerta.status !== "pendente" && alerta.revisadoPor && (
                    <div style={st.auditRow}>
                      <FaCheck size={9} style={{ color: "#34d399", flexShrink: 0 }} />
                      <span>
                        {alerta.status === "revisado"   ? "Revisado" :
                         alerta.status === "ignorado"   ? "Ignorado" :
                         alerta.status === "convertido" ? "Convertido em nova versão" : "Processado"}
                        {" "}por <strong>{alerta.revisadoPor}</strong>
                        {alerta.dataRevisao?.toDate && (
                          <> em {alerta.dataRevisao.toDate().toLocaleDateString("pt-BR")}</>
                        )}
                      </span>
                    </div>
                  )}

                  {/* Ações — só pendentes */}
                  {alerta.status === "pendente" && (
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      {alerta.urlFonte && (
                        <a href={alerta.urlFonte} target="_blank" rel="noreferrer" style={st.btnVerFonte}>
                          <FaExternalLinkAlt size={9} /> Ver Fonte
                        </a>
                      )}
                      <button onClick={() => converterParaNovaVersao(alerta)} style={st.btnConverter}>
                        <FaPlus size={9} /> Criar Nova Versão
                      </button>
                      <button onClick={() => marcarRevisada(alerta.docId)} style={st.btnRevisar}>
                        <FaEye size={9} /> Marcar Revisada
                      </button>
                      <button onClick={() => ignorarAlerta(alerta.docId)} style={st.btnIgnorar}>
                        <FaTimes size={9} /> Ignorar
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══ MODAL — NOVA VERSÃO ════════════════════════════════════════════════ */}
      {showModal && (
        <div style={st.overlay} onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div style={st.modal}>
            <div style={st.modalHeader}>
              <span style={{ fontSize: "14px", fontWeight: "800", color: "#f1f5f9" }}>
                {alertaParaConverter ? "🔔 Nova Versão — a partir do Alerta de Vigilância" : "Nova Versão de Diretriz"}
              </span>
              <button onClick={() => { setShowModal(false); setAlertaParaConverter(null); }} style={st.btnClose}>
                <FaTimes size={13} />
              </button>
            </div>

            {alertaParaConverter && (
              <div style={st.alertaHint}>
                <FaBell size={11} />
                Alerta detectado para <strong>{alertaParaConverter.tema}</strong>.
                Revise os campos abaixo e salve — o alerta será marcado como Convertido automaticamente.
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={st.label}>Tema (ID)</label>
                <select value={nova.tema_id}
                  onChange={e => setNova(p => ({ ...p, tema_id: e.target.value }))}
                  style={st.input} disabled={!!alertaParaConverter}>
                  <option value="">Selecionar tema...</option>
                  {DIRETRIZES_CONTROLADAS.map(d => (
                    <option key={d.id} value={d.id}>{d.tema}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={st.label}>Versão <span style={{ color: "#475569" }}>(ex: 2025.1)</span></label>
                  <input value={nova.versao}
                    onChange={e => setNova(p => ({ ...p, versao: e.target.value }))}
                    placeholder="2025.1" style={st.input} />
                </div>
                <div>
                  <label style={st.label}>Ano</label>
                  <input type="number" value={nova.ano}
                    onChange={e => setNova(p => ({ ...p, ano: e.target.value }))}
                    placeholder="2025" style={st.input} />
                </div>
              </div>

              <div>
                <label style={st.label}>Fonte Oficial</label>
                <input value={nova.fonte}
                  onChange={e => setNova(p => ({ ...p, fonte: e.target.value }))}
                  placeholder="Ex: 8ª Diretriz Brasileira de Hipertensão — SBC 2025"
                  style={st.input} />
              </div>

              <div>
                <label style={st.label}>Palavras-chave <span style={{ color: "#475569" }}>(separadas por vírgula)</span></label>
                <input value={nova.palavrasChave}
                  onChange={e => setNova(p => ({ ...p, palavrasChave: e.target.value }))}
                  placeholder="hipertensão, has, pressão arterial" style={st.input} />
              </div>

              <div>
                <label style={st.label}>Pontos Críticos <span style={{ color: "#475569" }}>(um por linha)</span></label>
                <textarea value={nova.pontosCriticos}
                  onChange={e => setNova(p => ({ ...p, pontosCriticos: e.target.value }))}
                  rows={6}
                  placeholder={"Meta PA: < 125/75 mmHg em todos os adultos\nNova classificação 2025: ..."}
                  style={{ ...st.input, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }} />
              </div>

              <p style={{ fontSize: "11px", color: "#475569", margin: 0 }}>
                Ficará com status <strong>Pendente</strong> até ativação manual.
                {alertaParaConverter && " O alerta de vigilância será marcado como Convertido."}
              </p>

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button onClick={() => { setShowModal(false); setAlertaParaConverter(null); }} style={st.btnCancel}>
                  Cancelar
                </button>
                <button onClick={adicionarNovaVersao} disabled={salvando} style={st.btnSave}>
                  {salvando ? "Salvando..." : "Salvar Nova Versão"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}

// Sub-componente inline para badge de status dos alertas
function AlertaStatusBadge({ status }) {
  const MAP = {
    pendente:   { label: "Pendente",   cor: "#f59e0b", bg: "rgba(245,158,11,0.1)",   border: "rgba(245,158,11,0.25)"  },
    revisado:   { label: "Revisado",   cor: "#34d399", bg: "rgba(16,185,129,0.1)",   border: "rgba(16,185,129,0.25)"  },
    ignorado:   { label: "Ignorado",   cor: "#475569", bg: "rgba(71,85,105,0.1)",    border: "#334155"                 },
    convertido: { label: "Convertido", cor: "#818cf8", bg: "rgba(99,102,241,0.1)",   border: "rgba(99,102,241,0.25)"  },
  };
  const cfg = MAP[status] || MAP.pendente;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "2px 8px", borderRadius: "20px", fontSize: "9px", fontWeight: "800",
      background: cfg.bg, color: cfg.cor, border: `1px solid ${cfg.border}`,
    }}>
      {cfg.label}
    </span>
  );
}

const st = {
  container:     { padding: "0", minHeight: "400px" },
  header:        { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px", gap: "16px", flexWrap: "wrap" },
  titulo:        { margin: 0, fontSize: "17px", fontWeight: "800", color: "#f1f5f9" },
  subtitulo:     { margin: 0, fontSize: "12px", color: "#475569" },
  statsRow:      { display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" },
  statCard:      { background: "#1e293b", border: "1px solid #334155", borderRadius: "12px", padding: "14px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", minWidth: "80px" },
  statLabel:     { fontSize: "10px", color: "#475569", fontWeight: "700", textTransform: "uppercase" },
  filtros:       { display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" },
  filtroBtn:     { background: "none", border: "1px solid #334155", color: "#64748b", padding: "7px 14px", borderRadius: "8px", cursor: "pointer", fontWeight: "700", fontSize: "11px" },
  filtroBtnActive: { background: "#4f46e5", border: "1px solid #4f46e5", color: "#fff" },
  filtroBtnAmber:  { background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.4)", color: "#f59e0b" },
  emptyState:    { textAlign: "center", padding: "60px 20px", display: "flex", flexDirection: "column", alignItems: "center" },
  lista:         { display: "flex", flexDirection: "column", gap: "10px" },
  row:           { background: "#1e293b", border: "1px solid #1e3251", borderRadius: "14px", padding: "16px 18px", transition: "0.2s" },
  rowTop:        { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginBottom: "8px", flexWrap: "wrap" },
  rowMeta:       { display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" },
  badgeAtiva:    { display: "flex", alignItems: "center", gap: "5px", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", color: "#34d399", padding: "3px 10px", borderRadius: "20px", fontSize: "10px", fontWeight: "800", flexShrink: 0 },
  badgeHistorica:{ display: "flex", alignItems: "center", gap: "5px", background: "rgba(71,85,105,0.15)", border: "1px solid #334155", color: "#475569", padding: "3px 10px", borderRadius: "20px", fontSize: "10px", fontWeight: "800", flexShrink: 0 },
  badgePendente: { display: "flex", alignItems: "center", gap: "5px", background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.25)", color: "#fbbf24", padding: "3px 10px", borderRadius: "20px", fontSize: "10px", fontWeight: "800", flexShrink: 0 },
  temaTxt:       { fontSize: "13px", fontWeight: "700", color: "#e2e8f0" },
  versaoBadge:   { fontSize: "10px", fontWeight: "700", color: "#818cf8", background: "rgba(99,102,241,0.1)", padding: "2px 8px", borderRadius: "6px" },
  anoBadge:      { fontSize: "10px", fontWeight: "700", color: "#94a3b8", background: "#0f172a", padding: "2px 8px", borderRadius: "6px" },
  fonteStr:      { fontSize: "12px", color: "#475569", flex: 1, minWidth: 0 },
  dataBadge:     { fontSize: "10px", color: "#334155", fontWeight: "600", whiteSpace: "nowrap" },
  btnIcono:      { background: "rgba(255,255,255,0.04)", border: "1px solid #334155", color: "#64748b", width: "30px", height: "30px", borderRadius: "8px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  btnAtivar:     { background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", color: "#34d399", padding: "5px 14px", borderRadius: "8px", cursor: "pointer", fontWeight: "700", fontSize: "11px" },
  btnHistorica:  { background: "rgba(71,85,105,0.1)", border: "1px solid #334155", color: "#64748b", padding: "5px 14px", borderRadius: "8px", cursor: "pointer", fontWeight: "700", fontSize: "11px" },
  btnSeed:       { background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)", color: "#818cf8", padding: "8px 16px", borderRadius: "10px", cursor: "pointer", fontWeight: "700", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" },
  btnNova:       { background: "#4f46e5", border: "none", color: "#fff", padding: "8px 16px", borderRadius: "10px", cursor: "pointer", fontWeight: "700", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" },
  pontosBox:     { marginTop: "12px", background: "#020617", border: "1px solid #1e3251", borderRadius: "10px", padding: "14px 16px" },
  pontosTitle:   { fontSize: "10px", fontWeight: "800", color: "#334155", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "10px" },
  pontoItem:     { display: "flex", gap: "8px", alignItems: "flex-start" },

  // ── VIGILÂNCIA ──────────────────────────────────────────────────────────────
  vigilanciaSection:   { marginTop: "32px", borderTop: "1px solid #1e3251", paddingTop: "28px" },
  vigilanciaHeader:    { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px", gap: "16px", flexWrap: "wrap" },
  vigilanciaTitulo:    { margin: 0, fontSize: "16px", fontWeight: "800", color: "#f1f5f9" },
  vigilanciaSubtitulo: { margin: 0, fontSize: "12px", color: "#475569" },
  vigilanciaBadge:     { background: "#f59e0b", color: "#000", fontSize: "10px", fontWeight: "900", padding: "2px 7px", borderRadius: "20px" },
  vigilanciaStats:     { display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" },
  vigilanciaStatCard:  { background: "#0f172a", border: "1px solid #1e3251", borderRadius: "12px", padding: "12px 18px", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", minWidth: "80px" },
  vigilanciaEmpty:     { textAlign: "center", padding: "40px 20px", background: "#0f172a", borderRadius: "14px", border: "1px dashed #1e3251", display: "flex", flexDirection: "column", alignItems: "center" },
  alertaRow:     { background: "#0f172a", border: "1px solid #1e3251", borderRadius: "14px", padding: "14px 16px" },
  alertaTema:    { fontSize: "13px", fontWeight: "700", color: "#e2e8f0" },
  sevBadge:      { display: "flex", alignItems: "center", gap: "5px", padding: "3px 10px", borderRadius: "20px", fontSize: "10px", fontWeight: "800", flexShrink: 0 },
  origemBadge:   { fontSize: "9px", fontWeight: "800", color: "#475569", background: "#1e293b", padding: "2px 8px", borderRadius: "20px", border: "1px solid #334155" },
  origemDirBadge:{ fontSize: "9px", fontWeight: "800", padding: "2px 7px", borderRadius: "20px" },
  contextoBadge: { fontSize: "9px", fontWeight: "800", padding: "2px 8px", borderRadius: "20px", display: "inline-flex", alignItems: "center", gap: "3px" },
  relevBadge:    { fontSize: "9px", fontWeight: "800", padding: "2px 8px", borderRadius: "20px" },
  manualBadge:   { fontSize: "9px", fontWeight: "800", color: "#f59e0b", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", padding: "2px 8px", borderRadius: "20px" },
  auditRow:      { display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "#475569", background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.1)", borderRadius: "8px", padding: "6px 10px", marginBottom: "4px" },
  btnScan:       { background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.35)", color: "#f59e0b", padding: "9px 16px", borderRadius: "10px", cursor: "pointer", fontWeight: "700", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap" },
  btnLimpar:     { background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", padding: "9px 14px", borderRadius: "10px", cursor: "pointer", fontWeight: "700", fontSize: "11px", display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap" },
  btnVerFonte:   { background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)", color: "#818cf8", padding: "5px 12px", borderRadius: "8px", cursor: "pointer", fontWeight: "700", fontSize: "11px", display: "flex", alignItems: "center", gap: "5px", textDecoration: "none" },
  btnConverter:  { background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", color: "#34d399", padding: "5px 12px", borderRadius: "8px", cursor: "pointer", fontWeight: "700", fontSize: "11px", display: "flex", alignItems: "center", gap: "5px" },
  btnRevisar:    { background: "rgba(99,102,241,0.08)", border: "1px solid #334155", color: "#64748b", padding: "5px 12px", borderRadius: "8px", cursor: "pointer", fontWeight: "700", fontSize: "11px", display: "flex", alignItems: "center", gap: "5px" },
  btnIgnorar:    { background: "none", border: "1px solid #1e3251", color: "#475569", padding: "5px 12px", borderRadius: "8px", cursor: "pointer", fontWeight: "700", fontSize: "11px", display: "flex", alignItems: "center", gap: "5px" },

  // ── MODAL ──────────────────────────────────────────────────────────────────
  overlay:    { position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "20px" },
  modal:      { background: "#1e293b", border: "1px solid #334155", borderRadius: "20px", padding: "28px", width: "100%", maxWidth: "580px", maxHeight: "90vh", overflowY: "auto" },
  modalHeader:{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" },
  alertaHint: { display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#f59e0b", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "10px", padding: "10px 14px", marginBottom: "16px" },
  btnClose:   { background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", width: "30px", height: "30px", borderRadius: "8px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  label:      { display: "block", fontSize: "10px", fontWeight: "800", color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" },
  input:      { width: "100%", background: "#0f172a", border: "1px solid #334155", color: "#fff", padding: "9px 12px", borderRadius: "10px", fontSize: "13px", outline: "none", boxSizing: "border-box" },
  btnCancel:  { background: "none", border: "1px solid #334155", color: "#64748b", padding: "9px 18px", borderRadius: "10px", cursor: "pointer", fontWeight: "700", fontSize: "13px" },
  btnSave:    { background: "#4f46e5", border: "none", color: "#fff", padding: "9px 20px", borderRadius: "10px", cursor: "pointer", fontWeight: "700", fontSize: "13px" },
};
