/* ==========================================================================
   TidyFlow — Motor de regras compartilhado (After Effects + Premiere Pro)
   Extraído dos dois motores, que mantinham cópias idênticas de:
     matchesNameFilter, nodeSupportsType, isExtInNodesOfType e findMatchingNode.
   Não depende de APIs de host: opera apenas sobre `nodeRecords`
   ({ id, node, parentId, depth }) + OrgLib para utilitários de string.
   ========================================================================== */
(function () {
    if ($.global.OrgRules) return;

    var Lib = $.global.OrgLib;
    if (!Lib) {
        try {
            var here = $.fileName ? new File($.fileName) : null;
            if (here && here.parent) {
                var libFile = new File(here.parent.fsName + "/_lib.jsx");
                if (libFile.exists) $.evalFile(libFile);
            }
        } catch (eLib) {}
        Lib = $.global.OrgLib;
    }
    if (!Lib) throw new Error("TidyFlow: host/_lib.jsx precisa ser carregado antes de _rules.jsx");

    function matchesNameFilter(itemName, rules) {
        if (!rules || !rules.nameFilter) return false;
        var filterStr = Lib.trimStr(rules.nameFilter);
        if (!filterStr) return false;
        var targetName = String(itemName === undefined || itemName === null ? "" : itemName);

        if (rules.nameFilterMode === "regex") {
            try {
                var rx = new RegExp(filterStr, "i");
                return rx.test(targetName);
            } catch (e) {
                return targetName.toLowerCase().indexOf(filterStr.toLowerCase()) !== -1;
            }
        }

        var parts = filterStr.split(",");
        var nameLower = targetName.toLowerCase();
        for (var p = 0; p < parts.length; p++) {
            var token = Lib.trimStr(parts[p]).toLowerCase();
            if (token && nameLower.indexOf(token) !== -1) return true;
        }
        return false;
    }

    function nodeSupportsType(rules, itemType) {
        if (!rules || !rules.types || rules.types.length === 0) return false;
        var types = rules.types;

        if (itemType === "MainComp") {
            return Lib.arrayContains(types, "MainComp") || Lib.arrayContains(types, "Compositions");
        }
        if (itemType === "PreComps") {
            return Lib.arrayContains(types, "PreComps");
        }
        if (itemType === "StillImages") {
            return Lib.arrayContains(types, "StillImages");
        }
        if (itemType === "Solids") {
            return Lib.arrayContains(types, "Solids");
        }
        if (itemType === "Videos") {
            return Lib.arrayContains(types, "Videos") || Lib.arrayContains(types, "Footages");
        }
        if (itemType === "ImageSequences") {
            return Lib.arrayContains(types, "ImageSequences");
        }
        if (itemType === "DataFiles") {
            return Lib.arrayContains(types, "DataFiles");
        }
        if (itemType === "Audios") {
            return Lib.arrayContains(types, "Audios");
        }
        return false;
    }

    function isExtInNodesOfType(nodeRecords, extLower, targetType) {
        if (!extLower) return false;
        for (var i = 0; i < nodeRecords.length; i++) {
            var r = nodeRecords[i].node && nodeRecords[i].node.rules;
            if (r && nodeSupportsType(r, targetType) && Lib.arrayContainsIgnoreCase(r.extensions, extLower)) {
                return true;
            }
        }
        return false;
    }


    // Cria o classificador com cache interno por (tipo|extensao).
    // O cache e desativado automaticamente quando alguma pasta usa nameFilter,
    // pois nesse caso o resultado depende do nome do item.
    function createMatcher(nodeRecords) {
        var cache = {};
        var hasNameFilters = false;

        for (var nf = 0; nf < nodeRecords.length; nf++) {
            var nfRules = (nodeRecords[nf].node && nodeRecords[nf].node.rules) || {};
            if (nfRules.nameFilter && Lib.trimStr(nfRules.nameFilter) !== "") {
                hasNameFilters = true;
                break;
            }
        }

        function findMatchingNode(itemType, fileExt, itemName) {
            var extLower = fileExt ? String(fileExt).toLowerCase() : "";
            var cacheKey = null;

            if (!hasNameFilters) {
                cacheKey = itemType + "|" + extLower;
                if (cache.hasOwnProperty(cacheKey)) return cache[cacheKey];
            }

            var bestCandidate = null;
            var bestScore = -1;

            function evaluateForType(typeToTest) {
                for (var i = 0; i < nodeRecords.length; i++) {
                    var rec = nodeRecords[i];
                    var rules = (rec.node && rec.node.rules) || {};
                    var hasTypes = (rules.types && rules.types.length > 0);
                    var hasExts = (rules.extensions && rules.extensions.length > 0);
                    var hasNameRule = Boolean(rules.nameFilter && Lib.trimStr(rules.nameFilter) !== "");

                    if (!hasTypes && !hasExts && !hasNameRule) continue; // pasta estrutural

                    var typeOk = hasTypes ? nodeSupportsType(rules, typeToTest) : false;
                    var extOk = (hasExts && extLower) ? Lib.arrayContainsIgnoreCase(rules.extensions, extLower) : false;

                    // 1. Filtro por nomenclatura tem prioridade maxima
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

                    // 2. Tipos sem extensao (MainComp, PreComps, Solids)
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

                    // 3. No com apenas lista de extensoes (sem tipo) que casou
                    if (!hasTypes && hasExts && extOk) {
                        var extOnlyScore = 850 + rec.depth * 10 - Math.min(rules.extensions.length, 50);
                        if (extOnlyScore > bestScore) {
                            bestScore = extOnlyScore;
                            bestCandidate = { rec: rec, matchedViaCatchOthers: false };
                        }
                        continue;
                    }

                    if (!typeOk) continue;

                    // 4. Tipo + extensao explicita
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

                    // 5. Tipo sem restricao de extensao
                    if (!hasExts && !rules.catchOthers) {
                        var openTypeScore = 400 + rec.depth * 10;
                        if (openTypeScore > bestScore) {
                            bestScore = openTypeScore;
                            bestCandidate = { rec: rec, matchedViaCatchOthers: false };
                        }
                        continue;
                    }

                    // 6. Pasta coringa (OTHERS)
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

            // Fallback: ImageSequences/DataFiles sem no dedicado caem em Videos
            if (!bestCandidate && (itemType === "ImageSequences" || itemType === "DataFiles")) {
                evaluateForType("Videos");
            }

            if (cacheKey) cache[cacheKey] = bestCandidate;
            return bestCandidate;
        }

        return {
            nodeRecords: nodeRecords,
            hasNameFilters: hasNameFilters,
            findMatchingNode: findMatchingNode
        };
    }

    $.global.OrgRules = {
        matchesNameFilter: matchesNameFilter,
        nodeSupportsType: nodeSupportsType,
        isExtInNodesOfType: isExtInNodesOfType,
        createMatcher: createMatcher
    };
})();

