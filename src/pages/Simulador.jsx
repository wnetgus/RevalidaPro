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
  FaEye, FaListOl
} from "react-icons/fa";
import { registrarRespostaIndividual, gravarDesempenhoFinalLote, atualizarStreakDiario, atualizarEstatisticasFinais } from "../modules/simulador/simuladorLogic";
import TeoriaModal from "../components/TeoriaModal";

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
    // Auto-save: persiste cada resposta imediatamente (fire-and-forget)
    salvarProgresso(novas, indice);
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

        {/* IMAGEM */}
        {q.imagemUrl && (
          <div style={st.imgBox}>
            <img src={q.imagemUrl} style={st.imagem} alt="Imagem da questão" />
          </div>
        )}

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

                {/* JUSTIFICATIVA INLINE (após responder — oculta em modoOficial) */}
                {respondida && !modoOficial && q[`justificativa${letra.toUpperCase()}`] && (
                  <div style={{
                    ...st.notaInLine,
                    borderLeftColor: isCorreta ? "#10b981" : marcada ? "#ef4444" : "#334155",
                    background: isCorreta ? "rgba(16,185,129,0.05)" : marcada ? "rgba(239,68,68,0.05)" : "rgba(0,0,0,0.2)"
                  }}>
                    {q[`justificativa${letra.toUpperCase()}`]}
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

            {/* BLOCOS DO PROFESSOR */}
            <div className="expert-row" style={st.expertRow}>
              <div style={{ ...st.expertBox, borderTop: "3px solid #4f46e5" }}>
                <div style={st.expertLabel}><FaStethoscope size={11} color="#818cf8" /> RACIOCÍNIO CLÍNICO</div>
                <p style={st.expertText}>{q.raciocinio || "Consulte o preceptor para esta explicação."}</p>
              </div>
              <div style={{ ...st.expertBox, borderTop: "3px solid #10b981" }}>
                <div style={st.expertLabel}><FaFlask size={11} color="#10b981" /> CONDUTA</div>
                <p style={st.expertText}>{q.tto || "Protocolo oficial do serviço."}</p>
              </div>
              <div style={{ ...st.expertBox, borderTop: "3px solid #fbbf24" }}>
                <div style={st.expertLabel}><FaLightbulb size={11} color="#fbbf24" /> DICA DO MESTRE</div>
                <p style={st.expertText}>{q.dicaMestre || "Atenção máxima a este tema."}</p>
              </div>
            </div>
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
          subcontexto_clinico={q.subcontexto_clinico}
          materia={q.materia}
          subtema={q.subtema}
          onClose={() => setShowTeoria(false)}
        />
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
