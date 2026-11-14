using System;
using System.IO;
using System.Reflection;
using MelonLoader;
using HarmonyLib;
using TMPro;
using UnityEngine;
using UnhollowerBaseLib;

[assembly: MelonInfo(typeof(TalesPTBR.TalesLoaderMod), "TalesPTBR_Loader", "1.5.0", "TalesPTBR")]
[assembly: MelonGame("UNKNOWN", "UNKNOWN")]

namespace TalesPTBR
{
    public class TalesLoaderMod : MelonMod
    {
        public override void OnApplicationStart()
        {
            MelonLogger.Msg("=============================================================");
            MelonLogger.Msg("  [Tales PT-BR] Loader & Performance Guardian v1.5.0 ativo!");
            MelonLogger.Msg("  - Bypass de descriptografia para JSONs em texto claro: ATIVO");
            MelonLogger.Msg("  - Guardião do mod The System (Tecla P): ATIVO");
            MelonLogger.Msg("  - Destrave de FPS e VSync para Menus: ATIVO");
            MelonLogger.Msg("=============================================================");

            try
            {
                QualitySettings.vSyncCount = 0;
                Application.targetFrameRate = 144;
                Application.runInBackground = true;
            }
            catch (Exception ex)
            {
                MelonLogger.Warning("Aviso ao configurar taxa de quadros: " + ex.Message);
            }
        }

        public override void OnSceneWasLoaded(int buildIndex, string sceneName)
        {
            try
            {
                QualitySettings.vSyncCount = 0;
                Application.targetFrameRate = 144;
                Application.runInBackground = true;
            }
            catch { }
        }
    }

    /// <summary>
    /// Bypass inteligente de descriptografia:
    /// Evita que JSONs em texto claro (já traduzidos) sejam corrompidos por EncryptTool.DecryptMult.
    /// Arquivos encriptados legítimos (como tabelas originais do jogo) continuam sendo descriptografados normalmente.
    /// </summary>
    [HarmonyPatch(typeof(EncryptTool), "DecryptMult", new Type[] { typeof(Il2CppStructArray<byte>), typeof(string) })]
    public static class Patch_DecryptMult_2
    {
        public static bool Prefix(Il2CppStructArray<byte> bytes, string key, ref Il2CppStructArray<byte> __result)
        {
            if (bytes != null && bytes.Length > 0)
            {
                byte b0 = bytes[0];
                // Verifica caracteres iniciais de JSON válido em UTF-8: '[' (91), '{' (123) ou espaços em branco
                if (b0 == 0x5B || b0 == 0x7B || b0 == 0x20 || b0 == 0x09 || b0 == 0x0D || b0 == 0x0A)
                {
                    __result = bytes;
                    return false; // Pula a descriptografia, pois já é JSON em texto claro!
                }
                // Tratamento especial para UTF-8 BOM (0xEF, 0xBB, 0xBF)
                if (b0 == 0xEF && bytes.Length >= 3 && bytes[1] == 0xBB && bytes[2] == 0xBF)
                {
                    __result = bytes;
                    return false;
                }
            }
            return true;
        }
    }

    [HarmonyPatch(typeof(EncryptTool), "EncryptMult", new Type[] { typeof(Il2CppStructArray<byte>), typeof(string), typeof(bool) })]
    public static class Patch_EncryptMult_3
    {
        public static bool Prefix(Il2CppStructArray<byte> bytes, string key, bool isEncrypt, ref Il2CppStructArray<byte> __result)
        {
            if (!isEncrypt && bytes != null && bytes.Length > 0)
            {
                byte b0 = bytes[0];
                if (b0 == 0x5B || b0 == 0x7B || b0 == 0x20 || b0 == 0x09 || b0 == 0x0D || b0 == 0x0A)
                {
                    __result = bytes;
                    return false;
                }
                if (b0 == 0xEF && bytes.Length >= 3 && bytes[1] == 0xBB && bytes[2] == 0xBF)
                {
                    __result = bytes;
                    return false;
                }
            }
            return true;
        }
    }

    /// <summary>
    /// Hook no loop principal de câmera do jogo (CameraCtrl.Update):
    /// Garante que o mod The System receba atualização todo frame e responda à tecla P no mundo.
    /// </summary>
    [HarmonyPatch(typeof(CameraCtrl), "Update")]
    public static class Patch_CameraCtrl_Update
    {
        public static void Postfix()
        {
            TheSystemWatcher.Tick();
        }
    }

    /// <summary>
    /// Guardião de Compatibilidade para o mod The System (MOD_yUMKFJ):
    /// Garante que a tecla 'P' continue abrindo o painel sem conflito de ciclo.
    /// </summary>
    public static class TheSystemWatcher
    {
        private static MethodInfo startActivationMethod;
        private static MethodInfo getActiveStatusMethod;
        private static MethodInfo setActiveStatusMethod;
        private static Type systemStatusType;
        private static Type systemMenuCtrlType;
        private static FieldInfo visibleField;
        private static MethodInfo setVisibleMethod;
        private static FieldInfo instanceField;
        private static MethodInfo tickMethod;
        private static bool reflectionInitialized;
        private static bool systemFound;

        public static void Tick()
        {
            try
            {
                if (!reflectionInitialized)
                {
                    systemMenuCtrlType = AccessTools.TypeByName("MOD_yUMKFJ.SystemMenuController");
                    if (systemMenuCtrlType != null)
                    {
                        instanceField = AccessTools.Field(systemMenuCtrlType, "Instance");
                        visibleField = AccessTools.Field(systemMenuCtrlType, "visible");
                        setVisibleMethod = AccessTools.Method(systemMenuCtrlType, "SetVisible", new[] { typeof(bool) });
                        tickMethod = AccessTools.Method(systemMenuCtrlType, "Tick");
                        systemFound = true;
                    }

                    Type gi = AccessTools.TypeByName("MOD_yUMKFJ.GameIntegration");
                    if (gi != null) startActivationMethod = AccessTools.Method(gi, "StartActivation");

                    systemStatusType = AccessTools.TypeByName("MOD_yUMKFJ.SystemStatus");
                    if (systemStatusType != null)
                    {
                        getActiveStatusMethod = AccessTools.Method(systemStatusType, "GetActiveStatus");
                        setActiveStatusMethod = AccessTools.Method(systemStatusType, "SetActive");
                    }

                    reflectionInitialized = true;
                }

                if (!systemFound || instanceField == null) return;

                object instance = instanceField.GetValue(null);
                if (instance == null) return;

                if (tickMethod != null)
                {
                    tickMethod.Invoke(instance, null);
                }

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
                        bool curVisible = (bool)visibleField.GetValue(instance);
                        setVisibleMethod.Invoke(instance, new object[] { !curVisible });
                    }
                }
            }
            catch { }
        }
    }

    /// <summary>
    /// Patch de alta performance para TextMeshPro:
    /// Evita corte em textos de botões sem onerar inventários e menus com alta densidade de slots.
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

                if (t.Length <= 5 || char.IsDigit(t[0])) return;
                if (t.Length > 90) return;
                if (t.Contains("<size") || t.Contains("\n") || t.Contains("\\n")) return;

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
            catch { }
        }
    }
}
