/* ==========================================================================
   TidyFlow — CollectEngine
   Lógica pura do Collect Files no lado CEP (Node). Nesta etapa:
     - regras de nome para o disco (COLLECT_FILES_SPEC.md §5)
     - frames de sequências de imagens
     - estimativa do rodapé: nº de arquivos e tamanho total (§2)
   Funciona no CEP (window.CollectEngine) e no Node (module.exports) para testes.
   ========================================================================== */
(function (root) {
  "use strict";

  /* ---------- Regras de nome (§5) ---------- */

  // Cada caractere inválido vira "-" (sem agrupar); ponto/espaço no fim vira "-";
  // nome reservado do Windows recebe "-" no fim.
  function sanitizeSegment(name) {
    var s = String(name == null ? "" : name).replace(/[\\/:*?"<>|]/g, "-");
    s = s.replace(/[. ]+$/, function (m) { return new Array(m.length + 1).join("-"); });
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i.test(s)) s += "-";
    return s === "" ? "-" : s;
  }

  function defaultCollectFolderName(projectName) {
    var base = (projectName || "Projeto").replace(/\.[^.]+$/, "");
    return sanitizeSegment(base) + "_Collect";
  }

  function splitPath(p) {
    var str = String(p || "");
    var idx = Math.max(str.lastIndexOf("\\"), str.lastIndexOf("/"));
    return { dir: idx >= 0 ? str.substring(0, idx) : "", base: idx >= 0 ? str.substring(idx + 1) : str };
  }

  function joinPath(dir, name) {
    if (!dir) return name;
    var sep = dir.indexOf("\\") >= 0 ? "\\" : "/";
    return dir.replace(/[\\/]+$/, "") + sep + name;
  }

  /* ---------- Sequências de imagens (§5.5) ---------- */

  function parseFrameName(name) {
    var m = /^(.*?)(\d+)\.([A-Za-z0-9]+)$/.exec(String(name || ""));
    if (!m) return null;
    return { base: m[1], digits: m[2], ext: m[3].toLowerCase() };
  }

  // Nome da subpasta da sequência: nome-base sem numeração e sem separador final;
  // sem nome-base (ex.: 0001.png) usa o nome da pasta de origem.
  function sequenceFolderName(firstFramePath) {
    var parts = splitPath(firstFramePath);
    var info = parseFrameName(parts.base);
    var base = info ? info.base.replace(/[_\-. ]+$/, "") : "";
    if (!base) base = splitPath(parts.dir).base;
    return sanitizeSegment(base);
  }

  function isFrameOf(info, fileName) {
    var p = parseFrameName(fileName);
    return !!(p && p.ext === info.ext && p.base.toLowerCase() === info.base.toLowerCase());
  }

  /* ---------- Acesso a disco (injetável para testes) ---------- */

  function getNodeFs() {
    try {
      var req = (root.cep_node && typeof root.cep_node.require === "function") ? root.cep_node.require
        : (typeof require === "function" ? require : null);
      if (!req) return null;
      var fs = req("fs");
      return {
        stat: function (p) {
          return new Promise(function (resolve) {
            fs.stat(p, function (err, st) { resolve(err ? null : { size: st.size, isFile: st.isFile() }); });
          });
        },
        readdir: function (d) {
          return new Promise(function (resolve) {
            fs.readdir(d, function (err, list) { resolve(err ? null : list); });
          });
        }
      };
    } catch (e) {
      return null;
    }
  }

  /* ---------- Funções puras da estimativa (testáveis sem disco) ---------- */

  /**
   * Decide quais arquivos de origem entram no Collect.
   * Obedecer proxy: itens com proxy entram só com o proxy; sem a opção,
   * original e proxy entram (proxy vai ao lado do original, §5.6).
   * Retorna { sources: [{path,isSequence}], offlineItems, proxyCount, sequenceCount }
   */
  function planSources(scan, opts) {
    var options = opts || {};
    var items = (scan && scan.items) || [];
    var sources = [];
    var seen = {};
    var result = { sources: sources, offlineItems: 0, proxyCount: 0, sequenceCount: 0 };

    function add(path, isSeq, isMogrt) {
      if (!path) return;
      var key = path.toLowerCase();
      if (seen[key]) return;
      seen[key] = true;
      sources.push({ path: path, isSequence: !!isSeq, isMogrt: !!isMogrt });
      if (isSeq) result.sequenceCount++;
    }

    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var hasProxy = !!it.proxyPath;
      if (!(options.obeyProxy && hasProxy)) {
        if (it.missing) result.offlineItems++;
        else add(it.path, it.isSequence, it.isMogrt);
      }
      if (hasProxy) {
        result.proxyCount++;
        add(it.proxyPath, it.proxyIsSequence, false);
      }
    }
    return result;
  }

  // Frames da mesma sequência numa listagem de pasta (mesmo nome-base e extensão).
  function framesFromListing(firstFramePath, names) {
    var parts = splitPath(firstFramePath);
    var info = parseFrameName(parts.base);
    if (!info || !names) return [firstFramePath];
    var frames = [];
    for (var i = 0; i < names.length; i++) {
      if (isFrameOf(info, names[i])) frames.push(joinPath(parts.dir, names[i]));
    }
    return frames.length ? frames : [firstFramePath];
  }

  // Remove duplicados (sem diferenciar maiúsculas) de listas de arquivos.
  function uniqueFiles(lists) {
    var files = [];
    var seen = {};
    for (var a = 0; a < lists.length; a++) {
      for (var b = 0; b < lists[a].length; b++) {
        var k = lists[a][b].toLowerCase();
        if (!seen[k]) { seen[k] = true; files.push(lists[a][b]); }
      }
    }
    return files;
  }

  // Soma os tamanhos; stat nulo = arquivo não encontrado no disco.
  function summarize(plan, files, stats) {
    var total = 0, count = 0, missing = [];
    for (var r = 0; r < files.length; r++) {
      if (stats[r] && stats[r].isFile !== false) { total += stats[r].size; count++; }
      else missing.push(files[r]);
    }
    return {
      fileCount: count,
      totalBytes: total,
      offlineItems: plan.offlineItems,
      missingFiles: missing,
      proxyCount: plan.proxyCount,
      sequenceCount: plan.sequenceCount
    };
  }

  /* ---------- Estimativa (§2, rodapé) ---------- */

  /**
   * Cria um estimador com cache de stat/readdir (reaproveitado ao trocar de modo).
   * fsApi: { stat(path) -> Promise<{size,isFile}|null>, readdir(dir) -> Promise<string[]|null> }
   */
  function createEstimator(fsApi) {
    var api = fsApi || getNodeFs();
    var statCache = {};
    var dirCache = {};
    var activeToken = 0;

    function cancel() {
      activeToken++;
    }

    function statCached(p) {
      var key = p.toLowerCase();
      if (!statCache[key]) statCache[key] = api.stat(p);
      return statCache[key];
    }

    function readdirCached(d) {
      var key = d.toLowerCase();
      if (!dirCache[key]) dirCache[key] = api.readdir(d);
      return dirCache[key];
    }

    // Expande um arquivo de origem na lista de arquivos físicos (frames, se sequência; irmãos, se MOGRT).
    function expandSource(source) {
      if (source.isSequence) {
        return readdirCached(splitPath(source.path).dir).then(function (names) {
          return framesFromListing(source.path, names);
        });
      }
      if (source.isMogrt) {
        var parts = splitPath(source.path);
        var parentBase = splitPath(parts.dir).base;
        if (parentBase && parentBase.toLowerCase() !== "motion graphics template media") {
          return readdirCached(parts.dir).then(function (names) {
            if (!names || !names.length) return [source.path];
            var out = [];
            for (var i = 0; i < names.length; i++) out.push(joinPath(parts.dir, names[i]));
            return out;
          });
        }
      }
      return Promise.resolve([source.path]);
    }

    /**
     * scan: retorno de $.global.collectScan (items[]).
     * opts: { obeyProxy: bool }
     * Resolve { fileCount, totalBytes, offlineItems, missingFiles[], proxyCount, sequenceCount }
     */
    function estimate(scan, opts) {
      var myToken = ++activeToken;
      var plan = planSources(scan, opts);
      if (!api) {
        var empty = summarize(plan, [], []);
        empty.error = "Node.js indisponível";
        return Promise.resolve(empty);
      }
      var expansions = [];
      for (var s = 0; s < plan.sources.length; s++) expansions.push(expandSource(plan.sources[s]));
      return Promise.all(expansions).then(function (lists) {
        if (myToken !== activeToken) {
          var err = new Error("Estimativa cancelada");
          err.canceled = true;
          return Promise.reject(err);
        }
        var files = uniqueFiles(lists);
        var stats = [];
        for (var f = 0; f < files.length; f++) stats.push(statCached(files[f]));
        return Promise.all(stats).then(function (results) {
          if (myToken !== activeToken) {
            var err2 = new Error("Estimativa cancelada");
            err2.canceled = true;
            return Promise.reject(err2);
          }
          return summarize(plan, files, results);
        });
      });
    }

    function clearCache() {
      statCache = {};
      dirCache = {};
    }

    return { estimate: estimate, cancel: cancel, clearCache: clearCache };
  }

  /* ---------- Formatação ---------- */

  // 1024-based, uma casa decimal com vírgula (ex.: "8,5 GB").
  function formatBytes(bytes) {
    var units = ["B", "KB", "MB", "GB", "TB"];
    var v = Number(bytes) || 0;
    var u = 0;
    while (v >= 1024 && u < units.length - 1) { v /= 1024; u++; }
    var txt = u === 0 ? String(Math.round(v)) : (Math.round(v * 10) / 10).toFixed(1).replace(".", ",");
    return txt + " " + units[u];
  }

  function formatTimeRemaining(seconds) {
    var s = Math.round(Number(seconds));
    if (isNaN(s) || s < 0 || !isFinite(s)) return "calculando...";
    if (s < 1) return "menos de 1 segundo";
    if (s === 1) return "1 segundo";
    if (s < 60) return s + " segundos";
    var mins = Math.floor(s / 60);
    var remSecs = s % 60;
    if (mins < 60) {
      if (remSecs === 0) return mins + (mins === 1 ? " minuto" : " minutos");
      return mins + " min e " + remSecs + " s";
    }
    var hours = Math.floor(mins / 60);
    var remMins = mins % 60;
    return hours + " h e " + remMins + " min";
  }

  /* ---------- Reescrita de .aepx (XML) ---------- */

  function xmlEscape(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  function xmlUnescape(s) {
    return String(s || "")
      .replace(/&quot;/g, "\"")
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#x([0-9a-fA-F]+);/g, function (m, h) { return String.fromCharCode(parseInt(h, 16)); })
      .replace(/&#(\d+);/g, function (m, d) { return String.fromCharCode(parseInt(d, 10)); })
      .replace(/&amp;/g, "&");
  }

  function refContext(text, offset) {
    var pin = text.lastIndexOf("<Pin>", offset);
    var pinEnd = text.lastIndexOf("</Pin>", offset);
    var lom = text.lastIndexOf("<LOm>", offset);
    var lomEnd = text.lastIndexOf("</LOm>", offset);
    if (pin > pinEnd && pin > lom) return "footage";
    if (lom > lomEnd && lom > pin) return "render queue";
    return "outro";
  }

  function rewriteAepxXml(text, fileMap, folderMap, stats) {
    var fMap = fileMap || {};
    var dMap = folderMap || {};
    return String(text || "").replace(/<fileReference\b[^>]*\/>/g, function (tag, offset) {
      var m = /fullpath="([^"]*)"/.exec(tag);
      if (!m) return tag;
      var oldPath = xmlUnescape(m[1]);
      var isFolder = /target_is_folder="1"/.test(tag);
      var ctx = refContext(text, offset);
      var key = oldPath.toLowerCase();
      var nw = null;
      if (ctx === "footage") nw = isFolder ? dMap[key] : fMap[key];
      if (stats) stats.push({ ctx: ctx, isFolder: isFolder, old: oldPath, nw: nw || "" });
      if (!nw) return tag;
      var out = tag.replace(/fullpath="[^"]*"/, "fullpath=\"" + xmlEscape(nw) + "\"");
      out = out.replace(/\s+ascendcount_base="[^"]*"/, "").replace(/\s+ascendcount_target="[^"]*"/, "");
      return out;
    });
  }

  /* ---------- Reescrita e Forense de .prproj (Premiere Pro XML) ---------- */

  function canonPathKey(p) {
    var s = String(p || "").replace(/^\\\\\?\\/, "");
    if (/^file:\/\/\//i.test(s)) {
      try { s = decodeURIComponent(s.replace(/^file:\/\/\//i, "")); } catch (eU) { s = s.replace(/^file:\/\/\//i, ""); }
    }
    return s.replace(/\//g, "\\").replace(/\\+$/, "").toLowerCase();
  }

  function normalizeLookupMap(rawMap) {
    var out = {};
    var src = rawMap || {};
    for (var k in src) {
      if (Object.prototype.hasOwnProperty.call(src, k) && src[k]) {
        out[canonPathKey(k)] = src[k];
      }
    }
    return out;
  }

  function formatPathMatchingStyle(newPath, sampleOldPath) {
    var oldStr = String(sampleOldPath || "");
    var newStr = String(newPath || "");
    if (/^file:\/\/\//i.test(oldStr)) {
      var posixUrl = newStr.replace(/\\/g, "/").replace(/^\/+/, "");
      return "file:///" + encodeURI(posixUrl);
    }
    var prefersBackslash = oldStr.indexOf("\\") >= 0 || (oldStr.indexOf("/") < 0 && /^[A-Za-z]:/.test(newStr));
    return prefersBackslash ? newStr.replace(/\//g, "\\") : newStr.replace(/\\/g, "/");
  }

  function computeRelativePathPure(fromDir, toFile, sampleOldRel) {
    if (!fromDir || !toFile) return "";
    var useBackslash = String(sampleOldRel || fromDir).indexOf("\\") >= 0 || /^[A-Za-z]:/.test(String(toFile));
    var sep = useBackslash ? "\\" : "/";
    var fParts = String(fromDir).replace(/[\\/]+$/, "").split(/[\\/]+/);
    var tParts = String(toFile).split(/[\\/]+/);
    if (!fParts.length || !tParts.length) return "";
    if (/^[A-Za-z]:$/.test(fParts[0]) && /^[A-Za-z]:$/.test(tParts[0])) {
      if (fParts[0].toLowerCase() !== tParts[0].toLowerCase()) {
        return useBackslash ? String(toFile).replace(/\//g, "\\") : String(toFile).replace(/\\/g, "/");
      }
    }
    var common = 0;
    var minLen = Math.min(fParts.length, tParts.length);
    while (common < minLen && fParts[common].toLowerCase() === tParts[common].toLowerCase()) {
      common++;
    }
    var rel = [];
    for (var u = common; u < fParts.length; u++) rel.push("..");
    for (var d = common; d < tParts.length; d++) rel.push(tParts[d]);
    var joined = rel.join(sep);
    if (sampleOldRel && /^\.[\\/]/.test(String(sampleOldRel)) && !/^\.\./.test(joined)) {
      joined = "." + sep + joined;
    }
    return joined;
  }

  /**
   * Reescreve referências de mídia e proxy no XML descompactado de um .prproj.
   * - Dentro de blocos <Media>...</Media>: atualiza <FilePath>, <ActualMediaFilePath>
   *   e recalcula <RelativePath> em relação a destRootDir.
   * - Fora de <Media>: atualiza tags de caminho de arquivo cujo valor seja match
   *   exato em fileMap (ignorando tags de saída/export/preview/capture).
   */
  function rewritePrprojXml(xmlText, fileMap, folderMap, destRootDir, stats) {
    var fMap = normalizeLookupMap(fileMap);
    var dMap = normalizeLookupMap(folderMap);

    // 1. Reescrever blocos <Media ...>...</Media> (onde residem mídias full-res, camadas PSD, sequências e proxies)
    var step1 = String(xmlText || "").replace(/<Media\b[^>]*>[\s\S]*?<\/Media>/g, function (mediaBlock) {
      var matchedDest = null;

      var updatedBlock = mediaBlock.replace(
        /<(FilePath|ActualMediaFilePath|MediaFilePath)(\b[^>]*)>([^<]*)<\/\1>/g,
        function (fullTag, tagName, attrs, rawVal) {
          var oldPath = xmlUnescape(rawVal);
          var key = canonPathKey(oldPath);
          var nw = fMap[key] || dMap[key] || null;
          if (stats) {
            stats.push({ ctx: "Media/" + tagName, old: oldPath, nw: nw || "" });
          }
          if (!nw) return fullTag;
          matchedDest = nw;
          var formatted = formatPathMatchingStyle(nw, oldPath);
          return "<" + tagName + attrs + ">" + xmlEscape(formatted) + "</" + tagName + ">";
        }
      );

      if (matchedDest && destRootDir) {
        updatedBlock = updatedBlock.replace(
          /<RelativePath(\b[^>]*)>([^<]*)<\/RelativePath>/g,
          function (relTag, attrs, rawRel) {
            var oldRel = xmlUnescape(rawRel);
            var newRel = computeRelativePathPure(destRootDir, matchedDest, oldRel);
            if (!newRel) return relTag;
            if (stats) {
              stats.push({ ctx: "Media/RelativePath", old: oldRel, nw: newRel });
            }
            return "<RelativePath" + attrs + ">" + xmlEscape(newRel) + "</RelativePath>";
          }
        );
      }

      return updatedBlock;
    });

    // 2. Qualquer outra tag de caminho fora de <Media> com match EXATO em fMap
    var step2 = step1.replace(
      /<([A-Za-z0-9_.:-]+Path[A-Za-z0-9_.:-]*)(\b[^>]*)>([^<\r\n]+)<\/\1>/g,
      function (fullTag, tagName, attrs, rawVal) {
        if (/output|export|preview|capture|scratch|autosave/i.test(tagName)) {
          return fullTag;
        }
        var oldPath = xmlUnescape(rawVal);
        var key = canonPathKey(oldPath);
        var nw = fMap[key] || null;
        if (!nw) return fullTag;
        var formatted = formatPathMatchingStyle(nw, oldPath);
        if (stats) {
          stats.push({ ctx: "Other/" + tagName, old: oldPath, nw: formatted });
        }
        return "<" + tagName + attrs + ">" + xmlEscape(formatted) + "</" + tagName + ">";
      }
    );

    return step2;
  }

  /**
   * Diagnóstico forense (Fase 0): inspeciona o XML do .prproj para levantar todas
   * as tags onde os caminhos coletados aparecem antes e depois da reescrita.
   */
  function inspectPrprojXml(xmlText, fileMap) {
    var fMap = normalizeLookupMap(fileMap);
    var tagCounts = {};
    var samples = [];
    var text = String(xmlText || "");

    var rx = /<([A-Za-z0-9_.:-]+)(?:\s[^>]*)?>([^<\r\n]{3,600})<\/\1>/g;
    var m;
    while ((m = rx.exec(text)) !== null) {
      var tName = m[1];
      var val = xmlUnescape(m[2]);
      var k = canonPathKey(val);
      if (fMap[k]) {
        tagCounts[tName] = (tagCounts[tName] || 0) + 1;
        if (samples.length < 15) {
          samples.push("<" + tName + ">" + val + "</" + tName + ">");
        }
      }
    }

    var relSamples = [];
    var relRx = /<RelativePath(?:\s[^>]*)?>([^<\r\n]+)<\/RelativePath>/g;
    var rm;
    while ((rm = relRx.exec(text)) !== null && relSamples.length < 6) {
      relSamples.push(xmlUnescape(rm[1]));
    }

    return {
      tagCounts: tagCounts,
      samples: samples,
      relativePathSamples: relSamples
    };
  }

  /* ---------- Planejador de Destino e Arquivos (§5) ---------- */

  function uniqueDestName(usedMap, destDir, name, srcKey) {
    var dirKey = destDir.toLowerCase();
    if (!usedMap[dirKey]) usedMap[dirKey] = {};
    var bucket = usedMap[dirKey];
    var m = /^(.*?)(\.[^.]*)?$/.exec(name);
    var base = m[1];
    var ext = m[2] || "";
    var candidate = name;
    var n = 1;
    while (bucket[candidate.toLowerCase()] && bucket[candidate.toLowerCase()] !== srcKey) {
      candidate = base + "_" + n + ext;
      n++;
    }
    bucket[candidate.toLowerCase()] = srcKey;
    return candidate;
  }

  function buildCollectPlan(scan, opts, footageRoot, fsReaddir) {
    var options = opts || {};
    var items = (scan && scan.items) || [];
    var fRoot = footageRoot ? footageRoot.replace(/[\\/]+$/, "") : "";
    var sep = fRoot.indexOf("\\") >= 0 ? "\\" : "/";

    var fileCopies = [];
    var fileMap = {};
    var folderMap = {};
    var usedNames = {};
    var copiedBySrc = {};
    var offlineItems = [];
    var itemNames = {};
    var itemRelinks = {};

    function addCopy(srcPath, destDir, isSeq, isMogrt, clipName) {
      if (!srcPath) return "";
      var key = srcPath.toLowerCase();
      var parts = splitPath(srcPath);

      if (isSeq) {
        if (copiedBySrc[key]) return copiedBySrc[key];
        var names = null;
        if (typeof fsReaddir === "function") {
          try { names = fsReaddir(parts.dir); } catch (eR) {}
        }
        var frames = framesFromListing(srcPath, names);
        var seqDirName = uniqueDestName(usedNames, destDir, sequenceFolderName(srcPath), key + "_seqdir");
        var seqDestDir = destDir + sep + seqDirName;

        for (var f = 0; f < frames.length; f++) {
          var frameBase = splitPath(frames[f]).base;
          var fDest = seqDestDir + sep + frameBase;
          fileCopies.push({ src: frames[f], dest: fDest });
          fileMap[frames[f].toLowerCase()] = fDest;
        }

        folderMap[parts.dir.toLowerCase()] = seqDestDir;
        var firstFrameDest = seqDestDir + sep + parts.base;
        fileMap[key] = firstFrameDest;
        copiedBySrc[key] = firstFrameDest;
        return firstFrameDest;
      }

      if (isMogrt) {
        if (copiedBySrc[key]) return copiedBySrc[key];
        var parentBase = splitPath(parts.dir).base;
        var isDedicatedMogrtSubdir = parentBase && parentBase.toLowerCase() !== "motion graphics template media";
        if (isDedicatedMogrtSubdir) {
          var mogrtDirSafe = uniqueDestName(usedNames, destDir, sanitizeSegment(parentBase), parts.dir.toLowerCase() + "_mogrt");
          var mogrtDestDir = destDir + sep + mogrtDirSafe;
          var sibNames = null;
          if (typeof fsReaddir === "function") {
            try { sibNames = fsReaddir(parts.dir); } catch (eM) {}
          }
          if (sibNames && sibNames.length > 0) {
            for (var s = 0; s < sibNames.length; s++) {
              var sibSrc = joinPath(parts.dir, sibNames[s]);
              var sibDest = mogrtDestDir + sep + sanitizeSegment(sibNames[s]);
              fileCopies.push({ src: sibSrc, dest: sibDest });
              fileMap[sibSrc.toLowerCase()] = sibDest;
              copiedBySrc[sibSrc.toLowerCase()] = sibDest;
            }
          }
          var mainMogrtDest = mogrtDestDir + sep + sanitizeSegment(parts.base);
          if (!copiedBySrc[key]) {
            fileCopies.push({ src: srcPath, dest: mainMogrtDest });
            fileMap[key] = mainMogrtDest;
            copiedBySrc[key] = mainMogrtDest;
          }
          folderMap[parts.dir.toLowerCase()] = mogrtDestDir;
          return copiedBySrc[key];
        }
      }

      if (copiedBySrc[key]) return copiedBySrc[key];

      var candidateName = parts.base;
      if (options.renameToClipName && clipName && typeof clipName === "string") {
        var cleanClip = clipName.trim();
        if (cleanClip) {
          var extMatch = /\.[^.]+$/.exec(parts.base);
          var origExt = extMatch ? extMatch[0] : "";
          var clipExtMatch = /\.[^.]+$/.exec(cleanClip);
          if (!clipExtMatch && origExt) {
            candidateName = cleanClip + origExt;
          } else {
            candidateName = cleanClip;
          }
        }
      }

      var safeName = sanitizeSegment(candidateName);
      var finalName = uniqueDestName(usedNames, destDir, safeName, key);
      var destFile = destDir + sep + finalName;
      fileCopies.push({ src: srcPath, dest: destFile });
      fileMap[key] = destFile;
      copiedBySrc[key] = destFile;
      return destFile;
    }

    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      itemNames[it.id] = it.name;

      if (it.missing) {
        offlineItems.push(it);
        continue;
      }

      var sanitizedFolders = [];
      if (it.folders && it.folders.length) {
        for (var d = 0; d < it.folders.length; d++) {
          sanitizedFolders.push(sanitizeSegment(it.folders[d]));
        }
      }
      var targetDir = sanitizedFolders.length ? fRoot + sep + sanitizedFolders.join(sep) : fRoot;

      var hasProxy = !!it.proxyPath;
      var newMain = "";
      var newPrx = "";
      if (!(options.obeyProxy && hasProxy)) {
        newMain = addCopy(it.path, targetDir, it.isSequence, it.isMogrt, it.name);
      }
      if (hasProxy) {
        newPrx = addCopy(it.proxyPath, targetDir, it.proxyIsSequence, false, null);
      }
      itemRelinks[it.id] = {
        newPath: newMain,
        newProxyPath: newPrx
      };
    }

    return {
      fileCopies: fileCopies,
      fileMap: fileMap,
      folderMap: folderMap,
      offlineItems: offlineItems,
      itemNames: itemNames,
      itemRelinks: itemRelinks
    };
  }

  /* ---------- Geração de Report.txt (§9) ---------- */

  function buildReportText(data) {
    var d = data || {};
    var lines = [];
    lines.push("======================================================================");
    lines.push("TIDYFLOW - RELATÓRIO DE COLLECT DE PROJETO");
    lines.push("======================================================================");
    lines.push("Data da Coleta:     " + (d.date || new Date().toLocaleString()));
    lines.push("Aplicativo Host:    " + (d.hostName || "Adobe After Effects"));
    lines.push("Projeto de Origem:  " + (d.projectPath || ""));
    lines.push("Destino do Collect: " + (d.destPath || ""));
    lines.push("Modo de Coleta:     " + (d.modeLabel || d.mode || ""));
    lines.push("");
    lines.push("----------------------------------------------------------------------");
    lines.push("1. RESUMO GERAL");
    lines.push("----------------------------------------------------------------------");
    lines.push("Arquivos Coletados: " + (d.collectedCount || 0) + " arquivo(s)");
    lines.push("Tamanho Total:      " + formatBytes(d.totalBytes || 0));
    lines.push("Mídias Offline:     " + (d.offlineCount || 0));
    lines.push("Proxies Coletados:  " + (d.proxyCount || 0));
    lines.push("");
    lines.push("----------------------------------------------------------------------");
    lines.push("2. FONTES TIPOGRÁFICAS UTILIZADAS");
    lines.push("----------------------------------------------------------------------");
    if (d.fonts && d.fonts.length) {
      for (var f = 0; f < d.fonts.length; f++) lines.push("- " + d.fonts[f]);
    } else {
      lines.push("(Nenhuma fonte tipográfica externa detectada)");
    }
    lines.push("");
    lines.push("----------------------------------------------------------------------");
    lines.push("3. EFEITOS E PLUGINS UTILIZADOS");
    lines.push("----------------------------------------------------------------------");
    if (d.effects && d.effects.length) {
      for (var e = 0; e < d.effects.length; e++) {
        var fx = d.effects[e];
        lines.push("- " + (fx.name || fx.matchName) + " (" + fx.matchName + ")");
      }
    } else {
      lines.push("(Nenhum efeito utilizado)");
    }
    lines.push("");
    lines.push("----------------------------------------------------------------------");
    lines.push("4. INVENTÁRIO DE ARQUIVOS COLETADOS");
    lines.push("----------------------------------------------------------------------");
    if (d.files && d.files.length) {
      for (var i = 0; i < d.files.length; i++) {
        lines.push("[OK] " + d.files[i]);
      }
    } else {
      lines.push("(Nenhum arquivo copiado)");
    }
    if (d.comments && String(d.comments).trim()) {
      lines.push("");
      lines.push("----------------------------------------------------------------------");
      lines.push("5. COMENTÁRIOS");
      lines.push("----------------------------------------------------------------------");
      lines.push(String(d.comments).trim());
    }
    lines.push("");
    lines.push("----------------------------------------------------------------------");
    lines.push("6. AVISOS");
    lines.push("----------------------------------------------------------------------");
    lines.push("- Fontes são listadas apenas como referência e não são copiadas para a pasta.");
    lines.push("- Texturas externas de plugins 3D, LUTs em efeitos e arquivos linkados por expressão não são cobertos.");
    lines.push("======================================================================");
    return lines.join("\r\n");
  }

  /* ---------- Árvore Hierárquica de Alvos (Composições / Sequências) ---------- */

  function buildTargetTree(targets) {
    var root = {
      name: "",
      path: "",
      foldersList: [],
      foldersMap: {},
      items: []
    };

    if (!targets || !targets.length) return root;

    for (var i = 0; i < targets.length; i++) {
      var t = targets[i];
      var fList = t.folders || [];
      var curr = root;
      var currentPath = "";

      for (var f = 0; f < fList.length; f++) {
        var fName = fList[f];
        currentPath = currentPath ? (currentPath + "/" + fName) : fName;
        if (!curr.foldersMap[fName]) {
          var fLabel = (t.folderLabels && typeof t.folderLabels[f] === "number") ? t.folderLabels[f] : 0;
          var fNode = {
            name: fName,
            path: currentPath,
            label: fLabel,
            foldersList: [],
            foldersMap: {},
            items: []
          };
          curr.foldersMap[fName] = fNode;
          curr.foldersList.push(fNode);
        }
        curr = curr.foldersMap[fName];
      }
      curr.items.push(t);
    }

    return root;
  }

  function countFolderTargets(node) {
    if (!node) return { total: 0, selected: 0 };
    var total = node.items ? node.items.length : 0;
    var selected = 0;
    if (node.items) {
      for (var i = 0; i < node.items.length; i++) {
        if (node.items[i].selected) selected++;
      }
    }
    if (node.foldersList) {
      for (var f = 0; f < node.foldersList.length; f++) {
        var subRes = countFolderTargets(node.foldersList[f]);
        total += subRes.total;
        selected += subRes.selected;
      }
    }
    return { total: total, selected: selected };
  }

  function setFolderTargetsSelected(node, isSelected) {
    if (!node) return;
    if (node.items) {
      for (var i = 0; i < node.items.length; i++) {
        node.items[i].selected = Boolean(isSelected);
      }
    }
    if (node.foldersList) {
      for (var f = 0; f < node.foldersList.length; f++) {
        setFolderTargetsSelected(node.foldersList[f], isSelected);
      }
    }
  }

  // Estado inicial das pastas na árvore de alvos:
  // - nenhuma comp selecionada  -> todas as pastas fechadas;
  // - uma ou mais selecionadas  -> abertas apenas as pastas (e ancestrais) que
  //   contêm comps selecionadas; todas as demais ficam fechadas.
  // Retorna mapa { "caminho/da/pasta": true } das pastas recolhidas.
  function computeInitialCollapsed(targets) {
    var collapsed = {};
    var expanded = {};
    if (!targets || !targets.length) return collapsed;

    for (var i = 0; i < targets.length; i++) {
      var t = targets[i];
      var fList = t.folders || [];
      var path = "";
      for (var f = 0; f < fList.length; f++) {
        path = path ? (path + "/" + fList[f]) : fList[f];
        if (t.selected) expanded[path] = true;
        else if (!expanded[path]) collapsed[path] = true;
      }
    }
    for (var p in expanded) {
      if (expanded.hasOwnProperty(p)) delete collapsed[p];
    }
    return collapsed;
  }

  var CollectEngine = {
    sanitizeSegment: sanitizeSegment,
    defaultCollectFolderName: defaultCollectFolderName,
    parseFrameName: parseFrameName,
    sequenceFolderName: sequenceFolderName,
    planSources: planSources,
    framesFromListing: framesFromListing,
    uniqueFiles: uniqueFiles,
    summarize: summarize,
    createEstimator: createEstimator,
    formatBytes: formatBytes,
    formatTimeRemaining: formatTimeRemaining,
    rewriteAepxXml: rewriteAepxXml,
    rewritePrprojXml: rewritePrprojXml,
    inspectPrprojXml: inspectPrprojXml,
    computeRelativePathPure: computeRelativePathPure,
    canonPathKey: canonPathKey,
    buildCollectPlan: buildCollectPlan,
    buildReportText: buildReportText,
    buildTargetTree: buildTargetTree,
    countFolderTargets: countFolderTargets,
    setFolderTargetsSelected: setFolderTargetsSelected,
    computeInitialCollapsed: computeInitialCollapsed
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = CollectEngine;
  }
  if (typeof root !== "undefined") {
    root.CollectEngine = CollectEngine;
  }
  if (typeof window !== "undefined") {
    window.CollectEngine = CollectEngine;
  }
})(typeof window !== "undefined" ? window : this);
