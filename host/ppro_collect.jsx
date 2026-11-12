/* ==========================================================================
   TidyFlow — Collect Files: motor de host para Adobe Premiere Pro (22.x+)
   - ppro_collectScan: levanta mídias com arquivo, proxies, MOGRTs, sequências
     e efeitos aplicados para a janela com.tidyflow.collect.
   - ppro_collectFinalize: fecha o projeto original (já salvo), abre a cópia
     .prproj reescrita pelo CEP/Node, restaura nomes, executa Reduce Project
     quando solicitado e salva o projeto coletado.
   ES3 estrito (sem let/const/arrow/forEach/map/filter/indexOf de Array).
   ========================================================================== */
(function () {
    var IMAGE_EXTS = [
        "png", "jpg", "jpeg", "jpe", "jfif", "tif", "tiff", "exr", "dpx",
        "tga", "bmp", "cin", "hdr", "sgi", "iff", "dng", "webp"
    ];

    function esc(str) {
        return String(str === undefined || str === null ? "" : str)
            .replace(/\\/g, "\\\\")
            .replace(/"/g, '\\"')
            .replace(/\r/g, "\\r")
            .replace(/\n/g, "\\n")
            .replace(/\t/g, "\\t")
            .replace(/[\x00-\x1F]/g, " ");
    }

    function q(str) {
        return '"' + esc(str) + '"';
    }

    function contains(arr, v) {
        for (var i = 0; i < arr.length; i++) {
            if (arr[i] === v) return true;
        }
        return false;
    }

    function trimStr(s) {
        return String(s === undefined || s === null ? "" : s).replace(/^\s+|\s+$/g, "");
    }

    function parseOptions(json) {
        var o = null;
        try {
            if ($.global.OrgLib && $.global.OrgLib.parseJson) {
                o = $.global.OrgLib.parseJson(json);
            }
        } catch (e) {}
        return o || {};
    }

    function fileExtFromPath(pathOrName) {
        if (!pathOrName) return "";
        var clean = String(pathOrName).replace(/\[\d+\s*-\s*\d+\]/g, "");
        var slash = Math.max(clean.lastIndexOf("/"), clean.lastIndexOf("\\"));
        var base = slash >= 0 ? clean.substring(slash + 1) : clean;
        var dot = base.lastIndexOf(".");
        if (dot < 0 || dot === base.length - 1) return "";
        return trimStr(base.substring(dot + 1)).toLowerCase();
    }

    function fileBaseFromPath(pathStr) {
        if (!pathStr) return "";
        var clean = String(pathStr);
        var slash = Math.max(clean.lastIndexOf("/"), clean.lastIndexOf("\\"));
        return slash >= 0 ? clean.substring(slash + 1) : clean;
    }

    function fileDirFromPath(pathStr) {
        if (!pathStr) return "";
        var clean = String(pathStr);
        var slash = Math.max(clean.lastIndexOf("/"), clean.lastIndexOf("\\"));
        return slash >= 0 ? clean.substring(0, slash) : "";
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

    function isSequenceItem(item) {
        if (!item || typeof item.isSequence !== "function") return false;
        try {
            return Boolean(item.isSequence());
        } catch (e) {
            return false;
        }
    }

    function isMulticamItem(item) {
        if (!item || typeof item.isMulticamClip !== "function") return false;
        try {
            return Boolean(item.isMulticamClip());
        } catch (e) {
            return false;
        }
    }

    function isMergedItem(item) {
        if (!item || typeof item.isMergedClip !== "function") return false;
        try {
            return Boolean(item.isMergedClip());
        } catch (e) {
            return false;
        }
    }

    function isOfflineItem(item) {
        if (!item || typeof item.isOffline !== "function") return false;
        try {
            return Boolean(item.isOffline());
        } catch (e) {
            return false;
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

    function hasProxySafe(item) {
        if (!item) return false;
        try {
            if (typeof item.hasProxy === "function") {
                return Boolean(item.hasProxy());
            }
        } catch (e) {}
        return false;
    }

    function getProxyPathSafe(item) {
        if (!item) return "";
        try {
            if (typeof item.hasProxy === "function" && !item.hasProxy()) return "";
            if (typeof item.getProxyPath === "function") {
                var p = item.getProxyPath();
                return p ? String(p) : "";
            }
        } catch (e) {}
        return "";
    }

    function extractProjectMetaTag(metaXml, columnSuffix) {
        if (!metaXml || !columnSuffix) return "";
        try {
            var rx = new RegExp("Column\\." + columnSuffix + "[^>]*>([^<]*)<", "i");
            var m = rx.exec(metaXml);
            return m && m[1] ? trimStr(m[1]) : "";
        } catch (e) {
            return "";
        }
    }

    function getItemProjectMetaSummary(item) {
        var out = { mediaType: "", videoFPS: "", videoInfo: "", audioInfo: "", filePathMeta: "" };
        if (!item || typeof item.getProjectMetadata !== "function") return out;
        try {
            var xml = item.getProjectMetadata();
            if (!xml) return out;
            out.mediaType = extractProjectMetaTag(xml, "Intrinsic\\.MediaType");
            out.videoFPS = extractProjectMetaTag(xml, "Intrinsic\\.VideoFPS");
            out.videoInfo = extractProjectMetaTag(xml, "Intrinsic\\.VideoInfo");
            out.audioInfo = extractProjectMetaTag(xml, "Intrinsic\\.AudioInfo");
            out.filePathMeta = extractProjectMetaTag(xml, "Intrinsic\\.FilePath");
        } catch (e) {}
        return out;
    }

    // Diferencia sequência de imagens numerada de imagem estática avulsa (ex.: Foto_01.png).
    function isImageSequencePath(item, pathStr, isProxy) {
        if (!pathStr) return false;
        var base = fileBaseFromPath(pathStr);
        var ext = fileExtFromPath(base);
        if (!contains(IMAGE_EXTS, ext)) return false;
        if (!/\d+\.[A-Za-z0-9]+$/.test(base)) return false;

        if (isProxy) {
            // Proxy em formato de imagem numerada só existe como sequência de frames
            return true;
        }

        if (item && item.name && /\[\d+\s*-\s*\d+\]/.test(String(item.name))) {
            return true;
        }

        var meta = getItemProjectMetaSummary(item);
        if (meta.mediaType) {
            if (/still|est[\u00e1a]tica|fija|fixe|standbild|fissa/i.test(meta.mediaType)) {
                return false;
            }
            if (/video|v[\u00edi]deo|movie|filme/i.test(meta.mediaType)) {
                return true;
            }
        }
        if (meta.videoFPS && /\d/.test(meta.videoFPS)) {
            return true;
        }
        return false;
    }

    // Varre a árvore de Bins a partir de rootItem para obter a cadeia de pastas real de cada item.
    function indexProjectTree() {
        var root = app.project.rootItem;
        var items = [];
        var foldersByNodeId = {};
        var folderLabelsByNodeId = {};
        var itemByNodeId = {};

        function walk(container, chain, labelChain) {
            if (!container || !container.children) return;
            var count = container.children.numItems || 0;
            for (var i = 0; i < count; i++) {
                var ch = container.children[i];
                if (!ch) continue;
                var nid = ch.nodeId ? String(ch.nodeId) : "";
                var chLabel = 0;
                try {
                    if (typeof ch.getColorLabel === "function") chLabel = ch.getColorLabel();
                } catch (eL) {}
                if (isBin(ch)) {
                    var nextChain = chain.slice(0);
                    nextChain.push(String(ch.name || ""));
                    var nextLabelChain = labelChain.slice(0);
                    nextLabelChain.push(chLabel);
                    if (nid) {
                        foldersByNodeId[nid] = chain.slice(0);
                        folderLabelsByNodeId[nid] = labelChain.slice(0);
                        itemByNodeId[nid] = ch;
                    }
                    walk(ch, nextChain, nextLabelChain);
                } else if (!isRoot(ch)) {
                    if (nid) {
                        foldersByNodeId[nid] = chain.slice(0);
                        folderLabelsByNodeId[nid] = labelChain.slice(0);
                        itemByNodeId[nid] = ch;
                    }
                    items.push(ch);
                }
            }
        }

        walk(root, [], []);
        return {
            items: items,
            foldersByNodeId: foldersByNodeId,
            folderLabelsByNodeId: folderLabelsByNodeId,
            itemByNodeId: itemByNodeId
        };
    }

    function buildSequenceByNodeIdMap() {
        var map = {};
        try {
            if (app.project && app.project.sequences && app.project.sequences.numSequences) {
                for (var i = 0; i < app.project.sequences.numSequences; i++) {
                    var seq = app.project.sequences[i];
                    if (seq && seq.projectItem && seq.projectItem.nodeId) {
                        map[String(seq.projectItem.nodeId)] = seq;
                    }
                }
            }
        } catch (e) {}
        return map;
    }

    // Obtém itens selecionados no painel Project mesmo quando a janela modeless do CEP ganhou foco.
    function getSelectedProjectItems() {
        var result = [];
        var seen = {};

        function addArr(arr) {
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
                addArr(app.getCurrentProjectViewSelection());
            }
        } catch (e1) {}

        if (result.length === 0) {
            try {
                if (typeof app.getProjectViewIDs === "function" && typeof app.getProjectViewSelection === "function") {
                    var viewIds = app.getProjectViewIDs();
                    if (viewIds && viewIds.length > 0) {
                        for (var v = 0; v < viewIds.length; v++) {
                            var vid = viewIds[v];
                            var sameProj = true;
                            try {
                                if (typeof app.getProjectFromViewID === "function" && app.project && app.project.documentID) {
                                    var vp = app.getProjectFromViewID(vid);
                                    if (vp && vp.documentID && vp.documentID !== app.project.documentID) {
                                        sameProj = false;
                                    }
                                }
                            } catch (eVp) {}
                            if (sameProj) {
                                addArr(app.getProjectViewSelection(vid));
                            }
                        }
                    }
                }
            } catch (e2) {}
        }

        return result;
    }

    function isIntrinsicComponent(matchName, displayName) {
        var m = String(matchName || "").toLowerCase();
        var d = String(displayName || "").toLowerCase();
        if (
            m === "adbe motion" ||
            m === "adbe opacity" ||
            m === "adbe time remapping" ||
            m === "adbe vector motion" ||
            m === "adbe volume" ||
            m === "adbe channel volume" ||
            m === "adbe audio balance"
        ) {
            return true;
        }
        if (
            d === "motion" || d === "movimento" ||
            d === "opacity" || d === "opacidade" ||
            d === "time remapping" || d === "remapeamento de tempo" ||
            d === "vector motion" || d === "movimento vetorial" ||
            d === "volume" ||
            d === "channel volume" || d === "volume do canal" ||
            d === "panner" || d === "balance" || d === "balan\u00e7o"
        ) {
            return true;
        }
        return false;
    }

    function collectTrackItemEffects(trackItem, effects) {
        if (!trackItem) return;
        try {
            if (!trackItem.components || !trackItem.components.numItems) return;
            for (var i = 0; i < trackItem.components.numItems; i++) {
                var comp = trackItem.components[i];
                if (!comp) continue;
                var mName = comp.matchName ? String(comp.matchName) : "";
                var dName = comp.displayName ? String(comp.displayName) : "";
                if (!mName && !dName) continue;
                if (isIntrinsicComponent(mName, dName)) continue;
                var key = mName || dName;
                if (!effects.map[key]) {
                    effects.map[key] = true;
                    effects.list.push({ matchName: key, name: dName || key });
                }
            }
        } catch (e) {}
    }

    function walkSequenceRecursive(seqObj, seqMap, visitedSeqs, usedItemsByNodeId, effects) {
        if (!seqObj) return;
        var seqKey = "";
        try {
            if (seqObj.projectItem && seqObj.projectItem.nodeId) {
                seqKey = String(seqObj.projectItem.nodeId);
            } else if (seqObj.sequenceID) {
                seqKey = "SID_" + String(seqObj.sequenceID);
            }
        } catch (eK) {}
        if (seqKey) {
            if (visitedSeqs[seqKey]) return;
            visitedSeqs[seqKey] = true;
        }

        function scanTracks(trackCollection) {
            if (!trackCollection || !trackCollection.numTracks) return;
            for (var t = 0; t < trackCollection.numTracks; t++) {
                var track = trackCollection[t];
                if (!track || !track.clips || !track.clips.numItems) continue;
                for (var c = 0; c < track.clips.numItems; c++) {
                    var clip = track.clips[c];
                    if (!clip) continue;
                    collectTrackItemEffects(clip, effects);
                    var pItem = null;
                    try { pItem = clip.projectItem; } catch (ePI) { pItem = null; }
                    if (!pItem || !pItem.nodeId) continue;
                    var nid = String(pItem.nodeId);
                    if (seqMap[nid] || isSequenceItem(pItem)) {
                        walkSequenceRecursive(seqMap[nid], seqMap, visitedSeqs, usedItemsByNodeId, effects);
                    } else {
                        usedItemsByNodeId[nid] = pItem;
                    }
                }
            }
        }

        try { scanTracks(seqObj.videoTracks); } catch (eV) {}
        try { scanTracks(seqObj.audioTracks); } catch (eA) {}
        try {
            if (seqObj.captionTracks) scanTracks(seqObj.captionTracks);
        } catch (eC) {}
    }

    function isCollectableMediaItem(item) {
        if (!item || isBin(item) || isRoot(item) || isSequenceItem(item)) return false;
        var mediaPath = getMediaPathSafe(item);
        if (mediaPath) return true;
        if (isOfflineItem(item)) return true;
        return false;
    }

    function isMogrtUnpackedPath(pathStr) {
        if (!pathStr) return false;
        if (/\.aegraphic$/i.test(pathStr)) return true;
        if (/Motion Graphics Template Media[\\\/]/i.test(pathStr)) return true;
        return false;
    }

    function resolveItemFolders(item, treeIndex, mediaPath) {
        var nid = item && item.nodeId ? String(item.nodeId) : "";
        if (nid && treeIndex.foldersByNodeId[nid]) {
            return treeIndex.foldersByNodeId[nid];
        }
        if (isMogrtUnpackedPath(mediaPath)) {
            return ["Motion Graphics Template Media"];
        }
        return [];
    }

    function itemToCollectJson(item, treeIndex) {
        var nid = item.nodeId ? String(item.nodeId) : "";
        var mediaPath = getMediaPathSafe(item);
        var offline = isOfflineItem(item);
        if (!mediaPath && offline) {
            var meta = getItemProjectMetaSummary(item);
            if (meta.filePathMeta) mediaPath = meta.filePathMeta;
        }
        var isSeq = isImageSequencePath(item, mediaPath, false);
        var proxyPath = getProxyPathSafe(item);
        var proxyIsSeq = proxyPath ? isImageSequencePath(item, proxyPath, true) : false;
        var isMogrt = isMogrtUnpackedPath(mediaPath);

        var folders = resolveItemFolders(item, treeIndex, mediaPath);
        var fParts = [];
        for (var i = 0; i < folders.length; i++) {
            fParts.push(q(folders[i]));
        }

        var parts = [];
        parts.push('"id":' + q(nid));
        parts.push('"name":' + q(item.name || ""));
        parts.push('"path":' + q(mediaPath));
        parts.push('"isSequence":' + (isSeq ? "true" : "false"));
        parts.push('"isMogrt":' + (isMogrt ? "true" : "false"));
        parts.push('"missing":' + ((offline || !mediaPath) ? "true" : "false"));
        parts.push('"folders":[' + fParts.join(",") + "]");
        parts.push('"proxyPath":' + q(proxyPath));
        parts.push('"proxyIsSequence":' + (proxyIsSeq ? "true" : "false"));
        parts.push('"useProxy":false');
        return "{" + parts.join(",") + "}";
    }

    /**
     * Scan somente leitura para a janela de Collect no Premiere Pro.
     * optionsJson: { "mode": "all" | "allComps" | "selected" | "none" }
     */
    $.global.ppro_collectScan = function (optionsJson) {
        try {
            if (!app.project || !app.project.rootItem) {
                return '{"success":false,"error":"Nenhum projeto aberto no Premiere Pro."}';
            }
            var opts = parseOptions(optionsJson);
            var mode = opts.mode || "all";
            var proj = app.project;

            var treeIndex = indexProjectTree();
            var seqMap = buildSequenceByNodeIdMap();

            // Sequências selecionadas no painel Project (ou dentro de Bins selecionadas)
            var selectedSeqs = [];
            var seenSelSeq = {};
            function addSelectedCandidate(cand) {
                if (!cand || !cand.nodeId) return;
                var nid = String(cand.nodeId);
                if (isSequenceItem(cand) || seqMap[nid]) {
                    if (!seenSelSeq[nid] && seqMap[nid]) {
                        seenSelSeq[nid] = true;
                        selectedSeqs.push(seqMap[nid]);
                    }
                } else if (isBin(cand) && cand.children) {
                    for (var b = 0; b < cand.children.numItems; b++) {
                        addSelectedCandidate(cand.children[b]);
                    }
                }
            }

            var selItems = getSelectedProjectItems();
            for (var s = 0; s < selItems.length; s++) {
                addSelectedCandidate(selItems[s]);
            }
            var selectedCount = selectedSeqs.length;

            var targetSeqs = [];
            if (mode === "selected") {
                if (opts.sequenceIds && opts.sequenceIds.length > 0) {
                    if (proj.sequences && proj.sequences.numSequences) {
                        for (var qIdx2 = 0; qIdx2 < proj.sequences.numSequences; qIdx2++) {
                            var sCand = proj.sequences[qIdx2];
                            if (sCand) {
                                var sCandId = String(sCand.sequenceID);
                                for (var sMatch = 0; sMatch < opts.sequenceIds.length; sMatch++) {
                                    if (sCandId === String(opts.sequenceIds[sMatch])) {
                                        targetSeqs.push(sCand);
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    selectedCount = targetSeqs.length;
                } else {
                    targetSeqs = selectedSeqs;
                }
            } else if (mode !== "none") {
                if (proj.sequences && proj.sequences.numSequences) {
                    for (var qIdx = 0; qIdx < proj.sequences.numSequences; qIdx++) {
                        if (proj.sequences[qIdx]) targetSeqs.push(proj.sequences[qIdx]);
                    }
                }
            }

            var allSeqParts = [];
            if (proj.sequences && proj.sequences.numSequences) {
                for (var sq = 0; sq < proj.sequences.numSequences; sq++) {
                    var sObj = proj.sequences[sq];
                    if (sObj) {
                        var sObjId = String(sObj.sequenceID);
                        var isSeqSel = false;
                        for (var sl = 0; sl < selectedSeqs.length; sl++) {
                            if (selectedSeqs[sl] && String(selectedSeqs[sl].sequenceID) === sObjId) {
                                isSeqSel = true;
                                break;
                            }
                        }
                        var sNodeId = (sObj.projectItem && sObj.projectItem.nodeId) ? String(sObj.projectItem.nodeId) : "";
                        var seqFolders = (sNodeId && treeIndex.foldersByNodeId && treeIndex.foldersByNodeId[sNodeId]) ? treeIndex.foldersByNodeId[sNodeId] : [];
                        var seqFolderLabels = (sNodeId && treeIndex.folderLabelsByNodeId && treeIndex.folderLabelsByNodeId[sNodeId]) ? treeIndex.folderLabelsByNodeId[sNodeId] : [];
                        var fSeqParts = [];
                        for (var fsq = 0; fsq < seqFolders.length; fsq++) {
                            fSeqParts.push(q(seqFolders[fsq]));
                        }
                        var sLabel = 0;
                        try {
                            if (sObj.projectItem && typeof sObj.projectItem.getColorLabel === "function") {
                                sLabel = sObj.projectItem.getColorLabel();
                            }
                        } catch (eSL) {}
                        allSeqParts.push('{"id":' + q(sObjId) + ',"sequenceID":' + q(sObjId) + ',"name":' + q(sObj.name || ("Sequência " + (sq + 1))) + ',"selected":' + (isSeqSel ? "true" : "false") + ',"label":' + sLabel + ',"folders":[' + fSeqParts.join(",") + '],"folderLabels":[' + seqFolderLabels.join(",") + ']}');
                    }
                }
            }

            var visitedSeqs = {};
            var usedItemsByNodeId = {};
            var effects = { map: {}, list: [] };

            if (mode !== "none") {
                for (var k = 0; k < targetSeqs.length; k++) {
                    walkSequenceRecursive(targetSeqs[k], seqMap, visitedSeqs, usedItemsByNodeId, effects);
                }
            }

            var collectItems = [];
            var seenCollectIds = {};
            if (mode === "all") {
                for (var a = 0; a < treeIndex.items.length; a++) {
                    var itAll = treeIndex.items[a];
                    if (isCollectableMediaItem(itAll)) {
                        var idAll = String(itAll.nodeId || a);
                        if (!seenCollectIds[idAll]) {
                            seenCollectIds[idAll] = true;
                            collectItems.push(itAll);
                        }
                    }
                }
            } else if (mode === "allComps" || mode === "selected") {
                for (var usedId in usedItemsByNodeId) {
                    if (usedItemsByNodeId.hasOwnProperty(usedId)) {
                        var itUsed = usedItemsByNodeId[usedId];
                        if (isCollectableMediaItem(itUsed) && !seenCollectIds[usedId]) {
                            seenCollectIds[usedId] = true;
                            collectItems.push(itUsed);
                        }
                    }
                }
            }

            var itemParts = [];
            for (var n = 0; n < collectItems.length; n++) {
                try {
                    itemParts.push(itemToCollectJson(collectItems[n], treeIndex));
                } catch (eItJson) {}
            }

            var fxParts = [];
            for (var f = 0; f < effects.list.length; f++) {
                fxParts.push(
                    '{"matchName":' + q(effects.list[f].matchName) +
                    ',"name":' + q(effects.list[f].name) + "}"
                );
            }

            var selectedSeqIdsJson = [];
            for (var sid = 0; sid < selectedSeqs.length; sid++) {
                if (selectedSeqs[sid] && selectedSeqs[sid].sequenceID) {
                    selectedSeqIdsJson.push(q(String(selectedSeqs[sid].sequenceID)));
                }
            }

            var projPath = proj.path ? String(proj.path) : "";
            var projName = proj.name ? String(proj.name) : fileBaseFromPath(projPath);
            var projSaved = false;
            if (projPath) {
                try { projSaved = new File(projPath).exists; } catch (eEx) { projSaved = true; }
            }

            var hasPreviewFolder = false;
            var hasAudioConformFolder = false;
            if (projPath) {
                try {
                    var pDir = fileDirFromPath(projPath);
                    hasPreviewFolder = new Folder(pDir + "/Adobe Premiere Pro Video Previews").exists;
                } catch (ePrv) {}
                try {
                    hasAudioConformFolder = new Folder(pDir + "/Adobe Premiere Pro Audio Previews").exists;
                } catch (eAud) {}
            }

            return "{" + [
                '"success":true',
                '"host":"PPRO"',
                '"mode":' + q(mode),
                '"projectName":' + q(projName),
                '"projectPath":' + q(projPath),
                '"projectSaved":' + (projSaved ? "true" : "false"),
                '"selectedCompCount":' + selectedCount,
                '"selectedSequenceIds":[' + selectedSeqIdsJson.join(",") + "]",
                '"allSequences":[' + allSeqParts.join(",") + "]",
                '"hasPreviewFolder":' + (hasPreviewFolder ? "true" : "false"),
                '"hasAudioConformFolder":' + (hasAudioConformFolder ? "true" : "false"),
                '"queuedCount":0',
                '"effectCount":' + effects.list.length,
                '"effects":[' + fxParts.join(",") + "]",
                '"items":[' + itemParts.join(",") + "]"
            ].join(",") + "}";
        } catch (err) {
            return '{"success":false,"error":' + q(err.toString()) + "}";
        }
    };

    $.global.ppro_collectSaveDialog = function (promptText, defaultPath, defaultName) {
        try {
            var f = null;
            if (defaultPath) {
                try { f = new Folder(defaultPath); } catch (eF) { f = null; }
            }
            var picked = Folder.selectDialog(promptText || "Selecione a pasta onde criar o Collect", f);
            if (!picked) return '{"success":false,"canceled":true}';
            var baseDir = String(picked.fsName).replace(/[\\\/]+$/, "");
            var sub = defaultName ? (baseDir + "/" + defaultName) : baseDir;
            return '{"success":true,"folderPath":' + q(new File(sub).fsName) + "}";
        } catch (err) {
            return '{"success":false,"error":' + q(err.toString()) + "}";
        }
    };

    $.global.ppro_collectSaveProject = function () {
        try {
            if (!app.project) return '{"success":false,"error":"Nenhum projeto aberto."}';
            app.project.save();
            return '{"success":true}';
        } catch (err) {
            return '{"success":false,"error":' + q(err.toString()) + "}";
        }
    };

    function normMediaKey(pathStr) {
        if (!pathStr) return "";
        return String(pathStr).replace(/\//g, "\\").replace(/\\+$/, "").toLowerCase();
    }

    function cleanEmptyBinsBottomUp(container) {
        if (!container || !container.children) return 0;
        var removed = 0;
        for (var idx = container.children.numItems - 1; idx >= 0; idx--) {
            var ch = container.children[idx];
            if (ch && isBin(ch)) {
                removed += cleanEmptyBinsBottomUp(ch);
                if (!ch.children || ch.children.numItems === 0) {
                    try {
                        ch.deleteBin();
                        removed++;
                    } catch (eDel) {}
                }
            }
        }
        return removed;
    }

    function reduceOpenPProProject(mode, selectedSequenceIds, treeIndex) {
        if (mode !== "selected" && mode !== "allComps") return 0;
        if (!app.project || !app.project.rootItem) return 0;

        var seqMap = buildSequenceByNodeIdMap();
        var keptSeqs = [];

        if (app.project.sequences && app.project.sequences.numSequences) {
            for (var s = 0; s < app.project.sequences.numSequences; s++) {
                var sq = app.project.sequences[s];
                if (!sq) continue;
                if (mode === "allComps") {
                    keptSeqs.push(sq);
                } else if (mode === "selected" && selectedSequenceIds && selectedSequenceIds.length > 0) {
                    var sid = sq.sequenceID ? String(sq.sequenceID) : "";
                    if (sid && contains(selectedSequenceIds, sid)) {
                        keptSeqs.push(sq);
                    }
                }
            }
        }

        // Proteção contra perda acidental caso nenhuma sequência alvo seja localizada
        if (keptSeqs.length === 0) return 0;

        var keepNodeIds = {};
        var keepMediaPaths = {};
        var visitedSeqKeys = {};

        function markSeqDependenciesRecursive(seqObj) {
            if (!seqObj) return;
            var sKey = "";
            try {
                if (seqObj.projectItem && seqObj.projectItem.nodeId) {
                    sKey = String(seqObj.projectItem.nodeId);
                    keepNodeIds[sKey] = true;
                } else if (seqObj.sequenceID) {
                    sKey = "SID_" + String(seqObj.sequenceID);
                }
            } catch (eKey) {}

            if (sKey) {
                if (visitedSeqKeys[sKey]) return;
                visitedSeqKeys[sKey] = true;
            }

            function markTrackCollection(trackCol) {
                if (!trackCol || !trackCol.numTracks) return;
                for (var t = 0; t < trackCol.numTracks; t++) {
                    var trk = trackCol[t];
                    if (!trk || !trk.clips || !trk.clips.numItems) continue;
                    for (var c = 0; c < trk.clips.numItems; c++) {
                        var clip = trk.clips[c];
                        if (!clip) continue;
                        var pItem = null;
                        try { pItem = clip.projectItem; } catch (ePI) { pItem = null; }
                        if (!pItem || !pItem.nodeId) continue;
                        var nid = String(pItem.nodeId);
                        keepNodeIds[nid] = true;
                        var mp = getMediaPathSafe(pItem);
                        if (mp) {
                            keepMediaPaths[normMediaKey(mp)] = true;
                        }
                        if (seqMap[nid] || isSequenceItem(pItem)) {
                            markSeqDependenciesRecursive(seqMap[nid]);
                        }
                    }
                }
            }

            try { markTrackCollection(seqObj.videoTracks); } catch (eV) {}
            try { markTrackCollection(seqObj.audioTracks); } catch (eA) {}
            try {
                if (seqObj.captionTracks) markTrackCollection(seqObj.captionTracks);
            } catch (eC) {}
        }

        for (var k = 0; k < keptSeqs.length; k++) {
            markSeqDependenciesRecursive(keptSeqs[k]);
        }

        var itemsToDelete = [];
        for (var i = 0; i < treeIndex.items.length; i++) {
            var cand = treeIndex.items[i];
            if (!cand || !cand.nodeId) continue;
            var cId = String(cand.nodeId);
            if (keepNodeIds[cId]) continue;
            var cPath = getMediaPathSafe(cand);
            if (cPath && keepMediaPaths[normMediaKey(cPath)]) continue;
            itemsToDelete.push(cand);
        }

        var reducedCount = 0;
        if (itemsToDelete.length > 0) {
            var tempTrashBin = app.project.rootItem.createBin("__TIDYFLOW_COLLECT_REDUCE_TMP__");
            if (tempTrashBin) {
                for (var d = 0; d < itemsToDelete.length; d++) {
                    try {
                        itemsToDelete[d].moveBin(tempTrashBin);
                        reducedCount++;
                    } catch (eMv) {}
                }
                try {
                    tempTrashBin.deleteBin();
                } catch (eDelBin) {}
            }
        }

        cleanEmptyBinsBottomUp(app.project.rootItem);
        return reducedCount;
    }

    /**
     * Finaliza o Collect no Premiere Pro:
     * 1. Fecha o projeto original (já salvo em disco previamente).
     * 2. Abre o arquivo .prproj reescrito pelo Node/CEP na pasta de destino.
     * 3. Restaura eventuais nomes personalizados de itens (por nodeId).
     * 4. Se reduceProject estiver ativo, remove itens/sequências não referenciados e limpa bins vazias.
     * 5. Salva o projeto coletado e mantém-no aberto para conferência.
     *
     * optionsJson: {
     *   finalPrprojPath: "...",
     *   origProjectPath: "...",
     *   itemNames: { "<nodeId>": "Nome Original" },
     *   mode: "all" | "allComps" | "selected" | "none",
     *   reduceProject: true | false,
     *   selectedSequenceIds: ["..."]
     * }
     */
    $.global.ppro_collectFinalize = function (optionsJson) {
        var opts = parseOptions(optionsJson);
        var closedOriginal = false;
        try {
            var finalPrprojPath = opts.finalPrprojPath || "";
            if (!finalPrprojPath) {
                return '{"success":false,"error":"Caminho final do projeto .prproj não informado."}';
            }
            var destFile = new File(finalPrprojPath);
            if (!destFile.exists) {
                return '{"success":false,"error":"Arquivo .prproj coletado não encontrado: ' + esc(destFile.fsName) + '"}';
            }

            var origPathLower = normMediaKey(opts.origProjectPath || "");

            // Fecha o projeto original antes de abrir a cópia para evitar conflito de mesmo ObjectUID
            if (app.project) {
                try {
                    app.project.closeDocument(false, false);
                    closedOriginal = true;
                } catch (eClose1) {
                    try {
                        app.project.closeDocument(0, 0);
                        closedOriginal = true;
                    } catch (eClose2) {}
                }
            }

            var targetFs = destFile.fsName;
            try {
                app.openDocument(targetFs, true, true, true, false);
            } catch (eOpen1) {
                app.openDocument(targetFs);
            }

            // Garante que apenas o projeto coletado permaneça aberto caso multi-projeto esteja ativo
            try {
                if (origPathLower && app.projects && app.projects.numProjects > 1) {
                    var targetLower = normMediaKey(targetFs);
                    for (var p = app.projects.numProjects - 1; p >= 0; p--) {
                        var candProj = app.projects[p];
                        if (!candProj || !candProj.path) continue;
                        var candLower = normMediaKey(candProj.path);
                        if (candLower === origPathLower && candLower !== targetLower) {
                            try { candProj.closeDocument(false, false); } catch (eClOld) {}
                        }
                    }
                }
            } catch (eMulti) {}

            var treeIndex = indexProjectTree();

            // Restaura nomes originais de itens no painel Project
            var itemNames = opts.itemNames || {};
            for (var idStr in itemNames) {
                if (itemNames.hasOwnProperty(idStr)) {
                    try {
                        var it = treeIndex.itemByNodeId[String(idStr)];
                        if (it && it.name !== itemNames[idStr]) {
                            it.name = itemNames[idStr];
                        }
                    } catch (eIt) {}
                }
            }

            var reducedCount = 0;
            if (opts.reduceProject === true) {
                reducedCount = reduceOpenPProProject(
                    opts.mode || "all",
                    opts.selectedSequenceIds || [],
                    treeIndex
                );
            }

            app.project.save();

            // Remove marcador .collect_in_progress por segurança caso ainda exista
            try {
                if (destFile.parent) {
                    var markerFile = new File(destFile.parent.fsName + "/.collect_in_progress");
                    if (markerFile.exists) markerFile.remove();
                }
            } catch (eRmMarker) {}

            // Se openCollected === false ("Apenas Exportar"), fecha a cópia coletada, reabre o projeto original e limpa o .prin
            if (opts.openCollected === false && opts.origProjectPath) {
                try {
                    var origRestoreFile = new File(opts.origProjectPath);
                    if (origRestoreFile.exists) {
                        try {
                            app.project.closeDocument(false, false);
                        } catch (eClCol1) {
                            try { app.project.closeDocument(0, 0); } catch (eClCol2) {}
                        }
                        try {
                            app.openDocument(origRestoreFile.fsName, true, true, true, false);
                        } catch (eOpOrig1) {
                            app.openDocument(origRestoreFile.fsName);
                        }
                        try {
                            var prinPath = String(destFile.fsName).replace(/\.prproj$/i, ".prin");
                            var prinFile = new File(prinPath);
                            if (prinFile.exists) prinFile.remove();
                        } catch (eRmPrin) {}
                    }
                } catch (eExportOnly) {}
            }

            return '{"success":true,"finalPrprojPath":' + q(destFile.fsName) + ',"reducedCount":' + reducedCount + "}";
        } catch (err) {
            if (closedOriginal && opts && opts.origProjectPath) {
                try {
                    var origFile = new File(opts.origProjectPath);
                    if (origFile.exists) {
                        try {
                            app.openDocument(origFile.fsName, true, true, true, false);
                        } catch (eRe1) {
                            app.openDocument(origFile.fsName);
                        }
                    }
                } catch (eReopen) {}
            }
            return '{"success":false,"error":' + q(err.toString()) + "}";
        }
    };

    $.global.ppro_collectReveal = function (folderFsPath) {
        return '{"success":true}';
    };
})();

