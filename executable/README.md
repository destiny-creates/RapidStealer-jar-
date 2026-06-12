# KumoriClient — Malware Analysis Repository

> **Classification:** Information Stealer + Discord Token Stealer  
> **Threat Level:** HIGH  
> **Platform:** Windows 10/11 x64 (Electron app)  
> **Analysis Date:** 2026-06-12  
> **Status:** Phase 7 of 13 complete

---

## ⚠️ Warning

This repository contains **malware analysis artifacts**. The original sample (`sample.exe`) is **not included** in this repository. All JavaScript payloads are included for research purposes only.

**Do not execute any files in this repository on a non-isolated system.**

---

## Overview

**KumoriClient** is a fully-featured credential stealer distributed as a fake gaming application (Minecraft, VRChat, streaming client) targeting Turkish and international gaming communities.

### Key Capabilities
- Steals passwords, cookies, credit cards, autofill and history from **19 browsers**
- Bypasses **Chrome v127+ App-Bound Encryption** (3 decryption modes, LSASS impersonation)
- Harvests and injects **Discord tokens**
- Fake company identity: **SunomoGames Inc.**
- Active C2: `N3.GG` → `52.20.84.62` (AWS EC2 us-east-1)
- **21 confirmed victims** identified from Discord avatar cache

---

## Repository Structure

```
.
├── REPORT.md                          # Full analysis report (start here)
├── python_stealer.py                  # Recovered Python stealer (1,114 lines, NOT obfuscated)
├── inner_body.js                      # Decoded inner JS function body (982KB)
│
├── app_extracted/
│   └── asar_unpacked/
│       ├── output.js                  # Main obfuscated payload (13MB, obfuscator.io)
│       ├── discord.js                 # Discord token stealer/injector (8.6MB)
│       ├── inj.js                     # Injector support module (8.1MB)
│       ├── temp_icons/                # 86 victim Discord avatar files (21 unique victims)
│       └── themes/                    # Fake lure HTML files (6 themes/languages)
│           ├── Minecraft.html
│           ├── VRChat.html
│           ├── NormalGame.html
│           ├── WatchTV.html
│           ├── KittiesMC.html
│           └── 2DGame.html
│
├── output_webcrack/
│   └── deobfuscated.js                # webcrack output for output.js
├── discord_webcrack/
│   └── deobfuscated.js                # webcrack output for discord.js
├── inj_webcrack/
│   └── deobfuscated.js                # webcrack output for inj.js
│
├── extracted/                         # NSIS installer extracted files
│   ├── elevate.exe                    # UAC bypass helper
│   ├── Uninstall KumoriClient.exe
│   └── [NSIS DLLs]
│
├── ioc_network.txt                    # Network IOCs (IPs, domains)
├── ioc_host.txt                       # Host-based IOCs (paths, registry keys)
├── ioc_urls.txt                       # URL IOCs
├── deob_iocs.txt                      # 260+ IOCs from deobfuscation
├── deob_strings.txt                   # Decoded string table entries
├── decoded_strings.txt                # Additional decoded content
├── capability_map.txt                 # Full capability string map
├── extracted_hashes.txt               # File hashes
├── analysis.txt                       # Timestamped analysis notes
└── strings_unicode.txt                # Unicode strings from binary
```

---

## Hardcoded Decryption Keys (Critical IOCs)

These keys are embedded in the Python stealer and can decrypt all stolen victim data:

```
# Chrome Flag 1 — AES-256-GCM
B31C6E241AC846728DA9C1FAC4936651CFFB944D143AB816276BCC6DA0284787

# Chrome Flag 2 — ChaCha20-Poly1305  
E98F37D7F4E1FA433D19304DC2258042090E2D1D7EEA7670D41F738D08729660

# Chrome Flag 3 — XOR post-processing (App-Bound Encryption bypass)
CCF8A1CEC56605B8517552BA1A2D061C03A29E90274FB2FCF59BA4B75C392390
```

---

## Network IOCs

| Domain | IP | ASN | Role | Status |
|---|---|---|---|---|
| `n3.gg` | `52.20.84.62` | AWS EC2 us-east-1 | Primary C2 | Active (listed for sale) |
| `gv.cc` | `112.124.10.126` | Alibaba Cloud CN | Unknown | Firewalled |

**C2 endpoints confirmed:**
- `POST /card` — credit card exfiltration
- `POST /cookie` — cookie/session exfiltration

---

## Confirmed Victims

21 victim Discord Snowflake IDs recovered from `temp_icons/`:
```
1287440078  1608880308  5488978164  5654115624  6483859894
6575930420  7181627441  7200077298  7319533274  7373638686
7392823416  7467907404  7539096677  7849333007  7983769375
8017321376  8541372660  8632962699  8655708423  908120079
962300365
```
> Please notify Discord Trust & Safety if you identify active victims.

---

## Analysis Phases

| Phase | Status | Description |
|---|---|---|
| Phase 1 — Initial Triage | ✅ Complete | File type, hashes, PE metadata |
| Phase 2 — Static Unpacking | ✅ Complete | NSIS → 7z → ASAR extraction |
| Phase 3 — String Extraction | ✅ Complete | 260+ IOCs, string table |
| Phase 4 — JS Deobfuscation | ✅ Complete | webcrack, 570,868 transforms |
| Phase 4b — Python Stealer Recovery | ✅ Complete | Full 1,114 line source recovered |
| Phase 5 — C2 / Network IOCs | ✅ Complete | N3.GG primary C2 confirmed |
| Phase 6 — Reporting | ✅ Complete | REPORT.md, YARA rules |
| Phase 7 — C2 Infrastructure Scan | ✅ Complete | Live endpoints confirmed |
| Phase 8 — Dynamic Analysis | 🔲 Pending | Windows sandbox required |
| Phase 9 — Threat Intel Correlation | 🔲 Pending | VT/URLhaus/AbuseIPDB submission |
| Phase 10 — Victim Notification | 🔲 Pending | Discord Trust & Safety |
| Phase 11 — AV/SIEM Submission | 🔲 Pending | YARA + sample to vendors |
| Phase 12 — Attribution | 🔲 Pending | Turkish dev, Sep 2025 infra |

---

## YARA Detection

See `REPORT.md` Section 15 for full YARA rules.

Quick signatures:
```yara
$chacha_key = "E98F37D7F4E1FA433D19304DC2258042090E2D1D7EEA7670D41F738D08729660"
$xor_key    = "CCF8A1CEC56605B8517552BA1A2D061C03A29E90274FB2FCF59BA4B75C392390"
$aes_key    = "B31C6E241AC846728DA9C1FAC4936651CFFB944D143AB816276BCC6DA0284787"
$company    = "SunomoGames"
$output_dir = "Browser-Datas"
$lsass      = "impersonate_lsass"
```

---

## Reporting Channels

| Target | Contact |
|---|---|
| AWS C2 (`52.20.84.62`) | `trustandsafety@support.aws.com` |
| Alibaba Cloud (`112.124.10.126`) | `abuse@alibaba-inc.com` |
| Discord victims | Discord Trust & Safety |
| AV vendors | Submit via vendor portals |

---

*Analysis performed on Parrot OS (air-gapped)*
