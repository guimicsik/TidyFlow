# 06. Suíte de Testes e Histórico de Engenharia

---

## 1. Como Executar os Testes Automatizados

O repositório possui uma suíte de regressão em Node.js puro (sem precisar abrir o After Effects ou Premiere Pro) que simula as APIs dos dois hosts (`ae_mock.js` e `ppro_mock.js`) e valida sintaxe ES3 estrita:

```powershell
npm test
# ou diretamente:
node scripts/tests/run.js
```

### Mapa das Suítes (`scripts/tests/`) — 96 testes, 0 falhas

| Arquivo de Teste | O que valida |
| :--- | :--- |
| `host_static_test.js` | **Guarda ES3 estrito** em todos os `host/*.jsx`: proíbe `let`, `const`, arrow functions, template literals, `.forEach`/`.map`/`.filter`/`Object.keys`, `/` não escapada dentro de `[...]` em RegExp, flags pós-ES3, caracteres não-ASCII em RegExp e trailing commas. Valida contratos de snapshot e `beginUndoGroup`. |
| `client_refs_test.js` | Verifica se 100% dos `getElementById` e `querySelector` de `main.js`, `tree_editor.js` e `collect.js` existem nos respectivos arquivos `.html` e garante ausência de seletores órfãos. |
| `preset_manager_test.js` | Persistência disco × `localStorage`, cache e invalidação, bloqueio de preset fantasma em erro de I/O, overrides do `Default Clean`, aviso de árvore descartada e dicionários `AEFT` vs `PPRO`. |
| `preset_import_test.js` | Guarda `PRESET_EXISTS` ao importar JSON ou *Salvar Como* sobre nome existente, proteção do `Default Clean` e guarda de `isDirty` no editor. |
| `rules_matcher_test.js` | Precedência exata de pontuação do `host/_rules.jsx` (`1000` nome > `850` ext isolada > `700` tipo+ext > `400/500` tipo > `380` fallback de tipo 5b > `200` `catchOthers`). |
| `ae_engine_test.js` | Execução real de `host/aeft_organizer.jsx` sobre `lib/ae_mock.js`: organização, idempotência, numeração contínua sem saltos, `useNumbering: false`, labels, limpeza de pastas vazias e rollback. |
| `ppro_audio_classifier_test.js` | Classificação de áudio ESP em `host/ppro_organizer.jsx`: Dialogue (`Enhance Speech`), Music (`Ducking`), SFX (`Reverb`), trilhas, nomes de arquivo e tags XMP. |
| `ppro_organize_audio_test.js` | Ponta a ponta do Premiere (`lib/ppro_mock.js`): subpastas `01_Dialogue`..`05_Others`, numeração contínua dinâmica (`numberAudioCategories`), extensão defasada (fallback 5b) e diagnóstico `buildAudioSummary`. |
| `collect_test.js` | `CollectEngine.js` e hosts de Collect (`aeft_collect.jsx` / `ppro_collect.jsx`): sanitização, sequências, estimativa assíncrona e cancelamento, reescrita XML de `.aepx` e `.prproj` gzip, proxies, `Report.txt` e scan. |

---

## 2. Resumo Executivo de Fases Concluídas e Armadilhas Resolvidas

| Fase | Resumo Técnico e Lições Aprendidas (Não Reintroduzir) |
| :--- | :--- |
| **Fases 1–3** | Memoização de `PresetManager` (evita `readdirSync` a cada `focus`); índice `_folderIndex` O(N) no AE e cache de `inspectSequenceTracks` no PPro (redução de >80% em `scanCount`); extração de helpers puros para `host/_lib.jsx` (`$.global.OrgLib`). |
| **Fases 4–6** | Criação do `client/OrgLog.js`; extração do motor de pontuação unificado para `host/_rules.jsx` (`$.global.OrgRules`); isolamento do motor legado em `host/legacy/aeft_legacy.jsx` (carregado sob demanda); `moveItemSafe` com `try/catch` por item no PPro. |
| **Fases 7–9** | Correção de `"Object is invalid"` no AE ao limpar pastas vazias (`isAliveFolderWithContent`); bloqueio de preset fantasma quando `writeFileSync` falha; invariante `reduceProject ⇒ saveProjectBefore` + modal `#reduceModalBackdrop`; guarda `PRESET_EXISTS` e proteção de `isDirty` no editor. |
| **Áudio ESP & ES3 (7.16–7.19)** | 1) `/` sem escape dentro de `[...]` em RegExp quebrava o parser ES3 do Premiere em tempo de carga (corrigido com `\/` e coberto por `host_static_test.js`).<br>2) Testar `/\bdialog\b/i` no XML bruto de `getProjectMetadata()` dava falso-positivo na tag vazia `<...Column.PropertyText.Dialog>` (corrigido extraindo apenas tags preenchidas).<br>3) Papel ESP nunca deve entrar em `nameCandidates` para não disparar `nameFilter` de outros nós.<br>4) Numeração sequencial contínua (`01_`, `02_`) aplicada apenas às pastas/subpastas ESP que realmente têm conteúdo. |
| **Collect Files (Fase 0 a 8)** | Validado em projetos reais no AE 26.5 e Premiere 26.5.2. No AE, `item.replace()` é proibido (achata PSD/AI); usa-se `.aepx` em `%TEMP%\TidyFlow` + `rewriteAepxXml`. No Premiere, usa-se `zlib.gunzipSync` + `rewritePrprojXml` + `closeDocument` antes de `openDocument` para evitar conflito de `ObjectUID`. |

