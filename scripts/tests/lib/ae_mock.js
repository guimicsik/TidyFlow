/* ==========================================================================
   TidyFlow — Simulador do After Effects (ExtendScript) para testes do host
   --------------------------------------------------------------------------
   Reimplementa o subconjunto da API do AE realmente usado por host/*.jsx:
     app.project (numItems/item/items.addFolder/rootFolder/selection/save/file)
     FolderItem / CompItem / FootageItem / SolidSource / FileSource / File
   Comportamentos fiéis que interessam aos testes:
     - item removido ("Object is invalid"): qualquer acesso a name/numItems lança
     - numItems conta apenas os filhos diretos da pasta
     - app.project.item(i) é 1-based sobre a lista viva de itens
   ========================================================================== */
"use strict";

var nodeVm = require("vm");
var realFs = require("fs");
var nodePath = require("path");

var REPO_ROOT = nodePath.resolve(__dirname, "..", "..", "..");
var HOST_DIR = nodePath.join(REPO_ROOT, "host");

function normalizePath(p) {
  return String(p).replace(/\\/g, "/");
}

function createAeMock(options) {
  options = options || {};

  var state = {
    items: [],
    nextId: 1,
    undoGroups: [],
    saveCount: 0,
    reduceCalls: 0,
    // Pastas onde a movimentação de itens falha silenciosamente (item travado / bloqueado)
    silentMoveFail: options.silentMoveFail || {},
    moveAttempts: 0
  };

  function invalidObject() {
    var err = new Error("Object is invalid");
    err.aeInvalid = true;
    throw err;
  }

  function assertAlive(self) {
    if (self.__removed) invalidObject();
  }

  function ProjectItem(name, kind) {
    this.__kind = kind;
    this.__removed = false;
    this.__name = String(name);
    this.__parent = null;
    this.id = state.nextId++;
    this.nodeId = undefined;
    this.label = 0;
    this.comment = "";
    state.items.push(this);
  }

  ProjectItem.prototype.__moveTo = function (targetFolder) {
    if (!targetFolder) return;
    if (this.__parent === targetFolder) return;
    state.moveAttempts++;
    if (this.__kind !== "folder" && state.silentMoveFail[targetFolder.__name] === true) {
      // Simula item travado: o host "aceita" a atribuição mas o item não se move
      return;
    }
    if (this.__parent) {
      var currentChildren = this.__parent.__children;
      var idx = currentChildren.indexOf(this);
      if (idx !== -1) currentChildren.splice(idx, 1);
    }
    this.__parent = targetFolder;
    targetFolder.__children.push(this);
  };

  ProjectItem.prototype.__removeRecursive = function () {
    if (this.__kind === "folder") {
      var kids = this.__children.slice();
      for (var k = 0; k < kids.length; k++) kids[k].__removeRecursive();
    }
    if (this.__parent && this.__parent.__children) {
      var idx = this.__parent.__children.indexOf(this);
      if (idx !== -1) this.__parent.__children.splice(idx, 1);
    }
    this.__parent = null;
    this.__removed = true;
    var pos = state.items.indexOf(this);
    if (pos !== -1) state.items.splice(pos, 1);
  };

  ProjectItem.prototype.remove = function () {
    assertAlive(this);
    this.__removeRecursive();
  };

  Object.defineProperty(ProjectItem.prototype, "name", {
    get: function () {
      assertAlive(this);
      return this.__name;
    },
    set: function (value) {
      assertAlive(this);
      this.__name = String(value);
    }
  });

  Object.defineProperty(ProjectItem.prototype, "parentFolder", {
    get: function () {
      assertAlive(this);
      return this.__parent;
    },
    set: function (value) {
      assertAlive(this);
      this.__moveTo(value);
    }
  });

  function FolderItem(name) {
    ProjectItem.call(this, name, "folder");
    this.__children = [];
  }
  FolderItem.prototype = Object.create(ProjectItem.prototype);
  FolderItem.prototype.constructor = FolderItem;
  Object.defineProperty(FolderItem.prototype, "numItems", {
    get: function () {
      assertAlive(this);
      return this.__children.length;
    }
  });
  FolderItem.prototype.item = function (index) {
    assertAlive(this);
    return this.__children[index - 1] || null;
  };
  // children explícitos (usado por isInsideFolder / rollback no engine)
  Object.defineProperty(FolderItem.prototype, "children", {
    get: function () {
      assertAlive(this);
      return this.__children;
    }
  });

  function CompItem(name) {
    ProjectItem.call(this, name, "comp");
    this.__layers = [];
  }
  CompItem.prototype = Object.create(ProjectItem.prototype);
  CompItem.prototype.constructor = CompItem;
  Object.defineProperty(CompItem.prototype, "numLayers", {
    get: function () {
      assertAlive(this);
      return this.__layers.length;
    }
  });
  CompItem.prototype.layer = function (index) {
    assertAlive(this);
    return this.__layers[index - 1] || null;
  };
  CompItem.prototype.__addSourceLayer = function (sourceItem) {
    this.__layers.push({ source: sourceItem });
  };

  function makeFile(filePath) {
    var normalized = normalizePath(filePath);
    var name = normalized.substring(normalized.lastIndexOf("/") + 1);
    return {
      fsName: normalized,
      name: name,
      displayName: name,
      path: normalized.substring(0, normalized.lastIndexOf("/"))
    };
  }

  function FileSource(filePath, isStill) {
    this.file = makeFile(filePath);
    this.isStill = isStill !== false;
  }

  function SolidSource() {
    this.name = "Solid";
  }

  function FootageItem(name, filePath, opts) {
    ProjectItem.call(this, name, "footage");
    opts = opts || {};
    this.mainSource = opts.solid ? new SolidSource() : new FileSource(filePath, opts.isStill);
    this.hasVideo = opts.hasVideo !== undefined ? opts.hasVideo : true;
    this.hasAudio = opts.hasAudio !== undefined ? opts.hasAudio : false;
    this.duration = opts.duration !== undefined ? opts.duration : 10;
    this.frameRate = opts.frameRate !== undefined ? opts.frameRate : 25;
  }
  FootageItem.prototype = Object.create(ProjectItem.prototype);
  FootageItem.prototype.constructor = FootageItem;
  Object.defineProperty(FootageItem.prototype, "file", {
    get: function () {
      assertAlive(this);
      return this.mainSource && this.mainSource.file ? this.mainSource.file : null;
    }
  });

  var rootFolder = new FolderItem("Raiz");
  rootFolder.id = 0;

  var selection = [];
  var projectFile = options.projectFile !== undefined
    ? (options.projectFile ? makeFile(options.projectFile) : null)
    : makeFile("C:/projetos/teste.aep");

  var project = {
    rootFolder: rootFolder,
    file: projectFile,
    selection: selection
  };

  Object.defineProperty(project, "numItems", {
    get: function () {
      return state.items.length;
    }
  });

  project.item = function (index) {
    return state.items[index - 1] || null;
  };

  project.save = function () {
    state.saveCount++;
  };

  project.reduceProject = function () {
    state.reduceCalls++;
    return options.reduceRemovedCount || 0;
  };

  var itemsCollection = {
    get length() {
      return state.items.length;
    },
    addFolder: function (name) {
      var created = new FolderItem(name);
      created.__moveTo(rootFolder);
      return created;
    }
  };
  // Acesso 1-based (app.project.items[1]) como no AE real
  var itemsProxy = new Proxy(itemsCollection, {
    get: function (target, prop) {
      if (typeof prop === "string" && /^\d+$/.test(prop)) {
        return state.items[Number(prop) - 1] || null;
      }
      return target[prop];
    }
  });
  project.items = itemsProxy;

  var app = {
    project: project,
    beginUndoGroup: function (name) {
      state.undoGroups.push({ name: name, open: true });
    },
    endUndoGroup: function () {
      if (state.undoGroups.length) {
        state.undoGroups[state.undoGroups.length - 1].open = false;
      }
    }
  };

  var sandbox = {
    console: { log: function () {}, warn: function () {}, error: function () {} },
    app: app,
    FolderItem: FolderItem,
    CompItem: CompItem,
    FootageItem: FootageItem,
    SolidSource: SolidSource,
    FileSource: FileSource,
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
    isNaN: isNaN,
    encodeURIComponent: encodeURIComponent,
    decodeURIComponent: decodeURIComponent
  };

  sandbox.File = function (filePath) {
    var normalized = normalizePath(String(filePath));
    var isDirLike = normalized.indexOf(".") === -1 || /\/(host|client)$/.test(normalized);
    this.fsName = normalized;
    this.name = normalized.substring(normalized.lastIndexOf("/") + 1);
    this.parent = { fsName: normalized.substring(0, normalized.lastIndexOf("/")) };
    this.exists = isDirLike ? realFs.existsSync(normalized) : realFs.existsSync(normalized);
  };

  nodeVm.createContext(sandbox);

  sandbox.$ = {
    global: sandbox,
    fileName: nodePath.join(HOST_DIR, "aeft_organizer.jsx"),
    writeln: function () {},
    evalFile: function (fileOrPath) {
      var filePath = fileOrPath && fileOrPath.fsName ? fileOrPath.fsName : String(fileOrPath);
      var code = realFs.readFileSync(filePath, "utf8");
      nodeVm.runInContext(code, sandbox, { filename: filePath });
      return true;
    }
  };

  var api = {
    state: state,
    rootFolder: rootFolder,

    addFolder: function (name, parent) {
      var folder = new FolderItem(name);
      folder.__moveTo(parent || rootFolder);
      return folder;
    },
    addComp: function (name, parent) {
      var comp = new CompItem(name);
      comp.__moveTo(parent || rootFolder);
      return comp;
    },
    addFootage: function (name, filePath, opts, parent) {
      var footage = new FootageItem(name, filePath, opts);
      footage.__moveTo(parent || rootFolder);
      return footage;
    },
    addSolid: function (name, parent) {
      var solid = new FootageItem(name, null, { solid: true });
      solid.__moveTo(parent || rootFolder);
      return solid;
    },
    addLayer: function (comp, sourceItem) {
      comp.__addSourceLayer(sourceItem);
    },
    select: function (list) {
      selection.length = 0;
      for (var i = 0; i < list.length; i++) selection.push(list[i]);
    },
    find: function (name, parent) {
      var scope = parent || rootFolder;
      for (var i = 0; i < scope.__children.length; i++) {
        if (scope.__children[i].__name === name) return scope.__children[i];
      }
      return null;
    },
    findDeep: function (name) {
      for (var i = 0; i < state.items.length; i++) {
        if (state.items[i].__name === name) return state.items[i];
      }
      return null;
    },
    // Estrutura aninhada de nomes (para asserções legíveis)
    tree: function (folder) {
      var scope = folder || rootFolder;
      var out = [];
      for (var i = 0; i < scope.__children.length; i++) {
        var child = scope.__children[i];
        out.push(child.__kind === "folder"
          ? { name: child.__name, kind: "folder", children: api.tree(child) }
          : { name: child.__name, kind: child.__kind });
      }
      return out;
    },
    folderNames: function (parent) {
      return api.tree(parent).map(function (entry) {
        return entry.name + "/" + entry.kind;
      });
    },
    countFolders: function () {
      return state.items.filter(function (it) {
        return it.__kind === "folder";
      }).length;
    },
    silentMoveFailFor: function (folderName, enabled) {
      state.silentMoveFail[folderName] = enabled !== false;
    }
  };

  return {
    sandbox: sandbox,
    app: app,
    api: api,
    state: state,
    evalHostFile: function (fileName) {
      return sandbox.$.evalFile(nodePath.join(HOST_DIR, fileName));
    },
    organize: function (mainCompArg, presetJsonString) {
      return sandbox.$.global.aeft_organizeWithPreset(mainCompArg, presetJsonString);
    },
    global: function () {
      return sandbox.$.global;
    }
  };
}

module.exports = { createAeMock: createAeMock, REPO_ROOT: REPO_ROOT };
