import React from "react";
import {
  FaUserMd,
  FaSyringe,
  FaChild,
  FaClipboardList,
} from "react-icons/fa";

const materias = [
  { nome: "GO", icon: <FaUserMd /> },
  { nome: "Cirurgia", icon: <FaSyringe /> },
  { nome: "Pediatria", icon: <FaChild /> },
  { nome: "Preventiva", icon: <FaClipboardList /> },
  { nome: "Clínica", icon: <FaClipboardList /> },
];

const Dashboard = () => {
  return (
    <div className="dashboard">
      <h2 className="dashboard-title">Matérias</h2>

      <div className="materias-grid">
        {materias.map((m) => (
          <div key={m.nome} className="materia-card">
            <div className="materia-icon">{m.icon}</div>
            <h3>{m.nome}</h3>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;