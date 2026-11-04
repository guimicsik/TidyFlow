# Diretrizes de Desenvolvimento do Projeto (TidyFlow)

Este arquivo define as regras e restrições obrigatórias para qualquer agente de IA operando neste repositório.

---

## 1. Fonte da Verdade Arquitetural (`MANIFESTO_MESTRE.md`)

- O arquivo `MANIFESTO_MESTRE.md` é a **autoridade máxima** de arquitetura, fluxo de dados e design do TidyFlow.
- **Antes de qualquer alteração estrutural, refatoração ou nova funcionalidade**, consulte as seções relevantes do `MANIFESTO_MESTRE.md` para garantir aderência:
  - Nomes de eventos e canais CSEvent (ex: `com.tidyflow.presetsUpdated`, `com.tidyflow.editor`).
  - IDs de extensão e janelas (`com.tidyflow` e `com.tidyflow.editor`).
  - Contratos de dados de Presets JSON e esquemas de retorno (`status`, `success`, contagens, etc.).
  - Comportamento de Snapshot & Rollback.
- **Atualização do Manifesto**: Caso uma alteração intencional altere a arquitetura, convenções ou contratos descritos no Manifesto, atualize o `MANIFESTO_MESTRE.md` correspondente.

---

## 2. Restrições do Ambiente de Execução (ExtendScript / Host)

Os scripts na pasta `host/` (como `organizer.jsx`, `aeft_organizer.jsx`, etc.) rodam nos interpretadores embutidos da Adobe:

- **ECMAScript 3 Estrito (ES3)**:
  - **PROIBIDO** usar `let`, `const`, arrow functions `() => {}`, classes ES6, ou template literals (`` `texto ${var}` ``).
  - Use exclusivamente `var` e declarações de funções tradicionais (`function () {}`).
  - **PROIBIDO** métodos modernos de `Array` (como `.forEach`, `.map`, `.filter`, `.reduce`, `.indexOf`) ou `Object.keys()` a menos que um polyfill explícito esteja presente no mesmo contexto.
  - Use loops tradicionais `for (var i = 0; i < len; i++)`.
- **Tratamento de Exceções**:
  - Envolva operações com APIs do host (`app.project`, `app.project.items`, etc.) em blocos `try/catch`.
  - Retorne sempre strings JSON padronizadas para a camada CEP consumir com segurança.

---

## 3. Camada de Interface CEP (Client / Browser)

- A interface é executada em Chromium dentro do Adobe CEP (Node.js integrado disponível).
- Respeite o design system definido no Figma e as folhas de estilo existentes (`index.css` e `tree_editor.css`).
- Ao manipular presets em disco, respeite o isolamento em `%APPDATA%/TidyFlow/presets` com os mecanismos de memoização/cache e o fallback de persistência (`localStorage`).
- Nunca remova proteções de presets de fábrica (`isBuiltIn`).

---

## 4. Comunicação e Idioma

- As interações, explicações e documentações devem ser prioritariamente em **Português do Brasil**.
- Mantenha comentários de código objetivos e preserve os comentários e docstrings existentes ao realizar edições.
- Ações destrutivas em massa (como deleção permanente de assets ou remoção de pastas) exigem validação prévia.

