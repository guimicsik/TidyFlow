/* ==========================================================================
   TidyFlow — Testes de ponta a ponta do organizeWithPreset no Premiere Pro
   Foco: triagem de áudio por papel (ESP) e diagnóstico do que ficou de fora.
   Cenário do incidente: nó com types:["Audios"] e extensões defasadas
   (lista derivada do Preset Builder) fazia o áudio NÃO ser movido, sem erro.
   ========================================================================== */
"use strict";

var harnessLib = require("./lib/harness");
var pproMockLib = require("./lib/ppro_mock");

var h = harnessLib.createHarness("PPRO Organize (áudio)");
var test = h.test;
var assert = h.assert;

var AUDIO_NODE_RULES = {
  types: ["Audios"],
  // Lista defasada de propósito: o item é .wav e não está declarado aqui
  extensions: ["mp3", "aiff"],
  catchOthers: false,
  groupSubfoldersByExt: true,
  groupBySourceFolder: false
};

function makePreset(settings, tree) {
  return {
    presetName: "Teste Áudio",
    settings: settings || {},
    tree: tree || [
      { id: "node_audios", name: "Audios", useNumbering: true, rules: AUDIO_NODE_RULES }
    ]
  };
}

var BASE_SETTINGS = {
  usePrefixNumbering: true,
  separateAudioCategories: true,
  deleteEmptyFolders: false,
  saveProjectBefore: false,
  groupBySourceFolder: false
};

test("SFX único com extensão não declarada vai para <Audios>/01_SFX/WAV (sem pular 01_)", function () {
  var mock = pproMockLib.createPProMock();
  mock.evalEngine();
  var clip = mock.addClip(
    "Steps Asphalt - High Heels, Walking.wav",
    "D:/midia/audio/steps_asphalt_walking.wav"
  );

  var res = JSON.parse(mock.organize(makePreset(BASE_SETTINGS)));
  assert.eq(res.success, true, JSON.stringify(res));
  assert.eq(res.movedFootages, 1, "o áudio deve ser movido (não pode ficar para trás)");
  assert.eq(res.audioTotal, 1, "o total de áudios deve ser reportado");
  assert.eq(res.audioNoMatch, 0, "não pode haver áudio sem pasta de destino");
  assert.eq(res.audioRoles.SFX, 1, "o papel detectado deve ser SFX");
  assert.eq(res.movedFootages, 1, "exatamente uma movimentação");
  assert.eq(mock.pathOf(clip), "01_Audios/01_SFX/WAV", "caminho final do áudio começa em 01_SFX quando não há Dialogue/Music");
});

test("ESP desligado: sem subpastas de papel e com aviso explícito", function () {
  var mock = pproMockLib.createPProMock();
  mock.evalEngine();
  var clip = mock.addClip(
    "Trilha Principal.wav",
    "D:/midia/audio/trilha_principal.wav"
  );

  var settings = JSON.parse(JSON.stringify(BASE_SETTINGS));
  settings.separateAudioCategories = false;

  var res = JSON.parse(mock.organize(makePreset(settings)));
  assert.eq(res.success, true, JSON.stringify(res));
  assert.eq(res.audioSeparate, false, "o painel precisa saber que o ESP está desligado");
  assert.eq(res.audioTotal, 1);
  assert.eq(res.audioSkipped, 1, "sem ESP o papel não é detectado");
  assert.eq(res.audioRoles.Music, 0, "não deve haver contagem de papel com o ESP desligado");
  assert.eq(mock.pathOf(clip), "01_Audios/WAV", "sem ESP a mídia vai direto para a subpasta de extensão");
});

test("preset sem nó de áudio: item fica onde está e audioNoMatch conta", function () {
  var mock = pproMockLib.createPProMock();
  mock.evalEngine();
  var clip = mock.addClip("Locução Final.wav", "D:/midia/audio/locucao_final.wav");

  var preset = makePreset(BASE_SETTINGS, [
    {
      id: "node_videos",
      name: "Videos",
      useNumbering: true,
      rules: { types: ["Videos"], extensions: ["mp4"], catchOthers: false }
    }
  ]);

  var res = JSON.parse(mock.organize(preset));
  assert.eq(res.success, true, JSON.stringify(res));
  assert.eq(res.movedFootages, 0, "sem pasta de áudio nada deve ser movido");
  assert.eq(res.audioNoMatch, 1, "o áudio sem destino precisa ser contabilizado");
  assert.eq(mock.pathOf(clip), "", "o item permanece na raiz do projeto");
});

test("papel detectado não é capturado por nameFilter de outro nó", function () {
  var mock = pproMockLib.createPProMock();
  mock.evalEngine();
  // Nome/pasta sem palavras-chave: o papel vem só da heurística do arquivo
  var clip = mock.addClip(
    "Whoosh_Transition_Fast.wav",
    "D:/midia/audio/whoosh_transition_fast.wav"
  );

  var preset = makePreset(BASE_SETTINGS, [
    {
      id: "node_importados",
      name: "SFX Importados",
      useNumbering: true,
      rules: { nameFilter: "sfx", types: ["DataFiles"] }
    },
    { id: "node_audios", name: "Audios", useNumbering: true, rules: AUDIO_NODE_RULES }
  ]);

  var res = JSON.parse(mock.organize(preset));
  assert.eq(res.success, true, JSON.stringify(res));
  assert.eq(res.audioRoles.SFX, 1, "papel SFX deve ser detectado");
  assert.eq(mock.pathOf(clip), "01_Audios/01_SFX/WAV", "o áudio não pode cair no nó de importados (que ficou vazio e não desloca a numeração)");
});

test("bin antiga vazia é reportada em emptyLeftovers (sobra de execução anterior)", function () {
  var mock = pproMockLib.createPProMock();
  mock.evalEngine();

  var oldAudioBin = mock.addBin("04_Audios");
  mock.addBin("WAV", oldAudioBin);

  var clip = mock.addClip(
    "Impact_Heavy_Sub.wav",
    "D:/midia/audio/impact_heavy_sub.wav"
  );

  var res = JSON.parse(mock.organize(makePreset(BASE_SETTINGS)));
  assert.eq(res.success, true, JSON.stringify(res));
  assert.eq(res.movedFootages, 1, "o item deve ser movido para a bin existente");
  assert.eq(mock.pathOf(clip), "01_Audios/01_SFX/WAV", "a bin antiga é reaproveitada e renumerada a partir de 01_");
  assert.ok(
    res.emptyLeftovers.indexOf("04_Audios/WAV") !== -1,
    "a subpasta WAV vazia da execução anterior deve ser reportada (recebido: " +
    JSON.stringify(res.emptyLeftovers) + ")"
  );
});

test("JSON de resposta é sempre parseável e traz o trace de diagnóstico", function () {
  var mock = pproMockLib.createPProMock();
  mock.evalEngine();
  mock.addClip("Voz Off.wav", "D:/midia/audio/voz_off.wav");

  var raw = mock.organize(makePreset(BASE_SETTINGS));
  var res = JSON.parse(raw);
  assert.eq(typeof res.debugTrace, "string", "debugTrace deve ser string");
  assert.includes(res.debugTrace, "AUDIO", "o trace deve registrar as decisões de áudio");
  assert.ok(res.audioSamples instanceof Array, "audioSamples deve ser uma lista");
  assert.eq(res.audioSamples.length, 1, "uma amostra por áudio (até 8)");
  assert.eq(res.audioSamples[0].node, "Audios", "a amostra aponta o nó de destino");
  assert.eq(res.audioSamples[0].path, "01_Dialogue/WAV", "a amostra aponta o subcaminho");
});

test("coluna XML vazia Column.PropertyText.Dialog não gera falso-positivo de Dialogue", function () {
  var mock = pproMockLib.createPProMock();
  mock.evalEngine();
  var sfxClip = mock.addClip(
    "Pants taking off, undressed.wav",
    "D:/Downloads/Sound Effects/Pants taking off, undressed.wav",
    null,
    {
      projectMeta:
        '<x:xmpmeta><rdf:RDF><rdf:Description>' +
        '<premierePrivateProjectMetaData:Column.PropertyText.Dialog></premierePrivateProjectMetaData:Column.PropertyText.Dialog>' +
        '<premierePrivateProjectMetaData:Column.Intrinsic.AudioInfo>96000 Hz - 24 bit - Stereo</premierePrivateProjectMetaData:Column.Intrinsic.AudioInfo>' +
        '</rdf:Description></rdf:RDF></x:xmpmeta>'
    }
  );
  var ambClip = mock.addClip(
    "Wet City - Night Ambience.wav",
    "D:/Downloads/Sound Effects/Wet City - Night Ambience.wav"
  );

  var res = JSON.parse(mock.organize(makePreset(BASE_SETTINGS)));
  assert.eq(res.success, true, JSON.stringify(res));
  assert.eq(mock.pathOf(sfxClip), "01_Audios/01_SFX/WAV", "SFX não pode cair em Dialogue por causa da tag XML vazia e começa em 01_");
  assert.eq(mock.pathOf(ambClip), "01_Audios/02_Ambience/WAV", "nome explícito Night Ambience prevalece sobre pasta Sound Effects e recebe 02_");
});

test("stems irmãos (No Lead Vocals), pastas ancestrais e XMP BPM/genre classificam Music e SFX", function () {
  var mock = pproMockLib.createPProMock();
  mock.evalEngine();

  var songMain = mock.addClip(
    "Ian Post - Outta Reach.wav",
    "D:/Downloads/Ian Post - Outta Reach/Ian Post - Outta Reach.wav"
  );
  var songNoVocals = mock.addClip(
    "Ian Post - Outta Reach - No Lead Vocals.wav",
    "D:/Downloads/Ian Post - Outta Reach/Ian Post - Outta Reach - No Lead Vocals.wav"
  );
  var songBpmXmp = mock.addClip(
    "BalloonPlanet - Arena Drive.wav",
    "D:/Downloads/BalloonPlanet - Arena Drive/BalloonPlanet - Arena Drive.wav",
    null,
    {
      xmp: '<rdf:Description xmpDM:genre="Electronic" xmpDM:tempo="124" />'
    }
  );
  var espTaggedClip = mock.addClip(
    "gravacao_bruta_01.wav",
    "D:/Capturas/gravacao_bruta_01.wav"
  );

  mock.addSequenceWithAudioTracks("Main Edit", [
    {
      name: "Audio 1",
      clips: [
        {
          projectItem: espTaggedClip,
          components: [
            { matchName: "ADBE Volume", displayName: "Volume", properties: [] },
            {
              matchName: "ADBE Sweetening",
              displayName: "Essential Sound",
              properties: [
                { displayName: "Essential Sound Params", value: '{"version":1,"role":"Dialogue","enabled":false}' }
              ]
            }
          ]
        }
      ]
    }
  ]);

  var res = JSON.parse(mock.organize(makePreset(BASE_SETTINGS)));
  assert.eq(res.success, true, JSON.stringify(res));
  assert.eq(mock.pathOf(songNoVocals), "01_Audios/02_Music/WAV", "stem No Lead Vocals vai para Music");
  assert.eq(mock.pathOf(songMain), "01_Audios/02_Music/WAV", "faixa principal herda Music do stem irmão");
  assert.eq(mock.pathOf(songBpmXmp), "01_Audios/02_Music/WAV", "faixa com genre/BPM no XMP vai para Music");
  assert.eq(mock.pathOf(espTaggedClip), "01_Audios/01_Dialogue/WAV", "tag JSON do Essential Sound em componente classifica mesmo com efeitos desligados");
});

test("numeração sequencial sem buracos nos dois níveis + toggle numberAudioCategories (Numerar ESP)", function () {
  var mock = pproMockLib.createPProMock();
  mock.evalEngine();

  var vidClip = mock.addClip("take_01.mp4", "D:/Filmagens/take_01.mp4");
  var musicClip = mock.addClip("Trilha_Indie.wav", "D:/Audio/Trilha_Indie.wav");
  var sfxClip = mock.addClip("Whoosh_01.wav", "D:/Audio/Whoosh_01.wav");
  var ambClip = mock.addClip("Night Ambience.wav", "D:/Audio/Night Ambience.wav");
  var otherClip = mock.addClip("gravacao_999.wav", "D:/Audio/gravacao_999.wav");

  var treeWithEmptySiblings = [
    {
      id: "node_assets",
      name: "Assets",
      useNumbering: true,
      rules: { types: [] },
      children: [
        { id: "node_precomps", name: "PreComps", useNumbering: true, rules: { types: ["PreComps"] } },
        { id: "node_images", name: "Images", useNumbering: true, rules: { types: ["StillImages"], extensions: ["png"] } },
        { id: "node_footages", name: "Footages", useNumbering: true, rules: { types: ["Videos"], extensions: ["mp4"], groupSubfoldersByExt: true } },
        { id: "node_audios", name: "Audios", useNumbering: true, rules: AUDIO_NODE_RULES }
      ]
    }
  ];

  // 1) Com numberAudioCategories = true (padrão): ambos os níveis começam em 01_ sem buracos
  var res1 = JSON.parse(mock.organize(makePreset(BASE_SETTINGS, treeWithEmptySiblings)));
  assert.eq(res1.success, true, JSON.stringify(res1));
  assert.eq(mock.pathOf(vidClip), "01_Assets/01_Footages/MP4", "Footages começa em 01_ quando PreComps e Images estão vazias");
  assert.eq(mock.pathOf(musicClip), "01_Assets/02_Audios/01_Music/WAV", "Audios recebe 02_ e Music começa em 01_ (sem Dialogue)");
  assert.eq(mock.pathOf(sfxClip), "01_Assets/02_Audios/02_SFX/WAV", "SFX recebe 02_");
  assert.eq(mock.pathOf(ambClip), "01_Assets/02_Audios/03_Ambience/WAV", "Ambience recebe 03_");
  assert.eq(mock.pathOf(otherClip), "01_Assets/02_Audios/04_Others/WAV", "Others recebe 04_");

  // 2) Desativando apenas numberAudioCategories (Numerar ESP = false): árvore mantém 01_/02_ e subpastas ESP ficam sem número
  var settingsNoEspNum = JSON.parse(JSON.stringify(BASE_SETTINGS));
  settingsNoEspNum.numberAudioCategories = false;
  settingsNoEspNum.deleteEmptyFolders = true;

  var res2 = JSON.parse(mock.organize(makePreset(settingsNoEspNum, treeWithEmptySiblings)));
  assert.eq(res2.success, true, JSON.stringify(res2));
  assert.eq(mock.pathOf(vidClip), "01_Assets/01_Footages/MP4", "árvore principal continua numerada");
  assert.eq(mock.pathOf(musicClip), "01_Assets/02_Audios/Music/WAV", "subpasta Music perde o prefixo numérico sem duplicar pasta");
  assert.eq(mock.pathOf(sfxClip), "01_Assets/02_Audios/SFX/WAV", "subpasta SFX perde o prefixo numérico");
  assert.eq(mock.pathOf(ambClip), "01_Assets/02_Audios/Ambience/WAV", "subpasta Ambience perde o prefixo numérico");
  assert.eq(mock.pathOf(otherClip), "01_Assets/02_Audios/Others/WAV", "subpasta Others perde o prefixo numérico");
});

module.exports = h;
