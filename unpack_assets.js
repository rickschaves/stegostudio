#!/usr/bin/env node
/*
 * STEGO·STUDIO — unpack de binários guardados em base64
 *
 * O repo não aceita binário: rejeita .woff2/.ico e transcodifica PNG para JPEG
 * (redimensionando e destruindo o alfa). ASSETS_BASE64.md guarda os bytes como
 * texto; este script os devolve ao disco e CONFERE O SHA-256 de cada um.
 *
 * Uso:  node unpack_assets.js                 -> grava todos os arquivos
 *       node unpack_assets.js --check         -> só verifica, não grava
 *       node unpack_assets.js --pack <path>   -> imprime o bloco para colar no .md
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MD = path.join(__dirname, 'ASSETS_BASE64.md');
const sha = buf => crypto.createHash('sha256').update(buf).digest('hex');

function parse(md) {
  const blocks = [];
  const re = /^## (.+?)\n\s*- bytes: `(\d+)`\n- sha256: `([0-9a-f]{64})`\n\s*```base64\n([\s\S]*?)\n```/gm;
  let m;
  while ((m = re.exec(md)) !== null) {
    blocks.push({ dest: m[1].trim(), bytes: +m[2], sha256: m[3], b64: m[4].replace(/\s+/g, '') });
  }
  return blocks;
}

function pack(file) {
  const raw = fs.readFileSync(file);
  const b64 = raw.toString('base64').match(/.{1,100}/g).join('\n');
  process.stdout.write(
    `## ${file.replace(/\\/g, '/')}\n\n` +
    `- bytes: \`${raw.length}\`\n- sha256: \`${sha(raw)}\`\n\n` +
    '```base64\n' + b64 + '\n```\n\n'
  );
}

function main() {
  const args = process.argv.slice(2);
  const iPack = args.indexOf('--pack');
  if (iPack !== -1) {
    const f = args[iPack + 1];
    if (!f) { console.error('  --pack exige um caminho de arquivo'); process.exit(1); }
    return pack(f);
  }
  const checkOnly = args.includes('--check');

  if (!fs.existsSync(MD)) { console.error(`  ASSETS_BASE64.md não encontrado em ${__dirname}`); process.exit(1); }
  const blocks = parse(fs.readFileSync(MD, 'utf8'));
  if (blocks.length === 0) { console.error('  nenhum bloco reconhecido no ASSETS_BASE64.md'); process.exit(1); }

  console.log(`\n  unpack de binários — ${blocks.length} arquivo(s)${checkOnly ? ' (só verificação)' : ''}\n`);
  let bad = 0;
  for (const b of blocks) {
    const raw = Buffer.from(b.b64, 'base64');
    const okLen = raw.length === b.bytes;
    const okSha = sha(raw) === b.sha256;
    if (!okLen || !okSha) {
      bad++;
      console.log(`  ✗ ${b.dest}  —  ${!okLen ? `tamanho ${raw.length} != ${b.bytes}` : 'sha256 não confere'}`);
      continue;
    }
    if (!checkOnly) {
      fs.mkdirSync(path.dirname(path.join(__dirname, b.dest)), { recursive: true });
      fs.writeFileSync(path.join(__dirname, b.dest), raw);
    }
    console.log(`  ✓ ${b.dest.padEnd(38)} ${String(raw.length).padStart(7)}B`);
  }
  console.log(bad === 0
    ? `\n  ✓ ${blocks.length}/${blocks.length} íntegros${checkOnly ? '' : ' e gravados'}.\n`
    : `\n  ✗ ${bad} de ${blocks.length} corrompido(s) — NÃO usar.\n`);
  process.exit(bad === 0 ? 0 : 1);
}

main();
