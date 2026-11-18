export function parsePxNumber(str, fallback) {
  if (!str) return fallback;
  var m = String(str).match(/(-?\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : fallback;
}

export function normalizeHex(colorStr) {
  if (!colorStr) return "#000000";
  var s = String(colorStr).trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toUpperCase();
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    return (
      "#" +
      s[1] + s[1] +
      s[2] + s[2] +
      s[3] + s[3]
    ).toUpperCase();
  }
  return "#000000";
}
export function rgbToHex(rgbStr) {
  if (!rgbStr) return "#000000";
  var m = rgbStr.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!m) return normalizeHex(rgbStr);
  function h(c) {
    var hex = parseInt(c, 10).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }
  return ("#" + h(m[1]) + h(m[2]) + h(m[3])).toUpperCase();
}
