# Quran Academy LMS Platform

A complete, enterprise-grade Learning Management System (LMS) specifically built for online Quran academies, featuring real-time video/voice classroom management, scheduling, billing, student/teacher portals, and an **autonomous AI Voice & Chat Moderation Microservice**.

---

## Repository Structure

```
quran-academy-lms/
├── lms-backend/               # Core Node.js / Express backend with Sequelize & Socket.IO
├── lms-new-frontend/          # Next.js / React production web frontend
├── ai-moderation-service/     # Python FastAPI AI microservice (Whisper ASR + ML Intent Model)
├── start-all.bat              # 1-Click launcher for Windows
├── start-all.sh               # Production daemon launcher for Linux (PM2)
└── README.md
```

---

## Key Modules

### 1. LMS Backend (`lms-backend`)
* Built with **Node.js**, **Express**, **Sequelize ORM**, and **MySQL**.
* Real-time bidirectional communication powered by **Socket.IO**.
* Role-based access control: `admin`, `teacher`, `student`, and `parent`.
* Class scheduling, attendance, course tracking, and live video classroom management.
* **Integrated AI Moderation Bridge:** Non-blocking async inspection of classroom chat messages and automated receipt of live voice violation alerts.

### 2. LMS Frontend (`lms-new-frontend`)
* Modern, responsive interface built with **Next.js** and **React**.
* Dedicated dashboard layouts for Administrators, Teachers, Students, and Parents.
* Interactive live class calling interface and real-time messaging.

### 3. AI Moderation Service (`ai-moderation-service`)
* Background microservice powered by **FastAPI** and **Python 3.12+**.
* **Faster-Whisper Speech-to-Text:** Live multilingual transcription for English, Urdu, and Roman Urdu.
* **Trained ML Intent Classifier (`intent_model.joblib`):** Detects off-platform solicitation, private tuition offers, and unauthorized payment requests with 99.8% F1 accuracy.
* **PII Detection:** Automatically identifies phone numbers, WhatsApp, social IDs, emails, and physical addresses.
* **10–15s Audio Clip Generator:** Automatically extracts and saves audio clips around detected live voice violations for admin review.
* **Secure Webhooks:** Sends instant alerts to the LMS Backend and pushes notifications to online admins.

---

## Quick Start (Local Development)

### Prerequisites
* **Node.js** v18+ & **npm**
* **Python** 3.12+
* **MySQL** 8.0+

### Option A: 1-Click Launch (Windows)
Double-click `start-all.bat` or run:
```cmd
start-all.bat
```
This automatically starts both the AI Moderation Service (`localhost:8000`) and the LMS Backend (`localhost:8080`).

### Option B: 1-Click Launch (Linux / VPS)
```bash
chmod +x start-all.sh
./start-all.sh
```
*(Uses PM2 if installed, or runs as reliable background daemons).*

---

## Starting Services Individually

### 1. AI Moderation Service
```bash
cd ai-moderation-service
python -m venv .venv
# Windows:
.\.venv\Scripts\activate
# Linux:
source .venv/bin/activate

pip install -r requirements.txt
copy .env.example .env    # Windows (or cp on Linux)
python run.py
```
*Health Check:* `http://localhost:8000/api/moderation/health`

### 2. LMS Backend
```bash
cd lms-backend
npm install
copy .env.example .env    # Configure your MySQL credentials
npm start
```
*API Base:* `http://localhost:8080`

### 3. LMS Frontend
```bash
cd lms-new-frontend
npm install
npm run dev
```
*Web App:* `http://localhost:3000`

---

## Admin Moderation Dashboard Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/admin/moderation/alerts` | Paginated list of moderation alerts (filterable by status, risk, session) |
| `GET` | `/api/admin/moderation/stats` | Moderation overview metrics (pending, high risk, today count) |
| `GET` | `/api/admin/moderation/alerts/:id` | Detailed alert view with transcription & findings |
| `PATCH` | `/api/admin/moderation/alerts/:id/review` | Mark alert status (`reviewed`, `false_alarm`, `action_taken`) |
| `GET` | `/api/admin/moderation/clips/:id` | Stream 10–15 second audio evidence clip |
| `POST` | `/api/admin/moderation/webhook` | Internal webhook for AI service alerts (secret-token protected) |

---

## License
Proprietary — All rights reserved for Quran Academy.
