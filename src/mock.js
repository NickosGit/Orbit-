// Datos de prueba: solo se usan si abres index.html en un navegador normal (sin Electron).
if (!window.orbit) {
  const art = (seed, w, h, label) => {
    const hues = [262, 200, 150, 20, 330, 45, 180, 290];
    const a = hues[seed % hues.length], b = (a + 50) % 360;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${a},70%,45%)"/><stop offset="1" stop-color="hsl(${b},80%,18%)"/></linearGradient></defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
      <circle cx="${w * 0.75}" cy="${h * 0.3}" r="${h * 0.35}" fill="hsla(${b},90%,70%,.25)"/>
      <rect x="${w * 0.1}" y="${h * 0.55}" width="${w * 0.5}" height="${h * 0.3}" rx="12" fill="hsla(${a},90%,80%,.18)"/>
      <text x="50%" y="52%" font-family="Segoe UI,Arial" font-weight="900" font-size="${Math.round(h / 6)}" fill="rgba(255,255,255,.9)" text-anchor="middle">${label}</text></svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  };
  const names = ['Sky Islands', 'Neon Racers', 'Tycoon Tower', 'Haunted Hotel', 'Pet Valley', 'Blade Arena', 'Obby Rush', 'City Life RP', 'Mining Sim', 'Zombie Siege', 'Kart Kingdom', 'Ocean Quest'];
  const games = names.map((n, i) => ({
    universeId: 1000 + i, placeId: 5000 + i, name: n, creator: ['Nova Studio', 'PixelForge', 'Lumen Games'][i % 3],
    description: 'Explora, construye y compite con tus amigos en este mundo lleno de secretos.\nActualización nueva cada semana.',
    playing: [184233, 52310, 9120, 33401, 251002, 12044, 7710, 98012, 4410, 61203, 2210, 18880][i], visits: 1.2e9 / (i + 1), maxPlayers: 24, genre: ['Aventura', 'Carreras', 'Simulador', 'Terror'][i % 4],
    rating: 78 + (i * 3) % 20, icon: art(i, 512, 512, n.split(' ')[0].toUpperCase()), banner: art(i, 768, 432, n.toUpperCase()),
  }));
  const avatarSvg = (() => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="720" viewBox="0 0 720 720">
      <g stroke="rgba(0,0,0,.25)" stroke-width="3">
      <rect x="318" y="120" width="84" height="20" rx="6" fill="#2b2d3a"/>
      <rect x="290" y="135" width="140" height="130" rx="22" fill="#f2c9a0"/>
      <rect x="282" y="122" width="156" height="40" rx="14" fill="#2b2d3a"/>
      <rect x="250" y="270" width="220" height="200" rx="14" fill="#7c5cff"/>
      <rect x="250" y="400" width="220" height="16" fill="#5b3fd6"/>
      <rect x="185" y="275" width="62" height="190" rx="16" fill="#7c5cff"/>
      <rect x="473" y="275" width="62" height="190" rx="16" fill="#7c5cff"/>
      <rect x="185" y="430" width="62" height="40" rx="14" fill="#f2c9a0"/>
      <rect x="473" y="430" width="62" height="40" rx="14" fill="#f2c9a0"/>
      <rect x="255" y="472" width="102" height="190" rx="12" fill="#1f2433"/>
      <rect x="363" y="472" width="102" height="190" rx="12" fill="#1f2433"/>
      <rect x="250" y="640" width="110" height="30" rx="10" fill="#fff"/>
      <rect x="360" y="640" width="110" height="30" rx="10" fill="#fff"/>
      </g>
      <circle cx="335" cy="200" r="9" fill="#222"/><circle cx="385" cy="200" r="9" fill="#222"/>
      <path d="M335 232 q25 18 50 0" stroke="#222" stroke-width="6" fill="none" stroke-linecap="round"/>
      <path d="M318 320 l42 40 l42 -40" stroke="#fff" stroke-width="12" fill="none" opacity=".85"/></svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  })();
  const byPlace = Object.fromEntries(games.map((g) => [g.placeId, g]));
  const now = Date.now();
  const sessions = [
    [5000, 2, 48], [5004, 20, 95], [5000, 26, 30], [5007, 50, 62], [5002, 75, 20], [5004, 100, 120], [5010, 150, 25], [5000, 170, 80],
  ].map(([p, hAgo, min]) => ({ placeId: p, jobId: 'x' + hAgo, start: new Date(now - hAgo * 3600e3).toISOString(), end: new Date(now - hAgo * 3600e3 + min * 60e3).toISOString() }));
  const people = ['Dani', 'Sofi_XD', 'elPepe', 'Mau', 'Valeria', 'Iker', 'Regina', 'Emi', 'Santi', 'Ximena', 'Leo', 'Ana'];
  const st = ['ingame', 'ingame', 'online', 'ingame', 'online', 'studio', 'offline', 'offline', 'offline', 'offline', 'offline', 'offline'];
  const friends = people.map((p, i) => ({
    id: i, name: p.toLowerCase(), displayName: p, headshot: art(i + 3, 150, 150, p[0]), status: st[i],
    game: st[i] === 'ingame' ? names[(i * 5) % names.length] : '', placeId: st[i] === 'ingame' ? 5000 + ((i * 5) % names.length) : null, jobId: null,
  }));
  let state = { favorites: [5004, 5007, 5001], selected: 5000, prefs: { accent: 'violet', minimizeOnPlay: true } };
  const blox = { ShowServerDetails: true, UseDiscordRichPresence: false, ConfirmLaunches: false, EnableActivityTracking: true };
  const wait = (v, ms = 120) => new Promise((r) => setTimeout(() => r(v), ms));
  window.orbit = {
    getState: () => wait(state, 0), setState: (p) => wait(Object.assign(state, p), 0),
    gamesByPlace: (ids) => wait(ids.map((i) => byPlace[i]).filter(Boolean)),
    discover: () => wait([{ title: 'Tendencias', games: games.slice(4).concat(games.slice(0, 4)) }, { title: 'Más jugados', games: [...games].sort((a, b) => b.playing - a.playing) }, { title: 'Recomendados para ti', games: games.slice(2, 10) }]),
    search: (q) => wait(games.filter((g) => g.name.toLowerCase().includes(q.toLowerCase()))),
    sessions: () => wait(sessions, 0),
    me: () => wait(location.hash === '#out' ? null : { id: 1, name: 'nico_mtz', displayName: 'Nico', robux: 1250, friends: 84, followers: 213, avatar: avatarSvg, headshot: art(1, 150, 150, 'N') }),
    accountFavorites: () => wait(games.slice(5, 11)),
    friends: () => wait(friends),
    login: () => wait(true), logout: () => wait(true),
    blox: { get: () => wait({ installed: true, settings: blox }), set: (k, v) => wait((blox[k] = v)), menu: () => wait(true) },
    servers: () => wait({ next: 'p2', servers: Array.from({ length: 14 }, (_, i) => ({ id: 'job-' + i + '-' + Math.random().toString(36).slice(2, 6), playing: [24, 22, 18, 9, 30, 4, 15, 27, 12, 6, 20, 2, 11, 25][i], max: 30, ping: [62, 48, 140, 95, 210, 55, 71, 180, 39, 120, 88, 260, 66, 101][i], fps: 60 })) }, 300),
    serverRegion: (pid, id) => { const opts = [{ city: 'Dallas', region: 'Texas', country: 'US' }, { city: 'Miami', region: 'Florida', country: 'US' }, { city: 'Los Angeles', region: 'California', country: 'US' }, { city: 'Ciudad de México', region: 'CDMX', country: 'MX' }, { city: 'São Paulo', region: 'São Paulo', country: 'BR' }, { city: 'Frankfurt', region: 'Hesse', country: 'DE' }]; return wait(opts[(id.charCodeAt(4) + id.length) % opts.length], 200 + Math.random() * 500); },
    badges: {
      recent: () => wait(['Primer paso', 'Explorador', 'Sobreviviente', 'Coleccionista', 'Leyenda', 'Velocista'].map((n, i) => ({ id: i, name: n, description: 'Insignia de prueba', icon: art(i + 2, 150, 150, '★'), awarded: new Date(Date.now() - (i + 1) * 9e6).toISOString(), game: { name: names[i * 2 % 12], placeId: 5000 + (i * 2 % 12) } }))),
      game: () => wait(Array.from({ length: 24 }, (_, i) => ({ id: i, name: 'Insignia ' + (i + 1), icon: art(i, 150, 150, '★'), owned: i % 3 !== 2 && i < 16, rarity: 40 - i * 1.5, awarded: null })), 300),
    },
    mods: (() => {
      const cats = { sound: { active: 'bonk', items: [['bonk', 'Bonk 8-bit'], ['pop', 'Pop'], ['glitch', 'Glitch'], ['campana', 'Campana'], ['laser', 'Láser'], ['boing', 'Boing']].map(([id, name]) => ({ id, name, file: `mods/sounds/${id}.ogg` })) },
        cursor: { active: null, items: [['punto', 'Punto'], ['punto-neon', 'Punto neón'], ['anillo', 'Anillo'], ['mira', 'Mira'], ['cruz-cian', 'Cruz cian'], ['flecha', 'Flecha']].map(([id, name]) => ({ id, name, file: `mods/cursors/${id}.png` })) },
        shiftlock: { active: 'mira-neon', items: [['punto', 'Punto'], ['cruz', 'Cruz'], ['mira-neon', 'Mira neón'], ['anillo-cian', 'Anillo cian']].map(([id, name]) => ({ id, name, file: `mods/shiftlock/${id}.png` })) } };
      const l = () => wait({ installed: true, cats });
      return { list: l, apply: (c, id) => { cats[c].active = id; return l(); }, reset: (c) => { cats[c].active = null; return l(); }, import: l };
    })(),
    version: () => wait('0.2.0', 0),
    update: { get: () => wait({ state: 'latest' }, 0), check: () => wait({ state: 'latest' }), install: () => wait(true), on: () => {} },
    launch: () => wait(true), open: () => wait(true), win: () => wait(true),
  };
}
