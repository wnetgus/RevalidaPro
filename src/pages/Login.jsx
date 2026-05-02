import React, { useState } from "react";
import { auth } from "../firebase";
import { signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import {
  FaEnvelope, FaLock, FaGraduationCap, FaArrowRight,
  FaUserPlus, FaStethoscope, FaEye, FaEyeSlash, FaCheckCircle
} from "react-icons/fa";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [erro, setErro] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setErro("");
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email.toLowerCase().trim(),
        password
      );

      const skipVerification = import.meta.env.VITE_SKIP_EMAIL_VERIFICATION === "true";
      if (!skipVerification && !userCredential.user.emailVerified) {
        setErro("⚠️ E-mail não verificado. Acesse sua caixa de entrada e clique no link enviado.");
        await signOut(auth);
        setLoading(false);
        return;
      }

      setLoading(false);

    } catch (error) {
      const code = error.code;
      if (code === "auth/wrong-password" || code === "auth/user-not-found" || code === "auth/invalid-credential") {
        setErro("❌ E-mail ou senha incorretos. Tente novamente.");
      } else if (code === "auth/too-many-requests") {
        setErro("⚠️ Acesso bloqueado por muitas tentativas. Redefina sua senha.");
      } else if (code === "auth/user-disabled") {
        setErro("🚫 Esta conta foi desativada.");
      } else {
        setErro("Erro ao conectar. Verifique sua internet.");
      }
      await signOut(auth).catch(() => {});
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setErro("Digite seu e-mail primeiro para recuperar a senha.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.toLowerCase().trim());
      setErro("");
      alert("🩺 Link de recuperação enviado! Verifique sua caixa de entrada.");
    } catch {
      setErro("Erro ao enviar e-mail de recuperação. Verifique o e-mail digitado.");
    }
  };

  return (
    <>
      {/* ============================================================
          CSS RESPONSIVO REAL — não depende de window.innerWidth
          O painel esquerdo some automaticamente em telas pequenas
      ============================================================ */}
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .login-page {
          display: flex;
          min-height: 100vh;
          width: 100%;
          background: #0f172a;
          font-family: 'Inter', -apple-system, sans-serif;
          overflow-x: hidden;
        }

        /* PAINEL ESQUERDO — some em telas pequenas */
        .login-left {
          flex: 1.2;
          background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 60px 60px;
          border-right: 1px solid rgba(255,255,255,0.05);
          min-height: 100vh;
        }

        /* PAINEL DIREITO — ocupa tudo no mobile */
        .login-right {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 24px;
          background: #0f172a;
          min-height: 100vh;
        }

        .login-form-card {
          width: 100%;
          max-width: 400px;
        }

        .login-input {
          width: 100%;
          padding: 14px 14px 14px 44px;
          border-radius: 12px;
          background: #1e293b;
          border: 1px solid #334155;
          color: #fff;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
          box-sizing: border-box;
          font-family: inherit;
        }

        .login-input:focus {
          border-color: #4f46e5;
          box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15);
        }

        .login-input:hover {
          border-color: #475569;
        }

        .btn-login {
          width: 100%;
          padding: 15px;
          background: #4f46e5;
          color: #fff;
          border: none;
          border-radius: 12px;
          font-weight: 800;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          font-size: 14px;
          transition: all 0.2s;
          box-shadow: 0 8px 20px rgba(79, 70, 229, 0.25);
          font-family: inherit;
          letter-spacing: 0.3px;
        }

        .btn-login:hover:not(:disabled) {
          background: #4338ca;
          transform: translateY(-1px);
          box-shadow: 0 12px 24px rgba(79, 70, 229, 0.35);
        }

        .btn-login:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .info-card {
          background: rgba(255,255,255,0.03);
          padding: 18px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.05);
          transition: all 0.25s;
        }

        .info-card:hover {
          background: rgba(255,255,255,0.055);
          border-color: rgba(79,70,229,0.25);
        }

        .link-register {
          color: #4f46e5;
          font-weight: 800;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          margin-top: 10px;
          font-size: 13px;
          transition: color 0.2s;
        }

        .link-register:hover { color: #818cf8; }

        /* ============================================================
           📱 MOBILE — esconde painel esquerdo, direito ocupa tudo
        ============================================================ */
        @media (max-width: 768px) {
          .login-page {
            flex-direction: column;
          }

          /* Esconde o painel esquerdo completamente */
          .login-left {
            display: none !important;
          }

          /* Direito ocupa 100% */
          .login-right {
            flex: 1;
            width: 100%;
            min-height: 100vh;
            padding: 32px 20px;
            align-items: flex-start;
            padding-top: 48px;
          }

          .login-form-card {
            max-width: 100%;
          }

          /* Logo pequena no topo mobile */
          .mobile-logo {
            display: flex !important;
          }
        }

        /* Esconde logo mobile no desktop */
        .mobile-logo {
          display: none;
          align-items: center;
          gap: 10px;
          margin-bottom: 28px;
        }
      `}</style>

      <div className="login-page">

        {/* ── PAINEL ESQUERDO (desktop only) ── */}
        <div className="login-left">
          {/* LOGO */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "56px" }}>
            <div style={{ background: "#4f46e5", padding: "10px", borderRadius: "12px", display: "flex" }}>
              <FaGraduationCap size={22} color="#fff" />
            </div>
            <span style={{ fontWeight: "900", fontSize: "22px", letterSpacing: "1px", color: "#fff" }}>
              REVALIDA<span style={{ color: "#4f46e5" }}>PRO</span>
            </span>
          </div>

          <div style={{ maxWidth: "520px" }}>
            <div style={{
              display: "inline-block",
              background: "rgba(79,70,229,0.1)",
              color: "#818cf8",
              padding: "8px 16px",
              borderRadius: "100px",
              fontSize: "12px",
              fontWeight: "700",
              marginBottom: "24px",
              letterSpacing: "0.5px"
            }}>
              🏥 Plataforma de Elite para Médicos
            </div>

            <h1 style={{
              color: "#fff",
              fontSize: "clamp(28px, 3.5vw, 42px)",
              fontWeight: "800",
              lineHeight: 1.15,
              marginBottom: "20px"
            }}>
              Sua jornada rumo ao{" "}
              <span style={{ color: "#4f46e5" }}>CRM</span>{" "}
              começa com foco.
            </h1>

            <p style={{ color: "#94a3b8", fontSize: "16px", lineHeight: 1.7, marginBottom: "44px", fontStyle: "italic" }}>
              "O sucesso é a soma de pequenos esforços repetidos dia após dia."
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              {[
                { icon: <FaStethoscope color="#4f46e5" size={16} />, title: "Metodologia Ativa", desc: "Aprenda com seus erros de forma inteligente." },
                { icon: <FaArrowRight color="#4f46e5" size={16} />, title: "Conteúdo Atualizado", desc: "Questões baseadas nos últimos exames." },
                { icon: <FaCheckCircle color="#4f46e5" size={16} />, title: "Caderno de Erros", desc: "Identifique e supere seus pontos fracos." },
                { icon: <FaGraduationCap color="#4f46e5" size={16} />, title: "Simulados INEP", desc: "Provas reais dos últimos 5 anos." },
              ].map((item, i) => (
                <div key={i} className="info-card">
                  <div style={{ marginBottom: "10px" }}>{item.icon}</div>
                  <p style={{ color: "#fff", fontWeight: "700", margin: "0 0 4px", fontSize: "13px" }}>{item.title}</p>
                  <p style={{ color: "#64748b", fontSize: "12px", margin: 0, lineHeight: 1.5 }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── PAINEL DIREITO (formulário) ── */}
        <div className="login-right">
          <div className="login-form-card">

            {/* LOGO MOBILE — só aparece em telas pequenas */}
            <div className="mobile-logo">
              <div style={{ background: "#4f46e5", padding: "8px", borderRadius: "10px", display: "flex" }}>
                <FaGraduationCap size={18} color="#fff" />
              </div>
              <span style={{ fontWeight: "900", fontSize: "20px", color: "#fff", letterSpacing: "1px" }}>
                REVALIDA<span style={{ color: "#4f46e5" }}>PRO</span>
              </span>
            </div>

            {/* TÍTULO */}
            <div style={{ marginBottom: "28px" }}>
              <h2 style={{ color: "#fff", fontSize: "28px", fontWeight: "700", margin: "0 0 6px" }}>
                Entrar
              </h2>
              <p style={{ color: "#64748b", fontSize: "14px", margin: 0 }}>
                Bem-vindo de volta, Colega Médico.
              </p>
            </div>

            {/* AVISO FIXO — verificação de e-mail */}
            <div style={{
              background: "rgba(251,191,36,0.08)",
              border: "1px solid rgba(251,191,36,0.3)",
              borderRadius: "12px",
              padding: "12px 14px",
              marginBottom: "18px",
              display: "flex",
              gap: "10px",
              alignItems: "flex-start"
            }}>
              <span style={{ fontSize: "16px", flexShrink: 0 }}>📧</span>
              <p style={{ color: "#fbbf24", fontSize: "12px", margin: 0, lineHeight: 1.6 }}>
                <strong>Primeiro acesso?</strong> Após o cadastro, verifique sua caixa de entrada{" "}
                <strong>e também a pasta SPAM</strong> — o e-mail de ativação pode ter ido para lá.
              </p>
            </div>

            {/* MENSAGEM DE ERRO */}
            {erro && (
              <div style={{
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.25)",
                color: "#ef4444",
                padding: "12px 16px",
                borderRadius: "12px",
                fontSize: "13px",
                marginBottom: "18px",
                lineHeight: 1.5
              }}>
                {erro}
              </div>
            )}

            {/* FORMULÁRIO */}
            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>

              {/* E-MAIL */}
              <div>
                <label style={{
                  color: "#94a3b8", fontSize: "11px", fontWeight: "700",
                  marginBottom: "8px", display: "block",
                  textTransform: "uppercase", letterSpacing: "0.5px"
                }}>
                  E-mail
                </label>
                <div style={{ position: "relative" }}>
                  <FaEnvelope style={{
                    position: "absolute", left: "14px", top: "50%",
                    transform: "translateY(-50%)", color: "#4f46e5", fontSize: "14px"
                  }} />
                  <input
                    className="login-input"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* SENHA */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <label style={{
                    color: "#94a3b8", fontSize: "11px", fontWeight: "700",
                    textTransform: "uppercase", letterSpacing: "0.5px"
                  }}>
                    Senha
                  </label>
                  <span
                    onClick={handleResetPassword}
                    style={{ fontSize: "11px", color: "#4f46e5", cursor: "pointer", fontWeight: "700" }}
                  >
                    Esqueceu a senha?
                  </span>
                </div>
                <div style={{ position: "relative" }}>
                  <FaLock style={{
                    position: "absolute", left: "14px", top: "50%",
                    transform: "translateY(-50%)", color: "#4f46e5", fontSize: "14px"
                  }} />
                  <input
                    className="login-input"
                    type={showPass ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    style={{ paddingRight: "46px" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    style={{
                      position: "absolute", right: "14px", top: "50%",
                      transform: "translateY(-50%)", background: "none",
                      border: "none", color: "#64748b", cursor: "pointer",
                      fontSize: "16px", display: "flex", alignItems: "center",
                      padding: "4px"
                    }}
                  >
                    {showPass ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>

              {/* BOTÃO ENTRAR */}
              <button
                type="submit"
                className="btn-login"
                disabled={loading}
              >
                {loading ? "VALIDANDO..." : <><FaArrowRight size={13} /> ACESSAR PLATAFORMA</>}
              </button>
            </form>

            {/* RODAPÉ */}
            <div style={{
              marginTop: "28px",
              textAlign: "center",
              padding: "18px",
              borderRadius: "16px",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.04)"
            }}>
              <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>
                Ainda não tem acesso?
              </p>
              <span
                onClick={() => navigate("/register")}
                className="link-register"
              >
                <FaUserPlus size={12} /> SOLICITAR MINHA CONTA
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;
