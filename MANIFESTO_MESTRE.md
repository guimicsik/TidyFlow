# PROJECT ORGANIZER (After Effects & Premiere Pro)
## Master Blueprint & Arquitetura Técnica Unificada

---

## 1. Visão Geral do Projeto
O **Project Organizer** é uma extensão Adobe CEP (*Common Extensibility Platform*) desenvolvida para automatizar a triagem, hierarquização e organização do painel de projetos da Creative Cloud.

O sistema resolve a desorganização em projetos de qualquer complexidade:
- Agrupa mídias por extensão, formato e categoria (vídeo, áudio, imagens estáticas, sequências de render).
- Rastreia dependências entre composições/sequências principais e sub-elementos (pré-composições no AE ou sequências aninhadas no Premiere).
- Preserva contêineres nativos de camadas (como importações de PSD e AI).
- Possui um motor dinâmico baseado em **Presets JSON** com um **Editor Visual Flutuante (*Preset Builder*)**.
- Suporta rótulos de cores nativos (*Color Labels*), prefixação ordinal inteligente e criação de árvore de pastas limpa (*scaffolding*).

---

## 2. Pilares de Funcionalidade

### 2.1 Presets e Editor Visual (*Preset Builder*)
- **Preset Padrão (*Default Clean*):** Arquivo base embutido, protegido contra deleção acidental, com opção de restauração instantânea.
- **Perfis Personalizados:** Permite criar taxonomias para fluxos específicos (ex: *Motion Graphics*, *VFX Pipeline*, *Social Media*, *Edição Bruta de TV*).
- **Editor Modeless (Janela Flutuante):** `tree_editor.html` permite gerenciar nós de pastas:
  - Adicionar pastas no nível raiz e subpastas aninhadas em qualquer profundidade.
  - Seleção visual imediata de **Color Labels** (0 a 16).
  - Modal de configuração de filtros: tipos aceitos (`MainComp`, `PreComps`, `StillImages`, `Videos`, `Audios`, `Solids`, `ImageSequences`, `DataFiles`), tags de extensão (`.mp4`, `.exr`, `.wav`, etc.), agrupamento automático em subpastas maiúsculas (`groupSubfoldersByExt`) e tratamento de pacotes PSD/AI.
- **Persistência Híbrida:** Salva as configurações via Node.js `fs` no diretório de usuário da máquina, mantendo fallback resiliente via `localStorage`.

### 2.2 Modos de Execução do Painel
1. **Organize Project (`btnOrganize`):** Realiza a organização completa de comps/sequências, pré-comps/aninhamentos, footages, áudios, imagens, sólidos e contêineres PSD/AI.
2. **Create Structure (`btnCreateStructure`):** Cria fisicamente no painel do projeto a estrutura vazia de pastas/bins com seus respectivos Color Labels sem mover ou alterar nenhum asset existente.
3. **Media Only (`btnMediaOnly`):** Move exclusivamente arquivos de footage, áudio, imagens e sólidos para suas respectivas pastas, deixando composições e sequências intactas onde o usuário as posicionou.
4. **Verificar Comps / Limpeza (`btnCheckComps`):** Identifica e isola em pasta dedicada (`Nunca Usadas`) itens vazios ou composições que não estão vinculadas nem ativas no fluxo de entrega.

### 2.3 Opções Rápidas (Toggles de Pipeline)
- `usePrefixNumbering`: Prefixa automaticamente pastas no nível ativo com `01_`, `02_`, `03_...`.
- `deleteEmptyFolders`: Remove recursivamente pastas e bins que restarem vazios ao fim da triagem.
- `saveProjectBefore`: Salva o projeto antes de iniciar qualquer modificação.
- `reduceProject`: Executa redução de projeto nas comps selecionadas antes da triagem (quando suportado).

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
   │   │   └── 📁 [Pasta Nativa do PSD]/
   │   │       ├── 📁 01_PreComps/ (grupos com comps)
   │   │       └── [Camadas e arquivos .psd]
   │   ├── 📁 AI/
   │   ├── 📁 PNG/
   │   ├── 📁 JPG/
   │   └── 📁 [Outras extensões de imagem: EXR, TIFF, SVG, etc.]/
   │
   ├── 📁 03_Footages/
   │   ├── 📁 MP4/
   │   ├── 📁 MOV/
   │   ├── 📁 PRORES/
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
   └── [Composições vazias ou desvinculadas]
```

---

## 4. Estrutura do Código e Arquitetura do Sistema

```
AE_File_Organizer/
├── .debug                  # Portas de depuração remota do Chromium (AE e PPro)
├── package.json            # Configurações do projeto e scripts de build Vite
├── vite.config.js          # Configuração do Vite para desenvolvimento
├── CSXS/
│   ├── manifest.xml        # Manifesto mestre de registro CEP (AEFT + PPRO)
│   └── manifest.dev.xml    # Manifesto de teste com live-server
├── client/
│   ├── CSInterface.js      # Biblioteca ponte de comunicação CEP <-> Host
│   ├── index.html          # Interface do Painel Principal
│   ├── main.js             # Lógica e controladores do Painel Principal
│   ├── tree_editor.html    # Interface do Editor de Presets (Janela Modeless)
│   ├── tree_editor.js      # Lógica da árvore de pastas e regras de filtros
│   ├── PresetManager.js    # Gerenciador de leitura, escrita e schema de presets
│   └── presets/
│       └── default_preset.json # Preset padrão de fábrica
└── host/
    ├── bridge.jsx          # Roteador unificado de Host (detecta AEFT vs PPRO)
    ├── aeft_organizer.jsx  # Motor específico do After Effects (CompItem, FolderItem)
    └── ppro_organizer.jsx  # Motor específico do Premiere Pro (ProjectItem, Bin, Sequence)
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

---

## 6. Estratégia de Portabilidade & Código Único (After Effects + Premiere Pro)

Para manter **1 único codebase** onde qualquer atualização de UI, regras ou presets funcione simultaneamente nos dois programas sem retrabalho:

### 6.1 Unificação no `CSXS/manifest.xml`
O CEP suporta múltiplos hosts sob a mesma extensão. Adicionamos o Premiere (`PPRO`) ao lado do After Effects (`AEFT`):
```xml
<HostList>
  <Host Name="AEFT" Version="[16.0,99.9]" />
  <Host Name="PPRO" Version="[13.0,99.9]" />
</HostList>
```

### 6.2 Frontend 100% Compartilhado (Client-Side)
- O HTML, CSS, `tree_editor.html`, `PresetManager.js` e a lógica de eventos são idênticos.
- O painel consulta o ID do host via `csInterface.getHostEnvironment().appId`:
  - Se for `"AEFT"`, exibe termos como *"Composições"* e labels do After Effects.
  - Se for `"PPRO"`, exibe termos como *"Sequências"* e mapeia os color labels do Premiere.

### 6.3 Camada de Abstração ExtendScript (Host-Side)
O frontend sempre chama a mesma função abstrata:
```javascript
csInterface.evalScript("$.global.organizerRouter.organizeProject('" + mainItemId + "', '" + presetJson + "')");
```
No arquivo `host/bridge.jsx`:
```javascript
$.global.organizerRouter = {
    isAE: function() { return (typeof app.project.items !== "undefined"); },
    isPPro: function() { return (typeof app.project.rootItem !== "undefined"); },

    organizeProject: function(mainItemId, presetJson) {
        if (this.isAE()) {
            return $.global.aeft_organizeWithPreset(mainItemId, presetJson);
        } else {
            return $.global.ppro_organizeWithPreset(mainItemId, presetJson);
        }
    }
};
```

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

