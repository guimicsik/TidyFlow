/* ==========================================================================
   TidyFlow — Janela Collect Files (com.tidyflow.collect)
   Nesta etapa: opções do diálogo + cálculo prévio do rodapé
   ("X arquivo(s) (Y GB) serão coletados. Z efeito(s) usados.").
   A execução do Collect (cópia, .aepx, relink) entra nas Fases 4–5
   da COLLECT_FILES_SPEC.md.
   ========================================================================== */
(function () {
  var csInterface = new CSInterface();
  var CollectEngine = window.CollectEngine || (typeof require === "function" ? require("./CollectEngine.js") : null);
  var engine = CollectEngine ? CollectEngine.createEstimator() : null;

  var selCollectMode = document.getElementById("selCollectMode");
  var optAllComps = document.getElementById("optAllComps");
  var optSelected = document.getElementById("optSelected");
  var optQueued = document.getElementById("optQueued");
  var chkReportOnly = document.getElementById("chkReportOnly");
  var chkObeyProxy = document.getElementById("chkObeyProxy");
  var chkReduceProject = document.getElementById("chkReduceProject");
  var chkReveal = document.getElementById("chkReveal");
  var rowObeyProxy = document.getElementById("rowObeyProxy");
  var rowReduceProject = document.getElementById("rowReduceProject");
  var queuedInfo = document.getElementById("queuedInfo");
  var summaryFiles = document.getElementById("summaryFiles");
  var summaryEffects = document.getElementById("summaryEffects");
  var statusLine = document.getElementById("statusLine");
  var collectProgressBox = document.getElementById("collectProgressBox");
  var collectEta = document.getElementById("collectEta");
  var collectPercent = document.getElementById("collectPercent");
  var collectProgressBar = document.getElementById("collectProgressBar");
  var btnComments = document.getElementById("btnComments");
  var btnCollect = document.getElementById("btnCollect");
  var btnCancel = document.getElementById("btnCancel");
  var commentsBackdrop = document.getElementById("commentsBackdrop");
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
    copyCanceled: false
  };

  function log(level, msg) {
    try { if (window.OrgLog) OrgLog[level]("collect", msg); } catch (e) { }
  }

  function setStatus(text, isError) {
    statusLine.textContent = text || "";
    statusLine.className = "collect-status" + (isError ? " is-error" : "");
    if (isError && text) log("error", text);
  }

  /* ---------- Regras de habilitação (COLLECT_FILES_SPEC.md §2) ---------- */

  function isCompMode(mode) {
    return mode === "allComps" || mode === "selected";
  }

  function setRowEnabled(row, input, enabled) {
    input.disabled = !enabled;
    if (enabled) row.classList.remove("is-disabled");
    else row.classList.add("is-disabled");
  }

  // "Tudo" e "Nenhum" desabilitam Proxy e Reduzir; os modos por comp habilitam.
  // "Gerar apenas relatório" não altera o projeto, então Reduzir fica desabilitado.
  function applyModeRules() {
    var compMode = isCompMode(selCollectMode.value);
    setRowEnabled(rowObeyProxy, chkObeyProxy, compMode);
    setRowEnabled(rowReduceProject, chkReduceProject, compMode && !chkReportOnly.checked);
  }

  function effectiveOptions() {
    return {
      mode: selCollectMode.value,
      reportOnly: chkReportOnly.checked,
      obeyProxy: !chkObeyProxy.disabled && chkObeyProxy.checked,
      reduceProject: !chkReduceProject.disabled && chkReduceProject.checked,
      reveal: chkReveal.checked,
      comments: state.comments
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

  function runScan(mode, callback) {
    if (state.isClosing) {
      if (typeof callback === "function") callback({ success: false, error: "Fechando" });
      return;
    }
    if (!window.__adobe_cep__) {
      callback({ success: false, error: "Abra esta janela dentro do After Effects." });
      return;
    }
    var payload = JSON.stringify({ mode: mode }).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    csInterface.evalScript("$.global.collectScan('" + payload + "')", function (res) {
      if (state.isClosing) return;
      var parsed = null;
      try { parsed = JSON.parse(res); } catch (e) { parsed = { success: false, error: "Resposta inválida do host: " + res }; }
      callback(parsed);
    });
  }

  /* ---------- Rodapé ---------- */

  function renderSummary() {
    var scan = state.scan;
    var est = state.estimate;
    var opts = effectiveOptions();
    state.blocked = false;

    if (!scan) return;

    queuedInfo.textContent = (scan.queuedCount || 0) + " itens de render na fila.";
    summaryEffects.textContent = (scan.effectCount || 0) + " efeito(s) usado(s).";

    var warnings = [];
    if (!scan.projectSaved) {
      warnings.push("Salve o projeto antes de coletar.");
      state.blocked = true;
    }
    if (opts.mode === "selected" && !scan.selectedCompCount) {
      warnings.push("Nenhuma " + compWord + " selecionada no painel Project.");
      state.blocked = true;
    }

    if (opts.mode === "none") {
      summaryFiles.textContent = "Nenhum arquivo será coletado (apenas o projeto).";
    } else if (!est) {
      summaryFiles.textContent = state.isEstimating
        ? "Calculando tamanho em segundo plano (você já pode coletar)..."
        : "";
    } else {
      var size = CollectEngine.formatBytes(est.totalBytes);
      summaryFiles.textContent = opts.reportOnly
        ? est.fileCount + " arquivo(s) (" + size + ") serão listados no relatório."
        : est.fileCount + " arquivo(s) (" + size + ") serão coletados.";
      if (est.offlineItems) warnings.push(est.offlineItems + " item(ns) offline no projeto (não serão coletados).");
      if (est.missingFiles && est.missingFiles.length) {
        warnings.push(est.missingFiles.length + " arquivo(s) não encontrados no disco.");
        log("warn", "Arquivos não encontrados: " + est.missingFiles.slice(0, 20).join(" | "));
      }
      if (est.error) warnings.push(est.error);
    }

    setStatus(warnings.join(" "), false);
    btnCollect.disabled = state.blocked;
  }

  function refresh() {
    if (state.isClosing) return;
    var token = ++state.token;
    var mode = selCollectMode.value;
    applyModeRules();
    state.estimate = null;
    state.isEstimating = false;
    if (collectProgressBox) collectProgressBox.classList.add("is-hidden");
    btnCancel.textContent = "Cancelar";
    if (engine) engine.cancel();
    summaryFiles.textContent = "Analisando projeto...";
    btnCollect.disabled = true;

    runScan(mode === "none" ? "none" : mode, function (scan) {
      if (state.isClosing || token !== state.token) return; // resposta antiga ou janela fechando
      if (!scan || !scan.success) {
        state.scan = null;
        state.isEstimating = false;
        summaryFiles.textContent = "";
        summaryEffects.textContent = "";
        setStatus((scan && scan.error) || "Falha ao analisar o projeto.", true);
        return;
      }
      state.scan = scan;
      state.isEstimating = (mode !== "none" && !!engine);
      renderSummary();
      if (mode === "none" || !engine) return;
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

  // Trocar só "Obedecer proxy" / "Somente relatório" não exige novo scan no host.
  function recomputeEstimate() {
    if (state.isClosing) return;
    applyModeRules();
    if (!state.scan || !engine || selCollectMode.value === "none") {
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

  /* ---------- Eventos ---------- */

  selCollectMode.addEventListener("change", refresh);
  chkObeyProxy.addEventListener("change", recomputeEstimate);
  chkReportOnly.addEventListener("change", recomputeEstimate);
  chkReduceProject.addEventListener("change", applyModeRules);

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

  function getNodeFsModule() {
    try {
      var req = (window.cep_node && window.cep_node.require) ? window.cep_node.require
        : (typeof require === "function" ? require : null);
      if (!req) return null;
      return {
        fs: req("fs"),
        path: req("path"),
        os: req("os")
      };
    } catch (e) {
      return null;
    }
  }

  function pickDestinationFolder(defaultDir, defaultFolderName, callback) {
    // 1. Tentar diálogo moderno de Salvar via CEP (permite selecionar o local e nomear a pasta do Collect)
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
        log("warn", "showSaveDialogEx falhou: " + eDialog);
        res = null;
      }

      if (res) {
        var chosen = "";
        if (typeof res.data === "string" && res.data.length > 0) {
          chosen = res.data;
        } else if (Array.isArray(res.data) && res.data.length > 0 && res.data[0]) {
          chosen = res.data[0];
        }

        if (chosen) {
          callback(chosen);
        } else {
          callback(null);
        }
        return;
      }
    }

    // 2. Fallback via ExtendScript apenas se o diálogo do CEP não estiver disponível
    if (window.__adobe_cep__) {
      var escapedPrompt = "Salvar Pasta do Collect".replace(/\\/g, "\\\\").replace(/'/g, "\\'");
      var escapedDir = (defaultDir || "").replace(/\\/g, "/").replace(/'/g, "\\'");
      var escapedName = (defaultFolderName || "Projeto_Collect").replace(/\\/g, "/").replace(/'/g, "\\'");
      csInterface.evalScript("$.global.collectSaveDialog('" + escapedPrompt + "', '" + escapedDir + "', '" + escapedName + "')", function (raw) {
        try {
          var parsed = JSON.parse(raw);
          if (parsed && parsed.success && parsed.folderPath) {
            callback(parsed.folderPath);
          } else {
            callback(null);
          }
        } catch (eP) {
          callback(null);
        }
      });
      return;
    }

    callback(null);
  }

  function revealFolderDirectly(folderPath) {
    try {
      var req = (window.cep_node && window.cep_node.require) ? window.cep_node.require
        : (typeof require === "function" ? require : null);
      if (req) {
        var cp = req("child_process");
        var winPath = String(folderPath || "").replace(/\//g, "\\");
        cp.exec('explorer.exe "' + winPath + '"');
      }
    } catch (eExp) {
      log("warn", "Falha ao abrir Explorer via Node: " + eExp);
    }
  }

  function executeCollect() {
    if (state.blocked || !state.scan) return;

    if (state.isEstimating && engine) {
      engine.cancel();
      state.isEstimating = false;
      log("info", "Estimativa prévia abortada: usuário acionou Coletar diretamente.");
    }

    var opts = effectiveOptions();
    var scan = state.scan;
    var node = getNodeFsModule();

    var defaultDir = "";
    if (scan.projectPath) {
      var lastSlash = Math.max(scan.projectPath.lastIndexOf("\\"), scan.projectPath.lastIndexOf("/"));
      if (lastSlash >= 0) defaultDir = scan.projectPath.substring(0, lastSlash);
    }

    var defaultFolderName = (CollectEngine && typeof CollectEngine.defaultCollectFolderName === "function")
      ? CollectEngine.defaultCollectFolderName(scan.projectName)
      : (((scan.projectName || "Projeto").replace(/\.[^.]+$/, "")) + "_Collect");

    pickDestinationFolder(defaultDir, defaultFolderName, function (chosenPath) {
      if (!chosenPath) {
        setStatus("Coleta cancelada pelo usuário.", false);
        return;
      }

      try {
        var rootPath = String(chosenPath).replace(/\\/g, "/").replace(/\/+$/, "");
        rootPath = rootPath.replace(/\.aep$/i, "");
        var footageRoot = rootPath + "/(Footage)";

        btnCollect.disabled = true;
        btnCancel.disabled = true;
        setStatus("Iniciando coleta...", false);

        if (opts.reportOnly) {
          summaryFiles.textContent = "Gerando relatório...";
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
            hostName: "Adobe After Effects " + (csInterface.getHostEnvironment ? csInterface.getHostEnvironment().appVersion : ""),
            projectPath: scan.projectPath,
            destPath: rootPath,
            modeLabel: selCollectMode.options[selCollectMode.selectedIndex].text + " (Apenas Relatório)",
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
          } catch (eW) {
            log("error", "Erro ao gravar Report.txt: " + eW);
          }

          if (opts.reveal) {
            revealFolderDirectly(rootPath);
          }

          summaryFiles.textContent = "Relatório gerado com sucesso!";
          setStatus("Salvo em: " + rootPath + "/Report.txt", false);
          btnCollect.disabled = false;
          btnCancel.disabled = false;
          btnCancel.textContent = "Fechar";
          return;
        }

        summaryFiles.textContent = "Planejando cópia de arquivos...";

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
            if (!rootPathExistedBefore) node.fs.mkdirSync(rootPath, { recursive: true });
            if (!node.fs.existsSync(footageRoot)) node.fs.mkdirSync(footageRoot, { recursive: true });
            node.fs.writeFileSync(rootPath + "/.collect_in_progress", "Em andamento: " + new Date().toISOString(), "utf8");
          }
        } catch (eDir) {
          setStatus("Falha ao criar pastas de destino: " + eDir.message, true);
          btnCollect.disabled = false;
          btnCancel.disabled = false;
          return;
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
              } catch (eSub) {}
            }
          } catch (eC) {}
        }

        function handleCopyCanceled() {
          state.isCopying = false;
          summaryFiles.textContent = "Coleta cancelada pelo usuário.";
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
                } catch (eDelFile) {}
              }

              cleanEmptyFoldersSync(footageRoot);
              try {
                if (node.fs.existsSync(footageRoot) && node.fs.readdirSync(footageRoot).length === 0) {
                  node.fs.rmdirSync(footageRoot);
                }
              } catch (eFootage) {}

              if (!rootPathExistedBefore && node.fs.existsSync(rootPath)) {
                cleanEmptyFoldersSync(rootPath);
                try {
                  if (node.fs.readdirSync(rootPath).length === 0) {
                    node.fs.rmdirSync(rootPath);
                  }
                } catch (eRmdir) {}
              }
            }
          } catch (eM) {
            log("error", "Erro ao limpar arquivos parciais: " + eM);
          }

          summaryFiles.textContent = "Coleta cancelada pelo usuário.";
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
          summaryFiles.textContent = "Copiando arquivos (" + index + "/" + copies.length + ")...";

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
          } catch (eCp) {
            log("error", "Erro ao copiar " + pair.src + " para " + pair.dest + ": " + eCp);
          }

          if (state.copyCanceled || state.isClosing) {
            handleCopyCanceled();
            return;
          }

          setTimeout(copyNext, 1);
        }

        function finalizeProject() {
          if (collectProgressBar) collectProgressBar.style.width = "100%";
          if (collectPercent) collectPercent.textContent = "100%";
          if (collectEta) collectEta.textContent = "Finalizando projeto...";
          summaryFiles.textContent = "Salvando projeto e relinkando referências...";
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

              summaryFiles.textContent = "Reescrevendo caminhos no projeto XML...";
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

              summaryFiles.textContent = "Finalizando projeto no After Effects...";
              var compIdsList = [];
              if (scan.selectedCompCount && scan.items) {
                for (var cId = 0; cId < scan.items.length; cId++) {
                  compIdsList.push(scan.items[cId].id);
                }
              }
              var finalizeOpts = {
                aepxPath: aepxPath,
                finalAepPath: finalAepPath,
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

                state.isCopying = false;

                var finProxyCount = 0;
                if (scan.items) {
                  for (var pI = 0; pI < scan.items.length; pI++) {
                    if (scan.items[pI].proxyPath) finProxyCount++;
                  }
                }

                var reportData = {
                  date: new Date().toLocaleString(),
                  hostName: "Adobe After Effects " + (csInterface.getHostEnvironment ? csInterface.getHostEnvironment().appVersion : ""),
                  projectPath: scan.projectPath,
                  destPath: rootPath,
                  modeLabel: selCollectMode.options[selCollectMode.selectedIndex].text + (opts.reduceProject ? " (Reduzir Projeto: Sim)" : ""),
                  collectedCount: copiedCount,
                  totalBytes: totalBytesCopied,
                  offlineCount: plan.offlineItems ? plan.offlineItems.length : 0,
                  proxyCount: finProxyCount,
                  effects: scan.effects || [],
                  comments: opts.comments,
                  files: collectedFileRelList
                };
                var reportContent = CollectEngine.buildReportText(reportData);

                try {
                  if (node && node.fs) {
                    node.fs.writeFileSync(rootPath + "/Report.txt", reportContent, "utf8");
                    var marker = rootPath + "/.collect_in_progress";
                    if (node.fs.existsSync(marker)) node.fs.unlinkSync(marker);
                  }
                } catch (eRep) { }

                if (opts.reveal) {
                  revealFolderDirectly(rootPath);
                }

                summaryFiles.textContent = "Coleta concluída com sucesso!";
                setStatus("Projeto e " + copiedCount + " arquivo(s) salvos em: " + rootPath, false);
                if (collectEta) collectEta.textContent = "Concluído";
                btnCollect.disabled = false;
                btnCancel.disabled = false;
                btnCancel.textContent = "Fechar";
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
        log("error", "Erro ao executar coleta: " + (errCollect && (errCollect.stack || errCollect.message || errCollect)));
        setStatus("Erro na coleta: " + ((errCollect && errCollect.message) || errCollect), true);
        btnCollect.disabled = false;
        btnCancel.disabled = false;
        btnCancel.textContent = "Fechar";
      }
    });
  }

  btnCollect.addEventListener("click", function () {
    executeCollect();
  });

  function closeWindow() {
    if (state.isClosing) return;
    state.isClosing = true;
    state.copyCanceled = true;
    if (engine) engine.cancel();
    try {
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

  /* ---------- Inicialização ---------- */

  if (isPPro) {
    optAllComps.textContent = "Para todas as sequências";
    optSelected.textContent = "Para as sequências selecionadas";
    optQueued.textContent = "Para as sequências na fila";
  }

  applyModeRules();
  if (isPPro) {
    summaryFiles.textContent = "";
    setStatus("Collect Files ainda não está disponível no Premiere Pro (" + compWordPlural + " entram numa etapa posterior).", true);
    btnCollect.disabled = true;
  } else {
    loadHostScripts(refresh);
  }
})();
