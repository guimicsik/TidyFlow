import { PANEL_CONFIGS } from './catalog.js';
import { frameOverlays, lblActivePanelBadge, selIconTarget } from './dom.js';
import { syncTextInputsFromDoc } from './panel-text.js';
import { renderMagneticOrderList } from './ordering.js';
import { setupInteractivePreviewInDoc } from './preview.js';
import { studioState } from './state.js';

// ========================================================================
// COMUTAÇÃO DINÂMICA DE PAINEL ATIVO
// ========================================================================
export function setActivePanel(panelKey) {
  if (!PANEL_CONFIGS[panelKey]) return;
  studioState.currentActivePanel = panelKey;
  var galleryScreen = panelKey === 'overlays' && frameOverlays.contentWindow
    ? frameOverlays.contentWindow.location.hash.slice(1) : panelKey;
  document.querySelectorAll('.st-gallery-card').forEach(function (card) {
    card.classList.toggle('active', card.getAttribute('data-gallery-screen') === galleryScreen);
  });
  var canvasPanel = document.getElementById('canvasPanel');
  if (canvasPanel) {
    canvasPanel.value = panelKey;
    var previewBody = document.getElementById(PANEL_CONFIGS[panelKey].wrapId).querySelector('.st-window-body');
    document.getElementById('canvasWidth').value = parseInt(previewBody.style.width, 10);
    document.getElementById('canvasHeight').value = parseInt(previewBody.style.height, 10);
  }

  // Atualiza pills da barra superior
  var panelBtns = document.querySelectorAll("[data-panel-btn]");
  panelBtns.forEach(function (btn) {
    var key = btn.getAttribute("data-panel-btn");
    btn.classList.toggle("active", key === (studioState.currentViewMode === "all" ? "all" : panelKey));
  });

  // Atualiza badge na sidebar
  if (lblActivePanelBadge) {
    lblActivePanelBadge.textContent = PANEL_CONFIGS[panelKey].badgeText;
  }

  // Mostra/oculta molduras no canvas (quando não estiver em 'all')
  if (studioState.currentViewMode !== "all") {
    var wrapMain = document.getElementById("wrapMain");
    var wrapEditor = document.getElementById("wrapEditor");
    var wrapCollect = document.getElementById("wrapCollect");
    var wrapOverlays = document.getElementById("wrapOverlays");
    if (wrapMain) wrapMain.style.display = panelKey === "main" ? "flex" : "none";
    if (wrapEditor) wrapEditor.style.display = panelKey === "editor" ? "flex" : "none";
    if (wrapCollect) wrapCollect.style.display = panelKey === "collect" ? "flex" : "none";
    if (wrapOverlays) wrapOverlays.style.display = panelKey === "overlays" ? "flex" : "none";
  }

  // Marca borda ativa na moldura
  document.querySelectorAll(".st-window-wrap").forEach(function (w) {
    w.classList.toggle("active", w.getAttribute("data-window") === panelKey);
  });

  // Filtra cards de controles da sidebar por painel
  var panelCards = document.querySelectorAll("[data-panel-card]");
  panelCards.forEach(function (card) {
    var target = card.getAttribute("data-panel-card");
    card.style.display = target === panelKey ? "flex" : "none";
  });

  // Atualiza opções do select de Ícones
  populateIconTargetSelect();

  // Atualiza lista da Grade Magnética
  renderMagneticOrderList();

  // Sincroniza textos daquele painel
  syncTextInputsFromDoc(panelKey);

  // Conecta eventos de duplo clique e drag no iframe daquele painel
  setupInteractivePreviewInDoc(panelKey);
}

function populateIconTargetSelect() {
  if (!selIconTarget) return;
  selIconTarget.innerHTML = "";
  var cfg = PANEL_CONFIGS[studioState.currentActivePanel];
  if (!cfg || !cfg.iconTargets) return;

  cfg.iconTargets.forEach(function (t) {
    var opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.label;
    selIconTarget.appendChild(opt);
  });
}
