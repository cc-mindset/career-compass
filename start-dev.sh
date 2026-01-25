#!/usr/bin/env bash

echo "🚀 Starting CC-AI Development Environment"

set -euo pipefail

find_free_port() {
    for port in {5001..5010}; do
        if ! lsof -nP -iTCP:${port} -sTCP:LISTEN >/dev/null 2>&1; then
            echo "$port"
            return 0
        fi
    done
    return 1
}

echo "Checking MongoDB..."
if ! pgrep -x "mongod" >/dev/null 2>&1; then
    echo "MongoDB not running. Start it manually with: brew services start mongodb-community"
fi

echo "\n📦 Setting up backend..."
cd backend

echo "Starting Python resume parser on port 5000..."
python resume_api.py > /tmp/python_api.log 2>&1 &
PYTHON_PID=$!
echo "Python PID: ${PYTHON_PID}"

sleep 2

npm install --silent
echo "Backend dependencies installed"

PORT_TO_USE=$(find_free_port) || (echo "No free port found" >&2 && exit 1)
export PORT=${PORT_TO_USE}

echo "Starting Node backend on port ${PORT}..."
node --watch server.js &
BACKEND_PID=$!
echo "Backend PID: ${BACKEND_PID}"

sleep 2

echo "\n📦 Setting up frontend..."
cd ../frontend
npm install --silent
echo "Frontend dependencies installed"

echo "Starting frontend on port 5173..."
VITE_API_URL="http://localhost:${PORT}" npm run dev &
FRONTEND_PID=$!
echo "Frontend PID: ${FRONTEND_PID}"

echo "\nServices running:"
echo "Frontend: http://localhost:5173"
echo "Backend: http://localhost:${PORT}"
echo "Python API: http://localhost:5000"
echo "\nPress Ctrl+C to stop"

trap "kill ${BACKEND_PID} ${PYTHON_PID} ${FRONTEND_PID} 2>/dev/null || true" EXIT
wait