/**
 * Centralized error suppression and handling for Electron main process.
 * Suppresses known benign errors (webview, subframe, EPIPE, TLS) and handles crashes gracefully.
 */
import { app, BrowserWindow } from 'electron';

const SUPPRESS_CODES = [-3, -100, -101, -105];

function shouldSuppressStderrStdout(chunkStr) {
  if (chunkStr.includes('GUEST_VIEW_MANAGER_CALL') && (chunkStr.includes('ERR_ABORTED') || chunkStr.includes('(-3)'))) return true;
  if (chunkStr.includes('WebContents#did-fail-load') || chunkStr.includes('WebContents#did-fail-provisional-load')) {
    return chunkStr.includes('isMainFrame: false') || SUPPRESS_CODES.some(code => chunkStr.includes(`errorCode: ${code}`));
  }
  return false;
}

function handleRendererCrash(log, windowHandler, webContents, details, prefix) {
  log.error(`${prefix}: Renderer process crashed`);
  log.error(`${prefix}: Reason:`, details.reason);
  log.error(`${prefix}: Exit code:`, details.exitCode);
  const allWindows = BrowserWindow.getAllWindows();
  const crashedWindow = allWindows.find(win => win.webContents.id === webContents.id);
  if (crashedWindow) {
    log.error(`${prefix}: Window title: ${crashedWindow.getTitle()}`);
    if (crashedWindow === windowHandler.mainWin() && windowHandler.inExamMode()) {
      log.warn(`${prefix}: Exam mainwindow crashed, attempting to close gracefully`);
      try {
        if (!crashedWindow.isDestroyed()) crashedWindow.destroy();
        windowHandler.clearExamRoute();
      } catch (err) {
        log.error(`${prefix}: Error closing exam window:`, err);
      }
    }
  }
}

/**
 * Initialize all error suppression and crash handlers.
 * @param {object} log - electron-log instance
 * @param {object} windowHandler - WindowHandler instance for exam window cleanup
 */
export function initErrorHandling(log, windowHandler) {
  process.stdout.on('error', (err) => { if (err.code === 'EPIPE') log.transports.console.level = false; });

  const originalStderrWrite = process.stderr.write;
  const originalStdoutWrite = process.stdout.write;
  process.stderr.write = function (chunk, encoding, fd) {
    if (shouldSuppressStderrStdout(chunk?.toString() || '')) return true;
    return originalStderrWrite.apply(this, arguments);
  };
  process.stdout.write = function (chunk, encoding, fd) {
    if (shouldSuppressStderrStdout(chunk?.toString() || '')) return true;
    return originalStdoutWrite.apply(this, arguments);
  };

  process.on('uncaughtException', (err) => {
    if (err.code === 'EPIPE') {
      log.transports.console.level = false;
      log.warn('main @ uncaughtException: EPIPE Error: The stdout stream of the ElectronLogger will be disabled.');
    } else if (err.message?.includes('Render frame was disposed')) return;
    else log.error('main @ uncaughtException:', err.message);
  });

  process.on('unhandledRejection', (reason) => {
    log.error('main @ unhandledRejection: Unhandled promise rejection:', reason);
    if (reason instanceof Error) log.error('main @ unhandledRejection: Stack:', reason.stack);
  });

  app.on('render-process-gone', (event, webContents, details) => {
    handleRendererCrash(log, windowHandler, webContents, details, 'main @ render-process-gone');
    event.preventDefault();
  });

  app.on('child-process-gone', (event, details) => {
    log.error('main @ child-process-gone: Child process crashed');
    log.error('main @ child-process-gone: Type:', details.type, 'Reason:', details.reason, 'Exit code:', details.exitCode);
    event.preventDefault();
  });

  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  const originalEmitWarning = process.emitWarning;
  process.emitWarning = (warning, options) => {
    if (warning?.includes?.('NODE_TLS_REJECT_UNAUTHORIZED')) return;
    return originalEmitWarning.call(process, warning, options);
  };

  app.on('certificate-error', (event, _webContents, _url, _error, _certificate, callback) => {
    event.preventDefault();
    callback(true);
  });

  app.on('web-contents-created', (_event, webContents) => {
    if (webContents._errorSuppressionSetup) return;
    webContents._errorSuppressionSetup = true;

    const setupErrorSuppression = () => {
      webContents.removeAllListeners('did-fail-provisional-load');
      webContents.removeAllListeners('did-fail-load');
      webContents.on('did-fail-provisional-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
        if (!isMainFrame || SUPPRESS_CODES.includes(errorCode)) { event.preventDefault(); return; }
        log.warn(`main @ did-fail-provisional-load: Error ${errorCode} - ${errorDescription} for URL: ${validatedURL}`);
      });
      webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
        if (!isMainFrame || SUPPRESS_CODES.includes(errorCode)) { event.preventDefault(); return; }
        log.warn(`main @ did-fail-load: Error ${errorCode} - ${errorDescription} for URL: ${validatedURL}`);
      });
    };

    setupErrorSuppression();
    webContents.on('did-start-navigation', setupErrorSuppression);
    webContents.on('did-frame-navigate', setupErrorSuppression);

    webContents.on('render-process-gone', (event, details) => {
      handleRendererCrash(log, windowHandler, webContents, details, 'main @ webContents render-process-gone');
      const crashedWindow = BrowserWindow.getAllWindows().find(win => win.webContents.id === webContents.id);
      if (crashedWindow) log.error('main @ webContents render-process-gone: Window URL:', crashedWindow.webContents.getURL());
      event.preventDefault();
    });
  });
}
