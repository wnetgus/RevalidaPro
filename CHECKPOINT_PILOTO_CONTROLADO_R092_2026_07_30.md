# CHECKPOINT OFICIAL — PILOTO CONTROLADO R092 (ciclo encerrado em 2026-07-31 — ver seção 11)

**Data:** 2026-07-30 (fase original) / **atualizado em 2026-07-31** (ver seção 11 — fechamento do ciclo)
**Sessão:** Implementação e deploy do hotfix "Homologação Controlada DEV" (teto real de 1 chamada) + hotfix de interface (distinção visual do robô normal) + 1ª execução real controlada (R092) + auditoria da rejeição
**Status (original, 2026-07-30):** Pausa deliberada. Nenhuma persistência ocorreu. Hardening mínimo de prompt identificado, mas **não implementado**. Novo piloto bloqueado até o hardening ser aplicado e auditado, e até análise de imagens externas ainda não recebidas.
**Status atual (2026-07-31):** Hardening implementado, auditado e publicado. 2ª execução real realizada. **Hotfix de normalização validado; R092 rejeitado por regra independente SA-3; sem persistência.** Ciclo do R092 encerrado — nenhuma nova tentativa autorizada. Ver seção 11.

---

## 1. AMBIENTE

| Variável | Valor |
|---|---|
| DEV | `revalidapro-dev` |
| PROD | `revalidapro-f812e` |
| Produção tocada nesta fase | **NÃO** |
| Commit de referência (HEAD ao pausar) | `242ac4f26ce75dcdb15d8e45dc0dd648b7aef731` — `fix(admin): distinguish controlled DEV pilot from normal robot` |

---

## 2. CADEIA DE MISSÕES DESTA FASE (ordem real)

1. **Homologação preventiva gratuita** — auditoria read-only do robô normal, sem execução. 68/68 testes locais PASS. Identificou 16/26 critérios de qualidade premium sem garantia estrutural completa (revisão humana declarada obrigatória a partir daqui).
2. **Fechamento de governança + especificação do hotfix** — concluiu que a auditoria de governança numérica dos resumos (checkpoint anterior) já havia sido resolvida (zero-tolerância mantida, Estratégia B adiada); R092 classificado `LIBERÁVEL QUALITATIVO`/`DISPENSAVEL`/risco `BAIXO` — liberado para piloto. Especificação do hotfix de 1 chamada real aprovada, sem implementação ainda.
3. **Implementação do Piloto Controlado DEV** — commit `0f026e2` (`feat(admin): add single-call dev pilot for question generation`). Painel novo em `RoboGerador.jsx`, helper puro `construirPromptTemaSA` extraído, opção aditiva `semResumoAutomatico` em `salvarQuestoes`. 336/336 testes locais PASS. Auditado e aprovado pelo Codex.
4. **Push + deploy Hosting DEV** do commit `0f026e2`.
5. **Correção pontual de conteúdo** — resumo da questão `SA_2026_2_Q29` (Aleitamento materno — fissura/ingurgitamento, gerada pelo robô normal antes deste hotfix) foi reprovado na revisão humana e substituído manualmente no Firestore DEV (só o campo `pontos`, via escrita direta autenticada com as credenciais do Firebase CLI) — zero IA, zero regeneração.
6. **Diagnóstico "Failed to fetch"** — 3 tentativas reais do **robô normal** (não do piloto) falharam ao chamar `gerarQuestoesIA` em DEV. Causa raiz: a Cloud Function implantada em `revalidapro-dev` estava desatualizada (anterior ao commit `ede5f67`), faltando `X-Firebase-AppCheck` no CORS `Access-Control-Allow-Headers` — o preflight do navegador bloqueava a requisição antes de qualquer chamada real. **Zero créditos consumidos** (confirmado por ausência de logs do dia no servidor).
7. **Hotfix operacional — redeploy exclusivo de `gerarQuestoesIA`** em `revalidapro-dev` (`firebase deploy --project revalidapro-dev --only functions:gerarQuestoesIA`). CORS corrigido, confirmado por OPTIONS pós-deploy (`X-Firebase-AppCheck` presente).
8. **Auditoria do incidente de 5 chamadas** — usuário relatou que uma tentativa de usar o piloto na verdade acionou o **robô normal** (3 chamadas Haiku/Haiku/Opus + resumo automático com retry = 5 chamadas reais), gerando e salvando `SA_2026_2_Q29`. Auditoria read-only confirmou, por evidência de código (logs exclusivos de `iniciarRobo`, ausência estrutural desses mesmos logs no piloto), que é **tecnicamente impossível** o piloto ter produzido esse comportamento. Causa raiz: **ambiguidade operacional de interface** — painel do piloto ficava no fim da página; checkbox pré-existente "Modo validação — 1 questão por recorte" no robô normal parecia controlado mas não tinha nenhuma das garantias reais.
9. **Hotfix de interface** — commit `242ac4f` (`fix(admin): distinguish controlled DEV pilot from normal robot`). Painel movido para o topo da página, selos de segurança inequívocos, confirmação de 2 cliques antes da chamada real, alerta explícito no checkbox do robô normal. 143/143 testes locais PASS. Deploy de Hosting DEV feito e homologado (por fonte/bundle — ver ressalva de credenciais abaixo).
10. **1ª execução real do piloto — R092** (esta fase). Resultado: candidata **rejeitada**, nenhuma persistência.
11. **Auditoria da rejeição** (read-only) — concluída com veredito **B**: validador agiu corretamente; 2 das 3 causas de rejeição são atribuíveis a lacunas comprovadas no prompt (ver seção 4).

---

## 3. EXECUÇÃO REAL DO PILOTO — R092 (única execução até agora)

- **Área:** Pediatria
- **Edição:** Revalida 2026.2
- **Tema/recorte:** "Aleitamento materno: manejo de fissura e ingurgitamento mamário"
- **Resultado:** exatamente 1 chamada consumida (contador final 1/1); zero retry; zero fallback; zero resumo automático; zero salvamento automático; candidata **rejeitada pelo validador**; botão "Salvar no DEV" permaneceu desabilitado; **nenhuma questão foi persistida; nenhum resumo foi criado; nenhuma segunda execução foi realizada.**
- **R092 não deve ser executado novamente** até o hardening mínimo (seção 6) ser implementado e auditado.

---

## 4. DIAGNÓSTICO CONSOLIDADO DA REJEIÇÃO

Motivos exatos retornados por `validarLoteSA` (`src/utils/promptEngine.js`):

**a) Anti-pistas formais (2 eixos: comprimento + "composta")** — a REGRA SA-1 (`promptEngine.js:477-488`) já proíbe nominalmente os dois eixos com "PROIBIDO" explícito. O validador (`validarLoteSA:932-947`) agiu corretamente. **Atribuído a variação/falha de aderência do modelo Haiku** — nenhum defeito de prompt encontrado aqui.

**b) Termo absoluto "sempre" sem diretriz injetada** — **gap real de alinhamento**: a REGRA SA-4 (`promptEngine.js:511-518`, linha 515) só cita como exemplo "patognomônico", "padrão-ouro", percentuais e "desde [ano]" — **não menciona explicitamente** "sempre"/"nunca"/"obrigatório"/"em todos os casos". Esses 4 termos só aparecem na SA-1 (linha 484), mas em contexto diferente (anti-pista entre alternativas, não a regra geral de grounding). O validador (`_PADROES_AFIRMACAO_FORTE`, linhas 779-788) bloqueia os 8 padrões, incluindo esses 4, dentro de `raciocinio`, `tto`, `dicaMestre` e nas notas das alternativas.

**c) `ano_diretriz`/`fonte_diretriz` preenchidos sem diretriz injetada** — **defeito de prompt comprovado**: a instrução textual (`promptEngine.js:549-550,515-517`, repetida 3 vezes) manda deixar `null`/`""` sem bloco "DIRETRIZ CONTROLADA" injetado. Mas o **exemplo de schema** `_SCHEMA_QUESTAO_SA_ABCD` (`promptEngine.js:470`) mostra `"ano_diretriz":2024,"fonte_diretriz":"MS/SUS 2024"` — valores preenchidos, contradizendo a própria instrução.

**Validador:** agiu corretamente nos 3 casos — fail-closed, zero-tolerância, nenhuma questão com esses problemas foi salva.

**Veredito da auditoria:** **B. VALIDAÇÃO CORRETA; PROMPT PRECISA DE HARDENING ANTES DE NOVO PILOTO.**

---

## 5. TESTES DA AUDITORIA (91/91 PASS, zero rede, zero IA)

- `scripts/test-piloto-controlado-dev.js` — 65/65
- `scripts/test-questao-retry-hardening.js` — 18/18
- `scripts/test-resumo-sa4-feedback.js` — 8/8

---

## 6. HARDENING MÍNIMO PENDENTE (não implementado — missão futura separada)

a) Em `_SCHEMA_QUESTAO_SA_ABCD` (`promptEngine.js:470`), trocar o exemplo:
```
"ano_diretriz": 2024, "fonte_diretriz": "MS/SUS 2024"
```
por algo compatível com a ausência de grounding:
```
"ano_diretriz": null, "fonte_diretriz": ""
```

b) Na REGRA SA-4 (`promptEngine.js:515`), explicitar que, sem diretriz controlada injetada, também são proibidos: **sempre; nunca; obrigatório; em todos os casos** (os mesmos 4 termos que a SA-1 já menciona em outro contexto).

c) Criar/atualizar testes locais e offline que comprovem: alinhamento do schema com `null`/string vazia; presença explícita dos 4 termos na SA-4; compatibilidade entre o conjunto de termos do prompt e o validador; preservação das regras anti-pistas; ausência de mudanças em modelos, chamadas, retry, fallback, persistência e resumo.

**Nada disso foi implementado nesta fase.** Requer missão própria, com autorização explícita.

---

## 7. BLOQUEIOS ATUAIS

Até nova autorização explícita, permanecem bloqueados:

- executar novamente R092;
- clicar em "Reiniciar piloto" para tentar de novo;
- executar qualquer outro recorte (incluindo R077);
- usar o robô normal para gerar questões novas;
- qualquer consumo de nova chamada de IA;
- salvar candidata;
- gerar resumo;
- alterar `SA_2026_2_Q29` ou seu resumo (já corrigido nesta fase — ver seção 2, item 5);
- qualquer toque em `revalidapro-f812e`.

---

## 8. ANÁLISE EXTERNA PENDENTE (não iniciada)

O usuário enviará, em momento futuro, imagens contendo possíveis mudanças e interpretações de plataformas de renome sobre novos padrões das provas do Revalida/ENAMED/INEP.

**Objetivos dessa análise futura (ainda não realizada):**
- identificar quais mudanças alegadas são comprovadas e quais são apenas interpretação comercial de terceiros;
- comparar os novos padrões alegados com as fontes oficiais (ENAMED/INEP/Revalida);
- verificar se os enunciados atualmente gerados estão no caminho correto;
- avaliar complexidade clínica, extensão, contextualização, comando, alternativas e perfil de competências;
- distinguir claramente ajustes globais de estilo (que exigiriam revisão ampla, deliberada e separada) do hardening técnico específico do R092 (seção 6, escopo estreito e já delimitado).

**Regra explícita:** não alterar prompts, schemas ou critérios gerais de geração somente com base em afirmações externas não verificadas. Essa análise é **independente** do hardening da seção 6 e não deve se misturar com ele.

---

## 9. COMO RETOMAR

1. Ler este checkpoint **integralmente** antes de qualquer ação.
2. Confirmar baseline Git (branch, HEAD, origin/main, ahead/behind, working tree, untracked) por leitura, antes de qualquer mudança.
3. Se a missão for o hardening da seção 6: implementar exatamente os itens (a)/(b)/(c), com testes, sem tocar em mais nada — não é uma missão de "revisão ampla de padrão".
4. Se a missão for a análise das imagens externas (seção 8): tratá-la como **investigação separada**, sem implementar nada só com base nela até confirmação cruzada com fontes oficiais.
5. Só depois de (3) auditado e aprovado, considerar nova autorização para uma 2ª execução real do piloto — never reaproveitar a mesma R092 sem entender se o hardening de fato mudaria o resultado.
6. R067 (resumo pendente de refinamento) e R077 (nunca gerado) continuam nos mesmos estados registrados nos checkpoints anteriores — não tocados por esta fase.

---

## 10. CONFIRMAÇÃO FINAL (fase 2026-07-30)

Produção (`revalidapro-f812e`) permaneceu intocada durante toda esta fase. Nenhuma questão nova foi persistida no piloto (R092 rejeitado, nada salvo). Nenhum crédito de IA foi consumido além da 1 chamada real e controlada do piloto (mais as 3 chamadas do incidente do robô normal, já auditadas e atribuídas à ambiguidade de interface corrigida no commit `242ac4f`) e o incidente de "Failed to fetch" (0 créditos, confirmado por ausência de logs). Hardening mínimo de prompt (seção 6) identificado e documentado, mas **não implementado**. Análise de imagens externas sobre novos padrões do Revalida **aguardada, não iniciada**.

---

## 11. FECHAMENTO DO CICLO R092 (2026-07-31)

**Esta seção supersede o bloqueio da seção 7 especificamente para "executar novamente R092" e a pendência da seção 6 — o hardening abaixo foi implementado, testado e auditado.** As demais pendências das seções 6/7/8 (R077, R067, análise de imagens externas) continuam nos mesmos estados registrados nas fases anteriores, não tocadas por este fechamento.

### 11.1 Cadeia de hardening implementada e auditada

Commits, em ordem (todos em `main`, todos com testes locais aprovados):

1. `a8aedb1` — precedência entre SA-3 e SA-4.
2. `58d557a` — grounding explícito injetado no user prompt.
3. `6598050` — decoupling do teste de hardening (`test-hardening-r092-sa6-sa7.js`) para não depender de HEAD.
4. `83bdc03` — `fix(super-apostas): normalize directive fields without grounding`. Centraliza em `validarLoteSA` (`src/utils/promptEngine.js`): quando `grounding === false`, `ano_diretriz` é normalizado para `null` e `fonte_diretriz` para `""` antes da validação final; valores fabricados pelo modelo são descartados sem mutar o objeto original; `_diagnosticoGroundingSA4` não chega à persistência. Quando `grounding === true`, os valores originais são preservados. SA-1, SA-3, SA-4 textual, percentual, prazo/duração, termos absolutos e pistas formais continuam ativos e independentes.

Testes locais informados no fechamento do commit `83bdc03`: `test-normalizacao-diretriz-sem-grounding.js` (15/15), `test-hardening-r092-sa6-sa7.js` (24/24), `test-grounding-user-prompt.js` (21/21), `test-piloto-controlado-dev.js` (65/65), build PASS, `git diff --check` PASS.

`83bdc03` foi reauditado de forma independente e read-only (Codex) e aprovado para push. Push realizado (`origin/main`: `6598050` → `83bdc03`, fast-forward, sem force). Nenhum outro arquivo além de `src/utils/promptEngine.js` e `scripts/test-normalizacao-diretriz-sem-grounding.js` faz parte do commit.

### 11.2 2ª execução real do piloto — R092 (localhost, código pós-`83bdc03`)

- **Tema/recorte:** "Aleitamento materno: manejo de fissura e ingurgitamento mamário" (mesmo tema da 1ª execução, seção 3).
- **Resultado:** 1 chamada consumida, sem retry, sem fallback, sem salvamento automático.
- **Rejeição:** REGRA SA-3 — campo `tto` contendo posologia numérica sem diretriz controlada injetada.
- **Achado central:** a rejeição antiga por `ano_diretriz`/`fonte_diretriz` (documentada na seção 4-c da fase 2026-07-30 como defeito de prompt comprovado) **não reapareceu** — evidência direta de que a normalização determinística do commit `83bdc03` funcionou no código real, em execução real.
- **Candidata não salva.** Botão de salvamento permaneceu desabilitado.
- **Classificação separada (conforme exigido pela missão):** (A) normalização de fonte/ano — **funcionou**; (B) candidata — **rejeitada por outra regra independente (SA-3)**, o que não representa falha do hotfix.

Uma chamada real distinta e anterior foi observada no Hosting DEV ainda não atualizado (bundle anterior ao commit `83bdc03`): rejeitada por pista formal e pela antiga SA-4 (fonte/ano sem grounding) — essa chamada serviu para confirmar, por comparação direta, que o Hosting DEV estava desatualizado antes do deploy da seção 11.3. Nenhuma candidata salva nessa chamada.

**Total conhecido neste ciclo pós-hardening: 2 chamadas reais distintas, nenhuma persistência em nenhuma delas.**

**Resultado formal do ciclo:** **"Hotfix de normalização validado; R092 rejeitado por regra independente SA-3; sem persistência."**

### 11.3 Deploy do Hosting DEV

- Comando: `firebase deploy --project revalidapro-dev --only hosting` (projeto explícito, nunca o alias `default` do `.firebaserc`, que aponta para `revalidapro-f812e`; escopo restrito a Hosting).
- Build: `npm run build:dev` (`vite build --mode development`), aprovado.
- Resultado: deploy concluído, apenas `hosting[revalidapro-dev]` — Firestore, Rules, Functions, Storage e Auth não foram tocados.
- URL: `https://revalidapro-dev.web.app`.
- Bundle publicado: `assets/index-DneAkGoW.js` — confirmado, por leitura HTTP read-only, que contém a marca `_diagnosticoGroundingSA4` introduzida pelo commit `83bdc03` (evidência de que o hotfix está ativo no Hosting DEV, não só no localhost).
- Produção (`revalidapro-f812e`) intocada durante todo o deploy.

### 11.4 Verificação visual pós-deploy (Ctrl+F5, sem geração)

Painel "Homologação Controlada DEV" disponível e carregando normalmente; ambiente identificado como `revalidapro-dev`; contador em `0/1`; campo de tema vazio; geração e salvamento desabilitados; nenhuma candidata pendente; nenhuma execução adicional de R092 ou Q29 realizada nesta verificação.

### 11.5 Decisão de governança

**R092 está encerrado.** Não será executado novamente sem nova autorização explícita e um motivo técnico novo — a combinação de teste automatizado, reauditoria independente, execução real em localhost, desaparecimento da rejeição indevida de fonte/ano, publicação do mesmo bundle no Hosting DEV e verificação visual do painel é considerada suficiente para encerrar o hotfix sem consumir mais créditos. A rejeição pela SA-3 é uma rejeição independente e legítima, não uma falha do hotfix.

### 11.6 Estado de Q29 e produção

`SA_2026_2_Q29` permanece intocada e não foi executada nesta fase (fora de escopo). Produção `revalidapro-f812e` permaneceu intocada em toda a fase 2026-07-31 (hardening, push, execução real, deploy, verificação).

### 11.7 Próximo passo recomendado (não executado)

Planejar a Q29 separadamente, começando por inspeção read-only, sem execução automática — mesma disciplina de gate aplicada ao ciclo do R092.
