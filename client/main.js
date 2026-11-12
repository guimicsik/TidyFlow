(function () {
  var csInterface = new CSInterface();
  var presetManager = new PresetManager(csInterface);
  var isPPro = presetManager.isPremierePro();
  var hostAppName = presetManager.getHostDisplayName();
  var compWordPlural = isPPro ? "Sequências" : "Composições";
  var compWordLowerPlural = isPPro ? "sequências" : "composições";
  var compWordSingular = isPPro ? "sequência" : "composição";

  // Chaves de storage centralizadas no PresetManager (fallback local por segurança)
  var KEYS = (typeof PresetManager !== "undefined" && PresetManager.STORAGE_KEYS) || {
    rollbackSnapshot: "ae_organizer_rollback_snapshot",
    saveProject: "ae_organizer_save_project",
    deleteEmpty: "ae_organizer_delete_empty"
  };

  var noticeText = document.getElementById("noticeText");
  var presetSelect = document.getElementById("presetSelect");
  var btnOpenPresetBuilder = document.getElementById("btnOpenPresetBuilder");
  var btnOrganize = document.getElementById("btnOrganize");
  var btnCreateStructure = document.getElementById("btnCreateStructure");
  var btnMediaOnly = document.getElementById("btnMediaOnly");
  var chkSaveProject = document.getElementById("chkSaveProject");
  var chkDeleteEmptyFolders = document.getElementById("chkDeleteEmptyFolders");
  var chkGroupBySourceFolder = document.getElementById("chkGroupBySourceFolder");
  var btnRollback = document.getElementById("btnRollback");
  var rollbackModalBackdrop = document.getElementById("rollbackModalBackdrop");
  var btnRollbackSaveAndContinue = document.getElementById("btnRollbackSaveAndContinue");
  var btnRollbackContinueWithoutSave = document.getElementById("btnRollbackContinueWithoutSave");
  var btnRollbackCancel = document.getElementById("btnRollbackCancel");
  var statusMsg = document.getElementById("statusMsg");

  if (isPPro) {
    document.title = "TidyFlow — Premiere Pro";
    if (noticeText) {
      noticeText.textContent = "Selecione as sequências no painel Project antes de organizar.";
    }
  }

  var activePreset = presetManager.getActivePreset();

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

  function setStatus(text, type) {
    statusMsg.textContent = text || "";
    statusMsg.className = type || "";
    // Todo erro exibido no painel tambem vai para o OrgLog (diagnostico em campo)
    if (type === "error") {
      try {
        if (window.OrgLog) OrgLog.error("panel", text || "");
      } catch (eLog) { }
    }
  }

  function setBusy(isBusy) {
    btnOrganize.disabled = isBusy;
    if (btnCreateStructure) btnCreateStructure.disabled = isBusy;
    btnMediaOnly.disabled = isBusy;
    if (btnOpenCollect) btnOpenCollect.disabled = isBusy;
    if (presetSelect) {
      presetSelect.disabled = isBusy;
      if (presetSelect.__neoSelect) {
        presetSelect.__neoSelect.update();
      }
    }
    if (btnOpenPresetBuilder) btnOpenPresetBuilder.disabled = isBusy;
    if (chkSaveProject) chkSaveProject.disabled = isBusy;
    if (chkDeleteEmptyFolders) chkDeleteEmptyFolders.disabled = isBusy;
    if (chkGroupBySourceFolder) chkGroupBySourceFolder.disabled = isBusy;
    if (btnRollback) btnRollback.disabled = isBusy;
  }

  function syncRollbackSnapshotToLocalStorage() {
    try {
      csInterface.evalScript("$.global.getRollbackSnapshotJson()", function (snapJson) {
        if (snapJson && snapJson !== "EvalScript error." && snapJson !== "undefined") {
          try {
            localStorage.setItem(KEYS.rollbackSnapshot, snapJson);
          } catch (eLs) {
            // Cota estourada: o snapshot continua vivo no host, mas o painel perde a
            // copia de seguranca entre sessoes. Registrar para diagnostico.
            try {
              if (window.OrgLog) {
                OrgLog.warn("panel", "Falha ao salvar snapshot de rollback no localStorage", eLs);
              }
            } catch (eLog) { }
          }
        }
      });
    } catch (e) { }
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
    trigger.setAttribute("data-tf-design", "main-preset-trigger");
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
          item.setAttribute("data-tf-design", "main-preset-option");

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

  // Reduzir o projeto remove itens (acao destrutiva). Sempre que estiver ativo, o
  // salvamento previo do projeto é obrigatório: sem isso o usuario nao teria como
  // voltar atras. Os toggles vem de chaves independentes no localStorage, entao o
  // par invalido (reduzir=on, salvar=off) pode reaparecer a cada carga.
  function syncPresetsAndToggles() {
    var list = presetManager.listPresets();
    var currentName = presetManager.getActivePresetName();
    activePreset = presetManager.loadPreset(currentName);

    if (presetSelect) {
      presetSelect.innerHTML = "";
      for (var i = 0; i < list.length; i++) {
        var opt = document.createElement("option");
        opt.value = list[i].presetName;
        opt.textContent = list[i].presetName + (list[i].isBuiltIn ? " (Default)" : "");
        if (list[i].presetName === activePreset.presetName) {
          opt.selected = true;
        }
        presetSelect.appendChild(opt);
      }
      setupNeoSelect(presetSelect);
    }

    var s = activePreset.settings || {};
    if (chkDeleteEmptyFolders) {
      chkDeleteEmptyFolders.checked = (s.deleteEmptyFolders !== false);
    }

    try {
      var savedSave = localStorage.getItem(KEYS.saveProject);
      if (chkSaveProject) {
        chkSaveProject.checked = savedSave !== null ? (savedSave === "true") : (s.saveProjectBefore !== false);
      }
      if (chkGroupBySourceFolder) {
        // Reflete o estado real das pastas (fonte única: regras do preset)
        var anyOn = false, anyOff = false;
        (function scan(nodes) {
          for (var i = 0; i < (nodes || []).length; i++) {
            if (nodes[i].rules && nodes[i].rules.groupBySourceFolder === false) anyOff = true;
            else anyOn = true;
            scan(nodes[i].children);
          }
        })(activePreset.tree);
        chkGroupBySourceFolder.checked = (anyOn || anyOff) ? anyOn : (s.groupBySourceFolder !== false);
      }
    } catch (e) { }

    updateGroupSourceIndicator();
  }

  // Sinaliza quando alguma pasta do preset tem "Pasta de Origem" desativada nas Regras e Filtros
  function updateGroupSourceIndicator() {
    if (!chkGroupBySourceFolder) return;
    var tile = chkGroupBySourceFolder.parentNode;
    var note = document.getElementById("groupSourceNote");
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
    if (activePreset) walk(activePreset.tree);

    // Nenhuma pasta com a tag: desliga. Todas ou algumas: ligado (verde / amarelo)
    if (total > 0) chkGroupBySourceFolder.checked = (missing.length < total);

    if (missing.length && missing.length < total) {
      tile.classList.add("partial");
      if (note) {
        note.style.display = "block";
        note.textContent = "Atenção: " + (missing.length === 1 ? "a pasta " : "as pastas ") +
          missing.join(", ") + " não usa(m) 'Pasta de Origem' nas Regras e Filtros.";
      }
    } else {
      tile.classList.remove("partial");
      if (note) {
        note.style.display = "none";
        note.textContent = "";
      }
    }
  }

  function persistTogglesToActivePreset() {
    if (!activePreset) return;
    if (!activePreset.settings) activePreset.settings = {};

    if (chkSaveProject) {
      activePreset.settings.saveProjectBefore = chkSaveProject.checked;
      try {
        localStorage.setItem(KEYS.saveProject, chkSaveProject.checked ? "true" : "false");
      } catch (e) { }
    }
    if (chkDeleteEmptyFolders) {
      activePreset.settings.deleteEmptyFolders = chkDeleteEmptyFolders.checked;
      try {
        localStorage.setItem(KEYS.deleteEmpty, chkDeleteEmptyFolders.checked ? "true" : "false");
      } catch (e) { }
    }
    if (chkGroupBySourceFolder) {
      activePreset.settings.groupBySourceFolder = chkGroupBySourceFolder.checked;
      // O toggle global controla todas as pastas (regras por pasta têm prioridade no organizador)
      var gv = chkGroupBySourceFolder.checked;
      (function applyAll(nodes) {
        for (var i = 0; i < (nodes || []).length; i++) {
          if (!nodes[i].rules) nodes[i].rules = {};
          nodes[i].rules.groupBySourceFolder = gv;
          applyAll(nodes[i].children);
        }
      })(activePreset.tree);
    }

    presetManager.savePreset(activePreset);
    // A árvore do Default é protegida: se o salvamento descartou estrutura,
    // avisa no rodapé em vez de deixar o usuário achar que foi gravado.
    if (typeof presetManager.consumeSaveWarning === "function") {
      var saveWarning = presetManager.consumeSaveWarning();
      if (saveWarning) setStatus(saveWarning, "warning");
    }
    updateGroupSourceIndicator();
    // savePreset() ja dispara notifyPresetsUpdated (invalida cache e avisa o editor);
    // chamar de novo aqui duplicava o evento com.tidyflow.presetsUpdated.
  }

  if (presetSelect) {
    presetSelect.addEventListener("change", function () {
      var chosenName = presetSelect.value;
      presetManager.setActivePresetName(chosenName);
      syncPresetsAndToggles();
      setStatus("Preset ativo: " + chosenName, "");
    });
  }

  if (chkSaveProject) {
    chkSaveProject.addEventListener("change", function () {
      persistTogglesToActivePreset();
    });
  }
  if (chkDeleteEmptyFolders) {
    chkDeleteEmptyFolders.addEventListener("change", persistTogglesToActivePreset);
  }
  if (chkGroupBySourceFolder) {
    chkGroupBySourceFolder.addEventListener("change", persistTogglesToActivePreset);
  }

  // Abrir o Preset Builder SEMPRE em uma Janela Separada Flutuante
  var floatingEditorWin = null;

  if (btnOpenPresetBuilder) {
    btnOpenPresetBuilder.addEventListener("click", function () {
      try {
        if (window.__adobe_cep__) {
          csInterface.requestOpenExtension("com.tidyflow.editor", "");
          return;
        }
      } catch (e1) { }

      try {
        if (floatingEditorWin && !floatingEditorWin.closed) {
          floatingEditorWin.focus();
          return;
        }
      } catch (eFocus) { }

      var winFeatures = "width=740,height=640,resizable=yes,scrollbars=yes,status=no,toolbar=no,menubar=no,location=no";
      try {
        floatingEditorWin = window.open("tree_editor.html", "AEOrganizerPresetBuilder", winFeatures);
        if (floatingEditorWin) {
          floatingEditorWin.focus();
          return;
        }
      } catch (e2) { }

      try {
        var extPath = csInterface.getSystemPath(SystemPath.EXTENSION);
        if (extPath) {
          var absUrl = "file:///" + (extPath + "/client/tree_editor.html").replace(/\\/g, "/");
          floatingEditorWin = window.open(absUrl, "AEOrganizerPresetBuilder", winFeatures);
          if (floatingEditorWin) {
            floatingEditorWin.focus();
          }
        }
      } catch (e3) { }
    });
  }

  // Collect Files: abre a janela com.tidyflow.collect (COLLECT_FILES_SPEC.md §2)
  var btnOpenCollect = document.getElementById("btnOpenCollect");
  var floatingCollectWin = null;

  function saveMainPanelRect() {
    try {
      var req = (window.cep_node && window.cep_node.require) ? window.cep_node.require
        : (typeof require === "function" ? require : null);
      if (!req) return;
      var fs = req("fs");
      var p = req("path");
      var extPath = csInterface.getSystemPath(SystemPath.EXTENSION);
      if (!extPath) return;
      var cleanExt = extPath.replace(/^file:\/\/\/?/i, "").replace(/^[\\\/]([a-zA-Z]:)/, "$1").replace(/\//g, "\\");
      var rectFile = p.join(cleanExt, "scripts", "main_panel_rect.json");
      var data = {
        screenX: window.screenX || window.screenLeft || 0,
        screenY: window.screenY || window.screenTop || 0,
        innerW: window.innerWidth || document.documentElement.clientWidth || 0,
        innerH: window.innerHeight || document.documentElement.clientHeight || 0,
        outerW: window.outerWidth || 0,
        outerH: window.outerHeight || 0,
        ts: Date.now()
      };
      fs.writeFileSync(rectFile, JSON.stringify(data), "utf8");
    } catch (eRect) { }
  }

  function triggerCollectWindowResize(width, height) {
    saveMainPanelRect();
    try {
      var req = (window.cep_node && window.cep_node.require) ? window.cep_node.require
        : (typeof require === "function" ? require : null);
      if (!req) return;
      var cp = req("child_process");
      var p = req("path");
      var extPath = csInterface.getSystemPath(SystemPath.EXTENSION);
      if (!extPath) return;
      var cleanExt = extPath.replace(/^file:\/\/\/?/i, "").replace(/^[\\\/]([a-zA-Z]:)/, "$1").replace(/\//g, "\\");
      var psScript = p.join(cleanExt, "scripts", "resize_window.ps1");
      var w = width || 600;
      var h = height || 750;
      var cmd = 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "' + psScript + '" -Width ' + w + ' -Height ' + h;
      setTimeout(function () {
        try { cp.exec(cmd, { timeout: 4000 }); } catch (eExec) { }
      }, 60);
    } catch (e) { }
  }

  if (btnOpenCollect) {
    btnOpenCollect.addEventListener("click", function () {
      try {
        if (floatingCollectWin && !floatingCollectWin.closed) {
          floatingCollectWin.focus();
          return;
        }
      } catch (eFocus) { }

      var width = 600;
      var height = 750;
      var left = Math.max(0, Math.round((window.screen.width - width) / 2));
      var top = Math.max(0, Math.round((window.screen.height - height) / 2));
      var winFeatures = "width=" + width + ",height=" + height + ",left=" + left + ",top=" + top + ",resizable=no,scrollbars=no,status=no,toolbar=no,menubar=no,location=no";
      try {
        floatingCollectWin = window.open("collect.html", "TidyFlowCollect", winFeatures);
        if (floatingCollectWin) {
          floatingCollectWin.focus();
          return;
        }
      } catch (eOpen) { }

      try {
        if (window.__adobe_cep__) {
          csInterface.requestOpenExtension("com.tidyflow.collect", "");
          try {
            var openEvt = new CSEvent("com.tidyflow.collect.open", "APPLICATION");
            openEvt.data = "reload";
            csInterface.dispatchEvent(openEvt);
          } catch (eDispatch) { }
          triggerCollectWindowResize(600, 750);
          setTimeout(function () { triggerCollectWindowResize(600, 750); }, 350);
          setTimeout(function () { triggerCollectWindowResize(600, 750); }, 800);
        }
      } catch (e1) { }
    });
  }

  window.onPresetBuilderUpdated = function (name) {
    if (typeof name === "string" && name) {
      presetManager.setActivePresetNameSilent(name);
    }
    // O editor pode ter salvo/excluído presets: descarta o cache antes de re-sincronizar
    presetManager.invalidatePresetCache();
    syncPresetsAndToggles();
  };

  try {
    csInterface.addEventListener("com.tidyflow.presetsUpdated", function (evt) {
      try {
        var d = evt && evt.data ? (typeof evt.data === "string" ? JSON.parse(evt.data) : evt.data) : null;
        if (d && d.activePreset) {
          presetManager.setActivePresetNameSilent(d.activePreset);
        }
      } catch (eEvt) { }
      presetManager.invalidatePresetCache();
      syncPresetsAndToggles();
    });
  } catch (e) { }

  window.addEventListener("focus", function () {
    syncPresetsAndToggles();
  });

  // Alguma pasta do preset declara o tipo "Audios"? (Premiere Pro)
  function presetHasAudioNode(preset) {
    var found = false;
    (function walk(nodes) {
      for (var i = 0; i < (nodes || []).length; i++) {
        var node = nodes[i];
        if (!node) continue;
        var types = (node.rules && node.rules.types) || [];
        for (var t = 0; t < types.length; t++) {
          if (types[t] === "Audios") {
            found = true;
            return;
          }
        }
        if (node.children && node.children.length) {
          walk(node.children);
          if (found) return;
        }
      }
    })(preset && preset.tree);
    return found;
  }

  // Resumo da triagem de audio (MANIFESTO 2.3): o que antes era silencioso
  // (ESP desligado, item sem pasta correspondente, bins vazias remanescentes)
  // passa a aparecer no status do painel.
  function buildAudioSummary(response) {
    var info = { text: "", warn: false };
    if (!isPPro || !response) return info;

    var total = response.audioTotal || 0;
    var noMatch = response.audioNoMatch || 0;
    var roles = response.audioRoles || {};
    var roleParts = [];
    var order = ["Dialogue", "Music", "SFX", "Ambience", "Others"];
    for (var i = 0; i < order.length; i++) {
      var qty = roles[order[i]] || 0;
      if (qty > 0) roleParts.push(order[i] + " " + qty);
    }

    if (response.audioSeparate === false && total > 0 && presetHasAudioNode(activePreset)) {
      info.warn = true;
      info.text =
        "Categorias de Áudio (ESP) desativada no preset: " + total +
        " áudio(s) sem pasta de papel (Dialogue/Music/SFX/Ambience/Others)";
    } else if (total > 0) {
      info.text = "Áudios: " + total + (roleParts.length ? " (" + roleParts.join(", ") + ")" : "");
      if (noMatch > 0) {
        info.warn = true;
        info.text += " — " + noMatch + " sem pasta correspondente no preset (não movidos)";
      }
    }

    var leftovers = response.emptyLeftovers || [];
    if (leftovers.length > 0) {
      info.warn = true;
      info.text += (info.text ? " — " : "") + leftovers.length +
        " pasta(s) vazia(s) remanescente(s): " + leftovers.slice(0, 3).join(", ") +
        (leftovers.length > 3 ? "…" : "");
    }

    return info;
  }

  function runOrganizer(mainCompArg, progressMessage, overrideSave) {
    setBusy(true);
    setStatus(progressMessage, "");

    activePreset = presetManager.getActivePreset();
    if (!activePreset.settings) activePreset.settings = {};
    activePreset.settings.usePrefixNumbering = activePreset.settings.usePrefixNumbering !== false;
    activePreset.settings.reduceProject = false;
    if (typeof overrideSave === "boolean") {
      activePreset.settings.saveProjectBefore = overrideSave;
    } else {
      activePreset.settings.saveProjectBefore = chkSaveProject ? chkSaveProject.checked : true;
    }
    activePreset.settings.deleteEmptyFolders = chkDeleteEmptyFolders ? chkDeleteEmptyFolders.checked : true;
    activePreset.settings.groupBySourceFolder = chkGroupBySourceFolder ? chkGroupBySourceFolder.checked : true;

    loadOrReloadHostScripts(function () {
      csInterface.evalScript(
        "$.global.organizeWithPreset(" +
        mainCompArg +
        ", " +
        JSON.stringify(JSON.stringify(activePreset)) +
        ")",
        function (result) {
          setBusy(false);

          if (!result || result === "EvalScript error.") {
            setStatus("Erro ao executar script no " + hostAppName + ".", "error");
            return;
          }

          try {
            var response = JSON.parse(result);
            if (response && response.success) {
              var movedComps = response.movedComps || 0;
              var movedFootages = response.movedFootages || 0;
              var cleanedFolders = response.cleanedFolders || 0;
              var reducedCount = response.reducedCount || 0;
              var projectSaved = response.projectSaved;

              var summaryParts = [
                compWordPlural + ": " + movedComps,
                "Mídias: " + movedFootages
              ];
              if (reducedCount > 0) {
                summaryParts.push("Itens reduzidos: " + reducedCount);
              }
              if (cleanedFolders > 0) {
                summaryParts.push("Pastas deletadas: " + cleanedFolders);
              }
              if (projectSaved) {
                summaryParts.push("Projeto salvo");
              }

              var audioInfo = buildAudioSummary(response);
              if (audioInfo.text) {
                summaryParts.push(audioInfo.text);
                try {
                  if (window.OrgLog) {
                    OrgLog.info("panel.audio", audioInfo.text);
                    if (response.audioSamples && response.audioSamples.length) {
                      OrgLog.debug("panel.audio.samples", JSON.stringify(response.audioSamples));
                    }
                    if (response.debugTrace) {
                      OrgLog.debug("panel.audio.trace", response.debugTrace);
                    }
                  }
                } catch (eLogAudio) { }
              }

              setStatus(
                "Projeto organizado! (" + summaryParts.join(", ") + ")",
                audioInfo.warn ? "warning" : "success"
              );
              syncRollbackSnapshotToLocalStorage();
            } else {
              var errMsg = (response && response.error) || "Falha desconhecida.";
              // Mesmo em falha o host pode ja ter mutado o projeto: manter a copia do
              // snapshot atualizada para o botao Restaurar continuar funcionando.
              syncRollbackSnapshotToLocalStorage();
              if (errMsg.indexOf("Nenhuma composi") !== -1 || errMsg.indexOf("Nenhuma sequ") !== -1) {
                setStatus("Nenhuma " + compWordSingular + " selecionada.", "warning");
              } else {
                setStatus("Erro: " + errMsg, "error");
              }
            }
          } catch (e) {
            setStatus("Resposta inválida do " + hostAppName + ".", "error");
          }
        }
      );
    });
  }

  btnOrganize.addEventListener("click", function () {
    runOrganizer('"selection"', "Organizando projeto...");
  });

  if (btnCreateStructure) {
    btnCreateStructure.addEventListener("click", function () {
      setBusy(true);
      setStatus("Criando estrutura de pastas...", "");

      activePreset = presetManager.getActivePreset();
      if (!activePreset.settings) activePreset.settings = {};
      activePreset.settings.usePrefixNumbering = activePreset.settings.usePrefixNumbering !== false;

      loadOrReloadHostScripts(function () {
        csInterface.evalScript(
          "$.global.createPresetFolderStructure(" +
          JSON.stringify(JSON.stringify(activePreset)) +
          ")",
          function (result) {
            setBusy(false);

            if (!result || result === "EvalScript error.") {
              setStatus("Erro ao executar script no " + hostAppName + ".", "error");
              return;
            }

            try {
              var response = JSON.parse(result);
              if (response && response.success) {
                var created = response.createdCount || 0;
                var existing = response.existingCount || 0;

                if (created > 0 && existing > 0) {
                  setStatus(
                    "Estrutura pronta! (" + created + " criada(s), " + existing + " já existente(s))",
                    "success"
                  );
                } else if (created > 0) {
                  setStatus(
                    "Estrutura criada! (" + created + " pasta(s))",
                    "success"
                  );
                } else {
                  setStatus(
                    "Estrutura já existe no projeto (" + existing + " pasta(s)).",
                    "success"
                  );
                }
                syncRollbackSnapshotToLocalStorage();
              } else {
                var errMsg = (response && response.error) || "Falha desconhecida.";
                setStatus("Erro: " + errMsg, "error");
              }
            } catch (e) {
              setStatus("Resposta inválida do " + hostAppName + ".", "error");
            }
          }
        );
      });
    });
  }

  btnMediaOnly.addEventListener("click", function () {
    runOrganizer('"media_only"', "Organizando mídias...");
  });

  function openRollbackModal() {
    if (rollbackModalBackdrop) {
      rollbackModalBackdrop.classList.add("open");
    }
  }

  function closeRollbackModal() {
    if (rollbackModalBackdrop) {
      rollbackModalBackdrop.classList.remove("open");
    }
  }

  function runRollback(saveBefore) {
    closeRollbackModal();
    setBusy(true);
    setStatus(
      saveBefore ? "Salvando projeto e revertendo organização..." : "Revertendo organização (Rollback)...",
      ""
    );

    var backupSnap = "";
    try {
      backupSnap = localStorage.getItem(KEYS.rollbackSnapshot) || "";
    } catch (e) { }

    loadOrReloadHostScripts(function () {
      csInterface.evalScript(
        "$.global.rollbackProject(" +
        (saveBefore ? "true" : "false") +
        ", " +
        JSON.stringify(backupSnap) +
        ")",
        function (result) {
          setBusy(false);

          if (!result || result === "EvalScript error.") {
            setStatus("Erro ao executar Rollback no " + hostAppName + ".", "error");
            return;
          }

          try {
            var response = JSON.parse(result);
            if (response && response.success) {
              try {
                localStorage.removeItem(KEYS.rollbackSnapshot);
              } catch (eRm) { }

              var restoredItems = response.restoredItems || 0;
              var recreatedFolders = response.recreatedFolders || 0;
              var removedFolders = response.removedFolders || 0;
              var projectSaved = response.projectSaved;

              var parts = ["Itens restaurados: " + restoredItems];
              if (recreatedFolders > 0) {
                parts.push("Pastas recriadas: " + recreatedFolders);
              }
              if (removedFolders > 0) {
                parts.push("Pastas removidas: " + removedFolders);
              }
              if (projectSaved) {
                parts.push("Projeto salvo");
              }

              setStatus("Rollback concluído! (" + parts.join(", ") + ")", "success");
            } else {
              var errMsg = (response && response.error) || "Falha desconhecida no Rollback.";
              setStatus("Erro: " + errMsg, "error");
            }
          } catch (e) {
            setStatus("Resposta inválida do " + hostAppName + ".", "error");
          }
        }
      );
    });
  }

  if (btnRollback) {
    btnRollback.addEventListener("click", function () {
      openRollbackModal();
    });
  }

  if (btnRollbackSaveAndContinue) {
    btnRollbackSaveAndContinue.addEventListener("click", function () {
      runRollback(true);
    });
  }

  if (btnRollbackContinueWithoutSave) {
    btnRollbackContinueWithoutSave.addEventListener("click", function () {
      runRollback(false);
    });
  }

  if (btnRollbackCancel) {
    btnRollbackCancel.addEventListener("click", function () {
      closeRollbackModal();
    });
  }

  if (rollbackModalBackdrop) {
    rollbackModalBackdrop.addEventListener("click", function (evt) {
      if (evt.target === rollbackModalBackdrop) {
        closeRollbackModal();
      }
    });
  }

  window.addEventListener("keydown", function (event) {
    if (event.key === "Escape" || event.keyCode === 27) {
      if (rollbackModalBackdrop && rollbackModalBackdrop.classList.contains("open")) {
        event.preventDefault();
        closeRollbackModal();
        return;
      }
    }
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

  var mainResizeTimer = null;
  function lockMainFloatingWindow() {
    saveMainPanelRect();
    try {
      var req = (window.cep_node && window.cep_node.require) ? window.cep_node.require
        : (typeof require === "function" ? require : null);
      if (!req || req("os").platform() !== "win32") return;
      var extPath = csInterface.getSystemPath(SystemPath.EXTENSION);
      if (!extPath) return;
      var cleanExt = extPath.replace(/^file:\/\/\/?/i, "").replace(/^[\\\/]([a-zA-Z]:)/, "$1").replace(/\//g, "\\");
      var script = req("path").join(cleanExt, "scripts", "resize_window.ps1");
      var manifest = req("fs").readFileSync(req("path").join(cleanExt, "CSXS", "manifest.xml"), "utf8");
      var xml = new DOMParser().parseFromString(manifest, "application/xml");
      var extensions = xml.getElementsByTagName("Extension");
      var width = 0;
      var height = 0;
      for (var i = 0; i < extensions.length; i++) {
        if (extensions[i].getAttribute("Id") !== "com.tidyflow") continue;
        var sizes = extensions[i].getElementsByTagName("Size");
        if (!sizes.length) continue;
        width = parseInt(sizes[0].getElementsByTagName("Width")[0].textContent, 10);
        height = parseInt(sizes[0].getElementsByTagName("Height")[0].textContent, 10);
        break;
      }
      if (!(width >= 280 && width <= 3840 && height >= 240 && height <= 2160)) return;
      req("child_process").execFile("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script, "-MainPanel", "-Width", String(width), "-Height", String(height)], { timeout: 4000, windowsHide: true }, function () {});
    } catch (e) { }
  }

  window.addEventListener("resize", function () {
    saveMainPanelRect();
    if (mainResizeTimer) clearTimeout(mainResizeTimer);
    mainResizeTimer = setTimeout(lockMainFloatingWindow, 300);
  });
  setTimeout(lockMainFloatingWindow, 500);
  triggerCollectWindowResize(600, 750);

  // Garantir que a versão mais recente de host/organizer.jsx + motor AEFT/PPRO esteja avaliada ao inicializar
  loadOrReloadHostScripts();
  syncPresetsAndToggles();
})();
