import { studioState } from './state.js';

export function applyForcedStateToDoc(doc) {
  if (!doc || !doc.body) return;
  doc.body.classList.remove("tf-force-rest", "tf-force-hover", "tf-force-active", "tf-force-checked", "tf-force-checked-hover", "tf-force-indeterminate");
  if (studioState.forcedState === "rest") {
    doc.body.classList.add("tf-force-rest");
  } else if (studioState.forcedState === "hover") {
    doc.body.classList.add("tf-force-hover");
  } else if (studioState.forcedState === "active") {
    doc.body.classList.add("tf-force-active");
  } else if (studioState.forcedState === "checked") {
    doc.body.classList.add("tf-force-checked");
  } else if (studioState.forcedState === "checkedHover") {
    doc.body.classList.add("tf-force-checked-hover");
  } else if (studioState.forcedState === "indeterminate") {
    doc.body.classList.add("tf-force-indeterminate");
  }
}
