# Guia de Contribuição — Tradução Tales of Immortal (PT-BR) 🐉

Seja muito bem-vindo ao projeto comunitário de tradução de **Tales of Immortal** (鬼谷八荒)! Qualquer ajuda para revisar, melhorar o português e ajustar termos de cultivo é super bem-vinda.

---

## 🚀 Como Contribuir (Passo a Passo)

Você não precisa mexer em arquivos JSON gigantescos manualmente. O projeto já conta com um **Painel Visual Web** que facilita tudo!

### 1. Faça um Fork do Projeto
* No topo direito da página deste repositório no GitHub, clique no botão **Fork** para criar uma cópia na sua conta.

### 2. Clone na sua Máquina
Abra o terminal (Git Bash ou Prompt de Comando) e clone o seu fork:
```bash
git clone https://github.com/PetryckSlater/TalesTranslatorManager.git
cd TalesTranslatorManager
```

### 3. Abra o Painel Visual de Revisão
* Basta dar **dois cliques** no arquivo:
  👉 **`2_ABRIR_PAINEL_REVISAO.bat`**
* O painel abrirá automaticamente no seu navegador (`http://localhost:3000`).

### 4. Configure seu Nome e Comece a Revisar
1. No canto superior direito, digite seu nome ou apelido em **👤 Seu Nome: [Seu Nick]**.
2. Navegue pelos textos usando a barra de busca ou os filtros de categoria (🎭 Diálogos, ⚔️ Habilidades, 🧪 Itens, etc.).
3. Faça suas correções na caixa de texto em português e aperte **`Ctrl + Enter`** (ou clique em **Salvar**).
4. Suas edições ficam automaticamente registradas com seu nome e data no banco mestre (`tools/data/database.json`).

### 5. Envie suas Alterações (Pull Request)
Após terminar suas revisões:
```bash
git add tools/data/database.json
git commit -m "docs: revisados diálogos da seita e nomes de pílulas"
git push origin main
```
Vá até a página do seu fork no GitHub e clique em **Contribute** $\to$ **Open Pull Request**. Nós iremos revisar e aprovar suas melhorias!

---

## ⚠️ Regras de Ouro da Tradução

1. **Nunca Remova ou Altere Tags do Jogo**:
   * O jogo utiliza marcações essenciais para funcionar sem travar:
     * Nomes dinâmicos: `{name|A}`, `{name|B}`
     * Variáveis numéricas: `{0}`, `{1}`
     * Links e cores: `<color=#FFE686>`, `</color>`, `<g>`, `</g>`, `{itemLink101}`
   * *O painel visual emite um aviso vermelho se você esquecer alguma tag por engano.*

2. **Respeite o Glossário de Cultivo (*Xianxia*)**:
   * O arquivo [`tools/glossary.json`](tools/glossary.json) contém a lista de termos padronizados:
     * *Qi Refining* $\to$ **Refinamento de Qi**
     * *Foundation* $\to$ **Fundação**
     * *Golden Core* $\to$ **Núcleo Dourado**
     * *Nascent Soul* $\to$ **Alma Nascente**
     * *Breakthrough* $\to$ **Avanço**
     * *Rewrite Destiny* $\to$ **Reescrever Destino**
     * *Sect* $\to$ **Seita**
   * Se achar que algum termo deve ser aprimorado, você pode abrir uma sugestão no arquivo `glossary.json`.

---

## 🐛 Reportando Erros e Erros de Digitação

Se você encontrou um erro dentro do jogo mas não sabe como mexer no Git:
* Abra uma **[Issue](https://github.com/PetryckSlater/TalesTranslatorManager/issues)** aqui no GitHub informando o texto com erro e como ele deveria ficar.
* Se possível, anexe um print da tela do jogo!

Muito obrigado por ajudar a comunidade brasileira a aproveitar esse jogão em português! 🐲
