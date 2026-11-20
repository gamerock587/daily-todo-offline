const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, Notification } = require('electron');
const path = require('path');

let mainWindow;
let tray;
let widgetVisible = true;
let widgetDragTimer = null;

function getVirtualDisplayBounds() {
  const displays = screen.getAllDisplays();
  const minX = Math.min(...displays.map(display => display.bounds.x));
  const minY = Math.min(...displays.map(display => display.bounds.y));
  const maxX = Math.max(...displays.map(display => display.bounds.x + display.bounds.width));
  const maxY = Math.max(...displays.map(display => display.bounds.y + display.bounds.height));

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

function getDisplayLayout() {
  return {
    virtualBounds: getVirtualDisplayBounds(),
    displays: screen.getAllDisplays().map(display => ({
      id: display.id,
      bounds: display.bounds,
      workArea: display.workArea,
      scaleFactor: display.scaleFactor
    }))
  };
}

function getAppIconPath() {
  const appIcon = path.join(__dirname, 'app-icon.png');
  const trayIcon = path.join(__dirname, 'tray.png');
  return require('fs').existsSync(appIcon) ? appIcon : trayIcon;
}

function createTray() {
  const iconPath = getAppIconPath();
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip('Daily ToDo');

  tray.setContextMenu(buildTrayMenu());

  // Single-click on tray icon to toggle
  tray.on('click', () => toggleWidget());

  // Keep menu in sync
  ipcMain.on('update-tray', () => {
    tray.setContextMenu(buildTrayMenu());
  });
}

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    {
      label: widgetVisible ? 'Hide Widget' : 'Show Widget',
      click: () => toggleWidget()
    },
    {
      label: 'Show in Center',
      click: () => showWidgetInCenter()
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => app.quit()
    }
  ]);
}

function showWidgetInCenter() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const bounds = getVirtualDisplayBounds();
  const cursor = screen.getCursorScreenPoint();
  const targetDisplay = screen.getDisplayNearestPoint(cursor) || screen.getPrimaryDisplay();
  const targetBounds = targetDisplay.workArea || targetDisplay.bounds;
  const payload = {
    left: Math.round(targetBounds.x - bounds.x + (targetBounds.width / 2) - 29),
    top: Math.round(targetBounds.y - bounds.y + (targetBounds.height / 2) - 29),
    layout: getDisplayLayout()
  };

  widgetVisible = true;
  mainWindow.setBounds(bounds);
  mainWindow.showInactive();
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setIgnoreMouseEvents(false);
  mainWindow.webContents.send('show-widget-center', payload);
  setTimeout(() => mainWindow?.webContents.send('show-widget-center', payload), 80);
  setTimeout(() => mainWindow?.webContents.send('show-widget-center', payload), 250);
  if (tray) tray.setContextMenu(buildTrayMenu());
}

function applyVirtualBounds() {
  if (!mainWindow || mainWindow.isDestroyed()) return getVirtualDisplayBounds();
  const bounds = getVirtualDisplayBounds();
  mainWindow.setBounds(bounds);
  return bounds;
}

function toggleWidget() {
  if (widgetVisible) {
    // Send message to renderer to hide the button + panel, then truly ignore all mouse events
    mainWindow.webContents.send('hide-widget');
    widgetVisible = false;
  } else {
    mainWindow.webContents.send('show-widget');
    widgetVisible = true;
  }
  // Rebuild tray menu label
  if (tray) tray.setContextMenu(buildTrayMenu());
}

function createWindow() {
  const bounds = getVirtualDisplayBounds();

  mainWindow = new BrowserWindow({
    ...bounds,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    focusable: true,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    }
  });

  // CRITICAL: ignore all mouse events by default, forwarding them to windows underneath.
  // The renderer will call 'set-ignore-mouse' to toggle this on/off when hovering
  // over interactive elements.
  mainWindow.setIgnoreMouseEvents(true, { forward: true });

  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.webContents.setWindowOpenHandler(() => ({action:'deny'}));
  mainWindow.webContents.on('will-navigate', event => event.preventDefault());
  mainWindow.webContents.session.webRequest.onBeforeRequest((details, callback) => callback({cancel: !['file:', 'devtools:', 'blob:', 'data:'].some(scheme => details.url.startsWith(scheme))}));
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  screen.on('display-added', applyVirtualBounds);
  screen.on('display-removed', applyVirtualBounds);
  screen.on('display-metrics-changed', applyVirtualBounds);

  // Re-assert always on top after focus changes (some fullscreen apps fight for it)
  mainWindow.on('blur', () => {
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
  });

  // IPC: renderer tells main when to capture or ignore mouse events
  ipcMain.on('set-ignore-mouse', (_, ignore) => {
    mainWindow.setIgnoreMouseEvents(ignore, { forward: true });
  });

  ipcMain.handle('get-display-layout', () => getDisplayLayout());

  ipcMain.on('start-widget-drag', (_, offset) => {
    if (widgetDragTimer) clearInterval(widgetDragTimer);
    applyVirtualBounds();
    mainWindow.setIgnoreMouseEvents(false);
    const pointerOffset = {
      x: Number.isFinite(offset?.x) ? offset.x : 29,
      y: Number.isFinite(offset?.y) ? offset.y : 29
    };
    const sendDragPoint = () => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      const bounds = getVirtualDisplayBounds();
      const cursor = screen.getCursorScreenPoint();
      mainWindow.webContents.send('widget-drag-point', {
        left: cursor.x - bounds.x - pointerOffset.x,
        top: cursor.y - bounds.y - pointerOffset.y,
        layout: getDisplayLayout()
      });
    };

    sendDragPoint();
    widgetDragTimer = setInterval(sendDragPoint, 16);
  });

  ipcMain.on('stop-widget-drag', () => {
    if (!widgetDragTimer) return;
    clearInterval(widgetDragTimer);
    widgetDragTimer = null;
  });

  ipcMain.on('show-notification', (_, payload = {}) => {
    if (!Notification.isSupported()) return;
    new Notification({
      title: payload.title || 'Daily ToDo',
      body: payload.body || 'New activity',
      icon: getAppIconPath()
    }).show();
  });

  // IPC: close app
  ipcMain.on('close-app', () => app.quit());
}

app.setName('Daily ToDo Offline');
app.whenReady().then(() => {
  const {clipboard}=require('electron');
  ipcMain.handle('clipboard-read',()=>clipboard.readText());
  ipcMain.handle('clipboard-write',(_,text)=>{if(typeof text!=='string'||text.length>20000)throw new Error('Invalid snippet');clipboard.writeText(text);});
  createWindow();
  createTray();

  // Startup remains under the user's control; no automatic registration.

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Don't quit when all windows close — stay in tray
app.on('window-all-closed', (e) => {
  e.preventDefault();
});
