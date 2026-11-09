# Guia Definitivo de Criação de Mods para Tales of Immortal (鬼谷八荒)
**Versão:** 1.0 (Oficial / Engenharia Reversa)  
**Compatibilidade:** Tales of Immortal (Versão Steam / MelonLoader IL2CPP)  
**Autor:** Equipe de Tradução & Modding PT-BR

---

## Sumário
1. [Visão Geral da Arquitetura do Jogo](#1-visão-geral-da-arquitetura-do-jogo)
2. [Estrutura de Pastas de um Mod (`ModProject`)](#2-estrutura-de-pastas-de-um-mod-modproject)
3. [Tema 1: Modificação e Criação de Dados (`ModExcel`)](#3-tema-1-modificação-e-criação-de-dados-modexcel)
   - [O Sistema de IDs e Resolução de Conflitos (`MID&XXXX`)](#o-sistema-de-ids-e-resolução-de-conflitos-midxxxx)
   - [Tabelas Mais Importantes do Jogo](#tabelas-mais-importantes-do-jogo)
   - [Exemplo Prático 1: Criando um Novo Destino Natural (先天气运)](#exemplo-prático-1-criando-um-novo-destino-natural-先天气运)
   - [Exemplo Prático 2: Criando um Encontro/Evento Aleatório (奇遇)](#exemplo-prático-2-criando-um-encontroevento-aleatório-奇遇)
   - [Exemplo Prático 3: Criando um NPC Customizado com Aparência e Laços](#exemplo-prático-3-criando-um-npc-customizado-com-aparência-e-laços)
4. [Tema 2: Modificação de Gráficos e Sons (`ModAssets`)](#4-tema-2-modificação-de-gráficos-e-sons-modassets)
   - [Regra de Ouro do Espelhamento de Recursos](#regra-de-ouro-do-espelhamento-de-recursos)
   - [Ícones, Montarias e Retratos](#ícones-montarias-e-retratos)
   - [Efeitos Sonoros e Músicas](#efeitos-sonoros-e-músicas)
5. [Tema 3: Modelos 3D, Prefabs e AssetBundles (`ModRes`)](#5-tema-3-modelos-3d-prefabs-e-assetbundles-modres)
   - [Requisitos Técnicos (Unity 2020.3.9)](#requisitos-técnicos-unity-202039)
   - [O Projeto `ResBuildABProject`](#o-projeto-resbuildabproject)
   - [Criação de Monstros e Chefes (BattleMonst)](#criação-de-monstros-e-chefes-battlemonst)
   - [Substituição e Criação de Telas de Interface (UI Prefabs)](#substituição-e-criação-de-telas-de-interface-ui-prefabs)
6. [Tema 4: Programação Avançada em C# com Harmony (`ModCode`)](#6-tema-4-programação-avançada-em-c-com-harmony-modcode)
   - [Ambiente de Compilação (.NET 4.7.2 + Roslyn)](#ambiente-de-compilação-net-472--roslyn)
   - [Ciclo de Vida do Mod (`ModMain`, `Init`, `Destroy`)](#ciclo-de-vida-do-mod-modmain-init-destroy)
   - [Injeção de Código com Harmony (Prefix, Postfix, Transpiler)](#injeção-de-código-com-harmony-prefix-postfix-transpiler)
   - [APIs Globais do Jogo (`g.world`, `g.conf`, `g.data`, `g.ui`, `g.events`)](#apis-globais-do-jogo-gworld-gconf-gdata-gui-gevents)
   - [Manipulação de TextMeshPro e Auto-Sizing de Textos](#manipulação-de-textmeshpro-e-auto-sizing-de-textos)
7. [Tema 5: Fluxo de Testes, Depuração e Publicação na Oficina Steam](#7-tema-5-fluxo-de-testes-depuração-e-publicação-na-oficina-steam)
   - [Ativando o Console de Desenvolvedor do MelonLoader](#ativando-o-console-de-desenvolvedor-do-melonloader)
   - [O Modo de Depuração Interno ("进入游戏调试")](#o-modo-de-depuração-interno-进入游戏调试)
   - [Checklist para Publicação na Steam Workshop](#checklist-para-publicação-na-steam-workshop)

---

## 1. Visão Geral da Arquitetura do Jogo

O **Tales of Immortal** (鬼谷八荒) roda sobre a **Unity Engine** compilada com **IL2CPP** no backend de 64 bits. No entanto, os desenvolvedores integraram internamente o framework **MelonLoader** e um pipeline nativo de modding que expõe quatro pilares essenciais:

```
┌────────────────────────────────────────────────────────┐
│               Tales of Immortal Runtime                │
├──────────────┬──────────────┬─────────────┬────────────┤
│   ModExcel   │  ModAssets   │   ModRes    │  ModCode   │
│   (Dados)    │ (Arte/Áudio) │(AssetBundle)│(C# Harmony)│
└──────────────┴──────────────┴─────────────┴────────────┘
```

1. **Dados (`ModExcel`)**: Configurações relacionais em Excel (`.xlsx`) ou JSON que alteram atributos, habilidades, destinos, missões, itens e diálogos.
2. **Texturas e Áudios Diretos (`ModAssets`)**: Arquivos PNG/WAV soltos que sobrepõem diretamente os recursos de `Resources/` do jogo sem precisar de AssetBundles.
3. **Pacotes Compilados (`ModRes`)**: AssetBundles exportados pelo Unity contendo prefabs complexos, esqueletos de animação, efeitos de combate e interfaces (`.prefab`).
4. **Scripts Compilados (`ModCode`)**: Bibliotecas dinâmicas em C# (`.dll`) que interceptam e modificam a lógica do jogo em tempo real via Harmony.

---

## 2. Estrutura de Pastas de um Mod (`ModProject`)

Ao criar um mod no menu "模组开发" (Desenvolvimento de Mods) do jogo, é gerado um diretório com um **SoleID** exclusivo de 6 caracteres alfanuméricos (ex: `VMCUi0`):

```text
ModProject_<SoleID>/
├── ModProject/
│   ├── Excel/                     <-- Tabelas .xlsx ou subpastas com JSONs
│   │   ├── RoleCreateFeature.xlsx
│   │   ├── PropsBase.xlsx
│   │   └── LocalText/LocalText.json
│   ├── ModAssets/                 <-- Espelho 1:1 da pasta Resources do jogo
│   │   ├── Texture/
│   │   └── Sound/
│   ├── ModRes/                    <-- Projeto Unity para geração de AssetBundles
│   │   └── ResBuildABProject/
│   │       └── Assets/
│   │           └── AssetBundle/   <-- Arquivos .manifest e bundles finais
│   ├── ModCode/                   <-- Código-fonte C# e projeto Visual Studio
│   │   ├── dll/                   <-- DLL compilada final (MOD_<SoleID>.dll)
│   │   └── ModMain/               <-- Código C# (ModMain.cs, etc.)
│   ├── Mod.json                   <-- Metadados do Mod (Nome, autor, tags, SoleID)
│   └── cover.png                  <-- Imagem de capa exibida na Oficina Steam
└── debug/
    └── Mod_<SoleID>/              <-- Pasta de testes utilizada pelo jogo
        ├── ModData.cache          <-- Dados compilados do Excel
        ├── ModExportData.cache    <-- Offset de IDs e ligações
        └── ModCode/dll/           <-- DLL espelhada para execução em debug
```

---

## 3. Tema 1: Modificação e Criação de Dados (`ModExcel`)

### O Sistema de IDs e Resolução de Conflitos (`MID&XXXX`)
No motor do Tales of Immortal, todas as tabelas usam **números inteiros (`int`)** como chave primária. Para permitir que dezenas de mods coexistam sem conflito de IDs:

1. **Geração Automática do Offset**: Quando o mod é criado, o jogo sorteia um número inteiro aleatório entre `-2.100.000.000` e `+2.100.000.000` (excluindo a faixa reservada pelo jogo de `-1.000.000` a `+100.000.000`).
2. **Prefixo `MID&`**: Todos os novos registros criados pelo seu mod **DEVEM** usar o prefixo `MID&` seguido por um número sequencial simples (ex: `MID&1`, `MID&2`, `MID&100`).
3. **Cálculo em Runtime**: Durante a compilação do mod, o jogo soma o offset base ao valor do `MID&XXXX`:
   $$\text{ID Final} = \text{Offset Aleatório} + \text{Valor Customizado}$$
4. **Relacionamento entre Tabelas**:
   - Referenciando itens do seu próprio mod: use `MID&101|MID&102`.
   - Referenciando itens originais do jogo: use diretamente o ID numérico puro (ex: `1001|1002`), sem o prefixo `MID&`.
5. **Sobrescrevendo Dados Originais**: Para alterar um registro existente do jogo (ex: balancear um item ou aumentar chance de spawn), crie uma linha com o **ID original exato** e preencha apenas as colunas que deseja modificar. As colunas vazias manterão os valores originais do jogo.

---

### Tabelas Mais Importantes do Jogo

| Tabela | Nome em Chinês | Função Principal |
| :--- | :--- | :--- |
| `RoleCreateFeature` | 气运表 | Destinos Inatos (先天气运), Destinos Adquiridos e Mudança de Destino (逆天改命). |
| `RoleEffect` | 角色效果表 | Efeitos passivos, buffs, bônus de atributos e modificadores aplicados ao personagem. |
| `PropsBase` / `ItemBase` | 道具基础表 | Itens de inventário, pílulas, manuais, elixires, materiais e tesouros. |
| `ItemHorse` | 坐骑表 | Configurações específicas de montarias (velocidade no mapa, modelo visual, efeitos). |
| `BattleSkillBase` | 技能基础表 | Habilidades marciais, artes espirituais, técnicas corporais e habilidades supremas. |
| `BattleSkillAttack` | 武技攻击表 | Parâmetros de dano, custos de Qi, alcance, tempo de recarga e animações de ataque. |
| `BattleMissile` | 弹道配置表 | Projéteis, velocidades de trajetória, modelos visuais e detecção de acerto. |
| `FortuitousEvent` | 奇遇配置表 | Encontros aleatórios no mapa-múndi, condições de disparo e chances. |
| `DramaOptions` | 剧情选项表 | Caixas de diálogo, opções de escolha, texto narrativo e comandos executados. |
| `DramaNpc` | 剧情NPC表 | NPCs de história, parâmetros de aparição, modelo de retrato e personalidade. |
| `LocalText` | 国际化文本 | Textos de interface do usuário, descrições de itens, botões e menus. |
| `RoleLogLocal` | 剧情对话文本 | Falas, diálogos dinâmicos de NPCs, eventos de mundo e crônicas do personagem. |

---

### Exemplo Prático 1: Criando um Novo Destino Natural (先天气运)

Para adicionar um destino inato poderoso chamado **"Herdeiro da Espada Celestial"** que concede +100 de Afinidade com Espada e uma Espada Espiritual no início do jogo:

1. **Na tabela `RoleCreateFeature.xlsx`**:
   - `id`: `MID&1`
   - `name`: `Herdeiro da Espada Celestial` (ou chave em `LocalText.json`)
   - `desc`: `Descendente do clã divino da espada. Aumenta afinidade com espada em 100 e concede uma espada ancestral.`
   - `type`: `1` (1 = Destino Inato / Criação de Personagem; 2 = Destino Adquirido; 3 = Mudança de Destino / Ruptura de Reino)
   - `grade`: `6` (Qualidade: 1=Cinza, 2=Verde, 3=Azul, 4=Roxo, 5=Laranja, 6=Vermelho/Mítico)
   - `weight`: `100` (Peso de probabilidade no sorteio de dados inicial)
   - `effect`: `MID&101|MID&102` (Vincula aos efeitos definidos em `RoleEffect`)

2. **Na tabela `RoleEffect.xlsx`**:
   - Linha 1 (Bônus de Atributo):
     - `id`: `MID&101`
     - `effectType`: `1` (Modificar Atributo)
     - `propType`: `61` (Afinidade com Espada - `Sword`)
     - `valueType`: `1` (1 = Valor Fixo; 2 = Porcentagem)
     - `value`: `100`
   - Linha 2 (Conceder Item Inicial):
     - `id`: `MID&102`
     - `effectType`: `5` (Função Especial: Conceder Item/Produção)
     - `param`: `10001` (ID do item ou artefato desejado)

---

### Exemplo Prático 2: Criando um Encontro/Evento Aleatório (奇遇)

Para criar um evento onde o jogador encontra um misterioso poço espiritual no mapa:

1. **Na tabela `FortuitousEvent.xlsx`**:
   - `id`: `MID&50`
   - `type`: `1` (Disparado ao andar no mapa-múndi)
   - `probability`: `30` (30% de chance quando as condições forem atendidas)
   - `repeat`: `0` (0 = Não repete; 1 = Pode repetir)
   - `condition`: `level>=3` (Apenas jogadores no reino Qi Refining intermediário ou superior)
   - `dramaId`: `MID&200` (Chama a narrativa configurada em `DramaOptions`)

2. **Na tabela `DramaOptions.xlsx`**:
   - `id`: `MID&200`
   - `dialogType`: `1` (Janela de diálogo padrão com ilustração)
   - `text`: `Ao atravessar uma clareira enevoada, você encontra uma fonte jorrando Qi condensado em gotas prateadas. O que você faz?`
   - `leftButton`: `Beber da fonte`
   - `leftFunction`: `1|100` (Comando 1: Adicionar Qi/Cultivação +100)
   - `rightButton`: `Coletar em um frasco e partir`
   - `rightFunction`: `9|MID&301|1` (Comando 9: Adicionar Item `MID&301` quantidade `1`)

---

### Exemplo Prático 3: Criando um NPC Customizado com Aparência e Laços

No menu do editor de mods ou nas tabelas `WorldNPCBase` e `DramaNpc`:
- **Nome e Sobrenome**: Configure `surname` e `name` (ou vincule a chaves do `LocalText`).
- **Aparência (Rosto / Vestes)**: Copie o código de aparência (Face Data string) exportado da tela de criação de personagem do jogo e cole na coluna `dressData`.
- **Relação Inicial com o Jogador**: Configure a coluna `relation`:
  - `type`: `1` (1 = Amigo/Conhecido, 2 = Mestre/Discípulo, 3 = Casal/Parceiro Daoísta, 4 = Irmão jurado, 5 = Inimigo)
  - `intimacy`: `150` (Afinidade inicial entre 0 e 300)

---

## 4. Tema 2: Modificação de Gráficos e Sons (`ModAssets`)

### Regra de Ouro do Espelhamento de Recursos
A pasta `ModAssets/` funciona como um sistema de **injeção por sobreposição**:
- O jogo verifica primeiro se o arquivo requisitado existe em `ModAssets/`.
- Se existir, ele substitui o recurso original da Unity sem precisar alterar nenhum arquivo de dados!

```
Jogo Interno:  Resources/Texture/Battle/Skill/sword_slash.png
Seu Mod:       ModAssets/Texture/Battle/Skill/sword_slash.png  (Sobrescreve o original!)
```

### Ícones, Montarias e Retratos
- **Ícones de Itens (`Props/`)**:
  - Resolução: **60x60 pixels**, PNG de 32 bits com fundo transparente (Alpha Channel).
- **Montarias (`Horse/`)**:
  - Exige duas imagens PNG:
    1. `HorseUI`: Imagem de exibição de alta resolução com fundo transparente usada na tela de detalhes do personagem.
    2. `HorseMap`: Imagem recortada do modelo da montaria andando no mapa-múndi. O ponto de montaria (`Top/Post`) deve coincidir com a cintura do boneco.
- **Retratos de Personagens (`Portrait/`)**:
  - O sistema de retratos de *Tales of Immortal* é modular (cabelo, olhos, nariz, boca, roupas, adornos de costas, adornos de cabeça).
  - Cada peça nova deve ter seu arquivo `.png` com tamanho e alinhamento idênticos às peças base contidas na pasta de exemplos `资源修改教程/Resources（资源对照）/Portrait/`.

### Efeitos Sonoros e Músicas
- Formatos aceitos: `.wav` (preferível para efeitos sonoros curtos de combate) e `.mp3` / `.ogg` (para músicas de fundo e ambientes).
- Pastas padrão em `ModAssets/`:
  - `Sound/Battle/`: Sons de ataques, explosões, lâminas e impactos.
  - `Sound/UI/`: Sons de cliques, aberturas de pergaminhos e notificações.

---

## 5. Tema 3: Modelos 3D, Prefabs e AssetBundles (`ModRes`)

### Requisitos Técnicos (Unity 2020.3.9)
> [!IMPORTANT]
> **Versão Obrigatória do Unity:** Para compilar AssetBundles e Prefabs compatíveis com o jogo, você **DEVE** utilizar exatamente a versão **Unity 2020.3.9f1** (64-bit). Qualquer versão superior ou inferior pode causar corrupção de cabeçalho no carregamento do bundle.

### O Projeto `ResBuildABProject`
Dentro de `ModProject/ModRes/` encontra-se o projeto Unity pronto:
1. Abra o projeto `ResBuildABProject` no **Unity Hub** com a versão 2020.3.9.
2. Coloque seus novos prefabs na pasta `Assets/Resources/...`.
3. Nunca crie prefabs do zero: duplique um prefab de exemplo existente na pasta (ex: monstro, projétil ou barreira) para herdar os scripts essenciais (`BarrierCtrl`, `EffectUnitNodeCtrl`, componentes de colisão 2D).
4. No menu superior da Unity, clique em **Tools -> Build AssetBundles** (ou "更新AB").
5. O jogo gerará automaticamente os bundles em `Assets/AssetBundle/`.

### Criação de Monstros e Chefes (BattleMonst)
- **Componentes Obrigatórios**:
  - `BoxCollider2D`: Caixa de colisão e hit-box para projéteis do jogador.
  - `Rigidbody2D`: Configuração de massa.
    - Para **monstros comuns**: configure `Mass = 150`.
    - Para **Chefes (Bosses)**: configure `Mass = 1000000` (um milhão) para impedir que o chefe seja empurrado por habilidades ou outros inimigos.
  - Ponto de Posição (`Posi`): Objeto vazio que define a barra de vida e a posição dos números de dano.
  - Animação de Ataque: Se a habilidade tiver tempo de conjuração, insira o evento de animação chamado `Attack` no frame de disparo.

### Substituição e Criação de Telas de Interface (UI Prefabs)
As telas do jogo ficam na pasta `UI/`:
- Telas customizadas devem conter uma classe que herde de `UIBase`.
- Para invocar uma tela criada via código C#:
  ```csharp
  g.ui.OpenUI<MeuPainelCustomizado>("UI/MinhaJanelaPrefab");
  ```

---

## 6. Tema 4: Programação Avançada em C# com Harmony (`ModCode`)

### Ambiente de Compilação (.NET 4.7.2 + Roslyn)
- O motor de scripts do jogo exige **.NET Framework 4.7.2**.
- Como o jogo usa IL2CPP, compiladores legados do Windows (C# 5 do .NET 4.0) falham com erro `CS0008` ao ler metadados modernos de bibliotecas como `UnityEngine.CoreModule.dll`.
- **Solução Recomendada**: Utilize o compilador moderno **Roslyn** (`csc.exe` v4.x ou Visual Studio 2022).
- **Regra Crucial de Dependências**: As referências a assemblies da Unity e do jogo (`Il2Cppmscorlib.dll`, `UnhollowerBaseLib.dll`, `Assembly-CSharp.dll`, `0Harmony.dll`) devem ter **`Copy Local = False`** (`<Private>False</Private>`). Se DLLs do jogo forem copiadas para a pasta `Release/`, o mod falhará ao carregar!

### Ciclo de Vida do Mod (`ModMain`, `Init`, `Destroy`)
O ponto de entrada de todo mod é a classe `ModMain` dentro do namespace `MOD_<SoleID>`:

```csharp
using System;
using System.Reflection;
using HarmonyLib;
using UnityEngine;

namespace MOD_VMCUi0
{
    public class ModMain
    {
        private Harmony harmony;

        // Chamado uma única vez quando o mod é carregado pelo MelonLoader
        public void Init()
        {
            Debug.Log("[MeuMod] Inicializando componentes C#...");
            
            // Instancia o Harmony com o SoleID único do mod
            harmony = new Harmony("MOD_VMCUi0");
            
            // Aplica todos os métodos anotados com [HarmonyPatch]
            harmony.PatchAll(Assembly.GetExecutingAssembly());
            
            Debug.Log("[MeuMod] Harmony patches aplicados com sucesso!");
        }

        // Chamado quando o mod é descarregado ou ao fechar o jogo
        public void Destroy()
        {
            if (harmony != null)
            {
                harmony.UnpatchSelf();
                harmony = null;
            }
            Debug.Log("[MeuMod] Descarregado.");
        }
    }
}
```

---

### Injeção de Código com Harmony (Prefix, Postfix, Transpiler)

O Harmony permite modificar o comportamento de qualquer função privada ou pública do jogo sem precisar editar o código original:

#### 1. Prefix (Executa ANTES do método original)
Pode ler argumentos, alterar parâmetros e até cancelar a execução do método original retornando `false`:
```csharp
[HarmonyPatch(typeof(PlayerController), "AddHealth")]
public class Patch_AddHealth
{
    // __instance dá acesso ao objeto que chamou a função
    // __0, __1 representam os parâmetros do método original
    public static bool Prefix(PlayerController __instance, ref int amount)
    {
        if (amount < 0)
        {
            amount = (int)(amount * 0.5f); // Reduz todo dano recebido em 50%!
        }
        return true; // Continua para executar o método original com o novo valor
    }
}
```

#### 2. Postfix (Executa DEPOIS do método original)
Ideal para inspecionar ou alterar o valor de retorno (`__result`) ou disparar ações secundárias:
```csharp
[HarmonyPatch(typeof(DungeonReward), "GenerateDrop")]
public class Patch_GenerateDrop
{
    public static void Postfix(ref int __result)
    {
        // Se a masmorra não soltou itens raros, dobra a recompensa em dinheiro
        Debug.Log("[MeuMod] Recompensa gerada com sucesso!");
    }
}
```

---

### APIs Globais do Jogo (`g.world`, `g.conf`, `g.data`, `g.ui`, `g.events`)
O jogo disponibiliza uma classe estática global chamada `g` que dá acesso direto ao estado do mundo:

```csharp
// 1. Dados e Tabelas de Configuração
var conf = g.conf.roleCreateFeature.GetItem("1201"); // Lê uma linha de configuração

// 2. Estado do Mundo e Jogador
var player = g.world.player; // Obtém o personagem do jogador
int espiritualidade = player.data.dynAttrs.mp; // Lê mana atual

// 3. Sistema de Notificações e UI
g.ui.MsgBox("Aviso", "Você descobriu um pergaminho secreto nas profundezas da montanha!");

// 4. Barramento de Eventos
g.events.On(EBattleType.BattleEnd, (Action<EBattleEndData>)OnBattleFinish);
```

---

### Manipulação de TextMeshPro e Auto-Sizing de Textos
Como demonstrado no nosso mod de tradução e utilitários, o jogo utiliza TextMeshPro (`TMPro.TextMeshProUGUI`) para renderização de tipografia:

1. **Tags de Estilo Rich Text Suportadas**:
   - `<size=16>Texto Menor</size>`: Reduz pontualmente textos que estouram caixas de diálogo.
   - `<color=#E2B04A>Texto Dourado</color>`: Destaque de itens lendários.
   - `{icon_gailv}`: Ícone de dado de probabilidade embutido no jogo.
2. **Hook Universal de Auto-Sizing**:
   Para evitar que qualquer texto transborde de janelas de UI, o patch intercepta o setter `TMP_Text.text`:
   ```csharp
   [HarmonyPatch(typeof(TMPro.TMP_Text), "set_text")]
   public class AutoSizePatch
   {
       public static void Postfix(TMPro.TMP_Text __instance)
       {
           if (__instance != null && !__instance.enableAutoSizing)
           {
               __instance.enableAutoSizing = true;
               __instance.fontSizeMin = 10f;
               __instance.fontSizeMax = __instance.fontSize;
           }
       }
   }
   ```

---

## 7. Tema 5: Fluxo de Testes, Depuração e Publicação na Oficina Steam

### Ativando o Console de Desenvolvedor do MelonLoader
Para acompanhar erros em tempo real e ver saídas de `Debug.Log()`:
1. Abra a sua biblioteca da **Steam**.
2. Clique com botão direito em **Tales of Immortal** -> **Propriedades**.
3. No campo **Opções de Inicialização**, adicione:
   ```text
   --melonloader.showconsole
   ```
4. Ao abrir o jogo, uma janela preta do console do Windows aparecerá exibindo o carregamento de cada assembly, patches do Harmony e possíveis erros de sintaxe de tabelas.

---

### O Modo de Depuração Interno ("进入游戏调试")
1. No menu principal do jogo, clique em **Mod Editor** (模组开发).
2. Selecione o seu projeto.
3. No canto inferior direito, clique em **"进入游戏调试"** (Entrar em Depuração do Jogo).
4. O editor compilará automaticamente os arquivos de `ModExcel` para `ModData.cache`, copiará sua DLL de `bin/Release` para `debug/Mod_<SoleID>/ModCode/dll/` e carregará o jogo em modo sandbox.

---

### Checklist para Publicação na Steam Workshop
Antes de clicar em **"上传到创意工坊"** (Enviar para a Oficina Steam):

- [ ] **SoleID Intacto**: Nunca altere manualmente o `SoleID` gerado na criação do mod, pois a Steam o utiliza para saber se está atualizando um mod existente ou criando um novo.
- [ ] **DLL Única na Pasta**: Verifique se a pasta `ModCode/dll/` contém **APENAS** o arquivo `MOD_<SoleID>.dll`. Nenhuma dependência (`UnityEngine.dll`, etc.) deve estar presente ali.
- [ ] **IDs com Prefixo `MID&`**: Garanta que nenhum novo registro de tabela foi salvo com número puro sem o `MID&`, evitando conflito com outros mods da oficina.
- [ ] **Imagem de Capa (`cover.png`)**: Imagem com proporção 16:9 ou 1:1, tamanho inferior a 1 MB, no formato PNG.
- [ ] **Descrição Clara**: Descreva as alterações em Português e Inglês para que a comunidade saiba o que esperar e declare possíveis incompatibilidades.

---

> *Este documento foi compilado com base na engenharia reversa do código do jogo, nos manuais originais da Lightning Games e na implementação prática do Mod de Tradução e Melhorias PT-BR (SoleID: `VMCUi0`).*
