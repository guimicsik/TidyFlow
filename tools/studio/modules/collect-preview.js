export function injectMockCollectTargets(doc) {
  var targetList = doc && doc.getElementById("targetList");
  if (!targetList || targetList.getAttribute("data-st-mock-tree") === "1") return;
  if (targetList.querySelector(".collect-tree-row")) return;

  var mockFolders = [
    {
      name: "01_Output",
      labelColor: "#4AA44C",
      collapsed: false,
      items: [
        { name: "Comp_Exemplo_01", labelColor: "#E7C19E", selected: true },
        { name: "Comp_Exemplo_02", labelColor: "", selected: true },
        { name: "Comp_Exemplo_03", labelColor: "", selected: false },
      ]
    },
    {
      name: "02_Assets",
      labelColor: "",
      collapsed: true,
      items: Array.apply(null, Array(4)).map(function (_, idx) {
        return { name: "Asset_PreComp_" + (idx + 1), labelColor: "", selected: false };
      })
    },
    {
      name: "Nunca Usadas",
      labelColor: "#E4D84C",
      collapsed: true,
      items: [{ name: "Old_Comp_Test", labelColor: "", selected: false }]
    }
  ];

  function makeTreeSvg(type) {
    var span = doc.createElement("span");
    span.className = "collect-tree-icon collect-tree-icon--" + type;
    span.setAttribute("data-tf-design", type === "folder" ? "collect-tree-folder-icon" : "collect-tree-comp-icon");
    span.innerHTML = type === "folder"
      ? '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 4A1.5 1.5 0 0 1 3 2.5h3.2l1.6 1.8H13A1.5 1.5 0 0 1 14.5 5.8v6.7a1.5 1.5 0 0 1-1.5 1.5H3a1.5 1.5 0 0 1-1.5-1.5V4z" fill="rgba(255,255,255,0.06)"/></svg>'
      : '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M2 6.5h12M5.5 3v3.5M10.5 3v3.5"/></svg>';
    return span;
  }

  function renderMockTree() {
    targetList.innerHTML = "";
    targetList.setAttribute("data-st-mock-tree", "1");

    mockFolders.forEach(function (folder) {
      var total = folder.items.length;
      var selectedCount = folder.items.filter(function (it) { return it.selected; }).length;

      var folderRow = doc.createElement("div");
      folderRow.className = "collect-tree-row collect-tree-row--folder";
      folderRow.setAttribute("data-tf-design", "collect-tree-folder-row");
      folderRow.style.paddingLeft = "6px";

      var chevronBtn = doc.createElement("button");
      chevronBtn.type = "button";
      chevronBtn.className = "collect-tree-chevron-btn";
      chevronBtn.setAttribute("data-tf-design", "collect-tree-chevron");
      chevronBtn.innerHTML = '<svg class="collect-chevron-icon' + (folder.collapsed ? " is-collapsed" : "") + '" viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5l4.5 4.5-4.5 4.5"/></svg>';
      folderRow.appendChild(chevronBtn);

      var folderChk = doc.createElement("input");
      folderChk.type = "checkbox";
      folderChk.className = "collect-tree-check";
      folderChk.setAttribute("data-tf-design", "collect-tree-checkbox");
      folderChk.checked = selectedCount === total && total > 0;
      folderChk.indeterminate = selectedCount > 0 && selectedCount < total;
      folderChk.addEventListener("click", function (ev) { ev.stopPropagation(); });
      folderChk.addEventListener("change", function (ev) {
        ev.stopPropagation();
        var nextVal = selectedCount < total;
        folder.items.forEach(function (it) { it.selected = nextVal; });
        renderMockTree();
      });
      folderRow.appendChild(folderChk);

      if (folder.labelColor) {
        var fSwatch = doc.createElement("span");
        fSwatch.className = "collect-swatch";
        fSwatch.style.backgroundColor = folder.labelColor;
        folderRow.appendChild(fSwatch);
      }

      folderRow.appendChild(makeTreeSvg("folder"));

      var nameSpan = doc.createElement("span");
      nameSpan.className = "collect-tree-name";
      nameSpan.setAttribute("data-tf-design", "collect-tree-folder-name");
      nameSpan.textContent = folder.name;
      folderRow.appendChild(nameSpan);

      var countBadge = doc.createElement("span");
      countBadge.className = "collect-tree-count";
      countBadge.setAttribute("data-tf-design", "collect-tree-count");
      countBadge.textContent = selectedCount === total ? ("(" + total + ")") : ("(" + selectedCount + "/" + total + ")");
      folderRow.appendChild(countBadge);

      function toggleCollapse(ev) {
        if (ev) { ev.preventDefault(); ev.stopPropagation(); }
        folder.collapsed = !folder.collapsed;
        renderMockTree();
      }
      chevronBtn.addEventListener("click", toggleCollapse);
      folderRow.addEventListener("click", function (ev) {
        if (ev.target === folderChk || folderChk.contains(ev.target)) return;
        if (ev.target === chevronBtn || chevronBtn.contains(ev.target)) return;
        toggleCollapse(ev);
      });

      targetList.appendChild(folderRow);

      var childrenBox = doc.createElement("div");
      childrenBox.className = "collect-tree-children" + (folder.collapsed ? " is-hidden" : "");
      folder.items.forEach(function (item) {
        var itemRow = doc.createElement("label");
        itemRow.className = "collect-tree-row collect-tree-row--item";
        itemRow.setAttribute("data-tf-design", "collect-tree-item-row");
        itemRow.style.paddingLeft = "24px";

        var spacer = doc.createElement("span");
        spacer.className = "collect-tree-chevron-spacer";
        itemRow.appendChild(spacer);

        var itemChk = doc.createElement("input");
        itemChk.type = "checkbox";
        itemChk.className = "collect-tree-check";
        itemChk.setAttribute("data-tf-design", "collect-tree-checkbox");
        itemChk.checked = item.selected;
        itemChk.addEventListener("change", function () {
          item.selected = itemChk.checked;
          renderMockTree();
        });
        itemRow.appendChild(itemChk);

        if (item.labelColor) {
          var iSwatch = doc.createElement("span");
          iSwatch.className = "collect-swatch";
          iSwatch.style.backgroundColor = item.labelColor;
          itemRow.appendChild(iSwatch);
        }

        itemRow.appendChild(makeTreeSvg("comp"));

        var compName = doc.createElement("span");
        compName.className = "collect-tree-name";
        compName.setAttribute("data-tf-design", "collect-tree-comp-name");
        compName.textContent = item.name;
        itemRow.appendChild(compName);

        childrenBox.appendChild(itemRow);
      });
      targetList.appendChild(childrenBox);
    });
  }

  renderMockTree();
}
