# Diretrizes de Desenvolvimento e Governança de Agentes de IA
# Template Base: Projetos Híbridos Adobe CEP (After Effects + Premiere Pro)

> **Instruções de Uso deste Arquivo:**  
> Este arquivo (`AGENTS.md`) serve como a constituição técnica e operacional para qualquer agente de IA (Antigravity, Cursor, Claude Code, Copilot, etc.) atuando neste repositório. Ele estabelece limites estritos para prevenir quebras do interpretador legado da Adobe, define padrões de consumo eficiente de tokens e mapeia com precisão cirúrgica as diferenças arquiteturais entre o After Effects (`AEFT`) e o Premiere Pro (`PPRO`).

---

## 1. Economia de Tokens e Fonte da Verdade (Lazy Loading)

Para maximizar a precisão das respostas e economizar janela de contexto:

1. **Proibido Varrer o Projeto Inteiro:**  
   Nunca leia todas as pastas de `client/`, `host/` ou `docs/` de uma só vez na inicialização de uma tarefa.
2. **Fluxo de Leitura Cirúrgica em 3 Passos:**
   - **Passo 1 (Índice Mestre):** Consulte o arquivo de contratos e roteamento principal (ex: `MANIFESTO_MESTRE.md` ou `README.md`) para localizar qual módulo é responsável pela tarefa.
   - **Passo 2 (Módulo de Documentação Específico):** Leia apenas a documentação relevante em `docs/` para entender o contrato atual da funcionalidade antes de tocar no código.
   - **Passo 3 (Leitura por Blocos de Linha):** Em arquivos extensos (mais de 250 linhas, especialmente scripts de host como `aeft_*.jsx` e `ppro_*.jsx`), consulte o mapa de linhas e leia estritamente a função necessária utilizando delimitadores (`StartLine` e `EndLine`).
3. **Manutenção da Documentação:**  
   Ao alterar assinaturas de funções, IDs de DOM ou fluxos de dados, atualize imediatamente a documentação modular correspondente.

---

## 2. Restrições Críticas do Interpretador Host (ExtendScript — ES3 Estrito)

Os scripts executados dentro do After Effects e do Premiere Pro rodam no **Adobe ExtendScript**, um interpretador baseado no **ECMAScript 3 (ES3 de 1999)**. O descumprimento destas regras causa erros fatais silenciosos ou `SyntaxError` ao carregar a extensão.

### 2.1 Recursos Terminantemente PROIBIDOS
- **PROIBIDO sintaxe ES6+:**  
  - Sem `let` ou `const` (use estritamente `var`).
  - Sem Arrow Functions `() => {}` (use funções tradicionais `function () {}`).
  - Sem Template Literals com crases (use concatenação de strings com `+`).
  - Sem Classes (`class`), Destructuring (`{ a, b } = obj`), ou Operador Spread/Rest (`...`).
  - Sem Default Parameters (`function foo(a, b = 1)` — use `if (b === undefined) { b = 1; }`).
  - Sem Trailing Commas em objetos ou arrays (`{ a: 1, b: 2, }` causa `SyntaxError` imediato em ES3).
- **PROIBIDO métodos modernos de `Array`:**  
  - Sem `.forEach()`, `.map()`, `.filter()`, `.reduce()`, `.find()`, `.indexOf()`, `.some()`, `.every()`.
  - Use loops `for` clássicos indexados (`for (var i = 0; i < arr.length; i++)`).
- **PROIBIDO métodos modernos de `Object`:**  
  - Sem `Object.keys()`, `Object.values()`, `Object.entries()`, `Object.assign()`.
  - Para iterar chaves de objeto, use `for (var key in obj) { if (obj.hasOwnProperty(key)) { ... } }`.
- **PROIBIDO `JSON` nativo:**  
  - ExtendScript ES3 não possui o objeto global `JSON`. Inclua obrigatoriamente um parser/serializer compatível com ES3 (ex: `json2.js` adaptado ou biblioteca utilitária própria).

### 2.2 Armadilhas Lexicais Específicas do ExtendScript
1. **Escape Obrigatório de Barra `/` dentro de Classes de Caracteres RegExp `[...]`:**  
   No analisador sintático do ExtendScript, uma barra normal não escapada dentro de `[...]` encerra o literal RegExp antes do tempo, gerando um erro de sintaxe irremediável na carga do arquivo (mesmo que passe perfeitamente em testes no Node.js/V8).  
   - ❌ *Incorreto:* `var rx = /[\-_.:/\\+,;]/;`  
   - ✅ *Correto:* `var rx = /[\-_.:\/\\+,;]/;` (sempre escapar como `\/`).
2. **Caracteres Não-ASCII em Expressões Regulares:**  
   Nunca use caracteres acentuados ou especiais literais dentro de expressões regulares. Use sempre códigos Unicode (`\uXXXX`).  
   - ❌ *Incorreto:* `/[áéíóúç]/i`  
   - ✅ *Correto:* `/[\u00e0-\u00fc]/i`
3. **Encoding UTF-8 Obrigatório:**  
   Ao carregar arquivos `.jsx` dinamicamente via `$.evalFile()`, force explicitamente o encoding antes da execução:  
   ```javascript
   var fileObj = new File(path);
   fileObj.encoding = "UTF-8";
   $.evalFile(fileObj);
   ```
4. **Isolamento de Escopo Global:**  
   Para evitar colisões no namespace do ExtendScript entre diferentes plugins do usuário, sempre encapsule funções em objetos de namespace próprios atrelados a `$.global` (ex: `$.global.MeuPlugin = { ... };`) ou use IIFEs:
   ```javascript
   (function () {
       // Código isolado
   })();
   ```

---

## 3. Matriz Arquitetural: After Effects (`AEFT`) vs Premiere Pro (`PPRO`)

Ao desenvolver funcionalidades para ambos os softwares na mesma base de código, respeite rigorosamente as divergências do Modelo de Objetos (DOM):

| Recurso / Conceito | After Effects (`AEFT`) | Premiere Pro (`PPRO`) |
| :--- | :--- | :--- |
| **Identificador do Host** | `app.appName.indexOf("After Effects") !== -1` (ou CEP: `"AEFT"`) | `app.appName.indexOf("Premiere") !== -1` (ou CEP: `"PPRO"`) |
| **Raiz do Projeto** | `app.project.rootFolder` (`FolderItem`) | `app.project.rootItem` (`ProjectItem` do tipo bin) |
| **Estrutura de Itens** | Coleção plana: `app.project.items` (1 até `app.project.numItems`) | Árvore hierárquica: `bin.children` (0 até `children.numItems - 1`) |
| **Indexação dos Itens** | **1-based** (`for (var i = 1; i <= items.numItems; i++)`) | **0-based** (`for (var i = 0; i < children.numItems; i++)`) |
| **Criar Nova Pasta/Bin** | `app.project.items.addFolder("Nome")` e ajustar `parentFolder` | `parentBin.createBin("Nome")` |
| **Mover Itens** | `item.parentFolder = targetFolder;` | `item.moveBin(targetBin);` *(envolver em `try/catch` seguro)* |
| **ID Único do Item** | `item.id` (número inteiro) | `item.nodeId` (string única de identificação) |
| **Tipo Composição / Sequência** | `item instanceof CompItem` | `item.isSequence()` ou comparar com `app.project.sequences` |
| **Caminho da Mídia (Footage)** | `item.file ? item.file.fsName : null` | `item.getMediaPath()` (retorna string vazia para sintéticos) |
| **Itens Sintéticos** | `item.mainSource instanceof SolidSource` | Color Matte, Adjustment Layer, Black Video, Bars & Tone |
| **Color Labels (Cores de Identificação)** | Propriedade direta de índice: `item.label = 0..16;` | Métodos getter/setter: `item.getColorLabel()` e `item.setColorLabel(n)` |
| **Undo Groups** | `app.beginUndoGroup("Ação");` ... `app.endUndoGroup();` | `app.beginUndoGroup` / `app.endUndoGroup` (apenas PPro 22+) ou fallback seguro |
| **Redução de Projeto** | Nativo: `app.project.reduceProject([compItem])` | Sem API nativa direta (requer isolamento em bin temporário ou XML) |

### 3.1 Particularidades Críticas do Premiere Pro
- **Recursão de Bins Obrigatória:** No Premiere Pro, os itens estão aninhados. Para encontrar todos os itens do projeto, é obrigatório implementar uma função recursiva que percorra `children` quando o item for do tipo `ProjectItemType.BIN`.
- **Inspeção de Sequências e Trilhas:** As sequências abertas no Premiere residem em `app.project.sequences`. O acesso a clipes em timeline é feito navegando em `sequence.videoTracks` e `sequence.audioTracks` (ambos 0-indexados).
- **QE DOM (Quality Engineering):** Use `app.enableQE()` apenas como último recurso se a API oficial não expuser o método necessário. O QE DOM é privado, não documentado oficialmente e pode mudar entre atualizações de versão do Premiere.

### 3.2 Particularidades Críticas do After Effects
- **Proibido `replace()` destrutivo:** Nunca use `FootageItem.replace()` ou `replaceWithSequence()` para relink cego, pois isso achata camadas de arquivos Photoshop/Illustrator e reseta taxas de quadros de proxies.
- **Layers de Composição:** São 1-indexadas (`comp.layer(1)` até `comp.numLayers`).
- **Nomes e Caracteres Especiais:** After Effects suporta até 127 caracteres no nome do item. Renomear itens com nomes idênticos é permitido no AE, portanto sempre referencie itens pelo seu `id` e não apenas pelo nome.

---

## 4. Camada de Interface CEP (Client / Browser)

1. **Ambiente de Execução:**  
   O client roda dentro de uma instância do Chromium embutida no Adobe CEP com Node.js habilitado (conforme definido no `CSXS/manifest.xml`).
2. **Ponte de Comunicação (Bridge):**  
   - Toda comunicação entre Client (JS) e Host (JSX) ocorre via `csInterface.evalScript("chamada()", callback)`.
   - **Contrato Estrito de Dados:** O ExtendScript retorna exclusivamente **strings**. Para objetos complexos, o Host deve sempre serializar com `$.global.OrgLib.escapeJsonString` / `JSON.stringify` e o Client deve tratar com `JSON.parse()` dentro de blocos `try/catch`.
3. **Resiliência a Timeouts e Erros de Execução:**  
   Operações longas no host bloqueiam a thread de UI da Adobe. O client deve implementar indicadores visuais de loading, desabilitar botões durante a execução e tratar erros de retorno de forma graciosa.
4. **Temas e UI Sincronizados:**  
   A interface deve escutar o evento `com.adobe.csxs.events.ThemeColorChanged` via `CSInterface` e atualizar variáveis CSS para que o painel adote automaticamente as cores da interface do usuário (Dark, Light, Classic) do host correspondente.

---

## 5. Padrões de Segurança, Integridade de Dados e Rollback

Operações que manipulam arquivos de projeto, movem itens entre pastas ou realizam alterações em massa devem seguir os seguintes princípios de segurança:

1. **Invariante de Preservação:** Nunca sobrescreva, exclua ou mova itens do projeto sem capacidade de reversão.
2. **Sistema de Snapshot Pré-Ação:**  
   Antes de disparar alterações estruturais (organização de pastas, renomeação, exclusão de itens não utilizados), capture um snapshot em memória do estado inicial:
   - Identificador (`id` ou `nodeId`).
   - Nome e caminho/pasta pai original.
   - Cor de identificação (`label`).
3. **Confirmação Explícita para Ações Destrutivas:**  
   Qualquer operação que envolva redução de projeto, eliminação de itens órfãos ou salvamento com sobrescrita exige modal de confirmação no client antes do disparo do comando para o host.
4. **Tratamento de Exceções Cirúrgico:**  
   Nunca permita que um erro em um item específico aborte a operação de todo o projeto. Isole operações em loops protegidos por `try/catch` e colete um relatório de erros para exibir ao usuário.

---

## 6. Procedimentos de Teste e Validação

Antes de concluir qualquer tarefa ou comitar código:

1. **Validação de Sintaxe ES3:**  
   Execute o script de linting do projeto (ex: `npm run lint` ou `npm test`) para garantir que nenhum operador ES6+ (`let`, `const`, arrow functions) tenha sido introduzido na pasta `host/`.
2. **Verificação de RegEx:**  
   Certifique-se de que todas as classes de caracteres que contenham barras terminem escapadas com `\/`.
3. **Testes Unitários sem Host:**  
   Mantenha a lógica pura (cálculos de regras, manipulação de texto, estimators de tamanho, parse de XML) em arquivos desacoplados do DOM da Adobe para que possam ser testados diretamente em ambiente Node.js.
4. **Verificação nos Dois Hosts:**  
   Se uma alteração afetar o fluxo compartilhado, valide se a lógica funciona tanto no contexto do After Effects quanto no do Premiere Pro.

---

## 7. Diretrizes de Comunicação e Idioma

- **Idioma de Interação:** Respostas, explicações de código, documentações internas e mensagens de commit devem ser primordialmente em **Português do Brasil**.
- **Preservação de Comentários:** Nunca remova docstrings ou comentários explicativos existentes ao realizar refatorações pontuais.
- **Transparência em Caso de Bloqueio:** Caso uma limitação da API da Adobe impeça a implementação direta de uma funcionalidade solicitada, comunique claramente o motivo técnico e apresente os workarounds disponíveis no ecossistema CEP/ExtendScript.

