// Mochi — a little cat that floats above everything on your Mac and types when you type.
const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, systemPreferences, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let uIOhook = null, UiohookKey = {}, hookError = '';
try { ({ uIOhook, UiohookKey } = require('uiohook-napi')); } catch (e) { hookError = e.message; console.warn('Global key listening unavailable:', e.message); }

const SIZES = { Small: [200, 220], Medium: [280, 308], Large: [380, 418] };
const LOOKS = [['2D', '2'], ['2.5D', '25'], ['3D', '3'], ['Drawn', 'ink']];
const COATS = ['Tuxedo', 'Ginger', 'Cream', 'Snow', 'Silver', 'Blue', 'Cocoa', 'Ink', 'Peach'];

const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');
let S = { size: 'Medium', look: 'ink', coat: 0, opacity: 100, clickThrough: false, x: null, y: null, seenSettings: false };
function load() { try { Object.assign(S, JSON.parse(fs.readFileSync(settingsFile(), 'utf8'))); } catch (e) {} }
function save() { try { fs.writeFileSync(settingsFile(), JSON.stringify(S)); } catch (e) {} }

let win, settingsWin, tray, cursorTimer, keysSeen = 0, hookRunning = false;

/* ---------- keyboard permission ---------- */
const hasAccess = () => process.platform !== 'darwin' || systemPreferences.isTrustedAccessibilityClient(false);
function keyStatus() {
  return { access: hasAccess(), running: hookRunning, available: !!uIOhook, error: hookError, keysSeen };
}
function pushStatus() { if (settingsWin && !settingsWin.isDestroyed()) settingsWin.webContents.send('status', keyStatus()); }

/* ---------- the floating cat ---------- */
function createWindow() {
  const [w, h] = SIZES[S.size] || SIZES.Medium;
  const wa = screen.getPrimaryDisplay().workArea;
  win = new BrowserWindow({
    width: w, height: h,
    x: S.x ?? wa.x + wa.width - w - 24, y: S.y ?? wa.y + wa.height - h - 12,
    transparent: true, frame: false, hasShadow: false, resizable: false,
    alwaysOnTop: true, skipTaskbar: true, fullscreenable: false, focusable: false,
    backgroundColor: '#00000000',
    webPreferences: { preload: path.join(__dirname, 'preload.js') }
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  applyClickThrough();
  win.loadFile('widget.html');
  win.webContents.on('did-finish-load', sendAllToCat);
  win.on('moved', () => { const [x, y] = win.getPosition(); S.x = x; S.y = y; save(); });
  cursorTimer = setInterval(() => {
    if (!win || win.isDestroyed()) return;
    const p = screen.getCursorScreenPoint(), b = win.getBounds();
    win.webContents.send('mouse', p.x - b.x, p.y - b.y);
  }, 50);
}
function sendAllToCat() {
  if (!win || win.isDestroyed()) return;
  win.webContents.send('set', 'look', S.look);
  win.webContents.send('set', 'coat', S.coat);
  win.webContents.send('set', 'op', S.opacity);
}
function applyClickThrough() { win.setIgnoreMouseEvents(!!S.clickThrough, { forward: true }); }
function setSize(name) {
  if (!SIZES[name]) return;
  S.size = name; save();
  const [w, h] = SIZES[name]; const b = win.getBounds();
  win.setBounds({ x: Math.round(b.x + b.width - w), y: Math.round(b.y + b.height - h), width: w, height: h });
}
function moveToCorner() {
  const wa = screen.getPrimaryDisplay().workArea, b = win.getBounds();
  win.setPosition(Math.round(wa.x + wa.width - b.width - 24), Math.round(wa.y + wa.height - b.height - 12));
}

/* ---------- settings window ---------- */
function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) { settingsWin.show(); settingsWin.focus(); return; }
  settingsWin = new BrowserWindow({
    width: 440, height: 720, minWidth: 380, minHeight: 520, title: 'Mochi Settings',
    titleBarStyle: 'hiddenInset', show: false, backgroundColor: '#f7e7b4',
    webPreferences: { preload: path.join(__dirname, 'settings-preload.js') }
  });
  settingsWin.loadFile('settings.html');
  settingsWin.once('ready-to-show', () => { settingsWin.show(); if (process.platform === 'darwin') app.dock && app.dock.show(); });
  settingsWin.on('closed', () => { settingsWin = null; if (process.platform === 'darwin' && app.dock) app.dock.hide(); });
  S.seenSettings = true; save();
}

function applySetting(k, v) {
  switch (k) {
    case 'look': if (LOOKS.some(l => l[1] === v)) { S.look = v; win.webContents.send('set', 'look', v); } break;
    case 'coat': v = +v; if (v >= 0 && v < COATS.length) { S.coat = v; win.webContents.send('set', 'coat', v); } break;
    case 'opacity': v = Math.max(25, Math.min(100, Math.round(+v))); S.opacity = v; win.webContents.send('set', 'op', v); break;
    case 'size': setSize(v); break;
    case 'clickThrough': S.clickThrough = !!v; applyClickThrough(); break;
    case 'openAtLogin': app.setLoginItemSettings({ openAtLogin: !!v }); break;
  }
  save(); buildMenu();
}

/* ---------- menu bar icon ---------- */
function buildMenu() {
  if (!tray) return;
  const menu = Menu.buildFromTemplate([
    { label: hasAccess() ? 'Mochi is watching your typing' : 'Mochi can’t see your typing yet', enabled: false },
    { label: 'Settings…', accelerator: 'Command+,', click: openSettings },
    { type: 'separator' },
    { label: 'Look', submenu: LOOKS.map(([label, v]) => ({ label, type: 'radio', checked: S.look === v, click: () => applySetting('look', v) })) },
    { label: 'Coat', submenu: COATS.map((label, i) => ({ label, type: 'radio', checked: S.coat === i, click: () => applySetting('coat', i) })) },
    { label: 'Size', submenu: Object.keys(SIZES).map(label => ({ label, type: 'radio', checked: S.size === label, click: () => applySetting('size', label) })) },
    { type: 'separator' },
    { label: 'Let clicks pass through', type: 'checkbox', checked: !!S.clickThrough, click: (i) => applySetting('clickThrough', i.checked) },
    { label: 'Move to bottom-right corner', click: moveToCorner },
    { type: 'separator' },
    { label: 'Quit Mochi', click: () => app.quit() }
  ]);
  tray.setContextMenu(menu);
}

/* ---------- global keys ---------- */
const CODE = {};
for (const [name, code] of Object.entries(UiohookKey)) {
  let c = name;
  if (/^[A-Z]$/.test(name)) c = 'Key' + name;
  else if (/^[0-9]$/.test(name)) c = 'Digit' + name;
  else if (name === 'Ctrl') c = 'ControlLeft'; else if (name === 'CtrlRight') c = 'ControlRight';
  else if (name === 'Shift') c = 'ShiftLeft'; else if (name === 'Alt') c = 'AltLeft'; else if (name === 'Meta') c = 'MetaLeft';
  CODE[code] = c;
}
const KEYNAME = { Space: ' ', Enter: 'Enter', Backspace: 'Backspace', Tab: 'Tab', Escape: 'Escape',
  ShiftLeft: 'Shift', ShiftRight: 'Shift', ControlLeft: 'Control', ControlRight: 'Control', AltLeft: 'Alt', AltRight: 'Alt',
  MetaLeft: 'Meta', MetaRight: 'Meta', CapsLock: 'CapsLock', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown' };
function keyName(code, shift) {
  if (code.startsWith('Key')) return shift ? code.slice(3) : code.slice(3).toLowerCase();
  if (code.startsWith('Digit')) return code.slice(5);
  if (code === 'Slash') return shift ? '?' : '/';
  return KEYNAME[code] || code;
}
function startKeys() {
  if (!uIOhook || hookRunning || !hasAccess()) return;
  const held = new Set();
  uIOhook.on('keydown', (e) => {
    if (held.has(e.keycode)) return; // ignore auto-repeat
    held.add(e.keycode);
    const code = CODE[e.keycode] || 'KeyF';
    keysSeen++;
    // only which key was pressed reaches the cat; nothing is stored or logged
    if (win && !win.isDestroyed()) win.webContents.send('key', code, keyName(code, !!e.shiftKey));
    if (keysSeen % 5 === 1) pushStatus();
  });
  uIOhook.on('keyup', (e) => held.delete(e.keycode));
  try { uIOhook.start(); hookRunning = true; hookError = ''; }
  catch (e) { hookError = e.message; }
  pushStatus(); buildMenu();
}

/* ---------- IPC ---------- */
const finite = (n) => Number.isFinite(+n) ? Math.round(+n) : 0;
ipcMain.on('drag', (_e, dx, dy) => {
  if (!win || win.isDestroyed()) return;
  const [x, y] = win.getPosition();
  win.setPosition(x + finite(dx), y + finite(dy));
});
ipcMain.handle('get-settings', () => ({ ...S, openAtLogin: app.getLoginItemSettings().openAtLogin, coats: COATS, looks: LOOKS, sizes: Object.keys(SIZES), status: keyStatus() }));
ipcMain.on('set', (_e, k, v) => applySetting(k, v));
ipcMain.on('open-accessibility', () => {
  if (process.platform === 'darwin') {
    systemPreferences.isTrustedAccessibilityClient(true); // adds Mochi to the list and shows Apple's prompt
    shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');
  }
});
ipcMain.on('open-input-monitoring', () => shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent'));
ipcMain.on('restart', () => { app.relaunch(); app.exit(0); });
ipcMain.on('move-corner', moveToCorner);
ipcMain.on('quit', () => app.quit());

/* ---------- start ---------- */
app.whenReady().then(() => {
  if (process.platform === 'darwin' && app.dock) app.dock.hide();
  load();
  createWindow();
  const icon = nativeImage.createFromPath(path.join(__dirname, 'trayTemplate.png'));
  icon.setTemplateImage(true);
  tray = new Tray(icon);
  tray.setToolTip('Mochi');
  buildMenu();
  if (hasAccess()) startKeys();
  else {
    if (process.platform === 'darwin') systemPreferences.isTrustedAccessibilityClient(true);
    openSettings();
  }
  if (!S.seenSettings) openSettings();
  // notice when permission is granted, without needing a restart where macOS allows it
  setInterval(() => { if (!hookRunning && hasAccess()) startKeys(); pushStatus(); }, 2000);
});

app.on('activate', openSettings);
app.on('before-quit', () => { clearInterval(cursorTimer); try { uIOhook && hookRunning && uIOhook.stop(); } catch (e) {} });
app.on('window-all-closed', (e) => { /* keep running in the menu bar */ });
