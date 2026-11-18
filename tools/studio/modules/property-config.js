export const PROPERTY_GROUPS = [
  {
    id: 'grp-text',
    title: '🔤 Texto (Conteúdo, Tamanho e Espaçamento)',
    props: ['font-size', 'font-weight', 'line-height', 'letter-spacing', 'padding', 'text-align', 'text-transform']
  },
  {
    id: 'grp-button',
    title: '🎨 Seção do Botão (Cores, Borda, Sombra Diagonal & Tamanho)',
    props: ['border-width', 'border-radius', 'width', 'height']
  },
  {
    id: 'grp-effects',
    title: 'Efeitos',
    props: ['box-shadow', 'transform', 'opacity', 'outline']
  },
  {
    id: 'grp-advanced',
    title: 'Layout avançado',
    props: ['margin', 'gap', 'display', 'justify-content', 'align-items', 'flex-direction', 'flex-wrap', 'grid-template-columns', 'min-width', 'min-height', 'max-width', 'max-height', 'overflow']
  }
];
export const PROPERTY_SLIDERS = {
  'font-size': [6, 128, .5], 'font-weight': [100, 900, 100], 'line-height': [0, 160, .5],
  'letter-spacing': [-5, 30, .1], 'border-width': [0, 20, .25], 'border-radius': [0, 100, 1],
  'padding': [0, 160, 1], 'margin': [-100, 300, 1], 'gap': [0, 160, 1],
  'width': [0, 2500, 1], 'height': [0, 2500, 1], 'min-width': [0, 2500, 1],
  'min-height': [0, 2500, 1], 'max-width': [0, 2500, 1], 'max-height': [0, 2500, 1],
  'transform': [-100, 100, 1], 'opacity': [0, 1, .01],
  'outline': [0, 20, 1], 'grid-template-columns': [1, 12, 1]
};
export const PROPERTY_CHOICES = {
  'text-align': ['left', 'center', 'right', 'justify'],
  'text-transform': ['none', 'uppercase', 'lowercase', 'capitalize'],
  'display': ['block', 'inline', 'inline-block', 'flex', 'inline-flex', 'grid', 'none'],
  'justify-content': ['normal', 'flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly'],
  'align-items': ['normal', 'stretch', 'flex-start', 'center', 'flex-end', 'baseline'],
  'flex-direction': ['row', 'column', 'row-reverse', 'column-reverse'],
  'flex-wrap': ['nowrap', 'wrap', 'wrap-reverse'],
  'overflow': ['visible', 'hidden', 'auto', 'scroll']
};
export function sliderNumber(prop, raw, fallback) {
  var textValue = String(raw || '');
  var match = prop === 'grid-template-columns' ? textValue.match(/repeat\(\s*(\d+)/) :
    prop === 'transform' || prop === 'outline' ? textValue.match(/-?\d+(?:\.\d+)?px/) :
      textValue.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[1] || match[0].replace('px', '')) : fallback;
}
export function sliderCss(prop, number, raw) {
  if (prop === 'font-weight' || prop === 'opacity') return String(number);
  if (prop === 'grid-template-columns') return 'repeat(' + number + ', minmax(0, 1fr))';
  if (prop === 'transform') return number === 0 ? 'none' : 'translate(' + number + 'px, ' + number + 'px)';
  if (prop === 'outline') return number === 0 ? 'none' : number + 'px solid currentColor';
  return number + 'px';
}

export const PROPERTY_LABELS = {
  'border-width': 'Espessura + Cor da Borda',
  'border-radius': 'Arredondamento das bordas',
  'font-size': 'Tamanho do texto',
  'font-weight': 'Peso do texto',
  'line-height': 'Altura da linha',
  'letter-spacing': 'Tracking (Espaço entre letras)',
  'text-align': 'Alinhamento do texto',
  'text-transform': 'Caixa do texto',
  'padding': 'Espaço limite dentro do botão (X / Y)',
  'margin': 'Margem externa',
  'gap': 'Espaço entre elementos',
  'width': 'Largura do botão',
  'height': 'Altura do botão',
  'min-width': 'Largura mínima',
  'min-height': 'Altura mínima',
  'max-width': 'Largura máxima',
  'max-height': 'Altura máxima',
  'display': 'Exibição',
  'justify-content': 'Alinhamento horizontal',
  'align-items': 'Alinhamento vertical',
  'flex-direction': 'Direção flex',
  'flex-wrap': 'Quebra flex',
  'grid-template-columns': 'Colunas da grade',
  'overflow': 'Transbordamento',
  'box-shadow': 'Sombra (X Y desfoque cor)',
  'transform': 'Transformação',
  'opacity': 'Opacidade',
  'outline': 'Contorno'
};
