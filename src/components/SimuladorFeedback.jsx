import React, { useState } from "react";
import { FaLightbulb, FaComments, FaPaperPlane, FaStethoscope, FaUserCircle } from "react-icons/fa";

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
          style={{ 
            ...st.btnForum,
            background: exibirChat ? '#4f46e5' : 'rgba(79, 70, 229, 0.1)',
            color: exibirChat ? '#fff' : '#818cf8', 
          }}
        >
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
              style={st.btnSend}
            >
              <FaPaperPlane />
            </button>
          </div>
        </div>
      )}

      {/* JUSTIFICATIVA SINCRONIZADA COM O NOVO BANCO */}
      <div style={st.justificativaContent}>
        <p style={st.mainText}>
          {questao.raciocinio || questao.explicacao || "Aguardando análise da banca..."}
        </p>
        
        {questao.dicaMestre && (
          <div style={st.dicaBox}>
            <div style={st.dicaLabel}><FaLightbulb /> DICA MESTRE</div>
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
  btnForum: { display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #4f46e5', padding: '10px 18px', borderRadius: '12px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', transition: '0.3s' },
  forumBox: { marginBottom: '25px', padding: '20px', background: '#0f172a', borderRadius: '20px', border: '1px solid #334155', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' },
  forumHeader: { color: '#fff', fontSize: '14px', fontWeight: 'bold', marginBottom: '15px' },
  chatScroll: { maxHeight: '250px', overflowY: 'auto', marginBottom: '15px', paddingRight: '10px' },
  msgBubble: { display: 'flex', gap: '12px', padding: '12px', background: '#1e293b', borderRadius: '12px', marginBottom: '10px' },
  alunoNome: { fontSize: '12px', color: '#818cf8', display: 'block', marginBottom: '4px' },
  msgTexto: { color: '#cbd5e1', fontSize: '13px', margin: 0, lineHeight: '1.4' },
  inputArea: { display: 'flex', gap: '10px' },
  input: { flex: 1, padding: '12px', borderRadius: '10px', background: '#020617', border: '1px solid #334155', color: '#fff', outline: 'none' },
  btnSend: { background: '#4f46e5', border: 'none', borderRadius: '10px', color: '#fff', padding: '0 18px', cursor: 'pointer' },
  justificativaContent: { display: 'flex', flexDirection: 'column', gap: '15px' },
  mainText: { fontSize: '15px', lineHeight: '1.7', color: '#cbd5e1', margin: 0 },
  dicaBox: { padding: '15px', background: 'rgba(251, 191, 36, 0.05)', borderRadius: '12px', borderLeft: '4px solid #fbbf24' },
  dicaLabel: { fontSize: '10px', fontWeight: '900', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' },
  dicaTexto: { fontSize: '14px', color: '#f1f5f9', margin: 0, fontStyle: 'italic' },
  empty: { textAlign: 'center', color: '#475569', fontSize: '12px', padding: '20px' }
};

export default SimuladorFeedback;