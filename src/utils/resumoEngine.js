/**
 * resumoEngine.js — Motor de geração acoplada de resumos estratégicos
 *
 * Toda questão nova (RoboGerador / ImportadorPro) gera automaticamente
 * um resumo estratégico de 8 blocos salvo em "teorias/{tema}--{contexto}".
 *
 * Padrão: fire-and-forget — nunca bloqueia o salvamento da questão.
 * Dedup: session-level via Set — mesmo tema+contexto não é re-gerado.
 */

import { db } from "../firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { PROMPT_SISTEMA_RESUMO, chamarIA } from "./promptEngine";
import { detectarDiretriz, montarBlocoDiretriz } from "../config/diretrizesControladas";

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
  if (!tema) return;

  const contexto = classificarPorRegras(questao);
  const key = toDocId(tema, contexto);

  if (_geradosNestaSessao.has(key)) return;
  _geradosNestaSessao.add(key);

  // Detecta diretriz estática para injeção no prompt
  const diretriz = detectarDiretriz(tema, questao.subtema || "");
  const blocoDir = diretriz ? montarBlocoDiretriz(diretriz) : "";

  const partes = [
    `Tema: ${tema}`,
    `Contexto: ${contexto}`,
  ];
  if (blocoDir) partes.push(blocoDir);
  if (questao.raciocinio) partes.push(`\nRACIOCÍNIO CLÍNICO DA QUESTÃO (use como âncora de precisão):\n${questao.raciocinio}`);
  if (questao.dicaMestre) partes.push(`\nDICA MESTRE: ${questao.dicaMestre}`);
  const promptUsuario = partes.join("\n");

  const resposta = await chamarIA(PROMPT_SISTEMA_RESUMO, promptUsuario);
  const dados = Array.isArray(resposta) ? resposta[0] : resposta;

  if (!dados?.pontos) return;

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
};
