# CHECKPOINT CODEX — REVALIDAPRO PADRAO PREMIUM

Este checkpoint e exclusivo para uso do Codex.

Nao misturar com checkpoints, prompts ou estruturas geradas por Claude.

Data: 2026-06-25
Projeto: RevalidaPRO

## Objetivo

Preservar o padrao validado para importacao de questoes oficiais INEP e servir como base futura para criacao das questoes do modulo Super Apostas.

## Padrao validado para questoes oficiais INEP

As questoes oficiais devem preservar integralmente:

- enunciado oficial;
- alternativas oficiais;
- ordem das alternativas;
- numero de alternativas da prova;
- gabarito oficial.

O texto oficial e intocavel. O Codex nao deve reescrever, melhorar, resumir ou adaptar enunciado/alternativas de prova oficial.

## Estrutura JSON validada

Usar campos flat, no padrao exportado/importado pela plataforma:

- `id`
- `provaId`
- `isOficial`
- `ano`
- `origem_prova`
- `banca`
- `instituicao`
- `materia`
- `tema_mestre`
- `subtema`
- `edicao`
- `numeroQuestao`
- `enunciado`
- `alternativaA`
- `alternativaB`
- `alternativaC`
- `alternativaD`
- `alternativaE`
- `gabarito`
- `justificativaA`
- `justificativaB`
- `justificativaC`
- `justificativaD`
- `justificativaE`
- `raciocinio`
- `tto`
- `dicaMestre`
- `resumoTema`
- `temImagem`
- `imagemTipo`
- `imagemUrl`
- `imagemStoragePath`
- `imagemLegenda`
- `recursoVisual`
- `descricaoTabela`
- `tabelaDados`
- `graficoDados`
- `status_atualizacao`

## Regras estruturais obrigatorias

- Nao usar `alts` nos lotes finais de importacao.
- Usar `id` com underline: `2026_1_Q077`, `2026_1_Q078`, etc.
- `provaId`: `2026.1`
- `isOficial`: `true`
- `ano`: `"2026"` como string, seguindo arquivo aprovado.
- `origem_prova`: `INEP Revalida 2026.1`
- `banca`: `Revalida INEP`
- `instituicao`: `Revalida INEP`
- `edicao`: `2026.1`
- `status_atualizacao`: `revisar`
- `alternativaE`: `""` quando a questao oficial tem apenas A-D.
- `justificativaE`: `""` quando a questao oficial tem apenas A-D.
- `gabarito`: letra minuscula (`a`, `b`, `c`, `d`).

Antes de enviar qualquer lote, conferir que todas as questoes possuem:

- `justificativaA`
- `justificativaB`
- `justificativaC`
- `justificativaD`

Esse ponto e critico porque a plataforma bloqueia publicacao com schema incompleto.

## Campos de imagem

Quando nao houver imagem:

```json
"temImagem": false,
"imagemStoragePath": "",
"imagemLegenda": "",
"imagemTipo": "",
"imagemUrl": "",
"recursoVisual": null
```

Quando houver imagem ja enviada ao Firebase Storage:

```json
"temImagem": true,
"imagemStoragePath": "imagens-prova/NOME_DA_IMAGEM.png",
"imagemUrl": "",
"imagemTipo": "imagem_clinica",
"imagemLegenda": "Descricao clinica objetiva da imagem conforme enunciado.",
"recursoVisual": {
  "tipo": "imagem_clinica",
  "necessitaImagem": true,
  "observacao": "Imagem oficial da prova.",
  "arquivoEsperado": "NOME_DA_IMAGEM.png"
}
```

Nunca usar URL do Firebase com token em `imagemUrl`.

A plataforma resolve a URL automaticamente a partir de `imagemStoragePath`.

Exemplo validado:

```json
"imagemStoragePath": "imagens-prova/Q083_mamografia.png",
"imagemUrl": "",
"imagemTipo": "imagem_clinica"
```

## Tabelas

Quando houver tabela, usar `tabelaDados` com linhas em objetos:

```json
"tabelaDados": {
  "titulo": "",
  "descricaoTabela": "",
  "cabecalho": ["", "", ""],
  "linhas": [
    {
      "c0": "",
      "c1": "",
      "c2": ""
    }
  ]
}
```

Nunca usar linhas como arrays.

Correto:

```json
{ "c0": "Glicemia", "c1": "392 mg/dL", "c2": "70 a 105 mg/dL" }
```

Incorreto:

```json
["Glicemia", "392 mg/dL", "70 a 105 mg/dL"]
```

Quando nao houver tabela:

```json
"descricaoTabela": "",
"tabelaDados": null
```

## Raciocinio

Formato em linha unica, com setas:

`PADRAO: ... → DIFERENCIAL: ... → DECISAO: ... → ARMADILHA: ...`

Manter raciocinio clinico objetivo, no estilo Premium aprovado.

## TTO

Sempre em 6 passos:

- `PASSO 1 — ...`
- `PASSO 2 — ...`
- `PASSO 3 — ...`
- `PASSO 4 — ...`
- `PASSO 5 — ...`
- `PASSO 6 — ...`

Cada passo pode conter bullets curtos.

## DicaMestre

Sempre em 4 blocos separados por seta para baixo:

```text
Bloco 1.
↓
Bloco 2.
↓
Bloco 3.
↓
Bloco 4.
```

O estilo aprovado inclui:

- reconhecimento rapido;
- sinal que muda tudo;
- caminho certo;
- por que erram.

## Justificativas

Cada alternativa deve ter justificativa propria, com badge forte no inicio.

Badges usados:

- `CORRETA.`
- `DIAGNOSTICO TROCADO:`
- `CONDUTA INSUFICIENTE:`
- `CONDUTA EXCESSIVA:`
- `CONDUTA INADEQUADA:`
- `CONDUTA PERIGOSA:`
- `ARMADILHA INEP:`
- `ERRO GRAVE:`
- `PERDA DE TEMPO:`

Evitar justificativas genericas.

Cada justificativa deve explicar por que a alternativa esta correta ou errada naquele caso.

## ResumoTema

Sempre incluir objeto completo:

- `titulo`
- `categoria`
- `padraoReconhecimento`
- `diagnosticoDiferencial`
- `condutaMomentoExato`
- `armadilhaINEP`
- `regraDeOuro`
- `diretrizAtual`
- `erroQueReprova`
- `quandoINEPQuerTePegar`
- `dicaMestreResumo`

## Super Apostas — uso futuro

Para o modulo Super Apostas, o padrao pedagogico deve ser reaproveitado, mas as questoes serao autorais/provaveis, nao importacao oficial.

Cuidados para Super Apostas:

- nao marcar como questao oficial INEP;
- nao usar texto de prova oficial como se fosse autoral;
- manter qualidade Premium;
- manter raciocinio, tto, dicaMestre e resumoTema completos;
- usar armadilhas plausiveis de prova;
- usar diretrizes atuais;
- manter estrutura compativel com a plataforma.

Campos de isolamento do modulo devem seguir o comportamento do importador da plataforma quando aplicavel:

- `isOficial`: `false`
- `provaId`: `""`
- `modulo`: `super_apostas`
- `origem_prova`: `IA` ou `RoboIA`, conforme fluxo da plataforma

Antes de criar Super Apostas, revisar o fluxo atual do importador/robo para nao misturar com banco INEP oficial.

## Checklist antes de enviar lote

1. JSON e array valido.
2. Sem markdown.
3. Sem comentarios.
4. Sem `alts`.
5. IDs no padrao com underline.
6. Todas as alternativas A-D presentes.
7. Todas as justificativas A-D presentes.
8. `alternativaE` e `justificativaE` vazias quando nao houver E.
9. `imagemUrl` sempre vazia quando usar Storage.
10. `tabelaDados.linhas` sempre com objetos `c0`, `c1`, `c2`.
11. Gabarito conferido com gabarito oficial ou, em Super Apostas, definido pedagogicamente.
12. Texto oficial preservado quando for importacao INEP.

