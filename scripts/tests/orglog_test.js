/* Testes do OrgLog (client/OrgLog.js) */
const path = require('path');

const out = function (s) { process.stdout.write(s + '\n'); };
global.window = global;
const store = new Map();
global.localStorage = {
  getItem: function (k) { return store.has(k) ? store.get(k) : null; },
  setItem: function (k, v) { store.set(k, String(v)); },
  removeItem: function (k) { store.delete(k); }
};
// Silencia o console para nao poluir a saida do runner
global.console = { log: function () {}, warn: function () {}, error: function () {}, info: function () {} };

require(path.join(__dirname, '..', '..', 'client', 'OrgLog.js'));

const Log = global.OrgLog;
let ok = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { ok++; out('PASS  ' + name); }
  else { fail++; out('FAIL  ' + name + (extra !== undefined ? '  ->  ' + extra : '')); }
}

check('OrgLog exposta em window', !!Log);
Log.debug('t', 'ignorado');
Log.info('t', 'ignorado');
check('nivel padrao (warn) ignora debug/info', Log.count() === 0, Log.count());

Log.warn('t', 'warn entra');
check('warn registrado', Log.count() === 1, Log.count());

Log.error('t', 'erro com detalhe', new Error('boom'));
check('error registrado com detalhe', Log.count() === 2 && /boom/.test(Log.last().detail || ''), JSON.stringify(Log.last()));

Log.setLevel('debug');
Log.debug('t', 'debug entra');
check('setLevel(debug) libera debug', Log.count() === 3, Log.count());

const dump = Log.dump();
check('dump inclui nivel e escopo', /warn \[t\]/.test(dump) && /error \[t\]/.test(dump), dump);
check('persistencia em localStorage', !!store.get('ae_organizer_log'));

Log.clear();
check('clear zera entradas e storage', Log.count() === 0 && !store.get('ae_organizer_log'));

out('\nRESULTADO orglog_test: ' + ok + ' PASS / ' + fail + ' FAIL');
process.exit(fail === 0 ? 0 : 1);
