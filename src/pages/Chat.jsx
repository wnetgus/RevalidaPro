import React, { useState, useEffect, useRef } from "react";
import { db, auth } from "../firebase";
import {
  collection, query, where, orderBy, onSnapshot,
  addDoc, deleteDoc, doc, serverTimestamp, Timestamp
} from "firebase/firestore";
import { FaPaperPlane, FaTrash, FaUsers, FaCircle, FaCommentDots } from "react-icons/fa";

const CORES = ["#4f46e5","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#ec4899","#84cc16","#f97316","#14b8a6"];

const corDoUsuario = (uid = "") => {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) hash = uid.charCodeAt(i) + ((hash << 5) - hash);
  return CORES[Math.abs(hash) % CORES.length];
};

const inicialAvatar = (nome = "") => {
  const partes = nome.trim().split(" ");
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
  return (partes[0][0] || "?").toUpperCase();
};

const Chat = ({ usuario }) => {
  const [mensagens, setMensagens] = useState([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const bottomRef = useRef(null);

  const meuId = usuario?.id || auth.currentUser?.uid || "";
  const isAdmin = ["drweynesouza@gmail.com", "wnetgus@gmail.com"].includes(usuario?.email) || usuario?.role === "admin" || usuario?.role === "colaborador";
  const meuNome = isAdmin ? "Preceptor" : (usuario?.nome || "Médico");

  // Marca visita para zerar badge na sidebar
  useEffect(() => {
    localStorage.setItem("revalida_ultima_visita_sala", Date.now().toString());
  }, []);

  // Listener mensagens últimas 24h
  useEffect(() => {
    const limite24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const q = query(
      collection(db, "sala_chat"),
      where("criadoEm", ">=", Timestamp.fromDate(limite24h)),
      orderBy("criadoEm", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setMensagens(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});
    return () => unsub();
  }, []);

  // Contador de alunos online — usa ultimaAtividade (heartbeat a cada 5 min)
  // para evitar contagem de usuários "fantasma" com online: true stale.
  useEffect(() => {
    const ONLINE_MS = 10 * 60 * 1000; // 10 minutos
    const limiteOnline = new Date(Date.now() - ONLINE_MS);
    const q = query(
      collection(db, "usuarios"),
      where("ultimaAtividade", ">=", Timestamp.fromDate(limiteOnline))
    );
    const unsub = onSnapshot(q, (snap) => setOnlineCount(snap.size), () => {});
    return () => unsub();
  }, []);

  // Auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  const enviar = async () => {
    if (!texto.trim() || enviando) return;
    setEnviando(true);
    const textoFinal = texto.trim();
    setTexto("");
    try {
      await addDoc(collection(db, "sala_chat"), {
        texto: textoFinal,
        autorId: meuId,
        autorNome: meuNome,
        autorRole: isAdmin ? "admin" : "aluno",
        criadoEm: serverTimestamp(),
      });
    } catch {
      setTexto(textoFinal);
    } finally {
      setEnviando(false);
    }
  };

  const deletar = async (id) => {
    if (!isAdmin) return;
    await deleteDoc(doc(db, "sala_chat", id)).catch(() => {});
  };

  // Agrupa mensagens por data
  const grupos = [];
  let dataAtual = null;
  for (const msg of mensagens) {
    const data = msg.criadoEm?.toDate ? msg.criadoEm.toDate() : new Date();
    const label = data.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
    if (label !== dataAtual) {
      grupos.push({ tipo: "data", label, key: `d-${label}` });
      dataAtual = label;
    }
    grupos.push({ tipo: "msg", ...msg });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#020617" }}>

      {/* HEADER */}
      <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #1e293b", background: "#0f172a", display: "flex", alignItems: "center", gap: "14px", flexShrink: 0 }}>
        <div style={{ width: "40px", height: "40px", background: "rgba(79,70,229,0.15)", border: "1px solid rgba(79,70,229,0.3)", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <FaCommentDots color="#818cf8" size={16} />
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ color: "#fff", fontWeight: "800", fontSize: "17px", margin: 0 }}>Sala dos Residentes</h2>
          <p style={{ color: "#64748b", fontSize: "12px", margin: "2px 0 0" }}>Mensagens das últimas 24h · Ambiente colaborativo</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", padding: "6px 14px", borderRadius: "100px", flexShrink: 0 }}>
          <FaCircle color="#10b981" size={7} />
          <FaUsers color="#10b981" size={11} />
          <span style={{ color: "#10b981", fontSize: "12px", fontWeight: "700" }}>{onlineCount} online</span>
        </div>
      </div>

      {/* AVISO */}
      <div style={{ padding: "8px 24px", background: "rgba(251,191,36,0.04)", borderBottom: "1px solid rgba(251,191,36,0.08)", flexShrink: 0 }}>
        <p style={{ color: "#78350f", fontSize: "11px", margin: 0, textAlign: "center" }}>
          💬 Espaço para marcar estudos, tirar dúvidas entre colegas e trocar experiências. Respeite os colegas.
        </p>
      </div>

      {/* MENSAGENS */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: "2px" }}>
        {grupos.length === 0 && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", color: "#475569", paddingTop: "60px" }}>
            <FaCommentDots size={40} color="#1e293b" />
            <p style={{ fontSize: "14px", margin: 0 }}>Nenhuma mensagem nas últimas 24h.</p>
            <p style={{ fontSize: "13px", margin: 0, color: "#334155" }}>Seja o primeiro a falar!</p>
          </div>
        )}

        {grupos.map((item) => {
          if (item.tipo === "data") return (
            <div key={item.key} style={{ display: "flex", alignItems: "center", gap: "12px", margin: "16px 0 8px" }}>
              <div style={{ flex: 1, height: "1px", background: "#1e293b" }} />
              <span style={{ color: "#475569", fontSize: "11px", fontWeight: "700", whiteSpace: "nowrap" }}>{item.label}</span>
              <div style={{ flex: 1, height: "1px", background: "#1e293b" }} />
            </div>
          );

          const minha = item.autorId === meuId;
          const cor = item.autorRole === "admin" ? "#fbbf24" : corDoUsuario(item.autorId || "");
          const inicial = inicialAvatar(item.autorNome);
          const hora = item.criadoEm?.toDate
            ? item.criadoEm.toDate().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
            : "";

          return (
            <div key={item.id} style={{ display: "flex", gap: "8px", alignItems: "flex-end", justifyContent: minha ? "flex-end" : "flex-start", marginBottom: "6px" }}>

              {!minha && (
                <div style={{ width: "34px", height: "34px", borderRadius: "50%", background: cor, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "11px", fontWeight: "900", color: "#fff" }}>
                  {inicial}
                </div>
              )}

              <div style={{ maxWidth: "68%" }}>
                {!minha && (
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px", paddingLeft: "2px" }}>
                    <span style={{ color: cor, fontSize: "11px", fontWeight: "800" }}>{item.autorNome}</span>
                    {item.autorRole === "admin" && (
                      <span style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24", fontSize: "9px", fontWeight: "900", padding: "2px 7px", borderRadius: "100px" }}>
                        PRECEPTOR
                      </span>
                    )}
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <div style={{
                    background: minha ? "linear-gradient(135deg, #4f46e5, #4338ca)" : item.autorRole === "admin" ? "rgba(251,191,36,0.08)" : "#1e293b",
                    border: minha ? "none" : item.autorRole === "admin" ? "1px solid rgba(251,191,36,0.25)" : "1px solid #2d3748",
                    color: "#f1f5f9", padding: "10px 14px",
                    borderRadius: minha ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                    fontSize: "14px", lineHeight: 1.55, wordBreak: "break-word",
                    boxShadow: minha ? "0 4px 12px rgba(79,70,229,0.2)" : "none"
                  }}>
                    {item.texto}
                    <span style={{ color: minha ? "rgba(255,255,255,0.45)" : "#475569", fontSize: "10px", marginLeft: "10px", whiteSpace: "nowrap" }}>
                      {hora}
                    </span>
                  </div>

                  {isAdmin && !minha && (
                    <button
                      onClick={() => deletar(item.id)}
                      title="Deletar mensagem"
                      style={{ background: "none", border: "none", color: "#334155", cursor: "pointer", padding: "4px", flexShrink: 0 }}
                      onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
                      onMouseLeave={e => e.currentTarget.style.color = "#334155"}
                    >
                      <FaTrash size={11} />
                    </button>
                  )}
                </div>
              </div>

              {minha && (
                <div style={{ width: "34px", height: "34px", borderRadius: "50%", background: isAdmin ? "#fbbf24" : "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "11px", fontWeight: "900", color: "#fff" }}>
                  {inicialAvatar(meuNome)}
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* INPUT */}
      <div style={{ padding: "14px 20px", borderTop: "1px solid #1e293b", background: "#0f172a", display: "flex", gap: "10px", flexShrink: 0 }}>
        <input
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
          placeholder={`Mensagem para a sala${isAdmin ? " (como Preceptor)" : ""}...`}
          maxLength={500}
          style={{ flex: 1, background: "#1e293b", border: "1px solid #334155", borderRadius: "12px", padding: "12px 16px", color: "#fff", fontSize: "14px", outline: "none", fontFamily: "inherit" }}
          onFocus={e => e.target.style.borderColor = "#4f46e5"}
          onBlur={e => e.target.style.borderColor = "#334155"}
        />
        <button
          onClick={enviar}
          disabled={!texto.trim() || enviando}
          style={{ background: "#4f46e5", border: "none", borderRadius: "12px", padding: "0 20px", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", fontWeight: "700", fontSize: "13px", opacity: !texto.trim() || enviando ? 0.5 : 1, flexShrink: 0 }}
        >
          <FaPaperPlane size={13} /> Enviar
        </button>
      </div>
    </div>
  );
};

export default Chat;
