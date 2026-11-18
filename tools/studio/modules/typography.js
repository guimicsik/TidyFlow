import { createAxisControl } from './axis-control.js';
import { inspInputText } from './dom.js';

export function appendTextPadding({ row, current, computed, manual, state, setDesignProperty }) {
  var paddingStyle = document.createElement('div').style;
  paddingStyle.padding = current;
  var paddingSides = ['top', 'right', 'bottom', 'left'].map(function (side) {
    return paddingStyle.getPropertyValue('padding-' + side) || computed.getPropertyValue('padding-' + side).trim() || '0px';
  });
  var paddingControls = document.createElement('div');
  paddingControls.className = 'st-design-shadow-controls';
  [{ name: 'Limite X', sides: [1, 3] }, { name: 'Limite Y', sides: [0, 2] }].forEach(function (axis) {
    const { range: axisRange, field: axisField } = createAxisControl(paddingControls, {
      title: axis.name, min: 0, max: 160, type: 'text', value: paddingSides[axis.sides[0]],
      sliderLabel: 'Espaço interno: ' + axis.name, fieldLabel: 'Valor preciso do espaço interno: ' + axis.name
    });
    function updatePadding(value) {
      if (/^(?:\d+\.?\d*|\.\d+)$/.test(value)) value += 'px';
      if (!value || !CSS.supports('padding-top', value)) { axisField.value = paddingSides[axis.sides[0]]; return; }
      paddingSides[axis.sides[0]] = value;
      paddingSides[axis.sides[1]] = value;
      axisField.value = value;
      axisRange.value = Math.max(0, Math.min(160, parseFloat(value) || 0));
      manual.value = paddingSides.join(' ');
      setDesignProperty(state.value, 'padding', manual.value);
    }
    axisRange.addEventListener('input', function () { updatePadding(axisRange.value); });
    axisField.addEventListener('change', function () { updatePadding(axisField.value.trim()); });
  });
  row.appendChild(paddingControls);
}

export function appendTextSection({ grid, contentEditable }) {
  const textSecEl = inspInputText.closest('#inspSecText');
  textSecEl.style.display = contentEditable ? '' : 'none';
  textSecEl.style.gridColumn = '1 / -1';
  textSecEl.style.padding = '8px';
  textSecEl.style.marginBottom = '4px';
  grid.appendChild(textSecEl);
}
