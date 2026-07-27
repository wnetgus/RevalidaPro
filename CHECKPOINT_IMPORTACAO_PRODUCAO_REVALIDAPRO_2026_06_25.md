# CHECKPOINT - IMPORTACAO PRODUCAO REVALIDAPRO 2026.1

Data: 2026-06-25
Status real ao pausar: importacao manual/assistida em producao pausada por cansaco do usuario.

## URL correta de producao

- Projeto Firebase PROD: `revalidapro-f812e`
- URL correta: `https://revalidapro-f812e.web.app`
- URL antiga/incorreta testada: `https://revalidapro.web.app` retornou `Site Not Found`

## Fluxo decidido com o usuario

- Continuar de forma organizada, em ordem numerica da prova.
- Manter qualidade Premium RevalidaPRO.
- Padrao seguro: 5 questoes por vez para questoes simples.
- Questao com tabela, grafico, partograma ou imagem deve receber atencao especial e, se necessario, ser feita sozinha.
- Usuario prefere copiar/importar manualmente quando estiver descansado, mas foi iniciado teste com browser para eu operar apos login dele.

## Estado da importacao

Questao ja considerada importada em producao ate:

- `2026_1_Q050`

Proxima questao para retomar:

- `2026_1_Q051`

Importante:

- A Q051 foi preparada e colada no ImportadorPro.
- O card de revisao foi gerado com sucesso: `REVISAO (1)`.
- Gabarito apareceu corretamente como `B`.
- A publicacao NAO entrou. O usuario confirmou que a Q051 nao foi importada.
- Portanto, ao voltar, recomecar pela Q051. Nao assumir que ela existe no banco.

## Browser/importador

Caminho validado:

1. Abrir `https://revalidapro-f812e.web.app`
2. Usuario faz login manualmente.
3. Acessar `Painel Admin`.
4. Abrir aba/botao `Importador`.
5. Em `IMPORTAR`, selecionar:
   - destino: `INEP`
   - edicao: `2026.1`
   - checkbox `OFICIAL INEP`: marcado
6. Colar JSON.
7. Clicar `GERAR CARDS DE REVISAO`.
8. Conferir card.
9. Publicar.

Observacao do teste:

- O clique em `PUBLICAR (1)` abriu uma confirmacao JavaScript.
- A automacao travou/timeout ao tentar aceitar/verificar depois.
- Nao houve importacao final da Q051.
- Para novo teste assistido, publicar apenas apos confirmar visualmente que o botao e a confirmacao estao visiveis.

## Correcoes importantes ja aplicadas/validadas na plataforma

### Tabelas

Problema antigo:

- `Object.values(l)` renderizava as celulas em ordem instavel do Firestore.

Correcao aplicada por Claude:

- Renderizar por chave explicita:
  `Array.from({ length: cabecalho?.length }, (_, i) => l[\`c${i}\`] ?? "")`

Arquivos citados:

- `QuestionCard.jsx`
- `Simulador.jsx`

Padrao obrigatorio para tabelas:

```json
"tabelaDados": {
  "titulo": "...",
  "cabecalho": ["...", "...", "..."],
  "linhas": [
    { "c0": "...", "c1": "...", "c2": "..." }
  ]
}
```

- Nunca usar array de arrays em `linhas`.
- Usar `c0`, `c1`, `c2`, `c3` conforme numero de colunas.

### Imagens

Novo padrao para questoes com imagem:

```json
"temImagem": true,
"imagemStoragePath": "imagens-prova/QXXX_nome.png",
"imagemUrl": ""
```

- Nao usar URL com token do Firebase no JSON.
- A plataforma usa `StorageImage` e `getDownloadURL()` para buscar token atual.
- Arquivo deve existir em Firebase Storage em `imagens-prova/`.

Exemplos ja usados:

```json
"imagemStoragePath": "imagens-prova/Q040_partograma.png",
"imagemTipo": "partograma",
"imagemUrl": ""
```

```json
"imagemStoragePath": "imagens-prova/Q048_ancylostoma.png",
"imagemTipo": "imagem_clinica",
"imagemUrl": ""
```

## Questoes especiais ja passadas

- Q015 e Q016: tabelas corrigidas/reimportadas.
- Q028: grafico com `graficoDados` aprovado. Nao usar `series`, arrays paralelos nem `eixoX/eixoY` como objeto.
- Q040: partograma com `imagemStoragePath`.
- Q047: tabela.
- Q048: imagem clinica com `imagemStoragePath`.

## Gabarito oficial relevante para retomar

Proximas questoes:

- Q051: B
- Q052: B
- Q053: D
- Q054: B
- Q055: D
- Q056: C
- Q057: D
- Q058: C
- Q059: A
- Q060: A

## Conteudo extraido para Q051-Q060

Q051 tem tabela de exames:

- Hemoglobina: 12,2 g/dL | 11,5 a 13,5 g/dL
- Leucocitos: 13.400/mm3 | 5.000 a 15.000/mm3
- Creatinina: 1,1 mg/dL | 0,5 a 0,9 mg/dL
- Proteina C Reativa: 8,5 mg/L | < 5 mg/L

Q051 tema:

- Mulher, 68 anos, monoartrite aguda de joelho direito, dor subita, calor, edema, derrame volumoso, eritema e dor a mobilizacao.
- Conduta correta: pesquisar cristais, Gram, cultura e contagem celular no liquido sinovial.
- Gabarito: B.

Q052:

- Lactente 8 meses, primeiro episodio de tosse seca, chiado, coriza hialina, febre baixa, retracoes, sibilos difusos.
- Agente mais provavel: virus sincicial respiratorio.
- Gabarito: B.

Q053:

- Homem 62 anos, 3o PO de retossigmoidectomia por cancer colorretal, dor/edema/calor em panturrilha, estavel.
- Conduta oficial: solicitar Doppler venoso e aguardar resultado.
- Gabarito: D.

Q054:

- Adolescente gestante de 15 anos; mae exige prontuario e cesariana; adolescente deseja parto vaginal.
- Conduta: atendimento individualizado, autonomia respeitada na via de parto.
- Gabarito: B.

Q055:

- Menino 5 anos, nao vacinado, febre, tosse, conjuntivite, exantema facial e manchas de Koplik.
- Sarampo; tratamento inclui vitamina A via oral.
- Gabarito: D.

Q056 tem tabela extensa:

- Sindrome de Gilbert: hiperbilirrubinemia indireta isolada, benigna, exacerbada por jejum/estresse/sono, enzimas hepaticas e hemolise normais.
- Gabarito: C.

Q057:

- Lactente 8 meses com diarreia aquosa ha 24h, ativo, hidratado, sem febre/vomitos.
- Conduta: aumentar agua e leite materno, observar sinais de desidratacao, afastar da creche.
- Gabarito: D.

Q058:

- 3o PO de enterectomia extensa e jejunostomia por isquemia mesenterica, UTI, VM e drogas vasoativas.
- Via alimentar adequada: acesso venoso central.
- Gabarito: C.

Q059:

- Corrimento amarelo-esverdeado, prurido, odor pos-menstrual, colo em morango, pH 5,5, teste das aminas negativo.
- Tricomoniase; metronidazol 400 mg VO 12/12h por 7 dias.
- Gabarito: A.

Q060:

- Dengue inicialmente sem sinais de alarme; retorna com vomitos persistentes, lipotimia, dor abdominal continua, oliguria, TEC 3s, extremidades frias, Ht subindo e plaquetas 82.000.
- Conduta imediata: hidratacao venosa, acesso calibroso, monitorizacao e internacao.
- Gabarito: A.

## Padrao Premium obrigatorio ao gerar proximas

Campos obrigatorios:

- `id`
- `numeroQuestao`
- `provaId`: `"2026.1"`
- `isOficial`: `true`
- `ano`: `2026`
- `origem_prova`: `"INEP Revalida 2026.1"`
- `banca`: `"Revalida INEP"`
- `instituicao`: `"INEP"`
- `materia`
- `tema_mestre`
- `subtema`
- `enunciado`
- `alts`
- `gabarito`
- `justificativas`
- `raciocinio`
- `tto`
- `dicaMestre`
- `resumoTema`

Formatos pedagogicos:

- `raciocinio`: `PADRAO -> DIFERENCIAL -> DECISAO -> ARMADILHA`
- `tto`: `PASSO 1` ate `PASSO 6`
- `dicaMestre`: 4 blocos separados por `↓`
- Alternativas: manter exatamente A-D quando oficial tem apenas A-D. Nao inventar E.

## Ao retornar

Comecar pela Q051 novamente.

Opcoes seguras:

1. Enviar JSON da Q051 isolada para usuario importar manualmente.
2. Se usuario quiser browser novamente, abrir producao correta, selecionar `2026.1`, colar Q051, gerar revisao, e so publicar se a confirmacao visual estiver sob controle.
3. Depois de Q051 entrar, continuar em lotes de 5: Q052-Q056 ou Q052-Q055 se quiser evitar tabela extensa da Q056 no mesmo lote.
