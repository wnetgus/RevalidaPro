import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import {
  FaLock, FaWhatsapp, FaSignOutAlt, FaStar,
  FaCheckCircle, FaArrowRight, FaCrown, FaSpinner,
  FaShieldAlt, FaCreditCard, FaBarcode, FaMobileAlt
} from "react-icons/fa";

// URL da sua Cloud Function — substitua pelo URL real após o deploy
const CLOUD_FUNCTION_URL = "https://us-central1-revalidapro-f812e.cloudfunctions.net/criarPreferencia";
const WHATSAPP_CONTATO = "5587996666667";

const ModalAssinatura = ({ motivo, usuario, onLogout }) => {
  const [planos, setPlanos] = useState([]);
  const [planoSelecionado, setPlanoSelecionado] = useState(null);
  const [carregandoCheckout, setCarregandoCheckout] = useState(false);
  const [erroCheckout, setErroCheckout] = useState("");
  const [etapa, setEtapa] = useState("planos"); // "planos" | "processando"

  // Carrega planos SEMPRE do Firestore — sem fallback hardcoded
  // Isso garante que preços e planos editados no Admin aparecem corretamente
  useEffect(() => {
    getDocs(collection(db, "planos"))
      .then((snap) => {
        if (!snap.empty) {
          const lista = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(p => p.ativo !== false && p.preco > 0)
            .sort((a, b) => (a.preco || 0) - (b.preco || 0));
          setPlanos(lista);
          const destaque = lista.find(p => p.destaque);
          if (destaque) setPlanoSelecionado(destaque);
          else if (lista.length >= 2) setPlanoSelecionado(lista[1]);
          else if (lista.length === 1) setPlanoSelecionado(lista[0]);
        }
      })
      .catch((e) => {
        console.log("Erro ao carregar planos do Firestore:", e);
      });
  }, []);

  // Formata preço
  const formatarPreco = (preco) => {
    return Number(preco).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  // Calcula preço por dia
  const precoPorDia = (plano) => {
    const valor = Number(plano.preco) / plano.dias;
    return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  // Inicia o checkout no Mercado Pago
  const iniciarCheckout = async () => {
    if (!planoSelecionado) return;
    setCarregandoCheckout(true);
    setErroCheckout("");
    setEtapa("processando");

    try {
      // Usa auth.currentUser como fonte primária para garantir UID correto
      const currentUser = auth.currentUser;
      const usuarioId = currentUser?.uid || usuario?.id || "";
      const usuarioEmail = currentUser?.email || usuario?.email || "";
      const usuarioNome = usuario?.nome || currentUser?.displayName || "Médico";

      console.log("[Checkout] planoId:", planoSelecionado.id, "usuarioId:", usuarioId);

      const response = await fetch(CLOUD_FUNCTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planoId: planoSelecionado.id,
          usuarioId,
          usuarioEmail,
          usuarioNome,
        }),
      });

      if (!response.ok) {
        throw new Error("Erro ao criar preferência");
      }

      const dados = await response.json();

      // Redireciona para o checkout do Mercado Pago
      if (dados.checkoutUrl) {
        window.location.href = dados.checkoutUrl;
      } else {
        throw new Error("URL de checkout não retornada");
      }

    } catch (error) {
      console.error("Erro checkout:", error);
      setErroCheckout("Erro ao iniciar pagamento. Tente via WhatsApp.");
      setCarregandoCheckout(false);
      setEtapa("planos");
    }
  };

  return (
    <div style={st.overlay}>
      <div style={st.modal}>

        {/* HEADER */}
        <div style={st.header}>
          <FaLock size={28} color="#ef4444" />
          <div>
            <h2 style={st.titulo}>{motivo}</h2>
            <p style={st.subtitulo}>
              {motivo === "CONTA BLOQUEADA"
                ? "Sua conta foi suspensa. Entre em contato com o suporte."
                : "Escolha um plano para continuar sua preparação de elite."}
            </p>
          </div>
        </div>

        {etapa === "processando" ? (
          // TELA DE PROCESSAMENTO
          <div style={st.processando}>
            <div style={st.spinnerBox}>
              <FaSpinner size={32} color="#4f46e5" style={{ animation: "spin 1s linear infinite" }} />
            </div>
            <h3 style={{ color: "#fff", margin: "20px 0 8px" }}>Redirecionando...</h3>
            <p style={{ color: "#94a3b8", fontSize: "14px" }}>
              Você será direcionado ao checkout seguro do Mercado Pago.
            </p>
            <div style={st.segurancaRow}>
              <FaShieldAlt color="#10b981" size={12} />
              <span style={{ color: "#10b981", fontSize: "11px", fontWeight: "700" }}>AMBIENTE 100% SEGURO</span>
            </div>
          </div>
        ) : (
          <>
            {/* LISTA DE PLANOS */}
            <div style={st.planosLista}>
              {planos.length === 0 ? (
                // Fallback enquanto planos carregam
                <div style={{ textAlign: "center", padding: "20px", color: "#64748b" }}>
                  <FaSpinner style={{ animation: "spin 1s linear infinite" }} />
                  <p style={{ marginTop: "8px", fontSize: "13px" }}>Carregando planos...</p>
                </div>
              ) : (
                planos.map(plano => {
                  const selecionado = planoSelecionado?.id === plano.id;
                  return (
                    <div
                      key={plano.id}
                      onClick={() => setPlanoSelecionado(plano)}
                      style={{
                        ...st.planoCard,
                        borderColor: selecionado
                          ? (plano.cor || "#4f46e5")
                          : plano.destaque ? "rgba(251,191,36,0.3)" : "#334155",
                        background: selecionado
                          ? `${plano.cor || "#4f46e5"}18`
                          : plano.destaque ? "rgba(251,191,36,0.05)" : "#0f172a",
                        transform: selecionado ? "scale(1.01)" : "scale(1)",
                      }}
                    >
                      {plano.destaque && (
                        <div style={st.destaqueTag}>
                          <FaStar size={9} /> MAIS POPULAR
                        </div>
                      )}

                      <div style={st.planoLeft}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          {selecionado
                            ? <FaCheckCircle color={plano.cor || "#4f46e5"} size={14} />
                            : <div style={{ ...st.radioCircle, borderColor: plano.destaque ? "#fbbf24" : "#334155" }} />
                          }
                          <span style={{ color: "#fff", fontWeight: "800", fontSize: "14px" }}>
                            {plano.nome}
                          </span>
                        </div>
                        {plano.descricao && (
                          <p style={{ color: "#64748b", fontSize: "11px", margin: "4px 0 0 22px", lineHeight: 1.4 }}>
                            {plano.descricao}
                          </p>
                        )}
                      </div>

                      <div style={st.planoRight}>
                        <span style={{ color: plano.cor || "#fff", fontSize: "18px", fontWeight: "900" }}>
                          {formatarPreco(plano.preco)}
                        </span>
                        <span style={{ color: "#64748b", fontSize: "10px" }}>
                          {precoPorDia(plano)}/dia
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* ERRO */}
            {erroCheckout && (
              <div style={st.erroBox}>
                {erroCheckout}
              </div>
            )}

            {/* BOTÃO PAGAR */}
            {planoSelecionado && (
              <button
                onClick={iniciarCheckout}
                disabled={carregandoCheckout}
                style={{
                  ...st.btnPagar,
                  background: `linear-gradient(135deg, ${planoSelecionado.cor || "#4f46e5"}, ${planoSelecionado.cor || "#4338ca"})`,
                  opacity: carregandoCheckout ? 0.7 : 1
                }}
              >
                <FaCreditCard size={14} />
                ASSINAR {planoSelecionado.nome.toUpperCase()} — {formatarPreco(planoSelecionado.preco)}
                <FaArrowRight size={12} />
              </button>
            )}

            {/* FORMAS DE PAGAMENTO */}
            <div style={st.pagamentosRow}>
              <FaCreditCard color="#64748b" size={12} />
              <span style={{ color: "#64748b", fontSize: "11px" }}>Cartão de crédito</span>
              <FaBarcode color="#64748b" size={12} />
              <span style={{ color: "#64748b", fontSize: "11px" }}>Boleto</span>
              <FaMobileAlt color="#64748b" size={12} />
              <span style={{ color: "#64748b", fontSize: "11px" }}>Pix</span>
            </div>

            {/* DIVISOR */}
            <div style={st.divisor}>
              <div style={st.divisorLinha} />
              <span style={{ color: "#475569", fontSize: "11px", whiteSpace: "nowrap", padding: "0 12px" }}>
                ou prefere o atendimento direto?
              </span>
              <div style={st.divisorLinha} />
            </div>

            {/* WHATSAPP */}
            <button
              onClick={() => window.open(`https://wa.me/${WHATSAPP_CONTATO}`, "_blank")}
              style={st.btnWhatsapp}
            >
              <FaWhatsapp size={16} /> RENOVAR VIA WHATSAPP
            </button>

            {/* SAIR */}
            <button onClick={onLogout} style={st.btnSair}>
              <FaSignOutAlt size={12} /> VOLTAR PARA O LOGIN
            </button>

            {/* SEGURANÇA */}
            <div style={st.segurancaRow}>
              <FaShieldAlt color="#334155" size={11} />
              <span style={{ color: "#475569", fontSize: "10px" }}>
                Pagamento processado com segurança pelo Mercado Pago. Seus dados estão protegidos.
              </span>
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
};

const st = {
  overlay: {
    position: "fixed", top: 0, left: 0,
    width: "100%", height: "100%",
    background: "#020617",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 10000, padding: "20px", overflowY: "auto"
  },
  modal: {
    background: "#1e293b",
    padding: "clamp(20px, 4vw, 32px)",
    borderRadius: "28px",
    maxWidth: "480px",
    width: "100%",
    border: "1px solid #334155",
    maxHeight: "95vh",
    overflowY: "auto"
  },
  header: {
    display: "flex", alignItems: "flex-start", gap: "14px",
    marginBottom: "24px", paddingBottom: "20px",
    borderBottom: "1px solid #334155"
  },
  titulo: { color: "#fff", fontSize: "18px", fontWeight: "800", margin: 0 },
  subtitulo: { color: "#94a3b8", fontSize: "13px", margin: "4px 0 0", lineHeight: 1.5 },
  planosLista: { display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" },
  planoCard: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "14px 16px", background: "#0f172a", borderRadius: "14px",
    border: "1px solid #334155", cursor: "pointer", position: "relative",
    transition: "all 0.2s", gap: "12px"
  },
  destaqueTag: {
    position: "absolute", top: "-9px", left: "50%", transform: "translateX(-50%)",
    background: "linear-gradient(90deg, #fbbf24, #f59e0b)",
    color: "#000", fontSize: "9px", fontWeight: "900",
    padding: "3px 10px", borderRadius: "100px",
    display: "flex", alignItems: "center", gap: "4px", whiteSpace: "nowrap"
  },
  radioCircle: {
    width: "14px", height: "14px", borderRadius: "50%",
    border: "1px solid", flexShrink: 0
  },
  planoLeft: { flex: 1 },
  planoRight: { display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0 },
  erroBox: {
    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
    color: "#ef4444", padding: "12px 14px", borderRadius: "12px",
    fontSize: "13px", marginBottom: "12px", lineHeight: 1.5
  },
  btnPagar: {
    width: "100%", padding: "16px",
    color: "#fff", border: "none", borderRadius: "14px",
    fontWeight: "900", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    gap: "10px", fontSize: "14px", marginBottom: "14px",
    letterSpacing: "0.3px", transition: "all 0.2s"
  },
  pagamentosRow: {
    display: "flex", alignItems: "center", justifyContent: "center",
    gap: "8px", marginBottom: "16px", flexWrap: "wrap"
  },
  divisor: { display: "flex", alignItems: "center", marginBottom: "14px" },
  divisorLinha: { flex: 1, height: "1px", background: "#334155" },
  btnWhatsapp: {
    width: "100%", padding: "14px",
    background: "rgba(16,185,129,0.1)",
    color: "#10b981",
    border: "1px solid rgba(16,185,129,0.2)",
    borderRadius: "14px", fontWeight: "700", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    gap: "8px", fontSize: "13px", marginBottom: "10px"
  },
  btnSair: {
    background: "none", color: "#64748b", border: "none",
    cursor: "pointer", fontWeight: "700",
    display: "flex", alignItems: "center", gap: "6px",
    margin: "0 auto 16px", fontSize: "12px"
  },
  segurancaRow: {
    display: "flex", alignItems: "center", gap: "6px",
    justifyContent: "center", flexWrap: "wrap"
  },
  processando: { textAlign: "center", padding: "40px 20px" },
  spinnerBox: {
    width: "72px", height: "72px", background: "rgba(79,70,229,0.1)",
    borderRadius: "50%", display: "flex", alignItems: "center",
    justifyContent: "center", margin: "0 auto"
  },
};

export default ModalAssinatura;
