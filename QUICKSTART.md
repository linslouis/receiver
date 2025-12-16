# Quick Start Guide

Get your IPTV Cast Receiver running in 5 minutes.

---

## 🚀 Deploy (Choose One)

### Option A: Firebase (Recommended)

```bash
# 1. Install Firebase CLI
npm install -g firebase-tools

# 2. Login
firebase login

# 3. Deploy
cd receiver
firebase init hosting
firebase deploy --only hosting

# 4. Copy the URL (e.g., https://your-app.web.app)
```

### Option B: GitHub Pages

```bash
# 1. Create repo on github.com
# 2. Push code
cd receiver
git init
git add .
git commit -m "Cast receiver"
git remote add origin https://github.com/yourusername/iptv-receiver.git
git push -u origin main

# 3. Enable Pages in repo settings
# 4. Copy the URL (e.g., https://yourusername.github.io/iptv-receiver/)
```

---

## 🎯 Register Receiver

1. Go to: https://cast.google.com/publish/
2. Click **Add New Application**
3. Select **Custom Receiver**
4. Enter your HTTPS URL from above
5. Click **Save**
6. **Copy the Application ID** (e.g., `ABCD1234`)

---

## 📱 Update Sender App

### Android (Kotlin)

```kotlin
// In your CastOptionsProvider
override fun getCastOptions(context: Context): CastOptions {
    return CastOptions.Builder()
        .setReceiverApplicationId("YOUR_APPLICATION_ID") // <- Paste your ID here
        .build()
}
```

### iOS (Swift)

```swift
// In AppDelegate
let options = GCKCastOptions(receiverApplicationID: "YOUR_APPLICATION_ID") // <- Paste your ID here
GCKCastContext.setSharedInstanceWith(options)
```

---

## 🎬 Cast Content

### Metadata Format

```json
{
  "contentId": "https://stream.example.com/channel.m3u8",
  "contentType": "application/x-mpegurl",
  "streamType": "LIVE",
  "customData": {
    "title": "Channel Name",
    "subtitle": "Program Title",
    "poster": "https://image.jpg",
    "type": "live",
    "isLive": true
  }
}
```

### Android Example

```kotlin
val mediaInfo = MediaInfo.Builder("https://stream.url/video.m3u8")
    .setStreamType(MediaInfo.STREAM_TYPE_LIVE)
    .setContentType("application/x-mpegurl")
    .setCustomData(
        JSONObject().apply {
            put("title", "CNN")
            put("subtitle", "Breaking News")
            put("poster", "https://cdn.example.com/cnn.png")
            put("type", "live")
            put("isLive", true)
        }
    )
    .build()

val request = MediaLoadRequestData.Builder()
    .setMediaInfo(mediaInfo)
    .build()

castSession?.remoteMediaClient?.load(request)
```

---

## ✅ Test

1. Open receiver URL in Chrome → Should see "Ready to Cast"
2. Cast from your app → Should load content
3. Check:
   - ✅ Live shows LIVE badge
   - ✅ VOD shows progress bar
   - ✅ Title and poster display

---

## 📖 Full Documentation

- **README.md** - Complete usage guide
- **DEPLOYMENT_GUIDE.md** - Detailed deployment steps
- **TESTING_GUIDE.md** - Testing procedures
- **IMPLEMENTATION_SUMMARY.md** - Technical details

---

## 🆘 Common Issues

### "Receiver not loading"
→ Check HTTPS URL is correct and accessible

### "Video not playing"
→ Verify stream URL is HLS (.m3u8) and accessible

### "Metadata not showing"
→ Check `customData` structure in sender code

### Need help?
→ See troubleshooting section in README.md

---

**Done! 🎉**

