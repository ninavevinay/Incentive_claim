# Microservice Architecture Map

This repository currently ships as a working Django + React platform. To support a microservice-style deployment without breaking the existing app, the backend now exposes service-specific URL configurations that can be launched independently.

## Service Roles

- `gateway`: full API surface, used by the frontend in normal development and deployment
- `auth`: login, registration, OTP, password reset, and profile endpoints
- `applications`: student/faculty submissions, tracking, review workflows, feedback, and notifications
- `admin`: administrative management, user operations, notices, and audit views
- `notifications`: notification listing and read-state updates
- `public`: homepage health checks, public notices, and public highlights

## Runtime Controls

- `SERVICE_NAME` identifies the process role
- `ROOT_URLCONF` stays on the main Django router; the router selects the API slice from `SERVICE_NAME`

Examples:

```env
SERVICE_NAME=gateway
```

```env
SERVICE_NAME=auth
```

```env
SERVICE_NAME=applications
```

## Suggested Next Step

For a true distributed setup, the next step is to split the shared Django logic into separate deployable services with their own databases and async communication between them. The current structure is the safest bridge toward that goal.
