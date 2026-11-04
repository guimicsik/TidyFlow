(function (global) {
  "use strict";

  var DEFAULT_PRESET_NAME = "Default Clean";
  var STORAGE_KEY_ACTIVE = "ae_organizer_active_preset";
  var STORAGE_KEY_USER_PRESETS = "ae_organizer_user_presets_map";
  var STORAGE_KEY_DEFAULT_OVERRIDES = "ae_organizer_default_settings";

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
        "unusedFolderName": "Nunca Usadas"
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

    return {
      id: (node && node.id) ? String(node.id) : ("node_" + Date.now() + "_" + indexSeed),
      name: (node && node.name && String(node.name).trim()) ? String(node.name).trim() : "Nova Pasta",
      label: labelNum,
      useNumbering: (node && node.useNumbering !== undefined) ? Boolean(node.useNumbering) : true,
      rules: {
        types: cleanTypes,
        extensions: cleanExts,
        groupByMainComp: Boolean(rules.groupByMainComp),
        handlePsdBundles: Boolean(rules.handlePsdBundles),
        groupSubfoldersByExt: Boolean(rules.groupSubfoldersByExt),
        groupBySourceFolder: rules.groupBySourceFolder !== undefined ? Boolean(rules.groupBySourceFolder) : true,
        catchOthers: Boolean(rules.catchOthers),
        nameFilter: rules.nameFilter ? String(rules.nameFilter) : "",
        nameFilterMode: rules.nameFilterMode === "regex" ? "regex" : "contains"
      },
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
        groupBySourceFolder: s.groupBySourceFolder !== undefined ? Boolean(s.groupBySourceFolder) : true,
        unusedFolderName: (s.unusedFolderName && String(s.unusedFolderName).trim()) ? String(s.unusedFolderName).trim() : "Nunca Usadas"
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
  }

  PresetManager.AE_LABELS = AE_LABELS;
  PresetManager.PPRO_LABELS = PPRO_LABELS_ORDERED;
  PresetManager.PPRO_LABELS_BY_SLOT = PPRO_LABELS_BY_SLOT;
  PresetManager.DEFAULT_PRESET_NAME = DEFAULT_PRESET_NAME;
  PresetManager.DEFAULT_EXTENSIONS = DEFAULT_EXTENSIONS;
  PresetManager.DEFAULT_EXTENSIONS_AE = DEFAULT_EXTENSIONS_AE;
  PresetManager.DEFAULT_EXTENSIONS_PPRO = DEFAULT_EXTENSIONS_PPRO;

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
    } catch (e) {}
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
    if (!this.csInterface || !this.path) return null;
    try {
      var userData = this.csInterface.getSystemPath(SystemPath.USER_DATA);
      if (!userData) return null;
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
          try { migrated = localStorage.getItem("ae_organizer_presets_migrated") === "1"; } catch (eFlag) {}
          if (!migrated) {
            try { localStorage.setItem("ae_organizer_presets_migrated", "1"); } catch (eFlag2) {}
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
        } catch (migErr) {}
      }
      return folder;
    } catch (e) {
      return null;
    }
  };

  PresetManager.prototype.getDefaultPresetFromBundle = function () {
    try {
      if (this.csInterface && this.fs && this.path) {
        var extPath = this.csInterface.getSystemPath(SystemPath.EXTENSION);
        var presetFileName = this.isPremierePro() ? "default_preset_ppro.json" : "default_preset.json";
        var defaultFilePath = this.path.join(extPath, "client", "presets", presetFileName);
        if (this.fs.existsSync(defaultFilePath)) {
          var raw = this.fs.readFileSync(defaultFilePath, "utf8");
          var parsed = JSON.parse(raw);
          return normalizePreset(parsed);
        }
        // Fallback para default_preset.json genérico
        var fallbackPath = this.path.join(extPath, "client", "presets", "default_preset.json");
        if (this.fs.existsSync(fallbackPath)) {
          var rawFb = this.fs.readFileSync(fallbackPath, "utf8");
          var parsedFb = JSON.parse(rawFb);
          return normalizePreset(parsedFb);
        }
      }
    } catch (e) {}
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
        }
      }
    } catch (e) {}
    return base;
  };

  PresetManager.prototype.resetDefaultPreset = function () {
    try {
      localStorage.removeItem(STORAGE_KEY_DEFAULT_OVERRIDES);
    } catch (e) {}
    return this.getDefaultPresetFromBundle();
  };

  PresetManager.prototype._loadLocalStorageMap = function () {
    try {
      var raw = localStorage.getItem(STORAGE_KEY_USER_PRESETS);
      if (raw) {
        var map = JSON.parse(raw);
        if (map && typeof map === "object") return map;
      }
    } catch (e) {}
    return {};
  };

  PresetManager.prototype._saveLocalStorageMap = function (map) {
    try {
      localStorage.setItem(STORAGE_KEY_USER_PRESETS, JSON.stringify(map || {}));
    } catch (e) {}
  };

  PresetManager.prototype.listPresets = function () {
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
            } catch (readErr) {}
          }
        }
      } catch (dirErr) {}
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

    return result;
  };

  PresetManager.prototype.loadPreset = function (presetName) {
    if (!presetName || presetName === DEFAULT_PRESET_NAME) {
      return this.getDefaultPreset();
    }

    var dir = this.getPresetsFolderPath();
    if (dir && this.fs && this.path) {
      try {
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
            } catch (err2) {}
          }
        }
      } catch (e) {}
    }

    var localMap = this._loadLocalStorageMap();
    if (!(dir && this.fs && this.path) && localMap[presetName]) {
      return normalizePreset(localMap[presetName]);
    }

    return this.getDefaultPreset();
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
    } catch (e) {}
    return DEFAULT_PRESET_NAME;
  };

  PresetManager.prototype.setActivePresetName = function (presetName) {
    var nameToSave = presetName || DEFAULT_PRESET_NAME;
    try {
      localStorage.setItem(STORAGE_KEY_ACTIVE, nameToSave);
    } catch (e) {}
    this.notifyPresetsUpdated(nameToSave);
  };

  PresetManager.prototype.getActivePreset = function () {
    var activeName = this.getActivePresetName();
    return this.loadPreset(activeName);
  };

  PresetManager.prototype.savePreset = function (presetObj) {
    var normalized = normalizePreset(presetObj);

    if (normalized.presetName === DEFAULT_PRESET_NAME) {
      // O preset Default não tem sua árvore sobrescrita, mas salvamos preferências de toggle se o usuário mudar no painel
      try {
        localStorage.setItem(STORAGE_KEY_DEFAULT_OVERRIDES, JSON.stringify(normalized.settings));
      } catch (e) {}
      this.notifyPresetsUpdated(DEFAULT_PRESET_NAME);
      return normalized;
    }

    normalized.isBuiltIn = false;

    // 1. Salvar em disco via Node.js
    var dir = this.getPresetsFolderPath();
    if (dir && this.fs && this.path) {
      try {
        var filePath = this.path.join(dir, sanitizeFileName(normalized.presetName) + ".json");
        this.fs.writeFileSync(filePath, JSON.stringify(normalized, null, 2), "utf8");
      } catch (e) {}
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
      } catch (eOld) {}
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
            } catch (e2) {}
          }
        }
      } catch (e) {}
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

  PresetManager.prototype.importPresetFromJsonString = function (jsonStr) {
    var parsed = JSON.parse(jsonStr);
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.tree)) {
      throw new Error("Arquivo JSON inválido: propriedade 'tree' não encontrada.");
    }
    if (!parsed.presetName || parsed.presetName === DEFAULT_PRESET_NAME) {
      parsed.presetName = (parsed.presetName || "Preset Importado") + " (Importado)";
    }
    parsed.isBuiltIn = false;
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
    } catch (e) {}

    return false;
  };

  PresetManager.prototype.setActivePresetNameSilent = function (presetName) {
    try {
      localStorage.setItem(STORAGE_KEY_ACTIVE, presetName || DEFAULT_PRESET_NAME);
    } catch (e) {}
  };

  PresetManager.prototype.notifyPresetsUpdated = function (activePresetName) {
    try {
      if (global.opener && typeof global.opener.onPresetBuilderUpdated === "function") {
        global.opener.onPresetBuilderUpdated(activePresetName || this.getActivePresetName());
      }
    } catch (e0) {}
    try {
      if (global.parent && global.parent !== global && typeof global.parent.onPresetBuilderUpdated === "function") {
        global.parent.onPresetBuilderUpdated(activePresetName || this.getActivePresetName());
      }
    } catch (eParent) {}
    try {
      if (this.csInterface && typeof CSEvent !== "undefined") {
        var evt = new CSEvent("com.tidyflow.presetsUpdated", "APPLICATION");
        evt.data = JSON.stringify({ activePreset: activePresetName || this.getActivePresetName() });
        this.csInterface.dispatchEvent(evt);
      }
    } catch (e) {}
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

