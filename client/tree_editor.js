(function () {
  "use strict";

  var csInterface = new CSInterface();
  var presetManager = new PresetManager(csInterface);
  var isPPro = presetManager.isPremierePro();
  var hostAppName = presetManager.getHostDisplayName();

  if (isPPro) {
    document.title = "TidyFlow — Preset Builder (Premiere Pro)";
    var treeToolbarTitle = document.getElementById("treeToolbarTitle");
    if (treeToolbarTitle) {
      treeToolbarTitle.textContent =
        "Estrutura da Árvore de Pastas (Clique na cor para Label PPro • Clique nas regras para filtrar)";
    }
    var ruleSectionHostTitle = document.getElementById("ruleSectionHostTitle");
    if (ruleSectionHostTitle) {
      ruleSectionHostTitle.textContent = "1. Formatos";
    }
    var lblTypeMainComp = document.getElementById("lblTypeMainComp");
    if (lblTypeMainComp) {
      lblTypeMainComp.textContent = "Sequência Principal";
    }
    var tileTypeMainComp = document.getElementById("tileTypeMainComp");
    if (tileTypeMainComp) {
      tileTypeMainComp.setAttribute(
        "data-tooltip",
        "Sequências finais de edição que não estão inseridas dentro de nenhuma outra sequência."
      );
    }
    var lblTypePreComps = document.getElementById("lblTypePreComps");
    if (lblTypePreComps) {
      lblTypePreComps.textContent = "Sequências Aninhadas";
    }
    var tileTypePreComps = document.getElementById("tileTypePreComps");
    if (tileTypePreComps) {
      tileTypePreComps.setAttribute(
        "data-tooltip",
        "Sequências secundárias ou multicâmera usadas dentro de outras sequências."
      );
    }
    var tileTypeStillImages = document.getElementById("tileTypeStillImages");
    if (tileTypeStillImages) {
      tileTypeStillImages.setAttribute(
        "data-tooltip",
        "Fotos, artes, ilustrações e logotipos estáticos (.png, .jpg, .jfif, .psd, .ai, .svg, .dng...)."
      );
    }
    var tileTypeVideos = document.getElementById("tileTypeVideos");
    if (tileTypeVideos) {
      tileTypeVideos.setAttribute(
        "data-tooltip",
        "Gravações de câmera, clipes renderizados e sequências de imagem (.mp4, .mov, .prores, .mxf, .braw, .r3d...)."
      );
    }
    var tileTypeAudios = document.getElementById("tileTypeAudios");
    if (tileTypeAudios) {
      tileTypeAudios.setAttribute(
        "data-tooltip",
        "Músicas, locuções e efeitos sonoros sem vídeo (.wav, .mp3, .aac, .m4a, .aif, .flac, .asnd, .ac3...)."
      );
    }
    var lblTypeSolids = document.getElementById("lblTypeSolids");
    if (lblTypeSolids) {
      lblTypeSolids.textContent = "Itens Sintéticos";
    }
    var tileTypeSolids = document.getElementById("tileTypeSolids");
    if (tileTypeSolids) {
      tileTypeSolids.setAttribute(
        "data-tooltip",
        "Elementos gerados internamente no Premiere, como Color Matte, Adjustment Layer e Black Video."
      );
    }
    var lblTypeDataFiles = document.getElementById("lblTypeDataFiles");
    if (lblTypeDataFiles) {
      lblTypeDataFiles.textContent = "Dados, MOGRT e Legendas";
    }
    var tileTypeDataFiles = document.getElementById("tileTypeDataFiles");
    if (tileTypeDataFiles) {
      tileTypeDataFiles.setAttribute(
        "data-tooltip",
        "Templates gráficos, legendas, tabelas e projetos importados (.mogrt, .srt, .vtt, .xml, .json, .prproj...)."
      );
    }
    var lblRuleGroupByMainComp = document.getElementById("lblRuleGroupByMainComp");
    if (lblRuleGroupByMainComp) {
      lblRuleGroupByMainComp.textContent = "Agrupar por Seq. Principal";
    }
    var tileRuleGroupByMainComp = document.getElementById("tileRuleGroupByMainComp");
    if (tileRuleGroupByMainComp) {
      tileRuleGroupByMainComp.setAttribute(
        "data-tooltip",
        "Separa as sequências aninhadas em subpastas com o nome da sequência principal onde são usadas."
      );
    }
    var lblRulePsdBundles = document.getElementById("lblRulePsdBundles");
    if (lblRulePsdBundles) {
      lblRulePsdBundles.textContent = "Isolar PSD / AI";
    }
  }

  // Elementos DOM - Barra Superior
  var presetSelect = document.getElementById("presetSelect");
  var badgeBuiltIn = document.getElementById("badgeBuiltIn");
  var badgeUnsaved = document.getElementById("badgeUnsaved");
  var btnSaveAsPreset = document.getElementById("btnSaveAsPreset");
  var btnResetDefault = document.getElementById("btnResetDefault");
  var btnImportJson = document.getElementById("btnImportJson");
  var btnExportJson = document.getElementById("btnExportJson");
  var btnOpenPresetsFolder = document.getElementById("btnOpenPresetsFolder");
  var btnDeletePreset = document.getElementById("btnDeletePreset");
  var hiddenFileInput = document.getElementById("hiddenFileInput");

  // Elementos DOM - Barra de Configurações
  var chkUsePrefixNumbering = document.getElementById("chkUsePrefixNumbering");
  var chkGroupBySourceFolder = document.getElementById("chkGroupBySourceFolder");
  var lblGroupBySourceFolder = document.getElementById("lblGroupBySourceFolder");
  var chkSeparateAudioCategories = document.getElementById("chkSeparateAudioCategories");
  var chkNumberAudioCategories = document.getElementById("chkNumberAudioCategories");
  var lblSeparateAudioCategories = document.getElementById("lblSeparateAudioCategories");
  var lblNumberAudioCategories = document.getElementById("lblNumberAudioCategories");

  function syncGroupBySourceToggleState() {
    if (!chkGroupBySourceFolder) return;
    var missing = [];
    var total = 0;
    function walk(nodes) {
      for (var i = 0; i < (nodes || []).length; i++) {
        var n = nodes[i];
        total++;
        if (n.rules && n.rules.groupBySourceFolder === false) missing.push(n.name);
        walk(n.children);
      }
    }
    if (currentPreset) walk(currentPreset.tree);

    if (total > 0) {
      chkGroupBySourceFolder.checked = (missing.length < total);
    } else {
      var s = (currentPreset && currentPreset.settings) || {};
      chkGroupBySourceFolder.checked = (s.groupBySourceFolder !== false);
    }

    if (lblGroupBySourceFolder) {
      if (missing.length && missing.length < total) {
        lblGroupBySourceFolder.classList.add("partial");
        lblGroupBySourceFolder.title =
          "Parcial: " + missing.join(", ") + " não usa(m) 'Pasta de origem'. Clique para aplicar a todas.";
      } else {
        lblGroupBySourceFolder.classList.remove("partial");
        lblGroupBySourceFolder.title =
          "Cria uma subpasta com o nome da pasta em que o arquivo reside no disco";
      }
    }
  }

  function syncAudioSubToggleState() {
    var isStudioPreview = !window.__adobe_cep__ && window.parent !== window;
    if (!isPPro && !isStudioPreview) {
      if (chkSeparateAudioCategories) chkSeparateAudioCategories.disabled = true;
      if (chkNumberAudioCategories) chkNumberAudioCategories.disabled = true;
      if (lblSeparateAudioCategories) {
        lblSeparateAudioCategories.classList.add("is-disabled");
        lblSeparateAudioCategories.title = "Disponível apenas no Premiere Pro (Essential Sound)";
      }
      if (lblNumberAudioCategories) {
        lblNumberAudioCategories.classList.add("is-disabled");
        lblNumberAudioCategories.title = "Disponível apenas no Premiere Pro (Essential Sound)";
      }
      return;
    }
    if (chkSeparateAudioCategories) chkSeparateAudioCategories.disabled = false;
    if (lblSeparateAudioCategories) lblSeparateAudioCategories.classList.remove("is-disabled");
    if (!chkNumberAudioCategories) return;
    if (isStudioPreview) {
      chkNumberAudioCategories.disabled = false;
      if (lblNumberAudioCategories) lblNumberAudioCategories.classList.remove("is-disabled");
      return;
    }
    var espOn = chkSeparateAudioCategories ? Boolean(chkSeparateAudioCategories.checked) : true;
    chkNumberAudioCategories.disabled = !espOn;
    if (lblNumberAudioCategories) {
      lblNumberAudioCategories.classList.toggle("is-disabled", !espOn);
    }
  }

  // Elementos DOM - Árvore e Rodapé
  var btnAddTopFolder = document.getElementById("btnAddTopFolder");
  var treeRootList = document.getElementById("treeRootList");
  var editorStatus = document.getElementById("editorStatus");
  var btnFooterSave = document.getElementById("btnFooterSave");
  var btnCloseModal = document.getElementById("btnCloseModal");

  // Modal de Alterações Não Salvas (ao Fechar)
  var unsavedCloseModalBackdrop = document.getElementById("unsavedCloseModalBackdrop");
  var btnUnsavedCancel = document.getElementById("btnUnsavedCancel");
  var btnUnsavedDiscard = document.getElementById("btnUnsavedDiscard");
  var btnUnsavedSaveClose = document.getElementById("btnUnsavedSaveClose");

  // Popover de Cores AE e Tooltip de Info
  var labelPopover = document.getElementById("labelPopover");
  var ruleInfoTooltip = document.getElementById("ruleInfoTooltip");

  // Modal de Regras (V2)
  var rulesModalBackdrop = document.getElementById("rulesModalBackdrop");
  var rulesModalSwatch = document.getElementById("rulesModalSwatch");
  var rulesModalTitleText = document.getElementById("rulesModalTitleText");
  var btnCloseRulesModalX = document.getElementById("btnCloseRulesModalX");
  var ruleTypeCheckboxes = document.querySelectorAll(".rule-type-chk");
  var chkRuleGroupExt = document.getElementById("chkRuleGroupExt");
  var chkRuleGroupBySourceFolder = document.getElementById("chkRuleGroupBySourceFolder");
  var chkRuleGroupByMainComp = document.getElementById("chkRuleGroupByMainComp");
  var chkRulePsdBundles = document.getElementById("chkRulePsdBundles");
  var chkRuleCatchOthers = document.getElementById("chkRuleCatchOthers");
  var btnClearAllExts = document.getElementById("btnClearAllExts");
  var inpNewExtension = document.getElementById("inpNewExtension");
  var extTagsContainer = document.getElementById("extTagsContainer");
  var extChipsList = document.getElementById("extChipsList");
  var btnClearAllNameTags = document.getElementById("btnClearAllNameTags");
  var inpNewNameTag = document.getElementById("inpNewNameTag");
  var btnAddNameTag = document.getElementById("btnAddNameTag");
  var nameTagsContainer = document.getElementById("nameTagsContainer");
  var btnCancelRulesModal = document.getElementById("btnCancelRulesModal");
  var btnApplyRulesModal = document.getElementById("btnApplyRulesModal");

  // Modal Salvar Como
  var saveAsModalBackdrop = document.getElementById("saveAsModalBackdrop");
  var inpSaveAsName = document.getElementById("inpSaveAsName");
  var btnCancelSaveAs = document.getElementById("btnCancelSaveAs");
  var btnConfirmSaveAs = document.getElementById("btnConfirmSaveAs");

  // Modal Confirmação
  var confirmModalBackdrop = document.getElementById("confirmModalBackdrop");
  var confirmModalTitle = document.getElementById("confirmModalTitle");
  var confirmModalMessage = document.getElementById("confirmModalMessage");
  var btnCancelConfirm = document.getElementById("btnCancelConfirm");
  var btnAcceptConfirm = document.getElementById("btnAcceptConfirm");

  // Estado em memória
  var currentPreset = null;
  var collapsedNodeIds = {};
  var isDirty = false;
  var activeColorPopoverNodeId = null;
  var editingRulesNodeId = null;
  var modalCustomExts = [];
  var modalWorkingNameTags = [];
  var pendingConfirmCallback = null;
  var draggedNodeId = null;
  var closeAfterSaveAs = false;
  var activeDefaultExtensions = presetManager.getDefaultExtensions();

  function setStatus(msg, type) {
    if (!editorStatus) return;
    editorStatus.textContent = msg || "";
    editorStatus.className = type || "";
  }

  // Falha de escrita em disco nao pode virar "salvo com sucesso"
  function reportSaveError() {
    if (!presetManager.lastSaveError) return false;
    setStatus("Erro ao salvar: " + presetManager.lastSaveError, "error");
    try {
      if (window.OrgLog) OrgLog.error("tree_editor.save", presetManager.lastSaveError);
    } catch (e) { }
    return true;
  }

  // Gravacao que descartou parte do conteudo (arvore do preset Default):
  // avisa no rodape e mantem o badge "Nao salvo*" em vez de dar por salvo.
  function reportSaveWarning() {
    var warning = (presetManager && typeof presetManager.consumeSaveWarning === "function")
      ? presetManager.consumeSaveWarning()
      : null;
    if (!warning) return;
    setDirty(true);
    setStatus(warning, "warning");
    try {
      if (window.OrgLog) OrgLog.warn("tree_editor.save", warning);
    } catch (e) { }
  }

  function setDirty(dirtyState) {
    isDirty = Boolean(dirtyState);
    if (badgeUnsaved) {
      badgeUnsaved.style.display = isDirty ? "inline-block" : "none";
    }
  }

  function clearAllDragOverIndicators() {
    var rows = document.querySelectorAll(".tree-row");
    for (var i = 0; i < rows.length; i++) {
      rows[i].classList.remove("drag-over-before", "drag-over-after", "drag-over-inside");
    }
  }

  function isDescendantOf(candidateChildNode, ancestorNode) {
    if (!ancestorNode || !Array.isArray(ancestorNode.children)) return false;
    for (var i = 0; i < ancestorNode.children.length; i++) {
      var ch = ancestorNode.children[i];
      if (ch.id === candidateChildNode.id) return true;
      if (isDescendantOf(candidateChildNode, ch)) return true;
    }
    return false;
  }

  function findNodeAndParentById(treeArray, targetId, parentNode) {
    if (!Array.isArray(treeArray)) return null;
    for (var i = 0; i < treeArray.length; i++) {
      var n = treeArray[i];
      if (n.id === targetId) {
        return {
          node: n,
          parentArray: treeArray,
          index: i,
          parentNode: parentNode || null
        };
      }
      if (n.children && n.children.length > 0) {
        var found = findNodeAndParentById(n.children, targetId, n);
        if (found) return found;
      }
    }
    return null;
  }

  // Dropdown Customizado Neo-Brutalista (Inspirado em neobrutalism.dev/docs/select)
  function setupNeoSelect(selectEl) {
    if (!selectEl) return;
    if (selectEl.__neoSelect) {
      selectEl.__neoSelect.update();
      return;
    }

    // Se já estiver dentro de um wrapper antigo ou órfão, desenrola e remove elementos mortos
    var existingWrapper = selectEl.closest ? selectEl.closest(".tf-select-wrapper") : null;
    if (existingWrapper) {
      var deadElements = existingWrapper.querySelectorAll(".tf-select-trigger, .tf-select-menu");
      for (var d = 0; d < deadElements.length; d++) {
        if (deadElements[d].parentNode) {
          deadElements[d].parentNode.removeChild(deadElements[d]);
        }
      }
      var parentEl = existingWrapper.parentNode;
      if (parentEl) {
        parentEl.insertBefore(selectEl, existingWrapper);
        parentEl.removeChild(existingWrapper);
      }
      selectEl.style.display = "";
    }

    var wrapper = document.createElement("div");
    wrapper.className = "tf-select-wrapper";
    selectEl.parentNode.insertBefore(wrapper, selectEl);
    wrapper.appendChild(selectEl);

    selectEl.style.display = "none";

    var trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "tf-select-trigger";
    trigger.setAttribute("data-tf-design", "editor-preset-trigger");
    trigger.title = selectEl.title || "Selecionar Preset";
    trigger.innerHTML =
      '<span class="tf-select-value"></span>' +
      '<svg class="tf-select-chevron" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M4 6l4 4 4-4"/>' +
      '</svg>';

    var menu = document.createElement("div");
    menu.className = "tf-select-menu";

    wrapper.appendChild(trigger);
    wrapper.appendChild(menu);

    function updateFromSelect() {
      if (selectEl.selectedIndex < 0 && selectEl.options.length > 0) {
        selectEl.selectedIndex = 0;
      }
      var selectedOpt = selectEl.options[selectEl.selectedIndex];
      var valSpan = trigger.querySelector(".tf-select-value");
      if (valSpan) {
        valSpan.textContent = selectedOpt ? selectedOpt.textContent : "";
      }
      trigger.disabled = !!selectEl.disabled;

      menu.innerHTML = "";
      for (var i = 0; i < selectEl.options.length; i++) {
        (function (opt) {
          var item = document.createElement("div");
          item.className = "tf-select-item" + (opt.selected ? " is-selected" : "");
          item.setAttribute("data-tf-design", "editor-preset-option");

          var labelSpan = document.createElement("span");
          labelSpan.textContent = opt.textContent;
          item.appendChild(labelSpan);

          if (opt.selected) {
            var checkSpan = document.createElement("span");
            checkSpan.className = "tf-select-item-check";
            checkSpan.textContent = "✓";
            item.appendChild(checkSpan);
          }

          item.addEventListener("click", function (e) {
            e.stopPropagation();
            closeMenu();
            if (selectEl.value !== opt.value) {
              selectEl.value = opt.value;
              var changeEv;
              if (typeof Event === "function") {
                changeEv = new Event("change", { bubbles: true });
              } else {
                changeEv = document.createEvent("Event");
                changeEv.initEvent("change", true, true);
              }
              selectEl.dispatchEvent(changeEv);
            }
            updateFromSelect();
          });
          menu.appendChild(item);
        })(selectEl.options[i]);
      }
    }

    function openMenu() {
      if (selectEl.disabled) return;
      var allOpen = document.querySelectorAll(".tf-select-menu.is-open");
      for (var j = 0; j < allOpen.length; j++) {
        allOpen[j].classList.remove("is-open");
      }
      var allTriggers = document.querySelectorAll(".tf-select-trigger.is-open");
      for (var k = 0; k < allTriggers.length; k++) {
        allTriggers[k].classList.remove("is-open");
      }
      menu.classList.add("is-open");
      trigger.classList.add("is-open");
    }

    function closeMenu() {
      menu.classList.remove("is-open");
      trigger.classList.remove("is-open");
    }

    trigger.addEventListener("click", function (e) {
      e.stopPropagation();
      if (selectEl.disabled) return;
      if (menu.classList.contains("is-open")) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    document.addEventListener("click", function (e) {
      if (!wrapper.contains(e.target)) {
        closeMenu();
      }
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" || e.keyCode === 27) {
        closeMenu();
      }
    });

    if (typeof MutationObserver !== "undefined") {
      var observer = new MutationObserver(function () {
        updateFromSelect();
      });
      observer.observe(selectEl, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"] });
    }

    updateFromSelect();
    selectEl.__neoSelect = { update: updateFromSelect, close: closeMenu };
  }

  function refreshPresetSelectDropdown(selectedName) {
    var list = presetManager.listPresets();
    presetSelect.innerHTML = "";
    for (var i = 0; i < list.length; i++) {
      var opt = document.createElement("option");
      opt.value = list[i].presetName;
      opt.textContent = list[i].presetName + (list[i].isBuiltIn ? " (Default)" : "");
      if (list[i].presetName === selectedName) {
        opt.selected = true;
      }
      presetSelect.appendChild(opt);
    }
    setupNeoSelect(presetSelect);
  }

  function loadSelectedPresetIntoEditor(presetName) {
    currentPreset = presetManager.loadPreset(presetName);
    refreshPresetSelectDropdown(currentPreset.presetName);

    var isDefault = (currentPreset.presetName === PresetManager.DEFAULT_PRESET_NAME || currentPreset.isBuiltIn);
    if (badgeBuiltIn) {
      badgeBuiltIn.style.display = isDefault ? "inline-block" : "none";
    }
    if (btnDeletePreset) {
      btnDeletePreset.disabled = isDefault;
    }

    chkUsePrefixNumbering.checked = Boolean(currentPreset.settings.usePrefixNumbering);
    if (chkSeparateAudioCategories) {
      chkSeparateAudioCategories.checked = (currentPreset.settings.separateAudioCategories !== false);
    }
    if (chkNumberAudioCategories) {
      chkNumberAudioCategories.checked = (currentPreset.settings.numberAudioCategories !== false);
    }
    syncGroupBySourceToggleState();
    syncAudioSubToggleState();

    setDirty(false);
    renderTree();
  }

  // Coleta as extensões padrão dos pacotes correspondentes às categorias marcadas
  function collectStandardPackExtsForTypes(typesArray, includeBothHosts) {
    var types = Array.isArray(typesArray) ? typesArray : [];
    var dicts = includeBothHosts
      ? [PresetManager.DEFAULT_EXTENSIONS_AE, PresetManager.DEFAULT_EXTENSIONS_PPRO]
      : [activeDefaultExtensions];
    var result = [];
    var seen = {};

    function addPack(packName) {
      for (var d = 0; d < dicts.length; d++) {
        var dict = dicts[d];
        var list = (dict && dict[packName]) || [];
        for (var i = 0; i < list.length; i++) {
          var ext = String(list[i]).toLowerCase();
          if (ext && !seen[ext]) {
            seen[ext] = true;
            result.push(ext);
          }
        }
      }
    }

    if (types.indexOf("StillImages") !== -1) addPack("Images");
    if (types.indexOf("Videos") !== -1 || types.indexOf("ImageSequences") !== -1) {
      addPack("Videos");
      addPack("ImageSequences");
    }
    if (types.indexOf("Audios") !== -1) addPack("Audios");
    if (types.indexOf("DataFiles") !== -1) addPack("DataFiles");

    return { list: result, map: seen };
  }

  // Extrai apenas as tags de formatos específicos/avulsos configuradas na pasta
  function extractCustomExtsFromRules(rules) {
    if (!rules) return [];
    if (Array.isArray(rules.customExtensions)) {
      return rules.customExtensions.slice();
    }
    var rawExts = Array.isArray(rules.extensions) ? rules.extensions : [];
    if (rawExts.length === 0) return [];

    var std = collectStandardPackExtsForTypes(rules.types, true);
    var custom = [];
    for (var i = 0; i < rawExts.length; i++) {
      var ext = String(rawExts[i] || "").trim().replace(/^\.+/, "").toLowerCase();
      if (ext && !std.map[ext] && custom.indexOf(ext) === -1) {
        custom.push(ext);
      }
    }
    return custom;
  }

  // Renderiza o resumo de regras em pílulas visuais para cada pasta da árvore
  function buildRuleSummaryElements(node) {
    var rules = (node && node.rules) || {};
    var pills = [];

    var typeLabels = {
      MainComp: isPPro ? "Seq. Principal" : "Comp Principal",
      PreComps: isPPro ? "Nested Seqs" : "Pre-Comps",
      StillImages: "Images",
      Videos: "Footages",
      ImageSequences: "Footages",
      Audios: "Audios",
      Solids: isPPro ? "Sintéticos/Solids" : "Solids",
      DataFiles: isPPro ? "Data/MOGRT" : "Data/3D"
    };

    var types = Array.isArray(rules.types) ? rules.types : [];
    var seenPillLabels = {};
    for (var i = 0; i < types.length; i++) {
      var label = typeLabels[types[i]] || types[i];
      if (!seenPillLabels[label]) {
        seenPillLabels[label] = true;
        pills.push({ text: label, cls: "" });
      }
    }

    if (rules.groupByMainComp && types.indexOf("PreComps") !== -1) {
      pills.push({ text: "Agrupar por MainComp", cls: "pill-ext" });
    }
    if (rules.handlePsdBundles) {
      pills.push({ text: "Bundles PSD/AI", cls: "pill-ext" });
    }
    if (rules.groupSubfoldersByExt) {
      pills.push({ text: "Subpastas: EXT", cls: "pill-ext" });
    }
    if (rules.groupBySourceFolder) {
      pills.push({ text: "Pasta Origem", cls: "pill-ext" });
    }

    var customExts = extractCustomExtsFromRules(rules);
    if (customExts.length > 0) {
      var preview = customExts.slice(0, 4).map(function (e) { return "." + e; }).join(", ");
      if (customExts.length > 4) {
        preview += " +" + (customExts.length - 4);
      }
      pills.push({ text: preview, cls: "pill-ext" });
    }

    if (rules.catchOthers) {
      pills.push({ text: "Fallback: OTHERS", cls: "pill-fallback" });
    }

    if (rules.nameFilter && String(rules.nameFilter).trim() !== "") {
      var prefix = rules.nameFilterMode === "regex" ? "Regex: " : "Nome: ";
      pills.push({ text: prefix + rules.nameFilter, cls: "pill-name" });
    }

    return pills;
  }

  function renderTree() {
    treeRootList.innerHTML = "";
    if (!currentPreset || !Array.isArray(currentPreset.tree)) return;

    var usePrefix = Boolean(currentPreset.settings.usePrefixNumbering);

    function createNodesDom(nodesArray, containerUl) {
      // Pré-calcular sequência apenas entre os nós que possuem useNumbering !== false
      var seqCounter = 0;
      var nodeSeqMap = {};
      for (var s = 0; s < nodesArray.length; s++) {
        if (nodesArray[s].useNumbering !== false) {
          seqCounter++;
          nodeSeqMap[nodesArray[s].id] = seqCounter;
        }
      }

      for (var i = 0; i < nodesArray.length; i++) {
        (function (node, idx, siblings) {
          var li = document.createElement("li");

          var row = document.createElement("div");
          row.className = "tree-row";
          row.setAttribute("data-tf-design", "folder-row");
          row.setAttribute("data-node-id", node.id);

          // 0. Alça de Arraste (Drag Handle)
          var dragHandle = document.createElement("span");
          dragHandle.className = "drag-handle";
          dragHandle.setAttribute("data-tf-design", "folder-drag-handle");
          dragHandle.textContent = "⋮⋮";
          dragHandle.title = "Clique e arraste para reordenar ou mover esta pasta";
          dragHandle.setAttribute("draggable", "true");

          dragHandle.addEventListener("dragstart", function (ev) {
            draggedNodeId = node.id;
            row.classList.add("dragging");
            if (ev.dataTransfer) {
              ev.dataTransfer.effectAllowed = "move";
              ev.dataTransfer.setData("text/plain", node.id);
            }
          });

          dragHandle.addEventListener("dragend", function () {
            draggedNodeId = null;
            row.classList.remove("dragging");
            clearAllDragOverIndicators();
          });

          row.appendChild(dragHandle);

          // Listeners de Drop no Container da Linha (row)
          row.addEventListener("dragover", function (ev) {
            if (!draggedNodeId || draggedNodeId === node.id) return;
            var draggedInfo = findNodeAndParentById(currentPreset.tree, draggedNodeId);
            if (!draggedInfo) return;

            // Evitar soltar nó pai dentro de si mesmo ou seus próprios filhos
            if (isDescendantOf(node, draggedInfo.node)) return;

            ev.preventDefault();
            if (ev.dataTransfer) {
              ev.dataTransfer.dropEffect = "move";
            }

            var rect = row.getBoundingClientRect();
            var relY = ev.clientY - rect.top;
            var height = rect.height;

            clearAllDragOverIndicators();

            // Zonas de Drop: 25% Superior = Antes, 50% Centro = Dentro da pasta, 25% Inferior = Depois
            if (relY < height * 0.25) {
              row.classList.add("drag-over-before");
            } else if (relY > height * 0.75) {
              row.classList.add("drag-over-after");
            } else {
              row.classList.add("drag-over-inside");
            }
          });

          row.addEventListener("dragleave", function (ev) {
            // Só limpa se o ponteiro realmente saiu dos limites deste elemento
            var rect = row.getBoundingClientRect();
            if (
              ev.clientX < rect.left ||
              ev.clientX >= rect.right ||
              ev.clientY < rect.top ||
              ev.clientY >= rect.bottom
            ) {
              row.classList.remove("drag-over-before", "drag-over-after", "drag-over-inside");
            }
          });

          row.addEventListener("drop", function (ev) {
            ev.preventDefault();
            ev.stopPropagation();

            if (!draggedNodeId || draggedNodeId === node.id) {
              clearAllDragOverIndicators();
              return;
            }

            var draggedInfo = findNodeAndParentById(currentPreset.tree, draggedNodeId);
            if (!draggedInfo) {
              clearAllDragOverIndicators();
              return;
            }

            if (isDescendantOf(node, draggedInfo.node)) {
              setStatus("Não é possível mover uma pasta para dentro de suas próprias subpastas.", "warning");
              clearAllDragOverIndicators();
              return;
            }

            var rect = row.getBoundingClientRect();
            var relY = ev.clientY - rect.top;
            var height = rect.height;
            var dropMode = "inside";
            if (relY < height * 0.25) {
              dropMode = "before";
            } else if (relY > height * 0.75) {
              dropMode = "after";
            }

            clearAllDragOverIndicators();

            // 1. Remover o item da sua localização de origem
            draggedInfo.parentArray.splice(draggedInfo.index, 1);

            // 2. Inserir na nova posição conforme dropMode
            if (dropMode === "inside") {
              if (!Array.isArray(node.children)) {
                node.children = [];
              }
              node.children.push(draggedInfo.node);
              collapsedNodeIds[node.id] = false; // expandir para ver o item solto
              setStatus("Pasta '" + draggedInfo.node.name + "' movida para dentro de '" + node.name + "'.", "success");
            } else {
              // Localizar o novo índice do nó destino (caso a remoção tenha afetado a mesma lista de irmãos)
              var targetIdx = siblings.indexOf(node);
              if (targetIdx === -1) targetIdx = idx;

              if (dropMode === "before") {
                siblings.splice(targetIdx, 0, draggedInfo.node);
                setStatus("Pasta '" + draggedInfo.node.name + "' reposicionada antes de '" + node.name + "'.", "success");
              } else {
                siblings.splice(targetIdx + 1, 0, draggedInfo.node);
                setStatus("Pasta '" + draggedInfo.node.name + "' reposicionada depois de '" + node.name + "'.", "success");
              }
            }

            draggedNodeId = null;
            setDirty(true);
            renderTree();
          });

          // 1. Botão Expandir / Recolher
          var hasChildren = Array.isArray(node.children) && node.children.length > 0;
          var isCollapsed = Boolean(collapsedNodeIds[node.id]);
          var collapseBtn = document.createElement("button");
          collapseBtn.type = "button";
          collapseBtn.setAttribute("data-tf-design", "folder-collapse");
          collapseBtn.className = "collapse-btn" + (hasChildren ? "" : " empty");
          collapseBtn.textContent = isCollapsed ? "▸" : "▾";
          collapseBtn.title = isCollapsed ? "Expandir subpastas" : "Recolher subpastas";
          collapseBtn.addEventListener("click", function () {
            collapsedNodeIds[node.id] = !collapsedNodeIds[node.id];
            renderTree();
          });
          row.appendChild(collapseBtn);

          // 2. Seletor de Color Label do Host (0 a 16)
          var labelInfo = presetManager.getLabelInfo(node.label);
          var swatchBtn = document.createElement("button");
          swatchBtn.type = "button";
          swatchBtn.setAttribute("data-tf-design", "folder-label-swatch");
          swatchBtn.className = "label-swatch-btn";
          swatchBtn.style.backgroundColor = labelInfo.color;
          swatchBtn.title = "Cor no " + hostAppName + ": " + labelInfo.ptName;
          swatchBtn.addEventListener("click", function (ev) {
            ev.stopPropagation();
            openColorLabelPopover(node.id, swatchBtn);
          });
          row.appendChild(swatchBtn);

          // 3. Badge e Controle de Numeração Individual (01_ / OFF)
          var isNodeNumbered = (node.useNumbering !== false);
          var isPrefixActive = Boolean(isNodeNumbered && usePrefix);
          var prefixBadge = document.createElement("button");
          prefixBadge.type = "button";
          prefixBadge.setAttribute("data-tf-design", isPrefixActive ? "folder-prefix" : "folder-prefix-off");
          prefixBadge.className = "prefix-preview" + (isPrefixActive ? "" : " prefix-off");

          if (isNodeNumbered) {
            var mySeq = nodeSeqMap[node.id] || (idx + 1);
            var numStr = mySeq < 10 ? "0" + mySeq : String(mySeq);
            prefixBadge.textContent = usePrefix ? (numStr + "_") : "OFF";
            prefixBadge.title = "Numeração: ATIVADA para esta pasta (" + (usePrefix ? numStr + "_" : "01_") + "). Clique para desativar a numeração desta pasta.";
          } else {
            prefixBadge.textContent = "OFF";
            prefixBadge.title = "Numeração: DESATIVADA para esta pasta (nome puro, sem prefixo). Clique para ativar a numeração.";
          }

          prefixBadge.addEventListener("click", function (ev) {
            ev.stopPropagation();
            node.useNumbering = !isNodeNumbered;
            setDirty(true);
            renderTree();
          });
          row.appendChild(prefixBadge);

          // 4. Input do Nome da Pasta
          var nameInput = document.createElement("input");
          nameInput.type = "text";
          nameInput.setAttribute("data-tf-design", "folder-name-input");
          nameInput.className = "folder-name-input";
          nameInput.value = node.name || "";
          nameInput.placeholder = "Nome da pasta";
          nameInput.addEventListener("input", function () {
            node.name = nameInput.value;
            setDirty(true);
          });
          row.appendChild(nameInput);

          // 5. Botão / Área de Regras e Filtros
          var rulesBtn = document.createElement("button");
          rulesBtn.type = "button";
          rulesBtn.setAttribute("data-tf-design", "folder-rules-summary");
          rulesBtn.className = "rules-summary-btn";
          rulesBtn.title = "Clique para configurar tipos de arquivo, extensões e filtros desta pasta";

          var pills = buildRuleSummaryElements(node);
          if (pills.length === 0) {
            var emptyHint = document.createElement("span");
            emptyHint.className = "rule-empty-hint";
            emptyHint.setAttribute("data-tf-design", "folder-rules-empty");
            emptyHint.textContent = hasChildren
              ? "Pasta contêiner (clique p/ adicionar regras)"
              : "Sem regras (clique p/ configurar filtros)";
            rulesBtn.appendChild(emptyHint);
          } else {
            for (var p = 0; p < pills.length; p++) {
              var pillEl = document.createElement("span");
              pillEl.className = "rule-pill " + (pills[p].cls || "");
              pillEl.textContent = pills[p].text;
              pillEl.setAttribute("data-tf-design", "tag-" + encodeURIComponent(pills[p].text));
              rulesBtn.appendChild(pillEl);
            }
          }

          rulesBtn.addEventListener("click", function () {
            openRulesModalForNode(node.id);
          });
          row.appendChild(rulesBtn);

          // 6. Controles em linha: Subir, Descer, + Subpasta, - Remover
          var actionsDiv = document.createElement("div");
          actionsDiv.className = "row-actions";

          var btnUp = document.createElement("button");
          btnUp.type = "button";
          btnUp.className = "tf-btn tf-btn--ghost tf-btn--mini row-btn";
          btnUp.setAttribute("data-tf-design", "folder-up");
          btnUp.textContent = "↑";
          btnUp.title = "Mover pasta para cima";
          btnUp.disabled = (idx === 0);
          btnUp.addEventListener("click", function () {
            if (idx > 0) {
              var temp = siblings[idx - 1];
              siblings[idx - 1] = siblings[idx];
              siblings[idx] = temp;
              setDirty(true);
              renderTree();
            }
          });
          actionsDiv.appendChild(btnUp);

          var btnDown = document.createElement("button");
          btnDown.type = "button";
          btnDown.className = "tf-btn tf-btn--ghost tf-btn--mini row-btn";
          btnDown.setAttribute("data-tf-design", "folder-down");
          btnDown.textContent = "↓";
          btnDown.title = "Mover pasta para baixo";
          btnDown.disabled = (idx === siblings.length - 1);
          btnDown.addEventListener("click", function () {
            if (idx < siblings.length - 1) {
              var temp = siblings[idx + 1];
              siblings[idx + 1] = siblings[idx];
              siblings[idx] = temp;
              setDirty(true);
              renderTree();
            }
          });
          actionsDiv.appendChild(btnDown);

          var btnAddChild = document.createElement("button");
          btnAddChild.type = "button";
          btnAddChild.className = "tf-btn tf-btn--ghost tf-btn--mini row-btn add-child";
          btnAddChild.setAttribute("data-tf-design", "folder-add");
          btnAddChild.textContent = "+";
          btnAddChild.title = "Adicionar subpasta filha dentro de '" + node.name + "'";
          btnAddChild.addEventListener("click", function () {
            if (!Array.isArray(node.children)) {
              node.children = [];
            }
            var newChild = presetManager.createEmptyNode("Subpasta", node.label || 0);
            node.children.push(newChild);
            collapsedNodeIds[node.id] = false;
            setDirty(true);
            renderTree();
            setStatus("Subpasta adicionada dentro de '" + node.name + "'.", "success");
          });
          actionsDiv.appendChild(btnAddChild);

          var btnRemove = document.createElement("button");
          btnRemove.type = "button";
          btnRemove.className = "tf-btn tf-btn--ghost tf-btn--mini row-btn remove-node";
          btnRemove.setAttribute("data-tf-design", "folder-remove");
          btnRemove.textContent = "−";
          btnRemove.title = "Remover pasta '" + node.name + "'";
          btnRemove.addEventListener("click", function () {
            var childCount = (node.children && node.children.length) ? node.children.length : 0;
            var msg = childCount > 0
              ? "Deseja remover a pasta '" + node.name + "' e suas " + childCount + " subpasta(s)?"
              : "Deseja remover a pasta '" + node.name + "' da estrutura?";
            openConfirmModal("Remover Pasta", msg, function () {
              siblings.splice(idx, 1);
              setDirty(true);
              renderTree();
              setStatus("Pasta '" + node.name + "' removida.", "warning");
            });
          });
          actionsDiv.appendChild(btnRemove);

          row.appendChild(actionsDiv);
          li.appendChild(row);

          // Renderizar subpastas recursivamente
          if (hasChildren && !isCollapsed) {
            var childUl = document.createElement("ul");
            childUl.className = "tree-children";
            createNodesDom(node.children, childUl);
            li.appendChild(childUl);
          }

          containerUl.appendChild(li);
        })(nodesArray[i], i, nodesArray);
      }
    }

    createNodesDom(currentPreset.tree, treeRootList);

    // Suporte para soltar pasta na área vazia da árvore (torna-se pasta raiz ao final)
    treeRootList.ondragover = function (ev) {
      if (!draggedNodeId) return;
      if (ev.target === treeRootList || ev.target.classList.contains("tree-scroll-area")) {
        ev.preventDefault();
        if (ev.dataTransfer) ev.dataTransfer.dropEffect = "move";
      }
    };

    treeRootList.ondrop = function (ev) {
      if (!draggedNodeId) return;
      if (ev.target === treeRootList || ev.target.classList.contains("tree-scroll-area")) {
        ev.preventDefault();
        var draggedInfo = findNodeAndParentById(currentPreset.tree, draggedNodeId);
        if (draggedInfo) {
          draggedInfo.parentArray.splice(draggedInfo.index, 1);
          currentPreset.tree.push(draggedInfo.node);
          clearAllDragOverIndicators();
          draggedNodeId = null;
          setDirty(true);
          renderTree();
          setStatus("Pasta movida para o nível raiz.", "success");
        }
      }
    };
  }

  // Popover de Seleção de Color Label (16 cores do AE + None)
  function openColorLabelPopover(nodeId, anchorEl) {
    activeColorPopoverNodeId = nodeId;
    var found = findNodeAndParentById(currentPreset.tree, nodeId);
    if (!found) return;

    labelPopover.innerHTML = "";
    var labels = presetManager.getLabelsList();
    for (var i = 0; i < labels.length; i++) {
      (function (lbl) {
        var item = document.createElement("div");
        item.className = "label-option" + (found.node.label === lbl.index ? " active" : "");

        var dot = document.createElement("span");
        dot.className = "label-option-dot";
        dot.style.backgroundColor = lbl.color;

        var txt = document.createElement("span");
        txt.textContent = lbl.ptName;

        item.appendChild(dot);
        item.appendChild(txt);

        item.addEventListener("click", function (ev) {
          ev.stopPropagation();
          found.node.label = lbl.index;
          closeColorLabelPopover();
          setDirty(true);
          renderTree();
        });

        labelPopover.appendChild(item);
      })(labels[i]);
    }

    labelPopover.style.display = "block";
    var rect = anchorEl.getBoundingClientRect();
    var popHeight = 290;
    var topPos = rect.bottom + 4;
    if (topPos + popHeight > window.innerHeight) {
      topPos = Math.max(8, rect.top - popHeight - 4);
    }
    var leftPos = Math.min(rect.left, window.innerWidth - 205);
    labelPopover.style.top = topPos + "px";
    labelPopover.style.left = Math.max(8, leftPos) + "px";
  }

  function closeColorLabelPopover() {
    labelPopover.style.display = "none";
    activeColorPopoverNodeId = null;
  }

  document.addEventListener("click", function () {
    closeColorLabelPopover();
  });

  // Sincronização visual dos tiles de regra: a classe .active alimenta o componente
  // .tf-toggle (theme.css), compartilhado com os toggles do painel principal.
  var allRuleToggleLabels = document.querySelectorAll(".rule-toggle-btn");

  function syncAllRuleToggleButtons() {
    for (var i = 0; i < allRuleToggleLabels.length; i++) {
      var lbl = allRuleToggleLabels[i];
      var chk = lbl.querySelector('input[type="checkbox"]');
      if (chk) {
        lbl.classList.toggle("active", Boolean(chk.checked));
      }
    }
  }

  for (var tIdx = 0; tIdx < allRuleToggleLabels.length; tIdx++) {
    (function (lbl) {
      var chk = lbl.querySelector('input[type="checkbox"]');
      if (chk) {
        chk.addEventListener("change", function () {
          lbl.classList.toggle("active", Boolean(chk.checked));
        });
      }
    })(allRuleToggleLabels[tIdx]);
  }

  // Tooltip de informação ao deixar o mouse sobre os botões de regra
  var tooltipHoverTimer = null;

  function hideRuleTooltip() {
    if (tooltipHoverTimer) {
      clearTimeout(tooltipHoverTimer);
      tooltipHoverTimer = null;
    }
    if (ruleInfoTooltip) {
      ruleInfoTooltip.style.display = "none";
    }
  }

  function showTooltipForElement(targetEl) {
    var text = targetEl.getAttribute("data-tooltip");
    if (!text || !ruleInfoTooltip) return;
    ruleInfoTooltip.textContent = text;
    ruleInfoTooltip.style.display = "block";

    var rect = targetEl.getBoundingClientRect();
    var tipRect = ruleInfoTooltip.getBoundingClientRect();
    var topPos = rect.top - tipRect.height - 6;
    if (topPos < 8) {
      topPos = rect.bottom + 6;
    }
    var leftPos = rect.left + rect.width / 2 - tipRect.width / 2;
    if (leftPos + tipRect.width > window.innerWidth - 10) {
      leftPos = window.innerWidth - tipRect.width - 10;
    }
    if (leftPos < 10) {
      leftPos = 10;
    }
    ruleInfoTooltip.style.top = Math.round(topPos) + "px";
    ruleInfoTooltip.style.left = Math.round(leftPos) + "px";
  }

  for (var infIdx = 0; infIdx < allRuleToggleLabels.length; infIdx++) {
    (function (tileEl) {
      tileEl.addEventListener("mouseenter", function () {
        if (tooltipHoverTimer) clearTimeout(tooltipHoverTimer);
        tooltipHoverTimer = setTimeout(function () {
          showTooltipForElement(tileEl);
        }, 220);
      });
      tileEl.addEventListener("mouseleave", hideRuleTooltip);
    })(allRuleToggleLabels[infIdx]);
  }

  // Modal de Regras e Filtros V2 — Caixa Inline de Formatos Específicos (Seção 1)
  function updateClearExtsButtonVisibility() {
    if (btnClearAllExts) {
      btnClearAllExts.style.display = modalCustomExts.length > 0 ? "inline-flex" : "none";
    }
  }

  function renderModalCustomExts() {
    if (!extChipsList) return;
    extChipsList.innerHTML = "";
    updateClearExtsButtonVisibility();

    if (inpNewExtension) {
      inpNewExtension.placeholder = modalCustomExts.length === 0 ? "Avulsa: exr, webp..." : "";
    }

    for (var i = 0; i < modalCustomExts.length; i++) {
      (function (ext, idx) {
        var tag = document.createElement("span");
        tag.className = "ext-tag";

        var label = document.createElement("span");
        label.textContent = "." + ext;

        var btnRem = document.createElement("button");
        btnRem.type = "button";
        btnRem.textContent = "×";
        btnRem.title = "Remover formato '." + ext + "'";
        btnRem.addEventListener("click", function (ev) {
          ev.stopPropagation();
          modalCustomExts.splice(idx, 1);
          renderModalCustomExts();
        });

        tag.appendChild(label);
        tag.appendChild(btnRem);
        extChipsList.appendChild(tag);
      })(modalCustomExts[i], i);
    }
  }

  function addCustomExtensionsFromString(rawStr) {
    if (!rawStr) return;
    var parts = String(rawStr).split(/[\s,;]+/);
    var changed = false;
    for (var i = 0; i < parts.length; i++) {
      var clean = parts[i].trim().replace(/^\.+/, "").toLowerCase();
      if (clean && modalCustomExts.indexOf(clean) === -1) {
        modalCustomExts.push(clean);
        changed = true;
      }
    }
    if (changed) {
      renderModalCustomExts();
    }
  }

  if (extTagsContainer && inpNewExtension) {
    extTagsContainer.addEventListener("click", function (ev) {
      if (ev.target && ev.target.tagName === "BUTTON") return;
      inpNewExtension.focus();
    });
  }

  // Modal de Regras e Filtros — Tags de Nomenclatura
  function renderModalNameTags() {
    if (!nameTagsContainer) return;
    nameTagsContainer.innerHTML = "";
    if (btnClearAllNameTags) {
      btnClearAllNameTags.style.display = modalWorkingNameTags.length > 0 ? "inline-flex" : "none";
    }

    if (modalWorkingNameTags.length === 0) {
      var emptyMsg = document.createElement("span");
      emptyMsg.className = "rule-empty-hint";
      emptyMsg.textContent = "Nenhuma palavra filtrada.";
      nameTagsContainer.appendChild(emptyMsg);
      return;
    }

    for (var i = 0; i < modalWorkingNameTags.length; i++) {
      (function (word, idx) {
        var tag = document.createElement("span");
        tag.className = "ext-tag";

        var label = document.createElement("span");
        label.textContent = word;

        var btnRem = document.createElement("button");
        btnRem.type = "button";
        btnRem.textContent = "×";
        btnRem.title = "Remover palavra '" + word + "'";
        btnRem.addEventListener("click", function () {
          modalWorkingNameTags.splice(idx, 1);
          renderModalNameTags();
        });

        tag.appendChild(label);
        tag.appendChild(btnRem);
        nameTagsContainer.appendChild(tag);
      })(modalWorkingNameTags[i], i);
    }
  }

  function addNameTagsFromInputString(rawStr) {
    if (!rawStr) return;
    var parts = String(rawStr).split(/[,;]+/);
    for (var i = 0; i < parts.length; i++) {
      var clean = parts[i].trim();
      if (!clean) continue;
      var exists = false;
      for (var j = 0; j < modalWorkingNameTags.length; j++) {
        if (modalWorkingNameTags[j].toLowerCase() === clean.toLowerCase()) {
          exists = true;
          break;
        }
      }
      if (!exists) {
        modalWorkingNameTags.push(clean);
      }
    }
    renderModalNameTags();
  }

  function openRulesModalForNode(nodeId) {
    var found = findNodeAndParentById(currentPreset.tree, nodeId);
    if (!found) return;
    editingRulesNodeId = nodeId;

    var node = found.node;
    var rules = node.rules || {};
    var lblInfo = presetManager.getLabelInfo(node.label);

    rulesModalSwatch.style.backgroundColor = lblInfo.color;
    rulesModalTitleText.textContent = "Regras e Filtros — Pasta: " + node.name;

    var activeTypes = Array.isArray(rules.types) ? rules.types : [];
    for (var i = 0; i < ruleTypeCheckboxes.length; i++) {
      var chk = ruleTypeCheckboxes[i];
      if (chk.value === "Videos") {
        // "Vídeos / Footages" unifica Videos + ImageSequences
        chk.checked = (activeTypes.indexOf("Videos") !== -1 || activeTypes.indexOf("ImageSequences") !== -1);
      } else {
        chk.checked = (activeTypes.indexOf(chk.value) !== -1);
      }
    }

    chkRuleGroupExt.checked = Boolean(rules.groupSubfoldersByExt);
    if (chkRuleGroupBySourceFolder) {
      chkRuleGroupBySourceFolder.checked = (rules.groupBySourceFolder !== undefined) ? Boolean(rules.groupBySourceFolder) : true;
    }
    chkRuleGroupByMainComp.checked = Boolean(rules.groupByMainComp);
    chkRulePsdBundles.checked = Boolean(rules.handlePsdBundles);
    chkRuleCatchOthers.checked = Boolean(rules.catchOthers);

    syncAllRuleToggleButtons();

    modalCustomExts = extractCustomExtsFromRules(rules);
    renderModalCustomExts();

    modalWorkingNameTags = [];
    if (rules.nameFilter && String(rules.nameFilter).trim() !== "") {
      addNameTagsFromInputString(String(rules.nameFilter));
    } else {
      renderModalNameTags();
    }

    if (inpNewExtension) inpNewExtension.value = "";
    if (inpNewNameTag) inpNewNameTag.value = "";

    rulesModalBackdrop.classList.add("open");
  }

  function closeRulesModal() {
    hideRuleTooltip();
    rulesModalBackdrop.classList.remove("open");
    editingRulesNodeId = null;
  }

  btnCloseRulesModalX.addEventListener("click", closeRulesModal);
  btnCancelRulesModal.addEventListener("click", closeRulesModal);

  if (inpNewExtension) {
    inpNewExtension.addEventListener("keydown", function (ev) {
      var isSpace = (ev.key === " " || ev.code === "Space" || ev.keyCode === 32);
      var isCommitKey = isSpace || ev.key === "Enter" || ev.key === "," || ev.key === ";";
      if (isCommitKey) {
        ev.preventDefault();
        if (inpNewExtension.value.trim() !== "") {
          addCustomExtensionsFromString(inpNewExtension.value);
        }
        inpNewExtension.value = "";
        return;
      }
      if (ev.key === "Backspace" && inpNewExtension.value === "" && modalCustomExts.length > 0) {
        ev.preventDefault();
        modalCustomExts.pop();
        renderModalCustomExts();
      }
    });

    inpNewExtension.addEventListener("input", function () {
      if (/[\s,;]$/.test(inpNewExtension.value)) {
        addCustomExtensionsFromString(inpNewExtension.value);
        inpNewExtension.value = "";
      }
    });
  }

  if (btnClearAllExts) {
    btnClearAllExts.addEventListener("click", function () {
      modalCustomExts = [];
      renderModalCustomExts();
    });
  }

  if (btnAddNameTag) {
    btnAddNameTag.addEventListener("click", function () {
      addNameTagsFromInputString(inpNewNameTag.value);
      inpNewNameTag.value = "";
      inpNewNameTag.focus();
    });
  }

  if (inpNewNameTag) {
    inpNewNameTag.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") {
        ev.preventDefault();
        addNameTagsFromInputString(inpNewNameTag.value);
        inpNewNameTag.value = "";
      }
    });
  }

  if (btnClearAllNameTags) {
    btnClearAllNameTags.addEventListener("click", function () {
      modalWorkingNameTags = [];
      renderModalNameTags();
    });
  }

  btnApplyRulesModal.addEventListener("click", function () {
    if (!editingRulesNodeId) return;
    var found = findNodeAndParentById(currentPreset.tree, editingRulesNodeId);
    if (!found) return;

    // Se o usuário digitou um formato específico e não apertou Espaço/Enter, salva também
    if (inpNewExtension && inpNewExtension.value.trim() !== "") {
      addCustomExtensionsFromString(inpNewExtension.value);
      inpNewExtension.value = "";
    }

    // Se o usuário digitou algo no input de nome e não clicou em [+], adiciona também
    if (inpNewNameTag && inpNewNameTag.value.trim() !== "") {
      addNameTagsFromInputString(inpNewNameTag.value);
      inpNewNameTag.value = "";
    }

    var selectedTypes = [];
    for (var i = 0; i < ruleTypeCheckboxes.length; i++) {
      if (ruleTypeCheckboxes[i].checked) {
        var val = ruleTypeCheckboxes[i].value;
        selectedTypes.push(val);
        if (val === "Videos" && selectedTypes.indexOf("ImageSequences") === -1) {
          selectedTypes.push("ImageSequences");
        }
      }
    }

    var stdPack = collectStandardPackExtsForTypes(selectedTypes, false);
    var finalExtensions = stdPack.list.slice();
    for (var c = 0; c < modalCustomExts.length; c++) {
      if (finalExtensions.indexOf(modalCustomExts[c]) === -1) {
        finalExtensions.push(modalCustomExts[c]);
      }
    }

    found.node.rules = {
      types: selectedTypes,
      extensions: finalExtensions,
      customExtensions: modalCustomExts.slice(),
      groupSubfoldersByExt: chkRuleGroupExt.checked,
      groupBySourceFolder: chkRuleGroupBySourceFolder ? chkRuleGroupBySourceFolder.checked : true,
      groupByMainComp: chkRuleGroupByMainComp.checked,
      handlePsdBundles: chkRulePsdBundles.checked,
      catchOthers: chkRuleCatchOthers.checked,
      nameFilterMode: "contains",
      nameFilter: modalWorkingNameTags.join(", ")
    };

    closeRulesModal();
    syncGroupBySourceToggleState();
    setDirty(true);
    renderTree();
    setStatus("Regras aplicadas à pasta '" + found.node.name + "'.", "success");
  });

  // Modal de Confirmação
  function openConfirmModal(title, message, onConfirm) {
    confirmModalTitle.textContent = title || "Confirmar Ação";
    confirmModalMessage.textContent = message || "";
    pendingConfirmCallback = onConfirm;
    confirmModalBackdrop.classList.add("open");
  }

  function closeConfirmModal() {
    confirmModalBackdrop.classList.remove("open");
    pendingConfirmCallback = null;
  }

  btnCancelConfirm.addEventListener("click", closeConfirmModal);
  btnAcceptConfirm.addEventListener("click", function () {
    var cb = pendingConfirmCallback;
    closeConfirmModal();
    if (typeof cb === "function") cb();
  });

  // Modal Salvar Como Novo
  function openSaveAsModal(defaultSuggestedName) {
    inpSaveAsName.value = defaultSuggestedName || "";
    saveAsModalBackdrop.classList.add("open");
    setTimeout(function () {
      inpSaveAsName.focus();
      inpSaveAsName.select();
    }, 40);
  }

  function closeSaveAsModal() {
    saveAsModalBackdrop.classList.remove("open");
  }

  btnCancelSaveAs.addEventListener("click", function () {
    closeAfterSaveAs = false;
    closeSaveAsModal();
  });

  function executeSaveAs() {
    var newName = inpSaveAsName.value.trim();
    if (!newName) {
      setStatus("Digite um nome válido para o novo preset.", "warning");
      return;
    }
    if (newName.toLowerCase() === PresetManager.DEFAULT_PRESET_NAME.toLowerCase()) {
      setStatus("Escolha um nome diferente do preset padrão de fábrica.", "warning");
      return;
    }

    // Sobrescrever outro preset é destrutivo: confirma antes (AGENTS §4)
    var willOverwrite = false;
    if (currentPreset && newName.toLowerCase() !== String(currentPreset.presetName).toLowerCase()) {
      willOverwrite = presetManager.presetExists(newName);
    }
    if (willOverwrite) {
      openConfirmModal(
        "Sobrescrever preset",
        "Já existe um preset chamado '" + newName + "'. Deseja substituí-lo pelo conteúdo atual do editor?",
        function () {
          doSaveAs(newName);
        }
      );
      return;
    }

    doSaveAs(newName);
  }

  function doSaveAs(newName) {
    currentPreset.presetName = newName;
    currentPreset.isBuiltIn = false;
    currentPreset = presetManager.savePreset(currentPreset);
    if (reportSaveError()) return;
    closeSaveAsModal();
    loadSelectedPresetIntoEditor(currentPreset.presetName);
    setStatus("Novo preset '" + currentPreset.presetName + "' salvo com sucesso!", "success");
    reportSaveWarning();
    try {
      if (window.parent && window.parent !== window && typeof window.parent.onPresetBuilderUpdated === "function") {
        window.parent.onPresetBuilderUpdated(currentPreset.presetName);
      }
    } catch (eSync2) { }
    if (closeAfterSaveAs) {
      closeAfterSaveAs = false;
      closeEditorWindow();
    }
  }

  btnConfirmSaveAs.addEventListener("click", executeSaveAs);
  inpSaveAsName.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter") {
      ev.preventDefault();
      executeSaveAs();
    }
  });

  // Eventos da Barra Superior e Configurações
  presetSelect.addEventListener("change", function () {
    var targetName = presetSelect.value;

    var applySwitch = function () {
      presetManager.setActivePresetName(targetName);
      loadSelectedPresetIntoEditor(targetName);
      setStatus("Preset '" + targetName + "' carregado.", "");
    };

    if (isDirty) {
      // Não descartar edições não salvas em silêncio: o <select> volta a mostrar o
      // preset real e a troca só acontece se o usuário confirmar.
      if (currentPreset) presetSelect.value = currentPreset.presetName;
      openConfirmModal(
        "Alterações não salvas",
        "O preset '" + (currentPreset ? currentPreset.presetName : "") +
        "' tem alterações não salvas. Trocar de preset descarta essas alterações. Continuar?",
        applySwitch
      );
      return;
    }

    applySwitch();
  });

  chkUsePrefixNumbering.addEventListener("change", function () {
    if (!currentPreset) return;
    currentPreset.settings.usePrefixNumbering = chkUsePrefixNumbering.checked;
    renderTree();
    // NÃO gravar em disco aqui: o objeto em edição pode ter alterações não salvas
    // (árvore, regras, labels). Gravar neste ponto empurraria essas alterações para
    // o disco sem aviso. Marcamos como não salvo e deixamos o Salvar explícito.
    setDirty(true);
    setStatus("Numeração atualizada. Use Salvar para gravar no preset.", "");
  });

  if (chkGroupBySourceFolder) {
    chkGroupBySourceFolder.addEventListener("change", function () {
      if (!currentPreset) return;
      if (!currentPreset.settings) currentPreset.settings = {};
      var gv = chkGroupBySourceFolder.checked;
      currentPreset.settings.groupBySourceFolder = gv;
      (function applyAll(nodes) {
        for (var i = 0; i < (nodes || []).length; i++) {
          if (!nodes[i].rules) nodes[i].rules = {};
          nodes[i].rules.groupBySourceFolder = gv;
          applyAll(nodes[i].children);
        }
      })(currentPreset.tree);
      syncGroupBySourceToggleState();
      renderTree();
      setDirty(true);
      setStatus("Pasta de origem atualizada. Use Salvar para gravar no preset.", "");
    });
  }

  if (chkSeparateAudioCategories) {
    chkSeparateAudioCategories.addEventListener("change", function () {
      if (!currentPreset) return;
      if (!currentPreset.settings) currentPreset.settings = {};
      currentPreset.settings.separateAudioCategories = chkSeparateAudioCategories.checked;
      syncAudioSubToggleState();
      setDirty(true);
      setStatus("Categorização de áudio atualizada. Use Salvar para gravar no preset.", "");
    });
  }

  if (chkNumberAudioCategories) {
    chkNumberAudioCategories.addEventListener("change", function () {
      if (!currentPreset) return;
      if (!currentPreset.settings) currentPreset.settings = {};
      currentPreset.settings.numberAudioCategories = chkNumberAudioCategories.checked;
      setDirty(true);
      setStatus("Numeração das subpastas ESP atualizada. Use Salvar para gravar no preset.", "");
    });
  }

  btnAddTopFolder.addEventListener("click", function () {
    if (!currentPreset) return;
    var newNode = presetManager.createEmptyNode("Nova Pasta", 8);
    currentPreset.tree.push(newNode);
    setDirty(true);
    renderTree();
    setStatus("Nova pasta raiz adicionada.", "success");
  });

  // Salvar Preset Atual
  function saveCurrentPresetOrPromptNew(onSavedCallback) {
    if (!currentPreset) return;

    if (currentPreset.presetName === PresetManager.DEFAULT_PRESET_NAME || currentPreset.isBuiltIn) {
      // Se o usuário editou a estrutura do Default, oferecer salvar como novo preset para proteger o Default
      openSaveAsModal("Custom Clean");
      return;
    }

    currentPreset = presetManager.savePreset(currentPreset);
    if (reportSaveError()) {
      setDirty(true);
      return;
    }
    setDirty(false);
    refreshPresetSelectDropdown(currentPreset.presetName);
    setStatus("Preset '" + currentPreset.presetName + "' salvo em disco!", "success");
    reportSaveWarning();
    try {
      if (window.parent && window.parent !== window && typeof window.parent.onPresetBuilderUpdated === "function") {
        window.parent.onPresetBuilderUpdated(currentPreset.presetName);
      }
    } catch (eSync) { }
    if (typeof onSavedCallback === "function") {
      onSavedCallback();
    }
  }

  btnSaveAsPreset.addEventListener("click", function () {
    var baseSuggestion = (currentPreset && currentPreset.presetName !== PresetManager.DEFAULT_PRESET_NAME)
      ? currentPreset.presetName + " Copy"
      : "Motion Design";
    openSaveAsModal(baseSuggestion);
  });

  btnResetDefault.addEventListener("click", function () {
    openConfirmModal(
      "Restaurar Padrão de Fábrica",
      "Deseja restaurar e carregar o preset 'Default Clean' original de fábrica?",
      function () {
        var resetted = presetManager.resetDefaultPreset();
        presetManager.setActivePresetName(resetted.presetName);
        loadSelectedPresetIntoEditor(resetted.presetName);
        setStatus("Preset padrão de fábrica restaurado.", "success");
      }
    );
  });

  btnDeletePreset.addEventListener("click", function () {
    if (!currentPreset || currentPreset.presetName === PresetManager.DEFAULT_PRESET_NAME) {
      return;
    }
    var nameToDel = currentPreset.presetName;
    openConfirmModal(
      "Excluir Preset",
      "Tem certeza que deseja excluir permanentemente o preset '" + nameToDel + "'?",
      function () {
        try {
          presetManager.deletePreset(nameToDel);
          loadSelectedPresetIntoEditor(PresetManager.DEFAULT_PRESET_NAME);
          setStatus("Preset '" + nameToDel + "' excluído.", "warning");
          try {
            if (window.parent && window.parent !== window && typeof window.parent.onPresetBuilderUpdated === "function") {
              window.parent.onPresetBuilderUpdated(PresetManager.DEFAULT_PRESET_NAME);
            }
          } catch (eSync3) { }
        } catch (err) {
          setStatus("Erro ao excluir: " + err.message, "error");
        }
      }
    );
  });

  // Exportar e Importar JSON
  btnExportJson.addEventListener("click", function () {
    if (!currentPreset) return;
    var safeFile = currentPreset.presetName.replace(/[^a-z0-9_-]/gi, "_") + ".json";

    if (window.cep && window.cep.fs && typeof window.cep.fs.showSaveDialogEx === "function") {
      var res = window.cep.fs.showSaveDialogEx(
        "Exportar Preset JSON",
        presetManager.getPresetsFolderPath() || "",
        ["json"],
        safeFile,
        "Arquivo JSON (*.json)"
      );
      if (res && res.data) {
        try {
          presetManager.exportPresetToFile(currentPreset, res.data);
          setStatus("Preset exportado para: " + res.data, "success");
        } catch (e) {
          setStatus("Falha ao exportar: " + e.message, "error");
        }
      }
      return;
    }

    // Fallback via Download Blob
    var blob = new Blob([JSON.stringify(currentPreset, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = safeFile;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setStatus("Preset exportado com sucesso.", "success");
  });

  // Importa um preset de um JSON, pedindo confirmação antes de sobrescrever um
  // preset existente (o arquivo importado pode substituir trabalho do usuário).
  function importPresetJson(raw) {
    var attempt = function (overwrite) {
      try {
        var imported = presetManager.importPresetFromJsonString(raw, { overwrite: overwrite === true });
        loadSelectedPresetIntoEditor(imported.presetName);
        setStatus("Preset '" + imported.presetName + "' importado com sucesso!", "success");
      } catch (e) {
        if (e && e.code === "PRESET_EXISTS") {
          openConfirmModal(
            "Sobrescrever preset",
            "Já existe um preset chamado '" + e.presetName + "'. Deseja sobrescrevê-lo com o arquivo importado?",
            function () {
              attempt(true);
            }
          );
          return;
        }
        setStatus("Erro ao importar JSON: " + e.message, "error");
      }
    };
    attempt(false);
  }

  btnImportJson.addEventListener("click", function () {
    if (window.cep && window.cep.fs && typeof window.cep.fs.showOpenDialogEx === "function") {
      var res = window.cep.fs.showOpenDialogEx(
        false,
        false,
        "Importar Preset JSON",
        presetManager.getPresetsFolderPath() || "",
        ["json"],
        "Arquivo JSON (*.json)"
      );
      if (res && res.data && res.data.length > 0) {
        var filePath = res.data[0];
        try {
          importPresetJson(presetManager.fs.readFileSync(filePath, "utf8"));
        } catch (e) {
          setStatus("Erro ao importar JSON: " + e.message, "error");
        }
      }
      return;
    }

    hiddenFileInput.value = "";
    hiddenFileInput.click();
  });

  hiddenFileInput.addEventListener("change", function () {
    var file = hiddenFileInput.files && hiddenFileInput.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (e) {
      importPresetJson(e.target.result);
    };
    reader.readAsText(file);
  });

  btnOpenPresetsFolder.addEventListener("click", function () {
    var ok = presetManager.openPresetsFolder();
    if (ok) {
      setStatus("Pasta de presets aberta no sistema.", "success");
    } else {
      var pathStr = presetManager.getPresetsFolderPath();
      setStatus(pathStr ? ("Pasta: " + pathStr) : "Não foi possível abrir a pasta de presets.", "warning");
    }
  });

  // Botão Salvar do rodapé (mesmo comportamento do Salvar da barra superior)
  btnFooterSave.addEventListener("click", function () {
    saveCurrentPresetOrPromptNew();
  });

  // Fechar o editor (iframe pai, popup ou extensão CEP)
  function closeEditorWindow() {
    if (window.parent && window.parent !== window && typeof window.parent.closePresetBuilderModal === "function") {
      window.parent.closePresetBuilderModal();
      return;
    }
    if (window.opener) {
      window.close();
      return;
    }
    try {
      csInterface.closeExtension();
    } catch (e) {
      window.close();
    }
  }

  // Modal de Alterações Não Salvas
  function openUnsavedCloseModal() {
    unsavedCloseModalBackdrop.classList.add("open");
  }

  function closeUnsavedCloseModal() {
    unsavedCloseModalBackdrop.classList.remove("open");
  }

  btnUnsavedCancel.addEventListener("click", closeUnsavedCloseModal);

  btnUnsavedDiscard.addEventListener("click", function () {
    closeUnsavedCloseModal();
    setDirty(false);
    closeEditorWindow();
  });

  btnUnsavedSaveClose.addEventListener("click", function () {
    closeUnsavedCloseModal();
    if (currentPreset && (currentPreset.presetName === PresetManager.DEFAULT_PRESET_NAME || currentPreset.isBuiltIn)) {
      // Default protegido: abre "Salvar Como" e fecha após criar o novo preset
      closeAfterSaveAs = true;
    }
    saveCurrentPresetOrPromptNew(function () {
      closeEditorWindow();
    });
  });

  btnCloseModal.addEventListener("click", function () {
    if (isDirty) {
      openUnsavedCloseModal();
      return;
    }
    closeEditorWindow();
  });

  function loadOrReloadHostScripts(callback) {
    try {
      if (window.__adobe_cep__) {
        var extPath = csInterface.getSystemPath(SystemPath.EXTENSION);
        var hostDir = (extPath + "/host").replace(/\\/g, "/");
        var routerPath = hostDir + "/organizer.jsx";
        var scriptCmd =
          '$.evalFile("' +
          routerPath +
          '"); if ($.global.organizerLoadEngine) { $.global.organizerLoadEngine("' +
          hostDir +
          '"); }';
        csInterface.evalScript(scriptCmd, function (res) {
          if (typeof callback === "function") callback(res);
        });
        return;
      }
    } catch (e) { }
    if (typeof callback === "function") callback();
  }

  window.addEventListener("keydown", function (event) {
    var isCtrlR =
      (event.ctrlKey || event.metaKey) &&
      (event.key === "r" || event.key === "R" || event.keyCode === 82);
    var isF5 = event.key === "F5" || event.keyCode === 116;

    if (isCtrlR || isF5) {
      event.preventDefault();
      loadOrReloadHostScripts(function () {
        window.location.reload();
      });
    }
  });

  loadOrReloadHostScripts();

  // Inicialização
  var initialPresetName = presetManager.getActivePresetName();
  loadSelectedPresetIntoEditor(initialPresetName);

  // Espelha a troca de preset feita no Painel Principal
  try {
    csInterface.addEventListener("com.tidyflow.presetsUpdated", function (evt) {
      try {
        var d = evt && evt.data ? (typeof evt.data === "string" ? JSON.parse(evt.data) : evt.data) : null;
        var incoming = d && d.activePreset;
        if (!incoming) return;
        // Outro painel pode ter salvo/excluído presets: descarta o cache antes de ler
        presetManager.invalidatePresetCache();
        if (currentPreset && currentPreset.presetName === incoming) {
          // Edições não salvas têm prioridade sobre o estado do disco
          if (isDirty) return;
          // Mesmo preset: espelha Numeração Sequencial e Pasta de Origem alteradas no Painel Principal
          var stored = presetManager.loadPreset(incoming);
          var changed = false;

          // Espelha Numeração Sequencial (usePrefixNumbering)
          var storedPrefix = Boolean(stored.settings && stored.settings.usePrefixNumbering !== false);
          if (Boolean(currentPreset.settings && currentPreset.settings.usePrefixNumbering !== false) !== storedPrefix) {
            if (!currentPreset.settings) currentPreset.settings = {};
            currentPreset.settings.usePrefixNumbering = storedPrefix;
            if (chkUsePrefixNumbering) {
              chkUsePrefixNumbering.checked = storedPrefix;
            }
            changed = true;
          }

          // Espelha Categorias de Áudio (separateAudioCategories) e Numeração ESP (numberAudioCategories)
          var storedAudioCat = Boolean(stored.settings && stored.settings.separateAudioCategories !== false);
          if (Boolean(currentPreset.settings && currentPreset.settings.separateAudioCategories !== false) !== storedAudioCat) {
            if (!currentPreset.settings) currentPreset.settings = {};
            currentPreset.settings.separateAudioCategories = storedAudioCat;
            if (chkSeparateAudioCategories) {
              chkSeparateAudioCategories.checked = storedAudioCat;
            }
            syncAudioSubToggleState();
            changed = true;
          }
          var storedAudioNum = Boolean(stored.settings && stored.settings.numberAudioCategories !== false);
          if (Boolean(currentPreset.settings && currentPreset.settings.numberAudioCategories !== false) !== storedAudioNum) {
            if (!currentPreset.settings) currentPreset.settings = {};
            currentPreset.settings.numberAudioCategories = storedAudioNum;
            if (chkNumberAudioCategories) {
              chkNumberAudioCategories.checked = storedAudioNum;
            }
            changed = true;
          }
          (function mirror(nodes) {
            for (var i = 0; i < (nodes || []).length; i++) {
              var f = findNodeAndParentById(currentPreset.tree, nodes[i].id);
              if (f && f.node.rules && nodes[i].rules &&
                f.node.rules.groupBySourceFolder !== nodes[i].rules.groupBySourceFolder) {
                f.node.rules.groupBySourceFolder = nodes[i].rules.groupBySourceFolder;
                changed = true;
              }
              mirror(nodes[i].children);
            }
          })(stored.tree);
          if (changed) {
            syncGroupBySourceToggleState();
            renderTree();
          }
          return;
        }
        if (isDirty) {
          // Não descartar o trabalho em andamento só porque outro painel trocou o preset
          setStatus(
            "Outro painel alterou o preset ativo. Salve ou descarte suas alterações para sincronizar.",
            "warning"
          );
          return;
        }
        presetManager.setActivePresetNameSilent(incoming);
        loadSelectedPresetIntoEditor(incoming);
      } catch (eEvt) { }
    });
  } catch (eListen) { }

  window.addEventListener("focus", function () {
    try {
      // Edições não salvas não podem ser sobrescritas pelo estado do disco
      if (isDirty) return;
      // Re-sincronização leve: mantém a listagem em cache e relê apenas o preset ativo
      presetManager.invalidatePresetObjectCache();
      var activeName = presetManager.getActivePresetName();
      if (currentPreset && currentPreset.presetName === activeName) {
        var stored = presetManager.loadPreset(activeName);
        var changed = false;
        var storedPrefix = Boolean(stored.settings && stored.settings.usePrefixNumbering !== false);
        if (Boolean(currentPreset.settings && currentPreset.settings.usePrefixNumbering !== false) !== storedPrefix) {
          if (!currentPreset.settings) currentPreset.settings = {};
          currentPreset.settings.usePrefixNumbering = storedPrefix;
          if (chkUsePrefixNumbering) {
            chkUsePrefixNumbering.checked = storedPrefix;
          }
          changed = true;
        }
        var storedAudioCat = Boolean(stored.settings && stored.settings.separateAudioCategories !== false);
        if (Boolean(currentPreset.settings && currentPreset.settings.separateAudioCategories !== false) !== storedAudioCat) {
          if (!currentPreset.settings) currentPreset.settings = {};
          currentPreset.settings.separateAudioCategories = storedAudioCat;
          if (chkSeparateAudioCategories) {
            chkSeparateAudioCategories.checked = storedAudioCat;
          }
          syncAudioSubToggleState();
          changed = true;
        }
        var storedAudioNum = Boolean(stored.settings && stored.settings.numberAudioCategories !== false);
        if (Boolean(currentPreset.settings && currentPreset.settings.numberAudioCategories !== false) !== storedAudioNum) {
          if (!currentPreset.settings) currentPreset.settings = {};
          currentPreset.settings.numberAudioCategories = storedAudioNum;
          if (chkNumberAudioCategories) {
            chkNumberAudioCategories.checked = storedAudioNum;
          }
          changed = true;
        }
        (function mirror(nodes) {
          for (var i = 0; i < (nodes || []).length; i++) {
            var f = findNodeAndParentById(currentPreset.tree, nodes[i].id);
            if (f && f.node.rules && nodes[i].rules &&
              f.node.rules.groupBySourceFolder !== nodes[i].rules.groupBySourceFolder) {
              f.node.rules.groupBySourceFolder = nodes[i].rules.groupBySourceFolder;
              changed = true;
            }
            mirror(nodes[i].children);
          }
        })(stored.tree);
        if (changed) {
          syncGroupBySourceToggleState();
          renderTree();
        }
      }
    } catch (eFocus) { }
  });
})();
