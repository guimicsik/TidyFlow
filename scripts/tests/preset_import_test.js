/* ==========================================================================
   TidyFlow — Testes de importação de presets (Fase 8)
   Cobre: importação não sobrescreve preset existente sem confirmação,
   caminho de sobrescrita explícita e renomeio do preset de fábrica.
   ========================================================================== */
"use strict";

var nodePath = require("path");
var harnessLib = require("./lib/harness");
var clientEnv = require("./lib/client_env");

var h = harnessLib.createHarness("Importação de preset");
var test = h.test;
var assert = h.assert;
var REPO_ROOT = clientEnv.REPO_ROOT;

function newEnv(appId) {
  return clientEnv.loadPresetManager({
    appId: appId || "AEFT",
    extensionPath: REPO_ROOT
  });
}

function treeWith(folderName) {
  return [
    {
      id: "n_" + String(folderName).toLowerCase(),
      name: folderName,
      label: 4,
      rules: { types: ["StillImages"], extensions: ["png"] },
      children: []
    }
  ];
}

function presetJson(name, folderName) {
  return JSON.stringify({
    schemaVersion: 1,
    presetName: name,
    isBuiltIn: false,
    settings: { usePrefixNumbering: true },
    tree: treeWith(folderName)
  });
}

function normalizeLoose(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// O nome do arquivo passa por sanitizeFileName() dentro do PresetManager
// (espaços viram "_"), então a busca compara nomes normalizados.
function readPresetFile(env, presetName) {
  var files = env.mockFs.listFiles(env.presetsDir);
  var target = normalizeLoose(presetName);
  for (var i = 0; i < files.length; i++) {
    var base = files[i].substring(files[i].lastIndexOf("/") + 1).replace(/\.json$/i, "");
    if (normalizeLoose(base) === target) {
      return JSON.parse(env.mockFs.fs.readFileSync(files[i]));
    }
  }
  return null;
}

test("importar preset inédito grava em disco e o torna ativo", function () {
  var env = newEnv();
  var pm = env.newManager();

  var imported = pm.importPresetFromJsonString(presetJson("Preset Externo", "Imagens"));

  assert.eq(imported.presetName, "Preset Externo");
  assert.eq(pm.getActivePresetName(), "Preset Externo");
  assert.ok(readPresetFile(env, "Preset Externo"), "arquivo do preset importado deve existir em disco");
});

test("P8: importar preset existente NÃO sobrescreve sem confirmação", function () {
  var env = newEnv();
  var pm = env.newManager();

  pm.savePreset({ presetName: "Meu Preset", tree: treeWith("Original") });

  var threw = null;
  try {
    pm.importPresetFromJsonString(presetJson("Meu Preset", "Invasor"));
  } catch (e) {
    threw = e;
  }

  assert.ok(threw, "importação deve falhar quando o preset já existe");
  assert.eq(threw.code, "PRESET_EXISTS", "erro deve ser identificável pelo código");
  assert.eq(threw.presetName, "Meu Preset", "erro deve informar o nome em conflito");

  var onDisk = readPresetFile(env, "Meu Preset");
  assert.eq(onDisk.tree[0].name, "Original", "arquivo em disco não pode ser alterado sem confirmação");
});

test("P8: importar com overwrite=true sobrescreve o preset existente", function () {
  var env = newEnv();
  var pm = env.newManager();

  pm.savePreset({ presetName: "Meu Preset", tree: treeWith("Original") });
  var imported = pm.importPresetFromJsonString(presetJson("Meu Preset", "Invasor"), { overwrite: true });

  assert.eq(imported.presetName, "Meu Preset");
  assert.eq(readPresetFile(env, "Meu Preset").tree[0].name, "Invasor");
});

test("P8: presetExists compara sem diferenciar maiúsculas/minúsculas", function () {
  var env = newEnv();
  var pm = env.newManager();

  pm.savePreset({ presetName: "Meu Preset", tree: treeWith("Original") });

  assert.eq(pm.presetExists("meu PRESET"), true, "comparação deve ignorar caixa");
  assert.eq(pm.presetExists("Outro Preset"), false);
  assert.eq(pm.presetExists(""), false, "nome vazio nunca existe");
});

test("P8: importar o preset de fábrica não sobrescreve o Default", function () {
  var env = newEnv();
  var pm = env.newManager();

  var imported = pm.importPresetFromJsonString(
    JSON.stringify({
      presetName: "Default Clean",
      tree: treeWith("Qualquer"),
      settings: { usePrefixNumbering: false }
    })
  );

  assert.eq(imported.presetName, "Default Clean (Importado)", "preset de fábrica é renomeado na importação");
  assert.eq(imported.isBuiltIn, false, "cópia importada não é protegida");
  assert.eq(
    pm.getDefaultPreset().settings.usePrefixNumbering !== false,
    true,
    "as preferências do Default permanecem intactas"
  );
});

test("P8: JSON inválido continua lançando erro genérico (sem código de conflito)", function () {
  var env = newEnv();
  var pm = env.newManager();

  var threw = null;
  try {
    pm.importPresetFromJsonString('{"presetName":"X"}');
  } catch (e) {
    threw = e;
  }

  assert.ok(threw, "JSON sem 'tree' deve ser rejeitado");
  assert.eq(threw.code, undefined, "erro de schema não pode ser confundido com conflito de nome");
});

module.exports = h;
