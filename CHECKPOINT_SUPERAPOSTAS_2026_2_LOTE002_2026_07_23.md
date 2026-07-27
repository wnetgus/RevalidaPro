# CHECKPOINT OFICIAL — SUPER APOSTAS 2026.2 (pausa pós-Lote 002)

**Data:** 2026-07-23
**Sessão:** Calibração, saneamento técnico e produção controlada das Super Apostas 2026.2
**Status:** DEV com 21 questões salvas (Q1–Q21) · Produção intacta · Pausa autorizada pelo usuário

---

## 1. AMBIENTE

| Variável | Valor |
|---|---|
| DEV | `revalidapro-dev` |
| PROD | `revalidapro-f812e` |
| Produção tocada nesta fase | **NÃO** |
| ImportadorPro / fluxo INEP | **Intocado, isolado** |

---

## 2. O QUE NÃO FAZER NA RETOMADA SEM AUTORIZAÇÃO EXPLÍCITA

- Não iniciar Lote 003 automaticamente.
- Não gerar mais questões.
- Não alterar produção / Firestore de produção.
- Não fazer refatorações amplas.
- Não mudar a estrutura visual Premium.
- Não mudar questões INEP.
- Não criar nova arquitetura.
- Não fazer novas correções no motor automaticamente — só após auditoria e autorização.

---

## 3. MOTOR ATUAL DAS SUPER APOSTAS 2026.2 (RoboGerador)

Já implementado e homologado nesta fase:

- Formato ABCD (nunca alternativa E).
- Haiku como gerador primário, até 2 tentativas.
- Opus como fallback/revisor controlado (nunca mais que 1 chamada extra).
- Anti-pistas (REGRA SA-1): equilíbrio estrutural entre alternativas.
- Sanidade textual (detecção de corrupção de encoding).
- Taxonomia protegida (`normalizarTemaMestre`, sem fragmentação).
- **Grounding unificado**: `detectarDiretriz` agora delega para `detectarDiretrizDinamica` — mesma lógica de seleção (maior ano) em todo o app, incluindo `resumoEngine.js`, que antes divergia.
- **Grounding numérico/normativo estrito**: `grounding=true` não autoriza mais o modelo a completar número não sustentado literalmente pelo texto da diretriz injetada (`groundingTexto`, construído a partir do bloco completo — `montarBlocoDiretriz`, não só `pontosCriticos`).
- Dica Mestre Premium (4 blocos por `↓`).
- Conduta (`tto`) voltada também à 2ª fase.
- Estratégia da Aposta.
- Resumo do Tema complementar (`PROMPT_SISTEMA_RESUMO_SA`, `validarResumoSA`).
- Proteção contra colisão de keywords curtas: `nic`/`gina`/`tb`/`bk` agora exigem fronteira de palavra (`\b`). `nic` ainda colide teoricamente com "clínica/crônica/técnica" só se a fronteira falhar — testado e confirmado que NÃO colide mais.

Arquivos-fonte do motor: `src/utils/promptEngine.js`, `src/config/diretrizesControladas.js`, `src/components/RoboGerador.jsx`, `src/utils/resumoEngine.js`.

---

## 4. PLANO DE PRODUTO

**Meta:** 120 questões estratégicas para Super Apostas 2026.2.
**Base:** 100 recortes `R001–R100` (Mapa Mestre) + 20 recortes complementares `R101–R120`.
**Princípio:** cada recorte é uma **decisão** provável de prova, nunca apenas um nome de tema. Classificação por sinais: RECORRÊNCIA, TENDÊNCIA, ATUALIZAÇÃO, EXPANSÃO.

Categorias de liberação dos 100 recortes (última auditoria):
1. LIBERADO COM GROUNDING EXISTENTE — 17
2. LIBERADO SEM NECESSIDADE DE GROUNDING ESPECÍFICO — 57
3. BLOQUEADO — PRECISA FONTE CONTROLADA — 18
4. REVISÃO HUMANA RECOMENDADA (grounding existe mas não sustenta o número específico) — 8

Fontes controladas ativas hoje (12): `has, dm, sepse, asma, rastreamento_colo, prenatal, sifilis, vacinacao, hiv, tuberculose, dengue, etica_medica`.

---

## 5. LOTE 001 — CONCLUÍDO

Questões de calibração/produção controlada relacionadas a: HAS, DMG, TCE, Dengue, Ética. Ajustes técnicos decorrentes já concluídos (hotfixes de keywords, grounding numérico, resumo).

---

## 6. LOTE 002 — ESTADO EXATO DA PAUSA (4/5)

| ID | Recorte | Matéria | Modelo final | Grounding |
|---|---|---|---|---|
| `SA_2026_2_Q18` | R020 — Rastreamento do colo / ASC-US | Ginecologia e Obstetrícia | Haiku | INCA 2023 |
| `SA_2026_2_Q19` | R032 — Vacinação / falsas contraindicações | Preventiva | Opus (fallback) | PNI/MS 2024 |
| `SA_2026_2_Q20` | R009 — Sigilo em adolescente | Medicina Legal e Ética Médica | Haiku | CFM 2.217/2018 |
| `SA_2026_2_Q21` | R023 — Diverticulite / Hinchey | Cirurgia | Opus (fallback) | Sem grounding específico |

**5º recorte — não concluído.** Tentativas, em ordem: R016 (Sífilis congênita, 2 rodadas), R006 (Asma), R017 (Icterícia neonatal), R012 (Sepse). Causa predominante de rejeição: **grounding numérico insuficiente** — números presentes no conteúdo gerado (ex. seguimento sorológico de RN, limiares de febre) sem sustento literal nos `pontosCriticos` da diretriz injetada. Não é bug — é a trava estrita funcionando como pedido, mas com taxa de rejeição maior que a esperada em temas com diretriz numericamente densa.

Resumo do Tema: apenas 1 de 4 gerado com sucesso (`teorias/Sigilo profissional médico--adolescente`, para Q20). Os outros 3 falharam (2 por número sem suporte, 1 por erro técnico de parsing JSON).

---

## 7. ACHADO CRÍTICO 1 — ESTILO DO ENUNCIADO (observado pelo usuário, NÃO investigado ainda)

Possível regressão na construção do enunciado. Exemplo apontado (Q19):

> "Criança de 15 meses... febre baixa (37,9°C) e coriza... uso de amoxicilina para otite... avó questiona se as vacinas devem ser adiadas. Qual é a conduta mais adequada?"

O problema não é necessariamente correção clínica — é que algumas questões parecem secas/curtas demais, com aparência de flashcard, potencialmente distantes do estilo ENAMED/Revalida e do padrão Premium já homologado na plataforma.

**Critério de avaliação a aplicar na retomada:** "Parece uma questão real de ENAMED/Revalida ou parece um flashcard gerado por IA?" — sem alongar artificialmente toda questão (questões oficiais podem ser curtas quando o caso pede).

**Ação pendente (NÃO fazer hoje):** auditar `_REGRAS_PEDAGOGICAS` / `_INTERPRETACAO_TEMA_ROBO` / `PROMPT_SISTEMA_SUPERAPOSTAS_ABCD` em `promptEngine.js`, comparar enunciados gerados com questões Premium homologadas já existentes na plataforma, identificar causa raiz, propor correção mínima.

---

## 8. ACHADO CRÍTICO 2 — EFICIÊNCIA / TOKENS (NÃO investigado ainda)

Lote 002: ~173.600 tokens de entrada, ~39.000 de saída, 20 chamadas de modelo — para produzir apenas 4 questões finais. Considerado inaceitável para escalar a 120 sem análise prévia.

**Perguntas a responder na retomada (NÃO fazer hoje):**
- Por que houve tantas chamadas (quanto é retry por grounding insuficiente vs. anti-pistas vs. erro técnico de JSON)?
- Quanto do custo vem do tamanho fixo do system prompt por chamada?
- Estamos gastando retries em recortes que já deveriam estar classificados como BLOQUEADO/REVISÃO HUMANA antes da geração (ex. R016 deveria ter sido reclassificado após o achado do Lote 002)?
- Como reduzir chamadas desperdiçadas **sem afrouxar segurança clínica** — objetivo é identificar inviabilidade antes de chamar a IA, não relaxar validação.

---

## 9. RESUMO DO TEMA — PADRÃO A MANTER

7 seções (inalterado, não repetir conteúdo já mostrado na questão):
1. Como reconhecer
2. Diagnóstico/exames
3. Gravidade/red flags
4. Tratamento prático
5. Diferenciais
6. Outras formas de cobrança ENAMED/Revalida
7. Ponte para a 2ª fase

Não repetir: justificativas, raciocínio clínico, Dica Mestre, Estratégia da Aposta. Todo dado numérico/normativo segue o grounding estrito (`validarResumoSA`).

---

## 10. PRIMEIRA TAREFA NA RETOMADA (nesta ordem, PARAR e aguardar autorização antes de implementar qualquer coisa)

1. Auditar o padrão atual de construção do ENUNCIADO no prompt.
2. Comparar com questões Premium homologadas já existentes na plataforma.
3. Identificar por que algumas questões (ex. Q19) ficaram excessivamente secas.
4. Propor correção mínima (sem alongar artificialmente todas as questões).
5. Auditar eficiência de tokens/retries do Lote 002 (achado crítico 2).
6. Propor forma de evitar chamadas inúteis por grounding insuficiente, sem afrouxar segurança clínica.

Nenhuma geração, deploy ou alteração de produção deve ocorrer antes dessa auditoria ser apresentada e autorizada.
