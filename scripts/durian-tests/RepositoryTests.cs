using System;
using System.Data;
using System.Data.SQLite;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using Dapper;
using Dapper.Contrib.Extensions;
using QHSWeight.Class;
using QHSWeight.Model;

// SQLite is ONLY a disposable test store. The adapter removes SQL Server locking hints;
// this exercises real SQL/rollback/idempotency, not SQL Server/MySQL lock semantics.
internal static class RepositoryTests
{
    private static int checks;
    private static void Check(bool condition, string message) { checks++; if (!condition) throw new Exception(message); }
    public static int Run(string root)
    {
        string cs = "Data Source=" + Path.Combine(root, "isolated.sqlite") + ";Foreign Keys=True;Pooling=False";
        using (var db = new SQLiteConnection(cs))
        {
            db.Open();
            foreach (Type model in new[] { typeof(tbweight), typeof(tbweight_detail), typeof(tbweight_entry), typeof(tbusers_group) })
            {
                var columns = model.GetProperties().Select(p =>
                {
                    Type t = Nullable.GetUnderlyingType(p.PropertyType) ?? p.PropertyType;
                    string type = p.Name == "id" ? "INTEGER PRIMARY KEY AUTOINCREMENT" : t == typeof(DateTime) ? "DATETIME" : t == typeof(decimal) ? "DECIMAL" : t == typeof(string) ? "TEXT" : "INTEGER";
                    return "\"" + p.Name + "\" " + type;
                });
                db.Execute("CREATE TABLE " + model.Name + " (" + string.Join(",", columns) + ")");
            }
            db.Execute("INSERT INTO tbusers_group(id,enable,lastid) VALUES(1,1,10),(2,1,20)");
            db.Execute("CREATE TABLE tbusers(id INTEGER PRIMARY KEY, idusergroup INTEGER, enable INTEGER, iduserrole INTEGER); INSERT INTO tbusers VALUES(7,1,1,1)");
            db.Execute("CREATE TABLE tbusers_role(idtbusers_role INTEGER PRIMARY KEY,enable INTEGER); INSERT INTO tbusers_role VALUES(1,1)");
            db.Execute("CREATE TABLE tbusers_permission(iduserrole INTEGER,idmenu TEXT,execute_add INTEGER,execute_edit INTEGER,execute_delete INTEGER); INSERT INTO tbusers_permission VALUES(1,'frmCan',1,1,1)");
        }
        SqlMapperExtensions.GetDatabaseType = c => "SQLiteConnection";
        bool failEntry = false, failCommit = false;
        var repository = new BenchReceiptRepository(() => new TestConnection(cs, () => failEntry, () => { if (failCommit) { failCommit = false; return true; } return false; }), false);
        Func<BenchDraft> make = () => new BenchDraft
        {
            Id = Guid.NewGuid().ToString("N"), StationId = 1, UserId = 7, SaveToken = Guid.NewGuid().ToString("N"),
            Header = new tbweight { truct_no = "TEST", date_in = DateTime.Now, user_id = "test", externdata = "legacy payload" },
            Groups = new List<BenchItemGroup> { new BenchItemGroup { ItemType = "a", UnitPrice = 10000,
                Entries = new List<BenchScanEntry> { new BenchScanEntry { EventId = Guid.NewGuid().ToString("N"), Time = DateTime.Now, Weight = 5.2m,
                    EmployeeCode = "1001", ScaleNumber = 1, RawData = "@typea(1001)+000052*s1#" } } } }
        };
        var draft = make();
        var inconsistent = make(); inconsistent.Groups[0].Entries[0].Weight = 9m;
        bool rawRejected = false;
        try { repository.Save(inconsistent); } catch (InvalidOperationException) { rawRejected = true; }
        Check(rawRejected, "Reject draft values that disagree with the original received frame");
        failEntry = true;
        try { repository.Save(draft); throw new Exception("Expected entry failure"); } catch (IOException) { }
        using (var db = new SQLiteConnection(cs))
        {
            Check(db.ExecuteScalar<int>("SELECT COUNT(*) FROM tbweight") == 0, "Entry failure rolls back header");
            Check(db.ExecuteScalar<int>("SELECT lastid FROM tbusers_group WHERE id=1") == 10, "Entry failure rolls back number allocation");
        }
        Check(draft.Header.id == 0 && draft.Groups[0].Id == 0, "Rollback does not leak generated IDs into UI draft");
        failEntry = false;
        var saved = repository.Save(draft);
        Check(saved.Header.formcode == "11" && saved.Header.net_weight == 5.2m && saved.Header.price_total == 52000m, "Atomic header/detail totals");
        Check(saved.Groups.Single().Entries.Single().Id > 0, "Entry receives persisted ID");
        Check(BenchReceiptRepository.IsBenchReceipt(saved.Header.externdata) && !BenchReceiptRepository.IsBenchReceipt("legacy payload"), "Persisted receipt kind routes bench printing/editing independently of a truck template setting");
        int oldId = saved.Groups.Single().Entries.Single().Id;
        Check(repository.Save(draft).Header.id == saved.Header.id, "Retry same new receipt returns committed receipt");
        using (var db = new SQLiteConnection(cs)) Check(db.ExecuteScalar<int>("SELECT COUNT(*) FROM tbweight_entry") == 1, "Retry does not duplicate entries");
        var oldCheckpoint = make(); oldCheckpoint.Id = draft.Id;
        bool duplicateCheckpoint = false;
        try { repository.Save(oldCheckpoint); } catch (InvalidOperationException) { duplicateCheckpoint = true; }
        Check(duplicateCheckpoint, "A restored checkpoint from before SaveToken does not recreate an already committed logical draft");

        var append = new BenchDraft { Id = Guid.NewGuid().ToString("N"), StationId = 1, UserId = 7, Header = saved.Header, Groups = saved.Groups,
            Baseline = saved.Fingerprint, SaveToken = Guid.NewGuid().ToString("N") };
        append.Groups[0].Entries.Add(new BenchScanEntry { EventId = Guid.NewGuid().ToString("N"), Time = DateTime.Now, Weight = 2m, EmployeeCode = "1002", ScaleNumber = 2, RawData = "@typea(1002)+000020*s2#" });
        var updated = repository.Save(append);
        Check(updated.Groups[0].Entries.Count == 2 && updated.Groups[0].Entries.Any(e => e.Id == oldId), "Append preserves historical IDs");
        Check(updated.Header.net_weight == 7.2m && updated.Header.price_total == 72000m, "Server recomputes totals");
        var audit = BenchReceiptRepository.Metadata(updated.Header.externdata)["_qhsBenchAudit"];
        Check(audit.Count() == 2 && (decimal)audit[1]["before"]["weight"] == 5.2m && (decimal)audit[1]["after"]["weight"] == 7.2m && (int)audit[1]["by"] == 7,
            "Audit keeps actor and before/after values in the committed receipt");
        Check(repository.Save(draft).Header.id == updated.Header.id, "Earlier commit retry still resolves after a later edit overwrites the latest token");
        bool refused = false;
        append.SaveToken = Guid.NewGuid().ToString("N");
        try { repository.Save(append); } catch (InvalidOperationException) { refused = true; }
        Check(refused, "Reject stale baseline after another save");
        refused = false;
        try { repository.Load(saved.Header.id, 2); } catch (InvalidOperationException) { refused = true; }
        Check(refused, "Receipt cannot be loaded through another station");

        var uncertain = make(); failCommit = true;
        try { repository.Save(uncertain); throw new Exception("Expected uncertain commit"); } catch (IOException) { }
        var resolved = repository.Save(uncertain);
        Check(resolved.Header.formcode == "12", "Resolve commit-success/response-failure using durable token");
        using (var db = new SQLiteConnection(cs))
        {
            Check(db.ExecuteScalar<int>("SELECT COUNT(*) FROM tbweight") == 2, "Uncertain commit retry does not create a second header");
            db.Execute("UPDATE tbweight SET notes='other workstation' WHERE id=@id", new { id = updated.Header.id });
        }
        refused = false;
        try { repository.Delete(updated.Header.id, 1, updated.Fingerprint, 7); } catch (InvalidOperationException) { refused = true; }
        Check(refused, "Stale delete cannot hide concurrently updated receipt");
        var latest = repository.Load(updated.Header.id, 1);
        repository.Delete(latest.Header.id, 1, latest.Fingerprint, 7);
        using (var db = new SQLiteConnection(cs)) Check((string)BenchReceiptRepository.Metadata(db.ExecuteScalar<string>("SELECT externdata FROM tbweight WHERE id=@id", new { id = latest.Header.id }))["_qhsBenchAudit"].Last()["action"] == "delete", "Soft deletion retains audit evidence");
        using (var db = new SQLiteConnection(cs)) Check(db.ExecuteScalar<int>("SELECT COUNT(*) FROM tbweight_entry") == 3, "Soft deletion preserves all historical entries");
        using (var db = new SQLiteConnection(cs)) db.Execute("UPDATE tbusers SET enable=0 WHERE id=7");
        refused = false;
        try { repository.Save(make()); } catch (UnauthorizedAccessException) { refused = true; }
        Check(refused, "Recheck active account in the transaction after an operator was disabled elsewhere");
        using (var db = new SQLiteConnection(cs)) db.Execute("UPDATE tbusers SET enable=1 WHERE id=7");
        using (var db = new SQLiteConnection(cs)) db.Execute("UPDATE tbusers_permission SET execute_add=0");
        refused = false;
        try { repository.Save(make()); } catch (UnauthorizedAccessException) { refused = true; }
        Check(refused, "Recheck write permission in the transaction after revocation");
        using (var db = new SQLiteConnection(cs)) db.Execute("UPDATE tbusers_permission SET execute_add=1");
        using (var db = new SQLiteConnection(cs)) db.Execute("CREATE TRIGGER simulate_integer_weight AFTER INSERT ON tbweight BEGIN UPDATE tbweight SET net_weight=CAST(net_weight AS INTEGER) WHERE id=NEW.id; END");
        refused = false;
        try { repository.Save(make()); } catch (InvalidOperationException) { refused = true; }
        Check(refused, "Reject schema that silently rounds fractional kg");
        using (var db = new SQLiteConnection(cs)) Check(db.ExecuteScalar<int>("SELECT COUNT(*) FROM tbweight") == 2, "Schema precision failure rolls back the whole new receipt");
        using (var db = new SQLiteConnection(cs))
        {
            db.Execute("DROP TRIGGER simulate_integer_weight; INSERT INTO tbweight(idusergroup,formcode,enable) VALUES(1,'100',0)");
        }
        Check(repository.Save(make()).Header.formcode == "101", "Recover number allocation when lastid is behind imported historical receipts");
        using (var db = new SQLiteConnection(cs)) db.Execute("CREATE TRIGGER simulate_rounded_entries AFTER INSERT ON tbweight_entry BEGIN UPDATE tbweight_entry SET weight_value=ROUND(weight_value,0) WHERE id=NEW.id; END");
        var compensating = make();
        compensating.Groups[0].Entries.Add(new BenchScanEntry { EventId = Guid.NewGuid().ToString("N"), Time = DateTime.Now, Weight = 4.8m,
            EmployeeCode = "1002", ScaleNumber = 2, RawData = "@typea(1002)+000048*s2#" });
        refused = false;
        try { repository.Save(compensating); } catch (InvalidOperationException) { refused = true; }
        Check(refused, "Detect individual weights rounded to 5 and 5 even when the original 5.2 + 4.8 total still matches");
        using (var db = new SQLiteConnection(cs)) db.Execute("DROP TRIGGER simulate_rounded_entries; CREATE TRIGGER simulate_truncated_metadata AFTER INSERT ON tbweight BEGIN UPDATE tbweight SET externdata=SUBSTR(externdata,1,40) WHERE id=NEW.id; END");
        refused = false;
        try { repository.Save(make()); } catch (InvalidOperationException) { refused = true; }
        Check(refused, "Reject silent metadata truncation before committing a receipt without its retry token");
        Console.WriteLine("PASS: " + checks + " repository SQL/rollback/retry checks on isolated SQLite; engine-specific locking not covered.");
        return checks;
    }

    private sealed class TestConnection : IDbConnection
    {
        internal readonly SQLiteConnection Inner;
        internal readonly Func<bool> FailEntry, FailCommit;
        public TestConnection(string cs, Func<bool> failEntry, Func<bool> failCommit) { Inner = new SQLiteConnection(cs); FailEntry = failEntry; FailCommit = failCommit; }
        public string ConnectionString { get { return Inner.ConnectionString; } set { Inner.ConnectionString = value; } }
        public int ConnectionTimeout { get { return Inner.ConnectionTimeout; } }
        public string Database { get { return Inner.Database; } }
        public ConnectionState State { get { return Inner.State; } }
        public void Open() { Inner.Open(); }
        public void Close() { Inner.Close(); }
        public void ChangeDatabase(string name) { Inner.ChangeDatabase(name); }
        public void Dispose() { Inner.Dispose(); }
        public IDbTransaction BeginTransaction() { return BeginTransaction(IsolationLevel.Serializable); }
        public IDbTransaction BeginTransaction(IsolationLevel level) { return new TestTransaction(this, Inner.BeginTransaction(level)); }
        public IDbCommand CreateCommand() { return new TestCommand(this, Inner.CreateCommand()); }
    }
    private sealed class TestTransaction : IDbTransaction
    {
        private readonly TestConnection owner;
        internal readonly SQLiteTransaction Inner;
        public TestTransaction(TestConnection owner, SQLiteTransaction inner) { this.owner = owner; Inner = inner; }
        public IDbConnection Connection { get { return owner; } }
        public IsolationLevel IsolationLevel { get { return Inner.IsolationLevel; } }
        public void Commit() { Inner.Commit(); if (owner.FailCommit()) throw new IOException("Simulated response loss AFTER database commit"); }
        public void Rollback() { Inner.Rollback(); }
        public void Dispose() { Inner.Dispose(); }
    }
    private sealed class TestCommand : IDbCommand
    {
        private readonly TestConnection owner;
        private readonly SQLiteCommand inner;
        public TestCommand(TestConnection owner, SQLiteCommand inner) { this.owner = owner; this.inner = inner; }
        public string CommandText { get { return inner.CommandText; } set { inner.CommandText = value.Replace(" WITH (UPDLOCK,HOLDLOCK)", "").Replace(" FOR UPDATE", "")
            .Replace("formcode NOT LIKE '%[^0-9]%' AND LEN(formcode) BETWEEN 1 AND 10", "formcode NOT GLOB '*[^0-9]*' AND length(formcode) BETWEEN 1 AND 10"); } }
        public int CommandTimeout { get { return inner.CommandTimeout; } set { inner.CommandTimeout = value; } }
        public CommandType CommandType { get { return inner.CommandType; } set { inner.CommandType = value; } }
        public IDbConnection Connection { get { return owner; } set { } }
        public IDataParameterCollection Parameters { get { return inner.Parameters; } }
        public IDbTransaction Transaction { get; set; }
        public UpdateRowSource UpdatedRowSource { get { return inner.UpdatedRowSource; } set { inner.UpdatedRowSource = value; } }
        private void Before()
        {
            inner.Transaction = Transaction == null ? null : ((TestTransaction)Transaction).Inner;
            if (owner.FailEntry() && inner.CommandText.IndexOf("insert into tbweight_entry", StringComparison.OrdinalIgnoreCase) >= 0)
                throw new IOException("Simulated detail failure");
        }
        public void Cancel() { inner.Cancel(); }
        public IDbDataParameter CreateParameter() { return inner.CreateParameter(); }
        public int ExecuteNonQuery() { Before(); return inner.ExecuteNonQuery(); }
        public IDataReader ExecuteReader() { Before(); return inner.ExecuteReader(); }
        public IDataReader ExecuteReader(CommandBehavior behavior) { Before(); return inner.ExecuteReader(behavior); }
        public object ExecuteScalar() { Before(); return inner.ExecuteScalar(); }
        public void Prepare() { inner.Prepare(); }
        public void Dispose() { inner.Dispose(); }
    }
}
