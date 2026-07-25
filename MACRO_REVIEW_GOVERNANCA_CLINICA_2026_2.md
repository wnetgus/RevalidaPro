# MACRO REVIEW — Auditoria Arquitetural da Governança de Diretrizes e Evidências (2026.2)

**Data:** 2026-07-24
**Tipo:** Auditoria read-only (nenhuma alteração de código de produção, nenhum deploy, nenhuma escrita no Firestore, nenhuma chamada à API Anthropic)
**Referências:** AUDITORIA_ATUALIZACAO_CLINICA_NORMATIVA_2026_2.md, MACRO_SPRINT_GOVERNANCA_CLINICA_2026_2.md, CONTROLE_PRODUCAO_SUPERAPOSTAS_2026_2.md, DOSSIER_VALIDACAO_DIRETRIZES_2026_2.md, MATRIZ_GROUNDING_R001_R120.md, PACOTE_VALIDACAO_HUMANA_DIRETRIZES_2026_2.md, commits `a3b8161`/`cda399f`/`239098a`.

---

## 1. Baseline

- Branch: `main`. HEAD: `239098a` (fim da Fase 3).
- Working tree: sujo, mas **nenhuma alteração feita por esta revisão** — as modificações listadas em `git status` (functions/index.js, firestore.rules, componentes de UI, package.json etc.) são trabalho pré-existente de outra frente (importação INEP), não tocado nesta auditoria.
- Build: `npx vite build --mode production` → **PASS** (743 módulos, único aviso pré-existente de chunk-size).
- Verificações manuais: `node scripts/test-diretrizes-governanca.js` → **35/35 passaram**.
- Lint (arquivos de governança): `npx eslint diretrizesControladas.js RoboGerador.jsx ImportadorPro.jsx ResumoGerador.jsx resumoEngine.js PainelDiretrizes.jsx` → 3 erros + 1 warning, **todos pré-existentes e não relacionados à governança** (variáveis não usadas em ImportadorPro/ResumoGerador, dependência de hook em RoboGerador) — nenhum novo erro introduzido por esta revisão (nenhum código foi alterado).
- Arquivos de governança confirmados: `src/config/diretrizesControladas.js` (751 linhas), `scripts/test-diretrizes-governanca.js`.
- Consumidores reais de `diretrizesControladas.js` (5, confirmados por grep): `RoboGerador.jsx`, `ImportadorPro.jsx`, `ResumoGerador.jsx`, `src/utils/resumoEngine.js`, `PainelDiretrizes.jsx`.
- Status das 11 diretrizes originais + 5 novas: todas `PENDENTE_REVISAO` (nenhuma `VIGENTE_CONFIRMADA`, nenhuma promovida). Módulos de HIV: `tarv_1a_linha` e `pep` = `PRONTA_PARA_VALIDACAO_HUMANA`; `diagnostico`, `gestacao`, `coinfeccoes`, `prep`, `acompanhamento`, `falha_terapeutica` = `PENDENTE_AJUSTE`.
- Comportamento atual do bloqueio: confirmado funcional **na lista estática** (testes 1–35). Ver Achado Crítico #1 (seção 2) sobre o comportamento real em produção via Firestore.
- Zero deploy, zero escrita no Firestore, zero chamada à API Anthropic nesta revisão — confirmado (nenhum comando de deploy, nenhum `setDoc`/`updateDoc` executado, nenhuma chamada a `chamarIA`/endpoint).

---

## 2. Mapa da Arquitetura Atual

### Fluxo real (RoboGerador.jsx, formato ABCD — único caminho com bloqueio ativo)

```
RECORTE (tema, 1 linha do textarea)
  │
  ▼
[1] statusRecorteSA(tema) ─── src/config/recortesStatusSA.js
  │   bloqueia recorte tecnicamente inviável (0 chamadas IA)
  ▼
[2] avaliarBloqueioDiretriz(diretrizesRef.current, tema, "")
  │   diretrizesRef.current = Firestore("diretrizes" ativas) OU DIRETRIZES_CONTROLADAS (fallback)
  │   bloqueia se: existe diretriz correspondente por palavra-chave E
  │                nenhuma correspondente está com status utilizável
  │   → BLOQUEADO: 0 chamadas IA, tema vai para temasFalhos, continue
  │   → LIBERADO ou SEM DIRETRIZ: segue
  ▼
[3] detectarDiretrizDinamica(diretrizesRef.current, tema, "") || detectarDiretriz(tema, "")
  │   re-seleciona (com filtro de status) a MELHOR diretriz utilizável, se houver
  ▼
[4] montarBlocoDiretriz(diretrizTema)  →  blocoDir (texto injetado no prompt)
  ▼
[5] prompt = Área + Tema + blocoDir + instruções
  ▼
[6] executarGeracaoSA(prompt, systemPrompt, {grounding, groundingTexto}, chamarIABruto)
  │   Anthropic Haiku → validarLoteSA (REGRA SA-1/3/4) → retry/Opus conforme motivo → teto 3
  ▼
[7] salvarQuestoes → Firestore "questoes"
```

### Funções, arquivos, responsabilidades

| Função | Arquivo | Responsabilidade |
|---|---|---|
| `avaliarBloqueioDiretriz` | diretrizesControladas.js | ÚNICO ponto que barra geração por status não vigente |
| `detectarDiretrizDinamica` / `detectarDiretriz` | diretrizesControladas.js | Seleciona diretriz utilizável para grounding (filtra status, mas NÃO bloqueia — silenciosamente retorna null se não houver nenhuma utilizável) |
| `montarBlocoDiretriz` | diretrizesControladas.js | Serializa diretriz em texto de prompt |
| `statusRecorteSA` | recortesStatusSA.js | Bloqueio por viabilidade técnica do recorte (independente de diretriz) |
| `validarLoteSA` | promptEngine.js | Valida saída da IA (REGRA SA-1/3/4) — não sabe nada sobre `status` de diretriz |

### Achado crítico #1 — a checagem de status pode ser inteiramente contornada pelo Firestore

`RoboGerador.jsx:699-708`, `ResumoGerador.jsx:320-328` e `ImportadorPro.jsx:764-778` compartilham o **mesmo padrão**:

```js
const snap = await getDocs(collection(db, "diretrizes"));
const ativas = snap.docs.map(d => d.data()).filter(d => d.ativa);
diretrizesRef.current = ativas.length > 0 ? ativas : DIRETRIZES_CONTROLADAS.filter(d => d.ativa);
```

Ou seja: **se o Firestore tiver qualquer diretriz ativa, ela substitui integralmente a lista estática** — o arquivo `diretrizesControladas.js` só é usado como fallback quando a coleção Firestore está vazia ou inacessível.

O problema: a função `semearBase()` em `PainelDiretrizes.jsx:289-314` (o único caminho que já escreveu diretrizes no Firestore, e o único que poderia voltar a escrever) grava apenas estes campos: `tema_id, tema, versao, fonte, ano, ativa, historica, substitui, palavrasChave, pontosCriticos, origem, updatedAt, criadoEm`. **Ela nunca gravou, e na forma atual nunca gravaria, os campos novos** (`status`, `statusDocumental`, `statusModulos`, `titulo`, `orgao`, `urlOficial`, `dataUltimaRevisao`, `revisadoPor`, `validadeOuProximaRevisao`, `observacoes`, `temasRelacionados`).

Consequência: **se a coleção `diretrizes` no Firestore de produção já contém documentos ativos** (o que é plausível — existe um painel administrativo inteiro dedicado a semeá-la, com um botão "Inicializar Base"), esses documentos não têm o campo `status`. Como `_statusUtilizavel(d) = d.status === undefined || d.status === VIGENTE_CONFIRMADA`, **um documento sem `status` é sempre tratado como vigente** — e `avaliarBloqueioDiretriz` nunca bloqueia nada, para nenhuma das 17 diretrizes, em produção, se a coleção Firestore estiver populada.

**Isto não foi verificado empiricamente contra o Firestore de produção nesta revisão** (zero acesso ao Firestore, por restrição explícita) — é uma conclusão de leitura de código, não uma confirmação de que a coleção está de fato populada. Mas a arquitetura do sistema (painel dedicado, texto "novas diretrizes publicadas pelo admin sejam usadas imediatamente, sem necessidade de novo deploy" em `RoboGerador.jsx:761`) indica fortemente que o uso pretendido é ter a coleção populada.

**Os 35 testes automatizados não detectam este risco** porque todos chamam `avaliarBloqueioDiretriz(DIRETRIZES_CONTROLADAS, ...)` diretamente sobre o array estático (confirmado por grep) — nunca simulam o formato de documento que realmente chega via Firestore. Isso quer dizer que a suíte dá falsa confiança sobre o comportamento em produção.

**Classificação: CRÍTICO.** Ver seção 15 (achado C1) e Fase 4A (seção 17).

### Achado crítico #2 — apenas 1 de 5 consumidores aplica o bloqueio

Ver tabela completa na seção 10. Resumo: `avaliarBloqueioDiretriz` só é chamado dentro do branch `if (formatoABCDAtual)` de `RoboGerador.jsx` (linha 771). Nenhum outro consumidor — nem mesmo o **caminho legado A–E do próprio RoboGerador.jsx** (branch `else`, linha 947 em diante, que usa `detectarDiretrizDinamica` diretamente sem nunca passar por `avaliarBloqueioDiretriz`) — aplica o bloqueio.

### Caminhos que ignoram a governança / podem usar diretriz não vigente

- **RoboGerador.jsx, formato legado A–E** (branch `else`): chama `detectarDiretrizDinamica`/`detectarDiretriz` (que já filtram por status) mas nunca `avaliarBloqueioDiretriz` — então, para um tema cuja única diretriz correspondente está `PENDENTE_REVISAO`, o legado simplesmente prossegue **sem grounding e sem aviso**, chamando a IA normalmente. Não é "usar diretriz desatualizada" (isso está bloqueado pelo filtro de status dentro de `detectarDiretrizDinamica`), mas é gerar conteúdo sensível sem grounding nenhum e sem qualquer log/registro do motivo.
- **ImportadorPro.jsx**: mesmo padrão — detecta diretriz (já filtrada por status) e injeta grounding se houver, mas nunca chama `avaliarBloqueioDiretriz`. Um tema sensível sem diretriz utilizável é importado/gerado sem bloqueio e sem aviso ao operador.
- **ResumoGerador.jsx** e **src/utils/resumoEngine.js**: idêntico — ambos chamam a IA (`fetch(ENDPOINT...)` / `chamarIA(...)`) para gerar resumos de tema, com grounding opcional via `montarBlocoDiretriz`, mas sem qualquer pré-checagem de bloqueio.

Nenhum desses 3 consumidores injetaria o **conteúdo de uma diretriz não vigente** (a filtragem de status em `detectarDiretrizDinamica` impede isso corretamente), mas todos eles podem **gerar conteúdo clínico sensível sem grounding algum, silenciosamente**, exatamente para os temas em que a Macro Sprint identificou risco (HAS, DM, rastreamento_colo, etc. enquanto `PENDENTE_REVISAO`). O `RoboGerador.jsx` ABCD é o único fluxo que transforma "sem diretriz utilizável" em bloqueio explícito com log.

---

## 3. Auditoria do Schema

| Campo | Finalidade | Obrigatório? | Tipo | Validação existente | Risco de ausência | Risco de inconsistência | Retrocompatível? | Recomendação |
|---|---|---|---|---|---|---|---|---|
| `id` | Chave estável do tema | Sim | string | Nenhuma (confiança de unicidade manual) | Duplicata silenciosa | Média | Sim | Manter |
| `tema` | Rótulo humano | Sim | string | Nenhuma | Baixo | Baixo | Sim | Manter |
| `titulo` | Nome oficial do documento | Não (só nas 11+5 revisadas) | string | Nenhuma | Baixo (campo informativo) | Baixo | Sim | Manter, tornar obrigatório ao criar novas entradas |
| `orgao` | Órgão emissor | Não | string | Nenhuma | Baixo | Baixo | Sim | Manter |
| `fonte`/`ano` | Grounding legado, injetado no prompt | Sim | string/number | Nenhuma | Alto — é o texto realmente visto pela IA | Alto se divergir de `titulo`/`anoPublicacao` | Sim | **Consolidar**: hoje há risco real de `fonte`/`ano` (legado, usado no prompt) divergir de `titulo`/`anoPublicacao`/`versao` (novo, só documental) — ver achado seção 8 |
| `urlOficial` | Rastreabilidade da fonte | Não | string (URL) | Nenhuma (não valida se resolve) | Médio — link pode já estar morto | Baixo | Sim | Manter; validação de URL viva é melhoria futura |
| `versao` | Identifica edição do documento | Não | string | Nenhuma | Médio | Alto se não sincronizado com `anoPublicacao` | Sim | Manter |
| `anoPublicacao` | Ano real de publicação da versão vigente | Não | number | Nenhuma | Médio | Alto — pode divergir de `ano` (campo legado do prompt) | Sim | Ver achado seção 8 |
| `dataUltimaRevisao` | Quando a entrada foi auditada por último | Não | string (ISO date) | Nenhuma | Médio — sem isso não dá para saber se uma entrada "PRONTA" está desatualizando | Baixo | Sim | Manter; é o campo-chave para disparar reauditoria periódica |
| `revisadoPor` | Quem confirmou humanamente | Não | string ou null | Nenhuma | Alto — hoje é sempre `null`, ou seja, **nada foi humanamente validado ainda**, correto por design | Baixo | Sim | Manter — deve permanecer `null` até aprovação real (não é bug, é o estado esperado) |
| `status` | Vigência de EXECUÇÃO (pode bloquear) | Não (ausência = utilizável) | enum `STATUS_DIRETRIZ` | Sim — `_statusUtilizavel` | **Alto** (ver achado #1: ausência silenciosa em documentos Firestore antigos permite bypass total) | Médio | Sim (por design) | Manter, mas ver Máquina de Estados (seção 6) |
| `statusDocumental` | Progresso da PESQUISA/redação (não bloqueia nada em runtime) | Não | string livre (`"PENDENTE_AJUSTE"`, `"PRONTA_PARA_VALIDACAO_HUMANA"`) | **Nenhuma** — é string livre, não enum | Baixo (é só documental) | **Alto** — não há enum, nada impede escrever `"pronta"` minúsculo ou um valor novo não prescrito | Sim | **Formalizar em enum** (ver seção 6) |
| `statusModulos` | Granularidade por sub-bloco (hoje só em `hiv`) | Não, só onde aplicável | objeto livre `{modulo: string}` | Nenhuma | Baixo (só 1 entrada usa) | Médio — não há verificação de que as chaves do objeto correspondem a módulos reais citados em `pontosCriticos` | Sim | Manter o padrão, mas exigir teste de correspondência módulo↔pontosCriticos quando usado |
| `substitui` | ID da versão anterior | Não | string ou null | Nenhuma | Médio | Baixo | Sim | Ver seção 5 |
| `historica` | Marca versão substituída/obsoleta | Sim (tem default `false`) | boolean | Nenhuma | Médio | **Alto** — não há garantia de que `historica: true` implica `status` não-utilizável (dois campos redundantes, não sincronizados por código) | Sim | Ver achado seção 5/8 |
| `validadeOuProximaRevisao` | Texto livre sobre o que falta revisar | Não | string livre | Nenhuma | Baixo | Baixo (é só leitura humana) | Sim | Manter como está — é justamente o texto que humaniza a limitação |
| `conteudoControlado`/`pontosCriticos` | O fato clínico em si, injetado no prompt | Sim | array de string | Nenhuma (não hey verificação de que os itens são atômicos, sem contradição interna) | **Alto** — é o único conteúdo que a IA realmente vê | Alto (ver seção 4) | Sim | Ver seção 4 |
| `observacoes` | Log de auditoria em prosa | Não | string livre | Nenhuma | Baixo | Baixo | Sim | Manter — é a melhor fonte de proveniência hoje, mas não é máquina-legível |
| `temasRelacionados` | IDs de recorte (Mapa Mestre) cobertos | Não | array de string (`"R017"`) | Nenhuma — não verifica se o Rxxx existe na matriz de 120 | Médio | Médio (pode ficar dessincronizado da matriz) | Sim | Manter, adicionar verificação cruzada com a matriz como melhoria futura |
| `ativa` | Legado — se a diretriz participa da detecção | Sim | boolean | Nenhuma | Alto (é o único filtro de "participa ou não" usado por `_candidatasPorPalavraChave`) | Baixo | Sim | Manter |
| `palavrasChave` | Gatilho de detecção | Sim | array de string | Parcial (`_PALAVRAS_FRONTEIRA_OBRIGATORIA` para 4 palavras curtas) | Alto (falso positivo/negativo de matching) | Médio | Sim | Manter, ver seção 8 (duplicação) |

### Respostas diretas

**A. O schema distingue corretamente status de execução, status documental, validação humana e vigência científica?**
Parcialmente. `status` (execução, formal, enum, bloqueia) e `statusDocumental` (pesquisa, string livre, não bloqueia nada) são **conceitualmente** distintos e isso é correto. Mas:
- Não existe um campo formal de "validação humana" — hoje isso é inferido pela combinação `revisadoPor !== null` (nunca preenchido ainda) e o texto solto em `PACOTE_VALIDACAO_HUMANA...md`, que é um **arquivo desconectado do sistema em runtime** (não é lido por nenhum código, só por humanos).
- "Vigência científica" (o documento oficial ainda é o mais atual existente no mundo real) não tem campo próprio — está misturado dentro de `observacoes` (prosa) e nas notas de `pontosCriticos` ("confirmado por leitura direta" vs. "não relido").

**B. Há risco de estados contraditórios?**
Sim, e o exemplo do próprio enunciado do usuário **já existe hoje, de fato**: `hiv.status = "PENDENTE_REVISAO"` (nível de execução, bloqueia) enquanto `hiv.statusModulos.tarv_1a_linha = "PRONTA_PARA_VALIDACAO_HUMANA"` (nível documental do módulo, não bloqueia nada porque `avaliarBloqueioDiretriz` só olha o campo `status` da diretriz-pai, nunca `statusModulos`). Isso está correto no sentido de "fail-closed" (a diretriz pai continua bloqueada até um humano decidir módulo a módulo), mas **o código não tem nenhuma lógica que leia `statusModulos` para decisão de bloqueio** — hoje é só um registro informativo para o revisor humano. Se no futuro alguém promover `hiv.status` para `VIGENTE_CONFIRMADA` sem antes reconciliar os módulos ainda `PENDENTE_AJUSTE`, o sistema passaria a liberar geração para TODOS os módulos de HIV, incluindo os não revisados — **risco real, hoje mitigado apenas por disciplina humana, não por código**.

**C. É necessário criar uma máquina de estados formal?**
Sim — ver seção 6. Hoje "máquina de estados" é, na prática, um enum sem transições codificadas: nada impede (em código) que alguém escreva `status: "aprovado_hoje"` (typo) e isso silenciosamente vire "não utilizável, mas sem motivo reconhecido" (o `motivoPorStatus` cai no `default` genérico) — não é um crash, mas é uma inconsistência silenciosa não testada.

---

## 4. Governança de Evidência Atômica

**`conteudoControlado`/`pontosCriticos` hoje é um array de strings em prosa longa** — cada item mistura frequentemente múltiplos fatos (ex.: o item de classificação de HAS reúne 5 faixas pressóricas + uma nota de correção + uma citação de fonte, tudo em uma única string). **Não são unidades atômicas.**

Modelo mínimo seguro proposto (não implementado nesta revisão):

```
{
  evidenceId: "has_2025_estagio_pa",      // id do fato
  afirmacao: "PA Estágio 1: 140-159 e/ou 90-99 mmHg",
  populacao: "adultos, exceto gestantes",
  condicao: null,
  excecoes: ["gestante — ver evidenceId has_2025_gestante_tto"],
  modulo: null,                            // ou nome do módulo, se aplicável (caso HIV)
  fonte: "Arq Bras Cardiol 2025;122(9):e20250624",
  versao: "Edição 2025",
  secao: "Quadro 3.2/14.1",
  pagina: null,                            // não disponível no PDF extraído por texto puro
  trechoSuporte: "citação direta ou resumo fiel do trecho",
  dataConferencia: "2026-07-24",
  conferidoPor: null,                      // humano, não a IA
  statusFato: "PENDENTE_REVISAO",
  risco: "alto",
  validade: null,
  substitui: "has_2024_estagio_pa",
  incompatibilidades: [],                  // outros evidenceIds em conflito conhecido
  tiposQuestaoPermitidos: ["diagnostico", "classificacao"],
}
```

### Respostas diretas

- **Hoje os fatos são unidades realmente atômicas?** Não. Um item de `pontosCriticos` frequentemente cobre 2–4 fatos distintos (classificação + gestante + fonte, no exemplo de HAS).
- **Existe conteúdo excessivamente amplo?** Sim — o item de classificação de PA (HAS) e o item de dTpa (vacinacao, que cobre gestante+puérpera+profissional em uma frase) são exemplos concretos já neste arquivo.
- **Dois fatos podem se contradizer dentro da mesma diretriz?** Sim, de forma já documentada: `diverticulite` tem conflito interno aberto e não resolvido entre o próprio `pontosCriticos` da diretriz e o recorte R111 do Mapa Mestre (registrado explicitamente como `PENDENTE_AJUSTE`, não escondido).
- **Um fato antigo pode continuar injetado após nova versão?** Sim — nada no código impede isso hoje. Se uma diretriz for atualizada (nova versão do array), o `montarBlocoDiretriz` sempre serializa **a diretriz inteira** (todo o array `pontosCriticos` atual), então não há risco de "meio-antigo, meio-novo" **dentro da mesma execução**, mas não há qualquer registro de qual conjunto de `pontosCriticos` foi realmente injetado em uma questão já salva no Firestore — se o array mudar amanhã, não há como saber retroativamente qual texto exato uma questão de 2 meses atrás recebeu.
- **É possível rastrear exatamente qual fato sustentou uma questão?** Não. `RoboGerador.jsx` grava `fonte_diretriz`/`ano_diretriz` (campos do documento Firestore da questão — legado), mas nunca o conjunto exato de `pontosCriticos` (nem um hash, nem um snapshot) usado naquela geração específica.
- **Existe necessidade de um `evidenceId` persistido na questão?** Sim, é a lacuna mais concreta de rastreabilidade do sistema — ver seção 9.

**Nenhuma implementação foi feita nesta seção** (conforme instrução explícita) — apenas o modelo mínimo é proposto.

---

## 5. Versionamento e Substituição

Hoje existem apenas 2 campos para isso: `substitui` (ID da versão anterior, sempre `null` nas 17 entradas atuais) e `historica` (boolean, sempre `false`). **Nenhuma das 17 entradas atuais tem uma "versão anterior" registrada** — todas são a única versão conhecida de cada tema. Isso significa que o mecanismo nunca foi exercitado na prática; ele existe só como campo vazio.

### Avaliação: `historica` e `substitui` são suficientes?

**Não**, por 3 razões concretas:
1. **Não há verificação de código que impeça uma diretriz `historica: true` de ainda ser selecionada.** `_candidatasPorPalavraChave` filtra só por `d.ativa`, não por `d.historica`. Hoje isso não causa bug porque toda vez que alguém marcaria `historica: true` no painel (`tornarHistorica()`), o mesmo botão já seta `ativa: false` — mas são **dois campos setados manualmente juntos por convenção de UI**, não uma garantia estrutural. Um `historica: true, ativa: true` (possível via edição direta/`adicionarNovaVersao`, que nunca seta `historica`) passaria despercebido.
2. **Nenhum campo registra "esta versão substituída sustentou quais questões já geradas".** Sem isso, o passo "identificar questões que precisam de reauditoria" (pedido explicitamente pelo usuário) é hoje impossível de automatizar — teria que ser feito lendo manualmente `fonte_diretriz`/`ano_diretriz` de cada questão salva.
3. **Não há distinção entre "nova edição substitui" vs. "errata pontual" vs. "nota técnica temporária"** — qualquer mudança de conteúdo hoje é só uma edição direta do array de `pontosCriticos`, sem histórico de diffs versionado (o `git log` do arquivo é o único histórico real, e ele mistura mudanças de schema com mudanças de conteúdo clínico).

### Regras formais propostas (não implementadas)

1. Nova versão = nova entrada com `id` próprio (`has_2025`, mantendo `has` ou `has_2016` como histórica) — nunca sobrescrever o array `pontosCriticos` de uma entrada existente sem preservar o texto anterior em algum lugar rastreável (hoje isso já é feito parcialmente via `observacoes`, mas em prosa, não estruturado).
2. `historica: true` deve ser uma condição **suficiente e verificada em código** para exclusão de `_candidatasPorPalavraChave` (hoje não é checada ali — só `ativa` é).
3. Marcar versão anterior: setar `substitui: "<id_antigo>"` na nova, e `status: SUBSTITUIDA` + `historica: true` na antiga — hoje nada força essa dupla escrita atômica.
4. `temasRelacionados` deveria migrar automaticamente da versão antiga para a nova ao substituir (hoje seria cópia manual, sujeita a esquecimento).
5. Um campo `questoesGeradasComEstaVersao` (ou equivalente via seção 9) permitiria saber quais questões usaram a versão substituída.
6. "Identificar questões que precisam de reauditoria" depende inteiramente do ponto anterior — hoje não há como fazer isso sem uma varredura manual do Firestore de questões cruzando `fonte_diretriz`/`ano_diretriz` texto-a-texto.
7. Reverter uma promoção incorreta hoje seria uma edição manual de `status` de volta — sem log de quem/quando promoveu, e sem log de quem/quando reverteu (não há campo de auditoria de transição, só `dataUltimaRevisao`/`revisadoPor`, que registram a revisão de conteúdo, não a transição de estado).
8. Vigência com data futura (ex.: uma diretriz que só passa a valer a partir de uma data de implementação do SUS) não tem campo hoje — a única aproximação é a prosa em `observacoes` (caso `rastreamento_colo`, que já documenta explicitamente essa lacuna: "distinção entre norma vigente, implementação gradual e transição temporária não foi feita").
9. Documentos sem prazo explícito (a maioria dos 17) não têm um valor sentinela — `validadeOuProximaRevisao` é texto livre, não uma data, então não dá para consultar programaticamente "quais diretrizes vencem nos próximos 90 dias".

---

## 6. Máquina de Estados Proposta

```
ESTADOS DOCUMENTAIS (campo statusDocumental — hoje string livre, proposta: enum)
  NAO_INICIADA
      → EM_PESQUISA            [transição: início de leitura de fonte primária]
  EM_PESQUISA
      → PENDENTE_AJUSTE         [leitura parcial, divergência/lacuna encontrada]
      → PRONTA_PARA_VALIDACAO_HUMANA  [leitura integral + confirmação por citação direta]
  PENDENTE_AJUSTE
      → EM_PESQUISA             [retomada de leitura]
  PRONTA_PARA_VALIDACAO_HUMANA
      → VALIDADA                [SOMENTE por ação humana explícita — revisadoPor preenchido]
      → REJEITADA               [SOMENTE por ação humana explícita]
      → PENDENTE_AJUSTE         [humano pede ajuste antes de aprovar]
  VALIDADA
      → DESATUALIZADA           [nova edição do documento oficial é publicada]
      → SUBSTITUIDA             [nova entrada já validada assume o lugar]
  DESATUALIZADA / SUBSTITUIDA / REJEITADA / BLOQUEADA
      → (estados terminais para a versão; nova pesquisa cria NOVA entrada, não reabre esta)

ESTADOS DE EXECUÇÃO (campo status — já existe, já formal)
  LIBERADA        (hoje: status === undefined || VIGENTE_CONFIRMADA)
  BLOQUEADA       (hoje: qualquer status !== VIGENTE_CONFIRMADA/undefined)
  REVISAO_NECESSARIA  (não existe hoje como estado distinto de BLOQUEADA — proposta: usar quando
                       statusDocumental = PRONTA_PARA_VALIDACAO_HUMANA, para diferenciar no log/UI
                       "bloqueado por falta de pesquisa" de "bloqueado só esperando aprovação humana")
```

### Regras de transição

- **Quem pode executar cada transição:** hoje, NINGUÉM via UI — todas as transições de `status`/`statusDocumental` só acontecem por edição direta do arquivo-fonte por um desenvolvedor. Não existe controle de permissão porque não existe superfície de UI para isso (achado da seção 2/10: `PainelDiretrizes.jsx` não expõe estes campos).
- **Condição para `VALIDADA`:** deveria exigir, no mínimo, `revisadoPor !== null` E `dataUltimaRevisao` preenchida E `statusDocumental === PRONTA_PARA_VALIDACAO_HUMANA` antes da transição — hoje nada impõe isso porque a transição em si não existe em código, só na convenção documental do time.
- **Condição para `LIBERADA` (status de execução):** só deveria acontecer quando `status` (documental/execução) vira `VIGENTE_CONFIRMADA`, e isso só deveria ser setado programaticamente como consequência de `statusDocumental === VALIDADA` — hoje os dois campos são editados independentemente, sem essa trava.
- **Comportamento de módulos:** a diretriz-pai deveria permanecer bloqueada enquanto qualquer módulo citado em `pontosCriticos` não estiver com o `statusModulos` correspondente em `VALIDADA` — hoje isso é responsabilidade 100% humana/documental, não verificada em código (achado B da seção 3).
- **Impedimento de promoção automática:** já existe e é testado (caso 35 do script) — nenhuma diretriz nasce ou é promovida a `VIGENTE_CONFIRMADA` automaticamente, e isso é o comportamento correto/desejado hoje.
- **Auditoria da mudança de status:** não existe hoje — a única "auditoria" é o `git blame`/`git log` do arquivo-fonte, que não é uma trilha formal de aprovação (não registra quem clicou "aprovar", porque não existe "clicar aprovar").

**Recomendação: não criar estados redundantes.** Os estados propostos acima são os mínimos necessários para fechar as lacunas já identificadas — não há necessidade de estados adicionais (ex.: não é preciso separar "em pesquisa por IA" de "em pesquisa por humano", isso seria complexidade sem benefício comprovado agora).

---

## 7. Política de Divergências entre Fontes

**Hoje não existe estrutura de dados para registrar divergências** — elas são documentadas apenas em prosa dentro de `observacoes` (ex.: o conflito `diverticulite`×R111, ou a nota de HAS sobre "distinção SBC×MS×internacional não foi feita"). Isso é honesto, mas não é consultável programaticamente nem obriga decisão.

### Proposta de estrutura (não implementada)

```
divergencias: [{
  fontesConflitantes: ["WSES 2020", "recorte R111 do Mapa Mestre"],
  natureza: "manejo antibiótico de diverticulite não complicada",
  populacao: "adultos, diverticulite Hinchey I",
  contexto: "ambulatorial vs. internado",
  decisaoAdotada: null,          // OBRIGATORIAMENTE null até decisão humana
  justificativa: null,
  responsavel: null,
  data: null,
  revisaoFutura: "2026-10",
}]
```

### Regra obrigatória (já respeitada nesta sessão e em todas as anteriores)

**Nenhuma divergência foi resolvida silenciosamente pela IA em nenhuma das 3 fases anteriores** — confirmado por code review: `diverticulite` permanece `PENDENTE_AJUSTE` com o conflito descrito explicitamente em `observacoes`, nunca "escolhido" um lado. Esta prática deve continuar formal (campo estruturado) em vez de só prosa, para poder ser consultada por script/relatório sem depender de leitura humana de texto livre.

---

## 8. Duplicação e Consistência

### Riscos concretos já identificados nesta revisão

- **`fonte`/`ano` (legado, usado no prompt) vs. `titulo`/`anoPublicacao`/`versao` (novo, documental) podem divergir e HOJE já divergem em pelo menos 2 entradas**: `has` tem `ano: 2024` mas `anoPublicacao: 2025` e `titulo` menciona "2025 (atualização da 7ª Diretriz)" — o texto que é de fato injetado no prompt (`fonte`, via `montarBlocoDiretriz`) ainda diz "SBC/SBH 2024", enquanto a pesquisa real confirmada é da edição 2025. Isso é uma **inconsistência real e presente no arquivo hoje**, não hipotética — o modelo de IA recebe "ANO DE REFERÊNCIA: 2024" mesmo a diretriz tendo sido confirmada como edição 2025 por leitura direta. Mesmo padrão em `rastreamento_colo` (`ano: 2023` vs. `anoPublicacao: 2025`) e `vacinacao` (`ano: 2024` vs. `anoPublicacao: 2026`).
- **HIV, PEP e PrEP**: já tratados corretamente como documentos distintos dentro de uma única entrada (`statusModulos`), sem duplicar a entrada inteira — mas os 3 compartilham as mesmas `palavrasChave` (ex. "hiv", "aids"), então **um tema que só deveria casar com PEP também casa com a entrada inteira de HIV**, incluindo TARV/diagnóstico/etc. no bloco injetado (`montarBlocoDiretriz` sempre serializa TODOS os `pontosCriticos`, não filtra por módulo). Ou seja: mesmo com `statusModulos` granular, o prompt real injetado hoje sempre inclui todos os módulos (inclusive os `PENDENTE_AJUSTE`) misturados com os `PRONTA_PARA_VALIDACAO_HUMANA` — **o bloqueio por status de módulo não existe na prática de geração**, só na documentação.
- **Ética médica e violência doméstica**: não há duplicação de conteúdo hoje (são entradas com escopos claramente distintos — sigilo profissional vs. Lei Maria da Penha), mas ambas compartilham o campo conceitual "dever legal de notificação", citado em prosa separadamente em cada uma — risco baixo de divergência textual futura se um dos dois for atualizado sem revisar o outro.
- **Vacinação geral vs. calendários por população** (gestante em `prenatal`, dTpa em `vacinacao`): **duplicação confirmada** — o esquema de dTpa na gestação aparece tanto em `prenatal.pontosCriticos` ("dTpa (20–36 sem de cada gestação)") quanto em `vacinacao.pontosCriticos` (corrigido na Fase 3 para "a partir da 20ª semana... sem confirmação do limite de 36 semanas"). **As duas entradas hoje têm textos DIFERENTES para o mesmo fato** (uma ainda cita "20-36 semanas", a outra já foi corrigida para remover o limite superior) — isso é uma divergência interna real, introduzida como efeito colateral de uma correção feita em uma entrada (`vacinacao`) sem propagar para a outra (`prenatal`).

### Respostas diretas

- **Como detectar fatos duplicados?** Hoje, só manualmente (foi assim que os dois achados acima foram encontrados nesta auditoria). Não há verificação automática.
- **Como impedir versões divergentes do mesmo fato?** Precisaria de um identificador de fato compartilhável entre entradas (ver `evidenceId`, seção 4) — hoje cada entrada é uma ilha de texto.
- **Deve existir identificador global de fato clínico?** Sim, recomendado para o médio prazo (Fase 4B/C), não urgente para os próximos 15 recortes.
- **Deve haver uma única fonte de verdade?** Sim — hoje `prenatal` e `vacinacao` já violam isso para dTpa gestacional; o achado acima (divergência real de texto) é evidência concreta, não hipotética.
- **`diretrizesControladas.js` ainda é adequado ou está grande demais?** Em 751 linhas / 17 entradas, ainda é gerenciável para leitura humana e diffs de PR. Não está "grande demais" ainda.
- **Em que ponto migrar para arquivos separados ou banco versionado?** Recomendação: dividir por arquivo quando ultrapassar ~30-40 entradas OU quando o arquivo ultrapassar ~1500 linhas — o que vier primeiro. Hoje (17 entradas, 751 linhas) não há necessidade.
- **Solução mínima que atende agora, sem superarquitetura:** corrigir a divergência dTpa gestante↔prenatal (fato pontual, baixo custo) e sincronizar `ano`/`anoPublicacao` nas 3 entradas onde já divergem — ambos ficam para Fase 4A/B, não implementados aqui.

---

## 9. Rastreabilidade da Questão

### O que uma questão gerada hoje registra (confirmado em RoboGerador.jsx/salvarQuestoes)

`fonte_diretriz` e `ano_diretriz` — apenas isso, do lado de grounding. Não registra: recorte de origem (Rxxx) de forma estruturada e obrigatória, versão exata da diretriz, quais `pontosCriticos` específicos sustentaram a questão, data de validação humana, responsável clínico, status científico no momento da geração, ou necessidade futura de reauditoria.

### Menor conjunto de metadados proposto (não implementado)

```
{
  recorteOrigem: "R034",
  diretrizId: "has",
  diretrizVersao: "Edição 2025",
  moduloUsado: null,
  evidenceIdsUsados: ["has_2025_estagio_pa", "has_2025_gestante_tto"],  // requer seção 4
  dataGeracao: "2026-07-24T...",
  statusCientificoNaGeracao: "PENDENTE_REVISAO",  // snapshot do status no momento — crítico!
  precisaReauditoria: false,  // setado para true automaticamente se diretriz mudar de status depois
}
```

Isso permitiria exatamente os 5 usos pedidos: (1) descobrir questões afetadas por uma atualização — via busca por `diretrizId`+`diretrizVersao`; (2) bloquear publicação de questão com fonte revogada — checagem no momento de exibir ao aluno; (3) revalidar só as impactadas — filtro por `evidenceIdsUsados`; (4) preservar histórico — o snapshot `statusCientificoNaGeracao` nunca muda retroativamente; (5) informar a fonte internamente sem expor ao aluno — os campos ficam no documento Firestore da questão, não no componente de UI do simulado.

**Nenhuma alteração de Firestore foi feita nesta revisão.** Esta é uma proposta para Fase 4, condicionada a nova autorização.

---

## 10. Consumidores e Superfície de Bloqueio

| Consumidor | Usa `avaliarBloqueioDiretriz`? | Bloqueia antes da IA? | Chama IA? | Risco | Correção futura |
|---|---|---|---|---|---|
| `RoboGerador.jsx` — formato ABCD (2026.2) | **Sim** (linha 772) | **Sim** | Sim (`executarGeracaoSA`) | Baixo, MAS depende de `diretrizesRef.current` vir com o campo `status` — ver Achado #1 | — |
| `RoboGerador.jsx` — formato legado A–E | Não | Não | Sim (retry simples) | Médio-Alto — gera sem grounding e sem aviso quando diretriz não está utilizável | Aplicar mesmo pré-check do ABCD, ou descontinuar o legado |
| `ImportadorPro.jsx` | Não | Não | Sim (`fetch` → Anthropic, linha 975) | Médio-Alto — mesmo padrão do legado | Adicionar `avaliarBloqueioDiretriz` antes da chamada |
| `ResumoGerador.jsx` | Não | Não | Sim (`fetch` ao ENDPOINT, linhas 182/346) | Médio — gera resumo de tema sensível sem grounding, sem bloqueio | Adicionar pré-check equivalente |
| `src/utils/resumoEngine.js` | Não | Não | Sim (`chamarIA`, linha 234) | Médio — mesmo padrão | Adicionar pré-check equivalente |
| `PainelDiretrizes.jsx` | Não (nem precisa — não gera conteúdo) | N/A | Não | Baixo para geração, mas **Alto para governança**: é o único painel administrativo e não expõe `status`/`statusDocumental`/`statusModulos`/`revisadoPor` em nenhuma tela — não há hoje nenhum jeito de um humano validar uma diretriz através da UI | Estender o painel para exibir/editar os campos novos (Fase 4C) |

**Nenhum consumidor opera fora do fluxo ABCD sem ao menos passar por `detectarDiretrizDinamica`/`detectarDiretriz`** (ou seja, nenhum injeta diretamente o conteúdo de uma diretriz não-utilizável) — o gap real é a ausência do **bloqueio explícito com log** fora do ABCD, não a injeção indevida de conteúdo desatualizado.

---

## 11. Análise dos Testes

### Classificação honesta (conforme exigido — não chamar tudo de "suíte completa")

- **`scripts/test-diretrizes-governanca.js` (35 casos):** são **scripts manuais de verificação de governança** rodados via `node`, usando `node:assert/strict`. Não são testes de integração (não sobem a aplicação, não simulam Firestore, não renderizam componentes React) nem testes unitários no sentido estrito de framework (sem Jest/Vitest, sem mocks, sem describe/it) — são scripts avulsos que testam funções puras exportadas de um único arquivo.
- **`npx vite build`** é build, não teste.
- **`npx eslint`** é lint estático, não teste de comportamento.
- **Validação documental** (dossiês, matriz, pacote) é revisão humana em prosa, não verificação automatizada.

### Respostas diretas

- **Os 35 testes podem produzir falso positivo?** Sim, de forma confirmada nesta revisão: todos chamam as funções passando `DIRETRIZES_CONTROLADAS` diretamente — nenhum simula o formato real de documento vindo do Firestore (que pode faltar o campo `status`). Um teste passa hoje ("diretriz X está bloqueada") mas isso não garante que o bloqueio realmente acontece em produção se o Firestore estiver populado com documentos antigos (Achado #1).
- **Dependem da forma interna do arquivo?** Sim — vários casos usam `DIRETRIZES_CONTROLADAS.find(x => x.id === "...")`, acoplados à estrutura interna do array, não a um contrato de API estável.
- **Testam comportamento real ou só strings/objetos?** Majoritariamente strings/objetos (ex.: "o texto de `pontosCriticos` contém a palavra X") — poucos testam efetivamente o "0 chamadas à IA" fim-a-fim (o teste 23 chega mais perto, mas ainda comparando o sinal `bloqueado` isoladamente, não executando `RoboGerador.jsx` de fato).
- **Testam chamada bloqueada antes da IA?** Indiretamente (teste 23 verifica que o mesmo sinal usado por `RoboGerador.jsx` para `continue` é produzido) — não é um teste end-to-end real do componente.
- **Testam todos os consumidores?** Não — testam apenas as funções de `diretrizesControladas.js` isoladamente. Nenhum teste cobre `ImportadorPro.jsx`, `ResumoGerador.jsx` ou `resumoEngine.js` (que, como visto na seção 10, nem chamam a função de bloqueio).
- **Falta framework integrado?** Sim — não há Jest/Vitest/Testing Library no projeto (confirmado: `package.json` sem essas dependências).
- **É necessário testar DOM/UI?** Não com prioridade alta agora — o risco maior está na lógica pura (seleção/bloqueio de diretriz), testável sem DOM. Testar UI (ex.: `PainelDiretrizes.jsx` renderizando corretamente o novo status) só se torna relevante depois que o painel for estendido para expor esses campos (Fase 4C).
- **Estratégia mínima recomendada:** manter os scripts manuais para a lógica pura (já cobrem bem isso), e adicionar **um teste de integração leve e específico** que simule um documento Firestore no formato real (sem campo `status`) sendo passado para `avaliarBloqueioDiretriz`/`detectarDiretrizDinamica`, para expor o Achado #1 de forma automatizada — isto é pequeno, não exige instalar framework novo (pode continuar em `node:assert`).
- **Testes críticos antes do deploy:** (1) o teste acima do formato Firestore real; (2) um teste que verifique que os 3 consumidores sem bloqueio (`ImportadorPro`, `ResumoGerador`, `resumoEngine`) ou já têm o pré-check, ou está documentado como risco aceito explicitamente.

### Pirâmide mínima proposta (não instalar nada ainda)

```
        ▲  poucos: testes de integração leves (simular shape Firestore, sem framework novo)
       ▲▲▲ mais: scripts manuais de governança (já existem, 35 casos, manter)
     ▲▲▲▲▲ base: nenhuma mudança — funções puras já são fáceis de testar sem DOM
```

---

## 12. Segurança Operacional

| Risco | Situação hoje |
|---|---|
| Liberar diretriz sem revisor | Impossível hoje — não há UI para promover `status`, só edição manual de arquivo (que passa por commit/review humano de qualquer forma) |
| Esquecer `status` | **Confirmado como o Achado #1** — documentos Firestore antigos já "esquecem" o campo por definição, e isso é tratado como vigente, não como bloqueio |
| `dataUltimaRevisao` vazia | Seria interpretada como "nunca revisada" só por ausência — não há alarme ativo, só leitura manual |
| URL inválida | Não verificado — `urlOficial` pode apontar para link morto sem detecção |
| Documento inacessível | Já ocorreu nesta sessão (bvsms.saude.gov.br, planalto.gov.br) — tratado manualmente, documentado como limitação, nunca escondido |
| Módulo filho pronto e pai incoerente | Existe hoje (`hiv`) e é tratado corretamente (pai continua bloqueado) — mas por ausência de lógica de módulo no bloqueio, não por design explícito de segurança (ver seção 3B) |
| Edição manual quebrar schema | Sem validação de schema (nenhum JSON Schema/Zod) — um campo com tipo errado (`status: 123`) não quebraria a aplicação (JS é dinâmico), mas produziria `motivoPorStatus[123] === undefined` → cairia no fallback genérico, não travaria |
| Conteúdo antigo em cache | `diretrizesRef.current`/`diretrizesAtivas` são carregados 1x por sessão do navegador (useRef/useState) — uma correção no Firestore só valeria a partir do próximo reload da página, não em tempo real durante uma sessão longa de geração em lote |
| Deploy com produção parcialmente bloqueada | Não é um risco identificado — bloqueios são por tema, não globais |
| Falha silenciosa cair para comportamento antigo | **Sim, por design, em 2 lugares**: erro ao ler Firestore → fallback para lista estática (log explícito "Firestore indisponível"); diretriz sem `status` → tratada como vigente (não logado como "assumindo vigente", só correto quando é realmente o caso das 6 entradas nunca auditadas) |
| Firestore indisponível usar lista estática desatualizada | Comportamento correto quando Firestore está de fato indisponível (fallback explícito, logado) — **o risco real é o oposto** (Firestore disponível mas com dados incompletos, Achado #1), não a indisponibilidade |
| Fonte externa mudar sem detecção | Sim — não há vigilância automática do documento oficial em si (existe `fontesVigilancia.js`/`vigilanciaDiretrizes` no PainelDiretrizes, mas é sobre periodicidade de revisão, não sobre monitorar se a URL mudou de conteúdo) |
| Recorte classificado incorretamente como qualitativo | **Já ocorreu e foi corrigido nesta sessão** (R036/distocia_ombro na Fase 2 → Fase 3) — o processo de reauditoria manual funcionou como pretendido |

### Fail-safe proposto: "na dúvida, bloquear conteúdo protocolar"

Já é o comportamento de `avaliarBloqueioDiretriz` **quando o campo `status` está presente e não-vigente**. **Não é o comportamento quando o campo está ausente** — hoje ausência = permissão, não bloqueio. Esta é a inversão de fail-safe mais importante a corrigir na Fase 4A: para os consumidores/fontes que vêm de Firestore, a ausência de `status` deveria, no mínimo, gerar um aviso de "vigência não confirmada" em vez de silêncio total — hoje é silêncio total.

---

## 13. Escalabilidade

- **11-17 diretrizes hoje:** arquivo único é perfeitamente adequado.
- **50 diretrizes:** ainda gerenciável em arquivo único, mas o schema sem validação (seção 3) começa a pesar — recomendação: adicionar validação leve (schema check no build, não necessariamente Zod completo) antes de chegar a esse número.
- **200 diretrizes:** ponto razoável para dividir por domínio/área (ex.: `diretrizes/cardiovascular.js`, `diretrizes/infecciosas.js`) — não precisa de banco de dados só por causa do volume, mas o arquivo único vira difícil de revisar em PR.
- **Múltiplos módulos por diretriz:** o padrão `statusModulos` (hoje só em `hiv`) escala bem estruturalmente, mas precisa da correção da seção 8 (bloqueio real por módulo, não só documental) antes de depender dele para mais entradas.
- **Revisão semestral / vários revisores:** hoje `revisadoPor` é um único campo string — não suporta múltiplos revisores por entrada nem histórico de revisões. Suficiente para 1 revisor médico (o caso atual, Dr. Weyne), insuficiente se a equipe crescer.
- **Histórico de versões:** ver seção 5 — hoje inexistente na prática (`substitui`/`historica` nunca exercitados).
- **Milhares de questões / busca de impacto:** depende inteiramente da seção 9 (metadados na questão) — hoje impossível sem varredura manual.
- **Quando migrar para Firestore/repositório versionado:** o sistema **já usa Firestore** como fonte primária em runtime (Achado #1!) — a pergunta certa não é "quando migrar", é "quando sincronizar corretamente o schema novo para lá", que é anterior a qualquer migração maior.
- **Como evitar dependência excessiva do Firestore:** o fallback estático já existe e funciona bem para indisponibilidade — o problema não é dependência excessiva, é **inconsistência de schema entre as duas fontes** (Achado #1).
- **Arquitetura recomendada:**
  - **Agora:** arquivo único + corrigir Achado #1 (sincronizar schema Firestore↔estático) — sem migração de armazenamento.
  - **6 meses:** dividir por domínio se ultrapassar ~40 entradas; adicionar validação de schema no build; estender `PainelDiretrizes.jsx` para expor os campos novos.
  - **2 anos:** se o volume de questões justificar, considerar um `evidenceId` central em coleção Firestore própria (não mais array estático) com histórico de versão nativo — só se o volume real demandar, não antecipar.

---

## 14. ADRs Propostos

- **ADR 1 — Diretriz não é fato clínico.** Uma diretriz é um documento/fonte; fatos clínicos individuais (`pontosCriticos`) deveriam ser endereçáveis independentemente (ver seção 4). Status: proposto, não implementado.
- **ADR 2 — Status documental separado de status de execução.** Já implementado (`status` vs. `statusDocumental`) — ratificar como decisão permanente.
- **ADR 3 — Nenhuma validação automática.** Já implementado e testado (caso 35) — ratificar.
- **ADR 4 — Fatos clínicos precisam de rastreabilidade (evidenceId).** Proposto, não implementado (seção 4/9).
- **ADR 5 — Versões substituídas permanecem históricas e não executáveis.** Parcialmente implementado (`historica`/`substitui` existem) mas **não verificado em código** (`historica` não é checado por `_candidatasPorPalavraChave`) — ADR deveria formalizar a correção pendente.
- **ADR 6 — Divergências exigem decisão humana registrada.** Praticado informalmente (prosa em `observacoes`), não estruturado (seção 7) — ADR deveria formalizar a estrutura de dados.
- **ADR 7 — Questões guardam referência da evidência usada.** Não implementado (seção 9) — ADR define o compromisso futuro.
- **ADR 8 — Falha científica é fail-closed.** **Parcialmente verdadeiro hoje**: verdadeiro quando `status` está presente e não-vigente; **falso quando `status` está ausente** (Achado #1) — ADR deveria formalizar a intenção e servir de critério de aceite para a correção da Fase 4A.
- **ADR 9 — Módulos podem ter ciclo de vida independente.** Implementado estruturalmente (`statusModulos`) mas sem efeito de bloqueio real (seção 3B/8) — ADR deveria registrar isso como decisão pendente de completar.
- **ADR 10 — Fonte oficial não substitui leitura e validação humana.** Já praticado consistentemente nas 3 fases (nenhuma promoção automática, `revisadoPor` sempre null) — ratificar.
- **ADR 11 (novo, proposto por esta revisão) — Toda leitura/escrita de diretrizes em runtime deve usar um schema único e sincronizado entre Firestore e o arquivo estático; a ausência de um campo de governança em um documento de origem externa (Firestore) deve ser tratada como "vigência não confirmada", nunca como "vigente por omissão".** Este ADR nasce diretamente do Achado #1 desta Macro Review.

---

## 15. Achados Classificados

**C1 — CRÍTICO.** A checagem de status pode ser inteiramente contornada quando a coleção Firestore `diretrizes` contém documentos ativos sem o campo `status` (formato legado, gerado por `semearBase()`, que nunca escreve os campos novos). Evidência: código de `RoboGerador.jsx:699-708`, `ResumoGerador.jsx:320-328`, `ImportadorPro.jsx:764-778`, e `semearBase()` em `PainelDiretrizes.jsx:289-314`. Cenário de falha: qualquer geração via ABCD, legado, importação ou resumo, para qualquer um dos 17 temas, ignora completamente o trabalho das Fases 1–3 se a coleção Firestore estiver populada com seeds antigos. Correção mínima: fazer os 3 pontos de carregamento tratarem documento Firestore sem campo `status` como equivalente a `PENDENTE_REVISAO` (fail-closed), não como vigente. Correção ideal: sincronizar o schema completo Firestore↔estático e estender `semearBase()`/painel para os novos campos. Necessário antes da produção: **sim**. Necessário antes do deploy: **sim, se o deploy incluir qualquer geração real**. Pode aguardar: **NÃO** — mas não bloqueia a pesquisa documental em andamento (Fase 4B pode prosseguir em paralelo).

**C2 — ALTO.** Apenas o formato ABCD de `RoboGerador.jsx` aplica `avaliarBloqueioDiretriz`; o formato legado A–E (mesmo arquivo), `ImportadorPro.jsx`, `ResumoGerador.jsx` e `resumoEngine.js` chamam a IA sem qualquer pré-check de bloqueio, apenas com grounding opcional silencioso. Cenário de falha: um usuário gera um resumo de tema ou importa questões sobre HAS/DM/rastreamento_colo (todos `PENDENTE_REVISAO`) via qualquer um desses 4 caminhos, sem qualquer aviso de que a fonte está em revisão. Correção mínima: replicar o pré-check nos 4 pontos. Necessário antes da produção: sim, para os fluxos ativos (confirmar quais dos 4 estão em uso real — legado A–E possivelmente já descontinuado). Pode aguardar: depende de quais desses fluxos ainda são usados — Fase 4A deve confirmar.

**C3 — ALTO.** Divergência de conteúdo real e já presente entre `prenatal.pontosCriticos` (dTpa "20–36 sem") e `vacinacao.pontosCriticos` (dTpa corrigido para "a partir da 20ª semana, sem limite superior confirmado"). Cenário de falha: uma questão sobre dTpa na gestação pode receber grounding contraditório dependendo de qual entrada `detectarDiretrizDinamica` selecionar (a de maior `ano` — hoje `vacinacao` ganha por `anoPublicacao`, mas o campo usado no desempate é `ano`, que para ambas está desatualizado/desalinhado). Correção mínima: alinhar o texto de `prenatal` ao de `vacinacao` (fonte única de verdade para dTpa gestacional). Pode aguardar: sim, não é bloqueante para retomar os 15 recortes qualitativos (nenhum deles é sobre dTpa), mas deve ser corrigido antes de gerar qualquer recorte de pré-natal/vacinação.

**C4 — MÉDIO.** `fonte`/`ano` (campo realmente injetado no prompt) diverge de `titulo`/`anoPublicacao` (campo documental, já corrigido) em `has`, `rastreamento_colo` e `vacinacao` — a IA recebe "ANO DE REFERÊNCIA" desatualizado mesmo após a pesquisa confirmar uma edição mais nova. Correção mínima: sincronizar `ano`/`fonte` com `anoPublicacao`/`titulo` nas 3 entradas. Pode aguardar: não deveria — afeta diretamente o texto que a IA vê, mesmo com o conteúdo de `pontosCriticos` já corrigido.

**C5 — MÉDIO.** `statusModulos` não tem efeito de bloqueio granular real — `montarBlocoDiretriz` sempre serializa todos os `pontosCriticos` de uma diretriz, mesmo quando só um módulo está `PRONTA_PARA_VALIDACAO_HUMANA` e outros `PENDENTE_AJUSTE` (caso HIV). Pode aguardar: sim para os 15 recortes qualitativos (nenhum é de HIV), mas deve ser resolvido antes de qualquer geração de recorte de HIV.

**C6 — MÉDIO.** Nenhum campo de schema tem validação estrutural (sem JSON Schema/Zod) — erros de digitação em `status` ou tipos incorretos falham silenciosamente para o `default` genérico em vez de alertar. Pode aguardar: sim, melhoria futura.

**C7 — BAIXO.** `PainelDiretrizes.jsx` não expõe nenhum dos campos novos de governança — toda a validação humana precisa acontecer fora do sistema (arquivo markdown). Pode aguardar: sim para os próximos passos imediatos (o pacote markdown já cumpre a função para 1 revisor), mas é bloqueante se a equipe de revisão crescer.

**C8 — MELHORIA FUTURA.** Ausência de `evidenceId`/rastreabilidade por fato e por questão (seções 4/9). Pode aguardar: sim.

**C9 — MELHORIA FUTURA.** Ausência de verificação cruzada `temasRelacionados` ↔ matriz de 120 recortes. Pode aguardar: sim.

---

## 16. Decisão de GO/NO-GO por Etapa

**A. Continuar Fase 4 documental (pesquisa de fontes primárias)?** **GO.** Não depende de nenhuma correção de código — é leitura/redação.

**B. Validar diretrizes (aprovação humana formal via o pacote)?** **GO, com ressalva.** O pacote documental está correto e utilizável para validação humana das 4 entradas `PRONTA_PARA_VALIDACAO_HUMANA` (dm, sifilis, hiv/TARV, hiv/PEP) — mas a aprovação de um humano hoje só se materializaria como uma edição manual de arquivo (não há workflow formal), o que é aceitável para o volume atual (1 revisor, poucas entradas).

**C. Revisar Q1–Q12?** **GO** — não depende de nenhum achado crítico desta revisão (é auditoria de questões já existentes, não geração nova).

**D. Retomar os 15 recortes qualitativos?** **NO-GO condicional.** Antes de retomar, confirmar (não implementar ainda): (1) se a coleção Firestore `diretrizes` está de fato populada em produção (Achado C1) — se estiver, o bloqueio de governança está inerte e os 15 recortes qualitativos, embora não dependam de diretriz alguma por definição, não têm essa garantia verificada; (2) nenhum dos 15 recortes qualitativos deve tocar HAS/dTpa gestacional/HIV (achados C3/C4/C5) — isso precisa ser confirmado recorte a recorte antes de retomar, não é bloqueio total.

**E. Deploy?** **NO-GO** até C1 (Firestore) ser ao menos verificado empiricamente (não só por leitura de código) — esta revisão não teve acesso ao Firestore de produção para confirmar se a coleção está populada; **isso deveria ser o primeiro passo da Fase 4A**, antes de qualquer decisão de deploy relacionada a governança.

**F. Correções obrigatórias antes de cada etapa:**
- Antes de D (retomar): confirmar C1 empiricamente + triagem dos 15 recortes contra C3/C4/C5.
- Antes de E (deploy): resolver C1 (mínimo: fail-closed quando `status` ausente em documento Firestore) + C3 (dTpa) se o deploy tocar geração de pré-natal/vacinação.

---

## 17. Plano Recomendado — Fase 4A a 4F

### FASE 4A — Correções arquiteturais mínimas obrigatórias
- **Objetivo:** eliminar o bypass silencioso do Achado C1; sincronizar `ano`/`fonte` com `anoPublicacao`/`titulo` (C4); alinhar dTpa entre `prenatal`/`vacinacao` (C3).
- **Arquivos prováveis:** `diretrizesControladas.js` (correções de conteúdo C3/C4), `RoboGerador.jsx`/`ResumoGerador.jsx`/`ImportadorPro.jsx` (tratamento fail-closed do carregamento Firestore).
- **Risco:** médio — toca lógica de carregamento usada em produção; exige teste cuidadoso do fallback.
- **Testes:** novo caso simulando documento Firestore sem `status`; regressão dos 35 casos existentes.
- **Critério de saída:** documento Firestore sem `status` tratado como `PENDENTE_REVISAO`, não como vigente; dTpa e ano/fonte consistentes entre entradas.
- **Dependências:** nenhuma — pode começar imediatamente após autorização.
- **% aproximado da Macro Sprint:** +10% (de ~55% para ~65%).

### FASE 4B — Fechamento das fontes pendentes
- **Objetivo:** completar leitura integral de HAS (emergência/urgência/DRC/DM/DCV), rastreamento_colo (fluxo ASC-US/LSIL/HSIL pós-transição), vacinação (13 blocos restantes), HIV (6 módulos restantes), e as 5 novas diretrizes (diverticulite/tvp_wells/distocia_ombro/ictericia_neonatal — documento completo; violencia_domestica — demais sub-populações).
- **Arquivos prováveis:** apenas `diretrizesControladas.js` + documentos (dossiê/matriz/pacote).
- **Risco:** baixo (documental).
- **Testes:** novos casos conforme cada fechamento (padrão já estabelecido nas Fases 2/3).
- **Critério de saída:** todas as 17 entradas com `statusDocumental` atualizado e `observacoes` refletindo exatamente o que foi/não foi lido.
- **Dependências:** nenhuma dependência de 4A (pode rodar em paralelo).
- **% aproximado:** +20% (para ~85%).

### FASE 4C — Validação humana
- **Objetivo:** Dr. Weyne (ou revisor designado) aprova/rejeita/pede ajuste em cada ficha do pacote; opcionalmente, estender `PainelDiretrizes.jsx` para expor os campos (C7).
- **Arquivos prováveis:** `diretrizesControladas.js` (setar `status: VIGENTE_CONFIRMADA`/`revisadoPor` apenas nas aprovadas), `PainelDiretrizes.jsx` (se decidido estender a UI).
- **Risco:** baixo para conteúdo, médio se envolver extensão de UI.
- **Testes:** caso novo garantindo que só entradas com `revisadoPor` preenchido podem estar `VIGENTE_CONFIRMADA`.
- **Critério de saída:** pelo menos as 4 entradas `PRONTA_PARA_VALIDACAO_HUMANA` com decisão registrada.
- **Dependências:** 4B para as demais entradas ainda não fechadas.
- **% aproximado:** +5% (para ~90%) — validação em si é rápida, o trabalho pesado é 4B.

### FASE 4D — Revisão Q1–Q12
- **Objetivo:** reauditar as 12 questões já produzidas contra o estado atual (pós Fases 1-3) das diretrizes usadas.
- **Arquivos prováveis:** nenhum código — leitura do Firestore de questões + comparação textual.
- **Risco:** baixo.
- **Testes:** N/A (auditoria, não código).
- **Critério de saída:** cada uma das 12 questões classificada como "consistente"/"precisa correção"/"substituir".
- **Dependências:** idealmente após 4C (para saber quais diretrizes já são `VIGENTE_CONFIRMADA`), mas pode ser feito com o estado atual se urgente.
- **% aproximado:** +5% (para ~95%).

### FASE 4E — Retomada controlada (15 recortes qualitativos)
- **Objetivo:** retomar produção dos 15 recortes já classificados como `LIBERÁVEL QUALITATIVO`.
- **Arquivos prováveis:** nenhum (uso normal do RoboGerador).
- **Risco:** baixo, condicionado a 4A concluída (senão herda o risco C1).
- **Testes:** N/A — é operação, não desenvolvimento.
- **Critério de saída:** conforme protocolo já estabelecido (registro em CONTROLE_PRODUCAO...).
- **Dependências:** **obrigatoriamente após 4A** (GO/NO-GO seção 16, item D).
- **% aproximado:** não é trabalho de Macro Sprint (é produção), sem impacto no %.

### FASE 4F — Deploy seguro
- **Objetivo:** publicar as correções de 4A/4C em produção (`revalidapro-f812e`).
- **Arquivos prováveis:** os mesmos de 4A/4C.
- **Risco:** médio (deploy sempre é) — mitigado por build/lint/teste limpos + confirmação empírica do estado real do Firestore antes.
- **Testes:** suíte completa + confirmação manual pós-deploy de que o bloqueio funciona com dado real do Firestore (não só estático).
- **Critério de saída:** bloqueio confirmado funcional em produção real, não só em teste local.
- **Dependências:** 4A concluída; idealmente 4C também.
- **% aproximado:** +5% (100% da parte de infraestrutura de governança — as fontes documentais em si podem continuar evoluindo indefinidamente, isso não "termina").

---

## 18. Confirmações Finais

- Build: PASS.
- Lint: 3 erros + 1 warning, todos pré-existentes, não relacionados a esta revisão (nenhum arquivo de código foi alterado).
- Verificações manuais: 35/35 passando (inalterado).
- Commits desta revisão: **nenhum** — apenas este arquivo novo (documentação).
- Zero deploy: confirmado.
- Zero Firestore: confirmado (nenhuma leitura ou escrita — a análise da coleção "diretrizes" foi feita 100% por leitura de código-fonte, não por consulta ao Firestore real).
- Zero API Anthropic: confirmado.
- Zero promoção de diretrizes: confirmado.
- Zero geração de questões: confirmado.
