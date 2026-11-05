/* ==========================================================================
   TidyFlow — Motor ExtendScript para Adobe After Effects
   ========================================================================== */

/* Carrega as bibliotecas compartilhadas (host/_lib.jsx e host/_rules.jsx) */
(function () {
    try {
        var here = $.fileName ? new File($.fileName) : null;
        if (!here || !here.parent) return;
        var baseDir = here.parent.fsName;
        var libFile = new File(baseDir + "/_lib.jsx");
        if (libFile.exists) {
            libFile.encoding = "UTF-8";
            $.evalFile(libFile);
        }
        var rulesFile = new File(baseDir + "/_rules.jsx");
        if (rulesFile.exists) {
            rulesFile.encoding = "UTF-8";
            $.evalFile(rulesFile);
        }
    } catch (eLibLoad) { }
})();

$.global.aeft_getProjectComps = function () {
    var escapeJsonString = $.global.OrgLib.escapeJsonString;

    if (!app.project || !app.project.items) {
        return "[]";
    }

    var comps = [];
    for (var i = 1; i <= app.project.items.length; i++) {
        var item = app.project.items[i];
        if (item instanceof CompItem) {
            comps.push('{"id": ' + item.id + ', "name": "' + escapeJsonString(item.name) + '"}');
        }
    }

    return "[" + comps.join(", ") + "]";
};

$.global.aeft_checkUnusedComps = function (configJsonString) {
    var escapeJsonString = $.global.OrgLib.escapeJsonString;

    function parseConfig(jsonStr) {
        if (!jsonStr) return null;
        if (typeof JSON !== "undefined" && JSON.parse) {
            return JSON.parse(jsonStr);
        }
        return eval("(" + jsonStr + ")");
    }

    function getOrCreateFolder(pathArray) {
        var currentParent = app.project.rootFolder;
        for (var i = 0; i < pathArray.length; i++) {
            var folderName = pathArray[i];
            var foundFolder = null;
            for (var j = 1; j <= app.project.numItems; j++) {
                var item = app.project.item(j);
                if (
                    item instanceof FolderItem &&
                    item.parentFolder === currentParent &&
                    item.name === folderName
                ) {
                    foundFolder = item;
                    break;
                }
            }
            if (!foundFolder) {
                foundFolder = app.project.items.addFolder(folderName);
                foundFolder.parentFolder = currentParent;
            }
            currentParent = foundFolder;
        }
        return currentParent;
    }

    function isInsideFolder(item, targetFolder) {
        if (!item || !targetFolder) return false;
        var parent = item.parentFolder;
        while (parent && parent !== app.project.rootFolder) {
            if (parent === targetFolder) return true;
            parent = parent.parentFolder;
        }
        return false;
    }

    function isInsidePsdAiFolder(item) {
        if (!item) return false;
        var parent = item.parentFolder;
        while (parent && parent !== app.project.rootFolder) {
            var pName = parent.name.toUpperCase();
            if (pName === "PSD" || pName === "AI" || pName === "PSB") {
                return true;
            }
            parent = parent.parentFolder;
        }
        return false;
    }

    // A checagem de projeto precisa vir ANTES de abrir o grupo de desfazer:
    // app.beginUndoGroup sem projeto aberto lança e o evalScript devolve erro cru.
    if (!app.project) {
        return '{"success": false, "error": "Nenhum projeto aberto no After Effects."}';
    }

    app.beginUndoGroup("Verificar Composições");
    try {
        var config = parseConfig(configJsonString) || {};
        var foldersCfg = config.folders || {};
        var settingsCfg = config.settings || {};
        var outputFolderName = foldersCfg.output || "01_Output";
        var unusedFolderName = settingsCfg.unusedFolderName || foldersCfg.unused || "Nunca Usadas";

        // Se for um preset com árvore, descobrir o nome configurado para MainComp
        if (config.tree && config.tree.length) {
            for (var ti = 0; ti < config.tree.length; ti++) {
                var tNode = config.tree[ti];
                if (tNode && tNode.rules && tNode.rules.types) {
                    for (var rt = 0; rt < tNode.rules.types.length; rt++) {
                        if (tNode.rules.types[rt] === "MainComp" || tNode.rules.types[rt] === "Compositions") {
                            outputFolderName = tNode.name;
                            break;
                        }
                    }
                }
            }
        }

        function stripPrefix(nm) {
            return String(nm || "").replace(/^\d+[_-\s]+/, "");
        }

        // Localizar pasta Output (se existir, com ou sem prefixo numérico)
        var outputFolder = null;
        var cleanOutputTarget = stripPrefix(outputFolderName).toLowerCase();
        for (var f = 1; f <= app.project.numItems; f++) {
            var fi = app.project.item(f);
            if (
                fi instanceof FolderItem &&
                fi.parentFolder === app.project.rootFolder &&
                (fi.name === outputFolderName || stripPrefix(fi.name).toLowerCase() === cleanOutputTarget)
            ) {
                outputFolder = fi;
                break;
            }
        }

        // Localizar pasta Nunca Usadas (se já existir)
        var existingUnusedFolder = null;
        for (var uf = 1; uf <= app.project.numItems; uf++) {
            var ufi = app.project.item(uf);
            if (
                ufi instanceof FolderItem &&
                ufi.parentFolder === app.project.rootFolder &&
                ufi.name === unusedFolderName
            ) {
                existingUnusedFolder = ufi;
                break;
            }
        }

        // Mapear composições presentes na Render Queue
        var renderQueueCompIds = {};
        if (app.project.renderQueue) {
            for (var rq = 1; rq <= app.project.renderQueue.numItems; rq++) {
                var rqItem = app.project.renderQueue.item(rq);
                if (rqItem && rqItem.comp) {
                    renderQueueCompIds[rqItem.comp.id] = true;
                }
            }
        }

        // Mapear composições selecionadas pelo usuário no painel Project
        var selectedCompIds = {};
        var sel = app.project.selection;
        var hasSelectedCompsWithLayers = false;
        if (sel && sel.length > 0) {
            for (var s = 0; s < sel.length; s++) {
                if (sel[s] instanceof CompItem && sel[s].numLayers > 0) {
                    selectedCompIds[sel[s].id] = true;
                    hasSelectedCompsWithLayers = true;
                }
            }
        }

        // Identificar item ativo no visualizador
        var activeCompId = null;
        if (
            app.project.activeItem &&
            app.project.activeItem instanceof CompItem &&
            app.project.activeItem.numLayers > 0
        ) {
            activeCompId = app.project.activeItem.id;
        }

        // Coletar todas as composições do projeto
        var allComps = [];
        for (var i = 1; i <= app.project.numItems; i++) {
            var it = app.project.item(i);
            if (it instanceof CompItem) {
                allComps.push(it);
            }
        }

        // Mapear composições protegidas (com camadas)
        var protectedCompIds = {};
        for (var cIdx = 0; cIdx < allComps.length; cIdx++) {
            var c = allComps[cIdx];
            if (c.numLayers > 0) {
                if (outputFolder && (c.parentFolder === outputFolder || isInsideFolder(c, outputFolder))) {
                    protectedCompIds[c.id] = true;
                } else if (renderQueueCompIds[c.id]) {
                    protectedCompIds[c.id] = true;
                } else if (selectedCompIds[c.id]) {
                    protectedCompIds[c.id] = true;
                } else if (!outputFolder && !hasSelectedCompsWithLayers && activeCompId && c.id === activeCompId) {
                    protectedCompIds[c.id] = true;
                } else if (isInsidePsdAiFolder(c)) {
                    protectedCompIds[c.id] = true;
                }
            }
        }

        var toMove = [];
        var emptyCount = 0;
        var notUsedCount = 0;
        var unusedCompMap = {};

        // Passo 1: Identificar composições vazias ou não utilizadas
        for (var k = 0; k < allComps.length; k++) {
            var comp = allComps[k];

            var alreadyInUnused = (
                existingUnusedFolder &&
                (comp.parentFolder === existingUnusedFolder || isInsideFolder(comp, existingUnusedFolder))
            );

            if (comp.numLayers === 0) {
                unusedCompMap[comp.id] = true;
                if (!alreadyInUnused) {
                    toMove.push(comp);
                    emptyCount++;
                }
            } else if (!protectedCompIds[comp.id] && (!comp.usedIn || comp.usedIn.length === 0)) {
                unusedCompMap[comp.id] = true;
                if (!alreadyInUnused) {
                    toMove.push(comp);
                    notUsedCount++;
                }
            }
        }

        // Passo 2: Propagação em cascata (pré-comps usadas exclusivamente em comps não-utilizadas/vazias)
        var foundMore = true;
        while (foundMore) {
            foundMore = false;
            for (var m = 0; m < allComps.length; m++) {
                var candidate = allComps[m];
                if (unusedCompMap[candidate.id] || protectedCompIds[candidate.id]) {
                    continue;
                }

                if (candidate.usedIn && candidate.usedIn.length > 0) {
                    var allParentsUnused = true;
                    for (var u = 0; u < candidate.usedIn.length; u++) {
                        var parentComp = candidate.usedIn[u];
                        if (!unusedCompMap[parentComp.id]) {
                            allParentsUnused = false;
                            break;
                        }
                    }

                    if (allParentsUnused) {
                        unusedCompMap[candidate.id] = true;
                        var isAlreadyInUnused = (
                            existingUnusedFolder &&
                            (candidate.parentFolder === existingUnusedFolder || isInsideFolder(candidate, existingUnusedFolder))
                        );
                        if (!isAlreadyInUnused) {
                            toMove.push(candidate);
                            notUsedCount++;
                        }
                        foundMore = true;
                    }
                }
            }
        }

        // Mover itens identificados para a pasta "Nunca Usadas"
        var movedCount = 0;
        if (toMove.length > 0) {
            if (typeof $.global.aeft_ensurePreOrganizeSnapshot === "function") {
                $.global.aeft_ensurePreOrganizeSnapshot();
            }
            var targetFolder = getOrCreateFolder([unusedFolderName]);
            for (var t = 0; t < toMove.length; t++) {
                var itemToMove = toMove[t];
                if (itemToMove.parentFolder !== targetFolder) {
                    itemToMove.parentFolder = targetFolder;
                    movedCount++;
                }
            }
            if (typeof $.global.aeft_markPostOrganizeState === "function") {
                $.global.aeft_markPostOrganizeState();
            }
        }

        return (
            '{"success": true, "movedCount": ' +
            movedCount +
            ', "emptyCount": ' +
            emptyCount +
            ', "notUsedCount": ' +
            notUsedCount +
            "}"
        );
    } catch (err) {
        return '{"success": false, "error": "' + escapeJsonString(err.toString()) + '"}';
    } finally {
        app.endUndoGroup();
    }
};

$.global.aeft_organizeWithPreset = function (mainCompId, presetJsonString) {
    var escapeJsonString = $.global.OrgLib.escapeJsonString;

    var parseJson = $.global.OrgLib.parseJson;

    var stripNumericPrefix = $.global.OrgLib.stripNumericPrefix;

    var arrayContains = $.global.OrgLib.arrayContains;

    var arrayContainsIgnoreCase = $.global.OrgLib.arrayContainsIgnoreCase;

    var Lib = $.global.OrgLib;

    function applyLabelSafe(folderItem, labelIndex) {
        if (!folderItem) return;
        var num = parseInt(labelIndex, 10);
        if (!isNaN(num) && num >= 0 && num <= 16) {
            try {
                if (folderItem.label !== num) {
                    folderItem.label = num;
                }
            } catch (e) { }
        }
    }

    var getFileExtension = $.global.OrgLib.getFileExtension;

    function getParentFolderNameFromPath(filePath) {
        if (!filePath) return "";
        var clean = String(filePath).replace(/\\/g, "/");
        while (clean.length > 0 && clean.charAt(clean.length - 1) === "/") {
            clean = clean.substring(0, clean.length - 1);
        }
        var lastSlash = clean.lastIndexOf("/");
        if (lastSlash === -1) return "";
        var dirPath = clean.substring(0, lastSlash);
        var prevSlash = dirPath.lastIndexOf("/");
        var folderName = (prevSlash !== -1) ? dirPath.substring(prevSlash + 1) : dirPath;
        if (folderName.indexOf(":") !== -1 || folderName.length === 0) {
            return "";
        }
        return folderName;
    }

    function getFileNameFromPath(filePath) {
        if (!filePath) return "";
        var clean = String(filePath).replace(/\\/g, "/");
        var lastSlash = clean.lastIndexOf("/");
        return lastSlash === -1 ? clean : clean.substring(lastSlash + 1);
    }

    var isSameFolder = $.global.OrgLib.isSameItem;

    function isInsideFolder(item, targetFolder) {
        if (!item || !targetFolder) return false;
        var parent = item.parentFolder;
        while (parent && !isSameFolder(parent, app.project.rootFolder)) {
            if (isSameFolder(parent, targetFolder)) return true;
            parent = parent.parentFolder;
        }
        return false;
    }

    function getOrCreateSubFolder(parentFolder, pathArray, inheritLabel) {
        var currentParent = parentFolder || app.project.rootFolder;
        for (var i = 0; i < pathArray.length; i++) {
            var folderName = pathArray[i];
            var foundFolder = _findFolderInIndex(currentParent, folderName);
            if (foundFolder === undefined) {
                foundFolder = null;
                for (var j = 1; j <= app.project.numItems; j++) {
                    _scanCount++;
                    var item = app.project.item(j);
                    if (
                        item instanceof FolderItem &&
                        isSameFolder(item.parentFolder, currentParent) &&
                        item.name === folderName
                    ) {
                        foundFolder = item;
                        break;
                    }
                }
            }
            if (!foundFolder) {
                foundFolder = app.project.items.addFolder(folderName);
                foundFolder.parentFolder = currentParent;
                if (inheritLabel !== undefined && inheritLabel !== null) {
                    applyLabelSafe(foundFolder, inheritLabel);
                }
                _indexOneFolder(foundFolder);
            }
            currentParent = foundFolder;
        }
        return currentParent;
    }

    if (!app.project) {
        return '{"success": false, "error": "Nenhum projeto aberto no After Effects."}';
    }

    var preset = parseJson(presetJsonString);
    if (!preset || !preset.tree) {
        // Motor legado (pre-presets) foi movido para host/legacy/aeft_legacy.jsx
        // e e avaliado apenas sob demanda, mantendo o caminho antigo funcional.
        if (typeof $.global.organizerLoadLegacyAE === "function" && typeof $.global.aeft_organizeAEProject !== "function") {
            $.global.organizerLoadLegacyAE();
        }
        if (typeof $.global.aeft_organizeAEProject === "function") {
            return $.global.aeft_organizeAEProject(mainCompId, presetJsonString);
        }
        return '{"success": false, "error": "Preset invalido: arvore de pastas (tree) ausente."}';
    }

    var settings = preset.settings || {};
    var usePrefixNumbering = (settings.usePrefixNumbering !== false);
    var deleteEmptyFolders = (settings.deleteEmptyFolders !== false);
    var saveProjectBefore = (settings.saveProjectBefore === true);
    var reduceProject = (settings.reduceProject === true);
    var groupBySourceFolderGlobal = (settings.groupBySourceFolder !== false);
    var unusedFolderName = settings.unusedFolderName || "Nunca Usadas";

    // --- Perfil de execucao (Fase 2): tempo total + varreduras de projeto ---
    var _profT0 = new Date().getTime();
    var _scanCount = 0;

    // --- Indice de pastas por pai (Fase 2) ---
    // Mantem um mapa { parentId: { nomeEmMinusculas: FolderItem } } construido em UMA
    // passada, em vez de varrer app.project.numItems a cada pasta do preset.
    // Toda busca cai no fallback linear original quando o indice nao confirma o item,
    // portanto o comportamento e identico ao anterior em qualquer caso de borda.
    var _folderIndex = null;
    var _folderIndexFailed = false;

    function _folderKey(name) {
        return String(name || "").toLowerCase();
    }

    function _indexOneFolder(folder) {
        if (!_folderIndex || !folder) return;
        try {
            var pid = (folder.parentFolder && folder.parentFolder.id !== undefined) ? folder.parentFolder.id : 0;
            if (!_folderIndex[pid]) _folderIndex[pid] = {};
            var bucket = _folderIndex[pid];
            var rawKey = _folderKey(folder.name);
            if (!bucket[rawKey]) bucket[rawKey] = folder;
            var cleanKey = _folderKey(stripNumericPrefix(folder.name));
            if (cleanKey && !bucket[cleanKey]) bucket[cleanKey] = folder;
        } catch (eIdx) { }
    }

    function _buildFolderIndex() {
        if (_folderIndexFailed) return;
        _folderIndex = {};
        try {
            for (var i = 1; i <= app.project.numItems; i++) {
                _scanCount++;
                var it = app.project.item(i);
                if (it instanceof FolderItem) {
                    _indexOneFolder(it);
                }
            }
        } catch (eBuild) {
            _folderIndex = null;
            _folderIndexFailed = true;
        }
    }

    // Retorna: FolderItem (achou) | null (nao existe, indice confiavel) | undefined (indice indisponivel)
    function _findFolderInIndex(parentFolder, name) {
        if (_folderIndex === null) _buildFolderIndex();
        if (!_folderIndex) return undefined;
        var pid = (parentFolder && parentFolder.id !== undefined) ? parentFolder.id : 0;
        var bucket = _folderIndex[pid];
        if (!bucket) return null;
        var hit = bucket[_folderKey(name)];
        if (hit === undefined) hit = bucket[_folderKey(stripNumericPrefix(name))];
        if (hit === undefined) return null;
        // Confirma que a pasta continua viva e no pai esperado (pode ter sido removida)
        try {
            var actualParent = hit.parentFolder;
            if (!actualParent) return null;
            if (pid === 0) {
                if (actualParent === app.project.rootFolder ||
                    (app.project.rootFolder && String(actualParent.id) === String(app.project.rootFolder.id))) {
                    return hit;
                }
            } else if (String(actualParent.id) === String(pid)) {
                return hit;
            }
        } catch (eHit) {
            return null;
        }
        return null;
    }

    var projectSaved = false;
    if (saveProjectBefore) {
        try {
            if (app.project.file) {
                app.project.save(app.project.file);
                projectSaved = true;
            } else {
                app.project.save();
                if (app.project.file) {
                    projectSaved = true;
                }
            }
        } catch (saveErr) { }
    }

    app.beginUndoGroup("Organizar Projeto (" + (preset.presetName || "Preset") + ")");
    try {
        // 1. Indexar nós da árvore do preset
        var nodeRecords = [];
        var nodeRecordById = {};
        var nodeFolderMap = {};
        var boundFolderIds = {};
        var seqCounter = 0;

        function indexTree(nodesArr, parentId, depth) {
            if (!nodesArr || !nodesArr.length) return;
            for (var i = 0; i < nodesArr.length; i++) {
                var n = nodesArr[i];
                if (!n) continue;
                var nId = n.id ? String(n.id) : ("node_auto_" + (++seqCounter));
                n.id = nId;
                var rec = {
                    id: nId,
                    node: n,
                    parentId: parentId,
                    depth: depth,
                    order: seqCounter++
                };
                nodeRecords.push(rec);
                nodeRecordById[nId] = rec;

                if (n.children && n.children.length > 0) {
                    indexTree(n.children, nId, depth + 1);
                }
            }
        }

        indexTree(preset.tree, null, 0);

        // --- Motor de regras compartilhado (host/_rules.jsx) ---
        var _rules = $.global.OrgRules.createMatcher(nodeRecords);
        var findMatchingNode = _rules.findMatchingNode;
        var matchesNameFilter = $.global.OrgRules.matchesNameFilter;
        var nodeSupportsType = $.global.OrgRules.nodeSupportsType;
        function isExtInNodesOfType(extLower, targetType) {
            return $.global.OrgRules.isExtInNodesOfType(nodeRecords, extLower, targetType);
        }

        // Cria ou reaproveita a pasta de um nó apenas sob demanda (Regra A3: nunca criar pastas vazias da árvore)
        function ensureNodeFolder(nodeId) {
            if (!nodeId || !nodeRecordById[nodeId]) return app.project.rootFolder;
            if (nodeFolderMap[nodeId]) return nodeFolderMap[nodeId];

            var rec = nodeRecordById[nodeId];
            var parentFolder = rec.parentId ? ensureNodeFolder(rec.parentId) : app.project.rootFolder;
            var cleanTargetName = stripNumericPrefix(rec.node.name);
            var cleanTargetLower = cleanTargetName.toLowerCase();

            var found = _findFolderInIndex(parentFolder, rec.node.name);
            if (found && boundFolderIds[found.id]) {
                found = undefined; // pasta ja vinculada a outro no: precisa procurar outra
            }
            if (found === undefined) {
                found = null;
                for (var i = 1; i <= app.project.numItems; i++) {
                    _scanCount++;
                    var item = app.project.item(i);
                    if (
                        item instanceof FolderItem &&
                        isSameFolder(item.parentFolder, parentFolder) &&
                        !boundFolderIds[item.id]
                    ) {
                        var itemCleanLower = stripNumericPrefix(item.name).toLowerCase();
                        if (item.name === rec.node.name || itemCleanLower === cleanTargetLower) {
                            found = item;
                            break;
                        }
                    }
                }
            }

            if (!found) {
                found = app.project.items.addFolder(cleanTargetName);
                found.parentFolder = parentFolder;
                _indexOneFolder(found);
            }

            applyLabelSafe(found, rec.node.label);
            nodeFolderMap[nodeId] = found;
            boundFolderIds[found.id] = true;
            return found;
        }

        // Helpers de avaliação de regras dos nós

        // Retorna { rec: nodeRecord, matchedViaCatchOthers: boolean } ou null
        // Coleta todos os arrays de extensões configurados na árvore para auxiliar a classificação
        function classifyFootageItem(item, extLower) {
            if (item.mainSource instanceof SolidSource) {
                return "Solids";
            }

            // 1. Áudio puro ou extensão de áudio
            if (item.hasAudio && !item.hasVideo) {
                return "Audios";
            }
            if (
                isExtInNodesOfType(extLower, "Audios") ||
                /^(wav|bwf|mp3|mpa|mpe|aac|m4a|aif|aiff|flac|ogg|wma|mka)$/i.test(extLower)
            ) {
                return "Audios";
            }

            // 2. Arquivos de Dados / 3D / Projetos
            if (
                isExtInNodesOfType(extLower, "DataFiles") ||
                /^(json|mgjson|csv|tsv|jsx|bvh|obj|gltf|glb|fbx|c4d|prproj|aep|aepx|aet)$/i.test(extLower)
            ) {
                if (!item.hasVideo || /^(json|mgjson|csv|tsv|jsx|bvh|obj|gltf|glb|fbx|c4d|prproj|aep|aepx|aet)$/i.test(extLower)) {
                    return "DataFiles";
                }
            }

            // 3. Vídeos nativos
            var isNativeVideoExt = /^(mp4|m4v|mov|qt|prores|avi|mkv|webm|mxf|mpg|mpeg|m1v|mpv|m2p|m2v|m2t|m2ts|mts|ts|vob|3gp|3g2|amc|dv|wmv|asf|flv|f4v|r3d|ari|braw|crm|hevc|h264|264|ogv|cine|yuv|dnxhd|dnxhr)$/i.test(extLower);
            if (isNativeVideoExt) {
                return "Videos";
            }

            // 4. Sequência de imagens vs Imagem Estática
            if (item.hasVideo) {
                if (item.mainSource && typeof item.mainSource.isStill === "boolean") {
                    if (item.mainSource.isStill === false) {
                        return "ImageSequences";
                    } else {
                        return "StillImages";
                    }
                } else if (item.duration > 0 && item.frameRate > 0) {
                    if (extLower !== "psd" && extLower !== "psb" && extLower !== "ai") {
                        return "ImageSequences";
                    }
                }
            }

            if (
                isExtInNodesOfType(extLower, "StillImages") ||
                /^(psd|psb|pdd|ai|eps|ps|pdf|png|jpg|jpeg|jpe|tif|tiff|bmp|rle|dib|gif|exr|sxr|mxr|tga|vda|icb|vst|hdr|rgbe|xyze|heif|heic|svg|iff|tdi|sgi|rgb|bw|pic|rla|rpf|ei|raw|crw|cr2|cr3|nef|nrw|arw|srf|sr2|raf|orf|rw2|pef|x3f|erf|kdc|dcr|mos|mrw|iiq|3fr|fff|srw|gpr|dxo|arq|rwl|mfw|mef)$/i.test(extLower)
            ) {
                return "StillImages";
            }

            return "Videos";
        }

        var processedIds = {};
        var protectedFolders = [];
        var movedComps = 0;
        var movedFootages = 0;
        var cleanedFolders = 0;
        var reducedCount = 0;

        function isInsideProtectedFolder(item) {
            for (var i = 0; i < protectedFolders.length; i++) {
                if (isSameFolder(item, protectedFolders[i]) || isInsideFolder(item, protectedFolders[i])) {
                    return true;
                }
            }
            return false;
        }

        function registerFolderContents(targetFolder) {
            if (!targetFolder) return;
            processedIds[targetFolder.id] = true;
            try {
                var count = targetFolder.numItems || (targetFolder.items ? targetFolder.items.length : 0);
                for (var idx = 1; idx <= count; idx++) {
                    var subItem = null;
                    if (targetFolder.items && targetFolder.items[idx]) {
                        subItem = targetFolder.items[idx];
                    } else if (typeof targetFolder.item === "function") {
                        subItem = targetFolder.item(idx);
                    }
                    if (subItem) {
                        processedIds[subItem.id] = true;
                        if (subItem instanceof FolderItem) {
                            registerFolderContents(subItem);
                        }
                    }
                }
            } catch (errReg) { }
        }

        // Proteger a pasta Nunca Usadas
        for (var u = 1; u <= app.project.numItems; u++) {
            var ufItem = app.project.item(u);
            if (
                ufItem instanceof FolderItem &&
                isSameFolder(ufItem.parentFolder, app.project.rootFolder) &&
                ufItem.name === unusedFolderName
            ) {
                protectedFolders.push(ufItem);
                registerFolderContents(ufItem);
                break;
            }
        }

        // Identificar Composições Principais (Output)
        var isMediaOnly = (mainCompId === "media_only" || mainCompId === null || mainCompId === undefined || mainCompId === "");
        var targetMainComps = [];
        var isSelectionMode = (mainCompId === "selection");

        if (isSelectionMode) {
            var sel = app.project.selection;
            if (sel && sel.length > 0) {
                for (var s = 0; s < sel.length; s++) {
                    if (sel[s] instanceof CompItem) {
                        targetMainComps.push(sel[s]);
                    }
                }
            }
            if (targetMainComps.length === 0) {
                throw new Error("Nenhuma composição selecionada.");
            }
        } else if (!isMediaOnly) {
            var targetId = Number(mainCompId);
            for (var m = 1; m <= app.project.numItems; m++) {
                var candidate = app.project.item(m);
                if (candidate instanceof CompItem && candidate.id === targetId) {
                    targetMainComps.push(candidate);
                    break;
                }
            }
        }

        // Capturar snapshot da estrutura original antes de organizar
        if (typeof $.global.aeft_ensurePreOrganizeSnapshot === "function") {
            $.global.aeft_ensurePreOrganizeSnapshot();
        }

        // Reduce Project se ativo
        if (reduceProject && targetMainComps.length > 0) {
            try {
                reducedCount = app.project.reduceProject(targetMainComps);
            } catch (reduceErr) { }
            // Reduce pode remover itens: descarta o indice de pastas
            _folderIndex = null;
        }

        // Encontrar nó que trata pacotes PSD/AI (handlePsdBundles)
        var psdBundleNodeRec = null;
        for (var pIdx = 0; pIdx < nodeRecords.length; pIdx++) {
            var rCheck = nodeRecords[pIdx].node.rules;
            if (rCheck && rCheck.handlePsdBundles) {
                psdBundleNodeRec = nodeRecords[pIdx];
                break;
            }
        }
        if (!psdBundleNodeRec) {
            var fallbackPsdMatch = findMatchingNode("StillImages", "psd", "layer.psd");
            if (fallbackPsdMatch) {
                psdBundleNodeRec = fallbackPsdMatch.rec;
            }
        }

        // Verificar se uma pasta é um nó raiz/estrutural da árvore para não confundir com bundle PSD
        function isTreeRootOrCategoryFolder(folder) {
            if (!folder || !(folder instanceof FolderItem)) return false;
            var cleanF = stripNumericPrefix(folder.name).toLowerCase();
            if (folder.name === unusedFolderName) return true;
            for (var i = 0; i < nodeRecords.length; i++) {
                var cleanNode = stripNumericPrefix(nodeRecords[i].node.name).toLowerCase();
                if (cleanF === cleanNode) return true;
            }
            return false;
        }

        // 1. Tratar pastas nativas de PSD/AI (quando handlePsdBundles está ativo ou existe nó de imagem)
        if (psdBundleNodeRec && psdBundleNodeRec.node.rules && psdBundleNodeRec.node.rules.handlePsdBundles !== false) {
            var allFolders = [];
            for (var i = 1; i <= app.project.numItems; i++) {
                var it = app.project.item(i);
                if (it instanceof FolderItem) {
                    allFolders.push(it);
                }
            }

            for (var f = 0; f < allFolders.length; f++) {
                var folder = allFolders[f];
                if (
                    isTreeRootOrCategoryFolder(folder) ||
                    /^(psd|ai|psb)$/i.test(folder.name) ||
                    /^(\d+[_-\s]*)?pre[-_]?comps?$/i.test(folder.name)
                ) {
                    continue;
                }

                var hasLayeredVectorOrPsd = false;
                var hasNonPsdAiItems = false;
                var detectedType = null;
                var internalComps = [];

                for (var c = 1; c <= folder.numItems; c++) {
                    var child = folder.item(c);
                    if (child instanceof CompItem) {
                        internalComps.push(child);
                    } else if (child instanceof FolderItem) {
                        if (!/^(\d+[_-\s]*)?pre[-_]?comps?$/i.test(child.name)) {
                            hasNonPsdAiItems = true;
                        }
                    } else if (
                        child instanceof FootageItem &&
                        child.mainSource instanceof FileSource &&
                        child.mainSource.file
                    ) {
                        var ext = getFileExtension(child.mainSource.file);
                        if (ext === "psd" || ext === "psb") {
                            hasLayeredVectorOrPsd = true;
                            detectedType = ext.toUpperCase();
                        } else if (ext === "ai") {
                            hasLayeredVectorOrPsd = true;
                            if (!detectedType) {
                                detectedType = "AI";
                            }
                        } else {
                            hasNonPsdAiItems = true;
                        }
                    } else {
                        hasNonPsdAiItems = true;
                    }
                }

                if (hasLayeredVectorOrPsd && !hasNonPsdAiItems) {
                    if (internalComps.length > 0) {
                        var localPreCompFolder = null;
                        for (var c2 = 1; c2 <= folder.numItems; c2++) {
                            var ch = folder.item(c2);
                            if (ch instanceof FolderItem && /^(\d+[_-\s]*)?pre[-_]?comps?$/i.test(ch.name)) {
                                localPreCompFolder = ch;
                                break;
                            }
                        }
                        if (!localPreCompFolder) {
                            localPreCompFolder = app.project.items.addFolder("PreComps");
                            localPreCompFolder.parentFolder = folder;
                        }

                        for (var ic = 0; ic < internalComps.length; ic++) {
                            if (!isSameFolder(internalComps[ic].parentFolder, localPreCompFolder)) {
                                internalComps[ic].parentFolder = localPreCompFolder;
                                movedComps++;
                            }
                            processedIds[internalComps[ic].id] = true;
                        }
                    }

                    var targetPsdNodeFolder = ensureNodeFolder(psdBundleNodeRec.id);
                    var destContainer = targetPsdNodeFolder;
                    var psdSubPath = [];
                    if (psdBundleNodeRec.node.rules && psdBundleNodeRec.node.rules.groupSubfoldersByExt) {
                        psdSubPath.push(detectedType);
                    }
                    var shouldGroupPsdBySource = (psdBundleNodeRec.node.rules && psdBundleNodeRec.node.rules.groupBySourceFolder !== undefined)
                        ? Boolean(psdBundleNodeRec.node.rules.groupBySourceFolder)
                        : groupBySourceFolderGlobal;
                    if (shouldGroupPsdBySource) {
                        var bundleSourceFolder = "";
                        // A fonte é procurada entre os itens já contidos na pasta do bundle.
                        // Antes isso varria o projeto inteiro (O(pastas x itens)); agora
                        // percorre apenas os filhos diretos da pasta.
                        var bundleChildCount = 0;
                        try {
                            bundleChildCount = folder.numItems;
                        } catch (eBundleCount) {
                            bundleChildCount = 0;
                        }
                        for (var fch = 1; fch <= bundleChildCount; fch++) {
                            _scanCount++;
                            var chItem = folder.item(fch);
                            if (!chItem) continue;
                            var chFile = (chItem.mainSource && chItem.mainSource instanceof FileSource && chItem.mainSource.file) ? chItem.mainSource.file : chItem.file;
                            if (chFile && chFile.fsName) {
                                bundleSourceFolder = getParentFolderNameFromPath(chFile.fsName);
                                if (bundleSourceFolder) break;
                            }
                        }
                        if (bundleSourceFolder) {
                            psdSubPath.push(bundleSourceFolder);
                        }
                    }
                    if (psdSubPath.length > 0) {
                        destContainer = getOrCreateSubFolder(targetPsdNodeFolder, psdSubPath, psdBundleNodeRec.node.label);
                    }

                    if (!isSameFolder(folder, destContainer) && !isSameFolder(folder.parentFolder, destContainer)) {
                        folder.parentFolder = destContainer;
                        movedFootages++;
                    }

                    protectedFolders.push(folder);
                    registerFolderContents(folder);
                }
            }
        }

        // 2. Processar Composições Principais (MainComp) e suas Pré-Composições recursivas
        if (targetMainComps.length > 0) {
            var isOutputComp = {};
            for (var tc = 0; tc < targetMainComps.length; tc++) {
                isOutputComp[targetMainComps[tc].id] = true;
            }

            function processPreCompsForMain(currentComp, mainCompName, visitedMap) {
                for (var l = 1; l <= currentComp.numLayers; l++) {
                    var layer = currentComp.layer(l);
                    var src = layer.source;
                    if (src && src instanceof CompItem) {
                        if (isOutputComp[src.id]) {
                            continue;
                        }
                        if (!visitedMap[src.id]) {
                            visitedMap[src.id] = true;
                            if (!isInsideProtectedFolder(src) && !processedIds[src.id]) {
                                var preCandidates = [src.name];
                                if (src.parentFolder && src.parentFolder !== app.project.rootFolder && src.parentFolder.name) {
                                    preCandidates.push(src.parentFolder.name);
                                }
                                var preMatch = findMatchingNode("PreComps", "", preCandidates);
                                if (preMatch && preMatch.rec) {
                                    var preNodeFolder = ensureNodeFolder(preMatch.rec.id);
                                    var destPreFolder = preNodeFolder;
                                    if (preMatch.rec.node.rules && preMatch.rec.node.rules.groupByMainComp) {
                                        destPreFolder = getOrCreateSubFolder(preNodeFolder, [mainCompName], preMatch.rec.node.label);
                                    }
                                    if (!isSameFolder(src.parentFolder, destPreFolder)) {
                                        src.parentFolder = destPreFolder;
                                        movedComps++;
                                    }
                                    processedIds[src.id] = true;
                                }
                            }
                            processPreCompsForMain(src, mainCompName, visitedMap);
                        }
                    }
                }
            }

            for (var mc = 0; mc < targetMainComps.length; mc++) {
                var mainComp = targetMainComps[mc];
                var mainCandidates = [mainComp.name];
                if (mainComp.parentFolder && mainComp.parentFolder !== app.project.rootFolder && mainComp.parentFolder.name) {
                    mainCandidates.push(mainComp.parentFolder.name);
                }
                var mainMatch = findMatchingNode("MainComp", "", mainCandidates);
                if (mainMatch && mainMatch.rec) {
                    var outFolder = ensureNodeFolder(mainMatch.rec.id);
                    if (!isSameFolder(mainComp.parentFolder, outFolder)) {
                        mainComp.parentFolder = outFolder;
                        movedComps++;
                    }
                }
                processedIds[mainComp.id] = true;

                var visitedComps = {};
                visitedComps[mainComp.id] = true;
                processPreCompsForMain(mainComp, mainComp.name, visitedComps);
            }
        }

        // 3. Processar os demais itens do projeto
        var remainingItems = [];
        for (var k = 1; k <= app.project.numItems; k++) {
            var projItem = app.project.item(k);
            if (!(projItem instanceof FolderItem)) {
                remainingItems.push(projItem);
            }
        }

        for (var r = 0; r < remainingItems.length; r++) {
            var item = remainingItems[r];
            if (processedIds[item.id] || isInsideProtectedFolder(item)) {
                continue;
            }

            if (item instanceof CompItem) {
                if (!isMediaOnly) {
                    var looseCandidates = [item.name];
                    if (item.parentFolder && item.parentFolder !== app.project.rootFolder && item.parentFolder.name) {
                        looseCandidates.push(item.parentFolder.name);
                    }
                    var loosePreMatch = findMatchingNode("PreComps", "", looseCandidates);
                    if (loosePreMatch && loosePreMatch.rec) {
                        var looseNodeFolder = ensureNodeFolder(loosePreMatch.rec.id);
                        var targetLooseFolder = looseNodeFolder;
                        if (loosePreMatch.rec.node.rules && loosePreMatch.rec.node.rules.groupByMainComp) {
                            targetLooseFolder = getOrCreateSubFolder(looseNodeFolder, ["Geral"], loosePreMatch.rec.node.label);
                        }
                        if (!isSameFolder(item.parentFolder, targetLooseFolder)) {
                            item.parentFolder = targetLooseFolder;
                            movedComps++;
                        }
                        processedIds[item.id] = true;
                    }
                }
            } else if (item instanceof FootageItem) {
                if (item.mainSource instanceof SolidSource) {
                    var solidCandidates = [item.name];
                    if (item.parentFolder && item.parentFolder !== app.project.rootFolder && item.parentFolder.name) {
                        solidCandidates.push(item.parentFolder.name);
                    }
                    var solidMatch = findMatchingNode("Solids", "", solidCandidates);
                    if (solidMatch && solidMatch.rec) {
                        var solidFolder = ensureNodeFolder(solidMatch.rec.id);
                        if (!isSameFolder(item.parentFolder, solidFolder)) {
                            item.parentFolder = solidFolder;
                            movedFootages++;
                        }
                        processedIds[item.id] = true;
                    }
                } else {
                    var fileObj = null;
                    if (item.mainSource && item.mainSource instanceof FileSource && item.mainSource.file) {
                        fileObj = item.mainSource.file;
                    } else if (item.file) {
                        fileObj = item.file;
                    }

                    var fileExt = fileObj ? getFileExtension(fileObj) : "";
                    if (!fileExt && item.name) {
                        var lastDot = item.name.lastIndexOf(".");
                        if (lastDot !== -1 && lastDot < item.name.length - 1) {
                            fileExt = item.name.substring(lastDot + 1).toLowerCase();
                        }
                    }

                    var diskFileName = "";
                    var diskFolderName = "";
                    if (fileObj) {
                        if (fileObj.fsName) {
                            diskFileName = getFileNameFromPath(fileObj.fsName);
                            diskFolderName = getParentFolderNameFromPath(fileObj.fsName);
                        } else if (fileObj.name) {
                            diskFileName = fileObj.name;
                        }
                        if (!diskFolderName && fileObj.parent && fileObj.parent.name) {
                            diskFolderName = fileObj.parent.name;
                        }
                    }
                    var origFolderName = (item.parentFolder && item.parentFolder !== app.project.rootFolder && item.parentFolder.name)
                        ? item.parentFolder.name
                        : "";

                    var nameCandidates = [item.name];
                    if (diskFileName && diskFileName !== item.name) {
                        nameCandidates.push(diskFileName);
                    }
                    if (diskFolderName) {
                        nameCandidates.push(diskFolderName);
                    }
                    if (origFolderName && origFolderName !== diskFolderName && origFolderName !== item.name) {
                        nameCandidates.push(origFolderName);
                    }

                    var fType = classifyFootageItem(item, fileExt);
                    var mediaMatch = findMatchingNode(fType, fileExt, nameCandidates);
                    if (mediaMatch && mediaMatch.rec) {
                        var targetNode = mediaMatch.rec.node;
                        var nodeFolder = ensureNodeFolder(mediaMatch.rec.id);
                        var finalMediaFolder = nodeFolder;

                        var shouldGroupBySource = (targetNode.rules && targetNode.rules.groupBySourceFolder !== undefined)
                            ? Boolean(targetNode.rules.groupBySourceFolder)
                            : groupBySourceFolderGlobal;

                        var sourceFolderName = shouldGroupBySource ? diskFolderName : "";

                        var subPath = [];
                        if (targetNode.rules && targetNode.rules.groupSubfoldersByExt) {
                            var subFolderName = (mediaMatch.matchedViaCatchOthers || !fileExt)
                                ? "OTHERS"
                                : fileExt.toUpperCase();
                            subPath.push(subFolderName);

                            if (
                                !shouldGroupBySource &&
                                !mediaMatch.matchedViaCatchOthers &&
                                (fileExt === "psd" || fileExt === "psb" || fileExt === "ai")
                            ) {
                                var slashIndex = item.name.lastIndexOf("/");
                                if (slashIndex !== -1) {
                                    var projectFileName = item.name.substring(slashIndex + 1);
                                    if (projectFileName) {
                                        subPath.push(projectFileName);
                                    }
                                }
                            }
                        }

                        if (sourceFolderName) {
                            subPath.push(sourceFolderName);
                        }

                        if (subPath.length > 0) {
                            finalMediaFolder = getOrCreateSubFolder(nodeFolder, subPath, targetNode.label);
                        }

                        if (!isSameFolder(item.parentFolder, finalMediaFolder)) {
                            item.parentFolder = finalMediaFolder;
                            movedFootages++;
                        }
                        processedIds[item.id] = true;
                    }
                }
            }
        }

        // Helpers de limpeza/numeração (declarados antes do uso)
        function isAliveFolderWithContent(candidate) {
            if (!candidate) return false;
            try {
                return candidate.numItems > 0;
            } catch (eInvalidFolder) {
                // FolderItem removida do projeto: acessar qualquer propriedade lança
                // "Object is invalid" no AE.
                return false;
            }
        }

        function getItemDepth(folderItem) {
            var depth = 0;
            var cursor = folderItem ? folderItem.parentFolder : null;
            while (cursor && cursor !== app.project.rootFolder && depth < 100) {
                depth++;
                cursor = cursor.parentFolder;
            }
            return depth;
        }

        // 4. Limpar pastas vazias (se ativo)
        // Antes: varredura completa do projeto a cada pasta removida (O(N^2)).
        // Agora: coleta candidatas uma unica vez, ordena por profundidade
        // decrescente e remove em cascata (folha -> raiz).
        if (deleteEmptyFolders) {
            var cleanedBefore = cleanedFolders;
            var emptyCandidates = [];
            for (var ci = 1; ci <= app.project.numItems; ci++) {
                _scanCount++;
                var candidateItem = app.project.item(ci);
                if (candidateItem instanceof FolderItem) {
                    emptyCandidates.push({
                        folder: candidateItem,
                        depth: getItemDepth(candidateItem)
                    });
                }
            }
            emptyCandidates.sort(function (a, b) {
                return b.depth - a.depth;
            });
            for (var cf = 0; cf < emptyCandidates.length; cf++) {
                var candidateFolder = emptyCandidates[cf].folder;
                try {
                    // rootFolder nao pode ser removido e nao tem pai
                    if (!candidateFolder.parentFolder) continue;
                    if (candidateFolder === app.project.rootFolder) continue;
                    if (isInsideProtectedFolder(candidateFolder)) continue;
                    if (candidateFolder.numItems !== 0) continue;
                    candidateFolder.remove();
                    cleanedFolders++;
                } catch (eCleanFolder) {
                    // Pasta já removida em cascata (filha de outra removida)
                }
            }
            // Pastas removidas invalidam o indice (sera reconstruido na proxima busca)
            // E o mapa de pastas por nó precisa ser limpo: manter referencia a uma
            // FolderItem removida fazia applyTreeNumberingAndLabels lançar
            // "Object is invalid" DEPOIS do projeto já ter sido modificado — o que
            // abortava a operação, marcava success=false e pulava
            // aeft_markPostOrganizeState (rollback ficava inconsistente).
            if (cleanedFolders !== cleanedBefore) {
                _folderIndex = null;
                nodeFolderMap = {};
                boundFolderIds = {};
            }
        }

        // 5. Aplicar numeração sequencial (01_, 02_...) e Color Labels apenas nas pastas da árvore com itens (Regra A2 e A3)
        function applyTreeNumberingAndLabels(nodesList, parentFolder) {
            if (!nodesList || !nodesList.length || !parentFolder) return;

            var activeEntries = [];
            for (var i = 0; i < nodesList.length; i++) {
                var n = nodesList[i];
                if (!n) continue;

                var folder = nodeFolderMap[n.id] || null;
                if (!folder) {
                    // Verificar se a pasta já existia no projeto com itens (ex: modo Apenas Mídias mantendo Output)
                    folder = _findFolderInIndex(parentFolder, n.name);
                }
                if (folder === undefined) {
                    folder = null;
                    var cleanN = stripNumericPrefix(n.name).toLowerCase();
                    for (var j = 1; j <= app.project.numItems; j++) {
                        _scanCount++;
                        var sub = app.project.item(j);
                        if (
                            sub instanceof FolderItem &&
                            isSameFolder(sub.parentFolder, parentFolder) &&
                            stripNumericPrefix(sub.name).toLowerCase() === cleanN
                        ) {
                            folder = sub;
                            break;
                        }
                    }
                }

                if (folder && isAliveFolderWithContent(folder)) {
                    activeEntries.push({
                        node: n,
                        folder: folder
                    });
                }
            }

            // Numeracao sequencial continua (01_, 02_...) apenas nas pastas ativas que receberam itens
            var currentSeq = 0;
            for (var a = 0; a < activeEntries.length; a++) {
                var entry = activeEntries[a];
                var baseName = stripNumericPrefix(entry.node.name);
                var finalName = baseName;

                // Só aplica numeração sequencial se o toggle mestre estiver ativo E a pasta tiver useNumbering !== false
                var isNodeNumbered = (entry.node.useNumbering !== false);
                if (usePrefixNumbering && isNodeNumbered) {
                    currentSeq++;
                    var prefix = (currentSeq < 10 ? "0" + currentSeq : String(currentSeq)) + "_";
                    finalName = prefix + baseName;
                }

                if (entry.folder.name !== finalName) {
                    entry.folder.name = finalName;
                }
                applyLabelSafe(entry.folder, entry.node.label);

                if (entry.node.children && entry.node.children.length > 0) {
                    applyTreeNumberingAndLabels(entry.node.children, entry.folder);
                }
            }
        }

        applyTreeNumberingAndLabels(preset.tree, app.project.rootFolder);

        if (typeof $.global.aeft_markPostOrganizeState === "function") {
            $.global.aeft_markPostOrganizeState();
        }

        return (
            '{"success": true, "movedComps": ' +
            movedComps +
            ', "movedFootages": ' +
            movedFootages +
            ', "cleanedFolders": ' +
            cleanedFolders +
            ', "reducedCount": ' +
            reducedCount +
            ', "projectSaved": ' +
            (projectSaved ? "true" : "false") +
            ', "elapsedMs": ' +
            (new Date().getTime() - _profT0) +
            ', "scanCount": ' +
            _scanCount +
            "}"
        );
    } catch (err) {
        return '{"success": false, "error": "' + escapeJsonString(err.toString()) + '"}';
    } finally {
        app.endUndoGroup();
    }
};

$.global.aeft_createPresetFolderStructure = function (presetJsonString) {
    var escapeJsonString = $.global.OrgLib.escapeJsonString;

    var parseJson = $.global.OrgLib.parseJson;

    var stripNumericPrefix = $.global.OrgLib.stripNumericPrefix;

    var isSameFolder = $.global.OrgLib.isSameItem;

    function applyLabelSafe(folderItem, labelIndex) {
        if (!folderItem) return;
        var num = parseInt(labelIndex, 10);
        if (!isNaN(num) && num >= 0 && num <= 16) {
            try {
                if (folderItem.label !== num) {
                    folderItem.label = num;
                }
            } catch (e) { }
        }
    }

    if (!app.project) {
        return '{"success": false, "error": "Nenhum projeto aberto no After Effects."}';
    }

    var preset = parseJson(presetJsonString);
    if (!preset || !preset.tree || !preset.tree.length) {
        return '{"success": false, "error": "O preset selecionado não possui pastas configuradas."}';
    }

    var settings = preset.settings || {};
    var usePrefixNumbering = (settings.usePrefixNumbering !== false);

    app.beginUndoGroup("Criar Estrutura de Pastas (" + (preset.presetName || "Preset") + ")");
    try {
        var createdCount = 0;
        var existingCount = 0;
        var boundFolderIds = {};

        function buildNodesInFolder(nodesList, parentFolder) {
            if (!nodesList || !nodesList.length || !parentFolder) return;

            var currentSeq = 0;
            for (var i = 0; i < nodesList.length; i++) {
                var node = nodesList[i];
                if (!node) continue;

                var baseName = stripNumericPrefix(node.name);
                if (!baseName) {
                    baseName = "Nova Pasta";
                }
                var baseLower = baseName.toLowerCase();

                var isNodeNumbered = (node.useNumbering !== false);
                var finalName = baseName;
                if (usePrefixNumbering && isNodeNumbered) {
                    currentSeq++;
                    var prefix = (currentSeq < 10 ? "0" + currentSeq : String(currentSeq)) + "_";
                    finalName = prefix + baseName;
                }

                var found = null;
                for (var j = 1; j <= app.project.numItems; j++) {
                    var item = app.project.item(j);
                    if (
                        item instanceof FolderItem &&
                        isSameFolder(item.parentFolder, parentFolder) &&
                        !boundFolderIds[item.id]
                    ) {
                        var itemCleanLower = stripNumericPrefix(item.name).toLowerCase();
                        if (item.name === finalName || item.name === node.name || itemCleanLower === baseLower) {
                            found = item;
                            break;
                        }
                    }
                }

                if (found) {
                    existingCount++;
                    if (found.name !== finalName) {
                        found.name = finalName;
                    }
                } else {
                    found = app.project.items.addFolder(finalName);
                    found.parentFolder = parentFolder;
                    createdCount++;
                }

                boundFolderIds[found.id] = true;
                applyLabelSafe(found, node.label);

                if (node.children && node.children.length > 0) {
                    buildNodesInFolder(node.children, found);
                }
            }
        }

        if (typeof $.global.aeft_ensurePreOrganizeSnapshot === "function") {
            $.global.aeft_ensurePreOrganizeSnapshot();
        }

        buildNodesInFolder(preset.tree, app.project.rootFolder);

        if (typeof $.global.aeft_markPostOrganizeState === "function") {
            $.global.aeft_markPostOrganizeState();
        }

        return (
            '{"success": true, "createdCount": ' +
            createdCount +
            ', "existingCount": ' +
            existingCount +
            ', "totalCount": ' +
            (createdCount + existingCount) +
            "}"
        );
    } catch (err) {
        return '{"success": false, "error": "' + escapeJsonString(err.toString()) + '"}';
    } finally {
        app.endUndoGroup();
    }
};

// =========================================================================
// 5. Sistema de Snapshot e Rollback para After Effects (AEFT)
// =========================================================================
$.global._aeftRollbackSnapshot = $.global._aeftRollbackSnapshot || null;

$.global.aeft_captureRawSnapshot = function () {
    if (!app.project) return null;
    var folders = [];
    var items = [];

    function getFolderDepth(folder) {
        var d = 0;
        var cur = folder ? folder.parentFolder : null;
        while (cur && cur !== app.project.rootFolder && d < 100) {
            d++;
            cur = cur.parentFolder;
        }
        return d;
    }

    for (var i = 1; i <= app.project.numItems; i++) {
        var it = app.project.item(i);
        if (!it) continue;
        var parentId = (it.parentFolder && it.parentFolder !== app.project.rootFolder)
            ? it.parentFolder.id
            : 0;

        if (it instanceof FolderItem) {
            folders.push({
                id: it.id,
                name: String(it.name || ""),
                parentId: parentId,
                label: (typeof it.label === "number") ? it.label : 0,
                comment: String(it.comment || ""),
                depth: getFolderDepth(it)
            });
        } else {
            items.push({
                id: it.id,
                name: String(it.name || ""),
                parentId: parentId,
                label: (typeof it.label === "number") ? it.label : 0
            });
        }
    }

    folders.sort(function (a, b) {
        return a.depth - b.depth;
    });

    return {
        host: "AEFT",
        projectFile: (app.project.file && app.project.file.fsName) ? String(app.project.file.fsName) : "",
        folders: folders,
        items: items,
        createdFolderIds: {},
        movedItemParents: {}
    };
};

$.global.aeft_ensurePreOrganizeSnapshot = function () {
    if (!app.project) return;
    var existing = $.global._aeftRollbackSnapshot;
    if (existing && existing.folders && existing.items) {
        var curFile = (app.project.file && app.project.file.fsName) ? String(app.project.file.fsName) : "";
        var sameProjectFile = (!existing.projectFile || !curFile || existing.projectFile === curFile);

        if (sameProjectFile) {
            // Verificar se o projeto ainda se encontra no estado organizado anterior
            var stillOrganized = false;
            var origFolderMap = {};
            for (var f = 0; f < existing.folders.length; f++) {
                origFolderMap[existing.folders[f].id] = existing.folders[f];
            }
            var origItemMap = {};
            for (var im = 0; im < existing.items.length; im++) {
                origItemMap[existing.items[im].id] = existing.items[im];
            }

            for (var i = 1; i <= app.project.numItems; i++) {
                var it = app.project.item(i);
                if (!it) continue;
                var curParentId = (it.parentFolder && it.parentFolder !== app.project.rootFolder) ? it.parentFolder.id : 0;
                if (it instanceof FolderItem) {
                    if (existing.createdFolderIds && existing.createdFolderIds[it.id] && !origFolderMap[it.id]) {
                        stillOrganized = true;
                        break;
                    }
                } else {
                    if (
                        existing.movedItemParents &&
                        existing.movedItemParents[it.id] !== undefined &&
                        origItemMap[it.id] &&
                        curParentId === existing.movedItemParents[it.id] &&
                        curParentId !== origItemMap[it.id].parentId
                    ) {
                        stillOrganized = true;
                        break;
                    }
                }
            }

            if (stillOrganized) {
                // Preservar o snapshot pré-organização original e apenas registrar novos itens importados depois
                for (var k = 1; k <= app.project.numItems; k++) {
                    var projIt = app.project.item(k);
                    if (projIt && !(projIt instanceof FolderItem) && !origItemMap[projIt.id]) {
                        var pId = (projIt.parentFolder && projIt.parentFolder !== app.project.rootFolder) ? projIt.parentFolder.id : 0;
                        var safeParentId = origFolderMap[pId] ? pId : 0;
                        existing.items.push({
                            id: projIt.id,
                            name: String(projIt.name || ""),
                            parentId: safeParentId,
                            label: (typeof projIt.label === "number") ? projIt.label : 0
                        });
                    }
                }
                return;
            }
        }
    }

    $.global._aeftRollbackSnapshot = $.global.aeft_captureRawSnapshot();
};

$.global.aeft_markPostOrganizeState = function () {
    var snap = $.global._aeftRollbackSnapshot;
    if (!snap || !app.project) return;
    if (app.project.file && app.project.file.fsName) {
        snap.projectFile = String(app.project.file.fsName);
    }
    var createdFolders = {};
    var movedItems = {};
    for (var i = 1; i <= app.project.numItems; i++) {
        var it = app.project.item(i);
        if (!it) continue;
        if (it instanceof FolderItem) {
            createdFolders[it.id] = true;
        } else {
            movedItems[it.id] = (it.parentFolder && it.parentFolder !== app.project.rootFolder) ? it.parentFolder.id : 0;
        }
    }
    snap.createdFolderIds = createdFolders;
    snap.movedItemParents = movedItems;
};

$.global.aeft_getRollbackSnapshotJson = function () {
    function escapeStr(str) {
        return String(str === undefined || str === null ? "" : str)
            .replace(/\\/g, "\\\\")
            .replace(/"/g, '\\"')
            .replace(/\r/g, "\\r")
            .replace(/\n/g, "\\n");
    }

    var snap = $.global._aeftRollbackSnapshot;
    if (!snap || !snap.folders || !snap.items) return "";

    var fParts = [];
    for (var i = 0; i < snap.folders.length; i++) {
        var f = snap.folders[i];
        fParts.push(
            '{"id":' + f.id +
            ',"name":"' + escapeStr(f.name) + '"' +
            ',"parentId":' + f.parentId +
            ',"label":' + (f.label || 0) +
            ',"comment":"' + escapeStr(f.comment || "") + '"' +
            ',"depth":' + (f.depth || 0) + '}'
        );
    }

    var iParts = [];
    for (var j = 0; j < snap.items.length; j++) {
        var it = snap.items[j];
        iParts.push(
            '{"id":' + it.id +
            ',"name":"' + escapeStr(it.name) + '"' +
            ',"parentId":' + it.parentId +
            ',"label":' + (it.label || 0) + '}'
        );
    }

    return (
        '{"host":"AEFT","projectFile":"' + escapeStr(snap.projectFile || "") + '",' +
        '"folders":[' + fParts.join(",") + '],' +
        '"items":[' + iParts.join(",") + ']}'
    );
};

$.global.aeft_rollbackProject = function (saveBefore, backupSnapshotJson) {
    var escapeJsonString = $.global.OrgLib.escapeJsonString;

    var parseJson = $.global.OrgLib.parseJson;

    var isSameFolder = $.global.OrgLib.isSameItem;

    var getFileExtension = $.global.OrgLib.getFileExtension;

    if (!app.project) {
        return '{"success": false, "error": "Nenhum projeto aberto no After Effects."}';
    }

    if (app.project.numItems === 0) {
        return '{"success": false, "error": "O projeto está vazio."}';
    }

    var shouldSave = (saveBefore === true || saveBefore === "true");
    var projectSaved = false;
    if (shouldSave) {
        try {
            if (app.project.file) {
                app.project.save(app.project.file);
                projectSaved = true;
            } else {
                app.project.save();
                if (app.project.file) {
                    projectSaved = true;
                }
            }
        } catch (saveErr) { }
    }

    // Localizar snapshot ativo em memória ou validar backup vindo do painel
    var snapshot = $.global._aeftRollbackSnapshot;
    if (!snapshot && backupSnapshotJson) {
        var candidateSnap = parseJson(backupSnapshotJson);
        if (candidateSnap && candidateSnap.host === "AEFT" && candidateSnap.items && candidateSnap.folders) {
            var curPath = (app.project.file && app.project.file.fsName) ? String(app.project.file.fsName) : "";
            var pathMatches = (!candidateSnap.projectFile || !curPath || candidateSnap.projectFile === curPath);
            if (pathMatches) {
                var matchedAny = (candidateSnap.items.length === 0 && candidateSnap.folders.length === 0);
                var byId = {};
                for (var c = 1; c <= app.project.numItems; c++) {
                    var cit = app.project.item(c);
                    if (cit) byId[cit.id] = cit;
                }
                for (var sIdx = 0; sIdx < candidateSnap.items.length; sIdx++) {
                    var sIt = candidateSnap.items[sIdx];
                    if (byId[sIt.id] && byId[sIt.id].name === sIt.name) {
                        matchedAny = true;
                        break;
                    }
                }
                if (matchedAny) {
                    snapshot = candidateSnap;
                }
            }
        }
    }

    app.beginUndoGroup("Rollback de Organização");
    try {
        var restoredItemsCount = 0;
        var recreatedFoldersCount = 0;
        var removedFoldersCount = 0;

        if (snapshot && snapshot.folders && snapshot.items) {
            // MODO 1: Restaurar exatamente a estrutura original a partir do Snapshot
            var currentFoldersById = {};
            var allCurrentNonFolderItems = [];

            for (var i = 1; i <= app.project.numItems; i++) {
                var it = app.project.item(i);
                if (!it) continue;
                if (it instanceof FolderItem) {
                    currentFoldersById[it.id] = it;
                } else {
                    allCurrentNonFolderItems.push(it);
                }
            }

            var restoredFolderByOldId = {};
            var validFolderIds = {};
            var snapFolders = snapshot.folders.slice(0);
            snapFolders.sort(function (a, b) {
                return (a.depth || 0) - (b.depth || 0);
            });

            // 1. Restaurar ou recriar pastas originais (top-down)
            for (var f = 0; f < snapFolders.length; f++) {
                var sf = snapFolders[f];
                var liveFolder = currentFoldersById[sf.id] || null;
                if (liveFolder) {
                    if (liveFolder.name !== sf.name) {
                        liveFolder.name = sf.name;
                    }
                    if (sf.label !== undefined && sf.label !== null) {
                        try { liveFolder.label = sf.label; } catch (eLbl1) { }
                    }
                    restoredFolderByOldId[sf.id] = liveFolder;
                    validFolderIds[liveFolder.id] = true;
                } else {
                    var recreated = app.project.items.addFolder(sf.name);
                    if (sf.label !== undefined && sf.label !== null) {
                        try { recreated.label = sf.label; } catch (eLbl2) { }
                    }
                    if (sf.comment) {
                        try { recreated.comment = sf.comment; } catch (eCmt) { }
                    }
                    restoredFolderByOldId[sf.id] = recreated;
                    validFolderIds[recreated.id] = true;
                    recreatedFoldersCount++;
                }
            }

            // 2. Restaurar hierarquia de parentFolder das pastas originais
            for (var fp = 0; fp < snapFolders.length; fp++) {
                var sfp = snapFolders[fp];
                var folderObj = restoredFolderByOldId[sfp.id];
                if (!folderObj) continue;
                var targetParent = (sfp.parentId && restoredFolderByOldId[sfp.parentId])
                    ? restoredFolderByOldId[sfp.parentId]
                    : app.project.rootFolder;
                if (!isSameFolder(folderObj.parentFolder, targetParent)) {
                    folderObj.parentFolder = targetParent;
                }
            }

            // 3. Devolver todos os itens para suas pastas originais
            var snapItemMap = {};
            for (var si = 0; si < snapshot.items.length; si++) {
                snapItemMap[snapshot.items[si].id] = snapshot.items[si];
            }

            for (var k = 0; k < allCurrentNonFolderItems.length; k++) {
                var item = allCurrentNonFolderItems[k];
                var sItem = snapItemMap[item.id];
                var targetFolder = app.project.rootFolder;

                if (sItem) {
                    if (sItem.parentId && restoredFolderByOldId[sItem.parentId]) {
                        targetFolder = restoredFolderByOldId[sItem.parentId];
                    } else {
                        targetFolder = app.project.rootFolder;
                    }
                    if (sItem.label !== undefined && sItem.label !== null) {
                        try { item.label = sItem.label; } catch (eItLbl) { }
                    }
                } else {
                    // Item adicionado após o snapshot: se estiver em pasta criada pelo organizador, mover para a raiz
                    var curP = item.parentFolder;
                    var insideInvalid = false;
                    while (curP && !isSameFolder(curP, app.project.rootFolder)) {
                        if (!validFolderIds[curP.id]) {
                            insideInvalid = true;
                            break;
                        }
                        curP = curP.parentFolder;
                    }
                    if (!insideInvalid) continue;
                    targetFolder = app.project.rootFolder;
                }

                if (!isSameFolder(item.parentFolder, targetFolder)) {
                    item.parentFolder = targetFolder;
                    restoredItemsCount++;
                }
            }

            // 4. Remover todas as pastas que foram criadas pela organização (não pertencentes ao snapshot)
            var removedAny = true;
            while (removedAny) {
                removedAny = false;
                for (var idx = app.project.numItems; idx >= 1; idx--) {
                    var cand = app.project.item(idx);
                    if (cand instanceof FolderItem && !validFolderIds[cand.id] && cand.numItems === 0) {
                        cand.remove();
                        removedFoldersCount++;
                        removedAny = true;
                    }
                }
            }
        } else {
            // MODO 2 (Fallback quando o projeto já estava organizado antes de abrir o painel):
            // Desorganizar de volta para a raiz preservando pacotes nativos de camadas PSD/AI
            var protectedPsdFolders = {};
            var protectedItemIds = {};

            var allFolders = [];
            for (var fIdx = 1; fIdx <= app.project.numItems; fIdx++) {
                var fi = app.project.item(fIdx);
                if (fi instanceof FolderItem) {
                    allFolders.push(fi);
                }
            }

            for (var pf = 0; pf < allFolders.length; pf++) {
                var folder = allFolders[pf];
                if (/^(psd|ai|psb)$/i.test(folder.name) || /^(\d+[_-\s]*)?pre[-_]?comps?$/i.test(folder.name)) {
                    continue;
                }

                var hasPsdAiLayers = false;
                var hasOtherItems = false;
                for (var c = 1; c <= folder.numItems; c++) {
                    var ch = folder.item(c);
                    if (ch instanceof CompItem) {
                        continue;
                    } else if (ch instanceof FolderItem) {
                        if (!/^(\d+[_-\s]*)?pre[-_]?comps?$/i.test(ch.name)) {
                            hasOtherItems = true;
                        }
                    } else if (ch instanceof FootageItem && ch.mainSource instanceof FileSource && ch.mainSource.file) {
                        var ext = getFileExtension(ch.mainSource.file);
                        if (ext === "psd" || ext === "psb" || ext === "ai") {
                            hasPsdAiLayers = true;
                        } else {
                            hasOtherItems = true;
                        }
                    } else {
                        hasOtherItems = true;
                    }
                }

                if (hasPsdAiLayers && !hasOtherItems) {
                    // Desfazer subpasta PreComps interna ao pacote PSD/AI se houver
                    for (var c2 = folder.numItems; c2 >= 1; c2--) {
                        var subCh = folder.item(c2);
                        if (subCh instanceof FolderItem && /^(\d+[_-\s]*)?pre[-_]?comps?$/i.test(subCh.name)) {
                            for (var sc = subCh.numItems; sc >= 1; sc--) {
                                var compInPre = subCh.item(sc);
                                if (compInPre) {
                                    compInPre.parentFolder = folder;
                                    restoredItemsCount++;
                                }
                            }
                        }
                    }

                    if (!isSameFolder(folder.parentFolder, app.project.rootFolder)) {
                        folder.parentFolder = app.project.rootFolder;
                        restoredItemsCount++;
                    }
                    protectedPsdFolders[folder.id] = true;
                    for (var c3 = 1; c3 <= folder.numItems; c3++) {
                        var member = folder.item(c3);
                        if (member && !(member instanceof FolderItem)) {
                            protectedItemIds[member.id] = true;
                        }
                    }
                }
            }

            // Mover todos os demais itens de volta para a raiz do projeto
            var allNonFolders = [];
            for (var mIdx = 1; mIdx <= app.project.numItems; mIdx++) {
                var mItem = app.project.item(mIdx);
                if (mItem && !(mItem instanceof FolderItem)) {
                    allNonFolders.push(mItem);
                }
            }

            for (var u = 0; u < allNonFolders.length; u++) {
                var looseItem = allNonFolders[u];
                if (protectedItemIds[looseItem.id]) continue;
                if (!isSameFolder(looseItem.parentFolder, app.project.rootFolder)) {
                    looseItem.parentFolder = app.project.rootFolder;
                    restoredItemsCount++;
                }
            }

            // Apagar todas as pastas vazias restantes
            var cleanLoop = true;
            while (cleanLoop) {
                cleanLoop = false;
                for (var rIdx = app.project.numItems; rIdx >= 1; rIdx--) {
                    var candFolder = app.project.item(rIdx);
                    if (
                        candFolder instanceof FolderItem &&
                        !protectedPsdFolders[candFolder.id] &&
                        candFolder.numItems === 0
                    ) {
                        candFolder.remove();
                        removedFoldersCount++;
                        cleanLoop = true;
                    }
                }
            }
        }

        $.global._aeftRollbackSnapshot = null;

        return (
            '{"success": true, "restoredItems": ' +
            restoredItemsCount +
            ', "recreatedFolders": ' +
            recreatedFoldersCount +
            ', "removedFolders": ' +
            removedFoldersCount +
            ', "projectSaved": ' +
            (projectSaved ? "true" : "false") +
            "}"
        );
    } catch (err) {
        return '{"success": false, "error": "' + escapeJsonString(err.toString()) + '"}';
    } finally {
        app.endUndoGroup();
    }
};




