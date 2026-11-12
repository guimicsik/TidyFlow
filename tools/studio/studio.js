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
    "--tf-collect-btn-cancel-text": "#d4d4d4",
    "--tf-toolbar-icon-bg": "#262626",
    "--tf-toolbar-icon-hover": "#3E84F6",
    "--tf-toolbar-icon-active": "#1e1e1e",
    "--tf-toolbar-icon-text": "#E4E4E7",
    "--tf-btn-close-bg": "#EF4444",
    "--tf-btn-close-hover": "#DC2626",
    "--tf-btn-close-active": "#B91C1C",
    "--tf-btn-close-text": "#FFFFFF"
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
    },
    overlays: {
      name: "Overlays & Modais",
      fileName: "overlays.html",
      badgeText: "Overlays & Modais (overlays.html)",
      frameId: "frameOverlays",
      wrapId: "wrapOverlays",
      iconTargets: [
        { id: "btnRollbackSaveAndContinue", label: 'Rollback: Salvar e Continuar' },
        { id: "btnRollbackContinueWithoutSave", label: 'Rollback: Continuar sem Salvar' },
        { id: "btnRollbackCancel", label: 'Rollback: Cancelar' },
        { id: "btnCancelRulesModal", label: 'Regras: Cancelar' },
        { id: "btnApplyRulesModal", label: 'Regras: Aplicar Regras' },
        { id: "btnCancelConfirmDelFolder", label: 'Remover Pasta: Cancelar' },
        { id: "btnAcceptConfirmDelFolder", label: 'Remover Pasta: Confirmar' },
        { id: "btnCancelSaveAs", label: 'Salvar Novo: Cancelar' },
        { id: "btnConfirmSaveAs", label: 'Salvar Novo: Salvar' },
        { id: "btnCancelConfirmDelPreset", label: 'Excluir Preset: Cancelar' },
        { id: "btnAcceptConfirmDelPreset", label: 'Excluir Preset: Confirmar' },
        { id: "btnUnsavedSaveClose", label: 'Não Salvo: Salvar e Fechar' },
        { id: "btnUnsavedDiscard", label: 'Não Salvo: Fechar sem Salvar' },
        { id: "btnUnsavedCancel", label: 'Não Salvo: Cancelar' }
      ]
    }
  };

  var currentActivePanel = "main";
  var currentViewMode = "main";
  var currentTokens = Object.assign({}, FACTORY_TOKENS);
  var isDragMode = false;
  var isEditMode = false;
  var currentSelectedElement = null;
  var currentSelectedInfo = null;
  var forcedState = "normal";
  var saveTimer = null;
  var isSaving = false;
  var pendingSave = false;
  var pendingHtml = false;
  var currentDesigns = {};
  var designDirty = false;

  var frameMain = document.getElementById("frameMain");
  var frameEditor = document.getElementById("frameEditor");
  var frameCollect = document.getElementById("frameCollect");
  var frameOverlays = document.getElementById("frameOverlays");
  var chkAutoSave = document.getElementById("chkAutoSave");
  var toastFeedback = document.getElementById("toastFeedback");
  var lblActivePanelBadge = document.getElementById("lblActivePanelBadge");
  var selIconTarget = document.getElementById("selIconTarget");
  var magneticOrderContainer = document.getElementById("magneticOrderContainer");

  var btnToggleEditMode = document.getElementById("btnToggleEditMode");
  var editModeStatus = document.getElementById("editModeStatus");
  var stInspectorPanel = document.getElementById("stInspectorPanel");
  var stDefaultSidebar = document.getElementById("stDefaultSidebar");
  var btnCloseInspector = document.getElementById("btnCloseInspector");

  // Campos do Inspector
  var inspTag = document.getElementById("inspTag");
  var inspTitle = document.getElementById("inspTitle");
  var inspId = document.getElementById("inspId");
  var inspInputText = document.getElementById("inspInputText");
  var inspColRest = document.getElementById("inspColRest");
  var inspHexRest = document.getElementById("inspHexRest");
  var inspColHover = document.getElementById("inspColHover");
  var inspHexHover = document.getElementById("inspHexHover");
  var inspColActive = document.getElementById("inspColActive");
  var inspHexActive = document.getElementById("inspHexActive");
  var inspColText = document.getElementById("inspColText");
  var inspHexText = document.getElementById("inspHexText");
  var inspColBorder = document.getElementById("inspColBorder");
  var inspHexBorder = document.getElementById("inspHexBorder");
  var inspRngFontSize = document.getElementById("inspRngFontSize");
  var inspValFontSize = document.getElementById("inspValFontSize");
  var inspSelFontWeight = document.getElementById("inspSelFontWeight");
  var inspRngLetterSpacing = document.getElementById("inspRngLetterSpacing");
  var inspValLetterSpacing = document.getElementById("inspValLetterSpacing");
  var inspRngRadius = document.getElementById("inspRngRadius");
  var inspValRadius = document.getElementById("inspValRadius");
  var inspRngShadowHover = document.getElementById("inspRngShadowHover");
  var inspValShadowHover = document.getElementById("inspValShadowHover");
  var inspIconCatalogGrid = document.getElementById("inspIconCatalogGrid");

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
    return [frameMain, frameEditor, frameCollect, frameOverlays].filter(Boolean);
  }

  function getActiveDoc() {
    var frame =
      currentActivePanel === "editor"
        ? frameEditor
        : currentActivePanel === "collect"
        ? frameCollect
        : currentActivePanel === "overlays"
        ? frameOverlays
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
    var frames = getFrames().concat(Array.prototype.slice.call(document.querySelectorAll('.st-gallery-frame')));
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
        var shadowStyle = doc.getElementById("studio-individual-shadows");
        if (!shadowStyle) {
          shadowStyle = doc.createElement("style");
          shadowStyle.id = "studio-individual-shadows";
          doc.head.appendChild(shadowStyle);
        }
        var shadowRules = [];
        Object.keys(currentTokens).forEach(function (key) {
          if (!/^--tf-studio-shadow-[A-Za-z][A-Za-z0-9_-]*$/.test(key)) return;
          var id = key.slice("--tf-studio-shadow-".length);
          shadowRules.push("#" + id + ":hover, body.tf-force-hover #" + id + " { box-shadow: var(" + key + ") !important; }");
        });
        shadowStyle.textContent = shadowRules.join("\n");
        var individualStyle = doc.getElementById('studio-individual-design');
        if (!individualStyle) {
          individualStyle = doc.createElement('style');
          individualStyle.id = 'studio-individual-design';
          doc.head.appendChild(individualStyle);
        }
        individualStyle.textContent = window.TFDesignModel.css(currentDesigns);
        applyForcedStateToDoc(doc);
      } catch (e) { }
    }
  }

  function setToken(token, value, skipSave) {
    designDirty = true;
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
        : panelKey === "overlays"
        ? frameOverlays
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
    function readLines(node) {
      var result = '';
      Array.prototype.forEach.call(node.childNodes, function (child) {
        if (child.nodeType === 3) result += child.nodeValue;
        else if (child.nodeType === 1) {
          if (child.tagName === 'BR') result += '\n';
          else {
            var text = readLines(child);
            if (child.tagName === 'SPAN' && result.trim() && text.trim()) result += '\n';
            result += text;
          }
        }
      });
      return result.replace(/^[\s\n]+|[\s\n]+$/g, '').replace(/\n[ \t]+/g, '\n');
    }
    if (el.classList && (el.classList.contains('btn-tile-label') || el.classList.contains('tf-toggle__face'))) return readLines(el);
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
    if (panelKey && PANEL_CONFIGS[panelKey]) {
      currentActivePanel = panelKey;
      if (lblActivePanelBadge) {
        lblActivePanelBadge.textContent = PANEL_CONFIGS[panelKey].badgeText;
      }
    }

    var frame =
      panelKey === "editor"
        ? frameEditor
        : panelKey === "collect"
        ? frameCollect
        : panelKey === "overlays"
        ? frameOverlays
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
        : panelKey === "overlays"
        ? frameOverlays
        : frameMain;
    if (!frame) return;

    var doc;
    try { doc = frame.contentDocument; } catch (e) { return; }
    if (!doc || !doc.body) return;
    if (!doc._stWheelZoomBound) {
      doc._stWheelZoomBound = true;
      doc.addEventListener('wheel', function (ev) {
        if (!ev.ctrlKey || !window.studioAdjustZoom) return;
        ev.preventDefault();
        window.studioAdjustZoom(ev.deltaY < 0 ? 10 : -10);
      }, {passive:false});
    }

    if (!doc.getElementById("studio-helper-style")) {
      var st = doc.createElement("style");
      st.id = "studio-helper-style";
      st.textContent =
        "body.st-drag-active [data-st-draggable='1'] { outline: 2px dashed #F59E0B !important; outline-offset: 2px; cursor: grab !important; }\n" +
        "body.st-drag-active [data-st-draggable='1']:active { cursor: grabbing !important; }\n" +
        ".st-drop-target { outline: 3px solid #10B981 !important; filter: brightness(1.15); }\n" +
        "body.st-edit-active * { box-sizing: border-box; }\n" +
        "body.st-edit-active .tf-btn, body.st-edit-active .preset-icon-btn, body.st-edit-active .tf-toggle, body.st-edit-active .toggle-container, body.st-edit-active .collect-check, body.st-edit-active .btn-tile-label, body.st-edit-active .st-text-box, body.st-edit-active .modal-btn, body.st-edit-active .modal-title, body.st-edit-active .modal-text, body.st-edit-active .modal-subtext, body.st-edit-active .notice-text, body.st-edit-active .tree-toolbar-title, body.st-edit-active .preset-label, body.st-edit-active .collect-legend, body.st-edit-active button, body.st-edit-active label { cursor: pointer !important; }\n" +
        "body.st-edit-active .tf-btn:hover, body.st-edit-active .preset-icon-btn:hover, body.st-edit-active .tf-toggle:hover, body.st-edit-active .toggle-container:hover, body.st-edit-active .collect-check:hover, body.st-edit-active button:hover { outline: 1.5px dashed #3B82F6 !important; outline-offset: 2px !important; }\n" +
        "body.st-edit-active .st-text-box { display: inline-block !important; min-width: 20px; min-height: 14px; outline: 1px dashed rgba(59, 130, 246, 0.28) !important; outline-offset: 1px !important; border-radius: 2px; transition: outline 0.12s ease; }\n" +
        "body.st-edit-active .st-text-box:hover { outline: 1.5px dashed #3B82F6 !important; outline-offset: 2px !important; background-color: rgba(59, 130, 246, 0.08) !important; }\n" +
        "body.st-edit-active .st-text-box:empty::before { content: '[Texto]'; color: rgba(255, 255, 255, 0.35); font-style: italic; font-size: 11px; display: inline-block; }\n" +
        ".st-element-selected { outline: 2.5px solid #3B82F6 !important; outline-offset: 2px !important; box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.35) !important; position: relative !important; }\n" +
        "body.st-edit-active .st-section-group { outline: 1px dashed rgba(255, 255, 255, 0.15) !important; outline-offset: 3px !important; border-radius: 4px; }";
      doc.head.appendChild(st);
    }

    // Marca caixas de textos em todos os painéis para edição precisa estilo Illustrator
    var textSelectors = [
      ".notice-text",
      ".tree-toolbar-title",
      ".preset-bar-label",
      ".preset-label",
      ".modal-title",
      ".modal-text",
      ".modal-subtext",
      ".collect-modal-text",
      "#groupSourceNote",
      "#editorStatus",
      "#lblTargetTitle",
      ".collect-legend",
      ".collect-stats-label",
      ".collect-disk-lbl",
      ".collect-stats-val",
      ".toggle-container span:not(.toggle-slider)",
      ".collect-check span:not(.toggle-slider)",
      ".tf-toggle__face",
      ".btn-tile-label",
      ".rule-section-title span",
      ".modal-body label",
      ".badge-builtin",
      ".badge-unsaved",
      ".rule-pill",
      "legend",
      "p"
    ];
    var textNodes = doc.querySelectorAll(textSelectors.join(", "));
    textNodes.forEach(function (tn) {
      if (!tn.classList.contains("st-text-box")) {
        tn.classList.add("st-text-box");
      }
    });

    var groupSections = doc.querySelectorAll(".tiles-grid, .toggles-grid, .rollback-row, .rule-section, .collect-options-grid, .formats-grid-3col, .behavior-grid-v2");
    groupSections.forEach(function (gs) {
      if (!gs.classList.contains("st-section-group")) {
        gs.classList.add("st-section-group");
      }
    });

    // Interceptador global do Modo Editar: bloqueia cliques de navegação e abre o Inspector
    if (!doc._stClickInspectorBound) {
      doc._stClickInspectorBound = true;
      doc.addEventListener("pointerdown", function () {
        if (panelKey && PANEL_CONFIGS[panelKey] && currentActivePanel !== panelKey) {
          currentActivePanel = panelKey;
          if (lblActivePanelBadge) {
            lblActivePanelBadge.textContent = PANEL_CONFIGS[panelKey].badgeText;
          }
        }
      }, true);

      doc.addEventListener("click", function (ev) {
        if (!isEditMode) return;
        var target = ev.target;
        if (target.closest(".overlay-topbar, .overlay-btn")) {
          if (panelKey && PANEL_CONFIGS[panelKey]) {
            currentActivePanel = panelKey;
            if (lblActivePanelBadge) {
              lblActivePanelBadge.textContent = PANEL_CONFIGS[panelKey].badgeText;
            }
          }
          return;
        }
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation();
        var selectable = target.closest(
          ".tf-btn, .preset-icon-btn, .btn-tile-label, .tf-toggle, .toggle-container, .collect-check, " +
          ".modal-btn, .collect-btn-ok, .collect-btn-cancel, .collect-btn-comments, .collect-link-btn, " +
          ".row-btn, .label-swatch-btn, .prefix-preview, .rules-summary-btn, .collapse-btn, " +
          ".tf-select-trigger, .tf-select-item, .select-input, .text-input, .st-text-box, .notice-text, .tree-toolbar-title, " +
          ".badge-builtin, .badge-unsaved, .rule-pill, button, input, select, " +
          ".modal-title, .modal-text, .modal-subtext, h1, h2, h3, h4, p, legend, label"
        ) || target;

        if (selectable && !selectable.id && !selectable.getAttribute('data-tf-design')) {
          var ownerControl = selectable.closest('button[id], button[data-tf-design], label[id], label[data-tf-design]');
          if (ownerControl && ownerControl !== selectable) selectable = ownerControl;
        }

        if (selectable && selectable !== doc.body && selectable !== doc.documentElement) {
          openInspectorForElement(selectable, panelKey);
        }
      }, true);

      doc.addEventListener("mousedown", function (ev) {
        if (!isEditMode) return;
        if (ev.target.closest(".overlay-topbar, .overlay-btn")) {
          return;
        }
        if (isDragMode && ev.target.closest("[data-st-draggable='1'], .drag-handle")) {
          return;
        }
        if (ev.target.closest("select, input, button, .tf-select-trigger, a, .toggle-container, .collect-check")) {
          ev.preventDefault();
          ev.stopPropagation();
        }
      }, true);

      doc.addEventListener("change", function (ev) {
        if (!isEditMode) return;
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation();
      }, true);
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
    } else if (panelKey === "overlays") {
      dragContainers = [
        doc.querySelector("#ov-rollback .modal-footer"),
        doc.querySelector("#ov-unsaved .modal-footer"),
        doc.querySelector("#ov-del-folder .modal-footer"),
        doc.querySelector("#ov-del-preset .modal-footer"),
        doc.querySelector("#ov-save-as .modal-footer"),
        doc.querySelector("#ov-rules .modal-footer"),
        doc.querySelector("#ov-rules .formats-grid-3col"),
        doc.querySelector("#ov-rules .behavior-grid-v2")
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
    updateEditModeInDoc(panelKey);
  }

  function updateDragModeInDoc(panelKey) {
    var frame =
      panelKey === "editor"
        ? frameEditor
        : panelKey === "collect"
        ? frameCollect
        : panelKey === "overlays"
        ? frameOverlays
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

  // ========================================================================
  // MODO EDITAR & INSPECTOR CONTEXTUAL (Estilo Illustrator / Figma)
  // ========================================================================
  function toggleEditMode(forceVal) {
    isEditMode = (forceVal !== undefined) ? forceVal : !isEditMode;
    if (btnToggleEditMode) {
      btnToggleEditMode.classList.toggle("active", isEditMode);
    }
    if (editModeStatus) {
      editModeStatus.textContent = isEditMode ? "ON" : "OFF";
    }

    // Ao ativar o Modo Editar, ativa o modo de arrastar layout automaticamente
    if (isEditMode) {
      isDragMode = true;
      var btnDrag = document.getElementById("btnToggleDragMode");
      var dragStatus = document.getElementById("dragModeStatus");
      var dragBanner = document.getElementById("dragBanner");
      if (btnDrag) btnDrag.classList.add("active");
      if (dragStatus) dragStatus.textContent = "ON";
      if (dragBanner) dragBanner.style.display = "block";
      showToast("✏️ Modo Editar ATIVADO: Clique em qualquer botão ou texto para inspecionar!");
    } else {
      closeInspector();
      var dragBannerOff = document.getElementById("dragBanner");
      if (dragBannerOff) dragBannerOff.style.display = "none";
    }

    getFrames().forEach(function (frame) {
      var panelKey =
        frame === frameEditor
          ? "editor"
          : frame === frameCollect
          ? "collect"
          : frame === frameOverlays
          ? "overlays"
          : "main";
      setupInteractivePreviewInDoc(panelKey);
      updateEditModeInDoc(panelKey);
      updateDragModeInDoc(panelKey);
    });
  }

  function updateEditModeInDoc(panelKey) {
    var frame =
      panelKey === "editor"
        ? frameEditor
        : panelKey === "collect"
        ? frameCollect
        : panelKey === "overlays"
        ? frameOverlays
        : frameMain;
    if (!frame) return;
    var doc;
    try { doc = frame.contentDocument; } catch (e) { return; }
    if (!doc || !doc.body) return;

    if (isEditMode) {
      doc.body.classList.add("st-edit-active");
    } else {
      doc.body.classList.remove("st-edit-active");
      var selected = doc.querySelectorAll(".st-element-selected");
      for (var s = 0; s < selected.length; s++) {
        selected[s].classList.remove("st-element-selected");
      }
    }
  }

  function closeInspector() {
    currentSelectedElement = null;
    currentSelectedInfo = null;
    if (stInspectorPanel) stInspectorPanel.style.display = "none";
    if (stDefaultSidebar) stDefaultSidebar.style.display = "flex";

    getFrames().forEach(function (f) {
      try {
        var doc = f.contentDocument;
        if (doc) {
          var sel = doc.querySelectorAll(".st-element-selected");
          for (var i = 0; i < sel.length; i++) {
            sel[i].classList.remove("st-element-selected");
          }
        }
      } catch (e) { }
    });
  }

  function rgbToHex(rgbStr) {
    if (!rgbStr) return "#000000";
    var m = rgbStr.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!m) return normalizeHex(rgbStr);
    function h(c) {
      var hex = parseInt(c, 10).toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    }
    return ("#" + h(m[1]) + h(m[2]) + h(m[3])).toUpperCase();
  }

  function openInspectorForElement(el, panelKey) {
    if (!el) return;

    // Desmarca seleção em todos os frames
    getFrames().forEach(function (f) {
      try {
        var doc = f.contentDocument;
        if (doc) {
          var sel = doc.querySelectorAll(".st-element-selected");
          for (var i = 0; i < sel.length; i++) {
            sel[i].classList.remove("st-element-selected");
          }
        }
      } catch (e) { }
    });

    el.classList.add("st-element-selected");
    currentSelectedElement = el;

    // Atualiza automaticamente o painel ativo para a janela de onde o elemento veio
    if (panelKey && PANEL_CONFIGS[panelKey]) {
      currentActivePanel = panelKey;
      if (lblActivePanelBadge) {
        lblActivePanelBadge.textContent = PANEL_CONFIGS[panelKey].badgeText;
      }
      if (currentViewMode !== "all") {
        var panelBtns = document.querySelectorAll("[data-panel-btn]");
        panelBtns.forEach(function (btn) {
          var key = btn.getAttribute("data-panel-btn");
          btn.classList.toggle("active", key === panelKey);
        });
      }
    }

    // Detecta tipo e categoria
    var tag = "ELEMENTO";
    var tokenRestBg = null;
    var tokenHoverBg = null;
    var tokenActiveBg = null;
    var tokenTextColor = null;
    var tokenFontSize = null;
    var tokenLetterSpacing = null;
    var tokenRadius = "--tf-neo-radius";
    var tokenShadowHover = "--tf-neo-shadow-tile";

    if (el.classList.contains("rule-pill")) {
      var pillCategory = el.classList.contains("pill-ext") ? "ext" :
        el.classList.contains("pill-fallback") ? "fallback" :
        el.classList.contains("pill-name") ? "name" : "type";
      tag = "TAG DE REGRA (CATEGORIA)";
      tokenRestBg = "--tf-editor-tag-" + pillCategory + "-bg";
      tokenTextColor = "--tf-editor-tag-" + pillCategory + "-text";
    } else if (el.classList.contains("tf-btn--hero") || el.id === "btnOrganize") {
      tag = "BOTÃO HERO";
      tokenRestBg = "--tf-neo-hero-bg";
      tokenHoverBg = "--tf-neo-hero-hover";
      tokenActiveBg = "--tf-neo-hero-active";
      tokenTextColor = "--tf-neo-hero-text";
      tokenFontSize = "--tf-font-size-hero";
      tokenLetterSpacing = "--tf-hero-letter-spacing";
      tokenShadowHover = "--tf-neo-shadow-hero";
    } else if (el.classList.contains("tf-btn--tile-danger") || el.id === "btnRollback") {
      tag = "BOTÃO DESTRUTIVO";
      tokenRestBg = "--tf-neo-danger-bg";
      tokenHoverBg = "--tf-neo-danger-hover";
      tokenActiveBg = "--tf-neo-danger-active";
      tokenTextColor = "--tf-neo-danger-text";
      tokenFontSize = "--tf-font-size-rollback";
    } else if (el.classList.contains("tf-btn--warning")) {
      tag = "BOTÃO AVISO / ATENÇÃO";
      tokenRestBg = "--tf-neo-warning-bg";
      tokenHoverBg = "--tf-neo-warning-hover";
      tokenActiveBg = "--tf-neo-warning-hover";
      tokenTextColor = "--tf-neo-warning-text";
      tokenFontSize = "--tf-font-size-modal-btn";
    } else if (el.classList.contains("tf-btn--destructive")) {
      tag = "BOTÃO DESTRUTIVO";
      tokenRestBg = "--tf-neo-danger-bg";
      tokenHoverBg = "--tf-neo-danger-hover";
      tokenActiveBg = "--tf-neo-danger-active";
      tokenTextColor = "--tf-neo-danger-text";
      tokenFontSize = "--tf-font-size-modal-btn";
    } else if (el.classList.contains("tf-btn--tile") || el.classList.contains("btn-tile-label")) {
      tag = "BOTÃO TILE";
      tokenRestBg = "--tf-neo-tile-bg";
      tokenHoverBg = "--tf-neo-tile-hover";
      tokenActiveBg = "--tf-neo-tile-active";
      tokenTextColor = "--tf-neo-tile-text";
      tokenFontSize = "--tf-font-size-tile";
      tokenLetterSpacing = "--tf-tile-letter-spacing";
    } else if (el.classList.contains("tf-toggle") || el.closest(".tf-toggle")) {
      tag = "TOGGLE / OPÇÃO";
      tokenRestBg = "--tf-neo-toggle-off-bg";
      tokenHoverBg = "--tf-neo-toggle-off-hover";
      tokenActiveBg = "--tf-neo-toggle-on-bg";
      tokenTextColor = "--tf-neo-toggle-off-text";
      tokenFontSize = "--tf-font-size-toggle";
      tokenLetterSpacing = "--tf-toggle-letter-spacing";
    } else if (el.classList.contains("preset-icon-btn") || el.closest(".preset-actions")) {
      tag = "TOOLBAR ÍCONES (PRESET)";
      tokenRestBg = "--tf-toolbar-icon-bg";
      tokenHoverBg = "--tf-toolbar-icon-hover";
      tokenActiveBg = "--tf-toolbar-icon-active";
      tokenTextColor = "--tf-toolbar-icon-text";
    } else if (el.id === "btnCloseModal" || el.classList.contains("btn-footer-close")) {
      tag = "BOTÃO FECHAR (RODAPÉ)";
      tokenRestBg = "--tf-btn-close-bg";
      tokenHoverBg = "--tf-btn-close-hover";
      tokenActiveBg = "--tf-btn-close-active";
      tokenTextColor = "--tf-btn-close-text";
    } else if (el.classList.contains("tf-btn--primary") || el.classList.contains("collect-btn-ok") || el.id === "btnFooterSave" || el.id === "btnAddTopFolder") {
      tag = "BOTÃO PRIMÁRIO";
      tokenRestBg = el.classList.contains("collect-btn-ok") ? "--tf-collect-btn-ok-bg" : "--tf-neo-primary-bg";
      tokenHoverBg = el.classList.contains("collect-btn-ok") ? "--tf-collect-btn-ok-hover" : "--tf-neo-primary-hover";
      tokenTextColor = el.classList.contains("collect-btn-ok") ? "--tf-collect-btn-ok-text" : "--tf-neo-primary-text";
      if (el.closest(".modal-card") || panelKey === "overlays") {
        tokenFontSize = "--tf-font-size-modal-btn";
      }
    } else if (el.classList.contains("tf-btn--ghost") || el.classList.contains("collect-btn-cancel")) {
      tag = "BOTÃO SECUNDÁRIO";
      tokenRestBg = el.classList.contains("collect-btn-cancel") ? "--tf-collect-btn-cancel-bg" : "--tf-neo-ghost-bg";
      tokenHoverBg = el.classList.contains("collect-btn-cancel") ? "--tf-neo-ghost-hover" : "--tf-neo-ghost-hover";
      tokenTextColor = el.classList.contains("collect-btn-cancel") ? "--tf-collect-btn-cancel-text" : "--tf-neo-ghost-text";
      if (el.closest(".modal-card") || panelKey === "overlays") {
        tokenFontSize = "--tf-font-size-modal-btn";
      }
    } else if (el.classList.contains("collect-link-btn")) {
      tag = "LINK RÁPIDO";
      tokenTextColor = "--tf-neo-primary-bg";
    } else if (el.classList.contains("toggle-container") || el.closest(".toggle-container") || el.classList.contains("collect-check") || el.closest(".collect-check")) {
      tag = "CHECKBOX / TOGGLE";
      tokenRestBg = "--tf-neo-toggle-off-bg";
      tokenHoverBg = "--tf-neo-toggle-off-hover";
      tokenActiveBg = "--tf-neo-toggle-on-bg";
      tokenTextColor = "--tf-neo-toggle-off-text";
      tokenFontSize = "--tf-font-size-toggle";
      tokenLetterSpacing = "--tf-toggle-letter-spacing";
    } else if (el.classList.contains("modal-title") || el.tagName === "H1" || el.tagName === "H2" || el.tagName === "H3" || el.classList.contains("tree-toolbar-title") || el.tagName === "LEGEND") {
      tag = "TÍTULO / CABEÇALHO";
      tokenTextColor = "--tf-text-app";
    } else if (el.classList.contains("modal-text") || el.classList.contains("modal-subtext") || el.classList.contains("notice-text") || el.classList.contains("st-text-box") || el.tagName === "P" || el.tagName === "SPAN" || el.tagName === "LABEL") {
      tag = "TEXTO / RÓTULO";
      tokenTextColor = el.classList.contains("notice-text") ? "--tf-notice-color" : "--tf-text-app";
    }

    currentSelectedInfo = {
      el: el,
      panelKey: panelKey,
      tag: tag,
      tokenRestBg: tokenRestBg,
      tokenHoverBg: tokenHoverBg,
      tokenActiveBg: tokenActiveBg,
      tokenTextColor: tokenTextColor,
      tokenFontSize: tokenFontSize,
      tokenLetterSpacing: tokenLetterSpacing,
      tokenRadius: tokenRadius,
      tokenShadowHover: tokenShadowHover
    };

    // Abre o Inspector na sidebar
    if (stDefaultSidebar) stDefaultSidebar.style.display = "none";
    if (stInspectorPanel) stInspectorPanel.style.display = "flex";

    // Atualiza cabeçalho do Inspector
    if (inspTag) inspTag.textContent = tag;
    var elText = extractReadableTextFromElement(el, el.id || "");
    if (inspTitle) inspTitle.textContent = elText || el.tagName.toLowerCase();
    if (inspId) inspId.textContent = el.id ? "#" + el.id : ("." + (el.className.split(" ")[0] || "elemento"));

    // Texto do Elemento
    var contentEditable = !el.matches('div[data-tf-design], fieldset[data-tf-design], label[data-tf-design], input, select, .tf-select-trigger, .rules-summary-btn, .rule-pill, [data-tf-design^="folder-"]');
    var textSection = document.getElementById('inspSecText');
    if (textSection) textSection.style.display = contentEditable ? '' : 'none';
    var iconSection = document.getElementById('inspSecIcon');
    if (iconSection) iconSection.style.display = el.tagName === 'BUTTON' && !el.matches('.tf-select-trigger, .rules-summary-btn, [data-tf-design^="folder-"]') ? '' : 'none';
    if (inspInputText) {
      var textTarget = el.querySelector && el.querySelector('.btn-tile-label, .tf-toggle__face');
      inspInputText.value = textTarget ? extractReadableTextFromElement(textTarget, '') : elText.replace(/\s*\|\s*/g, '\n');
    }

    // Cores
    var restHex = tokenRestBg && currentTokens[tokenRestBg] ? normalizeHex(currentTokens[tokenRestBg]) : rgbToHex(window.getComputedStyle(el).backgroundColor);
    var hoverHex = tokenHoverBg && currentTokens[tokenHoverBg] ? normalizeHex(currentTokens[tokenHoverBg]) : restHex;
    var activeHex = tokenActiveBg && currentTokens[tokenActiveBg] ? normalizeHex(currentTokens[tokenActiveBg]) : restHex;
    var textHex = tokenTextColor && currentTokens[tokenTextColor] ? normalizeHex(currentTokens[tokenTextColor]) : rgbToHex(window.getComputedStyle(el).color);
    var borderHex = normalizeHex(currentTokens["--tf-neo-border-color"] || "#000000");

    if (inspColRest) inspColRest.value = restHex;
    if (inspHexRest) inspHexRest.value = restHex;
    if (inspColHover) inspColHover.value = hoverHex;
    if (inspHexHover) inspHexHover.value = hoverHex;
    if (inspColActive) inspColActive.value = activeHex;
    if (inspHexActive) inspHexActive.value = activeHex;
    if (inspColText) inspColText.value = textHex;
    if (inspHexText) inspHexText.value = textHex;
    if (inspColBorder) inspColBorder.value = borderHex;
    if (inspHexBorder) inspHexBorder.value = borderHex;

    // Tipografia
    var compStyle = window.getComputedStyle(el);
    var fsPx = tokenFontSize && currentTokens[tokenFontSize] ? parsePxNumber(currentTokens[tokenFontSize], 14) : parsePxNumber(compStyle.fontSize, 14);
    if (inspRngFontSize) inspRngFontSize.value = fsPx;
    if (inspValFontSize) inspValFontSize.textContent = fsPx + "px";

    var fw = compStyle.fontWeight || "700";
    if (inspSelFontWeight) {
      inspSelFontWeight.value = String(fw);
      if (!inspSelFontWeight.value) inspSelFontWeight.value = "800";
    }

    var lsPx = tokenLetterSpacing && currentTokens[tokenLetterSpacing] ? parsePxNumber(currentTokens[tokenLetterSpacing], 0) : parsePxNumber(compStyle.letterSpacing, 0);
    if (inspRngLetterSpacing) inspRngLetterSpacing.value = lsPx;
    if (inspValLetterSpacing) inspValLetterSpacing.textContent = lsPx + "px";

    // Raio e Sombra
    var radPx = parsePxNumber(currentTokens["--tf-neo-radius"] || "6px", 6);
    if (inspRngRadius) inspRngRadius.value = radPx;
    if (inspValRadius) inspValRadius.textContent = radPx + "px";

    var individualShadow = el.id && /^[A-Za-z][A-Za-z0-9_-]*$/.test(el.id) ? "--tf-studio-shadow-" + el.id : null;
    currentSelectedInfo.individualShadow = individualShadow;
    var shVal = individualShadow && currentTokens[individualShadow] ? parsePxNumber(currentTokens[individualShadow], 3) : (tokenShadowHover && currentTokens[tokenShadowHover] ? parsePxNumber(currentTokens[tokenShadowHover], 3) : 3);
    if (inspRngShadowHover) inspRngShadowHover.disabled = !individualShadow;
    if (inspRngShadowHover) inspRngShadowHover.title = individualShadow ? "Sombra individual deste elemento" : "Selecione um elemento com ID para ajustar a sombra individual";
    if (inspRngShadowHover) inspRngShadowHover.value = shVal;
    if (inspValShadowHover) inspValShadowHover.textContent = shVal + "px";

    renderInspectorIconCatalog();
    openIndividualDesign(el);
  }

  function openIndividualDesign(el) {
    var section = document.getElementById('individualDesign');
    if (!section) {
      section = document.createElement('div');
      section.id = 'individualDesign';
      section.className = 'st-inspector-section';
      document.querySelector('.st-inspector-body').prepend(section);
    }
    var key = el.getAttribute('data-tf-design');
    var selector = el.id ? '#' + el.id : key ? '[data-tf-design="' + key + '"]' : null;
    section.replaceChildren();
    var title = document.createElement('strong');
    title.textContent = selector ? (key === 'folder-row' ? 'Estilo: todas as linhas de pastas' : 'Estilo: ' + (el.textContent.trim().slice(0,50) || el.id || key)) : 'Selecione um botão ou tag com identidade estável';
    section.appendChild(title);
    if (!selector) return;
    var targetHint = document.createElement('div');
    targetHint.className = 'st-design-target-hint';
    targetHint.textContent = selector;
    section.appendChild(targetHint);
    var isTag = el.matches('.rule-pill, .tf-badge, .badge-builtin, .badge-unsaved');
    var hoverSetting = document.createElement('label');
    hoverSetting.className = 'st-field st-hover-motion-setting';
    var hoverCheckbox = document.createElement('input');
    hoverCheckbox.type = 'checkbox';
    hoverCheckbox.checked = (currentDesigns[selector] || {}).hoverMotion !== undefined
      ? currentDesigns[selector].hoverMotion : !isTag;
    var hoverCaption = document.createElement('span');
    hoverCaption.textContent = 'Animar ao passar o mouse';
    hoverSetting.appendChild(hoverCheckbox);
    hoverSetting.appendChild(hoverCaption);
    section.appendChild(hoverSetting);
    hoverCheckbox.addEventListener('change', function () {
      currentDesigns[selector] = currentDesigns[selector] || {};
      currentDesigns[selector].hoverMotion = hoverCheckbox.checked;
      applyAllTokensToFrames();
      designDirty = true;
      showToast(chkAutoSave.checked ? 'Alterações pendentes — salvando…' : 'Alterações pendentes — use Salvar no Projeto');
      if (chkAutoSave.checked) scheduleSaveToDisk(false);
    });
    function setDesignProperty(targetState, prop, value) {
      if (value && !CSS.supports(prop, value)) { showToast('Valor inválido para ' + prop); return; }
      if (key === 'folder-row' && targetState === 'rest' && prop === 'background-color' && value) {
        setToken('--tf-editor-row-bg', value);
        return;
      }
      var previous = JSON.stringify(currentDesigns);
      currentDesigns[selector] = currentDesigns[selector] || {};
      var rules = currentDesigns[selector][targetState] = currentDesigns[selector][targetState] || {};
      if (value) rules[prop] = value; else delete rules[prop];
      try { window.TFDesignModel.css(currentDesigns); }
      catch (err) { currentDesigns = JSON.parse(previous); showToast(err.message); return; }
      applyAllTokensToFrames();
      designDirty = true;
      showToast(chkAutoSave.checked ? 'Alterações pendentes — salvando…' : 'Alterações pendentes — use Salvar no Projeto');
      if (chkAutoSave.checked) scheduleSaveToDisk(false);
    }
    var colorGrid = document.createElement('div');
    colorGrid.className = 'st-individual-colors';
    section.appendChild(colorGrid);

    // Mede as cores em uma cópia fora do cursor. Durante o clique que abre o
    // inspetor, o elemento real ainda corresponde a :hover/:active e poderia
    // contaminar as amostras dos outros estados.
    var colorProbe = null;
    var colorProbeRoot = null;
    var colorProbeDoc = el.ownerDocument;
    if (colorProbeDoc && colorProbeDoc.body) {
      var colorProbePath = [];
      var colorProbeCursor = el;
      while (colorProbeCursor && colorProbeCursor !== colorProbeDoc.body) {
        colorProbePath.unshift(colorProbeCursor);
        colorProbeCursor = colorProbeCursor.parentElement;
      }
      var colorProbeParent = colorProbeDoc.body;
      for (var colorProbeIndex = 0; colorProbeIndex < colorProbePath.length; colorProbeIndex++) {
        var colorProbeNode = colorProbePath[colorProbeIndex].cloneNode(false);
        colorProbeNode.classList.remove('st-element-selected');
        colorProbeNode.setAttribute('aria-hidden', 'true');
        colorProbeParent.appendChild(colorProbeNode);
        colorProbeParent = colorProbeNode;
        colorProbe = colorProbeNode;
        if (colorProbeIndex === 0) colorProbeRoot = colorProbeNode;
      }
      if (colorProbeRoot) {
        colorProbeRoot.style.setProperty('visibility', 'hidden', 'important');
        colorProbeRoot.style.setProperty('pointer-events', 'none', 'important');
        colorProbeRoot.style.setProperty('position', 'fixed', 'important');
        colorProbeRoot.style.setProperty('left', '-100000px', 'important');
        colorProbeRoot.style.setProperty('top', '-100000px', 'important');
      }
    }
    function stateColor(targetState, prop) {
      var doc = el.ownerDocument;
      var body = doc.body;
      var sample = colorProbe || el;
      var hadHover = body.classList.contains('tf-force-hover');
      var hadActive = body.classList.contains('tf-force-active');
      var transition = sample.style.getPropertyValue('transition');
      var priority = sample.style.getPropertyPriority('transition');
      sample.style.setProperty('transition', 'none', 'important');
      body.classList.toggle('tf-force-hover', targetState === 'hover' || targetState === 'active');
      body.classList.toggle('tf-force-active', targetState === 'active');
      var value = doc.defaultView.getComputedStyle(sample).getPropertyValue(prop);
      body.classList.toggle('tf-force-hover', hadHover);
      body.classList.toggle('tf-force-active', hadActive);
      if (transition) sample.style.setProperty('transition', transition, priority);
      else sample.style.removeProperty('transition');
      return rgbToHex(value);
    }
    [['Fundo · repouso','rest','background-color'],['Fundo · hover','hover','background-color'],['Fundo · clique','active','background-color'],['Texto · repouso','rest','color'],['Texto · hover','hover','color'],['Texto · clique','active','color'],['Borda · repouso','rest','border-color'],['Borda · hover','hover','border-color'],['Borda · clique','active','border-color']].forEach(function (entry) {
      var card = document.createElement('label');
      card.className = 'st-inspector-color-card';
      var caption = document.createElement('span');
      caption.className = 'st-inspector-color-label';
      caption.textContent = entry[0];
      var row = document.createElement('div');
      row.className = 'st-inspector-color-inputs';
      var picker = document.createElement('input');
      picker.type = 'color';
      var hex = document.createElement('input');
      hex.type = 'text'; hex.maxLength = 7; hex.className = 'st-input';
      var stored = key === 'folder-row' && entry[1] === 'rest' && entry[2] === 'background-color'
        ? currentTokens['--tf-editor-row-bg'] : ((currentDesigns[selector] || {})[entry[1]] || {})[entry[2]];
      picker.value = stored ? rgbToHex(stored) : stateColor(entry[1], entry[2]);
      hex.value = stored || picker.value;
      picker.addEventListener('input', function () { hex.value = picker.value.toUpperCase(); setDesignProperty(entry[1],entry[2],hex.value); });
      hex.addEventListener('change', function () {
        var value = hex.value.trim();
        if (!/^#[0-9a-fA-F]{6}$/.test(value)) { showToast('Use uma cor HEX de 6 dígitos'); return; }
        picker.value = value; setDesignProperty(entry[1],entry[2],value);
      });
      card.appendChild(caption); row.appendChild(picker); row.appendChild(hex);
      if (!(key === 'folder-row' && entry[1] === 'rest' && entry[2] === 'background-color')) {
        var clearColor = document.createElement('button');
        clearColor.type = 'button';
        clearColor.className = 'st-design-color-clear';
        clearColor.textContent = '×';
        clearColor.title = 'Remover cor individual';
        clearColor.addEventListener('click', function () {
          setDesignProperty(entry[1], entry[2], '');
          var inherited = stateColor(entry[1], entry[2]);
          picker.value = inherited;
          hex.value = inherited;
        });
        row.appendChild(clearColor);
      }
      card.appendChild(row); colorGrid.appendChild(card);
    });
    if (colorProbeRoot && colorProbeRoot.parentNode) colorProbeRoot.parentNode.removeChild(colorProbeRoot);
    var stateBar = document.createElement('div');
    stateBar.className = 'st-design-state-bar';
    section.appendChild(stateBar);
    var state = document.createElement('select');
    state.className = 'st-select';
    ['rest','hover','active'].forEach(function (s, i) { state.add(new Option(['Repouso','Hover','Clique'][i], s)); });
    var initialState = forcedState === 'normal' ? 'rest' : forcedState;
    state.value = initialState;
    state.classList.add('st-design-state-select');
    stateBar.appendChild(state);
    var stateButtons = [];
    ['rest','hover','active'].forEach(function (value, index) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'st-design-state-btn' + (value === initialState ? ' active' : '');
      button.textContent = ['Repouso','Hover','Clique'][index];
      button.addEventListener('click', function () {
        state.value = value;
        stateButtons.forEach(function (item) { item.classList.toggle('active', item === button); });
        var forceButton = document.querySelector('[data-force-state="' + (value === 'rest' ? 'normal' : value) + '"]');
        if (forceButton) forceButton.click();
        render();
      });
      stateButtons.push(button);
      stateBar.appendChild(button);
    });
    var resetBar = document.createElement('div');
    resetBar.className = 'st-design-reset-bar';
    var resetState = document.createElement('button');
    resetState.type = 'button';
    resetState.textContent = 'Limpar estado';
    resetState.addEventListener('click', function () {
      var previousState = state.value;
      if (currentDesigns[selector]) delete currentDesigns[selector][state.value];
      applyAllTokensToFrames();
      designDirty = true;
      if (chkAutoSave.checked) scheduleSaveToDisk(false);
      openIndividualDesign(el);
      var stateIndex = ['rest','hover','active'].indexOf(previousState);
      section.querySelectorAll('.st-design-state-btn')[stateIndex].click();
      showToast('Ajustes do estado removidos');
    });
    var resetElement = document.createElement('button');
    resetElement.type = 'button';
    resetElement.textContent = 'Limpar elemento';
    resetElement.addEventListener('click', function () {
      delete currentDesigns[selector];
      applyAllTokensToFrames();
      designDirty = true;
      if (chkAutoSave.checked) scheduleSaveToDisk(false);
      openIndividualDesign(el);
      section.querySelector('.st-design-state-btn').click();
      showToast('Ajustes individuais removidos');
    });
    resetBar.appendChild(resetState);
    resetBar.appendChild(resetElement);
    section.appendChild(resetBar);
    var fields = document.createElement('div');
    fields.className = 'st-design-property-groups';
    section.appendChild(fields);
    var openedGroups = [true, true, false];
    function render() {
      fields.replaceChildren();
      var computed = el.ownerDocument.defaultView.getComputedStyle(el);
      var groups = [
        {title:'Tipografia', props:['font-size','font-weight','line-height','letter-spacing','text-align','text-transform']},
        {title:'Forma e layout', props:['border-width','border-radius','padding','margin','gap','width','height']},
        {title:'Efeitos', props:['box-shadow','transform','opacity','outline']},
        {title:'Layout avançado', props:['display','justify-content','align-items','flex-direction','flex-wrap','grid-template-columns','min-width','min-height','max-width','max-height','overflow']}
      ];
      var sliders = {
        'font-size':[6,128,.5], 'font-weight':[100,900,100], 'line-height':[0,160,.5],
        'letter-spacing':[-5,30,.1], 'border-width':[0,20,.25], 'border-radius':[0,100,1],
        'padding':[0,160,1], 'margin':[-100,300,1], 'gap':[0,160,1],
        'width':[0,2500,1], 'height':[0,2500,1], 'min-width':[0,2500,1],
        'min-height':[0,2500,1], 'max-width':[0,2500,1], 'max-height':[0,2500,1],
        'transform':[-100,100,1], 'opacity':[0,1,.01],
        'outline':[0,20,1], 'grid-template-columns':[1,12,1]
      };
      var choices = {
        'text-align':['left','center','right','justify'],
        'text-transform':['none','uppercase','lowercase','capitalize'],
        'display':['block','inline','inline-block','flex','inline-flex','grid','none'],
        'justify-content':['normal','flex-start','center','flex-end','space-between','space-around','space-evenly'],
        'align-items':['normal','stretch','flex-start','center','flex-end','baseline'],
        'flex-direction':['row','column','row-reverse','column-reverse'],
        'flex-wrap':['nowrap','wrap','wrap-reverse'],
        'overflow':['visible','hidden','auto','scroll']
      };
      function sliderNumber(prop, raw, fallback) {
        var textValue = String(raw || '');
        var match = prop === 'grid-template-columns' ? textValue.match(/repeat\(\s*(\d+)/) :
          prop === 'transform' || prop === 'outline' ? textValue.match(/-?\d+(?:\.\d+)?px/) :
          textValue.match(/-?\d+(?:\.\d+)?/);
        return match ? Number(match[1] || match[0].replace('px','')) : fallback;
      }
      function sliderCss(prop, number, raw) {
        if (prop === 'font-weight' || prop === 'opacity') return String(number);
        if (prop === 'grid-template-columns') return 'repeat(' + number + ', minmax(0, 1fr))';
        if (prop === 'transform') return number === 0 ? 'none' : 'translate(' + number + 'px, ' + number + 'px)';
        if (prop === 'outline') return number === 0 ? 'none' : number + 'px solid currentColor';
        return number + 'px';
      }
      groups.forEach(function (group, groupIndex) {
        var details = document.createElement('details');
        details.className = 'st-design-property-group';
        if (group.title === 'Efeitos') details.classList.add('st-design-effects-group');
        details.open = openedGroups[groupIndex];
        details.addEventListener('toggle', function () { openedGroups[groupIndex] = details.open; });
        var heading = document.createElement('summary');
        heading.textContent = group.title;
        details.appendChild(heading);
        var grid = document.createElement('div');
        grid.className = 'st-design-property-grid';
        group.props.forEach(function (prop) {
          var names = {'border-width':'Espessura da borda','border-radius':'Raio dos cantos','font-size':'Tamanho do texto','font-weight':'Peso do texto','line-height':'Altura da linha','letter-spacing':'Espaço entre letras','text-align':'Alinhamento do texto','text-transform':'Caixa do texto','padding':'Espaço interno','margin':'Margem externa','gap':'Espaço entre elementos','width':'Largura','height':'Altura','min-width':'Largura mínima','min-height':'Altura mínima','max-width':'Largura máxima','max-height':'Altura máxima','display':'Exibição','justify-content':'Alinhamento horizontal','align-items':'Alinhamento vertical','flex-direction':'Direção flex','flex-wrap':'Quebra flex','grid-template-columns':'Colunas da grade','overflow':'Transbordamento','box-shadow':'Sombra (X Y desfoque cor)','transform':'Transformação','opacity':'Opacidade','outline':'Contorno'};
          var label = document.createElement('label');
          label.className = 'st-field st-design-property';
          var caption = document.createElement('span');
          caption.textContent = names[prop] || prop;
          var propertyHeading = document.createElement('div');
          propertyHeading.className = 'st-design-property-heading';
          propertyHeading.appendChild(caption);
          label.appendChild(propertyHeading);
          var row = document.createElement('div');
          row.className = 'st-design-property-row';
          var values = (currentDesigns[selector] || {})[state.value] || {};
          var stored = values[prop] || '';
          var inherited = computed.getPropertyValue(prop).trim();
          var current = stored || inherited;
          var manual = document.createElement('input');
          manual.type = 'text';
          manual.className = 'st-input';
          manual.value = stored;
          manual.placeholder = inherited;
          manual.setAttribute('aria-label', 'CSS manual: ' + (names[prop] || prop));
          manual.addEventListener('change', function () {
            setDesignProperty(state.value, prop, manual.value.trim());
            render();
          });
          if (prop === 'padding') {
            var paddingStyle = document.createElement('div').style;
            paddingStyle.padding = current;
            var paddingSides = ['top', 'right', 'bottom', 'left'].map(function (side) {
              return paddingStyle.getPropertyValue('padding-' + side) || computed.getPropertyValue('padding-' + side).trim() || '0px';
            });
            var paddingControls = document.createElement('div');
            paddingControls.className = 'st-design-shadow-controls';
            [{name:'X', sides:[1, 3]}, {name:'Y', sides:[0, 2]}].forEach(function (axis) {
              var axisRow = document.createElement('div');
              axisRow.className = 'st-design-shadow-axis';
              var axisTitle = document.createElement('span');
              axisTitle.textContent = axis.name;
              var axisRange = document.createElement('input');
              axisRange.type = 'range';
              axisRange.min = 0; axisRange.max = 160; axisRange.step = 1;
              axisRange.setAttribute('aria-label', 'Espaço interno: ' + axis.name);
              var axisField = document.createElement('input');
              axisField.type = 'text';
              axisField.className = 'st-design-shadow-number';
              axisField.setAttribute('aria-label', 'Valor preciso do espaço interno: ' + axis.name);
              axisField.value = paddingSides[axis.sides[0]];
              axisRange.value = Math.max(0, Math.min(160, parseFloat(axisField.value) || 0));
              function updatePadding(value) {
                if (/^(?:\d+\.?\d*|\.\d+)$/.test(value)) value += 'px';
                if (!value || !CSS.supports('padding-top', value)) { axisField.value = paddingSides[axis.sides[0]]; return; }
                paddingSides[axis.sides[0]] = value;
                paddingSides[axis.sides[1]] = value;
                axisField.value = value;
                axisRange.value = Math.max(0, Math.min(160, parseFloat(value) || 0));
                manual.value = paddingSides.join(' ');
                setDesignProperty(state.value, prop, manual.value);
              }
              axisRange.addEventListener('input', function () { updatePadding(axisRange.value); });
              axisField.addEventListener('change', function () { updatePadding(axisField.value.trim()); });
              axisRow.appendChild(axisTitle); axisRow.appendChild(axisRange); axisRow.appendChild(axisField);
              paddingControls.appendChild(axisRow);
            });
            row.appendChild(paddingControls);
          } else if (prop === 'box-shadow') {
            var shadowText = String(current || '');
            var shadowColorMatch = shadowText.match(/rgba?\([^)]+\)|#[0-9a-fA-F]{3,8}/);
            var shadowColor = shadowColorMatch ? shadowColorMatch[0] : '#000000';
            var shadowLengths = shadowText.replace(shadowColor, '').match(/-?\d+(?:\.\d+)?px/g) || [];
            var shadowControls = document.createElement('div');
            shadowControls.className = 'st-design-shadow-controls';
            var shadowFields = [];
            function updateShadow() {
              var cssValue = shadowFields.map(function (field) { return field.value + 'px'; }).join(' ') + ' ' + shadowColor;
              manual.value = cssValue;
              setDesignProperty(state.value, prop, cssValue);
            }
            [{name:'X', min:-40, max:40}, {name:'Y', min:-40, max:40},
              {name:'Desfoque', min:0, max:80}, {name:'Expansão', min:-40, max:40}].forEach(function (axis, index) {
              var axisLabel = document.createElement('div');
              axisLabel.className = 'st-design-shadow-axis';
              var axisTitle = document.createElement('span');
              axisTitle.textContent = axis.name;
              var axisRange = document.createElement('input');
              axisRange.type = 'range';
              axisRange.min = axis.min;
              axisRange.max = axis.max;
              axisRange.step = 1;
              axisRange.setAttribute('aria-label', 'Sombra: ' + axis.name);
              axisRange.value = shadowLengths[index] ? parseFloat(shadowLengths[index]) : 0;
              var axisField = document.createElement('input');
              axisField.type = 'number';
              axisField.step = 'any';
              axisField.className = 'st-design-shadow-number';
              axisField.setAttribute('aria-label', 'Valor preciso da sombra: ' + axis.name + ' em pixels');
              axisField.value = shadowLengths[index] ? String(parseFloat(shadowLengths[index])) : '0';
              axisRange.addEventListener('input', function () {
                axisField.value = axisRange.value;
                updateShadow();
              });
              axisField.addEventListener('change', function () {
                if (axisField.value === '' || !isFinite(Number(axisField.value))) {
                  axisField.value = axisRange.value;
                  return;
                }
                axisRange.value = Math.max(axis.min, Math.min(axis.max, Number(axisField.value)));
                updateShadow();
              });
              axisLabel.appendChild(axisTitle);
              axisLabel.appendChild(axisRange);
              axisLabel.appendChild(axisField);
              shadowControls.appendChild(axisLabel);
              shadowFields.push(axisField);
            });
            var colorLabel = document.createElement('div');
            colorLabel.className = 'st-design-shadow-color';
            colorLabel.textContent = 'Cor';
            var colorPicker = document.createElement('input');
            colorPicker.type = 'color';
            colorPicker.setAttribute('aria-label', 'Cor da sombra');
            colorPicker.value = rgbToHex(shadowColor);
            colorPicker.addEventListener('input', function () { shadowColor = colorPicker.value; updateShadow(); });
            colorLabel.appendChild(colorPicker);
            shadowControls.appendChild(colorLabel);
            row.appendChild(shadowControls);
          } else if (sliders[prop]) {
            var range = document.createElement('input');
            range.type = 'range';
            range.className = 'st-design-slider';
            range.min = sliders[prop][0];
            range.max = sliders[prop][1];
            range.step = sliders[prop][2];
            var fallback = prop === 'line-height' ? parsePxNumber(computed.fontSize, 14) * 1.2 :
              prop === 'grid-template-columns' ? 1 : prop === 'opacity' ? 1 : 0;
            var initial = sliderNumber(prop, current, fallback);
            range.value = Math.max(sliders[prop][0], Math.min(sliders[prop][1], initial));
            var precise = document.createElement('input');
            precise.type = 'text';
            precise.className = 'st-design-value st-design-precise';
            precise.value = current;
            precise.title = 'Digite um valor preciso ou uma unidade CSS';
            precise.setAttribute('aria-label', 'Valor preciso: ' + (names[prop] || prop));
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
              range.value = Math.max(sliders[prop][0], Math.min(sliders[prop][1], parsed));
              setDesignProperty(state.value, prop, cssValue);
            });
            row.appendChild(range);
            row.appendChild(precise);
          } else if (choices[prop]) {
            var menu = document.createElement('select');
            menu.className = 'st-select st-design-choice';
            var options = choices[prop].slice();
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
          clear.title = 'Remover ajuste individual de ' + (names[prop] || prop);
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
          grid.appendChild(label);
        });
        details.appendChild(grid);
        fields.appendChild(details);
      });
    }
    state.addEventListener('change', render);
    render();
  }

  function renderInspectorIconCatalog() {
    if (!inspIconCatalogGrid) return;
    inspIconCatalogGrid.innerHTML = "";
    ICON_CATALOG.forEach(function (iconItem) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "st-icon-card";
      btn.style.padding = "4px 2px";
      btn.innerHTML =
        (iconItem.svg || '<span style="font-size:12px;line-height:16px;">⊘</span>') +
        '<span style="font-size:8.5px;">' + iconItem.name + '</span>';
      btn.onclick = function () {
        applyIconToInspectedElement(iconItem);
      };
      inspIconCatalogGrid.appendChild(btn);
    });
  }

  function applyIconToInspectedElement(iconItem) {
    if (!currentSelectedElement) return;
    var el = currentSelectedElement;

    // Procura ou cria .tf-btn-icon
    var existingIcon = el.querySelector(".tf-btn-icon");
    if (iconItem.id === "none") {
      if (existingIcon) existingIcon.remove();
    } else {
      if (!existingIcon) {
        existingIcon = el.ownerDocument.createElement("span");
        existingIcon.className = "tf-btn-icon";
        el.insertBefore(existingIcon, el.firstChild);
      }
      existingIcon.innerHTML = iconItem.svg;
    }
    showToast("Ícone '" + iconItem.name + "' aplicado ao elemento selecionado!");
    if (chkAutoSave && chkAutoSave.checked) {
      scheduleSaveToDisk(true);
    }
  }

  function initInspectorEvents() {
    if (btnCloseInspector) {
      btnCloseInspector.addEventListener("click", function () {
        closeInspector();
      });
    }

    if (inspInputText) {
      inspInputText.addEventListener("input", function () {
        if (!currentSelectedElement) return;
        var el = currentSelectedElement;
        var newText = inspInputText.value;

        // Se tiver .tf-btn-icon, altera apenas o texto fora do ícone
        var existingIcon = el.querySelector ? el.querySelector(".tf-btn-icon") : null;
        var labelBox = (el.classList && (el.classList.contains("btn-tile-label") || el.classList.contains("tf-toggle__face")))
          ? el
          : (el.querySelector ? el.querySelector(".btn-tile-label, .tf-toggle__face") : null);

        if (labelBox) {
          var textContainer = el.ownerDocument.createElement('span');
          newText.split('\n').forEach(function (line, index) {
            if (index) textContainer.appendChild(el.ownerDocument.createElement('br'));
            textContainer.appendChild(el.ownerDocument.createTextNode(line));
          });
          while (labelBox.firstChild) labelBox.removeChild(labelBox.firstChild);
          labelBox.appendChild(textContainer);
        } else if (existingIcon) {
          var nodes = Array.prototype.slice.call(el.childNodes);
          for (var i = 0; i < nodes.length; i++) {
            if (nodes[i] !== existingIcon) {
              nodes[i].remove();
            }
          }
          el.appendChild(el.ownerDocument.createTextNode(" " + newText));
        } else {
          el.textContent = newText;
          el.style.whiteSpace = 'pre-line';
        }

        if (inspTitle) inspTitle.textContent = newText || "[Texto]";
      });

      inspInputText.addEventListener("change", function () {
        if (chkAutoSave && chkAutoSave.checked) {
          scheduleSaveToDisk(true);
        }
      });
    }

    // Cores
    function bindInspColor(colEl, hexEl, tokenField, fallbackCssProp) {
      if (!colEl || !hexEl) return;
      function applyCol(val) {
        if (!currentSelectedInfo) return;
        var token = currentSelectedInfo[tokenField];
        if (token) {
          setToken(token, val);
        } else if (currentSelectedElement && fallbackCssProp) {
          currentSelectedElement.style[fallbackCssProp] = val;
        }
      }
      colEl.addEventListener("input", function () {
        var hex = colEl.value.toUpperCase();
        hexEl.value = hex;
        applyCol(hex);
      });
      hexEl.addEventListener("input", function () {
        var hex = hexEl.value.trim().toUpperCase();
        if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
          colEl.value = hex;
          applyCol(hex);
        }
      });
    }

    bindInspColor(inspColRest, inspHexRest, "tokenRestBg", "backgroundColor");
    bindInspColor(inspColHover, inspHexHover, "tokenHoverBg", null);
    bindInspColor(inspColActive, inspHexActive, "tokenActiveBg", null);
    bindInspColor(inspColText, inspHexText, "tokenTextColor", "color");
    bindInspColor(inspColBorder, inspHexBorder, null, "borderColor");

    // Tipografia
    if (inspRngFontSize && inspValFontSize) {
      inspRngFontSize.addEventListener("input", function () {
        var px = inspRngFontSize.value + "px";
        inspValFontSize.textContent = px;
        if (currentSelectedInfo && currentSelectedInfo.tokenFontSize) {
          setToken(currentSelectedInfo.tokenFontSize, px);
        } else if (currentSelectedElement) {
          currentSelectedElement.style.fontSize = px;
        }
      });
    }

    if (inspSelFontWeight) {
      inspSelFontWeight.addEventListener("change", function () {
        var val = inspSelFontWeight.value;
        if (currentSelectedInfo && currentSelectedInfo.tokenFontSize === "--tf-font-size-hero") {
          setToken("--tf-font-weight-hero", val);
        } else if (currentSelectedElement) {
          currentSelectedElement.style.fontWeight = val;
        }
      });
    }

    if (inspRngLetterSpacing && inspValLetterSpacing) {
      inspRngLetterSpacing.addEventListener("input", function () {
        var px = inspRngLetterSpacing.value + "px";
        inspValLetterSpacing.textContent = px;
        if (currentSelectedInfo && currentSelectedInfo.tokenLetterSpacing) {
          setToken(currentSelectedInfo.tokenLetterSpacing, px);
        } else if (currentSelectedElement) {
          currentSelectedElement.style.letterSpacing = px;
        }
      });
    }

    // Borda e Sombra
    if (inspRngRadius && inspValRadius) {
      inspRngRadius.addEventListener("input", function () {
        var px = inspRngRadius.value + "px";
        inspValRadius.textContent = px;
        setToken("--tf-neo-radius", px);
      });
    }

    if (inspRngShadowHover && inspValShadowHover) {
      inspRngShadowHover.addEventListener("input", function () {
        var px = inspRngShadowHover.value + "px";
        inspValShadowHover.textContent = px;
        var token = currentSelectedInfo && currentSelectedInfo.individualShadow;
        if (!token) return;
        var borderCol = currentTokens["--tf-neo-border-color"] || "#000000";
        setToken(token, px + " " + px + " 0px " + borderCol);
      });
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
        : panelKey === "overlays"
        ? frameOverlays
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
        : panelKey === "overlays"
        ? frameOverlays
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
    var selectedEls = cloneBody.querySelectorAll(".st-element-selected");
    for (var sel = 0; sel < selectedEls.length; sel++) {
      selectedEls[sel].classList.remove("st-element-selected");
    }

    var cleanHtml = cloneBody.innerHTML.trim();
    if (panelKey !== "overlays") {
      cleanHtml = cleanHtml
        .replace(/(?:\s*<!--\s*(?:Modal de Confirmação de Rollback|Popover Flutuante de Seleção de Color Label|Modal de Comentários)[^-]*-->\s*)+$/gi, "")
        .replace(/<!-- (?:Modal de Confirmação|Popover Flutuante|Modal de Comentários)[\s\S]*$/, "")
        .trim();
    }

    return cleanHtml;
  }

  function scheduleSaveToDisk(includeHtml) {
    pendingHtml = pendingHtml || includeHtml;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      saveTimer = null;
      saveToDiskNow(pendingHtml);
    }, 320);
  }

  function saveToDiskNow(includeHtml) {
    if (isSaving) { pendingSave = true; pendingHtml = pendingHtml || includeHtml; return; }
    isSaving = true;
    pendingHtml = false;

    var payload = {
      tokens: currentTokens,
      designs: currentDesigns,
      targetPanel: currentActivePanel
    };
    if (includeHtml) {
      if (currentViewMode === "all") {
        payload.panels = {
          main: extractCleanRegionHtml("main"),
          editor: extractCleanRegionHtml("editor"),
          collect: extractCleanRegionHtml("collect"),
          overlays: extractCleanRegionHtml("overlays")
        };
      } else {
        var regionHtml = extractCleanRegionHtml(currentActivePanel);
        if (regionHtml) {
          payload.panelRegionHtml = regionHtml;
        }
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
        if (pendingSave) { pendingSave = false; scheduleSaveToDisk(pendingHtml); }
        if (res && res.ok) {
          if (!pendingSave && !saveTimer) designDirty = false;
          showToast(
            "✓ Salvo em tokens.css" +
              (includeHtml ? " & " + (currentViewMode === "all" ? "Todos os Painéis & Overlays" : PANEL_CONFIGS[currentActivePanel].fileName) : "")
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
    if (isSaving || pendingSave || pendingHtml || saveTimer || designDirty) return;
    fetch("/api/studio/state")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data || !data.ok || !data.tokens) return;
        currentTokens = Object.assign({}, FACTORY_TOKENS, data.tokens);
        currentDesigns = data.designs || {};
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
            : frame === frameOverlays
            ? "overlays"
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
  function initCanvasTools() {
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
      currentViewMode = 'single';
      if (panel.value === 'overlays' && frameOverlays.contentWindow) frameOverlays.contentWindow.location.hash = '';
      setActivePanel(panel.value);
      sync();
    };
    function resize() {
      var w = Number(width.value), h = Number(height.value);
      if (w < 280 || w > 3840 || h < 240 || h > 2160) return;
      body().style.width = w + 'px'; body().style.height = h + 'px';
      localStorage.setItem('tf-studio-size-' + panel.value, JSON.stringify([w,h]));
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
      if (wrap) wrap.scrollIntoView({block:'center', inline:'center', behavior:'auto'});
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
      panStart = {x:ev.clientX, y:ev.clientY, left:stage.scrollLeft, top:stage.scrollTop};
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
    }, {passive:false});
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
      fetch('/api/studio/window-size', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({panel:panel.value,width:Number(width.value),height:Number(height.value)})})
        .then(function (r) {return r.json();}).then(function (r) {showToast(r.ok ? 'Tamanho CEP salvo. Reabra a extensão para conferir.' : r.error);}).catch(function (e) {showToast(e.message);});
    };
    Object.keys(PANEL_CONFIGS).forEach(function (key) {
      var saved;
      try { saved = JSON.parse(localStorage.getItem('tf-studio-size-' + key)); } catch (e) {}
      if (saved && saved[0] >= 280 && saved[0] <= 3840 && saved[1] >= 240 && saved[1] <= 2160) {
        var b = document.getElementById(PANEL_CONFIGS[key].wrapId).querySelector('.st-window-body');
        b.style.width = saved[0] + 'px'; b.style.height = saved[1] + 'px';
      }
    });
    sync();
  }
  function initScreenGallery() {
    var list = document.getElementById('screenGalleryList');
    if (!list) return;
    var screens = [
      {group:'JANELAS', id:'main', panel:'main', name:'Painel Principal', source:'index.html', url:'/index.html?preview=1', width:360, height:440, scale:.38},
      {id:'editor', panel:'editor', name:'Preset Builder', source:'tree_editor.html', url:'/tree_editor.html?preview=1', width:740, height:640, scale:.23},
      {id:'collect', panel:'collect', name:'Collect Files', source:'collect.html', url:'/collect.html?preview=1', width:560, height:700, scale:.30},
      {group:'AVISOS E MODAIS', id:'ov-rules', panel:'overlays', name:'Regras e filtros', source:'Preset Builder'},
      {id:'ov-rollback', panel:'overlays', name:'Confirmar rollback', source:'Painel Principal'},
      {id:'ov-del-folder', panel:'overlays', name:'Remover pasta', source:'Preset Builder'},
      {id:'ov-save-as', panel:'overlays', name:'Salvar novo preset', source:'Preset Builder'},
      {id:'ov-unsaved', panel:'overlays', name:'Alterações não salvas', source:'Preset Builder'},
      {id:'ov-reduce', panel:'overlays', name:'Confirmação de redução', source:'Reserva para uso futuro'},
      {id:'ov-comments', panel:'overlays', name:'Comentários', source:'Collect Files'}
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
      preview.addEventListener('load', applyAllTokensToFrames);
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
        currentViewMode = 'single';
        setActivePanel(screen.panel);
        if (screen.panel === 'overlays' && frameOverlays.contentWindow) frameOverlays.contentWindow.location.hash = screen.id;
        document.querySelectorAll('.st-gallery-card').forEach(function (item) { item.classList.toggle('active', item === card); });
        closeInspector();
        if (window.studioFitCanvas) window.studioFitCanvas();
      });
      list.appendChild(card);
    });
  }
  initCanvasTools();
  initScreenGallery();
  renderIconCatalog();
  initEvents();
  setActivePanel("main");
  fetchStateFromDisk();
})();
