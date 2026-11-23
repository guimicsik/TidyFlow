/* ==========================================================================
   Project Organizer — Motor ExtendScript para Adobe Premiere Pro (22.x+)
   Compatível com ES3 ExtendScript (Premiere Pro 2022 / v22.0 em diante)
   ========================================================================== */

(function () {
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

    var escapeJsonString = $.global.OrgLib.escapeJsonString;

    var parseJson = $.global.OrgLib.parseJson;

    // --- Fronteira de desfazer (undo) ---
    // As operacoes destrutivas (organizar, criar estrutura, rollback) devem formar
    // um unico passo de desfazer no Premiere Pro, como ja acontece no After Effects.
    // app.beginUndoGroup/endUndoGroup sao detectados em tempo de execucao para
    // nao quebrar em versoes do host onde a API nao exista.
    function ppro_supportsUndoGroup() {
        try {
            return Boolean(
                app &&
                typeof app.beginUndoGroup === "function" &&
                typeof app.endUndoGroup === "function"
            );
        } catch (eUndoCheck) {
            return false;
        }
    }

    function ppro_beginUndoGroup(label) {
        if (!ppro_supportsUndoGroup()) return;
        try {
            app.beginUndoGroup(label || "TidyFlow");
        } catch (eBeginUndo) { }
    }

    function ppro_endUndoGroup() {
        if (!ppro_supportsUndoGroup()) return;
        try {
            app.endUndoGroup();
        } catch (eEndUndo) { }
    }

    // --- Cache por operacao (Fase 3) ---
    // As trilhas das sequencias nao mudam durante a organizacao; sem cache,
    // inspectSequenceTracks era reexecutado para a mesma sequencia em varios fluxos.
    var _seqMapCache = null;
    var _seqTracksCache = {};

    $.global.ppro_resetSequenceCache = function () {
        _seqMapCache = null;
        _seqTracksCache = {};
    };

    // Hook de diagnostico: defina $.global._pproDebug = function(msg){...} para rastrear decisoes.
    // O buffer em memoria guarda as ultimas decisoes e vai no JSON de resposta
    // (debugTrace), para explicar uma organizacao que "nao fez nada".
    var _pproDebugBuffer = [];
    var _PPRO_DEBUG_MAX = 120;

    function ppro_debugReset() {
        _pproDebugBuffer = [];
    }

    function ppro_debugTrace() {
        return _pproDebugBuffer.join(" | ");
    }

    $.global.ppro_getDebugTrace = function () {
        return ppro_debugTrace();
    };

    function _dbg(msg) {
        var text = String(msg);
        try {
            if (_pproDebugBuffer.length >= _PPRO_DEBUG_MAX) {
                _pproDebugBuffer.shift();
            }
            _pproDebugBuffer.push(text);
        } catch (eBuf) { }
        try {
            if ($.global.pproDebugEnabled && $.global._pproDebug) $.global._pproDebug(text);
        } catch (eDbg) { }
    }

    var trimStr = $.global.OrgLib.trimStr;

    var stripNumericPrefix = $.global.OrgLib.stripNumericPrefix;

    var arrayContains = $.global.OrgLib.arrayContains;

    var arrayContainsIgnoreCase = $.global.OrgLib.arrayContainsIgnoreCase;

    var Lib = $.global.OrgLib;

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
                // Só aplica se a cor mudou: evita entrada de undo e chamada IPC desnecessária
                var currentColor = (typeof projectItem.getColorLabel === "function") ? projectItem.getColorLabel() : -1;
                if (currentColor !== pproColorIndex) {
                    projectItem.setColorLabel(pproColorIndex);
                }
            } catch (e) { }
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
        } catch (e) { }
        return false;
    }

    function renameBinSafe(binItem, newName) {
        if (!binItem || !newName) return;
        try {
            if (binItem.name === newName) return;
        } catch (e0) { }
        try {
            if (typeof binItem.renameBin === "function") {
                binItem.renameBin(newName);
            } else {
                binItem.name = newName;
            }
        } catch (e1) {
            try {
                binItem.name = newName;
            } catch (e2) { }
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

    function getFileNameFromPath(filePath) {
        if (!filePath) return "";
        var clean = String(filePath).replace(/\\/g, "/");
        var lastSlash = clean.lastIndexOf("/");
        return lastSlash === -1 ? clean : clean.substring(lastSlash + 1);
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
        } catch (e) { }
        return "";
    }

    function buildSequenceMap() {
        if (_seqMapCache) return _seqMapCache;
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
        } catch (e) { }
        _seqMapCache = map;
        return map;
    }

    function inspectSequenceTracks(seqObj) {
        // Cache por sequencia dentro da operacao (as trilhas nao mudam durante a organizacao)
        var cacheKey = null;
        try {
            if (seqObj && seqObj.projectItem && seqObj.projectItem.nodeId) {
                cacheKey = String(seqObj.projectItem.nodeId);
                if (_seqTracksCache[cacheKey]) return _seqTracksCache[cacheKey];
            }
        } catch (eKey) { }

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
                    } catch (errClip) { }
                }
            }
        }

        try { scanTrackCollection(seqObj.videoTracks); } catch (eV) { }
        try { scanTrackCollection(seqObj.audioTracks); } catch (eA) { }
        try {
            if (seqObj.captionTracks) {
                scanTrackCollection(seqObj.captionTracks);
            }
        } catch (eC) { }

        var result = {
            items: referencedProjectItems,
            totalClips: totalClipInstances
        };
        if (cacheKey) _seqTracksCache[cacheKey] = result;
        _dbg("inspectSequenceTracks " + (cacheKey || "?") + " -> itens=" + referencedProjectItems.length + " clips=" + totalClipInstances);
        return result;
    }

    // --- Dicionarios e Helpers de Classificacao de Audio (ES3 estrito: barra escapada em [...]) ---
    var AUDIO_SEP_RX = /[\-_.:\/\\+,;()\[\]]/g;
    var RX_AUDIO_DIALOGUE = /\b(dialogue|dialogo|di[\u00e1a]logo|dialog|voz|voice|voiceover|fala|dx|entrevista|interview|locucao|locu[\u00e7c][\u00e3a]o|narracao|narra[\u00e7c][\u00e3a]o|narration|narrator|depoimento|lapela|lavalier|lav|boom[-_ ]?mic|mic|podcast|speech|vo)\b/i;
    var RX_AUDIO_MUSIC = /\b(music|musica|m[\u00fau]sica|bgm|soundtrack|trilha|song|beat|instrumental|no[-_ ]?(?:lead[-_ ]?)?vocals?|backing[-_ ]?(?:track|vocals?)|stems?|remix|theme|ost|score|jingle|mx)\b/i;
    var RX_AUDIO_AMBIENCE_EXPLICIT = /\b(ambience|ambient|ambiente|amb|room[-_ ]?tone|atmos|atmosphere|atmosfera|city[-_ ]?ambience|night[-_ ]?ambience)\b/i;
    var RX_AUDIO_SFX = /\b(sfx|fx|sound[-_ ]?effects?|efeitos?|foley|whoosh|woosh|swoosh|swooshes|swish|snaps?|flaps?|hits?|hit|impacts?|impact|impacto|riser|downer|braam|sub[-_ ]?boom|boom|transicao|transi[\u00e7c][\u00e3a]o|pop|click|clicks|beep|ui|infographics?|explosion|explos[\u00e3a]o|punch|brawl|fight|weapons?|sword|glitch|steps?|footsteps?|passos|walking|sneakers?|heels?|shoe|shoes|cloth|clothing|leather|jacket|pants|undressed|rubbing|fabric|movements?|pillow|fluffing|door|slam|knock|paper|carbon|buzz)\b/i;
    var RX_AUDIO_AMBIENCE_ENV = /\b(vento|wind|rain|chuva|thunder|trov[\u00e3a]o|nature|natureza|forest|floresta|ocean|sea|waves|birds|passaros|p[\u00e1a]ssaros|traffic|crowd|multid[\u00e3a]o|background[-_ ]?noise)\b/i;
    var RX_AUDIO_MUSIC_GENRE = /\b(pop|rock|indie|electronic|electro|edm|house|techno|hip[-_ ]?hop|rap|trap|rnb|soul|funk|jazz|blues|classical|orchestral|cinematic|acoustic|folk|country|lofi|lo[-_ ]?fi|reggae|latin|bossa|samba|sertanejo|forr[\u00f3o]|mpb|metal|punk|disco|synthwave|chillout|chill|downtempo|corporate|uplifting|inspirational)\b/i;

    function cleanAudioTokens(rawStr) {
        if (!rawStr) return "";
        return " " + String(rawStr).replace(AUDIO_SEP_RX, " ") + " ";
    }

    function matchAudioRoleKeywords(rawStr) {
        if (!rawStr) return "";
        var cleaned = cleanAudioTokens(rawStr);
        if (RX_AUDIO_DIALOGUE.test(cleaned)) return "Dialogue";
        if (RX_AUDIO_MUSIC.test(cleaned)) return "Music";
        if (RX_AUDIO_AMBIENCE_EXPLICIT.test(cleaned)) return "Ambience";
        if (RX_AUDIO_SFX.test(cleaned)) return "SFX";
        if (RX_AUDIO_AMBIENCE_ENV.test(cleaned)) return "Ambience";
        return "";
    }

    function matchExplicitEssentialSoundTag(rawStr) {
        if (!rawStr) return "";
        var s = String(rawStr);
        if (/(?:audioRole|audioCategory|soundType|audioType|audio_type|sound_type|essentialSound|dvaessential|presetType|"role"|"tag"|"type"|"category")[^A-Za-z0-9]{1,24}(?:Dialogue|Dialog|Speech|Voice)/i.test(s)) {
            return "Dialogue";
        }
        if (/(?:audioRole|audioCategory|soundType|audioType|audio_type|sound_type|essentialSound|dvaessential|presetType|"role"|"tag"|"type"|"category")[^A-Za-z0-9]{1,24}(?:Music|Song|Score)/i.test(s)) {
            return "Music";
        }
        if (/(?:audioRole|audioCategory|soundType|audioType|audio_type|sound_type|essentialSound|dvaessential|presetType|"role"|"tag"|"type"|"category")[^A-Za-z0-9]{1,24}(?:SFX|Sound[-_ ]?Effects?)/i.test(s)) {
            return "SFX";
        }
        if (/(?:audioRole|audioCategory|soundType|audioType|audio_type|sound_type|essentialSound|dvaessential|presetType|"role"|"tag"|"type"|"category")[^A-Za-z0-9]{1,24}(?:Ambience|Ambient|Atmosphere)/i.test(s)) {
            return "Ambience";
        }
        return "";
    }

    function extractXmpFieldValues(xmlStr, fieldNameRx) {
        if (!xmlStr) return "";
        var values = [];
        var elRx = /<([A-Za-z0-9_.:-]+)(?:\s[^>]*)?>([^<\r\n]+)<\/[A-Za-z0-9_.:-]+>/g;
        var m;
        while ((m = elRx.exec(xmlStr)) !== null) {
            var tName = m[1] || "";
            var tVal = String(m[2] || "").replace(/^\s+|\s+$/g, "");
            if (tVal && fieldNameRx.test(tName)) {
                values.push(tVal);
            }
        }
        var attrRx = /\b([A-Za-z0-9_.:-]+)="([^"\r\n]+)"/g;
        var ma;
        while ((ma = attrRx.exec(xmlStr)) !== null) {
            var aName = ma[1] || "";
            var aVal = String(ma[2] || "").replace(/^\s+|\s+$/g, "");
            if (aVal && fieldNameRx.test(aName)) {
                values.push(aVal);
            }
        }
        return values.join(" ; ");
    }

    function extractXmpDcBagText(xmpStr) {
        if (!xmpStr) return "";
        var values = [];
        var blockRx = /<dc:(description|subject|title)\b[\s\S]*?<\/dc:\1>/gi;
        var bm;
        while ((bm = blockRx.exec(xmpStr)) !== null) {
            var block = bm[0] || "";
            var liRx = /<rdf:li(?:\s[^>]*)?>([^<]+)<\/rdf:li>/gi;
            var lm;
            while ((lm = liRx.exec(block)) !== null) {
                var liVal = String(lm[1] || "").replace(/^\s+|\s+$/g, "");
                if (liVal) values.push(liVal);
            }
        }
        return values.join(" ; ");
    }

    function getAncestorFolderNamesFromPath(pathStr, maxLevels) {
        if (!pathStr) return [];
        var normalized = String(pathStr).replace(/\\/g, "/").replace(/\/+$/, "");
        var lastSlash = normalized.lastIndexOf("/");
        if (lastSlash <= 0) return [];
        var dirPart = normalized.substring(0, lastSlash);
        var parts = dirPart.split("/");
        var result = [];
        var limit = maxLevels || 3;
        var genericRx = /^(\d+[_\-\s]*)?(audios?|wav|bwf|mp3|aif|aiff|flac|ogg|m4a|assets?|media|m[\u00edi]dias?|files?|footages?|imports?|downloads?|desktop|documents?|users)$/i;
        for (var i = parts.length - 1; i >= 0 && result.length < limit; i--) {
            var seg = String(parts[i] || "").replace(/^\s+|\s+$/g, "");
            if (!seg || /^[A-Za-z]:$/.test(seg)) continue;
            if (/^users$/i.test(seg)) break;
            if (genericRx.test(seg)) continue;
            result.push(seg);
        }
        return result;
    }

    function matchComponentAudioRole(comp) {
        if (!comp) return "";
        var mName = comp.matchName ? String(comp.matchName) : "";
        var dName = comp.displayName ? String(comp.displayName) : "";
        var compSig = (mName + " " + dName).toLowerCase();

        if (/(speechenhancer|enhance speech|vocal enhancer|speech|de-?noise|denoise|de-?hum|dehum|de-?reverb|dereverb|reduce reverb|de-?ess|deess|clarity|dialogue)/i.test(compSig)) {
            return "Dialogue";
        }
        if (/(ducking|auto-?duck|remix|music|stretch|duration)/i.test(compSig)) {
            return "Music";
        }
        if (/(ambience|roomtone|room tone|stereo width|wind removal|environment|atmos)/i.test(compSig)) {
            return "Ambience";
        }
        if (/(soundeffect|sfx|reverb|studioreverb|creative|distortion|delay|flanger|chorus)/i.test(compSig)) {
            return "SFX";
        }

        // Ignorar componentes intrinsecos padrao de todo clipe (Volume, Channel Volume, Panner, Balance)
        if (/^(adbe\s+)?(volume|channel volume|panner|balance)(\s+.*)?$/i.test(mName) || /^(volume|channel volume|panner|balance)$/i.test(dName)) {
            return "";
        }

        // Inspecionar propriedades/parametros de componentes extras (ex.: Essential Sound / Sweetening)
        try {
            if (comp.properties && comp.properties.numItems) {
                for (var p = 0; p < comp.properties.numItems; p++) {
                    var prop = comp.properties[p];
                    if (!prop) continue;
                    var pName = prop.displayName ? String(prop.displayName) : "";
                    var pValStr = "";
                    try {
                        if (typeof prop.getValue === "function") {
                            var rawVal = prop.getValue();
                            if (typeof rawVal === "string" && rawVal.length > 0 && rawVal.length < 8000) {
                                pValStr = rawVal;
                            }
                        }
                    } catch (ePropVal) { }

                    if (pValStr) {
                        var explicitFromProp = matchExplicitEssentialSoundTag(pValStr);
                        if (explicitFromProp) return explicitFromProp;
                        var cleanVal = pValStr.replace(/^\s+|\s+$/g, "");
                        if (/^(dialogue|dialog)$/i.test(cleanVal)) return "Dialogue";
                        if (/^music$/i.test(cleanVal)) return "Music";
                        if (/^(sfx|sound\s*effects?)$/i.test(cleanVal)) return "SFX";
                        if (/^(ambience|ambient)$/i.test(cleanVal)) return "Ambience";
                    }
                    if (pName) {
                        if (/(enhance speech|vocal enhancer|reduce noise|reduce reverb|dehum|deess|clarity)/i.test(pName)) return "Dialogue";
                        if (/(ducking|duck against|remix)/i.test(pName)) return "Music";
                        if (/(stereo width|wind removal)/i.test(pName)) return "Ambience";
                    }
                }
            }
        } catch (eProps) { }

        return "";
    }

    function buildTimelineAudioMap() {
        var map = {};
        var prioMap = {};
        function assignMapKey(key, role, prio) {
            if (!key || !role) return;
            if (!prioMap[key] || prio >= prioMap[key]) {
                map[key] = role;
                prioMap[key] = prio;
            }
        }

        try {
            if (!app.project || !app.project.sequences) {
                return map;
            }
            var numSeqs = app.project.sequences.numSequences || 0;
            var seqList = [];
            var seenSeqIds = {};

            function registerSeq(seq) {
                if (!seq) return;
                var sKey = "";
                try {
                    if (seq.projectItem && seq.projectItem.nodeId) {
                        sKey = seq.projectItem.nodeId;
                    } else if (seq.id !== undefined && seq.id !== null) {
                        sKey = "ID_" + seq.id;
                    } else if (seq.name) {
                        sKey = "NAME_" + seq.name;
                    }
                } catch (eKey) { }
                if (!sKey) sKey = "SEQ_" + seqList.length;

                if (!seenSeqIds[sKey]) {
                    seenSeqIds[sKey] = true;
                    seqList.push(seq);
                }
            }

            var activeSeq = null;
            try { activeSeq = app.project.activeSequence; } catch (eAct) { }
            if (activeSeq) {
                registerSeq(activeSeq);
            }

            for (var s = 0; s < numSeqs; s++) {
                try {
                    var sCand = app.project.sequences[s];
                    if (sCand) {
                        registerSeq(sCand);
                    }
                } catch (eCand) { }
            }

            for (var si = 0; si < seqList.length; si++) {
                var currentSeq = seqList[si];
                if (!currentSeq || !currentSeq.audioTracks) continue;
                var trackCount = currentSeq.audioTracks.numTracks || 0;

                for (var t = 0; t < trackCount; t++) {
                    var track = currentSeq.audioTracks[t];
                    if (!track) continue;

                    var trackCategory = "";
                    if (track.name) {
                        var tClean = cleanAudioTokens(track.name);
                        if (/\b(dialogue|dialog|voz|voice|fala|dx|entrevista|interview|locucao|locu[\u00e7c][\u00e3a]o|speech|vo)\b/i.test(tClean)) {
                            trackCategory = "Dialogue";
                        } else if (/\b(music|musica|m[\u00fau]sica|trilha|mx|bgm|soundtrack|song|beat|score)\b/i.test(tClean)) {
                            trackCategory = "Music";
                        } else if (/\b(sfx|fx|sound[-_ ]?effects?|efeitos?|foley)\b/i.test(tClean)) {
                            trackCategory = "SFX";
                        } else if (/\b(ambience|ambient|ambiente|amb|atmos|room[-_ ]?tone|atmosfera)\b/i.test(tClean)) {
                            trackCategory = "Ambience";
                        }
                    }

                    if (!track.clips || !track.clips.numItems) continue;

                    for (var c = 0; c < track.clips.numItems; c++) {
                        var clip = track.clips[c];
                        if (!clip) continue;

                        var pItem = null;
                        try { pItem = clip.projectItem; } catch (ePI) { }

                        var clipCategory = "";
                        try {
                            if (clip.components && clip.components.numItems) {
                                for (var cp = 0; cp < clip.components.numItems; cp++) {
                                    clipCategory = matchComponentAudioRole(clip.components[cp]);
                                    if (clipCategory) break;
                                }
                            }
                        } catch (eComp) { }

                        var finalCategory = clipCategory || trackCategory;
                        var prio = clipCategory ? 2 : 1;
                        if (finalCategory) {
                            if (pItem) {
                                if (pItem.nodeId) {
                                    assignMapKey(pItem.nodeId, finalCategory, prio);
                                }
                                var pMediaPath = getMediaPathSafe(pItem);
                                if (pMediaPath) {
                                    assignMapKey(pMediaPath, finalCategory, prio);
                                }
                                if (pItem.name) {
                                    assignMapKey("NAME:" + pItem.name, finalCategory, prio);
                                }
                            }
                            if (clip.name) {
                                assignMapKey("NAME:" + clip.name, finalCategory, prio);
                            }
                        }
                    }
                }
            }
        } catch (eTimeline) { }

        return map;
    }

    function classifyAudioRole(item, timelineAudioMap, nameCandidates) {
        if (!item) return "";

        var mPath = getMediaPathSafe(item);

        // 1. Prioridade Maxima: Timeline & Essential Sound
        if (timelineAudioMap) {
            if (item.nodeId && timelineAudioMap[item.nodeId]) {
                return timelineAudioMap[item.nodeId];
            }
            if (mPath && timelineAudioMap[mPath]) {
                return timelineAudioMap[mPath];
            }
            if (item.name && timelineAudioMap["NAME:" + item.name]) {
                return timelineAudioMap["NAME:" + item.name];
            }
        }

        // 2. Tags explicitas de Essential Sound / AudioRole em XMP e notas do usuario no Projeto
        var xmpCached = "";
        try {
            if (typeof item.getXMPMetadata === "function") {
                xmpCached = item.getXMPMetadata() || "";
                if (xmpCached) {
                    var explicitXmpRole = matchExplicitEssentialSoundTag(xmpCached);
                    if (explicitXmpRole) return explicitXmpRole;
                }
            }
        } catch (eXMP) { }

        try {
            if (typeof item.getProjectMetadata === "function") {
                var metaXml = item.getProjectMetadata();
                if (metaXml) {
                    var explicitProjRole = matchExplicitEssentialSoundTag(metaXml);
                    if (explicitProjRole) return explicitProjRole;
                    // Extrair APENAS valores preenchidos em colunas de notas/categoria (nunca tags XML vazias como Column.PropertyText.Dialog!)
                    var userMetaValues = extractXmpFieldValues(
                        metaXml,
                        /(?:^|[.:])(?:LogNote|Description|Comment|SoundRoll|EssentialSound|AudioRole|AudioType|SoundType|AudioCategory|Category|Genre)$/i
                    );
                    if (userMetaValues) {
                        var roleFromProjMeta = matchAudioRoleKeywords(userMetaValues);
                        if (roleFromProjMeta) return roleFromProjMeta;
                    }
                }
            }
        } catch (eMeta) { }

        // 3. Nome proprio do clipe e nome do arquivo em disco (antes de pasta generica)
        if (item.name) {
            var roleByItemName = matchAudioRoleKeywords(item.name);
            if (roleByItemName) return roleByItemName;
        }
        var diskFileName = mPath ? getFileNameFromPath(mPath) : "";
        if (diskFileName && diskFileName !== item.name) {
            var roleByDiskFile = matchAudioRoleKeywords(diskFileName);
            if (roleByDiskFile) return roleByDiskFile;
        }

        // 4. Metadados XMP descritivos embutidos no arquivo (BWF, ID3, RIFF, Artlist, Soundly: genre, description, BPM/tempo)
        if (xmpCached) {
            try {
                var dcBagText = extractXmpDcBagText(xmpCached);
                var xmpDescText = extractXmpFieldValues(
                    xmpCached,
                    /(?:^|:)(?:genre|album|logComment|instrument|description|comment|subject|IGNR|ICMT|ISBJ)$/i
                );
                var combinedXmpDesc = (dcBagText ? dcBagText + " ; " : "") + xmpDescText;
                if (combinedXmpDesc) {
                    var roleFromXmpDesc = matchAudioRoleKeywords(combinedXmpDesc);
                    if (roleFromXmpDesc) return roleFromXmpDesc;
                }
                var xmpGenreOnly = extractXmpFieldValues(xmpCached, /(?:^|:)(?:genre|IGNR)$/i);
                if (xmpGenreOnly && RX_AUDIO_MUSIC_GENRE.test(cleanAudioTokens(xmpGenreOnly))) {
                    return "Music";
                }
                var xmpTempo = extractXmpFieldValues(xmpCached, /(?:^|:)(?:tempo|bpm|beatsPerMinute)$/i);
                if (xmpTempo) {
                    var bpmNum = parseFloat(xmpTempo);
                    if (!isNaN(bpmNum) && bpmNum >= 30 && bpmNum <= 300) {
                        return "Music";
                    }
                }
            } catch (eXmpDesc) { }
        }

        // 5. Pastas em disco (pasta imediata + ate 3 niveis ancestrais) e candidatos restantes (bin original, treePath)
        var folderAndBinCandidates = [];
        if (mPath) {
            var ancestors = getAncestorFolderNamesFromPath(mPath, 3);
            for (var a = 0; a < ancestors.length; a++) {
                folderAndBinCandidates.push(ancestors[a]);
            }
        }
        if (nameCandidates && nameCandidates.length) {
            for (var nc = 0; nc < nameCandidates.length; nc++) {
                if (nameCandidates[nc]) folderAndBinCandidates.push(String(nameCandidates[nc]));
            }
        }
        for (var i = 0; i < folderAndBinCandidates.length; i++) {
            var roleByContext = matchAudioRoleKeywords(folderAndBinCandidates[i]);
            if (roleByContext) return roleByContext;
        }

        return "Others";
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
        } catch (e1) { }

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
                            } catch (eProj) { }

                            if (belongsToActiveProject) {
                                var vSel = app.getProjectViewSelection(vid);
                                addSelectionArray(vSel);
                            }
                        }
                    }
                }
            } catch (e2) { }
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
        $.global.ppro_resetSequenceCache();
        if (!app.project || !app.project.rootItem) {
            return '{"success": false, "error": "Nenhum projeto aberto no Premiere Pro."}';
        }

        ppro_beginUndoGroup("Verificar Sequências Não Usadas");
        try {
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
            var mediaUsedInSeqIds = {}; // mediaNodeId -> [parentSeqNodeId, ...]

            for (var sIdx = 0; sIdx < app.project.sequences.numSequences; sIdx++) {
                var seq = app.project.sequences[sIdx];
                if (!seq || !seq.projectItem || !seq.projectItem.nodeId) continue;
                var nid = seq.projectItem.nodeId;
                var trackInfo = inspectSequenceTracks(seq);
                clipCountByNodeId[nid] = trackInfo.totalClips;
                if (!usedInNodeIds[nid]) usedInNodeIds[nid] = [];

                for (var refIdx = 0; refIdx < trackInfo.items.length; refIdx++) {
                    var refItem = trackInfo.items[refIdx];
                    if (refItem && refItem.nodeId && refItem.nodeId !== nid) {
                        if (seqMap[refItem.nodeId]) {
                            if (!usedInNodeIds[refItem.nodeId]) {
                                usedInNodeIds[refItem.nodeId] = [];
                            }
                            if (!arrayContains(usedInNodeIds[refItem.nodeId], nid)) {
                                usedInNodeIds[refItem.nodeId].push(nid);
                            }
                        } else {
                            if (!mediaUsedInSeqIds[refItem.nodeId]) {
                                mediaUsedInSeqIds[refItem.nodeId] = [];
                            }
                            if (!arrayContains(mediaUsedInSeqIds[refItem.nodeId], nid)) {
                                mediaUsedInSeqIds[refItem.nodeId].push(nid);
                            }
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

            // Passo 3: Identificar midias nao utilizadas em nenhuma sequencia ativa
            var unusedMediaCount = 0;
            var allProjectItems = snap.allItems || [];
            for (var mi = 0; mi < allProjectItems.length; mi++) {
                var mItem = allProjectItems[mi];
                if (!mItem || !mItem.nodeId || isBin(mItem) || seqMap[mItem.nodeId]) {
                    continue;
                }
                var mParent = parentByNodeId[mItem.nodeId];
                var mediaAlreadyInUnused = Boolean(
                    existingUnusedBin &&
                    (isSameBin(mParent, existingUnusedBin) || isInsideTargetBin(mItem, existingUnusedBin))
                );
                if (mediaAlreadyInUnused) {
                    continue;
                }
                var mUsedBy = mediaUsedInSeqIds[mItem.nodeId] || [];
                var usedInActiveSeq = false;
                for (var ms = 0; ms < mUsedBy.length; ms++) {
                    if (!unusedSeqMap[mUsedBy[ms]]) {
                        usedInActiveSeq = true;
                        break;
                    }
                }
                if (!usedInActiveSeq) {
                    toMove.push(mItem);
                    unusedMediaCount++;
                    notUsedCount++;
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
                ', "unusedMediaCount": ' +
                unusedMediaCount +
                "}"
            );
        } catch (err) {
            return '{"success": false, "error": "' + escapeJsonString(err.toString()) + '"}';
        } finally {
            ppro_endUndoGroup();
        }
    };

    // =========================================================================
    // 3. Organizar Projeto com Preset Dinâmico (equivalente a organizeWithPreset)
    // =========================================================================
    $.global.ppro_organizeWithPreset = function (mainCompId, presetJsonString) {
        $.global.ppro_resetSequenceCache();
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
        var sourceFolderModeGlobal = (settings.groupBySourceFolder === false || settings.sourceFolderMode === "off")
            ? "off"
            : ((settings.sourceFolderMode === "project" || settings.sourceFolderMode === "disk" || settings.sourceFolderMode === "both")
                ? settings.sourceFolderMode
                : "both");
        var unusedFolderName = settings.unusedFolderName || "Nunca Usadas";
        var separateAudioCategories = (settings.separateAudioCategories !== false);
        var numberAudioCategories = (settings.numberAudioCategories !== false);

        // --- Perfil de execucao (Fase 2): tempo total + varreduras de bins ---
        var _profT0 = new Date().getTime();
        var _scanCount = 0;

        var projectSaved = false;
        if (saveProjectBefore) {
            try {
                app.project.save();
                projectSaved = true;
            } catch (saveErr) { }
        }

        ppro_beginUndoGroup("Organizar Projeto");
        try {
            var snap = takeProjectSnapshot();
            var rootItem = snap.rootItem;
            var parentByNodeId = snap.parentByNodeId;
            var allBins = snap.allBins;
            var allNonBinItems = snap.allNonBinItems;
            var seqMap = buildSequenceMap();
            var timelineAudioMap = separateAudioCategories ? buildTimelineAudioMap() : {};

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
                try {
                    item.moveBin(targetBin);
                } catch (eMove) {
                    // Um item bloqueado/especial nao deve abortar a organizacao inteira
                    if ($.global.OrgLib) {
                        $.global.OrgLib.warn("ppro.moveItemSafe", "falha ao mover " + (item && item.name), eMove);
                    }
                    return false;
                }
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

            var AUDIO_ROLE_ORDER = ["Dialogue", "Music", "SFX", "Ambience", "Others"];
            function isCanonicalAudioRoleName(candidateName) {
                if (!candidateName) return false;
                var cleanLower = stripNumericPrefix(String(candidateName)).toLowerCase();
                for (var ari = 0; ari < AUDIO_ROLE_ORDER.length; ari++) {
                    if (AUDIO_ROLE_ORDER[ari].toLowerCase() === cleanLower) return true;
                }
                return false;
            }

            function getOrCreateSubBin(parentBin, pathArray, inheritLabel) {
                var currentParent = parentBin || rootItem;
                for (var i = 0; i < pathArray.length; i++) {
                    var binName = pathArray[i];
                    var matchRoleIgnorePrefix = (i === 0 && isCanonicalAudioRoleName(binName));
                    var cleanRoleTarget = matchRoleIgnorePrefix ? stripNumericPrefix(binName).toLowerCase() : "";
                    var foundBin = null;
                    if (currentParent.children) {
                        for (var j = 0; j < currentParent.children.numItems; j++) {
                            _scanCount++;
                            var child = currentParent.children[j];
                            if (isBin(child)) {
                                var sameExact = (child.name === binName);
                                var sameRole = (matchRoleIgnorePrefix && stripNumericPrefix(child.name).toLowerCase() === cleanRoleTarget);
                                if (sameExact || sameRole) {
                                    foundBin = child;
                                    if (foundBin.nodeId && !parentByNodeId[foundBin.nodeId]) {
                                        parentByNodeId[foundBin.nodeId] = currentParent;
                                    }
                                    break;
                                }
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

            // --- Motor de regras compartilhado (host/_rules.jsx) ---
            var _rules = $.global.OrgRules.createMatcher(nodeRecords);
            var findMatchingNode = _rules.findMatchingNode;
            var matchesNameFilter = $.global.OrgRules.matchesNameFilter;
            var nodeSupportsType = $.global.OrgRules.nodeSupportsType;
            function isExtInNodesOfType(extLower, targetType) {
                return $.global.OrgRules.isExtInNodesOfType(nodeRecords, extLower, targetType);
            }

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
                        _scanCount++;
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

            function classifyPProItem(item, extLower) {
                var mediaPath = getMediaPathSafe(item);
                var offline = isOfflineSafe(item);

                // Item sintético nativo do Premiere Pro (Color Matte, Adjustment Layer, Black Video, Bars & Tone, Transparent Video, Titles)
                if (!mediaPath && !offline && !isCompoundOrSequenceItem(item)) {
                    return "Solids";
                }

                var mediaTypeMeta = getIntrinsicMediaType(item);

                // 1. Áudio puro ou extensão de áudio
                if (mediaTypeMeta && /^(audio|[\u00e1a]udio|ton|son)$/i.test(mediaTypeMeta)) {
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
                    if (/still|est[\u00e1a]tica|fija|fixe|standbild/i.test(mediaTypeMeta)) {
                        return "StillImages";
                    }
                    if (
                        /video|v[\u00edi]deo|movie|filme/i.test(mediaTypeMeta) &&
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

            // --- Diagnostico visivel (Fase 2) ---
            // Sem estes contadores, uma triagem que nao roda (ESP desligado) ou que
            // nao encontra destino para o item devolve success:true e o painel exibe
            // "Projeto organizado!" sem nenhum indicio do que ficou de fora.
            ppro_debugReset();
            var audioTotal = 0;
            var audioNoMatch = 0;
            var audioSkipped = 0;
            var audioRoles = { Dialogue: 0, Music: 0, SFX: 0, Ambience: 0, Others: 0 };
            var audioTargets = {};
            var audioSamples = [];
            var emptyLeftovers = [];

            function registerAudioDecision(item, role, targetNode, subPathArr, movedOk) {
                if (role) {
                    if (!audioRoles[role]) audioRoles[role] = 0;
                    audioRoles[role]++;
                } else {
                    audioSkipped++;
                }
                var targetName = String(targetNode && targetNode.name ? targetNode.name : "?");
                audioTargets[targetName] = (audioTargets[targetName] || 0) + 1;
                if (audioSamples.length < 8) {
                    audioSamples.push({
                        _nodeId: targetNode && targetNode.id ? String(targetNode.id) : "",
                        name: String(item && item.name ? item.name : ""),
                        role: role || "(ESP desligado)",
                        node: targetName,
                        path: (subPathArr || []).join("/"),
                        moved: Boolean(movedOk)
                    });
                }
                _dbg("AUDIO " + (movedOk ? "movido" : "mantido") + ": " +
                    (item && item.name) + " role=" + (role || "-") +
                    " no=" + targetName + " sub=" + (subPathArr || []).join("/"));
            }

            function jsonCountMap(countMap) {
                var parts = [];
                for (var key in countMap) {
                    if (countMap.hasOwnProperty(key)) {
                        parts.push('"' + escapeJsonString(key) + '":' + (parseInt(countMap[key], 10) || 0));
                    }
                }
                return "{" + parts.join(",") + "}";
            }

            function jsonStringList(list) {
                var parts = [];
                for (var li = 0; li < (list || []).length; li++) {
                    parts.push('"' + escapeJsonString(list[li]) + '"');
                }
                return "[" + parts.join(",") + "]";
            }

            function jsonAudioSamples() {
                var parts = [];
                for (var si = 0; si < audioSamples.length; si++) {
                    var smp = audioSamples[si];
                    parts.push(
                        '{"name":"' + escapeJsonString(smp.name) +
                        '","role":"' + escapeJsonString(smp.role) +
                        '","node":"' + escapeJsonString(smp.node) +
                        '","path":"' + escapeJsonString(smp.path) +
                        '","moved":' + (smp.moved ? "true" : "false") + "}"
                    );
                }
                return "[" + parts.join(",") + "]";
            }

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
                            } catch (eMoveTrash) { }
                        }
                        try {
                            tempTrashBin.deleteBin();
                        } catch (eDelTrash) { }

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

            var origParentBinByNodeId = {};
            var allSeqNamesLower = {};
            for (var opKey in parentByNodeId) {
                if (parentByNodeId.hasOwnProperty(opKey)) {
                    origParentBinByNodeId[opKey] = parentByNodeId[opKey];
                }
            }
            for (var asn = 0; asn < allNonBinItems.length; asn++) {
                var asnItem = allNonBinItems[asn];
                if (asnItem && asnItem.name && isCompoundOrSequenceItem(asnItem)) {
                    allSeqNamesLower[String(asnItem.name).toLowerCase()] = true;
                }
            }

            function isMainCompNodeBinName(binName) {
                if (!binName) return false;
                var cleanB = stripNumericPrefix(binName).toLowerCase();
                for (var i = 0; i < nodeRecords.length; i++) {
                    var r = nodeRecords[i].node.rules;
                    if (r && nodeSupportsType(r, "MainComp")) {
                        var cleanNode = stripNumericPrefix(nodeRecords[i].node.name).toLowerCase();
                        if (cleanB === cleanNode) return true;
                    }
                }
                return false;
            }

            function wasOriginallyInsideMainCompBin(targetItem) {
                if (!targetItem || !targetItem.nodeId) return false;
                var curBin = origParentBinByNodeId[targetItem.nodeId];
                var guard = 0;
                while (curBin && !isSameBin(curBin, rootItem) && guard < 50) {
                    guard++;
                    if (curBin.name && isMainCompNodeBinName(curBin.name)) {
                        return true;
                    }
                    curBin = curBin.nodeId ? origParentBinByNodeId[curBin.nodeId] : null;
                }
                return false;
            }

            function isPresetCategoryBinName(binName) {
                if (!binName) return false;
                var cleanB = stripNumericPrefix(binName).toLowerCase();
                if (binName === unusedFolderName || cleanB === stripNumericPrefix(unusedFolderName).toLowerCase()) return true;
                for (var i = 0; i < nodeRecords.length; i++) {
                    var cleanNode = stripNumericPrefix(nodeRecords[i].node.name).toLowerCase();
                    if (cleanB === cleanNode) return true;
                }
                return false;
            }

            function getUserProjectBinChain(targetItem, fileExt, isSeqItem) {
                var chain = [];
                if (!targetItem || !targetItem.nodeId) return chain;
                var curBin = origParentBinByNodeId[targetItem.nodeId];
                var guard = 0;
                while (curBin && !isSameBin(curBin, rootItem) && guard < 50) {
                    guard++;
                    if (curBin.name) {
                        chain.unshift(curBin.name);
                    }
                    curBin = curBin.nodeId ? origParentBinByNodeId[curBin.nodeId] : null;
                }
                var startIdx = 0;
                var sawPresetNode = false;
                var extLower = String(fileExt || "").toLowerCase();
                while (startIdx < chain.length) {
                    var seg = chain[startIdx];
                    var segLower = String(seg || "").toLowerCase();
                    var cleanSeg = stripNumericPrefix(seg);
                    if (isPresetCategoryBinName(seg)) {
                        sawPresetNode = true;
                        startIdx++;
                        continue;
                    }
                    if (sawPresetNode && isCanonicalAudioRoleName(cleanSeg)) {
                        startIdx++;
                        continue;
                    }
                    if (sawPresetNode && (segLower === "others" || (extLower && segLower === extLower))) {
                        startIdx++;
                        continue;
                    }
                    if (sawPresetNode && isSeqItem && (segLower === "geral" || allSeqNamesLower[segLower] === true)) {
                        startIdx++;
                        continue;
                    }
                    break;
                }
                var userChain = [];
                for (var uc = startIdx; uc < chain.length; uc++) {
                    userChain.push(chain[uc]);
                }
                return userChain;
            }

            function resolveNodeSourceMode(nodeRules) {
                if (nodeRules) {
                    if (nodeRules.groupBySourceFolder === false) return "off";
                    var rm = nodeRules.sourceFolderMode ? String(nodeRules.sourceFolderMode).toLowerCase() : "";
                    if (rm === "project" || rm === "disk" || rm === "both") return rm;
                    if (rm === "off" && nodeRules.groupBySourceFolder !== true) return "off";
                    if (nodeRules.groupBySourceFolder === true) {
                        return sourceFolderModeGlobal !== "off" ? sourceFolderModeGlobal : "both";
                    }
                }
                return groupBySourceFolderGlobal ? sourceFolderModeGlobal : "off";
            }

            function resolveSourceSubBins(sourceMode, userBinChain, diskFolderName) {
                var out = [];
                if (sourceMode === "off") return out;
                if (sourceMode === "project") {
                    if (userBinChain && userBinChain.length > 0) {
                        for (var u = 0; u < userBinChain.length; u++) {
                            out.push(userBinChain[u]);
                        }
                    }
                    return out;
                }
                if (sourceMode === "disk") {
                    if (diskFolderName) out.push(diskFolderName);
                    return out;
                }
                if (userBinChain && userBinChain.length > 0) {
                    for (var ub = 0; ub < userBinChain.length; ub++) {
                        out.push(userBinChain[ub]);
                    }
                } else if (diskFolderName) {
                    out.push(diskFolderName);
                }
                return out;
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
                        /^(\d+[_-\s]*)?(pre[-_]?comps?|sequences?|sequ[\u00eae]ncias?)$/i.test(binCandidate.name)
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
                            if (!/^(\d+[_-\s]*)?(pre[-_]?comps?|sequences?|sequ[\u00eae]ncias?)$/i.test(child.name)) {
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
                                if (isBin(ch) && /^(\d+[_-\s]*)?(pre[-_]?comps?|sequences?|sequ[\u00eae]ncias?)$/i.test(ch.name)) {
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
                            var psdSourceMode = resolveNodeSourceMode(psdBundleNodeRec.node.rules);
                            var psdUserChain = getUserProjectBinChain(binCandidate, detectedType ? detectedType.toLowerCase() : "");
                            var psdSourceBins = resolveSourceSubBins(psdSourceMode, psdUserChain, bundleSourceFolder);
                            for (var psb = 0; psb < psdSourceBins.length; psb++) {
                                psdSubPath.push(psdSourceBins[psb]);
                            }
                            if (false && bundleSourceFolder) {
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
                                _dbg("nested candidato: " + refItem.name + " protected=" + isInsideProtectedBin(refItem) + " processed=" + !!processedNodeIds[refItem.nodeId]);
                                if (!isInsideProtectedBin(refItem) && !processedNodeIds[refItem.nodeId]) {
                                    var preCandidates = [refItem.name];
                                    var origPreBin = (parentByNodeId && refItem.nodeId) ? parentByNodeId[refItem.nodeId] : null;
                                    if (origPreBin && !isSameBin(origPreBin, rootItem) && origPreBin.name) {
                                        preCandidates.push(origPreBin.name);
                                    }
                                    var preMatch = findMatchingNode("PreComps", "", preCandidates);
                                    _dbg("nested match: " + (preMatch && preMatch.rec ? preMatch.rec.id : "null"));
                                    if (preMatch && preMatch.rec) {
                                        var preNodeBin = ensureNodeBin(preMatch.rec.id);
                                        var destPreBin = preNodeBin;
                                        var preSubBins = [];
                                        if (preMatch.rec.node.rules && preMatch.rec.node.rules.groupByMainComp) {
                                            preSubBins.push(mainSeqName);
                                        }
                                        var preSourceMode = resolveNodeSourceMode(preMatch.rec.node.rules);
                                        if (preSourceMode === "project" || preSourceMode === "both") {
                                            var preUserChain = getUserProjectBinChain(refItem, "", true);
                                            for (var puc = 0; puc < preUserChain.length; puc++) {
                                                preSubBins.push(preUserChain[puc]);
                                            }
                                        }
                                        if (preSubBins.length > 0) {
                                            destPreBin = getOrCreateSubBin(preNodeBin, preSubBins, preMatch.rec.node.label);
                                        }
                                        if (false && preMatch.rec.node.rules && preMatch.rec.node.rules.groupByMainComp) {
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
                    _dbg("main seq: " + mainSeqItem.name + " | no seqMap=" + !!seqMap[mainSeqItem.nodeId] + " | tracks=" + inspectSequenceTracks(seqMap[mainSeqItem.nodeId]).items.length);
                    var mainCandidates = [mainSeqItem.name];
                    var origMainBin = (parentByNodeId && mainSeqItem.nodeId) ? parentByNodeId[mainSeqItem.nodeId] : null;
                    if (origMainBin && !isSameBin(origMainBin, rootItem) && origMainBin.name) {
                        mainCandidates.push(origMainBin.name);
                    }
                    var mainMatch = findMatchingNode("MainComp", "", mainCandidates);
                    if (mainMatch && mainMatch.rec) {
                        var outBin = ensureNodeBin(mainMatch.rec.id);
                        var destOutBin = outBin;
                        var mainSourceMode = resolveNodeSourceMode(mainMatch.rec.node.rules);
                        if (mainSourceMode === "project" || mainSourceMode === "both") {
                            var mainUserChain = getUserProjectBinChain(mainSeqItem, "", true);
                            if (mainUserChain.length > 0) {
                                destOutBin = getOrCreateSubBin(outBin, mainUserChain, mainMatch.rec.node.label);
                            }
                        }
                        if (moveItemSafe(mainSeqItem, destOutBin)) {
                            movedComps++;
                        }
                        if (false && moveItemSafe(mainSeqItem, outBin)) {
                            movedComps++;
                        }
                    }
                    processedNodeIds[mainSeqItem.nodeId] = true;

                    var visitedSeqs = {};
                    visitedSeqs[mainSeqItem.nodeId] = true;
                    processNestedSeqsForMain(mainSeqItem, mainSeqItem.name, visitedSeqs);
                }
            }

            // Pre-classificar stems irmaos de musica (ex.: "Artist - Track.wav" + "Artist - Track - No Lead Vocals.wav")
            var musicStemBases = {};
            function stripAudioExtAndStem(rawName) {
                if (!rawName) return "";
                var base = String(rawName).replace(/\.[A-Za-z0-9]{2,5}$/, "").toLowerCase();
                base = base.replace(/\s*[-_(]+\s*(?:no\s+lead\s+vocals?|no\s+vocals?|instrumental|backing\s+track|backing\s+vocals?|stems?)(?:\s*[)_\-].*)?$/i, "");
                return base.replace(/^\s+|\s+$/g, "");
            }
            if (separateAudioCategories) {
                for (var psm = 0; psm < allNonBinItems.length; psm++) {
                    var candItem = allNonBinItems[psm];
                    if (!candItem || !candItem.nodeId || isCompoundOrSequenceItem(candItem)) continue;
                    var cExt = getItemExtension(candItem);
                    if (classifyPProItem(candItem, cExt) !== "Audios") continue;
                    var quickRole = classifyAudioRole(candItem, timelineAudioMap, [candItem.name]);
                    if (quickRole === "Music") {
                        var stemBase = stripAudioExtAndStem(candItem.name);
                        if (stemBase && stemBase.length >= 4) {
                            musicStemBases[stemBase] = true;
                        }
                    }
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
                        _dbg("loose sequence: " + item.name);
                        var looseCandidates = [item.name];
                        var origLooseBin = (parentByNodeId && item.nodeId) ? parentByNodeId[item.nodeId] : null;
                        if (origLooseBin && !isSameBin(origLooseBin, rootItem) && origLooseBin.name) {
                            looseCandidates.push(origLooseBin.name);
                        }
                        var targetSeqType = wasOriginallyInsideMainCompBin(item) ? "MainComp" : "PreComps";
                        var loosePreMatch = findMatchingNode(targetSeqType, "", looseCandidates);
                        if (!loosePreMatch || !loosePreMatch.rec) {
                            loosePreMatch = findMatchingNode("PreComps", "", looseCandidates);
                            targetSeqType = "PreComps";
                        }
                        if (loosePreMatch && loosePreMatch.rec) {
                            var looseNodeBin = ensureNodeBin(loosePreMatch.rec.id);
                            var targetLooseBin = looseNodeBin;
                            var looseSubBins = [];
                            if (targetSeqType === "PreComps" && loosePreMatch.rec.node.rules && loosePreMatch.rec.node.rules.groupByMainComp) {
                                looseSubBins.push("Geral");
                            }
                            var looseSourceMode = resolveNodeSourceMode(loosePreMatch.rec.node.rules);
                            if (looseSourceMode === "project" || looseSourceMode === "both") {
                                var looseUserChain = getUserProjectBinChain(item, "", true);
                                for (var luc = 0; luc < looseUserChain.length; luc++) {
                                    looseSubBins.push(looseUserChain[luc]);
                                }
                            }
                            if (looseSubBins.length > 0) {
                                targetLooseBin = getOrCreateSubBin(looseNodeBin, looseSubBins, loosePreMatch.rec.node.label);
                            }
                            if (false && loosePreMatch.rec.node.rules && loosePreMatch.rec.node.rules.groupByMainComp) {
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

                    var mediaPath = getMediaPathSafe(item);
                    var diskFileName = mediaPath ? getFileNameFromPath(mediaPath) : "";
                    var diskFolderName = mediaPath ? getParentFolderNameFromPath(mediaPath) : "";
                    var origParentBin = (parentByNodeId && item.nodeId) ? parentByNodeId[item.nodeId] : null;
                    var origBinName = (origParentBin && !isSameBin(origParentBin, rootItem) && origParentBin.name) ? origParentBin.name : "";

                    var nameCandidates = [item.name];
                    if (diskFileName && diskFileName !== item.name) {
                        nameCandidates.push(diskFileName);
                    }
                    if (diskFolderName) {
                        nameCandidates.push(diskFolderName);
                    }
                    if (origBinName && origBinName !== diskFolderName && origBinName !== item.name) {
                        nameCandidates.push(origBinName);
                    }
                    if (item.treePath) {
                        nameCandidates.push(item.treePath);
                    }

                    // Triagem de papel de audio (ESP). O papel detectado NAO entra em
                    // nameCandidates: ele e derivado do proprio item e, como o filtro por
                    // nomenclatura tem prioridade absoluta em _rules.jsx, injeta-lo fazia
                    // qualquer no com nameFilter "sfx"/"fx"/"music"/"voz" capturar o
                    // audio, inclusive nos que nao sao de audio. O destino por papel e
                    // resolvido depois, na subpasta (01_Dialogue .. 05_Others).
                    var isAudioItem = (fType === "Audios");
                    var detectedAudioRole = "";
                    if (isAudioItem) {
                        audioTotal++;
                        if (separateAudioCategories) {
                            detectedAudioRole = classifyAudioRole(item, timelineAudioMap, nameCandidates);
                            if (detectedAudioRole === "Others" && item.name) {
                                var itemBaseKey = stripAudioExtAndStem(item.name);
                                if (itemBaseKey && musicStemBases[itemBaseKey]) {
                                    detectedAudioRole = "Music";
                                }
                            }
                        }
                    }

                    if (fType === "Solids") {
                        var solidMatch = findMatchingNode("Solids", "", nameCandidates);
                        if (solidMatch && solidMatch.rec) {
                            var solidBin = ensureNodeBin(solidMatch.rec.id);
                            var destSolidBin = solidBin;
                            var solidSourceMode = resolveNodeSourceMode(solidMatch.rec.node.rules);
                            if (solidSourceMode === "project" || solidSourceMode === "both") {
                                var solidUserChain = getUserProjectBinChain(item, "", false);
                                if (solidUserChain.length > 0) {
                                    destSolidBin = getOrCreateSubBin(solidBin, solidUserChain, solidMatch.rec.node.label);
                                }
                            }
                            if (moveItemSafe(item, destSolidBin)) {
                                movedFootages++;
                            }
                            if (false && moveItemSafe(item, solidBin)) {
                                movedFootages++;
                            }
                            processedNodeIds[item.nodeId] = true;
                        }
                    } else {
                        var mediaMatch = findMatchingNode(fType, fileExt, nameCandidates);
                        if ((!mediaMatch || !mediaMatch.rec) && isAudioItem) {
                            audioNoMatch++;
                            _dbg("AUDIO SEM NO: " + item.name + " (ext=" + fileExt +
                                ", role=" + (detectedAudioRole || "-") + ")");
                        }
                        if (mediaMatch && mediaMatch.rec) {
                            var targetNode = mediaMatch.rec.node;
                            var nodeBin = ensureNodeBin(mediaMatch.rec.id);
                            var finalMediaBin = nodeBin;

                            var shouldGroupBySource = (targetNode.rules && targetNode.rules.groupBySourceFolder !== undefined)
                                ? Boolean(targetNode.rules.groupBySourceFolder)
                                : groupBySourceFolderGlobal;

                            var mediaSourceMode = resolveNodeSourceMode(targetNode.rules);
                            var shouldGroupBySource = (mediaSourceMode !== "off");
                            var mediaUserChain = getUserProjectBinChain(item, fileExt);
                            var mediaSourceBins = resolveSourceSubBins(mediaSourceMode, mediaUserChain, diskFolderName);
                            var sourceFolderName = "";

                            var subPath = [];

                            // Subpasta de Categoria de Áudio (Dialogue, Music, SFX, Ambience, Others)
                            if (fType === "Audios" && separateAudioCategories && detectedAudioRole) {
                                var cleanTargetLower = stripNumericPrefix(targetNode.name || "").toLowerCase();
                                var isAlreadyRoleNode = (
                                    cleanTargetLower === "dialogue" || cleanTargetLower === "dialogo" ||
                                    cleanTargetLower === "music" || cleanTargetLower === "musica" ||
                                    cleanTargetLower === "sfx" ||
                                    cleanTargetLower === "ambience" || cleanTargetLower === "ambiente"
                                );
                                if (!isAlreadyRoleNode && isCanonicalAudioRoleName(detectedAudioRole)) {
                                    subPath.push(detectedAudioRole);
                                }
                            }

                            if (targetNode.rules && targetNode.rules.groupSubfoldersByExt) {
                                var subBinName = (mediaMatch.matchedViaCatchOthers || !fileExt)
                                    ? "OTHERS"
                                    : fileExt.toUpperCase();
                                subPath.push(subBinName);

                                if (
                                    (mediaSourceBins.length === 0) &&
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

                            for (var msb = 0; msb < mediaSourceBins.length; msb++) {
                                subPath.push(mediaSourceBins[msb]);
                            }
                            if (sourceFolderName) {
                                subPath.push(sourceFolderName);
                            }

                            if (subPath.length > 0) {
                                finalMediaBin = getOrCreateSubBin(nodeBin, subPath, targetNode.label);
                            }

                            var mediaMoved = moveItemSafe(item, finalMediaBin);
                            if (mediaMoved) {
                                movedFootages++;
                            }
                            if (isAudioItem) {
                                registerAudioDecision(item, detectedAudioRole, targetNode, subPath, mediaMoved);
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
                                } catch (eDel) { }
                            }
                        }
                    }
                    return removedHere;
                }

                cleanedFolders = cleanEmptyBinsBottomUp(rootItem);
            }

            // 4b. Bins vazias remanescentes (quando deleteEmptyFolders esta desligado).
            // Sem isso o usuario ve, por exemplo, 04_Audios/WAV vazio - sobra de uma
            // execucao antiga - e conclui que a triagem por papel nao funcionou.
            function collectEmptyBins(container, depth, pathPrefix) {
                if (!container || !container.children || depth > 12) return;
                for (var eb = 0; eb < container.children.numItems; eb++) {
                    var chEb = container.children[eb];
                    if (!chEb || !isBin(chEb) || isInsideProtectedBin(chEb)) continue;
                    var childPath = pathPrefix ? (pathPrefix + "/" + chEb.name) : String(chEb.name || "");
                    var numKids = (chEb.children && chEb.children.numItems) ? chEb.children.numItems : 0;
                    if (numKids === 0) {
                        if (emptyLeftovers.length < 40) emptyLeftovers.push(childPath);
                    } else {
                        collectEmptyBins(chEb, depth + 1, childPath);
                    }
                }
            }
            collectEmptyBins(rootItem, 0, "");

            function applyAudioRoleSubfolderNumbering(parentAudioBin, ownerNode) {
                if (!parentAudioBin || !parentAudioBin.children) return;
                var childNodes = (ownerNode && ownerNode.children) ? ownerNode.children : [];
                var shouldNumberRoles = Boolean(usePrefixNumbering && numberAudioCategories);
                var roleSeq = 0;
                var finalRoleFolderByBase = {};

                for (var r = 0; r < AUDIO_ROLE_ORDER.length; r++) {
                    var roleBase = AUDIO_ROLE_ORDER[r];
                    var roleLower = roleBase.toLowerCase();

                    // Nao interferir caso o usuario tenha criado um no filho manual com esse nome na arvore
                    var isManualChildNode = false;
                    for (var cn = 0; cn < childNodes.length; cn++) {
                        if (childNodes[cn] && stripNumericPrefix(childNodes[cn].name || "").toLowerCase() === roleLower) {
                            isManualChildNode = true;
                            break;
                        }
                    }
                    if (isManualChildNode) continue;

                    var matchedRoleBin = null;
                    for (var c = 0; c < parentAudioBin.children.numItems; c++) {
                        _scanCount++;
                        var sub = parentAudioBin.children[c];
                        if (!sub || !isBin(sub)) continue;
                        if (!sub.children || sub.children.numItems === 0) continue;
                        if (stripNumericPrefix(sub.name).toLowerCase() === roleLower) {
                            matchedRoleBin = sub;
                            break;
                        }
                    }

                    if (matchedRoleBin) {
                        var finalRoleName = roleBase;
                        if (shouldNumberRoles) {
                            roleSeq++;
                            var rPrefix = (roleSeq < 10 ? "0" + roleSeq : String(roleSeq)) + "_";
                            finalRoleName = rPrefix + roleBase;
                        }
                        renameBinSafe(matchedRoleBin, finalRoleName);
                        finalRoleFolderByBase[roleBase] = finalRoleName;
                    }
                }

                var ownerId = ownerNode && ownerNode.id ? String(ownerNode.id) : "";
                if (ownerId) {
                    for (var si = 0; si < audioSamples.length; si++) {
                        var smp = audioSamples[si];
                        if (smp && smp._nodeId === ownerId && smp.role && finalRoleFolderByBase[smp.role]) {
                            var sParts = smp.path ? smp.path.split("/") : [];
                            if (sParts.length > 0 && stripNumericPrefix(sParts[0]).toLowerCase() === smp.role.toLowerCase()) {
                                sParts[0] = finalRoleFolderByBase[smp.role];
                                smp.path = sParts.join("/");
                            }
                        }
                    }
                }
            }

            // 5. Aplicar numeração sequencial contínua (01_, 02_...) e Color Labels apenas nas Bins com itens
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
                        _scanCount++;
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

                    if (separateAudioCategories) {
                        applyAudioRoleSubfolderNumbering(entry.bin, entry.node);
                    }

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
                ', "elapsedMs": ' +
                (new Date().getTime() - _profT0) +
                ', "scanCount": ' +
                _scanCount +
                ', "audioSeparate": ' +
                (separateAudioCategories ? "true" : "false") +
                ', "audioTotal": ' +
                audioTotal +
                ', "audioNoMatch": ' +
                audioNoMatch +
                ', "audioSkipped": ' +
                audioSkipped +
                ', "audioRoles": ' +
                jsonCountMap(audioRoles) +
                ', "audioTargets": ' +
                jsonCountMap(audioTargets) +
                ', "audioSamples": ' +
                jsonAudioSamples() +
                ', "emptyLeftovers": ' +
                jsonStringList(emptyLeftovers) +
                ', "debugTrace": "' +
                escapeJsonString(ppro_debugTrace()) +
                '"' +
                "}"
            );
        } catch (err) {
            return '{"success": false, "error": "' + escapeJsonString(err.toString()) + '"}';
        } finally {
            ppro_endUndoGroup();
        }
    };

    // =========================================================================
    // 4. Criar Estrutura Vazia de Bins do Preset (createPresetFolderStructure)
    // =========================================================================
    $.global.ppro_createPresetFolderStructure = function (presetJsonString) {
        $.global.ppro_resetSequenceCache();
        if (!app.project || !app.project.rootItem) {
            return '{"success": false, "error": "Nenhum projeto aberto no Premiere Pro."}';
        }

        var preset = parseJson(presetJsonString);
        if (!preset || !preset.tree || !preset.tree.length) {
            return '{"success": false, "error": "O preset selecionado não possui pastas configuradas."}';
        }

        var settings = preset.settings || {};
        var usePrefixNumbering = (settings.usePrefixNumbering !== false);

        ppro_beginUndoGroup("Criar Estrutura de Pastas");
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
        } finally {
            ppro_endUndoGroup();
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
                } catch (eLbl) { }

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
            } catch (saveErr) { }
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

        ppro_beginUndoGroup("Restaurar Projeto");
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
                            try { liveBin.setColorLabel(sb.colorLabel); } catch (eL1) { }
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
                                try { recreated.setColorLabel(sb.colorLabel); } catch (eL2) { }
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
                                } catch (eDel) { }
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
                                } catch (eDel2) { }
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
        } finally {
            ppro_endUndoGroup();
        }
    };
})();
