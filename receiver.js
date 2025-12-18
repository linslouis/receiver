'use strict';

let globalRequestHeaders = {};
let context = cast.framework.CastReceiverContext.getInstance();
let playerManager = context.getPlayerManager();

if (cast.debug && cast.debug.CastDebugLogger) {
  cast.debug.CastDebugLogger.getInstance().setEnabled(true);
}

const playbackConfig = new cast.framework.PlaybackConfig();
playbackConfig.autoResumeDuration = 5;
playbackConfig.enableSmoothLivePlayback = true;
playbackConfig.liveSeekableRange = true;

const injectHeaders = (req) => {
  Object.entries(globalRequestHeaders || {}).forEach(([k, v]) => {
    req.headers[k] = v;
  });
};

playbackConfig.manifestRequestHandler = injectHeaders;
playbackConfig.segmentRequestHandler = injectHeaders;
playbackConfig.licenseRequestHandler = injectHeaders;

playerManager.setMessageInterceptor(
  cast.framework.messages.MessageType.LOAD,
  (load) => {
    const media = load.media;
    if (!media || !media.contentId) return load;

    const isLive =
      media.streamType === cast.framework.messages.StreamType.LIVE ||
      media.contentId.endsWith('.m3u8');

    media.streamType = isLive
      ? cast.framework.messages.StreamType.LIVE
      : cast.framework.messages.StreamType.BUFFERED;

    if (media.contentId.endsWith('.m3u8')) {
      media.contentType = 'application/x-mpegURL';
    }

    globalRequestHeaders = media.customData?.headers || {};
    return load;
  }
);

context.start({ playbackConfig });
