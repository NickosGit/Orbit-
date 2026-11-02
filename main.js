// Orbit — launcher alternativo para Roblox (usa Bloxstrap por debajo)
const { app, BrowserWindow, ipcMain, shell, session, net, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const crypto = require('crypto');

const LOCAL = process.env.LOCALAPPDATA || path.join(require('os').homedir(), 'AppData', 'Local');
const BLOX_DIR = path.join(LOCAL, 'Bloxstrap');
const BLOX_EXE = path.join(BLOX_DIR, 'Bloxstrap.exe');
const BLOX_SETTINGS = path.join(BLOX_DIR, 'Settings.json');
const BLOX_LOGS = path.join(BLOX_DIR, 'Logs');
const ROBLOX_LOGS = path.join(LOCAL, 'Roblox', 'logs');
const PARTITION = 'persist:roblox';
const BLOX_MODS = path.join(BLOX_DIR, 'Modifications');
const BLOX_KEYS = ['ShowServerDetails', 'UseDiscordRichPresence', 'ConfirmLaunches', 'EnableActivityTracking'];

let win;
let dataFile;
let data = { favorites: [], selected: null, prefs: { accent: 'violet', minimizeOnPlay: true }, sessions: [], cache: {} };

// ---------- datos locales ----------
function loadData() {
  dataFile = path.join(app.getPath('userData'), 'orbit-data.json');
  try { data = { ...data, ...JSON.parse(fs.readFileSync(dataFile, 'utf8')) }; } catch {}
}
function saveData() {
  try { fs.writeFileSync(dataFile, JSON.stringify(data, null, 2)); } catch (e) { console.error(e); }
}

// ---------- peticiones a Roblox (con la sesión del login) ----------
const rbxSession = () => session.fromPartition(PARTITION);
let csrf = '';

function request(url, { method = 'GET', body, headers = {} } = {}, retried = false) {
  return new Promise((resolve, reject) => {
    const req = net.request({ url, method, session: rbxSession(), useSessionCookies: true });
    req.setHeader('Accept', 'application/json');
    if (body) req.setHeader('Content-Type', 'application/json');
    if (csrf && method !== 'GET') req.setHeader('x-csrf-token', csrf);
    for (const [k, v] of Object.entries(headers)) req.setHeader(k, v);
    req.on('response', (res) => {
      let chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', async () => {
        const text = Buffer.concat(chunks).toString('utf8');
        const token = res.headers['x-csrf-token'];
        if (res.statusCode === 403 && token && !retried) {
          csrf = Array.isArray(token) ? token[0] : token;
          return request(url, { method, body, headers }, true).then(resolve, reject);
        }
        if (res.statusCode >= 400) return reject(new Error(`${res.statusCode} ${url}`));
        try { resolve(JSON.parse(text)); } catch { resolve(text); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}
const get = (u) => request(u);
const post = (u, body) => request(u, { method: 'POST', body });
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

// ---------- juegos ----------
const SIX_HOURS = 6 * 3600 * 1000;

async function universeFromPlace(placeId) {
  const key = 'u:' + placeId;
  if (data.cache[key]) return data.cache[key];
  const r = await get(`https://apis.roblox.com/universes/v1/places/${placeId}/universe`);
  if (r && r.universeId) { data.cache[key] = r.universeId; saveData(); }
  return r && r.universeId;
}

// Recibe universeIds y regresa info completa con icono y banner
async function gamesByUniverse(universeIds) {
  universeIds = [...new Set(universeIds.filter(Boolean).map(Number))];
  const out = {};
  const missing = [];
  for (const id of universeIds) {
    const c = data.cache['g:' + id];
    if (c && Date.now() - c.t < SIX_HOURS) out[id] = c.v; else missing.push(id);
  }
  for (const ids of chunk(missing, 50)) {
    const q = ids.join(',');
    const [details, icons, banners, votes] = await Promise.all([
      get(`https://games.roblox.com/v1/games?universeIds=${q}`).catch(() => ({ data: [] })),
      get(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${q}&returnPolicy=PlaceHolder&size=512x512&format=Png&isCircular=false`).catch(() => ({ data: [] })),
      get(`https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=${q}&countPerUniverse=1&defaults=true&size=768x432&format=Png&isCircular=false`).catch(() => ({ data: [] })),
      get(`https://games.roblox.com/v1/games/votes?universeIds=${q}`).catch(() => ({ data: [] })),
    ]);
    for (const g of details.data || []) {
      const icon = (icons.data || []).find((i) => i.targetId === g.id);
      const ban = (banners.data || []).find((b) => b.universeId === g.id);
      const v = (votes.data || []).find((x) => x.id === g.id);
      const up = v ? v.upVotes : 0, down = v ? v.downVotes : 0;
      const info = {
        universeId: g.id,
        placeId: g.rootPlaceId,
        name: g.name,
        description: g.description || '',
        creator: g.creator ? g.creator.name : '',
        playing: g.playing || 0,
        visits: g.visits || 0,
        maxPlayers: g.maxPlayers || 0,
        genre: g.genre_l1 || g.genre || '',
        rating: up + down ? Math.round((up / (up + down)) * 100) : null,
        icon: icon ? icon.imageUrl : '',
        banner: ban && ban.thumbnails && ban.thumbnails[0] ? ban.thumbnails[0].imageUrl : '',
      };
      out[g.id] = info;
      data.cache['g:' + g.id] = { t: Date.now(), v: info };
      data.cache['u:' + g.rootPlaceId] = g.id;
    }
  }
  saveData();
  return universeIds.map((id) => out[id]).filter(Boolean);
}

async function gamesByPlace(placeIds) {
  const uids = [];
  for (const p of [...new Set(placeIds.map(Number))]) {
    try { uids.push(await universeFromPlace(p)); } catch {}
  }
  return gamesByUniverse(uids);
}

// Busca universeIds dentro de cualquier respuesta (las APIs de explore cambian seguido)
function collectGames(node, acc = []) {
  if (Array.isArray(node)) node.forEach((n) => collectGames(n, acc));
  else if (node && typeof node === 'object') {
    if (node.universeId && (node.name || node.rootPlaceId)) acc.push(node.universeId);
    else Object.values(node).forEach((v) => collectGames(v, acc));
  }
  return acc;
}

async function discover() {
  const sid = crypto.randomUUID();
  try {
    const r = await get(`https://apis.roblox.com/explore-api/v1/get-sorts?sessionId=${sid}&device=computer&country=all`);
    const sorts = (r.sorts || []).filter((s) => Array.isArray(s.games) && s.games.length).slice(0, 8);
    const result = [];
    for (const s of sorts) {
      const games = await gamesByUniverse(s.games.slice(0, 24).map((g) => g.universeId));
      if (games.length) result.push({ title: s.sortDisplayName || s.topic || 'Juegos', games });
    }
    if (result.length) return result;
  } catch (e) { console.error('explore', e.message); }
  // Plan B: búsquedas fijas
  const rows = [];
  for (const [title, q] of [['Populares', 'popular'], ['Simuladores', 'simulator'], ['Obbys', 'obby'], ['Terror', 'horror']]) {
    const games = await search(q).catch(() => []);
    if (games.length) rows.push({ title, games });
  }
  return rows;
}

async function search(q) {
  const sid = crypto.randomUUID();
  const r = await get(`https://apis.roblox.com/search-api/omni-search?searchQuery=${encodeURIComponent(q)}&sessionId=${sid}&pageType=all`);
  const ids = collectGames(r.searchResults || r).slice(0, 30);
  return gamesByUniverse(ids);
}

// ---------- cuenta ----------
async function me() {
  try {
    const u = await get('https://users.roblox.com/v1/users/authenticated');
    if (!u || !u.id) return null;
    const [cur, friends, followers, avatar, head] = await Promise.all([
      get(`https://economy.roblox.com/v1/users/${u.id}/currency`).catch(() => ({})),
      get(`https://friends.roblox.com/v1/users/${u.id}/friends/count`).catch(() => ({})),
      get(`https://friends.roblox.com/v1/users/${u.id}/followers/count`).catch(() => ({})),
      get(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${u.id}&size=720x720&format=Png&isCircular=false`).catch(() => ({ data: [] })),
      get(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${u.id}&size=150x150&format=Png&isCircular=false`).catch(() => ({ data: [] })),
    ]);
    return {
      id: u.id, name: u.name, displayName: u.displayName,
      robux: cur.robux ?? null,
      friends: friends.count ?? null,
      followers: followers.count ?? null,
      avatar: avatar.data && avatar.data[0] ? avatar.data[0].imageUrl : '',
      headshot: head.data && head.data[0] ? head.data[0].imageUrl : '',
    };
  } catch { return null; }
}

async function accountFavorites(userId) {
  try {
    const r = await get(`https://games.roblox.com/v2/users/${userId}/favorite/games?limit=50&sortOrder=Desc`);
    return gamesByUniverse((r.data || []).map((g) => g.id));
  } catch { return []; }
}

async function friendsList(userId) {
  const r = await get(`https://friends.roblox.com/v1/users/${userId}/friends`);
  const ids = (r.data || []).map((f) => f.id);
  if (!ids.length) return [];
  const users = {}, heads = {}, pres = {};
  for (const part of chunk(ids, 100)) {
    const [u, h, p] = await Promise.all([
      post('https://users.roblox.com/v1/users', { userIds: part, excludeBannedUsers: true }).catch(() => ({ data: [] })),
      get(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${part.join(',')}&size=150x150&format=Png&isCircular=false`).catch(() => ({ data: [] })),
      post('https://presence.roblox.com/v1/presence/users', { userIds: part }).catch(() => ({ userPresences: [] })),
    ]);
    (u.data || []).forEach((x) => (users[x.id] = x));
    (h.data || []).forEach((x) => (heads[x.targetId] = x.imageUrl));
    (p.userPresences || []).forEach((x) => (pres[x.userId] = x));
  }
  // nombre del juego de los que están jugando
  const playingU = Object.values(pres).filter((p) => p.userPresenceType === 2 && p.universeId).map((p) => p.universeId);
  const gmap = {};
  (await gamesByUniverse(playingU).catch(() => [])).forEach((g) => (gmap[g.universeId] = g));
  return ids.map((id) => {
    const p = pres[id] || {};
    const fromList = (r.data || []).find((f) => f.id === id) || {};
    const u = users[id] || fromList;
    const g = gmap[p.universeId];
    return {
      id,
      name: u.name || '',
      displayName: u.displayName || u.name || String(id),
      headshot: heads[id] || '',
      status: ['offline', 'online', 'ingame', 'studio', 'invisible'][p.userPresenceType || 0] || 'offline',
      game: g ? g.name : (p.lastLocation || ''),
      gameIcon: g ? g.icon : '',
      placeId: p.rootPlaceId || p.placeId || null,
      jobId: p.gameId || null,
    };
  }).sort((a, b) => rank(b.status) - rank(a.status) || a.displayName.localeCompare(b.displayName));
}
const rank = (s) => ({ ingame: 3, studio: 2, online: 1 }[s] || 0);

function openLogin() {
  return new Promise((resolve) => {
    const w = new BrowserWindow({
      width: 480, height: 720, parent: win, modal: true, autoHideMenuBar: true,
      title: 'Iniciar sesión en Roblox', backgroundColor: '#111',
      webPreferences: { partition: PARTITION },
    });
    w.loadURL('https://www.roblox.com/login');
    const check = async () => {
      const c = await rbxSession().cookies.get({ name: '.ROBLOSECURITY' });
      if (c.length) { clearInterval(t); if (!w.isDestroyed()) w.close(); resolve(true); }
    };
    const t = setInterval(check, 1000);
    w.on('closed', () => { clearInterval(t); resolve(false); });
  });
}

async function logout() {
  csrf = '';
  await rbxSession().clearStorageData();
  return true;
}


// ---------- servidores y región ----------
const regionCache = {};
async function servers(placeId, cursor) {
  const r = await get(`https://games.roblox.com/v1/games/${Number(placeId)}/servers/Public?sortOrder=Desc&excludeFullGames=false&limit=100${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`);
  return {
    next: r.nextPageCursor || null,
    servers: (r.data || []).map((s) => ({ id: s.id, playing: s.playing || 0, max: s.maxPlayers || 0, ping: s.ping ?? null, fps: s.fps ?? null })),
  };
}

async function geo(ip) {
  const key = ip.split('.').slice(0, 3).join('.'); // mismo bloque = mismo centro de datos
  if (data.cache['ip:' + key]) return data.cache['ip:' + key];
  const r = await net.fetch(`https://ipinfo.io/${ip}/json`).then((x) => x.json());
  const g = { city: r.city || '', region: r.region || '', country: r.country || '' };
  data.cache['ip:' + key] = g; saveData();
  return g;
}

// Pide a Roblox los datos de conexión del servidor (sin entrar) para saber su IP y ubicarla
async function serverRegion(placeId, jobId) {
  if (regionCache[jobId]) return regionCache[jobId];
  const r = await request('https://gamejoin.roblox.com/v1/join-game-instance', {
    method: 'POST',
    headers: { 'User-Agent': 'Roblox/WinInet' },
    body: { placeId: Number(placeId), gameId: jobId, gameJoinAttemptId: crypto.randomUUID(), isTeleport: false },
  });
  const js = r && r.joinScript;
  const ip = js && ((js.UdmuxEndpoints && js.UdmuxEndpoints[0] && js.UdmuxEndpoints[0].Address) || js.MachineAddress);
  if (!ip || /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(ip)) return null;
  const g = await geo(ip);
  regionCache[jobId] = g;
  return g;
}

// ---------- insignias ----------
async function badgeIcons(ids) {
  const out = {};
  for (const part of chunk(ids, 100)) {
    const r = await get(`https://thumbnails.roblox.com/v1/badges/icons?badgeIds=${part.join(',')}&size=150x150&format=Png&isCircular=false`).catch(() => ({ data: [] }));
    (r.data || []).forEach((x) => (out[x.targetId] = x.imageUrl));
  }
  return out;
}
async function awardedDates(userId, ids) {
  const out = {};
  for (const part of chunk(ids, 100)) {
    const r = await get(`https://badges.roblox.com/v1/users/${userId}/badges/awarded-dates?badgeIds=${part.join(',')}`).catch(() => ({ data: [] }));
    (r.data || []).forEach((x) => (out[x.badgeId] = x.awardedDate));
  }
  return out;
}

async function recentBadges(userId) {
  const r = await get(`https://badges.roblox.com/v1/users/${userId}/badges?limit=25&sortOrder=Desc`);
  const list = r.data || [];
  const ids = list.map((b) => b.id);
  const [icons, dates] = await Promise.all([badgeIcons(ids), awardedDates(userId, ids)]);
  const places = [...new Set(list.map((b) => b.awarder && b.awarder.id).filter(Boolean))];
  const games = {};
  (await gamesByPlace(places).catch(() => [])).forEach((g) => (games[g.placeId] = g));
  return list.map((b) => {
    const g = b.awarder ? games[b.awarder.id] : null;
    return { id: b.id, name: b.name, description: b.description || '', icon: icons[b.id] || '', awarded: dates[b.id] || null, game: g ? { name: g.name, placeId: g.placeId } : null };
  });
}

async function gameBadges(universeId, userId) {
  let list = [], cursor = '';
  for (let i = 0; i < 3; i++) { // hasta 300 insignias
    const r = await get(`https://badges.roblox.com/v1/universes/${universeId}/badges?limit=100&sortOrder=Asc${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`);
    list = list.concat(r.data || []);
    if (!r.nextPageCursor) break;
    cursor = r.nextPageCursor;
  }
  list = list.filter((b) => b.enabled !== false);
  const ids = list.map((b) => b.id);
  const [icons, dates] = await Promise.all([badgeIcons(ids), userId ? awardedDates(userId, ids) : {}]);
  return list.map((b) => ({
    id: b.id, name: b.name, description: b.description || '', icon: icons[b.id] || '',
    owned: !!dates[b.id], awarded: dates[b.id] || null,
    rarity: b.statistics ? b.statistics.winRatePercentage : null,
  }));
}

// ---------- galería de mods (se guardan en la carpeta de mods de Bloxstrap) ----------
const MODS_DIR = path.join(__dirname, 'src', 'mods');
const MOD_CATS = {
  sound: {
    folder: 'sounds', ext: 'ogg', importExt: ['ogg', 'mp3', 'wav'],
    targets: ['content/sounds/ouch.ogg'],
    items: [['bonk', 'Bonk 8-bit'], ['pop', 'Pop'], ['glitch', 'Glitch'], ['campana', 'Campana'], ['laser', 'Láser'], ['boing', 'Boing']],
  },
  cursor: {
    folder: 'cursors', ext: 'png', importExt: ['png'],
    targets: ['content/textures/Cursors/KeyboardMouse/ArrowCursor.png', 'content/textures/Cursors/KeyboardMouse/ArrowFarCursor.png'],
    items: [['punto', 'Punto'], ['punto-neon', 'Punto neón'], ['anillo', 'Anillo'], ['mira', 'Mira'], ['cruz-cian', 'Cruz cian'], ['flecha', 'Flecha']],
  },
  shiftlock: {
    folder: 'shiftlock', ext: 'png', importExt: ['png'],
    targets: ['content/textures/MouseLockedCursor.png'],
    items: [['punto', 'Punto'], ['cruz', 'Cruz'], ['mira-neon', 'Mira neón'], ['anillo-cian', 'Anillo cian']],
  },
};
const md5 = (buf) => crypto.createHash('md5').update(buf).digest('hex');
const modAsset = (cat, id) => path.join(MODS_DIR, MOD_CATS[cat].folder, `${id}.${MOD_CATS[cat].ext}`);

function modsList() {
  const out = {};
  for (const [cat, c] of Object.entries(MOD_CATS)) {
    let active = null;
    const target = path.join(BLOX_MODS, c.targets[0]);
    if (fs.existsSync(target)) {
      const h = md5(fs.readFileSync(target));
      const hit = c.items.find(([id]) => { try { return md5(fs.readFileSync(modAsset(cat, id))) === h; } catch { return false; } });
      active = hit ? hit[0] : 'custom';
    }
    out[cat] = { active, items: c.items.map(([id, name]) => ({ id, name, file: `mods/${c.folder}/${id}.${c.ext}` })) };
  }
  return { installed: fs.existsSync(BLOX_DIR), cats: out };
}
function writeMod(cat, buf) {
  for (const t of MOD_CATS[cat].targets) {
    const dest = path.join(BLOX_MODS, t);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buf);
  }
}
function modApply(cat, id) {
  if (!MOD_CATS[cat] || !MOD_CATS[cat].items.some(([x]) => x === id)) return modsList();
  writeMod(cat, fs.readFileSync(modAsset(cat, id)));
  return modsList();
}
async function modImport(cat) {
  const c = MOD_CATS[cat];
  if (!c) return modsList();
  const r = await dialog.showOpenDialog(win, { title: 'Elige un archivo', properties: ['openFile'], filters: [{ name: 'Archivo', extensions: c.importExt }] });
  if (!r.canceled && r.filePaths[0]) writeMod(cat, fs.readFileSync(r.filePaths[0]));
  return modsList();
}
function modReset(cat) {
  if (!MOD_CATS[cat]) return modsList();
  for (const t of MOD_CATS[cat].targets) { try { fs.unlinkSync(path.join(BLOX_MODS, t)); } catch {} }
  return modsList();
}

// ---------- actualizaciones (GitHub Releases) ----------
let updater = null;
let updateState = { state: 'idle' };
function sendUpdate(patch) {
  updateState = { ...updateState, ...patch };
  if (win && !win.isDestroyed()) win.webContents.send('update', updateState);
}
function initUpdater() {
  if (!app.isPackaged) { updateState = { state: 'dev' }; return; }
  try { updater = require('electron-updater').autoUpdater; } catch { updateState = { state: 'error', message: 'Falta electron-updater' }; return; }
  updater.autoDownload = true;
  updater.autoInstallOnAppQuit = true;
  updater.on('checking-for-update', () => sendUpdate({ state: 'checking' }));
  updater.on('update-available', (i) => sendUpdate({ state: 'downloading', version: i.version, percent: 0 }));
  updater.on('update-not-available', () => sendUpdate({ state: 'latest' }));
  updater.on('download-progress', (p) => sendUpdate({ state: 'downloading', percent: Math.round(p.percent) }));
  updater.on('update-downloaded', (i) => sendUpdate({ state: 'ready', version: i.version }));
  updater.on('error', (e) => sendUpdate({ state: 'error', message: String(e && e.message || e).slice(0, 160) }));
  const check = () => updater.checkForUpdates().catch(() => {});
  setTimeout(check, 4000);
  setInterval(check, 2 * 3600 * 1000);
}

// ---------- historial (logs de Bloxstrap y Roblox) ----------
function listLogs(dir) {
  try { return fs.readdirSync(dir).filter((f) => f.endsWith('.log')).map((f) => path.join(dir, f)); } catch { return []; }
}

function parseBloxLog(text) {
  const out = [];
  let cur = null, lastTs = null;
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^(\d{4}-\d\d-\d\dT[\d:.]+Z)\s/);
    if (!m) continue;
    lastTs = m[1];
    let j = line.match(/Joined Game \((\d+)\/([\w-]+)\)/);
    if (j) { if (cur) { cur.end = lastTs; out.push(cur); } cur = { placeId: +j[1], jobId: j[2], start: m[1], end: null }; continue; }
    if (cur && /Disconnected from Game|User is back into the desktop app/.test(line)) { cur.end = m[1]; out.push(cur); cur = null; }
  }
  if (cur) { cur.end = lastTs; out.push(cur); }
  return out;
}

function parseRobloxLog(text) {
  const out = [];
  let cur = null, lastTs = null;
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^(\d{4}-\d\d-\d\dT[\d:.]+Z)/);
    if (!m) continue;
    lastTs = m[1];
    const j = line.match(/! Joining game '([\w-]+)' place (\d+)/);
    if (j) { if (cur) { cur.end = lastTs; out.push(cur); } cur = { placeId: +j[2], jobId: j[1], start: m[1], end: null }; continue; }
    if (cur && /Client:Disconnect|Disconnection Notification|leaveUGCGameInternal/.test(line)) { cur.end = m[1]; out.push(cur); cur = null; }
  }
  if (cur) { cur.end = lastTs; out.push(cur); }
  return out;
}

function refreshSessions() {
  let found = [];
  for (const f of listLogs(BLOX_LOGS)) { try { found.push(...parseBloxLog(fs.readFileSync(f, 'utf8'))); } catch {} }
  if (!found.length) for (const f of listLogs(ROBLOX_LOGS)) { try { found.push(...parseRobloxLog(fs.readFileSync(f, 'utf8'))); } catch {} }
  const map = new Map(data.sessions.map((s) => [`${s.placeId}|${s.jobId}`, s]));
  for (const s of found) {
    const k = `${s.placeId}|${s.jobId}`;
    const prev = map.get(k);
    if (!prev || (s.end && (!prev.end || s.end > prev.end))) map.set(k, s);
  }
  data.sessions = [...map.values()].sort((a, b) => (a.start < b.start ? 1 : -1)).slice(0, 2000);
  saveData();
  return data.sessions;
}

// ---------- Bloxstrap ----------
function bloxGet() {
  const installed = fs.existsSync(BLOX_EXE);
  let s = {};
  try { s = JSON.parse(fs.readFileSync(BLOX_SETTINGS, 'utf8').replace(/^﻿/, '')); } catch {}
  const settings = {};
  BLOX_KEYS.forEach((k) => (settings[k] = !!s[k]));
  return { installed, settings };
}
function bloxSet(key, value) {
  if (!BLOX_KEYS.includes(key)) return bloxGet();
  try {
    const s = JSON.parse(fs.readFileSync(BLOX_SETTINGS, 'utf8').replace(/^﻿/, ''));
    s[key] = !!value;
    fs.writeFileSync(BLOX_SETTINGS, JSON.stringify(s, null, 2));
  } catch (e) { console.error(e); }
  return bloxGet();
}

// ---------- lanzar ----------
function launch({ placeId, jobId } = {}) {
  let url = 'roblox://';
  if (placeId) {
    url = `roblox://experiences/start?placeId=${Number(placeId)}`;
    if (jobId && /^[\w-]+$/.test(jobId)) url += `&gameInstanceId=${jobId}`;
  }
  shell.openExternal(url);
  if (data.prefs.minimizeOnPlay && win) win.minimize();
  return true;
}

// ---------- ventana ----------
function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 780, minWidth: 1040, minHeight: 640,
    frame: false, backgroundColor: '#07080c', show: false,
    title: 'Orbit',
    icon: path.join(__dirname, 'src', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true },
  });
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  win.once('ready-to-show', () => win.show());
  // links externos al navegador
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
}

const handle = (ch, fn) => ipcMain.handle(ch, async (_e, ...a) => fn(...a));
handle('state:get', () => ({ favorites: data.favorites, selected: data.selected, prefs: data.prefs }));
handle('state:set', (patch) => { Object.assign(data, patch); saveData(); return true; });
handle('games:byPlace', (ids) => gamesByPlace(ids || []));
handle('games:discover', () => discover());
handle('games:search', (q) => search(q));
handle('sessions', () => refreshSessions());
handle('account:me', () => me());
handle('account:favorites', (id) => accountFavorites(id));
handle('account:friends', (id) => friendsList(id).catch(() => []));
handle('account:login', () => openLogin());
handle('account:logout', () => logout());
handle('blox:get', () => bloxGet());
handle('blox:set', (k, v) => bloxSet(k, v));
handle('blox:menu', () => { if (fs.existsSync(BLOX_EXE)) spawn(BLOX_EXE, ['-menu'], { detached: true, stdio: 'ignore' }).unref(); return true; });
handle('launch', (opts) => launch(opts));
handle('servers', (placeId, cursor) => servers(placeId, cursor));
handle('servers:region', (placeId, jobId) => serverRegion(placeId, jobId).catch(() => null));
handle('badges:recent', (userId) => recentBadges(userId).catch(() => []));
handle('badges:game', (universeId, userId) => gameBadges(universeId, userId).catch(() => null));
handle('mods:list', () => modsList());
handle('mods:apply', (cat, id) => modApply(cat, id));
handle('mods:import', (cat) => modImport(cat));
handle('mods:reset', (cat) => modReset(cat));
handle('app:version', () => app.getVersion());
handle('update:get', () => updateState);
handle('update:check', () => { if (updater) updater.checkForUpdates().catch(() => {}); return updateState; });
handle('update:install', () => { if (updater && updateState.state === 'ready') updater.quitAndInstall(); return true; });
handle('open', (url) => { if (/^https:\/\/(www\.)?roblox\.com\//.test(url)) shell.openExternal(url); return true; });
handle('win', (a) => { if (!win) return; if (a === 'min') win.minimize(); else if (a === 'max') win.isMaximized() ? win.unmaximize() : win.maximize(); else if (a === 'close') win.close(); });

app.whenReady().then(() => { loadData(); createWindow(); initUpdater(); });
app.on('window-all-closed', () => app.quit());

module.exports = { parseBloxLog, parseRobloxLog };
