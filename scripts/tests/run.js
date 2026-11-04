/* ==========================================================================
   TidyFlow — Runner da suíte de testes
   Uso:  npm test
         node scripts/tests/run.js
   ========================================================================== */
"use strict";

var suites = [
  "./preset_manager_test.js",
  "./preset_import_test.js",
  "./ae_engine_test.js",
  "./client_refs_test.js",
  "./host_static_test.js"
];

var total = 0;
var failed = 0;
var currentSuite = null;

for (var i = 0; i < suites.length; i++) {
  var mod = require(suites[i]);
  var results = mod.results || [];
  for (var r = 0; r < results.length; r++) {
    var res = results[r];
    total++;
    if (res.suite !== currentSuite) {
      currentSuite = res.suite;
      console.log("\n" + currentSuite);
      console.log(new Array(currentSuite.length + 1).join("-"));
    }
    if (res.ok) {
      console.log("  ok   " + res.description + " (" + res.ms + "ms)");
    } else {
      failed++;
      console.log("  FAIL " + res.description);
      var stack = String(res.error || "").split("\n");
      for (var s = 0; s < stack.length; s++) {
        console.log("       " + stack[s]);
      }
    }
  }
}

console.log("\n==============================================");
console.log("Total: " + total + " | Falhas: " + failed + " | Sucesso: " + (total - failed));
console.log("==============================================");

process.exit(failed === 0 ? 0 : 1);
