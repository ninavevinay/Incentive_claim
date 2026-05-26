-- PostgreSQL schema
CREATE DATABASE incentive_db;
\c incentive_db;

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  google_sub VARCHAR(255) UNIQUE,
  auth_provider VARCHAR(32) NOT NULL DEFAULT 'local',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  deleted_at TIMESTAMP NULL,
  role VARCHAR(64) NOT NULL,
  department VARCHAR(120) NOT NULL
);

CREATE TABLE IF NOT EXISTS applications (
  id SERIAL PRIMARY KEY,
  owner_id INT NOT NULL REFERENCES users(id),
  application_type VARCHAR(64) NOT NULL,
  status VARCHAR(64) NOT NULL DEFAULT 'submitted',
  approved_amount DOUBLE PRECISION NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_applications_owner_created ON applications (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_applications_status_created ON applications (status, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_applications_type_created ON applications (application_type, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_applications_created_at ON applications (created_at DESC);
CREATE INDEX IF NOT EXISTS ix_applications_department_lower ON applications ((lower(data->>'department')));

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  message VARCHAR(255) NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_notifications_user_created ON notifications (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS notices (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  created_by INT NOT NULL REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS login_events (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  email VARCHAR(255) NOT NULL,
  ip_address VARCHAR(64) NOT NULL,
  user_agent VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_login_events_user_created ON login_events (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS password_reset_requests (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  email VARCHAR(255) NOT NULL,
  token VARCHAR(128) NOT NULL UNIQUE,
  request_ip VARCHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  used_at TIMESTAMP NULL
);
CREATE INDEX IF NOT EXISTS ix_password_reset_requests_email ON password_reset_requests (email);
CREATE INDEX IF NOT EXISTS ix_password_reset_requests_user_created ON password_reset_requests (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS email_otps (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  purpose VARCHAR(32) NOT NULL,
  otp_hash VARCHAR(128) NOT NULL,
  password_hash VARCHAR(255) NULL,
  name VARCHAR(120) NULL,
  role VARCHAR(64) NULL,
  department VARCHAR(120) NULL,
  user_id INT NULL REFERENCES users(id),
  request_ip VARCHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP NULL
);
CREATE INDEX IF NOT EXISTS ix_email_otps_email ON email_otps (email);
CREATE INDEX IF NOT EXISTS ix_email_otps_email_purpose_created ON email_otps (email, purpose, created_at DESC);

CREATE TABLE IF NOT EXISTS form_windows (
  id INT PRIMARY KEY,
  start_date DATE NULL,
  end_date DATE NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS feedbacks (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL UNIQUE REFERENCES users(id),
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(64) NOT NULL,
  department VARCHAR(120) NOT NULL,
  benefit_status VARCHAR(32) NOT NULL DEFAULT 'beneficial',
  message VARCHAR(1500) NOT NULL,
  rating INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_feedbacks_created_at ON feedbacks (created_at DESC);
CREATE INDEX IF NOT EXISTS ix_users_role_department ON users (role, department);
