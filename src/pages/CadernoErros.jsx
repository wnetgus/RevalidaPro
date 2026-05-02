import React, { useState, useEffect, useMemo } from "react";
import { db, auth } from "../firebase";
import { doc, onSnapshot, getDoc, updateDoc, arrayRemove, deleteDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import {
  FaTrashAlt, FaSearch, FaChevronDown,
  FaChevronUp, FaBookOpen, FaStethoscope, FaFlask, FaPlay,
  FaCheckDouble, FaChartPie, FaCheckCircle, FaExclamationTriangle,
  FaFilter, FaFireAlt
} from "react-icons/fa";
import {} from "../modules/simulador/simuladorLogic";

const CadernoErros = () => {
  const navigate = useNavigate();
  const [_idsErros, setIdsErros] = useState([]);
  const [questoesCompletas, setQuestoesCompletas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroMateria, setFiltroMateria] = useState("Todas");
  const [expandido, setExpandido] = useState(null);
  const [confirmarId, setConfirmarId] = useState(null);
  const [busca, setBusca] = useState("");
  const [_isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ✅ LÓGICA ORIGINAL PRESERVADA
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const unsub = onSnapshot(doc(db, "usuarios", user.uid), async (userSnap) => {
      if (userSnap.exists()) {
        const ids = userSnap.data().cadernoErros || [];
        setIdsErros(ids);

        const promessas = ids.map(async (id) => {
          const qSnap = await getDoc(doc(db, "questoes", id));
          return qSnap.exists() ? { id: qSnap.id, ...qSnap.data() } : null;
        });

        const resultados = await Promise.all(promessas);
        setQuestoesCompletas(resultados.filter(q => q !== null));
      }
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // ✅ FILTROS ORIGINAIS PRESERVADOS
  const errosFiltrados = useMemo(() => {
    let lista = filtroMateria === "Todas" ? questoesCompletas : questoesCompletas.filter(q => q.materia === filtroMateria);
    if (busca.trim()) {
      lista = lista.filter(q => (q.enunciado || "").toLowerCase().includes(busca.toLowerCase()) || (q.subtema || "").toLowerCase().includes(busca.toLowerCase()));
    }
    return lista;
  }, [questoesCompletas, filtroMateria, busca]);

  const materiasDisponiveis = useMemo(() => {
    return ["Todas", ...new Set(questoesCompletas.map(q => q.materia).filter(Boolean))];
  }, [questoesCompletas]);

  // ✅ CALCANHAR DE AQUILES ORIGINAL PRESERVADO
  const calcanharDeAquiles = useMemo(() => {
    if (questoesCompletas.length === 0) return null;
    const contagem = {};
    questoesCompletas.forEach(q => { contagem[q.materia] = (contagem[q.materia] || 0) + 1; });
    const topMateria = Object.keys(contagem).reduce((a, b) => contagem[a] > contagem[b] ? a : b);
    const percentual = Math.round((contagem[topMateria] / questoesCompletas.length) * 100);
    if (percentual >= 30 && questoesCompletas.length >= 3) {
      return { materia: topMateria, percentual, total: contagem[topMateria] };
    }
    return null;
  }, [questoesCompletas]);

  // ✅ FUNÇÃO ORIGINAL PRESERVADA
  const treinarErros = () => {
    if (errosFiltrados.length === 0) return;
    navigate("/simulador", {
      state: { questoesCustomizadas: errosFiltrados, modoPersonalizado: true, comTempo: false }
    });
  };

  const removerErro = async (id, e) => {
    e.stopPropagation();
    const uid = auth.currentUser.uid;
    const userRef = doc(db, "usuarios", uid);
    await updateDoc(userRef, { cadernoErros: arrayRemove(id) });
    try {
      await deleteDoc(doc(db, "caderno_erros", `${uid}_${id}`));
    } catch { /* Documento pode não existir, ignorar */ }
    setConfirmarId(null);
  };

  if (loading) return (
    <div style={st.loading}>
      <div className="spinner"></div>
      <p style={{ marginTop: "16px", color: "#64748b", fontSize: "13px" }}>Sincronizando seu progresso médico...</p>
    </div>
  );

  return (
    <div style={st.container}>

      {/* HEADER */}
      <header style={st.header}>
        <div>
          <h1 style={st.titulo}>
            Caderno de Erros
            <span style={st.countBadge}>{questoesCompletas.length}</span>
          </h1>
          <p style={st.sub}>Refine seu conhecimento revisando as questões incorretas.</p>
        </div>
        <div style={st.headerActions}>
          <button onClick={treinarErros} disabled={errosFiltrados.length === 0} style={{
            ...st.btnTreinar,
            opacity: errosFiltrados.length === 0 ? 0.5 : 1,
            cursor: errosFiltrados.length === 0 ? "not-allowed" : "pointer"
          }}>
            <FaPlay size={11} /> TREINAR ERROS ({errosFiltrados.length})
          </button>
          <button onClick={() => navigate("/dashboard")} style={st.btnVoltar}>
            DASHBOARD
          </button>
        </div>
      </header>

      {/* CALCANHAR DE AQUILES */}
      {calcanharDeAquiles && (
        <div style={st.insightBox}>
          <div style={st.insightIcon}><FaFireAlt size={20} color="#fbbf24" /></div>
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: "0 0 4px", color: "#fbbf24", fontSize: "13px", fontWeight: "800" }}>
              ⚠️ Atenção Direcionada
            </h4>
            <p style={{ margin: 0, fontSize: "13px", color: "#f1f5f9", lineHeight: 1.5 }}>
              <strong>{calcanharDeAquiles.percentual}%</strong> dos seus erros estão em{" "}
              <strong style={{ color: "#fff" }}>{calcanharDeAquiles.materia}</strong>.
              Recomendamos revisar esta área com prioridade.
            </p>
          </div>
          <button
            onClick={() => setFiltroMateria(calcanharDeAquiles.materia)}
            style={st.btnFocar}
          >
            FOCAR
          </button>
        </div>
      )}

      {/* FILTROS */}
      <div style={st.filterBar}>
        <div style={st.searchWrapper}>
          <FaSearch color="#64748b" size={13} />
          <input
            type="text"
            placeholder="Buscar por enunciado ou subtema..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            style={st.searchInput}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
          <FaFilter color="#64748b" size={13} />
          <select
            value={filtroMateria}
            onChange={e => setFiltroMateria(e.target.value)}
            style={st.select}
          >
            {materiasDisponiveis.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* LISTA */}
      {errosFiltrados.length === 0 ? (
        <div style={st.emptyState}>
          <FaBookOpen size={48} style={{ marginBottom: 16, opacity: 0.15 }} />
          <p style={{ fontSize: "17px", color: "#fff", margin: "0 0 8px" }}>
            {busca || filtroMateria !== "Todas" ? "Nenhuma questão encontrada com esse filtro." : "Seu caderno de erros está limpo!"}
          </p>
          <small style={{ color: "#64748b" }}>Continue treinando no simulador para identificar pontos de melhoria.</small>
        </div>
      ) : (
        <div style={st.grid}>
          {errosFiltrados.map(q => (
            <div
              key={q.id}
              style={{ ...st.card, borderColor: expandido === q.id ? "#4f46e5" : "#1f2937" }}
              onClick={() => setExpandido(expandido === q.id ? null : q.id)}
            >
              {/* CABEÇALHO DO CARD */}
              <div style={st.cardHeader}>
                <span style={st.tag}>{q.materia} • {q.subtema || "Geral"}</span>

                <div onClick={e => e.stopPropagation()}>
                  {confirmarId === q.id ? (
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button onClick={() => setConfirmarId(null)} style={st.btnCancelarInline}>CANCELAR</button>
                      <button onClick={e => removerErro(q.id, e)} style={st.btnConfirmarInline}>CONFIRMAR</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmarId(q.id)} style={st.btnAprendi}>
                      <FaCheckDouble size={10} /> JÁ APRENDI
                    </button>
                  )}
                </div>
              </div>

              {/* ENUNCIADO */}
              <p style={st.enunciado}>{q.enunciado}</p>

              {/* DETALHES EXPANDIDOS */}
              {expandido === q.id && (
                <div style={st.detalhes} onClick={e => e.stopPropagation()}>

                  {/* ALTERNATIVAS */}
                  <div style={st.alternativasContainer}>
                    <h5 style={{ color: "#94a3b8", margin: "0 0 10px", fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      ALTERNATIVAS DA QUESTÃO:
                    </h5>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {["a", "b", "c", "d", "e"].map((letra, idx) => {
                        const textoAlt = q.alternativas?.[idx] || q[`alternativa${letra.toUpperCase()}`] || q[letra];
                        if (!textoAlt) return null;
                        const isGabarito = (q.gabarito || q.correta || "").toString().toLowerCase() === letra;
                        return (
                          <div key={letra} style={{
                            ...st.altRow,
                            borderColor: isGabarito ? "#10b981" : "#334155",
                            background: isGabarito ? "rgba(16,185,129,0.08)" : "transparent"
                          }}>
                            <div style={{ ...st.letraIcon, background: isGabarito ? "#10b981" : "#1e293b", flexShrink: 0 }}>
                              {letra.toUpperCase()}
                            </div>
                            <span style={{ color: isGabarito ? "#10b981" : "#cbd5e1", fontSize: "13px", flex: 1, lineHeight: 1.5, wordBreak: "break-word" }}>
                              {textoAlt}
                            </span>
                            {isGabarito && <FaCheckCircle color="#10b981" size={14} style={{ flexShrink: 0 }} />}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* RACIOCÍNIO */}
                  <div style={st.infoBox}>
                    <strong style={{ color: "#818cf8", display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
                      <FaStethoscope size={12} /> RACIOCÍNIO TÉCNICO
                    </strong>
                    <p style={{ marginTop: 10, color: "#cbd5e1", fontSize: "13px", lineHeight: 1.7 }}>
                      {q.raciocinio || "Consulte o mestre para a explicação."}
                    </p>
                  </div>

                  {/* CONDUTA */}
                  <div style={{ ...st.infoBox, borderLeft: "4px solid #10b981" }}>
                    <strong style={{ color: "#10b981", display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
                      <FaFlask size={12} /> CONDUTA SUGERIDA
                    </strong>
                    <p style={{ marginTop: 10, color: "#cbd5e1", fontSize: "13px", lineHeight: 1.7 }}>
                      {q.tto || "Protocolo oficial."}
                    </p>
                  </div>

                  {/* BOTÃO TREINAR ESTA QUESTÃO */}
                  <button
                    onClick={() => navigate("/simulador", { state: { questoesCustomizadas: [q], comTempo: false } })}
                    style={st.btnTreinarUma}
                  >
                    <FaPlay size={10} /> TREINAR SÓ ESTA QUESTÃO
                  </button>
                </div>
              )}

              {/* TOGGLE */}
              <div style={st.expandIcon}>
                {expandido === q.id ? <FaChevronUp size={12} /> : <FaChevronDown size={12} />}
                <span style={{ fontSize: "9px", fontWeight: "bold", marginTop: "3px" }}>
                  {expandido === q.id ? "RECOLHER" : "VER DETALHES"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateX(10px); } to { opacity: 1; transform: translateX(0); } }
        * { box-sizing: border-box; }
        html, body { overflow-x: hidden !important; max-width: 100vw !important; }
      `}</style>
    </div>
  );
};

const st = {
  container: { padding: "clamp(16px, 3vw, 40px)", maxWidth: "900px", margin: "0 auto", minHeight: "100vh", background: "#020617", color: "#fff", boxSizing: "border-box" },
  loading: { height: "80vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#020617" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "16px" },
  titulo: { fontSize: "clamp(22px, 4vw, 28px)", fontWeight: "900", margin: 0, display: "flex", alignItems: "center", gap: "10px" },
  countBadge: { background: "#ef4444", color: "#fff", padding: "2px 10px", borderRadius: "8px", fontSize: "12px", fontWeight: "700" },
  sub: { color: "#64748b", fontSize: "13px", margin: "4px 0 0" },
  headerActions: { display: "flex", gap: "10px", flexWrap: "wrap" },
  btnTreinar: { background: "#10b981", color: "#fff", border: "none", padding: "11px 18px", borderRadius: "12px", cursor: "pointer", fontWeight: "700", fontSize: "12px", display: "flex", alignItems: "center", gap: "8px" },
  btnVoltar: { background: "rgba(255,255,255,0.05)", color: "#fff", border: "1px solid #334155", padding: "11px 18px", borderRadius: "12px", cursor: "pointer", fontWeight: "700", fontSize: "12px" },
  insightBox: { display: "flex", alignItems: "center", gap: "14px", background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.25)", padding: "16px 20px", borderRadius: "16px", marginBottom: "24px", flexWrap: "wrap" },
  insightIcon: { background: "rgba(251,191,36,0.15)", padding: "10px", borderRadius: "50%", display: "flex", flexShrink: 0 },
  btnFocar: { background: "#fbbf24", color: "#000", border: "none", padding: "8px 16px", borderRadius: "10px", fontWeight: "800", fontSize: "11px", cursor: "pointer", whiteSpace: "nowrap" },
  filterBar: { display: "flex", gap: "10px", background: "#0f172a", padding: "12px 16px", borderRadius: "14px", marginBottom: "24px", border: "1px solid #1e293b", flexWrap: "wrap", alignItems: "center" },
  searchWrapper: { flex: 1, minWidth: "150px", display: "flex", alignItems: "center", gap: "10px" },
  searchInput: { background: "none", border: "none", color: "#fff", outline: "none", fontSize: "13px", width: "100%" },
  select: { background: "transparent", color: "#fff", border: "none", fontSize: "13px", cursor: "pointer", outline: "none", fontWeight: "600" },
  grid: { display: "grid", gap: "16px" },
  card: { background: "#111827", padding: "clamp(16px, 3vw, 24px)", borderRadius: "20px", border: "1px solid #1f2937", cursor: "pointer", transition: "border-color 0.2s" },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "10px" },
  tag: { background: "rgba(129,140,248,0.1)", padding: "5px 12px", borderRadius: "8px", fontSize: "10px", color: "#818cf8", fontWeight: "800", textTransform: "uppercase" },
  btnAprendi: { background: "rgba(16,185,129,0.1)", border: "1px solid #10b981", color: "#10b981", padding: "6px 12px", borderRadius: "8px", cursor: "pointer", fontSize: "10px", fontWeight: "700", display: "flex", alignItems: "center", gap: "5px" },
  btnCancelarInline: { background: "transparent", border: "none", color: "#94a3b8", fontSize: "10px", fontWeight: "bold", cursor: "pointer", padding: "6px" },
  btnConfirmarInline: { background: "#ef4444", border: "none", color: "#fff", padding: "6px 12px", borderRadius: "8px", fontSize: "10px", fontWeight: "bold", cursor: "pointer" },
  enunciado: { color: "#f1f5f9", fontSize: "clamp(14px, 2.5vw, 16px)", lineHeight: 1.6, margin: 0, wordBreak: "break-word", overflowWrap: "break-word" },
  detalhes: { marginTop: "18px", paddingTop: "18px", borderTop: "1px solid #1f2937", display: "flex", flexDirection: "column", gap: "14px" },
  alternativasContainer: { background: "#0f172a", padding: "14px", borderRadius: "12px", border: "1px solid #1e293b" },
  altRow: { display: "flex", alignItems: "flex-start", gap: "10px", padding: "11px", borderRadius: "8px", border: "1px solid" },
  letraIcon: { width: "24px", height: "24px", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "bold", color: "#fff", marginTop: "1px" },
  infoBox: { background: "#030712", padding: "16px", borderRadius: "12px", borderLeft: "4px solid #4f46e5" },
  btnTreinarUma: { background: "rgba(79,70,229,0.1)", border: "1px solid rgba(79,70,229,0.3)", color: "#818cf8", padding: "10px 18px", borderRadius: "10px", cursor: "pointer", fontSize: "12px", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px", alignSelf: "flex-start" },
  emptyState: { textAlign: "center", padding: "80px 20px", color: "#4b5563", display: "flex", flexDirection: "column", alignItems: "center" },
  expandIcon: { textAlign: "center", marginTop: "14px", color: "#4b5563", display: "flex", flexDirection: "column", alignItems: "center" },
};

export default CadernoErros;
