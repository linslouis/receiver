/**
 * IPTV Cast Receiver
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
    console.log('[Cast Receiver] Initializing...');
    
    // Get Cast context
    receiverContext = cast.framework.CastReceiverContext.getInstance();
    
    // Configure receiver options
    const options = new cast.framework.CastReceiverOptions();
    options.maxInactivity = RECEIVER_CONFIG.maxInactivity;
    options.statusText = RECEIVER_CONFIG.statusText;
    options.disableIdleTimeout = false;
    
    // Get player manager
    playerManager = receiverContext.getPlayerManager();
    
    // Configure supported media commands
    playerManager.setSupportedMediaCommands(
        RECEIVER_CONFIG.supportedCommands.reduce((acc, cmd) => acc | cmd, 0),
        true
    );
    
    // Register event listeners
    registerPlayerEventListeners();
    registerVideoEventListeners();
    
    // Start receiver
    receiverContext.start(options);
    
    console.log('[Cast Receiver] Initialized successfully');
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
}

/**
 * Register HTML5 video element event listeners
 */
function registerVideoEventListeners() {
    
    elements.player.addEventListener('playing', () => {
        console.log('[Video] Playing');
        hideBuffering();
    });
    
    elements.player.addEventListener('waiting', () => {
        console.log('[Video] Buffering');
        showBuffering();
    });
    
    elements.player.addEventListener('pause', () => {
        console.log('[Video] Paused');
    });
    
    elements.player.addEventListener('ended', () => {
        console.log('[Video] Ended');
        stopProgressTracking();
        setTimeout(() => showScreen('idle'), 2000);
    });
    
    elements.player.addEventListener('error', (e) => {
        console.error('[Video] Error:', e);
        handleVideoError();
    });
    
    elements.player.addEventListener('timeupdate', () => {
        updateProgress();
    });
}

// ============================================
// CAST EVENT HANDLERS
// ============================================

/**
 * Handle LOAD request from sender
 * Extract metadata and configure playback
 */
function handleLoadRequest(loadRequestData) {
    console.log('[Cast] LOAD request received', loadRequestData);
    
    const media = loadRequestData.media;
    
    if (!media || !media.contentId) {
        console.error('[Cast] Invalid media data');
        showError('Invalid content');
        return loadRequestData;
    }
    
    // Extract custom metadata
    currentMetadata = extractMetadata(media);
    console.log('[Cast] Metadata:', currentMetadata);
    
    // Show loading state
    showLoadingState(currentMetadata);
    
    // Configure HLS playback
    if (media.contentType === 'application/x-mpegurl' || 
        media.contentType === 'application/vnd.apple.mpegurl') {
        console.log('[Cast] HLS stream detected');
    }
    
    return loadRequestData;
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
        metadata.title = media.customData.title || metadata.title;
        metadata.subtitle = media.customData.subtitle || metadata.subtitle;
        metadata.poster = media.customData.poster || metadata.poster;
        metadata.type = media.customData.type || metadata.type;
        metadata.isLive = media.customData.isLive || (metadata.type === CONTENT_TYPE.LIVE);
    }
    
    // Fallback to standard metadata
    if (media.metadata) {
        metadata.title = media.metadata.title || metadata.title;
        metadata.subtitle = media.metadata.subtitle || media.metadata.series || metadata.subtitle;
        
        // Extract poster from images array
        if (media.metadata.images && media.metadata.images.length > 0) {
            metadata.poster = media.metadata.images[0].url;
        }
    }
    
    return metadata;
}

/**
 * Handle load complete event
 */
function handleLoadComplete(event) {
    console.log('[Cast] Load complete');
    showPlayingState(currentMetadata);
}

/**
 * Handle player errors
 */
function handlePlayerError(event) {
    console.error('[Cast] Player error:', event);
    const errorMessage = getErrorMessage(event.detailedErrorCode);
    showError(errorMessage);
}

/**
 * Handle media status changes
 */
function handleMediaStatus(event) {
    const playerState = event.playerState;
    console.log('[Cast] Player state:', playerState);
    
    switch (playerState) {
        case cast.framework.messages.PlayerState.IDLE:
            if (event.idleReason === cast.framework.messages.IdleReason.FINISHED) {
                console.log('[Cast] Playback finished');
            } else if (event.idleReason === cast.framework.messages.IdleReason.ERROR) {
                console.error('[Cast] Playback error');
                showError('Playback error occurred');
            } else if (event.idleReason === cast.framework.messages.IdleReason.INTERRUPTED) {
                console.log('[Cast] Playback interrupted');
            }
            break;
            
        case cast.framework.messages.PlayerState.BUFFERING:
            showBuffering();
            break;
            
        case cast.framework.messages.PlayerState.PLAYING:
            hideBuffering();
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
        switch (error.code) {
            case error.MEDIA_ERR_ABORTED:
                message = 'Playback aborted';
                break;
            case error.MEDIA_ERR_NETWORK:
                message = 'Network error occurred';
                break;
            case error.MEDIA_ERR_DECODE:
                message = 'Content format not supported';
                break;
            case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                message = 'Stream not available';
                break;
        }
    }
    
    showError(message);
}

/**
 * Get user-friendly error message
 */
function getErrorMessage(errorCode) {
    // Map error codes to user-friendly messages
    // No technical codes shown per PRD
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
    console.log(`[UI] Switching to ${screenName} screen`);
    
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
    // Set title
    elements.loadingTitle.textContent = metadata.title;
    
    // Set poster if available
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
    // Set background poster
    if (metadata.poster) {
        elements.backgroundPoster.style.backgroundImage = `url(${metadata.poster})`;
    }
    
    // Set title and subtitle
    elements.mediaTitle.textContent = metadata.title;
    elements.mediaSubtitle.textContent = metadata.subtitle;
    
    // Configure UI based on content type
    if (metadata.isLive || metadata.type === CONTENT_TYPE.LIVE) {
        // Live TV mode
        elements.liveBadge.classList.add('active');
        elements.progressContainer.classList.remove('active');
        
        // Show channel logo if poster exists
        if (metadata.poster) {
            elements.channelLogo.style.backgroundImage = `url(${metadata.poster})`;
            elements.channelLogo.classList.add('active');
        }
    } else {
        // VOD mode
        elements.liveBadge.classList.remove('active');
        elements.progressContainer.classList.add('active');
        elements.channelLogo.classList.remove('active');
        
        // Start progress tracking
        startProgressTracking();
    }
    
    showScreen('playing');
}

/**
 * Show error state
 */
function showError(message) {
    elements.errorMessage.textContent = message;
    showScreen('error');
    
    // Auto-return to idle after 10 seconds
    setTimeout(() => {
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
    stopProgressTracking(); // Clear any existing interval
    
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
        // Update progress bar
        const percentage = (currentTime / duration) * 100;
        elements.progressFill.style.width = `${percentage}%`;
        
        // Update time display
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
    console.error('[Global Error]', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('[Unhandled Promise Rejection]', event.reason);
});

console.log('[Cast Receiver] Script loaded');

