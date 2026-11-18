var COLOR_PRESETS_STORAGE_KEY = "tidyflow_studio_color_presets";
export const COLOR_STATE_PRESETS = [
  {
    id: "blue",
    name: "Azul CTA",
    rest: { "background-color": "#3B82F6", color: "#FFFFFF", "border-color": "#000000" },
    hover: { "background-color": "#60A5FA", color: "#FFFFFF", "border-color": "#000000" },
    active: { "background-color": "#2563EB", color: "#FFFFFF", "border-color": "#000000" },
    checked: { "background-color": "#3B82F6", color: "#FFFFFF", "border-color": "#000000" },
    checkedHover: { "background-color": "#60A5FA", color: "#FFFFFF", "border-color": "#000000" }
  },
  {
    id: "tile",
    name: "Cinza Tile",
    rest: { "background-color": "#E4E4E7", color: "#000000", "border-color": "#000000" },
    hover: { "background-color": "#F4F4F5", color: "#000000", "border-color": "#000000" },
    active: { "background-color": "#D4D4D8", color: "#000000", "border-color": "#000000" },
    checked: { "background-color": "#3B82F6", color: "#FFFFFF", "border-color": "#000000" },
    checkedHover: { "background-color": "#60A5FA", color: "#FFFFFF", "border-color": "#000000" }
  },
  {
    id: "dark",
    name: "Carvão",
    rest: { "background-color": "#262626", color: "#F4F4F5", "border-color": "#000000" },
    hover: { "background-color": "#3F3F46", color: "#FFFFFF", "border-color": "#000000" },
    active: { "background-color": "#18181B", color: "#E4E4E7", "border-color": "#000000" },
    checked: { "background-color": "#3B82F6", color: "#FFFFFF", "border-color": "#000000" },
    checkedHover: { "background-color": "#60A5FA", color: "#FFFFFF", "border-color": "#000000" }
  },
  {
    id: "danger",
    name: "Perigo",
    rest: { "background-color": "#EF4444", color: "#FFFFFF", "border-color": "#000000" },
    hover: { "background-color": "#F87171", color: "#FFFFFF", "border-color": "#000000" },
    active: { "background-color": "#DC2626", color: "#FFFFFF", "border-color": "#000000" },
    checked: { "background-color": "#EF4444", color: "#FFFFFF", "border-color": "#000000" },
    checkedHover: { "background-color": "#F87171", color: "#FFFFFF", "border-color": "#000000" }
  },
  {
    id: "success",
    name: "Sucesso",
    rest: { "background-color": "#10B981", color: "#000000", "border-color": "#000000" },
    hover: { "background-color": "#34D399", color: "#000000", "border-color": "#000000" },
    active: { "background-color": "#059669", color: "#FFFFFF", "border-color": "#000000" },
    checked: { "background-color": "#10B981", color: "#000000", "border-color": "#000000" },
    checkedHover: { "background-color": "#34D399", color: "#000000", "border-color": "#000000" }
  },
  {
    id: "amber",
    name: "Âmbar",
    rest: { "background-color": "#F59E0B", color: "#000000", "border-color": "#000000" },
    hover: { "background-color": "#FBBF24", color: "#000000", "border-color": "#000000" },
    active: { "background-color": "#D97706", color: "#000000", "border-color": "#000000" },
    checked: { "background-color": "#F59E0B", color: "#000000", "border-color": "#000000" },
    checkedHover: { "background-color": "#FBBF24", color: "#000000", "border-color": "#000000" }
  },
  {
    id: "violet",
    name: "Violeta",
    rest: { "background-color": "#8B5CF6", color: "#FFFFFF", "border-color": "#000000" },
    hover: { "background-color": "#A78BFA", color: "#FFFFFF", "border-color": "#000000" },
    active: { "background-color": "#7C3AED", color: "#FFFFFF", "border-color": "#000000" },
    checked: { "background-color": "#8B5CF6", color: "#FFFFFF", "border-color": "#000000" },
    checkedHover: { "background-color": "#A78BFA", color: "#FFFFFF", "border-color": "#000000" }
  }
];

export function loadCustomColorPresets() {
  try {
    var raw = localStorage.getItem(COLOR_PRESETS_STORAGE_KEY);
    var parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function saveCustomColorPresets(list) {
  try {
    localStorage.setItem(COLOR_PRESETS_STORAGE_KEY, JSON.stringify(list || []));
  } catch (e) { }
}

export function adjustHexBrightness(hex, delta) {
  var clean = String(hex || "").replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return "#3B82F6";
  function clampChannel(val) {
    return Math.max(0, Math.min(255, val));
  }
  var r = clampChannel(parseInt(clean.slice(0, 2), 16) + delta);
  var g = clampChannel(parseInt(clean.slice(2, 4), 16) + delta);
  var b = clampChannel(parseInt(clean.slice(4, 6), 16) + delta);
  function toHex2(n) {
    var h = n.toString(16);
    return h.length === 1 ? "0" + h : h;
  }
  return ("#" + toHex2(r) + toHex2(g) + toHex2(b)).toUpperCase();
}

export function pickContrastTextHex(bgHex) {
  var clean = String(bgHex || "").replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return "#FFFFFF";
  var r = parseInt(clean.slice(0, 2), 16);
  var g = parseInt(clean.slice(2, 4), 16);
  var b = parseInt(clean.slice(4, 6), 16);
  var lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#000000" : "#FFFFFF";
}
