# RapidStealer Malware — Reverse Engineering Report

> **Disclaimer:** This report is based on a behavioral and static reconstruction derived from a blend of dynamic analysis traces, decompiled Electron artifacts, and C2 protocol observations collected during controlled analysis sessions. It is **not** an exact copy of the original source code. Variable names, string literals, and module boundaries have been inferred and may differ from the real malware. The purpose of this document is to provide a comprehensive understanding of the sample's capabilities, communication patterns, and operational security for defensive purposes.

---

## 1. Overview

**RapidStealer** is a modular information-stealing malware targeting Discord users on Windows. It is distributed as a Node.js / Electron application and exhibits a multi-stage infection pipeline with capabilities ranging from credential theft and crypto-wallet extraction to full desktop surveillance.

The sample analyzed here is a development-oriented reconstruction.

---

## 2. High-Level Architecture

```
┌──────────────────────────────────────────────────┐
│                   output.js                       │
│  (Main orchestrator — 1907 lines)                │
│                                                   │
│  ● Anti-debug / VM detection / expiry check       │
│  ● C2 PowerShell fetch + execution                │
│  ● Browser process killer (10 browsers)           │
│  ● Discord token theft (LevelDB scraping)         │
│  ● Python runtime autobundle + forensics script   │
│  ● System info collection + ZIP exfiltration      │
│  ● Screenshot capture (multi-monitor)             │
│  ● Keyword-targeted file scanning                 │
│  ● 2FA backup code collection                     │
│  ● Minecraft session theft                        │
│  ● Steam session theft + Steam API enrichment     │
│  ● Exodus wallet theft (local brute-force)        │
│  ● Startup persistence (VBS watcher loops)        │
│  ● Windows Defender disabling + exclusions        │
│  ● UAC bypass (fake DirectX error VBS)            │
│  ● Task Manager disable                           │
│  ● Process masquerading                           │
│  ● Retry loop: 7 iterations × 5 collectors        │
└──────────────┬───────────────────────────┬────────┘
               │                           │
               ▼                           ▼
┌──────────────────────────┐   ┌──────────────────────────────┐
│        inj.js             │   │       discord.js              │
│  (Discord Injection       │   │  (Token extraction module)   │
│   Module — 159 lines)     │   │                               │
│                           │   │  ● LevelDB .ldb/.log parsing  │
│  ● Locates Discord core   │   │  ● Token format validation   │
│  ● Fetches payload from   │   │  ● Discord API enrichment    │
│    C2 /api/discord        │   │    (profile, friends, guilds,│
│  ● Fetches webhook URL    │   │     billing)                  │
│    from C2 /webhook       │   │  ● Friend profile enrichment │
│  ● Injects payload into   │   │  ● Discord crash via Gateway │
│    discord_desktop_core   │   │    WebSocket (OP spam)        │
│  ● Creates .bak backup    │   └──────────────────────────────┘
│  ● Restarts Discord       │
└──────────────────────────┘
                                   
┌─────────────────────────────────────────────────────┐
│              C2 / 1337 — API Server                  │
│                                                      │
│  GET  /webhook?key=<BUILD_KEY>  → JSON webhook URL  │
│  GET  /api/discord             → Raw JS payload      │
│  GET  /api/ps                 → Raw PowerShell code  │
│  POST /api/forwarder          → Discard/webhook relay│
│                                                      │
│  WebSocket ws://C2:571  → Screen viewer RAT channel  │
└──────────────────────────────────────────────────────┘
```

### Communication Flow

```
output.js (on victim)
    │
    ├── GET /webhook?key=RAPD-D354-...   → {"success":true,"webhook":"<url>"}
    ├── GET /api/ps                       → Raw PowerShell (fake installer UI)
    ├── GET /download                     → Screen viewer Electron app
    ├── POST /api/forwarder               → Discord embeds (stolen data)
    │
    └── Also calls C2 webhook URL directly via axios
         for Discord-formatted embeds of stolen data

inj.js (on victim, if Discord injection is active)
    │
    ├── GET /webhook?key=RAPD-D354-...   → JSON webhook URL
    ├── GET /api/discord                 → Raw JS (injected into Discord)

ChatAgent (screen viewer, on victim)
    │
    ├── WebSocket ws://46.151.182.157:571  → Encrypted RAT channel
    ├── POST /api/forwarder                → "stream session" notification
    │
    └── Desktop capture → JPEG frames → WS (unidirectional video feed)
```

---

## 3. File-by-File Analysis

### 3.1 `output.js` (Main Stealer Orchestrator — 1907 lines)

This is the primary payload. It runs as a standalone Node.js script launched from a packaged Electron executable masquerading as a legitimate application.

#### Phase Sequence

| Phase | Actions |
|-------|---------|
| **0** | `antiDebugReLaunch()` — Checks for `.argv` flags (`--no-sandbox`, `--disable-gpu`, etc.). If missing, re-spawns with flags and exits. |
| **1** | Build key expiry check against hardcoded `KEY_EXPIRY` (2026-06-09). |
| **2** | `detectAnalysisEnvironment()` — VM/sandbox detection via CPU name, GPU name, running processes, hostname, username, executable path, environment variables, and system model. |
| **3** | `executeC2PowerShell()` — Fetches `GET /api/ps` and pipes it into `powershell.exe`. |
| **4** | Kills all browser processes (Chrome, Edge, Brave, Firefox, Opera, Vivaldi, Yandex) to unlock SQLite databases. |
| **5** | UAC bypass (×2), Windows Defender disable + exclusions, Task Manager disable, process masquerading. |
| **6** | `stealDiscordTokens()` — Kills Discord, scrapes LevelDB `.ldb`/`.log` files for JWT tokens, restarts Discord. |
| **7** | `communicateWithPanel()` — Downloads + executes screen viewer. |
| **8** | Screenshot(s) via PowerShell `System.Windows.Forms`. |
| **9** | Startup persistence via VBS watcher loop. |
| **10** | Parallel collectors: 2FA codes, Exodus wallet, Steam sessions, Minecraft sessions, browser forensics Python script. |
| **11** | Retry loop (7 iterations) re-running all major collectors. |

#### Key Subsystems

- **C2 Communication:** Axios-based HTTP calls to `http://46.151.182.157` on ports 1337 (webhook, PS, panel) and 2008 (forwarder). No TLS (cert validation is disabled via `NODE_TLS_REJECT_UNAUTHORIZED=0`).

- **Exfiltration Channels:**
  - **Embed-only:** `POST /api/forwarder` with Discord embed payloads (fits in 6000-char field limit).
  - **File attachment:** Multipart `POST /api/forwarder` with `payload_json` + file stream for screenshots, ZIP archives.
  - **Gofile.io:** Large files (Minecraft sessions, Steam config, Exodus wallet) are uploaded to `https://upload.gofile.io/uploadFile` and a download link is embedded in the Discord message.

- **Python Forensics Bundle (line 220–878):**
  Drops a `python310.nupkg` and extracts a portable Python runtime, then runs a 650-line Python script that:
  - Targets **19 browser profiles** (Chrome, Firefox, Brave, Edge, Opera, Opera GX, Vivaldi, Yandex, CocCoc, QQ, 360, etc.)
  - Decrypts Chromium cookies and passwords using DPAPI + AES-GCM (v20 key format) via LSASS token impersonation
  - Extracts Firefox passwords via NSS `PK11SDR_Decrypt`
  - Collects cookies, history, bookmarks, autofill, and credit cards from all browsers
  - Uses the `pythonnet` / `windows` library for low-level Windows API access (`SeDebugPrivilege`, LSASS impersonation)

- **Exodus Wallet Theft (line 1683–1788):**
  - Copies entire `%APPDATA%/Exodus/exodus.wallet` directory to ZIP
  - Brute-forces `seed.seco` decryption locally using PBKDF2-SHA512 + AES-128-CTR + HMAC-SHA256
  - Dictionary of 50 common passwords, plus optional custom password file at `%TEMP%/X7G8JQW9...`
  - Validates decrypted BIP39 mnemonic (≥ 6 space-separated words)

- **Steam Theft (line 1606–1677):**
  - Kills `Steam.exe`, ZIPs `C:\Program Files (x86)\Steam\config\`
  - Extracts Steam IDs from `loginusers.vdf`
  - Enriches via Steam Web API (hardcoded key `440D7F4D810EF9298D25EDDF37C1F902`) — profile name, level, owned games count

- **Minecraft Theft (line 1541–1577):**
  - Kills `javaw.exe`
  - Collects `.minecraft/launcher_profiles.json` and `.lunarclient/settings/game/accounts.json`
  - ZIPs and uploads to Gofile

### 3.2 `inj.js` (Discord Injection Module — 159 lines)

Standalone script runs in a non-Discord Node.js context. It:

1. **Searches for Discord core:** Iterates `{LOCALAPPDATA}/Discord{Canary,PTB,Development}/app-/modules/discord_desktop_core-*/*/discord_desktop_core/index.js`.
2. **Fetches payload template** from `GET /api/discord` (raw JS, `%WEBHOOK%` placeholder).
3. **Fetches webhook URL** from `GET /webhook?key=<BUILD_KEY>` — **parses JSON** `{"success":true,"webhook":"<url>"}` (this was a bug fix applied during analysis — the original code did not parse JSON and treated the raw string as the URL).
4. Substitutes `%WEBHOOK%` → actual webhook URL in the payload.
5. Creates a `.bak` copy of `index.js`.
6. Wraps payload in an IIFE with try/catch and prepends it to the original `index.js`.
7. Kills all Discord processes, then relaunches via `Update.exe --processStart Discord.exe`.

**Notable bug in original:** `fetchFromC2()` returns a raw string. `getWebhookUrl()` passed this through unparsed, so the JSON object literal `{"success":true,"webhook":"..."}` was embedded directly into the payload template, producing invalid JavaScript.

### 3.3 `discord.js` (Token Extraction Module — 355 lines)

This module runs within the Discord Electron process (injected by `inj.js` or by the C2's `/api/discord` payload). It:

1. **Scrapes LevelDB** files for token patterns (both `mfa.` prefixes and standard `userID.timestamp.hmac` format).
2. **Parses tokens** by base64-decoding the JWT-like payload sections.
3. **Enriches** each token via multiple parallel Discord API v9 calls:
   - `GET /users/@me/profile` — account details
   - `GET /users/@me/relationships` — friends list
   - `GET /users/@me/guilds?with_counts=true` — servers
   - `GET /users/@me/billing/payment-sources` — credit cards/PayPal
   - `GET /users/{id}/profile` — per-friend extended profiles (up to 50 friends)
4. **Caches** all results by token prefix to avoid redundant API calls.
5. **Crashes Discord** via WebSocket `wss://gateway.discord.gg/` with four crash vectors:
   - OP 2 Identify with 99,999-character token (buffer overflow attempt)
   - OP 8 with invalid snowflakes (×100)
   - Rapid-fire malformed opcodes (OP 9 with negative timeout, OP `"invalid"`, OP 99999)
   - Raw binary data send (non-JSON parser crash)

The module exports `GetToken()` and `InjectDiscordCrash` and also runs immediately as an IIFE, calling `identity()` (a no-op) with the results — a stub function that does nothing after the first call (perpetuating the "identity" illusion).

### 3.4 `C2/1337/api/discord.js` (Injected Discord Payload — 604 lines)

This is the **discord_desktop_core payload** served by the C2 at `/api/discord`. It runs inside Discord's Electron renderer process and:

1. **Uses the WebContents debugger** (`mainWindow.webContents.debugger.attach('1.3')`) to intercept `Network.responseReceived` events.
2. **Monitors** requests matching these URL patterns:
   - `/auth/login` — captures email + password, sends credential+cookie
   - `/auth/register` — captures email + password + token
   - `/mfa/totp` — captures 2FA token after email/password
   - `/mfa/codes-verification` — captures backup codes
   - `/users/@me` — captures email changes and password changes
3. **Intercepts** payment-related requests via `session.defaultSession.webRequest.onCompleted`:
   - Stripe `/tokens` — captures credit card number, CVC, expiry
   - Braintree PayPal — notifies when PayPal is added
4. **Blocks** `wss://remote-auth-gateway.discord.gg/*` and `*/auth/sessions` (QR code login + session listing), preventing the victim from remotely authorizing other devices or seeing active sessions.
5. **Forces token access** via Webpack internal module traversal: `webpackChunkdiscord_app.push(...)` to locate the token without a login event.
6. **On initiation** (first run), sends an "injected!" notification and clears all user data (localStorage + reload), logging the victim out.

**Embed format** includes: token (with click-to-copy link to C2), username, ID, email, phone, 2FA status, verified status, badges, billing, IP, decorations, friend/server stats, and banner image.

### 3.5 `C2/1337/api/ps.ps1` (Fake Installer UI — 285 lines)

A decoy PowerShell script that displays a visually polished "Setup Assistant" dialog with:
- Animated logo (custom GDI+ drawing with ellipses and rectangles)
- Animated spinner (two rotating arc segments with glow effects)
- Progress bar with percentage (scales to 90 seconds, then shows "COMPLETE!")
- Drag-to-move borderless window
- "CONTINUE" button that transitions to the installation animation

The script wastes 90 seconds of the victim's time while the real malware runs in the background. It is served at `GET /api/ps`.

### 3.6 `ChatAgent (WindowsSupport)/main.js` (Screen Viewer RAT — 259 lines)

An Electron app downloaded and executed by `output.js`. It:

1. **Connects to `ws://46.151.182.157:571`** with XOR-encrypted protocol using a hardcoded MASTER_KEY (`RapidStealer_2024_SecureKey_571`).
2. **Authenticates** with an HMAC-SHA256-derived auth token.
3. **Registers** as an agent with a random 8-char hex ID.
4. **Streams desktop** as JPEG frames (60% quality, 1920×1080, 10 FPS) via WebSocket when `start_screen` command is received.
5. **Opens a chat window** (Electron `BrowserWindow`, frameless, always-on-top, 380×520) for operator-to-victim communication:
   - Chat has a dark theme with red accent, avatar next to messages, timestamps
   - Messages are sent through the WebSocket to the C2
6. **Executes PowerShell commands** on command: shutdown, restart, sleep, logout, lock workstation.
7. **Notifies the C2's forwarder** (`POST /api/forwarder`) with agent connection details including a view link at `http://46.151.182.157:571/{AGENT_ID}`.

---

## 4. Network Communications Summary

| Endpoint | Method | Direction | Data |
|----------|--------|-----------|------|
| `46.151.182.157:1337/webhook?key=<KEY>` | GET | Victim → C2 | Returns `{"success":true,"webhook":"<DISCORD_WEBHOOK_URL>"}` |
| `46.151.182.157:1337/api/discord` | GET | Victim → C2 | Raw JS payload template with `%WEBHOOK%` placeholder |
| `46.151.182.157:1337/api/ps` | GET | Victim → C2 | Raw PowerShell decoy script |
| `46.151.182.157:2008/api/forwarder` | POST | Victim → C2 | Discord embed payloads (stolen data) or multipart with file attachments |
| `46.151.182.157:751/download` | GET | Victim → C2 | Screen viewer Electron app (ZIP/nupkg) |
| `ws://46.151.182.157:571` | WS | Victim ↔ C2 | Bidirectional RAT channel (screen capture, chat, PS commands) |
| `https://discord.com/api/v9/...` | GET | Victim → Discord API | Token validation & enrichment |
| `https://api.ipify.org` | GET | Victim → External | Public IP lookup |
| `https://upload.gofile.io/uploadFile` | POST | Victim → Gofile | File exfiltration (Steam, Minecraft, Exodus) |
| `https://api.steampowered.com/...` | GET | Victim → Steam API | Steam account enrichment |

---

## 5. Anti-Analysis & Evasion

### VM/Sandbox Detection (line 1061–1107)

Multi-layered detection checking:
- **CPU name:** QEMU, KVM, VirtualBox, VMware, Xen, Hyper-V keywords + old/slow CPU models
- **GPU name:** VMware SVGA, VirtualBox, QXL, Cirrus Logic, Microsoft Basic Display, VirtIO-GPU
- **Running processes:** `vmtoolsd.exe`, `vboxservice.exe`, `procmon.exe`, `wireshark.exe`, `ollydbg.exe`, `x64dbg.exe`, `ida.exe`, `ghidra.exe`, `sandboxie.exe`, `cuckoo.exe`, `anyrun.exe`
- **Hostname/username:** Keywords like "sandbox", "malware", "virus", "analysis", "cuckoo", "honeypot"
- **Executable path:** Detection of `\sandbox\`, `\cuckoo\`, `\any.run\`, `\joesandbox\` paths
- **Environment variables:** PRESENCE of `DEBUG`, `DEV`, `TEST`, `SANDBOX`, `ANALYSIS`, `VIRUSTOTAL`, `CUCUMBER` env vars
- **System model:** VM model identifiers

If any trigger fires, the malware exits immediately after Phase 1.

### Anti-Debug Relaunch (line 63–83)

Checks for required CLI flags (`--no-sandbox`, `--disable-gpu`, `--disable-hang-monitor`, etc.). If missing, spawns a hidden child process with all flags and exits. This defeats basic `node script.js` execution without the right flags.

### Defense Evasion

| Technique | Implementation |
|-----------|---------------|
| Windows Defender disable | PowerShell `Set-MpPreference -DisableRealtimeMonitoring $true`, plus `net stop WinDefend` fallback |
| Defender exclusions | Adds `C:\`, `%TEMP%`, executable directory, and AV vendor directories to exclusion list |
| UAC bypass | VBS script masquerading as "DirectX initialization failed" dialog, uses `ShellExecute runas` |
| Task Manager disable | Registry `HKCU:\...\Policies\System\DisableTaskMgr = 1` |
| Process masquerading | `sc config` with randomized service names like "Windows Update XKCD" |
| Console suppression | `console.log = console.error = ... = () => {}` after Phase 1 |
| Retry persistence | 7 iteration re-execution loop of all collectors |
| Startup persistence | VBS watcher in Startup folder + `.lnk` recreation loop (every 5 seconds) |
| `NODE_TLS_REJECT_UNAUTHORIZED=0` | Disables TLS certificate validation entirely |

---

## 6. Data Exfiltration Targets

| Category | Targets | Volume |
|----------|---------|--------|
| **Discord tokens** | All 4 Discord variants (stable, canary, PTB, development) | LevelDB files (~KB each) |
| **Discord account** | Profile, friends, guilds, billing, 2FA codes, email, phone, badges | ~10KB per token |
| **Browser credentials** | 19 browser variants (passwords, cookies, CCs, history, bookmarks, autofill) | Potentially GB-scale |
| **Cryptocurrency** | Exodus wallet (seed phrase, wallet files) | ~100MB+ |
| **Gaming** | Steam config + profile, Minecraft launcher + Lunar Client accounts | ~10MB |
| **System info** | Hostname, username, CPU, GPU, memory, IP, file tree | ~50KB |
| **Screenshots** | Multi-monitor composite PNG | Variable |
| **File scan** | Documents with keywords (binance, coinbase, crypto, steam, paypal, etc.) | Variable |
| **2FA codes** | Desktop/Documents/Downloads backup code files | ~100KB |
| **Credit cards** | Stripe tokens intercepted from Discord payment flow | Per-card |

---

## 7. Attribution Indicators

| Indicator | Value |
|-----------|-------|
| **Brand** | `@Rapidstealer` / `RapidStealer` |
| **Telegram** | `t.me/rapidstealerxx` |
| **Build Key** | `RAPD-D354-GHLG-E5D6-I7XZ-2026` |
| **Key Expiry** | `2026-06-09T20:27:26.054Z` |
| **C2 Host** | `46.151.182.157` |
| **C2 Ports** | 1337 (webhook, PS, API), 2008 (forwarder), 751 (download), 571 (WS RAT) |
| **Agent Password** | `RapidAdmin2024!` |
| **WebSocket Key** | `RapidStealer_2024_SecureKey_571` |
| **Steam API Key** | `440D7F4D810EF9298D25EDDF37C1F902` |
| **Discord Emoji IDs** | `1425428123058569236`, `1425428161889571010`, etc. (owned by bot accounts) |
| **CDN Image URLs** | `cdn.discordapp.com/attachments/1267444884495798283/...` (attachment channel IDs) |
| **Gofile Usage** | `upload.gofile.io` for large file drops |
| **Injection Marker** | `// [RAPID_INJECT]` — comment tag in modified Discord core files |

---

## 8. Operational Security Observations

1. **Hardcoded C2 IP** — The single static IPv4 address makes this sample trivially blockable. A real operational deployment would use DGA, CDN proxies, or bulletproof hosting.

2. **Unencrypted HTTP for API calls** — All C2 communication uses plain HTTP. The WebSocket channel does encrypt payloads with XOR, but XOR with a static key offers negligible security.

3. **TLS disabled globally** — `NODE_TLS_REJECT_UNAUTHORIZED=0` means even if C2 added HTTPS, certificate validation would be skipped, enabling MITM.

4. **Gofile as exfiltration relay** — Uploading large archives to a public file host creates an auditable trail and allows takedown.

5. **Build key with expiry** — The key `RAPD-D354-GHLG-E5D6-I7XZ-2026` expired `2026-06-09`, suggesting time-limited builds, though this is trivially bypassed.

6. **Exodus brute-force is local** — The wallet password cracking happens on the victim's machine, meaning the malware only exfiltrates the encrypted wallet data + a note about whether a password was found. If the wallet has a strong password, the attacker gets the wallet files but cannot open them.

7. **No C2 resilience** — No fallback C2, no domain generation, no DNS-based redundancy.

8. **ChatAgent is functionally a RAT** — The screen viewing + chat + PowerShell execution capabilities give the operator interactive remote control, though limited by the one-way screen stream and text-only chat.

9. **The Python forensics bundle is comprehensive** — The embedded Python payload covers a wider range of browsers than seen in most stealer samples, including region-specific browsers (360, QQ, CocCoc).

---

## 9. IOCs

### Network Indicators
```
46.151.182.157:1337
46.151.182.157:2008
46.151.182.157:751
46.151.182.157:571
upload.gofile.io
api.ipify.org
api.steampowered.com
```

### File System Indicators
```
%LOCALAPPDATA%\Discord*\modules\discord_desktop_core-*\*\discord_desktop_core\index.js.bak
%TEMP%\MainSource_*.exe
%TEMP%\python310.nupkg
%TEMP%\.python_runtime\tools\python.exe
%TEMP%\X7G8JQW9LFH3YD2KP6ZTQ4VMX5N8WB1RHFJQ.txt
%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\watcherZxammz256.lnk
%TEMP%\lib32winmz256.vbs
%TEMP%\sysZxammz256.vbs
%TEMP%\winJaxmalz0.vbs
%TEMP%\sex.vbs
```

### Registry Indicators
```
HKCU:\Software\Microsoft\Windows\CurrentVersion\Policies\System\DisableTaskMgr = 1
HKLM:\SOFTWARE\Microsoft\Windows Defender\Exclusions\Paths\* (various C:\ and AV paths)
```

### Process Indicators
```
node.exe / script.js (with --no-sandbox, --disable-gpu, --disable-hang-monitor flags)
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command - (for C2 PS scripts)
Discord.exe (restarted by malware)
wscript.exe lib32winmz256.vbs (persistence watcher)
```

---

## 10. Summary

RapidStealer is a **mid-complexity infostealer** with a notably broad data collection surface. Its architecture reveals:

- **Modular design** — separate files for injection, token theft, C2 payload, and screen viewing
- **Dual exfiltration** — C2 relay + Gofile.io for large payloads
- **User-mode only** — no kernel components, no driver installation
- **Discord-centric** — the Discord client is both a primary target (tokens, billing) and an exfiltration channel (webhooks)
- **Active development signs** — modular structure, development-style variable names

The sample was recreated from static and dynamic analysis traces for educational or defensive research purposes. The presence of Turkish-language comments in `inj.js` ("enjeksiyon işlemi", "başarılı", "başarısız") suggests a Turkish-speaking developer or team.
