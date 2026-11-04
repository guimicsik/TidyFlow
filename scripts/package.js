#!/usr/bin/env node
/* ==========================================================================
   TidyFlow — Empacotador CEP (sem dependências externas)
   Gera release/tidyflow-<versao>.zip com o layout que o Adobe CEP espera:
     CSXS/manifest.xml
     client/**  (painel + Preset Builder + presets de fábrica)
     host/**    (motor + _lib.jsx + _rules.jsx)
   Não inclui .debug, dist/, scripts/, design/ nem documentação.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const PKG = require(path.join(ROOT, 'package.json'));
const OUT_DIR = path.join(ROOT, 'release');
const OUT_FILE = path.join(OUT_DIR, 'tidyflow-' + PKG.version + '.zip');

const CRITICAL = [
  'CSXS/manifest.xml',
  'client/index.html',
  'client/tree_editor.html',
  'client/main.js',
  'client/tree_editor.js',
  'client/PresetManager.js',
  'client/OrgLog.js',
  'client/presets/default_preset.json',
  'host/organizer.jsx',
  'host/aeft_organizer.jsx',
  'host/ppro_organizer.jsx',
  'host/_lib.jsx',
  'host/_rules.jsx'
];

function fail(msg) {
  console.error('[package] ERRO: ' + msg);
  process.exit(1);
}

function collectDir(relDir, bucket) {
  const abs = path.join(ROOT, relDir);
  if (!fs.existsSync(abs)) return;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const rel = path.join(relDir, entry.name).replace(/\\/g, '/');
    if (entry.isDirectory()) collectDir(rel, bucket);
    else bucket.push(rel);
  }
}

// --- CRC32 ---
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ CRC_TABLE[(c ^ buf[i]) & 0xFF];
  return (c ^ (-1)) >>> 0;
}

function dosDateTime(d) {
  const time = ((d.getHours() & 0x1F) << 11) | ((d.getMinutes() & 0x3F) << 5) | ((Math.floor(d.getSeconds() / 2)) & 0x1F);
  const date = (((d.getFullYear() - 1980) & 0x7F) << 9) | (((d.getMonth() + 1) & 0x0F) << 5) | (d.getDate() & 0x1F);
  return { time, date };
}

function buildZip(files) {
  const now = new Date();
  const { time, date } = dosDateTime(now);
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const rel of files) {
    const data = fs.readFileSync(path.join(ROOT, rel));
    const compressed = zlib.deflateRawSync(data, { level: 9 });
    const nameBuf = Buffer.from(rel, 'utf8');
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);

    locals.push(local, nameBuf, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);

    centrals.push(central, nameBuf);
    offset += local.length + nameBuf.length + compressed.length;
  }

  const centralBuf = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([Buffer.concat(locals), centralBuf, eocd]);
}

// --- execução ---
const missing = CRITICAL.filter((rel) => !fs.existsSync(path.join(ROOT, rel)));
if (missing.length) fail('arquivos obrigatorios ausentes: ' + missing.join(', '));

const manifest = fs.readFileSync(path.join(ROOT, 'CSXS/manifest.xml'), 'utf8');
if (manifest.indexOf('./client/index.html') === -1) fail('manifest.xml nao aponta para ./client/index.html');
if (manifest.indexOf('com.tidyflow') === -1) fail('manifest.xml sem o bundle com.tidyflow');

const files = ['CSXS/manifest.xml'];
collectDir('client', files);
collectDir('host', files);
files.sort();

const zip = buildZip(files);
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_FILE, zip);

const total = files.reduce((sum, rel) => sum + fs.statSync(path.join(ROOT, rel)).size, 0);
console.log('[package] ' + files.length + ' arquivos | ' + (total / 1024).toFixed(1) + ' KB descompactado | ' +
  (zip.length / 1024).toFixed(1) + ' KB zip');
console.log('[package] destino: ' + path.relative(ROOT, OUT_FILE));
for (const rel of files) console.log('   + ' + rel);
