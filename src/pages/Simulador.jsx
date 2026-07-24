/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import { collection, query, where, getDocs, limit, addDoc, serverTimestamp, orderBy, doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import {
  FaClock, FaMoon, FaSun, FaBookOpen, FaCheckDouble,
  FaStethoscope, FaFlask, FaLightbulb, FaSignOutAlt, FaQuestionCircle,
  FaArrowLeft, FaArrowRight, FaChevronLeft, FaChevronRight,
  FaTrophy, FaCheckCircle, FaTimesCircle, FaFilePdf, FaBolt,
  FaEye, FaListOl, FaShieldAlt, FaFire
} from "react-icons/fa";
import { registrarRespostaIndividual, gravarDesempenhoFinalLote, atualizarStreakDiario, atualizarEstatisticasFinais, registrarAnalyticsCognitivo } from "../modules/simulador/simuladorLogic";
import TeoriaModal from "../components/TeoriaModal";
import { classificarPorRegras } from "../utils/resumoEngine";
import { StorageImage } from "../components/StorageImage";

// ─── HELPERS DE EXPERIÊNCIA COGNITIVA ────────────────────────────────────────
const BADGES_COGNITIVOS = {
  "CONFUSÃO DIAGNÓSTICA":   { cor: "#f97316", bg: "rgba(249,115,22,0.12)"  },
  "TIMING INCORRETO":       { cor: "#3b82f6", bg: "rgba(59,130,246,0.12)"  },
  "CONDUTA INSUFICIENTE":   { cor: "#f59e0b", bg: "rgba(245,158,11,0.12)"  },
  "TRATAMENTO INCOMPLETO":  { cor: "#8b5cf6", bg: "rgba(139,92,246,0.12)"  },
  "DIRETRIZ ANTIGA":        { cor: "#6366f1", bg: "rgba(99,102,241,0.12)"  },
  "DOSE ERRADA":            { cor: "#ef4444", bg: "rgba(239,68,68,0.12)"   },
  "EXCESSO DE INTERVENÇÃO": { cor: "#94a3b8", bg: "rgba(148,163,184,0.10)" },
  "INDICAÇÃO TROCADA":      { cor: "#06b6d4", bg: "rgba(6,182,212,0.10)"   },
  "ARMADILHA DE CLASSE":    { cor: "#ec4899", bg: "rgba(236,72,153,0.12)"  },
  "ARMADILHA INEP":         { cor: "#ec4899", bg: "rgba(236,72,153,0.10)"  },
};

const BADGE_KEYWORD_MAP = [
  { keys: ["CONFUS"],                             tipo: "CONFUSÃO DIAGNÓSTICA"   },
  { keys: ["TIMING"],                             tipo: "TIMING INCORRETO"       },
  { keys: ["CONDUTA"],                            tipo: "CONDUTA INSUFICIENTE"   },
  { keys: ["TRATAMENTO", "INCOMPLET"],            tipo: "TRATAMENTO INCOMPLETO"  },
  { keys: ["DIRETRIZ"],                           tipo: "DIRETRIZ ANTIGA"        },
  { keys: ["DOSE"],                               tipo: "DOSE ERRADA"            },
  { keys: ["INTERVEN"],                           tipo: "EXCESSO DE INTERVENÇÃO" },
  { keys: ["INDICA"],                             tipo: "INDICAÇÃO TROCADA"      },
  { keys: ["MECANISMO", "CLASSE", "ARMADILH"],    tipo: "ARMADILHA DE CLASSE"    },
];

const resolveBadgeType = (texto) => {
  if (!texto) return "ARMADILHA INEP";
  const upper = texto.toUpperCase();
  for (const { keys, tipo } of BADGE_KEYWORD_MAP) {
    if (keys.some(k => upper.includes(k))) return tipo;
  }
  return "ARMADILHA INEP";
};

const parseBadgeCognitivo = (nota) => {
  if (!nota) return { tipo: null, subtitulo: null, texto: "" };
  const upper = nota.toUpperCase();

  // 1. Correspondência exata com nome canônico
  for (const tipo of Object.keys(BADGES_COGNITIVOS)) {
    if (upper.startsWith(tipo)) {
      return { tipo, subtitulo: null, texto: nota.slice(tipo.length).replace(/^[:\.\,\s]+/, "").trim() };
    }
  }

  // 2. Fuzzy: procura primeiro segmento antes de ":" ou "\n" (máx 75 chars)
  const ci = nota.indexOf(":");
  const ni = nota.indexOf("\n");
  const splitAt = [ci, ni].filter(i => i > 0).sort((a, b) => a - b)[0];
  if (splitAt && splitAt <= 75) {
    const seg = nota.slice(0, splitAt).trim();
    // Só tenta se o segmento for todo maiúsculo (padrão de badge do Codex)
    if (seg.length > 0 && seg === seg.toUpperCase() && /[A-ZÀÁÂÃÄÉÊÍÓÔÕÚÇ]/.test(seg)) {
      const tipo = resolveBadgeType(seg);
      return {
        tipo,
        subtitulo: seg !== tipo ? seg : null,
        texto: nota.slice(splitAt + 1).trim(),
      };
    }
  }

  return { tipo: null, subtitulo: null, texto: nota };
};

const parseRaciocinio = (texto) => {
  if (!texto) return null;
  const result = {};
  const matches = [...texto.matchAll(/\b(PADRÃO|DIFERENCIAL|DECISÃO|ARMADILHA):\s*([^→]+)/gi)];
  if (matches.length < 2) return null;
  matches.forEach(m => { result[m[1].toUpperCase()] = m[2].trim().replace(/\s*→\s*$/, ""); });
  return result;
};

const PASSOS_CONFIG = [
  { cor: "#10b981", emoji: "🟢" },
  { cor: "#3b82f6", emoji: "🔵" },
  { cor: "#8b5cf6", emoji: "🟣" },
  { cor: "#f59e0b", emoji: "🟡" },
  { cor: "#94a3b8", emoji: "⚪" },
  { cor: "#ef4444", emoji: "🔴" },
];

const parseTTO = (texto) => {
  if (!texto) return null;
  const matches = [...texto.matchAll(/PASSO\s+(\d+)\s*[—–\-]+\s*([^\n]+)/gi)];
  if (matches.length < 2) return null;
  return matches.map((m, i) => {
    const inicio = m.index + m[0].length;
    const fim = i < matches.length - 1 ? matches[i + 1].index : texto.length;
    const num = parseInt(m[1]);
    return {
      numero: m[1],
      titulo: m[2].trim(),
      conteudo: texto.slice(inicio, fim).trim(),
      cor: PASSOS_CONFIG[num - 1]?.cor || "#94a3b8",
      emoji: PASSOS_CONFIG[num - 1]?.emoji || "⬜",
    };
  });
};

const parseDicaMestre = (texto) => {
  if (!texto) return null;
  const partes = texto.split(/\s*↓\s*/);
  if (partes.length < 2) return null;

  // Formato premium: 4 partes
  if (partes.length >= 4) {
    return {
      formato:        "premium",
      frase:          partes[0].trim(),
      pivot:          partes[1].trim(),
      caminhoCorreto: partes[2].trim(),
      porQueErram:    partes[3].trim(),
    };
  }

  // Formato legacy: 2–3 partes
  const primeiro = partes[0].trim();
  const temMnemonic = primeiro.includes("\n") || primeiro.length > 50;
  return {
    formato:  "legacy",
    mnemonic: temMnemonic ? primeiro : null,
    gatilho:  temMnemonic ? primeiro.split("\n")[0].trim() : primeiro,
    resposta: partes[1].trim(),
    erro:     partes[2]?.trim() || null,
  };
};

// Estratégia da Aposta — exclusivo Super Apostas 2026.2. Mesmo padrão de
// separador " ↓ " já usado pela Dica Mestre, só que com 3 blocos fixos.
const parseEstrategiaAposta = (texto) => {
  if (!texto) return null;
  const partes = texto.split(/\s*↓\s*/).map((p) => p.trim()).filter(Boolean);
  if (partes.length < 3) return null;
  return {
    porQueApostamos:    partes[0],
    comoPodeCair:       partes[1],
    armadilhaProvavel:  partes[2],
  };
};

const renderLinhasTTO = (conteudo, cor) => {
  if (!conteudo) return null;
  return conteudo.split("\n").filter(l => l.trim()).map((linha, i) => {
    const t = linha.trim();
    if (t.startsWith("•") || t.startsWith("✗") || t.startsWith("-")) {
      const isErro = t.startsWith("✗");
      return (
        <div key={i} style={{ display: "flex", gap: "8px", alignItems: "flex-start", marginBottom: "4px" }}>
          <span style={{ color: isErro ? "#ef4444" : cor, flexShrink: 0, fontSize: "13px" }}>
            {isErro ? "✗" : "•"}
          </span>
          <span style={{ color: isErro ? "#fca5a5" : "#cbd5e1", fontSize: "13px", lineHeight: 1.5 }}>
            {t.slice(1).trim()}
          </span>
        </div>
      );
    }
    const ci = t.indexOf(":");
    if (ci > 0 && ci < 22 && !t.startsWith("PASSO")) {
      const key = t.slice(0, ci).trim();
      const val = t.slice(ci + 1).trim();
      if (val) return (
        <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
          <span style={{ color: cor, fontSize: "11px", fontWeight: "900", minWidth: "80px", flexShrink: 0 }}>{key}:</span>
          <span style={{ color: "#e2e8f0", fontSize: "13px", flex: 1 }}>{val}</span>
        </div>
      );
    }
    return <p key={i} style={{ margin: "0 0 4px", color: "#94a3b8", fontSize: "13px", lineHeight: 1.5 }}>{t}</p>;
  });
};

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
    <div style={{ marginBottom: "24px", background: "#0f172a", border: "1px solid rgba(99,102,241,0.25)", borderRadius: "14px", overflow: "hidden" }}>
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
          {/* X labels — sempre renderizados */}
          {dados.map((d, i) => (
            <text key={i} x={cx(i)} y={MT + CH + 16} textAnchor="middle" {...tx}>
              {String(d.x).length > 5 ? String(d.x).slice(0, 4) + "…" : d.x}
            </text>
          ))}
          {/* Dados — multi-série, linha única ou barras */}
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
    <div style={{ marginBottom: "24px", background: "#0f172a", border: "1px solid rgba(236,72,153,0.25)", borderRadius: "14px", overflow: "hidden" }}>
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
      marginBottom: "24px", background: "#0f172a",
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
      marginBottom: "24px", background: "#0f172a",
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

const Simulador = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const {
    materiaSelecionada, subtema, provaId, modoMesclado,
    simuladoGeral, modoPersonalizado, materiasFiltro, limiteQuestoes,
    comTempo, questoesCustomizadas, tempoCustom, modoOficial
  } = location.state || {};

  const [questoes, setQuestoes] = useState([]);
  const [indice, setIndice] = useState(0);
  const [respostasSalvas, setRespostasSalvas] = useState({});
  const [tempo, setTempo] = useState(0);
  const [tempoDecorrido, setTempoDecorrido] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showDuvidaModal, setShowDuvidaModal] = useState(false);
  const [textoDuvida, setTextoDuvida] = useState("");
  const [enviandoDuvida, setEnviandoDuvida] = useState(false);
  const [modoFoco, setModoFoco] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mostrarResultados, setMostrarResultados] = useState(false);
  const [showModalSair, setShowModalSair] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const allowNavRef = useRef(false); // permite a navegação após confirmação
  const [rangeInicio, setRangeInicio] = useState(0);
  // ✅ NOVO: Estado para mostrar gabarito da alternativa marcada
  const [_showGabarito, _setShowGabarito] = useState({});
  const [showTeoria, setShowTeoria] = useState(false);
  const [showCorrecaoDetalhada, setShowCorrecaoDetalhada] = useState(false);
  const [filtroCorrecao, setFiltroCorrecao] = useState("todas"); // "todas" | "erradas" | "certas"
  const [lightboxUrl, setLightboxUrl] = useState(null);

  // ── Progresso salvo (continuar de onde parou) ──────────────────────────────
  const [modalProgresso, setModalProgresso] = useState(null); // { indice, respostasSalvas, totalRespondidas }
  const [_salvandoProgresso, _setSalvandoProgresso] = useState(false);

  const windowSize = 10;

  // ── Funções de persistência de progresso (apenas provaId = INEP) ─────────────

  // Caminho: usuarios/{uid}/progressoSimulado/{provaId}
  const progressoRef = () => {
    if (!provaId || !auth.currentUser) return null;
    return doc(db, "usuarios", auth.currentUser.uid, "progressoSimulado", String(provaId));
  };

  // Grava estado atual no Firestore (fire-and-forget, não bloqueia a UI)
  const salvarProgresso = (respostas, idx, questoesCarregadas) => {
    const ref = progressoRef();
    if (!ref) return;
    const ids = (questoesCarregadas || questoes).map(q => q.id);
    setDoc(ref, {
      provaId: String(provaId),
      indice: idx,
      respostasSalvas: respostas,
      totalRespondidas: Object.keys(respostas).length,
      totalQuestoes: ids.length,
      questoesIds: ids,
      status: "em_andamento",
      atualizadoEm: serverTimestamp(),
    }, { merge: true }).catch(() => {});
  };

  // Lê progresso salvo; retorna dados ou null se não houver / já estiver finalizado
  const verificarProgresso = async () => {
    const ref = progressoRef();
    if (!ref) return null;
    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) return null;
      const data = snap.data();
      if (data.status === "finalizado") return null;
      if (!data.respostasSalvas || Object.keys(data.respostasSalvas).length === 0) return null;
      return data;
    } catch { return null; }
  };

  // Marca progresso como finalizado (chamado após _gravarRespostas)
  const marcarFinalizado = () => {
    const ref = progressoRef();
    if (!ref) return;
    setDoc(ref, { status: "finalizado", atualizadoEm: serverTimestamp() }, { merge: true }).catch(() => {});
  };

  // Se não há state de navegação (refresh de página ou acesso direto pela URL),
  // redireciona imediatamente para o dashboard — não há questões para carregar.
  const temState = !!(
    materiaSelecionada || provaId || simuladoGeral ||
    modoPersonalizado || questoesCustomizadas?.length
  );

  useEffect(() => {
    if (!temState) {
      navigate("/", { replace: true });
    }
  }, []);

  // Bloqueia navegação acidental (sidebar, back, etc.) quando há sessão ativa.
  // Usa interceptação de history.pushState pois o projeto usa BrowserRouter
  // (useBlocker exige createBrowserRouter / data router).
  // loading está incluído: só ativa após as questões estarem prontas na tela.
  const sessaoAtiva = questoes.length > 0 && !loading && !mostrarResultados && !salvando;

  useEffect(() => {
    if (!sessaoAtiva) return;

    // ── Intercepta cliques em links internos (sidebar, menus, etc.) ──────
    // Fase de captura garante que chegamos antes do React Router processar.
    const handleClick = (e) => {
      if (allowNavRef.current) return;
      const anchor = e.target.closest("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href") || "";
      // Ignora âncoras, links externos e downloads
      if (href.startsWith("#") || href.startsWith("http") || href.startsWith("mailto")) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      setPendingNavigation(href);
      setShowModalSair(true);
    };
    document.addEventListener("click", handleClick, true);

    // ── Intercepta back/forward do browser ───────────────────────────────
    const handlePopState = () => {
      window.history.pushState(null, "", window.location.href);
      setPendingNavigation("/");
      setShowModalSair(true);
    };
    window.history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [sessaoAtiva]);

  useEffect(() => {
    const novaPagina = Math.floor(indice / windowSize) * windowSize;
    if (novaPagina !== rangeInicio) setRangeInicio(novaPagina);
  }, [indice]);

  // ✅ LÓGICA ORIGINAL PRESERVADA
  const shuffleArray = (array) => {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
      [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
  };
  const carregarQuestoes = useCallback(async () => {
    setLoading(true);
    try {
      if (questoesCustomizadas && questoesCustomizadas.length > 0) {
        setQuestoes(questoesCustomizadas);
        // ✅ FIX: setar tempo ANTES do return (questoesCustomizadas pulava este passo)
        if (comTempo !== false) setTempo(tempoCustom || questoesCustomizadas.length * 144);
        setLoading(false);
        return;
      }

      const qRef = collection(db, "questoes");
      let lista = [];

      if (modoPersonalizado && materiasFiltro) {
        const q = query(qRef, where("materia", "in", materiasFiltro));
        const snap = await getDocs(q);
        lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        lista = shuffleArray(lista);
      } else if (simuladoGeral) {
        const snap = await getDocs(qRef);
        lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        lista = shuffleArray(lista);
      } else if (provaId) {
        const q = modoMesclado
          ? query(qRef, where("provaId", ">=", provaId), where("provaId", "<", (parseInt(provaId) + 1).toString()))
          : query(qRef, where("provaId", "==", provaId));
        const snap = await getDocs(q);
        lista = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => parseInt(a.numeroQuestao || 0) - parseInt(b.numeroQuestao || 0));
      } else if (materiaSelecionada) {
        const q = query(qRef, where("materia", "==", materiaSelecionada), limit(500));
        const snap = await getDocs(q);
        const todasDaMateria = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        lista = subtema
          ? todasDaMateria.filter(q => q.subtema && q.subtema.trim().toLowerCase().startsWith(subtema.trim().toLowerCase()))
          : todasDaMateria;
        lista = shuffleArray(lista);
      }

      // Anti-repetição: exclui questões já respondidas recentemente (últimas 200)
      // Não se aplica a simulados de prova (provaId) nem ao caderno de erros (questoesCustomizadas)
      if (!provaId && auth.currentUser) {
        try {
          const respostasRef = collection(db, "usuarios", auth.currentUser.uid, "respostas");
          const qRespostas = query(respostasRef, orderBy("data", "desc"), limit(200));
          const snapRespostas = await getDocs(qRespostas);
          const idsRespondidos = new Set(snapRespostas.docs.map(d => d.data().questaoId).filter(Boolean));
          const listaFiltrada = lista.filter(q => !idsRespondidos.has(q.id));
          // Se restar questões suficientes, usa a lista filtrada; caso contrário usa a lista completa
          if (listaFiltrada.length >= Math.min(limiteQuestoes || 10, 5)) {
            lista = listaFiltrada;
          }
        } catch { /* Ignora erros de anti-repetição, continua com lista normal */ }
      }

      const final = lista.slice(0, limiteQuestoes || 100);
      setQuestoes(final);
      // tempoCustom permite definir tempo preciso (ex: Simulado Oficial = 14400s = 4h)
      if (comTempo !== false) setTempo(tempoCustom || final.length * 144);

      // ── Verifica progresso salvo (apenas provas INEP com provaId fixo) ──
      if (provaId && auth.currentUser) {
        const progresso = await verificarProgresso();
        if (progresso && progresso.totalRespondidas > 0) {
          setModalProgresso({
            indice: progresso.indice || 0,
            respostasSalvas: progresso.respostasSalvas || {},
            totalRespondidas: progresso.totalRespondidas || 0,
            totalQuestoes: final.length,
            questoesCarregadas: final,
          });
        }
      }
    } catch (err) { console.error("Erro no Simulador:", err); }
    setLoading(false);
  }, [materiaSelecionada, subtema, provaId, modoMesclado, simuladoGeral, modoPersonalizado, materiasFiltro, limiteQuestoes, comTempo, questoesCustomizadas]);
  useEffect(() => { carregarQuestoes(); }, [carregarQuestoes]);

  useEffect(() => {
    if (comTempo === false || tempo === 0 || mostrarResultados) return;
    const timer = setInterval(() => setTempo(t => t <= 0 ? 0 : t - 1), 1000);
    return () => clearInterval(timer);
  }, [comTempo, tempo, mostrarResultados]);

  // Contador crescente de tempo de estudo (independente do modo com/sem tempo)
  useEffect(() => {
    if (loading || mostrarResultados) return;
    const timer = setInterval(() => setTempoDecorrido(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, [loading, mostrarResultados]);

  // FIX: lógica de gravação centralizada — elimina duplicata entre sairSalvando
  // e finalizarESalvar, que antes continham ~20 linhas idênticas cada.
  // Qualquer correção futura precisa ser feita em um único lugar.
  const _gravarRespostas = async () => {
    const statsPorMateriaFinal = {};
    for (const idx in respostasSalvas) {
      const questao = questoes[idx];
      const gabarito = (questao.gabarito || questao.correta || "").toString().toLowerCase();
      const acertou = respostasSalvas[idx].toLowerCase() === gabarito;
      await registrarRespostaIndividual(questao, acertou);
      const mat = questao.materia || "Geral";
      if (!statsPorMateriaFinal[mat]) statsPorMateriaFinal[mat] = { total: 0, acertos: 0 };
      statsPorMateriaFinal[mat].total++;
      if (acertou) statsPorMateriaFinal[mat].acertos++;
    }
    for (const mat in statsPorMateriaFinal) {
      const { total, acertos } = statsPorMateriaFinal[mat];
      await gravarDesempenhoFinalLote(mat, total, acertos);
    }
    await atualizarStreakDiario();
    await atualizarEstatisticasFinais(tempoDecorrido);
  };

  // Abre o modal de confirmação de saída (sem salvar — só Finalizar salva)
  const sairSalvando = () => {
    const respondidas = Object.keys(respostasSalvas).length;
    if (respondidas === 0) {
      allowNavRef.current = true;
      navigate("/");
      return;
    }
    setPendingNavigation("/");
    setShowModalSair(true);
  };

  // Confirma saída: salva progresso (para retomar depois) e navega
  const confirmarSaida = () => {
    setShowModalSair(false);
    // Salva posição atual para retomar depois (apenas provaId)
    if (provaId && Object.keys(respostasSalvas).length > 0) {
      salvarProgresso(respostasSalvas, indice);
    }
    allowNavRef.current = true;          // libera o próximo navigate()
    navigate(pendingNavigation || "/");
  };

  const responder = (letra) => {
    if (respostasSalvas[indice] || mostrarResultados) return;
    const novas = { ...respostasSalvas, [indice]: letra };
    setRespostasSalvas(novas);
    salvarProgresso(novas, indice);
    const qAtual = questoes[indice];
    const gabarito = (qAtual?.gabarito || qAtual?.correta || "").toString().toLowerCase();
    const modulo = provaId ? "simulado_oficial"
      : qAtual?.modulo === "super_apostas" ? "super_apostas"
      : "estudo_livre";
    registrarAnalyticsCognitivo(qAtual, letra, letra.toLowerCase() === gabarito, modulo);
  };

  const finalizarESalvar = async () => {
    const respondidas = Object.keys(respostasSalvas).length;
    if (respondidas === 0) return navigate("/dashboard");
    if (!mostrarResultados) {
      // Mostra resultados primeiro — aluno revisa e clica "SALVAR E SAIR" para confirmar
      setMostrarResultados(true);
      return;
    }
    // Única chamada a _gravarRespostas: só quando o aluno clica "SALVAR E SAIR"
    setSalvando(true);
    try {
      await _gravarRespostas();
      marcarFinalizado(); // limpa progresso pendente após salvar resultados
      navigate("/dashboard");
    } catch { alert("Erro ao gravar."); }
    setSalvando(false);
  };

  // ✅ LÓGICA ORIGINAL PRESERVADA
  const statsPorMateria = useMemo(() => {
    const stats = {};
    Object.keys(respostasSalvas).forEach(idx => {
      const q = questoes[idx];
      if (!q) return;
      if (!stats[q.materia]) stats[q.materia] = { total: 0, acertos: 0 };
      stats[q.materia].total++;
      const gab = (q.gabarito || q.correta || "").toString().toLowerCase();
      if (respostasSalvas[idx].toLowerCase() === gab) stats[q.materia].acertos++;
    });
    return stats;
  }, [respostasSalvas, questoes]);

  const handleEnviarDuvida = async () => {
    if (!textoDuvida.trim()) return alert("Digite sua dúvida.");
    setEnviandoDuvida(true);
    try {
      const q = questoes[indice];
      const user = auth.currentUser;
      await addDoc(collection(db, "duvidas_questoes"), {
        alunoId: user ? user.uid : "anonimo",
        usuarioId: user ? user.uid : "anonimo",
        alunoNome: user ? user.displayName : "Aluno Pro",
        usuarioEmail: user ? user.email : "Email não identificado",
        questaoId: q.id || "sem-id",
        materia: q.materia || "Geral",
        enunciado: q.enunciado || "",
        duvida: textoDuvida,
        respondida: false,
        dataEnvio: serverTimestamp(),
        status: "pendente",
        mensagens: []
      });
      alert("Dúvida enviada com sucesso!");
      setTextoDuvida(""); setShowDuvidaModal(false);
    } catch { alert("Erro ao enviar."); }
    setEnviandoDuvida(false);
  };

  const irProxima = () => {
    if (indice < questoes.length - 1) {
      const proximo = indice + 1;
      setIndice(proximo);
      // Salva índice atual ao avançar (garante que retomada começa na questão certa)
      if (provaId) salvarProgresso(respostasSalvas, proximo);
    }
  };
  const irAnterior = () => { if (indice > 0) setIndice(indice - 1); };

  if (loading || salvando) return (
    <div style={st.centro}>
      <div className="spinner"></div>
      <p style={{ marginTop: "16px", color: "#818cf8", fontWeight: "700", fontSize: "13px" }}>
        {salvando ? "Sincronizando prontuários..." : "Calibrando questões..."}
      </p>
    </div>
  );

  if (questoes.length === 0) return (
    <div style={st.centro}>
      <div style={{ textAlign: "center" }}>
        <p style={{ color: "#94a3b8", fontSize: "16px", marginBottom: "20px" }}>Nenhuma questão encontrada.</p>
        <button onClick={() => navigate("/dashboard")} style={st.btnSair}>VOLTAR</button>
      </div>
    </div>
  );

  const q = questoes[indice];
  const respondida = !!respostasSalvas[indice] || mostrarResultados;
  const isLowTime = comTempo !== false && tempo < 300 && tempo > 0;
  const acertosTotal = Object.keys(respostasSalvas).filter(idx => {
    const qNum = questoes[idx];
    return respostasSalvas[idx].toLowerCase() === (qNum.gabarito || qNum.correta || "").toString().toLowerCase();
  }).length;

  const formatarTempo = (segundos) => {
    const h = Math.floor(segundos / 3600);
    const m = Math.floor((segundos % 3600) / 60);
    const s = segundos % 60;
    return `${h > 0 ? h + ":" : ""}${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const respondeu = respostasSalvas[indice];
  const gabaritoCerto = (q.gabarito || q.correta || "").toString().toLowerCase();
  const acertouAtual = respondeu && respondeu.toLowerCase() === gabaritoCerto;
  const racioParseado           = parseRaciocinio(q?.raciocinio);
  const ttoParseado             = parseTTO(q?.tto);
  const dicaMestreParseada      = parseDicaMestre(q?.dicaMestre);
  const estrategiaApostaParseada = parseEstrategiaAposta(q?.estrategiaAposta);

  return (
    <div className="sim-wrapper" style={{ ...st.container, background: modoFoco ? "#000" : "#020617" }}>

      {/* ─── MODAL DE CONFIRMAÇÃO DE SAÍDA ─── */}
      {showModalSair && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(2,6,23,0.88)", backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "20px"
        }}>
          <div style={{
            background: "#0f172a", border: "1px solid #ef4444",
            borderRadius: "20px", padding: "32px 28px", maxWidth: "380px", width: "100%",
            boxShadow: "0 0 40px rgba(239,68,68,0.2)",
            display: "flex", flexDirection: "column", alignItems: "center", gap: "16px",
            textAlign: "center"
          }}>
            <div style={{
              width: "52px", height: "52px", borderRadius: "50%",
              background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <FaSignOutAlt color="#ef4444" size={20} />
            </div>
            <h3 style={{ color: "#f1f5f9", fontWeight: "800", fontSize: "17px", margin: 0 }}>
              Sair do simulado?
            </h3>
            <p style={{ color: "#94a3b8", fontSize: "13px", lineHeight: 1.6, margin: 0 }}>
              {provaId
                ? <>Seu progresso será <strong style={{ color: "#10b981" }}>salvo automaticamente</strong>.<br />Você pode retomar de onde parou na próxima vez.</>
                : <>Seu progresso <strong style={{ color: "#ef4444" }}>não será salvo</strong>.<br />Para salvar, use o botão <strong style={{ color: "#10b981" }}>FINALIZAR</strong>.</>
              }
            </p>
            <div style={{ display: "flex", gap: "12px", width: "100%", marginTop: "4px" }}>
              <button
                onClick={() => setShowModalSair(false)}
                style={{
                  flex: 1, padding: "12px", borderRadius: "12px",
                  background: "rgba(255,255,255,0.05)", border: "1px solid #334155",
                  color: "#94a3b8", fontWeight: "700", fontSize: "13px", cursor: "pointer"
                }}
              >
                Continuar estudando
              </button>
              <button
                onClick={confirmarSaida}
                style={{
                  flex: 1, padding: "12px", borderRadius: "12px",
                  background: "linear-gradient(135deg, #ef4444, #dc2626)",
                  border: "none", color: "#fff", fontWeight: "800", fontSize: "13px", cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(239,68,68,0.3)"
                }}
              >
                {provaId ? "Sair (progresso salvo)" : "Sair sem salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: CONTINUAR OU REINICIAR ─── */}
      {modalProgresso && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(2,6,23,0.92)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "20px"
        }}>
          <div style={{
            background: "#0f172a", border: "1px solid #4f46e5",
            borderRadius: "20px", padding: "32px 28px", maxWidth: "400px", width: "100%",
            boxShadow: "0 0 48px rgba(79,70,229,0.25)",
            display: "flex", flexDirection: "column", alignItems: "center", gap: "16px",
            textAlign: "center"
          }}>
            {/* Ícone */}
            <div style={{
              width: "56px", height: "56px", borderRadius: "50%",
              background: "rgba(79,70,229,0.12)", border: "1px solid rgba(79,70,229,0.35)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px"
            }}>⚡</div>

            <h3 style={{ color: "#f1f5f9", fontWeight: "900", fontSize: "18px", margin: 0 }}>
              Simulado em andamento
            </h3>
            <p style={{ color: "#94a3b8", fontSize: "13px", lineHeight: 1.6, margin: 0 }}>
              Você respondeu{" "}
              <strong style={{ color: "#818cf8" }}>
                {modalProgresso.totalRespondidas} de {modalProgresso.totalQuestoes} questões
              </strong>{" "}
              da prova. Deseja continuar de onde parou?
            </p>

            {/* Barra de progresso */}
            <div style={{ width: "100%", background: "#1e293b", borderRadius: "6px", height: "6px", overflow: "hidden" }}>
              <div style={{
                width: `${Math.round((modalProgresso.totalRespondidas / modalProgresso.totalQuestoes) * 100)}%`,
                height: "100%",
                background: "linear-gradient(90deg, #4f46e5, #818cf8)",
                borderRadius: "6px",
                transition: "width 0.4s ease"
              }} />
            </div>
            <p style={{ color: "#475569", fontSize: "11px", margin: "-8px 0 0", fontWeight: "700" }}>
              {Math.round((modalProgresso.totalRespondidas / modalProgresso.totalQuestoes) * 100)}% concluído
            </p>

            <div style={{ display: "flex", gap: "12px", width: "100%", marginTop: "4px" }}>
              {/* Reiniciar */}
              <button
                onClick={() => {
                  // Apaga progresso salvo e começa do zero
                  const ref = progressoRef();
                  if (ref) deleteDoc(ref).catch(() => {});
                  setModalProgresso(null);
                }}
                style={{
                  flex: 1, padding: "12px", borderRadius: "12px",
                  background: "rgba(255,255,255,0.04)", border: "1px solid #334155",
                  color: "#94a3b8", fontWeight: "700", fontSize: "13px", cursor: "pointer"
                }}
              >
                Reiniciar
              </button>
              {/* Continuar */}
              <button
                onClick={() => {
                  setRespostasSalvas(modalProgresso.respostasSalvas);
                  setIndice(modalProgresso.indice);
                  setModalProgresso(null);
                }}
                style={{
                  flex: 1, padding: "12px", borderRadius: "12px",
                  background: "linear-gradient(135deg, #4f46e5, #6d28d9)",
                  border: "none", color: "#fff", fontWeight: "800", fontSize: "13px", cursor: "pointer",
                  boxShadow: "0 4px 16px rgba(79,70,229,0.4)"
                }}
              >
                Continuar ▶
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── BARRA SUPERIOR ─── */}
      <div className="top-container" style={{ ...st.topContainer, background: modoFoco ? "#080808" : "#1e293b" }}>

        {/* ROW 1: Ações */}
        <div className="action-row" style={st.actionRow}>
          <button onClick={sairSalvando} style={st.btnSair}>
            <FaSignOutAlt size={13} /> SAIR
          </button>

          {/* PROGRESSO CENTRAL */}
          <div style={st.progressoCenter}>
            <span style={st.progressoNum}>{indice + 1} / {questoes.length}</span>
            <div style={st.progressoBar}>
              <div style={{ ...st.progressoFill, width: `${((indice + 1) / questoes.length) * 100}%` }} />
            </div>
            <span style={{ ...st.progressoNum, color: "#10b981" }}>
              {acertosTotal} ✓
            </span>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={() => setModoFoco(!modoFoco)} style={{ ...st.btnAction, background: modoFoco ? "#fbbf24" : "rgba(255,255,255,0.08)" }} title="Modo Foco">
              {modoFoco ? <FaSun color="#000" size={14} /> : <FaMoon size={14} />}
            </button>
            <button onClick={finalizarESalvar} style={st.btnGravar}>
              {mostrarResultados ? "SALVAR E SAIR" : <><FaCheckDouble size={12} /> FINALIZAR</>}
            </button>
          </div>
        </div>

        {/* ROW 2: Navegação por bolinhas */}
        <div className="pagination-bar" style={st.paginationBar}>
          <button
            onClick={() => setRangeInicio(Math.max(0, rangeInicio - windowSize))}
            disabled={rangeInicio === 0}
            style={{ ...st.arrowBtn, opacity: rangeInicio === 0 ? 0.2 : 1 }}
          ><FaChevronLeft size={11} /></button>

          <div className="dotsWrapper" style={st.dotsWrapper}>
            {questoes.slice(rangeInicio, rangeInicio + windowSize).map((_, i) => {
              const realIdx = rangeInicio + i;
              const r = respostasSalvas[realIdx];
              const gab = (questoes[realIdx].gabarito || questoes[realIdx].correta || "").toString().toLowerCase();
              const acertou = r && r.toLowerCase() === gab;
              return (
                <div
                  key={realIdx}
                  onClick={() => setIndice(realIdx)}
                  title={`Questão ${realIdx + 1}`}
                  style={{
                    ...st.dot,
                    border: indice === realIdx ? "2px solid #4f46e5" : "1px solid #334155",
                    background: r
                      ? (mostrarResultados ? (acertou ? "#10b981" : "#ef4444") : "#4f46e5")
                      : indice === realIdx ? "rgba(79,70,229,0.15)" : "transparent",
                    color: (r || indice === realIdx) ? "#fff" : "#64748b",
                    transform: indice === realIdx ? "scale(1.15)" : "scale(1)",
                  }}
                >{realIdx + 1}</div>
              );
            })}
          </div>

          <button
            onClick={() => setRangeInicio(Math.min(questoes.length - windowSize, rangeInicio + windowSize))}
            disabled={rangeInicio + windowSize >= questoes.length}
            style={{ ...st.arrowBtn, opacity: rangeInicio + windowSize >= questoes.length ? 0.2 : 1 }}
          ><FaChevronRight size={11} /></button>
        </div>
      </div>

      {/* ─── TELA DE RESULTADOS ─── */}
      {mostrarResultados && (
        <div style={st.resumoOverlay}>
          <div style={st.resumoCard}>
            <div style={{ textAlign: "center", marginBottom: "20px" }}>
              <FaTrophy size={40} color="#fbbf24" />
              <h2 style={{ color: "#fff", margin: "12px 0 6px" }}>Resultado Parcial</h2>
              <p style={{ color: "#64748b", fontSize: "13px", margin: 0 }}>
                {Object.keys(respostasSalvas).length} de {questoes.length} questões respondidas
              </p>
            </div>

            {/* SCORE VISUAL */}
            <div style={st.scoreBox}>
              <div style={{ ...st.scoreItem, borderColor: "#10b981" }}>
                <h3 style={{ color: "#10b981", margin: 0, fontSize: "28px" }}>{acertosTotal}</h3>
                <p style={{ margin: 0, fontSize: "11px", color: "#64748b" }}>ACERTOS</p>
              </div>
              <div style={{ ...st.scoreItem, borderColor: "#ef4444" }}>
                <h3 style={{ color: "#ef4444", margin: 0, fontSize: "28px" }}>{Object.keys(respostasSalvas).length - acertosTotal}</h3>
                <p style={{ margin: 0, fontSize: "11px", color: "#64748b" }}>ERROS</p>
              </div>
              <div style={{ ...st.scoreItem, borderColor: "#4f46e5" }}>
                <h3 style={{ color: "#818cf8", margin: 0, fontSize: "28px" }}>
                  {Object.keys(respostasSalvas).length > 0 ? Math.round((acertosTotal / Object.keys(respostasSalvas).length) * 100) : 0}%
                </h3>
                <p style={{ margin: 0, fontSize: "11px", color: "#64748b" }}>TAXA</p>
              </div>
            </div>

            {/* BARRA DE APROVEITAMENTO */}
            <div style={{ margin: "16px 0", background: "#1e293b", borderRadius: "100px", height: "8px", overflow: "hidden" }}>
              <div style={{
                height: "100%",
                borderRadius: "100px",
                background: acertosTotal / Math.max(Object.keys(respostasSalvas).length, 1) >= 0.7 ? "#10b981" : "#ef4444",
                width: `${Object.keys(respostasSalvas).length > 0 ? (acertosTotal / Object.keys(respostasSalvas).length) * 100 : 0}%`,
                transition: "width 1s ease"
              }} />
            </div>

            {/* POR MATÉRIA */}
            <div style={{ marginBottom: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
              {Object.keys(statsPorMateria).map(m => {
                const p = Math.round((statsPorMateria[m].acertos / statsPorMateria[m].total) * 100);
                return (
                  <div key={m} style={st.materiaRow}>
                    <span style={{ fontSize: "12px", color: "#fff", flex: 1 }}>{m}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ background: "#1e293b", borderRadius: "4px", height: "4px", width: "60px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${p}%`, background: p >= 70 ? "#10b981" : "#ef4444" }} />
                      </div>
                      <span style={{ fontWeight: "bold", color: p >= 70 ? "#10b981" : "#ef4444", fontSize: "12px", minWidth: "36px", textAlign: "right" }}>{p}%</span>
                      {p < 70 && (
                        <button onClick={() => navigate("/materiais")} style={st.btnReview}>
                          <FaFilePdf size={10} /> ESTUDAR
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* GRADE DE QUESTÕES */}
            <div style={st.gradeResultados}>
              {questoes.map((_, i) => {
                const r = respostasSalvas[i];
                const gab = (questoes[i].gabarito || questoes[i].correta || "").toString().toLowerCase();
                return (
                  <div
                    key={i}
                    onClick={() => { setIndice(i); setMostrarResultados(false); }}
                    title={`Q${i + 1}`}
                    style={{
                      ...st.dotResumo,
                      background: !r ? "#1e293b" : r.toLowerCase() === gab ? "#10b981" : "#ef4444"
                    }}
                  >{i + 1}</div>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "20px", flexWrap: "wrap" }}>
              <button onClick={() => setMostrarResultados(false)} style={{ ...st.btnNav, flex: 1, background: "#1e293b", justifyContent: "center" }}>
                <FaEye size={12} /> REVISAR
              </button>
              {modoOficial && (
                <button onClick={() => setShowCorrecaoDetalhada(true)} style={{ ...st.btnNav, flex: 1, background: "#4f46e5", justifyContent: "center" }}>
                  <FaListOl size={12} /> VER CORREÇÃO
                </button>
              )}
              <button onClick={finalizarESalvar} style={{ ...st.btnNav, flex: 1, background: "#10b981", justifyContent: "center" }}>
                SALVAR E SAIR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── CARD PRINCIPAL DA QUESTÃO ─── */}
      <div className="sim-card" style={{ ...st.card, background: modoFoco ? "#050505" : "#1e293b", borderColor: modoFoco ? "#111" : "#334155" }}>

        {/* META DA QUESTÃO */}
        <div className="meta-data" style={st.metaData}>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            <span style={st.numBadge}>Q{indice + 1} de {questoes.length}</span>
            <span style={st.badge}>{q.materia}</span>
            {q.subtema && <span style={st.badgeSub}>{q.subtema}</span>}
            {q.ano && <span style={{ ...st.badgeSub, color: "#64748b", background: "rgba(100,116,139,0.1)" }}>{q.ano}</span>}
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
            <button onClick={() => setShowDuvidaModal(true)} style={st.btnHelp}>
              <FaQuestionCircle size={11} /> DÚVIDA
            </button>
            <div style={{
              ...st.timer,
              color: isLowTime ? "#ef4444" : comTempo !== false ? "#fff" : "#10b981",
              border: `1px solid ${isLowTime ? "#ef4444" : "#334155"}`,
              animation: isLowTime ? "pulse 1s infinite" : "none"
            }}>
              {comTempo !== false
                ? <><FaClock size={11} /> {formatarTempo(tempo)}</>
                : <><FaBookOpen size={11} color="#10b981" /> ESTUDO</>}
            </div>
          </div>
        </div>

        {/* ENUNCIADO */}
        <div style={st.enunciadoWrapper}>
          <h2 className="enunciado" style={st.enunciado}>{q.enunciado}</h2>
        </div>

        {/* TABELA DE DADOS */}
        {renderTabelaDados(q.tabelaDados, q.descricaoTabela)}

        {/* VISUAL — gráfico / partograma / imagem clínica */}
        {q.imagemTipo === "grafico" && q.graficoDados
          ? renderGrafico(q.graficoDados, q.imagemLegenda)
          : q.imagemTipo === "partograma" && (q.imagemUrl || q.imagemStoragePath)
          ? renderPartograma(q.imagemUrl, q.imagemStoragePath, q.imagemLegenda, setLightboxUrl)
          : (q.imagemUrl || q.imagemStoragePath)
          ? (
            <div style={st.imgBox}>
              <StorageImage
                storagePath={q.imagemStoragePath}
                directUrl={q.imagemUrl}
                alt={q.imagemLegenda || "Imagem da questão"}
                style={{ ...st.imagem, cursor: "zoom-in" }}
                onClick={(src) => setLightboxUrl(src)}
              />
              {q.imagemLegenda && (
                <p style={{ margin: "8px 0 0", fontSize: "11px", color: "#64748b", fontStyle: "italic", textAlign: "center" }}>
                  {q.imagemLegenda}
                </p>
              )}
            </div>
          ) : null
        }

        {/* ALERTA RECURSO VISUAL PENDENTE */}
        {renderAlertaRecursoVisual(q.recursoVisual, q.imagemUrl, q.imagemStoragePath, q.tabelaDados, q.graficoDados)}

        {/* ✅ ALTERNATIVAS PREMIUM */}
        <div style={st.optionsGrid}>
          {["a", "b", "c", "d", "e"].map((letra, idx) => {
            const textoAlt = q.alternativas?.[idx] || q[`alternativa${letra.toUpperCase()}`] || q[letra];
            if (!textoAlt) return null;

            const gabaritoOficial = (q.gabarito || q.correta || "").toString().toLowerCase();
            const isCorreta = gabaritoOficial === letra;
            const marcada = respostasSalvas[indice] === letra;
            // Em modoOficial não revelamos gabarito durante a prova — só no resultado final
            const mostrarGab = respondida && !modoOficial;

            // Cores premium das alternativas
            let borderColor = "#334155";
            let bgColor = "transparent";
            let letraBg = "#0f172a";
            let letraColor = "#64748b";
            let textColor = "#cbd5e1";

            if (!mostrarGab && marcada) {
              borderColor = "#4f46e5";
              bgColor = "rgba(79,70,229,0.08)";
              letraBg = "#4f46e5";
              letraColor = "#fff";
              textColor = "#fff";
            } else if (mostrarGab && isCorreta) {
              borderColor = "#10b981";
              bgColor = "rgba(16,185,129,0.08)";
              letraBg = "#10b981";
              letraColor = "#fff";
              textColor = "#d1fae5";
            } else if (mostrarGab && marcada && !isCorreta) {
              borderColor = "#ef4444";
              bgColor = "rgba(239,68,68,0.08)";
              letraBg = "#ef4444";
              letraColor = "#fff";
              textColor = "#fecaca";
            }

            const nota = respondida && !modoOficial
              ? (q.alts?.[letra]?.nota || q[`justificativa${letra.toUpperCase()}`] || "")
              : "";
            const { tipo: tipoErro, subtitulo: subtituloErro, texto: notaTxt } = parseBadgeCognitivo(nota);
            const badgeErro = tipoErro ? BADGES_COGNITIVOS[tipoErro] : null;

            return (
              <button
                key={letra}
                onClick={() => responder(letra)}
                disabled={respondida}
                style={{ ...st.optionBtn, borderColor, background: bgColor, cursor: respondida ? "default" : "pointer" }}
              >
                {/* LETRA + TEXTO */}
                <div style={st.altHeader}>
                  <div style={{ ...st.letraIcon, background: letraBg, color: letraColor }}>
                    {mostrarGab && isCorreta ? <FaCheckCircle size={13} /> : mostrarGab && marcada && !isCorreta ? <FaTimesCircle size={13} /> : letra.toUpperCase()}
                  </div>
                  <span style={{ flex: 1, fontSize: "15px", color: textColor, textAlign: "left", lineHeight: 1.5, wordBreak: "break-word" }}>
                    {textoAlt}
                  </span>
                </div>

                {/* BADGE COGNITIVO + JUSTIFICATIVA */}
                {nota && (
                  <div style={{
                    marginTop: "10px", padding: "10px 14px",
                    background: isCorreta ? "rgba(16,185,129,0.06)" : "rgba(0,0,0,0.22)",
                    borderRadius: "10px",
                    borderLeft: `3px solid ${isCorreta ? "#10b981" : badgeErro?.cor || "#475569"}`,
                  }}>
                    {isCorreta && (
                      <div style={{
                        display: "inline-flex", alignItems: "center", gap: "4px",
                        padding: "2px 9px", borderRadius: "5px",
                        background: "rgba(16,185,129,0.1)", color: "#10b981",
                        fontSize: "9px", fontWeight: "900", letterSpacing: "0.5px",
                        marginBottom: "6px", border: "1px solid rgba(16,185,129,0.3)"
                      }}>✓ CORRETA</div>
                    )}
                    {tipoErro && !isCorreta && (
                      <div style={{ marginBottom: "6px" }}>
                        <div style={{
                          display: "inline-flex", alignItems: "center", gap: "4px",
                          padding: "2px 9px", borderRadius: "5px",
                          background: badgeErro.bg, color: badgeErro.cor,
                          fontSize: "9px", fontWeight: "900", letterSpacing: "0.5px",
                          textTransform: "uppercase",
                          border: `1px solid ${badgeErro.cor}40`
                        }}>{tipoErro}</div>
                        {subtituloErro && (
                          <div style={{
                            fontSize: "9px", color: badgeErro.cor, opacity: 0.75,
                            marginTop: "3px", fontStyle: "italic", letterSpacing: "0.2px",
                          }}>
                            {subtituloErro.toLowerCase().replace(/(?:^|\s)\S/g, c => c.toUpperCase())}
                          </div>
                        )}
                      </div>
                    )}
                    <p style={{ margin: 0, fontSize: "13px", lineHeight: 1.55,
                      color: isCorreta ? "#a7f3d0" : "#94a3b8" }}>
                      {isCorreta ? nota.replace(/^CORRETA[.\s:]+/i, "").trim() : notaTxt}
                    </p>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* ✅ PAINEL DO PROFESSOR (após responder — oculto em modoOficial) */}
        {respondida && !modoOficial && (
          <div style={st.professorPanel}>
            {/* STATUS BANNER */}
            <div style={{
              ...st.statusBanner,
              background: acertouAtual ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
              borderColor: acertouAtual ? "#10b981" : "#ef4444"
            }}>
              {acertouAtual
                ? <><FaCheckCircle color="#10b981" size={16} /> <span style={{ color: "#10b981", fontWeight: "800" }}>CORRETO! Gabarito: {gabaritoCerto.toUpperCase()}</span></>
                : <><FaTimesCircle color="#ef4444" size={16} /> <span style={{ color: "#ef4444", fontWeight: "800" }}>INCORRETO. Gabarito: {gabaritoCerto.toUpperCase()}</span></>
              }
            </div>

            {/* ─── 🧠 RACIOCÍNIO CLÍNICO ESTRUTURADO ─── */}
            {q.raciocinio && (
              <div style={st.racioBox}>
                <div style={st.racioHeader}>
                  <FaStethoscope size={10} color="#818cf8" /> 🧠 RACIOCÍNIO CLÍNICO
                </div>
                {racioParseado ? (
                  <div className="expert-row" style={st.racioGrid}>
                    {[
                      { key: "PADRÃO",      cor: "#3b82f6", icon: "🔍" },
                      { key: "DIFERENCIAL", cor: "#f97316", icon: "⚖" },
                      { key: "DECISÃO",     cor: "#10b981", icon: "✓"  },
                      { key: "ARMADILHA",   cor: "#ef4444", icon: "⚠"  },
                    ].filter(e => racioParseado[e.key]).map(({ key, cor, icon }) => (
                      <div key={key} style={{
                        padding: "10px 13px", background: "#020617",
                        borderRadius: "10px", borderTop: `2px solid ${cor}`,
                      }}>
                        <div style={{ fontSize: "9px", fontWeight: "900", color: cor,
                          marginBottom: "5px", letterSpacing: "0.5px" }}>
                          {icon} {key}
                        </div>
                        <p style={{ fontSize: "13px", color: "#cbd5e1", margin: 0, lineHeight: 1.55 }}>
                          {racioParseado[key]}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={st.expertText}>{q.raciocinio}</p>
                )}
              </div>
            )}

            {/* ─── 💊 CONDUTA ATUALIZADA ─── */}
            {q.tto && (
              <div style={{ ...st.expertBox, borderTop: "3px solid #10b981" }}>
                <div style={{ ...st.expertLabel, justifyContent: "space-between", marginBottom: "14px" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                    <FaFlask size={11} color="#10b981" /> 🩺 CONDUTA ATUALIZADA
                  </span>
                  {q.fonte_diretriz && (
                    <span style={{
                      display: "flex", alignItems: "center", gap: "4px",
                      fontSize: "9px", color: "#10b981", fontWeight: "700",
                      background: "rgba(16,185,129,0.08)", padding: "2px 8px",
                      borderRadius: "5px", border: "1px solid rgba(16,185,129,0.2)",
                      whiteSpace: "nowrap"
                    }}>
                      <FaShieldAlt size={8} /> {q.fonte_diretriz}{q.ano_diretriz ? ` · ${q.ano_diretriz}` : ""}
                    </span>
                  )}
                </div>
                {ttoParseado ? (
                  <div className="tto-grid">
                    {ttoParseado.map((passo, i) => (
                      <div key={i} style={{
                        background: "#020617", borderRadius: "12px",
                        border: `1px solid ${passo.cor}28`, overflow: "hidden",
                      }}>
                        <div style={{
                          padding: "8px 14px", background: `${passo.cor}12`,
                          borderBottom: `1px solid ${passo.cor}20`,
                          display: "flex", alignItems: "center", gap: "8px",
                        }}>
                          <span style={{ fontSize: "11px" }}>{passo.emoji}</span>
                          <span style={{ color: passo.cor, fontSize: "10px", fontWeight: "900", letterSpacing: "0.5px" }}>
                            PASSO {passo.numero} — {passo.titulo}
                          </span>
                        </div>
                        <div style={{ padding: "10px 14px" }}>
                          {renderLinhasTTO(passo.conteudo, passo.cor)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={st.expertText}>{q.tto}</p>
                )}
              </div>
            )}

            {/* ─── 🎯 DICA MESTRE PREMIUM ─── */}
            {q.dicaMestre && (
              <div style={st.dicaMestreBox}>
                <div style={st.dicaMestreLabel}>
                  <FaLightbulb size={12} color="#fbbf24" /> 🎯 DICA MESTRE
                </div>
                {dicaMestreParseada?.formato === "premium" ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>

                    {/* ⚡ FRASE QUE APROVA — largura total */}
                    <div style={{
                      background: "linear-gradient(135deg, rgba(251,191,36,0.18) 0%, rgba(251,191,36,0.07) 100%)",
                      border: "1px solid rgba(251,191,36,0.45)", borderRadius: "12px",
                      padding: "16px 20px", textAlign: "center",
                    }}>
                      <div style={{ fontSize: "9px", color: "#fbbf24", fontWeight: "900", letterSpacing: "2px", marginBottom: "10px" }}>
                        ⚡ A FRASE QUE VOCÊ VAI LEMBRAR NA PROVA
                      </div>
                      <p style={{ color: "#fef9c3", fontSize: "16px", fontWeight: "900", margin: 0, lineHeight: 1.6, fontStyle: "italic", whiteSpace: "pre-line" }}>
                        {dicaMestreParseada.frase}
                      </p>
                    </div>

                    {/* 🔑 O SINAL QUE MUDA TUDO — largura total */}
                    <div style={{
                      background: "linear-gradient(135deg, rgba(99,102,241,0.16) 0%, rgba(139,92,246,0.08) 100%)",
                      border: "1px solid rgba(99,102,241,0.40)", borderRadius: "12px",
                      padding: "16px 20px",
                    }}>
                      <div style={{ fontSize: "9px", color: "#a5b4fc", fontWeight: "900", letterSpacing: "2px", marginBottom: "10px" }}>
                        🔑 O SINAL QUE MUDA TUDO
                      </div>
                      <p style={{ color: "#e0e7ff", fontSize: "14px", fontWeight: "700", margin: 0, lineHeight: 1.7, whiteSpace: "pre-line" }}>
                        {dicaMestreParseada.pivot}
                      </p>
                    </div>

                    {/* 🧠 + ⚠️ — 2 colunas desktop / 1 coluna mobile */}
                    <div className="dica-cols" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>

                      <div style={{
                        background: "linear-gradient(160deg, rgba(16,185,129,0.13) 0%, rgba(6,182,212,0.07) 100%)",
                        border: "1px solid rgba(16,185,129,0.35)", borderRadius: "12px",
                        padding: "14px 16px", display: "flex", flexDirection: "column", gap: "8px",
                      }}>
                        <div style={{ fontSize: "9px", color: "#34d399", fontWeight: "900", letterSpacing: "1.5px" }}>
                          🧠 O CAMINHO CERTO
                        </div>
                        <p style={{ color: "#d1fae5", fontSize: "13px", fontWeight: "600", margin: 0, lineHeight: 1.7, whiteSpace: "pre-line" }}>
                          {dicaMestreParseada.caminhoCorreto}
                        </p>
                      </div>

                      <div style={{
                        background: "linear-gradient(160deg, rgba(245,158,11,0.13) 0%, rgba(239,68,68,0.07) 100%)",
                        border: "1px solid rgba(245,158,11,0.35)", borderRadius: "12px",
                        padding: "14px 16px", display: "flex", flexDirection: "column", gap: "8px",
                      }}>
                        <div style={{ fontSize: "9px", color: "#fbbf24", fontWeight: "900", letterSpacing: "1.5px" }}>
                          ⚠️ POR QUE ERRAM
                        </div>
                        <p style={{ color: "#fef3c7", fontSize: "13px", fontWeight: "600", margin: 0, lineHeight: 1.7, whiteSpace: "pre-line" }}>
                          {dicaMestreParseada.porQueErram}
                        </p>
                      </div>
                    </div>
                  </div>

                ) : dicaMestreParseada?.formato === "legacy" ? (
                  <div>
                    {dicaMestreParseada.mnemonic && (
                      <div style={{
                        background: "linear-gradient(135deg, rgba(251,191,36,0.15) 0%, rgba(251,191,36,0.06) 100%)",
                        border: "1px solid rgba(251,191,36,0.40)", borderRadius: "12px",
                        padding: "16px 20px", textAlign: "center", marginBottom: "12px",
                      }}>
                        <div style={{ fontSize: "9px", color: "#fbbf24", fontWeight: "900", letterSpacing: "2px", marginBottom: "8px" }}>💡 MNEMÔNICO</div>
                        <p style={{ color: "#fef9c3", fontSize: "15px", fontWeight: "900", margin: 0, lineHeight: 1.6, fontStyle: "italic", whiteSpace: "pre-line" }}>
                          {dicaMestreParseada.mnemonic}
                        </p>
                      </div>
                    )}
                    <div className="dica-cols" style={{ gridTemplateColumns: dicaMestreParseada.erro ? undefined : "repeat(2, 1fr)" }}>
                      <div style={{
                        background: "linear-gradient(160deg, rgba(99,102,241,0.14) 0%, rgba(139,92,246,0.08) 100%)",
                        border: "1px solid rgba(99,102,241,0.35)", borderRadius: "12px",
                        padding: "14px 16px", display: "flex", flexDirection: "column", gap: "8px",
                      }}>
                        <div style={{ fontSize: "10px", color: "#a5b4fc", fontWeight: "900", letterSpacing: "0.5px" }}>🧠 COMO O ESPECIALISTA PENSA</div>
                        <p style={{ color: "#e0e7ff", fontSize: "13px", fontWeight: "600", margin: 0, lineHeight: 1.7, whiteSpace: "pre-line" }}>{dicaMestreParseada.gatilho}</p>
                      </div>
                      <div style={{
                        background: "linear-gradient(160deg, rgba(16,185,129,0.14) 0%, rgba(6,182,212,0.07) 100%)",
                        border: "1px solid rgba(16,185,129,0.35)", borderRadius: "12px",
                        padding: "14px 16px", display: "flex", flexDirection: "column", gap: "8px",
                      }}>
                        <div style={{ fontSize: "10px", color: "#34d399", fontWeight: "900", letterSpacing: "0.5px" }}>🎯 O QUE O INEP QUER DE VOCÊ</div>
                        <p style={{ color: "#d1fae5", fontSize: "13px", fontWeight: "600", margin: 0, lineHeight: 1.7, whiteSpace: "pre-line" }}>{dicaMestreParseada.resposta}</p>
                      </div>
                      {dicaMestreParseada.erro && (
                        <div style={{
                          background: "linear-gradient(160deg, rgba(239,68,68,0.13) 0%, rgba(185,28,28,0.07) 100%)",
                          border: "1px solid rgba(239,68,68,0.35)", borderRadius: "12px",
                          padding: "14px 16px", display: "flex", flexDirection: "column", gap: "8px",
                        }}>
                          <div style={{ fontSize: "10px", color: "#f87171", fontWeight: "900", letterSpacing: "0.5px" }}>🚫 O ERRO QUE ELIMINA CANDIDATOS</div>
                          <p style={{ color: "#fee2e2", fontSize: "13px", fontWeight: "600", margin: 0, lineHeight: 1.7, whiteSpace: "pre-line" }}>{dicaMestreParseada.erro}</p>
                        </div>
                      )}
                    </div>
                  </div>

                ) : (
                  <p style={st.dicaMestreText}>{q.dicaMestre}</p>
                )}
              </div>
            )}

            {/* ─── 🔥 ESTRATÉGIA DA APOSTA — exclusivo Super Apostas 2026.2 ───
                 3 mini-cards (mesmo padrão visual do Raciocínio Clínico: fundo
                 #020617 + borderTop de acento + padding) em vez de texto corrido
                 dentro de um único card — só apresentação, conteúdo/parser
                 inalterados. className="dica-cols" reaproveita a mesma classe
                 responsiva já usada pela Dica Mestre legada (3 colunas no
                 desktop, empilhado no mobile via @media já existente). */}
            {q.modulo === "super_apostas" && estrategiaApostaParseada && (
              <div style={st.estrategiaApostaBox}>
                <div style={st.estrategiaApostaLabel}>
                  <FaFire size={10} color="#ef4444" /> ESTRATÉGIA DA APOSTA
                </div>
                <div className="dica-cols">
                  {[
                    { label: "POR QUE APOSTAMOS",   icon: "🎯", texto: estrategiaApostaParseada.porQueApostamos },
                    { label: "COMO PODE CAIR",       icon: "🃏", texto: estrategiaApostaParseada.comoPodeCair },
                    { label: "ARMADILHA PROVÁVEL",   icon: "⚠",  texto: estrategiaApostaParseada.armadilhaProvavel },
                  ].map(({ label, icon, texto }) => (
                    <div key={label} style={{
                      padding: "10px 13px", background: "#020617",
                      borderRadius: "10px", borderTop: "2px solid #ef4444",
                    }}>
                      <div style={{ fontSize: "9px", fontWeight: "900", color: "#fca5a5",
                        marginBottom: "5px", letterSpacing: "0.5px" }}>
                        {icon} {label}
                      </div>
                      <p style={{ fontSize: "12px", color: "#cbd5e1", margin: 0, lineHeight: 1.55 }}>
                        {texto}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── BOTÃO TEORIA — complemento opcional, não substitui nada ─── */}
        {respondida && !modoOficial && (
          <div style={{ padding: "0 0 12px", display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={() => setShowTeoria(true)}
              style={{
                background: "transparent",
                border: "1px solid rgba(129,140,248,0.25)",
                borderRadius: "8px",
                color: "#818cf8",
                fontSize: "11px",
                fontWeight: "700",
                padding: "7px 14px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <FaBookOpen size={10} /> Ver resumo do tema
            </button>
          </div>
        )}

        {/* ─── NAVEGAÇÃO INFERIOR ─── */}
        <div className="bottomNav" style={st.bottomNav}>
          <button
            onClick={irAnterior}
            disabled={indice === 0}
            style={{ ...st.btnNav, opacity: indice === 0 ? 0.3 : 1, background: "#1e293b", border: "1px solid #334155" }}
          >
            <FaArrowLeft size={12} /> ANTERIOR
          </button>

          {/* INDICADOR CENTRAL */}
          <div style={st.navCenter}>
            <span style={{ color: "#64748b", fontSize: "12px" }}>
              {Object.keys(respostasSalvas).length}/{questoes.length} respondidas
            </span>
          </div>

          <button
            onClick={() => indice === questoes.length - 1 ? setMostrarResultados(true) : irProxima()}
            style={{
              ...st.btnNav,
              background: indice === questoes.length - 1 ? "#fbbf24" : "#4f46e5",
              color: indice === questoes.length - 1 ? "#000" : "#fff"
            }}
          >
            {indice === questoes.length - 1 ? <><FaTrophy size={12} /> RESULTADOS</> : <>PRÓXIMA <FaArrowRight size={12} /></>}
          </button>
        </div>
      </div>

      {/* ─── MODAL CORREÇÃO DETALHADA (apenas modoOficial) ─── */}
      {showCorrecaoDetalhada && modoOficial && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9800,
          background: "rgba(2,6,23,0.94)", backdropFilter: "blur(6px)",
          display: "flex", alignItems: "flex-start", justifyContent: "center",
          padding: "20px", overflowY: "auto"
        }}>
          <div style={{
            background: "#0f172a", border: "1px solid #1e293b",
            borderRadius: "20px", width: "100%", maxWidth: "760px",
            boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
            marginTop: "20px", marginBottom: "20px"
          }}>
            {/* Header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "20px 24px", borderBottom: "1px solid #1e293b", position: "sticky",
              top: 0, background: "#0f172a", borderRadius: "20px 20px 0 0", zIndex: 10
            }}>
              <div>
                <p style={{ color: "#f1f5f9", fontWeight: "900", fontSize: "16px", margin: 0 }}>
                  <FaListOl size={14} color="#818cf8" style={{ marginRight: "8px" }} />
                  Correção Detalhada — Simulado Oficial
                </p>
                <p style={{ color: "#475569", fontSize: "11px", margin: "4px 0 0" }}>
                  {acertosTotal} acertos de {Object.keys(respostasSalvas).length} respondidas
                </p>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                {/* Filtros */}
                {["todas", "erradas", "certas"].map(f => (
                  <button
                    key={f}
                    onClick={() => setFiltroCorrecao(f)}
                    style={{
                      padding: "6px 14px", borderRadius: "8px", fontSize: "11px", fontWeight: "700",
                      cursor: "pointer",
                      background: filtroCorrecao === f
                        ? f === "erradas" ? "#ef4444" : f === "certas" ? "#10b981" : "#4f46e5"
                        : "rgba(255,255,255,0.05)",
                      border: filtroCorrecao === f ? "none" : "1px solid #334155",
                      color: filtroCorrecao === f ? "#fff" : "#64748b"
                    }}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
                <button
                  onClick={() => setShowCorrecaoDetalhada(false)}
                  style={{
                    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
                    color: "#ef4444", borderRadius: "8px", padding: "6px 14px",
                    fontSize: "11px", fontWeight: "700", cursor: "pointer", marginLeft: "4px"
                  }}
                >
                  Fechar
                </button>
              </div>
            </div>

            {/* Lista de questões */}
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "20px" }}>
              {questoes.map((qc, i) => {
                const resposta = respostasSalvas[i];
                const gabaritoQ = (qc.gabarito || qc.correta || "").toString().toLowerCase();
                const acertouQ = resposta && resposta.toLowerCase() === gabaritoQ;

                // Filtragem
                if (filtroCorrecao === "erradas" && acertouQ) return null;
                if (filtroCorrecao === "certas" && !acertouQ) return null;

                return (
                  <div key={i} style={{
                    background: "#070f1e",
                    border: `1px solid ${acertouQ ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
                    borderRadius: "14px", padding: "18px 20px",
                    borderTop: `3px solid ${acertouQ ? "#10b981" : "#ef4444"}`
                  }}>
                    {/* Número + status */}
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                      <span style={{
                        background: acertouQ ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
                        color: acertouQ ? "#10b981" : "#ef4444",
                        fontWeight: "900", fontSize: "11px", padding: "4px 10px", borderRadius: "6px"
                      }}>
                        {acertouQ ? "✓ ACERTO" : "✗ ERRO"} — Q{i + 1}
                      </span>
                      <span style={{ fontSize: "11px", color: "#475569" }}>{qc.materia}</span>
                      {qc.subtema && <span style={{ fontSize: "11px", color: "#334155" }}>· {qc.subtema}</span>}
                    </div>

                    {/* Enunciado resumido */}
                    <p style={{ color: "#94a3b8", fontSize: "13px", lineHeight: 1.55, marginBottom: "14px" }}>
                      {qc.enunciado?.length > 220 ? qc.enunciado.slice(0, 220) + "…" : qc.enunciado}
                    </p>

                    {/* Tabela de dados na correção */}
                    {renderTabelaDados(qc.tabelaDados, qc.descricaoTabela)}

                    {/* VISUAL na correção — gráfico / partograma / imagem clínica */}
                    {qc.imagemTipo === "grafico" && qc.graficoDados
                      ? renderGrafico(qc.graficoDados, qc.imagemLegenda)
                      : qc.imagemTipo === "partograma" && (qc.imagemUrl || qc.imagemStoragePath)
                      ? renderPartograma(qc.imagemUrl, qc.imagemStoragePath, qc.imagemLegenda, setLightboxUrl)
                      : (qc.imagemUrl || qc.imagemStoragePath)
                      ? (
                        <div style={{ ...st.imgBox, marginBottom: "14px" }}>
                          <StorageImage
                            storagePath={qc.imagemStoragePath}
                            directUrl={qc.imagemUrl}
                            alt={qc.imagemLegenda || "Imagem da questão"}
                            style={{ ...st.imagem, cursor: "zoom-in" }}
                            onClick={(src) => setLightboxUrl(src)}
                          />
                          {qc.imagemLegenda && (
                            <p style={{ margin: "8px 0 0", fontSize: "11px", color: "#64748b", fontStyle: "italic", textAlign: "center" }}>
                              {qc.imagemLegenda}
                            </p>
                          )}
                        </div>
                      ) : null
                    }

                    {/* Resposta do aluno + gabarito */}
                    <div style={{ display: "flex", gap: "10px", marginBottom: "14px", flexWrap: "wrap" }}>
                      <div style={{
                        padding: "6px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: "800",
                        background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#fca5a5"
                      }}>
                        Sua resposta: {resposta ? resposta.toUpperCase() : "—"}
                      </div>
                      <div style={{
                        padding: "6px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: "800",
                        background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", color: "#6ee7b7"
                      }}>
                        Gabarito: {gabaritoQ.toUpperCase()}
                      </div>
                    </div>

                    {/* Justificativas A-E */}
                    {["a", "b", "c", "d", "e"].map(letra => {
                      const just = qc[`justificativa${letra.toUpperCase()}`];
                      if (!just) return null;
                      const isGab = gabaritoQ === letra;
                      return (
                        <div key={letra} style={{
                          display: "flex", gap: "10px", alignItems: "flex-start",
                          padding: "8px 12px", borderRadius: "8px", marginBottom: "6px",
                          background: isGab ? "rgba(16,185,129,0.05)" : "rgba(0,0,0,0.15)",
                          border: `1px solid ${isGab ? "rgba(16,185,129,0.2)" : "rgba(51,65,85,0.5)"}`
                        }}>
                          <span style={{
                            fontWeight: "900", fontSize: "11px", minWidth: "20px", textAlign: "center",
                            color: isGab ? "#10b981" : "#475569"
                          }}>{letra.toUpperCase()}</span>
                          <span style={{ fontSize: "12px", color: isGab ? "#a7f3d0" : "#64748b", lineHeight: 1.5 }}>
                            {just}
                          </span>
                        </div>
                      );
                    })}

                    {/* Blocos do professor */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px" }}>
                      {qc.raciocinio && (
                        <div style={{
                          padding: "10px 14px", borderRadius: "10px",
                          background: "rgba(79,70,229,0.06)", border: "1px solid rgba(79,70,229,0.15)",
                          borderLeft: "3px solid #4f46e5"
                        }}>
                          <p style={{ fontSize: "10px", color: "#818cf8", fontWeight: "800", marginBottom: "4px" }}>
                            <FaStethoscope size={9} style={{ marginRight: "5px" }} /> RACIOCÍNIO CLÍNICO
                          </p>
                          <p style={{ fontSize: "12px", color: "#94a3b8", lineHeight: 1.55, margin: 0 }}>{qc.raciocinio}</p>
                        </div>
                      )}
                      {qc.tto && (
                        <div style={{
                          padding: "10px 14px", borderRadius: "10px",
                          background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.15)",
                          borderLeft: "3px solid #10b981"
                        }}>
                          <p style={{ fontSize: "10px", color: "#10b981", fontWeight: "800", marginBottom: "4px" }}>
                            <FaFlask size={9} style={{ marginRight: "5px" }} /> CONDUTA
                          </p>
                          <p style={{ fontSize: "12px", color: "#94a3b8", lineHeight: 1.55, margin: 0 }}>{qc.tto}</p>
                        </div>
                      )}
                      {qc.dicaMestre && (
                        <div style={{
                          padding: "10px 14px", borderRadius: "10px",
                          background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.15)",
                          borderLeft: "3px solid #fbbf24"
                        }}>
                          <p style={{ fontSize: "10px", color: "#fbbf24", fontWeight: "800", marginBottom: "4px" }}>
                            <FaLightbulb size={9} style={{ marginRight: "5px" }} /> DICA DO MESTRE
                          </p>
                          <p style={{ fontSize: "12px", color: "#94a3b8", lineHeight: 1.55, margin: 0 }}>{qc.dicaMestre}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div style={{ padding: "16px 24px", borderTop: "1px solid #1e293b", display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowCorrecaoDetalhada(false)}
                style={{
                  padding: "12px 28px", borderRadius: "12px",
                  background: "linear-gradient(135deg, #4f46e5, #6d28d9)",
                  border: "none", color: "#fff", fontWeight: "800", fontSize: "13px", cursor: "pointer"
                }}
              >
                Fechar correção
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE TEORIA — complemento opcional por tema_mestre */}
      {showTeoria && q && (
        <TeoriaModal
          tema_mestre={q.tema_mestre}
          subcontexto_clinico={q.subcontexto_clinico || classificarPorRegras(q)}
          materia={q.materia}
          subtema={q.subtema}
          resumoTema={q.resumoTema}
          onClose={() => setShowTeoria(false)}
        />
      )}

      {/* ─── LIGHTBOX DE IMAGEM ─── */}
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

      {/* MODAL DE DÚVIDA */}
      {showDuvidaModal && (
        <div style={st.modalOverlay}>
          <div style={st.modalContent}>
            <h3 style={{ color: "#fff", marginBottom: "16px", fontSize: "16px" }}>
              <FaQuestionCircle color="#fbbf24" /> Dúvida sobre a Questão
            </h3>
            <p style={{ color: "#64748b", fontSize: "12px", marginBottom: "12px" }}>
              Matéria: <strong style={{ color: "#818cf8" }}>{q.materia}</strong>
            </p>
            <textarea
              value={textoDuvida}
              onChange={e => setTextoDuvida(e.target.value)}
              style={st.modalTextArea}
              placeholder="Qual sua dúvida, Doutor? Seja específico..."
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
              <button onClick={() => setShowDuvidaModal(false)} style={st.btnCancel}>CANCELAR</button>
              <button onClick={handleEnviarDuvida} style={st.btnConfirm} disabled={enviandoDuvida}>
                {enviandoDuvida ? "ENVIANDO..." : "ENVIAR DÚVIDA"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        * { box-sizing: border-box; }
        html, body { overflow-x: hidden !important; max-width: 100vw !important; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
        .spinner { width:32px;height:32px;border:3px solid rgba(129,140,248,0.2);border-radius:50%;border-top-color:#818cf8;animation:spin 0.8s linear infinite; }
        .sim-wrapper { width:100%; max-width:100vw; overflow-x:hidden; }
        .enunciado { word-break:break-word; overflow-wrap:break-word; line-height:1.6; hyphens:auto; }

        .tto-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
        .dica-cols { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }

        @media (max-width: 768px) {
          .sim-wrapper { padding: 10px !important; }
          .top-container { padding: 12px !important; margin-bottom: 12px !important; border-radius: 16px !important; }
          .action-row { flex-direction: column !important; gap: 10px !important; }
          .pagination-bar { flex-wrap: wrap !important; }
          .pagination-bar > div { flex-wrap: wrap !important; justify-content: center !important; gap: 6px !important; margin: 8px 0 !important; }
          .dot { flex-shrink: 0 !important; }
          .sim-card { padding: 16px 12px !important; border-radius: 16px !important; }
          .meta-data { flex-direction: column !important; align-items: flex-start !important; gap: 10px !important; }
          .enunciado { font-size: 15px !important; }
          .expert-row { grid-template-columns: 1fr !important; }
          .tto-grid { grid-template-columns: 1fr !important; }
          .dica-cols { grid-template-columns: 1fr !important; }
          .bottomNav { gap: 8px !important; }
          .btn-nav { padding: 13px 10px !important; font-size: 12px !important; }
        }
      `}</style>
    </div>
  );
};

const st = {
  container: { minHeight: "100vh", padding: "16px", boxSizing: "border-box", transition: "background 0.3s", maxWidth: "100vw", overflowX: "hidden" },
  topContainer: { maxWidth: "1100px", margin: "0 auto 16px", padding: "16px", borderRadius: "20px", border: "1px solid #334155", display: "flex", flexDirection: "column", gap: "14px", width: "100%", boxSizing: "border-box" },
  actionRow: { display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", gap: "10px", flexWrap: "wrap" },
  btnSair: { border: "1px solid #ef4444", background: "rgba(239,68,68,0.1)", color: "#ef4444", padding: "9px 14px", borderRadius: "10px", cursor: "pointer", fontWeight: "700", fontSize: "11px", display: "flex", alignItems: "center", gap: "6px" },
  progressoCenter: { flex: 1, display: "flex", alignItems: "center", gap: "10px", justifyContent: "center", maxWidth: "400px", margin: "0 auto" },
  progressoNum: { color: "#fff", fontSize: "12px", fontWeight: "700", minWidth: "50px", textAlign: "center" },
  progressoBar: { flex: 1, height: "6px", background: "#334155", borderRadius: "100px", overflow: "hidden" },
  progressoFill: { height: "100%", background: "linear-gradient(90deg,#4f46e5,#818cf8)", borderRadius: "100px", transition: "width 0.5s ease" },
  btnGravar: { background: "#10b981", border: "none", color: "#fff", padding: "9px 16px", borderRadius: "10px", cursor: "pointer", fontWeight: "700", fontSize: "11px", display: "flex", alignItems: "center", gap: "6px" },
  btnAction: { border: "none", color: "#fff", padding: "9px 12px", borderRadius: "10px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "0.2s" },
  paginationBar: { display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", width: "100%" },
  dotsWrapper: { display: "flex", gap: "5px", justifyContent: "center", flexWrap: "wrap" },
  arrowBtn: { background: "rgba(255,255,255,0.05)", border: "1px solid #334155", color: "#fff", width: "30px", height: "30px", borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  dot: { width: "30px", height: "30px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: "bold", cursor: "pointer", flexShrink: 0, transition: "all 0.15s" },
  card: { padding: "24px", borderRadius: "24px", border: "1px solid", transition: "0.3s", maxWidth: "1100px", margin: "0 auto", boxSizing: "border-box", width: "100%" },
  metaData: { display: "flex", justifyContent: "space-between", marginBottom: "20px", alignItems: "center", flexWrap: "wrap", gap: "10px" },
  numBadge: { background: "#4f46e5", color: "#fff", padding: "5px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: "800" },
  badge: { background: "rgba(79,70,229,0.12)", color: "#818cf8", padding: "5px 12px", borderRadius: "8px", fontSize: "11px", fontWeight: "700" },
  badgeSub: { background: "rgba(251,191,36,0.1)", color: "#fbbf24", padding: "5px 12px", borderRadius: "8px", fontSize: "11px", fontWeight: "700" },
  btnHelp: { background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)", color: "#fbbf24", padding: "6px 12px", borderRadius: "8px", fontSize: "11px", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px", fontWeight: "700" },
  timer: { fontSize: "13px", display: "flex", alignItems: "center", gap: "6px", fontWeight: "800", padding: "6px 12px", borderRadius: "10px", transition: "0.3s" },
  enunciadoWrapper: { marginBottom: "24px" },
  enunciado: { fontSize: "17px", color: "#f8fafc", lineHeight: 1.7, fontWeight: "500" },
  imgBox: { marginBottom: "24px", textAlign: "center", background: "#000", padding: "16px", borderRadius: "16px" },
  imagem: { maxWidth: "100%", maxHeight: "380px", borderRadius: "10px", objectFit: "contain" },
  optionsGrid: { display: "flex", flexDirection: "column", gap: "10px", marginBottom: "8px" },
  optionBtn: { width: "100%", textAlign: "left", padding: "16px 18px", borderRadius: "14px", border: "1.5px solid", background: "transparent", color: "#fff", transition: "all 0.2s" },
  altHeader: { display: "flex", alignItems: "flex-start", gap: "14px" },
  letraIcon: { minWidth: "32px", height: "32px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "800", fontSize: "13px", flexShrink: 0, transition: "all 0.2s" },
  notaInLine: { marginTop: "12px", padding: "12px 14px", background: "rgba(0,0,0,0.25)", borderRadius: "10px", fontSize: "13px", color: "#cbd5e1", borderLeft: "3px solid #334155", lineHeight: 1.5 },
  professorPanel: { marginTop: "24px", display: "flex", flexDirection: "column", gap: "12px" },
  statusBanner: { display: "flex", alignItems: "center", gap: "10px", padding: "12px 16px", borderRadius: "12px", border: "1px solid", fontSize: "14px" },
  expertRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px" },
  expertBox: { padding: "14px", borderRadius: "14px", background: "#0f172a" },
  expertLabel: { fontSize: "10px", fontWeight: "800", color: "#fff", marginBottom: "8px", display: "flex", alignItems: "center", gap: "5px", letterSpacing: "0.5px", textTransform: "uppercase" },
  expertText: { fontSize: "13px", color: "#f1f5f9", margin: 0, lineHeight: 1.6 },
  racioBox: { background: "#0f172a", padding: "14px", borderRadius: "14px", borderTop: "3px solid #4f46e5" },
  racioHeader: { fontSize: "10px", fontWeight: "900", color: "#818cf8", display: "flex", alignItems: "center", gap: "6px", marginBottom: "12px", letterSpacing: "0.5px", textTransform: "uppercase" },
  racioGrid: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px" },
  dicaMestreBox: { background: "linear-gradient(135deg, rgba(251,191,36,0.07) 0%, rgba(251,191,36,0.02) 100%)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: "14px", padding: "16px 18px" },
  dicaMestreLabel: { fontSize: "11px", fontWeight: "900", color: "#fbbf24", display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px", letterSpacing: "0.5px" },
  dicaMestreText: { fontSize: "15px", color: "#fef3c7", margin: 0, lineHeight: 1.65, fontStyle: "italic", fontWeight: "500" },
  // Estratégia da Aposta — bloco pequeno e discreto, exclusivo Super Apostas 2026.2
  // (itens internos viraram 3 mini-cards com estilo inline, mesmo padrão do
  // Raciocínio Clínico — ver JSX; só o container/label externos usam este objeto)
  estrategiaApostaBox: { background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.18)", borderRadius: "12px", padding: "12px 14px" },
  estrategiaApostaLabel: { fontSize: "10px", fontWeight: "900", color: "#ef4444", display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px", letterSpacing: "0.5px" },
  bottomNav: { marginTop: "28px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #334155", paddingTop: "18px", gap: "10px" },
  navCenter: { flex: 1, textAlign: "center" },
  btnNav: { color: "#fff", border: "none", padding: "12px 20px", borderRadius: "12px", fontWeight: "700", fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", transition: "0.2s", whiteSpace: "nowrap" },
  centro: { height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#020617", color: "#fff" },
  resumoOverlay: { position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(2,6,23,0.97)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 11000, padding: "20px" },
  resumoCard: { background: "#0f172a", border: "1px solid #334155", borderRadius: "24px", padding: "28px", maxWidth: "520px", width: "100%", maxHeight: "90vh", overflowY: "auto" },
  scoreBox: { display: "flex", gap: "12px", justifyContent: "center", marginBottom: "16px" },
  scoreItem: { background: "#1e293b", padding: "14px 20px", borderRadius: "14px", minWidth: "90px", textAlign: "center", border: "1px solid" },
  materiaRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "#1e293b", borderRadius: "10px", gap: "10px", flexWrap: "wrap" },
  btnReview: { background: "#4f46e5", color: "#fff", border: "none", padding: "5px 10px", borderRadius: "6px", fontSize: "10px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", whiteSpace: "nowrap" },
  gradeResultados: { display: "flex", flexWrap: "wrap", gap: "5px", justifyContent: "center", marginTop: "12px" },
  dotResumo: { width: "26px", height: "26px", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", color: "#fff", cursor: "pointer", fontWeight: "700" },
  modalOverlay: { position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 12000, padding: "20px" },
  modalContent: { background: "#1e293b", padding: "24px", borderRadius: "20px", width: "100%", maxWidth: "420px" },
  modalTextArea: { width: "100%", height: "120px", background: "#0f172a", color: "#fff", borderRadius: "12px", padding: "14px", border: "1px solid #334155", resize: "vertical", fontSize: "14px", fontFamily: "inherit", outline: "none", lineHeight: 1.5, boxSizing: "border-box" },
  btnCancel: { background: "none", border: "1px solid #334155", color: "#94a3b8", cursor: "pointer", padding: "10px 16px", borderRadius: "10px", fontWeight: "700", fontSize: "13px" },
  btnConfirm: { background: "#4f46e5", color: "#fff", border: "none", padding: "10px 20px", borderRadius: "10px", cursor: "pointer", fontWeight: "700", fontSize: "13px" }
};

export default Simulador;
