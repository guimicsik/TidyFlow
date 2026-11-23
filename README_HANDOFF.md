# TidyFlow — Guia de Instalação e Integração (Handoff)

O **TidyFlow** é uma extensão CEP unificada para **Adobe After Effects (`16.0+`)** e **Adobe Premiere Pro (`22.0+`)** com dois motores principais:

1. **Organizador de Projeto por Presets e Regras** — organiza composições/sequências, pré-comps, mídias, bundles PSD/AI, pastas de origem (`both`/`project`/`disk`/`off`), filtros por nomenclatura, triagem automática de áudio por papel/Essential Sound no Premiere Pro, verificação de itens não usados e **Snapshot/Rollback** completo.
2. **Collect Files** — escaneamento de dependências, estimativa de tamanho, cópia com preservação de estrutura, suporte a proxies e MOGRTs, reescrita segura de `.aepx` (After Effects) e `.prproj` gzip (Premiere Pro) e geração de `Report.txt`.

> **Ponto de entrada da documentação técnica:** leia [MANIFESTO_MESTRE.md](MANIFESTO_MESTRE.md) e [AGENTS.md](AGENTS.md). Se você usar agente de IA neste repositório, aponte-o primeiro para esses dois arquivos — a pasta `docs/` está modularizada por assunto e [docs/01_ARQUITETURA_E_HOSTS.md](docs/01_ARQUITETURA_E_HOSTS.md) mapeia cada função por arquivo e linha.

---

## 1. Instalação Rápida no Windows (After Effects & Premiere Pro)

### Modo Desenvolvimento (recomendado para testar e integrar)
1. Clone ou extraia este repositório em uma pasta fixa (ex.: `C:\Projetos\TidyFlow`).
2. Dê duplo clique em **`scripts\install_symlink.bat`** (ou execute no PowerShell):
   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\setup_dev.ps1
   ```
   * Não exige permissão de Administrador.
   * Habilita `PlayerDebugMode = "1"` em `HKCU\Software\Adobe\CSXS.9` até `CSXS.16`.
   * Cria uma *Directory Junction* em `%APPDATA%\Adobe\CEP\extensions\TidyFlow` apontando direto para a raiz do projeto.
   * *Se mover a pasta do projeto no futuro, rode o `.bat` novamente.*
3. Feche e reabra o After Effects ou Premiere Pro.
4. Abra o painel em **`Janela > Extensões > TidyFlow`** (*`Window > Extensions > TidyFlow`*).
   * **Recarregar código ao vivo:** com o painel focado, pressione `Ctrl+R` ou `F5` (recarrega UI + scripts `.jsx` do host).
   * **DevTools (Chrome/Edge):** `http://localhost:8089` (AE painel), `8090` (AE editor), `8091` (Premiere painel), `8092` (Premiere editor) — configurado em `.debug`.

### Testes Automatizados (Node.js)
Não precisa abrir o After Effects nem o Premiere para validar alterações nos motores e regras:
```powershell
npm install
npm test
```
* Para abrir o editor visual de tokens/layout em localhost: `npm run studio`.
* Para gerar um instalador standalone em `dist/v1/TidyFlow_v1.0.0_Installer.zip`: `npm run package:v1`.
* **Atenção:** não mantenha simultaneamente `%APPDATA%\Adobe\CEP\extensions\TidyFlow` (dev) e `%APPDATA%\Adobe\CEP\extensions\com.tidyflow` (instalador standalone), pois ambos usam o mesmo `ExtensionBundleId` (`com.tidyflow`).

---

## 2. Como Integrar Dentro de Outra Ferramenta

A arquitetura separa **motor de host (`host/*.jsx`)**, **motor puro de Collect (`client/CollectEngine.js`)**, **gerenciador de presets (`client/PresetManager.js`)** e **interface (`client/*.html/.css/.js`)**. Você pode incorporar apenas os módulos de que precisa.

### Opção A — Motor "Headless" (recomendado quando você já tem a própria UI)

#### 1. Motor de Organização (AE + Premiere Pro)
Copie os 5 arquivos abaixo para uma subpasta da sua ferramenta (por exemplo `host/tidyflow/`):
* `host/_lib.jsx` — helpers ES3 compartilhados (`$.global.OrgLib`)
* `host/_rules.jsx` — motor de classificação por pontuação (`$.global.OrgRules`)
* `host/organizer.jsx` — roteador agnóstico que detecta `AEFT` vs `PPRO`
* `host/aeft_organizer.jsx` — implementação After Effects
* `host/ppro_organizer.jsx` — implementação Premiere Pro (inclui triagem de áudio ESP/XMP)

**Inicialização (a partir do seu painel CEP):**
```javascript
var extPath = csInterface.getSystemPath(SystemPath.EXTENSION);
var hostDir = (extPath + "/host/tidyflow").replace(/\\/g, "/");
var bootstrap =
  'var f = new File("' + hostDir + '/organizer.jsx"); ' +
  'f.encoding = "UTF-8"; ' +
  '$.evalFile(f); ' +
  '$.global.organizerLoadEngine("' + hostDir + '");';

csInterface.evalScript(bootstrap, function (hostId) {
  // hostId === "AEFT" ou "PPRO"
});
```

**Contrato de chamadas (`$.global.*`):** todas retornam uma string JSON padronizada `{ "success": true|false, ..., "error": "..." }`:

| Chamada ExtendScript | Uso |
| :--- | :--- |
| `$.global.organizeWithPreset(mode, presetJson)` | `mode`: `"selection"` (usa comps/sequências selecionadas) ou `"media_only"` (organiza só mídias). |
| `$.global.createPresetFolderStructure(presetJson)` | Cria fisicamente a árvore vazia de pastas/bins com Color Labels do preset. |
| `$.global.checkUnusedComps(presetJson)` | Move comps/sequências e mídias fora da saída para a pasta `unusedFolderName`. |
| `$.global.getRollbackSnapshotJson()` | Retorna o JSON do snapshot capturado antes da organização (salve em `localStorage` ou arquivo se quiser persistir entre sessões). |
| `$.global.rollbackProject(saveBefore, snapshotJson)` | Reverte o projeto exatamente para a hierarquia anterior. |

* **Schema de `presetJson`:** veja o exemplo real em `client/presets/default_preset.json` e a especificação completa das regras e prioridades de pontuação em `docs/02_PRESETS_REGRAS_E_AUDIO.md`.
* **Dica para workflows específicos:** o campo `rules.nameFilter` tem **prioridade máxima** no classificador (`score 1000+`), sobrepondo tipo e extensão — ideal para rotear itens por convenção de nomes da equipe (`broll`, `logo`, `camA`, `gc_`, etc.).

#### 2. Motor de Collect Files (`.aepx` e `.prproj`)
* **Lógica pura (Node.js / JS sem CEP nem DOM):** `client/CollectEngine.js`
  * Expõe planejamento de cópias (`planSources`, `buildCollectPlan`), estimador cancelável (`createEstimator`), reescrita XML de projetos (`rewriteAepxXml`, `rewritePrprojXml` com gzip/`zlib`) e `buildReportText`.
  * Pode ser testado e usado direto em Node.js (`scripts/tests/collect_engine_test.js` mostra exemplos prontos de uso).
* **Ponte no host Adobe:** copie também `host/aeft_collect.jsx` e `host/ppro_collect.jsx` na mesma pasta de `organizer.jsx` — o `organizerLoadEngine()` carrega automaticamente e expõe:
  * `$.global.collectScan(optionsJson)`
  * `$.global.collectSaveProject()` / `$.global.collectSaveAepx(aepxPath)`
  * `$.global.collectFinalize(optionsJson)`
* Especificação detalhada em `docs/04_COLLECT_FILES_SPEC.md`.

#### 3. Dicionários e Persistência de Presets (opcional)
* `client/PresetManager.js` concentra os dicionários de extensões e Color Labels específicos de **After Effects** e **Premiere Pro**, normalização de schema (`normalizePreset`) e leitura/escrita de JSON em `%APPDATA%/TidyFlow/presets`.
* Caso sua ferramenta use armazenamento próprio (banco local, nuvem ou config da empresa), você pode reaproveitar os dicionários e `normalizePreset` ou alterar o caminho em `getPresetsFolderPath()`.

---

### Opção B — Embutir Telas do TidyFlow (Preset Builder / Collect) em Outro CEP
Se a sua ferramenta também for uma extensão CEP e você quiser embutir as telas:
* **Preset Builder:** `client/tree_editor.html`, `client/tree_editor.js`, `client/tree_editor.css` + `client/theme.css` (`client/theme/*`).
* **Collect Files:** `client/collect.html`, `client/collect.js`, `client/collect.css`, `client/CollectEngine.js`.

**Checklist de isolamento ao mesclar em outra extensão CEP:**
1. **Manifesto (`CSXS/manifest.xml`):** renomeie os `Extension Id` para o namespace da sua ferramenta e mantenha `--enable-nodejs` e `--mixed-context` no `<CEFCommandLine>`.
2. **Storage e eventos:** revise as chaves `ae_organizer_*` (`PresetManager.STORAGE_KEYS`), o evento CEP `com.tidyflow.presetsUpdated` e a pasta `%APPDATA%/TidyFlow/presets` caso queira isolar totalmente os dados.
3. **Colisões em `$.global`:** confirme se o seu host já não usa os nomes `OrgLib`, `OrgRules`, `organizeWithPreset`, `rollbackProject`, `collectScan` etc.
4. **Utilitários dispensáveis:** se você não precisar forçar travamento de tamanho de janela flutuante via Win32, **não precisa levar** `scripts/resize_window.ps1`, `scripts/TidyFlowWinApi.dll` nem as chamadas `lockMainFloatingWindow` / `triggerCollectWindowResize` / `triggerWin32Resize`.

### Compatibilidade por Tecnologia
| Arquitetura da ferramenta destino | O que reaproveita direto |
| :--- | :--- |
| **Painel CEP (After Effects / Premiere)** | 100% (`host/*.jsx`, `CollectEngine.js`, `PresetManager.js`, telas opcionais). |
| **ScriptUI `.jsx` (After Effects)** | Todo `host/` (`_lib.jsx`, `_rules.jsx`, `organizer.jsx`, `aeft_organizer.jsx`) roda direto via `$.evalFile`, sem CEP. |
| **UXP (Premiere Pro 25+)** | `host/_rules.jsx`, schema de presets e `client/CollectEngine.js` (JS puro). A camada de DOM `ppro_organizer.jsx` precisaria ser portada de ExtendScript para API UXP. |

---

## 3. Regras Críticas ao Editar `host/*.jsx` (ExtendScript ES3)

Os arquivos em `host/` executam no interpretador **ECMAScript 3** da Adobe. Quebrar essas regras causa erro silencioso ou `SyntaxError` ao carregar no AE/Premiere (mesmo passando em linters modernos):

1. **ES3 estrito:** use apenas `var` e `function () {}`. **Não use** `let`, `const`, arrow functions, template literals, trailing commas, `Object.keys()` nem `.forEach` / `.map` / `.filter` / `.indexOf` em arrays (use loops `for` e helpers de `$.global.OrgLib`).
2. **Escape em RegExp:** dentro de classes `[...]`, **sempre** escape barras como `\/` (ex.: `/[\-_.:\/\\]/g`). Nunca coloque caracteres acentuados literais dentro de RegExp — use escapes Unicode (`\u00e0-\u00fc`).
3. **UTF-8 obrigatório:** defina sempre `fileObj.encoding = "UTF-8";` antes de `$.evalFile(fileObj)`.
4. **After Effects Collect:** nunca use `FootageItem.replace()` / `replaceWithSequence()` para relink (achata PSD/AI e perde alpha/proxy). Use a reescrita de `.aepx` já implementada em `CollectEngine.js`.
5. **Validação:** sempre execute `npm test` após qualquer alteração.
