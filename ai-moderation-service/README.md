# QALMS AI Moderation Service

High-performance AI Moderation Microservice for the Quran Academy LMS. It powers real-time audio and chat policy enforcement across live classrooms, detecting unauthorized personal information sharing (phone numbers, WhatsApp, social IDs, emails, addresses) and solicitation (private tuition offers, off-platform payments, poaching).

---

## Architecture Overview

This service operates as an autonomous background AI microservice integrated with the primary LMS application:

```
[Student / Teacher]
       │  (Live Audio & Chat)
       ▼
 [LMS Backend (Node.js)] ──── (HTTP / WebSockets) ────► [AI Moderation Service (Python)]
       ▲                                                           │
       │                                                    Faster-Whisper (ASR)
       │                                                    Intent Classifier (ML)
       │                                                    15s Audio Clip Generator
       │                                                           │
       └────────────── (Secure Webhook Alerts & Clips) ────────────┘
```

1. **Text & Chat Moderation:** `lms-backend` sends chat messages to `POST /api/moderation/check-text`. The response returns in `< 1ms` with risk assessment, matched categories, and confidence scores.
2. **Live Voice Moderation:** Live class audio is processed through VAD (Voice Activity Detection) and Faster-Whisper ASR.
3. **10–15s Audio Clip Generation:** When a violation is detected during a live session, a 15-second audio clip (with padding before and after) is automatically cut and stored.
4. **LMS Webhook Notification:** The service posts alerts directly to the LMS Backend webhook (`/api/admin/moderation/webhook`), notifying administrators in real time.

---

## AI Models & Detection Stack

* **Speech-to-Text Engine:** `faster-whisper` (CTranslate2) utilizing `large-v3-turbo` for high-accuracy Urdu, English, and Roman Urdu transcription.
* **Intent Classification Model:** Pre-trained ML pipeline (`app/pii/intent_model.joblib`) trained on academy dataset (`qalms dataset.xlsx`) using TF-IDF word/char n-grams with 99.8% F1 accuracy across 29 violation categories.
* **Rule & Pattern Normalizer:** Advanced phonenumber, WhatsApp, social handle, and address regex matchers adapted for phonetic Roman Urdu spelling variations.

---

## Installation & Setup

### Requirements
* Python 3.12+
* FFmpeg (for audio processing)
* Windows or Linux VPS (CPU or NVIDIA GPU)

### Quick Start

1. **Create and activate a virtual environment:**
   ```bash
   python -m venv .venv
   # Windows:
   .\.venv\Scripts\activate
   # Linux / macOS:
   source .venv/bin/activate
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment:**
   ```bash
   copy .env.example .env     # Windows
   cp .env.example .env       # Linux
   ```

4. **Start the service:**
   ```bash
   python run.py
   ```
   The service will start on `http://localhost:8000`. Health check endpoint: `http://localhost:8000/api/moderation/health`.

---

## Configuration (`.env`)

| Variable | Default | Description |
|---|---|---|
| `HOST` | `0.0.0.0` | Bind host address |
| `PORT` | `8000` | Port for the AI microservice |
| `LMS_API_URL` | `http://localhost:8080` | URL of the main LMS Express backend |
| `LMS_WEBHOOK_SECRET` | `qalms_ai_webhook_secret_key` | Shared secret to authenticate webhook alerts |
| `AI_SERVICE_URL` | `http://localhost:8000` | Base URL used by LMS to fetch audio clips |
| `WHISPER_MODEL` | `large-v3-turbo` | Whisper model (`large-v3-turbo`, `small`, etc.) |
| `WHISPER_DEVICE` | `cpu` | Execution device (`cpu` or `cuda` for NVIDIA GPU) |
| `WHISPER_COMPUTE` | `int8` | Compute precision (`int8` for CPU, `float16` for GPU) |
| `LANG_MODE` | `auto` | Language transcription mode (`auto`, `ur`, `en`) |
| `ALERT_THRESHOLD` | `0.75` | Minimum confidence score to trigger an alert |
| `CLIP_TOTAL_S` | `15` | Total length of violation audio clip in seconds |

---

## API Endpoints

### 1. Check Text (Chat Moderation)
* **`POST /api/moderation/check-text`**
* **Request:**
  ```json
  {
    "text": "mera number 03001234567 hai mujhse direct rabta karein",
    "senderName": "Student 1",
    "senderType": "student",
    "sessionId": 42
  }
  ```
* **Response:**
  ```json
  {
    "alert": true,
    "category": "contact_sharing",
    "risk_level": "high",
    "confidence": 0.98,
    "intent": "Sharing phone or contact info",
    "findings": [{"type": "phone", "matched": "03001234567"}]
  }
  ```

### 2. Audio Clip Stream
* **`GET /api/clips/{alert_id}`**
* Proxies the 10–15s WAV audio evidence clip for admin review.

### 3. Health & Readiness
* **`GET /api/moderation/health`**
* Returns service status and Whisper model loading status.

---

## Retraining the Intent Model

If you wish to update the ML model with additional classroom training data:
```bash
python train_intent_model.py
```
This reads `qalms dataset.xlsx`, performs cross-validation, and saves the updated weights to `app/pii/intent_model.joblib`.

---

## Production Deployment

### Docker Deployment
```bash
docker compose up -d --build
```

### PM2 Process Manager (Linux)
```bash
pm2 start run.py --name "ai-moderation" --interpreter .venv/bin/python -- --lan
```
