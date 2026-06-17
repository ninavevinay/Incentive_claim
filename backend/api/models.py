from __future__ import annotations

from datetime import datetime

from django.db import models


class User(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=120)
    email = models.CharField(max_length=255, unique=True)
    password_hash = models.CharField(max_length=255)
    google_sub = models.CharField(max_length=255, unique=True, null=True, blank=True)
    auth_provider = models.CharField(max_length=32, default="local")
    role = models.CharField(max_length=64)
    department = models.CharField(max_length=120)
    is_active = models.BooleanField(default=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "users"
        managed = False

    @property
    def is_authenticated(self) -> bool:
        return True

    @property
    def is_anonymous(self) -> bool:
        return False

    def __str__(self) -> str:
        return f"{self.name} <{self.email}>"


class Application(models.Model):
    id = models.AutoField(primary_key=True)
    owner = models.ForeignKey(
        User,
        db_column="owner_id",
        related_name="applications",
        on_delete=models.CASCADE,
    )
    application_type = models.CharField(max_length=64)
    status = models.CharField(max_length=64, default="submitted")
    approved_amount = models.FloatField(null=True, blank=True)
    data = models.JSONField(default=dict)
    created_at = models.DateTimeField(default=datetime.utcnow)

    class Meta:
        db_table = "applications"
        managed = False

    def __str__(self) -> str:
        return f"Application {self.id}"


class Notification(models.Model):
    id = models.AutoField(primary_key=True)
    user = models.ForeignKey(
        User,
        db_column="user_id",
        related_name="notifications",
        on_delete=models.CASCADE,
    )
    message = models.CharField(max_length=255)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=datetime.utcnow)

    class Meta:
        db_table = "notifications"
        managed = False

    def __str__(self) -> str:
        return self.message


class Notice(models.Model):
    id = models.AutoField(primary_key=True)
    title = models.CharField(max_length=255)
    file_path = models.CharField(max_length=500)
    created_by = models.ForeignKey(
        User,
        db_column="created_by",
        related_name="notices",
        on_delete=models.CASCADE,
    )
    created_at = models.DateTimeField(default=datetime.utcnow)

    class Meta:
        db_table = "notices"
        managed = False

    def __str__(self) -> str:
        return self.title


class LoginEvent(models.Model):
    id = models.AutoField(primary_key=True)
    user = models.ForeignKey(
        User,
        db_column="user_id",
        related_name="login_events",
        on_delete=models.CASCADE,
    )
    email = models.CharField(max_length=255)
    ip_address = models.CharField(max_length=64)
    user_agent = models.CharField(max_length=255)
    created_at = models.DateTimeField(default=datetime.utcnow)

    class Meta:
        db_table = "login_events"
        managed = False


class EmailOtp(models.Model):
    id = models.AutoField(primary_key=True)
    email = models.CharField(max_length=255)
    purpose = models.CharField(max_length=32)
    otp_hash = models.CharField(max_length=128)
    password_hash = models.CharField(max_length=255, null=True, blank=True)
    name = models.CharField(max_length=120, null=True, blank=True)
    role = models.CharField(max_length=64, null=True, blank=True)
    department = models.CharField(max_length=120, null=True, blank=True)
    user = models.ForeignKey(
        User,
        db_column="user_id",
        null=True,
        blank=True,
        related_name="email_otps",
        on_delete=models.SET_NULL,
    )
    request_ip = models.CharField(max_length=64)
    created_at = models.DateTimeField(default=datetime.utcnow)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "email_otps"
        managed = False


class PasswordResetRequest(models.Model):
    id = models.AutoField(primary_key=True)
    user = models.ForeignKey(
        User,
        db_column="user_id",
        related_name="password_reset_requests",
        on_delete=models.CASCADE,
    )
    email = models.CharField(max_length=255)
    token = models.CharField(max_length=128, unique=True)
    request_ip = models.CharField(max_length=64)
    created_at = models.DateTimeField(default=datetime.utcnow)
    used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "password_reset_requests"
        managed = False


class FormWindow(models.Model):
    id = models.IntegerField(primary_key=True, default=1)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    updated_at = models.DateTimeField(default=datetime.utcnow)

    class Meta:
        db_table = "form_windows"
        managed = False


class Feedback(models.Model):
    id = models.AutoField(primary_key=True)
    user = models.OneToOneField(
        User,
        db_column="user_id",
        related_name="feedback",
        on_delete=models.CASCADE,
    )
    name = models.CharField(max_length=120)
    email = models.CharField(max_length=255)
    role = models.CharField(max_length=64)
    department = models.CharField(max_length=120)
    benefit_status = models.CharField(max_length=32, default="beneficial")
    message = models.CharField(max_length=1500)
    rating = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(default=datetime.utcnow)

    class Meta:
        db_table = "feedbacks"
        managed = False

    def __str__(self) -> str:
        return f"Feedback {self.id}"

