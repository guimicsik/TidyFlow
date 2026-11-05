/* ==========================================================================
   Project Organizer — Roteador Unificado de Host (After Effects + Premiere Pro)
   Detecta automaticamente o aplicativo hospedeiro (AEFT ou PPRO) e delega
   todas as chamadas para o motor correspondente mantendo 100% de compatibilidade.
   ========================================================================== */

(function () {
    function detectIsPremierePro() {
        try {
            if (typeof BridgeTalk !== "undefined" && BridgeTalk.appName) {
                var appName = String(BridgeTalk.appName).toLowerCase();
                if (appName.indexOf("premiere") !== -1) return true;
                if (appName.indexOf("aftereffects") !== -1) return false;
            }
        } catch (e1) {}

        try {
            if (typeof FolderItem === "undefined" && typeof CompItem === "undefined") {
                if (typeof app !== "undefined" && app.project && typeof app.project.rootItem !== "undefined") {
                    return true;
                }
            }
        } catch (e2) {}

        return false;
    }

    function evalHostScriptFile(fileObj) {
        if (fileObj && fileObj.exists) {
            try {
                fileObj.encoding = "UTF-8";
                $.evalFile(fileObj);
                return true;
            } catch (eEval) {
                $.global._organizerLastLoadError =
                    (fileObj.name || "script") + ": " + eEval.toString() +
                    (eEval.line ? " (linha " + eEval.line + ")" : "");
                return false;
            }
        }
        return false;
    }

    // Carrega host/_lib.jsx (helpers compartilhados) uma unica vez.
    // Deve rodar ANTES do motor, que consome $.global.OrgLib.
    function loadSharedLib(explicitDirPath) {

        var candidates = [];
        if (explicitDirPath) {
            candidates.push(String(explicitDirPath).replace(/\\/g, "/").replace(/\/+$/, "") + "/_lib.jsx");
        }
        try {
            if ($.fileName) {
                var currentScriptFile = new File($.fileName);
                if (currentScriptFile && currentScriptFile.parent) {
                    candidates.push(currentScriptFile.parent.fsName + "/_lib.jsx");
                }
            }
        } catch (ePath) {}

        for (var i = 0; i < candidates.length; i++) {
            try {
                var libFile = new File(candidates[i]);
                if (evalHostScriptFile(libFile) && $.global.OrgLib) {
                    var rulesFile = new File(candidates[i].replace(/_lib\.jsx$/i, "_rules.jsx"));
                    if (rulesFile.exists) {
                        evalHostScriptFile(rulesFile);
                    }
                    return true;
                }
            } catch (eLib) {}
        }
        return false;
    }

    $.global.organizerLoadLib = loadSharedLib;

    // Carrega o motor legado do AE (pre-presets) sob demanda
    function loadLegacyAE(explicitDirPath) {
        if (typeof $.global.aeft_organizeAEProject === "function") return true;

        var candidates = [];
        if (explicitDirPath) {
            candidates.push(String(explicitDirPath).replace(/\\/g, "/").replace(/\/+$/, "") + "/legacy/aeft_legacy.jsx");
        }
        try {
            if ($.fileName) {
                var currentScriptFile = new File($.fileName);
                if (currentScriptFile && currentScriptFile.parent) {
                    candidates.push(currentScriptFile.parent.fsName + "/legacy/aeft_legacy.jsx");
                }
            }
        } catch (ePath) {}

        for (var i = 0; i < candidates.length; i++) {
            try {
                var legacyFile = new File(candidates[i]);
                if (evalHostScriptFile(legacyFile) && typeof $.global.aeft_organizeAEProject === "function") {
                    return true;
                }
            } catch (eLegacy) {}
        }
        return false;
    }

    $.global.organizerLoadLegacyAE = loadLegacyAE;

    // Carrega o scan do Collect Files (somente After Effects por enquanto)
    function loadCollect(dirPath, isPPro) {
        if (isPPro || !dirPath) return false;
        var cleanDir = String(dirPath).replace(/\\/g, "/").replace(/\/+$/, "");
        try {
            return evalHostScriptFile(new File(cleanDir + "/aeft_collect.jsx"));
        } catch (eCollect) {}
        return false;
    }

    $.global.organizerLoadEngine = function (explicitHostDirPath) {
        var isPPro = detectIsPremierePro();
        var targetFileName = isPPro ? "ppro_organizer.jsx" : "aeft_organizer.jsx";

        if (explicitHostDirPath) {
            loadSharedLib(explicitHostDirPath);
            var cleanDir = String(explicitHostDirPath).replace(/\\/g, "/").replace(/\/+$/, "");
            var explicitFile = new File(cleanDir + "/" + targetFileName);
            if (evalHostScriptFile(explicitFile)) {
                loadCollect(cleanDir, isPPro);
                return isPPro ? "PPRO" : "AEFT";
            }
        }

        try {
            if ($.fileName) {
                var currentScriptFile = new File($.fileName);
                if (currentScriptFile && currentScriptFile.parent) {
                    loadSharedLib(currentScriptFile.parent.fsName);
                    var siblingFile = new File(currentScriptFile.parent.fsName + "/" + targetFileName);
                    if (evalHostScriptFile(siblingFile)) {
                        loadCollect(currentScriptFile.parent.fsName, isPPro);
                        return isPPro ? "PPRO" : "AEFT";
                    }
                }
            }
        } catch (e) {}

        return isPPro ? "PPRO" : "AEFT";
    };

    // Carrega automaticamente a biblioteca e o motor correspondente na inicialização do CEP
    loadSharedLib();
    $.global.organizerLoadEngine();

    function ensureEngineReady() {
        var isPPro = detectIsPremierePro();
        if (isPPro && typeof $.global.ppro_organizeWithPreset !== "function") {
            $.global.organizerLoadEngine();
        } else if (!isPPro && typeof $.global.aeft_organizeWithPreset !== "function") {
            $.global.organizerLoadEngine();
        }
        return isPPro;
    }

    function buildMissingEngineJson(hostLabel) {
        var detail = $.global._organizerLastLoadError ? (" [" + String($.global._organizerLastLoadError).replace(/\\/g, "/").replace(/"/g, "'") + "]") : "";
        return '{"success": false, "error": "Motor do ' + hostLabel + ' indisponivel.' + detail + '"}';
    }

    $.global.organizeAEProject = function (mainCompId, configJsonString) {
        var isPPro = ensureEngineReady();
        if (isPPro) {
            if (typeof $.global.ppro_organizeWithPreset !== "function") return buildMissingEngineJson("Premiere Pro");
            return $.global.ppro_organizeWithPreset(mainCompId, configJsonString);
        }
        if (typeof $.global.aeft_organizeAEProject !== "function") {
            loadLegacyAE();
        }
        if (typeof $.global.aeft_organizeAEProject === "function") {
            return $.global.aeft_organizeAEProject(mainCompId, configJsonString);
        }
        return '{"success": false, "error": "Motor legado do After Effects indisponivel."}';
    };

    $.global.getProjectComps = function () {
        var isPPro = ensureEngineReady();
        if (isPPro) {
            if (typeof $.global.ppro_getProjectComps !== "function") return "[]";
            return $.global.ppro_getProjectComps();
        }
        if (typeof $.global.aeft_getProjectComps !== "function") return "[]";
        return $.global.aeft_getProjectComps();
    };

    $.global.checkUnusedComps = function (configJsonString) {
        var isPPro = ensureEngineReady();
        if (isPPro) {
            if (typeof $.global.ppro_checkUnusedComps !== "function") return buildMissingEngineJson("Premiere Pro");
            return $.global.ppro_checkUnusedComps(configJsonString);
        }
        if (typeof $.global.aeft_checkUnusedComps !== "function") return buildMissingEngineJson("After Effects");
        return $.global.aeft_checkUnusedComps(configJsonString);
    };

    $.global.organizeWithPreset = function (mainCompId, presetJsonString) {
        var isPPro = ensureEngineReady();
        if (isPPro) {
            if (typeof $.global.ppro_organizeWithPreset !== "function") return buildMissingEngineJson("Premiere Pro");
            return $.global.ppro_organizeWithPreset(mainCompId, presetJsonString);
        }
        if (typeof $.global.aeft_organizeWithPreset !== "function") return buildMissingEngineJson("After Effects");
        return $.global.aeft_organizeWithPreset(mainCompId, presetJsonString);
    };

    $.global.createPresetFolderStructure = function (presetJsonString) {
        var isPPro = ensureEngineReady();
        if (isPPro) {
            if (typeof $.global.ppro_createPresetFolderStructure !== "function") return buildMissingEngineJson("Premiere Pro");
            return $.global.ppro_createPresetFolderStructure(presetJsonString);
        }
        if (typeof $.global.aeft_createPresetFolderStructure !== "function") return buildMissingEngineJson("After Effects");
        return $.global.aeft_createPresetFolderStructure(presetJsonString);
    };

    $.global.rollbackProject = function (saveBefore, backupSnapshotJson) {
        var isPPro = ensureEngineReady();
        if (isPPro) {
            if (typeof $.global.ppro_rollbackProject !== "function") return buildMissingEngineJson("Premiere Pro");
            return $.global.ppro_rollbackProject(saveBefore, backupSnapshotJson);
        }
        if (typeof $.global.aeft_rollbackProject !== "function") return buildMissingEngineJson("After Effects");
        return $.global.aeft_rollbackProject(saveBefore, backupSnapshotJson);
    };

    $.global.getRollbackSnapshotJson = function () {
        var isPPro = ensureEngineReady();
        if (isPPro) {
            return $.global.ppro_getRollbackSnapshotJson ? $.global.ppro_getRollbackSnapshotJson() : "";
        }
        return $.global.aeft_getRollbackSnapshotJson ? $.global.aeft_getRollbackSnapshotJson() : "";
    };

    // Collect Files — scan somente leitura (COLLECT_FILES_SPEC.md §4)
    $.global.collectScan = function (optionsJson) {
        var isPPro = ensureEngineReady();
        if (isPPro) {
            return '{"success": false, "unsupported": true, "error": "Collect Files ainda não está disponível no Premiere Pro."}';
        }
        if (typeof $.global.aeft_collectScan !== "function") {
            $.global.organizerLoadEngine();
        }
        if (typeof $.global.aeft_collectScan !== "function") {
            return '{"success": false, "error": "Módulo de Collect (aeft_collect.jsx) indisponível."}';
        }
        return $.global.aeft_collectScan(optionsJson);
    };

    $.global.collectSelectFolder = function (promptText, defaultPath) {
        ensureEngineReady();
        if (typeof $.global.aeft_collectSelectFolder === "function") {
            return $.global.aeft_collectSelectFolder(promptText, defaultPath);
        }
        return '{"success":false,"error":"aeft_collectSelectFolder indisponível"}';
    };

    $.global.collectSaveDialog = function (promptText, defaultPath, defaultName) {
        ensureEngineReady();
        if (typeof $.global.aeft_collectSaveDialog === "function") {
            return $.global.aeft_collectSaveDialog(promptText, defaultPath, defaultName);
        }
        return '{"success":false,"error":"aeft_collectSaveDialog indisponível"}';
    };

    $.global.collectSaveProject = function () {
        ensureEngineReady();
        if (typeof $.global.aeft_collectSaveProject === "function") {
            return $.global.aeft_collectSaveProject();
        }
        return '{"success":false,"error":"aeft_collectSaveProject indisponível"}';
    };

    $.global.collectSaveAepx = function (aepxFsPath) {
        ensureEngineReady();
        if (typeof $.global.aeft_collectSaveAepx === "function") {
            return $.global.aeft_collectSaveAepx(aepxFsPath);
        }
        return '{"success":false,"error":"aeft_collectSaveAepx indisponível"}';
    };

    $.global.collectFinalize = function (optionsJson) {
        ensureEngineReady();
        if (typeof $.global.aeft_collectFinalize === "function") {
            return $.global.aeft_collectFinalize(optionsJson);
        }
        return '{"success":false,"error":"aeft_collectFinalize indisponível"}';
    };

    $.global.collectReveal = function (folderFsPath) {
        ensureEngineReady();
        if (typeof $.global.aeft_collectReveal === "function") {
            return $.global.aeft_collectReveal(folderFsPath);
        }
        return '{"success":false,"error":"aeft_collectReveal indisponível"}';
    };

    $.global.organizerRouter = {
        getHostId: function () {
            return detectIsPremierePro() ? "PPRO" : "AEFT";
        },
        organizeWithPreset: $.global.organizeWithPreset,
        createPresetFolderStructure: $.global.createPresetFolderStructure,
        checkUnusedComps: $.global.checkUnusedComps,
        getProjectComps: $.global.getProjectComps,
        rollbackProject: $.global.rollbackProject,
        getRollbackSnapshotJson: $.global.getRollbackSnapshotJson,
        collectScan: $.global.collectScan,
        collectSelectFolder: $.global.collectSelectFolder,
        collectSaveDialog: $.global.collectSaveDialog,
        collectSaveProject: $.global.collectSaveProject,
        collectSaveAepx: $.global.collectSaveAepx,
        collectFinalize: $.global.collectFinalize,
        collectReveal: $.global.collectReveal
    };
})();
