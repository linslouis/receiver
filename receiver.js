/**
 * LinsIPTV Cast Receiver - CAF v3 Compliant with Debug Support
 * Authenticated HLS streaming with custom HTTP header injection
 * Chrome Remote Inspector compatible
 */

'use strict';

// ============================================
// EARLY LOGGING & DEBUG SETUP
// ============================================

console.log('[BOOT] Receiver JavaScript loaded');
console.log('[BOOT] CAF SDK available:', typeof cast !== 'undefined');
console.log('[BOOT] Cast framework available:', typeof cast?.framework !== 'undefined');

// Update debug overlay
function updateDebugStatus(message, isError = false) {
    const debugEl = document.getElementById('debug-status');
    if (debugEl) {
        debugEl.innerHTML = `<div style="color: ${isError ? '#f00' : '#0f0'}">${message}</div>`;
    }
    console.log(message);
}

// ============================================
// GLOBAL STATE
// ============================================

let globalRequestHeaders = {};
let context = null;
let playerManager = null;

// ============================================
// CAF INITIALIZATION - MUST RUN IMMEDIATELY
// ============================================

console.log('[CAF] Starting initialization...');

try {
    // Get Cast context instance
    context = cast.framework.CastReceiverContext.getInstance();
    console.log('[CAF] ✓ CastReceiverContext obtained');
    
    // Enable Cast Debug Logger if available
    if (typeof cast.debug !== 'undefined') {
        cast.debug.CastDebugLogger.getInstance().setEnabled(true);
        console.log('[CAF] ✓ Debug logger enabled');
    }
    
    // Get player manager
    playerManager = context.getPlayerManager();
    console.log('[CAF] ✓ PlayerManager obtained');
    
    // ============================================
    // PLAYBACK CONFIG - HEADER INJECTION
    // ============================================
    
    const playbackConfig = new cast.framework.PlaybackConfig();
    console.log('[CAF] Configuring playback with header injection...');
    
    /**
     * Request modifier - injects authentication headers into all network requests
     */
    const injectAuthHeaders = (requestInfo) => {
        if (Object.keys(globalRequestHeaders).length > 0) {
            for (const [key, value] of Object.entries(globalRequestHeaders)) {
                requestInfo.headers[key] = value;
            }
            
            // Log occasionally to avoid spam
            if (Math.random() < 0.05) {
                console.log('[NETWORK] Headers injected:', Object.keys(globalRequestHeaders).join(', '));
            }
        }
    };
    
    // Apply to all request types
    playbackConfig.manifestRequestHandler = injectAuthHeaders;
    playbackConfig.segmentRequestHandler = injectAuthHeaders;
    playbackConfig.licenseRequestHandler = injectAuthHeaders;
    
    console.log('[CAF] ✓ Request handlers configured');
    
    // ============================================
    // MESSAGE INTERCEPTORS
    // ============================================
    
    /**
     * LOAD interceptor - extracts authentication headers from customData
     */
    playerManager.setMessageInterceptor(
        cast.framework.messages.MessageType.LOAD,
        (loadRequestData) => {
            console.log('[LOAD] ========================================');
            console.log('[LOAD] Request intercepted');
            
            const media = loadRequestData.media;
            
            if (!media || !media.contentId) {
                console.error('[LOAD] ❌ No media or contentId');
                return loadRequestData;
            }
            
            console.log('[LOAD] Content URL:', media.contentId);
            console.log('[LOAD] Content Type:', media.contentType);
            console.log('[LOAD] Stream Type:', media.streamType);
            
            // Extract headers from customData
            if (media.customData && media.customData.headers) {
                globalRequestHeaders = media.customData.headers;
                
                console.log('[LOAD] ✓ HEADERS EXTRACTED:');
                for (const [key, value] of Object.entries(globalRequestHeaders)) {
                    const displayValue = value.length > 50 ? value.substring(0, 30) + '...' : value;
                    console.log(`[LOAD]   ${key}: ${displayValue}`);
                }
                
                console.log('[LOAD] ✓ Headers will be injected into ALL requests');
                updateDebugStatus('🟢 Headers extracted - ready to play');
            } else {
                console.warn('[LOAD] ⚠ No customData.headers found');
                console.warn('[LOAD] Stream may fail if authentication required');
                globalRequestHeaders = {};
                updateDebugStatus('🟡 No auth headers - playing without');
            }
            
            // Log stream classification
            const isLive = media.customData?.isLive || media.streamType === cast.framework.messages.StreamType.LIVE;
            console.log('[LOAD] Stream type:', isLive ? 'LIVE TV' : 'VOD');
            
            console.log('[LOAD] ========================================');
            
            return loadRequestData;
        }
    );
    
    console.log('[CAF] ✓ LOAD interceptor registered');
    
    // ============================================
    // EVENT LISTENERS
    // ============================================
    
    // ERROR events
    playerManager.addEventListener(
        cast.framework.events.EventType.ERROR,
        (event) => {
            console.error('[ERROR] ❌ Playback error:', event.detailedErrorCode);
            console.error('[ERROR] Details:', event);
            
            // Check for auth errors
            if (event.detailedErrorCode && 
                (event.detailedErrorCode.includes('403') || 
                 event.detailedErrorCode.includes('401'))) {
                console.error('[ERROR] ❌ AUTHENTICATION FAILURE');
                console.error('[ERROR] Headers may be missing or invalid');
                console.error('[ERROR] Current headers:', Object.keys(globalRequestHeaders));
                updateDebugStatus('🔴 Auth Error - Check headers', true);
            } else {
                updateDebugStatus('🔴 Playback Error - See console', true);
            }
        }
    );
    
    // LOAD COMPLETE
    playerManager.addEventListener(
        cast.framework.events.EventType.PLAYER_LOAD_COMPLETE,
        () => {
            console.log('[PLAYER] ✓ Media loaded successfully');
            updateDebugStatus('🟢 Media loaded');
        }
    );
    
    // MEDIA STATUS (for state tracking)
    playerManager.addEventListener(
        cast.framework.events.EventType.MEDIA_STATUS,
        (event) => {
            const state = event.playerState;
            
            if (state === cast.framework.messages.PlayerState.PLAYING) {
                console.log('[PLAYER] ✓ PLAYBACK STARTED - Stream is playing!');
                updateDebugStatus('🟢 Playing');
            } else if (state === cast.framework.messages.PlayerState.BUFFERING) {
                console.log('[PLAYER] ⏳ Buffering...');
                updateDebugStatus('🟡 Buffering...');
            } else if (state === cast.framework.messages.PlayerState.IDLE) {
                console.log('[PLAYER] ⚪ IDLE');
                updateDebugStatus('⚪ Idle');
            } else if (state === cast.framework.messages.PlayerState.PAUSED) {
                console.log('[PLAYER] ⏸ PAUSED');
                updateDebugStatus('🟡 Paused');
            }
        }
    );
    
    // READY event (receiver fully initialized)
    context.addEventListener(
        cast.framework.system.EventType.READY,
        () => {
            console.log('[CAF] ========================================');
            console.log('[CAF] ✓✓✓ RECEIVER READY ✓✓✓');
            console.log('[CAF] App ID: 80E3032B');
            console.log('[CAF] Version: 3.0 (Authenticated)');
            console.log('[CAF] ========================================');
            updateDebugStatus('🟢 Receiver Ready - Waiting for content');
        }
    );
    
    console.log('[CAF] ✓ Event listeners registered');
    
    // ============================================
    // START RECEIVER - CRITICAL
    // ============================================
    
    const options = new cast.framework.CastReceiverOptions();
    options.maxInactivity = 3600; // 1 hour
    options.statusText = 'LinsIPTV Ready';
    
    console.log('[CAF] Starting receiver with options...');
    console.log('[CAF] Max inactivity:', options.maxInactivity);
    
    // START - This makes receiver inspectable!
    context.start({ playbackConfig: playbackConfig });
    
    console.log('[CAF] ========================================');
    console.log('[CAF] ✓✓✓ CONTEXT.START() CALLED ✓✓✓');
    console.log('[CAF] Receiver should now be inspectable');
    console.log('[CAF] Check: chrome://inspect/#devices');
    console.log('[CAF] ========================================');
    
    updateDebugStatus('🟢 CAF Started - Ready for inspection');
    
} catch (error) {
    console.error('[CAF] ❌ FATAL ERROR during initialization:', error);
    console.error('[CAF] Stack:', error.stack);
    updateDebugStatus('🔴 FATAL: ' + error.message, true);
    
    // Try to display error on screen
    document.body.innerHTML = `
        <div style="color: red; padding: 50px; font-size: 24px;">
            <h1>Receiver Initialization Failed</h1>
            <p>${error.message}</p>
            <pre>${error.stack}</pre>
        </div>
    `;
}

// ============================================
// LOGGING HELPERS
// ============================================

// Log all console methods for visibility
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

console.log = function(...args) {
    originalLog.apply(console, args);
};

console.error = function(...args) {
    originalError.apply(console, args);
};

console.warn = function(...args) {
    originalWarn.apply(console, args);
};

// ============================================
// FINAL BOOT LOG
// ============================================

console.log('[BOOT] ========================================');
console.log('[BOOT] Receiver script execution complete');
console.log('[BOOT] CAF initialized:', context !== null);
console.log('[BOOT] PlayerManager available:', playerManager !== null);
console.log('[BOOT] Ready for Cast sessions');
console.log('[BOOT] ========================================');
