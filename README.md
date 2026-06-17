# SBJIT NPTEL Reimburse

Private internal platform for students, faculty, authorities, and admins to submit, review, and manage NPTEL reimbursement applications.

## Stack
- Frontend: React + Vite + Tailwind CSS
- Backend: Django + Django REST Framework + PostgreSQL
- Auth: Email OTP to `@sbjit.edu.in` addresses + JWT session token
- File storage: local `backend/uploads`

## Key Rules
- Only `@sbjit.edu.in` email addresses are allowed.
- Student and faculty users self-register with email OTP.
- Authority users must be created by an admin first.
- Admin self-registration is limited to emails in `ADMIN_EMAIL_ALLOWLIST`.
- Password login is enabled.
- Forgot password uses OTP verification on registered email before allowing password reset.

## Local Setup

### 1) Database
```bash
psql -U postgres -f backend/schema.sql
```

### 2) Backend
```bash
cd backend
pip install -r requirements.txt
```

Create or update `backend/.env`:
```env
DATABASE_URL=postgresql://postgres:<password>@localhost:5432/incentive_db
SECRET_KEY=change_me
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
RATE_LIMIT_ENABLED=false
RATE_LIMIT_WINDOW_SECONDS=60
RATE_LIMIT_MAX_REQUESTS=600
ALLOWED_EMAIL_DOMAIN=sbjit.edu.in
ADMIN_EMAIL_ALLOWLIST=admin@sbjit.edu.in
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-sender@gmail.com
SMTP_PASSWORD=your-gmail-app-password
SMTP_FROM_EMAIL=your-sender@gmail.com
SMTP_FROM_NAME=SBJIT NPTEL Reimburse
SMTP_USE_TLS=true
SMTP_USE_SSL=false
OTP_EXPIRE_MINUTES=10
OTP_RESEND_SECONDS=60
OTP_LENGTH=6
DB_POOL_SIZE=20
DB_MAX_OVERFLOW=40
DB_POOL_TIMEOUT_SECONDS=30
DB_POOL_RECYCLE_SECONDS=1800
DB_POOL_USE_LIFO=true
DB_STATEMENT_TIMEOUT_MS=30000
APP_QUERY_DEFAULT_LIMIT=100
APP_QUERY_MAX_LIMIT=500
RUN_STARTUP_LEGACY_REPAIR=false
```
Only set this to `true` if you specifically need the one-time legacy review repair at startup.

Run backend:
```bash
python manage.py runserver 0.0.0.0:8000
```
Production run example:
```bash
gunicorn portal_backend.wsgi:application --bind 0.0.0.0:8000
```

### 3) Frontend
```bash
cd frontend
npm install
```

Set frontend env if needed:
```env
VITE_API_URL=http://localhost:8000/api
```
If you leave it unset, the Vite dev server proxies `/api` and `/uploads` to Django.

Run frontend:
```bash
npm run dev
```

## SMTP Note
For Gmail, `SMTP_PASSWORD` must be a Google App Password, not your regular Gmail password.

## Verification Flow
- Register page sends OTP with name, role, and department details.
- Admin register page sends OTP only for allowlisted admin emails.
- Login uses email + password after registration.
- Forgot Password sends reset OTP to the registered email and resets password after OTP verification.
- Authority accounts are created by admin and then login with saved password.

## Troubleshooting
- OTP email not sent: fill `SMTP_USERNAME`, `SMTP_PASSWORD`, and `SMTP_FROM_EMAIL` in `backend/.env`.
- Admin registration blocked: update `ADMIN_EMAIL_ALLOWLIST` in `backend/.env`.
- Invalid domain: use an `@sbjit.edu.in` address only.

## Scalability Notes (100k Registered Users)
- Authority and admin listing endpoints now support pagination and server-side search filters (`limit`, `offset`, `q`, role filters where applicable).
- Default dashboard polling has been reduced and tied to active/visible tabs to cut unnecessary load.
- Core DB indexes are applied in `backend/schema.sql` and startup schema updates.
- For high traffic, tune DB pool and worker counts using the new `.env` settings above.

## Load Testing
- k6 script: `backend/loadtest/k6-portal.js`
- Guide: `backend/loadtest/README.md`

