# Incentive Claim Portal

Full‑stack portal for students, faculty, authorities, and admins to submit, review, and manage incentive applications.

**Key Features**
- Role‑based authentication (student, faculty, authority, admin)
- Student & faculty application submission with document uploads
- Multi‑level review workflow (department coordinator → HOD → institution coordinator)
- Admin dashboard: users, applications, login events, authority registration, form window
- Notifications and public notices

**Tech Stack**
- Frontend: React + Vite + Tailwind CSS
- Backend: FastAPI + SQLAlchemy + PostgreSQL
- Auth: JWT
- File storage: local `backend/uploads`

## Project Structure
```
backend/   FastAPI API + DB + uploads
frontend/  React UI (Vite)
```

## Local Setup (Development)

### 1) Database (PostgreSQL)
Create DB and tables:
```bash
psql -U postgres -f backend/schema.sql
```

### 2) Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac
pip install -r requirements.txt
```

Create `.env` in `backend/`:
```
DATABASE_URL=postgresql+psycopg://postgres:<password>@localhost:5432/incentive_db
SECRET_KEY=change_me
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_SECONDS=60
RATE_LIMIT_MAX_REQUESTS=600
```

Run backend:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3) Frontend
```bash
cd frontend
npm install
```

For local dev, set API base URL (so the UI can reach the backend):
```
VITE_API_URL=http://localhost:8000
```

Run frontend:
```bash
npm run dev
```

Open: `http://localhost:5173`

## Production Notes
- Serve frontend `dist/` with Nginx (or any static server).
- Proxy `/api` and `/uploads` to the FastAPI server.
- Configure Nginx `client_max_body_size` for uploads.
- Store secrets in `.env` and keep it out of Git.

## File Upload Limits
Current UI validation limits each file to **150KB**. If you see HTTP `413` errors, increase reverse proxy limits or reduce file size.

## Routes & Roles
- Student/Faculty registration: `/register`
- Admin registration: `/register-admin`
- Authority accounts are created by Admin in the Admin Dashboard.

## Troubleshooting
- **413 Request Entity Too Large**: Increase proxy limit and/or reduce file size.
- **CORS issues**: Set `VITE_API_URL` to your backend URL in local development.
