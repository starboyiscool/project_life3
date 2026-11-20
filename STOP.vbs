Option Explicit
Dim shell, fso, scriptPath, command
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptPath = fso.BuildPath(fso.GetParentFolderName(WScript.ScriptFullName), "launcher\local-server.ps1")
If Not fso.FileExists(scriptPath) Then
  MsgBox "Launcher file is missing. Extract the complete archive first.", 16, "Life Tracker"
  WScript.Quit 1
End If
command = "powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File " & Chr(34) & scriptPath & Chr(34) & " -Action Stop"
shell.Run command, 0, False
