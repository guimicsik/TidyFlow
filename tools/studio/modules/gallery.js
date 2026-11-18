import { frameOverlays } from './dom.js';
import { applyTokensToFrames } from './tokens.js';
import { setActivePanel } from './panels.js';
import { closeInspector } from './selection.js';
import { studioState } from './state.js';

export function initScreenGallery() {
  var list = document.getElementById('screenGalleryList');
  if (!list) return;
  var screens = [
    { group: 'JANELAS', id: 'main', panel: 'main', name: 'Painel Principal', source: 'index.html', url: '/index.html?preview=1', width: 360, height: 440, scale: .38 },
    { id: 'editor', panel: 'editor', name: 'Preset Builder', source: 'tree_editor.html', url: '/tree_editor.html?preview=1', width: 740, height: 640, scale: .23 },
    { id: 'collect', panel: 'collect', name: 'Collect Files', source: 'collect.html', url: '/collect.html?preview=1', width: 560, height: 700, scale: .30 },
    { group: 'AVISOS E MODAIS', id: 'ov-rules', panel: 'overlays', name: 'Regras e filtros', source: 'Preset Builder' },
    { id: 'ov-rollback', panel: 'overlays', name: 'Confirmar rollback', source: 'Painel Principal' },
    { id: 'ov-del-folder', panel: 'overlays', name: 'Remover pasta', source: 'Preset Builder' },
    { id: 'ov-save-as', panel: 'overlays', name: 'Salvar novo preset', source: 'Preset Builder' },
    { id: 'ov-unsaved', panel: 'overlays', name: 'Alterações não salvas', source: 'Preset Builder' },
    { id: 'ov-reduce', panel: 'overlays', name: 'Confirmação de redução', source: 'Reserva para uso futuro' },
    { id: 'ov-comments', panel: 'overlays', name: 'Comentários', source: 'Collect Files' }
  ];
  screens.forEach(function (screen) {
    if (screen.group) {
      var group = document.createElement('div');
      group.className = 'st-gallery-group';
      group.textContent = screen.group;
      list.appendChild(group);
    }
    var card = document.createElement('button');
    card.type = 'button';
    card.className = 'st-gallery-card';
    card.setAttribute('data-gallery-panel', screen.panel);
    card.setAttribute('data-gallery-screen', screen.id);
    card.setAttribute('aria-label', 'Editar ' + screen.name);
    var thumb = document.createElement('span');
    thumb.className = 'st-gallery-thumb';
    var preview = document.createElement('iframe');
    preview.className = 'st-gallery-frame';
    preview.title = 'Miniatura: ' + screen.name;
    preview.tabIndex = -1;
    preview.loading = 'lazy';
    preview.src = screen.url || '/overlays.html?preview=1#' + screen.id;
    preview.style.setProperty('--gallery-width', (screen.width || 680) + 'px');
    preview.style.setProperty('--gallery-height', (screen.height || 520) + 'px');
    preview.style.setProperty('--gallery-scale', screen.scale || .25);
    preview.addEventListener('load', () => applyTokensToFrames([preview]));
    thumb.appendChild(preview);
    var title = document.createElement('span');
    title.className = 'st-gallery-title';
    title.textContent = screen.name;
    var source = document.createElement('span');
    source.className = 'st-gallery-source';
    source.textContent = screen.source;
    card.appendChild(thumb);
    card.appendChild(title);
    card.appendChild(source);
    card.addEventListener('click', function () {
      studioState.currentViewMode = 'single';
      setActivePanel(screen.panel);
      if (screen.panel === 'overlays' && frameOverlays.contentWindow) frameOverlays.contentWindow.location.hash = screen.id;
      document.querySelectorAll('.st-gallery-card').forEach(function (item) { item.classList.toggle('active', item === card); });
      closeInspector();
      if (window.studioFitCanvas) window.studioFitCanvas();
    });
    list.appendChild(card);
  });
}
