/**
 * REVALIDAPRO — Cloud Functions para Mercado Pago
 * Versao 3.0 — simplificado, sem CPF obrigatorio
 */

const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const fetch = (...args) => import("node-fetch").then(({ default: f }) => f(...args));
const { chamarAnthropicViaGate } = require("./gate");

admin.initializeApp();
const db = admin.firestore();

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
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") { res.status(204).send(""); return; }
    if (req.method !== "POST")   { res.status(405).json({ erro: "Método não permitido" }); return; }

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

// ─── FUNÇÃO 3: WEBHOOK ────────────────────────────────────────────────────────
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
