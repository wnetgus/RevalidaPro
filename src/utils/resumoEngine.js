/**
 * resumoEngine.js — Motor de geração acoplada de resumos estratégicos
 *
 * Toda questão nova (RoboGerador / ImportadorPro) gera automaticamente
 * um resumo estratégico de 8 blocos salvo em "teorias/{tema}--{contexto}".
 *
 * Padrão: fire-and-forget — nunca bloqueia o salvamento da questão.
 * Dedup: session-level via Set — mesmo tema+contexto não é re-gerado.
 *
 * gerarESalvarResumo SEMPRE resolve (nunca rejeita) com um status estruturado
 * — { status, key, ... } — para o chamador poder logar exatamente o que
 * aconteceu (auditoria de custo: antes disso o fire-and-forget engolia toda
 * falha em silêncio). Status possíveis: "salvo" | "dedup_sessao" |
 * "dedup_firestore" | "sem_tema" | "resposta_invalida" | "rejeitado_grounding"
 * | "erro_tecnico".
 */

import { db } from "../firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { PROMPT_SISTEMA_RESUMO, PROMPT_SISTEMA_RESUMO_SA, chamarIA, executarGeracaoResumoSA } from "./promptEngine";
import { detectarDiretriz, montarBlocoDiretriz, avaliarBloqueioSeguro, DIRETRIZES_CONTROLADAS } from "../config/diretrizesControladas";

// ── Regras de contexto clínico (movidas de ResumoGerador.jsx) ─────────────────
// Analisa texto da questão e retorna o subcontexto_clinico mais provável.
// Ordem importa: regras mais específicas primeiro (gestante antes de adulto).
export const REGRAS_CONTEXTO = [
  {
    ctx: "pós-operatório",
    re: /pós.?operatório|pós.?cirúrg|pós.?op\b|após\s+(a\s+)?cirurgia|período\s+pós/i,
  },
  {
    ctx: "gestante",
    re: /gestante|grávida|gravidez|pré.natal|prenatal|obstétri|puérpera|puerpério|amamentand|semanas?\s+de\s+gestação|trimestre\s+da\s+gestação|lactente\s+em\s+aleitamento/i,
  },
  {
    ctx: "adolescente",
    re: /\badolescente\b|\b1[2-8]\s*anos?\s+(de\s+idade)?\b/i,
  },
  {
    ctx: "pediátrico",
    re: /\b(recém.?nascido|neonato|neonatal|lactente|criança|pediátri|infantil|[1-9]\s*meses?\s+de\s+vida|[1-9]\s*dias?\s+de\s+vida|\b[1-9]\s*anos?\s+(de\s+idade)?\b|\b1[01]\s*anos?\s+(de\s+idade)?\b)/i,
  },
  {
    ctx: "idoso",
    re: /\bidoso\b|\bgeriatri|idosos?\b|\b[7-9]\d\s*anos?\b|\b[1-9]\d{2}\s*anos?\b|\b6[5-9]\s*anos?\b/i,
  },
  {
    ctx: "emergência",
    re: /\bemergência\b|\burgência\b|\bPCR\b|parada\s+cardio|parada\s+respir|choque\s+sép|choque\s+anafi|politrauma|glasgow\b|ressuscitação|via\s+aérea\s+difícil/i,
  },
];

/**
 * Classifica o subcontexto_clinico de uma questão por palavras-chave.
 * Custo zero — nenhuma chamada de rede.
 * Retorna um dos 7 valores válidos ou "adulto" como padrão.
 */
export function classificarPorRegras(q) {
  const texto = [q.enunciado || "", q.subtema || "", q.tema_mestre || ""].join(" ");
  for (const { ctx, re } of REGRAS_CONTEXTO) {
    if (re.test(texto)) return ctx;
  }
  return "adulto";
}

// ── Dedup de sessão — evita re-gerar o mesmo tema+contexto ───────────────────
const _geradosNestaSessao = new Set();

// ── Sanitiza string para docId Firestore ──────────────────────────────────────
const toDocId = (tema, contexto) => {
  const base = (tema || "").trim().replace(/[/.#[\]*]/g, "-");
  const ctx  = (contexto || "").trim().replace(/[/.#[\]*]/g, "-");
  return ctx ? `${base}--${ctx}` : base;
};

// ── Compacta uma justificativa para referência de não-repetição ──────────────
// O resumo SA precisa saber o que já foi explicado nas alternativas para não
// repetir literalmente — mas enviar as 4 notas inteiras infla o prompt sem
// necessidade (elas já têm até 55 palavras cada, ver _LIMITES_SUPERAPOSTAS_2026_2
// em promptEngine.js). Corta para o suficiente pra sinalizar o ângulo já coberto.
const _compactar = (texto, max = 140) => {
  const t = String(texto || "").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
};

/**
 * Gera e salva um resumo estratégico de 8 blocos na coleção "teorias".
 *
 * Deve ser chamada fire-and-forget após salvar a questão no Firestore:
 *   gerarESalvarResumo(finalData).catch(() => {});
 *
 * @param {object} questao — objeto com tema_mestre, subtema, materia,
 *                           enunciado, raciocinio, dicaMestre,
 *                           fonte_diretriz, ano_diretriz
 */
export const gerarESalvarResumo = async (questao) => {
  const tema = questao.tema_mestre || "";
  if (!tema) return { status: "sem_tema" };

  const contexto = classificarPorRegras(questao);
  const key = toDocId(tema, contexto);

  if (_geradosNestaSessao.has(key)) return { status: "dedup_sessao", key };
  _geradosNestaSessao.add(key);

  try {
    // Dedup real (auditoria de custo): o Set acima só protege dentro da MESMA
    // sessão do navegador — reabrir a página ou rodar outro lote perdia essa
    // memória e regenerava/sobrescrevia um resumo já existente, pagando de novo
    // pelo mesmo tema+contexto. Uma leitura no Firestore é ordens de magnitude
    // mais barata que uma chamada de IA (~1.000+ tokens) — só gera se realmente
    // não existir ainda.
    const docRef = doc(db, "teorias", key);
    const jaExiste = await getDoc(docRef);
    if (jaExiste.exists()) return { status: "dedup_firestore", key };

    // ── Pré-check de governança clínica (Micro Sprint 4A.2) ──────────────────
    // Antes desta correção, só se chamava detectarDiretriz (que já filtra por
    // status) — se a diretriz do tema estivesse bloqueada, a função retornava
    // null e o código seguia para chamarIA/executarGeracaoResumoSA como se
    // não houvesse diretriz nenhuma ("sem grounding"), quando na verdade havia
    // uma diretriz conhecida e não autorizada. Este módulo só tem acesso à
    // lista estática (não carrega Firestore) — avalia o bloqueio sobre ela.
    const avaliacao = avaliarBloqueioSeguro(DIRETRIZES_CONTROLADAS, tema, questao.subtema || "");
    if (avaliacao.bloqueado) {
      return {
        status: "bloqueado_diretriz",
        key,
        motivo: avaliacao.motivo,
        diretriz: avaliacao.diretriz ? { id: avaliacao.diretriz.id, fonte: avaliacao.diretriz.fonte, status: avaliacao.diretriz.status } : null,
      };
    }

    // Detecta diretriz estática para injeção no prompt
    const diretriz = detectarDiretriz(tema, questao.subtema || "");
    const blocoDir = diretriz ? montarBlocoDiretriz(diretriz) : "";

    // ISOLAMENTO: só questões de Super Apostas usam o prompt/instrução "não repita,
    // amplie" — questões INEP (ImportadorPro) continuam com o comportamento
    // original e homologado (PROMPT_SISTEMA_RESUMO, âncora de precisão), sem
    // nenhuma mudança de comportamento nesta correção.
    const isSuperApostas = questao.modulo === "super_apostas";

    const partes = [
      `Tema: ${tema}`,
      `Contexto: ${contexto}`,
    ];
    if (blocoDir) partes.push(blocoDir);
    if (questao.raciocinio) {
      partes.push(
        isSuperApostas
          ? `\nRACIOCÍNIO CLÍNICO JÁ MOSTRADO AO ALUNO NESTA QUESTÃO (NÃO repetir — use só para calibrar nível técnico e não sobrepor conteúdo):\n${questao.raciocinio}`
          : `\nRACIOCÍNIO CLÍNICO DA QUESTÃO (use como âncora de precisão):\n${questao.raciocinio}`
      );
    }
    if (questao.dicaMestre) {
      partes.push(
        isSuperApostas
          ? `\nDICA MESTRE JÁ MOSTRADA AO ALUNO NESTA QUESTÃO (NÃO repetir):\n${questao.dicaMestre}`
          : `\nDICA MESTRE: ${questao.dicaMestre}`
      );
    }
    // estrategiaAposta: exclusiva do formato Super Apostas 2026.2 — passada como
    // referência para o resumo não duplicar o mesmo ângulo ("por que estudamos
    // isso"). Não existe no fluxo INEP/legado, então o ramo isSuperApostas=false
    // nunca aciona este bloco.
    if (isSuperApostas && questao.estrategiaAposta) {
      partes.push(`\nESTRATÉGIA DA APOSTA JÁ MOSTRADA AO ALUNO NESTA QUESTÃO (NÃO repetir):\n${questao.estrategiaAposta}`);
    }
    // Justificativas das alternativas — só existiam na entrada do prompt (o
    // texto "PROIBIDO repetir... justificativas" já estava em
    // PROMPT_SISTEMA_RESUMO_SA), mas nunca eram de fato enviadas: o modelo não
    // tinha como evitar repetir algo que nunca recebeu. finalData grava as
    // notas como campos planos (justificativaA/B/C/D[/E], não `alts.*.nota` —
    // ver RoboGerador.jsx salvarQuestoes). Só no fluxo SA, mesma lógica do
    // bloco acima — compactadas para não inflar o prompt.
    if (isSuperApostas) {
      const justificativasCompactas = ["A", "B", "C", "D", "E"]
        .map((l) => questao[`justificativa${l}`])
        .filter(Boolean)
        .map((j) => _compactar(j))
        .join(" / ");
      if (justificativasCompactas) {
        partes.push(`\nJUSTIFICATIVAS JÁ MOSTRADAS AO ALUNO NESTA QUESTÃO (NÃO repetir — use só para saber o que já foi explicado):\n${justificativasCompactas}`);
      }
    }
    const promptUsuario = partes.join("\n");

    // ISOLAMENTO mantido: só o fluxo Super Apostas passa pelo orquestrador de
    // retry (executarGeracaoResumoSA) e por validarResumoSA. O resumo INEP
    // (isSuperApostas=false) continua exatamente como antes — chamarIA direto,
    // sem retry, sem saneamento de grounding — zero mudança de comportamento
    // no fluxo legado/homologado.
    if (isSuperApostas) {
      // Bloco completo (mesmo texto que o modelo recebeu, via blocoDir), não só
      // pontosCriticos — do contrário o próprio "ANO DE REFERÊNCIA" da diretriz
      // seria injetado no prompt mas rejeitado como "sem suporte" no resumo.
      const groundingTexto = blocoDir || "";

      // chamarIA nunca envia "model" no corpo da requisição — a Cloud Function
      // (functions/index.js) sempre resolve para Haiku por padrão quando
      // "model" está ausente/inválido. Logo, as 2 tentativas do orquestrador
      // são garantidamente Haiku, nunca Opus, sem precisar de nenhum parâmetro
      // extra aqui.
      const chamarIABrutoResumo = async (systemPrompt, prompt) => {
        const resposta = await chamarIA(systemPrompt, prompt);
        return { dados: Array.isArray(resposta) ? resposta[0] : resposta, usage: null };
      };

      const resultado = await executarGeracaoResumoSA(
        promptUsuario,
        PROMPT_SISTEMA_RESUMO_SA,
        { grounding: Boolean(diretriz), groundingTexto },
        chamarIABrutoResumo
      );

      if (resultado.status !== "aprovado") {
        console.warn("[resumoEngine] Resumo SA rejeitado:", key, resultado.status, resultado.problemas);
        // NÃO salva conteúdo com número/afirmação sem suporte — nunca grava
        // um documento com conteúdo clínico inválido só para "ter resumo".
        // pontos/grounding/tentativas abaixo: só para o diagnóstico DEV do
        // chamador (RoboGerador.jsx) montar o log visual — não alteram a
        // decisão acima, já tomada por validarResumoSA sem modificação.
        return {
          status: "rejeitado_grounding",
          key,
          problemas: resultado.problemas,
          pontos: resultado.dados?.pontos || null,
          grounding: diretriz ? { id: diretriz.id, fonte: diretriz.fonte, ano: diretriz.ano } : null,
          tentativas: resultado.tentativas.length,
          bloqueadoPorGrounding: resultado.status === "bloqueado",
        };
      }

      await setDoc(doc(db, "teorias", key), {
        titulo:              resultado.dados.titulo || `${tema} — ${contexto}`,
        pontos:              resultado.dados.pontos,
        tema_mestre:         tema,
        subcontexto_clinico: contexto,
        materia:             questao.materia || "",
        fonte_diretriz:      diretriz?.fonte || questao.fonte_diretriz || "",
        ano_diretriz:        diretriz?.ano   || questao.ano_diretriz   || null,
        versao:              3,
        geradoEm:            serverTimestamp(),
      });

      return { status: "salvo", key, blocos: resultado.dados.pontos.length, tentativas: resultado.tentativas.length };
    }

    // ── Fluxo legado INEP (isSuperApostas=false) — inalterado ────────────────
    const resposta = await chamarIA(PROMPT_SISTEMA_RESUMO, promptUsuario);
    const dados = Array.isArray(resposta) ? resposta[0] : resposta;

    if (!dados?.pontos) return { status: "resposta_invalida", key };

    await setDoc(doc(db, "teorias", key), {
      titulo:              dados.titulo || `${tema} — ${contexto}`,
      pontos:              dados.pontos,
      tema_mestre:         tema,
      subcontexto_clinico: contexto,
      materia:             questao.materia || "",
      fonte_diretriz:      diretriz?.fonte || questao.fonte_diretriz || "",
      ano_diretriz:        diretriz?.ano   || questao.ano_diretriz   || null,
      versao:              3,
      geradoEm:            serverTimestamp(),
    });

    return { status: "salvo", key, blocos: dados.pontos.length };
  } catch (e) {
    // Antes: fire-and-forget com .catch(() => {}) no chamador engolia isto por
    // completo (erro de rede, falha da Cloud Function, permissão do Firestore
    // etc. desapareciam sem log). Agora sempre resolve com status — o
    // chamador (RoboGerador.jsx) decide como logar cada caso.
    return { status: "erro_tecnico", key, erro: e.message };
  }
};
