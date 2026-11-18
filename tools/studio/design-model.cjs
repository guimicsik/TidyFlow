/* Modelo compartilhado entre o Studio e o servidor. */
(function (root) {
  var props = ['background-color','color','border-color','border-width','border-radius','font-size','font-weight','line-height','letter-spacing','text-align','text-transform','padding','margin','gap','width','height','min-width','min-height','max-width','max-height','display','justify-content','align-items','flex-direction','flex-wrap','grid-template-columns','overflow','box-shadow','transform','opacity','outline'];
  var textProps = ['color','font-size','font-weight','line-height','letter-spacing','text-align','text-transform'];
  var toggleWrapperProps = ['width','min-width','max-width','margin','opacity','display'];
  var checkSliderProps = ['background-color','border-color','border-width','border-radius','box-shadow','transform','width','height'];

  function buildDeclarations(values, filterList) {
    return Object.keys(values).filter(function (prop) {
      return !filterList || filterList.indexOf(prop) >= 0;
    }).map(function (prop) {
      var value = String(values[prop]);
      if (props.indexOf(prop) < 0 || /[{};<>]|url\s*\(|@/i.test(value)) throw new Error('Propriedade de design inválida');
      return prop + ': ' + value + ' !important;';
    }).join(' ');
  }

  function css(designs) {
    return Object.keys(designs || {}).map(function (selector) {
      if (!/^(#[A-Za-z][\w-]*|\[data-tf-design="[A-Za-z0-9_%.-]+"\])$/.test(selector)) throw new Error('Alvo de design inválido');
      var design = designs[selector];
      if (design.hoverMotion !== undefined && typeof design.hoverMotion !== 'boolean') throw new Error('Estado de hover inválido');
      var toggleSel = selector + '.tf-toggle';
      var checkSel = selector + '.collect-check';
      var motion = design.hoverMotion === false
        ? 'transform: none !important; box-shadow: none !important; transition: none !important;'
        : design.hoverMotion === true
        ? 'transform: translate(-2px, -2px) !important; box-shadow: 2px 2px 0 #000 !important;'
        : '';
      var motionRule = motion
        ? 'html body ' + selector + ':hover, html body.tf-force-hover ' + selector + ', html body.tf-force-checked-hover ' + selector + ', ' +
          'html body ' + toggleSel + ':hover .tf-toggle__face, html body.tf-force-hover ' + toggleSel + ' .tf-toggle__face, html body.tf-force-checked-hover ' + toggleSel + ' .tf-toggle__face, ' +
          'html body ' + checkSel + ':hover .toggle-slider, html body.tf-force-hover ' + checkSel + ' .toggle-slider, html body.tf-force-checked-hover ' + checkSel + ' .toggle-slider { ' + motion + ' }'
        : '';

      var stateRules = ['rest','checked','hover','checkedHover','indeterminate','active'].map(function (state) {
        var values = designs[selector][state] || {};
        var allDecl = buildDeclarations(values, null);
        if (!allDecl) return '';

        var textDecl = buildDeclarations(values, textProps);
        var textAlign = values['text-align'];
        var flexAlign = {left:'flex-start', center:'center', right:'flex-end'}[textAlign];

        // 1. Elementos padrão (Botões, Tags, Textos, Containers)
        var hasCheckedRule = Boolean(designs[selector].checked || designs[selector].checkedHover);
        var baseTargets = state === 'rest'
          ? 'html body ' + selector
          : state === 'checked'
          ? 'html body ' + selector + ':checked, html body input[type="checkbox"]:checked + ' + selector + ', html body .tf-toggle.active ' + selector + ', html body ' + selector + '.active, html body ' + selector + '[aria-pressed="true"], html body.tf-force-checked ' + selector
          : state === 'checkedHover'
          ? 'html body input[type="checkbox"]:checked + ' + selector + ':hover' +
            ', html body .tf-toggle.active ' + selector + ':hover' +
            ', html body ' + selector + '.active:hover' +
            ', html body ' + selector + '[aria-pressed="true"]:hover' +
            ', html body.tf-force-checked-hover ' + selector +
            ', html body.tf-force-checked-hover input[type="checkbox"]:checked + ' + selector +
            ', html body.tf-force-checked-hover .tf-toggle.active ' + selector
          : state === 'indeterminate'
          ? 'html body ' + selector + ':indeterminate, html body ' + selector + '.partial, html body.tf-force-indeterminate ' + selector
          : state === 'hover'
          ? 'html body ' + selector + (hasCheckedRule ? ':not(.active):not([aria-pressed="true"]):hover' : ':hover') +
            ', html body.tf-force-hover ' + selector +
            ', html body.tf-force-hover input[type="checkbox"]:checked + ' + selector +
            ', html body.tf-force-hover .tf-toggle.active ' + selector
          : 'html body ' + selector + ':active' +
            ', html body input[type="checkbox"]:checked + ' + selector + ':active' +
            ', html body .tf-toggle.active ' + selector + ':active' +
            ', html body.tf-force-active ' + selector +
            ', html body.tf-force-active input[type="checkbox"]:checked + ' + selector +
            ', html body.tf-force-active .tf-toggle.active ' + selector;

        var labelTargets = baseTargets.split(', ').map(function (t) { return t + ' .btn-tile-label'; }).join(', ');
        var labelExtras = (textDecl ? textDecl + ' ' : '') + (flexAlign ? 'align-items: ' + flexAlign + ' !important; ' : '');
        var labelRule = labelExtras ? labelTargets + ' { ' + labelExtras + '}' : '';
        var ownAlign = flexAlign ? baseTargets.split(', ').map(function (t) {
          return t + '.btn-tile-label { align-items: ' + flexAlign + ' !important; }';
        }).join('\n') : '';

        // 2. Toggles em Tile (.tf-toggle -> neutraliza caixa no label externo e estiliza .tf-toggle__face, sem :has() para compatibilidade com CEF)
        var colorOnlyProps = ['background-color', 'color'];
        var toggleFaceProps = Object.keys(values).filter(function (p) { return toggleWrapperProps.indexOf(p) < 0 || p === 'width'; });
        var toggleBaseProps = state === 'rest'
          ? toggleFaceProps.filter(function (p) { return colorOnlyProps.indexOf(p) < 0; })
          : toggleFaceProps;
        var toggleRestColorProps = state === 'rest'
          ? toggleFaceProps.filter(function (p) { return colorOnlyProps.indexOf(p) >= 0; })
          : [];
        var toggleFaceDecl = buildDeclarations(values, toggleBaseProps);
        var toggleRestColorDecl = buildDeclarations(values, toggleRestColorProps);
        if (values.width && toggleFaceDecl) {
          toggleFaceDecl = toggleFaceDecl.replace(/width:\s*[^;]+!important;/, 'width: 100% !important;');
        }
        if (flexAlign) {
          toggleFaceDecl += (toggleFaceDecl ? ' ' : '') + 'justify-content: ' + flexAlign + ' !important; align-items: center !important;';
        }
        var toggleWrapDecl = buildDeclarations(values, toggleWrapperProps) + ' background-color: transparent !important; border-width: 0px !important; box-shadow: none !important; padding: 0px !important; transform: none !important;';
        var toggleWrapTargets = state === 'rest'
          ? 'html body ' + toggleSel
          : state === 'checked'
          ? 'html body ' + toggleSel + '.active, html body.tf-force-checked ' + toggleSel
          : state === 'checkedHover'
          ? 'html body ' + toggleSel + '.active:hover, html body.tf-force-checked-hover ' + toggleSel
          : state === 'indeterminate'
          ? 'html body ' + toggleSel + '.partial, html body.tf-force-indeterminate ' + toggleSel
          : 'html body ' + toggleSel + ':' + state + ', html body.tf-force-' + state + ' ' + toggleSel;
        var toggleFaceTargets = state === 'rest'
          ? 'html body ' + toggleSel + ' .tf-toggle__face'
          : state === 'checked'
          ? 'html body:not(.tf-force-rest) ' + toggleSel + ':not(.is-disabled) input:checked:not(:disabled) + .tf-toggle__face, html body:not(.tf-force-rest) ' + toggleSel + '.active:not(.is-disabled) .tf-toggle__face, html body.tf-force-checked ' + toggleSel + ' .tf-toggle__face, html body.tf-force-checked ' + toggleSel + ' input:checked + .tf-toggle__face'
          : state === 'checkedHover'
          ? 'html body:not(.tf-force-rest) ' + toggleSel + ':not(.is-disabled):hover input[type="checkbox"]:checked:not(:disabled) + .tf-toggle__face, ' +
            'html body:not(.tf-force-rest) ' + toggleSel + '.active:not(.is-disabled):hover .tf-toggle__face, ' +
            'html body.tf-force-checked-hover ' + toggleSel + ' .tf-toggle__face, ' +
            'html body.tf-force-checked-hover ' + toggleSel + ' input[type="checkbox"]:not(:checked) + .tf-toggle__face, ' +
            'html body.tf-force-checked-hover ' + toggleSel + ' input[type="checkbox"]:checked + .tf-toggle__face, ' +
            'html body.tf-force-checked-hover ' + toggleSel + '.active .tf-toggle__face'
          : state === 'indeterminate'
          ? 'html body:not(.tf-force-rest) ' + toggleSel + '.partial:not(.is-disabled) .tf-toggle__face, html body.tf-force-indeterminate ' + toggleSel + ' .tf-toggle__face'
          : state === 'hover'
          ? 'html body:not(.tf-force-rest) ' + toggleSel + ':not(.active):not(.is-disabled):hover input[type="checkbox"]:not(:checked):not(:disabled) + .tf-toggle__face, ' +
            'html body.tf-force-hover ' + toggleSel + ' .tf-toggle__face, ' +
            'html body.tf-force-hover ' + toggleSel + ':not(.active) input[type="checkbox"]:not(:checked) + .tf-toggle__face, ' +
            'html body.tf-force-hover ' + toggleSel + ' input[type="checkbox"]:checked + .tf-toggle__face, ' +
            'html body.tf-force-hover ' + toggleSel + '.active .tf-toggle__face'
          : 'html body:not(.tf-force-rest) ' + toggleSel + ':not(.is-disabled):active .tf-toggle__face, ' +
            'html body:not(.tf-force-rest) ' + toggleSel + ':not(.is-disabled):active input[type="checkbox"]:not(:checked):not(:disabled) + .tf-toggle__face, ' +
            'html body:not(.tf-force-rest) ' + toggleSel + ':not(.is-disabled):active input[type="checkbox"]:checked:not(:disabled) + .tf-toggle__face, ' +
            'html body:not(.tf-force-rest) ' + toggleSel + '.active:not(.is-disabled):active .tf-toggle__face, ' +
            'html body.tf-force-active:not(.tf-force-rest) ' + toggleSel + ' .tf-toggle__face, ' +
            'html body.tf-force-active:not(.tf-force-rest) ' + toggleSel + ' input[type="checkbox"]:not(:checked) + .tf-toggle__face, ' +
            'html body.tf-force-active:not(.tf-force-rest) ' + toggleSel + ' input[type="checkbox"]:checked + .tf-toggle__face, ' +
            'html body.tf-force-active:not(.tf-force-rest) ' + toggleSel + '.active .tf-toggle__face';
        var toggleRestColorTargets = 'html body:not(.tf-force-checked):not(.tf-force-checked-hover) ' + toggleSel + ':not(.active) input:not(:checked) + .tf-toggle__face, html body:not(.tf-force-checked):not(.tf-force-checked-hover) ' + toggleSel + '.is-disabled .tf-toggle__face, html body:not(.tf-force-checked):not(.tf-force-checked-hover) ' + toggleSel + ' input:disabled + .tf-toggle__face, html body.tf-force-rest ' + toggleSel + ' .tf-toggle__face, html body.tf-force-rest ' + toggleSel + ' input:checked + .tf-toggle__face';

        var toggleRules = [
          toggleWrapTargets + ' { ' + toggleWrapDecl.trim() + ' }',
          toggleFaceDecl ? toggleFaceTargets + ' { ' + toggleFaceDecl + ' }' : '',
          toggleRestColorDecl ? toggleRestColorTargets + ' { ' + toggleRestColorDecl + ' }' : ''
        ].filter(Boolean).join('\n');

        // 3. Checkboxes com Rótulo (.collect-check -> estiliza .toggle-slider e span de texto, sem :has() para compatibilidade com CEF)
        var checkSliderDecl = buildDeclarations(values, checkSliderProps);
        var checkTextDecl = buildDeclarations(values, textProps.concat(['padding']));
        var checkSliderTargets = state === 'rest'
          ? 'html body ' + checkSel + ' .toggle-slider'
          : state === 'checked'
          ? 'html body:not(.tf-force-rest) ' + checkSel + ' input[type="checkbox"]:checked + .toggle-slider, html body.tf-force-checked ' + checkSel + ' .toggle-slider'
          : state === 'checkedHover'
          ? 'html body:not(.tf-force-rest) ' + checkSel + ':hover input[type="checkbox"]:checked + .toggle-slider, html body.tf-force-checked-hover ' + checkSel + ' .toggle-slider, html body.tf-force-checked-hover ' + checkSel + ' input[type="checkbox"]:checked + .toggle-slider'
          : state === 'indeterminate'
          ? 'html body:not(.tf-force-rest) ' + checkSel + ' input[type="checkbox"]:indeterminate + .toggle-slider, html body.tf-force-indeterminate ' + checkSel + ' .toggle-slider'
          : state === 'hover'
          ? 'html body:not(.tf-force-rest) ' + checkSel + ':hover input[type="checkbox"]:not(:checked) + .toggle-slider, html body.tf-force-hover ' + checkSel + ' .toggle-slider, html body.tf-force-hover ' + checkSel + ' input[type="checkbox"]:checked + .toggle-slider'
          : 'html body:not(.tf-force-rest) ' + checkSel + ':active .toggle-slider, html body:not(.tf-force-rest) ' + checkSel + ':active input[type="checkbox"]:checked + .toggle-slider, html body.tf-force-active ' + checkSel + ' .toggle-slider, html body.tf-force-active ' + checkSel + ' input[type="checkbox"]:checked + .toggle-slider';
        var checkTextTargets = state === 'rest'
          ? 'html body ' + checkSel + ', html body ' + checkSel + ' span:not(.toggle-slider)'
          : state === 'checked'
          ? 'html body:not(.tf-force-rest) ' + checkSel + ' input[type="checkbox"]:checked ~ span:not(.toggle-slider), html body.tf-force-checked ' + checkSel + ' span:not(.toggle-slider)'
          : state === 'checkedHover'
          ? 'html body:not(.tf-force-rest) ' + checkSel + ':hover input[type="checkbox"]:checked ~ span:not(.toggle-slider), html body.tf-force-checked-hover ' + checkSel + ' span:not(.toggle-slider), html body.tf-force-checked-hover ' + checkSel + ' input[type="checkbox"]:checked ~ span:not(.toggle-slider)'
          : state === 'indeterminate'
          ? 'html body:not(.tf-force-rest) ' + checkSel + ' input[type="checkbox"]:indeterminate ~ span:not(.toggle-slider), html body.tf-force-indeterminate ' + checkSel + ' span:not(.toggle-slider)'
          : state === 'hover'
          ? 'html body:not(.tf-force-rest) ' + checkSel + ':hover input[type="checkbox"]:not(:checked) ~ span:not(.toggle-slider), html body.tf-force-hover ' + checkSel + ' span:not(.toggle-slider), html body.tf-force-hover ' + checkSel + ' input[type="checkbox"]:checked ~ span:not(.toggle-slider)'
          : 'html body:not(.tf-force-rest) ' + checkSel + ':active span:not(.toggle-slider), html body:not(.tf-force-rest) ' + checkSel + ':active input[type="checkbox"]:checked ~ span:not(.toggle-slider), html body.tf-force-active ' + checkSel + ' span:not(.toggle-slider), html body.tf-force-active ' + checkSel + ' input[type="checkbox"]:checked ~ span:not(.toggle-slider)';
        var checkRules = (checkSliderDecl ? checkSliderTargets + ' { ' + checkSliderDecl + ' }\n' : '') +
                         (checkTextDecl ? checkTextTargets + ' { ' + checkTextDecl + ' }' : '');

        return [baseTargets + ' { ' + allDecl + ' }', ownAlign, labelRule, toggleRules, checkRules].filter(Boolean).join('\n');
      }).join('\n');
      return design.hoverMotion === false ? stateRules + '\n' + motionRule : motionRule + '\n' + stateRules;
    }).join('\n');
  }
  function shadowCss(tokens) {
    return Object.keys(tokens).filter(function (key) {
      return /^--tf-studio-shadow-[A-Za-z][A-Za-z0-9_-]*$/.test(key);
    }).map(function (key) {
      var id = key.slice('--tf-studio-shadow-'.length);
      return '#' + id + ':hover, body.tf-force-hover #' + id + ' { box-shadow: var(' + key + ') !important; }';
    }).join('\n');
  }
  var api = { css: css, props: props, shadowCss: shadowCss };
  if (typeof module !== 'undefined') module.exports = api;
  else root.TFDesignModel = api;
})(typeof window !== 'undefined' ? window : this);
