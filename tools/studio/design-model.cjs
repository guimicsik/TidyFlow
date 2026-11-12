/* Modelo compartilhado entre o Studio e o servidor. */
(function (root) {
  var props = ['background-color','color','border-color','border-width','border-radius','font-size','font-weight','line-height','letter-spacing','text-align','text-transform','padding','margin','gap','width','height','min-width','min-height','max-width','max-height','display','justify-content','align-items','flex-direction','flex-wrap','grid-template-columns','overflow','box-shadow','transform','opacity','outline'];
  function css(designs) {
    return Object.keys(designs || {}).map(function (selector) {
      if (!/^(#[A-Za-z][\w-]*|\[data-tf-design="[A-Za-z0-9_%.-]+"\])$/.test(selector)) throw new Error('Alvo de design inválido');
      var design = designs[selector];
      if (design.hoverMotion !== undefined && typeof design.hoverMotion !== 'boolean') throw new Error('Estado de hover inválido');
      var motion = design.hoverMotion === false ? 'transform: none !important; box-shadow: none !important; transition: none !important;' : design.hoverMotion === true ? 'transform: translate(-2px, -2px) !important; box-shadow: 2px 2px 0 #000 !important;' : '';
      var motionRule = motion ? 'html body ' + selector + ':hover, html body.tf-force-hover ' + selector + ' { ' + motion + ' }' : '';
      var stateRules = ['rest','hover','active'].map(function (state) {
        var values = designs[selector][state] || {};
        var declarations = Object.keys(values).map(function (prop) {
          var value = String(values[prop]);
          if (props.indexOf(prop) < 0 || /[{};<>]|url\s*\(|@/i.test(value)) throw new Error('Propriedade de design inválida');
          return prop + ': ' + value + ' !important;';
        }).join(' ');
        var targets = state === 'rest' ? 'html body ' + selector : 'html body ' + selector + ':' + state + ', html body.tf-force-' + state + ' ' + selector;
        var textAlign = values['text-align'];
        var flexAlign = {left:'flex-start', center:'center', right:'flex-end'}[textAlign];
        var labelTargets = targets.split(', ').map(function (target) { return target + ' .btn-tile-label'; }).join(', ');
        var labelRules = '';
        if (textAlign || values['line-height']) {
          labelRules = labelTargets + ' { ' + (textAlign ? 'text-align: ' + textAlign + ' !important; ' : '') + (flexAlign ? 'align-items: ' + flexAlign + ' !important; ' : '') + (values['line-height'] ? 'line-height: ' + values['line-height'] + ' !important;' : '') + ' }';
        }
        var ownAlign = flexAlign ? targets.split(', ').map(function (target) {
          return target + '.btn-tile-label { align-items: ' + flexAlign + ' !important; }\n' + target + '.tf-toggle__face { justify-content: ' + flexAlign + ' !important; }';
        }).join('\n') : '';
        return declarations ? targets + ' { ' + declarations + ' }\n' + ownAlign + '\n' + labelRules : '';
      }).join('\n');
      return design.hoverMotion === false ? stateRules + '\n' + motionRule : motionRule + '\n' + stateRules;
    }).join('\n');
  }
  var api = { css: css, props: props };
  if (typeof module !== 'undefined') module.exports = api;
  else root.TFDesignModel = api;
})(typeof window !== 'undefined' ? window : this);
