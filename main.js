// Mochi — a little cat that floats above everything on your Mac and types when you type.
const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

let uIOhook = null, UiohookKey = {};
try { ({ uIOhook, UiohookKey } = require('uiohook-napi')); } catch (e) { console.warn('Global key listening unavailable:', e.message); }

const SIZES = { Small: [200, 220], Medium: [280, 308], Large: [380, 418] };
const LOOKS = [['2D', '2'], ['2.5D', '25'], ['3D', '3'], ['Drawn', 'ink']];
const COATS = ['Tuxedo', 'Ginger', 'Cream', 'Snow', 'Silver', 'Blue', 'Cocoa', 'Ink', 'Peach'];

const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');
let S = { size: 'Medium', look: 'ink', coat: 0, clickThrough: false, x: null, y: null };
function load() { try { Object.assign(S, JSON.parse(fs.readFileSync(settingsFile(), 'utf8'))); } catch (e) {} }
function save() { try { fs.writeFileSync(settingsFile(), JSON.stringify(S)); } catch (e) {} }

let win, tray, cursorTimer;

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
  // float above normal windows, full-screen apps and every Space
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  applyClickThrough();
  win.loadFile('widget.html');
  win.webContents.on('did-finish-load', () => {
    win.webContents.send('set', 'look', S.look);
    win.webContents.send('set', 'coat', S.coat);
  });
  win.on('moved', () => { const [x, y] = win.getPosition(); S.x = x; S.y = y; save(); });

  // eyes follow the cursor anywhere on screen
  cursorTimer = setInterval(() => {
    if (!win || win.isDestroyed()) return;
    const p = screen.getCursorScreenPoint(), b = win.getBounds();
    win.webContents.send('mouse', p.x - b.x, p.y - b.y);
  }, 50);
}

function applyClickThrough() { win.setIgnoreMouseEvents(!!S.clickThrough, { forward: true }); }

function setSize(name) {
  S.size = name; save();
  const [w, h] = SIZES[name]; const b = win.getBounds();
  win.setBounds({ x: b.x + b.width - w, y: b.y + b.height - h, width: w, height: h });
  buildMenu();
}

function buildMenu() {
  const menu = Menu.buildFromTemplate([
    { label: 'Mochi', enabled: false },
    { type: 'separator' },
    { label: 'Look', submenu: LOOKS.map(([label, v]) => ({ label, type: 'radio', checked: S.look === v,
        click: () => { S.look = v; save(); win.webContents.send('set', 'look', v); } })) },
    { label: 'Coat', submenu: COATS.map((label, i) => ({ label, type: 'radio', checked: S.coat === i,
        click: () => { S.coat = i; save(); win.webContents.send('set', 'coat', i); } })) },
    { label: 'Size', submenu: Object.keys(SIZES).map(label => ({ label, type: 'radio', checked: S.size === label, click: () => setSize(label) })) },
    { type: 'separator' },
    { label: 'Let clicks pass through', type: 'checkbox', checked: !!S.clickThrough,
      click: (item) => { S.clickThrough = item.checked; save(); applyClickThrough(); } },
    { label: 'Open at login', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }) },
    { label: 'Move to bottom-right corner', click: () => {
        const wa = screen.getPrimaryDisplay().workArea, b = win.getBounds();
        win.setPosition(wa.x + wa.width - b.width - 24, wa.y + wa.height - b.height - 12); } },
    { type: 'separator' },
    { label: 'Quit Mochi', click: () => app.quit() }
  ]);
  tray.setContextMenu(menu);
}

// map uiohook key codes to browser KeyboardEvent.code names
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
  if (!uIOhook) return;
  const held = new Set();
  uIOhook.on('keydown', (e) => {
    if (held.has(e.keycode)) return; // ignore auto-repeat
    held.add(e.keycode);
    const code = CODE[e.keycode] || 'KeyF';
    // only the key's position is sent to the cat; nothing is stored or logged
    if (win && !win.isDestroyed()) win.webContents.send('key', code, keyName(code, e.shiftKey));
  });
  uIOhook.on('keyup', (e) => held.delete(e.keycode));
  uIOhook.start();
}

ipcMain.on('drag', (_e, dx, dy) => { const [x, y] = win.getPosition(); win.setPosition(x + dx, y + dy); });

app.whenReady().then(() => {
  if (process.platform === 'darwin' && app.dock) app.dock.hide();
  load();
  createWindow();
  const icon = nativeImage.createFromPath(path.join(__dirname, 'trayTemplate.png'));
  icon.setTemplateImage(true);
  tray = new Tray(icon);
  tray.setToolTip('Mochi');
  buildMenu();
  startKeys();
});

app.on('before-quit', () => { clearInterval(cursorTimer); try { uIOhook && uIOhook.stop(); } catch (e) {} });
app.on('window-all-closed', () => app.quit());
