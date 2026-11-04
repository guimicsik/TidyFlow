/* ==========================================================================
   TidyFlow — OrgLog: logger leve para o painel CEP (sem dependências)
   Motivo: 81 de 114 blocos catch do projeto eram vazios, então falhas de
   escrita de preset, de rollback e de evalScript desapareciam sem rastro.
   Uso: OrgLog.warn("savePreset", "falha ao gravar", err);
   ========================================================================== */
(function (global) {
  "use strict";

  var LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
  var STORAGE_KEY = "ae_organizer_log"; // prefixo legado mantido por compatibilidade
  var MAX_ENTRIES = 200;
  var PERSIST_LAST = 50;
  var entries = [];
  var minLevel = LEVELS.warn;
  var panelName = "TidyFlow";

  function nowIso() {
    try {
      return new Date().toISOString();
    } catch (e) {
      return "";
    }
  }

  function safeString(value) {
    if (value === undefined || value === null) return "";
    if (typeof value === "string") return value;
    try {
      if (value.message) return String(value.name || "Error") + ": " + String(value.message);
      return JSON.stringify(value);
    } catch (e) {
      return String(value);
    }
  }

  function persist() {
    try {
      if (global.localStorage) {
        global.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-PERSIST_LAST)));
      }
    } catch (e) {}
  }

  function push(level, scope, message, detail) {
    if (LEVELS[level] < minLevel) return;
    var entry = {
      t: nowIso(),
      level: level,
      scope: scope ? String(scope) : "",
      msg: safeString(message)
    };
    if (detail !== undefined) entry.detail = safeString(detail);

    entries.push(entry);
    while (entries.length > MAX_ENTRIES) entries.shift();
    persist();

    try {
      if (global.console) {
        var fn = level === "debug" || level === "info" ? "log" : level;
        if (typeof global.console[fn] === "function") {
          global.console[fn]("[" + panelName + "][" + entry.scope + "] " + entry.msg + (entry.detail ? " :: " + entry.detail : ""));
        }
      }
    } catch (e2) {}
  }

  var OrgLog = {
    setLevel: function (level) {
      if (LEVELS[level]) minLevel = LEVELS[level];
    },
    setPanel: function (name) {
      if (name) panelName = String(name);
    },
    debug: function (scope, msg, detail) { push("debug", scope, msg, detail); },
    info: function (scope, msg, detail) { push("info", scope, msg, detail); },
    warn: function (scope, msg, detail) { push("warn", scope, msg, detail); },
    error: function (scope, msg, detail) { push("error", scope, msg, detail); },
    entries: function () { return entries.slice(); },
    count: function (level) {
      if (!level) return entries.length;
      var n = 0;
      for (var i = 0; i < entries.length; i++) if (entries[i].level === level) n++;
      return n;
    },
    last: function () { return entries.length ? entries[entries.length - 1] : null; },
    clear: function () {
      entries = [];
      try { if (global.localStorage) global.localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    },
    dump: function () {
      var out = [];
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        out.push(e.t + " " + e.level + " [" + e.scope + "] " + e.msg + (e.detail ? " :: " + e.detail : ""));
      }
      return out.join("\n");
    }
  };

  global.OrgLog = OrgLog;
})(window);
