' Launches a command with no console window.
'
' Task Scheduler's own "Run whether user is logged on or not" hides the window
' but also denies the task a desktop session, which the dashboard server does
' not want. This wrapper is the usual way round it: the task runs at logon and
' this script swallows the console window.
'
'   wscript.exe hidden.vbs "C:\path\to\node.exe" "C:\path\to\script.js"

Dim shell, args, cmd, i
Set shell = CreateObject("WScript.Shell")
Set args = WScript.Arguments

cmd = ""
For i = 0 To args.Count - 1
  cmd = cmd & """" & args(i) & """ "
Next

' 0 = hidden window, False = do not wait for it to finish
shell.Run cmd, 0, False
