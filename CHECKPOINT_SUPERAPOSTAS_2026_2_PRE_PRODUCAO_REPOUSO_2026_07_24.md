# CHECKPOINT — Super Apostas 2026.2 — Pré-Produção — Repouso (2026-07-24)

Este documento é o ponto de retomada oficial. Se você está voltando a este trabalho depois de uma pausa, leia este arquivo inteiro antes de tocar em qualquer código.

---

## 1. Estado confirmado no momento deste checkpoint

- **Branch:** `main`
- **HEAD antes deste checkpoint:** `8d6ff93b5379dbc9ae82c5b13fab9d545ee27373` — "docs(superapostas): freeze 2026.2 engine and add production control"
- **Working tree:** MISTURADO — contém alterações de Super Apostas 2026.2, ImportadorPro/INEP, e outras features não relacionadas, além de artefatos/untracked. Não foi (e não deve ser) commitado em bloco.

## 2. Engine Super Apostas 2026.2 — HOMOLOGADA NO DEV

Evidências reais (ambiente `revalidapro-dev`):

**SA_2026_2_Q24** — R034 (Hérnia da parede abdominal — encarcerada vs. estrangulada)
- Questão aprovada, Haiku, 1 chamada, salva no DEV.
- Conta como candidata válida para as 120.
- Resumo do Tema (`Hérnia da parede abdominal--idoso`): REJEITADO após 2 tentativas Haiku (retry corretivo usado) → status REVISÃO.

**SA_2026_2_Q25** — R002 (Crise hipertensiva — urgência vs. emergência e conduta imediata)
- Questão aprovada, Haiku, 1 chamada, salva no DEV.
- Conta como candidata válida para as 120.
- Resumo do Tema (`Hipertensão arterial sistêmica--emergência`): REJEITADO POR GROUNDING (números 180/190/110/95 não presentes na fonte) → status REVISÃO.

**R041** (HIV — PrEP/PEP)
- REVISÃO HUMANA — GROUNDING INSUFICIENTE.
- Não conta atualmente para as 120.
- `SA_2026_2_Q24` foi o ID previsto nessa tentativa mas NÃO foi consumido (número livre).

**R003** (DM tipo 2 — 2ª droga por perfil cardiorrenal)
- NÃO gerado. Permanece pendente.
- Só deve ser usado depois da promoção/validação do ambiente oficial, salvo nova decisão explícita.

Também validados nesta engine ao longo da sessão: formato ABCD 2026.2; isolamento do fluxo 2026.1/INEP; Haiku primário/Opus fallback; teto de chamadas (3 para questão, 2 para resumo); retry com feedback específico; distinção candidata-rejeitada × recorte-bloqueado (hotfixes R034 e R002); grounding e suporte numérico estrito; números reutilizados do caso clínico; tokens alfanuméricos (3TC/CD4/H1N1); anti-pista estrutural (SA-1); modo conservador sem grounding (SA-3/SA-4); Estratégia da Aposta; Resumo do Tema + retry do resumo; dedup de resumo; logs/diagnóstico DEV; modo 1 questão por recorte; controle de custo.

## 3. Regra DEV → PRODUÇÃO (decisão operacional oficial)

**DEV = homologação da engine. PRODUÇÃO = criação oficial do banco Super Apostas 2026.2.**

NÃO está decidido gerar as 120 questões no DEV para depois migrar. Plano vigente:
1. Fechar auditoria pré-produção.
2. Organizar working tree.
3. Promover somente código homologado.
4. Smoke test em produção.
5. Gerar UMA questão oficial controlada.
6. Validar E2E real.
7. Só depois liberar produção R001–R120.

Dados DEV (Q23/Q24/Q25 e `teorias`/`resumos_temas` gerados no DEV) **não migram automaticamente** para produção — `revalidapro-dev` e `revalidapro-f812e` são projetos Firebase/Firestore fisicamente separados; nenhum deploy de Hosting/Functions/Rules move documentos.

## 4. Arquivos SA necessários (núcleo)

```
src/utils/promptEngine.js
src/utils/resumoEngine.js
src/components/RoboGerador.jsx
src/config/recortesStatusSA.js
src/config/diretrizesControladas.js
src/modules/simulador/simuladorLogic.js
src/pages/Simulador.jsx
src/components/SimuladorFeedback.jsx
src/components/TeoriaModal.jsx
src/components/QuestionCard.jsx
CONTROLE_PRODUCAO_SUPERAPOSTAS_2026_2.md
```

## 5. Arquivos MISTOS — não resolver ainda

**`functions/index.js`**
- Parte SA: suporte a `model` no corpo da requisição, allowlist `MODELOS_PERMITIDOS`, seleção Haiku/Opus, `cache_control` no bloco `system`.
- Parte não-SA: `exports.extrairProvaINEP` (import de PDF INEP) + `verificarAdmin`/`EMAILS_ADMIN` que ela usa.
- Importante: a versão de `gerarQuestoesIA` necessária ao SA depende especificamente da parte de `model`/`cache_control` — não é só otimização de custo, é funcionalidade (seleção de modelo).
- Na retomada: decidir a forma segura de separar/promover sem levar o código INEP não homologado por acidente (possivelmente `git add -p` para isolar hunks, ou decisão explícita de aceitar o INEP junto).

**`firestore.rules`**
- Parte SA: permissões necessárias em `questoes`/`resumos_temas`/`teorias` conforme conta admin usada.
- Parte não-SA: regras de `edicoesRevalida`, `importacoes_pendentes` e outras alterações do pipeline INEP.
- Rules são deploy **tudo-ou-nada** — não há como publicar só a fatia SA.
- NÃO resolver nesta pausa.

## 6. Arquivos NÃO relacionados — proteger (não entram no commit/promoção SA)

```
package.json
package-lock.json
src/App.jsx
src/components/ExplanationBox.jsx
src/components/Header.jsx
src/components/MateriaCard.jsx
src/components/PrepararSimulado.jsx
src/components/ProgressBar.jsx
src/components/Questoes.jsx
src/components/Sidebar.jsx
src/components/StatsBar.jsx
src/index.css
src/main.jsx
src/pages/AdminPainel.jsx
src/pages/BuscarPorTema.jsx
src/pages/Dashboard.jsx
src/pages/Login.jsx
src/pages/Register.jsx
src/components/ImportadorPro.jsx
src/components/ModalComparativo2026.jsx
src/components/StorageImage.jsx
storage.rules
questoes_2026_1_codex.json
tmp_pdf_images/
.claude/settings.json
.firebase/hosting.ZGlzdA.cache
```

Atenção redobrada com estes três — **nunca commitar por acidente**:
- `.claude/settings.json`
- `tmp_pdf_images/`
- `.firebase/hosting.ZGlzdA.cache`

## 7. Diagnósticos DEV

Blocos `🧾 DIAGNÓSTICO DEV — candidata rejeitada` e `🧾 DIAGNÓSTICO DEV — resumo rejeitado` (`src/components/RoboGerador.jsx`) são protegidos por `IS_DEV_PROJECT` (comparação com `import.meta.env.VITE_FIREBASE_PROJECT_ID`, resolvida em build-time).

Build real de produção (`npm run build:prod`) confirmou: **0 ocorrências** de `"DIAGNÓSTICO DEV"` e **0 ocorrências** de `"revalidapro-dev"` no bundle gerado. Conteúdo exibido não inclui API key, token, prompt de sistema completo ou dado pessoal.

**Podem permanecer no source. Não são bloqueio para produção.**

## 8. Diretrizes — "lista estática (Firestore indisponível)"

Causa real confirmada: a coleção Firestore `diretrizes` não tem **nenhuma regra** em `firestore.rules` (nem na versão local do working tree) — toda leitura recebe permission-denied, 100% determinístico, não é uma falha intermitente de rede. O fallback estático (`DIRETRIZES_CONTROLADAS` em `diretrizesControladas.js`) foi exatamente o caminho usado e validado em todos os testes reais desta sessão (R034, R002 etc.).

**Decisão:** não corrigir antes da promoção. Lista estática é suficiente e segura para a versão homologada. Melhoria dinâmica (regra Firestore + `PainelDiretrizes.jsx`) é item futuro opcional, não bloqueio.

## 9. Resumos — regra operacional

**QUESTÃO APROVADA + RESUMO REJEITADO = QUESTÃO CONTA PARA AS 120 + RESUMO EM REVISÃO.**

Resumo não pode virar gargalo da produção. `TeoriaModal.jsx` já trata ausência de resumo sem crash (estado vazio "Resumo ainda não disponível" com CTA para o admin, linha ~304-323).

## 10. Pendências reais antes da produção (bloqueios operacionais)

**PENDÊNCIA 1** — Separar/organizar working tree para commit limpo SA (ver seções 4-6).

**PENDÊNCIA 2** — Confirmar estado real da Cloud Function `gerarQuestoesIA` em produção: suporta `model`? suporta `cache_control`? precisa deploy seletivo (`firebase deploy --only functions:gerarQuestoesIA`)? (Confirmado só que a função existe/está live em prod — `v1`, via `firebase functions:list --project revalidapro-f812e` — não o código-fonte exato.)

**PENDÊNCIA 3** — Confirmar Firestore Rules reais de produção: a conta admin usada no RoboGerador consegue gravar em `questoes`/`teorias`/`resumos_temas`? Decidir se rules precisam deploy.

**PENDÊNCIA 4** — Confirmar se produção já possui algum documento com `edicao == "2026_2"`, para saber a numeração inicial real. Não assumir `SA_2026_2_Q1` sem verificação (inferência de alta confiança, não confirmada ao vivo — sem credencial Firestore admin nesta sessão).

## 11. Plano de retomada oficial

**FASE 1 — SOMENTE LEITURA/AUDITORIA**
1. Confirmar branch/HEAD/status.
2. Confirmar function de produção (Pendência 2).
3. Confirmar rules de produção (Pendência 3).
4. Confirmar existência de questões `2026_2` em produção (Pendência 4).
5. Decidir estratégia de separação de `functions/index.js`/`firestore.rules`.

**FASE 2 — PREPARAR PROMOÇÃO**
6. Separar staging por arquivo/hunk.
7. Rodar testes determinísticos.
8. `npm run build:prod`.
9. Revisar diff final.
10. Commit controlado.
11. Checkpoint/hash homologado.

**FASE 3 — PRODUÇÃO**
12. Deploy seletivo somente do necessário.
13. Smoke test sem gerar conteúdo.
14. Gerar UMA questão oficial em produção.
15. Validar E2E.
16. Se PASS, liberar R001–R120.

## 12. Último próximo passo

Iniciar a **FASE 1** (somente leitura) da próxima sessão — nenhuma alteração de código, nenhum deploy, nenhuma geração de questão até essas 4 confirmações estarem feitas.
