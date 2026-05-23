/**
 * googleAuth.js — Login / cadastro via Google OAuth
 *
 * Fluxo:
 *   1. signInWithPopup → Firebase cria/autentica o usuário
 *   2. Verifica se o documento Firestore já existe
 *   3. Se NÃO existe (primeiro login) → cria o documento com 48h de free trial
 *      (idêntico ao fluxo do Register.jsx com email/senha)
 *   4. Se JÁ existe → nenhuma ação (preserva assinatura, bloqueios, etc.)
 *
 * O onAuthStateChanged no App.jsx cuida do resto automaticamente.
 */

import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";

const provider = new GoogleAuthProvider();
// Força sempre exibir a tela de seleção de conta
provider.setCustomParameters({ prompt: "select_account" });

/**
 * Inicia o login com Google.
 * @returns {Promise<"novo" | "existente">} indica se o usuário é novo ou já tinha conta.
 * @throws  Repassa erros do Firebase para o componente tratar.
 */
export async function loginComGoogle() {
  const resultado = await signInWithPopup(auth, provider);
  const user = resultado.user;

  // Checa se já há documento no Firestore
  const snap = await getDoc(doc(db, "usuarios", user.uid));

  if (!snap.exists()) {
    // ── NOVO USUÁRIO GOOGLE — cria perfil com 48h de free trial ──────────
    const agora = new Date();
    const expiraEm48h = new Date(agora.getTime() + 48 * 60 * 60 * 1000);

    await setDoc(doc(db, "usuarios", user.uid), {
      nome:          user.displayName || "Médico",
      email:         user.email,
      genero:        "",
      telefone:      "",
      role:          "aluno",
      status:        "ativo",
      dataExpiracao: expiraEm48h,
      totalAcertos:  0,
      totalErros:    0,
      questoesHoje:  0,
      metaDiaria:    20,
      cadernoErros:  [],
      boasVindasVisto: false,
      provider:      "google",
      createdAt:     serverTimestamp(),
    });

    return "novo";
  }

  return "existente";
}
