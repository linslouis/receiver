
/**
 * LinsIPTV Cast Receiver - CAF v3 (PATCHED FOR LIVE IPTV)
 * Fixes:
 * 1. Explicit HLS MIME enforcement
 * 2. Live buffering + live-edge handling
 * 3. Robust live stream detection
 * 4. Basic live recovery on errors
 */

'use strict';

console.log('[BOOT] Receiver JavaScript loaded (PATCHED)');

let globalRequestHeaders = {};
let context = null;
let playerManager = null;

function updateDebugStatus(message, isError = false) {
    const debugEl = document.getElementById('debug-status');
    if (debugEl) {
        debugEl.innerHTML = `<div style="color:${isError ? '#f00' : '#0f0'}">${message}</div>`;
    }
    console.log(message);
}

context = cast.framework.CastReceiverContext.getInstance();
playerManager = context.getPlayerManager();

const playbackConfig = new cast.framework.PlaybackConfig();

/* ===== LIVE IPTV CRITICAL SETTINGS ===== */
playbackConfig.autoResumeDuration = 5;
playbackConfig.enableSmoothLivePlayback = true;
playbackConfig.liveSeekableRange = true;

/* ===== HEADER INJECTION ===== */
const injectAuthHeaders = (requestInfo) => {
    if (globalRequestHeaders) {
        Object.entries(globalRequestHeaders).forEach(([k, v]) => {
            requestInfo.headers[k] = v;
        });
    }
};

playbackConfig.manifestRequestHandler = injectAuthHeaders;
playbackConfig.segmentRequestHandler = injectAuthHeaders;
playbackConfig.licenseRequestHandler = injectAuthHeaders;

/* ===== LOAD INTERCEPTOR ===== */
playerManager.setMessageInterceptor(
    cast.framework.messages.MessageType.LOAD,
    (loadRequestData) => {
        const media = loadRequestData.media;
        if (!media || !media.contentId) return loadRequestData;

        /* Robust LIVE detection */
        const isLive =
            media.streamType === cast.framework.messages.StreamType.LIVE ||
            media.contentId.includes('/live/') ||
            media.contentId.includes('/timeshift/') ||
            media.contentId.endsWith('.m3u8');

        media.streamType = isLive
            ? cast.framework.messages.StreamType.LIVE
            : cast.framework.messages.StreamType.BUFFERED;

        /* Enforce HLS MIME */
        if (media.contentId.endsWith('.m3u8')) {
            media.contentType = 'application/x-mpegURL';
        }

        /* Extract headers */
        if (media.customData && media.customData.headers) {
            globalRequestHeaders = media.customData.headers;
            updateDebugStatus('🟢 Headers loaded');
        } else {
            globalRequestHeaders = {};
            updateDebugStatus('🟡 No headers');
        }

        console.log('[LOAD] URL:', media.contentId);
        console.log('[LOAD] TYPE:', media.contentType);
        console.log('[LOAD] LIVE:', isLive);

        return loadRequestData;
    }
);

/* ===== ERROR RECOVERY ===== */
playerManager.addEventListener(
    cast.framework.events.EventType.ERROR,
    (event) => {
        console.error('[ERROR]', event.detailedErrorCode);

        const state = playerManager.getPlayerState();
        if (state === cast.framework.messages.PlayerState.IDLE) {
            console.warn('[RECOVERY] Attempting resume');
            setTimeout(() => playerManager.play(), 2000);
        }

        updateDebugStatus('🔴 Playback error', true);
    }
);

/* ===== STATUS LOGGING ===== */
playerManager.addEventListener(
    cast.framework.events.EventType.MEDIA_STATUS,
    (event) => {
        const s = event.playerState;
        if (s === cast.framework.messages.PlayerState.PLAYING) {
            updateDebugStatus('🟢 Playing');
        } else if (s === cast.framework.messages.PlayerState.BUFFERING) {
            updateDebugStatus('🟡 Buffering');
        }
    }
);

/* ===== START RECEIVER ===== */
context.start({ playbackConfig });

console.log('[BOOT] Receiver started (PATCHED)');
