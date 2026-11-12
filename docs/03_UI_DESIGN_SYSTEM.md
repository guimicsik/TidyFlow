# 03. UI, Design System e Contratos de DOM

---

## 1. Janelas Registradas no CEP (`CSXS/manifest.xml`)

| Extensão ID | Arquivos | Geometria | Tipo | Porta Debug (AE / PPro) |
| :--- | :--- | :--- | :--- | :--- |
| `com.tidyflow` | `client/index.html`, `index.css`, `main.js` | `360 × 400 px` (fixo) | `Panel` | `8088` / `8090` |
| `com.tidyflow.editor` | `client/tree_editor.html`, `tree_editor.css`, `tree_editor.js` | `740 × 640 px` | `Modeless` | `8089` / `8091` |
| `com.tidyflow.collect` | `client/collect.html`, `collect.css`, `collect.js` | `600 × 750 px` | `Modeless` | `8093` / `8094` |

---

## 2. Arquitetura CSS em Camadas (`client/theme.css` + `client/theme/`)

No painel principal, os manifests definem tamanho inicial, mínimo e máximo de 360 × 400 px. No Windows, `scripts/resize_window.ps1 -MainPanel` também fixa a janela flutuante identificada pela posição e pelo único CEF; painéis encaixados continuam sob controle do host. As grades mantêm três colunas iguais.

`client/theme.css` atua como **ponto de entrada unificado** via `@import` e é carregado **antes** do CSS de cada janela. Ele agrega os módulos especializados dentro de `client/theme/`:
- `client/theme/tokens.css` — Tokens globais (`:root`): fontes, cores, física mecânica, tamanhos e aliases.
- `client/theme/buttons.css` — Botões base (`.tf-btn`), variantes de cor e modificadores de tamanho (`--sm`, `--xs`, `--mini`).
- `client/theme/tiles.css` — Tiles do painel principal (`.tf-btn--hero`, `.tf-btn--tile`, `.tf-btn--tile-danger`, `.btn-tile-label`).
- `client/theme/toggles.css` — Toggles em tile (`.tf-toggle`) e switches/checkboxes vetoriais (`.tf-checkbox`, `.toggle-slider`).
- `client/theme/select.css` — Dropdown customizado (`.tf-select-wrapper`, `.tf-select-trigger`, `.tf-select-menu`).
- `client/theme/badges.css` — Badges e tags (`.tf-badge`).
- `client/theme/modals.css` — Modais e caixas de diálogo (`.modal-backdrop`, `.modal-card`, alert dialog).

**Nunca recrie cores, bordas ou sombras locais nos CSS das janelas.**

### 2.1 Tokens do `:root` em `theme/tokens.css` (Design System Neo-Brutalista)
- **Tipografia e Escalas:** `--tf-font-family` (Google Fonts: *Archivo*), `--tf-font-weight-bold` (`800`), `--tf-font-weight-medium` (`600`) + escalas de fonte (`--tf-font-size-hero`, `tile`, `toggle`, `rollback`, `preset-label`, `preset-select`, `modal-btn`).
- **Paleta de Cores Editorial Monochrome + Electric Blue:**
  - Hero: `--tf-neo-hero-bg` (`#3B82F6`), `--tf-neo-hero-text` (`#FFFFFF`), `--tf-neo-hero-hover` (`#60A5FA`).
  - Tiles: `--tf-neo-tile-bg` (`#E4E4E7`), `--tf-neo-tile-text` (`#000000`), `--tf-neo-tile-hover` (`#F4F4F5`).
  - Danger (Rollback): `--tf-neo-danger-bg` (`#EF4444`), `--tf-neo-danger-text` (`#000000`), `--tf-neo-danger-hover` (`#F87171`).
  - Primário / Accent: `--tf-neo-primary-bg` (`#3B82F6`), `--tf-accent` (`#3B82F6`).
  - Toggles em Tile: `--tf-neo-toggle-off-bg` (`#262626`), `--tf-neo-toggle-on-bg` (`#3B82F6`), `--tf-neo-toggle-partial-bg` (`#0EA5E9`).
  - Ghost: `--tf-neo-ghost-bg` (`#262626`), `--tf-neo-ghost-text` (`#E4E4E7`), `--tf-neo-ghost-hover` (`#60A5FA`).
  - Confirmação & Alertas: `--tf-neo-success-bg` (`#10B981`), `--tf-neo-warning-bg` (`#F59E0B`).
- **Geometria, Bordas e Física Mecânica:**
  - Bordas: `--tf-neo-border-color` (`#000000`), `--tf-neo-border-w` (`2px`), `--tf-neo-radius` (`6px`), `--tf-neo-radius-sm` (`4px`).
  - Sombras Rígidas no Hover: `--tf-neo-shadow-hero` (`4px 4px 0px #000`), `--tf-neo-shadow-tile` (`3px 3px 0px #000`), `--tf-neo-shadow-mini` (`2px 2px 0px #000`).
  - Elevação Mecânica no Hover: `--tf-neo-lift-hero` (`-4px`), `--tf-neo-lift-tile` (`-3px`), `--tf-neo-lift-mini` (`-2px`).

### 2.2 Classes de Componentes Reutilizáveis
- **Botões (`.tf-btn`):**
  - Variantes de cor: `.tf-btn--primary` (azul elétrico), `.tf-btn--destructive` (vermelho carmim), `.tf-btn--success` (verde esmeralda), `.tf-btn--warning` (âmbar), `.tf-btn--ghost` (carvão neutro).
  - Variantes de painel: `.tf-btn--hero` (Organizar Projeto - azul elétrico `#3B82F6` com texto branco `#FFFFFF`), `.tf-btn--tile` (Criar Estrutura / Apenas Mídias / Collect Files - cinza claro `#E4E4E7` com texto preto `#000000`), `.tf-btn--tile-danger` (Rollback - vermelho `#EF4444`).
  - Escalas de altura: `.tf-btn--sm` (`32px`), `.tf-btn--xs` (`28px`), `.tf-btn--mini` (`24px`).
  - Física dos estados: repouso flat (`box-shadow: 0px 0px 0px #000; transform: translate(0, 0)`), elevação mecânica no hover (`translate(-2px, -2px)` com `box-shadow: 2px 2px 0px #000`) e compressão no clique (`translate(0, 0)`).
- **Toggles em Tile (`.tf-toggle` + `.tf-toggle__face`):**
  - Usados nos 3 toggles do painel principal e nos botões de regra do Modal V2 no Preset Builder.
  - Estados: desligado (carvão neutro `#262626` com texto `#F4F4F5`), ligado (`:checked` ou `.active` → azul elétrico `#3B82F6` com texto branco `#FFFFFF`), parcial (`.partial` → ciano profundo `#0EA5E9`, usado quando `groupBySourceFolder` diverge entre pastas).
- **Checkbox / Switch Neo-Brutalista (`.tf-checkbox` / `.toggle-slider`):**
  - Chaves compactas (`18 × 18 px`), com borda preta sólida de `2px`, checkmark vetorizado em 45º e física flat em repouso com subida mecânica (`translate(-2px, -2px)` + sombra `2px 2px 0px #000`) no hover.
  - Usadas nas opções do Preset Builder (`Numeração Sequencial`, `Categorias de Áudio ESP`, `Numerar ESP`) e nas opções do Collect Files (`.collect-check`).
  - Estados: desligado (`#262626`), ligado (`:checked` → azul elétrico `#3B82F6` com checkmark preto).
- **Dropdown Neo-Brutalista (`.tf-select-*`):**
  - Seletor estilizado com trigger flat em azul elétrico (`.tf-select-trigger`), elevação mecânica no hover, chevron animado (`.tf-select-chevron`) e card flutuante pastel (`.tf-select-menu` em `#DBEAFE`) com sombra `4px 4px 0px #000`.
- **Modais e Alert Dialog (`.modal-*`):**
  - Card neobrutalista com borda `2px solid #000`, sombra rígida `6px 6px 0px #000` e backdrop desfocado (`backdrop-filter: blur(2px)`).

---

## 3. Mapa de IDs Críticos de DOM (Validados por `client_refs_test.js`)

> **Atenção:** O teste `scripts/tests/client_refs_test.js` verifica estaticamente se todos os seletores `getElementById` / `querySelector` usados em `main.js`, `tree_editor.js` e `collect.js` existem nos respectivos HTMLs. Se adicionar ou remover um ID no JS, atualize o HTML correspondente.

### 3.1 Painel Principal (`client/index.html`)
- **Preset e Ações:** `#presetSelect`, `#btnOpenPresetBuilder`, `#btnOrganize`, `#btnCreateStructure`, `#btnMediaOnly` (*Organizar Mídias*), `#btnOpenCollect` (*Collect Files*), `#btnRollback` (*Desorganizar Projeto, centralizado em `.rollback-row` no mesmo tamanho dos outros tiles*).
- **Toggles Rápidos:** `#chkSaveProject`, `#chkDeleteEmptyFolders`, `#chkGroupBySourceFolder` (+ indicador `#groupSourceNote`). *(A numeração sequencial vive apenas no Preset Builder; a redução de projeto vive exclusivamente no Collect Files).*
- **Modais de Confirmação:**
  - Rollback: `#rollbackModalBackdrop`, `#btnRollbackSaveAndContinue`, `#btnRollbackContinueWithoutSave`, `#btnRollbackCancel`.

### 3.2 Preset Builder (`client/tree_editor.html`)
- **Barra Superior (Linha Única com Ícones) e Toggles:** `#presetSelect`, `#badgeBuiltIn`, `#badgeUnsaved`, `#btnDeletePreset`, `#btnSaveAsPreset`, `#btnResetDefault`, `#btnImportJson`, `#btnExportJson`, `#btnOpenPresetsFolder` (todos estilizados com `.preset-icon-btn`), `#chkUsePrefixNumbering`, `#chkSeparateAudioCategories` (*Categorias de Áudio ESP*, desabilitado no AE), `#chkNumberAudioCategories` (*Numerar ESP*, desabilitado no AE).
- **Árvore e Rodapé:** `#btnAddTopFolder`, `#treeRootList`, `#colorLabelPopover`, `#statusMessage`, `#btnFooterSave`, `#btnCloseEditor`.
- **Modal de Regras V2 (`492px`):** `#rulesModalBackdrop`, `.pack-toggle-btn` (7 formatos), `#inpCustomExtension`, `#customExtChipsContainer`, `#btnClearAllExts`, toggles de subpasta (`#ruleGroupSubfoldersByExt`, `#ruleGroupBySourceFolder`, `#ruleGroupByMainComp`, `#ruleHandlePsdBundles`, `#ruleCatchOthers`), `#inpNameFilterTag`, `#btnAddNameTag`, `#btnClearNameTags`, `#nameFilterTagsContainer`, `#btnCancelRulesModal`, `#btnApplyRulesModal`.
- **Modais Auxiliares:** `#saveAsModalBackdrop`, `#confirmModalBackdrop`, `#unsavedCloseModalBackdrop`.

