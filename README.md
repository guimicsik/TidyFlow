<div align="center">

# TidyFlow

**Organização inteligente, Rollback seguro, Collect Files fiel à hierarquia e Design Studio visual para Adobe After Effects & Premiere Pro.**

![After Effects](https://img.shields.io/badge/After%20Effects-16.0%2B-9999FF?style=for-the-badge&logo=adobeaftereffects&logoColor=white)
![Premiere Pro](https://img.shields.io/badge/Premiere%20Pro-22.0%2B-9999FF?style=for-the-badge&logo=adobepremierepro&logoColor=white)
![Adobe CEP](https://img.shields.io/badge/Adobe%20CEP-9.0%2B-3B82F6?style=for-the-badge)
![ExtendScript](https://img.shields.io/badge/Host-ExtendScript%20ES3-171717?style=for-the-badge)
![Tests](https://img.shields.io/badge/Testes-117%20passing-10B981?style=for-the-badge)

<br />

[Recursos](#-recursos-principais) •
[Instalação](#-instalação-rápida-windows) •
[Como Funciona](#-como-funciona) •
[Collect Files](#-collect-files-ae--premiere-pro) •
[Design Studio](#-tidyflow-design-studio-editor-visual) •
[Integração](#-integração-em-outras-ferramentas) •
[Documentação](#-estrutura-e-documentação)

</div>

---

## ✨ Recursos Principais

Um único bundle CEP (`com.tidyflow`) que detecta automaticamente o host (**After Effects** ou **Premiere Pro**) e adapta interface, dicionários de extensões, Color Labels e motor de execução:

- **🗂️ Organizador por Presets & Regras:** classifica composições/sequências, pré-comps, imagens, vídeos, sequências de imagem, áudios, dados/3D e sólidos usando um motor determinístico de pontuação (`host/_rules.jsx`).
- **🔢 Numeração Sequencial Inteligente:** aplica prefixos `01_`, `02_`, `03_` apenas nas pastas que efetivamente possuem arquivos (sem pular números), com controle individual por pasta e total idempotência (nunca gera `01_01_`).
- **🎛️ Preset Builder Visual:** monte árvores personalizadas com arraste (`drag & drop`), 17 Color Labels por host, tags de extensões avulsas, filtros por nomenclatura (`nameFilter`), modos de Pasta de Origem e **Importar / Exportar `.json`**.
- **🔊 Triagem Automática de Áudio no Premiere Pro (ESP):** subdivide áudios em `Dialogue`, `Music`, `SFX`, `Ambience` e `Others` analisando efeitos do *Essential Sound*, trilhas da timeline, metadados XMP, stems irmãos e pastas ancestrais.
- **↩️ Snapshot & Rollback Completo:** salva a hierarquia exata do projeto antes de organizar e permite desfazer toda a operação devolvendo cada item à pasta/bin original.
- **📦 Collect Files (Project Manager):** coleta mídias preservando **100% da árvore de pastas/Bins no disco** (sem despejar tudo numa pasta plana) e faz relink por reescrita XML segura (`.aepx` e `.prproj` gzip) sem reinterpretar PSD/AI, alpha ou proxies.
- **🎨 TidyFlow Design Studio (`localhost`):** editor visual em Vite para customizar tokens, cores, estados, sombras, tipografia, ícones e modais com sincronização bidirecional direta no código.

---

## 🚀 Instalação Rápida (Windows)

### Pré-requisitos
- **Adobe After Effects** CC 2019 (`16.0`) ou superior e/ou **Adobe Premiere Pro** 2022 (`22.0`) ou superior.
- **Node.js** (18+) — necessário apenas para rodar os testes automatizados (`npm test`) e o **Design Studio** (`npm run studio`).

### 1. Modo Desenvolvimento (recomendado para testar, editar ou integrar)
1. Clone ou extraia o projeto em uma pasta fixa (ex.: `C:\Projetos\TidyFlow`).
2. Dê duplo clique em **`scripts\install_symlink.bat`** (ou rode no PowerShell):
   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\setup_dev.ps1
   ```
   O script **não exige permissão de Administrador**: ele habilita `PlayerDebugMode = 1` (`CSXS.9` a `CSXS.16`) e cria uma *Directory Junction* em `%APPDATA%\Adobe\CEP\extensions\TidyFlow` apontando direto para este repositório.
3. Reinicie o After Effects ou Premiere Pro e abra:
   - **PT-BR:** `Janela > Extensões > TidyFlow`
   - **EN-US:** `Window > Extensions > TidyFlow`

> [!TIP]
> **Hot-reload e DevTools:** com o painel do TidyFlow focado dentro do AE/Premiere, pressione **`Ctrl+R`** ou **`F5`** para recarregar UI + scripts `.jsx` sem reiniciar a Adobe. Para depurar via Chrome/Edge DevTools, acesse:
> - **After Effects:** `http://localhost:8089` *(Painel)* • `http://localhost:8090` *(Preset Builder)*
> - **Premiere Pro:** `http://localhost:8091` *(Painel)* • `http://localhost:8092` *(Preset Builder)*

### 2. Gerar Pacote Instalador Standalone (para distribuir a usuários finais)
```powershell
npm run package:v1
```
Gera um bundle limpo (sem `node_modules/`, testes ou Design Studio) em `dist/v1/TidyFlow_v1.0.0_Installer.zip`, contendo um instalador de 1 clique (`Instalar_TidyFlow.bat`).

> [!WARNING]
> Evite manter simultaneamente `%APPDATA%\Adobe\CEP\extensions\TidyFlow` (modo dev) e `%APPDATA%\Adobe\CEP\extensions\com.tidyflow` (instalador standalone), pois ambos declaram o mesmo `ExtensionBundleId` (`com.tidyflow`).

---

## ⚙️ Como Funciona

### Taxonomia Padrão (*Default Clean*)
O preset de fábrica (`client/presets/default_preset.json`, protegido contra exclusão) organiza o projeto nesta estrutura base:

```text
📁 01_Output/          → MainComp (Composição Principal / Sequência Final)
📁 02_Assets/
   ├── 📁 01_PreComps/ → PreComps / Sequências aninhadas (agrupadas por Comp Principal + Geral/)
   ├── 📁 02_Images/   → StillImages (PSD/AI isolados em bundles, PNG, JPG, OTHERS...)
   ├── 📁 03_Footages/ → Videos, ImageSequences e Data/3D (MP4, MOV, PRORES, MOGRT, OTHERS...)
   ├── 📁 04_Audios/   → Audios (no Premiere com ESP: 01_Dialogue..05_Others > WAV, MP3...)
   └── 📁 05_Solids/   → Solids / Itens Sintéticos (Color Matte, Adjustment Layer...)
📁 Nunca Usadas/       → Itens e comps/sequências desvinculadas ("Verificar Arqv.")
```

### Painel Principal — Ações Disponíveis
| Botão / Controle | O que faz |
| :--- | :--- |
| **Seletor de Preset + ⚙️** | Alterna entre presets salvos em `%APPDATA%\TidyFlow\presets` (compartilhados entre AE e Premiere) e abre o **Preset Builder**. |
| **Organizar Projeto** | Organiza o projeto completo a partir das composições/sequências selecionadas (classifica saída, pré-comps dependentes e mídias). |
| **Criar pastas** | Cria fisicamente a árvore vazia de pastas/Bins do preset com as Color Labels configuradas — ideal no início de um projeto novo. |
| **Org. Mídias** | Organiza apenas os arquivos de mídia, sem exigir seleção de composição/sequência principal. |
| **Collect Files** | Abre a janela dedicada de coleta, estimativa de espaço e relink XML. |
| **Verificar Arqv.** | Identifica composições/sequências e mídias fora da pasta de Output que não estão em uso e move para `Nunca Usadas`. |
| **Salvar antes / Excluir vazias** | Controles rápidos de segurança e higiene executados junto à organização. |
| **Desorganizar Projeto** | Executa o **Rollback** usando o snapshot salvo antes da organização, restaurando todas as pastas originais e posições dos itens. |

### Motor de Classificação por Pontuação (`host/_rules.jsx`)
Cada item do projeto é avaliado contra todos os nós da árvore seguindo uma ordem rígida de prioridade:

| Prioridade | Regra | Pontuação | Comportamento |
| :---: | :--- | :---: | :--- |
| **1** | **Filtro por Nomenclatura (`nameFilter`)** | `1000 + depth×10` | **Prioridade máxima.** Sobrepõe tipo e extensão (aceita palavras separadas por `,`/`;` ou regex). Ideal para pastas como `B-Roll`, `Logos`, `Cam A`, `GC`. |
| **2** | **Extensão Isolada** | `850 + depth×10` | Nó sem tipo fixo, mas com a extensão listada (bônus para listas específicas `≤ 3` extensões). |
| **3** | **Tipo + Extensão** | `700 + depth×10` | Match padrão de mídia. |
| **4** | **Tipo sem Extensão** | `500` / `400` | Itens estruturais (`MainComp`, `PreComps`, `Solids`) ou nós abertos sem filtro de extensão. |
| **5** | **Fallback de Tipo** | `380 + depth×10` | Evita arquivos órfãos na raiz quando uma lista de extensões está defasada. |
| **6** | **Fallback `OTHERS`** | `200 + depth×10` | Quando `catchOthers: true`, roteia extensões não listadas para a subpasta `OTHERS/`. |

### Modos de Pasta de Origem (`sourceFolderMode`)
Controla como o TidyFlow preserva agrupamentos pré-existentes dentro de cada categoria (configurável globalmente e por pasta no Preset Builder):
- **`Origem: Ambos` (`both`):** prioriza a pasta/bin manual criada no projeto e usa a pasta física do disco como fallback.
- **`Só Projeto` (`project`):** preserva apenas subpastas/bins manuais do projeto (ignora pastas do HD para arquivos soltos).
- **`Só Disco` (`disk`):** agrupa sempre pelo diretório pai no disco.
- **`Desligado` (`off`):** não cria subpastas por origem.

### Triagem de Áudio por Papel no Premiere Pro (ESP)
Quando **Categorias de Áudio (ESP)** está ativo no Premiere, os áudios passam por uma cascata de 4 etapas antes da subpasta de extensão:
1. **Timeline & Essential Sound:** efeitos aplicados (`Enhance Speech`, `De-noise`, `Ducking`, `Studio Reverb`...) e nomes de trilha (`DX`, `MX`, `SFX`, `Ambience`).
2. **Metadados XMP:** campos preenchidos (`dc:description`, `dc:subject`, `xmpDM:genre`, `xmpDM:tempo`).
3. **Nome do Arquivo & Stems Irmãos:** palavras-chave e sufixos (`- Instrumental`, `- No Lead Vocals`).
4. **Pastas Ancestrais (até 3 níveis) e Bin Original** → fallback em `Others`.

---

## 📦 Collect Files (AE & Premiere Pro)

A janela **Collect Files** (`com.tidyflow.collect`, `600×750 px`) gera uma pasta autossuficiente `<Projeto>_Collect/` contendo:

```text
📁 MeuProjeto_Collect/
├── 📄 MeuProjeto.aep (ou .prproj)  ← Relinkado via XML, sem reinterpretar mídias
├── 📁 (Footage)/                   ← Espelho fiel da árvore de pastas/Bins do painel Project
└── 📄 Report.txt                   ← Inventário completo (arquivos, fontes, efeitos, offline)
```

**Principais diferenciais:**
- **Árvore interativa de alvos:** espelha pastas/Bins do projeto com swatches de cor, seleção em lote por pasta e cálculo de espaço em disco em segundo plano (espaço livre, projeto original e tamanho estimado).
- **Zero reinterpretação no relink:**
  - **After Effects:** reescreve caminhos em `<Pin>` de um `.aepx` temporário (nunca usa `FootageItem.replace()`, preservando camadas de PSD/AI, canal alpha e FPS de proxy).
  - **Premiere Pro:** descompacta e reescreve o XML gzip do `.prproj` (`FilePath`, `ActualMediaFilePath`, `RelativePath`), preservando hierarquia de Bins, proxies e **MOGRTs** descompactados.
- **Opções por host:** excluir não usados + `Reduce Project`, renomear mídia para o nome do clipe, obedecer proxy (AE), incluir conformidade de áudio / previews (Premiere), gerar apenas relatório, abrir no Explorer e abrir projeto coletado ao concluir.
- **Cancelamento limpo:** interromper durante a cópia remove automaticamente os arquivos parciais gerados sem tocar no projeto original.

---

## 🎨 TidyFlow Design Studio (Editor Visual)

O **TidyFlow Design Studio** é um ambiente visual em `localhost` construído sobre **Vite** para editar toda a aparência do plugin ao vivo — sem adicionar nenhum peso ou arquivo extra ao pacote final do Adobe CEP.

### Como acessar o Design Studio
Na raiz do projeto, instale as dependências (apenas na primeira vez) e inicie o servidor:

```powershell
npm install
npm run studio
```

O navegador abrirá automaticamente em:

```text
http://localhost:5173/studio
```

> *(Você também pode rodar `npm run dev` e acessar `http://localhost:5173/` — a raiz redireciona automaticamente para `/studio`.)*

### O que você pode fazer no Studio
- **Galeria ao vivo com 10 telas:** visualize e edite as **3 janelas CEP** (*Painel Principal*, *Preset Builder*, *Collect Files*) e os **7 modais/overlays** (Rollback, Regras, Salvar Como, Confirmação, Redução, Alterações Não Salvas e Comentários) com zoom (`25%–200%`), pan e preview lado a lado.
- **Modo Editar + Inspetor Contextual (`✏️ Modo Editar`):**
  - Clique em qualquer botão, toggle, tag ou bloco de layout para abrir o inspetor na lateral direita (segure **`Shift + Clique`** para editar vários elementos em lote).
  - Alterne na barra de estados entre **Rest**, **Hover**, **Click**, **Ativado**, **Hover Ativado** e **Parcial** para ver e ajustar a resposta visual em tempo real.
  - Edite cores por estado (com paletas rápidas de 1 clique e derivação automática de hover/contraste), espessura/arredondamento de bordas, **Sombra Diagonal & Elevação**, tipografia, padding interno, posição e tamanho individual de ícones (**catálogo de 16 ícones SVG**).
- **Aplicar tamanho ao CEP:** atualiza diretamente `Size`, `MinSize` e `MaxSize` no `CSXS/manifest.xml`.
- **Sincronização Bidirecional + Proteção de IDs:**
  - Com **Auto-Save** (ou clicando em **Salvar no Projeto**), as alterações são gravadas via `POST /api/studio/save` em `client/theme/tokens.css`, `client/theme/studio-design.json`, `client/theme/studio-overrides.css` e nos HTMLs de `client/`.
  - Antes de escrever no disco, `vite.config.js` valida todos os IDs obrigatórios de DOM (`REQUIRED_PANEL_IDS`, `REQUIRED_EDITOR_IDS`, `REQUIRED_COLLECT_IDS`), impedindo que uma edição visual quebre a interface do CEP.
  - Ações reais do host Adobe ficam bloqueadas no preview para edição segura.

---

## 🔌 Integração em Outras Ferramentas

Os motores do TidyFlow são **desacoplados da interface** e podem ser incorporados em modo *headless* em outra extensão CEP, ScriptUI (`.jsx`) ou pipeline interno da empresa:

| Bloco Reutilizável | Arquivos | Como consome |
| :--- | :--- | :--- |
| **Motor de Organização (AE + PPro)** | `host/_lib.jsx`, `host/_rules.jsx`, `host/organizer.jsx`, `host/aeft_organizer.jsx`, `host/ppro_organizer.jsx` | `$.evalFile` em `organizer.jsx` (UTF-8) + `$.global.organizerLoadEngine(hostDir)` → chama `organizeWithPreset`, `createPresetFolderStructure`, `checkUnusedComps`, `rollbackProject`. |
| **Motor de Collect Files** | `client/CollectEngine.js` *(JS/Node puro)* + `host/aeft_collect.jsx` / `host/ppro_collect.jsx` | Planejamento, estimativa, reescrita XML `.aepx`/`.prproj` e `Report.txt` sem dependência de DOM/CEP. |
| **Presets & Dicionários por Host** | `client/PresetManager.js` + `client/presets/default_preset.json` | Normalização de schema, listas de extensões AE/PPro e paletas de Color Labels. |

> 📘 **Guia passo a passo de integração, snippets prontos e checklist de namespace:** veja [README_HANDOFF.md](README_HANDOFF.md).

---

## 📁 Estrutura e Documentação

```text
TidyFlow/
├── README.md                   # Este guia geral
├── README_HANDOFF.md           # Guia técnico de handoff e integração em outras ferramentas
├── MANIFESTO_MESTRE.md         # Índice mestre, contratos globais Client <-> Host e roteamento
├── AGENTS.md                   # Regras obrigatórias de arquitetura, ES3 e testes (para devs e IA)
├── CSXS/manifest.xml           # Manifesto CEP unificado (AEFT 16.0+ e PPRO 22.0+)
├── client/                     # Interface CEP (HTML/CSS/JS + Node.js)
│   ├── theme.css + theme/      # Design System Neo-Brutalista (tokens, overrides, componentes)
│   ├── index.* + main.js       # Painel Principal
│   ├── tree_editor.*           # Preset Builder (Árvore, Labels e Modal de Regras V2)
│   ├── collect.* + CollectEngine.js # Janela e motor puro de Collect Files
│   ├── PresetManager.js        # Persistência, cache, normalização e dicionários AE/PPro
│   ├── OrgLog.js               # Logger (ring buffer 200 RAM / 50 localStorage)
│   └── presets/default_preset.json
├── host/                       # Motores ExtendScript (ES3 estrito + UTF-8)
│   ├── _lib.jsx                # Helpers compartilhados ($.global.OrgLib)
│   ├── _rules.jsx              # Classificador por pontuação ($.global.OrgRules)
│   ├── organizer.jsx           # Roteador agnóstico (AEFT vs PPRO)
│   ├── aeft_organizer.jsx      # Motor de organização e rollback (After Effects)
│   ├── ppro_organizer.jsx      # Motor de organização, áudio ESP e rollback (Premiere Pro)
│   ├── aeft_collect.jsx        # Host do Collect Files (.aepx)
│   └── ppro_collect.jsx        # Host do Collect Files (.prproj)
├── tools/studio/               # TidyFlow Design Studio (Vite localhost — fora do bundle CEP)
├── scripts/                    # Setup dev, build V1, utilitários e suíte de testes (`scripts/tests/`)
└── docs/                       # Documentação técnica modularizada (01 a 07)
```

### Mapa da Documentação (`docs/`)
| Documento | Conteúdo |
| :--- | :--- |
| [MANIFESTO_MESTRE.md](MANIFESTO_MESTRE.md) | Contratos globais `Client ↔ Host`, eventos CEP e roteamento da documentação. |
| [docs/01_ARQUITETURA_E_HOSTS.md](docs/01_ARQUITETURA_E_HOSTS.md) | Mapa cirúrgico de funções e linhas, equivalência `AEFT × PPRO`, armadilhas ES3 e Rollback. |
| [docs/02_PRESETS_REGRAS_E_AUDIO.md](docs/02_PRESETS_REGRAS_E_AUDIO.md) | Schema de presets, pontuação do `_rules.jsx`, cache e triagem de áudio ESP. |
| [docs/03_UI_DESIGN_SYSTEM.md](docs/03_UI_DESIGN_SYSTEM.md) | Geometria das janelas CEP, classes de `theme.css` e IDs de DOM obrigatórios. |
| [docs/04_COLLECT_FILES_SPEC.md](docs/04_COLLECT_FILES_SPEC.md) | Especificação completa do Collect Files (`.aepx` / `.prproj`), sanitização e cancelamento. |
| [docs/05_ROADMAP_COLLECT_V2.md](docs/05_ROADMAP_COLLECT_V2.md) | Plano técnico das próximas fases do Collect V2. |
| [docs/06_HISTORICO_E_TESTES.md](docs/06_HISTORICO_E_TESTES.md) | Mapa da suíte `npm test` e histórico de decisões técnicas. |
| [docs/07_DESIGN_STUDIO.md](docs/07_DESIGN_STUDIO.md) | Arquitetura completa do Design Studio, módulos, API `/api/studio/*` e sincronização. |

---

## 🛠️ Scripts & Comandos (`package.json`)

| Comando | Descrição |
| :--- | :--- |
| `npm test` | Executa toda a suíte de testes em Node puro (`scripts/tests/run.js` — 117 testes). |
| `npm run studio` | Inicia o servidor Vite e abre o **TidyFlow Design Studio** em `http://localhost:5173/studio`. |
| `npm run dev` | Inicia o servidor Vite em modo desenvolvimento (`http://localhost:5173`). |
| `npm run package:v1` | Gera o bundle limpo e o instalador Windows em `dist/v1/TidyFlow_v1.0.0_Installer.zip`. |
| `npm run test:studio` | Executa a suíte visual automatizada do Design Studio (requer Edge em debug na porta `9333` + Studio rodando). |

> [!IMPORTANT]
> **Regras críticas ao editar `host/*.jsx` (ExtendScript ES3):**
> Os scripts de `host/` rodam no interpretador **ECMAScript 3** da Adobe. Use apenas `var` e `function () {}` (nunca `let`, `const`, arrow functions, template literals, trailing commas, `Object.keys` ou `.forEach`/`.map`/`.filter`/`.indexOf`). Sempre escape `\/` dentro de classes RegExp `[...]`, use escapes Unicode `\uXXXX` para acentos em RegExp, defina `fileObj.encoding = "UTF-8"` antes de `$.evalFile` e rode **`npm test`** antes de commitar.
