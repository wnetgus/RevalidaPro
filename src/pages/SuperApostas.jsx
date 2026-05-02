import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { SUPER_APOSTAS_CONFIG } from "../config/superApostasConfig";
import {
  FaFire, FaRocket, FaLayerGroup, FaChevronRight,
  FaSpinner, FaExclamationTriangle, FaCheckSquare, FaSquare
} from "react-icons/fa";

// ─────────────────────────────────────────────────────────────────────────────
// SUPER APOSTAS REVALIDA
// Módulo de simulado estratégico baseado em questões de alta incidência.
// Regra crítica: questões deste módulo NUNCA aparecem em Simulados INEP.
// O isolamento é garantido pelo campo provaId="" em todas as questões do módulo.
// ─────────────────────────────────────────────────────────────────────────────

const { edicoes, edicao_atual, niveis_aposta, areas } = SUPER_APOSTAS_CONFIG;

const SuperApostas = () => {
  const navigate = useNavigate();

  // ─── FILTROS ───────────────────────────────────────────────────────────────
  const [edicaoSel, setEdicaoSel]     = useState(edicao_atual);
  const [areasSel, setAreasSel]       = useState([]);          // [] = todas
  const [niveisSel, setNiveisSel]     = useState([]);          // [] = todos
  const [quantidade, setQuantidade]   = useState(20);

  // ─── ESTADO UI ────────────────────────────────────────────────────────────
  const [loading, setLoading]   = useState(false);
  const [erro, setErro]         = useState("");
  const [totalDisp, setTotalDisp] = useState(null); // preview de questões disponíveis

  // ─── TOGGLE HELPERS ───────────────────────────────────────────────────────
  const toggleItem = (list, setList, valor) =>
    setList(prev => prev.includes(valor) ? prev.filter(v => v !== valor) : [...prev, valor]);

  // ─── CARREGAR PREVIEW (quantidade disponível) ─────────────────────────────
  const carregarPreview = async () => {
    try {
      const snap = await getDocs(
        query(collection(db, "questoes"), where("modulo", "==", "super_apostas"), where("edicao", "==", edicaoSel))
      );
      let lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (areasSel.length > 0) lista = lista.filter(q => areasSel.includes(q.materia));
      if (niveisSel.length > 0) lista = lista.filter(q => niveisSel.includes(q.nivel_aposta));
      setTotalDisp(lista.length);
    } catch {
      setTotalDisp(null);
    }
  };

  // ─── INICIAR SIMULADO ─────────────────────────────────────────────────────
  const iniciarSimulado = async () => {
    setLoading(true);
    setErro("");
    try {
      // Firestore: filtra por módulo + edição (campos indexados)
      const snap = await getDocs(
        query(
          collection(db, "questoes"),
          where("modulo", "==", "super_apostas"),
          where("edicao", "==", edicaoSel)
        )
      );

      let lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Filtros adicionais client-side (áreas e níveis)
      if (areasSel.length > 0)  lista = lista.filter(q => areasSel.includes(q.materia));
      if (niveisSel.length > 0) lista = lista.filter(q => niveisSel.includes(q.nivel_aposta));

      if (lista.length === 0) {
        setErro("Nenhuma questão encontrada para os filtros selecionados. Tente ampliar a seleção de áreas ou níveis.");
        setLoading(false);
        return;
      }

      // Embaralha e limita
      const embaralhada = lista.sort(() => Math.random() - 0.5).slice(0, quantidade);

      const labelEdicao = edicoes.find(e => e.valor === edicaoSel)?.label || edicaoSel;

      navigate("/simulador", {
        state: {
          questoesCustomizadas: embaralhada,
          limiteQuestoes: embaralhada.length,
          simuladoGeral: false,
          modoPersonalizado: false,
          comTempo: false,
          tituloCustom: `🔥 Super Apostas — ${labelEdicao}`,
        },
      });
    } catch (e) {
      console.error("[SuperApostas] Erro ao carregar questões:", e);
      setErro("Erro ao carregar questões. Verifique sua conexão e tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div style={st.page}>
      {/* HERO */}
      <div style={st.hero}>
        <div style={st.heroIcon}><FaFire size={28} color="#ef4444" /></div>
        <div>
          <p style={st.heroEyebrow}>SIMULADO ESTRATÉGICO</p>
          <h1 style={st.heroTitle}>Super Apostas Revalida</h1>
          <p style={st.heroSub}>
            Questões de alta incidência, selecionadas por especialistas, organizadas por nível de probabilidade de cair na prova.
          </p>
        </div>
      </div>

      {/* CARD DE CONFIGURAÇÃO */}
      <div style={st.card}>

        {/* EDIÇÃO */}
        <Section label="📅 EDIÇÃO DO REVALIDA">
          <div style={st.chipRow}>
            {edicoes.map(e => (
              <button
                key={e.valor}
                onClick={() => { setEdicaoSel(e.valor); setTotalDisp(null); }}
                style={edicaoSel === e.valor ? st.chipActive : st.chip}
              >
                {e.label}
              </button>
            ))}
          </div>
        </Section>

        {/* ÁREAS */}
        <Section label="🩺 ÁREAS MÉDICAS" hint="Deixe em branco para incluir todas">
          <div style={st.chipRow}>
            {areas.map(a => {
              const sel = areasSel.includes(a);
              return (
                <button
                  key={a}
                  onClick={() => { toggleItem(areasSel, setAreasSel, a); setTotalDisp(null); }}
                  style={sel ? st.chipActive : st.chip}
                >
                  {sel ? <FaCheckSquare size={10} /> : <FaSquare size={10} style={{ opacity: 0.4 }} />}
                  {a}
                </button>
              );
            })}
          </div>
        </Section>

        {/* NÍVEL DE APOSTA */}
        <Section label="🎯 NÍVEL DE APOSTA" hint="Deixe em branco para incluir todos">
          <div style={st.chipRow}>
            {niveis_aposta.map(n => {
              const sel = niveisSel.includes(n.valor);
              return (
                <button
                  key={n.valor}
                  onClick={() => { toggleItem(niveisSel, setNiveisSel, n.valor); setTotalDisp(null); }}
                  style={sel
                    ? { ...st.chip, background: n.bg, border: `1px solid ${n.cor}`, color: n.cor, fontWeight: "800" }
                    : st.chip
                  }
                >
                  {n.label}
                </button>
              );
            })}
          </div>
        </Section>

        {/* QUANTIDADE */}
        <Section label="📊 QUANTIDADE DE QUESTÕES">
          <div style={st.chipRow}>
            {[10, 20, 30, 50, 100].map(q => (
              <button
                key={q}
                onClick={() => setQuantidade(q)}
                style={quantidade === q ? st.chipActive : st.chip}
              >
                {q} questões
              </button>
            ))}
          </div>
        </Section>

        {/* PREVIEW */}
        <div style={st.previewBar}>
          <button onClick={carregarPreview} style={st.btnPreview} disabled={loading}>
            <FaLayerGroup size={12} /> Ver disponíveis
          </button>
          {totalDisp !== null && (
            <span style={{ color: totalDisp > 0 ? "#10b981" : "#ef4444", fontSize: "12px", fontWeight: "700" }}>
              {totalDisp > 0 ? `✓ ${totalDisp} questões encontradas` : "Nenhuma questão para esses filtros"}
            </span>
          )}
        </div>

        {/* ERRO */}
        {erro && (
          <div style={st.erroBox}>
            <FaExclamationTriangle size={13} color="#ef4444" />
            {erro}
          </div>
        )}

        {/* BOTÃO PRINCIPAL */}
        <button
          onClick={iniciarSimulado}
          disabled={loading}
          style={{ ...st.btnStart, opacity: loading ? 0.7 : 1 }}
        >
          {loading
            ? <><FaSpinner size={14} style={{ animation: "spin 1s linear infinite" }} /> Carregando questões...</>
            : <><FaRocket size={14} /> Iniciar Simulado Estratégico <FaChevronRight size={12} /></>
          }
        </button>

        {/* AVISO DE ISOLAMENTO */}
        <p style={st.aviso}>
          ⚠️ Questões do Super Apostas <strong>não aparecem</strong> em Simulados INEP — Prova Real.
        </p>

      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

// ─── SEÇÃO HELPER ─────────────────────────────────────────────────────────────
const Section = ({ label, hint, children }) => (
  <div style={{ marginBottom: "24px" }}>
    <div style={{ display: "flex", alignItems: "baseline", gap: "10px", marginBottom: "12px" }}>
      <span style={{ fontSize: "10px", fontWeight: "900", color: "#94a3b8", letterSpacing: "1px" }}>{label}</span>
      {hint && <span style={{ fontSize: "10px", color: "#475569" }}>{hint}</span>}
    </div>
    {children}
  </div>
);

// ─── ESTILOS ──────────────────────────────────────────────────────────────────
const st = {
  page: {
    background: "#020617",
    minHeight: "100vh",
    padding: "20px",
    maxWidth: "800px",
    margin: "0 auto",
  },
  hero: {
    display: "flex",
    alignItems: "flex-start",
    gap: "20px",
    background: "linear-gradient(135deg, rgba(239,68,68,0.1) 0%, rgba(239,68,68,0.03) 100%)",
    border: "1px solid rgba(239,68,68,0.25)",
    borderRadius: "20px",
    padding: "24px",
    marginBottom: "20px",
  },
  heroIcon: {
    width: "56px",
    height: "56px",
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: "16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  heroEyebrow: {
    fontSize: "10px",
    fontWeight: "900",
    color: "#ef4444",
    letterSpacing: "2px",
    margin: "0 0 6px",
  },
  heroTitle: {
    color: "#fff",
    fontSize: "22px",
    fontWeight: "900",
    margin: "0 0 8px",
  },
  heroSub: {
    color: "#94a3b8",
    fontSize: "13px",
    margin: 0,
    lineHeight: 1.5,
  },
  card: {
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "20px",
    padding: "28px",
  },
  chipRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  chip: {
    background: "#0f172a",
    border: "1px solid #334155",
    color: "#94a3b8",
    padding: "8px 14px",
    borderRadius: "10px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "600",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    transition: "0.15s",
  },
  chipActive: {
    background: "rgba(79,70,229,0.15)",
    border: "1px solid #4f46e5",
    color: "#818cf8",
    padding: "8px 14px",
    borderRadius: "10px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "800",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    transition: "0.15s",
  },
  previewBar: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    marginBottom: "16px",
  },
  btnPreview: {
    background: "none",
    border: "1px solid #334155",
    color: "#64748b",
    padding: "6px 14px",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "11px",
    fontWeight: "700",
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  erroBox: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    background: "rgba(239,68,68,0.08)",
    border: "1px solid rgba(239,68,68,0.25)",
    borderRadius: "10px",
    padding: "12px 14px",
    color: "#ef4444",
    fontSize: "12px",
    marginBottom: "16px",
  },
  btnStart: {
    width: "100%",
    background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
    color: "#fff",
    border: "none",
    padding: "16px 24px",
    borderRadius: "14px",
    fontWeight: "900",
    fontSize: "14px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    letterSpacing: "0.5px",
    boxShadow: "0 8px 25px rgba(239,68,68,0.3)",
    transition: "0.2s",
  },
  aviso: {
    textAlign: "center",
    color: "#475569",
    fontSize: "11px",
    marginTop: "14px",
    marginBottom: 0,
  },
};

export default SuperApostas;
