import React, { useState } from "react";
import { FaImage, FaAward, FaCalendarAlt, FaStethoscope, FaShieldAlt, FaBrain } from "react-icons/fa";
import { StorageImage } from "./StorageImage";

const renderGrafico = (graficoDados, imagemLegenda) => {
  if (!graficoDados || !Array.isArray(graficoDados.dados) || graficoDados.dados.length === 0) return null;
  const { titulo, tipo = "barra", eixoX, eixoY, dados } = graficoDados;
  const seriesKeys = Object.keys(dados[0]).filter(k => k !== "x");
  const isMulti = seriesKeys.length > 1 || !seriesKeys.includes("y");
  const VW = 480, VH = 200, ML = 48, MR = 16, MT = 16, MB = 46;
  const CW = VW - ML - MR, CH = VH - MT - MB;
  const allVals = isMulti
    ? dados.flatMap(d => seriesKeys.map(k => Number(d[k]) || 0))
    : dados.map(d => Number(d.y) || 0);
  const maxY = Math.max(...allVals) || 1;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(maxY * f));
  const n = dados.length;
  const xStep = CW / n;
  const cx = (i) => ML + i * xStep + xStep / 2;
  const cy = (v) => MT + CH - (Number(v) / maxY) * CH;
  const barW = Math.min(xStep * 0.65, 42);
  const tx = { fontSize: "10", fill: "#64748b", fontFamily: "sans-serif" };
  const PALETTE = { observado: "#818cf8", limiteSuperior: "#ef4444", mediana: "#10b981", limiteInferior: "#f59e0b" };
  const FALLBACK = ["#818cf8", "#ef4444", "#10b981", "#f59e0b", "#06b6d4", "#a78bfa"];
  const col = (k, i) => PALETTE[k] || FALLBACK[i % FALLBACK.length];
  return (
    <div style={{ marginTop: "20px", background: "#0f172a", border: "1px solid rgba(99,102,241,0.25)", borderRadius: "14px", overflow: "hidden" }}>
      <div style={{ padding: "10px 16px", background: "rgba(79,70,229,0.12)", borderBottom: "1px solid rgba(79,70,229,0.2)" }}>
        <span style={{ fontSize: "11px", color: "#818cf8", fontWeight: "900", letterSpacing: "0.5px", textTransform: "uppercase" }}>
          {(tipo === "linha" || isMulti) ? "📈" : "📊"} {titulo || "Gráfico"}
        </span>
      </div>
      <div style={{ padding: "14px 12px 6px", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" style={{ display: "block", minWidth: "260px" }}>
          <line x1={ML} y1={MT} x2={ML} y2={MT + CH} stroke="#1e293b" strokeWidth="1" />
          <line x1={ML} y1={MT + CH} x2={ML + CW} y2={MT + CH} stroke="#1e293b" strokeWidth="1" />
          {yTicks.map((v, i) => {
            const y = cy(v);
            return (
              <g key={i}>
                <line x1={ML - 3} y1={y} x2={ML + CW} y2={y} stroke="#1e293b" strokeWidth="0.5" strokeDasharray={i > 0 ? "3 3" : "0"} />
                <text x={ML - 6} y={y + 3} textAnchor="end" {...tx}>{v}</text>
              </g>
            );
          })}
          {eixoY && <text x={11} y={MT + CH / 2} textAnchor="middle" transform={`rotate(-90,11,${MT + CH / 2})`} fontSize="9" fill="#475569" fontFamily="sans-serif">{eixoY}</text>}
          {eixoX && <text x={ML + CW / 2} y={VH - 3} textAnchor="middle" fontSize="9" fill="#475569" fontFamily="sans-serif">{eixoX}</text>}
          {dados.map((d, i) => (
            <text key={i} x={cx(i)} y={MT + CH + 16} textAnchor="middle" {...tx}>
              {String(d.x).length > 5 ? String(d.x).slice(0, 4) + "…" : d.x}
            </text>
          ))}
          {isMulti ? (
            seriesKeys.map((key, si) => {
              const c = col(key, si);
              return (
                <g key={key}>
                  <polyline
                    points={dados.map((d, i) => `${cx(i)},${cy(d[key])}`).join(" ")}
                    fill="none" stroke={c}
                    strokeWidth={key === "observado" ? "2.5" : "1.5"}
                    strokeLinejoin="round"
                    strokeDasharray={key !== "observado" ? "4 2" : "0"}
                  />
                  {key === "observado" && dados.map((d, i) => (
                    <circle key={i} cx={cx(i)} cy={cy(d[key])} r="3" fill={c} />
                  ))}
                </g>
              );
            })
          ) : tipo === "linha" ? (
            <>
              <polyline points={dados.map((d, i) => `${cx(i)},${cy(d.y)}`).join(" ")} fill="none" stroke="#818cf8" strokeWidth="2.5" strokeLinejoin="round" />
              {dados.map((d, i) => (
                <circle key={i} cx={cx(i)} cy={cy(d.y)} r="4.5" fill="#4f46e5" stroke="#818cf8" strokeWidth="1.5" />
              ))}
            </>
          ) : (
            dados.map((d, i) => {
              const bH = (Number(d.y) / maxY) * CH;
              return <rect key={i} x={cx(i) - barW / 2} y={cy(d.y)} width={barW} height={bH} fill="rgba(79,70,229,0.7)" rx="3" />;
            })
          )}
        </svg>
      </div>
      {isMulti && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px", padding: "8px 16px", borderTop: "1px solid rgba(51,65,85,0.4)" }}>
          {seriesKeys.map((key, si) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "10px", color: "#94a3b8" }}>
              <div style={{ width: "16px", height: key === "observado" ? "2.5px" : "1.5px", background: col(key, si), borderRadius: "1px" }} />
              <span>{key.replace(/([A-Z])/g, " $1").toLowerCase()}</span>
            </div>
          ))}
        </div>
      )}
      {imagemLegenda && <p style={{ margin: 0, padding: "8px 16px 10px", fontSize: "11px", color: "#64748b", fontStyle: "italic", borderTop: "1px solid rgba(51,65,85,0.4)", lineHeight: 1.5 }}>{imagemLegenda}</p>}
    </div>
  );
};

const renderPartograma = (imagemUrl, imagemStoragePath, imagemLegenda, onZoom) => {
  if (!imagemUrl && !imagemStoragePath) return null;
  return (
    <div style={{ marginTop: "20px", background: "#0f172a", border: "1px solid rgba(236,72,153,0.25)", borderRadius: "14px", overflow: "hidden" }}>
      <div style={{ padding: "10px 16px", background: "rgba(236,72,153,0.07)", borderBottom: "1px solid rgba(236,72,153,0.2)", display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "13px" }}>🤰</span>
        <span style={{ fontSize: "11px", color: "#f472b6", fontWeight: "900", letterSpacing: "0.5px", textTransform: "uppercase" }}>Partograma Oficial</span>
      </div>
      <div style={{ padding: "16px", textAlign: "center" }}>
        <StorageImage
          storagePath={imagemStoragePath}
          directUrl={imagemUrl}
          alt={imagemLegenda || "Partograma"}
          style={{ maxWidth: "100%", maxHeight: "420px", objectFit: "contain", borderRadius: "10px", cursor: "zoom-in" }}
          onClick={(src) => onZoom(src)}
        />
      </div>
      <div style={{ padding: "10px 16px 12px", borderTop: "1px solid rgba(51,65,85,0.4)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px", marginBottom: imagemLegenda ? "8px" : 0 }}>
          {[["🟡","Linha de alerta"],["🔴","Linha de ação"],["🔵","Dilatação cervical"],["◻️","Altura da apresentação"]].map(([icon, label]) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "10px", color: "#94a3b8" }}>
              <span style={{ fontSize: "12px", lineHeight: 1 }}>{icon}</span><span>{label}</span>
            </div>
          ))}
        </div>
        {imagemLegenda && <p style={{ margin: 0, fontSize: "11px", color: "#64748b", fontStyle: "italic", lineHeight: 1.5 }}>{imagemLegenda}</p>}
      </div>
    </div>
  );
};

const renderAlertaRecursoVisual = (recursoVisual, imagemUrl, imagemStoragePath, tabelaDados, graficoDados) => {
  if (!recursoVisual?.necessitaImagem) return null;
  if (imagemUrl) return null;
  if (imagemStoragePath) return null;
  if (tabelaDados?.linhas?.length > 0) return null;
  if (graficoDados?.dados?.length > 0) return null;
  return (
    <div style={{
      marginTop: "20px", background: "#0f172a",
      border: "2px dashed rgba(234,179,8,0.35)", borderRadius: "14px",
      padding: "16px 20px", display: "flex", flexDirection: "column", gap: "6px"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "16px" }}>📷</span>
        <span style={{ fontSize: "12px", fontWeight: "900", color: "#fbbf24", letterSpacing: "0.5px", textTransform: "uppercase" }}>
          IMAGEM OFICIAL NECESSÁRIA
        </span>
      </div>
      {recursoVisual.tipo && (
        <div style={{ fontSize: "12px", color: "#94a3b8" }}>
          <span style={{ color: "#64748b" }}>Tipo: </span>
          <span style={{ color: "#e2e8f0", fontWeight: "600" }}>{recursoVisual.tipo.replace(/_/g, " ")}</span>
        </div>
      )}
      {recursoVisual.arquivoEsperado && (
        <div style={{ fontSize: "12px", color: "#94a3b8" }}>
          <span style={{ color: "#64748b" }}>Arquivo esperado: </span>
          <code style={{ color: "#fbbf24", fontSize: "11px", background: "rgba(251,191,36,0.08)", padding: "2px 7px", borderRadius: "4px" }}>
            {recursoVisual.arquivoEsperado}
          </code>
        </div>
      )}
      {recursoVisual.observacao && (
        <div style={{ fontSize: "11px", color: "#64748b" }}>{recursoVisual.observacao}</div>
      )}
      <div style={{ fontSize: "11px", color: "#475569", fontStyle: "italic", marginTop: "2px" }}>
        Adicione a imagem oficial na Biblioteca RevalidaPRO.
      </div>
    </div>
  );
};

const renderTabelaDados = (tabelaDados, descricaoTabela) => {
  if (!tabelaDados || !Array.isArray(tabelaDados.linhas) || tabelaDados.linhas.length === 0) return null;
  const { titulo, cabecalho, linhas } = tabelaDados;
  const getCells = (l) => Array.isArray(l) ? l : Array.from({ length: cabecalho?.length ?? 0 }, (_, i) => l[`c${i}`] ?? "");
  return (
    <div style={{
      marginTop: "20px", background: "#0f172a",
      border: "1px solid rgba(99,102,241,0.25)", borderRadius: "14px", overflow: "hidden",
    }}>
      {titulo && (
        <div style={{
          padding: "10px 16px", background: "rgba(79,70,229,0.12)",
          borderBottom: "1px solid rgba(79,70,229,0.2)",
        }}>
          <span style={{ fontSize: "11px", color: "#818cf8", fontWeight: "900", letterSpacing: "0.5px", textTransform: "uppercase" }}>
            📊 {titulo}
          </span>
        </div>
      )}
      <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "320px", fontSize: "13px" }}>
          {Array.isArray(cabecalho) && cabecalho.length > 0 && (
            <thead>
              <tr>
                {cabecalho.map((col, i) => (
                  <th key={i} style={{
                    padding: "9px 14px", background: "rgba(79,70,229,0.15)",
                    color: "#a5b4fc", fontWeight: "800", fontSize: "11px",
                    textAlign: "left", borderBottom: "1px solid rgba(79,70,229,0.25)",
                    whiteSpace: "nowrap",
                  }}>{col}</th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {linhas.map((linha, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.025)" }}>
                {getCells(linha).map((cel, j) => (
                  <td key={j} style={{
                    padding: "8px 14px",
                    color: j === 0 ? "#e2e8f0" : "#94a3b8",
                    fontWeight: j === 0 ? "600" : "400",
                    borderBottom: "1px solid rgba(51,65,85,0.4)",
                    verticalAlign: "top", lineHeight: 1.55,
                  }}>{cel}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {descricaoTabela && (
        <p style={{
          margin: 0, padding: "10px 16px", fontSize: "11px", color: "#64748b",
          fontStyle: "italic", borderTop: "1px solid rgba(51,65,85,0.4)", lineHeight: 1.5,
        }}>{descricaoTabela}</p>
      )}
    </div>
  );
};

export default function QuestionCard({ questao }) {
  const [lightboxUrl, setLightboxUrl] = useState(null);
  if (!questao) return null;

  return (
    <div style={st.card} className="question-card">
      <style>{`.question-card:hover { border-color: rgba(79,70,229,0.3); box-shadow: 0 12px 35px rgba(0,0,0,0.15); }`}</style>
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

      {/* TABELA DE DADOS */}
      {renderTabelaDados(questao.tabelaDados, questao.descricaoTabela)}

      {/* VISUAL — gráfico / partograma / imagem clínica */}
      {questao.imagemTipo === "grafico" && questao.graficoDados
        ? renderGrafico(questao.graficoDados, questao.imagemLegenda)
        : questao.imagemTipo === "partograma" && (questao.imagemUrl || questao.imagemStoragePath)
        ? renderPartograma(questao.imagemUrl, questao.imagemStoragePath, questao.imagemLegenda, setLightboxUrl)
        : (questao.imagemUrl || questao.imagemStoragePath)
        ? (
          <div style={st.imageBox}>
            <StorageImage
              storagePath={questao.imagemStoragePath}
              directUrl={questao.imagemUrl}
              alt={questao.imagemLegenda || "Caso Clínico"}
              style={{ ...st.img, cursor: "zoom-in" }}
              onClick={(src) => setLightboxUrl(src)}
            />
            <small style={st.imgTag}>
              <FaImage /> {questao.imagemLegenda || "Imagem de Referência"}
            </small>
          </div>
        ) : null
      }

      {/* ALERTA RECURSO VISUAL PENDENTE */}
      {renderAlertaRecursoVisual(questao.recursoVisual, questao.imagemUrl, questao.imagemStoragePath, questao.tabelaDados, questao.graficoDados)}

      {/* LIGHTBOX */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 13000,
            background: "rgba(0,0,0,0.93)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "20px", cursor: "zoom-out"
          }}
        >
          <button
            onClick={() => setLightboxUrl(null)}
            style={{
              position: "absolute", top: "16px", right: "20px",
              background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.25)",
              color: "#fff", borderRadius: "50%", width: "42px", height: "42px",
              fontSize: "22px", cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center", lineHeight: 1
            }}
          >×</button>
          <img
            src={lightboxUrl}
            alt="Imagem ampliada"
            style={{ maxWidth: "90vw", maxHeight: "90vh", objectFit: "contain", borderRadius: "8px", boxShadow: "0 8px 40px rgba(0,0,0,0.6)" }}
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      {/* LINHA DE CONTEXTO: tema_mestre + diretriz */}
      {(questao.tema_mestre || questao.fonte_diretriz) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "16px", alignItems: "center" }}>
          {questao.tema_mestre && (
            <div style={st.temaMestreBadge}>
              <FaBrain size={9} /> {questao.tema_mestre}
            </div>
          )}
          {questao.fonte_diretriz && (
            <div style={st.diretrizBadge}>
              <FaShieldAlt size={9} style={{ flexShrink: 0 }} />
              <span>
                <strong>{questao.fonte_diretriz}</strong>
                {questao.ano_diretriz ? ` · ${questao.ano_diretriz}` : ""}
              </span>
            </div>
          )}
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
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
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
  },
  temaMestreBadge: {
    display: "flex", alignItems: "center", gap: "5px",
    padding: "4px 10px", borderRadius: "6px",
    background: "rgba(129,140,248,0.08)", border: "1px solid rgba(129,140,248,0.15)",
    fontSize: "10px", color: "#818cf8", fontWeight: "700", letterSpacing: "0.3px"
  },
  diretrizBadge: {
    display: "flex", alignItems: "center", gap: "6px",
    padding: "4px 10px", borderRadius: "6px",
    background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.18)",
    fontSize: "10px", color: "#10b981", fontWeight: "700", lineHeight: 1.4,
  }
};