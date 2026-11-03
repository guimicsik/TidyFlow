(function () {
  var csInterface = new CSInterface();
  var presetManager = new PresetManager(csInterface);

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
  var statusMsg = document.getElementById("statusMsg");

  var activePreset = presetManager.getActivePreset();

  function setStatus(text, type) {
    statusMsg.textContent = text || "";
    statusMsg.className = type || "";
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
      var savedSave = localStorage.getItem("ae_organizer_save_project");
      if (chkSaveProject) {
        chkSaveProject.checked = savedSave !== null ? (savedSave === "true") : (s.saveProjectBefore !== false);
      }
      var savedReduce = localStorage.getItem("ae_organizer_reduce_project");
      if (chkReduceProject) {
        chkReduceProject.checked = savedReduce !== null ? (savedReduce === "true") : Boolean(s.reduceProject);
      }
    } catch (e) {}
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
        localStorage.setItem("ae_organizer_save_project", chkSaveProject.checked ? "true" : "false");
      } catch (e) {}
    }
    if (chkReduceProject) {
      activePreset.settings.reduceProject = chkReduceProject.checked;
      try {
        localStorage.setItem("ae_organizer_reduce_project", chkReduceProject.checked ? "true" : "false");
      } catch (e) {}
    }
    if (chkDeleteEmptyFolders) {
      activePreset.settings.deleteEmptyFolders = chkDeleteEmptyFolders.checked;
      try {
        localStorage.setItem("ae_organizer_delete_empty", chkDeleteEmptyFolders.checked ? "true" : "false");
      } catch (e) {}
    }

    presetManager.savePreset(activePreset);
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
    chkSaveProject.addEventListener("change", persistTogglesToActivePreset);
  }
  if (chkReduceProject) {
    chkReduceProject.addEventListener("change", persistTogglesToActivePreset);
  }
  if (chkDeleteEmptyFolders) {
    chkDeleteEmptyFolders.addEventListener("change", persistTogglesToActivePreset);
  }

  // Abrir o Preset Builder SEMPRE em uma Janela Separada Flutuante
  var floatingEditorWin = null;

  if (btnOpenPresetBuilder) {
    btnOpenPresetBuilder.addEventListener("click", function () {
      // 1. Tentar solicitar abertura via CEP requestOpenExtension (se registrada pelo After Effects)
      try {
        if (window.__adobe_cep__) {
          csInterface.requestOpenExtension("com.organizer.ae.editor", "");
        }
      } catch (e1) {}

      // 2. Se já houver uma janela aberta do CEF popup, dar foco nela
      try {
        if (floatingEditorWin && !floatingEditorWin.closed) {
          floatingEditorWin.focus();
          return;
        }
      } catch (eFocus) {}

      // 3. Abrir janela flutuante nativa do CEF independente com dimensões dedicadas
      var winFeatures = "width=740,height=640,resizable=yes,scrollbars=yes,status=no,toolbar=no,menubar=no,location=no";
      try {
        floatingEditorWin = window.open("tree_editor.html", "AEOrganizerPresetBuilder", winFeatures);
        if (floatingEditorWin) {
          floatingEditorWin.focus();
          return;
        }
      } catch (e2) {}

      // 4. Se o CEF estiver bloqueando URLs relativas em popup, tentar caminho absoluto file:///
      try {
        var extPath = csInterface.getSystemPath(SystemPath.EXTENSION);
        if (extPath) {
          var absUrl = "file:///" + (extPath + "/client/tree_editor.html").replace(/\\/g, "/");
          floatingEditorWin = window.open(absUrl, "AEOrganizerPresetBuilder", winFeatures);
          if (floatingEditorWin) {
            floatingEditorWin.focus();
          }
        }
      } catch (e3) {}
    });
  }

  window.onPresetBuilderUpdated = function () {
    syncPresetsAndToggles();
  };

  // Escutar eventos de atualização vindos da janela modal do Preset Builder
  try {
    csInterface.addEventListener("com.organizer.ae.presetsUpdated", function () {
      syncPresetsAndToggles();
    });
  } catch (e) {}

  window.addEventListener("focus", function () {
    syncPresetsAndToggles();
  });

  function runOrganizer(mainCompArg, progressMessage) {
    setBusy(true);
    setStatus(progressMessage, "");

    activePreset = presetManager.getActivePreset();
    if (!activePreset.settings) activePreset.settings = {};
    activePreset.settings.usePrefixNumbering = chkPrefixNumbering ? chkPrefixNumbering.checked : true;
    activePreset.settings.saveProjectBefore = chkSaveProject ? chkSaveProject.checked : true;
    activePreset.settings.reduceProject = chkReduceProject ? chkReduceProject.checked : false;
    activePreset.settings.deleteEmptyFolders = chkDeleteEmptyFolders ? chkDeleteEmptyFolders.checked : true;

    csInterface.evalScript(
      "$.global.organizeWithPreset(" +
        mainCompArg +
        ", " +
        JSON.stringify(JSON.stringify(activePreset)) +
        ")",
      function (result) {
        setBusy(false);

        if (!result || result === "EvalScript error.") {
          setStatus("Erro ao executar script no After Effects.", "error");
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
              "Composições: " + movedComps,
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
          } else {
            var errMsg = (response && response.error) || "Falha desconhecida.";
            if (errMsg.indexOf("Nenhuma composi") !== -1) {
              setStatus("Nenhuma composição selecionada.", "warning");
            } else {
              setStatus("Erro: " + errMsg, "error");
            }
          }
        } catch (e) {
          setStatus("Resposta inválida do After Effects.", "error");
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
            setStatus("Erro ao executar script no After Effects.", "error");
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
            } else {
              var errMsg = (response && response.error) || "Falha desconhecida.";
              setStatus("Erro: " + errMsg, "error");
            }
          } catch (e) {
            setStatus("Resposta inválida do After Effects.", "error");
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
      setStatus("Verificando composições...", "");

      activePreset = presetManager.getActivePreset();

      csInterface.evalScript(
        "$.global.checkUnusedComps(" +
          JSON.stringify(JSON.stringify(activePreset)) +
          ")",
        function (result) {
          setBusy(false);

          if (!result || result === "EvalScript error.") {
            setStatus("Erro ao executar script no After Effects.", "error");
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
                setStatus("Nenhuma composição vazia ou não utilizada encontrada.", "success");
              } else {
                var details = [];
                if (emptyCount > 0) {
                  details.push(emptyCount + " vazia" + (emptyCount > 1 ? "s" : ""));
                }
                if (notUsedCount > 0) {
                  details.push(notUsedCount + " não utilizada" + (notUsedCount > 1 ? "s" : ""));
                }
                var detailsStr = details.length > 0 ? " (" + details.join(", ") + ")" : "";

                setStatus(
                  moved +
                    " composição(ões) movida(s) para '" +
                    unusedFolderLabel +
                    "'" +
                    detailsStr +
                    ".",
                  "success"
                );
              }
            } else {
              var errMsg = (response && response.error) || "Falha desconhecida.";
              setStatus("Erro: " + errMsg, "error");
            }
          } catch (e) {
            setStatus("Resposta inválida do After Effects.", "error");
          }
        }
      );
    });
  }

  window.addEventListener("keydown", function (event) {
    var isCtrlR =
      (event.ctrlKey || event.metaKey) &&
      (event.key === "r" || event.key === "R" || event.keyCode === 82);
    var isF5 = event.key === "F5" || event.keyCode === 116;

    if (isCtrlR || isF5) {
      event.preventDefault();

      var extPath = csInterface.getSystemPath(SystemPath.EXTENSION);
      var jsxPath = (extPath + "/host/organizer.jsx").replace(/\\/g, "/");

      csInterface.evalScript('$.evalFile("' + jsxPath + '")', function () {
        window.location.reload();
      });
    }
  });

  // Garantir que a versão mais recente do host/organizer.jsx esteja avaliada ao inicializar o painel
  try {
    if (window.__adobe_cep__) {
      var extPathInit = csInterface.getSystemPath(SystemPath.EXTENSION);
      var jsxPathInit = (extPathInit + "/host/organizer.jsx").replace(/\\/g, "/");
      csInterface.evalScript('$.evalFile("' + jsxPathInit + '")');
    }
  } catch (e) {}

  syncPresetsAndToggles();
})();
