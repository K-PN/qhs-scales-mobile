using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using QHSWeight.Class;
using QHSWeight.Model;

internal static class ReliabilityTests
{
    private static int checks;
    private static void Check(bool ok, string message)
    {
        checks++;
        if (!ok) throw new Exception(message);
    }
    public static int Main()
    {
        string root = Path.Combine(Path.GetTempPath(), "qhs-bench-tests-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);
        try
        {
            const string frame = "@typea(1001)+000052*s1#";
            ScaleSwipeData swipe; string error;
            Check(ScaleCardProtocol.TryParse(frame, out swipe, out error) && swipe.Weight == 5.2m, "Weight decimal conversion");
            Check(!ScaleCardProtocol.TryParse("@typea(1001)+000052*s0#", out swipe, out error), "Reject scale zero");
            Check(!ScaleCardProtocol.TryParse("@typea(1001)+٠٠٠٠٥٢*s1#", out swipe, out error), "Reject non-ASCII digits without throwing");
            Check(ScaleCardProtocol.TryParse("@typeB(1)+000154*s99#", out swipe, out error) && swipe.ItemType == "b" && swipe.EmployeeCode == "0001", "Normalize codes and allow configured heads beyond three");
            for (int split = 0; split <= frame.Length; split++)
            {
                var stream = new ScaleFrameStream();
                var actual = stream.Append(frame.Substring(0, split)).Concat(stream.Append(frame.Substring(split))).ToArray();
                Check(actual.Length == 1 && actual[0] == frame, "Split frame at " + split);
            }
            var batched = new ScaleFrameStream().Append(string.Concat(Enumerable.Repeat(frame, 1000)));
            Check(batched.Count == 1000 && batched.All(x => x == frame), "1000 concatenated frames");
            var random = new Random(921);
            string wire = string.Concat(Enumerable.Range(0, 1000).Select(i => "@typea(1001)+" + i.ToString("000000") + "*s1#\r\n"));
            var decoder = new ScaleFrameStream(); var output = new List<string>();
            for (int i = 0; i < wire.Length;)
            {
                int length = Math.Min(random.Next(1, 80), wire.Length - i);
                output.AddRange(decoder.Append(wire.Substring(i, length))); i += length;
            }
            Check(output.Count == 1000 && output.Distinct().Count() == 1000, "Random fragmented/batched stream preserves all frames");
            Check(new ScaleFrameStream().Append("block1=ABCDsn=01234567\r\n" + frame).Count == 2, "Legacy and new transport coexist");
            var noisy = new ScaleFrameStream();
            Check(noisy.Append("noise@typebroken" + frame).Single() == frame, "Resynchronize broken frame at next start marker");
            noisy.Append(new string('x', 10000));
            Check(noisy.Append(frame).Single() == frame && noisy.DiscardedCharacters > 0, "Bounded noise buffer recovers");
            noisy.Append("@typea(1001)+000"); noisy.Reset();
            Check(noisy.Append("052*s1#\r\n").Single() != frame, "Reconnect cannot join stale partial packets");

            var inbox = new BenchInbox(Path.Combine(root, "inbox"));
            for (int i = 0; i < 1000; i++) inbox.Enqueue(frame);
            inbox = new BenchInbox(Path.Combine(root, "inbox"));
            var pending = inbox.Peek(2000);
            Check(pending.Length == 1000 && pending.Select(x => x.Id).Distinct().Count() == 1000, "Inbox durable after restart; equal weights are legitimate separate events");
            Check(pending.Select(x => x.Sequence).SequenceEqual(pending.Select(x => x.Sequence).OrderBy(x => x)), "FIFO order after restart");
            var store = new DurableJsonStore(Path.Combine(root, "drafts"));
            var draft = new BenchDraft { Id = "draft1", StationId = 1, UserId = 1, Header = new tbweight { id = 0, truct_no = "TEST" },
                Groups = new List<BenchItemGroup> { new BenchItemGroup { ItemType = "a", UnitPrice = 10000,
                    Entries = new List<BenchScanEntry> { new BenchScanEntry { EventId = pending[0].Id, Weight = 5.2m } } } } };
            store.Write(draft.Id, draft);
            // Simulate crash after draft commit, before inbox acknowledgement: the ID survives for deduplication.
            var restored = new DurableJsonStore(Path.Combine(root, "drafts")).Read<BenchDraft>(draft.Id);
            Check(restored.Groups.Single().Entries.Single().EventId == inbox.Peek(1).Single().Id, "Crash between durable assignment and ack is detectable");
            inbox.Acknowledge(pending[0]);
            Check(new BenchInbox(Path.Combine(root, "inbox")).Peek(2000).Length == 999, "Acknowledgement survives restart");
            string lockedPending = Path.Combine(root, "inbox", "pending", pending[1].Sequence.ToString("D19") + "-" + pending[1].Id + ".json");
            bool acknowledgementFailed = false;
            using (var locked = new FileStream(lockedPending, FileMode.Open, FileAccess.Read, FileShare.Read))
            {
                try { inbox.Acknowledge(pending[1]); } catch (IOException) { acknowledgementFailed = true; }
                Check(acknowledgementFailed && inbox.IsPending(pending[1].Id), "Failed pending deletion stays pending even though archive write succeeded");
            }
            inbox.Acknowledge(pending[1]);
            Check(!inbox.IsPending(pending[1].Id), "Retry after pending-file lock release acknowledges exactly once");
            draft.Header.truct_no = "UPDATED"; store.Write(draft.Id, draft);
            Check(store.Read<BenchDraft>(draft.Id).Header.truct_no == "UPDATED", "Atomic snapshot replacement");
            File.WriteAllText(Path.Combine(root, "drafts", "unfinished.json.tmp"), "partial");
            Check(store.Keys().Count() == 1, "Uncommitted temp file is not a draft");
            bool refused = false;
            try { store.Write("../escape", draft); } catch (ArgumentException) { refused = true; }
            Check(refused, "Reject path traversal");
            File.WriteAllText(Path.Combine(root, "drafts", "broken.json"), "{broken");
            refused = false;
            try { store.Read<BenchDraft>("broken"); } catch { refused = true; }
            Check(refused, "Corrupt recovery file fails visibly");
            Check((string)BenchReceiptRepository.Metadata("legacy text")["_legacy_externdata"] == "legacy text", "Preserve legacy metadata");
            string protectedValue = LocalSecrets.Protect("test-login-only");
            Check(protectedValue != "test-login-only" && LocalSecrets.Unprotect(protectedValue) == "test-login-only", "Windows user-bound encryption roundtrip");
            Check(LocalSecrets.Unprotect("old-login") == "old-login", "Read old saved value for migration");
            RepositoryTests.Run(root);
            Console.WriteLine("PASS: " + checks + " reliability checks; 1000 durable events and randomized serial replay. No production DB/device used.");
            return 0;
        }
        catch (Exception ex) { Console.Error.WriteLine(ex); return 1; }
        finally
        {
            string absolute = Path.GetFullPath(root);
            if (!string.Equals(Path.GetDirectoryName(absolute), Path.GetTempPath().TrimEnd(Path.DirectorySeparatorChar), StringComparison.OrdinalIgnoreCase) ||
                !Path.GetFileName(absolute).StartsWith("qhs-bench-tests-", StringComparison.Ordinal))
                throw new InvalidOperationException("Refuse cleanup outside the isolated test directory.");
            Directory.Delete(absolute, true);
        }
    }
}
