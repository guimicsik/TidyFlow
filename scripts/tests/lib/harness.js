/* ==========================================================================
   TidyFlow — Micro harness de testes (Node, sem dependências)
   Uso:
     var h = createHarness("nome da suite");
     h.test("descrição", function () { h.assert.eq(1, 1); });
   ========================================================================== */
"use strict";

function createHarness(suiteName) {
  var results = [];

  function test(description, fn) {
    var startedAt = Date.now();
    try {
      fn();
      results.push({ suite: suiteName, description: description, ok: true, ms: Date.now() - startedAt });
    } catch (err) {
      results.push({
        suite: suiteName,
        description: description,
        ok: false,
        ms: Date.now() - startedAt,
        error: err && err.stack ? err.stack : String(err)
      });
    }
  }

  function describe(label, fn) {
    var previous = currentSection;
    currentSection = label;
    try {
      fn();
    } finally {
      currentSection = previous;
    }
  }

  var currentSection = null;

  var assert = {
    ok: function (value, message) {
      if (!value) throw new Error((message || "esperado valor verdadeiro") + " (recebido: " + short(value) + ")");
    },
    notOk: function (value, message) {
      if (value) throw new Error((message || "esperado valor falso") + " (recebido: " + short(value) + ")");
    },
    eq: function (actual, expected, message) {
      if (actual !== expected) {
        throw new Error((message || "valores diferentes") + "\n    recebido: " + short(actual) + "\n    esperado: " + short(expected));
      }
    },
    notEq: function (actual, expected, message) {
      if (actual === expected) {
        throw new Error((message || "valores deveriam ser diferentes") + " (ambos = " + short(actual) + ")");
      }
    },
    deepEq: function (actual, expected, message) {
      var a = JSON.stringify(actual);
      var b = JSON.stringify(expected);
      if (a !== b) {
        throw new Error((message || "estruturas diferentes") + "\n    recebido: " + a + "\n    esperado: " + b);
      }
    },
    includes: function (haystack, needle, message) {
      if (String(haystack).indexOf(needle) === -1) {
        throw new Error((message || "trecho não encontrado") + ": " + needle);
      }
    },
    notIncludes: function (haystack, needle, message) {
      if (String(haystack).indexOf(needle) !== -1) {
        throw new Error((message || "trecho inesperado encontrado") + ": " + needle);
      }
    },
    throws: function (fn, message) {
      var threw = false;
      try {
        fn();
      } catch (e) {
        threw = true;
      }
      if (!threw) throw new Error(message || "esperado que a função lançasse exceção");
    },
    doesNotThrow: function (fn, message) {
      try {
        fn();
      } catch (e) {
        throw new Error((message || "função lançou exceção inesperada") + ": " + (e && e.message ? e.message : e));
      }
    }
  };

  function short(value) {
    var text;
    try {
      text = typeof value === "string" ? "\"" + value + "\"" : JSON.stringify(value);
    } catch (e) {
      text = String(value);
    }
    if (text === undefined) text = String(value);
    return text.length > 220 ? text.substring(0, 220) + "…" : text;
  }

  return {
    suiteName: suiteName,
    test: test,
    describe: describe,
    assert: assert,
    results: results,
    get section() {
      return currentSection;
    }
  };
}

module.exports = { createHarness: createHarness };
