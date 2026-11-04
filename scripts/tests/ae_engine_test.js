/* Teste funcional do motor After Effects (host/aeft_organizer.jsx) com projeto simulado.
   Cobre: classificacao, agrupamento por extensao/origem, numeracao, idempotencia,
   instrumentacao (elapsedMs/scanCount) e carregamento da lib compartilhada. */
const path = require('path');
const fs = require('fs');

const enginePath = path.join(__dirname, '..', '..', 'host', 'aeft_organizer.jsx');

let nextId = 1;
class Item {
  constructor(name) {
    this.id = nextId++;
    this.name = name;
    this.label = 0;
    this.comment = '';
    this._parent = null;
    this.children = [];
  }
  get parentFolder() { return this._parent; }
  set parentFolder(p) {
    if (this._parent) {
      const i = this._parent.children.indexOf(this);
      if (i >= 0) this._parent.children.splice(i, 1);
    }
    this._parent = p || null;
    if (p) p.children.push(this);
  }
  get numItems() { return this.children.length; }
  remove() {
    if (this._parent) {
      const i = this._parent.children.indexOf(this);
      if (i >= 0) this._parent.children.splice(i, 1);
    }
    const idx = project.items.indexOf(this);
    if (idx >= 0) project.items.splice(idx, 1);
  }
}
class FolderItem extends Item { item(i) { return this.children[i - 1] || null; } }
class CompItem extends Item { constructor(n) { super(n); this.numLayers = 0; } }
class FootageItem extends Item {}
class SolidSource {}
class FileSource { constructor(still) { this.isStill = still; } }

// Stub de File compativel com o bootstrap da lib (exists/parent/fsName)
function File(p) {
  const full = String(p);
  this.fsName = full;
  this.name = full.split(/[\\/]/).pop();
  this.exists = fs.existsSync(full);
  const parentPath = full.replace(/[\\/][^\\/]+$/, '');
  this.parent = parentPath && parentPath !== full ? new File(parentPath) : null;
}

const root = new FolderItem('Raiz');
root.id = 0;
const project = {
  file: null,
  items: [],
  rootFolder: root,
  selection: [],
  activeItem: null,
  renderQueue: { numItems: 0, item: function () { return null; } },
  get numItems() { return this.items.length; },
  item: function (i) { return this.items[i - 1] || null; },
  addFolder: function (name) {
    const f = new FolderItem(name);
    f.parentFolder = root;
    project.items.push(f);
    return f;
  },
  save: function () {},
  reduceProject: function () { return 0; }
};
project.items.addFolder = project.addFolder;

global.FolderItem = FolderItem;
global.CompItem = CompItem;
global.FootageItem = FootageItem;
global.SolidSource = SolidSource;
global.FileSource = FileSource;
global.File = File;
global.app = { project: project, beginUndoGroup: function () {}, endUndoGroup: function () {} };
global.$ = {
  global: global,
  fileName: enginePath,
  evalFile: function (f) { require(f.fsName); }
};

function addFootage(name, fullPath, still, isAudio) {
  const f = new FootageItem(name);
  f.file = new File(fullPath);
  f.mainSource = new FileSource(!!still);
  f.hasVideo = !isAudio;
  f.hasAudio = !!isAudio;
  f.duration = still ? 0 : 10;
  f.frameRate = still ? 0 : 25;
  f.parentFolder = root;
  project.items.push(f);
  return f;
}

let ok = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log('PASS  ' + name); }
  else { fail++; console.log('FAIL  ' + name + (extra !== undefined ? '  ->  ' + extra : '')); }
}
function pathOf(item) {
  const out = [];
  let p = item.parentFolder;
  while (p && p !== root) { out.unshift(p.name); p = p.parentFolder; }
  return out;
}
function dump(folder, depth, out) {
  for (const ch of folder.children) {
    out.push('   ' + '  '.repeat(depth) + (ch instanceof FolderItem ? '[D] ' : '[F] ') + ch.name);
    if (ch instanceof FolderItem) dump(ch, depth + 1, out);
  }
  return out;
}

const SCALE = process.argv[2] === 'scale';

let clipMp4 = null, imgPng = null, audioWav = null, comp = null;
if (SCALE) {
  for (let i = 0; i < 240; i++) {
    addFootage('v' + i + '.mp4', path.join(__dirname, 'src', 'Lote' + (i % 20), 'v' + i + '.mp4'), false, false);
  }
  for (let i = 0; i < 60; i++) {
    addFootage('i' + i + '.png', path.join(__dirname, 'src', 'Stills' + (i % 10), 'i' + i + '.png'), true, false);
  }
} else {
  clipMp4 = addFootage('a.mp4', 'C:/src/PastaA/a.mp4', false, false);
  imgPng = addFootage('b.png', 'C:/src/PastaB/b.png', true, false);
  audioWav = addFootage('c.wav', 'C:/src/PastaC/c.wav', false, true);
}
comp = new CompItem('001_Main');
comp.parentFolder = root;
project.items.push(comp);
project.selection = [comp];

const preset = {
  presetName: 'Teste Fase2',
  settings: {
    usePrefixNumbering: true, deleteEmptyFolders: true, saveProjectBefore: false,
    reduceProject: false, groupBySourceFolder: true, unusedFolderName: 'Nunca Usadas'
  },
  tree: [
    { id: 'n_out', name: 'Output', label: 9, rules: { types: ['MainComp'], extensions: [], groupSubfoldersByExt: false, catchOthers: false, nameFilter: '' }, children: [] },
    { id: 'n_assets', name: 'Assets', label: 0, rules: { types: [], extensions: [], groupSubfoldersByExt: false, catchOthers: false, nameFilter: '' }, children: [
      { id: 'n_img', name: 'Images', label: 4, rules: { types: ['StillImages'], extensions: ['png', 'jpg'], groupSubfoldersByExt: true, groupBySourceFolder: true, catchOthers: true, nameFilter: '' }, children: [] },
      { id: 'n_foot', name: 'Footages', label: 6, rules: { types: ['Videos', 'ImageSequences', 'DataFiles'], extensions: ['mp4', 'mov'], groupSubfoldersByExt: true, groupBySourceFolder: true, catchOthers: true, nameFilter: '' }, children: [] },
      { id: 'n_aud', name: 'Audios', label: 7, rules: { types: ['Audios'], extensions: ['wav'], groupSubfoldersByExt: true, groupBySourceFolder: false, catchOthers: false, nameFilter: '' }, children: [] }
    ] }
  ]
};

require(enginePath);

if (!global.OrgLib) {
  console.log('FAIL  biblioteca compartilhada nao foi carregada pelo motor');
  process.exit(1);
}

const r1 = JSON.parse(global.aeft_organizeWithPreset('media_only', JSON.stringify(preset)));

if (SCALE) {
  const itemsBefore = project.items.length;
  const s2 = JSON.parse(global.aeft_organizeWithPreset('media_only', JSON.stringify(preset)));
  console.log('CENARIO ESCALA: itens=' + itemsBefore +
    ' | exec1 scanCount=' + r1.scanCount + ' elapsedMs=' + r1.elapsedMs + ' moved=' + r1.movedFootages +
    ' | exec2 scanCount=' + s2.scanCount + ' elapsedMs=' + s2.elapsedMs + ' moved=' + s2.movedFootages);
  process.exit(r1.success && s2.success ? 0 : 1);
}

check('lib compartilhada carregada pelo motor', !!global.OrgLib);
check('execucao retorna success', r1.success === true, JSON.stringify(r1));
check('instrumentacao expoe elapsedMs', typeof r1.elapsedMs === 'number', r1.elapsedMs);
check('instrumentacao expoe scanCount', typeof r1.scanCount === 'number', r1.scanCount);
check('moveu as 3 midias', r1.movedFootages === 3, r1.movedFootages);

const pMp4 = pathOf(clipMp4), pPng = pathOf(imgPng), pWav = pathOf(audioWav);
console.log('   a.mp4 -> ' + pMp4.join(' / '));
console.log('   b.png -> ' + pPng.join(' / '));
console.log('   c.wav -> ' + pWav.join(' / '));
console.log(dump(root, 0, []).join('\n'));

check('mp4 em Footages/MP4/PastaA', pMp4.some(function (n) { return /Footages/.test(n); }) && pMp4.indexOf('MP4') !== -1 && pMp4.indexOf('PastaA') !== -1, pMp4.join('/'));
check('png em Images/PNG/PastaB', pPng.some(function (n) { return /Images/.test(n); }) && pPng.indexOf('PNG') !== -1 && pPng.indexOf('PastaB') !== -1, pPng.join('/'));
check('wav em Audios/WAV sem pasta de origem', pWav.some(function (n) { return /Audios/.test(n); }) && pWav.indexOf('WAV') !== -1 && pWav.indexOf('PastaC') === -1, pWav.join('/'));
check('comp permanece na raiz (Apenas Midias)', comp.parentFolder === root, pathOf(comp).join('/'));
check('numeracao sequencial aplicada em Assets', /^\d{2}_Assets$/.test(pMp4[0]), pMp4[0]);

const folderCount1 = project.items.filter(function (i) { return i instanceof FolderItem; }).length;
const r2 = JSON.parse(global.aeft_organizeWithPreset('media_only', JSON.stringify(preset)));
const folderCount2 = project.items.filter(function (i) { return i instanceof FolderItem; }).length;
check('reexecucao nao move nada', r2.movedFootages === 0, r2.movedFootages);
check('reexecucao nao duplica pastas', folderCount1 === folderCount2, folderCount1 + ' -> ' + folderCount2);
check('reexecucao mantem caminhos', pathOf(clipMp4).join('/') === pMp4.join('/'), pathOf(clipMp4).join('/'));
check('scanCount contido (<= 40)', r1.scanCount <= 40, r1.scanCount);

// Motor legado (host/legacy/aeft_legacy.jsx) deve carregar sob demanda sem quebrar o motor atual
const legacyPath = path.join(__dirname, '..', '..', 'host', 'legacy', 'aeft_legacy.jsx');
check('arquivo do motor legado presente', fs.existsSync(legacyPath), legacyPath);
if (fs.existsSync(legacyPath)) {
  require(legacyPath);
  check('motor legado carrega sob demanda', typeof global.aeft_organizeAEProject === 'function');
  check('motor atual continua disponivel apos carregar o legado', typeof global.aeft_organizeWithPreset === 'function');
}

console.log('\nRESULTADO ae_engine_test: ' + ok + ' PASS / ' + fail + ' FAIL');
process.exit(fail === 0 ? 0 : 1);