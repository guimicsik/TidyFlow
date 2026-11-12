# 05. Roadmap: Collect Files V2 (Evolução AE & Premiere)

Este documento define o plano técnico das próximas entregas do **Collect Files**, unificando a usabilidade do *Project Manager* do Premiere Pro com a árvore organizada em disco do TidyFlow.

---

> **Status:** Fases 1 a 4 concluídas e integradas com 103 testes passando (100% de cobertura e ES3 estrito).

---

## 1. Escopo e Decisão Arquitetural Concluída

- **Arquitetura de UI:** Painel único adaptativo (`com.tidyflow.collect`, 660×580 px) espelhando o *Project Manager* do Premiere Pro, com isolamento estrito via CSS (`body.is-ppro` vs `body.is-aeft`) e lógica dedicada em `client/collect.js`.
- **Propriedades Exclusivas por Programa (Sem botões mortos):**
  - **Premiere Pro:** Checkboxes de *Arquivos de Conformidade de Áudio* e *Arquivos de Preview* ativos e funcionais; *Obedecer Proxy* completamente oculto.
  - **After Effects:** *Obedecer configurações de proxy* ativo e funcional; opções de áudio/preview do Premiere completamente ocultas.
- **Fora de Escopo (Descartado):**
  - *Consolidate and Transcode* com Handles (reencode complexo e fora do propósito de organização não-destrutiva do TidyFlow).

---

## 2. Fases Implementadas

### Fase 1: Checklist Interativo de Sequências / Composições (AE + PPro) — CONCLUÍDO
- **Host (`aeft_collect.jsx` / `ppro_collect.jsx`):** Scan retorna `allSequences` e `allComps`, com suporte a filtro explícito `sequenceIds` e `compIds`.
- **UI (`collect.html` / `collect.css`):** Topo com lista rolável de checkboxes e atalhos rápidos `[Todas]` e `[Nenhuma]`.

### Fase 2: Renomear Mídias no Disco para o Nome do Clipe (AE + PPro) — CONCLUÍDO
- **Motor (`CollectEngine.js`):** Opção `renameToClipName` sanitiza `it.name`, preserva a extensão original e registra em `fileMap` e `fileCopies`, desambiguando colisões com `uniqueDestName`.

### Fase 3: Monitor de Espaço Disponível e Tamanhos (AE + PPro) — CONCLUÍDO
- **Cliente (`collect.js`):** Detecção automática de espaço em disco no drive de destino via `fs.statfs` com fallback PowerShell `Get-Volume`. Exibição de:
  - *Espaço em disco disponível:* (ex.: `691,02 GB`)
  - *Tamanho do projeto original:* tamanho do projeto e mídias
  - *Tamanho resultante estimado:* cálculo dinâmico não-bloqueante via `CollectEngine.createEstimator`.

### Fase 4: Previews de Render e Cache de Áudio (Exclusivo Premiere Pro) — CONCLUÍDO
- **UI & Cópia:** Opções exclusivas do Premiere que copiam recursivamente `Adobe Premiere Pro Video Previews`, `Adobe Premiere Pro Audio Previews` e `Media Cache` quando selecionadas pelo usuário.
- **Host (`ppro_collect.jsx`) & Motor (`CollectEngine.js`):**
  - Mapear pastas `Adobe Premiere Pro Video Previews` e `Adobe Premiere Pro Audio Previews` ao lado do `.prproj`, copiá-las para a raiz do Collect e atualizar `<VideoPreviewLocations>` / `<AudioPreviewLocations>` no XML do `.prproj`.

### Fase 5: Testes Automatizados (`scripts/tests/collect_test.js`)
- Adicionar testes unitários para `renameToClipName` (incluindo colisão de nomes de clipes idênticos de arquivos diferentes) e relink correspondente em `.aepx` e `.prproj`.

