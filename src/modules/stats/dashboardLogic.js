// Ajuste de caminho: ../../ sobe duas pastas para achar o firebase na raiz
import { db } from "../../firebase"; 
import { 
  collection, query, where, getDocs, doc, getDoc, setDoc, serverTimestamp 
} from "firebase/firestore";

/**
 * VERIFICA SE O USUÁRIO TEM ACESSO OU SE O TRIAL EXPIROU
 */
export const verificarAcesso = async (user) => {
  if (!user) return { prazoVencido: true, diasRestantes: 0 };

  const EMAILS_ADMIN = ["drweynesouza@gmail.com", "wnetgus@gmail.com"];
  const userRef = doc(db, "usuarios", user.uid);
  const userSnap = await getDoc(userRef);

  if (EMAILS_ADMIN.includes(user.email)) {
    return { prazoVencido: false, diasRestantes: "Mestre" };
  }

  if (!userSnap.exists()) {
    const dataExp = new Date();
    dataExp.setDate(dataExp.getDate() + 7);
    
    const novosDados = {
      nome: user.displayName || "Colega Médico",
      email: user.email,
      dataExpiracao: dataExp,
      status: "free_trial",
      role: "aluno",
      dataCadastro: serverTimestamp(),
      totalAcertos: 0,
      totalErros: 0,
      questoesHoje: 0
    };

    await setDoc(userRef, novosDados);
    return { prazoVencido: false, diasRestantes: 7 };
  } else {
    const dados = userSnap.data();
    if (dados.role === 'admin') return { prazoVencido: false, diasRestantes: "Admin" };

    const expiraData = dados.dataExpiracao?.toDate ? dados.dataExpiracao.toDate() : new Date(dados.dataExpiracao || 0);
    const hoje = new Date();
    const diffTempo = expiraData - hoje;
    const diffDias = Math.ceil(diffTempo / (1000 * 60 * 60 * 24));

    return {
      prazoVencido: hoje > expiraData && dados.status !== "pago",
      diasRestantes: diffDias > 0 ? diffDias : 0
    };
  }
};

/**
 * CARREGA ESTATÍSTICAS (SINCRONIZADO)
 */
export const carregarEstatisticas = async (userId) => {
  const q = query(collection(db, "estatisticas"), where("usuarioId", "==", userId));
  const snap = await getDocs(q);
  
  let totalRespondidas = 0; 
  let acertosTotal = 0;

  const materiasNomes = ["Clínica Médica", "Cirurgia", "Pediatria", "Ginecologia", "Preventiva"];
  let mapaMaterias = {};
  materiasNomes.forEach(m => mapaMaterias[m] = { acertos: 0, total: 0 });

  snap.forEach(d => { 
    const data = d.data();
    const mat = data.materia;
    
    if(mapaMaterias[mat]) {
      mapaMaterias[mat].total += 1;
      totalRespondidas += 1;
      if (data.acertou) {
        mapaMaterias[mat].acertos += 1;
        acertosTotal += 1;
      }
    }
  });

  const formatados = Object.keys(mapaMaterias).map(m => ({
    subject: m,
    A: mapaMaterias[m].total > 0 ? Math.round((mapaMaterias[m].acertos / mapaMaterias[m].total) * 100) : 0,
    fullMark: 100,
  }));

  return { 
    stats: { 
      total: totalRespondidas, 
      acertos: acertosTotal,
      percentualGeral: totalRespondidas > 0 ? Math.round((acertosTotal / totalRespondidas) * 100) : 0
    }, 
    formatados 
  };
};