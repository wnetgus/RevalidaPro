import React, { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification, signOut } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import {
  FaUserMd, FaEnvelope, FaLock, FaWhatsapp, FaStethoscope,
  FaArrowRight, FaChevronLeft, FaCheckCircle, FaClock,
  FaEnvelopeOpenText, FaExclamationTriangle, FaInbox
} from "react-icons/fa";

const Register = () => {
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [genero, setGenero] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [emailCadastrado, setEmailCadastrado] = useState("");
  const [showVerificationModal, setShowVerificationModal] = useState(false);

  // Ao montar, verifica se veio de um cadastro recém feito (sessionStorage)
  useEffect(() => {
    const emailPendente = sessionStorage.getItem("revalida_email_verificacao");
    if (emailPendente) {
      sessionStorage.removeItem("revalida_email_verificacao");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEmailCadastrado(emailPendente);
      setShowVerificationModal(true);
    }
  }, []);

  const handlePhoneMask = (value) => {
    let v = value.replace(/\D/g, "");
    v = v.replace(/^(\d{2})(\d)/g, "($1) $2");
    v = v.replace(/(\d{5})(\d)/, "$1-$2");
    setTelefone(v.substring(0, 15));
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setErro("");

    if (email.trim().toLowerCase() !== confirmEmail.trim().toLowerCase()) {
      setErro("Os e-mails informados não coincidem.");
      return;
    }
    if (password.length < 6) {
      setErro("A senha deve ter no mínimo 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setErro("As senhas não coincidem.");
      return;
    }

    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth, email.trim().toLowerCase(), password
      );
      await updateProfile(userCredential.user, { displayName: nome });

      const agora = new Date();
      const expiraEm48h = new Date(agora.getTime() + 48 * 60 * 60 * 1000);
      try {
        await setDoc(doc(db, "usuarios", userCredential.user.uid), {
          nome, genero, telefone,
          email: email.trim().toLowerCase(),
          role: "aluno", status: "ativo",
          dataExpiracao: expiraEm48h,
          totalAcertos: 0, totalErros: 0, questoesHoje: 0,
          metaDiaria: 20, cadernoErros: [],
          boasVindasVisto: false,
          createdAt: serverTimestamp(),
        });
      } catch (firestoreError) {
        console.warn("Aviso Firestore:", firestoreError.message);
      }

      await sendEmailVerification(userCredential.user);

      // Salva o email no sessionStorage ANTES do signOut
      // O signOut desmonta este componente — o useEffect ao remontar detecta
      // o sessionStorage e exibe o modal automaticamente
      const emailFinal = email.trim().toLowerCase();
      sessionStorage.setItem("revalida_email_verificacao", emailFinal);
      setLoading(false);

      await signOut(auth);
      // Força remontagem do Register para o useEffect disparar
      navigate("/register");

    } catch (error) {
      console.error(error);
      if (error.code === "auth/email-already-in-use") {
        setErro("Este e-mail já está cadastrado em nossa base.");
      } else if (error.code === "auth/weak-password") {
        setErro("A senha deve ter no mínimo 6 caracteres.");
      } else if (error.code === "auth/invalid-email") {
        setErro("E-mail inválido. Verifique o endereço digitado.");
      } else {
        setErro("Erro ao cadastrar. Verifique os dados e tente novamente.");
      }
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .reg-page { display: flex; min-height: 100vh; width: 100%; background: #0f172a; font-family: 'Inter', -apple-system, sans-serif; overflow-x: hidden; }
        .reg-left { flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 40px 60px; background: #0f172a; overflow-y: auto; }
        .reg-right { flex: 1.1; background: linear-gradient(135deg, #4f46e5 0%, #1e1b4b 100%); display: flex; flex-direction: column; align-items: center; justify-content: center; color: white; padding: 60px; position: relative; }
        .reg-input { width: 100%; padding: 14px 15px 14px 45px; border-radius: 14px; border: 1px solid #334155; background: #1e293b; color: white; outline: none; box-sizing: border-box; font-size: 14px; font-family: inherit; transition: border-color 0.2s, box-shadow 0.2s; }
        .reg-input:focus { border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,0.15); }
        .reg-select { width: 100%; padding: 14px 15px; border-radius: 14px; border: 1px solid #334155; background: #1e293b; color: white; outline: none; font-size: 14px; font-family: inherit; cursor: pointer; }
        .btn-submit { width: 100%; padding: 18px; background: #4f46e5; color: white; border: none; border-radius: 16px; font-weight: 800; font-size: 15px; cursor: pointer; margin-top: 10px; display: flex; align-items: center; justify-content: center; gap: 10px; transition: all 0.2s; font-family: inherit; }
        .btn-submit:hover:not(:disabled) { background: #4338ca; transform: translateY(-1px); }
        .btn-submit:disabled { opacity: 0.7; cursor: not-allowed; }
        @media (max-width: 768px) {
          .reg-page { flex-direction: column; }
          .reg-right { display: none !important; }
          .reg-left { padding: 32px 20px; min-height: 100vh; justify-content: flex-start; padding-top: 48px; }
          .reg-two-col { flex-direction: column !important; }
        }
        @keyframes scaleUp { from { transform: scale(0.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>

      <div className="reg-page">
        <div className="reg-left">
          <div style={{ maxWidth: "480px", width: "100%", margin: "0 auto" }}>

            <button onClick={() => navigate("/login")} style={{ background: "none", border: "none", color: "#64748b", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", marginBottom: "28px", fontSize: "14px", fontWeight: "600" }}>
              <FaChevronLeft size={10} /> Voltar ao Login
            </button>

            <h2 style={{ fontSize: "30px", fontWeight: "800", color: "#fff", marginBottom: "8px" }}>Inicie sua Jornada</h2>
            <p style={{ color: "#64748b", marginBottom: "28px", fontSize: "15px" }}>Configure sua plataforma de estudos avançados.</p>

            {erro && (
              <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444", padding: "12px 16px", borderRadius: "12px", fontSize: "13px", marginBottom: "18px", lineHeight: 1.5 }}>
                {erro}
              </div>
            )}

            <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={st.label}>NOME COMPLETO</label>
                <div style={{ position: "relative" }}>
                  <FaUserMd style={st.icon} />
                  <input className="reg-input" type="text" placeholder="Dr(a). Nome Sobrenome" onChange={e => setNome(e.target.value)} required />
                </div>
              </div>

              <div className="reg-two-col" style={{ display: "flex", gap: "14px" }}>
                <div style={{ flex: 1 }}>
                  <label style={st.label}>GÊNERO</label>
                  <select className="reg-select" onChange={e => setGenero(e.target.value)} required defaultValue="">
                    <option value="" disabled>Selecione</option>
                    <option value="Homem">Homem</option>
                    <option value="Mulher">Mulher</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={st.label}>WHATSAPP</label>
                  <div style={{ position: "relative" }}>
                    <FaWhatsapp style={st.icon} />
                    <input className="reg-input" type="text" placeholder="(99) 99999-9999" value={telefone} onChange={e => handlePhoneMask(e.target.value)} required />
                  </div>
                </div>
              </div>

              <div>
                <label style={st.label}>E-MAIL</label>
                <div style={{ position: "relative" }}>
                  <FaEnvelope style={st.icon} />
                  <input className="reg-input" type="email" placeholder="medico@exemplo.com" onChange={e => setEmail(e.target.value)} required />
                </div>
              </div>

              <div>
                <label style={st.label}>CONFIRMAR E-MAIL</label>
                <div style={{ position: "relative" }}>
                  <FaCheckCircle style={st.icon} />
                  <input className="reg-input" type="email" placeholder="medico@exemplo.com" onChange={e => setConfirmEmail(e.target.value)} required />
                </div>
              </div>

              <div className="reg-two-col" style={{ display: "flex", gap: "14px" }}>
                <div style={{ flex: 1 }}>
                  <label style={st.label}>SENHA</label>
                  <div style={{ position: "relative" }}>
                    <FaLock style={st.icon} />
                    <input className="reg-input" type="password" placeholder="••••••" onChange={e => setPassword(e.target.value)} required />
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={st.label}>CONFIRMAR SENHA</label>
                  <div style={{ position: "relative" }}>
                    <FaLock style={st.icon} />
                    <input className="reg-input" type="password" placeholder="••••••" onChange={e => setConfirmPassword(e.target.value)} required />
                  </div>
                </div>
              </div>

              <div style={{
                background: "rgba(251,191,36,0.08)",
                border: "1px solid rgba(251,191,36,0.3)",
                borderRadius: "12px",
                padding: "12px 14px",
                display: "flex",
                gap: "10px",
                alignItems: "flex-start"
              }}>
                <span style={{ fontSize: "15px", flexShrink: 0 }}>📧</span>
                <p style={{ color: "#fbbf24", fontSize: "12px", margin: 0, lineHeight: 1.6 }}>
                  Após o cadastro, verifique sua caixa de entrada <strong>e a pasta SPAM</strong> — o e-mail de ativação pode ter ido para lá.
                </p>
              </div>

              <button type="submit" className="btn-submit" disabled={loading}>
                {loading ? "CONFIGURANDO PRONTUÁRIO..." : <><FaArrowRight size={14} /> CONCLUIR CADASTRO</>}
              </button>
            </form>
          </div>
        </div>

        <div className="reg-right">
          <div style={{ position: "absolute", top: "10%", right: "10%", fontSize: "180px", opacity: 0.05 }}><FaStethoscope /></div>
          <div style={{ maxWidth: "500px", textAlign: "center", zIndex: 1 }}>
            <h1 style={{ fontSize: "clamp(32px,4vw,52px)", fontWeight: "900", marginBottom: "25px", lineHeight: 1.1 }}>Parabéns pela<br />escolha, Dr(a)!</h1>
            <p style={{ fontSize: "18px", color: "rgba(255,255,255,0.8)", lineHeight: 1.6, marginBottom: "40px" }}>A jornada para o seu CRM 2026 começa agora.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", textAlign: "left" }}>
              {["48 horas de acesso VIP gratuito", "Banco de questões INEP exclusivo", "Caderno de erros inteligente", "Consultoria com especialistas"].map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <FaCheckCircle color="#10b981" size={16} style={{ flexShrink: 0 }} />
                  <span style={{ color: "rgba(255,255,255,0.85)", fontSize: "15px" }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ✅ MODAL — aparece ANTES do signOut, zIndex 9999 garante visibilidade */}
        {showVerificationModal && (
          <div style={st.modalOverlay}>
            <div style={st.modalContent}>
              <div style={st.iconCircle}><FaEnvelopeOpenText size={34} color="#10b981" /></div>

              <h2 style={{ color: "#fff", margin: "20px 0 8px", fontSize: "22px", fontWeight: "800" }}>Falta apenas um passo!</h2>
              <p style={{ color: "#94a3b8", lineHeight: 1.7, marginBottom: "16px", fontSize: "14px" }}>
                Enviamos um <strong style={{ color: "#fff" }}>link de ativação</strong> para:
              </p>

              <div style={st.emailBadge}>
                <FaEnvelope size={13} color="#818cf8" />
                <span style={{ color: "#818cf8", fontWeight: "700", fontSize: "14px" }}>{emailCadastrado}</span>
              </div>

              <div style={st.spamBox}>
                <div style={st.spamHeader}>
                  <FaExclamationTriangle color="#fbbf24" size={16} />
                  <strong style={{ color: "#fbbf24", fontSize: "14px" }}>ATENÇÃO — Verifique o SPAM!</strong>
                </div>
                <p style={{ color: "#f1f5f9", fontSize: "13px", lineHeight: 1.7, margin: 0 }}>
                  Nosso e-mail pode ter ido para a <strong style={{ color: "#fbbf24" }}>caixa de SPAM</strong> ou <strong style={{ color: "#fbbf24" }}>Lixo Eletrônico</strong>.
                  Se não encontrar na entrada em 2 minutos, <strong style={{ color: "#fbbf24" }}>abra o SPAM</strong> e procure um e-mail do RevalidaPro.
                </p>
              </div>

              <div style={st.passoBox}>
                {[
                  { icon: <FaInbox size={14} color="#10b981" />, texto: "Abra seu e-mail e verifique a caixa de entrada" },
                  { icon: <FaExclamationTriangle size={14} color="#fbbf24" />, texto: "Se não estiver lá, abra a pasta SPAM ou Lixo Eletrônico" },
                  { icon: <FaEnvelopeOpenText size={14} color="#818cf8" />, texto: "Clique no link de ativação do e-mail do RevalidaPro" },
                  { icon: <FaArrowRight size={14} color="#4f46e5" />, texto: "Volte aqui e faça seu login normalmente" },
                ].map((item, i) => (
                  <div key={i} style={st.passoItem}>
                    <div style={st.passoIcon}>{item.icon}</div>
                    <span style={{ color: "#cbd5e1", fontSize: "13px", lineHeight: 1.5 }}>{item.texto}</span>
                  </div>
                ))}
              </div>

              <div style={st.trialBadge}><FaClock size={12} /> SUAS 48H VIP COMEÇAM APÓS A ATIVAÇÃO</div>

              <button onClick={() => navigate("/login")} style={st.btnModal}>IR PARA O LOGIN</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

const st = {
  label: { fontSize: "11px", fontWeight: "800", color: "#4f46e5", marginBottom: "8px", letterSpacing: "1px", display: "block" },
  icon: { position: "absolute", left: "15px", top: "50%", transform: "translateY(-50%)", color: "#4f46e5", zIndex: 2, fontSize: "14px" },
  modalOverlay: { position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(2,6,23,0.97)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "20px", overflowY: "auto" },
  modalContent: { background: "#1e293b", padding: "clamp(24px,5vw,40px)", borderRadius: "28px", border: "1px solid #334155", textAlign: "center", maxWidth: "460px", width: "100%", animation: "scaleUp 0.35s ease-out", boxShadow: "0 25px 50px rgba(0,0,0,0.5)" },
  iconCircle: { background: "rgba(16,185,129,0.1)", width: "76px", height: "76px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" },
  emailBadge: { display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", background: "rgba(129,140,248,0.1)", border: "1px solid rgba(129,140,248,0.2)", padding: "10px 16px", borderRadius: "12px", marginBottom: "18px", flexWrap: "wrap" },
  spamBox: { background: "rgba(251,191,36,0.1)", border: "2px solid rgba(251,191,36,0.4)", borderRadius: "14px", padding: "16px", marginBottom: "18px", textAlign: "left" },
  spamHeader: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" },
  passoBox: { background: "rgba(255,255,255,0.03)", border: "1px solid #334155", borderRadius: "14px", padding: "16px", marginBottom: "18px", display: "flex", flexDirection: "column", gap: "12px", textAlign: "left" },
  passoItem: { display: "flex", alignItems: "flex-start", gap: "12px" },
  passoIcon: { width: "28px", height: "28px", borderRadius: "8px", background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  trialBadge: { background: "rgba(251,191,36,0.1)", color: "#fbbf24", padding: "8px 16px", borderRadius: "10px", fontSize: "11px", fontWeight: "900", display: "inline-flex", alignItems: "center", gap: "8px", marginBottom: "18px", letterSpacing: "0.3px" },
  btnModal: { width: "100%", padding: "16px", background: "#4f46e5", color: "white", border: "none", borderRadius: "14px", fontWeight: "800", fontSize: "14px", cursor: "pointer", boxShadow: "0 10px 20px rgba(79,70,229,0.25)", fontFamily: "inherit" },
};

export default Register;