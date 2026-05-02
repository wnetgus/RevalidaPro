import React from "react";
import { FaCheckCircle, FaExclamationTriangle, FaInfoCircle, FaLightbulb } from "react-icons/fa";

const types = {
  sucesso: { bg: "rgba(16, 185, 129, 0.1)", border: "#10b981", icon: <FaCheckCircle />, label: "CORRETO" },
  erro: { bg: "rgba(239, 68, 68, 0.1)", border: "#ef4444", icon: <FaExclamationTriangle />, label: "ATENÇÃO" },
  info: { bg: "rgba(79, 70, 229, 0.1)", border: "#818cf8", icon: <FaInfoCircle />, label: "EXPLICAÇÃO" },
  dica: { bg: "rgba(251, 191, 36, 0.1)", border: "#fbbf24", icon: <FaLightbulb />, label: "DICA MESTRE" }
};

export default function ExplanationBox({ type = "info", title, text }) {
  const style = types[type] || types.info;

  return (
    <div style={{
      background: style.bg,
      padding: "20px",
      borderRadius: "15px",
      borderLeft: `5px solid ${style.border}`,
      marginBottom: "20px",
      transition: "0.3s"
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        color: style.border,
        fontSize: "12px",
        fontWeight: "900",
        letterSpacing: "1px",
        marginBottom: "8px"
      }}>
        {style.icon} <span>{title || style.label}</span>
      </div>

      <p style={{
        margin: 0,
        lineHeight: "1.7",
        fontSize: "15px",
        color: "#f1f5f9",
        fontWeight: "400"
      }}>
        {text}
      </p>
    </div>
  );
}