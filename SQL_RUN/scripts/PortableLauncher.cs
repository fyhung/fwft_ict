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

    [STAThread]
    private static int Main()
    {
        string stage = Path.Combine(Path.GetTempPath(), "SQL-Run-1.0.0-" + Guid.NewGuid().ToString("N"));
        try
        {
            Directory.CreateDirectory(stage);
            string payload = Path.Combine(stage, "payload.zip");
            using (Stream input = Assembly.GetExecutingAssembly().GetManifestResourceStream(ResourceName))
            {
                if (input == null) throw new InvalidOperationException("找不到內置遊戲檔案。");
                using (FileStream output = File.Create(payload)) input.CopyTo(output);
            }

            ZipFile.ExtractToDirectory(payload, stage);
            File.Delete(payload);
            string application = Path.Combine(stage, "SQL Run.exe");
            if (!File.Exists(application)) throw new FileNotFoundException("找不到 SQL Run 主程式。", application);

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
            for (int attempt = 0; attempt < 4; attempt++)
            {
                try
                {
                    if (Directory.Exists(stage)) Directory.Delete(stage, true);
                    break;
                }
                catch
                {
                    Thread.Sleep(500);
                }
            }
        }
    }
}
