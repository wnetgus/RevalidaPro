import React, { useState, useEffect, useMemo } from "react";
import { auth, db } from "../firebase";
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import {
  FaChartBar, FaCheckCircle, FaTimesCircle,
  FaHistory, FaStethoscope, FaArrowLeft, FaMedal, FaInfoCircle, FaBrain, FaTrophy, FaExclamationTriangle,
  FaFireAlt, FaBolt, FaRegStar
} from "react-icons/fa";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from "recharts";

const Desempenho = () => {
  const navigate = useNavigate();
  const [dadosMateria, setDadosMateria] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [statsGerais, setStatsGerais] = useState({ total: 0, acertos: 0, erros: 0 });
  const [historico, setHistorico] = useState([]);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [periodoFiltro, setPeriodoFiltro] = useState("total");
  const [rawEstatisticas, setRawEstatisticas] = useState([]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ✅ LÓGICA ORIGINAL PRESERVADA — agora armazena raw para filtragem por período
  useEffect(() => {
    const carregarDadosProfundos = async () => {
      if (!auth.currentUser) return;
      try {
        const q = query(
          collection(db, "estatisticas"),
          where("usuarioId", "==", auth.currentUser.uid)
        );
        const snap = await getDocs(q);
        const rawList = [];
        snap.forEach(doc => {
          const d = doc.data();
          rawList.push({ materia: d.materia || "Geral", acertou: d.acertou, data: d.data });
        });
        setRawEstatisticas(rawList);

        // Histórico de simulados (estatisticas_lote)
        const qLote = query(
          collection(db, "estatisticas_lote"),
          where("usuarioId", "==", auth.currentUser.uid),
          orderBy("data", "desc"),
          limit(20)
        );
        const snapLote = await getDocs(qLote);
        const sessoesAgrupadas = {};
        snapLote.forEach(d => {
          const dados = d.data();
          const dataStr = dados.data?.toDate ? dados.data.toDate().toISOString() : new Date().toISOString();
          const chave = dataStr.substring(0, 16); // agrupa por minuto (mesma sessão)
          if (!sessoesAgrupadas[chave]) sessoesAgrupadas[chave] = { data: dados.data, materias: [], total: 0, acertos: 0 };
          sessoesAgrupadas[chave].materias.push(dados.materia);
          sessoesAgrupadas[chave].total += dados.total || 0;
          sessoesAgrupadas[chave].acertos += dados.acertos || 0;
        });
        const sessoesList = Object.values(sessoesAgrupadas)
          .sort((a, b) => (b.data?.toDate?.() || 0) - (a.data?.toDate?.() || 0))
          .slice(0, 10);
        setHistorico(sessoesList);

      } catch (e) {
        console.error("Erro ao carregar desempenho:", e);
      } finally {
        setCarregando(false);
      }
    };
    carregarDadosProfundos();
  }, []);

  // ✅ RECOMPUTA dadosMateria e statsGerais sempre que rawEstatisticas ou periodoFiltro mudam
  useEffect(() => {
    const agora = new Date();
    let cutoff = null;
    if (periodoFiltro === "hoje") {
      // Meia-noite em BRT (UTC-3)
      const hojeBRT = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
      cutoff = new Date(`${hojeBRT}T00:00:00-03:00`);
    } else if (periodoFiltro === "7d") {
      cutoff = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (periodoFiltro === "30d") {
      cutoff = new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const filtered = cutoff
      ? rawEstatisticas.filter(r => {
          const ts = r.data?.toDate?.();
          return ts && ts >= cutoff;
        })
      : rawEstatisticas;

    const mapa = {};
    let totalTotal = 0, acertosTotal = 0;
    filtered.forEach(d => {
      const mat = d.materia;
      if (!mapa[mat]) mapa[mat] = { subject: mat, acertos: 0, total: 0 };
      mapa[mat].total += 1;
      totalTotal += 1;
      if (d.acertou) { mapa[mat].acertos += 1; acertosTotal += 1; }
    });

    const formatados = Object.values(mapa).map(m => ({
      ...m,
      percentual: m.total > 0 ? Math.round((m.acertos / m.total) * 100) : 0,
      erros: m.total - m.acertos
    }));
    formatados.sort((a, b) => b.total - a.total);

    setDadosMateria(formatados);
    setStatsGerais({ total: totalTotal, acertos: acertosTotal, erros: totalTotal - acertosTotal });
  }, [rawEstatisticas, periodoFiltro]);

  // ✅ DIAGNÓSTICO AUTOMÁTICO ORIGINAL PRESERVADO
  const diagnostico = useMemo(() => {
    if (dadosMateria.length === 0) return null;
    const materiasValidas = dadosMateria.filter(m => m.total >= 5);
    if (materiasValidas.length === 0) return { tipo: "neutro", msg: "Continue fazendo simulados para gerarmos seu diagnóstico preciso." };
    const melhor = [...materiasValidas].sort((a, b) => b.percentual - a.percentual)[0];
    const pior = [...materiasValidas].sort((a, b) => a.percentual - b.percentual)[0];
    return { melhor, pior };
  }, [dadosMateria]);

  if (carregando) {
    return (
      <div style={st.loadingWrapper}>
        <div className="spinner"></div>
        <p style={{ marginTop: "20px", fontWeight: "900", color: "#818cf8", letterSpacing: "1px", fontSize: "13px" }}>
          GERANDO RAIO-X ACADÊMICO...
        </p>
      </div>
    );
  }

  const aproveitamentoTotal = statsGerais.total > 0
    ? ((statsGerais.acertos / statsGerais.total) * 100).toFixed(1)
    : 0;

  const getCorAproveitamento = (pct) => {
    if (pct >= 70) return "#10b981";
    if (pct >= 50) return "#fbbf24";
    return "#ef4444";
  };

  return (
    <div style={st.container}>
      {/* HEADER */}
      <header style={st.header}>
        <div>
          <h2 style={st.headerTitle}>
            <FaChartBar color="#818cf8" /> Raio-X <span style={{ color: "#4f46e5" }}>Acadêmico</span>
          </h2>
          <p style={st.subtitle}>Análise profunda do seu histórico de treinamento e performance.</p>
        </div>
        <button onClick={() => navigate("/dashboard")} style={st.btnBack}>
          <FaArrowLeft /> VOLTAR AO PAINEL
        </button>
      </header>

      {/* FILTRO POR PERÍODO */}
      <div style={st.periodoStrip}>
        {[
          { key: "total", label: "Todo Período" },
          { key: "hoje",  label: "Hoje" },
          { key: "7d",    label: "7 dias" },
          { key: "30d",   label: "30 dias" },
        ].map(opt => (
          <button
            key={opt.key}
            onClick={() => setPeriodoFiltro(opt.key)}
            style={periodoFiltro === opt.key ? st.periodoAtivo : st.periodoBtn}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* ✅ DIAGNÓSTICO AUTOMÁTICO ORIGINAL */}
      {diagnostico && diagnostico.melhor && (
        <div style={st.insightBox}>
          <div style={st.insightIcon}><FaBrain size={22} color="#818cf8" /></div>
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: "0 0 8px 0", color: "#818cf8", fontSize: "12px", letterSpacing: "1px", textTransform: "uppercase" }}>
              Diagnóstico Automático
            </h4>
            <div style={st.insightTextRow}>
              <span style={{ color: "#10b981", display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap" }}>
                <FaTrophy size={12} /> <strong>Ponto Forte:</strong> {diagnostico.melhor.subject} ({diagnostico.melhor.percentual}%)
              </span>
              {!isMobile && <span style={{ color: "#64748b" }}>|</span>}
              <span style={{ color: "#ef4444", display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap" }}>
                <FaExclamationTriangle size={12} /> <strong>Foco Prioritário:</strong> {diagnostico.pior.subject} ({diagnostico.pior.percentual}%)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* CARDS DE STATS */}
      <div style={{ ...st.gridStats, gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)" }}>
        {[
          { icon: <FaCheckCircle size={26} color="#10b981" />, label: "Acertos Globais", valor: statsGerais.acertos, cor: "#10b981", bg: "rgba(16,185,129,0.1)" },
          { icon: <FaTimesCircle size={26} color="#ef4444" />, label: "Tentativas Incorretas", valor: statsGerais.erros, cor: "#ef4444", bg: "rgba(239,68,68,0.1)" },
          { icon: <FaMedal size={26} color="#fbbf24" />, label: "Aproveitamento Médio", valor: `${aproveitamentoTotal}%`, cor: getCorAproveitamento(Number(aproveitamentoTotal)), bg: "rgba(251,191,36,0.1)" },
        ].map((item, i) => (
          <div key={i} style={{ ...st.statCard, gridColumn: i === 2 && isMobile ? "1 / -1" : "auto" }}>
            <div style={{ ...st.iconGlow, background: item.bg }}>{item.icon}</div>
            <div style={st.statInfo}>
              <span style={st.labelStat}>{item.label}</span>
              <span style={{ ...st.valStat, color: item.cor }}>{item.valor}</span>
            </div>
          </div>
        ))}
      </div>

      {/* GRID PRINCIPAL */}
      <div style={{ ...st.mainGrid, gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(380px, 1fr))" }}>

        {/* GRÁFICO */}
        <div style={st.chartBox}>
          <h3 style={st.chartTitle}><FaChartBar color="#818cf8" /> Performance por Grande Área</h3>
          {dadosMateria.length === 0 ? (
            <div style={st.emptyMsg}>
              <FaStethoscope size={36} style={{ opacity: 0.15, marginBottom: 12, color: "#818cf8" }} />
              <p style={{ color: "#f8fafc", fontSize: "14px", margin: "0 0 4px" }}>Nenhum dado registrado.</p>
              <small style={{ color: "#64748b" }}>Inicie seus simulados para mapear seu conhecimento.</small>
            </div>
          ) : (
            <div style={{ width: "100%" }}>
              <ResponsiveContainer width="100%" height={Math.max(260, dadosMateria.length * 50)}>
                <BarChart data={dadosMateria} layout="vertical" margin={{ left: 8, right: 30, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} hide />
                  <YAxis
                    dataKey="subject"
                    type="category"
                    stroke="#94a3b8"
                    fontSize={isMobile ? 10 : 11}
                    width={isMobile ? 90 : 110}
                    tick={{ fill: "#cbd5e1", fontWeight: "bold" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    contentStyle={{ background: "#0f172a", border: "1px solid #4f46e5", borderRadius: "12px", color: "#fff", fontWeight: "bold", fontSize: "13px" }}
                    formatter={(value) => [`${value}%`, "Aproveitamento"]}
                  />
                  <Bar dataKey="percentual" radius={[0, 8, 8, 0]} barSize={18}>
                    {dadosMateria.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.percentual >= 70 ? "#10b981" : entry.percentual >= 50 ? "#fbbf24" : "#ef4444"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* TABELA */}
        <div style={st.tableContainer}>
          <h3 style={st.chartTitle}><FaHistory color="#818cf8" /> Detalhamento Operacional</h3>
          {dadosMateria.length === 0 ? (
            <div style={st.emptyMsg}>
              <p style={{ color: "#64748b", textAlign: "center", padding: "30px 0" }}>
                Faça simulados para ver seu histórico aqui.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={st.table}>
                <thead>
                  <tr style={st.thRow}>
                    <th style={st.th}>Área</th>
                    <th style={{ ...st.th, textAlign: "center" }}>Total</th>
                    <th style={{ ...st.th, textAlign: "center" }}>Acertos</th>
                    <th style={st.th}>Taxa</th>
                  </tr>
                </thead>
                <tbody>
                  {dadosMateria.map((m, i) => (
                    <tr key={i} style={st.tr}>
                      <td style={st.td}>
                        <strong style={{ color: "#f8fafc", fontSize: "13px" }}>{m.subject}</strong>
                      </td>
                      <td style={{ ...st.td, textAlign: "center", color: "#94a3b8" }}>{m.total}</td>
                      <td style={{ ...st.td, textAlign: "center", color: "#10b981", fontWeight: "bold" }}>{m.acertos}</td>
                      <td style={{ ...st.td, minWidth: "100px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ color: getCorAproveitamento(m.percentual), fontWeight: "900", fontSize: "13px", minWidth: "36px" }}>
                            {m.percentual}%
                          </span>
                          <div style={{ height: "5px", background: "rgba(255,255,255,0.05)", borderRadius: "4px", flex: 1, overflow: "hidden", minWidth: "40px" }}>
                            <div style={{ height: "100%", width: `${m.percentual}%`, background: getCorAproveitamento(m.percentual), borderRadius: "4px", transition: "width 0.8s ease" }} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* HISTÓRICO DE SIMULADOS */}
      {historico.length > 0 && (
        <div style={{ ...st.tableContainer, marginBottom: "24px" }}>
          <h3 style={st.chartTitle}><FaHistory color="#818cf8" /> Últimas Sessões de Estudo</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={st.table}>
              <thead>
                <tr style={st.thRow}>
                  <th style={st.th}>Data</th>
                  <th style={{ ...st.th, textAlign: "center" }}>Questões</th>
                  <th style={{ ...st.th, textAlign: "center" }}>Acertos</th>
                  <th style={st.th}>Taxa</th>
                  <th style={st.th}>Matérias</th>
                </tr>
              </thead>
              <tbody>
                {historico.map((s, i) => {
                  const pct = s.total > 0 ? Math.round((s.acertos / s.total) * 100) : 0;
                  const dataFormatada = s.data?.toDate
                    ? s.data.toDate().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
                    : "—";
                  const cor = pct >= 70 ? "#10b981" : pct >= 50 ? "#fbbf24" : "#ef4444";
                  return (
                    <tr key={i} style={st.tr}>
                      <td style={{ ...st.td, fontSize: "12px", color: "#94a3b8", whiteSpace: "nowrap" }}>{dataFormatada}</td>
                      <td style={{ ...st.td, textAlign: "center", color: "#f8fafc" }}>{s.total}</td>
                      <td style={{ ...st.td, textAlign: "center", color: "#10b981", fontWeight: "bold" }}>{s.acertos}</td>
                      <td style={{ ...st.td, minWidth: "100px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ color: cor, fontWeight: "900", fontSize: "13px", minWidth: "36px" }}>{pct}%</span>
                          <div style={{ height: "5px", background: "rgba(255,255,255,0.05)", borderRadius: "4px", flex: 1, overflow: "hidden", minWidth: "40px" }}>
                            <div style={{ height: "100%", width: `${pct}%`, background: cor, borderRadius: "4px" }} />
                          </div>
                        </div>
                      </td>
                      <td style={{ ...st.td, fontSize: "11px", color: "#64748b" }}>
                        {[...new Set(s.materias)].join(", ")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* LEGENDA */}
      <div style={st.legendaBox}>
        <div style={st.legendaItem}><div style={{ ...st.legendaDot, background: "#10b981" }}></div> Acima de 70% — Aprovado</div>
        <div style={st.legendaItem}><div style={{ ...st.legendaDot, background: "#fbbf24" }}></div> Entre 50% e 69% — Atenção</div>
        <div style={st.legendaItem}><div style={{ ...st.legendaDot, background: "#ef4444" }}></div> Abaixo de 50% — Reforço urgente</div>
      </div>

      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .spinner { width: 32px; height: 32px; border: 3px solid rgba(129,140,248,0.2); border-radius: 50%; border-top-color: #818cf8; animation: spin 0.8s ease infinite; }
      `}</style>
    </div>
  );
};

const st = {
  container: { padding: "clamp(16px, 3vw, 40px)", maxWidth: "1200px", margin: "0 auto", paddingBottom: "80px", color: "#fff", fontFamily: "'Inter', sans-serif", background: "#020617", minHeight: "100vh" },
  loadingWrapper: { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "80vh", background: "#020617" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px", flexWrap: "wrap", gap: "16px" },
  headerTitle: { margin: 0, color: "#fff", fontSize: "clamp(22px, 4vw, 34px)", fontWeight: "900", display: "flex", alignItems: "center", gap: "12px" },
  subtitle: { color: "#94a3b8", margin: "6px 0 0", fontSize: "14px" },
  btnBack: { background: "rgba(255,255,255,0.05)", color: "#fff", border: "1px solid rgba(255,255,255,0.1)", padding: "11px 20px", borderRadius: "12px", cursor: "pointer", fontSize: "11px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "8px", transition: "0.2s", letterSpacing: "0.5px" },
  insightBox: { display: "flex", alignItems: "flex-start", gap: "16px", background: "linear-gradient(90deg, rgba(79,70,229,0.1) 0%, rgba(15,23,42,0) 100%)", border: "1px solid rgba(79,70,229,0.25)", padding: "18px 22px", borderRadius: "18px", marginBottom: "28px", flexWrap: "wrap" },
  insightIcon: { background: "rgba(79,70,229,0.15)", padding: "10px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  insightTextRow: { display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px" },
  gridStats: { display: "grid", gap: "16px", marginBottom: "28px" },
  statCard: { background: "#1e293b", padding: "20px", borderRadius: "20px", border: "1px solid #334155", display: "flex", alignItems: "center", gap: "16px" },
  iconGlow: { padding: "12px", borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  statInfo: { display: "flex", flexDirection: "column", flex: 1 },
  labelStat: { fontSize: "10px", color: "#94a3b8", fontWeight: "700", letterSpacing: "0.5px", textTransform: "uppercase" },
  valStat: { fontSize: "clamp(24px, 5vw, 36px)", fontWeight: "900", color: "#f8fafc", margin: "4px 0 0" },
  mainGrid: { display: "grid", gap: "24px", marginBottom: "20px" },
  chartBox: { background: "#1e293b", padding: "clamp(16px, 3vw, 30px)", borderRadius: "24px", border: "1px solid #334155" },
  chartTitle: { fontSize: "13px", margin: "0 0 24px", display: "flex", alignItems: "center", gap: "10px", color: "#fff", fontWeight: "900", letterSpacing: "0.5px", textTransform: "uppercase" },
  tableContainer: { background: "#1e293b", padding: "clamp(16px, 3vw, 30px)", borderRadius: "24px", border: "1px solid #334155" },
  table: { width: "100%", borderCollapse: "collapse" },
  thRow: { borderBottom: "2px solid #334155" },
  th: { textAlign: "left", padding: "12px 10px", fontSize: "10px", color: "#64748b", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap" },
  tr: { borderBottom: "1px solid rgba(255,255,255,0.03)", transition: "background 0.15s" },
  td: { padding: "14px 10px", fontSize: "13px", color: "#e2e8f0" },
  emptyMsg: { textAlign: "center", padding: "40px 20px", color: "#64748b" },
  legendaBox: { display: "flex", gap: "20px", flexWrap: "wrap", padding: "16px 20px", background: "rgba(255,255,255,0.02)", borderRadius: "14px", border: "1px solid #334155" },
  legendaItem: { display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#94a3b8" },
  legendaDot: { width: "10px", height: "10px", borderRadius: "50%", flexShrink: 0 },
  periodoStrip: { display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "24px" },
  periodoBtn: { padding: "8px 18px", borderRadius: "20px", border: "1px solid #334155", background: "rgba(255,255,255,0.04)", color: "#94a3b8", cursor: "pointer", fontSize: "12px", fontWeight: "600", transition: "0.2s", letterSpacing: "0.3px" },
  periodoAtivo: { padding: "8px 18px", borderRadius: "20px", border: "1px solid #4f46e5", background: "rgba(79,70,229,0.2)", color: "#818cf8", cursor: "pointer", fontSize: "12px", fontWeight: "700", transition: "0.2s", letterSpacing: "0.3px" },
};

export default Desempenho;
