# How to run the app

For Mac users, the easiest path is to double-click [launch-career-compass.command](launch-career-compass.command). It will:

1. Make sure you are on `main` and pull the latest changes from `origin/main`.
2. Start Redis locally with Docker if it is not already running.
3. Run `npm install` or `npm ci` in both the backend and frontend folders.
4. Start the backend on `http://127.0.0.1:5001` and the frontend on `http://127.0.0.1:3002`.

If you want to run it manually instead, the same order is:

1. `git checkout main && git pull --ff-only`
2. Start Redis if needed: `docker run -d --name clarity-coach-redis -p 6379:6379 redis:7-alpine`
3. `cd web-server && npm install && npm run dev`
4. `cd client/client/app && npm install && npm run dev`