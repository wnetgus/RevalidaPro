import React, { useState, useCallback, useRef, useMemo } from "react";
import { db } from "../firebase";
import {
  collection, getDocs, doc, setDoc, deleteDoc, updateDoc, serverTimestamp
} from "firebase/firestore";
import {
  FaBookOpen, FaSync, FaRobot, FaTrash, FaCheckCircle,
  FaClock, FaExclamationTriangle, FaSearch, FaStop,
  FaChevronDown, FaChevronUp
} from "react-icons/fa";

/**
 * ResumoGerador — Gera resumos clínicos contextualizados por tema × subcontexto
 *
 * DocId no Firestore: "{tema_mestre}--{subcontexto_clinico}"
 * Ex: "Hipertensão arterial--gestante", "Asma--pediátrico"
 *
 * Fluxo:
 *   1. Migração: IA lê enunciado → classifica tema_mestre + subcontexto_clinico
 *   2. Geração: IA gera resumo 10-pontos específico para o contexto
 *   3. TeoriaModal busca por docId composto (contexto-específico > genérico > subtema)
 */

// ── Cores por contexto clínico ────────────────────────────────────────────────
const COR_CONTEXTO = {
  "adulto":          "#818cf8",
  "gestante":        "#ec4899",
  "pediátrico":      "#10b981",
  "adolescente":     "#34d399",
  "idoso":           "#f59e0b",
  "emergência":      "#ef4444",
  "pós-operatório":  "#8b5cf6",
};

// ── Sanitiza para docId Firestore ─────────────────────────────────────────────
// Formato: "{tema}--{contexto}" ou apenas "{tema}" se sem contexto
const toDocId = (tema, contexto) => {
  const base = (tema || "").trim().replace(/[/.#[\]*]/g, "-");
  const ctx  = (contexto || "").trim().replace(/[/.#[\]*]/g, "-");
  return ctx ? `${base}--${ctx}` : base;
};

// ── Endpoint Cloud Function (reutiliza gerarQuestoesIA) ───────────────────────
const isDev = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const ENDPOINT = isDev
  ? "/functions/gerarQuestoesIA"
  : (import.meta.env.VITE_FUNCTIONS_BASE_URL || "https://us-central1-revalidapro-f812e.cloudfunctions.net")
    + "/gerarQuestoesIA";

// ── Prompt: MIGRAÇÃO — classifica contexto clínico de questões existentes ─────
const PROMPT_MIGRACAO = `Você é especialista em classificação de casos clínicos para o Revalida (INEP/SUS).
Dado um enunciado de questão médica, identifique:
1. tema_mestre: condição clínica principal, conciso (ex: "Hipertensão arterial", "Asma", "Diabetes mellitus tipo 2")
2. subcontexto_clinico: contexto específico — use EXATAMENTE um dos valores abaixo:
   "adulto"         — paciente adulto sem contexto especial
   "gestante"       — paciente grávida ou puérpera
   "pediátrico"     — criança (< 12 anos)
   "adolescente"    — 12 a 18 anos
   "idoso"          — acima de 65 anos
   "emergência"     — urgência ou emergência com risco de vida imediato
   "pós-operatório" — período pós-cirúrgico

RETORNE APENAS JSON válido (sem texto, sem markdown):
{ "tema_mestre": "...", "subcontexto_clinico": "..." }`;

// ── Prompt: GERAÇÃO — resumo contextualizado 10 pontos ───────────────────────
const PROMPT_RESUMO = `Você é um preceptor de Medicina especializado na prova Revalida (INEP/SUS).
Gere um resumo clínico em exatamente 10 pontos para o tema e contexto informados.
TODO o conteúdo deve ser coerente com o contexto clínico (ex: se "gestante", use medicações seguras na gestação; se "pediátrico", use critérios e doses pediátricas).
RETORNE APENAS JSON válido (sem markdown, sem código, sem texto extra):
{
  "titulo": "Nome do tema — Contexto (ex: Hipertensão arterial — Gestante)",
  "pontos": [
    { "label": "Definição", "texto": "1-2 frases objetivas" },
    { "label": "Critérios diagnósticos", "texto": "..." },
    { "label": "Classificação", "texto": "ou Epidemiologia se não aplicável" },
    { "label": "Conduta inicial", "texto": "específica para o contexto" },
    { "label": "Tratamento", "texto": "1ª linha SUS/MS para este contexto" },
    { "label": "Complicações", "texto": "principais neste contexto" },
    { "label": "Situações de prova", "texto": "pegadinhas e pontos frequentes no Revalida para este contexto" },
    { "label": "Quando encaminhar", "texto": "critérios de encaminhamento neste contexto" },
    { "label": "Dica prática", "texto": "ponto-chave que o avaliador quer ver" },
    { "label": "Erros comuns", "texto": "equívocos frequentes neste contexto" }
  ]
}
Regras: máximo 2-3 frases por ponto · diretrizes MS/SUS · nunca inventar dados · contexto obrigatório em todo o conteúdo`;

const DELAY_MIG_MS  = 8000;  // 8s entre chamadas de migração (respostas pequenas)
const DELAY_GER_MS  = 20000; // 20s entre geração de resumos (respostas grandes)

// ── Extrai JSON robusto de texto ──────────────────────────────────────────────
const extrairJSON = (texto) => {
  const inicio = texto.indexOf("{");
  if (inicio === -1) throw new Error("JSON não encontrado");
  let depth = 0;
  for (let i = inicio; i < texto.length; i++) {
    if (texto[i] === "{") depth++;
    else if (texto[i] === "}") { depth--; if (depth === 0) return JSON.parse(texto.slice(inicio, i + 1)); }
  }
  throw new Error("JSON incompleto");
};

// ─────────────────────────────────────────────────────────────────────────────
const ResumoGerador = () => {
  const [questoes, setQuestoes]         = useState([]);
  const [temas, setTemas]               = useState([]); // {key, tema_mestre, subcontexto_clinico, materia, qtd}
  const [existentes, setExistentes]     = useState(new Set());
  const [loading, setLoading]           = useState(false);
  const [carregado, setCarregado]       = useState(false);

  // Migração
  const [migrando, setMigrando]         = useState(false);
  const [_migrandoId, setMigrandoId]     = useState(null);
  const [progMig, setProgMig]           = useState({ atual: 0, total: 0 });

  // Geração
  const [gerando, setGerando]           = useState(false);
  const [gerandoKey, setGerandoKey]     = useState(null);
  const [progGer, setProgGer]           = useState({ atual: 0, total: 0 });

  // Filtros
  const [filtroMat, setFiltroMat]       = useState("Todas");
  const [filtroCtx, setFiltroCtx]       = useState("Todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [busca, setBusca]               = useState("");

  // Logs
  const [logs, setLogs]                 = useState([]);
  const [expandedLogs, setExpandedLogs] = useState(true);

  const stopRef = useRef(false);
  const logRef  = useRef(null);

  const addLog = useCallback((msg, tipo = "info") => {
    const hora = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setLogs(l => [...l, { msg, tipo, hora }]);
    setTimeout(() => logRef.current?.scrollTo(0, logRef.current.scrollHeight), 50);
  }, []);

  // ── CARREGAR ─────────────────────────────────────────────────────────────
  const carregar = async () => {
    setLoading(true);
    addLog("Carregando questões e resumos...", "info");
    try {
      const [snapQ, snapT] = await Promise.all([
        getDocs(collection(db, "questoes")),
        getDocs(collection(db, "teorias")),
      ]);

      const docs = snapQ.docs.map(d => ({ id: d.id, ...d.data() }));
      setQuestoes(docs);

      // Agrupa por (tema_mestre || subtema) + subcontexto_clinico
      const mapa = {};
      docs.forEach(q => {
        const tema = (q.tema_mestre && q.tema_mestre !== "INDEFINIDO") ? q.tema_mestre : q.subtema;
        if (!tema) return;
        const ctx = q.subcontexto_clinico || "";
        const key = toDocId(tema, ctx);
        if (!mapa[key]) mapa[key] = { key, tema_mestre: tema, subcontexto_clinico: ctx, materia: q.materia || "Geral", qtd: 0 };
        mapa[key].qtd++;
      });

      const lista = Object.values(mapa).sort((a, b) => {
        const cmp = a.tema_mestre.localeCompare(b.tema_mestre, "pt");
        return cmp !== 0 ? cmp : a.subcontexto_clinico.localeCompare(b.subcontexto_clinico, "pt");
      });

      const ids = new Set(snapT.docs.map(d => d.id));
      setTemas(lista);
      setExistentes(ids);
      setCarregado(true);

      const semCtx  = docs.filter(q => !q.subcontexto_clinico).length;
      const semTema = docs.filter(q => !q.tema_mestre || q.tema_mestre === "INDEFINIDO").length;
      addLog(`${lista.length} combinações tema×contexto · ${ids.size} resumos existentes`, "sucesso");
      if (semCtx > 0)  addLog(`⚠ ${semCtx} questões sem subcontexto_clinico — rode a migração acima`, "aviso");
      if (semTema > 0) addLog(`⚠ ${semTema} questões sem tema_mestre — usando subtema como fallback`, "aviso");
    } catch (e) {
      addLog("Erro ao carregar: " + e.message, "erro");
    }
    setLoading(false);
  };

  // ── MIGRAÇÃO: classifica UMA questão com IA ───────────────────────────────
  const classificarUma = useCallback(async (questao) => {
    setMigrandoId(questao.id);
    addLog(`Classificando: "${(questao.enunciado || "").slice(0, 55)}..."`, "info");
    try {
      const resp = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: PROMPT_MIGRACAO,
          prompt: `Classifique este enunciado:\n"${(questao.enunciado || "").slice(0, 600)}"`,
        }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data  = await resp.json();
      const texto = data?.content?.[0]?.text || data?.text || "";
      if (!texto) throw new Error("Resposta vazia");

      const parsed = extrairJSON(texto);
      if (!parsed.tema_mestre || !parsed.subcontexto_clinico) throw new Error("Campos ausentes no JSON");

      await updateDoc(doc(db, "questoes", questao.id), {
        tema_mestre: parsed.tema_mestre,
        subcontexto_clinico: parsed.subcontexto_clinico,
      });

      addLog(`✓ ${parsed.tema_mestre} [${parsed.subcontexto_clinico}]`, "sucesso");
      return parsed;
    } catch (e) {
      addLog(`✗ Q${questao.id.slice(-6)}: ${e.message}`, "erro");
      return null;
    } finally {
      setMigrandoId(null);
    }
  }, [addLog]);

  const migrarTodas = async () => {
    const pendentes = questoes.filter(q => !q.subcontexto_clinico);
    if (pendentes.length === 0) { addLog("Todas as questões já possuem contexto.", "info"); return; }

    stopRef.current = false;
    setMigrando(true);
    setProgMig({ atual: 0, total: pendentes.length });
    addLog(`Iniciando migração: ${pendentes.length} questões sem contexto`, "info");

    for (let i = 0; i < pendentes.length; i++) {
      if (stopRef.current) { addLog("Migração interrompida.", "aviso"); break; }
      setProgMig({ atual: i + 1, total: pendentes.length });
      await classificarUma(pendentes[i]);
      if (i < pendentes.length - 1 && !stopRef.current) {
        await new Promise(r => setTimeout(r, DELAY_MIG_MS));
      }
    }

    addLog("Migração concluída! Clique em Atualizar para ver os novos contextos.", "sucesso");
    setMigrando(false);
    setProgMig({ atual: 0, total: 0 });
  };

  // ── GERAR: resumo contextualizado para UMA combinação ─────────────────────
  const gerarUm = useCallback(async (tema_mestre, subcontexto_clinico, materia) => {
    const key   = toDocId(tema_mestre, subcontexto_clinico);
    const label = subcontexto_clinico ? `${tema_mestre} [${subcontexto_clinico}]` : tema_mestre;
    setGerandoKey(key);
    addLog(`Gerando: ${label}...`, "info");
    try {
      const contextoTexto = subcontexto_clinico
        ? `Contexto clínico OBRIGATÓRIO: "${subcontexto_clinico}" — todo o conteúdo deve ser específico para este contexto.`
        : "Contexto: adulto padrão.";

      const resp = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: PROMPT_RESUMO,
          prompt: `Tema: "${tema_mestre}"\n${contextoTexto}\nÁrea: ${materia || "Medicina Geral"}`,
        }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data  = await resp.json();
      const texto = data?.content?.[0]?.text || data?.text || "";
      if (!texto) throw new Error("Resposta vazia");

      const parsed = extrairJSON(texto);
      if (!parsed.pontos?.length) throw new Error("Pontos ausentes no JSON");

      await setDoc(doc(db, "teorias", key), {
        tema_mestre,
        subcontexto_clinico: subcontexto_clinico || "",
        titulo:  parsed.titulo || label,
        materia: materia || "Geral",
        pontos:  parsed.pontos,
        geradoEm: serverTimestamp(),
        versao: 2,
      });

      setExistentes(prev => new Set([...prev, key]));
      addLog(`✓ ${label}`, "sucesso");
    } catch (e) {
      addLog(`✗ ${label}: ${e.message}`, "erro");
    } finally {
      setGerandoKey(null);
    }
  }, [addLog]);

  const gerarFaltantes = async () => {
    const pendentes = temas.filter(t => !existentes.has(t.key));
    if (pendentes.length === 0) { addLog("Nenhum resumo pendente.", "info"); return; }

    stopRef.current = false;
    setGerando(true);
    setProgGer({ atual: 0, total: pendentes.length });
    addLog(`Gerando em lote: ${pendentes.length} resumos`, "info");

    for (let i = 0; i < pendentes.length; i++) {
      if (stopRef.current) { addLog("Geração interrompida.", "aviso"); break; }
      setProgGer({ atual: i + 1, total: pendentes.length });
      const t = pendentes[i];
      await gerarUm(t.tema_mestre, t.subcontexto_clinico, t.materia);
      if (i < pendentes.length - 1 && !stopRef.current) {
        addLog(`Aguardando ${DELAY_GER_MS / 1000}s...`, "info");
        await new Promise(r => setTimeout(r, DELAY_GER_MS));
      }
    }

    addLog("Geração em lote concluída!", "sucesso");
    setGerando(false);
    setProgGer({ atual: 0, total: 0 });
  };

  // ── EXCLUIR ───────────────────────────────────────────────────────────────
  const excluir = async (key, label) => {
    if (!window.confirm(`Excluir resumo de "${label}"?`)) return;
    try {
      await deleteDoc(doc(db, "teorias", key));
      setExistentes(prev => { const s = new Set(prev); s.delete(key); return s; });
      addLog(`Excluído: ${label}`, "aviso");
    } catch (e) { addLog(`Erro: ${e.message}`, "erro"); }
  };

  // ── DADOS DERIVADOS ───────────────────────────────────────────────────────
  const questoesSemContexto = useMemo(() => questoes.filter(q => !q.subcontexto_clinico), [questoes]);
  const materias  = useMemo(() => ["Todas", ...new Set(temas.map(t => t.materia).filter(Boolean))], [temas]);
  const contextos = useMemo(() => ["Todos", ...new Set(temas.map(t => t.subcontexto_clinico).filter(Boolean))], [temas]);

  const temasFiltrados = useMemo(() => temas.filter(t => {
    if (filtroStatus === "gerado"   && !existentes.has(t.key)) return false;
    if (filtroStatus === "pendente" && existentes.has(t.key))  return false;
    if (filtroMat !== "Todas" && t.materia !== filtroMat) return false;
    if (filtroCtx !== "Todos" && t.subcontexto_clinico !== filtroCtx) return false;
    if (busca && !t.tema_mestre.toLowerCase().includes(busca.toLowerCase())) return false;
    return true;
  }), [temas, existentes, filtroStatus, filtroMat, filtroCtx, busca]);

  const totalGerados  = temas.filter(t => existentes.has(t.key)).length;
  const totalPendente = temas.length - totalGerados;
  const pct = temas.length > 0 ? Math.round((totalGerados / temas.length) * 100) : 0;

  // ─── RENDER ──────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "24px", color: "#f1f5f9", fontFamily: "system-ui, sans-serif" }}>

      {/* ── HEADER ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "900" }}>
            <FaBookOpen color="#818cf8" style={{ marginRight: "10px" }} />
            Banco de Resumos — tema × contexto clínico
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#475569" }}>
            Resumos contextualizados: "Hipertensão arterial [gestante]" é diferente de "Hipertensão arterial [adulto]"
          </p>
        </div>
        <button onClick={carregar} disabled={loading} style={btnStyle("#4f46e5", loading)}>
          <FaSync size={12} style={{ animation: loading ? "spin 0.8s linear infinite" : "none" }} />
          {carregado ? "Atualizar" : "Carregar Dados"}
        </button>
      </div>

      {/* ── BLOCO MIGRAÇÃO ── */}
      {carregado && questoesSemContexto.length > 0 && (
        <div style={{
          background: "#140a0a", border: "1px solid rgba(239,68,68,0.4)", borderRadius: "14px",
          padding: "18px 20px", marginBottom: "20px",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <p style={{ margin: 0, fontSize: "13px", fontWeight: "800", color: "#fca5a5" }}>
                <FaExclamationTriangle color="#ef4444" style={{ marginRight: "8px" }} />
                {questoesSemContexto.length} questões sem contexto clínico classificado
              </p>
              <p style={{ margin: "6px 0 0", fontSize: "11px", color: "#7f1d1d", lineHeight: 1.6 }}>
                A IA vai ler cada enunciado e identificar automaticamente: idade, sexo e cenário clínico.
                <br />Isso corrige associações incorretas como "Hipertensão → apenas Ginecologia".
                {migrando && progMig.total > 0 && (
                  <strong style={{ color: "#fca5a5" }}> — {progMig.atual}/{progMig.total} processadas</strong>
                )}
              </p>
            </div>
            {migrando ? (
              <button onClick={() => { stopRef.current = true; }} style={btnStyle("#ef4444")}>
                <FaStop size={10} /> Interromper
              </button>
            ) : (
              <button onClick={migrarTodas} style={btnStyle("#ef4444")}>
                <FaRobot size={11} /> Classificar com IA ({questoesSemContexto.length} questões)
              </button>
            )}
          </div>
          {migrando && progMig.total > 0 && (
            <div style={{ marginTop: "12px", background: "#1e293b", borderRadius: "100px", height: "4px", overflow: "hidden" }}>
              <div style={{ height: "100%", background: "#ef4444", borderRadius: "100px", width: `${(progMig.atual / progMig.total) * 100}%`, transition: "width 0.4s ease" }} />
            </div>
          )}
        </div>
      )}

      {/* ── STATS ── */}
      {carregado && (
        <>
          <div style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
            {[
              { label: "Combinações tema×contexto", val: temas.length,    cor: "#818cf8" },
              { label: "Resumos gerados",            val: totalGerados,    cor: "#10b981" },
              { label: "Pendentes",                  val: totalPendente,   cor: "#f59e0b" },
              { label: "Cobertura",                  val: pct + "%",       cor: pct === 100 ? "#10b981" : "#818cf8" },
            ].map(s => (
              <div key={s.label} style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: "12px", padding: "14px 20px", flex: "1", minWidth: "100px", textAlign: "center" }}>
                <p style={{ fontSize: "22px", fontWeight: "900", color: s.cor, margin: 0 }}>{s.val}</p>
                <p style={{ fontSize: "10px", color: "#475569", margin: "4px 0 0" }}>{s.label}</p>
              </div>
            ))}
          </div>

          <div style={{ marginBottom: "20px" }}>
            <div style={{ background: "#1e293b", borderRadius: "100px", height: "6px", overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: "100px", width: pct + "%", transition: "width 0.6s ease", background: pct === 100 ? "#10b981" : "linear-gradient(90deg, #4f46e5, #818cf8)" }} />
            </div>
            <p style={{ fontSize: "10px", color: "#475569", marginTop: "4px" }}>{pct}% dos resumos gerados</p>
          </div>

          {/* Geração em lote */}
          <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: "14px", padding: "16px 20px", marginBottom: "20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <p style={{ margin: 0, fontSize: "13px", fontWeight: "800", color: "#f1f5f9" }}>Geração em lote</p>
              <p style={{ margin: "3px 0 0", fontSize: "11px", color: "#475569" }}>
                {totalPendente} resumos pendentes · {DELAY_GER_MS / 1000}s entre chamadas
                {gerando && progGer.total > 0 && ` · ${progGer.atual}/${progGer.total}`}
              </p>
            </div>
            {gerando ? (
              <button onClick={() => { stopRef.current = true; }} style={btnStyle("#ef4444")}>
                <FaStop size={10} /> Interromper
              </button>
            ) : (
              <button onClick={gerarFaltantes} disabled={totalPendente === 0} style={btnStyle(totalPendente === 0 ? "#1e293b" : "#10b981", totalPendente === 0)}>
                <FaRobot size={11} />
                {totalPendente === 0 ? "Tudo gerado ✓" : `Gerar Faltantes (${totalPendente})`}
              </button>
            )}
          </div>

          {/* Filtros */}
          <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#0f172a", border: "1px solid #1e293b", borderRadius: "10px", padding: "8px 14px", flex: 1, minWidth: "160px" }}>
              <FaSearch size={11} color="#475569" />
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar tema..."
                style={{ background: "transparent", border: "none", color: "#f1f5f9", fontSize: "13px", outline: "none", flex: 1 }} />
            </div>
            <select value={filtroMat} onChange={e => setFiltroMat(e.target.value)} style={selStyle}>
              {materias.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={filtroCtx} onChange={e => setFiltroCtx(e.target.value)} style={selStyle}>
              {contextos.map(c => <option key={c} value={c || "sem contexto"}>{c || "sem contexto"}</option>)}
            </select>
            {["todos", "pendente", "gerado"].map(f => (
              <button key={f} onClick={() => setFiltroStatus(f)} style={{
                padding: "8px 14px", borderRadius: "10px", fontSize: "11px", fontWeight: "700", cursor: "pointer",
                background: filtroStatus === f ? (f === "pendente" ? "#f59e0b" : f === "gerado" ? "#10b981" : "#4f46e5") : "#0f172a",
                border: filtroStatus === f ? "none" : "1px solid #1e293b",
                color: filtroStatus === f ? "#fff" : "#64748b"
              }}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {/* Lista de temas */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "20px" }}>
            {temasFiltrados.length === 0 && (
              <p style={{ color: "#475569", textAlign: "center", padding: "32px 0", fontSize: "13px" }}>Nenhum tema encontrado.</p>
            )}
            {temasFiltrados.map(t => {
              const temTeoria    = existentes.has(t.key);
              const esteGerando  = gerandoKey === t.key;
              const corCtx       = COR_CONTEXTO[t.subcontexto_clinico] || "#64748b";
              const label        = t.subcontexto_clinico ? `${t.tema_mestre} — ${t.subcontexto_clinico}` : t.tema_mestre;
              return (
                <div key={t.key} style={{
                  background: "#0f172a",
                  border: `1px solid ${esteGerando ? "#4f46e5" : temTeoria ? "rgba(16,185,129,0.2)" : "#1e293b"}`,
                  borderRadius: "12px", padding: "12px 16px",
                  display: "flex", alignItems: "center", gap: "12px",
                  boxShadow: esteGerando ? "0 0 0 1px rgba(79,70,229,0.3)" : "none"
                }}>
                  <div style={{ flexShrink: 0 }}>
                    {esteGerando
                      ? <FaSync size={12} color="#818cf8" style={{ animation: "spin 0.8s linear infinite" }} />
                      : temTeoria ? <FaCheckCircle size={12} color="#10b981" /> : <FaClock size={12} color="#f59e0b" />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: "13px", fontWeight: "700", color: "#f1f5f9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t.tema_mestre}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "3px" }}>
                      <span style={{ fontSize: "10px", color: "#475569" }}>{t.materia}</span>
                      {t.subcontexto_clinico
                        ? <span style={{ fontSize: "9px", fontWeight: "800", padding: "2px 8px", borderRadius: "5px", background: `${corCtx}18`, color: corCtx, border: `1px solid ${corCtx}30` }}>{t.subcontexto_clinico}</span>
                        : <span style={{ fontSize: "9px", color: "#ef4444", fontWeight: "700" }}>⚠ sem contexto</span>
                      }
                      <span style={{ fontSize: "10px", color: "#334155" }}>· {t.qtd}q</span>
                    </div>
                  </div>
                  <span style={{ padding: "3px 10px", borderRadius: "6px", fontSize: "10px", fontWeight: "700", flexShrink: 0, background: temTeoria ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.1)", color: temTeoria ? "#10b981" : "#f59e0b" }}>
                    {temTeoria ? "Gerado" : "Pendente"}
                  </span>
                  <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                    <button
                      onClick={() => gerarUm(t.tema_mestre, t.subcontexto_clinico, t.materia)}
                      disabled={gerando || migrando || esteGerando}
                      style={{
                        background: temTeoria ? "rgba(79,70,229,0.1)" : "rgba(16,185,129,0.1)",
                        border: `1px solid ${temTeoria ? "rgba(79,70,229,0.2)" : "rgba(16,185,129,0.2)"}`,
                        color: temTeoria ? "#818cf8" : "#10b981",
                        borderRadius: "8px", padding: "6px 10px", fontSize: "11px", fontWeight: "700",
                        cursor: (gerando || migrando) ? "not-allowed" : "pointer",
                        opacity: (gerando || migrando) && !esteGerando ? 0.4 : 1,
                        display: "flex", alignItems: "center", gap: "5px"
                      }}
                    >
                      <FaRobot size={10} /> {temTeoria ? "Re-gerar" : "Gerar"}
                    </button>
                    {temTeoria && (
                      <button onClick={() => excluir(t.key, label)} disabled={gerando || migrando}
                        style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", color: "#ef4444", borderRadius: "8px", padding: "6px 8px", cursor: "pointer", opacity: (gerando || migrando) ? 0.4 : 1 }}>
                        <FaTrash size={10} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── ESTADO INICIAL ── */}
      {!carregado && !loading && (
        <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: "16px", padding: "48px 32px", textAlign: "center" }}>
          <FaBookOpen size={36} color="#1e293b" style={{ marginBottom: "16px" }} />
          <p style={{ color: "#475569", fontSize: "15px", fontWeight: "700", margin: "0 0 8px" }}>Banco de Resumos vazio</p>
          <p style={{ color: "#334155", fontSize: "12px", lineHeight: 1.7, margin: 0 }}>
            Clique em <strong style={{ color: "#818cf8" }}>Carregar Dados</strong> para escanear as questões.
          </p>
        </div>
      )}

      {/* ── LOGS ── */}
      {logs.length > 0 && (
        <div style={{ background: "#020617", border: "1px solid #1e293b", borderRadius: "12px", overflow: "hidden" }}>
          <button onClick={() => setExpandedLogs(e => !e)} style={{ width: "100%", background: "transparent", border: "none", color: "#64748b", padding: "10px 16px", fontSize: "12px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>Log de execução ({logs.length})</span>
            {expandedLogs ? <FaChevronUp size={10} /> : <FaChevronDown size={10} />}
          </button>
          {expandedLogs && (
            <div ref={logRef} style={{ maxHeight: "200px", overflowY: "auto", padding: "8px 16px 12px", display: "flex", flexDirection: "column", gap: "3px" }}>
              {logs.map((l, i) => (
                <p key={i} style={{ margin: 0, fontSize: "11px", lineHeight: 1.5, fontFamily: "monospace",
                  color: l.tipo === "sucesso" ? "#10b981" : l.tipo === "erro" ? "#ef4444" : l.tipo === "aviso" ? "#f59e0b" : "#64748b" }}>
                  <span style={{ color: "#334155" }}>[{l.hora}]</span> {l.msg}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

// ── Helpers de estilo ─────────────────────────────────────────────────────────
const btnStyle = (bg, disabled = false) => ({
  background: disabled ? "#1e293b" : bg, border: "none",
  color: disabled ? "#475569" : "#fff", borderRadius: "10px",
  padding: "10px 18px", fontWeight: "700", fontSize: "13px",
  cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1,
  display: "flex", alignItems: "center", gap: "8px"
});

const selStyle = {
  background: "#0f172a", border: "1px solid #1e293b", borderRadius: "10px",
  color: "#94a3b8", fontSize: "12px", padding: "8px 14px", cursor: "pointer"
};

export default ResumoGerador;
