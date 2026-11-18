const fs = require('node:fs');
const path = require('node:path');

function renderStudioHtml(studioDir) {
  const shell = fs.readFileSync(path.join(studioDir, 'studio.html'), 'utf8');
  return shell.replace(/^([ \t]*)<!-- include: ([a-z-]+) -->/gm, (_, indent, name) => {
    const html = fs.readFileSync(path.join(studioDir, 'partials', name + '.html'), 'utf8');
    return html.trimEnd().replace(/^(.+)$/gm, indent + '$1');
  });
}

module.exports = { renderStudioHtml };
