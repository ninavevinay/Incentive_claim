# SBJIT NPTEL Reimburse Project Report

## 1. Executive Summary
SBJIT NPTEL Reimburse is an internal web portal designed to manage academic incentive claims for NPTEL and certification courses. The system supports student and faculty application submission, department and institution level approval, admin user management, OTP-based registration and password reset, PDF form generation, and transparent status tracking.

The application is built as a two-part system:
- A React frontend for the public site and dashboards
- A Django REST backend for authentication, workflow rules, data validation, file handling, and approvals

This report documents the purpose, architecture, modules, workflow, and operational behavior of the current implementation.

## 2. Project Objective
The main objective of the portal is to digitize the incentive reimbursement process and reduce manual paperwork. It provides:
- Secure registration and login
- Role-based access control
- Structured application forms
- Multi-level approval workflow
- Upload and storage of supporting documents
- PDF export of submitted forms
- Administrative control for users, notices, and form windows

## 3. Technology Stack
### Frontend
- React 18
- Vite
- React Router
- Tailwind CSS
- Lucide React icons
- jsPDF and jsPDF-AutoTable for form export

### Backend
- Django
- Django REST Framework
- PostgreSQL
- JWT-based authentication
- Bcrypt password hashing
- Email OTP workflow

### Storage and Assets
- Local file storage under `backend/uploads`
- Image and PDF uploads with server-side validation
- Public assets for branding, hero banners, and notices

## 4. User Roles
The system uses role-based access control. The major roles are:

| Role | Responsibility |
| --- | --- |
| Student | Submit student applications, track status, print form, manage profile |
| Faculty | Submit faculty applications, track status, print form, manage profile |
| Department Coordinator | First-level review for users in the same department |
| Department HOD | Second-level review for users in the same department |
| Institution Coordinator | Final approval and approved amount entry |
| Admin | Create authority users, manage users, notices, applications, form window, and logs |

Important access rules:
- Only `@sbjit.edu.in` email addresses are allowed
- Student and faculty accounts are self-registered through OTP
- Authority users are created by admin
- Admin self-registration is restricted to an allowlist

## 5. System Architecture
The portal is organized into four layers:

### 5.1 Presentation Layer
The React frontend provides:
- Landing page with public information
- Login and registration pages
- Separate dashboards for student, faculty, authority, and admin users
- Responsive layout with a mobile hamburger menu and desktop sidebar

### 5.2 API Layer
The Django REST backend exposes endpoints for:
- Authentication
- Application submission
- Review and approval
- User and admin management
- Notices, feedback, and tracking

### 5.3 Business Logic Layer
Workflow rules are implemented in backend service functions. These rules control:
- Who can register
- Which role can submit which form
- Which review stage is currently valid
- Which department can review a request
- Whether the form window is open
- Whether file and field validation passes

### 5.4 Data Layer
The database stores:
- Users
- Applications
- Notifications and email logs
- OTP records
- Password reset records
- Notices
- Form window dates
- Feedback

## 6. Core Modules
### Frontend Modules
- `App.jsx`: route control, auth protection, global header and footer
- `LandingPage.jsx`: public home page, highlights, notices, workflow summary
- `Login.jsx`: password login
- `Register.jsx`: student/faculty registration with OTP
- `ForgotPassword.jsx`: OTP-based password reset
- `StudentDashboard.jsx`: student application and tracking
- `FacultyDashboard.jsx`: faculty application and tracking
- `AuthorityDashboard.jsx`: review and approval console
- `AdminDashboard.jsx`: admin operations console
- `components/layout/AppHeader.jsx`: responsive header and hamburger menu
- `components/Sidebar.jsx`: dashboard navigation and user summary
- `lib/applicationFormPdf.js`: printable form generation

### Backend Modules
- `api/models.py`: database models
- `api/serializers.py`: request and response validation
- `api/workflow.py`: registration, submission, and review rules
- `api/views.py`: endpoint handlers
- `api/security.py`: password hashing, OTP, JWT, email validation
- `api/storage.py`: upload validation and file saving
- `api/notifications.py`: email notification dispatch
- `api/routing.py`: dashboard path mapping

## 7. Database Model Summary
### User
Stores account details such as:
- Name
- Email
- Password hash
- Role
- Department
- Active/inactive state

### Application
Stores each incentive request:
- Owner user
- Application type: student or faculty
- Workflow status
- Approved amount
- Full JSON payload of form data
- Created time

### EmailOtp
Stores OTP challenges for:
- Registration
- Password reset

### PasswordResetRequest
Stores password reset request metadata and token history.

### Notification
Stores notification records if used by the workflow or admin modules.

### Notice
Stores public notice title, file path, creator, and timestamp.

### FormWindow
Stores the start and end dates for form submission availability.

### Feedback
Stores one feedback entry per user.

### LoginEvent
Stores login audit information such as email, IP address, and user agent.

## 8. Public Site Workflow
The public landing page acts as the entry point for the portal.

### User Journey
1. User opens the home page.
2. The hero section introduces the portal.
3. Public highlights explain the portal benefits.
4. Notices are displayed from backend data.
5. The user chooses Login or Create Account.

### Public Content
- Hero carousel
- Service highlights
- About points
- Workflow summary
- Notices board

## 9. Registration Workflow
The registration flow uses OTP verification.

### Student and Faculty Registration
1. User opens the registration page.
2. User enters name, email, password, role, and department.
3. Backend checks that the email belongs to `@sbjit.edu.in`.
4. Backend rejects authority roles from self-registration.
5. An OTP is sent to the entered email.
6. User verifies the OTP.
7. The account is created and a JWT token is issued.
8. The user is redirected to the correct dashboard.

### Admin Registration
1. Admin registration is restricted to allowlisted email addresses.
2. After verification, admin accounts can access the admin dashboard.

### Registration Constraints
- Duplicate email addresses are blocked
- OTP resend is rate-limited
- OTP expires after a configured time

## 10. Login And Password Reset
### Login Workflow
1. User enters email and password.
2. Backend validates the password hash.
3. A JWT access token is generated.
4. A login event is recorded with IP and user agent.
5. The user is redirected to the dashboard based on role.

### Forgot Password Workflow
1. User enters registered email.
2. Backend sends a password reset OTP if the account exists.
3. User verifies the OTP.
4. User sets a new password.
5. Password hash is updated.

## 11. Application Submission Workflow
The submission workflow is the core of the system.

### Shared Rules
- Form submission is allowed only when the form window is open
- Students and faculty have different form structures
- Each user can submit only two applications in six months
- Files are validated before storage
- Uploaded files are saved on the backend server

### Student Application Flow
1. Student opens the application form.
2. Student fills personal and academic details.
3. Student adds course details and bank details.
4. Student uploads:
   - Fee receipt
   - Certificate
   - Bank passbook
   - Photograph
   - Optional signature
5. Student accepts the declaration.
6. Form is submitted.
7. The application is stored with status `pending_department_coordinator`.
8. The applicant receives a submission confirmation.
9. The department coordinator receives a review alert.

### Faculty Application Flow
1. Faculty opens the application form.
2. Faculty fills personal and academic details.
3. Faculty adds course details and designation.
4. Faculty uploads:
   - Fee receipt
   - Certificate
   - Photograph
   - Optional signature
5. Faculty accepts the declaration.
6. Form is submitted.
7. The application is stored with status `pending_department_coordinator`.
8. The applicant receives a submission confirmation.
9. The department coordinator receives a review alert.

## 12. Approval Workflow
The review process is sequential and role-driven.

### Status Flow
`pending_department_coordinator -> pending_department_hod -> pending_institution_coordinator -> approved`

If a reviewer rejects the form, the status becomes `rejected`.

### Review Rules
- Department Coordinator can review only applications from the same department
- Department HOD can review only applications from the same department
- Institution Coordinator performs the final approval
- Rejection requires a remark
- Final approval requires an approved amount

### Review Steps
1. Department Coordinator checks the submitted documents and details.
2. If approved, the application moves to HOD review.
3. HOD checks the recommendation and departmental correctness.
4. If approved, the application moves to Institution Coordinator review.
5. Institution Coordinator either approves with amount or rejects with remark.
6. Final status and review history are stored in the application record.

### Notification Behavior
- Applicant receives email updates when the status changes
- Reviewers receive email alerts when an application reaches their stage

## 13. Admin Workflow
The admin dashboard provides system-wide control.

### Admin Functions
- Create authority users
- View and manage users
- Review login events
- Manage notices
- Manage form window start and end dates
- Manage application records
- Delete specific users or applications
- Remove all non-admin users when needed

### Authority User Management
Admins can create authority users for:
- Department Coordinator
- Department HOD
- Institution Coordinator

### Operational Control
The admin dashboard is also useful for:
- Auditing account activity
- Monitoring feedback
- Checking reset history
- Maintaining system readiness

## 14. PDF And Print Workflow
The portal supports printable form generation for submitted applications.

### PDF Behavior
The PDF export uses submitted application data and renders a formal incentive form. It includes:
- Applicant details
- Course details
- Financial details
- Bank details for students
- Declaration block
- Applicant signature block
- Office use table

### Office Use Section
The office use table is organized into four columns:
- Role
- Action
- Remark
- Sign

The rows are prepared for:
- Department Coordinator
- Department HOD
- Institution Coordinator

### Print Design Notes
- Uploaded document list is not printed in the final PDF
- The printed version is meant for office processing and approval
- Signature image is embedded if available
- The layout is designed to fit A4 pages cleanly

## 15. Responsive UI Behavior
The interface is responsive across mobile, tablet, and desktop sizes.

### Mobile Behavior
- Dashboard header shows a hamburger menu in the app header
- Sidebar opens as a mobile drawer
- Forms stack into single-column layouts when needed
- Buttons and cards resize for smaller screens

### Desktop Behavior
- Dashboard sidebar is fixed and visible
- Content area adjusts beside the sidebar
- Navigation is easier for long forms and tables

### Public Layout
- Public header shows brand identity and links
- Mobile navigation collapses into a menu
- Hero and content sections scale across screen sizes

## 16. Security And Validation
The portal includes several validation layers.

### Authentication Security
- JWT access tokens
- Password hashing with bcrypt
- OTP verification for registration and reset
- Login audit logging

### Data Validation
- Email domain restriction
- Role validation
- Department validation
- Course category validation
- Academic year type validation
- Required declaration acceptance

### File Validation
- PDF only for receipts, certificates, and bank passbook
- JPG only for student photographs
- JPG/PNG for signatures
- File size limited to 150KB
- Photograph is standardized after upload

## 17. API Endpoint Summary
The backend exposes the following major endpoint groups:

### Authentication
- `POST /api/auth/request-otp`
- `POST /api/auth/verify-otp`
- `POST /api/auth/login`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

### Profile
- `GET /api/profile/me`
- `PUT /api/profile/me`
- `DELETE /api/profile/me`

### Applications
- `POST /api/applications/student`
- `POST /api/applications/faculty`
- `GET /api/applications/mine`
- `GET /api/applications/track/<id>`
- `GET /api/applications/pending`
- `GET /api/applications/all`
- `POST /api/applications/<id>/review`

### Admin And Support
- `GET /api/admin/users`
- `GET /api/admin/applications`
- `GET /api/admin/login-events`
- `GET /api/admin/feedback`
- `GET /api/admin/password-resets`
- `PUT /api/admin/form-window`
- `POST /api/notices/`
- `GET /api/notices/public`
- `POST /api/feedback/`

## 18. Deployment And Run Notes
### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Backend
```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

### Production Considerations
- Use environment variables for secrets and SMTP settings
- Configure PostgreSQL for production
- Store media uploads on persistent storage
- Put the backend behind a reverse proxy
- Use a process manager such as Gunicorn, PM2, or systemd depending on hosting setup

## 19. Key Business Rules
- Only `@sbjit.edu.in` users can register
- Authority self-registration is disabled
- Admin registration is allowlist-based
- Student and faculty submissions are limited to two per six months
- Form submission is controlled by the form window
- Department reviewers can only process their own department applications
- Final approval is only by the institution coordinator

## 20. Conclusion
SBJIT NPTEL Reimburse is a complete workflow-driven portal for managing academic incentive applications. It combines role-based dashboards, OTP-secured onboarding, structured form submission, approval routing, PDF export, and administrative controls into a single platform.

The system is well suited for institutional processing because it keeps the workflow transparent, validates documents before storage, and preserves a clear record of submission and review activity.
