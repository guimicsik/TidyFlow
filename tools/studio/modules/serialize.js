import { frameMain, frameEditor, frameCollect, frameOverlays } from './dom.js';

// ========================================================================
// PERSISTÊNCIA EM DISCO MULTI-PAINEL
// ========================================================================
export function extractCleanRegionHtml(panelKey) {
  var frame =
    panelKey === "editor"
      ? frameEditor
      : panelKey === "collect"
        ? frameCollect
        : panelKey === "overlays"
          ? frameOverlays
          : frameMain;
  if (!frame) return null;
  var doc;
  try { doc = frame.contentDocument; } catch (e) { return null; }
  if (!doc || !doc.body) return null;

  var cloneBody = doc.body.cloneNode(true);

  // Desfaz o custom dropdown do selectEl se presente em qualquer painel (main ou editor)
  var selectWrappers = cloneBody.querySelectorAll(".tf-select-wrapper");
  for (var w = 0; w < selectWrappers.length; w++) {
    var sw = selectWrappers[w];
    var pSelect = sw.querySelector("#presetSelect, select");
    if (pSelect) {
      pSelect.style.display = "";
      if (sw.parentNode) sw.parentNode.insertBefore(pSelect, sw);
    }
    if (sw.parentNode) sw.parentNode.removeChild(sw);
  }
  var orphanSelectEls = cloneBody.querySelectorAll(".tf-select-wrapper, .tf-select-trigger, .tf-select-menu");
  for (var o = 0; o < orphanSelectEls.length; o++) {
    if (orphanSelectEls[o].parentNode) orphanSelectEls[o].parentNode.removeChild(orphanSelectEls[o]);
  }

  function removeBoundaryAndSubsequent(boundaryEl) {
    if (!boundaryEl) return;
    var prev = boundaryEl.previousSibling;
    while (prev && (prev.nodeType === 8 || (prev.nodeType === 3 && !prev.textContent.trim()))) {
      var pNext = prev.previousSibling;
      if (prev.parentNode) prev.parentNode.removeChild(prev);
      prev = pNext;
    }
    var cur = boundaryEl;
    while (cur) {
      var next = cur.nextSibling;
      if (cur.parentNode) cur.parentNode.removeChild(cur);
      cur = next;
    }
  }

  if (panelKey === "main") {
    removeBoundaryAndSubsequent(cloneBody.querySelector("#rollbackModalBackdrop"));
  } else if (panelKey === "editor") {
    removeBoundaryAndSubsequent(cloneBody.querySelector("#labelPopover"));
  } else if (panelKey === "collect") {
    removeBoundaryAndSubsequent(cloneBody.querySelector("#commentsBackdrop"));
  }

  var scripts = cloneBody.querySelectorAll("script");
  for (var s = 0; s < scripts.length; s++) {
    scripts[s].remove();
  }
  var helperStyles = cloneBody.querySelectorAll("#studio-helper-style, #studio-google-fonts");
  for (var h = 0; h < helperStyles.length; h++) {
    helperStyles[h].remove();
  }
  var draggables = cloneBody.querySelectorAll("[data-st-draggable]");
  for (var d = 0; d < draggables.length; d++) {
    if (draggables[d].getAttribute("data-st-was-disabled") === "1") {
      draggables[d].setAttribute("disabled", "");
      draggables[d].removeAttribute("data-st-was-disabled");
    }
    draggables[d].removeAttribute("data-st-draggable");
    draggables[d].removeAttribute("draggable");
    draggables[d].classList.remove("st-drop-target");
  }
  var selectedEls = cloneBody.querySelectorAll(".st-element-selected");
  for (var sel = 0; sel < selectedEls.length; sel++) {
    selectedEls[sel].classList.remove("st-element-selected");
  }

  // Estados de execução são transitórios e nunca pertencem ao HTML salvo.
  if (panelKey === "main") {
    ["presetSelect", "btnOpenPresetBuilder", "btnOrganize", "btnCreateStructure", "btnMediaOnly", "btnOpenCollect", "chkSaveProject", "chkDeleteEmptyFolders", "btnCheckUnused", "btnRollback"].forEach(function (id) {
      var control = cloneBody.querySelector("#" + id);
      if (control) control.removeAttribute("disabled");
    });
    var statusClone = cloneBody.querySelector("#statusMsg");
    if (statusClone) {
      statusClone.textContent = "";
      statusClone.removeAttribute("class");
    }
  } else if (panelKey === "editor") {
    ["lblSeparateAudioCategories", "lblNumberAudioCategories"].forEach(function (id) {
      var lbl = cloneBody.querySelector("#" + id);
      if (lbl) lbl.classList.remove("is-disabled");
    });
    ["chkSeparateAudioCategories", "chkNumberAudioCategories"].forEach(function (id) {
      var chk = cloneBody.querySelector("#" + id);
      if (chk) chk.removeAttribute("disabled");
    });
  } else if (panelKey === "collect") {
    ["btnCollect", "btnCalculate", "btnCancel", "btnComments", "btnBrowseDest"].forEach(function (id) {
      var control = cloneBody.querySelector("#" + id);
      if (control) control.removeAttribute("disabled");
    });
    var collectStatusClone = cloneBody.querySelector("#statusLine");
    if (collectStatusClone) {
      collectStatusClone.textContent = "";
      collectStatusClone.className = "collect-status";
    }
    var mockTargetList = cloneBody.querySelector('#targetList[data-st-mock-tree="1"]');
    if (mockTargetList) {
      mockTargetList.removeAttribute("data-st-mock-tree");
      mockTargetList.innerHTML = '<div class="collect-target-empty">Nenhuma composição encontrada no projeto.</div>';
    }
  }

  var cleanHtml = cloneBody.innerHTML.trim();
  if (panelKey !== "overlays") {
    cleanHtml = cleanHtml
      .replace(/(?:\s*<!--\s*(?:Modal de Confirmação de Rollback|Popover Flutuante de Seleção de Color Label|Modal de Comentários)[^-]*-->\s*)+$/gi, "")
      .replace(/<!-- (?:Modal de Confirmação|Popover Flutuante|Modal de Comentários)[\s\S]*$/, "")
      .trim();
  }

  return cleanHtml;
}
