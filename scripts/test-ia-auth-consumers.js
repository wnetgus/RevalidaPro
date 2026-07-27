// ─── TESTES — ANTIRREGRESSÃO: TODO CONSUMIDOR DE gerarQuestoesIA DEVE AUTENTICAR ──
// Micro Sprint 4B.2. Mesmo padrão dos demais scripts desta família (Node
// puro, zero rede real). ESTRUTURAL por natureza — examina o CONTEÚDO
// VERSIONADO real dos arquivos (não são testes de função pura nem de
// integração real; um framework de DOM/mocking do Firebase Auth seria
// necessário para isso, e não é instalado nesta sprint — ver limitação
// declarada abaixo).
//
// O que este teste NÃO prova: que o navegador realmente envia o header em
// runtime, ou que o Firebase Auth real devolve um token válido. O que ele
// PROVA: que todo call site conhecido que constrói a URL de gerarQuestoesIA
// (a) importa obterHeadersAutenticados, (b) chama essa função ANTES do fetch
// correspondente, (c) espalha o resultado nos headers do fetch (não só
// Content-Type), e (d) que nenhum arquivo fora do inventário abaixo referencia
// o endpoint sem ter sido auditado aqui.
//
//   node scripts/test-ia-auth-consumers.js

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _raiz = path.resolve(__dirname, "..");

let passou = 0;
const falhas = [];
function teste(nome, fn) {
  try {
    fn();
    passou++;
    console.log(`✅ ${nome}`);
  } catch (e) {
    falhas.push({ nome, erro: e.message });
    console.log(`❌ ${nome} — ${e.message}`);
  }
}

function _ler(relPath) {
  return fs.readFileSync(path.join(_raiz, relPath), "utf8");
}

// ─── INVENTÁRIO EXPLÍCITO E AUDITÁVEL ────────────────────────────────────────
// Todo arquivo do projeto que referencia a URL de gerarQuestoesIA precisa
// estar nesta lista. Se um arquivo NOVO passar a referenciá-la sem entrar
// aqui, o teste 1 abaixo falha — é o mecanismo que detecta "novo consumidor
// fora do inventário sem validação" (critério 5 da Etapa 4).
const CONSUMIDORES_ESPERADOS = [
  {
    arquivo: "src/utils/promptEngine.js",
    descricao: "chamarIA (exportado) — usado por resumoEngine.js (SA e legado INEP)",
    tipo: "geração clínica",
    callSitesEsperados: 1,
  },
  {
    arquivo: "src/components/RoboGerador.jsx",
    descricao: "chamarIA local (ABCD via chamarIABruto, legado A-E, botão \"Resumo do Tema\") + rodarLote() (migração de tema_mestre)",
    tipo: "geração clínica + migração",
    callSitesEsperados: 2,
  },
  {
    arquivo: "src/components/ImportadorPro.jsx",
    descricao: "gerarViaIA",
    tipo: "geração clínica",
    callSitesEsperados: 1,
  },
  {
    arquivo: "src/components/ResumoGerador.jsx",
    descricao: "gerarUm + classificarUma (migração)",
    tipo: "geração clínica + migração",
    callSitesEsperados: 2,
  },
];

// ─── HELPERS ESTRUTURAIS ──────────────────────────────────────────────────────

// Encontra todos os índices de início de "fetch(endpoint" ou "fetch(ENDPOINT"
// — os dois nomes de variável usados no projeto para a URL de
// gerarQuestoesIA. Não é grep de uma string única: combina isso com checagem
// de ordem (import + chamada de auth ANTES) e checagem de conteúdo dos
// headers passados a CADA call site encontrado.
function _localizarCallSites(conteudo) {
  const indices = [];
  const regexFetch = /fetch\((endpoint|ENDPOINT)\s*,/g;
  let m;
  while ((m = regexFetch.exec(conteudo)) !== null) indices.push(m.index);
  return indices;
}

function _janelaAntes(conteudo, indice, tamanho = 2500) {
  return conteudo.slice(Math.max(0, indice - tamanho), indice);
}

function _headersDoCallSite(conteudo, indiceFetch) {
  // Pega o trecho entre "headers:" e o próximo "}" logo após o fetch — não
  // depende de indentação exata, só do padrão headers: { ... }.
  const trecho = conteudo.slice(indiceFetch, indiceFetch + 400);
  const m = trecho.match(/headers:\s*\{([^}]*)\}/);
  return m ? m[1] : "";
}

// ─── 1. INVENTÁRIO: nenhum arquivo fora da lista referencia o endpoint ───────

teste("1. [estrutural] todo arquivo que referencia a URL de gerarQuestoesIA está no inventário auditado", () => {
  const alvos = ["src", "functions"];
  const encontrados = new Set();
  function _varrer(dir) {
    for (const entry of fs.readdirSync(path.join(_raiz, dir), { withFileTypes: true })) {
      const rel = path.join(dir, entry.name);
      if (entry.isDirectory()) { _varrer(rel); continue; }
      if (!/\.(js|jsx)$/.test(entry.name)) continue;
      const conteudo = fs.readFileSync(path.join(_raiz, rel), "utf8");
      if (conteudo.includes('"/gerarQuestoesIA"')) encontrados.add(rel.split(path.sep).join("/"));
    }
  }
  for (const a of alvos) _varrer(a);

  const esperados = new Set(CONSUMIDORES_ESPERADOS.map(c => c.arquivo));
  const foraDoInventario = [...encontrados].filter(f => !esperados.has(f));
  assert.deepEqual(foraDoInventario, [], `arquivo(s) referenciando o endpoint fora do inventário: ${foraDoInventario.join(", ")}`);

  const noInventarioMasAusentes = [...esperados].filter(f => !encontrados.has(f));
  assert.deepEqual(noInventarioMasAusentes, [], `arquivo(s) do inventário que não referenciam mais o endpoint (inventário desatualizado?): ${noInventarioMasAusentes.join(", ")}`);
});

// ─── 2. Cada consumidor: import presente, nº de call sites esperado, cada um autenticado ─

for (const consumidor of CONSUMIDORES_ESPERADOS) {
  teste(`2. [estrutural] ${consumidor.arquivo} — importa obterHeadersAutenticados`, () => {
    const conteudo = _ler(consumidor.arquivo);
    assert.match(conteudo, /obterHeadersAutenticados/, `${consumidor.arquivo} não referencia obterHeadersAutenticados em lugar nenhum`);
    assert.match(conteudo, /import\s*\{\s*obterHeadersAutenticados\s*\}\s*from\s*["'].*apiAuth["']/, `${consumidor.arquivo} deveria importar obterHeadersAutenticados de apiAuth.js`);
  });

  teste(`3. [estrutural] ${consumidor.arquivo} — ${consumidor.callSitesEsperados} call site(s) esperado(s), todos autenticados`, () => {
    const conteudo = _ler(consumidor.arquivo);
    const callSites = _localizarCallSites(conteudo);
    assert.equal(
      callSites.length, consumidor.callSitesEsperados,
      `esperava ${consumidor.callSitesEsperados} chamada(s) fetch(endpoint|ENDPOINT) em ${consumidor.arquivo}, encontrou ${callSites.length} — inventário desatualizado ou regressão`
    );

    for (const idx of callSites) {
      const antes = _janelaAntes(conteudo, idx);
      assert.match(
        antes, /obterHeadersAutenticados\(/,
        `${consumidor.arquivo}: call site na posição ${idx} não é precedido por obterHeadersAutenticados (0 chamadas de rede deveriam ser possíveis sem token)`
      );

      const headers = _headersDoCallSite(conteudo, idx);
      assert.match(
        headers, /\.\.\.headersAuth/,
        `${consumidor.arquivo}: call site na posição ${idx} não espalha ...headersAuth nos headers — regressão para "fetch só com Content-Type"`
      );
      assert.doesNotMatch(
        headers, /^[^.]*"Content-Type":\s*"application\/json"\s*\}?\s*$/m,
        `${consumidor.arquivo}: headers parecem conter só Content-Type (sem headersAuth) — regressão`
      );
    }
  });
}

// ─── 4. Token nunca no body nem na URL ───────────────────────────────────────

teste("4. [estrutural] nenhum token (Auth ou App Check) é interpolado no body (JSON.stringify) nem na URL do endpoint", () => {
  for (const consumidor of CONSUMIDORES_ESPERADOS) {
    const conteudo = _ler(consumidor.arquivo);
    // Constrói a URL do endpoint — nenhuma dessas linhas deveria referenciar
    // headersAuth/token/idToken/appCheck.
    const construcoesUrl = conteudo.match(/const endpoint\s*=[\s\S]*?"\/gerarQuestoesIA";/g) || [];
    const construcoesUrlUpper = conteudo.match(/const ENDPOINT\s*=[\s\S]*?"\/gerarQuestoesIA";/g) || [];
    for (const trecho of [...construcoesUrl, ...construcoesUrlUpper]) {
      assert.doesNotMatch(trecho, /headersAuth|token|idToken|appCheck/i, `${consumidor.arquivo}: URL do endpoint não deveria referenciar token`);
    }
    // Corpo da requisição (JSON.stringify({...})) logo após cada call site —
    // não deve conter headersAuth/token/appCheck.
    const callSites = _localizarCallSites(conteudo);
    for (const idx of callSites) {
      const trecho = conteudo.slice(idx, idx + 500);
      const bodyMatch = trecho.match(/body:\s*JSON\.stringify\(\{([\s\S]*?)\}\)/);
      if (bodyMatch) {
        assert.doesNotMatch(bodyMatch[1], /headersAuth|idToken|Authorization|appCheck|AppCheck/i, `${consumidor.arquivo}: body não deveria conter token/headersAuth/App Check`);
      }
    }
  }
});

// ─── 5. apiAuth.js nunca loga o token ────────────────────────────────────────

teste("5. [estrutural] apiAuth.js não usa console.log/console.error/localStorage sobre o token", () => {
  const conteudo = _ler("src/utils/apiAuth.js");
  assert.doesNotMatch(conteudo, /console\.(log|error|warn|info|debug)/, "apiAuth.js não deveria logar nada — o token nunca pode aparecer em log");
  assert.doesNotMatch(conteudo, /localStorage\.(getItem|setItem)|sessionStorage\.(getItem|setItem)/, "apiAuth.js não deveria LER/ESCREVER localStorage/sessionStorage — token sempre obtido na hora via getIdToken() (a palavra pode aparecer em comentário explicando essa própria regra, o que é esperado)");
});

// ─── 6. Guards clínicos continuam antes das chamadas nos fluxos clínicos ─────
// Reexecuta, para os arquivos desta sprint, a mesma checagem de ordem já
// validada em scripts/test-diretrizes-governanca.js (testes 60-64) — aqui
// focada em confirmar que a autenticação NÃO foi inserida antes do gate
// clínico em nenhum dos fluxos.

teste("6. [estrutural] RoboGerador.jsx — gate clínico (avaliarBloqueioSeguro) continua ANTES de chamarIA/chamarIABruto nos fluxos ABCD e legado", () => {
  const conteudo = _ler("src/components/RoboGerador.jsx");
  const idxGateABCD = conteudo.indexOf("avaliarBloqueioSeguro(diretrizesRef.current, tema, \"\")");
  const idxExecutarSA = conteudo.indexOf("executarGeracaoSA(promptTema, systemPromptAtual");
  assert.ok(idxGateABCD !== -1 && idxExecutarSA !== -1, "marcadores não encontrados");
  assert.ok(idxGateABCD < idxExecutarSA, "gate clínico ABCD deveria continuar antes de executarGeracaoSA");

  const idxGateLegado = conteudo.indexOf("avaliacaoLegado.bloqueado");
  const idxChamarIALegado = conteudo.indexOf("await chamarIA(promptTema, systemPromptAtual)");
  assert.ok(idxGateLegado !== -1 && idxChamarIALegado !== -1, "marcadores do fluxo legado não encontrados");
  assert.ok(idxGateLegado < idxChamarIALegado, "gate clínico legado deveria continuar antes de chamarIA");
});

teste("7. [estrutural] ImportadorPro.jsx e ResumoGerador.jsx — nos fluxos com gate clínico, ele continua antes da autenticação", () => {
  // ImportadorPro.jsx só tem um fluxo relevante (gerarViaIA) — checagem no
  // arquivo inteiro é segura. ResumoGerador.jsx tem DOIS fluxos distintos:
  // gerarUm (geração clínica, TEM gate) e classificarUma (migração, não tem
  // gate por design — não é geração de conteúdo protocolar). Comparar
  // índices globais do arquivo inteiro daria falso positivo, já que
  // classificarUma aparece antes de gerarUm no arquivo. Escopo a checagem à
  // função gerarUm especificamente.
  const importador = _ler("src/components/ImportadorPro.jsx");
  const idxGateImp = importador.indexOf("avaliacaoGovernanca.bloqueado");
  const idxAuthImp = importador.indexOf("obterHeadersAutenticados(");
  assert.ok(idxGateImp !== -1 && idxAuthImp !== -1, "ImportadorPro.jsx: marcadores não encontrados");
  assert.ok(idxGateImp < idxAuthImp, "ImportadorPro.jsx: gate clínico deveria continuar antes da obtenção do token");

  const resumo = _ler("src/components/ResumoGerador.jsx");
  const idxGerarUm = resumo.indexOf("const gerarUm = useCallback");
  assert.ok(idxGerarUm !== -1, "ResumoGerador.jsx: função gerarUm não encontrada");
  const corpoGerarUm = resumo.slice(idxGerarUm);
  const idxGateResumo = corpoGerarUm.indexOf("avaliacaoGovernanca.bloqueado");
  const idxAuthResumo = corpoGerarUm.indexOf("obterHeadersAutenticados(");
  assert.ok(idxGateResumo !== -1 && idxAuthResumo !== -1, "ResumoGerador.jsx: marcadores não encontrados dentro de gerarUm");
  assert.ok(idxGateResumo < idxAuthResumo, "ResumoGerador.jsx: dentro de gerarUm, o gate clínico deveria continuar antes da obtenção do token");
});

// ─── 8. resumoEngine.js delega inteiramente a promptEngine.js (não duplica fetch) ─

teste("8. [estrutural] resumoEngine.js não define seu próprio fetch para o endpoint — delega a chamarIA de promptEngine.js", () => {
  const conteudo = _ler("src/utils/resumoEngine.js");
  assert.doesNotMatch(conteudo, /"\/gerarQuestoesIA"/, "resumoEngine.js não deveria construir a URL do endpoint por conta própria");
  assert.match(conteudo, /import\s*\{[^}]*chamarIA[^}]*\}\s*from\s*["'].*promptEngine["']/, "resumoEngine.js deveria importar chamarIA de promptEngine.js");
});

// ═══════════════════════════════════════════════════════════════════════════
// MICRO SPRINT 4B.3B.1A — todo consumidor passa a enviar X-Firebase-AppCheck
// (via obterHeadersAutenticados(auth, obterTokenAppCheck)). Estrutural, como
// o resto deste arquivo: examina o código-fonte real, não executa fetch nem
// Firebase real — "enviar o header" aqui significa "todo call site chama o
// helper com o segundo argumento", que é o único lugar que de fato monta
// X-Firebase-AppCheck (ver src/utils/apiAuth.js, coberto por
// scripts/test-appcheck-client.js).
// ═══════════════════════════════════════════════════════════════════════════

for (const consumidor of CONSUMIDORES_ESPERADOS) {
  teste(`9. [estrutural] ${consumidor.arquivo} — importa obterTokenAppCheck de ../firebase`, () => {
    const conteudo = _ler(consumidor.arquivo);
    assert.match(
      conteudo, /import\s*\{[^}]*obterTokenAppCheck[^}]*\}\s*from\s*["'].*firebase["']/,
      `${consumidor.arquivo} deveria importar obterTokenAppCheck de ../firebase`
    );
  });

  teste(`10. [estrutural] ${consumidor.arquivo} — todo call site de obterHeadersAutenticados envia obterTokenAppCheck (X-Firebase-AppCheck)`, () => {
    const conteudo = _ler(consumidor.arquivo);
    const chamadas = conteudo.match(/obterHeadersAutenticados\([^)]*\)/g) || [];
    assert.ok(chamadas.length > 0, `${consumidor.arquivo}: nenhuma chamada a obterHeadersAutenticados encontrada`);
    for (const chamada of chamadas) {
      assert.match(
        chamada, /obterTokenAppCheck/,
        `${consumidor.arquivo}: "${chamada}" deveria passar obterTokenAppCheck como segundo argumento — regressão para só Authorization, sem X-Firebase-AppCheck`
      );
    }
  });
}

console.log(`\n${passou}/${passou + falhas.length} testes passaram.`);
if (falhas.length > 0) {
  console.log("\nFALHAS:");
  falhas.forEach(f => console.log(`- ${f.nome}: ${f.erro}`));
  process.exit(1);
}
