// O texto permanece no DOM para restaurar o conteúdo e manter o nome acessível.
export function prepareIconLabel(el) {
  if (el.querySelector('.tf-btn-label')) return;
  var label = el.ownerDocument.createElement('span');
  label.className = 'tf-btn-label';
  Array.from(el.childNodes).forEach(function (node) {
    if (node.nodeType === 1 && (node.matches('.tf-btn-icon, svg'))) return;
    label.appendChild(node);
  });
  el.appendChild(label);
}

export function setButtonIcon(el, iconItem) {
  var icon = el.querySelector('.tf-btn-icon');
  if (iconItem.id === 'none') {
    if (icon) icon.remove();
    var nativeIcon = el.querySelector(':scope > svg');
    if (nativeIcon) nativeIcon.remove();
    el.removeAttribute('data-tf-icon-mode');
    return;
  }
  if (!icon) {
    var nativeSvg = el.querySelector(':scope > svg');
    if (nativeSvg) nativeSvg.remove();
    icon = el.ownerDocument.createElement('span');
    icon.className = 'tf-btn-icon';
    el.insertBefore(icon, el.firstChild);
  }
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = iconItem.svg;
}
