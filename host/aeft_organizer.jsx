$.global.aeft_organizeAEProject = function (mainCompId, configJsonString) {
    function escapeJsonString(str) {
        return String(str)
            .replace(/\\/g, "\\\\")
            .replace(/"/g, '\\"')
            .replace(/\r/g, "\\r")
            .replace(/\n/g, "\\n");
    }

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

    function getFileExtension(file) {
        if (!file || !file.name) return "";
        var name = file.name;
        var lastDot = name.lastIndexOf(".");
        if (lastDot === -1 || lastDot === name.length - 1) return "";
        return name.substring(lastDot + 1).toLowerCase();
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
            processedIds[targetFolder.id] = true;
            for (var idx = 1; idx <= targetFolder.numItems; idx++) {
                var subItem = targetFolder.item(idx);
                processedIds[subItem.id] = true;
                if (subItem instanceof FolderItem) {
                    registerFolderContents(subItem);
                }
            }
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

        // Identificar e validar Composições Alvo (Output)
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

                registerFolderContents(folder);
                protectedFolders.push(folder);
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

                    var subPath = [extUpper];
                    if (fileExt === "psd" || fileExt === "psb" || fileExt === "ai") {
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

$.global.aeft_getProjectComps = function () {
    function escapeJsonString(str) {
        return String(str)
            .replace(/\\/g, "\\\\")
            .replace(/"/g, '\\"')
            .replace(/\r/g, "\\r")
            .replace(/\n/g, "\\n");
    }

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
    function escapeJsonString(str) {
        return String(str)
            .replace(/\\/g, "\\\\")
            .replace(/"/g, '\\"')
            .replace(/\r/g, "\\r")
            .replace(/\n/g, "\\n");
    }

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

    app.beginUndoGroup("Verificar Composições");
    try {
        if (!app.project) {
            throw new Error("Nenhum projeto aberto no After Effects.");
        }

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
            var targetFolder = getOrCreateFolder([unusedFolderName]);
            for (var t = 0; t < toMove.length; t++) {
                var itemToMove = toMove[t];
                if (itemToMove.parentFolder !== targetFolder) {
                    itemToMove.parentFolder = targetFolder;
                    movedCount++;
                }
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
    function escapeJsonString(str) {
        return String(str)
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

    function applyLabelSafe(folderItem, labelIndex) {
        if (!folderItem) return;
        var num = parseInt(labelIndex, 10);
        if (!isNaN(num) && num >= 0 && num <= 16) {
            try {
                folderItem.label = num;
            } catch (e) {}
        }
    }

    function getFileExtension(file) {
        if (!file || !file.name) return "";
        var name = file.name;
        var lastDot = name.lastIndexOf(".");
        if (lastDot === -1 || lastDot === name.length - 1) return "";
        return name.substring(lastDot + 1).toLowerCase();
    }

    function isSameFolder(a, b) {
        if (!a || !b) return false;
        if (a === b) return true;
        if (a.id !== undefined && b.id !== undefined && a.id === b.id) return true;
        return false;
    }

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
            var foundFolder = null;
            for (var j = 1; j <= app.project.numItems; j++) {
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
            if (!foundFolder) {
                foundFolder = app.project.items.addFolder(folderName);
                foundFolder.parentFolder = currentParent;
                if (inheritLabel !== undefined && inheritLabel !== null) {
                    applyLabelSafe(foundFolder, inheritLabel);
                }
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
        return $.global.aeft_organizeAEProject(mainCompId, presetJsonString);
    }

    var settings = preset.settings || {};
    var usePrefixNumbering = (settings.usePrefixNumbering !== false);
    var deleteEmptyFolders = (settings.deleteEmptyFolders !== false);
    var saveProjectBefore = (settings.saveProjectBefore === true);
    var reduceProject = (settings.reduceProject === true);
    var unusedFolderName = settings.unusedFolderName || "Nunca Usadas";

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
        } catch (saveErr) {}
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

        // Cria ou reaproveita a pasta de um nó apenas sob demanda (Regra A3: nunca criar pastas vazias da árvore)
        function ensureNodeFolder(nodeId) {
            if (!nodeId || !nodeRecordById[nodeId]) return app.project.rootFolder;
            if (nodeFolderMap[nodeId]) return nodeFolderMap[nodeId];

            var rec = nodeRecordById[nodeId];
            var parentFolder = rec.parentId ? ensureNodeFolder(rec.parentId) : app.project.rootFolder;
            var cleanTargetName = stripNumericPrefix(rec.node.name);
            var cleanTargetLower = cleanTargetName.toLowerCase();

            var found = null;
            for (var i = 1; i <= app.project.numItems; i++) {
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

            if (!found) {
                found = app.project.items.addFolder(cleanTargetName);
                found.parentFolder = parentFolder;
            }

            applyLabelSafe(found, rec.node.label);
            nodeFolderMap[nodeId] = found;
            boundFolderIds[found.id] = true;
            return found;
        }

        // Helpers de avaliação de regras dos nós
        function matchesNameFilter(itemName, rules) {
            if (!rules || !rules.nameFilter) return false;
            var filterStr = String(rules.nameFilter).replace(/^\s+|\s+$/g, "");
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
                // Suporta termos separados por vírgula ou termo único
                var parts = filterStr.split(",");
                var nameLower = targetName.toLowerCase();
                for (var p = 0; p < parts.length; p++) {
                    var token = parts[p].replace(/^\s+|\s+$/g, "").toLowerCase();
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

        // Retorna { rec: nodeRecord, matchedViaCatchOthers: boolean } ou null
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
                    var hasNameRule = Boolean(rules.nameFilter && String(rules.nameFilter).replace(/^\s+|\s+$/g, "") !== "");

                    if (!hasTypes && !hasExts && !hasNameRule) {
                        continue; // Pasta puramente estrutural/contêiner (ex: Assets)
                    }

                    var typeOk = hasTypes ? nodeSupportsType(rules, typeToTest) : false;
                    var extOk = (hasExts && extLower) ? arrayContainsIgnoreCase(rules.extensions, extLower) : false;

                    // 1. Se o nó exige filtro de nome, só aceita se o nome bater
                    if (hasNameRule) {
                        if (!matchesNameFilter(itemName, rules)) {
                            continue;
                        }
                        if (hasTypes && !typeOk) {
                            continue;
                        }
                        if (hasExts && !extOk) {
                            continue;
                        }
                        // Prioridade máxima (Tier 1: 1000 + profundidade)
                        var nameScore = 1000 + rec.depth * 10;
                        if (nameScore > bestScore) {
                            bestScore = nameScore;
                            bestCandidate = { rec: rec, matchedViaCatchOthers: false };
                        }
                        continue;
                    }

                    // Para tipos sem extensão (MainComp, PreComps, Solids)
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

                    // Para mídias / arquivos com extensão
                    // Caso A: Nó tem apenas lista de extensões (sem tipo marcado) e a extensão bateu
                    if (!hasTypes && hasExts && extOk) {
                        var extOnlyScore = 850 + rec.depth * 10 - Math.min(rules.extensions.length, 50);
                        if (extOnlyScore > bestScore) {
                            bestScore = extOnlyScore;
                            bestCandidate = { rec: rec, matchedViaCatchOthers: false };
                        }
                        continue;
                    }

                    if (!typeOk) {
                        continue;
                    }

                    // Caso B: Tipo bateu e extensão explícita bateu
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

                    // Caso C: Tipo bateu e o nó não restringe extensões (aceita todas do tipo)
                    if (!hasExts && !rules.catchOthers) {
                        var openTypeScore = 400 + rec.depth * 10;
                        if (openTypeScore > bestScore) {
                            bestScore = openTypeScore;
                            bestCandidate = { rec: rec, matchedViaCatchOthers: false };
                        }
                        continue;
                    }

                    // Caso D: Pasta Coringa / Fallback (catchOthers = true)
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

            // Se ImageSequences ou DataFiles não tiverem nó dedicado no preset, faz fallback para Videos/Footages
            if (!bestCandidate && (itemType === "ImageSequences" || itemType === "DataFiles")) {
                evaluateForType("Videos");
            }

            return bestCandidate;
        }

        // Coleta todos os arrays de extensões configurados na árvore para auxiliar a classificação
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
            processedIds[targetFolder.id] = true;
            for (var idx = 1; idx <= targetFolder.numItems; idx++) {
                var subItem = targetFolder.item(idx);
                processedIds[subItem.id] = true;
                if (subItem instanceof FolderItem) {
                    registerFolderContents(subItem);
                }
            }
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

        // Reduce Project se ativo
        if (reduceProject && targetMainComps.length > 0) {
            try {
                reducedCount = app.project.reduceProject(targetMainComps);
            } catch (reduceErr) {}
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
                    if (psdBundleNodeRec.node.rules && psdBundleNodeRec.node.rules.groupSubfoldersByExt) {
                        destContainer = getOrCreateSubFolder(targetPsdNodeFolder, [detectedType], psdBundleNodeRec.node.label);
                    }

                    if (!isSameFolder(folder, destContainer) && !isSameFolder(folder.parentFolder, destContainer)) {
                        folder.parentFolder = destContainer;
                        movedFootages++;
                    }

                    registerFolderContents(folder);
                    protectedFolders.push(folder);
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
                                var preMatch = findMatchingNode("PreComps", "", src.name);
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
                var mainMatch = findMatchingNode("MainComp", "", mainComp.name);
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
                    var loosePreMatch = findMatchingNode("PreComps", "", item.name);
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
                    var solidMatch = findMatchingNode("Solids", "", item.name);
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

                    var fType = classifyFootageItem(item, fileExt);
                    var mediaMatch = findMatchingNode(fType, fileExt, item.name);
                    if (mediaMatch && mediaMatch.rec) {
                        var targetNode = mediaMatch.rec.node;
                        var nodeFolder = ensureNodeFolder(mediaMatch.rec.id);
                        var finalMediaFolder = nodeFolder;

                        if (targetNode.rules && targetNode.rules.groupSubfoldersByExt) {
                            var subFolderName = (mediaMatch.matchedViaCatchOthers || !fileExt)
                                ? "OTHERS"
                                : fileExt.toUpperCase();
                            var subPath = [subFolderName];

                            if (
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

        // 4. Limpar pastas vazias (se ativo)
        if (deleteEmptyFolders) {
            var removedAny = true;
            while (removedAny) {
                removedAny = false;
                for (var idx = app.project.numItems; idx >= 1; idx--) {
                    var candidateFolder = app.project.item(idx);
                    if (
                        candidateFolder instanceof FolderItem &&
                        candidateFolder.numItems === 0 &&
                        !isInsideProtectedFolder(candidateFolder)
                    ) {
                        candidateFolder.remove();
                        cleanedFolders++;
                        removedAny = true;
                    }
                }
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
                    var cleanN = stripNumericPrefix(n.name).toLowerCase();
                    for (var j = 1; j <= app.project.numItems; j++) {
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

                if (folder && folder.numItems > 0) {
                    activeEntries.push({
                        node: n,
                        folder: folder
                    });
                }
            }

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
    } finally {
        app.endUndoGroup();
    }
};

$.global.aeft_createPresetFolderStructure = function (presetJsonString) {
    function escapeJsonString(str) {
        return String(str)
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

    function stripNumericPrefix(name) {
        return String(name || "").replace(/^\d+[_-\s]+/, "");
    }

    function isSameFolder(a, b) {
        if (!a || !b) return false;
        if (a === b) return true;
        if (a.id !== undefined && b.id !== undefined && a.id === b.id) return true;
        return false;
    }

    function applyLabelSafe(folderItem, labelIndex) {
        if (!folderItem) return;
        var num = parseInt(labelIndex, 10);
        if (!isNaN(num) && num >= 0 && num <= 16) {
            try {
                folderItem.label = num;
            } catch (e) {}
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

        buildNodesInFolder(preset.tree, app.project.rootFolder);

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




