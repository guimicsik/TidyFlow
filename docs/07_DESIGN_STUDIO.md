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

## 2. Mapa de Arquivos do Studio

| Arquivo | Papel Arquitetural |
| :--- | :--- |
| `tools/studio/studio.html` | Interface principal do Studio: Topbar (seletor de painel ativo `[📱 Principal] [🌳 Preset Builder] [📦 Collect Files] [🪟 Overlays] [🔲 Todas]`, botão `✏️ Modo Editar`, simulador de estados Rest/Hover/Click, Auto-Save) + Inspector Contextual (`#stInspectorPanel`) + Sidebar com abas gerais + Stage com iframes das 4 janelas. |
| `tools/studio/studio.css` | Estilização Neo-Brutalista Dark exclusiva do Studio, incluindo Inspector Contextual, Bounding Boxes estilo Illustrator/Figma e badges. |
| `tools/studio/studio.js` | Motor reativo do Studio 2.0: orquestra a alternância dinâmica entre painéis e overlays, gerencia o Modo Editar com seleção direta por clique, abre o Inspector Contextual, injeta tokens CSS em tempo real nos iframes, e gerencia catálogo de ícones. |
| `tools/studio/overlays.html` | Janela de Overlays & Modais de Alerta: preview e customização isolada dos 6 modais (Regras & Filtros, Confirmar Rollback, Remover Pasta, Salvar Novo Preset, Excluir Preset, Alterações Não Salvas). |
| `vite.config.js` (`tidyflowStudioPlugin`) | Plugin Node.js do Vite que serve `tools/studio/*` em `/studio` e expõe os endpoints `GET /api/studio/state` e `POST /api/studio/save` com validação de IDs para cada um dos 3 painéis (`REQUIRED_PANEL_IDS`, `REQUIRED_EDITOR_IDS`, `REQUIRED_COLLECT_IDS`). |
| `client/theme/tokens.css` | **Fonte Única da Verdade de Tokens (`:root`):** Inclui tokens globais e tokens específicos dos 3 painéis (`--tf-editor-*`, `--tf-collect-*`). Lida e atualizada cirurgicamente pelo Studio e pela IA. |
| `client/index.html` | **Painel Principal:** Atualizado pelo Studio ao editar textos, aplicar ícones ou reordenar blocos/botões/toggles. |
| `client/tree_editor.html` | **Preset Builder:** Atualizado pelo Studio ao editar textos de cabeçalho, botões e estrutura visual. |
| `client/collect.html` | **Collect Files:** Atualizado pelo Studio ao editar textos de títulos, caixas e botões de ação. |

---

## 3. Sincronização Bidirecional (Usuário no Studio ↔ IA no Código)

1. **Quando a IA edita `client/theme/tokens.css` ou `client/index.html`:**
   - O Vite HMR atualiza automaticamente os iframes de preview no navegador.
   - O `studio.js` escuta os eventos `load` dos iframes e `focus` da janela, chamando `GET /api/studio/state` e `syncTextInputsFromMainDoc()` para reposicionar todos os sliders, color pickers e campos de texto com os valores recém-editados pela IA.
2. **Quando o usuário altera controles no Studio:**
   - A mudança é aplicada em tempo real (`0ms`) via `documentElement.style.setProperty('--tf-...', valor)` nos 3 iframes.
   - Com **Auto-Save** ativo (ou ao clicar em **💾 Salvar no Projeto**), `POST /api/studio/save` grava os novos valores diretamente em `client/theme/tokens.css` e `client/index.html`.

---

## 4. Capacidades e Contratos de Tokens (`client/theme/tokens.css`)

### Área de trabalho e edição individual

- A barra sobre o canvas permite selecionar a tela, informar largura/altura em pixels e escolher zoom. Dimensões de prévia ficam em `localStorage`.
- **Aplicar tamanho ao CEP** é uma ação explícita que atualiza `Size`, `MinSize` e `MaxSize` da extensão selecionada nos manifestos normal e de desenvolvimento. O resultado depende de reabrir a extensão ou reiniciar o host; não redimensiona uma janela já aberta. A ação define dimensões fixas. No Windows, a trava da janela flutuante do painel principal lê o tamanho do manifesto ao iniciar ou redimensionar.
- O bloco **Estilo** do inspetor salva propriedades por alvo e estado (repouso/hover/clique), com seletor de cor e campo HEX lado a lado. Campo vazio remove a substituição. Tags recebem identidade pelo significado; alterar “Pasta Origem” afeta suas ocorrências. O fundo das linhas da árvore usa o token compartilhado `--tf-editor-row-bg`, portanto uma alteração afeta todas as pastas. Ações da árvore têm identidade por função.
- O inspetor mantém as nove cores visíveis, com limpeza individual, e oferece botões de estado ligados à simulação do canvas. Tipografia, forma, efeitos e layout avançado ficam em grupos recolhíveis. Cada propriedade pode ser removida isoladamente; também é possível limpar um estado ou todos os ajustes do elemento. O modelo permite medidas, alinhamento, flex, grade, contorno e transbordamento além das propriedades anteriores.
- O campo de texto do inspetor aceita Enter para quebras de linha. Em **Estilo → Tipografia**, a altura da linha e o alinhamento também são aplicados aos rótulos internos dos botões.
- O canvas tem zoom numérico (25–200%), botões de ampliação, enquadrar, centralizar e modo **Mover** para arrastar a área de trabalho. Atalhos `+`, `-` e `0` controlam o zoom; `Ctrl+roda` amplia ou reduz. Ao abrir um aviso pela galeria, a prévia ajusta suas dimensões ao card visível antes de enquadrar. O zoom é uma preferência local do Studio e não altera as dimensões CEP.
- `client/theme/studio-design.json` armazena as substituições; `studio-overrides.css` contém o CSS gerado. `tools/studio/design-model.cjs` valida e compila o mesmo modelo no navegador e no servidor.
- A galeria carrega os cards reais dos três HTMLs, incluindo confirmação compartilhada, redução e comentários. O texto de confirmações dinâmicas ainda é definido pela ação em execução; estilos do card compartilhado valem para suas variantes.
- A barra **Telas** mostra dez miniaturas ao vivo: as três janelas CEP e sete avisos/modais. Clicar numa miniatura abre a tela no canvas; os avisos usam `#ov-*` em `overlays.html` para mostrar só o card escolhido sem removê-lo do documento nem mudar o contrato de salvamento. As miniaturas recebem os tokens e estilos individuais durante a edição.
- Verificação visual reproduzível: iniciar Edge headless com depuração local na porta 9333 e executar `node tools/studio/test-browser.cjs`. O teste desliga Auto-Save, verifica tamanho, cor de tag, número de cards e exceções. Não testa o host Adobe.

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
- Catálogo de 16 ícones SVG vetoriais aplicáveis a qualquer botão via `<span class="tf-btn-icon">`, dimensionados por `--tf-icon-size`.

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
- **Inspector Lateral:** Clicar em qualquer botão ou texto substitui as abas gerais pelo `#stInspectorPanel`, exibindo propriedades do elemento selecionado (Texto ao vivo, Cores Rest/Hover/Click, Tipografia, Sombra/Raio e Catálogo rápido de Ícones).
- **Identidade de textos e hover:** Rótulos dos botões principais e as três legendas de espaço em disco do Collect usam `data-tf-design`, permitindo editar suas propriedades individuais no Studio e aplicar o CSS salvo no CEP. O inspetor oferece `Animar ao passar o mouse` por elemento; tags e badges começam estáticos, e a escolha é salva em `client/theme/studio-design.json` como `hoverMotion`.
- **Controles do inspetor individual:** Propriedades numéricas usam sliders e campos editáveis lado a lado, aceitando valores precisos e unidades CSS. Propriedades com valores definidos (alinhamento, exibição, direção e transbordamento) usam seletores. Em Efeitos, os controles ficam em uma coluna; a sombra tem linhas separadas para X, Y, desfoque e expansão, cada uma com slider e entrada numérica, além de seletor de cor. O menu `CSS` mantém a entrada manual para expressões mais complexas.
- **Identidades estáveis:** Textos de toggles, títulos e opções dos três painéis usam `data-tf-design` quando não há ID próprio. Os controles gerados da árvore (arraste, recolher, cor, prefixo, nome e regras) recebem chaves por função em `tree_editor.js`, compartilhadas entre todas as pastas. O seletor de preset customizado recebe chaves em `main.js` e `tree_editor.js`. O Studio seleciona o controle pai quando um filho sem identidade é clicado. Essas chaves existem também na interface CEP, portanto os estilos persistidos funcionam fora do localhost.
- **Blocos de layout:** Barras, grades e caixas principais também têm `data-tf-design`. O inspetor oferece propriedades visuais nesses blocos e oculta a edição de conteúdo quando substituir texto apagaria controles filhos. Textos gerados por regras da árvore mantêm o conteúdo sob controle do preset.
- **Área de Overlays & Modais:** A 4ª janela (`4. 🪟 Overlays`) carrega `tools/studio/overlays.html`, permitindo inspecionar e personalizar os 6 modais do sistema (Regras e Filtros, Confirmar Rollback, Remover Pasta, Salvar Novo Preset, Excluir Preset, Alterações Não Salvas).
- **Sincronização Bidirecional de Overlays (`syncOverlaysToClientFiles`):** Ao customizar qualquer aviso ou modal na janela de Overlays, o Studio grava `tools/studio/overlays.html` e replica automaticamente a estrutura e os textos para os arquivos reais de produção:
  - `ov-rollback` sincroniza com `#rollbackModalBackdrop` em `client/index.html`.
  - `ov-rules` sincroniza com `#rulesModalBackdrop` em `client/tree_editor.html`.
  - `ov-save-as` sincroniza com `#saveAsModalBackdrop` em `client/tree_editor.html`.
  - `ov-unsaved` sincroniza com `#unsavedCloseModalBackdrop` em `client/tree_editor.html`.
  - A limpeza remove automaticamente classes de inspeção (`st-text-box`, `st-element-selected`, `st-drop-target`), mantendo a compatibilidade estrita do CEP e os testes 100% verdes.
- **Desacoplamento de Tokens de Botões:** Os botões da barra superior do Preset Builder (`.preset-icon-btn`) possuem tokens dedicados (`--tf-toolbar-icon-*`) totalmente separados do botão Fechar do rodapé (`--tf-btn-close-*`), impedindo contaminação de propriedades visuais entre topo e rodapé.
- **Prevenção de Ações e HMR em Modo Editar:** Todos os cliques no Modo Editar são interceptados na fase de captura para abrir o Inspector sem disparar ações da aplicação, e o HMR de HTML foi desativado nos previews para evitar que textos apaguem ou resetem durante a digitação.

---

## 5. Guardas de Segurança (`vite.config.js` & `npm test`)

Ao gravar alterações via `POST /api/studio/save`, o backend valida os IDs críticos conforme o `targetPanel`:
- **Painel Principal (`main`):** Valida os 13 IDs obrigatórios via `REQUIRED_PANEL_IDS`.
- **Preset Builder (`editor`):** Valida os 12 IDs essenciais da árvore e controles via `REQUIRED_EDITOR_IDS`.
- **Collect Files (`collect`):** Valida os 10 IDs essenciais do fluxo de coleta via `REQUIRED_COLLECT_IDS`.

Caso qualquer ID obrigatório esteja ausente, o salvamento é abortado imediatamente com erro 400 antes de escrever no disco, garantindo que `scripts/tests/client_refs_test.js` nunca quebre a suíte de testes do CEP.

