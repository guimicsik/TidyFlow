/* ==========================================================================
   TidyFlow — Testes do Collect Files (COLLECT_FILES_SPEC.md)
   - CollectEngine.js: regras de nome (§5), sequências, estimativa (§2)
   - host/aeft_collect.jsx: scan sobre o simulador do AE (lib/ae_mock.js)
   - janela com.tidyflow.collect: manifest, IDs de DOM e botão de teste
   ========================================================================== */
"use strict";

var nodeFs = require("fs");
var nodePath = require("path");
var nodeZlib = require("zlib");
var harnessLib = require("./lib/harness");
var aeMockLib = require("./lib/ae_mock");
var pproMockLib = require("./lib/ppro_mock");

var REPO_ROOT = nodePath.resolve(__dirname, "..", "..");
var CollectEngine = require(nodePath.join(REPO_ROOT, "client", "CollectEngine.js"));

var h = harnessLib.createHarness("Collect Files");
var test = h.test;
var assert = h.assert;

function read(relPath) {
  return nodeFs.readFileSync(nodePath.join(REPO_ROOT, relPath), "utf8");
}

/* ---------- CollectEngine: regras de nome (§5) ---------- */

test("§5.2: cada caractere inválido vira '-' sem agrupar", function () {
  assert.eq(CollectEngine.sanitizeSegment("//Footages//"), "--Footages--");
  assert.eq(CollectEngine.sanitizeSegment('a:b*c?d"e<f>g|h\\i'), "a-b-c-d-e-f-g-h-i");
  assert.eq(CollectEngine.sanitizeSegment("02_Assets"), "02_Assets");
});

test("§5.2: ponto/espaço no fim e nomes reservados do Windows", function () {
  assert.eq(CollectEngine.sanitizeSegment("Pasta.."), "Pasta--");
  assert.eq(CollectEngine.sanitizeSegment("Pasta "), "Pasta-");
  assert.eq(CollectEngine.sanitizeSegment("CON"), "CON-");
  assert.eq(CollectEngine.sanitizeSegment("com1"), "com1-");
  assert.eq(CollectEngine.sanitizeSegment(""), "-");
});

test("nome padrão da pasta do collect é [projeto]_Collect", function () {
  assert.eq(CollectEngine.defaultCollectFolderName("11982_LF_Michelob_Ultra_Motion.aep"), "11982_LF_Michelob_Ultra_Motion_Collect");
  assert.eq(CollectEngine.defaultCollectFolderName("Meu Projeto.aepx"), "Meu Projeto_Collect");
  assert.eq(CollectEngine.defaultCollectFolderName(""), "Projeto_Collect");
});

test("§5.5: nome da subpasta da sequência (sem numeração)", function () {
  assert.eq(CollectEngine.sequenceFolderName("C:\\seq\\render_pass_diffuse_0001.png"), "render_pass_diffuse");
  assert.eq(CollectEngine.sequenceFolderName("C:\\seq\\CGI_SceneA.0045.exr"), "CGI_SceneA");
  assert.eq(CollectEngine.sequenceFolderName("C:\\seq\\Shot_01_v02_1001.dpx"), "Shot_01_v02");
  assert.eq(CollectEngine.sequenceFolderName("C:\\renders\\Comp 1\\0001.png"), "Comp 1");
});

test("frames da sequência: mesmo nome-base e extensão, sem diferenciar maiúsculas", function () {
  var names = ["Bola_00000.png", "Bola_00001.PNG", "Bola_00002.png", "Bola_00000.exr", "Outra_00000.png", "Bola.txt"];
  var frames = CollectEngine.framesFromListing("C:\\seq\\Bola_00000.png", names);
  assert.deepEq(frames, ["C:\\seq\\Bola_00000.png", "C:\\seq\\Bola_00001.PNG", "C:\\seq\\Bola_00002.png"]);
});

test("formatBytes usa base 1024 e vírgula decimal", function () {
  assert.eq(CollectEngine.formatBytes(0), "0 B");
  assert.eq(CollectEngine.formatBytes(1536), "1,5 KB");
  assert.eq(CollectEngine.formatBytes(8.5 * 1024 * 1024 * 1024), "8,5 GB");
});

test("formatTimeRemaining formata segundos, minutos e horas", function () {
  assert.eq(CollectEngine.formatTimeRemaining(0), "menos de 1 segundo");
  assert.eq(CollectEngine.formatTimeRemaining(1), "1 segundo");
  assert.eq(CollectEngine.formatTimeRemaining(28), "28 segundos");
  assert.eq(CollectEngine.formatTimeRemaining(60), "1 minuto");
  assert.eq(CollectEngine.formatTimeRemaining(75), "1 min e 15 s");
  assert.eq(CollectEngine.formatTimeRemaining(3665), "1 h e 1 min");
  assert.eq(CollectEngine.formatTimeRemaining(NaN), "calculando...");
  assert.eq(CollectEngine.formatTimeRemaining(-5), "calculando...");
});

/* ---------- CollectEngine: estimativa (§2) ---------- */

var SCAN = {
  items: [
    { id: 1, path: "C:\\v\\a.mp4", isSequence: false, missing: false, proxyPath: "C:\\v\\a.avi", proxyIsSequence: false },
    { id: 2, path: "C:\\v\\b.psb", isSequence: false, missing: false, proxyPath: "" },
    { id: 3, path: "C:\\v\\b.psb", isSequence: false, missing: false, proxyPath: "" }, // camada do mesmo PSB
    { id: 4, path: "C:\\seq\\Bola_00000.png", isSequence: true, missing: false, proxyPath: "" },
    { id: 5, path: "C:\\x\\sumiu.mov", isSequence: false, missing: true, proxyPath: "" }
  ]
};

test("planSources: deduplica camadas do mesmo arquivo e ignora offline", function () {
  var plan = CollectEngine.planSources(SCAN, { obeyProxy: false });
  var paths = plan.sources.map(function (s) { return s.path; });
  assert.deepEq(paths, ["C:\\v\\a.mp4", "C:\\v\\a.avi", "C:\\v\\b.psb", "C:\\seq\\Bola_00000.png"]);
  assert.eq(plan.offlineItems, 1);
  assert.eq(plan.proxyCount, 1);
  assert.eq(plan.sequenceCount, 1);
});

test("§6.4: Obedecer proxy coleta só o proxy dos itens que têm proxy", function () {
  var plan = CollectEngine.planSources(SCAN, { obeyProxy: true });
  var paths = plan.sources.map(function (s) { return s.path; });
  assert.notIncludes(paths.join("|"), "a.mp4", "original com proxy não deve entrar");
  assert.includes(paths.join("|"), "a.avi", "proxy deve entrar");
  assert.includes(paths.join("|"), "b.psb", "item sem proxy continua entrando");
});

test("summarize: soma tamanhos e separa arquivos ausentes no disco", function () {
  var plan = CollectEngine.planSources(SCAN, {});
  var files = CollectEngine.uniqueFiles([["C:\\v\\a.mp4"], ["C:\\v\\A.MP4", "C:\\v\\b.psb"], ["C:\\v\\nao.png"]]);
  assert.eq(files.length, 3, "duplicado com caixa diferente deve sair");
  var res = CollectEngine.summarize(plan, files, [{ size: 100, isFile: true }, { size: 50, isFile: true }, null]);
  assert.eq(res.fileCount, 2);
  assert.eq(res.totalBytes, 150);
  assert.deepEq(res.missingFiles, ["C:\\v\\nao.png"]);
  assert.eq(res.offlineItems, 1);
});

test("createEstimator: cancel() aborta estimativa e suporta reinício limpo", function () {
  var estimator = CollectEngine.createEstimator({
    stat: function () { return Promise.resolve({ size: 10, isFile: true }); },
    readdir: function () { return Promise.resolve([]); }
  });
  assert.ok(typeof estimator.cancel === "function", "deve expor cancel");
  estimator.cancel();
  assert.doesNotThrow(function () { estimator.cancel(); });
});

test("rewriteAepxXml: reescreve caminhos em <Pin> e mantém <LOm> do Render Queue intacto", function () {
  var sampleXml = [
    '<Pin><Als2><fileReference fullpath="C:\\orig\\cam_a.mp4" ascendcount_base="2" target_is_folder="0"/></Als2></Pin>',
    '<Pin><Als2><fileReference fullpath="C:\\orig\\seq" target_is_folder="1"/></Als2></Pin>',
    '<LOm><Als2><fileReference fullpath="C:\\saida\\render.mov" target_is_folder="0"/></Als2></LOm>'
  ].join("\n");

  var fMap = { "c:\\orig\\cam_a.mp4": "D:\\dest\\cam_a.mp4" };
  var dMap = { "c:\\orig\\seq": "D:\\dest\\seq" };
  var stats = [];
  var out = CollectEngine.rewriteAepxXml(sampleXml, fMap, dMap, stats);

  assert.includes(out, 'fullpath="D:\\dest\\cam_a.mp4"');
  assert.notIncludes(out, 'ascendcount_base');
  assert.includes(out, 'fullpath="D:\\dest\\seq"');
  assert.includes(out, 'fullpath="C:\\saida\\render.mov"', "Render Queue deve permanecer intacto");
  assert.eq(stats.length, 3);
});

test("buildCollectPlan: planeja cópias e mapeia pastas espelhadas", function () {
  var scanData = {
    items: [
      { id: 10, name: "video.mp4", path: "C:\\src\\video.mp4", isSequence: false, missing: false, folders: ["02_Assets", "//Footages//"], proxyPath: "" },
      { id: 11, name: "duplicado.mp4", path: "C:\\outro\\video.mp4", isSequence: false, missing: false, folders: ["02_Assets", "//Footages//"], proxyPath: "" }
    ]
  };
  var plan = CollectEngine.buildCollectPlan(scanData, {}, "D:\\Collect\\(Footage)");
  assert.eq(plan.fileCopies.length, 2);
  assert.includes(plan.fileCopies[0].dest, "--Footages--");
  assert.includes(plan.fileCopies[1].dest, "video_1.mp4", "arquivo diferente com mesmo nome ganha sufixo _1");
});

test("buildReportText: gera todas as seções obrigatórias da especificação", function () {
  var report = CollectEngine.buildReportText({
    projectPath: "C:\\proj\\teste.aep",
    destPath: "D:\\dest",
    modeLabel: "Tudo",
    collectedCount: 5,
    totalBytes: 1024 * 1024 * 100,
    offlineCount: 0,
    proxyCount: 1,
    effects: [{ name: "Glow", matchName: "ADBE Glow" }],
    files: ["(Footage)/01_Video/a.mp4"]
  });
  assert.includes(report, "TIDYFLOW - RELATÓRIO DE COLLECT DE PROJETO");
  assert.includes(report, "1. RESUMO GERAL");
  assert.includes(report, "2. FONTES TIPOGRÁFICAS");
  assert.includes(report, "3. EFEITOS E PLUGINS");
  assert.includes(report, "4. INVENTÁRIO DE ARQUIVOS");
});

/* ---------- host/aeft_collect.jsx sobre o simulador ---------- */

function newScanMock() {
  var mock = aeMockLib.createAeMock({});
  mock.global().File.decode = decodeURIComponent;
  mock.evalHostFile("_lib.jsx");
  mock.evalHostFile("aeft_collect.jsx");
  var api = mock.api;

  var assets = api.addFolder("02_Assets");
  var footages = api.addFolder("//Footages//", assets);
  var video = api.addFootage("a.mp4", "C:/v/a.mp4", { isStill: false }, footages);
  var image = api.addFootage("b.png", "C:/v/b.png", { isStill: true }, assets);
  var seq = api.addFootage("Bola_[00000-00200].png", "C:/seq/Bola_00000.png", { isStill: false }, assets);
  var unused = api.addFootage("solto.wav", "C:/v/solto.wav", {}, assets);
  api.addSolid("Solid");

  var main = api.addComp("Main");
  var pre = api.addComp("Pre");
  var other = api.addComp("Other");
  api.addLayer(main, pre);
  api.addLayer(pre, video);
  api.addLayer(main, seq);
  api.addLayer(other, image);

  return { mock: mock, main: main, other: other, unused: unused };
}

function scan(mock, mode) {
  var raw = mock.global().aeft_collectScan(JSON.stringify({ mode: mode }));
  return JSON.parse(raw);
}

function names(result) {
  return result.items.map(function (i) { return i.name; }).sort();
}

test("scan 'Tudo': todos os footages com arquivo (inclui não usados, exclui sólidos)", function () {
  var env = newScanMock();
  var res = scan(env.mock, "all");
  assert.ok(res.success, res.error);
  assert.deepEq(names(res), ["Bola_[00000-00200].png", "a.mp4", "b.png", "solto.wav"]);
});

test("scan 'Todas as comps': só footages usados em alguma comp", function () {
  var env = newScanMock();
  var res = scan(env.mock, "allComps");
  assert.deepEq(names(res), ["Bola_[00000-00200].png", "a.mp4", "b.png"]);
});

test("scan 'Selecionadas': recursão em pré-comps a partir da seleção", function () {
  var env = newScanMock();
  env.mock.api.select([env.main]);
  var res = scan(env.mock, "selected");
  assert.eq(res.selectedCompCount, 1);
  assert.deepEq(names(res), ["Bola_[00000-00200].png", "a.mp4"]);
  assert.ok(Array.isArray(res.allComps), "allComps deve ser um array");
  assert.eq(res.allComps.length, 3, "Main, Pre e Other devem ser listadas em allComps");
  assert.ok(Array.isArray(res.allComps[0].folders), "allComps deve conter o array folders");
  assert.ok(Array.isArray(res.allComps[0].folderLabels), "allComps deve conter o array folderLabels");
});

test("scan 'Selecionadas' sem seleção não devolve itens", function () {
  var env = newScanMock();
  var res = scan(env.mock, "selected");
  assert.eq(res.selectedCompCount, 0);
  assert.eq(res.items.length, 0);
});

test("scan 'Nenhum': nenhum footage, projeto continua identificado", function () {
  var env = newScanMock();
  var res = scan(env.mock, "none");
  assert.ok(res.success);
  assert.eq(res.items.length, 0);
  assert.ok(res.projectSaved);
  assert.eq(res.projectName, "teste.aep");
});

test("scan: cadeia de pastas do painel Project e detecção de sequência", function () {
  var env = newScanMock();
  var res = scan(env.mock, "all");
  var byName = {};
  res.items.forEach(function (i) { byName[i.name] = i; });
  assert.deepEq(byName["a.mp4"].folders, ["02_Assets", "//Footages//"], "nomes crus; sanitização fica no CollectEngine");
  assert.ok(byName["Bola_[00000-00200].png"].isSequence, "PNG não-still é sequência");
  assert.notOk(byName["a.mp4"].isSequence, "vídeo não é sequência");
  assert.notOk(byName["b.png"].isSequence, "PNG still não é sequência");
});

/* ---------- Janela, manifest e painel ---------- */

test("manifest registra com.tidyflow.collect apontando para collect.html", function () {
  var xml = read("CSXS/manifest.xml");
  assert.includes(xml, '<Extension Id="com.tidyflow.collect" Version="1.0.0" />');
  assert.includes(xml, "<MainPath>./client/collect.html</MainPath>");
  assert.includes(read(".debug"), 'Extension Id="com.tidyflow.collect"');
});

test("collect.js só usa IDs presentes em collect.html", function () {
  var html = read("client/collect.html");
  var js = read("client/collect.js");
  var re = /getElementById\(\s*["']([^"']+)["']\s*\)/g;
  var missing = [];
  var m;
  while ((m = re.exec(js)) !== null) {
    if (html.indexOf('id="' + m[1] + '"') === -1) missing.push(m[1]);
  }
  assert.deepEq(missing, [], "IDs ausentes em collect.html");
});

test("painel tem o botão de teste que abre a janela de Collect", function () {
  assert.includes(read("client/index.html"), 'id="btnOpenCollect"');
  assert.includes(read("client/main.js"), 'requestOpenExtension("com.tidyflow.collect"');
});

test("roteador expõe collectScan e carrega aeft_collect.jsx e ppro_collect.jsx", function () {
  var router = read("host/organizer.jsx");
  assert.includes(router, "$.global.collectScan = function");
  assert.includes(router, "aeft_collect.jsx");
  assert.includes(router, "ppro_collect.jsx");
});

/* ---------- Premiere Pro: rewritePrprojXml + gzip e ppro_collectScan ---------- */

test("rewritePrprojXml: atualiza FilePath, ActualMediaFilePath e RelativePath em <Media> (gzip roundtrip)", function () {
  var prprojXml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<PremiereData Version="3">',
    '  <ProjectSettings>',
    '    <VideoPreviewLocations>C:\\Scratch\\Previews</VideoPreviewLocations>',
    '  </ProjectSettings>',
    '  <Media ObjectUID="m1">',
    '    <ActualMediaFilePath>C:\\Orig\\A &amp; B\\cam_a.mp4</ActualMediaFilePath>',
    '    <FilePath>C:\\Orig\\A &amp; B\\cam_a.mp4</FilePath>',
    '    <RelativePath>..\\..\\Orig\\A &amp; B\\cam_a.mp4</RelativePath>',
    '  </Media>',
    '  <Media ObjectUID="m1_proxy">',
    '    <ActualMediaFilePath>C:\\Orig\\Proxies\\cam_a_Proxy.mp4</ActualMediaFilePath>',
    '    <FilePath>C:\\Orig\\Proxies\\cam_a_Proxy.mp4</FilePath>',
    '    <RelativePath>.\\Proxies\\cam_a_Proxy.mp4</RelativePath>',
    '  </Media>',
    '  <ExporterParam>',
    '    <OutputFilePath>C:\\Orig\\A &amp; B\\cam_a.mp4</OutputFilePath>',
    '  </ExporterParam>',
    '</PremiereData>'
  ].join("\n");

  var gz = nodeZlib.gzipSync(Buffer.from(prprojXml, "utf8"));
  var unpacked = nodeZlib.gunzipSync(gz).toString("utf8");

  var fMap = {
    "c:/orig/a & b/cam_a.mp4": "D:/Entrega/Proj_Collect/(Footage)/02_Assets/cam_a.mp4",
    "c:\\orig\\proxies\\cam_a_proxy.mp4": "D:/Entrega/Proj_Collect/(Footage)/02_Assets/cam_a_Proxy.mp4"
  };

  var beforeForensics = CollectEngine.inspectPrprojXml(unpacked, fMap);
  assert.eq(beforeForensics.tagCounts.FilePath, 2);
  assert.eq(beforeForensics.tagCounts.ActualMediaFilePath, 2);

  var stats = [];
  var rewritten = CollectEngine.rewritePrprojXml(unpacked, fMap, {}, "D:\\Entrega\\Proj_Collect", stats);
  var regz = nodeZlib.gzipSync(Buffer.from(rewritten, "utf8"));
  var finalXml = nodeZlib.gunzipSync(regz).toString("utf8");

  assert.includes(finalXml, "<FilePath>D:\\Entrega\\Proj_Collect\\(Footage)\\02_Assets\\cam_a.mp4</FilePath>");
  assert.includes(finalXml, "<ActualMediaFilePath>D:\\Entrega\\Proj_Collect\\(Footage)\\02_Assets\\cam_a.mp4</ActualMediaFilePath>");
  assert.includes(finalXml, "<RelativePath>(Footage)\\02_Assets\\cam_a.mp4</RelativePath>");
  assert.includes(finalXml, "<RelativePath>.\\(Footage)\\02_Assets\\cam_a_Proxy.mp4</RelativePath>");
  assert.includes(finalXml, "<VideoPreviewLocations>C:\\Scratch\\Previews</VideoPreviewLocations>", "Scratch disk intocado");
  assert.includes(finalXml, "<OutputFilePath>C:\\Orig\\A &amp; B\\cam_a.mp4</OutputFilePath>", "OutputFilePath intocado");
});

test("buildCollectPlan: MOGRT descompactado copia pasta dedicada e arquivos irmãos", function () {
  var scanData = {
    items: [
      {
        id: "mogrt_1",
        name: "LowerThird",
        path: "C:\\Scratch\\Motion Graphics Template Media\\LowerThird_UUID\\template.aegraphic",
        isSequence: false,
        isMogrt: true,
        missing: false,
        folders: ["Motion Graphics Template Media"],
        proxyPath: ""
      }
    ]
  };
  var plan = CollectEngine.buildCollectPlan(
    scanData,
    { obeyProxy: false },
    "D:\\Collect\\(Footage)",
    function () { return ["template.aegraphic", "logo_brand.png"]; }
  );
  assert.eq(plan.fileCopies.length, 2, "deve copiar .aegraphic + asset irmão da pasta do MOGRT");
  assert.includes(plan.fileCopies[0].dest, "LowerThird_UUID\\template.aegraphic");
  assert.includes(plan.fileCopies[1].dest, "LowerThird_UUID\\logo_brand.png");
});

test("buildCollectPlan: renameToClipName renomeia arquivo no disco para o nome do clipe", function () {
  var scanData = {
    items: [
      {
        id: "clip_1",
        name: "Entrevista_CEO",
        path: "C:\\raw\\A001_C001_XYZ.mp4",
        isSequence: false,
        missing: false,
        folders: ["02_Assets", "03_Footages"],
        proxyPath: ""
      },
      {
        id: "clip_2",
        name: "Trilha_Principal.wav",
        path: "C:\\audio\\track_master_v3.wav",
        isSequence: false,
        missing: false,
        folders: ["01_Audios"],
        proxyPath: ""
      }
    ]
  };

  var planRenamed = CollectEngine.buildCollectPlan(
    scanData,
    { renameToClipName: true },
    "D:\\Collect\\(Footage)"
  );
  assert.eq(planRenamed.fileCopies.length, 2);
  assert.includes(planRenamed.fileCopies[0].dest, "03_Footages\\Entrevista_CEO.mp4");
  assert.includes(planRenamed.fileCopies[1].dest, "01_Audios\\Trilha_Principal.wav");

  var planOriginal = CollectEngine.buildCollectPlan(
    scanData,
    { renameToClipName: false },
    "D:\\Collect\\(Footage)"
  );
  assert.includes(planOriginal.fileCopies[0].dest, "03_Footages\\A001_C001_XYZ.mp4");
  assert.includes(planOriginal.fileCopies[1].dest, "01_Audios\\track_master_v3.wav");
});

function newPProCollectMock() {
  var mock = pproMockLib.createPProMock();
  mock.evalCollect();

  var binAssets = mock.addBin("02_Assets");
  var binFootage = mock.addBin("03_Footages", binAssets);
  var binMogrt = mock.addBin("Motion Graphics Template Media");

  var videoWithProxy = mock.addClip("cam_a.mp4", "C:\\raw\\cam_a.mp4", binFootage, {
    proxyPath: "C:\\proxies\\cam_a_Proxy.mp4",
    projectMeta: "<premierePrivateProjectMetaData:Column.Intrinsic.MediaType>Movie</premierePrivateProjectMetaData:Column.Intrinsic.MediaType>"
  });

  var stillNumbered = mock.addClip("Foto_01.png", "C:\\stills\\Foto_01.png", binAssets, {
    projectMeta: "<premierePrivateProjectMetaData:Column.Intrinsic.MediaType>Imagem estática</premierePrivateProjectMetaData:Column.Intrinsic.MediaType>"
  });

  var imgSeq = mock.addClip("Anim_0001.png", "C:\\seq\\Anim_0001.png", binAssets, {
    projectMeta:
      "<premierePrivateProjectMetaData:Column.Intrinsic.MediaType>Video</premierePrivateProjectMetaData:Column.Intrinsic.MediaType>" +
      "<premierePrivateProjectMetaData:Column.Intrinsic.VideoFPS>24,00 fps</premierePrivateProjectMetaData:Column.Intrinsic.VideoFPS>"
  });

  var mogrtClip = mock.addClip(
    "LowerThird",
    "C:\\Scratch\\Motion Graphics Template Media\\LT_01\\template.aegraphic",
    binMogrt,
    {}
  );

  var unusedAudio = mock.addClip("sobra.wav", "C:\\audio\\sobra.wav", binAssets, {});

  // Item sintético (Color Matte: sem mediaPath e não offline)
  mock.addClip("Color Matte", "", binAssets, { offline: false });

  var nested = mock.addSequenceFull(
    "Seq_Nested",
    binAssets,
    [{
      name: "V1",
      clips: [{
        projectItem: videoWithProxy,
        components: [
          { matchName: "ADBE Motion", displayName: "Motion" },
          { matchName: "AE.ADBE Lumetri", displayName: "Lumetri Color" }
        ]
      }]
    }],
    []
  );

  var mainSeq = mock.addSequenceFull(
    "Seq_Main",
    null,
    [{
      name: "V1",
      clips: [
        { projectItem: nested.item, components: [] },
        { projectItem: imgSeq, components: [] },
        { projectItem: mogrtClip, components: [] }
      ]
    }],
    []
  );

  var extraSeq = mock.addSequenceFull(
    "Seq_Extra",
    null,
    [{ name: "V1", clips: [{ projectItem: stillNumbered, components: [] }] }],
    []
  );

  return {
    mock: mock,
    mainSeqItem: mainSeq.item,
    extraSeqItem: extraSeq.item
  };
}

function scanPPro(mock, mode, extraOpts) {
  var payload = { mode: mode };
  if (extraOpts) {
    for (var k in extraOpts) {
      if (extraOpts.hasOwnProperty(k)) payload[k] = extraOpts[k];
    }
  }
  var raw = mock.sandbox.$.global.ppro_collectScan(JSON.stringify(payload));
  return JSON.parse(raw);
}

test("PPRO scan 'Tudo': inclui mídias, proxies e MOGRTs, exclui itens sintéticos e diferencia Still vs Sequência", function () {
  var env = newPProCollectMock();
  var res = scanPPro(env.mock, "all");
  assert.ok(res.success, res.error);
  assert.eq(names(res).join("|"), "Anim_0001.png|Foto_01.png|LowerThird|cam_a.mp4|sobra.wav");

  var byName = {};
  res.items.forEach(function (i) { byName[i.name] = i; });
  assert.deepEq(byName["cam_a.mp4"].folders, ["02_Assets", "03_Footages"]);
  assert.eq(byName["cam_a.mp4"].proxyPath, "C:\\proxies\\cam_a_Proxy.mp4");
  assert.notOk(byName["Foto_01.png"].isSequence, "Foto_01.png com MediaType 'Imagem estática' NÃO deve virar sequência");
  assert.ok(byName["Anim_0001.png"].isSequence, "Anim_0001.png com MediaType 'Video' e FPS deve ser sequência");
  assert.ok(byName["LowerThird"].isMogrt, "MOGRT descompactado deve ser marcado como isMogrt");

  // Original + Proxy entram juntos no plano do Premiere (obeyProxy: false)
  var plan = CollectEngine.planSources(res, { obeyProxy: false });
  var srcPaths = plan.sources.map(function (s) { return s.path; });
  assert.includes(srcPaths.join("|"), "cam_a.mp4");
  assert.includes(srcPaths.join("|"), "cam_a_Proxy.mp4");
});

test("PPRO scan 'Todas as sequências' e 'Selecionadas': recursão em sequências aninhadas e filtro de efeitos", function () {
  var env = newPProCollectMock();

  var resAllSeqs = scanPPro(env.mock, "allComps");
  assert.eq(names(resAllSeqs).join("|"), "Anim_0001.png|Foto_01.png|LowerThird|cam_a.mp4");
  assert.eq(resAllSeqs.effectCount, 1, "ADBE Motion intrínseco deve ser ignorado, restando Lumetri Color");
  assert.eq(resAllSeqs.effects[0].name, "Lumetri Color");

  env.mock.select([env.mainSeqItem]);
  var resSel = scanPPro(env.mock, "selected");
  assert.eq(resSel.selectedCompCount, 1);
  assert.eq(names(resSel).join("|"), "Anim_0001.png|LowerThird|cam_a.mp4");

  // allSequences exposto para o painel estilo Project Manager
  assert.ok(Array.isArray(resSel.allSequences), "allSequences deve ser um array");
  assert.eq(resSel.allSequences.length, 3, "Seq_Nested, Seq_Main e Seq_Extra devem ser listadas");
  assert.ok(Array.isArray(resSel.allSequences[0].folders), "allSequences[0].folders deve ser um array");
  assert.deepEq(resSel.allSequences[0].folders, ["02_Assets"], "Seq_Nested deve refletir a bin 02_Assets");

  // Filtro explícito por sequenceIds (seleção via checklist do Project Manager)
  var extraSeqId = null;
  for (var sqI = 0; sqI < resSel.allSequences.length; sqI++) {
    if (resSel.allSequences[sqI].name === "Seq_Extra") {
      extraSeqId = resSel.allSequences[sqI].sequenceID;
    }
  }
  assert.ok(extraSeqId, "Seq_Extra deve possuir sequenceID");
  var resExtraOnly = scanPPro(env.mock, "selected", { sequenceIds: [extraSeqId] });
  assert.eq(names(resExtraOnly).join("|"), "Foto_01.png", "apenas mídia da Seq_Extra deve ser coletada quando selecionada");
});

test("PPRO ppro_collectFinalize: reabre .prproj, restaura nomes e executa Reduce Project preservando aninhamentos", function () {
  var env = newPProCollectMock();
  var binUnusedOnly = env.mock.addBin("99_Sobra_Vazia");
  var extraClipInBin = env.mock.addClip("descarte.mov", "C:\\raw\\descarte.mov", binUnusedOnly, {});

  env.mock.select([env.mainSeqItem]);
  var scanSel = scanPPro(env.mock, "selected");
  assert.eq(scanSel.selectedSequenceIds.length, 1);

  // Simula alteração de nome por sufixo _1 que ppro_collectFinalize deve restaurar
  var camItem = null;
  for (var i = 0; i < scanSel.items.length; i++) {
    if (scanSel.items[i].name === "cam_a.mp4") camItem = scanSel.items[i];
  }
  assert.ok(camItem, "cam_a.mp4 deve estar no scan selecionado");
  var camNode = env.mock.find("cam_a.mp4", env.mock.find("03_Footages", env.mock.find("02_Assets")));
  camNode.name = "cam_a_1.mp4";

  var destPrproj = "D:/Collect_Out/teste.prproj";
  env.mock.registerVirtualFile(destPrproj);

  var itemNamesMap = {};
  itemNamesMap[camItem.id] = "cam_a.mp4";

  var rawFin = env.mock.sandbox.$.global.ppro_collectFinalize(JSON.stringify({
    finalPrprojPath: destPrproj,
    origProjectPath: "C:/projetos/teste.prproj",
    itemNames: itemNamesMap,
    mode: "selected",
    reduceProject: true,
    selectedSequenceIds: scanSel.selectedSequenceIds
  }));
  var fin = JSON.parse(rawFin);

  assert.ok(fin.success, fin.error);
  assert.eq(env.mock.state.closedDocs, 1, "projeto original deve ser fechado antes de abrir a cópia");
  assert.eq(env.mock.sandbox.app.project.path, destPrproj, "cópia coletada deve permanecer aberta");
  assert.eq(camNode.name, "cam_a.mp4", "nome original do item deve ser restaurado");

  // Itens não usados por Seq_Main (Foto_01.png, sobra.wav, Color Matte, descarte.mov e Seq_Extra) devem sair
  assert.ok(fin.reducedCount >= 5, "itens e sequências fora do escopo devem ser removidos no Reduce Project");
  assert.eq(env.mock.find("99_Sobra_Vazia"), null, "bins esvaziadas pela redução devem ser limpas");
  assert.eq(env.mock.find("Seq_Extra"), null, "sequência não selecionada deve ser removida");
  assert.ok(env.mock.find("Seq_Main") !== null, "sequência selecionada deve permanecer");
  assert.ok(env.mock.find("Seq_Nested", env.mock.find("02_Assets")) !== null, "sequência aninhada usada deve permanecer");
  assert.eq(extraClipInBin.__parent, null, "clipe descartado não deve permanecer em nenhuma bin");

  var scanAfterReduce = scanPPro(env.mock, "all");
  assert.eq(names(scanAfterReduce).join("|"), "Anim_0001.png|LowerThird|cam_a.mp4", "apenas mídias usadas pela sequência selecionada restam no projeto");
});

test("roteador expõe collectFinalize com suporte a Premiere Pro", function () {
  var router = read("host/organizer.jsx");
  assert.includes(router, "$.global.ppro_collectFinalize");
  assert.includes(router, "$.global.ppro_collectSaveProject");
  assert.includes(router, "$.global.ppro_collectSaveDialog");
});

test("CollectEngine: constrói e gerencia árvore hierárquica de alvos (pastas e comps)", function () {
  var targets = [
    { id: "1", name: "Motion_Master_1x1", selected: true, folders: ["01_Output"], folderLabels: [9] },
    { id: "2", name: "Motion_Master_4x5", selected: true, folders: ["01_Output"], folderLabels: [9] },
    { id: "3", name: "Comp_2", selected: true, folders: ["02_Assets", "01_PreComps", "Sub"], folderLabels: [0, 5, 5] },
    { id: "4", name: "Comp_3", selected: false, folders: ["02_Assets", "01_PreComps", "Sub"], folderLabels: [0, 5, 5] },
    { id: "5", name: "Comp_Root", selected: true, folders: [], folderLabels: [] }
  ];

  var tree = CollectEngine.buildTargetTree(targets);
  assert.eq(tree.foldersList.length, 2, "deve possuir 2 pastas na raiz (01_Output e 02_Assets)");
  assert.eq(tree.items.length, 1, "deve possuir 1 comp na raiz (Comp_Root)");
  assert.eq(tree.items[0].name, "Comp_Root");

  var outFolder = tree.foldersMap["01_Output"];
  assert.ok(outFolder, "pasta 01_Output deve existir");
  assert.eq(outFolder.label, 9, "label de 01_Output deve ser 9");
  assert.eq(outFolder.items.length, 2, "01_Output deve conter 2 composições");

  var outCounts = CollectEngine.countFolderTargets(outFolder);
  assert.eq(outCounts.total, 2);
  assert.eq(outCounts.selected, 2, "ambas as composições em 01_Output estão selecionadas");

  var assetsFolder = tree.foldersMap["02_Assets"];
  assert.ok(assetsFolder, "pasta 02_Assets deve existir");
  var preComps = assetsFolder.foldersMap["01_PreComps"];
  assert.ok(preComps, "subpasta 01_PreComps deve existir");
  var sub = preComps.foldersMap["Sub"];
  assert.ok(sub, "subpasta Sub deve existir");
  assert.eq(sub.items.length, 2);

  var subCounts = CollectEngine.countFolderTargets(sub);
  assert.eq(subCounts.total, 2);
  assert.eq(subCounts.selected, 1, "apenas 1 comp selecionada em Sub");

  var assetsCounts = CollectEngine.countFolderTargets(assetsFolder);
  assert.eq(assetsCounts.total, 2, "total de comps sob 02_Assets recursivamente");
  assert.eq(assetsCounts.selected, 1);

  // Marcar/desmarcar pasta inteira recursivamente
  CollectEngine.setFolderTargetsSelected(assetsFolder, true);
  var afterCheck = CollectEngine.countFolderTargets(assetsFolder);
  assert.eq(afterCheck.selected, 2, "todas sob 02_Assets devem ficar selecionadas");
  assert.eq(targets[2].selected, true);
  assert.eq(targets[3].selected, true);

  CollectEngine.setFolderTargetsSelected(assetsFolder, false);
  var afterUncheck = CollectEngine.countFolderTargets(assetsFolder);
  assert.eq(afterUncheck.selected, 0, "todas sob 02_Assets devem ficar desmarcadas");
  assert.eq(targets[2].selected, false);
  assert.eq(targets[3].selected, false);
});

test("CollectEngine: estado inicial das pastas segue a seleção do painel Project", function () {
  function mk(sel) {
    return [
      { id: "1", selected: sel[0], folders: ["01_Output"] },
      { id: "2", selected: sel[1], folders: ["02_Assets", "01_PreComps", "A"] },
      { id: "3", selected: sel[2], folders: ["02_Assets", "02_Images"] },
      { id: "4", selected: false, folders: [] }
    ];
  }

  // Nenhuma selecionada: todas fechadas
  var none = CollectEngine.computeInitialCollapsed(mk([false, false, false]));
  assert.deepEq(Object.keys(none).sort(), [
    "01_Output", "02_Assets", "02_Assets/01_PreComps", "02_Assets/01_PreComps/A", "02_Assets/02_Images"
  ]);

  // Uma selecionada (pré-comp aninhada): só o caminho dela aberto
  var one = CollectEngine.computeInitialCollapsed(mk([false, true, false]));
  assert.deepEq(Object.keys(one).sort(), ["01_Output", "02_Assets/02_Images"]);

  // Várias selecionadas em pastas diferentes: abre apenas os caminhos delas
  var many = CollectEngine.computeInitialCollapsed(mk([true, false, true]));
  assert.deepEq(Object.keys(many).sort(), ["02_Assets/01_PreComps", "02_Assets/01_PreComps/A"]);
});

module.exports = h;
