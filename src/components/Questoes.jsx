/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, getDocs, query, where, orderBy, limit } from "firebase/firestore";
import { FaFilter, FaSearch, FaBook, FaStethoscope, FaFlask, FaLightbulb, FaChevronDown, FaChevronUp, FaImage } from "react-icons/fa";

const Questoes = () => {
  const [questoes, setQuestoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [filtroMateria, setFiltroMateria] = useState("Todas");
  const [expandida, setExpandida] = useState(null); // Para abrir/fechar os detalhes

  const carregar = async () => {
    setCarregando(true);
    try {
      let q;
      const ref = collection(db, "questoes");
      
      if (filtroMateria === "Todas") {
        q = query(ref, orderBy("criadoEm", "desc"), limit(100));
      } else {
        q = query(ref, where("materia", "==", filtroMateria), orderBy("criadoEm", "desc"));
      }

      const snap = await getDocs(q);
      const lista = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));

      setQuestoes(lista);
    } catch (error) {
      console.error("Erro ao carregar acervo:", error);
    }
    setCarregando(false);
  };

  useEffect(() => {

    carregar();
  }, [filtroMateria]);

  return (
    <div style={st.container}>
      <header style={st.header}>
        <div>
          <h2 style={st.title}><FaBook color="#818cf8" /> Acervo de Elite</h2>
          <p style={st.subtitle}>Consulte as {questoes.length} questões disponíveis no banco.</p>
        </div>
        
        <div style={st.filterBar}>
          <FaFilter color="#818cf8" size={14} />
          <select 
            value={filtroMateria} 
            onChange={(e) => setFiltroMateria(e.target.value)}
            style={st.select}
          >
            <option value="Todas">Todas as Matérias</option>
            <option value="Clínica Médica">Clínica Médica</option>
            <option value="Cirurgia">Cirurgia</option>
            <option value="Pediatria">Pediatria</option>
            <option value="Ginecologia">Ginecologia</option>
            <option value="Preventiva">Preventiva</option>
          </select>
        </div>
      </header>

      {carregando ? (
        <div style={st.loader}>Sincronizando acervo médico...</div>
      ) : (
        <div style={st.list}>
          {questoes.map((q) => (
            <div key={q.id} style={st.card}>
              <div style={st.badgeRow}>
                <span style={st.materiaBadge}>{q.materia}</span>
                <span style={st.subtemaBadge}>{q.subtema || "Geral"}</span>
                <span style={st.anoBadge}>{q.banca} {q.ano}</span>
              </div>

              <p style={st.enunciado}>{q.enunciado}</p>

              {q.imagemUrl && (
                <div style={st.imgBox}>
                   <img src={q.imagemUrl} alt="Caso Clínico" style={st.img} />
                   <small style={st.imgTag}><FaImage /> Imagem do Caso</small>
                </div>
              )}

              <div style={st.altsGrid}>
                {['A', 'B', 'C', 'D', 'E'].map(l => {
                  const texto = q.alts ? q.alts[l.toLowerCase()]?.texto : q[`alternativa${l}`];
                  if (!texto) return null;
                  
                  return (
                    <div key={l} style={{
                      ...st.altItem, 
                      color: q.gabarito === l ? '#10b981' : '#94a3b8',
                      fontWeight: q.gabarito === l ? 'bold' : 'normal'
                    }}>
                      <b style={{marginRight: '10px'}}>{l})</b> {texto}
                    </div>
                  );
                })}
              </div>

              {/* RODAPÉ DO CARD COM EXPANSÃO */}
              <div style={st.footer}>
                <div style={st.gabBox}>
                  Gabarito: <span style={st.gabTxt}>{q.gabarito}</span>
                </div>
                <button 
                  onClick={() => setExpandida(expandida === q.id ? null : q.id)}
                  style={st.btnExpande}
                >
                  {expandida === q.id ? 'FECHAR ANÁLISE' : 'VER ANÁLISE MESTRE'} 
                  {expandida === q.id ? <FaChevronUp /> : <FaChevronDown />}
                </button>
              </div>

              {/* CONTEÚDO EXPANSÍVEL (DIFERENCIAL) */}
              {expandida === q.id && (
                <div style={st.expArea}>
                  <div style={{...st.infoBox, borderLeftColor: '#ef4444'}}>
                    <label style={st.infoLabel}><FaStethoscope /> RACIOCÍNIO CLÍNICO</label>
                    <p style={st.infoTxt}>{q.raciocinio || "Consulte o Banco de Temas para análise completa."}</p>
                  </div>
                  <div style={{...st.infoBox, borderLeftColor: '#10b981'}}>
                    <label style={st.infoLabel}><FaFlask /> CONDUTA / TTO</label>
                    <p style={st.infoTxt}>{q.tto || "Siga os protocolos de conduta atualizados."}</p>
                  </div>
                  <div style={{...st.infoBox, borderLeftColor: '#fbbf24'}}>
                    <label style={st.infoLabel}><FaLightbulb /> DICA MESTRE</label>
                    <p style={st.infoTxt}>{q.dicaMestre || "Atenção aos detalhes do enunciado."}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
          {questoes.length === 0 && <div style={st.empty}>Nenhuma questão encontrada com este filtro.</div>}
        </div>
      )}
    </div>
  );
};

const st = {
  container: { padding: "30px", background: "#0f172a", minHeight: "100vh", color: "#fff" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px", borderBottom: "1px solid #1e293b", paddingBottom: "20px" },
  title: { fontSize: "24px", fontWeight: "900", margin: 0 },
  subtitle: { color: "#64748b", fontSize: "14px", margin: "5px 0 0 0" },
  filterBar: { display: "flex", alignItems: "center", gap: "12px", background: "#1e293b", padding: "12px 20px", borderRadius: "15px", border: "1px solid #334155" },
  select: { background: "none", border: "none", color: "#fff", fontWeight: "bold", outline: "none", cursor: "pointer", fontSize: "14px" },
  loader: { textAlign: "center", marginTop: "50px", color: "#818cf8", fontWeight: "bold" },
  list: { display: "flex", flexDirection: "column", gap: "25px", maxWidth: "900px", margin: "0 auto" },
  card: { background: "#1e293b", padding: "30px", borderRadius: "24px", border: "1px solid #334155", boxShadow: "0 10px 25px rgba(0,0,0,0.1)" },
  badgeRow: { display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "20px" },
  materiaBadge: { background: "#4f46e5", padding: "5px 15px", borderRadius: "8px", fontSize: "11px", fontWeight: "900", textTransform: "uppercase" },
  subtemaBadge: { background: "rgba(129, 140, 248, 0.1)", color: "#818cf8", padding: "5px 15px", borderRadius: "8px", fontSize: "11px", fontWeight: "bold" },
  anoBadge: { background: "#0f172a", color: "#64748b", padding: "5px 15px", borderRadius: "8px", fontSize: "11px", fontWeight: "bold" },
  enunciado: { lineHeight: "1.7", fontSize: "17px", marginBottom: "25px", color: "#f1f5f9" },
  imgBox: { background: "#0f172a", padding: "15px", borderRadius: "15px", textAlign: "center", marginBottom: "25px" },
  img: { maxWidth: "100%", borderRadius: "10px", maxHeight: "300px" },
  imgTag: { display: "block", marginTop: "10px", fontSize: "10px", color: "#475569" },
  altsGrid: { display: "flex", flexDirection: "column", gap: "10px", marginBottom: "25px", borderLeft: "2px solid #334155", paddingLeft: "20px" },
  altItem: { fontSize: "14px", lineHeight: "1.5" },
  footer: { display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #334155", paddingTop: "20px" },
  gabBox: { fontSize: "14px", fontWeight: "bold", color: "#64748b" },
  gabTxt: { color: "#10b981", marginLeft: "5px", fontSize: "16px" },
  btnExpande: { background: "none", border: "none", color: "#818cf8", fontWeight: "900", cursor: "pointer", fontSize: "12px", display: "flex", alignItems: "center", gap: "8px" },
  expArea: { marginTop: "25px", display: "flex", flexDirection: "column", gap: "15px", animation: "fadeIn 0.4s ease" },
  infoBox: { background: "#0f172a", padding: "20px", borderRadius: "15px", borderLeft: "5px solid" },
  infoLabel: { fontSize: "10px", fontWeight: "900", color: "#fff", display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px", letterSpacing: "1px" },
  infoTxt: { fontSize: "14px", color: "#94a3b8", lineHeight: "1.6", margin: 0 },
  empty: { textAlign: "center", padding: "50px", color: "#475569" }
};

export default Questoes;