import { setActivePanel } from '/studio/modules/panels.js';
import { renderIconCatalog } from '/studio/modules/icons.js';
import { fetchStateFromDisk } from '/studio/modules/persistence.js';
import { initEvents } from '/studio/modules/events.js';
import { initCanvasTools } from '/studio/modules/canvas.js';
import { initScreenGallery } from '/studio/modules/gallery.js';

initCanvasTools();
initScreenGallery();
renderIconCatalog();
initEvents();
setActivePanel("main");
fetchStateFromDisk();
