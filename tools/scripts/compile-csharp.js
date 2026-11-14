const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const config = require('../config');

function compileCSharp() {
  console.log('-----------------------------------------------------');
  console.log('    Compilando Módulo C# Harmony (MOD_VMCUi0.dll)');
  console.log('-----------------------------------------------------');

  const csc = path.join(config.rootDir, 'tools', 'roslyn', 'tasks', 'net472', 'csc.exe');
  
  // Buscar automaticamente onde o jogo está instalado
  const possibleGameDirs = [
    'D:/SteamLibrary/steamapps/common/鬼谷八荒',
    'D:/SteamLibrary/steamapps/common/TOI',
    'C:/Program Files (x86)/Steam/steamapps/common/鬼谷八荒',
    'C:/Program Files/Steam/steamapps/common/鬼谷八荒'
  ];

  let gameDir = null;
  for (const d of possibleGameDirs) {
    if (fs.existsSync(d) && fs.existsSync(path.join(d, 'MelonLoader'))) {
      gameDir = d;
      break;
    }
  }

  if (!fs.existsSync(csc)) {
    console.warn('[Aviso] Compilador Roslyn C# não encontrado. Pulando compilação da DLL.');
    return false;
  }

  if (!gameDir) {
    console.warn('[Aviso] Pasta do jogo TOI / 鬼谷八荒 com MelonLoader não encontrada para referências.');
    return false;
  }

  const melon = path.join(gameDir, 'MelonLoader');
  const managed = path.join(melon, 'Managed');

  // Destinos da DLL
  const modCodeDir = path.join(config.rootDir, 'ModProject_VMCUi0', 'ModProject', 'ModCode');
  const srcDir = path.join(modCodeDir, 'ModMain');
  const dllDir = path.join(modCodeDir, 'dll');
  const binReleaseDir = path.join(srcDir, 'bin', 'Release');

  const pubCodeDir = path.join(config.rootDir, 'output', 'ModCode');
  const pubDllDir = path.join(pubCodeDir, 'dll');

  [srcDir, dllDir, binReleaseDir, pubDllDir].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });

  const csharpSource = `using System;
using System.Collections.Generic;
using System.Reflection;
using HarmonyLib;
using TMPro;
using UnityEngine;

namespace MOD_VMCUi0
{
    /// <summary>
    /// Mod de Tradução PT-BR & Auto-Ajuste de Interface (Tales of Immortal)
    /// Desenvolvido para a comunidade por Petryck Slater & Take Over
    /// </summary>
    public class ModMain
    {
        private static Harmony harmony;
        private static bool systemModPatched = false;

        public void Init()
        {
            try
            {
                if (harmony != null)
                {
                    harmony.UnpatchSelf();
                    harmony = null;
                }
                harmony = new Harmony("MOD_VMCUi0");
                harmony.PatchAll(Assembly.GetExecutingAssembly());

                // Desbloqueia taxa de quadros e desativa gargalo de VSync em menus
                try
                {
                    QualitySettings.vSyncCount = 0;
                    Application.targetFrameRate = 144;
                    Application.runInBackground = true;
                }
                catch { }

                // Guardião de compatibilidade em RAM para o mod The System (MOD_yUMKFJ)
                // Garante que mesmo se a Steam atualizar a DLL do mod, o menu e a tecla 'P' continuam funcionando
                try
                {
                    AppDomain.CurrentDomain.AssemblyLoad += (sender, args) =>
                    {
                        try
                        {
                            if (args.LoadedAssembly.GetName().Name == "MOD_yUMKFJ")
                            {
                                TryPatchTheSystem();
                            }
                        }
                        catch { }
                    };
                    TryPatchTheSystem();
                }
                catch { }

                Debug.Log("[Tales PT-BR] Mod C# v1.3 ativo: Compatibilidade total com mods da oficina, guardião The System e taxa de quadros destravada!");
            }
            catch (Exception ex)
            {
                Debug.LogError("[Tales PT-BR] Erro ao iniciar patches Harmony: " + ex.ToString());
            }
        }

        public static void TryPatchTheSystem()
        {
            if (systemModPatched || harmony == null) return;
            try
            {
                Type smc = AccessTools.TypeByName("MOD_yUMKFJ.SystemMenuController");
                if (smc == null) return;

                MethodInfo target = AccessTools.Method(smc, "Tick");
                if (target == null) return;

                MethodInfo prefix = AccessTools.Method(typeof(Patch_TheSystem_Tick), "Prefix");
                harmony.Patch(target, new HarmonyMethod(prefix));
                systemModPatched = true;
                Debug.Log("[Tales PT-BR] The System: Guardião de compatibilidade em RAM ativado com sucesso!");
            }
            catch (Exception ex)
            {
                Debug.LogError("[Tales PT-BR] Erro ao aplicar guardião do The System: " + ex.Message);
            }
        }

        public void Destroy()
        {
            try
            {
                if (harmony != null)
                {
                    harmony.UnpatchSelf();
                    harmony = null;
                    systemModPatched = false;
                    Debug.Log("[Tales PT-BR] Mod C# descarregado.");
                }
            }
            catch (Exception ex)
            {
                Debug.LogError("[Tales PT-BR] Erro ao descarregar mod: " + ex.Message);
            }
        }
    }

    /// <summary>
    /// Guardião de Compatibilidade para o mod The System (MOD_yUMKFJ):
    /// Garante que mesmo se a Steam atualizar a DLL do mod da oficina para uma versão com bug,
    /// a inicialização e a tecla 'P' continuam funcionando sem falhas diretamente em memória RAM.
    /// </summary>
    public static class Patch_TheSystem_Tick
    {
        private static MethodInfo startActivationMethod;
        private static MethodInfo getActiveStatusMethod;
        private static MethodInfo setActiveStatusMethod;
        private static Type systemStatusType;
        private static FieldInfo visibleField;
        private static MethodInfo setVisibleMethod;
        private static bool reflectionInitialized;

        public static void Prefix(object __instance)
        {
            if (__instance == null) return;
            try
            {
                if (!reflectionInitialized)
                {
                    Type gi = AccessTools.TypeByName("MOD_yUMKFJ.GameIntegration");
                    if (gi != null) startActivationMethod = AccessTools.Method(gi, "StartActivation");

                    systemStatusType = AccessTools.TypeByName("MOD_yUMKFJ.SystemStatus");
                    if (systemStatusType != null)
                    {
                        getActiveStatusMethod = AccessTools.Method(systemStatusType, "GetActiveStatus");
                        setActiveStatusMethod = AccessTools.Method(systemStatusType, "SetActive");
                    }

                    Type smc = AccessTools.TypeByName("MOD_yUMKFJ.SystemMenuController");
                    if (smc != null)
                    {
                        visibleField = AccessTools.Field(smc, "visible");
                        setVisibleMethod = AccessTools.Method(smc, "SetVisible", new[] { typeof(bool) });
                    }
                    reflectionInitialized = true;
                }

                // Auto-ativação contínua quando o personagem está no mundo
                if (getActiveStatusMethod != null && getActiveStatusMethod.Invoke(null, null) == null)
                {
                    if (startActivationMethod != null)
                    {
                        startActivationMethod.Invoke(null, null);
                    }
                }

                // Destrave definitivo da tecla P
                if (UnityEngine.Input.GetKeyDown(UnityEngine.KeyCode.P))
                {
                    if (getActiveStatusMethod != null && getActiveStatusMethod.Invoke(null, null) == null)
                    {
                        if (startActivationMethod != null) startActivationMethod.Invoke(null, null);
                        if (getActiveStatusMethod != null && getActiveStatusMethod.Invoke(null, null) == null && setActiveStatusMethod != null && systemStatusType != null)
                        {
                            object newStatus = Activator.CreateInstance(systemStatusType);
                            setActiveStatusMethod.Invoke(null, new object[] { newStatus });
                        }
                    }

                    if (visibleField != null && setVisibleMethod != null)
                    {
                        bool curVisible = (bool)visibleField.GetValue(__instance);
                        setVisibleMethod.Invoke(__instance, new object[] { !curVisible });
                    }
                }
            }
            catch { }
        }
    }

    /// <summary>
    /// Patch de alta performance para TextMeshPro:
    /// Aplica Auto-Sizing EXCLUSIVAMENTE em botões e menus que correm risco de corte.
    /// TRAVAS RÍGIDAS DE DESEMPENHO E COMPATIBILIDADE:
    /// - Ignora completamente inventário, mochilas, slots, grades e contadores de itens.
    /// - Ignora números, durações, moedas e palavras muito curtas.
    /// - Ignora textos longos (> 90 chars), caixas roláveis, tooltips e parágrafos.
    /// - NÃO interfere em nenhum componente ou hook de outros mods da oficina.
    /// </summary>
    [HarmonyPatch(typeof(TMP_Text), "text", MethodType.Setter)]
    public static class Patch_TMP_Text_SetText
    {
        public static void Postfix(TMP_Text __instance)
        {
            if (__instance == null) return;
            try
            {
                string t = __instance.text;
                if (string.IsNullOrEmpty(t)) return;

                // 1. Pular instantaneamente contadores numéricos ("1", "x99", "Lv.1", moedas)
                if (t.Length <= 5 || char.IsDigit(t[0])) return;

                // 2. Pular textos médios e longos (parágrafos, FAQs, crônicas, descrições)
                if (t.Length > 90) return;

                // 3. Pular tags de tamanho explícito ou textos multilinha
                if (t.Contains("<size") || t.Contains("\\n") || t.Contains("\\\\n")) return;

                // 4. Bloquear execução no inventário / slots de itens / grades (evita travamento ao abrir mochila)
                string objName = __instance.gameObject.name;
                if (objName.IndexOf("slot", StringComparison.OrdinalIgnoreCase) >= 0 ||
                    objName.IndexOf("item", StringComparison.OrdinalIgnoreCase) >= 0 ||
                    objName.IndexOf("prop", StringComparison.OrdinalIgnoreCase) >= 0 ||
                    objName.IndexOf("grid", StringComparison.OrdinalIgnoreCase) >= 0 ||
                    objName.IndexOf("cell", StringComparison.OrdinalIgnoreCase) >= 0 ||
                    objName.IndexOf("bag", StringComparison.OrdinalIgnoreCase) >= 0 ||
                    objName.IndexOf("count", StringComparison.OrdinalIgnoreCase) >= 0 ||
                    objName.IndexOf("num", StringComparison.OrdinalIgnoreCase) >= 0 ||
                    objName.IndexOf("icon", StringComparison.OrdinalIgnoreCase) >= 0 ||
                    objName.IndexOf("tip", StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    return;
                }

                // 5. Aplicar apenas em rótulos e botões reais clicáveis
                if (!__instance.enableAutoSizing)
                {
                    float currentSize = __instance.fontSize;
                    if (currentSize >= 13f && currentSize <= 36f)
                    {
                        var btn = __instance.GetComponentInParent<UnityEngine.UI.Button>();
                        if (btn != null)
                        {
                            __instance.enableAutoSizing = true;
                            __instance.fontSizeMin = Math.Max(10f, currentSize * 0.75f);
                            __instance.fontSizeMax = currentSize;
                        }
                    }
                }
            }
            catch
            {
                // Silencioso para evitar impacto na taxa de quadros (FPS)
            }
        }
    }
}
`;

  const srcFile = path.join(srcDir, 'ModMain.cs');
  fs.writeFileSync(srcFile, csharpSource, 'utf8');

  const targetDllPrivate = path.join(dllDir, 'MOD_VMCUi0.dll');
  const targetDllRelease = path.join(binReleaseDir, 'MOD_VMCUi0.dll');
  const targetDllPublic = path.join(pubDllDir, 'MOD_VMCUi0.dll');

  const refs = [
    path.join(melon, '0Harmony.dll'),
    path.join(managed, 'Il2Cppmscorlib.dll'),
    path.join(managed, 'UnhollowerBaseLib.dll'),
    path.join(managed, 'Unity.TextMeshPro.dll'),
    path.join(managed, 'UnityEngine.CoreModule.dll'),
    path.join(managed, 'UnityEngine.InputLegacyModule.dll'),
    path.join(managed, 'UnityEngine.UI.dll'),
    path.join(managed, 'UnityEngine.TextCoreModule.dll'),
    path.join(managed, 'UnityEngine.TextRenderingModule.dll'),
    path.join(managed, 'Assembly-CSharp.dll')
  ];

  for (const r of refs) {
    if (!fs.existsSync(r)) {
      console.warn(`[Aviso] Referência ausente: ${r}`);
      return false;
    }
  }

  const refFlags = refs.map(r => `/r:"${r}"`).join(' ');
  const cmd = `"${csc}" /target:library /out:"${targetDllPrivate}" /optimize+ ${refFlags} "${srcFile}"`;

  try {
    const out = execSync(cmd).toString();
    fs.copyFileSync(targetDllPrivate, targetDllRelease);
    fs.copyFileSync(targetDllPrivate, targetDllPublic);

    // Sincronizar na pasta debug do Mod
    const debugDllDir = path.join(config.rootDir, 'ModProject_VMCUi0', 'debug', 'Mod_VMCUi0', 'ModCode', 'dll');
    if (fs.existsSync(path.join(config.rootDir, 'ModProject_VMCUi0', 'debug', 'Mod_VMCUi0'))) {
      if (!fs.existsSync(debugDllDir)) fs.mkdirSync(debugDllDir, { recursive: true });
      fs.copyFileSync(targetDllPrivate, path.join(debugDllDir, 'MOD_VMCUi0.dll'));
    }

    // Sincronizar na pasta ativa da Oficina Steam se existir
    const workshopDir = 'D:/SteamLibrary/steamapps/workshop/content/1468810/2990310797';
    if (fs.existsSync(workshopDir)) {
      const wsDll1 = path.join(workshopDir, 'ModProject', 'ModCode', 'dll');
      const wsDll2 = path.join(workshopDir, 'debug', 'Mod_VMCUi0', 'ModCode', 'dll');
      const wsDll3 = path.join(workshopDir, 'ModProject', 'ModCode', 'ModMain', 'bin', 'Release');
      [wsDll1, wsDll2, wsDll3].forEach(d => {
        if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
        fs.copyFileSync(targetDllPrivate, path.join(d, 'MOD_VMCUi0.dll'));
      });
      console.log('  ✓ DLL sincronizada diretamente na pasta da Oficina Steam!');
    }

    console.log(`  ✓ MOD_VMCUi0.dll gerada com sucesso (${(fs.statSync(targetDllPrivate).size / 1024).toFixed(1)} KB).`);
    return true;
  } catch (err) {
    console.error('Falha na compilação do C#:', err.stdout ? err.stdout.toString() : err.message);
    return false;
  }
}

module.exports = compileCSharp;

if (require.main === module) {
  compileCSharp();
}
