/* ==========================================================================
   TidyFlow — Testes do Collect Files (COLLECT_FILES_SPEC.md)
   - CollectEngine.js: regras de nome (§5), sequências, estimativa (§2)
   - host/aeft_collect.jsx: scan sobre o simulador do AE (lib/ae_mock.js)
   - janela com.tidyflow.collect: manifest, IDs de DOM e botão de teste
   ========================================================================== */
"use strict";

var nodeFs = require("fs");
var nodePath = require("path");
var harnessLib = require("./lib/harness");
var aeMockLib = require("./lib/ae_mock");

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

test("roteador expõe collectScan e carrega aeft_collect.jsx", function () {
  var router = read("host/organizer.jsx");
  assert.includes(router, "$.global.collectScan = function");
  assert.includes(router, "aeft_collect.jsx");
});

module.exports = h;
