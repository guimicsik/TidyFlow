const { defineConfig } = require('vite');
const fs = require('node:fs');
const path = require('node:path');

const { renderStudioHtml } = require('./tools/studio/render-html.cjs');

const REPO_ROOT = __dirname;
const TOKENS_PATH = path.join(REPO_ROOT, 'client', 'theme', 'tokens.css');
const THEME_CSS_PATH = path.join(REPO_ROOT, 'client', 'theme.css');
const INDEX_HTML_PATH = path.join(REPO_ROOT, 'client', 'index.html');
const EDITOR_HTML_PATH = path.join(REPO_ROOT, 'client', 'tree_editor.html');
const COLLECT_HTML_PATH = path.join(REPO_ROOT, 'client', 'collect.html');
const STUDIO_DIR = path.join(REPO_ROOT, 'tools', 'studio');

const studioEntries = new Map([
  ['/studio', 'studio.html'], ['/studio/', 'studio.html'], ['/studio.html', 'studio.html'],
  ['/studio.js', 'studio.js'], ['/studio.css', 'studio.css'],
  ['/design-model.js', 'design-model.cjs'], ['/overlays.html', 'overlays.html']
]);

const REQUIRED_PANEL_IDS = [
  'presetSelect',
  'btnOpenPresetBuilder',
  'noticeText',
  'btnOrganize',
  'btnCreateStructure',
  'btnMediaOnly',
  'btnOpenCollect',
  'chkSaveProject',
  'chkDeleteEmptyFolders',
  'btnCheckUnused',
  'btnRollback',
  'statusMsg'
];

const REQUIRED_EDITOR_IDS = [
  'presetSelect',
  'badgeBuiltIn',
  'badgeUnsaved',
  'btnDeletePreset',
  'btnSaveAsPreset',
  'btnResetDefault',
  'btnImportJson',
  'btnExportJson',
  'btnOpenPresetsFolder',
  'btnAddTopFolder',
  'chkUsePrefixNumbering',
  'chkGroupBySourceFolder',
  'chkSeparateAudioCategories',
  'chkNumberAudioCategories',
  'treeRootList',
  'btnFooterSave',
  'btnCloseModal'
];

const REQUIRED_COLLECT_IDS = [
  'lblTargetTitle',
  'btnSelectAllTargets',
  'btnSelectNoneTargets',
  'btnExpandAllTargets',
  'btnCollapseAllTargets',
  'targetList',
  'inpDestPath',
  'btnBrowseDest',
  'valDiskAvailable',
  'valOriginalSize',
  'valResultingSize',
  'btnCalculate',
  'chkExcludeUnused',
  'chkAudioConform',
  'chkPreviewFiles',
  'chkRenameClipNames',
  'chkObeyProxy',
  'chkReportOnly',
  'chkReveal',
  'chkOpenCollected',
  'btnComments',
  'btnCollect',
  'btnCancel'
];

function parseTokensFromCss(cssText) {
  const tokens = {};
  const re = /(--tf-[a-zA-Z0-9_-]+)\s*:\s*([^;]+);/g;
  let m;
  while ((m = re.exec(cssText)) !== null) {
    tokens[m[1].trim()] = m[2].trim();
  }
  return tokens;
}

function updateTokensInCss(cssText, newTokens) {
  let updated = cssText;
  const missingKeys = [];

  for (const [key, val] of Object.entries(newTokens)) {
    if (!key.startsWith('--tf-') || val === undefined || val === null) continue;
    const cleanVal = String(val).replace(/[;\r\n]/g, '').trim();
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(${escapedKey}\\s*:\\s*)([^;]+)(;)`);
    if (re.test(updated)) {
      updated = updated.replace(re, `$1${cleanVal}$3`);
    } else {
      missingKeys.push(`  ${key}: ${cleanVal};`);
    }
  }

  if (missingKeys.length > 0) {
    const rootStart = updated.indexOf(':root');
    const rootOpen = rootStart === -1 ? -1 : updated.indexOf('{', rootStart);
    const rootEnd = rootOpen === -1 ? -1 : updated.indexOf('}', rootOpen);
    if (rootEnd !== -1) {
      updated =
        updated.slice(0, rootEnd) +
        '\n  /* Tokens Adicionados via Design Studio */\n' +
        missingKeys.join('\n') +
        '\n' + updated.slice(rootEnd);
    }
  }

  return updated;
}

function stripSelectWrappers(html) {
  if (!html) return '';
  return html.replace(/<div class=["']tf-select-wrapper["']>([\s\S]*?)<\/div>(?:\s*<\/div>)?/gi, function (match, inner) {
    const selectMatch = inner.match(/<select[\s\S]*?<\/select>/i);
    if (selectMatch) {
      return selectMatch[0].replace(/\s*style=["'][^"']*display:\s*none;?[^"']*["']/i, '');
    }
    return match;
  });
}

function updateMainRegionInIndexHtml(fullHtml, newMainRegionHtml) {
  for (const reqId of REQUIRED_PANEL_IDS) {
    const idPattern = new RegExp(`\\bid=["']${reqId}["']`);
    if (!idPattern.test(newMainRegionHtml)) {
      throw new Error(`ID obrigatório ausente no Painel Principal: #${reqId}`);
    }
  }

  const bodyStartMatch = fullHtml.match(/<body[^>]*>/i);
  const backdropIdx = fullHtml.indexOf('<div id="rollbackModalBackdrop"');

  if (!bodyStartMatch || backdropIdx === -1) {
    throw new Error('Marcadores de estrutura do client/index.html não encontrados.');
  }

  const cleanMainRegionHtml = stripSelectWrappers(
    newMainRegionHtml
      .replace(/(?:\s*<!--\s*Modal de Confirmação de Rollback\s*-->\s*)+$/gi, '')
      .replace(/<!-- Modal de Confirmação[\s\S]*$/, '')
      .trim()
  );

  const insertStart = bodyStartMatch.index + bodyStartMatch[0].length;
  return (
    fullHtml.slice(0, insertStart) +
    '\n' +
    cleanMainRegionHtml +
    '\n\n  <!-- Modal de Confirmação de Rollback -->\n  ' +
    fullHtml.slice(backdropIdx)
  );
}

function updateMainRegionInEditorHtml(fullHtml, newRegionHtml) {
  for (const reqId of REQUIRED_EDITOR_IDS) {
    const idPattern = new RegExp(`\\bid=["']${reqId}["']`);
    if (!idPattern.test(newRegionHtml)) {
      throw new Error(`ID obrigatório ausente no Preset Builder: #${reqId}`);
    }
  }

  const bodyStartMatch = fullHtml.match(/<body[^>]*>/i);
  const popoverIdx = fullHtml.indexOf('<div id="labelPopover"');

  if (!bodyStartMatch || popoverIdx === -1) {
    throw new Error('Marcadores de estrutura do client/tree_editor.html não encontrados.');
  }

  const cleanRegionHtml = stripSelectWrappers(
    newRegionHtml
      .replace(/(?:\s*<!--\s*Popover Flutuante[^-]*-->\s*)+$/gi, '')
      .replace(/<!-- Popover Flutuante[\s\S]*$/, '')
      .trim()
  );

  const insertStart = bodyStartMatch.index + bodyStartMatch[0].length;
  return (
    fullHtml.slice(0, insertStart) +
    '\n' +
    cleanRegionHtml +
    '\n\n  <!-- Popover Flutuante de Seleção de Color Label (0 a 16) -->\n  ' +
    fullHtml.slice(popoverIdx)
  );
}

function updateMainRegionInCollectHtml(fullHtml, newRegionHtml) {
  for (const reqId of REQUIRED_COLLECT_IDS) {
    const idPattern = new RegExp(`\\bid=["']${reqId}["']`);
    if (!idPattern.test(newRegionHtml)) {
      throw new Error(`ID obrigatório ausente no Collect Files: #${reqId}`);
    }
  }

  const bodyStartMatch = fullHtml.match(/<body[^>]*>/i);
  const commentsIdx = fullHtml.indexOf('<div id="commentsBackdrop"');

  if (!bodyStartMatch || commentsIdx === -1) {
    throw new Error('Marcadores de estrutura do client/collect.html não encontrados.');
  }

  const cleanRegionHtml = newRegionHtml
    .replace(/(?:\s*<!--\s*Modal de Comentários[^-]*-->\s*)+$/gi, '')
    .replace(/<!-- Modal de Comentários[\s\S]*$/, '')
    .trim();

  const insertStart = bodyStartMatch.index + bodyStartMatch[0].length;
  return (
    fullHtml.slice(0, insertStart) +
    '\n' +
    cleanRegionHtml +
    '\n\n  <!-- Modal de Comentários (gravados no Report.txt) -->\n  ' +
    fullHtml.slice(commentsIdx)
  );
}

function stripStudioClasses(html) {
  if (!html) return '';
  return html
    .replace(/\s*\bst-(?:text-box|element-selected|drop-target|section-group)\b/g, '')
    .replace(/\s*data-st-draggable=["'][^"']*["']/g, '')
    .replace(/\s*draggable=["'][^"']*["']/g, '')
    .replace(/\s*class=["']\s*["']/g, '');
}

function findDivBoundsById(html, id) {
  if (!html || !id) return null;
  const openRe = new RegExp(`<div\\s+[^>]*\\bid=["']${id}["'][^>]*>`, 'i');
  const match = openRe.exec(html);
  if (!match) return null;
  const startIdx = match.index;
  const openTagEnd = match.index + match[0].length;

  let depth = 1;
  const tagRe = /<\/?div\b[^>]*>/gi;
  tagRe.lastIndex = openTagEnd;
  let m;
  while ((m = tagRe.exec(html)) !== null) {
    if (m[0].startsWith('</')) {
      depth--;
      if (depth === 0) {
        return {
          start: startIdx,
          openTagEnd: openTagEnd,
          end: m.index + m[0].length,
          outerHtml: html.substring(startIdx, m.index + m[0].length),
          innerHtml: html.substring(openTagEnd, m.index)
        };
      }
    } else {
      depth++;
    }
  }
  return null;
}

function findDivBoundsByClass(html, className, fromIndex = 0) {
  if (!html || !className) return null;
  const openRe = new RegExp(`<div\\s+[^>]*\\bclass=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>`, 'i');
  const sliceStr = html.slice(fromIndex);
  const match = openRe.exec(sliceStr);
  if (!match) return null;
  const startIdx = fromIndex + match.index;
  const openTagEnd = startIdx + match[0].length;

  let depth = 1;
  const tagRe = /<\/?div\b[^>]*>/gi;
  tagRe.lastIndex = openTagEnd;
  let m;
  while ((m = tagRe.exec(html)) !== null) {
    if (m[0].startsWith('</')) {
      depth--;
      if (depth === 0) {
        return {
          start: startIdx,
          openTagEnd: openTagEnd,
          end: m.index + m[0].length,
          outerHtml: html.substring(startIdx, m.index + m[0].length),
          innerHtml: html.substring(openTagEnd, m.index)
        };
      }
    } else {
      depth++;
    }
  }
  return null;
}

function syncOverlaysToClientFiles(regionHtml, paths) {
  const indexPath = paths ? paths.index : INDEX_HTML_PATH;
  const editorPath = paths ? paths.editor : EDITOR_HTML_PATH;
  const collectPath = paths ? paths.collect : COLLECT_HTML_PATH;
  try {
    // 1. Sincroniza Rollback Modal com client/index.html
    const ovRollback = findDivBoundsById(regionHtml, 'ov-rollback');
    if (ovRollback && fs.existsSync(indexPath)) {
      const cardBounds = findDivBoundsByClass(ovRollback.outerHtml, 'modal-card');
      if (cardBounds) {
        const cleanCard = stripStudioClasses(cardBounds.outerHtml);
        let indexHtml = fs.readFileSync(indexPath, 'utf8');
        const backdropBounds = findDivBoundsById(indexHtml, 'rollbackModalBackdrop');
        if (backdropBounds) {
          const openTag = indexHtml.substring(backdropBounds.start, backdropBounds.openTagEnd);
          const nextBackdrop = `${openTag}\n    ${cleanCard.trim()}\n  </div>`;
          indexHtml = indexHtml.slice(0, backdropBounds.start) + nextBackdrop + indexHtml.slice(backdropBounds.end);
          fs.writeFileSync(indexPath, indexHtml, 'utf8');
        }
      }
    }

    // 2. Sincroniza Modais com client/tree_editor.html
    if (fs.existsSync(editorPath)) {
      let editorHtml = fs.readFileSync(editorPath, 'utf8');
      let editorModified = false;

      // 2a. Regras e Filtros (#ov-rules -> #rulesModalBackdrop)
      const ovRules = findDivBoundsById(regionHtml, 'ov-rules');
      if (ovRules) {
        const cardBounds = findDivBoundsByClass(ovRules.outerHtml, 'modal-card-rules');
        if (cardBounds) {
          const cleanCard = stripStudioClasses(cardBounds.outerHtml);
          const backdropBounds = findDivBoundsById(editorHtml, 'rulesModalBackdrop');
          if (backdropBounds) {
            const openTag = editorHtml.substring(backdropBounds.start, backdropBounds.openTagEnd);
            const nextBackdrop = `${openTag}\n    ${cleanCard.trim()}\n  </div>`;
            editorHtml = editorHtml.slice(0, backdropBounds.start) + nextBackdrop + editorHtml.slice(backdropBounds.end);
            editorModified = true;
          }
        }
      }

      // 2b. Salvar Como (#ov-save-as -> #saveAsModalBackdrop)
      const ovSaveAs = findDivBoundsById(regionHtml, 'ov-save-as');
      if (ovSaveAs) {
        const cardBounds = findDivBoundsByClass(ovSaveAs.outerHtml, 'modal-sm');
        if (cardBounds) {
          const cleanCard = stripStudioClasses(cardBounds.outerHtml);
          const backdropBounds = findDivBoundsById(editorHtml, 'saveAsModalBackdrop');
          if (backdropBounds) {
            const openTag = editorHtml.substring(backdropBounds.start, backdropBounds.openTagEnd);
            const nextBackdrop = `${openTag}\n    ${cleanCard.trim()}\n  </div>`;
            editorHtml = editorHtml.slice(0, backdropBounds.start) + nextBackdrop + editorHtml.slice(backdropBounds.end);
            editorModified = true;
          }
        }
      }

      // 2c. Alterações Não Salvas (#ov-unsaved -> #unsavedCloseModalBackdrop)
      const ovUnsaved = findDivBoundsById(regionHtml, 'ov-unsaved');
      if (ovUnsaved) {
        const cardBounds = findDivBoundsByClass(ovUnsaved.outerHtml, 'modal-card-unsaved');
        if (cardBounds) {
          const cleanCard = stripStudioClasses(cardBounds.outerHtml);
          const backdropBounds = findDivBoundsById(editorHtml, 'unsavedCloseModalBackdrop');
          if (backdropBounds) {
            const openTag = editorHtml.substring(backdropBounds.start, backdropBounds.openTagEnd);
            const nextBackdrop = `${openTag}\n    ${cleanCard.trim()}\n  </div>`;
            editorHtml = editorHtml.slice(0, backdropBounds.start) + nextBackdrop + editorHtml.slice(backdropBounds.end);
            editorModified = true;
          }
        }
      }

      if (editorModified) {
        fs.writeFileSync(editorPath, editorHtml, 'utf8');
      }
    }
    [['ov-del-folder', editorPath, 'confirmModalBackdrop'], ['ov-reduce', indexPath, 'reduceModalBackdrop'], ['ov-comments', collectPath, 'commentsBackdrop']].forEach(entry => {
      if (!entry[1] || !fs.existsSync(entry[1])) return;
      const source = findDivBoundsById(regionHtml, entry[0]);
      if (!source) return;
      const html = fs.readFileSync(entry[1], 'utf8');
      const target = findDivBoundsById(html, entry[2]);
      if (!target) return;
      const inner = source.outerHtml.slice(source.openTagEnd - source.start, source.outerHtml.lastIndexOf('</div>'));
      const clean = stripStudioClasses(inner);
      fs.writeFileSync(entry[1], html.slice(0, target.openTagEnd) + clean + '</div>' + html.slice(target.end), 'utf8');
    });
  } catch (err) {
    console.error('[TidyFlow Studio] Erro ao sincronizar overlays:', err);
  }
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function tidyflowStudioPlugin() {
  return {
    name: 'tidyflow-design-studio',
    handleHotUpdate({ file }) {
      // Ignora full-reload automático para HTMLs quando salvos pelo Studio,
      // permitindo que os iframes de preview mantenham o estado visual sem recarregar do zero ou resetar textos!
      if (file.endsWith('.html')) {
        return [];
      }
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const urlObj = new URL(req.url || '/', 'http://localhost:5173');
        const pathname = urlObj.pathname;

        // Failsafe: reescreve requisições com prefixo /client/ para a raiz do Vite
        if (pathname.startsWith('/client/')) {
          req.url = req.url.replace(/^\/client\//, '/');
        }

        // Redireciona a raiz "/" para "/studio" quando aberto diretamente no navegador
        if (pathname === '/' && !urlObj.searchParams.has('raw') && !urlObj.searchParams.has('preview')) {
          res.statusCode = 302;
          res.setHeader('Location', '/studio');
          res.end();
          return;
        }

        // Somente entradas públicas e módulos de apresentação do Studio.
        const studioAsset = /^\/studio\/(modules\/[a-z-]+\.js|styles\/[a-z-]+\.css)$/.exec(pathname);
        const studioFile = studioAsset ? studioAsset[1] : studioEntries.get(pathname);
        if (studioFile) {
          const filePath = path.join(STUDIO_DIR, studioFile);
          if (!fs.existsSync(filePath)) {
            res.statusCode = 404;
            res.end();
            return;
          }
          const mime = studioFile.endsWith('.html') ? 'text/html'
            : studioFile.endsWith('.css') ? 'text/css' : 'application/javascript';
          res.setHeader('Content-Type', mime + '; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end(studioFile === 'studio.html' ? renderStudioHtml(STUDIO_DIR) : fs.readFileSync(filePath));
          return;
        }

        if (pathname === '/api/studio/window-size' && req.method === 'POST') {
          try {
            const body = await readJsonBody(req);
            const ids = { main: 'com.tidyflow', editor: 'com.tidyflow.editor', collect: 'com.tidyflow.collect' };
            if (!ids[body.panel] || !Number.isInteger(body.width) || !Number.isInteger(body.height) || body.width < 280 || body.width > 3840 || body.height < 240 || body.height > 2160) throw new Error('Dimensões inválidas');
            const changes = ['manifest.xml', 'manifest.dev.xml'].map(name => {
              const file = path.join(REPO_ROOT, 'CSXS', name);
              if (!fs.existsSync(file)) return null;
              const source = fs.readFileSync(file, 'utf8');
              const escaped = ids[body.panel].replace(/\./g, '\\.');
              const re = new RegExp('(<Extension Id="' + escaped + '">)([\\s\\S]*?)(</Extension>)');
              if (!re.test(source)) throw new Error('Extensão não encontrada: ' + name);
              const next = source.replace(re, (all, open, content, close) => open + content.replace(/<(Size|MinSize|MaxSize)>([\s\S]*?)<\/\1>/g, (block, tag) => '<' + tag + '>\n              <Height>' + body.height + '</Height>\n              <Width>' + body.width + '</Width>\n            </' + tag + '>') + close);
              return {file, next};
            }).filter(Boolean);
            changes.forEach(change => fs.writeFileSync(change.file, change.next, 'utf8'));
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ok:true}));
          } catch (err) { res.statusCode = 400; res.end(JSON.stringify({ok:false,error:err.message})); }
          return;
        }

        // API: Ler estado atual do disco
        if (pathname === '/api/studio/state' && req.method === 'GET') {
          try {
            const cssText = fs.readFileSync(TOKENS_PATH, 'utf8');
            const htmlMain = fs.readFileSync(INDEX_HTML_PATH, 'utf8');
            const htmlEditor = fs.readFileSync(EDITOR_HTML_PATH, 'utf8');
            const htmlCollect = fs.readFileSync(COLLECT_HTML_PATH, 'utf8');
            const tokens = parseTokensFromCss(cssText);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            const designs = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'client/theme/studio-design.json'), 'utf8'));
            res.end(JSON.stringify({ ok: true, tokens, htmlMain, htmlEditor, htmlCollect, designs }));
          } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ ok: false, error: String(err.message || err) }));
          }
          return;
        }

        // API: Salvar tokens e/ou estrutura de layout/textos no disco (Multi-Painel)
        if (pathname === '/api/studio/save' && req.method === 'POST') {
          try {
            const body = await readJsonBody(req);
            const designPath = path.join(REPO_ROOT, 'client/theme/studio-design.json');
            const designs = body.designs || JSON.parse(fs.readFileSync(designPath, 'utf8'));
            const model = require('./tools/studio/design-model.cjs');
            const designCss = model.css(designs);
            if (body.tokens && typeof body.tokens === 'object') {
              fs.writeFileSync(path.join(REPO_ROOT, 'client', 'theme', 'studio-overrides.css'), '/* Design Studio: regras individuais. */\n' + model.shadowCss(body.tokens) + '\n' + designCss + '\n', 'utf8');
              fs.writeFileSync(designPath, JSON.stringify(designs, null, 2) + '\n', 'utf8');
              const currentCss = fs.readFileSync(TOKENS_PATH, 'utf8');
              const nextCss = updateTokensInCss(currentCss, body.tokens);
              fs.writeFileSync(TOKENS_PATH, nextCss, 'utf8');

              if (fs.existsSync(THEME_CSS_PATH)) {
                const currentThemeCss = fs.readFileSync(THEME_CSS_PATH, 'utf8');
                const nextThemeCss = updateTokensInCss(currentThemeCss, body.tokens);
                fs.writeFileSync(THEME_CSS_PATH, nextThemeCss, 'utf8');
              }
            }

            const targetPanel = body.targetPanel || (body.indexMainRegionHtml ? 'main' : null);
            const regionHtml = body.panelRegionHtml || body.indexMainRegionHtml;
            const panels = body.panels;

            if (panels && typeof panels === 'object') {
              if (typeof panels.main === 'string' && panels.main.trim()) {
                const currentHtml = fs.readFileSync(INDEX_HTML_PATH, 'utf8');
                const nextHtml = updateMainRegionInIndexHtml(currentHtml, panels.main);
                fs.writeFileSync(INDEX_HTML_PATH, nextHtml, 'utf8');
              }
              if (typeof panels.editor === 'string' && panels.editor.trim()) {
                const currentHtml = fs.readFileSync(EDITOR_HTML_PATH, 'utf8');
                const nextHtml = updateMainRegionInEditorHtml(currentHtml, panels.editor);
                fs.writeFileSync(EDITOR_HTML_PATH, nextHtml, 'utf8');
              }
              if (typeof panels.collect === 'string' && panels.collect.trim()) {
                const currentHtml = fs.readFileSync(COLLECT_HTML_PATH, 'utf8');
                const nextHtml = updateMainRegionInCollectHtml(currentHtml, panels.collect);
                fs.writeFileSync(COLLECT_HTML_PATH, nextHtml, 'utf8');
              }
              if (typeof panels.overlays === 'string' && panels.overlays.trim()) {
                const overlaysPath = path.join(STUDIO_DIR, 'overlays.html');
                if (fs.existsSync(overlaysPath)) {
                  const currentHtml = fs.readFileSync(overlaysPath, 'utf8');
                  const bodyMatch = currentHtml.match(/<body[^>]*>/i);
                  const bodyEndIdx = currentHtml.indexOf('</body>');
                  if (bodyMatch && bodyEndIdx !== -1) {
                    const insertStart = bodyMatch.index + bodyMatch[0].length;
                    const nextHtml = currentHtml.slice(0, insertStart) + '\n' + panels.overlays + '\n' + currentHtml.slice(bodyEndIdx);
                    fs.writeFileSync(overlaysPath, nextHtml, 'utf8');
                  }
                }
                syncOverlaysToClientFiles(panels.overlays);
              }
            } else if (typeof regionHtml === 'string' && regionHtml.trim()) {
              if (targetPanel === 'editor') {
                const currentHtml = fs.readFileSync(EDITOR_HTML_PATH, 'utf8');
                const nextHtml = updateMainRegionInEditorHtml(currentHtml, regionHtml);
                fs.writeFileSync(EDITOR_HTML_PATH, nextHtml, 'utf8');
              } else if (targetPanel === 'collect') {
                const currentHtml = fs.readFileSync(COLLECT_HTML_PATH, 'utf8');
                const nextHtml = updateMainRegionInCollectHtml(currentHtml, regionHtml);
                fs.writeFileSync(COLLECT_HTML_PATH, nextHtml, 'utf8');
              } else if (targetPanel === 'overlays') {
                const overlaysPath = path.join(STUDIO_DIR, 'overlays.html');
                if (fs.existsSync(overlaysPath)) {
                  const currentHtml = fs.readFileSync(overlaysPath, 'utf8');
                  const bodyMatch = currentHtml.match(/<body[^>]*>/i);
                  const bodyEndIdx = currentHtml.indexOf('</body>');
                  if (bodyMatch && bodyEndIdx !== -1) {
                    const insertStart = bodyMatch.index + bodyMatch[0].length;
                    const nextHtml = currentHtml.slice(0, insertStart) + '\n' + regionHtml + '\n' + currentHtml.slice(bodyEndIdx);
                    fs.writeFileSync(overlaysPath, nextHtml, 'utf8');
                  }
                }
                syncOverlaysToClientFiles(regionHtml);
              } else {
                const currentHtml = fs.readFileSync(INDEX_HTML_PATH, 'utf8');
                const nextHtml = updateMainRegionInIndexHtml(currentHtml, regionHtml);
                fs.writeFileSync(INDEX_HTML_PATH, nextHtml, 'utf8');
              }
            }

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ ok: true, savedAt: new Date().toISOString(), targetPanel }));
          } catch (err) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ ok: false, error: String(err.message || err) }));
          }
          return;
        }

        next();
      });
    }
  };
}

const config = defineConfig({
  root: 'client',
  base: './',
  plugins: [tidyflowStudioPlugin()],
  server: {
    port: 5173,
    strictPort: true
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true
  }
});

config._helpers = {
  updateMainRegionInIndexHtml,
  updateMainRegionInEditorHtml,
  updateMainRegionInCollectHtml,
  stripSelectWrappers,
  stripStudioClasses,
  findDivBoundsById,
  findDivBoundsByClass,
  syncOverlaysToClientFiles
};

module.exports = config;
