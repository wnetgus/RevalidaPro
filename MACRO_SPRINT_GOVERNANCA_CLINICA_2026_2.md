# MACRO SPRINT — GOVERNANÇA CLÍNICA E ATUALIZAÇÃO DE DIRETRIZES 2026.2

**Fases concluídas:** FASE 1 (correção das diretrizes críticas existentes), FASE 2 (consolidação científica + cobertura dos recortes críticos) e FASE 3 (fechamento das lacunas documentais + pacote de validação humana). **Data:** 2026-07-24. **Referências:** `AUDITORIA_ATUALIZACAO_CLINICA_NORMATIVA_2026_2.md` (2d5eca0), `DOSSIER_VALIDACAO_DIRETRIZES_2026_2.md`, `MATRIZ_GROUNDING_R001_R120.md`, `PACOTE_VALIDACAO_HUMANA_DIRETRIZES_2026_2.md` (a3b8161/cda399f).

---

## FASE 3 — Fechamento das lacunas documentais e pacote de validação humana (2026-07-24)

**Documentos primários efetivamente lidos nesta fase (download + extração de texto real, não resumo de busca):** `has` (154 pág., Arq Bras Cardiol 2025;122(9):e20250624), `rastreamento_colo` (98 pág., INCA/MS 3ª edição 2025), `hiv`/PEP (49 pág., Portaria SECTICS/MS nº 14/2024), `hiv`/PrEP (78 pág., edição 2025), `vacinacao` (bloco dTpa, dentro dos 58 pág. já extraídos na Fase 2).

**Achado crítico de auditoria (transparência obrigatória):** a primeira tentativa de obter a fonte primária de `has` baixou por engano um PDF do site da SBH que se revelou ser a **7ª Diretriz original de 2016**, não a edição 2024/2025 — identificado pelo próprio conteúdo do documento (cabeçalho "Setembro 2016") antes de qualquer uso, e descartado. A fonte correta foi localizada e lida em seguida.

**Documentos localizados mas NÃO lidos na íntegra (só busca/resumo):** `diverticulite` (artigo WSES 2020, localizado com DOI/link real), `tvp_wells` (escore original + uso CHEST/ACCP), `distocia_ombro` (FEBRASGO 2023 — download falhou tecnicamente duas sessões seguidas), `ictericia_neonatal` (SBP Manual nº 20/2023), `violencia_domestica` (Lei 13.931/2019 — trecho citado literalmente via busca; tentativa de WebFetch direto ao planalto.gov.br falhou por reset de conexão).

**Mudanças clínicas confirmadas por leitura direta nesta fase:**
- `has`: reclassificação de estágios de PA (antigo "Estágio 1" 130-139/80-89 agora é "Pré-hipertensão"); tratamento gestacional corrigido.
- `rastreamento_colo`: regras de histerectomia (Rec. 34/35) e mulher sem atividade sexual (Rec. 36) confirmadas por número de recomendação.
- `vacinacao`: dTpa gestante a partir da 20ª semana (limite de 36 semanas da versão antiga não confirmado), + puérpera + profissional de saúde.
- `hiv`: PEP confirmado estável; PrEP tem modalidade sob demanda nova.
- `violencia_domestica`: prazo de 24h e destinatário "autoridade policial" confirmados por citação literal de lei.

**Divergências ainda abertas:** `diverticulite` × R111 (antibiótico de rotina em quadro leve — não resolvido, documento primário não lido); `has` (emergência/urgência/DRC/DM/DCV não relidos); `rastreamento_colo` (fluxo de citologia reflexa, conduta sem DNA-HPV); `hiv` (diagnóstico, gestação, coinfecções, acompanhamento, falha terapêutica — módulos não lidos); `tvp_wells`, `distocia_ombro`, `ictericia_neonatal` (sem progresso adicional nesta fase).

**Reauditoria dos 55 recortes "liberáveis"** (ver `MATRIZ_GROUNDING_R001_R120.md`): releitura manual (não por palavra-chave) reclassificou em **15 LIBERÁVEL QUALITATIVO, 22 GROUNDING RECOMENDADO, 14 GROUNDING OBRIGATÓRIO, 4 PENDENTE DE DECISÃO HUMANA**. Achado principal: **R036** estava mal classificado como liberável na matriz automática da Fase 2 (classificador tratou "manobras sequenciais" como categórico sem checar a diretriz `distocia_ombro` já criada) — **o código real já bloqueia esse tema corretamente**, confirmado por teste automatizado (caso 34).

**Quantidade final realmente liberável (sem nenhuma ressalva) dos 55 originais: 15 (27%).**

**Pacote de validação humana:** `PACOTE_VALIDACAO_HUMANA_DIRETRIZES_2026_2.md` — ficha objetiva para as 11 diretrizes + 4 módulos de HIV, todos os campos de decisão (VALIDADO POR/DATA/DECISÃO/OBSERVAÇÕES) vazios.

**Status documental sugerido (nenhum aplicado automaticamente — só recomendação no pacote):** `dm`, `hiv`/TARV, `hiv`/PEP, `sifilis` = `PRONTA_PARA_VALIDACAO_HUMANA`; demais 8 (incluindo `hiv`/PrEP e os outros módulos de HIV) = `PENDENTE_AJUSTE`.

**Testes:** 12 casos novos (24-35) somados aos 23 anteriores — **35/35 passam**. Build PASS. Lint: 0 erros. **Distinção de tipo de verificação:** os 35 casos são um script Node manual (`scripts/test-diretrizes-governanca.js`, sem framework de teste instalado no projeto) que valida as funções puras de `diretrizesControladas.js` — não são "testes integrados à aplicação" no sentido de testar `RoboGerador.jsx` renderizado (não há framework de UI/DOM testing instalado); o build (`vite build`) e o lint (`eslint`) são as únicas verificações de regressão de aplicação real disponíveis neste projeto.

**Commits Fase 3:** `a3b8161` (código: diretrizes atualizadas + 12 testes), `cda399f` (documentação: pacote de validação).

**Nenhuma diretriz foi promovida a `VIGENTE_CONFIRMADA` nesta fase** — confirmado pelo teste 35.

**Percentual estimado de conclusão da Macro Sprint: ~55%.** Concluído: schema + bloqueio (Fase 1); 6 diretrizes existentes + 5 novas propostas com fonte real (Fase 2); leitura de fonte primária real para `has`/`rastreamento_colo`/`hiv`(PEP+PrEP)/`vacinacao`(parcial), reauditoria dos 55 recortes, pacote de validação humana (Fase 3). Pendente: confirmação humana nomeada de todas as entradas; leitura dos documentos primários ainda não obtidos (`diverticulite`, `tvp_wells`, `distocia_ombro`, `ictericia_neonatal`, texto integral de `violencia_domestica`, blocos restantes de `has`/`rastreamento_colo`/`vacinacao`/`hiv`); desenvolvimento dos blocos populacionais faltantes de `violencia_domestica` (criança/adolescente, pessoa idosa, pessoa com deficiência, violência sexual, risco iminente); revisão de Q1–Q12; retomada de produção.

---

## FASE 2 — Consolidação científica e cobertura dos recortes críticos (2026-07-24)

**Objetivo:** construir a base científica auditável para validação humana futura, e criar (como propostas, não vigentes) as 5 diretrizes que faltavam para R017/R023/R029/R036/R096.

**Método de pesquisa real (não busca superficial):** para `dm`, `sifilis`, `hiv` e `vacinacao`, o **texto integral do documento oficial foi baixado e extraído** (PDF→texto real via `pdf-parse`, 58 a 118 páginas cada) — as correções de conteúdo vêm de citação direta do documento primário, não de resumo de busca. Para `has`, `rastreamento_colo` e as 5 diretrizes novas, a base é busca web verificada (título/órgão/data confirmados), sem leitura do PDF completo — confiança marcada explicitamente em cada dossiê (ver `DOSSIER_VALIDACAO_DIRETRIZES_2026_2.md`).

**Achados por leitura direta do documento primário:**
- `dm`: confirmada a citação exata da SBD Ed.2025 — metformina 1ª linha só quando risco CV baixo/intermediário + sem doença cardiorrenal + sem obesidade + HbA1c <7,5% (Classe I, Nível B). Corrige e confirma a correção já feita na Fase 1.
- `sifilis`: **conteúdo confirmado ESTÁVEL** — o esquema de penicilina benzatina por estágio no PCDT-IST 2024 é idêntico ao já cadastrado desde 2022. Só a citação estava defasada.
- `hiv`: **conteúdo confirmado ESTÁVEL** — esquema de 1ª linha (tenofovir+lamivudina+dolutegravir) e "Tratar Todos" idênticos ao já cadastrado. PEP/PrEP não relidos nesta sessão.
- `vacinacao`: confirmado por citação exata do PDF — esquema básico de Men C (3 e 5 meses) inalterado; **só o reforço aos 12 meses muda para Men ACWY**. Demais blocos do calendário (BCG, Penta, VIP/VOP etc.) não relidos.

**5 diretrizes novas propostas** (nenhuma vigente — todas `PENDENTE_REVISAO`, cobrindo exatamente os recortes identificados na Fase 1):
- `ictericia_neonatal` (R017) — SBP Manual nº 20/2023, escopo estritamente neonatal.
- `diverticulite` (R023/R111) — Classificação de Hinchey + WSES 2020, **confiança reduzida** (só fonte secundária) e **conflito interno não resolvido** registrado explicitamente (posologia de antibiótico vs. R111 já indicar que pode não ser necessário).
- `tvp_wells` (R029) — Escore de Wells, com limitação explícita de nunca ser diagnóstico isolado.
- `distocia_ombro` (R036) — FEBRASGO Guia de Habilidades 25/03/2023, sequência McRoberts→Rubin I→Gaskin.
- `violencia_domestica` (R096) — separa explicitamente notificação compulsória (Lei 13.931/2019) de denúncia policial e de Lei Maria da Penha — resolve a causa raiz das 3 falhas de geração da Fase 1.

**Matriz R001-R120** (`MATRIZ_GROUNDING_R001_R120.md`): todos os 120 recortes lidos e classificados. **55 podem gerar agora** (sem bloqueio automático conhecido); **65 bloqueados** (grounding obrigatório sem diretriz vigente, incluindo os 5 novos temas + as 6 diretrizes antigas ainda pendentes). 4 linhas (R002/R003/R019/R024) foram corrigidas manualmente para refletir falhas reais já observadas em produção, sobrepondo a classificação automática — limitação de método registrada explicitamente no documento.

**Novo campo `statusDocumental`** (`PRONTA_PARA_VALIDACAO_HUMANA` / `PENDENTE_AJUSTE`) adicionado às 11 diretrizes — paralelo ao `status` de execução (que continua sendo o único que bloqueia geração), não o substitui.

**Testes:** 13 casos novos (11-23) somados aos 10 da Fase 1 — **23/23 passam**. Build PASS (743 módulos). Lint: 0 erros.

**Commits Fase 2:** `a9e4d3c` (código: 5 diretrizes novas + 13 testes), `1c131f6` (documentação: dossiê + matriz).

**Nenhuma diretriz foi promovida a `VIGENTE_CONFIRMADA` nesta fase** — todos os campos `VALIDADO POR`/`DATA DA VALIDAÇÃO`/`DECISÃO`/`OBSERVAÇÕES DO RESPONSÁVEL` permanecem vazios em `DOSSIER_VALIDACAO_DIRETRIZES_2026_2.md`, aguardando revisor nomeado.

**Perguntas que dependem de validação humana (resumo — ficha completa no dossiê):**
1. As classes de 1ª linha por comorbidade e agentes IV de emergência de `has` mudaram entre 2024→2025?
2. O fluxo de citologia (ASC-US/LSIL/HSIL) de `rastreamento_colo` ainda se aplica em algum cenário de transição? Conduta se DNA-HPV indisponível?
3. Os demais blocos do calendário vacinal (além do meningocócico) mudaram na IN 2026?
4. As seções de PEP/PrEP de `hiv` mudaram no módulo 2024?
5. `diverticulite`: antibiótico de rotina em quadro leve ainda é recomendado, ou R111 (Mapa Mestre) está correto ao dizer que não? (conflito interno não resolvido)
6. `tvp_wells` e `distocia_ombro`: confirmar contra os documentos primários (CHEST/ACCP e FEBRASGO PDF completo, respectivamente) — não lidos nesta sessão.
7. `violencia_domestica`: qual o prazo real de notificação (se houver) segundo o texto integral da Lei 13.931/2019 — não incluído até confirmação.

**Percentual estimado de conclusão da Macro Sprint: ~40%.** Concluído: schema + bloqueio (Fase 1), 6 diretrizes existentes trazidas a PENDENTE_REVISAO com fonte oficial real e 4 delas com texto primário integralmente lido, 5 diretrizes novas propostas com o mesmo padrão, matriz completa dos 120 recortes, 23 testes. Pendente: confirmação humana nomeada de todas as 11, resolução do conflito `diverticulite`/R111, leitura dos documentos primários ainda não obtidos (`has`, `rastreamento_colo`, `tvp_wells`, `distocia_ombro`, `violencia_domestica` na íntegra), revisão de Q1–Q12, retomada de produção.

---

## Problema encontrado

Auditoria anterior (`2d5eca0`) confirmou por busca externa real que, de 12 diretrizes cadastradas em `diretrizesControladas.js`, **6 tinham evidência concreta de estarem desatualizadas** frente à fonte oficial vigente — 3 com contradição/mudança de conteúdo clínico confirmada (dm, rastreamento_colo, vacinacao), 3 com citação de versão defasada (has, sifilis, hiv). O sistema não tinha nenhum mecanismo para detectar isso: o único controle de atualidade era o campo `ano`, digitado manualmente e nunca revalidado contra a fonte real.

## Risco científico

Questões geradas citando uma diretriz desatualizada podem ensinar conduta clínica **incorreta ou substituída** com a aparência de estar corretamente fundamentada (grounding formal presente, validador SA-3/SA-4 satisfeito) — o pior tipo de erro, porque parece mais confiável do que uma questão sem grounding nenhum.

## Decisão arquitetural

Evolução aditiva e retrocompatível do schema de `diretrizesControladas.js`: novos campos de governança (status, versão, fonte oficial, data de revisão, revisor) em cada entrada, sem renomear/remover nenhum campo existente — os 3 outros consumidores do módulo (`ImportadorPro.jsx`, `ResumoGerador.jsx`, `PainelDiretrizes.jsx`, nenhum deles tocado nesta sprint) continuam funcionando sem alteração. Ausência do campo `status` é tratada como `VIGENTE_CONFIRMADA` — zero regressão para as diretrizes ainda não auditadas.

Um novo mecanismo de bloqueio (`avaliarBloqueioDiretriz`) detecta quando um tema corresponde a uma diretriz cadastrada mas não vigente, e barra a geração **antes** de qualquer chamada à IA — em vez do comportamento anterior, que simplesmente cairia para "gerar sem grounding" (mais permissivo, não mais seguro).

## Schema (campos adicionados, todos opcionais)

```
titulo, orgao, urlOficial, versao, anoPublicacao,
dataUltimaRevisao, revisadoPor, status,
validadeOuProximaRevisao, observacoes, temasRelacionados
```

Status possíveis: `VIGENTE_CONFIRMADA` (implícito quando ausente) · `PENDENTE_REVISAO` · `DESATUALIZADA` · `SUBSTITUIDA` · `BLOQUEADA`.

## Fontes oficiais verificadas (Tarefa 2 — URLs reais, não blog/cursinho)

| id | Fonte/edição vigente confirmada | URL oficial |
|---|---|---|
| `dm` | Diretriz SBD — Edição 2025 | https://diretriz.diabetes.org.br/manejo-da-terapia-antidiabetica-no-dm2-2/ |
| `rastreamento_colo` | Diretrizes Brasileiras Rastreamento Colo do Útero — Vol. 1 (DNA-HPV), Portaria SAES/SECTICS nº 13/2025, 18/08/2025 | https://www.gov.br/conitec/pt-br/midias/protocolos/diretrizes/diretriz-brasileira-rastreamento-do-cancer-do-colo-do-utero-diretriz-brasileira |
| `vacinacao` | Instrução Normativa Calendário Nacional de Vacinação 2026 | https://www.gov.br/saude/pt-br/vacinacao/publicacoes/instrucao-normativa-que-instrui-o-calendario-nacional-de-vacinacao-2026.pdf |
| `has` | Diretriz Brasileira de Hipertensão Arterial 2025, Arq Bras Cardiol. 2025;122(9):e20250624 | https://abccardiol.org/en/article/brazilian-guidelines-of-hypertension-2025/ |
| `sifilis` | PCDT IST — atualização 04/07/2024 | https://www.gov.br/saude/pt-br/assuntos/pcdt/a/atencao-integral-as-pessoas-com-infeccoes-sexualmente-transmissiveis/view |
| `hiv` | PCDT HIV Adultos — Módulo I: Tratamento, 2024 | https://www.gov.br/aids/pt-br/central-de-conteudo/pcdts/pcdt_hiv_modulo_1_2024.pdf |

Nenhuma fonte de blog, cursinho, página comercial ou texto de IA foi usada — todas as 6 são documento oficial do órgão emissor real (MS/CONITEC/INCA/PNI/sociedade médica reconhecida).

## Diretrizes atualizadas — mudanças de conteúdo confirmadas vs. só citação defasada

- **Confirmadas com mudança clínica real** (pontosCriticos corrigidos nesta sprint): `dm` (metformina deixou de ser 1ª linha universal — agora condicional a perfil de risco CV/renal/IMC/HbA1c), `rastreamento_colo` (DNA-HPV substitui citologia como método primário, intervalo de 5 anos), `vacinacao` (reforço aos 12 meses passa a ser meningocócica ACWY).
- **Só citação/versão defasada, conteúdo não comparado linha a linha** (pontosCriticos preservados, metadados atualizados): `has`, `sifilis`, `hiv`.
- **Todas as 6 marcadas `PENDENTE_REVISAO`** — nenhuma foi promovida a `VIGENTE_CONFIRMADA` nesta sessão, porque "revisor" é definido como pessoa nomeada, não a IA lendo resumos de busca.

## Regras de bloqueio implementadas

- `detectarDiretrizDinamica`/`detectarDiretriz`: só retornam diretrizes com status utilizável (`undefined` ou `VIGENTE_CONFIRMADA`).
- `avaliarBloqueioDiretriz(lista, temaMestre, subtema)`: nova função — encontra o melhor candidato por palavra-chave **ignorando status**; se o melhor candidato existe mas não está vigente, retorna `{ bloqueado: true, diretriz, motivo }`.
- `RoboGerador.jsx` (fluxo ABCD/Super Apostas 2026.2, único fluxo alterado): chama `avaliarBloqueioDiretriz` antes de montar o prompt; se bloqueado, loga o motivo, marca o tema como falho e pula para o próximo — **0 chamadas à IA**, mesmo padrão do pré-check de recorte (`recortesStatusSA.js`) já existente.
- Comportamento para tema sem nenhuma diretriz correspondente: inalterado (gera sem grounding, como sempre).

## Testes (10/10 aprovados)

`node scripts/test-diretrizes-governanca.js` — script Node puro (`assert`), sem framework novo (projeto não tinha vitest/jest instalado; adicionar um seria mais arquitetura do que o necessário para validar funções de configuração). Cobre exatamente os 10 casos exigidos: VIGENTE carregada, DESATUALIZADA/SUBSTITUIDA/PENDENTE_REVISAO/BLOQUEADA bloqueadas, grounding obrigatório sem diretriz vigente não chama IA, tema sem diretriz continua funcionando, metadados chegam ao bloco injetado, as 6 diretrizes auditadas estão PENDENTE_REVISAO (não vigentes só por existirem no arquivo), e as 6 diretrizes não tocadas preservam compatibilidade total.

```
10/10 testes passaram.
```

## Build e lint

`npx vite build --mode production` → **PASS** (743 módulos, 6s, sem erro novo). `npx eslint src/config/diretrizesControladas.js src/components/RoboGerador.jsx` → 0 erros, 1 warning pré-existente (`react-hooks/exhaustive-deps`, já registrado em sessão anterior, não relacionado a esta mudança). Bundle inspecionado: 0 `DIAGNÓSTICO DEV`, 0 `revalidapro-dev`.

## Commit

`9fd5da295c73087058e5b77f92880d7d9fd86401` — `feat(diretrizes): add clinical governance schema and status-based blocking`. Arquivos: `src/config/diretrizesControladas.js`, `src/components/RoboGerador.jsx`, `scripts/test-diretrizes-governanca.js`.

## Limitações restantes (honestas)

1. **`has`, `sifilis`, `hiv`**: só a citação/versão foi corrigida — ninguém confirmou linha a linha se `pontosCriticos` precisa de ajuste de conteúdo. Ficam bloqueadas até essa leitura acontecer.
2. **`sepse`, `asma`, `tuberculose`, `dengue`, `etica_medica`, `prenatal`**: não auditadas nesta rodada — continuam com o comportamento de sempre (tratadas como vigentes por ausência de `status`), mas isso é uma lacuna de cobertura, não uma confirmação de que estão corretas.
3. **`calcularStatusAtualizacao` em `promptEngine.js`** (linha ~30): threshold hardcoded `ano_diretriz >= 2024 → "atual"` é um mecanismo SEPARADO e mais antigo, usado para etiquetar QUESTÕES salvas (não diretrizes) — não foi tocado nesta sprint; pode ficar dessincronizado do novo schema de status das diretrizes. Candidato a unificação futura.
4. **Bloqueio só cobre o fluxo ABCD (Super Apostas 2026.2)** em `RoboGerador.jsx` — o caminho legado (2026.1, não-ABCD) e os outros 3 consumidores (`ImportadorPro.jsx`, `ResumoGerador.jsx`, `PainelDiretrizes.jsx`) se beneficiam indiretamente de `detectarDiretrizDinamica` não retornar mais as 6 diretrizes PENDENTE_REVISAO, mas **não têm** o log explícito de bloqueio pré-chamada (eles simplesmente cairiam para "gerar sem grounding", silenciosamente) — considerar estender o padrão explícito a esses fluxos numa fase futura, fora do escopo desta sprint.
5. **As 5 diretrizes faltantes** (R017 icterícia, R023 diverticulite/Hinchey, R029 TVP/Wells, R036 distocia de ombro, R096 violência doméstica) — Fase 2, não iniciada.
6. Nenhuma das 6 diretrizes prioritárias foi lida na íntegra (PDF completo) nesta sessão — a correção partiu de resumos de busca web, não do documento primário completo. Isso é suficiente para justificar `PENDENTE_REVISAO`, não `VIGENTE_CONFIRMADA`.

## Próximos passos

- Revisor nomeado lê os documentos primários das 6 diretrizes na íntegra e promove cada uma para `VIGENTE_CONFIRMADA` (ou `DESATUALIZADA`/ajusta `pontosCriticos`) individualmente.
- Fase 2: criar as 5 diretrizes faltantes (R017/R023/R029/R036/R096).
- Revisão completa dos 120 recortes (matriz de risco só teve triagem heurística nesta rodada).
- Revisão de Q1–Q12 já produzidas (aguardando, não descartadas).
- Considerar estender `avaliarBloqueioDiretriz` a `ImportadorPro.jsx`/`ResumoGerador.jsx` (fora do escopo desta sprint).

## Percentual estimado de conclusão da Macro Sprint

**~15%.** Concluído: schema de governança + mecanismo de bloqueio + 6 diretrizes prioritárias trazidas a `PENDENTE_REVISAO` com fonte oficial real (não `VIGENTE_CONFIRMADA` — ainda falta revisão humana nomeada). Pendente: confirmação humana das 6, Fase 2 (5 diretrizes novas), revisão dos 120 recortes, revisão de Q1–Q12.

---

## MACRO REVIEW — Auditoria Arquitetural (2026-07-24, pós-Fase 3)

Ver documento completo: `MACRO_REVIEW_GOVERNANCA_CLINICA_2026_2.md`.

**Achado que reclassifica a limitação nº 4 acima (Fase 1):** o que estava descrito como "os outros consumidores se beneficiam indiretamente, sem log explícito" é **mais grave do que registrado na época**. Confirmado por leitura de código: `RoboGerador.jsx`, `ResumoGerador.jsx` e `ImportadorPro.jsx` carregam diretrizes do Firestore (`collection(db, "diretrizes")`) **preferencialmente à lista estática**, e a função `semearBase()` (`PainelDiretrizes.jsx`) que já semeou/semeia essa coleção **nunca escreveu os campos novos de governança** (`status`, `statusDocumental`, `statusModulos` etc.) — apenas o schema legado (`tema_id, tema, versao, fonte, ano, ativa, historica, substitui, palavrasChave, pontosCriticos`). Como a ausência do campo `status` é tratada como "vigente" (`_statusUtilizavel`), **se a coleção Firestore de produção estiver populada, todo o mecanismo de bloqueio construído nas Fases 1–3 pode estar inerte** — os 35 testes automatizados não detectam isso porque testam exclusivamente a lista estática, nunca o formato de documento que realmente chega via Firestore. Classificado como **CRÍTICO** na Macro Review (achado C1) — primeira correção recomendada da Fase 4A, ainda **não verificada empiricamente contra o Firestore real** (zero acesso ao Firestore nesta auditoria, por restrição) e **não corrigida** (auditoria é read-only).

**Percentual revisado após a Macro Review: ~55%** (trabalho de conteúdo/documentação inalterado; a Macro Review não fecha lacunas documentais, apenas as mapeia com mais precisão e adiciona a Fase 4A como pré-requisito antes de deploy/retomada em escala).
