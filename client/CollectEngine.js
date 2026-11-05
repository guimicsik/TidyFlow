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

    function add(path, isSeq) {
      if (!path) return;
      var key = path.toLowerCase();
      if (seen[key]) return;
      seen[key] = true;
      sources.push({ path: path, isSequence: !!isSeq });
      if (isSeq) result.sequenceCount++;
    }

    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var hasProxy = !!it.proxyPath;
      if (!(options.obeyProxy && hasProxy)) {
        if (it.missing) result.offlineItems++;
        else add(it.path, it.isSequence);
      }
      if (hasProxy) {
        result.proxyCount++;
        add(it.proxyPath, it.proxyIsSequence);
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

    // Expande um arquivo de origem na lista de arquivos físicos (frames, se sequência).
    function expandSource(source) {
      if (!source.isSequence) return Promise.resolve([source.path]);
      return readdirCached(splitPath(source.path).dir).then(function (names) {
        return framesFromListing(source.path, names);
      });
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

    function addCopy(srcPath, destDir, isSeq) {
      if (!srcPath) return "";
      var key = srcPath.toLowerCase();
      var parts = splitPath(srcPath);

      if (isSeq) {
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

      if (copiedBySrc[key]) return copiedBySrc[key];

      var safeName = sanitizeSegment(parts.base);
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
      if (!(options.obeyProxy && hasProxy)) {
        addCopy(it.path, targetDir, it.isSequence);
      }
      if (hasProxy) {
        addCopy(it.proxyPath, targetDir, it.proxyIsSequence);
      }
    }

    return {
      fileCopies: fileCopies,
      fileMap: fileMap,
      folderMap: folderMap,
      offlineItems: offlineItems,
      itemNames: itemNames
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
    buildCollectPlan: buildCollectPlan,
    buildReportText: buildReportText
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
