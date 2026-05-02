import React, { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  FaThLarge, FaBookMedical, FaLayerGroup, FaFileAlt,
  FaUserCircle, FaUserShield, FaChevronLeft, FaChevronRight,
  FaSignOutAlt, FaExclamationTriangle, FaQuestionCircle,
  FaChartBar, FaBars, FaTimes, FaCommentDots, FaTrophy, FaFire,
  FaMedkit
} from "react-icons/fa";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";

const Sidebar = ({ collapsed, setCollapsed, isAdmin, totalPendentes, totalChat }) => {
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) setMobileOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const menuItems = [
    { id: "Dashboard",     label: "Dashboard",          icon: <FaThLarge color="#818cf8" />,           path: "/" },
    { id: "CadernoErros",  label: "Caderno de Erros",   icon: <FaExclamationTriangle color="#fb923c" />, path: "/caderno-erros" },
    { id: "SimuladoOficial",label: "Simulado Oficial",   icon: <FaMedkit color="#10b981" />,             path: "/simulado-oficial" },
    { id: "SimuladosGeral",label: "Simulado Geral",     icon: <FaLayerGroup color="#38bdf8" />,         path: "/preparar-simulado" },
    { id: "SuperApostas",  label: "Super Apostas",      icon: <FaFire color="#ef4444" />,               path: "/super-apostas" },
    { id: "Biblioteca",    label: "Banco de Temas",     icon: <FaBookMedical color="#34d399" />,        path: "/biblioteca" },
    { id: "Materiais",     label: "Materiais PDF",      icon: <FaFileAlt color="#a78bfa" />,            path: "/materiais" },
    { id: "Duvidas",       label: "Central de Dúvidas", icon: <FaQuestionCircle color="#fbbf24" />,     path: "/duvidas", badge: totalPendentes || 0 },
    { id: "Chat",          label: "Sala dos Residentes",icon: <FaCommentDots color="#22d3ee" />,        path: "/chat", badge: totalChat || 0 },
    { id: "Desempenho",    label: "Meu Desempenho",     icon: <FaChartBar color="#f472b6" />,           path: "/desempenho" },
    { id: "Ranking",       label: "Ranking",            icon: <FaTrophy color="#fbbf24" />,             path: "/ranking" },
    { id: "Perfil",        label: "Meu Perfil",         icon: <FaUserCircle color="#94a3b8" />,         path: "/perfil" },
  ];

  const handleSair = async () => {
    await signOut(auth);
    navigate("/login");
  };

  const handleNavClick = () => {
    if (isMobile) setMobileOpen(false);
  };

  const sidebarWidth = isMobile ? "280px" : collapsed ? "80px" : "260px";
  const sidebarTransform = isMobile && !mobileOpen ? "translateX(-100%)" : "translateX(0)";

  return (
    <>
      {/* BOTÃO HAMBURGER MOBILE */}
      {isMobile && (
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          style={{
            position: "fixed", top: "15px", left: "15px", zIndex: 2000,
            background: "#4f46e5", border: "none", borderRadius: "12px",
            width: "44px", height: "44px", display: "flex",
            alignItems: "center", justifyContent: "center",
            color: "#fff", cursor: "pointer", boxShadow: "0 4px 15px rgba(79,70,229,0.4)"
          }}
        >
          {mobileOpen ? <FaTimes size={18} /> : <FaBars size={18} />}
        </button>
      )}

      {/* OVERLAY ESCURO NO MOBILE */}
      {isMobile && mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
            zIndex: 1500, backdropFilter: "blur(2px)"
          }}
        />
      )}

      {/* SIDEBAR */}
      <aside style={{
        height: "100vh", background: "#1e293b",
        borderRight: "1px solid rgba(255,255,255,0.05)",
        display: "flex", flexDirection: "column",
        width: sidebarWidth,
        transform: sidebarTransform,
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        position: "fixed", left: 0, top: 0,
        zIndex: isMobile ? 1600 : 1000,
        overflowY: "auto"
      }}>
        {/* LOGO */}
        <div style={{
          height: "80px", display: "flex", alignItems: "center",
          justifyContent: "space-between", padding: "0 20px",
          marginBottom: "10px", flexShrink: 0
        }}>
          {(!collapsed || isMobile) && (
            <span style={{ fontSize: "18px", fontWeight: "900", letterSpacing: "1px", color: "#fff" }}>
              REVALIDA<span style={{ color: "#4f46e5" }}>PRO</span>
            </span>
          )}
          {!isMobile && (
            <button onClick={() => setCollapsed(!collapsed)} style={{
              background: "#0f172a", border: "1px solid #334155",
              color: "#94a3b8", borderRadius: "8px", width: "30px", height: "30px",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", margin: collapsed ? "0 auto" : "0"
            }}>
              {collapsed ? <FaChevronRight /> : <FaChevronLeft />}
            </button>
          )}
        </div>

        {/* MENU ITEMS */}
        <nav style={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1 }}>
          {menuItems.map((item) => (
            <NavLink
              key={item.id}
              to={item.path}
              onClick={handleNavClick}
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              style={({ isActive }) => ({
                display: "flex", alignItems: "center",
                justifyContent: collapsed && !isMobile ? "center" : "flex-start",
                padding: "12px 20px", margin: "4px 12px",
                borderRadius: "12px", color: isActive ? "#fff" : "#64748b",
                textDecoration: "none", position: "relative"
              })}
            >
              <div style={{ fontSize: "20px", minWidth: "20px", position: "relative", display: "flex", justifyContent: "center" }}>
                {item.icon}
                {(item.badge > 0) && (
                  <span className="badge-pulse" style={{
                    position: "absolute", top: "-6px", right: "-8px",
                    background: "#ef4444", color: "#fff", fontSize: "10px",
                    padding: "2px 6px", borderRadius: "10px", fontWeight: "900",
                    minWidth: "18px", textAlign: "center", lineHeight: "14px"
                  }}>{item.badge}</span>
                )}
              </div>
              {(!collapsed || isMobile) && (
                <span style={{ fontWeight: "600", marginLeft: "15px", whiteSpace: "nowrap" }}>
                  {item.label}
                </span>
              )}
            </NavLink>
          ))}

          {isAdmin && (
            <NavLink
              to="/admin"
              onClick={handleNavClick}
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              style={({ isActive }) => ({
                display: "flex", alignItems: "center",
                justifyContent: collapsed && !isMobile ? "center" : "flex-start",
                padding: "12px 20px", margin: "4px 12px", marginTop: "15px",
                borderRadius: "12px", borderTop: "1px solid rgba(255,255,255,0.05)",
                paddingTop: "20px", color: isActive ? "#fbbf24" : "#64748b",
                textDecoration: "none"
              })}
            >
              <div style={{ fontSize: "20px", display: "flex", justifyContent: "center" }}>
                <FaUserShield color="#fbbf24" />
              </div>
              {(!collapsed || isMobile) && (
                <span style={{ fontWeight: "600", marginLeft: "15px" }}>Painel Admin</span>
              )}
            </NavLink>
          )}
        </nav>

        {/* LOGOUT */}
        <div style={{ marginBottom: "20px", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "15px", flexShrink: 0 }}>
          <div
            onClick={handleSair}
            className="nav-item-logout"
            style={{
              display: "flex", alignItems: "center",
              justifyContent: collapsed && !isMobile ? "center" : "flex-start",
              color: "#ef4444", padding: "12px 20px",
              margin: "0 12px", cursor: "pointer", borderRadius: "12px"
            }}
          >
            <div style={{ fontSize: "20px", display: "flex", justifyContent: "center" }}><FaSignOutAlt /></div>
            {(!collapsed || isMobile) && (
              <span style={{ fontWeight: "600", marginLeft: "15px" }}>Sair</span>
            )}
          </div>
        </div>

        <style>{`
          .nav-item { cursor: pointer; transition: all 0.2s ease; }
          .nav-item:hover { background: rgba(79,70,229,0.08); color: #818cf8 !important; transform: translateX(4px); }
          .nav-item.active { background: linear-gradient(90deg, rgba(79,70,229,0.2) 0%, rgba(79,70,229,0.05) 100%); color: #fff !important; }
          .nav-item-logout:hover { background: rgba(239,68,68,0.1); transform: scale(1.02); }
          .badge-pulse { animation: badgePulse 2s ease-in-out infinite; }
          @keyframes badgePulse { 0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); } 50% { box-shadow: 0 0 0 5px rgba(239,68,68,0.15); } }
        `}</style>
      </aside>
    </>
  );
};

export default Sidebar;
