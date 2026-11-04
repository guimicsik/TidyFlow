/* ==========================================================================
   Project Organizer — Motor ExtendScript para Adobe Premiere Pro (22.x+)
   Compatível com ES3 ExtendScript (Premiere Pro 2022 / v22.0 em diante)
   ========================================================================== */

(function () {
    function escapeJsonString(str) {
        return String(str === undefined || str === null ? "" : str)
            .replace(/\\/g, "\\\\")
            .replace(/"/g, '\\"')
            .replace(/\r/g, "\\r")
            .replace(/\n/g, "\\n");
    }

    function parseJson(jsonStr) {
        if (!jsonStr) return null;
        if (typeof JSON !== "undefined" && JSON.parse) {
            return JSON.parse(jsonStr);
        }
        return eval("(" + jsonStr + ")");
    }

    function trimStr(str) {
        return String(str === undefined || str === null ? "" : str).replace(/^\s+|\s+$/g, "");
    }

    function stripNumericPrefix(name) {
        return String(name || "").replace(/^\d+[_-\s]+/, "");
    }

    function arrayContains(arr, val) {
        if (!arr || !arr.length) return false;
        for (var i = 0; i < arr.length; i++) {
            if (arr[i] === val) return true;
        }
        return false;
    }

    function arrayContainsIgnoreCase(arr, val) {
        if (!arr || !arr.length || !val) return false;
        var target = String(val).toLowerCase();
        for (var i = 0; i < arr.length; i++) {
            if (String(arr[i]).toLowerCase() === target) return true;
        }
        return false;
    }

    // Mapeamento bijetor 1:1 dos 16 slots do Preset Builder (1..16) para os 16 Color Labels do Premiere Pro (0..15)
    // Slot 0 = Nenhum / Manter cor padrão do Premiere Pro
    var AE_TO_PPRO_LABEL = {
        1: 0,   // Violet
        2: 15,  // Yellow
        3: 4,   // Cerulean
        4: 6,   // Rose
        5: 3,   // Lavender
        6: 7,   // Mango
        7: 2,   // Caribbean
        8: 9,   // Blue
        9: 13,  // Green
        10: 8,  // Purple
        11: 1,  // Iris
        12: 14, // Brown
        13: 11, // Magenta
        14: 10, // Teal
        15: 12, // Tan
        16: 5   // Forest
    };

    function applyPProLabelSafe(projectItem, aeLabelIndex) {
        if (!projectItem || typeof projectItem.setColorLabel !== "function") return;
        var num = parseInt(aeLabelIndex, 10);
        if (isNaN(num) || num <= 0 || num > 16) {
            return; // 0 = Sem rótulo forçado (mantém padrão do Premiere)
        }
        var pproColorIndex = AE_TO_PPRO_LABEL[num];
        if (pproColorIndex !== undefined) {
            try {
                projectItem.setColorLabel(pproColorIndex);
            } catch (e) {}
        }
    }

    function isBin(item) {
        if (!item) return false;
        try {
            if (typeof ProjectItemType !== "undefined" && item.type === ProjectItemType.BIN) {
                return true;
            }
            return item.type === 2 || item.type === "BIN";
        } catch (e) {
            return false;
        }
    }

    function isRoot(item) {
        if (!item) return false;
        try {
            if (app.project && app.project.rootItem && item.nodeId === app.project.rootItem.nodeId) {
                return true;
            }
            if (typeof ProjectItemType !== "undefined" && item.type === ProjectItemType.ROOT) {
                return true;
            }
            return item.type === 3 || item.type === "ROOT";
        } catch (e) {
            return false;
        }
    }

    function isSameBin(a, b) {
        if (!a || !b) return false;
        if (a === b) return true;
        try {
            if (a.nodeId !== undefined && b.nodeId !== undefined && a.nodeId === b.nodeId) {
                return true;
            }
        } catch (e) {}
        return false;
    }

    function renameBinSafe(binItem, newName) {
        if (!binItem || !newName) return;
        try {
            if (binItem.name === newName) return;
        } catch (e0) {}
        try {
            if (typeof binItem.renameBin === "function") {
                binItem.renameBin(newName);
            } else {
                binItem.name = newName;
            }
        } catch (e1) {
            try {
                binItem.name = newName;
            } catch (e2) {}
        }
    }

    function getMediaPathSafe(item) {
        if (!item || typeof item.getMediaPath !== "function") return "";
        try {
            var p = item.getMediaPath();
            return p ? String(p) : "";
        } catch (e) {
            return "";
        }
    }

    function isOfflineSafe(item) {
        if (!item || typeof item.isOffline !== "function") return false;
        try {
            return Boolean(item.isOffline());
        } catch (e) {
            return false;
        }
    }

    function isMulticamSafe(item) {
        if (!item || typeof item.isMulticamClip !== "function") return false;
        try {
            return Boolean(item.isMulticamClip());
        } catch (e) {
            return false;
        }
    }

    function isMergedSafe(item) {
        if (!item || typeof item.isMergedClip !== "function") return false;
        try {
            return Boolean(item.isMergedClip());
        } catch (e) {
            return false;
        }
    }

    function isSequenceFlagSafe(item) {
        if (!item || typeof item.isSequence !== "function") return false;
        try {
            return Boolean(item.isSequence());
        } catch (e) {
            return false;
        }
    }

    function extractExtensionFromPath(pathOrName) {
        if (!pathOrName) return "";
        var clean = String(pathOrName);
        // Remover sufixos de sequência como [0001-0120] caso venham no nome
        clean = clean.replace(/\[\d+\s*-\s*\d+\]/g, "");
        var lastSlash = Math.max(clean.lastIndexOf("/"), clean.lastIndexOf("\\"));
        var base = lastSlash !== -1 ? clean.substring(lastSlash + 1) : clean;
        var lastDot = base.lastIndexOf(".");
        if (lastDot === -1 || lastDot === base.length - 1) return "";
        return trimStr(base.substring(lastDot + 1)).toLowerCase();
    }

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

    function getItemExtension(item) {
        var mediaPath = getMediaPathSafe(item);
        var ext = extractExtensionFromPath(mediaPath);
        if (!ext && item && item.name) {
            ext = extractExtensionFromPath(item.name);
        }
        return ext;
    }

    function getIntrinsicMediaType(item) {
        if (!item || typeof item.getProjectMetadata !== "function") return "";
        try {
            var metaXml = item.getProjectMetadata();
            if (!metaXml) return "";
            var match = /Column\.Intrinsic\.MediaType[^>]*>([^<]+)</i.exec(metaXml);
            if (match && match[1]) {
                return trimStr(match[1]);
            }
        } catch (e) {}
        return "";
    }

    function buildSequenceMap() {
        var map = {};
        try {
            if (app.project && app.project.sequences && app.project.sequences.numSequences) {
                for (var i = 0; i < app.project.sequences.numSequences; i++) {
                    var seq = app.project.sequences[i];
                    if (seq && seq.projectItem && seq.projectItem.nodeId) {
                        map[seq.projectItem.nodeId] = seq;
                    }
                }
            }
        } catch (e) {}
        return map;
    }

    function inspectSequenceTracks(seqObj) {
        var referencedProjectItems = [];
        var seenNodeIds = {};
        var totalClipInstances = 0;

        if (!seqObj) {
            return { items: referencedProjectItems, totalClips: 0 };
        }

        function scanTrackCollection(trackCollection) {
            if (!trackCollection || !trackCollection.numTracks) return;
            for (var t = 0; t < trackCollection.numTracks; t++) {
                var track = trackCollection[t];
                if (!track || !track.clips || !track.clips.numItems) continue;
                for (var c = 0; c < track.clips.numItems; c++) {
                    var trackItem = track.clips[c];
                    if (!trackItem) continue;
                    totalClipInstances++;
                    try {
                        var pItem = trackItem.projectItem;
                        if (pItem && pItem.nodeId && !seenNodeIds[pItem.nodeId]) {
                            seenNodeIds[pItem.nodeId] = true;
                            referencedProjectItems.push(pItem);
                        }
                    } catch (errClip) {}
                }
            }
        }

        try { scanTrackCollection(seqObj.videoTracks); } catch (eV) {}
        try { scanTrackCollection(seqObj.audioTracks); } catch (eA) {}
        try {
            if (seqObj.captionTracks) {
                scanTrackCollection(seqObj.captionTracks);
            }
        } catch (eC) {}

        return {
            items: referencedProjectItems,
            totalClips: totalClipInstances
        };
    }

    // Coleta itens selecionados no painel Project mesmo quando o foco acabou de ir para o painel CEP
    function getSelectedProjectItems() {
        var result = [];
        var seen = {};

        function addSelectionArray(arr) {
            if (!arr || !arr.length) return;
            for (var i = 0; i < arr.length; i++) {
                var it = arr[i];
                if (it && it.nodeId && !seen[it.nodeId]) {
                    seen[it.nodeId] = true;
                    result.push(it);
                }
            }
        }

        try {
            if (typeof app.getCurrentProjectViewSelection === "function") {
                var directSel = app.getCurrentProjectViewSelection();
                addSelectionArray(directSel);
            }
        } catch (e1) {}

        if (result.length === 0) {
            try {
                if (typeof app.getProjectViewIDs === "function" && typeof app.getProjectViewSelection === "function") {
                    var viewIds = app.getProjectViewIDs();
                    if (viewIds && viewIds.length > 0) {
                        for (var v = 0; v < viewIds.length; v++) {
                            var vid = viewIds[v];
                            var belongsToActiveProject = true;
                            try {
                                if (typeof app.getProjectFromViewID === "function" && app.project && app.project.documentID) {
                                    var viewProj = app.getProjectFromViewID(vid);
                                    if (viewProj && viewProj.documentID && viewProj.documentID !== app.project.documentID) {
                                        belongsToActiveProject = false;
                                    }
                                }
                            } catch (eProj) {}

                            if (belongsToActiveProject) {
                                var vSel = app.getProjectViewSelection(vid);
                                addSelectionArray(vSel);
                            }
                        }
                    }
                }
            } catch (e2) {}
        }

        return result;
    }

    // Indexa toda a hierarquia atual de Bins e ProjectItems do Premiere Pro
    function takeProjectSnapshot() {
        var rootItem = app.project.rootItem;
        var parentByNodeId = {};
        var allBins = [];
        var allNonBinItems = [];
        var itemByNodeId = {};

        function walkContainer(containerBin) {
            if (!containerBin || !containerBin.children) return;
            var snapshotChildren = [];
            var count = containerBin.children.numItems || 0;
            for (var i = 0; i < count; i++) {
                var ch = containerBin.children[i];
                if (ch) {
                    snapshotChildren.push(ch);
                }
            }

            for (var j = 0; j < snapshotChildren.length; j++) {
                var child = snapshotChildren[j];
                if (child.nodeId) {
                    parentByNodeId[child.nodeId] = containerBin;
                    itemByNodeId[child.nodeId] = child;
                }
                if (isBin(child)) {
                    allBins.push(child);
                    walkContainer(child);
                } else if (!isRoot(child)) {
                    allNonBinItems.push(child);
                }
            }
        }

        walkContainer(rootItem);

        return {
            rootItem: rootItem,
            parentByNodeId: parentByNodeId,
            allBins: allBins,
            allNonBinItems: allNonBinItems,
            itemByNodeId: itemByNodeId
        };
    }

    // =========================================================================
    // 1. Listar Sequências do Projeto (equivalente a getProjectComps)
    // =========================================================================
    $.global.ppro_getProjectComps = function () {
        if (!app.project || !app.project.sequences) {
            return "[]";
        }
        var list = [];
        for (var i = 0; i < app.project.sequences.numSequences; i++) {
            var seq = app.project.sequences[i];
            if (seq && seq.projectItem) {
                list.push(
                    '{"id": "' +
                        escapeJsonString(seq.projectItem.nodeId) +
                        '", "name": "' +
                        escapeJsonString(seq.name) +
                        '"}'
                );
            }
        }
        return "[" + list.join(", ") + "]";
    };

    // =========================================================================
    // 2. Verificar Sequências Vazias / Não Usadas (equivalente a checkUnusedComps)
    // =========================================================================
    $.global.ppro_checkUnusedComps = function (configJsonString) {
        try {
            if (!app.project || !app.project.rootItem) {
                throw new Error("Nenhum projeto aberto no Premiere Pro.");
            }

            var config = parseJson(configJsonString) || {};
            var foldersCfg = config.folders || {};
            var settingsCfg = config.settings || {};
            var outputFolderName = foldersCfg.output || "01_Output";
            var unusedFolderName = settingsCfg.unusedFolderName || foldersCfg.unused || "Nunca Usadas";

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

            var snap = takeProjectSnapshot();
            var rootItem = snap.rootItem;
            var parentByNodeId = snap.parentByNodeId;
            var seqMap = buildSequenceMap();

            function isInsideTargetBin(item, targetBin) {
                if (!item || !targetBin || !item.nodeId) return false;
                var cur = parentByNodeId[item.nodeId];
                while (cur && !isSameBin(cur, rootItem)) {
                    if (isSameBin(cur, targetBin)) return true;
                    cur = cur.nodeId ? parentByNodeId[cur.nodeId] : null;
                }
                return false;
            }

            function isInsidePsdAiBin(item) {
                if (!item || !item.nodeId) return false;
                var cur = parentByNodeId[item.nodeId];
                while (cur && !isSameBin(cur, rootItem)) {
                    var pName = String(cur.name || "");
                    var pUpper = pName.toUpperCase();
                    if (
                        pUpper === "PSD" ||
                        pUpper === "AI" ||
                        pUpper === "PSB" ||
                        /\.(psd|psb|ai)$/i.test(pName)
                    ) {
                        return true;
                    }
                    // Verificar também se a bin contém camadas PSD/AI irmãs
                    if (cur.children && cur.children.numItems > 0) {
                        for (var c = 0; c < cur.children.numItems; c++) {
                            var sib = cur.children[c];
                            if (sib && !isBin(sib) && !seqMap[sib.nodeId]) {
                                var sibExt = getItemExtension(sib);
                                if (sibExt === "psd" || sibExt === "psb" || sibExt === "ai") {
                                    return true;
                                }
                            }
                        }
                    }
                    cur = cur.nodeId ? parentByNodeId[cur.nodeId] : null;
                }
                return false;
            }

            // Localizar Bin Output na raiz (com ou sem prefixo numérico)
            var outputBin = null;
            var cleanOutputTarget = stripNumericPrefix(outputFolderName).toLowerCase();
            if (rootItem.children) {
                for (var r = 0; r < rootItem.children.numItems; r++) {
                    var rChild = rootItem.children[r];
                    if (
                        isBin(rChild) &&
                        (rChild.name === outputFolderName ||
                            stripNumericPrefix(rChild.name).toLowerCase() === cleanOutputTarget)
                    ) {
                        outputBin = rChild;
                        break;
                    }
                }
            }

            // Localizar Bin Nunca Usadas na raiz (se já existir)
            var existingUnusedBin = null;
            if (rootItem.children) {
                for (var u = 0; u < rootItem.children.numItems; u++) {
                    var uChild = rootItem.children[u];
                    if (isBin(uChild) && uChild.name === unusedFolderName) {
                        existingUnusedBin = uChild;
                        break;
                    }
                }
            }

            // Coletar todas as sequências e construir grafo de uso (usedIn) e contagem de clipes
            var allSeqEntries = [];
            var clipCountByNodeId = {};
            var usedInNodeIds = {}; // childSeqNodeId -> [parentSeqNodeId, ...]

            for (var sIdx = 0; sIdx < app.project.sequences.numSequences; sIdx++) {
                var seq = app.project.sequences[sIdx];
                if (!seq || !seq.projectItem || !seq.projectItem.nodeId) continue;
                var nid = seq.projectItem.nodeId;
                var trackInfo = inspectSequenceTracks(seq);
                clipCountByNodeId[nid] = trackInfo.totalClips;
                if (!usedInNodeIds[nid]) usedInNodeIds[nid] = [];

                for (var refIdx = 0; refIdx < trackInfo.items.length; refIdx++) {
                    var refItem = trackInfo.items[refIdx];
                    if (refItem && refItem.nodeId && seqMap[refItem.nodeId] && refItem.nodeId !== nid) {
                        if (!usedInNodeIds[refItem.nodeId]) {
                            usedInNodeIds[refItem.nodeId] = [];
                        }
                        if (!arrayContains(usedInNodeIds[refItem.nodeId], nid)) {
                            usedInNodeIds[refItem.nodeId].push(nid);
                        }
                    }
                }

                allSeqEntries.push({
                    nodeId: nid,
                    seq: seq,
                    item: seq.projectItem,
                    totalClips: trackInfo.totalClips
                });
            }

            // Sequências selecionadas pelo usuário no painel Project
            var selectedItems = getSelectedProjectItems();
            var selectedSeqIds = {};
            var hasSelectedSeqWithClips = false;
            for (var selI = 0; selI < selectedItems.length; selI++) {
                var sItem = selectedItems[selI];
                if (sItem && sItem.nodeId && seqMap[sItem.nodeId] && (clipCountByNodeId[sItem.nodeId] || 0) > 0) {
                    selectedSeqIds[sItem.nodeId] = true;
                    hasSelectedSeqWithClips = true;
                }
            }

            // Sequência ativa na Timeline
            var activeSeqNodeId = null;
            if (
                app.project.activeSequence &&
                app.project.activeSequence.projectItem &&
                app.project.activeSequence.projectItem.nodeId
            ) {
                var actId = app.project.activeSequence.projectItem.nodeId;
                if ((clipCountByNodeId[actId] || 0) > 0) {
                    activeSeqNodeId = actId;
                }
            }

            // Mapear sequências protegidas
            var protectedSeqIds = {};
            for (var cIdx = 0; cIdx < allSeqEntries.length; cIdx++) {
                var entry = allSeqEntries[cIdx];
                if (entry.totalClips > 0) {
                    var parentBin = parentByNodeId[entry.nodeId];
                    if (outputBin && (isSameBin(parentBin, outputBin) || isInsideTargetBin(entry.item, outputBin))) {
                        protectedSeqIds[entry.nodeId] = true;
                    } else if (selectedSeqIds[entry.nodeId]) {
                        protectedSeqIds[entry.nodeId] = true;
                    } else if (!outputBin && !hasSelectedSeqWithClips && activeSeqNodeId && entry.nodeId === activeSeqNodeId) {
                        protectedSeqIds[entry.nodeId] = true;
                    } else if (isInsidePsdAiBin(entry.item)) {
                        protectedSeqIds[entry.nodeId] = true;
                    }
                }
            }

            var toMove = [];
            var emptyCount = 0;
            var notUsedCount = 0;
            var unusedSeqMap = {};

            // Passo 1: Identificar sequências vazias ou não aninhadas em nenhuma sequência ativa
            for (var k = 0; k < allSeqEntries.length; k++) {
                var e = allSeqEntries[k];
                var curParent = parentByNodeId[e.nodeId];
                var alreadyInUnused = Boolean(
                    existingUnusedBin &&
                    (isSameBin(curParent, existingUnusedBin) || isInsideTargetBin(e.item, existingUnusedBin))
                );

                var parentsUsingIt = usedInNodeIds[e.nodeId] || [];

                if (e.totalClips === 0) {
                    unusedSeqMap[e.nodeId] = true;
                    if (!alreadyInUnused) {
                        toMove.push(e.item);
                        emptyCount++;
                    }
                } else if (!protectedSeqIds[e.nodeId] && parentsUsingIt.length === 0) {
                    unusedSeqMap[e.nodeId] = true;
                    if (!alreadyInUnused) {
                        toMove.push(e.item);
                        notUsedCount++;
                    }
                }
            }

            // Passo 2: Propagação em cascata (sequências aninhadas usadas exclusivamente em sequências abandonadas/vazias)
            var foundMore = true;
            while (foundMore) {
                foundMore = false;
                for (var m = 0; m < allSeqEntries.length; m++) {
                    var cand = allSeqEntries[m];
                    if (unusedSeqMap[cand.nodeId] || protectedSeqIds[cand.nodeId]) {
                        continue;
                    }
                    var usedBy = usedInNodeIds[cand.nodeId] || [];
                    if (usedBy.length > 0) {
                        var allParentsUnused = true;
                        for (var uIdx = 0; uIdx < usedBy.length; uIdx++) {
                            if (!unusedSeqMap[usedBy[uIdx]]) {
                                allParentsUnused = false;
                                break;
                            }
                        }
                        if (allParentsUnused) {
                            unusedSeqMap[cand.nodeId] = true;
                            var pBin = parentByNodeId[cand.nodeId];
                            var isAlreadyInUnused = Boolean(
                                existingUnusedBin &&
                                (isSameBin(pBin, existingUnusedBin) || isInsideTargetBin(cand.item, existingUnusedBin))
                            );
                            if (!isAlreadyInUnused) {
                                toMove.push(cand.item);
                                notUsedCount++;
                            }
                            foundMore = true;
                        }
                    }
                }
            }

            var movedCount = 0;
            if (toMove.length > 0) {
                if (typeof $.global.ppro_ensurePreOrganizeSnapshot === "function") {
                    $.global.ppro_ensurePreOrganizeSnapshot();
                }
                var targetUnusedBin = existingUnusedBin;
                if (!targetUnusedBin) {
                    targetUnusedBin = rootItem.createBin(unusedFolderName);
                    if (targetUnusedBin && targetUnusedBin.nodeId) {
                        parentByNodeId[targetUnusedBin.nodeId] = rootItem;
                    }
                }
                if (targetUnusedBin) {
                    for (var mv = 0; mv < toMove.length; mv++) {
                        var itemToMove = toMove[mv];
                        var itemParent = parentByNodeId[itemToMove.nodeId];
                        if (!isSameBin(itemParent, targetUnusedBin)) {
                            itemToMove.moveBin(targetUnusedBin);
                            parentByNodeId[itemToMove.nodeId] = targetUnusedBin;
                            movedCount++;
                        }
                    }
                }
                if (typeof $.global.ppro_markPostOrganizeState === "function") {
                    $.global.ppro_markPostOrganizeState();
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
        }
    };

    // =========================================================================
    // 3. Organizar Projeto com Preset Dinâmico (equivalente a organizeWithPreset)
    // =========================================================================
    $.global.ppro_organizeWithPreset = function (mainCompId, presetJsonString) {
        if (!app.project || !app.project.rootItem) {
            return '{"success": false, "error": "Nenhum projeto aberto no Premiere Pro."}';
        }

        var preset = parseJson(presetJsonString);
        if (!preset || !preset.tree) {
            return '{"success": false, "error": "Preset inválido ou sem árvore de pastas."}';
        }

        var settings = preset.settings || {};
        var usePrefixNumbering = (settings.usePrefixNumbering !== false);
        var deleteEmptyFolders = (settings.deleteEmptyFolders !== false);
        var saveProjectBefore = (settings.saveProjectBefore === true);
        var reduceProject = (settings.reduceProject === true);
        var groupBySourceFolderGlobal = (settings.groupBySourceFolder !== false);
        var unusedFolderName = settings.unusedFolderName || "Nunca Usadas";

        var projectSaved = false;
        if (saveProjectBefore) {
            try {
                app.project.save();
                projectSaved = true;
            } catch (saveErr) {}
        }

        try {
            var snap = takeProjectSnapshot();
            var rootItem = snap.rootItem;
            var parentByNodeId = snap.parentByNodeId;
            var allBins = snap.allBins;
            var allNonBinItems = snap.allNonBinItems;
            var seqMap = buildSequenceMap();

            function isCompoundOrSequenceItem(item) {
                if (!item || isBin(item) || isRoot(item)) return false;
                if (item.nodeId && seqMap[item.nodeId]) return true;
                if (isSequenceFlagSafe(item) || isMulticamSafe(item) || isMergedSafe(item)) return true;
                return false;
            }

            function createBinInParent(parentBin, binName, optionalAeLabel) {
                var targetParent = parentBin || rootItem;
                var created = targetParent.createBin(binName);
                if (!created || !created.nodeId) {
                    if (targetParent.children) {
                        for (var c = targetParent.children.numItems - 1; c >= 0; c--) {
                            var cand = targetParent.children[c];
                            if (isBin(cand) && cand.name === binName && !parentByNodeId[cand.nodeId]) {
                                created = cand;
                                break;
                            }
                        }
                    }
                }
                if (created && created.nodeId) {
                    parentByNodeId[created.nodeId] = targetParent;
                    allBins.push(created);
                    if (optionalAeLabel !== undefined && optionalAeLabel !== null) {
                        applyPProLabelSafe(created, optionalAeLabel);
                    }
                }
                return created;
            }

            function moveItemSafe(item, targetBin) {
                if (!item || !targetBin || !item.nodeId) return false;
                if (isSameBin(item, targetBin)) return false;
                var currentParent = parentByNodeId[item.nodeId] || null;
                if (currentParent && isSameBin(currentParent, targetBin)) {
                    return false;
                }
                item.moveBin(targetBin);
                parentByNodeId[item.nodeId] = targetBin;
                return true;
            }

            function isInsideBin(item, targetBin) {
                if (!item || !targetBin || !item.nodeId) return false;
                var cur = parentByNodeId[item.nodeId];
                while (cur && !isSameBin(cur, rootItem)) {
                    if (isSameBin(cur, targetBin)) return true;
                    cur = cur.nodeId ? parentByNodeId[cur.nodeId] : null;
                }
                return false;
            }

            function getOrCreateSubBin(parentBin, pathArray, inheritLabel) {
                var currentParent = parentBin || rootItem;
                for (var i = 0; i < pathArray.length; i++) {
                    var binName = pathArray[i];
                    var foundBin = null;
                    if (currentParent.children) {
                        for (var j = 0; j < currentParent.children.numItems; j++) {
                            var child = currentParent.children[j];
                            if (isBin(child) && child.name === binName) {
                                foundBin = child;
                                if (foundBin.nodeId && !parentByNodeId[foundBin.nodeId]) {
                                    parentByNodeId[foundBin.nodeId] = currentParent;
                                }
                                break;
                            }
                        }
                    }
                    if (!foundBin) {
                        foundBin = createBinInParent(currentParent, binName, inheritLabel);
                    }
                    currentParent = foundBin;
                }
                return currentParent;
            }

            // 1. Indexar nós da árvore do preset
            var nodeRecords = [];
            var nodeRecordById = {};
            var nodeBinMap = {};
            var boundBinNodeIds = {};
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

            function ensureNodeBin(nodeId) {
                if (!nodeId || !nodeRecordById[nodeId]) return rootItem;
                if (nodeBinMap[nodeId]) return nodeBinMap[nodeId];

                var rec = nodeRecordById[nodeId];
                var parentBin = rec.parentId ? ensureNodeBin(rec.parentId) : rootItem;
                var cleanTargetName = stripNumericPrefix(rec.node.name);
                var cleanTargetLower = cleanTargetName.toLowerCase();

                var found = null;
                if (parentBin && parentBin.children) {
                    for (var i = 0; i < parentBin.children.numItems; i++) {
                        var ch = parentBin.children[i];
                        if (isBin(ch) && ch.nodeId && !boundBinNodeIds[ch.nodeId]) {
                            var chCleanLower = stripNumericPrefix(ch.name).toLowerCase();
                            if (ch.name === rec.node.name || chCleanLower === cleanTargetLower) {
                                found = ch;
                                parentByNodeId[ch.nodeId] = parentBin;
                                break;
                            }
                        }
                    }
                }

                if (!found) {
                    found = createBinInParent(parentBin, cleanTargetName, rec.node.label);
                } else {
                    applyPProLabelSafe(found, rec.node.label);
                }

                nodeBinMap[nodeId] = found;
                if (found && found.nodeId) {
                    boundBinNodeIds[found.nodeId] = true;
                }
                return found;
            }

            // Helpers de regras idênticos ao motor After Effects
            function matchesNameFilter(itemName, rules) {
                if (!rules || !rules.nameFilter) return false;
                var filterStr = trimStr(rules.nameFilter);
                if (!filterStr) return false;
                var targetName = String(itemName || "");

                if (rules.nameFilterMode === "regex") {
                    try {
                        var rx = new RegExp(filterStr, "i");
                        return rx.test(targetName);
                    } catch (e) {
                        return targetName.toLowerCase().indexOf(filterStr.toLowerCase()) !== -1;
                    }
                } else {
                    var parts = filterStr.split(",");
                    var nameLower = targetName.toLowerCase();
                    for (var p = 0; p < parts.length; p++) {
                        var token = trimStr(parts[p]).toLowerCase();
                        if (token && nameLower.indexOf(token) !== -1) {
                            return true;
                        }
                    }
                    return false;
                }
            }

            function nodeSupportsType(rules, itemType) {
                if (!rules || !rules.types || rules.types.length === 0) return false;
                var types = rules.types;

                if (itemType === "MainComp") {
                    return arrayContains(types, "MainComp") || arrayContains(types, "Compositions");
                }
                if (itemType === "PreComps") {
                    return arrayContains(types, "PreComps");
                }
                if (itemType === "Solids") {
                    return arrayContains(types, "Solids");
                }
                if (itemType === "StillImages") {
                    return arrayContains(types, "StillImages") || arrayContains(types, "Images");
                }
                if (itemType === "Videos") {
                    return arrayContains(types, "Videos") || arrayContains(types, "Footages");
                }
                if (itemType === "ImageSequences") {
                    return arrayContains(types, "ImageSequences");
                }
                if (itemType === "DataFiles") {
                    return arrayContains(types, "DataFiles");
                }
                if (itemType === "Audios") {
                    return arrayContains(types, "Audios");
                }
                return false;
            }

            function findMatchingNode(itemType, fileExt, itemName) {
                var extLower = fileExt ? String(fileExt).toLowerCase() : "";
                var bestCandidate = null;
                var bestScore = -1;

                function evaluateForType(typeToTest) {
                    for (var i = 0; i < nodeRecords.length; i++) {
                        var rec = nodeRecords[i];
                        var rules = (rec.node && rec.node.rules) || {};
                        var hasTypes = (rules.types && rules.types.length > 0);
                        var hasExts = (rules.extensions && rules.extensions.length > 0);
                        var hasNameRule = Boolean(rules.nameFilter && trimStr(rules.nameFilter) !== "");

                        if (!hasTypes && !hasExts && !hasNameRule) {
                            continue;
                        }

                        var typeOk = hasTypes ? nodeSupportsType(rules, typeToTest) : false;
                        var extOk = (hasExts && extLower) ? arrayContainsIgnoreCase(rules.extensions, extLower) : false;

                        if (hasNameRule) {
                            if (!matchesNameFilter(itemName, rules)) continue;
                            if (hasTypes && !typeOk) continue;
                            if (hasExts && !extOk) continue;

                            var nameScore = 1000 + rec.depth * 10;
                            if (nameScore > bestScore) {
                                bestScore = nameScore;
                                bestCandidate = { rec: rec, matchedViaCatchOthers: false };
                            }
                            continue;
                        }

                        if (typeToTest === "MainComp" || typeToTest === "PreComps" || typeToTest === "Solids") {
                            if (typeOk) {
                                var specialScore = 500 + rec.depth * 10;
                                if (specialScore > bestScore) {
                                    bestScore = specialScore;
                                    bestCandidate = { rec: rec, matchedViaCatchOthers: false };
                                }
                            }
                            continue;
                        }

                        if (!hasTypes && hasExts && extOk) {
                            var extOnlyScore = 850 + rec.depth * 10 - Math.min(rules.extensions.length, 50);
                            if (extOnlyScore > bestScore) {
                                bestScore = extOnlyScore;
                                bestCandidate = { rec: rec, matchedViaCatchOthers: false };
                            }
                            continue;
                        }

                        if (!typeOk) continue;

                        if (hasExts && extOk) {
                            var specificityBonus = rules.catchOthers ? 0 : 100;
                            var extCountPenalty = Math.min(rules.extensions.length, 80);
                            var explicitScore = 700 + specificityBonus + rec.depth * 10 - extCountPenalty;
                            if (explicitScore > bestScore) {
                                bestScore = explicitScore;
                                bestCandidate = { rec: rec, matchedViaCatchOthers: false };
                            }
                            continue;
                        }

                        if (!hasExts && !rules.catchOthers) {
                            var openTypeScore = 400 + rec.depth * 10;
                            if (openTypeScore > bestScore) {
                                bestScore = openTypeScore;
                                bestCandidate = { rec: rec, matchedViaCatchOthers: false };
                            }
                            continue;
                        }

                        if (rules.catchOthers) {
                            var fallbackScore = 200 + rec.depth * 10 + (hasExts ? 0 : 25);
                            if (fallbackScore > bestScore) {
                                bestScore = fallbackScore;
                                bestCandidate = { rec: rec, matchedViaCatchOthers: true };
                            }
                        }
                    }
                }

                evaluateForType(itemType);

                if (!bestCandidate && (itemType === "ImageSequences" || itemType === "DataFiles")) {
                    evaluateForType("Videos");
                }

                return bestCandidate;
            }

            function isExtInNodesOfType(extLower, targetType) {
                if (!extLower) return false;
                for (var i = 0; i < nodeRecords.length; i++) {
                    var r = nodeRecords[i].node.rules;
                    if (r && nodeSupportsType(r, targetType) && arrayContainsIgnoreCase(r.extensions, extLower)) {
                        return true;
                    }
                }
                return false;
            }

            function classifyPProItem(item, extLower) {
                var mediaPath = getMediaPathSafe(item);
                var offline = isOfflineSafe(item);

                // Item sintético nativo do Premiere Pro (Color Matte, Adjustment Layer, Black Video, Bars & Tone, Transparent Video, Titles)
                if (!mediaPath && !offline && !isCompoundOrSequenceItem(item)) {
                    return "Solids";
                }

                var mediaTypeMeta = getIntrinsicMediaType(item);

                // 1. Áudio puro ou extensão de áudio
                if (mediaTypeMeta && /^(audio|[aá]udio|ton|son)$/i.test(mediaTypeMeta)) {
                    return "Audios";
                }
                if (
                    isExtInNodesOfType(extLower, "Audios") ||
                    /^(wav|bwf|mp3|mpa|mpe|m2a|aac|m4a|aif|aiff|flac|ogg|wma|mka|asnd|ac3|caf|mid|midi)$/i.test(extLower)
                ) {
                    return "Audios";
                }

                // 2. Dados / 3D / MOGRT / Legendas / XML / Projetos
                var isExplicitDataExt = /^(json|mgjson|csv|tsv|tab|txt|pbl|jsx|bvh|obj|gltf|glb|fbx|c4d|prproj|prel|chproj|aep|aepx|aet|mogrt|srt|vtt|scc|stl|mcc|dfxp|ttml|cap|sbv|xml|edl|aaf|omf|ale|cube|look)$/i.test(extLower);
                if (
                    isExplicitDataExt ||
                    (isExtInNodesOfType(extLower, "DataFiles") && !isExtInNodesOfType(extLower, "StillImages"))
                ) {
                    return "DataFiles";
                }

                // 3. Vídeos nativos
                var isNativeVideoExt = /^(mp4|m4v|mov|qt|prores|avi|mkv|webm|mxf|mpg|mpeg|m1v|mpv|m2p|m2v|m2t|m2ts|mts|ts|vob|mod|tod|3gp|3g2|amc|dv|wmv|asf|flv|f4v|r3d|ari|braw|crm|hevc|h264|264|ogv|cine|yuv|dnxhd|dnxhr)$/i.test(extLower);
                if (isNativeVideoExt) {
                    return "Videos";
                }

                // 4. Sequência de imagens vs Imagem Estática via metadado intrínseco do Premiere
                if (mediaTypeMeta) {
                    if (/still|est[aá]tica|fija|fixe|standbild/i.test(mediaTypeMeta)) {
                        return "StillImages";
                    }
                    if (
                        /video|v[ií]deo|movie|filme/i.test(mediaTypeMeta) &&
                        extLower !== "psd" &&
                        extLower !== "psb" &&
                        extLower !== "ai"
                    ) {
                        return "ImageSequences";
                    }
                }

                if (item && item.name && /\[\d+\s*-\s*\d+\]/.test(item.name)) {
                    return "ImageSequences";
                }

                if (
                    isExtInNodesOfType(extLower, "StillImages") ||
                    /^(psd|psb|pdd|ai|eps|ps|pdf|png|jpg|jpeg|jpe|jfif|webp|tif|tiff|bmp|rle|dib|ico|gif|exr|sxr|mxr|tga|vda|icb|vst|hdr|rgbe|xyze|heif|heic|svg|iff|tdi|sgi|rgb|bw|pic|rla|rpf|ei|raw|crw|cr2|cr3|nef|nrw|arw|srf|sr2|raf|orf|rw2|pef|x3f|erf|kdc|dcr|mos|mrw|iiq|3fr|fff|srw|gpr|dxo|arq|rwl|mfw|mef|dng)$/i.test(extLower)
                ) {
                    return "StillImages";
                }

                return "Videos";
            }

            // Identificar Sequências Principais selecionadas (Output)
            var isMediaOnly = (mainCompId === "media_only" || mainCompId === null || mainCompId === undefined || mainCompId === "");
            var isSelectionMode = (mainCompId === "selection");
            var targetMainSeqItems = [];

            if (isSelectionMode) {
                var selItems = getSelectedProjectItems();
                for (var s = 0; s < selItems.length; s++) {
                    if (isCompoundOrSequenceItem(selItems[s])) {
                        targetMainSeqItems.push(selItems[s]);
                    }
                }
                if (targetMainSeqItems.length === 0) {
                    throw new Error("Nenhuma sequência selecionada.");
                }
            } else if (!isMediaOnly) {
                var targetIdStr = String(mainCompId);
                for (var m = 0; m < allNonBinItems.length; m++) {
                    var cand = allNonBinItems[m];
                    if (cand.nodeId === targetIdStr && isCompoundOrSequenceItem(cand)) {
                        targetMainSeqItems.push(cand);
                        break;
                    }
                }
            }

            var movedComps = 0;
            var movedFootages = 0;
            var cleanedFolders = 0;
            var reducedCount = 0;

            if (typeof $.global.ppro_ensurePreOrganizeSnapshot === "function") {
                $.global.ppro_ensurePreOrganizeSnapshot();
            }

            // Executar Reduce Project (remover do projeto itens não referenciados pelas sequências principais selecionadas)
            if (reduceProject && targetMainSeqItems.length > 0) {
                var keepNodeIds = {};
                var keepMediaPaths = {};
                var visitedReduceSeqs = {};

                function collectDependenciesRecursive(seqProjectItem) {
                    if (!seqProjectItem || !seqProjectItem.nodeId) return;
                    keepNodeIds[seqProjectItem.nodeId] = true;
                    if (visitedReduceSeqs[seqProjectItem.nodeId]) return;
                    visitedReduceSeqs[seqProjectItem.nodeId] = true;

                    var sObj = seqMap[seqProjectItem.nodeId];
                    if (!sObj) return;
                    var info = inspectSequenceTracks(sObj);
                    for (var idx = 0; idx < info.items.length; idx++) {
                        var depItem = info.items[idx];
                        if (!depItem || !depItem.nodeId) continue;
                        keepNodeIds[depItem.nodeId] = true;
                        var depPath = getMediaPathSafe(depItem);
                        if (depPath) {
                            keepMediaPaths[depPath] = true;
                        }
                        if (seqMap[depItem.nodeId]) {
                            collectDependenciesRecursive(depItem);
                        }
                    }
                }

                for (var tr = 0; tr < targetMainSeqItems.length; tr++) {
                    collectDependenciesRecursive(targetMainSeqItems[tr]);
                }

                var itemsToDelete = [];
                for (var d = 0; d < allNonBinItems.length; d++) {
                    var candidateDel = allNonBinItems[d];
                    if (!candidateDel || !candidateDel.nodeId) continue;
                    if (keepNodeIds[candidateDel.nodeId]) continue;
                    var candPath = getMediaPathSafe(candidateDel);
                    if (candPath && keepMediaPaths[candPath]) continue;
                    itemsToDelete.push(candidateDel);
                }

                if (itemsToDelete.length > 0) {
                    var tempTrashBin = rootItem.createBin("__ORGANIZER_REDUCE_TMP__");
                    if (tempTrashBin) {
                        for (var delIdx = 0; delIdx < itemsToDelete.length; delIdx++) {
                            try {
                                itemsToDelete[delIdx].moveBin(tempTrashBin);
                                reducedCount++;
                            } catch (eMoveTrash) {}
                        }
                        try {
                            tempTrashBin.deleteBin();
                        } catch (eDelTrash) {}

                        // Recarregar snapshot limpo após a redução
                        snap = takeProjectSnapshot();
                        rootItem = snap.rootItem;
                        parentByNodeId = snap.parentByNodeId;
                        allBins = snap.allBins;
                        allNonBinItems = snap.allNonBinItems;
                        seqMap = buildSequenceMap();
                    }
                }
            }

            var processedNodeIds = {};
            var protectedBins = [];

            function isInsideProtectedBin(item) {
                for (var i = 0; i < protectedBins.length; i++) {
                    if (isSameBin(item, protectedBins[i]) || isInsideBin(item, protectedBins[i])) {
                        return true;
                    }
                }
                return false;
            }

            function registerBinContents(targetBin) {
                if (!targetBin) return;
                if (targetBin.nodeId) {
                    processedNodeIds[targetBin.nodeId] = true;
                }
                if (!targetBin.children) return;
                for (var i = 0; i < targetBin.children.numItems; i++) {
                    var sub = targetBin.children[i];
                    if (!sub) continue;
                    if (sub.nodeId) {
                        processedNodeIds[sub.nodeId] = true;
                    }
                    if (isBin(sub)) {
                        registerBinContents(sub);
                    }
                }
            }

            // Proteger a Bin "Nunca Usadas"
            if (rootItem.children) {
                for (var u = 0; u < rootItem.children.numItems; u++) {
                    var ufBin = rootItem.children[u];
                    if (isBin(ufBin) && ufBin.name === unusedFolderName) {
                        protectedBins.push(ufBin);
                        registerBinContents(ufBin);
                        break;
                    }
                }
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

            function isTreeRootOrCategoryBin(bin) {
                if (!bin || !isBin(bin)) return false;
                var cleanB = stripNumericPrefix(bin.name).toLowerCase();
                if (bin.name === unusedFolderName) return true;
                for (var i = 0; i < nodeRecords.length; i++) {
                    var cleanNode = stripNumericPrefix(nodeRecords[i].node.name).toLowerCase();
                    if (cleanB === cleanNode) return true;
                }
                return false;
            }

            // 1. Tratar Bins nativas de camadas PSD / AI importadas
            if (psdBundleNodeRec && psdBundleNodeRec.node.rules && psdBundleNodeRec.node.rules.handlePsdBundles !== false) {
                for (var b = 0; b < allBins.length; b++) {
                    var binCandidate = allBins[b];
                    if (
                        !binCandidate ||
                        isInsideProtectedBin(binCandidate) ||
                        isTreeRootOrCategoryBin(binCandidate) ||
                        /^(psd|ai|psb)$/i.test(binCandidate.name) ||
                        /^(\d+[_-\s]*)?(pre[-_]?comps?|sequences?|sequ[eê]ncias?)$/i.test(binCandidate.name)
                    ) {
                        continue;
                    }

                    var hasLayeredVectorOrPsd = false;
                    var hasNonPsdAiItems = false;
                    var detectedType = null;
                    var internalSeqs = [];

                    var childCount = (binCandidate.children && binCandidate.children.numItems) ? binCandidate.children.numItems : 0;
                    if (childCount === 0) continue;

                    for (var c = 0; c < childCount; c++) {
                        var child = binCandidate.children[c];
                        if (!child) continue;
                        if (isCompoundOrSequenceItem(child)) {
                            internalSeqs.push(child);
                        } else if (isBin(child)) {
                            if (!/^(\d+[_-\s]*)?(pre[-_]?comps?|sequences?|sequ[eê]ncias?)$/i.test(child.name)) {
                                hasNonPsdAiItems = true;
                            }
                        } else {
                            var ext = getItemExtension(child);
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
                        }
                    }

                    if (hasLayeredVectorOrPsd && !hasNonPsdAiItems) {
                        if (internalSeqs.length > 0) {
                            var localPreCompBin = null;
                            for (var c2 = 0; c2 < binCandidate.children.numItems; c2++) {
                                var ch = binCandidate.children[c2];
                                if (isBin(ch) && /^(\d+[_-\s]*)?(pre[-_]?comps?|sequences?|sequ[eê]ncias?)$/i.test(ch.name)) {
                                    localPreCompBin = ch;
                                    break;
                                }
                            }
                            if (!localPreCompBin) {
                                localPreCompBin = createBinInParent(binCandidate, "PreComps", null);
                            }

                            for (var isq = 0; isq < internalSeqs.length; isq++) {
                                if (moveItemSafe(internalSeqs[isq], localPreCompBin)) {
                                    movedComps++;
                                }
                                processedNodeIds[internalSeqs[isq].nodeId] = true;
                            }
                        }

                        var targetPsdNodeBin = ensureNodeBin(psdBundleNodeRec.id);
                        var destContainer = targetPsdNodeBin;
                        var psdSubPath = [];
                        if (psdBundleNodeRec.node.rules && psdBundleNodeRec.node.rules.groupSubfoldersByExt) {
                            psdSubPath.push(detectedType);
                        }
                        var shouldGroupPsdBySource = (psdBundleNodeRec.node.rules && psdBundleNodeRec.node.rules.groupBySourceFolder !== undefined)
                            ? Boolean(psdBundleNodeRec.node.rules.groupBySourceFolder)
                            : groupBySourceFolderGlobal;
                        if (shouldGroupPsdBySource && binCandidate.children) {
                            var bundleSourceFolder = "";
                            for (var bc = 0; bc < binCandidate.children.numItems; bc++) {
                                var bChild = binCandidate.children[bc];
                                var bPath = getMediaPathSafe(bChild);
                                if (bPath) {
                                    bundleSourceFolder = getParentFolderNameFromPath(bPath);
                                    if (bundleSourceFolder) break;
                                }
                            }
                            if (bundleSourceFolder) {
                                psdSubPath.push(bundleSourceFolder);
                            }
                        }
                        if (psdSubPath.length > 0) {
                            destContainer = getOrCreateSubBin(targetPsdNodeBin, psdSubPath, psdBundleNodeRec.node.label);
                        }

                        if (!isSameBin(binCandidate, destContainer)) {
                            if (moveItemSafe(binCandidate, destContainer)) {
                                movedFootages++;
                            }
                        }

                        protectedBins.push(binCandidate);
                        registerBinContents(binCandidate);
                    }
                }
            }

            // 2. Processar Sequências Principais (MainComp) e Sequências Aninhadas recursivas (PreComps)
            if (targetMainSeqItems.length > 0) {
                var isOutputSeq = {};
                for (var ts = 0; ts < targetMainSeqItems.length; ts++) {
                    isOutputSeq[targetMainSeqItems[ts].nodeId] = true;
                }

                function processNestedSeqsForMain(currentSeqItem, mainSeqName, visitedMap) {
                    var seqObj = seqMap[currentSeqItem.nodeId];
                    if (!seqObj) return;

                    var trackInfo = inspectSequenceTracks(seqObj);
                    for (var i = 0; i < trackInfo.items.length; i++) {
                        var refItem = trackInfo.items[i];
                        if (refItem && refItem.nodeId && isCompoundOrSequenceItem(refItem)) {
                            if (isOutputSeq[refItem.nodeId]) {
                                continue;
                            }
                            if (!visitedMap[refItem.nodeId]) {
                                visitedMap[refItem.nodeId] = true;
                                if (!isInsideProtectedBin(refItem) && !processedNodeIds[refItem.nodeId]) {
                                    var preMatch = findMatchingNode("PreComps", "", refItem.name);
                                    if (preMatch && preMatch.rec) {
                                        var preNodeBin = ensureNodeBin(preMatch.rec.id);
                                        var destPreBin = preNodeBin;
                                        if (preMatch.rec.node.rules && preMatch.rec.node.rules.groupByMainComp) {
                                            destPreBin = getOrCreateSubBin(preNodeBin, [mainSeqName], preMatch.rec.node.label);
                                        }
                                        if (moveItemSafe(refItem, destPreBin)) {
                                            movedComps++;
                                        }
                                        processedNodeIds[refItem.nodeId] = true;
                                    }
                                }
                                processNestedSeqsForMain(refItem, mainSeqName, visitedMap);
                            }
                        }
                    }
                }

                for (var ms = 0; ms < targetMainSeqItems.length; ms++) {
                    var mainSeqItem = targetMainSeqItems[ms];
                    var mainMatch = findMatchingNode("MainComp", "", mainSeqItem.name);
                    if (mainMatch && mainMatch.rec) {
                        var outBin = ensureNodeBin(mainMatch.rec.id);
                        if (moveItemSafe(mainSeqItem, outBin)) {
                            movedComps++;
                        }
                    }
                    processedNodeIds[mainSeqItem.nodeId] = true;

                    var visitedSeqs = {};
                    visitedSeqs[mainSeqItem.nodeId] = true;
                    processNestedSeqsForMain(mainSeqItem, mainSeqItem.name, visitedSeqs);
                }
            }

            // 3. Processar os demais itens do projeto
            for (var r = 0; r < allNonBinItems.length; r++) {
                var item = allNonBinItems[r];
                if (!item || !item.nodeId) continue;
                if (processedNodeIds[item.nodeId] || isInsideProtectedBin(item)) {
                    continue;
                }

                if (isCompoundOrSequenceItem(item)) {
                    if (!isMediaOnly) {
                        var loosePreMatch = findMatchingNode("PreComps", "", item.name);
                        if (loosePreMatch && loosePreMatch.rec) {
                            var looseNodeBin = ensureNodeBin(loosePreMatch.rec.id);
                            var targetLooseBin = looseNodeBin;
                            if (loosePreMatch.rec.node.rules && loosePreMatch.rec.node.rules.groupByMainComp) {
                                targetLooseBin = getOrCreateSubBin(looseNodeBin, ["Geral"], loosePreMatch.rec.node.label);
                            }
                            if (moveItemSafe(item, targetLooseBin)) {
                                movedComps++;
                            }
                            processedNodeIds[item.nodeId] = true;
                        }
                    }
                } else {
                    var fileExt = getItemExtension(item);
                    var fType = classifyPProItem(item, fileExt);

                    if (fType === "Solids") {
                        var solidMatch = findMatchingNode("Solids", "", item.name);
                        if (solidMatch && solidMatch.rec) {
                            var solidBin = ensureNodeBin(solidMatch.rec.id);
                            if (moveItemSafe(item, solidBin)) {
                                movedFootages++;
                            }
                            processedNodeIds[item.nodeId] = true;
                        }
                    } else {
                        var mediaMatch = findMatchingNode(fType, fileExt, item.name);
                        if (mediaMatch && mediaMatch.rec) {
                            var targetNode = mediaMatch.rec.node;
                            var nodeBin = ensureNodeBin(mediaMatch.rec.id);
                            var finalMediaBin = nodeBin;

                            var shouldGroupBySource = (targetNode.rules && targetNode.rules.groupBySourceFolder !== undefined)
                                ? Boolean(targetNode.rules.groupBySourceFolder)
                                : groupBySourceFolderGlobal;

                            var sourceFolderName = "";
                            if (shouldGroupBySource) {
                                var mediaPath = getMediaPathSafe(item);
                                if (mediaPath) {
                                    sourceFolderName = getParentFolderNameFromPath(mediaPath);
                                }
                            }

                            var subPath = [];
                            if (targetNode.rules && targetNode.rules.groupSubfoldersByExt) {
                                var subBinName = (mediaMatch.matchedViaCatchOthers || !fileExt)
                                    ? "OTHERS"
                                    : fileExt.toUpperCase();
                                subPath.push(subBinName);

                                if (
                                    !shouldGroupBySource &&
                                    !mediaMatch.matchedViaCatchOthers &&
                                    (fileExt === "psd" || fileExt === "psb" || fileExt === "ai") &&
                                    item.name
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
                                finalMediaBin = getOrCreateSubBin(nodeBin, subPath, targetNode.label);
                            }

                            if (moveItemSafe(item, finalMediaBin)) {
                                movedFootages++;
                            }
                            processedNodeIds[item.nodeId] = true;
                        }
                    }
                }
            }

            // 4. Limpar Bins vazias recursivamente (bottom-up)
            if (deleteEmptyFolders) {
                function cleanEmptyBinsBottomUp(container) {
                    if (!container || !container.children) return 0;
                    var removedHere = 0;
                    for (var idx = container.children.numItems - 1; idx >= 0; idx--) {
                        var ch = container.children[idx];
                        if (ch && isBin(ch) && !isInsideProtectedBin(ch)) {
                            removedHere += cleanEmptyBinsBottomUp(ch);
                            if (ch.children && ch.children.numItems === 0) {
                                try {
                                    ch.deleteBin();
                                    removedHere++;
                                } catch (eDel) {}
                            }
                        }
                    }
                    return removedHere;
                }

                cleanedFolders = cleanEmptyBinsBottomUp(rootItem);
            }

            // 5. Aplicar numeração sequencial (01_, 02_...) e Color Labels apenas nas Bins com itens
            function applyTreeNumberingAndLabels(nodesList, parentBin) {
                if (!nodesList || !nodesList.length || !parentBin || !parentBin.children) return;

                var activeEntries = [];
                for (var i = 0; i < nodesList.length; i++) {
                    var n = nodesList[i];
                    if (!n) continue;

                    var bin = null;
                    var cleanN = stripNumericPrefix(n.name).toLowerCase();

                    // Localizar a bin viva dentro de parentBin.children (garante que não foi removida se estava vazia)
                    for (var j = 0; j < parentBin.children.numItems; j++) {
                        var sub = parentBin.children[j];
                        if (isBin(sub)) {
                            if (nodeBinMap[n.id] && isSameBin(sub, nodeBinMap[n.id])) {
                                bin = sub;
                                break;
                            }
                            if (stripNumericPrefix(sub.name).toLowerCase() === cleanN) {
                                bin = sub;
                                break;
                            }
                        }
                    }

                    if (bin && bin.children && bin.children.numItems > 0) {
                        activeEntries.push({
                            node: n,
                            bin: bin
                        });
                    }
                }

                var currentSeq = 0;
                for (var a = 0; a < activeEntries.length; a++) {
                    var entry = activeEntries[a];
                    var baseName = stripNumericPrefix(entry.node.name);
                    var finalName = baseName;

                    var isNodeNumbered = (entry.node.useNumbering !== false);
                    if (usePrefixNumbering && isNodeNumbered) {
                        currentSeq++;
                        var prefix = (currentSeq < 10 ? "0" + currentSeq : String(currentSeq)) + "_";
                        finalName = prefix + baseName;
                    }

                    renameBinSafe(entry.bin, finalName);
                    applyPProLabelSafe(entry.bin, entry.node.label);

                    if (entry.node.children && entry.node.children.length > 0) {
                        applyTreeNumberingAndLabels(entry.node.children, entry.bin);
                    }
                }
            }

            applyTreeNumberingAndLabels(preset.tree, rootItem);

            if (typeof $.global.ppro_markPostOrganizeState === "function") {
                $.global.ppro_markPostOrganizeState();
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
                "}"
            );
        } catch (err) {
            return '{"success": false, "error": "' + escapeJsonString(err.toString()) + '"}';
        }
    };

    // =========================================================================
    // 4. Criar Estrutura Vazia de Bins do Preset (createPresetFolderStructure)
    // =========================================================================
    $.global.ppro_createPresetFolderStructure = function (presetJsonString) {
        if (!app.project || !app.project.rootItem) {
            return '{"success": false, "error": "Nenhum projeto aberto no Premiere Pro."}';
        }

        var preset = parseJson(presetJsonString);
        if (!preset || !preset.tree || !preset.tree.length) {
            return '{"success": false, "error": "O preset selecionado não possui pastas configuradas."}';
        }

        var settings = preset.settings || {};
        var usePrefixNumbering = (settings.usePrefixNumbering !== false);

        try {
            var rootItem = app.project.rootItem;
            var createdCount = 0;
            var existingCount = 0;
            var boundBinIds = {};

            function buildNodesInBin(nodesList, parentBin) {
                if (!nodesList || !nodesList.length || !parentBin) return;

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
                    if (parentBin.children) {
                        for (var j = 0; j < parentBin.children.numItems; j++) {
                            var ch = parentBin.children[j];
                            if (isBin(ch) && ch.nodeId && !boundBinIds[ch.nodeId]) {
                                var chCleanLower = stripNumericPrefix(ch.name).toLowerCase();
                                if (ch.name === finalName || ch.name === node.name || chCleanLower === baseLower) {
                                    found = ch;
                                    break;
                                }
                            }
                        }
                    }

                    if (found) {
                        existingCount++;
                        renameBinSafe(found, finalName);
                    } else {
                        found = parentBin.createBin(finalName);
                        if (!found || !found.nodeId) {
                            if (parentBin.children) {
                                for (var k = parentBin.children.numItems - 1; k >= 0; k--) {
                                    var cand = parentBin.children[k];
                                    if (isBin(cand) && cand.name === finalName && !boundBinIds[cand.nodeId]) {
                                        found = cand;
                                        break;
                                    }
                                }
                            }
                        }
                        createdCount++;
                    }

                    if (found) {
                        if (found.nodeId) {
                            boundBinIds[found.nodeId] = true;
                        }
                        applyPProLabelSafe(found, node.label);

                        if (node.children && node.children.length > 0) {
                            buildNodesInBin(node.children, found);
                        }
                    }
                }
            }

            if (typeof $.global.ppro_ensurePreOrganizeSnapshot === "function") {
                $.global.ppro_ensurePreOrganizeSnapshot();
            }

            buildNodesInBin(preset.tree, rootItem);

            if (typeof $.global.ppro_markPostOrganizeState === "function") {
                $.global.ppro_markPostOrganizeState();
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
        }
    };

    // =========================================================================
    // 5. Sistema de Snapshot e Rollback para Premiere Pro (PPRO)
    // =========================================================================
    $.global._pproRollbackSnapshot = $.global._pproRollbackSnapshot || null;

    $.global.ppro_captureRawSnapshot = function () {
        if (!app.project || !app.project.rootItem) return null;
        var rootItem = app.project.rootItem;
        var bins = [];
        var items = [];

        function walk(containerBin, depth) {
            if (!containerBin || !containerBin.children) return;
            var count = containerBin.children.numItems || 0;
            var parentId = isRoot(containerBin) ? "ROOT" : String(containerBin.nodeId || "ROOT");

            for (var i = 0; i < count; i++) {
                var ch = containerBin.children[i];
                if (!ch || !ch.nodeId) continue;
                var colorLbl = -1;
                try {
                    if (typeof ch.getColorLabel === "function") {
                        colorLbl = ch.getColorLabel();
                    }
                } catch (eLbl) {}

                if (isBin(ch)) {
                    bins.push({
                        nodeId: String(ch.nodeId),
                        name: String(ch.name || ""),
                        parentNodeId: parentId,
                        colorLabel: colorLbl,
                        depth: depth
                    });
                    walk(ch, depth + 1);
                } else if (!isRoot(ch)) {
                    items.push({
                        nodeId: String(ch.nodeId),
                        name: String(ch.name || ""),
                        parentNodeId: parentId,
                        colorLabel: colorLbl
                    });
                }
            }
        }

        walk(rootItem, 0);

        bins.sort(function (a, b) {
            return a.depth - b.depth;
        });

        return {
            host: "PPRO",
            projectFile: app.project.path ? String(app.project.path) : "",
            bins: bins,
            items: items,
            createdBinNodeIds: {},
            movedItemParents: {}
        };
    };

    $.global.ppro_ensurePreOrganizeSnapshot = function () {
        if (!app.project || !app.project.rootItem) return;
        var existing = $.global._pproRollbackSnapshot;
        if (existing && existing.bins && existing.items) {
            var curPath = app.project.path ? String(app.project.path) : "";
            var sameProj = (!existing.projectFile || !curPath || existing.projectFile === curPath);
            if (sameProj) {
                var snap = takeProjectSnapshot();
                var origBinMap = {};
                for (var b = 0; b < existing.bins.length; b++) {
                    origBinMap[existing.bins[b].nodeId] = existing.bins[b];
                }
                var origItemMap = {};
                for (var im = 0; im < existing.items.length; im++) {
                    origItemMap[existing.items[im].nodeId] = existing.items[im];
                }

                var stillOrganized = false;
                for (var cb = 0; cb < snap.allBins.length; cb++) {
                    var binIt = snap.allBins[cb];
                    if (binIt && binIt.nodeId && existing.createdBinNodeIds && existing.createdBinNodeIds[binIt.nodeId] && !origBinMap[binIt.nodeId]) {
                        stillOrganized = true;
                        break;
                    }
                }
                if (!stillOrganized) {
                    for (var ci = 0; ci < snap.allNonBinItems.length; ci++) {
                        var nonBin = snap.allNonBinItems[ci];
                        if (!nonBin || !nonBin.nodeId) continue;
                        var pBin = snap.parentByNodeId[nonBin.nodeId];
                        var pNodeId = (pBin && !isRoot(pBin) && pBin.nodeId) ? String(pBin.nodeId) : "ROOT";
                        if (
                            existing.movedItemParents &&
                            existing.movedItemParents[nonBin.nodeId] !== undefined &&
                            origItemMap[nonBin.nodeId] &&
                            pNodeId === existing.movedItemParents[nonBin.nodeId] &&
                            pNodeId !== origItemMap[nonBin.nodeId].parentNodeId
                        ) {
                            stillOrganized = true;
                            break;
                        }
                    }
                }

                if (stillOrganized) {
                    for (var k = 0; k < snap.allNonBinItems.length; k++) {
                        var newIt = snap.allNonBinItems[k];
                        if (newIt && newIt.nodeId && !origItemMap[newIt.nodeId]) {
                            var curPBin = snap.parentByNodeId[newIt.nodeId];
                            var curPId = (curPBin && !isRoot(curPBin) && curPBin.nodeId) ? String(curPBin.nodeId) : "ROOT";
                            var safePId = origBinMap[curPId] ? curPId : "ROOT";
                            existing.items.push({
                                nodeId: String(newIt.nodeId),
                                name: String(newIt.name || ""),
                                parentNodeId: safePId,
                                colorLabel: -1
                            });
                        }
                    }
                    return;
                }
            }
        }

        $.global._pproRollbackSnapshot = $.global.ppro_captureRawSnapshot();
    };

    $.global.ppro_markPostOrganizeState = function () {
        var snap = $.global._pproRollbackSnapshot;
        if (!snap || !app.project || !app.project.rootItem) return;
        if (app.project.path) {
            snap.projectFile = String(app.project.path);
        }
        var current = takeProjectSnapshot();
        var createdBins = {};
        var movedParents = {};
        for (var i = 0; i < current.allBins.length; i++) {
            if (current.allBins[i] && current.allBins[i].nodeId) {
                createdBins[current.allBins[i].nodeId] = true;
            }
        }
        for (var j = 0; j < current.allNonBinItems.length; j++) {
            var it = current.allNonBinItems[j];
            if (it && it.nodeId) {
                var p = current.parentByNodeId[it.nodeId];
                movedParents[it.nodeId] = (p && !isRoot(p) && p.nodeId) ? String(p.nodeId) : "ROOT";
            }
        }
        snap.createdBinNodeIds = createdBins;
        snap.movedItemParents = movedParents;
    };

    $.global.ppro_getRollbackSnapshotJson = function () {
        var snap = $.global._pproRollbackSnapshot;
        if (!snap || !snap.bins || !snap.items) return "";

        var bParts = [];
        for (var i = 0; i < snap.bins.length; i++) {
            var b = snap.bins[i];
            bParts.push(
                '{"nodeId":"' + escapeJsonString(b.nodeId) + '"' +
                ',"name":"' + escapeJsonString(b.name) + '"' +
                ',"parentNodeId":"' + escapeJsonString(b.parentNodeId) + '"' +
                ',"colorLabel":' + (b.colorLabel !== undefined ? b.colorLabel : -1) +
                ',"depth":' + (b.depth || 0) + '}'
            );
        }

        var iParts = [];
        for (var j = 0; j < snap.items.length; j++) {
            var it = snap.items[j];
            iParts.push(
                '{"nodeId":"' + escapeJsonString(it.nodeId) + '"' +
                ',"name":"' + escapeJsonString(it.name) + '"' +
                ',"parentNodeId":"' + escapeJsonString(it.parentNodeId) + '"' +
                ',"colorLabel":' + (it.colorLabel !== undefined ? it.colorLabel : -1) + '}'
            );
        }

        return (
            '{"host":"PPRO","projectFile":"' + escapeJsonString(snap.projectFile || "") + '",' +
            '"bins":[' + bParts.join(",") + '],' +
            '"items":[' + iParts.join(",") + ']}'
        );
    };

    $.global.ppro_rollbackProject = function (saveBefore, backupSnapshotJson) {
        if (!app.project || !app.project.rootItem) {
            return '{"success": false, "error": "Nenhum projeto aberto no Premiere Pro."}';
        }

        var shouldSave = (saveBefore === true || saveBefore === "true");
        var projectSaved = false;
        if (shouldSave) {
            try {
                app.project.save();
                projectSaved = true;
            } catch (saveErr) {}
        }

        var snapshot = $.global._pproRollbackSnapshot;
        if (!snapshot && backupSnapshotJson) {
            var candidateSnap = parseJson(backupSnapshotJson);
            if (candidateSnap && candidateSnap.host === "PPRO" && candidateSnap.bins && candidateSnap.items) {
                var curPath = app.project.path ? String(app.project.path) : "";
                if (!candidateSnap.projectFile || !curPath || candidateSnap.projectFile === curPath) {
                    snapshot = candidateSnap;
                }
            }
        }

        try {
            var rootItem = app.project.rootItem;
            var restoredItemsCount = 0;
            var recreatedFoldersCount = 0;
            var removedFoldersCount = 0;

            if (snapshot && snapshot.bins && snapshot.items) {
                var snap = takeProjectSnapshot();
                var restoredBinByOldNodeId = { "ROOT": rootItem };
                if (rootItem.nodeId) {
                    restoredBinByOldNodeId[rootItem.nodeId] = rootItem;
                }
                var validBinNodeIds = {};

                var snapBins = snapshot.bins.slice(0);
                snapBins.sort(function (a, b) {
                    return (a.depth || 0) - (b.depth || 0);
                });

                // 1. Restaurar ou recriar Bins originais
                for (var b = 0; b < snapBins.length; b++) {
                    var sb = snapBins[b];
                    var targetParent = restoredBinByOldNodeId[sb.parentNodeId] || rootItem;
                    var liveBin = snap.itemByNodeId[sb.nodeId];

                    if (liveBin && isBin(liveBin)) {
                        renameBinSafe(liveBin, sb.name);
                        if (sb.colorLabel !== undefined && sb.colorLabel >= 0 && typeof liveBin.setColorLabel === "function") {
                            try { liveBin.setColorLabel(sb.colorLabel); } catch (eL1) {}
                        }
                        var curP = snap.parentByNodeId[liveBin.nodeId];
                        if (!isSameBin(curP, targetParent)) {
                            liveBin.moveBin(targetParent);
                            snap.parentByNodeId[liveBin.nodeId] = targetParent;
                        }
                        restoredBinByOldNodeId[sb.nodeId] = liveBin;
                        validBinNodeIds[liveBin.nodeId] = true;
                    } else {
                        var recreated = targetParent.createBin(sb.name);
                        if (!recreated || !recreated.nodeId) {
                            if (targetParent.children) {
                                for (var c = targetParent.children.numItems - 1; c >= 0; c--) {
                                    var cand = targetParent.children[c];
                                    if (isBin(cand) && cand.name === sb.name && !validBinNodeIds[cand.nodeId]) {
                                        recreated = cand;
                                        break;
                                    }
                                }
                            }
                        }
                        if (recreated) {
                            if (sb.colorLabel !== undefined && sb.colorLabel >= 0 && typeof recreated.setColorLabel === "function") {
                                try { recreated.setColorLabel(sb.colorLabel); } catch (eL2) {}
                            }
                            restoredBinByOldNodeId[sb.nodeId] = recreated;
                            if (recreated.nodeId) {
                                validBinNodeIds[recreated.nodeId] = true;
                                snap.parentByNodeId[recreated.nodeId] = targetParent;
                            }
                            recreatedFoldersCount++;
                        }
                    }
                }

                // 2. Mover todos os itens para suas Bins originais
                snap = takeProjectSnapshot();
                var snapItemMap = {};
                for (var si = 0; si < snapshot.items.length; si++) {
                    snapItemMap[snapshot.items[si].nodeId] = snapshot.items[si];
                }

                for (var k = 0; k < snap.allNonBinItems.length; k++) {
                    var item = snap.allNonBinItems[k];
                    if (!item || !item.nodeId) continue;
                    var sItem = snapItemMap[item.nodeId];
                    var targetBin = rootItem;

                    if (sItem) {
                        targetBin = (sItem.parentNodeId && restoredBinByOldNodeId[sItem.parentNodeId])
                            ? restoredBinByOldNodeId[sItem.parentNodeId]
                            : rootItem;
                    } else {
                        var curPBin = snap.parentByNodeId[item.nodeId];
                        var insideInvalid = false;
                        while (curPBin && !isSameBin(curPBin, rootItem)) {
                            if (!validBinNodeIds[curPBin.nodeId]) {
                                insideInvalid = true;
                                break;
                            }
                            curPBin = curPBin.nodeId ? snap.parentByNodeId[curPBin.nodeId] : null;
                        }
                        if (!insideInvalid) continue;
                        targetBin = rootItem;
                    }

                    var currentParent = snap.parentByNodeId[item.nodeId];
                    if (!isSameBin(currentParent, targetBin)) {
                        item.moveBin(targetBin);
                        snap.parentByNodeId[item.nodeId] = targetBin;
                        restoredItemsCount++;
                    }
                }

                // 3. Remover Bins criadas pela organização
                function removeNonSnapshotBinsBottomUp(container) {
                    if (!container || !container.children) return 0;
                    var removedHere = 0;
                    for (var idx = container.children.numItems - 1; idx >= 0; idx--) {
                        var ch = container.children[idx];
                        if (ch && isBin(ch)) {
                            removedHere += removeNonSnapshotBinsBottomUp(ch);
                            if (!validBinNodeIds[ch.nodeId] && (!ch.children || ch.children.numItems === 0)) {
                                try {
                                    ch.deleteBin();
                                    removedHere++;
                                } catch (eDel) {}
                            }
                        }
                    }
                    return removedHere;
                }

                removedFoldersCount = removeNonSnapshotBinsBottomUp(rootItem);
            } else {
                // Fallback: mover todos os itens para a raiz e limpar Bins vazias
                var fallbackSnap = takeProjectSnapshot();
                for (var m = 0; m < fallbackSnap.allNonBinItems.length; m++) {
                    var fItem = fallbackSnap.allNonBinItems[m];
                    if (!fItem || !fItem.nodeId) continue;
                    var fParent = fallbackSnap.parentByNodeId[fItem.nodeId];
                    if (!isSameBin(fParent, rootItem)) {
                        fItem.moveBin(rootItem);
                        restoredItemsCount++;
                    }
                }

                function removeAllEmptyBinsBottomUp(container) {
                    if (!container || !container.children) return 0;
                    var removedHere = 0;
                    for (var idx = container.children.numItems - 1; idx >= 0; idx--) {
                        var ch = container.children[idx];
                        if (ch && isBin(ch)) {
                            removedHere += removeAllEmptyBinsBottomUp(ch);
                            if (!ch.children || ch.children.numItems === 0) {
                                try {
                                    ch.deleteBin();
                                    removedHere++;
                                } catch (eDel2) {}
                            }
                        }
                    }
                    return removedHere;
                }

                removedFoldersCount = removeAllEmptyBinsBottomUp(rootItem);
            }

            $.global._pproRollbackSnapshot = null;

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
        }
    };
})();
