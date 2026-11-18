import { PANEL_CONFIGS } from './catalog.js';
import {
  frameMain,
  frameEditor,
  frameCollect,
  frameOverlays,
  chkAutoSave,
  lblActivePanelBadge,
  showToast
} from './dom.js';
import { syncTextInputsFromDoc, extractReadableTextFromElement, applyTextToDoc } from './panel-text.js';
import { renderMagneticOrderList } from './ordering.js';
import { injectMockCollectTargets } from './collect-preview.js';
import { updateEditModeInDoc, openInspectorForElement } from './selection.js';
import { scheduleSaveToDisk } from './persistence.js';
import { studioState } from './state.js';

// ========================================================================
// PREVIEW INTERATIVO: DUPLO-CLIQUE E DRAG-AND-DROP NO PAINEL ATIVO
// ========================================================================
export function setupInteractivePreviewInDoc(panelKey) {
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
  if (!doc || !doc.body) return;

  // O preview nunca deve permanecer em estados operacionais do plugin.
  // Chamadas ao host Adobe não respondem no navegador e podem deixar o DOM
  // com controles desabilitados, que o Auto-Save acabaria serializando.
  if (panelKey === "main") {
    ["presetSelect", "btnOpenPresetBuilder", "btnOrganize", "btnCreateStructure", "btnMediaOnly", "btnOpenCollect", "chkSaveProject", "chkDeleteEmptyFolders", "btnCheckUnused", "btnRollback"].forEach(function (id) {
      var control = doc.getElementById(id);
      if (control) control.disabled = false;
    });
    var previewStatus = doc.getElementById("statusMsg");
    if (previewStatus && /Organizando|Criando estrutura|Organizando m[ií]dias|Verificando/i.test(previewStatus.textContent || "")) {
      previewStatus.textContent = "";
      previewStatus.className = "";
    }
  } else if (panelKey === "editor") {
    ["lblSeparateAudioCategories", "lblNumberAudioCategories"].forEach(function (id) {
      var lbl = doc.getElementById(id);
      if (lbl) lbl.classList.remove("is-disabled");
    });
    ["chkSeparateAudioCategories", "chkNumberAudioCategories"].forEach(function (id) {
      var chk = doc.getElementById(id);
      if (chk) chk.disabled = false;
    });
  } else if (panelKey === "collect") {
    injectMockCollectTargets(doc);
    function enableCollectPreviewControls() {
      ["btnCollect", "btnCalculate", "btnCancel", "btnComments", "btnBrowseDest"].forEach(function (id) {
        var control = doc.getElementById(id);
        if (control) control.disabled = false;
      });
      var collectStatus = doc.getElementById("statusLine");
      if (collectStatus && /After Effects ou Premiere Pro|Falha ao analisar/i.test(collectStatus.textContent || "")) {
        collectStatus.textContent = "";
        collectStatus.className = "collect-status";
      }
    }
    enableCollectPreviewControls();
    if (!doc._stCollectBtnObserver && typeof MutationObserver === "function") {
      var collectBtn = doc.getElementById("btnCollect");
      if (collectBtn) {
        doc._stCollectBtnObserver = new MutationObserver(function () {
          if (collectBtn.disabled) enableCollectPreviewControls();
        });
        doc._stCollectBtnObserver.observe(collectBtn, { attributes: true, attributeFilter: ["disabled"] });
      }
    }
  }
  if (!doc._stWheelZoomBound) {
    doc._stWheelZoomBound = true;
    doc.addEventListener('wheel', function (ev) {
      if (!ev.ctrlKey || !window.studioAdjustZoom) return;
      ev.preventDefault();
      window.studioAdjustZoom(ev.deltaY < 0 ? 10 : -10);
    }, { passive: false });
  }

  if (!doc.getElementById("studio-helper-style")) {
    var st = doc.createElement("style");
    st.id = "studio-helper-style";
    st.textContent =
      "body.st-drag-active [data-st-draggable='1'] { outline: 2px dashed #F59E0B !important; outline-offset: 2px; cursor: grab !important; }\n" +
      "body.st-drag-active [data-st-draggable='1']:active { cursor: grabbing !important; }\n" +
      ".st-drop-target { outline: 3px solid #10B981 !important; filter: brightness(1.15); }\n" +
      "body.st-edit-active * { box-sizing: border-box; }\n" +
      "body.st-edit-active .tf-btn, body.st-edit-active .preset-icon-btn, body.st-edit-active .tf-toggle, body.st-edit-active .toggle-container, body.st-edit-active .collect-check .toggle-slider, body.st-edit-active .btn-tile-label, body.st-edit-active .st-text-box, body.st-edit-active .modal-btn, body.st-edit-active .modal-title, body.st-edit-active .modal-text, body.st-edit-active .modal-subtext, body.st-edit-active .notice-text, body.st-edit-active .tree-toolbar-title, body.st-edit-active .preset-label, body.st-edit-active .collect-legend, body.st-edit-active button, body.st-edit-active label { cursor: pointer !important; }\n" +
      "body.st-edit-active .editor-setting-toggle.is-disabled { opacity: 1 !important; pointer-events: auto !important; }\n" +
      "body.st-edit-active .tf-btn:hover, body.st-edit-active .preset-icon-btn:hover, body.st-edit-active .tf-toggle:hover, body.st-edit-active .toggle-container:hover, body.st-edit-active .collect-check .toggle-slider:hover, body.st-edit-active .rule-pill:hover, body.st-edit-active button:hover, body.st-edit-active [data-tf-design^='collect-tree-']:hover { outline: 1.5px dashed #3B82F6 !important; outline-offset: 2px !important; }\n" +
      "body.st-edit-active .st-text-box { display: inline-block !important; min-width: 20px; min-height: 14px; outline: 1px dashed rgba(59, 130, 246, 0.28) !important; outline-offset: 1px !important; border-radius: 2px; transition: outline 0.12s ease; }\n" +
      "body.st-edit-active .st-text-box:hover { outline: 1.5px dashed #3B82F6 !important; outline-offset: 2px !important; background-color: rgba(59, 130, 246, 0.08) !important; }\n" +
      "body.st-edit-active button .st-text-box:not(.rule-pill), body.st-edit-active .tf-toggle .st-text-box, body.st-edit-active .toggle-container .st-text-box { outline: none !important; background-color: transparent !important; }\n" +
      "body.st-edit-active button .btn-tile-label { display: flex !important; }\n" +
      "body.st-edit-active .tf-toggle .tf-toggle__face { display: flex !important; }\n" +
      "body.st-edit-active .st-text-box:empty::before { content: '[Texto]'; color: rgba(255, 255, 255, 0.35); font-style: italic; font-size: 11px; display: inline-block; }\n" +
      ".st-element-selected { outline: 2.5px solid #3B82F6 !important; outline-offset: 2px !important; box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.35) !important; position: relative !important; }\n" +
      "body.st-edit-active .st-section-group { outline: 1px dashed rgba(255, 255, 255, 0.15) !important; outline-offset: 3px !important; border-radius: 4px; }\n" +
      "body.tf-force-rest .tf-toggle input[type='checkbox']:checked + .tf-toggle__face { background-color: var(--tf-neo-toggle-off-bg); color: var(--tf-neo-toggle-off-text); }\n" +
      "body.tf-force-rest .tf-toggle input[type='checkbox']:checked + .tf-toggle__face::after { display: none !important; }\n" +
      "body.tf-force-checked .tf-toggle .tf-toggle__face { background-color: var(--tf-neo-toggle-on-bg); color: var(--tf-neo-toggle-on-text); }\n" +
      "body.tf-force-checked-hover .tf-toggle .tf-toggle__face { background-color: var(--tf-neo-toggle-on-hover); color: var(--tf-neo-toggle-on-text); transform: translate(var(--tf-neo-lift-tile), var(--tf-neo-lift-tile)); box-shadow: var(--tf-neo-shadow-tile); }\n" +
      "body.tf-force-checked .tf-checkbox, body.tf-force-checked .toggle-slider, body.tf-force-checked-hover .tf-checkbox, body.tf-force-checked-hover .toggle-slider { background-color: var(--tf-neo-switch-on-bg, #3B82F6); }\n" +
      "body.tf-force-checked-hover .tf-checkbox, body.tf-force-checked-hover .toggle-slider { transform: translate(var(--tf-neo-lift-mini, -2px), var(--tf-neo-lift-mini, -2px)); box-shadow: var(--tf-neo-shadow-mini, 2px 2px 0px #000000); }\n" +
      "body.tf-force-checked .tf-checkbox::after, body.tf-force-checked .toggle-slider::after, body.tf-force-checked-hover .tf-checkbox::after, body.tf-force-checked-hover .toggle-slider::after { transform: translate(-50%, -60%) rotate(45deg) scale(1); }";
    doc.head.appendChild(st);
  }

  // Marca caixas de textos em todos os painéis para edição precisa estilo Illustrator
  var textSelectors = [
    ".notice-text",
    ".tree-toolbar-title",
    ".preset-bar-label",
    ".preset-label",
    ".modal-title",
    ".modal-text",
    ".modal-subtext",
    ".collect-modal-text",
    "#groupSourceNote",
    "#editorStatus",
    "#lblTargetTitle",
    ".collect-legend",
    ".collect-stats-label",
    ".collect-disk-lbl",
    ".collect-stats-val",
    ".toggle-container span:not(.toggle-slider)",
    ".collect-check span:not(.toggle-slider)",
    ".tf-toggle__face",
    ".btn-tile-label",
    ".rule-section-title span",
    ".modal-body label",
    ".badge-builtin",
    ".badge-unsaved",
    ".rule-pill",
    "legend",
    "p"
  ];
  var textNodes = doc.querySelectorAll(textSelectors.join(", "));
  textNodes.forEach(function (tn) {
    if (!tn.classList.contains("st-text-box")) {
      tn.classList.add("st-text-box");
    }
  });

  var groupSections = doc.querySelectorAll(".tiles-grid, .toggles-grid, .rollback-row, .rule-section, .collect-options-grid, .formats-grid-3col, .behavior-grid-v2");
  groupSections.forEach(function (gs) {
    if (!gs.classList.contains("st-section-group")) {
      gs.classList.add("st-section-group");
    }
  });

  // Interceptador global do Modo Editar: bloqueia cliques de navegação e abre o Inspector
  if (!doc._stClickInspectorBound) {
    doc._stClickInspectorBound = true;
    doc.addEventListener("pointerdown", function () {
      if (panelKey && PANEL_CONFIGS[panelKey] && studioState.currentActivePanel !== panelKey) {
        studioState.currentActivePanel = panelKey;
        if (lblActivePanelBadge) {
          lblActivePanelBadge.textContent = PANEL_CONFIGS[panelKey].badgeText;
        }
      }
    }, true);

    doc.addEventListener("click", function (ev) {
      var target = ev.target;
      var blockedSelector = panelKey === "main"
        ? "#btnOrganize, #btnCreateStructure, #btnMediaOnly, #btnOpenCollect, #btnCheckUnused, #btnRollback, #btnOpenPresetBuilder, #btnRollbackSaveAndContinue, #btnRollbackContinueWithoutSave"
        : panelKey === "editor"
          ? "#btnFooterSave, #btnDeletePreset, #btnResetDefault, #btnImportJson, #btnExportJson, #btnOpenPresetsFolder, #btnCloseModal"
          : panelKey === "collect"
            ? "#btnBrowseDest, #btnCalculate, #btnCollect, #btnCancel"
            : "";
      var blockedAction = blockedSelector ? target.closest(blockedSelector) : null;
      if (!studioState.isEditMode && blockedAction) {
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation();
        showToast("Ação bloqueada na prévia do Studio. Use o plugin no Adobe para executar.");
        return;
      }
      if (!studioState.isEditMode) return;
      if (target.closest(".overlay-topbar, .overlay-btn")) {
        if (panelKey && PANEL_CONFIGS[panelKey]) {
          studioState.currentActivePanel = panelKey;
          if (lblActivePanelBadge) {
            lblActivePanelBadge.textContent = PANEL_CONFIGS[panelKey].badgeText;
          }
        }
        return;
      }
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();

      // Resolução Unificada de Núcleo:
      // 1. Tag / Badge (.rule-pill, .tf-badge, .badge-builtin, .badge-unsaved)
      // 2. Toggle / Checkbox com label (.tf-toggle, .collect-check, .toggle-container)
      // 3. Botão (<button>, .tf-btn, .preset-icon-btn, .collect-action-btn, .row-btn, etc.)
      // 4. Texto solto ou container estrutural
      var selectable = null;
      var tagEl = target.closest(".rule-pill, .tf-badge, .badge-builtin, .badge-unsaved");
      var sliderHit = !tagEl && target.closest(".collect-check .toggle-slider");
      var toggleEl = !tagEl && (sliderHit
        ? sliderHit
        : target.closest("label.tf-toggle, .tf-toggle, label.collect-check, label.toggle-container, .toggle-container"));
      var btnEl = !tagEl && !toggleEl && target.closest(
        "button, .tf-btn, .preset-icon-btn, .modal-btn, .collect-action-btn, .collect-btn-browse, .collect-btn-calc, " +
        ".collect-btn-ok, .collect-btn-cancel, .collect-btn-comments, .collect-link-btn, " +
        ".row-btn, .label-swatch-btn, .prefix-preview, .rules-summary-btn, .collapse-btn, .tf-select-trigger"
      );
      if (tagEl) {
        selectable = tagEl;
      } else if (toggleEl) {
        selectable = toggleEl;
      } else if (btnEl) {
        selectable = btnEl;
      } else {
        selectable = target.closest(
          ".tf-select-item, .select-input, .text-input, .folder-name-input, .drag-handle, " +
          ".st-text-box, .notice-text, .tree-toolbar-title, .preset-bar-label, .preset-label, " +
          ".collect-legend, .collect-disk-lbl, .collect-stats-label, .collect-stats-val, " +
          ".modal-title, .modal-text, .modal-subtext, .tree-row, [data-tf-design], h1, h2, h3, h4, p, legend, label, input, select"
        ) || target;
        if (selectable && !selectable.id && !selectable.getAttribute('data-tf-design')) {
          var ownerControl = selectable.closest('button[id], button[data-tf-design], label[id], label[data-tf-design], [id], [data-tf-design]');
          if (ownerControl && ownerControl !== selectable && ownerControl !== doc.body) selectable = ownerControl;
        }
      }

      if (selectable && selectable !== doc.body && selectable !== doc.documentElement) {
        openInspectorForElement(selectable, panelKey, Boolean(ev.shiftKey));
      }
    }, true);

    doc.addEventListener("mousedown", function (ev) {
      if (!studioState.isEditMode) return;
      if (ev.target.closest(".overlay-topbar, .overlay-btn")) {
        return;
      }
      if (studioState.isDragMode && ev.target.closest("[data-st-draggable='1'], .drag-handle")) {
        return;
      }
      if (ev.target.closest("select, input, button, .tf-select-trigger, a, .toggle-container, .collect-check")) {
        ev.preventDefault();
        ev.stopPropagation();
      }
    }, true);

    doc.addEventListener("change", function (ev) {
      if (!studioState.isEditMode) return;
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();
    }, true);
  }

  // Configura duplo clique nos botões e labels editáveis
  var editableInputs = document.querySelectorAll('[data-text-panel="' + panelKey + '"]');
  editableInputs.forEach(function (inp) {
    var targetId = inp.getAttribute("data-text-target");
    var el = doc.getElementById(targetId);
    if (!el || el._stDblBound) return;
    el._stDblBound = true;
    el.addEventListener("dblclick", function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      var cur = extractReadableTextFromElement(el, targetId);
      var next = window.prompt("Editar texto (" + PANEL_CONFIGS[panelKey].name + "):", cur);
      if (next !== null) {
        applyTextToDoc(panelKey, targetId, next, true);
        syncTextInputsFromDoc(panelKey);
      }
    });
  });

  // Configura Drag-and-Drop nos containers
  var dragContainers = [];
  if (panelKey === "main") {
    dragContainers = [
      doc.querySelector(".actions-grid-secondary"),
      doc.querySelector(".toggles-grid-top"),
      doc.querySelector(".field-group"),
      doc.querySelector(".options-group")
    ];
  } else if (panelKey === "editor") {
    dragContainers = [
      doc.querySelector(".preset-actions"),
      doc.querySelector(".settings-toggles"),
      doc.querySelector(".footer-actions")
    ];
  } else if (panelKey === "collect") {
    dragContainers = [
      doc.querySelector(".collect-dialog"),
      doc.querySelector(".collect-footer-actions")
    ];
  } else if (panelKey === "overlays") {
    dragContainers = [
      doc.querySelector("#ov-rollback .modal-footer"),
      doc.querySelector("#ov-unsaved .modal-footer"),
      doc.querySelector("#ov-del-folder .modal-footer"),
      doc.querySelector("#ov-del-preset .modal-footer"),
      doc.querySelector("#ov-save-as .modal-footer"),
      doc.querySelector("#ov-rules .modal-footer"),
      doc.querySelector("#ov-rules .formats-grid-3col"),
      doc.querySelector("#ov-rules .behavior-grid-v2")
    ];
  }

  var draggedEl = null;

  dragContainers.filter(Boolean).forEach(function (group) {
    Array.prototype.slice.call(group.children).forEach(function (child) {
      if (child.id === "groupSourceNote") return;
      child.setAttribute("data-st-draggable", "1");
      child.draggable = studioState.isDragMode;
      if (studioState.isDragMode && child.disabled) {
        child.setAttribute("data-st-was-disabled", "1");
        child.disabled = false;
      }

      if (child._stDragBound) return;
      child._stDragBound = true;

      child.addEventListener("dragstart", function (e) {
        if (!studioState.isDragMode) {
          e.preventDefault();
          return;
        }
        draggedEl = child;
        e.dataTransfer.effectAllowed = "move";
        e.stopPropagation();
      });

      child.addEventListener("dragover", function (e) {
        if (!studioState.isDragMode || !draggedEl || draggedEl === child) return;
        if (draggedEl.parentElement !== child.parentElement) return;
        e.preventDefault();
        e.stopPropagation();
        child.classList.add("st-drop-target");
      });

      child.addEventListener("dragleave", function () {
        child.classList.remove("st-drop-target");
      });

      child.addEventListener("drop", function (e) {
        child.classList.remove("st-drop-target");
        if (!studioState.isDragMode || !draggedEl || draggedEl === child) return;
        if (draggedEl.parentElement !== child.parentElement) return;
        e.preventDefault();
        e.stopPropagation();

        var parent = child.parentElement;
        var siblings = Array.prototype.slice.call(parent.children);
        var fromIdx = siblings.indexOf(draggedEl);
        var toIdx = siblings.indexOf(child);
        if (fromIdx < toIdx) {
          parent.insertBefore(draggedEl, child.nextSibling);
        } else {
          parent.insertBefore(draggedEl, child);
        }
        draggedEl = null;
        renderMagneticOrderList();
        if (chkAutoSave && chkAutoSave.checked) {
          scheduleSaveToDisk(true);
        }
      });
    });
  });

  updateDragModeInDoc(panelKey);
  updateEditModeInDoc(panelKey);
}

export function updateDragModeInDoc(panelKey) {
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
  if (!doc || !doc.body) return;

  if (studioState.isDragMode) {
    doc.body.classList.add("st-drag-active");
  } else {
    doc.body.classList.remove("st-drag-active");
  }
  var draggables = doc.querySelectorAll("[data-st-draggable='1']");
  for (var i = 0; i < draggables.length; i++) {
    draggables[i].draggable = studioState.isDragMode;
    if (studioState.isDragMode && draggables[i].disabled) {
      draggables[i].setAttribute("data-st-was-disabled", "1");
      draggables[i].disabled = false;
    } else if (!studioState.isDragMode && draggables[i].getAttribute("data-st-was-disabled") === "1") {
      draggables[i].disabled = true;
      draggables[i].removeAttribute("data-st-was-disabled");
    }
  }
}
