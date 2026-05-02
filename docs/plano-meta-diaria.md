# Plano Técnico — Correção e Melhoria da Meta Diária

**Status:** proposto, aguardando aprovação para execução
**Autor do plano:** análise assistida por IA conforme orientação do Dr. Weyne
**Data:** 2026-04-17
**Escopo:** foco exclusivo na 1ª fase do Revalida. Mudança gradual, sem quebrar produção.

---

## 1. Contexto e problema

A plataforma RevalidaPro possui um card de "Meta Diária" no Dashboard (`src/pages/Dashboard.jsx`) que mostra ao aluno quantas questões ele já respondeu no dia vs. a meta definida. O campo responsável é `questoesHoje` em `usuarios/{uid}`.

**Bug observado:** o contador `questoesHoje` não é resetado ao virar o dia. Se o aluno responde 20 questões hoje e 15 amanhã, o card exibe "35 / 20 qts" e a barra de progresso fica quebrada.

**Causa raiz:** o único ponto do código que toca `questoesHoje` (fora do cadastro e do reset total) é `registrarRespostaIndividual` em `src/modules/simulador/simuladorLogic.js`, linha 80:

```js
questoesHoje: increment(1)
```

Esse `increment` acumula indefinidamente. **Nenhum ponto do código zera esse contador ao virar o dia.**

## 2. Achados complementares

Durante a análise, foram identificados dois problemas adicionais que devem ser corrigidos no mesmo trabalho:

1. **Timezone UTC no streak diário.** Em `atualizarStreakDiario` (mesmo arquivo, linha ~108), a comparação de data usa `new Date().toISOString().split("T")[0]` — isso retorna a data em UTC, não em BRT. Um aluno estudando às 22h de Brasília está em 01h UTC do dia seguinte → o streak pode ser contado de forma errada em horários noturnos.
2. **Usuários novos sem âncora temporal.** `src/pages/Register.jsx` (linha 76) inicializa `questoesHoje: 0` e `metaDiaria: 20`, mas não grava `ultimoDiaEstudo`. Isso não quebra nada, mas o fix do reset depende dessa âncora — a correção precisa tolerar o campo ausente.

## 3. Arquitetura recomendada — Lazy reset no cliente

**Decisão:** fazer o reset do `questoesHoje` **no próprio cliente, na primeira resposta do dia**, dentro de `registrarRespostaIndividual`. Timezone oficial: **America/Sao_Paulo (BRT)** — decisão do Dr. Weyne.

### 3.1 Fluxo proposto

Antes do `increment(1)` atual:

1. Ler `ultimoDiaEstudo` do documento do usuário (já vem no mesmo snapshot que a lógica atual lê; nenhuma leitura extra).
2. Calcular `hojeBRT` = data no formato `YYYY-MM-DD` convertida para America/Sao_Paulo.
3. Se `ultimoDiaEstudo !== hojeBRT`:
   - O update vira `questoesHoje: 1` (substituição, não incremento) **e** `ultimoDiaEstudo: hojeBRT`.
   - Opcional (se aprovado): também empurrar entrada no `historicoMetas` (ver seção 4.3).
4. Se `ultimoDiaEstudo === hojeBRT`:
   - Mantém o `questoesHoje: increment(1)` atual. Zero mudança de comportamento para quem está na mesma sessão do dia.

### 3.2 Helper de timezone BRT

Função pura, ~5 linhas, ficará em `src/modules/simulador/simuladorLogic.js`:

```js
// Retorna "YYYY-MM-DD" no fuso America/Sao_Paulo, independente do fuso do dispositivo
const hojeBRT = () => {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit"
  }).format(new Date());
};
```

O mesmo helper resolve o bug de UTC no `atualizarStreakDiario` — basta substituir os três usos de `new Date().toISOString().split("T")[0]` por `hojeBRT()`.

### 3.3 Por que não Cloud Function agendada

Alternativa considerada: Cloud Scheduler disparando Cloud Function à 00:00 BRT que zera `questoesHoje` de todos os usuários.

**Descartada** porque:
- Custo Firebase recorrente: 1 leitura + 1 escrita por usuário por dia. Com 1000 usuários = 60k operações/mês (dentro do free tier hoje, mas cresce linear).
- Requer deploy de função nova + configurar Cloud Scheduler.
- Não resolve o bug de timezone no streak.
- Maior superfície de falha em produção.

Fica registrada como **opção futura** caso a base chegue a um tamanho em que seja valioso garantir reset exato à meia-noite mesmo para usuário ausente.

## 4. Melhorias de UX

Cada item é independente e pode entrar em commits separados.

### 4.1 Estado "META BATIDA HOJE"

Quando `questoesHoje >= metaDiaria`:
- Card muda para fundo verde (mesma paleta do tema atual, `#10b981`).
- Selo "✓ META BATIDA HOJE" + subtitle "superou em N questões" (quando `questoesHoje > metaDiaria`).
- Barra de progresso em verde sólido, fixada em 100%.

Feedback positivo é o principal driver de retenção em apps de estudo (Duolingo, Anki).

### 4.2 Contador de reset visível

Subtítulo pequeno abaixo do "X / Y qts": *"Reseta em 3h 24min"*. Calculado 100% no cliente a partir de `hojeBRT()` — zero request.

### 4.3 Trilha dos últimos 7 dias (aprovado — campo `historicoMetas`)

Novo campo em `usuarios/{uid}`:

```js
historicoMetas: [
  { data: "2026-04-17", bateu: true,  questoes: 22, meta: 20 },
  { data: "2026-04-16", bateu: false, questoes: 8,  meta: 20 },
  // ...
  // máximo 7 entradas, FIFO
]
```

**Gravação:** dentro do mesmo ponto do lazy reset. Quando o dia vira, empurra a entrada do dia anterior (com o total final) no array e remove a mais antiga se passar de 7.

**Leitura:** o Dashboard já tem `onSnapshot` no documento do usuário — trilha aparece sem nenhuma query nova.

**Custo Firebase:** zero adicional — uma escrita por dia (já existe no lazy reset).

**Migração:** campo pode não existir em usuários antigos; o Dashboard trata como array vazio. Primeiras 7 sessões vão preenchendo.

### 4.4 Tooltip explicativo

Ícone "?" pequeno perto do título "Meta Diária". Hover/click mostra:

> *"Seu objetivo diário de questões. Reseta automaticamente todos os dias às 00h (horário de Brasília). Clique no ✏️ para ajustar."*

## 5. Plano de execução gradual

Cada passo é um commit isolado, revisável e reversível.

| Passo | O que muda | Arquivos | Risco | Reversibilidade |
|-------|-----------|----------|-------|-----------------|
| **1** — Lazy reset + fix timezone | Lógica de reset em `registrarRespostaIndividual` + helper `hojeBRT()` + correção de `atualizarStreakDiario` | `src/modules/simulador/simuladorLogic.js` | **Baixo** — mudança cirúrgica, retrocompatível com campo ausente | Revert de 1 commit |
| **2** — UX estado meta batida + contador reset | Visual do card no Dashboard | `src/pages/Dashboard.jsx` | **Muito baixo** — pura UI | Revert de 1 commit |
| **3** — Trilha 7d (`historicoMetas`) | Escrita do campo + componente visual | `src/modules/simulador/simuladorLogic.js`, `src/pages/Dashboard.jsx` | **Baixo** — campo novo, não quebra ausente | Revert + campo pode ficar sem uso (sem impacto) |
| **4** — Tooltip explicativo | Componente pequeno | `src/pages/Dashboard.jsx` | **Nulo** | Revert trivial |

Recomendo pausa entre passos 1 e 2 para validar o reset em produção por ~24h com conta real.

## 6. Checklist de teste para o Passo 1

Antes de considerar o Passo 1 finalizado, validar:

- [ ] Usuário que nunca respondeu antes: primeira resposta cria `ultimoDiaEstudo` e põe `questoesHoje: 1`.
- [ ] Usuário respondendo no mesmo dia: `questoesHoje` incrementa normalmente.
- [ ] Usuário que respondeu ontem: primeira resposta de hoje zera e põe `1`, **não** incrementa para o valor anterior + 1.
- [ ] Usuário respondendo às 23h59 BRT: contador do dia antigo.
- [ ] Usuário respondendo às 00h01 BRT: contador zerado.
- [ ] Usuário em fuso diferente (ex: aluno no Paraguai): a âncora continua sendo BRT, comportamento consistente.
- [ ] Streak: estudando às 22h BRT de domingo e 23h BRT de segunda, streak vira 2 (hoje está contando 1 por causa do bug UTC).
- [ ] Usuário antigo sem `ultimoDiaEstudo`: primeira resposta após deploy **não** zera nada acidentalmente (fallback seguro).
- [ ] Caso `resetarHistoricoMedico` continue funcionando (zera `questoesHoje` igual antes).

## 7. Estimativa

| Passo | Linhas de código | Tempo estimado |
|-------|------------------|----------------|
| 1 | ~25 linhas | 30 min codar + 1 dia de observação |
| 2 | ~40 linhas (estados + estilos) | 45 min |
| 3 | ~60 linhas (lógica de array + componente visual) | 1h30 |
| 4 | ~15 linhas | 10 min |

## 8. Perguntas em aberto

Nenhuma no momento — decisões do Dr. Weyne já coletadas:
- Timezone: **America/Sao_Paulo** ✓
- Documentar antes de codar: **este arquivo** ✓
- Trilha via `historicoMetas` ✓

Próxima ação: aprovação do Dr. Weyne para iniciar o **Passo 1**.

---

## Anexo A — Trecho atual da função (para referência)

Em `src/modules/simulador/simuladorLogic.js`, trecho final de `registrarRespostaIndividual`:

```js
// 4. Incrementa contador diário do médico
await updateDoc(userRef, {
  questoesHoje: increment(1)
});
```

Esse é o único ponto do código a ser alterado no Passo 1.

## Anexo B — Trecho atual do card no Dashboard

Em `src/pages/Dashboard.jsx`, linha 157:

```js
const pctMeta = Math.min(
  Math.round(((dadosUser?.questoesHoje || 0) / metaDiaria) * 100),
  100
);
```

Observe o `Math.min(..., 100)` — é justamente o que mascarava o bug visualmente: a barra para em 100% mesmo quando `questoesHoje` já acumulou muito acima. Após o fix, o cap em 100% continua fazendo sentido (para o caso de superar a meta no mesmo dia), mas o número cru também fica correto.
