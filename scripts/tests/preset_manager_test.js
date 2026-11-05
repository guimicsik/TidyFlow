/* ==========================================================================
   TidyFlow — Testes de client/PresetManager.js
   Cobre: persistência em disco, fallback localStorage, overrides do preset
   padrão (P0-4), falha de escrita em disco (P0-5) e lista de presets por host.
   ========================================================================== */
"use strict";

var nodePath = require("path");
var realFs = require("fs");
var harnessLib = require("./lib/harness");
var clientEnv = require("./lib/client_env");

var h = harnessLib.createHarness("PresetManager");
var test = h.test;
var assert = h.assert;
var REPO_ROOT = clientEnv.REPO_ROOT;

var DEFAULT_BUNDLE_JSON = realFs.readFileSync(
  nodePath.join(REPO_ROOT, "client", "presets", "default_preset.json"),
  "utf8"
);

function newEnv(options) {
  options = options || {};
  var env = clientEnv.loadPresetManager({
    appId: options.appId || "AEFT",
    extensionPath: REPO_ROOT
  });
  // Semeia o bundle de fábrica dentro do fs virtual para exercitar o caminho real
  env.mockFs.writeRaw(REPO_ROOT + "/client/presets/default_preset.json", DEFAULT_BUNDLE_JSON);
  return env;
}

function userPresetsMap(env) {
  var raw = env.localStorage.getItem("ae_organizer_user_presets_map");
  return raw ? JSON.parse(raw) : {};
}

function sampleTree() {
  return [
    {
      id: "n_imagens",
      name: "Imagens",
      label: 4,
      rules: { types: ["StillImages"], extensions: ["png"] },
      children: []
    }
  ];
}

h.test("salvar preset de usuário grava em disco e ativa o preset", function () {
  var env = newEnv();
  var pm = env.newManager();

  var saved = pm.savePreset({ presetName: "Meu Preset", tree: sampleTree() });

  assert.eq(pm.lastSaveError, null, "não deve haver erro de escrita");
  assert.eq(saved.presetName, "Meu Preset");
  assert.eq(pm.getActivePresetName(), "Meu Preset", "preset salvo vira o ativo");

  var filesOnDisk = env.mockFs.listFiles(env.presetsDir);
  assert.eq(filesOnDisk.length, 1, "um arquivo .json deve existir na pasta de presets");
  assert.includes(filesOnDisk[0], "Meu_Preset.json");

  var names = pm.listPresets().map(function (p) { return p.presetName; });
  assert.includes(names.join("|"), "Meu Preset", "listPresets deve conter o preset salvo");
});

h.test("P0-5: falha de escrita em disco não cria preset fantasma", function () {
  var env = newEnv();
  var pm = env.newManager();

  env.mockFs.failWrites("EACCES: permission denied, open 'Meu_Preset.json'");
  pm.savePreset({ presetName: "Preset Travado", tree: sampleTree() });

  assert.ok(pm.lastSaveError, "lastSaveError deve ser preenchido para a UI reportar");

  var map = userPresetsMap(env);
  assert.notOk(
    Object.prototype.hasOwnProperty.call(map, "Preset Travado"),
    "o preset NÃO pode ser espelhado em localStorage quando o disco falhou"
  );

  assert.eq(
    pm.getActivePresetName(),
    "Default Clean",
    "o preset ativo não pode mudar quando a gravação falhou"
  );

  var names = pm.listPresets().map(function (p) { return p.presetName; }).join("|");
  assert.notIncludes(names, "Preset Travado", "listPresets não pode listar um preset que não existe em disco");

  var reloaded = pm.loadPreset("Preset Travado");
  assert.eq(
    reloaded.presetName,
    "Default Clean",
    "carregar um preset inexistente cai no padrão (comportamento esperado após a correção)"
  );
});

h.test("P0-5: após permitir a escrita, o mesmo preset salva normalmente", function () {
  var env = newEnv();
  var pm = env.newManager();

  env.mockFs.failWrites("EACCES: permission denied");
  pm.savePreset({ presetName: "Preset Recuperado", tree: sampleTree() });
  assert.ok(pm.lastSaveError, "primeira tentativa deve falhar");

  env.mockFs.allowWrites();
  pm.savePreset({ presetName: "Preset Recuperado", tree: sampleTree() });

  assert.eq(pm.lastSaveError, null, "erro deve ser limpo após gravar com sucesso");
  assert.eq(pm.getActivePresetName(), "Preset Recuperado");
  assert.includes(
    pm.listPresets().map(function (p) { return p.presetName; }).join("|"),
    "Preset Recuperado"
  );
});

h.test("P0-4: overrides de settings do preset padrão incluem groupBySourceFolder e unusedFolderName", function () {
  var env = newEnv();
  var pm = env.newManager();

  var def = pm.getDefaultPresetFromBundle();
  def.settings.usePrefixNumbering = false;
  def.settings.groupBySourceFolder = false;
  def.settings.unusedFolderName = "Vazias";
  def.settings.separateAudioCategories = false;
  pm.savePreset(def);

  var pm2 = env.newManager();
  var reloaded = pm2.getDefaultPreset();

  assert.eq(reloaded.settings.usePrefixNumbering, false, "usePrefixNumbering deve persistir");
  assert.eq(reloaded.settings.groupBySourceFolder, false, "groupBySourceFolder deve persistir");
  assert.eq(reloaded.settings.unusedFolderName, "Vazias", "unusedFolderName deve persistir");
  assert.eq(reloaded.settings.separateAudioCategories, false, "separateAudioCategories deve persistir");
});

h.test("P0-4: overrides por pasta do preset padrão (Pasta de Origem) são preservados", function () {
  var env = newEnv();
  var pm = env.newManager();

  var def = pm.getDefaultPresetFromBundle();
  var assetsNode = def.tree[1];
  var imagesNode = assetsNode.children[1];
  var audiosNode = assetsNode.children[3];

  imagesNode.rules.groupBySourceFolder = false;
  audiosNode.rules.groupBySourceFolder = true;
  pm.savePreset(def);

  var pm2 = env.newManager();
  var reloaded = pm2.getDefaultPreset();
  var reloadedImages = reloaded.tree[1].children[1];
  var reloadedAudios = reloaded.tree[1].children[3];

  assert.eq(reloadedImages.name, imagesNode.name, "ordem da árvore preservada");
  assert.eq(reloadedImages.rules.groupBySourceFolder, false, "Images deve manter Pasta de Origem desligada");
  assert.eq(reloadedAudios.rules.groupBySourceFolder, true, "Audios deve manter Pasta de Origem ligada");
});

h.test("P0-4: resetDefaultPreset descarta todos os overrides", function () {
  var env = newEnv();
  var pm = env.newManager();

  var def = pm.getDefaultPresetFromBundle();
  def.settings.groupBySourceFolder = false;
  def.settings.unusedFolderName = "Vazias";
  def.tree[1].children[1].rules.groupBySourceFolder = false;
  pm.savePreset(def);

  var resetted = pm.resetDefaultPreset();
  assert.eq(resetted.settings.groupBySourceFolder, true, "settings volta ao padrão");
  assert.eq(resetted.settings.unusedFolderName, "Nunca Usadas", "nome da pasta de não usadas volta ao padrão");
  assert.eq(
    resetted.tree[1].children[1].rules.groupBySourceFolder,
    true,
    "regra por pasta volta ao padrão de fábrica"
  );
});

h.test("P1: Premiere Pro usa o dicionário de extensões do host quando não há bundle PPro", function () {
  var env = newEnv({ appId: "PPRO" });
  var pm = env.newManager();

  assert.eq(pm.isPremierePro(), true, "host detectado como PPRO");

  var def = pm.getDefaultPreset();
  var imagesNode = def.tree[1].children[1];
  var extensions = imagesNode.rules.extensions.join(",");

  assert.includes(extensions, "jfif", "extensões de imagem do Premiere (jfif) devem ser usadas");
  assert.includes(extensions, "ico", "extensões de imagem do Premiere (ico) devem ser usadas");
});

h.test("deletePreset remove arquivo do disco e do localStorage", function () {
  var env = newEnv();
  var pm = env.newManager();

  pm.savePreset({ presetName: "Descartavel", tree: sampleTree() });
  assert.eq(env.mockFs.listFiles(env.presetsDir).length, 1);

  pm.deletePreset("Descartavel");

  assert.eq(env.mockFs.listFiles(env.presetsDir).length, 0, "arquivo removido do disco");
  assert.notOk(
    Object.prototype.hasOwnProperty.call(userPresetsMap(env), "Descartavel"),
    "entrada removida do localStorage"
  );
});

h.test("preset padrão nunca é gravado como preset de usuário em disco", function () {
  var env = newEnv();
  var pm = env.newManager();

  pm.savePreset(pm.getDefaultPresetFromBundle());

  assert.eq(env.mockFs.listFiles(env.presetsDir).length, 0, "Default Clean não gera arquivo");
  assert.ok(
    env.localStorage.getItem("ae_organizer_default_settings"),
    "overrides do padrão ficam em chave própria"
  );
});

h.test("Modal V2: normalizeNode preserva e higieniza rules.customExtensions", function () {
  var env = newEnv();
  var pm = env.newManager();

  var saved = pm.savePreset({
    presetName: "Custom Formats",
    tree: [
      {
        id: "node_raw",
        name: "RAW e EXR",
        label: 4,
        rules: {
          types: ["StillImages"],
          extensions: ["png", "exr", "webp"],
          customExtensions: [".EXR", " webp ", "exr", ""]
        },
        children: []
      }
    ]
  });

  assert.deepEq(
    saved.tree[0].rules.customExtensions,
    ["exr", "webp"],
    "customExtensions deve ser normalizado (sem ponto, minúsculas, sem duplicatas)"
  );

  var reloaded = pm.loadPreset("Custom Formats");
  assert.deepEq(
    reloaded.tree[0].rules.customExtensions,
    ["exr", "webp"],
    "customExtensions deve sobreviver à gravação e leitura do disco"
  );
});

h.test("P0-6: árvore alterada no preset Default avisa em vez de sumir em silêncio", function () {
  var env = newEnv();
  var pm = env.newManager();

  var def = pm.getDefaultPresetFromBundle();
  def.tree.push({
    id: "node_teste",
    name: "Teste",
    label: 6,
    rules: { types: ["Videos"], extensions: ["mp4"], nameFilter: "Teste" },
    children: []
  });

  pm.savePreset(def);

  assert.ok(pm.lastSaveWarning, "lastSaveWarning deve ser preenchido para a UI reportar");
  assert.includes(pm.lastSaveWarning, "Salvar Novo", "o aviso deve indicar o caminho correto");
  assert.eq(env.mockFs.listFiles(env.presetsDir).length, 0, "nenhum preset de usuário é criado");

  var reloaded = env.newManager().getDefaultPreset();
  assert.eq(reloaded.tree.length, 2, "a árvore do Default continua a de fábrica (2 raízes)");

  var first = pm.consumeSaveWarning();
  assert.ok(first, "consumeSaveWarning devolve o aviso pendente");
  assert.eq(pm.lastSaveWarning, null, "consumeSaveWarning limpa o estado");
  assert.eq(pm.consumeSaveWarning(), null, "o aviso não é repetido");
});

h.test("P0-6: Pasta de Origem no Default continua salvando sem aviso falso", function () {
  var env = newEnv();
  var pm = env.newManager();

  var def = pm.getDefaultPresetFromBundle();
  def.settings.groupBySourceFolder = false;
  def.tree[1].children[1].rules.groupBySourceFolder = false;
  pm.savePreset(def);

  assert.eq(pm.lastSaveWarning, null, "mudança que o Default realmente persiste não deve avisar");

  var reloaded = env.newManager().getDefaultPreset();
  assert.eq(
    reloaded.tree[1].children[1].rules.groupBySourceFolder,
    false,
    "override por pasta continua sendo gravado"
  );
});

h.test("P0-6: salvar um preset de usuário zera o aviso pendente", function () {
  var env = newEnv();
  var pm = env.newManager();

  var def = pm.getDefaultPresetFromBundle();
  def.tree[0].name = "Output Renomeado";
  pm.savePreset(def);
  assert.ok(pm.lastSaveWarning, "primeiro salvamento avisa");

  pm.savePreset({ presetName: "Com Estrutura", tree: sampleTree() });
  assert.eq(pm.lastSaveWarning, null, "salvamento normal não deixa aviso pendente");
});

module.exports = h;
