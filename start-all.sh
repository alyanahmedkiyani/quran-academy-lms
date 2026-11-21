#!/usr/bin/env bash
# ==============================================================================
# Start both LMS Backend and AI Moderation Service on Linux / VPS (PM2 or direct)
# ==============================================================================
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

echo "====================================================================="
echo " Starting QALMS Platform Services (Backend + AI Moderation)"
echo "====================================================================="

if command -v pm2 &> /dev/null; then
    echo "Using PM2 Process Manager..."
    
    # 1. Start AI Moderation Service
    cd "$DIR/ai-moderation-service"
    if [ ! -d ".venv" ]; then
        python3 -m venv .venv
        .venv/bin/pip install -r requirements.txt
    fi
    pm2 start run.py --name "ai-moderation" --interpreter .venv/bin/python -- --lan
    
    # 2. Start LMS Backend
    cd "$DIR/lms-backend"
    pm2 start app.js --name "lms-backend"
    
    pm2 save
    echo "PM2 Services Started:"
    pm2 status
else
    echo "PM2 not found. Starting background processes..."
    cd "$DIR/ai-moderation-service"
    nohup python3 run.py --lan > ai-moderation.log 2>&1 &
    echo "AI Moderation started (PID: $!). Logs in ai-moderation-service/ai-moderation.log"
    
    cd "$DIR/lms-backend"
    nohup node app.js > backend.log 2>&1 &
    echo "LMS Backend started (PID: $!). Logs in lms-backend/backend.log"
fi

echo "====================================================================="
echo "All services launched successfully!"
echo "AI Service: http://localhost:8000 (Health: /api/moderation/health)"
echo "LMS Backend: http://localhost:8080"
echo "====================================================================="
