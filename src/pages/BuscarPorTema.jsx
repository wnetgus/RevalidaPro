import React, { useState, useMemo, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { db } from "../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import {
  FaArrowLeft, FaArrowRight, FaSearch, FaCheckCircle,
  FaBolt, FaBookOpen, FaHourglassHalf, FaSpinner,
  FaLayerGroup, FaChevronRight, FaTimes, FaFilter,
  FaStethoscope, FaBaby, FaVenusMars, FaUserShield, FaSyringe
} from "react-icons/fa";

// ─── Constantes ────────────────────────────────────────────────────────────────
const MATERIAS = [
  { id: "Clínica Médica",           icon: <FaStethoscope />, color: "#818cf8", desc: "Cardiologia · Pneumo · Neuro · Endo" },
  { id: "Cirurgia",                 icon: <FaSyringe />,     color: "#f87171", desc: "Abdome · Trauma · Ortopedia · Vascular" },
  { id: "Pediatria",                icon: <FaBaby />,        color: "#34d399", desc: "Neonato · Crescimento · Vacinação" },
  { id: "Ginecologia e Obstetrícia",icon: <FaVenusMars />,   color: "#f472b6", desc: "Pré-natal · Parto · Ginecologia" },
  { id: "Preventiva",               icon: <FaUserShield />,  color: "#fbbf24", desc: "Epidemio · Vigilância · SUS" },
];

const COR_CONTEXTO = {
  "adulto":         "#818cf8",
  "gestante":       "#ec4899",
  "pediátrico":     "#10b981",
  "adolescente":    "#34d399",
  "idoso":          "#f59e0b",
  "emergência":     "#ef4444",
  "pós-operatório": "#8b5cf6",
};

// ─── Agrupa questões por tema_mestre (fallback: subtema) ──────────────────────
// ─── Agrupa questões por tema_mestre com normalização robusta ────────────────
// Problemas resolvidos:
//   1. Case-insensitive: "Diabetes Mellitus" e "diabetes mellitus" → mesmo grupo
//   2. Rastreia questões sem tema_mestre (usam subtema como fallback)
//   3. Preserva o casing da primeira ocorrência para exibição
const agrupar = (questoes) => {
  const map    = {};          // displayKey → dados do grupo
  const keyMap = {};          // normalized (lowercase) → displayKey (primeiro visto)

  questoes.forEach(q => {
    // Prioridade: tema_mestre preenchido > subtema > fallback
    const raw  = (q.tema_mestre?.trim() || q.subtema?.trim() || "Sem tema classificado");
    const norm = raw.toLowerCase();

    // Preserva casing da primeira ocorrência — unifica variantes posteriores
    if (!keyMap[norm]) keyMap[norm] = raw;
    const displayKey = keyMap[norm];

    if (!map[displayKey]) {
      map[displayKey] = {
        tema: displayKey,
        total: 0,
        subtemas: {},
        contextos: new Set(),
        questoes: [],
        semTemaMestre: 0,   // contador de questões sem campo tema_mestre definido
      };
    }
    map[displayKey].total++;
    map[displayKey].questoes.push(q);

    const sub = (q.subtema?.trim() || "Geral");
    map[displayKey].subtemas[sub] = (map[displayKey].subtemas[sub] || 0) + 1;

    if (q.subcontexto_clinico) map[displayKey].contextos.add(q.subcontexto_clinico);

    // Registra se esta questão não tem tema_mestre próprio (usando fallback)
    if (!q.tema_mestre?.trim()) map[displayKey].semTemaMestre++;
  });

  return Object.values(map).sort((a, b) => b.total - a.total);
};

// ─── Componente principal ──────────────────────────────────────────────────────
const BuscarPorTema = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Wizard state
  const [etapa, setEtapa] = useState(1); // 1=matéria 2=tema 3=config
  const [materia, setMateria] = useState(null);
  const [grupos, setGrupos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [buscaTema, setBuscaTema] = useState("");
  const [temaAtivo, setTemaAtivo] = useState(null);

  // Config (etapa 3)
  const [subtemasAtivos, setSubtemasAtivos] = useState([]);
  const [modo, setModo] = useState("livre"); // "livre" | "simulado"

  // ── Se vier do Dashboard com materiaPre, pula direto para etapa 2 ───────────
  useEffect(() => {
    const pre = location.state?.materiaPre;
    if (pre) {
      const m = MATERIAS.find(x => x.id === pre);
      if (m) selecionarMateria(m);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Carrega questões ao selecionar matéria ──────────────────────────────────
  const selecionarMateria = async (m) => {
    setMateria(m);
    setLoading(true);
    setGrupos([]);
    setBuscaTema("");
    try {
      const q = query(collection(db, "questoes"), where("materia", "==", m.id));
      const snap = await getDocs(q);
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setGrupos(agrupar(lista));
    } catch (e) {
      console.error("Erro ao carregar questões:", e);
    }
    setLoading(false);
    setEtapa(2);
  };

  // ── Seleciona tema → pré-seleciona todos os subtemas ───────────────────────
  const selecionarTema = (grupo) => {
    setTemaAtivo(grupo);
    setSubtemasAtivos(Object.keys(grupo.subtemas));
    setEtapa(3);
  };

  // ── Toggle subtema individual ───────────────────────────────────────────────
  const toggleSubtema = (sub) => {
    setSubtemasAtivos(prev =>
      prev.includes(sub) ? prev.filter(s => s !== sub) : [...prev, sub]
    );
  };

  const todasSubtemasAtivas = temaAtivo
    ? subtemasAtivos.length === Object.keys(temaAtivo.subtemas).length
    : false;

  // ── Treinar TODAS as questões da matéria (sem filtro de tema) ─────────────
  const treinarTodaMateria = (modoTreino = "livre") => {
    const todas = grupos.flatMap(g => g.questoes);
    const final = modoTreino === "simulado"
      ? todas
      : [...todas].sort(() => Math.random() - 0.5);
    navigate("/simulador", {
      state: { questoesCustomizadas: final, comTempo: modoTreino === "simulado", modoPersonalizado: true }
    });
  };

  // ── Filtra grupos pelo campo de busca ───────────────────────────────────────
  const gruposFiltrados = useMemo(() => {
    if (!buscaTema.trim()) return grupos;
    const t = buscaTema.toLowerCase();
    return grupos.filter(g =>
      g.tema.toLowerCase().includes(t) ||
      Object.keys(g.subtemas).some(s => s.toLowerCase().includes(t))
    );
  }, [grupos, buscaTema]);

  // ── Iniciar simulado ────────────────────────────────────────────────────────
  const iniciar = () => {
    if (!temaAtivo || subtemasAtivos.length === 0) return;
    const questoesFiltradas = temaAtivo.questoes.filter(q => {
      const sub = (q.subtema || "Geral").trim();
      return subtemasAtivos.includes(sub);
    });
    // Embaralha em modo livre, mantém ordem em simulado
    const final = modo === "simulado"
      ? questoesFiltradas
      : [...questoesFiltradas].sort(() => Math.random() - 0.5);

    navigate("/simulador", {
      state: {
        questoesCustomizadas: final,
        comTempo: modo === "simulado",
        modoPersonalizado: true,
      }
    });
  };

  // ── Navegação entre etapas ──────────────────────────────────────────────────
  const voltar = () => {
    if (etapa === 3) { setEtapa(2); setTemaAtivo(null); }
    else if (etapa === 2) { setEtapa(1); setMateria(null); setGrupos([]); }
    else navigate(-1);
  };

  const totalQuestoesSelecionadas = temaAtivo
    ? temaAtivo.questoes.filter(q => subtemasAtivos.includes((q.subtema || "Geral").trim())).length
    : 0;

  const _matInfo = MATERIAS.find(m => m.id === materia?.id);

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div style={s.page}>
      <div style={s.card}>

        {/* ─── Header ──────────────────────────────────────────────────────── */}
        <header style={s.header}>
          <button onClick={voltar} style={s.btnVoltar}>
            <FaArrowLeft size={12} />
          </button>
          <div style={{ flex: 1 }}>
            {/* Breadcrumb */}
            <div style={s.breadcrumb}>
              <span
                style={{ ...s.crumb, color: etapa === 1 ? "#f1f5f9" : "#64748b", cursor: etapa > 1 ? "pointer" : "default" }}
                onClick={() => etapa > 1 && setEtapa(1)}
              >
                Matéria
              </span>
              {etapa >= 2 && (
                <>
                  <FaChevronRight size={9} color="#334155" />
                  <span
                    style={{ ...s.crumb, color: etapa === 2 ? "#f1f5f9" : "#64748b", cursor: etapa > 2 ? "pointer" : "default" }}
                    onClick={() => etapa > 2 && setEtapa(2)}
                  >
                    {materia?.id}
                  </span>
                </>
              )}
              {etapa >= 3 && temaAtivo && (
                <>
                  <FaChevronRight size={9} color="#334155" />
                  <span style={{ ...s.crumb, color: "#f1f5f9" }}>{temaAtivo.tema}</span>
                </>
              )}
            </div>
            <h2 style={s.titulo}>
              {etapa === 1 && "Escolha a matéria"}
              {etapa === 2 && `Temas — ${materia?.id}`}
              {etapa === 3 && "Configure seu treino"}
            </h2>
          </div>
          {/* Steps */}
          <div style={s.steps}>
            {[1, 2, 3].map(n => (
              <div key={n} style={{ ...s.step, background: n <= etapa ? "#4f46e5" : "#1e293b", opacity: n > etapa ? 0.4 : 1 }} />
            ))}
          </div>
        </header>

        {/* ═══ ETAPA 1: MATÉRIAS ════════════════════════════════════════════ */}
        {etapa === 1 && (
          <div style={s.body}>
            <div style={s.gridMaterias}>
              {MATERIAS.map(m => (
                <button key={m.id} onClick={() => selecionarMateria(m)} style={s.cardMateria}>
                  <div style={{ ...s.materiaIcon, background: `${m.color}20`, border: `1px solid ${m.color}40` }}>
                    {React.cloneElement(m.icon, { color: m.color, size: 22 })}
                  </div>
                  <div style={{ flex: 1, textAlign: "left" }}>
                    <div style={{ ...s.materiaNome, color: m.color }}>{m.id}</div>
                    <div style={s.materiaDesc}>{m.desc}</div>
                  </div>
                  <FaArrowRight size={12} color="#334155" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ═══ ETAPA 2: TEMAS ═══════════════════════════════════════════════ */}
        {etapa === 2 && (
          <div style={s.body}>
            {/* Busca */}
            <div style={s.buscaBox}>
              <FaSearch size={12} color="#475569" />
              <input
                value={buscaTema}
                onChange={e => setBuscaTema(e.target.value)}
                placeholder="Filtrar temas..."
                style={s.inputBusca}
              />
              {buscaTema && (
                <button onClick={() => setBuscaTema("")} style={s.btnLimpar}>
                  <FaTimes size={10} color="#475569" />
                </button>
              )}
            </div>

            {/* Botão treinar matéria completa */}
            {!loading && grupos.length > 0 && (
              <div style={s.treinarTudoBox}>
                <div style={s.treinarTudoInfo}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#f1f5f9" }}>
                    {materia?.id}
                  </span>
                  <span style={{ fontSize: 11, color: "#475569" }}>
                    · {grupos.reduce((a, g) => a + g.total, 0)} questões no total
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => treinarTodaMateria("livre")}
                    style={s.btnTreinarTudo}
                    title="Treinar todas as questões desta matéria (modo livre)"
                  >
                    <FaBookOpen size={11} />
                    Todas — Livre
                  </button>
                  <button
                    onClick={() => treinarTodaMateria("simulado")}
                    style={{ ...s.btnTreinarTudo, background: "rgba(79,70,229,0.15)", borderColor: "rgba(79,70,229,0.3)", color: "#818cf8" }}
                    title="Treinar todas as questões desta matéria (simulado cronometrado)"
                  >
                    <FaHourglassHalf size={11} />
                    Todas — Simulado
                  </button>
                </div>
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div style={s.loadBox}>
                <FaSpinner style={{ animation: "spin .8s linear infinite", fontSize: 24, color: "#4f46e5" }} />
                <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>Carregando temas...</p>
              </div>
            )}

            {/* Lista de temas */}
            {!loading && (
              <>
                <p style={s.contadorTemas}>
                  <strong style={{ color: "#f1f5f9" }}>{gruposFiltrados.length}</strong> tema{gruposFiltrados.length !== 1 ? "s" : ""} encontrado{gruposFiltrados.length !== 1 ? "s" : ""}
                  {" · "}
                  <strong style={{ color: "#f1f5f9" }}>{grupos.reduce((a, g) => a + g.total, 0)}</strong> questões
                </p>
                <div style={s.listaTemas}>
                  {gruposFiltrados.length === 0 && (
                    <div style={s.emptyBox}>
                      <FaBookOpen size={28} color="#1e293b" />
                      <p style={{ color: "#475569", fontSize: 13, margin: 0 }}>Nenhum tema encontrado para "{buscaTema}"</p>
                    </div>
                  )}
                  {gruposFiltrados.map(grupo => {
                    const ctxArr = [...grupo.contextos];
                    const subArr = Object.entries(grupo.subtemas).sort((a, b) => b[1] - a[1]);
                    return (
                      <button key={grupo.tema} onClick={() => selecionarTema(grupo)} style={s.cardTema}>
                        <div style={s.cardTemaTop}>
                          <span style={s.temaNome}>{grupo.tema}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                            {grupo.semTemaMestre > 0 && (
                              <span title={`${grupo.semTemaMestre} questão(ões) usando fallback de subtema — rode a migração no painel admin`} style={s.badgeFallback}>
                                ⚠ {grupo.semTemaMestre}
                              </span>
                            )}
                            <span style={s.temaBadge}>{grupo.total} questão{grupo.total !== 1 ? "ões" : ""}</span>
                          </div>
                        </div>
                        {/* Context badges */}
                        {ctxArr.length > 0 && (
                          <div style={s.ctxRow}>
                            {ctxArr.map(ctx => (
                              <span key={ctx} style={{
                                ...s.ctxChip,
                                background: `${COR_CONTEXTO[ctx] || "#818cf8"}18`,
                                color: COR_CONTEXTO[ctx] || "#818cf8",
                                border: `1px solid ${COR_CONTEXTO[ctx] || "#818cf8"}35`,
                              }}>
                                {ctx}
                              </span>
                            ))}
                          </div>
                        )}
                        {/* Subtema chips */}
                        <div style={s.subtemasRow}>
                          {subArr.slice(0, 4).map(([sub, cnt]) => (
                            <span key={sub} style={s.subChip}>
                              {sub}
                              <span style={s.subChipCount}>{cnt}</span>
                            </span>
                          ))}
                          {subArr.length > 4 && (
                            <span style={{ ...s.subChip, color: "#475569" }}>+{subArr.length - 4} subtemas</span>
                          )}
                        </div>
                        <FaChevronRight size={11} color="#334155" style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)" }} />
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══ ETAPA 3: CONFIG ══════════════════════════════════════════════ */}
        {etapa === 3 && temaAtivo && (
          <div style={s.body}>
            {/* Resumo do tema */}
            <div style={s.temaResumo}>
              <div style={s.temaResumoLeft}>
                <div style={s.temaResumoNome}>{temaAtivo.tema}</div>
                <div style={s.temaResumoMateria}>{materia?.id}</div>
              </div>
              <div style={s.temaResumoTotal}>
                <span style={s.totalNum}>{totalQuestoesSelecionadas}</span>
                <span style={s.totalLabel}>questões</span>
              </div>
            </div>

            <div style={s.configGrid}>
              {/* Subtemas */}
              <div style={s.configCol}>
                <div style={s.configLabel}>
                  <FaFilter size={10} />
                  SUBTEMAS
                </div>
                <button
                  onClick={() => setSubtemasAtivos(
                    todasSubtemasAtivas ? [] : Object.keys(temaAtivo.subtemas)
                  )}
                  style={s.btnToggleTodos}
                >
                  {todasSubtemasAtivas ? "Desmarcar todos" : "Selecionar todos"}
                </button>
                <div style={s.listaSubtemas}>
                  {Object.entries(temaAtivo.subtemas)
                    .sort((a, b) => b[1] - a[1])
                    .map(([sub, cnt]) => {
                      const ativo = subtemasAtivos.includes(sub);
                      return (
                        <button
                          key={sub}
                          onClick={() => toggleSubtema(sub)}
                          style={{
                            ...s.subtemasItem,
                            borderColor: ativo ? "#4f46e5" : "#1e293b",
                            background: ativo ? "rgba(79,70,229,0.08)" : "rgba(255,255,255,0.02)",
                          }}
                        >
                          <div style={{
                            ...s.subtemasCheck,
                            background: ativo ? "#4f46e5" : "transparent",
                            borderColor: ativo ? "#4f46e5" : "#334155",
                          }}>
                            {ativo && <FaCheckCircle size={8} color="#fff" />}
                          </div>
                          <span style={{ ...s.subtemasNome, color: ativo ? "#f1f5f9" : "#64748b" }}>
                            {sub}
                          </span>
                          <span style={s.subtemasCount}>{cnt}</span>
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Modo */}
              <div style={s.configCol}>
                <div style={s.configLabel}>
                  <FaLayerGroup size={10} />
                  MODO
                </div>
                <button
                  onClick={() => setModo("livre")}
                  style={{
                    ...s.modoCard,
                    borderColor: modo === "livre" ? "#10b981" : "#1e293b",
                    background: modo === "livre" ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.02)",
                  }}
                >
                  <div style={{ ...s.modoIcon, background: modo === "livre" ? "#10b981" : "#1e293b" }}>
                    <FaBookOpen color={modo === "livre" ? "#fff" : "#475569"} size={14} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: modo === "livre" ? "#fff" : "#64748b" }}>
                      ESTUDO LIVRE
                    </div>
                    <div style={{ fontSize: 10, color: "#475569" }}>Sem pressão de tempo</div>
                  </div>
                  {modo === "livre" && <FaCheckCircle color="#10b981" size={12} style={{ marginLeft: "auto" }} />}
                </button>
                <button
                  onClick={() => setModo("simulado")}
                  style={{
                    ...s.modoCard,
                    borderColor: modo === "simulado" ? "#4f46e5" : "#1e293b",
                    background: modo === "simulado" ? "rgba(79,70,229,0.08)" : "rgba(255,255,255,0.02)",
                  }}
                >
                  <div style={{ ...s.modoIcon, background: modo === "simulado" ? "#4f46e5" : "#1e293b" }}>
                    <FaHourglassHalf color={modo === "simulado" ? "#fff" : "#475569"} size={14} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: modo === "simulado" ? "#fff" : "#64748b" }}>
                      SIMULADO
                    </div>
                    <div style={{ fontSize: 10, color: "#475569" }}>Cronômetro INEP</div>
                  </div>
                  {modo === "simulado" && <FaCheckCircle color="#4f46e5" size={12} style={{ marginLeft: "auto" }} />}
                </button>

                {/* Contextos no tema */}
                {[...temaAtivo.contextos].length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ ...s.configLabel, marginBottom: 8 }}>CONTEXTOS CLÍNICOS</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {[...temaAtivo.contextos].map(ctx => (
                        <span key={ctx} style={{
                          fontSize: 10, fontWeight: 700, padding: "2px 8px",
                          borderRadius: 4, textTransform: "uppercase", letterSpacing: "0.4px",
                          background: `${COR_CONTEXTO[ctx] || "#818cf8"}18`,
                          color: COR_CONTEXTO[ctx] || "#818cf8",
                          border: `1px solid ${COR_CONTEXTO[ctx] || "#818cf8"}35`,
                        }}>
                          {ctx}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Botão iniciar */}
            <button
              onClick={iniciar}
              disabled={subtemasAtivos.length === 0 || totalQuestoesSelecionadas === 0}
              style={{
                ...s.btnIniciar,
                opacity: subtemasAtivos.length === 0 ? 0.4 : 1,
                cursor: subtemasAtivos.length === 0 ? "not-allowed" : "pointer",
              }}
            >
              <FaBolt size={14} />
              INICIAR — {totalQuestoesSelecionadas} questão{totalQuestoesSelecionadas !== 1 ? "ões" : ""}
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 640px) {
          .bpt-config-grid { grid-template-columns: 1fr !important; }
          .bpt-materias-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
};

// ─── Estilos ──────────────────────────────────────────────────────────────────
const s = {
  page: {
    minHeight: "100vh", background: "#020617",
    display: "flex", justifyContent: "center", alignItems: "flex-start",
    padding: "clamp(16px,3vw,40px)", paddingBottom: 60,
  },
  card: {
    width: "100%", maxWidth: 720,
    background: "linear-gradient(145deg,#111827,#0f172a)",
    border: "1px solid #1e293b", borderRadius: 28,
    boxShadow: "0 24px 56px rgba(0,0,0,0.5)",
    overflow: "hidden",
  },
  header: {
    display: "flex", alignItems: "center", gap: 16,
    padding: "24px 28px", borderBottom: "1px solid #1e293b",
  },
  btnVoltar: {
    background: "rgba(255,255,255,0.04)", border: "1px solid #334155",
    color: "#94a3b8", padding: 10, borderRadius: 12,
    cursor: "pointer", display: "flex", alignItems: "center", flexShrink: 0,
  },
  breadcrumb: {
    display: "flex", alignItems: "center", gap: 6,
    marginBottom: 4,
  },
  crumb: {
    fontSize: 11, fontWeight: 700, letterSpacing: "0.2px",
    transition: "color .15s",
  },
  titulo: {
    margin: 0, color: "#f1f5f9",
    fontSize: "clamp(15px,2.5vw,20px)", fontWeight: 900, letterSpacing: "-0.3px",
  },
  steps: {
    display: "flex", gap: 5, flexShrink: 0,
  },
  step: {
    width: 28, height: 4, borderRadius: 2,
    transition: "background .3s, opacity .3s",
  },
  body: { padding: "24px 28px" },

  // ETAPA 1 — matérias
  gridMaterias: {
    display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12,
    className: "bpt-materias-grid",
  },
  cardMateria: {
    display: "flex", alignItems: "center", gap: 14,
    background: "rgba(255,255,255,0.02)", border: "1px solid #1e293b",
    borderRadius: 16, padding: "16px 18px", cursor: "pointer",
    transition: "border-color .2s, background .2s",
    textAlign: "left", width: "100%",
  },
  materiaIcon: {
    width: 46, height: 46, borderRadius: 12,
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  materiaNome: { fontSize: 13, fontWeight: 800, marginBottom: 2 },
  materiaDesc: { fontSize: 10, color: "#475569", lineHeight: 1.4 },

  // ETAPA 2 — temas
  treinarTudoBox: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    flexWrap: "wrap", gap: 10,
    background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)",
    borderRadius: 12, padding: "12px 16px", marginBottom: 14,
  },
  treinarTudoInfo: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  btnTreinarTudo: {
    display: "flex", alignItems: "center", gap: 6,
    fontSize: 11, fontWeight: 700, padding: "6px 12px",
    borderRadius: 8, border: "1px solid rgba(16,185,129,0.3)",
    background: "rgba(16,185,129,0.12)", color: "#34d399",
    cursor: "pointer", letterSpacing: "0.2px",
  },
  buscaBox: {
    display: "flex", alignItems: "center", gap: 10,
    background: "#070f1e", border: "1px solid #1e293b", borderRadius: 12,
    padding: "10px 14px", marginBottom: 16,
  },
  inputBusca: {
    flex: 1, background: "transparent", border: "none", outline: "none",
    color: "#f1f5f9", fontSize: 13,
  },
  btnLimpar: {
    background: "none", border: "none", cursor: "pointer",
    display: "flex", alignItems: "center", padding: 2,
  },
  loadBox: {
    display: "flex", flexDirection: "column", alignItems: "center",
    gap: 12, padding: "48px 0",
  },
  contadorTemas: {
    fontSize: 11, color: "#475569", marginBottom: 12,
    fontWeight: 600, margin: "0 0 12px 0",
  },
  listaTemas: { display: "flex", flexDirection: "column", gap: 8 },
  cardTema: {
    position: "relative", display: "flex", flexDirection: "column",
    gap: 8, background: "rgba(255,255,255,0.02)",
    border: "1px solid #1e293b", borderRadius: 14,
    padding: "14px 40px 14px 16px", cursor: "pointer",
    textAlign: "left", width: "100%",
    transition: "border-color .18s, background .18s",
  },
  cardTemaTop: {
    display: "flex", alignItems: "center",
    justifyContent: "space-between", gap: 10,
  },
  temaNome: {
    fontSize: 14, fontWeight: 800, color: "#f1f5f9",
    flex: 1, lineHeight: 1.3,
  },
  temaBadge: {
    fontSize: 10, fontWeight: 800, color: "#818cf8",
    background: "rgba(129,140,248,0.12)", border: "1px solid rgba(129,140,248,0.2)",
    padding: "2px 8px", borderRadius: 6, flexShrink: 0,
  },
  // Badge de qualidade: indica questões sem tema_mestre (usando fallback de subtema)
  badgeFallback: {
    fontSize: 9, fontWeight: 800, color: "#f59e0b",
    background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)",
    padding: "2px 7px", borderRadius: 5, flexShrink: 0, cursor: "help",
    letterSpacing: "0.3px",
  },
  ctxRow: { display: "flex", gap: 5, flexWrap: "wrap" },
  ctxChip: {
    fontSize: 9, fontWeight: 700, padding: "1px 7px",
    borderRadius: 4, textTransform: "uppercase", letterSpacing: "0.4px",
  },
  subtemasRow: { display: "flex", gap: 5, flexWrap: "wrap" },
  subChip: {
    fontSize: 10, color: "#334155", background: "#0a1628",
    border: "1px solid #1e293b", borderRadius: 5,
    padding: "2px 7px", display: "flex", alignItems: "center", gap: 4,
  },
  subChipCount: {
    fontSize: 9, fontWeight: 800, color: "#475569",
    background: "#1e293b", borderRadius: 3, padding: "0 4px",
  },
  emptyBox: {
    display: "flex", flexDirection: "column", alignItems: "center",
    gap: 12, padding: "32px 0",
  },

  // ETAPA 3 — config
  temaResumo: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    background: "rgba(79,70,229,0.06)", border: "1px solid rgba(79,70,229,0.2)",
    borderRadius: 14, padding: "16px 20px", marginBottom: 20,
  },
  temaResumoLeft: {},
  temaResumoNome: { fontSize: 15, fontWeight: 900, color: "#f1f5f9", marginBottom: 2 },
  temaResumoMateria: { fontSize: 11, color: "#818cf8", fontWeight: 700 },
  temaResumoTotal: {
    display: "flex", flexDirection: "column", alignItems: "center",
  },
  totalNum: { fontSize: 28, fontWeight: 900, color: "#f1f5f9", lineHeight: 1 },
  totalLabel: { fontSize: 10, color: "#475569", fontWeight: 700 },
  configGrid: {
    display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16,
    marginBottom: 20,
  },
  configCol: { display: "flex", flexDirection: "column", gap: 10 },
  configLabel: {
    fontSize: 10, fontWeight: 800, color: "#818cf8",
    letterSpacing: "1px", textTransform: "uppercase",
    display: "flex", alignItems: "center", gap: 6,
  },
  btnToggleTodos: {
    background: "none", border: "1px solid #1e293b", color: "#475569",
    fontSize: 10, fontWeight: 700, padding: "5px 10px",
    borderRadius: 6, cursor: "pointer", alignSelf: "flex-start",
    letterSpacing: "0.3px",
  },
  listaSubtemas: {
    display: "flex", flexDirection: "column", gap: 6,
    maxHeight: 240, overflowY: "auto",
  },
  subtemasItem: {
    display: "flex", alignItems: "center", gap: 10,
    padding: "8px 12px", borderRadius: 10, border: "1px solid",
    cursor: "pointer", transition: "all .15s", width: "100%",
    textAlign: "left",
  },
  subtemasCheck: {
    width: 18, height: 18, borderRadius: 5, border: "1.5px solid",
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0, transition: "all .15s",
  },
  subtemasNome: { flex: 1, fontSize: 12, fontWeight: 600, lineHeight: 1.3 },
  subtemasCount: {
    fontSize: 10, fontWeight: 800, color: "#334155",
    background: "#0a1628", border: "1px solid #1e293b",
    borderRadius: 4, padding: "0 6px",
  },
  modoCard: {
    display: "flex", alignItems: "center", gap: 12,
    padding: "12px 14px", borderRadius: 12, border: "1.5px solid",
    cursor: "pointer", transition: "all .15s", width: "100%",
    textAlign: "left",
  },
  modoIcon: {
    width: 36, height: 36, borderRadius: 10,
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0, transition: "background .15s",
  },
  btnIniciar: {
    width: "100%", padding: "16px", borderRadius: 16,
    background: "linear-gradient(135deg,#4f46e5,#7c3aed)",
    color: "#fff", border: "none", fontSize: 14, fontWeight: 900,
    display: "flex", alignItems: "center", justifyContent: "center",
    gap: 10, boxShadow: "0 10px 28px rgba(79,70,229,0.35)",
    letterSpacing: "0.5px", transition: "opacity .2s",
  },
};

export default BuscarPorTema;
