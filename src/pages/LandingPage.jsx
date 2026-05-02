import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./LandingPage.css";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import {
  FaPlayCircle, FaArrowRight, FaCheckCircle, FaTimesCircle,
  FaBrain, FaFire, FaChartLine, FaLock, FaShieldAlt,
  FaCreditCard, FaWhatsapp, FaCrown, FaStethoscope, FaBolt,
  FaChevronDown, FaChevronUp, FaSpinner, FaUserMd,
  FaRegClock, FaTrophy, FaLayerGroup, FaStar
} from "react-icons/fa";

// ─── Constantes ────────────────────────────────────────────────────────────────
const WHATSAPP = "5587996666667";
const CLOUD_FN = "https://us-central1-revalidapro-f812e.cloudfunctions.net/criarPreferencia";


// ─── Questão demo — caso clínico Revalida estilo real ─────────────────────────
const QUESTAO_DEMO = {
  enunciado: `Mulher, 29 anos, G2P1, com 8 semanas de amenorreia, é atendida no pronto-socorro com dor abdominal intensa em fossa ilíaca direita com irradiação para o ombro direito, sangramento vaginal leve e um episódio de síncope. Ao exame: PA 78×48 mmHg, FC 136 bpm, abdome com defesa muscular difusa e sinal de Blumberg positivo. Teste de gravidez positivo. Qual é a conduta IMEDIATA?`,
  alternativas: [
    {
      letra: "A",
      texto: "Solicitar ultrassom transvaginal e dosagem de beta-hCG seriado a cada 48 horas para confirmar o diagnóstico.",
      correta: false,
      justificativa: "INCORRETA — A paciente está em choque hipovolêmico (PA 78×48, FC 136, síncope). Exames de imagem são contraindicados quando a instabilidade hemodinâmica impõe cirurgia imediata. Aguardar resultados representa risco de morte."
    },
    {
      letra: "B",
      texto: "Administrar metotrexato intramuscular e internar para observação por 24 horas.",
      correta: false,
      justificativa: "INCORRETA — O metotrexato é indicado para gravidez ectópica ÍNTEGRA, hemodinamicamente estável, sem sinais de ruptura. Na ruptura com choque, é absolutamente contraindicado — não trata o sangramento ativo."
    },
    {
      letra: "C",
      texto: "Realizar laparoscopia diagnóstica para confirmar gravidez ectópica antes da conduta definitiva.",
      correta: false,
      justificativa: "INCORRETA — Paciente instável não tolera pneumoperitônio e posicionamento de laparoscopia com segurança. Na instabilidade hemodinâmica, a laparotomia exploradora é a via de acesso de escolha — mais rápida e segura."
    },
    {
      letra: "D",
      texto: "Laparotomia exploradora de emergência com reposição volêmica simultânea.",
      correta: true,
      justificativa: "CORRETA — Gravidez ectópica rota com choque hipovolêmico é emergência cirúrgica absoluta. A tríade clássica (dor + amenorreia + beta-hCG positivo) com instabilidade hemodinâmica impõe laparotomia imediata, sem aguardar exames. A reposição volêmica é simultânea, não prévia."
    }
  ],
  raciocinio: "Identifique os sinais-alerta: irradiação para ombro direito indica hemoperitônio por irritação diafragmática, síncope sugere perda volumétrica aguda, e PA 78×48 + FC 136 configuram choque grau III. O diagnóstico é CLÍNICO — não espere exames.",
  conduta: "1) Acesso venoso calibroso bilateral + cristaloide em bolus\n2) Tipagem sanguínea + reserva de concentrado de hemácias\n3) Laparotomia exploradora imediata (não laparoscopia)\n4) Salpingectomia ou salpingostomia conforme achados intraoperatórios",
  dica: "No Revalida: tríade (dor abdominal + amenorreia + beta-hCG +) com INSTABILIDADE HEMODINÂMICA = cirurgia IMEDIATA. Não existe exame de imagem que justifique atraso no choque."
};

// ─── FAQ data ──────────────────────────────────────────────────────────────────
const FAQ_ITEMS = [
  {
    q: "O acesso é realmente gratuito para começar?",
    r: "Sim. Ao se cadastrar, você recebe 48 horas de acesso completo sem precisar inserir cartão. Você experimenta tudo: questões, plano adaptativo, revisão espaçada e caderno de erros — antes de decidir assinar."
  },
  {
    q: "As questões são realmente no estilo do Revalida INEP?",
    r: "Todas as questões seguem o formato oficial do Revalida INEP: casos clínicos longos, raciocínio por etapas e conduta terapêutica. Nosso banco é atualizado com foco nas provas mais recentes e nas áreas de maior cobrança."
  },
  {
    q: "O que é o Plano de Hoje adaptativo?",
    r: "É um algoritmo que analisa seus erros acumulados, a fila de revisão espaçada e seu histórico de desempenho para montar automaticamente a sessão do dia — combinando revisões inteligentes com questões novas, sem você precisar planejar nada."
  },
  {
    q: "Posso cancelar quando quiser?",
    r: "Sim, sem burocracia. O cancelamento é feito diretamente pelo sistema ou via WhatsApp. Você não fica preso em contratos anuais obrigatórios."
  }
];

// ─── Componente principal ──────────────────────────────────────────────────────
const LandingPage = () => {
  const navigate = useNavigate();
  const [alternativaSelecionada, setAlternativaSelecionada] = useState(null);
  const [mostrarResposta, setMostrarResposta] = useState(false);
  const [planos, setPlanos] = useState([]);
  const [carregandoPlanos, setCarregandoPlanos] = useState(true);
  const [_planoSelecionado, setPlanoSelecionado] = useState(null);
  const [_processandoPagamento, _setProcessandoPagamento] = useState(false);
  const [faqAberto, setFaqAberto] = useState(null);
  const [contador, setContador] = useState({ questoes: 0, usuarios: 0, aprovacoes: 0 });
  const contadorStarted = useRef(false);
  const contadorRef = useRef(null);
  const planosRef = useRef(null);

  // ── Animação dos contadores ──
  useEffect(() => {
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !contadorStarted.current) {
        contadorStarted.current = true;
        const alvo = { questoes: 1200, usuarios: 850, aprovacoes: 94 };
        const duracao = 1800;
        const fps = 60;
        const steps = duracao / (1000 / fps);
        let step = 0;
        const interval = setInterval(() => {
          step++;
          const p = Math.min(step / steps, 1);
          const ease = 1 - Math.pow(1 - p, 3);
          setContador({
            questoes: Math.round(alvo.questoes * ease),
            usuarios: Math.round(alvo.usuarios * ease),
            aprovacoes: Math.round(alvo.aprovacoes * ease),
          });
          if (p >= 1) clearInterval(interval);
        }, 1000 / fps);
      }
    }, { threshold: 0.3 });
    if (contadorRef.current) obs.observe(contadorRef.current);
    return () => obs.disconnect();
  }, []);

  // ── Scroll-reveal desativado — animação suspensa até diagnóstico definitivo ──
  // Todo o conteúdo fica visível por padrão, sem opacity:0 aplicado.

  // ── Carregar planos do Firestore ──
  useEffect(() => {
    getDocs(collection(db, "planos"))
      .then(snap => {
        if (!snap.empty) {
          const lista = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(p => p.ativo !== false && p.preco > 0)
            .sort((a, b) => (a.preco || 0) - (b.preco || 0));
          setPlanos(lista);
          const destaque = lista.find(p => p.destaque) || lista[Math.floor(lista.length / 2)] || lista[0];
          setPlanoSelecionado(destaque);
        }
        setCarregandoPlanos(false);
      })
      .catch(() => setCarregandoPlanos(false));
  }, []);

  // ── Click na alternativa ──
  const clicarAlternativa = (idx) => {
    if (mostrarResposta) return;
    setAlternativaSelecionada(idx);
    setMostrarResposta(true);
    setTimeout(() => {
      document.getElementById("resultado-questao")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 100);
  };

  // ── Checkout ──
  const irParaCheckout = async (plano) => {
    // Sem usuário logado → vai para cadastro com plano na URL
    navigate(`/register?plano=${plano.id}`);
  };

  const _fmtPreco = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const precoDia = (p) => (Number(p.preco) / (p.dias || 30)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div style={s.page}>

      {/* ─── Fundo vivo: orbs de gradiente com deriva lenta ─────────────── */}
      <div style={s.orbWrapper} aria-hidden="true">
        <div style={s.orb1} className="lp-orb lp-orb-1" />
        <div style={s.orb2} className="lp-orb lp-orb-2" />
        <div style={s.orb3} className="lp-orb lp-orb-3" />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          NAV
      ═══════════════════════════════════════════════════════════════════ */}
      <nav style={s.nav} className="lp-nav">
        <div style={s.navInner} className="lp-nav-inner">
          <span style={s.brand} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            REVALIDA<span style={{ color: "#818cf8" }}>PRO</span>
            <small style={s.brandYear}>2026</small>
          </span>
          <div style={s.navLinks} className="lp-nav-links">
            <a href="#como-funciona" style={s.navLink}>Como funciona</a>
            <a href="#questao" style={s.navLink}>Experimente</a>
            <a href="#planos" style={s.navLink}>Planos</a>
          </div>
          <div style={s.navCtas}>
            <button onClick={() => navigate("/login")} style={s.btnNavEntrar} className="lp-btn-nav-entrar">Entrar</button>
            <button onClick={() => navigate("/register")} style={s.btnNavCta} className="lp-btn-primary">
              <span className="lp-btn-nav-cta-text">Começar grátis</span>
              <FaArrowRight size={10} />
            </button>
          </div>
        </div>
      </nav>

      {/* ═══════════════════════════════════════════════════════════════════
          HERO
      ═══════════════════════════════════════════════════════════════════ */}
      <section style={s.hero} className="lp-hero">
        <div style={s.heroInner}>
          <div style={s.heroBadge}>
            <span style={s.heroBadgeDot}></span>
            Plataforma oficial — Revalida INEP 2025 / 2026
          </div>

          <h1 style={s.heroH1} className="lp-h1">
            Descubra exatamente<br />
            <span className="lp-gradient-text">o que estudar hoje</span><br />
            para passar no Revalida
          </h1>

          <p style={s.heroSub} className="lp-hero-sub">
            Plano de estudo automático + revisão espaçada baseada nos seus erros.<br className="lp-br" />
            Sem planilha. Sem chute. Só método.
          </p>

          <div style={s.heroCtas}>
            <button onClick={() => navigate("/register")} style={s.btnHeroPrimary} className="lp-btn-primary">
              <FaPlayCircle size={16} /> Começar agora — é grátis
            </button>
            <button
              onClick={() => document.getElementById("questao")?.scrollIntoView({ behavior: "smooth" })}
              style={s.btnHeroSecondary}
            >
              Ver questão ao vivo <FaChevronDown size={12} />
            </button>
          </div>

          <p style={s.heroSubNote}>✓ 48h grátis &nbsp;·&nbsp; ✓ Sem cartão &nbsp;·&nbsp; ✓ Cancele quando quiser</p>
        </div>

        {/* Mini dashboard preview no hero */}
        <div style={s.heroPreview} className="lp-hero-preview">
          <MiniDashboard />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          STATS BAR
      ═══════════════════════════════════════════════════════════════════ */}
      <div ref={contadorRef} style={s.statsBar} className="lp-stats-bar lp-section">
        <div style={s.statsBarInner}>
          {[
            { valor: `${contador.questoes.toLocaleString("pt-BR")}+`, label: "Questões no banco" },
            { valor: `${contador.usuarios.toLocaleString("pt-BR")}+`, label: "Médicos ativos" },
            { valor: `${contador.aprovacoes}%`, label: "Taxa de aprovação reportada" },
          ].map((s2, i) => (
            <div key={i} style={s.statItem}>
              <span style={s.statVal}>{s2.valor}</span>
              <span style={s.statLbl}>{s2.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          QUESTÃO INTERATIVA
      ═══════════════════════════════════════════════════════════════════ */}
      <section id="questao" style={s.section} className="lp-section">
        <div style={s.sectionInner}>
          <div style={s.sectionBadge}>🧪 EXPERIMENTE AGORA</div>
          <h2 style={s.sectionH2}>
            Uma questão real — exatamente como na plataforma
          </h2>
          <p style={s.sectionSub}>Clique em uma alternativa para ver o raciocínio clínico completo, como nosso sistema entrega para cada questão respondida.</p>

          <div style={s.questaoCard} className="lp-questao-card">
            {/* Header da questão */}
            <div style={s.questaoHeader}>
              <span style={s.questaoTag}>📋 CASO CLÍNICO</span>
              <span style={s.questaoTag2}>Ginecologia · Urgência</span>
            </div>

            {/* Enunciado */}
            <p style={s.enunciado}>{QUESTAO_DEMO.enunciado}</p>

            {/* Alternativas */}
            <div style={s.alternativasGrid}>
              {QUESTAO_DEMO.alternativas.map((alt, idx) => {
                const selecionada = alternativaSelecionada === idx;
                const correta = alt.correta;
                let bg = "transparent";
                let borda = "#334155";
                let cor = "#94a3b8";
                let icon = null;

                if (mostrarResposta) {
                  if (correta) {
                    bg = "rgba(16,185,129,0.08)";
                    borda = "#10b981";
                    cor = "#f1f5f9";
                    icon = <FaCheckCircle color="#10b981" size={14} />;
                  } else if (selecionada && !correta) {
                    bg = "rgba(239,68,68,0.08)";
                    borda = "#ef4444";
                    cor = "#f1f5f9";
                    icon = <FaTimesCircle color="#ef4444" size={14} />;
                  }
                } else if (selecionada) {
                  bg = "rgba(79,70,229,0.12)";
                  borda = "#4f46e5";
                  cor = "#f1f5f9";
                }

                return (
                  <button
                    key={idx}
                    onClick={() => clicarAlternativa(idx)}
                    style={{
                      ...s.altBtn,
                      background: bg,
                      borderColor: borda,
                      color: cor,
                      cursor: mostrarResposta ? "default" : "pointer",
                    }}
                    className="lp-alt-btn"
                  >
                    <span style={{ ...s.altLetra, borderColor: borda, color: borda }}>{alt.letra}</span>
                    <span style={s.altTexto}>{alt.texto}</span>
                    {icon && <span style={{ marginLeft: "auto", flexShrink: 0 }}>{icon}</span>}
                  </button>
                );
              })}
            </div>

            {/* Resultado expandido */}
            {mostrarResposta && (
              <div id="resultado-questao" style={s.resultado} className="lp-resultado">
                {/* Resposta de cada alternativa */}
                <div style={s.resultadoTitulo}>
                  {QUESTAO_DEMO.alternativas[alternativaSelecionada].correta
                    ? <><FaCheckCircle color="#10b981" /> <span style={{ color: "#10b981" }}>Resposta correta!</span></>
                    : <><FaTimesCircle color="#ef4444" /> <span style={{ color: "#ef4444" }}>Resposta incorreta — veja o gabarito comentado abaixo</span></>
                  }
                </div>

                {/* Justificativas de cada alternativa */}
                <div style={s.justBlock}>
                  <p style={s.justTitulo}>📝 Gabarito comentado</p>
                  {QUESTAO_DEMO.alternativas.map((alt, i) => (
                    <div key={i} style={{
                      ...s.justItem,
                      borderLeftColor: alt.correta ? "#10b981" : "#475569"
                    }}>
                      <span style={{ fontWeight: "900", color: alt.correta ? "#10b981" : "#64748b", marginRight: "8px" }}>
                        {alt.correta ? "✓" : "✗"} {alt.letra})
                      </span>
                      <span style={{ color: "#94a3b8", fontSize: "13px", lineHeight: 1.5 }}>{alt.justificativa}</span>
                    </div>
                  ))}
                </div>

                {/* Raciocínio clínico */}
                <div style={s.clinicaBlock}>
                  <p style={s.clinicaTitulo}><FaBrain size={13} color="#818cf8" /> Raciocínio clínico</p>
                  <p style={s.clinicaTexto}>{QUESTAO_DEMO.raciocinio}</p>
                </div>

                {/* Conduta */}
                <div style={s.condutaBlock}>
                  <p style={s.condutaTitulo}><FaStethoscope size={13} color="#10b981" /> Conduta / Tratamento</p>
                  <pre style={s.condutaTexto}>{QUESTAO_DEMO.conduta}</pre>
                </div>

                {/* Dica final */}
                <div style={s.dicaBlock}>
                  <p style={s.dicaTexto}>💡 <strong>Dica Revalida:</strong> {QUESTAO_DEMO.dica}</p>
                </div>

                {/* CTA pós-questão */}
                <div style={s.postQuestaoCta}>
                  <p style={{ color: "#94a3b8", fontSize: "13px", marginBottom: "12px" }}>
                    Cada questão respondida na plataforma gera exatamente isso — raciocínio clínico, conduta e revisão inteligente programada automaticamente.
                  </p>
                  <button onClick={() => navigate("/register")} style={s.btnHeroPrimary} className="lp-btn-primary">
                    Quero estudar assim <FaArrowRight size={12} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          COMO FUNCIONA
      ═══════════════════════════════════════════════════════════════════ */}
      <section id="como-funciona" style={{ ...s.section, background: "rgba(15,23,42,0.6)" }} className="lp-section">
        <div style={s.sectionInner}>
          <div style={s.sectionBadge}>⚙️ COMO FUNCIONA</div>
          <h2 style={s.sectionH2}>Tudo que você precisa. Nada que você não precisa.</h2>

          <div style={s.featuresGrid} className="lp-features-grid">
            {[
              {
                icon: <FaBolt size={22} color="#818cf8" />,
                titulo: "Plano de Hoje Adaptativo",
                desc: "Algoritmo analisa sua fila de revisão espaçada e erros em aberto para montar automaticamente a sessão ideal do dia — sem você precisar planejar nada.",
                cor: "#818cf8",
                badge: "IA"
              },
              {
                icon: <FaBrain size={22} color="#10b981" />,
                titulo: "Revisão Espaçada (SRS)",
                desc: "Cada questão respondida é agendada para revisão no momento exato em que sua memória está prestes a esquecer. Retenção de longo prazo sem esforço extra.",
                cor: "#10b981",
                badge: "MEMÓRIA"
              },
              {
                icon: <FaChartLine size={22} color="#f97316" />,
                titulo: "Caderno de Erros Inteligente",
                desc: "Seus erros são organizados automaticamente por tema e urgência. Ao acertar a mesma questão, o erro some do caderno — progresso real e visível.",
                cor: "#f97316",
                badge: "FOCO"
              },
              {
                icon: <FaTrophy size={22} color="#fbbf24" />,
                titulo: "Análise de Desempenho Real",
                desc: "Acompanhe sua evolução por matéria, subtema e tipo de questão. Identifique exatamente onde estão seus gaps antes da prova.",
                cor: "#fbbf24",
                badge: "DADOS"
              },
              {
                icon: <FaLayerGroup size={22} color="#06b6d4" />,
                titulo: "Banco Estilo INEP",
                desc: "Questões no formato exato do Revalida INEP — casos clínicos longos, conduta terapêutica e raciocínio por etapas. Com resolução completa.",
                cor: "#06b6d4",
                badge: "BANCO"
              },
              {
                icon: <FaUserMd size={22} color="#a78bfa" />,
                titulo: "Suporte por WhatsApp",
                desc: "Acesso direto ao suporte via WhatsApp. Sem ticket, sem fila. Se travar em alguma questão ou aspecto do sistema, a resposta é rápida.",
                cor: "#a78bfa",
                badge: "SUPORTE"
              }
            ].map((f, i) => (
              <div key={i} style={{ ...s.featureCard, borderColor: `${f.cor}22` }} className={`lp-feature-card lp-reveal lp-stagger-${i}`}>
                <div style={{ ...s.featureIconBox, background: `${f.cor}14`, border: `1px solid ${f.cor}33` }}>
                  {f.icon}
                </div>
                <span style={{ ...s.featureBadge, background: `${f.cor}18`, color: f.cor, border: `1px solid ${f.cor}33` }}>
                  {f.badge}
                </span>
                <h3 style={s.featureTitulo}>{f.titulo}</h3>
                <p style={s.featureDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          DASHBOARD PREVIEW
      ═══════════════════════════════════════════════════════════════════ */}
      <section style={s.section} className="lp-section">
        <div style={s.sectionInner}>
          <div style={s.sectionBadge}>📊 PRÉVIA DA PLATAFORMA</div>
          <h2 style={s.sectionH2}>Exatamente o que você vê ao entrar</h2>
          <p style={s.sectionSub}>Interface limpa, informação no lugar certo. Zero distração — só o que importa para passar.</p>

          <div style={s.dashPreviewWrapper} className="lp-dash-preview">
            <DashboardPreview />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          PLANOS
      ═══════════════════════════════════════════════════════════════════ */}
      <section id="planos" ref={planosRef} style={{ ...s.section, background: "rgba(15,23,42,0.6)" }} className="lp-section">
        <div style={s.sectionInner}>
          <div style={s.sectionBadge}>💰 PLANOS</div>
          <h2 style={s.sectionH2}>Investimento menor que uma revisão presencial</h2>
          <p style={s.sectionSub}>Comece com 48 horas grátis. Sem cartão de crédito obrigatório no início.</p>

          {carregandoPlanos ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
              <FaSpinner style={{ animation: "lp-spin 1s linear infinite", fontSize: "24px" }} />
              <p style={{ marginTop: "12px", fontSize: "13px" }}>Carregando planos...</p>
            </div>
          ) : planos.length === 0 ? (
            // Fallback se Firestore não retornar planos
            <div style={s.planosGrid} className="lp-planos-grid">
              <PlanoFallback onCta={() => navigate("/register")} />
            </div>
          ) : (
            <div style={s.planosGrid} className="lp-planos-grid">
              {planos.map(plano => {
                const destaque = !!plano.destaque;
                return (
                                    <div
                    key={plano.id}
                    onClick={() => setPlanoSelecionado(plano)}
                    style={{
                      ...s.planoCard,
                      borderColor: destaque ? "#4f46e5" : "#1e293b",
                      boxShadow: destaque ? "0 0 28px rgba(79,70,229,0.18)" : "none",
                      transform: destaque ? "scale(1.03)" : "scale(1)",
                    }}
                    className="lp-plano-card lp-reveal"
                  >
                    {destaque && (
                      <div style={s.planoDestaqueBadge}>
                        <FaStar size={10} /> MAIS POPULAR
                      </div>
                    )}
                    <h3 style={s.planoNome}>{plano.nome || `Plano ${plano.dias}d`}</h3>
                    <div style={s.planoPreco}>
                      <span style={s.planoPrecoCurrency}>R$</span>
                      <span style={s.planoPrecoval}>{Number(plano.preco).toFixed(0)}</span>
                    </div>
                    <p style={s.planoPorDia}>{precoDia(plano)} / dia</p>
                    <p style={s.planoDias}>{plano.dias} dias de acesso completo</p>

                    <ul style={s.planoFeatures}>
                      {(plano.recursos || [
                        "Banco de questões completo",
                        "Plano de Hoje adaptativo",
                        "Revisão espaçada (SRS)",
                        "Caderno de erros inteligente",
                        "Análise de desempenho",
                        "Suporte via WhatsApp"
                      ]).map((r, i) => (
                        <li key={i} style={s.planoFeatureItem}>
                          <FaCheckCircle size={11} color="#10b981" style={{ flexShrink: 0 }} />
                          {r}
                        </li>
                      ))}
                    </ul>

                    <button
                      onClick={(e) => { e.stopPropagation(); irParaCheckout(plano); }}
                      style={{
                        ...s.btnPlano,
                        background: destaque
                          ? "linear-gradient(135deg, #4f46e5, #7c3aed)"
                          : "transparent",
                        border: destaque ? "none" : "1px solid #334155",
                        color: destaque ? "#fff" : "#94a3b8"
                      }}
                    >
                      {destaque ? "Assinar agora" : "Escolher plano"} <FaArrowRight size={11} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div style={s.planosGarantia}>
            <FaShieldAlt color="#10b981" size={14} />
            <span>Pagamento 100% seguro via Mercado Pago · Pix, cartão ou boleto</span>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          FAQ
      ═══════════════════════════════════════════════════════════════════ */}
      <section style={s.section} className="lp-section">
        <div style={{ ...s.sectionInner, maxWidth: "720px" }}>
          <div style={s.sectionBadge}>❓ PERGUNTAS FREQUENTES</div>
          <h2 style={s.sectionH2}>Respostas diretas</h2>

          <div style={s.faqList}>
            {FAQ_ITEMS.map((item, i) => (
              <div key={i} style={{ ...s.faqItem, borderColor: faqAberto === i ? "#4f46e5" : "#1e293b" }}>
                <button
                  onClick={() => setFaqAberto(faqAberto === i ? null : i)}
                  style={s.faqPergunta}
                >
                  <span>{item.q}</span>
                  {faqAberto === i ? <FaChevronUp size={12} color="#818cf8" /> : <FaChevronDown size={12} color="#475569" />}
                </button>
                {faqAberto === i && (
                  <p style={s.faqResposta}>{item.r}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          CTA FINAL
      ═══════════════════════════════════════════════════════════════════ */}
      <section style={s.ctaFinal} className="lp-cta-final-section">
        <div style={s.ctaFinalInner}>
          <div style={s.ctaFinalGlow} className="lp-cta-glow" />
          <span style={{ fontSize: "40px", display: "block", marginBottom: "16px" }}>🩺</span>
          <h2 style={s.ctaFinalH2}>
            Sua aprovação no Revalida<br />
            começa com a primeira questão
          </h2>
          <p style={s.ctaFinalSub}>
            48 horas grátis. Sem cartão. Sem compromisso.<br />
            Só método, questões e resultado.
          </p>
          <button onClick={() => navigate("/register")} style={s.btnCtaFinal} className="lp-btn-primary">
            <FaPlayCircle size={16} /> Criar conta gratuita agora
          </button>
          <p style={s.ctaFinalNote}>
            Já tem conta?{" "}
            <span onClick={() => navigate("/login")} style={{ color: "#818cf8", cursor: "pointer", textDecoration: "underline" }}>
              Fazer login
            </span>
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          FOOTER
      ═══════════════════════════════════════════════════════════════════ */}
      <footer style={s.footer}>
        <div style={s.footerInner}>
          <span style={s.brand}>REVALIDA<span style={{ color: "#818cf8" }}>PRO</span></span>
          <p style={s.footerNote}>Plataforma de preparação para o Revalida INEP · {new Date().getFullYear()}</p>
          <a
            href={`https://wa.me/${WHATSAPP}`}
            target="_blank"
            rel="noopener noreferrer"
            style={s.footerWa}
          >
            <FaWhatsapp /> Suporte via WhatsApp
          </a>
          <div style={s.footerLinks}>
            <span onClick={() => navigate("/login")} style={s.footerLink}>Entrar</span>
            <span onClick={() => navigate("/register")} style={s.footerLink}>Cadastrar</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

// ─── Mini Dashboard (Hero) ─────────────────────────────────────────────────────
const MiniDashboard = () => (
  <div style={md.wrapper} className="lp-mini-dash">
    <div style={md.header}>
      <span style={md.brand}>REVALIDAPRO</span>
      <span style={md.status}>● Online</span>
    </div>
    <div style={md.body}>
      <div style={md.planoCard}>
        <span style={md.planoBadge}>⚡ REVISÃO ESPAÇADA</span>
        <p style={md.planoLabel}>SEU PLANO DE HOJE</p>
        <h4 style={md.planoLinha}>Hoje: 8 revisões + 12 novas</h4>
        <p style={md.planoDesc}>Revisão espaçada ativa · Clínica Médica</p>
        <div style={md.planoBtn}>▶ Começar agora</div>
      </div>
      <div style={md.statsRow}>
        <div style={md.statBox}>
          <span style={md.statN}>74%</span>
          <span style={md.statL}>DA META</span>
        </div>
        <div style={md.statBox}>
          <span style={md.statN}>487</span>
          <span style={md.statL}>RESOLVIDAS</span>
        </div>
        <div style={md.statBox}>
          <span style={md.statN}>12🔥</span>
          <span style={md.statL}>STREAK</span>
        </div>
      </div>
      <div style={md.progressBar}>
        <div style={{ ...md.progressFill, width: "74%" }} />
      </div>
      <div style={md.badgesRow}>
        {["🔥 Ignição", "💊 Residente", "🏃 Maratona"].map((b, i) => (
          <span key={i} style={md.badge}>{b}</span>
        ))}
      </div>
    </div>
  </div>
);

// ─── Dashboard Preview (full mockup) ──────────────────────────────────────────
const DashboardPreview = () => (
  <div style={dp.container}>
    {/* Barra de progresso de meta */}
    <div style={dp.metaBar}>
      <div style={dp.metaHeader}>
        <span style={dp.metaTitle}>🎯 META DE HOJE</span>
        <span style={dp.metaBadge}>⚡ REVISÃO INCLUÍDA</span>
      </div>
      <div style={dp.metaProgress}>
        <div style={dp.metaFill} />
      </div>
      <div style={dp.metaLabels}>
        <span style={dp.metaMsg}>💪 Você está muito perto!</span>
        <span style={dp.metaNum}>14 / 20 questões</span>
      </div>
    </div>

    {/* Três cards de missão */}
    <div style={dp.missoesHeader}>
      <span style={dp.missoesTitle}>🎯 PROTOCOLO DE MISSÕES</span>
      <span style={dp.missoesLabel}>Recentes</span>
    </div>
    {[
      { materia: "Clínica Médica", subtema: "Cardiologia / IAM", erros: 5, cor: "#818cf8" },
      { materia: "Cirurgia", subtema: "Abdome Agudo", erros: 3, cor: "#f87171" },
      { materia: "Ginecologia", subtema: "Gravidez Ectópica", erros: 2, cor: "#f472b6" },
    ].map((m, i) => (
      <div key={i} style={{ ...dp.missaoCard, borderLeftColor: m.cor }}>
        <div>
          <p style={{ ...dp.missaoMateria, color: m.cor }}>{m.materia}</p>
          <p style={dp.missaoSub}>{m.subtema}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <span style={{ ...dp.missaoBadge, background: `${m.cor}18`, color: m.cor }}>
            {m.erros} erros
          </span>
          <p style={dp.missaoBtn}>Resgatar →</p>
        </div>
      </div>
    ))}
  </div>
);

// ─── Plano fallback (se Firestore não retornar) ────────────────────────────────
const PlanoFallback = ({ onCta }) => (
  <div style={{ ...s.planoCard, borderColor: "#4f46e5", boxShadow: "0 0 28px rgba(79,70,229,0.18)", maxWidth: "340px", margin: "0 auto" }}>
    <div style={s.planoDestaqueBadge}><FaStar size={10} /> MAIS POPULAR</div>
    <h3 style={s.planoNome}>Plano Mensal</h3>
    <div style={s.planoPreco}>
      <span style={s.planoPrecoCurrency}>R$</span>
      <span style={s.planoPrecoval}>97</span>
    </div>
    <p style={s.planoPorDia}>R$ 3,23 / dia</p>
    <p style={s.planoDias}>30 dias de acesso completo</p>
    <ul style={s.planoFeatures}>
      {["Banco de questões completo", "Plano de Hoje adaptativo", "Revisão espaçada (SRS)", "Caderno de erros inteligente", "Análise de desempenho", "Suporte via WhatsApp"].map((r, i) => (
        <li key={i} style={s.planoFeatureItem}><FaCheckCircle size={11} color="#10b981" style={{ flexShrink: 0 }} />{r}</li>
      ))}
    </ul>
    <button onClick={onCta} style={{ ...s.btnPlano, background: "linear-gradient(135deg, #4f46e5, #7c3aed)", border: "none", color: "#fff" }}>
      Começar agora <FaArrowRight size={11} />
    </button>
  </div>
);

// ─── Estilos ────────────────────────────────────────────────────────────────────
const s = {
  page: { background: "#020617", minHeight: "100vh", color: "#f1f5f9", overflowX: "hidden", position: "relative" },

  // ORBS — fundo vivo
  orbWrapper: { position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" },
  orb1: { position: "absolute", width: "700px", height: "700px", borderRadius: "50%", background: "radial-gradient(circle, rgba(79,70,229,0.065) 0%, transparent 68%)", top: "-200px", left: "-180px", willChange: "transform" },
  orb2: { position: "absolute", width: "550px", height: "550px", borderRadius: "50%", background: "radial-gradient(circle, rgba(6,182,212,0.05) 0%, transparent 68%)", top: "45%", right: "-200px", willChange: "transform" },
  orb3: { position: "absolute", width: "480px", height: "480px", borderRadius: "50%", background: "radial-gradient(circle, rgba(16,185,129,0.04) 0%, transparent 68%)", bottom: "15%", left: "25%", willChange: "transform" },

  // NAV
  nav: { position: "sticky", top: 0, zIndex: 200, background: "rgba(2,6,23,0.92)", backdropFilter: "blur(12px)", borderBottom: "1px solid #0f172a" },
  navInner: { maxWidth: "1200px", margin: "0 auto", padding: "0 24px", height: "64px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" },
  brand: { fontWeight: "900", fontSize: "20px", color: "#4f46e5", cursor: "pointer", letterSpacing: "-0.5px", flexShrink: 0 },
  brandYear: { fontSize: "10px", color: "#818cf8", marginLeft: "4px", fontWeight: "700" },
  navLinks: { display: "flex", gap: "24px" },
  navLink: { color: "#64748b", textDecoration: "none", fontSize: "13px", fontWeight: "600", transition: "color 0.2s" },
  navCtas: { display: "flex", gap: "10px", alignItems: "center", flexShrink: 0 },
  btnNavEntrar: { background: "transparent", border: "1px solid #334155", color: "#94a3b8", padding: "8px 16px", borderRadius: "8px", fontSize: "12px", fontWeight: "700", cursor: "pointer" },
  btnNavCta: { background: "linear-gradient(135deg, #4f46e5, #7c3aed)", border: "none", color: "#fff", padding: "8px 16px", borderRadius: "8px", fontSize: "12px", fontWeight: "800", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" },

  // HERO
  hero: { minHeight: "90vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 24px 60px", maxWidth: "1200px", margin: "0 auto", gap: "60px" },
  heroInner: { flex: "1 1 520px", maxWidth: "580px" },
  heroBadge: { display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(79,70,229,0.12)", border: "1px solid rgba(79,70,229,0.3)", borderRadius: "20px", padding: "6px 14px", fontSize: "11px", fontWeight: "700", color: "#818cf8", marginBottom: "24px", letterSpacing: "0.5px" },
  heroBadgeDot: { width: "6px", height: "6px", background: "#10b981", borderRadius: "50%", display: "inline-block" },
  heroH1: { fontSize: "48px", fontWeight: "900", lineHeight: 1.12, marginBottom: "20px", letterSpacing: "-1.5px" },
  heroSub: { fontSize: "17px", color: "#94a3b8", lineHeight: 1.65, marginBottom: "32px", fontWeight: "400" },
  heroCtas: { display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "16px" },
  btnHeroPrimary: { background: "linear-gradient(135deg, #4f46e5, #7c3aed)", border: "none", borderRadius: "12px", padding: "14px 24px", color: "#fff", fontWeight: "900", fontSize: "15px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", boxShadow: "0 6px 24px rgba(79,70,229,0.35)", transition: "transform 0.15s, box-shadow 0.15s" },
  btnHeroSecondary: { background: "rgba(255,255,255,0.04)", border: "1px solid #334155", borderRadius: "12px", padding: "14px 20px", color: "#94a3b8", fontWeight: "700", fontSize: "14px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" },
  heroSubNote: { fontSize: "12px", color: "#475569", fontWeight: "600" },
  heroPreview: { flex: "1 1 360px", maxWidth: "420px" },

  // STATS BAR
  statsBar: { background: "rgba(15,23,42,0.8)", borderTop: "1px solid #1e293b", borderBottom: "1px solid #1e293b", padding: "24px" },
  statsBarInner: { maxWidth: "900px", margin: "0 auto", display: "flex", justifyContent: "center", gap: "60px", flexWrap: "wrap" },
  statItem: { textAlign: "center" },
  statVal: { display: "block", fontSize: "32px", fontWeight: "900", color: "#f1f5f9", letterSpacing: "-1px" },
  statLbl: { display: "block", fontSize: "11px", color: "#475569", fontWeight: "700", marginTop: "4px", textTransform: "uppercase", letterSpacing: "0.5px" },

  // SECTIONS
  section: { padding: "80px 24px" },
  sectionInner: { maxWidth: "1100px", margin: "0 auto" },
  sectionBadge: { fontSize: "11px", fontWeight: "900", color: "#818cf8", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "12px" },
  sectionH2: { fontSize: "36px", fontWeight: "900", letterSpacing: "-1px", marginBottom: "12px", lineHeight: 1.2 },
  sectionSub: { fontSize: "16px", color: "#64748b", marginBottom: "48px", lineHeight: 1.6, maxWidth: "600px" },

  // QUESTÃO
  questaoCard: { background: "#0f172a", border: "1px solid #1e293b", borderRadius: "16px", padding: "32px", maxWidth: "800px" },
  questaoHeader: { display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" },
  questaoTag: { background: "rgba(79,70,229,0.12)", border: "1px solid rgba(79,70,229,0.25)", color: "#818cf8", padding: "4px 10px", borderRadius: "6px", fontSize: "10px", fontWeight: "800", letterSpacing: "0.5px" },
  questaoTag2: { background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", color: "#10b981", padding: "4px 10px", borderRadius: "6px", fontSize: "10px", fontWeight: "800" },
  enunciado: { fontSize: "15px", lineHeight: 1.75, color: "#e2e8f0", marginBottom: "28px", fontWeight: "400" },
  alternativasGrid: { display: "flex", flexDirection: "column", gap: "10px", marginBottom: "4px" },
  altBtn: { display: "flex", alignItems: "flex-start", gap: "12px", background: "transparent", border: "1px solid #334155", borderRadius: "10px", padding: "14px 16px", textAlign: "left", width: "100%", transition: "all 0.2s", fontFamily: "inherit" },
  altLetra: { width: "28px", height: "28px", border: "2px solid #334155", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "900", flexShrink: 0, marginTop: "1px" },
  altTexto: { fontSize: "14px", lineHeight: 1.55, flex: 1 },

  // RESULTADO
  resultado: { marginTop: "24px", borderTop: "1px solid #1e293b", paddingTop: "24px" },
  resultadoTitulo: { display: "flex", alignItems: "center", gap: "8px", fontSize: "15px", fontWeight: "800", marginBottom: "20px" },
  justBlock: { background: "#070f1e", borderRadius: "10px", padding: "20px", marginBottom: "16px" },
  justTitulo: { fontSize: "11px", fontWeight: "900", color: "#475569", letterSpacing: "0.5px", marginBottom: "14px", textTransform: "uppercase" },
  justItem: { borderLeft: "2px solid #334155", paddingLeft: "12px", marginBottom: "12px" },
  clinicaBlock: { background: "rgba(129,140,248,0.06)", border: "1px solid rgba(129,140,248,0.15)", borderRadius: "10px", padding: "16px", marginBottom: "12px" },
  clinicaTitulo: { display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: "900", color: "#818cf8", marginBottom: "10px", letterSpacing: "0.5px", textTransform: "uppercase" },
  clinicaTexto: { fontSize: "14px", color: "#94a3b8", lineHeight: 1.65 },
  condutaBlock: { background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: "10px", padding: "16px", marginBottom: "12px" },
  condutaTitulo: { display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: "900", color: "#10b981", marginBottom: "10px", letterSpacing: "0.5px", textTransform: "uppercase" },
  condutaTexto: { fontSize: "13px", color: "#94a3b8", lineHeight: 1.7, fontFamily: "inherit", whiteSpace: "pre-wrap", margin: 0 },
  dicaBlock: { background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: "10px", padding: "16px", marginBottom: "24px" },
  dicaTexto: { fontSize: "13px", color: "#fbbf24", lineHeight: 1.6 },
  postQuestaoCta: { textAlign: "center", paddingTop: "8px" },

  // FEATURES
  featuresGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px" },
  featureCard: { background: "#0a1628", border: "1px solid #1e293b", borderRadius: "14px", padding: "24px", display: "flex", flexDirection: "column", gap: "12px", transition: "transform 0.2s" },
  featureIconBox: { width: "44px", height: "44px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center" },
  featureBadge: { fontSize: "9px", fontWeight: "900", padding: "3px 8px", borderRadius: "4px", letterSpacing: "0.8px", alignSelf: "flex-start" },
  featureTitulo: { fontSize: "15px", fontWeight: "800", color: "#f1f5f9", lineHeight: 1.3 },
  featureDesc: { fontSize: "13px", color: "#64748b", lineHeight: 1.65 },

  // DASHBOARD PREVIEW
  dashPreviewWrapper: { background: "#0a1628", border: "1px solid #1e293b", borderRadius: "16px", padding: "28px", maxWidth: "680px" },

  // PLANOS
  planosGrid: { display: "flex", gap: "20px", justifyContent: "center", flexWrap: "wrap", alignItems: "flex-start" },
  planoCard: { background: "#0a1628", border: "1px solid #1e293b", borderRadius: "16px", padding: "28px 24px", flex: "1 1 260px", maxWidth: "320px", position: "relative", cursor: "pointer", transition: "transform 0.2s" },
  planoDestaqueBadge: { position: "absolute", top: "-12px", left: "50%", transform: "translateX(-50%)", background: "linear-gradient(135deg, #4f46e5, #7c3aed)", color: "#fff", fontSize: "10px", fontWeight: "900", padding: "4px 12px", borderRadius: "20px", display: "flex", alignItems: "center", gap: "4px", whiteSpace: "nowrap" },
  planoNome: { fontSize: "14px", fontWeight: "900", color: "#94a3b8", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: "8px" },
  planoPreco: { display: "flex", alignItems: "baseline", gap: "4px", marginBottom: "4px" },
  planoPrecoCurrency: { fontSize: "18px", fontWeight: "800", color: "#64748b" },
  planoPrecoval: { fontSize: "52px", fontWeight: "900", color: "#f1f5f9", lineHeight: 1, letterSpacing: "-2px" },
  planoPorDia: { fontSize: "12px", color: "#475569", marginBottom: "4px" },
  planoDias: { fontSize: "12px", color: "#10b981", fontWeight: "700", marginBottom: "20px" },
  planoFeatures: { listStyle: "none", padding: 0, margin: "0 0 24px", display: "flex", flexDirection: "column", gap: "8px" },
  planoFeatureItem: { display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#64748b" },
  btnPlano: { width: "100%", padding: "12px", borderRadius: "10px", fontSize: "13px", fontWeight: "800", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", transition: "all 0.2s" },
  planosGarantia: { display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginTop: "28px", fontSize: "12px", color: "#475569" },

  // FAQ
  faqList: { display: "flex", flexDirection: "column", gap: "12px" },
  faqItem: { background: "#0a1628", border: "1px solid #1e293b", borderRadius: "12px", overflow: "hidden", transition: "border-color 0.2s" },
  faqPergunta: { width: "100%", background: "none", border: "none", padding: "18px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", cursor: "pointer", color: "#e2e8f0", fontSize: "14px", fontWeight: "700", textAlign: "left", fontFamily: "inherit" },
  faqResposta: { padding: "0 20px 18px", fontSize: "14px", color: "#64748b", lineHeight: 1.65 },

  // CTA FINAL
  ctaFinal: { padding: "100px 24px", textAlign: "center", position: "relative", overflow: "hidden" },
  ctaFinalInner: { maxWidth: "600px", margin: "0 auto", position: "relative", zIndex: 2 },
  ctaFinalGlow: { position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "600px", height: "400px", background: "radial-gradient(ellipse, rgba(79,70,229,0.12) 0%, transparent 70%)", zIndex: 1, pointerEvents: "none" },
  ctaFinalH2: { fontSize: "38px", fontWeight: "900", letterSpacing: "-1px", lineHeight: 1.2, marginBottom: "16px" },
  ctaFinalSub: { fontSize: "16px", color: "#64748b", lineHeight: 1.65, marginBottom: "32px" },
  btnCtaFinal: { background: "linear-gradient(135deg, #4f46e5, #7c3aed)", border: "none", borderRadius: "14px", padding: "16px 32px", color: "#fff", fontWeight: "900", fontSize: "16px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "10px", boxShadow: "0 8px 32px rgba(79,70,229,0.4)", marginBottom: "16px" },
  ctaFinalNote: { fontSize: "13px", color: "#475569" },

  // FOOTER
  footer: { background: "#020617", borderTop: "1px solid #0f172a", padding: "40px 24px" },
  footerInner: { maxWidth: "1100px", margin: "0 auto", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" },
  footerNote: { fontSize: "12px", color: "#475569" },
  footerWa: { display: "flex", alignItems: "center", gap: "6px", color: "#10b981", fontSize: "12px", textDecoration: "none", fontWeight: "700" },
  footerLinks: { display: "flex", gap: "20px" },
  footerLink: { color: "#475569", fontSize: "12px", cursor: "pointer", textDecoration: "underline" },
};

// ─── Mini dashboard styles ─────────────────────────────────────────────────────
const md = {
  wrapper: { background: "#0f172a", border: "1px solid #1e293b", borderRadius: "16px", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.4)" },
  header: { background: "#1e293b", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" },
  brand: { fontWeight: "900", fontSize: "12px", color: "#4f46e5" },
  status: { fontSize: "10px", color: "#10b981", fontWeight: "700" },
  body: { padding: "16px" },
  planoCard: { background: "linear-gradient(160deg, #0f172a, #1e293b)", border: "1px solid #4f46e555", borderRadius: "12px", padding: "14px", marginBottom: "12px" },
  planoBadge: { fontSize: "9px", fontWeight: "900", color: "#818cf8", background: "rgba(129,140,248,0.12)", border: "1px solid rgba(129,140,248,0.25)", padding: "2px 8px", borderRadius: "4px", display: "inline-block", marginBottom: "6px" },
  planoLabel: { fontSize: "9px", fontWeight: "700", color: "#475569", letterSpacing: "0.5px", marginBottom: "4px" },
  planoLinha: { fontSize: "13px", fontWeight: "900", color: "#f1f5f9", marginBottom: "4px" },
  planoDesc: { fontSize: "10px", color: "#475569" },
  planoBtn: { background: "#4f46e5", color: "#fff", fontSize: "11px", fontWeight: "800", padding: "7px 12px", borderRadius: "8px", marginTop: "10px", textAlign: "center" },
  statsRow: { display: "flex", gap: "8px", marginBottom: "10px" },
  statBox: { flex: 1, background: "#0a1628", border: "1px solid #1e293b", borderRadius: "8px", padding: "8px", textAlign: "center" },
  statN: { display: "block", fontSize: "14px", fontWeight: "900", color: "#f1f5f9" },
  statL: { display: "block", fontSize: "8px", color: "#475569", fontWeight: "700", letterSpacing: "0.5px" },
  progressBar: { background: "#1e293b", borderRadius: "4px", height: "4px", marginBottom: "10px", overflow: "hidden" },
  progressFill: { height: "100%", background: "linear-gradient(90deg, #4f46e5, #818cf8)", borderRadius: "4px" },
  badgesRow: { display: "flex", gap: "6px", flexWrap: "wrap" },
  badge: { background: "rgba(79,70,229,0.12)", border: "1px solid rgba(79,70,229,0.2)", color: "#818cf8", fontSize: "9px", fontWeight: "700", padding: "3px 7px", borderRadius: "4px" },
};

// ─── Dashboard preview styles ──────────────────────────────────────────────────
const dp = {
  container: { display: "flex", flexDirection: "column", gap: "12px" },
  metaBar: { background: "#070f1e", border: "1px solid #1e293b", borderRadius: "12px", padding: "16px" },
  metaHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" },
  metaTitle: { fontSize: "11px", fontWeight: "900", color: "#f1f5f9", letterSpacing: "0.05em" },
  metaBadge: { fontSize: "9px", fontWeight: "800", color: "#818cf8", letterSpacing: "0.05em" },
  metaProgress: { background: "#1e293b", borderRadius: "6px", height: "6px", overflow: "hidden", marginBottom: "8px" },
  metaFill: { width: "70%", height: "100%", background: "linear-gradient(90deg, #f97316, #fbbf24)", borderRadius: "6px" },
  metaLabels: { display: "flex", justifyContent: "space-between" },
  metaMsg: { fontSize: "11px", color: "#f97316", fontWeight: "700" },
  metaNum: { fontSize: "11px", color: "#475569", fontWeight: "600" },
  missoesHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  missoesTitle: { fontSize: "11px", fontWeight: "900", color: "#f1f5f9", letterSpacing: "0.05em" },
  missoesLabel: { fontSize: "9px", color: "#818cf8", fontWeight: "700", background: "rgba(129,140,248,0.1)", padding: "2px 8px", borderRadius: "4px" },
  missaoCard: { background: "#070f1e", border: "1px solid #1e293b", borderLeft: "3px solid", borderRadius: "10px", padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" },
  missaoMateria: { fontSize: "12px", fontWeight: "800", marginBottom: "2px" },
  missaoSub: { fontSize: "11px", color: "#475569" },
  missaoBadge: { fontSize: "10px", fontWeight: "800", padding: "3px 8px", borderRadius: "4px", display: "block", marginBottom: "4px", textAlign: "right" },
  missaoBtn: { fontSize: "10px", color: "#475569", cursor: "pointer", textAlign: "right" },
};

export default LandingPage;
