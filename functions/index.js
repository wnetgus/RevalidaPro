/**
 * REVALIDAPRO — Cloud Functions
 * Mercado Pago (pagamentos) + Anthropic (IA) + INEP (importação oficial)
 */

const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const fetch = (...args) => import("node-fetch").then(({ default: f }) => f(...args));
const { chamarAnthropicViaGate } = require("./gate");
const { avaliarAutenticacaoEAutorizacao } = require("./authGate");
const { avaliarAppCheck } = require("./appCheckGate");

admin.initializeApp();
const db = admin.firestore();

// Emails com permissão de administrador
const EMAILS_ADMIN = ["drweynesouza@gmail.com", "wnetgus@gmail.com"];

// Verifica token Bearer e retorna o decoded token se for admin, ou null
async function verificarAdmin(authHeader) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  try {
    const decoded = await admin.auth().verifyIdToken(authHeader.slice(7));
    return EMAILS_ADMIN.includes(decoded.email) ? decoded : null;
  } catch { return null; }
}

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
const APP_URL = process.env.APP_URL || "https://revalidapro-f812e.web.app";

const PLANOS_FALLBACK = {
  "basico30":   { nome: "30 Dias",             dias: 30,  preco: 79.99 },
  "trimestral": { nome: "90 Dias",             dias: 90,  preco: 209.99 },
  "drplus":     { nome: "180 Dias - Dr. Plus", dias: 180, preco: 359.99 },
  "crmpro":     { nome: "360 Dias - CRM PRO",  dias: 360, preco: 599.99 },
};

// ─── FUNÇÃO 1: CRIAR PREFERÊNCIA ─────────────────────────────────────────────
exports.criarPreferencia = functions
  .region("us-central1")
  .https.onRequest(async (req, res) => {

    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") { res.status(204).send(""); return; }
    if (req.method !== "POST") { res.status(405).json({ erro: "Metodo nao permitido" }); return; }

    try {
      const { planoId, usuarioId, usuarioEmail, usuarioNome } = req.body;

      if (!planoId || !usuarioId) {
        res.status(400).json({ erro: "planoId e usuarioId sao obrigatorios" });
        return;
      }

      // Busca plano no Firestore
      let plano = null;
      try {
        const doc = await db.collection("planos").doc(planoId).get();
        if (doc.exists) plano = doc.data();
      } catch (e) {}
      if (!plano) plano = PLANOS_FALLBACK[planoId];
      if (!plano) { res.status(404).json({ erro: "Plano nao encontrado" }); return; }

      // Monta preferencia — igual ao padrao do Checkout Pro
      // Separa nome e sobrenome do usuário
      const partesNome = (usuarioNome || "Médico").trim().split(" ");
      const firstName = partesNome[0] || "Médico";
      const lastName = partesNome.slice(1).join(" ") || "Revalida";

      const preferencia = {
        items: [{
          id: planoId,
          title: `RevalidaPro - ${plano.nome}`,
          description: `Acesso por ${plano.dias} dias`,
          quantity: 1,
          unit_price: Number(plano.preco),
          currency_id: "BRL",
        }],
        payer: {
          email: usuarioEmail || "",
          first_name: firstName,
          last_name: lastName,
        },
        back_urls: {
          success: `${APP_URL}/pagamento-sucesso`,
          failure: `${APP_URL}/pagamento-falha`,
          pending: `${APP_URL}/pagamento-pendente`,
        },
        auto_return: "approved",
        notification_url: `https://us-central1-revalidapro-f812e.cloudfunctions.net/webhookMercadoPago`,
        external_reference: `${usuarioId}|${planoId}|${plano.dias}`,
        statement_descriptor: "REVALIDAPRO",
        // Habilita todos os meios de pagamento, incluindo Pix
        payment_methods: {
          excluded_payment_types: [],
          excluded_payment_methods: [],
          installments: 12,
          default_installments: 1,
        },
      };

      const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${MP_ACCESS_TOKEN}`,
        },
        body: JSON.stringify(preferencia),
      });

      if (!mpResponse.ok) {
        const erro = await mpResponse.text();
        console.error("Erro MP:", erro);
        res.status(500).json({ erro: "Erro ao criar preferencia" });
        return;
      }

      const dados = await mpResponse.json();

      // Salva tentativa
      await db.collection("pagamentos").add({
        usuarioId, usuarioEmail,
        planoId, planoNome: plano.nome,
        planoDias: plano.dias, valor: plano.preco,
        preferenceId: dados.id,
        status: "pendente",
        criadoEm: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.status(200).json({
        checkoutUrl: dados.init_point,
        sandboxUrl: dados.sandbox_init_point,
        preferenceId: dados.id,
      });

    } catch (error) {
      console.error("Erro criarPreferencia:", error);
      res.status(500).json({ erro: "Erro interno" });
    }
  });

// ─── FUNÇÃO 2: PROXY IA — GERAR QUESTÕES VIA ANTHROPIC ───────────────────────
// Usa globalThis.fetch (nativo no Node 20) — elimina dependência do node-fetch
// e o problema de dynamic import() que causava o crash silencioso + erro CORS.
// Os headers CORS são gravados antes de QUALQUER resposta (incluindo erros).
exports.gerarQuestoesIA = functions
  .region("us-central1")
  .runWith({ timeoutSeconds: 180, memory: "256MB" })
  .https.onRequest(async (req, res) => {

    // ── CORS: sempre primeiro, antes de qualquer lógica ─────────────────────
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    // X-Firebase-AppCheck adicionado na Micro Sprint 4B.3B.1 — sem isso, um
    // navegador rejeitaria o preflight assim que um client real passasse a
    // enviar esse header (hoje nenhum client envia — ver PENDÊNCIAS).
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Firebase-AppCheck");

    if (req.method === "OPTIONS") { res.status(204).send(""); return; }
    if (req.method !== "POST")   { res.status(405).json({ erro: "Método não permitido" }); return; }

    // ── AUTENTICAÇÃO + AUTORIZAÇÃO (Micro Sprint 4B.1) ───────────────────────
    // Antes de QUALQUER outro gate ou chamada — token ausente/inválido/
    // expirado (401) ou usuário autenticado sem autorização (403) bloqueiam
    // aqui, sem nunca chegar ao gate de payload nem à Anthropic. Dados do
    // corpo da requisição (email, isAdmin etc.) NUNCA são usados para
    // conceder privilégio — só o token verificado pelo Firebase Admin SDK.
    const autenticacao = await avaliarAutenticacaoEAutorizacao({
      authHeader: req.headers.authorization || "",
      // checkRevoked:true (Micro Sprint 4B.3A) — rejeita tokens cuja sessão
      // foi revogada (auth/id-token-revoked) ou cujo usuário foi desabilitado
      // (auth/user-disabled), além dos casos já cobertos (inválido/expirado).
      // Consulta adicional ao backend do Firebase Auth — ver relatório da
      // sprint para análise de latência. avaliarAutenticacaoEAutorizacao já
      // trata qualquer erro do verificador de forma genérica e fail-closed,
      // então nenhuma mudança é necessária em authGate.js.
      verificarIdToken: (token) => admin.auth().verifyIdToken(token, true),
    });
    if (!autenticacao.ok) {
      res.status(autenticacao.httpStatus).json({ erro: autenticacao.motivo });
      return;
    }

    // ── APP CHECK (Micro Sprint 4B.3B.1) ─────────────────────────────────────
    // Depois da autenticação/autorização, antes do gate de payload — prova
    // que a chamada vem de uma instância legítima do app (não quem é o
    // usuário, isso já foi decidido acima). Sem token/inválido/erro do
    // verificador = 401, 0 chamadas ao gate de payload, 0 chamadas à
    // Anthropic. verificarAppCheckToken é injetável — em produção é
    // admin.appCheck().verifyToken(token); nos testes é sempre um mock.
    const appCheckResultado = await avaliarAppCheck({
      appCheckHeader: req.headers["x-firebase-appcheck"],
      verificarAppCheckToken: (token) => admin.appCheck().verifyToken(token),
    });
    if (!appCheckResultado.ok) {
      res.status(appCheckResultado.httpStatus).json({ erro: appCheckResultado.motivo });
      return;
    }

    try {
      const { system, prompt, model } = req.body;

      // Benchmark controlado (Fase 3 Super Apostas 2026.2): permite escolher
      // explicitamente o modelo, restrito a um allowlist — nunca repassa string
      // arbitrária do cliente para a API da Anthropic. Sem "model" no body,
      // comportamento é IDÊNTICO ao de sempre (Haiku) — nenhum chamador
      // existente (RoboGerador/ImportadorPro/ResumoGerador) é afetado.
      const MODELOS_PERMITIDOS = ["claude-haiku-4-5-20251001", "claude-opus-4-8"];
      const modeloEscolhido = MODELOS_PERMITIDOS.includes(model) ? model : "claude-haiku-4-5-20251001";

      // ── GATE ÚNICO (Micro Sprint 4B.0) ───────────────────────────────────
      // Nenhuma chamada a api.anthropic.com acontece fora de
      // chamarAnthropicViaGate — na ausência da chave, de "prompt", ou de
      // qualquer erro ao avaliar essas precondições, o gate bloqueia
      // (autorizado:false) ANTES de qualquer rede: 0 chamadas à Anthropic.
      //
      // ── PROMPT CACHING (auditoria de custo Super Apostas 2026.2) ──────────
      // O "system" de todo chamador deste endpoint (PROMPT_SISTEMA_ROBO,
      // PROMPT_SISTEMA_SUPERAPOSTAS_ABCD, PROMPT_SISTEMA_IMPORTADOR,
      // PROMPT_SISTEMA_RESUMO/_SA) é 100% fixo — tema/diretriz/feedback
      // sempre entram no "prompt" (user), nunca no "system". Isso o torna
      // seguro para cache_control em toda a extensão, sem risco de cachear
      // conteúdo variável por engano.
      // cache_control em bloco "system" é recurso estável da Messages API
      // (sem beta header) na anthropic-version usada aqui (2023-06-01) — não
      // depende de SDK (esta function usa fetch bruto, não o SDK Anthropic).
      // Efeito: 1ª chamada da sessão paga escrita de cache (~1.25x); toda
      // chamada seguinte com o MESMO system (mesmo formato, mesmo modelo)
      // lê do cache a ~0.1x do preço — inclusive entre temas diferentes do
      // mesmo lote, já que o "system" não muda por tema.
      // Cache é por modelo: troca Haiku→Opus dentro do fallback não reaproveita
      // a escrita feita em Haiku (each cria/lê sua própria entrada).
      const resultado = await chamarAnthropicViaGate({
        gateParams: {
          apiKey: process.env.ANTHROPIC_API_KEY,
          model: modeloEscolhido,
          camposObrigatorios: { prompt },
        },
        corpo: {
          model:      modeloEscolhido,
          max_tokens: 8192, // aumentado de 4096 — 3 questões completas precisam de ~5000-6000 tokens
          system:     system
            ? [{ type: "text", text: system, cache_control: { type: "ephemeral" } }]
            : "",
          messages:   [{ role: "user", content: prompt }],
        },
      });

      if (!resultado.autorizado) {
        console.error("[gerarQuestoesIA] Gate bloqueou:", resultado.motivo);
        res.status(403).json({ erro: resultado.motivo });
        return;
      }

      const anthropicRes = resultado.response;
      if (!anthropicRes.ok) {
        const erroTexto = await anthropicRes.text();
        console.error("Erro Anthropic HTTP", anthropicRes.status, erroTexto);
        res.status(502).json({ erro: `Erro da IA (${anthropicRes.status}). Tente novamente.` });
        return;
      }

      const data = await anthropicRes.json();
      res.status(200).json(data);

    } catch (error) {
      console.error("Erro gerarQuestoesIA:", error.message || error);
      res.status(500).json({ erro: "Erro interno no servidor de IA. Verifique os logs." });
    }
  });

// ─── FUNÇÃO 3: EXTRAÇÃO OFICIAL DE PROVA INEP ─────────────────────────────────
// Recebe PDF em base64 + provaId, envia ao Claude como documento nativo,
// extrai fielmente enunciados/alternativas/gabarito sem qualquer paráfrase,
// e persiste o rascunho em importacoes_pendentes/{provaId}/questoes/{id}.
//
// Campos imutáveis gravados aqui: id, numeroQuestao, provaId, isOficial, ano,
// origem_prova, enunciado, alternativaA-E, gabarito, temImagem.
// Campos pedagógicos ficam vazios: preenchidos pela função enriquecerProvaINEP.
//
// Aceita gabaritoBase64 (PDF de gabarito separado) — comum no Revalida INEP.
// Se omitido, gabarito fica "" para preenchimento manual na revisão.
exports.extrairProvaINEP = functions
  .region("us-central1")
  .runWith({ timeoutSeconds: 300, memory: "512MB" })
  .https.onRequest(async (req, res) => {

    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") { res.status(204).send(""); return; }
    if (req.method !== "POST")   { res.status(405).json({ erro: "Método não permitido" }); return; }

    // ── AUTENTICAÇÃO — apenas admin ─────────────────────────────────────────
    const admin_user = await verificarAdmin(req.headers.authorization || "");
    if (!admin_user) {
      res.status(403).json({ erro: "Acesso restrito ao administrador." }); return;
    }

    const {
      pdfBase64,
      mediaType = "application/pdf",
      provaId,
      totalEsperado,
      gabaritoBase64,
    } = req.body;

    // ── PARSE provaId ─────────────────────────────────────────────────────────
    const partes  = String(provaId).split(".");
    const ano     = parseInt(partes[0]);
    const semestre = parseInt(partes[1]);
    if (isNaN(ano) || isNaN(semestre)) {
      res.status(400).json({ erro: "provaId inválido. Use formato YYYY.S (ex: 2026.1)" }); return;
    }

    try {
      // ── MONTAR MENSAGEM PARA O CLAUDE ─────────────────────────────────────
      const content = [];

      // PDF principal (questões)
      content.push({
        type: "document",
        source: { type: "base64", media_type: mediaType, data: pdfBase64 },
      });

      // PDF de gabarito (opcional — publicado separadamente pelo INEP)
      if (gabaritoBase64) {
        content.push({
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: gabaritoBase64 },
        });
      }

      const totalInfo = totalEsperado
        ? `A prova tem exatamente ${totalEsperado} questões.`
        : "Extraia todas as questões encontradas.";

      const gabaritoInfo = gabaritoBase64
        ? "O segundo documento é o gabarito oficial. Use-o para preencher o campo \"gabarito\" de cada questão."
        : "Se o gabarito não estiver no PDF, deixe o campo \"gabarito\" vazio (\"\").";

      content.push({
        type: "text",
        text:
`Você é um extrator fiel de provas médicas oficiais do Revalida INEP ${provaId}.

Sua ÚNICA função é extrair o texto EXATAMENTE como aparece no PDF — sem alterar, corrigir, resumir ou parafrasear nenhuma palavra.

${gabaritoInfo}
${totalInfo}

REGRAS ABSOLUTAS:
1. NUNCA reescreva ou parafraseie o enunciado — copie letra por letra
2. NUNCA corrija erros ortográficos ou gramaticais do original
3. NUNCA adicione interpretações ou informações ausentes no PDF
4. Para alternativas: inclua apenas o texto da alternativa, SEM a letra inicial (sem "A)", "(A)", "a." etc.)
5. Para gabarito: use apenas a letra minúscula: a, b, c, d ou e
6. Se a questão tiver imagem essencial ao enunciado, escreva "[IMAGEM]" no local exato onde ela aparece
7. Quebre o enunciado em parágrafos naturais usando \\n onde necessário
8. Preserve numeração das questões exatamente como na prova

Retorne SOMENTE um JSON array válido, sem markdown, sem blocos de código, sem texto antes ou depois:
[
  {
    "numeroQuestao": 1,
    "enunciado": "texto exato do enunciado...",
    "alternativaA": "texto exato sem a letra",
    "alternativaB": "texto exato sem a letra",
    "alternativaC": "texto exato sem a letra",
    "alternativaD": "texto exato sem a letra",
    "alternativaE": "texto exato sem a letra",
    "gabarito": "c",
    "temImagem": false
  }
]`,
      });

      // ── CHAMADA AO CLAUDE — via Gate único (Micro Sprint 4B.0) ────────────
      // Mesmo gate de gerarQuestoesIA: ausência da chave ou de pdfBase64/
      // provaId bloqueia (403) antes de qualquer chamada à Anthropic.
      const resultadoGate = await chamarAnthropicViaGate({
        gateParams: {
          apiKey: process.env.ANTHROPIC_API_KEY,
          model: "claude-sonnet-4-6",
          camposObrigatorios: { pdfBase64, provaId },
        },
        corpo: {
          model:      "claude-sonnet-4-6",
          max_tokens: 32768,
          messages:   [{ role: "user", content }],
        },
        headersExtras: {
          // Beta: aumenta max_tokens até 128K — necessário para provas com 120 questões
          "anthropic-beta": "output-128k-2025-02-19",
        },
      });

      if (!resultadoGate.autorizado) {
        console.error("[extrairProvaINEP] Gate bloqueou:", resultadoGate.motivo);
        res.status(403).json({ erro: resultadoGate.motivo }); return;
      }

      const anthropicRes = resultadoGate.response;
      if (!anthropicRes.ok) {
        const erroTexto = await anthropicRes.text();
        console.error("[extrairProvaINEP] Erro Anthropic:", anthropicRes.status, erroTexto);
        res.status(502).json({ erro: `Erro na extração via IA (${anthropicRes.status}).` }); return;
      }

      const data        = await anthropicRes.json();
      const textoResposta = (data.content?.[0]?.text || "").trim();

      // ── PARSE DO JSON RETORNADO ───────────────────────────────────────────
      let questoesRaw;
      try {
        // Remove blocos de código se o modelo os incluiu mesmo sendo instruído a não
        const jsonStr = textoResposta
          .replace(/^```(?:json)?\n?/i, "")
          .replace(/\n?```$/i, "")
          .trim();
        questoesRaw = JSON.parse(jsonStr);
        if (!Array.isArray(questoesRaw) || questoesRaw.length === 0)
          throw new Error("Resposta não é um array válido");
      } catch (e) {
        console.error("[extrairProvaINEP] Parse falhou. Trecho:", textoResposta.substring(0, 800));
        res.status(422).json({
          erro: "IA retornou formato inválido. Verifique o PDF e tente novamente.",
          trecho: textoResposta.substring(0, 500),
        });
        return;
      }

      // ── MONTAR DOCUMENTOS FINAIS (campos imutáveis + pedagógicos vazios) ─
      const idBase  = `${ano}_${semestre}`;
      const questoes = questoesRaw.map(q => ({
        // ── IMUTÁVEIS ──
        id:           `${idBase}_Q${q.numeroQuestao}`,
        numeroQuestao: Number(q.numeroQuestao),
        provaId,
        isOficial:    true,
        ano,
        origem_prova: `INEP Revalida ${provaId}`,
        enunciado:    String(q.enunciado    || ""),
        alternativaA: String(q.alternativaA || ""),
        alternativaB: String(q.alternativaB || ""),
        alternativaC: String(q.alternativaC || ""),
        alternativaD: String(q.alternativaD || ""),
        alternativaE: String(q.alternativaE || ""),
        gabarito:     String(q.gabarito     || "").toLowerCase(),
        temImagem:    Boolean(q.temImagem),
        imagemUrl:    "",
        // ── PEDAGÓGICOS — vazios, a serem preenchidos em enriquecerProvaINEP ──
        materia:       "",
        tema_mestre:   "",
        subtema:       "",
        raciocinio:    "",
        tto:           "",
        dicaMestre:    "",
        justificativaA: "",
        justificativaB: "",
        justificativaC: "",
        justificativaD: "",
        justificativaE: "",
        // ── METADADOS DE STAGING ──
        revisado:     false,
        statusSchema: "incompleto",
        criadoEm:     admin.firestore.FieldValue.serverTimestamp(),
      }));

      // ── PERSISTIR NO FIRESTORE (batch atômico) ────────────────────────────
      // Limite: 500 operações/batch. Revalida INEP tem ~120 questões → seguro.
      const batch      = db.batch();
      const docPrincipal = db.collection("importacoes_pendentes").doc(provaId);

      batch.set(docPrincipal, {
        provaId, ano, semestre,
        totalQuestoes: questoes.length,
        totalEsperado: totalEsperado || questoes.length,
        status:     "extraido",
        criadoPor:  admin_user.email,
        criadoEm:   admin.firestore.FieldValue.serverTimestamp(),
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      for (const q of questoes) {
        batch.set(docPrincipal.collection("questoes").doc(q.id), q);
      }

      await batch.commit();

      const aviso = (totalEsperado && questoes.length !== Number(totalEsperado))
        ? `Atenção: extração retornou ${questoes.length} questões, esperava ${totalEsperado}.`
        : null;

      console.log(
        `[extrairProvaINEP] ${provaId}: ${questoes.length} questões extraídas por ${admin_user.email}.` +
        (aviso ? ` AVISO: ${aviso}` : "")
      );

      res.status(200).json({
        sucesso:       true,
        provaId,
        totalExtraido: questoes.length,
        totalEsperado: totalEsperado || questoes.length,
        aviso,
      });

    } catch (e) {
      console.error("[extrairProvaINEP] Erro interno:", e.message || e);
      res.status(500).json({ erro: "Erro interno na extração. Verifique os logs." });
    }
  });

// ─── FUNÇÃO 4 (futura): enriquecerProvaINEP ───────────────────────────────────
// Adiciona campos pedagógicos (materia, tema_mestre, subtema, raciocinio, tto,
// dicaMestre, justificativaA-E) sem tocar nos campos imutáveis.
// Implementação: F2 do pipeline oficial INEP.

// ─── FUNÇÃO 5: WEBHOOK ────────────────────────────────────────────────────────
exports.webhookMercadoPago = functions
  .region("us-central1")
  .https.onRequest(async (req, res) => {

    res.set("Access-Control-Allow-Origin", "*");

    try {
      const { type, data } = req.body;
      if (type !== "payment") { res.status(200).send("OK"); return; }

      const paymentId = data?.id;
      if (!paymentId) { res.status(200).send("OK"); return; }

      const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { "Authorization": `Bearer ${MP_ACCESS_TOKEN}` },
      });

      if (!mpResponse.ok) { res.status(200).send("OK"); return; }

      const pagamento = await mpResponse.json();
      if (pagamento.status !== "approved") { res.status(200).send("OK"); return; }

      const [usuarioId, planoId, diasStr] = (pagamento.external_reference || "").split("|");
      const dias = parseInt(diasStr);
      if (!usuarioId || !dias || isNaN(dias)) { res.status(200).send("OK"); return; }

      const dataExpiracao = new Date();
      dataExpiracao.setDate(dataExpiracao.getDate() + dias);

      // set+merge garante que funciona mesmo se o documento não existir
      await db.collection("usuarios").doc(usuarioId).set({
        dataExpiracao: admin.firestore.Timestamp.fromDate(dataExpiracao),
        status: dias >= 180 ? "pago" : "basic",
        planoAtivo: planoId,
        bloqueado: false,
        ultimoPagamento: {
          paymentId: String(paymentId),
          valor: pagamento.transaction_amount,
          data: admin.firestore.FieldValue.serverTimestamp(),
          status: "approved",
        }
      }, { merge: true });

      const snap = await db.collection("pagamentos")
        .where("usuarioId", "==", usuarioId)
        .where("status", "==", "pendente")
        .orderBy("criadoEm", "desc")
        .limit(1).get();

      if (!snap.empty) {
        await snap.docs[0].ref.update({
          status: "aprovado",
          paymentId: String(paymentId),
          approvedAt: admin.firestore.FieldValue.serverTimestamp(),
          dataExpiracao: admin.firestore.Timestamp.fromDate(dataExpiracao),
        });
      }

      console.log(`Acesso ativado: ${usuarioId}, plano ${planoId}, ${dias} dias`);
      res.status(200).send("OK");

    } catch (error) {
      console.error("Erro webhook:", error);
      res.status(200).send("OK");
    }
  });
