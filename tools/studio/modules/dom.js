import { studioState } from './state.js';

export const frameMain = document.getElementById("frameMain");
export const frameEditor = document.getElementById("frameEditor");
export const frameCollect = document.getElementById("frameCollect");
export const frameOverlays = document.getElementById("frameOverlays");
export const chkAutoSave = document.getElementById("chkAutoSave");
var toastFeedback = document.getElementById("toastFeedback");
export const lblActivePanelBadge = document.getElementById("lblActivePanelBadge");
export const selIconTarget = document.getElementById("selIconTarget");
export const magneticOrderContainer = document.getElementById("magneticOrderContainer");

export const btnToggleEditMode = document.getElementById("btnToggleEditMode");
export const editModeStatus = document.getElementById("editModeStatus");
export const stInspectorPanel = document.getElementById("stInspectorPanel");
export const stDefaultSidebar = document.getElementById("stDefaultSidebar");
export const btnCloseInspector = document.getElementById("btnCloseInspector");

// Campos do Inspector
export const inspTag = document.getElementById("inspTag");
export const inspTitle = document.getElementById("inspTitle");
export const inspId = document.getElementById("inspId");
export const inspInputText = document.getElementById("inspInputText");

export const inspIconCatalogGrid = document.getElementById("inspIconCatalogGrid");

export function showToast(msg) {
  if (!toastFeedback) return;
  toastFeedback.textContent = msg;
  setTimeout(function () {
    if (toastFeedback.textContent === msg) {
      toastFeedback.textContent = "";
    }
  }, 2600);
}

export function getFrames() {
  return [frameMain, frameEditor, frameCollect, frameOverlays].filter(Boolean);
}

export function getActiveDoc() {
  var frame =
    studioState.currentActivePanel === "editor"
      ? frameEditor
      : studioState.currentActivePanel === "collect"
        ? frameCollect
        : studioState.currentActivePanel === "overlays"
          ? frameOverlays
          : frameMain;
  try {
    return frame && frame.contentDocument;
  } catch (e) {
    return null;
  }
}
