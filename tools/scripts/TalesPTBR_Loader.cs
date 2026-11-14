using System;
using System.IO;
using System.Reflection;
using MelonLoader;
using HarmonyLib;
using TMPro;
using UnityEngine;
using UnhollowerBaseLib;

[assembly: MelonInfo(typeof(TalesPTBR.TalesLoaderMod), "TalesPTBR_Loader", "1.6.0", "TalesPTBR")]
[assembly: MelonGame("UNKNOWN", "UNKNOWN")]

namespace TalesPTBR
{
    public class TalesLoaderMod : MelonMod
    {
        public override void OnApplicationStart()
        {
            MelonLogger.Msg("=============================================================");
            MelonLogger.Msg("  [Tales PT-BR] Loader & Performance Guardian v1.6.0 ativo!");
            MelonLogger.Msg("  - Bypass de descriptografia para JSONs em texto claro: ATIVO");
            MelonLogger.Msg("  - Guardião do mod The System (Tecla P no OnUpdate): ATIVO");
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

        public override void OnUpdate()
        {
            TheSystemWatcher.OnUpdate();
        }
    }

    /// <summary>
    /// Bypass inteligente de descriptografia:
    /// Evita que JSONs em texto claro (já traduzidos) sejam corrompidos por EncryptTool.DecryptMult.
    /// Arquivos encriptados legítimos continuam sendo descriptografados normalmente.
    /// </summary>
    [HarmonyPatch(typeof(EncryptTool), "DecryptMult", new Type[] { typeof(Il2CppStructArray<byte>), typeof(string) })]
    public static class Patch_DecryptMult_2
    {
        public static bool Prefix(Il2CppStructArray<byte> bytes, string key, ref Il2CppStructArray<byte> __result)
        {
            if (bytes != null && bytes.Length > 0)
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
    /// Guardião de Compatibilidade para o mod The System (MOD_yUMKFJ):
    /// Roda diretamente no OnUpdate do MelonMod (loop nativo da engine, a cada frame),
    /// garantindo que a tecla 'P' funcione em qualquer lugar do jogo (mapa, cidade, seita, combate, etc.).
    /// </summary>
    public static class TheSystemWatcher
    {
        private static Type systemMenuCtrlType;
        private static FieldInfo instanceField;
        private static FieldInfo visibleField;
        private static MethodInfo setVisibleMethod;
        private static MethodInfo buildUiMethod;
        private static FieldInfo uiBuiltField;
        private static MethodInfo tickMethod;
        private static Type modMainType;
        private static FieldInfo modMainCtrlField;
        private static MethodInfo ensureCtrlMethod;
        private static Type gameIntegType;
        private static MethodInfo startActivationMethod;
        private static Type systemStatusType;
        private static MethodInfo getActiveStatusMethod;
        private static MethodInfo setActiveStatusMethod;
        private static bool bound = false;
        private static float lastSearchTime = 0f;

        public static void OnUpdate()
        {
            try
            {
                if (!bound)
                {
                    // Tenta vincular periodicamente a cada 1 segundo se ainda não encontrou
                    if (Time.unscaledTime - lastSearchTime > 1.0f)
                    {
                        lastSearchTime = Time.unscaledTime;
                        TryBind();
                    }
                }

                // Se o jogador pressionar P:
                if (UnityEngine.Input.GetKeyDown(UnityEngine.KeyCode.P))
                {
                    MelonLogger.Msg("[TalesPTBR] Tecla P detectada no OnUpdate!");
                    if (!bound)
                    {
                        TryBind();
                    }

                    if (!bound)
                    {
                        MelonLogger.Warning("[TalesPTBR] Mod The System ainda não carregado.");
                        return;
                    }

                    object ctrlInstance = GetControllerInstance();
                    if (ctrlInstance == null)
                    {
                        MelonLogger.Warning("[TalesPTBR] Instância do SystemMenuController não encontrada.");
                        return;
                    }

                    // 1. Garante ativação do sistema
                    EnsureActive(ctrlInstance);

                    // 2. Garante construção da interface
                    EnsureUi(ctrlInstance);

                    // 3. Alterna visibilidade
                    if (visibleField != null && setVisibleMethod != null)
                    {
                        bool curVisible = (bool)visibleField.GetValue(ctrlInstance);
                        bool newVisible = !curVisible;
                        setVisibleMethod.Invoke(ctrlInstance, new object[] { newVisible });
                        MelonLogger.Msg("[TalesPTBR] The System visibilidade alterada com sucesso para: " + newVisible);
                    }
                }
                else
                {
                    // Se P NÃO foi pressionado neste frame, executa o Tick do controlador para manter timers e animações
                    if (bound)
                    {
                        object ctrlInstance = GetControllerInstance();
                        if (ctrlInstance != null && tickMethod != null)
                        {
                            tickMethod.Invoke(ctrlInstance, null);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                MelonLogger.Error("[TalesPTBR] Erro no OnUpdate do The System: " + ex.Message);
            }
        }

        private static void TryBind()
        {
            try
            {
                foreach (var asm in AppDomain.CurrentDomain.GetAssemblies())
                {
                    if (asm.GetName().Name == "MOD_yUMKFJ")
                    {
                        systemMenuCtrlType = asm.GetType("MOD_yUMKFJ.SystemMenuController");
                        modMainType = asm.GetType("MOD_yUMKFJ.ModMain");
                        gameIntegType = asm.GetType("MOD_yUMKFJ.GameIntegration");
                        systemStatusType = asm.GetType("MOD_yUMKFJ.SystemStatus");

                        if (systemMenuCtrlType != null)
                        {
                            instanceField = AccessTools.Field(systemMenuCtrlType, "Instance");
                            visibleField = AccessTools.Field(systemMenuCtrlType, "visible");
                            setVisibleMethod = AccessTools.Method(systemMenuCtrlType, "SetVisible", new[] { typeof(bool) });
                            buildUiMethod = AccessTools.Method(systemMenuCtrlType, "BuildUI");
                            uiBuiltField = AccessTools.Field(systemMenuCtrlType, "uiBuilt");
                            tickMethod = AccessTools.Method(systemMenuCtrlType, "Tick");
                        }

                        if (modMainType != null)
                        {
                            modMainCtrlField = AccessTools.Field(modMainType, "controller");
                            ensureCtrlMethod = AccessTools.Method(modMainType, "EnsureController");
                        }

                        if (gameIntegType != null)
                        {
                            startActivationMethod = AccessTools.Method(gameIntegType, "StartActivation");
                        }

                        if (systemStatusType != null)
                        {
                            getActiveStatusMethod = AccessTools.Method(systemStatusType, "GetActiveStatus");
                            setActiveStatusMethod = AccessTools.Method(systemStatusType, "SetActive");
                        }

                        if (systemMenuCtrlType != null && setVisibleMethod != null)
                        {
                            bound = true;
                            MelonLogger.Msg("[TalesPTBR] The System vinculado com sucesso ao guardião OnUpdate!");
                        }
                        break;
                    }
                }
            }
            catch { }
        }

        private static object GetControllerInstance()
        {
            object inst = null;
            if (instanceField != null)
            {
                inst = instanceField.GetValue(null);
            }
            if (inst == null && modMainCtrlField != null)
            {
                inst = modMainCtrlField.GetValue(null);
            }
            if (inst == null && ensureCtrlMethod != null)
            {
                try { ensureCtrlMethod.Invoke(null, null); } catch { }
                if (instanceField != null) inst = instanceField.GetValue(null);
                if (inst == null && modMainCtrlField != null) inst = modMainCtrlField.GetValue(null);
            }
            if (inst == null)
            {
                try
                {
                    var root = g.root;
                    if (root != null && systemMenuCtrlType != null)
                    {
                        inst = root.GetComponent(UnhollowerRuntimeLib.Il2CppType.From(systemMenuCtrlType));
                    }
                }
                catch { }
            }
            return inst;
        }

        private static void EnsureActive(object ctrl)
        {
            try
            {
                if (getActiveStatusMethod != null && getActiveStatusMethod.Invoke(null, null) == null)
                {
                    if (startActivationMethod != null)
                    {
                        startActivationMethod.Invoke(null, null);
                    }
                    if (getActiveStatusMethod != null && getActiveStatusMethod.Invoke(null, null) == null && setActiveStatusMethod != null && systemStatusType != null)
                    {
                        object newStatus = Activator.CreateInstance(systemStatusType);
                        setActiveStatusMethod.Invoke(null, new object[] { newStatus });
                    }
                }
            }
            catch { }
        }

        private static void EnsureUi(object ctrl)
        {
            try
            {
                if (uiBuiltField != null && buildUiMethod != null)
                {
                    bool uiBuilt = (bool)uiBuiltField.GetValue(ctrl);
                    if (!uiBuilt)
                    {
                        buildUiMethod.Invoke(ctrl, null);
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
