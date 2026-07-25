# AUDITORIA CRÍTICA DE ATUALIZAÇÃO CLÍNICA E NORMATIVA — Super Apostas 2026.2

**Data:** 2026-07-24. **Escopo:** `src/config/diretrizesControladas.js` (12 diretrizes ativas), os 120 recortes do Mapa Mestre, e as 12 questões já produzidas (Q1–Q12). **Método:** leitura de código + leitura dos arquivos-fonte do Mapa Mestre (recuperados em scratchpad de sessão anterior) + verificação externa via busca web das fontes oficiais reais (não apenas o ano cadastrado no arquivo). Nenhum código alterado, nenhuma questão gerada, nenhuma chamada à API Anthropic.

---

## TAREFA 1 — INVENTÁRIO REAL (12 diretrizes cadastradas)

Todas em `src/config/diretrizesControladas.js`, todas `ativa: true`, `historica: false`, `substitui: null`. Injeção no prompt: função `montarBlocoDiretriz` ([diretrizesControladas.js:422-435](src/config/diretrizesControladas.js#L422-L435)), chamada por `RoboGerador.jsx` sempre que `detectarDiretrizDinamica`/`detectarDiretriz` encontra correspondência de palavra-chave no tema.

| id | Tema | Fonte cadastrada | Ano cadastrado | Nº pontos críticos |
|---|---|---|---|---|
| `has` | Hipertensão Arterial Sistêmica | 7ª Diretriz Brasileira de Hipertensão Arterial — SBC/SBH | 2024 | 12 |
| `dm` | Diabetes Mellitus | Diretrizes da Sociedade Brasileira de Diabetes (SBD) | 2024–2025 | 12 |
| `sepse` | Sepse | Surviving Sepsis Campaign Guidelines 2021 + AMIB | 2022 | 12 |
| `asma` | Asma | GINA 2024 + SBPT 2023 | 2024 | 10 |
| `rastreamento_colo` | Rastreamento do Câncer de Colo do Útero | INCA 2023 (2ª edição) | 2023 | 12 |
| `prenatal` | Pré-natal | Manual de Atenção ao Pré-natal — MS 2022 + FEBRASGO 2023 | 2023 | 13 |
| `sifilis` | Sífilis | PCDT IST — MS | 2022 | 12 |
| `vacinacao` | Vacinação | Calendário Nacional de Vacinação SUS — PNI/MS | 2024 | 14 |
| `hiv` | HIV/AIDS | PCDT HIV Adultos — MS + Nota Técnica DIAHV | 2022/2023 | 12 |
| `tuberculose` | Tuberculose | Manual de Recomendações TB — MS 2019 (revisão 2022) | 2022 | 12 |
| `dengue` | Dengue | MS — Dengue: Diagnóstico e Manejo Clínico (5ª edição) | 2023 | 10 |
| `etica_medica` | Ética Médica — Sigilo Profissional | Código de Ética Médica — Resolução CFM nº 2.217/2018 | 2019 | 7 |

**Mecanismo de proteção existente:** o prompt injeta explicitamente `✗ PROIBIDO usar classificação, critério diagnóstico ou conduta anterior a {ano}`. **Limitação estrutural confirmada:** essa regra só impede citar algo **mais antigo** que o ano cadastrado — não existe nenhum mecanismo que detecte que **o próprio ano cadastrado já está atrás** da edição oficial real mais recente. É exatamente essa lacuna que as Tarefas 2–3 expõem com evidência concreta.

---

## TAREFA 2 — FONTE OFICIAL (classificação por entrada)

| id | Classificação | Justificativa |
|---|---|---|
| `has` | **A — oficial confirmada** | SBC é a sociedade médica reconhecida para o tema. |
| `dm` | **A — oficial confirmada** | SBD é a sociedade médica reconhecida. |
| `sepse` | **A — oficial confirmada** | SSC/ESICM/SCCM + AMIB (representação nacional), fonte internacional-padrão. |
| `asma` | **A — oficial confirmada** | GINA é o consórcio internacional de referência; SBPT é a sociedade nacional. |
| `rastreamento_colo` | **A — oficial confirmada** | INCA é o órgão federal para o tema. |
| `prenatal` | **A — oficial confirmada** | MS + FEBRASGO. |
| `sifilis` | **A — oficial confirmada** | PCDT do MS. |
| `vacinacao` | **A — oficial confirmada** | PNI/MS é a autoridade federal do tema. |
| `hiv` | **A — oficial confirmada** | PCDT do MS/DIAHV. |
| `tuberculose` | **A — oficial confirmada** | MS. |
| `dengue` | **A — oficial confirmada** | MS. |
| `etica_medica` | **A — oficial confirmada** | CFM é a autoridade normativa do tema. |

**Nenhuma das 12 entradas usa fonte inventada pela IA** — todas citam instituição real, verificável, e nenhuma foi encontrada como fabricada. Este ponto está bem resolvido pela engine. O problema real (Tarefas 3/6) não é a **legitimidade** da fonte, é a **atualidade da versão citada**.

---

## TAREFA 3 — ATUALIDADE (verificada por busca externa em 2026-07-24, não apenas pelo ano do arquivo)

| id | Classificação | Evidência real encontrada |
|---|---|---|
| `has` | **POSSIVELMENTE DESATUALIZADA** | Existe "Diretriz Brasileira de Hipertensão Arterial – 2025" (Arq Bras Cardiol, v.122 n.9, e20250624/2025), descrita como atualização da 7ª diretriz. Conteúdo central (meta 130/80, MAPA/MRPA, estratificação de risco) parece coincidir com o cadastrado, mas a edição oficial mais recente **não é a citada** — sem leitura do documento 2025 na íntegra não dá para garantir que nenhum ponto crítico mudou. |
| `dm` | **DESATUALIZADA — divergência confirmada** | SBD publicou atualização em **julho/2025** que **retira a exclusividade da metformina como 1ª linha** — contradiz diretamente o ponto crítico cadastrado ("DM2 — 1ª linha: Metformina..."). Esta é uma mudança clínica real e substantiva, não cosmética. |
| `sepse` | **DESATUALIZADA — ciclo completo novo publicado** | Existem novas diretrizes SSC 2026 (IDSA/ESICM/SCCM), com 46 novos enunciados sobre a edição 2021 que embasa nossa entrada. Gap de 5 anos entre um ciclo completo de revisão e o outro. |
| `asma` | **DESATUALIZADA — dois ciclos anuais atrás** | GINA publica atualização anual; já existem GINA 2025 **e** GINA 2026 (maio/2026), superando a "GINA 2024" cadastrada. GINA é notoriamente um documento vivo, revisado todo ano — citar "2024" é estruturalmente inadequado para essa fonte específica. |
| `rastreamento_colo` | **DESATUALIZADA — mudança de paradigma confirmada** | Novas Diretrizes Brasileiras (INCA/MS), portaria publicada em **agosto/2025**, mudam o método primário de rastreamento de **citologia** para **teste molecular DNA-HPV**, com intervalo de 5 anos — muda o próprio pilar do que está cadastrado ("Periodicidade INCA 2023: citologia... a cada 3 anos"). |
| `sifilis` | **POSSIVELMENTE DESATUALIZADA** | PCDT-IST foi atualizado em **04/07/2024** (2 anos mais novo que o cadastrado 2022). Não há confirmação de que o esquema de penicilina benzatina por estágio mudou, mas a versão citada não é a vigente. |
| `vacinacao` | **DESATUALIZADA — divergência de esquema confirmada** | Instrução Normativa do Calendário Nacional de Vacinação **2026** já existe, com mudança concreta: **meningocócica ACWY como reforço aos 12 meses**, substituindo/complementando o que está cadastrado ("Meningo C conjugada... reforço aos 12 meses"). |
| `hiv` | **POSSIVELMENTE DESATUALIZADA** | Existe PCDT HIV **Módulo 1 (Tratamento) e Módulo 2, edição 2024**, reorganizado em 3 módulos — mais novo que "2022/Nota Técnica 2023" cadastrado. Conteúdo central (TARV para todos, TDF+3TC+DTG) permanece consistente com o meu conhecimento, mas a citação/versão está defasada. |
| `tuberculose` | **NÃO FOI POSSÍVEL CONFIRMAR** | Não encontrei evidência de revisão pós-2022 nesta auditoria; tratar como não confirmada, não como "atual". |
| `dengue` | **NÃO FOI POSSÍVEL CONFIRMAR** | Não pesquisado nesta rodada — mesma ressalva. |
| `prenatal` | **NÃO FOI POSSÍVEL CONFIRMAR** | Não pesquisado nesta rodada. |
| `etica_medica` | **ATUAL E CONFIRMADA** | Busca não encontrou nenhuma resolução CFM que revogue/substitua a 2.217/2018 em 2024/2025 — permanece vigente. |

**Resumo objetivo: de 12 diretrizes carregadas no sistema, pelo menos 6 têm evidência concreta e verificável de estarem desatualizadas ou possivelmente desatualizadas** (`dm`, `sepse`, `asma`, `rastreamento_colo` com divergência confirmada de conteúdo; `has`, `sifilis`, `hiv`, `vacinacao` com nova edição oficial já publicada). Só 1 (`etica_medica`) foi confirmada como atual sem ressalva. 3 não foram verificadas nesta rodada por escopo de tempo.

---

## TAREFA 4 — MATRIZ DE RISCO DOS 120 RECORTES

Classifiquei os 120 recortes (fonte: `auditoria_100_final.json` + `recortes_100_condensado.json` + `r101_r120.json`) por palavras-chave no texto real de `recorte`/`decisão`/`armadilha`, segundo os critérios do usuário (dose/duração/intervalo/corte/calendário/profilaxia/notificação/obrigação ética-legal/fluxo SUS/critério temporal/sequência protocolar/indicação-contraindicação = **GROUNDING OBRIGATÓRIO**). Resultado completo salvo em arquivo de trabalho (120 linhas) — aqui, o resumo e as divergências reais.

**Limitação honesta do método:** é um filtro por palavra-chave sobre o texto curto do "recorte", não uma revisão clínica especialista linha a linha das 120 decisões. Ele serve para **priorizar onde olhar**, não substitui validação humana — coerente com a Tarefa 6.

### Divergências de maior confiança (fonte diz `exige_grounding: false`, mas o conteúdo claramente pede grounding e **não existe diretriz correspondente cadastrada**)

| Rxxx | Matéria | Recorte | Por que é risco real |
|---|---|---|---|
| R017 | Pediatria | Icterícia neonatal — fototerapia por nomograma de bilirrubina/idade em horas | Decisão depende de nomograma numérico por horas de vida — sem diretriz `icterícia` cadastrada |
| R023 | Cirurgia | Diverticulite — Classificação de Hinchey | Estadiamento formal (Hinchey I–IV) — sem diretriz `diverticulite` cadastrada |
| R029 | Clínica Médica (já gerado, `SA_2026_2_Q6`) | TVP — Escore de Wells | Sistema de pontuação formal — sem diretriz `TVP`/`Wells` cadastrada |
| R036 | Ginecologia e Obstetrícia | Distocia de ombro — manobras sequenciais (McRoberts → pressão suprapúbica → manobras internas) | Sequência protocolar nomeada — sem diretriz `distocia`/obstetrícia de emergência cadastrada |
| R096 | Medicina Legal (já tentado, `PENDENTE-RECUPERAÇÃO`) | Violência doméstica — notificação compulsória | Já confirmado nesta sessão: obrigação legal sem diretriz cadastrada — causa raiz das 3 falhas |

### Divergência oposta (fonte diz `exige_grounding: true`, mas há mecanismo de cobertura — não é bloqueio real)

R008/R009 (Ética Médica — sigilo, consentimento) aparecem como "grounding-sensíveis" pela minha heurística (obrigação ética/legal), mas a diretriz `etica_medica` **já existe e cobre sigilo/consentimento diretamente** — risco baixo na prática, mesmo que o campo `exige_grounding` da fonte diga `false` para eles.

### Contagem geral (das 120, incluindo R101–R120)

- **48 recortes** tocam ao menos uma palavra-chave de grounding-obrigatório pelo meu filtro (dose/prazo/calendário/sequência protocolar/obrigação legal etc.) — inclui tanto os que já têm diretriz cadastrada quanto os que não têm.
- Recomendo tratar como **bloqueio real e imediato antes de gerar** apenas os 5 da tabela acima (grounding claramente necessário e **sem** fonte controlada hoje) — os demais já têm diretriz correspondente carregada (has/dm/sepse/asma/sifilis/hiv/tuberculose/vacinacao/prenatal/dengue/rastreamento_colo/etica_medica cobrem boa parte do restante).

---

## TAREFA 5 — AUDITORIA Q1–Q12

| # | Rxxx | Tema | Dose/prazo/corte/regra legal/protocolo? | Grounding usado | Fonte oficial usada | Atualidade confirmada | Revisão humana | Risco |
|---|---|---|---|---|---|---|---|---|
| Q1 | R034 | Hérnia — encarcerada vs. estrangulada | NÃO (decisão categórica por sinais clínicos) | Nenhum | — | N/A | NÃO | **BAIXO** |
| Q2 | R021 | Reanimação neonatal — sequência sala de parto | SIM (sequência protocolar; reanimação tem marcos temporais reais, ex. "minuto de ouro") | Nenhum | — | N/A | **SIM** | **MÉDIO** |
| Q3 | R030 | TEA — sinais de alerta | NÃO (puramente comportamental) | Nenhum | — | N/A | NÃO | **BAIXO** |
| Q4 | R010 | Comunicação de más notícias / erro médico | Regra ética, mas genérica (transparência) | Nenhum (diretriz `etica_medica` existe mas não foi auto-detectada por palavra-chave neste tema) | — | Confirmada atual (CFM 2.217/2018 vigente) mas não foi de fato injetada | **SIM** (gap de cobertura de keyword, não de conteúdo) | **BAIXO-MÉDIO** |
| Q5 | R015 | Sífilis — esquema de penicilina por estágio | **SIM** — dose/duração explícitas | **SIM** — diretriz `sifilis` (MS 2022) | PCDT-IST **atualizado em 07/2024** — versão citada tem ~2 anos de defasagem confirmada | **SIM** | **MÉDIO** |
| Q6 | R029 | TVP — Escore de Wells | SIM (sistema de pontuação formal) | Nenhum (sem diretriz `TVP` cadastrada) | — | N/A | **SIM** | **MÉDIO-ALTO** |
| Q7 | R025 | Gravidez ectópica — conduta por estabilidade | Critérios de elegibilidade (MTX) | Nenhum | — | N/A — resumo já foi rejeitado por número sem suporte (48, 50, 5000...); questão salva presumivelmente não continha os mesmos números, mas não confirmado por leitura humana | **SIM** | **MÉDIO** |
| Q8 | R035 | Hipercalemia grave — sequência terapêutica | SIM (cálcio antes de insulina/glicose — sequência protocolar, doses padrão) | Nenhum (sem diretriz `hipercalemia`/distúrbios hidroeletrolíticos) | — | N/A | **SIM** | **MÉDIO** |
| Q9 | R039 | DRGE — critérios de alarme | NÃO (conceitual: empírico vs. investigar) | Nenhum | — | N/A | NÃO | **BAIXO-MÉDIO** |
| Q10 | R031 | DII — Crohn vs. RCU, escalonamento | Escalonamento terapêutico (pode envolver biológicos específicos) | Nenhum | — | N/A | **SIM** | **MÉDIO** |
| Q11 | R084 | Atestado médico e sigilo no trabalho | Regra legal-trabalhista específica | Nenhum (`etica_medica` não cobre direito do trabalho especificamente) | — | N/A | **SIM** | **MÉDIO** |
| Q12 | R100 | Cuidados paliativos — elegibilidade e prognóstico | Conceitual, mas "comunicar prognóstico" pode tender a estimativas de sobrevida | Nenhum | — | N/A — resumo em revisão | **SIM** (leve) | **BAIXO-MÉDIO** |

**Padrão geral: das 12 questões já produzidas, só 1 (Q5) usou grounding formal — e essa mesma diretriz está com a fonte citada desatualizada.** As outras 11 foram aprovadas pelo validador (que bloqueia termo absoluto/percentual/fonte inventada) mas **sem qualquer diretriz controlada verificando o conteúdo clínico de fundo** — o validador impede invenção *explícita* de números/fontes, não confirma que a conduta descrita está clinicamente atualizada.

---

## TAREFA 6 — CONCLUSÃO HONESTA

**A. Hoje podemos afirmar que TODAS as questões usam diretrizes atuais? NÃO.** Apenas 1 de 12 questões usou grounding formal (Q5/sífilis), e essa mesma fonte está confirmadamente ~2 anos defasada. As outras 11 foram aprovadas sem nenhuma diretriz controlada de apoio.

**B. O sistema impede invenções? Em que nível?** Impede um nível específico e real: termo absoluto sem fonte, percentual/ano/fonte fabricados, pista estrutural na alternativa correta, número clínico que não bate com o texto de uma diretriz *quando ela está carregada*. **Não impede** — porque não tem como — que uma conduta INTEIRA (sem números/percentuais/anos explícitos) esteja desatualizada ou substituída por uma diretriz mais nova. O validador protege contra fabricação evidente, não contra desatualização silenciosa.

**C. O sistema garante atualização clínica? NÃO.** Nenhuma das 12 diretrizes é revalidada automaticamente contra a fonte oficial real — o campo `ano` é digitado manualmente e nunca comparado com a edição vigente. A prova está na Tarefa 3: 6 de 12 têm evidência concreta de estarem atrás da edição oficial atual.

**D. Lacunas que precisam ser corrigidas antes de escalar para 120:**
1. Diretriz `dm` desatualizada em ponto **clinicamente contraditório** (metformina não é mais exclusividade de 1ª linha desde jul/2025) — prioridade máxima de correção, já afeta qualquer recorte de DM ainda pendente (R047, etc.).
2. Diretriz `rastreamento_colo` desatualizada em **mudança de paradigma** (citologia → DNA-HPV) — prioridade alta, ainda não usada em produção (nenhuma questão de colo do útero gerada ainda), mas vai ser usada.
3. Diretriz `vacinacao` com esquema divergente confirmado (meningocócica ACWY) — prioridade alta, já é uma das mais usadas (calendário vacinal aparece em múltiplos recortes).
4. 5 recortes (R017, R023, R029 — já gerado, R036, R096 — já falhou) precisam de diretriz nova ou revisão humana antes de nova tentativa.
5. `has`, `sifilis`, `hiv` — atualizar citação para a edição vigente (2025/2024/2024), mesmo que o conteúdo central pareça estável, para eliminar a defasagem de citação.
6. `sepse`, `asma` — diretrizes de ciclo de revisão muito rápido (SSC, GINA) — precisam de processo de revisão periódica formal, não são "marque uma vez e esqueça".

**E. É seguro continuar a produção enquanto a auditoria acontece?**
- **Temas qualitativos estáveis** (ex.: R030/TEA, R039/DRGE, comunicação/ética sem regra numérica) — **SIM, seguro continuar.** Risco residual baixo, não dependem de precisão normativa.
- **Temas normativos/protocolares COM diretriz já carregada** (has, dm, sepse, asma, sifilis, vacinacao, hiv, tuberculose, dengue, prenatal, rastreamento_colo, etica_medica) — **seguro continuar gerando, mas com revisão humana obrigatória do conteúdo específico**, já que a fonte pode estar defasada mesmo com grounding formal ativo (caso confirmado: Q5/sífilis).
- **Temas com doses e números SEM diretriz correspondente** (os 5 da tabela de divergência: R017, R023, R029, R036, R096, e qualquer recorte futuro nessa categoria) — **NÃO seguro gerar sem correção prévia** — recomendo tratá-los como bloqueados até grounding mínimo existir, mesmo que o Mapa Mestre marque `exige_grounding: false`.

---

## TAREFA 7 — PLANO MÍNIMO DE CORREÇÃO (proposto, não implementado)

1. **Fontes oficiais prioritárias a atualizar** (ordem de urgência): `dm` (contradição clínica confirmada) → `rastreamento_colo` (mudança de paradigma) → `vacinacao` (esquema divergente) → `has`/`sifilis`/`hiv` (citação defasada, conteúdo a confirmar) → `sepse`/`asma` (ciclo de revisão rápido, monitorar).
2. **Mecanismo de versionamento:** cada entrada de `diretrizesControladas.js` ganha campos `data_ultima_revisao` (quando foi checada contra a fonte oficial, não quando foi escrita) e `revisado_por` (nome de quem confirmou), distintos do `ano` (ano da própria diretriz).
3. **Data de revisão periódica:** agenda mínima — diretrizes de ciclo anual conhecido (GINA, PNI) revisão a cada 6 meses; diretrizes de ciclo mais lento (CFM, INCA) revisão anual; gatilho adicional sempre que uma matéria tiver 3+ falhas de geração pelo mesmo motivo (como ocorreu com R096).
4. **Responsável pela validação:** definir explicitamente quem (o usuário, ou um médico revisor designado) assina a confirmação de atualidade — hoje ninguém formalmente confirma isso, é assumido implicitamente pelo ano no comentário do código.
5. **Bloqueio de geração quando grounding obrigatório estiver ausente:** hoje o sistema gera mesmo sem diretriz (só bloqueia números/termos específicos pós-geração). Proposta: quando um recorte cair na lista de "grounding obrigatório sem fonte disponível" (os 5 identificados + futuros), o RoboGerador deveria recusar a geração automaticamente, não confiar só na rejeição pós-hoc do SA-3/SA-4.
6. **Revisão periódica formal:** checklist trimestral simples — para cada diretriz ativa, uma busca de "houve atualização oficial?" e atualização do `data_ultima_revisao`.
7. **Tratamento de diretriz revogada/substituída:** quando uma nova edição for confirmada, a entrada antiga deve migrar para `historica: true` (campo já existe no schema, mas nunca foi usado) com um novo registro `ativa: true` substituindo-a, preservando `substitui: "<id_antigo>"` — o campo já existe no schema atual, só nunca foi exercitado na prática.

Nenhum destes 7 pontos foi implementado — são recomendações para autorização e execução futuras.
