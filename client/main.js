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
    reduceProject: "ae_organizer_reduce_project",
    deleteEmpty: "ae_organizer_delete_empty"
  };

  var noticeText = document.getElementById("noticeText");
  var btnCheckCompsLabel = document.getElementById("btnCheckCompsLabel");
  var presetSelect = document.getElementById("presetSelect");
  var btnOpenPresetBuilder = document.getElementById("btnOpenPresetBuilder");
  var btnOrganize = document.getElementById("btnOrganize");
  var btnCreateStructure = document.getElementById("btnCreateStructure");
  var btnMediaOnly = document.getElementById("btnMediaOnly");
  var btnCheckComps = document.getElementById("btnCheckComps");
  var chkPrefixNumbering = document.getElementById("chkPrefixNumbering");
  var chkSaveProject = document.getElementById("chkSaveProject");
  var chkReduceProject = document.getElementById("chkReduceProject");
  var chkDeleteEmptyFolders = document.getElementById("chkDeleteEmptyFolders");
  var chkGroupBySourceFolder = document.getElementById("chkGroupBySourceFolder");
  var btnRollback = document.getElementById("btnRollback");
  var rollbackModalBackdrop = document.getElementById("rollbackModalBackdrop");
  var btnRollbackSaveAndContinue = document.getElementById("btnRollbackSaveAndContinue");
  var btnRollbackContinueWithoutSave = document.getElementById("btnRollbackContinueWithoutSave");
  var btnRollbackCancel = document.getElementById("btnRollbackCancel");
  var reduceProjectAlert = document.getElementById("reduceProjectAlert");
  var statusMsg = document.getElementById("statusMsg");

  if (isPPro) {
    document.title = "TidyFlow — Premiere Pro";
    if (noticeText) {
      noticeText.textContent = "Selecione as sequências no painel Project antes de organizar.";
    }
    if (btnCheckCompsLabel) {
      var word2 = document.getElementById("btnCheckCompsWord2");
      if (word2) {
        word2.textContent = "sequências";
      } else {
        btnCheckCompsLabel.textContent = "Verificar sequências";
      }
    }
    if (chkReduceProject && chkReduceProject.parentElement) {
      chkReduceProject.parentElement.title =
        "Reduzir o projeto e deletar arquivos não usados nas sequências selecionadas";
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
    if (btnCheckComps) btnCheckComps.disabled = isBusy;
    if (presetSelect) presetSelect.disabled = isBusy;
    if (btnOpenPresetBuilder) btnOpenPresetBuilder.disabled = isBusy;
    if (chkPrefixNumbering) chkPrefixNumbering.disabled = isBusy;
    if (chkSaveProject) chkSaveProject.disabled = isBusy;
    if (chkReduceProject) chkReduceProject.disabled = isBusy;
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

  // Reduzir o projeto remove itens (acao destrutiva). Sempre que estiver ativo, o
  // salvamento previo do projeto é obrigatório: sem isso o usuario nao teria como
  // voltar atras. Os toggles vem de chaves independentes no localStorage, entao o
  // par invalido (reduzir=on, salvar=off) pode reaparecer a cada carga.
  function enforceReduceRequiresSave() {
    if (!chkReduceProject || !chkSaveProject) return;
    if (chkReduceProject.checked && !chkSaveProject.checked) {
      chkSaveProject.checked = true;
      try {
        localStorage.setItem(KEYS.saveProject, "true");
      } catch (e) { }
    }
  }

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
    }

    var s = activePreset.settings || {};
    if (chkPrefixNumbering) {
      chkPrefixNumbering.checked = (s.usePrefixNumbering !== false);
    }
    if (chkDeleteEmptyFolders) {
      chkDeleteEmptyFolders.checked = (s.deleteEmptyFolders !== false);
    }

    try {
      var savedSave = localStorage.getItem(KEYS.saveProject);
      if (chkSaveProject) {
        chkSaveProject.checked = savedSave !== null ? (savedSave === "true") : (s.saveProjectBefore !== false);
      }
      var savedReduce = localStorage.getItem(KEYS.reduceProject);
      if (chkReduceProject) {
        chkReduceProject.checked = savedReduce !== null ? (savedReduce === "true") : Boolean(s.reduceProject);
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

    enforceReduceRequiresSave();
    updateGroupSourceIndicator();
    updateReduceProjectWarning();
  }

  // Alerta de Reduzir Projeto (dependências da composição selecionada)
  function updateReduceProjectWarning() {
    if (!reduceProjectAlert || !chkReduceProject) return;
    if (chkReduceProject.checked) {
      reduceProjectAlert.style.display = "block";
      var compWord = isPPro ? "sequência selecionada" : "composição selecionada";
      reduceProjectAlert.innerHTML = "⚠️ <strong>Atenção:</strong> O projeto será reduzido apenas com as dependências da " + compWord + ".";
    } else {
      reduceProjectAlert.style.display = "none";
    }
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

    if (chkPrefixNumbering) {
      activePreset.settings.usePrefixNumbering = chkPrefixNumbering.checked;
    }
    if (chkSaveProject) {
      activePreset.settings.saveProjectBefore = chkSaveProject.checked;
      try {
        localStorage.setItem(KEYS.saveProject, chkSaveProject.checked ? "true" : "false");
      } catch (e) { }
    }
    if (chkReduceProject) {
      activePreset.settings.reduceProject = chkReduceProject.checked;
      try {
        localStorage.setItem(KEYS.reduceProject, chkReduceProject.checked ? "true" : "false");
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

  if (chkPrefixNumbering) {
    chkPrefixNumbering.addEventListener("change", persistTogglesToActivePreset);
  }
  if (chkSaveProject) {
    chkSaveProject.addEventListener("change", function () {
      // Nao permitir salvar=off com reduzir=on (perderia a protecao do projeto)
      if (!chkSaveProject.checked && chkReduceProject && chkReduceProject.checked) {
        chkSaveProject.checked = true;
        setStatus(
          "Salvar projeto antes é obrigatório enquanto 'Reduzir Projeto' estiver ativo.",
          "warning"
        );
        updateReduceProjectWarning();
        return;
      }
      persistTogglesToActivePreset();
      updateReduceProjectWarning();
    });
  }
  if (chkReduceProject) {
    chkReduceProject.addEventListener("change", function () {
      enforceReduceRequiresSave();
      updateReduceProjectWarning();
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

  function runOrganizer(mainCompArg, progressMessage) {
    setBusy(true);
    setStatus(progressMessage, "");

    activePreset = presetManager.getActivePreset();
    if (!activePreset.settings) activePreset.settings = {};
    activePreset.settings.usePrefixNumbering = chkPrefixNumbering ? chkPrefixNumbering.checked : true;
    var reduceProjectOn = chkReduceProject ? chkReduceProject.checked : false;
    activePreset.settings.reduceProject = reduceProjectOn;
    // Reduzir projeto e destrutivo: exigir salvamento previo mesmo que o toggle
    // esteja desmarcado (estado herdado de localStorage antigo).
    activePreset.settings.saveProjectBefore = (chkSaveProject ? chkSaveProject.checked : true) || reduceProjectOn;
    activePreset.settings.deleteEmptyFolders = chkDeleteEmptyFolders ? chkDeleteEmptyFolders.checked : true;
    activePreset.settings.groupBySourceFolder = chkGroupBySourceFolder ? chkGroupBySourceFolder.checked : true;

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

            setStatus(
              "Projeto organizado! (" + summaryParts.join(", ") + ")",
              "success"
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
      activePreset.settings.usePrefixNumbering = chkPrefixNumbering ? chkPrefixNumbering.checked : true;

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
  }

  btnMediaOnly.addEventListener("click", function () {
    runOrganizer('"media_only"', "Organizando mídias...");
  });

  if (btnCheckComps) {
    btnCheckComps.addEventListener("click", function () {
      setBusy(true);
      setStatus("Verificando " + compWordLowerPlural + "...", "");

      activePreset = presetManager.getActivePreset();

      csInterface.evalScript(
        "$.global.checkUnusedComps(" +
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
              var moved = response.movedCount || 0;
              var emptyCount = response.emptyCount || 0;
              var notUsedCount = response.notUsedCount || 0;
              var unusedFolderLabel =
                (activePreset &&
                  activePreset.settings &&
                  activePreset.settings.unusedFolderName) ||
                "Nunca Usadas";

              if (moved === 0) {
                setStatus("Nenhuma " + compWordSingular + " vazia ou não utilizada encontrada.", "success");
              } else {
                var details = [];
                if (emptyCount > 0) {
                  details.push(emptyCount + " vazia" + (emptyCount > 1 ? "s" : ""));
                }
                if (notUsedCount > 0) {
                  details.push(notUsedCount + " não utilizada" + (notUsedCount > 1 ? "s" : ""));
                }
                var detailsStr = details.length > 0 ? " (" + details.join(", ") + ")" : "";

                var movedLabel = isPPro ? "sequência(s)" : "composição(ões)";
                setStatus(
                  moved +
                  " " +
                  movedLabel +
                  " movida(s) para '" +
                  unusedFolderLabel +
                  "'" +
                  detailsStr +
                  ".",
                  "success"
                );
                syncRollbackSnapshotToLocalStorage();
              }
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
  }

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

  // Garantir que a versão mais recente de host/organizer.jsx + motor AEFT/PPRO esteja avaliada ao inicializar
  loadOrReloadHostScripts();
  syncPresetsAndToggles();
})();
