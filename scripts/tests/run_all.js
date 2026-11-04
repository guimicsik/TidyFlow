/* Runner das suites de teste do TidyFlow (sem dependencias externas) */
const { execFileSync } = require('child_process');
const path = require('path');

const suites = ['lib_test.js', 'orglog_test.js', 'preset_manager_test.js', 'ae_engine_test.js', 'ppro_engine_test.js'];
let failed = 0;

for (const suite of suites) {
  console.log('\n=== ' + suite + ' ===');
  try {
    execFileSync(process.execPath, [path.join(__dirname, suite)], { stdio: 'inherit' });
  } catch (e) {
    failed++;
  }
}

console.log('\n' + (failed === 0 ? 'TODAS AS SUITES PASSARAM' : failed + ' suite(s) com falha'));
process.exit(failed === 0 ? 0 : 1);
