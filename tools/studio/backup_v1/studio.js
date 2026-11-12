/* ==========================================================================
   TidyFlow Design Studio — Motor Interativo Multi-Painel (tools/studio/studio.js)
   Sincronização bidirecional em tempo real com:
   - client/theme/tokens.css (:root)
   - client/index.html (Painel Principal)
   - client/tree_editor.html (Preset Builder)
   - client/collect.html (Collect Files)
   ========================================================================== */

(function () {
  "use strict";

  var GOOGLE_FONTS_HREF =
    "https://fonts.googleapis.com/css2?family=Archivo:ital,wght@0,100..900;1,100..900&family=Inter:wght@400;600;700;800;900&family=JetBrains+Mono:wght@400;600;700;800&family=Plus+Jakarta+Sans:wght@500;700;800&family=Rubik:wght@400;600;700;800;900&family=Space+Grotesk:wght@500;700&family=Syne:wght@700;800&display=swap";

  // Estado Padrão de Fábrica
  var FACTORY_TOKENS = {
    "--tf-font-family": '"Archivo", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    "--tf-font-weight-bold": "800",
    "--tf-font-weight-medium": "600",
    "--tf-font-weight-hero": "900",
    "--tf-font-weight-tile": "800",
    "--tf-font-weight-toggle": "600",
    "--tf-font-weight-rollback": "800",
    "--tf-font-size-hero": "32px",
    "--tf-font-size-tile": "14px",
    "--tf-font-size-toggle": "11px",
    "--tf-font-size-rollback": "11.5px",
    "--tf-font-size-preset-label": "10px",
    "--tf-font-size-preset-select": "13px",
    "--tf-font-size-modal-btn": "12px",
    "--tf-hero-letter-spacing": "-0.5px",
    "--tf-tile-letter-spacing": "0px",
    "--tf-toggle-letter-spacing": "0px",
    "--tf-tile-line-height": "1.25",
    "--tf-hero-text-transform": "none",
    "--tf-tile-text-transform": "none",
    "--tf-toggle-text-transform": "none",
    "--tf-font-style-hero": "normal",
    "--tf-font-style-tile": "normal",
    "--tf-bg-app": "#171717",
    "--tf-text-app": "#d4d4d4",
    "--tf-notice-color": "#9a9a9a",
    "--tf-neo-hero-bg": "#3B82F6",
    "--tf-neo-hero-text": "#FFFFFF",
    "--tf-neo-hero-hover": "#60A5FA",
    "--tf-neo-hero-active": "#2563EB",
    "--tf-neo-tile-bg": "#E4E4E7",
    "--tf-neo-tile-text": "#000000",
    "--tf-neo-tile-hover": "#F4F4F5",
    "--tf-neo-tile-active": "#D4D4D8",
    "--tf-neo-danger-bg": "#EF4444",
    "--tf-neo-danger-text": "#000000",
    "--tf-neo-danger-hover": "#F87171",
    "--tf-neo-danger-active": "#DC2626",
    "--tf-neo-primary-bg": "#3B82F6",
    "--tf-neo-primary-text": "#FFFFFF",
    "--tf-neo-primary-hover": "#60A5FA",
    "--tf-neo-toggle-off-bg": "#262626",
    "--tf-neo-toggle-off-text": "#F4F4F5",
    "--tf-neo-toggle-off-hover": "#323238",
    "--tf-neo-toggle-on-bg": "#3B82F6",
    "--tf-neo-toggle-on-text": "#FFFFFF",
    "--tf-neo-toggle-on-hover": "#60A5FA",
    "--tf-neo-ghost-bg": "#262626",
    "--tf-neo-ghost-text": "#E4E4E7",
    "--tf-neo-ghost-hover": "#60A5FA",
    "--tf-preset-bar-bg": "#212121",
    "--tf-preset-dropdown-width-editor": "180px",
    "--tf-preset-dropdown-width-panel": "100%",
    "--tf-preset-dropdown-height": "28px",
    "--tf-neo-border-color": "#000000",
    "--tf-neo-border-w": "2px",
    "--tf-neo-radius": "6px",
    "--tf-neo-radius-sm": "4px",
    "--tf-rest-lift-hero": "0px",
    "--tf-rest-shadow-hero": "0px 0px 0px #000000",
    "--tf-rest-lift-tile": "0px",
    "--tf-rest-shadow-tile": "0px 0px 0px #000000",
    "--tf-neo-shadow-hero": "4px 4px 0px #000000",
    "--tf-neo-shadow-tile": "3px 3px 0px #000000",
    "--tf-neo-lift-hero": "-4px",
    "--tf-neo-lift-tile": "-3px",
    "--tf-active-lift-hero": "0px",
    "--tf-active-shadow-hero": "0px 0px 0px #000000",
    "--tf-active-lift-tile": "0px",
    "--tf-active-shadow-tile": "0px 0px 0px #000000",
    "--tf-anim-duration": "0.12s",
    "--tf-anim-easing": "cubic-bezier(0.2, 0, 0, 1)",
    "--tf-panel-padding": "14px",
    "--tf-section-gap": "11px",
    "--tf-field-group-gap": "6px",
    "--tf-grid-gap": "8px",
    "--tf-toggles-gap": "8px",
    "--tf-options-gap": "8px",
    "--tf-hero-height": "98px",
    "--tf-tile-height": "68px",
    "--tf-toggle-height": "68px",
    "--tf-rollback-height": "68px",
    "--tf-rollback-justify": "flex-end",
    "--tf-rollback-width": "calc((100% - 16px) / 3)",
    "--tf-toggle-check-display": "none",
    "--tf-checkbox-size": "18px",
    "--tf-checkbox-radius": "4px",
    "--tf-icon-size": "14px",
    "--tf-editor-bg": "#1e1e1e",
    "--tf-editor-topbar-bg": "#252525",
    "--tf-editor-tree-bg": "#181818",
    "--tf-editor-row-bg": "#232323",
    "--tf-editor-row-border": "#303030",
    "--tf-editor-footer-bg": "#252525",
    "--tf-editor-padding": "10px",
    "--tf-collect-bg": "#202020",
    "--tf-collect-box-bg": "#242424",
    "--tf-collect-box-border": "#363636",
    "--tf-collect-btn-ok-bg": "#3B82F6",
    "--tf-collect-btn-ok-hover": "#60A5FA",
    "--tf-collect-btn-ok-text": "#FFFFFF",
    "--tf-collect-btn-cancel-bg": "transparent",
    "--tf-collect-btn-cancel-border": "#555555",
    "--tf-collect-btn-cancel-text": "#d4d4d4"
  };

  // Temas Rápidos
  var THEME_PRESETS = {
    default: {
      "--tf-neo-hero-bg": "#3B82F6",
      "--tf-neo-hero-hover": "#60A5FA",
      "--tf-neo-hero-active": "#2563EB",
      "--tf-neo-hero-text": "#FFFFFF",
      "--tf-neo-tile-bg": "#E4E4E7",
      "--tf-neo-tile-hover": "#F4F4F5",
      "--tf-neo-tile-active": "#D4D4D8",
      "--tf-neo-tile-text": "#000000",
      "--tf-neo-primary-bg": "#3B82F6",
      "--tf-neo-primary-hover": "#60A5FA",
      "--tf-neo-primary-text": "#FFFFFF",
      "--tf-neo-toggle-on-bg": "#3B82F6",
      "--tf-neo-toggle-on-hover": "#60A5FA",
      "--tf-neo-toggle-on-text": "#FFFFFF",
      "--tf-collect-btn-ok-bg": "#3B82F6",
      "--tf-collect-btn-ok-hover": "#60A5FA",
      "--tf-bg-app": "#171717"
    },
    lime: {
      "--tf-neo-hero-bg": "#A3E635",
      "--tf-neo-hero-hover": "#BEF264",
      "--tf-neo-hero-active": "#84CC16",
      "--tf-neo-hero-text": "#000000",
      "--tf-neo-tile-bg": "#27272A",
      "--tf-neo-tile-hover": "#3F3F46",
      "--tf-neo-tile-active": "#18181B",
      "--tf-neo-tile-text": "#F4F4F5",
      "--tf-neo-primary-bg": "#A3E635",
      "--tf-neo-primary-hover": "#BEF264",
      "--tf-neo-primary-text": "#000000",
      "--tf-neo-toggle-on-bg": "#A3E635",
      "--tf-neo-toggle-on-hover": "#BEF264",
      "--tf-neo-toggle-on-text": "#000000",
      "--tf-collect-btn-ok-bg": "#A3E635",
      "--tf-collect-btn-ok-hover": "#BEF264",
      "--tf-collect-btn-ok-text": "#000000",
      "--tf-bg-app": "#121214"
    },
    amber: {
      "--tf-neo-hero-bg": "#F59E0B",
      "--tf-neo-hero-hover": "#FBBF24",
      "--tf-neo-hero-active": "#D97706",
      "--tf-neo-hero-text": "#000000",
      "--tf-neo-tile-bg": "#FEF3C7",
      "--tf-neo-tile-hover": "#FFFBEB",
      "--tf-neo-tile-active": "#FDE68A",
      "--tf-neo-tile-text": "#000000",
      "--tf-neo-primary-bg": "#F59E0B",
      "--tf-neo-primary-hover": "#FBBF24",
      "--tf-neo-primary-text": "#000000",
      "--tf-neo-toggle-on-bg": "#F59E0B",
      "--tf-neo-toggle-on-hover": "#FBBF24",
      "--tf-neo-toggle-on-text": "#000000",
      "--tf-collect-btn-ok-bg": "#F59E0B",
      "--tf-collect-btn-ok-hover": "#FBBF24",
      "--tf-collect-btn-ok-text": "#000000",
      "--tf-bg-app": "#181614"
    },
    violet: {
      "--tf-neo-hero-bg": "#8B5CF6",
      "--tf-neo-hero-hover": "#A78BFA",
      "--tf-neo-hero-active": "#7C3AED",
      "--tf-neo-hero-text": "#FFFFFF",
      "--tf-neo-tile-bg": "#EDE9FE",
      "--tf-neo-tile-hover": "#F5F3FF",
      "--tf-neo-tile-active": "#DDD6FE",
      "--tf-neo-tile-text": "#000000",
      "--tf-neo-primary-bg": "#8B5CF6",
      "--tf-neo-primary-hover": "#A78BFA",
      "--tf-neo-primary-text": "#FFFFFF",
      "--tf-neo-toggle-on-bg": "#8B5CF6",
      "--tf-neo-toggle-on-hover": "#A78BFA",
      "--tf-neo-toggle-on-text": "#FFFFFF",
      "--tf-collect-btn-ok-bg": "#8B5CF6",
      "--tf-collect-btn-ok-hover": "#A78BFA",
      "--tf-bg-app": "#15131C"
    },
    crimson: {
      "--tf-neo-hero-bg": "#F43F5E",
      "--tf-neo-hero-hover": "#FB7185",
      "--tf-neo-hero-active": "#E11D48",
      "--tf-neo-hero-text": "#FFFFFF",
      "--tf-neo-tile-bg": "#E4E4E7",
      "--tf-neo-tile-hover": "#F4F4F5",
      "--tf-neo-tile-active": "#D4D4D8",
      "--tf-neo-tile-text": "#000000",
      "--tf-neo-primary-bg": "#F43F5E",
      "--tf-neo-primary-hover": "#FB7185",
      "--tf-neo-primary-text": "#FFFFFF",
      "--tf-neo-toggle-on-bg": "#F43F5E",
      "--tf-neo-toggle-on-hover": "#FB7185",
      "--tf-neo-toggle-on-text": "#FFFFFF",
      "--tf-collect-btn-ok-bg": "#F43F5E",
      "--tf-collect-btn-ok-hover": "#FB7185",
      "--tf-bg-app": "#171415"
    },
    mono: {
      "--tf-neo-hero-bg": "#FFFFFF",
      "--tf-neo-hero-hover": "#E4E4E7",
      "--tf-neo-hero-active": "#D4D4D8",
      "--tf-neo-hero-text": "#000000",
      "--tf-neo-tile-bg": "#27272A",
      "--tf-neo-tile-hover": "#3F3F46",
      "--tf-neo-tile-active": "#18181B",
      "--tf-neo-tile-text": "#FFFFFF",
      "--tf-neo-primary-bg": "#FFFFFF",
      "--tf-neo-primary-hover": "#E4E4E7",
      "--tf-neo-primary-text": "#000000",
      "--tf-neo-toggle-on-bg": "#FFFFFF",
      "--tf-neo-toggle-on-hover": "#E4E4E7",
      "--tf-neo-toggle-on-text": "#000000",
      "--tf-collect-btn-ok-bg": "#FFFFFF",
      "--tf-collect-btn-ok-hover": "#E4E4E7",
      "--tf-collect-btn-ok-text": "#000000",
      "--tf-bg-app": "#121212"
    }
  };

  // Catálogo de Ícones
  var ICON_CATALOG = [
    { id: "none", name: "Sem Ícone", svg: "" },
    { id: "gear", name: "Engrenagem", svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>' },
    { id: "bolt", name: "Raio / Ação", svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>' },
    { id: "sparkles", name: "Auto / Mágica", svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3L12 3z"/></svg>' },
    { id: "folder", name: "Pasta", svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>' },
    { id: "folder-plus", name: "Criar Pasta", svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>' },
    { id: "film", name: "Mídias / Filme", svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></svg>' },
    { id: "box", name: "Collect / Box", svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>' },
    { id: "undo", name: "Rollback / Undo", svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>' },
    { id: "layers", name: "Camadas", svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>' },
    { id: "tree", name: "Estrutura", svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><path d="M6.5 10v7.5H14"/></svg>' },
    { id: "play", name: "Executar", svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>' },
    { id: "check", name: "Check", svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' },
    { id: "archive", name: "Arquivo / Pacote", svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>' },
    { id: "sliders", name: "Ajustes", svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/></svg>' },
    { id: "star", name: "Destaque", svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>' }
  ];

  // Configuração Multi-Painel
  var PANEL_CONFIGS = {
    main: {
      name: "Painel Principal",
      fileName: "index.html",
      badgeText: "Painel Principal (index.html)",
      frameId: "frameMain",
      wrapId: "wrapMain",
      iconTargets: [
        { id: "btnOrganize", label: 'Botão Hero ("Organizar Projeto")' },
        { id: "btnCreateStructure", label: 'Tile 1 ("Criar estrutura de pastas")' },
        { id: "btnMediaOnly", label: 'Tile 2 ("Organizar Mídias")' },
        { id: "btnOpenCollect", label: 'Tile 3 ("Collect Files")' },
        { id: "btnRollback", label: 'Botão Rollback ("Desorganizar")' },
        { id: "btnOpenPresetBuilder", label: 'Botão "Editar" (Barra de Preset)' }
      ]
    },
    editor: {
      name: "Preset Builder",
      fileName: "tree_editor.html",
      badgeText: "Preset Builder (tree_editor.html)",
      frameId: "frameEditor",
      wrapId: "wrapEditor",
      iconTargets: [
        { id: "btnAddTopFolder", label: 'Botão "+ Add pasta"' },
        { id: "btnFooterSave", label: 'Botão "Salvar" (Rodapé)' },
        { id: "btnCloseModal", label: 'Botão "Fechar" (Rodapé)' },
        { id: "btnSaveAsPreset", label: 'Ícone: Salvar Como Preset' },
        { id: "btnResetDefault", label: 'Ícone: Restaurar Padrão' },
        { id: "btnDeletePreset", label: 'Ícone: Excluir Preset' },
        { id: "btnImportJson", label: 'Ícone: Importar JSON' },
        { id: "btnExportJson", label: 'Ícone: Exportar JSON' },
        { id: "btnOpenPresetsFolder", label: 'Ícone: Abrir Pasta Presets' }
      ]
    },
    collect: {
      name: "Collect Files",
      fileName: "collect.html",
      badgeText: "Collect Files (collect.html)",
      frameId: "frameCollect",
      wrapId: "wrapCollect",
      iconTargets: [
        { id: "btnCollect", label: 'Botão "OK"' },
        { id: "btnCancel", label: 'Botão "Cancelar"' },
        { id: "btnComments", label: 'Botão "Comentários..."' },
        { id: "btnBrowseDest", label: 'Botão "Procurar..."' },
        { id: "btnCalculate", label: 'Botão "Calcular"' }
      ]
    }
  };

  var currentActivePanel = "main";
  var currentViewMode = "main";
  var currentTokens = Object.assign({}, FACTORY_TOKENS);
  var isDragMode = false;
  var forcedState = "normal";
  var saveTimer = null;
  var isSaving = false;

  var frameMain = document.getElementById("frameMain");
  var frameEditor = document.getElementById("frameEditor");
  var frameCollect = document.getElementById("frameCollect");
  var chkAutoSave = document.getElementById("chkAutoSave");
  var toastFeedback = document.getElementById("toastFeedback");
  var lblActivePanelBadge = document.getElementById("lblActivePanelBadge");
  var selIconTarget = document.getElementById("selIconTarget");
  var magneticOrderContainer = document.getElementById("magneticOrderContainer");

  function showToast(msg) {
    if (!toastFeedback) return;
    toastFeedback.textContent = msg;
    setTimeout(function () {
      if (toastFeedback.textContent === msg) {
        toastFeedback.textContent = "";
      }
    }, 2600);
  }

  function getFrames() {
    return [frameMain, frameEditor, frameCollect].filter(Boolean);
  }

  function getActiveDoc() {
    var frame =
      currentActivePanel === "editor"
        ? frameEditor
        : currentActivePanel === "collect"
        ? frameCollect
        : frameMain;
    try {
      return frame && frame.contentDocument;
    } catch (e) {
      return null;
    }
  }

  function ensureFontsInDoc(doc) {
    if (!doc || !doc.head) return;
    if (!doc.getElementById("studio-google-fonts")) {
      var link = doc.createElement("link");
      link.id = "studio-google-fonts";
      link.rel = "stylesheet";
      link.href = GOOGLE_FONTS_HREF;
      doc.head.appendChild(link);
    }
  }

  function applyAllTokensToFrames() {
    var frames = getFrames();
    for (var i = 0; i < frames.length; i++) {
      try {
        var doc = frames[i].contentDocument;
        if (!doc || !doc.documentElement) continue;
        ensureFontsInDoc(doc);
        var rootStyle = doc.documentElement.style;
        for (var k in currentTokens) {
          if (Object.prototype.hasOwnProperty.call(currentTokens, k)) {
            rootStyle.setProperty(k, currentTokens[k]);
          }
        }
        applyForcedStateToDoc(doc);
      } catch (e) { }
    }
  }

  function setToken(token, value, skipSave) {
    currentTokens[token] = value;
    applyAllTokensToFrames();
    syncControlsFromTokens();
    if (!skipSave && chkAutoSave && chkAutoSave.checked) {
      scheduleSaveToDisk(false);
    }
  }

  function parsePxNumber(str, fallback) {
    if (!str) return fallback;
    var m = String(str).match(/(-?\d+(?:\.\d+)?)/);
    return m ? parseFloat(m[1]) : fallback;
  }

  function normalizeHex(colorStr) {
    if (!colorStr) return "#000000";
    var s = String(colorStr).trim();
    if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toUpperCase();
    if (/^#[0-9a-fA-F]{3}$/.test(s)) {
      return (
        "#" +
        s[1] + s[1] +
        s[2] + s[2] +
        s[3] + s[3]
      ).toUpperCase();
    }
    return "#000000";
  }

  function syncControlsFromTokens() {
    var inputs = document.querySelectorAll("[data-token]");
    for (var i = 0; i < inputs.length; i++) {
      var el = inputs[i];
      var token = el.getAttribute("data-token");
      var rawVal = currentTokens[token];
      if (rawVal === undefined) continue;

      if (el.type === "range") {
        el.value = parsePxNumber(rawVal, 0);
        var valBadge = document.querySelector('[data-val-for="' + token + '"]');
        if (valBadge) valBadge.textContent = rawVal;
      } else if (el.type === "color") {
        var hex = normalizeHex(rawVal);
        el.value = hex;
        var hexInput = document.querySelector('[data-hex-for="' + token + '"]');
        if (hexInput && document.activeElement !== hexInput) {
          hexInput.value = hex;
        }
      } else if (el.tagName === "SELECT") {
        el.value = rawVal;
      }
    }

    var selFont = document.getElementById("selFontFamily");
    if (selFont && currentTokens["--tf-font-family"]) {
      var ff = currentTokens["--tf-font-family"];
      for (var f = 0; f < selFont.options.length; f++) {
        var optFontName = selFont.options[f].value.split(",")[0].replace(/['"]/g, "").trim();
        if (ff.indexOf(optFontName) !== -1) {
          selFont.selectedIndex = f;
          break;
        }
      }
    }

    syncShadowSlider("rngRestShadowHero", "valRestShadowHero", "--tf-rest-shadow-hero");
    syncShadowSlider("rngRestShadowTile", "valRestShadowTile", "--tf-rest-shadow-tile");
    syncShadowSlider("rngHoverShadowHero", "valHoverShadowHero", "--tf-neo-shadow-hero");
    syncShadowSlider("rngHoverShadowTile", "valHoverShadowTile", "--tf-neo-shadow-tile");
    syncShadowSlider("rngActiveShadowHero", "valActiveShadowHero", "--tf-active-shadow-hero");
    syncShadowSlider("rngActiveShadowTile", "valActiveShadowTile", "--tf-active-shadow-tile");
  }

  function syncShadowSlider(sliderId, badgeId, tokenName) {
    var slider = document.getElementById(sliderId);
    var badge = document.getElementById(badgeId);
    if (!slider || !currentTokens[tokenName]) return;
    var px = parsePxNumber(currentTokens[tokenName], 0);
    slider.value = px;
    if (badge) badge.textContent = px + "px";
  }

  function bindShadowSlider(sliderId, badgeId, tokenName) {
    var slider = document.getElementById(sliderId);
    var badge = document.getElementById(badgeId);
    if (!slider) return;
    slider.addEventListener("input", function () {
      var px = parseInt(slider.value, 10) || 0;
      if (badge) badge.textContent = px + "px";
      var borderCol = currentTokens["--tf-neo-border-color"] || "#000000";
      setToken(tokenName, px + "px " + px + "px 0px " + borderCol);
    });
  }

  // ========================================================================
  // COMUTAÇÃO DINÂMICA DE PAINEL ATIVO
  // ========================================================================
  function setActivePanel(panelKey) {
    if (!PANEL_CONFIGS[panelKey]) return;
    currentActivePanel = panelKey;

    // Atualiza pills da barra superior
    var panelBtns = document.querySelectorAll("[data-panel-btn]");
    panelBtns.forEach(function (btn) {
      var key = btn.getAttribute("data-panel-btn");
      btn.classList.toggle("active", key === (currentViewMode === "all" ? "all" : panelKey));
    });

    // Atualiza badge na sidebar
    if (lblActivePanelBadge) {
      lblActivePanelBadge.textContent = PANEL_CONFIGS[panelKey].badgeText;
    }

    // Mostra/oculta molduras no canvas (quando não estiver em 'all')
    if (currentViewMode !== "all") {
      var wrapMain = document.getElementById("wrapMain");
      var wrapEditor = document.getElementById("wrapEditor");
      var wrapCollect = document.getElementById("wrapCollect");
      if (wrapMain) wrapMain.style.display = panelKey === "main" ? "flex" : "none";
      if (wrapEditor) wrapEditor.style.display = panelKey === "editor" ? "flex" : "none";
      if (wrapCollect) wrapCollect.style.display = panelKey === "collect" ? "flex" : "none";
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
    var cfg = PANEL_CONFIGS[currentActivePanel];
    if (!cfg || !cfg.iconTargets) return;

    cfg.iconTargets.forEach(function (t) {
      var opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = t.label;
      selIconTarget.appendChild(opt);
    });
  }

  // ========================================================================
  // LEITURA E APLICAÇÃO DE TEXTOS DINÂMICOS
  // ========================================================================
  function syncTextInputsFromDoc(panelKey) {
    var frame =
      panelKey === "editor"
        ? frameEditor
        : panelKey === "collect"
        ? frameCollect
        : frameMain;
    if (!frame) return;

    var doc;
    try { doc = frame.contentDocument; } catch (e) { return; }
    if (!doc) return;

    var inputs = document.querySelectorAll('[data-text-panel="' + panelKey + '"]');
    inputs.forEach(function (inp) {
      if (document.activeElement === inp) return;
      var targetId = inp.getAttribute("data-text-target");
      var el = doc.getElementById(targetId);
      if (!el) return;

      inp.value = extractReadableTextFromElement(el, targetId);
    });
  }

  function extractReadableTextFromElement(el, targetId) {
    if (targetId === "noticeText" || targetId === "treeToolbarTitle" || targetId === "editorStatus" || targetId === "lblTargetTitle") {
      return el.textContent.trim();
    }
    // Checkboxes / Toggles
    if (el.tagName === "INPUT" && el.type === "checkbox") {
      var parentLbl = el.closest(".tf-toggle, .toggle-container, .collect-check");
      if (parentLbl) {
        var face = parentLbl.querySelector(".tf-toggle__face, span:not(.toggle-slider)");
        if (face) {
          return face.innerHTML
            .replace(/<br\s*\/?>/gi, " | ")
            .replace(/<[^>]+>/g, "")
            .trim();
        }
      }
    }
    // Botões com labelBox
    var labelBox = el.querySelector(".btn-tile-label");
    if (labelBox) {
      var spans = labelBox.querySelectorAll("span");
      if (spans.length > 1) {
        var parts = [];
        for (var s = 0; s < spans.length; s++) {
          parts.push(spans[s].innerHTML.replace(/<br\s*\/?>/gi, " | ").replace(/<[^>]+>/g, "").trim());
        }
        return parts.join(" | ");
      }
      return labelBox.innerHTML.replace(/<br\s*\/?>/gi, " | ").replace(/<[^>]+>/g, "").trim();
    }
    return el.textContent.trim();
  }

  function applyTextToDoc(panelKey, targetId, rawValue, shouldSave) {
    var frame =
      panelKey === "editor"
        ? frameEditor
        : panelKey === "collect"
        ? frameCollect
        : frameMain;
    if (!frame) return;

    var doc;
    try { doc = frame.contentDocument; } catch (e) { return; }
    if (!doc) return;

    var el = doc.getElementById(targetId);
    if (!el) return;

    var lines = String(rawValue)
      .split("|")
      .map(function (s) { return s.trim(); })
      .filter(Boolean);
    if (lines.length === 0) lines = [""];

    if (
      targetId === "noticeText" ||
      targetId === "treeToolbarTitle" ||
      targetId === "editorStatus" ||
      targetId === "lblTargetTitle"
    ) {
      el.textContent = rawValue;
    } else if (el.tagName === "INPUT" && el.type === "checkbox") {
      var parentLbl = el.closest(".tf-toggle, .toggle-container, .collect-check");
      if (parentLbl) {
        var face = parentLbl.querySelector(".tf-toggle__face, span:not(.toggle-slider)");
        if (face) {
          face.innerHTML = lines.join("<br>");
        }
      }
    } else {
      var labelBox = el.querySelector(".btn-tile-label");
      if (labelBox) {
        if (targetId === "btnOrganize" && lines.length === 1) {
          labelBox.textContent = lines[0];
        } else if (targetId === "btnRollback") {
          labelBox.innerHTML = "<span>" + lines.join("<br>") + "</span>";
        } else {
          labelBox.innerHTML = lines.map(function (l) {
            return "<span>" + l + "</span>";
          }).join("");
        }
      } else {
        el.textContent = rawValue;
      }
    }

    renderMagneticOrderList();
    if (shouldSave && chkAutoSave && chkAutoSave.checked) {
      scheduleSaveToDisk(true);
    }
  }

  // ========================================================================
  // GRADE MAGNÉTICA DINÂMICA POR PAINEL
  // ========================================================================
  function renderMagneticOrderList() {
    if (!magneticOrderContainer) return;
    magneticOrderContainer.innerHTML = "";
    var doc = getActiveDoc();
    if (!doc) return;

    if (currentActivePanel === "main") {
      // 1. Tiles do Painel Principal
      renderOrderSection(
        doc.querySelector(".actions-grid-secondary"),
        "Botões Secundários (Tiles)",
        function (btn) { return extractReadableTextFromElement(btn, btn.id).replace(/\s*\|\s*/g, " "); }
      );
      // 2. Toggles do Topo
      renderOrderSection(
        doc.querySelector(".toggles-grid-top"),
        "Toggles de Preferências",
        function (lbl) {
          var chk = lbl.querySelector("input");
          return chk ? extractReadableTextFromElement(chk, chk.id).replace(/\s*\|\s*/g, " ") : "Toggle";
        }
      );
      // 3. Seções Principais
      renderOrderSection(
        doc.body,
        "Blocos Principais da Janela",
        function (sec) {
          if (sec.classList.contains("preset-bar")) return "Barra de Preset";
          if (sec.classList.contains("field-group")) return "Bloco de Botões (Hero + Tiles)";
          if (sec.classList.contains("options-group")) return "Bloco de Toggles + Rollback";
          return null;
        },
        true
      );
    } else if (currentActivePanel === "editor") {
      // 1. Ações da Topbar do Preset Builder
      renderOrderSection(
        doc.querySelector(".preset-actions"),
        "Ícones da Barra Superior",
        function (btn) { return btn.getAttribute("aria-label") || btn.title || btn.id; }
      );
      // 2. Toggles de Settings
      renderOrderSection(
        doc.querySelector(".settings-toggles"),
        "Toggles de Configurações da Árvore",
        function (lbl) {
          var sp = lbl.querySelector("span:last-child");
          return sp ? sp.textContent.trim() : "Opção";
        }
      );
      // 3. Ações do Rodapé
      renderOrderSection(
        doc.querySelector(".footer-actions"),
        "Ações do Rodapé (Salvar / Fechar)",
        function (btn) { return btn.textContent.trim(); }
      );
    } else if (currentActivePanel === "collect") {
      // 1. Caixas Principais do Collect Files
      renderOrderSection(
        doc.querySelector(".collect-dialog"),
        "Blocos Principais do Collect Files",
        function (box) {
          var leg = box.querySelector(".collect-legend");
          return leg ? leg.childNodes[0].textContent.trim() : (box.className || "Bloco");
        },
        true
      );
      // 2. Ações do Rodapé do Collect
      renderOrderSection(
        doc.querySelector(".collect-footer-actions"),
        "Botões do Rodapé (OK / Cancelar)",
        function (btn) { return btn.textContent.trim(); }
      );
    }
  }

  function renderOrderSection(container, title, labelFn, filterRelevant) {
    if (!container || !magneticOrderContainer) return;

    var children = Array.prototype.slice.call(container.children);
    if (filterRelevant) {
      children = children.filter(function (c) {
        return Boolean(labelFn(c));
      });
    }
    if (children.length === 0) return;

    var box = document.createElement("div");
    box.className = "st-order-section";
    box.style.marginBottom = "10px";
    box.innerHTML = '<span class="st-order-label">' + title + ':</span>';

    var list = document.createElement("div");
    list.className = "st-order-list";

    children.forEach(function (child, idx) {
      var itemLabel = labelFn(child) || ("Item " + (idx + 1));
      var row = document.createElement("div");
      row.className = "st-order-item";
      row.innerHTML =
        '<span>' + (idx + 1) + '. ' + itemLabel + '</span>' +
        '<div class="st-order-btns">' +
        '<button type="button" class="st-order-btn" title="Mover para esquerda/cima">▲</button>' +
        '<button type="button" class="st-order-btn" title="Mover para direita/baixo">▼</button>' +
        '</div>';
      var moveBtns = row.querySelectorAll(".st-order-btn");
      moveBtns[0].onclick = function () {
        if (idx > 0) {
          container.insertBefore(child, children[idx - 1]);
          renderMagneticOrderList();
          if (chkAutoSave && chkAutoSave.checked) scheduleSaveToDisk(true);
        }
      };
      moveBtns[1].onclick = function () {
        if (idx < children.length - 1) {
          container.insertBefore(children[idx + 1], child);
          renderMagneticOrderList();
          if (chkAutoSave && chkAutoSave.checked) scheduleSaveToDisk(true);
        }
      };
      list.appendChild(row);
    });

    box.appendChild(list);
    magneticOrderContainer.appendChild(box);
  }

  // ========================================================================
  // PREVIEW INTERATIVO: DUPLO-CLIQUE E DRAG-AND-DROP NO PAINEL ATIVO
  // ========================================================================
  function setupInteractivePreviewInDoc(panelKey) {
    var frame =
      panelKey === "editor"
        ? frameEditor
        : panelKey === "collect"
        ? frameCollect
        : frameMain;
    if (!frame) return;

    var doc;
    try { doc = frame.contentDocument; } catch (e) { return; }
    if (!doc || !doc.body) return;

    if (!doc.getElementById("studio-helper-style")) {
      var st = doc.createElement("style");
      st.id = "studio-helper-style";
      st.textContent =
        "body.st-drag-active [data-st-draggable='1'] { outline: 2px dashed #F59E0B !important; outline-offset: 2px; cursor: grab !important; }\n" +
        "body.st-drag-active [data-st-draggable='1']:active { cursor: grabbing !important; }\n" +
        ".st-drop-target { outline: 3px solid #10B981 !important; filter: brightness(1.15); }";
      doc.head.appendChild(st);
    }

    // Configura duplo clique nos botões e labels editáveis
    var editableInputs = document.querySelectorAll('[data-text-panel="' + panelKey + '"]');
    editableInputs.forEach(function (inp) {
      var targetId = inp.getAttribute("data-text-target");
      var el = doc.getElementById(targetId);
      if (!el || el._stDblBound) return;
      el._stDblBound = true;
      el.addEventListener("dblclick", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        var cur = extractReadableTextFromElement(el, targetId);
        var next = window.prompt("Editar texto (" + PANEL_CONFIGS[panelKey].name + "):", cur);
        if (next !== null) {
          applyTextToDoc(panelKey, targetId, next, true);
          syncTextInputsFromDoc(panelKey);
        }
      });
    });

    // Configura Drag-and-Drop nos containers
    var dragContainers = [];
    if (panelKey === "main") {
      dragContainers = [
        doc.querySelector(".actions-grid-secondary"),
        doc.querySelector(".toggles-grid-top"),
        doc.querySelector(".field-group"),
        doc.querySelector(".options-group")
      ];
    } else if (panelKey === "editor") {
      dragContainers = [
        doc.querySelector(".preset-actions"),
        doc.querySelector(".settings-toggles"),
        doc.querySelector(".footer-actions")
      ];
    } else if (panelKey === "collect") {
      dragContainers = [
        doc.querySelector(".collect-dialog"),
        doc.querySelector(".collect-footer-actions")
      ];
    }

    var draggedEl = null;

    dragContainers.filter(Boolean).forEach(function (group) {
      Array.prototype.slice.call(group.children).forEach(function (child) {
        if (child.id === "groupSourceNote") return;
        child.setAttribute("data-st-draggable", "1");
        child.draggable = isDragMode;

        if (child._stDragBound) return;
        child._stDragBound = true;

        child.addEventListener("dragstart", function (e) {
          if (!isDragMode) {
            e.preventDefault();
            return;
          }
          draggedEl = child;
          e.dataTransfer.effectAllowed = "move";
          e.stopPropagation();
        });

        child.addEventListener("dragover", function (e) {
          if (!isDragMode || !draggedEl || draggedEl === child) return;
          if (draggedEl.parentElement !== child.parentElement) return;
          e.preventDefault();
          e.stopPropagation();
          child.classList.add("st-drop-target");
        });

        child.addEventListener("dragleave", function () {
          child.classList.remove("st-drop-target");
        });

        child.addEventListener("drop", function (e) {
          child.classList.remove("st-drop-target");
          if (!isDragMode || !draggedEl || draggedEl === child) return;
          if (draggedEl.parentElement !== child.parentElement) return;
          e.preventDefault();
          e.stopPropagation();

          var parent = child.parentElement;
          var siblings = Array.prototype.slice.call(parent.children);
          var fromIdx = siblings.indexOf(draggedEl);
          var toIdx = siblings.indexOf(child);
          if (fromIdx < toIdx) {
            parent.insertBefore(draggedEl, child.nextSibling);
          } else {
            parent.insertBefore(draggedEl, child);
          }
          draggedEl = null;
          renderMagneticOrderList();
          if (chkAutoSave && chkAutoSave.checked) {
            scheduleSaveToDisk(true);
          }
        });
      });
    });

    updateDragModeInDoc(panelKey);
  }

  function updateDragModeInDoc(panelKey) {
    var frame =
      panelKey === "editor"
        ? frameEditor
        : panelKey === "collect"
        ? frameCollect
        : frameMain;
    if (!frame) return;
    var doc;
    try { doc = frame.contentDocument; } catch (e) { return; }
    if (!doc || !doc.body) return;

    if (isDragMode) {
      doc.body.classList.add("st-drag-active");
    } else {
      doc.body.classList.remove("st-drag-active");
    }
    var draggables = doc.querySelectorAll("[data-st-draggable='1']");
    for (var i = 0; i < draggables.length; i++) {
      draggables[i].draggable = isDragMode;
    }
  }

  function applyForcedStateToDoc(doc) {
    if (!doc || !doc.body) return;
    doc.body.classList.remove("tf-force-hover", "tf-force-active");
    if (forcedState === "hover") {
      doc.body.classList.add("tf-force-hover");
    } else if (forcedState === "active") {
      doc.body.classList.add("tf-force-active");
    }
  }

  // ========================================================================
  // CATÁLOGO DE ÍCONES DINÂMICO
  // ========================================================================
  function renderIconCatalog() {
    var grid = document.getElementById("iconCatalogGrid");
    if (!grid) return;
    grid.innerHTML = "";
    ICON_CATALOG.forEach(function (iconItem) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "st-icon-card";
      btn.innerHTML =
        (iconItem.svg || '<span style="font-size:14px;line-height:18px;">⊘</span>') +
        "<span>" + iconItem.name + "</span>";
      btn.onclick = function () {
        if (!selIconTarget) return;
        applyIconToTarget(currentActivePanel, selIconTarget.value, iconItem);
      };
      grid.appendChild(btn);
    });
  }

  function applyIconToTarget(panelKey, targetId, iconItem) {
    var frame =
      panelKey === "editor"
        ? frameEditor
        : panelKey === "collect"
        ? frameCollect
        : frameMain;
    if (!frame) return;
    var doc;
    try { doc = frame.contentDocument; } catch (e) { return; }
    if (!doc) return;

    var btn = doc.getElementById(targetId);
    if (!btn) return;

    if (btn.classList.contains("preset-icon-btn")) {
      var svg = btn.querySelector("svg");
      if (iconItem.id === "none") {
        if (svg) svg.style.display = "none";
      } else {
        btn.innerHTML = iconItem.svg;
      }
    } else if (targetId === "btnOpenPresetBuilder") {
      var firstSpan = btn.querySelector("span:first-child");
      if (firstSpan) {
        if (iconItem.id === "none") {
          firstSpan.textContent = "";
        } else {
          firstSpan.className = "tf-btn-icon";
          firstSpan.innerHTML = iconItem.svg;
        }
      }
    } else {
      var existingIcon = btn.querySelector(".tf-btn-icon");
      if (iconItem.id === "none") {
        if (existingIcon) existingIcon.remove();
      } else {
        if (!existingIcon) {
          existingIcon = doc.createElement("span");
          existingIcon.className = "tf-btn-icon";
          btn.insertBefore(existingIcon, btn.firstChild);
        }
        existingIcon.innerHTML = iconItem.svg;
      }
    }

    showToast("Ícone '" + iconItem.name + "' aplicado em #" + targetId);
    if (chkAutoSave && chkAutoSave.checked) {
      scheduleSaveToDisk(true);
    }
  }

  // ========================================================================
  // PERSISTÊNCIA EM DISCO MULTI-PAINEL
  // ========================================================================
  function extractCleanRegionHtml(panelKey) {
    var frame =
      panelKey === "editor"
        ? frameEditor
        : panelKey === "collect"
        ? frameCollect
        : frameMain;
    if (!frame) return null;
    var doc;
    try { doc = frame.contentDocument; } catch (e) { return null; }
    if (!doc || !doc.body) return null;

    var cloneBody = doc.body.cloneNode(true);

    // Desfaz o custom dropdown do selectEl se presente em qualquer painel (main ou editor)
    var selectWrappers = cloneBody.querySelectorAll(".tf-select-wrapper");
    for (var w = 0; w < selectWrappers.length; w++) {
      var sw = selectWrappers[w];
      var pSelect = sw.querySelector("#presetSelect, select");
      if (pSelect) {
        pSelect.style.display = "";
        if (sw.parentNode) sw.parentNode.insertBefore(pSelect, sw);
      }
      if (sw.parentNode) sw.parentNode.removeChild(sw);
    }
    var orphanSelectEls = cloneBody.querySelectorAll(".tf-select-wrapper, .tf-select-trigger, .tf-select-menu");
    for (var o = 0; o < orphanSelectEls.length; o++) {
      if (orphanSelectEls[o].parentNode) orphanSelectEls[o].parentNode.removeChild(orphanSelectEls[o]);
    }

    function removeBoundaryAndSubsequent(boundaryEl) {
      if (!boundaryEl) return;
      var prev = boundaryEl.previousSibling;
      while (prev && (prev.nodeType === 8 || (prev.nodeType === 3 && !prev.textContent.trim()))) {
        var pNext = prev.previousSibling;
        if (prev.parentNode) prev.parentNode.removeChild(prev);
        prev = pNext;
      }
      var cur = boundaryEl;
      while (cur) {
        var next = cur.nextSibling;
        if (cur.parentNode) cur.parentNode.removeChild(cur);
        cur = next;
      }
    }

    if (panelKey === "main") {
      removeBoundaryAndSubsequent(cloneBody.querySelector("#rollbackModalBackdrop"));
    } else if (panelKey === "editor") {
      removeBoundaryAndSubsequent(cloneBody.querySelector("#labelPopover"));
    } else if (panelKey === "collect") {
      removeBoundaryAndSubsequent(cloneBody.querySelector("#commentsBackdrop"));
    }

    var scripts = cloneBody.querySelectorAll("script");
    for (var s = 0; s < scripts.length; s++) {
      scripts[s].remove();
    }
    var helperStyles = cloneBody.querySelectorAll("#studio-helper-style, #studio-google-fonts");
    for (var h = 0; h < helperStyles.length; h++) {
      helperStyles[h].remove();
    }
    var draggables = cloneBody.querySelectorAll("[data-st-draggable]");
    for (var d = 0; d < draggables.length; d++) {
      draggables[d].removeAttribute("data-st-draggable");
      draggables[d].removeAttribute("draggable");
      draggables[d].classList.remove("st-drop-target");
    }

    var cleanHtml = cloneBody.innerHTML.trim();
    cleanHtml = cleanHtml
      .replace(/(?:\s*<!--\s*(?:Modal de Confirmação de Rollback|Popover Flutuante de Seleção de Color Label|Modal de Comentários)[^-]*-->\s*)+$/gi, "")
      .replace(/<!-- (?:Modal de Confirmação|Popover Flutuante|Modal de Comentários)[\s\S]*$/, "")
      .trim();

    return cleanHtml;
  }

  function scheduleSaveToDisk(includeHtml) {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      saveToDiskNow(includeHtml);
    }, 320);
  }

  function saveToDiskNow(includeHtml) {
    if (isSaving) return;
    isSaving = true;

    var payload = {
      tokens: currentTokens,
      targetPanel: currentActivePanel
    };
    if (includeHtml) {
      var regionHtml = extractCleanRegionHtml(currentActivePanel);
      if (regionHtml) {
        payload.panelRegionHtml = regionHtml;
      }
    }

    fetch("/api/studio/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        isSaving = false;
        if (res && res.ok) {
          showToast(
            "✓ Salvo em tokens.css" +
              (includeHtml ? " & " + PANEL_CONFIGS[currentActivePanel].fileName : "")
          );
        } else {
          showToast("⚠️ Erro ao salvar: " + (res && res.error ? res.error : "Desconhecido"));
        }
      })
      .catch(function (err) {
        isSaving = false;
        showToast("⚠️ Erro de conexão com servidor local: " + err.message);
      });
  }

  function fetchStateFromDisk() {
    if (isSaving) return;
    fetch("/api/studio/state")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data || !data.ok || !data.tokens) return;
        currentTokens = Object.assign({}, FACTORY_TOKENS, data.tokens);
        syncControlsFromTokens();
        applyAllTokensToFrames();
      })
      .catch(function () { });
  }

  // ========================================================================
  // INICIALIZAÇÃO DE EVENTOS
  // ========================================================================
  function initEvents() {
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
        currentViewMode = mode;

        if (mode === "all") {
          panelBtns.forEach(function (b) { b.classList.remove("active"); });
          btn.classList.add("active");
          if (wrapMain) wrapMain.style.display = "flex";
          if (wrapEditor) wrapEditor.style.display = "flex";
          if (wrapCollect) wrapCollect.style.display = "flex";
        } else {
          setActivePanel(mode);
        }
      });
    });

    // Clique direto na moldura para torná-la o painel ativo (no modo 'all')
    document.querySelectorAll(".st-window-wrap").forEach(function (w) {
      w.addEventListener("click", function () {
        var p = w.getAttribute("data-window");
        if (p && p !== currentActivePanel) {
          setActivePanel(p);
        }
      });
    });

    // 3. Simulador de Estado (Rest / Hover / Click)
    var statePills = document.querySelectorAll("[data-force-state]");
    statePills.forEach(function (pill) {
      pill.addEventListener("click", function () {
        forcedState = pill.getAttribute("data-force-state");
        statePills.forEach(function (p) { p.classList.remove("active"); });
        pill.classList.add("active");
        applyAllTokensToFrames();
      });
    });

    // 4. Botão Modo Arrastar Layout
    var btnDrag = document.getElementById("btnToggleDragMode");
    var dragStatus = document.getElementById("dragModeStatus");
    var dragBanner = document.getElementById("dragBanner");
    if (btnDrag) {
      btnDrag.addEventListener("click", function () {
        isDragMode = !isDragMode;
        btnDrag.classList.toggle("active", isDragMode);
        if (dragStatus) dragStatus.textContent = isDragMode ? "ON" : "OFF";
        if (dragBanner) dragBanner.style.display = isDragMode ? "block" : "none";
        setupInteractivePreviewInDoc(currentActivePanel);
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
        Object.assign(currentTokens, preset);
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
        for (var k in currentTokens) {
          if (Object.prototype.hasOwnProperty.call(currentTokens, k)) {
            lines.push("  " + k + ": " + currentTokens[k] + ";");
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
        currentTokens = Object.assign({}, FACTORY_TOKENS);
        applyAllTokensToFrames();
        syncControlsFromTokens();
        saveToDiskNow(false);
        showToast("↺ Visual padrão restaurado!");
      });
    }

    // 14. Eventos de Carga dos Iframes
    getFrames().forEach(function (frame) {
      frame.addEventListener("load", function () {
        applyAllTokensToFrames();
        var panelKey =
          frame === frameEditor
            ? "editor"
            : frame === frameCollect
            ? "collect"
            : "main";
        syncTextInputsFromDoc(panelKey);
        setupInteractivePreviewInDoc(panelKey);
        if (panelKey === currentActivePanel) {
          renderMagneticOrderList();
        }
      });
    });

    window.addEventListener("focus", function () {
      fetchStateFromDisk();
      syncTextInputsFromDoc(currentActivePanel);
    });
  }

  // Inicialização
  renderIconCatalog();
  initEvents();
  setActivePanel("main");
  fetchStateFromDisk();
})();
