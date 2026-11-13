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
                Debug.Log("[Tales PT-BR] Mod C# ativado: Auto-ajuste de fontes e interface ativo!");
            }
            catch (Exception ex)
            {
                Debug.LogError("[Tales PT-BR] Erro ao iniciar patches Harmony: " + ex.ToString());
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
    /// Patch em TextMeshPro: Ativa auto-ajuste de tamanho (Auto-Sizing) dinâmico
    /// EXCLUSIVAMENTE para botões, rótulos e badges curtos de UI que correm risco de corte.
    /// Trava de segurança: JAMAIS aplica em textos longos, caixas de FAQ ou diálogos roláveis,
    /// para evitar quebra de layout e sobreposição vertical de parágrafos.
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
                // Ignora textos vazios ou textos longos (parágrafos, FAQs, crônicas)
                if (string.IsNullOrEmpty(t) || t.Length > 120) return;

                // Ignora textos que já possuem tags de tamanho explícito ou múltiplas quebras de linha
                if (t.Contains("<size") || t.Contains("\\n") || t.Contains("\\\\n")) return;

                if (!__instance.enableAutoSizing)
                {
                    float currentSize = __instance.fontSize;
                    // Aplica apenas em rótulos e botões com fonte intermediária (>= 12)
                    if (currentSize >= 12f)
                    {
                        __instance.enableAutoSizing = true;
                        __instance.fontSizeMin = Math.Max(8f, currentSize * 0.70f);
                        __instance.fontSizeMax = currentSize;
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
