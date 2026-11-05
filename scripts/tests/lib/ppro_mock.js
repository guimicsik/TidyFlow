/* ==========================================================================
   TidyFlow — Simulador mínimo do Premiere Pro (ExtendScript) para testes
   Reimplementa apenas o subconjunto da API usado por host/ppro_organizer.jsx:
     app.project.rootItem (children/createBin/deleteBin/moveBin)
     app.project.sequences, app.project.save, app.project.path
     beginUndoGroup/endUndoGroup
   Sem UI e sem timeline: sequências podem ser registradas, mas o foco aqui é
   o roteamento de mídias (bins, subpastas por papel de áudio e por extensão).
   ========================================================================== */
"use strict";

var nodeVm = require("vm");
var realFs = require("fs");
var nodePath = require("path");

var REPO_ROOT = nodePath.resolve(__dirname, "..", "..", "..");
var HOST_DIR = nodePath.join(REPO_ROOT, "host");

// Coleção 1-based (children[i]) com numItems, como no host real
function makeCollection(getArray) {
  var base = {
    get numItems() {
      return getArray().length;
    }
  };
  return new Proxy(base, {
    get: function (target, prop) {
      if (typeof prop === "string" && /^\d+$/.test(prop)) {
        return getArray()[Number(prop)] || null;
      }
      return target[prop];
    }
  });
}

function createPProMock() {
  var state = { nextId: 1, saves: 0, moves: [] };

  function Item(name, kind) {
    this.type = kind; // 1 = clip, 2 = bin, 3 = root
    this.name = String(name);
    this.nodeId = String(state.nextId++);
    this.__parent = null;
    this.__children = null;
  }

  Item.prototype.children = null; // sobrescrito abaixo por defineProperty
  Object.defineProperty(Item.prototype, "children", {
    get: function () {
      var self = this;
      if (!self.__children) return undefined;
      return makeCollection(function () {
        return self.__children;
      });
    }
  });

  Item.prototype.createBin = function (binName) {
    var created = new Item(binName, 2);
    created.__children = [];
    created.__parent = this;
    this.__children.push(created);
    return created;
  };

  Item.prototype.deleteBin = function () {
    if (!this.__parent || !this.__parent.__children) return;
    var idx = this.__parent.__children.indexOf(this);
    if (idx !== -1) this.__parent.__children.splice(idx, 1);
    this.__parent = null;
  };

  Item.prototype.moveBin = function (targetBin) {
    if (!targetBin || !targetBin.__children) throw new Error("bin de destino inválida");
    if (this.__parent && this.__parent.__children) {
      var idx = this.__parent.__children.indexOf(this);
      if (idx !== -1) this.__parent.__children.splice(idx, 1);
    }
    this.__parent = targetBin;
    targetBin.__children.push(this);
    state.moves.push({ name: this.name, target: targetBin.name });
  };

  var root = new Item("Raiz", 3);
  root.nodeId = "ROOT";
  root.__children = [];

  var selection = [];

  var project = {
    rootItem: root,
    sequences: { numSequences: 0 },
    path: "C:/projetos/teste.prproj",
    selection: selection,
    save: function () {
      state.saves++;
    }
  };

  var app = {
    project: project,
    beginUndoGroup: function () {},
    endUndoGroup: function () {}
  };

  var sandbox = {
    console: { log: function () {}, warn: function () {}, error: function () {} },
    app: app,
    JSON: JSON,
    Math: Math,
    Date: Date,
    RegExp: RegExp,
    Error: Error,
    String: String,
    Number: Number,
    Boolean: Boolean,
    Array: Array,
    Object: Object,
    parseInt: parseInt,
    parseFloat: parseFloat,
    isNaN: isNaN
  };

  // `new File(path)` como no ExtendScript: usa caminhos reais do repositório
  sandbox.File = function (filePath) {
    var normalized = String(filePath).replace(/\\/g, "/");
    this.fsName = normalized;
    this.name = normalized.substring(normalized.lastIndexOf("/") + 1);
    this.parent = { fsName: normalized.substring(0, normalized.lastIndexOf("/")) };
    this.exists = realFs.existsSync(normalized);
  };

  nodeVm.createContext(sandbox);

  sandbox.$ = {
    global: sandbox,
    fileName: nodePath.join(HOST_DIR, "ppro_organizer.jsx"),
    writeln: function () {},
    evalFile: function (fileOrPath) {
      var filePath = fileOrPath && fileOrPath.fsName ? fileOrPath.fsName : String(fileOrPath);
      var code = realFs.readFileSync(filePath, "utf8");
      nodeVm.runInContext(code, sandbox, { filename: filePath });
      return true;
    }
  };

  function addClip(name, mediaPath, parent, extraMeta) {
    var clip = new Item(name, 1);
    clip.__mediaPath = mediaPath;
    clip.__xmp = (extraMeta && extraMeta.xmp) ? String(extraMeta.xmp) : "";
    clip.__projectMeta = (extraMeta && extraMeta.projectMeta)
      ? String(extraMeta.projectMeta)
      : '<premierePrivateProjectMetaData:Column.PropertyText.Dialog></premierePrivateProjectMetaData:Column.PropertyText.Dialog>';
    clip.getMediaPath = function () {
      return clip.__mediaPath;
    };
    clip.getXMPMetadata = function () {
      return clip.__xmp;
    };
    clip.getProjectMetadata = function () {
      return clip.__projectMeta;
    };
    clip.isOffline = function () {
      return false;
    };
    clip.__parent = parent || root;
    clip.__parent.__children.push(clip);
    return clip;
  }

  function addSequenceWithAudioTracks(seqName, audioTracksSpec) {
    if (!project._seqArray) {
      project._seqArray = [];
      project.sequences = new Proxy(
        {
          get numSequences() {
            return project._seqArray.length;
          }
        },
        {
          get: function (target, prop) {
            if (typeof prop === "string" && /^\d+$/.test(prop)) {
              return project._seqArray[Number(prop)] || null;
            }
            return target[prop];
          }
        }
      );
    }

    var builtTracks = (audioTracksSpec || []).map(function (tSpec) {
      var builtClips = (tSpec.clips || []).map(function (cSpec) {
        var builtComps = (cSpec.components || []).map(function (compSpec) {
          var builtProps = (compSpec.properties || []).map(function (propSpec) {
            return {
              displayName: propSpec.displayName || "",
              getValue: function () {
                return propSpec.value;
              }
            };
          });
          return {
            matchName: compSpec.matchName || "",
            displayName: compSpec.displayName || "",
            properties: makeCollection(function () {
              return builtProps;
            })
          };
        });
        return {
          name: cSpec.name || (cSpec.projectItem && cSpec.projectItem.name) || "",
          projectItem: cSpec.projectItem || null,
          components: makeCollection(function () {
            return builtComps;
          })
        };
      });
      return {
        name: tSpec.name || "",
        clips: makeCollection(function () {
          return builtClips;
        })
      };
    });

    var seqObj = {
      id: "SEQ_" + (project._seqArray.length + 1),
      name: seqName,
      audioTracks: new Proxy(
        {
          get numTracks() {
            return builtTracks.length;
          }
        },
        {
          get: function (target, prop) {
            if (typeof prop === "string" && /^\d+$/.test(prop)) {
              return builtTracks[Number(prop)] || null;
            }
            return target[prop];
          }
        }
      ),
      videoTracks: { numTracks: 0 }
    };
    project._seqArray.push(seqObj);
    project.activeSequence = seqObj;
    return seqObj;
  }

  function addBin(binName, parent) {
    var bin = new Item(binName, 2);
    bin.__children = [];
    bin.__parent = parent || root;
    bin.__parent.__children.push(bin);
    return bin;
  }

  function pathOf(item) {
    var names = [];
    var cur = item && item.__parent ? item.__parent : null;
    while (cur && cur !== root) {
      names.unshift(cur.name);
      cur = cur.__parent;
    }
    return names.join("/");
  }

  return {
    sandbox: sandbox,
    state: state,
    root: root,
    evalEngine: function () {
      return sandbox.$.evalFile(nodePath.join(HOST_DIR, "ppro_organizer.jsx"));
    },
    organize: function (preset) {
      return sandbox.$.global.ppro_organizeWithPreset("media_only", JSON.stringify(preset));
    },
    createPresetStructure: function (preset) {
      return sandbox.$.global.ppro_createPresetFolderStructure(JSON.stringify(preset));
    },
    addClip: addClip,
    addBin: addBin,
    addSequenceWithAudioTracks: addSequenceWithAudioTracks,
    pathOf: pathOf,
    find: function (name, parent) {
      var scope = parent || root;
      for (var i = 0; i < scope.__children.length; i++) {
        if (scope.__children[i].name === name) return scope.__children[i];
      }
      return null;
    },
    tree: function (bin) {
      var scope = bin || root;
      var out = [];
      for (var i = 0; i < scope.__children.length; i++) {
        var child = scope.__children[i];
        out.push(child.type === 2
          ? { name: child.name, children: this.tree(child) }
          : { name: child.name });
      }
      return out;
    }
  };
}

module.exports = { createPProMock: createPProMock, REPO_ROOT: REPO_ROOT };
