import { applyDesignEdits } from './design-edits.js';
import { rgbToHex } from './color-utils.js';
import { chkAutoSave, showToast } from './dom.js';
import { applyAllTokensToFrames } from './tokens.js';
import { scheduleSaveToDisk } from './persistence.js';
import { studioState } from './state.js';
import { createPaletteBar } from './palette-controls.js';

export function createColorControls({ el, key, selector, isTag, targetSelectors, isMulti, designStates, supportsCheckedState, supportsPartialState, colorCardsByState, highlightCurrentStateCards, setDesignProperty }) {
  // Mede as cores em uma cópia fora do cursor (com filhos clonados para suportar .tf-toggle__face e .toggle-slider)
  var colorProbe = null;
  var colorProbeRoot = null;
  var colorProbeDoc = el.ownerDocument;
  if (colorProbeDoc && colorProbeDoc.body) {
    var colorProbePath = [];
    var colorProbeCursor = el;
    while (colorProbeCursor && colorProbeCursor !== colorProbeDoc.body) {
      colorProbePath.unshift(colorProbeCursor);
      colorProbeCursor = colorProbeCursor.parentElement;
    }
    var colorProbeParent = colorProbeDoc.body;
    for (var colorProbeIndex = 0; colorProbeIndex < colorProbePath.length; colorProbeIndex++) {
      var isLeaf = colorProbeIndex === colorProbePath.length - 1;
      var colorProbeNode = isLeaf ? colorProbePath[colorProbeIndex].cloneNode(true) : colorProbePath[colorProbeIndex].cloneNode(false);
      colorProbeNode.classList.remove('st-element-selected');
      colorProbeNode.setAttribute('aria-hidden', 'true');
      colorProbeParent.appendChild(colorProbeNode);
      colorProbeParent = colorProbeNode;
      colorProbe = colorProbeNode;
      if (colorProbeIndex === 0) colorProbeRoot = colorProbeNode;
    }
    if (colorProbeRoot) {
      colorProbeRoot.style.setProperty('visibility', 'hidden', 'important');
      colorProbeRoot.style.setProperty('pointer-events', 'none', 'important');
      colorProbeRoot.style.setProperty('position', 'fixed', 'important');
      colorProbeRoot.style.setProperty('left', '-100000px', 'important');
      colorProbeRoot.style.setProperty('top', '-100000px', 'important');
    }
  }

  function stateColor(targetState, prop) {
    var doc = el.ownerDocument;
    var body = doc.body;
    var rootSample = colorProbe || el;
    var sample = rootSample;
    if (rootSample.classList && rootSample.classList.contains('tf-toggle')) {
      sample = rootSample.querySelector('.tf-toggle__face') || rootSample;
    } else if (rootSample.classList && rootSample.classList.contains('collect-check')) {
      sample = (prop === 'color'
        ? rootSample.querySelector('span:not(.toggle-slider)')
        : rootSample.querySelector('.toggle-slider')) || rootSample;
    } else if (prop === 'color' && rootSample.querySelector) {
      sample = rootSample.querySelector('.btn-tile-label') || rootSample;
    }
    var probeChk = (rootSample.matches && rootSample.matches('input[type="checkbox"]'))
      ? rootSample
      : (rootSample.querySelector ? rootSample.querySelector('input[type="checkbox"]') : null);
    var hadChk = probeChk ? probeChk.checked : false;
    var hadIndeterminate = probeChk ? probeChk.indeterminate : false;
    if (probeChk) {
      probeChk.checked = (targetState === 'checked' || targetState === 'checkedHover');
      probeChk.indeterminate = (targetState === 'indeterminate');
    }

    var hadRest = body.classList.contains('tf-force-rest');
    var hadHover = body.classList.contains('tf-force-hover');
    var hadActive = body.classList.contains('tf-force-active');
    var hadChecked = body.classList.contains('tf-force-checked');
    var hadCheckedHover = body.classList.contains('tf-force-checked-hover');
    var hadForceIndeterminate = body.classList.contains('tf-force-indeterminate');
    var transition = sample.style.getPropertyValue('transition');
    var priority = sample.style.getPropertyPriority('transition');
    sample.style.setProperty('transition', 'none', 'important');
    body.classList.toggle('tf-force-rest', targetState === 'rest');
    body.classList.toggle('tf-force-hover', targetState === 'hover' || targetState === 'active');
    body.classList.toggle('tf-force-active', targetState === 'active');
    body.classList.toggle('tf-force-checked', targetState === 'checked');
    body.classList.toggle('tf-force-checked-hover', targetState === 'checkedHover');
    body.classList.toggle('tf-force-indeterminate', targetState === 'indeterminate');
    var value = doc.defaultView.getComputedStyle(sample).getPropertyValue(prop);
    body.classList.toggle('tf-force-rest', hadRest);
    body.classList.toggle('tf-force-hover', hadHover);
    body.classList.toggle('tf-force-active', hadActive);
    body.classList.toggle('tf-force-checked', hadChecked);
    body.classList.toggle('tf-force-checked-hover', hadCheckedHover);
    body.classList.toggle('tf-force-indeterminate', hadForceIndeterminate);
    if (probeChk) {
      probeChk.checked = hadChk;
      probeChk.indeterminate = hadIndeterminate;
    }
    if (transition) sample.style.setProperty('transition', transition, priority);
    else sample.style.removeProperty('transition');
    return rgbToHex(value);
  }

  // Prepara o bloco de Cores em todos os estados + Animação de Hover (exibidos na Seção do Botão)
  var hoverSetting = document.createElement('label');
  hoverSetting.className = 'st-field st-hover-motion-setting';
  var hoverCheckbox = document.createElement('input');
  hoverCheckbox.type = 'checkbox';
  hoverCheckbox.checked = (studioState.currentDesigns[selector] || {}).hoverMotion !== undefined
    ? studioState.currentDesigns[selector].hoverMotion : !isTag;
  var hoverCaption = document.createElement('span');
  hoverCaption.textContent = 'Animar ao passar o mouse';
  hoverSetting.appendChild(hoverCheckbox);
  hoverSetting.appendChild(hoverCaption);
  hoverCheckbox.addEventListener('change', function () {
    targetSelectors.forEach(function (sel) {
      studioState.currentDesigns[sel] = studioState.currentDesigns[sel] || {};
      studioState.currentDesigns[sel].hoverMotion = hoverCheckbox.checked;
    });
    applyAllTokensToFrames();
    studioState.designDirty = true;
    showToast(chkAutoSave.checked ? 'Alterações pendentes — salvando…' : 'Alterações pendentes — use Salvar no Projeto');
    if (chkAutoSave.checked) scheduleSaveToDisk(false);
  });

  var colorGrid = document.createElement('div');
  colorGrid.className = 'st-individual-colors';
  var colorEntries = [
    ['Fundo · repouso', 'rest', 'background-color'],
    ['Fundo · hover', 'hover', 'background-color'],
    ['Fundo · clique', 'active', 'background-color'],
    ['Texto · repouso', 'rest', 'color'],
    ['Texto · hover', 'hover', 'color'],
    ['Texto · clique', 'active', 'color'],
    ['Borda · repouso', 'rest', 'border-color'],
    ['Borda · hover', 'hover', 'border-color'],
    ['Borda · clique', 'active', 'border-color']
  ];
  if (supportsCheckedState) {
    colorEntries.push(
      ['Fundo · ativado', 'checked', 'background-color'],
      ['Texto · ativado', 'checked', 'color'],
      ['Borda · ativado', 'checked', 'border-color'],
      ['Fundo · hover ativado', 'checkedHover', 'background-color'],
      ['Texto · hover ativado', 'checkedHover', 'color'],
      ['Borda · hover ativado', 'checkedHover', 'border-color']
    );
  }
  if (supportsPartialState) {
    colorEntries.push(
      ['Fundo · parcial', 'indeterminate', 'background-color'],
      ['Texto · parcial', 'indeterminate', 'color'],
      ['Borda · parcial', 'indeterminate', 'border-color']
    );
  }
  var borderPickerByState = {};
  var quickBorderControls = null;
  var colorControlRefs = {};
  colorEntries.forEach(function (entry) {
    var card = document.createElement('label');
    card.className = 'st-inspector-color-card';
    if (colorCardsByState[entry[1]]) colorCardsByState[entry[1]].push(card);
    var caption = document.createElement('span');
    caption.className = 'st-inspector-color-label';
    caption.textContent = entry[0];
    var row = document.createElement('div');
    row.className = 'st-inspector-color-inputs';
    var picker = document.createElement('input');
    picker.type = 'color';
    var hex = document.createElement('input');
    hex.type = 'text'; hex.maxLength = 7; hex.className = 'st-input';
    var stored = key === 'folder-row' && entry[1] === 'rest' && entry[2] === 'background-color'
      ? studioState.currentTokens['--tf-editor-row-bg'] : ((studioState.currentDesigns[selector] || {})[entry[1]] || {})[entry[2]];
    picker.value = stored ? rgbToHex(stored) : stateColor(entry[1], entry[2]);
    hex.value = stored || picker.value;
    colorControlRefs[entry[1]] = colorControlRefs[entry[1]] || {};
    colorControlRefs[entry[1]][entry[2]] = { picker: picker, hex: hex };
    if (entry[2] === 'border-color') {
      borderPickerByState[entry[1]] = { picker: picker, hex: hex };
    }
    function commitColorHex(value, normalizeInput) {
      value = value.toUpperCase();
      if (normalizeInput) hex.value = value;
      picker.value = value;
      setDesignProperty(entry[1], entry[2], value);
      if (entry[2] === 'border-color' && quickBorderControls && quickBorderControls.state === entry[1]) {
        quickBorderControls.picker.value = value;
        quickBorderControls.hex.value = value;
      }
    }
    picker.addEventListener('input', function () {
      commitColorHex(picker.value, true);
    });
    hex.addEventListener('input', function () {
      var value = hex.value.trim();
      if (/^[0-9a-fA-F]{6}$/.test(value)) value = '#' + value;
      if (/^#[0-9a-fA-F]{6}$/.test(value)) commitColorHex(value, false);
    });
    hex.addEventListener('change', function () {
      var value = hex.value.trim();
      if (/^[0-9a-fA-F]{6}$/.test(value)) value = '#' + value;
      if (!/^#[0-9a-fA-F]{6}$/.test(value)) { showToast('Use uma cor HEX de 6 dígitos'); return; }
      commitColorHex(value, true);
    });
    card.appendChild(caption); row.appendChild(picker); row.appendChild(hex);
    if (!(key === 'folder-row' && entry[1] === 'rest' && entry[2] === 'background-color')) {
      var clearColor = document.createElement('button');
      clearColor.type = 'button';
      clearColor.className = 'st-design-color-clear';
      clearColor.textContent = '×';
      clearColor.title = 'Remover cor individual';
      clearColor.addEventListener('click', function () {
        setDesignProperty(entry[1], entry[2], '');
        var inherited = stateColor(entry[1], entry[2]);
        picker.value = inherited;
        hex.value = inherited;
        if (entry[2] === 'border-color' && quickBorderControls && quickBorderControls.state === entry[1]) {
          quickBorderControls.picker.value = inherited;
          quickBorderControls.hex.value = inherited.toUpperCase();
        }
      });
      row.appendChild(clearColor);
    }
    card.appendChild(row); colorGrid.appendChild(card);
  });
  if (colorProbeRoot && colorProbeRoot.parentNode) colorProbeRoot.parentNode.removeChild(colorProbeRoot);
  highlightCurrentStateCards();

  function snapshotCurrentColorStates() {
    var snap = {};
    designStates.forEach(function (stKey) {
      var stRefs = colorControlRefs[stKey] || {};
      snap[stKey] = {};
      ['background-color', 'color', 'border-color'].forEach(function (prop) {
        if (stRefs[prop] && stRefs[prop].hex) {
          snap[stKey][prop] = stRefs[prop].hex.value.toUpperCase();
        }
      });
    });
    return snap;
  }

  function applyColorStatesBatch(colorMap, feedbackText) {
    if (!colorMap) return;
    const edits = {};
    for (const state of designStates) {
      if (!colorMap[state]) continue;
      const properties = {};
      for (const property of ['background-color', 'color', 'border-color']) {
        if (colorMap[state][property]) properties[property] = colorMap[state][property];
      }
      edits[state] = properties;
    }
    if (!applyDesignEdits(targetSelectors, edits, feedbackText)) return;

    designStates.forEach(function (stKey) {
      var stValues = colorMap[stKey];
      var stRefs = colorControlRefs[stKey] || {};
      if (!stValues) return;
      ['background-color', 'color', 'border-color'].forEach(function (prop) {
        var val = stValues[prop];
        if (val && stRefs[prop]) {
          stRefs[prop].picker.value = rgbToHex(val);
          stRefs[prop].hex.value = rgbToHex(val);
        }
      });
    });
    if (quickBorderControls && colorMap[quickBorderControls.state] && colorMap[quickBorderControls.state]['border-color']) {
      var bHex = rgbToHex(colorMap[quickBorderControls.state]['border-color']);
      quickBorderControls.picker.value = bHex;
      quickBorderControls.hex.value = bHex;
    }

  }

  const colorPresetsBar = createPaletteBar({ isMulti, targetSelectors, supportsCheckedState, snapshotCurrentColorStates, applyColorStatesBatch });
  return { colorPresetsBar, colorGrid, hoverSetting, borderPickerByState, stateColor, setQuickBorder(controls) { quickBorderControls = controls; } };
}
