# Pipeline de Tradução — Tales of Immortal (PT-BR)

Ferramenta desenvolvida para atualizar, sincronizar, traduzir e compilar o mod de tradução em Português do Brasil para o jogo **Tales of Immortal** (鬼谷八荒).

---

## ⚡ Como Funciona o Sistema

1. **Sincronização Segura (`sync`)**:
   - Compara os novos arquivos do jogo (`TalesEnglishVersion`) com a sua tradução atual (`ModProject_VMCUi0`).
   - **Correção de Deslocamento de IDs**: O pareamento de `LocalText.json` é feito exclusivamente pelo campo `key` (evitando que inserções de novas linhas no jogo misturem ou corrompam a tradução de 47.000+ linhas).
   - Preserva automaticamente **90,2% do jogo** (73.600+ linhas que não mudaram).
   - Separa as novas linhas em `tools/data/pending.json` e as modificadas em `tools/data/modified.json`.

2. **Compilação Otimizada (`build`)**:
   - Constrói os arquivos `LocalText.json` e `RoleLogLocal.json` atualizados diretamente dentro de `ModProject_VMCUi0/ModProject/ModExcel/`.
   - Remove a coluna coreana (`kr`), economizando **~9 MB** e reduzindo expressivamente o tempo de carregamento no motor de mods do jogo.
   - Aplica *fallback* seguro: qualquer linha que ainda não foi traduzida recebe o texto original em inglês temporariamente, impedindo que o jogo trave ou exiba IDs vazios.

3. **Painel Visual de Revisão (`ui`)**:
   - Interface web local que roda no navegador (sem necessidade de instalar pacotes externos).
   - Permite visualizar lado a lado (Chinês, Inglês e Português), filtrar por categoria (itens, diálogos, UI) e salvar com `Ctrl + Enter`.
   - Botão para compilar o mod diretamente da tela.

---

## 🚀 Como Usar no Dia a Dia

Você pode executar dando **dois cliques** nos arquivos `.bat` ou pelo terminal:

### Opção 1: Clicando nos arquivos `.bat` (Recomendado no Windows)
* **`1_SINCRONIZAR_UPDATES.bat`**: Compara a versão atual do jogo com suas traduções e atualiza o banco de dados.
* **`2_ABRIR_PAINEL_REVISAO.bat`**: Abre o painel visual colaborativo no seu navegador (`http://localhost:3000`).
* **`3_COMPILAR_MOD.bat`**: Gera os arquivos otimizados prontos para jogar ou publicar na Oficina Steam.
* **`4_TRADUZIR_LOTE_AUTO.bat`**: Traduz automaticamente um lote de textos pendentes com proteção de tags.

---

## 👥 Como Chamar Amigos / Equipe para Traduzir Junto

O painel foi desenhado especificamente para trabalho em equipe:

1. **Atribuição de Autoria e Gamificação**:
   * Cada pessoa digita seu nome no topo ("👤 Seu Nome: Fulano").
   * Cada linha salva registra quem traduziu e a data.
   * Há um **Ranking de Colaboradores (🏆 Leaderboard)** que mostra quem traduziu mais textos!

2. **Proteção Contra Erros (Linter de Tags)**:
   * Se um colaborador esquecer ou corromper acidentalmente uma tag do jogo (como `{0}`, `{name|A}`, `<g>...</g>`), o painel emite um alerta vermelho e impede que ele quebre o jogo por engano.

3. **Sugestão Inteligente com 1 Clique (`✨ Sugerir com IA`)**:
   * O colaborador clica no botão e recebe uma tradução pronta, com as tags protegidas e os termos de cultivo (*Qi Refining* $\to$ *Refino de Qi*) já padronizados, precisando apenas revisar e dar `Ctrl + Enter`.

4. **Divisão de Tarefas por Categoria**:
   * Os tradutores podem usar o filtro de categoria para dividir o trabalho: um foca em **🎭 Diálogos**, outro em **⚔️ Habilidades**, outro em **🧪 Itens**.

5. **Como Amigos Podem Acessar:**
   * **Na mesma rede Wi-Fi / Casa**: Basta acessar o IP exibido na inicialização (ex: `http://192.168.0.11:3000`).
   * **Via VPN Virtual (Radmin VPN ou Hamachi)**: Todos entram na mesma sala e acessam o IP do host (ex: `http://26.x.x.x:3000`).
   * **Pela Internet (Sem instalar nada)**: Você pode rodar no terminal `npx localtunnel --port 3000` ou Cloudflare Tunnel para gerar um link público seguro (ex: `https://meu-mod-tales.loca.lt`) e mandar no Discord!

### Opção 2: Pelo Terminal / Prompt de Comando
```bash
# Sincronizar
node tools/scripts/sync.js

# Abrir Painel Visual
node tools/scripts/server.js

# Compilar para a pasta do Mod
node tools/scripts/build.js

# Traduzir lote de 50 textos
node tools/scripts/translate.js 50
```

---

## 📁 Estrutura do Projeto

```
TalesMods/
├── 1_SINCRONIZAR_UPDATES.bat     # Atalho para sincronizar
├── 2_ABRIR_PAINEL_REVISAO.bat    # Atalho para abrir o painel web
├── 3_COMPILAR_MOD.bat            # Atalho para compilar o mod
├── 4_TRADUZIR_LOTE_AUTO.bat      # Atalho para traduzir lotes
├── output/                       # Pasta pública com os arquivos de tradução compilados
│   └── ModExcel/                 # (LocalText.json, RoleLogLocal.json limpos e otimizados)
├── TalesEnglishVersion/          # Arquivos de referência da nova versão do jogo
└── tools/
    ├── config.js                 # Configurações de caminhos e parâmetros
    ├── glossary.json             # Glossário de termos de cultivo (Qi, Fundação, etc.)
    ├── data/
    │   ├── database.json         # Banco mestre contendo todas as traduções feitas
    │   ├── pending.json          # Textos novos aguardando tradução
    │   └── modified.json         # Textos que os desenvolvedores alteraram no jogo
    └── scripts/
        ├── sync.js               # Engine de diff e sincronização
        ├── build.js              # Engine de compilação e otimização
        ├── translate.js          # Tradutor com proteção de tags ({0}, <g>, etc.)
        └── server.js             # Servidor do painel web de revisão
```

---

## 🔮 Como Atualizar em Futuros Updates do Jogo

Quando o *Tales of Immortal* lançar uma nova versão oficial no futuro:
1. Cole os novos arquivos `LocalText.json` e `RoleLogLocal.json` na pasta `TalesEnglishVersion/`.
2. Dê dois cliques em **`1_SINCRONIZAR_UPDATES.bat`**.
3. Ele vai manter 100% das suas traduções anteriores e vai listar exatamente o que há de novo!
4. Revise ou traduza as novidades pelo painel (**`2_ABRIR_PAINEL_REVISAO.bat`**).
5. Dê dois cliques em **`3_COMPILAR_MOD.bat`** e o mod estará pronto para ser testado e publicado!
