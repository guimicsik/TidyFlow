import { applyDesignEdits } from './design-edits.js';
import { chkAutoSave, showToast } from './dom.js';
import { applyAllTokensToFrames } from './tokens.js';
import { extractReadableTextFromElement } from './panel-text.js';
import { closeInspector, resolveDesignSelector, openInspectorForElement } from './selection.js';
import { scheduleSaveToDisk } from './persistence.js';
import { studioState } from './state.js';
import { createColorControls } from './inspector-colors.js';
import { createPropertyRenderer } from './properties.js';

export function openIndividualDesign(el, contentEditable) {
  var section = document.getElementById('individualDesign');
  if (!section) {
    section = document.createElement('div');
    section.id = 'individualDesign';
    section.className = 'st-inspector-section';
    document.querySelector('.st-inspector-body').prepend(section);
  }
  var selectedEntries = studioState.currentSelectedElements.length
    ? studioState.currentSelectedElements.slice()
    : [{ el: el, panelKey: studioState.currentActivePanel, selector: resolveDesignSelector(el) }];
  var targetSelectors = [];
  selectedEntries.forEach(function (entry) {
    var sel = entry.selector || resolveDesignSelector(entry.el);
    if (sel && targetSelectors.indexOf(sel) === -1) targetSelectors.push(sel);
  });
  var isMulti = targetSelectors.length > 1;
  if (contentEditable === undefined) {
    contentEditable = !isMulti && !el.matches('div[data-tf-design], fieldset[data-tf-design], input, select, .tf-select-trigger, .rules-summary-btn, .rule-pill, [data-tf-design^="folder-"], [data-tf-design^="collect-tree-"]');
  }
  var key = el.getAttribute('data-tf-design');
  var selector = resolveDesignSelector(el);
  section.replaceChildren();
  var title = document.createElement('strong');
  var readableTitle = extractReadableTextFromElement(el, el.id || '').replace(/\s*\|\s*/g, ' ').trim();
  title.textContent = !selector
    ? 'Selecione um botão, tag ou toggle com identidade estável'
    : isMulti
      ? ('Seleção múltipla (' + targetSelectors.length + ' itens)')
      : (key === 'folder-row'
      ? 'Estilo: todas as linhas de pastas'
      : key === 'folder-prefix'
      ? 'Botão Independente: Numeração Ativa (01_)'
      : key === 'folder-prefix-off'
      ? 'Botão Independente: Numeração Desativada (OFF)'
      : 'Núcleo: ' + (readableTitle.slice(0, 50) || el.id || key));
  section.appendChild(title);
  if (!selector) return;
  if (isMulti) {
    var chipsBox = document.createElement('div');
    chipsBox.className = 'st-multi-targets';
    selectedEntries.forEach(function (entry) {
      var chip = document.createElement('span');
      chip.className = 'st-multi-target-chip';
      var labelSpan = document.createElement('span');
      var entryText = extractReadableTextFromElement(entry.el, entry.el.id || entry.selector || '').replace(/\s*\|\s*/g, ' ').trim();
      labelSpan.textContent = entryText || entry.selector;
      labelSpan.title = entry.selector || '';
      var rmBtn = document.createElement('button');
      rmBtn.type = 'button';
      rmBtn.textContent = '×';
      rmBtn.title = 'Remover da seleção';
      rmBtn.addEventListener('click', function () {
        entry.el.classList.remove('st-element-selected');
        studioState.currentSelectedElements = studioState.currentSelectedElements.filter(function (item) { return item.el !== entry.el; });
        if (studioState.currentSelectedElements.length === 1) {
          var lastSingle = studioState.currentSelectedElements[0];
          openInspectorForElement(lastSingle.el, lastSingle.panelKey, false);
        } else if (studioState.currentSelectedElements.length > 1) {
          var lastMulti = studioState.currentSelectedElements[studioState.currentSelectedElements.length - 1];
          openInspectorForElement(lastMulti.el, lastMulti.panelKey, "refresh");
        } else {
          closeInspector();
        }
      });
      chip.appendChild(labelSpan);
      chip.appendChild(rmBtn);
      chipsBox.appendChild(chip);
    });
    section.appendChild(chipsBox);
  } else {
    var targetHint = document.createElement('div');
    targetHint.className = 'st-design-target-hint';
    targetHint.textContent = selector;
    section.appendChild(targetHint);
  }

  var isTag = el.matches('.rule-pill, .tf-badge, .badge-builtin, .badge-unsaved');
  var supportsCheckedState = selectedEntries.some(function (entry) {
    var targetEl = entry.el;
    return !!targetEl.closest('.tf-toggle, .toggle-container, .collect-check') || targetEl.matches('.tf-toggle, .toggle-container, .collect-check, input[type="checkbox"], [aria-pressed]');
  });
  var supportsPartialState = selectedEntries.some(function (entry) {
    var targetEl = entry.el;
    return !!targetEl.closest('.tf-toggle') || targetEl.matches('.collect-tree-check, [data-tf-design="collect-tree-checkbox"], .tf-toggle, input[type="checkbox"]');
  });
  var designStates = supportsCheckedState
    ? (supportsPartialState ? ['rest', 'hover', 'active', 'checked', 'checkedHover', 'indeterminate'] : ['rest', 'hover', 'active', 'checked', 'checkedHover'])
    : ['rest', 'hover', 'active'];
  var designStateLabels = supportsCheckedState
    ? (supportsPartialState ? ['Rest', 'Hover', 'Click', 'Ativado', 'Hover Ativado', 'Parcial'] : ['Rest', 'Hover', 'Click', 'Ativado', 'Hover Ativado'])
    : ['Rest', 'Hover', 'Click'];

  // 1. Barra de Estados no Topo do Painel Direito (Rest / Hover / Click / Ativado / Hover Ativado / Parcial)
  var stateBar = document.createElement('div');
  stateBar.className = 'st-design-state-bar';
  section.appendChild(stateBar);
  var state = document.createElement('select');
  state.className = 'st-select st-design-state-select';
  designStates.forEach(function (s, i) { state.add(new Option(designStateLabels[i], s)); });
  var requestedInitialState = (studioState.forcedState === 'normal' || studioState.forcedState === 'rest') ? 'rest' : studioState.forcedState;
  var initialState = designStates.indexOf(requestedInitialState) >= 0 ? requestedInitialState : 'rest';
  state.value = initialState;
  stateBar.appendChild(state);

  var stateButtons = [];
  var colorCardsByState = { rest: [], hover: [], active: [], checked: [], checkedHover: [], indeterminate: [] };
  function highlightCurrentStateCards() {
    Object.keys(colorCardsByState).forEach(function (stKey) {
      (colorCardsByState[stKey] || []).forEach(function (cardEl) {
        cardEl.classList.toggle('is-current-state', stKey === state.value);
      });
    });
  }

  designStates.forEach(function (value, index) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'st-design-state-btn' + (value === initialState ? ' active' : '');
    button.textContent = designStateLabels[index];
    button.addEventListener('click', function () {
      state.value = value;
      stateButtons.forEach(function (item) { item.classList.toggle('active', item === button); });
      if (value === 'rest' && supportsCheckedState) {
        studioState.forcedState = 'rest';
        document.querySelectorAll('[data-force-state]').forEach(function (item) {
          item.classList.toggle('active', item.getAttribute('data-force-state') === 'normal');
        });
        applyAllTokensToFrames();
      } else {
        var forceButton = document.querySelector('[data-force-state="' + (value === 'rest' ? 'normal' : value) + '"]');
        if (forceButton) forceButton.click();
        else {
          studioState.forcedState = value;
          document.querySelectorAll('[data-force-state]').forEach(function (item) { item.classList.remove('active'); });
          applyAllTokensToFrames();
        }
      }
      highlightCurrentStateCards();
      render();
    });
    stateButtons.push(button);
    stateBar.appendChild(button);
  });

  // Barra de limpeza rápida do estado ou do núcleo
  var resetBar = document.createElement('div');
  resetBar.className = 'st-design-reset-bar';
  var resetState = document.createElement('button');
  resetState.type = 'button';
  resetState.textContent = 'Limpar estado';
  resetState.addEventListener('click', function () {
    var previousState = state.value;
    targetSelectors.forEach(function (sel) {
      if (studioState.currentDesigns[sel]) delete studioState.currentDesigns[sel][state.value];
    });
    applyAllTokensToFrames();
    studioState.designDirty = true;
    if (chkAutoSave.checked) scheduleSaveToDisk(false);
    openIndividualDesign(el, contentEditable);
    var stateIndex = designStates.indexOf(previousState);
    if (stateIndex >= 0) section.querySelectorAll('.st-design-state-btn')[stateIndex].click();
    showToast(isMulti ? ('Ajustes do estado removidos em ' + targetSelectors.length + ' itens') : 'Ajustes do estado removidos');
  });
  var resetElement = document.createElement('button');
  resetElement.type = 'button';
  resetElement.textContent = isMulti ? 'Limpar selecionados' : 'Limpar elemento';
  resetElement.addEventListener('click', function () {
    targetSelectors.forEach(function (sel) {
      delete studioState.currentDesigns[sel];
    });
    applyAllTokensToFrames();
    studioState.designDirty = true;
    if (chkAutoSave.checked) scheduleSaveToDisk(false);
    openIndividualDesign(el, contentEditable);
    section.querySelector('.st-design-state-btn').click();
    showToast(isMulti ? ('Ajustes removidos em ' + targetSelectors.length + ' itens') : 'Ajustes individuais removidos');
  });
  resetBar.appendChild(resetState);
  resetBar.appendChild(resetElement);
  section.appendChild(resetBar);

  function setDesignProperty(targetState, prop, value) {
    if (value && !CSS.supports(prop, value)) { showToast('Valor inválido para ' + prop); return; }
    applyDesignEdits(targetSelectors, { [targetState]: { [prop]: value } });
  }

  const colors = createColorControls({ el, key, selector, isTag, targetSelectors, isMulti, designStates, supportsCheckedState, supportsPartialState, colorCardsByState, highlightCurrentStateCards, setDesignProperty });
  const render = createPropertyRenderer({ section, el, selector, contentEditable, state, designStates, designStateLabels, setDesignProperty, colors });
  state.addEventListener('change', render);
  render();
}
