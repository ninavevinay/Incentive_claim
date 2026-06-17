from __future__ import annotations

from rest_framework import serializers

from .models import (
    Application,
    EmailOtp,
    Feedback,
    FormWindow,
    LoginEvent,
    Notice,
    Notification,
    PasswordResetRequest,
    User,
)
from .routing import dashboard_path_for_user, slugify_department


class TokenResponseSerializer(serializers.Serializer):
    access_token = serializers.CharField()
    token_type = serializers.CharField(default="bearer")


class MessageResponseSerializer(serializers.Serializer):
    message = serializers.CharField()


class OtpRequestResponseSerializer(serializers.Serializer):
    message = serializers.CharField()
    expires_in_seconds = serializers.IntegerField()
    resend_after_seconds = serializers.IntegerField()


class RequestOtpSerializer(serializers.Serializer):
    email = serializers.EmailField()
    purpose = serializers.ChoiceField(choices=["register"])
    name = serializers.CharField(min_length=2, max_length=120)
    password = serializers.CharField(min_length=6, max_length=128, trim_whitespace=False)
    role = serializers.CharField(max_length=64)
    department = serializers.CharField(min_length=1, max_length=120)


class VerifyOtpSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp = serializers.CharField(min_length=4, max_length=10)
    purpose = serializers.ChoiceField(choices=["register"])


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(min_length=1, max_length=128, trim_whitespace=False)


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()


class ResetPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp = serializers.CharField(min_length=4, max_length=10)
    new_password = serializers.CharField(min_length=6, max_length=128, trim_whitespace=False)


class UserOutSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    email = serializers.EmailField()
    role = serializers.CharField()
    department = serializers.CharField()
    department_slug = serializers.SerializerMethodField()
    dashboard_path = serializers.SerializerMethodField()

    def get_department_slug(self, obj) -> str:
        return slugify_department(getattr(obj, "department", None))

    def get_dashboard_path(self, obj) -> str:
        return dashboard_path_for_user(getattr(obj, "role", ""), getattr(obj, "department", None))


class UserUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(required=False, allow_blank=False, allow_null=False, max_length=120)
    department = serializers.CharField(required=False, allow_blank=False, allow_null=False, max_length=120)


class ApplicationSubmissionBaseSerializer(serializers.Serializer):
    department = serializers.CharField(max_length=120)
    applicant_name = serializers.CharField(max_length=120)
    mobile_number = serializers.CharField(max_length=50)
    academic_year = serializers.CharField(max_length=50)
    academic_year_type = serializers.CharField(max_length=10)
    email = serializers.EmailField()
    incentive_claim_count = serializers.IntegerField()
    course_platform = serializers.CharField(max_length=120)
    course_title = serializers.CharField(max_length=255)
    nptel_application_number = serializers.CharField(max_length=120)
    course_session = serializers.CharField(max_length=120)
    course_weeks = serializers.IntegerField()
    course_score = serializers.CharField(max_length=120)
    course_category = serializers.CharField(max_length=120)
    course_credits = serializers.IntegerField()
    registration_fee_paid = serializers.FloatField()
    permissible_claim = serializers.FloatField()
    fee_receipt_file = serializers.FileField()
    certificate_file = serializers.FileField()
    photograph_file = serializers.FileField()
    signature_file = serializers.FileField(required=False, allow_null=True)
    declaration_accepted = serializers.BooleanField()


class StudentApplicationCreateSerializer(ApplicationSubmissionBaseSerializer):
    usn = serializers.CharField(max_length=120)
    semester = serializers.CharField(max_length=50)
    bank_account_number = serializers.CharField(max_length=120)
    bank_ifsc = serializers.CharField(max_length=50)
    bank_branch = serializers.CharField(max_length=120)
    bank_name = serializers.CharField(max_length=120)
    bank_passbook_file = serializers.FileField()


class FacultyApplicationCreateSerializer(ApplicationSubmissionBaseSerializer):
    designation = serializers.CharField(max_length=120)


class ApplicationReviewSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["approve", "reject"])
    remark = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=500)
    approved_amount = serializers.FloatField(required=False, allow_null=True)


class ApplicationOutSerializer(serializers.ModelSerializer):
    class Meta:
        model = Application
        fields = ("id", "application_type", "status", "approved_amount", "data", "created_at")


class PublicApprovedHighlightOutSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    application_type = serializers.CharField()
    applicant_name = serializers.CharField()
    course_category = serializers.CharField()
    percentage = serializers.CharField()
    photograph_file = serializers.CharField()
    created_at = serializers.DateTimeField()


class AdminUserOutSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "name", "email", "role", "department", "is_active")


class LoginEventOutSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoginEvent
        fields = ("id", "user_id", "email", "ip_address", "user_agent", "created_at")


class PasswordResetOutSerializer(serializers.ModelSerializer):
    class Meta:
        model = PasswordResetRequest
        fields = ("id", "user_id", "email", "token", "request_ip", "created_at", "used_at")


class AdminCreateAuthorityUserSerializer(serializers.Serializer):
    name = serializers.CharField(min_length=2, max_length=120)
    email = serializers.EmailField()
    password = serializers.CharField(min_length=6, max_length=128, trim_whitespace=False)
    role = serializers.CharField(max_length=64)
    department = serializers.CharField(min_length=1, max_length=120)


class AdminFormWindowOutSerializer(serializers.Serializer):
    start_date = serializers.DateField(allow_null=True, required=False)
    end_date = serializers.DateField(allow_null=True, required=False)


class AdminFormWindowUpdateSerializer(serializers.Serializer):
    start_date = serializers.DateField()
    end_date = serializers.DateField()


class AdminFeedbackOutSerializer(serializers.ModelSerializer):
    class Meta:
        model = Feedback
        fields = (
            "id",
            "user_id",
            "name",
            "email",
            "role",
            "department",
            "benefit_status",
            "message",
            "rating",
            "created_at",
        )


class FeedbackCreateSerializer(serializers.Serializer):
    benefit_status = serializers.ChoiceField(
        choices=["beneficial", "partially_beneficial", "not_beneficial"],
        default="beneficial",
        required=False,
    )
    message = serializers.CharField(min_length=5, max_length=1500)
    rating = serializers.IntegerField(required=False, allow_null=True, min_value=1, max_value=5)


class FeedbackOutSerializer(serializers.ModelSerializer):
    class Meta:
        model = Feedback
        fields = (
            "id",
            "user_id",
            "name",
            "email",
            "role",
            "department",
            "benefit_status",
            "message",
            "rating",
            "created_at",
        )


class NoticeOutSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notice
        fields = ("id", "title", "file_path", "created_at")


class NoticeCreateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    notice_file = serializers.FileField()


class NotificationOutSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ("id", "message", "is_read", "created_at")


class AdminUserBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "name", "email", "role", "department", "is_active")


class FormWindowRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = FormWindow
        fields = ("start_date", "end_date", "updated_at")

