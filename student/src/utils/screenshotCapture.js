/**
 * Frontend screenshot capture using getDisplayMedia (Electron desktop capture).
 * Resize 1024px, header crop 150px, isAllBlack check; upload via fetch to teacher API.
 */

import { isElectronWindow } from '../types/platform';

const PREFIX = '[screenshotCapture]';
const log = { info: (...a) => console.log(PREFIX, ...a), warn: (...a) => console.warn(PREFIX, ...a), error: (...a) => console.error(PREFIX, ...a) };

const SCREENSHOT_MAX_WIDTH = 1024;
const HEADER_CROP_HEIGHT = 150;

/** Check if image data (RGBA) is effectively all black */
function isAllBlack(imageData) {
  const data = imageData.data;
  const len = data.length;
  const threshold = 10;
  for (let i = 0; i < len; i += 4) {
    if (data[i] > threshold || data[i + 1] > threshold || data[i + 2] > threshold) return false;
  }
  return true;
}

/** Compute hash of binary data for screenshothash (SHA-256 in browser) */
async function hashArrayBuffer(buffer) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Request screen-capture permission once up front (no server needed).
 * Triggers getDisplayMedia so OS/permission is granted; stream is stopped immediately.
 */
async function requestCapturePermission() {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    log.warn('requestCapturePermission: getDisplayMedia not available');
    return;
  }
  try {
    log.info('requestCapturePermission: requesting…');
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    stream.getTracks().forEach((t) => t.stop());
    log.info('requestCapturePermission: OK (permission granted)');
  } catch (err) {
    log.warn('requestCapturePermission: failed', err?.message);
  }
}

/**
 * Capture one frame from a live video element (stream already attached and playing).
 * Returns { screenshotBase64, headerBase64, isblack } or null on failure.
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

  const headerCanvas = document.createElement('canvas');
  headerCanvas.width = sw;
  headerCanvas.height = Math.min(HEADER_CROP_HEIGHT, sh);
  const headerCtx = headerCanvas.getContext('2d');
  if (!headerCtx) return null;
  headerCtx.drawImage(screenshotCanvas, 0, 0, sw, headerCanvas.height, 0, 0, sw, headerCanvas.height);

  const headerImageData = headerCtx.getImageData(0, 0, headerCanvas.width, headerCanvas.height);
  const isblack = isAllBlack(headerImageData);

  const screenshotBase64 = screenshotCanvas.toDataURL('image/jpeg', 0.85).split(',')[1];
  const headerBase64 = headerCanvas.toDataURL('image/jpeg', 0.85).split(',')[1];

  return { screenshotBase64, headerBase64, isblack };
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
      log.warn('captureFrameFromVideo returned null');
      return false;
    }
    const { screenshotBase64, headerBase64, isblack } = result;

    const binary = Uint8Array.from(atob(screenshotBase64), (c) => c.charCodeAt(0));
    const screenshothash = await hashArrayBuffer(binary.buffer);

    const payload = {
      clientinfo: { ...clientinfo },
      screenshot: screenshotBase64,
      screenshothash,
      header: headerBase64,
      screenshotfilename: (clientinfo.token || 'unknown') + '.jpg',
    };

    const url = `https://${serverip}:${serverApiPort}/server/control/updatescreenshot`;
    const res = await fetch(url, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      log.warn('upload response', res.status, res.statusText);
      return false;
    }
    return true;
  } catch (err) {
    log.error('capture/upload error', err?.message);
    return false;
  }
}

/** Stop and clear the shared stream/video */
function stopSharedStream(sharedRef) {
  if (sharedRef.stream) {
    sharedRef.stream.getTracks().forEach((t) => t.stop());
    sharedRef.stream = null;
  }
  sharedRef.video = null;
}

let intervalId = null;
let sharedRef = { stream: null, video: null };
let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 5;
let applyInFlight = false;

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
      video.onloadedmetadata = () => video.play().then(resolve).catch(reject);
      video.onerror = () => reject(new Error('video load failed'));
    });
    return { stream, video };
  } catch (err) {
    log.warn('getDisplayMedia failed', err?.message);
    return null;
  }
}

/**
 * Apply config: start interval when serverip and screenshotinterval > 0, stop when 0 or no serverip.
 * Stream is acquired once when interval starts and reused for every tick.
 */
function applyConfig(signalBridge, config) {
  if (applyInFlight) return;
  applyInFlight = true;
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  stopSharedStream(sharedRef);
  consecutiveFailures = 0;

  if (!config?.serverip || !(config.screenshotinterval > 0)) {
    log.info('applyConfig: skip (no serverip or interval)', { serverip: config?.serverip, screenshotinterval: config?.screenshotinterval });
    applyInFlight = false;
    return;
  }

  const ms = config.screenshotinterval;
  log.info('applyConfig: acquiring stream once, then starting interval', ms, 'ms');

  acquireDisplayStream().then((acquired) => {
    if (!acquired) {
      log.warn('applyConfig: could not acquire stream, interval not started');
      applyInFlight = false;
      return;
    }
    sharedRef.stream = acquired.stream;
    sharedRef.video = acquired.video;

    intervalId = setInterval(() => {
      signalBridge.invoke('getScreenshotConfig').then((cfg) => {
        if (!cfg?.serverip || cfg.clientinfo?.localLockdown) return;
        const track = sharedRef.stream?.getVideoTracks()?.[0];
        if (track?.readyState === 'ended') {
          stopSharedStream(sharedRef);
          acquireDisplayStream().then((reacquired) => {
            if (reacquired) {
              sharedRef.stream = reacquired.stream;
              sharedRef.video = reacquired.video;
              consecutiveFailures = 0;
            }
          });
          return;
        }
        captureAndUpload(signalBridge, cfg, sharedRef).then((ok) => {
          if (ok) consecutiveFailures = 0;
          else {
            consecutiveFailures += 1;
            if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
              if (intervalId) clearInterval(intervalId);
              intervalId = null;
              stopSharedStream(sharedRef);
              log.warn('screenshot capture paused after', MAX_CONSECUTIVE_FAILURES, 'consecutive failures (will resume on next screenshot-config)');
            }
          }
        });
      });
    }, ms);
    applyInFlight = false;
  });
}

/**
 * Init screenshot scheduler: only in Electron. Listens for screenshot-config and polls getScreenshotConfig on start.
 */
export function initScreenshotScheduler(signalBridge) {
  if (!isElectronWindow(window)) {
    log.info('init: not Electron, skip');
    return;
  }
  log.info('init: registering screenshot-config listener and fetching getScreenshotConfig');

  // Request capture permission once so it is already granted when interval starts after server connect
  requestCapturePermission();

  signalBridge.on('screenshot-config', (_event, config) => {
    //log.info('screenshot-config event', config);
    applyConfig(signalBridge, config);
  });

  signalBridge.invoke('getScreenshotConfig').then((config) => {
    if (config?.serverip && config.screenshotinterval > 0 && !config.clientinfo?.localLockdown) {
      applyConfig(signalBridge, config);
    } else {
      log.info('init: not starting interval yet (need serverip, interval > 0, no localLockdown)');
    }
  }).catch((err) => {
    log.error('getScreenshotConfig failed', err?.message);
  });
}
