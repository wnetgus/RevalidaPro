# ENGINE SUPER APOSTAS 2026.2
**STATUS: HOMOLOGADO / CONGELADO**
**Data:** 2026-07-23
**Ambiente:** revalidapro-dev (produção `revalidapro-f812e` não tocada)

---

## 1. Escopo do congelamento

A partir deste checkpoint, o motor de geração das Super Apostas 2026.2 **não deve ser alterado** (prompts, validadores, grounding, retry, caching, Resumo do Tema, Estratégia da Aposta) **sem bug crítico real e evidenciado**. Ajustes de conteúdo pontual (um recorte específico que falha) não justificam reabrir arquitetura — usar o mecanismo de feedback/retry já existente ou marcar o recorte como `REVISAO_HUMANA` em `src/config/recortesStatusSA.js`.

Isolamento preservado: ImportadorPro / edição 2026.1 (A–E) / fluxo INEP não foram alterados em nenhuma etapa desta calibração, exceto o efeito aditivo documentado do prompt caching (item 6), que é transporte, não lógica de negócio.

## 2. Componentes homologados

| Componente | Arquivo | Descrição |
|---|---|---|
| Formato ABCD | `promptEngine.js` — `PROMPT_SISTEMA_SUPERAPOSTAS_ABCD` | 4 alternativas, `nivel_aposta` semântico, `estrategiaAposta`, protocolo anti-pistas (REGRA SA-1) |
| Haiku primário + Opus fallback controlado | `promptEngine.js` — `executarGeracaoSA` | Tentativa 1 sempre Haiku; escalada para Opus por alto risco clínico ou falha corrigível repetida |
| **Teto único de 3 chamadas** | `promptEngine.js` — `executarGeracaoSA` | Substituiu o antigo `outer×inner` (até 9 chamadas/recorte); nunca reinicia externamente |
| Feedback de rejeição | `promptEngine.js` — `_classificarFalhaSA` | Tentativa seguinte recebe motivo curto da rejeição anterior, não a resposta inteira |
| Prompt caching | `functions/index.js` — `gerarQuestoesIA` | `cache_control: {type:"ephemeral"}` no bloco `system`; confirmado real via `cache_read_input_tokens`/`cache_creation_input_tokens` em testes ao vivo |
| Pré-check de grounding/recorte | `src/config/recortesStatusSA.js` — `statusRecorteSA` | Bloqueia ANTES da chamada à IA para recortes já sabidamente inviáveis (0 tokens gastos) |
| Grounding numérico/normativo estrito | `promptEngine.js` — `validarLoteSA`, `_numerosSemSuporte`, `_contemAfirmacaoForte` (estendido: sempre/nunca/obrigatório/em todos os casos) | Nenhum número ou afirmação absoluta sem sustento textual na diretriz injetada |
| Sanidade textual | `promptEngine.js` — `_contemCorrupcaoTextual` | Detecta corrupção de encoding (cirílico, replacement char, controle Unicode) |
| Resumo do Tema adaptativo | `promptEngine.js` — `PROMPT_SISTEMA_RESUMO_SA`, `validarResumoSA` | 1–7 blocos (nunca preenchido artificialmente); modo conservador sem grounding (item abaixo); dedup real via Firestore antes de gerar; status estruturado sempre logado (`gerarESalvarResumo` em `resumoEngine.js`) |
| Modo conservador do resumo sem grounding | `promptEngine.js` — seção "MODO CONSERVADOR" do prompt + checagem de número órfão em `validarResumoSA` | Proíbe posologia, idade de corte, limiar laboratorial, sequência protocolar rígida e linguagem absoluta sem fonte; testado com caso real (Cefaleia/idoso) |
| Estratégia da Aposta — 3 mini-cards | `src/pages/Simulador.jsx` | Reaproveita o padrão visual do Raciocínio Clínico (fundo `#020617` + borderTop de acento); `className="dica-cols"` para responsividade (3 colunas desktop, 1 mobile) |
| Modo validação — 1 questão/recorte | `src/components/RoboGerador.jsx` — `modoUmPorRecorte` | Opt-in, só ABCD, fluxo legado 2026.1 inalterado |
| Taxonomia canônica | `promptEngine.js` — `normalizarTemaMestre`, `MAPA_TEMA_MESTRE`, `PADROES_FRAGMENTADOS` | Compartilhada com ImportadorPro (pré-existente, não alterada nesta calibração) |
| Isolamento INEP/2026.1 | Todo o motor | `PROMPT_SISTEMA_RESUMO` (INEP) e `PROMPT_SISTEMA_ROBO`/`PROMPT_SISTEMA_IMPORTADOR` nunca tocados; caminho legado usa `MAX_RETRIES`/`QUESTOES_POR_TEMA` fixos, sem `executarGeracaoSA` |

## 3. Evidência de validação (dados reais, não simulados)

- Auditoria de custo original (Lote 002): ~173.600 input / ~39.000 output / 20 chamadas / 4 questões aprovadas.
- Teste pós-otimização (3 recortes livres): 4 chamadas / 4 aprovadas — chamadas por questão aprovada caiu de 5,0 para 1,0.
- Teste via função publicada em dev (3 recortes livres + 1 bloqueio de pré-check confirmado a custo zero).
- Hotfix de segurança do resumo: caso sintético Cefaleia/idoso sem grounding — validador endurecido aprovou 6/7 blocos, zero número órfão, zero afirmação absoluta, `TRATAMENTO PRÁTICO` omitido corretamente por falta de fonte.
- Validação final com 3 recortes reais do Mapa Mestre (R041, R034, R010): 2/3 produziram questão aprovada com resumo aprovado (7/7 e 6/7 blocos); R010 bloqueado corretamente pela trava SA-4 estendida (primeira vez testada em recorte não-clínico).

## 4. Limitações conhecidas e não resolvidas nesta fase

- Nenhuma ferramenta de automação de navegador disponível — toda gravação real no Firestore/confirmação visual no painel depende do operador humano clicar no RoboGerador real.
- `R022` aparece associado a 2 documentos nos registros históricos (`SA_2026_2_Q14` e `SA_2026_2_Q17`) — precisa verificação manual de qual prevalece.
- `SA_2026_2_Q1`–`Q6` não localizados em nenhum registro consultado — status desconhecido, recomenda-se conferência direta no Firestore.
- `SA_2026_2_Q22` não localizado em nenhum registro consultado.

## 5. Critério de reabertura

Só reabrir este congelamento mediante: (a) bug crítico real e reproduzível, (b) decisão explícita do responsável do produto. Ajuste de conteúdo pontual de um recorte específico não é motivo — usar `recortesStatusSA.js` para marcar `REVISAO_HUMANA`/`BLOQUEADO` caso a caso.

Documento não commitado — aguardando autorização explícita, conforme instrução.
