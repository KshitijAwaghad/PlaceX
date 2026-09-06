# PlaceNexus AI

PlaceNexus AI compares an uploaded resume with a job description and returns an explainable career analysis, what-if projection, and 30-day roadmap.

## Project layout

- `frontend/` — React, Vite, TypeScript, and UI-only code.
- `backend/` — Express API, resume extraction/OCR, and analysis services.
- `docs/` — architecture and API documentation.

## Run locally

Install dependencies in each application, then run each service in its own terminal.

Terminal 1 — backend:

```powershell
cd backend
npm install
npm run server
```

Terminal 2 — frontend:

```powershell
cd frontend
npm install
npm run dev
```

The backend runs at `http://localhost:5000`. The Vite frontend runs at `http://localhost:5174` and calls that backend by default. Set `VITE_API_URL` in `frontend/.env` to change the API origin. Put backend-only secrets in `backend/.env`.

If either port is already in use, stop the correct existing development process or choose a different configured port before starting another instance. Do not run a second server on the same port.

Use `npm run build` from `frontend/` to create a production frontend build.
