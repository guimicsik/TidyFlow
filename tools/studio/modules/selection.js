import { ICON_CATALOG, PANEL_CONFIGS } from './catalog.js';
import {
  frameMain,
  frameEditor,
  frameCollect,
  frameOverlays,
  chkAutoSave,
  lblActivePanelBadge,
  btnToggleEditMode,
  editModeStatus,
  stInspectorPanel,
  stDefaultSidebar,
  btnCloseInspector,
  inspTag,
  inspTitle,
  inspId,
  inspInputText,
  inspIconCatalogGrid,
  showToast,
  getFrames
} from './dom.js';
import { extractReadableTextFromElement } from './panel-text.js';
import { setupInteractivePreviewInDoc, updateDragModeInDoc } from './preview.js';
import { openIndividualDesign } from './individual-design.js';
import { scheduleSaveToDisk } from './persistence.js';
import { studioState } from './state.js';
import { prepareIconLabel, setButtonIcon } from './icon-layout.js';

// ========================================================================
// MODO EDITAR & INSPECTOR CONTEXTUAL (Estilo Illustrator / Figma)
// ========================================================================
export function toggleEditMode(forceVal) {
  studioState.isEditMode = (forceVal !== undefined) ? forceVal : !studioState.isEditMode;
  if (btnToggleEditMode) {
    btnToggleEditMode.classList.toggle("active", studioState.isEditMode);
  }
  if (editModeStatus) {
    editModeStatus.textContent = studioState.isEditMode ? "ON" : "OFF";
  }

  // Ao ativar o Modo Editar, ativa o modo de arrastar layout automaticamente
  if (studioState.isEditMode) {
    studioState.isDragMode = true;
    var btnDrag = document.getElementById("btnToggleDragMode");
    var dragStatus = document.getElementById("dragModeStatus");
    var dragBanner = document.getElementById("dragBanner");
    if (btnDrag) btnDrag.classList.add("active");
    if (dragStatus) dragStatus.textContent = "ON";
    if (dragBanner) dragBanner.style.display = "block";
    showToast("✏️ Modo Editar ATIVADO: Clique em qualquer botão ou texto para inspecionar!");
  } else {
    closeInspector();
    var dragBannerOff = document.getElementById("dragBanner");
    if (dragBannerOff) dragBannerOff.style.display = "none";
  }

  getFrames().forEach(function (frame) {
    var panelKey =
      frame === frameEditor
        ? "editor"
        : frame === frameCollect
          ? "collect"
          : frame === frameOverlays
            ? "overlays"
            : "main";
    setupInteractivePreviewInDoc(panelKey);
    updateEditModeInDoc(panelKey);
    updateDragModeInDoc(panelKey);
  });
}

export function updateEditModeInDoc(panelKey) {
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

  if (studioState.isEditMode) {
    doc.body.classList.add("st-edit-active");
  } else {
    doc.body.classList.remove("st-edit-active");
    var selected = doc.querySelectorAll(".st-element-selected");
    for (var s = 0; s < selected.length; s++) {
      selected[s].classList.remove("st-element-selected");
    }
  }
}

export function closeInspector() {
  studioState.currentSelectedElement = null;
  studioState.currentSelectedElements = [];
  if (stInspectorPanel) stInspectorPanel.style.display = "none";
  if (stDefaultSidebar) stDefaultSidebar.style.display = "flex";
  var ws = document.querySelector(".st-workspace");
  if (ws) ws.classList.remove("has-inspector-open");

  getFrames().forEach(function (f) {
    try {
      var doc = f.contentDocument;
      if (doc) {
        var sel = doc.querySelectorAll(".st-element-selected");
        for (var i = 0; i < sel.length; i++) {
          sel[i].classList.remove("st-element-selected");
        }
      }
    } catch (e) { }
  });
}

export function resolveDesignSelector(el) {
  if (!el || !el.getAttribute) return null;
  var key = el.getAttribute("data-tf-design");
  var keySelector = key ? '[data-tf-design="' + key + '"]' : null;
  var idSelector = el.id ? "#" + el.id : null;
  return (keySelector && studioState.currentDesigns[keySelector] && !studioState.currentDesigns[idSelector])
    ? keySelector
    : (idSelector || keySelector);
}

function clearSelectedClassesInAllFrames() {
  getFrames().forEach(function (f) {
    try {
      var doc = f.contentDocument;
      if (doc) {
        var sel = doc.querySelectorAll(".st-element-selected");
        for (var i = 0; i < sel.length; i++) {
          sel[i].classList.remove("st-element-selected");
        }
      }
    } catch (e) { }
  });
}
export function openInspectorForElement(el, panelKey, isAdditive) {
  if (!el) return;

  var resolvedSel = resolveDesignSelector(el);
  if (isAdditive === "refresh") {
    // Apenas re-renderiza mantendo studioState.currentSelectedElements intacto
  } else if (isAdditive && studioState.currentSelectedElements.length > 0) {
    if (!resolvedSel) {
      showToast("Este elemento não possui identidade estável para seleção múltipla.");
      return;
    }
    var existingIdx = -1;
    for (var sIdx = 0; sIdx < studioState.currentSelectedElements.length; sIdx++) {
      if (studioState.currentSelectedElements[sIdx].el === el) {
        existingIdx = sIdx;
        break;
      }
    }
    if (existingIdx >= 0) {
      if (studioState.currentSelectedElements.length > 1) {
        studioState.currentSelectedElements[existingIdx].el.classList.remove("st-element-selected");
        studioState.currentSelectedElements.splice(existingIdx, 1);
        el = studioState.currentSelectedElements[studioState.currentSelectedElements.length - 1].el;
        panelKey = studioState.currentSelectedElements[studioState.currentSelectedElements.length - 1].panelKey;
      }
    } else {
      studioState.currentSelectedElements.push({ el: el, panelKey: panelKey, selector: resolvedSel });
      el.classList.add("st-element-selected");
    }
  } else {
    clearSelectedClassesInAllFrames();
    el.classList.add("st-element-selected");
    studioState.currentSelectedElements = [{ el: el, panelKey: panelKey, selector: resolvedSel }];
  }

  studioState.currentSelectedElement = el;

  // Atualiza automaticamente o painel ativo para a janela de onde o elemento veio
  if (panelKey && PANEL_CONFIGS[panelKey]) {
    studioState.currentActivePanel = panelKey;
    if (lblActivePanelBadge) {
      lblActivePanelBadge.textContent = PANEL_CONFIGS[panelKey].badgeText;
    }
    if (studioState.currentViewMode !== "all") {
      var panelBtns = document.querySelectorAll("[data-panel-btn]");
      panelBtns.forEach(function (btn) {
        var key = btn.getAttribute("data-panel-btn");
        btn.classList.toggle("active", key === panelKey);
      });
    }
  }

  // Detecta tipo e categoria
  var tag = "ELEMENTO";

  if (el.classList.contains("rule-pill")) {
    tag = "TAG DE REGRA (CATEGORIA)";
  } else if (el.classList.contains("tf-btn--hero") || el.id === "btnOrganize") {
    tag = "BOTÃO HERO";
  } else if (el.classList.contains("tf-btn--tile-danger") || el.id === "btnRollback") {
    tag = "BOTÃO DESTRUTIVO";
  } else if (el.classList.contains("tf-btn--warning")) {
    tag = "BOTÃO AVISO / ATENÇÃO";
  } else if (el.classList.contains("tf-btn--destructive")) {
    tag = "BOTÃO DESTRUTIVO";
  } else if (el.classList.contains("tf-btn--tile") || el.classList.contains("btn-tile-label")) {
    tag = "BOTÃO TILE";
  } else if (el.classList.contains("tf-toggle") || el.closest(".tf-toggle")) {
    tag = "TOGGLE / OPÇÃO";
  } else if (el.classList.contains("prefix-preview") && el.classList.contains("prefix-off")) {
    tag = "PREFIXO INDEPENDENTE (OFF)";
  } else if (el.classList.contains("prefix-preview")) {
    tag = "PREFIXO INDEPENDENTE (01_)";
  } else if (el.classList.contains("row-btn")) {
    tag = "BOTÃO INDEPENDENTE DA PASTA";
  } else if (el.classList.contains("preset-icon-btn") || el.closest(".preset-actions")) {
    tag = "TOOLBAR ÍCONES (PRESET)";
  } else if (el.id === "btnCloseModal" || el.classList.contains("btn-footer-close")) {
    tag = "BOTÃO FECHAR (RODAPÉ)";
  } else if (el.classList.contains("tf-btn--primary") || el.classList.contains("collect-btn-ok") || el.id === "btnFooterSave" || el.id === "btnAddTopFolder") {
    tag = "BOTÃO PRIMÁRIO";
  } else if (el.classList.contains("tf-btn--ghost") || el.classList.contains("collect-btn-cancel")) {
    tag = "BOTÃO SECUNDÁRIO";
  } else if (el.classList.contains("collect-link-btn")) {
    tag = "LINK RÁPIDO";
  } else if (el.classList.contains("toggle-container") || el.closest(".toggle-container") || el.classList.contains("collect-check") || el.closest(".collect-check")) {
    tag = "CHECKBOX / TOGGLE";
  } else if (el.classList.contains("modal-title") || el.tagName === "H1" || el.tagName === "H2" || el.tagName === "H3" || el.classList.contains("tree-toolbar-title") || el.tagName === "LEGEND") {
    tag = "TÍTULO / CABEÇALHO";
  } else if (el.classList.contains("modal-text") || el.classList.contains("modal-subtext") || el.classList.contains("notice-text") || el.classList.contains("st-text-box") || el.tagName === "P" || el.tagName === "SPAN" || el.tagName === "LABEL") {
    tag = "TEXTO / RÓTULO";
  }

  // Abre o Inspector na lateral direita mantendo a sidebar esquerda visível
  if (stDefaultSidebar) stDefaultSidebar.style.display = "flex";
  if (stInspectorPanel) stInspectorPanel.style.display = "flex";
  var ws = document.querySelector(".st-workspace");
  if (ws) ws.classList.add("has-inspector-open");

  var uniqueHeaderSelectors = [];
  studioState.currentSelectedElements.forEach(function (item) {
    if (item.selector && uniqueHeaderSelectors.indexOf(item.selector) === -1) {
      uniqueHeaderSelectors.push(item.selector);
    }
  });
  var isMultiHeader = studioState.currentSelectedElements.length > 1;

  // Atualiza cabeçalho do Inspector
  if (inspTag) inspTag.textContent = isMultiHeader ? ("SELEÇÃO MÚLTIPLA (" + studioState.currentSelectedElements.length + ")") : tag;
  var elText = extractReadableTextFromElement(el, el.id || "");
  if (inspTitle) inspTitle.textContent = isMultiHeader ? (studioState.currentSelectedElements.length + " elementos selecionados") : (elText || el.tagName.toLowerCase());
  var designKeyAttr = el.getAttribute("data-tf-design");
  if (inspId) {
    inspId.textContent = isMultiHeader
      ? (uniqueHeaderSelectors.join(" · ") || "Shift+Clique para adicionar ou remover")
      : (el.id ? "#" + el.id : (designKeyAttr ? '[data-tf-design="' + designKeyAttr + '"]' : ("." + (el.className.split(" ")[0] || "elemento"))));
  }

  // Texto do Elemento (habilitado para botões, toggles, checkboxes, títulos e textos apenas na seleção simples)
  var contentEditable = !isMultiHeader && !el.matches('div[data-tf-design], fieldset[data-tf-design], input, select, .tf-select-trigger, .rules-summary-btn, .rule-pill, [data-tf-design^="folder-"], [data-tf-design^="collect-tree-"]');
  var textSection = inspInputText.closest('#inspSecText');
  if (textSection) textSection.style.display = contentEditable ? '' : 'none';
  var iconSection = document.getElementById('inspSecIcon');
  if (iconSection) iconSection.style.display = (!isMultiHeader && el.tagName === 'BUTTON' && !el.matches('.tf-select-trigger, .rules-summary-btn, [data-tf-design^="folder-"]')) ? '' : 'none';
  if (inspInputText && !isMultiHeader) {
    var textTarget = el.querySelector && el.querySelector('.btn-tile-label, .tf-toggle__face, span:not(.toggle-slider):not(.tf-btn-icon):not(.label-option-dot)');
    inspInputText.value = textTarget ? extractReadableTextFromElement(textTarget, '') : elText.replace(/\s*\|\s*/g, '\n');
  }

  renderInspectorIconCatalog();
  syncIconSize(el);
  document.getElementById('inspIconMode').value = el.getAttribute('data-tf-icon-mode') || 'both';
  document.getElementById('inspIconPosition').value = el.getAttribute('data-tf-icon-position') || 'left';
  document.getElementById('inspIconPosition').disabled = el.getAttribute('data-tf-icon-mode') === 'only';
  openIndividualDesign(el, contentEditable);
}
function renderInspectorIconCatalog() {
  if (!inspIconCatalogGrid) return;
  inspIconCatalogGrid.innerHTML = "";
  ICON_CATALOG.forEach(function (iconItem) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "st-icon-card";
    btn.style.padding = "4px 2px";
    btn.innerHTML =
      (iconItem.svg || '<span style="font-size:12px;line-height:16px;">⊘</span>') +
      '<span style="font-size:8.5px;">' + iconItem.name + '</span>';
    btn.onclick = function () {
      applyIconToInspectedElement(iconItem);
    };
    inspIconCatalogGrid.appendChild(btn);
  });
}

function applyIconToInspectedElement(iconItem) {
  if (!studioState.currentSelectedElement) return;
  var el = studioState.currentSelectedElement;

  setButtonIcon(el, iconItem);
  syncIconSize(el);
  document.getElementById('inspIconMode').value = el.getAttribute('data-tf-icon-mode') || 'both';
  document.getElementById('inspIconPosition').disabled = el.getAttribute('data-tf-icon-mode') === 'only';
  showToast("Ícone '" + iconItem.name + "' aplicado ao elemento selecionado!");
  if (chkAutoSave && chkAutoSave.checked) {
    scheduleSaveToDisk(true);
  }
}

function syncIconSize(el) {
  var icon = el.querySelector('.tf-btn-icon, svg');
  var size = parseFloat(el.style.getPropertyValue('--tf-button-icon-size'));
  if (!size && icon) size = parseFloat(el.ownerDocument.defaultView.getComputedStyle(icon).width);
  size = size || 16;
  document.getElementById('inspIconSize').value = size;
  document.getElementById('inspIconSizeValue').value = size;
}

export function initInspectorEvents() {
  function updateIconSize(value) {
    var el = studioState.currentSelectedElement;
    if (!el || el.tagName !== 'BUTTON') return;
    var size = Number(value);
    if (!Number.isFinite(size) || size < 8 || size > 128) { syncIconSize(el); return; }
    el.setAttribute('data-tf-icon-size', 'custom');
    el.style.setProperty('--tf-button-icon-size', size + 'px');
    syncIconSize(el);
    if (chkAutoSave && chkAutoSave.checked) scheduleSaveToDisk(true);
  }
  document.getElementById('inspIconSize').addEventListener('input', function () { updateIconSize(this.value); });
  document.getElementById('inspIconSizeValue').addEventListener('change', function () { updateIconSize(this.value); });
  document.getElementById('inspIconSizeReset').addEventListener('click', function () {
    var el = studioState.currentSelectedElement;
    if (!el) return;
    el.removeAttribute('data-tf-icon-size');
    el.style.removeProperty('--tf-button-icon-size');
    syncIconSize(el);
    if (chkAutoSave && chkAutoSave.checked) scheduleSaveToDisk(true);
  });
  ['inspIconMode', 'inspIconPosition'].forEach(function (id) {
    document.getElementById(id).addEventListener('change', function () {
      var el = studioState.currentSelectedElement;
      if (!el || el.tagName !== 'BUTTON') return;
      if (id === 'inspIconMode' && this.value === 'only' && !el.querySelector('.tf-btn-icon, svg')) {
        this.value = el.getAttribute('data-tf-icon-mode') || 'both';
        showToast('Escolha um ícone antes de ativar Só ícone.');
        return;
      }
      prepareIconLabel(el);
      el.setAttribute(id === 'inspIconMode' ? 'data-tf-icon-mode' : 'data-tf-icon-position', this.value);
      document.getElementById('inspIconPosition').disabled = el.getAttribute('data-tf-icon-mode') === 'only';
      if (chkAutoSave && chkAutoSave.checked) scheduleSaveToDisk(true);
    });
  });
  if (btnCloseInspector) {
    btnCloseInspector.addEventListener("click", function () {
      closeInspector();
    });
  }

  if (inspInputText) {
    inspInputText.addEventListener("input", function () {
      if (!studioState.currentSelectedElement) return;
      var el = studioState.currentSelectedElement;
      var newText = inspInputText.value;

      // Se tiver .tf-btn-icon, altera apenas o texto fora do ícone
      var existingIcon = el.querySelector ? el.querySelector(".tf-btn-icon") : null;
      var labelBox = (el.classList && (el.classList.contains("btn-tile-label") || el.classList.contains("tf-toggle__face")))
        ? el
        : (el.querySelector ? el.querySelector(".btn-tile-label, .tf-toggle__face, span:not(.toggle-slider):not(.tf-btn-icon):not(.label-option-dot)") : null);

      if (labelBox) {
        var textContainer = el.ownerDocument.createElement('span');
        newText.split('\n').forEach(function (line, index) {
          if (index) textContainer.appendChild(el.ownerDocument.createElement('br'));
          textContainer.appendChild(el.ownerDocument.createTextNode(line));
        });
        while (labelBox.firstChild) labelBox.removeChild(labelBox.firstChild);
        labelBox.appendChild(textContainer);
      } else if (existingIcon) {
        var nodes = Array.prototype.slice.call(el.childNodes);
        for (var i = 0; i < nodes.length; i++) {
          if (nodes[i] !== existingIcon) {
            nodes[i].remove();
          }
        }
        el.appendChild(el.ownerDocument.createTextNode(" " + newText));
      } else {
        el.textContent = newText;
        el.style.whiteSpace = 'pre-line';
      }

      if (inspTitle) inspTitle.textContent = newText || "[Texto]";
    });

    inspInputText.addEventListener("change", function () {
      if (chkAutoSave && chkAutoSave.checked) {
        scheduleSaveToDisk(true);
      }
    });
  }
}
