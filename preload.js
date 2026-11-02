const { contextBridge, ipcRenderer } = require('electron');
const call = (ch) => (...a) => ipcRenderer.invoke(ch, ...a);

contextBridge.exposeInMainWorld('orbit', {
  getState: call('state:get'),
  setState: call('state:set'),
  gamesByPlace: call('games:byPlace'),
  discover: call('games:discover'),
  search: call('games:search'),
  sessions: call('sessions'),
  me: call('account:me'),
  accountFavorites: call('account:favorites'),
  friends: call('account:friends'),
  login: call('account:login'),
  logout: call('account:logout'),
  servers: call('servers'),
  serverRegion: call('servers:region'),
  badges: { recent: call('badges:recent'), game: call('badges:game') },
  mods: { list: call('mods:list'), apply: call('mods:apply'), import: call('mods:import'), reset: call('mods:reset') },
  blox: { get: call('blox:get'), set: call('blox:set'), menu: call('blox:menu') },
  version: call('app:version'),
  update: {
    get: call('update:get'),
    check: call('update:check'),
    install: call('update:install'),
    on: (cb) => ipcRenderer.on('update', (_e, s) => cb(s)),
  },
  launch: call('launch'),
  open: call('open'),
  win: call('win'),
});
