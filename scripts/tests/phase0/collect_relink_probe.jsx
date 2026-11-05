/* ==========================================================================
   TidyFlow — Fase 0 do Collect Files: teste de relink por script (After Effects)

   OBJETIVO
   Verificar se o relink feito por script (item.replace / replaceWithSequence /
   setProxy) deixa o projeto IDÊNTICO ao original, como faz o Collect nativo.

   COMO USAR
   1. Abra no AE um projeto de TESTE já salvo, contendo de preferência:
      - PSD e AI importados como Composição (camadas)
      - uma sequência de PNG/EXR com alpha
      - um vídeo com fps ou loop alterados em Interpret Footage
      - um item com proxy
   2. File > Scripts > Run Script File... > este arquivo.
   3. Escolha a pasta onde a pasta de teste será criada.

   O QUE O SCRIPT FAZ
   1. Registra as propriedades de todos os footages com arquivo (antes).
   2. Salva o projeto original.
   3. Copia os arquivos para <destino>/Collect_Phase0_<projeto>/(Footage)/
      espelhando as pastas do painel Project (regras da COLLECT_FILES_SPEC.md).
   4. Salva uma cópia do projeto nessa pasta (Save As) — a cópia fica aberta.
   5. Relinka originais e proxies para os arquivos copiados.
   6. Compara as propriedades (depois) com as de antes e grava
      Phase0_Report.txt na pasta de teste.
   7. Salva a cópia. O projeto original no disco não é alterado além do save.

   ES3 estrito (sem let/const/arrow/forEach/indexOf de Array/JSON).
   ========================================================================== */

(function () {
    var REPORT = [];
    var IMAGE_EXTS = ["png", "jpg", "jpeg", "tif", "tiff", "exr", "dpx", "tga", "bmp", "cin", "hdr", "sgi", "iff", "dng", "psd"];
    var SRC_PROPS = ["alphaMode", "premulColor", "invertAlpha", "hasAlpha", "conformFrameRate", "nativeFrameRate",
        "fieldSeparationType", "highQualityFieldSeparation", "removePulldown", "loop", "isStill"];
    var SRC_WRITABLE = ["alphaMode", "premulColor", "invertAlpha", "conformFrameRate",
        "fieldSeparationType", "highQualityFieldSeparation", "removePulldown", "loop"];
    var ITEM_PROPS = ["name", "width", "height", "pixelAspect", "duration", "frameRate", "label", "comment",
        "hasVideo", "hasAudio", "useProxy"];

    function log(s) { REPORT.push(s); }

    function contains(arr, v) {
        for (var i = 0; i < arr.length; i++) { if (arr[i] === v) return true; }
        return false;
    }

    function safeGet(obj, prop) {
        try {
            var v = obj[prop];
            if (v === undefined || v === null) return "null";
            return String(v);
        } catch (e) { return "n/a"; }
    }

    function fileExt(name) {
        var m = /\.([^.]+)$/.exec(name);
        return m ? m[1].toLowerCase() : "";
    }

    function decodedName(f) { return File.decode(f.name); }

    /* ---------- Regras de destino (COLLECT_FILES_SPEC.md §5) ---------- */

    function sanitize(n) {
        var s = String(n).replace(/[\\\/:*?"<>|]/g, "-");
        s = s.replace(/[. ]+$/, function (m) { return new Array(m.length + 1).join("-"); });
        if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i.test(s)) s = s + "-";
        if (s === "") s = "-";
        return s;
    }

    function vpathOf(item) {
        var parts = [];
        var rootId = app.project.rootFolder.id;
        var f = item.parentFolder;
        while (f && f.id !== rootId) {
            parts.unshift(sanitize(f.name));
            f = f.parentFolder;
        }
        return parts.join("/");
    }

    function ensureFolder(path) {
        var f = new Folder(path);
        if (f.exists) return true;
        if (f.parent && !f.parent.exists) ensureFolder(f.parent.fsName);
        return f.create();
    }

    // Nomes usados por pasta de destino: { "pasta(lower)": { "nome(lower)": chaveOrigem } }
    var usedNames = {};

    function uniqueName(destDir, name, srcKey) {
        var dirKey = destDir.toLowerCase();
        if (!usedNames[dirKey]) usedNames[dirKey] = {};
        var bucket = usedNames[dirKey];
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

    /* ---------- Sequências de imagens ---------- */

    function parseFrameName(name) {
        var m = /^(.*?)(\d+)\.([A-Za-z0-9]+)$/.exec(name);
        if (!m) return null;
        return { base: m[1], digits: m[2], ext: m[3].toLowerCase() };
    }

    function listSequenceFrames(firstFile) {
        var info = parseFrameName(decodedName(firstFile));
        var frames = [];
        if (!info) { frames.push(firstFile); return { info: null, frames: frames }; }
        var all = firstFile.parent.getFiles();
        for (var i = 0; i < all.length; i++) {
            if (!(all[i] instanceof File)) continue;
            var p = parseFrameName(decodedName(all[i]));
            if (p && p.ext === info.ext && p.base.toLowerCase() === info.base.toLowerCase()) frames.push(all[i]);
        }
        return { info: info, frames: frames };
    }

    function sequenceFolderName(firstFile, info) {
        var base = info ? info.base.replace(/[_\-. ]+$/, "") : "";
        if (base === "") base = File.decode(firstFile.parent.name);
        return sanitize(base);
    }

    function isSequenceSource(src) {
        try {
            if (!src || !src.file) return false;
            return !src.isStill && contains(IMAGE_EXTS, fileExt(decodedName(src.file)));
        } catch (e) { return false; }
    }

    /* ---------- Cópia (deduplicada por arquivo de origem) ---------- */

    var copiedBySrc = {};  // chave de origem -> caminho novo do arquivo apontado
    var copyFailures = [];
    var copiedCount = 0;

    function copyOne(src, destPath) {
        if (new File(destPath).exists) return true;
        var ok = false;
        try { ok = src.copy(destPath); } catch (e) { ok = false; }
        if (ok) copiedCount++; else copyFailures.push(src.fsName + " -> " + destPath);
        return ok;
    }

    // Devolve o novo caminho do arquivo que o item deve apontar.
    function collectFile(srcFile, destDir, isSeq) {
        if (isSeq) {
            var seq = listSequenceFrames(srcFile);
            var seqKey = (srcFile.parent.fsName + "|" + (seq.info ? seq.info.base + "|" + seq.info.ext : decodedName(srcFile))).toLowerCase();
            var seqDir = destDir + "/" + uniqueName(destDir, sequenceFolderName(srcFile, seq.info), seqKey);
            var target = seqDir + "/" + decodedName(srcFile);
            if (copiedBySrc[seqKey]) return copiedBySrc[seqKey].dir + "/" + decodedName(srcFile);
            ensureFolder(seqDir);
            for (var i = 0; i < seq.frames.length; i++) copyOne(seq.frames[i], seqDir + "/" + decodedName(seq.frames[i]));
            copiedBySrc[seqKey] = { dir: seqDir };
            log("    sequência: " + seq.frames.length + " frame(s) -> " + seqDir);
            return target;
        }
        var key = srcFile.fsName.toLowerCase();
        if (copiedBySrc[key]) return copiedBySrc[key].path;
        ensureFolder(destDir);
        var destPath = destDir + "/" + uniqueName(destDir, decodedName(srcFile), key);
        copyOne(srcFile, destPath);
        copiedBySrc[key] = { path: destPath };
        return destPath;
    }

    /* ---------- Snapshot de propriedades ---------- */

    function snapshotSource(src) {
        var s = {};
        for (var i = 0; i < SRC_PROPS.length; i++) s[SRC_PROPS[i]] = safeGet(src, SRC_PROPS[i]);
        return s;
    }

    function snapshotItem(it) {
        var s = { props: {}, main: null, proxy: null, filePath: "", proxyPath: "" };
        for (var i = 0; i < ITEM_PROPS.length; i++) s.props[ITEM_PROPS[i]] = safeGet(it, ITEM_PROPS[i]);
        try { s.main = snapshotSource(it.mainSource); } catch (e1) {}
        try { s.filePath = it.file ? it.file.fsName : ""; } catch (e2) {}
        try {
            if (it.proxySource) {
                s.proxy = snapshotSource(it.proxySource);
                s.proxyPath = it.proxySource.file ? it.proxySource.file.fsName : "";
            }
        } catch (e3) {}
        return s;
    }

    function diffSnap(a, b) {
        var d = [];
        var k;
        for (k in a.props) { if (a.props[k] !== b.props[k]) d.push("item." + k + ": " + a.props[k] + " -> " + b.props[k]); }
        if (a.main && b.main) {
            for (k in a.main) { if (a.main[k] !== b.main[k]) d.push("main." + k + ": " + a.main[k] + " -> " + b.main[k]); }
        }
        if ((a.proxy === null) !== (b.proxy === null)) {
            d.push("proxy: " + (a.proxy ? "existia" : "não existia") + " -> " + (b.proxy ? "existe" : "não existe"));
        } else if (a.proxy && b.proxy) {
            for (k in a.proxy) { if (a.proxy[k] !== b.proxy[k]) d.push("proxy." + k + ": " + a.proxy[k] + " -> " + b.proxy[k]); }
        }
        return d;
    }

    function reapplySource(src, before) {
        for (var i = 0; i < SRC_WRITABLE.length; i++) {
            var p = SRC_WRITABLE[i];
            if (safeGet(src, p) === before[p]) continue;
            try {
                if (p === "premulColor") {
                    var parts = before[p].split(",");
                    src[p] = [parseFloat(parts[0]), parseFloat(parts[1]), parseFloat(parts[2])];
                } else if (before[p] === "true" || before[p] === "false") {
                    src[p] = (before[p] === "true");
                } else {
                    src[p] = Number(before[p]);
                }
            } catch (e) {}
        }
    }

    /* ---------- Principal ---------- */

    if (!app.project || !app.project.file) {
        alert("TidyFlow Fase 0: abra e salve um projeto de teste antes de rodar.");
        return;
    }

    var origFile = app.project.file;
    var projBase = File.decode(origFile.name).replace(/\.aep$/i, "");
    var destParent = Folder.selectDialog("TidyFlow Fase 0: escolha onde criar a pasta de teste do Collect");
    if (!destParent) return;

    var rootPath = destParent.fsName + "/Collect_Phase0_" + sanitize(projBase);
    var rootFolder = new Folder(rootPath);
    if (rootFolder.exists && rootFolder.getFiles().length > 0) {
        alert("A pasta já existe e não está vazia:\n" + rootFolder.fsName + "\n\nApague-a ou escolha outro destino.");
        return;
    }
    var footageRoot = rootPath + "/(Footage)";
    ensureFolder(footageRoot);

    var t0 = new Date().getTime();
    log("TIDYFLOW - FASE 0 - TESTE DE RELINK POR SCRIPT");
    log("Data: " + new Date().toString());
    log("AE: " + app.version);
    log("Projeto original: " + origFile.fsName);
    log("Pasta de teste: " + rootFolder.fsName);
    log("");

    // 1. Coleta os footages com arquivo e registra o estado "antes"
    var entries = [];
    var offline = [];
    for (var i = 1; i <= app.project.numItems; i++) {
        var it = app.project.item(i);
        if (!(it instanceof FootageItem)) continue;
        if (!(it.mainSource instanceof FileSource)) continue;
        if (it.footageMissing) { offline.push(it.name); continue; }
        entries.push({ item: it, before: snapshotItem(it), isSeq: isSequenceSource(it.mainSource),
            hadProxy: false, proxyIsSeq: false, newPath: "", newProxyPath: "", errors: [] });
    }
    log("Footages com arquivo: " + entries.length + " | Offline (ignorados): " + offline.length);

    app.beginSuppressDialogs();
    var stage = "cópia";
    try {
        // 2. Copia arquivos espelhando o painel Project
        log("");
        log("== CÓPIA ==");
        for (var c = 0; c < entries.length; c++) {
            var e = entries[c];
            var vp = vpathOf(e.item);
            var destDir = vp ? footageRoot + "/" + vp : footageRoot;
            log("[" + e.item.id + "] " + e.item.name + (e.isSeq ? "  (sequência)" : ""));
            e.newPath = collectFile(e.item.file, destDir, e.isSeq);
            try {
                var ps = e.item.proxySource;
                if (ps && ps.file) {
                    e.hadProxy = true;
                    e.proxyIsSeq = isSequenceSource(ps);
                    e.newProxyPath = collectFile(ps.file, destDir, e.proxyIsSeq);
                    log("    proxy -> " + e.newProxyPath);
                }
            } catch (pe) { e.errors.push("leitura do proxy: " + pe.toString()); }
        }
        log("Arquivos copiados: " + copiedCount + " | Falhas de cópia: " + copyFailures.length);
        for (var cf = 0; cf < copyFailures.length; cf++) log("  FALHA: " + copyFailures[cf]);

        // 3. Salva o original e faz Save As da cópia
        stage = "save as";
        app.project.save();
        app.project.save(new File(rootPath + "/" + File.decode(origFile.name)));
        log("");
        log("Cópia salva: " + app.project.file.fsName);

        // 4. Relink
        stage = "relink";
        for (var r = 0; r < entries.length; r++) {
            var en = entries[r];
            try {
                if (en.isSeq) en.item.replaceWithSequence(new File(en.newPath), false);
                else en.item.replace(new File(en.newPath));
            } catch (re) { en.errors.push("relink do original: " + re.toString()); }
            if (en.hadProxy) {
                try {
                    if (en.proxyIsSeq) en.item.setProxyWithSequence(new File(en.newProxyPath), false);
                    else en.item.setProxy(new File(en.newProxyPath));
                    en.item.useProxy = (en.before.props.useProxy === "true");
                } catch (xe) { en.errors.push("relink do proxy: " + xe.toString()); }
            }
            en.afterRaw = snapshotItem(en.item);
        }

        // 5. Compara e tenta reaplicar a interpretação quando houver diferença
        stage = "comparação";
        log("");
        log("== RESULTADO POR ITEM ==");
        var identical = 0, fixedByReapply = 0, different = 0, outside = 0;
        for (var k = 0; k < entries.length; k++) {
            var x = entries[k];
            var raw = diffSnap(x.before, x.afterRaw);
            var inside = x.afterRaw.filePath.toLowerCase().indexOf(rootFolder.fsName.toLowerCase()) === 0;
            var proxyInside = !x.hadProxy || x.afterRaw.proxyPath.toLowerCase().indexOf(rootFolder.fsName.toLowerCase()) === 0;
            var finalDiff = raw;
            if (raw.length > 0) {
                try { reapplySource(x.item.mainSource, x.before.main); } catch (ra) {}
                try { if (x.hadProxy && x.before.proxy) reapplySource(x.item.proxySource, x.before.proxy); } catch (rb) {}
                finalDiff = diffSnap(x.before, snapshotItem(x.item));
            }
            var status;
            if (x.errors.length > 0) status = "ERRO";
            else if (raw.length === 0) { status = "IDÊNTICO"; identical++; }
            else if (finalDiff.length === 0) { status = "CORRIGIDO AO REAPLICAR"; fixedByReapply++; }
            else { status = "DIFERENTE"; different++; }
            if (!inside || !proxyInside) outside++;

            log("[" + status + "] " + x.before.props.name + (x.isSeq ? "  (sequência)" : "") + (x.hadProxy ? "  (com proxy)" : ""));
            log("    antes:  " + x.before.filePath);
            log("    depois: " + x.afterRaw.filePath + (inside ? "" : "   <-- FORA DA PASTA DE COLLECT"));
            if (x.hadProxy) log("    proxy:  " + x.afterRaw.proxyPath + (proxyInside ? "" : "   <-- FORA DA PASTA DE COLLECT"));
            for (var d1 = 0; d1 < x.errors.length; d1++) log("    erro: " + x.errors[d1]);
            for (var d2 = 0; d2 < raw.length; d2++) log("    mudou logo após o relink: " + raw[d2]);
            if (raw.length > 0) {
                for (var d3 = 0; d3 < finalDiff.length; d3++) log("    continua diferente após reaplicar: " + finalDiff[d3]);
            }
        }

        log("");
        log("== RESUMO ==");
        log("Idênticos: " + identical);
        log("Corrigidos ao reaplicar a interpretação: " + fixedByReapply);
        log("Diferentes: " + different);
        log("Com erro: " + (entries.length - identical - fixedByReapply - different));
        log("Apontando para fora da pasta de Collect: " + outside);
        log("Falhas de cópia: " + copyFailures.length);
        log("Offline (ignorados): " + offline.length);
        log("Tempo: " + Math.round((new Date().getTime() - t0) / 1000) + " s");
        log("");
        log("CONFERÊNCIA VISUAL: compare as comps da cópia com as do original (camadas de PSD/AI, alpha, tempo/loop, proxy).");

        stage = "salvar cópia";
        app.project.save();
    } catch (err) {
        log("");
        log("ERRO FATAL na etapa '" + stage + "': " + err.toString() + (err.line ? " (linha " + err.line + ")" : ""));
    } finally {
        app.endSuppressDialogs(false);
    }

    var rf = new File(rootPath + "/Phase0_Report.txt");
    rf.encoding = "UTF-8";
    if (rf.open("w")) { rf.write(REPORT.join("\n")); rf.close(); }

    alert("TidyFlow Fase 0 concluída.\n\nRelatório:\n" + rf.fsName + "\n\nA cópia do projeto está aberta. Confira as comps e me envie o relatório.");
    rf.parent.execute();
})();
