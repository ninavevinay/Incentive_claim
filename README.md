# SBJIT NPTEL Reimbursement Portal

Private internal web platform for students, faculty, authorities, and admins to submit, review, and manage NPTEL incentive reimbursement applications.

## Stack
- **Frontend**: React 18 + Vite + Tailwind CSS + Lucide Icons + jsPDF
- **Backend**: FastAPI + SQLAlchemy 2.0 + PostgreSQL + Redis + Pydantic v2 + Uvicorn/Gunicorn
- **Architecture**: Scalable gateway-first layout with Redis rate limiting, JWT token management, and optional service slicing
- **Auth**: Email OTP verification for `@sbjit.edu.in` domain + JWT session tokens + Bcrypt password hashing
- **File Storage**: Local `backend/uploads` with server-side validation (types, dimensions, maximum file size)

## Key Rules
- Only `@sbjit.edu.in` email addresses are allowed for account registration.
- Student and faculty users self-register via email OTP verification.
- Authority users (Department Coordinator, Department HOD, Institution Coordinator) are created by an Admin.
- Admin self-registration is restricted to allowlisted emails in `ADMIN_EMAIL_ALLOWLIST`.
- Forgot password workflow uses OTP verification sent to the registered email before allowing password reset.

---

## Local Setup

### 1) Database
Create the PostgreSQL database once:
```bash
psql -U postgres -c "CREATE DATABASE incentive_db;"
```

### 2) Redis (Optional / Automatic Fallback)
Ensure Redis is running locally on port `6379`, or configure `REDIS_URL` in `backend/.env`. If Redis is unavailable, the application gracefully falls back to `fakeredis` in-memory mode for development.

### 3) Backend Setup
Navigate to the `backend` directory:
```bash
cd backend
```

Create a Python virtual environment and install dependencies:
```bash
python -m venv venv
# On Windows PowerShell:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
```

Create or update `backend/.env`:
```env
DATABASE_URL=postgresql://postgres:<your_password>@localhost:5432/incentive_db
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=your_super_secret_jwt_key_here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
RATE_LIMIT_ENABLED=true
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
PORT=8000
SERVICE_NAME=gateway
OTP_EXPIRE_MINUTES=10
OTP_RESEND_SECONDS=60
OTP_LENGTH=6
DB_POOL_SIZE=20
DB_MAX_OVERFLOW=40
DB_POOL_TIMEOUT_SECONDS=30
DB_POOL_RECYCLE_SECONDS=1800
DB_STATEMENT_TIMEOUT_MS=30000
APP_QUERY_DEFAULT_LIMIT=100
APP_QUERY_MAX_LIMIT=500
```

Run Backend in Development Mode:
```bash
python main.py
```
*(Or run with Uvicorn auto-reload)*:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
Database tables are automatically created on backend startup via SQLAlchemy metadata (`Base.metadata.create_all`).

Interactive API Documentation:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

Run Backend in Production Mode:
```bash
gunicorn -c gunicorn.conf.py app.main:app
```

---

### Service Slicing (Optional)
The backend FastAPI application can expose a specific API slice by setting `SERVICE_NAME` in `backend/.env`:
- `gateway`: Full API surface for the frontend (default)
- `auth`: OTP, login, registration, password reset, profile
- `applications`: Submissions, review workflow, feedback, notifications
- `admin`: Admin console operations, user management, notices
- `notifications`: Notification listing and read status endpoints
- `public`: Public notices, highlights, and health check

---

### 4) Frontend Setup
Navigate to the `frontend` directory:
```bash
cd frontend
npm install
```

Set frontend environment variable in `frontend/.env` (optional, default proxies to backend):
```env
VITE_API_URL=http://localhost:8000/api
```

Run Frontend:
```bash
npm run dev
```

---

## SMTP Note
For Gmail SMTP, `SMTP_PASSWORD` must be a **Google App Password**, not your primary Google account password.

## Verification & Authentication Flow
1. **Register**: Sends OTP to `@sbjit.edu.in` email. User submits OTP to complete account creation.
2. **Admin Register**: Verified against `ADMIN_EMAIL_ALLOWLIST`.
3. **Login**: Authenticates with email + password, returning JWT access token.
4. **Forgot Password**: Sends reset OTP to registered email and updates password hash upon verification.
5. **Authority Accounts**: Created directly by Admin from the Admin Dashboard.

## Scalability Features (Supported up to 100k Users)
- **High-Performance FastAPI Async Engine**: Handles async requests with Redis sliding-window rate limiting.
- **SQLAlchemy 2.0 Connection Pooling**: Optimized pool recycling, pool size, and timeout configurations.
- **Indexed Database Model**: PostgreSQL indexes on application statuses, user emails, roles, departments, and creation timestamps.
- **Server-Side Pagination & Filtering**: `limit`, `offset`, and query parameters on heavy admin and authority lists.

## Load Testing
- k6 script: `backend/loadtest/k6-portal.js`
- Guide: `backend/loadtest/README.md`
