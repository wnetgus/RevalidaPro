/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useMemo } from "react";
import { db } from "../firebase";
import {
  collection, onSnapshot, getDocs, query, orderBy, doc,
  updateDoc, writeBatch, deleteDoc, arrayUnion, serverTimestamp, addDoc, setDoc
} from "firebase/firestore";
import {
  FaUsers, FaDatabase, FaQuestionCircle, FaBan, FaCrown,
  FaUserShield, FaTrash, FaReply, FaSearch, FaUserGraduate,
  FaFilePdf, FaPlus, FaCircle, FaUserEdit, FaLayerGroup, FaCheckDouble,
  FaEdit, FaSave, FaTimes, FaImage, FaTag, FaBookOpen, FaMoneyBillWave,
  FaChartLine, FaRocket, FaStar, FaToggleOn, FaToggleOff, FaClone,
  FaCommentDots, FaPaperPlane, FaUserMd, FaChevronLeft
} from "react-icons/fa";
import ImportadorPro from "../components/ImportadorPro";
import RoboGerador from "../components/RoboGerador";
import ResumoGerador from "../components/ResumoGerador";

const PLANOS_PADRAO = [
  { id: "teste", nome: "Teste Grátis", dias: 2, preco: 0, descricao: "48h para conhecer a plataforma", destaque: false, cor: "#10b981", ativo: true },
  { id: "basico30", nome: "30 Dias", dias: 30, preco: 79.99, descricao: "Acesso completo por 30 dias", destaque: false, cor: "#818cf8", ativo: true },
  { id: "trimestral", nome: "90 Dias", dias: 90, preco: 209.99, descricao: "Melhor custo-benefício", destaque: false, cor: "#818cf8", ativo: true },
  { id: "drplus", nome: "180 Dias — Dr. Plus", dias: 180, preco: 359.99, descricao: "Premium liberado", destaque: true, cor: "#fbbf24", ativo: true },
  { id: "crmpro", nome: "360 Dias — CRM PRO", dias: 360, preco: 599.99, descricao: "Premium total + bônus", destaque: false, cor: "#6366f1", ativo: true },
];

// ─── CONSTANTES E HELPERS — MÓDULO ───────────────────────────────────────────
const EMAILS_MESTRE = ["drweynesouza@gmail.com", "wnetgus@gmail.com"];
const EMAIL_MESTRE  = EMAILS_MESTRE[0]; // alias de compatibilidade

/**
 * Considera "online" qualquer usuário cuja ultimaAtividade
 * foi registrada há menos de ONLINE_THRESHOLD_MS.
 * Mais confiável do que o campo `online: true/false` (que fica stale
 * se o usuário fechar o navegador sem fazer logout explícito).
 */
const ONLINE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutos

const isOnlineRecente = (u) => {
  const raw = u.ultimaAtividade;
  let ts = null;
  if (raw?.toDate) ts = raw.toDate().getTime();
  else if (raw instanceof Date) ts = raw.getTime();
  else if (typeof raw === "number") ts = raw;
  return ts !== null && Date.now() - ts < ONLINE_THRESHOLD_MS;
};

/**
 * Classifica um usuário em uma das 6 categorias da hierarquia:
 * master → admin → colaborador → premium → ativo → expirado
 */
const classificarUsuario = (u) => {
  if (EMAILS_MESTRE.includes(u.email)) return "master";
  if (u.role === "admin") return "admin";
  if (u.role === "colaborador") return "colaborador";
  let exp = null;
  const raw = u.dataExpiracao;
  if (raw?.toDate) exp = raw.toDate();
  else if (raw instanceof Date) exp = raw;
  const temAcesso = exp && exp > new Date() && !u.bloqueado;
  if (temAcesso && u.status === "pago") return "premium";
  if (temAcesso) return "ativo";
  return "expirado";
};

const ORDEM_HIERARQUIA = { master: 0, admin: 1, colaborador: 2, premium: 3, ativo: 4, expirado: 5 };

const GRUPOS_USUARIOS = [
  { classe: "master",      emoji: "👑", label: "Admin Master",            cor: "#fbbf24", filtroKey: "Admin"     },
  { classe: "admin",       emoji: "🛡️", label: "Administradores",         cor: "#60a5fa", filtroKey: "Admin"     },
  { classe: "colaborador", emoji: "🛠️", label: "Colaboradores",           cor: "#818cf8", filtroKey: "Admin"     },
  { classe: "premium",     emoji: "💎", label: "Alunos Premium",          cor: "#c084fc", filtroKey: "Premium"   },
  { classe: "ativo",       emoji: "🟢", label: "Alunos Ativos",           cor: "#10b981", filtroKey: "Ativos"    },
  { classe: "expirado",    emoji: "🔴", label: "Expirados / Sem Acesso",  cor: "#ef4444", filtroKey: "Expirados" },
];

const BADGE_CLASSE = {
  master:      { label: "ADMIN MASTER", cor: "#fbbf24" },
  admin:       { label: "ADMIN",        cor: "#60a5fa" },
  colaborador: { label: "COLABORADOR",  cor: "#818cf8" },
  premium:     { label: "PREMIUM",      cor: "#c084fc" },
  ativo:       { label: "ATIVO",        cor: "#10b981" },
  expirado:    { label: "EXPIRADO",     cor: "#ef4444" },
};
// ─────────────────────────────────────────────────────────────────────────────

const AdminPainel = () => {
  const [aba, setAba] = useState("dashboard");
  const [usuarios, setUsuarios] = useState([]);
  const [duvidas, setDuvidas] = useState([]);
  const [questoes, setQuestoes] = useState([]);
  const [materiais, setMateriais] = useState([]);
  const [planos, setPlanos] = useState([]);
  const [selecionadas, setSelecionadas] = useState([]);
  
  const [busca, setBusca] = useState("");
  const [filtroMateria, setFiltroMateria] = useState("Todas");
  const [filtroSubtema, setFiltroSubtema] = useState("Todos");
  const [_filtroTipo, _setFiltroTipo] = useState("Todos"); // mantido por compatibilidade
  const [filtroAno, setFiltroAno] = useState("Todos");
  // ─── FILTROS MÓDULO (Super Apostas + INEP + Banco Geral) ─────────────────
  const [filtroModulo, setFiltroModulo]   = useState("Todos"); // "Todos"|"inep"|"banco_geral"|"super_apostas"
  const [filtroEdicao, setFiltroEdicao]   = useState("Todas"); // edição do super_apostas
  const [filtroNivel, setFiltroNivel]     = useState("Todos"); // nivel_aposta
  const [filtroStatus, setFiltroStatus]   = useState("Todos"); // "Todos"|"atual"|"revisar"
  const [buscaDuvida, setBuscaDuvida] = useState("");
  
  const [questaoVisualizada, setQuestaoVisualizada] = useState(null);
  const [visualizarQuestaoId, setVisualizarQuestaoId] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [dadosEdit, setDadosEdit] = useState({});
  const [editandoMatId, setEditandoMatId] = useState(null);
  const [dadosEditMat, setDadosEditMat] = useState({});
  
  const [novoMaterialNome, setNovoMaterialNome] = useState("");
  const [novoMaterialLink, setNovoMaterialLink] = useState("");
  const [novoMaterialCategoria, setNovoMaterialCategoria] = useState("Estudo");

  // ESTADOS DOS PLANOS
  const [editandoPlano, setEditandoPlano] = useState(null);
  const [dadosEditPlano, setDadosEditPlano] = useState({});
  const [criandoPlano, setCriandoPlano] = useState(false);
  const [novoPlano, setNovoPlano] = useState({ nome: "", dias: 30, preco: 0, descricao: "", destaque: false, cor: "#818cf8", ativo: true });
  const [salvandoPlano, setSalvandoPlano] = useState(false);

  // ESTADOS DO CHAT GRUPO
  const [mensagensSala, setMensagensSala] = useState([]);
  const [textoSala, setTextoSala] = useState("");
  const [enviandoSala, setEnviandoSala] = useState(false);
  const bottomSalaRef = React.useRef(null);

  // Controle de carregamento
  const [carregando, setCarregando] = useState(false);
  const [questoesCarregadas, setQuestoesCarregadas] = useState(false);

  // Filtro de hierarquia na aba Médicos
  const [filtroUsuariosStatus, setFiltroUsuariosStatus] = useState("Todos");

  // ── CARGA INICIAL: getDocs (uma única leitura, sem listener contínuo) ───────
  const carregarDados = async () => {
    setCarregando(true);
    try {
      const [snapU, snapM, snapP, snapD] = await Promise.all([
        getDocs(collection(db, "usuarios")),
        getDocs(collection(db, "materiais")),
        getDocs(collection(db, "planos")),
        getDocs(query(collection(db, "duvidas_questoes"), orderBy("respondida", "asc"))),
      ]);

      setUsuarios(snapU.docs.map(d => ({ id: d.id, ...d.data() })));
      setMateriais(snapM.docs.map(d => ({ id: d.id, ...d.data() })));

      if (snapP.empty) {
        await inicializarPlanosPadrao();
      } else {
        const planosData = snapP.docs.map(d => ({ id: d.id, ...d.data() }));
        planosData.sort((a, b) => (a.preco || 0) - (b.preco || 0));
        setPlanos(planosData);
      }

      const docs = snapD.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => {
        if (a.respondida === b.respondida) {
          const timeA = a.criadoEm?.seconds || a.dataEnvio?.seconds || 0;
          const timeB = b.criadoEm?.seconds || b.dataEnvio?.seconds || 0;
          return timeB - timeA;
        }
        return 0;
      });
      setDuvidas(docs);
    } catch (e) {
      console.error("Erro ao carregar dados admin:", e);
    }
    setCarregando(false);
  };

  // ── QUESTÕES: carregamento preguiçoso — só quando abre a aba "banco" ────────
  const carregarQuestoes = async () => {
    try {
      const snap = await getDocs(collection(db, "questoes"));
      // FIX: { ...d.data(), id: d.id } — d.id sempre vence, mesmo que o documento
      // tenha um campo "id" corrompido (ex: "2025" em vez do ID completo).
      // Antes estava { id: d.id, ...d.data() } que permitia d.data() sobrescrever o id.
      setQuestoes(snap.docs.map(d => ({ ...d.data(), id: d.id })));
      setQuestoesCarregadas(true);
    } catch (e) {
      console.error("Erro ao carregar questões:", e);
    }
  };
  useEffect(() => { carregarDados(); }, []);

  // ── Auto-refresh a cada 5 min para manter contagem online atualizada ──────
  // Sincronizado com o heartbeat do cliente (que escreve a cada 5 min).
  // Custo: apenas 1 getDocs de usuários por intervalo — insignificante.
  useEffect(() => {
    const REFRESH_MS = 5 * 60 * 1000;
    const id = setInterval(async () => {
      try {
        const snap = await getDocs(collection(db, "usuarios"));
        setUsuarios(snap.docs.map(d => ({ ...d.data(), id: d.id })));
      } catch { /* noop */ }
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  // Carrega questões apenas quando a aba banco é aberta pela primeira vez
  useEffect(() => {
    if (aba === "banco" && !questoesCarregadas) {
      carregarQuestoes();
    }
  }, [aba, questoesCarregadas]);

  // Escuta sala_chat últimas 24h em tempo real
  useEffect(() => {
    const unsubSala = onSnapshot(collection(db, "sala_chat"), (snap) => {
      const limite = Date.now() - 24 * 60 * 60 * 1000;
      const lista = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(m => {
          const ts = m.criadoEm?.seconds ? m.criadoEm.seconds * 1000 : (m.criadoEm?.toDate ? m.criadoEm.toDate().getTime() : 0);
          return ts >= limite;
        })
        .sort((a, b) => (a.criadoEm?.seconds || 0) - (b.criadoEm?.seconds || 0));
      setMensagensSala(lista);
    }, () => {});
    return () => unsubSala();
  }, []);

  // Auto-scroll no chat sala
  useEffect(() => {
    if (bottomSalaRef.current) {
      bottomSalaRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [mensagensSala]);

  const inicializarPlanosPadrao = async () => {
    try {
      for (const plano of PLANOS_PADRAO) {
        await setDoc(doc(db, "planos", plano.id), {
          ...plano,
          criadoEm: serverTimestamp(),
          atualizadoEm: serverTimestamp()
        });
      }
      // Define estado localmente — evita nova leitura ao Firestore
      setPlanos([...PLANOS_PADRAO].sort((a, b) => (a.preco || 0) - (b.preco || 0)));
    } catch (e) { console.error("Erro ao inicializar planos:", e); }
  };

  // ============================================================
  // FUNÇÕES ORIGINAIS PRESERVADAS
  // ============================================================

  /**
   * Lista de usuários classificados, filtrados por busca + filtroUsuariosStatus
   * e ordenados pela hierarquia ORDEM_HIERARQUIA.
   * Cada item recebe a propriedade extra `_classe` para uso no JSX.
   */
  const usuariosFiltrados = useMemo(() => {
    return [...usuarios]
      .map(u => ({ ...u, _classe: classificarUsuario(u) }))
      .filter(u => {
        const matchBusca = !busca ||
          u.nome?.toLowerCase().includes(busca.toLowerCase()) ||
          u.email?.toLowerCase().includes(busca.toLowerCase());
        const matchFiltro =
          filtroUsuariosStatus === "Todos" ||
          (filtroUsuariosStatus === "Admin"     && ["master","admin","colaborador"].includes(u._classe)) ||
          (filtroUsuariosStatus === "Premium"   && u._classe === "premium")   ||
          (filtroUsuariosStatus === "Ativos"    && u._classe === "ativo")     ||
          (filtroUsuariosStatus === "Expirados" && u._classe === "expirado");
        return matchBusca && matchFiltro;
      })
      .sort((a, b) => (ORDEM_HIERARQUIA[a._classe] ?? 99) - (ORDEM_HIERARQUIA[b._classe] ?? 99));
  }, [usuarios, busca, filtroUsuariosStatus]);

  // ─── Helper: detecta o módulo de uma questão ─────────────────────────────
  // Questões antigas não têm o campo "modulo" — a detecção é retrocompatível:
  //   super_apostas → campo explícito
  //   inep          → isOficial true OU provaId não vazio OU instituicao INEP
  //   banco_geral   → tudo o mais
  const getModuloQuestao = (q) => {
    if (q.modulo === "super_apostas") return "super_apostas";
    if (q.isOficial === true || (q.provaId && q.provaId !== "") || q.instituicao === "INEP") return "inep";
    return "banco_geral";
  };

  const questoesFiltradas = useMemo(() => {
    return questoes.filter(q => {
      const modulo = getModuloQuestao(q);
      const enunciadoLimpo = q.enunciado?.toLowerCase() || "";
      const matchBusca   = enunciadoLimpo.includes(busca.toLowerCase());
      const matchMat     = filtroMateria === "Todas"  || q.materia      === filtroMateria;
      const matchSub     = filtroSubtema === "Todos"  || q.subtema      === filtroSubtema;
      const matchAno     = filtroAno     === "Todos"  || q.ano          === filtroAno;
      const matchModulo  = filtroModulo  === "Todos"  || modulo              === filtroModulo;
      const matchEdicao  = filtroEdicao  === "Todas"  || q.edicao            === filtroEdicao;
      const matchNivel   = filtroNivel   === "Todos"  || q.nivel_aposta      === filtroNivel;
      const matchStatus  = filtroStatus  === "Todos"  || (q.status_atualizacao || "revisar") === filtroStatus;
      return matchBusca && matchMat && matchSub && matchAno && matchModulo && matchEdicao && matchNivel && matchStatus;
    });
  }, [questoes, busca, filtroMateria, filtroSubtema, filtroAno, filtroModulo, filtroEdicao, filtroNivel, filtroStatus]);

  const atualizarPrazo = async (id, valorHorasOuDias, tipo, nomePlano = "") => {
    const exp = new Date();
    if (tipo === "free") exp.setHours(exp.getHours() + parseInt(valorHorasOuDias));
    else exp.setDate(exp.getDate() + parseInt(valorHorasOuDias));
    const ehPremium = tipo === "pago" && parseInt(valorHorasOuDias) >= 180;
    await updateDoc(doc(db, "usuarios", id), { 
      dataExpiracao: exp, 
      status: ehPremium ? "pago" : "basic", 
      planoAtivo: tipo === "free" ? `Teste ${valorHorasOuDias}h` : nomePlano,
      bloqueado: false 
    });
    alert("Acesso atualizado!");
  };

  const ativarPlanoPorId = async (usuarioId, plano) => {
    const exp = new Date();
    exp.setDate(exp.getDate() + plano.dias);
    await updateDoc(doc(db, "usuarios", usuarioId), {
      dataExpiracao: exp,
      status: plano.dias >= 180 ? "pago" : "basic",
      planoAtivo: plano.nome,
      bloqueado: false
    });
    alert(`Plano "${plano.nome}" ativado com sucesso!`);
  };

  const alternarCargo = async (u) => {
    if (EMAILS_MESTRE.includes(u.email)) return;
    const proximosCargos = { aluno: "colaborador", colaborador: "admin", admin: "aluno" };
    await updateDoc(doc(db, "usuarios", u.id), { role: proximosCargos[u.role] || "aluno" });
  };

  const alternarBloqueio = async (u) => {
    if (EMAILS_MESTRE.includes(u.email)) return;
    const isBanned = !u.bloqueado;
    await updateDoc(doc(db, "usuarios", u.id), { 
      bloqueado: isBanned,
      status: isBanned ? "banido" : "ativo" 
    });
  };

  const salvarEdicao = async (id) => {
    try {
      await updateDoc(doc(db, "questoes", id), dadosEdit);
      setEditandoId(null);
      alert("Questão atualizada com sucesso!");
    } catch { alert("Erro ao atualizar."); }
  };

  const salvarEdicaoMaterial = async (id) => {
    try {
      await updateDoc(doc(db, "materiais", id), dadosEditMat);
      setEditandoMatId(null);
      alert("Material atualizado!");
    } catch { alert("Erro ao atualizar material."); }
  };

  const deletarEmMassa = async () => {
    if (window.confirm(`Excluir ${selecionadas.length} questões?`)) {
      const batch = writeBatch(db);
      selecionadas.forEach(id => batch.delete(doc(db, "questoes", id)));
      await batch.commit();
      setSelecionadas([]);
    }
  };

  const enviarResposta = async (d) => {
    const respEl = document.getElementById(`resp-${d.id}`);
    if (!respEl.value.trim()) return alert("Digite a conduta médica!");
    await updateDoc(doc(db, "duvidas_questoes", d.id), {
      mensagens: arrayUnion({ remetente: "admin", texto: respEl.value, data: new Date().toISOString() }),
      respondida: true,
      status: "respondida",
      visualizadaPeloAluno: false 
    });
    respEl.value = "";
    alert("Resposta enviada com sucesso!");
  };

  const enviarMensagemSala = async () => {
    const textoTrimmed = textoSala.trim();
    if (!textoTrimmed || enviandoSala) return;
    setEnviandoSala(true);
    setTextoSala("");
    try {
      await addDoc(collection(db, "sala_chat"), {
        texto: textoTrimmed,
        autorId: "admin",
        autorNome: "Preceptor",
        autorRole: "admin",
        criadoEm: serverTimestamp(),
        remetente: "admin",
      });
    } catch (e) { console.error("Erro ao enviar mensagem sala:", e); }
    setEnviandoSala(false);
  };

  const deletarMensagemSala = async (id) => {
    await deleteDoc(doc(db, "sala_chat", id)).catch(() => {});
  };

  const adicionarMaterial = async () => {
    if (!novoMaterialNome || !novoMaterialLink) return;
    await addDoc(collection(db, "materiais"), { nome: novoMaterialNome, link: novoMaterialLink, categoria: novoMaterialCategoria, criadoEm: serverTimestamp() });
    setNovoMaterialNome(""); setNovoMaterialLink("");
  };

  // ============================================================
  // FUNÇÕES DE PLANOS (NOVAS)
  // ============================================================
  const salvarEdicaoPlano = async () => {
    if (!dadosEditPlano.nome || !dadosEditPlano.dias) return alert("Preencha nome e dias.");
    setSalvandoPlano(true);
    try {
      await updateDoc(doc(db, "planos", editandoPlano), {
        ...dadosEditPlano,
        dias: Number(dadosEditPlano.dias),
        preco: Number(dadosEditPlano.preco),
        atualizadoEm: serverTimestamp()
      });
      setEditandoPlano(null);
      alert("✅ Plano atualizado! O modal de assinatura já reflete a mudança.");
    } catch { alert("Erro ao salvar plano."); }
    setSalvandoPlano(false);
  };

  const criarNovoPlano = async () => {
    if (!novoPlano.nome || !novoPlano.dias) return alert("Preencha nome e dias.");
    setSalvandoPlano(true);
    try {
      const id = novoPlano.nome.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
      await setDoc(doc(db, "planos", id), {
        ...novoPlano,
        dias: Number(novoPlano.dias),
        preco: Number(novoPlano.preco),
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp()
      });
      setNovoPlano({ nome: "", dias: 30, preco: 0, descricao: "", destaque: false, cor: "#818cf8", ativo: true });
      setCriandoPlano(false);
      alert("✅ Novo plano criado com sucesso!");
    } catch { alert("Erro ao criar plano."); }
    setSalvandoPlano(false);
  };

  const toggleAtivo = async (plano) => {
    await updateDoc(doc(db, "planos", plano.id), { ativo: !plano.ativo, atualizadoEm: serverTimestamp() });
  };

  const excluirPlano = async (plano) => {
    if (window.confirm(`Excluir o plano "${plano.nome}"? Esta ação não pode ser desfeita.`)) {
      await deleteDoc(doc(db, "planos", plano.id));
    }
  };

  // MÉTRICAS DASHBOARD
  const _receitaMensal = useMemo(() => {
    return usuarios.filter(u => u.status === "pago").length * 150;
  }, [usuarios]);

  const alunosAtivos = useMemo(() => {
    return usuarios.filter(u => {
      const exp = u.dataExpiracao?.toDate ? u.dataExpiracao.toDate() : null;
      return exp && exp > new Date() && !u.bloqueado;
    }).length;
  }, [usuarios]);

  return (
    <div style={st.container}>
      {/* HEADER PREMIUM */}
      <header style={st.headerAdmin}>
        <div>
          <h2 style={st.headerTitle}>
            Centro de Comando
            <span style={st.badgeStatus}>MESTRE</span>
          </h2>
          <p style={st.headerSub}>RevalidaPro · Painel Administrativo</p>
        </div>
        <div style={{...st.headerStats, alignItems: "center"}}>
          <div style={st.headerStat}>
            <span style={st.headerStatNum}>{usuarios.filter(u=>isOnlineRecente(u)).length}</span>
            <span style={st.headerStatLabel}>Online</span>
          </div>
          <div style={{...st.headerStat, borderColor: "#10b981"}}>
            <span style={{...st.headerStatNum, color: "#10b981"}}>{alunosAtivos}</span>
            <span style={st.headerStatLabel}>Ativos</span>
          </div>
          <div style={{...st.headerStat, borderColor: "#ef4444"}}>
            <span style={{...st.headerStatNum, color: "#ef4444"}}>{duvidas.filter(d=>!d.respondida).length}</span>
            <span style={st.headerStatLabel}>Pendentes</span>
          </div>
          <button
            onClick={() => { carregarDados(); if (questoesCarregadas) carregarQuestoes(); }}
            disabled={carregando}
            title="Recarregar dados do servidor"
            style={{
              background: carregando ? "#1e293b" : "rgba(79,70,229,0.15)",
              border: "1px solid rgba(79,70,229,0.4)",
              color: carregando ? "#475569" : "#818cf8",
              borderRadius: "10px", padding: "8px 14px",
              cursor: carregando ? "not-allowed" : "pointer",
              fontSize: "12px", fontWeight: "700",
              display: "flex", alignItems: "center", gap: "6px",
              transition: "all 0.2s"
            }}
          >
            <span style={{ display: "inline-block", animation: carregando ? "spin 1s linear infinite" : "none" }}>🔄</span>
            {carregando ? "..." : "Atualizar"}
          </button>
        </div>
      </header>

      {/* CARDS DE MÉTRICAS */}
      <div style={st.dashboardGrid}>
        <div style={st.cardMetrica}>
          <div style={{...st.metricaIcon, background: "rgba(96,165,250,0.1)"}}><FaUsers color="#60a5fa" size={20}/></div>
          <div>
            <p style={st.metricaLabel}>Total de Médicos</p>
            <h3 style={st.metricaValor}>{usuarios.length}</h3>
          </div>
        </div>
        <div style={st.cardMetrica}>
          <div style={{...st.metricaIcon, background: "rgba(52,211,153,0.1)"}}><FaDatabase color="#34d399" size={20}/></div>
          <div>
            <p style={st.metricaLabel}>Questões no Banco</p>
            <h3 style={st.metricaValor}>{questoesCarregadas ? questoes.length : "—"}</h3>
          </div>
        </div>
        <div style={st.cardMetrica}>
          <div style={{...st.metricaIcon, background: "rgba(239,68,68,0.1)"}}><FaQuestionCircle color="#ef4444" size={20}/></div>
          <div>
            <p style={st.metricaLabel}>Dúvidas Pendentes</p>
            <h3 style={st.metricaValor}>{duvidas.filter(d=>!d.respondida).length}</h3>
          </div>
        </div>
        <div style={st.cardMetrica}>
          <div style={{...st.metricaIcon, background: "rgba(251,191,36,0.1)"}}><FaCrown color="#fbbf24" size={20}/></div>
          <div>
            <p style={st.metricaLabel}>Premium Ativos</p>
            <h3 style={st.metricaValor}>{usuarios.filter(u=>u.status==="pago").length}</h3>
          </div>
        </div>
        <div style={{...st.cardMetrica, borderColor: "rgba(16,185,129,0.3)"}}>
          <div style={{...st.metricaIcon, background: "rgba(16,185,129,0.1)"}}><FaMoneyBillWave color="#10b981" size={20}/></div>
          <div>
            <p style={st.metricaLabel}>Planos Ativos</p>
            <h3 style={{...st.metricaValor, color: "#10b981"}}>{planos.filter(p=>p.ativo).length}</h3>
          </div>
        </div>
        <div style={st.cardMetrica}>
          <div style={{...st.metricaIcon, background: "rgba(129,140,248,0.1)"}}><FaChartLine color="#818cf8" size={20}/></div>
          <div>
            <p style={st.metricaLabel}>Alunos com Acesso</p>
            <h3 style={st.metricaValor}>{alunosAtivos}</h3>
          </div>
        </div>
      </div>

      {/* ABAS */}
      <div style={st.tabMenu}>
        {[
          { id: "dashboard", label: "Dashboard" },
          { id: "usuarios", label: "Médicos" },
          { id: "planos", label: "💳 Planos" },
          { id: "banco", label: "Banco de Questões" },
          { id: "duvidas", label: "Dúvidas", badge: duvidas.filter(d => !d.respondida).length },
          { id: "chat", label: "💬 Sala", badge: mensagensSala.filter(m => m.autorRole !== "admin").length },
          { id: "materiais", label: "Materiais" },
          { id: "importador", label: "Importador" },
          { id: "robo", label: "🤖 Robô" },
          { id: "resumos", label: "📚 Resumos" },
        ].map(item => (
          <button key={item.id} onClick={() => setAba(item.id)} style={aba === item.id ? st.btnActive : st.btn}>
            {item.label}
            {item.badge > 0 && (
              <span className="pulse-badge" style={st.badgeNotificacao}>{item.badge}</span>
            )}
          </button>
        ))}
      </div>

      <div style={st.contentBox}>

        {/* ABA DASHBOARD */}
        {aba === "dashboard" && (
          <div style={st.dashWelcome}>
            <div style={st.welcomeIcon}><FaRocket size={40} color="#4f46e5" /></div>
            <h3 style={{color: "#fff", fontSize: "22px", margin: "20px 0 10px"}}>Olá, Dr. Weyne 👋</h3>
            <p style={{color: "#94a3b8", fontSize: "14px", lineHeight: 1.7}}>
              Painel Master RevalidaPro operacional.<br/>
              Você tem <strong style={{color: "#ef4444"}}>{duvidas.filter(d=>!d.respondida).length} dúvidas</strong> pendentes 
              e <strong style={{color: "#10b981"}}>{alunosAtivos} alunos</strong> com acesso ativo.
            </p>
            <div style={{display: "flex", gap: "12px", justifyContent: "center", marginTop: "24px", flexWrap: "wrap"}}>
              <button onClick={() => setAba("usuarios")} style={st.btnQuickAction}>
                <FaUsers /> Ver Médicos
              </button>
              <button onClick={() => setAba("duvidas")} style={{...st.btnQuickAction, background: "rgba(239,68,68,0.1)", borderColor: "rgba(239,68,68,0.3)", color: "#ef4444"}}>
                <FaQuestionCircle /> Responder Dúvidas
              </button>
              <button onClick={() => setAba("planos")} style={{...st.btnQuickAction, background: "rgba(251,191,36,0.1)", borderColor: "rgba(251,191,36,0.3)", color: "#fbbf24"}}>
                <FaCrown /> Gerenciar Planos
              </button>
            </div>
          </div>
        )}

        {/* ============================================================
            ABA PLANOS — GERENCIAMENTO COMPLETO
        ============================================================ */}
        {aba === "planos" && (
          <div>
            <div style={st.planosHeader}>
              <div>
                <h3 style={{color: "#fff", margin: 0, fontSize: "18px"}}>💳 Gerenciamento de Planos</h3>
                <p style={{color: "#94a3b8", fontSize: "13px", margin: "4px 0 0"}}>
                  Crie, edite preços e gerencie os planos. As alterações aparecem imediatamente no modal de assinatura dos alunos.
                </p>
              </div>
              <button onClick={() => setCriandoPlano(true)} style={st.btnNovo}>
                <FaPlus /> Novo Plano
              </button>
            </div>

            {/* FORM NOVO PLANO */}
            {criandoPlano && (
              <div style={st.planoFormCard}>
                <div style={st.planoFormHeader}>
                  <h4 style={{color: "#fff", margin: 0}}>✨ Criar Novo Plano</h4>
                  <button onClick={() => setCriandoPlano(false)} style={st.btnIconClose}><FaTimes color="#94a3b8"/></button>
                </div>
                <div style={st.planoFormGrid}>
                  <div>
                    <label style={st.formLabel}>Nome do Plano</label>
                    <input value={novoPlano.nome} onChange={e => setNovoPlano({...novoPlano, nome: e.target.value})} placeholder="Ex: Semestral Plus" style={st.formInput}/>
                  </div>
                  <div>
                    <label style={st.formLabel}>Duração (dias)</label>
                    <input type="number" value={novoPlano.dias} onChange={e => setNovoPlano({...novoPlano, dias: e.target.value})} placeholder="30" style={st.formInput}/>
                  </div>
                  <div>
                    <label style={st.formLabel}>Preço (R$)</label>
                    <input type="number" step="0.01" value={novoPlano.preco} onChange={e => setNovoPlano({...novoPlano, preco: e.target.value})} placeholder="0.00" style={st.formInput}/>
                  </div>
                  <div>
                    <label style={st.formLabel}>Cor do Card</label>
                    <div style={{display: "flex", gap: "8px", alignItems: "center"}}>
                      <input type="color" value={novoPlano.cor} onChange={e => setNovoPlano({...novoPlano, cor: e.target.value})} style={{width: "50px", height: "40px", borderRadius: "8px", border: "none", cursor: "pointer", background: "none"}}/>
                      <input value={novoPlano.cor} onChange={e => setNovoPlano({...novoPlano, cor: e.target.value})} style={{...st.formInput, flex: 1}}/>
                    </div>
                  </div>
                  <div style={{gridColumn: "1 / -1"}}>
                    <label style={st.formLabel}>Descrição (aparece no modal)</label>
                    <input value={novoPlano.descricao} onChange={e => setNovoPlano({...novoPlano, descricao: e.target.value})} placeholder="Ex: Acesso premium por 6 meses" style={st.formInput}/>
                  </div>
                  <div style={{display: "flex", alignItems: "center", gap: "10px"}}>
                    <input type="checkbox" id="destaque-novo" checked={novoPlano.destaque} onChange={e => setNovoPlano({...novoPlano, destaque: e.target.checked})} style={{width: "18px", height: "18px"}}/>
                    <label htmlFor="destaque-novo" style={{color: "#fbbf24", fontSize: "13px", fontWeight: "700", cursor: "pointer"}}>⭐ Marcar como Destaque (borda dourada)</label>
                  </div>
                </div>
                <div style={{display: "flex", gap: "10px", marginTop: "16px"}}>
                  <button onClick={criarNovoPlano} disabled={salvandoPlano} style={st.btnSalvarPlano}>
                    <FaSave /> {salvandoPlano ? "Salvando..." : "CRIAR PLANO"}
                  </button>
                  <button onClick={() => setCriandoPlano(false)} style={st.btnCancelar}>Cancelar</button>
                </div>
              </div>
            )}

            {/* LISTA DE PLANOS */}
            <div style={st.planosGrid}>
              {planos.map(plano => (
                <div key={plano.id} style={{
                  ...st.planoCard,
                  borderColor: plano.destaque ? "#fbbf24" : plano.ativo ? "rgba(79,70,229,0.3)" : "#334155",
                  opacity: plano.ativo ? 1 : 0.5
                }}>
                  {plano.destaque && (
                    <div style={st.destaqueTag}>⭐ DESTAQUE</div>
                  )}
                  
                  {editandoPlano === plano.id ? (
                    // FORM DE EDIÇÃO INLINE
                    <div>
                      <div style={st.planoFormGrid}>
                        <div>
                          <label style={st.formLabel}>Nome</label>
                          <input value={dadosEditPlano.nome} onChange={e => setDadosEditPlano({...dadosEditPlano, nome: e.target.value})} style={st.formInput}/>
                        </div>
                        <div>
                          <label style={st.formLabel}>Dias</label>
                          <input type="number" value={dadosEditPlano.dias} onChange={e => setDadosEditPlano({...dadosEditPlano, dias: e.target.value})} style={st.formInput}/>
                        </div>
                        <div>
                          <label style={st.formLabel}>Preço (R$)</label>
                          <input type="number" step="0.01" value={dadosEditPlano.preco} onChange={e => setDadosEditPlano({...dadosEditPlano, preco: e.target.value})} style={st.formInput}/>
                        </div>
                        <div>
                          <label style={st.formLabel}>Cor</label>
                          <div style={{display: "flex", gap: "8px", alignItems: "center"}}>
                            <input type="color" value={dadosEditPlano.cor || "#818cf8"} onChange={e => setDadosEditPlano({...dadosEditPlano, cor: e.target.value})} style={{width: "45px", height: "38px", borderRadius: "8px", border: "none", cursor: "pointer"}}/>
                            <input value={dadosEditPlano.cor || ""} onChange={e => setDadosEditPlano({...dadosEditPlano, cor: e.target.value})} style={{...st.formInput, flex: 1}}/>
                          </div>
                        </div>
                        <div style={{gridColumn: "1 / -1"}}>
                          <label style={st.formLabel}>Descrição</label>
                          <input value={dadosEditPlano.descricao || ""} onChange={e => setDadosEditPlano({...dadosEditPlano, descricao: e.target.value})} style={st.formInput}/>
                        </div>
                        <div style={{display: "flex", alignItems: "center", gap: "10px"}}>
                          <input type="checkbox" id={`dest-${plano.id}`} checked={dadosEditPlano.destaque || false} onChange={e => setDadosEditPlano({...dadosEditPlano, destaque: e.target.checked})} style={{width: "18px", height: "18px"}}/>
                          <label htmlFor={`dest-${plano.id}`} style={{color: "#fbbf24", fontSize: "12px", cursor: "pointer"}}>⭐ Destaque</label>
                        </div>
                      </div>
                      <div style={{display: "flex", gap: "8px", marginTop: "12px"}}>
                        <button onClick={salvarEdicaoPlano} disabled={salvandoPlano} style={st.btnSalvarPlano}>
                          <FaSave /> {salvandoPlano ? "Salvando..." : "SALVAR"}
                        </button>
                        <button onClick={() => setEditandoPlano(null)} style={st.btnCancelar}>Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    // VISUALIZAÇÃO DO PLANO
                    <>
                      <div style={{display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px"}}>
                        <div style={{...st.planoCorDot, background: plano.cor || "#818cf8"}}></div>
                        <div style={{display: "flex", gap: "6px"}}>
                          <button onClick={() => toggleAtivo(plano)} style={st.btnIconSmall} title={plano.ativo ? "Desativar" : "Ativar"}>
                            {plano.ativo ? <FaToggleOn color="#10b981" size={18}/> : <FaToggleOff color="#64748b" size={18}/>}
                          </button>
                          <button onClick={() => { setEditandoPlano(plano.id); setDadosEditPlano({...plano}); }} style={st.btnIconSmall} title="Editar">
                            <FaEdit color="#60a5fa" size={16}/>
                          </button>
                          <button onClick={() => excluirPlano(plano)} style={st.btnIconSmall} title="Excluir">
                            <FaTrash color="#ef4444" size={14}/>
                          </button>
                        </div>
                      </div>

                      <h4 style={{color: plano.cor || "#fff", fontSize: "16px", fontWeight: "800", margin: "0 0 4px"}}>{plano.nome}</h4>
                      <p style={{color: "#94a3b8", fontSize: "12px", margin: "0 0 12px", lineHeight: 1.4}}>{plano.descricao || "Sem descrição"}</p>

                      <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px"}}>
                        <div>
                          <span style={{color: "#fff", fontSize: "24px", fontWeight: "900"}}>
                            {plano.preco === 0 ? "Grátis" : `R$ ${Number(plano.preco).toFixed(2)}`}
                          </span>
                        </div>
                        <div style={{...st.planoDiasBadge, borderColor: plano.cor || "#818cf8", color: plano.cor || "#818cf8"}}>
                          {plano.dias}d
                        </div>
                      </div>

                      <div style={{borderTop: "1px solid #334155", paddingTop: "10px"}}>
                        <p style={{color: "#64748b", fontSize: "11px", margin: "0 0 4px"}}>
                          Alunos com este plano: <strong style={{color: "#fff"}}>
                            {usuarios.filter(u => u.planoAtivo === plano.nome).length}
                          </strong>
                        </p>
                        <p style={{color: plano.ativo ? "#10b981" : "#64748b", fontSize: "11px", fontWeight: "700", margin: 0}}>
                          {plano.ativo ? "● Visível para alunos" : "● Oculto (desativado)"}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* INFO */}
            <div style={st.infoBox}>
              <strong style={{color: "#818cf8"}}>💡 Como funciona:</strong>
              <p style={{color: "#94a3b8", fontSize: "13px", margin: "6px 0 0", lineHeight: 1.6}}>
                Os planos criados aqui aparecem automaticamente no modal de assinatura que o aluno vê quando o acesso expira.
                Alterar preços ou tempo de duração entra em vigor imediatamente — sem precisar atualizar nenhum código.
                Desativar um plano o oculta para os alunos mas não cancela acessos existentes.
              </p>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            ABA MÉDICOS — HIERARQUIA VISUAL COMPLETA
        ═══════════════════════════════════════════════════════════ */}
        {aba === "usuarios" && (() => {
          // Contagens por classe para os pills (ignoram busca, mas não filtroStatus)
          const contagemClasse = usuarios.reduce((acc, u) => {
            const c = classificarUsuario(u);
            acc[c] = (acc[c] || 0) + 1;
            return acc;
          }, {});

          const pills = [
            { key: "Todos",     label: "Todos",       count: usuarios.length },
            { key: "Admin",     label: "👑 Admin",    count: (contagemClasse.master||0)+(contagemClasse.admin||0)+(contagemClasse.colaborador||0) },
            { key: "Premium",   label: "💎 Premium",  count: contagemClasse.premium  || 0 },
            { key: "Ativos",    label: "🟢 Ativos",   count: contagemClasse.ativo    || 0 },
            { key: "Expirados", label: "🔴 Expirados",count: contagemClasse.expirado || 0 },
          ];

          return (
            <div>
              {/* ── Busca ──────────────────────────────────── */}
              <div style={{ position: "relative", marginBottom: "14px" }}>
                <FaSearch style={{ position: "absolute", left: "14px", top: "13px", color: "#475569", pointerEvents: "none" }} size={12} />
                <input
                  placeholder="Buscar por nome ou e-mail..."
                  style={{ ...st.input, paddingLeft: "38px", width: "100%", boxSizing: "border-box" }}
                  onChange={e => setBusca(e.target.value)}
                />
              </div>

              {/* ── Pills de filtro ─────────────────────────── */}
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "22px" }}>
                {pills.map(p => {
                  const ativo = filtroUsuariosStatus === p.key;
                  return (
                    <button
                      key={p.key}
                      onClick={() => setFiltroUsuariosStatus(p.key)}
                      style={{
                        background: ativo ? "#4f46e5" : "#1e293b",
                        color: ativo ? "#fff" : "#94a3b8",
                        border: ativo ? "1px solid #4f46e5" : "1px solid #334155",
                        borderRadius: "100px", padding: "6px 14px",
                        cursor: "pointer", fontSize: "12px", fontWeight: "700",
                        transition: "all 0.15s",
                        display: "flex", alignItems: "center", gap: "6px",
                      }}
                    >
                      {p.label}
                      <span style={{
                        background: ativo ? "rgba(255,255,255,0.2)" : "#334155",
                        color: ativo ? "#fff" : "#64748b",
                        borderRadius: "100px", padding: "1px 7px",
                        fontSize: "10px", fontWeight: "800",
                      }}>{p.count}</span>
                    </button>
                  );
                })}
              </div>

              {/* ── Grupos por hierarquia ───────────────────── */}
              <div style={st.scrollArea}>
                {GRUPOS_USUARIOS.map(grupo => {
                  const membros = usuariosFiltrados.filter(u => u._classe === grupo.classe);
                  if (membros.length === 0) return null;
                  const badge = BADGE_CLASSE[grupo.classe];
                  const isExpiradoGrupo = grupo.classe === "expirado";

                  return (
                    <div key={grupo.classe} style={{ marginBottom: "28px" }}>

                      {/* Cabeçalho de grupo */}
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                        <span style={{ fontSize: "16px" }}>{grupo.emoji}</span>
                        <span style={{ color: grupo.cor, fontWeight: "800", fontSize: "13px", letterSpacing: "0.3px" }}>
                          {grupo.label}
                        </span>
                        <span style={{
                          background: grupo.cor + "18", color: grupo.cor,
                          border: `1px solid ${grupo.cor}35`,
                          borderRadius: "100px", padding: "1px 9px",
                          fontSize: "10px", fontWeight: "800",
                        }}>{membros.length}</span>
                        <div style={{ flex: 1, height: "1px", background: `linear-gradient(to right, ${grupo.cor}35, transparent)` }} />
                      </div>

                      {/* Cards dos membros deste grupo */}
                      {membros.map(u => {
                        const ehMestre = EMAILS_MESTRE.includes(u.email);
                        let expDate = null;
                        const rawExp = u.dataExpiracao;
                        if (rawExp?.toDate) expDate = rawExp.toDate();
                        else if (rawExp instanceof Date) expDate = rawExp;
                        const diasRestantes = expDate
                          ? Math.ceil((expDate - new Date()) / (1000 * 60 * 60 * 24))
                          : 0;

                        return (
                          <div key={u.id} style={{
                            background: isExpiradoGrupo ? "#0c1526" : "#1e293b",
                            border: "1px solid #334155",
                            borderLeft: `4px solid ${grupo.cor}`,
                            borderRadius: "14px",
                            padding: "14px 16px",
                            marginBottom: "10px",
                            opacity: isExpiradoGrupo ? 0.6 : 1,
                            display: "flex",
                            alignItems: "center",
                            gap: "14px",
                            transition: "opacity 0.2s",
                          }}>

                            {/* Avatar colorido */}
                            <div style={{
                              width: "44px", height: "44px", borderRadius: "12px",
                              background: grupo.cor + "18",
                              border: `1px solid ${grupo.cor}40`,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: "18px", fontWeight: "900", color: grupo.cor,
                              flexShrink: 0, textTransform: "uppercase",
                              fontFamily: "'Inter', sans-serif",
                            }}>
                              {(u.nome || u.email || "?")[0].toUpperCase()}
                            </div>

                            {/* Info do usuário */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              {/* Linha 1: nome + badges */}
                              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginBottom: "5px" }}>
                                <span style={{
                                  color: isExpiradoGrupo ? "#94a3b8" : "#f1f5f9",
                                  fontWeight: "700", fontSize: "14px",
                                }}>
                                  {u.nome || "Doutor(a)"}
                                </span>

                                {/* Badge hierarquia */}
                                <span style={{
                                  background: badge.cor + "18", color: badge.cor,
                                  border: `1px solid ${badge.cor}40`,
                                  borderRadius: "6px", padding: "1px 7px",
                                  fontSize: "9px", fontWeight: "800", letterSpacing: "0.5px",
                                }}>
                                  {badge.label}
                                </span>

                                {/* Badge dias restantes */}
                                {diasRestantes > 0 && !isExpiradoGrupo && (
                                  <span style={{
                                    background: diasRestantes <= 3 ? "rgba(239,68,68,0.12)" : "rgba(16,185,129,0.1)",
                                    color: diasRestantes <= 3 ? "#ef4444" : "#10b981",
                                    border: `1px solid ${diasRestantes <= 3 ? "rgba(239,68,68,0.3)" : "rgba(16,185,129,0.25)"}`,
                                    borderRadius: "6px", padding: "1px 7px",
                                    fontSize: "9px", fontWeight: "800",
                                  }}>
                                    {diasRestantes}d
                                  </span>
                                )}

                                {/* Badge BLOQUEADO */}
                                {u.bloqueado && (
                                  <span style={{
                                    background: "rgba(239,68,68,0.15)", color: "#ef4444",
                                    border: "1px solid rgba(239,68,68,0.35)",
                                    borderRadius: "6px", padding: "1px 7px",
                                    fontSize: "9px", fontWeight: "800",
                                  }}>
                                    🚫 BLOQUEADO
                                  </span>
                                )}

                                {/* Badge Online */}
                                {isOnlineRecente(u) && (
                                  <span style={{
                                    background: "rgba(16,185,129,0.15)", color: "#10b981",
                                    border: "1px solid rgba(16,185,129,0.3)",
                                    borderRadius: "6px", padding: "1px 7px",
                                    fontSize: "9px", fontWeight: "800",
                                  }}>● Online</span>
                                )}
                              </div>

                              {/* Linha 2: email · plano · expiração */}
                              <span style={{ color: "#64748b", fontSize: "11px" }}>
                                {u.email}
                                {u.planoAtivo && (
                                  <> · <span style={{ color: "#94a3b8" }}>{u.planoAtivo}</span></>
                                )}
                                {expDate && (
                                  <> · exp: <span style={{ color: diasRestantes > 0 ? "#94a3b8" : "#ef4444" }}>
                                    {expDate.toLocaleDateString("pt-BR")}
                                  </span></>
                                )}
                              </span>
                            </div>

                            {/* ── Ações (apenas para não-mestre) ─── */}
                            {!ehMestre && (
                              <div style={{ display: "flex", gap: "6px", alignItems: "center", flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>

                                {/* Ativar plano */}
                                <select
                                  onChange={e => {
                                    const planoId = e.target.value;
                                    if (!planoId) return;
                                    const planoSel = planos.find(p => p.id === planoId);
                                    if (planoSel) ativarPlanoPorId(u.id, planoSel);
                                    e.target.value = "";
                                  }}
                                  style={{ ...st.selectSmall, borderColor: "#4f46e5", minWidth: "130px" }}
                                >
                                  <option value="">⚡ Ativar Plano...</option>
                                  {planos.filter(p => p.ativo).map(p => (
                                    <option key={p.id} value={p.id}>{p.nome} ({p.dias}d)</option>
                                  ))}
                                </select>

                                {/* Acesso free */}
                                <select
                                  onChange={e => { if (e.target.value) atualizarPrazo(u.id, e.target.value, "free"); }}
                                  style={{ ...st.selectSmall, borderColor: "#10b981" }}
                                >
                                  <option value="">Free...</option>
                                  <option value="24">24h</option>
                                  <option value="48">48h</option>
                                  <option value="72">72h</option>
                                </select>

                                {/* Alterar cargo */}
                                <button
                                  onClick={() => alternarCargo(u)}
                                  style={st.btnIcon}
                                  title="Alterar cargo (aluno → colaborador → admin)"
                                >
                                  <FaUserEdit color="#60a5fa" size={17} />
                                </button>

                                {/* Bloquear / Desbloquear */}
                                <button
                                  onClick={() => {
                                    if (window.confirm(u.bloqueado ? "Desbloquear este usuário?" : "Bloquear este usuário?"))
                                      alternarBloqueio(u);
                                  }}
                                  style={{ ...st.btnIcon, color: u.bloqueado ? "#10b981" : "#ef4444" }}
                                  title={u.bloqueado ? "Desbloquear" : "Bloquear"}
                                >
                                  {u.bloqueado ? <FaCheckDouble size={16}/> : <FaBan size={16}/>}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

                {/* Estado vazio */}
                {usuariosFiltrados.length === 0 && (
                  <div style={{ textAlign: "center", padding: "60px 20px" }}>
                    <FaSearch size={32} color="#334155" style={{ marginBottom: "12px" }} />
                    <p style={{ color: "#475569", fontSize: "14px", margin: 0 }}>
                      Nenhum usuário encontrado com esses filtros.
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* ABA BANCO — carregamento preguiçoso */}
        {aba === "banco" && (
          <div>
            {!questoesCarregadas && (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "#818cf8" }}>
                <div style={{ fontSize: "32px", marginBottom: "12px", animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</div>
                <p style={{ color: "#94a3b8", fontSize: "14px" }}>Carregando banco de questões...</p>
              </div>
            )}
            {questoesCarregadas && (
              <>
              <div style={st.filterPanel}>
              {/* ── LINHA 1: busca + módulo ── */}
              <div style={st.filterRow}>
                <input placeholder="Busca no enunciado..." onChange={(e) => setBusca(e.target.value)} style={{...st.input, flex: 2}} />
                <select value={filtroModulo} onChange={(e) => { setFiltroModulo(e.target.value); setFiltroEdicao("Todas"); setFiltroNivel("Todos"); }} style={st.select}>
                  <option value="Todos">Todos os Módulos</option>
                  <option value="inep">🏛️ INEP (Prova Real)</option>
                  <option value="banco_geral">📚 Banco Geral</option>
                  <option value="super_apostas">🔥 Super Apostas</option>
                </select>
                {/* filtros específicos do Super Apostas */}
                {filtroModulo === "super_apostas" && (
                  <select value={filtroEdicao} onChange={(e) => setFiltroEdicao(e.target.value)} style={st.select}>
                    <option value="Todas">Todas as Edições</option>
                    {[...new Set(questoes.filter(q => q.modulo === "super_apostas").map(q => q.edicao))].filter(Boolean).sort().map(e => <option key={e} value={e}>{e.replace("_", ".")}</option>)}
                  </select>
                )}
                {filtroModulo === "super_apostas" && (
                  <select value={filtroNivel} onChange={(e) => setFiltroNivel(e.target.value)} style={st.select}>
                    <option value="Todos">Todos os Níveis</option>
                    <option value="ALTO">🎯 Alto</option>
                    <option value="MEDIO">📊 Médio</option>
                    <option value="BAIXO">💡 Baixo</option>
                  </select>
                )}
              </div>
              {/* ── LINHA 2: ano + matéria + subtema + status diretriz ── */}
              <div style={st.filterRow}>
                <select value={filtroAno} onChange={(e) => setFiltroAno(e.target.value)} style={st.select}>
                  <option value="Todos">Todos os Anos</option>
                  {[...new Set(questoes.map(q => String(q.ano || "")))].filter(s => s.trim() !== "").sort().reverse().map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                <select value={filtroMateria} onChange={(e) => { setFiltroMateria(e.target.value); setFiltroSubtema("Todos"); }} style={st.select}>
                  <option value="Todas">Todas as Matérias</option>
                  {[...new Set(questoes.map(q => String(q.materia || "")))].filter(s => s.trim() !== "").sort().map(m=><option key={m} value={m}>{m}</option>)}
                </select>
                <select value={filtroSubtema} onChange={(e) => setFiltroSubtema(e.target.value)} style={st.select}>
                  <option value="Todos">Todos os Subtemas</option>
                  {[...new Set(questoes.filter(q => filtroMateria === "Todas" || q.materia === filtroMateria).map(q => String(q.subtema || "")))].filter(s => s.trim() !== "").sort().map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} style={{...st.select, minWidth: "140px"}}>
                  <option value="Todos">📋 Todos Status</option>
                  <option value="atual">🟢 Atual</option>
                  <option value="revisar">🟡 Revisar</option>
                </select>
              </div>
              {/* ── LINHA 3: contador + bulk delete ── */}
              <div style={{...st.filterRow, justifyContent: "space-between", alignItems: "center"}}>
                <span style={{fontSize:"11px", color:"#64748b", fontWeight:"700"}}>
                  {questoesFiltradas.length} questão(ões) encontrada(s)
                  {filtroModulo !== "Todos" && <span style={{color: filtroModulo === "super_apostas" ? "#ef4444" : filtroModulo === "inep" ? "#818cf8" : "#10b981"}}> · {filtroModulo === "super_apostas" ? "Super Apostas" : filtroModulo === "inep" ? "INEP" : "Banco Geral"}</span>}
                </span>
                {selecionadas.length > 0 && <button onClick={deletarEmMassa} style={st.btnDanger}><FaTrash/> Excluir {selecionadas.length} Questões</button>}
              </div>
            </div>

            <div style={st.scrollArea}>
              {questoesFiltradas.length === 0 ? (
                <p style={{textAlign:"center", color:"#94a3b8", marginTop: "40px"}}>Nenhuma questão encontrada com esses filtros.</p>
              ) : (
                questoesFiltradas.map(q => (
                  <div key={q.id} style={{...st.itemCard, flexDirection: "column", alignItems: "stretch", gap: "10px"}}>
                    <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start"}}>
                      <div style={{display:"flex", alignItems:"center", flexWrap: "wrap", gap: "8px"}}>
                        <input type="checkbox" checked={selecionadas.includes(q.id)} onChange={() => setSelecionadas(p => p.includes(q.id) ? p.filter(i=>i!==q.id) : [...p, q.id])} style={{marginRight: 10}} />
                        <span style={{...st.badgeMat, background: "#4f46e522", color: "#818cf8"}}>Q{q.numeroQuestao}</span>
                        {/* Badge de módulo */}
                        {(() => {
                          const mod = getModuloQuestao(q);
                          if (mod === "super_apostas") return <span style={{...st.badgeMat, background: "rgba(239,68,68,0.15)", color: "#ef4444", fontSize:"9px"}}>🔥 SA{q.edicao ? ` ${q.edicao.replace("_",".")}` : ""}{q.nivel_aposta ? ` · ${q.nivel_aposta}` : ""}</span>;
                          if (mod === "inep") return <span style={{...st.badgeMat, background: "rgba(129,140,248,0.15)", color: "#818cf8", fontSize:"9px"}}>🏛️ INEP{q.provaId ? ` ${q.provaId}` : ""}</span>;
                          return <span style={{...st.badgeMat, background: "rgba(16,185,129,0.1)", color: "#10b981", fontSize:"9px"}}>📚 Geral</span>;
                        })()}
                        <span style={{...st.badgeMat, background: "#10b98122", color: "#10b981"}}>{q.materia}</span>
                        <span style={{...st.badgeMat, background: "#fbbf2422", color: "#fbbf24"}}>{q.subtema || "Sem Subtema"}</span>
                        <span style={{...st.badgeMat, background: "#334155", color: "#94a3b8", fontSize: "9px"}}>{q.ano || "S/A"}</span>
                        {/* Badge status de atualização — só exibe quando campo existe */}
                        {q.status_atualizacao && (
                          <span style={{
                            ...st.badgeMat, fontSize: "9px",
                            background: q.status_atualizacao === "atual" ? "rgba(34,197,94,0.1)" : "rgba(234,179,8,0.1)",
                            color:      q.status_atualizacao === "atual" ? "#22c55e"             : "#eab308",
                          }}>
                            {q.status_atualizacao === "atual" ? "🟢 Atual" : "🟡 Revisar"}
                            {q.ano_diretriz ? ` ${q.ano_diretriz}` : ""}
                          </span>
                        )}
                      </div>
                      <div style={{display:"flex", gap: 12}}>
                        <button onClick={() => setVisualizarQuestaoId(visualizarQuestaoId === q.id ? null : q.id)} style={{...st.btnIcon, color: visualizarQuestaoId === q.id ? "#fbbf24" : "#94a3b8"}} title="Visualizar"><FaBookOpen /></button>
                        <button onClick={() => { setEditandoId(q.id); setDadosEdit({...q}); }} style={st.btnIcon} title="Editar"><FaEdit color="#60a5fa"/></button>
                        <button onClick={() => { if(window.confirm("Excluir questão?")) deleteDoc(doc(db,"questoes",q.id)) }} style={st.btnIcon} title="Excluir"><FaTrash color="#ef4444"/></button>
                      </div>
                    </div>

                    <div 
                      onClick={() => setVisualizarQuestaoId(visualizarQuestaoId === q.id ? null : q.id)}
                      style={{cursor:"pointer", fontSize:"13px", color: q.enunciado ? "#cbd5e1" : "#ef4444", background: q.enunciado ? "rgba(0,0,0,0.2)" : "rgba(239, 68, 68, 0.1)", padding:"12px", borderRadius:"10px", border: visualizarQuestaoId === q.id ? "1px solid #4f46e5" : "1px solid transparent", transition:"0.2s"}}
                    >
                      {visualizarQuestaoId === q.id ? (
                        <p style={{margin: 0, lineHeight: "1.6", whiteSpace: "pre-wrap"}}>{q.enunciado || "ESTA QUESTÃO ESTÁ SEM ENUNCIADO!"}</p>
                      ) : (
                        <p style={{margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"}}>
                          <strong style={{color: "#818cf8"}}>Preview:</strong> {q.enunciado ? q.enunciado.substring(0, 100) + "..." : "ALERTA: ENUNCIADO VAZIO"}
                        </p>
                      )}
                    </div>

                    {editandoId === q.id && (
                      <div style={st.editForm}>
                        <textarea value={dadosEdit.enunciado} onChange={e=>setDadosEdit({...dadosEdit, enunciado: e.target.value})} style={st.editTextarea} placeholder="Escreva o enunciado aqui..."/>
                        <div style={st.editGrid}>
                          <input value={dadosEdit.materia} onChange={e=>setDadosEdit({...dadosEdit, materia: e.target.value})} placeholder="Matéria" style={st.editInput}/>
                          <input value={dadosEdit.subtema} onChange={e=>setDadosEdit({...dadosEdit, subtema: e.target.value})} placeholder="Subtema" style={st.editInput}/>
                          <input value={dadosEdit.gabarito} onChange={e=>setDadosEdit({...dadosEdit, gabarito: e.target.value})} placeholder="Gabarito" style={st.editInput}/>
                          <div style={{gridColumn: "1 / -1", position: "relative"}}>
                            <FaImage style={{position:"absolute", left: 10, top: 12, color: "#4f46e5"}}/>
                            <input value={dadosEdit.imagemUrl || ""} onChange={e=>setDadosEdit({...dadosEdit, imagemUrl: e.target.value})} placeholder="Link da Imagem" style={{...st.editInput, width: "100%", paddingLeft: "35px"}}/>
                          </div>
                        </div>
                        <div style={{display:"flex", gap:10, marginTop: 10}}>
                          <button onClick={()=>salvarEdicao(q.id)} style={st.btnSuccess}><FaSave/> SALVAR ALTERAÇÕES</button>
                          <button onClick={()=>setEditandoId(null)} style={{...st.btnIcon, padding: "10px"}} title="Cancelar"><FaTimes color="#ef4444" size={20}/></button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            </>
            )}
          </div>
        )}

        {/* ABA DÚVIDAS — ORIGINAL PRESERVADA */}
        {aba === "duvidas" && (
          <div style={{display: "flex", gap: "20px", alignItems: "flex-start"}}>
            <div style={{...st.scrollArea, flex: 1}}>
              <div style={st.filterRow}>
                <input placeholder="Buscar aluno..." onChange={(e) => setBuscaDuvida(e.target.value)} style={st.input} />
              </div>
              <div style={{display: "flex", flexDirection: "column", gap: "15px"}}>
                {duvidas.filter(d => (d.alunoNome || d.usuarioNome || "").toLowerCase().includes(buscaDuvida.toLowerCase())).map(d => (
                  <div key={d.id} style={{...st.cardDuvida, borderLeft: d.respondida ? "6px solid #10b981" : "6px solid #ef4444", background: d.respondida ? "#0f172a" : "rgba(239, 68, 68, 0.05)"}}>
                    <div style={{display:"flex", justifyContent:"space-between", marginBottom: "10px"}}>
                      <span style={{...st.tagDuvida, color: d.respondida ? "#10b981" : "#ef4444"}}>
                        {d.respondida ? <FaCheckDouble/> : "PENDENTE"}
                      </span>
                      <div style={{display:"flex", gap:"10px"}}>
                        {d.enunciado ? (
                          <button onClick={() => setQuestaoVisualizada(d)} style={st.btnVerQuestao}><FaBookOpen /> LER QUESTÃO</button>
                        ) : (
                          <span style={{fontSize: "10px", color: "#64748b"}}>Sem contexto vinculado</span>
                        )}
                        <button onClick={() => {if(window.confirm("Excluir dúvida?")) deleteDoc(doc(db,"duvidas_questoes",d.id))}} style={st.btnTrashDuvida}><FaTrash/></button>
                      </div>
                    </div>
                    <p style={st.textDuvidaPreview}>
                      <strong>{d.usuarioNome?.toUpperCase() || d.alunoNome?.toUpperCase() || "ALUNO"}</strong>: {d.duvidaTexto || d.duvida}
                    </p>
                    <div style={st.chatContainer}>
                      {d.mensagens?.map((msg, i) => {
                        const isAdmin = msg.remetente === "admin" || msg.remetente === "preceptor";
                        return (
                          <div key={i} style={{...st.msgWrapper, justifyContent: isAdmin ? "flex-end" : "flex-start"}}>
                            <div style={{...st.bubble, background: isAdmin ? "#4f46e5" : "#1e293b", border: isAdmin ? "none" : "1px solid #334155", borderRadius: isAdmin ? "18px 18px 4px 18px" : "4px 18px 18px 18px"}}>
                              <small style={st.msgLabel}>{isAdmin ? "VOCÊ" : "ALUNO"}</small>
                              <p style={{ margin: 0, fontSize: "14px" }}>{msg.texto}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{marginTop: "auto", display: "flex", gap: "8px", paddingTop: "10px"}}>
                      <textarea id={`resp-${d.id}`} placeholder="Digite a conduta médica aqui..." style={st.inputDuvidaMini} />
                      <button onClick={() => enviarResposta(d)} style={st.btnSendMini} title="Enviar Resposta"><FaReply/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {questaoVisualizada && (
              <div style={st.painelQuestao}>
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", borderBottom: "1px solid #334155", paddingBottom: "15px", marginBottom: "15px"}}>
                  <h3 style={{margin: 0, color: "#818cf8"}}>Análise do Caso Clínico</h3>
                  <button onClick={() => setQuestaoVisualizada(null)} style={st.btnIcon}><FaTimes color="#ef4444" size={20}/></button>
                </div>
                <div style={{display:"flex", gap:"10px", marginBottom: "15px", flexWrap: "wrap"}}>
                  <span style={st.badgeMat}>{questaoVisualizada.materia || "Geral"}</span>
                  <span style={{...st.badgeMat, background: "#334155"}}>{questaoVisualizada.subtema || "Sem subtema"}</span>
                  {questaoVisualizada.numeroQuestao && <span style={{...st.badgeMat, background: "#10b981"}}>Q{questaoVisualizada.numeroQuestao}</span>}
                </div>
                <p style={{fontSize: "15px", lineHeight: "1.7", color: "#f1f5f9", whiteSpace: "pre-wrap"}}>
                  {questaoVisualizada.enunciado}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ABA MATERIAIS — ORIGINAL PRESERVADA */}
        {aba === "materiais" && (
          <div>
            <div style={st.filterRow}>
              <input value={novoMaterialNome} placeholder="Nome do PDF" onChange={(e)=>setNovoMaterialNome(e.target.value)} style={st.input} />
              <input value={novoMaterialLink} placeholder="Link do Drive" onChange={(e)=>setNovoMaterialLink(e.target.value)} style={st.input} />
              <select value={novoMaterialCategoria} onChange={(e)=>setNovoMaterialCategoria(e.target.value)} style={{...st.select, flex: 0.5}}>
                <option value="Plantão">Plantão</option><option value="Estudo">Estudo</option><option value="Simulados">Simulados</option><option value="Geral">Geral</option>
              </select>
              <button onClick={adicionarMaterial} style={st.btnSuccess}><FaPlus/> ADD</button>
            </div>
            <div style={st.scrollArea}>
              {materiais.map(m => (
                <div key={m.id} style={{...st.itemCard, flexDirection: "column", alignItems: "stretch"}}>
                  <div style={{display:"flex", alignItems:"center"}}>
                    <FaFilePdf size={20} color="#ef4444" style={{marginRight: 15}}/>
                    <div style={{flex: 1}}><strong>{m.nome}</strong> <span style={st.badgeMat}>{m.categoria}</span></div>
                    <button onClick={() => { setEditandoMatId(m.id); setDadosEditMat({...m}); }} style={st.btnIcon}><FaEdit color="#60a5fa"/></button>
                    <button onClick={() => deleteDoc(doc(db,"materiais",m.id))} style={st.btnIcon}><FaTrash color="#ef4444"/></button>
                  </div>
                  {editandoMatId === m.id && (
                    <div style={{...st.editForm, border: "1px solid #10b981", marginTop: 10}}>
                      <div style={st.editGrid}>
                        <input value={dadosEditMat.nome} onChange={e=>setDadosEditMat({...dadosEditMat, nome: e.target.value})} placeholder="Nome" style={st.editInput}/>
                        <input value={dadosEditMat.link} onChange={e=>setDadosEditMat({...dadosEditMat, link: e.target.value})} placeholder="Link" style={st.editInput}/>
                        <select value={dadosEditMat.categoria} onChange={e=>setDadosEditMat({...dadosEditMat, categoria: e.target.value})} style={st.editInput}>
                          <option value="Plantão">Plantão</option><option value="Estudo">Estudo</option><option value="Simulados">Simulados</option><option value="Geral">Geral</option>
                        </select>
                      </div>
                      <div style={{display:"flex", gap:10, marginTop:10}}>
                        <button onClick={()=>salvarEdicaoMaterial(m.id)} style={st.btnSuccess}><FaSave/> ATUALIZAR</button>
                        <button onClick={()=>setEditandoMatId(null)} style={st.btnIcon}><FaTimes color="#94a3b8"/></button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ABA SALA — CHAT GRUPO */}
        {aba === "chat" && (
          <div style={{ display: "flex", flexDirection: "column", height: "600px", background: "#020617", borderRadius: "16px", overflow: "hidden", border: "1px solid #1e293b" }}>

            {/* Header */}
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #1e293b", background: "#0f172a", display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
              <FaCommentDots color="#818cf8" size={16} />
              <div style={{ flex: 1 }}>
                <h3 style={{ color: "#fff", margin: 0, fontSize: "15px", fontWeight: "800" }}>Sala dos Residentes</h3>
                <p style={{ color: "#64748b", fontSize: "11px", margin: "1px 0 0" }}>{mensagensSala.length} mensagens nas últimas 24h</p>
              </div>
              <span style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", fontSize: "10px", fontWeight: "800", padding: "3px 10px", borderRadius: "100px" }}>
                MODO PRECEPTOR — você pode deletar qualquer mensagem
              </span>
            </div>

            {/* Mensagens */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: "6px" }}>
              {mensagensSala.length === 0 ? (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#475569", fontSize: "13px" }}>
                  Nenhuma mensagem nas últimas 24h.
                </div>
              ) : (
                mensagensSala.map(msg => {
                  const isAdminMsg = msg.autorRole === "admin";
                  const hora = msg.criadoEm?.seconds
                    ? new Date(msg.criadoEm.seconds * 1000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                    : msg.criadoEm?.toDate
                      ? msg.criadoEm.toDate().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                      : "";
                  return (
                    <div key={msg.id} style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "8px 12px", borderRadius: "12px", background: isAdminMsg ? "rgba(251,191,36,0.05)" : "rgba(255,255,255,0.02)", border: `1px solid ${isAdminMsg ? "rgba(251,191,36,0.1)" : "#1e293b"}` }}>
                      <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: isAdminMsg ? "#fbbf24" : "#334155", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "11px", fontWeight: "900", color: "#fff" }}>
                        {(msg.autorNome?.[0] || "?").toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
                          <span style={{ color: isAdminMsg ? "#fbbf24" : "#94a3b8", fontSize: "12px", fontWeight: "800" }}>{msg.autorNome}</span>
                          {isAdminMsg && <span style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24", fontSize: "9px", fontWeight: "900", padding: "1px 6px", borderRadius: "100px" }}>PRECEPTOR</span>}
                          <span style={{ color: "#475569", fontSize: "10px", marginLeft: "auto" }}>{hora}</span>
                        </div>
                        <p style={{ color: "#e2e8f0", fontSize: "13px", margin: 0, lineHeight: 1.55, wordBreak: "break-word" }}>{msg.texto}</p>
                      </div>
                      {!isAdminMsg && (
                        <button
                          onClick={() => deletarMensagemSala(msg.id)}
                          title="Deletar mensagem"
                          style={{ background: "none", border: "none", color: "#334155", cursor: "pointer", padding: "4px", flexShrink: 0 }}
                          onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
                          onMouseLeave={e => e.currentTarget.style.color = "#334155"}
                        >
                          <FaTrash size={12} />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={bottomSalaRef} />
            </div>

            {/* Input */}
            <div style={{ padding: "12px 20px", borderTop: "1px solid #1e293b", background: "#0f172a", display: "flex", gap: "10px", alignItems: "center", flexShrink: 0 }}>
              <input
                value={textoSala}
                onChange={e => setTextoSala(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); enviarMensagemSala(); } }}
                placeholder="Enviar mensagem como Preceptor..."
                maxLength={500}
                style={{ flex: 1, background: "#1e293b", border: "1px solid #334155", borderRadius: "10px", color: "#fff", padding: "10px 14px", fontSize: "13px", outline: "none", fontFamily: "inherit" }}
                disabled={enviandoSala}
              />
              <button
                onClick={enviarMensagemSala}
                disabled={!textoSala.trim() || enviandoSala}
                style={{ background: "#4f46e5", border: "none", borderRadius: "10px", padding: "10px 18px", color: "#fff", display: "flex", alignItems: "center", gap: "6px", fontWeight: "700", fontSize: "13px", cursor: !textoSala.trim() || enviandoSala ? "not-allowed" : "pointer", opacity: !textoSala.trim() || enviandoSala ? 0.5 : 1, flexShrink: 0 }}
              >
                <FaPaperPlane size={12} /> Enviar
              </button>
            </div>
          </div>
        )}

        <div style={{ display: aba === "importador" ? "block" : "none" }}><ImportadorPro /></div>

        {/* ABA ROBÔ */}
        {/* FIX: onQuestoesSalvas invalida o cache do Banco sempre que o robô salva questões.
            Assim, ao clicar na aba "Banco" após uma sessão do robô, os dados são recarregados. */}
        {aba === "robo" && (
          <RoboGerador
            onQuestoesSalvas={() => setQuestoesCarregadas(false)}
          />
        )}

        {/* ABA RESUMOS — banco de resumos clínicos por tema_mestre */}
        {aba === "resumos" && <ResumoGerador />}
      </div>

      <style>{`
        .pulse-badge { animation: pulseRed 2s infinite; }
        @keyframes pulseRed { 0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); } 70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); } 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .admin-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </div>
  );
};

const st = {
  container: { padding: "24px", background: "#020617", minHeight: "100vh", color: "#fff", fontFamily: "'Inter', sans-serif" },
  headerAdmin: { marginBottom: "24px", borderBottom: "1px solid #1e293b", paddingBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" },
  headerTitle: { margin: 0, fontSize: "22px", fontWeight: "800", color: "#fff", display: "flex", alignItems: "center", gap: "12px" },
  headerSub: { color: "#64748b", fontSize: "12px", margin: "4px 0 0" },
  headerStats: { display: "flex", gap: "12px" },
  headerStat: { background: "#1e293b", border: "1px solid #334155", borderRadius: "12px", padding: "10px 16px", textAlign: "center", minWidth: "70px" },
  headerStatNum: { display: "block", fontSize: "20px", fontWeight: "800", color: "#fff" },
  headerStatLabel: { display: "block", fontSize: "10px", color: "#64748b", marginTop: "2px", fontWeight: "600" },
  badgeStatus: { fontSize: "11px", background: "#4f46e5", padding: "4px 10px", borderRadius: "6px" },
  dashboardGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px", marginBottom: "24px" },
  cardMetrica: { background: "#1e293b", padding: "18px", borderRadius: "16px", border: "1px solid #334155", display: "flex", alignItems: "center", gap: "14px" },
  metricaIcon: { width: "44px", height: "44px", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  metricaLabel: { color: "#64748b", fontSize: "11px", margin: 0, fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" },
  metricaValor: { color: "#fff", fontSize: "24px", fontWeight: "800", margin: "2px 0 0" },
  tabMenu: { display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" },
  btn: { background: "#1e293b", color: "#94a3b8", padding: "10px 18px", borderRadius: "12px", border: "1px solid #334155", cursor: "pointer", fontWeight: "700", fontSize: "12px", position: "relative" },
  btnActive: { background: "#4f46e5", color: "#fff", padding: "10px 18px", borderRadius: "12px", border: "1px solid #4f46e5", cursor: "pointer", fontWeight: "700", fontSize: "12px", position: "relative" },
  contentBox: { background: "#0f172a", padding: "24px", borderRadius: "20px", border: "1px solid #1e293b", minHeight: "500px" },
  scrollArea: { maxHeight: "600px", overflowY: "auto", paddingRight: "8px" },
  filterPanel: { background: "#020617", padding: "16px", borderRadius: "14px", marginBottom: "16px", display: "flex", flexDirection: "column", gap: "10px" },
  filterRow: { display: "flex", gap: "12px", alignItems: "center", marginBottom: "16px", flexWrap: "wrap" },
  input: { background: "#0f172a", border: "1px solid #1e293b", color: "#fff", padding: "11px 14px", borderRadius: "12px", flex: 1, minWidth: "200px", outline: "none", fontSize: "13px" },
  select: { background: "#0f172a", color: "#fff", border: "1px solid #1e293b", borderRadius: "12px", padding: "10px 12px", flex: 1, minWidth: "150px", fontSize: "13px" },
  itemCard: { background: "#1e293b", padding: "18px", borderRadius: "14px", marginBottom: "12px", display: "flex", alignItems: "center", gap: "12px" },
  roleBadge: { fontSize: "9px", background: "rgba(255,255,255,0.05)", padding: "2px 6px", borderRadius: "4px", textTransform: "uppercase", border: "1px solid" },
  badgeMat: { padding: "3px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: "700", marginRight: 6, background: "#4f46e5", color: "#fff" },
  btnIcon: { background: "none", border: "none", cursor: "pointer", fontSize: "18px", padding: "4px" },
  btnSuccess: { background: "#10b981", color: "#fff", border: "none", padding: "10px 20px", borderRadius: "10px", cursor: "pointer", fontWeight: "bold", display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" },
  btnDanger: { background: "#ef4444", color: "#fff", border: "none", padding: "10px 20px", borderRadius: "10px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" },
  editForm: { marginTop: 14, padding: 14, background: "#020617", borderRadius: "12px", border: "1px solid #4f46e5" },
  editInput: { background: "#0f172a", border: "1px solid #1e293b", color: "#fff", padding: "10px", borderRadius: "8px", marginBottom: 10, width: "100%", boxSizing: "border-box" },
  editTextarea: { width: "100%", minHeight: "100px", background: "#0f172a", color: "#fff", border: "1px solid #1e293b", borderRadius: "10px", padding: "14px", marginBottom: 10, boxSizing: "border-box", resize: "vertical" },
  editGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" },
  dashWelcome: { textAlign: "center", paddingTop: "60px" },
  welcomeIcon: { width: "80px", height: "80px", background: "rgba(79,70,229,0.1)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" },
  selectSmall: { background: "#020617", color: "#fff", border: "1px solid #334155", borderRadius: "8px", padding: "6px 10px", fontSize: "11px", cursor: "pointer" },
  cardDuvida: { padding: "18px", borderRadius: "14px", border: "1px solid #1e293b", display: "flex", flexDirection: "column" },
  tagDuvida: { fontSize: "11px", fontWeight: "900", display: "flex", alignItems: "center", gap: "5px" },
  btnTrashDuvida: { background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: "16px" },
  textDuvidaPreview: { fontSize: "14px", color: "#f8fafc", margin: "12px 0", lineHeight: "1.5" },
  inputDuvidaMini: { flex: 1, background: "#020617", border: "1px solid #334155", borderRadius: "10px", color: "#fff", padding: "12px", fontSize: "14px", resize: "none", minHeight: "60px" },
  btnSendMini: { background: "#4f46e5", border: "none", color: "#fff", width: "60px", borderRadius: "10px", cursor: "pointer", fontSize: "18px" },
  badgeNotificacao: { background: "#ef4444", color: "#fff", fontSize: "10px", padding: "2px 7px", borderRadius: "20px", marginLeft: "8px" },
  chatContainer: { display: "flex", flexDirection: "column", gap: "10px", marginTop: "10px" },
  msgWrapper: { display: "flex", width: "100%" },
  bubble: { maxWidth: "85%", padding: "10px 15px" },
  msgLabel: { fontSize: "8px", fontWeight: "900", opacity: 0.5, marginBottom: "4px", display: "block" },
  btnVerQuestao: { background: "rgba(129, 140, 248, 0.1)", color: "#818cf8", border: "1px solid #818cf8", borderRadius: "8px", padding: "6px 14px", fontSize: "11px", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" },
  painelQuestao: { flex: 0.8, background: "#1e293b", border: "2px solid #334155", borderRadius: "16px", padding: "24px", overflowY: "auto", maxHeight: "600px", position: "sticky", top: "0" },
  // ESTILOS NOVOS — PLANOS
  planosHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px", flexWrap: "wrap", gap: "12px" },
  btnNovo: { background: "#4f46e5", color: "#fff", border: "none", padding: "12px 20px", borderRadius: "12px", fontWeight: "800", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", boxShadow: "0 4px 15px rgba(79,70,229,0.3)" },
  planosGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "16px", marginBottom: "20px" },
  planoCard: { background: "#1e293b", border: "1px solid #334155", borderRadius: "18px", padding: "20px", position: "relative", transition: "all 0.2s" },
  destaqueTag: { position: "absolute", top: "-10px", left: "50%", transform: "translateX(-50%)", background: "linear-gradient(90deg, #fbbf24, #f59e0b)", color: "#000", fontSize: "10px", fontWeight: "900", padding: "4px 12px", borderRadius: "100px", whiteSpace: "nowrap" },
  planoCorDot: { width: "12px", height: "12px", borderRadius: "50%", display: "inline-block" },
  planoDiasBadge: { border: "2px solid", borderRadius: "12px", padding: "6px 14px", fontSize: "16px", fontWeight: "800" },
  planoFormCard: { background: "#1e293b", border: "1px solid #4f46e5", borderRadius: "18px", padding: "20px", marginBottom: "20px" },
  planoFormHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" },
  planoFormGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" },
  formLabel: { color: "#94a3b8", fontSize: "11px", fontWeight: "700", display: "block", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" },
  formInput: { width: "100%", padding: "11px 14px", background: "#0f172a", border: "1px solid #334155", borderRadius: "10px", color: "#fff", fontSize: "13px", boxSizing: "border-box", outline: "none" },
  btnSalvarPlano: { background: "#4f46e5", color: "#fff", border: "none", padding: "11px 20px", borderRadius: "10px", fontWeight: "800", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" },
  btnCancelar: { background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)", padding: "11px 20px", borderRadius: "10px", fontWeight: "700", cursor: "pointer", fontSize: "13px" },
  btnIconSmall: { background: "none", border: "none", cursor: "pointer", padding: "4px" },
  btnIconClose: { background: "none", border: "none", cursor: "pointer" },
  infoBox: { background: "rgba(79,70,229,0.08)", border: "1px solid rgba(79,70,229,0.2)", borderRadius: "14px", padding: "16px 20px", marginTop: "8px" },
  btnQuickAction: { background: "rgba(79,70,229,0.1)", color: "#818cf8", border: "1px solid rgba(79,70,229,0.3)", padding: "12px 20px", borderRadius: "12px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" },
};

export default AdminPainel;
