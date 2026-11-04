/* ==========================================================================
   TidyFlow â€” Motor ExtendScript LEGADO do After Effects (pre-presets)
   Extraido de aeft_organizer.jsx para reduzir o arquivo avaliado a cada reload.
   Carregado SOB DEMANDA por host/organizer.jsx (organizerLoadLegacyAE).
   Mantido apenas para compatibilidade com chamadas antigas (organizeAEProject).
   ========================================================================== */

/* Carrega as bibliotecas compartilhadas (host/_lib.jsx e host/_rules.jsx) */
(function () {
    try {
        var here = $.fileName ? new File($.fileName) : null;
        if (!here || !here.parent) return;
        var baseDir = here.parent.fsName;
        if (!$.global.OrgLib) {
            var libFile = new File(baseDir + "/_lib.jsx");
            if (libFile.exists) $.evalFile(libFile);
        }
        if (!$.global.OrgRules) {
            var rulesFile = new File(baseDir + "/_rules.jsx");
            if (rulesFile.exists) $.evalFile(rulesFile);
        }
    } catch (eLibLoad) {}
})();

$.global.aeft_organizeAEProject = function (mainCompId, configJsonString) {
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
                    (item.parentFolder === currentParent || (item.parentFolder && currentParent && item.parentFolder.id === currentParent.id)) &&
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

    function getOrCreateSubFolder(parentFolder, pathArray) {
        var currentParent = parentFolder;
        for (var i = 0; i < pathArray.length; i++) {
            var folderName = pathArray[i];
            var foundFolder = null;
            for (var j = 1; j <= app.project.numItems; j++) {
                var item = app.project.item(j);
                if (
                    item instanceof FolderItem &&
                    (item.parentFolder === currentParent || (item.parentFolder && currentParent && item.parentFolder.id === currentParent.id)) &&
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

    var CATEGORY_DEFS = [
        {
            type: "precomps",
            canonical: "PreComps",
            regex: /^(\d+[_-\s]*)?pre[-_]?comps?$/i
        },
        {
            type: "images",
            canonical: "Images",
            regex: /^(\d+[_-\s]*)?(images?|imagens?)$/i
        },
        {
            type: "footages",
            canonical: "Footages",
            regex: /^(\d+[_-\s]*)?(footages?|v[ií]deos?)$/i
        },
        {
            type: "audios",
            canonical: "Audios",
            regex: /^(\d+[_-\s]*)?(audios?|[aá]udios?)$/i
        },
        {
            type: "solids",
            canonical: "Solids",
            regex: /^(\d+[_-\s]*)?(solids?|s[oó]lidos?)$/i
        }
    ];

    function getCategoryFolder(assetsFolder, catType) {
        var def = null;
        for (var d = 0; d < CATEGORY_DEFS.length; d++) {
            if (CATEGORY_DEFS[d].type === catType) {
                def = CATEGORY_DEFS[d];
                break;
            }
        }
        if (!def) return assetsFolder;

        // Tentar reaproveitar pasta existente dentro de assetsFolder
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (
                item instanceof FolderItem &&
                (item.parentFolder === assetsFolder || (item.parentFolder && assetsFolder && item.parentFolder.id === assetsFolder.id)) &&
                def.regex.test(item.name)
            ) {
                return item;
            }
        }

        // Se não existir, cria com o nome canônico (o número sequencial será ajustado ao final)
        var newFolder = app.project.items.addFolder(def.canonical);
        newFolder.parentFolder = assetsFolder;
        return newFolder;
    }

    function isVideoExtension(extLower, extensionsMap) {
        if (!extLower) return false;
        var footagesList = (extensionsMap && extensionsMap.Footages) ? extensionsMap.Footages : [];
        for (var i = 0; i < footagesList.length; i++) {
            if (String(footagesList[i]).toLowerCase() === extLower) {
                return true;
            }
        }
        return /^(mp4|m4v|mov|qt|prores|avi|mkv|webm|mxf|mpg|mpeg|m1v|mpv|m2p|m2v|m2t|m2ts|mts|ts|vob|3gp|3g2|amc|dv|wmv|asf|flv|f4v|r3d|ari|braw|crm|cin|dpx|dng|hevc|h264|264|ogv|cine|yuv|dnxhd|dnxhr)$/i.test(extLower);
    }

    function isAudioExtension(extLower, extensionsMap) {
        if (!extLower) return false;
        var audiosList = (extensionsMap && (extensionsMap.Audios || extensionsMap.Audio)) ? (extensionsMap.Audios || extensionsMap.Audio) : [];
        for (var i = 0; i < audiosList.length; i++) {
            if (String(audiosList[i]).toLowerCase() === extLower) {
                return true;
            }
        }
        return /^(wav|bwf|mp3|mpa|mpe|aac|m4a|aif|aiff|flac|ogg|wma|mka)$/i.test(extLower);
    }

    function getItemCategory(item, ext, extensionsMap) {
        var extLower = ext ? String(ext).toLowerCase() : "";

        // 1. Áudio: se o After Effects informa áudio puro (sem vídeo) ou extensão de áudio
        if (item.hasAudio && !item.hasVideo) {
            return "audios";
        }
        if (isAudioExtension(extLower, extensionsMap)) {
            return "audios";
        }

        // 2. Vídeo / Footage:
        // Prioridade MÁXIMA para garantir que vídeos NUNCA entrem em imagens!
        // - Se a extensão for de vídeo (mp4, mov, avi, etc.)
        if (isVideoExtension(extLower, extensionsMap)) {
            return "footages";
        }

        // - After Effects: item possui vídeo e NÃO é imagem estática (isStill === false).
        // Cobre vídeos e sequências de imagens (ex: PNG seq, EXR seq, TGA seq) que se comportam como vídeo!
        if (item.hasVideo) {
            if (item.mainSource && typeof item.mainSource.isStill === "boolean") {
                if (item.mainSource.isStill === false) {
                    return "footages";
                }
            } else if (item.duration > 0 && item.frameRate > 0) {
                if (extLower !== "psd" && extLower !== "psb" && extLower !== "ai") {
                    return "footages";
                }
            }
        }

        // 3. Imagem estática:
        // - Deve ter extensão correspondente a imagens E se tiver mainSource, isStill deve ser true
        var isStill = true;
        if (item.mainSource && typeof item.mainSource.isStill === "boolean") {
            isStill = item.mainSource.isStill;
        } else if (item.duration > 0) {
            isStill = false;
        }

        if (isStill) {
            var imagesList = (extensionsMap && (extensionsMap.Images || extensionsMap.Imagens)) ? (extensionsMap.Images || extensionsMap.Imagens) : [];
            for (var i = 0; i < imagesList.length; i++) {
                if (String(imagesList[i]).toLowerCase() === extLower) {
                    return "images";
                }
            }
            if (/^(psd|psb|pdd|ai|eps|ps|pdf|png|jpg|jpeg|jpe|tif|tiff|bmp|rle|dib|svg|heif|heic|raw|cr2|cr3|nef|arw)$/i.test(extLower)) {
                return "images";
            }
        } else {
            return "footages";
        }

        return getCategoryTypeForExt(extLower, extensionsMap);
    }

    function getCategoryTypeForExt(ext, extensionsMap) {
        if (!ext) return "footages";
        var extLower = String(ext).toLowerCase();

        if (isVideoExtension(extLower, extensionsMap)) {
            return "footages";
        }
        if (isAudioExtension(extLower, extensionsMap)) {
            return "audios";
        }

        for (var category in extensionsMap) {
            if (extensionsMap.hasOwnProperty(category)) {
                if (/images?|imagens?/i.test(category)) {
                    var list = extensionsMap[category];
                    for (var i = 0; i < list.length; i++) {
                        if (String(list[i]).toLowerCase() === extLower) {
                            return "images";
                        }
                    }
                }
            }
        }

        return "footages";
    }

    function updateSequentialCategoryFolderNames(assetsFolder) {
        if (!assetsFolder || !(assetsFolder instanceof FolderItem)) return;

        // Mapear as pastas ativas de cada categoria com itens
        var activeFolders = [];
        for (var k = 0; k < CATEGORY_DEFS.length; k++) {
            var def = CATEGORY_DEFS[k];
            var found = null;
            for (var i = 1; i <= app.project.numItems; i++) {
                var sub = app.project.item(i);
                if (
                    sub instanceof FolderItem &&
                    (sub.parentFolder === assetsFolder || (sub.parentFolder && assetsFolder && sub.parentFolder.id === assetsFolder.id)) &&
                    def.regex.test(sub.name)
                ) {
                    if (sub.numItems > 0) {
                        found = sub;
                        break;
                    }
                }
            }
            if (found) {
                activeFolders.push({
                    folder: found,
                    canonical: def.canonical
                });
            }
        }

        // Numerar sequencialmente 01_, 02_, 03_, ...
        for (var a = 0; a < activeFolders.length; a++) {
            var seq = a + 1;
            var prefix = (seq < 10 ? "0" + seq : String(seq)) + "_";
            var finalName = prefix + activeFolders[a].canonical;
            if (activeFolders[a].folder.name !== finalName) {
                activeFolders[a].folder.name = finalName;
            }
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

    function isInsideFolder(item, targetFolder) {
        if (!item || !targetFolder) return false;
        var parent = item.parentFolder;
        while (parent && parent !== app.project.rootFolder) {
            if (parent === targetFolder || (parent && targetFolder && parent.id === targetFolder.id)) return true;
            parent = parent.parentFolder;
        }
        return false;
    }

    if (!app.project) {
        return '{"success": false, "error": "Nenhum projeto aberto no After Effects."}';
    }

    var config = parseConfig(configJsonString) || {};
    var saveProject = (config.saveProject === true);
    var reduceProject = (config.reduceProject === true);
    var deleteEmptyFolders = (config.deleteEmptyFolders !== false);

    var projectSaved = false;
    if (saveProject) {
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
        } catch (saveErr) {
            // Cancelamento da caixa de diálogo pelo usuário ou restrição de gravação
        }
    }

    app.beginUndoGroup("Organizar Projeto");
    try {
        var foldersCfg = config.folders || {};
        var outputFolderName = foldersCfg.output || "01_Output";
        var assetsFolderName = foldersCfg.assets || "02_Assets";
        var solidsFolderName = foldersCfg.solids || "Solids";
        var precompsFolderName = foldersCfg.precomps || "PreComps";
        var unusedFolderName = foldersCfg.unused || "Nunca Usadas";
        var extensionsCfg = config.extensions || {
            Images: [
                "psd", "psb", "pdd", "ai", "eps", "ps", "pdf", "png", "jpg", "jpeg", "jpe",
                "tif", "tiff", "bmp", "rle", "dib", "gif", "exr", "sxr", "mxr", "tga", "vda",
                "icb", "vst", "hdr", "rgbe", "xyze", "heif", "heic", "svg",
                "iff", "tdi", "sgi", "rgb", "bw", "pic", "rla", "rpf", "ei", "raw", "crw",
                "cr2", "cr3", "nef", "nrw", "arw", "srf", "sr2", "raf", "orf", "rw2", "pef",
                "x3f", "erf", "kdc", "dcr", "mos", "mrw", "iiq", "3fr", "fff", "srw",
                "gpr", "dxo", "arq", "rwl", "mfw", "mef"
            ],
            Footages: [
                "mp4", "m4v", "mov", "qt", "prores", "avi", "mkv", "webm", "mxf", "mpg",
                "mpeg", "m1v", "mpv", "m2p", "m2v", "m2t", "m2ts", "mts", "ts", "vob",
                "3gp", "3g2", "amc", "dv", "wmv", "asf", "flv", "f4v", "r3d", "ari",
                "braw", "crm", "cin", "dpx", "dng", "hevc", "h264", "264", "ogv", "cine",
                "yuv", "dnxhd", "dnxhr",
                "obj", "gltf", "glb", "fbx", "c4d",
                "json", "mgjson", "csv", "tsv", "jsx", "bvh",
                "prproj", "aep", "aepx", "aet"
            ],
            Audios: [
                "wav", "bwf", "mp3", "mpa", "mpe", "aac", "m4a", "aif", "aiff",
                "flac", "ogg", "wma", "mka"
            ]
        };

        // Identificar e validar Composições Alvo (Output) antes de modificar o projeto
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
        } else if (mainCompId !== null && mainCompId !== undefined && mainCompId !== "") {
            var targetId = Number(mainCompId);
            for (var m = 1; m <= app.project.numItems; m++) {
                var candidate = app.project.item(m);
                if (candidate instanceof CompItem && candidate.id === targetId) {
                    targetMainComps.push(candidate);
                    break;
                }
            }
        }

        if (typeof $.global.aeft_ensurePreOrganizeSnapshot === "function") {
            $.global.aeft_ensurePreOrganizeSnapshot();
        }

        var assetsFolder = getOrCreateFolder([assetsFolderName]);
        var processedIds = {};
        var protectedFolders = [];
        var movedComps = 0;
        var movedFootages = 0;
        var cleanedFolders = 0;
        var reducedCount = 0;

        function isInsideProtectedFolder(item) {
            for (var i = 0; i < protectedFolders.length; i++) {
                if (item === protectedFolders[i] || isInsideFolder(item, protectedFolders[i])) {
                    return true;
                }
            }
            return false;
        }

        function isManagedTaxonomyFolder(folder) {
            if (!folder || !(folder instanceof FolderItem)) return false;
            var parent = folder.parentFolder;
            if (parent === app.project.rootFolder || (parent && app.project.rootFolder && parent.id === app.project.rootFolder.id)) {
                return (
                    folder.name === outputFolderName ||
                    folder.name === assetsFolderName ||
                    folder.name === unusedFolderName
                );
            }
            return false;
        }

        function isMediaExtensionBucketFolder(folder) {
            if (!folder || !(folder instanceof FolderItem)) return false;
            var parent = folder.parentFolder;
            if (
                parent &&
                parent.parentFolder &&
                parent.parentFolder.parentFolder === app.project.rootFolder &&
                parent.parentFolder.name === assetsFolderName
            ) {
                return true;
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

        function cleanEmptyFolders() {
            var removedCount = 0;
            var removedAny = true;

            while (removedAny) {
                removedAny = false;
                for (var idx = app.project.numItems; idx >= 1; idx--) {
                    var candidateFolder = app.project.item(idx);
                    if (
                        candidateFolder instanceof FolderItem &&
                        candidateFolder.numItems === 0 &&
                        !isManagedTaxonomyFolder(candidateFolder) &&
                        !isInsideProtectedFolder(candidateFolder)
                    ) {
                        candidateFolder.remove();
                        removedCount++;
                        removedAny = true;
                    }
                }
            }

            return removedCount;
        }

        // Proteger a pasta Nunca Usadas e seus itens previamente organizados
        for (var u = 1; u <= app.project.numItems; u++) {
            var ufItem = app.project.item(u);
            if (
                ufItem instanceof FolderItem &&
                ufItem.parentFolder === app.project.rootFolder &&
                ufItem.name === unusedFolderName
            ) {
                protectedFolders.push(ufItem);
                registerFolderContents(ufItem);
                break;
            }
        }

        // Executar Reduce Project se solicitado e houver composições alvo
        if (reduceProject && targetMainComps.length > 0) {
            try {
                reducedCount = app.project.reduceProject(targetMainComps);
            } catch (reduceErr) {
                // Continua a organização mesmo se houver restrição no reduceProject nativo
            }
        }

        // 1. Tratar pastas nativas de PSD/AI (com ou sem pré-comps internas)
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
                isManagedTaxonomyFolder(folder) ||
                isMediaExtensionBucketFolder(folder) ||
                /^(\d+[_-\s]*)?pre[-_]?comps?$/i.test(folder.name)
            ) {
                continue;
            }

            var hasLayeredVectorOrPsd = false;
            var hasNonPsdAiItems = false;
            var detectedType = null; // "PSD" ou "AI"
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
                        if (internalComps[ic].parentFolder !== localPreCompFolder) {
                            internalComps[ic].parentFolder = localPreCompFolder;
                            movedComps++;
                        }
                        processedIds[internalComps[ic].id] = true;
                    }
                }

                var imgCatFolder = getCategoryFolder(assetsFolder, "images");
                var destNativeFolder = getOrCreateSubFolder(imgCatFolder, [detectedType]);
                if (folder !== destNativeFolder && folder.parentFolder !== destNativeFolder) {
                    folder.parentFolder = destNativeFolder;
                    movedFootages++;
                }

                protectedFolders.push(folder);
                registerFolderContents(folder);
            }
        }

        // 2. Coletar e processar Composições Principais (Output)
        if (targetMainComps.length > 0) {
            var outputFolder = getOrCreateFolder([outputFolderName]);
            var isOutputComp = {};
            for (var tc = 0; tc < targetMainComps.length; tc++) {
                isOutputComp[targetMainComps[tc].id] = true;
            }

            function processPreCompsForMain(currentComp, mainCompName, folderHolder, visitedMap) {
                for (var l = 1; l <= currentComp.numLayers; l++) {
                    var layer = currentComp.layer(l);
                    var src = layer.source;
                    if (src && src instanceof CompItem) {
                        if (isOutputComp[src.id]) {
                            continue;
                        }
                        if (!visitedMap[src.id]) {
                            visitedMap[src.id] = true;
                            if (!isInsideProtectedFolder(src)) {
                                if (!folderHolder.folder) {
                                    var precompsFolder = getCategoryFolder(assetsFolder, "precomps");
                                    folderHolder.folder = getOrCreateSubFolder(precompsFolder, [mainCompName]);
                                }
                                if (!processedIds[src.id]) {
                                    if (src.parentFolder !== folderHolder.folder) {
                                        src.parentFolder = folderHolder.folder;
                                        movedComps++;
                                    }
                                    processedIds[src.id] = true;
                                }
                            }
                            processPreCompsForMain(src, mainCompName, folderHolder, visitedMap);
                        }
                    }
                }
            }

            for (var mc = 0; mc < targetMainComps.length; mc++) {
                var mainComp = targetMainComps[mc];
                if (mainComp.parentFolder !== outputFolder) {
                    mainComp.parentFolder = outputFolder;
                    movedComps++;
                }
                processedIds[mainComp.id] = true;

                var folderHolder = { folder: null };
                var visitedComps = {};
                visitedComps[mainComp.id] = true;

                processPreCompsForMain(mainComp, mainComp.name, folderHolder, visitedComps);
            }
        }

        // 3. Para os itens restantes soltos no projeto
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
                    var precompsCat = getCategoryFolder(assetsFolder, "precomps");
                    var generalPreCompsFolder = getOrCreateSubFolder(precompsCat, ["Geral"]);
                    if (item.parentFolder !== generalPreCompsFolder) {
                        item.parentFolder = generalPreCompsFolder;
                        movedComps++;
                    }
                    processedIds[item.id] = true;
                }
            } else if (item instanceof FootageItem) {
                if (item.mainSource instanceof SolidSource) {
                    var solidsFolder = getCategoryFolder(assetsFolder, "solids");
                    if (item.parentFolder !== solidsFolder) {
                        item.parentFolder = solidsFolder;
                        movedFootages++;
                    }
                    processedIds[item.id] = true;
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

                    var extUpper = fileExt ? fileExt.toUpperCase() : "OUTROS";
                    var catType = getItemCategory(item, fileExt, extensionsCfg);
                    var catFolder = getCategoryFolder(assetsFolder, catType);

                    var srcFolder = "";
                    if (fileObj) {
                        if (fileObj.fsName) {
                            srcFolder = getParentFolderNameFromPath(fileObj.fsName);
                        }
                        if (!srcFolder && fileObj.parent && fileObj.parent.name) {
                            srcFolder = fileObj.parent.name;
                        }
                    }

                    var subPath = [extUpper];
                    if (srcFolder) {
                        subPath.push(srcFolder);
                    } else if (fileExt === "psd" || fileExt === "psb" || fileExt === "ai") {
                        var slashIndex = item.name.lastIndexOf("/");
                        if (slashIndex !== -1) {
                            var projectFileName = item.name.substring(slashIndex + 1);
                            if (projectFileName) {
                                subPath.push(projectFileName);
                            }
                        }
                    }

                    var mediaFolder = getOrCreateSubFolder(catFolder, subPath);
                    if (item.parentFolder !== mediaFolder) {
                        item.parentFolder = mediaFolder;
                        movedFootages++;
                    }
                    processedIds[item.id] = true;
                }
            }
        }

        // 4. Limpeza recursiva de pastas vazias / órfãs (executada DEPOIS de todos os itens serem movidos)
        if (deleteEmptyFolders) {
            cleanedFolders = cleanEmptyFolders();
        }

        // 5. Ajustar numeração sequencial das pastas de categorias em 02_Assets
        updateSequentialCategoryFolderNames(assetsFolder);

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
            (projectSaved ? 'true' : 'false') +
            "}"
        );
    } catch (err) {
        return '{"success": false, "error": "' + escapeJsonString(err.toString()) + '"}';
    } finally {
        app.endUndoGroup();
    }
};

