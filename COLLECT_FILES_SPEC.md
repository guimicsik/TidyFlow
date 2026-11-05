# Especificação Arquitetural e Lógica: Collect Files (TidyFlow)

Este documento detalha a arquitetura, as regras de negócio e o fluxo técnico da funcionalidade **Collect Files** do TidyFlow para **Adobe After Effects** e **Adobe Premiere Pro**.

> **Status:** Fase 0 concluída em 05/11/2026 (ver seção 12) — arquitetura de relink via `.aepx` validada no AE 26.5. Implementação ainda não iniciada.
> **Ordem de entrega:** After Effects primeiro (o Collect nativo serve de gabarito); Premiere Pro depois.

---

## 1. Visão Geral e Objetivo

Gerar uma pasta única e autossuficiente contendo:
1. Uma **cópia do projeto** (`.aep` / `.prproj`) com o mesmo nome do original.
2. **Todos os arquivos usados**, copiados para a pasta `(Footage)` **mantendo a estrutura de pastas do painel Project**.
3. **Relink completo**: a cópia do projeto aponta apenas para os arquivos dentro da pasta coletada, **mantendo todas as propriedades** (alpha, fps, loop, camadas de PSD/AI, proxies).
4. Um **`Report.txt`** com inventário de mídias, fontes e efeitos.

**Paridade e diferencial por host:**
- **After Effects:** o Collect nativo já espelha a estrutura de pastas do projeto. O Collect do TidyFlow reproduz esse comportamento — como o TidyFlow organiza o painel Project (*Organizar Projeto*), o resultado em disco acompanha o preset (inclusive prefixos `01_`, `02_`).
- **Premiere Pro:** o *Project Manager* nativo joga todos os arquivos numa pasta plana. O TidyFlow converte a hierarquia de **Bins** em pastas reais. **Este é o ganho real da funcionalidade.**

---

## 2. Interface do Usuário (UI / Modal)

Espelha o diálogo clássico *Collect Files* do After Effects.

### Controles
* **Collect Source Files (Dropdown):**
  - `All`: todas as mídias do projeto.
  - `For All Comps / Sequences`: apenas mídias usadas em alguma comp/sequência.
  - `For Selected Comps / Sequences`: apenas mídias usadas pelas selecionadas.
  - `None (Project Only)`: só salva a cópia do projeto, sem copiar mídias.
  - *(`For Queued Comps` do AE fica fora do escopo.)*
* **Checkboxes:**
  - `[ ] Generate Report Only`: não copia nem cria projeto; só gera `Report.txt`.
  - `[ ] Obey Proxy Settings`: identifica os itens que têm proxy e coleta/relinka **apenas o proxy** desses itens (ver 6.4).
  - `[ ] Reduce Project`: remove itens não usados da cópia antes de salvar.
  - `[x] Reveal collected project in Explorer when finished`.
* **Fora do escopo:** `Change render output to…`, `Enable 'Watch Folder' render` e `Maximum Number of Machines` (recursos de render farm).
* **Regras de habilitação:** `Tudo` e `Nenhum` desabilitam *Obedecer proxy* e *Reduzir projeto*; os modos por comp habilitam; `Gerar apenas relatório` desabilita *Reduzir projeto*. `Para as comps na fila` e as opções de render farm aparecem desabilitadas, como no diálogo nativo.
* **Nome da pasta de Collect:** escolhido pelo usuário no diálogo de Salvar (padrão: `<NomeDoProjeto>_Collect`).

### Rodapé informativo (cálculo em segundo plano não-bloqueante)
Ao abrir a janela ou mudar de modo, o painel inicia um cálculo assíncrono em segundo plano:
> **"X file(s) (Y GB) will be collected. Z effect(s) are used."**

**Desacoplamento e Execução Imediata:**
- O cálculo em segundo plano varre frames de sequências de imagem e afere o tamanho (`fs.stat`) de cada arquivo no disco.
- **O usuário NÃO precisa esperar esse cálculo terminar para coletar.** O botão **Coletar...** fica liberado imediatamente após o scan inicial do host (que lê a memória do projeto em milissegundos).
- Se o usuário clicar em **Coletar...** enquanto o rodapé ainda estiver calculando:
  1. A estimativa prévia é **abortada imediatamente** (`estimator.cancel()`) para não sobrecarregar o I/O do disco com leituras desnecessárias.
  2. O fluxo de Collect inicia direto com a lista de itens mapeada pelo host (`scan.items`).
  3. A contagem de bytes e progresso é acumulada dinamicamente durante a cópia física (streaming).
  4. Se a estimativa já tiver sido concluída antes do clique, o espaço livre no destino é validado previamente; se o usuário disparou a coleta durante o cálculo, o espaço em disco é acompanhado durante a escrita.

---

## 3. Fluxo Geral (After Effects)

```
1. Scan (somente leitura no host) → lista de mídias, proxies e caminhos virtuais (instantâneo)
   * Estimativa em segundo plano: informativa no rodapé (cancelada se usuário iniciar Coletar antes)
2. Validações                    → destino vazio/novo, destino fora da origem, espaço em disco
3. Salvar o projeto original     → ponto de retorno
4. Criar pasta mãe + (Footage)   → marcador .collect_in_progress
5. Copiar arquivos (Node)        → estrutura espelhada, progresso acumulado, cancelável
6. Save As da cópia em .aepx     → gravado em %TEMP%\TidyFlow (nunca na pasta de Collect)
7. Reescrita dos caminhos (Node) → fileReference de footage trocados no texto do .aepx
8. Fechar e reabrir o .aepx      → AE encontra os arquivos no novo local, sem reinterpretar
9. Ajustes no host               → restaurar nomes de itens, Reduce Project (se ligado)
10. Salvar como .aep + Report    → apagar .aepx e marcador .collect_in_progress
11. A cópia permanece aberta     → o usuário confirma se está tudo certo
```

Como o After Effects mantém **um projeto aberto por vez**, o original é salvo antes e a cópia fica aberta para conferência ao final.

---

## 4. Descoberta e Mapeamento de Dependências

### Arquitetura em camadas
O ExtendScript é síncrono e trava o host; por isso o trabalho é dividido:

| Camada | Responsabilidade |
| :--- | :--- |
| **Host** `collectScan` | Leitura do projeto (sem alterar nada); devolve JSON |
| **CEP / Node** | Cálculo de destino, cópia assíncrona, progresso, **reescrita do `.aepx`**, limpeza, relatório |
| **Host** `collectSaveXml` | Salva o original e a cópia em `.aepx` |
| **Host** `collectFinalize` | Fecha e reabre o `.aepx`, restaura nomes, reduce, salva como `.aep` |

Arquivos previstos: `host/aeft_collect.jsx`, `host/ppro_collect.jsx`, `client/CollectEngine.js` (lógica pura, testável em Node). Os globais `$.global.collectScan` / `$.global.collectSaveXml` / `$.global.collectFinalize` são roteados por `host/organizer.jsx`, com retorno JSON padronizado (`success`, `collectedCount`, `totalBytes`, `offlineCount`, `relinkedCount`, `failedRelinks`, `projectPath`, `error`).

### 4.1 After Effects
- **All:** todos os `FootageItem` com `file != null`.
- **For All / Selected Comps:** percorre `comp.layers`; recursão em pré-comps (`source instanceof CompItem`); extrai `FootageItem` com arquivo.
- Caminho virtual: sobe `parentFolder` até `app.project.rootFolder`.
- Deduplicação por `file.fsName` (várias camadas de um PSD apontam para o mesmo arquivo; o arquivo é copiado **uma vez** e todos os itens são relinkados para ele).
- Mídia offline (`footageMissing`) é registrada e vai para o Report.
- Proxy: lê `proxySource` e `useProxy` de cada item.
- Efeitos: coleta `matchName` para o contador e para o Report.

### 4.2 Premiere Pro *(fase posterior)*
Sequências → `videoTracks` / `audioTracks` → `clip.projectItem` → recursão em sequências aninhadas; caminho virtual subindo `parent` até `rootItem`; arquivo por `getMediaPath()`; proxy por `hasProxy()` / `getProxyPath()`.

---

## 5. Regras de Destino (Espelhamento de Estrutura)

Validadas contra o Collect nativo do After Effects.

1. **Estrutura:** a árvore em `(Footage)` segue **exatamente** a árvore do painel Project.
2. **Nomes inválidos no disco:** **cada** caractere inválido é trocado por `-`, sem agrupar.
   `//Footages//` → `--Footages--`.
   Caracteres: `/ \ : * ? " < > |`. Casos especiais seguem a mesma regra do traço: ponto ou espaço no fim do nome vira `-`. Nome reservado do Windows (`CON`, `PRN`, `AUX`, `NUL`, `COM1`…) recebe `-` no fim.
3. **Arquivos diferentes com o mesmo nome na mesma pasta:** sufixo `_1`, `_2`… **antes da extensão**, como o Windows faz.
   `Film_16x9_10s.mp4` e `Film_16x9_10s_1.mp4`. A comparação ignora maiúsculas/minúsculas.
4. **Mesmo arquivo usado em vários lugares:** copiado uma vez só.
5. **Sequências de imagens:** todos os frames são copiados para uma subpasta com o **nome da sequência, sem a numeração**, dentro da pasta correspondente do projeto. Os arquivos mantêm o nome original (`[nome][numeração].[ext]`). O nome-base sai da remoção da extensão e do sufixo numérico, com separadores `_`, `-`, `.` ou espaço; sem nome-base (ex.: `0001.png`) usa o nome da pasta de origem. *(Decisão de projeto: o comportamento exato do nativo não foi testado; a subpasta evita misturar milhares de frames com outros arquivos.)*
6. **Proxies (regra atual — igual ao AE):** o proxy é copiado **ao lado do arquivo original**, na mesma pasta, sem subpasta. Mesmas regras de nomes inválidos e de duplicados. Se o proxy tiver o mesmo nome e extensão de outro arquivo da pasta, vale o sufixo `_1`.
   *Evolução futura (fora do escopo agora): opção de agrupar proxies em uma subpasta `Proxy` junto do original.*
7. **Destino:** não pode estar dentro da pasta de origem dos arquivos; se já existir com conteúdo, o Collect é recusado.

---

## 6. Cópia Física (CEP / Node.js)

1. Cria a árvore com `fs.mkdirSync({ recursive: true })` e grava `.collect_in_progress` na pasta mãe.
2. **Fila assíncrona** com barra de progresso: porcentagem, arquivo atual e volume (`4.2 GB de 12.8 GB`). Arquivos pequenos por `fs.copyFile`; grandes por stream (progresso por pedaço).
3. **Integridade:** após cada arquivo, compara o tamanho em bytes com o original.
4. **Registro de tudo que foi criado** (arquivos e pastas), usado na limpeza.

### 6.4 Obey Proxy Settings
Com a opção ligada, o Collect identifica os itens que têm proxy e relinka **apenas o proxy** deles; os demais itens seguem o fluxo normal. Com a opção desligada, original e proxy são coletados e relinkados (seção 5.6).

---

## 7. Cancelamento e Falhas

**Regra única:** qualquer cancelamento ou erro devolve o usuário ao projeto original, **sem sobras no disco**. O usuário recebe o aviso e continua no projeto original.

| Momento | O que acontece |
| :--- | :--- |
| **Durante a cópia** (passo 5) | O original continua aberto. O CEP apaga **somente o que registrou ter criado** (arquivos, depois pastas vazias, depois a pasta mãe) e mostra o aviso |
| **Depois do Save As em `.aepx`** (passos 6–10) | O host fecha a cópia **sem salvar**, reabre o original, o CEP apaga a pasta mãe criada e mostra o erro |
| **Cancelar na finalização** | O ExtendScript não é interrompível: o botão **Cancelar fica desabilitado** a partir do passo 6 ("Finalizando projeto…") |
| **Queda do host / do computador** | O original está salvo e intacto. Fica um `.collect_in_progress` na pasta; na próxima execução o TidyFlow avisa e oferece limpar |

Segurança: nunca apagar nada que não esteja no registro de criação; destino pré-existente com conteúdo é recusado antes de começar (regra de ações destrutivas do `AGENTS.md`).

---

## 8. Relink Automático

### 8.1 After Effects — reescrita do `.aepx` (validada na Fase 0)

**Não usar `item.replace()` / `replaceWithSequence()`:** a Fase 0 mostrou que eles achatam camadas de PSD/PSB/AI (o item vira o arquivo inteiro), perdem o alpha, renomeiam itens e resetam o fps do proxy.

O relink é feito trocando os caminhos no XML do projeto. O AE apenas encontra os arquivos em outro lugar, sem reinterpretar nada.

**Formato no `.aepx`** (observado no AE 26.5):
```xml
<!-- Arquivo comum, PSD/AI em camadas e proxy: um por item -->
<Pin> ... <Als2>
  <fileReference fullpath="I:\...\arquivo.psb" platform="Win" server_name="..." server_volume_name="..." target_is_folder="0"/>
</Als2>

<!-- Sequência de imagens: PASTA + nome-base + extensão -->
<Pin> ... <Als2>
  <fileReference ascendcount_base="2" ascendcount_target="3" fullpath="C:\...\Comp 1" ... target_is_folder="1"/>
</Als2>
<string>SequenciaBolinhaAiAiaAi_</string>
<string>.png</string>

<!-- Caminho de saída do Render Queue: NÃO é mídia, não trocar -->
<LOm> ... <Als2><fileReference fullpath="C:\...\saida" target_is_folder="1"/></Als2>
```

**Regras da reescrita:**
1. Trocar apenas `fileReference` dentro de `<Pin>` (fonte de footage original ou proxy); `<LOm>` (Render Queue) fica intocado.
2. Correspondência **exata** do `fullpath` (sem diferenciar maiúsculas), nunca por substring — uma pasta pode ser prefixo de outros caminhos.
3. `target_is_folder="0"` → mapa de arquivos (antigo → novo). `target_is_folder="1"` → mapa de pastas de sequência (pasta antiga → subpasta nova da sequência). O nome-base e a extensão não mudam, pois os frames mantêm o nome.
4. Remover `ascendcount_base` / `ascendcount_target` das referências trocadas (dica de caminho relativo calculada para o local antigo). Ao salvar o `.aep`, o AE recalcula — a portabilidade foi confirmada.
5. Valores de atributo com escape XML (`&amp;`, `&quot;`…) são decodificados para comparar e codificados ao gravar.
6. Todo `fileReference` de footage sem mapeamento é reportado (indica arquivo não coletado).

**`.aepx` intermediário:** é gravado na pasta temporária do sistema (`%TEMP%\TidyFlow\collect_<timestamp>.aepx`), nunca na pasta de Collect, e apagado logo após o *Save As* em `.aep` (quando deixa de ser o projeto aberto). Em cancelamento ou falha, é apagado depois que o original for reaberto. Sobras de execuções interrompidas em `%TEMP%\TidyFlow` são limpas na próxima execução. O local do `.aepx` não afeta o resultado: os caminhos são absolutos e o AE recalcula os relativos ao salvar o `.aep` na pasta de Collect.

**Ajustes no host após reabrir:**
- **Nome do item:** quando o arquivo ganhou sufixo `_1` no disco e o item não tinha nome personalizado, o AE passa a mostrar o novo nome. Restaurar com `item.name = nomeOriginal` (IDs de item são preservados no `.aepx`, então o mapeamento é por `item.id`).
- **Obey Proxy Settings:** só os caminhos de proxy entram no mapa; o original dos itens com proxy não é coletado.
- **Reduce Project:** `app.project.reduceProject(comps)` no projeto reaberto, com as comps localizadas por `id`.

### 8.2 Premiere Pro *(posterior)*
`changeMediaPath(novoCaminho, true)` e `attachProxy(novoCaminho, 0)` — precisam de Fase 0 própria. O `.prproj` é XML compactado com gzip, então a reescrita direta de caminhos é a alternativa caso a API não preserve as propriedades.

### 8.3 Critério de aceite
O projeto coletado deve ficar **idêntico** ao original (alpha, fps, loop, escolha de camada em PSD/AI, estado de proxy, nomes dos itens) e abrir sem mídia faltando depois que a pasta de Collect for movida ou renomeada.

---

## 9. Relatório Técnico (`Report.txt`)

Gravado na raiz da pasta coletada:

```text
======================================================================
TIDYFLOW - RELATÓRIO DE COLLECT DE PROJETO
======================================================================
Data da Coleta:     2026-11-04 16:50:00
Aplicativo Host:    Adobe After Effects 2026 (v25.0)
Projeto de Origem:  D:\Projetos\Campanha\Comercial_V03.aep
Destino do Collect: E:\Entregas\Collect_Comercial_V03\
Modo de Coleta:     For Selected Comps (Reduce Project: Sim)

----------------------------------------------------------------------
1. RESUMO GERAL
----------------------------------------------------------------------
Arquivos Coletados: 24 arquivo(s)
Tamanho Total:      8.52 GB
Mídias Offline:     0
Proxies Coletados:  3

----------------------------------------------------------------------
2. FONTES TIPOGRÁFICAS UTILIZADAS
----------------------------------------------------------------------
- Montserrat (Bold)

----------------------------------------------------------------------
3. EFEITOS E PLUGINS UTILIZADOS
----------------------------------------------------------------------
- ADBE Fast Blur (Nativo)
- S_Glow (Terceiros)

----------------------------------------------------------------------
4. INVENTÁRIO DE ARQUIVOS COLETADOS
----------------------------------------------------------------------
[OK] (Footage)/02_Assets/03_Footages/MP4/trilha_final.wav (45.2 MB)
[OK] (Footage)/02_Assets/03_Footages/MP4/cam_a.mp4 (3.21 GB)
[OK] (Footage)/02_Assets/03_Footages/MP4/cam_a.avi (proxy)

----------------------------------------------------------------------
5. AVISOS
----------------------------------------------------------------------
- Fontes listadas mas não copiadas
```

**Limites conhecidos (vão para a seção AVISOS):** fontes só são listadas; texturas de C4D/OBJ, LUTs em parâmetros de efeito, comps referenciadas apenas por expressão e caches de plugins não são detectados (o Collect nativo também não os cobre). No Premiere não há API confiável para fontes de Essential Graphics.

---

## 10. Estrutura Resultante no Disco (After Effects)

```text
E:\Entregas\Collect_Comercial_V03/
├── Comercial_V03.aep                 <-- Cópia relinkada (e reduzida, se ligado)
├── Report.txt
└── (Footage)/
    └── 02_Assets/                    <-- Mesma estrutura do painel Project
        └── 03_Footages/
            └── MP4/
                ├── cam_a.mp4
                ├── cam_a.avi         <-- Proxy ao lado do original
                ├── cam_b.mp4
                └── cam_b_1.mp4       <-- Nome duplicado
```

---

## 11. Plano de Fases

| Fase | Entrega |
| :--- | :--- |
| **0** | ✅ Concluída — validação de relink via `.aepx` no AE 26.5 (ver seção 12) |
| **1** | ✅ `collectScan` (AE, `host/aeft_collect.jsx`) + contador do rodapé (`CollectEngine.js`) |
| **2** | ✅ `CollectEngine.js`: plano de destino (sanitização, duplicados, espelhamento) e reescrita do `.aepx` (`rewriteAepxXml`) |
| **3** | ✅ Janela própria `com.tidyflow.collect` (*Modeless* 390×460), aberta pelo botão do painel |
| **4** | ✅ Seleção de pasta de destino, cópia física assíncrona com progresso e cancelamento |
| **5** | ✅ Host AE (`aeft_collect.jsx` / `organizer.jsx`): `collectSaveProject`, `collectSaveAepx`, reabertura, restauração de nomes, `reduceProject` e salvamento final como `.aep` |
| **6** | ✅ Geração do `Report.txt` e reveal da pasta no sistema operacional |
| **7** | ✅ Testes automatizados (`scripts/tests/collect_test.js`: 22 casos) e atualização do `MANIFESTO_MESTRE.md` |
| **8** | Premiere Pro (`ppro_collect.jsx`), com Fase 0 própria |

---

## 12. Resultado da Fase 0 (05/11/2026, AE 26.5)

Projeto de teste com 25 footages: vídeos MP4 (um com proxy AVI, dois arquivos diferentes com o mesmo nome), AI e PSB importados em camadas (22 itens de camada) e uma sequência PNG com alpha (201 frames). Scripts em `scripts/tests/phase0/`.

| Teste | Script | Resultado |
| :--- | :--- | :--- |
| Relink por `replace()` | `collect_relink_probe.jsx` | ❌ 1/24 idêntico. Camadas de PSB/AI achatadas e sem alpha, item renomeado, fps do proxy resetado |
| Relink via `.aepx` | `collect_aepx_probe.jsx` | ✅ **25/25 idênticos**, 26 `fileReference` trocados, Render Queue intacto, IDs preservados, ~34 s (cópia em ExtendScript) |
| Portabilidade | manual | ✅ Pasta copiada para outro HD e `.aep` renomeado: abriu sem mídia faltando |

**Observações para a implementação:**
- O teste copiou os arquivos em ExtendScript (trava o AE, sem progresso real). Na implementação a cópia e a reescrita ficam no Node (seção 6).
- O primeiro teste com `replace()` chegou a derrubar o AE uma vez; o caminho via `.aepx` não usa essas chamadas.
- Ainda não testados: vídeo com *Interpret Footage* alterado (fps/loop) — esperado preservar, já que o `.aepx` não é reinterpretado — e caminhos com caracteres que exigem escape XML (`&`).
