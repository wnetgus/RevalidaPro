import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import {
  FaStethoscope, FaSyringe, FaBaby, FaVenusMars,
  FaUserShield, FaClock, FaListOl, FaPlayCircle,
  FaShieldAlt, FaChartBar, FaArrowLeft
} from "react-icons/fa";

// ─── Distribuição oficial Fase 1 Revalida INEP ────────────────────────────────
const DISTRIBUICAO = [
  { materia: "Clínica Médica",             qtd: 40, cor: "#818cf8", icon: <FaStethoscope /> },
  { materia: "Cirurgia",                   qtd: 20, cor: "#f87171", icon: <FaSyringe /> },
  { materia: "Pediatria",                  qtd: 20, cor: "#34d399", icon: <FaBaby /> },
  { materia: "Ginecologia e Obstetrícia",  qtd: 20, cor: "#f472b6", icon: <FaVenusMars /> },
  { materia: "Preventiva",                 qtd: 20, cor: "#fbbf24", icon: <FaUserShield /> },
];
const TEMPO_OFICIAL = 4 * 60 * 60; // 4 horas em segundos

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const SimuladoOficial = () => {
  const navigate = useNavigate();
  const [carregando, setCarregando] = useState(false);
  const [progresso, setProgresso] = useState({ etapa: "", pct: 0 });
  const [erro, setErro] = useState("");

  const iniciarSimulado = async () => {
    setCarregando(true);
    setErro("");
    try {
      const qRef = collection(db, "questoes");
      let todasQuestoes = [];
      let totalEsperado = 0;

      for (let i = 0; i < DISTRIBUICAO.length; i++) {
        const { materia, qtd } = DISTRIBUICAO[i];
        setProgresso({ etapa: materia, pct: Math.round((i / DISTRIBUICAO.length) * 90) });

        const snap = await getDocs(query(qRef, where("materia", "==", materia)));
        let lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Anti-repetição opcional (melhor experiência, não bloqueia se não houver questões suficientes)
        if (auth.currentUser) {
          try {
            const { getDocs: gd, collection: col, query: q2, orderBy: ob, limit: lm } = await import("firebase/firestore");
            const resRef = col(db, "usuarios", auth.currentUser.uid, "respostas");
            const snapR = await gd(q2(resRef, ob("data", "desc"), lm(300)));
            const respondidos = new Set(snapR.docs.map(d => d.data().questaoId).filter(Boolean));
            const nova = lista.filter(q => !respondidos.has(q.id));
            if (nova.length >= qtd) lista = nova;
          } catch (_) { /* silencioso */ }
        }

        lista = shuffleArray(lista).slice(0, qtd);
        todasQuestoes = [...todasQuestoes, ...lista];
        totalEsperado += qtd;
      }

      setProgresso({ etapa: "Montando simulado...", pct: 95 });

      // Alerta se banco não tem questões suficientes
      if (todasQuestoes.length < totalEsperado * 0.5) {
        setErro(`Banco insuficiente: ${todasQuestoes.length} questões disponíveis. Adicione mais questões pelo AdminPainel.`);
        setCarregando(false);
        return;
      }

      // Embaralha a lista final (para não agrupar por matéria)
      const final = shuffleArray(todasQuestoes);
      setProgresso({ etapa: "Pronto!", pct: 100 });

      // Navega para o Simulador com questões pré-selecionadas e tempo oficial
      navigate("/simulador", {
        state: {
          questoesCustomizadas: final,
          comTempo: true,
          tempoCustom: TEMPO_OFICIAL,
          modoOficial: true,
        }
      });
    } catch (err) {
      console.error(err);
      setErro("Erro ao carregar questões. Tente novamente.");
      setCarregando(false);
    }
  };

  return (
    <div style={s.page}>
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <div style={s.topBar}>
        <button onClick={() => navigate("/")} style={s.btnVoltar}>
          <FaArrowLeft size={12} /> Voltar
        </button>
        <span style={s.topTag}>🏥 SIMULADO OFICIAL</span>
      </div>

      <div style={s.inner}>
        {/* ─── Título ─────────────────────────────────────────────── */}
        <div style={s.heroBlock}>
          <div style={s.heroBadge}>REVALIDA INEP — FASE 1</div>
          <h1 style={s.heroH1}>Simulado Oficial Completo</h1>
          <p style={s.heroSub}>
            Replica com exatidão o formato da prova real: 120 questões,
            distribuição oficial por área e cronômetro de 4 horas.
          </p>
        </div>

        {/* ─── Cards de info ──────────────────────────────────────── */}
        <div style={s.infoRow}>
          <div style={s.infoCard}>
            <FaListOl size={20} color="#818cf8" />
            <span style={s.infoNum}>120</span>
            <span style={s.infoLabel}>Questões</span>
          </div>
          <div style={s.infoCard}>
            <FaClock size={20} color="#34d399" />
            <span style={s.infoNum}>4h</span>
            <span style={s.infoLabel}>Cronômetro</span>
          </div>
          <div style={s.infoCard}>
            <FaChartBar size={20} color="#f97316" />
            <span style={s.infoNum}>5</span>
            <span style={s.infoLabel}>Áreas</span>
          </div>
          <div style={s.infoCard}>
            <FaShieldAlt size={20} color="#fbbf24" />
            <span style={s.infoNum}>INEP</span>
            <span style={s.infoLabel}>Formato</span>
          </div>
        </div>

        {/* ─── Distribuição por área ──────────────────────────────── */}
        <div style={s.distCard}>
          <p style={s.distTitle}>Distribuição oficial por área</p>
          <div style={s.distGrid}>
            {DISTRIBUICAO.map(({ materia, qtd, cor, icon }) => (
              <div key={materia} style={{ ...s.distItem, borderColor: cor + "44" }}>
                <div style={{ ...s.distIcon, background: cor + "18", color: cor }}>{icon}</div>
                <div>
                  <p style={{ ...s.distMateria, color: cor }}>{materia}</p>
                  <p style={s.distQtd}>{qtd} questões</p>
                </div>
                <div style={{ ...s.distBadge, background: cor + "18", color: cor }}>
                  {Math.round((qtd / 120) * 100)}%
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Instruções ─────────────────────────────────────────── */}
        <div style={s.instrCard}>
          <p style={s.instrTitle}>⚠️ Antes de começar</p>
          <ul style={s.instrList}>
            <li>O cronômetro de <strong>4 horas</strong> inicia imediatamente ao entrar.</li>
            <li>As questões são embaralhadas — mesma sensação da prova real.</li>
            <li>Você pode sair e retomar — o progresso é salvo automaticamente.</li>
            <li>Ao finalizar, você verá seu desempenho detalhado por área.</li>
            <li>Indicado para fazer <strong>1 simulado completo por semana</strong> nas últimas 4 semanas antes da prova.</li>
          </ul>
        </div>

        {/* ─── Erro ───────────────────────────────────────────────── */}
        {erro && (
          <div style={s.erroBox}>⚠️ {erro}</div>
        )}

        {/* ─── Botão iniciar / Loading ─────────────────────────────── */}
        {carregando ? (
          <div style={s.loadBox}>
            <div style={s.loadBar}>
              <div style={{ ...s.loadFill, width: `${progresso.pct}%` }} />
            </div>
            <p style={s.loadLabel}>
              {progresso.pct < 100 ? `Carregando ${progresso.etapa}...` : "Iniciando..."}
              <span style={{ color: "#818cf8", marginLeft: "8px" }}>{progresso.pct}%</span>
            </p>
          </div>
        ) : (
          <button onClick={iniciarSimulado} style={s.btnIniciar}>
            <FaPlayCircle size={18} /> Iniciar Simulado Oficial
          </button>
        )}

        <p style={s.nota}>
          As questões são selecionadas aleatoriamente do banco — evitando repetições recentes.
        </p>
      </div>
    </div>
  );
};

// ─── Estilos ────────────────────────────────────────────────────────────────
const s = {
  page: { background: "#020617", minHeight: "100vh", color: "#f1f5f9", fontFamily: "'Inter', sans-serif" },
  topBar: { display: "flex", alignItems: "center", gap: "16px", padding: "20px 32px", borderBottom: "1px solid #0f172a" },
  btnVoltar: { background: "transparent", border: "1px solid #1e293b", color: "#64748b", padding: "7px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" },
  topTag: { fontSize: "11px", fontWeight: "900", color: "#818cf8", letterSpacing: "1px" },

  inner: { maxWidth: "760px", margin: "0 auto", padding: "40px 24px 80px" },

  heroBlock: { textAlign: "center", marginBottom: "40px" },
  heroBadge: { display: "inline-block", fontSize: "10px", fontWeight: "900", color: "#818cf8", background: "rgba(129,140,248,0.12)", border: "1px solid rgba(129,140,248,0.25)", borderRadius: "6px", padding: "4px 12px", letterSpacing: "1px", marginBottom: "16px" },
  heroH1: { fontSize: "32px", fontWeight: "900", letterSpacing: "-1px", marginBottom: "12px", lineHeight: 1.2 },
  heroSub: { fontSize: "15px", color: "#64748b", lineHeight: 1.65, maxWidth: "520px", margin: "0 auto" },

  infoRow: { display: "flex", gap: "12px", justifyContent: "center", marginBottom: "32px", flexWrap: "wrap" },
  infoCard: { background: "#0f172a", border: "1px solid #1e293b", borderRadius: "12px", padding: "20px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", minWidth: "100px", flex: "1 1 90px", maxWidth: "140px" },
  infoNum: { fontSize: "24px", fontWeight: "900", color: "#f1f5f9", lineHeight: 1 },
  infoLabel: { fontSize: "10px", color: "#475569", fontWeight: "700", letterSpacing: "0.5px", textTransform: "uppercase" },

  distCard: { background: "#0f172a", border: "1px solid #1e293b", borderRadius: "14px", padding: "24px", marginBottom: "20px" },
  distTitle: { fontSize: "11px", fontWeight: "900", color: "#475569", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "16px" },
  distGrid: { display: "flex", flexDirection: "column", gap: "10px" },
  distItem: { display: "flex", alignItems: "center", gap: "14px", background: "#070f1e", border: "1px solid", borderRadius: "10px", padding: "12px 16px" },
  distIcon: { width: "36px", height: "36px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  distMateria: { fontSize: "13px", fontWeight: "800", marginBottom: "2px" },
  distQtd: { fontSize: "11px", color: "#475569" },
  distBadge: { marginLeft: "auto", fontSize: "11px", fontWeight: "900", padding: "3px 10px", borderRadius: "6px", flexShrink: 0 },

  instrCard: { background: "rgba(251,191,36,0.04)", border: "1px solid rgba(251,191,36,0.15)", borderRadius: "14px", padding: "20px 24px", marginBottom: "28px" },
  instrTitle: { fontSize: "12px", fontWeight: "900", color: "#fbbf24", marginBottom: "12px", letterSpacing: "0.5px" },
  instrList: { paddingLeft: "18px", display: "flex", flexDirection: "column", gap: "8px" },

  erroBox: { background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "10px", padding: "14px 18px", color: "#f87171", fontSize: "13px", marginBottom: "20px" },

  loadBox: { marginBottom: "12px" },
  loadBar: { height: "6px", background: "#1e293b", borderRadius: "6px", overflow: "hidden", marginBottom: "10px" },
  loadFill: { height: "100%", background: "linear-gradient(90deg, #4f46e5, #818cf8)", borderRadius: "6px", transition: "width 0.4s ease" },
  loadLabel: { fontSize: "13px", color: "#64748b", textAlign: "center" },

  btnIniciar: { width: "100%", padding: "16px", background: "linear-gradient(135deg, #4f46e5, #7c3aed)", border: "none", borderRadius: "14px", color: "#fff", fontSize: "16px", fontWeight: "900", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", boxShadow: "0 8px 32px rgba(79,70,229,0.35)", marginBottom: "12px" },
  nota: { textAlign: "center", fontSize: "11px", color: "#334155" },
};

export default SimuladoOficial;
