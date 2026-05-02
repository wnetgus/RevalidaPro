import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaLayerGroup, FaPlay, FaCheckCircle, FaListOl,
  FaHourglassHalf, FaBookOpen, FaStethoscope, FaSyringe,
  FaBaby, FaVenusMars, FaUserShield, FaArrowLeft, FaBolt
} from "react-icons/fa";

const PrepararSimulado = () => {
  const navigate = useNavigate();
  const [qtd, setQtd] = useState(20);
  const [comTempo, setComTempo] = useState(true);
  const [materiasSelected, setMateriasSelected] = useState([
    "Clínica Médica", "Cirurgia", "Pediatria", "Ginecologia e Obstetrícia", "Preventiva"
  ]);

  // ✅ LÓGICA ORIGINAL PRESERVADA
  const materiasInfo = [
    { id: "Clínica Médica", icon: <FaStethoscope />, color: "#818cf8", desc: "Cardiologia, Pneumo, Neuro..." },
    { id: "Cirurgia", icon: <FaSyringe />, color: "#f87171", desc: "Abdome, Trauma, Ortopedia..." },
    { id: "Pediatria", icon: <FaBaby />, color: "#34d399", desc: "Neonato, Crescimento, Vacinação..." },
    { id: "Ginecologia e Obstetrícia", icon: <FaVenusMars />, color: "#f472b6", desc: "Pré-natal, Gineco, Parto..." },
    { id: "Preventiva", icon: <FaUserShield />, color: "#fbbf24", desc: "Epidemio, Vigilância, SUS..." }
  ];

  // ✅ LÓGICA ORIGINAL PRESERVADA
  const toggleMateria = (id) => {
    if (materiasSelected.includes(id)) {
      if (materiasSelected.length > 1) setMateriasSelected(materiasSelected.filter(m => m !== id));
    } else {
      setMateriasSelected([...materiasSelected, id]);
    }
  };

  // ✅ LÓGICA ORIGINAL PRESERVADA
  const iniciarSimulado = () => {
    navigate("/simulador", {
      state: {
        materiasFiltro: materiasSelected,
        limiteQuestoes: qtd,
        modoPersonalizado: true,
        comTempo: comTempo
      }
    });
  };

  const todasSelecionadas = materiasSelected.length === materiasInfo.length;

  const toggleTodas = () => {
    if (todasSelecionadas) {
      setMateriasSelected([materiasInfo[0].id]);
    } else {
      setMateriasSelected(materiasInfo.map(m => m.id));
    }
  };

  const tempoEstimado = () => {
    const minutos = Math.round((qtd * 144) / 60);
    if (minutos < 60) return `${minutos} min`;
    return `${Math.floor(minutos / 60)}h${minutos % 60 > 0 ? ` ${minutos % 60}min` : ""}`;
  };

  return (
    <div style={st.container}>
      <div style={st.card}>

        {/* HEADER */}
        <header style={st.header}>
          <button onClick={() => navigate("/")} style={st.btnVoltar}>
            <FaArrowLeft size={12} />
          </button>
          <div style={st.headerContent}>
            <div style={st.iconBox}><FaLayerGroup size={20} color="#fff" /></div>
            <div>
              <h2 style={st.title}>SALA DE PREPARO</h2>
              <p style={st.subtitle}>Configure seu simulado personalizado.</p>
            </div>
          </div>
        </header>

        {/* SEÇÃO 1: QUANTIDADE */}
        <section style={st.section}>
          <label style={st.label}><FaListOl size={11} /> QUANTIDADE DE QUESTÕES</label>
          <div style={st.gridQtd}>
            {[10, 20, 50, 100].map(n => (
              <button
                key={n}
                onClick={() => setQtd(n)}
                style={{
                  ...st.btnQtd,
                  background: qtd === n ? "linear-gradient(135deg, #4f46e5, #4338ca)" : "rgba(255,255,255,0.03)",
                  borderColor: qtd === n ? "#818cf8" : "rgba(255,255,255,0.1)",
                  color: qtd === n ? "#fff" : "#94a3b8",
                  boxShadow: qtd === n ? "0 6px 16px rgba(79,70,229,0.3)" : "none"
                }}
              >
                <span style={{ fontSize: "20px", fontWeight: "900" }}>{n}</span>
                <span style={{ fontSize: "11px", opacity: 0.7 }}>Questões</span>
              </button>
            ))}
          </div>
        </section>

        {/* SEÇÃO 2: MODO */}
        <section style={st.section}>
          <label style={st.label}><FaHourglassHalf size={11} /> MODO DE EXECUÇÃO</label>
          <div style={st.gridModo}>
            <div
              onClick={() => setComTempo(true)}
              style={{
                ...st.modoCard,
                borderColor: comTempo ? "#4f46e5" : "rgba(255,255,255,0.08)",
                background: comTempo ? "rgba(79,70,229,0.1)" : "rgba(255,255,255,0.02)"
              }}
            >
              <div style={{ ...st.modoIcon, background: comTempo ? "#4f46e5" : "#1e293b" }}>
                <FaHourglassHalf color={comTempo ? "#fff" : "#64748b"} size={16} />
              </div>
              <div>
                <strong style={{ display: "block", fontSize: "13px", color: comTempo ? "#fff" : "#94a3b8", fontWeight: "800" }}>
                  MODO SIMULADO
                </strong>
                <small style={{ fontSize: "11px", color: "#64748b" }}>Cronômetro INEP · {tempoEstimado()}</small>
              </div>
              {comTempo && <FaCheckCircle color="#4f46e5" size={14} style={{ marginLeft: "auto" }} />}
            </div>

            <div
              onClick={() => setComTempo(false)}
              style={{
                ...st.modoCard,
                borderColor: !comTempo ? "#10b981" : "rgba(255,255,255,0.08)",
                background: !comTempo ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.02)"
              }}
            >
              <div style={{ ...st.modoIcon, background: !comTempo ? "#10b981" : "#1e293b" }}>
                <FaBookOpen color={!comTempo ? "#fff" : "#64748b"} size={16} />
              </div>
              <div>
                <strong style={{ display: "block", fontSize: "13px", color: !comTempo ? "#fff" : "#94a3b8", fontWeight: "800" }}>
                  ESTUDO LIVRE
                </strong>
                <small style={{ fontSize: "11px", color: "#64748b" }}>Sem pressão de tempo</small>
              </div>
              {!comTempo && <FaCheckCircle color="#10b981" size={14} style={{ marginLeft: "auto" }} />}
            </div>
          </div>
        </section>

        {/* SEÇÃO 3: MATÉRIAS */}
        <section style={st.section}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <label style={{ ...st.label, margin: 0 }}><FaCheckCircle size={11} /> ÁREAS ({materiasSelected.length}/{materiasInfo.length})</label>
            <button onClick={toggleTodas} style={st.btnTodas}>
              {todasSelecionadas ? "DESMARCAR TODAS" : "SELECIONAR TODAS"}
            </button>
          </div>

          <div style={st.gridMaterias}>
            {materiasInfo.map(m => {
              const selecionada = materiasSelected.includes(m.id);
              return (
                <div
                  key={m.id}
                  onClick={() => toggleMateria(m.id)}
                  style={{
                    ...st.materiaCard,
                    borderColor: selecionada ? m.color : "rgba(255,255,255,0.08)",
                    background: selecionada ? `${m.color}14` : "rgba(255,255,255,0.02)"
                  }}
                >
                  <div style={{ ...st.materiaIcon, background: selecionada ? `${m.color}25` : "#1e293b" }}>
                    {React.cloneElement(m.icon, { color: selecionada ? m.color : "#64748b", size: 16 })}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ color: selecionada ? "#f8fafc" : "#94a3b8", fontSize: "13px", fontWeight: "700", display: "block" }}>
                      {m.id.split(" ")[0]}
                    </span>
                    <small style={{ color: "#64748b", fontSize: "10px" }}>{m.desc}</small>
                  </div>
                  {selecionada && <FaCheckCircle color={m.color} size={13} style={{ flexShrink: 0 }} />}
                </div>
              );
            })}
          </div>
        </section>

        {/* RESUMO E BOTÃO INICIAR */}
        <div style={st.resumoBar}>
          <div style={st.resumoInfo}>
            <span style={st.resumoItem}><strong style={{ color: "#fff" }}>{qtd}</strong> questões</span>
            <span style={{ color: "#334155" }}>·</span>
            <span style={st.resumoItem}><strong style={{ color: "#fff" }}>{materiasSelected.length}</strong> áreas</span>
            <span style={{ color: "#334155" }}>·</span>
            <span style={st.resumoItem}>
              {comTempo
                ? <><strong style={{ color: "#818cf8" }}>{tempoEstimado()}</strong> estimados</>
                : <strong style={{ color: "#10b981" }}>livre</strong>
              }
            </span>
          </div>
        </div>

        <button onClick={iniciarSimulado} style={st.btnStart}>
          <FaBolt size={16} />
          INICIAR TREINAMENTO
        </button>
      </div>

      <style>{`
        * { box-sizing: border-box; }
        @media (max-width: 768px) {
          .prep-grid-qtd { grid-template-columns: 1fr 1fr !important; }
          .prep-grid-modo { grid-template-columns: 1fr !important; }
          .prep-grid-mat { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
};

const st = {
  container: { padding: "clamp(16px, 3vw, 40px)", minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "flex-start", background: "#020617", paddingBottom: "60px" },
  card: { background: "linear-gradient(145deg, #111827 0%, #0f172a 100%)", padding: "clamp(22px, 4vw, 40px)", borderRadius: "28px", border: "1px solid #1f2937", width: "100%", maxWidth: "640px", boxShadow: "0 25px 50px rgba(0,0,0,0.5)" },
  header: { display: "flex", alignItems: "center", gap: "16px", marginBottom: "32px" },
  btnVoltar: { background: "rgba(255,255,255,0.05)", border: "1px solid #334155", color: "#94a3b8", padding: "10px", borderRadius: "12px", cursor: "pointer", display: "flex", alignItems: "center", flexShrink: 0 },
  headerContent: { display: "flex", alignItems: "center", gap: "16px", flex: 1 },
  iconBox: { background: "linear-gradient(135deg, #4f46e5, #4338ca)", padding: "14px", borderRadius: "16px", boxShadow: "0 8px 20px rgba(79,70,229,0.35)", display: "flex", flexShrink: 0 },
  title: { margin: 0, color: "#fff", fontSize: "clamp(16px, 3vw, 22px)", fontWeight: "900", letterSpacing: "-0.3px" },
  subtitle: { margin: "3px 0 0", color: "#94a3b8", fontSize: "12px" },
  section: { marginBottom: "28px" },
  label: { color: "#818cf8", fontSize: "11px", fontWeight: "800", letterSpacing: "1px", display: "flex", alignItems: "center", gap: "7px", marginBottom: "14px", textTransform: "uppercase" },
  gridQtd: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" },
  btnQtd: { padding: "16px 8px", borderRadius: "14px", border: "1px solid", cursor: "pointer", fontWeight: "900", transition: "all 0.2s", display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" },
  gridModo: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" },
  modoCard: { padding: "16px", borderRadius: "16px", border: "2px solid", cursor: "pointer", display: "flex", alignItems: "center", gap: "12px", transition: "all 0.2s" },
  modoIcon: { padding: "10px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  btnTodas: { background: "none", border: "1px solid #334155", color: "#64748b", padding: "6px 12px", borderRadius: "8px", cursor: "pointer", fontSize: "10px", fontWeight: "800", letterSpacing: "0.3px" },
  gridMaterias: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" },
  materiaCard: { padding: "14px", borderRadius: "14px", border: "2px solid", cursor: "pointer", display: "flex", alignItems: "center", gap: "12px", transition: "all 0.2s" },
  materiaIcon: { padding: "9px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  resumoBar: { background: "rgba(255,255,255,0.03)", border: "1px solid #334155", borderRadius: "14px", padding: "14px 18px", marginBottom: "20px" },
  resumoInfo: { display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", justifyContent: "center" },
  resumoItem: { color: "#64748b", fontSize: "13px" },
  btnStart: { width: "100%", padding: "18px", borderRadius: "18px", background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff", border: "none", fontSize: "15px", fontWeight: "900", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", boxShadow: "0 12px 28px rgba(16,185,129,0.3)", transition: "all 0.2s", letterSpacing: "0.5px" },
};

export default PrepararSimulado;
