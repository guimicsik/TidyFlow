/* ==========================================================================
   TidyFlow — Testes do motor de regras compartilhado (host/_rules.jsx)
   Cobre a precedência entre nome, tipo, extensão e catchOthers.
   Regressão do incidente "áudio não separado por papel":
   um nó com types:["Audios"] e lista de extensões defasada DEVOLVIA null,
   o item não era movido e nada era reportado no painel.
   ========================================================================== */
"use strict";

var harnessLib = require("./lib/harness");
var aeMock = require("./lib/ae_mock");

var h = harnessLib.createHarness("Rules Matcher");
var test = h.test;
var assert = h.assert;

// Carrega _lib.jsx + _rules.jsx no sandbox do host e devolve $.global.OrgRules
function loadOrgRules() {
  var mock = aeMock.createAeMock();
  mock.evalHostFile("_lib.jsx");
  mock.evalHostFile("_rules.jsx");
  var g = mock.global();
  assert.ok(g.OrgRules, "_rules.jsx deve expor $.global.OrgRules");
  return g.OrgRules;
}

function rec(id, name, rules, parentId, depth) {
  return {
    id: id,
    node: { id: id, name: name, rules: rules || {} },
    parentId: parentId || null,
    depth: depth || 0
  };
}

test("nó de Áudio com extensões defasadas ainda casa pelo tipo (não fica sem destino)", function () {
  var rules = loadOrgRules();
  var matcher = rules.createMatcher([
    rec("a1", "04_Audios", { types: ["Audios"], extensions: ["mp3", "aiff"], catchOthers: false })
  ]);
  var match = matcher.findMatchingNode("Audios", "wav", ["Steps Asphalt - High Heels, Walking.wav"]);
  assert.ok(match && match.rec, "wav deve encontrar o nó de Audios mesmo com a lista de extensões defasada");
  assert.eq(match.rec.id, "a1", "nó casado deve ser o de Audios");
  assert.eq(match.matchedViaCatchOthers, false, "não pode ser roteado como OTHERS");
});

test("extensão declarada continua vencendo o fallback por tipo", function () {
  var rules = loadOrgRules();
  var matcher = rules.createMatcher([
    rec("semWav", "SemWav", { types: ["Audios"], extensions: ["mp3"], catchOthers: false }),
    rec("comWav", "ComWav", { types: ["Audios"], extensions: ["wav"], catchOthers: false })
  ]);
  var match = matcher.findMatchingNode("Audios", "wav", ["x.wav"]);
  assert.eq(match.rec.id, "comWav", "o nó que declara a extensão deve ganhar do fallback");
});

test("catchOthers continua mandando o excedente para OTHERS (sem regressão)", function () {
  var rules = loadOrgRules();
  var matcher = rules.createMatcher([
    rec("o1", "Audios", { types: ["Audios"], extensions: ["mp3"], catchOthers: true })
  ]);
  var match = matcher.findMatchingNode("Audios", "wav", ["x.wav"]);
  assert.ok(match && match.rec, "nó coringa deve casar");
  assert.eq(match.rec.id, "o1", "nó casado deve ser o coringa");
  assert.eq(match.matchedViaCatchOthers, true, "coringa não pode ser promovido pelo fallback de tipo");
});

test("tipo diferente não vaza para outra categoria", function () {
  var rules = loadOrgRules();
  var matcher = rules.createMatcher([
    rec("v1", "01_Videos", { types: ["Videos"], extensions: ["mp4"], catchOthers: false })
  ]);
  var match = matcher.findMatchingNode("Audios", "wav", ["x.wav"]);
  assert.eq(match, null, "áudio não deve cair no nó de vídeo");
});

test("filtro por nomenclatura mantém prioridade máxima sobre tipo e extensão", function () {
  var rules = loadOrgRules();
  var matcher = rules.createMatcher([
    rec("n1", "AI", { nameFilter: "ai", types: ["Videos"], extensions: ["mp4"] }),
    rec("a1", "04_Audios", { types: ["Audios"], extensions: ["mp3"], catchOthers: false })
  ]);
  var match = matcher.findMatchingNode("Audios", "wav", ["ai_audio.wav"]);
  assert.ok(match && match.rec, "deve haver um casamento");
  assert.eq(match.rec.id, "n1", "filtro por nome tem precedência absoluta (MANIFESTO 2.3)");
});

test("pasta estrutural (sem regras) nunca casa", function () {
  var rules = loadOrgRules();
  var matcher = rules.createMatcher([rec("p1", "Pasta", {})]);
  assert.eq(matcher.findMatchingNode("Audios", "wav", ["x.wav"]), null);
});

test("cache por (tipo|extensão) devolve o mesmo destino em chamadas repetidas", function () {
  var rules = loadOrgRules();
  var matcher = rules.createMatcher([
    rec("a1", "04_Audios", { types: ["Audios"], extensions: ["wav"], catchOthers: false })
  ]);
  var first = matcher.findMatchingNode("Audios", "wav", ["a.wav"]);
  var second = matcher.findMatchingNode("Audios", "wav", ["b.wav"]);
  assert.eq(first.rec.id, second.rec.id, "cache não pode trocar o destino do mesmo tipo/extensão");
});

module.exports = h;
