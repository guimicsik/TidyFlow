# 01. Roadmap Detalhado: Compactação Automática em `.ZIP` no Collect Files

> **Escopo:** After Effects + Premiere Pro (`com.tidyflow.collect`)
> **Impacto na UI:** 1 checkbox na janela de Collect (`#chkZipCollect`)
> **Impacto no Painel Principal:** Zero

---

## 1. Objetivo e Fluxo do Usuário

Permitir que o usuário marque `[ ] Compactar pasta em .ZIP ao terminar` na janela do **Collect Files**.
Ao finalizar a cópia das mídias, o relink do `.aep`/`.prproj` e a gravação do `Report.txt`, o TidyFlow gera automaticamente `<NomeDaPasta>_Collect.zip` ao lado da pasta coletada, pronto para envio via Google Drive, Frame.io ou WeTransfer.

---

## 2. Arquitetura Técnica (Por que não trava o Host)

- **Proibido compactar via ExtendScript:** O ExtendScript é single-threaded e travaria o After Effects / Premiere Pro.
- **Execução 100% em Node.js (`child_process.spawn`):**
  - No Windows 10/11 (build 17063+) e no macOS, o binário nativo do sistema `tar` (`C:\Windows\System32\tar.exe` / `/usr/bin/tar`, baseado em `libarchive`) suporta criação nativa de arquivos `.zip` (incluindo **ZIP64** para projetos maiores que `4 GB`) usando a flag `-a -c -f`.
  - **Vantagem:** Zero dependências externas no `package.json`, velocidade nativa em C++ multi-thread do sistema operacional e suporte automático a arquivos gigantes de vídeo.

---

## 3. Passo a Passo de Implementação

### Fase 1.1 — Interface e Regras de Habilitação
**Arquivos afetados:**
- [`client/collect.html`](../../client/collect.html) (após `#chkReveal`, ~L56)
- [`client/collect.js`](../../client/collect.js) (`applyModeRules` L87, `effectiveOptions` L93)

**Tarefas:**
1. Inserir o controle em `client/collect.html`:
   ```html
   <label class="collect-check" id="rowZipCollect">
     <input type="checkbox" id="chkZipCollect">
     <span>Compactar pasta em .ZIP ao terminar</span>
   </label>
   ```
2. Em `applyModeRules()` (`client/collect.js`):
   - Desabilitar `#chkZipCollect` quando `chkReportOnly.checked === true` (não faz sentido zipar apenas um `Report.txt`).
3. Em `effectiveOptions()`:
   - Expor `zipCollect: !chkZipCollect.disabled && chkZipCollect.checked`.

---

### Fase 1.2 — Cálculo de Espaço e Estimativa
**Arquivos afetados:**
- [`client/CollectEngine.js`](../../client/CollectEngine.js)
- [`client/collect.js`](../../client/collect.js)

**Tarefas:**
1. Como os arquivos de vídeo (`.mp4`, `.mov`, `.mxf`) já são comprimidos, a taxa de compressão adicional em `.zip` é baixa (~0% a 5%).
2. Durante a validação de espaço em disco no volume de destino:
   - Se `opts.zipCollect === false`: espaço requerido = `est.totalBytes`.
   - Se `opts.zipCollect === true`: espaço requerido = `est.totalBytes * 2` (pois a pasta `<Projeto>_Collect/` e o arquivo `<Projeto>_Collect.zip` coexistirão no disco).

---

### Fase 1.3 — Pipeline de Compactação Assíncrona e Cancelamento
**Arquivos afetados:**
- [`client/collect.js`](../../client/collect.js) (`completeCollectSuccess` L655, `btnCancel` L908)

**Tarefas:**
1. Criar helper `createZipArchiveAsync(sourceFolderPath, destZipPath, onProgress, callback)` em `client/collect.js`:
   - Usa `child_process.spawn("tar", ["-a", "-c", "-f", destZipWin, "-C", parentDirWin, folderBaseName])`.
   - Enquanto o processo roda, monitora o tamanho atual de `destZipPath` a cada `400 ms` via `fs.stat` e calcula a porcentagem em relação a `totalBytesCopied`:
     - Atualiza `#collectProgressBar`, `#collectPercent` e `#collectEta` (`"Compactando .ZIP (45%)..."`).
2. **Ordem exata de execução:**
   - A compactação **só inicia depois** que `collectFinalize` salvou o `.aep`/`.prproj` final, gravou o `Report.txt` e removeu o marcador `.collect_in_progress` (assim o `.collect_in_progress` não entra dentro do `.zip` e o arquivo de projeto não está em escrita).
3. **Cancelamento durante o `.ZIP`:**
   - Durante a fase de `.ZIP`, reabilitar o botão `Cancelar`.
   - Se o usuário clicar em `Cancelar` (ou pressionar `Esc`) durante a compactação:
     - Matar o processo `tar` (`proc.kill()`).
     - Apagar o arquivo `<Projeto>_Collect.zip` incompleto (`fs.unlinkSync(destZipPath)`).
     - **Manter a pasta `<Projeto>_Collect/` intacta** (pois a coleta em si já foi concluída com sucesso) e avisar na linha de status: `"Coleta concluída (compactação .ZIP cancelada pelo usuário)."`.

---

## 4. Casos de Borda e Testes (`scripts/tests/collect_test.js`)

1. **Projetos > 4 GB (ZIP64):** O `libarchive` do `tar.exe` ativa extensões ZIP64 automaticamente quando o volume passa de 4 GB.
2. **Caminhos com espaços e acentos:** Passar argumentos como array no `child_process.spawn` (sem interpolação de shell) evita qualquer quebra com espaços, `&` ou parênteses como `(Footage)`.
3. **Testes Automatizados:**
   - Verificar presença de `rowZipCollect` e `chkZipCollect` no teste de IDs de DOM (`collect_test.js` L274).
   - Testar helper de comando/caminho do `.zip` e cálculo de espaço duplo.
