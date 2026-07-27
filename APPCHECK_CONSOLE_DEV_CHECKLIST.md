# Firebase App Check — Checklist de Configuração Manual (projeto DEV)

**Micro Sprint 4B.3B.2.** Este checklist é exclusivo do projeto `revalidapro-dev`.
Nenhum passo aqui deve ser aplicado a `revalidapro-f812e` (produção) nesta sprint.

Nenhuma destas ações foi executada automaticamente — todas exigem login manual
no [Firebase Console](https://console.firebase.google.com) e ação humana.

---

## 0. Pré-requisito: confirmar o projeto correto

1. Abra o Firebase Console.
2. No seletor de projeto (canto superior esquerdo), confirme que o projeto
   selecionado é **`revalidapro-dev`** — não `revalidapro-f812e`.
3. Se não tiver certeza de qual é qual, confira o Project ID exibido em
   **Configurações do projeto → Geral**, não apenas o nome de exibição.

> ⚠️ Todo o restante deste checklist pressupõe que você permaneceu no projeto
> `revalidapro-dev` durante toda a sessão do Console. Reabra e reconfirme o
> seletor de projeto se trocar de aba.

## 1. Registrar/confirmar o Web App no App Check

1. No menu lateral: **Build → App Check**.
2. Na lista de apps, localize o **Web App** correspondente ao frontend do
   RevalidaPro (o `appId` deve bater com `VITE_FIREBASE_APP_ID` do seu
   `.env.development` local — não copie o valor para fora do seu ambiente).
3. Se o Web App não aparecer na lista do App Check, ele ainda não foi
   registrado — clique em **Registrar** ao lado dele.

## 2. Escolher o provider (reCAPTCHA v3)

Conforme a recomendação da auditoria 4B.3B.0: **reCAPTCHA v3** para o Web App,
não reCAPTCHA Enterprise (desproporcional ao porte atual) nem custom provider.

1. Ainda em **App Check**, clique no Web App e escolha **reCAPTCHA v3** como
   provider.
2. Se ainda não existir uma site key: siga o link para o
   [Google reCAPTCHA Admin Console](https://www.google.com/recaptcha/admin)
   e crie uma chave do tipo **reCAPTCHA v3**, associada ao(s) domínio(s) que
   você vai usar para testar (ex.: `localhost` — para uso local; o domínio de
   preview do Hosting DEV, se houver um).
3. Cole a **Site Key** (pública) de volta no formulário do App Check no
   Firebase Console e confirme a associação.

> A Site Key do reCAPTCHA é uma chave **pública** (é enviada ao navegador do
> usuário) — não é o mesmo tipo de segredo que uma API key de backend, mas
> ainda assim nunca deve ser hardcoded no repositório: sempre via variável
> de ambiente, para manter a separação DEV/PROD e permitir rotação sem commit.

## 3. Obter a Site Key e configurar localmente

1. Copie a Site Key gerada no passo anterior.
2. No seu `.env.development` **local** (nunca versionado — já está no
   `.gitignore`), adicione a linha, usando `.env.appcheck.example` (versionado
   nesta sprint) como referência de nome:
   ```
   VITE_FIREBASE_APPCHECK_SITE_KEY=<sua-site-key-aqui>
   ```
3. **Não** adicione esta variável em `.env.production` nesta sprint.
4. **Não** cole a site key em nenhum arquivo dentro do repositório além do
   seu `.env.development` local.

## 4. Configurar o Debug Token para desenvolvimento local

O reCAPTCHA v3 é instável em `localhost` — o caminho recomendado para
desenvolvimento é o **Debug Provider**, não tentar validar o reCAPTCHA real
localmente.

1. No seu `.env.development` local, adicione:
   ```
   VITE_FIREBASE_APPCHECK_DEBUG=true
   ```
2. Rode `npm run dev` e abra o console do navegador (DevTools). Na primeira
   inicialização, o SDK do App Check imprime uma linha parecida com:
   `App Check debug token: <uuid>` — **esse UUID é o debug token**.
3. Volte ao Firebase Console → **App Check → Aba "Apps" → ⋮ (menu do Web
   App) → "Gerenciar tokens de depuração"**.
4. Registre esse UUID como um novo debug token, com um nome descritivo (ex.:
   "notebook local — dev").
5. **Nunca** commite esse UUID em nenhum arquivo do repositório — ele vive
   apenas no Console (registrado) e no ambiente local (gerado pelo SDK,
   nunca precisa ser digitado manualmente por você).

> Repita o passo 4 para cada máquina/desenvolvedor que precisar rodar o
> projeto localmente com App Check habilitado — cada ambiente gera seu
> próprio debug token na primeira execução.

## 5. Validar que o token está sendo obtido no navegador

1. Com `VITE_FIREBASE_APPCHECK_SITE_KEY` e `VITE_FIREBASE_APPCHECK_DEBUG=true`
   configurados, rode `npm run dev`.
2. Abra o DevTools → aba **Console**. Confirme que a linha do debug token
   aparece sem erros vermelhos de inicialização do App Check.
3. Se aparecer um erro de inicialização, confira: (a) a Site Key foi colada
   sem espaços extras; (b) o debug token foi de fato registrado no Console
   para o Web App correto de `revalidapro-dev`.

## 6. Verificar que `X-Firebase-AppCheck` está sendo enviado

1. No DevTools → aba **Network**, dispare qualquer fluxo que chame
   `gerarQuestoesIA` (ex.: gerar uma questão pelo RoboGerador/ImportadorPro
   no painel admin).
2. Clique na requisição para `gerarQuestoesIA` → aba **Headers** → confirme
   que o header de requisição **`X-Firebase-AppCheck`** está presente, com um
   valor (não precisa decodificar o valor — só confirmar presença).
3. Confirme também que `Authorization: Bearer ...` continua presente — os
   dois headers devem coexistir.

## 7. Verificar que chamadas SEM token recebem 401

Esta verificação é opcional e só deve ser feita contra o projeto DEV, nunca
produção. Uma forma segura, sem escrever nenhum script novo: usar `curl`
manualmente contra a Cloud Function de DEV, omitindo o header:

```
curl -i -X POST https://us-central1-revalidapro-dev.cloudfunctions.net/gerarQuestoesIA \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <um-id-token-valido-de-teste>" \
  -d '{"prompt":"teste"}'
```

(sem incluir `X-Firebase-AppCheck`). A resposta esperada é `401`, com uma
mensagem genérica — nunca `200`. Isso só é observável **depois** que o
enforcement de fato bloquear ausência de App Check em produção real do
código (já implementado nos commits `ede5f67`/`987dec7`/`989dec7`+) — o
comportamento fail-closed já existe no código hoje (commits `ede5f67` e
`987dec7`), independente de haver Site Key configurada ou não (ver
`functions/appCheckGate.js`).

## 8. Evitar ativação acidental em produção

- **Nunca** adicione `VITE_FIREBASE_APPCHECK_SITE_KEY` ou
  `VITE_FIREBASE_APPCHECK_DEBUG` em `.env.production`.
- **Nunca** habilite "Enforce" no App Check do Console para o projeto
  `revalidapro-f812e` nesta sprint.
- Antes de qualquer build de produção (`npm run build`/`build:prod`),
  confirme que `.env.production` não contém nenhuma das duas variáveis —
  `scripts/test-appcheck-config-safety.js` ajuda a impedir que uma delas
  vaze para um arquivo *versionado*, mas não substitui esta checagem manual
  do seu `.env.production` local (que é gitignored e não pode ser inspecionado
  automaticamente sem risco de expor outros segredos nele).

---

## Sequência futura seguro (enforcement) — NÃO executar ainda

a. Configurar provider no DEV (este checklist).
b. Validar token no DEV (passo 5 acima).
c. Validar os 6 consumidores conhecidos no DEV (passo 6 acima, repetido para
   RoboGerador ABCD/legado/"Resumo do Tema", ImportadorPro, ResumoGerador
   `gerarUm`/`classificarUma`).
d. Validar bloqueio sem token (passo 7 acima).
e. **Somente depois** considerar habilitar "Enforce" no App Check do
   Console, e só para `revalidapro-dev`.
f. Produção continua bloqueada até nova sprint com autorização explícita.

**Nesta sprint (4B.3B.2), pare no passo (a)/(b) — não avance para enforcement.**
