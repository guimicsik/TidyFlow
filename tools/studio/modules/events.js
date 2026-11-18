import { FACTORY_TOKENS, THEME_PRESETS } from './defaults.js';
import {
  frameEditor,
  frameCollect,
  frameOverlays,
  chkAutoSave,
  btnToggleEditMode,
  showToast,
  getFrames
} from './dom.js';
import { applyTokensToFrames, applyAllTokensToFrames, setToken, syncControlsFromTokens, bindShadowSlider } from './tokens.js';
import { setActivePanel } from './panels.js';
import { syncTextInputsFromDoc, applyTextToDoc } from './panel-text.js';
import { renderMagneticOrderList } from './ordering.js';
import { setupInteractivePreviewInDoc } from './preview.js';
import { toggleEditMode, initInspectorEvents } from './selection.js';
import { scheduleSaveToDisk, saveToDiskNow, fetchStateFromDisk } from './persistence.js';
import { studioState } from './state.js';

// ========================================================================
// INICIALIZAÇÃO DE EVENTOS
// ========================================================================
export function initEvents() {
  // 1. Abas da Sidebar (Texto, Botões, Animação, Geral, Ícones)
  var tabs = document.querySelectorAll(".st-tab");
  var panes = document.querySelectorAll(".st-pane");
  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      var target = tab.getAttribute("data-tab");
      tabs.forEach(function (t) { t.classList.remove("active"); });
      panes.forEach(function (p) { p.classList.remove("active"); });
      tab.classList.add("active");
      var pane = document.getElementById(target);
      if (pane) pane.classList.add("active");
    });
  });

  // 2. Comutador de Painel Ativo & Visualização
  var panelBtns = document.querySelectorAll("[data-panel-btn]");
  var wrapMain = document.getElementById("wrapMain");
  var wrapEditor = document.getElementById("wrapEditor");
  var wrapCollect = document.getElementById("wrapCollect");

  panelBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var mode = btn.getAttribute("data-panel-btn");
      studioState.currentViewMode = mode;
      if ((mode === 'all' || mode === 'overlays') && frameOverlays.contentWindow) frameOverlays.contentWindow.location.hash = '';

      if (mode === "all") {
        panelBtns.forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        if (wrapMain) wrapMain.style.display = "flex";
        if (wrapEditor) wrapEditor.style.display = "flex";
        if (wrapCollect) wrapCollect.style.display = "flex";
        var wrapOverlays = document.getElementById("wrapOverlays");
        if (wrapOverlays) wrapOverlays.style.display = "flex";
      } else {
        setActivePanel(mode);
      }
    });
  });

  // Clique direto na moldura para torná-la o painel ativo (no modo 'all')
  document.querySelectorAll(".st-window-wrap").forEach(function (w) {
    w.addEventListener("click", function () {
      var p = w.getAttribute("data-window");
      if (p && p !== studioState.currentActivePanel) {
        setActivePanel(p);
      }
    });
  });

  // 3. Simulador de Estado (Rest / Hover / Click)
  var statePills = document.querySelectorAll("[data-force-state]");
  statePills.forEach(function (pill) {
    pill.addEventListener("click", function () {
      studioState.forcedState = pill.getAttribute("data-force-state");
      statePills.forEach(function (p) { p.classList.remove("active"); });
      pill.classList.add("active");
      applyAllTokensToFrames();
    });
  });

  // 4. Botão Modo Editar & Arrastar Layout
  if (btnToggleEditMode) {
    btnToggleEditMode.addEventListener("click", function () {
      toggleEditMode();
    });
  }

  initInspectorEvents();

  var btnDrag = document.getElementById("btnToggleDragMode");
  var dragStatus = document.getElementById("dragModeStatus");
  var dragBanner = document.getElementById("dragBanner");
  if (btnDrag) {
    btnDrag.addEventListener("click", function () {
      studioState.isDragMode = !studioState.isDragMode;
      btnDrag.classList.toggle("active", studioState.isDragMode);
      if (dragStatus) dragStatus.textContent = studioState.isDragMode ? "ON" : "OFF";
      if (dragBanner) dragBanner.style.display = studioState.isDragMode ? "block" : "none";
      setupInteractivePreviewInDoc(studioState.currentActivePanel);
    });
  }

  // 5. Sliders, Color Pickers e Selects com [data-token]
  var tokenControls = document.querySelectorAll("[data-token]");
  tokenControls.forEach(function (ctrl) {
    var token = ctrl.getAttribute("data-token");
    var unit = ctrl.getAttribute("data-unit") || "";
    var evtName = ctrl.tagName === "SELECT" ? "change" : "input";
    ctrl.addEventListener(evtName, function () {
      var val = ctrl.type === "range" ? ctrl.value + unit : ctrl.value;
      setToken(token, val);
    });
  });

  // 6. Inputs Hexadecimal
  var hexInputs = document.querySelectorAll("[data-hex-for]");
  hexInputs.forEach(function (hexInp) {
    var token = hexInp.getAttribute("data-hex-for");
    hexInp.addEventListener("input", function () {
      var val = hexInp.value.trim();
      if (/^#[0-9a-fA-F]{6}$/.test(val)) {
        setToken(token, val.toUpperCase());
      }
    });
  });

  // 7. Seletor de Família de Fonte
  var selFont = document.getElementById("selFontFamily");
  if (selFont) {
    selFont.addEventListener("change", function () {
      setToken("--tf-font-family", selFont.value);
    });
  }

  // 8. Sliders Compostos de Sombra
  bindShadowSlider("rngRestShadowHero", "valRestShadowHero", "--tf-rest-shadow-hero");
  bindShadowSlider("rngRestShadowTile", "valRestShadowTile", "--tf-rest-shadow-tile");
  bindShadowSlider("rngHoverShadowHero", "valHoverShadowHero", "--tf-neo-shadow-hero");
  bindShadowSlider("rngHoverShadowTile", "valHoverShadowTile", "--tf-neo-shadow-tile");
  bindShadowSlider("rngActiveShadowHero", "valActiveShadowHero", "--tf-active-shadow-hero");
  bindShadowSlider("rngActiveShadowTile", "valActiveShadowTile", "--tf-active-shadow-tile");

  // 9. Presets de Rest (Flat vs 3D)
  var btnRestFlat = document.getElementById("btnPresetRestFlat");
  var btnRest3D = document.getElementById("btnPresetRest3D");
  if (btnRestFlat) {
    btnRestFlat.addEventListener("click", function () {
      setToken("--tf-rest-shadow-hero", "0px 0px 0px #000000", true);
      setToken("--tf-rest-shadow-tile", "0px 0px 0px #000000", false);
    });
  }
  if (btnRest3D) {
    btnRest3D.addEventListener("click", function () {
      setToken("--tf-rest-shadow-hero", "4px 4px 0px #000000", true);
      setToken("--tf-rest-shadow-tile", "3px 3px 0px #000000", false);
    });
  }

  // 10. Temas Rápidos
  var themeChips = document.querySelectorAll("[data-theme-preset]");
  themeChips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      var key = chip.getAttribute("data-theme-preset");
      var preset = THEME_PRESETS[key];
      if (!preset) return;
      Object.assign(studioState.currentTokens, preset);
      applyAllTokensToFrames();
      syncControlsFromTokens();
      if (chkAutoSave && chkAutoSave.checked) scheduleSaveToDisk(false);
      showToast("Tema '" + chip.textContent.trim() + "' aplicado!");
    });
  });

  // 11. Inputs de Texto Multi-Painel
  var textInputs = document.querySelectorAll("[data-text-target]");
  textInputs.forEach(function (inp) {
    var panel = inp.getAttribute("data-text-panel") || "main";
    var targetId = inp.getAttribute("data-text-target");
    inp.addEventListener("input", function () {
      applyTextToDoc(panel, targetId, inp.value, true);
    });
  });

  // 12. Gap entre Janelas (Modo Lado a Lado)
  var rngCanvasGap = document.getElementById("rngCanvasGap");
  var valCanvasGap = document.getElementById("valCanvasGap");
  var framesStage = document.getElementById("framesStage");
  if (rngCanvasGap && framesStage) {
    rngCanvasGap.addEventListener("input", function () {
      var px = rngCanvasGap.value + "px";
      framesStage.style.gap = px;
      if (valCanvasGap) valCanvasGap.textContent = px;
    });
  }

  // 13. Ações: Salvar, Copiar CSS, Restaurar Padrão
  var btnSaveDisk = document.getElementById("btnSaveDisk");
  if (btnSaveDisk) {
    btnSaveDisk.addEventListener("click", function () {
      saveToDiskNow(true);
    });
  }

  var btnCopyCss = document.getElementById("btnCopyCss");
  if (btnCopyCss) {
    btnCopyCss.addEventListener("click", function () {
      var lines = [":root {"];
      for (var k in studioState.currentTokens) {
        if (Object.prototype.hasOwnProperty.call(studioState.currentTokens, k)) {
          lines.push("  " + k + ": " + studioState.currentTokens[k] + ";");
        }
      }
      lines.push("}");
      navigator.clipboard.writeText(lines.join("\n")).then(function () {
        showToast("📋 Variáveis :root copiadas!");
      });
    });
  }

  var btnResetDefaults = document.getElementById("btnResetDefaults");
  if (btnResetDefaults) {
    btnResetDefaults.addEventListener("click", function () {
      if (!window.confirm("Deseja restaurar todas as cores, fontes, tamanhos e animações para o padrão de fábrica?")) {
        return;
      }
      studioState.currentTokens = Object.assign({}, FACTORY_TOKENS);
      applyAllTokensToFrames();
      syncControlsFromTokens();
      saveToDiskNow(false);
      showToast("↺ Visual padrão restaurado!");
    });
  }

  // 14. Eventos de Carga dos Iframes
  getFrames().forEach(function (frame) {
    let initializedDoc;
    function initializeFrame() {
      const doc = frame.contentDocument;
      if (!doc || doc.URL === 'about:blank' || doc === initializedDoc) return;
      initializedDoc = doc;
      applyTokensToFrames([frame]);
      var panelKey =
        frame === frameEditor
          ? "editor"
          : frame === frameCollect
            ? "collect"
            : frame === frameOverlays
              ? "overlays"
              : "main";
      syncTextInputsFromDoc(panelKey);
      setupInteractivePreviewInDoc(panelKey);
      if (panelKey === studioState.currentActivePanel) {
        renderMagneticOrderList();
      }
    }
    frame.addEventListener("load", initializeFrame);
    if (frame.contentDocument?.readyState === "complete") initializeFrame();
  });

  window.addEventListener("focus", function () {
    fetchStateFromDisk();
    syncTextInputsFromDoc(studioState.currentActivePanel);
  });
}
