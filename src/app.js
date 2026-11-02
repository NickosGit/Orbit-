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
  srv: null,          // { placeId, list, next, filter, sort, token }
  update: { state: 'idle' },
  version: '',
};
const regionName = (() => { try { const d = new Intl.DisplayNames(['es'], { type: 'region' }); return (cc) => (cc ? d.of(cc) : ''); } catch { return (cc) => cc; } })();

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
  globe: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
  upload: '<svg viewBox="0 0 24 24"><path d="M12 16V4M7 9l5-5 5 5M4 20h16"/></svg>',
  undo: '<svg viewBox="0 0 24 24"><path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>',
  badge: '<svg viewBox="0 0 24 24"><circle cx="12" cy="9" r="6"/><path d="M8.5 14L7 22l5-3 5 3-1.5-8"/></svg>',
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

    const av = S.me && S.me.avatar ? `<div class="hero-avatar"><div class="hero-glow"></div><div class="hero-floor"></div><img src="${esc(S.me.avatar)}" alt=""></div>` : '';
    const hero = g ? `
      <div class="hero fade-in ${av ? 'has-avatar' : ''}">
        <div class="hero-bg" style="background-image:url('${esc(g.banner || g.icon)}')"></div>${av}
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
            <button class="icon-btn" data-servers="${g.placeId}" title="Servidores">${ICON.globe}</button>
            <button class="icon-btn" data-open="${g.placeId}" title="Detalles">${ICON.ext}</button>
          </div>
        </div>
      </div>` : `
      <div class="hero fade-in ${av ? 'has-avatar' : ''}" style="display:grid;place-items:center;text-align:center">${av}
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
      <div id="pf-favs">${section('Favoritos de tu cuenta', skeletonRow())}</div>
      <div id="pf-badges">${section('Insignias recientes', skeletonRow(4))}</div>`;
    api.badges.recent(m.id).then((list) => {
      const el2 = $('#pf-badges');
      if (!el2) return;
      el2.innerHTML = list.length ? section('Insignias recientes', `<div class="badges">${list.map((b) => `
        <div class="bdg" ${b.game ? `data-open="${b.game.placeId}"` : ''} title="${esc(b.description)}">
          <img src="${esc(b.icon)}" alt="">
          <div class="bdg-txt"><div class="bdg-name">${esc(b.name)}</div>
          <div class="bdg-sub">${b.game ? esc(b.game.name) : ''}${b.awarded ? ` · ${ago(b.awarded)}` : ''}</div></div>
        </div>`).join('')}</div>`) : '';
    });
    if (!S.accountFavs) S.accountFavs = remember(await api.accountFavorites(m.id).catch(() => []));
    const el = $('#pf-favs');
    if (el) el.innerHTML = S.accountFavs.length ? section('Favoritos de tu cuenta', `<div class="row">${S.accountFavs.map((g) => card(g)).join('')}</div>`) : '';
  },


  async servers() {
    const recent = [...new Set(S.sessions.map((x) => x.placeId))];
    const pid = Number((S.srv && S.srv.placeId) || S.selected || S.favorites[0] || recent[0] || 0);
    const options = [...new Set([pid, S.selected, ...S.favorites, ...recent].filter(Boolean).map(Number))].slice(0, 10);
    await ensureGames(options);
    main.innerHTML = `<h1 class="page-title">Servidores</h1><p class="page-sub">Ve en qué región está cada servidor y entra al que te quede mejor.</p>
      <div class="srv-pick fade-in">${options.map((p) => { const g = S.games[p]; return g ? `<button class="pick ${p === pid ? 'active' : ''}" data-srvgame="${p}"><img src="${esc(g.icon)}" alt=""><span>${esc(g.name)}</span></button>` : ''; }).join('')}
        <input id="srv-other" class="input sm" placeholder="Pega el link de otro juego…" /></div>
      <div id="srv-body"></div>`;
    $('#srv-other').addEventListener('keydown', (e) => {
      const m = e.target.value.match(/games\/(\d+)/) || e.target.value.trim().match(/^(\d{4,})$/);
      if (e.key === 'Enter' && m) { S.srv = { placeId: Number(m[1]) }; pages.servers(); }
    });
    if (!pid) { $('#srv-body').innerHTML = '<div class="empty">Elige un juego en Descubrir o pega su link aquí arriba.</div>'; return; }
    if (!S.srv || S.srv.placeId !== pid || !S.srv.list) S.srv = { placeId: pid, list: [], next: null, filter: 'all', sort: 'ping', token: Date.now() };
    renderServers();
    if (!S.srv.list.length) await loadServers();
  },

  async mods() {
    const m = await api.mods.list();
    const meta = {
      sound: ['Sonido de muerte', 'Lo que suena cuando tu personaje muere.'],
      cursor: ['Cursor', 'El puntero del mouse dentro de los juegos.'],
      shiftlock: ['Cursor de shift lock', 'La mira que sale al activar shift lock.'],
    };
    const tile = (cat, it, active) => `
      <div class="mod ${active ? 'active' : ''}" data-modapply="${cat}|${it.id}">
        <div class="mod-prev ${cat}">${cat === 'sound' ? `<button class="mod-play" data-modplay="${esc(it.file)}">${ICON.play}</button>` : `<img src="${esc(it.file)}" alt="">`}</div>
        <div class="mod-name">${esc(it.name)}${active ? ICON.check : ''}</div>
      </div>`;
    main.innerHTML = `<h1 class="page-title">Mods</h1><p class="page-sub">Se aplican la próxima vez que abras Roblox. Funcionan con Bloxstrap.</p>
      ${!m.installed ? '<div class="empty">No encontré Bloxstrap en esta PC. Instálalo desde Ajustes para usar mods.</div>' : ''}
      ${Object.entries(m.cats).map(([cat, c]) => `
        <section class="section fade-in"><div class="section-head"><div><h2>${meta[cat][0]}</h2><div class="sec-sub">${meta[cat][1]}</div></div></div>
          <div class="mods">
            <div class="mod ${c.active === null ? 'active' : ''}" data-modreset="${cat}"><div class="mod-prev orig">${ICON.undo}</div><div class="mod-name">Original${c.active === null ? ICON.check : ''}</div></div>
            ${c.items.map((it) => tile(cat, it, c.active === it.id)).join('')}
            ${c.active === 'custom' ? `<div class="mod active"><div class="mod-prev orig">${ICON.check}</div><div class="mod-name">Tu archivo${ICON.check}</div></div>` : ''}
            <div class="mod import" data-modimport="${cat}"><div class="mod-prev orig">${ICON.upload}</div><div class="mod-name">Subir el tuyo</div></div>
          </div></section>`).join('')}
      <div class="panel fade-in" style="margin-top:28px;display:flex;align-items:center;justify-content:space-between;gap:20px">
        <div><div class="s-t" style="font-weight:650">Mods clásicos</div><div class="s-d" style="color:var(--muted);font-size:12.5px;margin-top:3px">El "oof" original, cursores de 2006 y 2013, emojis y más vienen en el menú de Bloxstrap.</div></div>
        <button class="btn" data-bloxmenu>Abrir Bloxstrap</button></div>`;
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
      </div>
      <div class="set-group fade-in"><h3>Actualizaciones</h3>
        <div class="set"><div><div class="s-t">Orbit ${esc(S.version)}</div><div class="s-d" id="upd-text">${updateText()}</div></div>
          ${S.update.state === 'ready' ? '<button class="btn primary" data-updinstall>Reiniciar y actualizar</button>' : `<button class="btn" data-updcheck ${S.update.state === 'dev' ? 'disabled' : ''}>Buscar actualizaciones</button>`}</div>
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


// ---------- servidores ----------
async function loadServers() {
  const srv = S.srv;
  const btn = $('#srv-more');
  if (btn) btn.textContent = 'Cargando…';
  try {
    const r = await api.servers(srv.placeId, srv.next);
    if (srv !== S.srv) return;
    srv.list = srv.list.concat(r.servers);
    srv.next = r.next;
  } catch { srv.error = true; }
  renderServers();
  resolveRegions(srv);
}

async function resolveRegions(srv) {
  if (!S.me) return;
  const queue = srv.list.filter((x) => x.region === undefined);
  queue.forEach((x) => (x.region = null));
  const worker = async () => {
    while (queue.length && srv === S.srv && S.page === 'servers') {
      const x = queue.shift();
      x.region = (await api.serverRegion(srv.placeId, x.id).catch(() => null)) || { failed: true };
      updateServerRow(x);
      scheduleChips();
    }
  };
  await Promise.all([worker(), worker(), worker()]);
}

const sortServers = (list, sort) => [...list].sort((a, b) =>
  sort === 'ping' ? (a.ping ?? 9999) - (b.ping ?? 9999) : sort === 'full' ? b.playing - a.playing : a.playing - b.playing);

function regionCell(x) {
  if (!S.me) return '<span class="cc muted">—</span><div><b>Región oculta</b><small>Inicia sesión para verla</small></div>';
  if (!x.region) return '<span class="cc skeleton"></span><div><b class="muted">Buscando…</b><small>&nbsp;</small></div>';
  if (x.region.failed) return '<span class="cc muted">?</span><div><b class="muted">Desconocida</b><small>&nbsp;</small></div>';
  const r = x.region;
  return `<span class="cc">${esc(r.country)}</span><div><b>${esc(r.city || regionName(r.country))}</b><small>${esc([r.region, regionName(r.country)].filter(Boolean).join(', '))}</small></div>`;
}
function serverRow(x) {
  const pct = x.max ? Math.round((x.playing / x.max) * 100) : 0;
  return `<div class="srv" data-sid="${esc(x.id)}">
    <div class="srv-reg">${regionCell(x)}</div>
    <div class="srv-pl"><div class="bar"><i style="width:${pct}%"></i></div><span>${x.playing}/${x.max}</span></div>
    <div class="srv-ping ${x.ping == null ? '' : x.ping < 80 ? 'good' : x.ping < 160 ? 'mid' : 'bad'}">${x.ping == null ? '—' : x.ping + ' ms'}</div>
    <button class="btn primary sm" data-joinsrv="${esc(x.id)}" ${x.playing >= x.max ? 'disabled' : ''}>${x.playing >= x.max ? 'Lleno' : 'Unirse'}</button>
  </div>`;
}
function updateServerRow(x) {
  const el = document.querySelector(`.srv[data-sid="${CSS.escape(x.id)}"] .srv-reg`);
  if (el) el.innerHTML = regionCell(x);
  applyServerFilter();
}
function visibleServers() {
  const srv = S.srv;
  return sortServers(srv.list, srv.sort).filter((x) => srv.filter === 'all' || (x.region && x.region.country === srv.filter));
}
function chipsHtml() {
  const counts = {};
  S.srv.list.forEach((x) => { if (x.region && x.region.country) counts[x.region.country] = (counts[x.region.country] || 0) + 1; });
  return `<button class="rchip ${S.srv.filter === 'all' ? 'active' : ''}" data-srvfilter="all">Todas <b>${S.srv.list.length}</b></button>` +
    Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([cc, n]) => `<button class="rchip ${S.srv.filter === cc ? 'active' : ''}" data-srvfilter="${cc}"><span class="cc">${cc}</span>${esc(regionName(cc))} <b>${n}</b></button>`).join('');
}
function scheduleChips() {
  clearTimeout(scheduleChips.t);
  scheduleChips.t = setTimeout(() => { const el = $('#srv-chips'); if (el) el.innerHTML = chipsHtml(); }, 250);
}
function applyServerFilter() {
  const f = S.srv.filter;
  document.querySelectorAll('.srv').forEach((row) => {
    const x = S.srv.list.find((s) => s.id === row.dataset.sid);
    row.style.display = f === 'all' || (x && x.region && x.region.country === f) ? '' : 'none';
  });
}
function renderServers() {
  const body = $('#srv-body');
  if (!body || !S.srv) return;
  const g = S.games[S.srv.placeId] || {};
  const srv = S.srv;
  const players = srv.list.reduce((a, x) => a + x.playing, 0);
  body.innerHTML = `
    <div class="srv-head fade-in">
      <div class="srv-game"><img src="${esc(g.icon || '')}" alt=""><div><h2>${esc(g.name || 'Juego')}</h2><span>${srv.list.length} servidores cargados · ${fmt(players)} jugadores</span></div></div>
      <div class="srv-tools">
        <select id="srv-sort" class="input sm">
          <option value="ping" ${srv.sort === 'ping' ? 'selected' : ''}>Menos ping</option>
          <option value="full" ${srv.sort === 'full' ? 'selected' : ''}>Más llenos</option>
          <option value="empty" ${srv.sort === 'empty' ? 'selected' : ''}>Más vacíos</option>
        </select>
        <button class="btn sm" data-srvreload>Actualizar</button>
      </div>
    </div>
    ${!S.me ? `<div class="srv-note">Para ver la región de cada servidor necesitas iniciar sesión. <button class="btn sm primary" data-login>Iniciar sesión</button></div>` : ''}
    <div id="srv-chips" class="rchips">${chipsHtml()}</div>
    <div class="srv-cols"><span>Región</span><span>Jugadores</span><span>Ping prom.</span><span></span></div>
    <div class="srv-list panel">${srv.error && !srv.list.length ? '<div class="empty">No pude cargar los servidores. Intenta de nuevo.</div>' : srv.list.length ? visibleServers().map(serverRow).join('') : Array.from({ length: 6 }, () => '<div class="srv"><div class="srv-reg"><span class="cc skeleton"></span><div><b class="skeleton" style="display:block;width:120px;height:12px;border-radius:6px"></b></div></div></div>').join('')}</div>
    ${srv.next ? '<div style="text-align:center;margin-top:16px"><button class="btn" id="srv-more" data-srvmore>Cargar más servidores</button></div>' : ''}`;
  $('#srv-sort').addEventListener('change', (e) => { srv.sort = e.target.value; renderServers(); });
}

// ---------- actualizaciones ----------
function updateText() {
  const u = S.update;
  return ({
    dev: 'Modo desarrollo: las actualizaciones automáticas funcionan en la versión instalada.',
    checking: 'Buscando actualizaciones…',
    latest: 'Tienes la versión más reciente.',
    downloading: `Descargando ${u.version ? 'v' + u.version : 'actualización'}… ${u.percent || 0}%`,
    ready: `La versión ${u.version} está lista. Se instala al reiniciar.`,
    error: 'No se pudo buscar actualizaciones.',
  })[u.state] || 'Se revisa sola cada vez que abres Orbit.';
}
function renderUpdate() {
  const pill = $('#update-pill');
  const u = S.update;
  pill.classList.toggle('hidden', !['downloading', 'ready'].includes(u.state));
  pill.classList.toggle('ready', u.state === 'ready');
  pill.textContent = u.state === 'ready' ? `Actualización ${u.version} lista · Reiniciar` : `Descargando actualización ${u.percent || 0}%`;
  const t = $('#upd-text');
  if (t) t.textContent = updateText();
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
        <button class="btn" data-servers="${g.placeId}">${ICON.globe}Servidores</button>
        <button class="btn" data-pin="${g.placeId}">${ICON.pin}Fijar en inicio</button>
        <button class="btn" data-url="https://www.roblox.com/games/${g.placeId}">Roblox ${ICON.ext}</button>
      </div>
      <div class="gm-desc">${esc(g.description)}</div>
      <div id="gm-badges"></div>
    </div></div>`;
  m.classList.remove('hidden');
  const token = (openGame.t = (openGame.t || 0) + 1);
  api.badges.game(g.universeId, S.me ? S.me.id : null).then((list) => {
    const el = $('#gm-badges');
    if (!el || token !== openGame.t || !list || !list.length) return;
    const owned = list.filter((b) => b.owned).length;
    const sorted = [...list].sort((a, b) => (b.owned - a.owned) || ((b.rarity ?? 0) - (a.rarity ?? 0)));
    el.innerHTML = `<div class="gm-bh"><h3>${ICON.badge}Insignias</h3>
      <span>${S.me ? `<b>${owned}</b> de ${list.length}` : `${list.length} en total`}</span></div>
      ${S.me ? `<div class="bar big"><i style="width:${Math.max(2, (owned / list.length) * 100)}%"></i></div>` : ''}
      <div class="gm-badges">${sorted.slice(0, 60).map((b) => `<div class="gb ${S.me && !b.owned ? 'locked' : ''}" title="${esc(b.name)}${b.rarity != null ? ` · ${(b.rarity).toFixed(1)}% de jugadores` : ''}${b.awarded ? ` · obtenida ${ago(b.awarded)}` : ''}"><img src="${esc(b.icon)}" alt=""></div>`).join('')}</div>`;
  });
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
  if (S.me && S.page === 'home') pages.home();
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
  const t = e.target.closest('[data-page],[data-play],[data-open],[data-fav],[data-pin],[data-url],[data-ext],[data-login],[data-logout],[data-join],[data-close],[data-blox],[data-pref],[data-accent],[data-bloxmenu],[data-lib],[data-win],[data-servers],[data-srvgame],[data-srvfilter],[data-srvmore],[data-srvreload],[data-joinsrv],[data-modapply],[data-modreset],[data-modimport],[data-modplay],[data-updcheck],[data-updinstall],#update-pill');
  if (!t) { if (e.target.id === 'modal') closeModal(); return; }
  const d = t.dataset;
  if (d.win) return api.win(d.win);
  if (d.modplay) { e.stopPropagation(); try { (playPreview.a && playPreview.a.pause()); playPreview.a = new Audio(d.modplay); playPreview.a.play(); } catch {} return; }
  if (d.modapply) { const [cat, id] = d.modapply.split('|'); await api.mods.apply(cat, id); toast('Mod aplicado. Se verá al abrir Roblox.'); return pages.mods(); }
  if (d.modreset) { await api.mods.reset(d.modreset); toast('Restaurado al original'); return pages.mods(); }
  if (d.modimport) { await api.mods.import(d.modimport); return pages.mods(); }
  if (d.servers) { S.srv = { placeId: Number(d.servers) }; closeModal(); return go('servers'); }
  if (d.srvgame) { S.srv = { placeId: Number(d.srvgame) }; return pages.servers(); }
  if (d.srvfilter) { S.srv.filter = d.srvfilter; document.querySelectorAll('.rchip').forEach((c) => c.classList.toggle('active', c === t)); return applyServerFilter(); }
  if (d.srvmore !== undefined) return loadServers();
  if (d.srvreload !== undefined) { S.srv = { placeId: S.srv.placeId }; return pages.servers(); }
  if (d.joinsrv) return play(S.srv.placeId, d.joinsrv);
  if (d.updcheck !== undefined) { S.update = await api.update.check(); return renderUpdate(); }
  if (d.updinstall !== undefined || (t.id === 'update-pill' && S.update.state === 'ready')) return api.update.install();
  if (t.id === 'update-pill') return go('settings');
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
const playPreview = {};
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
$('#fr-search').addEventListener('input', renderFriends);

// ---------- arranque ----------
(async function init() {
  const st = await api.getState();
  Object.assign(S, { favorites: st.favorites || [], selected: st.selected, prefs: { ...S.prefs, ...(st.prefs || {}) } });
  document.body.dataset.accent = S.prefs.accent;
  S.sessions = await api.sessions().catch(() => []);
  S.version = await api.version().catch(() => '');
  S.update = await api.update.get().catch(() => S.update);
  api.update.on((u) => { S.update = u; renderUpdate(); });
  renderUpdate();
  renderFriends();
  refreshAccount();
  go('home');
  // amigos y sesiones se actualizan solos
  setInterval(async () => { if (S.me) { S.friends = await api.friends(S.me.id).catch(() => S.friends); renderFriends(); } }, 45000);
  window.addEventListener('focus', async () => { S.sessions = await api.sessions().catch(() => S.sessions); if (S.page === 'home' || S.page === 'stats') go(S.page); });
})();
