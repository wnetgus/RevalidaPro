import React, { useState, useEffect, useMemo } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, query, orderBy, doc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import {
  FaSearch, FaBookMedical, FaStethoscope, FaLightbulb,
  FaBookOpen, FaTimes, FaStar, FaNotesMedical, FaRegStar,
  FaChevronLeft, FaFilter, FaCheckCircle
} from "react-icons/fa";

const Biblioteca = ({ usuario }) => {
  const [temas, setTemas] = useState([]);
  const [busca, setBusca] = useState("");
  const [filtroMateria, setFiltroMateria] = useState("Todos");
  const [filtroModulo, setFiltroModulo] = useState("Todos"); // "Todos" | "inep" | "super_apostas"
  const [temaSelecionado, setTemaSelecionado] = useState(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [mostrandoLista, setMostrandoLista] = useState(true);

  const listaMaterias = ["Todos", "Clínica Médica", "Cirurgia", "Pediatria", "Ginecologia e Obstetrícia", "Preventiva"];

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setMostrandoLista(true);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ✅ LÓGICA ORIGINAL PRESERVADA
  useEffect(() => {
    const buscarDados = async () => {
      try {
        const q = query(collection(db, "questoes"), orderBy("materia"));
        const snap = await getDocs(q);
        const dados = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setTemas(dados);
      } catch (e) {
        console.error("Erro biblioteca:", e);
      } finally {
        setLoading(false);
      }
    };
    buscarDados();
  }, []);

  // Helper retrocompatível: detecta módulo mesmo em questões antigas (sem campo modulo)
  const getModuloTema = (t) => {
    if (t.modulo === "super_apostas") return "super_apostas";
    if (t.isOficial === true || (t.provaId && t.provaId !== "") || t.instituicao === "INEP") return "inep";
    return "banco_geral";
  };

  const temasFiltrados = useMemo(() => {
    return temas.filter(t => {
      const conteudoBusca = `${t.enunciado} ${t.subtema} ${t.raciocinio || ""}`.toLowerCase();
      const matchBusca   = conteudoBusca.includes(busca.toLowerCase());
      const matchMateria = filtroMateria === "Todos" || t.materia === filtroMateria;
      const matchModulo  = filtroModulo  === "Todos" || getModuloTema(t) === filtroModulo;
      return matchBusca && matchMateria && matchModulo;
    });
  }, [temas, busca, filtroMateria, filtroModulo]);

  // ✅ LÓGICA DE FAVORITOS ORIGINAL PRESERVADA
  const isFavorito = temaSelecionado && usuario?.favoritos?.includes(temaSelecionado.id);

  const toggleFavorito = async () => {
    if (!temaSelecionado || !auth.currentUser) return;
    setSalvando(true);
    try {
      const userRef = doc(db, "usuarios", auth.currentUser.uid);
      if (isFavorito) {
        await updateDoc(userRef, { favoritos: arrayRemove(temaSelecionado.id) });
      } else {
        await updateDoc(userRef, { favoritos: arrayUnion(temaSelecionado.id) });
      }
    } catch (e) {
      console.error("Erro ao favoritar:", e);
    }
    setSalvando(false);
  };

  const selecionarTema = (t) => {
    setTemaSelecionado(t);
    if (isMobile) setMostrandoLista(false);
  };

  const voltarParaLista = () => {
    setMostrandoLista(true);
    setTemaSelecionado(null);
  };

  const getMateriaColor = (mat) => {
    const cores = {
      "Clínica Médica": "#818cf8",
      "Cirurgia": "#f87171",
      "Pediatria": "#34d399",
      "Ginecologia e Obstetrícia": "#f472b6",
      "Preventiva": "#fbbf24"
    };
    return cores[mat] || "#64748b";
  };

  if (loading) return (
    <div style={st.loadingStyle}>
      <div className="spinner"></div>
      <p style={{ marginTop: "16px", color: "#4f46e5", fontWeight: "700", fontSize: "13px" }}>
        Sincronizando Base de Conhecimento...
      </p>
    </div>
  );

  return (
    <div style={st.containerStyle}>

      {/* HEADER */}
      <header style={st.headerStyle}>
        <div>
          <h1 style={st.titleStyle}>
            Biblioteca <span style={{ color: "#4f46e5" }}>Digital de Elite</span>
          </h1>
          <p style={st.subtitleStyle}>
            {temasFiltrados.length} temas disponíveis · Consulte raciocínios e condutas de alto nível.
          </p>
        </div>

        {/* BUSCA */}
        <div style={st.searchWrapperStyle}>
          <FaSearch style={st.searchIconStyle} size={14} />
          <input
            type="text"
            placeholder="Buscar por tema, subtema..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            style={st.searchInputStyle}
          />
          {busca && (
            <button onClick={() => setBusca("")} style={st.btnClearSearch}>
              <FaTimes size={12} color="#64748b" />
            </button>
          )}
        </div>
      </header>

      {/* FILTROS DE MATÉRIA */}
      <div style={st.filterBarStyle}>
        {listaMaterias.map(m => (
          <button
            key={m}
            onClick={() => setFiltroMateria(m)}
            style={{
              ...st.filterBadgeStyle,
              background: filtroMateria === m ? "#4f46e5" : "#1e293b",
              color: filtroMateria === m ? "#fff" : "#94a3b8",
              borderColor: filtroMateria === m ? "#4f46e5" : "#334155",
              boxShadow: filtroMateria === m ? "0 4px 12px rgba(79,70,229,0.3)" : "none"
            }}
          >
            {filtroMateria === m && <FaCheckCircle size={10} />}
            {m === "Todos" ? "Todos" : m.split(" ")[0]}
          </button>
        ))}
      </div>

      {/* FILTRO DE MÓDULO — leve, opcional */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: "10px", color: "#475569", fontWeight: "700", letterSpacing: "0.5px" }}>ORIGEM:</span>
        {[
          { val: "Todos",        label: "Todas"         },
          { val: "inep",         label: "🏛️ INEP"       },
          { val: "super_apostas",label: "🔥 Super Apostas"},
        ].map(op => (
          <button
            key={op.val}
            onClick={() => setFiltroModulo(op.val)}
            style={{
              background: filtroModulo === op.val ? (op.val === "super_apostas" ? "rgba(239,68,68,0.15)" : op.val === "inep" ? "rgba(129,140,248,0.15)" : "#4f46e5") : "#1e293b",
              color: filtroModulo === op.val ? (op.val === "super_apostas" ? "#ef4444" : op.val === "inep" ? "#818cf8" : "#fff") : "#64748b",
              border: `1px solid ${filtroModulo === op.val ? (op.val === "super_apostas" ? "rgba(239,68,68,0.4)" : op.val === "inep" ? "rgba(129,140,248,0.4)" : "#4f46e5") : "#334155"}`,
              padding: "5px 12px",
              borderRadius: "8px",
              fontSize: "11px",
              fontWeight: "700",
              cursor: "pointer",
            }}
          >
            {op.label}
          </button>
        ))}
        {filtroModulo !== "Todos" && (
          <span style={{ fontSize: "10px", color: "#475569", marginLeft: "4px" }}>
            — {temasFiltrados.length} questão(ões)
          </span>
        )}
      </div>

      {/* LAYOUT PRINCIPAL */}
      <div style={{
        ...st.layoutGridStyle,
        flexDirection: isMobile ? "column" : "row"
      }}>

        {/* LISTA DE TEMAS — esconde no mobile quando lendo */}
        {(!isMobile || mostrandoLista) && (
          <aside style={{
            ...st.listAsideStyle,
            width: isMobile ? "100%" : "360px",
            maxHeight: isMobile ? "50vh" : "calc(100vh - 280px)"
          }}>
            <div style={st.listHeader}>
              <span>{temasFiltrados.length} TEMAS ENCONTRADOS</span>
            </div>

            {temasFiltrados.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "#64748b" }}>
                <FaBookOpen size={32} style={{ opacity: 0.2, marginBottom: "12px" }} />
                <p style={{ fontSize: "14px" }}>Nenhum tema encontrado.</p>
              </div>
            ) : (
              temasFiltrados.map(t => (
                <div
                  key={t.id}
                  onClick={() => selecionarTema(t)}
                  style={{
                    ...st.cardTemaStyle,
                    background: temaSelecionado?.id === t.id ? "rgba(79,70,229,0.1)" : "#1e293b",
                    borderLeft: `4px solid ${temaSelecionado?.id === t.id ? "#4f46e5" : "transparent"}`
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", alignItems: "center" }}>
                    <span style={{ ...st.materiaBadgeStyle, color: getMateriaColor(t.materia) }}>
                      {t.materia}
                    </span>
                    {usuario?.favoritos?.includes(t.id) && <FaStar color="#fbbf24" size={10} />}
                  </div>
                  <strong style={{ fontSize: "13px", color: "#fff", display: "block", marginBottom: "4px" }}>
                    {t.subtema || "Geral"}
                  </strong>
                  <p style={st.previewEnunciadoStyle}>
                    {t.enunciado?.substring(0, 70)}...
                  </p>
                </div>
              ))
            )}
          </aside>
        )}

        {/* CONTEÚDO DO TEMA */}
        {(!isMobile || !mostrandoLista) && (
          <section style={{
            ...st.contentSectionStyle,
            flex: 1,
            minHeight: isMobile ? "auto" : "calc(100vh - 280px)"
          }}>
            {temaSelecionado ? (
              <div style={st.paperStyle}>
                {/* BOTÃO VOLTAR NO MOBILE */}
                {isMobile && (
                  <button onClick={voltarParaLista} style={st.btnVoltar}>
                    <FaChevronLeft size={12} /> VOLTAR PARA LISTA
                  </button>
                )}

                {/* CABEÇALHO DO TEMA */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px", marginBottom: "20px" }}>
                  <div>
                    <div style={{ display: "flex", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
                      <span style={{ ...st.tagMateriaStyle, borderColor: getMateriaColor(temaSelecionado.materia), color: getMateriaColor(temaSelecionado.materia) }}>
                        {temaSelecionado.materia}
                      </span>
                      {temaSelecionado.subtema && (
                        <span style={{ ...st.tagMateriaStyle, borderColor: "#334155", color: "#94a3b8" }}>
                          {temaSelecionado.subtema}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    disabled={salvando}
                    onClick={toggleFavorito}
                    style={{ ...st.btnFav, color: isFavorito ? "#fbbf24" : "#64748b", borderColor: isFavorito ? "#fbbf24" : "#334155" }}
                  >
                    {isFavorito ? <FaStar size={12} /> : <FaRegStar size={12} />}
                    {isFavorito ? "SALVO" : "SALVAR"}
                  </button>
                </div>

                {/* ENUNCIADO */}
                <h2 style={st.enunciadoTitleStyle}>{temaSelecionado.enunciado}</h2>

                {/* IMAGEM SE EXISTIR */}
                {temaSelecionado.imagemUrl && (
                  <div style={{ marginBottom: "28px", textAlign: "center", background: "#000", padding: "16px", borderRadius: "14px" }}>
                    <img src={temaSelecionado.imagemUrl} alt="Imagem" style={{ maxWidth: "100%", maxHeight: "300px", borderRadius: "10px", objectFit: "contain" }} />
                  </div>
                )}

                {/* BLOCOS DE CONTEÚDO */}
                <div style={st.infoGridStyle}>
                  <div style={{ ...st.infoBlockStyle, borderTop: "4px solid #818cf8" }}>
                    <h4 style={{ ...st.infoTitleStyle, color: "#818cf8" }}>
                      <FaNotesMedical size={14} /> RACIOCÍNIO MÉDICO
                    </h4>
                    <p style={st.infoTextStyle}>{temaSelecionado.raciocinio || "Análise técnica oficial disponível em breve."}</p>
                  </div>

                  <div style={{ ...st.infoBlockStyle, borderTop: "4px solid #10b981" }}>
                    <h4 style={{ ...st.infoTitleStyle, color: "#10b981" }}>
                      <FaStethoscope size={14} /> CONDUTA ATUALIZADA
                    </h4>
                    <p style={st.infoTextStyle}>{temaSelecionado.tto || temaSelecionado.conduta || "Protocolo de conduta disponível em breve."}</p>
                  </div>

                  {temaSelecionado.dicaMestre && (
                    <div style={{ ...st.infoBlockStyle, borderTop: "4px solid #fbbf24", background: "rgba(251,191,36,0.04)" }}>
                      <h4 style={{ ...st.infoTitleStyle, color: "#fbbf24" }}>
                        <FaLightbulb size={14} /> DICA DO MESTRE
                      </h4>
                      <p style={{ ...st.infoTextStyle, fontStyle: "italic" }}>"{temaSelecionado.dicaMestre}"</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={st.emptyStateStyle}>
                <FaBookOpen size={52} color="#1e293b" style={{ marginBottom: "16px" }} />
                <h3 style={{ color: "#475569", fontSize: "18px", margin: "0 0 8px" }}>Central de Revisão</h3>
                <p style={{ color: "#475569", fontSize: "13px" }}>
                  {isMobile ? "Selecione um tema acima para carregar o guia." : "Selecione um tema na lista ao lado para carregar o guia."}
                </p>
              </div>
            )}
          </section>
        )}
      </div>

      <style>{`
        * { box-sizing: border-box; }
        .spinner { width: 32px; height: 32px; border: 3px solid rgba(79,70,229,0.2); border-radius: 50%; border-top-color: #4f46e5; animation: spin 0.8s linear infinite; }
        @keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
        aside::-webkit-scrollbar { width: 4px; }
        aside::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
        section::-webkit-scrollbar { width: 4px; }
        section::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
      `}</style>
    </div>
  );
};

const st = {
  containerStyle: { padding: "clamp(14px, 3vw, 28px)", background: "#020617", minHeight: "100vh", display: "flex", flexDirection: "column" },
  loadingStyle: { height: "80vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#020617" },
  headerStyle: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px", gap: "16px", flexWrap: "wrap" },
  titleStyle: { fontSize: "clamp(20px, 3.5vw, 26px)", fontWeight: "900", color: "#fff", margin: 0 },
  subtitleStyle: { color: "#64748b", margin: "4px 0 0", fontSize: "13px" },
  searchWrapperStyle: { position: "relative", minWidth: "200px", flex: "0 1 320px" },
  searchIconStyle: { position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#4f46e5" },
  searchInputStyle: { width: "100%", padding: "12px 36px 12px 40px", background: "#1e293b", border: "1px solid #334155", borderRadius: "14px", color: "#fff", outline: "none", fontSize: "13px", boxSizing: "border-box" },
  btnClearSearch: { position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: "4px", display: "flex" },
  filterBarStyle: { display: "flex", gap: "8px", marginBottom: "20px", overflowX: "auto", paddingBottom: "6px", flexShrink: 0 },
  filterBadgeStyle: { padding: "9px 16px", borderRadius: "12px", border: "1px solid", fontSize: "11px", fontWeight: "800", cursor: "pointer", transition: "all 0.2s", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 },
  layoutGridStyle: { display: "flex", gap: "20px", flex: 1, overflow: "hidden" },
  listAsideStyle: { overflowY: "auto", flexShrink: 0 },
  listHeader: { fontSize: "10px", fontWeight: "800", color: "#475569", marginBottom: "12px", letterSpacing: "1px", padding: "0 4px" },
  cardTemaStyle: { background: "#1e293b", padding: "14px", borderRadius: "14px", cursor: "pointer", transition: "all 0.2s", marginBottom: "8px", border: "1px solid #334155" },
  previewEnunciadoStyle: { margin: 0, fontSize: "12px", color: "#64748b", lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" },
  materiaBadgeStyle: { fontSize: "9px", fontWeight: "900", textTransform: "uppercase", letterSpacing: "0.5px" },
  contentSectionStyle: { overflowY: "auto", background: "#0f172a", borderRadius: "24px", border: "1px solid #1e293b" },
  paperStyle: { padding: "clamp(16px, 3vw, 36px)" },
  btnVoltar: { display: "flex", alignItems: "center", gap: "6px", background: "rgba(255,255,255,0.05)", border: "1px solid #334155", color: "#94a3b8", padding: "8px 14px", borderRadius: "10px", cursor: "pointer", fontSize: "12px", fontWeight: "700", marginBottom: "20px" },
  tagMateriaStyle: { background: "transparent", padding: "5px 12px", borderRadius: "8px", fontSize: "11px", fontWeight: "800", border: "1px solid", display: "inline-block" },
  btnFav: { background: "none", border: "1px solid", padding: "8px 14px", borderRadius: "10px", cursor: "pointer", fontSize: "11px", fontWeight: "700", display: "flex", alignItems: "center", gap: "6px", transition: "all 0.2s", flexShrink: 0 },
  enunciadoTitleStyle: { fontSize: "clamp(15px, 2.5vw, 19px)", fontWeight: "600", color: "#f8fafc", lineHeight: 1.65, marginBottom: "28px", wordBreak: "break-word" },
  infoGridStyle: { display: "flex", flexDirection: "column", gap: "20px" },
  infoBlockStyle: { background: "#1e293b", padding: "clamp(16px, 3vw, 26px)", borderRadius: "18px", border: "1px solid #334155" },
  infoTitleStyle: { display: "flex", alignItems: "center", gap: "10px", margin: "0 0 14px", fontSize: "13px", fontWeight: "900", textTransform: "uppercase", letterSpacing: "0.5px" },
  infoTextStyle: { color: "#cbd5e1", fontSize: "14px", lineHeight: 1.75, margin: 0 },
  emptyStateStyle: { height: "100%", minHeight: "300px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px" },
};

export default Biblioteca;
