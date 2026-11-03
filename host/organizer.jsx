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

    $.global.organizerLoadEngine = function (explicitHostDirPath) {
        var isPPro = detectIsPremierePro();
        var targetFileName = isPPro ? "ppro_organizer.jsx" : "aeft_organizer.jsx";

        if (explicitHostDirPath) {
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
                    var siblingFile = new File(currentScriptFile.parent.fsName + "/" + targetFileName);
                    if (evalHostScriptFile(siblingFile)) {
                        return isPPro ? "PPRO" : "AEFT";
                    }
                }
            }
        } catch (e) {}

        return isPPro ? "PPRO" : "AEFT";
    };

    // Carrega automaticamente o motor correspondente na inicialização do CEP
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
        return $.global.aeft_organizeAEProject(mainCompId, configJsonString);
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

    $.global.organizerRouter = {
        getHostId: function () {
            return detectIsPremierePro() ? "PPRO" : "AEFT";
        },
        organizeWithPreset: $.global.organizeWithPreset,
        createPresetFolderStructure: $.global.createPresetFolderStructure,
        checkUnusedComps: $.global.checkUnusedComps,
        getProjectComps: $.global.getProjectComps
    };
})();
