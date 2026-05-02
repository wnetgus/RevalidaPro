import React from "react";
import { useNavigate, Outlet } from "react-router-dom"; // Outlet é onde as páginas (Dashboard, Perfil, etc) aparecem
import { auth } from "../firebase";
import { signOut } from "firebase/auth";

const Home = ({ usuario, view, setView }) => {
  const navigate = useNavigate();

  const handleSair = async () => {
    await signOut(auth);
    navigate("/login");
  };

  const alternarVisao = () => {
    if (view === "admin") {
      setView("aluno");
      navigate("/"); // Volta para o dashboard do aluno
    } else {
      setView("admin");
      navigate("/admin"); // Vai para o painel admin
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", width: "100%" }}>
      {/* HEADER SUPERIOR - MANTENDO SEU DESIGN ORIGINAL */}
      <header style={headerAlunoStyle}>
        <span style={brandStyle}>
          REVALIDAPRO <small style={{ fontSize: '10px', color: '#818cf8' }}>2026</small>
        </span>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* Botão Admin só aparece se o usuário for admin no Firestore */}
          {usuario?.role === 'admin' && (
            <button onClick={alternarVisao} style={btnToggle}>
              {view === "admin" ? "VISÃO ALUNO" : "PAINEL ADMIN"}
            </button>
          )}
          <button onClick={handleSair} style={btnSairH}>SAIR</button>
        </div>
      </header>

      {/* O OUTLET é a peça mágica: aqui o React Router vai renderizar 
          automaticamente o Dashboard, o Simulador ou qualquer outra página 
          que você clicar na Sidebar. */}
      <main style={{ padding: '20px' }}>
        <Outlet /> 
      </main>
    </div>
  );
};

// SEUS ESTILOS ORIGINAIS PRESERVADOS
const headerAlunoStyle = { 
  padding: "15px 30px", 
  display: "flex", 
  justifyContent: "space-between", 
  alignItems: "center", 
  background: "#1e293b", 
  borderBottom: "1px solid #334155", 
  position: "sticky", 
  top: 0, 
  zIndex: 100 
};

const brandStyle = { fontWeight: '900', color: '#4f46e5', fontSize: '20px' };

const btnToggle = { 
  padding: "10px 20px", 
  background: "rgba(79,70,229,0.1)", 
  color: "#818cf8", 
  border: "1px solid #4f46e5", 
  borderRadius: "10px", 
  fontSize: "11px", 
  fontWeight: "bold", 
  cursor: "pointer" 
};

const btnSairH = { 
  padding: "10px 20px", 
  background: "transparent", 
  color: "#ef4444", 
  border: "1px solid #ef4444", 
  borderRadius: "10px", 
  fontSize: "11px", 
  fontWeight: "bold", 
  cursor: "pointer" 
};

export default Home;