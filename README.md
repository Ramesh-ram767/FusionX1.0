# CivicResolve AI — How to Run

You need **3 parts**. The Node server serves **frontend + backend API** together. The AI engine is a separate Python process.

| Part | Port | Required? |
|------|------|-----------|
| Frontend + Backend (`backend/server.js`) | **3001** | Yes |
| AI Engine (`ai-engine`) | **8000** | Optional (recommended) |

---

## Easiest (Windows) — all three

1. Install **[Node.js LTS](https://nodejs.org/)** and **Python 3.10+**
2. Double-click **`start.bat`** in the project folder  

That will:
- install backend packages if needed  
- open a **second window** for the AI engine (`:8000`)  
- start frontend + API on **`http://localhost:3001/`**

Keep **both** command windows open.

---

## Manual (2 terminals) — clearest for demos

### Terminal 1 — Frontend + Backend

```bash
cd path\to\Chennai
npm run setup
npm start
```

Open: **http://localhost:3001/**

### Terminal 2 — AI Engine

```bash
cd path\to\Chennai\ai-engine
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn api:app --host 0.0.0.0 --port 8000
```

First AI install can take a long time (ML packages). Later runs only need:

```bash
cd path\to\Chennai\ai-engine
venv\Scripts\activate
uvicorn api:app --host 0.0.0.0 --port 8000
```

---

## Health checks

| Check | URL |
|-------|-----|
| App / login | http://localhost:3001/ |
| Backend API | http://localhost:3001/api/health |
| AI engine | http://localhost:8000/health |
| Node → AI bridge | http://localhost:3001/api/ai-health |

If AI is offline, the app still runs with local fallbacks.

---

## Demo logins

On http://localhost:3001/login.html choose:

1. **Citizen** → report an issue  
2. **Admin** → priority queue → assign officer `OFF-001`  
3. **Civic Officer** → inspect / update tasks  

---

## Notes

- Prefer **http://localhost:3001/** (not opening HTML as `file://`) so API + pages share one origin.  
- Copy the whole `Chennai` folder to another laptop; skip re-copying `backend/node_modules` and `ai-engine/venv` — reinstall with the commands above.
