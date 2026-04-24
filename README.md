# Collab Editor

A real-time collaborative code editor — multiple users can edit the same file simultaneously, with conflict resolution handled via Operational Transformation (OT).

## Tech stack

- **Backend:** Python, Flask, Flask-SocketIO, Eventlet
- **Frontend:** React, Vite, Tailwind CSS, Socket.IO client
- **Algorithm:** Operational Transformation for conflict-free concurrent edits

## How to run locally

### Backend
```bash
pip install -r requirements.txt
python app.py
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in two browser tabs to test real-time collaboration.

## How it works

Every keystroke is converted into a small operation (insert or delete at a position). Operations are sent to the server with a revision number. If two users type at the same time, the server transforms the late-arriving operation using OT before applying it — so no one's edits are lost.