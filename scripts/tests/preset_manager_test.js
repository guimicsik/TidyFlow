/* Testes do PresetManager: memoizacao de path, cache de listagem/objeto e invalidacao */
const path = require('path');
const fs = require('fs');
const os = require('os');

const tmpRoot = path.join(os.tmpdir(), 'tidyflow_pm_' + Date.now());
fs.mkdirSync(tmpRoot, { recursive: true });

global.window = global;
const store = new Map();
global.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); }
};
global.SystemPath = { USER_DATA: 'userData', EXTENSION: 'extension' };
global.CSEvent = function () {};
global.CSInterface = function () {
  this.getSystemPath = function () { return tmpRoot; };
  this.getHostEnvironment = function () { return { appId: 'AEFT' }; };
  this.dispatchEvent = function () {};
  this.addEventListener = function () {};
};
global.cep_node = { require: require };
global.navigator = { platform: 'Win32' };

require(path.join(__dirname, '..', '..', 'client', 'PresetManager.js'));

const PresetManager = global.PresetManager;
const pm = new PresetManager(new global.CSInterface());

let ok = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log('PASS  ' + name); }
  else { fail++; console.log('FAIL  ' + name + (extra !== undefined ? '  ->  ' + extra : '')); }
}

const p1 = pm.getPresetsFolderPath();
const p2 = pm.getPresetsFolderPath();
check('path resolvido para .../TidyFlow/presets', !!p1 && p1.indexOf('TidyFlow') !== -1, p1);
check('path memoizado', p1 === p2);

const originalExists = pm.fs.existsSync;
let threw = false;
pm.fs.existsSync = function () { throw new Error('syscall apos memoizacao'); };
try { pm.getPresetsFolderPath(); } catch (e) { threw = true; }
pm.fs.existsSync = originalExists;
check('path sem syscall apos cache', !threw);

const l1 = pm.listPresets();
check('listPresets cache hit', pm.listPresets() === l1);
check('listPresets inclui Default Clean', l1.some(function (x) { return x.presetName === 'Default Clean'; }));

pm.savePreset({
  presetName: 'Teste Cache',
  settings: {},
  tree: [{ id: 'n1', name: 'Pasta', label: 1, rules: { types: [], extensions: [] }, children: [] }]
});
check('savePreset invalida listagem', pm.listPresets() !== l1);
check('preset salvo aparece na lista', pm.listPresets().some(function (x) { return x.presetName === 'Teste Cache'; }));

const lo1 = pm.loadPreset('Teste Cache');
check('loadPreset cache hit', pm.loadPreset('Teste Cache') === lo1);
check('preset mantem arvore', !!(lo1 && lo1.tree && lo1.tree.length === 1 && lo1.tree[0].name === 'Pasta'));

const originalReaddir = pm.fs.readdirSync;
let threw2 = false, lo3 = null;
pm.fs.readdirSync = function () { throw new Error('readdirSync inesperado'); };
try {
  pm.invalidatePresetObjectCache();
  lo3 = pm.loadPreset('Teste Cache');
} catch (e) { threw2 = true; }
pm.fs.readdirSync = originalReaddir;
check('loadPreset usa indice (sem readdir)', !threw2 && !!lo3 && lo3.tree.length === 1);

pm.deletePreset('Teste Cache');
check('deletePreset invalida listagem', !pm.listPresets().some(function (x) { return x.presetName === 'Teste Cache'; }));

check('STORAGE_KEYS expostas', !!(PresetManager.STORAGE_KEYS && PresetManager.STORAGE_KEYS.rollbackSnapshot));
check('STORAGE_KEYS mantem valores legados',
  PresetManager.STORAGE_KEYS.rollbackSnapshot === 'ae_organizer_rollback_snapshot' &&
  PresetManager.STORAGE_KEYS.saveProject === 'ae_organizer_save_project' &&
  PresetManager.STORAGE_KEYS.deleteEmpty === 'ae_organizer_delete_empty');

console.log('\nRESULTADO preset_manager_test: ' + ok + ' PASS / ' + fail + ' FAIL');
try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (e) {}
process.exit(fail === 0 ? 0 : 1);
