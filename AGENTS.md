# Diretrizes de Desenvolvimento do Projeto (TidyFlow)

Este arquivo define as regras e restrições obrigatórias para qualquer agente de IA operando neste repositório.

---

## 1. Economia de Tokens e Fonte da Verdade (`MANIFESTO_MESTRE.md` + `docs/`)

- **Proibido varrer a pasta inteira:** Nunca leia todos os arquivos de `client/`, `host/` ou `docs/` de uma só vez antes de iniciar uma tarefa.
- **Fluxo de Leitura em 3 Passos (Lazy Loading):**
  1. Consulte primeiro o [`MANIFESTO_MESTRE.md`](MANIFESTO_MESTRE.md) (~3 KB), que contém os contratos globais e a **Tabela de Roteamento da Documentação**.
  2. Leia **apenas** o módulo específico dentro de `docs/` correspondente ao domínio da tarefa atual:
     - [`docs/01_ARQUITETURA_E_HOSTS.md`](docs/01_ARQUITETURA_E_HOSTS.md) — Mapa de funções/linhas (`StartLine`/`EndLine`), AE vs PPro, regras ES3 e Rollback.
     - [`docs/02_PRESETS_REGRAS_E_AUDIO.md`](docs/02_PRESETS_REGRAS_E_AUDIO.md) — Taxonomia, schema de presets, pontuação `_rules.jsx` e áudio ESP.
     - [`docs/03_UI_DESIGN_SYSTEM.md`](docs/03_UI_DESIGN_SYSTEM.md) — `theme.css` / `client/theme/*` (`.tf-btn*`, `.tf-toggle*`), janelas CEP e IDs de DOM.
     - [`docs/04_COLLECT_FILES_SPEC.md`](docs/04_COLLECT_FILES_SPEC.md) — Especificação técnica do Collect Files (AE `.aepx` e PPro `.prproj`).
     - [`docs/05_ROADMAP_COLLECT_V2.md`](docs/05_ROADMAP_COLLECT_V2.md) — Plano técnico das próximas fases do Collect V2.
     - [`docs/06_HISTORICO_E_TESTES.md`](docs/06_HISTORICO_E_TESTES.md) — Suíte `npm test` e armadilhas técnicas já resolvidas.
     - [`docs/07_DESIGN_STUDIO.md`](docs/07_DESIGN_STUDIO.md) — Editor visual localhost (`tools/studio/`) e sincronização bidirecional de design.
  3. Ao ler arquivos de código grandes (`aeft_organizer.jsx`, `ppro_organizer.jsx`, `tree_editor.js`, `PresetManager.js`, `CollectEngine.js`), use a tabela de linhas de `docs/01_ARQUITETURA_E_HOSTS.md` e passe `StartLine` e `EndLine` no `read_file`.
- **Atualização da Documentação:** Caso uma mudança altere contratos, IDs ou arquitetura, atualize apenas o módulo correspondente em `docs/` (e o `MANIFESTO_MESTRE.md` se afetar contratos globais).

---

## 2. Restrições do Ambiente de Execução (ExtendScript / Host)

Os scripts na pasta `host/` rodam nos interpretadores embutidos da Adobe:

- **ECMAScript 3 Estrito (ES3)**:
  - **PROIBIDO** usar `let`, `const`, arrow functions `() => {}`, classes ES6, template literals ou trailing commas.
  - Use exclusivamente `var` e declarações de funções tradicionais (`function () {}`).
  - **PROIBIDO** métodos modernos de `Array` (`.forEach`, `.map`, `.filter`, `.reduce`, `.indexOf`) ou `Object.keys()`. Use loops `for` tradicionais e helpers de `$.global.OrgLib` (`host/_lib.jsx`).
  - **RegExp ES3:** Sempre escape barras `/` dentro de classes de caracteres `[...]` (escreva `\/`) e nunca use caracteres acentuados literais em RegExp (use `\uXXXX`).
  - **UTF-8:** Sempre defina `fileObj.encoding = "UTF-8"` antes de `$.evalFile`.
- **Tratamento de Exceções**:
  - Envolva operações com APIs do host (`app.project`, `app.project.items`, `moveBin`, etc.) em blocos `try/catch`.
  - Retorne sempre strings JSON padronizadas para a camada CEP consumir com segurança.

---

## 3. Camada de Interface CEP (Client / Browser)

- A interface roda em Chromium dentro do Adobe CEP (Node.js integrado disponível).
- Reutilize obrigatoriamente os componentes de `client/theme.css` (`.tf-btn*`, `.tf-toggle*`) e respeite `index.css`, `tree_editor.css` e `collect.css`.
- Ao manipular presets em disco, respeite o isolamento em `%APPDATA%/TidyFlow/presets` com os mecanismos de memoização/cache e o fallback `localStorage`.
- Nunca remova proteções de presets de fábrica (`isBuiltIn`).

---

## 4. Comunicação, Testes e Idioma

- As interações, explicações e documentações devem ser prioritariamente em **Português do Brasil**.
- Mantenha comentários de código objetivos e preserve comentários existentes ao editar.
- Ações destrutivas em massa exigem validação/confirmação prévia.
- Sempre valide alterações executando `npm test` (`node scripts/tests/run.js`).
