/* ==========================================================================
   TidyFlow — Biblioteca compartilhada de Host (ExtendScript)
   Avaliada uma única vez e exposta em $.global.OrgLib.
   Substitui as cópias locais de helpers puros que existiam em cada entry point
   de aeft_organizer.jsx (6 cópias de escapeJsonString) e ppro_organizer.jsx.
   Compatível com ExtendScript (ES3): sem const/let/arrow/Array.includes.
   ========================================================================== */
(function () {
    if ($.global.OrgLib) return;

    var Lib = {};

    Lib.escapeJsonString = function (str) {
        return String(str === undefined || str === null ? "" : str)
            .replace(/\\/g, "\\\\")
            .replace(/"/g, '\\"')
            .replace(/\r/g, "\\r")
            .replace(/\n/g, "\\n");
    };

    Lib.parseJson = function (jsonStr) {
        if (!jsonStr) return null;
        try {
            if (typeof JSON !== "undefined" && JSON.parse) {
                return JSON.parse(jsonStr);
            }
        } catch (eParse) {}
        try {
            return eval("(" + jsonStr + ")");
        } catch (eEval) {
            return null;
        }
    };

    Lib.arrayContains = function (arr, val) {
        if (!arr || !arr.length) return false;
        for (var i = 0; i < arr.length; i++) {
            if (arr[i] === val) return true;
        }
        return false;
    };

    Lib.arrayContainsIgnoreCase = function (arr, val) {
        if (!arr || !arr.length || !val) return false;
        var target = String(val).toLowerCase();
        for (var i = 0; i < arr.length; i++) {
            if (String(arr[i]).toLowerCase() === target) return true;
        }
        return false;
    };

    Lib.stripNumericPrefix = function (name) {
        return String(name || "").replace(/^\d+[_\-\s]+/, "");
    };

    Lib.trimStr = function (str) {
        return String(str === undefined || str === null ? "" : str).replace(/^\s+|\s+$/g, "");
    };

    Lib.getFileExtension = function (file) {
        if (!file || !file.name) return "";
        var name = String(file.name);
        var lastDot = name.lastIndexOf(".");
        if (lastDot === -1 || lastDot === name.length - 1) return "";
        return name.substring(lastDot + 1).toLowerCase();
    };

    Lib.getParentFolderNameFromPath = function (filePath) {
        var p = String(filePath === undefined || filePath === null ? "" : filePath);
        if (!p) return "";
        p = p.replace(/\\/g, "/");
        var lastSlash = p.lastIndexOf("/");
        if (lastSlash === -1) return "";
        var parent = p.substring(0, lastSlash);
        var parentSlash = parent.lastIndexOf("/");
        var folderName = parentSlash === -1 ? parent : parent.substring(parentSlash + 1);
        return folderName || "";
    };

    Lib.isSameItem = function (a, b) {
        if (!a || !b) return false;
        if (a === b) return true;
        if (a.id !== undefined && b.id !== undefined && a.id === b.id) return true;
        var keyA = (a.nodeId !== undefined && a.nodeId !== null) ? a.nodeId : a.id;
        var keyB = (b.nodeId !== undefined && b.nodeId !== null) ? b.nodeId : b.id;
        return keyA !== undefined && keyA !== null && String(keyA) === String(keyB);
    };

    $.global.OrgLib = Lib;
})();
