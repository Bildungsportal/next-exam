/**
 * Frontend screenshot capture using getDisplayMedia (Electron desktop capture).
 * Resize to max width; upload via fetch to teacher API.
 */

import { isElectronWindow } from '../types/platform';
import { examApiFetch } from 'next-exam-shared/examApiFetch.js';

const log = { info: (...a) => console.log(...a), warn: (...a) => console.warn(...a), error: (...a) => console.error(...a) };

const SCREENSHOT_MAX_WIDTH = 1200;

/** Compute hash of binary data for screenshothash (SHA-256 in browser) */
async function hashArrayBuffer(buffer) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Desktop capture stream is acquired once (or on first successful ensureDisplayStreamAsync) and kept for the app lifetime; teacher disconnect must not stop tracks (kiosk cannot re-prompt).

/**
 * Capture one frame from a live video element (stream already attached and playing).
 * Returns { screenshotBase64 } or null on failure.
 */
function captureFrameFromVideo(video) {
  if (!video?.videoWidth || !video?.videoHeight) return null;
  const fullCanvas = document.createElement('canvas');
  fullCanvas.width = video.videoWidth;
  fullCanvas.height = video.videoHeight;
  const fullCtx = fullCanvas.getContext('2d');
  if (!fullCtx) return null;
  fullCtx.drawImage(video, 0, 0);

  const scale = Math.min(1, SCREENSHOT_MAX_WIDTH / fullCanvas.width);
  const sw = Math.round(fullCanvas.width * scale);
  const sh = Math.round(fullCanvas.height * scale);

  const screenshotCanvas = document.createElement('canvas');
  screenshotCanvas.width = sw;
  screenshotCanvas.height = sh;
  const screenshotCtx = screenshotCanvas.getContext('2d');
  if (!screenshotCtx) return null;
  screenshotCtx.drawImage(fullCanvas, 0, 0, fullCanvas.width, fullCanvas.height, 0, 0, sw, sh);

  const screenshotBase64 = screenshotCanvas.toDataURL('image/jpeg', 0.85).split(',')[1];

  return { screenshotBase64 };
}

/** Cage fallback: capture active window via main-process capturePage. */
async function captureAndUploadFromIpc(signalBridge, config) {
  const { serverip, serverApiPort, clientinfo } = config;
  if (!serverip || !serverApiPort || !clientinfo) return false;
  try {
    const result = await signalBridge.invoke('capture-screenshot-frame');
    if (!result?.screenshotBase64) {
      log.warn('screenshotCapture @ captureAndUploadFromIpc: empty frame');
      return false;
    }
    const { screenshotBase64 } = result;
    const binary = Uint8Array.from(atob(screenshotBase64), (c) => c.charCodeAt(0));
    const screenshothash = await hashArrayBuffer(binary.buffer);
    const payload = {
      clientinfo: { ...clientinfo },
      screenshot: screenshotBase64,
      screenshothash,
      screenshotfilename: (clientinfo.token || 'unknown') + '.jpg',
    };
    const url = `https://${serverip}:${serverApiPort}/server/control/updatescreenshot`;
    const headers = { 'Content-Type': 'application/json' };
    if (clientinfo.token) headers.Authorization = `Bearer ${clientinfo.token}`;
    const res = await examApiFetch(url, {
      method: 'POST',
      cache: 'no-store',
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      log.warn('screenshotCapture @ captureAndUploadFromIpc: upload response', res.status, res.statusText);
      return false;
    }
    return true;
  } catch (err) {
    log.error('screenshotCapture @ captureAndUploadFromIpc:', err?.message);
    return false;
  }
}

/**
 * One tick: capture frame from existing stream/video, upload. No getDisplayMedia call.
 * @returns {Promise<boolean>} true on success, false on any failure
 */
async function captureAndUpload(signalBridge, config, sharedRef) {
  const { serverip, serverApiPort, clientinfo } = config;
  if (!serverip || !serverApiPort || !clientinfo) return false;

  const video = sharedRef.video;
  if (!video?.videoWidth || video.videoWidth === 0) return false;

  try {
    const result = captureFrameFromVideo(video);
    if (!result) {
      log.warn('screenshotCapture @ captureAndUpload: captureFrameFromVideo returned null');
      return false;
    }
    const { screenshotBase64 } = result;

    const binary = Uint8Array.from(atob(screenshotBase64), (c) => c.charCodeAt(0));
    const screenshothash = await hashArrayBuffer(binary.buffer);

    const payload = {
      clientinfo: { ...clientinfo },
      screenshot: screenshotBase64,
      screenshothash,
      screenshotfilename: (clientinfo.token || 'unknown') + '.jpg',
    };

    const url = `https://${serverip}:${serverApiPort}/server/control/updatescreenshot`;
    const headers = { 'Content-Type': 'application/json' };
    if (clientinfo.token) {
        headers.Authorization = `Bearer ${clientinfo.token}`;
    }
    const res = await examApiFetch(url, {
      method: 'POST',
      cache: 'no-store',
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      log.warn('screenshotCapture @ captureAndUpload: upload response', res.status, res.statusText);
      return false;
    }
    return true;
  } catch (err) {
    log.error('screenshotCapture @ captureAndUpload: capture/upload error', err?.message);
    return false;
  }
}

/** Stop and clear the shared stream/video; clears initAttempted so Connect can re-acquire with user gesture. */
function stopSharedStream(sharedRef) {
  if (sharedRef.stream) {
    sharedRef.stream.getTracks().forEach((t) => t.stop());
    sharedRef.stream = null;
  }
  sharedRef.video = null;
  initAttempted = false;
}

/** Hard-reset capture stream (e.g. dev only); not used on teacher disconnect — that would force invisible OS re-consent in kiosk. */
export function resetDisplayStream() {
  stopSharedStream(sharedRef);
  initAttempted = false;
  log.info('screenshotCapture @ resetDisplayStream: stream reset, will re-acquire on next connect');
}

let intervalId = null;
let sharedRef = { stream: null, video: null };
let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 5;
let applyInFlight = false;
let initAttempted = false;
let fullDesktopLikely = true;
let useWindowCaptureFallback = false;
let linuxKioskRunningInCage = false;

/**
 * Acquire display stream once and set up a long-lived video element for frame capture.
 * @returns {Promise<{ stream: MediaStream, video: HTMLVideoElement }|null>}
 */
async function acquireDisplayStream() {
  if (!navigator.mediaDevices?.getDisplayMedia) return null;
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = () => video.play().then(() => {
        log.info('screenshotCapture @ acquireDisplayStream: video resolution', video.videoWidth + 'x' + video.videoHeight);
        try {
          // Prefer displaySurface (monitor vs window) over brittle resolution heuristics when available.
          const track = stream.getVideoTracks?.()?.[0];
          const surface = track?.getSettings?.()?.displaySurface;
          if (surface === 'monitor') {
            fullDesktopLikely = true;
            resolve();
            return;
          }
          if (surface === 'window') {
            fullDesktopLikely = false;
            resolve();
            return;
          }
          // window.screen.width is CSS pixels, video.videoWidth is hardware pixels.
          // On HiDPI displays (Win11 default 125-200% scaling, common on Lenovo) those differ by devicePixelRatio.
          const dpr = window.devicePixelRatio || 1;
          const screenWidth = (window.screen?.width || 0) * dpr;
          const screenHeight = (window.screen?.height || 0) * dpr;
          if (screenWidth && screenHeight) {
            log.info('screenshotCapture @ acquireDisplayStream: primary screen resolution (hw)', screenWidth + 'x' + screenHeight, 'dpr', dpr);
            const widthDiff = Math.abs(video.videoWidth - screenWidth);
            const heightDiff = Math.abs(video.videoHeight - screenHeight);
            const widthRel = widthDiff / screenWidth;
            const heightRel = heightDiff / screenHeight;
            const threshold = 0.1;
            if (widthRel > threshold || heightRel > threshold) {
              fullDesktopLikely = false;
              log.warn('screenshotCapture @ acquireDisplayStream: video vs screen resolution differ by more than 10% – likely not full desktop capture');
            } else {
              fullDesktopLikely = true;
            }
          }
        } catch (e) {
          // ignore screen resolution logging errors
        }
        resolve();
      }).catch(reject);
      video.onerror = () => reject(new Error('video load failed'));
    });
    return { stream, video };
  } catch (err) {
    log.warn('screenshotCapture @ acquireDisplayStream: getDisplayMedia failed', err?.message);
    return null;
  }
}

/** Enable per-tick capturePage fallback (Cage when getDisplayMedia is unavailable). */
export function setCageWindowCaptureFallback(enabled) {
  useWindowCaptureFallback = !!enabled;
  if (enabled) fullDesktopLikely = true;
}

export function isCageWindowCaptureFallback() {
  return useWindowCaptureFallback;
}

export function setLinuxKioskRunningInCage(running) {
  linuxKioskRunningInCage = !!running;
}

/** Registration may proceed without a desktop capture stream when running in Cage. */
export function canRegisterWithoutDisplayStream() {
  return linuxKioskRunningInCage || useWindowCaptureFallback;
}

/** Acquire once per live stream; re-runs after track loss (initAttempted cleared in stopSharedStream). */
export async function initDisplayStreamOnce() {
  if (!isElectronWindow(window)) return;
  if (initAttempted && hasActiveScreenshotStream()) return;
  if (initAttempted && !hasActiveScreenshotStream()) initAttempted = false;
  initAttempted = true;
  const acquired = await acquireDisplayStream();
  if (acquired) {
    sharedRef.stream = acquired.stream;
    sharedRef.video = acquired.video;
    log.info('screenshotCapture @ initDisplayStreamOnce: display stream initialized');
  } else {
    initAttempted = false;
    if (linuxKioskRunningInCage) {
      setCageWindowCaptureFallback(true);
      log.info('screenshotCapture @ initDisplayStreamOnce: using capturePage fallback in Cage');
    } else {
      log.warn('screenshotCapture @ initDisplayStreamOnce: display stream not available');
    }
  }
}

/** Acquire display stream when called with user gesture (e.g. Connect click). Returns true if stream is ready. */
export async function ensureDisplayStreamAsync() {
  // macOS / Cage: capturePage path needs no getDisplayMedia stream.
  if (useWindowCaptureFallback) return true;
  if (hasActiveScreenshotStream()) return true;
  if (initAttempted && !hasActiveScreenshotStream()) initAttempted = false;
  await initDisplayStreamOnce();
  if (linuxKioskRunningInCage) {
    return hasActiveScreenshotStream() || useWindowCaptureFallback;
  }
  return hasActiveScreenshotStream();
}

/** Check if there is an active screenshot stream */
export function hasActiveScreenshotStream() {
  const track = sharedRef.stream?.getVideoTracks?.()[0];
  return !!track && track.readyState === 'live';
}

/** Heuristic: did we likely capture the full desktop (based on resolution comparison)? */
export function isFullDesktopCaptureLikely() {
  return fullDesktopLikely;
}

/**
 * Apply config: start interval when serverip and screenshotinterval > 0, stop when 0 or no serverip.
 * Reuses the long-lived capture stream for every tick (no new getDisplayMedia per tick).
 */
function applyConfig(signalBridge, config) {
  if (applyInFlight) return;
  applyInFlight = true;
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  consecutiveFailures = 0;

  if (!config?.serverip || !(config.screenshotinterval > 0)) {
    log.info('screenshotCapture @ applyConfig: skip (no serverip or interval)', { serverip: config?.serverip, screenshotinterval: config?.screenshotinterval });
    applyInFlight = false;
    return;
  }

  const ms = config.screenshotinterval;

  if (useWindowCaptureFallback) {
    log.info('screenshotCapture @ applyConfig: starting capturePage interval', ms, 'ms');
    intervalId = setInterval(() => {
      signalBridge.invoke('getScreenshotConfig').then((cfg) => {
        if (!cfg?.serverip || cfg.clientinfo?.localLockdown) return;
        captureAndUploadFromIpc(signalBridge, cfg).then((ok) => {
          if (ok) consecutiveFailures = 0;
          else {
            consecutiveFailures += 1;
            if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
              if (intervalId) clearInterval(intervalId);
              intervalId = null;
              log.warn('screenshotCapture @ applyConfig: capturePage paused after', MAX_CONSECUTIVE_FAILURES, 'failures');
            }
          }
        });
      });
    }, ms);
    applyInFlight = false;
    return;
  }

  log.info('screenshotCapture @ applyConfig: starting interval using existing stream', ms, 'ms');

  if (!hasActiveScreenshotStream()) {
    log.warn('screenshotCapture @ applyConfig: no active stream, interval not started');
    applyInFlight = false;
    return;
  }

  intervalId = setInterval(() => {
    signalBridge.invoke('getScreenshotConfig').then((cfg) => {
      if (!cfg?.serverip || cfg.clientinfo?.localLockdown) return;
      const track = sharedRef.stream?.getVideoTracks?.()[0];
      if (!track || track.readyState === 'ended') {
        if (intervalId) clearInterval(intervalId);
        intervalId = null;
        stopSharedStream(sharedRef);
        log.warn('screenshotCapture @ applyConfig: stream ended, screenshot capture disabled until restart');
        return;
      }
      captureAndUpload(signalBridge, cfg, sharedRef).then((ok) => {
        if (ok) consecutiveFailures = 0;
        else {
          consecutiveFailures += 1;
          if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            if (intervalId) clearInterval(intervalId);
            intervalId = null;
            log.warn('screenshotCapture @ applyConfig: screenshot upload paused after', MAX_CONSECUTIVE_FAILURES, 'failures (stream kept; resumes on screenshot-config)');
          }
        }
      });
    });
  }, ms);
  applyInFlight = false;
}

/**
 * Init screenshot scheduler: only in Electron. Listens for screenshot-config and polls getScreenshotConfig on start.
 */
export function initScreenshotScheduler(signalBridge) {
  if (!isElectronWindow(window)) {
    log.info('screenshotCapture @ initScreenshotScheduler: not Electron, skip');
    return;
  }
  log.info('screenshotCapture @ initScreenshotScheduler: registering screenshot-config listener and fetching getScreenshotConfig');

  // macOS / Cage use capturePage; only getDisplayMedia platforms need a pre-warmed stream.
  if (!useWindowCaptureFallback) {
    // Initialize display stream once so it is already available when interval starts after server connect
    initDisplayStreamOnce();
  }

  signalBridge.on('screenshot-config', (_event, config) => {
    applyConfig(signalBridge, config);
  });

  signalBridge.invoke('getScreenshotConfig').then((config) => {
    if (config?.serverip && config.screenshotinterval > 0 && !config.clientinfo?.localLockdown) {
      applyConfig(signalBridge, config);
    } else {
      log.info('screenshotCapture @ initScreenshotScheduler: not starting interval yet (need serverip, interval > 0, no localLockdown)');
    }
  }).catch((err) => {
    log.error('screenshotCapture @ initScreenshotScheduler: getScreenshotConfig failed', err?.message);
  });
}
