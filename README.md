# 🎯 Spot It! Tracker

A simple PWA to track your **Spot It** deck-clearing times with your partner. Time yourselves, save results, and watch your progress over time — all synced between your phones via Firebase.

## Features

- ⏱️ **Precision Timer** — Start/stop stopwatch with centisecond accuracy
- 💾 **Save Sessions** — Record your time with the date and player name
- 📋 **Session History** — View all recorded times, filter by player
- 📈 **Progress Chart** — See your improvement trend over time
- 📱 **PWA** — Install on your phone's home screen for app-like experience
- 🔄 **Real-time Sync** — Both players see all data via shared Firebase

## Quick Setup (5 minutes)

### 1. Create a Firebase Project (free)

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **"Create a project"** → name it anything (e.g., `spot-it-tracker`)
3. Disable Google Analytics (optional) → **Create Project**
4. Once created, click the **Web icon `</>`** on the project overview page
5. Name the app (e.g., `spot-it-web`) → click **Register app**
6. You'll see a `firebaseConfig` object — **copy it** (you'll paste it into the app later)
7. Go to **Build → Firestore Database** in the left sidebar
8. Click **Create database** → choose **Start in test mode** → pick any region → **Create**

> ⚠️ **Test mode** allows open read/write for 30 days. See [Security Rules](#security-rules) below to extend this.

### 2. Deploy the App

The easiest free option is **GitHub Pages**:

```bash
# In the spot-it-tracker folder
git init
git add .
git commit -m "Initial commit"

# Create a repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/spot-it-tracker.git
git branch -M main
git push -u origin main
```

Then in your GitHub repo: **Settings → Pages → Source: Deploy from branch → main → / (root) → Save**

Your app will be live at: `https://YOUR_USERNAME.github.io/spot-it-tracker/`

### 3. Open on Your Phones

1. Open the URL on both phones in Chrome/Safari
2. Enter your name
3. Paste the **same Firebase config** on both phones
4. Tap **"Add to Home Screen"** for an app-like experience
5. Start playing! 🎯

## Usage

1. **Timer Tab** — Tap START to begin timing, STOP when done, SAVE to record
2. **History Tab** — View all sessions, filter by player, delete mistakes
3. **Progress Tab** — See your best times, averages, and improvement chart

**Tip:** On desktop, press **Spacebar** to start/stop the timer!

## Security Rules

The app uses Firebase Anonymous Auth to secure data. Update your Firestore rules:

1. Go to **Authentication → Sign-in method → Anonymous → Enable**
2. Go to **Firestore Database → Rules** and paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /spotit_sessions/{document} {
      allow read, write: if request.auth != null;
    }
  }
}
```

> This ensures only authenticated app users can read/write data. Unauthenticated API calls are rejected.

## Updating the Manifest

If you deploy to a path other than `/spot-it-tracker/`, update the `start_url` in `manifest.json` to match your deployment path.

## Tech Stack

- Vanilla HTML/CSS/JavaScript (no framework, no build step)
- Firebase Firestore (free tier — 1 GiB storage, 50K reads/day)
- Chart.js for progress visualization
- PWA with service worker for offline support
