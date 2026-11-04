/* ==========================================================================
   TidyFlow — Sistema de arquivos em memória (para testar PresetManager)
   Simula fs/path do Node dentro do painel CEP, incluindo falha de escrita.
   ========================================================================== */
"use strict";

var nodePath = require("path");

function normalize(p) {
  return String(p).replace(/\\/g, "/").replace(/\/+$/, "");
}

function createMockFs() {
  var files = {};      // path -> conteúdo
  var dirs = {};       // path -> true
  var state = {
    writeFailure: null,   // mensagem de erro ou null
    writeCount: 0,
    readCount: 0
  };

  dirs[""] = true;

  function ensureDirsFor(filePath) {
    var dir = normalize(nodePath.posix.dirname(filePath));
    var parts = dir.split("/");
    var acc = "";
    for (var i = 0; i < parts.length; i++) {
      acc = acc ? acc + "/" + parts[i] : parts[i];
      dirs[acc] = true;
    }
  }

  var fs = {
    existsSync: function (p) {
      var key = normalize(p);
      return files[key] !== undefined || dirs[key] === true;
    },
    mkdirSync: function (p) {
      dirs[normalize(p)] = true;
      ensureDirsFor(normalize(p) + "/x");
    },
    readdirSync: function (p) {
      var key = normalize(p);
      if (!dirs[key]) {
        var err = new Error("ENOENT: no such file or directory, scandir '" + p + "'");
        err.code = "ENOENT";
        throw err;
      }
      var prefix = key ? key + "/" : "";
      var seen = {};
      var out = [];
      Object.keys(files).forEach(function (filePath) {
        if (prefix && filePath.indexOf(prefix) !== 0) return;
        var rest = filePath.substring(prefix.length);
        if (rest.indexOf("/") !== -1) return; // só o primeiro nível
        if (!seen[rest]) {
          seen[rest] = true;
          out.push(rest);
        }
      });
      Object.keys(dirs).forEach(function (dirPath) {
        if (!dirPath || dirPath === key) return;
        if (prefix && dirPath.indexOf(prefix) !== 0) return;
        var rest = dirPath.substring(prefix.length);
        if (!rest || rest.indexOf("/") !== -1) return;
        if (!seen[rest]) {
          seen[rest] = true;
          out.push(rest);
        }
      });
      return out;
    },
    readFileSync: function (p) {
      var key = normalize(p);
      state.readCount++;
      if (files[key] === undefined) {
        var err = new Error("ENOENT: no such file or directory, open '" + p + "'");
        err.code = "ENOENT";
        throw err;
      }
      return files[key];
    },
    writeFileSync: function (p, data) {
      state.writeCount++;
      if (state.writeFailure) {
        var err = new Error(state.writeFailure);
        err.code = "EACCES";
        throw err;
      }
      var key = normalize(p);
      ensureDirsFor(key);
      files[key] = String(data);
    },
    unlinkSync: function (p) {
      var key = normalize(p);
      if (files[key] === undefined) {
        var err = new Error("ENOENT: no such file or directory, unlink '" + p + "'");
        err.code = "ENOENT";
        throw err;
      }
      delete files[key];
    },
    copyFileSync: function (from, to) {
      var src = normalize(from);
      if (files[src] === undefined) {
        var err = new Error("ENOENT: no such file or directory, copyfile '" + from + "'");
        err.code = "ENOENT";
        throw err;
      }
      var dest = normalize(to);
      ensureDirsFor(dest);
      files[dest] = files[src];
    }
  };

  return {
    fs: fs,
    path: nodePath.posix,
    state: state,
    files: files,
    dirs: dirs,
    writeRaw: function (p, contents) {
      var key = normalize(p);
      ensureDirsFor(key);
      files[key] = contents;
    },
    failWrites: function (message) {
      state.writeFailure = message || "EACCES: permission denied, open preset";
    },
    allowWrites: function () {
      state.writeFailure = null;
    },
    listFiles: function (dir) {
      var prefix = normalize(dir) + "/";
      return Object.keys(files).filter(function (k) {
        return k.indexOf(prefix) === 0;
      });
    }
  };
}

function createMockLocalStorage() {
  var map = {};
  var state = { quotaError: null };
  return {
    getItem: function (key) {
      return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : null;
    },
    setItem: function (key, value) {
      if (state.quotaError) {
        var err = new Error(state.quotaError);
        err.code = "QUOTA_EXCEEDED_ERR";
        throw err;
      }
      map[key] = String(value);
    },
    removeItem: function (key) {
      delete map[key];
    },
    clear: function () {
      map = {};
    },
    keys: function () {
      return Object.keys(map);
    },
    dump: function () {
      return map;
    },
    failNextWrites: function (message) {
      state.quotaError = message || "QuotaExceededError";
    },
    allowWrites: function () {
      state.quotaError = null;
    }
  };
}

module.exports = {
  createMockFs: createMockFs,
  createMockLocalStorage: createMockLocalStorage
};
