import { GOOGLE_FONTS_HREF } from './defaults.js';
import { parsePxNumber, normalizeHex } from './color-utils.js';
import { chkAutoSave, getFrames } from './dom.js';
import { applyForcedStateToDoc } from './forced-state.js';
import { normalizeKnownDesignIssues, scheduleSaveToDisk } from './persistence.js';
import { studioState } from './state.js';

function ensureFontsInDoc(doc) {
  if (!doc || !doc.head) return;
  if (!doc.getElementById("studio-google-fonts")) {
    var link = doc.createElement("link");
    link.id = "studio-google-fonts";
    link.rel = "stylesheet";
    link.href = GOOGLE_FONTS_HREF;
    doc.head.appendChild(link);
  }
}

function updateStyle(doc, id, css) {
  let style = doc.getElementById(id);
  if (!style) {
    style = doc.createElement('style');
    style.id = id;
    doc.head.appendChild(style);
  }
  if (style.textContent !== css) style.textContent = css;
}

export function applyTokensToFrames(frames) {
  normalizeKnownDesignIssues();
  const tokens = Object.entries(studioState.currentTokens);
  const shadows = window.TFDesignModel.shadowCss(studioState.currentTokens);
  let design;
  try {
    design = window.TFDesignModel.css(studioState.currentDesigns);
  } catch (error) {
    console.warn('Design individual inválido na prévia:', error.message);
  }
  for (const frame of frames) {
    const doc = frame.contentDocument;
    if (!doc?.head || !doc.body) continue;
    ensureFontsInDoc(doc);
    const style = doc.documentElement.style;
    for (const [key, value] of tokens) {
      if (style.getPropertyValue(key) !== value) style.setProperty(key, value);
    }
    updateStyle(doc, 'studio-individual-shadows', shadows);
    if (design !== undefined) updateStyle(doc, 'studio-individual-design', design);
    applyForcedStateToDoc(doc);
  }
}

export function applyAllTokensToFrames() {
  applyTokensToFrames([...getFrames(), ...document.querySelectorAll('.st-gallery-frame')]);
}

var INDEPENDENT_EDITOR_TOKEN_MAP = {
  "--tf-editor-prefix-on-bg": { selectors: ['[data-tf-design="folder-prefix"]'], states: ["rest"], prop: "background-color" },
  "--tf-editor-prefix-on-hover": { selectors: ['[data-tf-design="folder-prefix"]'], states: ["hover"], prop: "background-color" },
  "--tf-editor-prefix-on-active": { selectors: ['[data-tf-design="folder-prefix"]'], states: ["active"], prop: "background-color" },
  "--tf-editor-prefix-on-text": { selectors: ['[data-tf-design="folder-prefix"]'], states: ["rest", "hover", "active"], prop: "color" },
  "--tf-editor-prefix-on-border": { selectors: ['[data-tf-design="folder-prefix"]'], states: ["rest", "hover", "active"], prop: "border-color" },
  "--tf-editor-prefix-off-bg": { selectors: ['[data-tf-design="folder-prefix-off"]'], states: ["rest"], prop: "background-color" },
  "--tf-editor-prefix-off-hover": { selectors: ['[data-tf-design="folder-prefix-off"]'], states: ["hover"], prop: "background-color" },
  "--tf-editor-prefix-off-active": { selectors: ['[data-tf-design="folder-prefix-off"]'], states: ["active"], prop: "background-color" },
  "--tf-editor-prefix-off-text": { selectors: ['[data-tf-design="folder-prefix-off"]'], states: ["rest", "hover", "active"], prop: "color" },
  "--tf-editor-prefix-off-border": { selectors: ['[data-tf-design="folder-prefix-off"]'], states: ["rest", "hover", "active"], prop: "border-color" },
  "--tf-editor-row-btn-bg": { selectors: ['[data-tf-design="folder-up"]', '[data-tf-design="folder-down"]', '[data-tf-design="folder-add"]', '[data-tf-design="folder-remove"]'], states: ["rest"], prop: "background-color" },
  "--tf-editor-row-btn-hover": { selectors: ['[data-tf-design="folder-up"]', '[data-tf-design="folder-down"]', '[data-tf-design="folder-add"]', '[data-tf-design="folder-remove"]'], states: ["hover"], prop: "background-color" },
  "--tf-editor-row-btn-active": { selectors: ['[data-tf-design="folder-up"]', '[data-tf-design="folder-down"]', '[data-tf-design="folder-add"]', '[data-tf-design="folder-remove"]'], states: ["active"], prop: "background-color" },
  "--tf-editor-row-btn-text": { selectors: ['[data-tf-design="folder-up"]', '[data-tf-design="folder-down"]', '[data-tf-design="folder-add"]', '[data-tf-design="folder-remove"]'], states: ["rest", "hover", "active"], prop: "color" },
  "--tf-editor-row-btn-border": { selectors: ['[data-tf-design="folder-up"]', '[data-tf-design="folder-down"]', '[data-tf-design="folder-add"]', '[data-tf-design="folder-remove"]'], states: ["rest", "hover", "active"], prop: "border-color" }
};

function clearConflictingDesignOverridesForToken(token) {
  var spec = INDEPENDENT_EDITOR_TOKEN_MAP[token];
  if (!spec) return;
  spec.selectors.forEach(function (sel) {
    var designObj = studioState.currentDesigns[sel];
    if (!designObj) return;
    spec.states.forEach(function (st) {
      if (designObj[st] && designObj[st][spec.prop] !== undefined) {
        delete designObj[st][spec.prop];
        if (!Object.keys(designObj[st]).length) delete designObj[st];
      }
    });
    if (!Object.keys(designObj).length) delete studioState.currentDesigns[sel];
  });
}

export function setToken(token, value, skipSave) {
  studioState.designDirty = true;
  studioState.currentTokens[token] = value;
  clearConflictingDesignOverridesForToken(token);
  applyAllTokensToFrames();
  syncControlsFromTokens();
  if (!skipSave && chkAutoSave && chkAutoSave.checked) {
    scheduleSaveToDisk(false);
  }
}
export function syncControlsFromTokens() {
  var inputs = document.querySelectorAll("[data-token]");
  for (var i = 0; i < inputs.length; i++) {
    var el = inputs[i];
    var token = el.getAttribute("data-token");
    var rawVal = studioState.currentTokens[token];
    if (rawVal === undefined) continue;

    if (el.type === "range") {
      el.value = parsePxNumber(rawVal, 0);
      var valBadge = document.querySelector('[data-val-for="' + token + '"]');
      if (valBadge) valBadge.textContent = rawVal;
    } else if (el.type === "color") {
      var hex = normalizeHex(rawVal);
      el.value = hex;
      var hexInput = document.querySelector('[data-hex-for="' + token + '"]');
      if (hexInput && document.activeElement !== hexInput) {
        hexInput.value = hex;
      }
    } else if (el.tagName === "SELECT") {
      el.value = rawVal;
    }
  }

  var selFont = document.getElementById("selFontFamily");
  if (selFont && studioState.currentTokens["--tf-font-family"]) {
    var ff = studioState.currentTokens["--tf-font-family"];
    for (var f = 0; f < selFont.options.length; f++) {
      var optFontName = selFont.options[f].value.split(",")[0].replace(/['"]/g, "").trim();
      if (ff.indexOf(optFontName) !== -1) {
        selFont.selectedIndex = f;
        break;
      }
    }
  }

  syncShadowSlider("rngRestShadowHero", "valRestShadowHero", "--tf-rest-shadow-hero");
  syncShadowSlider("rngRestShadowTile", "valRestShadowTile", "--tf-rest-shadow-tile");
  syncShadowSlider("rngHoverShadowHero", "valHoverShadowHero", "--tf-neo-shadow-hero");
  syncShadowSlider("rngHoverShadowTile", "valHoverShadowTile", "--tf-neo-shadow-tile");
  syncShadowSlider("rngActiveShadowHero", "valActiveShadowHero", "--tf-active-shadow-hero");
  syncShadowSlider("rngActiveShadowTile", "valActiveShadowTile", "--tf-active-shadow-tile");
}

function syncShadowSlider(sliderId, badgeId, tokenName) {
  var slider = document.getElementById(sliderId);
  var badge = document.getElementById(badgeId);
  if (!slider || !studioState.currentTokens[tokenName]) return;
  var px = parsePxNumber(studioState.currentTokens[tokenName], 0);
  slider.value = px;
  if (badge) badge.textContent = px + "px";
}

export function bindShadowSlider(sliderId, badgeId, tokenName) {
  var slider = document.getElementById(sliderId);
  var badge = document.getElementById(badgeId);
  if (!slider) return;
  slider.addEventListener("input", function () {
    var px = parseInt(slider.value, 10) || 0;
    if (badge) badge.textContent = px + "px";
    var borderCol = studioState.currentTokens["--tf-neo-border-color"] || "#000000";
    setToken(tokenName, px + "px " + px + "px 0px " + borderCol);
  });
}
