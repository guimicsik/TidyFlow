/* ==========================================================================
   TidyFlow — Ambiente de cliente (CEP/Chromium) simulado em Node
   Carrega client/PresetManager.js dentro de um contexto vm com:
     - localStorage em memória
     - cep_node.require("fs"|"path") apontando para mocks
     - csInterface falso (getSystemPath / getHostEnvironment / dispatchEvent)
   ========================================================================== */
"use strict";

var nodeVm = require("vm");
var nodeFs = require("fs");
var nodePath = require("path");
var mockFsLib = require("./mock_fs");

var REPO_ROOT = nodePath.resolve(__dirname, "..", "..", "..");

function loadPresetManager(options) {
  options = options || {};

  var appId = options.appId || "AEFT";
  var mockFs = options.mockFs || mockFsLib.createMockFs();
  var localStorage = options.localStorage || mockFsLib.createMockLocalStorage();
  var userDataPath = options.userDataPath || "C:/AppData";
  var extensionPath = options.extensionPath || nodePath.join(REPO_ROOT, "client");
  var logEntries = [];

  var sandbox = {};
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.console = options.console || { log: function () {}, warn: function () {}, error: function () {} };
  sandbox.JSON = JSON;
  sandbox.Math = Math;
  sandbox.Date = Date;
  sandbox.navigator = { platform: "Win32" };
  sandbox.localStorage = localStorage;
  sandbox.SystemPath = {
    USER_DATA: "userData",
    EXTENSION: "extension",
    MY_DOCUMENTS: "myDocuments",
    DESKTOP: "desktop"
  };
  sandbox.cep_node = {
    require: function (name) {
      if (name === "fs") return mockFs.fs;
      if (name === "path") return mockFs.path;
      if (name === "child_process") {
        return {
          exec: function (cmd) {
            sandbox.__lastExec = cmd;
            return { toString: function () { return ""; } };
          }
        };
      }
      throw new Error("módulo não suportado no mock: " + name);
    }
  };
  sandbox.OrgLog = {
    warn: function (scope, msg, detail) {
      logEntries.push({ level: "warn", scope: scope, msg: msg, detail: detail });
    },
    error: function (scope, msg, detail) {
      logEntries.push({ level: "error", scope: scope, msg: msg, detail: detail });
    },
    info: function (scope, msg, detail) {
      logEntries.push({ level: "info", scope: scope, msg: msg, detail: detail });
    }
  };

  sandbox.dispatchLog = [];

  nodeVm.createContext(sandbox);

  var src = nodeFs.readFileSync(nodePath.join(REPO_ROOT, "client", "PresetManager.js"), "utf8");
  nodeVm.runInContext(src, sandbox, { filename: "client/PresetManager.js" });

  function makeCsInterface() {
    return {
      getSystemPath: function (kind) {
        if (kind === "userData") return userDataPath;
        if (kind === "extension") return extensionPath;
        return userDataPath;
      },
      getHostEnvironment: function () {
        return { appId: appId, appVersion: "24.0", appName: appId === "PPRO" ? "PPRO" : "AEFT" };
      },
      dispatchEvent: function (evt) {
        sandbox.dispatchLog.push({ type: "CSEvent", scope: evt && evt.scope, data: evt && evt.data });
      },
      evalScript: function (script, cb) {
        if (typeof cb === "function") cb("undefined");
      },
      requestOpenExtension: function () {}
    };
  }

  function newManager(overrides) {
    overrides = overrides || {};
    var manager = new sandbox.PresetManager(overrides.csInterface || makeCsInterface());
    if (overrides.req) {
      manager.req = overrides.req;
      manager.fs = overrides.req("fs");
      manager.path = overrides.req("path");
    }
    return manager;
  }

  return {
    sandbox: sandbox,
    PresetManager: sandbox.PresetManager,
    mockFs: mockFs,
    localStorage: localStorage,
    logEntries: logEntries,
    dispatchLog: sandbox.dispatchLog,
    newManager: newManager,
    userDataPath: userDataPath,
    extensionPath: extensionPath,
    presetsDir: userDataPath + "/TidyFlow/presets"
  };
}

module.exports = { loadPresetManager: loadPresetManager, REPO_ROOT: REPO_ROOT };
