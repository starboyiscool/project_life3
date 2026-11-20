// Electron main process: wraps the built web app (web-dist/) in a desktop window.
// The renderer is a plain, local-first web app (IndexedDB) with no Node access.
const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 520,
    height: 920,
    minWidth: 380,
    minHeight: 640,
    autoHideMenuBar: true,
    backgroundColor: '#f6f4ef',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  // web-dist/ is built with `--base=./` so relative asset paths resolve under file://.
  win.loadFile(path.join(__dirname, '..', 'web-dist', 'index.html'));
  return win;
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
