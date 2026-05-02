/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { UserContext } from "./context/UserContext";
import { auth, db } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  doc, onSnapshot, updateDoc, serverTimestamp, query, collection, where, getDocFromServer, Timestamp
} from "firebase/firestore";

import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import CadernoErros from "./pages/CadernoErros";
import Materiais from "./pages/Materiais";
import Perfil from "./pages/Perfil";
import AdminPainel from "./pages/AdminPainel";
import Simulador from "./pages/Simulador";
import Duvidas from "./pages/Duvidas";
import Chat from "./pages/Chat";
import Biblioteca from "./pages/Biblioteca";
import Desempenho from "./pages/Desempenho";
import Ranking from "./pages/Ranking";
import Login from "./pages/Login";
import Register from "./pages/Register";
import PrepararSimulado from "./components/PrepararSimulado";
import ModalAssinatura from "./components/ModalAssinatura";
import { PagamentoSucesso, PagamentoFalha, PagamentoPendente } from "./pages/PaginasPagamento";
import SuperApostas from "./pages/SuperApostas";
import LandingPage from "./pages/LandingPage";
import SimuladoOficial from "./pages/SimuladoOficial";
import BuscarPorTema from "./pages/BuscarPorTema";

function App() {
  const [usuario, setUsuario] = useState(null);
  const [dadosUsuario, setDadosUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [bloqueioModal, setBloqueioModal] = useState({ show: false, motivo: "", uid: "", email: "", nome: "" });
  const [notificacoesDuvida, setNotificacoesDuvida] = useState(0);
  const [notificacoesChat, setNotificacoesChat] = useState(0);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const statusOnlineSetado = useRef(false);
  const heartbeatRef       = useRef(null);   // interval do heartbeat de presença
  // ✅ Ref para guardar o estado do bloqueio — persiste entre re-renders
  const bloqueioRef = useRef(false);
  // EMAILS_ADMIN: e-mails com acesso total (sem bloqueio/expiração)
  // wnetgus@gmail.com = conta de teste local
  const EMAILS_ADMIN = ["drweynesouza@gmail.com", "wnetgus@gmail.com"];
  const EMAIL_ADMIN  = EMAILS_ADMIN[0]; // alias — mantém compatibilidade das comparações abaixo

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUsuario(user);
        bloqueioRef.current = false;

        // ── VERIFICAÇÃO INICIAL DO SERVIDOR (ignora cache) ───────────
        // Busca dados direto do servidor para decisão de bloqueio/expiração
        // sem interferência do IndexedDB cache do Firestore
        let unsubDoc = () => {};
        // Se email não verificado, Login.jsx já chama signOut — não acessa Firestore
        if (!user.emailVerified && !EMAILS_ADMIN.includes(user.email)) {
          setCarregando(false);
          return;
        }

        getDocFromServer(doc(db, "usuarios", user.uid))
          .then((snap) => {
            if (bloqueioRef.current) return;

            // Dados do usuário autenticado capturados agora (user é garantidamente válido)
            const dadosAuth = { uid: user.uid, email: user.email, nome: user.displayName || "Médico" };

            const checar = (dados) => {
              const hoje = new Date();
              const expira = dados?.dataExpiracao?.toDate ? dados.dataExpiracao.toDate() : null;
              const expirado = expira && hoje > expira;
              if (dados?.bloqueado === true) {
                bloqueioRef.current = true;
                setBloqueioModal({ show: true, motivo: "CONTA BLOQUEADA", ...dadosAuth });
                setDadosUsuario(null);
                setCarregando(false);
                return true;
              }
              if (expirado && !EMAILS_ADMIN.includes(user.email)) {
                bloqueioRef.current = true;
                setBloqueioModal({ show: true, motivo: "ASSINATURA EXPIRADA", ...dadosAuth });
                setDadosUsuario(null);
                setCarregando(false);
                return true;
              }
              return false;
            };

            if (!snap.exists()) {
              if (EMAILS_ADMIN.includes(user.email)) {
                setDadosUsuario({ id: user.uid, email: user.email, role: "admin", nome: "Admin" });
                setBloqueioModal({ show: false, motivo: "" });
              } else {
                bloqueioRef.current = true;
                setBloqueioModal({ show: true, motivo: "ASSINATURA EXPIRADA", ...dadosAuth });
                setDadosUsuario(null);
              }
              setCarregando(false);
              return;
            }

            const bloqueado = checar(snap.data());
            if (bloqueado) return;

            // Acesso válido — monta listener em tempo real para atualizações
            setBloqueioModal({ show: false, motivo: "" });
            setDadosUsuario({ id: snap.id, ...snap.data() });
            setCarregando(false);
            if (!statusOnlineSetado.current) {
              // ── Marca presença inicial ──────────────────────────────
              updateDoc(doc(db, "usuarios", user.uid), {
                online: true,
                ultimaAtividade: serverTimestamp()
              }).catch(() => {});
              statusOnlineSetado.current = true;

              // ── Heartbeat: renova ultimaAtividade a cada 30 minutos ──
              // Reduzido de 5 → 30 min para cortar writes em ~83%.
              // Ainda garante presença real: usuários inativos por >30 min
              // são considerados offline de forma aceitável para a aplicação.
              const HEARTBEAT_MS = 30 * 60 * 1000; // 30 minutos
              clearInterval(heartbeatRef.current);
              heartbeatRef.current = setInterval(() => {
                if (auth.currentUser?.uid === user.uid) {
                  updateDoc(doc(db, "usuarios", user.uid), {
                    ultimaAtividade: serverTimestamp()
                  }).catch(() => {});
                }
              }, HEARTBEAT_MS);

              // ── Marca offline ao fechar/recarregar a aba ────────────
              // beforeunload é best-effort: navegadores modernos executam
              // operações síncronas no evento, então usamos sendBeacon
              // indiretamente via updateDoc (não-await é intencional).
              const marcarOffline = () => {
                updateDoc(doc(db, "usuarios", user.uid), { online: false }).catch(() => {});
              };
              window.removeEventListener("beforeunload", marcarOffline); // evita duplicatas
              window.addEventListener("beforeunload", marcarOffline);
            }

            // ── LISTENER EM TEMPO REAL (apenas para usuários válidos) ──
            unsubDoc = onSnapshot(
              doc(db, "usuarios", user.uid),
              (snap2) => {
                if (bloqueioRef.current) return;
                if (!snap2.exists()) return;
                const dados2 = snap2.data();
                const hoje2 = new Date();
                const expira2 = dados2.dataExpiracao?.toDate ? dados2.dataExpiracao.toDate() : null;
                const expirado2 = expira2 && hoje2 > expira2;
                const dadosAuth2 = { uid: user.uid, email: user.email, nome: user.displayName || "Médico" };
                if (dados2.bloqueado === true) {
                  bloqueioRef.current = true;
                  setBloqueioModal({ show: true, motivo: "CONTA BLOQUEADA", ...dadosAuth2 });
                  setDadosUsuario(null);
                } else if (expirado2 && !EMAILS_ADMIN.includes(user.email)) {
                  bloqueioRef.current = true;
                  setBloqueioModal({ show: true, motivo: "ASSINATURA EXPIRADA", ...dadosAuth2 });
                  setDadosUsuario(null);
                } else {
                  setDadosUsuario({ id: snap2.id, ...dados2 });
                }
              },
              () => {}
            );
          })
          .catch((error) => {
            if (error.code === "permission-denied" && !EMAILS_ADMIN.includes(user.email)) {
              bloqueioRef.current = true;
              setBloqueioModal({ show: true, motivo: "ASSINATURA EXPIRADA", uid: user.uid, email: user.email, nome: user.displayName || "Médico" });
              setDadosUsuario(null);
            }
            setCarregando(false);
          });

        // ── LISTENER DÚVIDAS: com tratamento de erro silencioso ────────
        let unsubDuvidas = () => {};
      
        try {
          const qDuvidas = query(
            collection(db, "duvidas_questoes"),
            where("alunoId", "==", user.uid),
            where("respondida", "==", true),
            where("visualizadaPeloAluno", "==", false)
          );
          unsubDuvidas = onSnapshot(
            qDuvidas,
            (snap) => { setNotificacoesDuvida(snap.size); },
            () => { setNotificacoesDuvida(0); } // erro silencioso
          );
        } catch { /* silencioso */ }

        // ── LISTENER SALA CHAT: mensagens novas desde última visita ──
        let unsubChat = () => {};
        try {
          const ultimaVisita = parseInt(localStorage.getItem("revalida_ultima_visita_sala") || "0");
          const limiteVisita = new Date(ultimaVisita || Date.now() - 60 * 60 * 1000);
          const qSala = query(
            collection(db, "sala_chat"),
            where("criadoEm", ">=", Timestamp.fromDate(limiteVisita))
          );
          unsubChat = onSnapshot(
            qSala,
            (snap) => {
              const novas = snap.docs.filter(d => d.data().autorId !== user.uid).length;
              setNotificacoesChat(novas);
            },
            () => { setNotificacoesChat(0); }
          );
        } catch { /* silencioso */ }

        return () => { unsubDoc(); unsubDuvidas(); unsubChat(); };

      } else {
        // ✅ Só limpa o estado se NÃO estiver em modo bloqueio
        // Isso evita que o signOut "pisque" o modal e volte ao login
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
        if (!bloqueioRef.current) {
          setUsuario(null);
          setDadosUsuario(null);
          setBloqueioModal({ show: false, motivo: "" });
          setNotificacoesDuvida(0);
          setNotificacoesChat(0);
          statusOnlineSetado.current = false;
          setCarregando(false);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    bloqueioRef.current = false;
    setBloqueioModal({ show: false, motivo: "" });

    // Para o heartbeat imediatamente antes do signOut
    clearInterval(heartbeatRef.current);
    heartbeatRef.current = null;
    statusOnlineSetado.current = false;

    try {
      if (auth.currentUser) {
        await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { online: false }).catch(() => {});
      }
      await signOut(auth);
    } catch {
      await signOut(auth);
    }
    // Força limpeza após logout manual
    setUsuario(null);
    setDadosUsuario(null);
    setCarregando(false);
  };

  // CARREGANDO
  if (carregando) return (
    <div style={{ background: "#020617", height: "100vh", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <div className="spinner"></div>
      <p style={{ marginTop: "20px", fontWeight: "900", letterSpacing: "2px" }}>REVALIDA PRO</p>
    </div>
  );

  // MODAL DE ASSINATURA — verificado ANTES do check de usuario null
  // Assim o modal persiste mesmo se o Firebase disparar signOut em background
  if (bloqueioModal.show) {
    // Usa dados capturados no momento do login (uid/email do bloqueioModal)
    // como fonte primária — auth.currentUser pode ser null neste ponto
    const usuarioParaModal = dadosUsuario || {
      id: bloqueioModal.uid || usuario?.uid,
      email: bloqueioModal.email || usuario?.email,
      nome: bloqueioModal.nome || usuario?.displayName || "Médico",
    };
    return (
      <ModalAssinatura
        motivo={bloqueioModal.motivo}
        usuario={usuarioParaModal}
        onLogout={handleLogout}
      />
    );
  }

  // NÃO LOGADO — Landing page como porta de entrada, /login e /register acessíveis
  if (!usuario) {
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/pagamento-sucesso" element={<PagamentoSucesso />} />
        <Route path="/pagamento-falha" element={<PagamentoFalha />} />
        <Route path="/pagamento-pendente" element={<PagamentoPendente />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  const isAdmin = EMAILS_ADMIN.includes(usuario.email) ||
    dadosUsuario?.role === "admin" ||
    dadosUsuario?.role === "colaborador";

  return (
    <UserContext.Provider value={dadosUsuario}>
    <div style={{ display: "flex", background: "#020617", minHeight: "100vh" }}>
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        isAdmin={isAdmin}
        totalPendentes={notificacoesDuvida}
        totalChat={notificacoesChat}
        isMobile={isMobile}
      />
      <main style={{
        marginLeft: isMobile ? "0px" : collapsed ? "80px" : "260px",
        width: "100%",
        transition: "margin 0.3s ease-out",
        paddingTop: isMobile ? "70px" : "0"
      }}>
        <Routes>
          <Route path="/" element={<Dashboard usuario={dadosUsuario} />} />
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/preparar-simulado" element={<PrepararSimulado usuario={dadosUsuario} />} />
          <Route path="/simulado-oficial" element={<SimuladoOficial usuario={dadosUsuario} />} />
          <Route path="/simulador" element={<Simulador usuario={dadosUsuario} />} />
          <Route path="/caderno-erros" element={<CadernoErros usuario={dadosUsuario} />} />
          <Route path="/biblioteca" element={<Biblioteca usuario={dadosUsuario} />} />
          <Route path="/desempenho" element={<Desempenho usuario={dadosUsuario} />} />
          <Route path="/ranking" element={<Ranking usuario={dadosUsuario} />} />
          <Route path="/materiais" element={<Materiais usuario={dadosUsuario} />} />
          <Route path="/duvidas" element={<Duvidas usuario={dadosUsuario} />} />
          <Route path="/chat" element={<Chat usuario={dadosUsuario} />} />
          <Route path="/perfil" element={<Perfil usuario={dadosUsuario || {}} />} />
          <Route path="/super-apostas" element={<SuperApostas usuario={dadosUsuario} />} />
          <Route path="/buscar-tema" element={<BuscarPorTema usuario={dadosUsuario} />} />
          <Route path="/admin" element={isAdmin ? <AdminPainel /> : <Navigate to="/" />} />
          <Route path="/pagamento-sucesso" element={<PagamentoSucesso />} />
          <Route path="/pagamento-falha" element={<PagamentoFalha />} />
          <Route path="/pagamento-pendente" element={<PagamentoPendente />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
    </UserContext.Provider>
  );
}

export default App;
