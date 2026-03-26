# 🍃 FruitSense AI — Complete Project

Voice-powered fruit freshness scanner.  
React (Vite) frontend  +  Flask (PyTorch) backend.

---

## 📁 Project Structure

```
fruitsense_project/
├── README.md
│
├── backend/
│   ├── app.py                        ← Flask REST API
│   ├── requirements.txt              ← Python dependencies
│   └── best_fruit_classifier.pth     ← ⚠️  PUT YOUR MODEL HERE
│
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js                ← proxies /classify etc. → localhost:5000
    └── src/
        ├── main.jsx
        └── App.jsx                   ← Full UI + voice control
```

---

## 🚀 Quick Start

### Step 1 — Backend

```bash
cd backend

# Install Python packages
pip install -r requirements.txt

# ⚠️  Copy your trained model into this folder as:
#     backend/best_fruit_classifier.pth

# Start the API
python app.py
# → http://localhost:5000
```

### Step 2 — Frontend

```bash
cd frontend

# Install Node packages
npm install

# Start dev server
npm run dev
# → http://localhost:3000
```

### Step 3 — Open in Chrome/Edge

```
http://localhost:3000
```

> **Use Chrome or Edge** — required for Web Speech API (voice recognition).

---

## 🎙️ Voice Commands

Tap the **🎤** button in the top-right to activate the voice assistant.

| Say…                                        | Action                    |
|---------------------------------------------|---------------------------|
| `"open camera"` / `"start camera"`          | Turn camera on            |
| `"close camera"` / `"stop camera"`          | Turn camera off           |
| `"scan"` / `"capture"` / `"take photo"`     | Capture & classify fruit  |
| `"analyze"` / `"identify"` / `"check fruit"`| Same as scan              |
| `"repeat"` / `"say again"`                  | Replay last spoken result |
| `"flip"` / `"switch camera"`                | Toggle front/back camera  |
| `"help"`                                    | List all commands         |

### Voice Flow Example
```
You  → [tap 🎤]
App  → "Voice assistant on. Say open camera to start."
You  → "open camera"
App  → "Camera is on. Point at a fruit and say scan."
You  → "scan"
App  → "Analyzing. Please hold still."
App  → "Fresh Green Apple. Fresh fruit. Confidence 94 percent. Color: Green. Great choice!"
You  → "repeat"
App  → [replays the result]
You  → "close camera"
App  → "Camera closed."
```

---

## 🌐 API Reference

| Method | Endpoint   | Description                            |
|--------|------------|----------------------------------------|
| GET    | /health    | Server + model status                  |
| GET    | /classes   | List all fruit classes                 |
| POST   | /classify  | Classify image → JSON result           |
| POST   | /tts       | Text → MP3 audio                       |

### POST /classify — Request
```json
{ "image_base64": "data:image/jpeg;base64,/9j/4AAQ..." }
```

### POST /classify — Response
```json
{
  "success": true,
  "top_prediction": {
    "class": "fresh_green_apple",
    "formatted_name": "Fresh Green Apple",
    "confidence": 94.23,
    "freshness": "Fresh"
  },
  "all_predictions": [
    { "class": "fresh_green_apple",  "formatted_name": "Fresh Green Apple",  "confidence": 94.23 },
    { "class": "fresh_red_apple",    "formatted_name": "Fresh Red Apple",    "confidence":  3.11 },
    { "class": "rotten_green_apple", "formatted_name": "Rotten Green Apple", "confidence":  2.66 }
  ],
  "voice_text": "Fresh Green Apple. Fresh fruit. Confidence 94 percent."
}
```

### POST /tts — Request
```json
{ "text": "Hello world", "lang": "en" }
```
Returns an `audio/mpeg` MP3 file.

---

## ⚙️ Environment Variables

| Variable   | Default                    | Description                  |
|------------|----------------------------|------------------------------|
| MODEL_PATH | best_fruit_classifier.pth  | Path to your .pth model file |

```bash
MODEL_PATH=/data/models/mymodel.pth python app.py
```

---

## 🏗️ Production Build

```bash
# Build frontend for production
cd frontend
npm run build          # outputs to frontend/dist/

# Serve dist/ with Nginx, or use Flask to serve it:
# app.py already serves on 0.0.0.0:5000
# Point your reverse proxy at that.
```

Change `API_BASE` in `vite.config.js` proxy section to point to your server.

---

## 📦 Dependencies

**Backend**
- Flask 2.3+, Flask-CORS
- PyTorch 2.0+, TorchVision
- Pillow, gTTS

**Frontend**
- React 18, Vite 4
- Zero extra runtime dependencies

---

## 🌍 Browser Support

| Browser | Camera | Voice Recognition |
|---------|--------|-------------------|
| Chrome  | ✅     | ✅                |
| Edge    | ✅     | ✅                |
| Firefox | ✅     | ⚠️ Limited        |
| Safari  | ✅     | ⚠️ iOS 14.5+      |

> Voice recognition requires HTTPS in production (localhost is exempt).
