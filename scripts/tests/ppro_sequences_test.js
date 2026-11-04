/* Teste do modo "selection" do motor Premiere: sequencia principal, sequencias
   aninhadas (PreComps) e dependencias descobertas pelas trilhas (video/audio). */
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
function tracksOf(items) {
  const clips = collection((items || []).map(function (it) { return { projectItem: it }; }));
  const tracks = [{ clips: clips }];
  Object.defineProperty(tracks, 'numTracks', { get: function () { return tracks.length; }, configurable: true });
  return tracks;
}

class Item {
  constructor(name, kind) {
    this.nodeId = 'node' + (nextId++);
    this.name = name;
    this.type = kind === 'bin' ? ProjectItemType.BIN : ProjectItemType.CLIP;
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
  moveBin(target) {
    if (!target || typeof target.children === 'undefined') throw new Error('moveBin: destino invalido');
    let cursor = target;
    while (cursor) {
      if (cursor === this) throw new Error('moveBin: bin dentro de si mesmo');
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
    this.children.unshift(b);
    return b;
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
class SequenceItem extends Item {
  constructor(name) { super(name, 'clip'); this._isSequence = true; }
}

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
Object.defineProperty(sequences, 'numSequences', { get: function () { return sequences.length; }, configurable: true });
const project = {
  rootItem: rootItem,
  sequences: sequences,
  activeSequence: null,
  path: 'C:/projetos/seq.prproj',
  documentID: 'docSeq',
  save: function () { return true; },
  _selection: []
};
global.app = {
  project: project,
  getCurrentProjectViewSelection: function () { return project._selection; },
  getProjectViewIDs: function () { return []; },
  getProjectViewSelection: function () { return []; },
  getProjectFromViewID: function () { return project; }
};
global.File = File;
global.$ = { global: global, fileName: enginePath, evalFile: function (f) { require(f.fsName); } };

function addClip(name, mediaPath, mediaType) {
  const c = new Clip(name, mediaPath, mediaType);
  c._parent = rootItem;
  rootItem.children.push(c);
  return c;
}
function addSequenceItem(name) {
  const s = new SequenceItem(name);
  s._parent = rootItem;
  rootItem.children.push(s);
  return s;
}
function registerSequence(seqItem, videoItems, audioItems) {
  const seq = {
    name: seqItem.name,
    projectItem: seqItem,
    videoTracks: tracksOf(videoItems),
    audioTracks: tracksOf(audioItems),
    captionTracks: tracksOf([])
  };
  sequences.push(seq);
  return seq;
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
    out.push('   ' + '  '.repeat(depth) + (ch.type === ProjectItemType.BIN ? '[B] ' : (ch.isSequence() ? '[S] ' : '[C] ')) + ch.name);
    if (ch.type === ProjectItemType.BIN) dump(ch, depth + 1, out);
  }
  return out;
}

const mp4 = addClip('v.mp4', 'C:/src/Lote1/v.mp4', 'Video');
const png = addClip('i.png', 'C:/src/Stills3/i.png', 'Still');
const wav = addClip('a.wav', 'C:/src/Audio4/a.wav', 'Audio');
const stray = addClip('stray.mp4', 'C:/src/Lote9/stray.mp4', 'Video');

const seqNested = addSequenceItem('002_Aninhada');
const seqMain = addSequenceItem('001_Main');
registerSequence(seqNested, [png], []);
registerSequence(seqMain, [mp4, seqNested], [wav]);
project.activeSequence = sequences[1]; // 001_Main
project._selection = [seqMain];

const preset = {
  presetName: 'Teste Sequencias',
  settings: {
    usePrefixNumbering: true, deleteEmptyFolders: true, saveProjectBefore: false,
    reduceProject: false, groupBySourceFolder: true, unusedFolderName: 'Nunca Usadas'
  },
  tree: [
    { id: 'n_out', name: 'Output', label: 9, rules: { types: ['MainComp'], extensions: [], groupSubfoldersByExt: false, catchOthers: false, nameFilter: '' }, children: [] },
    { id: 'n_assets', name: 'Assets', label: 0, rules: { types: [], extensions: [], groupSubfoldersByExt: false, catchOthers: false, nameFilter: '' }, children: [
      { id: 'n_pre', name: 'PreComps', label: 5, rules: { types: ['PreComps'], extensions: [], groupByMainComp: true, groupSubfoldersByExt: false, catchOthers: false, nameFilter: '' }, children: [] },
      { id: 'n_img', name: 'Images', label: 4, rules: { types: ['StillImages'], extensions: ['png', 'jpg'], groupSubfoldersByExt: true, groupBySourceFolder: true, catchOthers: true, nameFilter: '' }, children: [] },
      { id: 'n_foot', name: 'Footages', label: 6, rules: { types: ['Videos', 'ImageSequences', 'DataFiles'], extensions: ['mp4', 'mov'], groupSubfoldersByExt: true, groupBySourceFolder: true, catchOthers: true, nameFilter: '' }, children: [] },
      { id: 'n_aud', name: 'Audios', label: 7, rules: { types: ['Audios'], extensions: ['wav'], groupSubfoldersByExt: true, groupBySourceFolder: false, catchOthers: false, nameFilter: '' }, children: [] }
    ] }
  ]
};

require(enginePath);

const r1 = JSON.parse(global.ppro_organizeWithPreset('selection', JSON.stringify(preset)));
console.log('   resposta: ' + JSON.stringify(r1));
console.log(dump(rootItem, 0, []).join('\n'));

const pMain = pathOf(seqMain), pNested = pathOf(seqNested), pMp4 = pathOf(mp4), pPng = pathOf(png), pWav = pathOf(wav), pStray = pathOf(stray);
console.log('   main -> ' + pMain.join(' / '));
console.log('   nested -> ' + pNested.join(' / '));
console.log('   v.mp4 -> ' + pMp4.join(' / '));

check('execucao retorna success', r1.success === true, JSON.stringify(r1));
check('sequencia principal vai para Output', pMain.some(function (n) { return /Output/.test(n); }), pMain.join('/'));
check('sequencia aninhada vai para PreComps', pNested.some(function (n) { return /PreComps/.test(n); }), pNested.join('/'));
check('PreComps agrupado pelo nome da principal', pNested.indexOf('001_Main') !== -1, pNested.join('/'));
check('clip referenciado (mp4) em Footages/MP4/Lote1', pMp4.some(function (n) { return /Footages/.test(n); }) && pMp4.indexOf('MP4') !== -1 && pMp4.indexOf('Lote1') !== -1, pMp4.join('/'));
check('clip referenciado pela aninhada (png) em Images', pPng.some(function (n) { return /Images/.test(n); }) && pPng.indexOf('Stills3') !== -1, pPng.join('/'));
check('audio da trilha (wav) em Audios/WAV', pWav.some(function (n) { return /Audios/.test(n); }) && pWav.indexOf('WAV') !== -1, pWav.join('/'));
check('clip avulso tambem classificado (Lote9)', pStray.some(function (n) { return /Footages/.test(n); }) && pStray.indexOf('Lote9') !== -1, pStray.join('/'));
check('sequencias nao sao tratadas como midia', !pMain.some(function (n) { return /Footages|Images|Audios/.test(n); }) && !pNested.some(function (n) { return /Footages|Images|Audios/.test(n); }), pMain.join('/') + ' | ' + pNested.join('/'));
check('contadores de comps >= 2 (principal + aninhada)', r1.movedComps >= 2, r1.movedComps);

const r2 = JSON.parse(global.ppro_organizeWithPreset('selection', JSON.stringify(preset)));
check('reexecucao idempotente', r2.movedComps === 0 && r2.movedFootages === 0, JSON.stringify(r2));
check('caminhos preservados na reexecucao', pathOf(seqNested).join('/') === pNested.join('/'), pathOf(seqNested).join('/'));

console.log('\nRESULTADO ppro_sequences_test: ' + ok + ' PASS / ' + fail + ' FAIL');
process.exit(fail === 0 ? 0 : 1);

