# Unpublished ApiDuck Claude Code connector source

These scripts are examples, not published downloads. They currently launch the already-installed Claude Code CLI against
`https://apiduh.netlify.app`. They ask for an individual `sk-gw-…` customer key
using hidden input and do not save it. They never contain DeepSeek/OpenRouter
provider credentials.

The API service must be enabled and operational first. In particular, the
 Render Web Service needs its server-only `DEEPSEEK_API_KEY`, `DATABASE_URL`, and
validated quota configuration. If hosted inference is disabled or the account
database is unavailable, these launchers will not make API calls.

The hosted route currently supports Claude Messages only. This is not a native
installer and does not include Claude Code; install the official CLI separately.

## Windows

After updating the base URL and validating the service, open PowerShell in the project directory you want
Claude Code to work in, and run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\path\to\Start-ApiDuck.ps1"
```

Pass Claude Code options after the script path if needed.

## Linux

After updating the base URL and validating the service, open a terminal in your project directory, then:

```bash
bash /path/to/start-apiduck.sh
```

Pass Claude Code options after the script path if needed.
