// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
// كواليس as a desktop program: one window that serves the built app from an
// app:// origin, so everything saved in it (IndexedDB) stays between launches.
const { app, BrowserWindow, net, protocol, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const DIST = path.join(__dirname, '..', 'dist');
const START = 'app://kawalees/index.html';

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);

if (!app.requestSingleInstanceLock()) app.quit();

let win = null;

const openOutside = (url) => {
  if (/^https?:\/\//.test(url)) void shell.openExternal(url);
};

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 380,
    minHeight: 640,
    title: 'كواليس',
    backgroundColor: '#0E0B12',
    autoHideMenuBar: true,
    show: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  win.once('ready-to-show', () => win.show());
  // Links to other sites open in the browser, never inside the app window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    openOutside(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (url.startsWith('app://')) return;
    e.preventDefault();
    openOutside(url);
  });
  win.on('closed', () => {
    win = null;
  });
  void win.loadURL(START);
}

app.setAboutPanelOptions({
  applicationName: 'Kawalees · كواليس',
  applicationVersion: app.getVersion(),
  copyright: '© 2026 Eng.Reem Alfadly. All rights reserved.',
  credits: 'By: Eng.Reem Alfadly',
  website: 'https://github.com/reemalfadly/kawalees',
});

app.whenReady().then(() => {
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url);
    const rel = decodeURIComponent(pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.normalize(path.join(DIST, rel));
    if (!file.startsWith(DIST)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('second-instance', () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
