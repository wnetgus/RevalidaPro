import React from "react";
import { FaFlagCheckered, FaStethoscope } from "react-icons/fa";

export default function ProgressBar({ current, total }) {
  // Trava de segurança para evitar erro de divisão por zero
  const safeTotal = total > 0 ? total : 1;
  const percent = Math.round((current / safeTotal) * 100);

  return (
    <div style={st.container}>
      <div style={st.labelRow}>
        <span style={st.progressText}>
          <FaStethoscope color="#818cf8" size={12} /> 
          ESTÁGIO: <b>{current} de {total}</b>
        </span>
        <span style={st.percentText}>
          {percent}% <FaFlagCheckered size={12} color="#4ade80" />
        </span>
      </div>

      <div style={st.track}>
        <div 
          style={{ 
            ...st.fill, 
            width: `${percent}%`,
            boxShadow: percent > 0 ? "0 0 15px rgba(79, 70, 229, 0.4)" : "none"
          }}
        />
      </div>
    </div>
  );
}

const st = {
  container: {
    marginBottom: "30px",
    width: "100%"
  },
  labelRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "10px",
    fontSize: "12px",
    letterSpacing: "0.5px"
  },
  progressText: {
    color: "#94a3b8",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontWeight: "600",
    textTransform: "uppercase"
  },
  percentText: {
    color: "#fff",
    fontWeight: "900",
    display: "flex",
    alignItems: "center",
    gap: "8px"
  },
  track: {
    height: "10px",
    background: "#0f172a",
    borderRadius: "20px",
    overflow: "hidden",
    border: "1px solid #334155"
  },
  fill: {
    height: "100%",
    background: "linear-gradient(90deg, #4f46e5 0%, #a855f7 100%)",
    borderRadius: "20px",
    transition: "0.6s cubic-bezier(0.4, 0, 0.2, 1)" // Transição suave "médica"
  }
};