import { PANEL_CONFIGS } from './catalog.js';
import {
  frameMain,
  frameEditor,
  frameCollect,
  frameOverlays,
  chkAutoSave,
  lblActivePanelBadge
} from './dom.js';
import { renderMagneticOrderList } from './ordering.js';
import { scheduleSaveToDisk } from './persistence.js';
import { studioState } from './state.js';

// ========================================================================
// LEITURA E APLICAÇÃO DE TEXTOS DINÂMICOS
// ========================================================================
export function syncTextInputsFromDoc(panelKey) {
  var frame =
    panelKey === "editor"
      ? frameEditor
      : panelKey === "collect"
        ? frameCollect
        : panelKey === "overlays"
          ? frameOverlays
          : frameMain;
  if (!frame) return;

  var doc;
  try { doc = frame.contentDocument; } catch (e) { return; }
  if (!doc) return;

  var inputs = document.querySelectorAll('[data-text-panel="' + panelKey + '"]');
  inputs.forEach(function (inp) {
    if (document.activeElement === inp) return;
    var targetId = inp.getAttribute("data-text-target");
    var el = doc.getElementById(targetId);
    if (!el) return;

    inp.value = extractReadableTextFromElement(el, targetId);
  });
}

export function extractReadableTextFromElement(el, targetId) {
  function readLines(node) {
    var result = '';
    Array.prototype.forEach.call(node.childNodes, function (child) {
      if (child.nodeType === 3) result += child.nodeValue;
      else if (child.nodeType === 1) {
        if (child.tagName === 'BR') result += '\n';
        else {
          var text = readLines(child);
          if (child.tagName === 'SPAN' && result.trim() && text.trim()) result += '\n';
          result += text;
        }
      }
    });
    return result.replace(/^[\s\n]+|[\s\n]+$/g, '').replace(/\n[ \t]+/g, '\n');
  }
  if (el.classList && (el.classList.contains('btn-tile-label') || el.classList.contains('tf-toggle__face'))) return readLines(el);
  if (targetId === "noticeText" || targetId === "treeToolbarTitle" || targetId === "editorStatus" || targetId === "lblTargetTitle") {
    return el.textContent.trim();
  }
  // Checkboxes / Toggles
  if (el.tagName === "INPUT" && el.type === "checkbox") {
    var parentLbl = el.closest(".tf-toggle, .toggle-container, .collect-check");
    if (parentLbl) {
      var face = parentLbl.querySelector(".tf-toggle__face, span:not(.toggle-slider)");
      if (face) {
        return face.innerHTML
          .replace(/<br\s*\/?>/gi, " | ")
          .replace(/<[^>]+>/g, "")
          .trim();
      }
    }
  }
  // Botões com labelBox
  var labelBox = el.querySelector(".btn-tile-label");
  if (labelBox) {
    var spans = labelBox.querySelectorAll("span");
    if (spans.length > 1) {
      var parts = [];
      for (var s = 0; s < spans.length; s++) {
        parts.push(spans[s].innerHTML.replace(/<br\s*\/?>/gi, " | ").replace(/<[^>]+>/g, "").trim());
      }
      return parts.join(" | ");
    }
    return labelBox.innerHTML.replace(/<br\s*\/?>/gi, " | ").replace(/<[^>]+>/g, "").trim();
  }
  return el.textContent.trim();
}

export function applyTextToDoc(panelKey, targetId, rawValue, shouldSave) {
  if (panelKey && PANEL_CONFIGS[panelKey]) {
    studioState.currentActivePanel = panelKey;
    if (lblActivePanelBadge) {
      lblActivePanelBadge.textContent = PANEL_CONFIGS[panelKey].badgeText;
    }
  }

  var frame =
    panelKey === "editor"
      ? frameEditor
      : panelKey === "collect"
        ? frameCollect
        : panelKey === "overlays"
          ? frameOverlays
          : frameMain;
  if (!frame) return;

  var doc;
  try { doc = frame.contentDocument; } catch (e) { return; }
  if (!doc) return;

  var el = doc.getElementById(targetId);
  if (!el) return;

  var lines = String(rawValue)
    .split("|")
    .map(function (s) { return s.trim(); })
    .filter(Boolean);
  if (lines.length === 0) lines = [""];

  if (
    targetId === "noticeText" ||
    targetId === "treeToolbarTitle" ||
    targetId === "editorStatus" ||
    targetId === "lblTargetTitle"
  ) {
    el.textContent = rawValue;
  } else if (el.tagName === "INPUT" && el.type === "checkbox") {
    var parentLbl = el.closest(".tf-toggle, .toggle-container, .collect-check");
    if (parentLbl) {
      var face = parentLbl.querySelector(".tf-toggle__face, span:not(.toggle-slider)");
      if (face) {
        face.innerHTML = lines.join("<br>");
      }
    }
  } else {
    var labelBox = el.querySelector(".btn-tile-label");
    if (labelBox) {
      if (targetId === "btnOrganize" && lines.length === 1) {
        labelBox.textContent = lines[0];
      } else if (targetId === "btnRollback") {
        labelBox.innerHTML = "<span>" + lines.join("<br>") + "</span>";
      } else {
        labelBox.innerHTML = lines.map(function (l) {
          return "<span>" + l + "</span>";
        }).join("");
      }
    } else {
      el.textContent = rawValue;
    }
  }

  renderMagneticOrderList();
  if (shouldSave && chkAutoSave && chkAutoSave.checked) {
    scheduleSaveToDisk(true);
  }
}
