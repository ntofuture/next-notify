---
description: Open the Next Notify settings window
allowed-tools: Bash, PowerShell
---

Open the Next Notify settings window:

1. Send an empty POST request to `http://127.0.0.1:47821/open` (for example `curl -s -X POST http://127.0.0.1:47821/open`; in PowerShell use `curl.exe`).
2. If the request fails, the app is not running. Start it through its link: `Start-Process nextnotify://open` in PowerShell, `open nextnotify://open` on macOS, `xdg-open nextnotify://open` on Linux.
3. If that also fails, the app is not installed. Say so and point to the project's GitHub Releases page.

Then reply in one short sentence. Do not do anything else.
