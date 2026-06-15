using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

internal static class DevLauncher
{
    [STAThread]
    private static void Main()
    {
        var projectRoot = AppDomain.CurrentDomain.BaseDirectory;
        var scriptPath = Path.Combine(projectRoot, "scripts", "run-tauri.ps1");

        if (!File.Exists(scriptPath))
        {
            MessageBox.Show(
                "Missing startup script:\n" + scriptPath,
                "Learn Anything Desktop Dev Launcher",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error
            );
            return;
        }

        var startInfo = new ProcessStartInfo
        {
            FileName = "powershell.exe",
            Arguments = string.Format("-ExecutionPolicy Bypass -File \"{0}\" dev", scriptPath),
            WorkingDirectory = projectRoot,
            UseShellExecute = false,
            CreateNoWindow = true,
            WindowStyle = ProcessWindowStyle.Hidden,
        };

        try
        {
            Process.Start(startInfo);
        }
        catch (Exception ex)
        {
            MessageBox.Show(
                "Failed to start the dev app.\n\n" + ex.Message,
                "Learn Anything Desktop Dev Launcher",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error
            );
        }
    }
}
