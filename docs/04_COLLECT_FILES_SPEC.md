# 04. Especificação Técnica: Collect Files (AE & Premiere Pro)

> **Status:** Concluído e validado em produção no After Effects 26.5 (`.aepx`) e Premiere Pro 26.5.2 (`.prproj` gzip/XML).

---

## 1. Objetivo e Diferencial por Host

Gerar uma pasta autossuficiente (`<Projeto>_Collect/`) contendo:
1. Cópia do projeto (`.aep` ou `.prproj`) relinkada sem reinterpretação de mídias.
2. Pasta `(Footage)/` reproduzindo **exatamente a árvore de pastas/Bins do painel Project** (incluindo numeração `01_`, `02_` do TidyFlow).
3. `Report.txt` com resumo, fontes, efeitos e inventário de arquivos coletados/offline.

- **Por que no Premiere Pro é um diferencial crítico:** O *Project Manager* nativo do Premiere despeja todos os arquivos numa pasta plana quando há clipes dinâmicos/subclipes; o TidyFlow preserva 100% da hierarquia de Bins em pastas reais no disco.

---

## 2. Arquitetura em Camadas e Arquivos

| Camada / Arquivo | Funções‑Chave | Papel |
| :--- | :--- | :--- |
| **Host Scan** (`aeft_collect.jsx` L139 / `ppro_collect.jsx` L481) | `$.global.collectScan(optionsJson)` | Somente leitura (instantâneo). Retorna itens, cadeia `folders[]`, proxies, sequências de imagem, MOGRTs, fontes e efeitos. |
| **Motor Puro** (`client/CollectEngine.js`) | `planSources` (L96), `createEstimator` (L175), `buildCollectPlan` (L530), `rewriteAepxXml` (L323), `rewritePrprojXml` (L409), `buildReportText` (L660) | Sanitização, deduplicação, cálculo assíncrono em background, reescrita de XML e geração do relatório. |
| **Controlador CEP** (`client/collect.js`) | `runScan` (L119), `recomputeEstimate` (L225), `executeCollect` (L364), `copyNext` (L579), `finalizeProject` (L736) | UI adaptativa (`com.tidyflow.collect`), cópia assíncrona com stream/ETA, cancelamento imediato e limpeza de parciais. |
| **Host Finalize** (`aeft_collect.jsx` L291 / `ppro_collect.jsx` L789) | `$.global.collectSaveProject`, `collectSaveAepx` (AE), `collectFinalize` | Salva original, reabre cópia relinkada, restaura nomes (`item.id` / `nodeId`), executa `Reduce Project` e salva projeto final. |

---

## 3. Interface e Layout (estilo Project Manager)

A janela `com.tidyflow.collect` adota um layout em **dois blocos** e tem as seguintes características:
- **Dimensões otimizadas:** `600 × 750 px` (com largura e altura generosas e proporcionais para visualização confortável da árvore hierárquica de composições e leitura nítida das opções). O badge no canto inferior esquerdo exibe a resolução atual.
- **Bloco Superior (Sequências / Composições):**
  - Árvore hierárquica interativa espelhando exatamente as pastas e Bins do projeto (com ícones de pasta/comp, swatches de cor do After Effects e Premiere Pro, contagem de itens por pasta, chevrons de expandir/recolher e seleção em lote por pasta com suporte a estado indeterminado). Botões de ação rápida em ícones SVG neo-brutalistas: Marcar todas (Checkmark), Desmarcar todas (X), Expandir pastas (Chevron para baixo) e Recolher pastas (Chevron para cima).
  - Filtro por ID direto no scan do host (`sequenceIds` / `compIds`).
- **Coluna Esquerda:**
  - *Caminho de Destino:* Exibição de caminho direto com botão `[Procurar…]` (`showSaveDialogEx`).
  - *Espaço em Disco:* Espaço disponível na unidade de destino, tamanho do projeto original e tamanho resultante estimado em segundo plano.
  - **Nota:** O antigo painel *Projeto Resultante* foi removido, pois os recursos de Consolidar e Transcrever não são suportados pelo plugin.
- **Coluna Direita (Opções específicas por host):**
  - *Excluir clipes não usados e reduzir projeto (`#chkExcludeUnused`)* – coleta apenas mídias usadas nas sequências/comps marcadas e reduz o projeto coletado.
  - *Incluir arquivos de conformidade de áudio (`#chkAudioConform`)* – exclusivo Premiere Pro.
  - *Incluir arquivos de Preview (`#chkPreviewFiles`)* – exclusivo Premiere Pro.
  - *Renomear arquivos de mídia para o nome do clipe (`#chkRenameClipNames`)*.
  - *Obedecer configurações de proxy (`#chkObeyProxy`)* – exclusivo After Effects.
  - *Gerar apenas relatório (`#chkReportOnly`)*.
  - *Mostrar no Explorer ao terminar (`#chkReveal`)*.
  - *Abrir o projeto coletado ao terminar (`#chkOpenCollected`)* – chave deslizante (padrão desligada); ao finalizar a coleta com sucesso, fecha o projeto original e abre o projeto coletado, deixando‑o ativo no host.

---

## 4. Regras de Destino e Sanitização (`CollectEngine.js`)

1. **Sanitização (`sanitizeSegment`):** Cada caractere inválido (`/ \ : * ? " < > |`), espaço/ponto final ou nome reservado do Windows (`CON`, `PRN`, `AUX`, `NUL`, `COM1`…) vira `-` individualmente.
2. **Colisão de Nomes na Mesma Pasta (`uniqueDestName`):** Arquivos de origens diferentes com mesmo nome na mesma pasta recebem `_1`, `_2` antes da extensão (case‑insensitive). O mesmo arquivo físico usado em vários itens é copiado **apenas uma vez**.
3. **Sequências de Imagens:** Copiadas para uma subpasta com o nome‑base da sequência (sem numeração), mantendo o nome original de cada frame.
4. **Proxies:** Copiados na mesma pasta do arquivo original (ao lado dele). Com *Obedecer proxy* ativo no AE, coleta e relinka apenas o proxy.
5. **MOGRTs (Premiere Pro):** Inclui mídias descompactadas em `Motion Graphics Template Media` (`.aegraphic` e assets irmãos).
6. **Validação de Destino:** Recusa destinos que já contenham arquivos ou que estejam dentro de uma pasta de origem das mídias.

---

## 5. Relink via Reescrita XML (Zero Reinterpretação)

### 5.1 After Effects — `.aepx` (`rewriteAepxXml` L323)
1. O host salva uma cópia temporária em `%TEMP%\TidyFlow\collect_<ts>.aepx` (nunca na pasta de Collect).
2. O Node.js substitui `fullpath="..."` **apenas** em `<fileReference>` dentro de blocos `<Pin>` (ignorando `<LOm>` do Render Queue):
   - `target_is_folder="0"` → consulta `fileMap` (caminho antigo → novo).
   - `target_is_folder="1"` → consulta `folderMap` (pasta antiga da sequência → nova subpasta).
   - Remove atributos `ascendcount_base` e `ascendcount_target` (o AE recalcula caminhos relativos ao salvar o `.aep`).
   - Preserva escapes XML (`&amp;`, `&quot;`).
3. `aeft_collectFinalize` abre o `.aepx`, restaura `item.name` por `item.id` (caso algum arquivo tenha recebido `_1`), aplica `app.project.reduceProject(comps)` se ativo, salva como `.aep` na pasta de Collect e apaga o `.aepx` temporário.

### 5.2 Premiere Pro — `.prproj` gzip/XML (`rewritePrprojXml` L409)
1. O `.prproj` é um XML UTF‑8 compactado com gzip. O Node.js lê com `zlib.gunzipSync`, reescreve e grava na pasta de Collect com `zlib.gzipSync`.
2. Dentro de `<Media>…</Media>`: atualiza `<FilePath>`, `<ActualMediaFilePath>` e `<MediaFilePath>` via match exato normalizado (`canonPathKey`), preservando o estilo de separador (`\\` vs `/`), e recalcula `<RelativePath>` em relação à raiz do Collect.
3. Fora de `<Media>`: atualiza tags `*Path*` que tenham match exato em `fileMap`, ignorando tags de `output`, `export`, `preview`, `capture`, `scratch`, `autosave`.
4. `ppro_collectFinalize` salva e **fecha o projeto original** (`app.project.closeDocument(false, false)`) antes de `app.openDocument(destFs)` (evita conflito de mesmo `ObjectUID`), restaura nomes por `nodeId`, executa `reduceOpenPProProject` se ativo (usando `sequenceID`, bin temporária `__TIDYFLOW_COLLECT_REDUCE_TMP__` e `cleanEmptyBinsBottomUp`) e salva o `.prproj` final.

---

## 6. Matriz de Cancelamento e Rollback de Falhas

| Momento da Interrupção | Comportamento Garantido |
| :--- | :--- |
| **Durante a cópia física** | O projeto original segue aberto. O CEP apaga exclusivamente os arquivos/pastas registrados em `createdFiles`/`createdDirs`, remove `.collect_in_progress` e a pasta mãe. |
| **Na finalização (`.aepx` / `.prproj`)** | Botão Cancelar fica desabilitado durante a chamada síncrona do host. Se ocorrer erro no host, fecha a cópia sem salvar, reabre `origProjectPath` e limpa a pasta de Collect. |
| **Queda de energia / Crash** | Projeto original foi salvo no passo 3. Na próxima execução, o marcador `.collect_in_progress` permite identificar a coleta incompleta. |
