---
description: Show a sample notification with the saved settings (stop | permission | idle)
argument-hint: "[stop|permission|idle]"
allowed-tools: Bash, PowerShell
---

Send an empty POST request to `http://127.0.0.1:47821/test/CATEGORY`, replacing CATEGORY with `$ARGUMENTS` if it is one of `stop`, `permission`, `idle`, otherwise with `stop`. For example `curl -s -X POST http://127.0.0.1:47821/test/stop` (in PowerShell use `curl.exe`).

If the request fails, the Next Notify app is not running; say so and suggest `/next-notify:dashboard` to start it. Otherwise reply in one short sentence that the test notification was sent. Do not do anything else.
