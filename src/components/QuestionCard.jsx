import React from "react";
import { FaImage, FaAward, FaCalendarAlt, FaStethoscope } from "react-icons/fa";

export default function QuestionCard({ questao }) {
  if (!questao) return null;

  return (
    <div style={st.card}>
      {/* HEADER DO CARD COM ÍCONES E BADGES */}
      <div style={st.header}>
        <div style={st.badgeGroup}>
          <span style={st.bancaBadge}><FaAward /> {questao.banca || "INEP"}</span>
          <span style={st.anoBadge}><FaCalendarAlt /> {questao.ano || "2026"}</span>
        </div>
        <span style={st.subtemaTxt}>
          <FaStethoscope /> {questao.subtema || "Geral"}
        </span>
      </div>

      {/* ENUNCIADO COM DESTAQUE MÉDICO */}
      <p style={st.enunciado}>
        {questao.enunciado}
      </p>

      {/* CONTAINER DE IMAGEM BLINDADO */}
      {questao.imagemUrl && (
        <div style={st.imageBox}>
          <img
            src={questao.imagemUrl}
            alt="Caso Clínico"
            style={st.img}
          />
          <small style={st.imgTag}><FaImage /> Imagem de Referência</small>
        </div>
      )}
    </div>
  );
}

const st = {
  card: {
    background: "#1e293b",
    padding: "30px",
    borderRadius: "24px",
    border: "1px solid #334155",
    marginBottom: "25px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
    transition: "0.3s"
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
    paddingBottom: "15px"
  },
  badgeGroup: {
    display: "flex",
    gap: "10px"
  },
  bancaBadge: {
    background: "#4f46e5",
    color: "#fff",
    padding: "4px 12px",
    borderRadius: "8px",
    fontSize: "11px",
    fontWeight: "900",
    display: "flex",
    alignItems: "center",
    gap: "5px"
  },
  anoBadge: {
    background: "#0f172a",
    color: "#94a3b8",
    padding: "4px 12px",
    borderRadius: "8px",
    fontSize: "11px",
    fontWeight: "bold",
    display: "flex",
    alignItems: "center",
    gap: "5px"
  },
  subtemaTxt: {
    fontSize: "11px",
    color: "#818cf8",
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: "1px",
    display: "flex",
    alignItems: "center",
    gap: "8px"
  },
  enunciado: {
    lineHeight: "1.7",
    fontSize: "18px",
    color: "#f1f5f9",
    fontWeight: "500",
    margin: 0
  },
  imageBox: {
    marginTop: "20px",
    background: "#0f172a",
    padding: "15px",
    borderRadius: "15px",
    textAlign: "center",
    border: "1px solid #1e293b"
  },
  img: {
    maxWidth: "100%",
    maxHeight: "400px",
    borderRadius: "10px",
    objectFit: "contain"
  },
  imgTag: {
    display: "block",
    marginTop: "10px",
    fontSize: "10px",
    color: "#475569",
    fontWeight: "bold"
  }
};