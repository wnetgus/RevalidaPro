import React, { useState, useEffect, useRef } from "react";

const STORAGE_KEY = "rp_comparativo_2026_v1";

const MATERIAS = [
  { nome: "Clínica Médica",         emoji: "🫀", q: 35, cobertas: 33 },
  { nome: "Gin. e Obstetrícia",     emoji: "🤰", q: 21, cobertas: 19 },
  { nome: "Pediatria",              emoji: "👶", q: 17, cobertas: 15 },
  { nome: "Cirurgia Geral",         emoji: "🔪", q: 14, cobertas: 13 },
  { nome: "Saúde Coletiva / MFC",   emoji: "🏥", q: 13, cobertas: 9  },
];

const NAO_COBERTOS = [
  "TDAH / Parassônias infantis",
  "Enurese noturna",
  "Pavor noturno pediátrico",
  "Leucemia infantil aguda",
  "Doença de Legg-Calvé-Perthes",
];

function useAnimatedCounter(target, duration = 1800, start = false) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime = null;
    const step = (ts) => {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [start, target, duration]);
  return value;
}

export default function ModalComparativo2026({ onClose }) {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [startCount, setStartCount] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const counter = useAnimatedCounter(89, 1600, startCount);
  const timerRef = useRef(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setMounted(true);
      setTimeout(() => {
        setVisible(true);
        setTimeout(() => setStartCount(true), 400);
      }, 50);
    }, 800);
    return () => clearTimeout(timerRef.current);
  }, []);

  const fechar = () => {
    setVisible(false);
    setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, "1");
      onClose?.();
    }, 320);
  };

  if (!mounted) return null;

  return (
    <div
      onClick={fechar}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px",
        background: "rgba(2,6,23,0.88)",
        backdropFilter: "blur(6px)",
        transition: "opacity 0.32s ease",
        opacity: visible ? 1 : 0,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "540px",
          maxHeight: "90vh",
          overflowY: "auto",
          borderRadius: "20px",
          background: "linear-gradient(145deg, #0f172a 0%, #1a1040 50%, #0f172a 100%)",
          border: "1px solid rgba(250,190,10,0.35)",
          boxShadow: "0 0 60px rgba(168,85,247,0.25), 0 0 100px rgba(250,190,10,0.08), 0 25px 50px rgba(0,0,0,0.6)",
          transform: visible ? "scale(1) translateY(0)" : "scale(0.92) translateY(24px)",
          transition: "transform 0.35s cubic-bezier(0.34,1.56,0.64,1)",
          padding: "0 0 28px 0",
          scrollbarWidth: "none",
        }}
      >
        {/* Faixa dourada no topo */}
        <div style={{
          height: "4px",
          background: "linear-gradient(90deg, transparent, #fbbf24 30%, #a855f7 60%, #fbbf24 80%, transparent)",
          borderRadius: "20px 20px 0 0",
        }} />

        {/* Botão fechar */}
        <button
          onClick={fechar}
          style={{
            position: "absolute", top: "16px", right: "16px",
            width: "32px", height: "32px", borderRadius: "50%",
            background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)",
            color: "#94a3b8", fontSize: "16px", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.2s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.15)"; e.currentTarget.style.color = "#f8fafc"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.color = "#94a3b8"; }}
        >✕</button>

        <div style={{ padding: "28px 28px 0" }}>

          {/* Badge */}
          <div style={{ textAlign: "center", marginBottom: "20px" }}>
            <span style={{
              display: "inline-block",
              background: "linear-gradient(135deg, rgba(251,191,36,0.15), rgba(168,85,247,0.15))",
              border: "1px solid rgba(251,191,36,0.4)",
              borderRadius: "100px",
              padding: "5px 16px",
              fontSize: "10px",
              fontWeight: "800",
              letterSpacing: "1.5px",
              color: "#fbbf24",
              textTransform: "uppercase",
            }}>
              🏆 Resultado Oficial · INEP Revalida 2026.1
            </span>
          </div>

          {/* Título */}
          <h2 style={{
            textAlign: "center",
            fontSize: "clamp(18px,4vw,24px)",
            fontWeight: "900",
            color: "#f8fafc",
            lineHeight: 1.2,
            marginBottom: "24px",
          }}>
            As Super Apostas<br />
            <span style={{ color: "#fbbf24" }}>previram a prova</span> do INEP
          </h2>

          {/* Número principal */}
          <div style={{
            textAlign: "center",
            margin: "0 auto 8px",
            position: "relative",
          }}>
            <div style={{
              display: "inline-flex",
              alignItems: "flex-end",
              justifyContent: "center",
              gap: "4px",
            }}>
              <span style={{
                fontSize: "clamp(72px,16vw,108px)",
                fontWeight: "900",
                lineHeight: 1,
                background: "linear-gradient(135deg, #fbbf24, #f59e0b, #fde68a)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                filter: "drop-shadow(0 0 20px rgba(251,191,36,0.4))",
              }}>
                {counter}
              </span>
              <span style={{
                fontSize: "clamp(28px,6vw,40px)",
                fontWeight: "900",
                color: "#fbbf24",
                paddingBottom: "10px",
                opacity: startCount ? 1 : 0,
                transition: "opacity 0.5s",
              }}>%</span>
            </div>

            {/* Barra de progresso */}
            <div style={{
              width: "100%", height: "6px",
              background: "rgba(255,255,255,0.08)",
              borderRadius: "10px",
              overflow: "hidden",
              margin: "8px 0 12px",
            }}>
              <div style={{
                height: "100%",
                borderRadius: "10px",
                background: "linear-gradient(90deg, #a855f7, #fbbf24)",
                width: startCount ? "89%" : "0%",
                transition: "width 1.8s cubic-bezier(0.4,0,0.2,1)",
                boxShadow: "0 0 12px rgba(251,191,36,0.5)",
              }} />
            </div>

            <p style={{
              fontSize: "clamp(13px,3vw,16px)",
              color: "#cbd5e1",
              margin: "0 0 6px",
              fontWeight: "600",
            }}>
              das questões do INEP 2026.1 tinham tema<br />
              <strong style={{ color: "#f8fafc" }}>nas Super Apostas RevalidaPRO</strong>
            </p>
            <p style={{ fontSize: "12px", color: "#64748b" }}>
              89 de 100 questões · análise completa da prova oficial
            </p>
          </div>

          {/* Divisor */}
          <div style={{ height: "1px", background: "rgba(255,255,255,0.07)", margin: "20px 0" }} />

          {/* Grid de matérias */}
          <p style={{ fontSize: "11px", color: "#64748b", fontWeight: "700", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "12px" }}>
            Cobertura por área
          </p>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: "8px",
            marginBottom: "20px",
          }}>
            {MATERIAS.map((m) => {
              const pct = Math.round((m.cobertas / m.q) * 100);
              return (
                <div key={m.nome} style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: "12px",
                  padding: "10px 12px",
                }}>
                  <div style={{ fontSize: "18px", marginBottom: "4px" }}>{m.emoji}</div>
                  <div style={{ fontSize: "10px", color: "#94a3b8", fontWeight: "700", marginBottom: "4px", lineHeight: 1.3 }}>{m.nome}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <div style={{
                      flex: 1, height: "3px",
                      background: "rgba(255,255,255,0.08)",
                      borderRadius: "10px", overflow: "hidden",
                    }}>
                      <div style={{
                        height: "100%",
                        borderRadius: "10px",
                        background: pct >= 90 ? "#10b981" : pct >= 80 ? "#fbbf24" : "#818cf8",
                        width: startCount ? `${pct}%` : "0%",
                        transition: "width 1.8s ease",
                      }} />
                    </div>
                    <span style={{ fontSize: "11px", fontWeight: "800", color: "#f8fafc", minWidth: "32px" }}>
                      {pct}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Frase de impacto */}
          <div style={{
            background: "linear-gradient(135deg, rgba(168,85,247,0.12), rgba(79,70,229,0.08))",
            border: "1px solid rgba(168,85,247,0.25)",
            borderRadius: "14px",
            padding: "16px 18px",
            marginBottom: "16px",
            textAlign: "center",
          }}>
            <p style={{ fontSize: "clamp(13px,3vw,15px)", fontWeight: "700", color: "#e2e8f0", lineHeight: 1.5, margin: 0 }}>
              "Quem estudou com o RevalidaPRO chegou<br />
              <span style={{ color: "#a855f7" }}>muito bem preparado para o INEP 2026.1</span>"
            </p>
          </div>

          {/* Transparência — temas não cobertos */}
          <button
            onClick={() => setShowDetails(d => !d)}
            style={{
              width: "100%", background: "none", border: "none",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              cursor: "pointer", padding: "4px 0", marginBottom: "4px",
            }}
          >
            <span style={{ fontSize: "11px", color: "#64748b", fontWeight: "700", textTransform: "uppercase", letterSpacing: "1px" }}>
              Transparência · temas não cobertos ({NAO_COBERTOS.length})
            </span>
            <span style={{ color: "#64748b", fontSize: "14px", transition: "transform 0.2s", transform: showDetails ? "rotate(180deg)" : "rotate(0)" }}>▾</span>
          </button>

          {showDetails && (
            <div style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "10px",
              padding: "12px 14px",
              marginBottom: "16px",
            }}>
              {NAO_COBERTOS.map((t, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  padding: "4px 0",
                  borderBottom: i < NAO_COBERTOS.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                }}>
                  <span style={{ fontSize: "11px", color: "#ef4444" }}>✗</span>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>{t}</span>
                </div>
              ))}
              <p style={{ fontSize: "10px", color: "#475569", margin: "8px 0 0", lineHeight: 1.5 }}>
                Esses 5 temas serão priorizados nas próximas Super Apostas 2026.2.
              </p>
            </div>
          )}
        </div>

        {/* CTA */}
        <div style={{ padding: "0 28px" }}>
          <button
            onClick={fechar}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: "14px",
              border: "none",
              cursor: "pointer",
              fontWeight: "800",
              fontSize: "15px",
              letterSpacing: "0.5px",
              background: "linear-gradient(135deg, #a855f7, #7c3aed)",
              color: "#fff",
              boxShadow: "0 4px 24px rgba(168,85,247,0.35)",
              transition: "all 0.2s",
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(168,85,247,0.45)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 24px rgba(168,85,247,0.35)"; }}
          >
            Quero continuar estudando 🚀
          </button>
          <p style={{ textAlign: "center", fontSize: "11px", color: "#475569", margin: "10px 0 0" }}>
            Continue de onde parou · seu progresso está salvo
          </p>
        </div>
      </div>

      <style>{`
        @keyframes rp-spin { to { transform: rotate(360deg); } }
        @media (max-width: 400px) {
          .rp-modal-inner { padding: 20px 16px 0 !important; }
        }
      `}</style>
    </div>
  );
}
