import { FACTORY_TOKENS } from './defaults.js';

export const studioState = {
  currentActivePanel: "main",
  currentViewMode: "main",
  currentTokens: Object.assign({}, FACTORY_TOKENS),
  isDragMode: false,
  isEditMode: false,
  currentSelectedElement: null,
  currentSelectedElements: [],
  copiedColorStates: null,
  forcedState: "normal",
  currentDesigns: {},
  designDirty: false
};
