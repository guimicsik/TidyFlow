import {
  COLOR_STATE_PRESETS,
  loadCustomColorPresets,
  saveCustomColorPresets,
  adjustHexBrightness,
  pickContrastTextHex
} from './palettes.js';
import { showToast } from './dom.js';
import { studioState } from './state.js';

export function createPaletteBar({ isMulti, targetSelectors, supportsCheckedState, snapshotCurrentColorStates, applyColorStatesBatch }) {
  var colorPresetsBar = document.createElement('div');
  colorPresetsBar.className = 'st-color-presets-bar';

  function renderColorPresetsBar() {
    colorPresetsBar.replaceChildren();

    var presetsRow = document.createElement('div');
    presetsRow.className = 'st-color-presets-row';

    var customPresets = loadCustomColorPresets();
    var allPresets = COLOR_STATE_PRESETS.map(function (p) { return { preset: p, isCustom: false }; })
      .concat(customPresets.map(function (p) { return { preset: p, isCustom: true }; }));

    allPresets.forEach(function (entry) {
      var p = entry.preset;
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'st-color-preset-chip';
      chip.title = 'Aplicar paleta "' + p.name + '"' + (isMulti ? (' nos ' + targetSelectors.length + ' itens') : '');

      var swatch = document.createElement('span');
      swatch.className = 'st-color-preset-swatch';
      var restBg = (p.rest && p.rest['background-color']) || '#3B82F6';
      var restTxt = (p.rest && p.rest.color) || '#FFFFFF';
      swatch.style.background = 'linear-gradient(135deg, ' + restBg + ' 60%, ' + restTxt + ' 60%)';

      var nameSpan = document.createElement('span');
      nameSpan.textContent = p.name;

      chip.appendChild(swatch);
      chip.appendChild(nameSpan);
      chip.addEventListener('click', function () {
        applyColorStatesBatch(p, 'Paleta "' + p.name + '" aplicada' + (isMulti ? (' (' + targetSelectors.length + ' itens)') : ''));
      });

      if (entry.isCustom) {
        var del = document.createElement('span');
        del.className = 'st-color-preset-del';
        del.textContent = '×';
        del.title = 'Excluir paleta salva';
        del.addEventListener('click', function (ev) {
          ev.stopPropagation();
          var next = loadCustomColorPresets().filter(function (item) { return item.id !== p.id; });
          saveCustomColorPresets(next);
          renderColorPresetsBar();
          showToast('Paleta "' + p.name + '" removida');
        });
        chip.appendChild(del);
      }

      presetsRow.appendChild(chip);
    });

    var actionsRow = document.createElement('div');
    actionsRow.className = 'st-color-preset-actions';

    var btnDerive = document.createElement('button');
    btnDerive.type = 'button';
    btnDerive.className = 'st-color-mini-btn';
    btnDerive.textContent = '✨ Derivar Hover/Clique';
    btnDerive.title = 'Calcula automaticamente Hover, Clique e contraste de Texto a partir do Fundo · repouso';
    btnDerive.addEventListener('click', function () {
      var cur = snapshotCurrentColorStates();
      var baseBg = (cur.rest && cur.rest['background-color']) || '#3B82F6';
      var baseBorder = (cur.rest && cur.rest['border-color']) || '#000000';
      var cleanBase = baseBg.replace('#', '');
      var avg = /^[0-9a-fA-F]{6}$/.test(cleanBase)
        ? (parseInt(cleanBase.slice(0, 2), 16) + parseInt(cleanBase.slice(2, 4), 16) + parseInt(cleanBase.slice(4, 6), 16)) / 3
        : 128;
      var hoverBg = avg > 210 ? adjustHexBrightness(baseBg, -14) : adjustHexBrightness(baseBg, 26);
      var activeBg = adjustHexBrightness(baseBg, -26);
      var derived = {
        rest: { 'background-color': baseBg, color: pickContrastTextHex(baseBg), 'border-color': baseBorder },
        hover: { 'background-color': hoverBg, color: pickContrastTextHex(hoverBg), 'border-color': baseBorder },
        active: { 'background-color': activeBg, color: pickContrastTextHex(activeBg), 'border-color': baseBorder }
      };
      if (supportsCheckedState) {
        var checkedBg = (cur.checked && cur.checked['background-color']) || baseBg;
        var checkedBorder = (cur.checked && cur.checked['border-color']) || baseBorder;
        var cleanChecked = checkedBg.replace('#', '');
        var avgChecked = /^[0-9a-fA-F]{6}$/.test(cleanChecked)
          ? (parseInt(cleanChecked.slice(0, 2), 16) + parseInt(cleanChecked.slice(2, 4), 16) + parseInt(cleanChecked.slice(4, 6), 16)) / 3
          : 128;
        var checkedHoverBg = avgChecked > 210 ? adjustHexBrightness(checkedBg, -14) : adjustHexBrightness(checkedBg, 26);
        derived.checked = { 'background-color': checkedBg, color: pickContrastTextHex(checkedBg), 'border-color': checkedBorder };
        derived.checkedHover = { 'background-color': checkedHoverBg, color: pickContrastTextHex(checkedHoverBg), 'border-color': checkedBorder };
      }
      applyColorStatesBatch(derived, 'Estados derivados de ' + baseBg);
    });

    var btnCopy = document.createElement('button');
    btnCopy.type = 'button';
    btnCopy.className = 'st-color-mini-btn';
    btnCopy.textContent = 'Copiar';
    btnCopy.title = 'Copiar todas as cores dos estados deste elemento';

    var btnPaste = document.createElement('button');
    btnPaste.type = 'button';
    btnPaste.className = 'st-color-mini-btn';
    btnPaste.textContent = 'Colar';
    btnPaste.disabled = !studioState.copiedColorStates;
    btnPaste.title = 'Colar cores copiadas' + (isMulti ? (' nos ' + targetSelectors.length + ' itens') : '');

    btnCopy.addEventListener('click', function () {
      studioState.copiedColorStates = snapshotCurrentColorStates();
      btnPaste.disabled = false;
      showToast('Cores dos estados copiadas!');
    });

    btnPaste.addEventListener('click', function () {
      if (!studioState.copiedColorStates) return;
      applyColorStatesBatch(studioState.copiedColorStates, 'Cores coladas' + (isMulti ? (' em ' + targetSelectors.length + ' itens') : ''));
    });

    var btnSavePreset = document.createElement('button');
    btnSavePreset.type = 'button';
    btnSavePreset.className = 'st-color-mini-btn';
    btnSavePreset.textContent = '+ Salvar';
    btnSavePreset.title = 'Salvar as cores atuais como um preset rápido';

    var saveRow = document.createElement('div');
    saveRow.className = 'st-color-save-row';
    saveRow.style.display = 'none';
    var saveNameInput = document.createElement('input');
    saveNameInput.type = 'text';
    saveNameInput.className = 'st-input';
    saveNameInput.placeholder = 'Nome da paleta (ex: Azul Hover)';
    var saveConfirmBtn = document.createElement('button');
    saveConfirmBtn.type = 'button';
    saveConfirmBtn.className = 'st-color-mini-btn';
    saveConfirmBtn.style.flex = '0 0 auto';
    saveConfirmBtn.textContent = 'OK';
    saveRow.appendChild(saveNameInput);
    saveRow.appendChild(saveConfirmBtn);

    btnSavePreset.addEventListener('click', function () {
      var opening = saveRow.style.display === 'none';
      saveRow.style.display = opening ? 'flex' : 'none';
      if (opening) {
        saveNameInput.value = '';
        saveNameInput.focus();
      }
    });

    function commitCustomPreset() {
      var name = saveNameInput.value.trim();
      if (!name) {
        showToast('Digite um nome para a paleta');
        saveNameInput.focus();
        return;
      }
      var snap = snapshotCurrentColorStates();
      var list = loadCustomColorPresets();
      list.push({
        id: 'custom_' + Date.now(),
        name: name.slice(0, 24),
        rest: snap.rest || {},
        hover: snap.hover || {},
        active: snap.active || {},
        checked: snap.checked || snap.rest || {},
        checkedHover: snap.checkedHover || snap.checked || snap.hover || {}
      });
      saveCustomColorPresets(list);
      renderColorPresetsBar();
      showToast('Paleta "' + name + '" salva!');
    }

    saveConfirmBtn.addEventListener('click', commitCustomPreset);
    saveNameInput.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        commitCustomPreset();
      } else if (ev.key === 'Escape') {
        saveRow.style.display = 'none';
      }
    });

    actionsRow.appendChild(btnDerive);
    actionsRow.appendChild(btnCopy);
    actionsRow.appendChild(btnPaste);
    actionsRow.appendChild(btnSavePreset);

    colorPresetsBar.appendChild(presetsRow);
    colorPresetsBar.appendChild(actionsRow);
    colorPresetsBar.appendChild(saveRow);
  }

  renderColorPresetsBar();
  return colorPresetsBar;
}
