import React from "react";
import { FaBars, FaSignOutAlt, FaUserMd, FaChevronDown } from "react-icons/fa";

const Header = ({ user, logout, toggleSidebar }) => {
  // Lógica de tratamento médico refinada
  const genderTitle = user?.genero === "Feminino" ? "Dra." : user?.genero === "Masculino" ? "Dr." : "Dr.";
  const nomeExibicao = (user?.nome || user?.displayName || user?.email || "Colega").split(" ")[0];

  return (
    <>
      <style>{`
        @media (max-width: 600px) {
          .headerTitle { display: none !important; }
          .userName { font-size: 11px !important; }
        }
        .header-glass {
          background: rgba(15, 23, 42, 0.75) !important;
          backdrop-filter: blur(15px) saturate(180%) !important;
          -webkit-backdrop-filter: blur(15px) saturate(180%) !important;
        }
      `}</style>
      
      <header className="header-glass" style={st.header}>
        <div style={st.leftSide}>
          <button 
            onClick={toggleSidebar}
            style={st.menuBtn}
            title="Alternar Menu"
          >
            <FaBars size={18} />
          </button>
          
          <div className="headerTitle" style={st.titleWrapper}>
            <div style={st.areaLabel}>REVALIDA<span style={{color: '#4f46e5'}}>PRO</span></div>
            <div style={st.subLabel}>Ambiente de Elite</div>
          </div>
        </div>

        <div style={st.rightSide}>
          {/* BADGE DE IDENTIFICAÇÃO MÉDICA */}
          <div style={st.userBadge}>
            <div style={st.avatarCircle}>
               <FaUserMd size={14} color="#fff" />
            </div>
            <span className="userName" style={st.userName}>
              {genderTitle} {nomeExibicao}
            </span>
            <FaChevronDown size={10} color="#64748b" style={{marginLeft: '5px'}} />
          </div>

          <div style={st.divider}></div>

          <button 
            onClick={logout} 
            style={st.logoutBtn}
            title="Sair do Sistema"
          >
            <FaSignOutAlt size={18} />
          </button>
        </div>
      </header>
    </>
  );
};

const st = {
  header: {
    height: "70px",
    borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 25px",
    position: "sticky", // Mantém o header fixo no topo
    top: 0,
    width: "100%",
    boxSizing: "border-box", 
    color: "#f8fafc",
    zIndex: 1100,
  },
  leftSide: { display: "flex", alignItems: "center", gap: "18px", minWidth: 0 },
  menuBtn: {
    background: "#1e293b",
    border: "1px solid #334155",
    color: "#fff",
    width: "40px",
    height: "40px",
    borderRadius: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "0.2s"
  },
  titleWrapper: { display: "flex", flexDirection: "column" },
  areaLabel: { fontSize: "15px", fontWeight: "900", letterSpacing: "0.5px" },
  subLabel: { fontSize: "10px", color: "#64748b", fontWeight: "bold", textTransform: "uppercase" },
  rightSide: { display: "flex", alignItems: "center", gap: "15px" },
  userBadge: { 
    display: "flex", 
    alignItems: "center", 
    gap: "10px", 
    background: "rgba(30, 41, 59, 0.5)", 
    padding: "6px 14px 6px 6px", 
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,0.05)",
    cursor: "pointer"
  },
  avatarCircle: {
    width: "30px",
    height: "30px",
    background: "#4f46e5",
    borderRadius: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },
  userName: { fontSize: "13px", fontWeight: "700", whiteSpace: "nowrap", color: "#f1f5f9" },
  divider: { width: "1px", height: "24px", background: "rgba(255,255,255,0.1)" },
  logoutBtn: { 
    background: "rgba(239, 68, 68, 0.1)", 
    border: "none", 
    color: "#ef4444", 
    cursor: "pointer", 
    padding: "10px",
    borderRadius: "10px",
    display: "flex",
    alignItems: "center",
    transition: "0.2s"
  }
};

export default Header;