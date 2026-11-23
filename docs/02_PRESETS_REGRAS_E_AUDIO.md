# 02. Presets, Motor de Regras e Triagem de Áudio (ESP)

---

## 1. Taxonomia Padrão (*Default Clean*) e Numeração

```text
📁 01_Output/          → MainComp (Composição Principal / Sequência Final)
📁 02_Assets/
   ├── 📁 01_PreComps/ → PreComps / Sequências aninhadas (subpastas por Comp Principal + Geral/)
   ├── 📁 02_Images/   → StillImages (PSD/AI isolados em bundles, PNG, JPG, OTHERS...)
   ├── 📁 03_Footages/ → Videos + ImageSequences (MP4, MOV, PRORES, OTHERS...)
   ├── 📁 04_Audios/   → Audios (no PPro com ESP: 01_Dialogue..05_Others > WAV, MP3...)
   └── 📁 05_Solids/   → Solids / Itens Sintéticos
📁 Nunca Usadas/       → Comps/sequências vazias ou desvinculadas (Check Comps)
```

### Regras de Numeração (`applyTreeNumberingAndLabels`)
- **Numeração Sequencial Contínua (`01_`, `02_`...):** Quando `settings.usePrefixNumbering: true`, numera sequencialmente (`currentSeq++`) **apenas as pastas que efetivamente existem/receberam itens** (sem pular números quando categorias intermediárias ficam vazias).
- **Exclusão por Nó:** Um nó com `useNumbering: false` não recebe prefixo e não consome número da sequência.
- **Idempotência:** Antes de aplicar o prefixo, `OrgLib.stripNumericPrefix(name)` remove qualquer `^\d+_` anterior, evitando `01_01_`.

---

## 2. Contrato do Preset (`schema_preset.json`)

Arquivo base de fábrica: `client/presets/default_preset.json` (único para AE e PPro; extensões padrão são resolvidas em runtime por `PresetManager.getDefaultExtensions()`).

### 2.1 Raiz e `settings`
| Campo | Tipo / Padrão | Descrição |
| :--- | :--- | :--- |
| `presetName` | `string` | Nome único do perfil (chave de arquivo em `%APPDATA%/TidyFlow/presets`). |
| `isBuiltIn` | `boolean` | `true` apenas no `Default Clean` (bloqueia exclusão e sobrescrita da árvore). |
| `settings.usePrefixNumbering` | `true` | Ativa prefixos `01_`, `02_` contínuos nas pastas criadas. |
| `settings.deleteEmptyFolders` | `true` | Remove pastas/bins vazias ao fim da organização. |
| `settings.saveProjectBefore` | `true` | Salva o projeto antes de organizar (forçado `true` se `reduceProject` estiver ativo). |
| `settings.reduceProject` | `false` | Reduz o projeto às dependências da seleção antes de organizar (abre modal `#reduceModalBackdrop`). |
| `settings.groupBySourceFolder` | `true` | Ativa o agrupamento por pasta de origem (`sourceFolderMode !== "off"`). |
| `settings.sourceFolderMode` | `"both"` | Modo global de pasta de origem: `"both"` (pasta manual do projeto com fallback para pasta do disco), `"project"` (apenas pastas manuais do projeto), `"disk"` (apenas pasta física do disco) ou `"off"` (desligado). |
| `settings.unusedFolderName` | `"Nunca Usadas"` | Nome da pasta destino do botão *Verificar Comps/Sequências*. |
| `settings.separateAudioCategories` | `true` | *(Premiere)* Subdivide áudios por papel ESP (`Dialogue`, `Music`, `SFX`, `Ambience`, `Others`). |
| `settings.numberAudioCategories` | `true` | *(Premiere)* Numera continuamente (`01_`, `02_`) as subpastas de papel ESP presentes. |

### 2.2 Nós da Árvore (`tree[]` e `rules`)
Cada nó possui `{ id, name, label (0..16), useNumbering, children: [], rules: {} }`:

| Regra (`node.rules.*`) | Descrição |
| :--- | :--- |
| `types` | Array de categorias: `"MainComp"`, `"PreComps"`, `"StillImages"`, `"Videos"`, `"ImageSequences"`, `"Audios"`, `"Solids"`, `"DataFiles"`. |
| `extensions` | Lista efetiva de extensões sem ponto e minúsculas (pacote padrão dos `types` + `customExtensions`). |
| `customExtensions` | Tags avulsas adicionadas manualmente pelo usuário na caixa inline do modal V2. |
| `groupSubfoldersByExt` | Cria subpasta em MAIÚSCULAS por extensão (`MP4/`, `PNG/`). |
| `groupBySourceFolder` | Booleano espelhado de `sourceFolderMode !== "off"` (granular por nó; exibe `.partial` se divergir). |
| `sourceFolderMode` | Modo por nó (`"both"`, `"project"`, `"disk"` ou `"off"`): define se a subpasta de origem vem das pastas manuais criadas no projeto (AE/Premiere), da pasta física no disco, de ambos ou desligado. |
| `groupByMainComp` | Agrupa pré-comps/sequências aninhadas pelo nome da Comp/Sequência principal. |
| `handlePsdBundles` | Mantém intacto o contêiner/pasta nativa de PSD/AI importado em camadas. |
| `catchOthers` | Cria subpasta `OTHERS/` para itens do mesmo tipo sem extensão listada. |
| `nameFilter` / `nameFilterMode` | Palavras separadas por `,` ou `;` (`"contains"` padrão ou `"regex"`). |

---

## 3. Motor de Pontuação (`host/_rules.jsx` — `OrgRules`)

`findMatchingNode(itemType, fileExt, itemNameCandidates)` avalia todos os nós da árvore e retorna `{ node, isOther }`:

| Prioridade | Condição | Score Base | Observação |
| :--- | :--- | :--- | :--- |
| **1. Nome (`nameFilter`)** | Qualquer candidato em `nameCandidates` casa com `rules.nameFilter` | `1000 + depth*10` | **Prioridade máxima.** Ignora `rules.types` e `rules.extensions` do nó. |
| **2. Extensão Isolada** | Nó sem `types`, mas `fileExt` está em `rules.extensions` | `850 + depth*10 - extPenalty` | Bônus `+30` se `extensions.length <= 3`. |
| **3. Tipo + Extensão** | `nodeSupportsType` + `fileExt` está em `rules.extensions` | `700 + depth*10 - extPenalty` | Match padrão de mídia. |
| **4. Tipo sem Extensão** | Itens sem extensão (`MainComp`, `PreComps`, `Solids`) ou nó com `extensions: []` | `500` ou `400 + depth*10` | `500` para tipos estruturais; `400` para nó aberto. |
| **5. Fallback de Tipo (5b)** | `nodeSupportsType` casou, `catchOthers: false`, mas a lista `rules.extensions` está defasada | `380 + depth*10` | Evita que mídias fiquem órfãs na raiz em presets customizados antigos. |
| **6. Fallback `catchOthers`** | `nodeSupportsType` + `rules.catchOthers: true` (e nenhum outro nó do mesmo tipo tem a extensão) | `200 + depth*10` | Retorna `isOther: true` (roteia para subpasta `OTHERS/`). |

---

## 4. Persistência e Guardas (`client/PresetManager.js`)

- **Cache em Memória:** `getPresetsFolderPath()` é memoizado; `listPresets()` e `loadPreset()` usam cache invalidado por `invalidatePresetCache()` ao salvar/excluir/importar e no evento `com.tidyflow.presetsUpdated`.
- **Proteção contra Preset Fantasma:** Se `fs.writeFileSync` falhar, `savePreset()` **aborta antes** de gravar no `localStorage` ou trocar o preset ativo, preenchendo `lastSaveError`.
- **Overrides do `Default Clean`:** Como a árvore de fábrica é imutável, `savePreset()` grava em `localStorage["ae_organizer_default_settings"]` os toggles globais + `nodeGroupBySourceFolder`. Se o usuário alterar a estrutura da árvore do Default e clicar em Salvar, `buildTreeSignature` detecta a divergência e emite `lastSaveWarning` (mantendo `isDirty`).
- **Sobrescrita Protegida:** `importPresetFromJsonString(json, { overwrite })` lança erro com `code: "PRESET_EXISTS"` quando `overwrite !== true` e o nome já existe; o editor pede confirmação antes de repetir com `{ overwrite: true }`.

---

## 5. Triagem de Áudio por Papel/ESP no Premiere Pro (`host/ppro_organizer.jsx`)

Quando `settings.separateAudioCategories !== false`, áudios classificados em um nó do tipo `Audios` recebem subpasta de papel antes da subpasta de extensão (`01_Dialogue`, `02_Music`, `03_SFX`, `04_Ambience`, `05_Others`):

1. **Cascata de Detecção (`classifyAudioRole` L673):**
   - **Prio 1 — Timeline & Essential Sound (`buildTimelineAudioMap` L550):** Inspeciona componentes/efeitos na timeline (`ADBE Sweetening`, `Enhance Speech`, `De-noise` → `Dialogue`; `Ducking` → `Music`; `Studio Reverb`/`Creative` → `SFX`) e nomes de trilha (`DX`/`Dialogue`, `MX`/`Music`, `SFX`, `Ambience`).
   - **Prio 2 — Metadados XMP e Projeto (`extractXmpFieldValues` L427):** Extrai apenas tags preenchidas (`dc:description`, `dc:subject`, `xmpDM:genre`, `xmpDM:tempo`), ignorando tags XML vazias do esquema do Premiere.
   - **Prio 3 — Nome Próprio do Arquivo + Stems Irmãos:** Avalia palavras-chave no nome do arquivo antes de pastas genéricas (ex.: `Wet City - Night Ambience.wav` dentro de `Sound Effects` vai para `Ambience`; sufixos `- Instrumental` / `- No Lead Vocals` classificam como `Music`).
   - **Prio 4 — Pastas Ancestrais (até 3 níveis) e Bin Original:** Avalia os diretórios no disco e o bin pai.
   - **Fallback:** `"Others"`.
2. **Isolamento de Candidatos:** O papel detectado **nunca** é injetado em `nameCandidates` (para não acionar indevidamente um `nameFilter` de outro nó).
3. **Diagnóstico Visível (`buildAudioSummary` em `client/main.js` L466):** O host retorna `audioTotal`, `audioRoles`, `audioNoMatch`, `emptyLeftovers` e `debugTrace`, exibindo aviso âmbar se houver áudios sem destino ou ESP desligado.

