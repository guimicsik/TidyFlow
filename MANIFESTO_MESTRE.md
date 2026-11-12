# TIDYFLOW (After Effects & Premiere Pro) — Manifesto Mestre

> **DIRETRIZ PARA AGENTES DE IA (ECONOMIA DE TOKENS):**
> Este arquivo é o **Índice Mestre e Guia de Contexto Rápido** (~3 KB).
> 1. **NUNCA** leia todos os arquivos de `client/`, `host/` ou `docs/` de uma só vez.
> 2. Consulte a **Tabela de Roteamento (Seção 1)** abaixo e leia **apenas** o documento de `docs/` correspondente à sua tarefa.
> 3. Use o **Mapa de Funções e Linhas** em `docs/01_ARQUITETURA_E_HOSTS.md` para ler somente o trecho necessário (`StartLine` / `EndLine`) dos arquivos de código.

---

## 1. Tabela de Roteamento da Documentação (`docs/`)

Leia **exclusivamente** o módulo necessário para a tarefa atual:

| Quando a tarefa envolver... | Leia apenas este arquivo | Conteúdo Principal |
| :--- | :--- | :--- |
| **Onde está uma função**, editar `.jsx`/`.js`, APIs de AE vs Premiere, regras ES3 ou **Snapshot/Rollback** | [`docs/01_ARQUITETURA_E_HOSTS.md`](docs/01_ARQUITETURA_E_HOSTS.md) | Mapa de arquivos, funções e linhas (`StartLine`/`EndLine`), equivalência `AEFT` × `PPRO`, armadilhas ES3 e fluxo de Rollback. |
| **Presets**, regras de classificação, numeração `01_`, filtro por nome ou **Áudio ESP (Premiere)** | [`docs/02_PRESETS_REGRAS_E_AUDIO.md`](docs/02_PRESETS_REGRAS_E_AUDIO.md) | Taxonomia *Default Clean*, `schema_preset.json`, motor de pontuação `_rules.jsx`, cache `PresetManager` e triagem de áudio ESP/XMP. |
| **Interface (HTML/CSS)**, botões, toggles, modais ou **Preset Builder** | [`docs/03_UI_DESIGN_SYSTEM.md`](docs/03_UI_DESIGN_SYSTEM.md) | Geometria das 3 janelas CEP, tokens e classes de `theme.css` / `client/theme/*` (`.tf-btn*`, `.tf-toggle*`) e IDs de DOM obrigatórios. |
| **Design Studio (Localhost)**, alterar cores, pesos, textos, animações, gaps ou drag-and-drop | [`docs/07_DESIGN_STUDIO.md`](docs/07_DESIGN_STUDIO.md) | Arquitetura do editor visual em `tools/studio/`, API `/api/studio/*` no Vite e sincronização bidirecional com `client/theme/tokens.css` e `index.html`. |
| **Collect Files** (funcionamento atual, cópia, relink `.aepx` / `.prproj` gzip, proxies, `Report.txt`) | [`docs/04_COLLECT_FILES_SPEC.md`](docs/04_COLLECT_FILES_SPEC.md) | Especificação técnica consolidada do Collect Files (AE + Premiere Pro), sanitização, reescrita XML e matriz de cancelamento. |
| **Novas features do Collect Files (V2)** (checklist de comps, renomear mídias, espaço em disco, previews) | [`docs/05_ROADMAP_COLLECT_V2.md`](docs/05_ROADMAP_COLLECT_V2.md) | Escopo aprovado do Collect V2, arquitetura de painel adaptativo e checklist de implementação das Fases 1 a 5. |
| **Avaliação de ideias futuras (Backlog Aprovado)** (ZIP, LUTs e deduplicação de mídias) | [`docs/roadmap_futuro/00_VISAO_GERAL_IMPACTO_E_UX.md`](docs/roadmap_futuro/00_VISAO_GERAL_IMPACTO_E_UX.md) | Matriz de UX/performance e `.md` técnicos individuais (`01_` a `03_`) dos 3 únicos recursos extras aprovados. |
| **Rodar testes (`npm test`)**, criar testes ou consultar bugs já resolvidos | [`docs/06_HISTORICO_E_TESTES.md`](docs/06_HISTORICO_E_TESTES.md) | Mapa das 9 suítes em `scripts/tests/` (102 testes) e resumo das decisões técnicas e armadilhas corrigidas nas Fases 1 a 9. |

---

## 2. Identidade, Extensões e Eventos CEP

- **Bundle ID:** `com.tidyflow` (compatível com After Effects `AEFT [16.0,99.9]` e Premiere Pro `PPRO [22.0,99.9]`).
- **Janelas Registradas (`CSXS/manifest.xml`):**
  - `com.tidyflow` — Painel Principal (`client/index.html`, tamanho fixo definido no manifesto; atualmente `370×430 px`).
  - `com.tidyflow.editor` — Preset Builder (`client/tree_editor.html`, Modeless `740×640 px`).
  - `com.tidyflow.collect` — Collect Files (`client/collect.html`, Modeless `390×460 px`).
- **Canal CSEvent:** `com.tidyflow.presetsUpdated` (disparado ao salvar/excluir/importar presets; sincroniza painel e editor).
- **Armazenamento de Presets:** `%APPDATA%/TidyFlow/presets` (com migração automática única de `%APPDATA%/AE_Organizer/presets` e fallback em `localStorage`). Preset de fábrica: `client/presets/default_preset.json` (`isBuiltIn: true`).

---

## 3. Estrutura Enxuta do Repositório

```text
TidyFlow/
├── AGENTS.md                   # Regras obrigatórias do agente (ES3, idioma, economia de tokens)
├── MANIFESTO_MESTRE.md         # Este índice mestre e contratos globais
├── docs/                       # Documentação modularizada (consulte sob demanda via Seção 1)
├── CSXS/manifest.xml           # Registro CEP unificado (AEFT + PPRO)
├── client/                     # Camada UI / Browser CEP + Node.js
│   ├── theme.css               # Entry point do Design System (importa client/theme/*.css)
│   ├── theme/                  # Módulos CSS: tokens.css (:root), buttons.css, tiles.css, toggles.css, select.css, badges.css, modals.css
│   ├── index.html/.css + main.js             # Painel Principal
│   ├── tree_editor.html/.css/.js             # Preset Builder (Editor de Árvore e Regras V2)
│   ├── collect.html/.css/.js + CollectEngine.js # Janela e motor puro do Collect Files
│   ├── PresetManager.js        # Persistência, cache, schema, labels e extensões por host
│   ├── OrgLog.js               # Logger (ring buffer 200 RAM / 50 localStorage)
│   └── presets/default_preset.json
├── tools/studio/               # TidyFlow Design Studio (editor visual localhost isolado do pacote CEP)
│   └── studio.html/.css/.js    # Controles visuais, drag-and-drop e sincronização bidirecional
├── host/                       # Camada ExtendScript (ES3 estrito + UTF-8 obrigatório)
│   ├── _lib.jsx                # Helpers compartilhados ($.global.OrgLib)
│   ├── _rules.jsx              # Classificador por pontuação ($.global.OrgRules)
│   ├── organizer.jsx           # Roteador agnóstico de host (AEFT vs PPRO)
│   ├── aeft_organizer.jsx      # Motor de organização e rollback do After Effects
│   ├── ppro_organizer.jsx      # Motor de organização, áudio ESP e rollback do Premiere Pro
│   ├── aeft_collect.jsx        # Host do Collect Files no After Effects (.aepx)
│   └── ppro_collect.jsx        # Host do Collect Files no Premiere Pro (.prproj)
└── scripts/tests/              # Suíte de testes em Node puro (`npm test` -> run.js)
```

---

## 4. Contratos Globais de Comunicação (`Client <-> Host`)

O cliente CEP chama sempre as funções globais expostas por `host/organizer.jsx`, que roteiam para `aeft_*` ou `ppro_*`:

| Chamada Global (`$.global.*`) | Retorno JSON Padronizado |
| :--- | :--- |
| `organizeWithPreset(mode, presetJson)`<br>*(mode: `"selection"` ou `"media_only"`)* | `{ success, movedComps, movedFootages, cleanedFolders, reducedCount, projectSaved, elapsedMs, scanCount, error }` *(+ campos `audio*`, `emptyLeftovers` e `debugTrace` no PPro)* |
| `createPresetFolderStructure(presetJson)` | `{ success, createdFolders, projectSaved, error }` |
| `checkUnusedComps(presetJson)` | `{ success, movedUnusedComps, movedEmptyItems, unusedFolderName, error }` |
| `getRollbackSnapshotJson()` | JSON do snapshot pré-organização (espelhado em `localStorage["ae_organizer_rollback_snapshot"]`) |
| `rollbackProject(saveBefore, snapshotJson)` | `{ success, restoredItems, recreatedFolders, removedFolders, projectSaved, error }` |
| `collectScan(optionsJson)` | `{ success, host, projectPath, projectName, items[], effects[], fonts[], offlineCount, selectedCompCount, error }` |
| `collectSaveProject()` / `collectSaveAepx(path)` | `{ success, projectPath / aepxPath, error }` |
| `collectFinalize(optionsJson)` | `{ success, projectPath, renamedCount, reducedCount, error }` |
