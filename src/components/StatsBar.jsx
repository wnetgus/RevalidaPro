import React from "react";
import { FaCheckCircle, FaTimesCircle, FaChartPie } from "react-icons/fa";

export default function StatsBar({ acertos, erros }) {
  const total = acertos + erros;
  const taxa = total ? Math.round((acertos / total) * 100) : 0;

  return (
    <div style={st.container}>
      <div style={st.card}>
        <FaCheckCircle color="#10b981" />
        <div>
          <small style={st.label}>ACERTOS</small>
          <div style={st.value}>{acertos}</div>
        </div>
      </div>

      <div style={st.card}>
        <FaTimesCircle color="#ef4444" />
        <div>
          <small style={st.label}>ERROS</small>
          <div style={st.value}>{erros}</div>
        </div>
      </div>

      <div style={{ ...st.card, borderRight: "none" }}>
        <FaChartPie color="#818cf8" />
        <div>
          <small style={st.label}>TAXA</small>
          <div style={st.value}>{taxa}%</div>
        </div>
      </div>
    </div>
  );
}

const st = {
  container: {
    display: "flex",
    background: "#1e293b",
    borderRadius: "15px",
    border: "1px solid #334155",
    overflow: "hidden",
    marginBottom: "25px",
    width: "fit-content"
  },
  card: {
    padding: "15px 25px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    borderRight: "1px solid #334155"
  },
  label: {
    display: "block",
    fontSize: "10px",
    color: "#64748b",
    fontWeight: "bold",
    letterSpacing: "1px"
  },
  value: {
    fontSize: "18px",
    fontWeight: "900",
    color: "#fff"
  }
};