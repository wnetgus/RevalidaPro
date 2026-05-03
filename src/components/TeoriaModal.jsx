import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { FaBookOpen, FaTimes, FaLightbulb, FaSpinner, FaChevronRight } from "react-icons/fa";

/**
 * TeoriaModal — Resumo teórico por tema_mestre + subcontexto_clinico
 *
 * Props:
 *   tema_mestre         {string}  — campo principal (ex: "Diabetes mellitus tipo 2")
 *   subcontexto_clinico {string}  — contexto clínico (ex: "gestante", "pediátrico")
 *   materia             {string}  — fallback de área
 *   subtema             {string}  — fallback de subtema
 *   onClose             {func}
 *
 * Estratégia de leitura (custo mínimo):
 *   1. getDoc(teorias/{tema_mestre}--{subcontexto_clinico})  — O(1), específico
 *   2. getDoc(teorias/{tema_mestre})                         — O(1), genérico s/ contexto
 *   3. query(subtema == subtema)                             — backward compat
 *   4. query(materia + subtema=_geral)                       — fallback genérico por área
 */

// Sanitiza tema + contexto para docId do Firestore
const toDocId = (tema, contexto) => {
  const base = (tema || "").trim().replace(/[/.#[\]*]/g, "-");
  const ctx  = (contexto || "").trim().replace(/[/.#[\]*]/g, "-");
  return ctx ? `${base}--${ctx}` : base;
};

const COR_CONTEXTO = {
  "adulto":        "#818cf8",
  "gestante":      "#ec4899",
  "pediátrico":    "#10b981",
  "adolescente":   "#34d399",
  "idoso":         "#f59e0b",
  "emergência":    "#ef4444",
  "pós-operatório":"#8b5cf6",
};

// Sanitiza para docId da coleção resumos_temas
const toResDocId = (tema) =>
  (tema || "").trim().replace(/[/.#[\]*]/g, "-");

const TeoriaModal = ({ materia, subtema, tema_mestre, subcontexto_clinico, onClose }) => {
  const [teoria, setTeoria] = useState(null);
  const [resumo, setResumo] = useState(null);  // resumos_temas (schema plano)
  const [carregando, setCarregando] = useState(true);
  const [fonte, setFonte] = useState(null);    // "resumos_temas" | "teorias" | null

  useEffect(() => {
    const buscar = async () => {
      setCarregando(true);
      setResumo(null);
      setTeoria(null);
      setFonte(null);
      try {
        // ── 0ª tentativa: resumos_temas (novo schema plano) — prioridade máxima
        if (tema_mestre) {
          const snap = await getDoc(doc(db, "resumos_temas", toResDocId(tema_mestre)));
          if (snap.exists()) {
            setResumo(snap.data());
            setFonte("resumos_temas");
            setCarregando(false);
            return;
          }
        }

        // ── 1ª tentativa: tema_mestre + contexto via getDoc (O(1)) ──────────
        if (tema_mestre && subcontexto_clinico) {
          const snap = await getDoc(doc(db, "teorias", toDocId(tema_mestre, subcontexto_clinico)));
          if (snap.exists()) {
            setTeoria(snap.data());
            setFonte("teorias");
            setCarregando(false);
            return;
          }
        }

        // ── 2ª tentativa: tema_mestre sem contexto (O(1)) ────────────────────
        if (tema_mestre) {
          const snap = await getDoc(doc(db, "teorias", toDocId(tema_mestre, "")));
          if (snap.exists()) {
            setTeoria(snap.data());
            setFonte("teorias");
            setCarregando(false);
            return;
          }
        }

        // ── 3ª tentativa: subtema query (backward-compat) ─────────────────────
        if (subtema) {
          const q1 = query(collection(db, "teorias"), where("subtema", "==", subtema));
          const s1 = await getDocs(q1);
          if (!s1.empty) {
            setTeoria(s1.docs[0].data());
            setFonte("teorias");
            setCarregando(false);
            return;
          }
        }

        // ── 4ª tentativa: matéria genérica ────────────────────────────────────
        if (materia) {
          const q2 = query(
            collection(db, "teorias"),
            where("materia", "==", materia),
            where("subtema", "==", "_geral")
          );
          const s2 = await getDocs(q2);
          if (!s2.empty) {
            setTeoria(s2.docs[0].data());
            setFonte("teorias");
            setCarregando(false);
            return;
          }
        }

        setTeoria(null);
        setResumo(null);
      } catch {
        setTeoria(null);
        setResumo(null);
      }
      setCarregando(false);
    };
    buscar();
  }, [tema_mestre, subcontexto_clinico, subtema, materia]);

  // Renderiza ponto em formato string OU { label, texto } (novo formato rico)
  const renderPonto = (ponto, i) => {
    const isObj = typeof ponto === "object" && ponto !== null && ponto.label;
    return (
      <li key={i} style={s.liItem}>
        <FaChevronRight size={9} color="#4f46e5" style={{ flexShrink: 0, marginTop: "4px" }} />
        <span>
          {isObj
            ? <><strong style={{ color: "#818cf8", marginRight: "4px" }}>{ponto.label}:</strong>{ponto.texto}</>
            : ponto}
        </span>
      </li>
    );
  };

  const tituloExibido = resumo?.tema_mestre || teoria?.titulo || teoria?.tema_mestre || tema_mestre || subtema || materia;

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        {/* ─── Header ─────────────────────────────────────────── */}
        <div style={s.header}>
          <div style={s.headerLeft}>
            <FaBookOpen size={14} color="#818cf8" />
            <div>
              <p style={s.headerTitle}>Resumo do Tema</p>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                <p style={s.headerSub}>{tituloExibido}</p>
                {subcontexto_clinico && (
                  <span style={{
                    fontSize: "9px", fontWeight: "700", padding: "1px 6px",
                    borderRadius: "4px", textTransform: "uppercase", letterSpacing: "0.5px",
                    background: `${COR_CONTEXTO[subcontexto_clinico] || "#818cf8"}22`,
                    color: COR_CONTEXTO[subcontexto_clinico] || "#818cf8",
                    border: `1px solid ${COR_CONTEXTO[subcontexto_clinico] || "#818cf8"}44`,
                  }}>
                    {subcontexto_clinico}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={s.btnClose} aria-label="Fechar">
            <FaTimes size={14} />
          </button>
        </div>

        {/* ─── Aviso ───────────────────────────────────────────── */}
        <div style={s.avisoBar}>
          <FaLightbulb size={10} color="#fbbf24" />
          <span>Teoria complementar — o raciocínio clínico da questão permanece acima.</span>
        </div>

        {/* ─── Conteúdo ────────────────────────────────────────── */}
        <div style={s.body}>
          {carregando ? (
            <div style={s.loadBox}>
              <FaSpinner style={{ animation: "spin 0.8s linear infinite", fontSize: "20px", color: "#4f46e5" }} />
              <p style={s.loadTxt}>Buscando resumo...</p>
            </div>

          ) : resumo ? (
            /* ── Schema plano (resumos_temas) ─────────────────────── */
            <div>
              {[
                { key: "definicao",   label: "Definição",   color: "#818cf8" },
                { key: "diagnostico", label: "Diagnóstico", color: "#34d399" },
                { key: "tratamento",  label: "Tratamento",  color: "#60a5fa" },
              ].map(({ key, label, color }) => resumo[key] && (
                <div key={key} style={s.secaoResumo}>
                  <span style={{ ...s.secaoLabel, color }}>{label}</span>
                  <p style={s.secaoTexto}>{resumo[key]}</p>
                </div>
              ))}

              {resumo.pontos_chave?.length > 0 && (
                <div style={s.secaoResumo}>
                  <span style={{ ...s.secaoLabel, color: "#f59e0b" }}>Pontos-chave</span>
                  <ul style={s.lista}>
                    {resumo.pontos_chave.map((p, i) => (
                      <li key={i} style={s.liItem}>
                        <FaChevronRight size={9} color="#f59e0b" style={{ flexShrink: 0, marginTop: "4px" }} />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {resumo.pegadinhas?.length > 0 && (
                <div style={s.secaoResumo}>
                  <span style={{ ...s.secaoLabel, color: "#ef4444" }}>⚠ Pegadinhas de prova</span>
                  <ul style={s.lista}>
                    {resumo.pegadinhas.map((p, i) => (
                      <li key={i} style={{ ...s.liItem, borderColor: "rgba(239,68,68,0.15)", background: "rgba(239,68,68,0.04)" }}>
                        <FaChevronRight size={9} color="#ef4444" style={{ flexShrink: 0, marginTop: "4px" }} />
                        <span style={{ color: "#fca5a5" }}>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {resumo.dica_mestre && (
                <div style={s.dicaMestreBox}>
                  <span style={s.dicaMestreLabel}>⭐ Dica do Mestre</span>
                  <p style={s.dicaMestreTexto}>{resumo.dica_mestre}</p>
                </div>
              )}
            </div>

          ) : teoria ? (
            /* ── Schema rico (teorias — pontos array) ─────────────── */
            <>
              {teoria.titulo && <h3 style={s.tituloTeoria}>{teoria.titulo}</h3>}
              <ul style={s.lista}>
                {(teoria.pontos || []).map(renderPonto)}
              </ul>
              {teoria.fonte && <p style={s.fonte}>Fonte: {teoria.fonte}</p>}
            </>

          ) : (
            /* ── Fallback: nenhum resumo encontrado ───────────────── */
            <div style={s.emptyBox}>
              <FaBookOpen size={28} color="#1e293b" />
              <p style={s.emptyTitulo}>Resumo ainda não disponível</p>
              <p style={s.emptyDesc}>
                O resumo de{" "}
                <strong style={{ color: "#818cf8" }}>
                  {tema_mestre || subtema || materia}
                </strong>{" "}
                ainda não foi gerado.
              </p>
              <a
                href="/admin"
                onClick={onClose}
                style={s.btnGerarAgora}
              >
                Gerar resumo agora no AdminPainel
              </a>
            </div>
          )}
        </div>

        <div style={s.footer}>
          <button onClick={onClose} style={s.btnFechar}>
            Fechar e voltar à questão
          </button>
        </div>
      </div>
    </div>
  );
};

const s = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(2,6,23,0.88)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 9000, padding: "20px", backdropFilter: "blur(4px)",
  },
  modal: {
    background: "#0f172a", border: "1px solid #1e293b", borderRadius: "18px",
    width: "100%", maxWidth: "540px", maxHeight: "85vh",
    display: "flex", flexDirection: "column", overflow: "hidden",
    boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
  },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "18px 20px", borderBottom: "1px solid #1e293b", flexShrink: 0,
  },
  headerLeft: { display: "flex", alignItems: "center", gap: "10px" },
  headerTitle: { fontSize: "14px", fontWeight: "800", color: "#f1f5f9", margin: 0 },
  headerSub: { fontSize: "11px", color: "#475569", marginTop: "2px", margin: 0 },
  btnClose: {
    background: "transparent", border: "none", color: "#475569",
    cursor: "pointer", padding: "6px", borderRadius: "6px",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  avisoBar: {
    display: "flex", alignItems: "center", gap: "8px",
    background: "rgba(251,191,36,0.06)", borderBottom: "1px solid rgba(251,191,36,0.12)",
    padding: "8px 20px", fontSize: "10px", color: "#a16207", flexShrink: 0,
  },
  body: { padding: "20px", overflowY: "auto", flex: 1 },
  loadBox: {
    display: "flex", flexDirection: "column", alignItems: "center",
    gap: "12px", padding: "32px 0",
  },
  loadTxt: { color: "#64748b", fontSize: "13px" },
  tituloTeoria: {
    fontSize: "15px", fontWeight: "900", color: "#f1f5f9",
    marginBottom: "16px", letterSpacing: "-0.3px",
  },
  lista: {
    listStyle: "none", padding: 0, margin: 0,
    display: "flex", flexDirection: "column", gap: "8px",
  },
  liItem: {
    display: "flex", alignItems: "flex-start", gap: "10px",
    background: "#070f1e", border: "1px solid #1e293b", borderRadius: "8px",
    padding: "10px 14px", fontSize: "13px", color: "#cbd5e1", lineHeight: 1.55,
  },
  fonte: { marginTop: "16px", fontSize: "10px", color: "#334155", fontStyle: "italic" },
  emptyBox: {
    display: "flex", flexDirection: "column", alignItems: "center",
    gap: "12px", padding: "32px 16px", textAlign: "center",
  },
  emptyTitulo: { fontSize: "14px", fontWeight: "800", color: "#475569", margin: 0 },
  emptyDesc: { fontSize: "12px", color: "#334155", lineHeight: 1.6, margin: 0 },
  btnGerarAgora: {
    marginTop: "8px", background: "rgba(79,70,229,0.12)", border: "1px solid rgba(79,70,229,0.3)",
    color: "#818cf8", borderRadius: "10px", padding: "9px 18px", fontSize: "12px",
    fontWeight: "800", cursor: "pointer", textDecoration: "none", display: "inline-block",
    letterSpacing: "0.3px",
  },
  secaoResumo: { marginBottom: "14px" },
  secaoLabel: {
    fontSize: "10px", fontWeight: "900", letterSpacing: "0.5px",
    textTransform: "uppercase", display: "block", marginBottom: "5px",
  },
  secaoTexto: { fontSize: "13px", color: "#cbd5e1", margin: 0, lineHeight: 1.65 },
  dicaMestreBox: {
    background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)",
    borderRadius: "12px", padding: "12px 16px", marginTop: "6px",
  },
  dicaMestreLabel: {
    fontSize: "10px", fontWeight: "900", color: "#fbbf24",
    letterSpacing: "0.5px", textTransform: "uppercase", display: "block", marginBottom: "5px",
  },
  dicaMestreTexto: { fontSize: "13px", color: "#fef3c7", margin: 0, lineHeight: 1.65, fontStyle: "italic" },
  footer: { padding: "14px 20px", borderTop: "1px solid #1e293b", flexShrink: 0 },
  btnFechar: {
    width: "100%", padding: "11px", background: "transparent",
    border: "1px solid #1e293b", borderRadius: "10px",
    color: "#64748b", fontSize: "13px", fontWeight: "700", cursor: "pointer",
  },
};

export default TeoriaModal;
