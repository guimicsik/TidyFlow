/* ==========================================================================
   TidyFlow — Fase 0 do Collect Files: teste de relink via .aepx (After Effects)

   CONTEXTO
   O teste anterior (collect_relink_probe.jsx) mostrou que item.replace()
   achata camadas de PSD/PSB/AI e perde o alpha. Este teste NÃO usa replace():
   salva a cópia em .aepx (XML), troca os caminhos dos arquivos no texto e
   reabre — o AE apenas encontra os arquivos em outro lugar, sem reinterpretar.

   COMO USAR
   1. Abra no AE um projeto de TESTE já salvo (de preferência com PSD/AI em
      camadas, sequência de imagens com alpha, vídeo com Interpret Footage
      alterado e item com proxy).
   2. File > Scripts > Run Script File... > este arquivo.
   3. Escolha a pasta onde a pasta de teste será criada.

   O QUE O SCRIPT FAZ
   1. Registra as propriedades de todos os footages com arquivo (antes).
   2. Copia os arquivos para <destino>/Collect_Phase0_AEPX_<projeto>/(Footage)/
      espelhando o painel Project (regras da COLLECT_FILES_SPEC.md).
   3. Salva o original e salva uma cópia em .aepx na pasta de teste.
   4. Troca, no texto do .aepx, cada caminho antigo pelo novo.
   5. Fecha e reabre o .aepx, compara as propriedades e salva como .aep.
   6. Grava Phase0_AEPX_Report.txt (inclui onde/como os caminhos aparecem no XML).
   O .aepx é gravado na pasta temporária do sistema (%TEMP%TidyFlow) e
   apagado ao final — ele nunca aparece na pasta de Collect.

   ES3 estrito (sem let/const/arrow/forEach/indexOf de Array/JSON).
   ========================================================================== */

(function () {
    var REPORT = [];
    var IMAGE_EXTS = ["png", "jpg", "jpeg", "tif", "tiff", "exr", "dpx", "tga", "bmp", "cin", "hdr", "sgi", "iff", "dng", "psd"];
    var SRC_PROPS = ["alphaMode", "premulColor", "invertAlpha", "hasAlpha", "conformFrameRate", "nativeFrameRate",
        "fieldSeparationType", "highQualityFieldSeparation", "removePulldown", "loop", "isStill"];
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

    /* ---------- Progresso (ScriptUI) ---------- */

    var progressWin = null, progressBar = null, progressText = null;

    function progressOpen(title) {
        try {
            progressWin = new Window("palette", title);
            progressWin.orientation = "column";
            progressWin.alignChildren = ["fill", "top"];
            progressText = progressWin.add("statictext", undefined, "Iniciando...");
            progressText.preferredSize = [420, 20];
            progressBar = progressWin.add("progressbar", undefined, 0, 100);
            progressBar.preferredSize = [420, 12];
            progressWin.show();
            progressWin.update();
        } catch (e) { progressWin = null; }
    }

    function progress(pct, text) {
        if (!progressWin) return;
        try {
            progressBar.value = Math.max(0, Math.min(100, pct));
            progressText.text = text;
            progressWin.update();
        } catch (e) {}
    }

    function progressClose() {
        try { if (progressWin) progressWin.close(); } catch (e) {}
        progressWin = null;
    }

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

    var copiedBySrc = {};
    var copyFailures = [];
    var copiedCount = 0;

    function copyOne(src, destPath) {
        if (new File(destPath).exists) return true;
        var ok = false;
        try { ok = src.copy(destPath); } catch (e) { ok = false; }
        if (ok) copiedCount++; else copyFailures.push(src.fsName + " -> " + destPath);
        return ok;
    }

    function collectFile(srcFile, destDir, isSeq) {
        if (isSeq) {
            var seq = listSequenceFrames(srcFile);
            var seqKey = (srcFile.parent.fsName + "|" + (seq.info ? seq.info.base + "|" + seq.info.ext : decodedName(srcFile))).toLowerCase();
            if (copiedBySrc[seqKey]) return copiedBySrc[seqKey].dir + "/" + decodedName(srcFile);
            var seqDir = destDir + "/" + uniqueName(destDir, sequenceFolderName(srcFile, seq.info), seqKey);
            ensureFolder(seqDir);
            for (var i = 0; i < seq.frames.length; i++) copyOne(seq.frames[i], seqDir + "/" + decodedName(seq.frames[i]));
            copiedBySrc[seqKey] = { dir: seqDir };
            log("    sequência: " + seq.frames.length + " frame(s) -> " + seqDir);
            return seqDir + "/" + decodedName(srcFile);
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

    /* ---------- Reescrita de caminhos no texto do .aepx ---------- */

    function xmlEscape(s) {
        return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
    }

    function xmlUnescape(s) {
        return s.replace(/&quot;/g, "\"").replace(/&apos;/g, "'").replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&#x([0-9a-fA-F]+);/g, function (m, h) { return String.fromCharCode(parseInt(h, 16)); })
            .replace(/&#(\d+);/g, function (m, d) { return String.fromCharCode(parseInt(d, 10)); })
            .replace(/&amp;/g, "&");
    }

    // Contexto do fileReference: o bloco aberto mais próximo antes dele.
    // <Pin> = fonte de footage (original/proxy); <LOm> = output module do Render Queue.
    function refContext(text, offset) {
        var pin = text.lastIndexOf("<Pin>", offset);
        var pinEnd = text.lastIndexOf("</Pin>", offset);
        var lom = text.lastIndexOf("<LOm>", offset);
        var lomEnd = text.lastIndexOf("</LOm>", offset);
        if (pin > pinEnd && pin > lom) return "footage";
        if (lom > lomEnd && lom > pin) return "render queue";
        return "outro";
    }

    // Reescreve fullpath dos <fileReference> de footage por correspondência EXATA.
    // fileMap: caminho de arquivo antigo (lower) -> novo; folderMap: pasta antiga (lower) -> nova
    // (sequências são gravadas como pasta + nome-base + extensão, com target_is_folder="1").
    // Remove ascendcount_* (dica de caminho relativo calculada para o local antigo).
    function rewriteFileReferences(text, fileMap, folderMap, stats) {
        return text.replace(/<fileReference\b[^>]*\/>/g, function (tag, offset) {
            var m = /fullpath="([^"]*)"/.exec(tag);
            if (!m) return tag;
            var oldPath = xmlUnescape(m[1]);
            var isFolder = /target_is_folder="1"/.test(tag);
            var ctx = refContext(text, offset);
            var key = oldPath.toLowerCase();
            var nw = null;
            if (ctx === "footage") nw = isFolder ? folderMap[key] : fileMap[key];
            stats.push({ ctx: ctx, isFolder: isFolder, old: oldPath, nw: nw || "" });
            if (!nw) return tag;
            var out = tag.replace(/fullpath="[^"]*"/, "fullpath=\"" + xmlEscape(nw) + "\"");
            out = out.replace(/\s+ascendcount_base="[^"]*"/, "").replace(/\s+ascendcount_target="[^"]*"/, "");
            return out;
        });
    }

    function readText(file) {
        file.encoding = "UTF-8";
        if (!file.open("r")) throw new Error("não abriu para leitura: " + file.fsName);
        var t = file.read();
        file.close();
        return t;
    }

    function writeText(file, text) {
        file.encoding = "UTF-8";
        if (!file.open("w")) throw new Error("não abriu para escrita: " + file.fsName);
        file.write(text);
        file.close();
    }

    /* ---------- Principal ---------- */

    if (!app.project || !app.project.file) {
        alert("TidyFlow Fase 0: abra e salve um projeto de teste antes de rodar.");
        return;
    }

    var origFile = app.project.file;
    var origName = File.decode(origFile.name);
    var projBase = origName.replace(/\.aep$/i, "");
    var destParent = Folder.selectDialog("TidyFlow Fase 0 (AEPX): escolha onde criar a pasta de teste do Collect");
    if (!destParent) return;

    var rootPath = destParent.fsName + "/Collect_Phase0_AEPX_" + sanitize(projBase);
    var rootFolder = new Folder(rootPath);
    if (rootFolder.exists && rootFolder.getFiles().length > 0) {
        alert("A pasta já existe e não está vazia:\n" + rootFolder.fsName + "\n\nApague-a ou escolha outro destino.");
        return;
    }
    var footageRoot = rootPath + "/(Footage)";
    ensureFolder(footageRoot);
    var rootFs = new Folder(rootPath).fsName;

    var t0 = new Date().getTime();
    log("TIDYFLOW - FASE 0 - TESTE DE RELINK VIA .AEPX");
    log("Data: " + new Date().toString());
    log("AE: " + app.version);
    log("Projeto original: " + origFile.fsName);
    log("Pasta de teste: " + rootFs);
    log("");

    progressOpen("TidyFlow — Fase 0 (AEPX)");
    var stage = "leitura do projeto";
    // .aepx intermediário fora da pasta de Collect (temp do sistema)
    var tempDir = Folder.temp.fsName + "/TidyFlow";
    ensureFolder(tempDir);
    var aepxFile = new File(tempDir + "/collect_" + new Date().getTime() + ".aepx");

    function removeAepx() {
        try {
            var current = app.project && app.project.file ? app.project.file.fsName.toLowerCase() : "";
            if (aepxFile.exists && current !== aepxFile.fsName.toLowerCase()) return aepxFile.remove();
        } catch (rx) {}
        return false;
    }
    var entries = [];
    var offline = [];

    try {
        // 1. Estado "antes"
        for (var i = 1; i <= app.project.numItems; i++) {
            var it = app.project.item(i);
            if (!(it instanceof FootageItem)) continue;
            if (!(it.mainSource instanceof FileSource)) continue;
            if (it.footageMissing) { offline.push(it.name); continue; }
            entries.push({ id: it.id, index: i, item: it, before: snapshotItem(it), isSeq: isSequenceSource(it.mainSource),
                hadProxy: false, newPath: "", newProxyPath: "" });
        }
        log("Footages com arquivo: " + entries.length + " | Offline (ignorados): " + offline.length);

        // 2. Cópia espelhando o painel Project + mapa caminho antigo -> novo
        stage = "cópia";
        log("");
        log("== CÓPIA ==");
        var fileMap = {};    // arquivo antigo (lower) -> arquivo novo
        var folderMap = {};  // pasta antiga de sequência (lower) -> pasta nova
        function mapPath(oldFs, newFs, isSeq) {
            fileMap[oldFs.toLowerCase()] = newFs;
            if (isSeq) {
                var oldDir = new File(oldFs).parent.fsName;
                var newDir = new File(newFs).parent.fsName;
                folderMap[oldDir.toLowerCase()] = newDir;
            }
        }
        for (var c = 0; c < entries.length; c++) {
            var e = entries[c];
            progress(5 + 55 * c / Math.max(1, entries.length), "Copiando (" + (c + 1) + "/" + entries.length + "): " + e.item.name);
            var vp = vpathOf(e.item);
            var destDir = vp ? footageRoot + "/" + vp : footageRoot;
            log("[" + e.id + "] " + e.item.name + (e.isSeq ? "  (sequência)" : ""));
            e.newPath = new File(collectFile(e.item.file, destDir, e.isSeq)).fsName;
            mapPath(e.before.filePath, e.newPath, e.isSeq);
            try {
                var ps = e.item.proxySource;
                if (ps && ps.file) {
                    e.hadProxy = true;
                    var proxySeq = isSequenceSource(ps);
                    e.newProxyPath = new File(collectFile(ps.file, destDir, proxySeq)).fsName;
                    mapPath(e.before.proxyPath, e.newProxyPath, proxySeq);
                    log("    proxy -> " + e.newProxyPath);
                }
            } catch (pe) { log("    erro lendo proxy: " + pe.toString()); }
        }
        log("Arquivos copiados: " + copiedCount + " | Falhas de cópia: " + copyFailures.length);
        for (var cf = 0; cf < copyFailures.length; cf++) log("  FALHA: " + copyFailures[cf]);

        // 3. Salva o original e a cópia em .aepx
        stage = "salvar .aepx";
        progress(62, "Salvando o original e a cópia em .aepx...");
        app.project.save();
        app.project.save(aepxFile);
        log("");
        log("Cópia .aepx salva: " + aepxFile.fsName + " (" + Math.round(aepxFile.length / 1024) + " KB)");

        // 4. Reescreve os caminhos no texto
        stage = "reescrita do .aepx";
        progress(70, "Trocando caminhos no .aepx...");
        var text = readText(aepxFile);
        log("");
        log("== FILEREFERENCES NO .AEPX ==");
        var stats = [];
        text = rewriteFileReferences(text, fileMap, folderMap, stats);
        var rewritten = 0, footageUnmapped = 0;
        for (var st = 0; st < stats.length; st++) {
            var sref = stats[st];
            var kind = sref.isFolder ? "pasta" : "arquivo";
            if (sref.nw) {
                rewritten++;
                log("[TROCADO] (" + sref.ctx + ", " + kind + ") " + sref.old);
                log("    -> " + sref.nw);
            } else if (sref.ctx === "footage") {
                footageUnmapped++;
                log("[FOOTAGE SEM MAPEAMENTO] (" + kind + ") " + sref.old);
            } else {
                log("[MANTIDO] (" + sref.ctx + ", " + kind + ") " + sref.old);
            }
        }
        writeText(aepxFile, text);
        log("fileReferences: " + stats.length + " | trocados: " + rewritten + " | footage sem mapeamento: " + footageUnmapped);

        // 5. Fecha e reabre o .aepx editado
        stage = "reabrir .aepx";
        progress(80, "Reabrindo o .aepx editado...");
        app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES);
        app.open(aepxFile);

        // 6. Compara
        stage = "comparação";
        progress(90, "Comparando propriedades...");
        log("");
        log("== RESULTADO POR ITEM ==");
        var identical = 0, different = 0, missing = 0, outside = 0, idsLost = 0;
        for (var k = 0; k < entries.length; k++) {
            var x = entries[k];
            var item = null;
            try { item = app.project.itemByID(x.id); } catch (ie) { item = null; }
            if (!item) {
                idsLost++;
                try { item = app.project.item(x.index); } catch (ie2) { item = null; }
            }
            if (!item) { missing++; log("[NÃO ENCONTRADO] " + x.before.props.name); continue; }
            // Arquivo renomeado no disco (sufixo _1) muda o nome do item quando
            // o nome não era personalizado; o Collect nativo mantém o nome original.
            var nameRestored = false;
            try {
                if (item.name !== x.before.props.name) { item.name = x.before.props.name; nameRestored = true; }
            } catch (ne) {}
            var after = snapshotItem(item);
            var diff = diffSnap(x.before, after);
            if (nameRestored) log("    (nome do item restaurado para: " + x.before.props.name + ")");
            var isMissing = false;
            try { isMissing = item.footageMissing; } catch (fm) {}
            var inside = after.filePath.toLowerCase().indexOf(rootFs.toLowerCase()) === 0;
            var proxyInside = !x.hadProxy || after.proxyPath.toLowerCase().indexOf(rootFs.toLowerCase()) === 0;
            if (!inside || !proxyInside) outside++;
            var status;
            if (isMissing) { status = "OFFLINE APÓS REABRIR"; missing++; }
            else if (diff.length === 0) { status = "IDÊNTICO"; identical++; }
            else { status = "DIFERENTE"; different++; }

            log("[" + status + "] " + x.before.props.name + (x.isSeq ? "  (sequência)" : "") + (x.hadProxy ? "  (com proxy)" : ""));
            log("    antes:  " + x.before.filePath);
            log("    depois: " + after.filePath + (inside ? "" : "   <-- FORA DA PASTA DE COLLECT"));
            if (x.hadProxy) log("    proxy:  " + after.proxyPath + (proxyInside ? "" : "   <-- FORA DA PASTA DE COLLECT"));
            for (var d = 0; d < diff.length; d++) log("    mudou: " + diff[d]);
        }

        // 7. Salva como .aep
        stage = "salvar .aep";
        progress(96, "Salvando como .aep...");
        var aepFile = new File(rootPath + "/" + origName);
        app.project.save(aepFile);
        log("");
        log(".aepx intermediário apagado: " + (removeAepx() ? "sim" : "NÃO (" + aepxFile.fsName + ")"));

        log("");
        log("== RESUMO ==");
        log("Idênticos: " + identical);
        log("Diferentes: " + different);
        log("Offline / não encontrados: " + missing);
        log("Apontando para fora da pasta de Collect: " + outside);
        log("IDs de item preservados: " + (idsLost === 0 ? "sim" : "não (" + idsLost + " perdidos)"));
        log("Falhas de cópia: " + copyFailures.length);
        log("Cópia final: " + aepFile.fsName);
        log("Tempo: " + Math.round((new Date().getTime() - t0) / 1000) + " s");
        log("");
        log("CONFERÊNCIA VISUAL: compare as comps da cópia com as do original (camadas de PSD/AI, alpha, tempo/loop, proxy).");
        log("TESTE DE PORTABILIDADE: feche o AE, renomeie ou mova a pasta de Collect e abra o .aep — nada deve ficar offline.");
    } catch (err) {
        log("");
        log("ERRO FATAL na etapa '" + stage + "': " + err.toString() + (err.line ? " (linha " + err.line + ")" : ""));
        if (aepxFile.exists && !removeAepx()) log(".aepx intermediário NÃO apagado (projeto aberto é o .aepx): " + aepxFile.fsName);
    }
    progressClose();

    var rf = new File(rootPath + "/Phase0_AEPX_Report.txt");
    try { writeText(rf, REPORT.join("\n")); } catch (we) {}

    alert("TidyFlow Fase 0 (AEPX) concluída.\n\nRelatório:\n" + rf.fsName + "\n\nA cópia do projeto está aberta. Confira as comps e me envie o relatório.");
    rf.parent.execute();
})();
