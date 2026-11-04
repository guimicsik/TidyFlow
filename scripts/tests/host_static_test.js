/* ==========================================================================
   TidyFlow — Testes estáticos dos scripts de host (ExtendScript/ES3)
   Garante conformidade ES3 e presença das fronteiras de desfazer/undo.
   ========================================================================== */
"use strict";

var nodeFs = require("fs");
var nodePath = require("path");
var harnessLib = require("./lib/harness");

var REPO_ROOT = nodePath.resolve(__dirname, "..", "..");
var h = harnessLib.createHarness("Host ES3");
var test = h.test;
var assert = h.assert;

var PROHIBITED = [
  { name: "const", re: /\bconst\s+[A-Za-z_$]/ },
  { name: "let", re: /\blet\s+[A-Za-z_$]/ },
  { name: "arrow function", re: /=>/ },
  { name: "template literal", re: /`/ },
  { name: "Array.forEach", re: /\.forEach\s*\(/ },
  { name: "Array.map", re: /\.map\s*\(/ },
  { name: "Array.filter", re: /\.filter\s*\(/ },
  { name: "Array.reduce", re: /\.reduce\s*\(/ },
  { name: "Object.keys", re: /Object\.keys\s*\(/ },
  { name: "Array.prototype.includes", re: /\.includes\s*\(/ }
];

// Remove comentários antes de checar sintaxe: comentários podem citar `backticks`
// e nomes de construções modernas sem que o código as use.
function stripComments(code) {
  var withoutBlocks = code.replace(/\/\*[\s\S]*?\*\//g, "");
  return withoutBlocks
    .split(/\r?\n/)
    .map(function (line) {
      if (line.indexOf("://") !== -1) return line;
      var idx = line.indexOf("//");
      return idx === -1 ? line : line.substring(0, idx);
    })
    .join("\n");
}

function hostFiles() {
  var dir = nodePath.join(REPO_ROOT, "host");
  return nodeFs
    .readdirSync(dir)
    .filter(function (f) {
      return /\.jsx$/i.test(f);
    })
    .map(function (f) {
      return { name: "host/" + f, full: nodePath.join(dir, f) };
    });
}

test("host/*.jsx respeita ECMAScript 3 estrito", function () {
  var files = hostFiles();
  assert.ok(files.length >= 4, "esperado ao menos 4 arquivos de host");

  var violations = [];
  for (var f = 0; f < files.length; f++) {
    var code = stripComments(nodeFs.readFileSync(files[f].full, "utf8"));
    var lines = code.split(/\r?\n/);
    for (var l = 0; l < lines.length; l++) {
      for (var p = 0; p < PROHIBITED.length; p++) {
        if (PROHIBITED[p].re.test(lines[l])) {
          violations.push(files[f].name + ":" + (l + 1) + " → " + PROHIBITED[p].name);
        }
      }
    }
  }
  assert.deepEq(violations, [], "construções não suportadas pelo ExtendScript (ES3)");
});

test("motor AEFT mantém os contratos de snapshot/rollback", function () {
  var code = nodeFs.readFileSync(nodePath.join(REPO_ROOT, "host", "aeft_organizer.jsx"), "utf8");
  var contracts = [
    "$.global.aeft_captureRawSnapshot",
    "$.global.aeft_ensurePreOrganizeSnapshot",
    "$.global.aeft_markPostOrganizeState",
    "$.global.aeft_getRollbackSnapshotJson",
    "$.global.aeft_rollbackProject"
  ];
  for (var i = 0; i < contracts.length; i++) {
    assert.includes(code, contracts[i], "contrato ausente no motor AEFT");
  }
});

test("motor PPRO mantém os mesmos contratos", function () {
  var code = nodeFs.readFileSync(nodePath.join(REPO_ROOT, "host", "ppro_organizer.jsx"), "utf8");
  var contracts = [
    "$.global.ppro_captureRawSnapshot",
    "$.global.ppro_ensurePreOrganizeSnapshot",
    "$.global.ppro_markPostOrganizeState",
    "$.global.ppro_getRollbackSnapshotJson",
    "$.global.ppro_rollbackProject"
  ];
  for (var i = 0; i < contracts.length; i++) {
    assert.includes(code, contracts[i], "contrato ausente no motor PPRO");
  }
});

test("P1: motor PPRO declara fronteira de desfazer nas operações destrutivas", function () {
  var code = nodeFs.readFileSync(nodePath.join(REPO_ROOT, "host", "ppro_organizer.jsx"), "utf8");
  assert.includes(code, "app.beginUndoGroup", "Premiere Pro suporta beginUndoGroup e deve ser usado");
  assert.includes(code, "app.endUndoGroup", "todo beginUndoGroup precisa de endUndoGroup");

  var begins = (code.match(/ppro_beginUndoGroup\(\s*"/g) || []).length;
  var ends = (code.match(/ppro_endUndoGroup\(\);/g) || []).length;
  assert.ok(begins >= 4, "organize, createStructure, checkUnusedComps e rollback devem abrir grupo de desfazer");
  assert.eq(begins, ends, "número de ppro_beginUndoGroup e ppro_endUndoGroup deve casar");
});

test("P1: beginUndoGroup do AEFT só ocorre com projeto aberto", function () {
  var code = nodeFs.readFileSync(nodePath.join(REPO_ROOT, "host", "aeft_organizer.jsx"), "utf8");
  var idxBegin = code.indexOf('app.beginUndoGroup("Verificar Composi');
  var idxProjectCheck = code.indexOf("Nenhum projeto aberto no After Effects.");
  assert.ok(idxProjectCheck !== -1, "checagem de projeto ausente");
  assert.ok(
    idxProjectCheck < idxBegin,
    "a checagem de projeto deve vir ANTES de abrir o grupo de desfazer (checkUnusedComps)"
  );
});

module.exports = h;
