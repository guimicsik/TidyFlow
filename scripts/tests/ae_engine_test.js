/* ==========================================================================
   TidyFlow — Testes do motor After Effects (host/aeft_organizer.jsx)
   Usa um simulador da API do AE (scripts/tests/lib/ae_mock.js).
   Cobre: organização básica, idempotência, numeração/labels, limpeza de pastas
   vazias e sobrevivência a pasta vinculada removida (P0-3).
   ========================================================================== */
"use strict";

var harnessLib = require("./lib/harness");
var aeMockLib = require("./lib/ae_mock");

var h = harnessLib.createHarness("Engine AEFT");
var test = h.test;
var assert = h.assert;

function newEngine(options) {
  var mock = aeMockLib.createAeMock(options || {});
  mock.evalHostFile("aeft_organizer.jsx");

  var spy = { markCalls: 0, snapshotCalls: 0 };
  var originalMark = mock.global().aeft_markPostOrganizeState;
  var originalEnsure = mock.global().aeft_ensurePreOrganizeSnapshot;
  mock.global().aeft_markPostOrganizeState = function () {
    spy.markCalls++;
    if (typeof originalMark === "function") return originalMark.apply(this, arguments);
  };
  mock.global().aeft_ensurePreOrganizeSnapshot = function () {
    spy.snapshotCalls++;
    if (typeof originalEnsure === "function") return originalEnsure.apply(this, arguments);
  };
  mock.spy = spy;
  return mock;
}

function imagePreset(overrides) {
  overrides = overrides || {};
  return {
    presetName: "Teste",
    settings: {
      usePrefixNumbering: overrides.usePrefixNumbering !== undefined ? overrides.usePrefixNumbering : true,
      deleteEmptyFolders: overrides.deleteEmptyFolders !== undefined ? overrides.deleteEmptyFolders : true,
      saveProjectBefore: false,
      reduceProject: false,
      groupBySourceFolder: overrides.groupBySourceFolder !== undefined ? overrides.groupBySourceFolder : false
    },
    tree: overrides.tree || [
      {
        id: "n_img",
        name: "Images",
        label: 4,
        rules: {
          types: ["StillImages"],
          extensions: ["png"],
          groupSubfoldersByExt: false,
          groupBySourceFolder: false,
          catchOthers: false
        },
        children: []
      }
    ]
  };
}

function runOrganize(mock, preset, mainArg) {
  var raw = mock.organize(mainArg || "media_only", JSON.stringify(preset));
  var parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error("resposta do motor não é JSON válido: " + raw);
  }
  return parsed;
}

h.test("organiza mídia em pasta do preset com numeração e label", function () {
  var mock = newEngine();
  mock.api.addFootage("a.png", "C:/origem/Src/a.png", { isStill: true });

  var res = runOrganize(mock, imagePreset());

  assert.eq(res.success, true, "operação deve concluir com sucesso: " + JSON.stringify(res));
  assert.eq(res.movedFootages, 1, "uma mídia movida");

  var imagesFolder = mock.api.find("01_Images");
  assert.ok(imagesFolder, "pasta numerada 01_Images deve existir");
  assert.eq(imagesFolder.numItems, 1, "a pasta deve conter a mídia");
  assert.eq(imagesFolder.label, 4, "label do nó aplicado na pasta");
  assert.eq(mock.spy.markCalls, 1, "estado pós-organização (rollback) deve ser marcado");
});

h.test("segunda execução é idempotente (sem 01_01_ e sem pasta duplicada)", function () {
  var mock = newEngine();
  mock.api.addFootage("a.png", "C:/origem/Src/a.png", { isStill: true });

  runOrganize(mock, imagePreset());
  var res2 = runOrganize(mock, imagePreset());

  assert.eq(res2.success, true, "segunda execução deve concluir: " + JSON.stringify(res2));
  assert.ok(mock.api.find("01_Images"), "nome numerado preservado");
  assert.notOk(mock.api.find("01_01_Images"), "prefixo não pode acumular");
  assert.eq(mock.api.countFolders(), 2, "root + 01_Images (nenhuma pasta extra)");
  assert.eq(mock.api.find("01_Images").numItems, 1, "mídia continua dentro da pasta");
});

h.test("categorias vazias não geram pastas (Regra A3)", function () {
  var mock = newEngine();
  mock.api.addFootage("a.png", "C:/origem/Src/a.png", { isStill: true });

  var preset = imagePreset({
    tree: [
      { id: "n_out", name: "Output", label: 9, rules: { types: ["MainComp"], extensions: [] }, children: [] },
      { id: "n_img", name: "Images", label: 4, rules: { types: ["StillImages"], extensions: ["png"], groupBySourceFolder: false }, children: [] },
      { id: "n_aud", name: "Audios", label: 7, rules: { types: ["Audios"], extensions: ["wav"], groupBySourceFolder: false }, children: [] }
    ]
  });

  var res = runOrganize(mock, preset);

  assert.eq(res.success, true, JSON.stringify(res));
  assert.notOk(mock.api.find("Output"), "Output vazio não deve ser criado");
  assert.notOk(mock.api.find("Audios"), "Audios vazio não deve ser criado");
  assert.notOk(mock.api.find("02_Images"), "categorias vazias não devem pular a sequência para 02_");
  assert.ok(mock.api.find("01_Images"), "apenas a pasta com itens é criada, numerada continuamente a partir de 01_");
});

h.test("useNumbering=false mantém a pasta fora da numeração sequencial", function () {
  var mock = newEngine();
  mock.api.addFootage("a.png", "C:/origem/Src/a.png", { isStill: true });

  var preset = imagePreset({
    tree: [
      { id: "n_img", name: "Images", label: 4, useNumbering: false, rules: { types: ["StillImages"], extensions: ["png"], groupBySourceFolder: false }, children: [] }
    ]
  });

  var res = runOrganize(mock, preset);

  assert.eq(res.success, true, JSON.stringify(res));
  assert.ok(mock.api.find("Images"), "pasta sem prefixo");
  assert.notOk(mock.api.find("01_Images"), "nada de prefixo quando useNumbering=false");
});

h.test("P0-3: pasta vinculada removida na limpeza não aborta a operação", function () {
  var mock = newEngine({ silentMoveFail: { Images: true } });
  mock.api.addFootage("a.png", "C:/origem/Src/a.png", { isStill: true });

  var res = runOrganize(mock, imagePreset());

  assert.eq(
    res.success,
    true,
    "o motor não pode falhar depois de já ter mutado o projeto: " + JSON.stringify(res)
  );
  assert.ok(res.cleanedFolders >= 1, "a pasta ficou vazia e foi limpa");
  assert.eq(mock.spy.markCalls, 1, "estado pós-organização deve ser marcado mesmo com limpeza");
});

h.test("limpeza remove todas as pastas vazias pré-existentes", function () {
  var mock = newEngine();
  for (var i = 0; i < 60; i++) {
    mock.api.addFolder("Vazia_" + i);
  }
  mock.api.addFootage("a.png", "C:/origem/Src/a.png", { isStill: true });

  var res = runOrganize(mock, imagePreset());

  assert.eq(res.success, true, JSON.stringify(res));
  assert.eq(res.cleanedFolders, 60, "todas as 60 pastas vazias devem ser removidas");
  assert.eq(mock.api.countFolders(), 2, "sobram root + 01_Images");
});

h.test("pasta protegida 'Nunca Usadas' não é removida nem tem conteúdo movido", function () {
  var mock = newEngine();
  var unused = mock.api.addFolder("Nunca Usadas");
  var comp = mock.api.addComp("Comp Vazia", unused);

  var res = runOrganize(mock, imagePreset());

  assert.eq(res.success, true, JSON.stringify(res));
  assert.ok(mock.api.find("Nunca Usadas"), "pasta protegida permanece");
  assert.eq(comp.parentFolder.name, "Nunca Usadas", "conteúdo protegido não foi movido");
});

h.test("modo seleção move a composição principal para Output", function () {
  var mock = newEngine();
  var comp = mock.api.addComp("Meu Filme");

  var preset = imagePreset({
    tree: [
      { id: "n_out", name: "Output", label: 9, rules: { types: ["MainComp"], extensions: [] }, children: [] }
    ]
  });
  mock.api.select([comp]);

  var res = runOrganize(mock, preset, "selection");

  assert.eq(res.success, true, JSON.stringify(res));
  assert.eq(res.movedComps, 1, "uma composição movida");
  var output = mock.api.find("01_Output");
  assert.ok(output, "pasta Output criada e numerada");
  assert.eq(comp.parentFolder.name, "01_Output", "comp dentro de Output");
});

h.test("pré-composições são movidas para PreComps agrupadas pela comp principal", function () {
  var mock = newEngine();
  var main = mock.api.addComp("Filme");
  var pre = mock.api.addComp("Pre");
  mock.api.addLayer(main, pre);

  var preset = imagePreset({
    tree: [
      { id: "n_out", name: "Output", label: 9, rules: { types: ["MainComp"], extensions: [] }, children: [] },
      { id: "n_pre", name: "PreComps", label: 5, rules: { types: ["PreComps"], extensions: [], groupByMainComp: true }, children: [] }
    ]
  });
  mock.api.select([main]);

  var res = runOrganize(mock, preset, "selection");

  assert.eq(res.success, true, JSON.stringify(res));
  assert.eq(res.movedComps, 2, "main comp + pré-comp movidas");
  var precomps = mock.api.find("02_PreComps");
  assert.ok(precomps, "pasta PreComps numerada em segundo");
  assert.ok(mock.api.find("Filme", precomps), "subpasta com o nome da comp principal");
  assert.eq(pre.parentFolder.name, "Filme", "pré-comp dentro da subpasta da main");
});

h.test("resposta inclui métricas de profiling (elapsedMs/scanCount)", function () {
  var mock = newEngine();
  mock.api.addFootage("a.png", "C:/origem/Src/a.png", { isStill: true });

  var res = runOrganize(mock, imagePreset());

  assert.eq(typeof res.elapsedMs, "number", "elapsedMs numérico");
  assert.eq(typeof res.scanCount, "number", "scanCount numérico");
  assert.ok(res.scanCount > 0, "houve varredura do projeto");
});

h.test("filtro por nomenclatura direciona itens com tag no arquivo ou pasta de origem com prioridade sobre pasta genérica", function () {
  var mock = newEngine();
  var aiVideo = mock.api.addFootage("v01.mp4", "C:/Projects/SH010/v01.mp4", { isStill: false });
  var regularVideo = mock.api.addFootage("normal.mp4", "C:/Projects/Generic/normal.mp4", { isStill: false });

  var preset = {
    presetName: "Teste Nomenclatura",
    settings: {
      usePrefixNumbering: true,
      deleteEmptyFolders: true,
      saveProjectBefore: false,
      reduceProject: false,
      groupBySourceFolder: true
    },
    tree: [
      {
        id: "n_ai",
        name: "AI",
        label: 6,
        rules: {
          types: ["Videos"],
          extensions: ["mp4"],
          nameFilter: "SH0",
          nameFilterMode: "contains",
          groupSubfoldersByExt: false,
          groupBySourceFolder: true
        },
        children: []
      },
      {
        id: "n_footages",
        name: "Footages",
        label: 6,
        rules: {
          types: ["Videos"],
          extensions: ["mp4"],
          nameFilter: "",
          groupSubfoldersByExt: false,
          groupBySourceFolder: true
        },
        children: []
      }
    ]
  };

  var res = runOrganize(mock, preset);

  assert.eq(res.success, true, JSON.stringify(res));
  assert.eq(res.movedFootages, 2, "dois vídeos movidos");

  var aiFolder = mock.api.find("01_AI");
  assert.ok(aiFolder, "pasta 01_AI criada");
  var aiSubFolder = mock.api.find("SH010", aiFolder);
  assert.ok(aiSubFolder, "subpasta SH010 criada dentro de AI");
  assert.eq(aiVideo.parentFolder.name, "SH010", "vídeo SH010 foi para dentro de 01_AI/SH010");

  var footagesFolder = mock.api.find("02_Footages");
  assert.ok(footagesFolder, "pasta 02_Footages criada");
  var genericSubFolder = mock.api.find("Generic", footagesFolder);
  assert.ok(genericSubFolder, "subpasta Generic criada dentro de Footages");
  assert.eq(regularVideo.parentFolder.name, "Generic", "vídeo regular foi para 02_Footages/Generic");
});

h.test("filtro por nomenclatura vence a pasta genérica mesmo com lista de extensões defasada", function () {
  var mock = newEngine();
  var tagged = mock.api.addFootage("sem-titulo.mp4", "C:/Projetos/Teste/sem-titulo.mp4", { isStill: false });

  var preset = {
    presetName: "Teste Nomenclatura Defasada",
    settings: {
      usePrefixNumbering: true,
      deleteEmptyFolders: true,
      saveProjectBefore: false,
      reduceProject: false,
      groupBySourceFolder: false
    },
    tree: [
      {
        id: "n_teste",
        name: "Teste",
        label: 6,
        rules: {
          types: ["Videos"],
          // Lista defasada de propósito: não contém "mp4".
          extensions: ["mov"],
          nameFilter: "sem-titulo",
          nameFilterMode: "contains",
          groupSubfoldersByExt: false,
          groupBySourceFolder: false
        },
        children: []
      },
      {
        id: "n_footages",
        name: "Footages",
        label: 6,
        rules: {
          types: ["Videos"],
          extensions: ["mp4"],
          catchOthers: true,
          groupSubfoldersByExt: false,
          groupBySourceFolder: false
        },
        children: []
      }
    ]
  };

  var res = runOrganize(mock, preset);

  assert.eq(res.success, true, JSON.stringify(res));
  assert.eq(res.movedFootages, 1, "um vídeo movido");
  assert.ok(mock.api.find("01_Teste"), "pasta 01_Teste criada");
  assert.eq(tagged.parentFolder.name, "01_Teste", "vídeo com a tag deve ir para Teste, não para Footages");
  assert.notOk(mock.api.find("02_Footages"), "Footages não deve ser criada quando o filtro por nome casa");
});

h.test("sourceFolderMode: 'project' agrupa apenas pastas manuais do projeto ('Arquivos Novos') e ignora pasta do disco para arquivos soltos", function () {
  var mock = newEngine();
  var userFolder = mock.api.addFolder("Arquivos Novos");
  var imgInFolder = mock.api.addFootage("foto.png", "C:/Downloads/foto.png", { isStill: true }, userFolder);
  var vidInFolder = mock.api.addFootage("take.mp4", "C:/Downloads/take.mp4", { isStill: false }, userFolder);
  var looseImg = mock.api.addFootage("solta.png", "C:/Downloads/solta.png", { isStill: true });

  var preset = {
    presetName: "Teste Project Mode",
    settings: {
      usePrefixNumbering: true,
      deleteEmptyFolders: true,
      saveProjectBefore: false,
      reduceProject: false,
      groupBySourceFolder: true,
      sourceFolderMode: "project"
    },
    tree: [
      {
        id: "n_img",
        name: "Images",
        label: 4,
        rules: {
          types: ["StillImages"],
          extensions: ["png"],
          groupSubfoldersByExt: true,
          groupBySourceFolder: true,
          sourceFolderMode: "project"
        },
        children: []
      },
      {
        id: "n_vid",
        name: "Footages",
        label: 6,
        rules: {
          types: ["Videos"],
          extensions: ["mp4"],
          groupSubfoldersByExt: true,
          groupBySourceFolder: true,
          sourceFolderMode: "project"
        },
        children: []
      }
    ]
  };

  var res1 = runOrganize(mock, preset);
  assert.eq(res1.success, true, JSON.stringify(res1));
  assert.eq(imgInFolder.parentFolder.name, "Arquivos Novos", "imagem da pasta manual ganha subpasta 'Arquivos Novos'");
  assert.eq(imgInFolder.parentFolder.parentFolder.name, "PNG", "subpasta 'Arquivos Novos' fica dentro de PNG");
  assert.eq(vidInFolder.parentFolder.name, "Arquivos Novos", "vídeo da pasta manual ganha subpasta 'Arquivos Novos' em Footages/MP4");
  assert.eq(vidInFolder.parentFolder.parentFolder.name, "MP4", "subpasta 'Arquivos Novos' fica dentro de MP4");
  assert.eq(looseImg.parentFolder.name, "PNG", "imagem solta na raiz vai direto para PNG sem criar subpasta 'Downloads'");

  // Segunda execução deve ser 100% idempotente
  var res2 = runOrganize(mock, preset);
  assert.eq(res2.success, true, JSON.stringify(res2));
  assert.eq(imgInFolder.parentFolder.name, "Arquivos Novos", "idempotência: mantém 'Arquivos Novos' na 2ª execução");
  assert.eq(imgInFolder.parentFolder.parentFolder.name, "PNG", "idempotência: não duplica PNG/PNG");
  assert.eq(looseImg.parentFolder.name, "PNG", "idempotência: imagem solta continua direto em PNG");
});

h.test("sourceFolderMode: 'both' prioriza pasta manual do projeto e usa pasta do disco como fallback; 'disk' usa sempre a do disco", function () {
  var mock = newEngine();
  var userFolder = mock.api.addFolder("Arquivos Novos");
  var imgInFolder = mock.api.addFootage("foto.png", "C:/Downloads/foto.png", { isStill: true }, userFolder);
  var looseImg = mock.api.addFootage("solta.png", "C:/Downloads/solta.png", { isStill: true });
  var vidInFolder = mock.api.addFootage("take.mp4", "C:/Capturas/take.mp4", { isStill: false }, userFolder);

  var preset = {
    presetName: "Teste Both vs Disk",
    settings: {
      usePrefixNumbering: true,
      deleteEmptyFolders: true,
      saveProjectBefore: false,
      reduceProject: false,
      groupBySourceFolder: true,
      sourceFolderMode: "both"
    },
    tree: [
      {
        id: "n_img",
        name: "Images",
        label: 4,
        rules: {
          types: ["StillImages"],
          extensions: ["png"],
          groupSubfoldersByExt: true,
          groupBySourceFolder: true,
          sourceFolderMode: "both"
        },
        children: []
      },
      {
        id: "n_vid",
        name: "Footages",
        label: 6,
        rules: {
          types: ["Videos"],
          extensions: ["mp4"],
          groupSubfoldersByExt: true,
          groupBySourceFolder: true,
          sourceFolderMode: "disk"
        },
        children: []
      }
    ]
  };

  var res = runOrganize(mock, preset);
  assert.eq(res.success, true, JSON.stringify(res));
  assert.eq(imgInFolder.parentFolder.name, "Arquivos Novos", "modo 'both': item na pasta manual usa 'Arquivos Novos'");
  assert.eq(looseImg.parentFolder.name, "Downloads", "modo 'both': item solto na raiz usa pasta do disco 'Downloads'");
  assert.eq(vidInFolder.parentFolder.name, "Capturas", "modo 'disk': ignora 'Arquivos Novos' e usa a pasta do disco 'Capturas'");
});

h.test("sourceFolderMode 'project': preserva comps dentro de subpasta 'Cameras' em Output e agrupa camada PSD avulsa pelo arquivo .psd", function () {
  var mock = newEngine();
  var outFolder = mock.api.addFolder("01_Output");
  var camerasFolder = mock.api.addFolder("Cameras", outFolder);
  var mainComp = mock.api.addComp("11988_Valorant_Achille_SH110_Motion", outFolder);
  var cam1 = mock.api.addComp("11988_Valorant_Achille_SH045_Camera_01", camerasFolder);
  var cam2 = mock.api.addComp("11988_Valorant_Achille_SH045_Camera_02", camerasFolder);
  var psdLayer = mock.api.addFootage(
    "Background/Valorant_Nightfall_Concept_UI_Motion.psd",
    "C:/Downloads/Valorant_Nightfall_Concept_UI_Motion.psd",
    { isStill: true }
  );

  var preset = {
    presetName: "Custom Clean",
    settings: {
      usePrefixNumbering: true,
      deleteEmptyFolders: true,
      saveProjectBefore: false,
      reduceProject: false,
      groupBySourceFolder: true,
      sourceFolderMode: "project"
    },
    tree: [
      {
        id: "node_output",
        name: "Output",
        label: 9,
        rules: { types: ["MainComp"], extensions: [], groupBySourceFolder: true, sourceFolderMode: "project" },
        children: []
      },
      {
        id: "node_assets",
        name: "Assets",
        label: 0,
        rules: { types: [], extensions: [] },
        children: [
          {
            id: "node_precomps",
            name: "PreComps",
            label: 5,
            rules: { types: ["PreComps"], extensions: [], groupByMainComp: true, groupBySourceFolder: true, sourceFolderMode: "project" },
            children: []
          },
          {
            id: "node_images",
            name: "Images",
            label: 4,
            rules: {
              types: ["StillImages"],
              extensions: ["psd", "png"],
              handlePsdBundles: true,
              groupSubfoldersByExt: true,
              groupBySourceFolder: true,
              sourceFolderMode: "project"
            },
            children: []
          }
        ]
      }
    ]
  };

  // Mesmo selecionando apenas mainComp (ou todas), cam1 e cam2 devem permanecer dentro de 01_Output/Cameras
  mock.api.select([mainComp, cam1, cam2]);
  var res = runOrganize(mock, preset, "selection");
  assert.eq(res.success, true, JSON.stringify(res));
  assert.eq(mainComp.parentFolder.name, "01_Output", "comp principal fica na raiz de 01_Output");
  assert.eq(cam1.parentFolder.name, "Cameras", "Camera_01 permanece dentro da pasta Cameras");
  assert.eq(cam1.parentFolder.parentFolder.name, "01_Output", "pasta Cameras permanece dentro de 01_Output");
  assert.eq(cam2.parentFolder.name, "Cameras", "Camera_02 permanece dentro da pasta Cameras");
  assert.eq(
    psdLayer.parentFolder.name,
    "Valorant_Nightfall_Concept_UI_Motion.psd",
    "camada PSD avulsa entra na pasta do documento .psd em vez de ficar solta em PSD/"
  );
  assert.eq(psdLayer.parentFolder.parentFolder.name, "PSD", "pasta do documento .psd fica dentro de PSD/");
});

module.exports = h;
