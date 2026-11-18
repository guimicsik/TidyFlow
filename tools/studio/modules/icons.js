import { setButtonIcon } from './icon-layout.js';
import { ICON_CATALOG } from './catalog.js';
import {
  frameMain,
  frameEditor,
  frameCollect,
  frameOverlays,
  chkAutoSave,
  selIconTarget,
  showToast
} from './dom.js';
import { scheduleSaveToDisk } from './persistence.js';
import { studioState } from './state.js';

// ========================================================================
// CATÁLOGO DE ÍCONES DINÂMICO
// ========================================================================
export function renderIconCatalog() {
  var grid = document.getElementById("iconCatalogGrid");
  if (!grid) return;
  grid.innerHTML = "";
  ICON_CATALOG.forEach(function (iconItem) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "st-icon-card";
    btn.innerHTML =
      (iconItem.svg || '<span style="font-size:14px;line-height:18px;">⊘</span>') +
      "<span>" + iconItem.name + "</span>";
    btn.onclick = function () {
      if (!selIconTarget) return;
      applyIconToTarget(studioState.currentActivePanel, selIconTarget.value, iconItem);
    };
    grid.appendChild(btn);
  });
}

function applyIconToTarget(panelKey, targetId, iconItem) {
  var frame =
    panelKey === "editor"
      ? frameEditor
      : panelKey === "collect"
        ? frameCollect
        : panelKey === "overlays"
          ? frameOverlays
          : frameMain;
  if (!frame) return;
  var doc;
  try { doc = frame.contentDocument; } catch (e) { return; }
  if (!doc) return;

  var btn = doc.getElementById(targetId);
  if (!btn) return;

  setButtonIcon(btn, iconItem);

  showToast("Ícone '" + iconItem.name + "' aplicado em #" + targetId);
  if (chkAutoSave && chkAutoSave.checked) {
    scheduleSaveToDisk(true);
  }
}
