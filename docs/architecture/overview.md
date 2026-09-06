# Architecture

The React/Vite client in `frontend/` is independent from the Express service in `backend/`.

```text
Browser → frontend (Vite) → backend (Express) → extraction / OCR / career analysis
```

The frontend stores only the temporary mock-login flag in browser local storage. Resume files are uploaded only to `backend/uploads/`, extracted, and removed after the API response. Backend secrets are read only from `backend/.env`.
