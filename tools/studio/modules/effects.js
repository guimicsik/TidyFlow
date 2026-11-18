import { createAxisControl } from './axis-control.js';
import { parsePxNumber, rgbToHex } from './color-utils.js';
import { studioState } from './state.js';

export function appendDiagonalShadow({ grid, selector, computed, state, designStates, designStateLabels, setDesignProperty, render }) {
  // Controle Unificado: Tamanho + Cor da Sombra Diagonal (Elevação na Animação)
  var diagCard = document.createElement('div');
  diagCard.className = 'st-field st-design-property st-nucleus-subcard';
  diagCard.style.gridColumn = '1 / -1';
  var diagHeader = document.createElement('div');
  diagHeader.className = 'st-design-property-heading';
  var diagTitle = document.createElement('span');
  diagTitle.className = 'st-nucleus-subtitle';
  diagTitle.textContent = 'Sombra Diagonal & Distância que Levanta (' + designStateLabels[designStates.indexOf(state.value)] + ')';
  diagHeader.appendChild(diagTitle);
  diagCard.appendChild(diagHeader);

  var stValues = (studioState.currentDesigns[selector] || {})[state.value] || {};
  var curShadowStr = stValues['box-shadow'] || computed.getPropertyValue('box-shadow').trim() || '0px 0px 0px #000000';
  var diagColorMatch = curShadowStr.match(/rgba?\([^)]+\)|#[0-9a-fA-F]{3,8}/);
  var diagShadowColor = diagColorMatch ? rgbToHex(diagColorMatch[0]) : '#000000';
  var diagLenMatch = curShadowStr.replace(diagColorMatch ? diagColorMatch[0] : '', '').match(/-?\d+(?:\.\d+)?px/);
  var diagDist = diagLenMatch ? Math.abs(parseFloat(diagLenMatch[0])) : 0;

  var diagRow = document.createElement('div');
  diagRow.className = 'st-design-property-row';
  diagRow.style.alignItems = 'center';

  var diagRange = document.createElement('input');
  diagRange.type = 'range';
  diagRange.className = 'st-design-slider';
  diagRange.min = 0; diagRange.max = 20; diagRange.step = 0.5;
  diagRange.value = Math.min(20, diagDist);
  diagRange.title = 'Distância que o botão levanta na diagonal e tamanho da sombra';

  var diagPrecise = document.createElement('input');
  diagPrecise.type = 'text';
  diagPrecise.className = 'st-design-value st-design-precise';
  diagPrecise.style.flex = '0 0 68px';
  diagPrecise.value = diagDist + 'px';

  var diagColorInput = document.createElement('input');
  diagColorInput.type = 'color';
  diagColorInput.value = diagShadowColor;
  diagColorInput.title = 'Cor da sombra diagonal';
  diagColorInput.style.flex = '0 0 28px';
  diagColorInput.style.height = '25px';
  diagColorInput.style.padding = '0';
  diagColorInput.style.border = '1px solid #000';
  diagColorInput.style.borderRadius = '4px';
  diagColorInput.style.cursor = 'pointer';

  var diagClear = document.createElement('button');
  diagClear.type = 'button';
  diagClear.className = 'st-design-property-clear';
  diagClear.textContent = '×';
  diagClear.title = 'Limpar sombra e elevação deste estado';

  function applyDiagonalShadowAndLift(distNum, colHex) {
    var d = Math.max(0, Number(distNum) || 0);
    var shadowCss = d + 'px ' + d + 'px 0px ' + colHex;
    var liftCss = d === 0 ? 'translate(0px, 0px)' : 'translate(-' + d + 'px, -' + d + 'px)';
    diagRange.value = Math.min(20, d);
    diagPrecise.value = d + 'px';
    setDesignProperty(state.value, 'box-shadow', shadowCss);
    setDesignProperty(state.value, 'transform', liftCss);
  }

  diagRange.addEventListener('input', function () {
    applyDiagonalShadowAndLift(diagRange.value, diagColorInput.value.toUpperCase());
  });
  diagPrecise.addEventListener('change', function () {
    var n = parsePxNumber(diagPrecise.value, diagDist);
    applyDiagonalShadowAndLift(n, diagColorInput.value.toUpperCase());
  });
  diagColorInput.addEventListener('input', function () {
    var curD = parsePxNumber(diagPrecise.value, diagDist);
    applyDiagonalShadowAndLift(curD, diagColorInput.value.toUpperCase());
  });
  diagClear.addEventListener('click', function () {
    setDesignProperty(state.value, 'box-shadow', '');
    setDesignProperty(state.value, 'transform', '');
    render();
  });

  diagRow.appendChild(diagRange);
  diagRow.appendChild(diagPrecise);
  diagRow.appendChild(diagColorInput);
  diagRow.appendChild(diagClear);
  diagCard.appendChild(diagRow);
  grid.appendChild(diagCard);
}

export function appendShadowAxes({ row, current, manual, state, setDesignProperty }) {
  var shadowText = String(current || '');
  var shadowColorMatch = shadowText.match(/rgba?\([^)]+\)|#[0-9a-fA-F]{3,8}/);
  var shadowColor = shadowColorMatch ? shadowColorMatch[0] : '#000000';
  var shadowLengths = shadowText.replace(shadowColor, '').match(/-?\d+(?:\.\d+)?px/g) || [];
  var shadowControls = document.createElement('div');
  shadowControls.className = 'st-design-shadow-controls';
  var shadowFields = [];
  function updateShadow() {
    var cssValue = shadowFields.map(function (field) { return field.value + 'px'; }).join(' ') + ' ' + shadowColor;
    manual.value = cssValue;
    setDesignProperty(state.value, 'box-shadow', cssValue);
  }
  [{ name: 'X', min: -40, max: 40 }, { name: 'Y', min: -40, max: 40 },
  { name: 'Desfoque', min: 0, max: 80 }, { name: 'Expansão', min: -40, max: 40 }].forEach(function (axis, index) {
    const { range: axisRange, field: axisField } = createAxisControl(shadowControls, {
      title: axis.name, min: axis.min, max: axis.max, type: 'number',
      value: parseFloat(shadowLengths[index]) || 0, sliderLabel: 'Sombra: ' + axis.name,
      fieldLabel: 'Valor preciso da sombra: ' + axis.name + ' em pixels'
    });
    axisRange.addEventListener('input', function () {
      axisField.value = axisRange.value;
      updateShadow();
    });
    axisField.addEventListener('change', function () {
      if (axisField.value === '' || !isFinite(Number(axisField.value))) {
        axisField.value = axisRange.value;
        return;
      }
      axisRange.value = Math.max(axis.min, Math.min(axis.max, Number(axisField.value)));
      updateShadow();
    });
    shadowFields.push(axisField);
  });
  var colorLabel = document.createElement('div');
  colorLabel.className = 'st-design-shadow-color';
  colorLabel.textContent = 'Cor';
  var colorPicker = document.createElement('input');
  colorPicker.type = 'color';
  colorPicker.setAttribute('aria-label', 'Cor da sombra');
  colorPicker.value = rgbToHex(shadowColor);
  colorPicker.addEventListener('input', function () { shadowColor = colorPicker.value; updateShadow(); });
  colorLabel.appendChild(colorPicker);
  shadowControls.appendChild(colorLabel);
  row.appendChild(shadowControls);
}
