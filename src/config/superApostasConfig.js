/**
 * SUPER APOSTAS REVALIDA — Configuração Central
 *
 * Para mudar o nome do botão no Dashboard ou adicionar uma nova edição,
 * edite APENAS este arquivo. Nenhum outro código precisa ser alterado.
 */

export const SUPER_APOSTAS_CONFIG = {
  // ─── NOME DO BOTÃO NO DASHBOARD ───────────────────────────────────────────
  // Exemplos: "🔥 Super Apostas Revalida 2026.2"  |  "🎯 Super Apostas 2027.1"
  nome_botao: "🔥 Super Apostas Revalida 2026.1",

  // ─── EDIÇÃO PADRÃO SELECIONADA AO ABRIR O MÓDULO ─────────────────────────
  edicao_atual: "2026_1",

  // ─── EDIÇÕES DISPONÍVEIS ──────────────────────────────────────────────────
  // Para adicionar 2026.2: { valor: "2026_2", label: "Revalida 2026.2" }
  edicoes: [
    { valor: "2026_1", label: "Revalida 2026.1" },
    { valor: "2026_2", label: "Revalida 2026.2" },
    { valor: "2027_1", label: "Revalida 2027.1" },
  ],

  // ─── NÍVEIS DE APOSTA ─────────────────────────────────────────────────────
  // ALTÍSSIMO removido — distribuição agora é automática: BAIXO → MÉDIO → ALTO
  niveis_aposta: [
    { valor: "ALTO",  label: "🎯 Alto",   cor: "#ef4444", bg: "rgba(239,68,68,0.1)"  },
    { valor: "MEDIO", label: "📊 Médio",  cor: "#eab308", bg: "rgba(234,179,8,0.1)"  },
    { valor: "BAIXO", label: "💡 Baixo",  cor: "#22c55e", bg: "rgba(34,197,94,0.1)"  },
  ],

  // ─── ÁREAS / MATÉRIAS ─────────────────────────────────────────────────────
  areas: [
    "Clínica Médica",
    "Cirurgia",
    "Pediatria",
    "Ginecologia e Obstetrícia",
    "Preventiva",
  ],
};
