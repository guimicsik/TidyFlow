import { PANEL_CONFIGS } from './catalog.js';
import { frameOverlays, showToast } from './dom.js';
import { setActivePanel } from './panels.js';
import { studioState } from './state.js';

// Inicialização
export function initCanvasTools() {
  var bar = document.createElement('div');
  bar.className = 'st-canvas-tools';
  bar.innerHTML = '<label>Tela <select id="canvasPanel"><option value="main">Principal</option><option value="editor">Preset Builder</option><option value="collect">Collect Files</option><option value="overlays">Avisos</option></select></label> <label>Largura <input id="canvasWidth" type="number" min="280" max="3840"></label> <label>Altura <input id="canvasHeight" type="number" min="240" max="2160"></label> <div class="st-canvas-zoom"><button type="button" id="canvasZoomOut" title="Reduzir zoom">−</button><label>Zoom <input id="canvasZoom" type="number" min="25" max="200" step="5" value="100">%</label><button type="button" id="canvasZoomIn" title="Ampliar zoom">+</button></div> <button type="button" id="canvasFit" class="st-btn" title="Enquadrar a janela ativa">Enquadrar</button> <button type="button" id="canvasCenter" class="st-btn" title="Centralizar a janela ativa">Centralizar</button> <button type="button" id="canvasPan" class="st-btn" title="Arrastar a área de trabalho">Mover</button> <button id="canvasApplyCep" class="st-btn">Aplicar tamanho ao CEP…</button> <span id="canvasSizeStatus">Dimensões de prévia</span>';
  document.querySelector('.st-canvas').prepend(bar);
  var panel = document.getElementById('canvasPanel');
  var width = document.getElementById('canvasWidth');
  var height = document.getElementById('canvasHeight');
  function body() { return document.getElementById(PANEL_CONFIGS[panel.value].wrapId).querySelector('.st-window-body'); }
  function sync() { width.value = Math.round(body().offsetWidth); height.value = Math.round(body().offsetHeight); }
  panel.onchange = function () {
    studioState.currentViewMode = 'single';
    if (panel.value === 'overlays' && frameOverlays.contentWindow) frameOverlays.contentWindow.location.hash = '';
    setActivePanel(panel.value);
    sync();
  };
  function resize() {
    var w = Number(width.value), h = Number(height.value);
    if (w < 280 || w > 3840 || h < 240 || h > 2160) return;
    body().style.width = w + 'px'; body().style.height = h + 'px';
    localStorage.setItem('tf-studio-size-' + panel.value, JSON.stringify([w, h]));
  }
  width.onchange = height.onchange = resize;
  var stage = document.getElementById('framesStage');
  var zoomInput = document.getElementById('canvasZoom');
  function setZoom(percent) {
    var next = Math.max(25, Math.min(200, Math.round(Number(percent) || 100)));
    zoomInput.value = next;
    stage.style.zoom = (next / 100).toString();
    localStorage.setItem('tf-studio-canvas-zoom', String(next));
  }
  window.studioAdjustZoom = function (delta) { setZoom(Number(zoomInput.value) + delta); };
  function centerCanvas() {
    var wrap = document.getElementById(PANEL_CONFIGS[panel.value].wrapId);
    if (wrap) wrap.scrollIntoView({ block: 'center', inline: 'center', behavior: 'auto' });
  }
  function fitCanvas() {
    var wrap = document.getElementById(PANEL_CONFIGS[panel.value].wrapId);
    if (!wrap) return;
    var overlayHash = panel.value === 'overlays' && frameOverlays.contentWindow ? frameOverlays.contentWindow.location.hash : '';
    if (/^#ov-[a-z-]+$/.test(overlayHash) && frameOverlays.contentDocument) {
      var activeCard = frameOverlays.contentDocument.querySelector(overlayHash + ' .modal-card, ' + overlayHash + ' .collect-modal-card');
      if (activeCard) {
        var previewBody = wrap.querySelector('.st-window-body');
        var targetWidth = Math.max(580, Math.ceil(activeCard.getBoundingClientRect().width + 100));
        var targetHeight = Math.max(480, Math.ceil(activeCard.getBoundingClientRect().height + 110));
        previewBody.style.width = targetWidth + 'px';
        previewBody.style.height = targetHeight + 'px';
        width.value = targetWidth;
        height.value = targetHeight;
      }
    }
    var viewport = stage.getBoundingClientRect();
    var fit = Math.min((viewport.width - 48) / wrap.offsetWidth, (viewport.height - 48) / wrap.offsetHeight);
    setZoom(Math.floor(fit * 100));
    centerCanvas();
  }
  window.studioFitCanvas = fitCanvas;
  zoomInput.onchange = function () { setZoom(this.value); };
  document.getElementById('canvasZoomOut').onclick = function () { setZoom(Number(zoomInput.value) - 10); };
  document.getElementById('canvasZoomIn').onclick = function () { setZoom(Number(zoomInput.value) + 10); };
  document.getElementById('canvasFit').onclick = fitCanvas;
  document.getElementById('canvasCenter').onclick = centerCanvas;
  var panButton = document.getElementById('canvasPan');
  var panMode = false;
  panButton.onclick = function () {
    panMode = !panMode;
    panButton.classList.toggle('active', panMode);
    stage.classList.toggle('st-canvas-pan-active', panMode);
  };
  var panStart = null;
  stage.addEventListener('pointerdown', function (ev) {
    if (!panMode) return;
    panStart = { x: ev.clientX, y: ev.clientY, left: stage.scrollLeft, top: stage.scrollTop };
    stage.setPointerCapture(ev.pointerId);
    ev.preventDefault();
  });
  stage.addEventListener('pointermove', function (ev) {
    if (!panStart) return;
    stage.scrollLeft = panStart.left - (ev.clientX - panStart.x);
    stage.scrollTop = panStart.top - (ev.clientY - panStart.y);
  });
  stage.addEventListener('pointerup', function () { panStart = null; });
  stage.addEventListener('pointercancel', function () { panStart = null; });
  stage.addEventListener('wheel', function (ev) {
    if (!ev.ctrlKey) return;
    ev.preventDefault();
    setZoom(Number(zoomInput.value) + (ev.deltaY < 0 ? 10 : -10));
  }, { passive: false });
  document.addEventListener('keydown', function (ev) {
    if (ev.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (ev.key === '+' || ev.key === '=') { setZoom(Number(zoomInput.value) + 10); ev.preventDefault(); }
    else if (ev.key === '-') { setZoom(Number(zoomInput.value) - 10); ev.preventDefault(); }
    else if (ev.key === '0') { fitCanvas(); ev.preventDefault(); }
    else if (ev.key === 'Escape' && panMode) { panButton.click(); ev.preventDefault(); }
  });
  var savedZoom = Number(localStorage.getItem('tf-studio-canvas-zoom'));
  if (savedZoom >= 25 && savedZoom <= 200) setZoom(savedZoom);
  document.getElementById('canvasApplyCep').onclick = function () {
    if (panel.value === 'overlays') { showToast('Avisos usa as dimensões da janela que os contém.'); return; }
    if (!confirm('Aplicar ' + width.value + ' × ' + height.value + ' ao manifesto CEP? Pode ser necessário reabrir a extensão ou reiniciar o aplicativo Adobe.')) return;
    fetch('/api/studio/window-size', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ panel: panel.value, width: Number(width.value), height: Number(height.value) }) })
      .then(function (r) { return r.json(); }).then(function (r) { showToast(r.ok ? 'Tamanho CEP salvo. Reabra a extensão para conferir.' : r.error); }).catch(function (e) { showToast(e.message); });
  };
  Object.keys(PANEL_CONFIGS).forEach(function (key) {
    var saved;
    try { saved = JSON.parse(localStorage.getItem('tf-studio-size-' + key)); } catch (e) { }
    if (saved && saved[0] >= 280 && saved[0] <= 3840 && saved[1] >= 240 && saved[1] <= 2160) {
      var b = document.getElementById(PANEL_CONFIGS[key].wrapId).querySelector('.st-window-body');
      b.style.width = saved[0] + 'px'; b.style.height = saved[1] + 'px';
    }
  });
  sync();
}
