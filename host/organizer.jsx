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
            $.evalFile(fileObj);
            return true;
        }
        return false;
    }

    // Carrega host/_lib.jsx (helpers compartilhados) uma unica vez.
    // Deve rodar ANTES do motor, que consome $.global.OrgLib.
    function loadSharedLib(explicitDirPath) {
        if ($.global.OrgLib) return true;

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
                if (libFile.exists) {
                    $.evalFile(libFile);
                    if ($.global.OrgLib) {
                        if (!$.global.OrgRules) {
                            var rulesFile = new File(candidates[i].replace(/_lib\.jsx$/i, "_rules.jsx"));
                            if (rulesFile.exists) $.evalFile(rulesFile);
                        }
                        return true;
                    }
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
                if (legacyFile.exists) {
                    $.evalFile(legacyFile);
                    if (typeof $.global.aeft_organizeAEProject === "function") return true;
                }
            } catch (eLegacy) {}
        }
        return false;
    }

    $.global.organizerLoadLegacyAE = loadLegacyAE;

    $.global.organizerLoadEngine = function (explicitHostDirPath) {
        var isPPro = detectIsPremierePro();
        var targetFileName = isPPro ? "ppro_organizer.jsx" : "aeft_organizer.jsx";

        if (explicitHostDirPath) {
            loadSharedLib(explicitHostDirPath);
            var cleanDir = String(explicitHostDirPath).replace(/\\/g, "/").replace(/\/+$/, "");
            var explicitFile = new File(cleanDir + "/" + targetFileName);
            if (evalHostScriptFile(explicitFile)) {
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

    $.global.organizeAEProject = function (mainCompId, configJsonString) {
        var isPPro = ensureEngineReady();
        if (isPPro) {
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
            return $.global.ppro_getProjectComps();
        }
        return $.global.aeft_getProjectComps();
    };

    $.global.checkUnusedComps = function (configJsonString) {
        var isPPro = ensureEngineReady();
        if (isPPro) {
            return $.global.ppro_checkUnusedComps(configJsonString);
        }
        return $.global.aeft_checkUnusedComps(configJsonString);
    };

    $.global.organizeWithPreset = function (mainCompId, presetJsonString) {
        var isPPro = ensureEngineReady();
        if (isPPro) {
            return $.global.ppro_organizeWithPreset(mainCompId, presetJsonString);
        }
        return $.global.aeft_organizeWithPreset(mainCompId, presetJsonString);
    };

    $.global.createPresetFolderStructure = function (presetJsonString) {
        var isPPro = ensureEngineReady();
        if (isPPro) {
            return $.global.ppro_createPresetFolderStructure(presetJsonString);
        }
        return $.global.aeft_createPresetFolderStructure(presetJsonString);
    };

    $.global.rollbackProject = function (saveBefore, backupSnapshotJson) {
        var isPPro = ensureEngineReady();
        if (isPPro) {
            return $.global.ppro_rollbackProject(saveBefore, backupSnapshotJson);
        }
        return $.global.aeft_rollbackProject(saveBefore, backupSnapshotJson);
    };

    $.global.getRollbackSnapshotJson = function () {
        var isPPro = ensureEngineReady();
        if (isPPro) {
            return $.global.ppro_getRollbackSnapshotJson ? $.global.ppro_getRollbackSnapshotJson() : "";
        }
        return $.global.aeft_getRollbackSnapshotJson ? $.global.aeft_getRollbackSnapshotJson() : "";
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
        getRollbackSnapshotJson: $.global.getRollbackSnapshotJson
    };
})();
