import React from "react";
import { FaUserMd, FaHospitalSymbol, FaBaby, FaFemale, FaClipboardList, FaLock } from "react-icons/fa";

// NOMES SINCRONIZADOS COM O DASHBOARDLOGIC E FIREBASE
const iconesMapeados = {
  "Clínica Médica": { icone: <FaUserMd />, cor: "#4f46e5", desc: "Grandes Temas" },
  "Cirurgia": { icone: <FaHospitalSymbol />, cor: "#0ea5e9", desc: "Clínica Cirúrgica" },
  "Pediatria": { icone: <FaBaby />, cor: "#ec4899", desc: "Saúde da Criança" },
  "Ginecologia": { icone: <FaFemale />, cor: "#f59e0b", desc: "Saúde da Mulher" },
  "Preventiva": { icone: <FaClipboardList />, cor: "#10b981", desc: "Saúde Coletiva" }
};

const MateriaCard = ({ nome, bloqueado, onClick }) => {
  const info = iconesMapeados[nome] || { 
    icone: <FaClipboardList />, 
    cor: "#64748b", 
    desc: "Módulo Médico" 
  };

  return (
    <div 
      onClick={() => !bloqueado && onClick()}
      className="materia-card" // Dica: adicione uma classe para CSS hover se preferir
      style={{
        ...st.card,
        cursor: bloqueado ? "not-allowed" : "pointer",
        opacity: bloqueado ? 0.6 : 1,
        border: bloqueado ? "1px solid #1e293b" : `1px solid ${info.cor}33`,
      }}
    >
      <div style={{ 
        ...st.iconBox,
        background: `${info.cor}15`, 
        color: info.cor 
      }}>
        {bloqueado ? <FaLock size={18} color="#475569" /> : info.icone}
      </div>

      <div style={{ overflow: "hidden", flex: 1 }}>
        <div style={{ 
          ...st.nomeTxt,
          fontSize: nome.length > 15 ? "13px" : "15px",
        }}>
          {nome}
        </div>
        <div style={st.descTxt}>{info.desc}</div>
      </div>
      
      {!bloqueado && <div style={{...st.dot, background: info.cor}}></div>}
    </div>
  );
};

const st = {
  card: {
    minWidth: "240px",
    padding: "20px",
    background: "#1e293b",
    borderRadius: "22px",
    display: "flex",
    alignItems: "center",
    gap: "18px",
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    position: "relative"
  },
  iconBox: { 
    width: "50px", 
    height: "50px", 
    borderRadius: "16px", 
    display: "flex", 
    alignItems: "center", 
    justifyContent: "center", 
    fontSize: "22px",
  },
  nomeTxt: { 
    fontWeight: "900", 
    color: "#fff", 
    lineHeight: "1.2",
    letterSpacing: "-0.5px"
  },
  descTxt: { 
    fontSize: "11px", 
    color: "#64748b", 
    fontWeight: "600",
    marginTop: "2px" 
  },
  dot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    position: "absolute",
    top: "15px",
    right: "15px",
    opacity: 0.6
  }
};

export default MateriaCard;