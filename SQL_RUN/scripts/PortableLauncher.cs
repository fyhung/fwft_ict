using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Threading;
using System.Windows.Forms;

internal static class PortableLauncher
{
    private const string ResourceName = "SQLRun.Payload.zip";
    private const string Version = "1.0.1";

    [STAThread]
    private static int Main()
    {
        bool ownsMutex;
        using (Mutex mutex = new Mutex(true, @"Local\SQLRunLauncher-1.0.1", out ownsMutex))
        {
            if (!ownsMutex)
            {
                MessageBox.Show("SQL Run 已經在執行。", "SQL Run", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return 0;
            }
            string root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "SQL Run");
            string stage = Path.Combine(root, Version);
            string marker = Path.Combine(stage, ".payload-ready");
            string application = Path.Combine(stage, "SQL Run.exe");
            string working = stage + ".staging-" + Guid.NewGuid().ToString("N");
            try
            {
                if (!File.Exists(marker) || !File.Exists(application))
                {
                    if (Directory.Exists(working)) Directory.Delete(working, true);
                    Directory.CreateDirectory(working);
                    string payload = Path.Combine(working, "payload.zip");
                    using (Stream input = Assembly.GetExecutingAssembly().GetManifestResourceStream(ResourceName))
                    {
                        if (input == null) throw new InvalidOperationException("找不到內置遊戲檔案。");
                        using (FileStream output = File.Create(payload)) input.CopyTo(output);
                    }
                    ZipFile.ExtractToDirectory(payload, working);
                    File.Delete(payload);
                    File.WriteAllText(Path.Combine(working, ".payload-ready"), Version);
                    if (Directory.Exists(stage)) Directory.Delete(stage, true);
                    Directory.Move(working, stage);
                }

                Process process = Process.Start(new ProcessStartInfo
                {
                    FileName = application,
                    WorkingDirectory = stage,
                    UseShellExecute = true
                });
                if (process == null) throw new InvalidOperationException("無法啟動 SQL Run。");
                process.WaitForExit();
                return process.ExitCode;
            }
            catch (Exception error)
            {
                MessageBox.Show(
                    "SQL Run 無法啟動。\r\n\r\n" + error.Message,
                    "SQL Run",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
                return 1;
            }
            finally
            {
                if (Directory.Exists(working))
                {
                    try { Directory.Delete(working, true); } catch { }
                }
            }
        }
    }
}
