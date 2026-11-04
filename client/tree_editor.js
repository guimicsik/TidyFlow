(function () {
  "use strict";

  var csInterface = new CSInterface();
  var presetManager = new PresetManager(csInterface);
  var isPPro = presetManager.isPremierePro();
  var hostAppName = presetManager.getHostDisplayName();

  if (isPPro) {
    document.title = "PPro Organizer — Preset Builder & Estrutura de Pastas";
    var treeToolbarTitle = document.getElementById("treeToolbarTitle");
    if (treeToolbarTitle) {
      treeToolbarTitle.textContent =
        "Estrutura da Árvore de Pastas (Clique na cor para Label PPro • Clique nas regras para filtrar)";
    }
    var ruleSectionHostTitle = document.getElementById("ruleSectionHostTitle");
    if (ruleSectionHostTitle) {
      ruleSectionHostTitle.textContent = "1. Tipos de Itens Permitidos";
    }
    var lblTypeMainComp = document.getElementById("lblTypeMainComp");
    if (lblTypeMainComp) {
      lblTypeMainComp.textContent = "Sequência Principal";
    }
    var infoTypeMainComp = document.getElementById("infoTypeMainComp");
    if (infoTypeMainComp) {
      infoTypeMainComp.setAttribute(
        "data-tooltip",
        "Sequências finais de edição que não estão inseridas dentro de nenhuma outra sequência."
      );
    }
    var lblTypePreComps = document.getElementById("lblTypePreComps");
    if (lblTypePreComps) {
      lblTypePreComps.textContent = "Sequências Aninhadas";
    }
    var infoTypePreComps = document.getElementById("infoTypePreComps");
    if (infoTypePreComps) {
      infoTypePreComps.setAttribute(
        "data-tooltip",
        "Sequências secundárias ou multicâmera usadas dentro de outras sequências."
      );
    }
    var lblTypeSolids = document.getElementById("lblTypeSolids");
    if (lblTypeSolids) {
      lblTypeSolids.textContent = "Itens Sintéticos";
    }
    var infoTypeSolids = document.getElementById("infoTypeSolids");
    if (infoTypeSolids) {
      infoTypeSolids.setAttribute(
        "data-tooltip",
        "Elementos gerados internamente no Premiere, como Color Matte, Adjustment Layer e Black Video."
      );
    }
    var lblTypeDataFiles = document.getElementById("lblTypeDataFiles");
    if (lblTypeDataFiles) {
      lblTypeDataFiles.textContent = "Dados, MOGRT e Legendas";
    }
    var infoTypeDataFiles = document.getElementById("infoTypeDataFiles");
    if (infoTypeDataFiles) {
      infoTypeDataFiles.setAttribute(
        "data-tooltip",
        "Templates gráficos, arquivos de legenda, tabelas e projetos importados."
      );
    }
    var lblRuleGroupByMainComp = document.getElementById("lblRuleGroupByMainComp");
    if (lblRuleGroupByMainComp) {
      lblRuleGroupByMainComp.textContent = "Agrupar por Seq. Principal";
    }
    var infoRuleGroupByMainComp = document.getElementById("infoRuleGroupByMainComp");
    if (infoRuleGroupByMainComp) {
      infoRuleGroupByMainComp.setAttribute(
        "data-tooltip",
        "Separa as sequências aninhadas em subpastas com o nome da sequência principal onde são usadas."
      );
    }
    var lblRulePsdBundles = document.getElementById("lblRulePsdBundles");
    if (lblRulePsdBundles) {
      lblRulePsdBundles.textContent = "Isolar PSD / AI";
    }

    // Tooltips dinâmicos e adaptados ao Premiere Pro para os pacotes de extensão
    var packDataFiles = document.querySelector('input.rule-pack-chk[value="DataFiles"]');
    if (packDataFiles && packDataFiles.parentElement) {
      var tipData = packDataFiles.parentElement.querySelector(".info-icon");
      if (tipData) {
        tipData.setAttribute("data-tooltip", "Exemplos: .json, .csv, .prproj, .mogrt, .srt, .vtt, .mcc, .dfxp, .xml, .aaf...");
      }
      var lblData = packDataFiles.parentElement.querySelector(".btn-tile-label");
      if (lblData) {
        lblData.textContent = "Dados / Legendas";
      }
    }
    var packAudios = document.querySelector('input.rule-pack-chk[value="Audios"]');
    if (packAudios && packAudios.parentElement) {
      var tipAud = packAudios.parentElement.querySelector(".info-icon");
      if (tipAud) {
        tipAud.setAttribute("data-tooltip", "Exemplos: .wav, .mp3, .aac, .m4a, .aif, .flac, .asnd, .ac3, .caf, .mid...");
      }
    }
    var packVideos = document.querySelector('input.rule-pack-chk[value="Videos"]');
    if (packVideos && packVideos.parentElement) {
      var tipVid = packVideos.parentElement.querySelector(".info-icon");
      if (tipVid) {
        tipVid.setAttribute("data-tooltip", "Exemplos: .mp4, .mov, .prores, .mxf, .avi, .braw, .r3d, .mod, .tod...");
      }
    }
    var packImages = document.querySelector('input.rule-pack-chk[value="Images"]');
    if (packImages && packImages.parentElement) {
      var tipImg = packImages.parentElement.querySelector(".info-icon");
      if (tipImg) {
        tipImg.setAttribute("data-tooltip", "Exemplos: .png, .jpg, .jfif, .ico, .psd, .ai, .svg, .exr, .dng...");
      }
    }
  }

  // Elementos DOM - Barra Superior
  var presetSelect = document.getElementById("presetSelect");
  var badgeBuiltIn = document.getElementById("badgeBuiltIn");
  var badgeUnsaved = document.getElementById("badgeUnsaved");
  var btnSavePreset = document.getElementById("btnSavePreset");
  var btnSaveAsPreset = document.getElementById("btnSaveAsPreset");
  var btnResetDefault = document.getElementById("btnResetDefault");
  var btnImportJson = document.getElementById("btnImportJson");
  var btnExportJson = document.getElementById("btnExportJson");
  var btnOpenPresetsFolder = document.getElementById("btnOpenPresetsFolder");
  var btnDeletePreset = document.getElementById("btnDeletePreset");
  var hiddenFileInput = document.getElementById("hiddenFileInput");

  // Elementos DOM - Barra de Configurações
  var chkUsePrefixNumbering = document.getElementById("chkUsePrefixNumbering");
  var chkDeleteEmptyFolders = document.getElementById("chkDeleteEmptyFolders");
  var inpUnusedFolderName = document.getElementById("inpUnusedFolderName");

  // Elementos DOM - Árvore e Rodapé
  var btnAddTopFolder = document.getElementById("btnAddTopFolder");
  var treeRootList = document.getElementById("treeRootList");
  var editorStatus = document.getElementById("editorStatus");
  var btnRunNow = document.getElementById("btnRunNow");
  var btnCloseModal = document.getElementById("btnCloseModal");

  // Popover de Cores AE e Tooltip de Info
  var labelPopover = document.getElementById("labelPopover");
  var ruleInfoTooltip = document.getElementById("ruleInfoTooltip");

  // Modal de Regras
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
  var rulePackCheckboxes = document.querySelectorAll(".rule-pack-chk");
  var inpNewExtension = document.getElementById("inpNewExtension");
  var btnAddExtension = document.getElementById("btnAddExtension");
  var extTagsContainer = document.getElementById("extTagsContainer");
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
  var modalWorkingExts = [];
  var modalWorkingNameTags = [];
  var pendingConfirmCallback = null;
  var draggedNodeId = null;

  function setStatus(msg, type) {
    if (!editorStatus) return;
    editorStatus.textContent = msg || "";
    editorStatus.className = type || "";
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
    inpUnusedFolderName.value = currentPreset.settings.unusedFolderName || "Nunca Usadas";

    setDirty(false);
    renderTree();
  }

  // Renderiza o resumo de regras em pílulas visuais para cada pasta da árvore
  function buildRuleSummaryElements(node) {
    var rules = (node && node.rules) || {};
    var pills = [];

    var typeLabels = {
      MainComp: isPPro ? "Seq. Principal" : "Comp Principal",
      PreComps: isPPro ? "Nested Seqs" : "Pre-Comps",
      StillImages: "Images",
      Videos: "Videos",
      ImageSequences: "Img Seq",
      Audios: "Audios",
      Solids: isPPro ? "Sintéticos/Solids" : "Solids",
      DataFiles: isPPro ? "Data/MOGRT" : "Data/3D"
    };

    var types = Array.isArray(rules.types) ? rules.types : [];
    for (var i = 0; i < types.length; i++) {
      var label = typeLabels[types[i]] || types[i];
      pills.push({ text: label, cls: "" });
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

    var exts = Array.isArray(rules.extensions) ? rules.extensions : [];
    if (exts.length > 0) {
      var preview = exts.slice(0, 4).map(function (e) { return "." + e; }).join(", ");
      if (exts.length > 4) {
        preview += " +" + (exts.length - 4);
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
          row.setAttribute("data-node-id", node.id);

          // 0. Alça de Arraste (Drag Handle)
          var dragHandle = document.createElement("span");
          dragHandle.className = "drag-handle";
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
          swatchBtn.className = "label-swatch-btn";
          swatchBtn.style.backgroundColor = labelInfo.color;
          swatchBtn.title = "Cor no " + hostAppName + ": " + labelInfo.ptName;
          swatchBtn.addEventListener("click", function (ev) {
            ev.stopPropagation();
            openColorLabelPopover(node.id, swatchBtn);
          });
          row.appendChild(swatchBtn);

          // 3. Badge e Controle de Numeração Individual (# / 01_)
          var isNodeNumbered = (node.useNumbering !== false);
          var prefixBadge = document.createElement("button");
          prefixBadge.type = "button";
          prefixBadge.className = "prefix-preview" + (isNodeNumbered && usePrefix ? "" : " prefix-off");

          if (isNodeNumbered) {
            var mySeq = nodeSeqMap[node.id] || (idx + 1);
            var numStr = mySeq < 10 ? "0" + mySeq : String(mySeq);
            prefixBadge.textContent = usePrefix ? (numStr + "_") : "# ON";
            prefixBadge.title = "Numeração: ATIVADA para esta pasta (" + (usePrefix ? numStr + "_" : "01_") + "). Clique para desativar a numeração desta pasta.";
          } else {
            prefixBadge.textContent = "# OFF";
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
          rulesBtn.className = "rules-summary-btn";
          rulesBtn.title = "Clique para configurar tipos de arquivo, extensões e filtros desta pasta";

          var pills = buildRuleSummaryElements(node);
          if (pills.length === 0) {
            var emptyHint = document.createElement("span");
            emptyHint.className = "rule-empty-hint";
            emptyHint.textContent = hasChildren
              ? "Pasta contêiner (clique p/ adicionar regras)"
              : "Sem regras (clique p/ configurar filtros)";
            rulesBtn.appendChild(emptyHint);
          } else {
            for (var p = 0; p < pills.length; p++) {
              var pillEl = document.createElement("span");
              pillEl.className = "rule-pill " + (pills[p].cls || "");
              pillEl.textContent = pills[p].text;
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
          btnUp.className = "row-btn";
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
          btnDown.className = "row-btn";
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
          btnAddChild.className = "row-btn add-child";
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
          btnRemove.className = "row-btn remove-node";
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

  // Sincronização visual dos botões estilo Tile (Ativo #0d66d0 / Inativo #084083)
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

  // Tooltip de informação amigável nos ícones (i)
  function hideRuleTooltip() {
    if (ruleInfoTooltip) {
      ruleInfoTooltip.style.display = "none";
    }
  }

  var allInfoIcons = document.querySelectorAll(".info-icon");
  for (var infIdx = 0; infIdx < allInfoIcons.length; infIdx++) {
    (function (iconEl) {
      iconEl.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      });

      iconEl.addEventListener("mouseenter", function () {
        var text = iconEl.getAttribute("data-tooltip");
        if (!text || !ruleInfoTooltip) return;
        ruleInfoTooltip.textContent = text;
        ruleInfoTooltip.style.display = "block";

        var rect = iconEl.getBoundingClientRect();
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
      });

      iconEl.addEventListener("mouseleave", hideRuleTooltip);
    })(allInfoIcons[infIdx]);
  }

  // Modal de Regras e Filtros — Sincronização dos Pacotes de Extensões
  function updateClearExtsButtonVisibility() {
    if (btnClearAllExts) {
      btnClearAllExts.style.display = modalWorkingExts.length > 0 ? "inline-flex" : "none";
    }
  }

  var activeDefaultExtensions = presetManager.getDefaultExtensions();

  function syncPackButtonsFromExts() {
    for (var i = 0; i < rulePackCheckboxes.length; i++) {
      var chk = rulePackCheckboxes[i];
      var packName = chk.value;
      var packExts = activeDefaultExtensions[packName] || [];
      var hasAny = false;
      for (var e = 0; e < packExts.length; e++) {
        if (modalWorkingExts.indexOf(packExts[e]) !== -1) {
          hasAny = true;
          break;
        }
      }
      chk.checked = hasAny;
    }
    syncAllRuleToggleButtons();
    updateClearExtsButtonVisibility();
  }

  function addExtensionsFromInputString(rawStr) {
    if (!rawStr) return;
    var parts = String(rawStr).split(/[\s,;]+/);
    for (var i = 0; i < parts.length; i++) {
      var clean = parts[i].trim().replace(/^\.+/, "").toLowerCase();
      if (clean && modalWorkingExts.indexOf(clean) === -1) {
        modalWorkingExts.push(clean);
      }
    }
    syncPackButtonsFromExts();
  }

  // Listener dos botões de pacote de extensão
  for (var pIdx = 0; pIdx < rulePackCheckboxes.length; pIdx++) {
    (function (chk) {
      chk.addEventListener("change", function () {
        var packName = chk.value;
        var packList = activeDefaultExtensions[packName] || [];
        if (chk.checked) {
          for (var i = 0; i < packList.length; i++) {
            if (modalWorkingExts.indexOf(packList[i]) === -1) {
              modalWorkingExts.push(packList[i]);
            }
          }
        } else {
          modalWorkingExts = modalWorkingExts.filter(function (ext) {
            return packList.indexOf(ext) === -1;
          });
        }
        syncPackButtonsFromExts();
      });
    })(rulePackCheckboxes[pIdx]);
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
      chk.checked = (activeTypes.indexOf(chk.value) !== -1);
    }

    chkRuleGroupExt.checked = Boolean(rules.groupSubfoldersByExt);
    if (chkRuleGroupBySourceFolder) {
      chkRuleGroupBySourceFolder.checked = (rules.groupBySourceFolder !== undefined) ? Boolean(rules.groupBySourceFolder) : true;
    }
    chkRuleGroupByMainComp.checked = Boolean(rules.groupByMainComp);
    chkRulePsdBundles.checked = Boolean(rules.handlePsdBundles);
    chkRuleCatchOthers.checked = Boolean(rules.catchOthers);

    syncAllRuleToggleButtons();

    modalWorkingExts = Array.isArray(rules.extensions) ? rules.extensions.slice() : [];
    syncPackButtonsFromExts();

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

  if (btnAddExtension && inpNewExtension) {
    btnAddExtension.addEventListener("click", function () {
      addExtensionsFromInputString(inpNewExtension.value);
      inpNewExtension.value = "";
      inpNewExtension.focus();
    });
  }

  if (inpNewExtension) {
    inpNewExtension.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") {
        ev.preventDefault();
        addExtensionsFromInputString(inpNewExtension.value);
        inpNewExtension.value = "";
      }
    });
  }

  if (btnClearAllExts) {
    btnClearAllExts.addEventListener("click", function () {
      modalWorkingExts = [];
      syncPackButtonsFromExts();
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

    // Se o usuário digitou algo no input de extensão e não clicou em [+], adiciona também
    if (inpNewExtension && inpNewExtension.value.trim() !== "") {
      addExtensionsFromInputString(inpNewExtension.value);
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
        selectedTypes.push(ruleTypeCheckboxes[i].value);
      }
    }

    found.node.rules = {
      types: selectedTypes,
      extensions: modalWorkingExts.slice(),
      groupSubfoldersByExt: chkRuleGroupExt.checked,
      groupBySourceFolder: chkRuleGroupBySourceFolder ? chkRuleGroupBySourceFolder.checked : true,
      groupByMainComp: chkRuleGroupByMainComp.checked,
      handlePsdBundles: chkRulePsdBundles.checked,
      catchOthers: chkRuleCatchOthers.checked,
      nameFilterMode: "contains",
      nameFilter: modalWorkingNameTags.join(", ")
    };

    closeRulesModal();
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

  btnCancelSaveAs.addEventListener("click", closeSaveAsModal);

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

    currentPreset.presetName = newName;
    currentPreset.isBuiltIn = false;
    currentPreset = presetManager.savePreset(currentPreset);
    closeSaveAsModal();
    loadSelectedPresetIntoEditor(currentPreset.presetName);
    setStatus("Novo preset '" + currentPreset.presetName + "' salvo com sucesso!", "success");
    try {
      if (window.parent && window.parent !== window && typeof window.parent.onPresetBuilderUpdated === "function") {
        window.parent.onPresetBuilderUpdated(currentPreset.presetName);
      }
    } catch (eSync2) {}
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
    presetManager.setActivePresetName(targetName);
    loadSelectedPresetIntoEditor(targetName);
    setStatus("Preset '" + targetName + "' carregado.", "");
  });

  chkUsePrefixNumbering.addEventListener("change", function () {
    if (!currentPreset) return;
    currentPreset.settings.usePrefixNumbering = chkUsePrefixNumbering.checked;
    renderTree();
    presetManager.savePreset(currentPreset);
    presetManager.notifyPresetsUpdated(currentPreset.presetName);
  });

  inpUnusedFolderName.addEventListener("input", function () {
    if (!currentPreset) return;
    currentPreset.settings.unusedFolderName = inpUnusedFolderName.value.trim() || "Nunca Usadas";
    setDirty(true);
  });

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
    setDirty(false);
    refreshPresetSelectDropdown(currentPreset.presetName);
    setStatus("Preset '" + currentPreset.presetName + "' salvo em disco!", "success");
    try {
      if (window.parent && window.parent !== window && typeof window.parent.onPresetBuilderUpdated === "function") {
        window.parent.onPresetBuilderUpdated(currentPreset.presetName);
      }
    } catch (eSync) {}
    if (typeof onSavedCallback === "function") {
      onSavedCallback();
    }
  }

  btnSavePreset.addEventListener("click", function () {
    saveCurrentPresetOrPromptNew();
  });

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
          } catch (eSync3) {}
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
          var raw = presetManager.fs.readFileSync(filePath, "utf8");
          var imported = presetManager.importPresetFromJsonString(raw);
          loadSelectedPresetIntoEditor(imported.presetName);
          setStatus("Preset '" + imported.presetName + "' importado com sucesso!", "success");
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
      try {
        var imported = presetManager.importPresetFromJsonString(e.target.result);
        loadSelectedPresetIntoEditor(imported.presetName);
        setStatus("Preset '" + imported.presetName + "' importado!", "success");
      } catch (err) {
        setStatus("Erro ao importar JSON: " + err.message, "error");
      }
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

  // Botão Salvar e Organizar Agora
  btnRunNow.addEventListener("click", function () {
    if (!currentPreset) return;

    // Salva se for preset de usuário; se for Default, salva as preferências de toggle
    if (!currentPreset.isBuiltIn && currentPreset.presetName !== PresetManager.DEFAULT_PRESET_NAME) {
      currentPreset = presetManager.savePreset(currentPreset);
      setDirty(false);
    } else {
      presetManager.savePreset(currentPreset);
    }

    setStatus("Organizando projeto no " + hostAppName + "...", "");
    btnRunNow.disabled = true;

    var scriptCall =
      '$.global.organizeWithPreset("selection", ' +
      JSON.stringify(JSON.stringify(currentPreset)) +
      ")";

    csInterface.evalScript(scriptCall, function (result) {
      btnRunNow.disabled = false;
      if (!result || result === "EvalScript error.") {
        setStatus("Erro ao executar organização no " + hostAppName + ".", "error");
        return;
      }

      try {
        var response = JSON.parse(result);
        if (response && response.success) {
          var unitLabel = isPPro ? "Sequências: " : "Comps: ";
          setStatus(
            "Projeto organizado! (" +
              unitLabel +
              (response.movedComps || 0) +
              ", Mídias: " +
              (response.movedFootages || 0) +
              ", Pastas limpas: " +
              (response.cleanedFolders || 0) +
              ")",
            "success"
          );
        } else {
          var errMsg = (response && response.error) || "Falha ao organizar.";
          if (errMsg.indexOf("Nenhuma composi") !== -1 || errMsg.indexOf("Nenhuma sequ") !== -1) {
            var targetLabel = isPPro ? "Sequência Principal" : "Composição Principal";
            setStatus("Selecione a " + targetLabel + " no painel Project (ou use 'Apenas Mídias' no painel).", "warning");
          } else {
            setStatus("Erro: " + errMsg, "error");
          }
        }
      } catch (e) {
        setStatus("Resposta inválida do " + hostAppName + ".", "error");
      }
    });
  });

  btnCloseModal.addEventListener("click", function () {
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
    } catch (e) {}
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
        if (currentPreset && currentPreset.presetName === incoming) {
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

          // Espelha Pasta de Origem nas regras das pastas
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
          if (changed) renderTree();
          return;
        }
        presetManager.setActivePresetNameSilent(incoming);
        loadSelectedPresetIntoEditor(incoming);
      } catch (eEvt) {}
    });
  } catch (eListen) {}

  window.addEventListener("focus", function () {
    try {
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
        if (changed) renderTree();
      }
    } catch (eFocus) {}
  });
})();
