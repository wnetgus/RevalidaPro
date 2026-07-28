# CHECKPOINT OFICIAL — SUPER APOSTAS 2026.2 (pausa para auditoria de governança numérica dos resumos)

**Data:** 2026-07-28
**Sessão:** Hardening editorial do RoboGerador (questão + resumo) + amostragem final de estabilidade em `revalidapro-dev`
**Status:** Pausa deliberada, antes de gerar R092/R077, para auditar como `validarResumoSA` trata números clínicos

---

## 1. AMBIENTE

| Variável | Valor |
|---|---|
| DEV | `revalidapro-dev` |
| PROD | `revalidapro-f812e` |
| Produção tocada nesta fase | **NÃO** |
| Admin DEV usado nesta fase | `wnetgus@gmail.com` |

---

## 2. PAPÉIS (vigente a partir desta retomada)

- **ChatGPT** — arquiteto e coordenador: decide sequência, critérios e próximos prompts.
- **Claude** — implementador principal: inspeciona o repositório, atualiza checkpoints/documentos, só altera código com autorização explícita.
- **Codex** — auditor independente: valida aderência, testes, arquitetura e documentação; não substitui o Claude como implementador.
- **Usuário** — executa validações manuais no navegador, envia logs reais, autoriza deploy e continuidade.

---

## 3. FONTE DE VERDADE DOCUMENTAL

`CONTROLE_PRODUCAO_SUPERAPOSTAS_2026_2.md` é o controle operacional principal (seção 4 = tabela completa R001–R120, atualizada nesta sessão; seção 10 = registro desta amostragem). Este checkpoint é o registro narrativo desta pausa específica — não substitui o controle, complementa.

---

## 4. COMMITS DESTA FASE (todos já mesclados em `main`)

| Commit | Conteúdo |
|---|---|
| `caf36e3` | fix(superapostas): enforce enunciado word count and clinical-case shape in validarLoteSA |
| `6d86a08` | fix(superapostas): close SA-4 quoted/example loophole in resumo prompt |
| `40040ab` | fix(superapostas): feed literal SA-4 term/snippet back into resumo retry |
| `c9b294f` | fix(superapostas): harden question retry feedback and cardinality |
| `63212ac` | fix(firestore): allow secondary admin to read users in dev |

`63212ac` alterou **somente** `firestore.rules` (leitura de `usuarios` liberada também para `wnetgus@gmail.com`), com deploy **apenas** em `revalidapro-dev` (`firebase deploy --only firestore:rules --project revalidapro-dev`). Produção não recebeu esse deploy.

---

## 5. VALIDAÇÕES CONCLUÍDAS

### 5.1 Admin DEV
Antes de `63212ac`: `FirebaseError: Missing or insufficient permissions` ao abrir o AdminPainel (causa raiz: regra de `usuarios` só reconhecia `drweynesouza@gmail.com`, diferente de todas as outras coleções administrativas). Depois: painel carrega normalmente, confirmado pelo usuário.

### 5.2 Hardening da questão (`c9b294f`)
- Feedback de retry passou a incluir termo e trecho literais da violação SA-4 (`_localizarAfirmacaoForte`/`_feedbackCandidataAbsoluta`).
- Validação de cardinalidade adicionada em `executarGeracaoSA`: se o array retornado não tem exatamente `esperado` itens, é rejeitado como erro de protocolo **antes** da validação clínica — nenhuma candidata parcial/excedente é avaliada individualmente ou salva.
- 18 testes novos em `scripts/test-questao-retry-hardening.js`.
- Suíte completa: `test-diretrizes-governanca.js` 64/64 + `test-resumo-sa4-feedback.js` 8/8 + `test-questao-retry-hardening.js` 18/18 = **90/90 PASS**. Build PASS.

### 5.3 Hardening do resumo (`6d86a08`, `40040ab`)
- Termo e trecho ofensores extraídos (`_localizarAfirmacaoForte`/`_extrairTermoTrechoAfirmacaoForte`) e citados no feedback de retry.
- Resumo pode ser corrigido/regenerado via `gerarESalvarResumo(questao)` sem recriar a questão (mecanismo já existente, seguro — verifica `getDoc` antes de gravar, nunca toca a coleção `questoes`).

---

## 6. QUESTÕES GERADAS NESTA FASE (todas em `revalidapro-dev`, nenhuma conta para as 120 ainda)

### R074 — Delirium: diferenciação de demência
- **Área:** Clínica Médica / Geriatria
- **ID:** `SA_2026_2_Q26`
- Questão aprovada e salva (3 tentativas). Resumo rejeitado 2x por "nunca" (achado que motivou o Micro Hotfix 2, `40040ab`), depois regenerado com sucesso via `gerarESalvarResumo` — chave `Delirium--idoso`, 7 blocos, aprovado na 1ª tentativa pós-fix.
- Visualização da questão e do resumo confirmada pelo usuário na plataforma.
- **Pendência documental corrigida nesta sessão:** `CONTROLE_PRODUCAO...md` ainda registrava R074 como `PENDENTE` — corrigido na seção 4 daquele arquivo.

### R079 — Cerume impactado: indicação e técnica de remoção segura
- **Área:** Cirurgia
- **ID:** `SA_2026_2_Q27`
- Tentativa 1: JSON malformado. Tentativa 2: rejeição por enunciado de 77 palavras (SA-5) e diretriz não sustentada. Tentativa 3 (Opus): 1 válida / 0 rejeitada — cardinalidade correta, nenhuma candidata excedente (1ª homologação real do enforcement de `c9b294f`).
- Resumo: rejeitado na tentativa 1, aprovado na tentativa 2 — chave `Cerume impactado--adulto`, 7 blocos.
- Resultado geral: **PASS** no DEV.

### R067 — Parassonias: pavor noturno vs. epilepsia e conduta esperada
- **Área:** Pediatria
- **ID:** `SA_2026_2_Q28`
- 1ª execução: tentativa 1 JSON truncado; tentativa 2 rejeição por "90%" + diretriz não controlada; tentativa 3 rejeição por anti-pista — **nenhuma questão salva** (esgotou o teto).
- 2ª execução: tentativa 1 rejeição por anti-pista + diretriz inventada; tentativa 2 — 1 válida / 0 rejeitada. **Questão salva como `SA_2026_2_Q28`.**
- Resumo: tentativa 1 rejeitada, tentativa 2 rejeitada — motivo: números "criança > 6 anos" e "> 8–10 anos" classificados como números clínicos sem grounding. Chave prevista: `Parassonias--pediátrico`. **Resumo NÃO foi salvo.**
- Estado: questão **PASS**; resumo **PENDENTE DE REFINAMENTO/AUDITORIA**.
- **Não recriar a questão.** Regenerar só o resumo via `gerarESalvarResumo(questao)` depois do refinamento da governança numérica.

### R092 e R077 — ainda não executados
Selecionados para a amostragem, mas a geração foi **interrompida deliberadamente** após R067, para não consumir mais créditos antes de auditar o achado numérico abaixo.

- **R092** — Aleitamento materno: manejo de fissura e ingurgitamento mamário (Pediatria) — **ainda não gerar**.
- **R077** — Quedas em idosos: avaliação multifatorial e prevenção (Clínica Médica) — **ainda não gerar**.

---

## 7. DESCOBERTA QUE MOTIVOU A PAUSA

O resumo de R067 foi rejeitado porque o texto continha "criança > 6 anos" e "criança > 8–10 anos", e `validarResumoSA` classificou **6, 8 e 10** como números clínicos sem suporte de diretriz controlada.

**Questão arquitetural pendente (não implementada ainda):** a checagem atual (`_extrairNumerosSignificativos`, usada dentro de `validarResumoSA` quando `!grounding`) parece rejeitar qualquer número clínico sem diferenciar sua natureza. Precisamos distinguir, com segurança, entre pelo menos estas categorias antes de decidir qualquer ajuste:

- idade contextual (faixa etária de um caso/quadro);
- duração contextual (tempo de evolução, janela de observação);
- dose (posologia — já tratado separadamente pela REGRA SA-3, `_contemPosologiaEspecifica`);
- percentual;
- limiar laboratorial;
- critério diagnóstico numérico (escores, contagens);
- data/ano de diretriz;
- frequência/quantidade;
- números potencialmente inventados (sem nenhuma categoria acima).

**Nada disso foi implementado nesta sessão.** Primeiro deve ocorrer uma auditoria somente leitura (seção 8 abaixo).

---

## 8. PRÓXIMA MISSÃO NA RETOMADA — auditoria somente leitura (não implementar sem autorização do ChatGPT)

Auditar exclusivamente a governança numérica dos resumos. Responder, sem alterar nada:

1. Onde está a regra que extrai e rejeita números nos resumos?
2. Ela rejeita qualquer número ou já possui categorias internas?
3. Quais campos/blocos do resumo são avaliados?
4. Como números de idade, duração, dose, percentuais e limiares são tratados hoje — todos iguais, ou já há alguma distinção?
5. O retry recebe quais dados sobre os números ofensores especificamente?
6. O prompt do resumo já ordena explicitamente retirar todos os números sem grounding, ou isso é implícito?
7. Qual é o menor refinamento seguro para reduzir desperdício de créditos com essa categoria de rejeição?
8. Comparar 3 caminhos: (a) permitir algumas categorias contextuais (ex. idade/duração do próprio caso); (b) manter proibição total de qualquer número sem grounding; (c) combinar ajuste de prompt + validação.
9. Como evitar abrir brecha para números clínicos genuinamente inventados, qualquer que seja a categoria escolhida?
10. Como regenerar somente o resumo de R067 depois do ajuste (reaproveitando `gerarESalvarResumo`, sem recriar a questão)?

**Não implementar nada desta lista sem autorização explícita do ChatGPT.** Depois da auditoria, aguardar decisão antes de tocar em `validarResumoSA`, no prompt do resumo, ou de gerar R092/R077.

---

## 9. RESTRIÇÕES QUE PERMANECEM VÁLIDAS

- Não gerar R092/R077 antes da auditoria numérica e da decisão do ChatGPT.
- Não recriar R074 (`SA_2026_2_Q26`), R079 (`SA_2026_2_Q27`) ou R067 (`SA_2026_2_Q28`).
- Não alterar `validarResumoSA`, o prompt do resumo, `validarLoteSA` ou os testes sem autorização.
- Não fazer deploy, não tocar Firestore de produção, não tocar `revalidapro-f812e`.
- Regenerar o resumo de R067 é a única ação de dados pendente, e só depois do refinamento decidido — via `gerarESalvarResumo(questao)`, nunca recriando a questão.
