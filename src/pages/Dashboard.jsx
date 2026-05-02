import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { doc, onSnapshot, updateDoc, collection, getDocs, query, where, documentId, limit } from "firebase/firestore";
import { UserContext } from "../context/UserContext";
import {
  FaUserCircle, FaFire, FaChartLine, FaWhatsapp, FaStethoscope,
  FaBaby, FaVenusMars, FaUserShield, FaSyringe, FaArchive,
  FaCrown, FaFilter, FaLayerGroup, FaPlayCircle, FaTimes, FaEdit, FaClock, FaArrowRight, FaExclamationTriangle, FaLightbulb, FaBolt, FaCheckCircle,
  FaExternalLinkAlt, FaGift, FaCopy, FaCheck
} from "react-icons/fa";
import { SUPER_APOSTAS_CONFIG } from "../config/superApostasConfig";

const WHATSAPP_CONTATO = "5587996666667"; 

const DICAS_MESTRE = [
  "Abdome agudo inflamatório + febre em mulher jovem? Sempre descarte DIP antes de fechar apendicite!",
  "Sinal de Murphy positivo? Pense em Colecistite Aguda. Lembre-se: não costuma ter icterícia!",
  "Tríade de Charcot (Febre, Icterícia e Dor Abdominal) indica Colangite Aguda. Emergência!",
  "Na RCP em adultos, a profundidade das compressões deve ser de 5 a 6 cm. Mantenha o ritmo!",
  "Criança com estridor inspiratório e posição de tripé? Epiglotite é uma emergência de via aérea!",
  "Escala de Glasgow atualizada: a resposta pupilar agora faz parte da avaliação (GCS-P).",
  "Dengue: A prova do laço é fundamental na triagem de casos suspeitos sem sinais de alarme.",
  "Crise Asmática: O uso de corticoide sistêmico precoce reduz drasticamente a taxa de internação."
];

const Dashboard = ({ usuario }) => {
  const navigate = useNavigate();
  // Dados do usuário providos pelo UserContext (App.jsx) — sem listener duplicado
  const dadosUsuarioCtx = useContext(UserContext);
  const [dadosUser, setDadosUser] = useState(dadosUsuarioCtx || usuario || {});
  const [metaDiaria, setMetaDiaria] = useState((dadosUsuarioCtx || usuario)?.metaDiaria || 20);
  const [editandoMeta, setEditandoMeta] = useState(false);
  const [anoSelecionado, setAnoSelecionado] = useState(null);
  const [missoes, setMissoes] = useState([]);
  const [carregandoMissoes, setCarregandoMissoes] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  // isMobile reativo — atualiza ao girar tela ou redimensionar janela
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [_dicaDoMestre, setDicaDoMestre] = useState("");
  const [showIndicacao, setShowIndicacao] = useState(false);
  const [msgCopiada, setMsgCopiada] = useState(false);
  const [showPlanoSeletor, setShowPlanoSeletor] = useState(false);
  // Tick para forçar recálculo dos valores derivados ao voltar ao dashboard
  const [, setTick] = useState(0);
  // Gatilho de retorno: exibe "Você parou em X%, vamos continuar?" ao voltar à aba
  const [retornou, setRetornou] = useState(false);
  const pctMetaRef = React.useRef(0);

  // ── Atualização em tempo real ao voltar ao dashboard (aba ativada) ─────────
  // Não faz leitura ao Firestore — apenas força o React a recalcular todos os
  // valores derivados de dadosUser com o timestamp atual (hojeStrBRT, etc.).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        setTick(t => t + 1);
        // Gatilho de retorno: aluno saiu com progresso parcial e voltou
        if (pctMetaRef.current > 0 && pctMetaRef.current < 100) {
          setRetornou(true);
        }
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  // Atualiza isMobile ao redimensionar/girar a tela
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Auto-limpa o gatilho de retorno após 6 segundos
  useEffect(() => {
    if (!retornou) return;
    const timer = setTimeout(() => setRetornou(false), 6000);
    return () => clearTimeout(timer);
  }, [retornou]);

  // Dica aleatória — sem custo Firestore, executado uma vez na montagem
  useEffect(() => {
    const randomTip = DICAS_MESTRE[Math.floor(Math.random() * DICAS_MESTRE.length)];
    setDicaDoMestre(randomTip);
  }, []);

  // ── SINCRONIZAÇÃO COM CONTEXT ────────────────────────────────────────────
  // Substitui o onSnapshot duplicado do documento do usuário.
  // Os dados chegam via UserContext (App.jsx já mantém o listener real).
  // Toda vez que App.jsx atualiza dadosUsuario, este useEffect re-executa
  // e propaga as mudanças para o estado local sem nenhuma leitura Firestore extra.
  useEffect(() => {
    if (!dadosUsuarioCtx) return;
    setDadosUser(dadosUsuarioCtx);
    if (dadosUsuarioCtx.metaDiaria) setMetaDiaria(dadosUsuarioCtx.metaDiaria);
    if (dadosUsuarioCtx.boasVindasVisto === false) {
      setShowWelcome(true);
    }

    // Captura o total de revisões pendentes na primeira chegada de dados reais.
    // Mantém a mesma lógica anterior — apenas a fonte mudou (context vs snapshot).
    if (!revisoesPendentesInicialSetRef.current && dadosUsuarioCtx.revisoes !== undefined) {
      const hoje = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
        year: "numeric", month: "2-digit", day: "2-digit"
      }).format(new Date());
      const pendentesAgora = (dadosUsuarioCtx.revisoes || [])
        .filter(r => r.proximaRevisao && r.proximaRevisao <= hoje).length;
      revisoesPendentesInicialRef.current = pendentesAgora;
      revisoesPendentesInicialSetRef.current = true;
    }
  }, [dadosUsuarioCtx]);

  useEffect(() => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    setCarregandoMissoes(true);

    // ── MISSÕES DE RESGATE ────────────────────────────────────────────────────
    // Fonte: coleção `caderno_erros`, filtrada por usuarioId.
    // Esta coleção recebe um documento quando o aluno ERRA e tem o documento
    // DELETADO quando ele ACERTA a mesma questão (lógica em simuladorLogic.js).
    // Isso representa exatamente o estado atual de erros não-resolvidos —
    // independente de quantas questões corretas o aluno tenha respondido no tema.
    //
    // Motivo da troca: a abordagem anterior (subcoleção `respostas` com filtro
    // erros > acertos nos últimos 100 registros) falhava quando o aluno
    // acumulava muitos acertos no mesmo tema, suprimindo missões legítimas,
    // ou quando os erros saíam da janela de 100 questões.
    // limit(100): cap de leitura por usuário. O algoritmo de missões
    // agrupa por tema e pega os 5 piores — 100 docs cobrem qualquer
    // cenário real sem crescimento ilimitado de reads.
    const qMissoes = query(
      collection(db, "caderno_erros"),
      where("usuarioId", "==", uid),
      limit(100)
    );

    const unsubMissoes = onSnapshot(qMissoes, (snap) => {
      if (snap.empty) {
        setMissoes([]);
        setCarregandoMissoes(false);
        return;
      }
      const contadorPorTema = {};
      snap.docs.forEach(d => {
        const e = d.data();
        const chave = `${e.materia || 'Geral'}|${e.subtema || 'Geral'}`;
        if (!contadorPorTema[chave]) {
          contadorPorTema[chave] = {
            erros: 0,
            questaoIds: [],   // IDs das questões com erro neste tema (para cruzamento com errosRecentes)
            materia: e.materia || 'Geral',
            subtema: e.subtema || 'Geral'
          };
        }
        contadorPorTema[chave].erros++;
        if (e.questaoId) contadorPorTema[chave].questaoIds.push(e.questaoId);
      });
      // Aumenta para 5 temas para cobrir tanto "Recentes" quanto "Antigos"
      const temasCriticos = Object.values(contadorPorTema)
        .sort((a, b) => b.erros - a.erros)
        .slice(0, 5);
      setMissoes(temasCriticos);
      setCarregandoMissoes(false);
    }, (error) => {
      console.error("Erro no Protocolo de Missões:", error);
      setCarregandoMissoes(false);
    });

    return () => unsubMissoes();
  }, []);

  const fecharModalBemVindo = async () => {
    setShowWelcome(false);
    try {
      await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { boasVindasVisto: true });
    } catch (e) { console.error("Erro ao registrar boas vindas:", e); }
  };

  const calcularTempoMedio = () => {
    const totalResolvidas = (dadosUser?.totalAcertos || 0) + (dadosUser?.totalErros || 0);
    const tempoTotal = dadosUser?.tempoTotalEstudo || 0;
    if (totalResolvidas === 0) return "0s";
    const media = Math.round(tempoTotal / totalResolvidas);
    return media > 60 ? `${Math.floor(media / 60)}min` : `${media}s`;
  };

  const salvarNovaMeta = async (valor) => {
    try {
      const userRef = doc(db, "usuarios", auth.currentUser.uid);
      await updateDoc(userRef, { metaDiaria: Number(valor) });
      setMetaDiaria(valor);
      setEditandoMeta(false);
    } catch (e) { console.error(e); }
  };


  const irParaSimulador = (materia, subtema = null, provaId = null, modoMesclado = false) => {
    navigate("/simulador", { 
      state: { 
        materiaSelecionada: materia, 
        subtema: subtema, 
        provaId: provaId, 
        modoMesclado: modoMesclado,
        simuladoGeral: !materia && !provaId,
        limiteQuestoes: 100 
      } 
    });
    setAnoSelecionado(null);
  };

  // Busca os documentos de questão pelos IDs das revisoesPendentes e abre o simulador.
  // Usa questoesCustomizadas — o simulador carrega essa lista diretamente, sem query extra.
  // Firestore limita `in` a 30 IDs por query; os IDs são fatiados em chunks se necessário.
  const [carregandoRevisao, setCarregandoRevisao] = React.useState(false);

  // Captura o total de revisões pendentes na primeira carga do dia.
  // Permite calcular "feitas hoje = inicial - ainda pendentes" sem gravar no Firestore.
  // O ref não re-renderiza o componente e preserva o valor durante a sessão.
  const revisoesPendentesInicialRef = React.useRef(null);
  const revisoesPendentesInicialSetRef = React.useRef(false); // flag: captura feita apenas uma vez
  const irParaRevisao = async () => {
    const ids = revisoesPendentes.map(r => r.questaoId).filter(Boolean);
    if (ids.length === 0) return;
    setCarregandoRevisao(true);
    try {
      const chunks = [];
      for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));
      const snaps = await Promise.all(
        chunks.map(chunk =>
          getDocs(query(collection(db, "questoes"), where(documentId(), "in", chunk)))
        )
      );
      const questoesParaRevisar = snaps
        .flatMap(snap => snap.docs.map(d => ({ id: d.id, ...d.data() })))
        .sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id)); // mantém ordem de prioridade
      if (questoesParaRevisar.length === 0) return;
      navigate("/simulador", { state: { questoesCustomizadas: questoesParaRevisar } });
    } catch (e) {
      console.error("Erro ao carregar questões de revisão:", e);
    } finally {
      setCarregandoRevisao(false);
    }
  };

  const dRestantes = Math.max(0, Math.ceil(((dadosUser?.dataExpiracao?.toDate ? dadosUser.dataExpiracao.toDate() : new Date(dadosUser?.dataExpiracao || 0)) - new Date()) / (1000 * 60 * 60 * 24)));

  // ── DISPLAY DA META DIÁRIA — verificação de data antes de exibir ─────────
  // O reset real ocorre no simuladorLogic.js na primeira resposta do dia
  // (lazy reset). Aqui garantimos que o Dashboard mostra 0 se o campo
  // dataUltimaRespostaBRT for de outro dia — evita exibir o total de ontem
  // na barra de progresso enquanto o aluno ainda não respondeu nada hoje.
  // Sem nenhuma leitura/escrita extra ao Firestore.
  const hojeStrBRTDisplay = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit"
  }).format(new Date());
  const questoesHojeDisplay = (dadosUser?.dataUltimaRespostaBRT === hojeStrBRTDisplay)
    ? (dadosUser?.questoesHoje || 0)
    : 0;

  const pctMeta = Math.min(Math.round((questoesHojeDisplay / metaDiaria) * 100), 100);
  pctMetaRef.current = pctMeta; // sync para o handler de visibilitychange (evita closure stale)
  const faltamMeta = Math.max(0, metaDiaria - questoesHojeDisplay);

  // ── MOTIVAÇÃO DIÁRIA — sem custo de Firestore, apenas computed values ──────
  const horaAtualBRT = parseInt(
    new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "numeric", hour12: false })
      .format(new Date())
  );
  const blocoHorario = horaAtualBRT >= 5 && horaAtualBRT < 12 ? "manha"
    : horaAtualBRT >= 12 && horaAtualBRT < 18 ? "tarde"
    : "noite";
  const labelHorario = blocoHorario === "manha" ? "🌅 Comece bem o dia!"
    : blocoHorario === "tarde" ? "🔥 Ainda dá tempo de avançar!"
    : "🌙 Última chance de hoje!";

  const isNovoDia = dadosUser?.dataUltimaRespostaBRT && dadosUser.dataUltimaRespostaBRT !== hojeStrBRTDisplay;
  const isQuaseLa = pctMeta >= 70 && pctMeta < 100;
  const isMetaBatida = pctMeta >= 100;

  const mensagemMeta = isMetaBatida
    ? "🏆 Meta concluída! Excelente consistência!"
    : retornou && pctMeta > 0
    ? `👋 Você parou em ${pctMeta}%, vamos continuar?`
    : pctMeta >= 90
    ? `⚡ Último esforço! Só mais ${faltamMeta} ${faltamMeta === 1 ? "questão" : "questões"}!`
    : isQuaseLa
    ? "💪 Você está quase lá! Continue!"
    : questoesHojeDisplay > 0
    ? "🔥 Você já começou! Continue assim!"
    : isNovoDia
    ? `🌅 Novo dia, nova chance de evoluir! ${labelHorario}`
    : labelHorario;

  const corBarra = isMetaBatida ? '#10b981'
    : isQuaseLa ? '#f97316'
    : pctMeta > 0 ? '#4f46e5'
    : '#4f46e5';

  // ── MISSÕES: classifica por recente vs antigo ──────────────────────────────
  // errosRecentes = campo novo no documento do usuário (array de até 10 IDs)
  // Retrocompatível: se não existir, trata como array vazio
  const errosRecentesSet = new Set(dadosUser?.errosRecentes || []);
  // Todos os questaoIds atualmente em caderno_erros (erros não-resolvidos)
  const allCadernoIds = new Set(missoes.flatMap(m => m.questaoIds || []));
  // Temas que contêm pelo menos 1 erro recente (cruzamento com errosRecentes)
  const missoesRecentes = missoes.filter(m =>
    (m.questaoIds || []).some(id => errosRecentesSet.has(id))
  );
  // Temas com erros que NÃO estão em errosRecentes (erros antigos)
  const missoesAntigas = missoes.filter(m =>
    !(m.questaoIds || []).some(id => errosRecentesSet.has(id))
  );
  // IDs de erros recentes que foram resolvidos (não estão mais em caderno_erros) → indicador verde
  const errosRecentesResolvidos = (dadosUser?.errosRecentes || []).filter(id => !allCadernoIds.has(id)).length;

  // ── REVISÃO ESPAÇADA: questões cujo prazo de revisão chegou ───────────────
  // Usa o mesmo fuso BRT do backend para comparação correta de datas.
  // Retrocompatível: se `revisoes` não existir no documento, trata como [].
  const hojeStrBRT = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit"
  }).format(new Date());
  const revisoesPendentes = (dadosUser?.revisoes || [])
    .filter(r => r.proximaRevisao && r.proximaRevisao <= hojeStrBRT)
    .sort((a, b) => a.proximaRevisao.localeCompare(b.proximaRevisao)); // mais atrasadas primeiro

  const metaRevisoesHoje   = revisoesPendentesInicialRef.current ?? 0;
  const revisoesFeitasHoje = Math.max(0, metaRevisoesHoje - revisoesPendentes.length);
  const questoesHoje       = questoesHojeDisplay;  // usa display-safe (0 se for outro dia)
  // pctMeta reutiliza pctMeta (calculado logo abaixo) — evita duplicidade
  const pctRevisoes = metaRevisoesHoje > 0 ? Math.min(Math.round((revisoesFeitasHoje / metaRevisoesHoje) * 100), 100) : 100;

  // ── SCORE DE MEMÓRIA — calculado em tempo real, nunca salvo no Firestore ────
  // Converte o nivel de cada revisão em pontos: 1→30, 2→70, 3→100
  // e tira a média. Fallback seguro: se não houver revisoes, retorna null.
  const PONTOS_POR_NIVEL = { 1: 30, 2: 70, 3: 100 };
  const todasRevisoes = dadosUser?.revisoes || [];
  const scoreMemoria = todasRevisoes.length > 0
    ? Math.round(
        todasRevisoes.reduce((acc, r) => acc + (PONTOS_POR_NIVEL[r.nivel] ?? 30), 0)
        / todasRevisoes.length
      )
    : null;
  const corScore = scoreMemoria === null ? '#94a3b8'
    : scoreMemoria < 40  ? '#ef4444'
    : scoreMemoria < 70  ? '#fbbf24'
    : '#10b981';

  // ── GAMIFICATION BADGES — calculados em tempo real, sem custo de Firestore ──
  // Retrocompatível: todos os campos usam fallback para 0 ou array vazio.
  const totalQuestoes = (dadosUser?.totalAcertos || 0) + (dadosUser?.totalErros || 0);
  const streakAtual   = dadosUser?.streakAtual  || 0;
  const mediaGeral    = dadosUser?.mediaGeral   || 0;
  const totalRevisoes = (dadosUser?.revisoes    || []).length;

  const BADGES = [
    { emoji: '🔥', label: 'Ignição',    desc: '3 dias consecutivos',  earned: streakAtual   >= 3   },
    { emoji: '💊', label: 'Residente',  desc: '7 dias consecutivos',  earned: streakAtual   >= 7   },
    { emoji: '🏃', label: 'Maratona',   desc: '100 questões totais',  earned: totalQuestoes >= 100  },
    { emoji: '⚡', label: 'Cirurgião',  desc: '500 questões totais',  earned: totalQuestoes >= 500  },
    { emoji: '🏆', label: 'Aprovado',   desc: 'Média global ≥ 70%',   earned: mediaGeral    >= 70   },
    { emoji: '📅', label: 'Revisor',    desc: '10 revisões ativas',   earned: totalRevisoes >= 10   },
  ];

  const materias = [
    { nome: "Clínica Médica", icone: <FaStethoscope />, cor: "#818cf8" },
    { nome: "Cirurgia", icone: <FaSyringe />, cor: "#f87171" },
    { nome: "Pediatria", icone: <FaBaby />, cor: "#34d399" },
    { nome: "Ginecologia e Obstetrícia", icone: <FaVenusMars />, cor: "#f472b6" },
    { nome: "Preventiva", icone: <FaUserShield />, cor: "#fbbf24" }
  ];

  // ── PLANO DE HOJE — sistema adaptativo, zero custo Firestore ────────────
  const materiaFoco = missoesRecentes[0]?.materia || missoesAntigas[0]?.materia || null;

  // Total de erros abertos: revisão espaçada + caderno de erros (todos os temas)
  const totalRevisoesEspacadas = revisoesPendentes.length;
  const totalErrosCaderno      = missoes.reduce((s, m) => s + (m.erros || 0), 0);
  const totalParaRevisar       = totalRevisoesEspacadas + totalErrosCaderno;
  const temErros               = totalParaRevisar > 0;

  // ── PLANO DE HOJE — números reais, nunca estimativa ──────────────────────
  // qtdRev = totalRevisoesEspacadas: é exatamente o que o botão "Começar agora"
  // vai carregar no simulador via irParaRevisao(). Não tem discrepância possível.
  // qtdNovas = complemento até a meta (pode ser 0 se revisão já preenche tudo).
  const qtdRev   = totalRevisoesEspacadas;
  const qtdNovas = Math.max(0, metaDiaria - qtdRev);

  // Badge: sem erros espaçados mas com caderno → badge laranja
  const muitosErroCaderno = totalErrosCaderno > metaDiaria * 0.6;

  // "Hoje: 12 revisões + 8 novas questões"  |  "Hoje: 20 questões novas"
  const _planoLinha = qtdRev > 0
    ? `Hoje: ${qtdRev} ${qtdRev === 1 ? "revisão" : "revisões"} + ${qtdNovas} ${qtdNovas === 1 ? "nova questão" : "novas questões"}`
    : `Hoje: ${metaDiaria} questões novas`;

  // Linha de descrição — inclui nota de caderno quando houver erros pendentes lá
  const cadernoNota = totalErrosCaderno > 0
    ? ` · ${totalErrosCaderno} ${totalErrosCaderno === 1 ? "erro no caderno" : "erros no caderno"}`
    : "";
  const _planoDesc = qtdRev > 0
    ? `Revisão espaçada ativa${materiaFoco ? ` · Foco em ${materiaFoco}` : ""}${cadernoNota}`
    : temErros
    ? `${totalErrosCaderno} ${totalErrosCaderno === 1 ? "erro no caderno" : "erros no caderno"} · Inicie pelo tema crítico`
    : materiaFoco
    ? `Foco recomendado: ${materiaFoco}`
    : "Questões novas · Todas as áreas";

  const _planoBadge = qtdRev > 0
    ? "⚡ REVISÃO ESPAÇADA"
    : temErros
    ? (muitosErroCaderno ? "🔥 ERROS CRÍTICOS" : "📝 CADERNO DE ERROS")
    : isMetaBatida ? "🏆 EXTRA" : "📚 NOVAS QUESTÕES";
  const planoCor = qtdRev > 0 ? "#818cf8"
    : temErros ? (muitosErroCaderno ? "#f97316" : "#fbbf24")
    : isMetaBatida ? "#10b981" : "#4f46e5";

  // Botão: revisão espaçada primeiro → erros do caderno → questões novas
  const _iniciarPlano = () => {
    if (totalRevisoesEspacadas > 0) {
      irParaRevisao();
    } else if (missoesRecentes.length > 0) {
      irParaSimulador(missoesRecentes[0].materia, missoesRecentes[0].subtema);
    } else if (missoesAntigas.length > 0) {
      irParaSimulador(missoesAntigas[0].materia, missoesAntigas[0].subtema);
    } else {
      irParaSimulador(materiaFoco, null, null, false);
    }
  };

  // ── MISSÃO DIÁRIA — métricas para o painel expandido ─────────────────────
  // novaDone: questões novas completadas hoje (capped no target de novas)
  // pctGeral: progresso geral ponderado (novas + revisoes espaçadas)
  // tempoMissaoMin/Max: estimativa baseada em 2.4 min/questão (padrão INEP)
  const novaDone = Math.min(questoesHojeDisplay, Math.max(0, qtdNovas));
  const totalItemsPlano = Math.max(1, qtdNovas + (metaRevisoesHoje || 0));
  const doneItemsPlano = novaDone + (revisoesFeitasHoje || 0);
  const pctGeral = Math.min(100, Math.round((doneItemsPlano / totalItemsPlano) * 100));
  const itemsRestantes = Math.max(0,
    (qtdNovas - novaDone) +
    ((metaRevisoesHoje || 0) - (revisoesFeitasHoje || 0)) +
    totalErrosCaderno
  );
  const tempoBase = Math.round(itemsRestantes * 2.4);
  const tempoMissaoMin = Math.max(5, Math.round(tempoBase * 0.85));
  const tempoMissaoMax = Math.round(tempoBase * 1.15);

  // ── MENSAGENS DINÂMICAS — sem custo Firestore, puro computed ──────────────
  // faltamMeta já calculado logo após pctMeta (linha ~231)
  const msgFaltaMeta = isMetaBatida
    ? "✅ Meta concluída hoje!"
    : pctMeta >= 90
    ? `⚡ Último esforço! Faltam apenas ${faltamMeta} ${faltamMeta === 1 ? "questão" : "questões"}`
    : pctMeta >= 70
    ? `🏁 Você está quase lá! Faltam ${faltamMeta} questões`
    : faltamMeta > 0 && questoesHojeDisplay > 0
    ? `📌 Faltam ${faltamMeta} questões para completar sua meta`
    : "🚀 Comece agora e mantenha o ritmo!";

  const msgProgresso = pctMeta >= 100
    ? "Meta concluída 🏆"
    : pctMeta >= 70
    ? `Quase lá! Faltam ${faltamMeta} ${faltamMeta === 1 ? "questão" : "questões"}`
    : pctMeta >= 30
    ? `No ritmo! Faltam ${faltamMeta} questões`
    : pctMeta > 0
    ? `Começo iniciado · ${faltamMeta} restantes`
    : "Comece agora →";

  const msgStreak = streakAtual === 0
    ? "Inicie sua sequência hoje!"
    : !isMetaBatida && streakAtual >= 3
    ? `⚠️ Não perca seus ${streakAtual} dias de sequência!`
    : streakAtual >= 14 ? "Você está imparável! 🏆"
    : streakAtual >= 7  ? "Você está consistente 🔥"
    : streakAtual >= 3  ? "Ótima sequência! Continue!"
    : "Não perca hoje!";

  const msgDominio = scoreMemoria === null ? null
    : scoreMemoria < 50 ? "⚠️ Atenção: nível abaixo do ideal"
    : scoreMemoria < 70 ? "📈 Você está evoluindo"
    : "✅ Pronto para a prova";

  // Gatilho de identidade — baseado em desempenho acumulado
  const msgIdentidade = mediaGeral >= 80 ? "🏆 Acima da média"
    : mediaGeral >= 65 ? "📈 Você está evoluindo"
    : mediaGeral >= 50 ? "💡 Em progresso"
    : totalQuestoes >= 50 ? "🚀 Continue praticando"
    : null;

  if (auth.currentUser && !auth.currentUser.emailVerified) {
    return <div style={{ background: "#020617", height: "100vh", width: "100vw" }}></div>;
  }

  return (
    <div style={st.mainWrapper}>
      <div style={st.dashContainer}>

        {/* TOPO: Mais Médicos + Indique e Ganhe — 50/50 */}
        <div className="topo-duplo" style={st.topoDuplo}>
          {/* Esquerda: Mais Médicos */}
          <a
            href="https://www.maismedicosindicadores.com.br"
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: "none", display: "block", flex: 1 }}
          >
            <div style={{ ...st.bannerMaisMedicos, height: "100%", boxSizing: "border-box" }}>
              <div>
                <span style={st.bannerBadge}>🔗 PARCEIRO OFICIAL</span>
                <h3 style={st.bannerTitle}>Mais Médicos Indicadores</h3>
                <p style={st.bannerDesc}>Indicadores e métricas para médicos.</p>
              </div>
              <div style={st.bannerIconBox}><FaExternalLinkAlt size={16} color="#fff" /></div>
            </div>
          </a>

          {/* Direita: Indique e Ganhe */}
          <div onClick={() => setShowIndicacao(true)} style={{ flex: 1, cursor: "pointer" }}>
            <div style={st.bannerIndique}>
              <div>
                <span style={{ ...st.bannerBadge, color: "rgba(251,191,36,0.75)" }}>🎁 INDIQUE E GANHE</span>
                <h3 style={st.bannerTitle}>Ganhe 30% de Comissão</h3>
                <p style={{ ...st.bannerDesc, color: "rgba(253,230,138,0.8)" }}>Indique colegas e receba no Pix.</p>
              </div>
              <div style={{ ...st.bannerIconBox, background: "rgba(251,191,36,0.18)" }}>
                <FaGift size={16} color="#fbbf24" />
              </div>
            </div>
          </div>
        </div>

        {/* HEADER ORIGINAL */}
        <header className="dash-header" style={st.header}>
          <div style={st.profileInfo}>
            <div style={st.avatarWrapper}>
              {dadosUser?.fotoUrl ? (
                <img src={dadosUser.fotoUrl} style={st.fotoAvatar} alt="Perfil" />
              ) : (
                <FaUserCircle size={60} color={dadosUser?.role === 'admin' ? "#fbbf24" : "#4f46e5"} />
              )}
              <div className="pulse-online"></div>
            </div>
            <div>
              <h2 style={st.saudacao}>Olá, Dr. {dadosUser?.nome?.split(' ')[0] || "Colega"}</h2>
              <div style={st.badgeContainer}>
                {dadosUser?.role === 'admin' && <span style={st.badgeVip}><FaCrown size={10} /> DIRETOR</span>}
                <span style={{...st.badgeStatus, color: dRestantes <= 2 ? '#fbbf24' : '#fff', borderColor: dRestantes <= 2 ? '#fbbf24' : '#334155'}}>
                   <FaClock size={10} /> {dRestantes} dias restantes
                </span>
              </div>
            </div>
          </div>
          <div className="header-stats" style={st.headerStats}>
              <div className="stat-item" style={st.statItem}><small style={st.statLabel}>AGILIDADE</small><strong style={st.statValue}>{calcularTempoMedio()}</strong></div>
              <div className="stat-item" style={st.statItem}>
                <small style={st.statLabel}>MÉDIA GERAL</small>
                <strong style={st.statValue}>{dadosUser?.mediaGeral || 0}%</strong>
                {msgIdentidade && (
                  <small style={{fontSize: '8px', fontWeight: '800', color: mediaGeral >= 65 ? '#10b981' : '#94a3b8', display: 'block', lineHeight: 1.3, marginTop: '2px'}}>
                    {msgIdentidade}
                  </small>
                )}
              </div>
          </div>
        </header>

        {/* TOP GRID */}
        <div style={{ ...st.topGrid, gridTemplateColumns: isMobile ? "1fr" : "1.8fr 1fr" }}>
          <section style={st.cardHero}>
            <div style={st.heroHeader}><FaChartLine color="#10b981" /> <span>PERFORMANCE MÉDICA ATUAL</span></div>
            <div className="hero-content" style={st.heroContent}>
              <div style={st.chartBox}>
                <svg width="100" height="100">
                    <circle cx="50" cy="50" r="40" stroke="#0f172a" strokeWidth="8" fill="none" />
                    <circle cx="50" cy="50" r="40" stroke="#4f46e5" strokeWidth="8" fill="none" strokeDasharray="251" strokeDashoffset={251 - (251 * pctMeta) / 100} strokeLinecap="round" />
                </svg>
                <div style={{...st.chartLabel, gap: '2px'}}>
                  <h3 style={{fontSize: '20px', margin: 0, color: isMetaBatida ? '#10b981' : '#fff'}}>{pctMeta}%</h3>
                  <small style={{color: isMetaBatida ? '#10b981' : '#94a3b8', fontSize: '9px'}}>DA META</small>
                  <small style={{color: isMetaBatida ? '#10b981' : isQuaseLa ? '#f97316' : '#64748b', fontSize: '8px', fontWeight: '800', textAlign: 'center', lineHeight: 1.3, maxWidth: '90px'}}>{msgProgresso}</small>
                </div>
              </div>
              <div style={st.heroDetails}>
                <div className="mini-stat" onClick={() => setEditandoMeta(true)} style={st.clickableStat}>
                  <FaFire color={isMetaBatida ? '#10b981' : '#f97316'} size={18}/>
                  <div>
                    <small style={st.statCardLabel}>MISSÃO DO DIA (Personalizar)</small>
                    <p style={{...st.statCardValue, color: isMetaBatida ? '#10b981' : isQuaseLa ? '#f97316' : '#fff', fontSize: '15px', fontWeight: '900'}}>
                      {questoesHojeDisplay} / {metaDiaria} qts
                    </p>
                    <span style={{fontSize: '10px', color: isMetaBatida ? '#10b981' : isQuaseLa ? '#f97316' : '#94a3b8', fontWeight: '700', lineHeight: 1.3, display: 'block', marginBottom: '2px'}}>
                      {msgFaltaMeta}
                    </span>
                    <span className="blink-text" style={st.editLink}>AJUSTAR META <FaArrowRight size={8} /></span>
                  </div>
                </div>
                <div className="mini-stat" style={st.miniStat}>
                  <FaLayerGroup color="#818cf8" size={18}/>
                  <div><small style={st.statCardLabel}>SCORE TOTAL</small><p style={st.statCardValue}>{(dadosUser?.totalAcertos || 0) + (dadosUser?.totalErros || 0)} resolvidas</p></div>
                </div>
                <div className="mini-stat" style={st.miniStat}>
                  <FaFire color={streakAtual >= 3 ? '#f97316' : '#64748b'} size={18}/>
                  <div>
                    <small style={st.statCardLabel}>🔥 SEQUÊNCIA ATUAL</small>
                    <p style={{...st.statCardValue, fontSize: '16px', fontWeight: '900', color: streakAtual >= 7 ? '#f97316' : streakAtual >= 3 ? '#fbbf24' : '#fff'}}>
                      {streakAtual} {streakAtual === 1 ? "dia" : "dias"}
                    </p>
                    <span style={{fontSize: '10px', color: streakAtual >= 3 ? '#f97316' : '#64748b', fontWeight: '700', lineHeight: 1.3, display: 'block', marginBottom: '1px'}}>
                      {msgStreak}
                    </span>
                    {dadosUser?.melhorStreak > 0 && (
                      <span style={{ fontSize: "10px", color: "#475569" }}>Recorde: {dadosUser.melhorStreak} dias</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* MISSÃO DIÁRIA — painel expandido em tempo real */}
          <div style={{
            background: "linear-gradient(160deg, #0f172a 0%, #1e293b 100%)",
            border: `1px solid ${planoCor}44`,
            boxShadow: `0 0 20px ${planoCor}12`,
            borderRadius: "20px",
            padding: "18px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}>
            {/* Header: título + círculo de progresso geral */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <p style={{ color: "#94a3b8", fontSize: "10px", fontWeight: "800", letterSpacing: "1px", margin: "0 0 3px", textTransform: "uppercase" }}>
                  Seu plano de hoje
                </p>
                <h4 style={{ color: "#f1f5f9", fontSize: "15px", fontWeight: "900", margin: 0, letterSpacing: "-0.3px" }}>
                  🎯 Missão Diária
                </h4>
              </div>
              {/* Círculo de progresso geral */}
              <div style={{ position: "relative", width: "48px", height: "48px", flexShrink: 0 }}>
                <svg width="48" height="48" viewBox="0 0 48 48">
                  <circle cx="24" cy="24" r="19" stroke="#1e293b" strokeWidth="4" fill="none" />
                  <circle cx="24" cy="24" r="19"
                    stroke={pctGeral >= 100 ? "#10b981" : planoCor}
                    strokeWidth="4" fill="none"
                    strokeDasharray="119.4"
                    strokeDashoffset={119.4 - (119.4 * pctGeral / 100)}
                    strokeLinecap="round"
                    transform="rotate(-90 24 24)"
                    style={{ transition: "stroke-dashoffset 0.6s ease-out" }}
                  />
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: "11px", fontWeight: "900", color: pctGeral >= 100 ? "#10b981" : "#fff" }}>
                    {pctGeral}%
                  </span>
                </div>
              </div>
            </div>

            <p style={{ color: "#475569", fontSize: "11px", margin: "0", fontWeight: "700", letterSpacing: "0.3px" }}>
              Hoje você precisa:
            </p>

            {/* Linha 1: Novas questões */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "#94a3b8" }}>
                  <FaLayerGroup color="#4f46e5" size={11} />
                  Novas questões
                </span>
                <span style={{ fontSize: "11px", fontWeight: "900", color: novaDone >= qtdNovas && qtdNovas > 0 ? "#10b981" : "#fff" }}>
                  {novaDone}/{qtdNovas}{novaDone >= qtdNovas && qtdNovas > 0 ? " ✓" : ""}
                </span>
              </div>
              <div style={{ height: "5px", background: "#0f172a", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${qtdNovas > 0 ? Math.min(100, Math.round(novaDone / qtdNovas * 100)) : 100}%`, background: novaDone >= qtdNovas && qtdNovas > 0 ? "#10b981" : "#4f46e5", borderRadius: "4px", transition: "width 0.6s ease-out" }} />
              </div>
            </div>

            {/* Linha 2: Revisões espaçadas */}
            {metaRevisoesHoje > 0 && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "#94a3b8" }}>
                    <FaBolt color="#818cf8" size={11} />
                    Revisões espaçadas
                  </span>
                  <span style={{ fontSize: "11px", fontWeight: "900", color: pctRevisoes >= 100 ? "#10b981" : "#fff" }}>
                    {revisoesFeitasHoje}/{metaRevisoesHoje}{pctRevisoes >= 100 ? " ✓" : ""}
                  </span>
                </div>
                <div style={{ height: "5px", background: "#0f172a", borderRadius: "4px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pctRevisoes}%`, background: pctRevisoes >= 100 ? "#10b981" : "#818cf8", borderRadius: "4px", transition: "width 0.6s ease-out" }} />
                </div>
              </div>
            )}

            {/* Linha 3: Caderno de erros */}
            {totalErrosCaderno > 0 && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "#94a3b8" }}>
                    <FaExclamationTriangle color="#f97316" size={11} />
                    Caderno de erros
                  </span>
                  <span style={{ fontSize: "11px", fontWeight: "900", color: "#f97316" }}>
                    {totalErrosCaderno} em aberto
                  </span>
                </div>
                <div style={{ height: "5px", background: "#0f172a", borderRadius: "4px", overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    width: `${(errosRecentesResolvidos + totalErrosCaderno) > 0 ? Math.round(errosRecentesResolvidos / (errosRecentesResolvidos + totalErrosCaderno) * 100) : 0}%`,
                    background: "#f97316",
                    borderRadius: "4px",
                    transition: "width 0.6s ease-out"
                  }} />
                </div>
              </div>
            )}

            {/* Tempo estimado */}
            {tempoMissaoMin > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "rgba(255,255,255,0.03)", border: "1px solid #1e293b", borderRadius: "8px", padding: "6px 10px", fontSize: "11px", color: "#64748b", fontWeight: "700" }}>
                <FaClock color="#818cf8" size={10} />
                Tempo estimado: {tempoMissaoMin}–{tempoMissaoMax} min
              </div>
            )}

            {/* Botão dinâmico: Começar / Continuar / Finalizar / Concluído */}
            <button
              onClick={pctGeral < 100 ? () => setShowPlanoSeletor(true) : undefined}
              disabled={(totalRevisoesEspacadas > 0 && carregandoRevisao) || pctGeral >= 100}
              style={{
                background: pctGeral >= 100
                  ? "rgba(16,185,129,0.12)"
                  : `linear-gradient(135deg, ${planoCor}, ${planoCor}bb)`,
                border: pctGeral >= 100 ? "1px solid rgba(16,185,129,0.4)" : "none",
                borderRadius: "12px",
                padding: "11px 18px",
                cursor: pctGeral >= 100 ? "default" : "pointer",
                color: pctGeral >= 100 ? "#10b981" : "#fff",
                fontWeight: "900",
                fontSize: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                boxShadow: pctGeral >= 100 ? "none" : `0 4px 14px ${planoCor}40`,
                width: "100%",
                opacity: (totalRevisoesEspacadas > 0 && carregandoRevisao) ? 0.6 : 1,
                marginTop: "auto",
                letterSpacing: "0.3px",
              }}
            >
              {totalRevisoesEspacadas > 0 && carregandoRevisao ? (
                "Carregando..."
              ) : pctGeral >= 100 ? (
                <><FaCheckCircle size={12} /> Missão Concluída!</>
              ) : pctGeral >= 80 ? (
                <><FaBolt size={12} /> Finalizar</>
              ) : pctGeral > 0 ? (
                <><FaPlayCircle size={12} /> Continuar</>
              ) : (
                <><FaPlayCircle size={12} /> Começar agora</>
              )}
            </button>
          </div>

        </div>

        {/* Lembrete de revisão removido — informação consolidada no "Plano de Hoje" */}

        {/* DOMÍNIO — score de memória + interpretação contextual */}
        <div style={{...st.scoreMemoriaBar, flexDirection: 'column', alignItems: 'stretch', gap: '8px'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
            <span style={{fontSize: '13px'}}>🧠</span>
            <span style={{fontSize: '12px', color: '#94a3b8', fontWeight: '600'}}>Domínio atual:</span>
            {scoreMemoria !== null ? (
              <>
                <span style={{fontSize: '14px', fontWeight: '900', color: corScore, letterSpacing: '0.03em'}}>
                  {scoreMemoria}%
                </span>
                <div style={{flex: 1, height: '4px', background: '#1e293b', borderRadius: '4px', overflow: 'hidden', minWidth: '60px'}}>
                  <div style={{height: '100%', width: `${scoreMemoria}%`, background: corScore, borderRadius: '4px', transition: 'width 0.6s ease-out'}}/>
                </div>
              </>
            ) : (
              <span style={{fontSize: '11px', color: '#475569', fontStyle: 'italic'}}>Sem dados suficientes ainda</span>
            )}
          </div>
          {msgDominio && (
            <div style={{
              fontSize: '11px',
              fontWeight: '800',
              color: scoreMemoria < 50 ? '#f97316' : scoreMemoria < 70 ? '#fbbf24' : '#10b981',
              letterSpacing: '0.02em',
              paddingLeft: '21px',
            }}>
              {msgDominio}
            </div>
          )}
        </div>

        {/* META INTELIGENTE DIÁRIA */}
        <div style={{
          ...st.metaInteligente,
          ...(isQuaseLa && { border: '1px solid rgba(249,115,22,0.4)', boxShadow: '0 0 12px rgba(249,115,22,0.12)' }),
          ...(isMetaBatida && { border: '1px solid rgba(16,185,129,0.4)', boxShadow: '0 0 12px rgba(16,185,129,0.12)' }),
        }}>
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px'}}>
            <span style={{fontSize:'11px', fontWeight:'900', color:'#fff', letterSpacing:'0.05em'}}>🎯 META DE HOJE</span>
            {metaRevisoesHoje > 0 && (
              <span style={{fontSize:'9px', color:'#818cf8', fontWeight:'800', letterSpacing:'0.05em'}}>
                ⚡ REVISÃO INCLUÍDA
              </span>
            )}
          </div>

          {/* Mensagem motivacional dinâmica */}
          <div style={{
            fontSize: '10px',
            fontWeight: '700',
            color: isMetaBatida ? '#10b981' : isQuaseLa ? '#f97316' : '#94a3b8',
            marginBottom: '12px',
            letterSpacing: '0.02em',
            transition: 'color 0.4s ease',
          }}>
            {mensagemMeta}
          </div>

          {/* Barra: Novas questões */}
          <div style={{marginBottom: metaRevisoesHoje > 0 ? '10px' : '0'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'5px'}}>
              <span style={{fontSize:'11px', color:'#94a3b8'}}>📚 Novas questões</span>
              <span style={{fontSize:'11px', fontWeight:'800', color: isMetaBatida ? '#10b981' : '#fff'}}>
                {Math.min(questoesHoje, metaDiaria)}/{metaDiaria}
                {isMetaBatida && ' ✓'}
              </span>
            </div>
            <div style={{height:'6px', background:'#0f172a', borderRadius:'4px', overflow:'hidden'}}>
              <div className={isQuaseLa ? 'barra-quase-la' : ''} style={{
                height:'100%',
                width:`${pctMeta}%`,
                background: corBarra,
                borderRadius:'4px',
                transition:'width 0.6s ease-out, background 0.4s ease',
              }}/>
            </div>
          </div>

          {/* Micro-reward ao bater meta */}
          {isMetaBatida && (
            <div style={{
              marginTop: '8px',
              padding: '7px 10px',
              background: 'rgba(16,185,129,0.08)',
              border: '1px solid rgba(16,185,129,0.25)',
              borderRadius: '8px',
              fontSize: '10px',
              fontWeight: '700',
              color: '#10b981',
              textAlign: 'center',
              letterSpacing: '0.02em',
            }}>
              🚀 Você está à frente de muitos candidatos — constância é o que aprova!
            </div>
          )}

          {/* Barra: Revisões — só exibe quando houve pendências hoje */}
          {metaRevisoesHoje > 0 && (
            <div style={{marginTop: isMetaBatida ? '10px' : '0'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'5px'}}>
                <span style={{fontSize:'11px', color:'#94a3b8'}}>📅 Revisões</span>
                <span style={{fontSize:'11px', fontWeight:'800', color: pctRevisoes >= 100 ? '#10b981' : '#818cf8'}}>
                  {revisoesFeitasHoje}/{metaRevisoesHoje}
                  {pctRevisoes >= 100 && ' ✓'}
                </span>
              </div>
              <div style={{height:'6px', background:'#0f172a', borderRadius:'4px', overflow:'hidden'}}>
                <div style={{height:'100%', width:`${pctRevisoes}%`, background: pctRevisoes >= 100 ? '#10b981' : '#818cf8', borderRadius:'4px', transition:'width 0.6s ease-out'}}/>
              </div>
            </div>
          )}
        </div>

        {/* CONQUISTAS — badges calculados em tempo real sem custo extra */}
        <div style={st.conquistasSection}>
          <span style={{ fontSize: '11px', fontWeight: '900', color: '#94a3b8', letterSpacing: '0.05em' }}>
            🏅 CONQUISTAS
          </span>
          <div style={st.badgesRow}>
            {BADGES.map((b, i) => (
              <div key={i} style={b.earned ? st.badgeEarned : st.badgeUnearned} title={b.desc}>
                <span>{b.emoji}</span>
                <span>{b.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* MISSÕES DE RESGATE — com destaque de Recentes vs Antigos */}
        <h3 style={st.sectionTitle}>🎯 MISSÕES DE RESGATE</h3>

        {carregandoMissoes ? (
          <div style={st.missaoVazia}>Analisando histórico médico...</div>
        ) : missoes.length === 0 ? (
          <div style={st.missaoVazia}>🏆 Alta Médica Geral! Nenhum erro em aberto.</div>
        ) : (
          <>
            {/* 🔥 Erros Recentes — carrossel horizontal */}
            {missoesRecentes.length > 0 && (
              <>
                <div style={st.subSectionHeader}>
                  🔥 Erros Recentes
                  <span style={{color:'#64748b',fontWeight:'400'}}>— últimas tentativas</span>
                  <span style={st.carrosselHint}>deslize →</span>
                </div>
                <div style={st.carrosselWrap}>
                  <div className="carrossel-container" style={st.carrosselContainer}>
                    {missoesRecentes.map((m, idx) => (
                      <div key={`r-${idx}`}
                        onClick={() => irParaSimulador(m.materia, m.subtema)}
                        style={{...st.carrosselCard, borderLeft: '3px solid #ef4444'}}
                        className="carrossel-card">
                        <div style={{...st.missaoIcon, background: 'rgba(239,68,68,0.12)', flexShrink: 0}}>
                          <FaExclamationTriangle color="#ef4444" size={12}/>
                        </div>
                        <div style={{flex: 1, minWidth: 0}}>
                          <small style={{...st.missaoLabel, color: '#ef4444'}}>{m.materia.toUpperCase()}</small>
                          <h4 style={st.missaoTema}>{m.subtema}</h4>
                          <p style={st.missaoAviso}>{m.erros} questão{m.erros !== 1 ? "ões" : ""} em aberto.</p>
                          <span style={st.badgeRecente}>🔴 RECENTE</span>
                        </div>
                        <FaArrowRight color="#ef4444" size={12} style={{flexShrink: 0}} />
                      </div>
                    ))}
                  </div>
                  <div className="carrossel-fade-right" style={st.carrosselFade} />
                </div>
              </>
            )}

            {/* 📚 Erros Antigos — carrossel horizontal */}
            {missoesAntigas.length > 0 && (
              <>
                <div style={st.subSectionHeader}>
                  📚 Revisar Erros Antigos
                  <span style={st.carrosselHint}>deslize →</span>
                </div>
                <div style={st.carrosselWrap}>
                  <div className="carrossel-container" style={st.carrosselContainer}>
                    {missoesAntigas.map((m, idx) => (
                      <div key={`a-${idx}`}
                        onClick={() => irParaSimulador(m.materia, m.subtema)}
                        style={{...st.carrosselCard, borderLeft: '3px solid #fbbf24'}}
                        className="carrossel-card">
                        <div style={{...st.missaoIcon, background: 'rgba(251,191,36,0.1)', flexShrink: 0}}>
                          <FaExclamationTriangle color="#fbbf24" size={12}/>
                        </div>
                        <div style={{flex: 1, minWidth: 0}}>
                          <small style={{...st.missaoLabel, color: '#fbbf24'}}>{m.materia.toUpperCase()}</small>
                          <h4 style={st.missaoTema}>{m.subtema}</h4>
                          <p style={{...st.missaoAviso, color: '#fbbf24'}}>{m.erros} questão{m.erros !== 1 ? "ões" : ""} em aberto.</p>
                          <span style={st.badgeAntigo}>🟡 REVISAR</span>
                        </div>
                        <FaArrowRight color="#fbbf24" size={12} style={{flexShrink: 0}} />
                      </div>
                    ))}
                  </div>
                  <div className="carrossel-fade-right" style={st.carrosselFade} />
                </div>
              </>
            )}

            {/* 🟢 Conquistas Recentes — erros recentes já resolvidos */}
            {errosRecentesResolvidos > 0 && (
              <div style={st.conquistaBar}>
                🟢 <strong>{errosRecentesResolvidos}</strong> erro{errosRecentesResolvidos !== 1 ? "s" : ""} recente{errosRecentesResolvidos !== 1 ? "s" : ""} resolvido{errosRecentesResolvidos !== 1 ? "s" : ""}! Continue assim, Doutor.
              </div>
            )}
          </>
        )}

        {/* REVISÃO ESPAÇADA — exibe apenas quando há itens pendentes hoje */}
        {revisoesPendentes.length > 0 && (
          <>
            <h3 style={st.sectionTitle}>
              📅 REVISAR HOJE
              <span style={st.carrosselHint}>deslize →</span>
            </h3>
            <div style={st.carrosselWrap}>
              <div className="carrossel-container" style={st.carrosselContainer}>
                {revisoesPendentes.map((r, idx) => (
                  <div
                    key={`rev-${idx}`}
                    onClick={() => irParaSimulador(r.materia, r.subtema)}
                    style={{
                      ...st.carrosselCard,
                      borderLeft: '3px solid #818cf8',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: '4px',
                    }}
                    className="carrossel-card"
                  >
                    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%'}}>
                      <div style={{...st.missaoIcon, background: 'rgba(129,140,248,0.1)'}}>
                        <FaClock color="#818cf8" size={12}/>
                      </div>
                      <FaArrowRight color="#818cf8" size={11} style={{opacity: 0.5}}/>
                    </div>
                    <small style={{...st.missaoLabel, color: '#818cf8', marginTop: '8px'}}>{(r.materia || "Geral").toUpperCase()}</small>
                    <h4 style={{...st.missaoTema, margin: '2px 0 4px'}}>{r.subtema || "Geral"}</h4>
                    <p style={{...st.missaoAviso, margin: 0}}>Nível {r.nivel} · Programada para hoje</p>
                    <span style={{...st.badgeRevisao, marginTop: '6px'}}>📅 REVISÃO</span>
                  </div>
                ))}
              </div>
              <div className="carrossel-fade-right" style={st.carrosselFade} />
            </div>
          </>
        )}

        {/* MATÉRIAS ORIGINAIS */}
        <h3 style={st.sectionTitle}>ESTUDO POR ÁREAS DE ATUAÇÃO</h3>
        <div className="materias-grid" style={{ ...st.materiasGrid, gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(5, 1fr)" }}>
          {materias.map((m) => (
            <div key={m.nome} onClick={() => navigate("/buscar-tema", { state: { materiaPre: m.nome } })} style={{...st.materiaCard, borderBottom: `3px solid ${m.cor}`}} className="materia-card">
              <div style={{color: m.cor, fontSize: '24px', marginBottom: '8px'}}>{m.icone}</div>
              <h4 style={{margin: 0, fontSize: '12px', color: '#fff', fontWeight: 'bold'}}>{m.nome}</h4>
            </div>
          ))}
        </div>

        {/* SIMULADOS INEP ORIGINAIS */}
        <section style={st.acervoContainer}>
           <div style={st.acervoHeader}><FaArchive color="#fbbf24" size={16}/> <span style={{color: '#fff'}}>SIMULADOS INEP</span></div>
           <div className="anos-grid" style={{ ...st.anosGrid, gridTemplateColumns: isMobile ? "repeat(3, 1fr)" : "repeat(5, 1fr)" }}>
              {["2025", "2024", "2023", "2022", "2021"].map(ano => (
                <div key={ano} onClick={() => setAnoSelecionado(ano)} className="card-ano" style={st.cardAno}>
                    <strong style={{fontSize: '18px', color: '#fff'}}>{ano}</strong>
                    <small style={{color: '#94a3b8', fontWeight: 'bold', display: 'block', marginTop: '2px'}}>PROVA REAL</small>
                </div>
              ))}
           </div>
        </section>

        {/* WIDGETS ORIGINAIS */}
        <div className="bottom-widgets" style={{ ...st.bottomWidgetsGrid, gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)" }}>
            <div style={st.widgetCard}>
                <div style={st.widgetHeader}><FaChartLine color="#34d399"/> TERMÔMETRO REVALIDA</div>
                <div style={st.progressBarBg}>
                   <div style={{...st.progressBarFill, width: `${Math.min(dadosUser?.mediaGeral || 0, 100)}%`, background: (dadosUser?.mediaGeral || 0) >= 70 ? '#10b981' : '#fbbf24'}}></div>
                   <div style={st.progressTarget}></div>
                </div>
                <small style={{fontSize: '9px', color: '#94a3b8', marginTop: '8px', display: 'block'}}>
                    Sua média: <strong style={{color: '#fff'}}>{dadosUser?.mediaGeral || 0}%</strong> (Meta Segura: 70%)
                </small>
            </div>

            <div style={st.widgetCard} className="express-card" onClick={() => navigate('/simulador', { state: { simuladoGeral: true, limiteQuestoes: 10, comTempo: false }})}>
                <div style={st.widgetHeader}><FaBolt color="#ef4444"/> PLANTÃO EXPRESS</div>
                <p style={{fontSize: '11px', color: '#f1f5f9', margin: '5px 0', lineHeight: '1.4'}}>
                  10 Minutos livres? Gere 10 questões agora.
                </p>
                <div style={st.btnExpress}>INICIAR AGORA <FaArrowRight size={8}/></div>
            </div>

            <div
              style={{...st.widgetCard, borderLeft: '3px solid #ef4444', cursor: 'pointer'}}
              className="super-apostas-card"
              onClick={() => navigate('/super-apostas')}
            >
              <div style={st.widgetHeader}>
                <FaFire color="#ef4444"/> SUPER APOSTAS
              </div>
              <p style={{fontSize: '12px', color: '#f1f5f9', margin: '5px 0 8px', fontWeight: '700', lineHeight: '1.4'}}>
                {SUPER_APOSTAS_CONFIG.nome_botao}
              </p>
              <p style={{fontSize: '11px', color: '#94a3b8', margin: '0 0 10px', lineHeight: '1.4'}}>
                Questões de alta incidência com maior probabilidade de cair na prova.
              </p>
              <div style={{display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px', padding: '6px 10px', fontSize: '11px', color: '#ef4444', fontWeight: '800', width: 'fit-content'}}>
                ACESSAR AGORA <FaArrowRight size={9}/>
              </div>
            </div>
        </div>
      </div>

      {/* BOTÃO FLUTUANTE WHATSAPP ORIGINAL */}
      <div onClick={() => window.open(`https://wa.me/${WHATSAPP_CONTATO}`, "_blank")} className="float-whatsapp pulse-bt" style={st.floatWhatsapp}>
        <FaWhatsapp size={16} /> <span className="hide-on-mobile">CONTATO DIRETO</span>
      </div>

      {/* MODAL EDITAR META ORIGINAL */}
      {/* MODAL SELETOR DO PLANO — escolha livre com sugestão inteligente */}
      {showPlanoSeletor && (() => {
        // Lógica de recomendação: revisões > caderno > novas
        const recomendado = totalRevisoesEspacadas > 0 ? "revisoes"
          : totalErrosCaderno > 0 ? "caderno"
          : "novas";

        const opcoes = [
          {
            id: "revisoes",
            emoji: "⚡",
            titulo: "Revisões Espaçadas",
            desc: totalRevisoesEspacadas > 0
              ? `${totalRevisoesEspacadas} ${totalRevisoesEspacadas === 1 ? "questão pendente" : "questões pendentes"}`
              : "Nenhuma revisão pendente",
            cor: "#818cf8",
            disabled: totalRevisoesEspacadas === 0,
            acao: () => { setShowPlanoSeletor(false); irParaRevisao(); },
          },
          {
            id: "novas",
            emoji: "📚",
            titulo: "Novas Questões",
            desc: qtdNovas > 0
              ? `${qtdNovas} questões na sua meta de hoje`
              : `Meta de ${metaDiaria} questões já atingida`,
            cor: "#4f46e5",
            disabled: false,
            acao: () => { setShowPlanoSeletor(false); irParaSimulador(materiaFoco, null, null, false); },
          },
          {
            id: "caderno",
            emoji: "📝",
            titulo: "Caderno de Erros",
            desc: totalErrosCaderno > 0
              ? `${totalErrosCaderno} ${totalErrosCaderno === 1 ? "erro em aberto" : "erros em aberto"}`
              : "Nenhum erro pendente",
            cor: "#f97316",
            disabled: totalErrosCaderno === 0,
            acao: () => { setShowPlanoSeletor(false); navigate("/caderno-erros"); },
          },
        ];

        return (
          <div className="modal-overlay" onClick={() => setShowPlanoSeletor(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{maxWidth: '400px', background: '#0f172a', border: '1px solid #1e293b'}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px'}}>
                <h3 style={{color: '#fff', margin: 0, fontSize: '16px', fontWeight: '900'}}>🎯 Por onde começar?</h3>
                <button onClick={() => setShowPlanoSeletor(false)} style={st.btnClose}><FaTimes /></button>
              </div>
              <p style={{color: '#475569', fontSize: '11px', marginBottom: '18px', fontWeight: '600'}}>
                Escolha livremente ou siga a sugestão do sistema.
              </p>

              <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                {opcoes.map(op => (
                  <button
                    key={op.id}
                    onClick={op.disabled ? undefined : op.acao}
                    disabled={op.disabled}
                    style={{
                      background: op.disabled ? 'rgba(255,255,255,0.02)' : op.id === recomendado ? `linear-gradient(135deg, ${op.cor}22, ${op.cor}11)` : '#1e293b',
                      border: op.id === recomendado ? `1px solid ${op.cor}88` : '1px solid #334155',
                      borderRadius: '14px',
                      padding: '14px 16px',
                      cursor: op.disabled ? 'default' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      textAlign: 'left',
                      opacity: op.disabled ? 0.4 : 1,
                      transition: 'all 0.15s ease',
                      width: '100%',
                    }}
                  >
                    <span style={{fontSize: '22px', flexShrink: 0}}>{op.emoji}</span>
                    <div style={{flex: 1}}>
                      <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px'}}>
                        <strong style={{color: op.disabled ? '#475569' : '#fff', fontSize: '13px', fontWeight: '900'}}>{op.titulo}</strong>
                        {op.id === recomendado && !op.disabled && (
                          <span style={{fontSize: '9px', fontWeight: '900', color: op.cor, background: `${op.cor}22`, border: `1px solid ${op.cor}44`, borderRadius: '6px', padding: '2px 6px', letterSpacing: '0.5px'}}>
                            RECOMENDADO
                          </span>
                        )}
                      </div>
                      <small style={{color: op.disabled ? '#334155' : '#64748b', fontSize: '11px', fontWeight: '600'}}>{op.desc}</small>
                    </div>
                    {!op.disabled && (
                      <FaArrowRight size={12} color={op.id === recomendado ? op.cor : '#475569'} style={{flexShrink: 0}} />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {editandoMeta && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth: '400px', textAlign: 'center'}}>
            <h3 style={{color: '#fff', marginBottom: '20px'}}>Ajustar Meta Diária</h3>
            <div style={st.gridMetas}>
              {[20, 50, 100, 150].map(m => (
                <button key={m} onClick={() => salvarNovaMeta(m)} style={st.btnMetaOpcao}>{m} Qts</button>
              ))}
            </div>
            <button onClick={() => setEditandoMeta(false)} style={st.btnCancel}>CANCELAR</button>
          </div>
        </div>
      )}


      {/* MODAL SIMULADOS POR ANO ORIGINAL */}
      {anoSelecionado && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth: '500px'}}>
              <div style={st.modalHeader}>
                <h3 style={{color: '#fff', margin: 0, fontSize: '16px'}}><FaLayerGroup /> REVALIDA INEP {anoSelecionado}</h3>
                <button onClick={() => setAnoSelecionado(null)} style={st.btnClose}><FaTimes /></button>
              </div>
              <div style={st.edicoesList}>
                <div className="edicao-card" onClick={() => irParaSimulador(null, null, `${anoSelecionado}.1`)}>
                  <FaPlayCircle size={20} color="#10b981" />
                  <div><strong style={{color: '#fff', fontSize: '14px'}}>EDIÇÃO 01</strong><small style={{color: '#94a3b8', display: 'block'}}>1º Semestre de {anoSelecionado}</small></div>
                </div>
                <div className="edicao-card" onClick={() => irParaSimulador(null, null, `${anoSelecionado}.2`)}>
                  <FaPlayCircle size={20} color="#10b981" />
                  <div><strong style={{color: '#fff', fontSize: '14px'}}>EDIÇÃO 02</strong><small style={{color: '#94a3b8', display: 'block'}}>2º Semestre de {anoSelecionado}</small></div>
                </div>
                <div className="edicao-card" style={{border: '1px solid #4f46e5', background: 'rgba(79, 70, 229, 0.1)'}} onClick={() => irParaSimulador(null, null, anoSelecionado, true)}>
                  <FaLayerGroup size={20} color="#818cf8" />
                  <div><strong style={{color: '#fff', fontSize: '14px'}}>COMBO COMPLETO</strong><small style={{color: '#94a3b8', display: 'block'}}>Mesclar Edições 1 e 2</small></div>
                </div>
              </div>
          </div>
        </div>
      )}

      {/* MODAL BOAS-VINDAS ORIGINAL */}
      {showWelcome && (
        <div className="modal-overlay">
          <div className="modal-content welcome-anim" style={{maxWidth: '450px', textAlign: 'center', border: '1px solid #4f46e5', background: '#0f172a'}}>
            <div style={st.iconCircle}><FaCheckCircle size={40} color="#10b981" /></div>
            <h2 style={{color: '#fff', fontSize: '28px', margin: '20px 0 10px'}}>Seja Bem-vindo, Dr!</h2>
            <p style={{color: '#94a3b8', fontSize: '15px', lineHeight: '1.6', marginBottom: '25px'}}>
              Sua conta foi ativada com sucesso. Você acaba de ganhar <strong style={{color: '#fbbf24'}}>48 horas de acesso VIP</strong> para testar toda a nossa tecnologia. Aproveite!
            </p>
            <button onClick={fecharModalBemVindo} style={st.btnStart}>COMEÇAR MINHA JORNADA <FaArrowRight size={14}/></button>
          </div>
        </div>
      )}

      {/* MODAL INDIQUE E GANHE */}
      {showIndicacao && (() => {
        const nome = dadosUser?.nome || "Colega Médico";
        const email = dadosUser?.email || auth.currentUser?.email || "";
        const mensagem = `Olá! 👋\n\nEstou usando o *RevalidaPro* para me preparar para o Revalida INEP e está sendo incrível! 🩺\n\nA plataforma tem banco de questões completo, simulados das provas reais do INEP, caderno de erros personalizado, ranking entre residentes e muito mais.\n\n🔗 Acesse agora: *www.revalidapro.com.br*\n📊 Conheça também: *www.maismedicosindicadores.com.br* (acesso gratuito para médicos)\n\nPara assinar, entre em contato e informe que foi indicado(a) por *${nome} — ${email}* para registrar a indicação.\n\nVamos juntos na jornada da residência! 💙`;
        const copiar = () => {
          navigator.clipboard.writeText(mensagem);
          setMsgCopiada(true);
          setTimeout(() => setMsgCopiada(false), 2500);
        };
        const compartilhar = () => window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(mensagem)}`, "_blank");
        // ── PLANOS DE INDICAÇÃO ────────────────────────────────────────────────
        // Para alterar: edite apenas o campo `preco` (número inteiro em centavos ou reais).
        // A comissão (30%) é calculada automaticamente — não precisa atualizar manualmente.
        const COMISSAO_PCT = 0.30;
        const fmt = (val) => val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        const planosBase = [
          { nome: "30 Dias",             preco: 79.99  },
          { nome: "90 Dias",             preco: 209.99 },
          { nome: "180 Dias — Dr. Plus", preco: 359.99 },
          { nome: "360 Dias — CRM PRO",  preco: 599.99 },
        ];
        const planos = planosBase.map(p => ({
          nome:     p.nome,
          valor:    fmt(p.preco),
          comissao: fmt(Math.round(p.preco * COMISSAO_PCT * 100) / 100),
        }));
        return (
          <div className="modal-overlay">
            <div className="modal-content" style={{maxWidth: "520px"}}>
              <div style={st.modalHeader}>
                <div style={{display:"flex", alignItems:"center", gap:"10px"}}>
                  <FaGift color="#fbbf24" size={18}/>
                  <h3 style={{color:"#fff", margin:0, fontSize:"17px", fontWeight:"900"}}>Programa Indique e Ganhe</h3>
                </div>
                <button onClick={() => setShowIndicacao(false)} style={st.btnClose}><FaTimes /></button>
              </div>

              {/* COMO FUNCIONA */}
              <div style={{background:"rgba(251,191,36,0.06)", border:"1px solid rgba(251,191,36,0.2)", borderRadius:"14px", padding:"14px 16px", marginBottom:"16px"}}>
                <p style={{color:"#fde68a", fontSize:"11px", fontWeight:"900", letterSpacing:"1px", margin:"0 0 6px"}}>COMO FUNCIONA</p>
                <p style={{color:"#cbd5e1", fontSize:"12px", margin:0, lineHeight:1.6}}>
                  Compartilhe a mensagem abaixo com seus colegas. Quando alguém assinar o RevalidaPro mencionando seu nome e e-mail, você recebe <strong style={{color:"#fbbf24"}}>30% do valor do plano</strong> direto no seu Pix. Simples assim.
                </p>
              </div>

              {/* TABELA DE COMISSÕES */}
              <p style={{color:"#94a3b8", fontSize:"10px", fontWeight:"900", letterSpacing:"1px", margin:"0 0 8px"}}>SUA COMISSÃO POR PLANO</p>
              <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"6px", marginBottom:"16px"}}>
                <div style={{background:"#0f172a", borderRadius:"8px", padding:"6px 8px", textAlign:"center"}}><p style={{color:"#64748b", fontSize:"9px", margin:"0 0 2px", fontWeight:"700"}}>PLANO</p></div>
                <div style={{background:"#0f172a", borderRadius:"8px", padding:"6px 8px", textAlign:"center"}}><p style={{color:"#64748b", fontSize:"9px", margin:"0 0 2px", fontWeight:"700"}}>VALOR</p></div>
                <div style={{background:"#0f172a", borderRadius:"8px", padding:"6px 8px", textAlign:"center"}}><p style={{color:"#64748b", fontSize:"9px", margin:"0 0 2px", fontWeight:"700"}}>SEU GANHO</p></div>
                {planos.map((p, i) => (
                  <React.Fragment key={i}>
                    <div style={{background:"#1e293b", borderRadius:"8px", padding:"8px", textAlign:"center", border:"1px solid #334155"}}><p style={{color:"#e2e8f0", fontSize:"10px", margin:0, fontWeight:"600"}}>{p.nome}</p></div>
                    <div style={{background:"#1e293b", borderRadius:"8px", padding:"8px", textAlign:"center", border:"1px solid #334155"}}><p style={{color:"#94a3b8", fontSize:"10px", margin:0}}>{p.valor}</p></div>
                    <div style={{background:"rgba(251,191,36,0.08)", borderRadius:"8px", padding:"8px", textAlign:"center", border:"1px solid rgba(251,191,36,0.25)"}}><p style={{color:"#fbbf24", fontSize:"11px", margin:0, fontWeight:"900"}}>{p.comissao}</p></div>
                  </React.Fragment>
                ))}
              </div>

              {/* MENSAGEM PRONTA */}
              <p style={{color:"#94a3b8", fontSize:"10px", fontWeight:"900", letterSpacing:"1px", margin:"0 0 8px"}}>SUA MENSAGEM DE INDICAÇÃO</p>
              <div style={{background:"#0f172a", border:"1px solid #334155", borderRadius:"12px", padding:"14px", marginBottom:"14px", fontSize:"12px", color:"#cbd5e1", lineHeight:1.7, whiteSpace:"pre-wrap", maxHeight:"160px", overflowY:"auto"}}>
                {mensagem}
              </div>
              <p style={{color:"#475569", fontSize:"10px", margin:"0 0 16px"}}>
                Seu nome e e-mail (<strong style={{color:"#94a3b8"}}>{email}</strong>) já estão na mensagem para identificar sua indicação.
              </p>

              {/* BOTÕES */}
              <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px"}}>
                <button onClick={copiar} style={{background: msgCopiada ? "rgba(16,185,129,0.15)" : "#1e293b", border: msgCopiada ? "1px solid #10b981" : "1px solid #334155", color: msgCopiada ? "#10b981" : "#fff", borderRadius:"12px", padding:"12px", fontWeight:"700", fontSize:"12px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:"8px", transition:"0.2s"}}>
                  {msgCopiada ? <><FaCheck size={12}/> Copiado!</> : <><FaCopy size={12}/> Copiar Mensagem</>}
                </button>
                <button onClick={compartilhar} style={{background:"#10b981", border:"none", color:"#fff", borderRadius:"12px", padding:"12px", fontWeight:"700", fontSize:"12px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:"8px"}}>
                  <FaWhatsapp size={14}/> Compartilhar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <style>{`
        .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 5000; padding: 20px; }
        .modal-content { background: #0f172a; border: 1px solid #334155; border-radius: 20px; padding: 30px; width: 100%; max-height: 90vh; overflow-y: auto; }
        .materia-card { transition: 0.2s; cursor: pointer; border: 1px solid #334155; }
        .materia-card:hover { transform: translateY(-3px); background: #2d3748 !important; border-color: #4f46e5; }
        .card-ano { transition: 0.2s; cursor: pointer; border: 1px solid #334155; }
        .card-ano:hover { background: #4f46e5 !important; transform: scale(1.03); }
        .edicao-card { background: #1e293b; padding: 15px; border-radius: 12px; display: flex; gap: 15px; align-items: center; cursor: pointer; border: 1px solid #334155; transition: 0.2s; margin-bottom: 8px; }
        .edicao-card:hover { border-color: #4f46e5; transform: translateX(5px); background: #262f3f; }
        .card-missao:hover { transform: translateX(5px); border-color: #ef4444; background: #0f172a !important; }
        .express-card:hover { border-color: #ef4444 !important; transform: translateY(-2px); background: #262f3f !important; }
        .super-apostas-card:hover { border-color: #ef4444 !important; transform: translateY(-2px); background: #262f3f !important; }
        .blink-text { animation: blink 2s infinite; }
        .pulse-online { position: absolute; bottom: 2px; right: 2px; width: 12px; height: 12px; background: #10b981; border: 2px solid #0f172a; border-radius: 50%; }
        .float-anim { animation: floating 3s ease-in-out infinite; }
        .icon-pulse { animation: pulseIcon 2s infinite; }
        .pulse-bt { animation: pulseButton 2s infinite; }
        .welcome-anim { animation: slideUp 0.5s ease-out; }
        @keyframes floating { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes pulseIcon { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.2); opacity: 0.8; } }
        @keyframes pulseButton { 0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); } 70% { box-shadow: 0 0 0 15px rgba(16, 185, 129, 0); } 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); } }
        @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes blink { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes quaseLaShimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        .barra-quase-la { background: linear-gradient(90deg, #f97316, #fbbf24, #f97316) !important; background-size: 200% auto !important; animation: quaseLaShimmer 1.8s linear infinite !important; }
        @media (max-width: 768px) {
          .dash-container { padding: 15px 10px 80px 10px !important; }
          .dash-header { flex-direction: column !important; align-items: flex-start !important; gap: 15px; }
          .header-stats { width: 100%; border-top: 1px solid #1e293b; padding-top: 15px; justify-content: space-between !important; }
          .stat-item { text-align: left !important; border-left: none !important; border-right: 2px solid #334155; padding-right: 15px; padding-left: 0 !important; }
          .stat-item:last-child { border-right: none !important; }
          .top-grid { grid-template-columns: 1fr !important; }
          .topo-duplo { flex-direction: column !important; }
          .hero-content { flex-direction: column !important; text-align: center; gap: 15px !important; }
          .materias-grid { display: flex !important; overflow-x: auto !important; padding-bottom: 10px; -webkit-overflow-scrolling: touch; scroll-snap-type: x mandatory; }
          .materia-card { min-width: 140px; flex: 0 0 auto; scroll-snap-align: start; }
          .anos-grid { display: flex !important; overflow-x: auto !important; padding-bottom: 10px; -webkit-overflow-scrolling: touch; scroll-snap-type: x mandatory; }
          .card-ano { min-width: 100px; flex: 0 0 auto; scroll-snap-align: start; }
          .materias-grid::-webkit-scrollbar, .anos-grid::-webkit-scrollbar { height: 4px; }
          .materias-grid::-webkit-scrollbar-thumb, .anos-grid::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
          .missao-grid { grid-template-columns: 1fr !important; }
          .carrossel-container { scroll-behavior: smooth; }
          .carrossel-container::-webkit-scrollbar { display: none; }
          .carrossel-container { -ms-overflow-style: none; scrollbar-width: none; }
          .carrossel-card:hover { transform: translateY(-2px); border-color: rgba(79,70,229,0.5) !important; }
          .carrossel-card:active { transform: scale(0.98); }
          .bottom-widgets { grid-template-columns: 1fr !important; }
          .hide-on-mobile { display: none; }
        }
      `}</style>
    </div>
  );
};

const st = {
  mainWrapper: { background: "#020617", minHeight: "100vh" },
  dashContainer: { padding: "15px 20px 20px", maxWidth: "1100px", margin: "0 auto" },
  topoDuplo: { display: "flex", gap: "12px", marginBottom: "15px", alignItems: "stretch" },
  bannerMaisMedicos: { background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)", borderRadius: "16px", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 8px 25px rgba(79,70,229,0.3)", cursor: "pointer" },
  bannerIndique: { background: "linear-gradient(135deg, #78350f, #451a03)", borderRadius: "16px", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 8px 25px rgba(251,191,36,0.12)", cursor: "pointer", border: "1px solid rgba(251,191,36,0.25)", height: "100%", boxSizing: "border-box" },
  bannerBadge: { fontSize: "9px", fontWeight: "800", color: "rgba(255,255,255,0.7)", letterSpacing: "1px", display: "block", marginBottom: "4px" },
  bannerTitle: { color: "#fff", fontSize: "14px", fontWeight: "700", margin: "0 0 2px" },
  bannerDesc: { color: "rgba(255,255,255,0.7)", fontSize: "11px", margin: 0 },
  bannerIconBox: { width: "38px", height: "38px", background: "rgba(255,255,255,0.15)", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginLeft: "12px" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }, 
  saudacao: { fontSize: "26px", fontWeight: "900", color: "#fff", margin: 0 },
  profileInfo: { display: "flex", alignItems: "center", gap: "20px" },
  avatarWrapper: { position: "relative" },
  fotoAvatar: { width: 60, height: 60, borderRadius: '50%', border: '2px solid #4f46e5', objectFit: 'cover' },
  badgeContainer: { display: "flex", gap: "8px", marginTop: "4px" },
  badgeVip: { background: "#fbbf24", color: "#000", padding: "3px 8px", borderRadius: "6px", fontWeight: "900", fontSize: "10px", display: "flex", alignItems: "center", gap: "4px" },
  badgeStatus: { background: "#1e293b", color: "#fff", padding: "3px 8px", borderRadius: "6px", fontWeight: "bold", fontSize: "10px", border: "1px solid #334155", display: 'flex', alignItems: 'center', gap: '6px' },
  statLabel: { color: "#94a3b8", fontWeight: "bold", letterSpacing: "1px", fontSize: "9px" },
  statValue: { color: "#fff", fontSize: "20px", display: "block" },
  statItem: { textAlign: "right", borderLeft: "2px solid #334155", paddingLeft: "15px" },
  headerStats: { display: "flex", gap: "20px" },
  topGrid: { display: "grid", gap: "15px", marginBottom: "15px" },
  cardHero: { padding: "20px", background: "#1e293b", borderRadius: "20px", border: "1px solid #334155" },
  heroHeader: { fontSize: "11px", fontWeight: "900", color: "#818cf8", letterSpacing: "1px", marginBottom: "15px", display: "flex", alignItems: "center", gap: "8px" },
  heroContent: { display: "flex", alignItems: "center", gap: "25px" },
  chartBox: { position: "relative", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" },
  chartLabel: { position: "absolute", textAlign: "center" },
  heroDetails: { display: "flex", flexDirection: "column", gap: "10px", flex: 1 },
  clickableStat: { background: "#0f172a", padding: "12px", borderRadius: "14px", border: "1px solid #4f46e5", cursor: "pointer", display: "flex", gap: "12px", alignItems: "center", transition: '0.2s' },
  editLink: { fontSize: '8px', color: '#4f46e5', fontWeight: 'bold', textTransform: 'uppercase', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '5px' },
  miniStat: { background: "#0f172a", padding: "12px", borderRadius: "14px", border: "1px solid #1e293b", display: "flex", gap: "12px", alignItems: "center" },
  statCardLabel: { color: "#818cf8", fontWeight: "bold", fontSize: "10px", display: "block" },
  statCardValue: { color: "#fff", fontWeight: "900", fontSize: "16px", margin: 0 },
  bannerVip: { background: "linear-gradient(135deg, #064e3b, #022c22)", borderRadius: "20px", padding: "20px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: "1px solid #10b981", cursor: "pointer" },
  btnBanner: { marginTop: 12, background: '#10b981', color: '#fff', padding: '8px 16px', borderRadius: '8px', fontSize: '10px', fontWeight: 'bold' },
  sectionTitle: { fontSize: "12px", fontWeight: "900", color: "#fff", letterSpacing: "1px", marginBottom: "15px", display: "flex", alignItems: "center", gap: "6px" },
  missaoGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px', marginBottom: '15px' },
  missaoCard: { background: '#0f172a', padding: '15px', borderRadius: '18px', border: '1px solid #334155', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', transition: '0.2s' },
  // ── CARROSSEL ─────────────────────────────────────────────────────────────
  carrosselWrap: { position: 'relative', marginBottom: '16px' },
  carrosselContainer: {
    display: 'flex', overflowX: 'auto', gap: '12px',
    scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch',
    paddingBottom: '4px', paddingRight: '36px',
  },
  carrosselCard: {
    background: '#0f172a', padding: '15px', borderRadius: '18px',
    border: '1px solid #334155', display: 'flex', alignItems: 'center',
    gap: '12px', cursor: 'pointer', transition: 'transform 0.2s, border-color 0.2s',
    width: '272px', minWidth: '272px', flexShrink: 0, scrollSnapAlign: 'start',
  },
  carrosselFade: {
    position: 'absolute', top: 0, right: 0, bottom: '4px', width: '48px',
    background: 'linear-gradient(to right, transparent, #020617)',
    pointerEvents: 'none', borderRadius: '0 18px 18px 0',
  },
  carrosselHint: {
    marginLeft: 'auto', fontSize: '9px', color: '#334155', fontWeight: '700',
    letterSpacing: '0.5px', display: 'inline-flex', alignItems: 'center', gap: '3px',
  },
  // ──────────────────────────────────────────────────────────────────────────
  missaoIcon: { background: 'rgba(239, 68, 68, 0.1)', padding: '8px', borderRadius: '10px' },
  missaoLabel: { fontSize: '8px', color: '#ef4444', fontWeight: '900', letterSpacing: '1px' },
  missaoTema: { margin: '2px 0', fontSize: '13px', color: '#fff', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' },
  missaoAviso: { margin: 0, fontSize: '10px', color: '#64748b' },
  missaoVazia: { background: '#0f172a', padding: '15px', borderRadius: '18px', color: '#64748b', fontSize: '12px', fontWeight: '600', textAlign: 'center', border: '1px solid #1e293b' },
  subSectionHeader: { fontSize: '11px', fontWeight: '900', color: '#f1f5f9', letterSpacing: '0.5px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' },
  badgeRecente: { fontSize: '9px', fontWeight: '900', color: '#ef4444', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '6px', padding: '2px 7px', display: 'inline-block', marginTop: '4px', letterSpacing: '0.3px' },
  badgeAntigo: { fontSize: '9px', fontWeight: '900', color: '#fbbf24', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: '6px', padding: '2px 7px', display: 'inline-block', marginTop: '4px', letterSpacing: '0.3px' },
  badgeRevisao: { fontSize: '9px', fontWeight: '900', color: '#818cf8', background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.25)', borderRadius: '6px', padding: '2px 6px', letterSpacing: '0.5px', display: 'inline-block' },
  btnClose: { background: 'rgba(255,255,255,0.05)', border: '1px solid #334155', color: '#94a3b8', borderRadius: '8px', width: '30px', height: '30px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' },
  edicoesList: { display: 'flex', flexDirection: 'column', gap: '8px' },
  iconCircle: { width: '80px', height: '80px', background: 'rgba(16,185,129,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' },
  btnStart: { background: 'linear-gradient(135deg, #4f46e5, #4338ca)', color: '#fff', border: 'none', padding: '14px 28px', borderRadius: '14px', cursor: 'pointer', fontWeight: '900', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '10px', margin: '0 auto', letterSpacing: '0.5px', boxShadow: '0 8px 20px rgba(79,70,229,0.35)' },
  conquistasSection: { display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px' },
  badgesRow: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  badgeEarned: { display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(79,70,229,0.12)', border: '1px solid rgba(79,70,229,0.35)', borderRadius: '10px', padding: '6px 10px', fontSize: '11px', color: '#fff', fontWeight: '700', cursor: 'default' },
  badgeUnearned: { display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.03)', border: '1px solid #1e293b', borderRadius: '10px', padding: '6px 10px', fontSize: '11px', color: '#334155', fontWeight: '700', filter: 'grayscale(1)', cursor: 'default' },
  scoreMemoriaBar: { display: 'flex', alignItems: 'center', gap: '8px', background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '10px 14px', marginBottom: '12px' },
  metaInteligente: { background: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px', padding: '16px', marginBottom: '14px', transition: 'border 0.3s ease, box-shadow 0.3s ease' },
  // ── ESTUDO POR ÁREAS / SIMULADOS INEP / WIDGETS ────────────────────────────
  materiasGrid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '15px' },
  materiaCard: { background: '#0f172a', padding: '16px', borderRadius: '16px', textAlign: 'center', cursor: 'pointer', border: '1px solid #1e293b', transition: 'transform 0.2s, border-color 0.2s' },
  acervoContainer: { background: '#0f172a', borderRadius: '20px', padding: '20px', marginBottom: '15px', border: '1px solid #1e293b' },
  acervoHeader: { fontSize: '12px', fontWeight: '900', color: '#94a3b8', letterSpacing: '1px', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' },
  anosGrid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' },
  cardAno: { background: '#1e293b', padding: '14px 10px', borderRadius: '14px', textAlign: 'center', cursor: 'pointer', transition: 'transform 0.15s, background 0.15s' },
  bottomWidgetsGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '15px' },
  widgetCard: { background: '#0f172a', borderRadius: '16px', padding: '16px', border: '1px solid #1e293b' },
  widgetHeader: { fontSize: '11px', fontWeight: '900', color: '#94a3b8', letterSpacing: '1px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' },
  progressBarBg: { height: '8px', background: '#1e293b', borderRadius: '4px', overflow: 'hidden', position: 'relative', marginBottom: '5px' },
  progressBarFill: { height: '100%', borderRadius: '4px', transition: 'width 0.6s ease-out' },
  progressTarget: { position: 'absolute', top: 0, left: '70%', width: '2px', height: '100%', background: '#334155' },
  btnExpress: { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', borderRadius: '8px', padding: '6px 12px', fontSize: '11px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', width: 'fit-content', letterSpacing: '0.3px' },
};

export default Dashboard;
