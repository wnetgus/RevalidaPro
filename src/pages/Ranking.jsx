import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { FaTrophy, FaMedal, FaArrowLeft, FaFire, FaCrown, FaUserMd, FaRedo } from "react-icons/fa";

const Ranking = () => {
  const navigate = useNavigate();
  const [ranking, setRanking] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [visiveis, setVisiveis] = useState([]);

  const carregar = async () => {
    setCarregando(true);
    setVisiveis([]);
    try {
      const q = query(collection(db, "usuarios"), orderBy("totalAcertos", "desc"), limit(20));
      const snap = await getDocs(q);
      const lista = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(u => (u.totalAcertos || 0) + (u.totalErros || 0) > 0);
      setRanking(lista);
      lista.forEach((_, i) => {
        setTimeout(() => setVisiveis(v => [...v, i]), 80 * i);
      });
    } catch (e) {
      console.error("Erro ao carregar ranking:", e);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const meuUid = auth.currentUser?.uid;
  const pct = (acertos, erros) => {
    const t = acertos + erros;
    return t > 0 ? Math.round((acertos / t) * 100) : 0;
  };

  const corAprov = (p) => p >= 70 ? "#10b981" : p >= 50 ? "#fbbf24" : "#ef4444";

  const top3 = ranking.slice(0, 3);
  const resto = ranking.slice(3);
  const minhaPosicao = ranking.findIndex(u => u.id === meuUid);

  if (carregando) return (
    <div style={st.loading}>
      <div className="spinner" />
      <p style={{ marginTop: "16px", color: "#818cf8", fontWeight: "700", fontSize: "13px" }}>CARREGANDO RANKING...</p>
      <style>{`.spinner{width:32px;height:32px;border:3px solid rgba(129,140,248,0.2);border-radius:50%;border-top-color:#818cf8;animation:spin 0.8s ease infinite}@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={st.container}>

      {/* HEADER */}
      <header style={st.header}>
        <div>
          <h1 style={st.titulo}><FaTrophy color="#fbbf24" size={26} /> Ranking <span style={{ color: "#4f46e5" }}>Geral</span></h1>
          <p style={st.sub}>
            {ranking.length > 0
              ? `${ranking.length} médico${ranking.length !== 1 ? "s" : ""} ativos na plataforma`
              : "Seja o primeiro a entrar no ranking!"}
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={carregar} style={st.btnRefresh} title="Atualizar">
            <FaRedo size={12} />
          </button>
          <button onClick={() => navigate("/dashboard")} style={st.btnVoltar}>
            <FaArrowLeft size={12} /> VOLTAR
          </button>
        </div>
      </header>

      {/* SUA POSIÇÃO (se fora do top 3) */}
      {minhaPosicao >= 3 && (
        <div style={st.suaPosicaoBanner}>
          <FaUserMd color="#818cf8" size={14} />
          <span style={{ color: "#94a3b8", fontSize: "12px" }}>Sua posição:</span>
          <span style={{ color: "#818cf8", fontWeight: "900", fontSize: "15px" }}>#{minhaPosicao + 1}</span>
          <span style={{ color: "#64748b", fontSize: "11px" }}>de {ranking.length}</span>
        </div>
      )}

      {ranking.length === 0 ? (
        <div style={st.empty}>
          <FaTrophy size={48} style={{ opacity: 0.15, marginBottom: 16 }} />
          <p>Nenhum dado disponível ainda. Seja o primeiro!</p>
        </div>
      ) : (
        <>
          {/* PÓDIO TOP 3 */}
          {top3.length >= 2 && (
            <div style={st.podioWrapper}>
              {/* 2º lugar */}
              {top3[1] && (
                <div style={{ ...st.podioItem, animationDelay: "0.15s" }}>
                  <div style={st.podioAvatar}>
                    <FaMedal color="#94a3b8" size={20} />
                  </div>
                  <p style={{ ...st.podioNome, color: "#94a3b8" }}>Dr. {top3[1].nome?.split(" ")[0] || "Médico"}</p>
                  {top3[1].id === meuUid && <span style={st.voceTag}>VOCÊ</span>}
                  <p style={{ ...st.podioAcertos, color: "#94a3b8" }}>{top3[1].totalAcertos || 0} pts</p>
                  <div style={{ ...st.podioColuna, height: "80px", background: "linear-gradient(180deg, #94a3b8 0%, #475569 100%)" }}>
                    <span style={st.podioNumero}>2</span>
                  </div>
                </div>
              )}
              {/* 1º lugar */}
              {top3[0] && (
                <div style={{ ...st.podioItem, animationDelay: "0s" }}>
                  <div style={{ ...st.podioAvatar, boxShadow: "0 0 20px rgba(251,191,36,0.4)" }}>
                    <FaCrown color="#fbbf24" size={22} />
                  </div>
                  <p style={{ ...st.podioNome, color: "#fbbf24", fontSize: "14px" }}>Dr. {top3[0].nome?.split(" ")[0] || "Médico"}</p>
                  {top3[0].id === meuUid && <span style={{ ...st.voceTag, background: "#fbbf24", color: "#000" }}>VOCÊ</span>}
                  <p style={{ ...st.podioAcertos, color: "#fbbf24", fontSize: "16px" }}>{top3[0].totalAcertos || 0} pts</p>
                  <div style={{ ...st.podioColuna, height: "110px", background: "linear-gradient(180deg, #fbbf24 0%, #b45309 100%)" }}>
                    <span style={st.podioNumero}>1</span>
                  </div>
                </div>
              )}
              {/* 3º lugar */}
              {top3[2] && (
                <div style={{ ...st.podioItem, animationDelay: "0.3s" }}>
                  <div style={st.podioAvatar}>
                    <FaMedal color="#cd7c40" size={20} />
                  </div>
                  <p style={{ ...st.podioNome, color: "#cd7c40" }}>Dr. {top3[2].nome?.split(" ")[0] || "Médico"}</p>
                  {top3[2].id === meuUid && <span style={{ ...st.voceTag, background: "#cd7c40" }}>VOCÊ</span>}
                  <p style={{ ...st.podioAcertos, color: "#cd7c40" }}>{top3[2].totalAcertos || 0} pts</p>
                  <div style={{ ...st.podioColuna, height: "60px", background: "linear-gradient(180deg, #cd7c40 0%, #7c3c14 100%)" }}>
                    <span style={st.podioNumero}>3</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* LISTA DO 4º EM DIANTE */}
          {resto.length > 0 && (
            <div style={st.lista}>
              {resto.map((u, i) => {
                const pos = i + 4;
                const euSou = u.id === meuUid;
                const aprov = pct(u.totalAcertos || 0, u.totalErros || 0);
                const cor = corAprov(aprov);
                const visivel = visiveis.includes(i + 3);
                return (
                  <div key={u.id} style={{
                    ...st.card,
                    borderColor: euSou ? "#4f46e5" : "#1f2937",
                    background: euSou ? "rgba(79,70,229,0.08)" : "#111827",
                    opacity: visivel ? 1 : 0,
                    transform: visivel ? "translateY(0)" : "translateY(12px)",
                    transition: "opacity 0.4s ease, transform 0.4s ease",
                  }}>
                    <div style={{ ...st.posicao, color: "#475569", fontWeight: "900", fontSize: "14px", minWidth: "28px" }}>
                      #{pos}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <span style={{ fontWeight: "800", color: euSou ? "#818cf8" : "#f1f5f9", fontSize: "14px" }}>
                          Dr. {u.nome?.split(" ")[0] || "Médico"}
                        </span>
                        {euSou && <span style={st.voceTag}>VOCÊ</span>}
                      </div>
                      <div style={{ display: "flex", gap: "14px", marginTop: "5px", flexWrap: "wrap", alignItems: "center" }}>
                        <span style={{ fontSize: "11px", color: "#10b981" }}>✓ {u.totalAcertos || 0} acertos</span>
                        <span style={{ fontSize: "11px", color: "#475569" }}>{(u.totalAcertos || 0) + (u.totalErros || 0)} questões</span>
                        {(u.streakAtual || 0) > 0 && (
                          <span style={{ fontSize: "11px", color: "#fbbf24" }}><FaFire size={9} /> {u.streakAtual} dias</span>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: "18px", fontWeight: "900", color: cor }}>{aprov}%</div>
                      <div style={{ width: "56px", height: "4px", background: "#1e293b", borderRadius: "4px", marginTop: "4px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: visivel ? `${aprov}%` : "0%", background: cor, borderRadius: "4px", transition: "width 0.8s ease-out 0.2s" }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <style>{`
        .spinner{width:32px;height:32px;border:3px solid rgba(129,140,248,0.2);border-radius:50%;border-top-color:#818cf8;animation:spin 0.8s ease infinite}
        @keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
        @keyframes podioEntrada{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes brilhoCrown{0%,100%{filter:drop-shadow(0 0 4px #fbbf24)}50%{filter:drop-shadow(0 0 12px #fbbf24)}}
      `}</style>
    </div>
  );
};

const st = {
  container: { padding: "clamp(16px, 3vw, 40px)", maxWidth: "820px", margin: "0 auto", minHeight: "100vh", background: "#020617", color: "#fff" },
  loading: { height: "80vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#020617" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px", flexWrap: "wrap", gap: "16px" },
  titulo: { fontSize: "clamp(22px, 4vw, 30px)", fontWeight: "900", margin: 0, display: "flex", alignItems: "center", gap: "12px" },
  sub: { color: "#64748b", fontSize: "13px", margin: "4px 0 0" },
  btnVoltar: { background: "rgba(255,255,255,0.05)", color: "#fff", border: "1px solid #334155", padding: "11px 18px", borderRadius: "12px", cursor: "pointer", fontWeight: "700", fontSize: "12px", display: "flex", alignItems: "center", gap: "8px" },
  btnRefresh: { background: "rgba(79,70,229,0.1)", color: "#818cf8", border: "1px solid rgba(79,70,229,0.3)", padding: "11px 14px", borderRadius: "12px", cursor: "pointer", display: "flex", alignItems: "center" },
  suaPosicaoBanner: { display: "flex", alignItems: "center", gap: "10px", background: "rgba(79,70,229,0.06)", border: "1px solid rgba(79,70,229,0.2)", borderRadius: "14px", padding: "12px 18px", marginBottom: "20px" },
  podioWrapper: { display: "flex", alignItems: "flex-end", justifyContent: "center", gap: "12px", marginBottom: "28px", padding: "20px 0 0" },
  podioItem: { display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", animation: "podioEntrada 0.6s ease both" },
  podioAvatar: { width: "52px", height: "52px", borderRadius: "50%", background: "#1e293b", border: "2px solid #334155", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "4px" },
  podioNome: { fontSize: "12px", fontWeight: "800", margin: 0, textAlign: "center", maxWidth: "90px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  podioAcertos: { fontSize: "13px", fontWeight: "900", margin: "2px 0 4px" },
  podioColuna: { width: "80px", borderRadius: "8px 8px 0 0", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "8px" },
  podioNumero: { color: "rgba(255,255,255,0.7)", fontSize: "22px", fontWeight: "900" },
  voceTag: { background: "#4f46e5", color: "#fff", fontSize: "9px", padding: "2px 7px", borderRadius: "6px", fontWeight: "800" },
  lista: { display: "flex", flexDirection: "column", gap: "8px" },
  card: { display: "flex", alignItems: "center", gap: "14px", padding: "14px 18px", borderRadius: "14px", border: "1px solid" },
  posicao: { display: "flex", alignItems: "center", justifyContent: "center" },
  empty: { textAlign: "center", padding: "80px 20px", color: "#4b5563", display: "flex", flexDirection: "column", alignItems: "center" },
};

export default Ranking;
