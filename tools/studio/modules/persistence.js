import { FACTORY_TOKENS } from './defaults.js';
import { PANEL_CONFIGS } from './catalog.js';
import { showToast } from './dom.js';
import { applyAllTokensToFrames, syncControlsFromTokens } from './tokens.js';
import { extractCleanRegionHtml } from './serialize.js';
import { studioState } from './state.js';

var saveTimer = null;
var isSaving = false;
var pendingSave = false;
var pendingHtml = false;
export function normalizeKnownDesignIssues() {
  var rollbackRowKey = '[data-tf-design="main-rollback-row"]';
  var rollbackRow = studioState.currentDesigns[rollbackRowKey];
  if (rollbackRow && rollbackRow.active && rollbackRow.active.width === '348px' && rollbackRow.active.height === '68px') {
    delete rollbackRow.active;
    if (!Object.keys(rollbackRow).length) delete studioState.currentDesigns[rollbackRowKey];
  }
  var rollbackLabel = studioState.currentDesigns['[data-tf-design="main-rollback-label"]'];
  var rollbackRest = rollbackLabel && rollbackLabel.rest;
  if (rollbackRest && rollbackRest['font-size'] === '16px' && rollbackRest.height === '45px' && rollbackRest['line-height'] === '21.5px') {
    rollbackRest['font-size'] = '13px';
    rollbackRest['line-height'] = '17px';
    delete rollbackRest.height;
  }
  var legacyLabelMigrations = [
    ['[data-tf-design="main-organize-label"]', '#btnOrganize', ['color', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'text-align', 'text-transform']],
    ['[data-tf-design="main-rollback-label"]', '#btnRollback', null],
    ['[data-tf-design="editor-numbering-label"]', '[data-tf-design="editor-numbering-toggle"]', null],
    ['[data-tf-design="editor-source-toggle-label"]', '[data-tf-design="editor-source-toggle"]', null],
    ['[data-tf-design="main-save-toggle-label"]', '[data-tf-design="main-save-toggle"]', null],
    ['[data-tf-design="main-empty-toggle-label"]', '[data-tf-design="main-empty-toggle"]', null]
  ];
  legacyLabelMigrations.forEach(function (pair) {
    var oldKey = pair[0], newKey = pair[1], allowedProps = pair[2];
    if (!studioState.currentDesigns[oldKey]) return;
    studioState.currentDesigns[newKey] = studioState.currentDesigns[newKey] || {};
    ['rest', 'hover', 'active', 'checked', 'checkedHover', 'indeterminate'].forEach(function (st) {
      var src = studioState.currentDesigns[oldKey][st];
      if (!src) return;
      studioState.currentDesigns[newKey][st] = studioState.currentDesigns[newKey][st] || {};
      Object.keys(src).forEach(function (prop) {
        if (allowedProps && allowedProps.indexOf(prop) < 0) return;
        if (studioState.currentDesigns[newKey][st][prop] === undefined) {
          studioState.currentDesigns[newKey][st][prop] = src[prop];
        }
      });
    });
    delete studioState.currentDesigns[oldKey];
  });
}
export function scheduleSaveToDisk(includeHtml) {
  pendingHtml = pendingHtml || includeHtml;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(function () {
    saveTimer = null;
    saveToDiskNow(pendingHtml);
  }, 320);
}

export function saveToDiskNow(includeHtml) {
  if (isSaving) { pendingSave = true; pendingHtml = pendingHtml || includeHtml; return; }
  isSaving = true;
  pendingHtml = false;
  normalizeKnownDesignIssues();

  var payload = {
    tokens: studioState.currentTokens,
    designs: studioState.currentDesigns,
    targetPanel: studioState.currentActivePanel
  };
  if (includeHtml) {
    if (studioState.currentViewMode === "all") {
      payload.panels = {
        main: extractCleanRegionHtml("main"),
        editor: extractCleanRegionHtml("editor"),
        collect: extractCleanRegionHtml("collect"),
        overlays: extractCleanRegionHtml("overlays")
      };
    } else {
      var regionHtml = extractCleanRegionHtml(studioState.currentActivePanel);
      if (regionHtml) {
        payload.panelRegionHtml = regionHtml;
      }
    }
  }

  fetch("/api/studio/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
    .then(function (r) { return r.json(); })
    .then(function (res) {
      isSaving = false;
      if (pendingSave) { pendingSave = false; scheduleSaveToDisk(pendingHtml); }
      if (res && res.ok) {
        if (!pendingSave && !saveTimer) studioState.designDirty = false;
        showToast(
          "✓ Salvo em tokens.css" +
          (includeHtml ? " & " + (studioState.currentViewMode === "all" ? "Todos os Painéis & Overlays" : PANEL_CONFIGS[studioState.currentActivePanel].fileName) : "")
        );
      } else {
        showToast("⚠️ Erro ao salvar: " + (res && res.error ? res.error : "Desconhecido"));
      }
    })
    .catch(function (err) {
      isSaving = false;
      showToast("⚠️ Erro de conexão com servidor local: " + err.message);
    });
}

export function fetchStateFromDisk() {
  if (isSaving || pendingSave || pendingHtml || saveTimer || studioState.designDirty) return;
  fetch("/api/studio/state")
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (!data || !data.ok || !data.tokens) return;
      studioState.currentTokens = Object.assign({}, FACTORY_TOKENS, data.tokens);
      studioState.currentDesigns = data.designs || {};
      syncControlsFromTokens();
      applyAllTokensToFrames();
    })
    .catch(function () { });
}
