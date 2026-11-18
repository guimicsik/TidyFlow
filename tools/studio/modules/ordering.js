import { chkAutoSave, magneticOrderContainer, getActiveDoc } from './dom.js';
import { extractReadableTextFromElement } from './panel-text.js';
import { scheduleSaveToDisk } from './persistence.js';
import { studioState } from './state.js';

// ========================================================================
// GRADE MAGNÉTICA DINÂMICA POR PAINEL
// ========================================================================
export function renderMagneticOrderList() {
  if (!magneticOrderContainer) return;
  magneticOrderContainer.innerHTML = "";
  var doc = getActiveDoc();
  if (!doc) return;

  if (studioState.currentActivePanel === "main") {
    // 1. Tiles do Painel Principal
    renderOrderSection(
      doc.querySelector(".actions-grid-secondary"),
      "Botões Secundários (Tiles)",
      function (btn) { return extractReadableTextFromElement(btn, btn.id).replace(/\s*\|\s*/g, " "); }
    );
    // 2. Toggles do Topo
    renderOrderSection(
      doc.querySelector(".toggles-grid-top"),
      "Toggles de Preferências",
      function (lbl) {
        var chk = lbl.querySelector("input");
        return chk ? extractReadableTextFromElement(chk, chk.id).replace(/\s*\|\s*/g, " ") : "Toggle";
      }
    );
    // 3. Seções Principais
    renderOrderSection(
      doc.body,
      "Blocos Principais da Janela",
      function (sec) {
        if (sec.classList.contains("preset-bar")) return "Barra de Preset";
        if (sec.classList.contains("field-group")) return "Bloco de Botões (Hero + Tiles)";
        if (sec.classList.contains("options-group")) return "Bloco de Toggles + Rollback";
        return null;
      },
      true
    );
  } else if (studioState.currentActivePanel === "editor") {
    // 1. Ações da Topbar do Preset Builder
    renderOrderSection(
      doc.querySelector(".preset-actions"),
      "Ícones da Barra Superior",
      function (btn) { return btn.getAttribute("aria-label") || btn.title || btn.id; }
    );
    // 2. Toggles de Settings
    renderOrderSection(
      doc.querySelector(".settings-toggles"),
      "Toggles de Configurações da Árvore",
      function (lbl) {
        var sp = lbl.querySelector("span:last-child");
        return sp ? sp.textContent.trim() : "Opção";
      }
    );
    // 3. Ações do Rodapé
    renderOrderSection(
      doc.querySelector(".footer-actions"),
      "Ações do Rodapé (Salvar / Fechar)",
      function (btn) { return btn.textContent.trim(); }
    );
  } else if (studioState.currentActivePanel === "collect") {
    // 1. Caixas Principais do Collect Files
    renderOrderSection(
      doc.querySelector(".collect-dialog"),
      "Blocos Principais do Collect Files",
      function (box) {
        var leg = box.querySelector(".collect-legend");
        return leg ? leg.childNodes[0].textContent.trim() : (box.className || "Bloco");
      },
      true
    );
    // 2. Ações do Rodapé do Collect
    renderOrderSection(
      doc.querySelector(".collect-footer-actions"),
      "Botões do Rodapé (OK / Cancelar)",
      function (btn) { return btn.textContent.trim(); }
    );
  }
}

function renderOrderSection(container, title, labelFn, filterRelevant) {
  if (!container || !magneticOrderContainer) return;

  var children = Array.prototype.slice.call(container.children);
  if (filterRelevant) {
    children = children.filter(function (c) {
      return Boolean(labelFn(c));
    });
  }
  if (children.length === 0) return;

  var box = document.createElement("div");
  box.className = "st-order-section";
  box.style.marginBottom = "10px";
  box.innerHTML = '<span class="st-order-label">' + title + ':</span>';

  var list = document.createElement("div");
  list.className = "st-order-list";

  children.forEach(function (child, idx) {
    var itemLabel = labelFn(child) || ("Item " + (idx + 1));
    var row = document.createElement("div");
    row.className = "st-order-item";
    row.innerHTML =
      '<span>' + (idx + 1) + '. ' + itemLabel + '</span>' +
      '<div class="st-order-btns">' +
      '<button type="button" class="st-order-btn" title="Mover para esquerda/cima">▲</button>' +
      '<button type="button" class="st-order-btn" title="Mover para direita/baixo">▼</button>' +
      '</div>';
    var moveBtns = row.querySelectorAll(".st-order-btn");
    moveBtns[0].onclick = function () {
      if (idx > 0) {
        container.insertBefore(child, children[idx - 1]);
        renderMagneticOrderList();
        if (chkAutoSave && chkAutoSave.checked) scheduleSaveToDisk(true);
      }
    };
    moveBtns[1].onclick = function () {
      if (idx < children.length - 1) {
        container.insertBefore(children[idx + 1], child);
        renderMagneticOrderList();
        if (chkAutoSave && chkAutoSave.checked) scheduleSaveToDisk(true);
      }
    };
    list.appendChild(row);
  });

  box.appendChild(list);
  magneticOrderContainer.appendChild(box);
}
