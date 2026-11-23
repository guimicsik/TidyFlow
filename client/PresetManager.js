(function (global) {
  "use strict";

  var DEFAULT_PRESET_NAME = "Default Clean";
  var STORAGE_KEY_ACTIVE = "ae_organizer_active_preset";
  var STORAGE_KEY_USER_PRESETS = "ae_organizer_user_presets_map";
  var STORAGE_KEY_DEFAULT_OVERRIDES = "ae_organizer_default_settings";
  // Chaves de preferências do painel (prefixo legado mantido por compatibilidade)
  var STORAGE_KEY_SAVE_PROJECT = "ae_organizer_save_project";
  var STORAGE_KEY_REDUCE_PROJECT = "ae_organizer_reduce_project";
  var STORAGE_KEY_DELETE_EMPTY = "ae_organizer_delete_empty";
  var STORAGE_KEY_ROLLBACK_SNAPSHOT = "ae_organizer_rollback_snapshot";
  var STORAGE_KEY_PRESETS_MIGRATED = "ae_organizer_presets_migrated";

  // Logging tolerante: funciona mesmo se OrgLog.js nao estiver carregado
  function logWarn(scope, msg, detail) {
    try { if (global.OrgLog) global.OrgLog.warn(scope, msg, detail); } catch (e) { }
  }
  function logError(scope, msg, detail) {
    try { if (global.OrgLog) global.OrgLog.error(scope, msg, detail); } catch (e) { }
  }

  // 16 Color Labels nativos do After Effects + None (0)
  var AE_LABELS = [
    { index: 0, name: "None", ptName: "Nenhum (None)", color: "#585858" },
    { index: 1, name: "Red", ptName: "1. Red (Vermelho)", color: "#b53838" },
    { index: 2, name: "Yellow", ptName: "2. Yellow (Amarelo)", color: "#e4d84c" },
    { index: 3, name: "Aqua", ptName: "3. Aqua (Água)", color: "#a9cbc7" },
    { index: 4, name: "Pink", ptName: "4. Pink (Rosa)", color: "#e5bcc9" },
    { index: 5, name: "Lavender", ptName: "5. Lavender (Lavanda)", color: "#a9a9ca" },
    { index: 6, name: "Peach", ptName: "6. Peach (Pêssego)", color: "#e7c19e" },
    { index: 7, name: "Seafoam", ptName: "7. Seafoam (Espuma)", color: "#b3c7b3" },
    { index: 8, name: "Blue", ptName: "8. Blue (Azul)", color: "#677de0" },
    { index: 9, name: "Green", ptName: "9. Green (Verde)", color: "#4aa44c" },
    { index: 10, name: "Purple", ptName: "10. Purple (Roxo)", color: "#8e2c9a" },
    { index: 11, name: "Orange", ptName: "11. Orange (Laranja)", color: "#e8920d" },
    { index: 12, name: "Brown", ptName: "12. Brown (Marrom)", color: "#7f452a" },
    { index: 13, name: "Magenta", ptName: "13. Magenta (Fúcsia)", color: "#f46dd6" },
    { index: 14, name: "Cyan", ptName: "14. Cyan (Ciano)", color: "#3da2a5" },
    { index: 15, name: "Sandstone", ptName: "15. Sandstone (Arenito)", color: "#a89677" },
    { index: 16, name: "Dark Green", ptName: "16. Dark Green (Verde Escuro)", color: "#1e401e" }
  ];

  // 16 Color Labels nativos do Premiere Pro (0..15) mapeados 1:1 para os mesmos slots (1..16) do Preset
  // Slot 0 = Padrão (não sobrescreve a cor da Bin no Premiere)
  var PPRO_LABELS_BY_SLOT = {
    0: { index: 0, pproIndex: -1, name: "Default", ptName: "Padrão (Sem alteração)", color: "#585858" },
    1: { index: 1, pproIndex: 0, name: "Violet", ptName: "1. Violet (Violeta)", color: "#7b45a0" },
    11: { index: 11, pproIndex: 1, name: "Iris", ptName: "2. Iris (Íris)", color: "#5273b8" },
    7: { index: 7, pproIndex: 2, name: "Caribbean", ptName: "3. Caribbean (Caribe)", color: "#2ba58b" },
    5: { index: 5, pproIndex: 3, name: "Lavender", ptName: "4. Lavender (Lavanda)", color: "#9f79c1" },
    3: { index: 3, pproIndex: 4, name: "Cerulean", ptName: "5. Cerulean (Cerúleo)", color: "#3297c9" },
    16: { index: 16, pproIndex: 5, name: "Forest", ptName: "6. Forest (Floresta)", color: "#2d7a47" },
    4: { index: 4, pproIndex: 6, name: "Rose", ptName: "7. Rose (Rosa)", color: "#d85888" },
    6: { index: 6, pproIndex: 7, name: "Mango", ptName: "8. Mango (Manga)", color: "#de8735" },
    10: { index: 10, pproIndex: 8, name: "Purple", ptName: "9. Purple (Roxo)", color: "#8c3899" },
    8: { index: 8, pproIndex: 9, name: "Blue", ptName: "10. Blue (Azul)", color: "#3c59c9" },
    14: { index: 14, pproIndex: 10, name: "Teal", ptName: "11. Teal (Azul-petróleo)", color: "#278287" },
    13: { index: 13, pproIndex: 11, name: "Magenta", ptName: "12. Magenta", color: "#c942a8" },
    15: { index: 15, pproIndex: 12, name: "Tan", ptName: "13. Tan (Arenito)", color: "#a89273" },
    9: { index: 9, pproIndex: 13, name: "Green", ptName: "14. Green (Verde)", color: "#44a248" },
    12: { index: 12, pproIndex: 14, name: "Brown", ptName: "15. Brown (Marrom)", color: "#7d4a2d" },
    2: { index: 2, pproIndex: 15, name: "Yellow", ptName: "16. Yellow (Amarelo)", color: "#d8c53b" }
  };

  var PPRO_LABELS_ORDERED = [
    PPRO_LABELS_BY_SLOT[0],
    PPRO_LABELS_BY_SLOT[1],
    PPRO_LABELS_BY_SLOT[11],
    PPRO_LABELS_BY_SLOT[7],
    PPRO_LABELS_BY_SLOT[5],
    PPRO_LABELS_BY_SLOT[3],
    PPRO_LABELS_BY_SLOT[16],
    PPRO_LABELS_BY_SLOT[4],
    PPRO_LABELS_BY_SLOT[6],
    PPRO_LABELS_BY_SLOT[10],
    PPRO_LABELS_BY_SLOT[8],
    PPRO_LABELS_BY_SLOT[14],
    PPRO_LABELS_BY_SLOT[13],
    PPRO_LABELS_BY_SLOT[15],
    PPRO_LABELS_BY_SLOT[9],
    PPRO_LABELS_BY_SLOT[12],
    PPRO_LABELS_BY_SLOT[2]
  ];

  var DEFAULT_EXTENSIONS_AE = {
    Images: [
      "psd", "psb", "pdd", "ai", "eps", "ps", "pdf", "png", "jpg", "jpeg", "jpe", "webp",
      "tif", "tiff", "bmp", "rle", "dib", "gif", "exr", "sxr", "mxr", "tga", "vda",
      "icb", "vst", "hdr", "rgbe", "xyze", "heif", "heic", "svg",
      "iff", "tdi", "sgi", "rgb", "bw", "pic", "rla", "rpf", "ei", "raw", "crw",
      "cr2", "cr3", "nef", "nrw", "arw", "srf", "sr2", "raf", "orf", "rw2", "pef",
      "x3f", "erf", "kdc", "dcr", "mos", "mrw", "iiq", "3fr", "fff", "srw",
      "gpr", "dxo", "arq", "rwl", "mfw", "mef"
    ],
    Videos: [
      "mp4", "m4v", "mov", "qt", "prores", "avi", "mkv", "webm", "mxf", "mpg",
      "mpeg", "m1v", "mpv", "m2p", "m2v", "m2t", "m2ts", "mts", "ts", "vob",
      "3gp", "3g2", "amc", "dv", "wmv", "asf", "flv", "f4v", "r3d", "ari",
      "braw", "crm", "cin", "dpx", "dng", "hevc", "h264", "264", "ogv", "cine",
      "yuv", "dnxhd", "dnxhr"
    ],
    Audios: [
      "wav", "bwf", "mp3", "mpa", "mpe", "aac", "m4a", "aif", "aiff",
      "flac", "ogg", "wma", "mka"
    ],
    DataFiles: [
      "obj", "gltf", "glb", "fbx", "c4d",
      "json", "mgjson", "csv", "tsv", "jsx", "bvh",
      "prproj", "aep", "aepx", "aet",
      "mogrt", "srt", "vtt", "scc", "stl", "xml", "edl", "aaf", "omf", "cube", "look"
    ],
    ImageSequences: [
      "png", "exr", "tga", "tif", "tiff", "jpg", "jpeg", "dpx", "cin", "iff", "hdr"
    ]
  };

  // Extensões otimizadas para o Adobe Premiere Pro (inclui codecs de câmera, legendas broadcast e projetos NLE)
  var DEFAULT_EXTENSIONS_PPRO = {
    Images: [
      "psd", "psb", "pdd", "ai", "eps", "ps", "pdf", "png", "jpg", "jpeg", "jpe", "jfif", "webp",
      "tif", "tiff", "bmp", "rle", "dib", "ico", "gif", "exr", "sxr", "mxr", "tga", "vda",
      "icb", "vst", "hdr", "rgbe", "xyze", "heif", "heic", "svg",
      "iff", "tdi", "sgi", "rgb", "bw", "pic", "rla", "rpf", "ei", "raw", "crw",
      "cr2", "cr3", "nef", "nrw", "arw", "srf", "sr2", "raf", "orf", "rw2", "pef",
      "x3f", "erf", "kdc", "dcr", "mos", "mrw", "iiq", "3fr", "fff", "srw",
      "gpr", "dxo", "arq", "rwl", "mfw", "mef", "dng"
    ],
    Videos: [
      "mp4", "m4v", "mov", "qt", "prores", "avi", "mkv", "webm", "mxf", "mpg",
      "mpeg", "m1v", "mpv", "m2p", "m2v", "m2t", "m2ts", "mts", "ts", "vob",
      "mod", "tod", "3gp", "3g2", "amc", "dv", "wmv", "asf", "flv", "f4v",
      "r3d", "ari", "braw", "crm", "cin", "dpx", "dng", "hevc", "h264", "264",
      "ogv", "cine", "yuv", "dnxhd", "dnxhr"
    ],
    Audios: [
      "wav", "bwf", "mp3", "mpa", "mpe", "m2a", "aac", "m4a", "aif", "aiff",
      "flac", "ogg", "wma", "mka", "asnd", "ac3", "caf", "mid", "midi"
    ],
    DataFiles: [
      "obj", "gltf", "glb", "fbx", "c4d",
      "json", "mgjson", "csv", "tsv", "tab", "txt", "pbl", "jsx", "bvh",
      "prproj", "prel", "chproj", "aep", "aepx", "aet",
      "mogrt", "srt", "vtt", "scc", "stl", "mcc", "dfxp", "ttml", "cap", "sbv",
      "xml", "edl", "aaf", "omf", "ale", "cube", "look"
    ],
    ImageSequences: [
      "png", "exr", "tga", "tif", "tiff", "jpg", "jpeg", "dpx", "cin", "iff", "hdr", "dng"
    ]
  };

  var DEFAULT_EXTENSIONS = DEFAULT_EXTENSIONS_AE;

  function getFactoryPresetObject(isPPro) {
    var extDict = isPPro ? DEFAULT_EXTENSIONS_PPRO : DEFAULT_EXTENSIONS_AE;
    return {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "presetName": DEFAULT_PRESET_NAME,
      "isBuiltIn": true,
      "version": "1.0",
      "settings": {
        "usePrefixNumbering": true,
        "deleteEmptyFolders": true,
        "saveProjectBefore": true,
        "reduceProject": false,
        "groupBySourceFolder": true,
        "sourceFolderMode": "both",
        "unusedFolderName": "Nunca Usadas",
        "separateAudioCategories": true,
        "numberAudioCategories": true
      },
      "tree": [
        {
          "id": "node_output",
          "name": "Output",
          "label": 9,
          "rules": {
            "types": ["MainComp"],
            "extensions": [],
            "groupByMainComp": false,
            "handlePsdBundles": false,
            "groupSubfoldersByExt": false,
            "catchOthers": false,
            "nameFilter": "",
            "nameFilterMode": "contains"
          },
          "children": []
        },
        {
          "id": "node_assets",
          "name": "Assets",
          "label": 0,
          "rules": {
            "types": [],
            "extensions": [],
            "groupByMainComp": false,
            "handlePsdBundles": false,
            "groupSubfoldersByExt": false,
            "catchOthers": false,
            "nameFilter": "",
            "nameFilterMode": "contains"
          },
          "children": [
            {
              "id": "node_precomps",
              "name": "PreComps",
              "label": 5,
              "rules": {
                "types": ["PreComps"],
                "extensions": [],
                "groupByMainComp": true,
                "handlePsdBundles": false,
                "groupSubfoldersByExt": false,
                "catchOthers": false,
                "nameFilter": "",
                "nameFilterMode": "contains"
              },
              "children": []
            },
            {
              "id": "node_images",
              "name": "Images",
              "label": 4,
              "rules": {
                "types": ["StillImages"],
                "extensions": extDict.Images.slice(),
                "groupByMainComp": false,
                "handlePsdBundles": true,
                "groupSubfoldersByExt": true,
                "groupBySourceFolder": true,
        "sourceFolderMode": "both",
                "catchOthers": true,
                "nameFilter": "",
                "nameFilterMode": "contains"
              },
              "children": []
            },
            {
              "id": "node_footages",
              "name": "Footages",
              "label": 6,
              "rules": {
                "types": ["Videos", "ImageSequences", "DataFiles"],
                "extensions": extDict.Videos
                  .concat(extDict.DataFiles)
                  .concat(["exr", "png", "tga", "tif", "tiff", "jpg", "jpeg"]),
                "groupByMainComp": false,
                "handlePsdBundles": false,
                "groupSubfoldersByExt": true,
                "groupBySourceFolder": true,
        "sourceFolderMode": "both",
                "catchOthers": true,
                "nameFilter": "",
                "nameFilterMode": "contains"
              },
              "children": []
            },
            {
              "id": "node_audios",
              "name": "Audios",
              "label": 7,
              "rules": {
                "types": ["Audios"],
                "extensions": extDict.Audios.slice(),
                "groupByMainComp": false,
                "handlePsdBundles": false,
                "groupSubfoldersByExt": true,
                "groupBySourceFolder": true,
        "sourceFolderMode": "both",
                "catchOthers": true,
                "nameFilter": "",
                "nameFilterMode": "contains"
              },
              "children": []
            },
            {
              "id": "node_solids",
              "name": "Solids",
              "label": 0,
              "rules": {
                "types": ["Solids"],
                "extensions": [],
                "groupByMainComp": false,
                "handlePsdBundles": false,
                "groupSubfoldersByExt": false,
                "catchOthers": false,
                "nameFilter": "",
                "nameFilterMode": "contains"
              },
              "children": []
            }
          ]
        }
      ]
    };
  }

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  // O preset padrão NÃO grava sua árvore (é protegida), mas o usuário pode
  // alternar a regra "Pasta de Origem" pasta a pasta no editor. Sem persistir
  // isso por id de nó, o toggle voltava ao default ao reabrir o painel.
  var DEFAULT_OVERRIDE_SETTING_KEYS = [
    "usePrefixNumbering",
    "deleteEmptyFolders",
    "saveProjectBefore",
    "reduceProject",
    "groupBySourceFolder",
    "sourceFolderMode",
    "unusedFolderName",
    "separateAudioCategories",
    "numberAudioCategories"
  ];

  var SOURCE_FOLDER_MODES = ["both", "project", "disk", "off"];

  function normalizeSourceFolderMode(rawMode, rawBool) {
    if (rawBool === false) return "off";
    var m = rawMode ? String(rawMode).trim().toLowerCase() : "";
    if (m === "project" || m === "disk" || m === "both") return m;
    if (m === "off" && rawBool !== true) return "off";
    return "both";
  }

  function collectNodeGroupBySourceFolder(nodes, out) {
    var result = out || {};
    if (!nodes || !nodes.length) return result;
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (!node) continue;
      var rules = node.rules || {};
      result[String(node.id)] = normalizeSourceFolderMode(rules.sourceFolderMode, rules.groupBySourceFolder);
      if (false && rules.groupBySourceFolder !== undefined) result[String(node.id)] = rules.groupBySourceFolder !== undefined
        ? Boolean(rules.groupBySourceFolder)
        : true;
      if (node.children && node.children.length) {
        collectNodeGroupBySourceFolder(node.children, result);
      }
    }
    return result;
  }

  function applyNodeGroupBySourceFolder(nodes, overrides) {
    if (!nodes || !nodes.length || !overrides) return;
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (!node) continue;
      var key = String(node.id);
      if (overrides[key] !== undefined) {
        if (!node.rules) node.rules = {};
        var ovVal = overrides[key];
        var ovMode = typeof ovVal === "string"
          ? normalizeSourceFolderMode(ovVal, ovVal !== "off")
          : normalizeSourceFolderMode(undefined, Boolean(ovVal));
        node.rules.sourceFolderMode = ovMode;
        node.rules.groupBySourceFolder = (ovMode !== "off");
      }
      if (node.children && node.children.length) {
        applyNodeGroupBySourceFolder(node.children, overrides);
      }
    }
  }

  // Assinatura estável da árvore, usada para detectar mudanças que o preset
  // Default NÃO persiste (ele guarda apenas settings + nodeGroupBySourceFolder).
  // Ids e rules.groupBySourceFolder ficam de fora de propósito: variam por
  // motivos legítimos (ex.: propagação do toggle global) sem que o usuário
  // tenha editado estrutura nenhuma.
  function buildTreeSignature(nodes) {
    if (!nodes || !nodes.length) return "[]";
    var out = "[";
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (!node) continue;
      var rules = node.rules || {};
      out += "{" + [
        String(node.name === undefined || node.name === null ? "" : node.name),
        String(node.label === undefined || node.label === null ? 0 : node.label),
        node.useNumbering === false ? "0" : "1",
        (rules.types || []).join("+"),
        (rules.extensions || []).join("+"),
        (rules.customExtensions || []).join("+"),
        rules.groupByMainComp ? "1" : "0",
        rules.handlePsdBundles ? "1" : "0",
        rules.groupSubfoldersByExt ? "1" : "0",
        rules.catchOthers ? "1" : "0",
        String(rules.nameFilter || ""),
        String(rules.nameFilterMode || "contains")
      ].join("|") + "}" + buildTreeSignature(node.children);
    }
    return out + "]";
  }

  function getNodeRequire() {
    if (global.cep_node && typeof global.cep_node.require === "function") {
      return global.cep_node.require;
    }
    if (typeof require === "function") {
      return require;
    }
    return null;
  }

  function sanitizeFileName(name) {
    return String(name || "preset")
      .trim()
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
      .replace(/\s+/g, "_");
  }

  function normalizeNode(node, indexSeed) {
    var rules = (node && node.rules) || {};
    var rawExts = Array.isArray(rules.extensions) ? rules.extensions : [];
    var cleanExts = [];
    var seenExt = {};
    for (var i = 0; i < rawExts.length; i++) {
      var ext = String(rawExts[i] || "").trim().replace(/^\.+/, "").toLowerCase();
      if (ext && !seenExt[ext]) {
        seenExt[ext] = true;
        cleanExts.push(ext);
      }
    }

    var rawCustomExts = Array.isArray(rules.customExtensions) ? rules.customExtensions : null;
    var cleanCustomExts = null;
    if (rawCustomExts !== null) {
      cleanCustomExts = [];
      var seenCustomExt = {};
      for (var ce = 0; ce < rawCustomExts.length; ce++) {
        var cExt = String(rawCustomExts[ce] || "").trim().replace(/^\.+/, "").toLowerCase();
        if (cExt && !seenCustomExt[cExt]) {
          seenCustomExt[cExt] = true;
          cleanCustomExts.push(cExt);
        }
      }
    }

    var rawTypes = Array.isArray(rules.types) ? rules.types : [];
    var cleanTypes = [];
    for (var t = 0; t < rawTypes.length; t++) {
      var tp = String(rawTypes[t] || "").trim();
      if (tp && cleanTypes.indexOf(tp) === -1) {
        cleanTypes.push(tp);
      }
    }

    var labelNum = parseInt(node && node.label, 10);
    if (isNaN(labelNum) || labelNum < 0 || labelNum > 16) {
      labelNum = 0;
    }

    var children = Array.isArray(node && node.children) ? node.children : [];
    var normalizedChildren = [];
    for (var c = 0; c < children.length; c++) {
      normalizedChildren.push(normalizeNode(children[c], indexSeed + "_" + c));
    }

    var normalizedRules = {
      types: cleanTypes,
      extensions: cleanExts,
      groupByMainComp: Boolean(rules.groupByMainComp),
      handlePsdBundles: Boolean(rules.handlePsdBundles),
      groupSubfoldersByExt: Boolean(rules.groupSubfoldersByExt),
      groupSubfoldersByExt: Boolean(rules.groupSubfoldersByExt),
      sourceFolderMode: normalizeSourceFolderMode(rules.sourceFolderMode, rules.groupBySourceFolder),
      groupBySourceFolder: normalizeSourceFolderMode(rules.sourceFolderMode, rules.groupBySourceFolder) !== "off",
      catchOthers: Boolean(rules.catchOthers),
      nameFilter: rules.nameFilter ? String(rules.nameFilter) : "",
      nameFilterMode: rules.nameFilterMode === "regex" ? "regex" : "contains"
    };
    if (cleanCustomExts !== null) {
      normalizedRules.customExtensions = cleanCustomExts;
    }

    return {
      id: (node && node.id) ? String(node.id) : ("node_" + Date.now() + "_" + indexSeed),
      name: (node && node.name && String(node.name).trim()) ? String(node.name).trim() : "Nova Pasta",
      label: labelNum,
      useNumbering: (node && node.useNumbering !== undefined) ? Boolean(node.useNumbering) : true,
      rules: normalizedRules,
      children: normalizedChildren
    };
  }

  function normalizePreset(presetObj) {
    var base = getFactoryPresetObject();
    if (!presetObj || typeof presetObj !== "object") {
      return base;
    }

    var pName = presetObj.presetName ? String(presetObj.presetName).trim() : DEFAULT_PRESET_NAME;
    var isDefault = (pName === DEFAULT_PRESET_NAME || Boolean(presetObj.isBuiltIn));
    var s = presetObj.settings || {};

    var treeArr = Array.isArray(presetObj.tree) ? presetObj.tree : base.tree;
    var normTree = [];
    for (var i = 0; i < treeArr.length; i++) {
      normTree.push(normalizeNode(treeArr[i], String(i)));
    }

    return {
      "$schema": "http://json-schema.org/draft-07/schema#",
      presetName: pName,
      isBuiltIn: isDefault && pName === DEFAULT_PRESET_NAME,
      version: String(presetObj.version || "1.0"),
      settings: {
        usePrefixNumbering: s.usePrefixNumbering !== undefined ? Boolean(s.usePrefixNumbering) : true,
        deleteEmptyFolders: s.deleteEmptyFolders !== undefined ? Boolean(s.deleteEmptyFolders) : true,
        saveProjectBefore: s.saveProjectBefore !== undefined ? Boolean(s.saveProjectBefore) : true,
        reduceProject: s.reduceProject !== undefined ? Boolean(s.reduceProject) : false,
        sourceFolderMode: normalizeSourceFolderMode(s.sourceFolderMode, s.groupBySourceFolder),
        groupBySourceFolder: normalizeSourceFolderMode(s.sourceFolderMode, s.groupBySourceFolder) !== "off",
        unusedFolderName: (s.unusedFolderName && String(s.unusedFolderName).trim()) ? String(s.unusedFolderName).trim() : "Nunca Usadas",
        separateAudioCategories: s.separateAudioCategories !== undefined ? Boolean(s.separateAudioCategories) : true,
        numberAudioCategories: s.numberAudioCategories !== undefined ? Boolean(s.numberAudioCategories) : true
      },
      tree: normTree
    };
  }

  function PresetManager(csInterfaceInstance) {
    this.csInterface = csInterfaceInstance || (typeof CSInterface !== "undefined" ? new CSInterface() : null);
    this.req = getNodeRequire();
    this.fs = this.req ? this.req("fs") : null;
    this.path = this.req ? this.req("path") : null;
    this.childProcess = this.req ? this.req("child_process") : null;
    // Caches: undefined = path ainda não resolvido | null = indisponível
    this._presetsDirCache = undefined;
    this._presetListCache = null;
    this._presetObjectCache = {};
    this.lastSaveError = null;
    // Aviso não bloqueante: a última gravação descartou parte do que foi enviado
    this.lastSaveWarning = null;
    this._defaultTreeSignature = undefined;
  }

  PresetManager.AE_LABELS = AE_LABELS;
  PresetManager.PPRO_LABELS = PPRO_LABELS_ORDERED;
  PresetManager.PPRO_LABELS_BY_SLOT = PPRO_LABELS_BY_SLOT;
  PresetManager.DEFAULT_PRESET_NAME = DEFAULT_PRESET_NAME;
  PresetManager.DEFAULT_EXTENSIONS = DEFAULT_EXTENSIONS;
  PresetManager.DEFAULT_EXTENSIONS_AE = DEFAULT_EXTENSIONS_AE;
  PresetManager.DEFAULT_EXTENSIONS_PPRO = DEFAULT_EXTENSIONS_PPRO;
  PresetManager.SOURCE_FOLDER_MODES = SOURCE_FOLDER_MODES;
  PresetManager.normalizeSourceFolderMode = normalizeSourceFolderMode;
  PresetManager.STORAGE_KEYS = {
    active: STORAGE_KEY_ACTIVE,
    userPresets: STORAGE_KEY_USER_PRESETS,
    defaultOverrides: STORAGE_KEY_DEFAULT_OVERRIDES,
    saveProject: STORAGE_KEY_SAVE_PROJECT,
    reduceProject: STORAGE_KEY_REDUCE_PROJECT,
    deleteEmpty: STORAGE_KEY_DELETE_EMPTY,
    rollbackSnapshot: STORAGE_KEY_ROLLBACK_SNAPSHOT,
    presetsMigrated: STORAGE_KEY_PRESETS_MIGRATED
  };

  PresetManager.prototype.getDefaultExtensions = function () {
    return this.isPremierePro() ? DEFAULT_EXTENSIONS_PPRO : DEFAULT_EXTENSIONS_AE;
  };

  PresetManager.prototype.getHostAppId = function () {
    try {
      if (this.csInterface && typeof this.csInterface.getHostEnvironment === "function") {
        var env = this.csInterface.getHostEnvironment();
        if (env && env.appId) {
          return String(env.appId).toUpperCase();
        }
      }
    } catch (e) { }
    return "AEFT";
  };

  PresetManager.prototype.isPremierePro = function () {
    return this.getHostAppId() === "PPRO";
  };

  PresetManager.prototype.getHostDisplayName = function () {
    return this.isPremierePro() ? "Premiere Pro" : "After Effects";
  };

  PresetManager.prototype.getLabelsList = function () {
    return this.isPremierePro() ? PPRO_LABELS_ORDERED : AE_LABELS;
  };

  PresetManager.prototype.getLabelInfo = function (labelIndex) {
    var idx = parseInt(labelIndex, 10);
    if (isNaN(idx) || idx < 0 || idx > 16) idx = 0;
    if (this.isPremierePro()) {
      return PPRO_LABELS_BY_SLOT[idx] || PPRO_LABELS_BY_SLOT[0];
    }
    return AE_LABELS[idx] || AE_LABELS[0];
  };

  PresetManager.prototype.getPresetsFolderPath = function () {
    // Memoizado: resolver esse caminho envolve existsSync + mkdirSync (+ migração)
    // e era repetido a cada listagem/leitura de preset (inclusive a cada foco de janela).
    if (this._presetsDirCache !== undefined) return this._presetsDirCache;

    var resolved = null;
    if (this.csInterface && this.path) {
      try {
        var userData = this.csInterface.getSystemPath(SystemPath.USER_DATA);
        if (userData) {
          var folder = this.path.join(userData, "TidyFlow", "presets");
          var oldFolder = this.path.join(userData, "AE_Organizer", "presets");
          if (this.fs) {
            if (!this.fs.existsSync(folder)) {
              this.fs.mkdirSync(folder, { recursive: true });
            }
            // Migração suave de presets antigos, se existirem
            try {
              // Migra apenas uma vez; do contrário presets excluídos reaparecem
              var migrated = false;
              try { migrated = localStorage.getItem(STORAGE_KEY_PRESETS_MIGRATED) === "1"; } catch (eFlag) { }
              if (!migrated) {
                try { localStorage.setItem(STORAGE_KEY_PRESETS_MIGRATED, "1"); } catch (eFlag2) { }
              }
              if (!migrated && this.fs.existsSync(oldFolder)) {
                var files = this.fs.readdirSync(oldFolder);
                for (var i = 0; i < files.length; i++) {
                  var srcFile = this.path.join(oldFolder, files[i]);
                  var destFile = this.path.join(folder, files[i]);
                  if (!this.fs.existsSync(destFile)) {
                    this.fs.copyFileSync(srcFile, destFile);
                  }
                }
              }
            } catch (migErr) { }
          }
          resolved = folder;
        }
      } catch (e) {
        resolved = null;
        logWarn("PresetManager.getPresetsFolderPath", "Falha ao resolver a pasta de presets", e);
      }
    }

    this._presetsDirCache = resolved;
    return resolved;
  };

  PresetManager.prototype.getDefaultPresetFromBundle = function () {
    try {
      if (this.csInterface && this.fs && this.path) {
        var isPPro = this.isPremierePro();
        var extPath = this.csInterface.getSystemPath(SystemPath.EXTENSION);
        var presetFileName = isPPro ? "default_preset_ppro.json" : "default_preset.json";
        var defaultFilePath = this.path.join(extPath, "client", "presets", presetFileName);
        if (this.fs.existsSync(defaultFilePath)) {
          var raw = this.fs.readFileSync(defaultFilePath, "utf8");
          var parsed = JSON.parse(raw);
          return normalizePreset(parsed);
        }
        // Fallback para default_preset.json genérico.
        // No Premiere Pro esse bundle traria as listas de extensões do After
        // Effects (sem jfif/ico/mod/tod, etc.). Nesse caso o dicionário do host
        // é a fonte correta, então pulamos o fallback genérico.
        var fallbackPath = this.path.join(extPath, "client", "presets", "default_preset.json");
        if (!isPPro && this.fs.existsSync(fallbackPath)) {
          var rawFb = this.fs.readFileSync(fallbackPath, "utf8");
          var parsedFb = JSON.parse(rawFb);
          return normalizePreset(parsedFb);
        }
        if (isPPro) {
          logWarn(
            "PresetManager.getDefaultPresetFromBundle",
            "Bundle default_preset_ppro.json ausente; usando o dicionário de extensões do Premiere Pro"
          );
        }
      }
    } catch (e) { }
    return getFactoryPresetObject(this.isPremierePro());
  };

  PresetManager.prototype.getDefaultPreset = function () {
    var base = this.getDefaultPresetFromBundle();
    try {
      var savedSettingsStr = localStorage.getItem(STORAGE_KEY_DEFAULT_OVERRIDES);
      if (savedSettingsStr) {
        var savedSettings = JSON.parse(savedSettingsStr);
        if (savedSettings && typeof savedSettings === "object") {
          if (savedSettings.usePrefixNumbering !== undefined) {
            base.settings.usePrefixNumbering = Boolean(savedSettings.usePrefixNumbering);
          }
          if (savedSettings.deleteEmptyFolders !== undefined) {
            base.settings.deleteEmptyFolders = Boolean(savedSettings.deleteEmptyFolders);
          }
          if (savedSettings.saveProjectBefore !== undefined) {
            base.settings.saveProjectBefore = Boolean(savedSettings.saveProjectBefore);
          }
          if (savedSettings.reduceProject !== undefined) {
            base.settings.reduceProject = Boolean(savedSettings.reduceProject);
          }
          if (savedSettings.groupBySourceFolder !== undefined) {
            var savedSrcMode = normalizeSourceFolderMode(savedSettings.sourceFolderMode, savedSettings.groupBySourceFolder);
            base.settings.sourceFolderMode = savedSrcMode;
            base.settings.groupBySourceFolder = (savedSrcMode !== "off");
          }
          if (savedSettings.sourceFolderMode !== undefined && savedSettings.groupBySourceFolder === undefined) {
            var onlySrcMode = normalizeSourceFolderMode(savedSettings.sourceFolderMode, undefined);
            base.settings.sourceFolderMode = onlySrcMode;
            base.settings.groupBySourceFolder = (onlySrcMode !== "off");
          }
          if (savedSettings.unusedFolderName !== undefined) {
            var savedUnusedName = String(savedSettings.unusedFolderName || "").trim();
            if (savedUnusedName) base.settings.unusedFolderName = savedUnusedName;
          }
          if (savedSettings.separateAudioCategories !== undefined) {
            base.settings.separateAudioCategories = Boolean(savedSettings.separateAudioCategories);
          }
          if (savedSettings.nodeGroupBySourceFolder) {
            applyNodeGroupBySourceFolder(base.tree, savedSettings.nodeGroupBySourceFolder);
          }
        }
      }
    } catch (e) { }
    return base;
  };

  PresetManager.prototype.resetDefaultPreset = function () {
    try {
      localStorage.removeItem(STORAGE_KEY_DEFAULT_OVERRIDES);
    } catch (e) { }
    return this.getDefaultPresetFromBundle();
  };

  PresetManager.prototype._loadLocalStorageMap = function () {
    try {
      var raw = localStorage.getItem(STORAGE_KEY_USER_PRESETS);
      if (raw) {
        var map = JSON.parse(raw);
        if (map && typeof map === "object") return map;
      }
    } catch (e) { }
    return {};
  };

  PresetManager.prototype._saveLocalStorageMap = function (map) {
    try {
      localStorage.setItem(STORAGE_KEY_USER_PRESETS, JSON.stringify(map || {}));
    } catch (e) { }
  };

  PresetManager.prototype.listPresets = function () {
    // Cache em memória: a listagem faz readdirSync + readFileSync de TODOS os
    // presets e era repetida a cada foco de janela/sincronização de UI.
    if (this._presetListCache) return this._presetListCache;

    var result = [
      {
        presetName: DEFAULT_PRESET_NAME,
        isBuiltIn: true
      }
    ];
    var seen = {};
    seen[DEFAULT_PRESET_NAME.toLowerCase()] = true;

    // 1. Ler do diretório de presets do usuário no disco
    var dir = this.getPresetsFolderPath();
    if (dir && this.fs && this.path) {
      try {
        var files = this.fs.readdirSync(dir);
        for (var i = 0; i < files.length; i++) {
          var file = files[i];
          if (/\.json$/i.test(file)) {
            var fullPath = this.path.join(dir, file);
            try {
              var data = JSON.parse(this.fs.readFileSync(fullPath, "utf8"));
              if (data && data.presetName && !seen[String(data.presetName).toLowerCase()]) {
                seen[String(data.presetName).toLowerCase()] = true;
                result.push({
                  presetName: String(data.presetName),
                  isBuiltIn: false,
                  filePath: fullPath
                });
              }
            } catch (readErr) { }
          }
        }
      } catch (dirErr) { }
    }

    // 2. Fallback do localStorage: só quando o disco não está acessível.
    // (Cada painel tem seu próprio localStorage; com o disco acessível, a pasta é a fonte única da verdade.)
    var diskOk = Boolean(dir && this.fs && this.path);
    var localMap = this._loadLocalStorageMap();
    for (var key in localMap) {
      if (localMap.hasOwnProperty(key)) {
        var p = localMap[key];
        if (diskOk) continue;
        if (p && p.presetName && !seen[String(p.presetName).toLowerCase()]) {
          seen[String(p.presetName).toLowerCase()] = true;
          result.push({
            presetName: String(p.presetName),
            isBuiltIn: false
          });
        }
      }
    }
    if (diskOk) {
      // Remove "fantasmas" (presets excluídos em outro painel)
      var cleaned = false;
      for (var k2 in localMap) {
        if (localMap.hasOwnProperty(k2) && !seen[String(k2).toLowerCase()]) {
          delete localMap[k2];
          cleaned = true;
        }
      }
      if (cleaned) this._saveLocalStorageMap(localMap);
    }

    this._presetListCache = result;
    return result;
  };

  PresetManager.prototype.loadPreset = function (presetName) {
    // Cache por preset: evita reler do disco a cada sincronização/foco de janela.
    // Invalidado por savePreset/deletePreset/importPreset e pelo evento de presets atualizados.
    var cacheKey = String(presetName || DEFAULT_PRESET_NAME).toLowerCase();
    if (this._presetObjectCache[cacheKey]) {
      return this._presetObjectCache[cacheKey];
    }
    var resolved = this._loadPresetFromDiskOrMemory(presetName);
    this._presetObjectCache[cacheKey] = resolved;
    return resolved;
  };

  PresetManager.prototype._loadPresetFromDiskOrMemory = function (presetName) {
    if (!presetName || presetName === DEFAULT_PRESET_NAME) {
      return this.getDefaultPreset();
    }

    var dir = this.getPresetsFolderPath();
    if (dir && this.fs && this.path) {
      try {
        // Atalho: usa o caminho já indexado em cache (evita readdir + leitura de todos os arquivos)
        var indexedFile = this._findIndexedPresetFilePath(presetName);
        if (indexedFile && this.fs.existsSync(indexedFile)) {
          var indexedParsed = JSON.parse(this.fs.readFileSync(indexedFile, "utf8"));
          return normalizePreset(indexedParsed);
        }

        var expectedFile = this.path.join(dir, sanitizeFileName(presetName) + ".json");
        if (this.fs.existsSync(expectedFile)) {
          var parsed = JSON.parse(this.fs.readFileSync(expectedFile, "utf8"));
          return normalizePreset(parsed);
        }
        // Procurar por presetName interno caso o nome do arquivo seja diferente
        var files = this.fs.readdirSync(dir);
        for (var i = 0; i < files.length; i++) {
          if (/\.json$/i.test(files[i])) {
            var full = this.path.join(dir, files[i]);
            try {
              var item = JSON.parse(this.fs.readFileSync(full, "utf8"));
              if (item && String(item.presetName).toLowerCase() === String(presetName).toLowerCase()) {
                return normalizePreset(item);
              }
            } catch (err2) { }
          }
        }
      } catch (e) { }
    }

    var localMap = this._loadLocalStorageMap();
    if (!(dir && this.fs && this.path) && localMap[presetName]) {
      return normalizePreset(localMap[presetName]);
    }

    return this.getDefaultPreset();
  };

  // Índice em memória: nome do preset -> caminho do arquivo (populado por listPresets)
  PresetManager.prototype._findIndexedPresetFilePath = function (presetName) {
    if (!this._presetListCache) return null;
    var target = String(presetName || "").toLowerCase();
    for (var i = 0; i < this._presetListCache.length; i++) {
      var entry = this._presetListCache[i];
      if (entry && entry.filePath && String(entry.presetName).toLowerCase() === target) {
        return entry.filePath;
      }
    }
    return null;
  };

  // Descarta listagem + objetos em cache (mudança estrutural: salvar/excluir/importar/evento)
  PresetManager.prototype.invalidatePresetCache = function () {
    this._presetListCache = null;
    this._presetObjectCache = {};
  };

  // Descarta apenas os objetos em cache (mantém a listagem; usado em re-sincronização leve)
  PresetManager.prototype.invalidatePresetObjectCache = function () {
    this._presetObjectCache = {};
  };

  PresetManager.prototype.getActivePresetName = function () {
    try {
      var saved = localStorage.getItem(STORAGE_KEY_ACTIVE);
      if (saved) {
        var list = this.listPresets();
        for (var i = 0; i < list.length; i++) {
          if (list[i].presetName === saved) {
            return saved;
          }
        }
      }
    } catch (e) { }
    return DEFAULT_PRESET_NAME;
  };

  PresetManager.prototype.setActivePresetName = function (presetName) {
    var nameToSave = presetName || DEFAULT_PRESET_NAME;
    try {
      localStorage.setItem(STORAGE_KEY_ACTIVE, nameToSave);
    } catch (e) { }
    this.notifyPresetsUpdated(nameToSave);
  };

  PresetManager.prototype.getActivePreset = function () {
    var activeName = this.getActivePresetName();
    return this.loadPreset(activeName);
  };

  // Assinatura da árvore do preset Default de fábrica (memoizada: o bundle só
  // muda com atualização da extensão e savePreset é chamado a cada toggle).
  PresetManager.prototype._getDefaultTreeSignature = function () {
    if (this._defaultTreeSignature !== undefined) return this._defaultTreeSignature;
    var signature = null;
    try {
      var base = this.getDefaultPresetFromBundle();
      signature = buildTreeSignature(normalizePreset(base).tree);
    } catch (e) {
      signature = null;
    }
    this._defaultTreeSignature = signature;
    return signature;
  };

  // Retorna o aviso pendente (e limpa), para a UI mostrar uma única vez.
  PresetManager.prototype.consumeSaveWarning = function () {
    var warning = this.lastSaveWarning || null;
    this.lastSaveWarning = null;
    return warning;
  };

  PresetManager.prototype.savePreset = function (presetObj) {
    var normalized = normalizePreset(presetObj);
    this.lastSaveWarning = null;

    if (normalized.presetName === DEFAULT_PRESET_NAME) {
      // O preset Default não tem sua árvore sobrescrita, mas as preferências
      // (globais e a regra por pasta "Pasta de Origem") precisam persistir.
      //
      // Atenção: qualquer outra mudança de árvore seria DESCARTADA em silêncio
      // (o preset pareceria salvo e a estrutura voltaria ao padrão ao reabrir).
      // Detecta esse caso e devolve um aviso para a UI em vez de perder o
      // trabalho do usuário sem explicação.
      var factorySignature = this._getDefaultTreeSignature();
      if (factorySignature !== null && buildTreeSignature(normalized.tree) !== factorySignature) {
        this.lastSaveWarning =
          "A árvore do preset '" + DEFAULT_PRESET_NAME + "' é protegida: apenas as opções e a regra " +
          "'Pasta de Origem' foram salvas. Use 'Salvar Novo' para gravar mudanças de estrutura.";
        logWarn("PresetManager.savePreset", this.lastSaveWarning, normalized.presetName);
      }

      var defaultOverrides = {};
      for (var k = 0; k < DEFAULT_OVERRIDE_SETTING_KEYS.length; k++) {
        var settingsKey = DEFAULT_OVERRIDE_SETTING_KEYS[k];
        defaultOverrides[settingsKey] = normalized.settings[settingsKey];
      }
      defaultOverrides.nodeGroupBySourceFolder = collectNodeGroupBySourceFolder(normalized.tree);
      try {
        localStorage.setItem(STORAGE_KEY_DEFAULT_OVERRIDES, JSON.stringify(defaultOverrides));
      } catch (e) { }
      this.notifyPresetsUpdated(DEFAULT_PRESET_NAME);
      return normalized;
    }

    normalized.isBuiltIn = false;

    // 1. Salvar em disco via Node.js
    var diskWriteFailed = false;
    var dir = this.getPresetsFolderPath();
    if (dir && this.fs && this.path) {
      try {
        var filePath = this.path.join(dir, sanitizeFileName(normalized.presetName) + ".json");
        this.fs.writeFileSync(filePath, JSON.stringify(normalized, null, 2), "utf8");
        this.lastSaveError = null;
      } catch (e) {
        // Falha de escrita NAO pode passar em silencio: o usuario perderia o preset
        diskWriteFailed = true;
        this.lastSaveError = "Nao foi possivel gravar o preset em disco: " + (e && e.message ? e.message : e);
        logError("PresetManager.savePreset", this.lastSaveError, e);
      }
    } else {
      this.lastSaveError = null;
      logWarn("PresetManager.savePreset", "Disco indisponivel; preset salvo apenas em localStorage", normalized.presetName);
    }

    if (diskWriteFailed) {
      // Nada foi gravado: espelhar em localStorage criaria um preset "fantasma"
      // (não aparece em listPresets e não recarrega, porque o disco é a fonte da
      // verdade). Também não trocamos o preset ativo: o painel mostra o erro e
      // mantém o preset em edição marcado como não salvo.
      return normalized;
    }

    // 2. Salvar cópia em localStorage
    var map = this._loadLocalStorageMap();
    map[normalized.presetName] = normalized;
    this._saveLocalStorageMap(map);

    this.setActivePresetName(normalized.presetName);
    return normalized;
  };

  PresetManager.prototype.deletePreset = function (presetName) {
    if (!presetName || presetName === DEFAULT_PRESET_NAME) {
      throw new Error("O preset padrão de fábrica não pode ser excluído.");
    }

    var dir = this.getPresetsFolderPath();
    var dirsToClean = [];
    if (dir && this.fs && this.path) {
      dirsToClean.push(dir);
      try {
        // Pasta legada também precisa ser limpa, senão a migração recopia o arquivo
        var userData = this.csInterface.getSystemPath(SystemPath.USER_DATA);
        dirsToClean.push(this.path.join(userData, "AE_Organizer", "presets"));
      } catch (eOld) { }
    }
    for (var d = 0; d < dirsToClean.length; d++) {
      var targetDir = dirsToClean[d];
      try {
        if (!this.fs.existsSync(targetDir)) continue;
        var files = this.fs.readdirSync(targetDir);
        for (var i = 0; i < files.length; i++) {
          if (/\.json$/i.test(files[i])) {
            var full = this.path.join(targetDir, files[i]);
            try {
              var item = JSON.parse(this.fs.readFileSync(full, "utf8"));
              var matchesName = item && String(item.presetName).toLowerCase() === String(presetName).toLowerCase();
              var matchesFile = files[i].toLowerCase() === (sanitizeFileName(presetName) + ".json").toLowerCase();
              if (matchesName || matchesFile) {
                this.fs.unlinkSync(full);
              }
            } catch (e2) {
              logWarn("PresetManager.deletePreset", "Falha ao remover arquivo de preset", e2);
            }
          }
        }
      } catch (e) { }
    }

    var map = this._loadLocalStorageMap();
    if (map[presetName]) {
      delete map[presetName];
      this._saveLocalStorageMap(map);
    }

    if (this.getActivePresetName() === presetName) {
      this.setActivePresetName(DEFAULT_PRESET_NAME);
    } else {
      this.notifyPresetsUpdated(this.getActivePresetName());
    }
    return true;
  };

  PresetManager.prototype.exportPresetToFile = function (presetObj, targetFilePath) {
    if (!this.fs) {
      throw new Error("Sistema de arquivos indisponível.");
    }
    var normalized = normalizePreset(presetObj);
    this.fs.writeFileSync(targetFilePath, JSON.stringify(normalized, null, 2), "utf8");
    return true;
  };

  PresetManager.prototype.presetExists = function (presetName) {
    var target = String(presetName || "").trim().toLowerCase();
    if (!target) return false;
    var list = this.listPresets();
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].presetName || "").toLowerCase() === target) return true;
    }
    return false;
  };

  // Sobrescrever um preset é destrutivo: por padrão a importação NÃO sobrescreve.
  // O chamador confirma com o usuário e repete a chamada com { overwrite: true }.
  PresetManager.prototype.importPresetFromJsonString = function (jsonStr, options) {
    var opts = options || {};
    var parsed = JSON.parse(jsonStr);
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.tree)) {
      throw new Error("Arquivo JSON inválido: propriedade 'tree' não encontrada.");
    }
    if (!parsed.presetName || parsed.presetName === DEFAULT_PRESET_NAME) {
      parsed.presetName = (parsed.presetName || "Preset Importado") + " (Importado)";
    }
    parsed.isBuiltIn = false;

    if (opts.overwrite !== true && this.presetExists(parsed.presetName)) {
      var existingErr = new Error("Já existe um preset chamado '" + parsed.presetName + "'.");
      existingErr.code = "PRESET_EXISTS";
      existingErr.presetName = parsed.presetName;
      throw existingErr;
    }

    return this.savePreset(parsed);
  };

  PresetManager.prototype.openPresetsFolder = function () {
    var dir = this.getPresetsFolderPath();
    if (!dir) {
      return false;
    }

    try {
      if (this.childProcess) {
        var isWin = navigator.platform.toLowerCase().indexOf("win") !== -1;
        if (isWin) {
          this.childProcess.exec('explorer "' + dir.replace(/\//g, "\\") + '"');
          return true;
        } else {
          this.childProcess.exec('open "' + dir + '"');
          return true;
        }
      }
    } catch (e) { }

    return false;
  };

  PresetManager.prototype.setActivePresetNameSilent = function (presetName) {
    try {
      localStorage.setItem(STORAGE_KEY_ACTIVE, presetName || DEFAULT_PRESET_NAME);
    } catch (e) { }
  };

  PresetManager.prototype.notifyPresetsUpdated = function (activePresetName) {
    // O preset acabou de mudar: qualquer cache local fica obsoleto
    this.invalidatePresetCache();

    try {
      if (global.opener && typeof global.opener.onPresetBuilderUpdated === "function") {
        global.opener.onPresetBuilderUpdated(activePresetName || this.getActivePresetName());
      }
    } catch (e0) { }
    try {
      if (global.parent && global.parent !== global && typeof global.parent.onPresetBuilderUpdated === "function") {
        global.parent.onPresetBuilderUpdated(activePresetName || this.getActivePresetName());
      }
    } catch (eParent) { }
    try {
      if (this.csInterface && typeof CSEvent !== "undefined") {
        var evt = new CSEvent("com.tidyflow.presetsUpdated", "APPLICATION");
        evt.data = JSON.stringify({ activePreset: activePresetName || this.getActivePresetName() });
        this.csInterface.dispatchEvent(evt);
      }
    } catch (e) { }
  };

  PresetManager.prototype.createEmptyNode = function (name, label, useNumbering) {
    return {
      id: "node_" + Date.now() + "_" + Math.floor(Math.random() * 10000),
      name: name || "Nova Pasta",
      label: label !== undefined ? label : 0,
      useNumbering: useNumbering !== undefined ? Boolean(useNumbering) : true,
      rules: {
        types: [],
        extensions: [],
        groupByMainComp: false,
        handlePsdBundles: false,
        groupSubfoldersByExt: false,
        groupBySourceFolder: true,
        sourceFolderMode: "both",
        catchOthers: false,
        nameFilter: "",
        nameFilterMode: "contains"
      },
      children: []
    };
  };

  PresetManager.prototype.clonePreset = function (presetObj) {
    return deepClone(normalizePreset(presetObj));
  };

  global.PresetManager = PresetManager;
})(window);

