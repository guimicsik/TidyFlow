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

function auditEs3LexicalAndRegex(fileName, src) {
  var issues = [];
  var i = 0;
  var len = src.length;
  var line = 1;
  var lastSigToken = "";

  function canStartRegex(tok) {
    if (!tok) return true;
    var kw = [
      "return", "typeof", "instanceof", "in", "delete", "void",
      "throw", "new", "case", "else", "do"
    ];
    if (kw.indexOf(tok) !== -1) return true;
    var lastCh = tok.charAt(tok.length - 1);
    return "(,{;[=!&|?:+-*%^~<>".indexOf(lastCh) !== -1;
  }

  while (i < len) {
    var c = src.charAt(i);
    var next = i + 1 < len ? src.charAt(i + 1) : "";

    if (c === "\n") {
      line++;
      i++;
      continue;
    }
    if (/\s/.test(c)) {
      i++;
      continue;
    }

    if (c === "/" && next === "/") {
      i += 2;
      while (i < len && src.charAt(i) !== "\n") i++;
      continue;
    }
    if (c === "/" && next === "*") {
      i += 2;
      while (i < len && !(src.charAt(i) === "*" && src.charAt(i + 1) === "/")) {
        if (src.charAt(i) === "\n") line++;
        i++;
      }
      i += 2;
      continue;
    }

    if (c === '"' || c === "'") {
      var quote = c;
      i++;
      while (i < len) {
        var sc = src.charAt(i);
        if (sc === "\\") {
          i += 2;
          continue;
        }
        if (sc === quote) {
          i++;
          break;
        }
        if (sc === "\n") line++;
        i++;
      }
      lastSigToken = "STR";
      continue;
    }

    if (c === "/" && next !== "=" && canStartRegex(lastSigToken)) {
      var startLine = line;
      var rxStart = i;
      i++;
      var inClass = false;
      var unescapedSlashInClass = false;
      var nonAsciiInRegex = false;
      while (i < len) {
        var rc = src.charAt(i);
        if (src.charCodeAt(i) > 127) nonAsciiInRegex = true;
        if (rc === "\\") {
          i += 2;
          continue;
        }
        if (rc === "[") {
          inClass = true;
          i++;
          continue;
        }
        if (rc === "]" && inClass) {
          inClass = false;
          i++;
          continue;
        }
        if (rc === "/") {
          if (inClass) {
            unescapedSlashInClass = true;
            i++;
            continue;
          }
          i++;
          break;
        }
        if (rc === "\n") break;
        i++;
      }
      var flags = "";
      while (i < len && /[a-zA-Z]/.test(src.charAt(i))) {
        flags += src.charAt(i);
        i++;
      }
      var rxText = src.slice(rxStart, i);
      if (unescapedSlashInClass) {
        issues.push(
          fileName + ":" + startLine + " → '/' sem escape dentro de [...] quebra o parser ES3 do ExtendScript: " + rxText
        );
      }
      if (/[^gim]/.test(flags)) {
        issues.push(fileName + ":" + startLine + " → flag RegExp incompatível com ES3 (" + flags + "): " + rxText);
      }
      if (nonAsciiInRegex) {
        issues.push(fileName + ":" + startLine + " → caractere não-ASCII em RegExp literal (use \\uXXXX): " + rxText);
      }
      lastSigToken = "REGEX";
      continue;
    }

    if (/[A-Za-z0-9_$]/.test(c)) {
      var idStart = i;
      while (i < len && /[A-Za-z0-9_$]/.test(src.charAt(i))) i++;
      lastSigToken = src.slice(idStart, i);
      continue;
    }

    if ((c === "]" || c === "}") && lastSigToken === ",") {
      issues.push(fileName + ":" + line + " → vírgula pendente (trailing comma) proibida em ES3 antes de '" + c + "'");
    }

    lastSigToken = c;
    i++;
  }

  return issues;
}

test("host/*.jsx respeita regras lexicais de RegExp e literais do ExtendScript (ES3)", function () {
  var files = hostFiles();
  var allIssues = [];
  for (var f = 0; f < files.length; f++) {
    var src = nodeFs.readFileSync(files[f].full, "utf8");
    var found = auditEs3LexicalAndRegex(files[f].name, src);
    for (var k = 0; k < found.length; k++) {
      allIssues.push(found[k]);
    }
  }
  assert.deepEq(allIssues, [], "incompatibilidades lexicais com o parser ES3 da Adobe");
});

test("todos os scripts do host são sintaticamente válidos", function () {
  var hostDir = nodePath.join(REPO_ROOT, "host");
  var entries = nodeFs.readdirSync(hostDir);
  var checked = 0;
  for (var i = 0; i < entries.length; i++) {
    var fileName = entries[i];
    if (!/\.jsx$/i.test(fileName)) continue;
    var code = nodeFs.readFileSync(nodePath.join(hostDir, fileName), "utf8");
    checked++;
    try {
      // O parser do Node é mais restritivo que o do ExtendScript: se passar aqui,
      // não há chave/parêntese faltando nem arquivo truncado.
      new Function(code);
    } catch (e) {
      assert.ok(false, fileName + " não parseia: " + e.message);
    }
  }
  assert.ok(checked >= 6, "esperava validar todos os .jsx do host (validados: " + checked + ")");
});

test("P2: triagem de áudio nunca fica silenciosa no motor PPRO", function () {
  var code = nodeFs.readFileSync(nodePath.join(REPO_ROOT, "host", "ppro_organizer.jsx"), "utf8");

  // Contrato de diagnóstico exposto ao painel (MANIFESTO 2.3 / 7.5)
  var contract = [
    '"audioSeparate": ',
    '"audioTotal": ',
    '"audioNoMatch": ',
    '"audioRoles": ',
    '"audioTargets": ',
    '"audioSamples": ',
    '"emptyLeftovers": ',
    '"debugTrace": "'
  ];
  for (var i = 0; i < contract.length; i++) {
    assert.includes(code, contract[i], "campo de diagnóstico ausente no JSON de organizeWithPreset");
  }

  // O papel detectado não pode voltar a poluir nameCandidates: como o filtro por
  // nome tem prioridade absoluta em _rules.jsx, isso fazia qualquer nó com
  // nameFilter "sfx"/"fx"/"music"/"voz" capturar o áudio.
  assert.notIncludes(code, 'nameCandidates.push("sfx"', "papel de áudio não pode ser injetado em nameCandidates");
  assert.notIncludes(code, 'nameCandidates.push("dialogue"', "papel de áudio não pode ser injetado em nameCandidates");
  assert.notIncludes(code, 'nameCandidates.push("music"', "papel de áudio não pode ser injetado em nameCandidates");
  assert.notIncludes(code, 'nameCandidates.push("ambience"', "papel de áudio não pode ser injetado em nameCandidates");
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
  assert.includes(code, "buildTimelineAudioMap", "função de mapeamento de áudio da timeline deve existir");
  assert.includes(code, "classifyAudioRole", "função de classificação de áudio deve existir");
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
