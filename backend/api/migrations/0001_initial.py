from __future__ import annotations

from datetime import datetime

from django.db import migrations, models
from django.db.models.functions import Lower
from django.db.models.fields.json import KeyTextTransform


class Migration(migrations.Migration):
    initial = True

    dependencies: list[tuple[str, str]] = []

    operations = [
        migrations.CreateModel(
            name="User",
            fields=[
                ("id", models.AutoField(primary_key=True, serialize=False)),
                ("name", models.CharField(max_length=120)),
                ("email", models.CharField(max_length=255, unique=True)),
                ("password_hash", models.CharField(max_length=255)),
                ("google_sub", models.CharField(blank=True, max_length=255, null=True, unique=True)),
                ("auth_provider", models.CharField(default="local", max_length=32)),
                ("role", models.CharField(max_length=64)),
                ("department", models.CharField(max_length=120)),
                ("is_active", models.BooleanField(default=True)),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
            ],
            options={
                "db_table": "users",
                "indexes": [
                    models.Index(fields=["role", "department"], name="ix_users_role_dept"),
                ],
            },
        ),
        migrations.CreateModel(
            name="Application",
            fields=[
                ("id", models.AutoField(primary_key=True, serialize=False)),
                ("application_type", models.CharField(max_length=64)),
                ("status", models.CharField(default="submitted", max_length=64)),
                ("approved_amount", models.FloatField(blank=True, null=True)),
                ("data", models.JSONField(default=dict)),
                ("created_at", models.DateTimeField(default=datetime.utcnow)),
                (
                    "owner",
                    models.ForeignKey(
                        db_column="owner_id",
                        on_delete=models.CASCADE,
                        related_name="applications",
                        to="api.user",
                    ),
                ),
            ],
            options={
                "db_table": "applications",
                "indexes": [
                    models.Index(fields=["owner", "-created_at"], name="ix_app_owner_created"),
                    models.Index(fields=["status", "-created_at"], name="ix_app_status_created"),
                    models.Index(fields=["application_type", "-created_at"], name="ix_app_type_created"),
                    models.Index(fields=["-created_at"], name="ix_app_created_at"),
                    models.Index(Lower(KeyTextTransform("department", "data")), name="ix_app_dept_lower"),
                ],
            },
        ),
        migrations.CreateModel(
            name="Notification",
            fields=[
                ("id", models.AutoField(primary_key=True, serialize=False)),
                ("message", models.CharField(max_length=255)),
                ("is_read", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(default=datetime.utcnow)),
                (
                    "user",
                    models.ForeignKey(
                        db_column="user_id",
                        on_delete=models.CASCADE,
                        related_name="notifications",
                        to="api.user",
                    ),
                ),
            ],
            options={
                "db_table": "notifications",
                "indexes": [
                    models.Index(fields=["user", "-created_at"], name="ix_notif_user_created"),
                ],
            },
        ),
        migrations.CreateModel(
            name="Notice",
            fields=[
                ("id", models.AutoField(primary_key=True, serialize=False)),
                ("title", models.CharField(max_length=255)),
                ("file_path", models.CharField(max_length=500)),
                ("created_at", models.DateTimeField(default=datetime.utcnow)),
                (
                    "created_by",
                    models.ForeignKey(
                        db_column="created_by",
                        on_delete=models.CASCADE,
                        related_name="notices",
                        to="api.user",
                    ),
                ),
            ],
            options={
                "db_table": "notices",
            },
        ),
        migrations.CreateModel(
            name="LoginEvent",
            fields=[
                ("id", models.AutoField(primary_key=True, serialize=False)),
                ("email", models.CharField(max_length=255)),
                ("ip_address", models.CharField(max_length=64)),
                ("user_agent", models.CharField(max_length=255)),
                ("created_at", models.DateTimeField(default=datetime.utcnow)),
                (
                    "user",
                    models.ForeignKey(
                        db_column="user_id",
                        on_delete=models.CASCADE,
                        related_name="login_events",
                        to="api.user",
                    ),
                ),
            ],
            options={
                "db_table": "login_events",
                "indexes": [
                    models.Index(fields=["user", "-created_at"], name="ix_login_user_created"),
                ],
            },
        ),
        migrations.CreateModel(
            name="EmailOtp",
            fields=[
                ("id", models.AutoField(primary_key=True, serialize=False)),
                ("email", models.CharField(max_length=255)),
                ("purpose", models.CharField(max_length=32)),
                ("otp_hash", models.CharField(max_length=128)),
                ("password_hash", models.CharField(blank=True, max_length=255, null=True)),
                ("name", models.CharField(blank=True, max_length=120, null=True)),
                ("role", models.CharField(blank=True, max_length=64, null=True)),
                ("department", models.CharField(blank=True, max_length=120, null=True)),
                ("request_ip", models.CharField(max_length=64)),
                ("created_at", models.DateTimeField(default=datetime.utcnow)),
                ("expires_at", models.DateTimeField()),
                ("used_at", models.DateTimeField(blank=True, null=True)),
                (
                    "user",
                    models.ForeignKey(
                        blank=True,
                        db_column="user_id",
                        null=True,
                        on_delete=models.SET_NULL,
                        related_name="email_otps",
                        to="api.user",
                    ),
                ),
            ],
            options={
                "db_table": "email_otps",
                "indexes": [
                    models.Index(fields=["email"], name="ix_otp_email"),
                    models.Index(fields=["email", "purpose", "-created_at"], name="ix_otp_email_purpose_crt"),
                ],
            },
        ),
        migrations.CreateModel(
            name="PasswordResetRequest",
            fields=[
                ("id", models.AutoField(primary_key=True, serialize=False)),
                ("email", models.CharField(max_length=255)),
                ("token", models.CharField(max_length=128, unique=True)),
                ("request_ip", models.CharField(max_length=64)),
                ("created_at", models.DateTimeField(default=datetime.utcnow)),
                ("used_at", models.DateTimeField(blank=True, null=True)),
                (
                    "user",
                    models.ForeignKey(
                        db_column="user_id",
                        on_delete=models.CASCADE,
                        related_name="password_reset_requests",
                        to="api.user",
                    ),
                ),
            ],
            options={
                "db_table": "password_reset_requests",
                "indexes": [
                    models.Index(fields=["email"], name="ix_pr_email"),
                    models.Index(fields=["user", "-created_at"], name="ix_pr_user_created"),
                ],
            },
        ),
        migrations.CreateModel(
            name="FormWindow",
            fields=[
                ("id", models.IntegerField(default=1, primary_key=True, serialize=False)),
                ("start_date", models.DateField(blank=True, null=True)),
                ("end_date", models.DateField(blank=True, null=True)),
                ("updated_at", models.DateTimeField(default=datetime.utcnow)),
            ],
            options={
                "db_table": "form_windows",
            },
        ),
        migrations.CreateModel(
            name="Feedback",
            fields=[
                ("id", models.AutoField(primary_key=True, serialize=False)),
                ("name", models.CharField(max_length=120)),
                ("email", models.CharField(max_length=255)),
                ("role", models.CharField(max_length=64)),
                ("department", models.CharField(max_length=120)),
                ("benefit_status", models.CharField(default="beneficial", max_length=32)),
                ("message", models.CharField(max_length=1500)),
                ("rating", models.IntegerField(blank=True, null=True)),
                ("created_at", models.DateTimeField(default=datetime.utcnow)),
                (
                    "user",
                    models.OneToOneField(
                        db_column="user_id",
                        on_delete=models.CASCADE,
                        related_name="feedback",
                        to="api.user",
                    ),
                ),
            ],
            options={
                "db_table": "feedbacks",
                "indexes": [
                    models.Index(fields=["-created_at"], name="ix_fb_created_at"),
                ],
            },
        ),
    ]
