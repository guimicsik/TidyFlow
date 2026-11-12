# 03. Roadmap Detalhado: Consolidação de Mídias Duplicadas (*Deduplicate Media*)

> **Escopo:** After Effects + Premiere Pro
> **Impacto na UI:** Zero botões novos no painel principal — integrado à ação existente **Verificar Comps / Limpeza** (`#btnCheckComps`)
> **Compatibilidade com Rollback:** Total (suportado no After Effects via `app.beginUndoGroup` e no Premiere via remoção apenas de duplicatas órfãs)

---

## 1. Objetivo e Filosofia de UX ("Sem Inchar o Painel")

Em projetos editados a quatro mãos ou com múltiplas importações, é comum o painel Project acumular 2, 3 ou 4 cópias do mesmo arquivo físico (`logo.png`, `trilha.wav`).
Para **não adicionar um 7º botão** no painel compacto de `360×440 px`, a consolidação de duplicatas entra como parte natural do botão já existente **Verificar composições / Verificar sequências** (`checkUnusedComps`), que já é o botão de higiene e limpeza do projeto.

---

## 2. Regras de Segurança (Quando duas mídias são "Realmente Duplicadas"?)

Consolidar mídias exige cautela cirúrgica: **dois itens que apontam para o mesmo arquivo no disco NEM SEMPRE são duplicatas descartáveis!**

### Casos que NUNCA podem ser fundidos/removidos:
1. **Camadas de arquivos multi-camada (`.psd`, `.psb`, `.ai`):**
   - No After Effects e no Premiere Pro, `Camada 01/arte.psd` e `Camada 02/arte.psd` têm exatamente o mesmo `file.fsName` (`arte.psd`), mas apontam para camadas internas diferentes.
   - **Regra:** Qualquer item com extensão `psd`, `psb` ou `ai` (ou dentro de um contêiner PSD/AI) é **estritamente ignorado** pela deduplicação.
2. **Itens com *Interpret Footage* diferentes:**
   - Se o editor importou `take01.mp4` duas vezes porque interpretou um a `24 fps` e o outro a `60 fps` (ou com modos de Alpha ou Loop diferentes), eles não podem ser fundidos.
3. **Subclips / Multicam / Merged Clips no Premiere Pro:**
   - Subclips recortados a partir de um master clip compartilham o mesmo `getMediaPath()`, mas possuem `inPoint`/`outPoint` próprios.

---

## 3. Passo a Passo de Implementação por Host

### Fase 3.1 — After Effects (`host/aeft_organizer.jsx` — `aeft_checkUnusedComps` L536)

No After Effects, temos controle total sobre as camadas (`AVLayer.replaceSource`) e sobre as propriedades de interpretação (`mainSource`):

1. **Chave de Identidade Estrita (`buildFootageIdentityKey(item)`):**
   - Só avalia `FootageItem` com `item.file != null` e `!item.footageMissing`.
   - Ignora extensões `psd`, `psb`, `ai`.
   - Monta a chave:
     ```text
     fsNameLower + "|" + isSequence + "|" + alphaMode + "|" + premulColor + "|" + conformFrameRate + "|" + loop + "|" + proxyPathLower
     ```
2. **Agrupamento e Substituição nas Comps:**
   - Se dois ou mais `FootageItem` tiverem **exatamente a mesma chave de identidade** e **o mesmo nome base** (ou seja, não são sub-camadas distintas):
     - Escolhe o primeiro item como `canonicalItem`.
     - Varre todas as `CompItem` do projeto: qualquer `layer` cujo `layer.source === duplicateItem` recebe `layer.replaceSource(canonicalItem, false)`.
     - Remove `duplicateItem.remove()` e incrementa `consolidatedDuplicatesCount`.
3. **Fronteira de Undo:**
   - Roda dentro do mesmo `app.beginUndoGroup("Verificar Composições Não Usadas")` já existente em `aeft_checkUnusedComps`.

---

### Fase 3.2 — Premiere Pro (`host/ppro_organizer.jsx` — `ppro_checkUnusedComps` L905)

No Premiere Pro, o DOM do ExtendScript não expõe `clip.replaceSource` confiável em todas as versões sem risco de perder keyframes de intrínsecos (`Motion`/`Opacity`), e arquivos de câmera/subclips compartilham `getMediaPath()`. Por isso, adotamos a **Deduplicação Conservadora de Órfãos**:

1. **Levantar Mídias em Uso nas Sequências:**
   - Usar o mapa de sequências já construído em `ppro_checkUnusedComps` para marcar todos os `nodeId` que estão efetivamente inseridos em alguma timeline (`usedInAnySeqByNodeId`).
2. **Detectar Duplicatas Órfãs (100% Seguro):**
   - Agrupar clipes de mídia (excluindo `psd`, `psb`, `ai`, sequências, multicam e merged clips) por:
     ```text
     mediaPathLower + "::" + itemNameLower + "::" + videoFPS + "::" + mediaType
     ```
   - Quando um grupo tiver **2 ou mais itens idênticos**:
     - Se pelo menos 1 item do grupo estiver em uso (ou se todos estiverem sem uso, mantém-se o primeiro como canônico), os demais itens do grupo que **não estão em nenhuma sequência** (`!usedInAnySeqByNodeId[dup.nodeId]`) são movidos para a pasta `Nunca Usadas` (ou removidos na limpeza), evitando cópias mortas repetidas nas Bins.

---

### Fase 3.3 — Retorno JSON e Mensagem no Painel (`client/main.js`)
**Arquivos afetados:**
- [`host/aeft_organizer.jsx`](../../host/aeft_organizer.jsx)
- [`host/ppro_organizer.jsx`](../../host/ppro_organizer.jsx)
- [`client/main.js`](../../client/main.js) (`btnCheckComps` handler L528)

**Tarefas:**
1. Incluir `"consolidatedDuplicates": consolidatedCount` no JSON retornado por `checkUnusedComps`.
2. Em `client/main.js`, se `res.consolidatedDuplicates > 0`, acrescentar ao resumo final da barra de status:
   - Ex.: `"Limpeza concluída: 2 comp(s) não usadas isoladas, 3 mídia(s) duplicada(s) consolidada(s)."`

---

## 4. Testes Automatizados (`scripts/tests/`)

1. **Teste AE (`ae_engine_test.js`):**
   - Importar dois `FootageItem` apontando para `C:/v/logo.png`, ambos usados em comps diferentes -> `checkUnusedComps` funde as referências para o primeiro item e remove a duplicata.
   - Importar duas camadas de `C:/v/arte.psd` -> `checkUnusedComps` **não** funde nem remove nenhuma camada PSD.
2. **Teste Premiere (`ppro_audio_test.js`):**
   - Dois clipes `swoosh.wav` apontando para `C:\sfx\swoosh.wav` (um usado na sequência, outro sobrando duplicado na Bin) -> a duplicata órfã é isolada, mantendo o clipe usado intacto.
