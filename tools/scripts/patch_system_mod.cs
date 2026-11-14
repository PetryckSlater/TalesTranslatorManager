using System;
using System.IO;
using System.Linq;
using Mono.Cecil;
using Mono.Cecil.Cil;

class Program
{
    static void Main()
    {
        string originalDll = @"D:\SteamLibrary\steamapps\workshop\content\1468810\3816613883\ModCode\dll\MOD_yUMKFJ.dll.bak";
        string targetDll = @"D:\SteamLibrary\steamapps\workshop\content\1468810\3816613883\ModCode\dll\MOD_yUMKFJ.dll";

        var resolver = new DefaultAssemblyResolver();
        resolver.AddSearchDirectory(@"D:\SteamLibrary\steamapps\common\鬼谷八荒\MelonLoader\Managed");
        resolver.AddSearchDirectory(@"D:\SteamLibrary\steamapps\common\鬼谷八荒\MelonLoader");

        var asm = AssemblyDefinition.ReadAssembly(originalDll, new ReaderParameters { AssemblyResolver = resolver });
        var mod = asm.MainModule;

        Console.WriteLine("[1] Patching ModLog.Info...");
        PatchModLog(mod);

        Console.WriteLine("[2] Patching SystemPersistence.IsWorldReady...");
        PatchIsWorldReady(mod);

        Console.WriteLine("[3] Patching SystemMenuController.IsInWorld...");
        PatchIsInWorld(mod);

        Console.WriteLine("[4] Patching SystemMenuController.Tick...");
        PatchTick(mod);

        Console.WriteLine("[5] Writing patched assembly to target...");
        asm.Write(targetDll);
        Console.WriteLine("SUCCESS! Target written: " + targetDll);
    }

    static void PatchModLog(ModuleDefinition mod)
    {
        var modLogType = mod.GetType("MOD_yUMKFJ.ModLog");
        var infoMethod = modLogType.Methods.First(m => m.Name == "Info");

        var modMain = mod.GetType("MOD_yUMKFJ.ModMain");
        var initHelper = modMain.NestedTypes.First(t => t.Name == "<>c").Methods.First(m => m.Name == "<Init>b__5_0");
        
        MethodReference opImplicit = null;
        MethodReference debugLog = null;
        foreach (var inst in initHelper.Body.Instructions)
        {
            if (inst.Operand is MethodReference mr)
            {
                if (mr.Name == "op_Implicit") opImplicit = mr;
                if (mr.Name == "Log" && mr.DeclaringType.Name == "Debug") debugLog = mr;
            }
        }

        infoMethod.Body.Instructions.Clear();
        var il = infoMethod.Body.GetILProcessor();
        var retInst = il.Create(OpCodes.Ret);

        il.Append(il.Create(OpCodes.Ldarg_0));
        il.Append(il.Create(OpCodes.Brfalse_S, retInst));
        il.Append(il.Create(OpCodes.Ldarg_0));
        il.Append(il.Create(OpCodes.Call, opImplicit));
        il.Append(il.Create(OpCodes.Call, debugLog));
        il.Append(retInst);
    }

    static void PatchIsWorldReady(ModuleDefinition mod)
    {
        var sysPersist = mod.GetType("MOD_yUMKFJ.SystemPersistence");
        var isWorldReady = sysPersist.Methods.First(m => m.Name == "IsWorldReady");
        var getObjData = sysPersist.Methods.First(m => m.Name == "GetObjData");

        MethodReference getWorld = null;
        MethodReference getPlayerUnit = null;
        foreach (var inst in getObjData.Body.Instructions)
        {
            if (inst.Operand is MethodReference mr)
            {
                if (mr.Name == "get_world") getWorld = mr;
                if (mr.Name == "get_playerUnit") getPlayerUnit = mr;
            }
        }

        isWorldReady.Body.Instructions.Clear();
        isWorldReady.Body.ExceptionHandlers.Clear();
        isWorldReady.Body.Variables.Clear();

        var varResult = new VariableDefinition(mod.TypeSystem.Boolean);
        isWorldReady.Body.Variables.Add(varResult);

        var il = isWorldReady.Body.GetILProcessor();
        var retInst = il.Create(OpCodes.Ldloc_0);
        var lblRet = il.Create(OpCodes.Ret);

        var lblTryStart = il.Create(OpCodes.Call, getWorld);
        var lblRetFalse = il.Create(OpCodes.Ldc_I4_0);

        il.Append(lblTryStart);
        il.Append(il.Create(OpCodes.Brfalse_S, lblRetFalse));
        il.Append(il.Create(OpCodes.Call, getWorld));
        il.Append(il.Create(OpCodes.Callvirt, getPlayerUnit));
        il.Append(il.Create(OpCodes.Ldnull));
        il.Append(il.Create(OpCodes.Cgt_Un));
        il.Append(il.Create(OpCodes.Stloc_0));
        il.Append(il.Create(OpCodes.Leave_S, retInst));

        il.Append(lblRetFalse);
        il.Append(il.Create(OpCodes.Stloc_0));
        il.Append(il.Create(OpCodes.Leave_S, retInst));

        var catchStart = il.Create(OpCodes.Pop);
        il.Append(catchStart);
        il.Append(il.Create(OpCodes.Ldc_I4_0));
        il.Append(il.Create(OpCodes.Stloc_0));
        il.Append(il.Create(OpCodes.Leave_S, retInst));

        il.Append(retInst);
        il.Append(lblRet);

        isWorldReady.Body.ExceptionHandlers.Add(new ExceptionHandler(ExceptionHandlerType.Catch)
        {
            TryStart = lblTryStart,
            TryEnd = catchStart,
            HandlerStart = catchStart,
            HandlerEnd = retInst,
            CatchType = mod.ImportReference(typeof(Exception))
        });
    }

    static void PatchIsInWorld(ModuleDefinition mod)
    {
        var sysPersist = mod.GetType("MOD_yUMKFJ.SystemPersistence");
        var getObjData = sysPersist.Methods.First(m => m.Name == "GetObjData");

        MethodReference getWorld = null;
        MethodReference getPlayerUnit = null;
        foreach (var inst in getObjData.Body.Instructions)
        {
            if (inst.Operand is MethodReference mr)
            {
                if (mr.Name == "get_world") getWorld = mr;
                if (mr.Name == "get_playerUnit") getPlayerUnit = mr;
            }
        }

        var menuCtrl = mod.GetType("MOD_yUMKFJ.SystemMenuController");
        var isInWorld = menuCtrl.Methods.First(m => m.Name == "IsInWorld");
        MethodReference getRun = null;
        foreach (var inst in isInWorld.Body.Instructions)
        {
            if (inst.Operand is MethodReference mr && mr.Name == "get_run")
            {
                getRun = mr;
            }
        }

        isInWorld.Body.Instructions.Clear();
        isInWorld.Body.ExceptionHandlers.Clear();
        isInWorld.Body.Variables.Clear();

        var varResult = new VariableDefinition(mod.TypeSystem.Boolean);
        isInWorld.Body.Variables.Add(varResult);

        var il = isInWorld.Body.GetILProcessor();
        var retVal = il.Create(OpCodes.Ldloc_0);
        var retInst = il.Create(OpCodes.Ret);

        var tryStart = il.Create(OpCodes.Call, getWorld);
        var checkPlayer = il.Create(OpCodes.Call, getWorld);
        var checkRun = il.Create(OpCodes.Call, getWorld);
        var setTrue = il.Create(OpCodes.Ldc_I4_1);
        var setFalse = il.Create(OpCodes.Ldc_I4_0);

        // if (g.world == null) goto setFalse
        il.Append(tryStart);
        il.Append(il.Create(OpCodes.Brfalse_S, setFalse));

        // if (g.world.playerUnit != null) goto setTrue
        il.Append(checkPlayer);
        il.Append(il.Create(OpCodes.Callvirt, getPlayerUnit));
        il.Append(il.Create(OpCodes.Brtrue_S, setTrue));

        // if (g.world.run != null) goto setTrue
        il.Append(checkRun);
        il.Append(il.Create(OpCodes.Callvirt, getRun));
        il.Append(il.Create(OpCodes.Brtrue_S, setTrue));

        // setFalse:
        il.Append(setFalse);
        il.Append(il.Create(OpCodes.Stloc_0));
        il.Append(il.Create(OpCodes.Leave_S, retVal));

        // setTrue:
        il.Append(setTrue);
        il.Append(il.Create(OpCodes.Stloc_0));
        il.Append(il.Create(OpCodes.Leave_S, retVal));

        // catch:
        var catchStart = il.Create(OpCodes.Pop);
        il.Append(catchStart);
        il.Append(il.Create(OpCodes.Ldc_I4_0));
        il.Append(il.Create(OpCodes.Stloc_0));
        il.Append(il.Create(OpCodes.Leave_S, retVal));

        il.Append(retVal);
        il.Append(retInst);

        isInWorld.Body.ExceptionHandlers.Add(new ExceptionHandler(ExceptionHandlerType.Catch)
        {
            TryStart = tryStart,
            TryEnd = catchStart,
            HandlerStart = catchStart,
            HandlerEnd = retVal,
            CatchType = mod.ImportReference(typeof(Exception))
        });
    }

    static void PatchTick(ModuleDefinition mod)
    {
        var menuCtrl = mod.GetType("MOD_yUMKFJ.SystemMenuController");
        var tick = menuCtrl.Methods.First(m => m.Name == "Tick");

        MethodReference getSystemStatus = null;
        MethodReference setVisible = null;
        MethodReference getKeyDown = null;
        FieldReference visibleField = null;

        foreach (var inst in tick.Body.Instructions)
        {
            if (inst.Operand is MethodReference mr)
            {
                if (mr.Name == "get_systemStatus") getSystemStatus = mr;
                if (mr.Name == "SetVisible") setVisible = mr;
                if (mr.Name == "GetKeyDown") getKeyDown = mr;
            }
            if (inst.Operand is FieldReference fr && fr.Name == "visible")
            {
                visibleField = fr;
            }
        }

        var gameInteg = mod.GetType("MOD_yUMKFJ.GameIntegration");
        var startActivation = gameInteg.Methods.First(m => m.Name == "StartActivation");

        int cutIndex = -1;
        for (int i = 0; i < tick.Body.Instructions.Count; i++)
        {
            var inst = tick.Body.Instructions[i];
            if (inst.OpCode == OpCodes.Ldloc_0 && i > 10)
            {
                var prev = tick.Body.Instructions[i - 1];
                if (prev.OpCode == OpCodes.Call && prev.Operand.ToString().Contains("SafeRun"))
                {
                    cutIndex = i;
                    break;
                }
            }
        }

        if (cutIndex == -1)
        {
            throw new Exception("Could not find cut point after SafeRun in Tick");
        }

        Console.WriteLine($"Cut index in Tick: {cutIndex} (removing {tick.Body.Instructions.Count - cutIndex} old instructions)");
        while (tick.Body.Instructions.Count > cutIndex)
        {
            tick.Body.Instructions.RemoveAt(tick.Body.Instructions.Count - 1);
        }

        var il = tick.Body.GetILProcessor();
        var retInst = il.Create(OpCodes.Ret);
        var checkP = il.Create(OpCodes.Ldc_I4_S, (sbyte)112);
        var toggleVis = il.Create(OpCodes.Ldarg_0);

        // 1. If (!inWorld) return;
        il.Append(il.Create(OpCodes.Ldloc_0));
        il.Append(il.Create(OpCodes.Brfalse_S, retInst));

        // 2. If (this.systemStatus == null) StartActivation();
        il.Append(il.Create(OpCodes.Ldarg_0));
        il.Append(il.Create(OpCodes.Call, getSystemStatus));
        il.Append(il.Create(OpCodes.Brtrue_S, checkP));
        il.Append(il.Create(OpCodes.Call, startActivation));

        // 3. check_P: If (Input.GetKeyDown(KeyCode.P))
        il.Append(checkP);
        il.Append(il.Create(OpCodes.Call, getKeyDown));
        il.Append(il.Create(OpCodes.Brfalse_S, retInst));

        // 4. If P was pressed: ensure activated if null
        il.Append(il.Create(OpCodes.Ldarg_0));
        il.Append(il.Create(OpCodes.Call, getSystemStatus));
        il.Append(il.Create(OpCodes.Brtrue_S, toggleVis));
        il.Append(il.Create(OpCodes.Call, startActivation));

        // 5. toggle_visible: this.SetVisible(!this.visible)
        il.Append(toggleVis);
        il.Append(il.Create(OpCodes.Ldarg_0));
        il.Append(il.Create(OpCodes.Ldfld, visibleField));
        il.Append(il.Create(OpCodes.Ldc_I4_0));
        il.Append(il.Create(OpCodes.Ceq));
        il.Append(il.Create(OpCodes.Call, setVisible));

        // 6. ret
        il.Append(retInst);
    }
}
