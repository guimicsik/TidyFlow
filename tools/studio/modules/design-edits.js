import { chkAutoSave, showToast } from './dom.js';
import { scheduleSaveToDisk } from './persistence.js';
import { applyAllTokensToFrames, setToken } from './tokens.js';
import { studioState } from './state.js';

// A cor de repouso das linhas é compartilhada entre todas as pastas.
export function applyDesignEdits(selectors, edits, message) {
  const next = { ...studioState.currentDesigns };
  let rowBackground;
  for (const selector of selectors) {
    for (const [state, properties] of Object.entries(edits)) {
      const design = { ...next[selector] };
      const rules = { ...design[state] };
      for (const [property, value] of Object.entries(properties)) {
        if (selector === '[data-tf-design="folder-row"]' && state === 'rest' && property === 'background-color' && value) {
          rowBackground = value;
          continue;
        }
        if (value) rules[property] = value;
        else delete rules[property];
        design[state] = rules;
        next[selector] = design;
      }
    }
  }
  try {
    window.TFDesignModel.css(next);
  } catch (error) {
    showToast(error.message);
    return false;
  }
  studioState.currentDesigns = next;
  if (rowBackground) setToken('--tf-editor-row-bg', rowBackground, true);
  else applyAllTokensToFrames();
  studioState.designDirty = true;
  showToast(message || (chkAutoSave.checked ? 'Alterações pendentes — salvando…' : 'Alterações pendentes — use Salvar no Projeto'));
  if (chkAutoSave.checked) scheduleSaveToDisk(false);
  return true;
}
