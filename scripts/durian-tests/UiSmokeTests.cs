using System;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Threading;
using System.Collections.Generic;
using System.Windows.Forms;
using QHSWeight;
using QHSWeight.Class;
using QHSWeight.GUI;
using QHSWeight.Model;

internal static class UiSmokeTests
{
    private static int checks;
    private static void Check(bool value, string message) { checks++; if (!value) throw new Exception(message); }
    private static FieldInfo Field(string name) { return typeof(frmCans).GetField(name, BindingFlags.NonPublic | BindingFlags.Instance); }
    private static void Set(frmCans form, string name, object value) { Field(name).SetValue(form, value); }
    private static T Get<T>(frmCans form, string name) { return (T)Field(name).GetValue(form); }
    private static object Call(frmCans form, string name, params object[] args)
    {
        return typeof(frmCans).GetMethod(name, BindingFlags.NonPublic | BindingFlags.Instance).Invoke(form, args);
    }
    [STAThread]
    public static int Main(string[] args)
    {
        var watchdog = new Thread(() => { Thread.Sleep(45000); Console.Error.WriteLine("UI test timed out"); Environment.Exit(3); }) { IsBackground = true };
        watchdog.Start();
        string lib = args[0];
        AppDomain.CurrentDomain.AssemblyResolve += (sender, e) =>
        {
            string path = Path.Combine(lib, new AssemblyName(e.Name).Name + ".dll");
            return File.Exists(path) ? Assembly.LoadFrom(path) : null;
        };
        try { return Run(); }
        catch (Exception ex) { Console.Error.WriteLine(ex); return 1; }
    }
    [MethodImpl(MethodImplOptions.NoInlining)]
    private static int Run()
    {
        string root = Path.Combine(Path.GetTempPath(), "qhs-bench-ui-tests-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);
        try
        {
            Environment.SetEnvironmentVariable("QHS_BENCH_RECOVERY_ROOT", root);
            Global.appconfig = new IniFile(Path.Combine(root, "isolated.ini"));
            Global.Settings.password = new string('x', 512);
            Check(Global.Settings.password == new string('x', 512) && Global.appconfig.Read("password").StartsWith("dpapi1:"), "INI read preserves long encrypted login secrets");
            Global.CurrentGroup = new tbusers_group { id = 9001, enable = true };
            Global.currentuser = new tbuser { id = 7, username = "test", idusergroup = 9001, iduserrole = 1, enable = true };
            Global.currentrole = new tbusers_role { idtbusers_role = 1, enable = true, administration = true };
            ItemsBLL.DataSource.DataSource = new List<tbitem>();
            CustomersBLL.DataSource.DataSource = new List<tbcustomer>();
            RFID.InitializeBenchRecovery();
            Check(typeof(RFID).GetMethod("OpenCom").GetParameters()[1].ParameterType == typeof(int), "Production serial baud configuration can represent 115200 without UInt16 overflow");
            var store = new DurableJsonStore(Path.Combine(RFID.RecoveryRoot, "drafts"));
            using (var form = new frmCans())
            {
                Call(form, "InitTongHopGrid"); Call(form, "InitLogGrid"); Call(form, "InitRecoveryButtons");
                Set(form, "draftStore", store); Set(form, "canAdd", true); Set(form, "canEdit", true);
                Call(form, "RefreshDraftOwners");
                var binding = Get<BindingSource>(form, "bindingWeight");
                binding.DataSource = new List<tbweight>();
                Get<Dictionary<string, string>>(form, "itemTypeNameCache")["a"] = "Test type";
                Get<Dictionary<string, string>>(form, "employeeNameCache")["1001"] = "Test employee";
                Call(form, "btnNew_Click", null, EventArgs.Empty);
                Check(Get<tbweight>(form, "item") != null && Get<bool>(form, "dirty"), "New receipt creates durable dirty draft");
                var frame = RFID.BenchInbox.Enqueue("@typea(1001)+000052*s1#");
                Check((bool)Call(form, "HandleScaleSwipe", frame), "Receive on new receipt");
                Check(Get<tbweight>(form, "item").net_weight == 5.2m, "Binding callbacks do not erase received weight");
                Check((bool)Call(form, "HasUnacknowledgedSwipes"), "Do not commit a receipt while its durable event is still pending acknowledgement");
                string originalDraft = Get<string>(form, "draftId");
                Set(form, "draftId", Guid.NewGuid().ToString("N"));
                Check(!(bool)Call(form, "HandleScaleSwipe", frame), "A pending event owned by another draft cannot be attached to a different receipt");
                Set(form, "draftId", originalDraft); Set(form, "captureArmed", true);
                Call(form, "HandleScaleSwipe", frame);
                Check(Get<Dictionary<string, BenchItemGroup>>(form, "itemGroups")["a"].Entries.Count == 1, "Replayed pending event is counted once by the real form");
                RFID.BenchInbox.Acknowledge(frame);
                Check(!(bool)Call(form, "HasUnacknowledgedSwipes"), "Acknowledged draft is eligible for database commit");
                Call(form, "OnUnitPriceTyping", 0, "10000");
                Check(Get<tbweight>(form, "item").price_total == 52000m, "Price updates real form totals");
                Call(form, "OnUnitPriceTyping", 0, "bad-value");
                Check(Get<HashSet<string>>(form, "invalidPrices").Contains("a"), "Invalid price remains blocked instead of throwing or saving zero");
                Call(form, "OnUnitPriceTyping", 0, "12000");
                Check(Get<tbweight>(form, "item").price_total == 62400m, "Corrected price updates totals");
                Get<DevExpress.XtraEditors.TextEdit>(form, "txtBSX").Text = "51C-TEST";
                var restored = store.Read<BenchDraft>(store.Keys().Single());
                Check(restored.Groups[0].Entries.Count == 1 && restored.Groups[0].Entries[0].EventId == frame.Id && restored.Groups[0].UnitPrice == 12000m,
                    "Real form persists received events and prices for recovery");
                Check(restored.Header.truct_no == "51C-TEST", "Header text edit is persisted even though the model uses a plain auto property");
                string draftId = Get<string>(form, "draftId");
                var blocked = new DurableJsonStore(Path.Combine(root, "blocked"));
                Directory.CreateDirectory(Path.Combine(root, "blocked", draftId + ".json"));
                Set(form, "draftStore", blocked);
                var retry = new ReceivedScaleFrame { Id = Guid.NewGuid().ToString("N"), Raw = frame.Raw, ReceivedAt = DateTime.Now };
                bool failed = false;
                try { Call(form, "HandleScaleSwipe", retry); } catch (TargetInvocationException) { failed = true; }
                Check(failed, "Disk failure prevents successful swipe acknowledgement");
                Set(form, "draftStore", store);
                Call(form, "HandleScaleSwipe", retry);
                Check(Get<tbweight>(form, "item").net_weight == 10.4m && Get<Dictionary<string, BenchItemGroup>>(form, "itemGroups")["a"].Entries.Count == 2,
                    "Retry after a failed draft write renders the event once");
                Set(form, "canAdd", false); Set(form, "canEdit", false); form.Control_Access(1);
                Check(!Get<DevExpress.XtraEditors.SimpleButton>(form, "btnUpdate").Enabled, "State transitions cannot re-enable unauthorized save");
                var second = new ReceivedScaleFrame { Id = Guid.NewGuid().ToString("N"), Raw = frame.Raw, ReceivedAt = DateTime.Now };
                Check(!(bool)Call(form, "HandleScaleSwipe", second), "Unauthorized capture remains pending");
                Set(form, "canAdd", true); Set(form, "canEdit", true); Set(form, "dirty", false);
                binding.DataSource = new List<tbweight> { new tbweight { truct_no = "CLEAN" } };
                Check(!Get<bool>(form, "dirty") && Get<tbweight>(form, "item").truct_no == "CLEAN", "Binding a different record does not create a phantom draft or overwrite its header");
                store.Write("badkey", new BenchDraft { Id = Guid.NewGuid().ToString("N"), StationId = 9001, UserId = 7,
                    Header = new tbweight(), Groups = new List<BenchItemGroup>() });
                bool blockedRecovery = false;
                try { Call(form, "RefreshDraftOwners"); } catch (TargetInvocationException) { blockedRecovery = true; }
                Check(blockedRecovery && !Get<bool>(form, "recoveryReady"), "Invalid recovery identity blocks accepting new events instead of silently reassigning old ones");
            }
            Console.WriteLine("PASS: " + checks + " actual WinForms binding/draft/price/permission smoke checks. Hidden controls; no DB, COM or printer used.");
            return 0;
        }
        finally
        {
            string absolute = Path.GetFullPath(root);
            if (!string.Equals(Path.GetDirectoryName(absolute), Path.GetTempPath().TrimEnd(Path.DirectorySeparatorChar), StringComparison.OrdinalIgnoreCase) ||
                !Path.GetFileName(absolute).StartsWith("qhs-bench-ui-tests-", StringComparison.Ordinal)) throw new InvalidOperationException("Unsafe test cleanup path");
            Directory.Delete(absolute, true);
        }
    }
}
