/* ==========================================================================
   TidyFlow — Testes estáticos de referências de DOM (cliente CEP)
   Garante que todo getElementById/querySelector usado no JS exista no HTML.
   Isso evita código morto silencioso (ex.: campos de extensão do modal).
   ========================================================================== */
"use strict";

var nodeFs = require("fs");
var nodePath = require("path");
var harnessLib = require("./lib/harness");

var REPO_ROOT = nodePath.resolve(__dirname, "..", "..");
var h = harnessLib.createHarness("Refs de DOM");
var test = h.test;
var assert = h.assert;

function studioPage() {
  return require("../../tools/studio/render-html.cjs").renderStudioHtml(nodePath.join(REPO_ROOT, "tools/studio"));
}

function read(relPath) {
  return nodeFs.readFileSync(nodePath.join(REPO_ROOT, relPath), "utf8");
}

function collectHtmlIds(html) {
  var ids = {};
  var re = /\bid="([^"]+)"/g;
  var match;
  while ((match = re.exec(html)) !== null) {
    ids[match[1]] = true;
  }
  return ids;
}

function collectJsRefs(js) {
  var refs = {};
  var patterns = [
    /getElementById\(\s*["']([^"']+)["']\s*\)/g,
    /querySelector(?:All)?\(\s*["']#([A-Za-z0-9_-]+)["']\s*\)/g
  ];
  for (var p = 0; p < patterns.length; p++) {
    var match;
    var re = new RegExp(patterns[p].source, "g");
    while ((match = re.exec(js)) !== null) {
      refs[match[1]] = (refs[match[1]] || 0) + 1;
    }
  }
  return refs;
}

function checkPair(label, jsFile, htmlFile, htmlIds) {
  var js = read(jsFile);
  var refs = collectJsRefs(js);
  var missing = [];
  for (var id in refs) {
    if (!refs.hasOwnProperty(id)) continue;
    if (!htmlIds[id]) missing.push(id);
  }
  assert.deepEq(
    missing.sort(),
    [],
    label + ": " + jsFile + " referencia IDs que não existem em " + htmlFile
  );
}

var editorHtmlIds = collectHtmlIds(read("client/tree_editor.html"));
var panelHtmlIds = collectHtmlIds(read("client/index.html"));

test("todos os scripts de client/*.js são sintaticamente válidos", function () {
  var clientFiles = [
    "client/OrgLog.js",
    "client/PresetManager.js",
    "client/CollectEngine.js",
    "client/main.js",
    "client/tree_editor.js",
    "client/collect.js"
  ];
  for (var i = 0; i < clientFiles.length; i++) {
    var src = read(clientFiles[i]);
    try {
      // eslint-disable-next-line no-new-func
      new Function(src);
    } catch (e) {
      throw new Error("Erro de sintaxe em " + clientFiles[i] + ": " + e.message);
    }
  }
});

test("tree_editor.js só usa IDs presentes em tree_editor.html", function () {
  checkPair("Editor de presets", "client/tree_editor.js", "client/tree_editor.html", editorHtmlIds);
});

test("main.js só usa IDs presentes em index.html", function () {
  checkPair("Painel", "client/main.js", "client/index.html", panelHtmlIds);
});

test("Design Studio: módulos são sintaticamente válidos e todos os data-token existem em tokens.css", function () {
  var dir = "tools/studio/modules/";
  var modules = nodeFs.readdirSync(nodePath.join(REPO_ROOT, dir)).filter(name => name.endsWith(".js"));
  for (const file of ["tools/studio/studio.js", ...modules.map(name => dir + name)]) {
    require("child_process").execFileSync(process.execPath, ["--check", file], { cwd: REPO_ROOT });
  }
  assert.includes(read("tools/studio/modules/inspector-colors.js"), "cloneNode(false)", "inspetor deve medir cores fora do :hover real do elemento selecionado");
  assert.includes(read("tools/studio/modules/inspector-colors.js"), "getComputedStyle(sample)", "inspetor deve usar a cópia neutra ao comparar repouso, hover e clique");
  assert.includes(read("tools/studio/modules/palettes.js"), "COLOR_STATE_PRESETS", "inspetor deve oferecer presets rápidos de cores por estado");
  assert.includes(read("tools/studio/modules/selection.js"), "currentSelectedElements", "Modo Editar deve suportar seleção múltipla via Shift+Clique");
  assert.includes(read("tools/studio/modules/preview.js"), "Boolean(ev.shiftKey)", "clique no Modo Editar deve propagar Shift para seleção múltipla");

  var studioHtml = studioPage();
  var tokensCss = read("client/theme/tokens.css");
  var tokenRe = /data-token="(--tf-[a-zA-Z0-9_-]+)"/g;
  var m;
  var missingTokens = [];
  while ((m = tokenRe.exec(studioHtml)) !== null) {
    var tok = m[1];
    if (tokensCss.indexOf(tok + ":") === -1) {
      missingTokens.push(tok);
    }
  }
  assert.deepEq(missingTokens, [], "studio.html referencia tokens ausentes em client/theme/tokens.css");
});

test("Design Studio: vite.config.js carrega plugin do Studio sem erros", function () {
  var cfg = require("../../vite.config.js");
  assert.ok(cfg && Array.isArray(cfg.plugins) && cfg.plugins.length > 0, "plugin do Studio deve estar registrado no vite.config.js");
  assert.eq(cfg.plugins[0].name, "tidyflow-design-studio", "nome do plugin do Studio esperado");
});

test("modal de regras V2 unifica Seção 1 com caixa inline de tags específicas (MANIFESTO §2.1)", function () {
  var html = read("client/tree_editor.html");
  var js = read("client/tree_editor.js");
  assert.includes(html, 'class="modal-card modal-card-rules"', "card compacto V2 do modal de regras ausente");
  assert.includes(html, 'id="inpNewExtension"', "input inline de formato específico ausente");
  assert.includes(html, 'id="extTagsContainer"', "container inline de formatos específicos ausente");
  assert.includes(html, 'id="extChipsList"', "lista inline de chips de formatos ausente");
  assert.notIncludes(html, 'class="rule-pack-chk"', "pacotes de extensão redundantes (antiga Seção 3) devem ser removidos");
  assert.notIncludes(html, 'class="info-icon"', "ícones (i) devem ser substituídos por tooltip direto no hover do botão");
  assert.includes(js, 'ev.code === "Space"', "apertar Espaço deve salvar a tag de formato específico");
});

test("chips de formato e nomenclatura compartilham estilo e grid V2 mantém 3 colunas / centralização", function () {
  var css = read("client/tree_editor.css");
  assert.includes(css, ".inline-ext-tags-box", "estilo da caixa inline de formatos específicos ausente no CSS");
  assert.includes(css, ".behavior-grid-v2", "grid de 2 linhas da Seção 2 ausente no CSS");
  assert.includes(css, ".ext-tags-box", "estilo do container de chips de nomenclatura ausente no CSS");
  assert.includes(css, ".ext-tag", "estilo do chip ausente no CSS");
});

test("tree_editor.js não referencia controles removidos da UI", function () {
  var js = read("client/tree_editor.js");
  assert.notIncludes(js, 'getElementById("btnSavePreset")', "btnSavePreset não existe mais na UI");
  assert.notIncludes(js, 'getElementById("inpUnusedFolderName")', "campo de nome da pasta de não usadas foi removido da UI");
  assert.notIncludes(js, "chkDeleteEmptyFolders", "toggle de excluir vazias vive apenas no painel principal");
});

test("editor de presets possui os toggles clicáveis (.tf-toggle) de Numeração, Pasta de origem e ESP", function () {
  var html = read("client/tree_editor.html");
  assert.includes(html, 'id="chkSeparateAudioCategories"', "chkSeparateAudioCategories deve existir no HTML");
  assert.includes(html, 'id="chkNumberAudioCategories"', "chkNumberAudioCategories deve existir no HTML");
  assert.includes(html, 'id="chkUsePrefixNumbering"', "chkUsePrefixNumbering deve existir no HTML");
  assert.includes(html, 'id="chkGroupBySourceFolder"', "chkGroupBySourceFolder deve existir no Preset Builder");
  assert.includes(html, 'class="tf-toggle editor-setting-toggle"', "barra de configurações do Preset Builder deve usar botões clicáveis .tf-toggle");
});

test("painel principal mantém os controles documentados no manifesto", function () {
  var panelHtml = read("client/index.html");
  var required = [
    "presetSelect",
    "btnOrganize",
    "btnCreateStructure",
    "btnMediaOnly",
    "btnOpenCollect",
    "btnRollback",
    "chkSaveProject",
    "chkDeleteEmptyFolders",
    "btnCheckUnused"
  ];
  for (var i = 0; i < required.length; i++) {
    assert.ok(panelHtmlIds[required[i]], "index.html deve conter #" + required[i]);
  }
  assert.ok(!panelHtmlIds.chkPrefixNumbering, "Numeração Sequencial deve ficar apenas no Preset Builder");
  assert.ok(!panelHtmlIds.chkGroupBySourceFolder, "Pasta de origem deve ficar apenas no Preset Builder");
  assert.ok(!panelHtmlIds.chkReduceProject, "Redução de projeto unificada no Collect Files");
  assert.notIncludes(panelHtml, "Organizando projeto...", "estado transitório de organização não pode ser salvo no HTML");
  assert.ok(!/<(?:button|select|input)[^>]+(?:id="(?:presetSelect|btnOpenPresetBuilder|chkSaveProject|chkDeleteEmptyFolders|btnRollback)")[^>]*disabled/i.test(panelHtml), "controles do painel não podem ser salvos no estado busy");
  assert.includes(read("client/theme/tokens.css"), "--tf-rollback-justify: center;", "botão de rollback deve permanecer centralizado");
  var studioDesign = JSON.parse(read("client/theme/studio-design.json"));
  assert.ok(!studioDesign['[data-tf-design="main-rollback-row"]'] || !studioDesign['[data-tf-design="main-rollback-row"]'].active, "linha do rollback não pode mudar de geometria no clique");
});

test("P8: fluxos destrutivos de preset pedem confirmação antes de sobrescrever", function () {
  var js = read("client/tree_editor.js");
  assert.includes(js, 'code === "PRESET_EXISTS"', "importação deve tratar o conflito de nome");
  assert.includes(js, "function importPresetJson", "importação deve passar pelo fluxo com confirmação");
  assert.includes(js, "function doSaveAs", "Salvar como deve separar a confirmação da gravação");

  // As duas chamadas antigas (sem confirmação) não podem voltar
  assert.notIncludes(
    js,
    "importPresetFromJsonString(raw)",
    "importação não pode gravar direto sem confirmação"
  );
  assert.notIncludes(
    js,
    "importPresetFromJsonString(e.target.result)",
    "importação via FileReader não pode gravar direto sem confirmação"
  );
});

test("P8: handlers de sincronização respeitam edições não salvas (isDirty)", function () {
  var js = read("client/tree_editor.js").replace(/\r\n/g, "\n");

  // Troca de preset no <select> não pode descartar edições sem confirmar
  assert.includes(
    js,
    "openConfirmModal(\n        \"Alterações não salvas\"",
    "troca de preset com isDirty deve pedir confirmação"
  );

  // Listener do focus não pode reaplicar o disco sobre o trabalho em andamento
  var focusIdx = js.indexOf('window.addEventListener("focus"');
  assert.ok(focusIdx !== -1, "listener de focus ausente");
  var focusBody = js.substring(focusIdx, focusIdx + 400);
  assert.includes(focusBody, "if (isDirty) return;", "focus deve abortar quando há edições não salvas");

  // presetsUpdated não pode recarregar outro preset por cima de edições
  assert.includes(
    js,
    "Não descartar o trabalho em andamento só porque outro painel trocou o preset",
    "presetsUpdated deve proteger edições não salvas"
  );
});

test("painel principal e tree_editor: HTML mantém estrutura limpa de presetSelect sem wrappers estáticos", function () {
  var htmlIndex = read("client/index.html");
  var selectWrapperMatchesIndex = htmlIndex.match(/class=["']tf-select-wrapper["']/g) || [];
  assert.eq(selectWrapperMatchesIndex.length, 0, "client/index.html não deve conter tf-select-wrapper estático serializado");
  var modalCommentsIndex = htmlIndex.match(/<!-- Modal de Confirmação de Rollback -->/g) || [];
  assert.ok(modalCommentsIndex.length <= 1, "client/index.html não deve ter comentários de modal duplicados");

  var htmlEditor = read("client/tree_editor.html");
  var selectWrapperMatchesEditor = htmlEditor.match(/class=["']tf-select-wrapper["']/g) || [];
  assert.eq(selectWrapperMatchesEditor.length, 0, "client/tree_editor.html não deve conter tf-select-wrapper estático serializado");
  var popoverCommentsEditor = htmlEditor.match(/<!-- Popover Flutuante de Seleção de Color Label/g) || [];
  assert.ok(popoverCommentsEditor.length <= 1, "client/tree_editor.html não deve ter comentários de popover duplicados");
});

test("Design Studio: serialização de HTML é idempotente e não duplica comentários ou wrappers em múltiplos salvamentos", function () {
  var cfg = require("../../vite.config.js");
  var helpers = cfg._helpers;
  assert.ok(helpers, "helpers de serialização do Studio devem estar expostos");

  var htmlIndex = read("client/index.html");
  var bodyMatchIndex = htmlIndex.match(/<body[^>]*>([\s\S]*?)<div id="rollbackModalBackdrop"/i);
  var regionIndex = bodyMatchIndex ? bodyMatchIndex[1].trim() : "";

  // Simula múltiplos salvamentos consecutivos do painel principal (incluindo se a região contiver comentários)
  var currentHtml = htmlIndex;
  for (var i = 0; i < 5; i++) {
    currentHtml = helpers.updateMainRegionInIndexHtml(currentHtml, regionIndex + "\n  <!-- Modal de Confirmação de Rollback -->");
    var count = (currentHtml.match(/<!-- Modal de Confirmação de Rollback -->/g) || []).length;
    assert.eq(count, 1, "comentário de modal deve aparecer exatamente 1 vez após " + (i + 1) + " salvamentos");
  }

  // Simula múltiplos salvamentos consecutivos do Preset Builder
  var htmlEditor = read("client/tree_editor.html");
  var bodyMatchEditor = htmlEditor.match(/<body[^>]*>([\s\S]*?)<div id="labelPopover"/i);
  var regionEditor = bodyMatchEditor ? bodyMatchEditor[1].trim() : "";

  var currentEditorHtml = htmlEditor;
  for (var j = 0; j < 5; j++) {
    currentEditorHtml = helpers.updateMainRegionInEditorHtml(currentEditorHtml, regionEditor + "\n  <!-- Popover Flutuante de Seleção de Color Label (0 a 16) -->");
    var countEditor = (currentEditorHtml.match(/<!-- Popover Flutuante de Seleção de Color Label/g) || []).length;
    assert.eq(countEditor, 1, "comentário de popover deve aparecer exatamente 1 vez após " + (j + 1) + " salvamentos");
  }

  // Simula múltiplos salvamentos consecutivos do Collect Files
  var htmlCollect = read("client/collect.html");
  var bodyMatchCollect = htmlCollect.match(/<body[^>]*>([\s\S]*?)<div id="commentsBackdrop"/i);
  var regionCollect = bodyMatchCollect ? bodyMatchCollect[1].trim() : "";

  var currentCollectHtml = htmlCollect;
  for (var k = 0; k < 5; k++) {
    currentCollectHtml = helpers.updateMainRegionInCollectHtml(currentCollectHtml, regionCollect + "\n  <!-- Modal de Comentários (gravados no Report.txt) -->");
    var countCollect = (currentCollectHtml.match(/<!-- Modal de Comentários/g) || []).length;
    assert.eq(countCollect, 1, "comentário de comentários deve aparecer exatamente 1 vez após " + (k + 1) + " salvamentos");
  }
});

test("Design Studio: syncOverlaysToClientFiles sincroniza modais de overlays.html para index.html e tree_editor.html", function () {
  var cfg = require("../../vite.config.js");
  var helpers = cfg._helpers;
  assert.ok(helpers.syncOverlaysToClientFiles, "helper syncOverlaysToClientFiles deve estar exposto");
  assert.ok(helpers.findDivBoundsById, "helper findDivBoundsById deve estar exposto");
  assert.ok(helpers.findDivBoundsByClass, "helper findDivBoundsByClass deve estar exposto");

  var overlaysHtml = read("tools/studio/overlays.html");
  // Simula modificação do texto no modal de rollback
  var modifiedOverlays = overlaysHtml.replace(
    'id="lblRollbackText">Deseja salvar o projeto antes de continuar?</p>',
    'id="lblRollbackText">Texto de teste Rollback modificado com sucesso!</p>'
  );

  var fs = require("fs");
  var os = require("os");
  var path = require("path");
  var tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tidyflow-overlays-"));
  var indexPath = path.join(tempDir, "index.html");
  var editorPath = path.join(tempDir, "tree_editor.html");
  var indexHtml;
  var editorHtml;
  try {
    fs.writeFileSync(indexPath, read("client/index.html"));
    fs.writeFileSync(editorPath, read("client/tree_editor.html"));
    helpers.syncOverlaysToClientFiles(modifiedOverlays, { index: indexPath, editor: editorPath });
    indexHtml = fs.readFileSync(indexPath, "utf8");
    editorHtml = fs.readFileSync(editorPath, "utf8");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  // Verifica persistência da modificação do Rollback em index.html
  assert.includes(indexHtml, 'id="rollbackModalBackdrop"', "index.html deve conter #rollbackModalBackdrop");
  assert.includes(indexHtml, 'id="btnRollbackSaveAndContinue"', "index.html deve conter #btnRollbackSaveAndContinue");
  assert.includes(indexHtml, 'id="btnRollbackContinueWithoutSave"', "index.html deve conter #btnRollbackContinueWithoutSave");
  assert.includes(indexHtml, 'id="btnRollbackCancel"', "index.html deve conter #btnRollbackCancel");
  assert.includes(indexHtml, "Texto de teste Rollback modificado com sucesso!", "index.html deve conter o texto modificado do Rollback");

  // Verifica integridade dos modais sincronizados em tree_editor.html
  assert.includes(editorHtml, 'id="rulesModalBackdrop"', "tree_editor.html deve conter #rulesModalBackdrop");
  assert.includes(editorHtml, 'id="btnClearAllExts"', "tree_editor.html deve manter #btnClearAllExts");
  assert.includes(editorHtml, 'id="btnClearAllNameTags"', "tree_editor.html deve manter #btnClearAllNameTags");
  assert.includes(editorHtml, 'id="saveAsModalBackdrop"', "tree_editor.html deve conter #saveAsModalBackdrop");
  assert.includes(editorHtml, 'id="unsavedCloseModalBackdrop"', "tree_editor.html deve conter #unsavedCloseModalBackdrop");
  assert.includes(editorHtml, 'id="btnUnsavedSaveClose"', "tree_editor.html deve manter #btnUnsavedSaveClose");
  assert.includes(editorHtml, 'id="btnUnsavedDiscard"', "tree_editor.html deve manter #btnUnsavedDiscard");
  assert.includes(editorHtml, 'id="btnUnsavedCancel"', "tree_editor.html deve manter #btnUnsavedCancel");
});

test("Studio: estilos individuais preservam estados e rejeitam regras fora do modelo", function () {
  var model = require('../../tools/studio/design-model.cjs');
  var shadowCss = model.shadowCss({ '--tf-studio-shadow-btnCollect': 'none', '--tf-neo-bg': '#fff' });
  assert.eq(shadowCss, '#btnCollect:hover, body.tf-force-hover #btnCollect { box-shadow: var(--tf-studio-shadow-btnCollect) !important; }', 'a prévia e o arquivo salvo devem gerar a mesma sombra');
  var designs = {'#btnCollect': {rest: {color:'#ffffff'}, hover: {'box-shadow':'4px 4px 0 #000'}}};
  var css = model.css(JSON.parse(JSON.stringify(designs)));
  assert.includes(css, '#btnCollect:hover', 'hover deve ter seletor próprio');
  assert.includes(css, 'body.tf-force-hover #btnCollect', 'estado simulado deve usar a mesma regra');
  assert.includes(css, 'color: #ffffff !important', 'cor deve ser preservada');
  var layoutCss = model.css({'#btnCollect': {rest:{display:'flex','align-items':'center','grid-template-columns':'repeat(2, 1fr)'}}});
  assert.includes(layoutCss, 'grid-template-columns: repeat(2, 1fr) !important', 'layout avançado deve persistir no CSS');
  var staticCss = model.css({'[data-tf-design="tag-Teste"]': {hoverMotion:false, hover:{color:'#ff0000'}}});
  assert.includes(staticCss, 'transition: none !important', 'tag estática deve desligar transição');
  assert.ok(staticCss.lastIndexOf('transform: none !important') > staticCss.lastIndexOf('color: #ff0000 !important'), 'estado estático deve prevalecer sobre hover');
  var animatedCss = model.css({'#badgeBuiltIn': {hoverMotion:true}});
  assert.includes(animatedCss, 'transform: translate(-2px, -2px) !important', 'hover habilitado deve deslocar tag');
  var checkedCss = model.css({'[data-tf-design="editor-numbering-toggle"]': {checked:{color:'#00ff00','font-weight':'900'}}});
  assert.includes(checkedCss, 'input:checked + .tf-toggle__face', 'toggle ativado deve propagar estilos para .tf-toggle__face');
  assert.includes(checkedCss, 'body.tf-force-checked [data-tf-design="editor-numbering-toggle"]', 'Studio deve simular o estado ativado');
  assert.includes(checkedCss, 'font-weight: 900 !important', 'tipografia do toggle ativado deve ser preservada');
  var toggleHoverCss = model.css({
    '[data-tf-design="main-empty-toggle"]': {
      rest: { 'background-color': '#27272A' },
      checked: { 'background-color': '#4ADE80' },
      hover: { 'background-color': '#FF88FF' },
      checkedHover: { 'background-color': '#86EFAC' },
      active: { 'background-color': '#8F8F9A' }
    }
  });
  assert.includes(toggleHoverCss, ':not(.active):not(.is-disabled):hover input[type="checkbox"]:not(:checked):not(:disabled) + .tf-toggle__face', 'hover normal em :hover só deve aplicar quando desativado e habilitado');
  assert.includes(toggleHoverCss, ':not(.is-disabled) input:checked:not(:disabled) + .tf-toggle__face', 'toggle desabilitado não deve exibir estilo ativado');
  assert.includes(toggleHoverCss, '.tf-toggle input:disabled + .tf-toggle__face', 'toggle desabilitado deve usar estilo de repouso');
  assert.includes(toggleHoverCss, 'body.tf-force-hover [data-tf-design="main-empty-toggle"].tf-toggle input[type="checkbox"]:checked + .tf-toggle__face', 'hover simulado deve cobrir toggle marcado');
  assert.includes(toggleHoverCss, ':hover input[type="checkbox"]:checked:not(:disabled) + .tf-toggle__face', 'hover ativado deve cobrir toggle marcado e habilitado no :hover');
  assert.includes(toggleHoverCss, 'body.tf-force-checked-hover [data-tf-design="main-empty-toggle"].tf-toggle .tf-toggle__face', 'Studio deve simular o estado Hover Ativado');
  assert.ok(toggleHoverCss.indexOf('#4ADE80') < toggleHoverCss.indexOf('#FF88FF'), 'hover deve ser emitido após checked');
  assert.ok(toggleHoverCss.indexOf('#FF88FF') < toggleHoverCss.indexOf('#86EFAC'), 'checkedHover deve ser emitido após hover');
  assert.ok(toggleHoverCss.indexOf('#86EFAC') < toggleHoverCss.indexOf('#8F8F9A'), 'active deve ser emitido após checkedHover');
  assert.includes(read('tools/studio/modules/individual-design.js'), "'Hover Ativado'", 'inspetor deve oferecer o estado Hover Ativado para toggles');
  var studioSource = read('tools/studio/modules/individual-design.js');
  var studioHtml = studioPage();
  assert.includes(studioHtml, 'class="st-inspector-panel st-inspector-right"', 'inspetor de núcleo deve abrir como painel no lado direito');
  assert.includes(studioSource, "'Ativado'", 'inspetor deve oferecer o estado Ativado para toggles');
  assert.includes(read('tools/studio/modules/effects.js'), 'applyDiagonalShadowAndLift', 'inspetor deve oferecer controle unificado de sombra diagonal e elevação');
  assert.includes(read('tools/studio/modules/property-config.js'), 'Espaço limite dentro do botão', 'inspetor deve oferecer controle de espaço limite interno na área de texto');
  assert.includes(read('tools/studio/modules/forced-state.js'), 'tf-force-checked', 'simulador deve aplicar a classe do estado ativado');
  assert.includes(read('tools/studio/modules/preview.js'), 'Ação bloqueada na prévia do Studio', 'preview deve bloquear ações operacionais fora do Adobe');
  assert.includes(read('tools/studio/modules/serialize.js'), 'statusClone.textContent = ""', 'serialização deve limpar status transitório do painel');
  rejected = false;
  try { model.css({'#badgeBuiltIn': {hoverMotion:'false'}}); } catch (e) { rejected = true; }
  assert.ok(rejected, 'controle de hover deve exigir booleano');
  var rejected = false;
  try { model.css({'body': {rest:{color:'red'}}}); } catch (e) { rejected = true; }
  assert.ok(rejected, 'seletor genérico deve ser rejeitado');
  rejected = false;
  try { model.css({'#btnCollect': {rest:{color:'red; display:none'}}}); } catch (e) { rejected = true; }
  assert.ok(rejected, 'declaração injetada deve ser rejeitada');
});

test("Preset Builder: botões independentes (01_/OFF e ↑ ↓ + −) não compartilham estilos entre si ou com a barra do topo", function () {
  var treeJs = read("client/tree_editor.js");
  var treeCss = read("client/tree_editor.css");
  var studioHtml = studioPage();
  var studioDesign = JSON.parse(read("client/theme/studio-design.json"));

  assert.includes(treeJs, 'isPrefixActive ? "folder-prefix" : "folder-prefix-off"', "01_ e OFF devem possuir chaves data-tf-design separadas");
  assert.includes(treeCss, "--tf-editor-prefix-on-bg", ".prefix-preview ativo deve usar token dedicado");
  assert.includes(treeCss, "--tf-editor-prefix-off-bg", ".prefix-preview.prefix-off deve usar token dedicado");
  assert.includes(treeCss, "--tf-editor-row-btn-bg", ".row-btn deve usar token dedicado desacoplado da barra do topo");
  assert.ok(!studioDesign['[data-tf-design="folder-prefix"]'], "folder-prefix não pode sobrescrever ambos os estados via studio-design.json");
  assert.includes(studioHtml, 'id="cardEditorIndependentPrefix"', "Studio deve expor seção dedicada para botões independentes de numeração (01_ / OFF)");
  assert.includes(studioHtml, 'id="cardEditorIndependentRowButtons"', "Studio deve expor seção dedicada para botões independentes das pastas (↑ ↓ + −)");
});

module.exports = h;
