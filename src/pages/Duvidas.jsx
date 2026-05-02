import React, { useState, useEffect, useMemo } from "react";
import { db } from "../firebase";
import {
  collection, query, where, onSnapshot, deleteDoc, doc,
  arrayUnion, updateDoc, addDoc, serverTimestamp, writeBatch
} from "firebase/firestore";
import {
  FaTrash, FaSearch, FaCommentDots, FaCheckCircle,
  FaHourglassHalf, FaPaperPlane, FaPlus, FaBookOpen,
  FaStethoscope, FaBell
} from "react-icons/fa";

const Duvidas = ({ usuario }) => {
  const [minhasDuvidas, setMinhasDuvidas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [termoBusca, setTermoBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("Todas");
  const [novaDuvida, setNovaDuvida] = useState("");
  const [materiaSelecionada, setMateriaSelecionada] = useState("Clínica Médica");
  const [enviando, setEnviando] = useState(false);
  const [_isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ✅ LÓGICA ORIGINAL PRESERVADA
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!usuario?.id) { setCarregando(false); return; }

    const q = query(collection(db, "duvidas_questoes"), where("alunoId", "==", usuario.id));

    const unsubscribe = onSnapshot(q, (s) => {
      const docs = s.docs.map(d => ({ id: d.id, ...d.data() }));
      const ordenadas = docs.sort((a, b) => {
        const timeA = a.criadoEm?.seconds || a.dataEnvio?.seconds || 0;
        const timeB = b.criadoEm?.seconds || b.dataEnvio?.seconds || 0;
        return timeB - timeA;
      });
      setMinhasDuvidas(ordenadas);
      setCarregando(false);

      const batch = writeBatch(db);
      s.docs.forEach(d => {
        if (d.data().respondida && !d.data().visualizadaPeloAluno) {
          batch.update(doc(db, "duvidas_questoes", d.id), { visualizadaPeloAluno: true });
        }
      });
      batch.commit().catch(() => {});
    });
    return () => unsubscribe();
  }, [usuario]);

  // ✅ LÓGICA ORIGINAL PRESERVADA
  const criarDuvida = async () => {
    if (!novaDuvida.trim()) return;
    setEnviando(true);
    try {
      await addDoc(collection(db, "duvidas_questoes"), {
        alunoId: usuario.id,
        usuarioId: usuario.id,
        alunoNome: usuario.nome || "Dr. Colega",
        usuarioNome: usuario.nome || "Dr. Colega",
        materia: materiaSelecionada,
        duvida: novaDuvida,
        duvidaTexto: novaDuvida,
        respondida: false,
        status: "pendente",
        visualizadaPeloAluno: true,
        criadoEm: serverTimestamp(),
        dataEnvio: serverTimestamp(),
        mensagens: []
      });
      setNovaDuvida("");
    } catch (error) { console.error(error); }
    setEnviando(false);
  };

  // ✅ LÓGICA ORIGINAL PRESERVADA
  const enviarReplica = async (id) => {
    const input = document.getElementById(`repl-${id}`);
    const texto = input?.value?.trim();
    if (!texto) return;
    await updateDoc(doc(db, "duvidas_questoes", id), {
      mensagens: arrayUnion({ remetente: "aluno", texto, data: new Date().toISOString() }),
      respondida: false,
      status: "pendente",
      visualizadaPeloAluno: true,
      ultimaInteracao: serverTimestamp()
    });
    input.value = "";
  };

  const handleExcluir = async (id) => {
    if (window.confirm("Doutor, deseja excluir este histórico permanentemente?")) {
      await deleteDoc(doc(db, "duvidas_questoes", id));
    }
  };

  const duvidasFiltradas = useMemo(() => {
    return minhasDuvidas.filter(d => {
      const textoDuvida = (d.duvida || d.duvidaTexto || "").toLowerCase();
      const matchBusca = textoDuvida.includes(termoBusca.toLowerCase());
      const matchStatus = filtroStatus === "Todas" ||
        (filtroStatus === "Respondidas" && d.respondida) ||
        (filtroStatus === "Pendentes" && !d.respondida);
      return matchBusca && matchStatus;
    });
  }, [minhasDuvidas, termoBusca, filtroStatus]);

  const pendentes = minhasDuvidas.filter(d => !d.respondida).length;
  const respondidas = minhasDuvidas.filter(d => d.respondida).length;

  if (carregando) return (
    <div style={st.loading}>
      <div className="spinner"></div>
      <p style={{ marginTop: "16px", color: "#64748b", fontSize: "13px" }}>Sincronizando consultas...</p>
    </div>
  );

  return (
    <div style={st.container}>
      {/* HEADER */}
      <header style={st.header}>
        <div>
          <h1 style={st.titulo}>
            Central de <span style={{ color: "#6366f1" }}>Consultoria</span>
          </h1>
          <p style={st.subtitulo}>Suas dúvidas acadêmicas respondidas por especialistas.</p>
        </div>

        {/* BADGES DE STATUS */}
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <div style={{ ...st.statBadge, borderColor: "#fbbf24", background: "rgba(251,191,36,0.08)" }}>
            <FaHourglassHalf color="#fbbf24" size={12} />
            <span style={{ color: "#fbbf24", fontWeight: "700", fontSize: "13px" }}>{pendentes} pendentes</span>
          </div>
          <div style={{ ...st.statBadge, borderColor: "#10b981", background: "rgba(16,185,129,0.08)" }}>
            <FaCheckCircle color="#10b981" size={12} />
            <span style={{ color: "#10b981", fontWeight: "700", fontSize: "13px" }}>{respondidas} respondidas</span>
          </div>
        </div>
      </header>

      {/* NOVA DÚVIDA */}
      <div style={st.newBox}>
        <div style={st.newHeader}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#818cf8", fontWeight: "700", fontSize: "13px" }}>
            <FaPlus size={12} /> NOVA CONSULTA GERAL
          </div>
          <select
            value={materiaSelecionada}
            onChange={e => setMateriaSelecionada(e.target.value)}
            style={st.miniSelect}
          >
            {["Clínica Médica", "Cirurgia", "Pediatria", "Ginecologia", "Preventiva"].map(m => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </div>
        <textarea
          placeholder="Qual sua dúvida técnica sobre algum tema geral, Doutor?"
          value={novaDuvida}
          onChange={e => setNovaDuvida(e.target.value)}
          style={st.newTextArea}
        />
        <button onClick={criarDuvida} disabled={enviando || !novaDuvida.trim()} style={{
          ...st.btnCriar,
          opacity: enviando || !novaDuvida.trim() ? 0.6 : 1,
          cursor: enviando || !novaDuvida.trim() ? "not-allowed" : "pointer"
        }}>
          <FaPaperPlane size={12} />
          {enviando ? "ENVIANDO..." : "ENVIAR PARA O PRECEPTOR"}
        </button>
      </div>

      {/* BARRA DE FILTROS */}
      <div style={st.filterArea}>
        <div style={st.searchBar}>
          <FaSearch color="#64748b" size={14} />
          <input
            type="text"
            placeholder="Buscar em meu histórico..."
            value={termoBusca}
            onChange={e => setTermoBusca(e.target.value)}
            style={st.inputNoBorder}
          />
        </div>
        <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
          {["Todas", "Pendentes", "Respondidas"].map(f => (
            <button
              key={f}
              onClick={() => setFiltroStatus(f)}
              style={{
                ...st.filterBtn,
                background: filtroStatus === f ? "#4f46e5" : "#1e293b",
                color: filtroStatus === f ? "#fff" : "#94a3b8",
                borderColor: filtroStatus === f ? "#4f46e5" : "#334155"
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* LISTA DE DÚVIDAS */}
      {duvidasFiltradas.length === 0 ? (
        <div style={st.emptyState}>
          <FaCommentDots size={40} style={{ opacity: 0.15, marginBottom: "16px", color: "#818cf8" }} />
          <p style={{ color: "#fff", fontSize: "16px", margin: "0 0 8px" }}>
            {termoBusca ? "Nenhuma dúvida encontrada." : "Nenhuma consulta registrada ainda."}
          </p>
          <small style={{ color: "#64748b" }}>Envie sua primeira dúvida usando o formulário acima.</small>
        </div>
      ) : (
        duvidasFiltradas.map(d => (
          <div key={d.id} style={{ ...st.card, borderTop: d.respondida ? "4px solid #10b981" : "4px solid #fbbf24" }}>
            {/* HEADER DO CARD */}
            <div style={st.cardHeader}>
              <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                <span style={st.tagMateria}>{d.materia || "Sem matéria"}</span>
                {d.respondida ? (
                  <span style={st.statusOk}><FaCheckCircle size={10} /> RESPONDIDA</span>
                ) : (
                  <span style={st.statusWait}><FaHourglassHalf size={10} /> EM ANÁLISE</span>
                )}
              </div>
              <button onClick={() => handleExcluir(d.id)} style={st.btnTrash} title="Excluir">
                <FaTrash size={13} />
              </button>
            </div>

            {/* CONTEXTO DA QUESTÃO (se vier do simulador) */}
            {d.enunciado && (
              <div style={st.contextoQuestao}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#818cf8", fontWeight: "bold", marginBottom: "5px", fontSize: "11px" }}>
                  <FaBookOpen size={11} /> Referente à questão {d.numeroQuestao} {d.provaId && `(${d.provaId})`}
                </div>
                <p style={{ margin: 0, fontSize: "12px", color: "#cbd5e1", fontStyle: "italic", lineHeight: 1.5 }}>
                  "{d.enunciado.substring(0, 140)}..."
                </p>
              </div>
            )}

            {/* PERGUNTA PRINCIPAL */}
            <div style={st.perguntaPrincipal}>
              <FaCommentDots color="#818cf8" size={18} style={{ minWidth: "18px", marginTop: "2px" }} />
              <p style={{ margin: 0, fontWeight: "600", fontSize: "14px", lineHeight: 1.6, color: "#f1f5f9" }}>
                {d.duvidaTexto || d.duvida}
              </p>
            </div>

            {/* CHAT DE MENSAGENS */}
            {d.mensagens && d.mensagens.length > 0 && (
              <div style={st.chatContainer}>
                {d.mensagens.map((msg, i) => {
                  const isAdmin = msg.remetente === "admin" || msg.remetente === "preceptor";
                  return (
                    <div key={i} style={{ ...st.msgWrapper, justifyContent: isAdmin ? "flex-start" : "flex-end" }}>
                      <div style={{
                        ...st.bubble,
                        background: isAdmin ? "#1e293b" : "#4f46e5",
                        border: isAdmin ? "1px solid #334155" : "none",
                        borderRadius: isAdmin ? "4px 18px 18px 18px" : "18px 18px 4px 18px"
                      }}>
                        <small style={st.msgLabel}>{isAdmin ? "PRECEPTOR" : "VOCÊ"}</small>
                        <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.5 }}>{msg.texto}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* RÉPLICA */}
            <div style={st.replicaContainer}>
              <textarea
                id={`repl-${d.id}`}
                placeholder="Escrever réplica ou follow-up..."
                style={st.textArea}
                rows={2}
              />
              <button onClick={() => enviarReplica(d.id)} style={st.btnEnviar} title="Enviar réplica">
                <FaPaperPlane size={14} />
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

const st = {
  container: { color: "#fff", padding: "clamp(16px, 3vw, 30px)", maxWidth: "860px", margin: "0 auto", paddingBottom: "100px", minHeight: "100vh", background: "#020617" },
  loading: { height: "80vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" },
  header: { marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" },
  titulo: { fontSize: "clamp(22px, 4vw, 28px)", fontWeight: "900", margin: 0 },
  subtitulo: { color: "#94a3b8", fontSize: "13px", margin: "4px 0 0" },
  statBadge: { display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "100px", border: "1px solid" },
  newBox: { background: "#0f172a", padding: "clamp(18px, 3vw, 24px)", borderRadius: "20px", border: "1px solid #1e293b", marginBottom: "24px" },
  newHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "10px" },
  miniSelect: { background: "#1e293b", color: "#fff", border: "1px solid #334155", padding: "8px 12px", borderRadius: "10px", fontSize: "12px", outline: "none", cursor: "pointer" },
  newTextArea: { width: "100%", background: "#020617", border: "1px solid #1e293b", borderRadius: "14px", color: "#fff", padding: "14px", minHeight: "100px", resize: "vertical", marginBottom: "14px", outline: "none", fontSize: "14px", lineHeight: 1.6, fontFamily: "inherit", boxSizing: "border-box" },
  btnCriar: { width: "100%", background: "#4f46e5", color: "#fff", border: "none", padding: "14px", borderRadius: "12px", fontWeight: "700", transition: "0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", fontSize: "13px" },
  filterArea: { display: "flex", gap: "12px", marginBottom: "20px", alignItems: "center", flexWrap: "wrap" },
  searchBar: { flex: 1, minWidth: "180px", display: "flex", alignItems: "center", gap: "10px", background: "#0f172a", padding: "0 14px", borderRadius: "12px", border: "1px solid #1e293b", height: "44px" },
  inputNoBorder: { background: "none", border: "none", color: "#fff", width: "100%", outline: "none", fontSize: "13px" },
  filterBtn: { padding: "8px 14px", borderRadius: "10px", border: "1px solid", fontWeight: "700", fontSize: "11px", cursor: "pointer", transition: "0.15s", whiteSpace: "nowrap" },
  emptyState: { textAlign: "center", padding: "60px 20px", color: "#64748b", display: "flex", flexDirection: "column", alignItems: "center" },
  card: { background: "#0f172a", padding: "clamp(16px, 3vw, 24px)", borderRadius: "20px", marginBottom: "20px", border: "1px solid #1e293b" },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px", flexWrap: "wrap", gap: "10px" },
  tagMateria: { fontSize: "10px", fontWeight: "800", background: "rgba(99,102,241,0.1)", color: "#818cf8", padding: "5px 12px", borderRadius: "8px" },
  statusOk: { fontSize: "11px", color: "#10b981", fontWeight: "bold", display: "flex", alignItems: "center", gap: "4px" },
  statusWait: { fontSize: "11px", color: "#fbbf24", fontWeight: "bold", display: "flex", alignItems: "center", gap: "4px" },
  btnTrash: { background: "transparent", border: "none", color: "#475569", cursor: "pointer", padding: "4px", transition: "0.2s" },
  contextoQuestao: { background: "#1e293b", padding: "12px 14px", borderRadius: "12px", borderLeft: "3px solid #818cf8", marginBottom: "14px" },
  perguntaPrincipal: { display: "flex", gap: "12px", background: "#020617", padding: "14px 16px", borderRadius: "14px", marginBottom: "16px", alignItems: "flex-start" },
  chatContainer: { display: "flex", flexDirection: "column", gap: "12px", marginBottom: "16px" },
  msgWrapper: { display: "flex", width: "100%" },
  bubble: { maxWidth: "88%", padding: "12px 16px" },
  msgLabel: { fontSize: "9px", fontWeight: "900", opacity: 0.5, marginBottom: "4px", display: "block", letterSpacing: "0.5px" },
  replicaContainer: { display: "flex", gap: "10px", background: "#020617", padding: "10px", borderRadius: "14px", border: "1px solid #1e293b", alignItems: "flex-end" },
  textArea: { flex: 1, background: "none", border: "none", color: "#fff", padding: "8px", resize: "none", outline: "none", fontSize: "13px", lineHeight: 1.5, fontFamily: "inherit" },
  btnEnviar: { background: "#4f46e5", border: "none", color: "#fff", width: "44px", height: "44px", borderRadius: "10px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
};

export default Duvidas;
