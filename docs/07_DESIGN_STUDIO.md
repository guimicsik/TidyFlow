# 07. TidyFlow Design Studio (Editor Visual Localhost)

> **Guia de Arquitetura para Agentes de IA:**
> Este documento descreve o funcionamento, os arquivos e os contratos de sincronização bidirecional do **TidyFlow Design Studio**, a ferramenta visual de customização de design em `localhost`.

---

## 1. Visão Geral e Como Iniciar

O **TidyFlow Design Studio** roda sobre o servidor Vite local (`http://localhost:5173/studio`) sem adicionar nenhum arquivo extra ao pacote final de produção do Adobe CEP (`client/`).

### Comandos de Inicialização:
```powershell
npm run studio
# ou
npm run dev
# Acesse: http://localhost:5173/studio (a raiz "/" redireciona automaticamente para "/studio")
```

---

## 2. Mapa por tarefa

Os caminhos abaixo são relativos a `tools/studio/`. Abra primeiro o arquivo indicado na linha da tarefa. Os imports nomeados mostram as dependências diretas.

| Tarefa | Onde editar | Como verificar |
| --- | --- | --- |
| Ajustar sombra diagonal, elevação ou os quatro eixos | `modules/effects.js`. O par slider/campo dos eixos fica em `modules/axis-control.js`. | Edge · cenário da sombra no overlay, incluindo valor fracionário e CSS manual |
| Acrescentar uma paleta de cores | `modules/palettes.js` contém `COLOR_STATE_PRESETS`. A barra de copiar, colar e salvar está em `modules/palette-controls.js`. | Edge · aplicar o chip a dois botões com Shift+clique |
| Ajustar zoom, enquadramento, arraste ou tamanho | `modules/canvas.js`. Os cards que escolhem a tela ficam em `modules/gallery.js`. | Edge · zoom, roda, enquadrar, mover e galeria |
| Investigar auto-save, recarga ou conteúdo salvo | `modules/persistence.js` controla o temporizador e os pedidos pendentes. `modules/serialize.js` limpa o HTML. Os endpoints ficam em `vite.config.js`. | Salvar e reabrir numa cópia de trabalho temporária. Conferir HTML, tokens, JSON e CSS gerado |
| Alterar uma propriedade individual, rótulo ou intervalo | `modules/property-config.js` define grupos, nomes, unidades e limites. `modules/properties.js` monta os controles. `modules/typography.js` cuida de texto e padding. | Edge · slider, campo preciso e edição manual |
| Mudar como uma edição se aplica aos alvos e estados | `modules/design-edits.js` aplica propriedades e paletas. `modules/individual-design.js` controla os estados do inspetor. `design-model.cjs` valida e compila o formato compartilhado com o servidor. | `npm test` para o modelo e Edge para a seleção múltipla |
| Alterar seleção, prévia ou ações bloqueadas | `modules/selection.js` controla a seleção. `modules/preview.js` trata eventos nos iframes. A árvore simulada do Collect fica em `modules/collect-preview.js`. | Edge · seleção nos quatro painéis e bloqueio de ações operacionais |
| Editar abas, campos estáticos ou aparência | `studio.html` lista os fragmentos de `partials/` por aba e painel. `studio.css` lista os arquivos de `styles/` na ordem da cascata. Os avisos ficam em `overlays.html`. | `npm test` confere os tokens do HTML composto. Edge verifica o layout |
| Alterar valores de fábrica, tokens ao vivo ou textos dos painéis | `modules/defaults.js`, `modules/tokens.js` e `modules/panel-text.js`, respectivamente. | `npm test`, alterar no preview e recarregar após salvar |

`studio.js` inicializa os módulos ES após a composição do HTML pelo Vite usando `render-html.cjs`. `modules/state.js` mantém o painel ativo, a seleção e os designs da sessão. Os quatro iframes, o CEP e os formatos em disco mantêm seus pontos de entrada próprios.

Para a suíte visual, execute `npm run test:studio` com Edge em depuração local na porta 9333 e o Studio em execução. `STUDIO_TEST_URL` seleciona a URL de uma cópia temporária. A suíte abre uma aba própria, desativa o auto-save para as edições e grava `preview-test.png` ao lado do script.

---

## 3. Sincronização Bidirecional (Usuário no Studio ↔ IA no Código)

1. **Quando a IA edita `client/theme/tokens.css` ou `client/index.html`:**
   - O Vite atualiza os estilos por HMR. Para carregar alterações externas no HTML, recarregue a página do Studio.
   - Em `modules/events.js`, a carga de cada iframe sincroniza os controles de texto e inicializa a prévia. O foco da janela chama `fetchStateFromDisk()` e `syncTextInputsFromDoc()` para atualizar os controles do painel ativo.
2. **Quando o usuário altera controles no Studio:**
   - A mudança é aplicada em tempo real via `documentElement.style.setProperty('--tf-...', valor)` nos painéis, overlays e miniaturas.
   - Com **Auto-Save** ativo (ou ao clicar em **💾 Salvar no Projeto**), `POST /api/studio/save` grava os novos valores diretamente em `client/theme/tokens.css` e `client/index.html`.

---

## 4. Capacidades e Contratos de Tokens (`client/theme/tokens.css`)

### Área de trabalho e edição individual

- A barra sobre o canvas permite selecionar a tela, informar largura/altura em pixels e escolher zoom. Dimensões de prévia ficam em `localStorage`.
- **Aplicar tamanho ao CEP** é uma ação explícita que atualiza `Size`, `MinSize` e `MaxSize` da extensão selecionada nos manifestos normal e de desenvolvimento. O resultado depende de reabrir a extensão ou reiniciar o host; não redimensiona uma janela já aberta. A ação define dimensões fixas. No Windows, a trava da janela flutuante do painel principal lê o tamanho do manifesto ao iniciar ou redimensionar.
- O bloco **Estilo** do inspetor salva propriedades por alvo e estado (repouso/hover/clique), com seletor de cor e campo HEX lado a lado. Campo vazio remove a substituição. Tags recebem identidade pelo significado; alterar “Pasta Origem” afeta suas ocorrências. O fundo das linhas da árvore usa o token compartilhado `--tf-editor-row-bg`, portanto uma alteração afeta todas as pastas. Ações da árvore têm identidade por função.
- O inspetor de núcleo abre em uma coluna dedicada na **lateral direita** (`#stInspectorPanel.st-inspector-right`), mantendo a sidebar esquerda de configurações gerais e a galeria de telas sempre acessíveis.
- Clicar em qualquer botão, tag ou toggle no Modo Editar seleciona o **Núcleo unificado** (o componente inteiro, nunca o `span` interno separado). Nas opções do Collect, o quadrado `.toggle-slider` e o texto são alvos independentes, para que propriedades visuais do toggle não contaminem o rótulo.
- No topo do painel direito, a barra de estados permite alternar entre **Rest**, **Hover**, **Click**, **Ativado** e **Hover Ativado** e, para os controles compatíveis, **Parcial**, simulando o estado ao vivo no canvas.
- A **Área de Texto do Núcleo** reúne a edição de conteúdo (`Enter` para quebras de linha), tamanho, peso (`font-weight`), altura da linha (`line-height`), tracking (`letter-spacing`) e o **espaço limite dentro do botão** (`padding` horizontal X e vertical Y), que também é propagado aos rótulos internos (`.btn-tile-label` e `.tf-toggle__face`).
- O slider individual **Tamanho do texto** fica no topo das propriedades do inspetor direito, fora das seções recolhíveis, acompanhado de um campo de valor preciso.
- A **Seção do Botão** reúne as cores em todos os estados (Fundo, Texto e Borda), espessura + cor da borda, arredondamento (`border-radius`), largura (`width`), altura (`height`) e o controle unificado de **Sombra Diagonal & Distância que Levanta** (que aplica simultaneamente `box-shadow: Dpx Dpx 0px <cor>` e `transform: translate(-Dpx, -Dpx)`).
- O canvas tem zoom numérico (25–200%), botões de ampliação, enquadrar, centralizar e modo **Mover** para arrastar a área de trabalho. Atalhos `+`, `-` e `0` controlam o zoom; `Ctrl+roda` amplia ou reduz. Ao abrir um aviso pela galeria, a prévia ajusta suas dimensões ao card visível antes de enquadrar. O zoom é uma preferência local do Studio e não altera as dimensões CEP.
- `client/theme/studio-design.json` armazena as substituições; `studio-overrides.css` contém o CSS gerado. `tools/studio/design-model.cjs` valida e compila o mesmo modelo no navegador e no servidor.
- A galeria carrega os cards reais dos três HTMLs, incluindo confirmação compartilhada, redução e comentários. O texto de confirmações dinâmicas ainda é definido pela ação em execução; estilos do card compartilhado valem para suas variantes.
- A barra **Telas** mostra dez miniaturas ao vivo: as três janelas CEP e sete avisos/modais. Clicar numa miniatura abre a tela no canvas; os avisos usam `#ov-*` em `overlays.html` para mostrar só o card escolhido sem removê-lo do documento nem mudar o contrato de salvamento. As miniaturas recebem os tokens e estilos individuais durante a edição.

No Preset Builder, a aba **Geral & Gaps** controla o espaçamento entre pastas e as cores de fundo e texto das tags por categoria. A prévia pode ser redimensionada arrastando seu canto inferior direito. A janela **Overlays** apresenta os avisos simultaneamente, com rolagem.

No Modo Editar, o bloco Estilo oferece substituições individuais por ID ou identidade de design. Os controles gerais das abas continuam ajustando categorias e tokens compartilhados.

### 4.1 Texto (`Aba 1: 🔤 Texto`)
- **Família e Estilo:** `--tf-font-family`, `--tf-hero-text-transform`, `--tf-tile-text-transform`, `--tf-toggle-text-transform`, `--tf-font-style-hero`, `--tf-font-style-tile`.
- **Pesos (`font-weight`):** `--tf-font-weight-hero` (`900`), `--tf-font-weight-tile` (`800`), `--tf-font-weight-toggle` (`600`), `--tf-font-weight-rollback` (`800`).
- **Tamanhos e Espaçamento:** `--tf-font-size-hero`, `--tf-font-size-tile`, `--tf-font-size-toggle`, `--tf-font-size-rollback`, `--tf-hero-letter-spacing`, `--tf-tile-letter-spacing`, `--tf-tile-line-height`.
- **Conteúdo:** Edição por formulário lateral (usando `|` para quebras de linha) ou **duplo clique direto** sobre o botão no simulador.

### 4.2 Botões & Cores (`Aba 2: 🎨 Botões`)
- **Temas Rápidos de 1 Clique:** *Electric Blue*, *Cyber Lime*, *Editorial Amber*, *Violet Studio*, *Crimson Brutal*, *Monochrome Pure*.
- **Cores por Estado (Rest, Hover, Click e Texto):**
  - Hero: `--tf-neo-hero-bg`, `--tf-neo-hero-hover`, `--tf-neo-hero-active`, `--tf-neo-hero-text`.
  - Tiles: `--tf-neo-tile-bg`, `--tf-neo-tile-hover`, `--tf-neo-tile-active`, `--tf-neo-tile-text`.
  - Rollback: `--tf-neo-danger-bg`, `--tf-neo-danger-hover`, `--tf-neo-danger-active`, `--tf-neo-danger-text`.
  - Toggles (On/Off): `--tf-neo-toggle-on-bg/hover/text`, `--tf-neo-toggle-off-bg/hover/text`.
  - App & Preset Bar: `--tf-bg-app`, `--tf-preset-bar-bg`, `--tf-neo-ghost-bg`, `--tf-neo-ghost-hover`.

### 4.3 Animação & Física dos Estados (`Aba 3: ⚡ Animação`)
- **Simulador de Estado na Topbar (`🟢 Rest`, `🔵 Hover`, `🟠 Click`):** Aplica as classes `.tf-force-hover` ou `.tf-force-active` no `<body>` do iframe para inspecionar e ajustar estados em tempo real.
- **Estado Rest (Repouso):** `--tf-rest-lift-hero`, `--tf-rest-shadow-hero`, `--tf-rest-lift-tile`, `--tf-rest-shadow-tile`.
- **Estado Hover:** `--tf-neo-lift-hero`, `--tf-neo-shadow-hero`, `--tf-neo-lift-tile`, `--tf-neo-shadow-tile`.
- **Estado Click (Active):** `--tf-active-lift-hero`, `--tf-active-shadow-hero`, `--tf-active-lift-tile`, `--tf-active-shadow-tile`.
- **Transição:** `--tf-anim-duration` (`s`) e `--tf-anim-easing` (`cubic-bezier(...)`).

### 4.4 Geral, Gaps, Alturas, Checkmark e Grade Magnética (`Aba 4: 📐 Geral & Gaps`)
- **Gaps e Padding:** `--tf-panel-padding`, `--tf-section-gap`, `--tf-field-group-gap`, `--tf-grid-gap`, `--tf-toggles-gap`, `--tf-options-gap` + slider de gap entre as 3 janelas no modo *Todas Lado a Lado*.
- **Alturas:** `--tf-hero-height`, `--tf-tile-height`, `--tf-toggle-height`, `--tf-rollback-height`.
- **Posicionamento do Rollback e Checkmark:** `--tf-rollback-justify` (`flex-start`, `center`, `flex-end`), `--tf-rollback-width`, `--tf-toggle-check-display` (`none` | `inline-flex`), `--tf-checkbox-size`, `--tf-checkbox-radius`.
- **Grade Magnética (Drag-and-Drop):** Reordenação por arrasto direto na tela (quando `✋ Arrastar Layout: ON`) ou pelas setas de ordenação na sidebar.

### 4.5 Ícones (`Aba 5: ✨ Ícones`)
- A seção **Ícone do Botão** do inspetor oferece tamanho individual de 8 a 128 px, com slider, campo numérico e restauração do padrão. Salva `data-tf-icon-size` e `--tf-button-icon-size` no HTML do botão; não altera o tamanho do texto nem dos outros botões.
- Catálogo de 16 ícones SVG vetoriais aplicáveis a qualquer botão via `<span class="tf-btn-icon">`, dimensionados por `--tf-icon-size`.
- No inspetor de um botão, **Conteúdo** alterna texto e ícone, só texto ou só ícone centralizado. **Posição do ícone** permite esquerda, direita, acima e abaixo quando acompanhado de texto. É necessário escolher um ícone antes de ocultar o texto. Remover o ícone restaura o texto.
- `modules/icon-layout.js` compartilha a aplicação de ícones entre catálogo e inspetor. Os atributos `data-tf-icon-mode` e `data-tf-icon-position` e o rótulo `.tf-btn-label` persistem no HTML pelo salvamento existente. O modo só ícone oculta visualmente o rótulo sem apagar seu conteúdo ou nome acessível; os estilos ficam em `client/theme.css`.

### 4.6 Seleção de Painéis & Tokens Dedicados
O Studio permite alternar o painel ativo tanto pela Topbar (`[📱 Principal] [🌳 Preset Builder] [📦 Collect Files]`) quanto clicando diretamente na moldura de qualquer janela do simulador.

Ao selecionar um painel:
1. **Controles Contextuais:** A sidebar oculta automaticamente cartões que não pertencem ao painel ativo e exibe os cartões específicos do painel selecionado (com indicativo de painel ativo no topo da sidebar `#lblActivePanelBadge`).
2. **Edição de Texto Direta:** Os inputs de texto da aba `🔤 Texto` refletem os botões e títulos do painel ativo.
3. **Seletor de Alvo de Ícones:** O dropdown da aba `✨ Ícones` lista dinamicamente apenas os botões do painel ativo.
4. **Drag-and-Drop & Reordenação:** A lista magnética de ordenação adapta-se para permitir reordenar os elementos do painel ativo.
5. **Tokens Dedicados por Janela:**
   - **Preset Builder:** `--tf-editor-bg`, `--tf-editor-topbar-bg`, `--tf-editor-tree-bg`, `--tf-editor-row-bg`, `--tf-editor-row-border`, `--tf-editor-footer-bg`, `--tf-editor-padding`.
   - **Collect Files:** `--tf-collect-bg`, `--tf-collect-box-bg`, `--tf-collect-box-border`, `--tf-collect-btn-ok-bg`, `--tf-collect-btn-ok-hover`, `--tf-collect-btn-ok-text`, `--tf-collect-btn-cancel-bg`, `--tf-collect-btn-cancel-border`, `--tf-collect-btn-cancel-text`.

### 4.7 Modo Editar & Inspector Contextual (Studio 2.0)
- **Ativação:** Botão `[ ✏️ Modo Editar: OFF / ON ]` na Topbar.
- **Bounding Boxes:** Elementos interativos ganham contorno pontilhado azul no hover (`outline: 1.5px dashed #3B82F6`) e contorno sólido com alças de seleção (`outline: 2.5px solid #3B82F6; box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.35)`) ao serem selecionados.
- **Caixas Invisíveis de Texto:** Textos e labels ganham automaticamente caixas invisíveis (`.st-text-box`) com padding para permitir clique rápido e direto.
- **Seções em Grupos (Illustrator Style):** Seções (`.tiles-grid`, `.toggles-grid`, `.rule-section`) são agrupadas visualmente com contorno sutil (`.st-section-group`), mantendo os botões internos selecionáveis individualmente.
- **Presets Rápidos de Cor & Seleção Múltipla (`Shift + Clique`):**
  - Dentro de **Cores em Todos os Estados**, a barra `.st-color-presets-bar` oferece paletas prontas de 1 clique, **Derivar Hover/Clique** (a partir de `Fundo · repouso` com contraste automático de texto), **Copiar / Colar** cores entre elementos e **`+ Salvar`** paletas customizadas em `localStorage`.
  - Segurar `Shift` ao clicar no Modo Editar adiciona/remove elementos da seleção múltipla (`currentSelectedElements` + chips `.st-multi-targets`), aplicando ajustes visuais (cores, presets, bordas, sombra diagonal, tipografia, etc.) em lote para todos os alvos selecionados e ocultando apenas a edição de conteúdo textual.
- **Identidade de textos e hover:** Rótulos dos botões principais e as três legendas de espaço em disco do Collect usam `data-tf-design`, permitindo editar suas propriedades individuais no Studio e aplicar o CSS salvo no CEP. O inspetor oferece `Animar ao passar o mouse` por elemento; tags e badges começam estáticos, e a escolha é salva em `client/theme/studio-design.json` como `hoverMotion`.
- **Controles do inspetor individual:** Propriedades numéricas usam sliders e campos editáveis lado a lado, aceitando valores precisos e unidades CSS. Propriedades com valores definidos (alinhamento, exibição, direção e transbordamento) usam seletores. Em Efeitos, os controles ficam em uma coluna; a sombra tem linhas separadas para X, Y, desfoque e expansão, cada uma com slider e entrada numérica, além de seletor de cor. O menu `CSS` mantém a entrada manual para expressões mais complexas.
- **Identidades estáveis:** Textos de toggles, títulos e opções dos três painéis usam `data-tf-design` quando não há ID próprio. Os controles gerados da árvore (arraste, recolher, cor, prefixo, nome e regras) recebem chaves por função em `tree_editor.js`, compartilhadas entre todas as pastas. O seletor de preset customizado recebe chaves em `main.js` e `tree_editor.js`. O Studio seleciona o controle pai quando um filho sem identidade é clicado. Essas chaves existem também na interface CEP, portanto os estilos persistidos funcionam fora do localhost.
- **Blocos de layout:** Barras, grades e caixas principais também têm `data-tf-design`. O inspetor oferece propriedades visuais nesses blocos e oculta a edição de conteúdo quando substituir texto apagaria controles filhos. Textos gerados por regras da árvore mantêm o conteúdo sob controle do preset.
- **Sincronização Bidirecional de Overlays (`syncOverlaysToClientFiles`):** Ao salvar a janela de overlays, o Studio grava `tools/studio/overlays.html` e sincroniza os modais mapeados com seus painéis:
  - `ov-rollback` sincroniza com `#rollbackModalBackdrop` em `client/index.html`.
  - `ov-rules` sincroniza com `#rulesModalBackdrop` em `client/tree_editor.html`.
  - `ov-save-as` sincroniza com `#saveAsModalBackdrop` em `client/tree_editor.html`.
  - `ov-unsaved` sincroniza com `#unsavedCloseModalBackdrop` em `client/tree_editor.html`.
- **Desacoplamento de Tokens de Botões:** Os botões da barra superior do Preset Builder (`.preset-icon-btn`) possuem tokens dedicados (`--tf-toolbar-icon-*`) totalmente separados do botão Fechar do rodapé (`--tf-btn-close-*`) e dos botões independentes das linhas de pasta (`.prefix-preview` com `--tf-editor-prefix-on-*` / `--tf-editor-prefix-off-*` e `.row-btn` com `--tf-editor-row-btn-*`). Os prefixos `01_` (`data-tf-design="folder-prefix"`) e `OFF` (`data-tf-design="folder-prefix-off"`) possuem identidades e cards dedicados na aba `Botões` do Studio (`#cardEditorIndependentPrefix` e `#cardEditorIndependentRowButtons`), impedindo contaminação visual entre si.
- **Prevenção de Ações e HMR em Modo Editar:** Todos os cliques no Modo Editar são interceptados na fase de captura para abrir o Inspector sem disparar ações da aplicação, e o HMR de HTML foi desativado nos previews para evitar que textos apaguem ou resetem durante a digitação.
- **Segurança do Preview:** Ações operacionais que dependem do host Adobe (organizar, criar estrutura, verificar mídias, coletar, salvar preset etc.) são bloqueadas no Studio mesmo fora do Modo Editar. Antes de salvar HTML, o Studio também remove estados transitórios de execução (`disabled` e mensagens de progresso), impedindo que um preview interrompido contamine o painel real.

---

## 5. Guardas de Segurança (`vite.config.js` & `npm test`)

Ao gravar alterações via `POST /api/studio/save`, o backend valida os IDs críticos conforme o `targetPanel`:
- **Painel Principal (`main`):** Valida os 13 IDs obrigatórios via `REQUIRED_PANEL_IDS`.
- **Preset Builder (`editor`):** Valida os 12 IDs essenciais da árvore e controles via `REQUIRED_EDITOR_IDS`.
- **Collect Files (`collect`):** Valida os 10 IDs essenciais do fluxo de coleta via `REQUIRED_COLLECT_IDS`.

Caso qualquer ID obrigatório esteja ausente, o salvamento é abortado imediatamente com erro 400 antes de escrever no disco, garantindo que `scripts/tests/client_refs_test.js` nunca quebre a suíte de testes do CEP.
