import { parsePxNumber, rgbToHex } from './color-utils.js';
import { showToast } from './dom.js';
import { studioState } from './state.js';
import { appendDiagonalShadow, appendShadowAxes } from './effects.js';
import { appendTextPadding, appendTextSection } from './typography.js';
import {
  PROPERTY_GROUPS,
  PROPERTY_SLIDERS,
  PROPERTY_CHOICES,
  sliderNumber,
  sliderCss,
  PROPERTY_LABELS
} from './property-config.js';

export function createPropertyRenderer({ section, el, selector, contentEditable, state, designStates, designStateLabels, setDesignProperty, colors }) {
  var fields = document.createElement('div');
  fields.className = 'st-design-property-groups';
  section.appendChild(fields);
  var openedGroups = [true, true, true, false];

  function render() {
    fields.replaceChildren();
    var visualEl = el.classList && el.classList.contains('tf-toggle')
      ? (el.querySelector('.tf-toggle__face') || el)
      : (el.classList && el.classList.contains('collect-check')
        ? (el.querySelector('.toggle-slider') || el)
        : el);
    var textVisualEl = el.classList && el.classList.contains('collect-check')
      ? (el.querySelector('span:not(.toggle-slider)') || el)
      : (el.querySelector && el.querySelector('.btn-tile-label, .tf-toggle__face')) || visualEl;
    var computed = visualEl.ownerDocument.defaultView.getComputedStyle(visualEl);
    var textComputed = textVisualEl.ownerDocument.defaultView.getComputedStyle(textVisualEl);
    var wrapperComputed = el.ownerDocument.defaultView.getComputedStyle(el);




    PROPERTY_GROUPS.forEach(function (group, groupIndex) {
      var details = document.createElement('details');
      details.className = 'st-design-property-group';
      if (group.id === 'grp-effects') details.classList.add('st-design-effects-group');
      details.open = openedGroups[groupIndex];
      details.addEventListener('toggle', function () { openedGroups[groupIndex] = details.open; });
      var heading = document.createElement('summary');
      heading.textContent = group.title;
      details.appendChild(heading);
      var grid = document.createElement('div');
      grid.className = 'st-design-property-grid';

      // Na Seção 1 (Texto): insere o campo de Conteúdo (#inspSecText) no topo
      if (group.id === 'grp-text') appendTextSection({ grid, contentEditable });

      // Na Seção 2 (Botão): insere Cores em todos os estados + Animação + Sombra Diagonal Unificada
      if (group.id === 'grp-button') {
        var colorsSubcard = document.createElement('div');
        colorsSubcard.className = 'st-nucleus-subcard';
        colorsSubcard.style.gridColumn = '1 / -1';
        var colorsTitle = document.createElement('div');
        colorsTitle.className = 'st-nucleus-subtitle';
        colorsTitle.textContent = 'Cores em Todos os Estados (Fundo, Texto e Borda)';
        colorsSubcard.appendChild(colorsTitle);
        colorsSubcard.appendChild(colors.colorPresetsBar);
        colorsSubcard.appendChild(colors.colorGrid);
        grid.appendChild(colorsSubcard);

        colors.hoverSetting.style.gridColumn = '1 / -1';
        grid.appendChild(colors.hoverSetting);

        appendDiagonalShadow({ grid, selector, computed, state, designStates, designStateLabels, setDesignProperty, render });
      }

      group.props.forEach(function (prop) {

        var label = document.createElement('label');
        label.className = 'st-field st-design-property';
        if (prop === 'font-size') label.classList.add('st-design-text-size');
        var caption = document.createElement('span');
        caption.textContent = PROPERTY_LABELS[prop] || prop;
        var propertyHeading = document.createElement('div');
        propertyHeading.className = 'st-design-property-heading';
        propertyHeading.appendChild(caption);
        label.appendChild(propertyHeading);
        var row = document.createElement('div');
        row.className = 'st-design-property-row';
        var values = (studioState.currentDesigns[selector] || {})[state.value] || {};
        var stored = values[prop] || '';
        var refComputed = (prop === 'width' || prop === 'margin')
          ? wrapperComputed
          : (['font-size', 'font-weight', 'line-height', 'letter-spacing', 'text-align', 'text-transform'].indexOf(prop) >= 0 ? textComputed : computed);
        var inherited = refComputed.getPropertyValue(prop).trim();
        var current = stored || inherited;
        var manual = document.createElement('input');
        manual.type = 'text';
        manual.className = 'st-input';
        manual.value = stored;
        manual.placeholder = inherited;
        manual.setAttribute('aria-label', 'CSS manual: ' + (PROPERTY_LABELS[prop] || prop));
        manual.addEventListener('change', function () {
          setDesignProperty(state.value, prop, manual.value.trim());
          render();
        });
        if (prop === 'padding') {
          appendTextPadding({ row, current, computed, manual, state, setDesignProperty });
        } else if (prop === 'box-shadow') {
          appendShadowAxes({ row, current, manual, state, setDesignProperty });
        } else if (PROPERTY_SLIDERS[prop]) {
          var range = document.createElement('input');
          range.type = 'range';
          range.className = 'st-design-slider';
          range.setAttribute('aria-label', PROPERTY_LABELS[prop] || prop);
          range.min = PROPERTY_SLIDERS[prop][0];
          range.max = PROPERTY_SLIDERS[prop][1];
          range.step = PROPERTY_SLIDERS[prop][2];
          var fallback = prop === 'line-height' ? parsePxNumber(textComputed.fontSize, 14) * 1.2 :
            prop === 'grid-template-columns' ? 1 : prop === 'opacity' ? 1 : 0;
          var initial = sliderNumber(prop, current, fallback);
          range.value = Math.max(PROPERTY_SLIDERS[prop][0], Math.min(PROPERTY_SLIDERS[prop][1], initial));
          var precise = document.createElement('input');
          precise.type = 'text';
          precise.className = 'st-design-value st-design-precise';
          precise.value = current;
          precise.title = 'Digite um valor preciso ou uma unidade CSS';
          precise.setAttribute('aria-label', 'Valor preciso: ' + (PROPERTY_LABELS[prop] || prop));
          range.addEventListener('input', function () {
            var cssValue = sliderCss(prop, Number(range.value), manual.value || current);
            manual.value = cssValue;
            precise.value = cssValue;
            setDesignProperty(state.value, prop, cssValue);
          });
          precise.addEventListener('change', function () {
            var entered = precise.value.trim();
            var cssValue = /^-?(?:\d+\.?\d*|\.\d+)$/.test(entered) ?
              (prop === 'line-height' ? entered : sliderCss(prop, Number(entered), current)) : entered;
            if (!cssValue || !CSS.supports(prop, cssValue)) {
              showToast('Valor inválido para ' + prop);
              precise.value = manual.value || current;
              return;
            }
            precise.value = cssValue;
            manual.value = cssValue;
            var parsed = sliderNumber(prop, cssValue, Number(range.value));
            range.value = Math.max(PROPERTY_SLIDERS[prop][0], Math.min(PROPERTY_SLIDERS[prop][1], parsed));
            setDesignProperty(state.value, prop, cssValue);
          });
          row.appendChild(range);
          row.appendChild(precise);

          // Se for border-width, inclui seletor rápido + campo HEX da Cor da Borda do estado atual ao lado
          if (prop === 'border-width') {
            var quickBorderCol = document.createElement('input');
            quickBorderCol.type = 'color';
            var curBorderStored = ((studioState.currentDesigns[selector] || {})[state.value] || {})['border-color'];
            quickBorderCol.value = curBorderStored ? rgbToHex(curBorderStored) : colors.stateColor(state.value, 'border-color');
            quickBorderCol.title = 'Cor da borda (' + state.value + ')';
            quickBorderCol.style.flex = '0 0 28px';
            quickBorderCol.style.height = '25px';
            quickBorderCol.style.padding = '0';
            quickBorderCol.style.border = '1px solid #000';
            quickBorderCol.style.borderRadius = '4px';
            quickBorderCol.style.cursor = 'pointer';

            var quickBorderHex = document.createElement('input');
            quickBorderHex.type = 'text';
            quickBorderHex.maxLength = 7;
            quickBorderHex.className = 'st-design-hex-inline';
            quickBorderHex.value = quickBorderCol.value.toUpperCase();
            quickBorderHex.placeholder = '#000000';
            quickBorderHex.title = 'Cor da borda em HEX (' + state.value + ')';
            quickBorderHex.setAttribute('aria-label', 'Cor da borda em HEX (' + state.value + ')');

            function applyQuickBorderHex(hexVal) {
              var normalized = hexVal.toUpperCase();
              quickBorderCol.value = normalized;
              quickBorderHex.value = normalized;
              setDesignProperty(state.value, 'border-color', normalized);
              if (colors.borderPickerByState[state.value]) {
                colors.borderPickerByState[state.value].picker.value = normalized;
                colors.borderPickerByState[state.value].hex.value = normalized;
              }
            }

            quickBorderCol.addEventListener('input', function () {
              applyQuickBorderHex(quickBorderCol.value);
            });
            quickBorderHex.addEventListener('input', function () {
              var val = quickBorderHex.value.trim();
              if (/^#[0-9a-fA-F]{6}$/.test(val)) {
                applyQuickBorderHex(val);
              }
            });
            quickBorderHex.addEventListener('change', function () {
              var val = quickBorderHex.value.trim();
              if (/^[0-9a-fA-F]{6}$/.test(val)) val = '#' + val;
              if (!/^#[0-9a-fA-F]{6}$/.test(val)) {
                showToast('Use uma cor HEX de 6 dígitos');
                quickBorderHex.value = quickBorderCol.value.toUpperCase();
                return;
              }
              applyQuickBorderHex(val);
            });

            colors.setQuickBorder({ state: state.value, picker: quickBorderCol, hex: quickBorderHex });
            row.appendChild(quickBorderCol);
            row.appendChild(quickBorderHex);
          }
        } else if (PROPERTY_CHOICES[prop]) {
          var menu = document.createElement('select');
          menu.className = 'st-select st-design-choice';
          var options = PROPERTY_CHOICES[prop].slice();
          if (current && options.indexOf(current) === -1) options.unshift(current);
          options.forEach(function (option) { menu.add(new Option(option, option)); });
          menu.value = current || options[0];
          menu.addEventListener('change', function () {
            manual.value = menu.value;
            setDesignProperty(state.value, prop, menu.value);
          });
          row.appendChild(menu);
        }
        var clear = document.createElement('button');
        clear.type = 'button';
        clear.className = 'st-design-property-clear';
        clear.textContent = '×';
        clear.title = 'Remover ajuste individual de ' + (PROPERTY_LABELS[prop] || prop);
        clear.addEventListener('click', function () { setDesignProperty(state.value, prop, ''); render(); });
        row.appendChild(clear);
        label.appendChild(row);
        var manualDetails = document.createElement('details');
        manualDetails.className = 'st-design-manual';
        var manualTitle = document.createElement('summary');
        manualTitle.textContent = 'CSS';
        manualDetails.appendChild(manualTitle);
        manualDetails.appendChild(manual);
        propertyHeading.appendChild(manualDetails);
        // O tamanho fica fora das seções recolhíveis para acesso imediato.
        if (prop === 'font-size') fields.prepend(label);
        else grid.appendChild(label);
      });
      details.appendChild(grid);
      fields.appendChild(details);
    });
  }
  return render;
}
