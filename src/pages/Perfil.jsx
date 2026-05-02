import React, { useState, useEffect } from "react";
import { auth, db, storage } from "../firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { signOut } from "firebase/auth";
import {
  collection, query, orderBy, getDocs, doc, updateDoc
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import {
  FaUserCircle, FaCalendarAlt, FaSignOutAlt,
  FaUserMd, FaRedoAlt, FaExclamationTriangle,
  FaChartLine, FaCrown, FaMedal, FaTrophy,
  FaCamera, FaSave, FaTimes, FaStethoscope,
  FaIdCard, FaInfoCircle
} from "react-icons/fa";
import { resetarHistoricoMedico } from "../modules/simulador/simuladorLogic";

const Perfil = ({ usuario }) => {
  const navigate = useNavigate();
  const [resetando, setResetando] = useState(false);
  const [_ranking, _setRanking] = useState([]);
  const [editando, setEditando] = useState(false);
  const [nomeEdit, setNomeEdit] = useState(usuario?.nome || "");
  const [crmEdit, setCrmEdit] = useState(usuario?.crm || "");
  const [especialidadeEdit, setEspecialidadeEdit] = useState(usuario?.especialidade || "");
  const [subindoFoto, setSubindoFoto] = useState(false);
  const [progressoAnimado, setProgressoAnimado] = useState(0);

  // ✅ CORRIGIDO: Estado local para foto (sem reload)
  const [fotoAtual, setFotoAtual] = useState(usuario?.fotoUrl || null);

  const totalRespostas = (usuario?.totalAcertos || 0) + (usuario?.totalErros || 0);
  const mediaSessao = totalRespostas > 0
    ? Math.round((usuario.totalAcertos / totalRespostas) * 100)
    : 0;

  const [posicao, setPosicao] = useState(null);
  const [totalJogadores, setTotalJogadores] = useState(0);

  useEffect(() => {
    const buscarPosicao = async () => {
      try {
        const snap = await getDocs(query(
          collection(db, "usuarios"),
          orderBy("totalAcertos", "desc")
        ));
        const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .filter(u => (u.totalAcertos || 0) + (u.totalErros || 0) > 0);
        setTotalJogadores(lista.length);
        const idx = lista.findIndex(u => u.id === usuario?.id);
        setPosicao(idx >= 0 ? idx + 1 : null);
      } catch { /* silencioso */ }
    };
    if (usuario?.id) buscarPosicao();
  }, [usuario?.id]);

  useEffect(() => {
    setTimeout(() => setProgressoAnimado(mediaSessao), 300);
  }, [mediaSessao]);

  const handleSair = async () => {
    await signOut(auth);
    navigate("/login");
  };

  // ✅ CORRIGIDO: Atualiza foto via estado, sem window.location.reload()
  const handleTrocarFoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSubindoFoto(true);
    try {
      const storageRef = ref(storage, `avatars/${usuario.id}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await updateDoc(doc(db, "usuarios", usuario.id), { fotoUrl: url });
      setFotoAtual(url); // ✅ Atualiza estado local
      alert("✅ Foto atualizada com sucesso, Doutor!");
    } catch {
      alert("Erro ao subir imagem. Verifique o Firebase Storage.");
    }
    setSubindoFoto(false);
  };

  const handleSalvarDados = async () => {
    try {
      await updateDoc(doc(db, "usuarios", usuario.id), {
        nome: nomeEdit,
        crm: crmEdit,
        especialidade: especialidadeEdit
      });
      setEditando(false);
      alert("✅ Perfil atualizado com sucesso!");
    } catch {
      alert("Erro ao salvar alterações.");
    }
  };

  const handleReset = async () => {
    const confirmacao = window.confirm(
      "⚠️ ATENÇÃO: Esta ação apagará todo o histórico. Deseja continuar?"
    );
    if (confirmacao) {
      setResetando(true);
      const sucesso = await resetarHistoricoMedico();
      if (sucesso) navigate("/");
      setResetando(false);
    }
  };

  const expira = usuario?.dataExpiracao?.toDate
    ? usuario.dataExpiracao.toDate()
    : null;
  const diasRestantes = expira
    ? Math.ceil((expira - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  const _getMedalha = (posicao) => {
    if (posicao === 0) return <FaTrophy color="#fbbf24" />;
    if (posicao === 1) return <FaMedal color="#94a3b8" />;
    if (posicao === 2) return <FaMedal color="#b45309" />;
    return <span style={{ color: "#64748b", fontSize: "12px" }}>#{posicao + 1}</span>;
  };

  if (!usuario) return (
    <div style={st.loading}>
      <div className="spinner"></div> Sincronizando perfil...
    </div>
  );

  return (
    <div style={st.container}>
      {/* HEADER */}
      <header style={st.header}>
        <div>
          <h2 style={st.title}>
            <FaUserMd color="#818cf8" /> Central do{" "}
            <span style={{ color: "#4f46e5", marginLeft: "8px" }}>Médico</span>
          </h2>
          <p style={st.subtitle}>Gerencie sua carreira, assinatura e histórico.</p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          {!editando ? (
            <button onClick={() => setEditando(true)} style={st.btnEdit}>
              EDITAR PERFIL
            </button>
          ) : (
            <>
              <button onClick={handleSalvarDados} style={st.btnSave}>
                <FaSave /> SALVAR
              </button>
              <button onClick={() => setEditando(false)} style={st.btnCancel}>
                <FaTimes />
              </button>
            </>
          )}
        </div>
      </header>

      <div style={st.mainGrid}>
        {/* COLUNA ESQUERDA */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

          {/* CARD FOTO E DADOS */}
          <div style={st.card}>
            <div style={st.fotoContainer}>
              <div style={st.fotoWrapper}>
                {fotoAtual ? (
                  <img
                    src={fotoAtual}
                    alt="Foto"
                    style={{ width: "100px", height: "100px", borderRadius: "50%", objectFit: "cover" }}
                  />
                ) : (
                  <FaUserCircle size={100} color="#4f46e5" />
                )}
                <label style={st.fotoBtn} title="Trocar foto">
                  {subindoFoto ? "..." : <FaCamera size={14} />}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleTrocarFoto}
                    style={{ display: "none" }}
                  />
                </label>
              </div>

              <div style={{ flex: 1 }}>
                {editando ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <input
                      value={nomeEdit}
                      onChange={e => setNomeEdit(e.target.value)}
                      placeholder="Nome completo"
                      style={st.input}
                    />
                    <input
                      value={crmEdit}
                      onChange={e => setCrmEdit(e.target.value)}
                      placeholder="CRM (ex: CRM/PE 12345)"
                      style={st.input}
                    />
                    <input
                      value={especialidadeEdit}
                      onChange={e => setEspecialidadeEdit(e.target.value)}
                      placeholder="Especialidade"
                      style={st.input}
                    />
                  </div>
                ) : (
                  <>
                    <h3 style={{ color: "#fff", fontSize: "20px", fontWeight: "800", margin: 0 }}>
                      {usuario.nome || "Médico"}
                    </h3>
                    {usuario.crm && (
                      <p style={{ color: "#818cf8", fontSize: "13px", margin: "4px 0" }}>
                        <FaIdCard /> {usuario.crm}
                      </p>
                    )}
                    {usuario.especialidade && (
                      <p style={{ color: "#64748b", fontSize: "13px", margin: "2px 0" }}>
                        <FaStethoscope /> {usuario.especialidade}
                      </p>
                    )}
                    <p style={{ color: "#64748b", fontSize: "12px", margin: "4px 0" }}>
                      {usuario.email}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* CARD ASSINATURA */}
          <div style={{ ...st.card, borderColor: diasRestantes && diasRestantes <= 7 ? "#ef4444" : "#334155" }}>
            <h4 style={st.cardTitle}><FaCrown color="#fbbf24" /> Minha Assinatura</h4>
            {expira ? (
              <>
                <p style={{ color: "#94a3b8", fontSize: "13px", margin: "8px 0 4px" }}>
                  <FaCalendarAlt /> Expira em: {expira.toLocaleDateString("pt-BR")}
                </p>
                <div style={{
                  padding: "10px 14px",
                  borderRadius: "12px",
                  background: diasRestantes > 7
                    ? "rgba(16, 185, 129, 0.1)"
                    : "rgba(239, 68, 68, 0.1)",
                  color: diasRestantes > 7 ? "#10b981" : "#ef4444",
                  fontSize: "14px",
                  fontWeight: "bold",
                  marginTop: "8px"
                }}>
                  {diasRestantes > 0
                    ? `⏳ ${diasRestantes} dias restantes`
                    : "❌ Assinatura expirada"}
                </div>
              </>
            ) : (
              <p style={{ color: "#64748b", fontSize: "13px" }}>Sem assinatura ativa.</p>
            )}
          </div>

          {/* CARD ESTATÍSTICAS */}
          <div style={st.card}>
            <h4 style={st.cardTitle}><FaChartLine color="#818cf8" /> Estatísticas</h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "12px" }}>
              {[
                { label: "Acertos", value: usuario.totalAcertos || 0, color: "#10b981" },
                { label: "Erros", value: usuario.totalErros || 0, color: "#ef4444" },
                { label: "Total", value: totalRespostas, color: "#818cf8" },
                { label: "Taxa", value: `${mediaSessao}%`, color: "#fbbf24" },
              ].map((item, i) => (
                <div key={i} style={{
                  background: "#0f172a", borderRadius: "12px",
                  padding: "14px", textAlign: "center"
                }}>
                  <p style={{ color: item.color, fontSize: "22px", fontWeight: "800", margin: 0 }}>
                    {item.value}
                  </p>
                  <p style={{ color: "#64748b", fontSize: "11px", margin: "4px 0 0" }}>
                    {item.label}
                  </p>
                </div>
              ))}
            </div>

            {/* BARRA DE PROGRESSO */}
            <div style={{ marginTop: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ color: "#94a3b8", fontSize: "12px" }}>Taxa de acertos</span>
                <span style={{ color: "#fff", fontSize: "12px", fontWeight: "bold" }}>{mediaSessao}%</span>
              </div>
              <div style={{ background: "#1e293b", borderRadius: "100px", height: "8px", overflow: "hidden" }}>
                <div style={{
                  width: `${progressoAnimado}%`,
                  height: "100%",
                  background: "linear-gradient(90deg, #4f46e5, #818cf8)",
                  borderRadius: "100px",
                  transition: "width 1s ease-out"
                }} />
              </div>
            </div>
          </div>

          {/* ZONA DE PERIGO */}
          <div style={{ ...st.card, borderColor: "rgba(239,68,68,0.3)" }}>
            <h4 style={{ ...st.cardTitle, color: "#ef4444" }}>
              <FaExclamationTriangle /> Zona de Perigo
            </h4>
            <p style={{ color: "#64748b", fontSize: "12px", margin: "8px 0 14px" }}>
              Esta ação apagará todo o histórico de estudos permanentemente.
            </p>
            <button onClick={handleReset} disabled={resetando} style={st.btnDanger}>
              <FaRedoAlt /> {resetando ? "Resetando..." : "RESETAR HISTÓRICO"}
            </button>
            <button onClick={handleSair} style={st.btnSair}>
              <FaSignOutAlt /> SAIR DA PLATAFORMA
            </button>
          </div>
        </div>

        {/* COLUNA DIREITA — SUA POSIÇÃO */}
        <div style={st.card}>
          <h4 style={st.cardTitle}><FaTrophy color="#fbbf24" /> Sua Posição no Ranking</h4>

          {posicao === null && totalJogadores === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 0", color: "#475569", fontSize: "13px" }}>
              <FaTrophy size={36} style={{ opacity: 0.15, display: "block", margin: "0 auto 12px" }} />
              Responda questões para entrar no ranking.
            </div>
          ) : (
            <>
              <div style={{ textAlign: "center", padding: "24px 0 16px" }}>
                <div style={{
                  fontSize: "64px", fontWeight: "900", lineHeight: 1,
                  color: posicao === 1 ? "#fbbf24" : posicao <= 3 ? "#94a3b8" : "#818cf8"
                }}>
                  #{posicao || "—"}
                </div>
                <p style={{ color: "#64748b", fontSize: "12px", margin: "8px 0 0" }}>
                  entre <strong style={{ color: "#fff" }}>{totalJogadores}</strong> médico{totalJogadores !== 1 ? "s" : ""} ativos
                </p>
              </div>

              <div style={{ background: "#0f172a", borderRadius: "14px", padding: "14px 16px", margin: "8px 0 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span style={{ color: "#64748b", fontSize: "11px" }}>Seu percentil</span>
                  <span style={{ color: "#fff", fontSize: "11px", fontWeight: "700" }}>
                    {totalJogadores > 0 && posicao
                      ? `Top ${Math.ceil((posicao / totalJogadores) * 100)}%`
                      : "—"}
                  </span>
                </div>
                <div style={{ background: "#1e293b", borderRadius: "100px", height: "6px", overflow: "hidden" }}>
                  <div style={{
                    width: totalJogadores > 0 && posicao
                      ? `${100 - Math.ceil((posicao / totalJogadores) * 100)}%`
                      : "0%",
                    height: "100%",
                    background: "linear-gradient(90deg, #4f46e5, #818cf8)",
                    borderRadius: "100px",
                    transition: "width 1s ease-out"
                  }} />
                </div>
              </div>

              {posicao === 1 && (
                <div style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: "12px", padding: "10px 14px", marginBottom: "14px", fontSize: "12px", color: "#fde68a", textAlign: "center" }}>
                  🏆 Você é o líder do ranking!
                </div>
              )}
              {posicao > 1 && posicao <= 3 && (
                <div style={{ background: "rgba(148,163,184,0.08)", border: "1px solid rgba(148,163,184,0.2)", borderRadius: "12px", padding: "10px 14px", marginBottom: "14px", fontSize: "12px", color: "#94a3b8", textAlign: "center" }}>
                  🥈 Top 3 — continue assim!
                </div>
              )}

              <button
                onClick={() => navigate("/ranking")}
                style={{ width: "100%", background: "#4f46e5", border: "none", color: "#fff", borderRadius: "12px", padding: "12px", fontWeight: "700", fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
              >
                <FaTrophy size={12} /> VER RANKING COMPLETO
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const st = {
  container: {
    padding: "30px",
    background: "#020617",
    minHeight: "100vh",
    fontFamily: "'Inter', sans-serif"
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "28px",
    flexWrap: "wrap",
    gap: "12px"
  },
  title: {
    color: "#fff",
    fontSize: "clamp(18px, 3vw, 26px)",
    fontWeight: "800",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    margin: 0
  },
  subtitle: { color: "#64748b", fontSize: "14px", margin: "4px 0 0" },
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: "20px",
    alignItems: "start"
  },
  card: {
    background: "#1e293b",
    borderRadius: "20px",
    padding: "22px",
    border: "1px solid #334155"
  },
  cardTitle: {
    color: "#fff",
    fontSize: "15px",
    fontWeight: "700",
    margin: 0,
    display: "flex",
    alignItems: "center",
    gap: "8px"
  },
  fotoContainer: {
    display: "flex",
    alignItems: "flex-start",
    gap: "20px",
    flexWrap: "wrap"
  },
  fotoWrapper: { position: "relative", flexShrink: 0 },
  fotoBtn: {
    position: "absolute",
    bottom: 0,
    right: 0,
    background: "#4f46e5",
    color: "#fff",
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    border: "2px solid #1e293b"
  },
  input: {
    width: "100%",
    padding: "10px 14px",
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: "10px",
    color: "#fff",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box"
  },
  btnEdit: {
    padding: "10px 20px",
    background: "rgba(79,70,229,0.15)",
    color: "#818cf8",
    border: "1px solid rgba(79,70,229,0.3)",
    borderRadius: "12px",
    fontWeight: "700",
    cursor: "pointer",
    fontSize: "12px"
  },
  btnSave: {
    padding: "10px 20px",
    background: "#10b981",
    color: "#fff",
    border: "none",
    borderRadius: "12px",
    fontWeight: "700",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "12px"
  },
  btnCancel: {
    padding: "10px",
    background: "rgba(239,68,68,0.1)",
    color: "#ef4444",
    border: "1px solid rgba(239,68,68,0.2)",
    borderRadius: "12px",
    cursor: "pointer"
  },
  btnDanger: {
    width: "100%",
    padding: "12px",
    background: "rgba(239,68,68,0.1)",
    color: "#ef4444",
    border: "1px solid rgba(239,68,68,0.2)",
    borderRadius: "12px",
    fontWeight: "700",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    fontSize: "13px"
  },
  btnSair: {
    width: "100%",
    padding: "12px",
    background: "transparent",
    color: "#64748b",
    border: "none",
    borderRadius: "12px",
    fontWeight: "700",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    fontSize: "13px",
    marginTop: "10px"
  },
  loading: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    color: "#64748b",
    padding: "40px"
  }
};

export default Perfil;