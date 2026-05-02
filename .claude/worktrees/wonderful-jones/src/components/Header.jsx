import React from "react";

const Header = ({ user, logout, toggleSidebar }) => {
  const genderTitle = user?.genero === "Feminino" ? "Dra." : user?.genero === "Masculino" ? "Dr." : "";
  return (
    <div className="header">
      <button className="menu-toggle" onClick={toggleSidebar}>
        ☰
      </button>
      <div className="user-info">
        <span>
          Bem-vindo, {genderTitle} {user.displayName || user.email}
        </span>
        <button className="logout-btn" onClick={logout}>
          Sair
        </button>
      </div>
    </div>
  );
};

export default Header;