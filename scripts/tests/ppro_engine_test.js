/* Teste funcional do motor Premiere Pro (host/ppro_organizer.jsx) com projeto simulado.
   Dubla a API do PPro: ProjectItemType, bins com createBin/moveBin/deleteBin,
   color labels, getMediaPath/getProjectMetadata e sequencias com trilhas/clips. */
const path = require('path');
const fs = require('fs');

const enginePath = path.join(__dirname, '..', '..', 'host', 'ppro_organizer.jsx');

const ProjectItemType = { CLIP: 1, BIN: 2, ROOT: 3, FILE: 4 };
global.ProjectItemType = ProjectItemType;

let nextId = 1;
function collection(arr) {
  Object.defineProperty(arr, 'numItems', { get: function () { return arr.length; }, configurable: true });
  return arr;
}

class Item {
  constructor(name, kind) {
    this.nodeId = 'node' + (nextId++);
    this.name = name;
    this.type = kind === 'bin' ? ProjectItemType.BIN : ProjectItemType.CLIP;
    this._kind = kind;
    this._parent = null;
    this._color = -1;
    this.children = kind === 'bin' ? collection([]) : null;
  }
  getColorLabel() { return this._color; }
  setColorLabel(n) { this._color = n; }
  getMediaPath() { return this._mediaPath || ''; }
  getProjectMetadata() {
    if (!this._mediaType) return '';
    return '<Columns><Column.Intrinsic.MediaType>' + this._mediaType + '</Column.Intrinsic.MediaType></Columns>';
  }
  isOffline() { return false; }
  isMulticamClip() { return false; }
  isMergedClip() { return false; }
  isSequence() { return this.type === ProjectItemType.CLIP ? !!this._isSequence : false; }
  // ProjectItem.moveBin existe para clipes e bins no Premiere real
  moveBin(target) {
    if (!target || typeof target.children === 'undefined') throw new Error('moveBin: destino invalido');
    let cursor = target;
    while (cursor) {
      if (cursor === this) throw new Error('moveBin: nao pode mover um bin para dentro dele mesmo');
      cursor = cursor._parent;
    }
    if (this._parent) {
      const i = this._parent.children.indexOf(this);
      if (i >= 0) this._parent.children.splice(i, 1);
    }
    this._parent = target;
    target.children.push(this);
  }
}

class Bin extends Item {
  constructor(name) { super(name, 'bin'); }
  createBin(name) {
    const b = new Bin(name);
    b._parent = this;
    this.children.unshift(b); // Premiere insere bins novos no topo
    return b;
  }
  moveBin(target) {
    if (!target || typeof target.children === 'undefined') throw new Error('moveBin: destino invalido');
    let cursor = target;
    while (cursor) {
      if (cursor === this) throw new Error('moveBin: nao pode mover um bin para dentro dele mesmo');
      cursor = cursor._parent;
    }
    if (this._parent) {
      const i = this._parent.children.indexOf(this);
      if (i >= 0) this._parent.children.splice(i, 1);
    }
    this._parent = target;
    target.children.push(this);
  }
  deleteBin() {
    if (!this._parent) return;
    const i = this._parent.children.indexOf(this);
    if (i >= 0) this._parent.children.splice(i, 1);
    this._parent = null;
  }
}

class Clip extends Item {
  constructor(name, mediaPath, mediaType) {
    super(name, 'clip');
    this._mediaPath = mediaPath || '';
    this._mediaType = mediaType || '';
  }
}

// Stub de File compativel com o bootstrap da lib compartilhada
function File(p) {
  const full = String(p);
  this.fsName = full;
  this.name = full.split(/[\\/]/).pop();
  this.exists = fs.existsSync(full);
  const parentPath = full.replace(/[\\/][^\\/]+$/, '');
  this.parent = parentPath && parentPath !== full ? new File(parentPath) : null;
}

const rootItem = new Bin('Raiz');
rootItem.type = ProjectItemType.ROOT;
rootItem.nodeId = 'root';

const sequences = collection([]);

const project = {
  rootItem: rootItem,
  sequences: sequences,
  activeSequence: null,
  path: 'C:/projetos/teste.prproj',
  documentID: 'doc1',
  save: function () { return true; }
};

global.app = {
  project: project,
  getCurrentProjectViewSelection: function () { return project._selection || []; },
  getProjectViewIDs: function () { return []; },
  getProjectViewSelection: function () { return []; },
  getProjectFromViewID: function () { return project; }
};

global.File = File;
global.$ = {
  global: global,
  fileName: enginePath,
  evalFile: function (f) { require(f.fsName); }
};

function addClip(name, mediaPath, mediaType) {
  const c = new Clip(name, mediaPath, mediaType);
  c._parent = rootItem;
  rootItem.children.push(c);
  return c;
}

let ok = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log('PASS  ' + name); }
  else { fail++; console.log('FAIL  ' + name + (extra !== undefined ? '  ->  ' + extra : '')); }
}
function pathOf(item) {
  const out = [];
  let p = item._parent;
  while (p && p !== rootItem) { out.unshift(p.name); p = p._parent; }
  return out;
}
function dump(container, depth, out) {
  for (let i = 0; i < container.children.length; i++) {
    const ch = container.children[i];
    out.push('   ' + '  '.repeat(depth) + (ch.type === ProjectItemType.BIN ? '[B] ' : '[C] ') + ch.name);
    if (ch.type === ProjectItemType.BIN) dump(ch, depth + 1, out);
  }
  return out;
}

const clipMp4 = addClip('v.mp4', 'C:/src/Lote1/v.mp4', 'Video');
const clipPng = addClip('i.png', 'C:/src/Stills3/i.png', 'Still');
const clipWav = addClip('a.wav', 'C:/src/Audio4/a.wav', 'Audio');
const matte = addClip('Color Matte', '', '');            // sintetico (Solids)

const preset = {
  presetName: 'Teste PPro',
  settings: {
    usePrefixNumbering: true, deleteEmptyFolders: true, saveProjectBefore: false,
    reduceProject: false, groupBySourceFolder: true, unusedFolderName: 'Nunca Usadas'
  },
  tree: [
    { id: 'n_out', name: 'Output', label: 9, rules: { types: ['MainComp'], extensions: [], groupSubfoldersByExt: false, catchOthers: false, nameFilter: '' }, children: [] },
    { id: 'n_assets', name: 'Assets', label: 0, rules: { types: [], extensions: [], groupSubfoldersByExt: false, catchOthers: false, nameFilter: '' }, children: [
      { id: 'n_img', name: 'Images', label: 4, rules: { types: ['StillImages'], extensions: ['png', 'jpg'], groupSubfoldersByExt: true, groupBySourceFolder: true, catchOthers: true, nameFilter: '' }, children: [] },
      { id: 'n_foot', name: 'Footages', label: 6, rules: { types: ['Videos', 'ImageSequences', 'DataFiles'], extensions: ['mp4', 'mov'], groupSubfoldersByExt: true, groupBySourceFolder: true, catchOthers: true, nameFilter: '' }, children: [] },
      { id: 'n_aud', name: 'Audios', label: 7, rules: { types: ['Audios'], extensions: ['wav'], groupSubfoldersByExt: true, groupBySourceFolder: false, catchOthers: false, nameFilter: '' }, children: [] },
      { id: 'n_sol', name: 'Solids', label: 0, rules: { types: ['Solids'], extensions: [], groupSubfoldersByExt: false, catchOthers: false, nameFilter: '' }, children: [] }
    ] }
  ]
};

require(enginePath);

check('lib compartilhada carregada pelo motor PPRO', !!global.OrgLib);

const r1 = JSON.parse(global.ppro_organizeWithPreset('media_only', JSON.stringify(preset)));
console.log('   resposta: ' + JSON.stringify(r1));
console.log(dump(rootItem, 0, []).join('\n'));

check('execucao retorna success', r1.success === true, JSON.stringify(r1));
check('instrumentacao expoe elapsedMs', typeof r1.elapsedMs === 'number', r1.elapsedMs);
check('instrumentacao expoe scanCount', typeof r1.scanCount === 'number', r1.scanCount);

const pMp4 = pathOf(clipMp4), pPng = pathOf(clipPng), pWav = pathOf(clipWav), pMatte = pathOf(matte);
console.log('   v.mp4 -> ' + pMp4.join(' / ') + ' | i.png -> ' + pPng.join(' / ') + ' | a.wav -> ' + pWav.join(' / ') + ' | matte -> ' + pMatte.join(' / '));

check('mp4 em Footages/MP4/Lote1', pMp4.some(function (n) { return /Footages/.test(n); }) && pMp4.indexOf('MP4') !== -1 && pMp4.indexOf('Lote1') !== -1, pMp4.join('/'));
check('png em Images/PNG/Stills3', pPng.some(function (n) { return /Images/.test(n); }) && pPng.indexOf('PNG') !== -1 && pPng.indexOf('Stills3') !== -1, pPng.join('/'));
check('wav em Audios/WAV sem pasta de origem', pWav.some(function (n) { return /Audios/.test(n); }) && pWav.indexOf('WAV') !== -1 && pWav.indexOf('Audio4') === -1, pWav.join('/'));
check('item sintetico em Solids', pMatte.some(function (n) { return /Solids/.test(n); }), pMatte.join('/'));
check('numeracao sequencial em Assets', /^\d{2}_Assets$/.test(pMp4[0]), pMp4[0]);

const footBin = clipMp4._parent;
const imgBin = clipPng._parent;
check('Color Label aplicado em Footages', footBin.getColorLabel() >= 0, footBin.getColorLabel());
check('Color Label aplicado em Images', imgBin.getColorLabel() >= 0, imgBin.getColorLabel());

// Idempotencia
const binsBefore = (function countBins(b) { let n = 0; for (let i = 0; i < b.children.length; i++) { if (b.children[i].type === ProjectItemType.BIN) { n += 1 + countBins(b.children[i]); } } return n; })(rootItem);
const r2 = JSON.parse(global.ppro_organizeWithPreset('media_only', JSON.stringify(preset)));
const binsAfter = (function countBins(b) { let n = 0; for (let i = 0; i < b.children.length; i++) { if (b.children[i].type === ProjectItemType.BIN) { n += 1 + countBins(b.children[i]); } } return n; })(rootItem);
check('reexecucao nao move nada', r2.movedFootages === 0 && r2.movedComps === 0, JSON.stringify(r2));
check('reexecucao nao duplica bins', binsBefore === binsAfter, binsBefore + ' -> ' + binsAfter);
check('reexecucao mantem caminhos', pathOf(clipMp4).join('/') === pMp4.join('/'), pathOf(clipMp4).join('/'));

// Rollback: devolve os clipes para a raiz e remove os bins criados
const rb = JSON.parse(global.ppro_rollbackProject(false, ''));
console.log('   rollback: ' + JSON.stringify(rb));
check('rollback retorna success', rb.success === true, JSON.stringify(rb));
check('rollback restaura mp4 na raiz', clipMp4._parent === rootItem, pathOf(clipMp4).join('/'));
check('rollback restaura png na raiz', clipPng._parent === rootItem, pathOf(clipPng).join('/'));
check('rollback remove bins criados', rootItem.children.filter(function (c) { return c.type === ProjectItemType.BIN; }).length === 0,
  rootItem.children.filter(function (c) { return c.type === ProjectItemType.BIN; }).map(function (b) { return b.name; }).join(','));

console.log('\nRESULTADO ppro_engine_test: ' + ok + ' PASS / ' + fail + ' FAIL');
process.exit(fail === 0 ? 0 : 1);

