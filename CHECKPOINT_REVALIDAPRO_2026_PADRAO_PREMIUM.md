# CHECKPOINT OFICIAL — REVALIDAPRO 2026 PADRÃO PREMIUM

**Data:** 2026-06-23
**Sessão:** Fase de construção do Padrão Premium de Renderização Pedagógica
**Status:** DEV aprovado · Produção intacta · Padrão congelado

---

## 1. AMBIENTE

| Variável | Valor |
|---|---|
| DEV | `revalidapro-dev` |
| PROD | `revalidapro-f812e` |
| URL DEV | https://revalidapro-dev.web.app |
| URL PROD | https://revalidapro.web.app |
| Produção tocada nesta fase | **NÃO** |

### Comandos obrigatórios (nunca desviar)

```bash
# Build DEV (usa .env.development → revalidapro-dev)
npm run build:dev

# Deploy DEV (SEMPRE com --project explícito)
firebase deploy --only hosting --project revalidapro-dev

# NUNCA usar:
npm run build          # aponta para .env.production → PROD
npm run build:prod     # idem
firebase deploy        # .firebaserc default aponta para PROD
```

### Risco crítico permanente
`.firebaserc` tem `"default": "revalidapro-f812e"` — qualquer deploy sem `--project revalidapro-dev` vai para produção.

---

## 2. ARQUIVOS ALTERADOS NESTA FASE

### `src/pages/Simulador.jsx` ← arquivo principal desta fase

Todas as mudanças foram de renderização pura — zero Firestore, zero schema, zero importador.

**Seções modificadas:**
- `BADGES_COGNITIVOS` — 10 badges com cores (adicionados: CONDUTA INSUFICIENTE, DOSE ERRADA, INDICAÇÃO TROCADA, ARMADILHA INEP)
- `BADGE_KEYWORD_MAP` + `resolveBadgeType()` — novo, fuzzy matching de texto livre para badge canônico
- `parseBadgeCognitivo()` — atualizado: agora retorna `{ tipo, subtitulo, texto }`, com fallback fuzzy
- `PASSOS_CONFIG` + `parseTTO()` + `renderLinhasTTO()` — novo, parser da conduta em steps
- `parseDicaMestre()` — atualizado: detecta formato "premium" (4 partes) vs "legacy" (2–3 partes)
- Render TTO — substituído por CSS grid `.tto-grid` (2 colunas desktop / 1 mobile)
- Render Dica Mestre — 3 branches: premium, legacy, plain text
- `<style>` tag — adicionadas `.tto-grid` e `.dica-cols` com breakpoint 768px

### `package.json`

Adicionados scripts:
```json
"build:dev":  "vite build --mode development",
"build:prod": "vite build --mode production"
```
O script `"build": "vite build"` original foi mantido (não usar para DEV).

### `firestore.rules`

Email `wnetgus@gmail.com` adicionado como admin em 6 coleções:
`questoes`, `resumos_temas`, `taxonomiaPedagogica`, `teorias`, `materiais`, `edicoesRevalida`

Deployado somente em `revalidapro-dev`. Produção manteve as regras anteriores.

---

## 3. FUNCIONALIDADES APROVADAS E DEPLOYADAS NO DEV

### Infraestrutura
- [x] `build:dev` usando `.env.development` → aponta para `revalidapro-dev`
- [x] DEV verificado via Playwright: 0 chamadas para `revalidapro-f812e`
- [x] `wnetgus@gmail.com` com permissão de escrita nas coleções admin do DEV

### Importador INEP
- [x] Schema ABCD/ABCDE — alternativa E opcional, gabarito validado dinamicamente
- [x] Anti-overwrite — bloqueia reimportação de IDs já existentes no Firestore
- [x] Campo `resumoTema` — suportado via `...q` spread, priorizado no TeoriaModal
- [x] Edições INEP — dropdown populado via coleção `edicoesRevalida`

### Renderização Premium (Simulador.jsx)
- [x] **Conduta Atualizada (TTO)** — cards PASSO 1–6 em grid 2 colunas (desktop) / 1 coluna (mobile)
  - PASSO 1 🟢 PASSO 2 🔵 PASSO 3 🟣 PASSO 4 🟡 PASSO 5 ⚪ PASSO 6 🔴
  - Suporta bullets (•/✗), key-value (Chave: valor), texto puro
  - Fallback: texto plain se não houver "PASSO N"

- [x] **Dica Mestre — formato Premium** (4 partes separadas por `↓`)
  - ⚡ Frase que Aprova — card dourado, largura total
  - 🔑 O Sinal que Muda Tudo — card índigo, largura total
  - 🧠 O Caminho Certo | ⚠️ Por que Erram — 2 colunas desktop / 1 mobile
  - Fallback legacy (2–3 partes): mnemônico + 3 cards anteriores
  - Fallback plain: `<p>` para texto sem `↓`

- [x] **Badges cognitivos inteligentes** — fuzzy matching
  - Correspondência exata tem prioridade
  - Segmento all-caps antes de `:` → `resolveBadgeType()` → badge canônico + subtítulo em title case
  - Fallback garantido: "ARMADILHA INEP" (rosa) para qualquer erro sem badge reconhecido

- [x] **Raciocínio Clínico** — parser `PADRÃO → DIFERENCIAL → DECISÃO → ARMADILHA` (inalterado)

---

## 4. QUESTÕES APROVADAS NO DEV

| ID | Status | Observação |
|---|---|---|
| `2026_1_Q001` | ✅ Questão Mestre Oficial | Entrou em produção antes da correção do ambiente DEV — mantida, em observação |
| `2026_1_Q002` | ✅ Aprovada DEV | |
| `2026_1_Q003` | ✅ Aprovada DEV | |
| `2026_1_Q004` | ✅ Aprovada DEV | |
| `2026_1_Q005` | ✅ Aprovada DEV | |

---

## 5. PADRÃO CONGELADO — REVALIDAPRO 2026

**Estes formatos não devem ser alterados sem decisão formal:**

### Campo `tto` (Conduta Atualizada)
```
PASSO 1 — [TÍTULO DO PASSO]
• item
• item

PASSO 2 — [TÍTULO DO PASSO]
Medicamento: X
Dose: Y

PASSO 3 — [TÍTULO DO PASSO]
Texto explicativo
```
Máximo 6 passos. Cores fixas por número de passo.

### Campo `dicaMestre` — Formato Premium (4 partes)
```
[Frase memorável que o aluno repetirá na prova]
↓
[O sinal que muda tudo — o pivot cognitivo]
↓
[O caminho certo — algoritmo de decisão com bullets/arrows]
↓
[Por que erram — a armadilha específica deste tema]
```
Cada bloco: texto curto, `white-space: pre-line`, sem limite de altura.

### Campo `raciocinio`
```
PADRÃO: [reconhecimento] → DIFERENCIAL: [diferencial principal] → DECISÃO: [conduta] → ARMADILHA: [erro comum]
```

### Justificativas com badge
```
NOME DO BADGE: justificativa explicando o erro
```
Badge pode ser um nome canônico exato OU texto livre all-caps (o sistema resolve via fuzzy).

### Campo `resumoTema`
Objeto embutido na questão. TeoriaModal prioriza este campo antes de qualquer lookup Firestore.
Schema: `{ titulo, categoria, padraoReconhecimento, diagnosticoDiferencial, condutaMomentoExato, armadilhaINEP, regraDeOuro, diretrizAtual, erroQueReprova, quandoINEPQuerTePegar, dicaMestreResumo }`

---

## 6. RISCOS CONHECIDOS

| Risco | Mitigação |
|---|---|
| `.firebaserc` default aponta para PROD | Sempre usar `--project revalidapro-dev` explicitamente |
| `npm run build` usa `.env.production` | Sempre usar `npm run build:dev` para DEV |
| Cloud Functions não deployadas no DEV | Spark plan — funções não fazem parte do fluxo atual |
| Q001 entrou em PROD antes da correção do ambiente | Questão válida, mantida, em observação |
| `taxonomiaPedagogica` write sem `await` (bug antigo) | Corrigido em commit 29add90 |

---

## 7. PRÓXIMOS ASSUNTOS (agenda ao retornar)

1. **Protocolo para questões com imagem/tabela** — como o Codex deve referenciar imagens e como o Importador as processa
2. **Fluxo seguro para importação em lote** — validação antes de publicar múltiplas questões de uma vez
3. **Papel do Codex (ChatGPT Plus)** — gerador de conteúdo pedagógico no formato JSON Premium
4. **Papel do ChatGPT no VS Code** — estrategista pedagógico sem mexer em código

---

## 8. ARQUITETURA DE PAPÉIS (decisão estratégica desta sessão)

| Ferramenta | Papel |
|---|---|
| **Claude (este agente)** | Arquitetura, segurança, schema, admin, código |
| **Codex (ChatGPT Plus)** | Pedagogia, geração de conteúdo, JSON Premium |
| **ChatGPT no VS Code** | Estratégia pedagógica, sem tocar em código |
| **Fluxo** | PDF → Codex → JSON Premium → ImportadorPro Admin → DEV → Produção |

---

*Checkpoint gerado automaticamente pela sessão Claude em 2026-06-23.*
*Próxima sessão: dizer "quero continuar" para retomar deste ponto.*
