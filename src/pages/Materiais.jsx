import React, { useState, useEffect, useMemo } from "react";
import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import {
  FaFilePdf, FaExternalLinkAlt, FaSearch, FaFolderOpen,
  FaBookMedical, FaLightbulb, FaLock, FaStethoscope,
  FaGraduationCap, FaFileSignature, FaCrown, FaTimes,
  FaChevronRight
} from "react-icons/fa";

const Materiais = ({ usuario }) => {
  const [arquivos, setArquivos] = useState([]);
  const [busca, setBusca] = useState("");
  const [categoriaAtiva, setCategoriaAtiva] = useState("Todos");
  const [carregando, setCarregando] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // ✅ LÓGICA ORIGINAL PRESERVADA
  const temAcesso = usuario?.status === "pago" || usuario?.role === "admin" || usuario?.role === "colaborador";

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ✅ LÓGICA ORIGINAL PRESERVADA
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "materiais"), (snap) => {
      const dados = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const ordenados = dados.sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0));
      setArquivos(ordenados);
      setCarregando(false);
    }, (error) => {
      console.error("Erro ao carregar materiais:", error);
      setCarregando(false);
    });
    return () => unsub();
  }, []);

  const categorias = useMemo(() => {
    const categoriasBase = ["Todos", "Plantão", "Estudo", "Simulados"];
    const categoriasNoBD = [...new Set(arquivos.map(a => a.categoria || "Geral").filter(Boolean))];
    return [...new Set([...categoriasBase, ...categoriasNoBD])];
  }, [arquivos]);

  const filtrados = useMemo(() => {
    return arquivos.filter(a => {
      const nome = (a.nome || a.titulo || "").toLowerCase();
      const categoria = a.categoria || "Geral";
      return nome.includes(busca.toLowerCase()) && (categoriaAtiva === "Todos" || categoria === categoriaAtiva);
    });
  }, [arquivos, busca, categoriaAtiva]);

  // ✅ LÓGICA ORIGINAL PRESERVADA
  const handleAcesso = (file) => {
    if (!temAcesso) {
      alert("🩺 CONTEÚDO RESTRITO: Doutor, este material é exclusivo para assinantes Premium.");
      return;
    }
    window.open(file.link || file.url, "_blank");
  };

  const getCategoryInfo = (cat) => {
    const map = {
      "Plantão": { icon: <FaStethoscope />, color: "#fbbf24", bg: "rgba(251,191,36,0.1)", label: "Plantão" },
      "Estudo": { icon: <FaGraduationCap />, color: "#60a5fa", bg: "rgba(96,165,250,0.1)", label: "Estudo" },
      "Simulados": { icon: <FaFileSignature />, color: "#34d399", bg: "rgba(52,211,153,0.1)", label: "Simulados" },
      "default": { icon: <FaFilePdf />, color: "#ef4444", bg: "rgba(239,68,68,0.1)", label: "Geral" }
    };
    return map[cat] || map["default"];
  };

  if (carregando) return (
    <div style={st.carregandoContainer}>
      <div className="spinner"></div>
      <p style={{ marginTop: "16px", color: "#6366f1", fontWeight: "700", fontSize: "13px" }}>
        Sincronizando biblioteca...
      </p>
    </div>
  );

  return (
    <div style={st.containerPrincipal}>

      {/* HEADER PREMIUM */}
      <header style={st.headerCard}>
        <div style={st.iconBadge}><FaBookMedical size={22} color="white" /></div>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: "clamp(18px, 3vw, 24px)", fontWeight: "900", color: "#fff" }}>
            Biblioteca <span style={{ color: "#6366f1" }}>Digital</span>
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#94a3b8" }}>
            {temAcesso
              ? `${filtrados.length} materiais disponíveis · Acesso Premium liberado`
              : "Faça upgrade para acessar todos os guias e PDFs"}
          </p>
        </div>
        {!temAcesso && (
          <div style={st.premiumBadge}>
            <FaCrown color="#fbbf24" size={12} />
            <span style={{ color: "#fbbf24", fontSize: "11px", fontWeight: "800" }}>UPGRADE</span>
          </div>
        )}
      </header>

      {/* BUSCA */}
      <div style={st.searchRow}>
        <div style={st.searchContainer}>
          <FaSearch style={st.searchIcon} size={14} />
          <input
            type="text"
            placeholder="O que você deseja estudar hoje?"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            style={st.inputBusca}
          />
          {busca && (
            <button onClick={() => setBusca("")} style={st.btnClear}>
              <FaTimes size={12} color="#64748b" />
            </button>
          )}
        </div>
      </div>

      {/* CATEGORIAS */}
      <div style={st.categoryScroll}>
        {categorias.map(cat => {
          const info = getCategoryInfo(cat);
          const ativo = categoriaAtiva === cat;
          return (
            <button
              key={cat}
              onClick={() => setCategoriaAtiva(cat)}
              style={{
                ...st.categoryChip,
                background: ativo ? "#4f46e5" : "#1e293b",
                borderColor: ativo ? "#6366f1" : "#334155",
                color: ativo ? "#fff" : "#94a3b8",
                boxShadow: ativo ? "0 4px 12px rgba(79,70,229,0.3)" : "none"
              }}
            >
              {cat !== "Todos" && (
                <span style={{ color: ativo ? "#fff" : info.color, fontSize: "11px" }}>
                  {React.cloneElement(info.icon, { size: 11 })}
                </span>
              )}
              {cat.toUpperCase()}
            </button>
          );
        })}
      </div>

      {/* LISTA DE MATERIAIS */}
      <div style={st.listaContainer}>
        {filtrados.length === 0 ? (
          <div style={st.emptyState}>
            <FaFolderOpen size={40} style={{ opacity: 0.15, marginBottom: "16px" }} />
            <p style={{ color: "#fff", fontSize: "15px", margin: "0 0 6px" }}>
              Nenhum material em "{categoriaAtiva}".
            </p>
            <small style={{ color: "#64748b" }}>
              {busca ? `Nenhum resultado para "${busca}".` : "Novos materiais são adicionados regularmente."}
            </small>
          </div>
        ) : (
          filtrados.map(file => {
            const catInfo = getCategoryInfo(file.categoria);
            return (
              <div
                key={file.id}
                onClick={() => handleAcesso(file)}
                style={{ ...st.cardEstilo, cursor: temAcesso ? "pointer" : "not-allowed" }}
              >
                {/* ÍCONE DE CATEGORIA */}
                <div style={{ ...st.pdfIconBg, background: catInfo.bg }}>
                  {React.cloneElement(catInfo.icon, { color: catInfo.color, size: 20 })}
                </div>

                {/* CONTEÚDO */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={st.itemTitulo}>{file.nome || file.titulo}</h3>
                  <div style={st.metaInfo}>
                    <span style={{ color: catInfo.color, fontWeight: "800", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.3px" }}>
                      {file.categoria || "Geral"}
                    </span>
                    <span style={{ color: "#334155" }}>•</span>
                    <span style={st.tipoBadge}>PDF</span>
                  </div>
                </div>

                {/* BOTÃO DE ACESSO */}
                <div style={{
                  ...st.downloadAction,
                  background: temAcesso ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.1)",
                  border: `1px solid ${temAcesso ? "rgba(16,185,129,0.2)" : "rgba(245,158,11,0.2)"}`
                }}>
                  {temAcesso ? (
                    <>
                      {!isMobile && <span style={{ color: "#10b981", fontSize: "11px", fontWeight: "800", marginRight: "6px" }}>ABRIR</span>}
                      <FaExternalLinkAlt size={11} color="#10b981" />
                    </>
                  ) : (
                    <>
                      {!isMobile && <span style={{ color: "#f59e0b", fontSize: "11px", fontWeight: "800", marginRight: "6px" }}>PREMIUM</span>}
                      <FaLock size={11} color="#f59e0b" />
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* DICA */}
      <div style={st.hintBox}>
        <FaLightbulb color="#fbbf24" size={14} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: "12px", color: "#94a3b8", lineHeight: 1.5 }}>
          {temAcesso
            ? 'Dica: Use a categoria "Plantão" para acesso rápido a protocolos durante o serviço médico.'
            : 'Faça upgrade para o plano Premium e desbloqueie todos os materiais da biblioteca digital.'}
        </span>
      </div>

      <style>{`
        * { box-sizing: border-box; }
        .spinner { width: 32px; height: 32px; border: 3px solid rgba(99,102,241,0.2); border-top-color: #6366f1; border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
        div[onClick]:hover { opacity: 0.92; }
      `}</style>
    </div>
  );
};

const st = {
  containerPrincipal: { padding: "clamp(14px, 3vw, 28px)", maxWidth: "860px", margin: "0 auto", color: "#f8fafc", paddingBottom: "80px", minHeight: "100vh", background: "#020617" },
  carregandoContainer: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "80vh", background: "#020617" },
  headerCard: { display: "flex", alignItems: "center", gap: "18px", marginBottom: "24px", background: "#1e293b", padding: "clamp(16px, 3vw, 24px)", borderRadius: "22px", border: "1px solid #334155", flexWrap: "wrap" },
  iconBadge: { background: "#6366f1", padding: "16px", borderRadius: "16px", boxShadow: "0 8px 20px rgba(99,102,241,0.3)", display: "flex", flexShrink: 0 },
  premiumBadge: { display: "flex", alignItems: "center", gap: "6px", background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.2)", padding: "8px 14px", borderRadius: "10px" },
  searchRow: { marginBottom: "16px" },
  searchContainer: { position: "relative" },
  searchIcon: { position: "absolute", left: "18px", top: "50%", transform: "translateY(-50%)", color: "#64748b" },
  inputBusca: { width: "100%", padding: "14px 40px 14px 48px", borderRadius: "16px", border: "1px solid #334155", background: "#1e293b", color: "white", outline: "none", fontSize: "14px", boxSizing: "border-box", transition: "border-color 0.2s" },
  btnClear: { position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: "4px", display: "flex" },
  categoryScroll: { display: "flex", gap: "8px", overflowX: "auto", marginBottom: "24px", paddingBottom: "6px" },
  categoryChip: { padding: "9px 16px", borderRadius: "12px", border: "1px solid", color: "white", fontSize: "11px", fontWeight: "800", cursor: "pointer", transition: "all 0.2s", whiteSpace: "nowrap", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 },
  listaContainer: { display: "flex", flexDirection: "column", gap: "10px" },
  cardEstilo: { display: "flex", alignItems: "center", gap: "16px", padding: "18px", background: "#1e293b", borderRadius: "18px", border: "1px solid #334155", transition: "all 0.2s" },
  pdfIconBg: { padding: "12px", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  itemTitulo: { margin: 0, fontSize: "15px", color: "#f1f5f9", fontWeight: "600", wordBreak: "break-word", lineHeight: 1.4 },
  metaInfo: { display: "flex", alignItems: "center", gap: "8px", marginTop: "5px", flexWrap: "wrap" },
  tipoBadge: { background: "#334155", color: "#94a3b8", padding: "2px 8px", borderRadius: "6px", fontWeight: "700", fontSize: "10px" },
  downloadAction: { display: "flex", alignItems: "center", padding: "10px 14px", borderRadius: "12px", transition: "0.2s", flexShrink: 0 },
  emptyState: { textAlign: "center", color: "#64748b", padding: "60px 20px", background: "#1e293b", borderRadius: "20px", border: "2px dashed #334155", display: "flex", flexDirection: "column", alignItems: "center" },
  hintBox: { display: "flex", alignItems: "flex-start", gap: "12px", marginTop: "28px", padding: "16px 20px", background: "rgba(251,191,36,0.05)", borderRadius: "16px", border: "1px solid rgba(251,191,36,0.15)" },
};

export default Materiais;
