# CHECKPOINT OFICIAL — PILOTO CONTROLADO R092 (pausa: hardening de prompt pendente + análise externa aguardada)

**Data:** 2026-07-30
**Sessão:** Implementação e deploy do hotfix "Homologação Controlada DEV" (teto real de 1 chamada) + hotfix de interface (distinção visual do robô normal) + 1ª execução real controlada (R092) + auditoria da rejeição
**Status:** Pausa deliberada. Nenhuma persistência ocorreu. Hardening mínimo de prompt identificado, mas **não implementado**. Novo piloto bloqueado até o hardening ser aplicado e auditado, e até análise de imagens externas ainda não recebidas.

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

## 10. CONFIRMAÇÃO FINAL

Produção (`revalidapro-f812e`) permaneceu intocada durante toda esta fase. Nenhuma questão nova foi persistida no piloto (R092 rejeitado, nada salvo). Nenhum crédito de IA foi consumido além da 1 chamada real e controlada do piloto (mais as 3 chamadas do incidente do robô normal, já auditadas e atribuídas à ambiguidade de interface corrigida no commit `242ac4f`) e o incidente de "Failed to fetch" (0 créditos, confirmado por ausência de logs). Hardening mínimo de prompt (seção 6) identificado e documentado, mas **não implementado**. Análise de imagens externas sobre novos padrões do Revalida **aguardada, não iniciada**.
