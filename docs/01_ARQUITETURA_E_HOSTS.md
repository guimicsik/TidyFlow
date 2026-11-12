# 01. Arquitetura, Mapa de Código e Hosts (AE & Premiere)

> **Regra de Economia de Tokens:** Use as tabelas de linhas abaixo com `read_file` (`StartLine` / `EndLine`) para ler **apenas a função necessária**. Nunca leia os arquivos `.jsx` ou `.js` inteiros de uma vez.

---

## 1. Mapa Cirúrgico de Funções e Linhas (`host/` e `client/`)

### 1.1 Camada Host (`host/*.jsx` — ECMAScript 3 Estrito)

| Arquivo | Função / Ponto de Entrada | Linhas aprox. | Responsabilidade |
| :--- | :--- | :--- | :--- |
| `host/_lib.jsx` | `$.global.OrgLib` (`escapeJsonString`, `parseJson`, `stripNumericPrefix`, `getFileExtension`, `getParentFolderNameFromPath`, `isSameItem`, `log/warn/error`) | `L1–L110` | Helpers puros compartilhados e logger com hook `$.global.OrgLogHook`. |
| `host/_rules.jsx` | `matchesNameFilter`, `nodeSupportsType`, `createMatcher`, `findMatchingNode` | `L25–L197` | Motor unificado de classificação por pontuação (`$.global.OrgRules`). |
| `host/organizer.jsx` | `detectIsPremierePro`, `evalHostScriptFile`, `organizerLoadEngine` | `L8–L165` | Bootstrap UTF-8, detecção `AEFT` vs `PPRO` e guarda de erro `_organizerLastLoadError`. |
| `host/organizer.jsx` | `$.global.organizeWithPreset`, `createPresetFolderStructure`, `checkUnusedComps`, `rollbackProject`, `getRollbackSnapshotJson`, `collect*` | `L169–L340` | Roteadores públicos chamados pelo CEP via `csInterface.evalScript`. |
| `host/aeft_organizer.jsx` | `$.global.aeft_getProjectComps`, `aeft_checkUnusedComps` | `L24–L320` | Listagem de comps e isolamento de comps não usadas (`Nunca Usadas`). |
| `host/aeft_organizer.jsx` | `$.global.aeft_organizeWithPreset` | `L325–L1305` | Motor principal AE: índice `_folderIndex` (`L462`), classificação (`L627`), pré-comps (`L941`), limpeza de vazias (`L1146`), numeração/labels (`L1215`). |
| `host/aeft_organizer.jsx` | `$.global.aeft_createPresetFolderStructure` | `L1309–L1430` | Criação física da árvore vazia com Color Labels no AE. |
| `host/aeft_organizer.jsx` | `aeft_captureRawSnapshot`, `aeft_ensurePreOrganizeSnapshot`, `aeft_markPostOrganizeState`, `aeft_getRollbackSnapshotJson`, `aeft_rollbackProject` | `L1437–L1823` | Sistema completo de Snapshot & Rollback no After Effects. |
| `host/ppro_organizer.jsx` | `ppro_beginUndoGroup`, `ppro_endUndoGroup`, `ppro_resetSequenceCache` | `L35–L95` | Fronteira de Undo e cache de sequências/debug trace no Premiere. |
| `host/ppro_organizer.jsx` | `buildSequenceMap`, `inspectSequenceTracks` | `L312–L390` | Indexação memoizada de sequências e varredura de trilhas (`video`/`audio`/`caption`). |
| `host/ppro_organizer.jsx` | `buildTimelineAudioMap`, `classifyAudioRole` | `L393–L780` | Triagem de áudio ESP/XMP/Trilhas/Nomes em cascata (`Dialogue`, `Music`, `SFX`, `Ambience`, `Others`). |
| `host/ppro_organizer.jsx` | `$.global.ppro_getProjectComps`, `ppro_checkUnusedComps` | `L882–L1190` | Listagem de sequências e isolamento de sequências não usadas. |
| `host/ppro_organizer.jsx` | `$.global.ppro_organizeWithPreset` | `L1197–L2305` | Motor principal PPro: redução via bin temp (`L1210`), classificação (`L1424`), dependências (`L1601`), limpeza (`L2095`), numeração ESP (`L2135`) e numeração da árvore (`L2196`). |
| `host/ppro_organizer.jsx` | `$.global.ppro_createPresetFolderStructure` | `L2309–L2425` | Criação física de Bins vazias com Color Labels no Premiere. |
| `host/ppro_organizer.jsx` | `ppro_captureRawSnapshot`, `ppro_ensurePreOrganizeSnapshot`, `ppro_markPostOrganizeState`, `ppro_getRollbackSnapshotJson`, `ppro_rollbackProject` | `L2429–L2800` | Sistema completo de Snapshot & Rollback no Premiere Pro. |
| `host/aeft_collect.jsx` | `aeft_collectScan`, `aeft_collectSaveProject`, `aeft_collectSaveAepx`, `aeft_collectFinalize` | `L139–L365` | Host do Collect Files no After Effects (`.aepx` e `reduceProject`). |
| `host/ppro_collect.jsx` | `ppro_collectScan`, `reduceOpenPProProject`, `ppro_collectFinalize` | `L481–L890` | Host do Collect Files no Premiere Pro (`.prproj`, MOGRTs, proxies e `reduceProject`). |

### 1.2 Camada Cliente (`client/*.js` — Chromium CEP + Node.js)

| Arquivo | Funções Principais | Linhas aprox. | Responsabilidade |
| :--- | :--- | :--- | :--- |
| `client/main.js` | `loadOrReloadHostScripts`, `syncRollbackSnapshotToLocalStorage`, `enforceReduceRequiresSave`, `syncPresetsAndToggles` | `L65–L250` | Inicialização do painel principal, sincronização de toggles e invariante `reduce ⇒ save`. |
| `client/main.js` | `buildAudioSummary`, `runOrganizer`, `runRollback` | `L440–L800` | Disparo de ações para o host, resumo diagnóstico de áudio e modais de confirmação (`#reduceModalBackdrop`, `#rollbackModalBackdrop`). |
| `client/PresetManager.js` | `getFactoryPresetObject`, `normalizePreset`, `getDefaultExtensions`, `getLabelsList` | `L154–L569` | Dicionários por host (`AEFT` vs `PPRO`), normalização de schema e labels. |
| `client/PresetManager.js` | `getPresetsFolderPath`, `listPresets`, `loadPreset`, `savePreset`, `deletePreset`, `importPresetFromJsonString` | `L570–L1155` | Persistência em `%APPDATA%/TidyFlow/presets`, cache em memória, overrides do Default e guarda `PRESET_EXISTS`. |
| `client/tree_editor.js` | `renderTree`, `createNodesDom`, `openColorLabelPopover` | `L421–L845` | Árvore drag & drop (zonas 25%/50%/25%) e popover de 17 Color Labels. |
| `client/tree_editor.js` | `openRulesModalForNode`, `renderModalCustomExts`, `renderModalNameTags` | `L847–L1210` | Modal de Regras V2 (tiles de tipo, chips de extensão inline e tags de `nameFilter`). |
| `client/tree_editor.js` | `executeSaveAs`, `saveCurrentPresetOrPromptNew`, `importPresetJson`, `openUnsavedCloseModal` | `L1213–L1620` | Fluxos de salvamento, proteção contra sobrescrita e guarda de `isDirty`. |
| `client/CollectEngine.js` | `planSources`, `createEstimator`, `rewriteAepxXml`, `rewritePrprojXml`, `buildCollectPlan`, `buildReportText` | `L16–L710` | Motor puro do Collect Files (testável em Node sem CEP). |
| `client/collect.js` | `runScan`, `recomputeEstimate`, `executeCollect`, `copyNext`, `finalizeProject` | `L60–L910` | Controlador de UI, cópia assíncrona com stream/progresso, cancelamento e limpeza. |
| `client/OrgLog.js` | `OrgLog.debug/info/warn/error`, `dump`, `count` | `L1–L110` | Ring buffer (200 em RAM, 50 em `localStorage`) para observabilidade. |

---

## 2. Portabilidade After Effects (`AEFT`) vs Premiere Pro (`PPRO`)

Um único bundle (`com.tidyflow`) atende ambos os hosts. A detecção no cliente usa `PresetManager.isPremierePro()` (`appId === "PPRO"`) e no host usa `detectIsPremierePro()` em `host/organizer.jsx`.

| Operação / Conceito | After Effects (`AEFT`) | Premiere Pro (`PPRO` 22.x+) |
| :--- | :--- | :--- |
| **Raiz do Projeto** | `app.project.rootFolder` | `app.project.rootItem` |
| **Contêiner (Pasta / Bin)** | `FolderItem` (`app.project.items.addFolder(name)`) | `Bin` (`parentBin.createBin(name)`) |
| **Mover Item** | `item.parentFolder = targetFolder` | `item.moveBin(targetBin)` *(proteger com `try/catch` via `moveItemSafe`)* |
| **Identificador Único** | `item.id` (numérico) | `item.nodeId` (string) |
| **Composição / Sequência** | `item instanceof CompItem` | `item.isSequence()` + `app.project.sequences` |
| **Caminho de Mídia** | `item.file ? item.file.fsName : null` | `item.getMediaPath()` |
| **Color Labels (0–16)** | `item.label = 0..16` (`AE_LABELS`) | `item.getColorLabel()` / `setColorLabel(n)` (`PPRO_LABELS_BY_SLOT`) |
| **Itens Sintéticos (`Solids`)** | `item.mainSource instanceof SolidSource` | *Color Matte*, *Adjustment Layer*, *Black Video*, *Bars & Tone*, *Transparent Video* |
| **Redução de Projeto** | Nativa: `app.project.reduceProject([comp])` | Via bin temporário `__ORGANIZER_REDUCE_TMP__` (ou `__TIDYFLOW_COLLECT_REDUCE_TMP__`) |

---

## 3. Regras Críticas do ExtendScript (ES3) — Armadilhas Conhecidas

1. **Proibido ES5/ES6+:** Nunca use `let`, `const`, arrow functions, template literals, trailing commas em objetos/arrays, ou métodos de array como `.forEach`, `.map`, `.filter`, `.indexOf`, `Object.keys`. Use `var`, `for` clássico e helpers do `$.global.OrgLib`.
2. **Escape de Barra `/` em Classes RegExp `[...]`:** No parser lexical ES3 da Adobe (ECMA-262 3ª Ed.), uma `/` não escapada dentro de `[...]` encerra o literal RegExp prematuramente e gera `SyntaxError` na carga do arquivo (mesmo que passe no Node/V8). Sempre escreva `\/` dentro de colchetes (ex.: `/[\-_.:\/\\+,;()\[\]]/g`).
3. **Acentos em RegExp:** Nunca use caracteres não-ASCII literais dentro de RegExp no ExtendScript; use escapes Unicode (`\u00e0-\u00fc`).
4. **Encoding UTF-8 Obrigatório:** Sempre defina `fileObj.encoding = "UTF-8";` antes de chamar `$.evalFile(fileObj)` (padrão centralizado em `evalHostScriptFile` no `organizer.jsx`).
5. **Proibido `item.replace()` no AE:** Nunca use `FootageItem.replace()` ou `replaceWithSequence()` para relink — eles achatam camadas de PSD/AI, perdem alpha e resetam FPS de proxy. Use reescrita de `.aepx`.

---

## 4. Fluxo de Snapshot & Rollback

Garante que qualquer organização ou estrutura criada possa ser revertida ao estado exato anterior:

1. **Antes de organizar (`ensurePreOrganizeSnapshot`):** Captura `id`/`nodeId`, `name`, pasta/bin pai, `label`, `comment` e profundidade. Se o usuário reexecutar a organização seguidamente no mesmo projeto sem mudanças externas, **preserva o primeiro snapshot** (não sobrescreve com o projeto já organizado).
2. **Após organizar (`markPostOrganizeState`):** Registra os IDs das pastas/bins criadas pelo TidyFlow e o pai final de cada item.
3. **Sincronização (`syncRollbackSnapshotToLocalStorage`):** O cliente salva o JSON de `getRollbackSnapshotJson()` em `localStorage["ae_organizer_rollback_snapshot"]` tanto no sucesso quanto em caso de falha parcial do Organizar.
4. **Execução (`rollbackProject(saveBefore, snapshotJson)`):** Recria pastas originais ausentes (com label), devolve cada item ao pai original, remove pastas criadas pelo TidyFlow que ficaram vazias e opcionalmente salva o projeto.

