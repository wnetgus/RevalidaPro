# CONTROLE MESTRE DE PRODUÇÃO — Super Apostas 2026.2

**Ambiente:** revalidapro-dev. **Meta:** 120 questões (R001–R100 + R101–R120).
**Fonte dos dados:** cruzamento entre o Mapa Mestre real (`auditoria_100_final.json`, `recortes_100_condensado.json`, `r101_r120.json` — arquivos legítimos de auditoria anterior, categorias 17/17/57/18/8 conferem com o checkpoint de Lote 002) e os relatórios reais de geração (`lote001_relatorio.json`, `lote002_relatorio.json`, `hotfix_reteste_relatorio.json` etc.).

⚠️ **Este controle foi montado por LEITURA DE ARQUIVOS DE REGISTRO, não por leitura ao vivo do Firestore** (sem credencial de admin/browser disponível nesta sessão). Antes de tratar como definitivo, recomenda-se conferência pontual no Firestore Console de `revalidapro-dev`, especialmente os itens marcados "verificar" na coluna Resumo e as observações da seção 3.

---

## ⛔ PRODUÇÃO EM MASSA PAUSADA (2026-07-24) — Macro Sprint de Governança Clínica em andamento

Ver `AUDITORIA_ATUALIZACAO_CLINICA_NORMATIVA_2026_2.md` (2d5eca0), `MACRO_SPRINT_GOVERNANCA_CLINICA_2026_2.md` (Fase 1: `9fd5da2`; Fase 2: `a9e4d3c`/`1c131f6`), `DOSSIER_VALIDACAO_DIRETRIZES_2026_2.md` e `MATRIZ_GROUNDING_R001_R120.md` (1c131f6).

- **Nenhuma nova questão deve ser gerada até nova autorização explícita.**
- **Q1–Q12** (já produzidas e contando para as 120) **aguardam revisão posterior** — nenhuma foi descartada, nenhuma perde o status de "conta para as 120" enquanto a revisão não aponta o contrário. **Ainda não iniciada** (aguardando nova autorização, conforme restrição explícita da Fase 2).
- **R096 permanece `PENDENTE — RECUPERAÇÃO`** — agora com diretriz `violencia_domestica` proposta (não vigente) cobrindo o tema; segue na fila de recuperação da área Preventiva, aguardando validação humana da diretriz antes de nova tentativa.
- Contagem oficial no momento da pausa: **12/120** (Q1–Q12, ver seção de contagem abaixo).
- **11 diretrizes controladas** — as 6 da Fase 1 (dm, rastreamento_colo, vacinacao, has, sifilis, hiv) + as 5 novas propostas na Fase 2 (ictericia_neonatal, diverticulite, tvp_wells, distocia_ombro, violencia_domestica) — estão todas `PENDENTE_REVISAO` e **bloqueiam geração grounded nesses temas** até confirmação humana nomeada. **Matriz completa em `MATRIZ_GROUNDING_R001_R120.md`: 55/120 recortes sem bloqueio automático conhecido, 65/120 bloqueados.**
- Retomada da produção depende de: (a) autorização explícita do usuário, e (b) não há mais bloqueio técnico ativo para o(s) tema(s) do próximo lote pretendido.

---

## PROMOÇÃO TÉCNICA PARA PRODUÇÃO — concluída em 2026-07-24

**Ambiente promovido:** `revalidapro-f812e` (produção real, distinto de `revalidapro-dev`). Esta seção documenta apenas a promoção do **código** da engine SA 2026.2 — nenhuma questão oficial foi gerada em produção ainda.

**Confirmações manuais que liberaram a promoção:**
- Conta usada no painel ADM/RoboGerador de produção: `drweynesouza@gmail.com` (não `wnetgus@gmail.com`) — rules de produção já autorizavam essa conta em `questoes`/`teorias`/`resumos_temas`, então **nenhum deploy de Firestore Rules foi necessário**.
- Firestore de produção, coleção `questoes`, `edicao == "2026_2"`: **zero documentos** confirmados manualmente no Firebase Console antes da promoção. **Primeira ID oficial esperada: `SA_2026_2_Q1`.**

**Commits (branch `main`):**
| Commit | Hash | Conteúdo |
|---|---|---|
| 1 | `7ed7cacad72e5c93bc6e8357a6f72015ec7335b2` | `feat(superapostas): add Super Apostas 2026.2 engine and UI` — 8 arquivos (promptEngine.js, resumoEngine.js, RoboGerador.jsx, recortesStatusSA.js, diretrizesControladas.js, Simulador.jsx, SimuladorFeedback.jsx, QuestionCard.jsx) |
| 1b | `ddd40301b15131e45b6e36502232029728ed7a38` | `fix(simulador): add registrarAnalyticsCognitivo dependency required by Simulador.jsx` — dependência real descoberta durante o isolamento pré-deploy (Simulador.jsx já commitado chama essa função incondicionalmente) |
| 2 | `146974d0903541ea5a81218db2290de74cf0b5e3` | `feat(functions): add model and prompt caching support to gerarQuestoesIA` — só a fatia SA de `functions/index.js` (hunk `model`/`MODELOS_PERMITIDOS`/`cache_control`), via patch cirúrgico equivalente a `git add -p` |

**Isolamento do INEP:** `EMAILS_ADMIN`/`verificarAdmin`/`extrairProvaINEP` e o cabeçalho do arquivo ficaram fora do Commit 2 (confirmado por grep no índice staged antes do commit — zero ocorrências). Para o deploy da function, o restante não commitado de `functions/index.js` foi guardado via `git stash push -- functions/index.js` antes do `firebase deploy`, e restaurado logo depois — nenhum trabalho INEP foi perdido.

**Testes pré-deploy:** `npm run lint` (sem erros novos — os 4 erros/1 warning nos 8 arquivos SA e os 10 erros em `functions/index.js` são todos pré-existentes, confirmados linha a linha contra o HEAD anterior); `npm run build:prod` PASS; bundle inspecionado — 0 ocorrências de `"DIAGNÓSTICO DEV"` e de `"revalidapro-dev"`, 0 resíduo de `IS_DEV_PROJECT`.

**Deploy Function:** `firebase deploy --project revalidapro-f812e --only functions:gerarQuestoesIA` — sucesso, só essa function foi tocada.

**Deploy Hosting:** o `dist/` da Etapa 5 incluía trabalho não-SA ainda não commitado (INEP/analytics/outras telas). Antes do deploy de Hosting, todo esse trabalho foi isolado via `git stash` (mantendo `StorageImage.jsx`, dependência real de import de `Simulador.jsx`/`QuestionCard.jsx`), o build foi refeito só com os 3 commits SA (`npx vite build --mode production`), o bundle isolado foi reinspecionado (mesmos 0 resíduos DEV), e só então `firebase deploy --project revalidapro-f812e --only hosting` rodou. Confirmado por smoke test: `index.html` em produção referencia exatamente o bundle desse build isolado (`assets/index-DTDlANy-.js`). Todo o trabalho não-SA foi restaurado ao working tree logo depois, sem perdas.

**Firestore Rules:** não alteradas, não deployadas nesta promoção (Cenário A confirmado).

**Smoke test sem navegador:** Hosting root `200`; `gerarQuestoesIA` responde CORS (`OPTIONS` → `204`), valida corretamente sem chamar a Anthropic (`POST` sem `prompt` → `400`), rejeita método errado (`GET` → `405`). **Verificação visual (login como admin, RoboGerador, numeração exibida, Simulador) não foi feita — requer navegador, não disponível nesta sessão.**

**Nenhuma questão oficial foi gerada. Nenhuma chamada à API Anthropic foi feita.**

**Status:** produção pronta para o smoke test visual do usuário e, em seguida, a primeira geração controlada de `SA_2026_2_Q1`.

### Correção de reprodutibilidade — `StorageImage.jsx` (2026-07-24, mesmo dia)

Auditoria pós-promoção encontrou uma lacuna: `StorageImage.jsx` (usado por `Simulador.jsx`/`QuestionCard.jsx`, ambos já commitados) tinha ficado **untracked** — nenhum commit o incluía. Confirmado empiricamente: um clone limpo do HEAD `0bd07d8` falha o build (`Could not resolve "../components/StorageImage"`). Arquivo auditado (sem código INEP, sem segredo, sem dependência temporária — só `../firebase` e `firebase/storage`, ambos já estáveis) e commitado isoladamente:

**Commit 3:** `c746e5a1d270cee3161e28db81524bafad9e89da` — `fix(simulator): include StorageImage runtime dependency`.

**Validação de reprodutibilidade:** clone limpo do novo HEAD (`c746e5a`) + `npm install` + `vite build --mode production` → **PASS** (741 módulos); build repetido duas vezes no mesmo clone produz hash idêntico (`index-B530gwv-.js`, byte-a-byte igual) — determinístico dentro do mesmo ambiente. Bundle sem `DIAGNÓSTICO DEV`/`revalidapro-dev`.

**Diferença encontrada (não-bloqueante):** o bundle do clone limpo (`index-B530gwv-.js`) difere em ~153 bytes do bundle já publicado em produção (`index-DTDlANy-.js`), mas a causa **não é o commit do StorageImage** (arquivo idêntico em ambos) — é o `package-lock.json` do repo principal estar divergente do HEAD commitado (tem a devDependency `playwright`, ainda não commitada), o que muda o dedupe/hoisting das dependências transitivas e afeta como o bundler organiza o código de upload do Firebase Storage (`uploadBytes`, usado por `Perfil.jsx`, feature pré-existente e não relacionada à SA). Nenhuma mudança de comportamento — decisão registrada: **não redeployar Hosting só por isso**; produção já reflete o código funcionalmente correto.

**Baseline final que corresponde à produção:**
- Branch: `main` — HEAD: `c746e5a1d270cee3161e28db81524bafad9e89da`
- Commits SA: `7ed7cac` (frontend/engine), `ddd4030` (dependência simuladorLogic), `146974d` (function), `0bd07d8` (docs), `c746e5a` (StorageImage)
- Function `gerarQuestoesIA`: promovida em produção (`revalidapro-f812e`)
- Hosting: promovido em produção, correspondendo ao build isolado dos commits SA
- Firestore Rules: intactas, não alteradas
- Questões `edicao == "2026_2"` antes da Q1: zero confirmado
- Conta oficial de geração: `drweynesouza@gmail.com`
- Primeira ID oficial esperada: `SA_2026_2_Q1`

**Status:** baseline de produção reprodutível a partir de um clone limpo do HEAD. Pronto para a primeira geração controlada, mediante autorização explícita do usuário.

---

## PRIMEIRA GERAÇÃO REAL EM PRODUÇÃO (revalidapro-f812e) — 2026-07-24

### R002 — Crise hipertensiva — urgência vs. emergência e conduta imediata

**Status:** `REVISÃO / FALHOU NA GERAÇÃO EM PRODUÇÃO`. **`SA_2026_2_Q1` NÃO foi consumido — nenhum documento foi salvo.**

- Tentativa 1 (Haiku): rejeitada — números 4, 180, 110 não suportados pelo grounding.
- Tentativa 2 (Haiku): rejeitada — números 3, 4 não suportados pelo grounding.
- Tentativa 3 (Opus, fallback): rejeitada — pista estrutural (alternativa correta mais longa e única com números/qualificadores, REGRA SA-1).
- Teto de 3 chamadas respeitado; cache funcionou; fallback Haiku→Opus funcionou; nenhuma questão inválida foi salva.

**Decisão:** não retentar R002 agora; não abrir hotfix; não alterar prompt/validador; não gerar manualmente. Falha tratada como **Caso C** (questão rejeitada por problema pontual de geração) da regra operacional oficial — segue para o próximo recorte, sem travar o lote.

**`SA_2026_2_Q1` continua livre** — a numeração é derivada do maior `numeroQuestao` existente em `questoes` com `edicao == "2026_2"` (ainda zero documentos), não reservada antecipadamente.

### Próximo recorte selecionado: R034 — Cirurgia — Hérnia da parede abdominal

Critério de escolha: LIBERADO, prioridade ALTO, não bloqueado, não revisão humana, sem dependência de precisão numérica (`Grounding: não` — evita exatamente o modo de falha de R002), já validado tecnicamente no DEV em 1 chamada Haiku sem retry (`SA_2026_2_Q24`, ver seção Lote 003).

**Status:** ✅ **PRODUÇÃO OFICIAL — APROVADA E2E — CONTA PARA AS 120.**

### Homologação E2E — `SA_2026_2_Q1` / R034 (2026-07-24)

Confirmação manual do usuário no RevalidaPRO real (`revalidapro-f812e`): questão presente normalmente, alternativas renderizadas, fluxo de resposta funcionando, feedback/explicações funcionando, cards pedagógicos funcionando, Estratégia da Aposta funcionando, botão "Ver Resumo do Tema" funcionando, Resumo do Tema abriu com conteúdo. **PASS E2E completo.**

**PIPELINE E2E DE PRODUÇÃO SUPER APOSTAS 2026.2 = HOMOLOGADO.**

**Decisões vigentes a partir de agora:**
- R002 permanece `REVISÃO` (falha pontual) — não retentar agora.
- R041 permanece `REVISÃO HUMANA` (grounding insuficiente) — não retentar agora.
- **Fase de engenharia/hotfix encerrada.** Não alterar prompt, validador, retry, `resumoEngine` ou `RoboGerador` por falhas pontuais de geração.
- Regra operacional daqui em diante: falha isolada de um recorte → registrar → pular → próximo. Só reabrir engenharia diante de evidência de bug **sistêmico/repetitivo** (afeta múltiplos recortes, não um caso isolado).

---

## BACKLOG DE PRODUTO — FUTURO (NÃO IMPLEMENTAR AGORA)

### "Conduta Prática / Na Prática, o Que Você Faria?"

**Objetivo:** quando houver grounding documental confiável para o tema, permitir que o conteúdo pedagógico apresente de forma curta e útil: medicamento de escolha, dose, via, intervalo, duração, monitorização, critérios de internação/encaminhamento quando pertinentes.

**Regra absoluta:** nenhuma dose, duração, intervalo, limiar ou precisão normativa poderá ser inventada. Só exibir precisão quando sustentada por diretriz controlada (`diretrizesControladas.js` ou equivalente). Sem grounding suficiente, manter conduta qualitativa (sem números).

**Status:** registrado para fase futura. Não implementar agora — não interrompe a produção das 120.

---

## PRÓXIMO RECORTE OFICIAL SELECIONADO: R021 — Reanimação neonatal

**Matéria:** Pediatria.

**Critério de escolha:** LIBERADO, prioridade ALTO, ainda `PENDENTE`, diferente de R002/R041, não duplica R034, `Grounding: não` (mesmo perfil de baixo risco numérico que funcionou em R034 — decisão puramente sequencial/procedural, sem limiar/dose a citar), diversifica matéria (R034 foi Cirurgia; R021 é Pediatria).

**Texto exato para colar no RoboGerador:**
```
Reanimação neonatal — sequência da sala de parto
```

**Decisão (Mapa Mestre):** Seguir a sequência (secar/aquecer → avaliar FC/respiração → VPP) antes de escalonar para massagem/adrenalina.

**Armadilha (Mapa Mestre):** Iniciar compressão torácica antes de otimizar a ventilação com pressão positiva.

**Grounding obrigatório:** NÃO. **Grounding disponível/auto-injetável:** NÃO (recorte não depende de diretriz controlada específica).

**Status:** ✅ **PRODUÇÃO OFICIAL — APROVADA — CONTA PARA AS 120** (resumo em revisão, ver abaixo).

### R021 — encerramento (2026-07-24)

**Questão:** `SA_2026_2_Q2` — **APROVADA E SALVA**.
- Modelos: Haiku → Haiku → Opus. Chamadas: 3. Retry: SIM.
- Tentativa 1 (Haiku): rejeitada — termo absoluto sem grounding + ano/fonte de diretriz inventados sem diretriz controlada.
- Tentativa 2 (Haiku): rejeitada — pista estrutural da alternativa correta (REGRA SA-1).
- Tentativa 3 (Opus, fallback): **APROVADA**.
- Confirmado visualmente: questão abre normalmente, alternativas/fluxo de resposta funcionam, cards pedagógicos funcionam.

**Resumo do Tema:** NÃO DISPONÍVEL. Modal confirma: *"Resumo ainda não disponível" / "O resumo de Reanimação ainda não foi gerado."* Fica **PENDENTE/REVISÃO**, para lote de revisão separado — não bloqueia a questão.

**Status para as 120:** `QUESTÃO APROVADA / RESUMO PENDENTE-REVISÃO` — **CONTA**. Não regenerado, resumo não gerado agora, nenhum hotfix aberto (falha pontual, mesma regra operacional de R034/R002).

---

## PRÓXIMO RECORTE OFICIAL SELECIONADO: R024 — Hemorragia pós-parto

**Matéria:** Ginecologia e Obstetrícia.

**Critério de escolha:** LIBERADO, prioridade ALTO, ainda `PENDENTE`, não duplica R034/R021, evita R002/R041, `Grounding: não` (mesmo perfil de baixo risco numérico de R034/R021 — decisão sequencial/escalonada por causa identificada, sem dose/limiar a citar), diversifica matéria (usadas até aqui: Cirurgia, Pediatria; R024 introduz Ginecologia e Obstetrícia).

**Texto exato para colar no RoboGerador:**
```
Hemorragia pós-parto — causas (4 Ts) e sequência de manejo escalonado
```

**Decisão (Mapa Mestre):** Seguir a sequência de manejo (massagem → uterotônicos → medidas cirúrgicas) conforme a causa identificada pelos 4 Ts.

**Armadilha (Mapa Mestre):** Pular direto para histerectomia sem esgotar medidas conservadoras em causa reversível (tono/tecido).

**Grounding obrigatório:** NÃO. **Grounding disponível/auto-injetável:** NÃO.

**Prioridade:** ALTO.

**Status:** `REVISÃO / FALHOU NA GERAÇÃO EM PRODUÇÃO`. **`SA_2026_2_Q3` NÃO foi consumido — nenhum documento foi salvo.**

### R024 — encerramento da tentativa (2026-07-24)

- Tentativa 1 (Haiku): rejeitada — pista estrutural + posologia numérica sem diretriz controlada + ano/fonte de diretriz inventados.
- Tentativa 2 (Haiku): rejeitada — pista estrutural da alternativa correta.
- Tentativa 3 (Opus, fallback): rejeitada — linguagem/afirmação absoluta sem grounding.
- Teto de 3 chamadas respeitado. Nenhuma questão inválida salva.

**Decisão:** não retentar R024 agora; não abrir hotfix; não alterar prompt/validador. Caso C (falha pontual) — segue para o próximo recorte.

**`SA_2026_2_Q3` continua livre.**

**Aprendizado operacional (só para seleção, não altera a engine):** `Grounding: não` no Mapa Mestre não significa ausência de risco de indução de precisão — recortes cuja natureza clínica envolve sequência terapêutica/posologia (uterotônicos, doses, protocolos) tendem a puxar a IA para citar números/fontes não sustentados, mesmo sem exigência formal de grounding. Critério refinado para as próximas escolhas: priorizar recortes qualitativos/conceituais com baixa indução de dose/protocolo, ou recortes onde a precisão normativa é central **e** o grounding controlado já cobre esse ponto.

---

## PRÓXIMO RECORTE OFICIAL SELECIONADO: R030 — Transtorno do Espectro Autista

**Matéria:** Pediatria.

**Tema:** Transtorno do Espectro Autista (TEA) — sinais de alerta precoces e conduta de encaminhamento.

**Texto exato para colar no RoboGerador:**
```
Transtorno do Espectro Autista — sinais de alerta precoces e conduta de encaminhamento
```

**Decisão (Mapa Mestre):** Encaminhar para avaliação especializada diante de sinais de alerta na puericultura, sem esperar "fechar" o diagnóstico na atenção primária.

**Armadilha (Mapa Mestre):** Adotar postura de "esperar para ver" diante de sinais de alerta claros de atraso de desenvolvimento social/comunicativo.

**Grounding obrigatório:** NÃO. **Grounding disponível/auto-injetável:** NÃO.

**Prioridade:** ALTO.

**Motivo da escolha:** aplicando o aprendizado de R024 — este é um recorte puramente comportamental/de reconhecimento de padrão (sinais de alerta do desenvolvimento), sem nenhuma dose, intervalo, protocolo terapêutico ou fonte normativa a citar — decisão é sobre *quando encaminhar*, não sobre *o que prescrever*. Avaliadas alternativas (R019 Epidemiologia — envolve raciocínio numérico/estatístico; R025 Gravidez ectópica — critérios de elegibilidade para MTX podem induzir dose/limiar; R029 TVP/Escore de Wells — sistema de pontuação numérico); R030 tem o menor risco de indução de precisão não sustentada entre os candidatos LIBERADO/ALTO/PENDENTE disponíveis. Diversifica matéria de volta para Pediatria (já usada em R021, mas ainda assim mais segura que reintroduzir Clínica Médica logo após a falha de R002/R024-adjacente).

**Status:** ✅ **PRODUÇÃO OFICIAL — APROVADA — CONTA PARA AS 120.**

### R030 — encerramento (2026-07-24)

**Questão:** `SA_2026_2_Q3` — **APROVADA E SALVA**.
- Modelos: Haiku → Haiku → Opus. Chamadas: 3. Retry: SIM.
- Tentativa 1 (Haiku): rejeitada — pista estrutural + ano/fonte de diretriz inventados sem grounding.
- Tentativa 2 (Haiku): rejeitada — `gabarito` undefined + `dicaMestre` ausente (falha de completude de schema, não de conteúdo).
- Tentativa 3 (Opus, fallback): **APROVADA**.

**Resumo do Tema:** `Transtorno do espectro autista--pediátrico` — **REAPROVEITADO** do Firestore (já existia, não precisou gerar novo).

**Status para as 120:** `QUESTÃO APROVADA / RESUMO REAPROVEITADO` — **CONTA**. Verificação visual de PASS E2E (Q3 e resumo abrindo normalmente) pendente de confirmação do usuário — marcar quando confirmado.

Não retentado, nenhum código alterado, nenhum deploy.

---

## PRÓXIMO RECORTE OFICIAL SELECIONADO: R019 — Epidemiologia

**Matéria:** Preventiva.

**Tema:** Epidemiologia — cálculo e interpretação de sensibilidade, especificidade e valor preditivo.

**Texto exato para colar no RoboGerador:**
```
Epidemiologia — cálculo e interpretação de sensibilidade, especificidade e valor preditivo
```

**Decisão (Mapa Mestre):** Interpretar VPP/VPN considerando a prevalência da doença na população testada, não só a acurácia do teste.

**Armadilha (Mapa Mestre):** Aplicar VPP calculado em uma prevalência diferente da população do enunciado.

**Grounding obrigatório:** NÃO. **Grounding disponível/auto-injetável:** NÃO.

**Prioridade:** ALTO.

**Motivo da escolha:** aplicando o aprendizado de R024 — os números deste recorte são **dados do próprio caso clínico** (sensibilidade/especificidade/prevalência fornecidos no enunciado para o raciocínio bayesiano), não citações de protocolo/posologia externa — perfil de "números reutilizados do caso", já validado como seguro pela engine, diferente do padrão que derrubou R002/R024 (números de fonte normativa não injetada). Descartados: R003 e R015 (grounding disponível mas ainda centrados em dose/esquema terapêutico — risco residual); R025 (critérios de elegibilidade para MTX podem induzir limiar não sustentado); R029 (Escore de Wells — pontuação numérica explícita); R038 (índices hematimétricos — valores de referência numéricos); R010 (qualitativo e sem risco numérico, mas o texto exato do recorte no Mapa Mestre — `recortes_100_condensado.json`/`auditoria_100_final.json` — não está disponível neste repositório para reprodução fiel; não inventar decisão/armadilha). Diversifica matéria para Preventiva, ainda não tentada nesta rodada oficial (R041 foi excluído previamente por outro motivo, não é uma tentativa formal de produção).

**Status:** `REVISÃO / FALHOU NA GERAÇÃO EM PRODUÇÃO`. **`SA_2026_2_Q4` NÃO foi consumido — nenhum documento foi salvo.**

### R019 — encerramento da tentativa (2026-07-24)

- Tentativa 1 (Haiku): rejeitada — termo absoluto/percentual específico sem diretriz controlada.
- Tentativa 2 (Haiku): rejeitada — mesma classe de rejeição.
- Tentativa 3 (Opus, fallback): rejeitada — **erro técnico de JSON** (`Expected ',' or '}' after property value...`), não uma rejeição de conteúdo.
- Teto de 3 chamadas respeitado. Nenhuma questão inválida salva.

**Decisão:** não retentar R019 agora; não abrir hotfix; não alterar prompt/validador. Caso C (falha pontual) — segue para o próximo recorte.

**`SA_2026_2_Q4` continua livre.**

**Nota:** confirma o aprendizado de R024 de forma mais ampla — mesmo um recorte com "números do próprio caso" (R019, epidemiologia) pode ser classificado como percentual/termo absoluto pela regra de grounding, indicando que o risco não está restrito a posologia/protocolo clínico, mas a qualquer afirmação quantitativa específica sem fonte controlada. Critério reforçado para a próxima escolha: preferir decisão **categórica/classificatória** (escolher entre opções qualitativamente distintas) a decisão que exige citar **qualquer valor numérico específico** — mesmo que "do próprio caso".

---

## PRÓXIMO RECORTE OFICIAL SELECIONADO: R003 — Diabetes mellitus tipo 2

**Matéria:** Clínica Médica.

**Tema:** DM tipo 2 — metas glicêmicas e escolha de 2ª droga além da metformina por perfil cardiorrenal.

**Texto exato para colar no RoboGerador:**
```
Diabetes mellitus tipo 2 — metas glicêmicas e escolha de 2ª droga além da metformina por perfil cardiorrenal
```

**Decisão (Mapa Mestre):** Priorizar iSGLT2/GLP-1 quando há doença cardiovascular ou renal estabelecida, não apenas controle glicêmico.

**Armadilha (Mapa Mestre):** Escalonar para sulfonilureia/insulina por hábito, ignorando benefício cardiorrenal de outras classes.

**Grounding obrigatório:** SIM (diretriz `dm`, já carregada em `diretrizesControladas.js`). **Grounding disponível/auto-injetável:** SIM.

**Prioridade:** ALTO.

**Motivo da escolha:** a decisão central é **categórica** (qual classe de fármaco priorizar — iSGLT2/GLP-1 vs. sulfonilureia/insulina — por perfil cardiorrenal), não uma dose/intervalo/limiar numérico específico, e há grounding controlado disponível para sustentar qualquer afirmação sobre a diretriz `dm`, reduzindo o risco de invenção de fonte. Descartados: R015 (esquema de penicilina por fase — inerentemente dose/duração-dependente, mesmo com grounding); R025 (critérios de elegibilidade para MTX sem grounding formal); R029 (Escore de Wells — pontuação numérica explícita); R038 (índices hematimétricos — valores de referência numéricos). Diversifica para Clínica Médica, matéria ainda sem sucesso nesta rodada (R002 falhou).

**Status:** `REVISÃO / FALHOU NA GERAÇÃO EM PRODUÇÃO`. **`SA_2026_2_Q4` NÃO foi consumido — nenhum documento foi salvo.**

### R003 — encerramento da tentativa (2026-07-24)

- Tentativa 1 (Haiku): rejeitada — números 8, 12, 6 não suportados pelo grounding.
- Tentativa 2 (Haiku): rejeitada — números 8, 12 não suportados pelo grounding.
- Tentativa 3 (Opus, fallback): rejeitada — pista estrutural (alternativa correta mais longa e única com números/qualificadores, REGRA SA-1).
- Teto de 3 chamadas respeitado. Nenhuma questão inválida salva.

**Decisão:** não retentar R003 agora; não abrir hotfix; não alterar prompt/validador. Caso C (falha pontual) — segue para o próximo recorte.

**`SA_2026_2_Q4` continua livre.**

**Nota:** confirma que `Grounding: sim` **não é suficiente por si só** — mesmo com a diretriz `dm` carregada, o tema (metas glicêmicas, perfil cardiorrenal) convida a IA a citar valores (metas de HbA1c, TFG, faixas de risco) mais granulares do que os `pontosCriticos` atualmente injetados cobrem. **4 falhas consecutivas em produção (R002, R024, R019, R003)** compartilham o mesmo padrão raiz: qualquer conteúdo clínico que admita precisão quantitativa — mesmo categórico na intenção, mesmo com grounding disponível — arrisca introduzir um número não coberto. Critério reforçado: a partir de agora, priorizar recortes **comportamentais/comunicacionais/éticos**, sem nenhum parâmetro clínico quantificável (nem "dado do caso", nem "coberto por diretriz"), sobre qualquer recorte com conteúdo clínico numérico, mesmo grounded.

---

## PRÓXIMO RECORTE OFICIAL SELECIONADO: R010 — Comunicação de más notícias / conduta diante de erro médico

**Matéria:** Medicina Legal e Ética Médica.

**Tema:** Comunicação de más notícias e conduta diante de erro médico.

**Texto exato para colar no RoboGerador:**
```
Comunicação de más notícias e conduta diante de erro médico
```

**Decisão / Armadilha (Mapa Mestre):** **não disponível para reprodução fiel neste registro.** Diferente dos 12 recortes do Lote 003 (R041/R034/R002/R003/R015/R019/R021/R024/R025/R029/R030/R038), cujo `recorte`/`decisão`/`armadilha` foram reproduzidos na íntegra de `recortes_100_condensado.json`/`auditoria_100_final.json` nesta mesma sessão de trabalho, R010 só está presente na tabela-resumo (seção 4) deste documento, com apenas a coluna Tema/Recorte preenchida — sem `decisão`/`armadilha` extraídas do Mapa Mestre original, que não está disponível neste repositório. Não fabricado. Se o usuário tiver acesso a `recortes_100_condensado.json`, recomenda-se colar aqui a decisão/armadilha oficial antes ou depois da geração, só para registro — **não é necessário para a geração em si**, já que o RoboGerador recebe apenas o texto do tema, não os campos decisão/armadilha (usados só para curadoria/documentação humana).

**Grounding obrigatório:** NÃO. **Grounding disponível/auto-injetável:** NÃO.

**Prioridade:** ALTO.

**Motivo da escolha:** após 4 falhas consecutivas por conteúdo numérico (mesmo em recortes categóricos e/ou grounded), este é o primeiro recorte ALTO/LIBERADO/PENDENTE **inteiramente comunicacional/ético**, sem nenhum parâmetro clínico quantificável em jogo (não há dose, escore, corte, meta glicêmica, intervalo de seguimento ou índice laboratorial envolvido) — o conteúdo é sobre *como/quando comunicar*, não *o que prescrever/calcular*. Diversifica para Medicina Legal e Ética Médica, matéria ainda não tentada nesta rodada. Ressalva: já havia sido tentado uma vez em sessão anterior a esta rodada oficial e bloqueado por "afirmação absoluta" — mas esse é exatamente o modo de falha que o fallback Haiku→Haiku→Opus com REGRA SA-4 já demonstrou saber contornar (ex.: R021/`SA_2026_2_Q2`, aprovada no Opus após 2 rejeições por termo absoluto).

**Status:** ✅ **PRODUÇÃO OFICIAL — APROVADA E2E — CONTA PARA AS 120.**

### R010 — encerramento (2026-07-24)

**Área operacional usada no RoboGerador:** PREVENTIVA (matéria original do Mapa Mestre — Medicina Legal e Ética Médica — mapeada para uma das 5 grandes áreas; ver regra abaixo).

**Questão:** `SA_2026_2_Q4` — **APROVADA E SALVA**.
- Modelos: Haiku → Haiku → Opus. Chamadas: 3. Retry: SIM.
- Tentativa 1 (Haiku): rejeitada — alternativa correta destacada em comprimento + única composta/múltiplas cláusulas (REGRA SA-1) + ano/fonte de diretriz preenchidos sem grounding controlado.
- Tentativa 2 (Haiku): rejeitada — mesma pista estrutural (REGRA SA-1).
- Tentativa 3 (Opus, fallback): **APROVADA**.

**Resumo do Tema** (`Comunicação de más notícias e conduta diante de erro médico--pós-operatório`): tentativa 1 rejeitada → retry corretivo 1/1 → tentativa 2 **APROVADA E SALVA** (7 blocos).

**Verificação visual manual:** **PASS.** Questão, feedback, cards pedagógicos, Estratégia da Aposta e Resumo do Tema abriram normalmente, conteúdo coerente.

**Status para as 120:** `PASS E2E COMPLETO EM PRODUÇÃO` — **CONTA.**

---

## REGRA OPERACIONAL OBRIGATÓRIA — 5 GRANDES ÁREAS (vigente a partir de 2026-07-24)

A plataforma trabalha operacionalmente **apenas** com estas 5 grandes áreas no campo "Área" do RoboGerador:

1. Clínica Médica
2. Pediatria
3. Ginecologia e Obstetrícia
4. Cirurgia
5. Preventiva

Todo recorte Rxxx selecionado deve ser mapeado para uma dessas 5 antes de ser entregue para geração. Matérias secundárias do Mapa Mestre (Medicina Legal e Ética Médica, Epidemiologia, Infectologia, Cardiologia, Neonatologia, Ortopedia etc.) continuam existindo como matéria/tema/subtema pedagógico, mas nunca são a "Área" operacional — apenas uma das 5 acima. Exemplo confirmado: Medicina Legal e Ética Médica → PREVENTIVA (R010).

## CONTAGEM ATUAL — QUESTÕES OFICIAIS VÁLIDAS PARA AS 120

| # | ID | Recorte | Status |
|---|---|---|---|
| 1 | `SA_2026_2_Q1` | R034 | CONTA — PASS E2E |
| 2 | `SA_2026_2_Q2` | R021 | CONTA (resumo pendente/revisão) |
| 3 | `SA_2026_2_Q3` | R030 | CONTA (resumo reaproveitado) |
| 4 | `SA_2026_2_Q4` | R010 | CONTA — PASS E2E completo |

**Total confirmado: 4 de 120.** Não contam (falha pontual, não retentados): R002, R024, R019, R003. Excluído (revisão humana): R041.

---

## PRÓXIMO RECORTE OFICIAL SELECIONADO: R015 — Sífilis (estadiamento e esquema de penicilina benzatina)

**Matéria original do Mapa Mestre:** Ginecologia e Obstetrícia.

**Área operacional:** GINECOLOGIA E OBSTETRÍCIA (já é uma das 5 grandes áreas — sem necessidade de mapeamento).

**Tema:** Sífilis — estadiamento clínico e escolha do esquema de penicilina benzatina por fase.

**Texto exato para colar no RoboGerador:**
```
Sífilis — estadiamento clínico e escolha do esquema de penicilina benzatina por fase
```

**Decisão (Mapa Mestre):** Escolher dose/duração da penicilina conforme o estágio (primária/secundária/latente/terciária).

**Armadilha (Mapa Mestre):** Usar esquema de dose única em sífilis latente tardia ou terciária.

**Grounding obrigatório:** SIM (diretriz `sifilis`, já carregada em `diretrizesControladas.js`). **Grounding disponível/auto-injetável:** SIM.

**Prioridade:** ALTO.

**Motivo da escolha:** GO ainda não teve sucesso nesta rodada (R024 falhou) — diversidade pendente. É um recorte inerentemente dose/estágio-dependente, mas diferente de R003 (metas glicêmicas/cardiorrenais, terreno amplo e pouco delimitado), o esquema de penicilina benzatina por estágio de sífilis é o conteúdo **nuclear e mais básico** de qualquer diretriz de sífilis — maior probabilidade de estar bem coberto em `pontosCriticos` do que parâmetros mais periféricos (ex.: R016, sífilis congênita/seguimento sorológico, que falhou por grounding numérico insuficiente em tema mais periférico). Risco residual reconhecido e não eliminado — não há recorte ALTO/LIBERADO/PENDENTE totalmente livre de conteúdo numérico nas 5 áreas restantes com fonte disponível nesta sessão (R025/R029/R038 têm risco numérico igual ou maior, sem grounding).

**Status:** ✅ **PRODUÇÃO OFICIAL — APROVADA E2E — CONTA PARA AS 120.**

### R015 — encerramento (2026-07-24)

**Questão:** `SA_2026_2_Q5` — **APROVADA E SALVA**.
- Tentativa 1 (Haiku): rejeitada — erro técnico de JSON.
- Tentativa 2 (Haiku): rejeitada — pista estrutural da alternativa correta.
- Tentativa 3 (Opus, fallback): **APROVADA**.
- Teto de 3 chamadas respeitado.

**Resumo do Tema** (`Sífilis--gestante`): **APROVADO E SALVO** (7 blocos).

**Verificação visual manual:** **PASS E2E COMPLETO.** Usuário confirmou "tudo certinho" na plataforma real.

**Status para as 120:** **CONTA.**

## CONTAGEM ATUAL — QUESTÕES OFICIAIS VÁLIDAS PARA AS 120 (atualizada)

| # | ID | Recorte | Área operacional | Status |
|---|---|---|---|---|
| 1 | `SA_2026_2_Q1` | R034 | Cirurgia | CONTA — PASS E2E |
| 2 | `SA_2026_2_Q2` | R021 | Pediatria | CONTA (resumo pendente/revisão) |
| 3 | `SA_2026_2_Q3` | R030 | Pediatria | CONTA (resumo reaproveitado) |
| 4 | `SA_2026_2_Q4` | R010 | Preventiva | CONTA — PASS E2E |
| 5 | `SA_2026_2_Q5` | R015 | Ginecologia e Obstetrícia | CONTA — PASS E2E |

**Total confirmado: 5 de 120.** Não contam (falha pontual, IDs não consumidos): R002, R024, R019, R003. Excluído (revisão humana): R041.

**Balanço por área até aqui:** Cirurgia 1 · Pediatria 2 · Preventiva 1 · Ginecologia e Obstetrícia 1 · **Clínica Médica 0** (2 tentativas, 2 falhas — R002, R003).

---

## PRÓXIMO RECORTE OFICIAL SELECIONADO: R029 — Trombose venosa profunda

**Matéria original do Mapa Mestre:** Clínica Médica.

**Área operacional:** CLÍNICA MÉDICA (já é uma das 5 grandes áreas — sem necessidade de mapeamento).

**Tema:** Trombose venosa profunda — Escore de Wells e conduta anticoagulante inicial.

**Texto exato para colar no RoboGerador:**
```
Trombose venosa profunda — Escore de Wells e conduta anticoagulante inicial
```

**Decisão (Mapa Mestre):** Usar o escore de Wells para definir probabilidade pré-teste antes de indicar D-dímero ou imagem direta.

**Armadilha (Mapa Mestre):** Solicitar D-dímero em paciente de alta probabilidade pré-teste, atrasando o exame de imagem definitivo.

**Grounding obrigatório:** NÃO (conforme Mapa Mestre). **Grounding disponível/auto-injetável:** NÃO.

**Prioridade:** ALTO.

**Motivo da escolha:** Clínica Médica é a única das 5 grandes áreas ainda sem nenhum sucesso (0/2 tentativas) — prioridade de equilíbrio. Reexaminando o recorte: a decisão central não exige citar os pontos exatos do Escore de Wells, e sim a **lógica de sequência diagnóstica** (usar probabilidade pré-teste antes de escolher entre D-dímero e imagem) — estrutura de decisão sequencial/categórica, mais próxima do perfil que já funcionou em R034/R021/R024(tentativa)/R030, e não uma exigência de posologia/protocolo terapêutico como em R002/R003. `Grounding: não` é consistente com essa leitura (não há necessidade de citar valor normativo externo). Risco residual reconhecido: se a IA optar por enumerar pontuações específicas do escore, ainda há risco de rejeição por número sem grounding — decisão tomada por representatividade clínica (TVP é tema de alta relevância INEP) e equilíbrio de área, não por busca de "tema fácil".

**Status:** ✅ **PRODUÇÃO OFICIAL — APROVADA — CONTA PARA AS 120** (resumo em revisão, ver abaixo).

### R029 — encerramento (2026-07-24)

**Questão:** `SA_2026_2_Q6` — **APROVADA E SALVA**.
- Modelos: Haiku → Haiku (**sem escalonar para Opus** — primeiro recorte desta rodada resolvido só com Haiku). Chamadas: 2. Retry: SIM.
- Tentativa 1 (Haiku): rejeitada — campo `tto` com posologia numérica sem diretriz controlada (REGRA SA-3) + termo absoluto/percentual/"desde AAAA" sem diretriz controlada (REGRA SA-4).
- Tentativa 2 (Haiku): **APROVADA**. Modo validação (teto 3, parou em 2 por já ter aprovado).

**Resumo do Tema** (`Trombose venosa profunda--adulto`): tentativa 1 rejeitada → retry corretivo 1/1 → tentativa 2 **também rejeitada** — **REVISÃO** (número clínico "6" sem diretriz controlada injetada; regra numérica vale para qualquer corte/limiar/contagem, não só posologia). Resumo não salvo.

**Verificação visual manual:** não fornecida nesta rodada (registro só por log do RoboGerador, conforme regra "confirmação final = log + Firestore + painel" — pendente de conferência visual quando conveniente, não bloqueia a contagem).

**Status para as 120:** `QUESTÃO APROVADA / RESUMO REJEITADO-REVISÃO` — **CONTA** (Caso B da regra operacional).

## CONTAGEM ATUAL — QUESTÕES OFICIAIS VÁLIDAS PARA AS 120 (atualizada)

| # | ID | Recorte | Área operacional | Status |
|---|---|---|---|---|
| 1 | `SA_2026_2_Q1` | R034 | Cirurgia | CONTA — PASS E2E |
| 2 | `SA_2026_2_Q2` | R021 | Pediatria | CONTA (resumo pendente/revisão) |
| 3 | `SA_2026_2_Q3` | R030 | Pediatria | CONTA (resumo reaproveitado) |
| 4 | `SA_2026_2_Q4` | R010 | Preventiva | CONTA — PASS E2E |
| 5 | `SA_2026_2_Q5` | R015 | Ginecologia e Obstetrícia | CONTA — PASS E2E |
| 6 | `SA_2026_2_Q6` | R029 | Clínica Médica | CONTA (resumo em revisão) |

**Total confirmado: 6 de 120.** Não contam (falha pontual, IDs não consumidos): R002, R024, R019, R003. Excluído (revisão humana): R041.

**Balanço por área até aqui:** Cirurgia 1 · Pediatria 2 · Preventiva 1 · Ginecologia e Obstetrícia 1 · Clínica Médica 1 — **todas as 5 áreas já têm ao menos 1 sucesso.**

---

## PRÓXIMO RECORTE OFICIAL SELECIONADO: R025 — Gravidez ectópica

**Matéria original do Mapa Mestre:** Ginecologia e Obstetrícia.

**Área operacional:** GINECOLOGIA E OBSTETRÍCIA (já é uma das 5 grandes áreas — sem necessidade de mapeamento).

**Tema:** Gravidez ectópica — diagnóstico precoce e decisão cirúrgica vs. expectante/medicamentosa.

**Texto exato para colar no RoboGerador:**
```
Gravidez ectópica — diagnóstico precoce e decisão cirúrgica vs. expectante/medicamentosa
```

**Decisão (Mapa Mestre):** Escolher conduta (metotrexato, laparoscopia, expectante) pela estabilidade hemodinâmica e critérios de elegibilidade, não automaticamente cirurgia.

**Armadilha (Mapa Mestre):** Indicar laparotomia de urgência em paciente estável com critérios para conduta medicamentosa.

**Grounding obrigatório:** NÃO. **Grounding disponível/auto-injetável:** NÃO.

**Prioridade:** ALTO.

**Motivo da escolha:** todas as 5 áreas já têm 1+ sucesso; entre as opções com fonte sourced disponível nesta sessão, restam apenas R025 (GO, 1 sucesso) e R038 (Pediatria, 2 sucessos) — R025 favorece melhor o equilíbrio progressivo (evita concentrar ainda mais em Pediatria). Estrutura de decisão é sequencial/categórica (avaliar estabilidade → escolher conduta), no mesmo perfil que acabou de funcionar em R029 apesar da tentação de citar critérios numéricos (beta-hCG, tamanho do saco gestacional) — risco residual reconhecido e não eliminado.

**Status:** ✅ **PRODUÇÃO OFICIAL — APROVADA — CONTA PARA AS 120** (resumo em revisão, ver abaixo).

### R025 — encerramento (2026-07-24)

**Questão:** `SA_2026_2_Q7` — **APROVADA E SALVA**.
- Tentativa 1 (Haiku): rejeitada — distrator curto + número 48 não suportado.
- Tentativa 2 (Haiku): rejeitada — números 48, 72 e 5.000 não suportados.
- Tentativa 3 (Opus, fallback): **APROVADA**.

**Resumo do Tema** (`Gravidez ectópica--gestante`): **REJEITADO** — números 48, 50, 5000, 1000, 1500, 3.5 e 5 não sustentados pelo grounding injetado. Não salvo — **REVISÃO**. Não invalida a questão.

**Status para as 120:** `QUESTÃO APROVADA / RESUMO REJEITADO-REVISÃO` — **CONTA** (Caso B). Não retentado, nenhum hotfix, nenhum validador alterado.

## CONTAGEM ATUAL — QUESTÕES OFICIAIS VÁLIDAS PARA AS 120 (atualizada)

| # | ID | Recorte | Área operacional | Status |
|---|---|---|---|---|
| 1 | `SA_2026_2_Q1` | R034 | Cirurgia | CONTA — PASS E2E |
| 2 | `SA_2026_2_Q2` | R021 | Pediatria | CONTA (resumo pendente/revisão) |
| 3 | `SA_2026_2_Q3` | R030 | Pediatria | CONTA (resumo reaproveitado) |
| 4 | `SA_2026_2_Q4` | R010 | Preventiva | CONTA — PASS E2E |
| 5 | `SA_2026_2_Q5` | R015 | Ginecologia e Obstetrícia | CONTA — PASS E2E |
| 6 | `SA_2026_2_Q6` | R029 | Clínica Médica | CONTA (resumo em revisão) |
| 7 | `SA_2026_2_Q7` | R025 | Ginecologia e Obstetrícia | CONTA (resumo em revisão) |

**Total confirmado: 7 de 120.** Não contam (falha pontual, IDs não consumidos): R002, R024, R019, R003. Excluído (revisão humana): R041.

**Balanço por área até aqui:** Cirurgia 1 · Pediatria 2 · Preventiva 1 · Ginecologia e Obstetrícia 2 · Clínica Médica 1.

---

## REGRA OPERACIONAL — LOTES DE 3 POR ÁREA (vigente a partir de 2026-07-24)

**Auditoria de código confirmou:** a "Área" do RoboGerador é um único `<select>` capturado uma vez por execução (`areaAtual`, [RoboGerador.jsx:665](src/components/RoboGerador.jsx#L665)) e aplicada sem alteração a **todas** as linhas da textarea, tanto no prompt quanto no campo `materia` gravado no Firestore ([linha 405](src/components/RoboGerador.jsx#L405)). Não há inferência por IA nem por linha. **Logo: uma execução só pode conter recortes da MESMA área operacional.**

Fluxo adotado a partir de agora: **3 recortes distintos da mesma grande área, 1 questão por recorte, Modo Validação LIGADO** (não usar "3 questões/tema"). Alternar progressivamente entre as 5 áreas para preservar equilíbrio: Lote Clínica → Lote Pediatria → Lote GO → Lote Cirurgia → Lote Preventiva etc.

## LOTE 1 — CLÍNICA MÉDICA (Q8–Q10) — 2026-07-24

| Recorte | ID | Tentativas | Resultado | Resumo |
|---|---|---|---|---|
| R035 — Hipercalemia grave | `SA_2026_2_Q8` | Haiku (linguagem absoluta) → Haiku **APROVADA** | 2 chamadas | `Hipercalemia--idoso` salvo, 7 blocos |
| R039 — DRGE, critérios de alarme | `SA_2026_2_Q9` | Haiku (erro JSON) → Haiku (pista estrutural + absoluta + fonte inventada) → Opus **APROVADA** | 3 chamadas | retry 1/1 → `Doença do refluxo gastroesofágico--adulto` salvo, 7 blocos |
| R031 — DII Crohn vs. RCU | `SA_2026_2_Q10` | Haiku (pista estrutural + absoluta) → Haiku (absoluta) → Opus **APROVADA** | 3 chamadas | retry 1/1 → `Doença inflamatória intestinal--emergência` salvo, 7 blocos |

**3/3 questões aprovadas e salvas.** Todas com resumo salvo (nenhuma em revisão neste lote). Nenhum retentado, nenhum hotfix, nenhum validador alterado.

## CONTAGEM ATUAL — QUESTÕES OFICIAIS VÁLIDAS PARA AS 120 (atualizada)

| # | ID | Recorte | Área operacional | Status |
|---|---|---|---|---|
| 1 | `SA_2026_2_Q1` | R034 | Cirurgia | CONTA — PASS E2E |
| 2 | `SA_2026_2_Q2` | R021 | Pediatria | CONTA (resumo pendente/revisão) |
| 3 | `SA_2026_2_Q3` | R030 | Pediatria | CONTA (resumo reaproveitado) |
| 4 | `SA_2026_2_Q4` | R010 | Preventiva | CONTA — PASS E2E |
| 5 | `SA_2026_2_Q5` | R015 | Ginecologia e Obstetrícia | CONTA — PASS E2E |
| 6 | `SA_2026_2_Q6` | R029 | Clínica Médica | CONTA (resumo em revisão) |
| 7 | `SA_2026_2_Q7` | R025 | Ginecologia e Obstetrícia | CONTA (resumo em revisão) |
| 8 | `SA_2026_2_Q8` | R035 | Clínica Médica | CONTA — resumo salvo |
| 9 | `SA_2026_2_Q9` | R039 | Clínica Médica | CONTA — resumo salvo |
| 10 | `SA_2026_2_Q10` | R031 | Clínica Médica | CONTA — resumo salvo |
| 11 | `SA_2026_2_Q11` | R084 | Preventiva | CONTA — APROVADO |
| 12 | `SA_2026_2_Q12` | R100 | Preventiva | CONTA — REVISÃO DE RESUMO |

**Total confirmado: 12 de 120.** Não contam (falha pontual, IDs não consumidos): R002, R024, R019, R003. **Em recuperação (não conta, não descartado): R096.** Excluído (revisão humana): R041.

**Balanço por área até aqui:** Cirurgia 1 · Pediatria 2 · **Preventiva 3** · Ginecologia e Obstetrícia 2 · Clínica Médica 4.

---

## PRÓXIMO LOTE SELECIONADO — LOTE 2: PREVENTIVA

**Fonte:** `recortes_100_condensado.json` / `auditoria_100_final.json` / `r101_r120.json`, recuperados em pasta de scratchpad de sessão anterior (`.../77957be3-2e01-4916-8b4a-d505cf5cc4fd/scratchpad/`), não movidos/alterados.

**Área operacional:** PREVENTIVA (menos representada, empatada com Cirurgia em 1; pool de candidatos limpos mais seguro que o de Cirurgia — ver detalhe abaixo).

| Recorte | Matéria original | Tema | Decisão | Armadilha | Grounding obrig. | Grounding disp. | Prioridade |
|---|---|---|---|---|---|---|---|
| R084 | Medicina Legal e Ética Médica → Preventiva | Atestado médico e sigilo no ambiente de trabalho — limites éticos | Informar no atestado apenas o necessário (afastamento e período), sem detalhar diagnóstico ao empregador | Detalhar diagnóstico clínico no atestado entregue ao empregador, violando o sigilo | NÃO | NÃO | MÉDIO (fonte real — não inflado) |
| R096 | Medicina Legal e Ética Médica → Preventiva | Violência doméstica — sinais de alerta e fluxo de notificação compulsória | Notificar compulsoriamente diante de sinais de violência, independente da vontade da vítima em não prosseguir com queixa formal | Deixar de notificar por respeito à vontade da vítima — a notificação compulsória independe disso | NÃO | NÃO | BAIXO (fonte real — não inflado) |
| R100 | Medicina Legal e Ética Médica → Preventiva | Cuidados paliativos — critérios de elegibilidade e comunicação de prognóstico | Indicar cuidados paliativos pela doença que ameaça a vida (não só terminalidade iminente) e comunicar prognóstico com honestidade e acolhimento | Reservar cuidados paliativos apenas para os últimos dias de vida, adiando indicação pertinente | NÃO | NÃO | MÉDIO (fonte real — não inflado) |

**Bloco exato — colar com Área = Preventiva, Modo Validação LIGADO:**
```
Atestado médico e sigilo no ambiente de trabalho — limites éticos
Violência doméstica — sinais de alerta e fluxo de notificação compulsória
Cuidados paliativos — critérios de elegibilidade e comunicação de prognóstico
```

**Motivo:** R008/R009 (Ética Médica, ALTO) já têm IDs de DEV anterior (`SA_2026_2_Q16`/`Q20`) — não são pendentes reais, descartados. R019/R033/R041 já usados/excluídos. Entre Cirurgia (pool residual: R069/R072 MEDIO + R110 sem prioridade classificada, sendo R072 com risco numérico explícito via "ângulo de Cobb") e Preventiva (pool residual: R084/R096/R100, MEDIO/BAIXO mas estruturalmente qualitativos/categóricos, mesmo perfil que já funcionou em R010), Preventiva ofereceu 3 recortes limpos e mais seguros — sem inventar prioridade ALTO onde a fonte real diz MEDIO/BAIXO. Cirurgia fica reservada para o lote seguinte.

**Status:** ✅ **LOTE ENCERRADO — 2/3 aprovadas, 1 em recuperação** (ver encerramento e taxonomia abaixo).

## TAXONOMIA OFICIAL DE STATUS (vigente a partir de 2026-07-24)

Um recorte selecionado por prevalência/aposta nunca desaparece silenciosamente por falha técnica ou reprovação do validador. Falha ≠ descarte editorial. Quatro status possíveis:

1. **APROVADO** — questão válida e salva. Conta nas 120.
2. **PENDENTE — RECUPERAÇÃO** — todas as tentativas da rodada falharam, mas o recorte continua obrigatório e deve retornar em lote futuro de recuperação. Não conta nas 120, não é descartado, não é tratado como concluído.
3. **REVISÃO DE RESUMO** — questão aprovada e salva; só o resumo precisa de revisão. Conta normalmente nas 120.
4. **SUBSTITUÍDO FORMALMENTE** — só com justificativa editorial explícita e recorte equivalente da mesma aposta. Nunca silencioso.

### R084 — encerramento (2026-07-24)

**Questão:** `SA_2026_2_Q11` — **APROVADA E SALVA**. Status: **APROVADO — CONTA PARA AS 120.**

### R096 — encerramento (2026-07-24)

**Status: `PENDENTE — RECUPERAÇÃO`.** Todas as 3 tentativas falharam — **nenhuma questão salva, nenhum ID consumido**. Motivos consolidados: pistas estruturais na alternativa correta (REGRA SA-1); linguagem absoluta sem grounding controlado (REGRA SA-4); tentativa de preencher fonte/ano sem diretriz injetada (REGRA SA-4). **Não conta nas 120. Não foi descartado. Não deve ser tratado como concluído.** Volta obrigatoriamente em lote futuro de recuperação da área Preventiva — ver Fila de Recuperação e recomendação técnica abaixo. Não retentado agora.

### R100 — encerramento (2026-07-24)

**Questão:** `SA_2026_2_Q12` — **APROVADA E SALVA**. Resumo `Cuidados paliativos--idoso`: em revisão. **Status: `REVISÃO DE RESUMO` — CONTA normalmente nas 120.**

## FILA DE RECUPERAÇÃO

| Rxxx | Área | Tema | Tentativas | Motivo consolidado | Grounding necessário | Status | Próxima tentativa |
|---|---|---|---|---|---|---|---|
| R096 | Preventiva | Violência doméstica — sinais de alerta e fluxo de notificação compulsória | 3 (todas Haiku/Opus, esgotadas) | Pista estrutural (SA-1) + linguagem absoluta sem grounding (SA-4) + fonte/ano inventados sem diretriz injetada (SA-4) | **AUDITAR** — recorte não tem `exige_grounding` na fonte (marcado NÃO), mas repetidamente induz citação de norma/prazo legal (Lei Maria da Penha, ECA, prazo de notificação) sem fonte controlada disponível — ver recomendação técnica abaixo | `PENDENTE — RECUPERAÇÃO` | a definir (após lote de recuperação nº1 da área Preventiva, conforme cadência da seção seguinte) |

## RECOMENDAÇÃO TÉCNICA — RECUPERAÇÃO DE R096

Auditoria de código confirma: `diretrizesControladas.js` **não tem nenhuma entrada** para violência doméstica/notificação compulsória (`grep` por "violencia"/"maria da penha"/"notificacao_compulsoria" = zero ocorrências). Isso explica o padrão de falha: o recorte, mesmo marcado `exige_grounding: false` na fonte, tematicamente convida a IA a citar base legal (Lei 11.340/2006, ECA, prazo de notificação em fluxograma do SUS) para dar realismo à questão — e qualquer citação desse tipo, sem diretriz injetada, é barrada pela REGRA SA-4 (mesmo padrão-raiz de R002/R024/R019/R003/R025, mas na área jurídica/ética em vez de clínica).

**Das 4 estratégias avaliadas:**
1. **Grounding normativo controlado** — adicionar uma entrada mínima em `diretrizesControladas.js` (ex.: `id: "violencia_domestica"`) com `pontosCriticos` cobrindo só o essencial: notificação compulsória é obrigatória independente da vontade da vítima; notificação ≠ denúncia policial (não exige registro de ocorrência); fluxo é sanitário (ficha de notificação), não judicial. **Precedente direto:** a diretriz `dengue` foi adicionada exatamente por este motivo (recorte sem grounding formal, mas que induzia números/fonte sem suporte) — mesmo padrão, mesma solução, sem inventar nada, sem imprecisão (regra legal real e estável, sem posologia/protocolo variável).
2. **Reformulação editorial do recorte** — isoladamente, insuficiente: já falhou 3x mesmo com o recorte atual sendo puramente comportamental/qualitativo; o problema não é a redação do recorte, é a ausência de fonte para a IA se apoiar quando ela tenta (por conta própria) enriquecer a questão com base legal.
3. **Simples nova tentativa** — isoladamente, baixa probabilidade de sucesso: o padrão já se repetiu de forma consistente nas 3 tentativas (mesmas duas classes de motivo).
4. **Combinação recomendada: 1 + 3.** Adicionar grounding mínimo (opção 1, requer autorização e é alteração de código — não feita agora) e só então reagendar R096 num lote de recuperação futuro (opção 3, já apoiado por fonte).

**Preserva a aposta central do recorte** (reconhecer sinais/suspeita de violência e aplicar o fluxo de notificação corretamente, sem confundir com denúncia policial) — a correção proposta é só de suporte documental (grounding), não de conteúdo pedagógico.

## CADÊNCIA OPERACIONAL — LOTES NORMAIS + RECUPERAÇÃO

- Continuar lotes normais de 3 recortes, mesma área por lote, alternando entre as 5 áreas.
- **A cada 3–4 lotes normais, executar 1 lote de recuperação** — reunindo recortes em `PENDENTE — RECUPERAÇÃO`, também respeitando a regra de mesma área por execução.
- Nenhum recorte prioritário fica pendente indefinidamente: todo item da Fila de Recuperação precisa de uma data/lote de retorno definido antes de ser considerado resolvido.
- R096 é o primeiro (e único, por ora) item da fila — entra no próximo lote de recuperação da área Preventiva, condicionado à adição do grounding mínimo (recomendação técnica acima), sujeito à sua autorização.

---

## LOTE 003 — PRODUÇÃO OFICIAL CONTROLADA

**Aberto em:** 2026-07-23. **Ambiente:** revalidapro-dev, exclusivamente pelo painel (`https://revalidapro-dev.web.app`) — RoboGerador com **Formato ABCD: LIGADO** e **Modo validação (1 questão por recorte): LIGADO**. Geração pelo Claude via script **não autorizada** para este lote — todos os 12 itens abaixo devem ser gerados pelo usuário, um recorte por vez, aguardando conclusão completa (questão + resumo) antes do próximo.

Texto de cada recorte reproduzido **na íntegra** de `recortes_100_condensado.json` (Mapa Mestre real) — `recorte` (o que cobrar), `decisão` (a decisão correta esperada) e `armadilha` (erro típico que a questão deve testar).

### VALIDAÇÃO REAL (2 primeiros — critério de homologação E2E, ver seção 5 abaixo)

**1. R041 — Preventiva — Infecção por HIV** — ⛔ **REVISÃO HUMANA — GROUNDING INSUFICIENTE** (retirado da fila automática, ver seção abaixo)
- **Recorte:** Indicação de PrEP e PEP conforme protocolo atual
- **Decisão:** Indicar PrEP por critério de vulnerabilidade/exposição contínua e PEP dentro da janela de 72h pós-exposição de risco
- **Armadilha:** Negar PEP por já terem se passado algumas horas, sem checar se ainda está dentro da janela de 72h
- **Grounding:** sim (diretriz `hiv`) · **Prioridade:** ALTO

#### R041 — encerramento da tentativa (2026-07-23)

**Status:** `REVISÃO HUMANA — GROUNDING INSUFICIENTE`. **Não conta como questão produzida das 120.**

- Duas execuções reais recentes no RoboGerador DEV bloquearam corretamente por números de seguimento/janela temporal (última: "semana 0"/"semana 12"; anterior: "12" de "12 semanas") ausentes do grounding controlado `hiv` atualmente injetado.
- O hotfix de falso positivo de números do próprio caso (reuso de dado do enunciado, ex. "36h") foi validado e está funcionando — não é a causa deste bloqueio.
- O bloqueio residual é **legítimo**: a fonte controlada `hiv` (`src/config/diretrizesControladas.js`) não tem, nos `pontosCriticos` atuais, os marcos de seguimento sorológico pós-PEP/PrEP (ex. "semana 0", "semana 12" ou equivalente) que o tema naturalmente demanda.
- Última tentativa real: **ID previsto `SA_2026_2_Q24`**, 1 chamada Haiku, 0 questão salva, nenhum Opus desperdiçado (bloqueio parou a cadeia antes de escalar, conforme o teto único de 3 chamadas). Também houve rejeição independente por REGRA SA-1 (alternativa correta destacada em 2 eixos: comprimento e composição/múltiplas cláusulas) — trava intacta, não é o foco deste registro.
- **`SA_2026_2_Q24` NÃO foi consumido** — nenhuma escrita ocorreu no Firestore para este ID; ele permanece livre e será o próximo número sequencial real na próxima questão efetivamente salva (a numeração é derivada do maior `numeroQuestao` existente em `questoes`, não reservada antecipadamente).
- **Próximo passo (não executado agora):** enriquecer `pontosCriticos` da diretriz `hiv` com os marcos de seguimento pós-exposição (auditoria documental própria, fonte oficial) antes de nova tentativa. Até lá, **não retentar R041 automaticamente**.
- **Substituição:** R041 sai temporariamente da fila ativa de produção. Um recorte substituto (LIBERADO, não usado) pode ser selecionado depois, sem travar a produção dos demais 10 recortes deste lote — substituição específica ainda não escolhida nesta atualização.

**2. R034 — Cirurgia — Hérnia** — ✅ **QUESTÃO APROVADA** (resumo em revisão, ver abaixo)
- **Recorte:** Hérnia da parede abdominal — diferenciação encarcerada vs. estrangulada e conduta
- **Decisão:** Indicar cirurgia de urgência na hérnia estrangulada (sinais de sofrimento vascular/sistêmicos), tentar redução manual só na encarcerada sem esses sinais
- **Armadilha:** Tentar redução manual de hérnia com sinais de estrangulamento (dor intensa, eritema, sinais sistêmicos)
- **Grounding:** não · **Prioridade:** ALTO

#### R034 — encerramento da tentativa (2026-07-24)

**Questão:** `SA_2026_2_Q24` — **APROVADA E SALVA**. Modelo: Haiku. Chamadas da questão: 1 (sem retry, sem Opus). Estratégia da Aposta disponível.

**Resumo do Tema** (`Hérnia da parede abdominal--idoso`): **REJEITADO após 2 tentativas Haiku** (teto do retry corrigível respeitado — nunca uma 3ª chamada, nunca Opus).
- Tentativa 1: rejeitada — termo absoluto ("sempre"/"nunca") sem diretriz controlada injetada (SA-4). Retry corretivo 1/1 acionado com feedback específico.
- Tentativa 2: rejeitada — número(s) clínico(s) (1, 2, 3, 4) sem diretriz controlada injetada (SA-4) — a tentativa 2 corrigiu a linguagem absoluta, mas introduziu números novos não cobertos pelas regras atuais de marcador de lista.
- Resumo **não foi salvo** (candidata rejeitada nunca é persistida) — fica **PENDENTE/REVISÃO**, para lote de revisão separado. Não foi aberto novo hotfix para este caso pontual (decisão explícita — ver seção "Regra operacional oficial" abaixo).

**Status para as 120:** `SA_2026_2_Q24` **CONTA COMO CANDIDATA VÁLIDA** — questão aprovada não é bloqueada por resumo em revisão.

### PRODUÇÃO (10 recortes seguintes — só iniciar após critério da seção 5 confirmado)

**3. R002 — Clínica Médica — Hipertensão arterial sistêmica** — ✅ **QUESTÃO APROVADA** (resumo em revisão, ver abaixo)
- **Recorte:** Crise hipertensiva — diferenciação urgência vs. emergência e conduta imediata
- **Decisão:** Definir se há lesão de órgão-alvo aguda; só então indicar redução rápida de PA
- **Armadilha:** Tratar toda PA muito elevada como emergência, reduzindo rápido demais sem sinal de lesão de órgão-alvo
- **Grounding obrigatório:** não (`exige_grounding: false` no Mapa Mestre) · **Grounding disponível/auto-injetado:** sim (diretriz `has`, matching por tema) · **Prioridade:** ALTO

#### R002 — encerramento da tentativa (2026-07-24)

**Questão:** `SA_2026_2_Q25` — **APROVADA E SALVA**. Modelo: Haiku. Chamadas: 1. Retry: não.

**Resumo do Tema** (`Hipertensão arterial sistêmica--emergência`): **REJEITADO POR GROUNDING** — rejeitado por introduzir números clínicos não presentes no grounding (180, 190, 110, 95). Não foi salvo (candidata rejeitada nunca é persistida). Fica **PENDENTE/REVISÃO**, para lote de revisão separado. Nenhum código/prompt/hotfix alterado por causa deste caso pontual.

**Status para as 120:** `SA_2026_2_Q25` **CONTA COMO CANDIDATA VÁLIDA** — questão aprovada não é bloqueada por resumo em revisão (regra operacional oficial, Caso B).

**4. R003 — Clínica Médica — Diabetes mellitus**
- **Recorte:** DM tipo 2 — metas glicêmicas e escolha de 2ª droga além da metformina por perfil cardiorrenal
- **Decisão:** Priorizar iSGLT2/GLP-1 quando há doença cardiovascular ou renal estabelecida, não apenas controle glicêmico
- **Armadilha:** Escalonar para sulfonilureia/insulina por hábito, ignorando benefício cardiorrenal de outras classes
- **Grounding:** sim (diretriz `dm`) · **Prioridade:** ALTO
- **Status:** PENDENTE — AGUARDANDO GERAÇÃO NO PAINEL

**5. R015 — Ginecologia e Obstetrícia — Sífilis**
- **Recorte:** Estadiamento clínico e escolha do esquema de penicilina benzatina por fase
- **Decisão:** Escolher dose/duração da penicilina conforme o estágio (primária/secundária/latente/terciária)
- **Armadilha:** Usar esquema de dose única em sífilis latente tardia ou terciária
- **Grounding:** sim (diretriz `sifilis`) · **Prioridade:** ALTO
- **Status:** PENDENTE — AGUARDANDO GERAÇÃO NO PAINEL

**6. R019 — Preventiva — Epidemiologia**
- **Recorte:** Cálculo e interpretação de sensibilidade, especificidade e valor preditivo
- **Decisão:** Interpretar VPP/VPN considerando a prevalência da doença na população testada, não só a acurácia do teste
- **Armadilha:** Aplicar VPP calculado em uma prevalência diferente da população do enunciado
- **Grounding:** não · **Prioridade:** ALTO
- **Status:** PENDENTE — AGUARDANDO GERAÇÃO NO PAINEL

**7. R021 — Pediatria — Reanimação**
- **Recorte:** Reanimação neonatal — sequência da sala de parto e indicação de manobras
- **Decisão:** Seguir a sequência (secar/aquecer → avaliar FC/respiração → VPP) antes de escalonar para massagem/adrenalina
- **Armadilha:** Iniciar compressão torácica antes de otimizar a ventilação com pressão positiva
- **Grounding:** não · **Prioridade:** ALTO
- **Status:** PENDENTE — AGUARDANDO GERAÇÃO NO PAINEL

**8. R024 — Ginecologia e Obstetrícia — Hemorragia pós-parto**
- **Recorte:** Causas (4 Ts) e sequência de manejo escalonado
- **Decisão:** Seguir a sequência de manejo (massagem → uterotônicos → medidas cirúrgicas) conforme a causa identificada pelos 4 Ts
- **Armadilha:** Pular direto para histerectomia sem esgotar medidas conservadoras em causa reversível (tono/tecido)
- **Grounding:** não · **Prioridade:** ALTO
- **Status:** PENDENTE — AGUARDANDO GERAÇÃO NO PAINEL

**9. R025 — Ginecologia e Obstetrícia — Gravidez ectópica**
- **Recorte:** Diagnóstico precoce e decisão cirúrgica vs. expectante/medicamentosa
- **Decisão:** Escolher conduta (metotrexato, laparoscopia, expectante) pela estabilidade hemodinâmica e critérios de elegibilidade, não automaticamente cirurgia
- **Armadilha:** Indicar laparotomia de urgência em paciente estável com critérios para conduta medicamentosa
- **Grounding:** não · **Prioridade:** ALTO
- **Status:** PENDENTE — AGUARDANDO GERAÇÃO NO PAINEL

**10. R029 — Clínica Médica — Trombose venosa profunda**
- **Recorte:** Escore de Wells e conduta anticoagulante inicial
- **Decisão:** Usar o escore de Wells para definir probabilidade pré-teste antes de indicar D-dímero ou imagem direta
- **Armadilha:** Solicitar D-dímero em paciente de alta probabilidade pré-teste, atrasando o exame de imagem definitivo
- **Grounding:** não · **Prioridade:** ALTO
- **Status:** PENDENTE — AGUARDANDO GERAÇÃO NO PAINEL

**11. R030 — Pediatria — Transtorno do Espectro Autista**
- **Recorte:** Sinais de alerta precoces e conduta de encaminhamento
- **Decisão:** Encaminhar para avaliação especializada diante de sinais de alerta na puericultura, sem esperar "fechar" o diagnóstico na atenção primária
- **Armadilha:** Adotar postura de "esperar para ver" diante de sinais de alerta claros de atraso de desenvolvimento social/comunicativo
- **Grounding:** não · **Prioridade:** ALTO
- **Status:** PENDENTE — AGUARDANDO GERAÇÃO NO PAINEL

**12. R038 — Pediatria — Anemia**
- **Recorte:** Diagnóstico diferencial por índices hematimétricos e conduta inicial
- **Decisão:** Diferenciar anemia ferropriva de outras microcíticas pelos índices (RDW, ferritina) antes de suplementar ferro empiricamente
- **Armadilha:** Suplementar ferro em anemia microcítica sem investigar talassemia/doença crônica quando o quadro não é típico
- **Grounding:** não · **Prioridade:** ALTO
- **Status:** PENDENTE — AGUARDANDO GERAÇÃO NO PAINEL

### Critério dos dois primeiros (R041, R034) — ENCERRADO (2026-07-24)

Resultado: **R041** → `REVISÃO HUMANA — GROUNDING INSUFICIENTE`, não conta para as 120 neste momento. **R034** → `QUESTÃO APROVADA` (`SA_2026_2_Q24`), resumo em revisão, conta como candidata válida. Nenhum dos dois foi um bloqueio sistêmico do pipeline (grounding insuficiente de R041 é problema de fonte de UM tema; resumo de R034 é candidata pontual corrigível em lote futuro) — critério de homologação considerado satisfeito para liberar a produção dos 10 recortes restantes deste lote, sem nova discussão de arquitetura.

### Regra operacional oficial (vigente a partir de 2026-07-24)

Fase de hotfixes da engine SA encerrada. A partir de agora:
- **Não reabrir arquitetura** por falha pontual de conteúdo de um recorte específico; não criar novos hotfixes automáticos; não mexer em retry/grounding/resumo/estratégia/validadores sem bug crítico **sistêmico** comprovado (afeta múltiplos recortes, não um caso isolado).
- **Resumo rejeitado NÃO bloqueia questão aprovada.** Questão aprovada conta para as 120 mesmo com resumo em `PENDENTE/REVISÃO`.
- Produção continua exclusivamente em `revalidapro-dev`.
- Decisão por recorte (não interromper o lote inteiro por um único item):
  - **Caso A** — questão aprovada + resumo aprovado → `APROVADO COMPLETO`, seguir.
  - **Caso B** — questão aprovada + resumo rejeitado → `QUESTÃO APROVADA / RESUMO EM REVISÃO`, seguir.
  - **Caso C** — questão rejeitada por problema pontual de geração → `REVISAR`/`REJEITADO`, seguir para o próximo recorte.
  - **Caso D** — grounding estruturalmente insuficiente → `REVISÃO HUMANA — GROUNDING`, seguir.

### Dados a coletar por recorte (preencher aqui após cada geração real)

Por recorte: ID Rxxx · ID SA_2026_2_Qxxx · resultado da questão · modelo · nº de chamadas · retry/motivo · `status_atualizacao` · chave do resumo · nº de blocos · resumo salvo/reaproveitado/rejeitado · observação pedagógica. Confirmação final = log do RoboGerador **+** documento no Firestore **+** visualização no painel — nunca só o log.

---

## 1. Legenda

- **Status Recorte** (classificação do Mapa Mestre): `LIBERADO` · `BLOQUEADO` · `REVISAO_HUMANA`
- **Status Produção**: `PENDENTE` · `GERADO` · `VALIDADO (não salvo)` · `REVISAR` · `BLOQUEADO`
- **Resumo**: `PENDENTE` (não gerado) · `verificar` (deveria existir, não confirmado ao vivo)

## 2. Recortes BLOQUEADOS (categoria 3 — 18 recortes, não tentar sem revisão de fonte)

R011, R013, R014, R018, R027, R028, R040, R053, R054, R056, R057, R058, R059, R060, R061, R062, R064, R087

## 3. Recortes REVISAO_HUMANA (categoria 4 — 8 recortes, não gerar automaticamente)

R005, R033, R048, R049, R051, R052, R055, R065

Adicional (achado nesta calibração, fora dos 8 originais): **R016** (Sífilis congênita) — tentado 2x em produção, falhou por grounding numérico insuficiente (seguimento sorológico do RN). Já registrado em `src/config/recortesStatusSA.js` como `REVISAO_HUMANA`.

Adicional (2026-07-23): **R041** (HIV — PrEP/PEP) — tentado 2x em produção (a mais recente, ID previsto `SA_2026_2_Q24`, não consumido), falhou por grounding numérico insuficiente (marcos de seguimento pós-exposição, "semana 0"/"semana 12", ausentes de `pontosCriticos`). Detalhamento completo na seção Lote 003. **Não registrado ainda em `src/config/recortesStatusSA.js`** — essa é uma alteração de código, fora do escopo desta atualização (só documentação).

## 4. Tabela completa R001–R120

| ID | Matéria | Tema/Recorte | Prioridade | Grounding | Status Recorte | Questão | Modelo | Resumo | Obs. |
|---|---|---|---|---|---|---|---|---|---|
| R001 | Clínica Médica | Hipertensão arterial sistêmica: Diagnóstico por MRPA/MAPA e estratificação de risco cardiovascular par | ALTO | sim | LIBERADO | SA_2026_2_Q12 | opus | verificar | alto risco → revisão Opus |
| R002 | Clínica Médica | Hipertensão arterial sistêmica: Crise hipertensiva — diferenciação urgência vs. emergência e conduta i | ALTO | não | LIBERADO | SA_2026_2_Q25 | haiku | **REVISÃO** | Questão APROVADA (1 chamada Haiku, sem retry). Resumo rejeitado por grounding — números 180/190/110/95 não presentes na fonte. Conta como candidata válida para as 120. |
| R003 | Clínica Médica | Diabetes mellitus: DM tipo 2 — metas glicêmicas e escolha de 2ª droga além da metformina  | ALTO | sim | LIBERADO | - | - | PENDENTE |  |
| R004 | Ginecologia e Obstetrícia | Diabetes mellitus: Diabetes gestacional — rastreio por TOTG e manejo inicial não farmacol | ALTO | sim | LIBERADO | SA_2026_2_Q13 | opus | verificar |  |
| R005 | Clínica Médica | Tuberculose: Diagnóstico (baciloscopia/GeneXpert) e esquema RIPE, sinais de falênci | ALTO | sim | REVISAO_HUMANA | - | - | PENDENTE |  |
| R006 | Clínica Médica | Asma: Diferenciação crise vs. manutenção e uso correto do corticoide inalató | ALTO | sim | LIBERADO | - | - | PENDENTE | tentado como substituto de R016, falhou (erro técnico JSON) |
| R007 | Pediatria | Dengue: Classificação de gravidade (grupos A–D) e reconhecimento de sinais de  | ALTO | não | LIBERADO | SA_2026_2_Q15 | haiku | verificar | falhou antes do hotfix, sucesso após |
| R008 | Medicina Legal e Ética Médica | Ética Médica: Sigilo médico e quebra justificada (risco a terceiros, notificação com | ALTO | não | LIBERADO | SA_2026_2_Q16 | haiku | verificar | falhou antes do hotfix, sucesso após |
| R009 | Medicina Legal e Ética Médica | Ética Médica: Consentimento informado e autonomia do paciente/adolescente | ALTO | não | LIBERADO | SA_2026_2_Q20 | haiku | verificar |  |
| R010 | Medicina Legal e Ética Médica | Ética Médica: Comunicação de más notícias e conduta diante de erro médico | ALTO | não | LIBERADO | - | - | PENDENTE | tentado nesta sessão — bloqueado por grounding (afirmação absoluta), precisa nova tentativa |
| R011 | Ginecologia e Obstetrícia | Planejamento Familiar: Escolha de método contraceptivo por perfil de risco | ALTO | sim | BLOQUEADO | - | - | PENDENTE |  |
| R012 | Clínica Médica | Sepse: Reconhecimento precoce, gravidade (qSOFA/lactato) e momento de início  | ALTO | sim | LIBERADO | - | - | PENDENTE | tentado, falhou (Sepse depois gerada via tema solto, não este recorte formal) |
| R013 | Ginecologia e Obstetrícia | Câncer de mama: Rastreamento (idade/intervalo) e conduta em achado suspeito (BI-RADS) | ALTO | sim | BLOQUEADO | - | - | PENDENTE |  |
| R014 | Ginecologia e Obstetrícia | Climatério: Indicação e contraindicação de terapia hormonal do climatério | ALTO | sim | BLOQUEADO | - | - | PENDENTE |  |
| R015 | Ginecologia e Obstetrícia | Sífilis: Estadiamento clínico e escolha do esquema de penicilina benzatina | ALTO | sim | LIBERADO | - | - | PENDENTE |  |
| R016 | Pediatria | Sífilis: Sífilis congênita — critérios diagnósticos e tratamento do RN | ALTO | sim | **REVISAO_HUMANA** | - | - | PENDENTE | tentado 2x, falhou por grounding numérico (seguimento sorológico RN) |
| R017 | Pediatria | Icterícia: Icterícia neonatal — diferenciação fisiológica vs. patológica | ALTO | não | LIBERADO | - | - | PENDENTE | tentado, falhou |
| R018 | Clínica Médica | Insuficiência cardíaca: Diagnóstico e ajuste terapêutico guiado por NYHA | ALTO | sim | BLOQUEADO | - | - | PENDENTE |  |
| R019 | Preventiva | Epidemiologia: Cálculo e interpretação de sensibilidade, especificidade, VPP | ALTO | não | LIBERADO | - | - | PENDENTE |  |
| R020 | Ginecologia e Obstetrícia | Rastreamento do câncer do colo do útero: Intervalo de rastreio e conduta frente a ASC-US/LSIL | ALTO | sim | LIBERADO | SA_2026_2_Q18 | haiku | verificar |  |
| R021 | Pediatria | Reanimação: Reanimação neonatal — sequência da sala de parto | ALTO | não | LIBERADO | - | - | PENDENTE |  |
| R022 | Cirurgia | Traumatismo cranioencefálico: Escala de Glasgow e indicação de TC de crânio | ALTO | não | LIBERADO | SA_2026_2_Q14 **e** Q17 (duplicado) | haiku/opus | verificar | aparece 2x nos registros — verificar qual prevalece |
| R023 | Cirurgia | Diverticulite: Classificação de Hinchey e indicação cirúrgica vs. conservadora | ALTO | não | LIBERADO | SA_2026_2_Q21 | opus | verificar | sem grounding específico |
| R024 | Ginecologia e Obstetrícia | Hemorragia pós-parto: Causas (4 Ts) e manejo escalonado | ALTO | não | LIBERADO | - | - | PENDENTE |  |
| R025 | Ginecologia e Obstetrícia | Gravidez ectópica: Diagnóstico precoce e decisão cirúrgica vs. expectante | ALTO | não | LIBERADO | - | - | PENDENTE |  |
| R026 | Ginecologia e Obstetrícia | Pré-eclâmpsia: Critérios de gravidade e indicação de sulfato de magnésio | ALTO | não | LIBERADO | - | - | PENDENTE |  |
| R027 | Clínica Médica | ITU: Diferenciação cistite vs. pielonefrite e antibioticoterapia empírica | ALTO | sim | BLOQUEADO | - | - | PENDENTE |  |
| R028 | Clínica Médica | DPOC: Estratificação GOLD e escolha do broncodilatador de manutenção | ALTO | sim | BLOQUEADO | - | - | PENDENTE |  |
| R029 | Clínica Médica | TVP: Escore de Wells e conduta anticoagulante inicial | ALTO | não | LIBERADO | - | - | PENDENTE |  |
| R030 | Pediatria | TEA: Sinais de alerta precoces e conduta de encaminhamento | ALTO | não | LIBERADO | - | - | PENDENTE |  |
| R031 | Clínica Médica | DII: Diferenciação Crohn vs. retocolite ulcerativa e manejo do surto | ALTO | não | LIBERADO | - | - | PENDENTE |  |
| R032 | Preventiva | Imunização: Calendário nacional de vacinação e principais contraindicações | ALTO | sim | LIBERADO | SA_2026_2_Q19 | opus | verificar |  |
| R033 | Preventiva | Imunização: Situações especiais — imunossuprimidos, gestantes, viajantes | ALTO | sim | REVISAO_HUMANA | - | - | PENDENTE |  |
| R034 | Cirurgia | Hérnia: Hérnia da parede abdominal — encarcerada vs. estrangulada | ALTO | não | LIBERADO | SA_2026_2_Q24 | haiku | **REVISÃO** | Questão APROVADA (1 chamada Haiku, sem retry). Resumo rejeitado após 2 tentativas Haiku (retry corretivo usado) — pendente revisão em lote separado. Conta como candidata válida para as 120. |
| R035 | Clínica Médica | Distúrbios hidroeletrolíticos: Reconhecimento e correção de hipercalemia grave | ALTO | não | LIBERADO | - | - | PENDENTE |  |
| R036 | Ginecologia e Obstetrícia | Distocia de ombro: Manobras sequenciais e fator de risco | ALTO | não | LIBERADO | - | - | PENDENTE |  |
| R037 | Ginecologia e Obstetrícia | Endometriose: Suspeita clínica e abordagem escalonada | ALTO | não | LIBERADO | - | - | PENDENTE |  |
| R038 | Pediatria | Anemia: Diagnóstico diferencial por índices hematimétricos | ALTO | não | LIBERADO | - | - | PENDENTE |  |
| R039 | Clínica Médica | DRGE: Critérios de alarme e indicação de IBP vs. endoscopia | ALTO | não | LIBERADO | - | - | PENDENTE |  |
| R040 | Geriatria | Osteoporose: Indicação de rastreio (densitometria) e início de tratamento | ALTO | sim | BLOQUEADO | - | - | PENDENTE |  |
| R041 | Preventiva | HIV: Indicação de PrEP e PEP conforme protocolo atual | ALTO | sim | **REVISAO_HUMANA** | - | - | PENDENTE | **GROUNDING INSUFICIENTE** — 2 execuções reais bloquearam por marcos de seguimento (semana 0/12) ausentes de `pontosCriticos` (hiv); não conta para as 120; ver detalhamento na seção Lote 003 |
| R042 | Ginecologia e Obstetrícia | HIV na gestação: TARV e prevenção de transmissão vertical | ALTO | sim | LIBERADO | - | - | PENDENTE |  |
| R043 | Clínica Médica | Tuberculose: Tratamento da ILTB e populações prioritárias | ALTO | sim | LIBERADO | - | - | PENDENTE |  |
| R044 | Clínica Médica | Sepse: Pacote da 1ª hora (Surviving Sepsis) e metas de ressuscitação | ALTO | sim | LIBERADO | - | - | PENDENTE |  |
| R045 | Clínica Médica | Asma: Step-up/step-down terapêutico conforme diretriz | ALTO | sim | LIBERADO | - | - | PENDENTE |  |
| R046 | Clínica Médica | HAS: Classes de anti-hipertensivo de 1ª linha por comorbidade | ALTO | sim | LIBERADO | - | - | PENDENTE |  |
| R047 | Clínica Médica | DM: Uso de iSGLT2/GLP-1 por indicação cardiorrenal | ALTO | sim | LIBERADO | - | - | PENDENTE |  |
| R048 | Ginecologia e Obstetrícia | Rastreamento colo uterino: Teste DNA-HPV como método primário | ALTO | sim | REVISAO_HUMANA | - | - | PENDENTE |  |
| R049 | Ginecologia e Obstetrícia | Sífilis: Sífilis na gestação — tratamento do parceiro | ALTO | sim | REVISAO_HUMANA | - | - | PENDENTE |  |
| R050 | Ginecologia e Obstetrícia | Pré-natal: Rotina de exames por trimestre | ALTO | sim | LIBERADO | - | - | PENDENTE |  |
| R051 | Preventiva | Imunização: Vacinação de bloqueio em surto | MEDIO | sim | REVISAO_HUMANA | - | - | PENDENTE |  |
| R052 | Clínica Médica | DM: Insulinoterapia — ajuste de dose | MEDIO | sim | REVISAO_HUMANA | - | - | PENDENTE |  |
| R053 | Ginecologia e Obstetrícia | Climatério: Terapia hormonal na menopausa | MEDIO | sim | BLOQUEADO | - | - | PENDENTE |  |
| R054 | Preventiva | Profilaxia antirrábica humana | MEDIO | sim | BLOQUEADO | - | - | PENDENTE |  |
| R055 | Clínica Médica | Hepatite B: Indicação de tratamento e profilaxia ocupacional | MEDIO | sim | REVISAO_HUMANA | - | - | PENDENTE |  |
| R056 | Clínica Médica | Leishmaniose Visceral: Diagnóstico e esquema terapêutico | MEDIO | sim | BLOQUEADO | - | - | PENDENTE |  |
| R057 | Clínica Médica | Malária: Esquema por espécie de plasmódio e gravidade | MEDIO | sim | BLOQUEADO | - | - | PENDENTE |  |
| R058 | Preventiva | Rastreamento de câncer colorretal | MEDIO | sim | BLOQUEADO | - | - | PENDENTE |  |
| R059 | Ginecologia e Obstetrícia | Contracepção em alto risco cardiovascular (OMS) | MEDIO | sim | BLOQUEADO | - | - | PENDENTE |  |
| R060 | Clínica Médica | DRC: Estadiamento KDIGO e TRS | MEDIO | sim | BLOQUEADO | - | - | PENDENTE |  |
| R061 | Geriatria | Osteoporose: Bifosfonato e drug holiday | MEDIO | sim | BLOQUEADO | - | - | PENDENTE |  |
| R062 | Clínica Médica | TEP: Estratificação de risco e anticoagulante | MEDIO | sim | BLOQUEADO | - | - | PENDENTE |  |
| R063 | Preventiva | Dengue: Vigilância epidemiológica e notificação | MEDIO | não | LIBERADO | - | - | PENDENTE |  |
| R064 | Clínica Médica | Hanseníase: Classificação operacional e PQT | MEDIO | sim | BLOQUEADO | - | - | PENDENTE |  |
| R065 | Pediatria | Sífilis: Sífilis congênita — alta e seguimento sorológico | MEDIO | sim | REVISAO_HUMANA | - | - | PENDENTE |  |
| R066 | Psiquiatria | TDAH: Diagnóstico diferencial em criança/adolescente | MEDIO | não | LIBERADO | - | - | PENDENTE |  |
| R067 | Pediatria | Parassonias: Pavor noturno vs. epilepsia | MEDIO | não | LIBERADO | - | - | PENDENTE |  |
| R068 | Pediatria | Enurese noturna: Idade diagnóstica e abordagem inicial | MEDIO | não | LIBERADO | - | - | PENDENTE |  |
| R069 | Cirurgia | Legg-Calvé-Perthes: Apresentação e conduta por estadiamento | MEDIO | não | LIBERADO | - | - | PENDENTE |  |
| R070 | Pediatria | Sinais de alarme oncológicos em pediatria | MEDIO | não | LIBERADO | - | - | PENDENTE |  |
| R071 | Pediatria | Displasia do quadril: Rastreio neonatal (Ortolani/Barlow) | MEDIO | não | LIBERADO | - | - | PENDENTE |  |
| R072 | Cirurgia | Escoliose idiopática do adolescente — rastreio | MEDIO | não | LIBERADO | - | - | PENDENTE |  |
| R073 | Pediatria | Epifisiólise proximal do fêmur — urgência de conduta | MEDIO | não | LIBERADO | - | - | PENDENTE |  |
| R074 | Geriatria | Delirium: Diferenciação de demência | MEDIO | não | LIBERADO | - | - | PENDENTE |  |
| R075 | Geriatria | Fragilidade: Rastreio e implicação terapêutica | MEDIO | não | LIBERADO | - | - | PENDENTE |  |
| R076 | Geriatria | Critérios de Beers/STOPP na prática ambulatorial | MEDIO | não | LIBERADO | - | - | PENDENTE |  |
| R077 | Geriatria | Quedas em idosos: Avaliação multifatorial | MEDIO | não | LIBERADO | - | - | PENDENTE |  |
| R078 | Otorrinolaringologia | Epistaxe anterior: Manejo escalonado | MEDIO | não | LIBERADO | - | - | PENDENTE |  |
| R079 | Otorrinolaringologia | Cerume impactado: Indicação e técnica de remoção | MEDIO | não | LIBERADO | - | - | PENDENTE |  |
| R080 | Otorrinolaringologia | Faringoamigdalite: Viral vs. estreptocócica (Centor) | MEDIO | não | LIBERADO | - | - | PENDENTE |  |
| R081 | Otorrinolaringologia | Vertigem: Periférica vs. central | MEDIO | não | LIBERADO | - | - | PENDENTE |  |
| R082 | Medicina Legal e Saúde do Trabalhador | Óbito por acidente de trabalho: Fluxo CAT | MEDIO | não | LIBERADO | - | - | PENDENTE |  |
| R083 | Medicina Legal e Saúde do Trabalhador | Nexo causal e Lista de Doenças (LDRT) | MEDIO | não | LIBERADO | - | - | PENDENTE |  |
| R084 | Medicina Legal e Ética Médica | Atestado médico e sigilo no trabalho | MEDIO | não | LIBERADO | - | - | PENDENTE |  |
| R085 | Pediatria | Puberdade precoce: Critérios e investigação | MEDIO | não | LIBERADO | - | - | PENDENTE |  |
| R086 | Medicina Legal e Ética Médica | Nome social e sigilo médico | BAIXO | não | LIBERADO | - | - | PENDENTE |  |
| R087 | Medicina Legal e Ética Médica | Teleconsultoria: Limites éticos e regulatórios | BAIXO | sim | BLOQUEADO | - | - | PENDENTE |  |
| R088 | Psiquiatria | Risco de suicídio em adolescente: Rastreio ativo | MEDIO | não | LIBERADO | - | - | PENDENTE |  |
| R089 | Pediatria | Constipação funcional: Critérios de Roma | BAIXO | não | LIBERADO | - | - | PENDENTE |  |
| R090 | Pediatria | Convulsão febril simples: Critérios de benignidade | MEDIO | não | LIBERADO | - | - | PENDENTE |  |
| R091 | Pediatria | Curvas de crescimento e sinais de alerta | BAIXO | não | LIBERADO | - | - | PENDENTE |  |
| R092 | Pediatria | Aleitamento materno: Fissura, ingurgitamento | BAIXO | não | LIBERADO | - | - | PENDENTE |  |
| R093 | Pediatria | Alimentação complementar: Sinais de prontidão | BAIXO | não | LIBERADO | - | - | PENDENTE |  |
| R094 | Pediatria | Puericultura: Calendário de consultas e triagens | MEDIO | não | LIBERADO | - | - | PENDENTE |  |
| R095 | Geriatria | Funcionalidade como eixo da decisão terapêutica | MEDIO | não | LIBERADO | - | - | PENDENTE |  |
| R096 | Medicina Legal e Ética Médica | Violência doméstica: Notificação compulsória | BAIXO | não | LIBERADO | - | - | PENDENTE |  |
| R097 | Pediatria | Sigilo do adolescente mesmo com pais presentes | BAIXO | não | LIBERADO | - | - | PENDENTE |  |
| R098 | Medicina de Família e Comunidade | PNAB: Atribuições da equipe e território | BAIXO | não | LIBERADO | - | - | PENDENTE |  |
| R099 | Preventiva | Segurança do paciente: Eventos adversos | BAIXO | não | LIBERADO | - | - | PENDENTE |  |
| R100 | Medicina Legal e Ética Médica | Cuidados paliativos: Elegibilidade e prognóstico | MEDIO | não | LIBERADO | - | - | PENDENTE |  |
| R101 | Clínica Médica | HAS: Contraindicação de nifedipino sublingual na crise | não classificado | sim | LIBERADO (assumido) | - | - | PENDENTE |  |
| R102 | Clínica Médica | DM: Suspender metformina (TFG<30) e contraste iodado | não classificado | sim | LIBERADO (assumido) | - | - | PENDENTE |  |
| R103 | Ginecologia e Obstetrícia | Asma: Manter tratamento inalatório na gestação | não classificado | sim | LIBERADO (assumido) | - | - | PENDENTE |  |
| R104 | Clínica Médica | Sepse: Vasopressor quando PAM<65 apesar de volume | não classificado | sim | LIBERADO (assumido) | - | - | PENDENTE |  |
| R105 | Ginecologia e Obstetrícia | Sífilis: Discordância treponêmico/não treponêmico | não classificado | sim | LIBERADO (assumido) | - | - | PENDENTE |  |
| R106 | Ginecologia e Obstetrícia | Colo uterino: Quando NÃO rastrear | não classificado | sim | LIBERADO (assumido) | - | - | PENDENTE |  |
| R107 | Pediatria | Imunização: Corticoide sistêmico e contraindicação vacinal | não classificado | sim | LIBERADO (assumido) | - | - | PENDENTE |  |
| R108 | Preventiva | HIV: PEP dentro de 72h mesmo sem confirmação | não classificado | sim | LIBERADO (assumido) | - | - | PENDENTE |  |
| R109 | Clínica Médica | TB: Quando NÃO tratar ILTB | não classificado | sim | LIBERADO (assumido) | - | - | PENDENTE |  |
| R110 | Cirurgia | TCE: Quando NÃO é necessário pedir TC de crânio | não classificado | não | LIBERADO (assumido) | - | - | PENDENTE |  |
| R111 | Cirurgia | Diverticulite não complicada — tratamento sem internação | não classificado | sim | LIBERADO (assumido) | - | - | PENDENTE |  |
| R112 | Ginecologia e Obstetrícia | Choque hipovolêmico oculto pré-hemorragia | não classificado | não | LIBERADO (assumido) | - | - | PENDENTE |  |
| R113 | Pediatria | Icterícia: Indicação de exsanguineotransfusão | não classificado | sim | LIBERADO (assumido) | - | - | PENDENTE |  |
| R114 | Pediatria | Reanimação: Limiar de FC para escalonar de VPP | não classificado | sim | LIBERADO (assumido) | - | - | PENDENTE |  |
| R115 | Medicina Legal e Ética Médica | Comunicação transparente de evento adverso | não classificado | não | LIBERADO (assumido) | - | - | PENDENTE |  |
| R116 | Preventiva | Curva epidêmica e definição de caso | não classificado | não | LIBERADO (assumido) | - | - | PENDENTE |  |
| R117 | Pediatria | Dengue: Reclassificar Grupo A para C | não classificado | sim | LIBERADO (assumido) | - | - | PENDENTE |  |
| R118 | Geriatria | Osteoporose: Fratura de fragilidade já indica tratamento | não classificado | sim | LIBERADO (assumido) | - | - | PENDENTE |  |
| R119 | Clínica Médica | IC: Hipotensão leve assintomática não suspende IECA | não classificado | sim | LIBERADO (assumido) | - | - | PENDENTE |  |
| R120 | Otorrinolaringologia | Faringoamigdalite: Quando NÃO prescrever antibiótico | não classificado | não | LIBERADO (assumido) | - | - | PENDENTE |  |

**Nota sobre R101–R120:** os arquivos-fonte não continham `categoria`/`prioridade` para esta faixa (só existe para R001–R100). Marcados `LIBERADO (assumido)` — recomendo uma auditoria rápida antes de usá-los em produção, igual à que foi feita para R001–R100.

## 5. Classificação de SA_2026_2_Q1–Q23

| Faixa | Classificação | Detalhe |
|---|---|---|
| Q1–Q6 | **Não localizadas** nos registros consultados | Recomenda-se conferência direta no Firestore |
| Q7–Q11 | **A. PILOTO/CALIBRAÇÃO** | Temas soltos (Diabetes, Asma, Sífilis, Colecistite, Câncer de mama) sem `recorteId` — geradas antes do sistema de recortes R001–R120 existir. Não contam para as 120 sem re-mapeamento manual a um Rxxx. |
| Q12–Q21 | **B. PRODUÇÃO OFICIAL (candidatas)** | Mapeadas a recortes reais (ver tabela seção 4). Recomenda-se confirmar no Firestore antes de contar definitivamente — nenhuma foi relida ao vivo nesta sessão. |
| Q22 | **Não localizada** nos registros consultados | Recomenda-se conferência direta no Firestore |
| Q23 | **C. REVISAR** | Cefaleia — questão de teste E2E desta calibração. `status_atualizacao: "revisar"` (confirmado por lógica de código). **Não corresponde a nenhum recorte oficial R001–R120** — não conta para as 120. |

## 6. Contagem estimada para as 120 (sujeita a confirmação no Firestore)

- **Candidatas a contar (B):** até 10 (Q12–Q21), com a ressalva do duplicado R022/Q14/Q17.
- **Piloto, não contam (A):** 5 (Q7–Q11), a menos que sejam remapeadas a um Rxxx específico.
- **Revisar, não conta (C):** 1 (Q23).
- **Desconhecidas:** Q1–Q6 (6) e Q22 (1) — status real desconhecido até conferência no Firestore.

## 7. Próximo lote oficial — 10 recortes selecionados

Critério: categoria LIBERADO (1 ou 2), prioridade ALTO, `PENDENTE` (nunca tentado), diversidade de matéria, sem necessidade de nova diretriz.

| ID | Matéria | Recorte | Grounding | Prioridade |
|---|---|---|---|---|
| R002 | Clínica Médica | Crise hipertensiva — urgência vs. emergência e conduta imediata | não | ALTO |
| R003 | Clínica Médica | DM tipo 2 — metas glicêmicas e escolha de 2ª droga por perfil cardiorrenal | sim (diretriz `dm`) | ALTO |
| R015 | Ginecologia e Obstetrícia | Sífilis — estadiamento e esquema de penicilina benzatina por fase | sim (diretriz `sifilis`) | ALTO |
| R019 | Preventiva | Epidemiologia — sensibilidade, especificidade, valor preditivo | não | ALTO |
| R021 | Pediatria | Reanimação neonatal — sequência da sala de parto | não | ALTO |
| R024 | Ginecologia e Obstetrícia | Hemorragia pós-parto — causas (4 Ts) e manejo escalonado | não | ALTO |
| R025 | Ginecologia e Obstetrícia | Gravidez ectópica — diagnóstico precoce e cirúrgico vs. expectante | não | ALTO |
| R029 | Clínica Médica | TVP — Escore de Wells e conduta anticoagulante inicial | não | ALTO |
| R030 | Pediatria | TEA — sinais de alerta precoces e encaminhamento | não | ALTO |
| R038 | Pediatria | Anemia — diagnóstico diferencial por índices hematimétricos | não | ALTO |

Atualização (2026-07-24): **R002** e **R034** já foram gerados, aprovados e salvos (`SA_2026_2_Q25` e `SA_2026_2_Q24` — ver seção Lote 003 e tabela mestre). **R041** permanece REVISÃO HUMANA — GROUNDING INSUFICIENTE, não conta para as 120.

## 8. Como manter este arquivo atualizado

Após cada lote real, atualizar manualmente as colunas Questão/Modelo/Resumo/Status para os recortes usados, com base no log real do RoboGerador (ID, modelo, `📚 salvo/reaproveitado/rejeitado`).
