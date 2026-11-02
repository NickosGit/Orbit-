// Orbit — interfaz
const api = window.orbit;
const $ = (s, el = document) => el.querySelector(s);
const main = $('#main');

const S = {
  page: 'home',
  favorites: [],
  selected: null,
  prefs: { accent: 'violet', minimizeOnPlay: true },
  games: {},          // placeId -> info
  sessions: [],
  me: null,
  friends: [],
  discover: null,
  accountFavs: null,
  libTab: 'favs',
};

// ---------- utilidades ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => {
  if (n == null) return '—';
  const one = (x) => (Math.round(x * 10) / 10).toString();
  if (n >= 1e9) return one(n / 1e9) + ' B';
  if (n >= 1e6) return one(n / 1e6) + ' M';
  if (n >= 1e4) return one(n / 1e3) + ' k';
  return new Intl.NumberFormat('es-MX').format(n);
};
const dur = (ms) => {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
};
const ago = (iso) => {
  const d = (Date.now() - new Date(iso)) / 1000;
  if (d < 3600) return `hace ${Math.max(1, Math.round(d / 60))} min`;
  if (d < 86400) return `hace ${Math.round(d / 3600)} h`;
  const days = Math.round(d / 86400);
  return days === 1 ? 'ayer' : `hace ${days} días`;
};
const sessMs = (s) => Math.max(0, new Date(s.end || s.start) - new Date(s.start));
const ICON = {
  play: '<svg viewBox="0 0 24 24"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z"/></svg>',
  heart: '<svg viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>',
  ext: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  pin: '<svg viewBox="0 0 24 24"><path d="M12 17v5M9 3h6l-1 6 4 4H6l4-4z"/></svg>',
  robux: '<svg class="robux" viewBox="0 0 24 24"><path d="M12 2.5l8.2 4.75v9.5L12 21.5l-8.2-4.75v-9.5z"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>',
};

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.add('hidden'), 2600);
}

function remember(list) { (list || []).forEach((g) => g && (S.games[g.placeId] = g)); return list || []; }
async function ensureGames(placeIds) {
  const need = placeIds.filter((p) => p && !S.games[p]);
  if (need.length) remember(await api.gamesByPlace(need).catch(() => []));
  return placeIds.map((p) => S.games[p]).filter(Boolean);
}

const isFav = (pid) => S.favorites.includes(Number(pid));
async function toggleFav(pid) {
  pid = Number(pid);
  S.favorites = isFav(pid) ? S.favorites.filter((x) => x !== pid) : [pid, ...S.favorites];
  await api.setState({ favorites: S.favorites });
  toast(isFav(pid) ? 'Agregado a favoritos' : 'Quitado de favoritos');
}
async function select(pid) {
  S.selected = Number(pid);
  await api.setState({ selected: S.selected });
}
async function play(pid, jobId) {
  if (!pid) { api.launch({}); return; }
  await select(pid);
  api.launch({ placeId: pid, jobId });
  toast('Abriendo Roblox…');
  setBackdrop();
}

function setBackdrop() {
  const g = S.games[S.selected];
  $('#backdrop-img').style.backgroundImage = g && (g.banner || g.icon) ? `url("${g.banner || g.icon}")` : '';
}

// ---------- componentes ----------
function card(g, { wide = false, sub } = {}) {
  if (!g) return '';
  const img = wide ? g.banner || g.icon : g.icon;
  return `<div class="card ${wide ? 'wide-card' : ''}" data-open="${g.placeId}">
    <div class="card-img">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : ''}
      <button class="card-play" data-play="${g.placeId}" title="Jugar">${ICON.play}</button></div>
    <div class="card-name">${esc(g.name)}</div>
    <div class="card-meta">${sub ? `<span>${esc(sub)}</span>` : `<span class="live">${fmt(g.playing)}</span>${g.rating != null ? `<span>👍 ${g.rating}%</span>` : ''}`}</div>
  </div>`;
}
const skeletonRow = (n = 6) => `<div class="row">${Array.from({ length: n }, () => '<div class="card"><div class="card-img skeleton"></div><div class="card-name skeleton" style="height:12px;width:70%;border-radius:6px"></div></div>').join('')}</div>`;
const section = (title, body, more) => `<section class="section fade-in"><div class="section-head"><h2>${esc(title)}</h2>${more || ''}</div>${body}</section>`;

// ---------- páginas ----------
const pages = {
  async home() {
    const recentIds = [...new Set(S.sessions.map((s) => s.placeId))].slice(0, 12);
    if (!S.selected) S.selected = recentIds[0] || S.favorites[0] || null;
    await ensureGames([S.selected, ...recentIds, ...S.favorites].filter(Boolean));
    setBackdrop();
    const g = S.games[S.selected];
    const lastByPlace = {};
    S.sessions.forEach((s) => { if (!lastByPlace[s.placeId]) lastByPlace[s.placeId] = s.start; });

    const hero = g ? `
      <div class="hero fade-in">
        <div class="hero-bg" style="background-image:url('${esc(g.banner || g.icon)}')"></div>
        <div class="hero-body">
          <div class="hero-tag">${lastByPlace[g.placeId] ? 'CONTINUAR JUGANDO' : 'SELECCIONADO'}</div>
          <h1>${esc(g.name)}</h1>
          <div class="hero-by">por ${esc(g.creator)}${g.genre ? ` · ${esc(g.genre)}` : ''}</div>
          <div class="chips">
            <span class="chip"><span class="dot"></span><b>${fmt(g.playing)}</b> jugando</span>
            ${g.rating != null ? `<span class="chip">👍 <b>${g.rating}%</b></span>` : ''}
            <span class="chip"><b>${fmt(g.visits)}</b> visitas</span>
          </div>
          <div class="hero-actions">
            <button class="play" data-play="${g.placeId}">${ICON.play}JUGAR</button>
            <button class="icon-btn ${isFav(g.placeId) ? 'on' : ''}" data-fav="${g.placeId}" title="Favorito">${ICON.heart}</button>
            <button class="icon-btn" data-open="${g.placeId}" title="Detalles">${ICON.ext}</button>
          </div>
        </div>
      </div>` : `
      <div class="hero fade-in" style="display:grid;place-items:center;text-align:center">
        <div style="position:relative;z-index:1"><h1 style="font-size:34px;font-weight:850;margin-bottom:10px">Bienvenido a Orbit</h1>
        <p style="color:var(--muted);margin-bottom:22px">Busca un juego en Descubrir para empezar.</p>
        <button class="play" data-page="discover">${ICON.search}DESCUBRIR</button></div>
      </div>`;

    const recents = recentIds.map((p) => S.games[p]).filter(Boolean);
    const favs = S.favorites.map((p) => S.games[p]).filter(Boolean);
    main.innerHTML = hero
      + (recents.length ? section('Continuar jugando', `<div class="row">${recents.map((r) => card(r, { sub: ago(lastByPlace[r.placeId]) })).join('')}</div>`, '<button class="more" data-page="stats">Ver estadísticas →</button>') : '')
      + (favs.length ? section('Tus favoritos', `<div class="row">${favs.map((f) => card(f)).join('')}</div>`, '<button class="more" data-page="library">Ver todos →</button>') : '')
      + `<div id="home-trend">${section('Tendencias', skeletonRow())}</div>`;

    const rows = await loadDiscover();
    const el = $('#home-trend');
    if (el) el.innerHTML = rows.length ? section(rows[0].title, `<div class="row">${rows[0].games.map((x) => card(x)).join('')}</div>`, '<button class="more" data-page="discover">Explorar más →</button>') : '';
  },

  async discover() {
    main.innerHTML = `<h1 class="page-title">Descubrir</h1><p class="page-sub">Todos los juegos de Roblox, sin salir del launcher.</p>
      <div class="searchbar">${ICON.search}<input id="q" class="input" placeholder="Busca un juego o pega un link de roblox.com…" /></div>
      <div id="disc">${skeletonRow()}${skeletonRow()}</div>`;
    const q = $('#q');
    q.addEventListener('keydown', async (e) => {
      if (e.key !== 'Enter') return;
      const v = q.value.trim();
      if (!v) return renderDiscoverRows(await loadDiscover());
      const link = v.match(/games\/(\d+)/) || v.match(/^(\d{4,})$/);
      $('#disc').innerHTML = skeletonRow();
      const res = link ? await ensureGames([Number(link[1])]) : remember(await api.search(v).catch(() => []));
      $('#disc').innerHTML = res.length ? section(`Resultados para “${v}”`, `<div class="grid">${res.map((g) => card(g)).join('')}</div>`) : '<div class="empty">No encontré nada. Prueba con otro nombre o pega el link del juego.</div>';
    });
    renderDiscoverRows(await loadDiscover());
  },

  async library() {
    const tab = S.libTab;
    main.innerHTML = `<h1 class="page-title">Biblioteca</h1><p class="page-sub">Tus juegos guardados y lo que has jugado.</p>
      <div class="tabs">
        <button class="tab ${tab === 'favs' ? 'active' : ''}" data-lib="favs">Favoritos de Orbit</button>
        <button class="tab ${tab === 'account' ? 'active' : ''}" data-lib="account">Favoritos de Roblox</button>
        <button class="tab ${tab === 'recent' ? 'active' : ''}" data-lib="recent">Jugados</button>
      </div><div id="lib">${skeletonRow()}</div>`;
    let list = [];
    if (tab === 'favs') list = await ensureGames(S.favorites);
    if (tab === 'recent') list = await ensureGames([...new Set(S.sessions.map((s) => s.placeId))]);
    if (tab === 'account') {
      if (!S.me) { $('#lib').innerHTML = loginBlock('Inicia sesión para ver los favoritos de tu cuenta de Roblox.'); return; }
      if (!S.accountFavs) S.accountFavs = remember(await api.accountFavorites(S.me.id).catch(() => []));
      list = S.accountFavs;
    }
    $('#lib').innerHTML = list.length ? `<div class="grid fade-in">${list.map((g) => card(g)).join('')}</div>`
      : `<div class="empty">${tab === 'favs' ? 'Todavía no tienes favoritos. Dale ♥ a un juego para guardarlo aquí.' : 'Aún no hay nada aquí.'}</div>`;
  },

  async stats() {
    const now = Date.now(), day = 86400000;
    const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
    const sum = (arr) => arr.reduce((a, s) => a + sessMs(s), 0);
    const today = sum(S.sessions.filter((s) => new Date(s.start) >= startToday));
    const week = sum(S.sessions.filter((s) => now - new Date(s.start) < 7 * day));
    const total = sum(S.sessions);
    const per = {};
    S.sessions.forEach((s) => (per[s.placeId] = (per[s.placeId] || 0) + sessMs(s)));
    const top = Object.entries(per).sort((a, b) => b[1] - a[1]).slice(0, 8);
    await ensureGames(top.map(([p]) => Number(p)).concat(S.sessions.slice(0, 12).map((s) => s.placeId)));
    const max = top.length ? top[0][1] : 1;

    main.innerHTML = `<h1 class="page-title">Estadísticas</h1><p class="page-sub">Calculado con los registros de Bloxstrap en tu PC.</p>
      <div class="kpis fade-in">
        <div class="kpi"><div class="k">Hoy</div><div class="v">${dur(today)}</div></div>
        <div class="kpi"><div class="k">Últimos 7 días</div><div class="v">${dur(week)}</div></div>
        <div class="kpi"><div class="k">Total registrado</div><div class="v">${dur(total)}</div></div>
        <div class="kpi"><div class="k">Sesiones</div><div class="v">${S.sessions.length}</div></div>
      </div>
      <div class="two fade-in">
        <div class="panel"><div class="section-head"><h2>Más jugados</h2></div>
          ${top.length ? top.map(([p, ms]) => { const g = S.games[p] || { name: `Juego ${p}` }; return `<div class="top" data-open="${p}">
            <img src="${esc(g.icon || '')}" alt=""><div class="t-main"><div class="t-name">${esc(g.name)}</div><div class="bar"><i style="width:${Math.max(4, (ms / max) * 100)}%"></i></div></div>
            <div class="t-val">${dur(ms)}</div></div>`; }).join('') : '<div class="empty">Juega algo con Bloxstrap y aquí aparecerá.</div>'}
        </div>
        <div class="panel"><div class="section-head"><h2>Sesiones recientes</h2></div>
          ${S.sessions.slice(0, 12).map((s) => `<div class="sess"><span>${esc((S.games[s.placeId] || {}).name || s.placeId)}</span><span>${dur(sessMs(s))} · ${ago(s.start)}</span></div>`).join('') || '<div class="empty">Sin sesiones todavía.</div>'}
        </div>
      </div>`;
  },

  async profile() {
    if (!S.me) {
      main.innerHTML = `<h1 class="page-title">Perfil</h1>${loginBlock('Conecta tu cuenta de Roblox para ver tu avatar, tus Robux y a tus amigos en tiempo real.', true)}`;
      return;
    }
    const m = S.me;
    main.innerHTML = `<h1 class="page-title">Perfil</h1>
      <div class="profile fade-in">
        <img class="av" src="${esc(m.avatar)}" alt="">
        <div>
          <h1>${esc(m.displayName)}</h1>
          <div class="handle">@${esc(m.name)}</div>
          <div class="pstats">
            <div class="pstat"><div class="v">${ICON.robux}${fmt(m.robux)}</div><div class="k">Robux</div></div>
            <div class="pstat"><div class="v">${fmt(m.friends)}</div><div class="k">Amigos</div></div>
            <div class="pstat"><div class="v">${fmt(m.followers)}</div><div class="k">Seguidores</div></div>
            <div class="pstat"><div class="v">${S.friends.filter((f) => f.status !== 'offline').length}</div><div class="k">En línea ahora</div></div>
          </div>
          <div class="row-btns">
            <button class="btn primary" data-url="https://www.roblox.com/my/avatar">Editar avatar</button>
            <button class="btn" data-url="https://www.roblox.com/users/${m.id}/profile">Ver perfil en Roblox ${ICON.ext}</button>
            <button class="btn" data-logout>Cerrar sesión</button>
          </div>
        </div>
      </div>
      <div id="pf-favs">${section('Favoritos de tu cuenta', skeletonRow())}</div>`;
    if (!S.accountFavs) S.accountFavs = remember(await api.accountFavorites(m.id).catch(() => []));
    const el = $('#pf-favs');
    if (el) el.innerHTML = S.accountFavs.length ? section('Favoritos de tu cuenta', `<div class="row">${S.accountFavs.map((g) => card(g)).join('')}</div>`) : '';
  },

  async settings() {
    const b = await api.blox.get();
    const sw = (key, on, title, desc, attr = 'data-blox') => `<div class="set"><div><div class="s-t">${title}</div><div class="s-d">${desc}</div></div><button class="switch ${on ? 'on' : ''}" ${attr}="${key}"></button></div>`;
    const colors = { violet: '#8b5cf6', cyan: '#22d3ee', green: '#34d399', pink: '#f472b6', orange: '#fb923c' };
    main.innerHTML = `<h1 class="page-title">Ajustes</h1><p class="page-sub">Personaliza Orbit y controla Bloxstrap desde aquí.</p>
      <div class="set-group fade-in"><h3>Apariencia</h3>
        <div class="set"><div><div class="s-t">Color de acento</div><div class="s-d">Cambia el color de botones y brillos.</div></div>
          <div class="swatches">${Object.entries(colors).map(([k, c]) => `<button class="swatch ${S.prefs.accent === k ? 'active' : ''}" data-accent="${k}" style="background:${c}"></button>`).join('')}</div></div>
      </div>
      <div class="set-group fade-in"><h3>Launcher</h3>
        ${sw('minimizeOnPlay', S.prefs.minimizeOnPlay, 'Minimizar al jugar', 'Orbit se esconde cuando abres un juego.', 'data-pref')}
      </div>
      <div class="set-group fade-in"><h3>Bloxstrap</h3>
        <div class="set"><div><div class="s-t">Estado</div><div class="s-d">Orbit abre Roblox a través de Bloxstrap para conservar tus mods.</div></div>
          <span class="status ${b.installed ? '' : 'bad'}"><i></i>${b.installed ? 'Instalado' : 'No encontrado'}</span></div>
        ${b.installed ? `
        ${sw('ShowServerDetails', b.settings.ShowServerDetails, 'Mostrar región del servidor', 'Notificación con el país del servidor al entrar a un juego.')}
        ${sw('UseDiscordRichPresence', b.settings.UseDiscordRichPresence, 'Discord Rich Presence', 'Muestra en Discord a qué estás jugando.')}
        ${sw('ConfirmLaunches', b.settings.ConfirmLaunches, 'Confirmar al abrir', 'Pregunta antes de abrir otra instancia de Roblox.')}
        ${sw('EnableActivityTracking', b.settings.EnableActivityTracking, 'Seguimiento de actividad', 'Necesario para el historial y las estadísticas de Orbit.')}
        <div class="set"><div><div class="s-t">Mods, FastFlags y más</div><div class="s-d">Abre el menú completo de Bloxstrap.</div></div><button class="btn" data-bloxmenu>Abrir Bloxstrap</button></div>` : `
        <div class="set"><div><div class="s-t">Instalar Bloxstrap</div><div class="s-d">Sin Bloxstrap, Orbit abre Roblox normal y no hay estadísticas.</div></div><button class="btn primary" data-ext="https://bloxstraplabs.com/">Descargar</button></div>`}
      </div>`;
  },
};

function loginBlock(text, big) {
  return `<div class="login-card fade-in" ${big ? '' : 'style="padding:40px 20px"'}>
    <h2>${big ? 'Conecta tu cuenta' : 'Sin sesión'}</h2><p>${esc(text)}</p>
    <button class="btn primary" data-login>Iniciar sesión con Roblox</button>
    <p style="font-size:12px;margin:16px auto 0">Se abre la página oficial de Roblox. Tu sesión se guarda solo en esta PC.</p></div>`;
}

async function loadDiscover() {
  if (!S.discover) S.discover = await api.discover().catch(() => []);
  S.discover.forEach((r) => remember(r.games));
  return S.discover;
}
function renderDiscoverRows(rows) {
  const el = $('#disc');
  if (!el) return;
  el.innerHTML = rows.length ? rows.map((r) => section(r.title, `<div class="row">${r.games.map((g) => card(g)).join('')}</div>`)).join('')
    : '<div class="empty">No se pudieron cargar los juegos. Revisa tu conexión.</div>';
}

// ---------- modal de juego ----------
async function openGame(pid) {
  const [g] = await ensureGames([Number(pid)]);
  if (!g) return toast('No pude cargar ese juego');
  const m = $('#modal');
  const mine = S.sessions.filter((s) => s.placeId === g.placeId);
  const time = mine.reduce((a, s) => a + sessMs(s), 0);
  m.innerHTML = `<div class="gm">
    <div class="gm-ban" style="background-image:url('${esc(g.banner || g.icon)}')"><button class="gm-x" data-close>${ICON.x}</button></div>
    <div class="gm-body">
      <div class="gm-top"><img src="${esc(g.icon)}" alt=""><div><h2>${esc(g.name)}</h2><div class="by">por ${esc(g.creator)}${g.genre ? ` · ${esc(g.genre)}` : ''}</div></div></div>
      <div class="chips">
        <span class="chip"><span class="dot"></span><b>${fmt(g.playing)}</b> jugando</span>
        ${g.rating != null ? `<span class="chip">👍 <b>${g.rating}%</b></span>` : ''}
        <span class="chip"><b>${fmt(g.visits)}</b> visitas</span>
        ${g.maxPlayers ? `<span class="chip"><b>${g.maxPlayers}</b> por servidor</span>` : ''}
        ${time ? `<span class="chip">Has jugado <b>${dur(time)}</b></span>` : ''}
      </div>
      <div class="gm-actions">
        <button class="play" data-play="${g.placeId}">${ICON.play}JUGAR</button>
        <button class="btn ${isFav(g.placeId) ? 'on' : ''}" data-fav="${g.placeId}">${ICON.heart}${isFav(g.placeId) ? 'En favoritos' : 'Favorito'}</button>
        <button class="btn" data-pin="${g.placeId}">${ICON.pin}Fijar en inicio</button>
        <button class="btn" data-url="https://www.roblox.com/games/${g.placeId}">Roblox ${ICON.ext}</button>
      </div>
      <div class="gm-desc">${esc(g.description)}</div>
    </div></div>`;
  m.classList.remove('hidden');
}
const closeModal = () => $('#modal').classList.add('hidden');

// ---------- amigos ----------
function renderFriends() {
  const list = $('#fr-list');
  const count = $('#fr-count');
  if (!S.me) {
    count.textContent = '';
    list.innerHTML = `<div class="fr-empty">Inicia sesión para ver quién está conectado y unirte a sus juegos.<br><button class="btn primary" data-login>Iniciar sesión</button></div>`;
    return;
  }
  const q = $('#fr-search').value.trim().toLowerCase();
  const fs = S.friends.filter((f) => !q || f.displayName.toLowerCase().includes(q) || f.name.toLowerCase().includes(q));
  const online = S.friends.filter((f) => f.status !== 'offline').length;
  count.textContent = `${online} en línea`;
  count.className = 'pill' + (online ? ' live' : '');
  const groups = [['Jugando', (f) => f.status === 'ingame'], ['En línea', (f) => f.status === 'online' || f.status === 'studio'], ['Desconectados', (f) => f.status === 'offline' || f.status === 'invisible']];
  list.innerHTML = groups.map(([title, test]) => {
    const g = fs.filter(test);
    if (!g.length) return '';
    return `<div class="fr-group"><span>${title}</span><span>${g.length}</span></div>` + g.slice(0, title === 'Desconectados' ? 60 : 200).map((f) => `
      <div class="fr ${f.status}">
        <div class="fr-av"><img src="${esc(f.headshot)}" alt=""><i></i></div>
        <div class="fr-txt"><div class="fr-name">${esc(f.displayName)}</div>
          <div class="fr-sub">${f.status === 'ingame' ? esc(f.game || 'En un juego') : f.status === 'studio' ? 'En Studio' : f.status === 'online' ? 'En línea' : '@' + esc(f.name)}</div></div>
        ${f.status === 'ingame' && f.placeId ? `<button class="join" data-join="${f.placeId}" data-job="${esc(f.jobId || '')}">Unirse</button>` : ''}
      </div>`).join('');
  }).join('') || '<div class="fr-empty">Sin resultados.</div>';
}

async function refreshAccount() {
  S.me = await api.me().catch(() => null);
  $('#side-avatar').src = S.me ? S.me.headshot : '';
  if (S.me) S.friends = await api.friends(S.me.id).catch(() => []);
  else S.friends = [];
  renderFriends();
}

// ---------- navegación y eventos ----------
async function go(page) {
  S.page = page;
  document.querySelectorAll('.nav').forEach((n) => n.classList.toggle('active', n.dataset.page === page));
  main.scrollTop = 0;
  await pages[page]();
}

document.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-page],[data-play],[data-open],[data-fav],[data-pin],[data-url],[data-ext],[data-login],[data-logout],[data-join],[data-close],[data-blox],[data-pref],[data-accent],[data-bloxmenu],[data-lib],[data-win]');
  if (!t) { if (e.target.id === 'modal') closeModal(); return; }
  const d = t.dataset;
  if (d.win) return api.win(d.win);
  if (d.play) { e.stopPropagation(); closeModal(); return play(Number(d.play)); }
  if (d.join) return play(Number(d.join), d.job || undefined);
  if (d.fav) { await toggleFav(d.fav); if (!$('#modal').classList.contains('hidden')) openGame(d.fav); if (S.page === 'home') pages.home(); return; }
  if (d.pin) { await select(d.pin); closeModal(); toast('Fijado en Inicio'); return go('home'); }
  if (d.open) return openGame(d.open);
  if (d.close !== undefined) return closeModal();
  if (d.url) return api.open(d.url);
  if (d.ext) return api.open(d.ext);
  if (d.page) { closeModal(); return go(d.page); }
  if (d.lib) { S.libTab = d.lib; return pages.library(); }
  if (d.login !== undefined) { const ok = await api.login(); if (ok) { toast('Sesión iniciada'); await refreshAccount(); S.accountFavs = null; go(S.page); } return; }
  if (d.logout !== undefined) { await api.logout(); S.me = null; S.friends = []; S.accountFavs = null; $('#side-avatar').src = ''; renderFriends(); toast('Sesión cerrada'); return go('profile'); }
  if (d.blox) { const on = !t.classList.contains('on'); await api.blox.set(d.blox, on); t.classList.toggle('on', on); return toast('Guardado en Bloxstrap'); }
  if (d.pref) { S.prefs[d.pref] = !S.prefs[d.pref]; t.classList.toggle('on', S.prefs[d.pref]); return api.setState({ prefs: S.prefs }); }
  if (d.accent) { S.prefs.accent = d.accent; document.body.dataset.accent = d.accent; document.querySelectorAll('.swatch').forEach((s) => s.classList.toggle('active', s === t)); return api.setState({ prefs: S.prefs }); }
  if (d.bloxmenu !== undefined) return api.blox.menu();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
$('#fr-search').addEventListener('input', renderFriends);

// ---------- arranque ----------
(async function init() {
  const st = await api.getState();
  Object.assign(S, { favorites: st.favorites || [], selected: st.selected, prefs: { ...S.prefs, ...(st.prefs || {}) } });
  document.body.dataset.accent = S.prefs.accent;
  S.sessions = await api.sessions().catch(() => []);
  renderFriends();
  refreshAccount();
  go('home');
  // amigos y sesiones se actualizan solos
  setInterval(async () => { if (S.me) { S.friends = await api.friends(S.me.id).catch(() => S.friends); renderFriends(); } }, 45000);
  window.addEventListener('focus', async () => { S.sessions = await api.sessions().catch(() => S.sessions); if (S.page === 'home' || S.page === 'stats') go(S.page); });
})();
