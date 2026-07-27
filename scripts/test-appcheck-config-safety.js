// ─── TESTES — SEGURANÇA DA CONFIGURAÇÃO EXTERNA DO APP CHECK (4B.3B.2) ──────
// Script Node puro, mesmo padrão dos demais desta família. Não testa
// comportamento de runtime (isso já é feito por scripts/test-appcheck-client.js
// e scripts/test-appcheck-gate-server.js) — este arquivo é especificamente
// sobre SEGURANÇA DA CONFIGURAÇÃO: nenhuma chave real pode estar versionada,
// nenhum fallback para produção pode existir, nenhuma credencial pode ser
// logada. Roda inteiramente sobre `git ls-files` e leitura de arquivos —
// nenhuma chamada de rede, nenhum Firebase real.
//
//   node scripts/test-appcheck-config-safety.js

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
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

function _arquivosRastreados() {
  return execFileSync("git", ["ls-files"], { cwd: _raiz, encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
}

// ─── 1. Nenhum arquivo .env real está rastreado pelo Git ─────────────────────

teste("1. nenhum arquivo .env (.env, .env.local, .env.development, .env.production) está rastreado pelo Git", () => {
  const rastreados = _arquivosRastreados();
  const envReais = rastreados.filter(f => /^\.env(\.local|\.development|\.production)?$/.test(path.basename(f)));
  assert.deepEqual(envReais, [], `arquivo(s) .env real(is) não deveriam estar versionados: ${envReais.join(", ")}`);
});

// ─── 2. Nenhuma chave/token real de App Check existe em qualquer arquivo versionado ─

teste("2. nenhum arquivo rastreado pelo Git contém VITE_FIREBASE_APPCHECK_SITE_KEY com valor não-vazio", () => {
  const rastreados = _arquivosRastreados();
  for (const rel of rastreados) {
    const abs = path.join(_raiz, rel);
    if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) continue;
    let conteudo;
    try { conteudo = fs.readFileSync(abs, "utf8"); } catch { continue; } // binário/ilegível — ignora
    const m = conteudo.match(/^VITE_FIREBASE_APPCHECK_SITE_KEY=(.*)$/m);
    if (m) {
      assert.equal(m[1].trim(), "", `${rel}: VITE_FIREBASE_APPCHECK_SITE_KEY não deveria ter valor em arquivo versionado (encontrado: presente, não vazio)`);
    }
  }
});

teste("2b. nenhum arquivo rastreado pelo Git contém um Debug Token de App Check (padrão de UUID após FIREBASE_APPCHECK_DEBUG_TOKEN)", () => {
  const rastreados = _arquivosRastreados();
  const padraoUuid = /FIREBASE_APPCHECK_DEBUG_TOKEN\s*[:=]\s*["']?[0-9a-fA-F-]{20,}["']?/;
  for (const rel of rastreados) {
    const abs = path.join(_raiz, rel);
    if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) continue;
    let conteudo;
    try { conteudo = fs.readFileSync(abs, "utf8"); } catch { continue; }
    assert.doesNotMatch(conteudo, padraoUuid, `${rel}: parece conter um debug token real de App Check`);
  }
});

// ─── 3. Arquivo de exemplo tem exatamente os 2 nomes, sem valores ────────────

teste("3. .env.appcheck.example existe, contém só os 2 nomes esperados, sem nenhum valor", () => {
  const p = path.join(_raiz, ".env.appcheck.example");
  assert.ok(fs.existsSync(p), ".env.appcheck.example deveria existir");
  const conteudo = fs.readFileSync(p, "utf8");
  assert.match(conteudo, /^VITE_FIREBASE_APPCHECK_SITE_KEY=\s*$/m, "deveria conter VITE_FIREBASE_APPCHECK_SITE_KEY= vazio");
  assert.match(conteudo, /^VITE_FIREBASE_APPCHECK_DEBUG=\s*$/m, "deveria conter VITE_FIREBASE_APPCHECK_DEBUG= vazio");
  // Nenhuma linha de valor deveria ter conteúdo após o "=" (exceto comentários)
  const linhasValor = conteudo.split("\n").filter(l => /^VITE_FIREBASE_APPCHECK_/.test(l));
  for (const linha of linhasValor) {
    const valor = linha.split("=")[1] || "";
    assert.equal(valor.trim(), "", `linha "${linha}" não deveria ter valor`);
  }
});

// ─── 4. src/firebase.js: sem fallback para produção, sem log de credencial ───

teste("4. src/firebase.js: leitura da site key não tem fallback para nenhum valor literal (nunca cai em produção)", () => {
  const src = fs.readFileSync(path.join(_raiz, "src/firebase.js"), "utf8");
  const linha = src.match(/const APPCHECK_SITE_KEY\s*=\s*(.*);/);
  assert.ok(linha, "linha de leitura de APPCHECK_SITE_KEY não encontrada");
  assert.doesNotMatch(linha[1], /\|\|/, "não deveria haver nenhum fallback (||) na leitura da site key — ausência da env var deve resultar em null, nunca em um valor substituto");
});

teste("5. src/firebase.js: comparação do Debug é estrita (=== \"true\"), não apenas truthy", () => {
  const src = fs.readFileSync(path.join(_raiz, "src/firebase.js"), "utf8");
  assert.match(src, /VITE_FIREBASE_APPCHECK_DEBUG\s*===\s*"true"/, "deveria comparar estritamente com a string \"true\" — qualquer outro valor mantém o debug desligado");
});

teste("6. src/firebase.js: nenhum console.log/console.error da site key, do token de App Check ou do debug token", () => {
  const src = fs.readFileSync(path.join(_raiz, "src/firebase.js"), "utf8");
  // Já coberto genericamente por outros testes desta família (sem log
  // nenhum em apiAuth.js) — aqui, especificamente, nenhuma linha de log
  // deveria referenciar as variáveis de App Check.
  const linhasLog = src.split("\n").filter(l => /console\.(log|error|warn|info|debug)/.test(l));
  for (const linha of linhasLog) {
    assert.doesNotMatch(linha, /APPCHECK_SITE_KEY|FIREBASE_APPCHECK_DEBUG_TOKEN|appCheck\.token|tokenAppCheck/i, `linha de log não deveria referenciar credencial de App Check: "${linha.trim()}"`);
  }
});

// ─── 7. Regressão: as suítes de runtime do App Check continuam íntegras ──────

teste("7. [regressão] test-appcheck-client.js e test-appcheck-gate-server.js continuam passando integralmente", () => {
  for (const script of ["scripts/test-appcheck-client.js", "scripts/test-appcheck-gate-server.js"]) {
    const out = execFileSync(process.execPath, [path.join(_raiz, script)], { encoding: "utf8" });
    assert.doesNotMatch(out, /❌/, `${script} não deveria ter nenhuma falha`);
  }
});

console.log(`\n${passou}/${passou + falhas.length} testes passaram.`);
if (falhas.length > 0) {
  console.log("\nFALHAS:");
  falhas.forEach(f => console.log(`- ${f.nome}: ${f.erro}`));
  process.exit(1);
}
