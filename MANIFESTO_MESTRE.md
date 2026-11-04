# TIDYFLOW (After Effects & Premiere Pro)
## Master Blueprint & Arquitetura Técnica Unificada

---

## 1. Visão Geral do Projeto
O **TidyFlow** é uma extensão Adobe CEP (*Common Extensibility Platform*) desenvolvida para automatizar a triagem, hierarquização e organização do painel de projetos da Creative Cloud.

O sistema resolve a desorganização em projetos de qualquer complexidade:
- Agrupa mídias por extensão, formato e categoria (vídeo, áudio, imagens estáticas, sequências de render).
- Rastreia dependências entre composições/sequências principais e sub-elementos (pré-composições no AE ou sequências aninhadas no Premiere).
- Preserva contêineres nativos de camadas (como importações de PSD e AI).
- Possui um motor dinâmico baseado em **Presets JSON** com um **Editor Visual Flutuante (*Preset Builder*)**.
- Suporta rótulos de cores nativos (*Color Labels*), prefixação ordinal inteligente e criação de árvore de pastas limpa (*scaffolding*).
- Oferece **Snapshot & Rollback**: qualquer organização pode ser revertida ao estado exato anterior (pastas recriadas, itens devolvidos ao pai original, labels restaurados).
- Interface desktop redesenhada no **Figma** com design system dedicado (`index.css` / `tree_editor.css`), painel compacto de 360×440 px e janela modeless para o editor de presets.
- Identidade unificada sob a marca **TidyFlow** (`com.tidyflow` / `com.tidyflow.editor`), com compartilhamento total de UI e presets entre After Effects e Premiere Pro.

---

## 2. Pilares de Funcionalidade

### 2.1 Presets e Editor Visual (*Preset Builder*)
- **Preset Padrão (*Default Clean*):** Arquivo base embutido (`client/presets/default_preset.json`), protegido contra deleção acidental (`isBuiltIn` bloqueia Excluir/sobrescrita), com **Reset Default** para restauração instantânea.
- **Perfis Personalizados:** Permite criar taxonomias para fluxos específicos (ex: *Motion Graphics*, *VFX Pipeline*, *Social Media*, *Edição Bruta de TV*) via **Salvar Novo** ou **Importar Preset**.
- **Editor Modeless (Janela Flutuante):** `tree_editor.html` é aberto em janela separada (740×640) por `requestOpenExtension("com.tidyflow.editor")`, com fallback para `window.open("tree_editor.html")` e, por último, para a URL `file:///` absoluta da extensão. Recursos atuais:
  - **Árvore visual arrastável (drag & drop):** o handle de cada pasta move o nó com zonas de drop de *25% superior = antes*, *50% central = dentro da pasta* e *25% inferior = depois*, com bloqueio de mover uma pasta para dentro de si mesma (`isDescendantOf`).
  - Criar pastas no nível raiz (`+ Add Top Folder`) e subpastas aninhadas em qualquer profundidade; renomear, excluir (modal de confirmação) e colapsar/expandir nós.
  - **Popover de Color Labels:** o swatch abre um popover ancorado com os **17 slots (0 a 16)**, traduzidos por host (`AE_LABELS` vs `PPRO_LABELS_BY_SLOT`).
  - **Modal de Regras e Filtros em 4 seções:**
    1. **Tipos Permitidos:** `MainComp`, `PreComps`, `StillImages`, `Videos`, `ImageSequences`, `Audios`, `Solids`, `DataFiles` (rótulos e tooltips trocados automaticamente para *Sequências* no Premiere).
    2. **Subpastas e Comportamento:** `groupSubfoldersByExt` (*Subpastas por Extensão*), `groupBySourceFolder` (*Pasta de Origem*), `groupByMainComp` (*Agrupar por Comp/Seq Principal*), `handlePsdBundles` (*Isolar PSD/AI*) e `catchOthers` (*Pasta OTHERS – Fallback*).
    3. **Pacotes de Extensão:** botões de pacote (Imagens, Vídeos, Áudios, Dados/3D) que marcam vários formatos de uma vez, mais campo livre `[+] Adicionar` e chips removíveis com `×`.
    4. **Filtro por Nomenclatura:** tags de palavras separadas por `,` ou `;`, gravadas em `rules.nameFilter` (modo `contains`, case-insensitive). Qualquer item cujo nome contenha uma das palavras é enviado direto para aquela pasta.
  - **Barra superior de ações:** `Salvar`, `Salvar Novo` (modal de nome que clona o preset atual), `Reset Default`, `Importar Preset` / `Exportar Preset` (via `cep.fs.showOpenDialogEx` / `showSaveDialogEx`, com fallback por `FileReader` e download), `Abrir Pasta Local` (abre a pasta de presets no Explorer/Finder) e `Excluir` (indisponível em presets de fábrica).
  - **Badges de estado:** `Padrão de Fábrica` e `Não salvo*` (dirty flag recalculada a cada edição).
  - **Rodapé:** `Salvar e Organizar Agora` (`btnRunNow`), que salva o preset e dispara a organização sem fechar o editor, e `Fechar`.
- **Persistência Híbrida:** grava via Node.js `fs` em `%APPDATA%/TidyFlow/presets`, com **migração única** de `%APPDATA%/AE_Organizer/presets` (flag `ae_organizer_presets_migrated`) e fallback resiliente via `localStorage` quando `fs`/`path` não estão disponíveis. A exclusão limpa o arquivo nas **duas** pastas (nova e legada), evitando que presets removidos ressuscitem na migração.
  - **Cache em memória (Fase 1):** `getPresetsFolderPath()` é memoizado e `listPresets()`/`loadPreset()` mantêm cache invalidado por `invalidatePresetCache()` em salvar/excluir/importar e no evento `com.tidyflow.presetsUpdated` — antes, cada evento `focus` disparava `readdirSync` + leitura de todos os JSONs.
- **Sincronização com o Painel Principal:** `notifyPresetsUpdated()` avisa via `window.opener`/`window.parent` (`onPresetBuilderUpdated`) **e** dispara o CSEvent `com.tidyflow.presetsUpdated`; o painel escuta o evento, o `focus` da janela e re-sincroniza preset ativo + toggles.

### 2.2 Modos de Execução do Painel
1. **Organize Project (`btnOrganize`):** chama `$.global.organizeWithPreset("selection", preset)` — organiza comps/sequências, pré-comps/aninhamentos, footages, áudios, imagens, sólidos e contêineres PSD/AI.
2. **Create Structure (`btnCreateStructure`):** chama `$.global.createPresetFolderStructure(preset)` — cria fisicamente no painel a estrutura vazia de pastas/bins com seus respectivos Color Labels, sem mover ou alterar nenhum asset existente.
3. **Media Only (`btnMediaOnly`):** chama `$.global.organizeWithPreset("media_only", preset)` — move exclusivamente footage, áudio, imagens e sólidos, mantendo composições/sequências onde o usuário as posicionou. Ainda aplica classificação por regras, *Pasta de Origem*, *OTHERS* e Color Labels.
4. **Verificar Comps / Limpeza (`btnCheckComps`):** chama `$.global.checkUnusedComps(preset)` — identifica e isola em pasta dedicada (`Nunca Usadas`, nome configurável) itens vazios e comps/sequências que não estão vinculadas nem ativas no fluxo de entrega.
5. **Rollback (`btnRollback`):** abre o modal de confirmação e chama `$.global.rollbackProject(saveBefore, snapshotJson)` — devolve o projeto ao estado anterior à última organização (detalhado em **2.4**).

Todas as chamadas retornam um JSON padronizado (`success`, `movedComps`, `movedFootages`, `cleanedFolders`, `reducedCount`, `projectSaved`, `error`), usado pelo painel para montar a mensagem de status e, em caso de sucesso, para sincronizar o snapshot de rollback.

### 2.3 Opções Rápidas (Toggles de Pipeline)
- `usePrefixNumbering`: prefixa pastas com `01_`, `02_`, `03_...` **apenas nas pastas que realmente contiverem itens** (categorias vazias são puladas). Cada nó pode sair da numeração com `useNumbering: false`. O prefixo antigo é removido antes de renumerar (`stripNumericPrefix`), evitando acúmulo de `01_01_` em reexecuções.
- `deleteEmptyFolders`: remove recursivamente pastas/bins que restarem vazios ao fim da triagem (`cleanEmptyFolders` no AE, `cleanEmptyBinsBottomUp` no Premiere), ignorando pastas protegidas do sistema.
- `saveProjectBefore`: salva o projeto antes de iniciar qualquer modificação (é forçado quando `reduceProject` está ativo).
- `reduceProject`: reduz o projeto às dependências da comp/sequência selecionada antes da triagem (no Premiere usa um bin temporário `__ORGANIZER_REDUCE_TMP__` como lixeira); exibe banner de aviso no painel enquanto estiver ligado.
- `groupBySourceFolder`: cria uma subpasta com o nome da pasta em que o arquivo reside em disco (ex: `02_Assets > 03_Footages > MP4 > Teste > Teste.mp4`). Ativo por padrão **por pasta** (`rules.groupBySourceFolder`, com fallback global em `settings.groupBySourceFolder`) e sincronizado entre After Effects e Premiere Pro.
  - O toggle do painel grava `settings.groupBySourceFolder` **e propaga o valor para todos os nós** da árvore.
  - Se apenas algumas pastas desativarem a opção, o tile entra em estado **parcial** (classe `.partial` + `#groupSourceNote`) listando as pastas divergentes.
- **Persistência dos toggles:** gravados no preset ativo via `presetManager.savePreset()` e espelhados em `localStorage` (`ae_organizer_save_project`, `ae_organizer_reduce_project`, `ae_organizer_delete_empty`), garantindo que o painel reabra no último estado usado.

### 2.4 Snapshot & Rollback (Desfazer Organização)
Sistema que devolve o projeto ao estado exato anterior à organização, em ambos os hosts.

**Camada de host:**

| Função | Papel |
| :--- | :--- |
| `aeft_captureRawSnapshot()` / `ppro_captureRawSnapshot()` | Varre o projeto e registra, por item, `id`/`nodeId`, `name`, pasta/bin pai, `label`, `comment` e a profundidade das pastas/bins |
| `aeft_ensurePreOrganizeSnapshot()` / `ppro_ensurePreOrganizeSnapshot()` | Captura o snapshot **antes** de organizar. Só recaptura quando o projeto realmente mudou (compara `projectFile` + IDs de pastas criadas e pais dos itens), preservando o estado original em reexecuções |
| `aeft_markPostOrganizeState()` / `ppro_markPostOrganizeState()` | Marca, após a organização, quais pastas/bins foram criados e qual o pai final de cada item |
| `aeft_getRollbackSnapshotJson()` / `ppro_getRollbackSnapshotJson()` | Serializa o snapshot em JSON para o frontend |
| `aeft_rollbackProject()` / `ppro_rollbackProject()` | Restaura o `parentFolder` (AE) ou executa `moveBin` (Premiere), recria pastas removidas com nome + label, remove pastas/bins que não pertencem ao snapshot e, opcionalmente, salva o projeto |

**Fluxo no painel:**
1. Toda operação bem-sucedida (Organizar, Criar estrutura, Apenas Mídias, Verificar comps) chama `syncRollbackSnapshotToLocalStorage()`, espelhando o resultado de `$.global.getRollbackSnapshotJson()` em `localStorage["ae_organizer_rollback_snapshot"]` — o snapshot sobrevive a reload do painel.
2. Clicar em **Rollback** abre `#rollbackModalBackdrop` com **Salvar e Continuar**, **Continuar sem Salvar** e **Cancelar** (Esc e clique no backdrop fecham).
3. Ao concluir, o painel exibe `Itens restaurados`, `Pastas recriadas`, `Pastas removidas` e `Projeto salvo`, e limpa o snapshot do `localStorage`.
4. O roteador expõe `$.global.rollbackProject` e `$.global.getRollbackSnapshotJson` (também em `organizerRouter`), mantendo o frontend 100% agnóstico de host.

---

## 3. Taxonomia Padrão de Pastas (*Default Clean*)

```text
📁 01_Output/
   └── [Composição Principal ou Sequência Final]

📁 02_Assets/
   ├── 📁 01_PreComps/ (ou 01_Sequences no Premiere)
   │   ├── 📁 [Nome da Comp/Seq Principal]/
   │   │   └── [Pré-comps ou sequências aninhadas recursivas]
   │   └── 📁 Geral/
   │       └── [Outras comps/sequências avulsas]
   │
   ├── 📁 02_Images/
   │   ├── 📁 PSD/
   │   │   └── 📁 [Pasta de Origem no disco]/
   │   │       └── 📁 [Pasta Nativa do PSD]/
   │   │           ├── 📁 01_PreComps/ (grupos com comps)
   │   │           └── [Camadas e arquivos .psd]
   │   ├── 📁 AI/
   │   ├── 📁 PNG/
   │   │   └── 📁 [Pasta de Origem]/          ← groupBySourceFolder
   │   ├── 📁 JPG/
   │   ├── 📁 OTHERS/                         ← catchOthers (fallback)
   │   └── 📁 [Outras extensões de imagem: EXR, TIFF, SVG, etc.]/
   │
   ├── 📁 03_Footages/
   │   ├── 📁 MP4/
   │   │   └── 📁 [Pasta de Origem]/
   │   ├── 📁 MOV/
   │   ├── 📁 PRORES/
   │   ├── 📁 OTHERS/
   │   └── 📁 [Outras extensões de vídeo, sequências e dados: MXF, R3D, C4D, JSON]/
   │
   ├── 📁 04_Audios/
   │   ├── 📁 WAV/
   │   ├── 📁 MP3/
   │   └── 📁 [Outras extensões de áudio: AAC, AIFF, M4A]/
   │
   └── 📁 05_Solids/
       └── [Sólidos nativos do host]

📁 Nunca Usadas/
   └── [Composições/sequências vazias ou desvinculadas]
```

**Regras da taxonomia:**
- Os prefixos `01_`, `02_`... só aparecem em pastas **que receberam itens** — categorias vazias não entram na contagem.
- A subpasta `[Pasta de Origem]` só existe quando a regra daquela pasta tem `groupBySourceFolder` ativo.
- A subpasta `OTHERS` só existe quando a regra daquela pasta tem `catchOthers` ativo; ela recebe itens da categoria que não tiveram extensão mapeada.
- Contêineres PSD/AI mantêm a pasta nativa do arquivo intacta (`handlePsdBundles`), com `01_PreComps` interna quando o pacote contém composições.
- O nome da pasta de itens não usados vem de `settings.unusedFolderName` (padrão `Nunca Usadas`).

---

## 4. Estrutura do Código e Arquitetura do Sistema

```
AE_File_Organizer/
├── .debug                  # Portas de depuração remota do Chromium (IDs com.tidyflow / com.tidyflow.editor)
├── package.json            # Configurações do projeto e scripts de build Vite (name: tidyflow)
├── vite.config.js          # Configuração do Vite para desenvolvimento
├── MANIFESTO_MESTRE.md     # Este blueprint
├── CSXS/
│   ├── manifest.xml        # Manifesto mestre de registro CEP (AEFT + PPRO), painel fixo 360×440
│   └── manifest.dev.xml    # Manifesto de teste com live-server
├── client/
│   ├── CSInterface.js      # Biblioteca ponte de comunicação CEP <-> Host
│   ├── OrgLog.js           # Logger leve (níveis, ring buffer, dump) usado pelo painel e pelo editor
│   ├── index.html          # Interface do Painel Principal (estrutura semântica)
│   ├── index.css           # Design system do painel (Figma: dark UI, tiles, toggles, modais)
│   ├── main.js             # Controladores do painel: modos, toggles, presets e rollback
│   ├── tree_editor.html    # Interface do Preset Builder (Janela Modeless)
│   ├── tree_editor.css     # Design system do Preset Builder (árvore, modais, popovers)
│   ├── tree_editor.js      # Árvore drag & drop, regras, import/export e persistência
│   ├── PresetManager.js    # Leitura/escrita de presets, schema, labels e extensões por host
│   └── presets/
│       └── default_preset.json # Preset padrão de fábrica (After Effects)
├── host/
│   ├── _lib.jsx            # Biblioteca compartilhada (helpers puros: escape/parse/ext/labels)
│   ├── _rules.jsx          # Motor de regras compartilhado (classificação por pontuação + cache)
│   ├── organizer.jsx       # Roteador unificado de Host (detecta AEFT vs PPRO, carrega libs)
│   ├── aeft_organizer.jsx  # Motor do After Effects (CompItem/FolderItem) + snapshot/rollback
│   ├── ppro_organizer.jsx  # Motor do Premiere Pro 22.x+ (ProjectItem/Bin/Sequence) + snapshot/rollback
│   └── legacy/
│       └── aeft_legacy.jsx # Motor AE antigo (pre-presets), carregado sob demanda pelo roteador
├── design/
│   ├── ae_organizer_full_ui.svg      # Mockup consolidado da interface
│   ├── ae_organizer_ui_tracking.csv  # Rastreio de elementos de UI
│   └── figma_exports/                # Exportações do Figma
│       ├── main_panel.svg            # Painel principal (layout atual)
│       ├── main_panel_old.svg        # Painel principal (layout anterior)
│       ├── modal_rules.svg           # Modal de Regras e Filtros
│       └── preset_builder.svg        # Preset Builder / árvore de pastas
├── scripts/
│   ├── setup_dev.ps1               # Setup do ambiente de desenvolvimento (symlink CEP)
│   ├── install_symlink.bat         # Instalação do symlink da extensão
│   ├── rollback_ponto_retorno.bat  # Restaura o código para a tag ponto-de-retorno-ae-v1.0
│   └── tests/                      # Suíte de testes sem dependências (npm test)
│       ├── run_all.js              # Runner das 5 suítes
│       ├── lib_test.js             # Testes unitários de host/_lib.jsx
│       ├── orglog_test.js          # Níveis, dump e persistência do OrgLog
│       ├── preset_manager_test.js  # Cache/memoização + falha de escrita do PresetManager
│       ├── ae_engine_test.js       # Motor AE com projeto simulado (+ modo scale)
│       └── ppro_engine_test.js     # Motor PPro (bins, moveBin, sequências, rollback)
└── dist/                   # Build de produção gerado pelo Vite (não versionado)
```

---

## 5. Esquema de Dados do Preset (`schema_preset.json`)

```json
{
  "presetName": "Default Clean",
  "isBuiltIn": true,
  "version": "1.0",
  "settings": {
    "usePrefixNumbering": true,
    "deleteEmptyFolders": true,
    "saveProjectBefore": true,
    "reduceProject": false,
    "groupBySourceFolder": true,
    "unusedFolderName": "Nunca Usadas"
  },
  "tree": [
    {
      "id": "node_output",
      "name": "Output",
      "label": 9,
      "rules": {
        "types": ["MainComp"],
        "extensions": [],
        "groupByMainComp": false,
        "handlePsdBundles": false,
        "groupSubfoldersByExt": false,
        "groupBySourceFolder": true,
        "catchOthers": false,
        "nameFilter": "",
        "nameFilterMode": "contains"
      },
      "children": []
    },
    {
      "id": "node_assets",
      "name": "Assets",
      "label": 0,
      "rules": {
        "types": [],
        "extensions": [],
        "groupByMainComp": false,
        "handlePsdBundles": false,
        "groupSubfoldersByExt": false,
        "groupBySourceFolder": true,
        "catchOthers": false,
        "nameFilter": "",
        "nameFilterMode": "contains"
      },
      "children": [
        {
          "id": "node_precomps",
          "name": "PreComps",
          "label": 5,
          "rules": {
            "types": ["PreComps"],
            "extensions": [],
            "groupByMainComp": true,
            "handlePsdBundles": false,
            "groupSubfoldersByExt": false,
            "groupBySourceFolder": true,
            "catchOthers": false,
            "nameFilter": "",
            "nameFilterMode": "contains"
          },
          "children": []
        },
        {
          "id": "node_images",
          "name": "Images",
          "label": 4,
          "rules": {
            "types": ["StillImages"],
            "extensions": ["psd", "ai", "png", "jpg", "jpeg", "tif", "tiff", "svg", "exr"],
            "groupByMainComp": false,
            "handlePsdBundles": true,
            "groupSubfoldersByExt": true,
            "groupBySourceFolder": true,
            "catchOthers": false,
            "nameFilter": "",
            "nameFilterMode": "contains"
          },
          "children": []
        },
        {
          "id": "node_footages",
          "name": "Footages",
          "label": 6,
          "rules": {
            "types": ["Videos", "ImageSequences"],
            "extensions": ["mp4", "mov", "avi", "mkv", "prores", "mxf", "r3d", "braw"],
            "groupByMainComp": false,
            "handlePsdBundles": false,
            "groupSubfoldersByExt": true,
            "groupBySourceFolder": true,
            "catchOthers": true,
            "nameFilter": "",
            "nameFilterMode": "contains"
          },
          "children": []
        },
        {
          "id": "node_audios",
          "name": "Audios",
          "label": 7,
          "rules": {
            "types": ["Audios"],
            "extensions": ["wav", "mp3", "aac", "aiff", "m4a", "flac"],
            "groupByMainComp": false,
            "handlePsdBundles": false,
            "groupSubfoldersByExt": true,
            "groupBySourceFolder": true,
            "catchOthers": false,
            "nameFilter": "",
            "nameFilterMode": "contains"
          },
          "children": []
        },
        {
          "id": "node_solids",
          "name": "Solids",
          "label": 0,
          "rules": {
            "types": ["Solids"],
            "extensions": [],
            "groupByMainComp": false,
            "handlePsdBundles": false,
            "groupSubfoldersByExt": false,
            "groupBySourceFolder": true,
            "catchOthers": false,
            "nameFilter": "",
            "nameFilterMode": "contains"
          },
          "children": []
        }
      ]
    }
  ]
}
```

### 5.1 Semântica dos Campos

| Campo | Onde | Descrição |
| :--- | :--- | :--- |
| `presetName` | raiz | Nome único do perfil; usado como nome de arquivo (`sanitizeFileName`) e chave em `localStorage` |
| `isBuiltIn` | raiz | `true` apenas no preset de fábrica — bloqueia exclusão e é restaurado por **Reset Default** |
| `version` / `$schema` | raiz | Controle de versão e referência de schema (draft-07) |
| `settings.usePrefixNumbering` | settings | Liga a numeração ordinal `01_`, `02_`... (só em pastas com itens) |
| `settings.deleteEmptyFolders` | settings | Remove pastas/bins vazios ao final |
| `settings.saveProjectBefore` | settings | Salva o projeto antes de modificar |
| `settings.reduceProject` | settings | Executa redução de projeto antes da triagem |
| `settings.groupBySourceFolder` | settings | Valor **global** de fallback para a *Pasta de Origem* |
| `settings.unusedFolderName` | settings | Nome da pasta de itens vazios/desvinculados (padrão `Nunca Usadas`) |
| `tree[].id` | nó | Identificador estável do nó (usado pelo editor e pelo mapeamento `nodeFolderMap`) |
| `tree[].name` | nó | Nome-base da pasta, sem prefixo numérico |
| `tree[].label` | nó | Índice de Color Label **0–16**, convertido por host no momento de aplicar |
| `tree[].useNumbering` | nó | `false` exclui esta pasta da numeração sequencial (padrão `true`) |
| `tree[].children` | nó | Subpastas aninhadas (recursivo, profundidade livre) |
| `rules.types` | nó | Categorias aceitas: `MainComp`, `PreComps`, `StillImages`, `Videos`, `ImageSequences`, `Audios`, `Solids`, `DataFiles` |
| `rules.extensions` | nó | Lista de extensões (sem ponto, minúsculas) aceitas pelo nó |
| `rules.groupSubfoldersByExt` | nó | Cria subpasta em MAIÚSCULAS por extensão (`MP4/`, `PNG/`...) |
| `rules.groupBySourceFolder` | nó | Cria subpasta com o nome da pasta de origem no disco; ausente ⇒ herda `settings` |
| `rules.groupByMainComp` | nó | Agrupa pré-comps/sequências aninhadas pelo nome da comp/seq principal |
| `rules.handlePsdBundles` | nó | Preserva o contêiner nativo de PSD/AI (não espalha camadas) |
| `rules.catchOthers` | nó | Habilita a subpasta `OTHERS` para itens sem extensão mapeada |
| `rules.nameFilter` | nó | Lista de palavras separadas por vírgula; quem contiver qualquer uma vai para o nó |
| `rules.nameFilterMode` | nó | `"contains"` (padrão) ou `"regex"` |

> **Observação:** existe **um único preset de fábrica** (`client/presets/default_preset.json`), compartilhado pelos dois hosts — o mesmo arquivo, a mesma árvore de pastas e as mesmas regras. As diferenças aparecem apenas em **opções resolvidas por host**: `getDefaultExtensions()` devolve `DEFAULT_EXTENSIONS_AE` no After Effects e `DEFAULT_EXTENSIONS_PPRO` no Premiere Pro (ver **6.5**), e os Color Labels são convertidos no momento de aplicar. Um eventual `client/presets/default_preset_ppro.json` é apenas um *override* opcional de bundle, nunca um requisito.

---

## 6. Estratégia de Portabilidade & Código Único (After Effects + Premiere Pro)

**Um único plugin** — um bundle CEP, um painel, um Preset Builder e o mesmo conjunto de presets — atende os dois hosts. O que varia entre After Effects e Premiere Pro são apenas **opções específicas por host** (vocabulário, tabela de labels, dicionário de extensões e recursos suportados), resolvidas em runtime por `PresetManager.isPremierePro()`, sem duplicar telas, arquivos de preset ou motores de UI. Assim, qualquer atualização de UI, regras ou presets chega aos dois programas sem retrabalho:

### 6.1 Unificação no `CSXS/manifest.xml`
O CEP suporta múltiplos hosts sob a mesma extensão. O Premiere Pro 22.x+ (`PPRO`) opera lado a lado com o After Effects (`AEFT`):
```xml
<HostList>
  <Host Name="AEFT" Version="[16.0,99.9]" />
  <Host Name="PPRO" Version="[22.0,99.9]" />
</HostList>
```

### 6.2 Frontend 100% Compartilhado (Client-Side)
- O HTML, o design system (`index.css` / `tree_editor.css`), `tree_editor.html`, `PresetManager.js` e a lógica de eventos são idênticos e compartilham a mesma pasta de presets em disco (`%APPDATA%/TidyFlow/presets`), com migração única de `%APPDATA%/AE_Organizer/presets`.
- O painel consulta o ID do host via `csInterface.getHostEnvironment().appId`:
  - Se for `"AEFT"`, exibe termos como *"Composições"* e os 16 labels do After Effects.
  - Se for `"PPRO"`, exibe termos como *"Sequências"* e mapeia de forma bijetora (1:1) os 16 color labels do Premiere Pro (`0..15`).
- A sincronização entre o Preset Builder e o painel usa três caminhos redundantes: `window.opener.onPresetBuilderUpdated`, `window.parent.onPresetBuilderUpdated` e o CSEvent `com.tidyflow.presetsUpdated`; o painel ainda re-sincroniza no evento `focus`.
- O painel Principal é registrado como `com.tidyflow` e o editor como `com.tidyflow.editor` (janela separada), ambos sob o bundle `com.tidyflow`.

### 6.3 Camada de Abstração ExtendScript (`host/organizer.jsx`)
O frontend sempre chama as mesmas funções globais (`$.global.organizeWithPreset`, `$.global.createPresetFolderStructure`, `$.global.checkUnusedComps`), e o roteador em `host/organizer.jsx` direciona automaticamente para `aeft_organizer.jsx` ou `ppro_organizer.jsx`.

### 6.4 Mapeamento de APIs entre After Effects e Premiere Pro

| Ação | After Effects (`AEFT`) | Premiere Pro (`PPRO`) |
| :--- | :--- | :--- |
| **Pasta Raiz** | `app.project.rootFolder` | `app.project.rootItem` |
| **Criar Pasta / Bin** | `app.project.items.addFolder(name)` | `parentBin.createBin(name)` |
| **Mover Item** | `item.parentFolder = targetFolder;` | `item.moveBin(targetBin);` |
| **Tipo de Item** | `item instanceof CompItem / FolderItem` | `item.type === ProjectItemType.BIN / CLIP` |
| **Sequência / Comp** | `CompItem` | `item.isSequence()` |
| **Cores / Labels** | `item.label = 1..16` | `item.getColorLabel()` / `item.setColorLabel(n)` |
| **Caminho do Arquivo**| `item.file.fsName` | `item.getMediaPath()` |

### 6.5 Dicionários de Extensões e Labels por Host
O `PresetManager` mantém dois dicionários de fábrica **no mesmo plugin** e escolhe pelo host:

| Categoria | `DEFAULT_EXTENSIONS_AE` | `DEFAULT_EXTENSIONS_PPRO` (adicional/diferencial) |
| :--- | :--- | :--- |
| Imagens | psd, ai, png, jpg, tif, exr, svg, raw/CR2... | inclui `jfif`, `ico`, `dng` entre as fotos |
| Vídeos | mp4, mov, mxf, r3d, braw, dnxhd... | inclui `mod`, `tod`, `ari`, `crm` (codecs de câmera) |
| Áudios | wav, mp3, aac, aiff, m4a, flac... | inclui `m2a`, `asnd`, `ac3`, `caf`, `mid/midi` |
| Dados | json, csv, c4d, obj, aep, prproj... | inclui `prel`, `chproj`, `ale` e legendas `mcc`, `dfxp`, `ttml`, `cap`, `sbv` |
| ImageSequences | — (usa a lista de vídeos) | `png`, `exr`, `tga`, `tif`, `jpg`, `dpx`, `cin`, `dng`... |

- `getDefaultExtensions()` devolve o dicionário do host ativo; `PresetManager.DEFAULT_EXTENSIONS_AE` / `_PPRO` ficam expostos para uso externo.
- **Color Labels:** o After Effects usa `AE_LABELS` (slots `1..16`); o Premiere usa o mapa bijetor `PPRO_LABELS_BY_SLOT` (slots `0..16`) e a ordem canônica `PPRO_LABELS_ORDERED`, consumidos por `getLabelsList()` / `getLabelInfo()`. O preset sempre guarda o índice **do host**; a conversão para a API nativa acontece em `applyLabelSafe` / `applyPProLabelSafe`.

### 6.6 Snapshot e Rollback por Host

| Aspecto | After Effects | Premiere Pro |
| :--- | :--- | :--- |
| Identificador do item | `item.id` (numérico) | `item.nodeId` (string) |
| Contêiner | `FolderItem` / `app.project.rootFolder` | `Bin` / `app.project.rootItem` |
| Restaurar posição | `item.parentFolder = folderOriginal` | `item.moveBin(binOriginal)` |
| Recriar pasta | `app.project.items.addFolder(name)` | `parentBin.createBin(name)` |
| Cor da pasta recriada | `folder.label = n` | `bin.setColorLabel(n)` |
| Limpeza de vazios | `cleanEmptyFolders()` | `removeNonSnapshotBinsBottomUp()` / `removeAllEmptyBinsBottomUp()` |
| Fronteira de desfazer | `app.beginUndoGroup()` / `app.endUndoGroup()` | `app.beginUndoGroup()` / `app.endUndoGroup()` |

Ambos expõem o mesmo contrato (`captureRawSnapshot`, `ensurePreOrganizeSnapshot`, `markPostOrganizeState`, `getRollbackSnapshotJson`, `rollbackProject`), com prefixo `aeft_` ou `ppro_`, e são roteados por `host/organizer.jsx`.

### 6.7 Opções Específicas por Host (dentro do mesmo plugin)
O plugin é um só; as diferenças são **opções** ativadas/ajustadas em runtime, não forks de código ou de preset:

| Opção | After Effects (`AEFT`) | Premiere Pro (`PPRO`) |
| :--- | :--- | :--- |
| Vocabulário da UI | *Composições*, *Pré-composições*, *Comp Principal* | *Sequências*, *Sequências Aninhadas*, *Seq. Principal* |
| Tabela de labels | `AE_LABELS` (0–16) | `PPRO_LABELS_BY_SLOT` (mapa bijetor 0–16) / `PPRO_LABELS_ORDERED` |
| Dicionário de extensões | `DEFAULT_EXTENSIONS_AE` | `DEFAULT_EXTENSIONS_PPRO` (codecs de câmera, MOGRT, legendas, `ale`/`prel`) |
| Tipos sintéticos (`Solids` no preset) | Sólidos nativos (`SolidItem`) | Color Matte, Adjustment Layer, Black Video, Bars & Tone, Transparent Video, Titles |
| `reduceProject` | Redução nativa via `reduceProject` | Redução com bin temporário `__ORGANIZER_REDUCE_TMP__` |
| Contêiner de pasta/bin | `FolderItem` + `parentFolder` | `Bin` + `createBin` / `moveBin` |
| Snapshot & Rollback | `aeft_*` | `ppro_*` |
| Botão "Verificar comps" | "Verificar composições" | "Verificar sequências" |

Todos os demais elementos — layout, CSS, árvore de pastas, modal de regras, toggles, presets e fluxo de rollback — são **idênticos** nos dois programas.

---

## 7. Changelog & Estado Atual (03/11/2026)

### 7.1 Entregue nesta data

| Área | Entrega |
| :--- | :--- |
| **Rebranding** | Extensão renomeada para **TidyFlow**: `ExtensionBundleId="com.tidyflow"`, extensões `com.tidyflow` e `com.tidyflow.editor`, menus "TidyFlow" / "TidyFlow - Preset Builder", `.debug` e `package.json` atualizados. **Um único bundle atende AEFT + PPRO** |
| **UI / Figma** | Painel e Preset Builder redesenhados: `index.css` e `tree_editor.css` criados, HTML enxugado, exports em `design/figma_exports/`, painel fixo 360×440 e grade de tiles (hero + 3 ações + 5 toggles) |
| **Rollback** | Snapshot/restore completo nos dois hosts, espelho em `localStorage`, modal de confirmação e novo tile `Rollback` no painel |
| **Pasta de Origem** | `groupBySourceFolder` granular por pasta, propagação pelo toggle global e aviso de estado "parcial" |
| **Preset Builder** | Drag & drop com zonas, popover de labels, modal de regras em 4 seções, filtro por nomenclatura, importar/exportar JSON, abrir pasta local, badges e "Salvar e Organizar Agora" |
| **Numeração** | Prefixos aplicados só em pastas com conteúdo, com remoção de prefixo antigo antes de renumerar |
| **Premiere Pro** | Opções específicas do host no mesmo plugin: `DEFAULT_EXTENSIONS_PPRO`, mapa de labels `PPRO_LABELS_BY_SLOT` e snapshot/rollback próprios |
| **Presets** | Um único conjunto de presets para os dois hosts, em `%APPDATA%/TidyFlow/presets`, com migração única e limpeza nas duas pastas ao excluir |
| **Infra** | `scripts/rollback_ponto_retorno.bat` (tag `ponto-de-retorno-ae-v1.0`), `scripts/setup_dev.ps1`, `scripts/install_symlink.bat` |

### 7.2 Histórico de commits

| Commit | Data/Hora | Descrição |
| :--- | :--- | :--- |
| `5556a74` | 2026-11-03 11:29 | `chore: ponto de retorno antes da adaptacao Premiere Pro` (tag `ponto-de-retorno-ae-v1.0`) |
| `c5b01f7` | 2026-11-03 11:42 | `feat: suporte unificado After Effects e Premiere Pro 22.x+` |
| *working tree* | 2026-11-03 | Rebranding TidyFlow, UI Figma, rollback, pasta de origem granular, import/export de presets |

### 7.3 Pendências conhecidas (dívida técnica)

| # | Pendência | Status |
| :--- | :--- | :--- |
| 1 | Preset único por design (sem `default_preset_ppro.json`) | Decisão de design — não é pendência |
| 2 | `#headerTitle` órfão no `main.js` + títulos "PPro Organizer" | ✅ Resolvido na Fase 1 |
| 3 | `package-lock.json` com `name` divergente do `package.json` | ✅ Resolvido na Fase 1 |
| 4 | `manifest.dev.xml` no bundle antigo (`com.organizer.ae`), 1 extensão, sem `--mixed-context` | ✅ Resolvido na Fase 1 |
| 5 | Painel com geometria travada em 360×440 (`MinSize == MaxSize`) | Decisão de design |
| 6 | `src/config.json` legado, não lido pelo fluxo atual | ✅ Resolvido na Fase 3 (removido) |
| 7 | `dist/` gerado pelo Vite não empacota a extensão (sem `tree_editor.html`, `CSXS/`, `host/`) | Backlog — Fase 4 (decidir CEP estático × build real) |
| 8 | 4 fontes de verdade das extensões (preset, `PresetManager`, `src/config.json`, regex hardcoded no host) | Parcial na Fase 3 (`config.json` removido) — restam preset/`PresetManager`/regex no host |
| 9 | Duplicação entre motores (~67% das linhas repetidas; 13 funções homônimas) | Backlog — Fase 2/3 |
| 10 | Varreduras O(N²) do projeto no host (33 chamadas `app.project.item()` dentro de laços) | Backlog — Fase 2 |
| 11 | 81 `catch` vazios de 114 (71% de falhas silenciosas) | Parcial na Fase 4: caminhos críticos (salvar/excluir preset, resolver pasta, erros do painel) agora logam via `OrgLog` e falha de escrita aparece na UI |

### 7.4 Fase 1 — Otimizações aplicadas (04/11/2026)

| Item | Antes | Depois |
| :--- | :--- | :--- |
| Dead code no painel | `document.getElementById("headerTitle")` (id inexistente após o redesign) e títulos "PPro Organizer" | Removido; títulos agora "TidyFlow — Premiere Pro" e "TidyFlow — Preset Builder (Premiere Pro)" |
| CSS morto | 4 seletores sem uso (`.header-row`, `.header-title`, `.btn-primary*`, `.btn-secondary*`) | Removidos — `index.css` com **0 seletores órfãos** (63 blocos, chaves balanceadas 63/63) |
| Chaves de storage | literais `ae_organizer_*` espalhados em `main.js` e `PresetManager.js` | Centralizadas em `PresetManager.STORAGE_KEYS` (com fallback no painel); **valores preservados** para não perder preferências salvas |
| I/O de presets | `getPresetsFolderPath()` fazia `existsSync`/`mkdirSync` a cada chamada; `listPresets()` lia **todos** os JSONs a cada evento `focus` | Path memoizado; `listPresets()`/`loadPreset()` em cache, invalidado por `invalidatePresetCache()` em salvar/excluir/importar e no evento `com.tidyflow.presetsUpdated` |
| Carregamento de preset | `loadPreset()` relia o diretório inteiro quando o nome do arquivo divergia | Atalho por índice em memória (`_findIndexedPresetFilePath`) — sem `readdir` |
| Manifest de dev | Bundle `com.organizer.ae`, 1 extensão, CEF sem `--mixed-context`/`--allow-file-access-from-files`, largura 260 | Bundle `com.tidyflow`, 2 extensões (painel + editor), parâmetros CEF iguais aos de produção, geometria 360×440 e 740×640 |
| `package-lock.json` | `"name": "ae-file-organizer"` | `"name": "tidyflow"` (raiz e `packages[""]`) |

**Validação da Fase 1:** `node --check` nos 3 scripts do cliente · `manifest.xml`/`manifest.dev.xml` parseados como XML · `package-lock.json` validado pelo Node · `npm run build` com exit 0 · harness Node simulando o ambiente CEP com **14/14 asserções aprovadas** (memoização sem syscall, cache de listagem/objeto, invalidação em salvar/excluir, atalho por índice sem `readdir`, compatibilidade das chaves de storage).

### 7.5 Fase 2 — Instrumentação e ganho de desempenho no host (04/11/2026)

**Instrumentação (base para medir):** `aeft_organizeWithPreset` e `ppro_organizeWithPreset` passaram a devolver dois campos extras no JSON de resposta:

| Campo | Significado |
| :--- | :--- |
| `elapsedMs` | Tempo total da operação (ms) |
| `scanCount` | Nº de iterações em varreduras de projeto/bins nos laços quentes (métrica direta do custo O(N²)) |

**Otimizações aplicadas**

| Item | Antes | Depois |
| :--- | :--- | :--- |
| Classificação de itens (`findMatchingNode`) | Varria todos os nós e todas as extensões **por item** — O(itens × nós × extensões) | Cache por `tipo|extensão` dentro da execução (desativado automaticamente se houver `nameFilter`, pois aí o resultado depende do nome) |
| Busca/criação de pastas no AE | Varredura de `app.project.numItems` **para cada pasta do preset** — O(nós × N) | Índice `{ paiId: { nome: FolderItem } }` construído em **uma única passada**, mantido ao criar pastas e reconstruído só quando algo é removido |
| Segurança do índice | — | Todo lookup valida se a pasta continua viva e no pai esperado; se o índice não puder ser construído, o código **cai na varredura original** (comportamento idêntico ao anterior) |
| Numeração / labels (AE) | Varredura completa do projeto por nó quando a pasta não estava em `nodeFolderMap` | Lookup no índice com fallback linear apenas quando necessário |

**Medições (harness Node simulando o After Effects, `media_only`)**

| Cenário | `scanCount` antes (teórico/medido) | `scanCount` depois | Redução |
| :--- | :--- | :--- | :--- |
| Projeto novo, 4 itens / 5 nós (1ª execução) | 85 (medido no código com fallback linear) | **4** | **−95%** |
| Mesmo projeto, 2ª execução (pastas existentes) | ~85 (mesmo caminho) | **13** | −85% |
| **Escala: 301 itens, 35 pastas, 1ª execução** | ~1.505 (`5 nós × 301 itens`) | **301** (= 1 índice) | **−80%** |
| Escala, 2ª execução | ~3.000 (varreduras + numeração) | **336** (= 1 índice) | −89% |

**Validação da Fase 2:** `node --check` nos 3 scripts do host · harness Node com projeto AE simulado (**FolderItem/CompItem/FootageItem/FileSource reais**, `instanceof` funcional) executando o motor de verdade — **16/16 asserções aprovadas**: árvore final correta (`01_Assets/02_Footages/MP4/PastaA/a.mp4`, `01_Assets/01_Images/PNG/PastaB/b.png`, `01_Assets/03_Audios/WAV/c.wav`), comp preservada na raiz no modo *Apenas Mídias*, `groupBySourceFolder` respeitado por pasta, reexecução **idempotente** (0 movimentos e sem pastas duplicadas) e instrumentação exposta.

### 7.6 Fase 3 — Consolidação de helpers, memoização no Premiere e suíte de testes (04/11/2026)

| Item | Antes | Depois |
| :--- | :--- | :--- |
| Helpers puros duplicados | `escapeJsonString` definido **6× no AE** e 1× no PPro; `parseJson` 3× no AE e 1× no PPro — **11 cópias** | `host/_lib.jsx` expõe `$.global.OrgLib` (9 helpers: escape, parse, arrayContains, arrayContainsIgnoreCase, stripNumericPrefix, trimStr, getFileExtension, getParentFolderNameFromPath, isSameItem). As 11 cópias viraram delegação de 1 linha (`var X = $.global.OrgLib.X;`) |
| Carregamento da lib | Cada motor trazia sua própria cópia | `host/organizer.jsx` carrega `_lib.jsx` **antes** do motor (função `organizerLoadLib`); cada motor tem bootstrap defensivo que resolve `_lib.jsx` pelo próprio diretório (`$.fileName`) |
| Sequências no Premiere | `inspectSequenceTracks()` reexecutava a varredura completa de trilhas/clips a cada chamada (3 fluxos, um deles recursivo); `buildSequenceMap()` era reconstruído até 4× | Cache por `nodeId` durante a operação + mapa de sequências memoizado; `ppro_resetSequenceCache()` limpa no início de cada ação (organizar, criar estrutura, verificar comps) |
| Config legada | `src/config.json` com 58 extensões de footage (divergente das 76 do preset), sem nenhum leitor no código | **Removido** |
| Testes automatizados | Inexistiam | `scripts/tests/` com runner próprio: `npm test` (3 suítes) e `npm run test:scale` (cenário de 301 itens) |

**Validação da Fase 3:** `node --check` nos 4 scripts de host (`_lib.jsx`, `organizer.jsx`, `aeft_organizer.jsx`, `ppro_organizer.jsx`) · **`npm test` → 43 asserções, 0 falhas** (`lib_test` 16/16, `preset_manager_test` 13/13, `ae_engine_test` 14/14) · o harness do AE exercita o **bootstrap real da lib** (o motor carrega `_lib.jsx` sozinho via `$.fileName` + `$.evalFile`), garantindo que a delegação funciona no caminho de produção.

> **Requisito de deploy:** `host/_lib.jsx` precisa acompanhar `organizer.jsx` e os dois motores na mesma pasta — o roteador e os motores resolvem esse caminho relativo.

### 7.7 Harness do Premiere Pro (04/11/2026)

Bancada de teste que executa o **motor PPro real** (`host/ppro_organizer.jsx`) fora do Premiere, contra uma **API dublada** do host. Sem ela, qualquer mudança no motor do Premiere só podia ser validada manualmente.

**O que o dublê implementa** (levantado a partir das chamadas reais do motor):

| Camada | Coberto |
| :--- | :--- |
| `app` | `project.rootItem`, `project.sequences` (+`numSequences`), `project.save()`, `project.path`, `project.documentID`, `getCurrentProjectViewSelection()`/`getProjectViewIDs()`/`getProjectViewSelection()`/`getProjectFromViewID()` |
| Constantes | `ProjectItemType.BIN` / `.ROOT` / `.CLIP` |
| Bin / item | `nodeId`, `name`, `type`, `children` (coleção com `numItems` + indexador), `createBin()`, `moveBin()`, `deleteBin()`, `getColorLabel()`, `setColorLabel()`, `getMediaPath()`, `getProjectMetadata()`, `isSequence()`, `isOffline()`, `isMulticamClip()`, `isMergedClip()` |
| Sequência | `videoTracks` / `audioTracks` / `captionTracks` → `numTracks` → `track.clips` → `clip.projectItem` |

Duas regras do host real foram reproduzidas de propósito, porque são onde bugs aparecem: `moveBin()` **rejeita** mover um bin para dentro de si mesmo e **reordena** `children`.

**Asserções (18):** sucesso da execução · `elapsedMs`/`scanCount` · classificação (`MP4`/`PNG`/`WAV`) · bucket de extensão · agrupamento por pasta de origem (e respeitando `false` por pasta) · **item sintético em `Solids`** · numeração `01_`/`02_` só em bins com conteúdo · **Color Label** aplicado (`getColorLabel() >= 0`) · **idempotência** (2ª execução sem movimentos e sem bins duplicados) · **rollback** (`restoredItems`, `removedFolders`, clipes de volta na raiz e bins criados removidos).

**Resultado:** `ppro_engine_test` **18/18** e suíte completa **61 asserções, 0 falhas** (`npm test`).

> **Limite conhecido:** o harness valida lógica, não o host. Mídia offline real, bins bloqueados, variações entre versões do Premiere e a ponte CEP continuam exigindo o smoke test manual — que já foi executado nesta rodada com resultado OK.

### 7.8 Fase 4 — Observabilidade: `OrgLog` e falhas visíveis (04/11/2026)

**Problema:** 81 dos 114 blocos `catch` do projeto eram vazios (71%). O caso mais grave era `savePreset`: se a escrita em disco falhasse, o painel dizia *"salvo com sucesso"* e o usuário perdia o preset.

| Item | Antes | Depois |
| :--- | :--- | :--- |
| Log | Nenhum. Falhas de escrita, exclusão, leitura e rollback desapareciam | **`client/OrgLog.js`** — níveis (`debug/info/warn/error`), buffer de 200 entradas em memória, persistência das 50 últimas em `localStorage`, `dump()` legível e `count(level)` para diagnóstico |
| Carregamento | — | `OrgLog.js` incluído nos **dois** HTMLs antes de `PresetManager.js` / `main.js` / `tree_editor.js` |
| Painel principal | `setStatus(..., "error")` só pintava o texto na tela | Todo erro exibido vai também para `OrgLog.error("panel", …)` |
| `PresetManager.savePreset` | `catch (e) {}` silencioso | Expõe **`lastSaveError`** e loga `error`; no sucesso, limpa o campo. Se o disco estiver indisponível, loga `warn` explicando que salvou só em `localStorage` |
| Exclusão / resolução da pasta | `catch` vazios | `logWarn` com o motivo (ex.: arquivo não removido) |
| Preset Builder | Dizia "salvo com sucesso" mesmo com falha | `reportSaveError()` é chamado nos **3 fluxos** (Salvar, Salvar Novo, Salvar e Organizar Agora) e **aborta** com mensagem de erro, mantendo o dirty flag |

**Decisão de build (registrada):** `dist/` gerado pelo Vite **não é um pacote CEP** (contém apenas `index.html` + CSS com hash; não copia `CSXS/`, `host/` nem `tree_editor.html`). Decisão: **CEP estático** — `client/` + `host/` + `CSXS/` são a fonte de verdade e o que se instala; o Vite fica restrito ao servidor de desenvolvimento (`localhost:5173`, usado por `manifest.dev.xml`). Não existe empacotador no projeto (ver **7.10**).

**Validação da Fase 4:** `node --check` em `OrgLog.js`, `main.js`, `tree_editor.js` e `PresetManager.js` (4/4) · `npm test` → **72 asserções, 0 falhas** — incluindo `orglog_test` (8) e a nova verificação de `preset_manager_test`: com `writeFileSync` sabotado, `lastSaveError` é preenchido, o `OrgLog` recebe um `error` e, no salvamento seguinte bem-sucedido, `lastSaveError` volta a `null`.

### 7.9 Fase 5 — Cobertura de sequências e motor de regras unificado (04/11/2026)

**7.9.1 Harness de sequências (Premiere)**
Novo `scripts/tests/ppro_sequences_test.js` cobre o modo `selection`: dubla `app.project.sequences` (com `numSequences`) e trilhas (`videoTracks`/`audioTracks`/`captionTracks` → `clips` → `projectItem`). **12 asserções**: sequência principal → `Output`, aninhada → `PreComps/<nome da principal>` (regra `groupByMainComp`), dependências descobertas por trilha (mp4/png/wav), item avulso também classificado, sequências **nunca** tratadas como mídia e reexecução idempotente.

> Durante a construção, o harness apontou um erro no próprio dublê (a coleção expunha `numItems` em vez de `numSequences`) — exatamente o tipo de divergência de API que ele existe para pegar.

**7.9.2 Motor de regras unificado**
`findMatchingNode`, `nodeSupportsType`, `matchesNameFilter` e `isExtInNodesOfType` existiam **duas vezes** (AE e PPro). A comparação automática das duas versões mostrou **0 diferenças semânticas** (apenas `trimStr` vs `replace` e estilo de chaves), então a lógica foi extraída para **`host/_rules.jsx`**:

| Item | Antes | Depois |
| :--- | :--- | :--- |
| Implementações da pontuação | 2 (uma por motor) | **1** (`$.global.OrgRules`) |
| Cache de classificação | duplicado em cada motor | dentro de `OrgRules.createMatcher(nodeRecords)` |
| `nodeSupportsType` / `matchesNameFilter` / `isExtInNodesOfType` | duplicados | únicos, com adapter só de `nodeRecords` |
| Tamanho | AE 2.543 / PPro 1.990 linhas | AE **2.371** / PPro **1.851** (−311) + `_rules.jsx` 197 |
| Carregamento | — | bootstrap dos dois motores e `organizerLoadLib` carregam `_lib.jsx` **e** `_rules.jsx` |
| Cópias locais | 8 definições | **0** (8 pontos de delegação) |

Os pesos da pontuação foram preservados **exatamente** (1000 nome → 850 extensão isolada → 700 tipo+extensão → 500 tipos sem extensão → 400 tipo aberto → 200 `catchOthers`), incluindo o bônus de especificidade e a penalidade por tamanho da lista de extensões.

**Validação da Fase 5:** `node --check` nos 5 scripts de host · **`npm test` → 84 asserções, 0 falhas** (lib 16, orglog 8, preset manager 16, AE 14, PPro 18, PPro sequências 12) · o harness do AE e os dois do PPro exercitam o motor de regras real, então a unificação foi validada por comportamento, não por inspeção.

### 7.10 Empacotamento — removido durante o desenvolvimento (04/11/2026)

O empacotador (`scripts/package.js` + `npm run package`) chegou a ser criado e foi **removido**: o projeto está em desenvolvimento ativo e o artefato de distribuição não é necessário agora. A decisão de build de **7.8** continua valendo (CEP estático; Vite apenas como dev server). Quando for distribuir, o empacotador pode ser recriado — a implementação permanece no histórico do git.

### 7.11 Fase 6 — Consolidação final de helpers, labels e motor legado (04/11/2026)

| Item | Antes | Depois |
| :--- | :--- | :--- |
| Helpers puros nos motores | 14 cópias restantes (`arrayContains`, `arrayContainsIgnoreCase`, `stripNumericPrefix`, `getFileExtension`, `isSameFolder`, `trimStr`) | **0 cópias** — todas delegam para `$.global.OrgLib` |
| `applyLabelSafe` (AE) / `applyPProLabelSafe` | escreviam a cor **sempre** (entrada de undo + chamada IPC por pasta) | comparam antes (`folder.label !== num` / `getColorLabel() !== cor`) |
| `moveItemSafe` (Premiere) | `moveBin` sem proteção: um item bloqueado abortava a organização inteira | `try/catch` por item + `OrgLib.warn` — o item é pulado e o resto continua |
| Logging no host | inexistente | `OrgLib.log/warn/error` com hook `$.global.OrgLogHook` (o painel/debugger pode registrar um coletor) |
| Motor legado do AE | `aeft_organizeAEProject` (~758 linhas) era **avaliado a cada reload** dentro de `aeft_organizer.jsx` | movido para **`host/legacy/aeft_legacy.jsx`** e carregado **sob demanda** (`organizerLoadLegacyAE`), acionado só se um preset sem `tree` chegar |

**Números finais do host:** `aeft_organizer.jsx` **2.582 → 1.823 linhas** (−29%), `ppro_organizer.jsx` 1.851, `_rules.jsx` 197, `_lib.jsx` 99, `organizer.jsx` ~200.

**Validação da Fase 6:** `node --check` em `aeft_organizer.jsx`, `aeft_legacy.jsx` e `organizer.jsx` · **`npm test` → 87 asserções, 0 falhas** — incluindo 3 novas no harness do AE: o arquivo legado existe, **carrega sob demanda** e não afeta o motor atual.










