/* ==========================================================================
   TidyFlow — Testes de Classificação de Áudio no Premiere Pro (ESP)
   ========================================================================== */
"use strict";

var harnessLib = require("./lib/harness");
var h = harnessLib.createHarness("PPRO Audio Classifier");
var test = h.test;
var assert = h.assert;

// Dicionários regex idênticos aos de host/ppro_organizer.jsx
var RX_DIALOGUE = /\b(dialogue|dialogo|di[aá]logo|dialog|voz|voice|fala|dx|entrevista|interview|locucao|locu[cç][aã]o|depoimento|mic|lav|boom|speech|vo)\b/i;
var RX_MUSIC = /\b(music|musica|m[úu]sica|trilha|mx|bgm|soundtrack|song|beat|instrumental|theme|ost|score|mx)\b/i;
var RX_SFX = /\b(sfx|fx|sound[-_ ]?effects?|efeitos?|foley|whoosh|hit|impact|riser|transicao|transi[cç][aã]o|pop|click|swish|explosion|punch|glitch|steps?|footsteps?|passos|walking)\b/i;
var RX_AMBIENCE = /\b(ambience|ambiente|amb|room[-_ ]?tone|atmos|atmosphere|atmosfera|vento|wind|rain|chuva|nature|natureza|crowd)\b/i;

function classifySimulated(nameCandidates, trackName, compNames, xmpMeta) {
  // 1. Componentes do Essential Sound
  if (compNames && compNames.length) {
    for (var i = 0; i < compNames.length; i++) {
      var sig = String(compNames[i]).toLowerCase();
      if (/(speechenhancer|enhance speech|vocal|speech|de-?noise|de-?hum|de-?reverb|de-?ess|clarity|dialogue)/i.test(sig)) return "Dialogue";
      if (/(ducking|auto-?duck|remix|music|stretch|tempo)/i.test(sig)) return "Music";
      if (/(soundeffect|sfx|reverb|studioreverb|creative|distortion|delay|flanger|chorus)/i.test(sig)) return "SFX";
      if (/(ambience|roomtone|room tone|environment|atmos)/i.test(sig)) return "Ambience";
    }
  }

  // 2. Nome da Trilha
  if (trackName) {
    var tClean = " " + String(trackName).replace(/[\-_./\\+,]/g, " ") + " ";
    if (RX_DIALOGUE.test(tClean)) return "Dialogue";
    if (RX_MUSIC.test(tClean)) return "Music";
    if (RX_SFX.test(tClean)) return "SFX";
    if (RX_AMBIENCE.test(tClean)) return "Ambience";
  }

  // 3. Metadados XMP
  if (xmpMeta) {
    if (/(audioRole>Dialogue|audioCategory>Dialogue|soundType>Dialogue|"Dialogue"|audioType.*Dialogue)/i.test(xmpMeta)) return "Dialogue";
    if (/(audioRole>Music|audioCategory>Music|soundType>Music|"Music"|audioType.*Music)/i.test(xmpMeta)) return "Music";
    if (/(audioRole>SFX|audioRole>SoundEffect|soundType>SFX|"SFX"|"Sound Effect"|audioType.*SFX)/i.test(xmpMeta)) return "SFX";
    if (/(audioRole>Ambience|soundType>Ambience|"Ambience"|audioType.*Ambience)/i.test(xmpMeta)) return "Ambience";
  }

  // 4. Heurística de Nomenclatura (candidatos)
  var candidates = Array.isArray(nameCandidates) ? nameCandidates : [nameCandidates];
  for (var c = 0; c < candidates.length; c++) {
    var cand = candidates[c];
    if (!cand) continue;
    var nClean = " " + String(cand).replace(/[\-_./\\+,]/g, " ") + " ";
    if (RX_DIALOGUE.test(nClean)) return "Dialogue";
    if (RX_MUSIC.test(nClean)) return "Music";
    if (RX_SFX.test(nClean)) return "SFX";
    if (RX_AMBIENCE.test(nClean)) return "Ambience";
  }

  return "Others";
}

test("detecta Dialogue por componente de Essential Sound (Enhance Speech)", function () {
  var role = classifySimulated("audio_01.wav", "A1", ["ADBE Enhance Speech", "Volume"]);
  assert.eq(role, "Dialogue");
});

test("detecta Music por componente de Essential Sound (Ducking/Remix)", function () {
  var role = classifySimulated("track_01.wav", "A3", ["Auto-Ducking", "Volume"]);
  assert.eq(role, "Music");
});

test("detecta SFX por componente de Reverb do Essential Sound (Creative)", function () {
  var role = classifySimulated("Steps Asphalt - High Heels, Walking.wav", "A2", ["Studio Reverb", "Volume"]);
  assert.eq(role, "SFX");
});

test("detecta categorias por nome de trilha de áudio", function () {
  assert.eq(classifySimulated("clip.wav", "Dialogue A1", []), "Dialogue");
  assert.eq(classifySimulated("clip.wav", "DX_01", []), "Dialogue");
  assert.eq(classifySimulated("clip.wav", "Voz Principal", []), "Dialogue");
  assert.eq(classifySimulated("clip.wav", "Music MX", []), "Music");
  assert.eq(classifySimulated("clip.wav", "Trilha Sonora", []), "Music");
  assert.eq(classifySimulated("clip.wav", "SFX Impacts", []), "SFX");
  assert.eq(classifySimulated("clip.wav", "Foley Passos", []), "SFX");
  assert.eq(classifySimulated("clip.wav", "Ambience Sala", []), "Ambience");
  assert.eq(classifySimulated("clip.wav", "Atmosfera Chuva", []), "Ambience");
});

test("detecta categorias por nome de arquivo / palavras-chave sem timeline", function () {
  assert.eq(classifySimulated("Entrevista_Diretor.wav", null, []), "Dialogue");
  assert.eq(classifySimulated("VO_Locucao_Final.mp3", null, []), "Dialogue");
  assert.eq(classifySimulated("BGM_Upbeat_Indie.mp3", null, []), "Music");
  assert.eq(classifySimulated("Soundtrack_Trailer.wav", null, []), "Music");
  assert.eq(classifySimulated("Whoosh_Transition_Fast.wav", null, []), "SFX");
  assert.eq(classifySimulated("Impact_Heavy_Sub.wav", null, []), "SFX");
  assert.eq(classifySimulated("Steps Asphalt - High Heels, Walking.wav", null, []), "SFX");
  assert.eq(classifySimulated(["clip.wav", "Sound Effects"], null, []), "SFX");
  assert.eq(classifySimulated("Room_Tone_Living_Room.wav", null, []), "Ambience");
  assert.eq(classifySimulated("Wind_Desert_Loop.wav", null, []), "Ambience");
});

test("detecta tag de Essential Sound em metadados XMP", function () {
  var xmpSample = '<xmpDM:audioRole>SFX</xmpDM:audioRole>';
  assert.eq(classifySimulated("generic_audio.wav", null, [], xmpSample), "SFX");
});

test("arquivos não identificados caem em Others", function () {
  assert.eq(classifySimulated("gravacao_12345.wav", "Audio 1", []), "Others");
});

module.exports = h;
