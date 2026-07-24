import React, { useState } from "react";
import { FaLightbulb, FaComments, FaPaperPlane, FaStethoscope, FaUserCircle, FaShieldAlt } from "react-icons/fa";

const renderAlertaRecursoVisual = (recursoVisual, imagemUrl, imagemStoragePath, tabelaDados, graficoDados) => {
  if (!recursoVisual?.necessitaImagem) return null;
  if (imagemUrl) return null;
  if (imagemStoragePath) return null;
  if (tabelaDados?.linhas?.length > 0) return null;
  if (graficoDados?.dados?.length > 0) return null;
  return (
    <div style={{
      background: "#0f172a", border: "2px dashed rgba(234,179,8,0.35)",
      borderRadius: "12px", padding: "14px 18px", display: "flex", flexDirection: "column", gap: "5px"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "15px" }}>📷</span>
        <span style={{ fontSize: "11px", fontWeight: "900", color: "#fbbf24", letterSpacing: "0.5px", textTransform: "uppercase" }}>
          IMAGEM OFICIAL NECESSÁRIA
        </span>
      </div>
      {recursoVisual.tipo && (
        <div style={{ fontSize: "12px", color: "#94a3b8" }}>
          <span style={{ color: "#64748b" }}>Tipo: </span>
          <span style={{ color: "#e2e8f0", fontWeight: "600" }}>{recursoVisual.tipo.replace(/_/g, " ")}</span>
        </div>
      )}
      {recursoVisual.arquivoEsperado && (
        <div style={{ fontSize: "12px", color: "#94a3b8" }}>
          <span style={{ color: "#64748b" }}>Arquivo esperado: </span>
          <code style={{ color: "#fbbf24", fontSize: "11px", background: "rgba(251,191,36,0.08)", padding: "2px 7px", borderRadius: "4px" }}>
            {recursoVisual.arquivoEsperado}
          </code>
        </div>
      )}
      {recursoVisual.observacao && (
        <div style={{ fontSize: "11px", color: "#64748b" }}>{recursoVisual.observacao}</div>
      )}
      <div style={{ fontSize: "11px", color: "#475569", fontStyle: "italic", marginTop: "2px" }}>
        Adicione a imagem oficial na Biblioteca RevalidaPRO.
      </div>
    </div>
  );
};

const parseRaciocinio = (texto) => {
  if (!texto) return null;
  const result = {};
  const matches = [...texto.matchAll(/\b(PADRÃO|DIFERENCIAL|DECISÃO|ARMADILHA):\s*([^→]+)/gi)];
  if (matches.length < 2) return null;
  matches.forEach(m => { result[m[1].toUpperCase()] = m[2].trim().replace(/\s*→\s*$/, ""); });
  return result;
};

const SimuladorFeedback = ({ questao, duvidasDaQuestao, aoEnviarDuvida, totalDuvidas = 0 }) => {
  const [exibirChat, setExibirChat] = useState(false);
  const [novaDuvida, setNovaDuvida] = useState("");

  if (!questao) return null;

  return (
    <div style={st.container}>
      <div style={st.actionRow}>
        <div style={st.labelSection}>
          <FaStethoscope /> ANÁLISE CLÍNICA
        </div>
        <button 
          onClick={() => setExibirChat(!exibirChat)} 
          className="feedback-forum-btn"
          style={{ 
            ...st.btnForum,
            background: exibirChat ? '#4f46e5' : 'rgba(79, 70, 229, 0.1)',
            color: exibirChat ? '#fff' : '#818cf8', 
          }}
        >
          <style>{`.feedback-forum-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(79,70,229,0.25); } .feedback-forum-btn:active { transform: translateY(0); } .send-btn:hover { filter: brightness(1.15); transform: scale(1.02); } .send-btn:active { transform: scale(0.95); } .dica-box:hover { border-left-width: 6px; }`}</style>
          <FaComments /> 
          FÓRUM ({totalDuvidas})
        </button>
      </div>

      {/* ÁREA DO FÓRUM ESTILIZADA */}
      {exibirChat && (
        <div style={st.forumBox}>
          <header style={st.forumHeader}>Discussão entre Colegas</header>
          
          <div style={st.chatScroll}>
            {duvidasDaQuestao?.length > 0 ? duvidasDaQuestao.map((d, idx) => (
              <div key={idx} style={st.msgBubble}>
                <FaUserCircle color="#475569" />
                <div>
                  <b style={st.alunoNome}>{d.alunoNome}</b>
                  <p style={st.msgTexto}>{d.texto}</p>
                </div>
              </div>
            )) : (
              <p style={st.empty}>Seja o primeiro a tirar uma dúvida sobre este caso.</p>
            )}
          </div>

          <div style={st.inputArea}>
            <input 
              value={novaDuvida}
              onChange={(e) => setNovaDuvida(e.target.value)}
              placeholder="Sua dúvida para o Dr. Weyne..."
              style={st.input}
            />
              <button 
              onClick={() => { if(novaDuvida) { aoEnviarDuvida(novaDuvida); setNovaDuvida(""); } }} 
              className="send-btn"
              style={st.btnSend}
            >
              <FaPaperPlane />
            </button>
          </div>
        </div>
      )}

      {/* ALERTA RECURSO VISUAL PENDENTE */}
      {renderAlertaRecursoVisual(questao.recursoVisual, questao.imagemUrl, questao.imagemStoragePath, questao.tabelaDados, questao.graficoDados)}

      {/* ANÁLISE CLÍNICA — raciocínio parseado + dica mestre premium */}
      <div style={st.justificativaContent}>
        {(() => {
          const rp = parseRaciocinio(questao.raciocinio);
          if (rp) return (
            <div style={st.racioBox}>
              <div style={st.racioHeader}><FaStethoscope size={10} color="#818cf8" /> 🧠 RACIOCÍNIO CLÍNICO</div>
              <div style={st.racioGrid}>
                {[
                  { key: "PADRÃO",      cor: "#3b82f6", icon: "🔍" },
                  { key: "DIFERENCIAL", cor: "#f97316", icon: "⚖"  },
                  { key: "DECISÃO",     cor: "#10b981", icon: "✓"  },
                  { key: "ARMADILHA",   cor: "#ef4444", icon: "⚠"  },
                ].filter(e => rp[e.key]).map(({ key, cor, icon }) => (
                  <div key={key} style={{ padding: "9px 12px", background: "#020617", borderRadius: "9px", borderTop: `2px solid ${cor}` }}>
                    <div style={{ fontSize: "9px", fontWeight: "900", color: cor, marginBottom: "4px" }}>{icon} {key}</div>
                    <p style={{ fontSize: "13px", color: "#cbd5e1", margin: 0, lineHeight: 1.5 }}>{rp[key]}</p>
                  </div>
                ))}
              </div>
            </div>
          );
          return <p style={st.mainText}>{questao.raciocinio || questao.explicacao || "Aguardando análise da banca..."}</p>;
        })()}

        {questao.fonte_diretriz && (
          <div style={st.diretrizBadge}>
            <FaShieldAlt size={9} color="#10b981" />
            <span style={{ fontSize: "11px", color: "#10b981", fontWeight: "700" }}>
              {questao.fonte_diretriz}{questao.ano_diretriz ? ` · ${questao.ano_diretriz}` : ""}
            </span>
          </div>
        )}

        {questao.dicaMestre && (
          <div style={st.dicaBox}>
            <div style={st.dicaLabel}><FaLightbulb /> 🎯 DICA MESTRE</div>
            <p style={st.dicaTexto}>{questao.dicaMestre}</p>
          </div>
        )}
      </div>
    </div>
  );
};

const st = {
  container: { marginTop: '30px', borderTop: '1px solid #334155', paddingTop: '20px' },
  actionRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  labelSection: { display: 'flex', alignItems: 'center', gap: '10px', color: '#818cf8', fontWeight: '900', fontSize: '12px', letterSpacing: '1px' },
  btnForum: { display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #4f46e5', padding: '10px 18px', borderRadius: '12px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)' },
  forumBox: { marginBottom: '25px', padding: '20px', background: '#0f172a', borderRadius: '20px', border: '1px solid #334155', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' },
  forumHeader: { color: '#fff', fontSize: '14px', fontWeight: 'bold', marginBottom: '15px' },
  chatScroll: { maxHeight: '250px', overflowY: 'auto', marginBottom: '15px', paddingRight: '10px' },
  msgBubble: { display: 'flex', gap: '12px', padding: '12px', background: '#1e293b', borderRadius: '12px', marginBottom: '10px' },
  alunoNome: { fontSize: '12px', color: '#818cf8', display: 'block', marginBottom: '4px' },
  msgTexto: { color: '#cbd5e1', fontSize: '13px', margin: 0, lineHeight: '1.4' },
  inputArea: { display: 'flex', gap: '10px' },
  input: { flex: 1, padding: '12px', borderRadius: '10px', background: '#020617', border: '1px solid #334155', color: '#fff', outline: 'none', transition: 'border-color 0.2s ease' },
  btnSend: { background: '#4f46e5', border: 'none', borderRadius: '10px', color: '#fff', padding: '0 18px', cursor: 'pointer', transition: 'all 0.2s ease' },
  justificativaContent: { display: 'flex', flexDirection: 'column', gap: '15px' },
  mainText: { fontSize: '15px', lineHeight: '1.7', color: '#cbd5e1', margin: 0 },
  racioBox: { background: '#0f172a', padding: '14px', borderRadius: '13px', borderTop: '3px solid #4f46e5' },
  racioHeader: { fontSize: '10px', fontWeight: '900', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', letterSpacing: '0.5px', textTransform: 'uppercase' },
  racioGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '7px' },
  diretrizBadge: { display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '8px' },
  dicaBox: { padding: '16px 18px', background: 'linear-gradient(135deg,rgba(251,191,36,0.07) 0%,rgba(251,191,36,0.02) 100%)', borderRadius: '13px', border: '1px solid rgba(251,191,36,0.2)' },
  dicaLabel: { fontSize: '11px', fontWeight: '900', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' },
  dicaTexto: { fontSize: '15px', color: '#fef3c7', margin: 0, fontStyle: 'italic', fontWeight: '500', lineHeight: 1.65 },
  empty: { textAlign: 'center', color: '#475569', fontSize: '12px', padding: '20px' }
};

export default SimuladorFeedback;