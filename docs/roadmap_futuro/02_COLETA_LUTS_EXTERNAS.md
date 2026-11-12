# 02. Roadmap Detalhado: Coleta e Relink de LUTs Externas (`.cube` / `.look`)

> **Escopo:** After Effects + Premiere Pro (`com.tidyflow.collect`)
> **Impacto na UI:** 1 checkbox na janela de Collect (`#chkCollectLuts`, marcado por padrão)
> **Impacto no Painel Principal:** Zero

---

## 1. Objetivo e Problema que Resolve

Tanto no **After Effects** quanto no **Premiere Pro**, quando o editor carrega uma LUT personalizada (`.cube`, `.look`, `.3dl`) no efeito **Lumetri Color** (ou *Apply Color LUT*) a partir de uma pasta externa (ex.: `D:\Cliente\Look_Verão.cube` ou `Downloads`), o Collect nativo da Adobe **não copia o arquivo `.cube`** para a pasta coletada.

Com este recurso:
1. O TidyFlow detecta todas as LUTs externas referenciadas nas comps/sequências do escopo;
2. Copia os arquivos para `(Footage)/LUTs/`;
3. Atualiza a referência no XML do projeto (`.prproj` / `.aepx`) para o novo caminho dentro de `(Footage)/LUTs/`;
4. Lista as LUTs coletadas no `Report.txt`.

---

## 2. Regras de Filtragem (O que Coletar vs O que Ignorar)

Para não copiar LUTs internas de fábrica da Adobe que já existem em qualquer instalação do Premiere/AE:
- **Ignorar (LUTs de sistema/fábrica):**
  - Qualquer caminho dentro de `Program Files/Adobe/`, `Program Files (x86)/Adobe/`, `/Applications/Adobe...` ou `Common/LUTs/`.
- **Coletar (LUTs externas do projeto/usuário):**
  - Qualquer arquivo existente no disco com extensão `.cube`, `.look`, `.3dl`, `.lut` ou `.csp` fora das pastas de instalação da Adobe.

---

## 3. Passo a Passo de Implementação

### Fase 2.1 — Descoberta de LUTs no Premiere Pro (`host/ppro_collect.jsx` + `CollectEngine.js`)
**Como o Premiere armazena LUTs:**
1. **Nos componentes de clipe (`host/ppro_collect.jsx` — `collectTrackItemEffects` L354):**
   - Quando um componente tem `matchName` contendo `Lumetri` (`AE.ADBE Lumetri`), iterar sobre `comp.properties` procurando propriedades de arquivo/string cujo valor termine em `\.(cube|look|3dl|lut|csp)$`.
2. **Diretamente no XML do `.prproj` (`client/CollectEngine.js`):**
   - No `.prproj` descompactado, o efeito Lumetri grava o caminho absoluto do arquivo `.cube` em tags/parâmetros de string do filtro.
   - Criar helper puro `extractExternalLutsFromPrprojXml(xmlText)` em `CollectEngine.js` que localiza caminhos absolutos de arquivos `.cube`/`.look`/`.3dl` fora de `Program Files/Adobe`.
   - **Vantagem:** Captura inclusive LUTs aplicadas em *Adjustment Layers*, *Master Clips* (Source Effects) e trilhas de sequência sem custo adicional no ExtendScript!

---

### Fase 2.2 — Descoberta de LUTs no After Effects (`host/aeft_collect.jsx`)
**Arquivos afetados:**
- [`host/aeft_collect.jsx`](../../host/aeft_collect.jsx) (`scanCompRecursive` L66)
- [`client/CollectEngine.js`](../../client/CollectEngine.js) (`rewriteAepxXml` L323)

**Tarefas:**
1. No `.aepx` do After Effects, efeitos `ADBE Lumetri` e `ADBE Apply Color LUT` que referenciam um arquivo externo também gravam o caminho no XML ou expõem no bloco do efeito.
2. Criar sonda leve no `.aepx` para verificar se o caminho do `.cube` aparece como atributo `fullpath` ou string literal no XML e incluí-lo no `fileMap` rumo a `(Footage)/LUTs/`.

---

### Fase 2.3 — Planejamento de Cópia e `Report.txt` (`client/CollectEngine.js`)
**Arquivos afetados:**
- [`client/CollectEngine.js`](../../client/CollectEngine.js) (`buildCollectPlan` L530, `buildReportText` L660)

**Tarefas:**
1. Em `buildCollectPlan(scan, opts, footageRoot, fsReaddir)`:
   - Para cada LUT externa única em `scan.luts` (não duplicada):
     - Destino: `<footageRoot>/LUTs/<nomeSanitizado>.cube` (usando `uniqueDestName` caso haja duas LUTs diferentes com o mesmo nome).
     - Registrar em `fileCopies` e em `fileMap[lutPathLower] = destLutPath`.
2. Em `buildReportText(data)`:
   - Exibir as LUTs coletadas junto à seção `3. EFEITOS E PLUGINS UTILIZADOS` (ex.: `[LUT] Look_Verão.cube -> (Footage)/LUTs/Look_Verão.cube`) e remover o aviso genérico de *"LUTs em efeitos não são cobertas"* quando a coleta de LUTs estiver ativa.

---

## 4. Testes Automatizados (`scripts/tests/collect_test.js`)

1. Testar `extractExternalLutsFromPrprojXml` garantindo que:
   - `C:\Program Files\Adobe\Adobe Premiere Pro 2026\Lumetri\LUTs\Technical\Rec709.cube` é **ignorado**;
   - `D:\Jobs\Magalu\LUTs\Cliente_Warm_v2.cube` é **coletado** para `(Footage)/LUTs/Cliente_Warm_v2.cube` e reescrito no XML do `.prproj`.
2. Testar desambiguação de duas LUTs homônimas (`Look.cube` e `Look_1.cube`).
