import { db, auth } from "../../firebase";
import {
  collection, doc, setDoc, serverTimestamp, addDoc, updateDoc, getDoc, getDocFromServer,
  increment, arrayUnion, arrayRemove, query, where, getDocs, writeBatch, deleteDoc
} from "firebase/firestore";

// ─── HELPERS DE DATA EM FUSO BRT (America/Sao_Paulo) ──────────────────────────
// Retornam "YYYY-MM-DD" sempre em horário de Brasília, independente
// do fuso do dispositivo do aluno. Usados para reset de meta diária e streak.
const hojeBRT = () => {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit"
  }).format(new Date());
};

const ontemBRT = () => {
  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit"
  }).format(ontem);
};

// Retorna "YYYY-MM-DD" em BRT para N dias a partir de hoje.
// Usado pelo sistema de revisão espaçada para calcular proximaRevisao.
const maisNDiasBRT = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit"
  }).format(d);
};

// Intervalos em dias por nível de revisão (Leitner simplificado).
// nivel 1 = recém-errado → revisar amanhã
// nivel 2 = acertou 1x   → revisar em 3 dias
// nivel 3 = acertou 2x+  → revisar em 7 dias (máximo)
const DIAS_POR_NIVEL_REVISAO = { 1: 1, 2: 3, 3: 7 };

/**
 * REGISTRA CADA RESPOSTA PARA O DESEMPENHO EM TEMPO REAL
 * Sincronizado com Dashboard (Missões) e Caderno de Erros (com Auto-Remoção)
 */
export const registrarRespostaIndividual = async (questao, acertou) => {
  try {
    if (!auth.currentUser) return false;

    const uid = auth.currentUser.uid;
    const userRef = doc(db, "usuarios", uid);

    // FIX: Garante que estamos usando o ID real do documento para a comunicação
    const qId = questao.id || questao.documentId;

    if (!qId) {
      console.error("ERRO: Questão sem ID detectada. O resgate não pode ser processado.");
      return false;
    }

    // 1. GRAVA NA SUBCOLEÇÃO 'respostas' (Essencial para as Missões/Dashboard)
    const subRespostasRef = collection(db, "usuarios", uid, "respostas");
    await addDoc(subRespostasRef, {
      questaoId: qId,
      materia: questao.materia || "Geral",
      subtema: questao.subtema || "Geral",
      correta: acertou,
      data: serverTimestamp()
    });

    // 2. Grava na coleção global 'estatisticas'
    await addDoc(collection(db, "estatisticas"), {
      usuarioId: uid,
      materia: questao.materia || "Geral",
      subtema: questao.subtema || "Geral",
      acertou: acertou,
      data: serverTimestamp()
    });

    // 3. LÓGICA SINCRONIZADA DO CADERNO DE ERROS (MISSÕES DE RESGATE)
    const erroId = `${uid}_${qId}`;

    // Payload único para o documento do usuário — evita múltiplos updateDoc
    // no mesmo documento, o que causava race condition e perda de dataUltimaRespostaBRT.
    const updatePayload = {};

    if (!acertou) {
      // SE ERROU: Adiciona o ID ao array do usuário e cria o registro detalhado
      updatePayload.cadernoErros = arrayUnion(qId);
      updatePayload.totalErros = increment(1);

      // Registro detalhado para que a tela de "Missões de Resgate" encontre a questão
      await setDoc(doc(db, "caderno_erros", erroId), {
        usuarioId: uid,
        questaoId: qId,
        materia: questao.materia || "Geral",
        subtema: questao.subtema || "Geral",
        provaId: questao.provaId || "",
        dataErro: serverTimestamp()
      });

      console.log(`Missão de Resgate ativada para a questão: ${qId}`);
    } else {
      // SE ACERTOU: "Alta Médica" - Remove o ID do caderno e do registro detalhado
      updatePayload.cadernoErros = arrayRemove(qId);
      updatePayload.totalAcertos = increment(1);

      try {
        await deleteDoc(doc(db, "caderno_erros", erroId));
      } catch { /* Documento pode não existir, ignorar */ }
    }

    // 4. Meta diária com LAZY RESET em BRT — consolidado no mesmo payload.
    // Campo `dataUltimaRespostaBRT` é salvo atomicamente junto com `questoesHoje`,
    // eliminando a janela de falha que existia com dois updateDoc separados.
    // IMPORTANTE: getDocFromServer (não getDoc) para ignorar cache local do SDK.
    // O cache pode conter dataUltimaRespostaBRT com data de hoje mesmo que o
    // campo não exista mais no servidor, causando falso-negativo no reset.
    const snapUsuario = await getDocFromServer(userRef);
    const dadosUsuarioAtual = snapUsuario.exists() ? snapUsuario.data() : {};
    const hojeStr = hojeBRT();
    const precisaResetarMetaDiaria = dadosUsuarioAtual.dataUltimaRespostaBRT !== hojeStr;

    if (precisaResetarMetaDiaria) {
      // Primeira resposta de um novo dia — zera o contador e marca a data
      updatePayload.questoesHoje = 1;
      updatePayload.dataUltimaRespostaBRT = hojeStr;
    } else {
      // Mesmo dia — comportamento original
      updatePayload.questoesHoje = increment(1);
    }

    // 5. Atualiza errosRecentes: últimos 10 IDs errados (campo novo, opcional).
    // Retrocompatível: se o campo não existir no documento, inicializa como [].
    // NÃO é removido ao acertar — isso permite ao dashboard identificar
    // "erro recente já resolvido" (indicador verde) cruzando errosRecentes com caderno_erros.
    if (!acertou) {
      const errosRecentesAtuais = dadosUsuarioAtual.errosRecentes || [];
      // Prepend do novo erro, remove duplicata, limita a 10 itens
      const novosErrosRecentes = [qId, ...errosRecentesAtuais.filter(id => id !== qId)].slice(0, 10);
      updatePayload.errosRecentes = novosErrosRecentes;
    }

    // 6. REVISÃO ESPAÇADA (Spaced Repetition) — campo `revisoes`, retrocompatível.
    // Cada entrada: { questaoId, nivel, proximaRevisao (YYYY-MM-DD BRT), materia, subtema }
    // Retrocompatível: se `revisoes` não existir no documento, inicializa como [].
    // A manipulação é feita em memória sobre o array lido via getDocFromServer (já presente),
    // evitando leitura adicional ao Firestore. O array atualizado entra no mesmo updatePayload.
    const revisoesBD = dadosUsuarioAtual.revisoes || [];
    const idxRevisao = revisoesBD.findIndex(r => r.questaoId === qId);

    if (!acertou) {
      // SE ERROU: criar entrada nova ou resetar existente para nivel 1 + revisão amanhã.
      // Resetar é intencional — um novo erro "desaprende" o progresso anterior.
      const novaEntrada = {
        questaoId: qId,
        nivel: 1,
        proximaRevisao: maisNDiasBRT(DIAS_POR_NIVEL_REVISAO[1]),
        materia: questao.materia || "Geral",
        subtema: questao.subtema || "Geral"
      };
      if (idxRevisao >= 0) {
        const arr = [...revisoesBD];
        arr[idxRevisao] = novaEntrada;
        updatePayload.revisoes = arr;
      } else {
        updatePayload.revisoes = [...revisoesBD, novaEntrada];
      }
    } else if (idxRevisao >= 0) {
      // SE ACERTOU e questão está em revisoes: avançar nivel (máximo 3).
      // nivel 3 permanece em ciclo de 7 dias — questão não é removida,
      // mantendo pressão de revisão periódica para temas críticos da prova.
      const entrada = revisoesBD[idxRevisao];
      const novoNivel = Math.min((entrada.nivel || 1) + 1, 3);
      const arr = [...revisoesBD];
      arr[idxRevisao] = {
        ...entrada,
        nivel: novoNivel,
        proximaRevisao: maisNDiasBRT(DIAS_POR_NIVEL_REVISAO[novoNivel])
      };
      updatePayload.revisoes = arr;
    }
    // SE ACERTOU e questão NÃO está em revisoes: nada a fazer — nunca foi errada.

    // ÚNICO updateDoc no documento do usuário — garante atomicidade dos campos
    await updateDoc(userRef, updatePayload);

    return true;
  } catch (e) {
    console.error("Erro crítico na persistência dos dados:", e);
    return false;
  }
};

/**
 * ATUALIZA STREAK DE DIAS CONSECUTIVOS ESTUDADOS
 * Deve ser chamada uma vez ao finalizar o simulado
 */
export const atualizarStreakDiario = async () => {
  try {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const userRef = doc(db, "usuarios", uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) return;

    const dados = snap.data();
    // FIX: usa fuso America/Sao_Paulo em vez de UTC para não quebrar
    // o streak de alunos estudando à noite (22h BRT = 01h UTC do dia seguinte).
    const hoje = hojeBRT();
    if (dados.ultimoDiaEstudo === hoje) return; // já atualizado hoje

    const ontemStr = ontemBRT();

    const streakAtual = dados.streakAtual || 0;
    const novoStreak = dados.ultimoDiaEstudo === ontemStr ? streakAtual + 1 : 1;
    const melhorStreak = Math.max(novoStreak, dados.melhorStreak || 0);

    await updateDoc(userRef, {
      streakAtual: novoStreak,
      melhorStreak,
      ultimoDiaEstudo: hoje
    });
  } catch (e) {
    console.error("Erro ao atualizar streak:", e);
  }
};

/**
 * GRAVA O RESUMO DO SIMULADO (HISTÓRICO)
 */
export const gravarDesempenhoFinalLote = async (materia, total, acertos) => {
  try {
    if (!auth.currentUser) return true;

    await addDoc(collection(db, "estatisticas_lote"), {
      usuarioId: auth.currentUser.uid,
      materia: materia,
      total: total,
      acertos: acertos,
      data: serverTimestamp()
    });
    return true;
  } catch (e) {
    console.error("Erro ao gravar desempenho final:", e);
    return false;
  }
};

/**
 * ATUALIZA MÉDIA GERAL E TEMPO DE ESTUDO AO FINALIZAR SESSÃO
 * Deve ser chamada uma vez ao finalizar ou sair do simulado
 */
export const atualizarEstatisticasFinais = async (tempoEstudadoSegundos = 0) => {
  try {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const userRef = doc(db, "usuarios", uid);
    // FIX: trocado getDoc → getDocFromServer para evitar que o cache local
    // forneça totalAcertos/totalErros desatualizados após um simulado longo,
    // o que causava cálculo de mediaGeral incorreto sobrescrevendo o valor correto.
    const snap = await getDocFromServer(userRef);
    if (!snap.exists()) return;

    const dados = snap.data();
    const totalAcertos = dados.totalAcertos || 0;
    const totalErros = dados.totalErros || 0;
    const totalResolvidas = totalAcertos + totalErros;
    const mediaGeral = totalResolvidas > 0
      ? Math.round((totalAcertos / totalResolvidas) * 100)
      : 0;

    await updateDoc(userRef, {
      mediaGeral,
      tempoTotalEstudo: increment(tempoEstudadoSegundos)
    });
  } catch (e) {
    console.error("Erro ao atualizar estatísticas finais:", e);
  }
};

/**
 * RESET TOTAL DE CICLO - Limpa todo o histórico do aluno
 */
export const resetarHistoricoMedico = async () => {
  try {
    if (!auth.currentUser) return false;
    const uid = auth.currentUser.uid;
    const batch = writeBatch(db);

    const userRef = doc(db, "usuarios", uid);
    batch.update(userRef, {
      questoesHoje: 0,
      totalAcertos: 0,
      totalErros: 0,
      cadernoErros: [],
      mediaGeral: 0,
      // FIX: campos adicionados ao reset — sem eles, o sistema de revisão
      // espaçada e o histórico de erros recentes permaneciam com dados da
      // "vida anterior" após o reset, causando inconsistência no dashboard.
      revisoes: [],
      errosRecentes: []
    });

    // Limpeza de estatísticas individuais
    const qEst = query(collection(db, "estatisticas"), where("usuarioId", "==", uid));
    const snapEst = await getDocs(qEst);
    snapEst.forEach((d) => batch.delete(d.ref));

    // Limpeza de histórico de lotes
    const qLote = query(collection(db, "estatisticas_lote"), where("usuarioId", "==", uid));
    const snapLote = await getDocs(qLote);
    snapLote.forEach((d) => batch.delete(d.ref));

    // Limpeza do Caderno de Erros (Missões)
    const qCE = query(collection(db, "caderno_erros"), where("usuarioId", "==", uid));
    const snapCE = await getDocs(qCE);
    snapCE.forEach((d) => batch.delete(d.ref));

    // Limpeza da subcoleção de respostas
    const qResp = collection(db, "usuarios", uid, "respostas");
    const snapResp = await getDocs(qResp);
    snapResp.forEach((d) => batch.delete(d.ref));

    await batch.commit();
    return true;
  } catch (e) {
    console.error("Erro ao resetar histórico médico:", e);
    return false;
  }
};
