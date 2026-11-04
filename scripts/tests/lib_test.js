/* Testes unitarios da biblioteca compartilhada de host (host/_lib.jsx) */
const path = require('path');

global.$ = { global: global };
require(path.join(__dirname, '..', '..', 'host', '_lib.jsx'));

const Lib = global.OrgLib;
let ok = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log('PASS  ' + name); }
  else { fail++; console.log('FAIL  ' + name + (extra !== undefined ? '  ->  ' + JSON.stringify(extra) : '')); }
}

check('OrgLib exposta em $.global', !!Lib);
check('escapeJsonString escapa aspas e barras', Lib.escapeJsonString('a"b\\c') === 'a\\"b\\\\c', Lib.escapeJsonString('a"b\\c'));
check('escapeJsonString trata null/undefined', Lib.escapeJsonString(null) === '' && Lib.escapeJsonString(undefined) === '');
check('escapeJsonString escapa quebras de linha', Lib.escapeJsonString('a\nb') === 'a\\nb');
check('parseJson le objeto', Lib.parseJson('{"a":1}').a === 1);
check('parseJson invalido retorna null', Lib.parseJson('{oops') === null);
check('parseJson vazio retorna null', Lib.parseJson('') === null);
check('arrayContains', Lib.arrayContains(['a', 'b'], 'b') === true && Lib.arrayContains(['a'], 'z') === false);
check('arrayContainsIgnoreCase', Lib.arrayContainsIgnoreCase(['MP4'], 'mp4') === true && Lib.arrayContainsIgnoreCase(['MP4'], 'mov') === false);
check('stripNumericPrefix', Lib.stripNumericPrefix('02_Assets') === 'Assets' && Lib.stripNumericPrefix('Assets') === 'Assets');
check('trimStr', Lib.trimStr('  x  ') === 'x' && Lib.trimStr(undefined) === '');
check('getFileExtension', Lib.getFileExtension({ name: 'a.MP4' }) === 'mp4' && Lib.getFileExtension({ name: 'sem_ext' }) === '');
check('getParentFolderNameFromPath (barras /)', Lib.getParentFolderNameFromPath('C:/src/PastaA/a.mp4') === 'PastaA');
check('getParentFolderNameFromPath (barras \\)', Lib.getParentFolderNameFromPath('C:\\src\\Lote3\\v1.mp4') === 'Lote3');
check('isSameItem por id', Lib.isSameItem({ id: 5 }, { id: 5 }) === true && Lib.isSameItem({ id: 5 }, { id: 6 }) === false);
check('isSameItem por nodeId (Premiere)', Lib.isSameItem({ nodeId: 'a' }, { nodeId: 'a' }) === true);

console.log('\nRESULTADO lib_test: ' + ok + ' PASS / ' + fail + ' FAIL');
process.exit(fail === 0 ? 0 : 1);
