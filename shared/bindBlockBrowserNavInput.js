const PRIMARY_MOUSE_BUTTONS = new Set(['left', 'middle', 'right']);

/** Block hardware/browser back-forward on webContents (main window or guest webview). */
export function bindBlockBrowserNavInputWebContents(webContents) {
    if (!webContents || webContents.isDestroyed?.() || webContents._nxNavBlockBound) return;
    webContents._nxNavBlockBound = true;

    webContents.on('before-input-event', (event, input) => {
        if (input.type === 'keyDown' && isBrowserNavKey(input)) event.preventDefault();
    });

    webContents.on('before-mouse-event', (event, mouse) => {
        if ((mouse.type === 'mouseDown' || mouse.type === 'mouseUp') && !PRIMARY_MOUSE_BUTTONS.has(mouse.button)) {
            event.preventDefault();
        }
    });
}

/** Block nav hardware input on BrowserWindow webContents + Windows/Linux app-command. */
export function bindBlockBrowserNavInput(browserWindow) {
    if (!browserWindow || browserWindow.isDestroyed?.()) return;
    bindBlockBrowserNavInputWebContents(browserWindow.webContents);
    if (browserWindow._nxAppCommandNavBlockBound) return;
    browserWindow._nxAppCommandNavBlockBound = true;
    browserWindow.on('app-command', (event, cmd) => {
        if (cmd === 'browser-backward' || cmd === 'browser-forward') event.preventDefault();
    });
}

/** Undo unsolicited in-page history pops while an exam route is active (e.g. webview back propagation). */
export function bindBlockExamHistoryPop(webContents, isExamRouteActive) {
    if (!webContents || webContents.isDestroyed?.() || webContents._nxExamHistoryPopBound) {
        return { allowHistoryPopOnce: () => {} };
    }
    webContents._nxExamHistoryPopBound = true;
    let allowOnce = false;
    webContents.on('did-navigate-in-page', (_event, _url, isMainFrame) => {
        if (!isMainFrame || !isExamRouteActive()) return;
        if (allowOnce) {
            allowOnce = false;
            return;
        }
        try {
            const nh = webContents.navigationHistory;
            if (nh?.canGoForward?.()) nh.goForward();
        } catch (_) { /* ignore */ }
    });
    return { allowHistoryPopOnce() { allowOnce = true; } };
}

function isBrowserNavKey(input) {
    const { key, alt, meta } = input;
    if (key === 'BrowserBack' || key === 'BrowserForward') return true;
    if (alt && (key === 'ArrowLeft' || key === 'ArrowRight')) return true;
    if (process.platform === 'darwin' && meta && (key === '[' || key === ']')) return true;
    return false;
}
