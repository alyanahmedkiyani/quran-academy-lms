@echo off
echo =====================================================================
echo  Starting QALMS Platform Services (Backend + AI Moderation)
echo =====================================================================

echo 1. Starting AI Moderation Service (FastAPI + Whisper + Intent Classifier)...
start "QALMS AI Moderation Service" cmd /k "cd /d %~dp0ai-moderation-service && .\.venv\Scripts\activate && python run.py"

echo 2. Starting LMS Backend (Node.js Express + Socket.IO)...
start "QALMS LMS Backend" cmd /k "cd /d %~dp0lms-backend && npm start"

echo.
echo All services launched!
echo - AI Moderation: http://localhost:8000
echo - AI Health:     http://localhost:8000/api/moderation/health
echo - LMS Backend:   http://localhost:8080
echo =====================================================================
