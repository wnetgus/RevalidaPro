// ============================================================
// PagamentoSucesso.jsx — Página de retorno após pagamento aprovado
// Salvar em: src/pages/PagamentoSucesso.jsx
// ============================================================
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaCheckCircle, FaArrowRight, FaSpinner } from "react-icons/fa";

export const PagamentoSucesso = () => {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    // Aguarda o webhook processar (máximo 10s) e redireciona
    const interval = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(interval);
          navigate("/");
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [navigate]);

  return (
    <div style={{
      minHeight: "100vh", background: "#020617",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "20px", fontFamily: "'Inter', sans-serif"
    }}>
      <div style={{
        background: "#1e293b", borderRadius: "28px", padding: "48px 40px",
        maxWidth: "460px", width: "100%", textAlign: "center",
        border: "1px solid #334155"
      }}>
        <div style={{
          width: "90px", height: "90px", background: "rgba(16,185,129,0.1)",
          borderRadius: "50%", display: "flex", alignItems: "center",
          justifyContent: "center", margin: "0 auto 24px"
        }}>
          <FaCheckCircle size={44} color="#10b981" />
        </div>

        <h1 style={{ color: "#fff", fontSize: "26px", fontWeight: "800", margin: "0 0 10px" }}>
          Pagamento Aprovado! 🎉
        </h1>

        <p style={{ color: "#94a3b8", fontSize: "14px", lineHeight: 1.7, margin: "0 0 28px" }}>
          Seu acesso ao <strong style={{ color: "#4f46e5" }}>RevalidaPro</strong> está sendo ativado.
          Em alguns instantes você terá acesso completo à plataforma.
        </p>

        <div style={{
          background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)",
          borderRadius: "14px", padding: "16px", marginBottom: "28px"
        }}>
          <p style={{ color: "#10b981", fontSize: "13px", margin: 0, fontWeight: "700" }}>
            ✅ Pagamento processado com sucesso
          </p>
          <p style={{ color: "#64748b", fontSize: "12px", margin: "4px 0 0" }}>
            Você receberá um e-mail de confirmação em breve
          </p>
        </div>

        <button
          onClick={() => navigate("/")}
          style={{
            width: "100%", padding: "15px",
            background: "#4f46e5", color: "#fff", border: "none",
            borderRadius: "14px", fontWeight: "800", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: "10px", fontSize: "14px"
          }}
        >
          <FaArrowRight /> ACESSAR PLATAFORMA
        </button>

        <p style={{ color: "#475569", fontSize: "12px", marginTop: "16px" }}>
          Redirecionando automaticamente em {countdown}s...
        </p>
      </div>
    </div>
  );
};

// ============================================================
// PagamentoFalha.jsx — Página de retorno após pagamento recusado
// Salvar em: src/pages/PagamentoFalha.jsx
// ============================================================
export const PagamentoFalha = () => {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: "100vh", background: "#020617",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "20px", fontFamily: "'Inter', sans-serif"
    }}>
      <div style={{
        background: "#1e293b", borderRadius: "28px", padding: "48px 40px",
        maxWidth: "460px", width: "100%", textAlign: "center",
        border: "1px solid #334155"
      }}>
        <div style={{
          width: "90px", height: "90px", background: "rgba(239,68,68,0.1)",
          borderRadius: "50%", display: "flex", alignItems: "center",
          justifyContent: "center", margin: "0 auto 24px", fontSize: "44px"
        }}>
          ❌
        </div>

        <h1 style={{ color: "#fff", fontSize: "24px", fontWeight: "800", margin: "0 0 10px" }}>
          Pagamento não processado
        </h1>

        <p style={{ color: "#94a3b8", fontSize: "14px", lineHeight: 1.7, margin: "0 0 28px" }}>
          Seu pagamento não foi aprovado. Isso pode acontecer por limite do cartão,
          dados incorretos ou recusa do banco. Tente novamente ou use outro método.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <button
            onClick={() => navigate("/")}
            style={{
              width: "100%", padding: "14px",
              background: "#4f46e5", color: "#fff", border: "none",
              borderRadius: "14px", fontWeight: "800", cursor: "pointer",
              fontSize: "14px"
            }}
          >
            TENTAR NOVAMENTE
          </button>

          <button
            onClick={() => window.open("https://wa.me/5587996666667", "_blank")}
            style={{
              width: "100%", padding: "14px",
              background: "rgba(16,185,129,0.1)", color: "#10b981",
              border: "1px solid rgba(16,185,129,0.2)",
              borderRadius: "14px", fontWeight: "700", cursor: "pointer",
              fontSize: "14px"
            }}
          >
            💬 PAGAR VIA WHATSAPP
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// PagamentoPendente.jsx — Página para Pix e Boleto (aguardando)
// Salvar em: src/pages/PagamentoPendente.jsx
// ============================================================
export const PagamentoPendente = () => {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: "100vh", background: "#020617",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "20px", fontFamily: "'Inter', sans-serif"
    }}>
      <div style={{
        background: "#1e293b", borderRadius: "28px", padding: "48px 40px",
        maxWidth: "460px", width: "100%", textAlign: "center",
        border: "1px solid #334155"
      }}>
        <div style={{
          width: "90px", height: "90px", background: "rgba(251,191,36,0.1)",
          borderRadius: "50%", display: "flex", alignItems: "center",
          justifyContent: "center", margin: "0 auto 24px", fontSize: "44px"
        }}>
          ⏳
        </div>

        <h1 style={{ color: "#fff", fontSize: "24px", fontWeight: "800", margin: "0 0 10px" }}>
          Pagamento em análise
        </h1>

        <p style={{ color: "#94a3b8", fontSize: "14px", lineHeight: 1.7, margin: "0 0 24px" }}>
          Seu pagamento foi recebido e está sendo processado.
          Se você pagou via <strong style={{ color: "#fbbf24" }}>Pix</strong> ou{" "}
          <strong style={{ color: "#fbbf24" }}>Boleto</strong>,
          o acesso será liberado automaticamente após a confirmação.
        </p>

        <div style={{
          background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)",
          borderRadius: "14px", padding: "16px", marginBottom: "28px"
        }}>
          <p style={{ color: "#fbbf24", fontSize: "13px", margin: 0, fontWeight: "700" }}>
            ⏰ Prazo de compensação
          </p>
          <p style={{ color: "#64748b", fontSize: "12px", margin: "4px 0 0", lineHeight: 1.5 }}>
            Pix: até 1 hora · Boleto: até 3 dias úteis
          </p>
        </div>

        <button
          onClick={() => navigate("/")}
          style={{
            width: "100%", padding: "14px",
            background: "#1e293b", color: "#fff",
            border: "1px solid #334155",
            borderRadius: "14px", fontWeight: "700", cursor: "pointer",
            fontSize: "14px"
          }}
        >
          VOLTAR À PLATAFORMA
        </button>
      </div>
    </div>
  );
};

export default PagamentoSucesso;
