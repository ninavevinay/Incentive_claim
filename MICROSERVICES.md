# FastAPI Microservice & Distributed Architecture Map

This repository ships as a high-performance **FastAPI + Redis + React** platform.

## Service Roles

- `gateway`: full API surface, used by the frontend in normal development and deployment
- `auth`: login, registration, OTP, password reset, and profile endpoints
- `applications`: student/faculty submissions, tracking, review workflows, feedback, and notifications
- `admin`: administrative management, user operations, notices, and audit views
- `notifications`: notification listing and read-state updates
- `public`: homepage health checks, public notices, and public highlights

## Runtime Controls & Redis Integration

- `SERVICE_NAME` identifies the process role
- `REDIS_URL` configures the distributed Redis instance for sliding-window rate limiting, JWT token blacklisting, and query response caching.

Examples:

```env
SERVICE_NAME=gateway
REDIS_URL=redis://localhost:6379/0
```

## Running Backend

```bash
cd backend
python main.py
```

