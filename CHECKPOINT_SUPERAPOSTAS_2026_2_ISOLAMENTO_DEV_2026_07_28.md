# CHECKPOINT OFICIAL — SUPER APOSTAS 2026.2 (pausa: cadeia de hotfixes de infraestrutura e isolamento DEV × produção)

**Data:** 2026-07-28
**Sessão:** Fecho da homologação de R067 (resumo, pendente) + cadeia de hotfixes de infraestrutura (harness CRLF, retry preventivo do resumo, publicação do repositório, isolamento do bundle DEV)
**Status:** Pausa deliberada. Código pronto localmente (2 commits à frente do remoto), aguardando autorização separada para push e, depois, para deploy exclusivo de Hosting em `revalidapro-dev`.

Este checkpoint é o registro narrativo desta pausa específica (infraestrutura/deploy) — não substitui `CONTROLE_PRODUCAO_SUPERAPOSTAS_2026_2.md` (controle mestre de produção de questões) nem `CHECKPOINT_SUPERAPOSTAS_2026_2_GOVERNANCA_RESUMOS_NUMERICOS_2026_07_28.md` (narrativa da governança numérica dos resumos, seções 1–13, que termina exatamente onde este começa).

---

## 1. BASELINE GIT NO MOMENTO DA PAUSA

| Item | Valor |
|---|---|
| Branch | `main` |
| HEAD local | `76145061b69142a9502144f507a2ca458b3f0c12` |
| `origin/main` | `49a96e1465aba940f357b9c6b670200f476f23e2` |
| Ahead/behind | `0 behind / 1 ahead` (código) — passará a `0/2` após o commit documental desta missão |
| Working tree rastreado | limpo |
| Untracked | `RevalidaPro_Analise.docx` (deve permanecer sempre untracked, nunca incluído em commit) |

---

## 2. SEQUÊNCIA DE COMMITS DESTA CADEIA (todos após `a9f7279`, controle DEV-only de regeneração de resumo)

| Commit | Conteúdo |
|---|---|
| `627abf7` | `test(superapostas): make summary control harness CRLF-safe` — hotfix do harness `scripts/test-resumo-isolado-dev-control.js` (normalização LF/CRLF, teste de portabilidade novo) |
| `49a96e1` | `fix(superapostas): add global preventive instruction to summary retry prompt` — instrução preventiva global no retry do resumo (`src/utils/promptEngine.js`) |
| `76145061` | `fix(dev): isolate payment endpoint from production` — este checkpoint documenta este commit em detalhe (seções 3–8 abaixo) |

`627abf7` e `49a96e1` já foram publicados em `origin/main` (push fast-forward autorizado e executado nesta sessão). **`76145061` é o único commit de código ainda pendente de push.**

---

## 3. PROBLEMA ENCONTRADO

Uma auditoria de prontidão para deploy DEV (missão anterior desta mesma pausa) identificou que:

1. `npm run build` (padrão, modo `production`) gera um `dist/` com configuração de **produção** (`revalidapro-f812e`) embutida em tempo de build — Firebase Auth/Firestore/Storage e o endpoint `gerarQuestoesIA`.
2. `npm run build:dev` (modo `development`, lê `.env.development`) corrige isso corretamente para `revalidapro-dev`.
3. **Mesmo na build DEV correta**, dois arquivos continuavam com a URL completa da função de pagamento `criarPreferencia` **hardcoded incondicionalmente** para produção, sem nenhum fallback por variável de ambiente:
   - `src/components/ModalAssinatura.jsx`
   - `src/pages/LandingPage.jsx`

Ou seja: mesmo publicando corretamente o Hosting DEV com `build:dev`, o fluxo de assinatura/pagamento continuaria, silenciosamente, chamando a Cloud Function de pagamento **real de produção**.

---

## 4. CAUSA RAIZ

Os demais 5 consumidores de Cloud Functions do repositório (`src/utils/promptEngine.js`, `src/components/RoboGerador.jsx` ×2, `src/components/ResumoGerador.jsx`, `src/components/ImportadorPro.jsx`) já seguiam o padrão:

```js
(import.meta.env.VITE_FUNCTIONS_BASE_URL || "https://us-central1-revalidapro-f812e.cloudfunctions.net") + "/gerarQuestoesIA"
```

`ModalAssinatura.jsx` e `LandingPage.jsx` nunca receberam essa correção — ficaram com a URL de produção como literal único, sem ler `VITE_FUNCTIONS_BASE_URL`. À leitura, `LandingPage.jsx`'s `CLOUD_FN` verificou-se **código morto** (declarado, nunca referenciado no restante do arquivo) — mesmo assim corrigido, pois o objetivo é eliminar a string de produção do bundle, não só o caminho de execução ativo no momento.

---

## 5. HOTFIX REALIZADO (commit `76145061`)

Aplicado exatamente o mesmo padrão já usado pelos outros 5 consumidores, sem criar módulo/abstração central nova (fora de escopo desta missão):

```js
const CLOUD_FUNCTION_URL =
  (import.meta.env.VITE_FUNCTIONS_BASE_URL || "https://us-central1-revalidapro-f812e.cloudfunctions.net") + "/criarPreferencia";
```

### Arquivos do hotfix
- `src/components/ModalAssinatura.jsx` — `CLOUD_FUNCTION_URL`
- `src/pages/LandingPage.jsx` — `CLOUD_FN`
- `scripts/test-pagamento-dev-isolamento.js` (novo) — 8 testes estruturais, zero rede

Nenhum outro arquivo foi tocado. Nenhuma mudança em Functions, Firestore Rules, Storage Rules, Auth ou App Check.

---

## 6. TESTES E BUILDS

- **14 scripts, 282/282 testes PASS**, zero rede (13 scripts pré-existentes + `test-pagamento-dev-isolamento.js`, novo).
- `npm run build:dev` → **PASS**. Bundle inspecionado: `revalidapro-dev` presente; endpoint DEV de `criarPreferencia` presente (1×); endpoint PROD de `criarPreferencia` **ausente (0)**; nenhuma ocorrência de `revalidapro-f812e` restante em nenhum lugar do bundle (o Terser eliminou o fallback de produção como código morto).
- `npm run build` (produção) → **PASS**. Bundle inspecionado: `revalidapro-f812e` (Firebase init), `gerarQuestoesIA` produção (5×) e `criarPreferencia` produção (1×) — todos preservados corretamente. Único resíduo de `"revalidapro-dev"`: a constante de comparação `PROJECT_ID_DEV_PERMITIDO` (`ambienteGuard.js`) e o texto de UI "indisponível fora do DEV" — pré-existente, esperado, não é configuração de conexão.
- Rebuild DEV final executado por último — `dist/` (git-ignored, não versionado) terminou contendo exclusivamente o artefato DEV.
- Lint dos arquivos alterados: nenhuma regressão nova (só o padrão preexistente `'process' is not defined` já presente em todos os `scripts/test-*.js`).
- Nenhum acesso real à rede, IA, pagamento ou Firebase em nenhuma etapa.

---

## 7. RESULTADO DA AUDITORIA INDEPENDENTE

Auditoria independente do Codex sobre o commit `76145061`, relatada nesta sessão:

- **Veredito: APROVADO — PRONTO PARA PUSH.**
- 8/8 testes do novo script confirmados; 14 scripts e 282/282 testes confirmados; `build:dev` PASS; `build` (produção) PASS; rebuild DEV final PASS.
- Escopo real confirmado como restrito aos três arquivos declarados.
- Isolamento DEV × produção confirmado.
- Nenhum risco residual bloqueante identificado.
- Nenhum motivo técnico para impedir o push.
- Após o push, o Hosting DEV pode ser publicado **sem** republicar Functions, Rules, Auth ou App Check (infraestrutura já validada em `revalidapro-dev` por sessões/commits anteriores a este, não alterada por esta cadeia).
- Nenhuma pendência externa encontrada para o deploy exclusivo de Hosting DEV.

---

## 8. ISOLAMENTO DEV × PRODUÇÃO — ESTADO CONSOLIDADO

| Superfície | Build DEV (`build:dev`) | Build produção (`build`) |
|---|---|---|
| Firebase Auth/Firestore/Storage init | `revalidapro-dev` | `revalidapro-f812e` |
| Endpoint `gerarQuestoesIA` | `revalidapro-dev` | `revalidapro-f812e` |
| Endpoint `criarPreferencia` (pagamento) | `revalidapro-dev` (função pode não estar publicada lá — falha controlada é aceitável, nunca redirecionamento silencioso a produção) | `revalidapro-f812e` |
| App Check (site key + debug token) | configurado só para DEV (ausente em `.env.production` por decisão deliberada, documentada em `.env.appcheck.example`) | não aplicável nesta sprint |

**Regra de ouro reafirmada:** `--project revalidapro-dev` no comando de deploy **não é suficiente sozinho** para isolamento — o script de build (`build:dev`, nunca `build` puro) é quem decide qual configuração é embutida no bundle. `.firebaserc` só tem o alias `default = revalidapro-f812e`; não existe alias `revalidapro-dev` — reforça que `--project` explícito é sempre obrigatório em qualquer comando Firebase futuro.

---

## 9. RISCOS RESIDUAIS NÃO BLOQUEANTES

- `functions/index.js:29` mantém fallback hardcoded `APP_URL = process.env.APP_URL || "https://revalidapro-f812e.web.app"`, relevante só se `functions/.env` local (não versionado, único, sem variante por projeto) não definir `APP_URL` antes de um eventual deploy de Functions. Não bloqueante para o deploy de Hosting-only planejado.
- `functions/index.js:92` mantém URL de webhook do Mercado Pago hardcoded para produção (`webhookMercadoPago`) — não relacionado a este hotfix nem ao escopo Super Apostas, fora do que está sendo homologado agora.
- Domínio autorizado do reCAPTCHA/App Check e domínios autorizados de Auth no Console do `revalidapro-dev` **não são verificáveis por arquivo local** — presumidos já configurados (memória do projeto registra hardening de App Check "concluído e validado em revalidapro-dev" em 2026-07-27), mas não reconfirmados ao vivo nesta cadeia.
- R067 continua **sem resumo aprovado/persistido** — nenhum dos hotfixes desta cadeia gerou ou tentou gerar esse resumo novamente.

Nenhum desses itens bloqueia o próximo passo autorizável (push do commit `76145061`).

---

## 10. AÇÕES PROIBIDAS ATÉ NOVA AUTORIZAÇÃO EXPLÍCITA

- Push (inclusive deste commit documental).
- Deploy (Hosting, Functions, Rules ou Storage).
- Qualquer comando Firebase CLI.
- Acesso a Firebase/Firestore ou ao Firebase Console.
- Pagamento real.
- Chamada de IA / consumo de créditos.
- Execução de R067, R092 ou R077.
- Alteração de Auth ou App Check.
- Qualquer toque em `revalidapro-f812e` (produção).
- Alteração de código ou refatoração fora de missão explícita.
- Merge, pull, rebase, reset ou cherry-pick.

---

## 11. ESTADO EXATO DA PAUSA

- Código pronto e auditado localmente até o commit `76145061`.
- Nenhum push realizado ainda para `76145061` (nem para o commit documental que fecha esta missão).
- Nenhum deploy realizado em nenhum momento desta cadeia.
- Produção (`revalidapro-f812e`) intocada.
- R067 permanece com resumo pendente; R092 e R077 permanecem não executados.
- Nenhum crédito consumido em nenhuma etapa desta cadeia de hotfixes.

---

## 12. PRÓXIMA AÇÃO AUTORIZÁVEL (uma de cada vez, com autorização explícita e separada)

1. Push fast-forward do estado atual de `main` (incluirá `76145061` + o commit documental desta missão) para `origin/main`.
2. Só depois, em missão separada: `npm run build:dev` seguido de `firebase deploy --project revalidapro-dev --only hosting`.

---

## 13. SEQUÊNCIA COMPLETA DE RETOMADA

Ao retomar (nesta ou em outra conversa):

1. Conferir branch, hashes, ahead/behind e working tree.
2. Confirmar exatamente:
   - `HEAD local` = `76145061b69142a9502144f507a2ca458b3f0c12` **antes** do commit documental, ou o hash do commit documental **depois** dele (ver seção 6 da entrega correspondente para o hash exato);
   - `origin/main` = `49a96e1465aba940f357b9c6b670200f476f23e2`;
   - ahead/behind = `0/1` antes do commit documental, `0/2` depois;
   - único untracked = `RevalidaPro_Analise.docx`.
3. Autorizar separadamente **somente** o push fast-forward.
4. Depois do push, verificar: `HEAD` local = `origin/main`; ahead/behind = `0/0`; nenhuma indicação de CI/CD ou deploy automático na saída do `git push`.
5. **Só em missão posterior**, com autorização própria: `npm run build:dev` → `firebase deploy --project revalidapro-dev --only hosting` (nunca `npm run build` puro; nunca sem `--project` explícito; nunca `--only` amplo que inclua Functions/Rules/Storage/Auth/App Check nesta rodada).
6. Verificar o Hosting DEV publicado (smoke test, sem depender de navegador se não disponível — pelo menos checar resposta HTTP da raiz e do endpoint `gerarQuestoesIA` via `OPTIONS`/`GET` inválido, como já feito em promoções anteriores documentadas em `CONTROLE_PRODUCAO_SUPERAPOSTAS_2026_2.md`).
7. Manter R067/R092/R077 bloqueadas até autorização específica e separada para cada uma.
8. Nunca usar `npm run build` (puro) para o deploy DEV — sempre `npm run build:dev`.
9. Não publicar Functions, Rules, Auth ou App Check junto com este deploy de Hosting DEV — já validados em sessão anterior, fora do escopo desta cadeia.
10. Não tocar em produção (`revalidapro-f812e`) em nenhuma etapa desta retomada.

---

## 14. CRITÉRIOS PARA O FUTURO DEPLOY EXCLUSIVO DE HOSTING DEV

- Build obrigatoriamente com `npm run build:dev` (nunca `npm run build`), executado imediatamente antes do deploy (não reaproveitar `dist/` de builds anteriores da sessão).
- Comando de deploy com `--project revalidapro-dev` explícito (nunca o alias padrão do `.firebaserc`, que é produção) e `--only hosting` explícito.
- Inspeção do `dist/assets/*.js` gerado, confirmando presença de `revalidapro-dev` e ausência de qualquer string `revalidapro-f812e` de configuração de conexão (Firebase init, `gerarQuestoesIA`, `criarPreferencia`), antes do deploy.
- Nenhum redeploy de Functions/Rules/Storage/Auth/App Check nesta rodada, salvo se uma auditoria futura confirmar que o estado implantado em `revalidapro-dev` divergiu do esperado.
- Verificação pós-deploy: `firebase hosting:sites:list --project revalidapro-dev` e `firebase functions:list --project revalidapro-dev` (somente leitura).

---

## 15. CONFIRMAÇÃO FINAL

Produção (`revalidapro-f812e`) permaneceu intocada durante toda esta cadeia de hotfixes. Nenhum crédito de IA foi consumido. Nenhum pagamento real foi processado ou testado. R067 continua sem resumo aprovado; R092 e R077 continuam não executados — todos bloqueados até autorização específica e separada.
