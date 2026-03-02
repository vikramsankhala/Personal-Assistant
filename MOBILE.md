# MeetScribe — Mobile App (Capacitor)

Capacitor wraps the existing Next.js web app in a native Android/iOS shell.
No rewrite needed — the same app that runs on Render becomes your mobile app.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 18+ | nodejs.org |
| Android Studio | Latest | developer.android.com/studio |
| Xcode (Mac only) | 15+ | Mac App Store |
| Java JDK | 17+ | adoptium.net |

---

## One-Time Setup (run from `frontend/`)

```bash
cd frontend
npm install           # installs Capacitor packages
npx cap add android   # scaffold Android project
npx cap add ios       # scaffold iOS project (Mac only)
```

---

## Daily Workflow

```bash
# Build static web output + sync to native projects
npm run mobile:sync

# Open in Android Studio
npm run mobile:android

# Open in Xcode
npm run mobile:ios

# Run directly on connected Android device
npm run mobile:run:android

# Run directly on connected iOS device
npm run mobile:run:ios
```

---

## Development Mode (No Local Build Needed)

`capacitor.config.ts` points the native shell to the live server:

```
server.url = 'https://vpa-backend-338d.onrender.com'
```

Install the app on your phone, and it loads live from Render.
Comment out `server.url` before releasing to the app stores.

---

## Android Permissions

Add to `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
```

---

## iOS Permissions

Add to `ios/App/App/Info.plist`:

```xml
<key>NSMicrophoneUsageDescription</key>
<string>MeetScribe needs microphone access to transcribe your meetings in real time.</string>
<key>NSSpeechRecognitionUsageDescription</key>
<string>MeetScribe uses speech recognition to generate accurate transcripts.</string>
```

---

## Production Release

**Android (Google Play — $25 one-time):**
1. Comment out `server.url` in `capacitor.config.ts`
2. `npm run mobile:sync`
3. Android Studio → Build → Generate Signed Bundle/APK
4. Upload `.aab` at play.google.com/console

**iOS (App Store — $99/yr):**
1. Comment out `server.url` in `capacitor.config.ts`
2. `npm run mobile:sync`
3. Xcode → Product → Archive → Distribute App
4. Submit at appstoreconnect.apple.com

---

## App Config

- **App ID:** `com.meetscribe.app`
- **App Name:** MeetScribe
- **Web assets:** `frontend/out/`
- **Backend:** `https://vpa-backend-338d.onrender.com`
- **Splash bg:** `#0A1628` (brand navy)
- **Capacitor version:** 6.x
