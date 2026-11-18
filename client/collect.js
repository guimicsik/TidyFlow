/* ==========================================================================
   TidyFlow — Janela Collect Files (com.tidyflow.collect)
   Layout e fluxo avançado estilo "Project Manager" do Premiere Pro:
   - Seleção múltipla de Sequências (Premiere) / Composições (After Effects).
   - Espaço em disco disponível e estimativa dinâmica de tamanho.
   - Escolha direta do caminho de destino com preenchimento padrão inteligente.
   - Opções por host: Previews e Audio Conform no Premiere; Proxy no AE.
   - Opção de renomear arquivos físicos para o nome do clipe na timeline/bin.
   - Relink via XML (.aepx no AE; gzip/XML .prproj no PPRO) mantendo Bins em (Footage)/.
   ========================================================================== */
(function () {
  var csInterface = new CSInterface();
  var CollectEngine = window.CollectEngine || (typeof require === "function" ? require("./CollectEngine.js") : null);
  var engine = CollectEngine ? CollectEngine.createEstimator() : null;

  // DOM Elements
  var lblTargetTitle = document.getElementById("lblTargetTitle");
  var btnSelectAllTargets = document.getElementById("btnSelectAllTargets");
  var btnSelectNoneTargets = document.getElementById("btnSelectNoneTargets");
  var btnExpandAllTargets = document.getElementById("btnExpandAllTargets");
  var btnCollapseAllTargets = document.getElementById("btnCollapseAllTargets");
  var targetList = document.getElementById("targetList");

  var inpDestPath = document.getElementById("inpDestPath");
  var btnBrowseDest = document.getElementById("btnBrowseDest");
  var valDiskAvailable = document.getElementById("valDiskAvailable");
  var valOriginalSize = document.getElementById("valOriginalSize");
  var valResultingSize = document.getElementById("valResultingSize");
  var btnCalculate = document.getElementById("btnCalculate");

  var chkExcludeUnused = document.getElementById("chkExcludeUnused");
  var chkAudioConform = document.getElementById("chkAudioConform");
  var chkPreviewFiles = document.getElementById("chkPreviewFiles");
  var chkRenameClipNames = document.getElementById("chkRenameClipNames");
  var chkObeyProxy = document.getElementById("chkObeyProxy");
  var chkReportOnly = document.getElementById("chkReportOnly");
  var chkReveal = document.getElementById("chkReveal");
  var chkOpenCollected = document.getElementById("chkOpenCollected");

  var rowExcludeUnused = document.getElementById("rowExcludeUnused");
  var rowAudioConform = document.getElementById("rowAudioConform");
  var rowPreviewFiles = document.getElementById("rowPreviewFiles");
  var rowRenameClipNames = document.getElementById("rowRenameClipNames");
  var rowObeyProxy = document.getElementById("rowObeyProxy");
  var rowReportOnly = document.getElementById("rowReportOnly");
  var rowReveal = document.getElementById("rowReveal");
  var rowOpenCollected = document.getElementById("rowOpenCollected");

  var collectProgressBox = document.getElementById("collectProgressBox");
  var collectEta = document.getElementById("collectEta");
  var collectPercent = document.getElementById("collectPercent");
  var collectProgressBar = document.getElementById("collectProgressBar");
  var statusLine = document.getElementById("statusLine");

  var btnComments = document.getElementById("btnComments");
  var btnCollect = document.getElementById("btnCollect");
  var btnCancel = document.getElementById("btnCancel");

  var commentsBackdrop = document.getElementById("commentsBackdrop");
  var commentsTitle = document.getElementById("commentsTitle");
  var txtComments = document.getElementById("txtComments");
  var btnCommentsOk = document.getElementById("btnCommentsOk");
  var btnCommentsCancel = document.getElementById("btnCommentsCancel");

  var isPPro = false;
  try { isPPro = csInterface.getHostEnvironment().appId === "PPRO"; } catch (eHost) { }
  var compWord = isPPro ? "sequência" : "composição";
  var compWordPlural = isPPro ? "sequências" : "composições";

  var state = {
    scan: null,
    estimate: null,
    isEstimating: false,
    comments: "",
    token: 0,
    blocked: false,
    isClosing: false,
    isCopying: false,
    copyCanceled: false,
    targets: null, // [{ id, name, selected, label, folders, folderLabels }]
    collapsedFolders: {},
    destPathChosenByUser: false
  };

  function log(level, msg) {
    try { if (window.OrgLog) OrgLog[level]("collect", msg); } catch (e) { }
  }

  function setStatus(text, isError) {
    if (!statusLine) return;
    statusLine.textContent = text || "";
    statusLine.className = "collect-status" + (isError ? " is-error" : "");
    if (isError && text) log("error", text);
  }

  function getNodeFsModule() {
    try {
      var req = (window.cep_node && window.cep_node.require) ? window.cep_node.require
        : (typeof require === "function" ? require : null);
      if (!req) return null;
      return {
        fs: req("fs"),
        path: req("path"),
        os: req("os"),
        zlib: req("zlib")
      };
    } catch (e) {
      return null;
    }
  }

  /* ---------- Consulta de Espaço em Disco ---------- */

  function updateDiskSpaceAvailable(targetPath) {
    if (!targetPath || !valDiskAvailable) return;
    var node = getNodeFsModule();
    if (!node) {
      valDiskAvailable.textContent = "--";
      return;
    }

    try {
      if (typeof node.fs.statfs === "function") {
        node.fs.statfs(targetPath, function (err, stats) {
          if (!err && stats && stats.bavail && stats.bsize) {
            valDiskAvailable.textContent = CollectEngine.formatBytes(stats.bavail * stats.bsize);
            return;
          }
          queryDiskSpaceFallback(node, targetPath);
        });
        return;
      }
    } catch (eStatfs) { }

    queryDiskSpaceFallback(node, targetPath);
  }

  function queryDiskSpaceFallback(node, targetPath) {
    try {
      var req = (window.cep_node && window.cep_node.require) ? window.cep_node.require
        : (typeof require === "function" ? require : null);
      if (!req || !valDiskAvailable) return;
      var cp = req("child_process");
      var m = /^([a-zA-Z]):/.exec(targetPath);
      var driveLetter = m ? m[1] : "C";
      var cmd = 'powershell -NoProfile -Command "(Get-Volume -DriveLetter ' + driveLetter + ').SizeRemaining"';
      cp.exec(cmd, { timeout: 3000 }, function (err, stdout) {
        if (!err && stdout) {
          var num = parseInt(stdout.trim(), 10);
          if (!isNaN(num) && num > 0) {
            valDiskAvailable.textContent = CollectEngine.formatBytes(num);
            return;
          }
        }
        valDiskAvailable.textContent = "--";
      });
    } catch (eFallback) {
      if (valDiskAvailable) valDiskAvailable.textContent = "--";
    }
  }

  /* ---------- Alvos (Sequências / Composições em Árvore) ---------- */

  var AE_LABEL_COLORS = [
    "transparent", // 0: None
    "#b83c3c",     // 1: Red
    "#c8b432",     // 2: Yellow
    "#42aba6",     // 3: Aqua
    "#c24982",     // 4: Pink
    "#a9a9ca",     // 5: Lavender
    "#e7c19e",     // 6: Peach
    "#b3c7b3",     // 7: Seafoam
    "#677de0",     // 8: Blue
    "#4aa44c",     // 9: Green
    "#8e2c9a",     // 10: Purple
    "#e8920d",     // 11: Orange
    "#7f452a",     // 12: Brown
    "#f46dd6",     // 13: Magenta
    "#3da2a5",     // 14: Cyan
    "#a89677",     // 15: Sandstone
    "#1e401e"      // 16: Dark Green
  ];

  var PPRO_LABEL_COLORS = {
    0: "transparent",
    1: "#7b45a0",  // Violet
    2: "#d8c53b",  // Yellow
    3: "#3297c9",  // Cerulean
    4: "#d85888",  // Rose
    5: "#9f79c1",  // Lavender
    6: "#de8735",  // Mango
    7: "#2ba58b",  // Caribbean
    8: "#3c59c9",  // Blue
    9: "#44a248",  // Green
    10: "#8c3899", // Purple
    11: "#5273b8", // Iris
    12: "#7d4a2d", // Brown
    13: "#c942a8", // Magenta
    14: "#278287", // Teal
    15: "#a89273", // Tan
    16: "#2d7a47"  // Forest
  };

  function getTargetLabelColor(labelIndex) {
    var idx = parseInt(labelIndex, 10);
    if (isNaN(idx) || idx <= 0) return null;
    if (isPPro) {
      return PPRO_LABEL_COLORS[idx] || null;
    }
    return (idx >= 1 && idx <= 16) ? AE_LABEL_COLORS[idx] : null;
  }

  function getSelectedTargetIds() {
    if (!state.targets) return [];
    var out = [];
    for (var i = 0; i < state.targets.length; i++) {
      if (state.targets[i].selected) out.push(state.targets[i].id);
    }
    return out;
  }

  // Funções de árvore compartilhadas via CollectEngine
  var buildTreeStructure = (CollectEngine && CollectEngine.buildTargetTree) ? CollectEngine.buildTargetTree : function (targets) {
    var root = { name: "", path: "", foldersList: [], foldersMap: {}, items: [] };
    if (!targets || !targets.length) return root;
    for (var i = 0; i < targets.length; i++) {
      var t = targets[i], fList = t.folders || [], curr = root, currentPath = "";
      for (var f = 0; f < fList.length; f++) {
        var fName = fList[f];
        currentPath = currentPath ? (currentPath + "/" + fName) : fName;
        if (!curr.foldersMap[fName]) {
          var fLabel = (t.folderLabels && typeof t.folderLabels[f] === "number") ? t.folderLabels[f] : 0;
          var fNode = { name: fName, path: currentPath, label: fLabel, foldersList: [], foldersMap: {}, items: [] };
          curr.foldersMap[fName] = fNode;
          curr.foldersList.push(fNode);
        }
        curr = curr.foldersMap[fName];
      }
      curr.items.push(t);
    }
    return root;
  };

  var countFolderTargets = (CollectEngine && CollectEngine.countFolderTargets) ? CollectEngine.countFolderTargets : function (node) {
    if (!node) return { total: 0, selected: 0 };
    var total = node.items ? node.items.length : 0, selected = 0;
    if (node.items) {
      for (var i = 0; i < node.items.length; i++) { if (node.items[i].selected) selected++; }
    }
    if (node.foldersList) {
      for (var f = 0; f < node.foldersList.length; f++) {
        var subRes = countFolderTargets(node.foldersList[f]);
        total += subRes.total; selected += subRes.selected;
      }
    }
    return { total: total, selected: selected };
  };

  var setFolderTargetsSelected = (CollectEngine && CollectEngine.setFolderTargetsSelected) ? CollectEngine.setFolderTargetsSelected : function (node, isSelected) {
    if (!node) return;
    if (node.items) {
      for (var i = 0; i < node.items.length; i++) { node.items[i].selected = Boolean(isSelected); }
    }
    if (node.foldersList) {
      for (var f = 0; f < node.foldersList.length; f++) { setFolderTargetsSelected(node.foldersList[f], isSelected); }
    }
  };

  var computeInitialCollapsed = (CollectEngine && CollectEngine.computeInitialCollapsed) ? CollectEngine.computeInitialCollapsed : function () { return {}; };

  function createSvgIcon(type) {
    var span = document.createElement("span");
    span.className = "collect-tree-icon collect-tree-icon--" + type;
    span.setAttribute("data-tf-design", type === "folder" ? "collect-tree-folder-icon" : "collect-tree-comp-icon");
    if (type === "folder") {
      span.innerHTML = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M1.5 4A1.5 1.5 0 0 1 3 2.5h3.2l1.6 1.8H13A1.5 1.5 0 0 1 14.5 5.8v6.7a1.5 1.5 0 0 1-1.5 1.5H3a1.5 1.5 0 0 1-1.5-1.5V4z" fill="rgba(255,255,255,0.06)"/>' +
        '</svg>';
    } else {
      span.innerHTML = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="2" y="3" width="12" height="10" rx="1.5"/>' +
        '<path d="M2 6.5h12M5.5 3v3.5M10.5 3v3.5"/>' +
        '</svg>';
    }
    return span;
  }

  function createChevronIcon(isCollapsed) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "collect-tree-chevron-btn";
    btn.setAttribute("data-tf-design", "collect-tree-chevron");
    btn.title = isCollapsed ? "Expandir pasta" : "Recolher pasta";
    btn.setAttribute("aria-label", isCollapsed ? "Expandir pasta" : "Recolher pasta");
    btn.innerHTML = '<svg class="collect-chevron-icon' + (isCollapsed ? ' is-collapsed' : '') + '" viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M6 3.5l4.5 4.5-4.5 4.5"/>' +
      '</svg>';
    return btn;
  }

  function createSwatch(labelIndex) {
    var color = getTargetLabelColor(labelIndex);
    if (!color) return null;
    var swatch = document.createElement("span");
    swatch.className = "collect-swatch";
    swatch.style.backgroundColor = color;
    return swatch;
  }

  function renderTreeNode(node, container, level) {
    // 1. Renderiza subpastas desta pasta
    for (var f = 0; f < node.foldersList.length; f++) {
      var folderNode = node.foldersList[f];
      var isCollapsed = Boolean(state.collapsedFolders[folderNode.path]);
      var counts = countFolderTargets(folderNode);

      var folderRow = document.createElement("div");
      folderRow.className = "collect-tree-row collect-tree-row--folder";
      folderRow.setAttribute("data-tf-design", "collect-tree-folder-row");
      folderRow.style.paddingLeft = (6 + level * 18) + "px";
      folderRow.title = folderNode.name + " (" + counts.selected + "/" + counts.total + " selecionadas)";

      // Chevron
      var chevronBtn = createChevronIcon(isCollapsed);
      folderRow.appendChild(chevronBtn);

      // Checkbox da pasta
      var folderChk = document.createElement("input");
      folderChk.type = "checkbox";
      folderChk.className = "collect-tree-check";
      folderChk.setAttribute("data-tf-design", "collect-tree-checkbox");
      if (counts.selected === counts.total && counts.total > 0) {
        folderChk.checked = true;
        folderChk.indeterminate = false;
      } else if (counts.selected === 0) {
        folderChk.checked = false;
        folderChk.indeterminate = false;
      } else {
        folderChk.checked = false;
        folderChk.indeterminate = true;
      }

      (function (fNode, fChk, cCounts) {
        fChk.addEventListener("click", function (e) {
          e.stopPropagation();
        });
        fChk.addEventListener("change", function (e) {
          e.stopPropagation();
          var willSelect = (cCounts.selected < cCounts.total);
          setFolderTargetsSelected(fNode, willSelect);
          renderTargetsList();
          renderSummary();
          if (chkExcludeUnused.checked) {
            scheduleAutoRefresh();
          }
        });
      })(folderNode, folderChk, counts);

      folderRow.appendChild(folderChk);

      // Color swatch se houver label
      var fSwatch = createSwatch(folderNode.label);
      if (fSwatch) folderRow.appendChild(fSwatch);

      // Ícone de pasta
      folderRow.appendChild(createSvgIcon("folder"));

      // Nome da pasta
      var nameSpan = document.createElement("span");
      nameSpan.className = "collect-tree-name";
      nameSpan.setAttribute("data-tf-design", "collect-tree-folder-name");
      nameSpan.textContent = folderNode.name;
      folderRow.appendChild(nameSpan);

      // Badge de contagem
      var countBadge = document.createElement("span");
      countBadge.className = "collect-tree-count";
      countBadge.setAttribute("data-tf-design", "collect-tree-count");
      countBadge.textContent = (counts.selected === counts.total) ? ("(" + counts.total + ")") : ("(" + counts.selected + "/" + counts.total + ")");
      folderRow.appendChild(countBadge);

      // Click na linha expande/recolhe a pasta
      (function (fPath) {
        var toggleCollapse = function (e) {
          if (e) {
            e.preventDefault();
            e.stopPropagation();
          }
          state.collapsedFolders[fPath] = !state.collapsedFolders[fPath];
          renderTargetsList();
        };

        chevronBtn.addEventListener("click", toggleCollapse);
        folderRow.addEventListener("click", function (e) {
          if (e.target === folderChk || (folderChk && folderChk.contains(e.target))) return;
          if (e.target === chevronBtn || (chevronBtn && chevronBtn.contains(e.target))) return;
          toggleCollapse(e);
        });
      })(folderNode.path);

      container.appendChild(folderRow);

      // Filhos da pasta
      var childrenContainer = document.createElement("div");
      childrenContainer.className = "collect-tree-children" + (isCollapsed ? " is-hidden" : "");
      renderTreeNode(folderNode, childrenContainer, level + 1);
      container.appendChild(childrenContainer);
    }

    // 2. Renderiza itens (composições) desta pasta
    for (var i = 0; i < node.items.length; i++) {
      var target = node.items[i];
      var itemRow = document.createElement("label");
      itemRow.className = "collect-tree-row collect-tree-row--item";
      itemRow.setAttribute("data-tf-design", "collect-tree-item-row");
      itemRow.style.paddingLeft = (6 + level * 18) + "px";
      itemRow.title = target.name || (compWord + " " + target.id);

      // Espaçador do chevron
      var spacer = document.createElement("span");
      spacer.className = "collect-tree-chevron-spacer";
      itemRow.appendChild(spacer);

      // Checkbox
      var itemChk = document.createElement("input");
      itemChk.type = "checkbox";
      itemChk.className = "collect-tree-check";
      itemChk.setAttribute("data-tf-design", "collect-tree-checkbox");
      itemChk.checked = !!target.selected;

      (function (tObj, iChk) {
        iChk.addEventListener("change", function () {
          tObj.selected = iChk.checked;
          renderTargetsList();
          renderSummary();
          if (chkExcludeUnused.checked) {
            scheduleAutoRefresh();
          }
        });
      })(target, itemChk);

      itemRow.appendChild(itemChk);

      // Color swatch se houver label
      var iSwatch = createSwatch(target.label);
      if (iSwatch) itemRow.appendChild(iSwatch);

      // Ícone de composição
      itemRow.appendChild(createSvgIcon("comp"));

      // Nome
      var compName = document.createElement("span");
      compName.className = "collect-tree-name";
      compName.setAttribute("data-tf-design", "collect-tree-comp-name");
      compName.textContent = target.name || (compWord + " " + target.id);
      itemRow.appendChild(compName);

      container.appendChild(itemRow);
    }
  }

  function renderTargetsList() {
    if (!targetList) return;
    var prevScroll = targetList.scrollTop;
    targetList.innerHTML = "";

    if (!state.targets || state.targets.length === 0) {
      var emptyDiv = document.createElement("div");
      emptyDiv.className = "collect-target-empty";
      emptyDiv.textContent = "Nenhuma " + compWord + " encontrada no projeto.";
      targetList.appendChild(emptyDiv);
      return;
    }

    var root = buildTreeStructure(state.targets);
    renderTreeNode(root, targetList, 0);

    targetList.scrollTop = prevScroll;
  }

  var autoRefreshTimer = null;
  function scheduleAutoRefresh() {
    if (autoRefreshTimer) clearTimeout(autoRefreshTimer);
    autoRefreshTimer = setTimeout(function () {
      autoRefreshTimer = null;
      refresh();
    }, 150);
  }

  function selectAllTargets(select) {
    if (!state.targets) return;
    for (var i = 0; i < state.targets.length; i++) {
      state.targets[i].selected = Boolean(select);
    }
    renderTargetsList();
    renderSummary();
    if (chkExcludeUnused.checked) {
      scheduleAutoRefresh();
    }
  }

  function expandAllFolders() {
    state.collapsedFolders = {};
    renderTargetsList();
  }

  function collapseAllFolders() {
    state.collapsedFolders = {};
    function collectPaths(node) {
      for (var f = 0; f < node.foldersList.length; f++) {
        var fn = node.foldersList[f];
        state.collapsedFolders[fn.path] = true;
        collectPaths(fn);
      }
    }
    if (state.targets) {
      var root = buildTreeStructure(state.targets);
      collectPaths(root);
    }
    renderTargetsList();
  }

  btnSelectAllTargets.addEventListener("click", function () { selectAllTargets(true); });
  btnSelectNoneTargets.addEventListener("click", function () { selectAllTargets(false); });
  if (btnExpandAllTargets) {
    btnExpandAllTargets.addEventListener("click", expandAllFolders);
  }
  if (btnCollapseAllTargets) {
    btnCollapseAllTargets.addEventListener("click", collapseAllFolders);
  }

  /* ---------- Regras e Opções Efetivas ---------- */

  function applyModeRules() {
    var hasActiveSelection = chkExcludeUnused.checked;
    if (rowObeyProxy) {
      chkObeyProxy.disabled = isPPro || !hasActiveSelection;
      if (chkObeyProxy.disabled) rowObeyProxy.classList.add("is-disabled");
      else rowObeyProxy.classList.remove("is-disabled");
    }
    if (chkOpenCollected && rowOpenCollected) {
      chkOpenCollected.disabled = chkReportOnly.checked;
      if (chkOpenCollected.disabled) rowOpenCollected.classList.add("is-disabled");
      else rowOpenCollected.classList.remove("is-disabled");
    }
  }

  function effectiveOptions() {
    var excludeUnused = chkExcludeUnused.checked;
    var mode = excludeUnused ? "selected" : "all";
    return {
      mode: mode,
      excludeUnused: excludeUnused,
      reportOnly: chkReportOnly.checked,
      obeyProxy: !isPPro && !chkObeyProxy.disabled && chkObeyProxy.checked,
      reduceProject: excludeUnused && !chkReportOnly.checked,
      reveal: chkReveal.checked,
      postAction: (chkOpenCollected && chkOpenCollected.checked) ? "openCollected" : "exportOnly",
      renameToClipName: chkRenameClipNames.checked,
      previewFiles: isPPro && chkPreviewFiles.checked,
      audioConform: isPPro && chkAudioConform.checked,
      comments: state.comments,
      selectedTargetIds: getSelectedTargetIds()
    };
  }

  /* ---------- Host ---------- */

  function loadHostScripts(callback) {
    try {
      if (window.__adobe_cep__) {
        var extPath = csInterface.getSystemPath(SystemPath.EXTENSION);
        var hostDir = (extPath + "/host").replace(/\\/g, "/");
        csInterface.evalScript(
          '$.evalFile("' + hostDir + '/organizer.jsx"); if ($.global.organizerLoadEngine) { $.global.organizerLoadEngine("' + hostDir + '"); }',
          function () { callback(); }
        );
        return;
      }
    } catch (e) { }
    callback();
  }

  function runScan(opts, callback) {
    if (state.isClosing) {
      if (typeof callback === "function") callback({ success: false, error: "Fechando" });
      return;
    }
    if (!window.__adobe_cep__) {
      callback({ success: false, error: "Abra esta janela dentro do After Effects ou Premiere Pro." });
      return;
    }
    var scanPayload = {
      mode: opts.mode || "all"
    };
    if (opts.mode === "selected") {
      if (isPPro) scanPayload.sequenceIds = opts.selectedTargetIds || [];
      else scanPayload.compIds = opts.selectedTargetIds || [];
    }
    var payloadStr = JSON.stringify(scanPayload).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    csInterface.evalScript("$.global.collectScan('" + payloadStr + "')", function (res) {
      if (state.isClosing) return;
      var parsed = null;
      try { parsed = JSON.parse(res); } catch (e) { parsed = { success: false, error: "Resposta inválida do host: " + res }; }
      callback(parsed);
    });
  }

  /* ---------- Resumo e Estimativa ---------- */

  function renderSummary() {
    var scan = state.scan;
    var est = state.estimate;
    var opts = effectiveOptions();
    state.blocked = false;

    if (!scan) return;

    var warnings = [];
    if (!scan.projectSaved) {
      warnings.push("Salve o projeto antes de coletar.");
      state.blocked = true;
    }

    if (opts.excludeUnused && opts.selectedTargetIds && opts.selectedTargetIds.length === 0) {
      warnings.push("Nenhuma " + compWord + " selecionada na lista acima.");
      state.blocked = true;
    }

    if (!est) {
      if (valResultingSize) {
        valResultingSize.textContent = state.isEstimating ? "Calculando..." : "--";
      }
    } else {
      var size = CollectEngine.formatBytes(est.totalBytes);
      if (valResultingSize) {
        valResultingSize.textContent = size;
      }
      if (est.offlineItems) warnings.push(est.offlineItems + " item(ns) offline no projeto.");
      if (est.missingFiles && est.missingFiles.length) {
        warnings.push(est.missingFiles.length + " arquivo(s) não encontrados no disco.");
      }
      if (est.error) warnings.push(est.error);
    }

    setStatus(warnings.join(" "), false);
    btnCollect.disabled = state.blocked;
  }

  function refresh() {
    if (state.isClosing) return;
    var token = ++state.token;
    applyModeRules();
    var opts = effectiveOptions();

    state.estimate = null;
    state.isEstimating = false;
    if (collectProgressBox) collectProgressBox.classList.add("is-hidden");
    btnCancel.textContent = "Cancelar";
    if (engine) engine.cancel();
    if (valResultingSize) valResultingSize.textContent = "Calculando...";
    if (!state.scan) {
      btnCollect.disabled = true;
    } else {
      renderSummary();
    }

    runScan(opts, function (scan) {
      if (state.isClosing || token !== state.token) return;
      if (!scan || !scan.success) {
        state.scan = null;
        state.isEstimating = false;
        if (valResultingSize) valResultingSize.textContent = "--";
        setStatus((scan && scan.error) || "Falha ao analisar o projeto.", true);
        return;
      }
      state.scan = scan;

      // Inicializa lista de alvos (apenas na primeira carga ou se lista vazia)
      if (!state.targets) {
        var rawTargets = isPPro ? (scan.allSequences || []) : (scan.allComps || []);
        var hasExplicitSelected = false;
        state.targets = [];
        for (var i = 0; i < rawTargets.length; i++) {
          var tObj = rawTargets[i];
          if (tObj.selected) hasExplicitSelected = true;
          state.targets.push({
            id: String(tObj.id || tObj.sequenceID || i),
            name: String(tObj.name || (compWord + " " + (i + 1))),
            selected: Boolean(tObj.selected),
            label: typeof tObj.label === "number" ? tObj.label : 0,
            folders: Array.isArray(tObj.folders) ? tObj.folders : [],
            folderLabels: Array.isArray(tObj.folderLabels) ? tObj.folderLabels : []
          });
        }
        // Estado inicial das pastas: tudo fechado, exceto o caminho das comps
        // selecionadas no painel Project. Sem seleção, nada vem marcado.
        state.collapsedFolders = computeInitialCollapsed(state.targets);
        renderTargetsList();
        if (opts.excludeUnused && getSelectedTargetIds().length > 0) {
          refresh();
          return;
        }
      }

      // Caminho padrão inteligente se usuário ainda não escolheu um específico
      if (!state.destPathChosenByUser && scan.projectPath) {
        var node = getNodeFsModule();
        var pDir = "";
        if (node && node.path) {
          pDir = node.path.dirname(scan.projectPath);
        } else {
          var lastSlash = Math.max(scan.projectPath.lastIndexOf("\\"), scan.projectPath.lastIndexOf("/"));
          pDir = lastSlash >= 0 ? scan.projectPath.substring(0, lastSlash) : "";
        }
        var defaultFolder = (CollectEngine && typeof CollectEngine.defaultCollectFolderName === "function")
          ? CollectEngine.defaultCollectFolderName(scan.projectName)
          : (((scan.projectName || "Projeto").replace(/\.[^.]+$/, "")) + "_Collect");

        var autoDest = (pDir ? (pDir.replace(/\\/g, "/") + "/") : "") + defaultFolder;
        inpDestPath.value = autoDest;
        updateDiskSpaceAvailable(autoDest);
      }

      // Tamanho original do projeto (arquivo .prproj/.aep + mídias)
      var origBytes = 0;
      var nodeModule = getNodeFsModule();
      if (nodeModule && scan.projectPath) {
        try { origBytes += nodeModule.fs.statSync(scan.projectPath).size; } catch (ePrjStat) { }
      }
      if (valOriginalSize) {
        valOriginalSize.textContent = origBytes > 0 ? CollectEngine.formatBytes(origBytes) : "Desconhecido";
      }

      state.isEstimating = !!engine;
      renderSummary();
      if (!engine) return;

      engine.estimate(scan, effectiveOptions()).then(function (est) {
        if (state.isClosing || token !== state.token) return;
        state.isEstimating = false;
        state.estimate = est;
        renderSummary();
      }, function (err) {
        if (state.isClosing || token !== state.token) return;
        state.isEstimating = false;
        if (err && err.canceled) return;
        setStatus("Falha ao calcular o tamanho: " + err, true);
      });
    });
  }

  function recomputeEstimate() {
    if (state.isClosing) return;
    applyModeRules();
    if (!state.scan || !engine) {
      if (engine) engine.cancel();
      state.isEstimating = false;
      renderSummary();
      return;
    }
    var token = ++state.token;
    state.estimate = null;
    state.isEstimating = true;
    renderSummary();
    engine.estimate(state.scan, effectiveOptions()).then(function (est) {
      if (state.isClosing || token !== state.token) return;
      state.isEstimating = false;
      state.estimate = est;
      renderSummary();
    }, function (err) {
      if (state.isClosing || token !== state.token) return;
      state.isEstimating = false;
      if (err && err.canceled) return;
      setStatus("Falha ao calcular o tamanho: " + err, true);
    });
  }

  /* ---------- Eventos de UI ---------- */

  chkExcludeUnused.addEventListener("change", refresh);
  chkRenameClipNames.addEventListener("change", recomputeEstimate);
  chkObeyProxy.addEventListener("change", recomputeEstimate);
  chkReportOnly.addEventListener("change", function () {
    applyModeRules();
    recomputeEstimate();
  });
  if (chkOpenCollected) chkOpenCollected.addEventListener("change", applyModeRules);
  if (btnCalculate) btnCalculate.addEventListener("click", recomputeEstimate);

  // Seleção de Pasta de Destino
  function pickDestinationFolder(defaultDir, defaultFolderName, callback) {
    if (window.cep && window.cep.fs && typeof window.cep.fs.showSaveDialogEx === "function") {
      var res = null;
      try {
        res = window.cep.fs.showSaveDialogEx(
          "Salvar Pasta do Collect",
          defaultDir || "",
          [],
          defaultFolderName || "Projeto_Collect",
          "Pasta do Collect"
        );
      } catch (eDialog) {
        res = null;
      }

      if (res) {
        var chosen = "";
        if (typeof res.data === "string" && res.data.length > 0) chosen = res.data;
        else if (Array.isArray(res.data) && res.data.length > 0 && res.data[0]) chosen = res.data[0];
        if (chosen) { callback(chosen); return; }
      }
    }

    if (window.__adobe_cep__) {
      var escapedPrompt = "Salvar Pasta do Collect".replace(/\\/g, "\\\\").replace(/'/g, "\\'");
      var escapedDir = (defaultDir || "").replace(/\\/g, "/").replace(/'/g, "\\'");
      var escapedName = (defaultFolderName || "Projeto_Collect").replace(/\\/g, "/").replace(/'/g, "\\'");
      csInterface.evalScript("$.global.collectSaveDialog('" + escapedPrompt + "', '" + escapedDir + "', '" + escapedName + "')", function (raw) {
        try {
          var parsed = JSON.parse(raw);
          if (parsed && parsed.success && parsed.folderPath) callback(parsed.folderPath);
          else callback(null);
        } catch (eP) {
          callback(null);
        }
      });
      return;
    }

    callback(null);
  }

  btnBrowseDest.addEventListener("click", function () {
    var cur = inpDestPath.value || "";
    var defDir = "";
    var defName = "Projeto_Collect";
    if (cur) {
      var slash = Math.max(cur.lastIndexOf("/"), cur.lastIndexOf("\\"));
      if (slash >= 0) {
        defDir = cur.substring(0, slash);
        defName = cur.substring(slash + 1);
      }
    }
    pickDestinationFolder(defDir, defName, function (chosen) {
      if (chosen) {
        inpDestPath.value = String(chosen).replace(/\\/g, "/");
        state.destPathChosenByUser = true;
        updateDiskSpaceAvailable(chosen);
      }
    });
  });

  // Modal de Comentários
  btnComments.addEventListener("click", function () {
    txtComments.value = state.comments;
    commentsBackdrop.classList.add("is-open");
    txtComments.focus();
  });

  function closeComments() {
    commentsBackdrop.classList.remove("is-open");
  }

  btnCommentsOk.addEventListener("click", function () {
    state.comments = txtComments.value;
    closeComments();
  });
  btnCommentsCancel.addEventListener("click", closeComments);
  commentsBackdrop.addEventListener("click", function (ev) {
    if (ev.target === commentsBackdrop) closeComments();
  });

  function revealFolderDirectly(folderPath) {
    try {
      var req = (window.cep_node && window.cep_node.require) ? window.cep_node.require
        : (typeof require === "function" ? require : null);
      if (req) {
        var cp = req("child_process");
        var winPath = String(folderPath || "").replace(/\//g, "\\");
        cp.exec('explorer.exe "' + winPath + '"');
      }
    } catch (eExp) { }
  }

  function copyDirRecursiveSync(node, srcDir, destDir) {
    if (!node || !node.fs || !node.fs.existsSync(srcDir)) return 0;
    if (!node.fs.existsSync(destDir)) node.fs.mkdirSync(destDir, { recursive: true });
    var count = 0;
    var entries = node.fs.readdirSync(srcDir);
    for (var i = 0; i < entries.length; i++) {
      var sPath = node.path.join(srcDir, entries[i]);
      var dPath = node.path.join(destDir, entries[i]);
      try {
        var stat = node.fs.statSync(sPath);
        if (stat.isDirectory()) {
          count += copyDirRecursiveSync(node, sPath, dPath);
        } else {
          if (!node.fs.existsSync(dPath)) {
            node.fs.copyFileSync(sPath, dPath);
            count++;
          }
        }
      } catch (eC) { }
    }
    return count;
  }

  /* ---------- Execução do Collect ---------- */

  function executeCollect() {
    if (state.blocked || !state.scan) return;

    if (autoRefreshTimer) {
      clearTimeout(autoRefreshTimer);
      autoRefreshTimer = null;
      btnCollect.disabled = true;
      setStatus("Sincronizando seleção antes de coletar...", false);
      runScan(effectiveOptions(), function (freshScan) {
        if (freshScan && freshScan.success) {
          state.scan = freshScan;
        }
        renderSummary();
        if (!state.blocked && state.scan) {
          executeCollect();
        }
      });
      return;
    }

    if (state.isEstimating && engine) {
      engine.cancel();
      state.isEstimating = false;
    }

    var chosenPath = (inpDestPath.value || "").trim();
    if (!chosenPath) {
      btnBrowseDest.click();
      return;
    }

    var opts = effectiveOptions();
    var scan = state.scan;
    var node = getNodeFsModule();

    try {
      var rootPath = String(chosenPath).replace(/\\/g, "/").replace(/\/+$/, "");
      rootPath = rootPath.replace(/\.(aep|aepx|prproj)$/i, "");
      var footageRoot = rootPath + "/(Footage)";

      var appVer = "";
      try {
        appVer = (csInterface.getHostEnvironment && csInterface.getHostEnvironment())
          ? (csInterface.getHostEnvironment().appVersion || "")
          : "";
      } catch (eVer) { }
      var hostAppLabel = (isPPro ? "Adobe Premiere Pro " : "Adobe After Effects ") + appVer;

      btnCollect.disabled = true;
      btnCancel.disabled = true;
      setStatus("Iniciando coleta...", false);

      if (opts.reportOnly) {
        var offlineCount = 0;
        var proxyCount = 0;
        if (scan.items) {
          for (var iOff = 0; iOff < scan.items.length; iOff++) {
            if (scan.items[iOff].missing) offlineCount++;
            if (scan.items[iOff].proxyPath) proxyCount++;
          }
        }
        var reportData = {
          date: new Date().toLocaleString(),
          hostName: hostAppLabel,
          projectPath: scan.projectPath,
          destPath: rootPath,
          modeLabel: (opts.excludeUnused ? "Clipes Usados" : "Tudo") + " (Apenas Relatório)",
          collectedCount: 0,
          totalBytes: 0,
          offlineCount: offlineCount,
          proxyCount: proxyCount,
          effects: scan.effects || [],
          comments: opts.comments,
          files: []
        };
        var reportContent = CollectEngine.buildReportText(reportData);

        try {
          if (node && node.fs) {
            if (!node.fs.existsSync(rootPath)) node.fs.mkdirSync(rootPath, { recursive: true });
            node.fs.writeFileSync(rootPath + "/Report.txt", reportContent, "utf8");
          }
        } catch (eW) { }

        if (opts.reveal) {
          revealFolderDirectly(rootPath);
        }

        setStatus("Relatório salvo em: " + rootPath + "/Report.txt", false);
        btnCollect.disabled = false;
        btnCancel.disabled = false;
        btnCancel.textContent = "Fechar";
        return;
      }

      var readdirSyncFn = null;
      if (node && node.fs) {
        readdirSyncFn = function (d) {
          try { return node.fs.readdirSync(d); } catch (e) { return []; }
        };
      }

      var plan = CollectEngine.buildCollectPlan(scan, opts, footageRoot, readdirSyncFn);
      var copies = plan.fileCopies;
      var fileMap = plan.fileMap;
      var folderMap = plan.folderMap;

      var rootPathExistedBefore = false;
      try {
        if (node && node.fs) {
          rootPathExistedBefore = node.fs.existsSync(rootPath);
          if (rootPathExistedBefore && node.fs.readdirSync(rootPath).length > 0) {
            setStatus("A pasta de destino já existe e não está vazia. Escolha uma nova pasta.", true);
            btnCollect.disabled = false;
            btnCancel.disabled = false;
            return;
          }
          if (!rootPathExistedBefore) node.fs.mkdirSync(rootPath, { recursive: true });
          if (copies.length > 0 && !node.fs.existsSync(footageRoot)) {
            node.fs.mkdirSync(footageRoot, { recursive: true });
          }
          node.fs.writeFileSync(rootPath + "/.collect_in_progress", "Em andamento: " + new Date().toISOString(), "utf8");
        }
      } catch (eDir) {
        setStatus("Falha ao criar pastas de destino: " + eDir.message, true);
        btnCollect.disabled = false;
        btnCancel.disabled = false;
        return;
      }

      // Cópia de pastas exclusivas do Premiere Pro (Preview Files e Audio Conform)
      if (isPPro && node && node.fs && scan.projectPath) {
        var prjDir = node.path.dirname(scan.projectPath);
        if (opts.previewFiles) {
          var vPrev = node.path.join(prjDir, "Adobe Premiere Pro Video Previews");
          if (node.fs.existsSync(vPrev)) {
            setStatus("Copiando arquivos de Preview de vídeo...", false);
            copyDirRecursiveSync(node, vPrev, node.path.join(rootPath, "Adobe Premiere Pro Video Previews"));
          }
        }
        if (opts.audioConform) {
          var aPrev = node.path.join(prjDir, "Adobe Premiere Pro Audio Previews");
          if (node.fs.existsSync(aPrev)) {
            setStatus("Copiando arquivos de conformidade de áudio...", false);
            copyDirRecursiveSync(node, aPrev, node.path.join(rootPath, "Adobe Premiere Pro Audio Previews"));
          }
          var mCache = node.path.join(prjDir, "Media Cache");
          if (node.fs.existsSync(mCache)) {
            copyDirRecursiveSync(node, mCache, node.path.join(rootPath, "Media Cache"));
          }
        }
      }

      state.isCopying = true;
      state.copyCanceled = false;
      btnCollect.disabled = true;
      btnCancel.disabled = false;
      btnCancel.textContent = "Cancelar";

      if (collectProgressBox) {
        collectProgressBox.classList.remove("is-hidden");
        collectProgressBar.style.width = "0%";
        collectPercent.textContent = "0%";
        collectEta.textContent = "Tempo restante estimado: calculando...";
      }

      var index = 0;
      var copiedCount = 0;
      var totalBytesCopied = 0;
      var totalPlanBytes = (state.estimate && state.estimate.totalBytes) || 0;
      var copyStartTime = Date.now();
      var collectedFileRelList = [];
      var newlyCopiedDestList = [];

      function cleanEmptyFoldersSync(dirPath) {
        try {
          if (!node || !node.fs || !node.fs.existsSync(dirPath)) return;
          var entries = node.fs.readdirSync(dirPath);
          for (var eI = 0; eI < entries.length; eI++) {
            var full = node.path.join(dirPath, entries[eI]);
            try {
              if (node.fs.statSync(full).isDirectory()) {
                cleanEmptyFoldersSync(full);
                if (node.fs.readdirSync(full).length === 0) {
                  node.fs.rmdirSync(full);
                }
              }
            } catch (eSub) { }
          }
        } catch (eC) { }
      }

      function handleCopyCanceled() {
        state.isCopying = false;
        setStatus("Cancelando e limpando arquivos parciais...", false);
        if (collectEta) collectEta.textContent = "Coleta cancelada";

        try {
          if (node && node.fs) {
            var marker = rootPath + "/.collect_in_progress";
            if (node.fs.existsSync(marker)) node.fs.unlinkSync(marker);

            for (var cDel = 0; cDel < newlyCopiedDestList.length; cDel++) {
              try {
                var destFile = newlyCopiedDestList[cDel];
                if (node.fs.existsSync(destFile)) node.fs.unlinkSync(destFile);
              } catch (eDelFile) { }
            }

            cleanEmptyFoldersSync(footageRoot);
            try {
              if (node.fs.existsSync(footageRoot) && node.fs.readdirSync(footageRoot).length === 0) {
                node.fs.rmdirSync(footageRoot);
              }
            } catch (eFootage) { }

            if (!rootPathExistedBefore && node.fs.existsSync(rootPath)) {
              cleanEmptyFoldersSync(rootPath);
              try {
                if (node.fs.readdirSync(rootPath).length === 0) {
                  node.fs.rmdirSync(rootPath);
                }
              } catch (eRmdir) { }
            }
          }
        } catch (eM) { }

        setStatus("Operação cancelada: os arquivos parciais copiados foram removidos.", false);
        btnCollect.disabled = false;
        btnCancel.disabled = false;
        btnCancel.textContent = "Fechar";
      }

      function copyNext() {
        if (state.copyCanceled || state.isClosing) {
          handleCopyCanceled();
          return;
        }

        if (index >= copies.length) {
          finalizeProject();
          return;
        }

        var pair = copies[index++];
        var pct = Math.round((index / copies.length) * 100);
        if (collectProgressBar) collectProgressBar.style.width = pct + "%";
        if (collectPercent) collectPercent.textContent = pct + "%";

        var elapsedSec = (Date.now() - copyStartTime) / 1000;
        if (elapsedSec > 0.8 && index > 0 && collectEta) {
          var secRemaining = 0;
          if (totalPlanBytes > 0 && totalBytesCopied > 0) {
            var bps = totalBytesCopied / elapsedSec;
            secRemaining = Math.round(Math.max(0, totalPlanBytes - totalBytesCopied) / bps);
          } else {
            var fps = index / elapsedSec;
            secRemaining = Math.round((copies.length - index) / fps);
          }
          var etaFn = (CollectEngine && typeof CollectEngine.formatTimeRemaining === "function")
            ? CollectEngine.formatTimeRemaining
            : function (s) { return s + " s"; };
          collectEta.textContent = "Tempo restante estimado: " + etaFn(secRemaining);
        }

        var fileBase = pair.src.substring(Math.max(pair.src.lastIndexOf("/"), pair.src.lastIndexOf("\\")) + 1);
        var sizeText = "";

        try {
          if (node && node.fs) {
            var srcStat = null;
            try { srcStat = node.fs.statSync(pair.src); } catch (eSt) { }
            if (srcStat && typeof srcStat.isFile === "function" && !srcStat.isFile()) {
              setTimeout(copyNext, 1);
              return;
            }
            if (srcStat && srcStat.size) {
              sizeText = " (" + CollectEngine.formatBytes(srcStat.size) + ")";
            }
            setStatus("Copiando: \"" + fileBase + "\"" + sizeText + "...", false);

            var destDir = node.path.dirname(pair.dest);
            if (!node.fs.existsSync(destDir)) node.fs.mkdirSync(destDir, { recursive: true });
            if (!node.fs.existsSync(pair.dest)) {
              node.fs.copyFileSync(pair.src, pair.dest);
              copiedCount++;
              newlyCopiedDestList.push(pair.dest);
              if (srcStat && srcStat.size) {
                totalBytesCopied += srcStat.size;
              } else {
                try { totalBytesCopied += node.fs.statSync(pair.dest).size; } catch (eS) { }
              }
            }
            var relPath = pair.dest.replace(rootPath, "").replace(/^[\\/]+/, "");
            collectedFileRelList.push(relPath);
          }
        } catch (eCp) { }

        if (state.copyCanceled || state.isClosing) {
          handleCopyCanceled();
          return;
        }

        setTimeout(copyNext, 1);
      }

      var collectCompletedOnce = false;

      function writeReportAndClearMarker() {
        var finProxyCount = 0;
        if (scan.items) {
          for (var pI = 0; pI < scan.items.length; pI++) {
            if (scan.items[pI].proxyPath) finProxyCount++;
          }
        }

        var offlineTotal = (typeof plan.offlineItems === "number")
          ? plan.offlineItems
          : (plan.offlineItems && plan.offlineItems.length ? plan.offlineItems.length : 0);

        var reportData = {
          date: new Date().toLocaleString(),
          hostName: hostAppLabel,
          projectPath: scan.projectPath,
          destPath: rootPath,
          modeLabel: (opts.excludeUnused ? "Clipes Usados" : "Tudo") + (opts.reduceProject ? " (Reduzir Projeto: Sim)" : ""),
          collectedCount: copiedCount,
          totalBytes: totalBytesCopied,
          offlineCount: offlineTotal,
          proxyCount: finProxyCount,
          effects: scan.effects || [],
          comments: opts.comments,
          files: collectedFileRelList
        };
        var reportContent = CollectEngine.buildReportText(reportData);

        try {
          if (node && node.fs) {
            var reportPath = rootPath + "/Report.txt";
            node.fs.writeFileSync(reportPath, reportContent, "utf8");
            if (newlyCopiedDestList.indexOf(reportPath) === -1) {
              newlyCopiedDestList.push(reportPath);
            }
            var marker = rootPath + "/.collect_in_progress";
            if (node.fs.existsSync(marker)) node.fs.unlinkSync(marker);
          }
        } catch (eRep) { }
      }

      function cleanupPrinIfExportOnly() {
        if (opts.postAction === "openCollected") return;
        try {
          if (node && node.fs && node.fs.existsSync(rootPath)) {
            var entries = node.fs.readdirSync(rootPath);
            for (var pIdx = 0; pIdx < entries.length; pIdx++) {
              if (/\.prin$/i.test(entries[pIdx])) {
                try { node.fs.unlinkSync(rootPath + "/" + entries[pIdx]); } catch (eUnl) { }
              }
            }
          }
        } catch (ePrin) { }
      }

      function completeCollectSuccess() {
        if (collectCompletedOnce) return;
        collectCompletedOnce = true;
        state.isCopying = false;

        writeReportAndClearMarker();
        cleanupPrinIfExportOnly();

        if (opts.reveal) {
          revealFolderDirectly(rootPath);
        }

        setStatus("Projeto e " + copiedCount + " arquivo(s) salvos em: " + rootPath, false);
        if (collectEta) collectEta.textContent = "Concluído";
        btnCollect.disabled = false;
        btnCancel.disabled = false;
        btnCancel.textContent = "Fechar";
      }

      function cleanupCreatedAndFail(errorMsg) {
        try {
          if (node && node.fs) {
            var marker = rootPath + "/.collect_in_progress";
            if (node.fs.existsSync(marker)) node.fs.unlinkSync(marker);

            for (var cDel = 0; cDel < newlyCopiedDestList.length; cDel++) {
              try {
                var destFile = newlyCopiedDestList[cDel];
                if (node.fs.existsSync(destFile)) node.fs.unlinkSync(destFile);
              } catch (eDelFile) { }
            }

            cleanEmptyFoldersSync(footageRoot);
            try {
              if (node.fs.existsSync(footageRoot) && node.fs.readdirSync(footageRoot).length === 0) {
                node.fs.rmdirSync(footageRoot);
              }
            } catch (eFootage) { }

            if (!rootPathExistedBefore && node.fs.existsSync(rootPath)) {
              cleanEmptyFoldersSync(rootPath);
              try {
                if (node.fs.readdirSync(rootPath).length === 0) {
                  node.fs.rmdirSync(rootPath);
                }
              } catch (eRmdir) { }
            }
          }
        } catch (eCleanErr) { }
        cleanupAndFail(errorMsg);
      }

      function finalizeProject() {
        btnCancel.disabled = true;
        if (collectProgressBar) collectProgressBar.style.width = "100%";
        if (collectPercent) collectPercent.textContent = "100%";
        if (collectEta) collectEta.textContent = "Finalizando projeto...";

        if (isPPro) {
          setStatus("Salvando projeto original...", false);
          csInterface.evalScript("$.global.collectSaveProject()", function (resSaveOrig) {
            var saveOrigOk = false;
            try { saveOrigOk = JSON.parse(resSaveOrig).success; } catch (eSO) { }
            if (!saveOrigOk) {
              cleanupCreatedAndFail("Falha ao salvar o projeto original: " + resSaveOrig);
              return;
            }

            var prprojFileName = scan.projectName || "Projeto.prproj";
            if (!/\.prproj$/i.test(prprojFileName)) prprojFileName += ".prproj";
            var finalPrprojPath = rootPath + "/" + prprojFileName;

            setStatus("Atualizando referências de mídia e proxy no .prproj...", false);
            try {
              if (!node || !node.fs || !node.zlib) {
                throw new Error("Módulos Node (fs/zlib) indisponíveis na janela CEP.");
              }
              var rawBuf = node.fs.readFileSync(scan.projectPath);
              var isGzip = rawBuf.length >= 2 && rawBuf[0] === 0x1f && rawBuf[1] === 0x8b;
              var xmlStr = isGzip ? node.zlib.gunzipSync(rawBuf).toString("utf8") : rawBuf.toString("utf8");
              var rewrittenXml = CollectEngine.rewritePrprojXml(
                xmlStr,
                fileMap,
                folderMap,
                rootPath.replace(/\//g, "\\")
              );
              var outBuf = isGzip
                ? node.zlib.gzipSync(Buffer.from(rewrittenXml, "utf8"))
                : Buffer.from(rewrittenXml, "utf8");
              node.fs.writeFileSync(finalPrprojPath, outBuf);
              newlyCopiedDestList.push(finalPrprojPath);
            } catch (ePrproj) {
              cleanupCreatedAndFail("Falha ao reescrever caminhos no .prproj: " + (ePrproj.message || ePrproj));
              return;
            }

            // Grava Report.txt e remove .collect_in_progress ANTES de closeDocument/openDocument
            // para evitar perda de callback do CEP quando o Premiere troca de projeto
            writeReportAndClearMarker();

            var shouldOpenCollected = (opts.postAction === "openCollected");
            var hasRenamedProjectItems = false;
            if (plan.itemNames) {
              for (var kName in plan.itemNames) {
                if (plan.itemNames.hasOwnProperty(kName)) {
                  hasRenamedProjectItems = true;
                  break;
                }
              }
            }

            // Se for "Apenas Exportar" e não precisar reduzir projeto no DOM do Premiere, finaliza imediatamente sem fechar o projeto atual
            if (!shouldOpenCollected && !opts.reduceProject) {
              completeCollectSuccess();
              return;
            }

            setStatus(
              opts.reduceProject
                ? (shouldOpenCollected ? "Abrindo cópia coletada e reduzindo projeto..." : "Reduzindo projeto coletado e restaurando projeto atual...")
                : "Abrindo projeto coletado...",
              false
            );

            var pproFinalizeOpts = {
              finalPrprojPath: finalPrprojPath,
              origProjectPath: scan.projectPath,
              itemNames: hasRenamedProjectItems ? plan.itemNames : {},
              mode: opts.mode,
              reduceProject: opts.reduceProject,
              openCollected: shouldOpenCollected,
              selectedSequenceIds: opts.selectedTargetIds || []
            };
            var pproPayload = JSON.stringify(pproFinalizeOpts).replace(/\\/g, "\\\\").replace(/'/g, "\\'");

            // Watchdog de segurança: no Premiere Pro, closeDocument/openDocument pode descartar o callback do evalScript
            var pproWatchdog = setTimeout(function () {
              completeCollectSuccess();
            }, 3500);

            csInterface.evalScript("$.global.collectFinalize('" + pproPayload + "')", function (resFinal) {
              clearTimeout(pproWatchdog);
              var finalOk = false;
              try { finalOk = JSON.parse(resFinal).success; } catch (eFinPPro) { }
              if (!finalOk && resFinal && resFinal !== "undefined" && resFinal !== "EvalScript error.") {
                cleanupCreatedAndFail("Falha ao finalizar projeto no Premiere Pro: " + resFinal);
                return;
              }
              completeCollectSuccess();
            });
          });
          return;
        }

        // Fluxo After Effects (.aepx intermediário em %TEMP%\TidyFlow)
        setStatus("Gravando cópia .aepx...", false);

        var tempDir = "";
        try {
          if (node && node.os) {
            tempDir = node.path.join(node.os.tmpdir(), "TidyFlow").replace(/\\/g, "/");
            if (!node.fs.existsSync(tempDir)) node.fs.mkdirSync(tempDir, { recursive: true });
          }
        } catch (eT) { }

        var aepxPath = tempDir + "/collect_" + Date.now() + ".aepx";
        var finalAepPath = rootPath + "/" + (scan.projectName || "Projeto.aep");

        csInterface.evalScript("$.global.collectSaveProject()", function () {
          csInterface.evalScript("$.global.collectSaveAepx('" + aepxPath.replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "')", function (resSave) {
            var saveOk = false;
            try { saveOk = JSON.parse(resSave).success; } catch (e) { }
            if (!saveOk) {
              cleanupAndFail("Falha ao salvar cópia .aepx: " + resSave);
              return;
            }

            setStatus("Reescrevendo caminhos no projeto XML...", false);
            try {
              if (node && node.fs) {
                var xmlText = node.fs.readFileSync(aepxPath, "utf8");
                var rewrittenXml = CollectEngine.rewriteAepxXml(xmlText, fileMap, folderMap);
                node.fs.writeFileSync(aepxPath, rewrittenXml, "utf8");
              }
            } catch (eXml) {
              cleanupAndFail("Falha ao reescrever caminhos no .aepx: " + eXml.message);
              return;
            }

            writeReportAndClearMarker();

            setStatus("Finalizando projeto no After Effects...", false);
            var compIdsList = opts.selectedTargetIds || [];
            var shouldOpenAeCollected = (opts.postAction === "openCollected");
            var finalizeOpts = {
              aepxPath: aepxPath,
              finalAepPath: finalAepPath,
              origProjectPath: scan.projectPath,
              openCollected: shouldOpenAeCollected,
              itemNames: plan.itemNames,
              reduceProject: opts.reduceProject,
              compIds: compIdsList
            };

            var payload = JSON.stringify(finalizeOpts).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
            csInterface.evalScript("$.global.collectFinalize('" + payload + "')", function (resFinal) {
              var finalOk = false;
              try { finalOk = JSON.parse(resFinal).success; } catch (eFin) { }
              if (!finalOk) {
                cleanupAndFail("Falha ao finalizar projeto no host: " + resFinal);
                return;
              }
              completeCollectSuccess();
            });
          });
        });
      }

      function cleanupAndFail(errorMsg) {
        state.isCopying = false;
        if (collectEta) collectEta.textContent = "Falha na coleta";
        setStatus(errorMsg, true);
        btnCollect.disabled = false;
        btnCancel.disabled = false;
        btnCancel.textContent = "Fechar";
      }

      copyNext();
    } catch (errCollect) {
      state.isCopying = false;
      setStatus("Erro na coleta: " + ((errCollect && errCollect.message) || errCollect), true);
      btnCollect.disabled = false;
      btnCancel.disabled = false;
      btnCancel.textContent = "Fechar";
    }
  }

  btnCollect.addEventListener("click", function () {
    executeCollect();
  });

  window.addEventListener("focus", function () {
    if (!state.isClosing && !state.isCopying) {
      refresh();
    }
  });

  function closeWindow() {
    if (state.isClosing) return;
    state.isClosing = true;
    state.copyCanceled = true;
    if (engine) engine.cancel();
    try {
      if (window.opener) {
        window.close();
        return;
      }
      if (window.__adobe_cep__) {
        csInterface.closeExtension();
        return;
      }
    } catch (e) { }
    window.close();
  }

  window.addEventListener("beforeunload", function () {
    state.isClosing = true;
    state.copyCanceled = true;
    if (engine) engine.cancel();
  });

  btnCancel.addEventListener("click", function () {
    if (state.isCopying) {
      state.copyCanceled = true;
      setStatus("Cancelando coleta...", false);
      btnCancel.disabled = true;
      return;
    }
    closeWindow();
  });

  document.addEventListener("keydown", function (ev) {
    if (ev.key === "F5" || ((ev.ctrlKey || ev.metaKey) && (ev.key === "r" || ev.key === "R"))) {
      ev.preventDefault();
      window.location.reload();
      return;
    }
    if (ev.key !== "Escape") return;
    if (commentsBackdrop.classList.contains("is-open")) {
      closeComments();
      return;
    }
    if (state.isCopying) {
      state.copyCanceled = true;
      setStatus("Cancelando coleta...", false);
      btnCancel.disabled = true;
      return;
    }
    closeWindow();
  });

  try {
    if (window.__adobe_cep__ && csInterface && typeof csInterface.addEventListener === "function") {
      csInterface.addEventListener("com.tidyflow.collect.open", function () {
        if (!state.isCopying) {
          window.location.reload();
        } else {
          triggerWin32Resize(600, 750);
        }
      });
    }
  } catch (eEvt) { }

  /* ---------- Inicialização e Isolamento por Host ---------- */

  function triggerWin32Resize(width, height) {
    try {
      var req = (window.cep_node && window.cep_node.require) ? window.cep_node.require
        : (typeof require === "function" ? require : null);
      if (!req) return;
      var cp = req("child_process");
      var fs = req("fs");
      var p = req("path");
      var extPath = csInterface.getSystemPath(SystemPath.EXTENSION);
      if (!extPath) return;
      var cleanExt = extPath.replace(/^file:\/\/\/?/i, "").replace(/^[\\\/]([a-zA-Z]:)/, "$1").replace(/\//g, "\\");
      var sx = window.screenX || window.screenLeft || 0;
      var sy = window.screenY || window.screenTop || 0;
      try {
        var rectFile = p.join(cleanExt, "scripts", "collect_panel_rect.json");
        fs.writeFileSync(rectFile, JSON.stringify({
          screenX: sx,
          screenY: sy,
          innerW: window.innerWidth || document.documentElement.clientWidth || 0,
          innerH: window.innerHeight || document.documentElement.clientHeight || 0,
          outerW: window.outerWidth || 0,
          outerH: window.outerHeight || 0,
          ts: Date.now()
        }), "utf8");
      } catch (eWrite) { }
      var psScript = p.join(cleanExt, "scripts", "resize_window.ps1");
      var w = width || 600;
      var h = height || 750;
      var cmd = 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "' + psScript + '" -Width ' + w + ' -Height ' + h + ' -CollectX ' + sx + ' -CollectY ' + sy;
      cp.exec(cmd, { timeout: 4000 }, function (err, stdout) {
        if (!err && stdout) log("info", "Win32 resize: " + stdout);
      });
    } catch (eResize) { }
  }

  // Trava a janela em 600x750
  triggerWin32Resize(600, 750);
  setTimeout(function () { triggerWin32Resize(600, 750); }, 300);
  setTimeout(function () { triggerWin32Resize(600, 750); }, 800);

  if (isPPro) {
    document.body.classList.add("is-ppro");
    lblTargetTitle.textContent = "Sequências";
  } else {
    document.body.classList.add("is-aeft");
    lblTargetTitle.textContent = "Composições";
  }

  var resizeSnapTimer = null;
  window.addEventListener("resize", function () {
    var curW = window.innerWidth || document.documentElement.clientWidth;
    var curH = window.innerHeight || document.documentElement.clientHeight;
    if (Math.abs(curW - 600) > 4 || Math.abs(curH - 750) > 4) {
      if (resizeSnapTimer) clearTimeout(resizeSnapTimer);
      resizeSnapTimer = setTimeout(function () {
        triggerWin32Resize(600, 750);
      }, 150);
    }
  });

  applyModeRules();
  loadHostScripts(refresh);
})();
