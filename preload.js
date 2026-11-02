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
  blox: { get: call('blox:get'), set: call('blox:set'), menu: call('blox:menu') },
  launch: call('launch'),
  open: call('open'),
  win: call('win'),
});
