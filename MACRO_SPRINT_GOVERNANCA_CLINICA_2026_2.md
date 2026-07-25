# MACRO SPRINT — GOVERNANÇA CLÍNICA E ATUALIZAÇÃO DE DIRETRIZES 2026.2

**Fase concluída:** FASE 1 — Correção das diretrizes críticas existentes. **Data:** 2026-07-24. **Autorização:** com base em `AUDITORIA_ATUALIZACAO_CLINICA_NORMATIVA_2026_2.md` (commit `2d5eca0`).

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
