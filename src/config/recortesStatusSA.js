// ─── PRÉ-CHECK DE VIABILIDADE — SUPER APOSTAS 2026.2 ─────────────────────────
// Auditoria de custo (achado crítico 2, Lote 002): evitar chamar a Anthropic
// para um recorte que JÁ sabemos, por experiência anterior, que não vai
// passar — em vez de gastar 3 chamadas (Haiku×2 + Opus) para redescobrir o
// mesmo problema. Não é uma reclassificação completa do Mapa Mestre (R001–
// R120, que vive fora do código) — é uma trava simples e crescente: cada vez
// que um recorte falhar de forma sistemática (ex: grounding numérico
// insuficiente, mesmo motivo em >1 tentativa), ele entra aqui e some da fila
// de geração automática até alguém revisar.
//
// Casamento por substring (case-insensitive) no texto do tema digitado no
// RoboGerador — simples de propósito, sem nova arquitetura. Basta adicionar
// uma linha quando um novo recorte inviável for descoberto.

// Bloqueado de forma definitiva: recorte sabidamente sem viabilidade de
// grounding com as diretrizes controladas atuais (não adianta tentar de novo
// sem ampliar pontosCriticos primeiro).
export const RECORTES_BLOQUEADOS_SA = [
  // (vazio por ora — reservar para casos confirmados como definitivamente
  // inviáveis, não apenas "falhou uma vez")
];

// Precisa de revisão humana antes de liberar geração automática — recorte já
// tentado e rejeitado repetidamente pelo mesmo motivo estrutural.
export const RECORTES_REVISAO_HUMANA_SA = [
  {
    termo: "sífilis congênita",
    motivo:
      'Lote 002 (2026-07): rejeitado em 2 rodadas por grounding numérico insuficiente — o modelo tende a incluir números de seguimento sorológico do RN (ex.: VDRL em 1/3/6/12 meses) que não estão nos "pontosCriticos" da diretriz de Sífilis (id: "sifilis"). Ampliar a diretriz com esses pontos antes de reliberar, ou aceitar a questão sem esse dado específico.',
  },
];

const _normaliza = (s) => String(s || "").toLowerCase().trim();

/**
 * Retorna o status de viabilidade de um recorte ANTES de chamar a IA.
 * @returns {{ status: "LIBERADO" } | { status: "BLOQUEADO", motivo: string } | { status: "REVISAO_HUMANA", motivo: string }}
 */
export const statusRecorteSA = (tema) => {
  const low = _normaliza(tema);
  if (!low) return { status: "LIBERADO" };

  const bloqueado = RECORTES_BLOQUEADOS_SA.find((termo) => low.includes(_normaliza(termo)));
  if (bloqueado) {
    return { status: "BLOQUEADO", motivo: `Recorte bloqueado: contém "${bloqueado}".` };
  }

  const revisao = RECORTES_REVISAO_HUMANA_SA.find((r) => low.includes(_normaliza(r.termo)));
  if (revisao) {
    return { status: "REVISAO_HUMANA", motivo: revisao.motivo };
  }

  return { status: "LIBERADO" };
};
