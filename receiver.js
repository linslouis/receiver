/**
 * LinsIPTV Cast Receiver - AUTHENTICATED STREAMING VERSION
 * Custom Web Receiver with HTTP Header Injection
 * 
 * This receiver implements the solution for casting authenticated HLS streams
 * in networks with AP Isolation by injecting custom HTTP headers into all
 * network requests (manifest and segments).
 * 
 * Based on Google Cast Application Framework (CAF) v3
 */

'use strict';

// ============================================
// GLOBAL STATE FOR AUTHENTICATION
// ============================================

/**
 * Global storage for authentication headers passed from Android sender.
 * These headers are extracted from the LOAD request's customData
 * and injected into every network request made by the player.
 */
let globalRequestHeaders = {};

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize Cast Receiver with Custom PlaybackConfig for header injection
 */
function initializeReceiver() {
    console.log('[LinsIPTV] ========================================');
    console.log('[LinsIPTV] Authenticated Cast Receiver Initializing...');
    console.log('[LinsIPTV] Version: 3.0 (Header Injection)');
    console.log('[LinsIPTV] App ID: 80E3032B');
    console.log('[LinsIPTV] ========================================');
    
    // Get Cast context and player manager
    const context = cast.framework.CastReceiverContext.getInstance();
    const playerManager = context.getPlayerManager();
    
    // ============================================
    // STEP 1: INTERCEPT LOAD MESSAGE TO EXTRACT HEADERS
    // ============================================
    
    /**
     * Message interceptor for LOAD requests.
     * Extracts authentication headers from customData before playback starts.
     */
    playerManager.setMessageInterceptor(
        cast.framework.messages.MessageType.LOAD,
        (loadRequestData) => {
            console.log('[LinsIPTV] ========================================');
            console.log('[LinsIPTV] LOAD REQUEST INTERCEPTED');
            console.log('[LinsIPTV] ========================================');
            
            const media = loadRequestData.media;
            
            if (!media || !media.contentId) {
                console.error('[LinsIPTV] ❌ Invalid media - no contentId');
                return loadRequestData;
            }
            
            console.log('[LinsIPTV] Content URL:', media.contentId);
            console.log('[LinsIPTV] Content Type:', media.contentType);
            console.log('[LinsIPTV] Stream Type:', media.streamType);
            
            // Extract headers from customData
            if (media.customData && media.customData.headers) {
                globalRequestHeaders = media.customData.headers;
                
                console.log('[LinsIPTV] ✓ HEADERS EXTRACTED FROM CUSTOMDATA:');
                for (const [key, value] of Object.entries(globalRequestHeaders)) {
                    // Don't log full tokens for security, just show they exist
                    const displayValue = value.length > 50 ? value.substring(0, 30) + '...' : value;
                    console.log(`[LinsIPTV]   ${key}: ${displayValue}`);
                }
                
                console.log('[LinsIPTV] ✓ Headers will be injected into ALL network requests');
            } else {
                console.warn('[LinsIPTV] ⚠ No customData.headers found in request');
                console.warn('[LinsIPTV] ⚠ Stream may fail if authentication required');
                globalRequestHeaders = {};
            }
            
            // Log stream type for debugging
            const isLive = media.customData && media.customData.isLive;
            console.log('[LinsIPTV] Stream classification:', isLive ? 'LIVE TV' : 'VOD');
            
            console.log('[LinsIPTV] ========================================');
            
            // Return unmodified request (headers are applied in playbackConfig)
            return loadRequestData;
        }
    );
    
    // ============================================
    // STEP 2: CONFIGURE PLAYBACK WITH HEADER INJECTION
    // ============================================
    
    const playbackConfig = new cast.framework.PlaybackConfig();
    
    /**
     * Request modifier function that injects authentication headers.
     * This is called for EVERY network request made by the player.
     * 
     * @param {cast.framework.NetworkRequestInfo} requestInfo 
     */
    const injectAuthHeaders = (requestInfo) => {
        // Inject all headers from globalRequestHeaders
        for (const [key, value] of Object.entries(globalRequestHeaders)) {
            requestInfo.headers[key] = value;
        }
        
        // Log first few requests for debugging (avoid spam)
        if (Math.random() < 0.1) { // Log ~10% of requests
            console.log('[LinsIPTV] 📡 Request:', requestInfo.url.substring(0, 80) + '...');
            console.log('[LinsIPTV] 📡 Headers injected:', Object.keys(globalRequestHeaders).join(', '));
        }
    };
    
    /**
     * CRITICAL: Apply header injection to ALL request types
     * 
     * - manifestRequestHandler: Called when player requests .m3u8 playlist
     * - segmentRequestHandler: Called for every .ts video chunk (most important!)
     * - licenseRequestHandler: Called for DRM license requests (if applicable)
     */
    playbackConfig.manifestRequestHandler = injectAuthHeaders;
    playbackConfig.segmentRequestHandler = injectAuthHeaders;
    playbackConfig.licenseRequestHandler = injectAuthHeaders;
    
    console.log('[LinsIPTV] ✓ PlaybackConfig configured with header injection');
    
    // ============================================
    // STEP 3: REGISTER EVENT LISTENERS
    // ============================================
    
    // Listen for playback errors
    playerManager.addEventListener(
        cast.framework.events.EventType.ERROR,
        (event) => {
            console.error('[LinsIPTV] ❌ PLAYBACK ERROR:', event.detailedErrorCode);
            console.error('[LinsIPTV] Error details:', event);
            
            // Check if it's an authentication error
            if (event.detailedErrorCode && 
                (event.detailedErrorCode.includes('403') || 
                 event.detailedErrorCode.includes('401'))) {
                console.error('[LinsIPTV] ❌ AUTHENTICATION FAILURE');
                console.error('[LinsIPTV] Headers may be missing or invalid');
                console.error('[LinsIPTV] Current headers:', Object.keys(globalRequestHeaders));
            }
        }
    );
    
    // Listen for successful load
    playerManager.addEventListener(
        cast.framework.events.EventType.PLAYER_LOAD_COMPLETE,
        () => {
            console.log('[LinsIPTV] ✓ Media loaded successfully');
        }
    );
    
    // Listen for playing state
    playerManager.addEventListener(
        cast.framework.events.EventType.MEDIA_STATUS,
        (event) => {
            const state = event.playerState;
            if (state === cast.framework.messages.PlayerState.PLAYING) {
                console.log('[LinsIPTV] ✓ PLAYBACK STARTED - Stream is playing!');
            } else if (state === cast.framework.messages.PlayerState.BUFFERING) {
                console.log('[LinsIPTV] ⏳ Buffering...');
            }
        }
    );
    
    console.log('[LinsIPTV] ✓ Event listeners registered');
    
    // ============================================
    // STEP 4: START RECEIVER
    // ============================================
    
    // Configure receiver options
    const options = new cast.framework.CastReceiverOptions();
    options.maxInactivity = 3600; // 1 hour
    options.statusText = 'LinsIPTV Ready';
    
    // Start with our custom playbackConfig
    context.start({ playbackConfig: playbackConfig });
    
    console.log('[LinsIPTV] ========================================');
    console.log('[LinsIPTV] ✓ RECEIVER STARTED SUCCESSFULLY');
    console.log('[LinsIPTV] Ready to receive authenticated streams');
    console.log('[LinsIPTV] ========================================');
}

// ============================================
// STARTUP
// ============================================

// Wait for DOM to be ready, then initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeReceiver);
} else {
    initializeReceiver();
}

console.log('[LinsIPTV] Receiver script loaded');
