/* ==========================================================================
   TidyFlow — Testes estáticos de referências de DOM (cliente CEP)
   Garante que todo getElementById/querySelector usado no JS exista no HTML.
   Isso evita código morto silencioso (ex.: campos de extensão do modal).
   ========================================================================== */
"use strict";

var nodeFs = require("fs");
var nodePath = require("path");
var harnessLib = require("./lib/harness");

var REPO_ROOT = nodePath.resolve(__dirname, "..", "..");
var h = harnessLib.createHarness("Refs de DOM");
var test = h.test;
var assert = h.assert;

function read(relPath) {
  return nodeFs.readFileSync(nodePath.join(REPO_ROOT, relPath), "utf8");
}

function collectHtmlIds(html) {
  var ids = {};
  var re = /\bid="([^"]+)"/g;
  var match;
  while ((match = re.exec(html)) !== null) {
    ids[match[1]] = true;
  }
  return ids;
}

function collectJsRefs(js) {
  var refs = {};
  var patterns = [
    /getElementById\(\s*["']([^"']+)["']\s*\)/g,
    /querySelector(?:All)?\(\s*["']#([A-Za-z0-9_-]+)["']\s*\)/g
  ];
  for (var p = 0; p < patterns.length; p++) {
    var match;
    var re = new RegExp(patterns[p].source, "g");
    while ((match = re.exec(js)) !== null) {
      refs[match[1]] = (refs[match[1]] || 0) + 1;
    }
  }
  return refs;
}

function checkPair(label, jsFile, htmlFile, htmlIds) {
  var js = read(jsFile);
  var refs = collectJsRefs(js);
  var missing = [];
  for (var id in refs) {
    if (!refs.hasOwnProperty(id)) continue;
    if (!htmlIds[id]) missing.push(id);
  }
  assert.deepEq(
    missing.sort(),
    [],
    label + ": " + jsFile + " referencia IDs que não existem em " + htmlFile
  );
}

var editorHtmlIds = collectHtmlIds(read("client/tree_editor.html"));
var panelHtmlIds = collectHtmlIds(read("client/index.html"));

test("tree_editor.js só usa IDs presentes em tree_editor.html", function () {
  checkPair("Editor de presets", "client/tree_editor.js", "client/tree_editor.html", editorHtmlIds);
});

test("main.js só usa IDs presentes em index.html", function () {
  checkPair("Painel", "client/main.js", "client/index.html", panelHtmlIds);
});

test("modal de regras oferece campo livre + chips de extensões (MANIFESTO §2.1)", function () {
  var html = read("client/tree_editor.html");
  assert.includes(html, 'id="inpNewExtension"', "input de extensão avulsa ausente");
  assert.includes(html, 'id="btnAddExtension"', "botão [+] Adicionar de extensões ausente");
  assert.includes(html, 'id="extTagsContainer"', "container de chips de extensões ausente");
});

test("chips de extensão reutilizam o estilo dos chips de nomenclatura", function () {
  var css = read("client/tree_editor.css");
  assert.includes(css, ".ext-tags-box", "estilo do container de chips ausente no CSS");
  assert.includes(css, ".ext-tag", "estilo do chip ausente no CSS");
});

test("tree_editor.js não referencia controles removidos da UI", function () {
  var js = read("client/tree_editor.js");
  assert.notIncludes(js, 'getElementById("btnSavePreset")', "btnSavePreset não existe mais na UI");
  assert.notIncludes(js, 'getElementById("inpUnusedFolderName")', "campo de nome da pasta de não usadas foi removido da UI");
  assert.notIncludes(js, "chkDeleteEmptyFolders", "toggle de excluir vazias vive apenas no painel principal");
});

test("painel principal mantém os controles documentados no manifesto", function () {
  var required = [
    "presetSelect",
    "btnOrganize",
    "btnCreateStructure",
    "btnMediaOnly",
    "btnCheckComps",
    "btnRollback",
    "chkPrefixNumbering",
    "chkSaveProject",
    "chkReduceProject",
    "chkDeleteEmptyFolders",
    "chkGroupBySourceFolder"
  ];
  for (var i = 0; i < required.length; i++) {
    assert.ok(panelHtmlIds[required[i]], "index.html deve conter #" + required[i]);
  }
});

test("P8: fluxos destrutivos de preset pedem confirmação antes de sobrescrever", function () {
  var js = read("client/tree_editor.js");
  assert.includes(js, 'code === "PRESET_EXISTS"', "importação deve tratar o conflito de nome");
  assert.includes(js, "function importPresetJson", "importação deve passar pelo fluxo com confirmação");
  assert.includes(js, "function doSaveAs", "Salvar como deve separar a confirmação da gravação");

  // As duas chamadas antigas (sem confirmação) não podem voltar
  assert.notIncludes(
    js,
    "importPresetFromJsonString(raw)",
    "importação não pode gravar direto sem confirmação"
  );
  assert.notIncludes(
    js,
    "importPresetFromJsonString(e.target.result)",
    "importação via FileReader não pode gravar direto sem confirmação"
  );
});

test("P8: handlers de sincronização respeitam edições não salvas (isDirty)", function () {
  var js = read("client/tree_editor.js");

  // Troca de preset no <select> não pode descartar edições sem confirmar
  assert.includes(
    js,
    "openConfirmModal(\n        \"Alterações não salvas\"",
    "troca de preset com isDirty deve pedir confirmação"
  );

  // Listener do focus não pode reaplicar o disco sobre o trabalho em andamento
  var focusIdx = js.indexOf('window.addEventListener("focus"');
  assert.ok(focusIdx !== -1, "listener de focus ausente");
  var focusBody = js.substring(focusIdx, focusIdx + 400);
  assert.includes(focusBody, "if (isDirty) return;", "focus deve abortar quando há edições não salvas");

  // presetsUpdated não pode recarregar outro preset por cima de edições
  assert.includes(
    js,
    "Não descartar o trabalho em andamento só porque outro painel trocou o preset",
    "presetsUpdated deve proteger edições não salvas"
  );
});

module.exports = h;
