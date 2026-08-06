# SBJIT NPTEL Reimburse Project Report

## 1. Executive Summary
SBJIT NPTEL Reimburse is an internal web portal designed to manage academic incentive reimbursement claims for NPTEL and certification courses at SBJIT. The system supports student and faculty application submissions, department and institution-level approval routing, admin user management, OTP-based registration and password reset, PDF form generation, and transparent status tracking.

The application is engineered as a modern, decoupled web system:
- **Frontend**: A responsive React (Vite) single-page application for public landing and role-based user dashboards.
- **Backend**: A high-performance FastAPI service layer handling authentication, business workflows, Pydantic validation, file storage, Redis rate limiting, and database interactions via SQLAlchemy 2.0.

This report documents the architectural design, database schemas, module structures, workflows, and operational specifications of the application.

---

## 2. Project Objective
The main objective of the portal is to digitize and automate the academic incentive reimbursement workflow to eliminate manual paperwork and speed up approvals. Key operational features include:
- Secure OTP-verified registration and authentication.
- Strict role-based access control (RBAC).
- Dynamic application forms tailored for students and faculty.
- Multi-stage sequential approval workflow (Department Coordinator -> Department HOD -> Institution Coordinator).
- Document validation and secure storage under `backend/uploads`.
- Printable client-side PDF form export complete with signature blocks and office review tables.
- Comprehensive administrative control panel for managing users, notices, form submission windows, and audit logs.

---

## 3. Technology Stack

### Frontend
- **Framework**: React 18 with Vite
- **Routing**: React Router DOM (v6)
- **Styling**: Tailwind CSS with custom theme variables
- **Icons**: Lucide React
- **Document Export**: jsPDF and jsPDF-AutoTable for client-side PDF rendering

### Backend
- **Framework**: FastAPI (v0.115)
- **ASGI Server**: Uvicorn (Development) / Gunicorn with Uvicorn Workers (Production)
- **ORM & Database**: SQLAlchemy 2.0 with PostgreSQL (`psycopg3` driver)
- **Validation**: Pydantic v2
- **Caching & Rate Limiting**: Redis (v5.2 async client with automatic `fakeredis` fallback for development)
- **Security & Tokens**: JWT (`python-jose`) and Password Hashing (`bcrypt`)
- **Email Dispatch**: Built-in async SMTP client supporting TLS/SSL

### Storage & Assets
- Local file storage under `backend/uploads`
- Server-side mime type, file size (max 150KB), and image dimension validation
- Static asset serving via FastAPI `StaticFiles` mounting

---

## 4. User Roles & Access Control
The portal enforces strict role-based access control across 6 distinct user roles:

| Role | Responsibility |
| --- | --- |
| **Student** | Submit student reimbursement claims, track status, download PDF forms, manage profile |
| **Faculty** | Submit faculty reimbursement claims, track status, download PDF forms, manage profile |
| **Department Coordinator** | First-stage review for applications within their designated department |
| **Department HOD** | Second-stage review and recommendation for applications within their department |
| **Institution Coordinator** | Final approval stage and entry of approved reimbursement amounts |
| **Admin** | Create authority accounts, manage all users, update notices, toggle form submission windows, and review login/password reset audit logs |

### Key Access Rules
- Email addresses must belong to the institution domain (`@sbjit.edu.in`).
- Student and faculty accounts self-register via email OTP verification.
- Authority accounts (Coordinators & HODs) cannot self-register; they are provisioned directly by an Admin.
- Admin account self-registration is restricted to emails configured in `ADMIN_EMAIL_ALLOWLIST`.

---

## 5. System Architecture
The application follows a clean 4-tier layer model with an optional gateway microservice slice architecture.

### 5.1 Presentation Layer
The React single-page frontend provides:
- Public landing page featuring portal statistics, highlights, and notice boards.
- Dedicated dashboards for Student, Faculty, Authority, and Admin views.
- Mobile-responsive navigation featuring a collapsible sidebar drawer and top application header.

### 5.2 API Layer
The FastAPI backend exposes RESTful endpoints with Pydantic request/response validation schemas covering:
- Authentication & OTP operations (`/api/auth`)
- User profiles (`/api/profile`)
- Application submissions & review routing (`/api/applications`)
- Administrative operations (`/api/admin`)
- Notices & Feedback (`/api/notices`, `/api/feedback`)
- System Health (`/health`)

### 5.3 Business Logic Layer
Business logic and workflow rules are encapsulated within FastAPI router controllers and core services:
- Verification of `@sbjit.edu.in` domain and allowlisted admin emails.
- Submission constraints (max 2 applications per 6-month period per user).
- Active form submission window enforcement.
- Sequential review stage validation and department isolation.
- Image optimization and file type/size validation.

### 5.4 Data Layer
- **PostgreSQL**: Primary relational database storing users, applications, notifications, notices, form windows, and audit events.
- **Redis**: In-memory cache layer managing sliding-window API rate limiting, JWT token blacklist, and cached queries.

### 5.5 Microservice Slicing Capability
The FastAPI backend supports running as isolated API microservice slices via the `SERVICE_NAME` environment variable:

| Service Name | Scope & Endpoints |
| --- | --- |
| `gateway` | Full API surface for default single-instance deployments |
| `auth` | OTP requests, verification, login, password reset, profile endpoints |
| `applications` | Student/faculty application submission, review pipeline, feedback |
| `admin` | Admin dashboard operations, user provisioning, notice board management |
| `notifications` | Notification listing and read-state updates |
| `public` | Homepage health checks, public notices, and highlights |

---

## 6. Core Codebase Structure

### Frontend (`frontend/src/`)
- `App.jsx`: Global router setup, authentication guards, header and footer wrappers
- `pages/LandingPage.jsx`: Public portal homepage with highlights, workflow overview, and notices
- `pages/Login.jsx`: User password login page
- `pages/Register.jsx`: OTP-based student/faculty onboarding page
- `pages/ForgotPassword.jsx`: OTP-based password reset page
- `pages/StudentDashboard.jsx`: Student application submission & tracking console
- `pages/FacultyDashboard.jsx`: Faculty application submission & tracking console
- `pages/AuthorityDashboard.jsx`: Department and Institution review console
- `pages/AdminDashboard.jsx`: System administration and auditing console
- `components/layout/AppHeader.jsx`: Responsive navbar with user drawer controls
- `components/Sidebar.jsx`: Dashboard navigation links and active session details
- `lib/applicationFormPdf.js`: Printable jsPDF document builder

### Backend (`backend/app/`)
- `main.py`: FastAPI app initialization, CORS setup, RateLimitMiddleware, static file mounting, and lifespan management
- `core/config.py`: Centralized environment configurations using Pydantic Settings
- `core/database.py`: SQLAlchemy 2.0 engine, SessionLocal factory, and Base model class
- `core/redis.py`: Async Redis connection manager with fallback
- `core/security.py`: Password hashing (`bcrypt`), JWT token generation/decoding
- `models/`: SQLAlchemy ORM models (`user.py`, `application.py`, `email_otp.py`, `notice.py`, `feedback.py`, `login_event.py`, `form_window.py`)
- `schemas/`: Pydantic validation schemas (`auth.py`, `user.py`, `application.py`, `notice.py`, `feedback.py`, `admin.py`)
- `routers/`: FastAPI endpoint controllers (`auth.py`, `profile.py`, `applications.py`, `notifications.py`, `feedback.py`, `notices.py`, `admin.py`, `health.py`)
- `middleware/rate_limit.py`: Sliding-window rate-limiting middleware powered by Redis

---

## 7. Database Model Summary

### User (`models/user.py`)
Stores account credentials, assigned role, department, active status, and timestamps.

### Application (`models/application.py`)
Stores claim applications including owner ID, application type (`student` or `faculty`), current status, approved amount, review remarks, JSON payload of submitted form data, and review timestamps.

### EmailOtp (`models/email_otp.py`)
Tracks active OTP challenges, expiration times, and verification state for registration and password reset.

### Notice (`models/notice.py`)
Stores public notice titles, file attachment paths, creator ID, and posting dates.

### FormWindow (`models/form_window.py`)
Stores configuration for start and end dates controlling when reimbursement forms can be submitted.

### Feedback (`models/feedback.py`)
Stores user feedback messages submitted to system administrators.

### LoginEvent (`models/login_event.py`)
Stores audit records of user logins, recording IP address, user agent, and timestamp.

---

## 8. Application Workflows

### 8.1 Registration Workflow
1. User enters name, email (`@sbjit.edu.in`), password, role, and department.
2. Backend verifies email domain and rejects authority role self-registration.
3. An OTP is dispatched to the user's email address.
4. User submits the received OTP.
5. Account is created, password is hashed with `bcrypt`, and a JWT access token is issued.

### 8.2 Login & Password Reset Workflow
1. **Login**: User submits credentials. Backend verifies password hash, records a `LoginEvent`, and returns a JWT access token.
2. **Forgot Password**: User submits registered email. Backend sends an OTP. Upon verification, the user provides a new password which updates the stored hash.

### 8.3 Submission Workflow
1. System checks that the active submission `FormWindow` is currently open.
2. System verifies user has not exceeded 2 submissions in the last 6 months.
3. Applicant uploads required supporting files (Fee receipt, Certificate, Bank Passbook for students, Photo, Signature).
4. Files undergo size (max 150KB) and extension validation before saving to `backend/uploads`.
5. Application is saved with initial status `pending_department_coordinator`.

### 8.4 Multi-Stage Approval Workflow
Applications progress sequentially through approval stages:
```
pending_department_coordinator ──► pending_department_hod ──► pending_institution_coordinator ──► approved
```
- At any stage, a reviewer can reject the application by providing a mandatory remark, changing the status to `rejected`.
- **Department Coordinator & HOD**: Scope-restricted to review applications matching their own department.
- **Institution Coordinator**: Performs final review and enters the sanctioned reimbursement amount.

---

## 9. PDF Generation & Printing
Submitted applications can be exported as formal PDF forms directly from the browser using `jsPDF` and `jsPDF-AutoTable`.

### Key Elements of Printed Form
- Header with institutional branding and title.
- Complete applicant profile, academic details, and course information.
- Student bank account details (Bank name, Account number, IFSC code).
- Student/Faculty declaration text.
- Embedded digital signature (if uploaded).
- **Office Use Table**: Structured section with rows for Department Coordinator, Department HOD, and Institution Coordinator actions, remarks, and physical signature space.

---

## 10. Security & Data Protection
- **JWT Authentication**: Secure statetoken authorization passed via `Authorization: Bearer <token>` headers.
- **Password Security**: Password strings are hashed using `bcrypt` prior to storage.
- **Domain Locking**: Account creation strictly constrained to institutional `@sbjit.edu.in` emails.
- **Rate Limiting**: Sliding-window API rate limiting implemented via FastAPI middleware backed by Redis.
- **File Validation**: Strict file type matching (PDF/JPG/PNG) and size constraints (150KB maximum per file).

---

## 11. API Endpoint Overview

### Health
- `GET /health` / `GET /api/health`: Database and Redis connection status

### Authentication & Profile (`/api/auth`, `/api/profile`)
- `POST /api/auth/request-otp`: Request registration OTP
- `POST /api/auth/verify-otp`: Verify OTP and create account
- `POST /api/auth/login`: Authenticate and issue JWT token
- `POST /api/auth/forgot-password`: Request password reset OTP
- `POST /api/auth/reset-password`: Reset password using OTP
- `GET /api/profile/me`: Fetch logged-in user profile
- `PUT /api/profile/me`: Update profile details

### Applications (`/api/applications`)
- `POST /api/applications/student`: Submit student claim
- `POST /api/applications/faculty`: Submit faculty claim
- `GET /api/applications/mine`: List applications for current user
- `GET /api/applications/track/{id}`: Detailed tracking for a specific claim
- `GET /api/applications/pending`: List pending applications for reviewer's stage
- `POST /api/applications/{id}/review`: Submit approval or rejection review

### Admin & Operations (`/api/admin`, `/api/notices`, `/api/feedback`)
- `GET /api/admin/users`: List all users with pagination and search
- `POST /api/admin/create-authority`: Provision a new authority account
- `GET /api/admin/applications`: List all system applications
- `GET /api/admin/login-events`: Audit log of user logins
- `PUT /api/admin/form-window`: Update submission window start and end dates
- `POST /api/notices/`: Create a public notice
- `GET /api/notices/public`: Fetch public notices list
- `POST /api/feedback/`: Submit feedback to admin

---

## 12. Deployment & Execution Guide

### Running Backend (FastAPI)
```bash
cd backend
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
python main.py
```

### Running Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```

---

## 13. Conclusion
The SBJIT NPTEL Reimbursement Portal delivers a modern, robust, and secure web application for managing academic incentive claims. Built on FastAPI, SQLAlchemy, PostgreSQL, Redis, and React, it provides institutional users with role-tailored dashboards, verified email OTP onboarding, multi-stage approval routing, client-side PDF export, and full audit transparency.
