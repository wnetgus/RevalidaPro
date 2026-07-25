# CHECKPOINT OFICIAL — MACRO SPRINT GOVERNANÇA CLÍNICA 2026.2 (pausa pós-Macro Review)

**Data:** 2026-07-24
**Sessão:** Fases 1, 2, 3 da Macro Sprint de Governança Clínica + Macro Review arquitetural
**Status:** REPOUSO — pausa formal autorizada, aguardando autorização explícita para Fase 4A

---

## 1. BASELINE NO MOMENTO DA PAUSA

| Item | Valor |
|---|---|
| Branch | `main` |
| HEAD | `262e335` |
| Build | PASS |
| Lint | 0 erros novos (3 erros + 1 warning pré-existentes, não relacionados) |
| Verificações manuais de governança (`scripts/test-diretrizes-governanca.js`) | 35/35 |
| Código de produção alterado na Macro Review | **NÃO** — auditoria 100% read-only |
| Deploy nesta fase | **ZERO** |
| Alteração no Firestore nesta fase | **ZERO** |
| Chamada à API Anthropic nesta fase | **ZERO** |
| Produção (geração em massa) | **PAUSADA** |
| Q1–Q12 | Ainda não revisadas |
| R096 | Permanece `PENDENTE — RECUPERAÇÃO` |
| Diretrizes promovidas a `VIGENTE_CONFIRMADA` | **Nenhuma** (17 entradas, todas `PENDENTE_REVISAO`) |
| Percentual estimado da Macro Sprint | **~55%** |

---

## 2. REGRA OBRIGATÓRIA DE PRIORIDADE DE FONTES (registrada nesta pausa)

O projeto deve trabalhar **prioritariamente** com diretrizes, protocolos, normas e condutas **brasileiras**, compatíveis com:

- Revalida INEP;
- ENAMED;
- SUS;
- Ministério da Saúde;
- CONITEC;
- PCDT;
- INCA;
- PNI;
- Anvisa;
- CFM;
- legislação brasileira;
- sociedades médicas brasileiras reconhecidas.

**Diretrizes internacionais** (ex.: GINA, Surviving Sepsis Campaign, WSES, CHEST/ACCP) só podem ser usadas como **complemento, comparação, ou preenchimento de lacuna explícita** quando não existe equivalente brasileiro adequado — nunca para substituir silenciosamente a orientação brasileira, e nunca priorizadas sobre a prática exigida pelo SUS/Revalida/ENAMED sem decisão humana documentada. Esta regra já vem sendo seguida na prática (ex.: `sepse` e `asma` usam fonte internacional citada explicitamente como tal, `has`/`dm`/`rastreamento_colo`/`vacinacao`/`sifilis`/`hiv` usam fonte brasileira como principal) — este checkpoint a formaliza como diretriz permanente do projeto daqui em diante.

---

## 3. ACHADO CRÍTICO C1 (bloqueante para retomada/deploy)

O sistema (`RoboGerador.jsx`, `ResumoGerador.jsx`, `ImportadorPro.jsx`) carrega diretrizes **preferencialmente do Firestore** (coleção `diretrizes`), caindo para a lista estática `DIRETRIZES_CONTROLADAS` somente quando a coleção está vazia ou inacessível.

A função `semearBase()` (`PainelDiretrizes.jsx`), único caminho que já escreveu/escreveria essa coleção, **nunca gravou os novos campos de governança** introduzidos nas Fases 1–3: `status`, `statusDocumental`, `statusModulos`, e os demais metadados novos (`titulo`, `orgao`, `urlOficial`, `dataUltimaRevisao`, `revisadoPor`, `validadeOuProximaRevisao`, `observacoes`, `temasRelacionados`).

Como a ausência do campo `status` é tratada como conteúdo vigente (`_statusUtilizavel`), existe o risco de que o Firestore de produção esteja **anulando silenciosamente** o bloqueio científico construído nas Fases 1–3.

**Este risco ainda não foi verificado empiricamente** — zero acesso ao Firestore de produção nesta sessão, por restrição explícita.

### Consequência formal desta pausa

- Retomada da produção (15 recortes qualitativos): **NO-GO**.
- Deploy: **NO-GO**.
- Geração de qualquer recorte: **NO-GO** até confirmação empírica do estado real do Firestore.
- Próxima prioridade, quando houver autorização: **Fase 4A**.

---

## 4. OUTROS ACHADOS IMPORTANTES DA MACRO REVIEW (registro de referência)

1. Apenas o fluxo ABCD de `RoboGerador.jsx` chama `avaliarBloqueioDiretriz`.
2. Fluxos sem pré-bloqueio: formato legado A–E (mesmo arquivo), `ImportadorPro.jsx`, `ResumoGerador.jsx`, `src/utils/resumoEngine.js`.
3. Falha científica ainda não é totalmente fail-closed: ausência de `status` libera geração em vez de bloquear.
4. Duplicação clínica divergente confirmada: esquema de dTpa gestacional tem texto diferente em `prenatal.pontosCriticos` vs. `vacinacao.pontosCriticos`.
5. Os 35 testes atuais são scripts manuais de governança (não testes de integração), e nenhum simula o formato real de documento vindo do Firestore — mascaram o Achado C1.
6. Rastreabilidade da questão ainda insuficiente: só `fonte_diretriz`/`ano_diretriz` são gravados; nenhum `evidenceId` usado.
7. Fatos clínicos (`pontosCriticos`) ainda não são unidades atômicas — itens frequentemente misturam múltiplos fatos.

Detalhamento completo de todos os achados (C1–C9, classificados CRÍTICO a MELHORIA FUTURA): `MACRO_REVIEW_GOVERNANCA_CLINICA_2026_2.md`, seção 15.

---

## 5. PRÓXIMA ETAPA PREVISTA — FASE 4A (só mediante autorização futura)

Quando autorizada, a Fase 4A deverá tratar, nesta ordem de prioridade:

1. Verificar empiricamente o conteúdo real da coleção `diretrizes` no Firestore de produção.
2. Não alterar dados durante a primeira inspeção (leitura pura).
3. Corrigir o comportamento permissivo de `status` ausente.
4. Garantir fail-closed de fato (não apenas quando o campo está presente).
5. Planejar migração segura do schema de governança para os documentos já existentes no Firestore.
6. Estender o bloqueio (`avaliarBloqueioDiretriz`) aos demais consumidores (legado A–E, `ImportadorPro.jsx`, `ResumoGerador.jsx`, `resumoEngine.js`).
7. Resolver a divergência de dTpa entre `prenatal` e `vacinacao`.
8. Criar testes que simulem documentos reais no formato Firestore (sem campo `status`).
9. Não gerar questões.
10. Não retomar produção.
11. Não fazer deploy antes de nova auditoria e autorização explícita.

---

## 6. DOCUMENTOS DE REFERÊNCIA

- `AUDITORIA_ATUALIZACAO_CLINICA_NORMATIVA_2026_2.md`
- `MACRO_SPRINT_GOVERNANCA_CLINICA_2026_2.md`
- `CONTROLE_PRODUCAO_SUPERAPOSTAS_2026_2.md`
- `DOSSIER_VALIDACAO_DIRETRIZES_2026_2.md`
- `MATRIZ_GROUNDING_R001_R120.md`
- `PACOTE_VALIDACAO_HUMANA_DIRETRIZES_2026_2.md`
- `MACRO_REVIEW_GOVERNANCA_CLINICA_2026_2.md`

## 7. COMMITS DE REFERÊNCIA (Macro Sprint completa, Fases 1–3 + Macro Review)

- `9fd5da2` — Fase 1: schema de governança clínica + bloqueio baseado em status
- `e47f99e` — Fase 1: documentação, pausa da produção em massa
- `a9e4d3c` — Fase 2: 5 novas diretrizes propostas + 13 testes
- `1c131f6` — Fase 2: dossiê científico + matriz de grounding R001-R120
- `b7c7ca1` — Fase 2: registro de conclusão
- `a3b8161` — Fase 3: fechamento de lacunas documentais com leitura de fonte primária
- `cda399f` — Fase 3: pacote de validação humana
- `239098a` — Fase 3: registro de fechamento em todos os documentos
- `262e335` — Macro Review: auditoria arquitetural da governança

---

## 8. ESTADO FINAL

**REPOUSO.** Nenhuma ação além de documentação foi executada nesta pausa. Aguardando autorização explícita para iniciar a Fase 4A.
