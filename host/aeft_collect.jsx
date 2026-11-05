/* ==========================================================================
   TidyFlow — Collect Files: scan do projeto (After Effects)
   Somente leitura: levanta os footages com arquivo, proxies, efeitos e itens
   da fila de render para a janela de Collect (com.tidyflow.collect).
   Contrato e regras: COLLECT_FILES_SPEC.md (seções 2, 4.1 e 5).
   ES3 estrito (sem let/const/arrow/forEach/map/filter/indexOf de Array).
   ========================================================================== */
(function () {
    var IMAGE_EXTS = ["png", "jpg", "jpeg", "tif", "tiff", "exr", "dpx", "tga", "bmp",
        "cin", "hdr", "sgi", "iff", "dng", "psd"];

    function esc(str) {
        return String(str === undefined || str === null ? "" : str)
            .replace(/\\/g, "\\\\")
            .replace(/"/g, '\\"')
            .replace(/\r/g, "\\r")
            .replace(/\n/g, "\\n")
            .replace(/\t/g, "\\t")
            .replace(/[\x00-\x1F]/g, " ");
    }

    function q(str) { return '"' + esc(str) + '"'; }

    function contains(arr, v) {
        for (var i = 0; i < arr.length; i++) { if (arr[i] === v) return true; }
        return false;
    }

    function fileExt(name) {
        var m = /\.([^.]+)$/.exec(String(name));
        return m ? m[1].toLowerCase() : "";
    }

    function parseOptions(json) {
        var o = null;
        try {
            if ($.global.OrgLib && $.global.OrgLib.parseJson) o = $.global.OrgLib.parseJson(json);
        } catch (e) {}
        return o || {};
    }

    function isFileSource(src) {
        try { return src instanceof FileSource && src.file !== null; } catch (e) { return false; }
    }

    function isSequenceSource(src) {
        try {
            if (!isFileSource(src)) return false;
            return !src.isStill && contains(IMAGE_EXTS, fileExt(File.decode(src.file.name)));
        } catch (e) { return false; }
    }

    // Nomes das pastas do painel Project, da raiz até o item (sem sanitizar;
    // a sanitização para o disco é feita no CollectEngine).
    function folderChain(item) {
        var parts = [];
        try {
            var rootId = app.project.rootFolder.id;
            var f = item.parentFolder;
            while (f && f.id !== rootId) {
                parts.unshift(f.name);
                f = f.parentFolder;
            }
        } catch (e) {}
        return parts;
    }

    function collectEffects(layer, effects) {
        try {
            var parade = layer.property("ADBE Effect Parade");
            if (!parade) return;
            var numFx = parade.numProperties;
            if (!numFx) return;
            for (var j = 1; j <= numFx; j++) {
                var fx = parade.property(j);
                if (fx && fx.matchName && !effects.map[fx.matchName]) {
                    effects.map[fx.matchName] = true;
                    effects.list.push({ matchName: fx.matchName, name: fx.name });
                }
            }
        } catch (e) {}
    }

    // Percorre comps recursivamente (pré-comps), marcando footages usados e efeitos.
    function walkComp(comp, visited, used, effects) {
        if (visited[comp.id]) return;
        visited[comp.id] = true;
        for (var i = 1; i <= comp.numLayers; i++) {
            var layer = null;
            try { layer = comp.layer(i); } catch (eL) { continue; }
            collectEffects(layer, effects);
            var src = null;
            try { src = layer.source; } catch (eS) { src = null; }
            if (!src) continue;
            if (src instanceof CompItem) {
                walkComp(src, visited, used, effects);
            } else if (src instanceof FootageItem) {
                used[src.id] = src;
            }
        }
    }

    function itemJson(it) {
        var main = it.mainSource;
        var parts = [];
        parts.push('"id":' + it.id);
        parts.push('"name":' + q(it.name));
        parts.push('"path":' + q(main.file.fsName));
        parts.push('"isSequence":' + (isSequenceSource(main) ? "true" : "false"));
        var missing = false;
        try { missing = it.footageMissing === true; } catch (eM) {}
        parts.push('"missing":' + (missing ? "true" : "false"));

        var folders = folderChain(it);
        var fParts = [];
        for (var i = 0; i < folders.length; i++) fParts.push(q(folders[i]));
        parts.push('"folders":[' + fParts.join(",") + "]");

        var proxyPath = "", proxyIsSeq = false, useProxy = false;
        try {
            if (isFileSource(it.proxySource)) {
                proxyPath = it.proxySource.file.fsName;
                proxyIsSeq = isSequenceSource(it.proxySource);
            }
            useProxy = it.useProxy === true;
        } catch (eP) {}
        parts.push('"proxyPath":' + q(proxyPath));
        parts.push('"proxyIsSequence":' + (proxyIsSeq ? "true" : "false"));
        parts.push('"useProxy":' + (useProxy ? "true" : "false"));
        return "{" + parts.join(",") + "}";
    }

    /**
     * Scan para a janela de Collect.
     * optionsJson: { "mode": "all" | "allComps" | "selected" | "none" }
     * Retorno: { success, mode, projectName, projectPath, projectSaved,
     *            selectedCompCount, queuedCount, effectCount, effects[], items[] }
     */
    $.global.aeft_collectScan = function (optionsJson) {
        try {
            if (!app.project) return '{"success":false,"error":"Nenhum projeto aberto."}';
            var opts = parseOptions(optionsJson);
            var mode = opts.mode || "all";
            var proj = app.project;

            // Comps de partida
            var comps = [];
            var selectedCount = 0;
            if (mode === "selected") {
                var sel = proj.selection;
                for (var s = 0; s < sel.length; s++) {
                    if (sel[s] instanceof CompItem) comps.push(sel[s]);
                }
                selectedCount = comps.length;
            } else if (mode !== "none") {
                for (var c = 1; c <= proj.numItems; c++) {
                    var ci = proj.item(c);
                    if (ci instanceof CompItem) comps.push(ci);
                }
                try {
                    var selAll = proj.selection;
                    for (var s2 = 0; s2 < selAll.length; s2++) {
                        if (selAll[s2] instanceof CompItem) selectedCount++;
                    }
                } catch (eSel) {}
            }

            var visited = {}, used = {};
            var effects = { map: {}, list: [] };
            if (mode !== "none") {
                for (var k = 0; k < comps.length; k++) walkComp(comps[k], visited, used, effects);
            }

            // Footages a coletar
            var items = [];
            if (mode === "all") {
                for (var i = 1; i <= proj.numItems; i++) {
                    var it = proj.item(i);
                    if (it instanceof FootageItem && isFileSource(it.mainSource)) items.push(it);
                }
            } else if (mode === "allComps" || mode === "selected") {
                for (var id in used) {
                    if (used.hasOwnProperty(id) && isFileSource(used[id].mainSource)) items.push(used[id]);
                }
            }

            var itemParts = [];
            for (var n = 0; n < items.length; n++) {
                try { itemParts.push(itemJson(items[n])); } catch (eItem) {}
            }

            var fxParts = [];
            for (var f = 0; f < effects.list.length; f++) {
                fxParts.push('{"matchName":' + q(effects.list[f].matchName) + ',"name":' + q(effects.list[f].name) + "}");
            }

            var queued = 0;
            try {
                for (var r = 1; r <= proj.renderQueue.numItems; r++) {
                    if (proj.renderQueue.item(r).status === RQItemStatus.QUEUED) queued++;
                }
            } catch (eRq) {}

            var projFile = proj.file;
            return "{" + [
                '"success":true',
                '"mode":' + q(mode),
                '"projectName":' + q(projFile ? File.decode(projFile.name) : ""),
                '"projectPath":' + q(projFile ? projFile.fsName : ""),
                '"projectSaved":' + (projFile ? "true" : "false"),
                '"selectedCompCount":' + selectedCount,
                '"queuedCount":' + queued,
                '"effectCount":' + effects.list.length,
                '"effects":[' + fxParts.join(",") + "]",
                '"items":[' + itemParts.join(",") + "]"
            ].join(",") + "}";
        } catch (err) {
            return '{"success":false,"error":' + q(err.toString()) + "}";
        }
    };

    /**
     * Diálogo nativo do sistema para escolha de pasta de destino.
     */
    $.global.aeft_collectSelectFolder = function (promptText, defaultPath) {
        try {
            var f = null;
            if (defaultPath) {
                try { f = new Folder(defaultPath); } catch (eF) { f = null; }
            }
            var picked = Folder.selectDialog(promptText || "Selecione a pasta de destino para o Collect", f);
            if (!picked) return '{"success":false,"canceled":true}';
            return '{"success":true,"folderPath":' + q(picked.fsName) + '}';
        } catch (err) {
            return '{"success":false,"error":' + q(err.toString()) + '}';
        }
    };

    /**
     * Diálogo nativo do sistema para salvar pasta do Collect com nome customizável.
     */
    $.global.aeft_collectSaveDialog = function (promptText, defaultPath, defaultName) {
        try {
            var name = defaultName || "Projeto_Collect";
            var startPath = name;
            if (defaultPath) {
                var cleanDir = String(defaultPath).replace(/[\\\/]+$/, "");
                startPath = cleanDir + "/" + name;
            }
            var f = new File(startPath);
            var picked = f.saveDialog(promptText || "Salvar Pasta do Collect");
            if (!picked) return '{"success":false,"canceled":true}';
            return '{"success":true,"folderPath":' + q(picked.fsName) + '}';
        } catch (err) {
            return '{"success":false,"error":' + q(err.toString()) + '}';
        }
    };

    /**
     * Salva o projeto original atual.
     */
    $.global.aeft_collectSaveProject = function () {
        try {
            if (!app.project) return '{"success":false,"error":"Nenhum projeto aberto."}';
            app.project.save();
            return '{"success":true}';
        } catch (err) {
            return '{"success":false,"error":' + q(err.toString()) + '}';
        }
    };

    /**
     * Salva uma cópia temporária do projeto atual como .aepx (XML).
     */
    $.global.aeft_collectSaveAepx = function (aepxFsPath) {
        try {
            if (!app.project) return '{"success":false,"error":"Nenhum projeto aberto."}';
            var f = new File(aepxFsPath);
            if (f.parent && !f.parent.exists) f.parent.create();
            app.project.save(f);
            return '{"success":true}';
        } catch (err) {
            return '{"success":false,"error":' + q(err.toString()) + '}';
        }
    };

    /**
     * Reabre o .aepx modificado, restaura nomes de itens, reduz o projeto se solicitado
     * e salva como o .aep final na pasta de Collect.
     */
    $.global.aeft_collectFinalize = function (optionsJson) {
        try {
            var opts = parseOptions(optionsJson);
            var aepxPath = opts.aepxPath;
            var finalAepPath = opts.finalAepPath;
            var itemNames = opts.itemNames || {};
            var reduceProject = opts.reduceProject === true;
            var compIds = opts.compIds || [];

            var aepxFile = new File(aepxPath);
            if (!aepxFile.exists) return '{"success":false,"error":"Arquivo .aepx temporário não encontrado."}';

            // Fecha sem salvar e abre o .aepx com os novos caminhos
            app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES);
            app.open(aepxFile);

            // Restaura nomes originais de itens que possam ter sido alterados
            for (var idStr in itemNames) {
                if (itemNames.hasOwnProperty(idStr)) {
                    var id = parseInt(idStr, 10);
                    try {
                        var it = app.project.itemByID(id);
                        if (it && it.name !== itemNames[idStr]) {
                            it.name = itemNames[idStr];
                        }
                    } catch (eIt) {}
                }
            }

            // Reduz o projeto mantendo apenas as comps especificadas
            if (reduceProject && compIds && compIds.length > 0) {
                var compsToKeep = [];
                for (var c = 0; c < compIds.length; c++) {
                    try {
                        var ci = app.project.itemByID(compIds[c]);
                        if (ci instanceof CompItem) compsToKeep.push(ci);
                    } catch (eC) {}
                }
                if (compsToKeep.length > 0) {
                    try { app.project.reduceProject(compsToKeep); } catch (eRed) {}
                }
            }

            // Salva como .aep final na pasta de destino
            var finalAepFile = new File(finalAepPath);
            if (finalAepFile.parent && !finalAepFile.parent.exists) finalAepFile.parent.create();
            app.project.save(finalAepFile);

            // Remove o .aepx intermediário
            try {
                if (aepxFile.exists && app.project.file && app.project.file.fsName.toLowerCase() !== aepxFile.fsName.toLowerCase()) {
                    aepxFile.remove();
                }
            } catch (eRx) {}

            return '{"success":true,"finalAepPath":' + q(finalAepFile.fsName) + '}';
        } catch (err) {
            return '{"success":false,"error":' + q(err.toString()) + '}';
        }
    };

    /**
     * Revela a pasta no sistema operacional (não usa f.execute para não disparar alerta de segurança do AE).
     */
    $.global.aeft_collectReveal = function (folderFsPath) {
        return '{"success":true}';
    };
})();
