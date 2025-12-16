/**
 * IPTV Cast Receiver - FIXED VERSION
 * Production-ready Google Cast Custom Web Receiver
 * 
 * Strictly follows Google Cast UX Guidelines
 * Supports Live TV, Movies, and Series playback
 */

'use strict';

// ============================================
// CONSTANTS & CONFIGURATION
// ============================================

const RECEIVER_CONFIG = {
    maxInactivity: 3600, // 1 hour
    statusText: 'IPTV Receiver Ready',
    playbackLoggingEnabled: false, // No stream logging per PRD
    supportedCommands: [
        cast.framework.messages.Command.PAUSE,
        cast.framework.messages.Command.PLAY,
        cast.framework.messages.Command.SEEK,
        cast.framework.messages.Command.STOP
    ]
};

const CONTENT_TYPE = {
    LIVE: 'live',
    VOD: 'vod',
    SERIES: 'series'
};

// ============================================
// DOM ELEMENTS
// ============================================

const elements = {
    player: document.getElementById('player'),
    
    // Screens
    idleScreen: document.getElementById('idle-screen'),
    loadingScreen: document.getElementById('loading-screen'),
    playingScreen: document.getElementById('playing-screen'),
    errorScreen: document.getElementById('error-screen'),
    
    // Loading state
    loadingTitle: document.querySelector('.loading-title'),
    mediaPoster: document.querySelector('.media-poster'),
    
    // Playing state
    backgroundPoster: document.querySelector('.background-poster'),
    channelLogo: document.getElementById('channel-logo'),
    mediaTitle: document.getElementById('media-title'),
    mediaSubtitle: document.getElementById('media-subtitle'),
    liveBadge: document.getElementById('live-badge'),
    progressContainer: document.getElementById('progress-container'),
    progressFill: document.getElementById('progress-fill'),
    currentTime: document.getElementById('current-time'),
    duration: document.getElementById('duration'),
    bufferingOverlay: document.getElementById('buffering-overlay'),
    
    // Error state
    errorMessage: document.getElementById('error-message')
};

// ============================================
// RECEIVER STATE
// ============================================

let currentMetadata = null;
let playerManager = null;
let receiverContext = null;
let progressUpdateInterval = null;

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize Cast Receiver Context and Player Manager
 */
function initializeReceiver() {
    console.log('[linslog] Cast Receiver Initializing...');
    
    // Get Cast context
    receiverContext = cast.framework.CastReceiverContext.getInstance();
    
    // Configure receiver options
    const options = new cast.framework.CastReceiverOptions();
    options.maxInactivity = RECEIVER_CONFIG.maxInactivity;
    options.statusText = RECEIVER_CONFIG.statusText;
    options.disableIdleTimeout = false;
    
    // Get player manager
    playerManager = receiverContext.getPlayerManager();
    
    // CRITICAL FIX: Configure playback config to support all media types
    const playbackConfig = new cast.framework.PlaybackConfig();
    
    // Enable auto-resume and licensing (if needed)
    playbackConfig.autoResumeDuration = 5;
    playbackConfig.autoPauseDuration = null;
    
    // Set manifest and segment request handlers for HLS/DASH if needed
    playbackConfig.manifestRequestHandler = null;
    playbackConfig.segmentRequestHandler = null;
    
    // Apply playback configuration
    playerManager.setPlaybackConfig(playbackConfig);
    
    console.log('[linslog] Playback config applied');
    
    // Configure supported media commands
    playerManager.setSupportedMediaCommands(
        RECEIVER_CONFIG.supportedCommands.reduce((acc, cmd) => acc | cmd, 0),
        true
    );
    
    console.log('[linslog] Supported commands configured');
    
    // Register event listeners
    registerPlayerEventListeners();
    registerVideoEventListeners();
    
    // Start receiver
    receiverContext.start(options);
    
    console.log('[linslog] Cast Receiver initialized successfully');
    console.log('[linslog] Receiver Application ID: 80E3032B');
    showScreen('idle');
}

// ============================================
// EVENT LISTENERS
// ============================================

/**
 * Register Cast Player Manager event listeners
 */
function registerPlayerEventListeners() {
    
    // LOAD event - new content requested
    playerManager.setMessageInterceptor(
        cast.framework.messages.MessageType.LOAD,
        handleLoadRequest
    );
    
    // Player state changes
    playerManager.addEventListener(
        cast.framework.events.EventType.PLAYER_LOAD_COMPLETE,
        handleLoadComplete
    );
    
    playerManager.addEventListener(
        cast.framework.events.EventType.ERROR,
        handlePlayerError
    );
    
    // Media status changes
    playerManager.addEventListener(
        cast.framework.events.EventType.MEDIA_STATUS,
        handleMediaStatus
    );
    
    console.log('[linslog] Player event listeners registered');
}

/**
 * Register HTML5 video element event listeners
 */
function registerVideoEventListeners() {
    
    elements.player.addEventListener('playing', () => {
        console.log('[linslog] Video element: playing');
        logVideoTrackInfo();
        hideBuffering();
    });
    
    elements.player.addEventListener('waiting', () => {
        console.log('[linslog] Video element: buffering');
        showBuffering();
    });
    
    elements.player.addEventListener('pause', () => {
        console.log('[linslog] Video element: paused');
    });
    
    elements.player.addEventListener('ended', () => {
        console.log('[linslog] Video element: ended');
        stopProgressTracking();
        setTimeout(() => showScreen('idle'), 2000);
    });
    
    elements.player.addEventListener('error', (e) => {
        console.error('[linslog] Video element error:', e);
        const error = elements.player.error;
        if (error) {
            console.error('[linslog] Error code:', error.code);
            console.error('[linslog] Error message:', error.message);
        }
        handleVideoError();
    });
    
    elements.player.addEventListener('timeupdate', () => {
        updateProgress();
    });
    
    elements.player.addEventListener('loadedmetadata', () => {
        console.log('[linslog] Video metadata loaded');
        logVideoTrackInfo();
        checkVideoPlayback();
    });
    
    elements.player.addEventListener('canplay', () => {
        console.log('[linslog] Video can play');
    });
    
    elements.player.addEventListener('loadeddata', () => {
        console.log('[linslog] Video data loaded');
    });
    
    console.log('[linslog] Video element event listeners registered');
}

/**
 * Log video track information for debugging
 */
function logVideoTrackInfo() {
    const video = elements.player;
    console.log('[linslog] === Video Track Info ===');
    console.log('[linslog]   Video Width:', video.videoWidth);
    console.log('[linslog]   Video Height:', video.videoHeight);
    console.log('[linslog]   Duration:', video.duration);
    console.log('[linslog]   Has Video:', video.videoWidth > 0);
    console.log('[linslog]   Current Time:', video.currentTime);
    console.log('[linslog]   Paused:', video.paused);
    console.log('[linslog]   Playback Rate:', video.playbackRate);
    
    // Check audio tracks
    if (video.audioTracks && video.audioTracks.length > 0) {
        console.log('[linslog]   Audio Tracks:', video.audioTracks.length);
    }
    
    // Check video tracks
    if (video.videoTracks && video.videoTracks.length > 0) {
        console.log('[linslog]   Video Tracks:', video.videoTracks.length);
    }
    console.log('[linslog] =====================');
}

/**
 * Check if video is actually playing (not just audio)
 */
function checkVideoPlayback() {
    setTimeout(() => {
        const video = elements.player;
        if (!video.paused && video.videoWidth === 0) {
            console.error('[linslog] ❌ WARNING: Only audio playing - NO VIDEO TRACK');
            console.error('[linslog] ❌ Video codec likely not supported by Chromecast');
            console.error('[linslog] ✓ Chromecast supports: H.264 (AVC)');
            console.error('[linslog] ✗ Chromecast does NOT support: H.265 (HEVC), VP9, AV1');
        } else if (!video.paused && video.videoWidth > 0) {
            console.log('[linslog] ✓ SUCCESS: Video is playing correctly');
            console.log('[linslog] ✓ Video dimensions:', video.videoWidth, 'x', video.videoHeight);
        }
    }, 2000);
}

// ============================================
// CAST EVENT HANDLERS
// ============================================

/**
 * Handle LOAD request from sender
 * Extract metadata and configure playback
 */
function handleLoadRequest(loadRequestData) {
    console.log('[linslog] ========================================');
    console.log('[linslog] LOAD REQUEST RECEIVED');
    console.log('[linslog] ========================================');
    
    const media = loadRequestData.media;
    
    if (!media || !media.contentId) {
        console.error('[linslog] ❌ Invalid media data - no contentId');
        showError('Invalid content');
        return loadRequestData;
    }
    
    // Log all media information
    console.log('[linslog] Content URL:', media.contentId);
    console.log('[linslog] Content Type:', media.contentType);
    console.log('[linslog] Stream Type:', media.streamType);
    console.log('[linslog] Duration:', media.duration || 'unknown');
    
    // Extract custom metadata
    currentMetadata = extractMetadata(media);
    console.log('[linslog] Metadata extracted:', JSON.stringify(currentMetadata));
    
    // Show loading state
    showLoadingState(currentMetadata);
    
    // Log content type analysis
    logContentTypeInfo(media);
    
    // IMPORTANT: Don't modify the load request - let Cast SDK handle it naturally
    console.log('[linslog] Load request passed to Cast SDK');
    console.log('[linslog] ========================================');
    
    return loadRequestData;
}

/**
 * Log content type information and warnings
 */
function logContentTypeInfo(media) {
    const contentType = media.contentType || '';
    const contentUrl = media.contentId || '';
    
    if (contentType === 'application/x-mpegurl' || contentType === 'application/vnd.apple.mpegurl') {
        console.log('[linslog] ✓ HLS stream detected - excellent compatibility');
    } else if (contentType === 'video/x-matroska' || contentUrl.endsWith('.mkv')) {
        console.warn('[linslog] ⚠ MKV container detected');
        console.warn('[linslog] MKV compatibility depends on internal codecs:');
        console.warn('[linslog]   ✓ H.264 (AVC) + AAC/MP3 = WORKS');
        console.warn('[linslog]   ✗ H.265 (HEVC) = AUDIO ONLY');
        console.warn('[linslog]   ✗ VP9/AV1 = AUDIO ONLY');
        console.warn('[linslog] Recommendation: Use MP4 or HLS for best compatibility');
    } else if (contentType === 'video/mp4' || contentUrl.endsWith('.mp4')) {
        console.log('[linslog] ✓ MP4 container - excellent compatibility with H.264');
    } else if (contentType === 'application/dash+xml') {
        console.log('[linslog] ✓ DASH stream detected - good compatibility');
    } else {
        console.warn('[linslog] ⚠ Unknown content type:', contentType);
        console.warn('[linslog] Cast SDK will attempt to play, but success not guaranteed');
    }
}

/**
 * Extract metadata from Cast media object
 */
function extractMetadata(media) {
    const metadata = {
        title: 'Unknown',
        subtitle: '',
        poster: '',
        type: CONTENT_TYPE.VOD,
        isLive: false
    };
    
    // Extract from custom data
    if (media.customData) {
        console.log('[linslog] Custom data found:', JSON.stringify(media.customData));
        metadata.title = media.customData.title || metadata.title;
        metadata.subtitle = media.customData.subtitle || metadata.subtitle;
        metadata.poster = media.customData.poster || metadata.poster;
        metadata.type = media.customData.type || metadata.type;
        metadata.isLive = media.customData.isLive || (metadata.type === CONTENT_TYPE.LIVE);
    } else {
        console.log('[linslog] No custom data in media object');
    }
    
    // Fallback to standard metadata
    if (media.metadata) {
        metadata.title = media.metadata.title || metadata.title;
        metadata.subtitle = media.metadata.subtitle || media.metadata.series || metadata.subtitle;
        
        // Extract poster from images array
        if (media.metadata.images && media.metadata.images.length > 0) {
            metadata.poster = media.metadata.images[0].url;
            console.log('[linslog] Poster from metadata images:', metadata.poster);
        }
    }
    
    return metadata;
}

/**
 * Handle load complete event
 */
function handleLoadComplete(event) {
    console.log('[linslog] ========================================');
    console.log('[linslog] LOAD COMPLETE');
    console.log('[linslog] ========================================');
    showPlayingState(currentMetadata);
}

/**
 * Handle player errors
 */
function handlePlayerError(event) {
    console.error('[linslog] ========================================');
    console.error('[linslog] PLAYER ERROR');
    console.error('[linslog] ========================================');
    console.error('[linslog] Error event:', event);
    console.error('[linslog] Error code:', event.detailedErrorCode);
    const errorMessage = getErrorMessage(event.detailedErrorCode);
    console.error('[linslog] Error message:', errorMessage);
    console.error('[linslog] ========================================');
    showError(errorMessage);
}

/**
 * Handle media status changes
 */
function handleMediaStatus(event) {
    const playerState = event.playerState;
    console.log('[linslog] Player state changed:', playerState);
    
    switch (playerState) {
        case cast.framework.messages.PlayerState.IDLE:
            console.log('[linslog] State: IDLE, Reason:', event.idleReason);
            if (event.idleReason === cast.framework.messages.IdleReason.FINISHED) {
                console.log('[linslog] Playback finished normally');
            } else if (event.idleReason === cast.framework.messages.IdleReason.ERROR) {
                console.error('[linslog] Playback error occurred');
                showError('Playback error occurred');
            } else if (event.idleReason === cast.framework.messages.IdleReason.INTERRUPTED) {
                console.log('[linslog] Playback interrupted');
            }
            break;
            
        case cast.framework.messages.PlayerState.BUFFERING:
            console.log('[linslog] State: BUFFERING');
            showBuffering();
            break;
            
        case cast.framework.messages.PlayerState.PLAYING:
            console.log('[linslog] State: PLAYING');
            hideBuffering();
            break;
            
        case cast.framework.messages.PlayerState.PAUSED:
            console.log('[linslog] State: PAUSED');
            break;
    }
}

// ============================================
// VIDEO ERROR HANDLING
// ============================================

/**
 * Handle HTML5 video errors
 */
function handleVideoError() {
    const error = elements.player.error;
    let message = 'Unable to play content';
    
    if (error) {
        console.error('[linslog] Video error code:', error.code);
        switch (error.code) {
            case error.MEDIA_ERR_ABORTED:
                message = 'Playback aborted';
                console.error('[linslog] MEDIA_ERR_ABORTED');
                break;
            case error.MEDIA_ERR_NETWORK:
                message = 'Network error occurred';
                console.error('[linslog] MEDIA_ERR_NETWORK');
                break;
            case error.MEDIA_ERR_DECODE:
                message = 'Content format not supported';
                console.error('[linslog] MEDIA_ERR_DECODE - Codec not supported');
                console.error('[linslog] Video codec in this file is not compatible with Chromecast');
                break;
            case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                message = 'Stream not available';
                console.error('[linslog] MEDIA_ERR_SRC_NOT_SUPPORTED');
                break;
        }
    }
    
    showError(message);
}

/**
 * Get user-friendly error message
 */
function getErrorMessage(errorCode) {
    const errorMap = {
        'GENERIC': 'Unable to play content',
        'INVALID_REQUEST': 'Invalid content request',
        'TIMEOUT': 'Connection timeout',
        'INVALID_PLAYER_STATE': 'Playback error',
        'LOAD_FAILED': 'Failed to load content',
        'LOAD_CANCELLED': 'Playback cancelled',
        'INVALID_PARAMS': 'Invalid content parameters'
    };
    
    return errorMap[errorCode] || 'Playback error occurred';
}

// ============================================
// UI STATE MANAGEMENT
// ============================================

/**
 * Show specific screen state
 */
function showScreen(screenName) {
    console.log('[linslog] UI: Switching to', screenName, 'screen');
    
    // Hide all screens
    elements.idleScreen.classList.remove('active');
    elements.loadingScreen.classList.remove('active');
    elements.playingScreen.classList.remove('active');
    elements.errorScreen.classList.remove('active');
    
    // Show target screen
    switch (screenName) {
        case 'idle':
            elements.idleScreen.classList.add('active');
            stopProgressTracking();
            currentMetadata = null;
            break;
            
        case 'loading':
            elements.loadingScreen.classList.add('active');
            break;
            
        case 'playing':
            elements.playingScreen.classList.add('active');
            break;
            
        case 'error':
            elements.errorScreen.classList.add('active');
            stopProgressTracking();
            break;
    }
}

/**
 * Show loading state with metadata
 */
function showLoadingState(metadata) {
    elements.loadingTitle.textContent = metadata.title;
    
    if (metadata.poster) {
        elements.mediaPoster.style.backgroundImage = `url(${metadata.poster})`;
        elements.mediaPoster.style.display = 'block';
    } else {
        elements.mediaPoster.style.display = 'none';
    }
    
    showScreen('loading');
}

/**
 * Show playing state with full UI
 */
function showPlayingState(metadata) {
    console.log('[linslog] Showing playing state for:', metadata.title);
    
    // Set background poster
    if (metadata.poster) {
        elements.backgroundPoster.style.backgroundImage = `url(${metadata.poster})`;
    }
    
    // Set title and subtitle
    elements.mediaTitle.textContent = metadata.title;
    elements.mediaSubtitle.textContent = metadata.subtitle;
    
    // Configure UI based on content type
    if (metadata.isLive || metadata.type === CONTENT_TYPE.LIVE) {
        console.log('[linslog] UI: Configured for LIVE content');
        elements.liveBadge.classList.add('active');
        elements.progressContainer.classList.remove('active');
        
        if (metadata.poster) {
            elements.channelLogo.style.backgroundImage = `url(${metadata.poster})`;
            elements.channelLogo.classList.add('active');
        }
    } else {
        console.log('[linslog] UI: Configured for VOD content');
        elements.liveBadge.classList.remove('active');
        elements.progressContainer.classList.add('active');
        elements.channelLogo.classList.remove('active');
        startProgressTracking();
    }
    
    showScreen('playing');
}

/**
 * Show error state
 */
function showError(message) {
    console.error('[linslog] Showing error:', message);
    elements.errorMessage.textContent = message;
    showScreen('error');
    
    setTimeout(() => {
        console.log('[linslog] Auto-returning to idle after error');
        showScreen('idle');
    }, 10000);
}

/**
 * Show buffering indicator
 */
function showBuffering() {
    if (elements.playingScreen.classList.contains('active')) {
        elements.bufferingOverlay.classList.add('active');
    }
}

/**
 * Hide buffering indicator
 */
function hideBuffering() {
    elements.bufferingOverlay.classList.remove('active');
}

// ============================================
// PROGRESS TRACKING (VOD)
// ============================================

/**
 * Start tracking playback progress
 */
function startProgressTracking() {
    stopProgressTracking();
    progressUpdateInterval = setInterval(() => {
        updateProgress();
    }, 1000);
}

/**
 * Stop tracking playback progress
 */
function stopProgressTracking() {
    if (progressUpdateInterval) {
        clearInterval(progressUpdateInterval);
        progressUpdateInterval = null;
    }
}

/**
 * Update progress bar and time display
 */
function updateProgress() {
    const currentTime = elements.player.currentTime;
    const duration = elements.player.duration;
    
    if (!isNaN(duration) && duration > 0) {
        const percentage = (currentTime / duration) * 100;
        elements.progressFill.style.width = `${percentage}%`;
        elements.currentTime.textContent = formatTime(currentTime);
        elements.duration.textContent = formatTime(duration);
    }
}

/**
 * Format seconds to MM:SS or HH:MM:SS
 */
function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
        return `${hours}:${pad(minutes)}:${pad(secs)}`;
    } else {
        return `${minutes}:${pad(secs)}`;
    }
}

/**
 * Pad number with leading zero
 */
function pad(num) {
    return num < 10 ? `0${num}` : num;
}

// ============================================
// STARTUP
// ============================================

console.log('[linslog] ========================================');
console.log('[linslog] IPTV Cast Receiver Loading...');
console.log('[linslog] Version: 2.0 (Fixed)');
console.log('[linslog] ========================================');

// Wait for DOM to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeReceiver);
} else {
    initializeReceiver();
}

// ============================================
// GLOBAL ERROR HANDLER
// ============================================

window.addEventListener('error', (event) => {
    console.error('[linslog] Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('[linslog] Unhandled promise rejection:', event.reason);
});

console.log('[linslog] Receiver script loaded successfully');
